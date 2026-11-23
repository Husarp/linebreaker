import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import '../41-season-pass.js';
import { loadGame } from './loader.js';

const {
  DAY, EPOCH, CLOCK_TOLERANCE, seasonWindow, seasonState, stageStatus, emptySeason,
  creditMissionPoints, claimStage, claimBonus, bonusProgress, storeState, prepareConfig, summarizeTrack, sanitizeSeason,
} = globalThis.LBSeason;
const data = JSON.parse(readFileSync(new URL('../data/season.json', import.meta.url), 'utf8'));
const config = prepareConfig(data);
let game;
afterEach(() => game?.close());

it('distinguishes the highest reached stage from the next unclaimed reward', () => {
  const now = EPOCH + 7 * DAY;
  const save = { season: { ...emptySeason(1), points: 67 } };
  storeState(save, claimStage(save, config, 1, now));
  expect(summarizeTrack(config.stages, seasonState(save, now))).toEqual({
    current: config.stages[7],
    next: config.stages[1],
  });
  expect(summarizeTrack(config.stages, seasonState({}, now))).toEqual({
    current: undefined,
    next: config.stages[0],
  });
});

it.each([[2026, 0, 31], [2026, 1, 28], [2026, 10, 30], [2028, 1, 29], [2028, 11, 31]])(
  'uses the local first and last day of %i month index %i (%i days)', (year, month, days) => {
    const start = +new Date(year, month, 1);
    const end = +new Date(year, month + 1, 1);
    const id = (year - 2026) * 12 + month + 1;
    expect(seasonWindow(start)).toEqual({ id, start, end, day: 1, days, daysLeft: days });
    expect(seasonWindow(end - 1)).toEqual({ id, start, end, day: days, days, daysLeft: 1 });
    expect(seasonWindow(end)).toMatchObject({ id: id + 1, start: end, day: 1 });
  },
);

it('resets season points and claims only on the next local month', () => {
  const rollover = +new Date(2026, 1, 1);
  const save = { season: emptySeason(1) };
  creditMissionPoints(save, 8, rollover - 1);
  storeState(save, claimStage(save, config, 1, rollover - 1));
  expect(seasonState(save, rollover - 1).season).toMatchObject({ points: 8, claimed: { 1: { type: 'crate' } } });
  expect(seasonState(save, rollover).season).toEqual(emptySeason(2));
  creditMissionPoints(save, 3, rollover);
  expect(save.season).toEqual({ ...emptySeason(2), points: 3 });
});

it('migrates an active legacy season once without dropping points, claims, or overflow', () => {
  const upgrade = +new Date(2026, 10, 22);
  const monthEnd = +new Date(2026, 11, 1);
  const oldId = Math.floor((upgrade - Date.UTC(2026, 0, 1)) / (30 * DAY)) + 1;
  const claimed = { 1: { type: 'crate', tier: 'common' }, 30: { type: 'skin', key: 'season-prism' } };
  const save = { season: sanitizeSeason({ id: oldId, points: 264, claimed, bonusClaimed: 2 }), lastSeenTime: upgrade };
  storeState(save, seasonState(save, upgrade));
  expect(save.season).toEqual({ ...emptySeason(11), points: 264, claimed, bonusClaimed: 2 });
  save.season = sanitizeSeason(JSON.parse(JSON.stringify(save.season)));
  expect(claimStage(save, config, 1, monthEnd - 1).reward).toBeUndefined();
  expect(bonusProgress(config, seasonState(save, monthEnd - 1))).toEqual({ ready: 1, points: 0 });
  expect(seasonState(save, monthEnd).season).toEqual(emptySeason(12));
});

it('preserves legacy progress seen earlier in the same calendar month, but not from a stale month', () => {
  const lastSeenTime = Date.UTC(2026, 0, 29, 12);
  const save = { season: { id: 1, points: 80, claimed: {}, bonusClaimed: 0 }, lastSeenTime };
  expect(seasonState(save, +new Date(2026, 0, 31, 23, 59)).season.points).toBe(80);
  expect(seasonState(save, +new Date(2026, 1, 1)).season).toEqual(emptySeason(2));
});

