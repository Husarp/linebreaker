import { afterEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

it('labels the Settings breadcrumb for its actual return destination', async () => {
  const game = await loadGame();
  try {
    const { w } = game;
    const back = w.document.getElementById('settings-back');
    w.openSettings();
    expect(back.textContent.trim()).toBe('Menu');
    expect(back.querySelector('use').getAttribute('href')).toBe('#lb-topbar-arrow');

    w.closeSettings();
    w.document.getElementById('settings-overlay').dispatchEvent(new w.Event('animationend'));
    w.document.getElementById('pause-overlay').classList.remove('hidden');
    const fromPause = w.document.getElementById('pause-settings');
    w.Function(fromPause.getAttribute('onclick'))();
    expect(back.textContent.trim()).toBe('Back');
    expect(back.querySelector('use').getAttribute('href')).toBe('#lb-topbar-arrow');
  } finally {
    game.close();
  }
});

let game;
afterEach(() => game?.close());

it('uses the same back key across screens and preserves the relative font size setting', async () => {
  game = await loadGame();
  const { w } = game;
  for (const back of w.document.querySelectorAll('.lb-block-topbar .lb-block-back')) {
    expect(back.querySelector('use').getAttribute('href')).toBe('#lb-topbar-arrow');
    expect(back.getAttribute('aria-label') || back.textContent.trim()).not.toBe('');
  }
  const fontScale = () => Number(w.document.documentElement.style.getPropertyValue('--font-scale'));
  w.onSettingChange('fontSize', '5');
  expect(fontScale()).toBe(1);
  w.onSettingChange('fontSize', '3');
  expect(fontScale()).toBeCloseTo(.8);
  w.onSettingChange('fontSize', '7');
  expect(fontScale()).toBeCloseTo(1.2);
});

it('toggles settings through their labels and restores the switch states on reopening', async () => {
  game = await loadGame();
  const { w } = game;
  w.openSettings();
  const music = w.document.getElementById('setting-music-follows-speed');
  const speedUp = w.document.getElementById('setting-speed-up-text');
  const lock = w.document.getElementById('setting-hard-drop-lock');
  const lockDuration = w.document.getElementById('setting-hard-drop-lock-slider-wrap');
  expect([music.checked, speedUp.checked, lock.checked]).toEqual([true, true, false]);
  expect(lockDuration.style.display).toBe('none');
  for (const control of [music, speedUp, lock]) {
    expect(control.getAttribute('role')).toBe('switch');
    control.labels[0].click();
  }
  w.openSettings();
  expect([music.checked, speedUp.checked, lock.checked]).toEqual([false, false, true]);
  expect(lockDuration.style.display).toBe('');
  lock.labels[0].click();
  expect(lockDuration.style.display).toBe('none');
});

it('rejects an incorrect reset phrase and returns focus when cancelled', async () => {
  game = await loadGame();
  const { w, api } = game;
  w.openSettings();
  const reset = w.document.getElementById('settings-reset-progress');
  reset.focus();
  reset.click();
  const input = w.document.getElementById('reset-phrase-input');
  const originalSave = api.save;
  expect(w.document.activeElement).toBe(input);
  input.value = 'RESET';
  w.document.getElementById('reset-confirm-btn').click();
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(w.document.getElementById('reset-phrase-error').hidden).toBe(false);
  expect(api.save).toStrictEqual(originalSave);
  input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(w.document.querySelector('.lb-block-reset-overlay')).toBeNull();
  expect(w.document.activeElement).toBe(reset);
});
