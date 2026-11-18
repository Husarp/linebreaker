const sectionList = document.querySelector('#review-sections');
const navigation = document.querySelector('#review-nav');
const copyButton = document.querySelector('#review-copy');
const status = document.querySelector('#review-status');
const jsonField = document.querySelector('#review-json');
const storageKey = 'lb.visualReview.v1';
const decisions = ['Keep', 'Redesign', 'Remove'];
const choices = Object.create(null);
let saved = {};
let storageAvailable = true;
try {
    saved = JSON.parse(localStorage.getItem(storageKey)) ?? {};
} catch {
    storageAvailable = false;
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function button(text, className = '') {
    const control = element('button', `lb-btn ${className}`, text);
    control.type = 'button';
    return control;
}

function section(key, title, description, variant = '') {
    const block = element('section', 'review-section');
    block.id = key;
    const heading = element('h2', '', title);
    heading.id = `${key}-heading`;
    block.setAttribute('aria-labelledby', heading.id);
    const cards = element('div', `review-grid ${variant}`);
    block.append(heading, element('p', 'lb-muted', description), cards);
    sectionList.append(block);
    const link = element('a', '', title);
    link.href = `#${key}`;
    navigation.append(link);
    choices[key] = Object.create(null);
    return { key, cards };
}

function card(group, key, name, detail, { test = false, like = false, preview = () => {} } = {}) {
    const previous = (Object.hasOwn(saved[group.key] ?? {}, key) ? saved[group.key][key] : null) ?? {};
    const decision = decisions.map(label => label.toLowerCase()).includes(previous.decision) ? previous.decision : null;
    const value = { ...previous, name, decision, note: typeof previous.note === 'string' ? previous.note : '' };
    if (like) value.liked = previous.liked === true;
    choices[group.key][key] = value;

    const panel = element('article', 'lb-card review-card');
    panel.dataset.option = key;
    const heading = element('h3', '', name);
    const meta = element('div', 'review-meta');
    meta.append(element('code', '', key), element('small', '', detail));
    if (test) meta.append(element('span', 'lb-pill', 'Dev only'));
    panel.append(heading, meta);

    function save(patch) {
        Object.assign(value, patch);
        saved = { ...saved, [group.key]: { ...saved[group.key], [key]: value } };
        try {
            localStorage.setItem(storageKey, JSON.stringify(saved));
            storageAvailable = true;
            status.textContent = 'Choices saved on this device.';
        } catch {
            storageAvailable = false;
            status.textContent = 'Local storage unavailable. Copy your choices before closing.';
        }
    }

    preview(panel, value, save);
    const controls = element('div', 'review-controls');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', `Review ${name}`);
    const toggles = decisions.map(label => {
        const control = button(label, 'lb-btn--ghost');
        control.dataset.decision = label.toLowerCase();
        control.addEventListener('click', () => {
            save({ decision: value.decision === control.dataset.decision ? null : control.dataset.decision });
            sync();
        });
        controls.append(control);
        return control;
    });
    const star = like ? button('', 'lb-btn--ghost review-like') : null;
    if (star) {
        star.setAttribute('aria-label', `Like ${name}`);
        star.addEventListener('click', () => {
            save({ liked: !value.liked });
            sync();
        });
        controls.append(star);
    }
    function sync() {
        panel.dataset.decision = value.decision ?? '';
        toggles.forEach(control => control.setAttribute('aria-pressed', String(value.decision === control.dataset.decision)));
        if (star) {
            star.textContent = value.liked ? '★ Like' : '☆ Like';
            star.setAttribute('aria-pressed', String(value.liked));
        }
    }
    const noteLabel = element('label', 'review-note');
    const note = element('textarea', 'lb-select');
    note.rows = 2;
    note.maxLength = 400;
    note.value = value.note;
    note.setAttribute('aria-label', `Note for ${name}`);
    note.addEventListener('input', () => save({ note: note.value }));
    noteLabel.append(element('small', '', 'Review note'), note);
    panel.append(controls, noteLabel);
    group.cards.append(panel);
    sync();
}

async function fetchFile(path) {
    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response;
}

async function gamePreviews() {
    const response = await fetchFile('../index.html');
    const shell = new DOMParser().parseFromString(await response.text(), 'text/html');
    shell.querySelectorAll('script').forEach(script => script.remove());
    const base = shell.createElement('base');
    base.href = new URL('../', import.meta.url).href;
    const setup = shell.createElement('script');
    setup.textContent = `window.__LB_TEST__ = true;
        window.__LB_VISUAL_REVIEW__ = true;
        window.setInterval = window.requestAnimationFrame = () => 0;`;
    shell.head.replaceChildren(base, setup);
    const script = shell.createElement('script');
    script.src = 'app.js';
    shell.body.append(script);

    const frame = element('iframe');
    frame.hidden = true;
    frame.title = 'Linebreaker preview renderer';
    frame.srcdoc = `<!doctype html>${shell.documentElement.outerHTML}`;
    return new Promise((resolve, reject) => {
        frame.addEventListener('load', () => {
            const review = frame.contentWindow.__lb?.visualReview;
            if (review) resolve(review);
            else {
                frame.remove();
                reject(new Error('The game drawing hook did not initialize.'));
            }
        }, { once: true });
        document.body.append(frame);
    });
}

function drawing(width, height, label) {
    const canvas = element('canvas');
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label);
    const context = canvas.getContext('2d');
    context.scale(canvas.width / width, canvas.height / height);
    return { canvas, context };
}

