import { afterEach, expect, it, vi } from 'vitest';
import '../color-picker.js';
import { loadGame } from './loader.js';

const { colorHistory, harmoniousPalette, hexToHsv, hsvToHex, normalizeHex } = globalThis.LBColorPicker;
const palettes = ['classic', 'greyscale', 'ice', 'pastel', 'dark', 'synthwave', 'earth', 'neon'];
const themes = ['ocean', 'forest', 'fire', 'dragon', 'void', 'sunset', 'arctic', 'midnight', 'sakura'];
let game;
afterEach(() => game?.close());

it('reports clipboard success only after the write, and handles a denied write', async () => {
  game = await loadGame();
  game.api.setup();
  const { document, navigator } = game.w;
  let finishWrite;
  const writeText = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishWrite = resolve; }))
    .mockRejectedValueOnce(new Error('Clipboard permission denied'));
  Object.defineProperty(navigator, 'clipboard', { value: { writeText } });
  game.w._openPaletteViewModal('ice');
  const copy = document.querySelector('#palette-view-modal [aria-label="Copy I hex"]');
  const activate = new game.w.Function(copy.getAttribute('onclick')).bind(copy);
  const status = () => document.getElementById('colour-copy-status');
  activate();
  expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^#[0-9a-f]{6}$/i));
  expect(status()).toBeNull();
  finishWrite();
  await vi.waitFor(() => expect(status()?.textContent).toBe('Copied!'));
  expect(status().getAttribute('role')).toBe('status');
  activate();
  await vi.waitFor(() => expect(status()?.textContent).toBe('Could not copy colour'));
  document.dispatchEvent(new game.w.Event('scroll'));
  expect(status().hidden).toBe(true);
});

async function startGame(invoke) {
  game = await loadGame(true, invoke);
  const { w } = game;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event('close'));
  };
  return w.document;
}

function edit(input, value) {
  input.value = value;
  input.dispatchEvent(new game.w.Event('input', { bubbles: true }));
}

it.each(['#000000', '#ffffff', '#777777', '#ff0000', '#00ff00', '#0000ff', '#ffcc33', '#dee1ff', '#d71af4'])('round-trips %s through HSV', hex => {
  expect(hsvToHex(hexToHsv(hex))).toBe(hex);
});

it('validates hex and keeps a bounded, distinct history with the latest colours first', () => {
  expect(normalizeHex('#AbC012')).toBe('#abc012');
  for (const invalid of ['red', 'abcdef', '#abc', '#abcdeg', '#abcdef\n', ' #abcdef', '##abcde', null, 123456]) {
    expect(normalizeHex(invalid)).toBeNull();
  }
  expect(colorHistory(['#000003', '#000004', '#000005', '#000006'], ['#ABCDEF', '#000004', '#abcdef', 'red']))
    .toEqual(['#abcdef', '#000004', '#000003', '#000005', '#000006']);
  expect(colorHistory({ 0: '#ffffff' })).toEqual([]);
});

it('generates seven distinct and coordinated colours from each harmony recipe', () => {
  for (const [recipe, offsets] of [[0, [-48, -32, -16, 0, 16, 32, 48]], [.4, [-24, 0, 24, 145, 163, 197, 215]], [.8, [-14, 0, 18, 108, 132, 225, 255]]]) {
    const random = vi.fn().mockReturnValueOnce(.25).mockReturnValueOnce(recipe);
    const colors = harmoniousPalette(random);
    expect(new Set(colors).size).toBe(7);
    colors.forEach((hex, index) => {
      expect(normalizeHex(hex)).toBe(hex);
      expect(Math.abs(hexToHsv(hex).hue - (90 + offsets[index]))).toBeLessThan(1);
    });
  }
});

