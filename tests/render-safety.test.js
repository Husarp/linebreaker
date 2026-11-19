import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const markup = `<b data-render-probe>quotes: ' " &amp; \\</b>`;
const invalidColor = `#123456" data-render-probe="invalid`;
const importedTrack = {
  file: 'track.mp3', title: `${markup} title`, artist: `${markup} artist`, tags: [`${markup} tag`]
};
const ownedThemes = ['ocean', 'forest', 'fire', 'dragon', 'void', 'sunset', 'arctic', 'midnight', 'sakura'];
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
let page;
let window;
let document;
let game;

beforeEach(async () => {
  page = new JSDOM(html, { url: 'https://linebreaker.test/', runScripts: 'dangerously' });
  ({ window } = page);
  ({ document } = window);
  window.__LB_TEST__ = true;
  window.indexedDB = new IDBFactory();
  window.showOpenFilePicker = vi.fn();
  window.requestAnimationFrame = () => 0;
  window.cancelAnimationFrame = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; },
    set(value) { this.textContent = value; }
  });
  window.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({
      canvas: this,
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} })
    }, { get: (context, key) => context[key] ?? (() => {}) });
  };
  window.fetch = async (path, options) => {
    if (options?.method === 'HEAD') return { ok: path === 'assets/music/track.mp3' };
    if (path === 'assets/music.json') return { ok: true, json: async () => ({ menu: [importedTrack] }) };
    if (path === 'assets/music.release.json') {
      return { ok: true, json: async () => ({ menu: [{ synth: 'glass-harbor', title: 'Glass Harbor' }] }) };
    }
    return { ok: false };
  };
  for (const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1])) {
    window.eval(src === 'app.js' ? app : readFileSync(new URL('../' + src, import.meta.url), 'utf8'));
  }
  game = window.__lb;
  await vi.waitFor(() => expect(document.getElementById('btn-open-save').onclick).toBeTypeOf('function'));
});

afterEach(() => page.window.close());

it('renders imported scores, dates and pinned notes as literal text', () => {
  const entry = { score: markup, date: markup, note: markup, lines: 1, time: 60, maxSpeed: 2 };
  game.setup({ save: { leaderboard: [entry, entry, entry, entry], pinnedScores: [entry], highscoreHistory: [entry], funLeaderboard: [entry] } });
  for (const [tab, list] of [['leaderboard', 'lb-list'], ['pinned', 'pinned-list'], ['highscores', 'highscores-list'], ['fun', 'fun-list']]) {
    if (tab === 'fun') { window.statsLbTab('leaderboard'); document.querySelector('[data-stats-board="fun"]').click(); }
    else window.statsLbTab(tab);
    const container = document.getElementById(list);
    expect(container.querySelector('.lb-score').textContent).toContain(markup);
    // Save sanitizing (schema v1) may drop an invalid date entirely; if it is shown, it must be literal text.
    expect([markup, '']).toContain(container.querySelector('.lb-date').textContent);
    expect(container.querySelector('[data-render-probe]')).toBeNull();
  }
  expect(document.querySelector('#pinned-list .lb-details-row').textContent).toContain(markup);
  document.querySelector('#lb-list .lb-stats-podium-place').dispatchEvent(new window.MouseEvent('mouseenter'));
  expect(document.querySelector('#lb-tooltip-global').textContent).toContain(markup);
  expect(document.querySelector('#lb-tooltip-global [data-render-probe]')).toBeNull();
});

it('renders achievement claims and saved reward cards as text and rejects an invalid rank color', () => {
  game.setup({ save: {
    pendingAchievementClaims: [{ name: markup, xp: markup, rarity: 'rare' }],
    pendingLevelBox: {
      level: markup, rankName: markup, rankColor: invalidColor,
      rewards: [{ icon: markup, label: markup, desc: markup, rarity: markup }]
    }
  } });
  window.openAchievements();
  const achievements = document.querySelector('#achievements-overlay');
  expect(achievements.textContent).toContain(markup);
  expect(achievements.querySelector('[data-render-probe]')).toBeNull();
  game.showLevelBox();
  const box = document.querySelector('#level-box-overlay');
  expect(box.querySelector('.lb-rank-identity').textContent).toBe(markup);
  expect(box.querySelector('.lb-rank-identity').style.color).toBe('rgb(255, 215, 0)');
  const card = box.querySelector('.lb-reward-card');
  for (const selector of ['.lb64-reward-name', '.lb64-reward-desc', '.lb-reward-rarity']) {
    expect(card.querySelector(selector).textContent).toBe(markup);
  }
  expect(card.querySelector('img').getAttribute('src')).toBe('assets/ui/64-item-part.svg');
  expect(box.querySelector('[data-render-probe]')).toBeNull();
});

