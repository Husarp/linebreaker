(() => {
    const DAY = 86_400_000;
    const EPOCH_YEAR = 2026;
    const EPOCH = new Date(EPOCH_YEAR, 0, 1).getTime();
    const LEGACY_EPOCH = Date.UTC(EPOCH_YEAR, 0, 1);
    const LEGACY_PERIOD = 30 * DAY;
    const CALENDAR = 'month';
    const CLOCK_TOLERANCE = 10 * 60_000;
    const MAX_DATE = 8_640_000_000_000_000;
    const CRATE_TIERS = ['common', 'rare', 'epic', 'legendary', 'mythic'];
    const TRACK = [
        'common', 'common', 'common', 'common', 'rare', 'common', 'rare', 'common', 'common', 'epic',
        'common', 'common', 'common', 'rare', 'epic', 'common', 'common', 'rare', 'common', 'legendary',
        'common', 'common', 'rare', 'common', 'epic', 'rare', 'common', 'epic', 'mythic', 'exclusive',
    ];
    const exclusiveSkin = { key: 'season-prism', name: 'Season Prism', asset: 'assets/ui/41-season-pass-skin.svg', cell: 64, rarity: 'mythic', exclusive: true };

    const emptySeason = (id = 0) => ({ id, calendar: CALENDAR, points: 0, claimed: {}, bonusClaimed: 0 });
    const validKey = key => typeof key === 'string' && /^[a-z\d_.-]{1,50}$/i.test(key)
        && !['__proto__', 'prototype', 'constructor'].includes(key);
    const validCount = count => Number.isSafeInteger(count) && count > 0 && count <= 1000;
    const timestamp = value => Number.isSafeInteger(value) && value >= Math.min(EPOCH, LEGACY_EPOCH) && value <= MAX_DATE ? value : 0;
    const monthStart = id => new Date(EPOCH_YEAR, id - 1, 1).getTime();
    const legacyId = now => Math.floor((now - LEGACY_EPOCH) / LEGACY_PERIOD) + 1;

    function seasonWindow(now) {
        if (!timestamp(now) || now < EPOCH) return { id: 0, start: EPOCH, end: monthStart(2), day: 0, days: 31, daysLeft: 0 };
        const date = new Date(now);
        const id = (date.getFullYear() - EPOCH_YEAR) * 12 + date.getMonth() + 1;
        const day = date.getDate();
        const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        return { id, start: monthStart(id), end: monthStart(id + 1), day, days, daysLeft: days + 1 - day };
    }

    function cleanReward(reward, leaf = false) {
        if (!reward || typeof reward !== 'object') return null;
        const { type, key, amount, tier } = reward;
        if (type === 'universal_parts' && validCount(amount)) return { type, amount };
        if (type === 'parts' && validKey(key) && validCount(amount)) return { type, key, amount };
        if (type === 'booster' && validKey(key) && validCount(amount)) return { type, key, amount };
        if (type === 'skin' && validKey(key)) return { type, key };
        if (type !== 'crate' || leaf || !CRATE_TIERS.includes(tier)) return null;
        if (!Array.isArray(reward.contents)) return { type, tier };
        const contents = reward.contents.slice(0, 20).map(item => cleanReward(item, true)).filter(Boolean);
        return contents.length ? { type, tier, contents } : null;
    }

    function sanitizeSeason(value) {
        const id = value?.id;
        const isCalendar = value?.calendar === CALENDAR;
        if (!Number.isSafeInteger(id) || id < 1 || id > (isCalendar ? seasonWindow(MAX_DATE).id : legacyId(MAX_DATE))) return emptySeason();
        const points = Number.isSafeInteger(value.points) ? Math.max(0, value.points) : 0;
        const claimed = {};
        for (let number = 1; number <= TRACK.length; number++) {
            const reward = cleanReward(value.claimed?.[number]);
            if (reward) claimed[number] = reward;
        }
        const bonusClaimed = Number.isSafeInteger(value.bonusClaimed) ? Math.min(points, Math.max(0, value.bonusClaimed)) : 0;
        return { id, ...(isCalendar ? { calendar: CALENDAR } : {}), points, claimed, bonusClaimed };
    }

    function migrateSeason(existing, lastSeen, reference) {
        if (!existing.id || existing.calendar === CALENDAR) return existing;
        const month = seasonWindow(reference);
        const oldStart = LEGACY_EPOCH + (existing.id - 1) * LEGACY_PERIOD;
        if (legacyId(reference) === existing.id || (legacyId(lastSeen) === existing.id && seasonWindow(lastSeen).id === month.id)) {
            return { ...existing, id: month.id, calendar: CALENDAR };
        }
        if (oldStart > reference) return { ...existing, id: seasonWindow(oldStart).id, calendar: CALENDAR };
        return emptySeason();
    }

    function seasonState(save, now) {
        const period = seasonWindow(now);
        const lastSeenTime = Math.max(save.lastSeenTime || 0, timestamp(now));
        let seasonBlockedUntil = save.seasonBlockedUntil > now && save.seasonBlockedUntil <= save.lastSeenTime
            ? save.seasonBlockedUntil : 0;
        if (now < lastSeenTime - CLOCK_TOLERANCE) seasonBlockedUntil = Math.max(seasonBlockedUntil, lastSeenTime);
        const existing = migrateSeason(save.season || emptySeason(), save.lastSeenTime, lastSeenTime);
        const aheadOfClock = existing.id > period.id;
        if (aheadOfClock) seasonBlockedUntil = Math.max(seasonBlockedUntil, monthStart(existing.id));
        const blocked = !period.id || seasonBlockedUntil > now;
        const season = period.id && !aheadOfClock && (!blocked || !existing.id) && existing.id !== period.id
            ? emptySeason(period.id) : existing;
        return { period, season, lastSeenTime, seasonBlockedUntil, blocked };
    }

    function storeState(save, { season, lastSeenTime, seasonBlockedUntil }) {
        Object.assign(save, { season, lastSeenTime, seasonBlockedUntil });
    }

    function observe(save, now = Date.now()) {
        const state = seasonState(save, now);
        storeState(save, state);
        return state;
    }

    function creditMissionPoints(save, points, now = Date.now()) {
        const { season } = observe(save, now);
        if (season.id && validCount(points)) season.points = Math.min(Number.MAX_SAFE_INTEGER, season.points + points);
    }

    function prepareConfig(data) {
        const invalid = () => { throw new Error('Invalid season pass configuration'); };
        if (!Array.isArray(data?.stages) || data.stages.length !== TRACK.length) invalid();
        const stages = TRACK.map((tier, index) => {
            const points = data.stages[index]?.points;
            if (!Number.isSafeInteger(points) || points <= (data.stages[index - 1]?.points ?? 0)) invalid();
            return { number: index + 1, tier, points };
        });
        const bonusStart = stages.at(-1).points;
        return { stages, bonusStart, bonusStep: bonusStart - stages.at(-2).points };
    }

    function stageStatus(stage, state) {
        if (Object.hasOwn(state.season.claimed, stage.number)) return 'claimed';
        return !state.blocked && state.season.points >= stage.points ? 'claimable' : 'locked';
    }

    function summarizeTrack(stages, { season }) {
        const current = stages.findLast(stage => stage.points <= season.points);
        const next = stages.find(stage => !Object.hasOwn(season.claimed, stage.number));
        return { current, next };
    }

    function claimableRewards(config, state, rarities, ownsExclusive = false) {
        if (state.blocked) return { ready: false };
        const stages = config.stages.filter(stage => stageStatus(stage, state) === 'claimable');
        const bonus = bonusProgress(config, state).ready > 0;
        const tiers = new Set(stages.map(stage => stage.tier === 'exclusive' && ownsExclusive ? 'legendary' : stage.tier));
        if (bonus) tiers.add('rare');
        return { ready: stages.length > 0 || bonus, crate: rarities.findLast(rarity => tiers.has(rarity)) };
    }

    function bonusProgress({ bonusStart, bonusStep }, { season }) {
        const overflow = Math.max(0, season.points - bonusStart);
        const earned = Math.floor(overflow / bonusStep);
        return { ready: Math.max(0, earned - (season.bonusClaimed || 0)), points: overflow % bonusStep };
    }

    const crateReward = tier => ({ type: 'crate', tier });

    function claimStage(save, config, number, now, grantCrate = crateReward) {
        const state = seasonState(save, now);
        const stage = Number.isInteger(number) ? config.stages[number - 1] : null;
        if (!stage || stageStatus(stage, state) !== 'claimable') return state;
        const reward = stage.tier !== 'exclusive' ? grantCrate(stage.tier)
            : save.ownedSkins?.includes(exclusiveSkin.key) ? grantCrate('legendary') : { type: 'skin', key: exclusiveSkin.key };
        return { ...state, reward, season: { ...state.season, claimed: { ...state.season.claimed, [number]: reward } } };
    }

    function claimBonus(save, config, now, grantCrate = crateReward) {
        const state = seasonState(save, now);
        if (state.blocked || !bonusProgress(config, state).ready) return state;
        const reward = grantCrate('rare');
        return { ...state, reward, season: { ...state.season, bonusClaimed: (state.season.bonusClaimed || 0) + 1 } };
    }

    globalThis.LBSeason = { DAY, EPOCH, CLOCK_TOLERANCE, exclusiveSkin, emptySeason, timestamp, seasonWindow,
        sanitizeSeason, seasonState, storeState, observe, creditMissionPoints, prepareConfig, stageStatus, summarizeTrack, claimableRewards, bonusProgress, claimStage, claimBonus };
})();
