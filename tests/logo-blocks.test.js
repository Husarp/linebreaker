import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';
import { playLogoClear } from '../logo-anim.js';
import { renderBlocksLogo, renderStoreLogo } from '../tools/logo/blocks-logo.js';

const asset = name => readFileSync(new URL(`../assets/ui/${name}`, import.meta.url));
const readSource = path => readFileSync(new URL(`../${path}`, import.meta.url));
const positions = element => element.getAttribute('transform').match(/\d+/g).map(Number);
const bounds = rect => ['x', 'y', 'width', 'height'].map(key => Number(rect.getAttribute(key)));

it('ships reproducible vectors and a transparent 4K raster', () => {
  expect(asset('logo-blocks.svg').toString()).toBe(renderBlocksLogo());
  expect(asset('logo-store.svg').toString()).toBe(renderStoreLogo());
  const png = asset('logo-blocks@4k.png');
  expect(png.toString('ascii', 12, 16)).toBe('IHDR');
  const [, width, height] = renderBlocksLogo().match(/viewBox="0 0 (\d+) (\d+)"/).map(Number);
  expect([png.readUInt32BE(16), png.readUInt32BE(20), png[25]]).toEqual([3840, Math.round(3840 * height / width), 6]);
});

it('maps every native Press Start 2P pixel to a full block with one column between glyphs', () => {
  const { window } = new JSDOM(renderBlocksLogo());
  try {
    const { document } = window;
    const { fontSha256, grid, glyphs } = JSON.parse(readSource('tools/logo/press-start-2p.json'));
    expect(createHash('sha256').update(readSource('assets/fonts/PressStart2P-Regular.ttf')).digest('hex')).toBe(fontSha256);
    expect(grid).toBe(8);
    const size = Number(document.querySelector('svg').dataset.logoBlock);
    const actual = new Map();
    for (const cell of document.querySelectorAll('[data-logo-cell]')) {
      const [, row] = cell.dataset.logoCell.split(':').map(Number);
      expect(bounds(cell.querySelector('rect'))).toEqual([0, 0, size, size]);
      expect(actual.has(cell.dataset.logoCell)).toBe(false);
      actual.set(cell.dataset.logoCell, positions(cell));
      const layer = row < 3 ? 'top' : row === 3 ? 'restored' : 'base';
      expect(cell.parentElement.hasAttribute(`data-logo-${layer}`)).toBe(true);
    }
    const expected = new Map();
    let start = 2 * size;
    for (const [index, letter] of [...'LINEBREAKER'].entries()) {
      const mask = glyphs[letter];
      expect(mask).toHaveLength(grid);
      expect(mask.every(line => line.length === grid && /^[#.]+$/.test(line))).toBe(true);
      const cells = mask.flatMap((line, row) => [...line].flatMap((mark, column) => mark === '#' ? [[row, column]] : []));
      const columns = cells.map(([, column]) => column);
      const first = Math.min(...columns);
      for (const [row, column] of cells) expected.set(`${index}:${row}:${column}`, [start + (column - first) * size, (row + 1) * size]);
      start += (Math.max(...columns) - first + 2) * size;
    }
    expect(actual).toEqual(expected);
    expect(new Set([...actual.values()].map(point => point.join(','))).size).toBe(actual.size);
  } finally { window.close(); }
});

it('limits the lit split to one row and scatters sparse half- and quarter-block shards on the subgrid', () => {
  const { window } = new JSDOM(renderBlocksLogo());
  try {
    const { document } = window;
    const cracked = document.querySelector('[data-logo-cracked]');
    const restored = [...document.querySelector('[data-logo-restored]').children];
    const rowY = 128;
    const hotLetters = [...cracked.querySelectorAll('[data-logo-hot-letter]')];
    expect(hotLetters).toHaveLength('LINEBREAKER'.length);
    expect(cracked.querySelector('[data-logo-halo]').getAttribute('filter')).toBe('url(#logo-v3-halo)');
    expect(document.querySelector('#logo-v3-halo feGaussianBlur')).not.toBeNull();
    for (const letter of hotLetters) {
      const index = letter.dataset.logoHotLetter;
      const [start, top] = positions(letter);
      expect(top).toBe(rowY);
      const litTiles = [...letter.querySelectorAll('clipPath rect')].map(bounds);
      const expected = restored.filter(cell => cell.dataset.logoCell.startsWith(`${index}:`))
        .map(cell => [positions(cell)[0] - start, 0, 32, 32]);
      expect(litTiles).toEqual(expected);
      const core = letter.querySelector('[data-logo-core]');
      expect(core.getAttribute('stroke')).toBe('#fffdf5');
      expect(core.closest('[clip-path]').getAttribute('clip-path')).toBe(`url(#logo-v3-split-${index})`);
      expect(letter.querySelector(`#logo-v3-split-${index} path`).getAttribute('d')).toMatch(/^[MHVZ\d ]+$/);
    }
    const shards = [...document.querySelectorAll('[data-logo-burst] > [data-logo-shard]')];
    expect(shards.length).toBeLessThan(restored.length);
    const sizes = new Set();
    const directions = new Set();
    for (const shard of shards) {
      const [x, y, width, height] = bounds(shard.firstElementChild);
      const fromX = Number(shard.dataset.logoFromX);
      const fromY = Number(shard.dataset.logoFromY);
      expect([x % 8, y % 8, width - height, fromX % 8 || 0, fromY % 8 || 0]).toEqual([0, 0, 0, 0, 0]);
      expect(y + fromY).toBe(rowY + 8);
      expect(restored.some(cell => {
        const [left] = positions(cell);
        return x + fromX >= left && x + fromX + width <= left + 32;
      })).toBe(true);
      sizes.add(width);
      directions.add(Math.sign(fromY));
    }
    expect(sizes).toEqual(new Set([8, 16]));
    expect(directions).toEqual(new Set([-1, 1]));
    const clean = renderBlocksLogo({ effects: false });
    expect(clean).not.toMatch(/data-logo-(cracked|halo|burst)/);
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
    expect(top.frames.map(frame => frame.transform)).toContain('translateY(32px)');
    expect(top.frames.at(-1).transform).toBe('translateY(0px)');
    expect(cracked.frames.find(frame => frame.opacity === 1).offset).toBeLessThan(burst.frames.find(frame => frame.opacity === 1).offset);
    expect(burst.frames).toContainEqual({ offset: .61, opacity: 0 });
    expect(burst.frames.at(-1).opacity).toBe(1);
    expect(restored.frames.find(frame => frame.opacity === 1 && frame.offset > .5).offset).toBeGreaterThan(.61);
    expect(restored.frames.at(-1).opacity).toBe(0);
    const shards = effects.filter(effect => effect.target.hasAttribute('data-logo-shard'));
    expect(shards).toHaveLength(svg.querySelectorAll('[data-logo-shard]').length);
    for (const { target, frames } of shards) {
      expect(frames[0].transform).toBe(`translate(${target.dataset.logoFromX}px, ${target.dataset.logoFromY}px)`);
      expect(frames.at(-1).transform).toBe('translate(0px, 0px)');
    }
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
