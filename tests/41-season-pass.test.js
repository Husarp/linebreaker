import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import '../41-season-pass.js';
import { loadGame } from './loader.js';

const {
  DAY, DAYS, EPOCH, CLOCK_TOLERANCE, seasonWindow, seasonState, stageStatus, emptySeason,
  creditMissionPoints, claimStage, storeState, prepareConfig, rollReward,
} = globalThis.LBSeason;
const data = JSON.parse(readFileSync(new URL('../data/season.json', import.meta.url), 'utf8'));
const config = prepareConfig(data);
const inventory = {
  parts: [{ key: 'glass', remaining: 0 }, { key: 'shadow', remaining: 5 }],
  boosters: ['1.25x_game', '1.5x_game', '2xp_game'], skins: ['season-prism'], ownedSkins: [],
};
let game;
afterEach(() => game?.close());

it('uses exact UTC days and resets progress only on the next 30-day season', () => {
  expect(seasonWindow(EPOCH)).toEqual({ id: 1, start: EPOCH, day: 1, daysLeft: 30 });
  expect(seasonWindow(EPOCH + DAY - 1).day).toBe(1);
  expect(seasonWindow(EPOCH + DAY).day).toBe(2);
  const rollover = EPOCH + DAYS * DAY;
  expect(seasonWindow(rollover - 1)).toEqual({ id: 1, start: EPOCH, day: 30, daysLeft: 1 });
  expect(seasonWindow(rollover)).toEqual({ id: 2, start: rollover, day: 1, daysLeft: 30 });
  const save = { season: emptySeason(1) };
  creditMissionPoints(save, 8, rollover - 1);
  storeState(save, claimStage(save, config, 1, rollover - 1, inventory, () => 0));
  expect(seasonState(save, rollover - 1).season).toMatchObject({ points: 8, claimed: { 1: { type: 'parts' } } });
  expect(seasonState(save, rollover).season).toEqual(emptySeason(2));
  creditMissionPoints(save, 3, rollover);
  expect(save.season).toEqual({ ...emptySeason(2), points: 3 });
});

it('requires the points threshold and rolls once without spending points', () => {
  const now = EPOCH + DAY;
  const save = { season: { ...emptySeason(1), points: 7 } };
  const random = vi.fn(() => 0.3);
  expect(stageStatus(config.stages[0], seasonState(save, now))).toBe('locked');
  expect(claimStage(save, config, 1, now, inventory, random).reward).toBeUndefined();
  creditMissionPoints(save, 1, now);
  expect(stageStatus(config.stages[0], seasonState(save, now))).toBe('claimable');
  const result = claimStage(save, config, 1, now, inventory, random);
  storeState(save, result);
  expect(result.reward).toEqual({ type: 'universal_parts', amount: 1 });
  expect(save.season.points).toBe(8);
  expect(stageStatus(config.stages[0], seasonState(save, now))).toBe('claimed');
  expect(claimStage(save, config, 1, now, inventory, random).reward).toBeUndefined();
  expect(random).toHaveBeenCalledTimes(1);
});

it('latches a rollback greater than ten minutes until the last observed time', () => {
  const now = EPOCH + 32 * DAY;
  const save = { season: { ...emptySeason(2), points: 240 }, lastSeenTime: now };
  expect(seasonState(save, now - CLOCK_TOLERANCE).blocked).toBe(false);
  const blocked = claimStage(save, config, 1, now - CLOCK_TOLERANCE - 1, inventory);
  expect(blocked).toMatchObject({ blocked: true, lastSeenTime: now, seasonBlockedUntil: now });
  expect(blocked.reward).toBeUndefined();
  storeState(save, blocked);
  expect(seasonState(save, EPOCH + 28 * DAY).season).toBe(save.season);
  expect(seasonState(save, now - 1).blocked).toBe(true);
  expect(seasonState(save, now).blocked).toBe(false);
  expect(claimStage(save, config, 1, now, inventory).reward).toBeDefined();
});

it('rejects future-stage attempts and preserves the clock lock until that day opens', () => {
  const now = EPOCH + 6 * DAY;
  const unlock = EPOCH + 7 * DAY;
  const save = { season: { ...emptySeason(1), points: 240 }, lastSeenTime: now };
  const blocked = claimStage(save, config, 8, now, inventory);
  expect(blocked).toMatchObject({ blocked: true, seasonBlockedUntil: unlock, lastSeenTime: now });
  expect(blocked.reward).toBeUndefined();
  storeState(save, blocked);
  expect(claimStage(save, config, 1, unlock - 1, inventory).reward).toBeUndefined();
  expect(claimStage(save, config, 8, unlock, inventory).reward).toBeDefined();
  expect(stageStatus(config.stages[8], seasonState(save, unlock))).toBe('future');
});

it('uses the tier pool and skips ineligible parts, boosters and cosmetic duplicates', () => {
  expect(rollReward(config, 'rare', inventory, () => 0)).toEqual({ type: 'parts', key: 'shadow', amount: 2 });
  expect(rollReward(config, 'rare', inventory, () => 0.5)).toEqual({ type: 'booster', key: '1.5x_game', amount: 1 });
  expect(rollReward(config, 'rare', { ...inventory, parts: [], boosters: [] }, () => 0)).toEqual({ type: 'universal_parts', amount: 2 });
  expect(rollReward(config, 'legendary', inventory, () => 0.99)).toEqual({ type: 'crate', tier: 'legendary', contents: [
    { type: 'parts', key: 'shadow', amount: 5 }, { type: 'universal_parts', amount: 4 }, { type: 'booster', key: '2xp_game', amount: 1 },
  ] });
  expect(rollReward(config, 'exclusive', inventory, () => 0)).toEqual({ type: 'skin', key: 'season-prism' });
  expect(rollReward(config, 'exclusive', { ...inventory, ownedSkins: ['season-prism'] }, () => 0)).toMatchObject({ type: 'crate', tier: 'legendary' });
  expect(() => prepareConfig({ ...data, stages: data.stages.slice(1) })).toThrow('Invalid season pass configuration');
});

