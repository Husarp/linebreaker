import { afterEach, expect, it, vi } from 'vitest';
import { loadGame } from './loader.js';
let game;
afterEach(() => game?.close());
it('loads native saves without a file setup overlay and serializes pending writes', async () => {
  let release;
  const calls = [];
  const invoke = vi.fn(async (command, payload) => {
    if (command === 'load_save') return JSON.stringify({ totalXP: 123, highscore: 7 });
    calls.push(JSON.parse(payload.json));
    if (calls.length === 1) await new Promise(resolve => { release = resolve; });
  });
  game = await loadGame(true, invoke);
  expect(game.api.save.totalXP).toBe(123);
  expect(game.w.document.getElementById('file-setup-overlay').classList.contains('hidden')).toBe(true);
  calls.length = 0;
  const first = game.api.writeSaveFile({ totalXP: 1 });
  game.api.writeSaveFile({ totalXP: 2 });
  game.api.writeSaveFile({ totalXP: 3 });
  expect(calls).toEqual([{ totalXP: 1 }]);
  release();
  await first;
  expect(calls).toEqual([{ totalXP: 1 }, { totalXP: 3 }]);
});
it('does not overwrite native saves after a failed boot read', async () => {
  const invoke = vi.fn(async command => {
    if (command === 'load_save') throw Error('Unreadable save');
  });
  game = await loadGame(true, invoke);
  await game.api.writeSaveFile({ totalXP: 0 });
  expect(invoke.mock.calls.every(([command]) => command === 'load_save')).toBe(true);
  expect(game.w.document.getElementById('file-setup-overlay').classList.contains('hidden')).toBe(true);
});
