(async (page) => {
    const url = new URL('/index.html?dev&demo', page.url());
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
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(url.href);
        await page.waitForFunction(() => window.__LB_QA && document.querySelector('#loading-screen').style.display === 'none');
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
            await page.waitForTimeout(1050);
            if (name === 'menu') {
                const fits = await page.evaluate(() => {
                    const corner = document.querySelector('.lb43-gift-corner').getBoundingClientRect();
                    const player = document.querySelector('#music-widget').getBoundingClientRect();
                    const bottomInset = parseFloat(getComputedStyle(document.querySelector('#menu-overlay')).paddingBottom);
                    return corner.width > 0 && corner.right <= innerWidth - 12 && corner.bottom <= innerHeight - bottomInset + 1
                        && corner.top >= player.bottom + 6 && player.height > 0;
                });
                if (!fits) fail('Daily Gift does not fit clear of the music player and safe area');
            }
            if (name === 'missions' || name === 'missions-weekly') {
                const compact = await page.evaluate(() => {
                    const button = document.querySelector('.mq-card-action--claim .mq-pts-claim-btn');
                    if (!button) return false;
                    const { height, right } = button.getBoundingClientRect();
                    return height >= 26 && height <= 30 && Math.abs(right - button.parentElement.getBoundingClientRect().right) < 1;
                });
                if (!compact) fail('Claim button is not a 26–30px right-aligned action');
            }
        }
        if (failures.size) throw new Error([...failures].join('\n'));
        return { passed: names.length, viewport: '390×844' };
    } finally {
        page.off('response', onResponse);
        page.off('console', onConsole);
        page.off('pageerror', onError);
        if (originalViewport) await page.setViewportSize(originalViewport);
    }
})
