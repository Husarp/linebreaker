import { afterEach, beforeEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

let game;
const byId = id => game.w.document.getElementById(id);
const query = selector => game.w.document.querySelector(selector);
const all = selector => [...game.w.document.querySelectorAll(selector)];
const score = (value, maxSpeed, xp) => {
  const now = new game.w.Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return { score: value, maxSpeed, xp, date: `${day}.${month}.${now.getFullYear()} 10:30`, lines: 4, time: 90 };
};

beforeEach(async () => { game = await loadGame(); });
afterEach(() => game?.close());

it('opens on general stats and switches exactly four panels by click or keyboard', () => {
  game.w.openStats();
  const tabs = all('#stats-overlay [role="tab"]');
  expect(tabs.map(tab => tab.textContent)).toEqual(['General stats', 'Leaderboard', 'Pinned', 'Highscores']);
  expect(byId('stat-block-usage')).toBeNull();
  expect(byId('stat-activity-calendar').querySelector('#cal-grid')).not.toBeNull();
  const checkSelection = active => {
    expect(all('#stats-overlay [role="tabpanel"]:not([hidden])').map(panel => panel.id)).toEqual([active.getAttribute('aria-controls')]);
    expect(tabs.filter(tab => tab.getAttribute('aria-selected') === 'true')).toEqual([active]);
    expect(tabs.filter(tab => tab.tabIndex === 0)).toEqual([active]);
  };
  checkSelection(tabs[0]);
  tabs[0].dispatchEvent(new game.w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  checkSelection(tabs[3]);
  expect(game.w.document.activeElement).toBe(tabs[3]);
  tabs[2].click();
  checkSelection(tabs[2]);
});

it('shows best counts alongside percentages of unrounded, comparable averages', () => {
  const save = game.api.save;
  Object.assign(save.stats, { gamesPlayed: 120, totalScore: 12000, maxCombo: 6 });
  save.leaderboard = [score(11975, 8, 300), score(8, 1, 100), score(5, 1)];
  game.api.setSave(save);
  game.w.openStats();
  expect(byId('stat-best-score').textContent).toBe((11975).toLocaleString());
  expect(byId('stat-average-score').textContent).toBe('100');
  expect(byId('stat-best-score-pct').textContent).toBe('11975% of your average');
  expect(byId('stat-best-xp').textContent).toBe('300');
  expect(byId('stat-best-xp-pct').textContent).toBe('150% of recorded average XP');
  expect(byId('stat-max-combo').textContent).toBe('×6');
  expect(query('.lb-stats-today .lb-stats-comparison').textContent).toBe("300% of today's average");

  save.stats.totalScore = 12006;
  game.api.setSave(save);
  game.w.statsLbTab('general');
  expect(byId('stat-average-score').textContent).toBe('100');
  expect(byId('stat-best-score-pct').textContent).toBe('11969% of your average');
});

it('renders the full leap-year calendar and exposes counts on hover, tap and keyboard', () => {
  const save = game.api.save;
  save.stats.playHistory = { '2024-02-29': 6 };
  save.leaderboard = [{ score: 75, date: '29.02.2024 10:30' }, { score: 55, date: '03.03.2024 10:30' }];
  game.api.setSave(save);
  game.w.openStats();
  const year = query('button[data-cal-year="2024"]');
  year.click();
  expect(game.w.document.activeElement).toBe(query('button[data-cal-year="2024"]'));
  expect(all('#cal-month-row span').map(month => month.textContent)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  expect(all('#cal-day-labels span').map(day => day.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const days = all('#cal-grid button');
  expect(days).toHaveLength(366);
  expect(days[59].getAttribute('aria-label')).toContain('February 29, 2024 — 6 games');
  expect(days[62].getAttribute('aria-label')).toContain('March 3, 2024 — 1 game');
  expect(days[59].dataset.level).toBe('3');
  const value = query('.lb-stats-day-value');
  const hover = new game.w.Event('pointerover', { bubbles: true });
  Object.defineProperty(hover, 'pointerType', { value: 'mouse' });
  days[59].dispatchEvent(hover);
  expect(value.textContent).toBe(days[59].getAttribute('aria-label'));
  query('#cal-grid').dispatchEvent(new game.w.Event('pointerleave'));
  expect(value.textContent).toBe(days[0].getAttribute('aria-label'));
  days[59].click();
  expect(value.textContent).toBe(days[59].getAttribute('aria-label'));
  days[59].dispatchEvent(new game.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(game.w.document.activeElement).toBe(days[66]);
  expect(days.filter(day => day.tabIndex === 0)).toEqual([days[66]]);
  expect(days.filter(day => day.getAttribute('aria-pressed') === 'true')).toEqual([days[66]]);
  expect(value.textContent).toBe(days[66].getAttribute('aria-label'));
});

it('keeps raw records visible when legacy saves lack a positive average', () => {
  const save = game.api.save;
  save.stats.bestEarnedXP = 500;
  game.api.applyLoadedData({ ...save, schemaVersion: 0, highscore: 125 });
  game.w.openStats();
  expect(byId('stat-best-score').textContent).toBe('125');
  expect(byId('stat-best-xp').textContent).toBe('500');
  expect(byId('stat-best-score-pct').hidden).toBe(true);
  expect(byId('stat-best-xp-pct').hidden).toBe(true);
});

it('shows one best score per known speed in numeric order without rewriting history', () => {
  const save = game.api.save;
  save.highscoreHistory = [score(500, 2), score(850), score(720, 4)];
  save.leaderboard = [score(900, 10), score(799, 2), score(715, 4), score(600, 2), score(22, 1), score(5, 0), score(0, 3)];
  game.api.setSave(save);
  game.w.openStats();
  byId('stats-tab-hs').click();
  expect(all('#highscores-by-speed tbody tr').map(row => [...row.cells].map(cell => cell.textContent))).toEqual([
    ['1', '22'], ['2', '799'], ['4', '720'], ['10', '900'],
  ]);
  expect(all('#highscores-list .lb-score').map(element => element.textContent)).toEqual(['900 pts', '850 pts', '720 pts', '500 pts']);
  expect(query('#highscores-list .lb-stats-current .lb-date').textContent).toContain('CURRENT');
  expect(game.api.save.highscoreHistory).toEqual(JSON.parse(JSON.stringify(save.highscoreHistory)));
  expect(game.api.save.leaderboard).toEqual(JSON.parse(JSON.stringify(save.leaderboard)));
});

it('preserves leaderboard pagination, pin and unpin actions, and the Fun mode board', () => {
  const save = game.api.save;
  save.leaderboard = Array.from({ length: 51 }, (_, index) => score(100 - index, 3, 50));
  save.funLeaderboard = [{ ...score(200, 3), cols: 12, rows: 22 }];
  game.api.setSave(save);
  game.w.openStats();
  byId('stats-tab-lb').click();
  expect(all('#lb-list .lb-stats-podium-place')).toHaveLength(3);
  expect(all('#lb-list .lb-row')).toHaveLength(47);
  query('#lb-list .lb-load-more').click();
  expect(all('#lb-list .lb-row')).toHaveLength(48);
  all('#lb-list .lb-row').at(-1).click();
  byId('score-pin-popup').click();
  expect(game.api.save.pinnedScores.map(entry => entry.score)).toEqual([50]);
  query('[data-stats-board="fun"]').click();
  expect(byId('lb-list').hidden).toBe(true);
  expect(byId('fun-list').textContent).toContain('12×22');
  byId('stats-tab-pin').click();
  query('#pinned-list .lb-row').click();
  byId('score-pin-popup').click();
  expect(game.api.save.pinnedScores).toHaveLength(0);
});
