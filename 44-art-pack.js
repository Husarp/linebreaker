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
        play: [],
        missions: ['missions-outpost'],
        inventory: ['inventory-caravan'],
        achievements: ['achievements-hall', 'achievements-summit'],
        settings: ['settings-clockwork-vivid', 'settings-lighthouse'],
        stats: ['stats-archive', 'stats-archive-calm'],
    };
    const menuElements = Object.freeze(Object.keys(menuArt));
    const menuSets = menuElements.flatMap((first, index) => menuElements.slice(index + 1)
        .flatMap((second, offset) => menuElements.slice(index + offset + 2).map(third => [first, second, third])));
    const wallpaperId = name => backgrounds.has(name) ? `wallpaper-${name}` : null;
    const seenArtIds = Object.freeze([...wallpapers.map(wallpaperId), ...Object.values(menuArt).flat(), 'season-pass']);
    const knownArt = new Set(seenArtIds);

    function pickMenuArt(previous, theme, mode, random = Math.random) {
        const previousSet = menuElements.filter(key => Object.hasOwn(previous, key));
        const choices = previousSet.length === 3 ? menuSets.filter(set => !set.every(key => previousSet.includes(key))) : menuSets;
        const selected = choices[Math.floor(random() * choices.length)];
        return Object.fromEntries(selected.map(key => {
            const variants = menuArt[key];
            return [key, key === 'play' ? wallpaperId(nextWallpaper(theme, mode))
                : variants[variants.length === 1 ? 0 : Math.floor(random() * variants.length)]];
        }));
    }

    function menuArtPath(id) {
        if (id === 'season-pass') return 'assets/ui/41-season-pass-banner.webp';
        return knownArt.has(id) && !id.startsWith('wallpaper-') ? `assets/ui/tiles/${id}.webp` : null;
    }

    function cleanSeenArt(value) {
        return Array.isArray(value) ? [...new Set(value.slice(0, 2000).filter(id => knownArt.has(id)))] : [];
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

    function nextWallpaper(theme, mode) {
        return wallpapers[(wallpapers.indexOf(wallpaperName(theme, mode)) + 1) % wallpapers.length];
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

    return { itemPart, universalPart, boosterRarity, boosterToken, boosterIcon, wallpapers, wallpaperName, wallpaperId, nextWallpaper, backgroundMode, themeBackground, applyThemeBackground,
        menuElements, pickMenuArt, menuArtPath, seenArtIds, cleanSeenArt };
})();
