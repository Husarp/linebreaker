import { afterEach, beforeEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

let game, api, window, document;
beforeEach(async () => {
  game = await loadGame();
  ({ api, w: window } = game);
  document = window.document;
});
afterEach(() => game?.close());

const cappedParts = Object.fromEntries('retro glass shadow outline holo journey gem ocean forest fire dragon void sunset arctic midnight sakura ghostColor dots boxes dotboxes sfxCyber sfxRetro sfxZen sfxArcade greyscale ice pastel dark synthwave earth neon'.split(' ').map(key => [key, 30]));

it('keeps spinning by default and advances falling pieces by elapsed time and discrete quarter turns', () => {
  window.openSettings();
  const select = document.getElementById('setting-bg-block-motion');
  expect(select.value).toBe('spinning');
  select.value = 'falling';
  select.dispatchEvent(new window.Event('change'));
  expect(JSON.parse(window.localStorage.getItem('tetrisRPG_settings')).bgBlockMotion).toBe('falling');

  window.Math.random = () => 0;
  const block = api.makeBgBlock(true);
  const initial = { ...block };
  expect(block.turnInterval).toBeGreaterThanOrEqual(16000);
  api.moveBgBlock(block, block.turnInterval - 40);
  expect(block.rot).toBe(0);
  api.moveBgBlock(block, 40);
  expect(block.rot).toBe(Math.PI / 2);
  api.moveBgBlock(initial, initial.turnInterval);
  expect(block.y).toBeCloseTo(initial.y);
  expect(block.x).toBe(initial.x);
  const spinning = api.makeBgBlock(false);
  api.moveBgBlock(spinning, 40);
  expect(spinning.rot).not.toBe(0);

  window.Math.random = () => 0.5;
  expect(api.makeBgBlock(true).turnInterval).toBe(0);
});

it('stops drawing the background during an active game', async () => {
  game.calls.length = 0;
  game.advance(16);
  expect(game.calls.some(([method]) => method === 'rotate')).toBe(true);
  const app = document.getElementById('app');
  app.classList.add('active-game');
  await Promise.resolve();
  game.calls.length = 0;
  game.advance(100);
  expect(game.calls.some(([method]) => method === 'rotate')).toBe(false);
  app.classList.remove('active-game');
  await Promise.resolve();
  game.advance(16);
  expect(game.calls.some(([method]) => method === 'rotate')).toBe(true);
});

it('converts owned parts and formats both singular and grouped conversions', () => {
  api.setup({ save: { ownedSkins: ['neon', 'retro'] } });
  expect(api.grantRewardPart('retro')).toBe(true);
  expect(api.save.parts.retro).toBeUndefined();
  expect(api.save.universalParts).toBe(0.2);
  expect(api.rewardLabel({ type: 'converted_parts', key: 'retro', amount: 1 })).toBe('<s>+1 part (Retro)</s> → +0.2 universal parts');
  expect(api.rewardLabel({ type: 'converted_parts', key: 'ghostColor', amount: 5 })).toBe('<s>+5 parts (Colored Ghost)</s> → +1 universal part');
});

it('shows grouped converted parts in the daily box immediately after the item reaches its cap', () => {
  api.setup({ save: { parts: { ...cappedParts, retro: 9 } } });
  window.Math.random = () => 0.5;
  window.claimDailyGift();
  game.advance(2000);
  const conversion = document.querySelector('#daily-gift-overlay s');
  expect(conversion?.textContent).toBe('+2 parts (Retro)');
  expect(conversion.parentElement.textContent).toContain('→ +0.4 universal parts');
  expect(api.save.parts.retro).toBe(10);
  expect(api.save.universalParts).toBe(0.4);
});

it('shows the conversion when collecting an airdrop', () => {
  api.setup({ save: { parts: cappedParts } });
  window.Math.random = () => 0.5;
  document.getElementById('menu-overlay').classList.remove('hidden');
  api.spawnSpecialBlock();
  for (let frame = 0; frame < 31; frame++) game.advance(100);
  document.dispatchEvent(new window.MouseEvent('click', { clientX: window.innerWidth / 2, clientY: 14 }));
  const conversion = document.querySelector('s');
  expect(conversion?.textContent).toMatch(/^\+1 part \(.+\)$/);
  expect(conversion.parentElement.textContent).toContain('→ +0.2 universal parts');
  expect(api.save.universalParts).toBe(0.2);
});

it('shows mission milestone conversions and restores pending level milestone conversions from save', () => {
  const missions = api.defaultMissions();
  missions.daily.pointsToday = 6;
  api.setup({ save: { parts: cappedParts, missions } });
  window.Math.random = () => 0;
  window._claimMissionMilestone(6, false);
  expect(document.querySelector('.lb-reward-overlay s')?.parentElement.textContent).toBe('+1 part (Retro) → +0.2 universal parts');

  const rewards = api.generateLevelBoxRewards();
  expect(rewards.filter(reward => reward.type === 'converted_parts')).toHaveLength(10);
  const saved = { ...api.save, pendingMilestoneReward: { level: 10, rewards: [{ ...rewards[0], label: '<b>Injected</b>' }, ...rewards.slice(1)] } };
  const clean = window.sanitizeSave(saved, api.save);
  const restored = clean.pendingMilestoneReward.rewards[0];
  expect(restored).not.toHaveProperty('label');
  expect(api.rewardLabel(restored)).toBe('<s>+1 part (Retro)</s> → +0.2 universal parts');
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
  missions.daily.quests = [{ id: 'games_15', title: 'Games', tier: 'hard', metric: 'gamesPlayed', progress: 1, target: 15, cumulative: true }];
  api.setup({ save: { missions } });
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
  } else {
    expect(body.textContent).toContain('Clear a line');
  }
  expect(api.save.missions.daily.quests[0].progress).toBe(1);
  api.gameOver();
  expect(api.save.missions.daily.quests[0].progress).toBe(clearsLine ? 2 : 1);
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
