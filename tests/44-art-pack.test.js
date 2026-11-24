import { readFileSync, statSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { loadGame } from './loader.js';

const projectFile = path => new URL(`../${path}`, import.meta.url);
const scope = { window: {} };
runInNewContext(readFileSync(projectFile('44-art-pack.js'), 'utf8'), scope);
const art = scope.window.LBArtPack;

it('keys menu art to the local calendar date, not the time or UTC date', () => {
  const morning = new Date(2026, 11, 31, 0, 1);
  const evening = new Date(2026, 11, 31, 23, 59);
  const tomorrow = new Date(2027, 0, 1, 0, 1);
  const day = art.menuArtDay(morning);
  expect(day).toBe(Date.UTC(2026, 11, 31) / 86400000);
  expect(art.pickMenuArt(art.menuArtDay(evening))).toEqual(art.pickMenuArt(day));
  expect(art.menuArtDay(tomorrow)).toBe(day + 1);
  expect(art.pickMenuArt(day + 1)).not.toEqual(art.pickMenuArt(day));
});

it('selects art for every illustrated tile and reaches every shipped variant', () => {
  const idsByTile = Object.fromEntries(art.menuElements.map(key => [key, new Set()]));
  for (let day = 20_000; day < 20_730; day++) {
    const selection = art.pickMenuArt(day);
    expect(Object.keys(selection)).toEqual([...art.menuElements]);
    for (const [key, id] of Object.entries(selection)) idsByTile[key].add(id);
  }
  expect(Object.fromEntries(Object.entries(idsByTile).map(([key, ids]) => [key, ids.size])))
    .toEqual({ 'player-rank': 2, play: 10, missions: 1, inventory: 1, achievements: 2, settings: 2, stats: 2 });
  for (const [key, ids] of Object.entries(idsByTile)) {
    for (const id of ids) {
      const path = art.menuArtPath(id);
      if (key === 'play') expect(path).toBeNull();
      else expect(statSync(projectFile(path)).size).toBeLessThan(150_000);
    }
  }
});

const tokens = {
  '1.25x_game': 'assets/ui/boosters/scroll-common.webp',
  '1.5x_game': 'assets/ui/boosters/scroll-rare.webp',
  '2xp_game': 'assets/ui/boosters/scroll-epic.webp',
};

it('maps the supported multipliers to shipped scrolls and reserves legendary art for higher boosters', () => {
  expect([1.25, 1.5, 2, 2.5, 3].map(art.boosterRarity)).toEqual(['common', 'rare', 'epic', 'legendary', 'legendary']);
  expect(art.boosterRarity(Infinity)).toBeNull();
  expect([1.25, 1.5, 2].map(mult => art.boosterToken(art.boosterRarity(mult)))).toEqual(Object.values(tokens));
  for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
    expect(statSync(projectFile(art.boosterToken(rarity))).size).toBeLessThan(25_000);
  }
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

it('keeps daily PLAY artwork while the banner follows explicit and equipped wallpapers', async () => {
  const date = new Date(2026, 0, 1, 12);
  while (!art.pickMenuArt(art.menuArtDay(date)).play) date.setDate(date.getDate() + 1);
  const { api, w, close } = await loadGame(true, null, null, undefined, null, window => {
    const NativeDate = window.Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [date.getTime()])); }
    };
  });
  try {
    api.setup({ save: { ownedThemes: ['forest', 'sakura'] } });
    const banner = w.document.querySelector('.lb-menu-banner');
    const play = w.document.getElementById('btn-play');
    const playName = art.pickMenuArt(art.menuArtDay(date)).play.slice('wallpaper-'.length);
    expect(play.dataset.menuArt).toBe(`wallpaper-${playName}`);
    const select = w.document.getElementById('setting-theme-background');
    const choose = value => {
      select.value = value;
      select.dispatchEvent(new w.Event('change'));
    };
    const checkArt = bannerName => {
      for (const crop of ['portrait', 'landscape']) {
        const property = `--lb-theme-art-${crop}`;
        expect(banner.style.getPropertyValue(property)).toBe(bannerName ? `url("assets/ui/bg/${bannerName}-${crop}.jpg")` : '');
        expect(play.style.getPropertyValue(property)).toBe(`url("assets/ui/bg/${playName}-${crop}.jpg")`);
      }
    };
    w.openSettings();
    for (const choice of art.wallpapers) {
      choose(choice);
      checkArt(choice);
    }
    choose('image');
    w.applyTheme('forest');
    checkArt('forest');
    w.applyTheme('sakura');
    checkArt('sakura');
    choose('plain');
    checkArt(null);
    expect(play.querySelector('.lb-ledger-chevron')).toBeNull();
  } finally { close(); }
});

it('uses the same scrolls in the inventory and for eligible game-over boosters', async () => {
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
    expect(result('go-total-xp').textContent).toBe(`+${runXP} XP`);
    advance(16);
    advance(400);
    expect(result('go-total-xp').textContent).toBe(`+${2 * runXP} XP`);
    expect(result('go-xp-progress').textContent).toBe(`${2 * runXP} / 1,000 XP to next level`);
    expect(result('go-boost-row').hidden).toBe(true);
    expect(api.save.boosters['2xp_game']).toBe(0);
  } finally { close(); }
});
