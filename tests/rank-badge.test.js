import {afterEach, beforeEach, expect, it} from 'vitest';
import {loadGame} from './loader.js';

let game;
beforeEach(async () => { game = await loadGame(); });
afterEach(() => game?.close());

function badgeText() {
  return ['badge-rank-name', 'badge-level-num'].map(id => game.w.document.getElementById(id).textContent);
}

function readBadgeCut(xp) {
  game.api.setSave({...game.api.save, totalXP: xp});
  const firstCall = game.calls.length;
  game.api.drawRankBadge();
  const calls = game.calls.slice(firstCall);
  return {cut: calls.find(([method]) => method === 'rect')?.[2], rotation: calls.find(([method]) => method === 'rotate')?.[1], calls};
}

function sampledFill(cut, minY, maxY, widthAt) {
  let total = 0, filled = 0;
  const count = 4000;
  for (let index = 0; index < count; index++) {
    const y = minY + (index + .5) * (maxY - minY) / count;
    const width = widthAt(y);
    total += width;
    if (y >= cut) filled += width;
  }
  return filled / total;
}

function orbitalArea(cut, rotation, shape) {
  if (!shape.sides) {
    return sampledFill(cut, -24, 24, y => 2 * Math.sqrt(24 ** 2 - y ** 2));
  }
  const vertexCount = shape.sides * (shape.star ? 2 : 1);
  const vertices = Array.from({length: vertexCount}, (_, index) => {
    const angle = index / vertexCount * 2 * Math.PI - Math.PI / 2 - rotation;
    const radius = 24 * (shape.star && index % 2 ? shape.innerRatio : 1);
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  });
  const ys = vertices.map(vertex => vertex[1]);
  return sampledFill(cut, Math.min(...ys), Math.max(...ys), y => {
    const crossings = [];
    vertices.forEach(([startX, startY], index) => {
      const [endX, endY] = vertices[(index + 1) % vertexCount];
      if ((startY > y) !== (endY > y)) crossings.push(startX + (y - startY) * (endX - startX) / (endY - startY));
    });
    crossings.sort((left, right) => left - right);
    return crossings.reduce((width, x, index) => width + (index % 2 ? x : -x), 0);
  });
}

it('renders a fresh save with no chosen file as Bronze level 1', () => {
  expect(game.api.save.totalXP).toBe(0);
  game.api.drawRankBadge();
  expect(game.api.getLevelInfo(game.api.save.totalXP)).toMatchObject({level: 1, isCelestite: false, rank: {name: 'BRONZE'}});
  expect(badgeText()).toEqual(['Bronze', 'Level 1']);
  expect(game.w.document.getElementById('menu-xp-bar-fill').style.width).toBe('0%');
});

it('paints one centered Gold badge shape even when the menu first renders in a background tab', () => {
  Object.defineProperty(game.w.document, 'hidden', {configurable: true, value: true});
  game.api.setSave({...game.api.save, totalXP: 64000});
  const firstCall = game.calls.length;
  game.api.drawRankBadge();

  expect(badgeText()).toEqual(['Gold IX', 'Level 30']);
  const blits = game.calls.slice(firstCall).filter(([method]) => method === 'drawImage');
  const emptyBadge = blits[0][1];
  const shapeOrigins = blits.filter(([, sprite]) => sprite === emptyBadge).map(([, , x, y]) => `${x},${y}`);
  expect(shapeOrigins).toHaveLength(1);
  expect(game.calls.slice(firstCall)).toContainEqual(['translate', 150, 150]);
});

it('leaves the main-menu rank shape unlabeled by default at every fill level', () => {
  game.api.setSave({...game.api.save, totalXP: 64000});
  const labelsAt = fill => {
    const firstCall = game.calls.length;
    game.api.drawRankBadge(fill);
    return game.calls.slice(firstCall).filter(([method]) => method === 'fillText').map(([, text]) => text);
  };
  expect(labelsAt(0)).toEqual([]);
  expect(labelsAt(0.999)).toEqual([]);
  expect(labelsAt(1)).toEqual([]);
});

it('formats optional badge labels as the rank division or the absolute level', () => {
  const gold = game.api.getLevelInfo(64000);
  expect(game.api.badgeLevelLabel(gold)).toBe('');
  expect(game.api.badgeLevelLabel(gold, 'roman')).toBe('IX');
  expect(game.api.badgeLevelLabel(gold, 'number')).toBe('30');
  expect(game.api.badgeLevelLabel(game.api.getLevelInfo(640000), 'roman')).toBe('');
});

