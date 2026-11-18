import { expect, it } from 'vitest';
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
