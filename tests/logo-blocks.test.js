import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';
import { playLogoClear } from '../logo-anim.js';
import { renderBlocksLogo, renderStoreLogo } from '../tools/logo/blocks-logo.js';

const asset = name => readFileSync(new URL(`../assets/ui/${name}`, import.meta.url));

it('ships reproducible vectors and a transparent 4K raster', () => {
  expect(asset('logo-blocks.svg').toString()).toBe(renderBlocksLogo());
  expect(asset('logo-store.svg').toString()).toBe(renderStoreLogo());
  const png = asset('logo-blocks@4k.png');
  expect(png.toString('ascii', 12, 16)).toBe('IHDR');
  expect([png.readUInt32BE(16), png.readUInt32BE(20), png[25]]).toEqual([3840, 704, 6]);
});

it('uses one non-overlapping seven-row grid and mirrors each pair of pixel shards', () => {
  const { window } = new JSDOM(renderBlocksLogo());
  try {
    const { document } = window;
    const size = 16;
    const keys = new Set();
    const rows = new Set();
    for (const cell of document.querySelectorAll('[data-logo-cell]')) {
      const [x, y] = cell.getAttribute('transform').match(/\d+/g).map(Number);
      const rect = cell.querySelector('rect');
      expect([x % size, y % size]).toEqual([0, 0]);
      expect([rect.getAttribute('width'), rect.getAttribute('height')]).toEqual(['16', '16']);
      const key = `${x},${y}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
      rows.add(y);
      expect(y === 80).toBe(cell.parentElement.hasAttribute('data-logo-restored'));
    }
    expect([...rows].sort((left, right) => left - right)).toEqual([32, 48, 64, 80, 96, 112, 128]);

    const shards = [...document.querySelectorAll('[data-logo-shard]')];
    expect(shards.length).toBeGreaterThan(0);
    const bounds = rect => ['x', 'y', 'width', 'height'].map(key => Number(rect.getAttribute(key)));
    for (const shard of shards) {
      const side = Number(shard.dataset.logoShard);
      const rects = [...shard.querySelectorAll('rect')].map(bounds);
      const cellFragment = rects.length > 2;
      expect(shard.parentElement.getAttribute('shape-rendering')).toBe('crispEdges');
      for (const [x, y, width, height] of rects) {
        const step = cellFragment ? size / 4 : size / 8;
        expect(width).toBe(height);
        expect([size / 4, size / 8]).toContain(width);
        expect([x % step, y % step]).toEqual([0, 0]);
        if (cellFragment) expect(y >= 80 && y + height <= 96).toBe(true);
      }
      const partner = side === -1 ? shard.nextElementSibling : shard.previousElementSibling;
      expect(Number(partner.dataset.logoShard)).toBe(-side);
      expect(partner.dataset.logoDrift).toBe(shard.dataset.logoDrift);
      const cellX = Math.floor(rects[0][0] / size) * size;
      const reflected = rects.map(([x, y, width, height]) =>
        [cellFragment ? 2 * cellX + size - x - width : x, 176 - y - height, width, height]);
      expect(reflected.sort()).toEqual([...partner.querySelectorAll('rect')].map(bounds).sort());
    }
  } finally { window.close(); }
});

it('cuts every store glyph at the center and uses four square cyan blocks for I', () => {
  const { window } = new JSDOM(renderStoreLogo());
  try {
    const { document } = window;
    const [, top, , height] = document.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
    const cutGroup = document.querySelector('[clip-path]');
    const path = document.querySelector('clipPath path').getAttribute('d');
    const [upper, lower] = path.match(/V\d+|M0 \d+/g).slice(1, 3).map(command =>
      Number(command.match(/\d+$/)[0]));
    expect(upper).toBeLessThan(lower);
    expect((upper + lower) / 2).toBe(top + height / 2);
    expect(cutGroup.children.length).toBe('LINEBREAKER'.length);
    const cyan = cutGroup.querySelector('[fill="#00d8ef"]');
    const squares = [...cyan.getAttribute('d').matchAll(/M0 (\d+)h(\d+)v(\d+)H0Z/g)];
    expect(squares.map(([, y, width, height]) => [Number(y), Number(width), Number(height)]))
      .toEqual([[0, 21, 21], [26, 21, 21], [53, 21, 21], [79, 21, 21]]);
  } finally { window.close(); }
});

function animationFixture(reduced = false) {
  const { window } = new JSDOM(renderBlocksLogo());
  window.matchMedia = vi.fn(() => ({ matches: reduced }));
  const effects = [];
  window.SVGElement.prototype.animate = function (frames, timing) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const effect = { target: this, frames, timing, finished: promise, resolve, cancel: vi.fn(reject) };
    effects.push(effect);
    return effect;
  };
  return { window, svg: window.document.querySelector('svg'), effects };
}

it('clears the middle row, drops the top by exactly one block, then resets', async () => {
  const { window, svg, effects } = animationFixture();
  try {
    const done = playLogoClear(svg);
    const top = effects.find(effect => effect.target.hasAttribute('data-logo-top'));
    const restored = effects.find(effect => effect.target.hasAttribute('data-logo-restored'));
    const shard = effects.find(effect => effect.target.hasAttribute('data-logo-shard'));
    expect(top.frames.map(frame => frame.transform)).toContain('translateY(16px)');
    expect(top.frames.at(-1).transform).toBe('translateY(0px)');
    expect(restored.frames.map(frame => frame.opacity)).toContain(1);
    expect(restored.frames.at(-1).opacity).toBe(0);
    expect(shard.frames.some(frame => frame.opacity === 0 && frame.transform !== shard.frames[0].transform)).toBe(true);
    for (const effect of effects) effect.resolve();
    await done;
    expect(effects.every(effect => effect.cancel.mock.calls.length === 1)).toBe(true);
  } finally { window.close(); }
});

it('cancels an in-flight clear before replaying it', async () => {
  const { window, svg, effects } = animationFixture();
  try {
    const first = playLogoClear(svg);
    const beforeReplay = effects.length;
    const second = playLogoClear(svg);
    await first;
    expect(effects).toHaveLength(beforeReplay * 2);
    expect(effects.slice(0, beforeReplay).every(effect => effect.cancel.mock.calls.length === 1)).toBe(true);
    expect(effects.slice(beforeReplay).every(effect => effect.cancel.mock.calls.length === 0)).toBe(true);
    for (const effect of effects.slice(beforeReplay)) effect.resolve();
    await second;
  } finally { window.close(); }
});

it('leaves the static mark intact with reduced motion', async () => {
  const { window, svg, effects } = animationFixture(true);
  try {
    await playLogoClear(svg);
    expect(effects).toHaveLength(0);
  } finally { window.close(); }
});