it('omits malformed single and tiered achievement dates from unlocked badge tooltips', () => {
  const singleDate = `${markup} single`;
  const tierDate = `${markup} tier`;
  game.setup({ save: { achievements: {
    rules_reader: { unlocked: true, unlockedAt: singleDate },
    collector: { tier: 2, tierDates: { 1: '2026-01-31', 2: tierDate } }
  } } });
  window.openAchievements('unlocked');
  document.getElementById('ach-dates-toggle').click();
  const tooltip = document.getElementById('ach-tip');
  const badges = document.querySelectorAll('#ach-list > div > div:nth-child(2) > div');
  const tooltips = new Map();
  for (const badge of badges) {
    badge.dispatchEvent(new window.MouseEvent('mouseenter'));
    expect(tooltip.querySelector('[data-render-probe]')).toBeNull();
    tooltips.set(tooltip.firstElementChild.textContent, tooltip.textContent);
  }
  expect(tooltips.get('Dementia')).toBeDefined();
  expect(tooltips.get('Dementia')).not.toContain(singleDate);
  expect(tooltips.get('Collector')).toContain('Accumulator');
  expect(tooltips.get('Collector')).toContain('31.01.2026');
  expect(tooltips.get('Collector')).not.toContain(tierDate);
});

it('keeps imported track metadata as text and passes the unchanged name to the playlist action', async () => {
  window.moveTrack = vi.fn();
  window.openPlaylistPanel();
  const playlist = document.querySelector('#playlist-panel-content');
  const { title, artist, tags } = importedTrack;
  const toggle = await vi.waitFor(() => {
    const button = [...playlist.querySelectorAll('button[aria-pressed]')].find(button => button.getAttribute('aria-label') === `Menu playlist: ${title}`);
    expect(button).toBeDefined();
    return button;
  });
  const row = toggle.closest('.lb-playlist-row');
  const metadata = row.querySelector('.lb-playlist-track');
  expect([...metadata.children].map(field => field.textContent)).toEqual([title, `by ${artist}`]);
  expect([...row.querySelectorAll('.lb-playlist-tag')].map(chip => chip.textContent)).toEqual(tags);
  expect(playlist.querySelector('[data-render-probe]')).toBeNull();
  toggle.click();
  expect(window.moveTrack).toHaveBeenCalledExactlyOnceWith('menu', title, false);
  window.playTrackInPlaylist = vi.fn();
  metadata.click();
  expect(window.playTrackInPlaylist).toHaveBeenCalledExactlyOnceWith(title);
});

