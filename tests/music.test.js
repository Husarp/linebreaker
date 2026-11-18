import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import '../music-synth.js';
import { loadGame } from './loader.js';

const original = JSON.parse(readFileSync(new URL('../assets/music.release.json', import.meta.url), 'utf8'));
const local = JSON.parse(readFileSync(new URL('../assets/music.json', import.meta.url), 'utf8'));
const { getTrack, createSource } = globalThis.LBMusicSynth;

it('defines ten distinct, layered score loops with the requested lengths', () => {
  expect(Object.values(original).map(tracks => tracks.length)).toEqual([4, 4, 2]);
  const melodies = new Set();
  for (const [category, entries] of Object.entries(original)) {
    for (const entry of entries) {
      expect(entry.file).toBeUndefined();
      const track = getTrack(entry.synth);
      const bounds = category === 'menu' ? [60, 90] : category === 'game' ? [90, 120] : [60, 90];
      expect(track.duration).toBeGreaterThanOrEqual(bounds[0]);
      expect(track.duration).toBeLessThanOrEqual(bounds[1]);
      expect(new Set(track.events.map(event => event.voice))).toEqual(new Set([0, 1, 2, 'kick', 'snare', 'hat']));
      for (const event of track.events) {
        expect(event.duration).toBeGreaterThan(0);
        expect(event.time + event.duration).toBeLessThanOrEqual(track.duration + 1e-9);
      }
      melodies.add(track.events.filter(event => event.voice === 0).slice(0, 20).map(event => event.note).join(','));
    }
  }
  expect(melodies.size).toBe(10);
});

it('schedules only a look-ahead window and cancels audio and timers on pause or stop', () => {
  vi.useFakeTimers();
  try {
    const starts = [], sources = [];
    const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const node = () => ({ connect() {}, disconnect: vi.fn() });
    const playingNode = () => {
      const active = { ...node(), frequency: param(), start: time => starts.push(time), stop: vi.fn() };
      sources.push(active);
      return active;
    };
    const context = {
      currentTime: 20, sampleRate: 48000, state: 'running',
      createBiquadFilter: () => ({ ...node(), frequency: {}, Q: {} }),
      createGain: () => ({ ...node(), gain: param() }),
      createOscillator: playingNode, createBufferSource: playingNode,
      createBuffer: () => ({ getChannelData: () => new Float32Array(9600) })
    };
    const track = getTrack('glass-harbor');
    const source = createSource(context, { synth: track, duration: track.duration });
    source.onended = vi.fn();
    source.start();
    expect(starts.length).toBeGreaterThan(0);
    expect(starts.every(time => time >= 20 && time < 20.19)).toBe(true);
    context.currentTime = 20.35;
    vi.advanceTimersByTime(45);
    expect(starts.some(time => time >= 20.35 && time < 20.54)).toBe(true);
    source.pause();
    expect(sources.every(active => active.disconnect.mock.calls.length === 1)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(source.onended).not.toHaveBeenCalled();
    source.resume();
    source.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(source.onended).not.toHaveBeenCalled();

    const ending = createSource(context, { synth: track, duration: track.duration });
    ending.onended = vi.fn();
    ending.start(0, track.duration - 0.1);
    context.currentTime += 0.2;
    vi.advanceTimersByTime(45);
    expect(ending.onended).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it('uses all three synth playlists when local MP3s are missing, even with an old save', async () => {
  const fetch = vi.fn(async (path, options) => options?.method === 'HEAD' ? { ok: false } : {
    ok: true, json: async () => path.endsWith('music.release.json') ? original : local
  });
  const { w, api, close } = await loadGame(true, null, null, fetch);
  try {
    api.setup({ save: { menuPlaylist: ['Rest Area'], gamePlaylist: ['Original Tetris Theme'] } });
    await api._initTrackCatalog();
    const title = () => w.document.getElementById('mw-title').textContent;
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'HEAD')).toHaveLength(11);
    expect(api._getPlaylist('menu')).toEqual(original.menu.map(track => track.title));
    expect(api._getPlaylist('game')).toEqual(original.game.map(track => track.title));
    expect(api._getPlaylist('action')).toEqual(original.intense.map(track => track.title));
    api.startMusic();
    await Promise.resolve();
    expect(api._getPlaylist('menu')).toContain(title());
    const first = title();
    w.musicWidgetNext();
    expect(title()).not.toBe(first);
    w.playTrackInPlaylist('Glass Harbor');
    w.musicWidgetPause();
    w.musicWidgetPause();
    expect(title()).toBe('Glass Harbor');
    w.Math.random = () => 0.75;
    await api.switchMusicMode('game');
    expect(api._getPlaylist('game')).toContain(title());
    w.Math.random = () => 0.25;
    await api.switchMusicMode('game');
    expect(api._getPlaylist('action')).toContain(title());
  } finally { close(); }
});

it('does not ship local MP3s or catalogue entries without the private build flag', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'lb-music-build-'));
  const path = relative => join(fixture, relative);
  const build = fileURLToPath(new URL('../scripts/build-web.mjs', import.meta.url));
  const packagedCatalog = () => JSON.parse(readFileSync(path('dist-web/assets/music.json'), 'utf8'));
  try {
    mkdirSync(path('assets/music'), { recursive: true });
    mkdirSync(path('assets/fonts'));
    mkdirSync(path('ui'));
    mkdirSync(path('data'));
    for (const file of ['index.html', 'app.js', 'music-synth.js', 'style.css', 'desktop.js', 'native-save.js', 'touch.js', 'touch.css', 'portrait.css', 'ui/tokens.css']) {
      writeFileSync(path(file), 'test fixture');
    }
    for (const file of ['music.json', 'music.release.json']) cpSync(new URL('../assets/' + file, import.meta.url), path('assets/' + file));
    cpSync(new URL('../data/missions.json', import.meta.url), path('data/missions.json'));
    writeFileSync(path('assets/music/Rest Area.mp3'), 'test fixture');
    writeFileSync(path('assets/music/unlisted.mp3'), 'test fixture');

    execFileSync(process.execPath, [build, '--local-music'], { cwd: fixture });
    expect(packagedCatalog().menu.filter(track => track.file)).toEqual([local.menu[0]]);
    expect(existsSync(path('dist-web/assets/music/Rest Area.mp3'))).toBe(true);
    expect(existsSync(path('dist-web/assets/music/unlisted.mp3'))).toBe(false);

    execFileSync(process.execPath, [build], { cwd: fixture });
    expect(packagedCatalog()).toEqual(original);
    expect(existsSync(path('dist-web/assets/music'))).toBe(false);
    expect(existsSync(path('dist-web/music-synth.js'))).toBe(true);
    expect(readFileSync(path('dist-web/data/missions.json'), 'utf8')).toBe(readFileSync(path('data/missions.json'), 'utf8'));
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
