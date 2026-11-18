import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

let game;
afterEach(() => game?.close());

it('refunds each retired owned skin once and persists Retro and square through a restart', async () => {
  let persisted = JSON.stringify({
    totalXP: 123, universalParts: 2.4,
    ownedSkins: ['neon', 'neon', 'gem', 'gameboy', 'lava', 'bubble', 'glass'],
    _settings: { skin: 'glass', blockShape: 'round' },
  });
  const invoke = async (command, payload) => {
    if (command === 'load_save') return persisted;
    if (command === 'write_save') persisted = payload.json;
  };
  game = await loadGame(true, invoke);
  await game.w.flushLinebreakerSave();
  expect(JSON.parse(persisted)).toMatchObject({
    schemaVersion: 1, skinCatalogVersion: 1,
    ownedSkins: ['retro', 'bubble', 'glass'], universalParts: 6.4,
    _settings: { skin: 'retro', blockShape: 'square' },
  });
  expect(game.w.document.getElementById('alert-text').textContent).toContain('4 universal parts');

  game.close();
  game = await loadGame(true, invoke);
  expect(game.api.save.universalParts).toBe(6.4);
  expect(game.w.document.getElementById('alert-title').textContent).not.toBe('BLOCK SKINS UPDATED');
});

it('resets an equipped retired skin without refunding an unowned skin, and keeps current Lava ownership', async () => {
  game = await loadGame(true, null, null, { skin: 'window', blockShape: 'round' });
  expect(game.api.save.universalParts).toBe(0);
  expect(JSON.parse(game.w.localStorage.getItem('tetrisRPG_settings'))).toMatchObject({ skin: 'retro', blockShape: 'square' });
  expect(game.w.applyBlockShape).toBeUndefined();
  game.api.applyLoadedData({ totalXP: 123, ownedSkins: ['lava'], skinCatalogVersion: 1 });
  expect(game.api.save.ownedSkins).toEqual(['retro', 'lava']);
  expect(game.api.save.universalParts).toBe(0);
});

it('maps piece indices to the atlas order, with grey garbage and white for tinting', async () => {
  game = await loadGame();
  const { imageSkinAtlasCell } = game.api;
  expect([1, 2, 3, 4, 5, 6, 7].map(id => imageSkinAtlasCell(id))).toEqual([0, 5, 6, 1, 3, 2, 4]);
  expect([1, 2, 3, 4, 5, 6, 7].map(id => imageSkinAtlasCell(id, false))).toEqual(Array(7).fill(8));
  expect(imageSkinAtlasCell(8, false)).toBe(7);
  expect(imageSkinAtlasCell(0)).toBeNull();
});

it('keys multiply tints by skin and normalized palette color and reuses them across draw sizes', async () => {
  const ownedPalettes = ['classic', 'greyscale', 'ice', 'pastel', 'dark', 'synthwave', 'earth', 'neon'];
  const invoke = async command => command === 'load_save' ? JSON.stringify({ totalXP: 0, ownedPalettes }) : null;
  const atlases = new Map();
  game = await loadGame(true, invoke, null, undefined, { colorPalette: 'pastel' }, window => {
    window.Image = class { set src(url) { atlases.set(url, this); } };
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new window.Event('close'));
    };
  });
  const { imageSkinTintKey, drawGameBlock } = game.api;
  const cyanTint = imageSkinTintKey('aztec', '#AAFFFF');
  expect(cyanTint).toBe(imageSkinTintKey('aztec', '#aaffff'));
  expect(cyanTint).not.toBe(imageSkinTintKey('aztec', '#FF00FF'));
  expect(cyanTint).not.toBe(imageSkinTintKey('lava', '#AAFFFF'));

  const context = game.w.document.createElement('canvas').getContext('2d');
  drawGameBlock(context, 0, 0, 1, 24, false, 'aztec');
  const image = atlases.get('assets/skins/aztec.png');
  expect(image).toBeDefined();
  image.onload();
  drawGameBlock(context, 0, 0, 1, 24, false, 'aztec');
  drawGameBlock(context, 0, 0, 1, 40, false, 'aztec');
  drawGameBlock(context, 0, 0, 1, 40, true, 'aztec');
  expect(game.calls.filter(call => call[0] === 'drawImage' && call[1] === image))
    .toEqual([['drawImage', image, 512, 0, 64, 64, 0, 0, 64, 64]]);

  game.w._openCustomPaletteModal();
  const picker = game.w.document.getElementById('custom-palette-modal');
  const colorInput = picker.querySelector('.lb-color-hex');
  colorInput.value = '#123456';
  colorInput.dispatchEvent(new game.w.Event('input', { bubbles: true }));
  picker.querySelector('.lb-color-apply').click();
  expect(game.api.save.customPickerColors[0]).toBe('#123456');
  game.calls.length = 0;
  drawGameBlock(context, 0, 0, 1, 24, false, 'aztec');
  expect(game.calls.filter(call => call[0] === 'drawImage' && call[1] === image))
    .toEqual([['drawImage', image, 512, 0, 64, 64, 0, 0, 64, 64]]);
});

it('offers Bubble and every packaged image skin as rewards at their catalog prices', async () => {
  game = await loadGame();
  const manifest = JSON.parse(readFileSync(new URL('../assets/skins/skins.json', import.meta.url), 'utf8'));
  const rewardKeys = game.api.partsItems().filter(item => item.cat === 'skin').map(item => item.key);
  expect(manifest).toHaveLength(14);
  expect(rewardKeys).toEqual(['glass', 'shadow', 'outline', 'holo', 'journey', 'bubble', ...manifest.map(skin => skin.key)]);
  expect(game.api.partCost('golden-dragon')).toBe(50);
  for (const { key, file, cost, cell } of manifest) {
    expect(game.api.partCost(key)).toBe(cost);
    const png = readFileSync(new URL(`../assets/skins/${file}`, import.meta.url));
    expect([cell, png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([64, 576, 64]);
  }
});
