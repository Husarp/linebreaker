import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const window = {};
runInNewContext(readFileSync(new URL('../121-mission-art.js', import.meta.url), 'utf8'), { window });
const { forMetric } = window.LBMissionArt;
const art = name => `assets/ui/achievements/ach-${name}.webp`;

it('maps all catalog objectives to shipped voxel art and conceals secret objectives', () => {
  const catalog = JSON.parse(readFileSync(new URL('../data/missions.json', import.meta.url), 'utf8'));
  const metrics = new Set([...Object.values(catalog).filter(Array.isArray).flat().map(mission => mission.metric), 'funRuns', 'ghostLines', 'mirrorLines']);
  for (const metric of metrics) {
    expect(existsSync(new URL(`../${forMetric(metric)}`, import.meta.url)), metric).toBe(true);
    expect(forMetric(metric, true)).toBe(art('list'));
  }
  expect([...metrics].filter(metric => forMetric(metric) === art('stack')).sort())
    .toEqual(['blocksPlaced', 'bottomQuarter', 'bottomTwoRows', 'flatEarth', 'iFloor', 'monochrome']);
  expect(forMetric('unknown')).toBe(art('stack'));
});

it('uses concept-specific icons for primary objectives', () => {
  for (const [metric, icon] of Object.entries({ score: 'score', linesCleared: 'lines', quads: 'quads', maxCombo: 'chain',
    tSpins: 'spin', hardDrops: 'harddrop', gameTime: 'survive', speedRun: 'clock', maxSpeed: 'lightning',
    rawXP: 'spark', ghostLines: 'shield', gamesPlayed: 'games', niceBonus: 'list' })) {
    expect(forMetric(metric)).toBe(art(icon));
  }
});
