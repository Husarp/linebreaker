import { afterEach, beforeEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';
let game, a;
const attack = '<img src=x onerror=alert(1)>';
beforeEach(async () => { game = await loadGame(); a = game.api; a.setup(); });
afterEach(() => game?.close());
it('rebuilds hostile save fields and ignores unrecognised top-level data', () => {
 const input = { ...a.save, totalXP: Infinity, highscore: -20, unknown: attack,
  pinnedScores:[{score:100, note:attack + '"\'`', date:attack}],
  lastDailyGift:attack, customThemeColor:attack, customPickerColors:[attack],
  customPaletteOverrides:{classic:[attack]},
  achievements:{test:{unlocked:true, unlockedAt:attack}},
  pendingLevelBox:{level:11, rankName:attack, rankColor:attack, rewards:[
   {type:'universal_parts', amount:3, icon:attack, label:attack, desc:attack, rarity:attack},
   {type:'evil', label:attack}]},
  pendingMilestoneReward:{level:10,rewards:[{type:'booster',key:'1.5x_game',label:attack}]},
  pendingLevelBoxes:[{level:21,rewards:[{label:'+1 Part: Shadow', icon:attack, desc:attack}]}]
 };
 const clean = game.w.sanitizeSave(input, a.save, {boosters:{'1.5x_game':{icon:'⚡',label:'1.5x Score Booster',rarity:'rare'}}});
 expect(clean.totalXP).toBe(0); expect(clean).not.toHaveProperty('highscore'); expect(clean).not.toHaveProperty('unknown');
 expect(clean.pinnedScores[0].note).not.toMatch(/[<>"'`]/);
 expect(clean.pinnedScores[0].date).toBe(''); expect(clean.lastDailyGift).toBeNull();
 expect(clean.customThemeColor).toBe('#00ffff'); expect(clean.customPickerColors[0]).toBe('#00ffff');
 expect(clean.achievements.test.unlockedAt).toBe('');
 expect(clean.pendingLevelBox.rewards).toHaveLength(1);
 expect(clean.pendingLevelBox.rewards[0]).toEqual({ type: 'universal_parts', amount: 3, rarity: 'common', label: 'Common Universal Part' });
 expect(clean.pendingMilestoneReward.rewards[0].label).toBe('1.5x Score Booster');
 expect(clean.pendingLevelBoxes[0].rewards[0].label).toBe('Shadow Part');
 expect(JSON.stringify(clean)).not.toContain('<img');
});
it('loads a defaults-based real save with progress, dates, missions and legacy boxes intact', () => {
 const fixture = {...a.save,totalXP:12345,highscore:5000,parts:{shadow:4},universalParts:2.4,
 ownedSkins:['neon','retro'], boosters:{'1.3x_game':2},
 stats:{...a.save.stats,gamesPlayed:12,lastPlayDate:'2026-11-18',playHistory:{'2026-11-18':3},songPlayCounts:{Track:5}},
 leaderboard:[{score:5000,date:'18.11.2026 12:30',lines:40}],
 pinnedScores:[{score:4000,date:'18.11.2026, 12:30',note:'Nice run'}],
 achievements:{playing:{unlocked:true,unlockedAt:'18.11.2026'}},
 missions:a.defaultMissions(), pendingLevelBox:{level:11,rewards:[{label:'+1 Part: Shadow'},{label:'+1 Universal Part'}]}};
 fixture.missions.daily.lastRefreshDate = a.missionDateKey();
 fixture.missions.weekly.weekKey = a.missionWeekKey(); fixture.missions.weekly.isoWeekKey=true;
 fixture.missions.stats.totalPts=25;
 a.applyLoadedData(fixture);
 expect(a.save).toMatchObject({schemaVersion:3,skinCatalogVersion:1,totalXP:12345,parts:{shadow:4},universalParts:{common:3.4},ownedSkins:['retro'],boosters:{'1.25x_game':2},stats:{gamesPlayed:12,songPlayCounts:{Track:5}},missions:{stats:{totalPts:25}}});
 expect(a.save.leaderboard[0]).toMatchObject({score:5000,date:'2026-11-18',clock:'12:30'});
 expect(a.save.pinnedScores[0].note).toBe('Nice run');
 expect(a.save.storedCrates[0].rewards).toHaveLength(2);
});
it('drops retired background entries on load and keeps already collected rewards', () => {
 const missions = a.defaultMissions();
 const retired = {id:'parachute_catcher', target:1, progress:1, completed:true, ptsClaimed:true};
 missions.daily.lastRefreshDate = a.missionDateKey();
 missions.daily.quests = [retired, {id:'games_15', target:15, progress:2}];
 missions.daily.secret = retired;
 missions.daily.pointsToday = 12;
 missions.weekly.weekKey = a.missionWeekKey();
 missions.weekly.isoWeekKey = true;
 missions.weekly.missions = [retired];
 missions.weekly.points = 19;
 a.applyLoadedData({...a.save, totalXP:12345, parts:{shadow:4}, universalParts:2,
   _settings:{heavyBg:3, bgBlockMotion:'falling', movingBackground:false}, missions,
   stats:{gamesPlayed:12, parachuteDropsCaught:8},
   achievements:{parachute_catcher:{unlocked:true}, sec_early_bird:{unlocked:true}},
   pendingAchievementClaims:[{id:'parachute_catcher', xp:100}, {id:'sec_early_bird', xp:500}]});
 expect(a.save).toMatchObject({totalXP:12345, parts:{shadow:4}, universalParts:{common:2}, stats:{gamesPlayed:12}});
 expect(a.save.stats).not.toHaveProperty('parachuteDropsCaught');
 expect(a.save.achievements).toEqual({sec_early_bird:expect.objectContaining({unlocked:true})});
 expect(a.save.pendingAchievementClaims.map(claim => claim.id)).toEqual(['sec_early_bird']);
 expect(a.save.missions.daily).toMatchObject({quests:[{id:'games_15', progress:2}], secret:null, pointsToday:12});
 expect(a.save.missions.weekly).toMatchObject({missions:[], points:19});
 expect(a.save._settings).toMatchObject({movingBackground:false});
 expect(a.save._settings).not.toHaveProperty('heavyBg');
 expect(a.save._settings).not.toHaveProperty('bgBlockMotion');
});

it.each(['legacy export', 'legacy JSON save'])('imports a %s through the shared sanitizer and migrations', async format => {
 const json = JSON.stringify({version:3,data:{totalXP:4000,highscore:100,boosters:{'1.6x_game':2},pinnedScores:[{note:attack,date:attack}]}});
 // TRPG1 uses the same XOR bytes with the legacy prefix (ASCII fixture).
 const encoded = format === 'legacy export' ? a.encSave(json).replace('TRPG2:', 'TRPG1:') : json;
 let pending;
 game.w.FileReader = class { readAsText() { pending = this.onload({target:{result:encoded}}); } };
 game.w.handleFileImport({target:{files:[{name: format === 'legacy export' ? 'backup.\u0074etris' : '\u0074etris_save.json'}]}});
 game.w.document.getElementById('confirm-yes').click();
 game.w.document.querySelector('#custom-confirm .modal-box').dispatchEvent(new game.w.Event('animationend'));
 await pending;
 expect(a.save.totalXP).toBe(4000); expect(a.save.boosters['1.5x_game']).toBe(2);
 expect(a.save.stats.gamesPlayed).toBe(0); expect(a.save.pinnedScores[0].date).toBe('');
 expect(a.save.pinnedScores[0].note).not.toContain('<');
 expect(a.save.achievements.save_transfer.unlocked).toBe(true);
});
it('sanitizes schema v1 skin keys while preserving image rewards and the Neon palette', () => {
 a.applyLoadedData({schemaVersion:1,skinCatalogVersion:1,totalXP:100,
  ownedSkins:['lava','lava-glass','gem','neon'],ownedPalettes:['classic','neon'],parts:{'golden-dragon':7,lava:4,gem:3,neon:2},
  _settings:{skin:'gem',blockShape:'round'},
  pendingLevelBox:{rewards:[{type:'parts',key:'golden-dragon'},{type:'parts',key:'gem'},{type:'parts',key:'lava'}]}});
 expect(a.save).toMatchObject({schemaVersion:3,ownedSkins:['retro','lava-glass'],ownedPalettes:['classic','neon'],universalParts:{common:3},
  _settings:{skin:'retro',blockShape:'square'}});
 expect(a.save.parts).toEqual({'golden-dragon':7,neon:2});
 expect(a.save.storedCrates[0].rewards).toEqual([expect.objectContaining({key:'golden-dragon',label:'Golden Dragon Part',rarity:'legendary',desc:'7/10 parts'})]);
});
it('migrates v2 balances and receipts and caps existing per-item parts without losing owned items', () => {
 const { w } = game;
 a.applyLoadedData({ ...a.save, schemaVersion: 2, ownedSkins: ['retro', 'shadow'], ownedThemes: ['ocean'],
  parts: { outline: 19, glass: 48, shadow: 33, holo: 5, 'golden-dragon': 200 }, universalParts: 7.2,
  storedCrates: [{ rarity: 'rare', source: 'legacy', rewards: [{ type: 'universal_parts', rarity: 'rare', amount: 3 }] }] });
 expect(a.save.parts).toEqual({ outline: 19, glass: 15, shadow: 15, holo: 5, 'golden-dragon': 10 });
 expect(a.save.ownedSkins).toContain('shadow');
 expect(a.save.ownedThemes).toContain('ocean');
 expect(a.save.universalParts).toEqual({ common: 7.2 });
 expect(a.save.storedCrates[0].rewards[0]).toMatchObject({ amount: 3, rarity: 'common' });
 expect(a.exchangeUniversalParts('common', 1)).toBe(true);
 for (const [rarity, sets] of [['common', 1], ['rare', 1], ['mythic', 1], ['unknown', 1], ['rare', -1], ['rare', 0.5]]) {
  expect(a.exchangeUniversalParts(rarity, sets)).toBe(false);
 }
 expect(a.save.universalParts).toEqual({ common: 3.2, rare: 1 });
 a.applyLoadedData(w.LBSave.serializeSave(a.save));
 expect(a.save.universalParts).toEqual({ common: 3.2, rare: 1 });
});
it('sanitizes native desktop saves before displaying loaded progress', async () => {
 game.close();
 game = await loadGame(true, async command => command === 'load_save' ? JSON.stringify({totalXP:123,pinnedScores:[{note:attack,date:attack}]}) : null);
 expect(game.api.save.totalXP).toBe(123);
 expect(game.api.save.pinnedScores[0]).toMatchObject({date:'',note:'img src=x onerror=alert(1)'});
});
it('repairs malformed nested structures, clamps numbers, and blocks entity payloads', () => {
 const clean = game.w.sanitizeSave({totalXP:1e30,stats:{gamesPlayed:'bad',seenTitleAnims:[0,5,99],dailyXPDate:attack,playHistory:null},
  missions:{daily:{quests:'bad'},weekly:{missions:[null,{title:'&lt;img&gt;',target:Infinity,completed:'yes'}]}},
  customPaletteOverrides:{classic:[attack,'#abcdef']}, ownedSkins:{broken:true},
  pendingLevelBoxes:[null,{rewards:[{type:'booster',key:'unknown'},{type:'universal_parts',amount:Infinity}]}],
  pinnedScores:[{note:'&#39;);alert(1);//'}]}, a.save, {palettes:{classic:{colors:['#00ffff','#3388ff','#ff9900','#ffff33','#33ff33','#cc33ff','#ff3366']}}});
 expect(clean.totalXP).toBe(1e12);
 expect(clean.stats.gamesPlayed).toBe(0); expect(clean.stats.seenTitleAnims).toEqual([0,5]);
 expect(clean.missions.daily.quests).toEqual([]);
 expect(clean.missions.weekly.missions).toEqual([]);
 expect(clean.customPaletteOverrides.classic.slice(0,2)).toEqual(['#00ffff','#abcdef']);
 expect(clean.ownedSkins).toEqual(['retro']);
 expect(clean.pendingLevelBoxes[0].rewards).toHaveLength(1);
 expect(clean.pinnedScores[0].note).not.toContain('&');
});
