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
  expect(game.w.document.activeElement).toBe(tabs[2]);
  expect(byId('cal-instructions')).toBeNull();
});

it('gives each raw-stat tile a decorative SVG and shares the cleared-line icon with game over', () => {
  const icons = all('.lb-metric-grid dt svg');
  expect(icons).toHaveLength(12);
  const symbols = icons.map(icon => {
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    const reference = icon.querySelector('use').getAttribute('href');
    expect(byId(reference.slice(1))).not.toBeNull();
    return reference;
  });
  expect(new Set(symbols).size).toBe(12);
  expect(query('#stat-lines').previousElementSibling.querySelector('use').getAttribute('href'))
    .toBe(query('#go-overlay .lb-run-icon--lines use').getAttribute('href'));
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

it('shows only highscore history without rewriting saved scores', () => {
  const save = game.api.save;
  save.highscoreHistory = [score(500, 2), score(850), score(720, 4)];
  save.leaderboard = [score(900, 10), score(799, 2), score(715, 4), score(600, 2), score(22, 1), score(5, 0), score(0, 3)];
  game.api.setSave(save);
  game.w.openStats();
  byId('stats-tab-hs').click();
  expect(byId('highscores-container').textContent).not.toContain('Records by speed level');
  expect(all('#highscores-list .lb-score').map(element => element.textContent)).toEqual(['900 pts', '850 pts', '720 pts', '500 pts']);
  expect(query('#highscores-list .lb-stats-podium')).toBeNull();
  expect(all('#highscores-list .lb-rank').map(rank => rank.querySelector('img')?.alt ?? rank.textContent)).toEqual(['#1', '#2', '#3', '#4']);
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
  expect(all('#lb-list .lb-stats-podium-place').map(place => place.dataset.place)).toEqual(['2', '1', '3']);
  const winner = query('#lb-list button[data-place="1"]');
  expect(winner.getAttribute('aria-label')).toBe('Rank 1, Gold: 100 points');
  expect(all('#lb-list .lb-stats-podium-step img').map(crown => crown.getAttribute('src'))).toEqual([
    'assets/ui/crowns/2.png', 'assets/ui/crowns/1.png', 'assets/ui/crowns/3.png',
  ]);
  expect(winner.querySelector('img').alt).toBe('');
  winner.click();
  byId('score-pin-popup').click();
  expect(game.api.save.pinnedScores.map(entry => entry.score)).toEqual([100]);
  expect(all('#lb-list .lb-row')).toHaveLength(47);
  query('#lb-list .lb-load-more').click();
  expect(all('#lb-list .lb-row')).toHaveLength(48);
  all('#lb-list .lb-row').at(-1).click();
  byId('score-pin-popup').click();
  expect(game.api.save.pinnedScores.map(entry => entry.score)).toEqual([100, 50]);
  query('[data-stats-board="fun"]').click();
  expect(byId('lb-list').hidden).toBe(true);
  expect(byId('fun-list').textContent).toContain('12×22');
  byId('stats-tab-pin').click();
  expect(query('#pinned-list .lb-pin-icon svg').getAttribute('width')).toBe('20');
  expect(query('#pinned-list .lb-pin-icon img').alt).toBe('#1');
  for (const icon of ['lines', 'speed']) {
    const reference = query(`#go-overlay .lb-run-icon--${icon} use`).getAttribute('href');
    expect(query(`#pinned-list .lb-run-icon--${icon} use`).getAttribute('href')).toBe(reference);
    expect(byId(reference.slice(1))).not.toBeNull();
  }
  query('#pinned-list .lb-row').click();
  byId('score-pin-popup').click();
  expect(game.api.save.pinnedScores.map(entry => entry.score)).toEqual([100]);
});

it('keeps the neutral pin icon for tied or unmatched runs instead of guessing a place', () => {
  const save = game.api.save;
  const first = score(900, 5, 800);
  const second = score(800, 4, 600);
  save.leaderboard = [first, second, { ...second }];
  save.pinnedScores = [first, second, { ...first, time: first.time + 1 }];
  game.api.setSave(save);
  game.w.openStats();
  byId('stats-tab-pin').click();
  expect(all('#pinned-list .lb-pin-icon').map(pin => pin.querySelector('img')?.alt ?? 'pin')).toEqual(['pin', 'pin', '#1']);
});
