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
  expect(claim.getAttribute('aria-label')).toBe(`Claim +${mission.pts} SP`);
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
  const periodLabel = () => document.getElementById('mq-board-period').textContent;
  expect(document.getElementById('mq-board-title').textContent).toBe('Mission log');
  expect(periodLabel()).toBe('Daily objectives');
  expect(document.querySelector('#mq-countdown time').dateTime).toMatch(/^P/);
  select('weekly').click();
  expect(periodLabel()).toBe('Weekly objectives');
  expect(select('weekly').getAttribute('aria-pressed')).toBe('true');
  select('season').click();
  expect(document.querySelector('#season-pass-overlay .lb-topbar-title').textContent).toBe('Season Pass');
  expect(document.getElementById('missions-overlay').hasAttribute('inert')).toBe(true);
  document.getElementById('mq-back').click();
  expect(document.getElementById('season-pass-overlay').hidden).toBe(true);
  expect(periodLabel()).toBe('Weekly objectives');
  expect(document.getElementById('mq-list-meta').textContent).toMatch(/^\d+ \/ \d+ complete$/);
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
  expect(future.querySelector('.mq-ms-crate--locked').getAttribute('src')).toBe(`assets/ui/crates/${tab === 'daily' ? 'rare' : 'common'}.png`);
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
  expect(toggle().classList.contains('lb-block-btn')).toBe(true);
  const remaining = () => document.querySelector('#mq-swaps-left').textContent;
  expect(remaining()).toBe('1 swap left today');
  game.w._toggleChangeMode();
  const index = select();
  const tier = period[list][index].tier;
  document.querySelector('#mq-confirm-cancel').click();
  const current = () => api.save.missions[tab];
  expect(current().swapDate).toBe('');
  expect(current()[list].map(mission => mission.id)).toEqual(before);
  select();
  document.querySelector('#mq-confirm-ok').click();
  expect(document.querySelector('#mq-confirm-overlay').classList.contains('hidden')).toBe(true);
  expect(current().swapDate).toBe(api.missionDateKey());
  expect(remaining()).toBe('0 swaps left today');
  expect(toggle().disabled).toBe(true);
  expect(current()[list][index]).toMatchObject({ tier, progress: 0, completed: false, ptsClaimed: false });
  expect(current()[list][index].id).not.toBe(before[index]);
  expect(current()[list].filter((mission, slot) => slot !== index).map(mission => mission.id)).toEqual(before.filter((_, slot) => slot !== index));
  expect(current()[points]).toBe(total);
  expect(api.save.universalParts).toBe(parts);
  expect(api.save.missions[tab === 'daily' ? 'weekly' : 'daily'].swapDate).toBe('');
  const after = current()[list][index];
  game.w._changeMission(index, tab === 'weekly');
  document.querySelector('#mq-confirm-ok').click();
  expect(current()[list][index]).toEqual(after);
});

it('shows the golden-zone Universal Part, not a crate, and keeps the claim above 180 points', () => {
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
  expect(locked.querySelector('.mq-ms-crate--locked').src).toContain('/parts/universal-part-128.png');
  weekly.points++;
  weekly.pendingUniversalParts = 1;
  api.setSave(save);
  game.w.renderMissionsOverlay('weekly');
  const claim = [...document.querySelectorAll('.mq-ms-claim-btn')].find(button => button.getAttribute('aria-label').startsWith('Collect +1 Universal Part'));
  expect(claim.querySelector('img').src).toContain('/parts/universal-part-128.png');
});

