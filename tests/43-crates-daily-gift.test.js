import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { afterEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

const context = createContext({ window: {}, Date });
for (const file of ['41-season-pass.js', 'save-sanitize.js', '43-crates-daily-gift.js']) {
  runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  Object.assign(context, context.window);
}
const { LBCrates: crates, LBSave, sanitizeSave } = context.window;
const defaults = { lastDailyGift: null, lastSeenTime: 0, dailyGiftStreak: 0 };
let game;
afterEach(() => game?.close());

it('rolls exactly 60/25/10/4/1 and scales each type of reward with rarity', () => {
  const rarities = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  const rollCounts = Object.fromEntries(rarities.map(rarity => [rarity, 0]));
  for (let index = 0; index < 100; index++) rollCounts[crates.rollRarity((index + 0.5) / 100)]++;
  expect(Object.values(rollCounts)).toEqual([60, 25, 10, 4, 1]);
  expect([0.6, 0.85, 0.95, 0.99].map(crates.rollRarity)).toEqual(rarities.slice(1));
  const plans = rarities.map(rarity => crates.giftContents(rarity));
  expect(plans.map(plan => plan.parts)).toEqual([2, 3, 5, 7, 10]);
  expect(plans.map(plan => plan.universal)).toEqual([1, 1, 2, 3, 5]);
  expect(plans.map(plan => plan.boosters)).toEqual([1, 1, 2, 2, 3]);
  expect(crates.giftContents('mythic', 15)).toEqual(crates.giftContents('mythic'));
});

it('claims once per local calendar day without consulting legacy streaks', () => {
  const save = { ...defaults, lastDailyGift: '2026-11-30', dailyGiftStreak: 3, stats: { dailyStreak: 8 } };
  expect(crates.giftStatus(save, new Date(2026, 10, 30, 23, 59, 59))).toEqual({ day: '2026-11-30', status: 'claimed' });
  expect(crates.giftStatus(save, new Date(2026, 11, 1))).toEqual({ day: '2026-12-01', status: 'available' });
  expect(crates.giftStatus(save, new Date(2026, 11, 2))).toEqual({ day: '2026-12-02', status: 'available' });
  expect(save.stats.dailyStreak).toBe(8);
});

it('blocks rollbacks over ten minutes without losing the high-water timestamp', () => {
  const current = new Date(2026, 10, 18, 12).getTime();
  const save = { ...defaults };
  expect(crates.observeTime(save, current)).toBe(true);
  const later = grace => crates.giftStatus(save, new Date(current - grace)).status;
  expect(later(600_000)).toBe('available');
  expect(later(600_001)).toBe('clock-blocked');
  expect(crates.observeTime(save, current - 600_001)).toBe(false);
  expect(save.lastSeenTime).toBe(current);
  expect(later(0)).toBe('available');
  expect(crates.giftStatus({ ...save, lastDailyGift: '2026-11-19' }, new Date(current)).status).toBe('clock-blocked');
});

it('sanitizes and round-trips schema v1 gift fields without truncating millisecond timestamps', () => {
  const now = new Date(2026, 10, 18, 12).getTime();
  const valid = { schemaVersion: 1, lastDailyGift: '2026-11-18', lastSeenTime: now, dailyGiftStreak: 3 };
  expect(sanitizeSave(LBSave.serializeSave(valid), defaults)).toMatchObject(valid);
  for (const invalid of ['123', -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER]) {
    expect(sanitizeSave({ ...valid, lastSeenTime: invalid }, defaults).lastSeenTime).toBe(0);
  }
  expect(sanitizeSave({ ...valid, lastDailyGift: '2026-02-31' }, defaults)).toMatchObject({ lastDailyGift: null, dailyGiftStreak: 3 });
  expect(sanitizeSave({ ...valid, dailyGiftStreak: 6.9 }, defaults).dailyGiftStreak).toBe(6);
});

it('stores one daily crate, then pays it once during the Inventory reveal', async () => {
  const writes = [];
  game = await loadGame(true, async (command, payload) => {
    if (command === 'load_save') return null;
    writes.push(JSON.parse(payload.json));
  });
  const { w: window, api, advance } = game;
  const { document } = window;
  const gift = document.querySelector('#lb43-daily-gift');
  const yesterday = new window.Date(window.Date.now() - 86_400_000);
  api.setup({ save: { lastDailyGift: window.LBSave.localDate(yesterday), dailyGiftStreak: 7 } });
  window.Math.random = () => 0.995;
  gift.click();
  gift.click();
  advance(16);
  expect(api.save.storedCrates || []).toHaveLength(0);
  advance(16);
  const stored = [{ rarity: 'mythic', source: 'daily' }];
  expect(api.save).toMatchObject({ dailyGiftStreak: 7, lastDailyGift: window.LBSave.localDate(new window.Date()), storedCrates: stored, universalParts: 0, boosters: {} });
  expect(writes.at(-1)).toMatchObject({ storedCrates: stored, lastDailyGift: api.save.lastDailyGift, dailyGiftStreak: 7 });
  expect(gift.dataset.status).toBe('claimed');
  expect(document.querySelector('#lb43-crate-banner').textContent).toBe('Mythic crate added to your inventory');
  expect(document.querySelector('#btn-inventory').hasAttribute('data-ready')).toBe(true);
  expect(document.querySelector('.lb64-crate-overlay')).toBeNull();

  await window.openInventory('crates');
  expect(document.querySelector('.lb43-open-all').hidden).toBe(true);
  const open = document.querySelector('[data-crate-rarity="mythic"]');
  open.click();
  open.click();
  const dialog = document.querySelector('#inventory-crate-overlay');
  const art = dialog.querySelector('.lb43-crate');
  expect(art.querySelector('img').getAttribute('src')).toBe('assets/ui/crates/mythic.png');
  expect(art.classList.contains('lb43-crate-opening')).toBe(true);
  expect(api.save).toMatchObject({ storedCrates: [], universalParts: 5, boosters: { '2xp_game': 3 } });
  await window.flushLinebreakerSave();
  expect(writes.at(-1)).toMatchObject({ storedCrates: [], universalParts: 5, boosters: { '2xp_game': 3 } });
  advance(490);
  expect(art.hidden).toBe(true);
  expect(document.activeElement.textContent).toBe('Done');
  expect(dialog.textContent).not.toMatch(/streak|bonus/i);
  document.activeElement.click();
  expect(document.querySelector('#btn-inventory').hasAttribute('data-ready')).toBe(false);
  expect(document.querySelector('.lb43-locker-list').textContent).toBe('No crates in storage.');
});

it('uses the jigsaw for both kinds of part without overlaying a skin thumbnail', async () => {
  game = await loadGame();
  const { w } = game;
  const grid = w.LBCrates.rewardGrid([
    { type: 'universal_parts', label: 'Universal Part', rarity: 'rare' },
    { type: 'parts', key: 'aztec-gold', label: 'Aztec Gold Part', rarity: 'common' },
    { type: 'parts', key: 'bubble', label: 'Bubble Part', rarity: 'common' },
  ]);
  expect([...grid.querySelectorAll('img')].map(image => image.getAttribute('src')))
    .toEqual(Array(3).fill('assets/ui/parts/universal-part-128.png'));
  const [universal, aztec, bubble] = grid.children;
  expect(universal.querySelector('.lb124-part-art')).toBeNull();
  expect(aztec.querySelector('[data-part-key="aztec-gold"] > img:only-child')).not.toBeNull();
  expect(grid.querySelector('.lb124-part-mark')).toBeNull();
  expect(bubble.querySelector('[data-part-key="bubble"] > img')).not.toBeNull();
});

it('persists the high-water timestamp even if the clock rolls back before the first checkpoint', async () => {
  const writes = [];
  game = await loadGame(true, async (command, payload) => {
    if (command === 'load_save') return null;
    writes.push(JSON.parse(payload.json));
  });
  const { w: window, api } = game;
  const originalDate = window.Date;
  const lastSeenTime = originalDate.now();
  const rolledBack = lastSeenTime - 660_000;
  window.Date = class extends originalDate {
    constructor(...args) { super(...(args.length ? args : [rolledBack])); }
    static now() { return rolledBack; }
  };
  window.dispatchEvent(new window.Event('pagehide'));
  expect(writes.at(-1).lastSeenTime).toBe(lastSeenTime);
  api.applyLoadedData(writes.at(-1));
  const gift = window.document.querySelector('#lb43-daily-gift');
  expect(gift.dataset.status).toBe('clock-blocked');
  gift.click();
  expect(api.save.lastDailyGift).toBeNull();
  window.Date = originalDate;
  gift.click();
  game.advance(16);
  game.advance(16);
  expect(gift.dataset.status).toBe('claimed');
});

it('stores earned level and mission crates and opens one per row or all remaining', async () => {
  game = await loadGame();
  const { w: window, api } = game;
  const { document } = window;
  window.matchMedia = () => ({ matches: true });
  api.processLevelUps(9, 10);
  api.processLevelUps(9, 10);
  api.refreshMissions();
  const save = api.save;
  save.missions.weekly.points = 120;
  api.setSave(save);
  window._claimMissionMilestone(120, true);
  window._claimMissionMilestone(120, true);
  expect(window.LBCrates.grantCrate(api.save, 'unknown')).toBe(false);
  const stock = api.save;
  expect(window.LBCrates.grantCrate(stock, 'common')).toBe(true);
  api.setSave(stock);
  expect(api.save.storedCrates).toEqual([
    { rarity: 'common', source: 'level' }, { rarity: 'legendary', source: 'mission', amount: 7 }, { rarity: 'common' },
  ]);
  expect(api.save.parts).toEqual({});
  expect(api.save.universalParts).toBe(0);
  expect(document.querySelector('.lb64-crate-overlay')).toBeNull();
  await window.openInventory('crates');
  const common = document.querySelector('[data-crate-rarity="common"]');
  expect(common.parentElement.textContent).toContain('×2');
  common.click();
  expect(api.save.storedCrates).toHaveLength(2);
  expect(api.save.universalParts).toBe(2);
  document.querySelector('#inventory-crate-overlay button').click();
  const openAll = document.querySelector('.lb43-open-all');
  expect(openAll.hidden).toBe(false);
  openAll.click();
  expect(api.save.storedCrates).toEqual([]);
  expect(api.save.universalParts).toBeGreaterThanOrEqual(3);
  expect(api.save.stats.rareItemsFromDailyBox).toBe(0);
  expect(document.querySelector('#inventory-crate-overlay h2').textContent).toBe('2 crates opened');
  expect(openAll.hidden).toBe(true);
});

it('migrates paid reveals and unpaid level boxes once without reissuing a claimed gift', async () => {
  game = await loadGame();
  const { w: window, api } = game;
  const { document } = window;
  window.matchMedia = () => ({ matches: true });
  const paid = { type: 'universal_parts', amount: 3 };
  api.applyLoadedData({ ...api.save, lastDailyGift: window.LBSave.localDate(new window.Date()), dailyGiftStreak: 9,
    universalParts: 9, pendingLevelBox: { level: 81, rewards: [paid] }, pendingLevelBoxes: [{ level: 11, rewards: [paid] }],
    pendingMilestoneReward: { level: 20, rewards: [paid] }, pendingMilestoneBoxes: [40] });
  expect(document.querySelector('#lb43-daily-gift').dataset.status).toBe('claimed');
  expect(api.save.storedCrates.map(crate => [crate.rarity, crate.source])).toEqual([
    ['mythic', 'legacy'], ['rare', 'legacy'], ['rare', 'legacy'], ['epic', 'level'],
  ]);
  expect(api.save).not.toHaveProperty('pendingLevelBox');
  expect(api.save).not.toHaveProperty('pendingMilestoneBoxes');
  api.applyLoadedData(window.LBSave.serializeSave(api.save));
  expect(api.save.storedCrates).toHaveLength(4);
  expect(api.save.dailyGiftStreak).toBe(9);
  await window.openInventory('crates');
  document.querySelector('[data-crate-rarity="mythic"]').click();
  expect(document.querySelector('#inventory-crate-overlay').textContent).toContain('×3');
  expect(api.save.universalParts).toBe(9);
  document.querySelector('#inventory-crate-overlay button').click();
  document.querySelector('[data-crate-rarity="epic"]').click();
  expect(api.save.universalParts).toBe(11);
});
