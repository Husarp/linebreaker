import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { loadGame } from './loader.js';

let game;
afterEach(() => game?.close());

it('opens deep links before syncing, returns to the category menu, and cancels a closed screen fill', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => { window.__testDeferredScreens = true; });
  const { w, advance } = game;
  const menu = w.document.querySelector('.lb102-directory');
  const back = w.document.getElementById('settings-back');
  const controls = w.document.getElementById('settings-controls');
  const opened = w.openSettings(false, 'updates');
  expect(menu.hidden).toBe(true);
  expect(w.document.querySelector('#settings-updates').hidden).toBe(false);
  expect(w.document.querySelector('#settings-updates #notification-settings')).toBeNull();
  w.closeSettings();
  advance(16); advance(16);
  await opened;
  const reopened = w.openSettings();
  expect(menu.hidden).toBe(false);
  const controlsButton = menu.querySelector('[data-settings-category="controls"]');
  controlsButton.click();
  expect(menu.hidden).toBe(true);
  expect(controls.hidden).toBe(false);
  expect(back.textContent).toBe('Back');
  back.click();
  expect(controls.hidden).toBe(true);
  expect(w.document.activeElement).toBe(controlsButton);
  menu.querySelector('[data-settings-category="notifications"]').click();
  expect(w.document.querySelector('#settings-notifications').hidden).toBe(false);
  advance(16); advance(16);
  await reopened;
  w.closeSettings();
});

it('filters the exact Game and App directory groups and preserves search on return', async () => {
  game = await loadGame(true);
  const { w } = game;
  await w.openSettings();
  const groups = [...w.document.querySelectorAll('[data-settings-group]')];
  expect(groups.map(group => [...group.querySelectorAll('strong')].map(label => label.textContent)))
    .toEqual([['Controls', 'Display', 'Audio'], ['Notifications', 'Data & updates']]);
  const search = w.document.querySelector('.lb-ledger-search input');
  const query = value => { search.value = value; search.dispatchEvent(new w.Event('input')); };
  const visibleRows = () => [...w.document.querySelectorAll('[data-settings-category]:not([hidden])')];
  query('  WALLPAPER  theme ');
  expect(groups[1].parentElement.hidden).toBe(true);
  expect(visibleRows().map(button => button.dataset.settingsCategory)).toEqual(['display']);
  const [display] = visibleRows();
  display.click();
  const back = w.document.getElementById('settings-back');
  back.click();
  expect(w.document.activeElement).toBe(display);
  expect(search.value).toBe('  WALLPAPER  theme ');
  query('not-a-setting');
  expect(visibleRows()).toEqual([]);
  expect(w.document.querySelector('.lb102-no-results').hidden).toBe(false);
  query('gameplay');
  visibleRows()[0].click();
  const gameplay = w.document.querySelector('[data-settings-subpage="game"]');
  gameplay.click();
  back.click();
  expect(w.document.activeElement).toBe(gameplay);
});

const fileFor = {
  'data/missions.json': 'data/missions.json',
  'data/season.json': 'data/season.json',
  'assets/music.json': 'assets/music.release.json',
};
const fetchDemoAssets = async path => ({ ok: Boolean(fileFor[path]), json: async () => JSON.parse(readFileSync(new URL(`../${fileFor[path]}`, import.meta.url))) });

it('filters inventory by actual unlock, equipment and stock state and remembers each tab', async () => {
  game = await loadGame(true);
  const { w, api } = game;
  const save = api.save;
  save.parts.sfxRetro = api.partCost('sfxRetro');
  save.boosters = { '1.25x_game': 1 };
  api.setSave(save);
  const filter = name => w.document.querySelector(`[data-inv-filter="${name}"]`);
  const visibleCards = tab => [...w.document.querySelectorAll(`#inventory-${tab} [data-owned]:not([hidden])`)];
  await w.openInventory('other');
  filter('ready').click();
  expect(visibleCards('other').map(row => row.dataset.itemKey)).toEqual(['sfxRetro']);
  expect(visibleCards('other')[0].querySelector('button').textContent).toBe('Unlock');
  w.inventoryTab('colors');
  expect(filter('all').getAttribute('aria-pressed')).toBe('true');
  filter('equipped').click();
  expect(visibleCards('colors').length).toBeGreaterThan(0);
  expect(visibleCards('colors').every(row => row.dataset.equipped === 'true')).toBe(true);
  w.inventoryTab('boosters');
  expect(filter('equipped').hidden).toBe(true);
  filter('owned').click();
  expect(w.document.querySelectorAll('#inventory-boosters [data-empty]:not([hidden])')).toHaveLength(1);
  w.inventoryTab('parts');
  filter('owned').click();
  expect(w.document.getElementById('inventory-filter-empty').hidden).toBe(false);
  w.closeInventory();
  await w.openInventory('other');
  expect(filter('ready').getAttribute('aria-pressed')).toBe('true');
  w.inventoryTab('crates');
  expect(filter('all').parentElement.hidden).toBe(true);
});

