import { afterEach, expect, it, vi } from 'vitest';
import { loadGame } from './loader.js';
let game;
afterEach(() => game?.close());
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