it('rolls full daily and weekly sets without repeated objectives', () => {
  api.seed(34);
  const dailySeen = new Map(), weeklySeen = new Map();
  const speedMetric = /^(maxSpeed|gamesReachedSpeed[234]|speedRun|speedQueen)$/;
  for (let sample = 0; sample < 384; sample++) {
    const {quests, secret} = api.generateDailyQuests();
    const weekly = api.generateWeeklyMissions();
    expect(quests).toHaveLength(6);
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

it('migrates spent swaps, then resets each at local midnight without replacing weekly missions', () => {
  const { w } = game;
  const RealDate = w.Date;
  let now = new RealDate(2026, 10, 17, 23, 59).getTime();
  w.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  api.refreshMissions();
  const oldSave = api.save;
  for (const tab of ['daily', 'weekly']) {
    delete oldSave.missions[tab].swapDate;
    oldSave.missions[tab].changeUsed = true;
  }
  const originalWeeklyIds = oldSave.missions.weekly.missions.map(mission => mission.id);
  const originalDailyIds = oldSave.missions.daily.quests.map(mission => mission.id);
  api.applyLoadedData(oldSave);
  expect(api.save.missions.daily.swapDate).toBe('2026-11-17');
  expect(api.save.missions.weekly.swapDate).toBe('2026-11-17');
  const migrated = w.LBSave.serializeSave(api.save);
  expect(migrated.missions.weekly).not.toHaveProperty('changeUsed');
  api.applyLoadedData(migrated);
  w.renderMissionsOverlay('weekly');
  const { document } = w;
  expect(document.querySelector('#mq-change-toggle').disabled).toBe(true);
  now = new RealDate(2026, 10, 18).getTime();
  w.renderMissionsOverlay('weekly');
  expect(document.querySelector('#mq-swaps-left').textContent).toBe('1 swap left today');
  expect(document.querySelector('#mq-change-toggle').disabled).toBe(false);
  expect(api.save.missions.weekly.missions.map(mission => mission.id)).toEqual(originalWeeklyIds);
  w.renderMissionsOverlay('daily');
  expect(document.querySelector('#mq-swaps-left').textContent).toBe('1 swap left today');
  expect(api.save.missions.daily.quests.map(mission => mission.id)).not.toEqual(originalDailyIds);
});

it('includes one unlocked mode objective alongside five regular dailies and restores it by ID', () => {
  const modeIds = new Set();
  api.seed(123);
  for (let sample = 0; sample < 12; sample++) {
    const { quests } = api.generateDailyQuests();
    expect(quests).toHaveLength(6);
    expect(['fun_run', 'ghost_lines', 'mirror_lines']).not.toContain(quests.at(-1).id);
  }
  api.setSave({ ...api.save, totalXP: 64000 });
  api.refreshMissions();
  for (let sample = 0; sample < 64; sample++) modeIds.add(api.generateDailyQuests().quests.at(-1).id);
  expect([...modeIds].sort()).toEqual(['fun_run', 'ghost_lines', 'mirror_lines']);
  const save = api.save;
  const legacy = { ...save, missions: { ...save.missions, daily: { ...save.missions.daily, quests: save.missions.daily.quests.slice(0, 5) } } };
  api.applyLoadedData(game.w.LBSave.serializeSave(legacy));
  const after = api.save.missions.daily.quests;
  expect(after).toHaveLength(6);
  expect(after.slice(0, 5).map(quest => quest.id)).toEqual(legacy.missions.daily.quests.map(quest => quest.id));
  api.applyLoadedData(game.w.LBSave.serializeSave(api.save));
  expect(api.save.missions.daily.quests.at(-1)).toEqual(after.at(-1));
});

it('credits mode objectives only in their matching runs and leaves normal progress alone in Fun', () => {
  const { w } = game;
  const missions = api.defaultMissions();
  missions.daily.lastRefreshDate = api.missionDateKey();
  missions.weekly.weekKey = api.missionWeekKey();
  missions.weekly.isoWeekKey = true;
  const objective = metric => ({ id: metric, title: metric, tier: 'easy', metric, target: 1, pts: 2, progress: 0 });
  missions.daily.quests = ['ghostLines', 'mirrorLines', 'funRuns', 'gamesPlayed'].map(objective);
  missions.weekly.missions = [objective('gamesPlayed')];
  api.setup({ save: { totalXP: 64000, missions } });
  const progress = () => api.save.missions.daily.quests.map(quest => quest.progress);
  const clearSingle = () => {
    const cells = Array.from({ length: 22 }, () => Array(10).fill(0));
    cells[21].fill(2);
    api.setBoard(cells);
    api.sweep();
    game.advance(200);
    api.gameOver();
  };
  w.openModeSelect();
  w.selectMode('fun');
  api.gameOver();
  expect(progress()).toEqual([0, 0, 0, 0]);
  api.setup({ save: api.save });
  clearSingle();
  expect(progress()).toEqual([0, 0, 1, 0]);
  expect(api.save.totalXP).toBe(64000);
  expect(api.save.missions.weekly.missions[0].progress).toBe(0);
  api.setup({ save: api.save });
  w.selectMode('normal');
  for (const key of ['optGhost', 'optMirror']) {
    const control = w.document.querySelector(`input[data-play-modifier="${key}"]`);
    if (!control.checked) control.click();
  }
  clearSingle();
  expect(progress()).toEqual([1, 1, 1, 1]);
  expect(api.save.missions.weekly.missions[0].progress).toBe(1);
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
  missions.daily.quests = xpQuests('daily', 25);
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
  expect(progress()).toEqual([[10, 13, 1], [10, 13, 1]]);
  expect(results.textContent).not.toContain('Mission progress');
  game.w.useScoreBooster('2xp_game');
  game.w.useScoreBooster('2xp_game');
  expect(progress()).toEqual([[10, 25, 1], [10, 26, 1]]);
  expect(api.save.missions.daily.quests[1].completed).toBe(true);
  api.setup({save: api.save, scoreMultiplier: 1.3});
  clearSingle();
  expect(progress()).toEqual([[20, 25, 2], [20, 39, 2]]);
  expect(results.textContent).not.toContain('daily total XP');
});
