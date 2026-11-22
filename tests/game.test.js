import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {loadGame} from './loader.js';
let game, a;
beforeEach(async () => { game = await loadGame(); a = game.api; a.setup(); a.seed(12345); });
afterEach(() => game?.close());
const empty = () => Array.from({length:22}, () => Array(10).fill(0));
describe('SRS-style rotation characterization', () => {
  it.each([1,2,3,4,5,6,7])('piece %i returns after four rotations', type => {
    a.setup({type}); const initial = a.state.player;
    for(let i=0;i<4;i++) a.rotate(1);
    expect(a.state.player).toEqual(initial);
  });
  it.each([1,2,3,4,5,6,7])('piece %i kicks at the right wall', type => {
    a.setup({type}); a.rotate(1);
    for(let i=0;i<12;i++) a.move(1);
    a.rotate(-1);
    const {matrix,pos} = a.state.player;
    matrix.forEach((row,y) => row.forEach((v,x) => {if(v) expect(pos.x+x).toBeLessThan(10);}));
    expect(matrix).toEqual(a.pieces[type].map(r => r.map(v => v ? type : 0)));
  });
  it('undoes rotation when all kick candidates collide', () => {
    const cells = Array.from({length:22}, () => Array(10).fill(7));
    a.setup({cells,type:6,x:3,y:5}); const before = a.state.player;
    a.rotate(1); expect(a.state.player).toEqual(before);
  });
});
it.each([[1,10],[2,30],[3,50],[4,70]])('clears %i rows with current combo scoring', (n,score) => {
  const cells=empty(); for(let y=22-n;y<22;y++) cells[y].fill(2);
  a.setBoard(cells); expect(a.sweep()).toBe(true); game.advance(200);
  expect(a.state.lines).toBe(n); expect(a.state.score).toBe(score);
  expect(a.state.board).toEqual(empty()); expect(a.state.combo).toBe(n);
});
it('adds combo across successive clears', () => {
  for(let i=0;i<2;i++){const b=empty(); b[21].fill(1);a.setBoard(b);a.sweep();game.advance(200);}
  expect(a.state.score).toBe(30); expect(a.state.combo).toBe(2);
});
it('no-clear placement resets combo', () => {
  const b=empty(); b[21].fill(1);a.setBoard(b);a.sweep();game.advance(200);
  a.hardDrop();game.advance(100);expect(a.state.combo).toBe(0);
});
it('holds once until a placement', () => {
  const panel = game.w.document.getElementById('hold-panel');
  const preview = game.w.document.getElementById('pc-hold-canvas');
  expect(panel.hasAttribute('data-empty')).toBe(true);
  const first=a.state.player.matrix;a.hold();expect(a.state.holdPiece).toEqual(first);
  expect(panel.hasAttribute('data-empty')).toBe(false);
  expect(panel.hasAttribute('data-used')).toBe(true);
  expect(preview.getAttribute('aria-label')).toContain('unavailable');
  const held=a.state;a.hold();expect(a.state).toEqual(held);
  a.hardDrop();game.advance(100);expect(a.state.holdUsed).toBe(false);
  expect(panel.hasAttribute('data-used')).toBe(false);
  expect(preview.getAttribute('aria-label')).toBe('Held piece');
  a.hold();expect(a.state.player.matrix).toEqual(first);
});
it('tracks line progress, resets it at the next level, and shows the cap', () => {
  const progress = game.w.document.getElementById('lb-hud-level-progress');
  const label = game.w.document.getElementById(progress.getAttribute('aria-labelledby'));
  const clear = count => {
    const cells = empty();
    cells.slice(-count).forEach(row => row.fill(1));
    a.setBoard(cells);
    a.sweep();
    game.advance(200);
  };
  clear(4);
  expect([progress.value, progress.max, label.textContent]).toEqual([4, 10, 'LV 1 · 4/10 lines']);
  clear(4);
  clear(3);
  expect([progress.value, label.textContent]).toEqual([1, 'LV 2 · 1/10 lines']);
  a.setup({speed: 15});
  a.hardDrop();
  game.advance(100);
  expect([progress.value, label.textContent]).toEqual([10, 'LV 15 · Max']);
});

