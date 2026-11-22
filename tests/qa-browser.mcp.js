(async (page, { viewport = { width: 390, height: 844 }, cutout, accent = 'dark', capture } = {}) => {
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
        if (accent === 'green') {
            await page.evaluate(() => window.__LB_QA.open('settings-display'));
            await page.locator('[data-ui-theme="green"]').click();
        }
        const chrome = await page.evaluate(() => {
            const band = document.querySelector('.lb-top-band');
            const rail = getComputedStyle(band, '::after');
            const root = document.documentElement;
            return {
                height: band.getBoundingClientRect().height, empty: !band.childNodes.length,
                trace: rail.clipPath.startsWith('polygon('), accent: root.dataset.lbUiTheme,
                scheme: getComputedStyle(root).colorScheme,
            };
        });
        const expectedHeight = cutout === 'notch' ? 63 : cutout === 'hole' ? 55 : cutout === undefined ? 0 : 54;
        if (chrome.height !== expectedHeight || !chrome.empty || !chrome.trace || chrome.scheme !== 'dark' || chrome.accent !== accent) {
            fail(`Unexpected Circuit band or palette: ${JSON.stringify(chrome)}`);
        }
        const names = await page.evaluate(() => window.__LB_QA.list());
        const docs = await (await page.request.get(new URL('/docs/QA-SCREENS.md', url).href)).text();
        const documented = docs.split('\n').filter(line => line.startsWith('|'))
            .flatMap(line => Array.from(line.matchAll(/`([^`]+)`/g), match => match[1]));
        if ([...names].sort().join() !== documented.sort().join()) fail('QA screen list differs from the documented targets');

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
                await search.clear();
            }
            if (name === 'menu') {
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
                await page.evaluate(() => window.closeMissions());
            }
            if (name === 'game-over') {
                const actionsFit = await page.locator('#go-overlay .go-actions').evaluate(actions => {
                    const dialog = actions.closest('.lb-block-dialog').getBoundingClientRect();
                    const footer = actions.getBoundingClientRect();
                    return footer.height >= 44 && footer.bottom <= dialog.bottom && footer.bottom <= innerHeight;
                });
                if (!actionsFit) fail('Run actions do not fit below the scrollable results');
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
                    return card?.querySelector('time')?.dateTime && selected?.dataset.tab === period
                        && rows.length === 2 && rows[0].getBoundingClientRect().left === rows[1].getBoundingClientRect().left;
                }, name === 'missions' ? 'daily' : 'weekly');
                if (!board) fail('Mission board is missing its timer, active period, or single-column cards');
            }
            if (name === 'season-pass') {
                const track = await page.evaluate(() => {
                    const screen = document.getElementById('season-pass-overlay');
                    return !screen.hidden && screen.querySelectorAll('.sp-card[data-rarity]').length === 30
                        && screen.querySelector('.sp-header progress')?.getBoundingClientRect().width > 0;
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
