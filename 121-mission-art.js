window.LBMissionArt = (() => {
    const missionIcons = {
        singles: 'single', minimalist: 'single', doubles: 'double', triples: 'triple',
        quads: 'quad', quadStreak: 'quad',
        maxSpeed: 'speed', speedRun: 'speed', speedQueen: 'speed',
        gamesReachedSpeed2: 'speed', gamesReachedSpeed3: 'speed', gamesReachedSpeed4: 'speed',
        bottomTwoRows: 'bottom', bottomQuarter: 'bottom', iFloor: 'bottom',
        maxCombo: 'combo', gamesWithCombo4: 'combo', hatTrick: 'combo',
        rawXP: 'rawxp', totalXP: 'totalxp', perfectClear: 'perfect',
        flatEarth: 'flat', monochrome: 'same', noSoftDrop: 'nosoft',
    };
    const sharedIcons = {
        score: 'score', linesCleared: 'lines', rotations: 'spin', tSpins: 'spin',
        hardDrops: 'harddrop', blocksPlaced: 'stack', gameTime: 'survive',
        narrowEscape: 'survive', comebackKid: 'survive', ghostLines: 'shield',
        mirrorLines: 'lines', gamesPlayed: 'games', funRuns: 'games',
        niceBonus: 'list', doubleCompletion: 'list',
    };
    return Object.freeze({
        forMetric(metric, concealed = false) {
            const icon = concealed ? 'ach-list' : Object.hasOwn(missionIcons, metric)
                ? 'mission-' + missionIcons[metric]
                : 'ach-' + (Object.hasOwn(sharedIcons, metric) ? sharedIcons[metric] : 'stack');
            return 'assets/ui/achievements/' + icon + '.webp';
        },
    });
})();
