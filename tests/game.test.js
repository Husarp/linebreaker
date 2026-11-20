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
it('renders the HUD speed meter from level 1 through level 15', () => {
  const meter = game.w.document.getElementById('lb-hud-speed-meter');
  for (const speed of [1, 15, 1]) {
    a.setup({speed});
    a.hardDrop();
    game.advance(100);
    expect(meter.getAttribute('aria-valuemax')).toBe('15');
    expect(meter.getAttribute('aria-valuenow')).toBe(String(speed));
    expect(meter.textContent.trim()).toBe(String(speed));
    expect(meter.style.getPropertyValue('--hud-speed-level')).toBe(String(speed));
  }
});
it('each seven-piece bag contains every tetromino', () => {
  for(let bag=0;bag<10;bag++) {const types=Array.from({length:7},()=>a.nextPiece().flat().find(Boolean));expect(types.sort()).toEqual([1,2,3,4,5,6,7]);}
});
it.each([1,2,5,10,15])('gravity at speed %i uses a strict interval boundary', speed => {
  a.setup({speed}); const interval=Math.floor(1000/speed);
  a.tick(interval);expect(a.state.player.pos.y).toBe(0);
  a.tick(1);expect(a.state.player.pos.y).toBe(1);
});
// Existing regression: checkAchievements calls a missing tier.check before displaying the overlay.
it('game over shows the overlay', () => {a.gameOver();game.advance(1000);expect(a.state.isGameOver).toBe(true);expect(game.w.document.getElementById('go-overlay').classList.contains('hidden')).toBe(false);});
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
it.each([[1,50,5],[1,49,0],[2,100,0]])('streak reset after %i days with %i XP', (days,xp,expected) => {
  const save=a.save,m=a.defaultMissions();const yesterday=new game.w.Date();yesterday.setDate(yesterday.getDate()-days);
  m.daily.lastRefreshDate=`${yesterday.getFullYear()}-${yesterday.getMonth()+1}-${yesterday.getDate()}`;
  m.daily.rawXPToday=xp;m.streaks.daily=4;m.weekly.weekKey=a.missionWeekKey();m.weekly.isoWeekKey=true;
  save.missions=m;a.setSave(save);a.refreshMissions();expect(a.save.missions.streaks.daily).toBe(expected);
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
