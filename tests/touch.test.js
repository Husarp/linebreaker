import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import '../touch.js';
const map = globalThis.LBTouch.gestureActions;
const base = { startX: 150, startY: 0, x: 150, y: 0, left: 0, width: 300, cell: 30, elapsed: 100, fingers: 1 };
it('maps taps to CW, left-third and two-finger taps to CCW', () => {
 expect(map(base, true)).toEqual(['cw']);
 expect(map({ ...base, startX: 20, x: 20 }, true)).toEqual(['ccw']);
 expect(map({ ...base, fingers: 2 }, true)).toEqual(['ccw']);
 expect(map({ ...base, fingers: 2, moved: true }, true)).toEqual([]);
});
it('snaps horizontal movement and reversals to cells without repeats', () => {
 expect(map({ ...base, x: 215 })).toEqual(['right', 'right']);
 expect(map({ ...base, x: 215, steps: 2 })).toEqual([]);
 expect(map({ ...base, x: 175, steps: 2 })).toEqual(['left', 'left']);
});
it('separates fast hard drop, slow soft drop, hold and drag release', () => {
 expect(map({ ...base, y: 100 }, true)).toEqual(['hard']);
 expect(map({ ...base, y: 100 })).toEqual([]);
 expect(map({ ...base, y: 100, elapsed: 600 })).toEqual(['soft', 'soft', 'soft']);
 expect(map({ ...base, y: 100, elapsed: 600, down: 3 })).toEqual([]);
 expect(map({ ...base, y: -100 }, true)).toEqual(['hold']);
 expect(map({ ...base, moved: true }, true)).toEqual([]);
});

it('slides between the captured arrows without firing other buttons or releasing on another finger', () => {
 const dom = new JSDOM('<div id="app"><canvas id="game-board"></canvas></div>', { runScripts: 'outside-only' });
 try {
  const { window } = dom;
  const { document } = window;
  const game = window.LBInput = { press: vi.fn(), release: vi.fn(), action: vi.fn(), unlockAudio: vi.fn() };
  window.matchMedia = () => ({ matches: true });
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.eval(readFileSync(new URL('../touch.js', import.meta.url), 'utf8'));
  const left = document.querySelector('[data-action="left"]');
  const right = document.querySelector('[data-action="right"]');
  const hard = document.querySelector('[data-action="hard"]');
  document.elementFromPoint = vi.fn();
  const pointer = (button, type, pointerId) => button.dispatchEvent(Object.assign(new window.MouseEvent(type, { bubbles: true }), { pointerId, pointerType: 'mouse' }));

  pointer(right, 'pointerdown', 1);
  expect(right.setPointerCapture).toHaveBeenCalledWith(1);
  document.elementFromPoint.mockReturnValue(left.querySelector('path'));
  pointer(right, 'pointermove', 1);
  pointer(right, 'pointermove', 1);
  document.elementFromPoint.mockReturnValue(hard);
  pointer(right, 'pointermove', 1);
  document.elementFromPoint.mockReturnValue(right);
  pointer(right, 'pointermove', 1);
  expect(game.press.mock.calls).toEqual([['right', 1], ['left', 1], ['right', 1]]);
  expect(game.action).not.toHaveBeenCalled();

  pointer(hard, 'pointerdown', 2);
  pointer(hard, 'pointerup', 2);
  expect(game.action).toHaveBeenCalledWith('hard');
  expect(game.release).not.toHaveBeenCalled();
  pointer(right, 'lostpointercapture', 1);
  pointer(right, 'pointerup', 1);
  expect(game.release.mock.calls).toEqual([[1]]);
 } finally {
  dom.window.close();
 }
});

it('fires secondary fingers independently while an arrow repeats, including the phone Hold control', () => {
 const dom = new JSDOM('<div id="app"><div id="hold-panel"></div><canvas id="game-board"></canvas></div>', { runScripts: 'outside-only' });
 try {
  const { window } = dom;
  const { document } = window;
  const game = window.LBInput = { press: vi.fn(), release: vi.fn(), action: vi.fn(), unlockAudio: vi.fn() };
  window.matchMedia = () => ({ matches: true });
  window.eval(readFileSync(new URL('../touch.js', import.meta.url), 'utf8'));
  const button = action => document.querySelector(`[data-action="${action}"]`);
  const pointer = (target, type, pointerId) => target.dispatchEvent(Object.assign(
   new window.MouseEvent(type, { bubbles: true, cancelable: true, detail: type === 'click' ? 1 : 0 }),
   { pointerId, pointerType: 'touch', isPrimary: pointerId === 1 }
  ));
  expect(pointer(button('left'), 'pointerdown', 1)).toBe(true);
  for (const [target, id] of [[button('cw'), 2], [button('hard'), 3], [document.querySelector('.lb-phone-hold'), 4]]) {
   pointer(target, 'pointerdown', id);
   pointer(target, 'pointerup', id);
   pointer(target, 'click', id);
  }
  expect(game.action.mock.calls).toEqual([['cw'], ['hard'], ['hold']]);
  expect(game.release).not.toHaveBeenCalled();
  pointer(button('right'), 'pointerdown', 5);
  pointer(button('soft'), 'pointerdown', 6);
  pointer(button('right'), 'pointercancel', 5);
  pointer(button('right'), 'lostpointercapture', 5);
  expect(game.press.mock.calls).toEqual([['left', 1], ['right', 5], ['soft', 6]]);
  expect(game.release.mock.calls).toEqual([[5]]);
  pointer(button('left'), 'pointerup', 1);
  window.dispatchEvent(new window.Event('blur'));
  expect(game.release.mock.calls).toEqual([[5], [1], [6]]);
 } finally {
  dom.window.close();
 }
});
