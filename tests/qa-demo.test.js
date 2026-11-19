import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { loadGame } from './loader.js';

let game;
afterEach(() => game?.close());

const fileFor = {
  'data/missions.json': 'data/missions.json',
  'data/season.json': 'data/season.json',
  'assets/music.json': 'assets/music.release.json',
};
const fetchDemoAssets = async path => ({ ok: Boolean(fileFor[path]), json: async () => JSON.parse(readFileSync(new URL(`../${fileFor[path]}`, import.meta.url))) });

it.each(['?dev', '?demo'])('does not enable the QA API with %s alone', async query => {
  const invoke = vi.fn().mockResolvedValue(null);
  game = await loadGame(false, invoke, null, undefined, null, window => window.history.replaceState(null, '', query));
  expect(game.w.__LB_QA).toBeUndefined();
  expect(invoke).toHaveBeenCalledWith('load_save');
});

it.each(['browser', 'desktop', 'android'])('never accesses real saves or save preferences in %s demo mode', async platform => {
  const native = vi.fn().mockRejectedValue(new Error('Real save accessed'));
  const filesystem = { readFile: native, writeFile: native, stat: native, mkdir: native };
  const capacitor = platform === 'android' ? { isNativePlatform: () => true, Plugins: { Filesystem: filesystem, App: { async addListener() {} } } } : null;
  const picker = vi.fn();
  const idb = vi.fn();
  const diskSettings = { skin: 'retro', fontSize: '9' };
  let storage;
  game = await loadGame(true, platform === 'desktop' ? native : null, capacitor, fetchDemoAssets, diskSettings, window => {
    window.history.replaceState(null, '', '?dev&demo');
    window.showOpenFilePicker = window.showSaveFilePicker = picker;
    window.indexedDB.open = idb;
    window.localStorage.setItem('tetrisRPG_funConfig', '{"cols":9}');
    storage = ['getItem', 'setItem', 'removeItem', 'clear'].map(method => vi.spyOn(window.localStorage, method));
  });
  const { w, api, advance } = game;
  const get = id => w.document.getElementById(id);
  const qa = w.__LB_QA;
  const visible = id => expect(get(id)?.classList.contains('hidden')).toBe(false);
  expect(qa).toBeDefined();
  visible('menu-overlay');
  expect(get('file-setup-overlay').classList.contains('hidden')).toBe(true);
  expect(api.save).toMatchObject({ totalXP: 64000, stats: { gamesPlayed: 12 }, universalParts: 13 });
  expect(api.save.ownedSkins).toContain('aztec');
  expect(api.save.missions.daily.quests.some(quest => quest.completed)).toBe(true);
  await qa.open('settings');
  w.onSettingChange('fontSize', '7');
  w.onSettingChange('gridOpacity', 50);
  await qa.open('play-fun');
  expect(get('mode-select-overlay').dataset.mode).toBe('fun');
  expect(w.document.querySelector('[data-play-modifier="optNoNext"]').disabled).toBe(true);
  expect(w.document.querySelector('[data-play-modifier="optHold"]').disabled).toBe(false);
  await qa.open('season-pass');
  expect(w.document.querySelector('.sp-receipt')).not.toBeNull();
  expect(w.document.querySelector('.sp-claim')).not.toBeNull();
  await qa.open('daily-gift');
  visible('daily-gift-overlay');
  await qa.open('level-crate');
  visible('level-box-overlay');
  await qa.open('mission-crate');
  expect(w.document.querySelector('[aria-label="Earned rewards"]')).not.toBeNull();
  for (const [name, id] of [['pause', 'pause-overlay'], ['game-over', 'go-overlay']]) {
    const opened = qa.open(name);
    await Promise.resolve();
    advance(1700);
    await opened;
    visible(id);
  }
  await qa.open('menu');
  await qa.open('transfer');
  expect(get('transfer-overlay').querySelector('[onclick*="file-import-input"]').disabled).toBe(true);
  await w.startExportProcess();
  await api.writeSaveFile(api.save);
  await qa.open('reset-progress');
  get('reset-phrase-input').value = 'RESET MY PROGRESS';
  get('reset-confirm-btn').click();
  await Promise.resolve();
  w.dispatchEvent(new w.Event('pagehide'));
  advance(1000);
  expect(api.save.totalXP).toBe(0);
  for (const spy of [native, idb, picker, ...storage]) expect(spy).not.toHaveBeenCalled();
  expect(JSON.parse(w.localStorage.getItem('tetrisRPG_settings'))).toEqual(diskSettings);
  expect(w.localStorage.getItem('tetrisRPG_funConfig')).toBe('{"cols":9}');
});

