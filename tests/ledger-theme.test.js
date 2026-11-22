import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { loadGame } from './loader.js';

const rootTheme = window => window.document.documentElement.dataset.lbUiTheme;
const settings = window => JSON.parse(window.localStorage.getItem('linebreaker_settings'));
const themeButton = (window, theme) => window.document.querySelector(`[data-ui-theme="${theme}"]`);
const choose = (window, id, value) => {
  const control = window.document.getElementById(id);
  control.value = value;
  control.dispatchEvent(new window.Event('change'));
};

it('defaults to Dark and persists Light independently of the equipped theme and wallpaper', async () => {
  const game = await loadGame(true, null, null, { theme: 'ocean' });
  let saved;
  try {
    const { w } = game;
    expect(rootTheme(w)).toBe('dark');
    choose(w, 'setting-theme-background', 'sakura');
    const background = w.document.querySelector('.bg-gradient').style;
    expect(background.getPropertyValue('--lb-theme-art-landscape')).toContain('/sakura-landscape.jpg');
    expect(background.getPropertyValue('--lb-theme-art-portrait')).toContain('/sakura-portrait.jpg');
    themeButton(w, 'light').click();
    expect(rootTheme(w)).toBe('light');
    expect(background.getPropertyValue('--lb-theme-art-portrait')).toContain('/sakura-portrait.jpg');
    saved = settings(w);
    expect(saved).toMatchObject({ uiTheme: 'light', theme: 'ocean', themeBackground: 'sakura' });
  } finally { game.close(); }

  const restored = await loadGame(true, null, null, saved);
  try {
    const { w } = restored;
    const banner = w.document.querySelector('.lb-menu-banner');
    w.openSettings();
    expect(rootTheme(w)).toBe('light');
    expect(themeButton(w, 'light').getAttribute('aria-pressed')).toBe('true');
    expect(themeButton(w, 'dark').getAttribute('aria-pressed')).toBe('false');
    expect(w.document.getElementById('setting-theme-background').value).toBe('sakura');
    const options = w.document.querySelectorAll('#setting-theme-background-list [role="option"]');
    expect([...options].map(option => option.dataset.value)).toEqual(['image', 'plain', ...w.LBArtPack.wallpapers]);
    w.applyTheme('default');
    expect(w.document.querySelector('.bg-gradient').style.getPropertyValue('--lb-theme-art-portrait'))
      .toContain('/sakura-portrait.jpg');
    expect(banner.style.getPropertyValue('--lb-theme-art-portrait')).toContain('/sakura-portrait.jpg');
    expect(rootTheme(w)).toBe('light');
    const preview = w.document.querySelector('.lb102-wallpaper-preview');
    expect(preview.style.backgroundImage).toContain('/sakura-landscape.jpg');
    choose(w, 'setting-theme-background', 'plain');
    expect(preview.style.backgroundImage).toBe('');
    expect(banner.style.getPropertyValue('--lb-theme-art-portrait')).toBe('');
    expect(rootTheme(w)).toBe('light');
  } finally { restored.close(); }
});

it.each(['green', 'cyan', 'unknown'])('migrates obsolete %s to Dark even on a light system', async legacy => {
  const game = await loadGame(true, null, null, undefined, { uiTheme: legacy }, window => {
    window.matchMedia = query => ({ matches: query.includes('prefers-color-scheme: light') });
  });
  try {
    const { w } = game;
    expect(rootTheme(w)).toBe('dark');
    expect([...w.document.querySelectorAll('[data-ui-theme]')].map(button => button.textContent)).toEqual(['Dark', 'Light', 'System']);
    expect(themeButton(w, 'dark').getAttribute('aria-pressed')).toBe('true');
    expect(settings(w).uiTheme).toBe('dark');
    expect(w.LBSave.cleanSettings({ uiTheme: legacy }).uiTheme).toBe('dark');
  } finally { game.close(); }
});

