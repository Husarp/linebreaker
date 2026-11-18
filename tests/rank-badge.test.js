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
