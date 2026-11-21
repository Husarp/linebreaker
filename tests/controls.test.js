import { expect, it } from 'vitest';
import '../controls.js';
import '../gamepad.js';
import { loadGame } from './loader.js';

const { normalizeBindings, actionForKey, rebind } = globalThis.LBControls;
const { gamepadActions } = globalThis.LBGamepad;

it('keeps the original keyboard shortcuts and exposes empty slots for new actions', () => {
  const bindings = normalizeBindings();
  expect(bindings).toEqual({
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], soft: ['ArrowDown', 'KeyS'],
    hard: ['Space', null], cw: ['ArrowUp', 'KeyW'], ccw: [null, null],
    hold: ['KeyH', null], pause: ['Escape', 'KeyP'], restart: [null, null]
  });
  expect(actionForKey(bindings, 'KeyD')).toBe('right');
  expect(actionForKey(bindings, 'KeyR')).toBeUndefined();
  expect(actionForKey(bindings, null)).toBeUndefined();
});

it('rejects conflicts in both slots and preserves cleared and custom keys when restored', () => {
  const defaults = normalizeBindings();
  expect(rebind(defaults, 'ccw', 1, 'KeyW')).toEqual({ conflict: 'cw' });
  expect(rebind(defaults, 'left', 1, 'ArrowLeft')).toEqual({ conflict: 'left' });
  const { bindings } = rebind(defaults, 'left', 0, null);
  const changed = rebind(bindings, 'ccw', 1, 'ArrowLeft').bindings;
  const restored = normalizeBindings(JSON.parse(JSON.stringify(changed)));
  expect(restored.left).toEqual([null, 'KeyA']);
  expect(actionForKey(restored, 'ArrowLeft')).toBe('ccw');
  expect(actionForKey(defaults, 'ArrowLeft')).toBe('left');
  expect(normalizeBindings({ right: ['ArrowLeft', 'Unidentified'] }).right).toEqual([null, null]);
});

function pad(pressed = [], axis = 0, extra = {}) {
  return {
    index: 0, connected: true, mapping: 'standard', axes: [axis, 0],
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index) })), ...extra
  };
}

it('maps standard gamepad buttons and horizontal stick movement to game actions', () => {
  expect(gamepadActions(pad([0, 1, 2, 3, 4, 5, 9, 14], -0.9)))
    .toEqual(['left', 'soft', 'hard', 'cw', 'ccw', 'hold', 'pause']);
  expect(gamepadActions(pad([15]))).toEqual(['right']);
  expect(gamepadActions(pad([], 0.9))).toEqual(['right']);
  expect(gamepadActions(pad([], -0.9))).toEqual(['left']);
  expect(gamepadActions(pad([], 0.25))).toEqual([]);
  expect(gamepadActions(pad([0], 0, { mapping: '' }))).toEqual([]);
  expect(gamepadActions(pad([0], 0, { connected: false }))).toEqual([]);
});

it('maps just the D-pad and menu buttons for overlays', () => {
  expect(gamepadActions(pad([0, 1, 4, 5, 9, 12, 15], 0.9), true))
    .toEqual(['previous', 'next', 'activate', 'back', 'pause']);
  expect(gamepadActions(pad([13]), true)).toEqual(['next']);
  expect(gamepadActions(pad([14]), true)).toEqual(['previous']);
  expect(gamepadActions(pad([], -0.9), true)).toEqual([]);
});

function testLayout(game) {
  const { w } = game;
  w.HTMLElement.prototype.getClientRects = function () {
    for (let element = this; element; element = element.parentElement) {
      if (element.style.display === 'none') return [];
    }
    return [{}];
  };
}

function key(game, code, type = 'keydown', repeat = false) {
  game.w.document.dispatchEvent(new game.w.KeyboardEvent(type, { code, repeat, cancelable: true, bubbles: true }));
}

function showRun(game) {
  game.api.setup();
  game.w.document.getElementById('app').classList.add('active-game');
  game.w.document.getElementById('menu-overlay').classList.add('hidden');
}

