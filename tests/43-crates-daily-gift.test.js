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
  const plans = rarities.map(rarity => crates.giftContents(rarity, 1));
  expect(plans.map(plan => plan.parts)).toEqual([2, 3, 5, 7, 10]);
  expect(plans.map(plan => plan.universal)).toEqual([1, 1, 2, 3, 5]);
  expect(plans.map(plan => plan.boosters)).toEqual([1, 1, 2, 2, 3]);
  expect(crates.giftContents('mythic', 2)).toMatchObject({ universal: 6, bonus: 1 });
  expect(crates.giftContents('mythic', 15)).toMatchObject({ universal: 8, bonus: 3 });
});

it('claims once per local calendar day and resets only the gift streak after a missed day', () => {
  const save = { ...defaults, lastDailyGift: '2026-11-30', dailyGiftStreak: 3, stats: { dailyStreak: 8 } };
  expect(crates.giftStatus(save, new Date(2026, 10, 30, 23, 59, 59))).toEqual({ day: '2026-11-30', streak: 3, status: 'claimed' });
  expect(crates.giftStatus(save, new Date(2026, 11, 1))).toEqual({ day: '2026-12-01', streak: 4, status: 'available' });
  expect(crates.giftStatus(save, new Date(2026, 11, 2))).toEqual({ day: '2026-12-02', streak: 1, status: 'available' });
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
  expect(sanitizeSave({ ...valid, lastDailyGift: '2026-02-31' }, defaults)).toMatchObject({ lastDailyGift: null, dailyGiftStreak: 0 });
  expect(sanitizeSave({ ...valid, dailyGiftStreak: 6.9 }, defaults).dailyGiftStreak).toBe(6);
});

it('grants a gift once and persists it before the player opens the animated reveal', async () => {
  const writes = [];
  game = await loadGame(true, async (command, payload) => {
    if (command === 'load_save') return null;
    writes.push(JSON.parse(payload.json));
  });
  const { w: window, api, advance } = game;
  const gift = window.document.querySelector('#lb43-daily-gift');
  window.Math.random = () => 0.995;
  expect(gift.dataset.status).toBe('available');
  const status = window.document.getElementById(gift.getAttribute('aria-describedby'));
  expect(status.textContent).toBe('Gift ready');
  gift.click();
  gift.click();
  expect(gift.getAttribute('aria-busy')).toBe('true');
  advance(16);
  expect(api.save.lastDailyGift).toBeNull();
  advance(16);
  const dialog = window.document.querySelector('#daily-gift-overlay');
  const crate = dialog.querySelector('.lb43-crate');
  expect(crate.querySelector('img').getAttribute('src')).toBe('assets/ui/crates/mythic.png');
  expect(api.save).toMatchObject({ dailyGiftStreak: 1, lastSeenTime: window.Date.now(), lastDailyGift: window.LBSave.localDate(new window.Date()), universalParts: 5, boosters: { '2xp_game': 3 } });
  expect(Object.values(api.save.parts).reduce((total, value) => total + value, 0)).toBe(10);
  expect(writes.at(-1)).toMatchObject({ schemaVersion: 1, lastDailyGift: api.save.lastDailyGift, dailyGiftStreak: 1, lastSeenTime: window.Date.now(), boosters: { '2xp_game': 3 } });
  expect(gift.dataset.status).toBe('claimed');
  expect(status.textContent).toBe('Claimed');
  dialog.querySelector('button').click();
  expect(crate.classList.contains('lb43-crate-opening')).toBe(true);
  advance(490);
  expect(crate.hidden).toBe(true);
  expect(dialog.querySelector('.lb43-crate-cards').parentElement.style.display).toBe('block');
  expect(dialog.querySelector('.lb64-reward-tag')).toBeNull();
  expect(window.document.activeElement.textContent).toBe('Done');
  window.document.activeElement.click();
  expect(window.document.querySelector('#daily-gift-overlay')).toBeNull();
  expect(window.document.activeElement).toBe(gift);
  gift.click();
  expect(window.document.querySelector('#daily-gift-overlay')).toBeNull();
  expect(api.save.boosters['2xp_game']).toBe(3);
});

