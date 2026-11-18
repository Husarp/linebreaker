import { afterEach, beforeEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

let game;
beforeEach(async () => { game = await loadGame(); });
afterEach(() => game?.close());

it('opens contextual Help, scrolls the matching topic, and restores focus on close', () => {
  const { document } = game.w;
  const missions = document.getElementById('missions-overlay');
  missions.classList.remove('hidden');
  const trigger = missions.querySelector('.lb-info-btn');
  const help = document.getElementById('rules-overlay');
  const content = help.querySelector('.lb-help-content');
  const initialVisits = game.api.save.stats.rulesOpened || 0;

  trigger.click();
  expect(help.classList.contains('hidden')).toBe(false);
  expect(document.activeElement.id).toBe('help-missions');
  expect(help.querySelector('[aria-current="location"]').dataset.helpJump).toBe('missions');
  expect(help.querySelectorAll('[data-help-topic]')).toHaveLength(10);

  const ranks = document.getElementById('help-ranks');
  Object.defineProperty(ranks, 'offsetTop', { value: 800 });
  content.style.paddingTop = '16px';
  help.querySelector('[data-help-jump="ranks"]').click();
  expect(content.scrollTop).toBe(784);
  expect(document.activeElement).toBe(ranks);
  expect(game.api.save.stats.rulesOpened).toBe(initialVisits + 1);

  game.w.closeHelp();
  expect(help.classList.contains('hidden')).toBe(true);
  expect(missions.classList.contains('hidden')).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it('shows current bindings and routes Settings subtopics within Basics', () => {
  const { document, KeyboardEvent } = game.w;
  const settings = document.getElementById('settings-overlay');
  settings.classList.remove('hidden');
  document.querySelector('button[aria-label^="Rotate CCW, secondary"]').click();
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true, cancelable: true }));
  settings.querySelector('[data-help-section="sound"]').click();
  expect(document.activeElement.id).toBe('help-sound');
  expect(document.querySelector('#rules-overlay [aria-current="location"]').dataset.helpJump).toBe('basics');
  expect(Array.from(document.querySelectorAll('[data-help-topic="basics"] dd'), node => node.textContent)).toContain('Q');

  game.w.openHelp('invalid-section');
  expect(document.activeElement.id).toBe('help-basics');
});

it('uses the existing XP tooltip and opens the rank topic from the menu info control', () => {
  const { document } = game.w;
  game.api.drawRankBadge();
  const trigger = document.querySelector('#menu-overlay [data-help-section="ranks"]');
  const detail = document.getElementById('menu-xp-detail');
  trigger.focus();
  expect(detail.style.visibility).toBe('visible');
  trigger.click();
  expect(document.activeElement.id).toBe('help-ranks');
  expect(detail.style.visibility).toBe('hidden');
});

it('keeps the daily streak multiplier at each documented boundary', () => {
  const cases = [[0, 1], [2, 1], [3, 1.25], [5, 1.25], [6, 1.5], [10, 1.5], [11, 1.75], [20, 1.75], [21, 2], [50, 2]];
  expect(cases.map(([days]) => game.api.streakMultiplier(days))).toEqual(cases.map(([, multiplier]) => multiplier));
  game.w.openHelp('streaks');
  const multipliers = document => Array.from(document.querySelectorAll('[data-help-topic="streaks"] dl dd'), node => node.textContent);
  expect(multipliers(game.w.document)).toEqual([3, 6, 11, 21].map(days => `×${game.api.streakMultiplier(days).toFixed(2)} run XP`));
});

it('adds enabled Normal-mode modifiers and ignores disabled modifiers', () => {
  expect(game.api.modeXpMultiplier({})).toBe(1);
  expect(game.api.modeXpMultiplier({ optMirror: true, optNoNext: true, optHold: false })).toBeCloseTo(1.3);
  expect(game.api.modeXpMultiplier({ optHold: true, opt3Next: true, optGhost: true })).toBeCloseTo(0.5);
});

it('pauses the same hover animation on exit and does not start it for touch or the main menu', () => {
  const { document, Event } = game.w;
  const start = document.querySelector('#mode-select-overlay [data-lb-drift]');
  const play = document.getElementById('btn-play');
  const animation = { playState: 'running', pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; } };
  let created = 0;
  start.animate = play.animate = () => { created++; return animation; };
  const pointer = (target, type, pointerType) => target.dispatchEvent(Object.assign(new Event(type), { pointerType }));

  pointer(play, 'pointerenter', 'mouse');
  pointer(start, 'pointerenter', 'touch');
  expect(created).toBe(0);
  pointer(start, 'pointerenter', 'mouse');
  pointer(start, 'pointerleave', 'mouse');
  expect(animation.playState).toBe('paused');
  pointer(start, 'pointerenter', 'mouse');
  expect(animation.playState).toBe('running');
  expect(created).toBe(1);
});