it('opens earned reward destinations and restores summary focus and scroll on Back', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w, api, advance } = game;
  const save = api.save;
  const quest = save.missions.daily.quests[0];
  Object.assign(quest, { metric: 'linesCleared', completed: false, target: 1, progress: 0, ptsClaimed: false });
  api.setSave(save);
  const opened = w.__LB_QA.open('game-over');
  await Promise.resolve();
  advance(3000);
  await opened;
  const summary = w.document.getElementById('go-overlay');
  const body = summary.querySelector('.go-dialog-body');
  const reward = destination => summary.querySelector(`[data-go-destination="${destination}"]`);
  const roundTrip = (destination, id, atDestination) => {
    const opener = reward(destination);
    expect(opener).not.toBeNull();
    body.scrollTop = 120;
    opener.click();
    const overlay = w.document.getElementById(id);
    if (destination === 'crates') w.document.querySelector('#level-up-popup-overlay button').click();
    const back = overlay.querySelector('[aria-label="Back to run summary"]');
    expect(back).not.toBeNull();
    atDestination?.(overlay);
    const close = { stats: w.closeStats, daily: w.closeMissions, crates: w.closeInventory }[destination];
    if (close) close();
    else back.click();
    overlay.dispatchEvent(new w.Event('animationend'));
    expect(summary.classList.contains('hidden')).toBe(false);
    expect(w.document.activeElement).toBe(opener);
    expect(body.scrollTop).toBe(120);
  };
  roundTrip('stats', 'stats-overlay');
  roundTrip('daily', 'missions-overlay', () => w._claimQuestPts(quest.id, false));
  roundTrip('season', 'season-pass-overlay');
  roundTrip('crates', 'inventory-overlay', overlay => {
    expect(overlay.querySelector('[data-invtab="crates"]').getAttribute('aria-selected')).toBe('true');
  });
});

it('mirrors the theme to compatible Android shells without changing it on wallpaper selection', async () => {
  const setUiTheme = vi.fn().mockRejectedValue(new Error('Older shell'));
  game = await loadGame(true, null, {
    isNativePlatform: () => true,
    isPluginAvailable: name => name === 'Ota',
    Plugins: { Ota: { setUiTheme } },
  });
  const { w } = game;
  expect(setUiTheme).toHaveBeenLastCalledWith({ theme: 'dark' });
  w.document.querySelector('[data-ui-theme="light"]').click();
  expect(setUiTheme).toHaveBeenLastCalledWith({ theme: 'light' });
  const callCount = setUiTheme.mock.calls.length;
  w.onSettingChange('themeBackground', 'ocean');
  expect(setUiTheme).toHaveBeenCalledTimes(callCount);
  expect(w.document.documentElement.dataset.lbUiTheme).toBe('light');
});

it.each(['?dev&cutout', '?demo&cutout'])('does not enable the QA API or mock cutout with %s', async query => {
  const invoke = vi.fn().mockResolvedValue(null);
  game = await loadGame(false, invoke, null, undefined, null, window => window.history.replaceState(null, '', query));
  expect(game.w.__LB_QA).toBeUndefined();
  expect(game.w.document.documentElement.hasAttribute('data-lb-qa-cutout')).toBe(false);
  expect(invoke).toHaveBeenCalledWith('load_save');
});

