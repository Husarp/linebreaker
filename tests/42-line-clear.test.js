import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import '../42-line-clear.js';
import '../41-season-pass.js';
import { loadGame } from './loader.js';

const { MAX_PARTICLES, normalizeMode, resolve, description, rowFrame, createParticles, particleFrame, create } = globalThis.LBLineClear;
const skinNames = {
  'carved-stone': 'Stone Crumble',
  'golden-dragon': 'Gold Leaf',
  'obsidian-carved': 'Obsidian Shards',
  'aztec-gold': 'Stepped Gold Dust',
  'aztec': 'Temple Steps',
  'brushed-metal': 'Grinder Sparks',
  'gem-gloss': 'Facet Scatter',
  'jelly-candy': 'Candy Splat',
  'lava-glass': 'Molten Fracture',
  'neon-pixel': 'Neon Flicker',
  'pixel-16bit': 'Pixel Dissolve',
  'porcelain': 'Glaze Crack',
  'soft-clay': 'Clay Squash',
  'bubble': 'Bubble Pop',
  'season-prism': 'Prism Split',
};
const newShapes = {
  aztec: 'step', 'brushed-metal': 'spark', 'gem-gloss': 'facet', 'jelly-candy': 'drop', 'lava-glass': 'shard',
  'neon-pixel': 'dash', 'pixel-16bit': 'square', porcelain: 'shard', 'soft-clay': 'crumb', bubble: 'ring', 'season-prism': 'prism',
};
const manifest = JSON.parse(readFileSync(new URL('../assets/skins/skins.json', import.meta.url), 'utf8'));
const seasonSkin = globalThis.LBSeason.exclusiveSkin.key;
const board = Array.from({ length: 22 }, () => Array(10).fill(1));
const colors = [null, '#44ccff'];
const burst = (effect, rows = [21], duration = 150) => createParticles(effect, rows, board, colors, duration, () => .5);
let game;
afterEach(() => game?.close());

it('uses one subtle fallback and only selects registered effects in Skin mode', () => {
  expect(Object.keys(skinNames).sort()).toEqual([...manifest.map(skin => skin.key), seasonSkin, 'bubble'].sort());
  expect(new Set(Object.values(skinNames)).size).toBe(Object.keys(skinNames).length);
  for (const [skin, name] of Object.entries(skinNames)) {
    expect(resolve(skin)).toBe('subtle');
    expect(resolve(skin, 'default')).toBe('subtle');
    expect(resolve(skin, 'skin')).toBe(skin);
    expect(description(skin)).toBe(`Own line-clear effect: ${name}`);
  }
  for (const skin of ['retro', 'glass', 'constructor', '__proto__']) {
    expect(resolve(skin, 'skin')).toBe('subtle');
    expect(description(skin)).toBe('');
  }
  expect(normalizeMode('invalid')).toBe('default');
});

it.each(Object.entries(newShapes))('%s draws its material burst within the visual time budget', (skin, shape) => {
  for (const duration of [50, 150, 300]) {
    const particles = burst(skin, [21], duration);
    expect(particles[0].shape).toBe(shape);
    const end = Math.max(...particles.map(particle => particle.delay + particle.life));
    expect(end).toBeGreaterThanOrEqual(300);
    expect(end).toBeLessThanOrEqual(500);
  }

  const ctx = Object.fromEntries(['save', 'restore', 'beginPath', 'rect', 'clip', 'fillRect', 'moveTo', 'lineTo',
    'closePath', 'fill', 'stroke', 'translate', 'rotate', 'scale', 'ellipse', 'arc'].map(method => [method, vi.fn()]));
  const effect = create();
  effect.start({ skin, mode: 'skin', rows: [21], board, colors, duration: 150 });
  effect.advance(90);
  expect(effect.drawRow(ctx, 21, board[21], 30, vi.fn())).toBe(true);
  effect.finish();
  ctx.save.mockClear();
  effect.drawParticles(ctx, 30);
  expect(ctx.save).toHaveBeenCalled();
  effect.advance(500);
  ctx.save.mockClear();
  effect.drawParticles(ctx, 30);
  expect(ctx.save).not.toHaveBeenCalled();
});

it.each([50, 100, 150, 200, 300])('fades up and dissolves within the %ims row timing', duration => {
  const start = rowFrame(1, 0, duration);
  const peak = rowFrame(1, duration * .42, duration);
  const dissolve = rowFrame(1, duration * .75, duration);
  expect(start).toEqual({ blockAlpha: 1, tintAlpha: 0 });
  expect(peak.tintAlpha).toBeCloseTo(.62);
  expect(dissolve.tintAlpha).toBeLessThan(peak.tintAlpha);
  expect(dissolve.blockAlpha).toBeLessThan(peak.blockAlpha);
  expect(rowFrame(1, duration, duration)).toEqual({ blockAlpha: 0, tintAlpha: 0 });
});

it('only slightly strengthens the row tint and particle density for multiple clears', () => {
  const peaks = [1, 2, 3, 4].map(count => rowFrame(count, 63, 150).tintAlpha);
  expect(peaks).toEqual([...peaks].sort((left, right) => left - right));
  expect(peaks[3] - peaks[0]).toBeLessThan(.08);
  expect([1, 2, 3, 4].map(count => burst('subtle', [21, 19, 17, 16].slice(0, count)).length)).toEqual([5, 10, 18, 24]);
});

