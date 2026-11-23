window.LBArtPack = (() => {
    const partMaterial = { common: 'scroll', rare: 'rune', epic: 'thread', legendary: 'ore', mythic: 'crystal' };
    const itemPart = rarity => `assets/ui/parts/part-${Object.hasOwn(partMaterial, rarity) ? partMaterial[rarity] : partMaterial.common}.webp`;
    const universalPart = rarity => `assets/ui/parts/universal-${Object.hasOwn(partMaterial, rarity) ? rarity : 'common'}.webp`;
    const boosterRarities = new Map([[1.25, 'common'], [1.5, 'rare'], [2, 'epic']]);
    const backgrounds = new Set([
        'default', 'ocean', 'forest', 'fire', 'dragon', 'void', 'sunset', 'arctic', 'midnight', 'sakura',
    ]);
    const wallpapers = Object.freeze([...backgrounds]);
    const menuArt = {
        'player-rank': ['player-training', 'player-heraldry'],
        play: wallpapers.map(name => `wallpaper-${name}`),
        missions: ['missions-outpost'],
        inventory: ['inventory-caravan'],
        achievements: ['achievements-hall', 'achievements-summit'],
        settings: ['settings-clockwork-vivid', 'settings-lighthouse'],
        stats: ['stats-archive', 'stats-archive-calm'],
    };
    const menuElements = Object.freeze(Object.keys(menuArt));
    const menuTileArt = new Set(menuElements.filter(key => key !== 'play').flatMap(key => menuArt[key]));
    const menuArtDay = date => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);

    function dailyIndex(day, key, count) {
        let hash = day;
        for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
        hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
        return ((hash ^ (hash >>> 16)) >>> 0) % count;
    }

    function pickMenuArt(day) {
        return Object.fromEntries(menuElements.map(key => [key, menuArt[key][dailyIndex(day, key, menuArt[key].length)]]));
    }

    function pickDailyFeatureArt(day, first, second) {
        return ((day + dailyIndex(0, first, 2)) & 1) === 0 ? first : second;
    }

    function menuArtPath(id) {
        return menuTileArt.has(id) ? `assets/ui/tiles/${id}.webp` : null;
    }

    function boosterRarity(multiplier) {
        if (!Number.isFinite(multiplier)) return null;
        return multiplier > 2 ? 'legendary' : boosterRarities.get(multiplier) ?? null;
    }

    function boosterToken(rarity) {
        return ['common', 'rare', 'epic', 'legendary'].includes(rarity) ? `assets/ui/boosters/scroll-${rarity}.webp` : null;
    }

    function boosterIcon(rarity) {
        const path = boosterToken(rarity);
        return path ? `<img class="lb-booster-token" src="${path}" alt="">` : '';
    }

    function backgroundMode(value) {
        return value === 'plain' || backgrounds.has(value) ? value : 'image';
    }

    function wallpaperName(theme, mode) {
        const choice = backgroundMode(mode);
        return choice === 'image' ? theme : choice;
    }

    function themeBackground(theme, mode, orientation = 'landscape') {
        const variant = orientation === 'portrait' ? 'portrait' : 'landscape';
        const wallpaper = wallpaperName(theme, mode);
        return backgrounds.has(wallpaper) ? `assets/ui/bg/${wallpaper}-${variant}.jpg` : null;
    }

    function applyThemeBackground(element, theme, mode) {
        for (const orientation of ['landscape', 'portrait']) {
            const property = `--lb-theme-art-${orientation}`;
            const path = themeBackground(theme, mode, orientation);
            if (path) element.style.setProperty(property, `url("${path}")`);
            else element.style.removeProperty(property);
        }
    }

    return { itemPart, universalPart, boosterRarity, boosterToken, boosterIcon, wallpapers, backgroundMode, themeBackground, applyThemeBackground,
        menuElements, menuArtDay, pickMenuArt, pickDailyFeatureArt, menuArtPath };
})();