it('opens the documented screenshot targets through real UI handlers', async () => {
  game = await loadGame(false, null, null, fetchDemoAssets, null, window => {
    window.history.replaceState(null, '', '?dev&demo');
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new window.Event('close'));
    };
  });
  const { w, advance } = game;
  const targets = {
    menu: '#menu-overlay', play: '#mode-select-overlay', 'play-fun': '#mode-select-overlay[data-mode="fun"]',
    settings: '#settings-overlay', inventory: '[data-invtab-content="blocks"]',
    'inventory-colors': '[data-invtab-content="colors"]', 'inventory-other': '[data-invtab-content="other"]',
    stats: '#general-stats-container', leaderboard: '#leaderboard-container', pinned: '#pinned-container', highscores: '#highscores-container',
    missions: '#missions-overlay', 'missions-weekly': '#missions-overlay', 'mission-confirm': '#mq-confirm-overlay',
    'season-pass': '#season-pass-overlay', achievements: '#achievements-overlay', playlist: '#playlist-overlay',
    help: '#rules-overlay', tutorial: '#tutorial-overlay', credits: '#credits-overlay', transfer: '#transfer-overlay',
    alert: '#custom-alert', confirm: '#custom-confirm', 'reset-progress': '#reset-phrase-input',
    'color-picker': '#color-picker-modal[open]', 'custom-palette': '#custom-palette-modal[open]', 'palette-preview': '#palette-view-modal', 'palette-editor': '#pal-edit-modal',
    'sfx-preview': '#sfx-preview-modal', 'sfx-panel': '#sfx-panel-modal', 'universal-parts': '#uni-modal-overlay',
    'universal-exchange': '#uni-xch-overlay', 'booster-exchange': '#exc-modal-overlay', 'inventory-sfx': '#sfx-inv-preview',
    'daily-gift': '#daily-gift-overlay', 'level-crate': '#level-box-overlay', 'level-up': '#level-up-popup-overlay', 'mission-crate': '[aria-label="Earned rewards"]',
    'start-animation': '#start-animation-overlay', game: '#app.active-game', pause: '#pause-overlay', 'game-over': '#go-overlay',
  };
  expect(w.__LB_QA.list()).toEqual(Object.keys(targets));
  for (const [name, selector] of Object.entries(targets)) {
    const opened = w.__LB_QA.open(name);
    if (['game', 'pause', 'game-over'].includes(name)) {
      await Promise.resolve();
      advance(1700);
    }
    await opened;
    const element = w.document.querySelector(selector);
    expect(element, name).not.toBeNull();
    expect(element.closest('.hidden, [hidden]'), name).toBeNull();
  }
  await expect(w.__LB_QA.open('typo')).rejects.toThrow('Unknown QA screen');
}, 15_000);

it('shows booster costs and disables exchanges the player cannot afford', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w, api } = game;
  api.setSave({ ...api.save, boosters: { ...api.save.boosters, '1.25x_game': 7 } });
  await w.__LB_QA.open('inventory-other');
  const inventory = w.document.getElementById('inventory-other-content');
  const common = inventory.querySelector('[aria-label="Exchange 1.25× Booster"]');
  expect(common.disabled).toBe(false);
  expect(inventory.querySelector('[aria-label="Exchange 1.5× Booster"]').disabled).toBe(true);
  common.click();
  const dialog = w.document.getElementById('exc-modal-overlay');
  expect([...dialog.querySelectorAll('img')].map(img => img.getAttribute('src'))).toEqual([
    'assets/ui/boosters/common-1.25x.png', 'assets/ui/boosters/rare-1.5x.png',
  ]);
  expect(dialog.querySelector('#exc-spend').textContent).toBe('3');
  expect(dialog.querySelector('#exc-receive').textContent).toBe('+1');
  const slider = dialog.querySelector('#exc-slider');
  slider.value = '2';
  slider.dispatchEvent(new w.Event('input'));
  expect(dialog.querySelector('#exc-spend').textContent).toBe('6');
  expect(dialog.querySelector('#exc-receive').textContent).toBe('+2');
  dialog.querySelector('.lb-block-btn--primary').click();
  expect(api.save.boosters).toMatchObject({ '1.25x_game': 1, '1.5x_game': 4 });
  expect(inventory.querySelector('[aria-label="Exchange 1.25× Booster"]').disabled).toBe(true);
  expect(inventory.querySelector('[aria-label="Exchange 1.5× Booster"]').disabled).toBe(false);
});

it('queues only affordable whole parts and re-enables controls when a part is removed', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w, api } = game;
  api.setSave({ ...api.save, universalParts: 13.2 });
  await w.__LB_QA.open('universal-parts');
  const get = id => w.document.getElementById(id);
  const dialog = get('uni-modal-overlay');
  const apply = get('uni-apply-btn');
  expect(apply.disabled).toBe(true);
  expect(dialog.querySelector('.lb-exchange-parts-icon').getAttribute('src')).toBe('assets/ui/62-parts.svg');
  for (let count = 0; count < 13; count++) dialog.querySelector('button[id^="uni-inc-"]:not(:disabled)').click();
  expect(get('uni-avail-lbl').textContent).toBe('0.2 available');
  expect(dialog.querySelector('button[id^="uni-inc-"]:not(:disabled)')).toBeNull();
  expect(apply.disabled).toBe(false);
  dialog.querySelector('button[id^="uni-dec-"]:not([hidden])').click();
  expect(get('uni-avail-lbl').textContent).toBe('1.2 available');
  expect(dialog.querySelector('button[id^="uni-inc-"]:not(:disabled)')).not.toBeNull();
  w._uniDoApply();
  expect(api.save.universalParts).toBeCloseTo(1.2);
});

it('updates the parts-for-XP preview and grants the selected amount', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w, api } = game;
  const startXP = 65_000;
  api.setSave({ ...api.save, totalXP: startXP });
  await w.__LB_QA.open('universal-exchange');
  const get = id => w.document.getElementById(id);
  const slider = get('uni-xch-slider');
  slider.value = '1';
  slider.dispatchEvent(new w.Event('input'));
  expect(get('uni-xch-count').textContent).toBe('1 part');
  expect(get('uni-xch-xp').textContent).toBe(`+${(5000).toLocaleString()} XP`);
  get('uni-xch-confirm').click();
  expect(api.save.universalParts).toBe(12);
  expect(api.save.totalXP).toBe(startXP + 5000);
});