it('credits daily and weekly point claims once, including automatic recovery', async () => {
  game = await loadGame();
  const { w, api } = game;
  const save = api.save;
  const { missions } = save;
  const points = save.season.points;
  const daily = { id: 'day', completed: true, pts: 2 };
  const weekly = { id: 'week', completed: true, pts: 3 };
  missions.daily.quests = [daily];
  missions.weekly.missions = [weekly];
  api.setSave(save);
  w._claimQuestPts(daily.id, false, null, null, true);
  w._claimQuestPts(daily.id, false, null, null, true);
  expect(api.save.season.points).toBe(points + 2);
  api.autoClaimMissions(true);
  api.autoClaimMissions(true);
  expect(api.save.season.points).toBe(points + 5);
});

it('round-trips v1 with clean receipts and a persisted clock notice deadline', async () => {
  game = await loadGame();
  const { sanitizeSave, LBSave } = game.w;
  const defaults = game.api.save;
  const season = { id: 1, points: 45, claimed: {
    1: { type: 'crate', tier: 'common', contents: [{ type: 'parts', key: 'shadow', amount: 1, label: '<script>' }] },
    2: { type: 'parts', key: 'constructor', amount: 5 },
    30: { type: 'skin', key: 'season-prism' },
    31: { type: 'universal_parts', amount: 10 },
  } };
  const clock = { lastSeenTime: EPOCH + DAY, seasonBlockedUntil: EPOCH + 2 * DAY };
  const clean = sanitizeSave({ ...defaults, season, ...clock }, defaults);
  expect(clean).toMatchObject({ schemaVersion: 1, ...clock });
  expect(clean.season).toEqual({ id: 1, points: 45, claimed: {
    1: { type: 'crate', tier: 'common', contents: [{ type: 'parts', key: 'shadow', amount: 1 }] },
    30: { type: 'skin', key: 'season-prism' },
  } });
  expect(sanitizeSave(LBSave.serializeSave(clean), defaults).season).toEqual(clean.season);
  expect(sanitizeSave({ schemaVersion: 1, lastSeenTime: Infinity }, defaults)).toMatchObject({ season: emptySeason(), lastSeenTime: 0, seasonBlockedUntil: 0 });
});

it('opens from missions, rechecks a stale claim, and awards the exclusive skin after correction', async () => {
  game = await loadGame(true, null, null, async path => ({ ok: true, json: async () => path === 'data/season.json' ? data : [] }));
  const { w, api } = game;
  const firstMinute = EPOCH + 29 * DAY + 60_000;
  let now = firstMinute;
  w.Date.now = () => now;
  api.setSave({ ...api.save, season: { ...emptySeason(1), points: 240 }, lastSeenTime: firstMinute });
  w.openMissions();
  const missions = w.document.getElementById('missions-overlay');
  const seasonTab = missions.querySelector('[data-tab="season"]');
  const weeklyTab = missions.querySelector('[data-tab="weekly"]');
  const missionView = w.document.getElementById('mq-mission-view');
  seasonTab.click();
  await vi.waitFor(() => expect(w.document.querySelectorAll('.sp-card')).toHaveLength(30));
  const overlay = w.document.getElementById('season-pass-overlay');
  expect(missions.contains(overlay)).toBe(true);
  expect(missions.hasAttribute('inert')).toBe(false);
  expect(overlay.hidden).toBe(false);
  expect(missionView.hidden).toBe(true);
  expect(seasonTab.getAttribute('aria-pressed')).toBe('true');
  expect(overlay.querySelector('.sp-points p').textContent).toContain('daily and weekly');
  expect(overlay.querySelector('[aria-current="date"] h3').textContent).toBe('Day 30');
  const finalClaim = () => overlay.querySelector('[data-sp-day="30"]');
  now -= 120_000;
  finalClaim().click();
  expect(api.save.ownedSkins).not.toContain('season-prism');
  expect(overlay.querySelector('#sp-notice').textContent).toContain('Check your device date and time');
  expect(overlay.querySelector('[data-tier="exclusive"]').dataset.state).toBe('future');
  now = firstMinute;
  overlay.querySelector('.sp-today').click();
  finalClaim().click();
  expect(api.save.season.claimed[30]).toEqual({ type: 'skin', key: 'season-prism' });
  expect(api.save.ownedSkins).toContain('season-prism');
  expect(finalClaim()).toBeNull();
  weeklyTab.click();
  expect(overlay.hidden).toBe(true);
  expect(missionView.hidden).toBe(false);
  expect(weeklyTab.getAttribute('aria-pressed')).toBe('true');
  expect(seasonTab.getAttribute('aria-pressed')).toBe('false');
  seasonTab.click();
  expect(overlay.querySelector('[data-tier="exclusive"]').dataset.state).toBe('claimed');
  w.closeMissions();
  missions.dispatchEvent(new w.Event('animationend'));
  expect(overlay.hidden).toBe(true);
  w.openMissions();
  expect(missions.querySelector('[data-tab="daily"]').getAttribute('aria-pressed')).toBe('true');
});
