import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import '../45-music-tempo.js';
import '../music-synth.js';
import { loadGame } from './loader.js';

const original = JSON.parse(readFileSync(new URL('../assets/music.release.json', import.meta.url), 'utf8'));
const local = JSON.parse(readFileSync(new URL('../assets/music.json', import.meta.url), 'utf8'));
const { getTrack, createSource } = globalThis.LBMusicSynth;

const synthCatalog = async () => ({ ok: true, json: async () => original });

async function resetMusicAfterBoot(win, api) {
  await vi.waitFor(() => expect(win.document.getElementById('loading-screen').dataset.dismissed).toBe('1'));
  api.stopMusic();
}

function observeMusic(win, active = new Set()) {
  const sources = [];
  const start = source => {
    expect(active.size).toBe(0);
    active.add(source);
  };
  vi.spyOn(win.LBMusicSynth, 'createSource').mockImplementation(() => {
    const source = {
      connect: vi.fn(), start: vi.fn(() => start(source)), resume: vi.fn(() => start(source)),
      pause: vi.fn(() => active.delete(source)), stop: vi.fn(() => active.delete(source))
    };
    sources.push(source);
    return source;
  });
  return { sources, active };
}

it('updates the menu music widget on its interval only while music is playing', async () => {
  const refreshes = [];
  const { w, api, close } = await loadGame(true, null, null, synthCatalog, null, win => {
    const setInterval = win.setInterval;
    win.setInterval = (callback, period) => {
      if (period === 500) refreshes.push(callback);
      return setInterval(callback, period);
    };
  });
  try {
    await resetMusicAfterBoot(w, api);
    observeMusic(w);
    await api.startMusic();
    expect(refreshes).toHaveLength(1);
    const title = w.document.getElementById('mw-title');
    const track = title.textContent;
    expect(api._getPlaylist('menu')).toContain(track);
    title.textContent = 'unchanged';
    refreshes[0]();
    expect(title.textContent).toBe(track);
    w.musicWidgetPause();
    title.textContent = 'unchanged';
    refreshes[0]();
    expect(title.textContent).toBe('unchanged');
  } finally { close(); }
});

it('lets only the latest catalog request or source completion start music', async () => {
  let sendCatalog;
  const catalog = new Promise(resolve => { sendCatalog = resolve; });
  const { w, api, close } = await loadGame(true, null, null, async path => path === 'assets/music.json'
    ? catalog : { ok: true, json: async () => [] });
  try {
    await resetMusicAfterBoot(w, api);
    const { sources, active } = observeMusic(w);
    w.Math.random = () => 0.75;
    api.setup();
    const menu = api.startMusic();
    const game = api.switchMusicMode('game');
    const nextMenu = api.switchMusicMode('menu');
    sendCatalog(await synthCatalog());
    await Promise.all([menu, game, nextMenu]);
    expect(sources).toHaveLength(1);
    expect(api._getPlaylist('menu')).toContain(w.document.getElementById('mw-title').textContent);
    const staleEnd = sources[0].onended;
    await api.switchMusicMode('game');
    expect(sources[0].stop).toHaveBeenCalledOnce();
    staleEnd();
    expect(sources).toHaveLength(2);

    api.setup({ speed: 5 });
    const gameEnd = sources[1].onended;
    gameEnd();
    gameEnd();
    expect(sources).toHaveLength(3);
    expect([...active]).toEqual([sources[2]]);
    expect(api._getPlaylist('action')).toContain(w.document.getElementById('mw-title').textContent);
  } finally { close(); }
});

it('retires the outgoing OTA player before the new document starts music', async () => {
  const first = await loadGame(true, null, null, synthCatalog);
  let replacement;
  try {
    await resetMusicAfterBoot(first.w, first.api);
    const { sources, active } = observeMusic(first.w);
    await first.api.startMusic();
    const track = sources[0];
    const staleEnd = track.onended;
    const switching = first.api.switchMusicMode('game');
    first.w.dispatchEvent(new first.w.Event('lb:bundle-restart'));
    await switching;
    replacement = await loadGame(true, null, null, synthCatalog);
    await resetMusicAfterBoot(replacement.w, replacement.api);
    const next = observeMusic(replacement.w, active);
    await replacement.api.startMusic();
    first.w.dispatchEvent(new first.w.PageTransitionEvent('pageshow'));
    first.w.document.dispatchEvent(new first.w.Event('visibilitychange'));
    await first.api.startMusic();
    staleEnd();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(sources).toEqual([track]);
    expect([...active]).toEqual(next.sources);
    expect(active.size).toBe(1);
  } finally {
    first.close();
    replacement?.close();
  }
});

