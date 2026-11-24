import { afterEach, beforeEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

let game, api, window, document;
beforeEach(async () => {
  game = await loadGame();
  ({ api, w: window } = game);
  document = window.document;
});
afterEach(() => game?.close());

const cappedParts = () => Object.fromEntries(api.partsItems().map(({ key }) => [key, api.partCost(key)]));

it('shows grouped legacy conversions in Inventory while escaping reward text', async () => {
  const reward = { type: 'converted_parts', key: 'retro<b>', amount: 2, icon: '<b>icon</b>', desc: '<b>desc</b>', rarity: '<b>rarity</b>' };
  api.setup({ save: { storedCrates: [{ rarity: 'common', source: 'legacy', rewards: [reward] }] } });
  await window.openInventory('crates');
  document.querySelector('[data-crate-rarity="common"]').click();
  const card = document.querySelector('#inventory-crate-overlay .lb-reward-card');
  expect(card.querySelector('.lb64-reward-name').textContent).toBe('Common Universal Part');
  expect(card.querySelector('.lb-block-reward-amount').textContent).toBe('×0.4');
  expect(card.querySelector('.lb64-reward-desc').textContent).toBe('From duplicate Retro<b> parts');
  expect(card.querySelector('.lb-reward-rarity').textContent).toBe(reward.rarity);
  expect(card.querySelector('b')).toBeNull();
});

it('converts unavailable item drops into one universal each in milestone and level crates', () => {
  const missions = api.defaultMissions();
  missions.daily.pointsToday = 6;
  api.setup({ save: { parts: cappedParts(), missions } });
  window.Math.random = () => 0;
  window._claimMissionMilestone(6, false);
  expect(document.querySelector('#inventory-crate-overlay .lb-block-reward strong').textContent).toBe('Common Universal Part');
  expect(api.save.universalParts).toEqual({ common: 1 });
  const rewards = api.generateLevelBoxRewards('legendary');
  expect(rewards).toEqual([
    { type: 'universal_parts', label: 'Epic Universal Part', amount: 1, rarity: 'epic' },
    { type: 'universal_parts', label: 'Legendary Universal Part', amount: 1, rarity: 'legendary' },
    { type: 'universal_parts', label: 'Common Universal Part', amount: 7, rarity: 'common' },
  ]);
});

it('projects best-run, cumulative, and secret progress without mutating missions', () => {
  const daily = { quests: [
    { title: 'Lines', metric: 'linesCleared', target: 5, progress: 3 },
    { title: 'Games', metric: 'gamesPlayed', target: 2, progress: 1, cumulative: true },
  ], secret: { title: 'Double Completion', metric: 'doubleCompletion', target: 1 } };
  const weekly = { missions: [{ metric: 'linesCleared', target: 3 }] };
  const missions = { daily, weekly };
  const before = structuredClone(missions);
  const values = metrics => Array.from(api.previewRunMissions(missions, metrics), row => row.value);
  expect(values(null)).toEqual([3, 1, 0]);
  expect(values({ linesCleared: 2, gamesPlayed: 1 })).toEqual([3, 2, 0]);
  expect(values({ linesCleared: 9, gamesPlayed: 1 })).toEqual([5, 2, 1]);
  expect(api.previewRunMissions(missions, { linesCleared: 9, gamesPlayed: 1 }).at(-1).title).toBe('Secret mission');
  expect(missions).toEqual(before);
});

it.each([false, true])('keeps portrait missions collapsed and only commits a qualifying run (line cleared: %s)', clearsLine => {
  const missions = api.defaultMissions();
  missions.daily.lastRefreshDate = api.missionDateKey();
  missions.weekly.weekKey = api.missionWeekKey();
  missions.weekly.isoWeekKey = true;
  missions.daily.quests = [
    { id: 'games_15', title: 'Games', tier: 'hard', metric: 'gamesPlayed', progress: 1, target: 15, cumulative: true },
    { id: 'raw_xp_easy', title: 'Raw XP', tier: 'easy', metric: 'rawXP', progress: 0, target: 100, cumulative: true },
    { id: 'total_xp_easy', title: 'Total XP', tier: 'easy', metric: 'totalXP', progress: 0, target: 200, cumulative: true },
  ];
  api.setup({ save: { missions }, scoreMultiplier: 1.3 });
  window.innerWidth = 400;
  window.innerHeight = 800;
  document.getElementById('app').classList.add('active-game');
  const panel = document.getElementById('run-missions');
  const toggle = document.getElementById('run-missions-toggle');
  const body = document.getElementById('run-missions-body');
  expect(panel.hidden).toBe(true);
  const select = document.getElementById('setting-run-missions');
  expect(select.value).toBe('off');
  select.value = 'on';
  select.dispatchEvent(new window.Event('change'));
  expect(panel.hidden).toBe(false);
  expect(body.hidden).toBe(true);
  toggle.click();
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(body.textContent).toContain('1 / 15');
  if (clearsLine) {
    const cells = Array.from({ length: 22 }, () => Array(10).fill(0));
    cells.at(-1).fill(1);
    api.setBoard(cells);
    api.sweep();
    game.advance(200);
    api.tick(200);
    expect(body.textContent).toContain('2 / 15');
    expect(body.textContent).toContain('Raw XP10 / 100');
    expect(body.textContent).toContain('Total XP13 / 200');
  } else {
    expect(body.textContent).toContain('Clear a line');
  }
  const progress = () => api.save.missions.daily.quests.map(quest => quest.progress);
  expect(progress()).toEqual([1, 0, 0]);
  api.gameOver();
  expect(progress()).toEqual(clearsLine ? [2, 10, 13] : [1, 0, 0]);
  expect(panel.hidden).toBe(true);
});

it('opens beside the HUD on a wide landscape screen and remains collapsible', () => {
  const app = document.getElementById('app');
  app.classList.add('active-game');
  app.querySelector('.portrait-right').getBoundingClientRect = () => ({ right: 900 });
  window.innerWidth = 1280;
  window.innerHeight = 720;
  window.onSettingChange('showRunMissions', true);
  const panel = document.getElementById('run-missions');
  const toggle = document.getElementById('run-missions-toggle');
  expect(panel.classList.contains('is-beside')).toBe(true);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  toggle.click();
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});
