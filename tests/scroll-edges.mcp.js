(async (page, { capture, verify = true, widths = [390, 360, 1280] } = {}) => {
    const screens = {
        'inventory-colors': ['#inventory-overlay', '.lb-inventory-content'],
        missions: ['#missions-overlay', '#mq-mission-view'],
        'missions-weekly': ['#missions-overlay', '#mq-mission-view'],
        achievements: ['#achievements-overlay', '.lb-scroll-fade'],
        stats: ['#stats-overlay', '#general-stats-container'],
        leaderboard: ['#stats-overlay', '#leaderboard-container'],
        pinned: ['#stats-overlay', '#pinned-container'],
        highscores: ['#stats-overlay', '#highscores-container'],
        playlist: ['#playlist-overlay', '#playlist-panel-content'],
        'season-pass': ['#season-pass-overlay', '.sp-track'],
        'game-over': ['#go-overlay', '.go-dialog-body'],
        help: ['#rules-overlay', '.lb-help-content'],
        'help-topics': ['#rules-overlay', '.lb-help-nav'],
        'settings-home': ['#settings-overlay', '.lb102-settings-scroll'],
        'settings-display': ['#settings-overlay', '.lb102-settings-scroll'],
        play: ['#mode-select-overlay', '.lb148-play-content'],
        tutorial: ['#tutorial-overlay', '.lb102-tutorial-scroll'],
        credits: ['#credits-overlay', '.lb80-credits'],
    };
    const captureScreens = ['inventory-colors', 'missions', 'achievements', 'stats', 'playlist', 'season-pass', 'game-over'];
    const layouts = [
        { width: 390, height: 844, fontSize: '5', cutout: 'hole' },
        { width: 360, height: 640, fontSize: '10', cutout: 'hole' },
        { width: 1280, height: 800, fontSize: '5' },
    ].filter(({ width }) => widths.includes(width));
    const failures = [];
    const originalViewport = page.viewportSize();
    try {
        for (const { width, height, fontSize, cutout } of layouts) {
            const viewport = { width, height };
            const url = new URL('/index.html?dev&demo', page.url());
            if (cutout) url.searchParams.set('cutout', cutout);
            await page.setViewportSize(viewport);
            await page.goto(url.href);
            await page.waitForFunction(() => window.__LB_QA && document.querySelector('#loading-screen').style.display === 'none');
            const appliedFontSize = await page.evaluate(async size => {
                await document.fonts.ready;
                window.onSettingChange('fontSize', size);
                return document.querySelector('#slider-fontsize').value;
            }, fontSize);
            if (appliedFontSize !== fontSize) throw new Error('Failed to set font size ' + fontSize);

            for (const [name, [root, selector]] of Object.entries(screens)) {
                const label = width + '×' + height + ', font ' + fontSize + ', ' + name;
                await page.evaluate(screen => window.__LB_QA.open(screen), name === 'help-topics' ? 'help' : name);
                if (name === 'help-topics') await page.locator('#rules-overlay .lb-help-topic-key').click();
                const pane = page.locator(root).locator(selector);
                await pane.waitFor();
                const measure = () => pane.evaluate(el => {
                    const owner = el.closest('.overlay');
                    const header = owner.querySelector('.lb-block-topbar');
                    const title = header?.querySelector('.lb-topbar-title');
                    const bounds = el.getBoundingClientRect();
                    const style = getComputedStyle(el);
                    return {
                        top: bounds.top,
                        bottom: bounds.top + el.clientTop + el.clientHeight,
                        headerBottom: header?.getBoundingClientRect().bottom,
                        titleBottom: title?.getBoundingClientRect().bottom,
                        actionsTop: owner.querySelector('.go-actions')?.getBoundingClientRect().top,
                        remaining: el.scrollHeight - el.clientHeight - el.scrollTop,
                        mask: style.maskImage,
                        transparentBackdrop: style.backgroundImage === 'none'
                            && style.backgroundColor === 'rgba(0, 0, 0, 0)',
                        topFade: el.hasAttribute('data-fade-above'),
                    };
                });
                const scroll = top => pane.evaluate(async (el, target) => {
                    const limit = el.scrollHeight - el.clientHeight;
                    el.scrollTop = target === 'middle' ? Math.min(100, limit / 2) : target === 'end' ? limit : 0;
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                }, top);
                await scroll('start');
                const start = await measure();
                await scroll('middle');
                const middle = await measure();
                if (capture && width === 390 && captureScreens.includes(name)) {
                    const edgeTop = Math.min(height, Math.ceil(middle.top + 88));
                    const edgeBottom = Math.max(0, Math.floor(middle.bottom - 88));
                    await capture(name + '-top', { x: 0, y: 0, width, height: edgeTop });
                    await capture(name + '-bottom', { x: 0, y: edgeBottom, width, height: height - edgeBottom });
                }
                await scroll('end');
                const end = await measure();
                await scroll('start');
                if (!verify) continue;

                for (const state of [start, middle, end]) {
                    if (name !== 'game-over' && (state.headerBottom == null || state.titleBottom == null ||
                        state.headerBottom > state.top || state.titleBottom > state.headerBottom)) {
                        failures.push(label + ' has a clipped title or a scroll area that overlaps the header');
                    }
                    if (state.actionsTop != null && state.bottom > state.actionsTop + 0.5) {
                        failures.push(label + ' scroll area overlaps the fixed actions');
                    }
                    const expectedMask = state.remaining > 1;
                    const bottomOnlyMask = state.mask.startsWith('linear-gradient(rgb(0, 0, 0)')
                        && state.mask.endsWith(', rgba(0, 0, 0, 0))')
                        && state.mask.includes('40px');
                    if (state.topFade || (expectedMask ? !bottomOnlyMask : state.mask !== 'none')) {
                        failures.push(label + ' has the wrong scroll mask: ' + JSON.stringify(state));
                    }
                    if (!state.transparentBackdrop) {
                        failures.push(label + ' applies the scroll mask to the backdrop');
                    }
                }
            }
        }
    } finally {
        if (originalViewport) await page.setViewportSize(originalViewport);
    }
    if (failures.length) throw new Error([...new Set(failures)].join('\n'));
    return { screens: Object.keys(screens).length, layouts: layouts.length };
})