it('warns about conflicts, saves a CCW binding, and restores both slots of just that row', async () => {
  const game = await loadGame();
  try {
    testLayout(game);
    const { document, localStorage } = game.w;
    const settings = document.getElementById('settings-overlay');
    settings.classList.remove('hidden');
    const binding = document.querySelector('button[aria-label^="Rotate CCW, secondary"]');
    const restore = document.querySelector('[aria-label="Restore default keys for Rotate CCW"]');
    const saved = () => JSON.parse(localStorage.getItem('linebreaker_settings')).keyBindings;
    expect(restore.hidden).toBe(true);
    expect(document.querySelector('.lb-controls-reset')).toBeNull();
    binding.click();
    key(game, 'KeyW');
    expect(document.querySelector('.lb-controls-status').textContent).toMatch(/already assigned to Rotate CW/);
    key(game, 'KeyZ');
    expect(saved().ccw).toEqual([null, 'KeyZ']);
    expect(binding.textContent).toBe('Z');
    expect(restore.hidden).toBe(false);

    settings.classList.add('hidden');
    showRun(game);
    const original = game.api.state.player.matrix;
    key(game, 'KeyW');
    const rotated = game.api.state.player.matrix;
    expect(rotated).not.toEqual(original);
    key(game, 'KeyW', 'keydown', true);
    expect(game.api.state.player.matrix).toEqual(rotated);
    key(game, 'KeyZ');
    expect(game.api.state.player.matrix).toEqual(original);

    settings.classList.remove('hidden');
    const primary = document.querySelector('button[aria-label^="Rotate CCW, primary"]');
    primary.click();
    key(game, 'KeyX');
    document.querySelector('button[aria-label^="Hold, primary"]').click();
    key(game, 'KeyC');
    restore.click();
    expect(saved()).toEqual({ ...normalizeBindings(), hold: ['KeyC', null] });
    expect(binding.textContent).toBe('Unbound');
    expect(restore.hidden).toBe(true);
    expect(document.activeElement).toBe(primary);
  } finally {
    game.close();
  }
});

it('clears only a conflicting slot when its key is reclaimed by a row restore', async () => {
  const bindings = { ...normalizeBindings(), left: [null, 'KeyA'], ccw: ['ArrowLeft', 'KeyZ'] };
  const game = await loadGame(true, null, null, undefined, { keyBindings: bindings });
  try {
    const { document, localStorage } = game.w;
    game.w.openSettings();
    document.querySelector('[aria-label="Restore default keys for Move left"]').click();
    const saved = JSON.parse(localStorage.getItem('linebreaker_settings')).keyBindings;
    expect(saved).toEqual({ ...normalizeBindings(), ccw: [null, 'KeyZ'] });
    expect(document.querySelector('.lb-controls-status').textContent).toContain('Reassigned keys cleared from: Rotate CCW.');
  } finally {
    game.close();
  }
});

it('opens the same Settings from the menu and pause and returns to the caller', async () => {
  const game = await loadGame();
  try {
    testLayout(game);
    const { w } = game;
    const get = id => w.document.getElementById(id);
    const settings = get('settings-overlay');
    const back = get('settings-back');
    const bindInline = button => { button.onclick = w.Function(button.getAttribute('onclick')); };
    [get('btn-settings'), get('pause-settings'), back].forEach(bindInline);
    const finishClose = () => settings.dispatchEvent(new w.Event('animationend'));
    get('btn-settings').click();
    expect(settings.classList.contains('hidden')).toBe(false);
    expect(back.textContent.trim()).toBe('Menu');
    back.click();
    finishClose();
    expect(get('menu-overlay').classList.contains('hidden')).toBe(false);

    showRun(game);
    key(game, 'Escape');
    expect(get('pause-overlay').classList.contains('hidden')).toBe(false);
    get('pause-settings').click();
    expect(get('pause-overlay').classList.contains('hidden')).toBe(true);
    expect(settings.classList.contains('hidden')).toBe(false);
    expect(back.textContent.trim()).toBe('Back');
    key(game, 'Escape');
    finishClose();
    expect(settings.classList.contains('hidden')).toBe(true);
    expect(get('pause-overlay').classList.contains('hidden')).toBe(false);
    expect(get('menu-overlay').classList.contains('hidden')).toBe(true);
    expect(w.document.activeElement).toBe(get('pause-settings'));
  } finally {
    game.close();
  }
});

