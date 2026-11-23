/* Untrusted saves cross this boundary before migrations or rendering. */
(function () {
    'use strict';
    const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const notReserved = k => !['__proto__', 'constructor', 'prototype'].includes(k);
    const safeKey = k => /^[\w .:-]{1,100}$/.test(k) && notReserved(k);
    const trackName = v => typeof v === 'string' && /^[^<>\u0000-\u001f]{1,200}$/.test(v) && notReserved(v);
    const number = (v, fallback = 0, max = 1e12) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : fallback;
    const string = v => typeof v === 'string' ? v.replace(/[&<>"'`\\\u0000-\u001f]/g, '').slice(0, 200) : '';
    const colour = (v, fallback = '#ffffff') => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
    const version = 3;
    const retiredDayAchievements = new Set(['daily_streak', 'streak_lost', 'mq_streak_7', 'mq_streak_30']);
    const retainedAchievementTiers = {
        score: [1, 3, 5], games: [1, 3, 5], speed: [1, 3, 5], survival: [1, 3, 5],
        total_blocks: [1, 3, 5], total_lines: [1, 3, 5], speedrunner: [1, 3, 4],
        quad_count: [1, 3, 4], combo_master: [1, 3, 4], booster_user: [1, 3, 4],
        fun_score: [1, 3, 4], daily_xp: [1, 3, 4], mirror_score: [1, 3, 4],
        fun_squared: [1, 3, 4], spinner: [1, 3, 4], mq_total_quests: [1, 2, 4],
    };
    const mergedMissionAchievements = {
        mq_first_easy: ['mq_easy_quests', 1], mq_normal_10: ['mq_normal_quests', 1],
        mq_hard_5: ['mq_hard_quests', 1], mq_total_50: ['mq_total_quests', 2],
        mq_secret_1: ['mq_secret_quests', 1],
    };
    const scoreKeys = ['highscoreHistory', 'pinnedScores', 'funLeaderboard', 'leaderboard'];
    const keyGroups = [
        ['schemaVersion', 'skinCatalogVersion', 'totalXP', '_settings', 'seenFunRules', 'lastDailyGift', 'pendingDailyGift', 'lastSeenTime', 'levelRewardsThrough', 'pendingRankRewards', 'pendingLevelBox', 'pendingLevelBoxes', 'pendingMilestoneBoxes', 'pendingMilestoneReward'],
        ['parts', 'universalParts', 'boosters', 'boxes', 'storedCrates', 'ghostColorUnlocked', 'ownedSkins', 'ownedThemes', 'ownedBtnStyles', 'ownedGridStyles', 'ownedSfxPacks', 'ownedPalettes', 'customPaletteOverrides', 'customPickerColors', 'customThemeColor', '_cpmBaseColor', '_cpmMode', 'menuPlaylist', 'gamePlaylist', 'actionPlaylist'],
        ['missions'], ['season', 'lastSeenTime', 'seasonBlockedUntil'], ['achievements', 'pendingAchievementClaims'], ['stats'], scoreKeys,
    ];
    const saveKeys = keyGroups.flat();
    const day = v => String(v).padStart(2, '0');
    const localDate = value => `${String(value.getFullYear()).padStart(4, '0')}-${day(value.getMonth() + 1)}-${day(value.getDate())}`;
    const localClock = value => `${day(value.getHours())}:${day(value.getMinutes())}`;
    const clock = v => typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : '';
    function date(v) {
        if (typeof v !== 'string') return '';
        const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
        const legacy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,? ((?:[01]\d|2[0-3]):[0-5]\d))?$/.exec(v);
        if (!iso && !legacy) return '';
        const year = iso ? iso[1] : legacy[3];
        const month = day(Number((iso || legacy)[2]));
        const dateOfMonth = day(Number(iso ? iso[3] : legacy[1]));
        const key = `${year}-${month}-${dateOfMonth}`;
        const epoch = Date.parse(key + 'T00:00:00Z');
        return Number.isFinite(epoch) && new Date(epoch).toISOString().startsWith(key) ? key : '';
    }
    function displayDate(value, time = '', comma = false) {
        const [year, month, dateOfMonth] = date(value).split('-');
        return year ? `${dateOfMonth}.${month}.${year}${time ? `${comma ? ',' : ''} ${time}` : ''}` : '';
    }
    function weekKey(v) {
        const match = typeof v === 'string' && /^(\d{4})-W(0?[1-9]|[1-4]\d|5[0-3])$/.exec(v);
        return match ? `${match[1]}-W${day(Number(match[2]))}` : '';
    }
    const list = v => Array.isArray(v) ? v.slice(0, 2000) : [];
    const entries = (v, validKey = safeKey) => object(v) ? Object.entries(v).filter(([k]) => validKey(k)).slice(0, 10000) : [];
    const numericMap = (v, validKey) => Object.fromEntries(entries(v, validKey).map(([k, n]) => [k, number(n)]));
    function dateCounts(value) {
        const counts = {};
        for (const [key, count] of entries(value)) {
            const normalized = date(key);
            if (normalized) counts[normalized] = Math.max(counts[normalized] || 0, number(count));
        }
        return counts;
    }
    function cleanSettings(value) {
        const { bgStyle, bgBlockMotion, heavyBg, actionMusicMode, classicColors, ...settings } = object(value) ? value : {};
        if ('uiTheme' in settings && !['dark', 'light', 'system'].includes(settings.uiTheme)) settings.uiTheme = 'dark';
        if (object(settings.reminders)) settings.reminders = Object.fromEntries(['enabled', 'daily', 'weekly']
            .filter(key => typeof settings.reminders[key] === 'boolean').map(key => [key, settings.reminders[key]]));
        return settings;
    }
    function withoutDayStreakStats(value) {
        const { dailyStreak, highestDailyStreak, ...stats } = value;
        return stats;
    }
    const legacyListens = 'legacy:unattributed';
    function musicCounts(counts) {
        let total = 0, mostPlayed = 0;
        for (const [track, count] of entries(counts, trackName)) {
            total += number(count);
            if (track !== legacyListens) mostPlayed = Math.max(mostPlayed, number(count));
        }
        return { total, mostPlayed };
    }
    function missionProgress(quest, weekly = false) {
        if (!object(quest) || typeof quest.id !== 'string' || !safeKey(quest.id) || quest.id === 'parachute_catcher') return null;
        const progress = {
            id: quest.id,
            target: number(quest.target),
            progress: number(quest.progress),
            completed: quest.completed === true,
            ptsClaimed: typeof quest.ptsClaimed === 'boolean' ? quest.ptsClaimed : quest.completed === true,
        };
        if (weekly && ['normal', 'hard'].includes(quest.tier)) progress.tier = quest.tier;
        if (['normal', 'hard'].includes(quest.displayTier)) progress.displayTier = quest.displayTier;
        return progress;
    }
    function cleanScore(entry) {
        const score = {};
        for (const key of ['score','lines','blocks','time','maxSpeed','xp','maxCombo','cols','rows','startSpeed']) {
            if (Object.hasOwn(entry, key)) score[key] = number(entry[key]);
        }
        score.date = date(entry.date);
        score.note = string(entry.note);
        const savedClock = clock(entry.clock) || (score.date ? clock(entry.date.slice(-5)) : '');
        if (savedClock) score.clock = savedClock;
        return score;
    }
    const discardedAchievementIds = new Set(['parachute_catcher', 'art_collector']);
    function cleanAchievements(value) {
        return Object.fromEntries(entries(value).filter(([key]) => !discardedAchievementIds.has(key) && !retiredDayAchievements.has(key)
            && (key !== '\u0074etris_lines' || !Object.hasOwn(value, 'i_piece_lines'))).map(([key, entry]) => {
            const achievement = { unlocked: entry?.unlocked === true, unlockedAt: date(entry?.unlockedAt) };
            if (typeof entry?.tier === 'number') achievement.tier = Math.floor(number(entry.tier, 0, 100));
            if (object(entry?.tierDates)) achievement.tierDates = Object.fromEntries(entries(entry.tierDates).filter(([tier]) => /^[1-9]\d?$/.test(tier)).map(([tier, when]) => [tier, date(when)]).filter(([, when]) => when));
            return [achievementId(key), achievement];
        }));
    }
    const achievementId = key => key === '\u0074etris_lines' ? 'i_piece_lines' : key;
    function migrateAchievementTiers(save) {
        const achievements = save.achievements;
        const markReached = (id, tier, when) => {
            const entry = achievements[id] ||= {};
            entry.tier = Math.max(entry.tier || 0, tier);
            if (!when) return;
            const dates = entry.tierDates ||= {};
            if (!dates[tier] || when < dates[tier]) dates[tier] = when;
        };
        for (const [id, retained] of Object.entries(retainedAchievementTiers)) {
            const entry = achievements[id];
            if (!entry) continue;
            const oldTier = entry.tier || 0;
            const oldDates = entry.tierDates || {};
            entry.tier = 0;
            entry.tierDates = {};
            retained.forEach((tier, index) => {
                if (oldTier >= tier) markReached(id, index + 1, oldDates[tier]);
            });
        }
        for (const [oldId, [id, tier]] of Object.entries(mergedMissionAchievements)) {
            if (achievements[oldId]?.unlocked) markReached(id, tier, achievements[oldId].unlockedAt);
            delete achievements[oldId];
        }
        for (const claim of save.pendingAchievementClaims) {
            if (Object.hasOwn(mergedMissionAchievements, claim.id)) {
                markReached(...mergedMissionAchievements[claim.id]);
            } else if (claim.tierNum && Object.hasOwn(retainedAchievementTiers, claim.id)) {
                const retained = retainedAchievementTiers[claim.id];
                const reached = retained.filter(tier => tier <= claim.tierNum).length;
                if (reached) markReached(claim.id, reached);
                if (retained.includes(claim.tierNum)) claim.tierNum = reached;
                else delete claim.tierNum;
            }
        }
    }
    const trackTitle = name => {
        if (name === 'Original \u0054etris Theme') return 'Classic Block Theme';
        if (name === '\u0054etris (Hardcore Remix)') return 'Block Theme (Hardcore Remix)';
        return name;
    };
    function sorted(value) {
        if (Array.isArray(value)) return value.map(sorted);
        if (!object(value)) return value;
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
    }
    function serializeSave(data, weeklyDefinitions = []) {
        const out = { ...data, schemaVersion: version };
        if (object(data.stats)) out.stats = withoutDayStreakStats(data.stats);
        delete out.seenArt;
        if (object(data._settings)) out._settings = cleanSettings(data._settings);
        if (object(data.achievements)) out.achievements = cleanAchievements(data.achievements);
        if (Array.isArray(data.pendingAchievementClaims)) {
            out.pendingAchievementClaims = data.pendingAchievementClaims.filter(claim => !discardedAchievementIds.has(claim?.id));
        }
        for (const key of scoreKeys) if (Array.isArray(data[key])) out[key] = data[key].filter(object).map(cleanScore);
        if (object(data.missions)) {
            const { daily, weekly, streaks, ...missionState } = data.missions;
            const { daysPlayedThisWeek, ...weeklyState } = weekly;
            const tiers = new Map(weeklyDefinitions.map(def => [def.id, def.tier]));
            const weeklyProgress = quest => {
                const progress = missionProgress(quest, true);
                if (progress && progress.tier === tiers.get(progress.id)) delete progress.tier;
                return progress;
            };
            out.missions = {
                ...missionState,
                daily: { ...daily, quests: daily.quests.map(quest => missionProgress(quest)).filter(Boolean), secret: missionProgress(daily.secret) },
                weekly: { ...weeklyState, missions: weekly.missions.map(weeklyProgress).filter(Boolean) },
            };
        }
        return Object.fromEntries(saveKeys.filter(key => Object.hasOwn(out, key)).map(key => [key, sorted(out[key])]));
    }
    function migrateLegacy(data) {
        const stats = object(data.stats) ? { ...data.stats } : {};
        const songPlayCounts = numericMap(stats.songPlayCounts, trackName);
        const untracked = number(stats.musicTracksListened) - musicCounts(songPlayCounts).total;
        if (untracked > 0) songPlayCounts[legacyListens] = untracked;
        stats.songPlayCounts = songPlayCounts;
        stats.playHistory = dateCounts(stats.playHistory);
        for (const value of list(stats.playDates)) {
            const key = date(value);
            if (key) stats.playHistory[key] = (stats.playHistory[key] || 0) + 1;
        }
        const leaderboard = list(data.leaderboard).filter(object).slice();
        const bestListed = leaderboard.reduce((best, entry) => Math.max(best, number(entry.score)), 0);
        const record = Math.max(number(data.highscore), number(data.highscoreData?.score));
        const legacyBest = record || (!bestListed ? Math.round(number(stats.bestNormalScore)) : 0);
        const recordDetails = object(data.highscoreData) && (!number(data.highscoreData.score) || number(data.highscoreData.score) === legacyBest) ? data.highscoreData : {};
        if (legacyBest > bestListed) leaderboard.unshift({ ...recordDetails, score: legacyBest });
        else if (record && record === bestListed) {
            const index = leaderboard.findIndex(entry => number(entry.score) === record);
            leaderboard[index] = { ...recordDetails, ...leaderboard[index] };
        }
        return { ...data, stats, leaderboard };
    }
    function structured(value, schema) {
        value = object(value) ? value : {};
        return Object.fromEntries(Object.entries(schema).map(([k, fallback]) => {
            const v = value[k];
            if (typeof fallback === 'number') return [k, number(v, fallback)];
            if (typeof fallback === 'boolean') return [k, typeof v === 'boolean' ? v : fallback];
            if (typeof fallback === 'string') return [k, k === 'weekKey' ? weekKey(v) : /date/i.test(k) ? date(v) : string(v)];
            if (Array.isArray(fallback)) return [k, list(v).filter(n => typeof n === 'number').map(n => number(n))];
            return [k, Object.keys(fallback || {}).length ? structured(v, fallback) : numericMap(v)];
        }));
    }
    function sanitizeSave(data, defaults, definitions = {}) {
        data = object(data) ? data : {};
        const sourceVersion = number(data.schemaVersion);
        const legacy = sourceVersion < 1;
        if (legacy) data = migrateLegacy(data);
        const out = JSON.parse(JSON.stringify(defaults));
        out.schemaVersion = version;
        const skins = definitions.skins || Object.fromEntries([
            ...['Retro','Glass','Shadow','Outline','Holo','Journey','Bubble'].map(name => [name.toLowerCase(), name]),
            ...(window.LBImageSkins || []).map(({key, name}) => [key, name]),
        ]);
        const allowed = new Set(saveKeys);
        for (const key of Object.keys(out)) if (!allowed.has(key)) delete out[key];
        for (const [key, value] of entries(data)) {
            if (!allowed.has(key) || key === 'schemaVersion') continue;
            if (key === 'lastSeenTime') out[key] = Number.isSafeInteger(value) && value >= 0 && value <= 253_402_300_799_999 ? value : 0;
            else if (typeof defaults[key] === 'number' || key === 'levelRewardsThrough' || key === 'skinCatalogVersion') out[key] = number(value, defaults[key] || 0);
            else if (typeof defaults[key] === 'boolean') out[key] = value === true;
            else if (key.endsWith('Playlist')) out[key] = Array.isArray(value) ? [...new Set(list(value).filter(trackName).map(trackTitle))] : (defaults[key] || []);
            else if (key === 'ownedSkins') out[key] = Array.isArray(value) ? list(value) : (defaults[key] || []);
            else if (key.startsWith('owned')) out[key] = Array.isArray(value) ? list(value).filter(x => typeof x === 'string').map(string).filter(Boolean) : (defaults[key] || []);
            else if (['parts','boosters','boxes'].includes(key)) out[key] = numericMap(value);
            else if (key === 'lastDailyGift') out[key] = date(value) || null;
            else if (/Color$/.test(key)) out[key] = colour(value, '#00ffff');
            else if (['_cpmMode'].includes(key)) out[key] = string(value);
        }
        const balances = object(data.universalParts) ? data.universalParts : { common: data.universalParts };
        out.universalParts = Object.fromEntries(window.LBCrates.rarities.map(rarity => [rarity, number(balances[rarity])]).filter(([, count]) => count > 0));
        out.ownedSkins = [...new Set(list(out.ownedSkins).filter(key => typeof key === 'string' && Object.hasOwn(skins, key)))];
        out.pendingDailyGift = window.LBCrates.restoreGift(data.pendingDailyGift, out.lastDailyGift, date);
        const { from, through } = object(data.pendingRankRewards) ? data.pendingRankRewards : {};
        out.pendingRankRewards = Number.isSafeInteger(from) && Number.isSafeInteger(through) && from >= 2 && from <= through
            && through <= out.levelRewardsThrough && through <= 100000 ? { from, through } : null;
        for (const k of scoreKeys) out[k] = list(data[k]).filter(object).map(cleanScore);
        out.leaderboard.sort((first, second) => (second.score || 0) - (first.score || 0));
        out.stats = withoutDayStreakStats(defaults.stats || {});
        for (const k of ['_lastSkin', 'bestBlocksIn60s', 'bestDailyXP', 'bestEarnedXP', 'bestFunScore', 'bestHighPlacer', 'bestIPieceLines', 'bestLineStreak', 'bestLoyalPiece', 'bestMaxSpeed', 'bestMirrorScore', 'bestSpeedrunnerTime', 'bestSurvivalTime', 'blockTypeUsage', 'dailyXPAmount', 'dailyXPDate', 'funGamesPlayed', 'gamesAborted', 'gamesPlayed', 'highStackBlocks', 'lastPlayDate', 'luckySevenCount', 'maxCombo', 'menuIdleTime', 'muteCount', 'nearMissCount', 'noLineStreak', 'noSpinBlocks', 'pinnedCount', 'playHistory', 'rareItemsFromDailyBox', 'rulesOpened', 'sameSkinStreak', 'seenTitleAnims', 'singleLineClears', 'songPlayCounts', 'surgeonLines', 'tSpinTriples', 'totalBlocksPlaced', 'totalBoostersUsed', 'totalLinesCleared', 'totalQuads', 'totalRotations', 'totalScore', 'totalTimePlayed']) if (Object.hasOwn(data.stats || {}, k)) out.stats[k] = data.stats[k];
        for (const [k, v] of Object.entries(out.stats)) {
            if (['lastPlayDate','dailyXPDate'].includes(k)) out.stats[k] = date(v);
            else if (k === '_lastSkin') out.stats[k] = string(v);
            else if (k === 'seenTitleAnims') out.stats[k] = list(v).filter(n => Number.isInteger(n) && n >= 0 && n < 6);
            else if (k === 'playHistory') out.stats[k] = dateCounts(v);
            else if (k === 'songPlayCounts') {
                out.stats[k] = {};
                for (const [name, count] of Object.entries(numericMap(v, trackName))) {
                    const title = trackTitle(name);
                    out.stats[k][title] = (out.stats[k][title] || 0) + count;
                }
            }
            else if (k === 'blockTypeUsage') out.stats[k] = numericMap(v);
            else out.stats[k] = number(v);
        }
        out.achievements = cleanAchievements(data.achievements);
        out.pendingAchievementClaims = list(data.pendingAchievementClaims).filter(claim => object(claim) && typeof claim.id === 'string' && safeKey(claim.id) && !discardedAchievementIds.has(claim.id)).map(claim => ({
            id: achievementId(claim.id), name: retiredDayAchievements.has(claim.id) ? 'Legacy achievement' : string(claim.name), rarity: ['common', 'rare', 'epic', 'legendary', 'mythic'].includes(claim.rarity) ? claim.rarity : 'common',
            ...(claim.tierNum ? { tierNum: Math.floor(number(claim.tierNum, 0, 100)) } : {}),
            ...(sourceVersion >= 2 && [2, 3].includes(claim.tierNum) && ['common', 'rare', 'epic', 'legendary'].includes(claim.crateRarity)
                ? { crateRarity: claim.crateRarity } : { xp: number(claim.xp, 0, 100000) }),
        }));
        if (sourceVersion < 2) migrateAchievementTiers(out);
        const pendingTiers = new Set();
        out.pendingAchievementClaims = out.pendingAchievementClaims.filter(({ id, tierNum }) => {
            if (!tierNum) return true;
            const key = `${id}:${tierNum}`;
            if (pendingTiers.has(key)) return false;
            pendingTiers.add(key);
            return true;
        });
        out.season = (window.LBSeason || globalThis.LBSeason).sanitizeSeason(data.season);
        out.lastSeenTime = (window.LBSeason || globalThis.LBSeason).timestamp(data.lastSeenTime);
        out.seasonBlockedUntil = (window.LBSeason || globalThis.LBSeason).timestamp(data.seasonBlockedUntil);
        out.missions = null;
        if (object(data.missions)) {
            const missionDefaults = definitions.missionDefaults || {
                daily:{quests:[],secret:null,lastRefreshDate:'',swapDate:'',pointsToday:0,claimedMilestones:[],completedToday:false,newVisit:false,rawXPToday:0},
                weekly:{missions:[],weekKey:'',swapDate:'',points:0,claimedMilestones:[],anyCompleted:false,dailyPtsLog:{},newVisit:false,pendingUniversalParts:0,universalPtsTracked:0,hitAnyMilestone:false,dailyAllCompleteCount:0,dailyAllCompleteDate:''},
                stats:{totalCompleted:0,byTier:{easy:0,normal:0,hard:0,secret:0},weeklyCompleted:0,totalPts:0,completionHistory:{}},specialBox:{pts:0}
            };
            out.missions = structured(data.missions, missionDefaults);
            for (const section of ['daily', 'weekly']) {
                const previous = data.missions[section];
                if (!Object.hasOwn(previous || {}, 'swapDate') && previous?.changeUsed === true) {
                    out.missions[section].swapDate = out.missions.daily.lastRefreshDate;
                }
            }
            for (const [section, key] of [['daily','ptsTrackedForWeekly'],['specialBox','excessTracked']]) out.missions[section][key] = number(data.missions[section]?.[key]);
            for (const [section, key] of [['daily','quests'], ['weekly','missions']]) {
                out.missions[section][key] = list(data.missions[section]?.[key]).map(quest => missionProgress(quest, section === 'weekly')).filter(Boolean);
            }
            out.missions.daily.secret = missionProgress(data.missions.daily?.secret);
            out.missions.weekly.dailyPtsLog = dateCounts(data.missions.weekly?.dailyPtsLog);
            out.missions.stats.completionHistory = dateCounts(data.missions.stats?.completionHistory);
            if (legacy && list(data.missions.daily?.quests).some(quest => [10, 20, 40, 60].includes(quest?.pts))) {
                out.missions.daily.pointsToday = 0;
                out.missions.daily.claimedMilestones = [];
            }
            out.missions.weekly.isoWeekKey = data.missions.weekly?.isoWeekKey === true;
        }
        if (object(data._settings)) {
            out._settings = cleanSettings(defaults._settings);
            for (const [k,v] of Object.entries(out._settings)) {
                const input = data._settings[k];
                if (k === 'colorHistory') out._settings[k] = LBColorPicker.colorHistory(input);
                else if (k === 'colorPalette') {
                    const valid = typeof input === 'string' && (['_custom_picker', '_random'].includes(input) || Object.hasOwn(definitions.palettes || {}, input));
                    out._settings[k] = valid ? input : v;
                }
                else if (k === 'ghostColor') out._settings[k] = ['white', 'colored'].includes(input) ? input : v;
                else if (k === 'skin') out._settings[k] = typeof input === 'string' && Object.hasOwn(skins, input) ? input : 'retro';
                else if (k === 'blockShape') out._settings[k] = 'square';
                else out._settings[k] = typeof v === 'number' ? number(input, v, 10000) : typeof v === 'boolean' ? (typeof input === 'boolean' ? input : v) : typeof input === 'string' ? (/color/i.test(k) ? colour(input, v) : string(input)) : v;
            }
            if (typeof data._settings._lastPalette === 'string' && Object.hasOwn(definitions.palettes || {}, data._settings._lastPalette)) out._settings._lastPalette = data._settings._lastPalette;
            if (object(data._settings.keyBindings) && window.LBControls) out._settings.keyBindings = window.LBControls.normalizeBindings(data._settings.keyBindings);
            if (object(data._settings.reminders)) out._settings.reminders = cleanSettings(data._settings).reminders;
        }
        const palettes = definitions.palettes || {};
        const classic = palettes.classic?.colors || ['#00ffff','#3388ff','#ff9900','#ffff33','#33ff33','#cc33ff','#ff3366'];
        const colours = (v, fallback) => fallback.slice(0, 7).map((c,i) => colour(Array.isArray(v) ? v[i] : null, c));
        if ('customPickerColors' in data) out.customPickerColors = colours(data.customPickerColors, classic);
        out.customPaletteOverrides = Object.fromEntries(entries(data.customPaletteOverrides).filter(([k]) => Object.hasOwn(palettes, k)).map(([k,v]) => [k, colours(v, palettes[k].colors)]));
        const items = new Set([
            ...(definitions.items || []).map(item => item.key),
            ...Object.keys(skins),
            ...('ocean forest fire dragon void sunset arctic midnight sakura ghostColor dots boxes dotboxes sfxCyber sfxRetro sfxZen sfxArcade').split(' '),
            ...Object.keys(palettes),
        ]);
        const partLabel = definitions.partLabel || (key => key === 'ghostColor' ? 'Colored Ghost' : Object.hasOwn(skins, key) ? skins[key] : key.charAt(0).toUpperCase() + key.slice(1));
        const partCost = definitions.partCost || (() => 10);
        out.parts = Object.fromEntries(Object.entries(out.parts || {}).filter(([key]) => items.has(key) && partCost(key) > 0)
            .map(([key, count]) => [key, Math.min(partCost(key), Math.floor(count))]));
        function reward(r) {
            if (!object(r)) return null;
            let type = r.type, key = r.key;
            // Older boxes stored only display text; accept exact game-generated forms.
            if (!type && r.label === '+1 Universal Part') type = 'universal_parts';
            if (!type && typeof r.label === 'string' && r.label.startsWith('+1 Part: ')) {
                key = [...items].find(k => r.label === '+1 Part: ' + partLabel(k));
                if (key) type = 'parts';
            }
            const amount = number(r.amount, 1, 1000);
            const rarity = sourceVersion >= 3 && window.LBCrates.rarities.includes(r.rarity) ? r.rarity : 'common';
            if (type === 'converted_parts' && items.has(key) && Number.isInteger(r.amount) && amount > 0) return { type, key, amount, rarity };
            if (type === 'universal_parts') return { type, amount, rarity, label: window.LBCrates.universalPartName(rarity) };
            if (type === 'parts' && items.has(key)) return { type, key, amount, rarity: definitions.partRarity?.(key) || rarity, label:`${partLabel(key)} Part`, desc:`${number(out.parts[key])}/${partCost(key)} parts` };
            if (type === 'booster' && Object.hasOwn(definitions.boosters || {}, key)) {
                const b = definitions.boosters[key];
                return { type, key, amount, rarity:b.rarity, icon:b.icon, label:b.label, desc:'Booster added to inventory' };
            }
            if (type === 'skin' && ['shadow','holo'].includes(key)) return { type, key, rarity:'rare', icon:'🎨', label:key === 'shadow' ? 'Shadow Skin' : 'Holo Skin', desc:'Milestone reward' };
            if (type === 'ghostColor' && key === 'ghostColor') return { type, key, rarity:'epic', icon:'👻', label:'Colored Ghost', desc:'Milestone reward' };
            return null;
        }
        function box(v) {
            if (!object(v)) return null;
            const level = Math.floor(number(v.level, 1, 100000));
            const rank = definitions.ranks?.[Math.min(8, Math.floor((Math.max(1, level) - 1) / 10))];
            return { level, rankName:rank?.name || 'BRONZE', rankColor:colour(rank?.c, '#e8922a'), rewards:list(v.rewards).slice(0, 50).map(reward).filter(Boolean) };
        }
        out.pendingLevelBox = box(data.pendingLevelBox);
        out.pendingMilestoneReward = box(data.pendingMilestoneReward);
        out.pendingLevelBoxes = list(data.pendingLevelBoxes).map(box).filter(Boolean);
        out.pendingMilestoneBoxes = list(data.pendingMilestoneBoxes).filter(n => typeof n === 'number' && Number.isFinite(n) && n > 0).map(n => Math.floor(number(n, 0, 100000)));
        out.storedCrates = list(data.storedCrates).flatMap(crate => {
            if (!['common', 'rare', 'epic', 'legendary', 'mythic'].includes(crate?.rarity)) return [];
            const { rarity, source } = crate;
            if (source === 'legacy') return [{ rarity, source, rewards: list(crate.rewards).slice(0, 50).map(reward).filter(Boolean) }];
            if (source === 'mission') return [{ rarity, source, amount: Math.floor(number(crate.amount, 0, 1000)) }];
            return [{ rarity, ...(['daily', 'level', 'rank', 'achievement'].includes(source) ? { source } : {}) }];
        });
        return out;
    }
    window.sanitizeSave = sanitizeSave;
    window.LBSave = { version, serializeSave, cleanSettings, localDate, localClock, date, displayDate, musicCounts, retainedAchievementTiers };
})();
