import { expect, it } from 'vitest';
import { loadGame } from './loader.js';

function mockMotion(window, selector) {
  const animations = [];
  const preference = new window.EventTarget();
  preference.matches = false;
  window.matchMedia = () => preference;
  window.document.querySelector(selector).animate = (frames, options) => {
    const animation = {
      frames, options, playState: 'running',
      play() { this.playState = 'running'; },
      pause() { this.playState = 'paused'; },
      cancel() { this.playState = 'idle'; },
    };
    animations.push(animation);
    return animation;
  };
  return { animations, preference };
}

it('reacts to rapid logo taps, retains all six effects, and offers motion-free feedback', async () => {
  let motion;
  const { w, api, close } = await loadGame(true, null, null, undefined, null, window => {
    motion = mockMotion(window, '#lb122-logo-button img');
  });
  try {
    const logo = w.document.getElementById('lb122-logo-button');
    for (let click = 0; click < 6; click++) logo.click();
    expect(motion.animations).toHaveLength(6);
    expect(motion.animations.slice(0, -1).every(animation => animation.playState === 'idle')).toBe(true);
    expect(motion.animations[2].options.duration).toBe(1200);
    expect(motion.animations[4].frames.map(frame => frame.transform)).toEqual([
      'none', 'rotate(-4deg)', 'rotate(3deg)', 'rotate(-1deg)', 'none',
    ]);
    expect(api.save.achievements.logo_click.unlocked).toBe(true);
    motion.preference.matches = true;
    logo.click();
    expect(motion.animations.at(-1).frames).toEqual(Array(2).fill({ filter: 'brightness(1.5)' }));
  } finally { close(); }
});

it('drifts image wallpapers only, pauses when hidden, and honors both motion controls', async () => {
  let motion;
  const { w, close } = await loadGame(true, null, null, undefined, null, window => {
    motion = mockMotion(window, '.lb-wallpaper');
  });
  try {
    const { animations, preference } = motion;
    const mode = w.document.getElementById('setting-theme-background');
    const toggle = w.document.getElementById('setting-moving-background');
    const setHidden = hidden => {
      Object.defineProperty(w.document, 'hidden', { configurable: true, value: hidden });
      w.document.dispatchEvent(new w.Event('visibilitychange'));
    };
    const setMode = value => {
      mode.value = value;
      mode.dispatchEvent(new w.Event('change'));
    };

    w.openSettings();
    expect(toggle.checked).toBe(true);
    expect(w.document.querySelector('#bg-canvas, #slider-heavybg, #setting-bg-block-motion')).toBeNull();
    const first = animations[0];
    expect(first.options.duration).toBeGreaterThanOrEqual(18000);
    expect(first.options.duration).toBeLessThan(28000);
    expect(first.frames[0].transform).toBe('translate(0%, 0%)');
    first.onfinish();
    const second = animations[1];
    expect(second.frames[0]).toEqual(first.frames[1]);
    setHidden(true);
    expect(second.playState).toBe('paused');
    setHidden(false);
    expect(second.playState).toBe('running');

    toggle.click();
    expect(second.playState).toBe('idle');
    second.onfinish();
    expect(animations).toHaveLength(2);
    expect(JSON.parse(w.localStorage.getItem('linebreaker_settings')).movingBackground).toBe(false);
    toggle.click();
    expect(animations).toHaveLength(3);
    preference.matches = true;
    preference.dispatchEvent(new w.Event('change'));
    expect(animations.at(-1).playState).toBe('idle');
    setMode('plain');
    const banner = w.document.querySelector('.lb-menu-banner');
    expect(banner.style.getPropertyValue('--lb-theme-art-landscape')).toBe('');
    preference.matches = false;
    preference.dispatchEvent(new w.Event('change'));
    expect(animations).toHaveLength(3);
    setMode('image');
    expect(animations.at(-1).playState).toBe('running');
  } finally { close(); }
});

it('renders the real rank, level, XP and current season in the menu', async () => {
  const { w, api, close } = await loadGame();
  try {
    const info = api.getLevelInfo(api.save.totalXP);
    const { document } = w;
    expect(document.getElementById('badge-rank-name').textContent).toBe('Bronze');
    expect(document.getElementById('badge-level-num').textContent).toBe(`Level ${info.level.toLocaleString()}`);
    expect(document.getElementById('menu-xp-detail').textContent).toBe(`${info.currentXP.toLocaleString()} / ${info.neededXP.toLocaleString()} XP`);
    expect(document.querySelector('.lb-menu-banner').style.getPropertyValue('--lb-theme-art-landscape')).toContain('default-landscape.jpg');
    const { id, day } = w.LBSeason.seasonWindow(w.Date.now());
    expect(document.getElementById('lb-menu-season-date').textContent).toBe(`Season ${String(id).padStart(2, '0')} · Day ${String(day).padStart(2, '0')} / ${w.LBSeason.DAYS}`);
  } finally { close(); }
});

it('restores the saved wallpaper preference and shares the settings icon', async () => {
  let motion;
  const { w, close } = await loadGame(true, null, null, { movingBackground: false }, null, window => {
    motion = mockMotion(window, '.lb-wallpaper');
  });
  try {
    w.openSettings();
    expect(w.document.getElementById('setting-moving-background').checked).toBe(false);
    expect(motion.animations).toHaveLength(0);
    for (const selector of ['#btn-settings use', '#pause-settings use']) {
      expect(w.document.querySelector(selector).getAttribute('href')).toBe('#lb-icon-settings');
    }
  } finally { close(); }
});

it('keeps the Circuit menu actions and opens Inventory on Crates', async () => {
  const { w, close } = await loadGame();
  try {
    const { document } = w;
    const inventory = document.getElementById('btn-inventory');
    expect(inventory.closest('.lb-menu-nav').querySelectorAll('.lb-circuit-action')).toHaveLength(4);
    inventory.click();
    expect(document.querySelector('[data-invtab="crates"]').getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-invtab-content="crates"]').classList.contains('hidden')).toBe(false);
  } finally { close(); }
});
