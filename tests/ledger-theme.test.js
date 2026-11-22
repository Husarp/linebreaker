import { expect, it } from 'vitest';
import { loadGame } from './loader.js';

const rootTheme = window => window.document.documentElement.dataset.lbUiTheme;
const settings = window => JSON.parse(window.localStorage.getItem('linebreaker_settings'));
const choose = (window, id, value) => {
  const control = window.document.getElementById(id);
  control.value = value;
  control.dispatchEvent(new window.Event('change'));
};

it('defaults to Forest dark and persists light independently of the equipped theme and wallpaper', async () => {
  const game = await loadGame(true, null, null, { theme: 'ocean' });
  let saved;
  try {
    const { w } = game;
    expect(rootTheme(w)).toBe('dark');
    choose(w, 'setting-theme-background', 'sakura');
    const background = w.document.querySelector('.bg-gradient').style;
    expect(background.getPropertyValue('--lb-theme-art-landscape')).toContain('/sakura-landscape.jpg');
    expect(background.getPropertyValue('--lb-theme-art-portrait')).toContain('/sakura-portrait.jpg');
    choose(w, 'setting-ui-theme', 'light');
    expect(rootTheme(w)).toBe('light');
    expect(background.getPropertyValue('--lb-theme-art-portrait')).toContain('/sakura-portrait.jpg');
    saved = settings(w);
    expect(saved).toMatchObject({ uiTheme: 'light', theme: 'ocean', themeBackground: 'sakura' });
  } finally { game.close(); }

  const restored = await loadGame(true, null, null, saved);
  try {
    const { w } = restored;
    w.openSettings();
    expect(rootTheme(w)).toBe('light');
    expect(w.document.getElementById('setting-ui-theme').value).toBe('light');
    expect(w.document.getElementById('setting-theme-background').value).toBe('sakura');
    const wallpaper = w.document.getElementById('setting-theme-background');
    expect([...wallpaper.options].map(option => option.value)).toEqual(['image', 'plain', ...w.LBArtPack.wallpapers]);
    w.applyTheme('default');
    expect(w.document.querySelector('.bg-gradient').style.getPropertyValue('--lb-theme-art-portrait'))
      .toContain('/sakura-portrait.jpg');
    expect(rootTheme(w)).toBe('light');
  } finally { restored.close(); }
});

it('follows the live system preference without overwriting the stored mode', async () => {
  let preference;
  const game = await loadGame(true, null, null, undefined, { uiTheme: 'system' }, window => {
    preference = Object.assign(new window.EventTarget(), { matches: true });
    window.matchMedia = query => query.includes('color-scheme') ? preference : { matches: false };
  });
  try {
    const { w } = game;
    expect(rootTheme(w)).toBe('light');
    preference.matches = false;
    preference.dispatchEvent(new w.Event('change'));
    expect(rootTheme(w)).toBe('dark');
    expect(settings(w).uiTheme).toBe('system');
    choose(w, 'setting-ui-theme', 'dark');
    preference.matches = true;
    preference.dispatchEvent(new w.Event('change'));
    expect(rootTheme(w)).toBe('dark');
    expect(settings(w).uiTheme).toBe('dark');
  } finally { game.close(); }
});