function miniMenu(theme, title, background) {
    const menu = element('div', 'review-menu');
    const play = element('span', 'lb-btn lb-btn--primary', 'Play');
    menu.style.setProperty('--accent', theme.primary);
    menu.style.background = theme.bg;
    play.style.background = theme.btnGrad;
    play.style.borderRadius = theme.radius;
    if (background) menu.append(background);
    menu.append(element('strong', '', 'LINEBREAKER'), play, element('small', '', title));
    return menu;
}

function renderGame(review) {
    const { skins, testSkins, defaults, palettes, themes, grids, shapes, backgrounds, sfxPacks, pieces } = review.catalog;
    const partLabel = key => `${review.partCost(key)} parts to unlock`;
    const title = key => key.charAt(0).toUpperCase() + key.slice(1);
    const stack = Array.from({ length: 6 }, () => Array(10).fill(0));
    const pieceCells = (id, x, y) => pieces[id].flatMap((row, rowIndex) =>
        row.flatMap((cell, columnIndex) => cell ? [[x + columnIndex, y + rowIndex]] : []));
    const placements = [[1, 0, 4], [2, 7, 4], [3, 0, 3], [4, 4, 4], [5, 3, 2], [6, 5, 0]];
    function makeStack(placements, colors, target) {
        placements.forEach(([id, x, y], index) => pieceCells(id, x, y).forEach(([column, row]) => {
            target[row][column] = colors?.[index] ?? id;
        }));
        return target;
    }
    makeStack(placements, null, stack);
    const ghost = { id: 6, cells: pieceCells(6, 5, 2) };

    function sample(panel, label, cell, options = {}) {
        const width = 10 * cell;
        const swatches = options.swatches ?? true;
        const height = 6 * cell + (swatches ? cell + 12 : 0);
        const { canvas, context } = drawing(width, height, label);
        const redraw = colors => {
            context.clearRect(0, 0, width, height);
            review.drawSample(context, { cell, stack, ghost, ...options, swatches, colors });
        };
        panel.append(canvas);
        redraw(options.colors);
        return redraw;
    }

    const skinGroup = section('skins', 'Current block skins', 'Seven piece colours, the same 10 × 6 stack, and a ghost at both sizes.', 'review-grid--skins');
    for (const [key, name] of Object.entries(skins)) {
        card(skinGroup, key, name, key === defaults.skin ? 'Owned by default' : partLabel(key), {
            test: testSkins.includes(key),
            preview(panel) {
                const pair = element('div', 'review-specimens');
                for (const size of [24, 40]) {
                    const figure = element('figure');
                    figure.append(element('figcaption', 'lb-muted', `${size}px cells`));
                    sample(figure, `${name}: seven colours and a stack at ${size}px`, size, { skin: key });
                    pair.append(figure);
                }
                panel.append(pair);
            },
        });
    }

    const paletteGroup = section('palettes', 'Block palettes', 'All palettes are shown on the default Neon skin.');
    for (const [key, { name, free }] of Object.entries(palettes)) {
        card(paletteGroup, key, name, free ? 'Owned by default' : partLabel(key), {
            preview: panel => sample(panel, `${name} palette on Neon`, 24, { palette: key }),
        });
    }
    card(paletteGroup, '_custom_picker', 'Custom Palette', 'Own all palettes to unlock', {
        preview(panel, value, save) {
            const colors = palettes.classic.colors.map((color, index) => value.colors?.[index] ?? color);
            const redraw = sample(panel, 'Custom palette on Neon', 24, { palette: '_custom_picker', colors });
            const pickers = element('div', 'review-colors');
            colors.forEach((color, index) => {
                const picker = element('input');
                picker.type = 'color';
                picker.value = color;
                picker.setAttribute('aria-label', `Custom colour for ${'IJLOSTZ'[index]} piece`);
                picker.addEventListener('input', () => {
                    colors[index] = picker.value;
                    redraw(colors);
                    save({ colors: [...colors] });
                });
                pickers.append(picker);
            });
            panel.append(pickers);
        },
    });

    const themeGroup = section('themes', 'Colour themes', 'Background gradients and accent swatches on a mini menu.');
    for (const [key, theme] of Object.entries(themes)) {
        const name = key === 'dragon' ? 'Golden' : title(key);
        card(themeGroup, key, name, key === defaults.theme ? 'Owned by default' : partLabel(key), {
            preview: panel => panel.append(miniMenu(theme, theme.primary)),
        });
    }
    card(themeGroup, 'custom', 'Custom Color', 'Own all themes to unlock', {
        preview(panel, value, save) {
            const picker = element('input');
            picker.type = 'color';
            picker.value = value.color ?? '#ff00ff';
            picker.setAttribute('aria-label', 'Custom theme accent');
            const makeMenu = () => miniMenu({ ...themes.default, primary: picker.value, btnGrad: picker.value }, picker.value);
            let mock = makeMenu();
            picker.addEventListener('input', () => {
                const replacement = makeMenu();
                mock.replaceWith(replacement);
                mock = replacement;
                save({ color: picker.value });
            });
            const controls = element('div', 'review-colors');
            controls.append(picker);
            panel.append(mock, controls);
        },
    });

    const gridGroup = section('grids', 'Grid styles', 'The in-game grid renderer at default grid opacity.');
    for (const [key, { name, free }] of Object.entries(grids)) {
        card(gridGroup, key, name, free ? 'Owned by default' : partLabel(key), {
            preview: panel => sample(panel, `${name} grid`, 24, { grid: key, swatches: false }),
        });
    }

    const ghostGroup = section('ghosts', 'Ghost styles', 'The landing outline beneath the active T piece.');
    for (const key of ['white', 'colored']) {
        card(ghostGroup, key, `${title(key)} Ghost`, key === defaults.ghostColor ? 'Default · picker at Silver I' : `${partLabel('ghostColor')} · picker at Silver I`, {
            preview: panel => sample(panel, `${title(key)} ghost outline`, 24, { ghostColor: key, swatches: false }),
        });
    }

    const shapeGroup = section('shapes', 'Block shapes', 'The same Neon tiles clipped to each available shape.');
    for (const [key, { name }] of Object.entries(shapes)) {
        card(shapeGroup, key, name, key === defaults.blockShape ? 'Default' : 'Alternate shape', {
            preview: panel => sample(panel, `${name} blocks`, 24, { shape: key }),
        });
    }

    const sounds = {
        clear: 'Line clear', drop: 'Block placed', levelup: 'Speed up', click: 'UI click', gameover: 'Game over',
        unlock: 'Item unlocked', gift: 'Gift claimed', booster: 'Booster used', achievement: 'Achievement', rankup: 'Level up', newrank: 'New rank',
    };
    const sfxGroup = section('sfx', 'SFX packs', 'Select an event and play the game’s synthesized sound.');
    for (const [key, name] of Object.entries(sfxPacks)) {
        card(sfxGroup, key, `${name} SFX`, key === defaults.sfxPack ? 'Owned by default' : partLabel(`sfx${name}`), {
            preview(panel) {
                const controls = element('div', 'review-audio');
                const select = element('select', 'lb-select');
                select.setAttribute('aria-label', `Event for ${name} SFX`);
                for (const [sound, label] of Object.entries(sounds)) {
                    const option = element('option', '', label);
                    option.value = sound;
                    select.append(option);
                }
                const play = button('Play', 'lb-btn--ghost');
                play.setAttribute('aria-label', `Play ${name} SFX`);
                play.addEventListener('click', async () => {
                    try { await review.playSound(key, select.value); }
                    catch { status.textContent = `Could not play ${name} SFX.`; }
                });
                controls.append(select, play);
                panel.append(controls);
            },
        });
    }

    const bgGroup = section('backgrounds', 'Background styles', 'Still previews of the three falling-block densities.');
    for (const [key, name] of Object.entries({ default: 'Light', medium: 'Medium', heavy_rain: 'Heavy' })) {
        const style = backgrounds[key];
        card(bgGroup, key, name, `${style.count} falling pieces${key === 'default' ? ' · Default' : ''}`, {
            preview(panel) {
                const { canvas, context } = drawing(280, 156, `${name} background`);
                review.drawBackground(context, key, 280, 156);
                panel.append(miniMenu(themes.default, `${name} intensity`, canvas));
            },
        });
    }

    const colorGroup = section('color-modes', 'Colour modes', 'Both random options currently assign one random colour to each whole piece.');
    for (const [key, name, detail] of [
        ['fixed', 'Fixed Colours', 'Default · one colour per piece type'],
        ['randomPieceColors', 'Shuffle Colors', 'Optional · random colour per piece'],
        ['_random', 'Random Colors', 'Own all palettes to unlock'],
    ]) {
        const colors = [4, 6, 1, 7, 3, 2];
        const shuffled = key === 'fixed' ? stack : makeStack(placements, colors, stack.map(row => row.map(() => 0)));
        card(colorGroup, key, name, detail, {
            preview: panel => sample(panel, `${name} sample stack`, 24, {
                stack: shuffled, ghost: { ...ghost, id: key === 'fixed' ? ghost.id : colors.at(-1) }, swatches: false,
            }),
        });
    }
}