it('cues the next track silently if the current track ends as the app backgrounds', async () => {
  const { w, api, close } = await loadGame(true, null, null, synthCatalog);
  try {
    await resetMusicAfterBoot(w, api);
    const { sources, active } = observeMusic(w);
    await api.startMusic();
    let hidden = true;
    Object.defineProperty(w.document, 'hidden', { get: () => hidden });
    sources[0].onended();
    expect(sources).toHaveLength(2);
    expect(active.size).toBe(0);
    hidden = false;
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    expect([...active]).toEqual([sources[1]]);
  } finally { close(); }
});

it('disconnects a lingering Fernlight output before any replacement can play', async () => {
  const { w, api, close } = await loadGame(true, null, null, synthCatalog);
  try {
    await resetMusicAfterBoot(w, api);
    const connected = new Set();
    const sources = [];
    const createGain = w.AudioContext.prototype.createGain;
    vi.spyOn(w.AudioContext.prototype, 'createGain').mockImplementation(function () {
      const gain = createGain.call(this);
      gain.connect = () => connected.add(gain);
      gain.disconnect = () => connected.delete(gain);
      return gain;
    });
    const audible = () => sources.filter(source => source.playing && connected.has(source.output) && source.output.gain.value > 0);
    vi.spyOn(w.LBMusicSynth, 'createSource').mockImplementation((context, { synth }) => {
      const source = {
        connect(output) { this.output = output; },
        start() { expect(audible()).toEqual([]); this.playing = true; },
        resume() { this.start(); },
        pause() { this.playing = false; },
        stop() {
          if (synth === w.LBMusicSynth.getTrack('fernlight')) return;
          this.playing = false;
        }
      };
      sources.push(source);
      return source;
    });
    let hidden = false;
    Object.defineProperty(w.document, 'hidden', { get: () => hidden });
    const setHidden = value => {
      hidden = value;
      w.document.dispatchEvent(new w.Event('visibilitychange'));
    };
    api.setup();
    await api.startMusic();
    expect(audible()).toEqual([sources.at(-1)]);
    await api.switchMusicMode('game');
    await api.switchMusicMode('menu');
    w.openPlaylistPanel();
    w.playTrackInPlaylist('Fernlight');
    const fernlight = sources.at(-1);
    w.closePlaylistPanel();
    expect(audible()).toEqual([fernlight]);
    setHidden(true);
    expect(audible()).toEqual([]);
    setHidden(false);
    expect(audible()).toEqual([fernlight]);
    w.musicWidgetNext();
    expect(fernlight.playing).toBe(true);
    expect(audible()).toEqual([sources.at(-1)]);
    w.playTrackInPlaylist('Fernlight');
    const ending = sources.at(-1);
    const finish = ending.onended;
    finish();
    finish();
    expect(ending.playing).toBe(true);
    expect(audible()).toEqual([sources.at(-1)]);
    expect(audible()).not.toContain(ending);
  } finally { close(); }
});

