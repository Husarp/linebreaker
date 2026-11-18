import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

it('releases captured movement on cancel, pause and blur, and supports keyboard activation', async () => {
    const dom = new JSDOM(readFileSync('index.html', 'utf8'), { runScripts: 'outside-only' });
    const w = dom.window;
    const events = [];
    for (const type of ['keydown', 'keyup']) w.document.addEventListener(type, e => events.push([e.type, e.code]));
    w.eval(readFileSync('touch.js', 'utf8'));
    const left = w.document.querySelector('[data-key="ArrowLeft"]');
    left.setPointerCapture = () => {};
    const pointer = (type, id) => {
        const e = new w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0 });
        Object.defineProperty(e, 'pointerId', { value: id });
        left.dispatchEvent(e);
    };
    pointer('pointerdown', 1);
    pointer('pointercancel', 1);
    pointer('lostpointercapture', 1);
    expect(events).toEqual([['keydown', 'ArrowLeft'], ['keyup', 'ArrowLeft']]);
    pointer('pointerdown', 2);
    w.document.getElementById('pause-overlay').classList.remove('hidden');
    await Promise.resolve();
    expect(events.at(-1)).toEqual(['keyup', 'ArrowLeft']);
    pointer('pointerdown', 3);
    w.dispatchEvent(new w.Event('blur'));
    expect(events.at(-1)).toEqual(['keyup', 'ArrowLeft']);
    w.document.querySelector('[data-key="Space"]').click();
    expect(events.slice(-2)).toEqual([['keydown', 'Space'], ['keyup', 'Space']]);
    dom.window.close();
});
