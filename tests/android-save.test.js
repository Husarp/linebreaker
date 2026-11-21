import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { loadGame } from './loader.js';
let game;
afterEach(() => game?.close());
const watchdog = readFileSync(new URL('../boot.js', import.meta.url), 'utf8');
const mockAndroid = filesystem => ({ isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { Filesystem: filesystem } });
const settle = () => new Promise(resolve => setImmediate(resolve));
it('boots Android from Filesystem without a picker and writes through the shared queue', async () => {
 const files = new Map([['save.json', '{"totalXP":123,"highscore":7}']]);
 const filesystem = {
  readFile: vi.fn(async ({ path }) => { if (!files.has(path)) throw Error('File not found'); return { data: files.get(path) }; }),
  writeFile: vi.fn(async ({ path, data }) => files.set(path, data)),
  rename: vi.fn(async ({ from, to }) => { files.set(to, files.get(from)); files.delete(from); })
 };
 game = await loadGame(true, null, { isNativePlatform: () => true, Plugins: { Filesystem: filesystem, App: { async addListener() {} } } });
 expect(game.api.save.totalXP).toBe(123);
 expect(game.w.document.getElementById('file-setup-overlay').classList.contains('hidden')).toBe(true);
 await game.api.writeSaveFile({ totalXP: 456 });
 expect(JSON.parse(files.get('save.json')).totalXP).toBe(456);
});
it('blocks Android writes after failed native load', async () => {
 const fs = { readFile: vi.fn().mockRejectedValue(Error('Permission denied')), writeFile: vi.fn() };
 game = await loadGame(true, null, { isNativePlatform: () => true, Plugins: { Filesystem: fs, App: { async addListener() {} } } });
 await game.api.writeSaveFile({ totalXP: 0 });
 expect(fs.writeFile).not.toHaveBeenCalled();
});

it('falls back to built-in missions when an older WebView never resolves the request', async () => {
 const filesystem = { readFile: vi.fn().mockRejectedValue(Error("'readFile' failed because file does not exist.")) };
 let signal;
 game = await loadGame(true, null, mockAndroid(filesystem), (url, options) => {
  if (url !== 'data/missions.json') return Promise.resolve({ ok: false });
  signal = options.signal;
  return new Promise(() => {});
 }, null, window => { window.AbortSignal.timeout = undefined; window.eval(watchdog); });
 expect(filesystem.readFile).not.toHaveBeenCalled();
 game.advance(3000);
 await settle();
 expect(signal.aborted).toBe(true);
 expect(filesystem.readFile).toHaveBeenCalledTimes(2);
 expect(game.w.linebreakerReadyForUpdates).toBe(true);
 expect(game.w.document.querySelector('#loading-screen').dataset.dismissed).toBe('1');
});

it('offers read-only recovery after eight seconds and ignores late native reads', async () => {
 let finishRead;
 const filesystem = { readFile: vi.fn(() => new Promise(resolve => { finishRead = resolve; })), writeFile: vi.fn() };
 game = await loadGame(true, null, mockAndroid(filesystem), undefined, null, window => window.eval(watchdog));
 game.advance(8000);
 const button = game.w.document.getElementById('ls-continue');
 expect(button.hidden).toBe(false);
 expect(game.w.document.getElementById('ls-status').textContent).toContain('Reading native save');
 button.click();
 finishRead({ data: '{"schemaVersion":1,"totalXP":123}' });
 await settle();
 expect(game.api.save.totalXP).toBe(0);
 await game.api.writeSaveFile({ totalXP: 456 });
 expect(filesystem.writeFile).not.toHaveBeenCalled();
 expect(game.w.linebreakerReadyForUpdates).toBeUndefined();
 expect(game.w.document.querySelector('#loading-screen').dataset.dismissed).toBe('1');
});

it('replaces the spinner with a restart action when boot code throws', async () => {
 game = await loadGame(true, null, mockAndroid({ readFile: () => new Promise(() => {}) }), undefined, null, window => window.eval(watchdog));
 game.w.dispatchEvent(new game.w.ErrorEvent('error', { error: Error('Broken app script') }));
 expect(game.w.document.getElementById('ls-status').textContent).toContain('Startup failed');
 expect(game.w.document.getElementById('ls-actions').hidden).toBe(false);
 expect(game.w.document.getElementById('ls-continue').hidden).toBe(true);
});
