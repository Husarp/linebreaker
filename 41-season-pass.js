(() => {
    const DAY = 86_400_000;
    const DAYS = 30;
    const EPOCH = Date.UTC(2026, 0, 1);
    const CLOCK_TOLERANCE = 10 * 60_000;
    const MAX_DATE = 8_640_000_000_000_000;
    const TIERS = ['common', 'rare', 'epic', 'legendary', 'exclusive'];
    const exclusiveSkin = { key: 'season-prism', name: 'Season Prism', asset: 'assets/ui/41-season-pass-skin.svg', cell: 64, exclusive: true };

    const emptySeason = (id = 0) => ({ id, points: 0, claimed: {} });
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

    function cleanReward(reward, { receipt = false, leaf = false } = {}) {
        if (!reward || typeof reward !== 'object') return null;
        const { type, key, amount, tier } = reward;
        if (type === 'universal_parts' && validCount(amount)) return { type, amount };
        if (type === 'parts' && validCount(amount)) {
            if (!receipt) return { type, amount };
            if (validKey(key)) return { type, key, amount };
        }
        if (type === 'booster' && validKey(key) && validCount(amount)) return { type, key, amount };
        if (type === 'skin' && validKey(key)) return { type, key };
        if (type !== 'crate' || leaf || !TIERS.slice(0, -1).includes(tier)) return null;
        if (!receipt) return { type, tier };
        const contents = Array.isArray(reward.contents) ? reward.contents.slice(0, 20)
            .map(item => cleanReward(item, { receipt: true, leaf: true })).filter(Boolean) : [];
        return contents.length ? { type, tier, contents } : null;
    }

    function sanitizeSeason(value) {
        const id = value?.id;
        if (!Number.isSafeInteger(id) || id < 1 || id > seasonWindow(MAX_DATE).id) return emptySeason();
        const points = Number.isSafeInteger(value.points) ? Math.max(0, value.points) : 0;
        const claimed = {};
        for (let day = 1; day <= DAYS; day++) {
            const reward = cleanReward(value.claimed?.[day], { receipt: true });
            if (reward) claimed[day] = reward;
        }
        return { id, points, claimed };
    }

    function seasonState(save, now) {
        const period = seasonWindow(now);
        const lastSeenTime = Math.max(save.lastSeenTime || 0, timestamp(now));
        let seasonBlockedUntil = save.seasonBlockedUntil > now ? save.seasonBlockedUntil : 0;
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
        if (!Array.isArray(data?.stages) || data.stages.length !== DAYS) invalid();
        const stages = data.stages.map(({ tier, points }, index) => {
            if (!TIERS.includes(tier) || (tier === 'exclusive') !== (index === DAYS - 1)
                || !Number.isSafeInteger(points) || points <= (data.stages[index - 1]?.points ?? 0)) invalid();
            return { day: index + 1, tier, points };
        });
        const readRewards = (rewards, leaf = false) => {
            if (!Array.isArray(rewards) || !rewards.length || (leaf && rewards.length > 20)) invalid();
            return rewards.map(reward => cleanReward(reward, { leaf }) || invalid());
        };
        const crates = Object.fromEntries(TIERS.slice(0, -1).filter(tier => data.crates?.[tier])
            .map(tier => [tier, readRewards(data.crates[tier], true)]));
        const pools = Object.fromEntries(TIERS.map(tier => [tier, readRewards(data.pools?.[tier])]));
        const exclusiveFallback = cleanReward(data.exclusiveFallback) || invalid();
        if ([...Object.values(pools).flat(), exclusiveFallback]
            .some(reward => reward.type === 'crate' && !Object.hasOwn(crates, reward.tier))) invalid();
        return { stages, pools, crates, exclusiveFallback };
    }

    function stageStatus(stage, state) {
        if (Object.hasOwn(state.season.claimed, stage.day)) return 'claimed';
        if (stage.day > state.period.day) return 'future';
        return !state.blocked && state.season.points >= stage.points ? 'claimable' : 'locked';
    }

    function rollReward(config, tier, inventory, random = Math.random) {
        const parts = new Map(inventory.parts.map(({ key, remaining }) => [key, remaining]));
        const pick = options => options[Math.floor(random() * options.length)];
        const available = reward => {
            if (reward.type === 'parts') return [...parts.values()].some(remaining => remaining >= reward.amount);
            if (reward.type === 'booster') return inventory.boosters.includes(reward.key);
            if (reward.type === 'skin') return inventory.skins.includes(reward.key) && !inventory.ownedSkins.includes(reward.key);
            return true;
        };
        function resolve(reward) {
            if (!available(reward)) return { type: 'universal_parts', amount: Math.max(1, Math.ceil((reward.amount || 1) / 5)) };
            if (reward.type === 'parts') {
                const [key, remaining] = pick([...parts].filter(([, remaining]) => remaining >= reward.amount));
                parts.set(key, remaining - reward.amount);
                return { ...reward, key };
            }
            if (reward.type === 'crate') return { ...reward, contents: config.crates[reward.tier].map(resolve) };
            return { ...reward };
        }
        const pool = config.pools[tier];
        const eligible = pool.filter(available);
        if (!eligible.length && tier === 'exclusive') return resolve(config.exclusiveFallback);
        return resolve(pick(eligible.length ? eligible : pool));
    }

    function claimStage(save, config, day, now, inventory, random) {
        const state = seasonState(save, now);
        const stage = Number.isInteger(day) ? config.stages[day - 1] : null;
        if (!stage || state.blocked) return state;
        if (day > state.period.day) {
            return { ...state, blocked: true, seasonBlockedUntil: state.period.start + (day - 1) * DAY };
        }
        if (stageStatus(stage, state) !== 'claimable') return state;
        const reward = rollReward(config, stage.tier, inventory, random);
        return { ...state, reward, season: { ...state.season, claimed: { ...state.season.claimed, [day]: reward } } };
    }

    globalThis.LBSeason = { DAY, DAYS, EPOCH, CLOCK_TOLERANCE, exclusiveSkin, emptySeason, timestamp, seasonWindow,
        sanitizeSeason, seasonState, storeState, observe, creditMissionPoints, prepareConfig, stageStatus, rollReward, claimStage };
})();