it('mocks a legacy safe-area inset in QA without a native cutout API', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => {
    window.history.replaceState(null, '', '?dev&demo&cutout');
  });
  const { w } = game;
  const root = w.document.documentElement;
  expect(root.hasAttribute('data-lb-qa-cutout')).toBe(true);
  expect(root.style.getPropertyValue('--safe-area-inset-top')).toBe('40px');
  expect(root.dataset.lbCutout).toBeUndefined();
  expect(w.__lbWindowInsets).toBeUndefined();
});

it.each([['hole', 41, 21], ['notch', 49, 158]])('mocks a native %s in QA', async (shape, top, width) => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => {
    window.history.replaceState(null, '', `?dev&demo&cutout=${shape}`);
  });
  const root = game.w.document.documentElement;
  const [rect] = game.w.__lbWindowInsets.rects;
  expect(root.dataset.lbQaCutout).toBe(shape);
  expect(root.style.getPropertyValue('--safe-area-inset-top')).toBe(`${top}px`);
  expect(rect.right - rect.left).toBe(width);
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
    window.localStorage.setItem('linebreaker_funConfig', '{"cols":9}');
    storage = ['getItem', 'setItem', 'removeItem', 'clear'].map(method => vi.spyOn(window.localStorage, method));
  });
  const { w, api, advance } = game;
  const get = id => w.document.getElementById(id);
  const qa = w.__LB_QA;
  const visible = id => expect(get(id)?.classList.contains('hidden')).toBe(false);
  expect(qa).toBeDefined();
  visible('menu-overlay');
  expect(get('mw-mute').getAttribute('aria-label')).toBe('Mute music');
  expect(get('file-setup-overlay').classList.contains('hidden')).toBe(true);
  expect(api.save).toMatchObject({ totalXP: 64000, stats: { gamesPlayed: 12 }, universalParts: { common: 13, rare: 6, epic: 4, legendary: 2, mythic: 1 } });
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
  const gift = qa.open('daily-gift');
  await Promise.resolve();
  advance(100);
  await gift;
  visible('daily-gift-crate-overlay');
  expect(get('daily-gift-crate-overlay').textContent).toContain('Shake crate');
  await qa.open('level-crate');
  visible('inventory-crate-overlay');
  await qa.open('mission-crate');
  visible('inventory-crate-overlay');
  for (const [name, id] of [['pause', 'pause-overlay'], ['game-over', 'go-overlay']]) {
    const opened = qa.open(name);
    await Promise.resolve();
    advance(3000);
    await opened;
    visible(id);
  }
  const bonus = get('go-record-bonus');
  expect(bonus.hidden).toBe(false);
  expect(bonus.parentElement.className).toBe('go-reward-ledger');
  expect(bonus.querySelector('dt').textContent).toBe('Record bonus');
  expect(bonus.querySelector('dd').textContent).toBe(`+${(1854).toLocaleString()} XP`);
  expect(get('go-mode').textContent).toBe('Normal');
  expect(get('go-time').textContent).toBe('04:26');
  expect(get('go-record-label').hidden).toBe(false);
  expect(get('go-record-medal').hidden).toBe(false);
  expect(get('go-total-xp').textContent).toMatch(/^\+.+ XP$/);
  const level = game.api.getLevelInfo(game.api.save.totalXP);
  expect(get('go-xp-progress').textContent).toBe(`${level.currentXP.toLocaleString()} / ${level.neededXP.toLocaleString()} XP to next level`);
  expect(get('go-achievements-new').querySelector('.go-ach-icon').hasAttribute('style')).toBe(false);
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
  expect(JSON.parse(w.localStorage.getItem('linebreaker_settings'))).toEqual(diskSettings);
  expect(w.localStorage.getItem('linebreaker_funConfig')).toBe('{"cols":9}');
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
    'settings-home': '.lb102-directory', settings: '#settings-game', 'settings-controls': '#settings-controls', 'settings-audio': '#settings-audio',
    'settings-display': '#settings-display', 'settings-notifications': '#settings-notifications', 'settings-updates': '#settings-updates', 'settings-about': '#settings-about',
    'whats-new-notice': 'dialog[data-release-notes][open]', 'update-postcard': '.lb184-banner', inventory: '[data-invtab-content="crates"]', 'inventory-blocks': '[data-invtab-content="blocks"]',
    'inventory-colors': '[data-invtab-content="colors"]', 'inventory-boosters': '[data-invtab-content="boosters"]',
    'inventory-parts': '[data-invtab-content="parts"]', 'inventory-other': '[data-invtab-content="other"]',
    stats: '#general-stats-container', leaderboard: '#leaderboard-container', pinned: '#pinned-container', highscores: '#highscores-container',
    missions: '#missions-overlay', 'missions-weekly': '#missions-overlay', 'mission-confirm': '#mq-confirm-overlay',
    'season-pass': '#season-pass-overlay', achievements: '#achievements-overlay', playlist: '#playlist-overlay',
    help: '#rules-overlay', tutorial: '#tutorial-overlay', credits: '#credits-overlay', transfer: '#transfer-overlay',
    alert: '#custom-alert', confirm: '#custom-confirm', 'reset-progress': '#reset-phrase-input',
    'color-picker': '#color-picker-modal[open]', 'custom-palette': '#custom-palette-modal[open]', 'palette-preview': '#palette-view-modal', 'palette-editor': '#pal-edit-modal',
    'sfx-preview': '#sfx-preview-modal', 'sfx-panel': '#sfx-panel-modal', 'universal-parts': '#uni-modal-overlay',
    'universal-exchange': '#uni-xch-overlay', 'booster-exchange': '#exc-modal-overlay', 'inventory-sfx': '#sfx-inv-preview',
    'daily-gift': '#lb43-crate-banner', 'level-crate': '#inventory-crate-overlay', 'level-up': '#level-up-popup-overlay', 'mission-crate': '#inventory-crate-overlay',
    'start-animation': '#start-animation-overlay', game: '#app.active-game', pause: '#pause-overlay', 'game-over': '#go-overlay',
  };
  expect(w.__LB_QA.list()).toEqual(Object.keys(targets));
  for (const [name, selector] of Object.entries(targets)) {
    const opened = w.__LB_QA.open(name);
    if (['daily-gift', 'game', 'pause', 'game-over'].includes(name)) {
      await Promise.resolve();
      advance(3000);
    }
    await opened;
    const element = w.document.querySelector(selector);
    expect(element, name).not.toBeNull();
    expect(element.closest('.hidden, [hidden]'), name).toBeNull();
    if (name === 'season-pass') {
      expect(element.querySelector('.lb-topbar-title').textContent).toBe('Season Pass');
      expect(w.document.getElementById('missions-overlay').classList.contains('hidden')).toBe(true);
    }
  }
  await expect(w.__LB_QA.open('typo')).rejects.toThrow('Unknown QA screen');
}, 15_000);