it('shows the full streak count and a new week of dots, with a separate bonus card', async () => {
  game = await loadGame();
  const { w: window, api } = game;
  const yesterday = new window.Date(window.Date.now() - 86_400_000);
  api.setup({ save: { lastDailyGift: window.LBSave.localDate(yesterday), dailyGiftStreak: 7 } });
  window.Math.random = () => 0;
  window.matchMedia = () => ({ matches: true });
  const document = window.document;
  document.querySelector('#lb43-daily-gift').click();
  game.advance(16);
  game.advance(16);
  const dialog = document.querySelector('#daily-gift-overlay');
  const streak = dialog.querySelector('.lb64-streak');
  expect(streak.getAttribute('aria-label')).toBe('8-day gift streak, day 1 of 7 this cycle');
  expect(streak.querySelector('.lb64-streak-count').textContent).toBe('🔥8');
  expect(streak.querySelector('.mq-streak-flame').getAttribute('aria-hidden')).toBe('true');
  expect(streak.querySelectorAll('.lb64-streak-dots > span')).toHaveLength(7);
  expect(streak.querySelector('.lb64-streak-dots > :first-child').className).toBe('lb64-streak-today');
  dialog.querySelector('button').click();
  const cards = [...dialog.querySelectorAll('.lb-block-reward')];
  const universal = cards.filter(card => card.querySelector('.lb64-reward-name').textContent === 'Universal Part');
  expect(universal.map(card => card.querySelector('.lb-block-reward-amount').textContent)).toEqual(['×1', '×3']);
  expect(universal[0].querySelector('.lb64-reward-tag')).toBeNull();
  expect(universal[1].querySelector('.lb64-reward-tag').textContent).toBe('Streak bonus');
  expect(cards.some(card => card.querySelector('img').getAttribute('src') === 'assets/ui/boosters/common-1.25x.png')).toBe(true);
  expect(api.save.universalParts).toBe(4);
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

it('uses the matching rarity art for rank, level, and mission milestone boxes', async () => {
  game = await loadGame();
  const { w: window, api, advance } = game;
  window.matchMedia = () => ({ matches: true });
  api.setup({ save: { pendingLevelBox: { level: 81, rankName: 'CELESTITE', rewards: [] }, pendingMilestoneBoxes: [40] } });
  api.showLevelBox();
  const document = window.document;
  const rarity = () => document.querySelector('.lb43-crate')?.dataset.rarity;
  expect(rarity()).toBe('mythic');
  document.querySelector('#lb-open-btn').click();
  expect(document.querySelector('.lb43-crate').hidden).toBe(true);
  document.querySelector('#lb-claim-btn').click();
  advance(16);
  advance(16);
  advance(600);
  expect(rarity()).toBe('epic');
  document.querySelector('#lb-open-btn').click();
  const levelCards = [...document.querySelectorAll('#level-box-overlay .lb-block-reward')];
  const universal = levelCards.filter(card => card.querySelector('.lb64-reward-name').textContent === 'Universal Part' && !card.querySelector('.lb64-reward-desc'));
  expect(universal).toHaveLength(1);
  expect(universal[0].querySelector('.lb-block-reward-amount').textContent).toBe('×2');
  document.querySelector('#lb-claim-btn').click();
  advance(16);
  advance(16);
  api.refreshMissions();
  const save = api.save;
  save.missions.weekly.points = 120;
  api.setSave(save);
  window._claimMissionMilestone(120, true);
  expect(rarity()).toBe('legendary');
  document.querySelector('#ms-open-btn').click();
  const missionParts = [...document.querySelectorAll('.lb64-mission-crate .lb-block-reward img')];
  expect(missionParts.length).toBeGreaterThan(0);
  expect(missionParts.every(image => image.getAttribute('src') === 'assets/ui/parts/universal-part-128.png')).toBe(true);
});