it('retains the System choice while following live OS changes only in that mode', async () => {
  let onChange;
  const media = { matches: true, addEventListener: (type, listener) => { onChange = listener; } };
  const game = await loadGame(true, null, null, undefined, { uiTheme: 'system' }, window => {
    window.matchMedia = query => query.includes('prefers-color-scheme') ? media : { matches: false };
  });
  try {
    const { w } = game;
    expect(rootTheme(w)).toBe('light');
    expect(themeButton(w, 'system').getAttribute('aria-pressed')).toBe('true');
    media.matches = false;
    onChange();
    expect(rootTheme(w)).toBe('dark');
    expect(settings(w).uiTheme).toBe('system');
    themeButton(w, 'dark').click();
    media.matches = true;
    onChange();
    expect(rootTheme(w)).toBe('dark');
    themeButton(w, 'system').click();
    expect(rootTheme(w)).toBe('light');
  } finally { game.close(); }
});

it('offers every shipped wallpaper and updates both crops of the main-menu banner', async () => {
  const { w, close } = await loadGame();
  try {
    const wallpaperNames = ['default', 'forest', 'ocean', 'fire', 'dragon', 'void', 'sunset', 'arctic', 'midnight', 'sakura'];
    const banner = w.document.querySelector('.lb-menu-banner');
    const options = [...w.document.querySelectorAll('#setting-theme-background-list [role="option"]')];
    expect(options.map(option => option.dataset.value).sort()).toEqual([...wallpaperNames, 'image', 'plain'].sort());
    for (const name of wallpaperNames) {
      options.find(option => option.dataset.value === name).click();
      expect(settings(w).themeBackground).toBe(name);
      for (const orientation of ['landscape', 'portrait']) {
        const path = `assets/ui/bg/${name}-${orientation}.jpg`;
        expect(banner.style.getPropertyValue(`--lb-theme-art-${orientation}`)).toBe(`url("${path}")`);
        expect(readFileSync(new URL(`../${path}`, import.meta.url)).length).toBeGreaterThan(0);
      }
    }
    w.applyTheme('default');
    options.find(option => option.dataset.value === 'image').click();
    expect(banner.style.getPropertyValue('--lb-theme-art-portrait')).toContain('/default-portrait.jpg');
  } finally { close(); }
});

const css = readFileSync(new URL('../ledger.css', import.meta.url), 'utf8');
const colors = selector => Object.fromEntries([...css.split(`${selector} {`)[1].split('}')[0]
  .matchAll(/--lb-([\w-]+): #([\da-f]{6});/gi)].map(([, name, hex]) =>
  [name, hex.match(/../g).map(channel => Number.parseInt(channel, 16) / 255)]));
const luminance = color => color.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (foreground, background) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((first, second) => second - first);
  return (lighter + 0.05) / (darker + 0.05);
};

it.each(['dark', 'light'])('%s shared tokens pass WCAG AA for text, controls and focus', theme => {
  const token = { ...colors('.lb-game-root'), ...(theme === 'light' && colors(".lb-game-root[data-lb-ui-theme='light']")) };
  const surfaces = ['page', 'panel', 'key', 'track', 'disabled'];
  for (const role of ['ink', 'muted', 'label', 'utility', 'danger']) {
    for (const panel of surfaces) expect(contrast(token[role], token[panel]), `${role} on ${panel}`).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast(token['on-action'], token.action)).toBeGreaterThanOrEqual(4.5);
  for (const surface of ['page', 'panel', 'key', 'track']) {
    expect(contrast(token.focus, token[surface]), `focus on ${surface}`).toBeGreaterThanOrEqual(3);
    expect(contrast(token['control-line'], token[surface]), `control outline on ${surface}`).toBeGreaterThanOrEqual(3);
  }
  expect(contrast(token.meter, token.track)).toBeGreaterThanOrEqual(3);
  expect(contrast(token.label, token.panel)).toBeGreaterThanOrEqual(3);
  expect(contrast(token['art-ink'], token.art)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(token['art-label'], token.art)).toBeGreaterThanOrEqual(4.5);
});
