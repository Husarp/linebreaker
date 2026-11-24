window.LBMissionArt = (() => {
    const metrics = {
        score: 'score', linesCleared: 'lines', doubles: 'lines', triples: 'lines',
        minimalist: 'lines', hatTrick: 'lines', quads: 'quads', quadStreak: 'quads',
        maxCombo: 'chain', gamesWithCombo4: 'chain', rotations: 'spin', tSpins: 'spin',
        hardDrops: 'harddrop', noSoftDrop: 'harddrop', blocksPlaced: 'stack',
        bottomTwoRows: 'stack', bottomQuarter: 'stack', flatEarth: 'stack',
        monochrome: 'stack', iFloor: 'stack', perfectClear: 'target',
        gameTime: 'survive', narrowEscape: 'survive', comebackKid: 'survive', speedRun: 'clock',
        maxSpeed: 'lightning', gamesReachedSpeed2: 'lightning', gamesReachedSpeed3: 'lightning',
        gamesReachedSpeed4: 'lightning', speedQueen: 'lightning', rawXP: 'spark', totalXP: 'spark',
        ghostLines: 'shield', mirrorLines: 'lines', gamesPlayed: 'games', funRuns: 'games',
        niceBonus: 'list', doubleCompletion: 'list',
    };
    return Object.freeze({
        forMetric: (metric, concealed = false) => `assets/ui/achievements/ach-${
            concealed ? 'list' : Object.hasOwn(metrics, metric) ? metrics[metric] : 'stack'}.webp`,
    });
})();