it('draws the cached Halo glow and thin inner line on filled Gold badges', () => {
  const canvasPrototype = game.w.HTMLCanvasElement.prototype;
  const getContext = canvasPrototype.getContext;
  const spriteStrokes = new Map();
  canvasPrototype.getContext = function (...args) {
    const ctx = getContext.apply(this, args);
    const strokes = [];
    let start;
    spriteStrokes.set(this, strokes);
    ctx.moveTo = (x, y) => { start = [x, y]; };
    ctx.stroke = () => strokes.push({width: ctx.lineWidth, blur: ctx.shadowBlur, color: ctx.strokeStyle, start});
    return ctx;
  };
  game.api.setSave({...game.api.save, totalXP: 37500});
  const firstCall = game.calls.length;
  game.api.drawRankBadge();

  const blits = game.calls.slice(firstCall).filter(([method]) => method === 'drawImage');
  const emptyBadge = blits[0][1];
  const filledBadge = blits[1][1];
  const emptyStrokes = spriteStrokes.get(emptyBadge);
  const filledStrokes = spriteStrokes.get(filledBadge);
  expect(emptyStrokes[0].start).toEqual(filledStrokes[0].start);
  expect(emptyStrokes[1].start).toEqual(filledStrokes[2].start);
  const styles = strokes => strokes.map(({width, blur, color}) => ({width, blur: typeof blur === 'number' ? blur : 0, color}));
  expect(styles(emptyStrokes)).toEqual([
    {width: 1.4, blur: 5, color: '#ffd700'},
    {width: .8, blur: 0, color: 'rgb(128,108,0)'},
  ]);
  expect(styles(filledStrokes)).toEqual([
    {width: 4.2, blur: 0, color: '#ffd700'},
    {width: .9, blur: 0, color: 'rgb(255,243,176)'},
    {width: .8, blur: 0, color: '#ffd700'},
  ]);
  game.api.drawRankBadge();
  expect(spriteStrokes.size).toBe(2);
});

it('fills 63.6% of the active diamond at Silver level 14 with 1272 / 2000 XP', () => {
  const {cut, rotation} = readBadgeCut(17272);
  expect(badgeText()).toEqual(['Silver III', 'Level 14']);
  expect(game.api.getLevelInfo(17272)).toMatchObject({currentXP: 1272, neededXP: 2000, percent: .636});
  expect(orbitalArea(cut, rotation, {sides: 4})).toBeCloseTo(.636, 3);
});

it.each([0, 10000, 30000, 65000, 120000, 200000, 310000, 455000])('keeps rank at base XP %i area-proportional', base => {
  const {rank, neededXP} = game.api.getLevelInfo(base);
  for (const slot of [0, 2, 5, 9]) {
    for (const fraction of [.005, .031, .17, .23, .5, .636, .88, .971, .995]) {
      const {cut, rotation} = readBadgeCut(base + neededXP * (slot + fraction));
      expect(Math.abs(orbitalArea(cut, rotation, rank.shape) - fraction)).toBeLessThan(.001);
    }
  }
});

it('keeps the curved Celestite shield area-proportional', () => {
  const base = 640000;
  const {neededXP} = game.api.getLevelInfo(base);
  for (const fraction of [.03, .17, .5, .636, .88, .97]) {
    const {calls} = readBadgeCut(base + neededXP * fraction);
    const [, , cut] = calls.find(([method, x, , width]) => method === 'fillRect' && x === 0 && width === 300);
    const area = sampledFill(cut, 30, 275, y => {
      if (y < 75) return 200 * (y - 30) / 45;
      if (y < 170) return 200;
      const t = (156 - Math.sqrt(156 ** 2 - 204 * (y - 170))) / 102;
      return 200 * (1 - t ** 2);
    });
    expect(area).toBeCloseTo(fraction, 3);
  }
});

it('keeps the rank and XP display visible without opening an info box on tap or hover', () => {
  readBadgeCut(17272);
  const { document, Event } = game.w;
  const card = document.getElementById('btn-player-rank');
  const xp = document.getElementById('menu-xp-bar-wrap');
  const badge = badgeText();
  xp.dispatchEvent(new Event('pointerenter'));
  xp.querySelector('#menu-xp-bar-fill').click();
  xp.querySelector('#badge-level-num').click();
  xp.querySelector('#menu-xp-detail').click();
  card.click();
  const interactive = 'button, [tabindex], [title], [aria-describedby], [role="tooltip"], [data-help-section]';
  expect(card.matches(interactive)).toBe(false);
  expect(card.querySelector(interactive)).toBeNull();
  expect(document.querySelector('[role="tooltip"]:not([hidden])')).toBeNull();
  expect(badgeText()).toEqual(badge);
});

it.each([
  [37000, 23, 'GOLD', 'Gold II'],
  [473500, 72, 'DIAMOND', 'Diamond I'],
  [640000, 81, 'CELESTITE', 'Celestite'],
])('renders XP %s and refreshes cached rank data after menu visibility changes', async (xp, level, rank, label) => {
  const menu = game.w.document.getElementById('menu-overlay');
  menu.classList.add('hidden');
  await Promise.resolve();
  game.api.setSave({...game.api.save, totalXP: xp});
  menu.classList.remove('hidden');
  await Promise.resolve();
  game.advance(16);
  expect(game.api.getLevelInfo(xp)).toMatchObject({level, rank: {name: rank}});
  expect(badgeText()).toEqual([label, `Level ${level}`]);
  game.api.setSave({...game.api.save, totalXP: 0});
  game.api.drawRankBadge();
  expect(badgeText()).toEqual(['Bronze', 'Level 1']);
});

it.each([undefined, NaN, Infinity])('treats invalid XP %s as a fresh badge instead of Celestite', xp => {
  game.api.setSave({...game.api.save, totalXP: xp});
  game.api.drawRankBadge();
  expect(badgeText()).toEqual(['Bronze', 'Level 1']);
  expect(game.api.getLevelInfo(xp)).toMatchObject({level: 1, percent: 0, isCelestite: false});
});
