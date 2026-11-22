import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, expect, it } from 'vitest';

const source = readFileSync(new URL('../safe-area.js', import.meta.url), 'utf8');
let window, root;
const insets = (left, right, top = 32, bottom = top) => ({ top, rects: [{ left, right, top: 0, bottom }] });
const dispatch = detail => {
  window.__lbWindowInsets = detail;
  window.dispatchEvent(new window.CustomEvent('lb-window-insets', { detail }));
};

beforeEach(() => {
  ({ window } = new JSDOM('', { runScripts: 'outside-only' }));
  root = window.document.documentElement;
});
afterEach(() => window.close());

it('initializes the entire band below a native punch-hole', () => {
  window.__lbWindowInsets = insets(184, 206, 26, 34);
  window.eval(source);
  expect(root.style.getPropertyValue('--lb-cutout-top')).toBe('34px');
  expect(root.style.getPropertyValue('--lb-cutout-left')).toBe('184px');
  expect(root.style.getPropertyValue('--lb-cutout-right')).toBe('206px');
});

it('uses the same rule for a wide notch and leaves env fallback available without native insets', () => {
  window.eval(source);
  expect(root.style.getPropertyValue('--lb-cutout-top')).toBe('0px');
  expect(root.style.getPropertyValue('--lb-cutout-left')).toBe('');
  dispatch(insets(90, 300, 45, 38));
  expect(root.style.getPropertyValue('--lb-cutout-top')).toBe('45px');
  expect(root.style.getPropertyValue('--lb-cutout-left')).toBe('90px');
  expect(root.style.getPropertyValue('--lb-cutout-right')).toBe('300px');
});

it('uses fresh native insets after rotation and ignores bottom and side cut-outs', () => {
  window.eval(source);
  const portrait = insets(170, 220);
  portrait.rects.push({ left: 0, right: 300, top: 820, bottom: 844 });
  dispatch(portrait);
  expect(root.style.getPropertyValue('--lb-cutout-top')).toBe('32px');
  dispatch({ top: 0, left: 32, rects: [{ left: 0, right: 32, top: 150, bottom: 200 }] });
  expect(root.style.getPropertyValue('--lb-cutout-top')).toBe('0px');
  expect(root.style.getPropertyValue('--lb-cutout-left')).toBe('');
  expect(root.style.getPropertyValue('--lb-cutout-right')).toBe('');
});
