import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const window = {};
runInNewContext(readFileSync(new URL('../121-mission-art.js', import.meta.url), 'utf8'), { window });
const { forMetric } = window.LBMissionArt;
const art = name => 'assets/ui/achievements/' + name + '.webp';

it('maps every daily, weekly and mode objective to its shipped icon', () => {
  const catalog = JSON.parse(readFileSync(new URL('../data/missions.json', import.meta.url), 'utf8'));
  const icons = {
    minimalist: 'mission-single', doubles: 'mission-double', triples: 'mission-triple',
    quads: 'mission-quad', quadStreak: 'mission-quad',
    maxSpeed: 'mission-speed', speedRun: 'mission-speed', speedQueen: 'mission-speed',
    gamesReachedSpeed2: 'mission-speed', gamesReachedSpeed3: 'mission-speed', gamesReachedSpeed4: 'mission-speed',
    bottomTwoRows: 'mission-bottom', bottomQuarter: 'mission-bottom', iFloor: 'mission-bottom',
    maxCombo: 'mission-combo', gamesWithCombo4: 'mission-combo', hatTrick: 'mission-combo',
    rawXP: 'mission-rawxp', totalXP: 'mission-totalxp', perfectClear: 'mission-perfect',
    flatEarth: 'mission-flat', monochrome: 'mission-same', noSoftDrop: 'mission-nosoft',
    score: 'ach-score', linesCleared: 'ach-lines', rotations: 'ach-spin', tSpins: 'ach-spin',
    hardDrops: 'ach-harddrop', blocksPlaced: 'ach-stack', gameTime: 'ach-survive',
    narrowEscape: 'ach-survive', comebackKid: 'ach-survive', ghostLines: 'ach-shield',
    mirrorLines: 'ach-lines', gamesPlayed: 'ach-games', funRuns: 'ach-games',
    niceBonus: 'ach-list', doubleCompletion: 'ach-list',
  };
  const modeMissions = [
    { id: 'ghost_lines', metric: 'ghostLines' },
    { id: 'mirror_lines', metric: 'mirrorLines' },
    { id: 'fun_run', metric: 'funRuns' },
  ];
  for (const { id, metric } of [...catalog.daily, ...catalog.weekly, ...modeMissions]) {
    const path = forMetric(metric);
    expect(path, id).toBe(art(icons[metric]));
    expect(existsSync(new URL('../' + path, import.meta.url)), id).toBe(true);
    expect(forMetric(metric, true), id).toBe(art('ach-list'));
  }
});

it('recognizes singles and keeps a fallback for unknown objectives', () => {
  expect(forMetric('singles')).toBe(art('mission-single'));
  expect(forMetric('unknown')).toBe(art('ach-stack'));
});
