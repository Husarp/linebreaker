import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadGame } from './loader.js';

let game;
beforeEach(async () => { game = await loadGame(); game.api.setup(); });
afterEach(() => game?.close());

describe('achievement screen', () => {
  const query = selector => game.w.document.querySelector(selector);
  const filter = tab => query(`[data-achtab="${tab}"]`).click();
  const select = (selector, value) => {
    query(`${selector} button`).click();
    query(`${selector}-list [data-value="${value}"]`).click();
  };
  const sections = () => [...query('#ach-list').children].filter(section => section.querySelector('svg'));
  const sectionNamed = name => sections().find(section => section.firstElementChild.firstElementChild.textContent === name);
  const sectionCount = name => sectionNamed(name).querySelector('.ach-count-label').textContent;
  const badges = name => [...sectionNamed(name).lastElementChild.children];
  const hover = badge => {
    badge.dispatchEvent(new game.w.MouseEvent('mouseenter'));
    return query('#ach-tip').textContent;
  };

  it('counts each achievement once and excludes secrets from public completion', () => {
    game.w.openAchievements();
    expect(query('#ach-counter').textContent).toBe('0% complete');
    expect(sectionCount('BASIC')).toBe('0 of 31');
    expect(sectionCount('SECRET')).toBe('0 of 55');

    game.api.setup({ save: { achievements: { collector: { tier: 2 }, sec_nice: { unlocked: true } } } });
    game.w.openAchievements();
    expect(query('#ach-counter').textContent).toBe('3% complete');
    expect(query('#ach-milestone-count').textContent).toBe('1 of 31 unlocked');
    expect(query('#ach-milestone-progress').position).toBeCloseTo(1 / 31);
    expect(query('#achievements-overlay .lb-collection-feature img')).toBeNull();
    expect(query('#ach-secret-counter').textContent).toBe('Secrets 1 of 55');
    expect(sectionCount('BASIC')).toBe('1 of 31');
    expect(sectionCount('SECRET')).toBe('1 of 55');

    game.api.setup({ save: { achievements: { collector: { tier: 2 } } } });
    game.w.openAchievements();
    expect(query('#ach-counter').textContent).toBe('3% complete');
    expect(query('#ach-secret-counter').textContent).toBe('Secrets 0 of 55');
  });

  it('combines the category and status filters without changing completion totals', () => {
    game.api.setup({ save: { achievements: { collector: { tier: 2 }, sec_nice: { unlocked: true } } } });
    game.w.openAchievements();
    expect([...query('#ach-category-list').children].map(option => option.dataset.value)).toEqual(['all', 'basic', 'secret']);
    select('#ach-category', 'secret');
    filter('unlocked');
    expect(sectionNamed('BASIC')).toBeUndefined();
    expect(badges('SECRET').map(hover)).toEqual([expect.stringContaining('Nice')]);
    expect(sectionCount('SECRET')).toBe('1 of 55');
    filter('locked');
    expect(badges('SECRET')).toHaveLength(54);
    expect(badges('SECRET').every(badge => hover(badge).startsWith('???'))).toBe(true);

    select('#ach-category', 'basic');
    expect(sectionNamed('SECRET')).toBeUndefined();
    expect(sectionCount('BASIC')).toBe('1 of 31');
    expect(query('#ach-counter').textContent).toBe('3% complete');
    expect(query('#ach-secret-counter').textContent).toBe('Secrets 1 of 55');
  });

  it('sorts by badge rarity, progress, or latest saved unlock date', () => {
    game.api.setup({ save: { highscore: 1800, stats: { gamesPlayed: 105 }, achievements: {
      score: { tier: 1, tierDates: { 1: '01.02.2026' } },
      games: { tier: 2, tierDates: { 1: '2026-02-02', 2: '2026-01-31' } },
      sec_nice: { unlocked: true, unlockedAt: '31.01.2026' },
      sec_symmetric_board: { unlocked: true, unlockedAt: '2026-02-01' },
    } } });
    game.w.openAchievements();
    select('#ach-sort', 'rarity');
    expect(hover(badges('BASIC')[0])).toContain('Committed');
    expect(badges('BASIC').slice(0, 3).map(badge => badge.dataset.state)).toEqual(['unlocked', 'unlocked', 'locked']);
    filter('unlocked');
    select('#ach-sort', 'progress');
    expect(badges('BASIC').map(row => row.dataset.achId)).toEqual(['score', 'games']);
    select('#ach-sort', 'recent');
    expect(badges('BASIC').map(hover)).toEqual([expect.stringContaining('On the Board'), expect.stringContaining('Committed')]);
    expect(badges('SECRET').map(hover)).toEqual([expect.stringContaining('Mirror Universe'), expect.stringContaining('Nice')]);
    select('#ach-sort', 'default');
    expect(hover(badges('BASIC')[0])).toContain('Committed');
  });

  it('reuses one question-mark graphic until secrets unlock and marks only the earned achievement', () => {
    const icon = badge => badge.querySelector('.ach-card-icon').innerHTML;
    game.w.openAchievements('locked');
    const allSecretIcons = new Set(badges('SECRET').map(icon));
    expect(allSecretIcons.size).toBe(1);

    game.api.setup({ save: { achievements: { sec_nice: { unlocked: true } } } });
    game.w.openAchievements();
    const [nice, mystery] = badges('SECRET');
    expect(hover(nice)).toContain('Nice');
    expect(allSecretIcons.has(icon(nice))).toBe(false);
    expect(allSecretIcons.has(icon(mystery))).toBe(true);
    expect(nice.querySelector('[aria-label="Unlocked"]')).not.toBeNull();
    expect(mystery.querySelector('[aria-label="Unlocked"]')).toBeNull();
    expect(mystery.querySelector('progress')).toBeNull();
  });

  it('provides artwork for every achievement without using text or placeholder glyphs for earned badges', async () => {
    game.close();
    game = await loadGame(true, null, null, undefined, null, window => window.history.replaceState(null, '', '?dev'));
    game.api.setup();
    game.w.devLockAllAchievements();
    game.w.openAchievements('locked');
    const mystery = badges('SECRET')[0].querySelector('.ach-card-icon').innerHTML;

    game.w.devUnlockAllAchievements();
    game.w.openAchievements('unlocked');
    const earned = [...badges('BASIC'), ...badges('SECRET')];
    expect(earned).toHaveLength(86);
    for (const badge of earned) {
      const icon = badge.querySelector('.ach-card-icon');
      expect(icon.querySelector('path[d], use[href]')).not.toBeNull();
      expect(icon.querySelector('text')).toBeNull();
      expect(icon.innerHTML).not.toBe(mystery);
    }
  });

  it('anchors to the glyph instead of the tap, clamps to the screen and flips below near the top', () => {
    game.w.openAchievements();
    const badge = badges('BASIC')[0];
    const tip = query('#ach-tip');
    const icon = badge.querySelector('.ach-card-icon');
    Object.defineProperties(tip, { offsetWidth: { value: 284 }, offsetHeight: { value: 140 } });
    icon.getBoundingClientRect = () => ({ left: 16, width: 30, top: 415, bottom: 445 });
    const tap = (clientX, clientY) => badge.dispatchEvent(new game.w.MouseEvent('click', { bubbles: true, detail: 1, clientX, clientY }));
    tap(9, 411);
    expect(tip.hidden).toBe(false);
    expect(badge.getAttribute('aria-describedby')).toBe('ach-tip');
    expect([tip.style.left, tip.style.top]).toEqual(['10px', '267px']);
    tap(47, 447);
    expect(tip.hidden).toBe(true);
    expect(badge.hasAttribute('aria-describedby')).toBe(false);
    tap(47, 447);
    expect(tip.hidden).toBe(false);
    expect([tip.style.left, tip.style.top]).toEqual(['10px', '267px']);
    tap(47, 447);
    icon.getBoundingClientRect = () => ({ left: game.w.innerWidth - 43, width: 30, top: 100, bottom: 130 });
    tap(8, 8);
    expect([tip.style.left, tip.style.top]).toEqual([`${game.w.innerWidth - 294}px`, '138px']);
  });

  it('uses one trailing slot and toggles the info box even after a hover preview', () => {
    game.api.setup({ save: { achievements: { sec_nice: { unlocked: true } } } });
    game.w.openAchievements();
    const rows = [...query('#ach-list').querySelectorAll('.ach-card')];
    expect(rows.some(row => row.querySelector('.ach-card-state small'))).toBe(true);
    expect(rows.some(row => row.querySelector('.ach-card-state [aria-label="Unlocked"] svg'))).toBe(true);
    expect(rows.every(row => row.querySelector('.ach-card-state > :is(small, .lb-ledger-tag):only-child'))).toBe(true);
    const [badge] = rows;
    hover(badge);
    const tip = query('#ach-tip');
    expect(tip.hidden).toBe(false);
    badge.click();
    expect(tip.hidden).toBe(false);
    badge.click();
    expect(tip.hidden).toBe(true);
  });

  it('lets keyboard users navigate, select and dismiss the themed dropdown', () => {
    game.w.openAchievements();
    const trigger = query('#ach-sort button');
    const list = query('#ach-sort-list');
    const press = (target, key) => target.dispatchEvent(new game.w.KeyboardEvent('keydown', { key, bubbles: true }));
    expect(query('select')).toBeNull();
    trigger.focus();
    press(trigger, 'ArrowDown');
    expect(list.hidden).toBe(false);
    expect(game.w.document.activeElement.dataset.value).toBe('default');
    press(game.w.document.activeElement, 'End');
    press(game.w.document.activeElement, 'Enter');
    expect(list.hidden).toBe(true);
    expect(game.w.document.activeElement).toBe(trigger);
    expect(trigger.textContent).toBe('Recently unlocked');
    trigger.click();
    expect(game.w.document.activeElement.getAttribute('aria-selected')).toBe('true');
    press(game.w.document.activeElement, 'Escape');
    expect(list.hidden).toBe(true);
    trigger.click();
    game.w.document.body.dispatchEvent(new game.w.Event('pointerdown', { bubbles: true }));
    expect(list.hidden).toBe(true);
  });

  it('dismisses on nested scroll, page wheel, drag, outside tap, tab change, and back', () => {
    game.w.openAchievements();
    const tip = query('#ach-tip');
    const badge = badges('BASIC')[0];
    const show = () => { badge.click(); expect(tip.hidden).toBe(false); };
    const pointer = (type, clientY) => badge.dispatchEvent(new game.w.MouseEvent(type, { bubbles: true, clientY }));

    show();
    query('#ach-list').dispatchEvent(new game.w.Event('scroll'));
    expect(tip.hidden).toBe(true);
    expect(badge.hasAttribute('aria-describedby')).toBe(false);
    show();
    game.w.dispatchEvent(new game.w.Event('wheel'));
    expect(tip.hidden).toBe(true);
    show();
    pointer('pointerdown', 200);
    pointer('pointermove', 230);
    pointer('pointerup', 230);
    badge.dispatchEvent(new game.w.MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(tip.hidden).toBe(true);
    show();
    query('#ach-counter').click();
    expect(tip.hidden).toBe(true);
    show();
    filter('locked');
    expect(tip.hidden).toBe(true);
    badges('BASIC')[0].click();
    game.w.closeAchievements();
    expect(tip.hidden).toBe(true);
  });

  it('renders one row and meter per goal, and reveals only earned tier requirements', () => {
    game.api.setup({ save: { highscore: 800, achievements: { score: { tier: 1 }, games: { tier: 2 } } } });
    game.w.openAchievements();
    const score = () => query('#ach-list [data-ach-id="score"]');
    expect(query('#ach-list').querySelectorAll('[data-ach-id="score"]')).toHaveLength(1);
    expect(score().querySelectorAll('progress')).toHaveLength(1);
    expect(score().querySelector('progress').position).toBe(0.4);
    expect(score().textContent).toContain('800 / 2,000');
    score().click();
    const tip = query('#ach-tip');
    expect(tip.textContent).toContain('Bronze — On the Board');
    expect(tip.textContent).toContain('Reach a score of 500');
    expect(tip.querySelector('.ach-tip-reward').textContent).toBe('Reward: +200 XP');
    expect(tip.textContent).not.toMatch(/2,000|10,000|Silver|Gold/);
    expect([...tip.querySelectorAll('svg[data-locked="true"]')].map(shape => shape.getAttribute('aria-label')))
      .toEqual(['Silver locked', 'Gold locked']);
    expect(tip.querySelector('svg[data-tier="bronze"] circle').getAttribute('r')).toBe('5.2');
    score().click();
    expect(tip.hidden).toBe(true);
    filter('locked');
    expect(score()).toBeNull();
    filter('unlocked');
    expect(score()).not.toBeNull();
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

  it('displays pending rewards in any filter and grants legacy XP only on individual claims', () => {
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
    expect(rareReward.querySelector('.lb-ledger-rarity-label').textContent).toBe('RARE');
    expect(rareReward.querySelector('strong').textContent).toBe('Mirror Universe');
    for (const reward of query('#ach-list').querySelectorAll('.ach-pending-row')) {
      expect(reward.textContent).not.toMatch(/\bXP\b/);
    }
    expect(rareReward.querySelector('button').getAttribute('aria-label')).toBe('Claim Mirror Universe');
    expect(game.api.save.totalXP).toBe(0);
    const claim = query('.ach-pending-row .lb-ledger-claim');
    claim.click();
    claim.click();
    expect(claim.getAttribute('aria-busy')).toBe('true');
    game.advance(16);
    expect(game.api.save.totalXP).toBe(0);
    game.advance(16);
    expect(game.api.save.totalXP).toBe(500);
    expect(game.api.save.pendingAchievementClaims.map(claim => claim.id)).toEqual(['games', 'sec_symmetric_board']);
    filter('locked');
    expect(query('.ach-pending-head button')).toBeNull();
    query('.ach-pending-row .lb-ledger-claim').click();
    game.advance(100);
    expect(game.api.save.totalXP).toBe(1000);
    query('.ach-pending-row .lb-ledger-claim').click();
    game.advance(100);
    expect(game.api.save.totalXP).toBe(2000);
    expect(game.api.save.pendingAchievementClaims).toEqual([]);
    expect(query('#ach-list').textContent).not.toContain('PENDING REWARDS');
    expect(query('[data-achtab][aria-pressed="true"]').dataset.achtab).toBe('locked');
  });

  it('queues escalating tier rewards, restores pending crates, and pays each tier once across reloads', () => {
    const { api, w } = game;
    api.setup({ save: { stats: { gamesPlayed: 1000, bestDailyXP: 10000 }, seenArt: [...w.LBArtPack.seenArtIds] } });
    api.checkAchievementsOnLoad();
    const claimsFor = id => api.save.pendingAchievementClaims.filter(claim => claim.id === id);
    const rewardValues = id => claimsFor(id).map(claim => claim.crateRarity || claim.xp);
    expect(rewardValues('games')).toEqual([200, 'rare', 'legendary']);
    expect(rewardValues('daily_xp')).toEqual([200, 'rare', 'epic']);
    expect(rewardValues('art_collector')).toEqual([200, 'common', 'rare']);
    const save = w.LBSave.serializeSave(api.save);
    save.pendingAchievementClaims.push({ ...claimsFor('games')[1] });
    api.applyLoadedData(save, false);
    api.checkAchievementsOnLoad();
    expect(rewardValues('games')).toEqual([200, 'rare', 'legendary']);
    expect(api.save.totalXP).toBe(0);
    expect(api.save.storedCrates).toEqual([]);

    w.openAchievements('unlocked');
    query('[data-ach-id="games"]').click();
    expect([...query('#ach-tip').querySelectorAll('.ach-tip-reward')].map(line => line.textContent))
      .toEqual(['Reward: +200 XP', 'Reward: Rare crate', 'Reward: Legendary crate']);
    expect(query('.ach-pending-row[data-rarity="rare"] small').textContent).toBe('Rare crate');
    for (const [name, rarity] of [['Newbie', 'common'], ['Committed', 'rare'], ['No Life', 'legendary']]) {
      const button = query(`.ach-pending-row[data-rarity="${rarity}"] button[aria-label="Claim ${name}"]`);
      button.click();
      button.click();
      game.advance(100);
    }
    api.applyLoadedData(w.LBSave.serializeSave(api.save), false);
    api.checkAchievementsOnLoad();
    expect(rewardValues('games')).toEqual([]);
    expect(api.save.totalXP).toBe(200);
    expect(api.save.storedCrates).toEqual([
      { rarity: 'rare', source: 'achievement' }, { rarity: 'legendary', source: 'achievement' },
    ]);
  });
});
