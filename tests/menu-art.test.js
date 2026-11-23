import { expect, it } from 'vitest';
import { loadGame } from './loader.js';

const nextTurn = () => new Promise(resolve => setImmediate(resolve));
const selectedArt = document => [...document.querySelectorAll('#menu-overlay [data-menu-art]')];

it('holds three artworks for a visit, then rotates to a different set and saves only artwork shown', async () => {
  const { w, api, close } = await loadGame();
  try {
    const { document } = w;
    const tiles = () => selectedArt(document);
    const ids = () => tiles().map(tile => tile.dataset.menuArt);
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
    expect(api.save.seenArt).not.toContain('wallpaper-arctic');
    w.closeSettings();
    await nextTurn();
    expect(tiles()).toHaveLength(3);
    expect(tiles().map(tile => tile.id)).not.toEqual(first);
    expect(api.save.seenArt.toSorted()).toEqual([...new Set(['wallpaper-default', ...firstArt, ...ids()])].sort());
    expect(w.LBSave.serializeSave(api.save).seenArt).toEqual(api.save.seenArt);
  } finally { close(); }
});

it('counts Season Pass art once across Missions and the reward track, then rotates the menu art', async () => {
  const { w, api, close } = await loadGame();
  try {
    const { document } = w;
    const first = selectedArt(document).map(tile => tile.id);
    api.setup();
    await w.openMissions();
    expect(api.save.seenArt).toEqual(['season-pass']);
    document.getElementById('btn-season-pass').click();
    await nextTurn();
    expect(api.save.seenArt).toEqual(['season-pass']);
    w.closeMissions();
    w.closeMissions();
    await nextTurn();
    expect(selectedArt(document)).toHaveLength(3);
    expect(selectedArt(document).map(tile => tile.id)).not.toEqual(first);
    expect(api.save.seenArt.filter(id => id === 'season-pass')).toHaveLength(1);
  } finally { close(); }
});

it('excludes the previous visit after relaunching with the same random seed', async () => {
  const storageKey = 'linebreaker_menu_art';
  const first = await loadGame();
  const previous = first.w.localStorage.getItem(storageKey);
  const firstSet = selectedArt(first.w.document).map(tile => tile.id);
  first.close();
  const { w, close } = await loadGame(true, null, null, undefined, null, window => window.localStorage.setItem(storageKey, previous));
  try {
    const secondSet = selectedArt(w.document).map(tile => tile.id);
    expect(secondSet).toHaveLength(3);
    expect(secondSet).not.toEqual(firstSet);
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

it('picks one illustration per Mission Log or Locker opening and keeps it through tab changes', async () => {
  const { w, close } = await loadGame();
  try {
    for (const [selector, open, switchTab, hide, first, second] of [
      ['.mq-board', () => w.openMissions('daily'), () => w.renderMissionsOverlay('weekly'), () => w.closeMissions(), 'mission-forest-outpost', 'mission-map-room'],
      ['#inventory-crates .lb-collection-feature', () => w.openInventory('crates'), () => w.inventoryTab('boosters'), () => w.closeInventory(), 'locker-quartermaster', 'locker-vault-corridor'],
    ]) {
      const selected = () => w.document.querySelector(selector).dataset.featureArt;
      w.Math.random = () => 0.2;
      await open();
      expect(selected()).toBe(first);
      w.Math.random = () => 0.8;
      switchTab();
      expect(selected()).toBe(first);
      hide();
      await open();
      expect(selected()).toBe(second);
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
