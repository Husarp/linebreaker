import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

const readJson = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const legacy = readJson('./fixtures/legacy-save.json');
const catalog = readJson('../data/missions.json');
let game;
afterEach(() => game?.close());

it('migrates legacy scores, listening counts, and dates without retaining duplicates', async () => {
  game = await loadGame();
  const clean = game.w.sanitizeSave(legacy, game.api.save);
  expect(clean.schemaVersion).toBe(1);
  expect(clean.leaderboard.map(entry => entry.score)).toEqual([1500, 1000, 800]);
  expect(clean.leaderboard[0]).toMatchObject({ date: '2026-02-07', lines: 20, maxSpeed: 5 });
  expect(clean.pinnedScores[0]).toMatchObject({ date: '2026-11-18', clock: '12:30', note: 'Keep this' });
  expect(clean.highscoreHistory[0].date).toBe('2025-05-19');
  expect(clean.stats).toMatchObject({ lastPlayDate: '2026-02-07', dailyXPDate: '2026-11-18', playHistory: { '2026-02-07': 3, '2026-02-08': 1 } });
  expect(game.w.LBSave.musicCounts(clean.stats.songPlayCounts)).toEqual({ total: 27, mostPlayed: 5 });
  expect(clean.missions.weekly.dailyPtsLog).toEqual({ '2026-11-17': 2 });
  expect(clean.missions.weekly.dailyAllCompleteDate).toBe('2026-11-07');
  expect(clean.missions.stats.completionHistory).toEqual({ '2026-11-07': 2 });
  expect(clean.missions.streaks).toEqual({ daily: 3, bestDaily: 3 });
  expect(clean.achievements.music_listener).toMatchObject({ tier: 1, tierDates: { '1': '2026-02-07' } });
  expect(clean.achievements.legacy_badge.unlockedAt).toBe('2026-11-18');
  expect(clean.pendingAchievementClaims).toEqual(legacy.pendingAchievementClaims);
  expect(clean).toMatchObject({ lastDailyGift: '2026-02-07', ownedBtnStyles: ['legacy'] });
  for (const key of ['highscore', 'highscoreData', 'ownedFonts', 'ownedBgStyles', 'seenMasterRules', 'dailyGiftUnlockReq', 'dailyGiftStreak', 'xpEarnedSinceLastGift', 'stats.bestNormalScore', 'stats.musicTracksListened', 'stats.mostPlayedSongCount', 'missions.weekly.daysPlayedThisWeek']) {
    expect(clean).not.toHaveProperty(key);
  }
  expect(game.w.LBSave.date('2024-2-29')).toBe('2024-02-29');
  expect(game.w.LBSave.date('29.2.2026')).toBe('');
  expect(game.w.LBSave.displayDate('07.02.2026', '12:30', true)).toBe('07.02.2026, 12:30');
});

it('loads the fetched catalog before the save and round-trips a compact save', async () => {
  const fetched = structuredClone(catalog);
  fetched.daily.find(def => def.id === 'games_7').title = 'From JSON';
  const input = structuredClone(legacy);
  const track = "World's End Valentine";
  const pickerColors = ['#123456', '#234567', '#345678', '#456789', '#56789a', '#6789ab', '#789abc'];
  const reminders = { enabled: true, daily: false, streak: true, weekly: false };
  Object.assign(input, { customPickerColors: pickerColors, menuPlaylist: [track], gamePlaylist: [track], actionPlaylist: [], ghostColorUnlocked: true });
  Object.assign(input._settings, { colorPalette: '_custom_picker', colorHistory: ['#ABCDEF'], ghostColor: 'colored', keyBindings: { right: ['KeyL', null] }, reminders: { ...reminders, unknown: true } });
  input.stats.songPlayCounts[track] = 2;
  const writes = [];
  game = await loadGame(true, async (command, payload) => {
    if (command === 'load_save') return JSON.stringify(input);
    writes.push(payload.json);
  }, null, async url => ({ ok: true, json: async () => url === 'data/missions.json' ? fetched : [] }));
  const { api } = game;
  const runtime = api.save;
  expect(runtime._settings).toMatchObject({ theme: 'ocean', heavyBg: 2 });
  expect(runtime._settings).toMatchObject({ colorPalette: '_custom_picker', colorHistory: ['#abcdef'], ghostColor: 'colored', keyBindings: { right: ['KeyL', null] } });
  expect(runtime._settings.reminders).toEqual(reminders);
  expect(runtime).toMatchObject({ customPickerColors: pickerColors, menuPlaylist: [track], gamePlaylist: [track], actionPlaylist: [], stats: { songPlayCounts: { [track]: 2 } } });
  for (const key of ['bgStyle', 'classicColors', 'actionMusicMode']) expect(runtime._settings).not.toHaveProperty(key);
  expect(runtime.missions.daily.quests[0]).toMatchObject({ title: 'From JSON', desc: 'Complete 8 games', metric: 'gamesPlayed', target: 8, progress: 2, cumulative: true });
  expect(runtime.missions.daily.secret).toMatchObject({ id: 'hat_trick', displayTier: 'hard', completed: true, ptsClaimed: true });
  expect(runtime.missions.weekly.missions[0]).toMatchObject({ tier: 'normal', pts: 15, target: 30, progress: 16, cumulative: true });
  expect(runtime.missions.weekly.missions[1]).toMatchObject({ tier: 'hard', pts: 25 });
  await api.writeSaveFile(runtime);
  const savedJson = writes.at(-1);
  const saved = JSON.parse(savedJson);
  expect(saved.missions.daily.quests[0]).toEqual({ id: 'games_7', target: 8, progress: 2, completed: false, ptsClaimed: false });
  expect(saved.missions.weekly.missions[0].tier).toBe('normal');
  expect(saved.missions.weekly.missions[1]).not.toHaveProperty('tier');
  expect(Object.keys(saved).slice(-5)).toEqual(['stats', 'highscoreHistory', 'pinnedScores', 'funLeaderboard', 'leaderboard']);
  expect(Object.keys(saved.parts)).toEqual(['classic', 'shadow']);
  api.applyLoadedData(saved);
  await api.writeSaveFile(api.save);
  expect(writes.at(-1)).toBe(savedJson);
});

it('uses the inline catalog when fetching the JSON fails', async () => {
  game = await loadGame(true, null, null, async url => {
    if (url === 'data/missions.json') throw Error('file://');
    return { ok: true, json: async () => [] };
  });
  game.api.applyLoadedData(legacy);
  expect(game.api.save.missions.daily.quests[0]).toMatchObject({ title: 'Show Up', metric: 'gamesPlayed', cumulative: true, progress: 2 });
});
