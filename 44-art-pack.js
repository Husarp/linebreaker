window.LBArtPack = (() => {
    const boosterTokens = {
        '1.25x_game': 'common-1.25x',
        '1.5x_game': 'rare-1.5x',
        '2xp_game': 'epic-2x',
    };
    const backgrounds = { ocean: 'ocean', sakura: 'sakura', void: 'void', fire: 'forge' };

    function boosterToken(key) {
        return Object.hasOwn(boosterTokens, key) ? `assets/ui/boosters/${boosterTokens[key]}.png` : null;
    }

    function boosterIcon(key) {
        const path = boosterToken(key);
        return path ? `<img class="lb-booster-token" src="${path}" alt="">` : '';
    }

    function backgroundMode(value) {
        return value === 'plain' ? 'plain' : 'image';
    }

    function themeBackground(theme, mode) {
        return backgroundMode(mode) === 'image' && Object.hasOwn(backgrounds, theme)
            ? `assets/ui/bg/${backgrounds[theme]}.jpg` : null;
    }

    function applyThemeBackground(element, theme, mode) {
        const path = themeBackground(theme, mode);
        if (path) element.style.setProperty('--lb-theme-art', `url("${path}")`);
        else element.style.removeProperty('--lb-theme-art');
    }

    return { boosterToken, boosterIcon, backgroundMode, themeBackground, applyThemeBackground };
})();