it('only renders valid hex colors in palette inputs, previews and copy handlers', () => {
  game.setup({ save: {
    ownedThemes,
    ownedPalettes: ['greyscale', 'ice', 'pastel', 'dark', 'synthwave', 'earth', 'neon'],
    customThemeColor: invalidColor,
    customPickerColors: [invalidColor, '#A1b2C3'],
    customPaletteOverrides: { classic: [invalidColor, '#A1b2C3'] }
  } });
  window.inventoryTab('colors');
  const preview = document.querySelector('[data-item-key="classic"] .lb-palette-preview');
  expect(preview.firstElementChild.style.getPropertyValue('--piece-color')).toBe('#00ffff');
  expect(preview.children[1].style.getPropertyValue('--piece-color')).toBe('#A1b2C3');
  window._openPaletteViewModal('classic');
  const copy = [...document.querySelectorAll('#palette-view-modal [title="Copy hex"]')];
  expect(copy[0].getAttribute('onclick')).toContain("writeText('#00ffff')");
  expect(copy[1].getAttribute('onclick')).toContain("writeText('#A1b2C3')");
  window._openPaletteEditor('classic');
  expect(document.getElementById('pe-c0-hex').value).toBe('#00ffff');
  const paletteButton = document.getElementById('custom-palette-picker-button');
  expect(paletteButton.querySelector('.lb-color-launch-mark').style.getPropertyValue('--swatch')).toContain('conic-gradient(#00ffff, #a1b2c3,');
  paletteButton.click();
  const palette = document.getElementById('custom-palette-modal');
  const pieces = palette.querySelectorAll('.lb-color-piece');
  for (const [index, color] of [[0, '#00ffff'], [1, '#a1b2c3']]) {
    pieces[index].click();
    expect(palette.querySelector('.lb-color-hex').value).toBe(color);
    expect(pieces[index].style.getPropertyValue('--piece-color')).toBe(color);
    expect(palette.querySelector('.lb-color-preview').style.getPropertyValue('--swatch')).toBe(color);
  }
  expect(palette.outerHTML).not.toContain('data-render-probe');
  palette.querySelector('[aria-label="Close"]').click();

  const themeButton = document.getElementById('custom-theme-picker-button');
  expect(themeButton.querySelector('.lb-color-launch-mark').style.getPropertyValue('--swatch')).toBe('#ff00ff');
  themeButton.click();
  const theme = document.getElementById('color-picker-modal');
  expect(theme.querySelector('.lb-color-hex').value).toBe('#ff00ff');
  expect(theme.querySelector('.lb-color-preview').style.getPropertyValue('--swatch')).toBe('#ff00ff');
  expect(document.documentElement.outerHTML).not.toContain('data-render-probe');
});

it('applies the custom theme colour from the picker to the page', () => {
  game.setup({ save: { ownedThemes } });
  window.inventoryTab('colors');
  const rootStyle = document.documentElement.style;
  expect(rootStyle.getPropertyValue('--primary')).toBe('#00ffff');
  document.getElementById('custom-theme-picker-button').click();
  const theme = document.getElementById('color-picker-modal');
  const input = theme.querySelector('.lb-color-hex');
  input.value = '#12ABEF';
  input.dispatchEvent(new window.Event('input'));
  theme.querySelector('.lb-color-apply').click();
  expect(rootStyle.getPropertyValue('--primary')).toBe('#12abef');
  expect(rootStyle.getPropertyValue('--primary-dim')).toBe('rgba(18,171,239,0.35)');
  expect(game.save.customThemeColor).toBe('#12abef');
});

it('shows one inventory status, actions and locked-only progress, and counts catalog skins', () => {
  const manifest = JSON.parse(readFileSync(new URL('../assets/skins/skins.json', import.meta.url), 'utf8'));
  const builtInSkinCount = 7;
  game.setup({ save: { ownedSkins: ['retro', 'retro', 'bubble', 'neon', 'matrix', 'unknown'], parts: { glass: 10, shadow: 2 } } });
  window.openInventory();
  const row = key => document.querySelector(`#owned-skin-btns [data-item-key="${key}"]`);
  const equipped = row('retro');
  const owned = row('bubble');
  const locked = row('shadow');
  const ready = row('glass');
  expect(document.getElementById('skin-owned-count').innerText).toBe(`(2/${builtInSkinCount + manifest.length})`);
  expect(row('neon')).toBeNull();
  for (const [card, status] of [[equipped, 'Equipped'], [owned, 'Owned'], [locked, 'Locked'], [ready, 'Locked']]) {
    expect([...card.querySelectorAll('.lb-item-state')].map(chip => chip.textContent)).toEqual([status]);
  }
  expect(equipped.querySelector('button, progress')).toBeNull();
  expect(owned.querySelector('button').textContent).toBe('Equip');
  expect(owned.querySelector('progress')).toBeNull();
  expect(locked.querySelector('progress').value).toBe(2);
  expect(locked.textContent).toContain('2/10 parts');
  expect(locked.querySelector('button')).toBeNull();
  expect(ready.querySelector('progress').value).toBe(10);
  expect(ready.querySelector('button').textContent).toBe('Unlock');
});
