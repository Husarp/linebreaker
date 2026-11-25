(async (page, { viewport = { width: 390, height: 844 }, cutout, theme = 'dark', capture, batch, screens } = {}) => {
    const url = new URL('/index.html?dev&demo', page.url());
    if (cutout !== undefined) url.searchParams.set('cutout', cutout);
    const localCatalog = await (await page.request.get(new URL('/assets/music.json', url).href)).json();
    const optionalMusic = new Set(Object.values(localCatalog).flat()
        .filter(track => track.file && track.license !== 'CC0')
        .map(track => '/assets/music/' + encodeURIComponent(track.file)));
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
    let reducedMotion;
    try {
        await page.setViewportSize(viewport);
        await page.goto(url.href);
        await page.waitForFunction(() => window.__LB_QA && document.querySelector('#loading-screen').style.display === 'none');
        reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
        const quotes = await page.evaluate(() => ({
            loading: Boolean(document.getElementById('loading-quote')),
            menu: document.getElementById('splash-quote')?.textContent.trim(),
        }));
        if (quotes.loading || !quotes.menu) fail('The daily quote should appear only on the menu');
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
        const allNames = await page.evaluate(() => window.__LB_QA.list());
        const docs = await (await page.request.get(new URL('/docs/QA-SCREENS.md', url).href)).text();
        const documented = docs.split('\n').filter(line => line.startsWith('|'))
            .flatMap(line => Array.from(line.matchAll(/`([^`]+)`/g), match => match[1]));
        if ([...allNames].sort().join() !== documented.sort().join()) fail('QA screen list differs from the documented targets');
        await page.evaluate(() => document.fonts.ready);

        const names = (batch ? allNames.slice(...batch) : allNames).filter(name => !screens || screens.includes(name));
        for (const name of names) {
            screen = name;
            try {
                const opened = page.evaluate(target => window.__LB_QA.open(target), name);
                if (name === 'game-over') {
                    await page.locator('#game-crash').waitFor({ state: 'visible' });
                    if (await page.locator('#go-overlay').isVisible()) fail('Top-out must precede results');
                    await capture?.('game-crash');
                }
                await opened;
            } catch (error) {
                onError(error);
            }
            if (name === 'start-animation') await capture?.(name);
            await page.waitForTimeout(1050);
            const isCrate = ['level-crate', 'mission-crate'].includes(name);
            if (isCrate) {
                const overlay = page.locator('.lb64-crate-overlay[data-reveal="revealed"]');
                await overlay.waitFor();
                const framesMatch = await overlay.evaluate(async dialog => {
                    const frames = [...dialog.querySelectorAll('.lb43-crate-frame')];
                    await Promise.all(frames.map(frame => frame.decode()));
                    const [first, ...rest] = frames.map(frame => frame.getBoundingClientRect());
                    const done = dialog.querySelector('.lb43-crate-result > button');
                    const button = done.getBoundingClientRect();
                    return frames.map(frame => frame.dataset.frame).join() === 'closed,ajar,open'
                        && frames.every(frame => frame.naturalWidth === 400 && frame.naturalHeight === 400)
                        && rest.every(rect => ['x', 'y', 'width', 'height'].every(key => rect[key] === first[key]))
                        && dialog.querySelector('.lb43-crate').dataset.frame === 'open'
                        && dialog.querySelector('.lb43-crate-result .lb-reward-card') && done.textContent === 'Done'
                        && button.top >= 0 && button.bottom <= innerHeight;
                });
                if (!framesMatch) fail('Crate frames must share their canvas and show the final rewards and Done action');
            }
            if (name !== 'start-animation') await capture?.(name);
            const infoOverlaps = await page.evaluate(() => {
                const visible = node => node.checkVisibility();
                const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1
                    && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
                return [...document.querySelectorAll('.lb-info-btn, .lb-block-info-icon')].filter(visible).flatMap(info => {
                    const scope = info.closest('.lb-block-topbar, .lb-help-label, .mq-list-head, .go-boost-heading, .lb-color-piece-header, .lb-block-panel-head')
                        || info.parentElement;
                    const hit = info.getBoundingClientRect();
                    const size = parseFloat(getComputedStyle(info, '::before').width);
                    const x = (hit.left + hit.right) / 2;
                    const y = (hit.top + hit.bottom) / 2;
                    const mark = { left: x - size / 2, right: x + size / 2, top: y - size / 2, bottom: y + size / 2 };
                    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
                    const range = document.createRange();
                    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                        if (!node.textContent.trim() || info.contains(node) || !visible(node.parentElement)) continue;
                        range.selectNodeContents(node);
                        if ([...range.getClientRects()].some(rect => overlaps(rect, mark))) return [info.getAttribute('aria-label')];
                    }
                    return [];
                });
            });
            if (infoOverlaps.length) fail(`Info icons overlap text: ${infoOverlaps.join(', ')}`);
            const clearsBand = await page.evaluate(() => {
                const bandBottom = document.querySelector('.lb-top-band').getBoundingClientRect().bottom;
                return [...document.querySelectorAll('.lb-block-back, .lb-menu-banner')].every(control =>
                    !control.getClientRects().length || control.getBoundingClientRect().top >= bandBottom - 1);
            });
            if (!clearsBand) fail('Header or menu content overlaps the top band');
            const dividerIntersects = await page.evaluate(() => [...document.querySelectorAll('.lb-block-topbar')].some(header => {
                const style = getComputedStyle(header);
                if (!header.checkVisibility() || style.borderBottomStyle !== 'dashed' || !parseFloat(style.borderBottomWidth)) return false;
                const divider = header.getBoundingClientRect().bottom - parseFloat(style.borderBottomWidth);
                return [...header.querySelectorAll('button, .lb-topbar-crumb, .lb-topbar-meta')].some(control =>
                    control.checkVisibility() && control.getBoundingClientRect().bottom > divider + .5);
            }));
            if (dividerIntersects) fail('Header divider intersects the row');
            if (name === 'play' || name === 'play-fun') {
                const headerAligned = await page.evaluate(() => {
                    const rect = selector => document.querySelector(selector).getBoundingClientRect();
                    const back = rect('#mode-select-overlay .lb-block-back');
                    const rules = rect('#play-rules');
                    return Math.abs(back.height - rules.height) < 1 && Math.abs(back.top - rules.top) < 1;
                });
                if (!headerAligned) fail('Select Mode back and Rules keys must share a height and baseline');
            }
            const squeezedTitles = await page.evaluate(() => {
                const titles = document.querySelectorAll('.lb-topbar-title, .lb-block-topbar > h1');
                return [...titles].filter(title => {
                    if (!title.getClientRects().length) return false;
                    const bounds = title.getBoundingClientRect();
                    const content = document.createRange();
                    content.selectNodeContents(title);
                    const ink = content.getBoundingClientRect();
                    const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
                    const header = title.closest('.lb-block-topbar');
                    const headerBounds = header.getBoundingClientRect();
                    const endControls = [...header.querySelectorAll(':scope > button, .lb-topbar-meta, .lb-info-btn')]
                        .filter(control => control.getClientRects().length)
                        .map(control => control.getBoundingClientRect().left)
                        .filter(left => left >= bounds.left);
                    return ink.left < Math.max(0, bounds.left, headerBounds.left) - 1
                        || ink.right > Math.min(innerWidth, bounds.right, headerBounds.right, ...endControls) + 1
                        || bounds.height > lineHeight + 1;
                }).map(title => title.textContent.trim());
            });
            if (squeezedTitles.length) fail(`Header titles wrap or clip at ${viewport.width}px: ${squeezedTitles.join(', ')}`);
            if (name === 'settings-updates' || name === 'whats-new-notice') {
                const selector = name === 'settings-updates' ? '#settings-whats-new' : '[data-release-notes][open]';
                const heading = page.locator(`${selector} > .lb-block-topbar > .lb-topbar-crumb > .lb-topbar-title`);
                if (await heading.count() !== 1 || await heading.textContent() !== "What's new") fail('What’s new must use the shared header');
            }
            if (['color-picker', 'custom-palette', 'palette-preview', 'palette-editor'].includes(name)) {
                const fits = await page.locator('.lb-color-dialog[open], .lb-palette-window > .lb-block-dialog').evaluate(dialog => {
                    const band = document.querySelector('.lb-top-band').getBoundingClientRect();
                    const box = dialog.getBoundingClientRect();
                    const apply = dialog.querySelector('.lb-color-apply')?.getBoundingClientRect();
                    return box.top >= band.bottom + 8 && box.bottom <= innerHeight - 8
                        && (!apply || (apply.top > box.top && apply.bottom < box.bottom));
                });
                if (!fits) fail('Colour dialog must fit below the status band and keep Apply visible');
            }
            if (name === 'settings' || name === 'settings-audio') {
                if (await page.locator('#settings-overlay .settings-tip:visible').count()) {
                    fail('Settings help sources must not cover neighbouring controls');
                }
            }
            if (name === 'settings-controls') {
                const rowsAlign = await page.locator('.lb-controls-grid').evaluate(grid => [...grid.children].every((row, index) => {
                    const style = getComputedStyle(row);
                    const visible = [...row.children].filter(child => child.getClientRects().length);
                    const center = child => child.getBoundingClientRect().y + child.getBoundingClientRect().height / 2;
                    return style.borderBottomWidth === '0px' && style.borderTopWidth === (index ? '1px' : '0px')
                        && visible.every(child => Math.abs(center(child) - center(visible[0])) <= 1);
                }));
                if (!rowsAlign) fail('Binding rows must center their controls and share one separator');
            }
            if (name === 'settings-audio') {
                for (const id of ['sfx-mute-btn', 'music-mute-btn']) {
                    const mute = page.locator(`#${id}`);
                    await mute.hover();
                    const floats = await mute.evaluate(button => {
                        const style = getComputedStyle(button);
                        return style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderTopWidth === '0px' && style.boxShadow === 'none'
                            && button.getBoundingClientRect().height >= 44;
                    });
                    if (!floats) fail(`${id} must be frameless and keep its hit target`);
                    const label = await mute.getAttribute('aria-label');
                    await mute.click();
                    if (await mute.getAttribute('aria-label') === label) fail(`${id} must announce the new action`);
                    await mute.click();
                }
            }
            const textLayoutFailures = await page.evaluate(isMenu => {
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
                if (isMenu && achievements?.checkVisibility()) {
                    range.selectNodeContents(achievements);
                    const ink = range.getBoundingClientRect();
                    const bounds = achievements.getBoundingClientRect();
                    if (achievements.textContent.trim() !== 'Achievements' || ink.left < bounds.left - 1 ||
                        ink.right > Math.min(bounds.right, innerWidth) + 1 || achievements.scrollWidth > achievements.clientWidth + 1) {
                        issues.add('Menu must show the complete Achievements label');
                    }
                }
                return [...issues];
            }, name === 'menu');
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
            if (name === 'inventory') {
                const locker = await page.locator('#inventory-crates .lb-r17-feature').evaluate(card =>
                    /locker-(quartermaster|vault-corridor)\.webp/.test(getComputedStyle(card).backgroundImage));
                if (!locker) fail('Locker is missing its selected artwork');
                const cards = page.locator('.lb43-locker-card');
                const gallery = await cards.evaluateAll(async items => {
                    const [first, second, third] = items.map(card => card.getBoundingClientRect());
                    if (!third || first.top !== second.top || second.left <= first.left || third.top <= second.top
                        || third.left !== first.left) return false;
                    const rareArt = items.filter(card => ['legendary', 'mythic'].includes(card.dataset.rarity));
                    await Promise.all(rareArt.map(card => card.querySelector('img').decode()));
                    return rareArt.length === 2 && rareArt.every(card => {
                        const image = card.querySelector('img');
                        const style = getComputedStyle(image);
                        const art = image.getBoundingClientRect();
                        const bounds = card.getBoundingClientRect();
                        return style.objectFit === 'contain' && style.maskImage === 'none' && style.clipPath === 'none'
                            && getComputedStyle(card).overflow === 'visible' && art.top > bounds.top
                            && art.left > bounds.left && art.right < bounds.right;
                    });
                });
                if (!gallery) fail('Stored crate cards must be two across with space for the full aura');
            }
            if (name === 'inventory-boosters' || name === 'booster-exchange' || name === 'game-over') {
                const container = { 'inventory-boosters': '#inventory-boosters', 'booster-exchange': '#exc-modal-overlay', 'game-over': '#go-boost-row' }[name];
                const scrolls = await page.locator(`${container} .lb-booster-token`).evaluateAll(icons => icons.length > 0
                    && icons.every(icon => /\/boosters\/scroll-(common|rare|epic|legendary)\.webp$/.test(icon.src)
                        && icon.src.endsWith(`scroll-${icon.closest('[data-rarity]')?.dataset.rarity ?? 'common'}.webp`)));
                if (!scrolls) fail('Boosters are missing their rarity-matched scrolls');
            }
            if (['inventory-blocks', 'inventory-colors', 'inventory-other'].includes(name)) {
                const labels = await page.evaluate(() => [...document.querySelectorAll('#inventory-overlay [role="tabpanel"]:not(.hidden) .lb-inventory-rarity')]
                    .map(label => [label.textContent.toLowerCase(), label.dataset.rarity, getComputedStyle(label).backgroundColor]));
                if (!labels.length || labels.some(([text, rarity, background]) => text !== rarity || background !== 'rgba(0, 0, 0, 0)')) {
                    fail('Inventory item rarities must appear as text without badges');
                }
            }
            if (name === 'stats') {
                const chart = await page.evaluate(() => {
                    const list = document.getElementById('stat-week-bars');
                    const days = [...list.children];
                    return list.getBoundingClientRect().height > 0 && list.scrollWidth <= list.clientWidth + 1
                        && days.map(day => day.querySelector('.lb-week-label')?.textContent).join(' ') === 'Mon Tue Wed Thu Fri Sat Sun'
                        && days.some(day => day.querySelector('.lb-week-bar')?.getBoundingClientRect().height > 0)
                        && days.some(day => day.children.length === 1)
                        && days.every(day => !day.querySelector('.lb-week-marker') || Number(day.querySelector('.lb-week-marker span')?.textContent) > 0);
                });
                if (!chart) fail('This week must show seven day labels and leave zero-game days empty');
                const recentFits = await page.locator('.lb-stats-chart--recent .lb-stats-calendar-scroll').evaluate(scroller => {
                    const cells = [...scroller.querySelectorAll('[data-cal-day]')];
                    const bounds = scroller.getBoundingClientRect();
                    return cells.length > 0 && cells.at(-1).getAttribute('aria-current') === 'date' && cells.every(cell => {
                        const rect = cell.getBoundingClientRect();
                        return rect.left >= bounds.left && rect.right <= bounds.right;
                    });
                });
                if (!recentFits) fail('Recent Activity must show both ends of the visible date range');
                const crates = page.locator('#stat-crates-collected');
                if (await crates.locator('dd').count() !== 5) fail('Stats must count each crate rarity separately');
                if (capture) {
                    await page.locator('#stat-activity-calendar').scrollIntoViewIfNeeded();
                    await capture('stats-activity');
                    await crates.scrollIntoViewIfNeeded();
                    await capture('stats-crates');
                }
            }
            const statsSections = {
                stats: ['This week', 'Personal best', 'Lifetime', 'Experience', 'Activity', 'Crates collected', 'Today'],
                leaderboard: ['Top three', 'Ranked runs'], pinned: ['Standard runs', 'Fun mode'], highscores: ['Personal bests'],
            }[name];
            if (statsSections) {
                const headers = await page.locator('#stats-overlay [role="tabpanel"]:not([hidden]) .lb-stats-section > .lb-block-panel-head')
                    .evaluateAll(elements => elements.map(header => [header.querySelector('h2').textContent, getComputedStyle(header).borderBottomWidth]));
                if (headers.map(([heading]) => heading).join() !== statsSections.join() || headers.some(([, line]) => line !== '0px')) {
                    fail('Week First sections are missing, out of order, or divided by a line');
                }
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
                const banner = page.locator('.lb-menu-banner');
                const play = page.locator('#btn-play');
                const original = await wallpaper.evaluate(element => element.value);
                const chooseWallpaper = async value => {
                    await wallpaper.getByRole('button').click();
                    await page.locator(`#setting-theme-background-list [data-value="${value}"]`).click();
                };
                const crop = viewport.width < viewport.height ? 'portrait' : 'landscape';
                const playArt = () => play.evaluate((element, orientation) =>
                    element.style.getPropertyValue(`--lb-theme-art-${orientation}`), crop);
                const originalPlayArt = await playArt();
                const playWallpaper = (await play.getAttribute('data-menu-art')).replace(/^wallpaper-/, '');
                await chooseWallpaper('plain');
                if (await preview.evaluate(element => getComputedStyle(element).backgroundImage) !== 'none') fail('Plain wallpaper still shows artwork');
                if ((await banner.evaluate(element => getComputedStyle(element).backgroundImage)).includes('/bg/')) fail('Plain wallpaper still shows banner art');
                if (!(await playArt()).includes(`${playWallpaper}-${crop}.jpg`)) fail('PLAY must still show its daily art with a plain banner');
                const wallpapers = ['default', 'ocean', 'forest', 'fire', 'dragon', 'void', 'sunset', 'arctic', 'midnight', 'sakura'];
                for (const choice of wallpapers) {
                    await chooseWallpaper(choice);
                    if (!(await preview.evaluate(element => getComputedStyle(element).backgroundImage)).includes(`${choice}-landscape.jpg`) ||
                        !(await banner.evaluate(element => getComputedStyle(element).backgroundImage)).includes(`${choice}-${crop}.jpg`)) {
                        fail(`Wallpaper ${choice} did not update the preview and ${crop} banner`);
                    }
                    if (await playArt() !== originalPlayArt) fail(`Changing the banner to ${choice} also changed PLAY's daily art`);
                }
                if (await page.locator('html').getAttribute('data-lb-ui-theme') !== resolved) fail('Changing wallpaper also changed the theme');
                const otherTheme = resolved === 'dark' ? 'light' : 'dark';
                await page.locator(`[data-ui-theme="${otherTheme}"]`).click();
                const selected = wallpapers.at(-1);
                if (await wallpaper.evaluate(element => element.value) !== selected ||
                    !(await preview.evaluate(element => getComputedStyle(element).backgroundImage)).includes(`${selected}-`)) {
                    fail('Changing theme also changed the wallpaper');
                }
                await page.locator(`[data-ui-theme="${theme}"]`).click();
                await chooseWallpaper(original);
            }
            if (name === 'whats-new-notice') {
                await page.getByRole('button', { name: 'Full changelog in Settings' }).click();
                await page.locator('#settings-whats-new').waitFor();
                const focused = await page.locator('#settings-whats-new').evaluate(history =>
                    history === document.activeElement && !history.closest('[hidden]') && !document.querySelector('[data-release-notes][open]'));
                if (!focused) fail('Details must close the sheet and focus the release history in Settings');
                await page.evaluate(() => window.closeSettings());
            }
            if (name === 'inventory-parts') {
                const parts = await page.locator('#inventory-parts .lb-inventory-parts').evaluateAll(rows => rows.map(row => ({
                    rarity: row.dataset.rarity,
                    art: row.querySelector('img')?.getAttribute('src'),
                    quantity: row.querySelector('.lb-collection-quantity')?.textContent,
                    use: row.querySelector('[data-use-parts]')?.dataset.useParts,
                    exchange: row.querySelector('[data-exchange-parts]')?.dataset.exchangeParts ?? null,
                })));
                const rarities = ['common', 'rare', 'epic', 'legendary', 'mythic'];
                if (parts.length !== rarities.length || !parts.every((part, index) => {
                    const rarity = rarities[index];
                    return part.rarity === rarity && part.art === `assets/ui/parts/universal-${rarity}.webp` && part.use === rarity
                        && part.exchange === (rarity === 'mythic' ? null : rarity) && part.quantity === `${[13, 6, 4, 2, 1][index]} owned`;
                })) fail('Parts locker must show five separate rarity balances with upward-only exchange');
            }
            if (name === 'universal-parts') {
                const allocation = await page.locator('#uni-modal-overlay').evaluate(dialog => {
                    const rows = [...dialog.querySelectorAll('.lb-exchange-row')];
                    const materials = rows.map(row => row.querySelector('img')?.getAttribute('src'));
                    return dialog.querySelector('#uni-title')?.textContent === 'Rare Universal Parts'
                        && materials.includes('assets/ui/parts/part-rune.webp') && materials.includes('assets/ui/parts/part-scroll.webp')
                        && dialog.querySelector('#uni-inc-outline') && !dialog.querySelector('#uni-inc-obsidian-carved');
                });
                if (!allocation) fail('Rare universal parts must apply to Common and Rare items with their own materials');
            }
            if (name === 'universal-exchange') {
                const exchange = await page.locator('#uni-xch-overlay').evaluate(dialog => ({
                    spent: dialog.querySelector('#uni-xch-count')?.textContent,
                    received: dialog.querySelector('#uni-xch-receive')?.textContent,
                    rarities: [...dialog.querySelectorAll('.lb-exchange-item')].map(card => card.dataset.rarity),
                }));
                if (exchange.spent !== '4' || exchange.received !== '+1' || exchange.rarities.join() !== 'common,rare') {
                    fail('Exchange preview must show 4 Common parts for 1 Rare part');
                }
            }
            if (['missions', 'missions-weekly', 'stats', 'achievements', 'settings-notifications'].includes(name)) {
                const hasDayStreak = await page.evaluate(() => /\b(?:daily streak|day streak|streak reminder|days in a row|consecutive days)\b/i.test(document.body.innerText));
                if (hasDayStreak) fail('Day-streak copy must not appear');
            }
            if (['missions', 'missions-weekly', 'achievements'].includes(name)) {
                const isAchievements = name === 'achievements';
                const header = page.locator(`${isAchievements ? '#achievements-overlay' : '#missions-overlay'} > [data-lb-topbar]`);
                const art = await header.evaluate((element, isAchievements) => {
                    const style = getComputedStyle(element, '::before');
                    const bandHeight = document.querySelector('.lb-top-band').getBoundingClientRect().height;
                    return style.backgroundImage.includes(isAchievements ? 'stats-archive-calm.webp' : 'missions-outpost.webp')
                        && style.backgroundPositionY.endsWith('52%') && style.backgroundSize.endsWith('cover')
                        && parseFloat(style.top) === bandHeight
                        && element.getBoundingClientRect().height - bandHeight === (isAchievements ? 92 : 75);
                }, isAchievements);
                if (!art) fail('Header must use the r35 art and crop below the shared band');
            }
            if (name === 'achievements') {
                const singleColumn = await page.locator('.ach-records').evaluateAll(lists =>
                    lists.length > 0 && lists.every(list => {
                        const rows = [...list.children].map(row => row.getBoundingClientRect());
                        return rows.every((row, index) => row.height > 0 && (!index ||
                            (Math.abs(row.left - rows[0].left) <= 1 && row.top >= rows[index - 1].bottom - 1)));
                    }));
                if (!singleColumn) fail('Achievements must have one record per line');
                const music = page.locator('[data-ach-id="music_listener"]');
                const readyRow = music.locator('..');
                await music.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
                const claim = readyRow.getByRole('button', { name: /Claim In the Zone/ });
                if (await page.locator('#ach-claims, .ach-pending-toggle').count() ||
                    !await claim.isVisible() || await music.locator('.ach-register-pips, .ach-card-state').count()) {
                    fail('Ready achievement tiers must replace the row counters with a Claim button');
                }
                await capture?.('achievement-ready');
                await claim.click();
                const toast = page.locator('#ach-claim-toast');
                await toast.filter({ hasText: /Added 1×\s+Rare crate to your Inventory/ }).waitFor({ state: 'visible' });
                const bottomToast = await toast.evaluate(element => {
                    const bounds = element.getBoundingClientRect();
                    const art = element.querySelector('img');
                    return innerHeight - bounds.bottom <= 20 && art?.naturalWidth > 0 && art.width <= 16;
                });
                if (!bottomToast || await page.locator('#lb43-crate-banner').textContent() ||
                    !await music.locator('.ach-register-pips').count()) {
                    fail('Claiming must restore progress and show one small bottom toast');
                }
                await capture?.('achievement-toast');
                await toast.waitFor({ state: 'hidden', timeout: 3000 });
                const tierRows = await page.locator('#ach-list [data-ach-id]').evaluateAll(rows => {
                    const games = rows.find(row => row.dataset.achId === 'games');
                    return new Set(rows.map(row => row.dataset.achId)).size === rows.length
                        && games?.querySelector('svg[aria-label="Bronze earned"]')
                        && games.querySelectorAll('.ach-register-pips svg').length === 5
                        && rows.every(row => /^assets\/ui\/achievements\/ach-.*\.webp$/.test(row.querySelector('img.ach-voxel')?.getAttribute('src')))
                        && games.querySelectorAll('progress').length === 1;
                });
                if (!tierRows) fail('Tiered goals must have one row and one next-tier meter');
                const register = await page.locator('#achievements-overlay .lb-scroll-fade').evaluate(scroll =>
                    getComputedStyle(scroll).backgroundImage.includes('stats-archive-calm.webp')
                    && getComputedStyle(scroll.querySelector('.ach-group')).backgroundImage.startsWith('linear-gradient('));
                if (!register) fail('The achievement register must use vellum pages over the archive backdrop');
                const games = page.locator('[data-ach-id="games"]');
                await games.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                await games.click();
                const tiers = await page.locator('#ach-tip').evaluate(tip => !tip.hidden
                    && tip.textContent.includes('Play 10 games') && tip.textContent.includes('100')
                    && tip.querySelector('.ach-detail-icon')?.naturalWidth > 0 && tip.querySelectorAll('progress').length === 1
                    && [...tip.querySelectorAll('.ach-tip-reward')].map(line => line.textContent).join() === 'Reward: +200 XP'
                    && tip.querySelectorAll('svg[data-locked="true"]').length === 4
                    && tip.querySelector('svg[aria-label="Platinum locked"]') && tip.querySelector('svg[aria-label="Diamond locked"]'));
                if (!tiers) fail('Achievement detail must show the tier ladder, next-tier progress, and earned rewards');
                await games.click();
                await page.locator('#achievements-overlay .lb-scroll-fade').evaluate(content => { content.scrollTop = 0; });
            }
            if (name === 'playlist') {
                const deck = await page.locator('#playlist-overlay').evaluate(overlay => {
                    const channels = color => color.match(/[\d.]+/g).map(Number);
                    const [red, green, blue] = channels(getComputedStyle(overlay.querySelector('#pl-mini-widget')).backgroundColor);
                    const title = getComputedStyle(overlay.querySelector('#pl-mw-title')).color;
                    const rows = [...overlay.querySelectorAll('.lb-playlist-row')].slice(0, 3);
                    const rowColors = rows.map(row => getComputedStyle(row).backgroundColor);
                    const tools = getComputedStyle(overlay.querySelector('.lb-playlist-tools'));
                    const columns = getComputedStyle(overlay.querySelector('.lb-playlist-columns'));
                    return red > 170 && red < green && green < blue && channels(title).every(channel => channel < 100)
                        && tools.borderBottomWidth === '0px' && columns.borderTopWidth === '0px'
                        && rows.length === 3 && rowColors[0] !== rowColors[1] && rowColors[0] === rowColors[2]
                        && rows.every(row => row.getBoundingClientRect().height >= 47);
                });
                if (!deck) fail('Track Ledger must have a blue deck, no header separator, and alternating rows');
                const sticky = await page.locator('#playlist-panel-content').evaluate(scroller => {
                    const columns = scroller.querySelector('.lb-playlist-columns');
                    const check = scroller.querySelector('.lb-playlist-check');
                    const top = columns.getBoundingClientRect().top;
                    scroller.scrollTop = 140;
                    const pinned = scroller.scrollTop > 0 && Math.abs(columns.getBoundingClientRect().top - top) <= 1;
                    scroller.scrollTop = 0;
                    return pinned && check.getBoundingClientRect().height >= 44 && check.firstElementChild.getBoundingClientRect().width <= 26;
                });
                if (!sticky) fail('Playlist columns must stay pinned above compact checkboxes and full-size touch targets');
                const firstRow = page.locator('.lb-playlist-row').first();
                for (const column of ['menu', 'game']) {
                    const toggle = firstRow.locator(`[data-playlist="${column}"]`);
                    const initial = await toggle.getAttribute('aria-pressed');
                    if (initial !== 'true') await toggle.click();
                    const checked = await toggle.evaluate((button, column) => {
                        const tick = getComputedStyle(button.querySelector('svg'));
                        const [red, green, blue] = tick.color.match(/[\d.]+/g).map(Number);
                        return button.getAttribute('aria-pressed') === 'true' && tick.visibility === 'visible'
                            && (column === 'menu' ? green > red && green > blue : blue > red && blue > green);
                    }, column);
                    if (!checked) fail(`Wrong checked mark for the ${column} column`);
                    await toggle.click();
                    if (await toggle.locator('svg').evaluate(tick => getComputedStyle(tick).visibility) !== 'hidden') {
                        fail(`Unchecked ${column} mark is visible`);
                    }
                    if (initial === 'true') await toggle.click();
                }
            }
            if (name === 'help') {
                const topics = page.locator('[aria-controls="help-topic-list"]');
                await topics.click();
                if (await page.locator('#help-topic-list button:visible').count() !== 9) fail('Help must open a single list of topics');
                const compactIcons = await page.locator('#help-topic-list .lb-metric-icon').evaluateAll(icons => icons.every(icon => {
                    const rect = icon.getBoundingClientRect();
                    const row = icon.closest('button').getBoundingClientRect();
                    return rect.width <= 20 && rect.top >= row.top && rect.bottom <= row.bottom;
                }));
                if (!compactIcons) fail('Help topic icons must stay within their own rows');
                await capture?.('help-topics');
                await page.locator('#help-topic-list [data-help-jump="ranks"]').click();
                if (await page.locator('[data-help-topic]:visible').count() !== 1 || !await page.locator('[data-help-topic="ranks"]').isVisible()) {
                    fail('Picking a Help topic must show just that topic');
                }
            }
            if (name === 'menu') {
                if ((await page.locator('#mw-info .lb-block-kicker').textContent()).trim() !== 'Music') {
                    fail('Music widget is missing its stacked label');
                }
                const forestEdge = await page.getByRole('button', { name: 'Play', exact: true }).evaluate(button => {
                    const style = getComputedStyle(button);
                    return !button.querySelector('.lb-ledger-chevron') && style.backgroundImage.startsWith('linear-gradient(')
                        && style.backgroundImage.includes('/bg/') && style.boxShadow.includes('inset');
                });
                if (!forestEdge) fail('PLAY must show scrimmed Forest Edge art without a chevron');
                const menuArt = await page.evaluate(() => {
                    const allowed = ['player-rank', 'play', 'missions', 'inventory', 'achievements', 'settings', 'stats'];
                    const elements = allowed.map(key => document.getElementById(`btn-${key}`));
                    const selected = [...document.querySelectorAll('#menu-overlay [data-menu-art]')];
                    return selected.length === elements.length && selected.every(tile => elements.includes(tile)) && elements.every(tile => {
                        const id = tile.dataset.menuArt;
                        const face = getComputedStyle(tile).backgroundImage;
                        if (!id) return false;
                        if (tile.id === 'btn-play') {
                            const crop = matchMedia('(min-aspect-ratio: 1/1)').matches ? 'landscape' : 'portrait';
                            const filename = `${id.slice('wallpaper-'.length)}-${crop}.jpg`;
                            return id.startsWith('wallpaper-') && face.includes(filename);
                        }
                        return face.includes(`/tiles/${id}.webp`);
                    });
                });
                if (!menuArt) fail('Every illustrated menu element must show its assigned artwork');
                const navigationFits = await page.locator('#menu-overlay .lb-menu-art-tile').evaluateAll(rows => rows.length === 5 && rows.every(row => {
                    const hadNotification = row.hasAttribute('data-ready');
                    row.removeAttribute('data-ready');
                    const idle = !row.querySelector('.lb-ledger-chevron') && getComputedStyle(row, '::after').content !== '""';
                    row.setAttribute('data-ready', '');
                    const frame = getComputedStyle(row, '::after');
                    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
                    const ready = frame.content === '""' && frame.position === 'absolute' && frame.boxShadow.includes('inset')
                        && Math.abs(parseFloat(frame.width) - row.offsetWidth) <= 2
                        && frame.maskImage === 'none' && frame.transform === 'none'
                        && frame.animationName === (reducedMotion ? 'none' : 'lb-ready-ambient');
                    row.toggleAttribute('data-ready', hadNotification);
                    return idle && ready;
                }));
                if (!navigationFits) fail('Menu tiles must have no chevrons and show a full-width, motion-aware readiness frame');
                const menuDesign = await page.evaluate(() => {
                    const box = selector => document.querySelector(selector).getBoundingClientRect();
                    const clipped = selector => getComputedStyle(document.querySelector(selector)).clipPath.startsWith('polygon(');
                    const banner = box('.lb-menu-banner');
                    const logo = box('#lb122-logo-button');
                    const sticker = box('#splash-quote');
                    return clipped('.lb-xp-track') && clipped('.lb-xp-fill') && clipped('#splash-quote')
                        && logo.top - banner.top < banner.height / 3 && logo.bottom <= sticker.top
                        && Math.abs(sticker.right - banner.right) <= 1 && sticker.bottom < banner.bottom;
                });
                if (!menuDesign) fail('Menu banner or cut XP bar does not match the r9 treatment');
                const fits = await page.evaluate(() => {
                    const wrapper = document.querySelector('#menu-overlay .menu-scale-wrapper');
                    const logoFrame = document.querySelector('.lb-menu-banner').getBoundingClientRect();
                    const stats = document.querySelector('#btn-stats').getBoundingClientRect();
                    const player = document.querySelector('#music-widget').getBoundingClientRect();
                    const near = (first, second) => Math.abs(first - second) <= 1;
                    return wrapper.scrollHeight <= wrapper.clientHeight && wrapper.scrollWidth <= wrapper.clientWidth
                        && player.bottom <= wrapper.getBoundingClientRect().bottom && player.top > stats.bottom
                        && near(stats.left, logoFrame.left) && near(stats.right, logoFrame.right)
                        && near(player.left, stats.left) && near(player.right, stats.right);
                });
                if (!fits) fail('Stats and the music player must span the menu content with no overflow');
                if (await page.locator('#menu-overlay #btn-season-pass').count()) fail('Season Pass is still on the main menu');
                await page.locator('#btn-missions').click();
                const seasonCard = page.locator('#missions-overlay .mq-board-controls + #btn-season-pass');
                await seasonCard.click();
                await page.locator('#season-pass-overlay').waitFor({ state: 'visible', timeout: 3000 })
                    .catch(() => fail('Season Pass card did not open the Season Pass view'));
                await page.getByRole('button', { name: 'Back to Missions' }).click();
                if (!await seasonCard.evaluate(card => card === document.activeElement)) fail('Season Pass back button did not restore card focus');
                await page.locator('#mq-menu').click();
            }
            if (name === 'daily-gift') {
                const notice = page.locator('#daily-gift-notice');
                const claim = notice.getByRole('button', { name: 'Claim' });
                const name = notice.locator('#daily-gift-crate-name');
                const gift = await name.textContent();
                const menuLayout = () => page.locator('.lb-menu-banner, #btn-stats, #music-widget')
                    .evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
                const beforeClaim = await menuLayout();
                const noticeFits = await notice.evaluate(panel => {
                    const rect = panel.getBoundingClientRect();
                    const banner = panel.closest('.lb-menu-banner');
                    const frame = banner.getBoundingClientRect();
                    const logo = banner.querySelector('.lb122-logo').getBoundingClientRect();
                    const band = document.querySelector('.lb-top-band').getBoundingClientRect();
                    const near = (a, b) => Math.abs(a - b) <= 1;
                    return near(rect.left, frame.left) && near(rect.right, frame.right) && near(rect.top, frame.top)
                        && rect.top >= band.bottom && rect.bottom <= logo.top
                        && panel.querySelector('img').naturalWidth > 0 && /^(Common|Rare|Epic) crate$/.test(panel.querySelector('span').textContent);
                });
                if (!noticeFits) fail('Daily Gift must align with the frame and clear the logo and ribbon');
                await page.evaluate(() => window.__LB_QA.open('inventory'));
                const total = page.locator('.lb43-locker-total');
                const before = Number.parseInt(await total.textContent(), 10);
                await page.evaluate(() => window.__LB_QA.open('menu'));
                if (!await notice.isVisible() || await name.textContent() !== gift) fail('Daily Gift changed during menu navigation');
                await claim.click();
                await notice.waitFor({ state: 'hidden' });
                if (JSON.stringify(await menuLayout()) !== JSON.stringify(beforeClaim)) fail('Claim moved the menu layout');
                if (!await page.locator('#btn-inventory').evaluate(button => button.hasAttribute('data-ready'))) fail('Inventory lacks its crate marker');
                await capture?.('daily-gift-claimed');
                await page.evaluate(() => window.__LB_QA.open('inventory'));
                await page.waitForFunction(expected => Number.parseInt(document.querySelector('.lb43-locker-total').textContent, 10) === expected, before + 1);
                if (!(await page.locator('#inventory-gift-status').textContent()).includes('Next in')) fail('Inventory lacks the next-gift countdown');
                await page.evaluate(() => window.__LB_QA.open('menu'));
                if (await notice.isVisible()) fail('Claimed gift reappeared after navigation');
            }
            if (name === 'game') {
                const speedStrip = await page.locator('.lb-hud-level').evaluate(tile => {
                    const status = tile.querySelector('[role="status"]');
                    const caret = tile.querySelector('.lb-hud-speed-caret');
                    const digits = tile.querySelector('#lb-hud-speed-values');
                    const [, previous, current, next] = digits.children;
                    const center = element => {
                        const rect = element.getBoundingClientRect();
                        return rect.left + rect.width / 2;
                    };
                    const clear = 'rgba(0, 0, 0, 0)';
                    const caretStyle = getComputedStyle(caret);
                    return status.textContent === 'Speed 1' && digits.getAttribute('aria-hidden') === 'true'
                        && previous.textContent === '' && current.textContent === '1' && next.textContent === '2'
                        && Math.abs(center(current) - center(caret)) <= 1 && center(next) > center(current)
                        && caret.getBoundingClientRect().bottom <= current.getBoundingClientRect().top
                        && current.getBoundingClientRect().height > next.getBoundingClientRect().height
                        && Number(getComputedStyle(next).opacity) < Number(getComputedStyle(current).opacity)
                        && getComputedStyle(digits).backgroundColor === clear && getComputedStyle(digits).backgroundImage === 'none'
                        && caretStyle.backgroundImage === 'none' && caretStyle.backgroundColor !== clear && !tile.querySelector('progress');
                });
                if (!speedStrip) fail('HUD must show an unboxed rolling speed strip under one solid caret');
            }
            if (name === 'game' && viewport.width <= 600 && viewport.width < viewport.height) {
                const alignedHud = await page.evaluate(() => {
                    const box = selector => document.querySelector(selector).getBoundingClientRect();
                    const near = (first, second) => Math.abs(first - second) <= 1;
                    const board = box('#game-container');
                    const tiles = ['#pc-next-wrap', '.lb-hud-score', '.lb-hud-lines', '.lb-hud-time'].map(box);
                    const speed = box('.lb-hud-level');
                    const pause = box('.btn-pause-pc');
                    const hold = box('#hold-panel');
                    const topBuffer = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lb-space-sm'));
                    return board.width > 0 && near(board.left, tiles[0].left) && near(board.right, tiles[3].right)
                        && tiles[0].top >= box('.lb-top-band').bottom + topBuffer - 1
                        && tiles.every(tile => near(tile.width, tiles[0].width) && near(tile.top, tiles[0].top) && tile.bottom < board.top)
                        && [speed, pause, ...(hold.width > 0 ? [hold] : [])].every(tile =>
                            near(tile.top, speed.top) && tile.top >= board.bottom)
                        && near(speed.left, tiles[2].left) && near(speed.right, pause.left)
                        && near(speed.width, pause.width) && near(pause.right, tiles[3].right)
                        && box('#pc-next-canvas').width >= 40 && box('#pc-next-canvas').bottom <= tiles[0].bottom
                        && (hold.width === 0 || near(hold.left, tiles[1].left));
                });
                if (!alignedHud) fail('Phone HUD columns do not align to the board or preserve the top buffer');
            }
            if (name === 'game' && viewport.width >= 800) {
                const adjacent = await page.locator('.portrait-right').evaluate(panel => {
                    const speed = panel.querySelector('.lb-hud-level').getBoundingClientRect();
                    const pause = panel.querySelector('.btn-pause-pc').getBoundingClientRect();
                    return Math.abs(speed.left - pause.left) <= 1 && pause.top >= speed.bottom && pause.top - speed.bottom <= 12;
                });
                if (!adjacent) fail('Desktop level and Pause should share the same column without an empty row');
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
                const base = page.locator('#go-xp-amount');
                const bonus = page.locator('#go-xp-bonus');
                const xpBefore = await base.textContent();
                if (await bonus.isVisible()) fail('Bonus XP must only show after using a booster');
                if (await page.locator('#go-overlay :is(.go-reward-ledger, .go-ach-card, .result-retry, .result-pin, .result-menu) .lb-ledger-chevron').count()) {
                    fail('Run reward rows and primary actions must have no chevrons');
                }
                const boosters = page.locator('.go-boost-list button');
                await boosters.first().click();
                if (await boosters.count() !== await page.locator('.go-boost-list button:disabled').count()
                    || !await page.locator('.go-boost-list [data-used] .go-booster-used').isVisible()) {
                    fail('Used boosters must stay marked and lock all booster buttons');
                }
                const shortcut = page.locator('#go-overlay .lb-scroll-top:visible');
                if (await shortcut.count() && !await shortcut.evaluate(button => {
                    const rect = button.getBoundingClientRect();
                    const scroller = document.querySelector('.go-dialog-body');
                    const pane = scroller.getBoundingClientRect();
                    return scroller.scrollHeight > scroller.clientHeight * 2.5 && rect.right <= pane.right - 16 && rect.bottom <= pane.bottom;
                })) fail('Results scroll shortcut must clear the scrollbar and the run actions');
                await page.waitForFunction(() => /^\+[1-9]/.test(document.getElementById('go-xp-bonus').textContent));
                if (!await bonus.isVisible() || await base.textContent() !== xpBefore) fail('The booster bonus must appear below the base XP');
                await capture?.('game-over-used');
                const viewBoard = page.locator('#go-view-board');
                if (await viewBoard.locator('.lb-ledger-chevron').count()) fail('View board still shows a chevron');
                if (await page.locator('.go-rewards-heading').evaluate(el => ['dashed', 'dotted'].includes(getComputedStyle(el).borderBottomStyle))) {
                    fail('Run rewards has a dashed or dotted divider');
                }
                await viewBoard.click();
                const finalFits = await page.locator('#final-board').evaluate(board => {
                    const box = board.getBoundingClientRect();
                    return box.top >= document.querySelector('#final-board-overlay header').getBoundingClientRect().bottom
                        && box.bottom <= innerHeight && Math.abs((box.left + box.right) / 2 - innerWidth / 2) <= 1;
                });
                if (!finalFits) fail('Final board does not fit or center below its header');
                await capture?.('final-board');
                await page.locator('#final-board-back').click();
                if (!await viewBoard.evaluate(button => document.activeElement === button)) fail('Back must return focus to View board');
            }
            if (name === 'missions' || name === 'missions-weekly') {
                const deck = page.locator('#missions-body');
                const card = deck.locator('.mq-focus-card');
                const steps = deck.locator('.mq-focus-step');
                const active = deck.locator('.mq-focus-step[aria-pressed="true"]');
                const shape = () => deck.locator('.mq-focus-card, .mq-focus-steps')
                    .evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
                const layout = await deck.evaluate((body, period) => {
                    const view = body.closest('#mq-mission-view');
                    const milestones = view.querySelector('.mq-board');
                    const selected = view.querySelector('.mq-board-controls [aria-pressed="true"][data-tab]');
                    const info = milestones.querySelector('.lb-info-btn').getBoundingClientRect();
                    const title = milestones.querySelector('#mq-board-title').getBoundingClientRect();
                    const points = milestones.querySelector('.mq-pb-points').getBoundingClientRect();
                    const count = document.querySelector('.mq-header #mq-list-meta').textContent;
                    const focus = body.querySelector('.mq-focus-card');
                    const art = focus.querySelector('img').getBoundingClientRect();
                    const active = body.querySelector('.mq-focus-step[aria-pressed="true"]');
                    const steps = [...body.querySelectorAll('.mq-focus-step')];
                    return selected?.dataset.tab === period
                        && selected.getBoundingClientRect().bottom <= milestones.getBoundingClientRect().top
                        && milestones.querySelector('time').dateTime && milestones.querySelector('progress')
                        && /mission-(forest-outpost|map-room)\.webp/.test(getComputedStyle(milestones).backgroundImage)
                        && title.right <= info.left && info.right <= points.left
                        && /\d+ \/ \d+ complete/.test(count)
                        && view.scrollHeight <= view.clientHeight + 1
                        && body.querySelectorAll('.mq-focus-card').length === 1
                        && art.width >= 70 && Math.abs(art.width - art.height) < 1
                        && focus.querySelector('img').naturalWidth > 0 && /\+\d+ SP/.test(focus.textContent)
                        && steps.length === Number(count.match(/\/ (\d+)/)?.[1])
                        && active?.dataset.state === 'Ready to claim'
                        && steps.every(step => {
                            const rect = step.getBoundingClientRect();
                            const caption = step.querySelector('span');
                            const label = caption.getBoundingClientRect();
                            const expected = { 'Ready to claim': 'Ready', Claimed: 'Done', Hidden: 'Hidden' }[step.dataset.state];
                            return rect.top === active.getBoundingClientRect().top
                                && label.left >= rect.left && label.right <= rect.right
                                && (expected ? caption.textContent === expected : /^\d{1,3}%$/.test(caption.textContent));
                        });
                }, name === 'missions' ? 'daily' : 'weekly');
                if (!layout) fail('Mission milestones or Focus deck did not fit with all objective steps on one row');
                const index = await active.getAttribute('data-step');
                const title = await card.locator('h3').textContent();
                await deck.locator(`.mq-focus-step:not([data-step="${index}"])`).first().click();
                if (await active.getAttribute('data-step') === index) fail('Tapping a step did not switch objectives');
                await steps.nth(Number(index)).click();
                const before = await shape();
                await card.getByRole('button', { name: /^Claim / }).click();
                await card.getByText('Claimed', { exact: true }).waitFor();
                if (await card.locator('h3').textContent() !== title || await active.getAttribute('data-step') !== index
                    || JSON.stringify(await shape()) !== JSON.stringify(before)) fail('Claim changed the focused objective or reflowed the deck');
                const markersAligned = await page.evaluate(() => {
                    const meter = document.querySelector('.mq-milestone-meter');
                    const track = meter.querySelector('progress').getBoundingClientRect();
                    return [...meter.querySelectorAll('.mq-ms-crate')].every(crate => {
                        const bounds = crate.getBoundingClientRect();
                        const stop = parseFloat(crate.parentElement.style.getPropertyValue('--mq-stop')) / 100;
                        return Math.abs(bounds.top + bounds.height / 2 - track.top - track.height / 2) < 1
                            && Math.abs(bounds.left + bounds.width / 2 - track.left - stop * track.width) < 1;
                    });
                });
                if (!markersAligned) fail('Milestone chests must be centred on the progress line at their threshold stops');
            }
            if (name === 'season-pass') {
                const track = await page.evaluate(() => {
                    const screen = document.getElementById('season-pass-overlay');
                    const rail = screen.querySelector('.sp-track');
                    const next = rail.querySelector('[aria-current="step"]');
                    const end = rail.querySelector('[data-stage="30"]');
                    const month = window.LBSeason.seasonWindow(Date.now());
                    const meter = screen.querySelector('.sp-meter-segments');
                    const [first, second] = [...meter.children].map(segment => segment.getBoundingClientRect());
                    return !screen.hidden && rail.querySelectorAll('.sp-card[data-rarity]').length === 30
                        && rail.scrollHeight > rail.clientHeight && rail.scrollWidth <= rail.clientWidth + 1
                        && meter.childElementCount === month.days && first?.width > 0 && second.left > first.right
                        && next?.querySelector('.sp-step')?.textContent === next?.dataset.stage.padStart(2, '0')
                        && end?.querySelector('h3')?.textContent.includes('Season Prism')
                        && screen.querySelector('#sp-day')?.textContent === `Day ${month.day} / ${month.days}`;
                });
                if (!track) fail('Season Pass is missing the next-stage meter or rarity-labelled rewards');
            }
        }
        if (names.includes('inventory')) {
            screen = 'inventory-crate-interaction';
            await page.evaluate(() => window.__LB_QA.open('inventory'));
            const openMythic = page.getByRole('button', { name: 'Open mythic crate' });
            await page.locator('.lb43-locker-card').filter({ has: openMythic }).locator('img').click();
            const reveal = page.locator('#inventory-crate-overlay');
            const total = page.locator('.lb43-locker-total');
            const before = Number.parseInt(await total.textContent(), 10);
            if (await reveal.count()) fail('Clicking crate art must not open a crate');
            await openMythic.click();
            await page.waitForFunction(expected => Number.parseInt(document.querySelector('.lb43-locker-total').textContent, 10) === expected, before - 1);
            const auraFits = await reveal.locator('.lb43-crate-sprite').evaluate(sprite => {
                const title = sprite.closest('.lb64-crate-panel').querySelector('h2').getBoundingClientRect();
                const art = sprite.getBoundingClientRect();
                const shine = sprite.querySelector('.lb43-crate-shine');
                const sideAllowance = shine.offsetWidth * .62;
                return getComputedStyle(sprite).overflow === 'visible' && art.top >= title.bottom
                    && art.left + art.width / 2 - sideAllowance >= 0
                    && art.left + art.width / 2 + sideAllowance <= innerWidth;
            });
            if (!auraFits) fail('Mythic reveal must leave room around the sprite and shine');
            await reveal.getByRole('button', { name: 'Done' }).click();
        }
        const result = { passed: names.length, total: allNames.length, viewport: `${viewport.width}×${viewport.height}` };
        if (batch && batch[1] < allNames.length) {
            if (failures.size) throw new Error([...failures].join('\n'));
            return result;
        }
        screen = 'crate-animation';
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => window.__LB_QA.open('level-crate'));
        const flight = page.locator('#inventory-crate-overlay .lb43-crate-flight').first();
        await flight.waitFor({ state: 'attached' });
        const duration = await flight.evaluate(art => getComputedStyle(art).animationDuration);
        if (duration !== '0.56s') fail('Rewards must fly for 450 ms plus a 110 ms landing pop');
        const crate = page.locator('#inventory-crate-overlay');
        await crate.click({ position: { x: 4, y: 4 } });
        const skipped = await crate.evaluate(dialog => dialog.dataset.reveal === 'revealed'
            && !dialog.querySelector('.lb43-crate-flight, .lb43-reward-pending')
            && document.activeElement?.textContent === 'Done');
        if (!skipped) fail('Tapping the backdrop must finish, not dismiss, the reveal');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
        const instant = await page.evaluate(async () => {
            await window.__LB_QA.open('level-crate');
            const dialog = document.getElementById('inventory-crate-overlay');
            return dialog?.dataset.reveal === 'revealed' && !dialog.querySelector('.lb43-crate-flight, .lb43-reward-pending');
        });
        if (!instant) fail('Reduced motion must show the result immediately');
        if (failures.size) throw new Error([...failures].join('\n'));
        return result;
    } finally {
        page.off('response', onResponse);
        page.off('console', onConsole);
        page.off('pageerror', onError);
        if (reducedMotion !== undefined) await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        if (originalViewport) await page.setViewportSize(originalViewport);
    }
})
