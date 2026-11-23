import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

let game;
afterEach(() => game?.close());

it('draws static inventory previews only when they enter the observation range', async () => {
  let activeObserver;
  game = await loadGame(true, null, null, undefined, {skin: 'retro'}, window => {
    window.IntersectionObserver = class {
      targets = new Set();
      constructor(callback) { this.callback = callback; activeObserver = this; }
      observe(target) { this.targets.add(target); }
      unobserve(target) { this.targets.delete(target); }
      disconnect() { this.targets.clear(); }
    };
  });
  game.api.setup();
  game.w.openInventory();
  const preview = game.w.document.querySelector('#owned-skin-btns canvas[data-skin="glass"]');
  const deliver = isIntersecting => activeObserver.callback([{ target: preview, isIntersecting }], activeObserver);
  expect(activeObserver.targets.has(preview)).toBe(true);
  deliver(false);
  expect(preview.dataset.previewColor).toBeUndefined();
  deliver(true);
  expect(preview.dataset.previewColor).toBe('1');
  expect(activeObserver.targets.has(preview)).toBe(false);
  game.w.closeInventory();
  expect(activeObserver.targets.size).toBe(0);
});

it('cycles only the equipped inventory preview and reuses static previews across repopulation', async () => {
  let tickPreview;
  game = await loadGame(true, null, null, {skin: 'retro'}, null, window => {
    window.matchMedia = () => ({matches: false});
    window.setInterval = (callback, delay) => { if (delay === 2500) tickPreview = callback; };
  });
  const {w, api} = game;
  api.setup({save: {ownedSkins: ['retro', 'glass'], ownedPalettes: ['classic', 'pastel']}});
  w.openInventory();
  const previews = () => [...w.document.querySelectorAll('#owned-skin-btns canvas')];
  const preview = skin => previews().find(canvas => canvas.dataset.skin === skin);
  const staticPreviews = previews().filter(canvas => canvas.dataset.skin !== 'retro');
  expect(tickPreview).toBeTypeOf('function');
  tickPreview();
  expect(preview('retro').dataset.previewColor).toBe('2');
  expect(staticPreviews.every(canvas => canvas.dataset.previewColor === '1')).toBe(true);

  w.inventoryTab('colors');
  w.inventoryTab('blocks');
  for (const canvas of staticPreviews) expect(preview(canvas.dataset.skin)).toBe(canvas);

  w.document.querySelector('[data-inventory-equip="skin"][data-equip-value="glass"]').click();
  tickPreview();
  expect(preview('glass').dataset.previewColor).toBe('3');
  expect(preview('retro').dataset.previewColor).toBe('1');
  const retroPreview = preview('retro');
  w.onSettingChange('colorPalette', 'pastel');
  expect(preview('retro')).not.toBe(retroPreview);
  expect(preview('retro').dataset.previewColor).toBe('1');
});

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
    schemaVersion: 3, skinCatalogVersion: 1,
    ownedSkins: ['retro', 'bubble', 'glass'], universalParts: { common: 6.4 },
    _settings: { skin: 'retro', blockShape: 'square' },
  });
  expect(game.w.document.getElementById('alert-text').textContent).toContain('4 Common Universal Parts');

  game.close();
  game = await loadGame(true, invoke);
  expect(game.api.save.universalParts).toEqual({ common: 6.4 });
  expect(game.w.document.getElementById('alert-title').textContent).not.toBe('BLOCK SKINS UPDATED');
});