it('does not resume a widget-paused track on foregrounding or revive it after pagehide', async () => {
  const { w, api, close } = await loadGame(true, null, null, synthCatalog);
  try {
    await resetMusicAfterBoot(w, api);
    let hidden = false;
    Object.defineProperty(w.document, 'hidden', { get: () => hidden });
    const visibility = value => {
      hidden = value;
      w.document.dispatchEvent(new w.Event('visibilitychange'));
    };
    const { sources, active } = observeMusic(w);
    api.setup();
    await api.startMusic();
    const [track] = sources;
    const panel = w.document.getElementById('playlist-panel-content');
    w.openPlaylistPanel();
    await Promise.resolve();
    expect(panel.querySelectorAll('[aria-current] .lb-playlist-equalizer i')).toHaveLength(3);
    expect(panel.hasAttribute('data-playing')).toBe(true);
    visibility(true);
    expect(track.pause).toHaveBeenCalledOnce();
    expect(panel.hasAttribute('data-playing')).toBe(false);
    visibility(false);
    expect(track.resume).toHaveBeenCalledOnce();
    w.musicWidgetPause();
    visibility(true);
    visibility(false);
    expect(track.resume).toHaveBeenCalledOnce();
    expect(panel.hasAttribute('data-playing')).toBe(false);
    w.musicWidgetPause();
    expect(track.resume).toHaveBeenCalledTimes(2);
    expect(panel.hasAttribute('data-playing')).toBe(true);

    const staleEnd = track.onended;
    const pendingSwitch = api.switchMusicMode('game');
    w.dispatchEvent(new w.PageTransitionEvent('pagehide'));
    await pendingSwitch;
    staleEnd();
    expect(sources).toHaveLength(1);
    expect(active.size).toBe(0);
  } finally { close(); }
});

it('keeps the player pause through a game, menu return, and reload until Play is pressed', async () => {
  const first = await loadGame(true, null, null, synthCatalog);
  let saved;
  try {
    await resetMusicAfterBoot(first.w, first.api);
    const { active } = observeMusic(first.w);
    first.api.setup();
    await first.api.startMusic();
    expect(active.size).toBe(1);
    first.w.musicWidgetPause();
    await first.api.switchMusicMode('game');
    await first.api.switchMusicMode('menu');
    first.w.document.dispatchEvent(new first.w.Event('visibilitychange'));
    expect(active.size).toBe(0);
    saved = JSON.parse(first.w.localStorage.getItem('linebreaker_settings'));
    expect(saved.musicPaused).toBe(true);
  } finally { first.close(); }
  const reopened = await loadGame(true, null, null, synthCatalog, saved);
  try {
    await resetMusicAfterBoot(reopened.w, reopened.api);
    const { active } = observeMusic(reopened.w);
    reopened.api.setup();
    await reopened.api.startMusic();
    expect(active.size).toBe(0);
    const playlist = reopened.w.document.getElementById('pl-mw-pause');
    expect(playlist.getAttribute('aria-label')).toBe('Play music');
    reopened.w.musicWidgetPause();
    await vi.waitFor(() => expect(active.size).toBe(1));
    expect(JSON.parse(reopened.w.localStorage.getItem('linebreaker_settings')).musicPaused).toBe(false);
  } finally { reopened.close(); }
});

it.each(['visibilitychange', 'pagehide', 'native pause'])('silences all output on %s and only resumes music', async trigger => {
  const handlers = new Map();
  const capacitor = trigger === 'native pause' ? { isNativePlatform: () => true, Plugins: {
    App: { async addListener(name, listener) { handlers.set(name, listener); } },
    Filesystem: { async readFile() { return { data: '{"totalXP":0}' }; } }
  } } : null;
  const { w, api, close } = await loadGame(true, null, capacitor, synthCatalog);
  try {
    await resetMusicAfterBoot(w, api);
    let hidden = false;
    Object.defineProperty(w.document, 'hidden', { get: () => hidden });
    const visibility = value => {
      hidden = value;
      w.document.dispatchEvent(new w.Event('visibilitychange'));
    };
    const createGain = w.AudioContext.prototype.createGain;
    const gains = [];
    vi.spyOn(w.AudioContext.prototype, 'createGain').mockImplementation(function () {
      const node = createGain.call(this);
      gains.push(node);
      vi.spyOn(node, 'disconnect');
      return node;
    });
    const sfx = vi.spyOn(w.AudioContext.prototype, 'createOscillator');
    const { sources, active } = observeMusic(w);
    const button = w.document.body.appendChild(w.document.createElement('button'));
    api.setup();
    await api.startMusic();
    const [musicGain, , originalSfxGain] = gains;
    const [track] = sources;
    button.click();
    expect(sfx).toHaveBeenCalled();
    sfx.mockClear();

    if (trigger === 'visibilitychange') visibility(true);
    else if (trigger === 'pagehide') w.dispatchEvent(new w.PageTransitionEvent('pagehide', { persisted: true }));
    else handlers.get('pause')();
    expect(track.pause).toHaveBeenCalledOnce();
    expect(active.size).toBe(0);
    expect(musicGain.gain.value).toBe(0);
    expect(originalSfxGain.disconnect).toHaveBeenCalledOnce();
    button.click();
    expect(sfx).not.toHaveBeenCalled();

    if (trigger === 'pagehide') {
      visibility(false);
      expect(track.resume).not.toHaveBeenCalled();
      visibility(true);
      w.dispatchEvent(new w.PageTransitionEvent('pageshow', { persisted: true }));
    } else if (trigger === 'native pause') {
      handlers.get('appStateChange')({ isActive: false });
      handlers.get('appStateChange')({ isActive: true });
      expect(track.resume).not.toHaveBeenCalled();
      visibility(true);
      handlers.get('resume')();
    }
    expect(track.resume).not.toHaveBeenCalled();
    expect(sfx).not.toHaveBeenCalled();
    visibility(false);
    expect(track.resume).toHaveBeenCalledOnce();
    expect(musicGain.gain.value).toBeGreaterThan(0);
    expect(sfx).not.toHaveBeenCalled();
    button.click();
    expect(sfx).toHaveBeenCalled();
  } finally { close(); }
});

