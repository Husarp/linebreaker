import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadGame } from './loader.js';

const definitions = [
  { id: 'series', cat: 'basic', type: 'tiered', tiers: [
    { name: 'First', rarity: 'common' },
    { name: 'Middle', rarity: 'rare' },
    { name: 'Zebra', rarity: 'epic', progressDisplay: { path: 'series', target: 100 } },
  ] },
  { id: 'basic', cat: 'basic', name: 'Beta', rarity: 'mythic', progress: { path: 'basic', target: 5 } },
  { id: 'secret', cat: 'secret', name: 'Alpha', rarity: 'legendary', clue: 'A clue' },
  { id: 'older', cat: 'secret', name: 'Older', rarity: 'common', clue: 'Another clue' },
];
const earned = {
  series: { tier: 2, tierDates: { 1: '29.12.2025', 2: '01.02.2026' } },
  older: { unlocked: true, unlockedAt: '31.01.2026' },
};
const getProgress = path => ({ series: 70, basic: 2 })[path];

let game;
beforeEach(async () => { game = await loadGame(); game.api.setup(); });
afterEach(() => game?.close());

describe('achievement overview', () => {
  it('counts all tiers and secret badges but excludes every secret from the percentage', () => {
    const { achievementOverview } = game.api;
    const overview = achievementOverview(definitions, earned, getProgress);
    expect(overview.totals).toEqual({ done: 3, total: 6 });
    expect(overview.percent).toBe(50);
    expect(overview.rarities).toEqual({
      common: { done: 2, total: 2 }, rare: { done: 1, total: 1 }, epic: { done: 0, total: 1 },
      legendary: { done: 0, total: 1 }, mythic: { done: 0, total: 1 },
    });
    expect(overview.categories).toEqual({ basic: { done: 2, total: 4 }, secret: { done: 1, total: 2 } });
    expect(achievementOverview([definitions[3]], earned, getProgress).percent).toBe(0);
    const withAnotherSecret = achievementOverview(definitions, { ...earned, secret: { unlocked: true } }, getProgress);
    expect(withAnotherSecret.percent).toBe(50);
    expect(withAnotherSecret.totals.done).toBe(4);
  });

  it('keeps the most recent earned tier and the next tier and sorts by displayed values', () => {
    const { achievementOverview, selectAchievementCards } = game.api;
    const { items } = achievementOverview(definitions, earned, getProgress);
    const names = (tab, sort) => selectAchievementCards(items, tab, sort).map(item => item.name);
    expect(names('all', 'rarity')).toEqual(['Beta', '???', 'Zebra', 'Middle', 'Older']);
    expect(names('locked', 'progress')).toEqual(['Zebra', 'Beta', '???']);
    expect(names('all', 'name')).toEqual(['???', 'Beta', 'Middle', 'Older', 'Zebra']);
    expect(names('all', 'recent')).toEqual(['Middle', 'Older', '???', 'Beta', 'Zebra']);
    expect(names('unlocked', 'recent')).toEqual(['Middle', 'Older']);
    expect(items.find(item => item.name === '???')).toMatchObject({ secretLocked: true, progress: 0 });
    const complete = achievementOverview(definitions, { ...earned, series: { tier: 99 } }, getProgress);
    expect(complete.items.filter(item => item.ach.id === 'series').map(item => item.name)).toEqual(['Zebra']);
  });
});

describe('achievement screen', () => {
  const query = selector => game.w.document.querySelector(selector);
  const filter = tab => query(`[data-achtab="${tab}"]`).click();
  const cards = () => [...game.w.document.querySelectorAll('#ach-list article')];
  const cardTitle = card => card.querySelector('h3').textContent;

  it('shows secret hints without the real name, groups only in Categories, and reveals earned secrets', () => {
    game.w.openAchievements();
    const progress = query('#ach-progress').value;
    const counter = query('#ach-counter').textContent;
    filter('locked');
    expect(query('[data-achtab="locked"]').getAttribute('aria-pressed')).toBe('true');
    const mystery = cards().find(card => card.textContent.includes('Balance is everything.'));
    expect(cardTitle(mystery)).toBe('???');
    expect(mystery.textContent).toContain('RARE');
    expect(mystery.textContent).not.toContain('Mirror Universe');

    filter('categories');
    expect([...game.w.document.querySelectorAll('#ach-list h2')].map(node => node.textContent)).toEqual(['Basic', 'Secret']);
    game.api.setup({ save: { achievements: {
      sec_symmetric_board: { unlocked: true, unlockedAt: '01.02.2026' },
      sec_nice: { unlocked: true, unlockedAt: '31.01.2026' },
    } } });
    filter('unlocked');
    const sort = query('#ach-sort');
    sort.value = 'recent';
    sort.dispatchEvent(new game.w.Event('change'));
    query('#ach-dates-toggle').click();
    expect(cards().map(cardTitle)).toEqual(['Mirror Universe', 'Nice']);
    expect(cards()[0].textContent).toContain('Unlocked on 01.02.2026');
    expect(query('#ach-list h2')).toBeNull();
    expect(query('#ach-progress').value).toBe(progress);
    expect(query('#ach-counter').textContent).toBe(counter.replace(/^0 /, '2 '));
    expect(query('#ach-tier-counts').children).toHaveLength(5);
  });

  it('displays pending rewards in any filter and grants XP only on individual or bulk claim', () => {
    const claims = [
      { id: 'score', name: 'On the Board', rarity: 'common', xp: 500 },
      { id: 'games', name: 'Newbie', rarity: 'common', xp: 500 },
      { id: 'sec_symmetric_board', name: 'Mirror Universe', rarity: 'rare', xp: 1000 },
    ];
    game.api.setup({ save: { pendingAchievementClaims: claims } });
    game.w.openAchievements('unlocked');
    expect(query('#ach-list .lb-empty')).not.toBeNull();
    expect(query('#ach-claims').hidden).toBe(false);
    expect(game.api.save.totalXP).toBe(0);
    query('.lb-ach-claim-row button').click();
    expect(game.api.save.totalXP).toBe(500);
    expect(game.api.save.pendingAchievementClaims.map(claim => claim.id)).toEqual(['games', 'sec_symmetric_board']);
    filter('categories');
    query('#ach-claims .lb-ach-summary-heading button').click();
    expect(game.api.save.totalXP).toBe(2000);
    expect(game.api.save.pendingAchievementClaims).toEqual([]);
    expect(query('#ach-claims').hidden).toBe(true);
    expect(query('[data-achtab="categories"]').getAttribute('aria-pressed')).toBe('true');
  });
});