it('shows the level and rank division in level rewards and the rarity in Inventory reveals', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w } = game;
  await w.__LB_QA.open('level-up');
  const popup = w.document.querySelector('#level-up-popup-overlay');
  expect(popup.querySelector('.lb105-level-rank').textContent).toBe('Gold IX');
  expect(popup.querySelector('.lb105-level-emblem span')).toBeNull();
  expect(popup.querySelector('.lb105-level-emblem + .lb105-level-value').textContent).toBe('Level 30');
  expect(popup.querySelector('.lb105-level-emblem polygon').getAttribute('points').split(' ')).toHaveLength(5);
  const common = popup.querySelector('.lb-block-reward > img[src$="crates/common.png"]').closest('.lb-block-reward');
  expect(common.querySelector('.lb-block-reward-amount').textContent).toBe('×4');
  popup.querySelector('button').click();
  expect(popup.isConnected).toBe(false);
  await w.__LB_QA.open('level-crate');
  expect(w.document.querySelector('#inventory-crate-overlay h2').textContent).toBe('Rare crate');
});

it('shows the compact reset time above daily and weekly cards but not on Season', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w, advance } = game;
  const countdown = w.document.querySelector('#mq-countdown');
  const timer = countdown.querySelector('time');
  const dailyRemaining = (5 * 60 + 12) * 60;
  const weeklyRemaining = dailyRemaining + 2 * 86400;
  w.LBNotifications.nextReset = (now, weekly) => +now + (weekly ? weeklyRemaining : dailyRemaining) * 1000;
  await w.__LB_QA.open('missions');
  expect(countdown.closest('.mq-board').getAttribute('aria-labelledby')).toBe('mq-board-title');
  expect(countdown.closest('#mq-mission-view').hidden).toBe(false);
  expect(timer.textContent).toBe('5h 12m');
  expect(timer.dateTime).toBe('P0DT5H12M0S');
  w.document.querySelector('#missions-overlay [data-tab="weekly"]').click();
  advance(1000);
  expect(timer.textContent).toBe('2d 5h 12m');
  expect(timer.dateTime).toBe('P2DT5H12M0S');
  w.document.querySelector('#missions-overlay [data-tab="season"]').click();
  expect(countdown.closest('#missions-overlay').hasAttribute('inert')).toBe(true);
  expect(w.document.querySelector('#season-pass-overlay #mq-countdown')).toBeNull();
});

