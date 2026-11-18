/* Untrusted saves cross this boundary before migrations or rendering. */
(function () {
    'use strict';
    const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
    const safeKey = k => /^[\w .:-]{1,100}$/.test(k) && !['__proto__', 'constructor', 'prototype'].includes(k);
    const number = (v, fallback = 0, max = 1e12) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : fallback;
    const string = v => typeof v === 'string' ? v.replace(/[&<>"'`\\\u0000-\u001f]/g, '').slice(0, 200) : '';
    const colour = (v, fallback = '#ffffff') => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
    const date = v => typeof v === 'string' && /^(?:\d{4}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])|(?:0[1-9]|[12]\d|3[01])\.(?:0[1-9]|1[0-2])\.\d{4}(?:,? (?:[01]\d|2[0-3]):[0-5]\d)?|\d{4}-W(?:0?[1-9]|[1-4]\d|5[0-3]))$/.test(v) ? v : '';
    const list = v => Array.isArray(v) ? v.slice(0, 2000) : [];
    const entries = v => object(v) ? Object.entries(v).filter(([k]) => safeKey(k)).slice(0, 10000) : [];
    const numericMap = v => Object.fromEntries(entries(v).map(([k, n]) => [k, number(n)]));
    function structured(value, schema) {
        value = object(value) ? value : {};
        return Object.fromEntries(Object.entries(schema).map(([k, fallback]) => {
            const v = value[k];
            if (typeof fallback === 'number') return [k, number(v, fallback)];
            if (typeof fallback === 'boolean') return [k, typeof v === 'boolean' ? v : fallback];
            if (typeof fallback === 'string') return [k, /date|unlockedAt|weekKey/i.test(k) ? date(v) : string(v)];
            if (Array.isArray(fallback)) return [k, list(v).filter(n => typeof n === 'number').map(n => number(n))];
            return [k, Object.keys(fallback || {}).length ? structured(v, fallback) : numericMap(v)];
        }));
    }
    window.sanitizeSave = function sanitizeSave(data, defaults, definitions = {}) {
        data = object(data) ? data : {};
        const out = JSON.parse(JSON.stringify(defaults));
        const allowed = new Set([...Object.keys(defaults), ...('actionPlaylist boxes _cpmBaseColor _cpmMode customPaletteOverrides customPickerColors customThemeColor dailyGiftStreak funLeaderboard gamePlaylist highscoreData highscoreHistory levelRewardsThrough menuPlaylist ownedGridStyles pendingLevelBoxes pendingMilestoneBoxes pendingMilestoneReward xpEarnedSinceLastGift').split(' ')]);
        for (const [key, value] of entries(data)) {
            if (!allowed.has(key)) continue;
            if (typeof defaults[key] === 'number' || ['dailyGiftStreak','levelRewardsThrough','xpEarnedSinceLastGift','dailyGiftUnlockReq'].includes(key)) out[key] = number(value, defaults[key] || 0);
            else if (typeof defaults[key] === 'boolean') out[key] = value === true;
            else if (/^owned|Playlist$|^pendingAchievementClaims$/.test(key)) out[key] = Array.isArray(value) ? list(value).filter(x => typeof x === 'string').map(string).filter(Boolean) : (defaults[key] || []);
            else if (['parts','boosters','boxes'].includes(key)) out[key] = numericMap(value);
            else if (key === 'lastDailyGift') out[key] = date(value) || null;
            else if (/Color$/.test(key)) out[key] = colour(value, '#00ffff');
            else if (['_cpmMode'].includes(key)) out[key] = string(value);
        }
        const score = v => {
            const r = {};
            for (const k of ['score','lines','blocks','time','maxSpeed','xp','maxCombo','cols','rows','startSpeed']) if (object(v) && k in v) r[k] = number(v[k]);
            r.date = date(v?.date); r.note = string(v?.note);
            return r;
        };
        for (const k of ['leaderboard','funLeaderboard','pinnedScores','highscoreHistory']) out[k] = list(data[k]).filter(object).map(score);
        if (object(data.highscoreData)) out.highscoreData = score(data.highscoreData);
        out.stats = { ...defaults.stats };
        for (const k of ['_lastSkin', 'bestBlocksIn60s', 'bestDailyXP', 'bestEarnedXP', 'bestFunScore', 'bestHighPlacer', 'bestIPieceLines', 'bestLineStreak', 'bestLoyalPiece', 'bestMaxSpeed', 'bestMirrorScore', 'bestNormalScore', 'bestSpeedrunnerTime', 'bestSurvivalTime', 'blockTypeUsage', 'dailyStreak', 'dailyXPAmount', 'dailyXPDate', 'funGamesPlayed', 'gamesAborted', 'gamesPlayed', 'highStackBlocks', 'highestDailyStreak', 'lastPlayDate', 'luckySevenCount', 'maxCombo', 'menuIdleTime', 'mostPlayedSongCount', 'musicTracksListened', 'muteCount', 'nearMissCount', 'noLineStreak', 'noSpinBlocks', 'parachuteDropsCaught', 'pinnedCount', 'playDates', 'playHistory', 'rareItemsFromDailyBox', 'rulesOpened', 'sameSkinStreak', 'seenTitleAnims', 'singleLineClears', 'songPlayCounts', 'surgeonLines', 'tSpinTriples', 'totalBlocksPlaced', 'totalBoostersUsed', 'totalLinesCleared', 'totalQuads', 'totalRotations', 'totalScore', 'totalTimePlayed']) if (Object.hasOwn(data.stats || {}, k)) out.stats[k] = data.stats[k];
        for (const [k, v] of Object.entries(out.stats)) {
            if (['lastPlayDate','dailyXPDate'].includes(k)) out.stats[k] = date(v);
            else if (k === '_lastSkin') out.stats[k] = string(v);
            else if (k === 'seenTitleAnims') out.stats[k] = list(v).filter(n => Number.isInteger(n) && n >= 0 && n < 6);
            else if (k === 'playDates') out.stats[k] = list(v).map(date).filter(Boolean);
            else if (['playHistory','blockTypeUsage','songPlayCounts'].includes(k)) out.stats[k] = numericMap(v);
            else out.stats[k] = number(v);
        }
        out.achievements = Object.fromEntries(entries(data.achievements).map(([k,v]) => [k, { unlocked: v?.unlocked === true, unlockedAt: date(v?.unlockedAt) }]));
        out.missions = null;
        if (object(data.missions)) {
            const missionDefaults = definitions.missionDefaults || {
                daily:{quests:[],secret:null,lastRefreshDate:'',changeUsed:false,pointsToday:0,claimedMilestones:[],completedToday:false,newVisit:false,rawXPToday:0},
                weekly:{missions:[],weekKey:'',changeUsed:false,points:0,claimedMilestones:[],anyCompleted:false,daysPlayedThisWeek:{},dailyPtsLog:{},newVisit:false,pendingUniversalParts:0,universalPtsTracked:0,hitAnyMilestone:false,dailyAllCompleteCount:0,dailyAllCompleteDate:''},
                streaks:{daily:0},stats:{totalCompleted:0,byTier:{easy:0,normal:0,hard:0,secret:0},weeklyCompleted:0,totalPts:0,completionHistory:{}},specialBox:{pts:0}
            };
            out.missions = structured(data.missions, missionDefaults);
            for (const [section, key] of [['daily','ptsTrackedForWeekly'],['specialBox','excessTracked'],['streaks','bestDaily']]) out.missions[section][key] = number(data.missions[section]?.[key]);
            const questSchema = { id:'', tier:'', title:'', desc:'', metric:'', target:0, pts:0, progress:0, completed:false, ptsClaimed:false, displayTier:'' };
            for (const [section, key] of [['daily','quests'], ['weekly','missions']]) {
                out.missions[section][key] = list(data.missions[section]?.[key]).filter(object).map(q => structured(q, questSchema));
            }
            out.missions.daily.secret = object(data.missions.daily?.secret) ? structured(data.missions.daily.secret, questSchema) : null;
            out.missions.weekly.daysPlayedThisWeek = Object.fromEntries(entries(data.missions.weekly?.daysPlayedThisWeek).filter(([k]) => date(k)).map(([k,v]) => [k, v === true]));
            out.missions.weekly.isoWeekKey = data.missions.weekly?.isoWeekKey === true;
        }
        if (object(data._settings)) {
            out._settings = { ...defaults._settings };
            for (const [k,v] of Object.entries(defaults._settings || {})) {
                const input = data._settings[k];
                out._settings[k] = typeof v === 'number' ? number(input, v, 10000) : typeof v === 'boolean' ? (typeof input === 'boolean' ? input : v) : typeof input === 'string' ? (/color/i.test(k) ? colour(input, v) : string(input)) : v;
            }
        }
        const palettes = definitions.palettes || {};
        const classic = palettes.classic?.colors || ['#00ffff','#3388ff','#ff9900','#ffff33','#33ff33','#cc33ff','#ff3366'];
        const colours = (v, fallback) => fallback.slice(0, 7).map((c,i) => colour(Array.isArray(v) ? v[i] : null, c));
        if ('customPickerColors' in data) out.customPickerColors = colours(data.customPickerColors, classic);
        out.customPaletteOverrides = Object.fromEntries(entries(data.customPaletteOverrides).filter(([k]) => Object.hasOwn(palettes, k)).map(([k,v]) => [k, colours(v, palettes[k].colors)]));
        const items = new Set([
            ...(definitions.items || []).map(item => item.key),
            ...Object.keys(definitions.skins || {retro:true, glass:true, shadow:true, outline:true, holo:true, journey:true, bubble:true}),
            ...('ocean forest fire dragon void sunset arctic midnight sakura ghostColor dots boxes dotboxes sfxCyber sfxRetro sfxZen sfxArcade').split(' '),
            ...Object.keys(palettes),
        ]);
        const partLabel = definitions.partLabel || (key => key === 'ghostColor' ? 'Colored Ghost' : key.charAt(0).toUpperCase() + key.slice(1));
        const partCost = definitions.partCost || (() => 10);
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
            const rarity = ['common','rare','epic','legendary'].includes(r.rarity) ? r.rarity : 'common';
            if (type === 'universal_parts') return { type, amount, rarity, icon:'⭐', label:`+${amount} Universal Part${amount === 1 ? '' : 's'}`, desc:'Added to your inventory' };
            if (type === 'parts' && items.has(key)) return { type, key, amount, rarity, icon:'🧩', label:`+${amount} Part: ${partLabel(key)}`, desc:`${number(out.parts[key])}/${partCost(key)} parts` };
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
        return out;
    };
})();