it('unlocks the idle achievement in the background without playing its sound or showing its popup', async () => {
  let idleCheck, now;
  const { w, api, close } = await loadGame(true, null, null, synthCatalog, null, win => {
    now = win.Date.now();
    win.Date.now = () => now;
    const setInterval = win.setInterval;
    win.setInterval = (fn, delay) => {
      if (delay === 30000) idleCheck = fn;
      return setInterval(fn, delay);
    };
  });
  try {
    await resetMusicAfterBoot(w, api);
    observeMusic(w);
    api.setup();
    await api.startMusic();
    const sfx = vi.spyOn(w.AudioContext.prototype, 'createOscillator');
    const bodyChildren = w.document.body.childElementCount;
    let hidden = true;
    Object.defineProperty(w.document, 'hidden', { get: () => hidden });
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    now += 15 * 60 * 1000;
    idleCheck();
    expect(api.save.achievements.afk.unlocked).toBe(true);
    expect(api.save.pendingAchievementClaims).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'afk' })]));
    expect(w.document.body.childElementCount).toBe(bodyChildren);
    expect(sfx).not.toHaveBeenCalled();
    hidden = false;
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    expect(sfx).not.toHaveBeenCalled();
  } finally { close(); }
});

it('disconnects a failed recording before starting synth and ignores stale media events', async () => {
  const media = [], requests = [];
  const active = new Set();
  const fetch = async (path, options) => options?.method === 'HEAD' ? { ok: true } : {
    ok: true, json: async () => path.endsWith('music.release.json') ? original : local
  };
  const { w, api, close } = await loadGame(true, null, null, fetch, null, win => {
    win.Audio = function () {
      const audio = win.document.createElement('audio');
      audio.play = vi.fn(() => new Promise((resolve, reject) => { requests.push({ resolve, reject }); }));
      audio.pause = vi.fn();
      audio.load = vi.fn();
      media.push(audio);
      return audio;
    };
    win.AudioContext.prototype.createMediaElementSource = audio => ({
      connect() { expect(active.size).toBe(0); active.add(audio); },
      disconnect() { active.delete(audio); }
    });
  });
  try {
    await resetMusicAfterBoot(w, api);
    media.length = requests.length = 0;
    const warn = vi.spyOn(w.console, 'warn').mockImplementation(() => {});
    vi.spyOn(w.console, 'info').mockImplementation(() => {});
    const { sources } = observeMusic(w, active);
    api.setup({ save: { menuPlaylist: ['Rest Area'] } });
    await api.startMusic();
    requests[0].reject(new w.DOMException('Gesture required', 'NotAllowedError'));
    await Promise.resolve();
    expect(warn).toHaveBeenCalledOnce();
    expect(media[0].pause).toHaveBeenCalledOnce();
    expect(media[0].hasAttribute('src')).toBe(false);
    expect([...active]).toEqual([sources[0]]);
    w.playTrackInPlaylist('Rest Area');
    await api.switchMusicMode('game');
    media[1].onerror();
    media[1].onloadedmetadata();
    media[1].onended();
    requests[1].resolve();
    await Promise.resolve();
    expect(media[1].pause).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledOnce();
    expect([...active]).toEqual([sources[1]]);
  } finally { close(); }
});