it('uses shared DAS and releases held gamepad input on disconnect without stopping keyboard input', async () => {
  const game = await loadGame();
  try {
    testLayout(game);
    showRun(game);
    const { w, api } = game;
    let connected = pad([14]);
    let reads = 0;
    Object.defineProperty(w.navigator, 'getGamepads', { value: () => { reads++; return [connected]; } });
    const x = () => api.state.player.pos.x;
    const startingX = x();
    w.dispatchEvent(new w.Event('gamepadconnected'));
    expect(x()).toBe(startingX - 1);
    game.advance(160);
    api.tick(160);
    expect(x()).toBe(startingX - 2);
    key(game, 'KeyA');
    expect(x()).toBe(startingX - 2);
    connected = null;
    w.dispatchEvent(new w.Event('gamepaddisconnected'));
    const finalRead = reads;
    game.advance(50);
    expect(reads).toBe(finalRead);
    expect(x()).toBe(startingX - 3);
    key(game, 'KeyA', 'keyup');
  } finally {
    game.close();
  }
});

it('starts a fresh run when a rebound restart key is pressed from pause', async () => {
  const game = await loadGame();
  try {
    testLayout(game);
    const { document } = game.w;
    const settings = document.getElementById('settings-overlay');
    settings.classList.remove('hidden');
    document.querySelector('button[aria-label^="Restart, primary"]').click();
    key(game, 'KeyR');
    settings.classList.add('hidden');

    showRun(game);
    const pause = document.getElementById('pause-overlay');
    key(game, 'KeyP');
    expect(pause.classList.contains('hidden')).toBe(false);
    key(game, 'KeyR');
    expect(pause.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('start-animation-overlay').classList.contains('hidden')).toBe(false);
  } finally {
    game.close();
  }
});

it.each([
  ['Restart run', 'RESTART', 'start-animation-overlay'],
  ['Main menu via run results', 'QUIT', 'go-overlay'],
])('confirms the pause action %s before leaving the run', async (label, confirmLabel, destinationId) => {
  const game = await loadGame();
  try {
    testLayout(game);
    showRun(game);
    key(game, 'Escape');
    const { w } = game;
    const get = id => w.document.getElementById(id);
    const pause = get('pause-overlay');
    const confirm = get('custom-confirm');
    const actions = [...pause.querySelectorAll('.lb-run-icons button')];
    expect(actions.map(button => button.getAttribute('aria-label'))).toEqual(['Restart run', 'Settings', 'Main menu via run results']);
    expect(actions.every(button => !button.textContent.trim() && button.title && button.querySelector('svg[aria-hidden="true"]'))).toBe(true);
    const action = actions.find(button => button.getAttribute('aria-label') === label);
    const invoke = w.Function(`return ${action.getAttribute('onclick')}`);
    const respond = async (buttonId, pending) => {
      get(buttonId).click();
      confirm.querySelector('.modal-box').dispatchEvent(new w.Event('animationend'));
      await pending;
    };

    const declined = invoke();
    expect(confirm.classList.contains('hidden')).toBe(false);
    expect(get('confirm-yes').textContent).toBe(confirmLabel);
    await respond('confirm-no', declined);
    expect(pause.classList.contains('hidden')).toBe(false);
    expect(get(destinationId).classList.contains('hidden')).toBe(true);

    await respond('confirm-yes', invoke());
    expect(get(destinationId).classList.contains('hidden')).toBe(false);
  } finally {
    game.close();
  }
});

it('focuses and activates overlay buttons and handles Back without sending game actions', async () => {
  const game = await loadGame();
  try {
    testLayout(game);
    const { w, api } = game;
    showRun(game);
    const pause = w.document.getElementById('pause-overlay');
    const [resume, restart] = pause.querySelectorAll('button');
    let activations = 0;
    restart.addEventListener('click', () => activations++);
    let connected = pad([9]);
    Object.defineProperty(w.navigator, 'getGamepads', { value: () => [connected] });
    w.dispatchEvent(new w.Event('gamepadconnected'));
    expect(pause.classList.contains('hidden')).toBe(false);
    const step = (...buttons) => { connected = pad(buttons); game.advance(16); };
    const original = api.state.player;
    step(13);
    expect(w.document.activeElement).toBe(resume);
    step();
    step(13);
    expect(w.document.activeElement).toBe(restart);
    step(0);
    step(0);
    expect(activations).toBe(1);
    expect(api.state.player).toEqual(original);
    step(1);
    expect(pause.classList.contains('anim-out-down')).toBe(true);
    step(1);
    expect(api.state.player).toEqual(original);
  } finally {
    game.close();
  }
});