it('selects the correct piece, edits only that piece, and cancels draft changes', async () => {
  const document = await startGame();
  game.w._openCustomPaletteModal();
  expect(document.querySelector('#custom-palette-modal')).toBeNull();
  const original = ['#a0a0a0', '#b0b0b0', '#c0c0c0', '#d0d0d0', '#e0e0e0', '#f0f0f0', '#ffffff'];
  game.api.setSave({ ...game.api.save, ownedPalettes: palettes, customPickerColors: original });
  game.w._openCustomPaletteModal();
  let dialog = document.querySelector('#custom-palette-modal');
  const pieces = [...dialog.querySelectorAll('.lb-color-piece')];
  expect(pieces.map(button => button.getAttribute('aria-label'))).toEqual(['I piece', 'J piece', 'L piece', 'O piece', 'S piece', 'T piece', 'Z piece']);
  const cells = button => [...button.querySelectorAll('rect')].map(cell => [cell.getAttribute('x'), cell.getAttribute('y')]);
  expect(cells(pieces[1])).toEqual([['0.5', '0.5'], ['0.5', '10.5'], ['10.5', '10.5'], ['20.5', '10.5']]);
  expect(pieces.every(button => cells(button).length === 4)).toBe(true);
  expect(pieces[0].getAttribute('aria-pressed')).toBe('true');
  dialog.querySelector('.lb-color-info').click();
  expect(dialog.querySelector('#custom-palette-modal-help').hidden).toBe(false);

  pieces[1].click();
  const input = dialog.querySelector('.lb-color-hex');
  expect(input.value).toBe(original[1]);
  expect(pieces.filter(button => button.getAttribute('aria-pressed') === 'true')).toEqual([pieces[1]]);
  edit(input, '#123');
  expect(dialog.querySelector('.lb-color-apply').disabled).toBe(true);
  edit(input, '#123ABC');
  expect(pieces[1].style.getPropertyValue('--piece-color')).toBe('#123abc');
  dialog.querySelector('.lb-color-apply').click();
  expect(game.api.save.customPickerColors).toEqual([original[0], '#123abc', ...original.slice(2)]);
  expect(JSON.parse(game.w.localStorage.getItem('linebreaker_settings'))).toMatchObject({ colorPalette: '_custom_picker', colorHistory: ['#123abc'] });

  game.w._openCustomPaletteModal();
  dialog = document.querySelector('#custom-palette-modal');
  expect(dialog.querySelector('.lb-color-swatches [data-color]').dataset.color).toBe('#123abc');
  dialog.querySelector('.lb-color-random').click();
  expect(new Set([...dialog.querySelectorAll('.lb-color-piece')].map(button => button.style.getPropertyValue('--piece-color'))).size).toBe(7);
  dialog.querySelector('[aria-label="Close"]').click();
  expect(game.api.save.customPickerColors[1]).toBe('#123abc');
  expect(JSON.parse(game.w.localStorage.getItem('linebreaker_settings')).colorHistory).toEqual(['#123abc']);
});

it('shares presets and history between editors and writes compatible settings to disk', async () => {
  const writes = [];
  const saved = {
    totalXP: 0,
    ownedPalettes: palettes,
    ownedThemes: themes.slice(0, -1),
    customPickerColors: Array(7).fill('#112233'),
    _settings: { colorPalette: '_custom_picker', colorHistory: ['#fedcba', '#FEDCBA', 'bad'] },
  };
  const document = await startGame(async (command, payload) => {
    if (command === 'load_save') return JSON.stringify(saved);
    writes.push(JSON.parse(payload.json));
  });
  expect(JSON.parse(game.w.localStorage.getItem('linebreaker_settings'))).toMatchObject({ colorPalette: '_custom_picker', colorHistory: ['#fedcba'] });
  game.w._openColorPickerModal();
  expect(document.querySelector('#color-picker-modal')).toBeNull();
  game.api.setSave({ ...game.api.save, ownedThemes: themes });
  game.w._openColorPickerModal();
  const theme = document.querySelector('#color-picker-modal');
  const hue = theme.querySelector('.lb-color-hue');
  const input = theme.querySelector('.lb-color-hex');
  const plane = theme.querySelector('.lb-color-plane');
  const curated = dialog => [...dialog.querySelectorAll('.lb-color-swatches:last-child [data-color]')].map(button => button.dataset.color);
  const themePresets = curated(theme);
  expect(themePresets).toHaveLength(5);
  expect(theme.querySelector('.lb-color-swatches [data-color]').dataset.color).toBe('#fedcba');
  edit(input, '#ff0000');
  edit(hue, '120');
  expect(input.value).toBe('#00ff00');
  plane.getBoundingClientRect = () => ({ left: 10, top: 10, width: 100, height: 100 });
  plane.setPointerCapture = vi.fn();
  const pointer = (type, clientX, clientY) => {
    const event = new game.w.MouseEvent(type, { clientX, clientY });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    plane.dispatchEvent(event);
  };
  pointer('pointerdown', 60, 60);
  expect(plane.setPointerCapture).toHaveBeenCalledWith(1);
  expect(input.value).toBe('#408040');
  pointer('pointermove', 125, 5);
  expect(input.value).toBe('#00ff00');
  plane.dispatchEvent(new game.w.Event('lostpointercapture'));
  plane.dispatchEvent(new game.w.KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true }));
  expect(input.value).toBe('#00e600');
  const background = document.querySelector('.bg-gradient').style.background;
  theme.querySelector('.lb-color-apply').click();
  expect(game.api.save.customThemeColor).toBe('#00e600');
  expect(document.querySelector('.bg-gradient').style.background).toBe(background);

  game.w._openCustomPaletteModal();
  const palette = document.querySelector('#custom-palette-modal');
  expect(curated(palette)).toEqual(themePresets);
  const recent = [...palette.querySelectorAll('.lb-color-swatches:first-of-type [data-color]')];
  expect(recent.map(button => button.dataset.color)).toEqual(['#00e600', '#fedcba']);
  recent[1].click();
  palette.querySelector('.lb-color-all').click();
  palette.querySelector('.lb-color-apply').click();
  await vi.waitFor(() => expect(writes.at(-1)).toMatchObject({
    customPickerColors: Array(7).fill('#fedcba'),
    customThemeColor: '#00e600',
    _settings: { colorPalette: '_custom_picker', colorHistory: ['#fedcba', '#00e600'], theme: 'custom' },
  }));
});