it('unlocks a previously blocked context without replacing the source or restoring stale volume', async () => {
  let context, volume;
  const { w, api, close } = await loadGame(true, null, null, synthCatalog, { musicVol: 50, musicMuted: true }, win => {
    const Base = win.AudioContext;
    win.AudioContext = class extends Base {
      constructor() { super(); context = this; volume = null; this.state = 'suspended'; }
      createGain() { const node = super.createGain(); volume ||= node.gain; return node; }
      resume = vi.fn(() => new Promise(() => {}));
    };
  });
  try {
    await resetMusicAfterBoot(w, api);
    const { sources } = observeMusic(w);
    api.setup();
    await api.startMusic();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(volume.value).toBe(0);
    context.resume.mockImplementation(() => { context.state = 'running'; return Promise.resolve(); });
    w.LBInput.unlockAudio();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(volume.value).toBe(0);
    w.toggleMute('music');
    expect(volume.value).toBeCloseTo(0.1);
    expect(sources).toHaveLength(1);
    expect(sources[0].start).toHaveBeenCalledOnce();
  } finally { close(); }
});

it('still plays a built-in score when both catalogs fail to load', async () => {
  let warn;
  const { w, api, close } = await loadGame(true, null, null, async () => ({ ok: false, status: 503 }), null, win => {
    warn = vi.spyOn(win.console, 'warn').mockImplementation(() => {});
  });
  try {
    await resetMusicAfterBoot(w, api);
    const { sources } = observeMusic(w);
    api.setup();
    await api.startMusic();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(sources[0].start).toHaveBeenCalledOnce();
    expect(w.document.getElementById('mw-title').textContent).toBe('Glass Harbor');
  } finally { close(); }
});

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
    api.setup({ save: { menuPlaylist: ['Rest Area'], gamePlaylist: ['Classic Block Theme'] } });
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
    const seek = w.document.getElementById('mw-progress');
    expect(seek.disabled).toBe(false);
    seek.value = '50';
    w.musicWidgetSeek(new w.Event('change'), seek);
    expect(title()).toBe('Glass Harbor');
    expect(seek.valueAsNumber).toBeCloseTo(50, 0);
    expect(seek.style.getPropertyValue('--track-progress')).toBe(`${seek.value}%`);
    expect(w.document.getElementById('mw-elapsed').textContent).not.toBe('0:00');
    w.Math.random = () => 0.75;
    await api.switchMusicMode('game');
    expect(api._getPlaylist('game')).toContain(title());
    w.Math.random = () => 0.25;
    await api.switchMusicMode('game');
    expect(api._getPlaylist('action')).toContain(title());
  } finally { close(); }
});

it('keeps the music volume and mute independent of run fades and settings edits', async () => {
  const gains = [];
  const fetch = async path => ({ ok: true, json: async () => path.endsWith('music.release.json') ? original : [] });
  const { w, api, close } = await loadGame(true, null, null, fetch, { musicVol: 30, musicMuted: false }, win => {
    const createGain = win.AudioContext.prototype.createGain;
    win.AudioContext.prototype.createGain = function () {
      const node = createGain.call(this);
      node.connect = vi.fn();
      node.gain.linearRampToValueAtTime = vi.fn();
      gains.push(node);
      return node;
    };
  });
  try {
    api.setup();
    api.startMusic();
    const [volume, fade, effects] = gains;
    expect(volume.connect).toHaveBeenCalledWith(fade);
    expect(volume.gain.value).toBeCloseTo(0.06);
    const muteButton = w.document.getElementById('mw-mute');
    expect(muteButton.getAttribute('aria-label')).toBe('Mute music');
    await api.switchMusicMode('game');
    expect(fade.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 1.5);
    expect(volume.gain.linearRampToValueAtTime).not.toHaveBeenCalled();
    w.toggleMute('music');
    expect(volume.gain.value).toBe(0);
    expect(muteButton.getAttribute('aria-label')).toBe('Unmute music');
    w.onSettingChange('musicVol', '75');
    expect(volume.gain.value).toBe(0);
    expect(effects.gain.value).toBeCloseTo(0.2);
    w.document.getElementById('app').classList.add('active-game');
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'KeyM' }));
    expect(volume.gain.value).toBeCloseTo(0.15);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'KeyM', repeat: true }));
    expect(volume.gain.value).toBeCloseTo(0.15);
    for (const explicitlyMuted of [false, true]) {
      if (explicitlyMuted) w.toggleMute('music');
      w.onSettingChange('musicVol', '0');
      expect(muteButton.getAttribute('aria-label')).toBe('Unmute music');
      expect(volume.gain.value).toBe(0);
      w.toggleMute('music');
      expect(muteButton.getAttribute('aria-label')).toBe('Mute music');
      expect(volume.gain.value).toBeCloseTo(0.15);
      expect(w.document.getElementById('setting-music-vol').value).toBe('75');
    }
  } finally { close(); }
});

