(async (page, { viewport = { width: 390, height: 844 }, cutout, theme = 'dark', capture } = {}) => {
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
    try {
        await page.setViewportSize(viewport);
        await page.goto(url.href);
        await page.waitForFunction(() => window.__LB_QA && document.querySelector('#loading-screen').style.display === 'none');
        const matchingQuotes = await page.evaluate(() => {
            const loadingQuote = document.querySelector('#loading-quote')?.textContent.trim();
            return loadingQuote && loadingQuote === document.querySelector('#splash-quote')?.textContent.trim();
        });
        if (!matchingQuotes) fail('Loading and menu do not show the same daily quote');
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
                    const header = title.closest('.lb-block-topbar');
                    const headerBounds = header.getBoundingClientRect();
                    const endControls = [...header.querySelectorAll('.lb-topbar-meta, .lb-info-btn')]
                        .filter(control => control.getClientRects().length)
                        .map(control => control.getBoundingClientRect().left);
                    return ink.left < Math.max(0, bounds.left, headerBounds.left) - 1
                        || ink.right > Math.min(innerWidth, bounds.right, headerBounds.right, ...endControls) + 1
                        || bounds.height > lineHeight + 1;
                }).map(title => title.textContent.trim());
            });
            if (squeezedTitles.length) fail(`Header titles wrap or clip at ${viewport.width}px: ${squeezedTitles.join(', ')}`);
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
                await chooseWallpaper('plain');
                if (await preview.evaluate(element => getComputedStyle(element).backgroundImage) !== 'none') fail('Plain wallpaper still shows artwork');
                if ((await banner.evaluate(element => getComputedStyle(element).backgroundImage)).includes('/bg/')) fail('Plain wallpaper still shows banner art');
                if (!(await playArt()).includes(`default-${crop}.jpg`)) fail('PLAY must still show art with a plain banner');
                const wallpapers = ['default', 'ocean', 'forest', 'fire', 'dragon', 'void', 'sunset', 'arctic', 'midnight', 'sakura'];
                for (const [index, choice] of wallpapers.entries()) {
                    await chooseWallpaper(choice);
                    if (!(await preview.evaluate(element => getComputedStyle(element).backgroundImage)).includes(`${choice}-landscape.jpg`) ||
                        !(await banner.evaluate(element => getComputedStyle(element).backgroundImage)).includes(`${choice}-${crop}.jpg`)) {
                        fail(`Wallpaper ${choice} did not update the preview and ${crop} banner`);
                    }
                    const next = wallpapers[(index + 1) % wallpapers.length];
                    const playBackground = await playArt();
                    if (!playBackground.includes(`${next}-${crop}.jpg`) || playBackground.includes(`${choice}-${crop}.jpg`)) {
                        fail(`PLAY must use the next ${crop} wallpaper when the banner shows ${choice}`);
                    }
                }
                if (await page.locator('html').getAttribute('data-lb-ui-theme') !== resolved) fail('Changing wallpaper also changed the theme');
                const otherTheme = resolved === 'dark' ? 'light' : 'dark';
                await page.locator(`[data-ui-theme="${otherTheme}"]`).click();
                if (await wallpaper.evaluate(element => element.value) !== 'ocean' ||
                    !(await preview.evaluate(element => getComputedStyle(element).backgroundImage)).includes('ocean-')) {
                    fail('Changing theme also changed the wallpaper');
                }
                await page.locator(`[data-ui-theme="${theme}"]`).click();
                await chooseWallpaper(original);
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
                    return dialog.querySelector('#uni-title')?.textContent === 'Rare Universal Parts' && rows.length > 0
                        && rows.every(row => row.querySelector('img')?.getAttribute('src') === 'assets/ui/parts/part-rune.webp')
                        && !dialog.querySelector('#uni-inc-outline');
                });
                if (!allocation) fail('Rare parts must show only Rare items with the rune material');
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
            if (name === 'achievements') {
                const singleColumn = await page.locator('.ach-records, .ach-pending-list').evaluateAll(lists =>
                    lists.length > 0 && lists.every(list => {
                        const rows = [...list.children].map(row => row.getBoundingClientRect());
                        return rows.every((row, index) => row.height > 0 && (!index ||
                            (Math.abs(row.left - rows[0].left) <= 1 && row.top >= rows[index - 1].bottom - 1)));
                    }));
                if (!singleColumn) fail('Achievements must have one record per line');
                const claims = await page.locator('.ach-pending').evaluate(section =>
                    !section.querySelector('.ach-pending-head button')
                    && [...section.querySelectorAll('.ach-pending-row')].every(row => row.querySelector('button')?.textContent === 'Claim')
                    && section.textContent.includes('Legendary crate'));
                if (!claims) fail('Pending tier rewards must have individual claims and no bulk claim');
                const tierRows = await page.locator('#ach-list [data-ach-id]').evaluateAll(rows => {
                    const games = rows.find(row => row.dataset.achId === 'games');
                    return new Set(rows.map(row => row.dataset.achId)).size === rows.length
                        && games?.querySelector('svg[aria-label="Bronze earned"]')
                        && games.querySelectorAll('progress').length === 1;
                });
                if (!tierRows) fail('Tiered goals must have one row and one next-tier meter');
                const summit = await page.locator('#achievements-overlay .lb-r17-feature').evaluate(card =>
                    getComputedStyle(card).backgroundImage.includes('summit-shrine.webp'));
                if (!summit) fail('Featured Milestones is missing Summit shrine');
                await page.locator('[data-ach-id="games"]').click();
                const earnsOnly = await page.locator('#ach-tip').evaluate(tip => !tip.hidden
                    && tip.textContent.includes('Play 10 games') && !/100|1,000/.test(tip.textContent)
                    && [...tip.querySelectorAll('.ach-tip-reward')].map(line => line.textContent).join() === 'Reward: +200 XP'
                    && tip.querySelectorAll('svg[data-locked="true"]').length === 2);
                if (!earnsOnly) fail('Achievement details must hide locked tier requirements');
                await page.locator('[data-ach-id="games"]').click();
                await page.locator('#achievements-overlay .ach-content').evaluate(content => { content.scrollTop = 0; });
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
            if (name === 'menu') {
                if ((await page.locator('#mw-info .lb-block-kicker').textContent()).trim() !== 'Music') {
                    fail('Music widget is missing its stacked label');
                }
                const forestEdge = await page.getByRole('button', { name: 'Play', exact: true }).evaluate(button => {
                    const style = getComputedStyle(button);
                    return !button.querySelector('.lb-ledger-chevron') && (button.hasAttribute('data-menu-art')
                        ? style.backgroundImage.startsWith('linear-gradient(') && style.backgroundImage.includes('/bg/') && style.boxShadow.includes('inset')
                        : style.backgroundImage === 'none');
                });
                if (!forestEdge) fail('PLAY must have a plain face when unselected and scrimmed Forest Edge art when selected, without a chevron');
                const menuArt = await page.evaluate(() => {
                    const allowed = ['player-rank', 'play', 'season-pass', 'missions', 'inventory', 'achievements', 'settings', 'stats'];
                    const elements = allowed.map(key => document.getElementById(`btn-${key}`));
                    const selected = [...document.querySelectorAll('#menu-overlay [data-menu-art]')];
                    return selected.length === 3 && selected.every(tile => elements.includes(tile)) && elements.every(tile => {
                        const id = tile.dataset.menuArt;
                        const face = getComputedStyle(tile).backgroundImage;
                        if (!id) return face === 'none';
                        if (tile.id === 'btn-play') {
                            const crop = matchMedia('(min-aspect-ratio: 1/1)').matches ? 'landscape' : 'portrait';
                            const bannerBackground = getComputedStyle(document.querySelector('.lb-menu-banner')).backgroundImage;
                            const filename = `${id.slice('wallpaper-'.length)}-${crop}.jpg`;
                            return face.includes(filename) && !bannerBackground.includes(filename);
                        }
                        return face.includes(id === 'season-pass' ? '41-season-pass-banner.webp' : `/tiles/${id}.webp`);
                    });
                });
                if (!menuArt) fail('Exactly three eligible menu elements must show their assigned art, with all other faces plain');
                const navigationFits = await page.locator('#menu-overlay button:has(> .lb-ledger-chevron)').evaluateAll(rows => rows.length >= 6 && rows.every(row => {
                    const chevron = row.querySelector('.lb-ledger-chevron');
                    const hadNotification = row.hasAttribute('data-ready');
                    row.removeAttribute('data-ready');
                    const idle = getComputedStyle(chevron).display !== 'none' && getComputedStyle(row, '::after').content !== '""';
                    row.setAttribute('data-ready', '');
                    const dot = getComputedStyle(row, '::after');
                    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
                    const ready = dot.content === '""' && parseFloat(dot.width) > 0
                        && dot.animationName === (reducedMotion ? 'none' : 'lb-menu-ready-pulse')
                        && getComputedStyle(chevron).display === 'none';
                    row.toggleAttribute('data-ready', hadNotification);
                    return idle && ready;
                }));
                if (!navigationFits) fail('Ready menu destinations must replace their chevron with a motion-aware dot');
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
                const seasonCopyFits = await page.locator('.lb-menu-season-copy').evaluate(copy => {
                    const range = document.createRange();
                    return [...copy.children].every(label => {
                        range.selectNodeContents(label);
                        const ink = range.getBoundingClientRect();
                        return ink.width > 0 && ink.right <= copy.getBoundingClientRect().right + 1
                            && label.getBoundingClientRect().height <= parseFloat(getComputedStyle(label).lineHeight) + 1;
                    });
                });
                if (!seasonCopyFits) fail('Menu Season Pass label wraps or overlaps reward art');
                await page.locator('#lb43-daily-gift').scrollIntoViewIfNeeded();
                const fits = await page.evaluate(() => {
                    const gift = document.querySelector('#lb43-daily-gift').getBoundingClientRect();
                    const stats = document.querySelector('#btn-stats').getBoundingClientRect();
                    const player = document.querySelector('#music-widget').getBoundingClientRect();
                    const near = (first, second) => Math.abs(first - second) <= 1;
                    return gift.width >= 44 && gift.height >= 44 && stats.width > gift.width && player.height > 0
                        && near(gift.top, stats.top) && near(gift.bottom, stats.bottom) && gift.right < stats.left
                        && player.top > gift.bottom && near(player.left, gift.left) && near(player.right, stats.right);
                });
                if (!fits) fail('Daily Gift must sit left of Stats, above the full-width music card');
                await page.locator('#btn-season-pass').click();
                await page.locator('#season-pass-overlay').waitFor({ state: 'visible', timeout: 3000 })
                    .catch(() => fail('Season Pass card did not open the Season Pass view'));
                await page.evaluate(() => {
                    window.closeMissions();
                    document.querySelector('#menu-overlay .menu-scale-wrapper').scrollTop = 0;
                });
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
                            near(tile.width, tiles[0].width) && near(tile.top, speed.top) && tile.top >= board.bottom)
                        && near(speed.left, tiles[0].left) && near(pause.left, tiles[3].left)
                        && (hold.width === 0 || near(hold.left, tiles[1].left));
                });
                if (!alignedHud) fail('Phone HUD columns do not align to the board or preserve the top buffer');
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
                        && /mission-(forest-outpost|map-room)\.webp/.test(getComputedStyle(card).backgroundImage)
                        && selected.getBoundingClientRect().bottom <= card.getBoundingClientRect().top
                        && /\d+ \/ \d+ complete/.test(count?.textContent) && !count.hidden
                        && rows.length === 2 && rows[0].getBoundingClientRect().left === rows[1].getBoundingClientRect().left
                        && !/\bspeed\b/i.test(document.getElementById('mq-mission-view').innerText);
                }, name === 'missions' ? 'daily' : 'weekly');
                if (!board) fail('Mission board is missing its timer, active period, or single-column cards');
                const cardDesign = await page.evaluate(() => {
                    const cards = [...document.querySelectorAll('#missions-body .mq-card')];
                    const regular = cards.filter(card => card.dataset.tier !== 'secret');
                    const colors = new Set(regular.map(card => getComputedStyle(card).backgroundColor));
                    return colors.size === new Set(regular.map(card => card.dataset.tier)).size
                        && regular.every(card => {
                            const face = getComputedStyle(card);
                            const [red, green, blue] = face.backgroundColor.match(/[\d.]+/g).map(Number);
                            const neon = card.dataset.tier === 'easy' ? green >= 230 && red < 130 && blue < 130
                                : card.dataset.tier === 'normal' ? red >= 250 && green >= 150 && blue < 100
                                : red >= 250 && green < 130 && blue > green;
                            const ink = getComputedStyle(card.querySelector('.mq-card-title')).color.match(/[\d.]+/g).map(Number);
                            return neon && face.backgroundImage.startsWith('linear-gradient(') && face.boxShadow !== 'none'
                                && ink.every(channel => channel < 65);
                        })
                        && cards.every(card => {
                            const art = card.querySelector('.mq-card-icon .mq-patch[viewBox="0 0 16 16"]')?.getBoundingClientRect();
                            const points = card.querySelector('.mq-card-icon .mq-pts');
                            return art?.width === 32 && art.height === 32 && points &&
                                points.getBoundingClientRect().top >= art.bottom && /\+\d+ SP/.test(points.textContent);
                        });
                });
                if (!cardDesign) fail('Mission cards must use readable neon difficulty faces and put SP below the icon');
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
        if (failures.size) throw new Error([...failures].join('\n'));
        return { passed: names.length, viewport: `${viewport.width}×${viewport.height}` };
    } finally {
        page.off('response', onResponse);
        page.off('console', onConsole);
        page.off('pageerror', onError);
        if (originalViewport) await page.setViewportSize(originalViewport);
    }
})
