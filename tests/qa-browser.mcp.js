(async (page, { viewport = { width: 390, height: 844 }, cutout, theme = 'dark', capture } = {}) => {
    const url = new URL('/index.html?dev&demo', page.url());
    if (cutout !== undefined) url.searchParams.set('cutout', cutout);
    const localCatalog = await (await page.request.get(new URL('/assets/music.json', url).href)).json();
    const releaseCatalog = await (await page.request.get(new URL('/assets/music.release.json', url).href)).json();
    const catalogFiles = catalog => Object.values(catalog).flat().filter(track => track.file)
        .map(track => '/assets/music/' + encodeURIComponent(track.file));
    const releaseMusic = new Set(catalogFiles(releaseCatalog));
    const optionalMusic = new Set(catalogFiles(localCatalog).filter(path => !releaseMusic.has(path)));
    const isOptionalMusic = address => address.startsWith(url.origin + '/')
        && optionalMusic.has(new URL(address).pathname);

    let screen = 'boot';
    const failures = new Set();
    const fail = message => failures.add(`${screen}: ${message}`);
    const onError = error => fail(error.stack || error.message);
    const onConsole = message => {
        if (message.type() !== 'error') return;
        if (/^Failed to load resource:.*\b404\b/.test(message.text()) && isOptionalMusic(message.location().url)) return;
        fail(message.text());
    };
    const onResponse = response => {
        if (response.status() < 400 || (response.status() === 404 && isOptionalMusic(response.url()))) return;
        fail(`${response.status()} ${response.url()}`);
    };
    page.on('pageerror', onError);
    page.on('console', onConsole);
    page.on('response', onResponse);
    const originalViewport = page.viewportSize();
    try {
        await page.setViewportSize(viewport);
        await page.goto(url.href);
        await page.waitForFunction(() => window.__LB_QA && document.querySelector('#loading-screen').style.display === 'none');
        if (theme !== 'dark') {
            await page.evaluate(() => window.__LB_QA.open('settings-display'));
            await page.locator(`[data-ui-theme="${theme}"]`).click();
        }
        const chrome = await page.evaluate(() => {
            const band = document.querySelector('.lb-top-band');
            const style = getComputedStyle(band);
            const root = document.documentElement;
            return {
                top: band.getBoundingClientRect().top, height: band.getBoundingClientRect().height,
                empty: !band.childNodes.length && ['::before', '::after'].every(part => getComputedStyle(band, part).content === 'none'),
                image: style.backgroundImage, color: style.backgroundColor, pointers: style.pointerEvents,
                theme: root.dataset.lbUiTheme, choice: document.querySelector('[data-ui-theme][aria-pressed="true"]')?.dataset.uiTheme,
                systemLight: matchMedia('(prefers-color-scheme: light)').matches,
                scheme: getComputedStyle(root).colorScheme,
            };
        });
        const expectedHeight = cutout === 'notch' ? 63 : cutout === 'hole' ? 55 : cutout === undefined ? 0 : 54;
        const resolved = theme === 'system' ? (chrome.systemLight ? 'light' : 'dark') : theme;
        const bandColor = resolved === 'light' ? 'rgb(33, 61, 52)' : 'rgb(16, 27, 23)';
        if (chrome.top !== 0 || chrome.height !== expectedHeight || !chrome.empty || chrome.image !== 'none' ||
            chrome.color !== bandColor || chrome.pointers !== 'none' || chrome.scheme !== resolved || chrome.theme !== resolved || chrome.choice !== theme) {
            fail(`Unexpected Ledger band or theme: ${JSON.stringify(chrome)}`);
        }
        const names = await page.evaluate(() => window.__LB_QA.list());
        const docs = await (await page.request.get(new URL('/docs/QA-SCREENS.md', url).href)).text();
        const documented = docs.split('\n').filter(line => line.startsWith('|'))
            .flatMap(line => Array.from(line.matchAll(/`([^`]+)`/g), match => match[1]));
        if ([...names].sort().join() !== documented.sort().join()) fail('QA screen list differs from the documented targets');
        await page.evaluate(() => document.fonts.ready);

        for (const name of names) {
            screen = name;
            try {
                await page.evaluate(target => window.__LB_QA.open(target), name);
            } catch (error) {
                onError(error);
            }
            if (name === 'start-animation') await capture?.(name);
            await page.waitForTimeout(1050);
            if (name !== 'start-animation') await capture?.(name);
            const clearsBand = await page.evaluate(() => {
                const bandBottom = document.querySelector('.lb-top-band').getBoundingClientRect().bottom;
                return [...document.querySelectorAll('.lb-block-back, .lb-menu-banner')].every(control =>
                    !control.getClientRects().length || control.getBoundingClientRect().top >= bandBottom - 1);
            });
            if (!clearsBand) fail('Header or menu content overlaps the top band');
            const squeezedTitles = await page.evaluate(() => {
                const titles = document.querySelectorAll('.lb-topbar-title, .lb-block-topbar > h1');
                return [...titles].filter(title => {
                    if (!title.getClientRects().length) return false;
                    const bounds = title.getBoundingClientRect();
                    const content = document.createRange();
                    content.selectNodeContents(title);
                    const ink = content.getBoundingClientRect();
                    const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
                    const header = title.closest('.lb-block-topbar').getBoundingClientRect();
                    return ink.left < Math.max(0, bounds.left, header.left) - 1
                        || ink.right > Math.min(innerWidth, bounds.right, header.right) + 1
                        || bounds.height > lineHeight + 1;
                }).map(title => title.textContent.trim());
            });
            if (squeezedTitles.length) fail(`Header titles wrap or clip at ${viewport.width}px: ${squeezedTitles.join(', ')}`);
            const textLayoutFailures = await page.evaluate(() => {
                const issues = new Set();
                const labelSelector = 'button, [role="button"], [role="tab"], nav a, [role="navigation"] a, h1, h2, h3, h4, h5, h6, [role="heading"]';
                const labels = new Map();
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                const range = document.createRange();
                const rectsFor = (node, start, end) => {
                    range.setStart(node, start);
                    range.setEnd(node, end);
                    return [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
                };
                const spansLines = rects => rects.some(rect => Math.abs(rect.top - rects[0].top) > 1);

                for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                    const parent = node.parentElement;
                    if (parent.namespaceURI !== document.body.namespaceURI || !node.data.trim() ||
                        !parent.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
                    const rects = rectsFor(node, 0, node.length);
                    if (!rects.length) continue;
                    if (spansLines(rects)) {
                        for (const word of node.data.matchAll(/[\p{L}\p{N}\p{M}]+(?:['’\u00ad\u200b][\p{L}\p{N}\p{M}]+)*/gu)) {
                            if (spansLines(rectsFor(node, word.index, word.index + word[0].length))) {
                                issues.add(`Word wraps internally: ${JSON.stringify(word[0])}`);
                            }
                        }
                    }
                    const label = parent.closest(labelSelector);
                    if (!label) continue;
                    const parts = labels.get(label) || [];
                    parts.push({ text: node.data, rects });
                    labels.set(label, parts);
                }
                for (const parts of labels.values()) {
                    const text = parts.map(part => part.text).join('').trim();
                    const rects = parts.flatMap(part => part.rects);
                    const separateRows = Math.max(...rects.map(rect => rect.top)) >= Math.min(...rects.map(rect => rect.bottom)) - 1;
                    if (/^\S+$/.test(text) && (separateRows || parts.some(part => spansLines(part.rects)))) {
                        issues.add(`Single-word label exceeds one line: ${JSON.stringify(text)}`);
                    }
                }

                const achievements = document.querySelector('#btn-achievements > span:not([aria-hidden])');
                if (achievements?.checkVisibility()) {
                    range.selectNodeContents(achievements);
                    const ink = range.getBoundingClientRect();
                    const bounds = achievements.getBoundingClientRect();
                    if (achievements.textContent.trim() !== 'Achievements' || ink.left < bounds.left - 1 ||
                        ink.right > Math.min(bounds.right, innerWidth) + 1 || achievements.scrollWidth > achievements.clientWidth + 1) {
                        issues.add('Menu must show the complete Achievements label');
                    }
                }
                return [...issues];
            });
            for (const issue of textLayoutFailures) fail(`${viewport.width}px: ${issue}`);
            if (name === 'inventory' || name.startsWith('inventory-')) {
                const tabsFit = await page.locator('.lb-inventory-tabs').evaluate(list => {
                    const bounds = list.getBoundingClientRect();
                    return list.scrollWidth <= list.clientWidth + 1 && [...list.children].every(tab => {
                        const rect = tab.getBoundingClientRect();
                        return rect.left >= bounds.left && rect.right <= Math.min(innerWidth, bounds.right)
                            && tab.scrollWidth <= tab.clientWidth + 1;
                    });
                });
                if (!tabsFit) fail('Inventory categories do not all fit in the segmented control');
            }
            if (name === 'settings-home') {
                const fits = await page.evaluate(() => {
                    const search = document.querySelector('.lb-ledger-search').getBoundingClientRect();
                    const scroll = document.querySelector('.lb102-settings-scroll').getBoundingClientRect();
                    const rows = [...document.querySelectorAll('.lb-ledger-list > button')];
                    return rows.length === 5 && rows.every(row => {
                        const bounds = row.getBoundingClientRect();
                        const icon = row.firstElementChild.getBoundingClientRect();
                        return bounds.top >= search.bottom && bounds.bottom <= scroll.bottom && bounds.height >= 44
                            && icon.width > 0 && icon.width <= 24 && row.querySelector('strong').getBoundingClientRect().width > 140;
                    });
                });
                if (!fits) fail('Settings directory rows or icons do not fit');
                const search = page.locator('.lb-ledger-search input');
                await search.fill('wallpaper');
                const matches = await page.locator('.lb-ledger-list > button:visible').evaluateAll(rows => rows.map(row => row.dataset.settingsCategory));
                if (matches.join() !== 'display') fail('Wallpaper search did not hide unrelated settings rows');
                await search.fill('no such setting');
                if (!await page.getByRole('status').filter({ hasText: 'No matching settings.' }).isVisible()) fail('Missing settings search empty state');
                await search.fill('wallpaper green');
                await page.locator('[data-settings-category="display"]').click();
                if (!await page.getByRole('heading', { name: 'Display', exact: true }).isVisible()) fail('Search result did not open Display');
                await page.locator('#settings-back').click();
                if (await search.inputValue() !== 'wallpaper green' ||
                    !await page.locator('[data-settings-category="display"]').evaluate(button => button === document.activeElement)) {
                    fail('Back did not restore the active search and its result focus');
                }
                await search.clear();
            }
            if (name === 'settings-display') {
                const wallpaper = page.locator('#setting-theme-background');
                const preview = page.locator('.lb102-wallpaper-preview');
                const original = await wallpaper.inputValue();
                await wallpaper.selectOption('plain');
                if (await preview.evaluate(element => getComputedStyle(element).backgroundImage) !== 'none') fail('Plain wallpaper still shows artwork');
                await wallpaper.selectOption('ocean');
                if (!(await preview.evaluate(element => getComputedStyle(element).backgroundImage)).includes('ocean-')) fail('Wallpaper picker did not preview the selected art');
                if (await page.locator('html').getAttribute('data-lb-ui-theme') !== accent) fail('Changing wallpaper also changed the accent');
                await wallpaper.selectOption(original);
            }
            if (name === 'menu') {
                await page.locator('#lb43-daily-gift').scrollIntoViewIfNeeded();
                const fits = await page.evaluate(() => {
                    const corner = document.querySelector('.lb43-gift-corner').getBoundingClientRect();
                    const player = document.querySelector('#music-widget').getBoundingClientRect();
                    const bottomInset = parseFloat(getComputedStyle(document.querySelector('#menu-overlay')).paddingBottom);
                    return corner.width > 0 && corner.right <= innerWidth - 12 && corner.bottom <= innerHeight - bottomInset + 1
                        && corner.left >= player.right + 6 && player.height > 0;
                });
                if (!fits) fail('Daily Gift does not fit clear of the music player and safe area');
                await page.locator('#btn-season-pass').click();
                await page.locator('#season-pass-overlay').waitFor({ state: 'visible', timeout: 3000 })
                    .catch(() => fail('Season Pass card did not open the Season Pass view'));
                await page.evaluate(() => {
                    window.closeMissions();
                    document.querySelector('#menu-overlay .menu-scale-wrapper').scrollTop = 0;
                });
            }
            if (name === 'game-over') {
                const actionsFit = await page.locator('#go-overlay .go-actions').evaluate(actions => {
                    const dialog = actions.closest('.go-dialog').getBoundingClientRect();
                    const footer = actions.getBoundingClientRect();
                    return footer.height >= 44 && footer.bottom <= dialog.bottom && footer.bottom <= innerHeight;
                });
                if (!actionsFit) fail('Run actions do not fit below the scrollable results');
                const boostersFit = await page.locator('#go-overlay .go-dialog-body').evaluate(body => {
                    const boosters = body.querySelector('.go-boost-list');
                    if (!boosters) return false;
                    const { bottom, top } = body.getBoundingClientRect();
                    if (boosters.getBoundingClientRect().bottom > bottom) {
                        body.scrollTop += boosters.getBoundingClientRect().bottom - bottom;
                    }
                    const row = boosters.getBoundingClientRect();
                    return row.top >= top - 1 && row.bottom <= bottom + 1;
                });
                if (!boostersFit) fail('XP booster buttons cannot be brought fully into view above the run actions');
            }
            if (name === 'missions' || name === 'missions-weekly') {
                const compact = await page.evaluate(() => {
                    const button = document.querySelector('.mq-card-action--claim .mq-pts-claim-btn');
                    if (!button) return false;
                    const { height, right } = button.getBoundingClientRect();
                    return height >= 26 && height <= 30 && Math.abs(right - button.parentElement.getBoundingClientRect().right) < 1;
                });
                if (!compact) fail('Claim button is not a 26–30px right-aligned action');
                const board = await page.evaluate(period => {
                    const card = document.querySelector('.mq-board');
                    const selected = document.querySelector('.mq-board-controls [aria-pressed="true"][data-tab]');
                    const rows = [...document.querySelectorAll('#missions-body .mq-card')].slice(0, 2);
                    const count = document.querySelector('.mq-header #mq-list-meta');
                    return card?.querySelector('time')?.dateTime && selected?.dataset.tab === period
                        && selected.getBoundingClientRect().bottom <= card.getBoundingClientRect().top
                        && /\d+ \/ \d+ complete/.test(count?.textContent) && !count.hidden
                        && rows.length === 2 && rows[0].getBoundingClientRect().left === rows[1].getBoundingClientRect().left
                        && !/\bspeed\b/i.test(document.getElementById('mq-mission-view').innerText);
                }, name === 'missions' ? 'daily' : 'weekly');
                if (!board) fail('Mission board is missing its timer, active period, or single-column cards');
            }
            if (name === 'season-pass') {
                const track = await page.evaluate(() => {
                    const screen = document.getElementById('season-pass-overlay');
                    const rail = screen.querySelector('.sp-track');
                    const next = rail.querySelector('[aria-current="step"]');
                    const end = rail.querySelector('[data-stage="30"]');
                    return !screen.hidden && rail.querySelectorAll('.sp-card[data-rarity]').length === 30
                        && rail.scrollHeight > rail.clientHeight && rail.scrollWidth <= rail.clientWidth + 1
                        && screen.querySelector('.sp-hero progress')?.getBoundingClientRect().width > 0
                        && next?.querySelector('.sp-step')?.textContent === next?.dataset.stage.padStart(2, '0')
                        && end?.querySelector('h3')?.textContent.includes('Season Prism');
                });
                if (!track) fail('Season Pass is missing the next-stage meter or rarity-labelled rewards');
            }
        }
        if (failures.size) throw new Error([...failures].join('\n'));
        return { passed: names.length, viewport: `${viewport.width}×${viewport.height}` };
    } finally {
        page.off('response', onResponse);
        page.off('console', onConsole);
        page.off('pageerror', onError);
        if (originalViewport) await page.setViewportSize(originalViewport);
    }
})
