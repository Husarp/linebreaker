import {afterEach, beforeEach, expect, it} from 'vitest';
import {loadGame} from './loader.js';

let game;
beforeEach(async () => { game = await loadGame(); });
afterEach(() => game?.close());

function badgeText() {
  return ['badge-rank-name', 'badge-level-num'].map(id => game.w.document.getElementById(id).textContent);
}

it('renders a fresh save with no chosen file as Bronze level 1', () => {
  expect(game.api.save.totalXP).toBe(0);
  game.api.drawRankBadge();
  expect(game.api.getLevelInfo(game.api.save.totalXP)).toMatchObject({level: 1, isCelestite: false, rank: {name: 'BRONZE'}});
  expect(badgeText()).toEqual(['BRONZE', '1']);
  expect(game.w.document.getElementById('menu-xp-bar-fill').style.width).toBe('0%');
});

it('paints ten Gold badge shapes even when the menu first renders in a background tab', () => {
  Object.defineProperty(game.w.document, 'hidden', {configurable: true, value: true});
  game.api.setSave({...game.api.save, totalXP: 64000});
  const firstCall = game.calls.length;
  game.api.drawRankBadge();

  expect(badgeText()).toEqual(['GOLD', 'IX']);
  const blits = game.calls.slice(firstCall).filter(([method]) => method === 'drawImage');
  const emptyBadge = blits[0][1];
  const shapeOrigins = blits.filter(([, sprite]) => sprite === emptyBadge).map(([, , x, y]) => `${x},${y}`);
  expect(new Set(shapeOrigins).size).toBe(10);
});

it('draws the cached Halo glow and thin inner line on filled Gold badges', () => {
  const canvasPrototype = game.w.HTMLCanvasElement.prototype;
  const getContext = canvasPrototype.getContext;
  const spriteStrokes = new Map();
  canvasPrototype.getContext = function (...args) {
    const ctx = getContext.apply(this, args);
    const strokes = [];
    spriteStrokes.set(this, strokes);
    ctx.stroke = () => strokes.push({width: ctx.lineWidth, blur: ctx.shadowBlur, color: ctx.strokeStyle});
    return ctx;
  };
  game.api.setSave({...game.api.save, totalXP: 37000});
  const firstCall = game.calls.length;
  game.api.drawRankBadge();

  const blits = game.calls.slice(firstCall).filter(([method]) => method === 'drawImage');
  const emptyBadge = blits[0][1];
  const filledBadge = blits[1][1];
  expect(spriteStrokes.get(emptyBadge)).toEqual([{width: 1.35, blur: expect.any(Function), color: 'rgb(148,125,0)'}]);
  expect(spriteStrokes.get(filledBadge)).toEqual([
    {width: 4.2, blur: 8, color: '#ffd700'},
    {width: .9, blur: 0, color: 'rgb(255,243,176)'},
    {width: .8, blur: 0, color: '#ffd700'},
  ]);
  game.api.drawRankBadge();
  expect(spriteStrokes.size).toBe(2);
});

it.each([
  [37000, 23, 'GOLD', 'II'],
  [473500, 72, 'DIAMOND', 'I'],
  [640000, 81, 'CELESTITE', 'LXXXI'],
])('renders XP %s and refreshes cached rank data after menu visibility changes', async (xp, level, rank, label) => {
  const menu = game.w.document.getElementById('menu-overlay');
  menu.classList.add('hidden');
  await Promise.resolve();
  game.api.setSave({...game.api.save, totalXP: xp});
  menu.classList.remove('hidden');
  await Promise.resolve();
  game.advance(16);
  expect(game.api.getLevelInfo(xp)).toMatchObject({level, rank: {name: rank}});
  expect(badgeText()).toEqual([rank, label]);
  game.api.setSave({...game.api.save, totalXP: 0});
  game.api.drawRankBadge();
  expect(badgeText()).toEqual(['BRONZE', '1']);
});

it.each([undefined, NaN, Infinity])('treats invalid XP %s as a fresh badge instead of Celestite', xp => {
  game.api.setSave({...game.api.save, totalXP: xp});
  game.api.drawRankBadge();
  expect(badgeText()).toEqual(['BRONZE', '1']);
  expect(game.api.getLevelInfo(xp)).toMatchObject({level: 1, percent: 0, isCelestite: false});
});
