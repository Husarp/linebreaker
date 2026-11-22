import {afterEach, beforeEach, expect, it} from 'vitest';
import {loadGame} from './loader.js';

let game, api;
beforeEach(async () => { game = await loadGame(); api = game.api; api.setup(); });
afterEach(() => game?.close());

it.each([['daily', 'quests', 'pointsToday'], ['weekly', 'missions', 'points']])('claims points from the %s card reward action', async (tab, list, points) => {
  api.refreshMissions();
  const save = api.save;
  const mission = save.missions[tab][list][0];
  const total = save.missions[tab][points];
  Object.assign(mission, { progress: mission.target, completed: true, ptsClaimed: false });
  api.setSave(save);
  await game.w.openMissions(tab);

  const card = () => game.w.document.querySelector('[data-mission-slot="0"]');
  const claim = card().querySelector('.mq-card-action--claim > button.lb-block-btn--primary');
  expect(claim.textContent).toBe('Claim');
  expect(claim.getAttribute('aria-label')).toBe(`Claim +${mission.pts} pts`);
  const progress = card().querySelector('progress');
  expect(progress.value).toBe(mission.target);
  expect(progress.max).toBe(mission.target);
  game.w.Function(claim.getAttribute('onclick')).call(claim);
  game.advance(1000);
  expect(api.save.missions[tab][points]).toBe(total + mission.pts);
  expect(api.save.missions[tab][list][0].ptsClaimed).toBe(true);
  expect(game.w.document.querySelector('#missions-body .mq-pts-claim-btn')).toBeNull();
});

it('shows the current period on the board and returns to it from Season Pass', () => {
  const {document} = game.w;
  game.w.renderMissionsOverlay('daily');
  const select = period => document.querySelector(`#missions-overlay [data-tab="${period}"]`);
  const title = () => document.getElementById('mq-board-title').textContent;
  expect(title()).toBe('Today’s board');
  expect(document.querySelector('#mq-countdown time').dateTime).toMatch(/^P/);
  select('weekly').click();
  expect(title()).toBe('This week’s board');
  expect(select('weekly').getAttribute('aria-pressed')).toBe('true');
  select('season').click();
  expect(document.querySelector('#missions-overlay .lb-topbar-title').textContent).toBe('Season Pass');
  expect(document.getElementById('mq-mission-view').hidden).toBe(true);
  document.getElementById('mq-back').click();
  expect(document.getElementById('season-pass-overlay').hidden).toBe(true);
  expect(title()).toBe('This week’s board');
  expect(select('weekly').getAttribute('aria-pressed')).toBe('true');
});

it.each([
  ['daily', 'pointsToday', 10, 6, 9, 12],
  ['weekly', 'points', 100, 60, 90, 120],
])('reveals %s crate rarity only after reaching each milestone', (tab, pointsKey, points, claimed, ready, locked) => {
  api.refreshMissions();
  const save = api.save;
  save.missions[tab][pointsKey] = points;
  save.missions[tab].claimedMilestones = [claimed];
  api.setSave(save);
  game.w.renderMissionsOverlay(tab);

  const {document, LBCrates} = game.w;
  const selector = (threshold, tag) => document.querySelector(`${tag}[aria-label*="${threshold} points:"]`);
  const claim = selector(ready, 'button');
  const done = selector(claimed, '[role="img"]');
  const future = selector(locked, '[role="img"]');
  expect(claim.querySelector('img').getAttribute('src')).toBe(`assets/ui/crates/${LBCrates.missionRarity(ready, tab === 'weekly')}.png`);
  expect(done.querySelector('img').getAttribute('src')).toBe(`assets/ui/crates/${LBCrates.missionRarity(claimed, tab === 'weekly')}.png`);
  expect(done.querySelector('.mq-ms-claimed')).not.toBeNull();
  expect(future.getAttribute('aria-label')).toBe(`${locked} points: locked crate`);
  expect(future.querySelector('.mq-ms-crate--locked').getAttribute('src')).toBe(`assets/ui/crates/${tab === 'daily' ? 'mythic' : 'common'}.png`);
  expect(selector(locked, 'button')).toBeNull();
});

