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

it('gives raw-stat tiles decorative icons shared with game over and Missions', () => {
  const icons = all('.lb-metric-grid dt svg');
  expect(icons).toHaveLength(11);
  const symbols = icons.map(icon => {
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    const reference = icon.querySelector('use').getAttribute('href');
    expect(byId(reference.slice(1))).not.toBeNull();
    return reference;
  });
  expect(new Set(symbols).size).toBe(11);
  expect(query('#stat-lines').previousElementSibling.querySelector('use').getAttribute('href'))
    .toBe(query('#go-overlay .lb-run-icon--lines use').getAttribute('href'));
  game.w.openMissions();
  const streak = query('.lb-metric-streak .lb-metric-icon');
  expect(streak.getAttribute('aria-hidden')).toBe('true');
  expect(streak.textContent).toBe(query('.mq-streak-flame:not(.mq-streak-flame--watermark)').textContent);
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

it('fits the recent calendar to the available width, ends today and responds to resize', () => {
  const chart = byId('stat-activity-calendar');
  chart.style.padding = '8px';
  let width = 320;
  Object.defineProperty(chart, 'clientWidth', { get: () => width });
  game.w.openStats();
  expect(query('button[data-cal-year="recent"]').textContent).toBe('Last 14 days');
  expect(all('#cal-grid button')).toHaveLength(14);
  const today = query('[aria-current="date"]');
  expect(today).toBe(all('#cal-grid button').at(-1));
  today.dispatchEvent(new game.w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  expect(game.w.document.activeElement).toBe(all('#cal-grid button').at(-2));
  width = 530;
  game.w.dispatchEvent(new game.w.Event('resize'));
  expect(query('button[data-cal-year="recent"]').textContent).toBe('Last 24 days');
  expect(all('#cal-grid button')).toHaveLength(24);
  expect(query('[aria-current="date"]')).toBe(all('#cal-grid button').at(-1));
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
  expect(query('#highscores-list .lb-stats-current .lb-current-tag').textContent).toBe('NOW');
  expect(query('#highscores-list .lb-details-row').textContent).toMatch(/Lines 4.*Time 1m 30s/);
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
  expect(byId('lb-tooltip-global').getAttribute('role')).toBe('dialog');
  expect(byId('lb-tooltip-global').textContent).toContain('Lines: 4');
  expect(byId('score-pin-popup').getAttribute('aria-label')).toBe('Pin score');
  byId('score-pin-popup').click();
  expect(game.api.save.pinnedScores.map(entry => entry.score)).toEqual([100]);
  expect(byId('score-pin-popup').getAttribute('aria-pressed')).toBe('true');
  byId('score-pin-popup').click();
  expect(game.api.save.pinnedScores).toHaveLength(0);
  byId('score-pin-popup').click();
  winner.dispatchEvent(new game.w.Event('scroll'));
  expect(byId('lb-tooltip-global').hidden).toBe(true);
  expect(winner.getAttribute('aria-expanded')).toBe('false');
  expect(all('#lb-list .lb-row')).toHaveLength(47);
  query('#lb-list .lb-load-more').click();
  expect(all('#lb-list .lb-row')).toHaveLength(48);
  all('#lb-list .lb-row').at(-1).click();
  expect(byId('lb-tooltip-global').textContent).toContain('#51');
  byId('score-pin-popup').click();
  expect(game.api.save.pinnedScores.map(entry => entry.score)).toEqual([100, 50]);
  query('[data-stats-board="fun"]').click();
  expect(byId('lb-list').hidden).toBe(true);
  expect(byId('fun-list').textContent).toContain('12×22');
  query('#fun-list .lb-row').click();
  expect(byId('lb-tooltip-global').textContent).toContain('Board: 12×22');
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

it('anchors the score dialog to its row and distinguishes identical stats by played time', () => {
  const save = game.api.save;
  const first = { ...score(900, 5, 800), clock: '10:30' };
  const second = { ...first, clock: '10:31' };
  save.leaderboard = [first, second];
  game.api.setSave(save);
  game.w.openStats();
  byId('stats-tab-lb').click();
  const winner = query('#lb-list button[data-place="1"]');
  winner.getBoundingClientRect = () => ({ left: 100, width: 120, top: 150, bottom: 220 });
  winner.click();
  expect(byId('lb-tooltip-global').style.left).toBe('160px');
  byId('score-pin-popup').click();
  query('#lb-list button[data-place="2"]').click();
  expect(byId('score-pin-popup').getAttribute('aria-pressed')).toBe('false');
  byId('score-pin-popup').click();
  expect(game.api.save.pinnedScores.map(entry => entry.clock)).toEqual(['10:30', '10:31']);
  byId('score-pin-popup').dispatchEvent(new game.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(byId('lb-tooltip-global').hidden).toBe(true);
  expect(game.w.document.activeElement.dataset.place).toBe('2');
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
