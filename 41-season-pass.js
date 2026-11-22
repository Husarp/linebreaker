(() => {
    const DAY = 86_400_000;
    const DAYS = 30;
    const EPOCH = Date.UTC(2026, 0, 1);
    const CLOCK_TOLERANCE = 10 * 60_000;
    const MAX_DATE = 8_640_000_000_000_000;
    const CRATE_TIERS = ['common', 'rare', 'epic', 'legendary', 'mythic'];
    const TRACK = [
        'common', 'common', 'common', 'common', 'rare', 'common', 'rare', 'common', 'common', 'epic',
        'common', 'common', 'common', 'rare', 'epic', 'common', 'common', 'rare', 'common', 'legendary',
        'common', 'common', 'rare', 'common', 'epic', 'rare', 'common', 'epic', 'mythic', 'exclusive',
    ];
    const exclusiveSkin = { key: 'season-prism', name: 'Season Prism', asset: 'assets/ui/41-season-pass-skin.svg', cell: 64, exclusive: true };

    const emptySeason = (id = 0) => ({ id, points: 0, claimed: {}, bonusClaimed: 0 });
    const validKey = key => typeof key === 'string' && /^[a-z\d_.-]{1,50}$/i.test(key)
        && !['__proto__', 'prototype', 'constructor'].includes(key);
    const validCount = count => Number.isSafeInteger(count) && count > 0 && count <= 1000;
    const timestamp = value => Number.isSafeInteger(value) && value >= EPOCH && value <= MAX_DATE ? value : 0;

    function seasonWindow(now) {
        if (!timestamp(now)) return { id: 0, start: EPOCH, day: 0, daysLeft: DAYS };
        const elapsedDays = Math.floor((now - EPOCH) / DAY);
        const index = Math.floor(elapsedDays / DAYS);
        const day = elapsedDays % DAYS + 1;
        return { id: index + 1, start: EPOCH + index * DAYS * DAY, day, daysLeft: DAYS + 1 - day };
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
        if (!Number.isSafeInteger(id) || id < 1 || id > seasonWindow(MAX_DATE).id) return emptySeason();
        const points = Number.isSafeInteger(value.points) ? Math.max(0, value.points) : 0;
        const claimed = {};
        for (let number = 1; number <= TRACK.length; number++) {
            const reward = cleanReward(value.claimed?.[number]);
            if (reward) claimed[number] = reward;
        }
        const bonusClaimed = Number.isSafeInteger(value.bonusClaimed) ? Math.min(points, Math.max(0, value.bonusClaimed)) : 0;
        return { id, points, claimed, bonusClaimed };
    }

    function seasonState(save, now) {
        const period = seasonWindow(now);
        const lastSeenTime = Math.max(save.lastSeenTime || 0, timestamp(now));
        let seasonBlockedUntil = save.seasonBlockedUntil > now && save.seasonBlockedUntil <= save.lastSeenTime
            ? save.seasonBlockedUntil : 0;
        if (now < lastSeenTime - CLOCK_TOLERANCE) seasonBlockedUntil = Math.max(seasonBlockedUntil, lastSeenTime);
        const existing = save.season || emptySeason();
        const aheadOfClock = existing.id > period.id;
        if (aheadOfClock) seasonBlockedUntil = Math.max(seasonBlockedUntil, EPOCH + (existing.id - 1) * DAYS * DAY);
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

    globalThis.LBSeason = { DAY, DAYS, EPOCH, CLOCK_TOLERANCE, exclusiveSkin, emptySeason, timestamp, seasonWindow,
        sanitizeSeason, seasonState, storeState, observe, creditMissionPoints, prepareConfig, stageStatus, summarizeTrack, bonusProgress, claimStage, claimBonus };
})();
