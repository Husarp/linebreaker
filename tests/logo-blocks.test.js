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
  const [, width, height] = renderBlocksLogo().match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  expect([png.readUInt32BE(16), png.readUInt32BE(20), png[25]]).toEqual([3840, Math.round(3840 * height / width), 6]);
});

it('packs five rows of full squares into edge-connected glyphs with optical gutters', () => {
  const { window } = new JSDOM(renderBlocksLogo());
  try {
    const { document } = window;
    const size = 32;
    const keys = new Set();
    const rows = new Set();
    const glyphs = new Map();
    for (const cell of document.querySelectorAll('[data-logo-cell]')) {
      const [index, row, column] = cell.dataset.logoCell.split(':').map(Number);
      const [x, y] = cell.getAttribute('transform').match(/\d+/g).map(Number);
      const rect = cell.querySelector('rect');
      expect([x % 8, y - row * size]).toEqual([0, 40]);
      expect([rect.getAttribute('width'), rect.getAttribute('height')]).toEqual(['32', '32']);
      const key = `${x},${y}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
      rows.add(y);
      expect(row === 2).toBe(cell.parentElement.hasAttribute('data-logo-restored'));
      if (!glyphs.has(index)) glyphs.set(index, { start: x - column * size, cells: [] });
      const glyph = glyphs.get(index);
      expect(x).toBe(glyph.start + column * size);
      glyph.cells.push([row, column]);
    }
    expect([...rows].sort((left, right) => left - right)).toEqual([40, 72, 104, 136, 168]);
    expect(glyphs.size).toBe('LINEBREAKER'.length);
    for (const [index, { start, cells }] of glyphs) {
      const next = glyphs.get(index + 1);
      const width = (1 + Math.max(...cells.map(([, column]) => column))) * size;
      if (next) expect(next.start - start - width).toBe(index < 2 ? 8 : 16);
      const remaining = new Set(cells.map(cell => cell.join(',')));
      const frontier = [cells[0]];
      while (frontier.length) {
        const [row, column] = frontier.pop();
        if (!remaining.delete(`${row},${column}`)) continue;
        frontier.push([row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]);
      }
      expect(remaining.size).toBe(0);
    }
  } finally { window.close(); }
});

it('clips damage to the cracked row and keeps quarter-block shards on the common subgrid', () => {
  const { window } = new JSDOM(renderBlocksLogo());
  try {
    const { document } = window;
    const cracked = document.querySelector('[data-logo-cracked]');
    const restored = document.querySelector('[data-logo-restored]');
    expect(cracked.querySelectorAll('[data-logo-fissure]')).toHaveLength(restored.children.length);
    expect(new Set([...cracked.querySelectorAll('.logo-crack-core')].map(path => path.getAttribute('d'))).size).toBe(5);
    const clipped = [...cracked.querySelectorAll('[clip-path]')];
    expect(clipped.length).toBeGreaterThan(0);
    expect(clipped.length).toBeLessThan(restored.children.length);
    for (const cell of clipped) {
      const id = cell.getAttribute('clip-path').slice(5, -1);
      expect(document.getElementById(id).localName).toBe('clipPath');
      expect(cell.parentElement.getAttribute('transform')).toMatch(/^translate\(\d+ 104\)$/);
    }
    const burst = document.querySelector('[data-logo-burst]');
    expect(burst.getAttribute('opacity')).toBe('0');
    const shards = [...burst.querySelectorAll('[data-logo-shard] > rect')];
    const bounds = rect => ['x', 'y', 'width', 'height'].map(key => Number(rect.getAttribute(key)));
    expect(shards).toHaveLength(restored.children.length * 2);
    for (const [x, y, width, height] of shards.map(bounds)) {
      expect([x % 8, y % 8, width, height]).toEqual([0, 0, 8, 8]);
      expect(y >= 104 && y + height <= 136).toBe(true);
    }
    const gutter = [...cracked.querySelectorAll('[data-logo-gutter] > rect')];
    expect(gutter.length).toBeGreaterThan(0);
    expect(gutter.length).toBeLessThan(restored.children.length);
    for (const [x, y, width, height] of gutter.map(bounds)) {
      expect([x % 4, y % 4, width - height]).toEqual([0, 0, 0]);
      expect([4, 8]).toContain(width);
    }
    const clean = renderBlocksLogo({ effects: false });
    expect(clean).not.toMatch(/data-logo-(cracked|gutter|burst)/);
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

it('reveals the crack, flies the shards, drops the top one block and restores the row', async () => {
  const { window, svg, effects } = animationFixture();
  try {
    const done = playLogoClear(svg);
    const top = effects.find(effect => effect.target.hasAttribute('data-logo-top'));
    const cracked = effects.find(effect => effect.target.hasAttribute('data-logo-cracked'));
    const burst = effects.find(effect => effect.target.hasAttribute('data-logo-burst'));
    const restored = effects.find(effect => effect.target.hasAttribute('data-logo-restored'));
    const shard = effects.find(effect => effect.target.hasAttribute('data-logo-shard'));
    expect(top.frames.map(frame => frame.transform)).toContain('translateY(32px)');
    expect(top.frames.at(-1).transform).toBe('translateY(0px)');
    expect(cracked.frames.find(frame => frame.opacity === 1).offset).toBeLessThan(burst.frames.find(frame => frame.opacity === 1).offset);
    expect(burst.frames.at(-1).opacity).toBe(0);
    expect(restored.frames.find(frame => frame.opacity === 1 && frame.offset > .5).offset).toBeGreaterThan(.61);
    expect(restored.frames.at(-1).opacity).toBe(0);
    expect(shard.frames.at(-1).transform).not.toBe(shard.frames[0].transform);
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