it('resets equipped Lava and refunds it only if owned, even in a current save', async () => {
  game = await loadGame(true, null, null, { skin: 'lava', blockShape: 'round' });
  expect(game.api.save.universalParts).toEqual({});
  expect(JSON.parse(game.w.localStorage.getItem('linebreaker_settings'))).toMatchObject({ skin: 'retro', blockShape: 'square' });
  expect(game.w.applyBlockShape).toBeUndefined();
  game.api.applyLoadedData({ totalXP: 123, ownedSkins: ['lava'], skinCatalogVersion: 1 });
  expect(game.api.save.ownedSkins).toEqual(['retro']);
  expect(game.api.save.universalParts).toEqual({ common: 1 });
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
  game.calls.length = 0;
  picker.querySelector('.lb-color-apply').click();
  expect(game.api.save.customPickerColors[0]).toBe('#123456');
  drawGameBlock(context, 0, 0, 1, 24, false, 'aztec');
  expect(game.calls.filter(call => call[0] === 'drawImage' && call[1] === image))
    .toEqual([['drawImage', image, 512, 0, 64, 64, 0, 0, 64, 64]]);
});

it('offers Bubble and every packaged image skin as rewards at the price of their rarity', async () => {
  game = await loadGame();
  const manifest = JSON.parse(readFileSync(new URL('../assets/skins/skins.json', import.meta.url), 'utf8'));
  const rewardKeys = game.api.partsItems().filter(item => item.cat === 'skin').map(item => item.key);
  expect(manifest.length).toBeGreaterThan(0);
  expect(rewardKeys).toEqual(['glass', 'shadow', 'outline', 'holo', 'journey', 'bubble', ...manifest.map(skin => skin.key)]);
  const prices = { rare: 15, epic: 12, legendary: 10 };
  expect(new Set(manifest.map(skin => skin.rarity))).toEqual(new Set(Object.keys(prices)));
  for (const { key, file, rarity, cell } of manifest) {
    expect(game.api.partCost(key)).toBe(prices[rarity]);
    const png = readFileSync(new URL(`../assets/skins/${file}`, import.meta.url));
    expect([cell, png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([64, 576, 64]);
  }
});

it('prices every available part unlock and keeps the Mythic season skin out of the parts pool', async () => {
  game = await loadGame();
  const { w, api } = game;
  for (const { cat, key } of api.partsItems()) {
    expect(api.partCost(key)).toBe({ common: 20, rare: 15, epic: 12, legendary: 10, mythic: 8 }[api.partRarity(key)]);
    if (cat === 'palette' || cat === 'gridStyle') expect(api.partCost(key)).toBe(20);
    if (cat === 'sfxPack') expect(api.partCost(key)).toBe(15);
  }
  expect(api.partCost('season-prism')).toBe(0);
  expect(api.partsItems().some(item => item.key === 'season-prism')).toBe(false);
  api.applyLoadedData({ ...api.save, ownedSkins: ['retro', 'season-prism'], parts: { 'season-prism': 500 } });
  w.openInventory();
  w.inventoryTab('blocks');
  expect(w.document.querySelector('[data-item-key="season-prism"][data-owned="true"] .lb-inventory-rarity').dataset.rarity).toBe('mythic');
});

it('retains owned items and applies already collected parts toward the new price', async () => {
  game = await loadGame();
  const { w, api } = game;
  api.applyLoadedData({ ...api.save, ownedSkins: ['retro', 'aztec'], parts: { glass: 10 } });
  w.openInventory();
  w.inventoryTab('blocks');
  const glass = () => w.document.querySelector('[data-item-key="glass"]');
  expect(glass().querySelector('.lb-inventory-rarity').dataset.rarity).toBe('rare');
  expect(glass().querySelector('progress').value).toBe(10);
  expect(glass().querySelector('progress').max).toBe(15);
  expect(w.document.querySelector('[data-item-key="aztec"]').dataset.owned).toBe('true');
  w.playerUnlockItem('skin', 'glass');
  expect(api.save.ownedSkins).not.toContain('glass');
  const save = api.save;
  save.parts.glass += 5;
  api.setSave(save);
  w.playerUnlockItem('skin', 'glass');
  expect(api.save.ownedSkins).toContain('glass');
  expect(glass().dataset.owned).toBe('true');
});
