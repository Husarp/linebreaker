import { afterEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

let game;
afterEach(() => game?.close());

const get = id => game.w.document.getElementById(id);
const mode = name => get('mode-select-overlay').querySelector(`[data-mode="${name}"]`);
const modifier = key => get('mode-options-panel').querySelector(`[data-play-modifier="${key}"]`);
const score = () => get('mode-xp-mult-val').textContent;
const savedSettings = () => JSON.parse(game.w.localStorage.getItem('tetrisRPG_settings'));
const setXP = totalXP => game.api.setSave({ ...game.api.save, totalXP });
const finishClose = () => get('mode-select-overlay').dispatchEvent(new game.w.Event('animationend'));

it('keeps locked modifiers off and unlocks each at its previous rank', async () => {
    game = await loadGame(true, null, null, {
        optMirror: true, optNoNext: true, optGhost: true, optHold: true, opt3Next: true
    });
    setXP(9_999);
    game.w.openModeSelect();
    expect(mode('fun').disabled).toBe(true);
    expect(mode('fun').querySelector('.lb-rank-unlock-name').textContent).toBe('Silver I');
    mode('fun').click();
    expect(mode('normal').getAttribute('aria-pressed')).toBe('true');

    const locks = [
        ['optMirror', 'Silver I', '#c8d8e8'], ['optGhost', 'Silver I', '#c8d8e8'],
        ['optHold', 'Gold I', '#ffd700'], ['optNoNext', 'Emerald I', '#50c878'], ['opt3Next', 'Emerald I', '#50c878']
    ];
    for (const [key, rank, colour] of locks) {
        const row = modifier(key);
        expect(row.disabled).toBe(true);
        expect(row.textContent).toContain(`Unlocks at ${rank}`);
        expect(row.querySelector('.lb-rank-unlock-name').style.getPropertyValue('--rank-unlock-color')).toBe(colour);
        expect(row.querySelector('use').getAttribute('href')).toBe('#play-icon-lock');
        row.click();
        expect(savedSettings()[key]).toBe(false);
    }
    expect(score()).toBe('100%');

    for (const [xp, unlocked] of [[10_000, 2], [29_999, 2], [30_000, 3], [64_999, 3], [65_000, 5]]) {
        setXP(xp);
        game.w.openModeSelect();
        expect(mode('fun').disabled).toBe(false);
        expect(locks.filter(([key]) => !modifier(key).disabled)).toHaveLength(unlocked);
        expect(locks.slice(0, unlocked).every(([key]) => !modifier(key).disabled)).toBe(true);
    }
});

it('toggles the whole row, adds modifier percentages, and keeps next options exclusive', async () => {
    game = await loadGame(true, null, null, { optGhost: false });
    setXP(65_000);
    game.w.openModeSelect();

    for (const [key, label, total] of [
        ['optMirror', '+20%', '120%'], ['optNoNext', '+10%', '110%'], ['optGhost', '−20%', '80%'],
        ['optHold', '−20%', '80%'], ['opt3Next', '−10%', '90%']
    ]) {
        const input = modifier(key);
        const row = input.closest('label');
        expect(input.getAttribute('role')).toBe('switch');
        expect(row.querySelector('.lb69-modifier-score').textContent).toBe(label);
        row.querySelector('strong').click();
        expect(score()).toBe(total);
        expect(input.checked).toBe(true);
        expect(get('play-active-modifiers').firstElementChild.textContent).toBe(`${row.querySelector('strong').textContent} ${label}`);
        input.click();
        expect(input.checked).toBe(false);
        expect(score()).toBe('100%');
    }

    modifier('optMirror').click();
    modifier('optNoNext').click();
    expect(score()).toBe('130%');
    modifier('opt3Next').click();
    expect(modifier('optNoNext').checked).toBe(false);
    expect(score()).toBe('110%');
    modifier('optNoNext').click();
    expect(modifier('opt3Next').checked).toBe(false);
    expect(score()).toBe('130%');
    expect(savedSettings()).toMatchObject({ optMirror: true, optNoNext: true, opt3Next: false });

    get('play-start').click();
    const board = game.api.state.board;
    board.at(-1).fill(1);
    game.api.setBoard(board);
    expect(game.api.sweep()).toBe(true);
    game.advance(200);
    expect(game.api.state.score).toBe(13);
});

it('keeps Start and Cancel between the mode cards and the options in both modes', async () => {
    game = await loadGame();
    setXP(65_000);
    game.w.openModeSelect();

    const follows = (first, second) => !!(first.compareDocumentPosition(second) & game.w.Node.DOCUMENT_POSITION_FOLLOWING);
    for (const name of ['normal', 'fun']) {
        mode(name).click();
        expect([...get('mode-select-overlay').querySelectorAll('.lb69-mode[aria-pressed="true"]')]).toEqual([mode(name)]);
        expect(get('play-score-panel').hidden).toBe(name === 'fun');
        expect(follows(mode('fun'), get('play-start'))).toBe(true);
        expect(follows(get('play-start'), get('play-back'))).toBe(true);
        expect(follows(get('play-back'), get('mode-options-panel'))).toBe(true);
        expect(follows(get('mode-options-panel'), get('fun-mode-config'))).toBe(true);
        expect(get('play-start').closest('.lb69-panel')).toBe(mode(name).closest('.lb69-panel'));
    }
});

it('plays a custom Fun board with functional modifiers but no score modifier', async () => {
    game = await loadGame(true, null, null, { optGhost: false });
    game.api.setSave({ ...game.api.save, totalXP: 65_000, seenFunRules: true });
    game.w.openModeSelect();
    expect(get('play-board-preview').hidden).toBe(true);

    mode('fun').click();
    expect(mode('fun').getAttribute('aria-pressed')).toBe('true');
    expect(get('fun-mode-config').hidden).toBe(false);
    expect(get('play-board-preview').hidden).toBe(false);
    expect(get('play-score-panel').hidden).toBe(true);
    for (const key of ['optMirror', 'optHold', 'optGhost', 'optNoNext']) {
        expect(modifier(key).disabled).toBe(false);
        expect(modifier(key).closest('label').querySelector('.lb69-modifier-score').hidden).toBe(true);
        modifier(key).click();
        expect(modifier(key).checked).toBe(true);
    }
    for (const [field, value] of [['fun-cols', '12'], ['fun-rows', '24'], ['fun-speed', '6']]) {
        get(field).value = value;
        get(field).dispatchEvent(new game.w.Event('input', { bubbles: true }));
        expect(get(`${field}-val`).value).toBe(value);
    }
    expect(get('play-board-size').textContent).toBe('12 × 24 board');
    expect(get('play-board-preview').style.getPropertyValue('--play-cols')).toBe('12');
    expect(get('play-board-preview').style.getPropertyValue('--play-rows')).toBe('24');
    expect(JSON.parse(game.w.localStorage.getItem('tetrisRPG_funConfig'))).toEqual({ cols: 12, rows: 24, startSpeed: 6 });

    get('play-back').click();
    finishClose();
    game.w.openModeSelect();
    expect(mode('fun').getAttribute('aria-pressed')).toBe('true');
    get('play-start').click();
    expect(game.api.state.board).toHaveLength(26);
    expect(game.api.state.board[0]).toHaveLength(12);
    expect(game.api.state.level).toBe(6);
    expect(get('game-container').style.transform).toBe('scaleY(-1)');
    expect(get('pc-next-wrap').style.display).toBe('none');
    game.advance(500);
    const startX = game.api.state.player.pos.x;
    game.api.move(1);
    expect(game.api.state.player.pos.x).toBe(startX - 1);
    game.api.hold();
    expect(game.api.state.holdPiece).not.toBeNull();
    const board = game.api.state.board;
    board.at(-1).fill(1);
    game.api.setBoard(board);
    const scoreBeforeClear = game.api.state.score;
    expect(game.api.sweep()).toBe(true);
    game.advance(200);
    expect(game.api.state.score - scoreBeforeClear).toBe(20);
});

it('flashes the approved wordmark for half a second on start and restart', async () => {
    game = await loadGame(true, null, null, { theme: 'sakura' });
    const flash = get('start-animation-overlay');
    const wordmark = get('start-wordmark');
    expect(wordmark.getAttribute('src')).toBe(get('main-title').querySelector('img').getAttribute('src'));
    expect(flash.querySelector('button, #start-countdown')).toBeNull();

    const started = [];
    for (const attempt of ['start', 'restart']) {
        game.w.startGame(() => started.push(attempt));
        expect(flash.classList.contains('hidden')).toBe(false);
        expect(flash.style.getPropertyValue('--lb-theme-art-portrait')).toContain('sakura-portrait.jpg');
        game.advance(499);
        game.w.startGame(() => started.push('duplicate'));
        expect(started).not.toContain(attempt);
        expect(flash.classList.contains('hidden')).toBe(false);
        game.advance(1);
        expect(started).toContain(attempt);
        expect(flash.classList.contains('hidden')).toBe(true);
        expect(get('app').classList.contains('active-game')).toBe(true);
    }
    expect(started).toEqual(['start', 'restart']);
});

it('preserves the existing Fun selection fallback until Gold I and closes with Escape', async () => {
    game = await loadGame();
    game.w.HTMLElement.prototype.getClientRects = () => [{}];
    get('mode-select-overlay').style.zIndex = '1005';
    setXP(10_000);
    game.w.openModeSelect();
    mode('fun').click();
    expect(mode('fun').getAttribute('aria-pressed')).toBe('true');

    game.w.document.dispatchEvent(new game.w.KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }));
    expect(get('mode-select-overlay').classList.contains('anim-out-down')).toBe(true);
    finishClose();
    expect(get('mode-select-overlay').classList.contains('hidden')).toBe(true);
    game.w.openModeSelect();
    expect(mode('normal').getAttribute('aria-pressed')).toBe('true');
});

it('closes Play through the native Android Back handler', async () => {
    const handlers = new Map();
    game = await loadGame(true, null, {
        isNativePlatform: () => true,
        Plugins: {
            App: { async addListener(name, listener) { handlers.set(name, listener); } },
            Filesystem: { async readFile() { return { data: '{"totalXP":0}' }; } }
        }
    });
    get('mode-select-overlay').style.zIndex = '1005';
    game.w.openModeSelect();
    await handlers.get('backButton')();
    expect(get('mode-select-overlay').classList.contains('anim-out-down')).toBe(true);
    finishClose();
    expect(get('mode-select-overlay').classList.contains('hidden')).toBe(true);
});
