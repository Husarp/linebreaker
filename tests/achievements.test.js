import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadGame } from './loader.js';

let game;
beforeEach(async () => { game = await loadGame(); game.api.setup(); });
afterEach(() => game?.close());

describe('achievement screen', () => {
  const query = selector => game.w.document.querySelector(selector);
  const filter = tab => query(`[data-achtab="${tab}"]`).click();
  const select = (selector, value) => {
    const control = query(selector);
    control.value = value;
    control.dispatchEvent(new game.w.Event('change', { bubbles: true }));
  };
  const sections = () => [...query('#ach-list').children].filter(section => section.querySelector('svg'));
  const sectionNamed = name => sections().find(section => section.firstElementChild.firstElementChild.textContent === name);
  const sectionCount = name => sectionNamed(name).querySelector('.ach-count-label').textContent;
  const badges = name => [...sectionNamed(name).lastElementChild.children];
  const hover = badge => {
    badge.dispatchEvent(new game.w.MouseEvent('mouseenter'));
    return query('#ach-tip').textContent;
  };

  it('counts every earned tier and excludes secrets from the completion numerator and denominator', () => {
    game.w.openAchievements();
    expect(query('#ach-counter').textContent).toBe('0% complete');
    expect(sectionCount('BASIC')).toBe('0 of 119');
    expect(sectionCount('SECRET')).toBe('0 of 59');

    game.api.setup({ save: { achievements: { collector: { tier: 2 }, sec_nice: { unlocked: true } } } });
    game.w.openAchievements();
    expect(query('#ach-counter').textContent).toBe('2% complete');
    expect(query('#ach-secret-counter').textContent).toBe('Secrets 1 of 59');
    expect(sectionCount('BASIC')).toBe('2 of 119');
    expect(sectionCount('SECRET')).toBe('1 of 59');

    game.api.setup({ save: { achievements: { collector: { tier: 2 } } } });
    game.w.openAchievements();
    expect(query('#ach-counter').textContent).toBe('2% complete');
    expect(query('#ach-secret-counter').textContent).toBe('Secrets 0 of 59');
  });

  it('combines the category and status filters without changing completion totals', () => {
    game.api.setup({ save: { achievements: { collector: { tier: 2 }, sec_nice: { unlocked: true } } } });
    game.w.openAchievements();
    expect([...query('#ach-category').options].map(option => option.value)).toEqual(['all', 'basic', 'secret']);
    select('#ach-category', 'secret');
    filter('unlocked');
    expect(sectionNamed('BASIC')).toBeUndefined();
    expect(badges('SECRET').map(hover)).toEqual([expect.stringContaining('Nice')]);
    expect(sectionCount('SECRET')).toBe('1 of 59');
    filter('locked');
    expect(badges('SECRET')).toHaveLength(58);
    expect(badges('SECRET').every(badge => hover(badge).startsWith('???'))).toBe(true);

    select('#ach-category', 'basic');
    expect(sectionNamed('SECRET')).toBeUndefined();
    expect(sectionCount('BASIC')).toBe('2 of 119');
    expect(query('#ach-counter').textContent).toBe('2% complete');
    expect(query('#ach-secret-counter').textContent).toBe('Secrets 1 of 59');
  });

  it('sorts by badge rarity, progress, or latest saved unlock date', () => {
    game.api.setup({ save: { highscore: 800, achievements: {
      score: { tier: 1, tierDates: { 1: '01.02.2026' } },
      games: { tier: 2, tierDates: { 1: '2026-02-02', 2: '2026-01-31' } },
      sec_nice: { unlocked: true, unlockedAt: '31.01.2026' },
      sec_symmetric_board: { unlocked: true, unlockedAt: '2026-02-01' },
    } } });
    game.w.openAchievements();
    select('#ach-sort', 'rarity');
    expect(hover(badges('BASIC')[0])).toContain('LEGENDARY');
    filter('locked');
    const rarityOrder = badges('BASIC').map(hover);
    select('#ach-sort', 'progress');
    const progressOrder = badges('BASIC').map(hover);
    expect(progressOrder.findIndex(text => text.includes('Next: High Roller')))
      .toBeLessThan(rarityOrder.findIndex(text => text.includes('Next: High Roller')));

    filter('unlocked');
    select('#ach-sort', 'recent');
    expect(badges('BASIC').map(hover)).toEqual([expect.stringContaining('On the Board'), expect.stringContaining('Hooked')]);
    expect(badges('SECRET').map(hover)).toEqual([expect.stringContaining('Mirror Universe'), expect.stringContaining('Nice')]);
    select('#ach-sort', 'default');
    expect(hover(badges('BASIC')[0])).toContain('Hooked');
  });

  it('shows the earned tier and the next locked tier, with unlocked badges sorted first by rarity', () => {
    game.api.setup({ save: { highscore: 800, achievements: { score: { tier: 1 }, games: { tier: 2 } } } });
    game.w.openAchievements();
    const basic = badges('BASIC');
    expect(hover(basic[0])).toContain('Hooked');
    expect(hover(basic[1])).toContain('On the Board');
    filter('locked');
    const nextScoreBadge = badges('BASIC').find(badge => hover(badge).includes('Next: High Roller'));
    expect(nextScoreBadge.querySelector('path[stroke-dasharray]').getAttribute('stroke-dasharray')).toBe('80 20');
    filter('unlocked');
    expect(badges('BASIC').map(hover)).toHaveLength(2);
    expect(badges('BASIC').map(hover).some(text => text.includes('Next:'))).toBe(false);
  });

  it('groups badges in Basic and Secret, hides locked secret names, and shows earned dates on hover', () => {
    game.w.openAchievements();
    expect(sections().map(section => section.firstElementChild.firstElementChild.textContent)).toEqual(['BASIC', 'SECRET']);
    filter('locked');
    expect(query('[data-achtab][aria-pressed="true"]').dataset.achtab).toBe('locked');
    const mystery = badges('SECRET').map(hover).find(text => text.includes('Balance is everything.'));
    expect(mystery).toContain('???');
    expect(mystery).not.toContain('Mirror Universe');

    game.api.setup({ save: { achievements: {
      sec_symmetric_board: { unlocked: true, unlockedAt: '2026-02-01' },
      sec_nice: { unlocked: true, unlockedAt: '31.01.2026' },
    } } });
    filter('unlocked');
    expect(sectionNamed('BASIC')).toBeUndefined();
    const beforeDates = badges('SECRET').map(hover);
    expect(beforeDates).toEqual([expect.stringContaining('Nice'), expect.stringContaining('Mirror Universe')]);
    expect(beforeDates.join(' ')).not.toMatch(/01\.02\.2026|31\.01\.2026/);
    query('#ach-dates-toggle').click();
    const [datedNice, datedMirror] = badges('SECRET').map(hover);
    expect(datedNice).toContain('31.01.2026');
    expect(datedMirror).toContain('01.02.2026');
  });

  it('displays pending rewards in any filter and grants XP only on individual or bulk claim', () => {
    const claims = [
      { id: 'score', name: 'On the Board', rarity: 'common', xp: 500 },
      { id: 'games', name: 'Newbie', rarity: 'common', xp: 500 },
      { id: 'sec_symmetric_board', name: 'Mirror Universe', rarity: 'rare', xp: 1000 },
    ];
    game.api.setup({ save: { pendingAchievementClaims: claims } });
    game.w.openAchievements('unlocked');
    expect(query('#ach-list').textContent).toContain('Nothing here yet.');
    expect(query('#ach-list').textContent).toContain('PENDING REWARDS');
    const rareReward = query('.ach-pending-row[data-rarity="rare"]');
    expect(rareReward.querySelector('.ach-pending-rarity').textContent).toBe('RARE');
    expect(rareReward.querySelector('.ach-pending-name').textContent).toBe('Mirror Universe');
    for (const reward of query('#ach-list').querySelectorAll('.ach-pending-row')) {
      expect(reward.textContent).not.toMatch(/\bXP\b/);
    }
    expect(rareReward.querySelector('button').getAttribute('aria-label')).toBe('Claim Mirror Universe');
    expect(game.api.save.totalXP).toBe(0);
    [...query('#ach-list').querySelectorAll('button')].find(button => button.textContent === 'CLAIM').click();
    expect(game.api.save.totalXP).toBe(500);
    expect(game.api.save.pendingAchievementClaims.map(claim => claim.id)).toEqual(['games', 'sec_symmetric_board']);
    filter('locked');
    [...query('#ach-list').querySelectorAll('button')].find(button => button.textContent === 'CLAIM ALL').click();
    expect(game.api.save.totalXP).toBe(2000);
    expect(game.api.save.pendingAchievementClaims).toEqual([]);
    expect(query('#ach-list').textContent).not.toContain('PENDING REWARDS');
    expect(query('[data-achtab][aria-pressed="true"]').dataset.achtab).toBe('locked');
  });
});
