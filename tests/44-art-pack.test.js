import { readFileSync, statSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { loadGame } from './loader.js';

const projectFile = path => new URL(`../${path}`, import.meta.url);
const scope = { window: {} };
runInNewContext(readFileSync(projectFile('44-art-pack.js'), 'utf8'), scope);
const art = scope.window.LBArtPack;

it('offers all 56 sets of three eligible menu elements and excludes the previous set', () => {
  const sets = Array.from({ length: 56 }, (_, index) => art.pickMenuArt({}, 'ocean', 'image', () => (index + 0.5) / 56));
  expect(new Set(sets.map(set => Object.keys(set).join(','))).size).toBe(56);
  for (const [index, set] of sets.entries()) {
    const keys = Object.keys(set);
    expect(keys).toHaveLength(3);
    expect(keys.every(key => art.menuElements.includes(key))).toBe(true);
    expect(Object.keys(art.pickMenuArt(set, 'ocean', 'image', () => (index + 0.5) / 56))).not.toEqual(keys);
    if (set.play) expect(set.play).toBe('wallpaper-forest');
  }
  expect(Object.keys(art.pickMenuArt(art.pickMenuArt({}, 'default', 'plain', () => 0), 'default', 'plain', () => 0)))
    .not.toEqual(Object.keys(sets[0]));
});

it('picks both variants for paired elements and ships every collectible image', () => {
  const ids = new Set();
  for (let index = 0; index < 56; index++) {
    for (const variant of [0, 0.99]) {
      let firstRoll = true;
      const pick = art.pickMenuArt({}, 'default', 'plain', () => {
        if (!firstRoll) return variant;
        firstRoll = false;
        return (index + 0.5) / 56;
      });
      if (pick.play) expect(pick.play).toBe('wallpaper-default');
      for (const id of Object.values(pick)) ids.add(id);
    }
  }
  expect(art.seenArtIds).toHaveLength(21);
  expect([...ids].filter(id => !id.startsWith('wallpaper-')).sort()).toEqual(art.seenArtIds.filter(id => !id.startsWith('wallpaper-')).sort());
  for (const id of ids) {
    const path = art.menuArtPath(id);
    if (id.startsWith('wallpaper-')) expect(path).toBeNull();
    else expect(statSync(projectFile(path)).size).toBeLessThan(150_000);
  }
});

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

it('keeps the existing gradient when switching art modes', async () => {
  const { w, close } = await loadGame(true, null, null, { theme: 'ocean', bgBlockMotion: 'falling', heavyBg: 3 });
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
    expect(stored()).toMatchObject({ theme: 'ocean', themeBackground: 'plain' });
    expect(stored()).not.toHaveProperty('bgBlockMotion');
    expect(stored()).not.toHaveProperty('heavyBg');
    w.applyTheme('default');
    expect(artLayers()).toEqual(['', '']);
    selectMode('image');
    expect(artLayers()).toEqual(imageLayers('default'));
    expect(stored().themeBackground).toBe('image');
  } finally { close(); }
});

it('puts a different wallpaper on PLAY for every explicit and equipped wallpaper, including wraparound', async () => {
  const { api, w, close } = await loadGame();
  try {
    api.setup({ save: { ownedThemes: ['forest', 'sakura'] } });
    const banner = w.document.querySelector('.lb-menu-banner');
    const play = w.document.getElementById('btn-play');
    const select = w.document.getElementById('setting-theme-background');
    const choose = value => {
      select.value = value;
      select.dispatchEvent(new w.Event('change'));
    };
    const checkArt = (bannerName, playName) => {
      for (const crop of ['portrait', 'landscape']) {
        const property = `--lb-theme-art-${crop}`;
        expect(banner.style.getPropertyValue(property)).toBe(bannerName ? `url("assets/ui/bg/${bannerName}-${crop}.jpg")` : '');
        expect(play.style.getPropertyValue(property)).toBe(`url("assets/ui/bg/${playName}-${crop}.jpg")`);
      }
    };
    w.openSettings();
    for (const [index, choice] of art.wallpapers.entries()) {
      choose(choice);
      checkArt(choice, art.wallpapers[(index + 1) % art.wallpapers.length]);
    }
    choose('image');
    w.applyTheme('forest');
    checkArt('forest', 'fire');
    w.applyTheme('sakura');
    checkArt('sakura', 'default');
    choose('plain');
    checkArt(null, 'default');
    expect(art.nextWallpaper('custom', 'image')).toBe('default');
    expect(play.querySelector('.lb-ledger-chevron')).toBeNull();
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

    w.inventoryTab('boosters');
    expect(images('#inventory-boosters .lb-inventory-booster-stock')).toEqual(Object.values(tokens));
    expect(api.sweep()).toBe(true);
    advance(200);
    api.gameOver();
    expect(images('#go-boost-row')).toEqual(Object.values(tokens).reverse());

    const result = id => w.document.getElementById(id);
    const runXP = api.save.leaderboard[0].xp;
    expect(result('go-score').textContent).toBe('10');
    expect(result('go-best-score').textContent).toBe('10');
    expect(result('go-record-label').textContent).toBe('New personal best');
    expect(result('go-record-label').hidden).toBe(false);
    expect(result('go-lines-cnt').textContent).toBe('1');
    expect(result('go-total-xp').textContent).toBe(`+${runXP} XP`);

    expect(result('go-boost-row').querySelector('[data-rarity="epic"]').getAttribute('onclick'))
      .toBe("window.useScoreBooster('2xp_game')");
    w.useScoreBooster('2xp_game');
    expect(result('go-total-xp').textContent).toBe(`+${2 * runXP} XP`);
    expect(result('go-xp-progress').textContent).toBe(`${2 * runXP} / 1,000 XP to next level`);
    expect(result('go-boost-row').hidden).toBe(true);
    expect(api.save.boosters['2xp_game']).toBe(0);
  } finally { close(); }
});
