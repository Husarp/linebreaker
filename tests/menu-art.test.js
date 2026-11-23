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

it('holds three artworks across same-day visits and adds only artwork actually shown after rollover', async () => {
  const date = new Date(2026, 10, 23, 23, 50);
  const { w, api, close } = await loadGame(true, null, null, undefined, null, setClock(date));
  try {
    const { document } = w;
    const tiles = () => selectedArt(document);
    const ids = () => artIds(document);
    const first = tiles().map(tile => tile.id);
    const firstArt = ids();
    expect(first).toHaveLength(3);
    expect(first).not.toContain('lb43-daily-gift');
    expect(api.save.seenArt.toSorted()).toEqual([...new Set(['wallpaper-default', ...firstArt])].sort());
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
    const seenToday = [...new Set(['wallpaper-default', ...firstArt])].sort();
    expect(api.save.seenArt.toSorted()).toEqual(seenToday);

    w.openSettings();
    await nextTurn();
    date.setMinutes(date.getMinutes() + 15);
    document.dispatchEvent(new w.Event('visibilitychange'));
    expect(ids()).toEqual(firstArt);
    expect(api.save.seenArt.toSorted()).toEqual(seenToday);
    w.closeSettings();
    await nextTurn();
    expect(tiles().map(tile => tile.id)).not.toEqual(first);
    expect(ids()).toHaveLength(3);
    expect(ids().some(id => !seenToday.includes(id))).toBe(true);
    expect(api.save.seenArt.toSorted()).toEqual([...new Set([...seenToday, ...ids()])].sort());
    expect(w.LBSave.serializeSave(api.save).seenArt).toEqual(api.save.seenArt);
  } finally { close(); }
});

it('counts Season Pass art once across Missions and the reward track', async () => {
  const { w, api, close } = await loadGame();
  try {
    const { document } = w;
    const first = artIds(document);
    api.setup();
    await w.openMissions();
    expect(api.save.seenArt).toEqual(['season-pass']);
    document.getElementById('btn-season-pass').click();
    await nextTurn();
    expect(api.save.seenArt).toEqual(['season-pass']);
    w.closeMissions();
    w.closeMissions();
    await nextTurn();
    expect(artIds(document)).toEqual(first);
    expect(api.save.seenArt.filter(id => id === 'season-pass')).toHaveLength(1);
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

it('records the game wallpaper even when the menu was covered before it could be seen', async () => {
  const { w, api, close } = await loadGame();
  try {
    const { document } = w;
    w.openModeSelect();
    await nextTurn();
    api.setup();
    document.getElementById('play-start').click();
    document.getElementById('mode-select-overlay').dispatchEvent(new w.Event('animationend'));
    await nextTurn();
    expect(api.save.seenArt).toEqual(['wallpaper-default']);
    expect(document.getElementById('menu-overlay').classList.contains('hidden')).toBe(true);
  } finally { close(); }
});

it('migrates missing art history and sanitizes incoming and outgoing entries', async () => {
  const { w, api, close } = await loadGame();
  try {
    for (const save of [{}, { schemaVersion: 1 }, { seenArt: 'season-pass' }]) {
      api.applyLoadedData(save, false);
      expect(api.save.seenArt).toEqual([]);
    }
    const seenArt = ['wallpaper-forest', 'wallpaper-forest', 'season-pass', 'wallpaper-forest-portrait', '__proto__', {}, 0];
    expect(w.LBSave.serializeSave({ seenArt }).seenArt).toEqual(['wallpaper-forest', 'season-pass']);
    api.applyLoadedData({ seenArt }, false);
    expect(api.save.seenArt).toEqual(['wallpaper-forest', 'season-pass']);
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

it('shows Art collector progress and unlocks the tiers at 10, 18 and the complete catalog', async () => {
  const { w, api, close } = await loadGame();
  try {
    const ids = w.LBArtPack.seenArtIds;
    for (const [count, tier] of [[9, 0], [10, 1], [17, 1], [18, 2], [ids.length - 1, 2], [ids.length, 3]]) {
      api.applyLoadedData({ seenArt: ids.slice(0, count) }, false);
      w.openAchievements();
      const list = w.document.getElementById('ach-list');
      expect(list.textContent).toContain('Art collector');
      const card = list.querySelector(`[data-ach-id="art_collector"][data-state="${tier ? 'unlocked' : 'locked'}"]`);
      if (tier === 3) {
        card.click();
        expect(w.document.getElementById('ach-tip').textContent).toContain('See every artwork');
        expect(card.querySelector('progress')).toBeNull();
      } else {
        expect(card.textContent).toContain(`${count} / ${[10, 18, ids.length][tier]}`);
      }
      expect(api.save.achievements.art_collector?.tier || 0).toBe(tier);
      expect(api.save.pendingAchievementClaims.filter(claim => claim.id === 'art_collector').map(claim => claim.tierNum))
        .toEqual(Array.from({ length: tier }, (_, index) => index + 1));
    }
  } finally { close(); }
});
