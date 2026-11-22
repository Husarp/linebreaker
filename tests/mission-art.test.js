import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const window = {};
runInNewContext(readFileSync(new URL('../121-mission-art.js', import.meta.url), 'utf8'), { window });
const { icons, forMetric } = window.LBMissionArt;

it('assigns a patch to every daily, weekly, and mode mission without revealing secret objectives', () => {
  const { daily, weekly } = JSON.parse(readFileSync(new URL('../data/missions.json', import.meta.url), 'utf8'));
  const metrics = [...new Set([...daily, ...weekly].map(mission => mission.metric)), 'funRuns', 'ghostLines', 'mirrorLines'];
  for (const metric of metrics) {
    expect(forMetric(metric), metric).toMatch(/data-patch="(?!mystery)[a-z]+"/);
    expect(forMetric(metric, true)).toBe(icons.mystery);
  }
  const stackMetrics = ['blocksPlaced', 'bottomTwoRows', 'bottomQuarter', 'flatEarth'];
  expect(metrics.filter(metric => forMetric(metric) === icons.stack)).toEqual(stackMetrics);
  expect(forMetric('unknown')).toBe(icons.stack);
});

it('keeps every patch on the 16px grid and mirrors all centered patches pixel for pixel', () => {
  const leftRight = ['tee', 'long', 'square', 'lines', 'clock', 'score', 'drop', 'survive', 'fun', 'ghost', 'mirror', 'quads', 'crate'];
  for (const [name, svg] of Object.entries(icons)) {
    expect(svg).toContain('viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges"');
    const pixels = Array.from({ length: 16 }, () => Array(16).fill('.'));
    for (const [tone, [, path]] of [...svg.matchAll(/ d="([^"]+)"/g)].entries()) {
      expect(path).toMatch(/^(?:M\d+ \d+h1v1h-1z)+$/);
      for (const [, column, row] of path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
        expect(Number(column)).toBeLessThan(16);
        expect(Number(row)).toBeLessThan(16);
        pixels[row][column] = tone;
      }
    }
    const rows = pixels.map(row => row.join(''));
    expect(rows.every(row => row === [...row].reverse().join('')), name).toBe(leftRight.includes(name));
    expect(rows.every((row, index) => row === rows[15 - index]), name).toBe(name === 'square');
  }
});