it.each([false, true])('carries a held touch through a lock (line clear: %s) with fresh DAS', clearsLine => {
  const cells = empty();
  if (clearsLine) {
    cells[21].fill(1);
    cells[21].fill(0, 4, 6);
  }
  a.setup({ cells, type: 4 });
  game.w.document.getElementById('app').classList.add('active-game');
  const input = game.w.LBInput;
  input.press('right', 1);
  expect(a.state.player.pos.x).toBe(4);
  input.action('hard');
  game.advance(100);
  if (clearsLine) game.advance(200);

  const { matrix, pos } = a.state.player;
  const spawnX = 5 - Math.floor(matrix[0].length / 2);
  expect(a.state.lines).toBe(Number(clearsLine));
  expect(pos.x).toBe(spawnX + 1);
  a.tick(0);
  game.advance(159);
  expect(a.state.player.pos.x).toBe(spawnX + 1);
  game.advance(1);
  expect(a.state.player.pos.x).toBe(spawnX + 2);
  input.release(1);
  game.advance(50);
  expect(a.state.player.pos.x).toBe(spawnX + 2);
});
it('each seven-piece bag contains every piece', () => {
  for(let bag=0;bag<10;bag++) {const types=Array.from({length:7},()=>a.nextPiece().flat().find(Boolean));expect(types.sort()).toEqual([1,2,3,4,5,6,7]);}
});
it.each([1,2,5,10,15])('gravity at speed %i uses a strict interval boundary', speed => {
  a.setup({speed}); const interval=Math.floor(1000/speed);
  a.tick(interval);expect(a.state.player.pos.y).toBe(0);
  a.tick(1);expect(a.state.player.pos.y).toBe(1);
});
// Existing regression: checkAchievements calls a missing tier.check before displaying the overlay.
it('game over shows the overlay', () => {a.gameOver();game.advance(1000);expect(a.state.isGameOver).toBe(true);expect(game.w.document.getElementById('go-overlay').classList.contains('hidden')).toBe(false);});
it('shows the best score without recording or awarding XP for a non-record Fun run', () => {
  const { w } = game;
  const get = id => w.document.getElementById(id);
  a.setup({ save: { totalXP: 10000, stats: { ...a.save.stats, bestFunScore: 250 } } });
  w.openModeSelect();
  w.selectMode('fun');
  a.gameOver();
  expect(get('go-mode').textContent).toBe('Fun');
  expect(get('go-best-score').textContent).toBe('250');
  expect(get('go-previous-best').hidden).toBe(false);
  expect(get('go-record-label').hidden).toBe(true);
  expect(get('go-record-medal').hidden).toBe(true);
  expect(get('go-rewards').hidden).toBe(true);
  expect(get('go-pin-btn').hidden).toBe(true);
  expect(a.save.totalXP).toBe(10000);
});
it('spawn collision ends the game and shows overlay', () => {a.setBoard(Array.from({length:22},()=>Array(10).fill(1)));a.spawn();game.advance(1000);expect(a.state.isGameOver).toBe(true);expect(game.w.document.getElementById('go-overlay').classList.contains('hidden')).toBe(false);});
it.each([[0,1,0],[-1,1,0],[999,1,999],[1000,2,0],[9999,10,999],[10000,11,0],[640000,81,0],[664000,82,0]])('XP %i yields level %i', (xp,level,currentXP) => {expect(a.getLevelInfo(xp)).toMatchObject({level,currentXP});if(level>=81)expect(a.getLevelInfo(xp).isCelestite).toBe(true);});
it.each([['2021-01-03','2020-W53'],['2021-01-04','2021-W01'],['2020-12-31','2020-W53'],['2024-12-30','2025-W01']])('ISO week %s', (date,key) => expect(a.missionWeekKey(new game.w.Date(date+'T12:00:00'))).toBe(key));
it('round trips Unicode saves', () => {const text=JSON.stringify({version:3,data:{name:'星 🌈 café',xp:123}});expect(a.decSave(a.encSave(text))).toBe(text);});
it('decodes a legacy TRPG1 fixture', () => {expect(a.decSave('TRPG1:L0caMz0ifUIWJFVHTyw=')).toBe('{"name":"old"}');});
it('rejects unknown and malformed save formats', () => {expect(a.decSave('no')).toBeNull();expect(a.decSave('TRPG2:!!!')).toBeNull();});
it('daily reset auto-claims rewards exactly once', () => {
  const save=a.save, m=a.defaultMissions();
  m.daily.lastRefreshDate='2020-1-1';m.daily.quests=[{id:'test',tier:'easy',completed:true,ptsClaimed:false,pts:1}];
  m.weekly.weekKey=a.missionWeekKey();m.weekly.isoWeekKey=true;m.weekly.pendingUniversalParts=3;
  save.missions=m;a.setSave(save);a.refreshMissions();
  const first=a.save;expect(first.universalParts).toBe(3);expect(first.missions.stats.totalPts).toBe(1);
  a.refreshMissions();expect(a.save).toEqual(first);
});
it('loads legacy daily streaks without updating them or unlocking their achievements', () => {
  const save = a.save;
  const missions = a.defaultMissions();
  missions.daily.lastRefreshDate = '2020-01-01';
  missions.daily.rawXPToday = 600;
  missions.streaks = { daily: 30, bestDaily: 48 };
  Object.assign(save.stats, { dailyStreak: 30, highestDailyStreak: 48, lastPlayDate: '2020-01-01' });
  save.missions = missions;
  a.applyLoadedData(save);
  a.refreshMissions();
  a.gameOver();
  expect(a.save.missions.daily.lastRefreshDate).toBe(a.missionDateKey());
  expect(a.save.missions.streaks).toEqual(missions.streaks);
  expect(a.save.stats).toMatchObject({ dailyStreak: 30, highestDailyStreak: 48, lastPlayDate: a.missionDateKey() });
  expect(a.save.achievements).not.toHaveProperty('streak_lost');
  expect(a.save.achievements).not.toHaveProperty('mq_streak_7');
  expect(a.save.achievements).not.toHaveProperty('mq_streak_30');
});
it('fixed seed and 200 inputs replay identically', async () => {
  // Eight placements plus movement/rotation/gravity inputs exercise the live update path.
  const inputs=Array.from({length:200},(_,i)=> i%25===24 ? 'hardDrop' : ['left','right','rotate','tick'][i%4]);
  const run=async()=> {const replay=await loadGame();const api=replay.api;api.setup();api.seed(2026);
    try {for(const input of inputs){
      if(input==='left')api.move(-1);else if(input==='right')api.move(1);else if(input==='rotate')api.rotate(1);
      else if(input==='tick')api.tick(10);else {api.hardDrop();replay.advance(200);}
    }const {board,score,lines}=api.state;return {board,score,lines};}finally{replay.close();}
  };
  const first=await run();expect(await run()).toEqual(first);expect(first).toMatchSnapshot();
});
