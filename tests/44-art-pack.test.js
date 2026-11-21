import { readFileSync, statSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { loadGame } from './loader.js';

const projectFile = path => new URL(`../${path}`, import.meta.url);
const scope = { window: {} };
runInNewContext(readFileSync(projectFile('44-art-pack.js'), 'utf8'), scope);
const art = scope.window.LBArtPack;

const tokens = {
  '1.25x_game': 'assets/ui/boosters/common-1.25x.png',
  '1.5x_game': 'assets/ui/boosters/rare-1.5x.png',
  '2xp_game': 'assets/ui/boosters/epic-2x.png',
};

it('maps each current booster key to the right rarity and multiplier', () => {
  for (const [key, path] of Object.entries(tokens)) expect(art.boosterToken(key)).toBe(path);
  expect(art.boosterToken('constructor')).toBeNull();
  expect(art.boosterIcon('unknown')).toBe('');
});

it('selects compressed portrait and landscape artwork for all ten built-in themes in image mode', () => {
  for (const theme of ['default', 'ocean', 'forest', 'fire', 'dragon', 'void', 'sunset', 'arctic', 'midnight', 'sakura']) {
    for (const orientation of ['landscape', 'portrait']) {
      const path = `assets/ui/bg/${theme}-${orientation}.jpg`;
      expect(art.themeBackground(theme, 'image', orientation)).toBe(path);
      expect(art.themeBackground(theme, 'plain', orientation)).toBeNull();
      expect(statSync(projectFile(path)).size).toBeLessThan(400_000);
    }
  }
  for (const theme of ['custom', 'toString']) {
    expect(art.themeBackground(theme, 'image')).toBeNull();
  }
  expect(art.backgroundMode(undefined)).toBe('image');
  expect(art.backgroundMode('invalid')).toBe('image');
});

it('keeps the existing gradient and falling-block setting when switching art modes', async () => {
  const { w, close } = await loadGame(true, null, null, { theme: 'ocean', bgBlockMotion: 'falling' });
  try {
    const background = w.document.querySelector('.bg-gradient');
    const gradient = background.style.background;
    const artLayers = () => ['landscape', 'portrait']
      .map(orientation => background.style.getPropertyValue(`--lb-theme-art-${orientation}`));
    const imageLayers = theme => ['landscape', 'portrait']
      .map(orientation => `url("assets/ui/bg/${theme}-${orientation}.jpg")`);
    const select = w.document.getElementById('setting-theme-background');
    const selectMode = mode => {
      select.value = mode;
      select.dispatchEvent(new w.Event('change'));
    };
    const stored = () => JSON.parse(w.localStorage.getItem('linebreaker_settings'));

    w.openSettings();
    expect(select.value).toBe('image');
    expect(artLayers()).toEqual(imageLayers('ocean'));
    selectMode('plain');
    expect(artLayers()).toEqual(['', '']);
    expect(background.style.background).toBe(gradient);
    expect(stored()).toMatchObject({ theme: 'ocean', themeBackground: 'plain', bgBlockMotion: 'falling' });
    w.applyTheme('default');
    expect(artLayers()).toEqual(['', '']);
    selectMode('image');
    expect(artLayers()).toEqual(imageLayers('default'));
    expect(stored().themeBackground).toBe('image');
  } finally { close(); }
});

it('uses the same tokens in the inventory and for eligible game-over boosters', async () => {
  const { api, w, advance, close } = await loadGame();
  try {
    const boosters = Object.fromEntries(Object.keys(tokens).map(key => [key, 1]));
    const cells = Array.from({ length: 22 }, (_, row) => Array(10).fill(row === 21 ? 1 : 0));
    api.setup({ cells, save: { boosters } });
    const images = selector => [...w.document.querySelectorAll(`${selector} .lb-booster-token`)]
      .map(image => image.getAttribute('src'));

    w.inventoryTab('other');
    expect(images('#inventory-other-content')).toEqual(Object.values(tokens));
    expect(api.sweep()).toBe(true);
    advance(200);
    api.gameOver();
    expect(images('#go-boost-row')).toEqual(Object.values(tokens).reverse());

    const result = id => w.document.getElementById(id);
    const runXP = api.save.leaderboard[0].xp;
    expect(result('go-score').textContent).toBe('10');
    expect(result('go-best-score').textContent).toBe('10');
    expect(result('go-best-label').textContent).toBe('New best');
    expect(result('go-lines-cnt').textContent).toBe('1');
    expect(result('go-total-xp').textContent).toBe(String(runXP));

    expect(result('go-boost-row').querySelector('[data-rarity="epic"]').getAttribute('onclick'))
      .toBe("window.useScoreBooster('2xp_game')");
    w.useScoreBooster('2xp_game');
    expect(result('go-total-xp').textContent).toBe(String(2 * runXP));
    expect(result('go-boost-row').hidden).toBe(true);
    expect(api.save.boosters['2xp_game']).toBe(0);
  } finally { close(); }
});