function renderConcepts(result) {
    const group = section('concepts', 'New skin concepts (AI)', 'Review the full concept boards and star favourites independently of your decision.', 'review-grid--concepts');
    if (result.status === 'rejected' || !result.value.length) {
        group.cards.append(element('p', 'lb-empty', 'No concept images loaded. Run node tools/build-review-manifest.mjs from the project root.'));
        return;
    }
    for (const { key, name, src, prompt } of result.value) {
        card(group, key, name, 'AI concept', {
            like: true,
            preview(panel) {
                const image = element('img');
                image.src = new URL(src, import.meta.url);
                image.alt = `${name} block skin concept board`;
                image.loading = 'lazy';
                image.decoding = 'async';
                image.addEventListener('error', () => image.replaceWith(element('p', 'lb-empty', 'Concept image unavailable.')));
                panel.append(image);
                if (prompt) panel.append(element('p', 'lb-muted', prompt));
            },
        });
    }
}

copyButton.addEventListener('click', async () => {
    const json = JSON.stringify({ version: 1, choices }, null, 2);
    try {
        await navigator.clipboard.writeText(json);
        jsonField.hidden = true;
        status.textContent = 'Choices copied as JSON.';
    } catch {
        jsonField.value = json;
        jsonField.hidden = false;
        jsonField.focus();
        jsonField.select();
        status.textContent = 'JSON selected. Copy it with your keyboard or browser menu.';
    }
});

const [game, concepts] = await Promise.allSettled([gamePreviews(), fetchFile('skins-ai.json').then(response => response.json())]);
let gameReady = game.status === 'fulfilled';
try {
    if (gameReady) renderGame(game.value);
} catch (error) {
    gameReady = false;
    console.error(error);
}
if (!gameReady) {
    sectionList.append(element('p', 'lb-empty', 'Game previews could not load. Serve the page from the project root.'));
    if (game.status === 'rejected') console.error(game.reason);
}
renderConcepts(concepts);
copyButton.disabled = !Object.keys(choices).some(key => Object.keys(choices[key]).length);
status.textContent = !storageAvailable ? 'Local storage unavailable. Copy your choices before closing.'
    : gameReady && concepts.status === 'fulfilled' && concepts.value.length ? 'Ready to review.' : 'Some previews could not load.';
