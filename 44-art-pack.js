window.LBArtPack = (() => {
    const universalPart = 'assets/ui/parts/universal-part-128.png';
    const boosterTokens = {
        '1.25x_game': 'common-1.25x',
        '1.5x_game': 'rare-1.5x',
        '2xp_game': 'epic-2x',
    };
    const backgrounds = new Set([
        'default', 'ocean', 'forest', 'fire', 'dragon', 'void', 'sunset', 'arctic', 'midnight', 'sakura',
    ]);
    const wallpapers = Object.freeze([...backgrounds]);

    function boosterToken(key) {
        return Object.hasOwn(boosterTokens, key) ? `assets/ui/boosters/${boosterTokens[key]}.png` : null;
    }

    function boosterIcon(key) {
        const path = boosterToken(key);
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

    return { universalPart, boosterToken, boosterIcon, wallpapers, nextWallpaper, backgroundMode, themeBackground, applyThemeBackground };
})();