it('persists the migrated month on native load before the player makes any changes', async () => {
  let now = +new Date(2026, 9, 30, 12);
  let persisted = JSON.stringify({ schemaVersion: 1, totalXP: 0, lastSeenTime: now, season: { id: 11, points: 64 } });
  const invoke = async (command, payload) => {
    if (command === 'load_save') return persisted;
    if (command === 'write_save') persisted = payload.json;
  };
  const setClock = window => { window.Date.now = () => now; };
  game = await loadGame(true, invoke, null, undefined, null, setClock);
  await game.w.flushLinebreakerSave();
  expect(JSON.parse(persisted).season).toMatchObject({ calendar: 'month', id: 10, points: 64 });
  game.close();
  now = +new Date(2026, 10, 1, 12);
  game = await loadGame(true, invoke, null, undefined, null, setClock);
  expect(game.api.save.season).toEqual(emptySeason(11));
});

it('requires the points threshold and grants once without spending points', () => {
  const now = EPOCH;
  const save = { season: { ...emptySeason(1), points: 7 } };
  const grant = vi.fn(tier => ({ type: 'crate', tier }));
  expect(stageStatus(config.stages[0], seasonState(save, now))).toBe('locked');
  expect(claimStage(save, config, 1, now, grant).reward).toBeUndefined();
  creditMissionPoints(save, 1, now);
  expect(stageStatus(config.stages[0], seasonState(save, now))).toBe('claimable');
  const result = claimStage(save, config, 1, now, grant);
  storeState(save, result);
  expect(result.reward).toEqual({ type: 'crate', tier: 'common' });
  expect(save.season.points).toBe(8);
  expect(stageStatus(config.stages[0], seasonState(save, now))).toBe('claimed');
  expect(claimStage(save, config, 1, now, grant).reward).toBeUndefined();
  expect(grant).toHaveBeenCalledExactlyOnceWith('common');
});

it('latches a rollback greater than ten minutes until the last observed time', () => {
  const now = EPOCH + 32 * DAY;
  const save = { season: { ...emptySeason(2), points: 240 }, lastSeenTime: now };
  expect(seasonState(save, now - CLOCK_TOLERANCE).blocked).toBe(false);
  const blocked = claimStage(save, config, 1, now - CLOCK_TOLERANCE - 1);
  expect(blocked).toMatchObject({ blocked: true, lastSeenTime: now, seasonBlockedUntil: now });
  expect(blocked.reward).toBeUndefined();
  storeState(save, blocked);
  expect(seasonState(save, EPOCH + 28 * DAY).season).toBe(save.season);
  expect(seasonState(save, now - 1).blocked).toBe(true);
  expect(seasonState(save, now).blocked).toBe(false);
  expect(claimStage(save, config, 1, now).reward).toBeDefined();
});

it('unlocks stages by points even on the first day, without requiring earlier claims', () => {
  const save = { season: emptySeason(1) };
  const statuses = () => config.stages.slice(0, 3).map(stage => stageStatus(stage, seasonState(save, EPOCH)));
  creditMissionPoints(save, 15, EPOCH);
  expect(statuses()).toEqual(['claimable', 'locked', 'locked']);
  creditMissionPoints(save, 9, EPOCH);
  expect(statuses()).toEqual(['claimable', 'claimable', 'claimable']);
  creditMissionPoints(save, 216, EPOCH);
  expect(claimStage(save, config, 30, EPOCH).reward).toEqual({ type: 'skin', key: 'season-prism' });
  expect(claimStage({ ...save, ownedSkins: ['season-prism'] }, config, 30, EPOCH).reward).toEqual({ type: 'crate', tier: 'legendary' });
});

it('grants the specified crate at each stage without changing the points curve', () => {
  const tiers = {
    common: [1, 2, 3, 4, 6, 8, 9, 11, 12, 13, 16, 17, 19, 21, 22, 24, 27],
    rare: [5, 7, 14, 18, 23, 26], epic: [10, 15, 25, 28], legendary: [20], mythic: [29],
  };
  const save = { season: { ...emptySeason(1), points: 240 } };
  expect(config.stages.map(stage => stage.points)).toEqual(Array.from({ length: 30 }, (_, index) => (index + 1) * 8));
  for (const [tier, stages] of Object.entries(tiers)) {
    for (const number of stages) expect(claimStage(save, config, number, EPOCH).reward).toEqual({ type: 'crate', tier });
  }
  expect(() => prepareConfig({ ...data, stages: data.stages.slice(1) })).toThrow('Invalid season pass configuration');
});

