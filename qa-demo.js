(() => {
    const query = new URLSearchParams(window.location.search);
    if (!query.has('dev') || !query.has('demo')) return;

    function previousDate(days = 1) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return LBSave.localDate(date);
    }

    function createSave(defaults, missions) {
        const { id, day } = LBSeason.seasonWindow(Date.now());
        const receipt = { type: 'universal_parts', amount: 2 };
        const leaderboard = [
            { score: 18420, date: previousDate(), lines: 42, blocks: 151, time: 318, maxSpeed: 5, xp: 840, maxCombo: 4 },
            { score: 12360, date: previousDate(2), lines: 31, blocks: 126, time: 267, maxSpeed: 4, xp: 610, maxCombo: 3 },
            { score: 7800, date: previousDate(4), lines: 21, blocks: 98, time: 192, maxSpeed: 3, xp: 390, maxCombo: 2 },
        ];
        return {
            ...defaults,
            totalXP: 64000,
            ownedSkins: ['retro', 'glass', 'shadow', 'holo', 'aztec', 'brushed-metal'],
            ownedThemes: ['ocean', 'forest', 'fire', 'dragon', 'void', 'sunset', 'arctic', 'midnight', 'sakura'],
            ownedSfxPacks: ['default', 'retro'],
            ownedPalettes: ['classic', 'greyscale', 'ice', 'pastel', 'dark', 'synthwave', 'earth', 'neon'],
            parts: { 'aztec-gold': 12, bubble: 4, 'carved-stone': 7 },
            universalParts: 13,
            boosters: { '1.25x_game': 4, '1.5x_game': 2, '2xp_game': 1 },
            ghostColorUnlocked: true,
            seenFunRules: true,
            levelRewardsThrough: 30,
            lastDailyGift: previousDate(),
            storedCrates: ['common', 'rare', 'rare', 'epic', 'legendary', 'mythic'].map(rarity => ({ rarity })),
            season: { ...LBSeason.emptySeason(id), points: 64, claimed: { ...(day >= 2 && { 1: receipt }), ...(day >= 4 && { 2: receipt }) } },
            missions,
            stats: {
                ...defaults.stats, gamesPlayed: 12, totalTimePlayed: 2840, totalBlocksPlaced: 1211,
                totalLinesCleared: 214, totalQuads: 8, totalBoostersUsed: 3, dailyStreak: 2, highestDailyStreak: 4,
                maxCombo: 4, lastPlayDate: previousDate(), bestMaxSpeed: 5, totalScore: 73210,
                playHistory: { [previousDate(0)]: 1, [previousDate()]: 4, [previousDate(2)]: 3, [previousDate(4)]: 4 },
                blockTypeUsage: { I: 185, J: 172, L: 169, O: 172, S: 169, T: 181, Z: 163 },
                songPlayCounts: { 'Glass Harbor': 12, Fernlight: 8, 'Copper Relay': 5 },
            },
            leaderboard,
            pinnedScores: [leaderboard[0]],
            funLeaderboard: [{ ...leaderboard[2], score: 6400, cols: 12, rows: 20, startSpeed: 3 }],
            achievements: {
                score: { tier: 3, tierDates: { 3: previousDate() } },
                games: { unlocked: true, tier: 1, unlockedAt: previousDate(4) },
                total_lines: { unlocked: true, tier: 1, unlockedAt: previousDate(2) },
                mq_easy_quests: { tier: 1, tierDates: { 1: previousDate() } },
            },
            menuPlaylist: ['Glass Harbor', 'Fernlight', 'Paper Orbits'],
            gamePlaylist: ['Copper Relay', 'Vector Bloom'],
            actionPlaylist: ['Redline Echo'],
            _settings: { skin: 'aztec', optHold: true },
        };
    }

    function seedMissions({ daily, weekly, streaks, stats }) {
        for (const entries of [daily.quests, weekly.missions]) {
            entries.forEach((entry, index) => {
                const target = entry.target || 1;
                if (!index) Object.assign(entry, { progress: target, completed: true });
                else if (index === 1) entry.progress = Math.floor(target / 2);
            });
        }
        Object.assign(daily, { pointsToday: 8, rawXPToday: 180, newVisit: false });
        Object.assign(weekly, { points: 84, newVisit: false });
        Object.assign(streaks, { daily: 2, bestDaily: 4 });
        Object.assign(stats, { totalCompleted: 13, weeklyCompleted: 3, totalPts: 84 });
    }

    function mount({ run, resetRun, tracksReady, alert, confirm, levelUp, levelCrate, missionCrate, closeCrate, dailyGift }) {
        const byId = id => document.getElementById(id);
        const click = selector => document.querySelector(selector).click();
        const screens = new Map();
        const add = (name, open, close = () => {}) => screens.set(name, { open, close });
        const hide = id => byId(id).classList.add('hidden');
        const remove = id => byId(id)?.remove();
        const screen = (name, id, open, close) => add(name, open, () => {
            close?.();
            const element = byId(id);
            if (element) {
                element.dispatchEvent(new Event('animationend'));
                hide(id);
            }
        });
        const settings = tab => window.openSettings(false, tab);
        const inventory = tab => window.openInventory(tab);
        const stats = tab => { window.openStats(); click(`[data-stats-tab="${tab}"]`); };
        const missions = tab => window.openMissions(tab);
        const closeMissions = () => { window._mqChangeMode = false; window.closeMissions(); };
        const play = mode => { window.openModeSelect(); click(`#mode-select-overlay [data-mode="${mode}"]`); };

        add('menu', () => {});
        for (const mode of ['normal', 'fun']) screen(mode === 'normal' ? 'play' : 'play-fun', 'mode-select-overlay', () => play(mode), window.closeModeSelect);
        screen('settings-home', 'settings-overlay', () => settings(), window.closeSettings);
        for (const tab of ['game', 'controls', 'audio', 'display', 'notifications', 'updates', 'about']) {
            screen(tab === 'game' ? 'settings' : `settings-${tab}`, 'settings-overlay', () => settings(tab), window.closeSettings);
        }
        add('whats-new-notice', () => window.LBUpdateTools.showReleaseNotice(window.BUNDLE.version, null, { preview: true }), () => {
            window.LBUpdateTools.notices('installed', []);
            document.querySelector('dialog[data-release-notes]')?.close();
        });
        for (const tab of ['crates', 'blocks', 'colors', 'boosters', 'parts', 'other']) screen(tab === 'crates' ? 'inventory' : `inventory-${tab}`, 'inventory-overlay', () => inventory(tab), window.closeInventory);
        for (const tab of ['general', 'leaderboard', 'pinned', 'highscores']) screen(tab === 'general' ? 'stats' : tab, 'stats-overlay', () => stats(tab), window.closeStats);
        for (const tab of ['daily', 'weekly']) screen(tab === 'daily' ? 'missions' : 'missions-weekly', 'missions-overlay', () => missions(tab), closeMissions);
        screen('mission-confirm', 'missions-overlay', async () => {
            await missions('daily');
            window._toggleChangeMode();
            const mission = document.querySelector('.mq-change-overlay')?.closest('[data-mission-slot]');
            if (mission) window._changeMission(Number(mission.dataset.missionSlot), false);
        }, () => {
            byId('mq-confirm-cancel').click();
            closeMissions();
        });
        screen('season-pass', 'missions-overlay', () => missions('season'), closeMissions);
        screen('achievements', 'achievements-overlay', window.openAchievements, window.closeAchievements);
        screen('playlist', 'playlist-overlay', async () => { await tracksReady(); window.openPlaylistPanel(); }, window.closePlaylistPanel);
        screen('help', 'rules-overlay', window.openHelp, window.closeHelp);
        screen('tutorial', 'tutorial-overlay', window.openTutorial, window.closeTutorial);
        screen('credits', 'credits-overlay', window.openCredits, window.closeCredits);
        screen('transfer', 'transfer-overlay', window.openTransferMenu, window.closeTransferMenu);
        screen('alert', 'custom-alert', () => alert('This is an in-memory QA demo.', 'QA DEMO'), () => {
            window.closeAlert();
            byId('alert-box').dispatchEvent(new Event('animationend'));
        });
        screen('confirm', 'custom-confirm', () => { confirm('Continue with this demo action?', 'Continue'); }, () => {
            byId('confirm-no').click();
            byId('custom-confirm').firstElementChild.dispatchEvent(new Event('animationend'));
        });
        add('reset-progress', window.resetAllProgress, () => byId('reset-cancel-btn')?.click());
        add('color-picker', window._openColorPickerModal, () => byId('color-picker-modal')?.close());
        add('custom-palette', window._openCustomPaletteModal, () => byId('custom-palette-modal')?.close());
        add('palette-preview', () => window._openPaletteViewModal('ice'), () => remove('palette-view-modal'));
        add('palette-editor', () => window._openPaletteEditor('ice'), () => remove('pal-edit-modal'));
        add('sfx-preview', window.openSfxPackPreview, () => remove('sfx-preview-modal'));
        add('sfx-panel', window.devSFXPanel, () => remove('sfx-panel-modal'));
        add('universal-parts', window.openUseUniversalPart, () => remove('uni-modal-overlay'));
        add('universal-exchange', window.openExchangeUniversalParts, () => remove('uni-xch-overlay'));
        add('booster-exchange', () => window._openExchangeModal('1.25x_game', '1.5x_game', 'booster'), () => remove('exc-modal-overlay'));
        screen('inventory-sfx', 'inventory-overlay', async () => { await inventory('other'); click('[data-sfx-preview="retro"]'); }, () => {
            remove('sfx-inv-preview');
            window.closeInventory();
        });
        add('daily-gift', dailyGift, () => remove('daily-gift-crate-overlay'));
        add('level-crate', levelCrate, closeCrate);
        add('level-up', levelUp, () => remove('level-up-popup-overlay'));
        add('mission-crate', missionCrate, closeCrate);
        for (const name of ['start-animation', 'game', 'pause', 'game-over']) add(name, () => run(name), resetRun);

        for (const button of document.querySelectorAll('#transfer-overlay button:not(.btn-back)')) {
            if (button.matches('[onclick*="startExportProcess"], [onclick*="file-import-input"]')) button.disabled = true;
        }
        document.title += ' · QA Demo';
        if (query.has('cutout')) {
            const root = document.documentElement;
            const cutout = query.get('cutout');
            const notch = cutout === 'notch';
            const native = notch || cutout === 'hole';
            const top = native ? (notch ? 49 : 41) : 40;
            root.dataset.lbQaCutout = notch ? 'notch' : 'hole';
            root.style.setProperty('--safe-area-inset-top', `${top}px`);
            if (native) {
                const center = root.clientWidth / 2;
                const halfWidth = notch ? 79 : 10.5;
                window.__lbWindowInsets = { top, rects: [{
                    left: center - halfWidth, right: center + halfWidth, top: notch ? 0 : 11, bottom: notch ? 36 : 32,
                }] };
                window.dispatchEvent(new CustomEvent('lb-window-insets', { detail: window.__lbWindowInsets }));
            }
        }
        let active;
        let queue = Promise.resolve();
        window.__LB_QA = {
            list: () => [...screens.keys()],
            open(name) {
                const target = screens.get(name);
                if (!target) return Promise.reject(new RangeError(`Unknown QA screen: ${name}`));
                const opened = queue.then(() => {
                    active?.close();
                    active = target;
                    return target.open();
                });
                queue = opened.catch(() => {});
                return opened;
            },
        };
    }

    window.LBQADemo = { createSave, seedMissions, previousDate, mount };
})();
