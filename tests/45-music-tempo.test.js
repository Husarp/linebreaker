import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import '../45-music-tempo.js';
import { loadGame } from './loader.js';

const { tempoForSpeed, createRunTempo, createTimeline } = globalThis.LBMusicTempo;

it('adds four percent per level above one, up to fifty percent', () => {
  expect([1, 2, 5, 13, 14, 15, 100].map(tempoForSpeed)).toEqual([1, 1.04, 1.16, 1.48, 1.5, 1.5, 1.5]);
  expect([0, -1, undefined, NaN, Infinity].map(tempoForSpeed)).toEqual([1, 1, 1, 1, 1]);
});

it('holds the peak tempo within a run and resets to normal for an opted-out run', () => {
  const tempo = createRunTempo();
  expect(tempo.update(5)).toBe(1.16);
  expect(tempo.update(3)).toBe(1.16);
  expect(tempo.update(10, false)).toBe(1.16);
  expect(tempo.update(10, true)).toBeCloseTo(1.36);
  tempo.reset();
  expect(tempo.update(10, false)).toBe(1);
  expect(tempo.update(2, true)).toBe(1.04);
});

it('retimes only the next bar, with shorter notes and no change to their pitch', () => {
  const events = [0, 0.75, 1, 1.5, 2].map(time => ({ time, duration: 0.125, note: 60 }));
  const timeline = createTimeline(events, 3, 1);
  const play = vi.fn();
  timeline.start(10, 0);
  expect(timeline.schedule(10, play)).toBe(false);
  timeline.setTempo(1.25);
  timeline.schedule(10.7, play);
  timeline.schedule(10.9, play);
  timeline.setTempo(1.5);
  timeline.schedule(11.3, play);
  timeline.schedule(11.7, play);
  expect(play.mock.calls).toEqual([
    [events[0], 10, 0.125], [events[1], 10.75, 0.125], [events[2], 11, 0.1],
    [events[3], 11.4, 0.1], [events[4], 11.8, 0.125 / 1.5]
  ]);
  expect(timeline.schedule(12.46, play)).toBe(false);
  expect(timeline.schedule(12.47, play)).toBe(true);
});

it('resumes in the audible bar even when the lookahead scheduled the next bar', () => {
  const events = [0, 1, 1.25].map(time => ({ time, duration: 0.125 }));
  const timeline = createTimeline(events, 3, 1);
  const play = vi.fn();
  timeline.start(0, 0);
  timeline.schedule(0, play);
  timeline.setTempo(1.25);
  timeline.schedule(0.875, play);
  timeline.pause(0.875);
  timeline.resume(10);
  play.mockClear();
  timeline.schedule(10, play);
  timeline.schedule(10.2, play);
  expect(play.mock.calls).toEqual([[events[1], 10.125, 0.1], [events[2], 10.325, 0.1]]);
});

it('finishes a requested transition at the current bar without scheduling the next downbeat', () => {
  const events = [0, 0.875, 1].map(time => ({ time, duration: 0.125 }));
  const timeline = createTimeline(events, 3, 1);
  const play = vi.fn();
  timeline.start(0, 0);
  timeline.schedule(0, play);
  timeline.finishAtBar();
  expect(timeline.schedule(0.85, play)).toBe(false);
  expect(timeline.schedule(1, play)).toBe(true);
  expect(play.mock.calls.map(([event]) => event)).toEqual(events.slice(0, 2));
});

it('applies run speed, respects the Intense playlist, and persists the opt-out', async () => {
  const catalog = JSON.parse(readFileSync(new URL('../assets/music.release.json', import.meta.url), 'utf8'));
  const fetch = async () => ({ ok: true, json: async () => catalog });
  const { w, api, advance, close } = await loadGame(true, null, null, fetch);
  try {
    const createSource = w.LBMusicSynth.createSource;
    const sources = [];
    vi.spyOn(w.LBMusicSynth, 'createSource').mockImplementation((...args) => {
      const source = createSource(...args);
      for (const method of ['setTempo', 'finishAtBar', 'start']) vi.spyOn(source, method);
      sources.push(source);
      return source;
    });
    w.Math.random = () => 0.75;
    api.setup();
    api.startMusic();
    await api.switchMusicMode('game');
    const title = () => w.document.getElementById('mw-title').textContent;
    const gameTrack = sources.at(-1);
    expect(api._getPlaylist('game')).toContain(title());
    for (let clear = 0; clear < 10; clear++) {
      api.setBoard(Array.from({ length: 22 }, (_, row) => Array(10).fill(row >= 18 ? 1 : 0)));
      expect(api.sweep()).toBe(true);
      advance(150);
    }
    expect(api.state.level).toBe(5);
    expect(gameTrack.setTempo.mock.calls.flat()).toEqual([1, 1.04, 1.08, 1.12, 1.16]);
    expect(gameTrack.finishAtBar).toHaveBeenCalledOnce();
    gameTrack.onended();
    const intenseTrack = sources.at(-1);
    expect(api._getPlaylist('action')).toContain(title());
    expect(intenseTrack.setTempo).toHaveBeenCalledWith(1.16);
    expect(intenseTrack.setTempo.mock.invocationCallOrder[0]).toBeLessThan(intenseTrack.start.mock.invocationCallOrder[0]);

    w.openSettings();
    const checkbox = w.document.getElementById('setting-music-follows-speed');
    expect(checkbox.checked).toBe(true);
    checkbox.click();
    expect(JSON.parse(w.localStorage.getItem('linebreaker_settings')).musicFollowsSpeed).toBe(false);
    expect(intenseTrack.setTempo).toHaveBeenLastCalledWith(1.16);

    await api.switchMusicMode('menu');
    await Promise.resolve();
    expect(api._getPlaylist('menu')).toContain(title());
    expect(sources.at(-1).setTempo).not.toHaveBeenCalled();
    api.setup({ speed: 8, save: { actionPlaylist: [] } });
    await api.switchMusicMode('game');
    expect(api._getPlaylist('game')).toContain(title());
    expect(sources.at(-1).setTempo).toHaveBeenLastCalledWith(1);

    checkbox.click();
    api.setup({ speed: 8 });
    await api.switchMusicMode('game');
    const newRun = sources.at(-1);
    expect(api._getPlaylist('action')).toContain(title());
    expect(newRun.setTempo).toHaveBeenCalledWith(1.28);
    expect(newRun.start.mock.invocationCallOrder[0]).toBeLessThan(newRun.setTempo.mock.invocationCallOrder[0]);
  } finally { close(); }
});