it('launches sparse upward squares that fade and expire on elapsed time', () => {
  const [particle] = burst('subtle');
  expect(particle.shape).toBe('square');
  const early = particleFrame(particle, particle.delay + 22);
  const late = particleFrame(particle, particle.delay + 130);
  expect(late.y).toBeLessThan(early.y);
  expect(late.alpha).toBeLessThan(early.alpha);
  expect(particleFrame(particle, particle.delay - 1)).toBeNull();
  expect(particleFrame(particle, particle.delay + particle.life)).toBeNull();
  expect(burst('subtle', [21], 0)).toEqual([]);
});

it('gives the four skins distinct materials, directions, and accents', () => {
  const stone = burst('carved-stone');
  expect(stone.map(particle => particle.shape)).toEqual(['shard', 'shard', 'shard', 'square', 'shard']);
  expect(particleFrame(stone[0], stone[0].delay + 100).y).toBeGreaterThan(stone[0].y);
  const dragon = burst('golden-dragon');
  expect(dragon.map(particle => particle.shape)).toEqual(['leaf', 'leaf', 'leaf', 'square', 'leaf']);
  expect(dragon[3].size).toBeLessThan(dragon[0].size);
  expect(burst('obsidian-carved').every(particle => particle.shape === 'shard' && particle.edge === colors[1])).toBe(true);
  const steps = burst('aztec-gold');
  expect(steps[1].y).toBeGreaterThan(steps[0].y);
  expect(steps[2].y).toBeGreaterThan(steps[1].y);
  expect(steps[3].y).toBe(steps[0].y);
  expect(steps[2].delay).toBeGreaterThan(steps[1].delay);
  expect(steps.every(particle => particle.vy > 0 && particle.vx === 0)).toBe(true);
});

it('caps overlapping bursts and skips animation for instant clears or reduced motion', () => {
  const motion = { matches: false };
  const effect = create(motion);
  const rows = [21, 20, 19, 18];
  const clear = { rows, board, colors, duration: 150 };
  const ctx = { save() {}, restore() {}, fillRect: vi.fn() };
  for (const attempt of [1, 2, 3]) effect.start(clear);
  effect.advance(100);
  effect.finish();
  effect.drawParticles(ctx, 30);
  expect(ctx.fillRect).toHaveBeenCalledTimes(MAX_PARTICLES);
  effect.advance(500);
  ctx.fillRect.mockClear();
  effect.drawParticles(ctx, 30);
  expect(ctx.fillRect).not.toHaveBeenCalled();

  effect.start({ ...clear, duration: 0 });
  expect(effect.drawRow(ctx, rows[0], board[rows[0]], 30, vi.fn())).toBe(false);
  motion.matches = true;
  effect.start(clear);
  effect.advance(100);
  effect.drawParticles(ctx, 30);
  expect(ctx.fillRect).not.toHaveBeenCalled();
});

it('draws only affected rows through the cached-block callback in logical coordinates', () => {
  const effect = create();
  const ctx = { save() {}, restore() {}, beginPath() {}, rect: vi.fn(), clip() {}, fillRect: vi.fn() };
  const drawBlock = vi.fn();
  effect.start({ rows: [21], board, colors, duration: 150 });
  effect.advance(63);
  expect(effect.drawRow(ctx, 20, board[20], 30, drawBlock)).toBe(false);
  expect(effect.drawRow(ctx, 21, board[21], 30, drawBlock)).toBe(true);
  expect(ctx.rect).toHaveBeenCalledWith(0, 630, 300, 30);
  expect(drawBlock).toHaveBeenCalledTimes(10);
  expect(drawBlock).toHaveBeenLastCalledWith(ctx, 9, 21, 1, 30);
  expect(ctx.fillRect).toHaveBeenCalledTimes(10);
  effect.finish();
  expect(effect.drawRow(ctx, 21, board[21], 30, drawBlock)).toBe(false);
});

it('persists the effect setting and describes custom effects on inventory cards', async () => {
  game = await loadGame();
  const { w: window } = game;
  const setting = window.document.getElementById('setting-line-clear-effect');
  window.openSettings();
  expect(setting.value).toBe('default');
  setting.value = 'skin';
  setting.dispatchEvent(new window.Event('change'));
  expect(JSON.parse(window.localStorage.getItem('linebreaker_settings')).lineClearEffect).toBe('skin');
  window.openSettings();
  expect(setting.value).toBe('skin');
  game.api.setup({ save: { ownedSkins: ['retro', seasonSkin] } });
  window.openInventory();
  for (const [skin, name] of Object.entries(skinNames)) {
    const detail = window.document.querySelector(`[data-item-key="${skin}"] .lb-inventory-detail`);
    expect(detail.textContent).toBe(`Own line-clear effect: ${name}`);
  }
  expect(window.document.querySelector('[data-item-key="retro"] .lb-inventory-detail')).toBeNull();
});

it.each([0, 50, 300])('keeps the %ims gameplay clear delay', async duration => {
  game = await loadGame(true, null, null, { lineClearMs: duration });
  const cells = Array.from({ length: 22 }, () => Array(10).fill(0));
  cells[21].fill(1);
  game.api.setup({ cells });
  expect(game.api.sweep()).toBe(true);
  if (duration > 0) {
    game.advance(duration - 1);
    expect(game.api.state.board[21]).toEqual(cells[21]);
  }
  game.advance(duration > 0 ? 1 : 0);
  expect(game.api.state.lines).toBe(1);
  expect(game.api.state.board[21]).toEqual(Array(10).fill(0));
});