it('updates the open season countdown at precision boundaries and rollover', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w } = game;
  const { DAY, seasonWindow } = w.LBSeason;
  const period = seasonWindow(w.Date.now());
  const { end } = period;
  const next = seasonWindow(end);
  const hour = DAY / 24;
  const minute = hour / 60;
  let now = end - 3 * DAY;
  w.Date.now = () => now;
  await w.__LB_QA.open('season-pass');
  const countdown = w.document.querySelector('#sp-days');
  expect(countdown.textContent).toBe('3 days left');
  for (const [remaining, label] of [
    [3 * DAY - 1, '2 d 23 h left'],
    [2 * DAY + 14 * hour, '2 d 14 h left'],
    [DAY, '1 d 0 h left'],
    [DAY - 1, '23 h 59 m left'],
    [2 * hour + 14 * minute, '2 h 14 m left'],
    [2 * hour + 14 * minute - 1, '2 h 13 m left'],
    [minute - 1, '<1 m left'],
    [0, `${next.days} days left`],
  ]) {
    now = end - remaining;
    w.dispatchEvent(new w.Event('focus'));
    expect(countdown.textContent).toBe(label);
  }
  expect(w.document.querySelector('#sp-season').textContent).toBe(`Season ${String(period.id + 1).padStart(2, '0')}`);
  expect(w.document.querySelector('#sp-day').textContent).toBe(`Day 1 / ${next.days}`);
});

it('equips owned inventory cards without separate Equip buttons', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w } = game;
  const query = selector => w.document.querySelector(selector);
  const activeSkin = () => query('#owned-skin-btns > [data-equipped="true"]');
  await w.__LB_QA.open('inventory');
  expect(activeSkin()?.dataset.itemKey).toBe('aztec');
  expect(activeSkin().querySelector('[aria-label="Equipped"]')).not.toBeNull();
  expect(query('#owned-skin-btns [data-item-key="outline"][data-owned="false"] [aria-label="Locked"]')).not.toBeNull();
  expect(query('#ghost-section-wrap [data-equipped="true"]').textContent).toContain('White Ghost');

  const retro = query('#owned-skin-btns [aria-label="Equip Retro"]');
  expect(retro.textContent).toBe('');
  retro.click();
  expect(activeSkin()?.dataset.itemKey).toBe('retro');
  expect(w.document.activeElement).toBe(activeSkin());
  expect(query('#owned-skin-btns [data-item-key="aztec"]').dataset.equipped).toBe('false');

  await w.__LB_QA.open('inventory-colors');
  expect(query('#owned-theme-btns [data-equipped="true"]').dataset.itemKey).toBe('default');
  query('#owned-theme-btns [aria-label="Equip Ocean"]').click();
  const ocean = query('#owned-theme-btns [data-equipped="true"]');
  expect(ocean.dataset.itemKey).toBe('ocean');
  expect(ocean.querySelector('.lb-inventory-equipped-label').textContent.trim()).toBe('Equipped');
  expect(query('#owned-palette-btns [data-equipped="true"]').dataset.itemKey).toBe('classic');

  w.__lb.setSave({ ...w.__lb.save, ownedThemes: ['ocean'], parts: { ...w.__lb.save.parts, fire: 2 } });
  w.openInventory();
  const fire = query('#owned-theme-btns [data-item-key="fire"]');
  expect(fire.querySelector('[aria-label="Locked"]')).not.toBeNull();
  expect(fire.querySelector('progress').value).toBe(2);
  expect(fire.querySelector('.lb-inventory-equip-target')).toBeNull();
});

