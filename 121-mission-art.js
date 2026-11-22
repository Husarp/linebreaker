window.LBMissionArt = (() => {
    const palettes = {
        ice: ['#568e9e', '#aedcdb'], orchid: ['#9a6baf', '#ddbae6'], jade: ['#568a64', '#a9ce8d'],
        rust: ['#ac663b', '#f1b478'], amber: ['#b17b35', '#f1cf7e'],
    };
    const pieces = {
        tee: ['111', '.1.'], long: ['1111'], square: ['11', '11'], elbow: ['..1', '111'],
        jay: ['1..', '111'], zig: ['.11', '11.'], zag: ['11.', '.11'], stack: ['..1.', '1.11', '1111'],
    };
    const glyphs = {
        lines: [
            'hhhhhhhhhhhh', 'mmmsmmmmsmmm', 'ssssssssssss', '............',
            'hhhh....hhhh', 'mmmm....mmmm', 'ssss....ssss', '............',
            'hhhhhhhhhhhh', 'mmmsmmmmsmmm', 'ssssssssssss',
        ],
        clock: [
            '.....hh.....', '.....mm.....', '...hhhhhh...', '..hmmmmmmh..', '.hmmmhhmmmh.',
            'hmmsmhhmsmmh', 'hmmmmhhmmmmh', 'hmmmmmmmmmmh', 'hmmmmmmmmmmh',
            '.smmmmmmmms.', '..smmmmmms..', '...ssssss...',
        ],
        score: [
            '....hhhh....', '..hhmmmmhh..', '.hmmmhhmmmh.', '.hmmmhhmmmh.',
            'hmmmmhhmmmmh', 'hmhhhhhhhhmh', 'hmhhhhhhhhmh', 'smmmmhhmmmms',
            '.smmmhhmmms.', '.smmmhhmmms.', '..ssmmmmss..', '....ssss....',
        ],
        combo: [
            '........hh..', '.......hhm..', '......hhm...', '.....hhm....', '....hhm.....',
            '...hhhhhhh..', '..hmmmmsmms.', '......hmms..', '.....hmms...', '....hmms....',
            '...hmms.....', '..hms.......', '.s..........',
        ],
        drop: [
            '....hhhh....', '....hmmh....', '....hmmh....', '....hmmh....', '....hmmh....',
            '..hhhhhhhh..', '...hmmmmh...', '....smms....', '.....ss.....',
            '............', '.hhhhhhhhhh.', '.ssssssssss.',
        ],
        survive: [
            '..hhh..hhh..', '.hmmhhhhmmh.', 'hmmmhmmhmmmh', 'hmmmmmmmmmmh',
            'hmmmmmmmmmmh', '.smmmmmmmms.', '..smmmmmms..', '...smmmms...',
            '....smms....', '.....ss.....',
        ],
        fun: [
            '.....hh.....', '.....hh.....', '....hmmh....', '....hmmh....', 'hhhhmmmmhhhh',
            '.hmmmmmmmmh.', '..smmhhmms..', '...hmmmmh...', '...hmmmmh...',
            '..hmssssmh..', '..ss....ss..',
        ],
        ghost: [
            '....hhhh....', '..hhmmmmhh..', '.hmmmmmmmmh.', '.hmsmmmmsmh.',
            'hmssmmmmssmh', 'hmmmmmmmmmmh', 'hmmmmmmmmmmh', 'hmmmmmmmmmmh',
            'hmmmmmmmmmmh', 'hmsmmssmmsmh', 'hs.ss..ss.sh',
        ],
        mirror: [
            '.....hh.....', '.....mm.....', '...h....h...', '..hm.hh.mh..', '.hmm.mm.mmh.',
            'hmmmm..mmmmh', 'hmmmm..mmmmh', '.smm.mm.mms.', '..sm.ss.ms..',
            '...s....s...', '.....mm.....', '.....ss.....',
        ],
        quads: [
            'hhhhh..hhhhh', 'mmmms..smmmm', 'sssss..sssss', '............',
            'hhhhh..hhhhh', 'mmmms..smmmm', 'sssss..sssss', '............',
            'hhhhh..hhhhh', 'mmmms..smmmm', 'sssss..sssss', '............',
            'hhh.h..h.hhh', 'sss.s..s.sss',
        ],
        crate: [
            '..hhhhhhhh..', '.hmmmmmmmmh.', 'hmmhhmmhhmmh', 'hmmmmmmmmmmh',
            'sssshhhhssss', 'hmmmsmmsmmmh', 'hmmmsmmsmmmh',
            'hmmmssssmmmh', 'smmmmmmmmmms', '.ssssssssss.',
        ],
        mystery: [
            '...hhhhhh...', '..hmmmmmmh..', '.hmmhhhhmmh.', '.hms....smh.',
            '........hmh.', '......hhms..', '.....hms....', '.....hs.....',
            '............', '.....hh.....', '.....ss.....',
        ],
        spin: [
            '....hhhh....', '..hhmmmmhh..', '.hmmssssmmh.', '.hms....smh.',
            'hms.........', 'hms....h....', 'hms....hh...', '.hms...hmh..',
            '.hmmssshmmh.', '..hmmmmmmmmh', '...ssssssss.', '.......s....',
        ],
        play: [
            '..hhhhhhhh..', '.hmmmmmmmmh.', 'hmmhmmmmhmmh', 'hmhhhmmhmhmh',
            'hmmhmmmmhmmh', 'hmmmmmmmmmmh', 'hmmhsssshmmh', '.ss......ss.',
        ],
    };
    const colors = {
        tee: 'orchid', long: 'ice', square: 'amber', elbow: 'rust', jay: 'ice', zig: 'jade', zag: 'rust', stack: 'jade',
        lines: 'amber', clock: 'ice', score: 'amber', combo: 'rust', drop: 'orchid', survive: 'jade', fun: 'amber',
        ghost: 'ice', mirror: 'orchid', quads: 'amber', crate: 'amber', mystery: 'orchid', spin: 'ice', play: 'jade',
    };
    const metrics = {
        blocksPlaced: 'stack', bottomTwoRows: 'stack', bottomQuarter: 'stack', flatEarth: 'stack', monochrome: 'square',
        linesCleared: 'lines', doubles: 'lines', triples: 'lines', perfectClear: 'lines', minimalist: 'lines', hatTrick: 'lines',
        quads: 'quads', quadStreak: 'quads', ghostLines: 'ghost', mirrorLines: 'mirror',
        score: 'score', rawXP: 'score', totalXP: 'score', gameTime: 'clock', speedRun: 'clock',
        maxSpeed: 'clock', gamesReachedSpeed2: 'clock', gamesReachedSpeed3: 'clock', gamesReachedSpeed4: 'clock', speedQueen: 'clock',
        gamesPlayed: 'play', funRuns: 'fun', narrowEscape: 'survive', comebackKid: 'survive',
        hardDrops: 'drop', noSoftDrop: 'drop', rotations: 'spin', maxCombo: 'combo', gamesWithCombo4: 'combo',
        tSpins: 'tee', iFloor: 'long', niceBonus: 'crate', doubleCompletion: 'crate',
    };

    function piecePixels(name) {
        const shape = pieces[name];
        const block = name === 'square' ? ['smms', 'mhhm', 'mhhm', 'smms']
            : shape[0].length === 4 ? ['hhh', 'sms', 'sss'] : ['hhhh', 'hmmh', 'smms', 'ssss'];
        const empty = '.'.repeat(block.length);
        return shape.flatMap(row => block.map(shading => [...row].map(cell => cell === '1' ? shading : empty).join('')));
    }

    function draw(name, color) {
        const pattern = pieces[name] ? piecePixels(name) : glyphs[name];
        const left = Math.floor((16 - pattern[0].length) / 2);
        const top = Math.floor((16 - pattern.length) / 2);
        const pixels = new Map();
        for (const [row, line] of pattern.entries()) {
            for (const [column, tone] of [...line].entries()) {
                if (tone !== '.') pixels.set(`${left + column},${top + row}`, tone);
            }
        }
        const paths = { s: new Set(), m: new Set(), h: new Set() };
        const cell = (column, row) => `M${column} ${row}h1v1h-1z`;
        for (const [position, tone] of pixels) {
            const [column, row] = position.split(',').map(Number);
            paths[tone].add(cell(column, row));
            for (const [across, down] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
                const x = column + across;
                const y = row + down;
                if (!pixels.has(`${x},${y}`)) paths.s.add(cell(x, y));
            }
        }
        const [mid, light] = palettes[color];
        const fills = { s: 'var(--mq-patch-outline, #17231d)', m: mid, h: light };
        const art = Object.entries(paths).map(([tone, cells]) => `<path fill="${fills[tone]}" d="${[...cells].join('')}"/>`).join('');
        return `<svg class="mq-patch" data-patch="${name}" viewBox="0 0 16 16" width="32" height="32" shape-rendering="crispEdges" aria-hidden="true">${art}</svg>`;
    }

    const icons = Object.fromEntries(Object.entries(colors).map(([name, color]) => [name, draw(name, color)]));
    return {
        icons: Object.freeze(icons),
        forMetric: (metric, concealed = false) => icons[concealed ? 'mystery' : Object.hasOwn(metrics, metric) ? metrics[metric] : 'stack'],
    };
})();