it.each([['daily', 'quests', 'pointsToday'], ['weekly', 'missions', 'points']])('replaces one %s mission and spends only its free swap without an animation', (tab, list, points) => {
  api.refreshMissions();
  const save = api.save;
  const period = save.missions[tab];
  const before = period[list].map(mission => mission.id);
  const parts = save.universalParts;
  const total = period[points];
  game.w.renderMissionsOverlay(tab);
  const { document } = game.w;
  const toggle = () => document.querySelector('#mq-change-toggle');
  const select = () => {
    const button = document.querySelector('.mq-change-overlay');
    const index = Number(button.closest('[data-mission-slot]').dataset.missionSlot);
    game.w._changeMission(index, tab === 'weekly');
    return index;
  };
  expect(toggle().classList.contains('btn-secondary')).toBe(true);
  game.w._toggleChangeMode();
  const index = select();
  const tier = period[list][index].tier;
  document.querySelector('#mq-confirm-cancel').click();
  const current = () => api.save.missions[tab];
  expect(current().changeUsed).toBe(false);
  expect(current()[list].map(mission => mission.id)).toEqual(before);
  select();
  document.querySelector('#mq-confirm-ok').click();
  expect(document.querySelector('#mq-confirm-overlay').classList.contains('hidden')).toBe(true);
  expect(current().changeUsed).toBe(true);
  expect(toggle().disabled).toBe(true);
  expect(current()[list][index]).toMatchObject({ tier, progress: 0, completed: false, ptsClaimed: false });
  expect(current()[list][index].id).not.toBe(before[index]);
  expect(current()[list].filter((mission, slot) => slot !== index).map(mission => mission.id)).toEqual(before.filter((_, slot) => slot !== index));
  expect(current()[points]).toBe(total);
  expect(api.save.universalParts).toBe(parts);
  expect(api.save.missions[tab === 'daily' ? 'weekly' : 'daily'].changeUsed).toBe(false);
  const after = current()[list][index];
  game.w._changeMission(index, tab === 'weekly');
  document.querySelector('#mq-confirm-ok').click();
  expect(current()[list][index]).toEqual(after);
});

it('greys the weekly golden-zone crate until points exceed 180 and keeps the universal-parts claim', () => {
  api.refreshMissions();
  const save = api.save;
  const weekly = save.missions.weekly;
  const { document } = game.w;
  weekly.points = 180;
  weekly.pendingUniversalParts = 0;
  api.setSave(save);
  game.w.renderMissionsOverlay('weekly');
  const locked = document.querySelector('[data-mqctip]');
  expect(locked.getAttribute('aria-label')).toContain('180+ points');
  expect(locked.querySelector('.mq-ms-crate--locked').src).toContain('/crates/mythic.png');
  weekly.points++;
  weekly.pendingUniversalParts = 1;
  api.setSave(save);
  game.w.renderMissionsOverlay('weekly');
  const claim = [...document.querySelectorAll('.mq-ms-claim-btn')].find(button => button.getAttribute('aria-label').startsWith('Collect +1 Universal Part'));
  expect(claim.querySelector('img').src).toContain('/crates/mythic.png');
});

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
    {id: `${prefix}-total`, title: `${prefix} total XP`, pts: 2, tier: 'easy', metric: 'totalXP', target: totalTarget, cumulative: true, progress: 0},
    {id: `${prefix}-games`, tier: 'easy', metric: 'gamesPlayed', target: 5, cumulative: true, progress: 0},
  ];
  missions.daily.lastRefreshDate = api.missionDateKey();
  missions.daily.quests = xpQuests('daily', 35);
  missions.daily.pointsToday = 8;
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
  const results = game.w.document.getElementById('go-overlay');
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
  expect(results.textContent).not.toContain('Mission progress');
  game.w.useScoreBooster('2xp_game');
  game.w.useScoreBooster('2xp_game');
  expect(progress()).toEqual([[10, 35, 1], [10, 40, 1]]);
  expect(api.save.missions.daily.quests[1].completed).toBe(true);
  api.setup({save: api.save, scoreMultiplier: 1.3});
  clearSingle();
  expect(progress()).toEqual([[20, 35, 2], [20, 60, 2]]);
  expect(results.textContent).not.toContain('daily total XP');
});