it('keeps SFX Preview independent of equipping an owned pack', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w } = game;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event('close'));
  };
  const query = selector => w.document.querySelector(selector);
  await w.__LB_QA.open('inventory-other');
  expect(query('#owned-grid-style-btns [data-equipped="true"]').dataset.itemKey).toBe('lines');
  const active = () => query('#inventory-sfx-packs [data-equipped="true"]');
  expect(active().textContent).toContain('Default SFX');
  expect(active().querySelector('[aria-label="Equipped"]')).not.toBeNull();
  expect(query('.lb82-sfx-packs [data-owned="false"] progress')).not.toBeNull();
  query('[aria-label="Preview Retro SFX"]').click();
  expect(query('#sfx-inv-preview').textContent).toContain('Retro SFX');
  expect(active().textContent).toContain('Default SFX');
  query('#sfx-inv-preview').close();
  query('[aria-label="Equip Retro SFX"]').click();
  expect(active().dataset.itemKey).toBe('sfxRetro');
  expect(w.document.activeElement).toBe(active());
  expect(query('#sfx-inv-preview')).toBeNull();
});

it('shows plain booster balances and puts the cost inside the exchange dialog', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w, api } = game;
  api.setSave({ ...api.save, boosters: { ...api.save.boosters, '1.25x_game': 7 } });
  await w.__LB_QA.open('inventory-boosters');
  const inventory = w.document.getElementById('inventory-boosters');
  const common = inventory.querySelector('[aria-label="Exchange 1.25× Booster"]');
  expect(common.closest('.lb-inventory-booster').querySelector('.lb-collection-quantity').textContent).toBe('×7');
  const quantityLabel = w.document.getElementById('inventory-quantity');
  expect(quantityLabel.textContent).toBe(`${Object.values(api.save.boosters).reduce((sum, count) => sum + count, 0)} owned`);
  expect(inventory.textContent).not.toContain('Cost: 3 boosters');
  expect(common.disabled).toBe(false);
  expect(inventory.querySelector('[aria-label="Exchange 1.5× Booster"]').disabled).toBe(true);
  common.click();
  const dialog = w.document.getElementById('exc-modal-overlay');
  expect(dialog.textContent).toContain('Trade three boosters for one of the next tier.');
  expect(dialog.querySelector('.lb-exchange-item-balance').textContent).toBe('You have 7');
  expect(dialog.querySelector('.lb-block-reward-amount')).toBeNull();
  expect([...dialog.querySelectorAll('img')].map(img => img.getAttribute('src'))).toEqual([
    'assets/ui/boosters/scroll-common.webp', 'assets/ui/boosters/scroll-rare.webp',
  ]);
  expect(dialog.querySelector('#exc-spend').textContent).toBe('3');
  expect(dialog.querySelector('#exc-receive').textContent).toBe('+1');
  const quantity = dialog.querySelector('#exc-quantity');
  const decrease = dialog.querySelector('[data-quantity-step="-1"]');
  const increase = dialog.querySelector('[data-quantity-step="1"]');
  expect(quantity.type).toBe('number');
  expect(decrease.disabled).toBe(true);
  increase.click();
  expect(quantity.value).toBe('2');
  expect(increase.disabled).toBe(true);
  decrease.click();
  expect(quantity.value).toBe('1');
  quantity.value = '999';
  quantity.dispatchEvent(new w.Event('input'));
  expect(quantity.value).toBe('2');
  expect(dialog.querySelector('#exc-spend').textContent).toBe('6');
  expect(dialog.querySelector('#exc-receive').textContent).toBe('+2');
  dialog.querySelector('.lb-block-btn--primary').click();
  expect(api.save.boosters).toMatchObject({ '1.25x_game': 1, '1.5x_game': 4 });
  expect(inventory.querySelector('[aria-label="Exchange 1.25× Booster"]').disabled).toBe(true);
  expect(inventory.querySelector('[aria-label="Exchange 1.5× Booster"]').disabled).toBe(false);
  expect(quantityLabel.textContent).toBe('6 owned');
  await w.__LB_QA.open('inventory');
  expect(quantityLabel.textContent).toBe('6 owned');
  await w.__LB_QA.open('inventory-blocks');
  expect(quantityLabel.hidden).toBe(true);
});

