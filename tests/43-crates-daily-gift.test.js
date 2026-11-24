import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { afterEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

const context = createContext({ window: {}, Date });
for (const file of ['41-season-pass.js', '44-art-pack.js', 'save-sanitize.js', '43-crates-daily-gift.js']) {
  runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  Object.assign(context, context.window);
}
const { LBCrates: crates, LBSave, sanitizeSave } = context.window;
const defaults = { lastDailyGift: null, lastSeenTime: 0 };
let game;
afterEach(() => game?.close());

it('counts down to local midnight in hours, then minutes', () => {
  for (const [hour, minute, second, label] of [
    [18, 45, 0, 'Next in 5h'], [23, 0, 0, 'Next in 1h'], [23, 1, 0, 'Next in 59m'], [23, 59, 59, 'Next in 1m'],
  ]) expect(crates.nextGiftCountdown(new Date(2026, 10, 23, hour, minute, second))).toBe(label);
  expect(crates.giftStatus({ ...defaults, lastDailyGift: '2026-11-23' }, new Date(2026, 10, 24)).status).toBe('available');
});

it('finishes the three gift shakes at exactly 60% common, 30% rare, and 10% epic', () => {
  const rolls = Array.from({ length: 20 }, (_, index) => (index + 0.5) / 20);
  const start = { day: '2026-11-22', rarity: 'common', taps: 0 };
  const outcomes = { common: 0, rare: 0, epic: 0 };
  for (const first of rolls) for (const second of rolls) for (const third of rolls) {
    const result = [first, second, third].reduce((gift, roll) => crates.shakeGift(gift, roll), start);
    expect(result.taps).toBe(3);
    expect(result.day).toBe(start.day);
    expect(Object.hasOwn(outcomes, result.rarity)).toBe(true);
    outcomes[result.rarity]++;
  }
  expect(outcomes).toEqual({ common: 4800, rare: 2400, epic: 800 });
});

it.each([
  ['common', [80, 20, 0, 0, 0]], ['rare', [50, 40, 10, 0, 0]], ['epic', [25, 40, 30, 5, 0]],
  ['legendary', [10, 30, 35, 25, 0]], ['mythic', [5, 20, 30, 30, 15]],
])('rolls the exact item-part weights for a %s crate', (tier, expected) => {
  const counts = Object.fromEntries(crates.rarities.map(rarity => [rarity, 0]));
  for (let index = 0; index < 100; index++) counts[crates.rollPartRarity(tier, (index + 0.5) / 100)]++;
  expect(Object.values(counts)).toEqual(expected);
});

function dropFixture(counts) {
  const universal = {};
  const hooks = {
    eligibleParts: () => Object.keys(counts).filter(key => counts[key] < 100).map(key => ({ key })),
    partRarity: key => key.split('-')[0], partName: key => key, partCost: () => 100,
    partCount: key => counts[key], addPart: (key, amount) => counts[key] += amount,
    addUniversal: (amount, rarity) => { universal[rarity] = (universal[rarity] || 0) + amount; },
  };
  return { hooks, universal };
}

it.each([
  ['common', 1, {}], ['rare', 3, { rare: 1 }], ['epic', 5, { epic: 1 }],
  ['legendary', 7, { epic: 1, legendary: 1 }], ['mythic', 17, { mythic: 1 }],
])('pays the item and universal counts for a seeded %s crate', (tier, expectedParts, expectedUniversal) => {
  let seed = 287;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const counts = Object.fromEntries(crates.rarities.map(rarity => [rarity, 0]));
  const { hooks, universal } = dropFixture(counts);
  const cards = crates.grantPartDrops(tier, hooks, random);
  expect(Object.values(counts).reduce((total, amount) => total + amount, 0)).toBe(expectedParts);
  expect(cards.filter(card => card.type === 'parts').reduce((total, card) => total + card.amount, 0)).toBe(expectedParts);
  expect(universal).toEqual(expectedUniversal);
  expect(cards.filter(card => card.type === 'universal_parts').every(card => crates.rarities.indexOf(card.rarity) <= crates.rarities.indexOf(tier))).toBe(true);
});

it('groups parts, stops at 100 in the same crate, and never converts missing drops into extra universal parts', () => {
  const counts = { common: 97, 'common-next': 99, 'common-done': 100 };
  const { hooks, universal } = dropFixture(counts);
  expect(crates.grantPartDrops('common', hooks, () => 0.6).map(({ key, amount, desc }) => [key, amount, desc]))
    .toEqual([['common-next', 1, '100/100 parts'], ['common', 1, '98/100 parts']]);
  const cards = crates.grantPartDrops('rare', hooks, () => 0);
  expect(counts).toEqual({ common: 100, 'common-next': 100, 'common-done': 100 });
  expect(cards[0]).toMatchObject({ key: 'common', amount: 2, desc: '100/100 parts' });
  expect(universal).toEqual({ rare: 1 });
});

it('grants one 8-part mythic bundle when possible and only one mythic universal when there is no eligible mythic item', () => {
  const counts = { common: 0, 'mythic-near': 99, 'mythic-new': 0 };
  const { hooks } = dropFixture(counts);
  const cards = crates.grantPartDrops('mythic', hooks, () => 0);
  expect(cards[0]).toMatchObject({ key: 'mythic-new', amount: 8, desc: '8/100 parts' });
  expect(counts['mythic-near']).toBe(99);
  const near = dropFixture({ 'mythic-near': 99 });
  expect(crates.grantPartDrops('mythic', near.hooks, () => 0.99).map(({ amount }) => amount)).toEqual([1, 1]);
  const withoutMythic = dropFixture({ common: 0 });
  expect(crates.grantPartDrops('mythic', withoutMythic.hooks, () => 0.99))
    .toEqual([expect.objectContaining({ type: 'universal_parts', rarity: 'mythic', amount: 1 })]);
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
  expect(sanitizeSave(LBSave.serializeSave(valid), defaults)).toMatchObject({ schemaVersion: 4, lastDailyGift: valid.lastDailyGift, lastSeenTime: now });
  for (const invalid of ['123', -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER]) {
    expect(sanitizeSave({ ...valid, lastSeenTime: invalid }, defaults).lastSeenTime).toBe(0);
  }
  expect(sanitizeSave({ ...valid, lastDailyGift: '2026-02-31' }, defaults).lastDailyGift).toBeNull();
  expect(sanitizeSave(valid, defaults)).not.toHaveProperty('dailyGiftStreak');
});

it('saves shake progress and pays a daily crate once, on the spot after the third tap', async () => {
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
  window.Math.random = () => 0;
  gift.click();
  gift.click();
  advance(16);
  expect(api.save.storedCrates || []).toHaveLength(0);
  advance(16);
  const dialog = () => document.querySelector('#daily-gift-crate-overlay');
  const shake = () => dialog().querySelector('button');
  const art = () => dialog().querySelector('.lb43-crate');
  const today = window.LBSave.localDate(new window.Date());
  expect(api.save.pendingDailyGift).toEqual({ day: today, taps: 0, rarity: 'common' });
  expect(art().dataset.rarity).toBe('common');
  shake().click();
  expect(art().dataset.rarity).toBe('rare');
  expect(art().classList.contains('lb43-crate-shaking')).toBe(true);
  expect(api.save).toMatchObject({ pendingDailyGift: { day: today, taps: 1, rarity: 'rare' }, universalParts: {}, boosters: {} });
  await window.flushLinebreakerSave();
  dialog().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  api.applyLoadedData(writes.at(-1));
  gift.click();
  advance(16);
  advance(16);
  expect(art().dataset.rarity).toBe('rare');
  shake().click();
  expect(art().dataset.rarity).toBe('rare');
  expect(api.save.universalParts).toEqual({});
  shake().click();
  expect(shake().textContent).toBe('Skip animation');
  expect(api.save).toMatchObject({ lastDailyGift: today, pendingDailyGift: null, storedCrates: [], universalParts: { epic: 1 }, boosters: { '1.5x_game': 2 } });
  expect(gift.dataset.status).toBe('claimed');
  await window.flushLinebreakerSave();
  expect(writes.at(-1)).toMatchObject({ lastDailyGift: today, pendingDailyGift: null, storedCrates: [], universalParts: { epic: 1 } });
  expect(writes.at(-1).stats.cratesCollected).toEqual({ epic: 1 });
  advance(230);
  expect(dialog().dataset.reveal).toBe('opening');
  expect(art().dataset.frame).toBe('closed');
  advance(120);
  expect(art().dataset.frame).toBe('ajar');
  advance(160);
  expect(art().dataset.frame).toBe('open');
  expect(dialog().querySelector('.lb43-crate-flight')).not.toBeNull();
  dialog().click();
  expect(dialog().dataset.reveal).toBe('revealed');
  expect(dialog().querySelector('.lb43-crate-flight')).toBeNull();
  expect(document.activeElement.textContent).toBe('Done');
  expect(dialog().querySelector('h2').textContent).toBe('Epic crate');
  document.activeElement.click();
  gift.click();
  expect(dialog()).toBeNull();
});

it('discards forged or already-claimed shake states and keeps an unfinished gift over midnight', () => {
  const day = '2026-11-22';
  const valid = { day, taps: 2, rarity: 'rare' };
  const base = { schemaVersion: 1, lastDailyGift: '2026-11-21', pendingDailyGift: valid };
  const restored = sanitizeSave(LBSave.serializeSave(base), defaults);
  expect(restored.pendingDailyGift).toEqual(valid);
  expect(crates.giftStatus(restored, new Date(2026, 10, 23)).status).toBe('in-progress');
  expect(crates.giftStatus(restored, new Date(2026, 10, 21)).status).toBe('clock-blocked');
  for (const pendingDailyGift of [{ ...valid, taps: 3 }, { ...valid, rarity: 'mythic' }, { ...valid, taps: 0 }, { ...valid, day: '2026-02-31' }]) {
    expect(sanitizeSave({ ...base, pendingDailyGift }, defaults).pendingDailyGift).toBeNull();
  }
  expect(sanitizeSave({ ...base, lastDailyGift: day }, defaults).pendingDailyGift).toBeNull();
});

it('uses matching material and universal art without overlaying a skin thumbnail', async () => {
  game = await loadGame();
  const { w } = game;
  const grid = w.LBCrates.rewardGrid([
    { type: 'universal_parts', label: 'Universal Part', rarity: 'rare' },
    { type: 'parts', key: 'aztec-gold', label: 'Aztec Gold Part', rarity: 'common' },
    { type: 'parts', key: 'bubble', label: 'Bubble Part', rarity: 'rare' },
  ]);
  expect([...grid.querySelectorAll('img')].map(image => image.getAttribute('src')))
    .toEqual(['universal-rare.webp', 'part-scroll.webp', 'part-rune.webp'].map(file => `assets/ui/parts/${file}`));
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
  window.matchMedia = () => ({ matches: true });
  gift.click();
  game.advance(16);
  game.advance(16);
  const dialog = window.document.querySelector('#daily-gift-crate-overlay');
  const shake = dialog.querySelector('button');
  for (let tap = 0; tap < 3; tap++) shake.click();
  expect(dialog.dataset.reveal).toBe('revealed');
  expect(dialog.querySelector('.lb43-crate').dataset.frame).toBe('open');
  expect(dialog.querySelector('.lb43-crate-flight')).toBeNull();
  expect(window.document.activeElement.textContent).toBe('Done');
  expect(gift.dataset.status).toBe('claimed');
});

it('merges pending level-ups across reload and opens stored rank crates only through their Open buttons', async () => {
  game = await loadGame();
  const { w: window, api, advance } = game;
  const { document } = window;
  window.matchMedia = () => ({ matches: true });
  api.processLevelUps(4, 6);
  api.processLevelUps(6, 12);
  api.processLevelUps(4, 12);
  const pending = window.LBSave.serializeSave(api.save);
  expect(pending).toMatchObject({ pendingRankRewards: { from: 5, through: 12 }, levelRewardsThrough: 12, storedCrates: [], universalParts: {}, boosters: {} });
  api.applyLoadedData(pending);
  advance(2500);
  const popup = document.querySelector('#level-up-popup-overlay');
  expect(popup.querySelector('h2').textContent).toBe('You reached level 12');
  expect(popup.querySelector('.lb105-level-value').textContent).toBe('Level 12');
  const quantities = [...popup.querySelectorAll('.lb-block-reward')].map(row => [row.querySelector('strong').textContent, row.querySelector('.lb-block-reward-amount').textContent]);
  expect(quantities).toEqual([['Common crate', '×8'], ['Rare crate', '×3'], ['Epic crate', '×1'], ['Rare Universal Part', '×3'], ['1.5x Score Booster', '×1']]);
  expect(popup.querySelector('img[src$="/crates/epic.png"]')).not.toBeNull();
  const collect = popup.querySelector('button');
  expect(collect.textContent).toBe('Collect');
  collect.click();
  collect.click();
  expect(api.save).toMatchObject({ pendingRankRewards: null, universalParts: { rare: 3 }, boosters: { '1.5x_game': 1 }, parts: {} });
  expect(api.save.storedCrates).toEqual(['common', 'rare', 'epic'].flatMap((rarity, index) => Array.from({ length: [8, 3, 1][index] }, () => ({ rarity, source: 'rank' }))));
  api.applyLoadedData(window.LBSave.serializeSave(api.save));
  advance(2500);
  expect(document.querySelector('#level-up-popup-overlay')).toBeNull();
  await window.openInventory('crates');
  const common = document.querySelector('[data-crate-rarity="common"]');
  const card = common.closest('.lb43-locker-card');
  expect(card.textContent).toContain('×8');
  expect(card.dataset.rarity).toBe('common');
  expect(document.querySelector('.lb43-locker-total').textContent).toBe('12 stored');
  card.click();
  card.querySelector('img').click();
  expect(api.save.storedCrates).toHaveLength(12);
  expect(document.querySelector('#inventory-crate-overlay')).toBeNull();
  common.click();
  expect(api.save.storedCrates).toHaveLength(11);
  expect(api.save.universalParts).toEqual({ rare: 3 });
  document.querySelector('#inventory-crate-overlay button').click();
  expect(Array.from(document.querySelectorAll('#inventory-crates button:enabled'), button => button.textContent)).toEqual(['Open', 'Open', 'Open']);
  for (let remaining = 11; remaining > 0; remaining--) {
    document.querySelector('[data-crate-rarity]:enabled').click();
    expect(api.save.storedCrates).toHaveLength(remaining - 1);
    expect(document.querySelector('#inventory-crate-overlay h2').textContent).toMatch(/^(Common|Rare|Epic) crate$/);
    document.querySelector('#inventory-crate-overlay button').click();
  }
  expect(api.save.storedCrates).toEqual([]);
  expect(api.save.universalParts).toEqual({ rare: 6, epic: 1 });
  expect(api.save.stats.rareItemsFromDailyBox).toBe(0);
  expect(document.querySelector('.lb43-locker-total').textContent).toBe('0 stored');
  const emptyCards = [...document.querySelectorAll('.lb43-locker-list [data-empty="true"]')];
  expect(emptyCards).toHaveLength(0);
  expect(document.querySelector('.lb43-locker-list').textContent).toBe('No crates in stock.');
});

it('opens daily and weekly milestones on the spot with three tiers each and never creates a stored crate', async () => {
  game = await loadGame();
  const { w: window, api, advance } = game;
  const { document } = window;
  const save = api.save;
  save.missions.daily.pointsToday = 12;
  save.missions.weekly.points = 180;
  api.setSave(save);
  for (const [tab, thresholds, rarities] of [['daily', [6, 9, 12], ['common', 'common', 'rare']], ['weekly', [60, 90, 120], ['rare', 'rare', 'epic']]]) {
    await window.openMissions(tab);
    expect([...document.querySelectorAll('#mq-milestones button')].map(button => button.getAttribute('aria-label')))
      .toEqual(thresholds.map((points, index) => `Claim ${points} points: ${rarities[index]} crate`));
    for (const [index, points] of thresholds.entries()) {
      const button = document.querySelector(`#mq-milestones button[aria-label^="Claim ${points} "]`);
      const claim = window.Function(button.getAttribute('onclick'));
      claim.call(button);
      claim.call(button);
      advance(16);
      advance(16);
      const dialog = document.querySelector('#inventory-crate-overlay');
      expect(dialog.querySelector('.lb43-crate').dataset.rarity).toBe(rarities[index]);
      expect(dialog.textContent).not.toContain('Shake');
      expect(api.save.missions[tab].claimedMilestones).toEqual(thresholds.slice(0, index + 1));
      expect(api.save.storedCrates).toEqual([]);
      expect(dialog.dataset.reveal).toBe('opening');
      dialog.querySelector('button').click();
      expect(dialog.dataset.reveal).toBe('revealed');
      expect(dialog.querySelector('.lb-reward-card')).not.toBeNull();
      dialog.querySelector('button').click();
    }
  }
  const paid = api.save;
  expect(paid.stats.cratesCollected).toEqual({ common: 2, rare: 3, epic: 1 });
  expect(paid.universalParts).toEqual({ rare: 3, epic: 1 });
  api.applyLoadedData(window.LBSave.serializeSave(paid));
  window._claimMissionMilestone(120, true);
  window._claimMissionMilestone(150, true);
  expect(api.save.parts).toEqual(paid.parts);
  expect(api.save.stats.cratesCollected).toEqual(paid.stats.cratesCollected);
  expect(document.querySelector('.lb64-crate-overlay')).toBeNull();
});

it('finishes the final Daily Gift shake from its Skip button without paying twice', async () => {
  game = await loadGame();
  const { w: window, api, advance } = game;
  const { document } = window;
  api.setup();
  document.getElementById('lb43-daily-gift').click();
  advance(16);
  advance(16);
  const dialog = document.getElementById('daily-gift-crate-overlay');
  for (let tap = 0; tap < 3; tap++) dialog.querySelector('button').click();
  expect(dialog.dataset.reveal).toBe('opening');
  expect(dialog.querySelector('button').textContent).toBe('Skip animation');
  const counts = api.save.stats.cratesCollected;
  dialog.querySelector('button').click();
  expect(dialog.dataset.reveal).toBe('revealed');
  expect(document.activeElement.textContent).toBe('Done');
  expect(api.save.stats.cratesCollected).toEqual(counts);
  advance(2000);
  expect(dialog.querySelector('.lb43-reward-pending, .lb43-crate-flight')).toBeNull();
});

it('flies each reward from the crate mouth, staggers landings, and cleans up when finished', async () => {
  game = await loadGame();
  const { w: window, advance } = game;
  const { document, LBCrates } = window;
  const grid = LBCrates.rewardGrid([
    { type: 'universal_parts', label: 'Common Universal Part', rarity: 'common', amount: 1 },
    { type: 'booster', key: '2xp_game', label: '2× Booster', rarity: 'epic', amount: 1 },
  ]);
  let closed = 0;
  LBCrates.showCrateReveal('mythic', 1, grid, () => closed++);
  const dialog = document.getElementById('inventory-crate-overlay');
  const art = dialog.querySelector('.lb43-crate');
  const [first, second] = grid.children;
  art.querySelector('.lb43-crate-mouth').getBoundingClientRect = () => ({ left: 200, top: 150 });
  first.querySelector('img').getBoundingClientRect = () => ({ left: 45, top: 250, width: 50, height: 40 });
  expect([...art.querySelectorAll('img')].map(image => image.getAttribute('src'))).toEqual(
    ['closed', 'ajar', 'open'].map(frame => `assets/ui/crates/reveal/mythic-${frame}.webp`));
  expect(art.querySelectorAll('.lb43-crate-sparkle')).toHaveLength(14);
  expect(grid.getAttribute('aria-hidden')).toBe('true');
  advance(120);
  expect(art.dataset.frame).toBe('ajar');
  advance(160);
  expect(art.dataset.frame).toBe('open');
  const flights = () => [...dialog.querySelectorAll('.lb43-crate-flight')];
  expect(flights()).toHaveLength(1);
  expect(flights()[0].style.getPropertyValue('--lb43-x')).toBe('130px');
  expect(flights()[0].style.getPropertyValue('--lb43-y')).toBe('-120px');
  expect(flights()[0].style.animationDuration).toBe('560ms');
  advance(80);
  expect(flights()).toHaveLength(2);
  advance(480);
  expect(first.classList.contains('lb43-reward-pending')).toBe(false);
  expect(second.classList.contains('lb43-reward-pending')).toBe(true);
  advance(80);
  expect(flights()).toHaveLength(0);
  expect(grid.hasAttribute('aria-hidden')).toBe(false);
  expect(second.querySelector('img').getAttribute('src')).toBe('assets/ui/boosters/scroll-epic.webp');
  expect(document.activeElement.textContent).toBe('Done');
  document.activeElement.click();
  expect(closed).toBe(1);
});

it('migrates paid reveals and unpaid level boxes once without reissuing a claimed gift', async () => {
  game = await loadGame();
  const { w: window, api } = game;
  const { document } = window;
  window.matchMedia = () => ({ matches: true });
  const paid = { type: 'universal_parts', amount: 3 };
  api.applyLoadedData({ ...api.save, lastDailyGift: window.LBSave.localDate(new window.Date()), dailyGiftStreak: 9,
    universalParts: 9, storedCrates: [{ rarity: 'legendary', source: 'mission', amount: 7 }, { rarity: 'mythic', source: 'daily' }],
    pendingLevelBox: { level: 81, rewards: [paid] }, pendingLevelBoxes: [{ level: 11, rewards: [paid] }],
    pendingMilestoneReward: { level: 20, rewards: [paid] }, pendingMilestoneBoxes: [40] });
  expect(document.querySelector('#lb43-daily-gift').dataset.status).toBe('claimed');
  expect(api.save.storedCrates.map(crate => [crate.rarity, crate.source])).toEqual([
    ['legendary', 'mission'], ['mythic', 'daily'], ['mythic', 'legacy'], ['rare', 'legacy'], ['rare', 'legacy'], ['epic', 'level'],
  ]);
  expect(api.save).not.toHaveProperty('pendingLevelBox');
  expect(api.save).not.toHaveProperty('pendingMilestoneBoxes');
  api.applyLoadedData(window.LBSave.serializeSave(api.save));
  expect(api.save.storedCrates).toHaveLength(6);
  expect(api.save).not.toHaveProperty('dailyGiftStreak');
  await window.openInventory('crates');
  document.querySelector('[data-crate-rarity="rare"]').click();
  expect(document.querySelector('#inventory-crate-overlay').textContent).toContain('×3');
  expect(api.save.universalParts).toEqual({ common: 9 });
  document.querySelector('#inventory-crate-overlay button').click();
  document.querySelector('[data-crate-rarity="epic"]').click();
  expect(api.save.universalParts).toEqual({ common: 9, epic: 1 });
});
