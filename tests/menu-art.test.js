import { expect, it } from 'vitest';
import { loadGame } from './loader.js';

const nextTurn = () => new Promise(resolve => setImmediate(resolve));
const selectedArt = document => [...document.querySelectorAll('#menu-overlay [data-menu-art]')];
const artIds = document => selectedArt(document).map(tile => tile.dataset.menuArt);
const setClock = date => window => {
  const NativeDate = window.Date;
  window.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [date.getTime()])); }
    static now() { return date.getTime(); }
  };
};

it('keeps every tile illustrated across same-day visits and refreshes variants at rollover', async () => {
  const date = new Date(2026, 10, 23, 23, 50);
  const { w, close } = await loadGame(true, null, null, undefined, null, setClock(date));
  try {
    const { document } = w;
    const tiles = () => selectedArt(document);
    const ids = () => artIds(document);
    const first = tiles().map(tile => tile.id);
    const firstArt = ids();
    expect(first.sort()).toEqual(['btn-achievements', 'btn-inventory', 'btn-missions', 'btn-play', 'btn-player-rank', 'btn-settings', 'btn-stats']);
    for (const tile of tiles()) {
      const property = tile.id === 'btn-play' ? '--lb-theme-art-portrait' : '--lb-tile-art';
      expect(tile.style.getPropertyValue(property)).toMatch(/^url\(/);
    }
    document.dispatchEvent(new w.Event('visibilitychange'));
    expect(ids()).toEqual(firstArt);

    w.openSettings();
    await nextTurn();
    const wallpaper = document.getElementById('setting-theme-background');
    for (const choice of ['arctic', 'plain']) {
      wallpaper.value = choice;
      wallpaper.dispatchEvent(new w.Event('change'));
      await nextTurn();
    }
    w.closeSettings();
    await nextTurn();
    expect(ids()).toEqual(firstArt);

    w.openSettings();
    await nextTurn();
    date.setMinutes(date.getMinutes() + 15);
    document.dispatchEvent(new w.Event('visibilitychange'));
    expect(ids()).toEqual(firstArt);
    w.closeSettings();
    await nextTurn();
    expect(tiles().map(tile => tile.id).sort()).toEqual(first);
    expect(ids()).not.toEqual(firstArt);
    const next = w.LBArtPack.pickMenuArt(w.LBArtPack.menuArtDay(date));
    expect(tiles().map(tile => tile.dataset.menuArt)).toEqual(tiles().map(tile => next[tile.id.slice(4)]));
  } finally { close(); }
});

it('restores the same daily art after relaunch independent of random state and legacy storage', async () => {
  const date = new Date(2026, 10, 23, 9);
  const first = await loadGame(true, null, null, undefined, null, setClock(date));
  const firstArt = artIds(first.w.document);
  first.close();
  date.setHours(22);
  const { w, close } = await loadGame(true, null, null, undefined, null, window => {
    setClock(date)(window);
    window.Math.random();
    window.localStorage.setItem('linebreaker_menu_art', '{"missions":"missions-outpost"}');
  });
  try {
    expect(artIds(w.document)).toEqual(firstArt);
  } finally { close(); }
});

it('keeps Mission Log and Locker illustrations through tab changes and reopening until the next day', async () => {
  const date = new Date(2026, 10, 23, 12);
  const { w, close } = await loadGame(true, null, null, undefined, null, setClock(date));
  try {
    for (const [selector, open, switchTab, hide, first, second] of [
      ['.mq-board', () => w.openMissions('daily'), () => w.renderMissionsOverlay('weekly'), () => w.closeMissions(), 'mission-forest-outpost', 'mission-map-room'],
      ['#inventory-crates .lb-collection-feature', () => w.openInventory('crates'), () => w.inventoryTab('boosters'), () => w.closeInventory(), 'locker-quartermaster', 'locker-vault-corridor'],
    ]) {
      const selected = () => w.document.querySelector(selector).dataset.featureArt;
      await open();
      const today = selected();
      expect([first, second]).toContain(today);
      switchTab();
      expect(selected()).toBe(today);
      hide();
      await open();
      expect(selected()).toBe(today);
      hide();
      date.setDate(date.getDate() + 1);
      await open();
      expect(selected()).toBe(today === first ? second : first);
      hide();
    }
  } finally { close(); }
});

it('drops retired art progress and every pending tier without affecting other rewards or counts', async () => {
  const { w, api, close } = await loadGame();
  try {
    const claim = { id: 'games', name: 'Games', rarity: 'common', tierNum: 1, xp: 200 };
    const current = { schemaVersion: 3, totalXP: 123, achievements: { games: { tier: 1 } }, pendingAchievementClaims: [claim] };
    const legacy = {
      ...current,
      seenArt: ['missions-outpost', 'season-pass'],
      achievements: { ...current.achievements, art_collector: { tier: 3 } },
      pendingAchievementClaims: [claim, ...[1, 2, 3].map(tierNum => ({ id: 'art_collector', tierNum }))],
    };
    expect(w.LBSave.serializeSave(legacy)).toEqual(w.LBSave.serializeSave(current));
    const { document } = w;
    const counts = () => [...document.querySelectorAll('#ach-counter, #ach-list .ach-count-label')].map(node => node.textContent);
    api.applyLoadedData(current, false);
    w.openAchievements();
    const expectedCounts = counts();
    expect(expectedCounts.length).toBeGreaterThan(1);
    for (const schemaVersion of [1, 2, 3]) {
      api.applyLoadedData({ ...legacy, schemaVersion }, false);
      w.openAchievements();
      expect(document.querySelector('[data-ach-id="art_collector"]')).toBeNull();
      expect(counts()).toEqual(expectedCounts);
      expect(api.save).not.toHaveProperty('seenArt');
      expect(api.save.achievements).not.toHaveProperty('art_collector');
      expect(api.save.pendingAchievementClaims).toEqual([claim]);
      expect(api.save.totalXP).toBe(123);
    }
  } finally { close(); }
});