it('shows the highest earned shape and live counts for the next tier in one row', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w } = game;
  await w.__LB_QA.open('achievements');
  const screen = w.document.getElementById('achievements-overlay');
  const unlocked = screen.querySelector('[data-ach-id="games"][data-state="unlocked"]');
  expect(screen.querySelectorAll('[data-ach-id="games"]')).toHaveLength(1);
  expect(unlocked.querySelector('[aria-label="Bronze earned"]')).not.toBeNull();
  expect(unlocked.querySelector('.ach-card-state').textContent).toBe('12 / 100');
  expect(unlocked.querySelector('progress').value).toBeCloseTo(12 / 100);
  screen.querySelector('[data-achtab="unlocked"]').click();
  expect(screen.querySelector('[data-state="locked"]')).toBeNull();
});

it('queues only affordable whole parts and re-enables controls when a part is removed', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w, api } = game;
  api.setSave({ ...api.save, universalParts: { common: 4, rare: 13.2 } });
  await w.__LB_QA.open('universal-parts');
  const get = id => w.document.getElementById(id);
  const dialog = get('uni-modal-overlay');
  const apply = get('uni-apply-btn');
  expect(apply.disabled).toBe(true);
  expect(dialog.querySelector('.lb-exchange-parts-icon').getAttribute('src')).toBe('assets/ui/parts/universal-rare.webp');
  expect(get('uni-inc-outline')).toBeNull();
  w._uniInc('outline');
  expect(apply.disabled).toBe(true);
  for (let count = 0; count < 13; count++) dialog.querySelector('button[id^="uni-inc-"]:not(:disabled)').click();
  expect(get('uni-avail-lbl').textContent).toBe('0.2 available');
  expect(dialog.querySelector('button[id^="uni-inc-"]:not(:disabled)')).toBeNull();
  expect(apply.disabled).toBe(false);
  dialog.querySelector('button[id^="uni-dec-"]:not([hidden])').click();
  expect(get('uni-avail-lbl').textContent).toBe('1.2 available');
  expect(dialog.querySelector('button[id^="uni-inc-"]:not(:disabled)')).not.toBeNull();
  w._uniDoApply();
  expect(api.save.universalParts).toEqual({ common: 4, rare: 1.2 });
  expect(api.save.parts.outline).toBeUndefined();
});

it('previews and exchanges the selected number of 4-to-1 rarity sets in Inventory', async () => {
  game = await loadGame(true, null, null, fetchDemoAssets, null, window => window.history.replaceState(null, '', '?dev&demo'));
  const { w, api } = game;
  const startXP = 65_000;
  api.setSave({ ...api.save, totalXP: startXP, universalParts: { common: 13.2, rare: 2, mythic: 8 } });
  await w.__LB_QA.open('inventory-parts');
  expect(w.document.querySelectorAll('#inventory-parts [data-use-parts]')).toHaveLength(5);
  expect(w.document.querySelector('[data-exchange-parts="rare"]').disabled).toBe(true);
  expect(w.document.querySelector('[data-exchange-parts="mythic"]')).toBeNull();
  w.document.querySelector('[data-exchange-parts="common"]').click();
  const get = id => w.document.getElementById(id);
  const quantity = get('uni-xch-quantity');
  expect(quantity.value).toBe('1');
  expect(quantity.max).toBe('3');
  quantity.value = '0';
  quantity.dispatchEvent(new w.Event('input'));
  expect(quantity.value).toBe('1');
  quantity.value = '';
  quantity.dispatchEvent(new w.Event('input'));
  expect(quantity.value).toBe('');
  quantity.dispatchEvent(new w.Event('blur'));
  expect(quantity.value).toBe('1');
  quantity.value = '2';
  quantity.dispatchEvent(new w.Event('input'));
  expect(get('uni-xch-count').textContent).toBe('8');
  expect(get('uni-xch-receive').textContent).toBe('+2');
  get('uni-xch-confirm').click();
  expect(api.save.universalParts).toEqual({ common: 5.2, rare: 4, mythic: 8 });
  expect(api.save.totalXP).toBe(startXP);
  expect(w.document.querySelector('[data-exchange-parts="rare"]').disabled).toBe(false);
});