it('banks repeatable rare chests at each final-stage increment and expires them at rollover', () => {
  const save = { season: { ...emptySeason(1), points: 247 } };
  const progress = now => bonusProgress(config, seasonState(save, now));
  const grant = vi.fn(tier => ({ type: 'crate', tier }));
  expect(progress(EPOCH)).toEqual({ ready: 0, points: 7 });
  expect(claimBonus(save, config, EPOCH, grant).reward).toBeUndefined();
  creditMissionPoints(save, 1, EPOCH);
  expect(progress(EPOCH)).toEqual({ ready: 1, points: 0 });
  creditMissionPoints(save, 10, EPOCH);
  expect(progress(EPOCH)).toEqual({ ready: 2, points: 2 });
  for (const ready of [1, 0]) {
    const result = claimBonus(save, config, EPOCH, grant);
    expect(result.reward).toEqual({ type: 'crate', tier: 'rare' });
    storeState(save, result);
    expect(progress(EPOCH)).toEqual({ ready, points: 2 });
  }
  expect(save.season).toMatchObject({ points: 258, bonusClaimed: 2 });
  expect(claimBonus(save, config, EPOCH, grant).reward).toBeUndefined();
  creditMissionPoints(save, 6, EPOCH);
  expect(progress(EPOCH)).toEqual({ ready: 1, points: 0 });
  expect(claimBonus(save, config, seasonWindow(EPOCH).end, grant).reward).toBeUndefined();
  expect(grant.mock.calls).toEqual([['rare'], ['rare']]);
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

it('shows immediate mission claim feedback without crediting points until after paint', async () => {
  game = await loadGame();
  const { w, api, advance } = game;
  const save = api.save;
  const points = save.season.points;
  const quest = { id: 'day', completed: true, pts: 2 };
  save.missions.daily.quests = [quest];
  api.setSave(save);
  const claim = w.document.body.appendChild(w.document.createElement('button'));
  claim.onclick = () => w._claimQuestPts(quest.id, false, null, claim);
  claim.click();
  claim.click();
  expect(claim.getAttribute('aria-busy')).toBe('true');
  advance(16);
  expect(api.save.season.points).toBe(points);
  advance(16);
  expect(api.save.season.points).toBe(points + 2);
  expect(claim.hasAttribute('aria-busy')).toBe(false);
});

it('migrates old saves without resetting points or already-claimed stage receipts', async () => {
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
  expect(clean).toMatchObject({ schemaVersion: 2, ...clock });
  expect(clean.season).toEqual({ id: 1, points: 45, bonusClaimed: 0, claimed: {
    1: { type: 'crate', tier: 'common', contents: [{ type: 'parts', key: 'shadow', amount: 1 }] },
    30: { type: 'skin', key: 'season-prism' },
  } });
  expect(seasonState(clean, clock.lastSeenTime)).toMatchObject({ blocked: false, seasonBlockedUntil: 0 });
  expect(claimStage(clean, config, 1, clock.lastSeenTime).reward).toBeUndefined();
  expect(claimStage(clean, config, 5, clock.lastSeenTime).reward).toEqual({ type: 'crate', tier: 'rare' });
  expect(sanitizeSave(LBSave.serializeSave(clean), defaults).season).toEqual(clean.season);
  expect(sanitizeSave({ schemaVersion: 1, lastSeenTime: Infinity }, defaults)).toMatchObject({ season: emptySeason(), lastSeenTime: 0, seasonBlockedUntil: 0 });
});

it('opens straight from the menu without mounting the Missions board, then returns to the menu card', async () => {
  game = await loadGame(true, null, null, async path => ({ ok: true, json: async () => path === 'data/season.json' ? data : [] }));
  const { w } = game;
  const menu = w.document.getElementById('menu-overlay');
  const card = w.document.getElementById('btn-season-pass');
  const missions = w.document.getElementById('missions-overlay');
  const screen = w.document.getElementById('season-pass-overlay');
  const mutations = new w.MutationObserver(() => {});
  mutations.observe(missions, { attributes: true, attributeFilter: ['class'] });
  const opened = w.Function(`return ${card.getAttribute('onclick')}`).call(card);
  expect(screen.hidden).toBe(false);
  expect(missions.classList.contains('hidden')).toBe(true);
  expect(mutations.takeRecords()).toHaveLength(0);
  expect(menu.hasAttribute('inert')).toBe(true);
  await opened;
  screen.querySelector('.lb-block-back').click();
  expect(screen.hidden).toBe(true);
  expect(missions.classList.contains('hidden')).toBe(true);
  expect(menu.hasAttribute('inert')).toBe(false);
  expect(w.document.activeElement).toBe(card);
  mutations.disconnect();
});

it('opens from missions, rechecks a stale claim, and awards the exclusive skin after correction', async () => {
  game = await loadGame(true, null, null, async path => ({ ok: true, json: async () => path === 'data/season.json' ? data : [] }));
  const { w, api, advance } = game;
  const afterPaint = () => { advance(16); advance(16); };
  const firstMinute = EPOCH + 60_000;
  let now = firstMinute;
  w.Date.now = () => now;
  api.setSave({ ...api.save, season: { ...emptySeason(1), points: 240 }, lastSeenTime: firstMinute });
  await w.openMissions('weekly');
  const missions = w.document.getElementById('missions-overlay');
  const seasonTab = missions.querySelector('[data-tab="season"]');
  const weeklyTab = missions.querySelector('[data-tab="weekly"]');
  const missionView = w.document.getElementById('mq-mission-view');
  const missionBoard = w.document.getElementById('missions-body').firstElementChild;
  missionView.scrollTop = 120;
  await vi.waitFor(() => expect(seasonTab.querySelector('small').textContent).toBe('Stage 30 · Next reward at 8 SP'));
  expect(w.document.getElementById('lb-menu-season-stage').textContent).toBe('Stage 30 · View rewards');
  seasonTab.click();
  await vi.waitFor(() => expect(w.document.querySelectorAll('.sp-card[data-stage]')).toHaveLength(30));
  const overlay = w.document.getElementById('season-pass-overlay');
  expect(missions.contains(overlay)).toBe(false);
  expect(missions.hasAttribute('inert')).toBe(true);
  expect(overlay.hidden).toBe(false);
  expect(missionView.hidden).toBe(false);
  expect(w.document.activeElement.id).toBe('mq-back');
  expect(overlay.querySelector('.sp-points')).toBeNull();
  const meter = overlay.querySelector('.sp-hero .sp-meter');
  const progress = meter.querySelector('progress');
  const progressText = meter.querySelector('#sp-progress-text');
  expect(overlay.querySelector('[aria-current="step"] h3').textContent).toBe('Stage 30: Season Prism');
  expect(overlay.querySelector('[aria-current="step"] .sp-step').textContent).toBe('30');
  expect(overlay.querySelector('#sp-title').textContent).toBe('Stage 30');
  expect(progressText.textContent).toBe('240 SP · All stages unlocked');
  expect(progress.hidden).toBe(true);
  expect(overlay.querySelector('[data-stage="29"] img').getAttribute('src')).toBe('assets/ui/crates/mythic.png');
  expect(overlay.querySelector('[data-stage="30"] .sp-prism')).not.toBeNull();
  const finalClaim = () => overlay.querySelector('[data-sp-claim="30"]');
  now -= CLOCK_TOLERANCE + 1;
  finalClaim().click();
  expect(finalClaim().getAttribute('aria-busy')).toBe('true');
  afterPaint();
  expect(api.save.ownedSkins).not.toContain('season-prism');
  expect(overlay.querySelector('#sp-notice').textContent).toContain('Check your device date and time');
  expect(overlay.querySelector('[data-tier="exclusive"]').dataset.state).toBe('locked');
  now = firstMinute;
  w.dispatchEvent(new w.Event('focus'));
  finalClaim().click();
  afterPaint();
  expect(api.save.season.claimed[30]).toEqual({ type: 'skin', key: 'season-prism' });
  expect(api.save.ownedSkins).toContain('season-prism');
  expect(finalClaim()).toBeNull();
  const { storedCrates, parts, universalParts, boosters } = api.save;
  overlay.querySelector('[data-sp-claim="1"]').click();
  afterPaint();
  expect(api.save.season.claimed[1]).toEqual({ type: 'crate', tier: 'common' });
  expect(api.save.storedCrates).toEqual([...storedCrates, { rarity: 'common' }]);
  expect(api.save).toMatchObject({ parts, universalParts, boosters });
  const receipt = overlay.querySelector('[data-stage="1"] details');
  expect(receipt.querySelector('summary').getAttribute('aria-label')).toContain('Stage 1 claimed');
  expect(receipt.querySelector('.sp-receipt').textContent).not.toBe('');
  receipt.querySelector('summary').click();
  expect(receipt.open).toBe(true);
  expect(progressText.textContent).toBe('240 SP · All stages unlocked');
  api.setSave({ ...api.save, season: { ...api.save.season, points: 11 } });
  w.dispatchEvent(new w.Event('focus'));
  expect(progressText.textContent).toBe('11 / 16 SP to stage 02');
  expect(progress.value).toBe(11);
  expect(progress.max).toBe(16);
  const fills = [...meter.querySelector('.sp-meter-segments').children].map(segment =>
    parseFloat(segment.style.getPropertyValue('--sp-day-fill')));
  expect(fills).toEqual([...Array(21).fill(100), 31.25, ...Array(9).fill(0)]);
  const locked = overlay.querySelector('[data-stage="2"] details');
  locked.querySelector('summary').click();
  expect(locked.open).toBe(true);
  expect(locked.querySelector('.lb-block-expand-body').textContent).toBe('5 SP to go');
  w.document.getElementById('mq-back').click();
  expect(overlay.hidden).toBe(true);
  expect(missionView.hidden).toBe(false);
  expect(missions.hasAttribute('inert')).toBe(false);
  expect(w.document.getElementById('missions-body').firstElementChild).toBe(missionBoard);
  expect(missionView.scrollTop).toBe(120);
  expect(weeklyTab.getAttribute('aria-pressed')).toBe('true');
  expect(w.document.activeElement).toBe(seasonTab);
  seasonTab.click();
  expect(overlay.querySelector('[data-tier="exclusive"]').dataset.state).toBe('claimed');
  w.closeMissions();
  expect(overlay.hidden).toBe(true);
  w.closeMissions();
  await w.openMissions();
  expect(missions.querySelector('[data-tab="daily"]').getAttribute('aria-pressed')).toBe('true');
});

it('redraws the meter for each local month without filling it for elapsed days', async () => {
  let now = +new Date(2026, 0, 31, 12);
  const fetchSeason = async path => ({ ok: true, json: async () => path === 'data/season.json' ? data : [] });
  game = await loadGame(true, null, null, fetchSeason, null, window => { window.Date.now = () => now; });
  const { w, api } = game;
  api.setSave({ ...api.save, season: { ...emptySeason(1), points: 4 }, lastSeenTime: now });
  await w.openSeasonPass();
  const segments = w.document.querySelector('.sp-meter-segments');
  expect(segments.children).toHaveLength(31);
  expect(segments.children[15].style.getPropertyValue('--sp-day-fill')).toBe('50%');
  for (const [year, month, length] of [[2026, 1, 28], [2026, 3, 30], [2028, 1, 29]]) {
    now = +new Date(year, month, 1, 12);
    w.dispatchEvent(new w.Event('focus'));
    expect(segments.children).toHaveLength(length);
    expect([...segments.children].every(day => day.style.getPropertyValue('--sp-day-fill') === '0%')).toBe(true);
  }
});

it('fills the season track through reached thresholds and partway toward the next stage', async () => {
  game = await loadGame(true, null, null, async path => ({ ok: true, json: async () => path === 'data/season.json' ? data : [] }));
  const { w, api } = game;
  const now = EPOCH + 9 * DAY;
  w.Date.now = () => now;
  api.setSave({ ...api.save, season: { ...emptySeason(1), points: 70 }, lastSeenTime: now });
  w.openMissions();
  w.document.querySelector('[data-tab="season"]').click();
  const stage = day => w.document.querySelector(`.sp-card[data-stage="${day}"]`);
  await vi.waitFor(() => expect(stage(9)).not.toBeNull());
  expect(stage(8).style.getPropertyValue('--sp-incoming')).toBe('100%');
  expect(stage(8).hasAttribute('data-reached')).toBe(true);
  expect(stage(8).style.getPropertyValue('--sp-outgoing')).toBe('100%');
  expect(stage(9).hasAttribute('data-reached')).toBe(false);
  expect(stage(9).style.getPropertyValue('--sp-incoming')).toBe('50%');
});

it('reports the visible stage range and only shows the jump arrow when its target is out of view', async () => {
  game = await loadGame(true, null, null, async path => ({ ok: true, json: async () => path === 'data/season.json' ? data : [] }));
  const { w, api } = game;
  w.Date.now = () => EPOCH;
  api.setSave({ ...api.save, season: { ...emptySeason(1), points: 56 }, lastSeenTime: EPOCH });
  const track = w.document.querySelector('.sp-track');
  await w.openMissions('season');
  const stages = track.querySelectorAll('[data-stage]');
  const range = w.document.getElementById('sp-stage-range');
  const jump = w.document.querySelector('.sp-jump');
  expect(stages).toHaveLength(30);
  track.getBoundingClientRect = () => ({ top: 0, bottom: 244 });
  stages.forEach((stage, index) => {
    stage.getBoundingClientRect = () => {
      const top = index * 63 - track.scrollTop;
      return { top, bottom: top + 55 };
    };
  });
  for (const [offset, label, direction] of [[0, 'Stage 01–04', 'down'], [6 * 63, 'Stage 07–10', ''], [26 * 63, 'Stage 27–30', 'up']]) {
    track.scrollTop = offset;
    track.dispatchEvent(new w.Event('scroll'));
    expect(range.textContent).toBe(label);
    expect(jump.hidden).toBe(!direction);
    expect(jump.dataset.direction).toBe(direction);
  }
  jump.click();
  expect(jump.hidden).toBe(true);
  expect(w.document.activeElement).toBe(stages[6]);
});

it('claims the rare overflow row repeatedly and retains count and remainder on reload', async () => {
  game = await loadGame(true, null, null, async path => ({ ok: true, json: async () => path === 'data/season.json' ? data : [] }));
  const { w, api, advance } = game;
  w.Date.now = () => EPOCH;
  api.setSave({ ...api.save, season: { ...emptySeason(1), points: 258 }, lastSeenTime: EPOCH });
  await w.openMissions('season');
  const bonus = () => w.document.querySelector('[data-bonus]');
  expect(bonus().nextElementSibling).toBeNull();
  expect(bonus().querySelector('h3').textContent).toBe('Bonus chest · every 8 SP');
  expect(bonus().querySelector('img').getAttribute('src')).toBe('assets/ui/crates/rare.png');
  const { universalParts, storedCrates } = api.save;
  const giftStat = api.save.stats.rareItemsFromDailyBox;
  for (const [count, label] of [[1, '2 ready · 2 / 8 SP'], [2, '1 ready · 2 / 8 SP']]) {
    expect(bonus().querySelector('#sp-bonus-progress').textContent).toBe(label);
    bonus().querySelector('button').click();
    advance(16);
    advance(16);
    expect(api.save.season.bonusClaimed).toBe(count);
  }
  expect(api.save.universalParts).toBe(universalParts);
  expect(api.save.storedCrates).toEqual([...storedCrates, { rarity: 'rare' }, { rarity: 'rare' }]);
  expect(bonus().querySelector('button')).toBeNull();
  expect(bonus().querySelector('progress').value).toBe(2);
  const clean = w.sanitizeSave(w.LBSave.serializeSave(api.save), api.save);
  expect(clean.season).toMatchObject({ points: 258, bonusClaimed: 2 });
  expect(clean.storedCrates).toEqual(api.save.storedCrates);
  w.closeMissions();
  await w.openInventory('crates');
  w.document.querySelector('.lb43-open-all').click();
  expect(api.save.storedCrates).toEqual([]);
  expect(api.save.universalParts).toBeGreaterThan(universalParts);
  expect(api.save.stats.rareItemsFromDailyBox).toBe(giftStat);
});
