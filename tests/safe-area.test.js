import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, expect, it } from 'vitest';

const source = readFileSync(new URL('../safe-area.js', import.meta.url), 'utf8');
let window, root, width;
const insets = (left, right, top = 32, bottom = top) => ({ top, rects: [{ left, right, top: 0, bottom }] });
const dispatch = detail => {
  window.__lbWindowInsets = detail;
  window.dispatchEvent(new window.CustomEvent('lb-window-insets', { detail }));
};

beforeEach(() => {
  ({ window } = new JSDOM('', { runScripts: 'outside-only' }));
  root = window.document.documentElement;
  width = 390;
  Object.defineProperty(root, 'clientWidth', { get: () => width });
});
afterEach(() => window.close());

it('initializes from native insets sent before the web script is loaded', () => {
  window.__lbWindowInsets = insets(168, 222);
  window.eval(source);
  expect(root.dataset.lbCutout).toBe('split');
  expect(root.style.getPropertyValue('--lb-cut-start')).toBe('160px');
  expect(root.style.getPropertyValue('--lb-cut-end')).toBe('230px');
});

it('uses the free side for an offset cut-out and falls back for a wide cut-out or older shell', () => {
  window.eval(source);
  expect(root.dataset.lbCutout).toBeUndefined();
  dispatch(insets(35, 75));
  expect(root.dataset.lbCutout).toBe('right');
  dispatch(insets(315, 355));
  expect(root.dataset.lbCutout).toBe('left');
  dispatch(insets(90, 300));
  expect(root.dataset.lbCutout).toBeUndefined();
});

it('recomputes on rotation and avoids merging a bottom cut-out into the top bar', () => {
  window.eval(source);
  const portrait = insets(170, 220);
  portrait.rects.push({ left: 0, right: 300, top: 820, bottom: 844 });
  dispatch(portrait);
  expect(root.dataset.lbCutout).toBe('split');
  width = 844;
  dispatch({ top: 0, left: 32, rects: [{ left: 0, right: 32, top: 150, bottom: 200 }] });
  expect(root.dataset.lbCutout).toBeUndefined();
});