it('stages only catalogued Ogg recordings and only with the private build flag', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'lb-music-build-'));
  const path = relative => join(fixture, relative);
  const build = fileURLToPath(new URL('../scripts/build-web.mjs', import.meta.url));
  const packagedCatalog = () => JSON.parse(readFileSync(path('dist-web/assets/music.json'), 'utf8'));
  try {
    mkdirSync(path('assets/music'), { recursive: true });
    mkdirSync(path('assets/fonts'));
    mkdirSync(path('assets/ui'));
    cpSync(new URL('../assets/skins', import.meta.url), path('assets/skins'), { recursive: true });
    cpSync(new URL('../assets/ui', import.meta.url), path('assets/ui'), { recursive: true });
    mkdirSync(path('ui'));
    mkdirSync(path('data'));
    writeFileSync(path('index.html'), '<script src="music-synth.js"></script>');
    cpSync(new URL('../music-synth.js', import.meta.url), path('music-synth.js'));
    for (const file of ['music.json', 'music.release.json']) cpSync(new URL('../assets/' + file, import.meta.url), path('assets/' + file));
    cpSync(new URL('../data/missions.json', import.meta.url), path('data/missions.json'));
    cpSync(new URL('../data/season.json', import.meta.url), path('data/season.json'));
    const localCatalog = structuredClone(local);
    localCatalog.menu.push({ file: 'archived.mp3', title: 'Archived' });
    writeFileSync(path('assets/music.json'), JSON.stringify(localCatalog));
    writeFileSync(path('assets/music/Rest Area.ogg'), 'test fixture');
    writeFileSync(path('assets/music/unlisted.ogg'), 'test fixture');
    writeFileSync(path('assets/music/archived.mp3'), 'test fixture');

    execFileSync(process.execPath, [build, '--local-music'], { cwd: fixture });
    expect(packagedCatalog().menu.filter(track => track.file)).toEqual([local.menu[0]]);
    expect(existsSync(path('dist-web/assets/music/Rest Area.ogg'))).toBe(true);
    expect(existsSync(path('dist-web/assets/music/unlisted.ogg'))).toBe(false);
    expect(existsSync(path('dist-web/assets/music/archived.mp3'))).toBe(false);

    execFileSync(process.execPath, [build], { cwd: fixture });
    expect(packagedCatalog()).toEqual(original);
    expect(existsSync(path('dist-web/assets/music'))).toBe(false);
    expect(existsSync(path('dist-web/music-synth.js'))).toBe(true);
    expect(readFileSync(path('dist-web/data/missions.json'), 'utf8')).toBe(readFileSync(path('data/missions.json'), 'utf8'));
    expect(existsSync(path('dist-web/assets/skins/catalog.js'))).toBe(true);
    expect(existsSync(path('dist-web/assets/skins/golden-dragon.png'))).toBe(true);
    expect(existsSync(path('dist-web/assets/ui/41-season-pass-banner.webp'))).toBe(true);
    expect(existsSync(path('dist-web/assets/ui/41-season-pass-skin.svg'))).toBe(true);
    expect(readFileSync(path('dist-web/data/season.json'), 'utf8')).toBe(readFileSync(path('data/season.json'), 'utf8'));
    expect(existsSync(path('dist-web/assets/ui/crates/mythic.png'))).toBe(true);
    expect(existsSync(path('dist-web/assets/ui/crates/mythic-rainbow.png'))).toBe(false);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
}, 15000);
