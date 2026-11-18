import {afterEach, beforeEach, expect, it} from 'vitest';
import {loadGame} from './loader.js';

let game, api;
beforeEach(async () => { game = await loadGame(); api = game.api; api.setup(); });
afterEach(() => game?.close());

it('rolls full daily and weekly sets without repeated objectives', () => {
  api.seed(34);
  const dailySeen = new Map(), weeklySeen = new Map();
  const speedMetric = /^(maxSpeed|gamesReachedSpeed[234]|speedRun|speedQueen)$/;
  for (let sample = 0; sample < 384; sample++) {
    const {quests, secret} = api.generateDailyQuests();
    const weekly = api.generateWeeklyMissions();
    expect(quests).toHaveLength(5);
    expect(weekly).toHaveLength(6);
    for (const [missions, seen] of [[secret ? [...quests, secret] : quests, dailySeen], [weekly, weeklySeen]]) {
      const metrics = missions.map(({metric}) => metric);
      expect(new Set(metrics).size).toBe(missions.length);
      expect(metrics.filter(metric => speedMetric.test(metric)).length).toBeLessThanOrEqual(1);
      expect(metrics.filter(metric => metric === 'tSpins').length).toBeLessThanOrEqual(1);
      for (const mission of missions) seen.set(mission.id, mission);
    }
  }

  expect(dailySeen.get('t_spin_1').target).toBe(1);
  expect(dailySeen.get('t_spin_2').target).toBe(1);
  expect(weeklySeen.get('w_tspin_3').target).toBe(2);
  expect(weeklySeen.get('w_tspin_5').target).toBe(3);
  for (const [seen, prefix] of [[dailySeen, ''], [weeklySeen, 'w_']]) {
    for (const metric of ['raw', 'total']) {
      const targets = ['easy', 'normal', 'hard'].map(tier => {
        const mission = seen.get(`${prefix}${metric}_xp_${tier}`);
        expect(mission).toMatchObject({metric: `${metric}XP`, cumulative: true});
        return mission.target;
      });
      expect(targets[0]).toBeLessThan(targets[1]);
      expect(targets[1]).toBeLessThan(targets[2]);
    }
  }
});

it('excludes same-kind rerolls, including a daily secret and weekly speed variants', () => {
  const current = {id: 'current', tier: 'normal', metric: 'score'};
  const spins = {id: 'spins', tier: 'hard', metric: 'tSpins', completed: true};
  const alternativeSpins = {id: 'alt-spin', tier: 'normal', metric: 'tSpins'};
  const alternativeSpeed = {id: 'alt-speed', tier: 'normal', metric: 'gamesReachedSpeed3'};
  const alternativeScore = {id: 'alt-score', tier: 'normal', metric: 'score'};
  const pool = [current, spins, alternativeSpins, alternativeSpeed, alternativeScore];

  expect(api.missionSwapPool(pool, [current, spins], 0, {metric: 'speedQueen'})).toEqual([alternativeScore]);
  expect(api.missionSwapPool(pool, [current, {metric: 'gamesReachedSpeed2'}, spins], 0)).toEqual([alternativeScore]);
});

it('credits raw and multiplied game XP separately and adds booster XP only once', () => {
  const save = api.save;
  const missions = api.defaultMissions();
  const xpQuests = (prefix, totalTarget) => [
    {id: `${prefix}-raw`, tier: 'easy', metric: 'rawXP', target: 100, cumulative: true, progress: 0},
    {id: `${prefix}-total`, tier: 'easy', metric: 'totalXP', target: totalTarget, cumulative: true, progress: 0},
    {id: `${prefix}-games`, tier: 'easy', metric: 'gamesPlayed', target: 5, cumulative: true, progress: 0},
  ];
  missions.daily.lastRefreshDate = api.missionDateKey();
  missions.daily.quests = xpQuests('daily', 35);
  missions.weekly.weekKey = api.missionWeekKey();
  missions.weekly.isoWeekKey = true;
  missions.weekly.missions = xpQuests('weekly', 100);
  missions.streaks.daily = 6;
  save.missions = missions;
  save.boosters = {'2xp_game': 2};

  const progress = () => {
    const {daily, weekly} = api.save.missions;
    return [daily.quests, weekly.missions].map(quests => quests.map(quest => quest.progress));
  };
  const clearSingle = () => {
    const cells = Array.from({length: 22}, () => Array(10).fill(0));
    cells[21].fill(2);
    api.setBoard(cells);
    api.sweep();
    game.advance(200);
    api.gameOver();
  };

  api.setup({save, scoreMultiplier: 1.3});
  api.gameOver();
  expect(progress()).toEqual([[0, 0, 0], [0, 0, 0]]);
  api.setup({save: api.save, scoreMultiplier: 1.3});
  clearSingle();
  expect(progress()).toEqual([[10, 20, 1], [10, 20, 1]]);
  game.w.useScoreBooster('2xp_game');
  game.w.useScoreBooster('2xp_game');
  expect(progress()).toEqual([[10, 35, 1], [10, 40, 1]]);
  expect(api.save.missions.daily.quests[1].completed).toBe(true);
  api.setup({save: api.save, scoreMultiplier: 1.3});
  clearSingle();
  expect(progress()).toEqual([[20, 35, 2], [20, 60, 2]]);
});
