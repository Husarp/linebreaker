(function() {

    const _visualReview = window.__LB_TEST__ === true && window.__LB_VISUAL_REVIEW__ === true;
    const _devMode = (() => {
        if (_visualReview || new URLSearchParams(window.location.search).has('dev')) return true;
        try { return localStorage.getItem('lb_dev') === '1'; } catch(e) { return false; }
    })();
    const _testSkins = ['bubble','gameboy','monochrome','modern','candy','vim','aerolab','classic','window'];
    const SKIN_NAMES = { neon:'Neon', retro:'Retro', glass:'Glass', shadow:'Shadow', outline:'Outline', holo:'Holo', journey:'Journey', gem:'Gem', bubble:'Bubble (test)', gameboy:'Gameboy (test)', monochrome:'Monochrome (test)', modern:'Modern (test)', candy:'Candy (test)', vim:'Vim (test)', aerolab:'Aerolab (test)', classic:'Classic (test)', window:'Window (test)' };
    function _skinAvailable(key) { return _devMode || !_testSkins.includes(key); }
    function _renderSkin() { return _skinAvailable(settings.skin) ? (settings.skin || 'neon') : 'neon'; }
    const _devPanel = document.getElementById('dev-panel');
    if (_devPanel && _devMode) _devPanel.style.display = 'flex';

    const _hasFileAPI = 'showOpenFilePicker' in window; // false on Firefox/Safari

    const COLORS=[null,'#00ffff','#3388ff','#ff9900','#ffff33','#33ff33','#cc33ff','#ff3366'];

    const BLOCK_PALETTES = {
        classic:    { name: 'Classic',    free: true, colors: ['#00ffff','#3388ff','#ff9900','#ffff33','#33ff33','#cc33ff','#ff3366'] },
        greyscale:  { name: 'Greyscale',  colors: ['#dddddd','#bbbbbb','#999999','#777777','#555555','#aaaaaa','#cccccc'] },
        ice:        { name: 'Ice',        colors: ['#E0FFFF','#B0E0E6','#87CEEB','#ADD8E6','#00CED1','#AFEEEE','#5F9EA0'] },
        pastel:     { name: 'Pastel',     colors: ['#FFB3BA','#BAFFC9','#BAE1FF','#FFFFBA','#E8BAFF','#FFD9BA','#C9BAFF'] },
        dark:       { name: 'Dark',       colors: ['#2d4059','#4a1942','#6b0848','#1b2a49','#1e3a5f','#3d0c02','#0b3d0b'] },
        synthwave:  { name: 'Synthwave',  colors: ['#ff71ce','#01cdfe','#05ffa1','#b967ff','#fffb96','#ff3864','#2de2e6'] },
        earth:      { name: 'Earth',      colors: ['#8B4513','#556B2F','#DAA520','#CD853F','#808000','#A0522D','#6B8E23'] },
        neon:       { name: 'Neon',       colors: ['#00fff2','#ff00ff','#ffff00','#00ff00','#ff3300','#ff6600','#3399ff'] },
    };

    function _applyColorPalette(name) {
        // Custom picker palette
        if (name === '_custom_picker' && saveData.customPickerColors) {
            for (let i = 0; i < 7; i++) COLORS[i + 1] = saveData.customPickerColors[i] || '#ffffff';
            return;
        }
        // Check custom palette overrides first (edited palettes)
        if (saveData.customPaletteOverrides?.[name]) {
            const ov = saveData.customPaletteOverrides[name];
            for (let i = 0; i < 7; i++) COLORS[i + 1] = ov[i] || '#ffffff';
            return;
        }
        const pal = BLOCK_PALETTES[name] || BLOCK_PALETTES.classic;
        for (let i = 0; i < 7; i++) COLORS[i + 1] = pal.colors[i];
    }

    // --- HSL/HEX conversion helpers for shade generation ---
    function _hexToHSL(hex) {
        let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
        const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
        let h = 0, s = 0, l = (max + min) / 2;
        if (d > 0) {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        return [h * 360, s * 100, l * 100];
    }
    function _hslToHex(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) { r = g = b = l; } else {
            const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
        }
        const toHex = x => { const h = Math.round(x * 255).toString(16); return h.length === 1 ? '0' + h : h; };
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }
    function _generateShades(hexColor, count) {
        const [h, s] = _hexToHSL(hexColor);
        const shades = [];
        for (let i = 0; i < count; i++) {
            const l = 30 + (50 / (count - 1)) * i; // 30% to 80%
            shades.push(_hslToHex(h, s, l));
        }
        return shades;
    }

    function lightenHex(hex, amt) {
        if (!hex || hex[0] !== '#' || hex.length < 7) return '#ffffff';
        const r = Math.min(255, parseInt(hex.slice(1,3),16) + amt);
        const g = Math.min(255, parseInt(hex.slice(3,5),16) + amt);
        const b = Math.min(255, parseInt(hex.slice(5,7),16) + amt);
        return `rgb(${r},${g},${b})`;
    }
    const BASE_PIECES=[null,[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],[[1,0,0],[1,1,1],[0,0,0]],[[0,0,1],[1,1,1],[0,0,0]],[[1,1],[1,1]],[[0,1,1],[1,1,0],[0,0,0]],[[0,1,0],[1,1,1],[0,0,0]],[[1,1,0],[0,1,1],[0,0,0]]];

    const bgCanvas = document.getElementById('bg-canvas');
    const bgCtx = bgCanvas.getContext('2d');
    let bgBlocks =[];
    
    function resizeBg() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
    window.addEventListener('resize', () => {
        resizeBg();
        if (settings?.gameScale) applyGameScale(settings.gameScale);
    });
    resizeBg();

    const BG_STYLES = {
        default:    { count: 8,  sizeMin:25, sizeMax:45, speedMin:0.5, speedMax:2.0, glow:false, alpha:0.5 },
        medium:     { count: 16, sizeMin:20, sizeMax:42, speedMin:1.0, speedMax:3.0, glow:false, alpha:0.52 },
        heavy_rain: { count: 28, sizeMin:15, sizeMax:38, speedMin:1.5, speedMax:4.5, glow:false, alpha:0.55 },
    };

    class BgBlock {
        constructor(style) { this.style = style || BG_STYLES.default; this.reset(true); }
        reset(randomY = false) {
            this.sprite = null;
            this.shape = BASE_PIECES[Math.floor(Math.random() * 7) + 1];
            this.color = COLORS[Math.floor(Math.random() * 7) + 1];
            this.skin = ['glass','shadow','retro','neon'][Math.floor(Math.random() * 4)];
            this.size = Math.random() * (this.style.sizeMax - this.style.sizeMin) + this.style.sizeMin;
            const margin = this.size * 2;
            this.x = Math.random() * (bgCanvas.width - margin * 2) + margin;
            this.y = randomY ? Math.random() * bgCanvas.height : -this.size * 4;
            this.vy = Math.random() * (this.style.speedMax - this.style.speedMin) + this.style.speedMin;
            this.rot = Math.random() * Math.PI * 2;
            this.vRot = (Math.random() - 0.5) * 0.025;
        }
        update(dt=1000/60) {
            const f=dt*60/1000;
            this.y += this.vy*f; this.rot += this.vRot*f;
            if (this.y > bgCanvas.height + this.size * 4) this.reset();
        }
        draw() {
            if (!this.sprite) {
                this.sprite=document.createElement('canvas');
                this.sprite.width=this.sprite.height=Math.ceil(this.size*4+48);
                const c=this.sprite.getContext('2d');
                c.translate(this.sprite.width/2,this.sprite.height/2);
                this._paint(c);
            }
            bgCtx.save();bgCtx.translate(this.x,this.y);bgCtx.rotate(this.rot);
            bgCtx.drawImage(this.sprite,-this.sprite.width/2,-this.sprite.height/2);bgCtx.restore();
        }
        _paint(paintCtx) {
            paintCtx.save();
            paintCtx.globalAlpha = this.style.alpha;
            const offset = (this.shape.length * this.size) / 2;
            const s = this.size, col = this.color, sk = this.skin || 'neon';
            for (let r = 0; r < this.shape.length; r++) {
                for (let c = 0; c < this.shape[r].length; c++) {
                    if (this.shape[r][c]) {
                        const cx = c * s - offset, cy = r * s - offset;
                        if (sk === 'retro') {
                            paintCtx.fillStyle = col; paintCtx.fillRect(cx+1, cy+1, s-2, s-2);
                            paintCtx.fillStyle = 'rgba(255,255,255,0.55)'; paintCtx.fillRect(cx+1, cy+1, s-2, 2); paintCtx.fillRect(cx+1, cy+1, 2, s-2);
                            paintCtx.fillStyle = 'rgba(0,0,0,0.45)'; paintCtx.fillRect(cx+1, cy+s-3, s-2, 2); paintCtx.fillRect(cx+s-3, cy+1, 2, s-2);
                        } else if (sk === 'glass') {
                            paintCtx.save(); paintCtx.globalAlpha = this.style.alpha * 0.35; paintCtx.fillStyle = col; paintCtx.fillRect(cx, cy, s-1, s-1); paintCtx.restore();
                            paintCtx.strokeStyle = col; paintCtx.lineWidth = 1.5; paintCtx.strokeRect(cx+0.5, cy+0.5, s-2, s-2);
                        } else if (sk === 'shadow') {
                            paintCtx.fillStyle = 'rgba(20,20,30,0.96)'; paintCtx.fillRect(cx+1, cy+1, s-2, s-2);
                            paintCtx.strokeStyle = col; paintCtx.lineWidth = 1.5; paintCtx.shadowColor = col; paintCtx.shadowBlur = 6;
                            paintCtx.strokeRect(cx+2, cy+2, s-4, s-4); paintCtx.shadowBlur = 0;
                        } else {
                            paintCtx.fillStyle = col; paintCtx.fillRect(cx, cy, s-1, s-1);
                            paintCtx.fillStyle = 'rgba(0,0,0,0.4)'; paintCtx.fillRect(cx+s*0.2, cy+s*0.2, s*0.6, s*0.6);
                        }
                    }
                }
            }
            paintCtx.restore();
        }
    }

    function _rebuildBgBlocks() {
        const v = settings && settings.heavyBg ? parseInt(settings.heavyBg) : 1;
        const style = v >= 3 ? BG_STYLES.heavy_rain : v >= 2 ? BG_STYLES.medium : BG_STYLES.default;
        bgBlocks = [];
        for (let i = 0; i < style.count; i++) bgBlocks.push(new BgBlock(style));
    }
    // Initialize background with default style at startup (settings not yet loaded)
    { const _s = BG_STYLES.default; for (let i = 0; i < _s.count; i++) bgBlocks.push(new BgBlock(_s)); }
    // --- SPECIAL PARACHUTE BLOCK (color-changing, clickable for +1 part) ---
    let _specialBlock = null;
    let _specialBlockLastSpawn = 0;

    function _spawnSpecialBlock() {
        if (_specialBlock) return;
        _specialBlockLastSpawn = Date.now();
        const style = BG_STYLES.default;
        _specialBlock = {
            shape: BASE_PIECES[Math.floor(Math.random() * 7) + 1],
            size: 32,
            x: Math.random() * (bgCanvas.width - 200) + 100,
            y: -130,
            vy: 0.8,
            rot: 0,
            vRot: (Math.random() - 0.5) * 0.015,
            _colorPhase: 0,
        };
    }

    function _updateSpecialBlock(dt=1000/60) {
        if (!_specialBlock) return;
        const b = _specialBlock;
        const f=dt*60/1000;
        b.y += b.vy*f;
        b.rot += b.vRot*f;
        b._colorPhase += 0.03*f;
        // Remove if off screen
        if (b.y > bgCanvas.height + b.size * 4) {
            _specialBlock = null;
            return;
        }
        // Remove if menu hidden
        const menuEl = document.getElementById('menu-overlay');
        if (menuEl && menuEl.classList.contains('hidden')) { _specialBlock = null; return; }
    }

    function _drawSpecialBlock() {
        if (!_specialBlock) return;
        const b = _specialBlock;
        const phase = b._colorPhase;
        // Cycle through colors smoothly
        const r = Math.round(128 + 127 * Math.sin(phase));
        const g = Math.round(128 + 127 * Math.sin(phase + 2.1));
        const bl = Math.round(128 + 127 * Math.sin(phase + 4.2));
        const col = `rgb(${r},${g},${bl})`;

        bgCtx.save();
        bgCtx.translate(b.x, b.y);
        bgCtx.rotate(b.rot);
        bgCtx.globalAlpha = 0.65;
        const offset = (b.shape.length * b.size) / 2;
        bgCtx.shadowColor = col;
        bgCtx.shadowBlur = 14;
        for (let row = 0; row < b.shape.length; row++) {
            for (let c = 0; c < b.shape[row].length; c++) {
                if (b.shape[row][c]) {
                    // Same style as regular bg blocks
                    bgCtx.fillStyle = col;
                    bgCtx.fillRect(c * b.size - offset, row * b.size - offset, b.size - 1, b.size - 1);
                    bgCtx.fillStyle = 'rgba(0,0,0,0.4)';
                    bgCtx.fillRect(c * b.size - offset + b.size * 0.2, row * b.size - offset + b.size * 0.2, b.size * 0.6, b.size * 0.6);
                }
            }
        }
        bgCtx.restore();
    }

    function _isClickOnSpecialBlock(clientX, clientY) {
        if (!_specialBlock) return false;
        const b = _specialBlock;
        const dx = clientX - b.x, dy = clientY - b.y;
        const hitR = b.size * 2.5;
        return dx * dx + dy * dy < hitR * hitR;
    }

    document.addEventListener('click', (e) => {
        if (!_specialBlock) return;
        const menuEl = document.getElementById('menu-overlay');
        if (!menuEl || menuEl.classList.contains('hidden')) return;
        if (_isClickOnSpecialBlock(e.clientX, e.clientY)) {
            const b = _specialBlock;
            _specialBlock = null;
            saveData.stats.parachuteDropsCaught = (saveData.stats.parachuteDropsCaught || 0) + 1;
            if (!saveData.achievements?.['parachute_catcher']?.unlocked) unlockAchievement('parachute_catcher');
            playSFX('gift');

            // Determine reward: normal part for random item (95%), universal part (5%), or XP if all owned
            let rewardText, rewardColor;
            const _items = _getAllPartsItems();
            if (_items.length === 0) {
                // All items owned → give XP
                const xpGain = 1000;
                _grantXP(xpGain);
                rewardText = `+${xpGain.toLocaleString()} XP`;
                rewardColor = '#44ffaa';
            } else if (Math.random() < 0.05) {
                // 5% chance: universal part
                addUniversalParts(1);
                rewardText = `+1 Universal Part`;
                rewardColor = '#ffd700';
            } else {
                // 95% chance: normal part for a random item
                const _rItem = _items[Math.floor(Math.random() * _items.length)];
                if (!saveData.parts) saveData.parts = {};
                saveData.parts[_rItem.key] = (saveData.parts[_rItem.key] || 0) + 1;
                const _iName = _rItem.key === 'ghostColor' ? 'Colored Ghost' : _rItem.key.charAt(0).toUpperCase() + _rItem.key.slice(1);
                rewardText = `+1 Part: ${_iName}`;
                rewardColor = '#4499ff';
            }

            checkProgressAchievements();
            saveDataToFile();
            drawRankBadge();

            // Floating text — modern style, stays longer
            const flyEl = document.createElement('div');
            flyEl.innerHTML = `<div style="font-size:0.85rem;font-weight:bold;color:${rewardColor};text-shadow:0 0 10px ${rewardColor}66;letter-spacing:0.5px;">${rewardText}</div><div style="font-size:0.6rem;color:rgba(255,255,255,0.5);margin-top:2px;">Airdrop caught!</div>`;
            flyEl.style.cssText = `position:fixed;left:${b.x}px;top:${b.y}px;transform:translateX(-50%);z-index:2600;pointer-events:none;text-align:center;background:rgba(0,0,0,0.7);padding:6px 14px;border-radius:8px;border:1px solid ${rewardColor}44;transition:all 2s ease-out;opacity:1;`;
            document.body.appendChild(flyEl);
            requestAnimationFrame(() => { flyEl.style.top = (b.y - 80) + 'px'; flyEl.style.opacity = '0'; });
            setTimeout(() => flyEl.remove(), 2400);
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (_specialBlock && _isClickOnSpecialBlock(e.clientX, e.clientY)) {
            document.body.style.cursor = 'pointer';
        } else if (document.body.style.cursor === 'pointer') {
            document.body.style.cursor = '';
        }
    });

    let _bgFrame = null, _bgTime = null;
    const _bgApp = document.getElementById('app');
    function _bgVisible() { return !document.hidden && !_bgApp.classList.contains('active-game'); }
    function bgLoop(now) {
        _bgFrame = null;
        if (!_bgVisible()) { _bgTime = null; return; }
        const dt = _bgTime === null ? 0 : Math.min(100, now - _bgTime);
        _bgTime = now;
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        bgBlocks.forEach(b => { b.update(dt); b.draw(); });
        _updateSpecialBlock(dt);
        _drawSpecialBlock();
        _bgFrame = requestAnimationFrame(bgLoop);
    }
    function _syncBgLoop() {
        if (!_bgVisible()) {
            if (_bgFrame !== null) cancelAnimationFrame(_bgFrame);
            _bgFrame = null; _bgTime = null;
        } else if (_bgFrame === null) _bgFrame = requestAnimationFrame(bgLoop);
    }
    new MutationObserver(_syncBgLoop).observe(_bgApp, { attributes:true, attributeFilter:['class'] });
    document.addEventListener('visibilitychange', _syncBgLoop);
    _syncBgLoop();

    const _SPLASH_QUOTES = [
        "100% gravity!",
        "Now with more tetrominoes!",
        "XP not included.",
        "Ask your doctor about T-spins!",
        "The I-piece will come. Eventually.",
        "One more game.",
        "Combo breaker!",
        "Better than nothing!",
        "Blocks fall down!",
        "No microtransactions!",
        "7-bag freshness!",
        "Level up or go home!",
        "Warning: Free!",
        "S-piece is perfectly balanced.",
        "Line clear ASMR!",
        "Works offline!",
        "Your skills may vary.",
        "Now RPG flavored!",
        "High scores not guaranteed.",
        "Just one more line!",
        "I-piece speedrun any%",
        "B is for blocks!",
        "Built with vanilla JS!",
        "No floating point errors!",
        "Rotation not included.",
        "Achievement unlocked: Playing!",
        // new quotes — game-related puns & references
        "Dropping in for a quick one.",
        "I before V except after X.",
        "Have you tried rotating the S-piece?",
        "Stack overflow detected.",
        "Clearing lines, taking names.",
        "No Z-piece, no problem.",
        "Gravity is the only law here.",
        "Touch grass? Later. One more quad.",
        "The L-piece is not a personal attack.",
        "Block stacking: the original block party.",
        "Pro tip: blocks go down.",
        "I-piece ETA: 14 pieces.",
        "Chat: place it left. Place it left!",
        "Line pieces are just shy.",
        "Speedrun? In this economy?",
        "Nothing a T-spin won't fix.",
        "Block by block.",
        "RNG certified organic.",
        "Certified Hood Classic.",
        "Your combos are showing.",
        "Skill issue? Nah. Piece issue.",
        "Hard drop is self-care.",
        "Every quad is personal.",
        "The wall kick will remember that.",
        "Game over is just a reset button.",
        "Stacking anxieties... and blocks.",
        "Going for the quad? Bold.",
        "Board full? That's a skill.",
        "Silver I unlocks the ghost. Spooky.",
        "Aim for the top 10. Or top 1.",
        "Block stacking taught me to let things go.",
        "No undo. No mercy. Only blocks.",
        "T-spin detected. Legend behavior.",
        "This app has no ads. Just blocks.",
        "Stack responsibly.",
        "One does not simply clear four lines.",
        "4 lines at once? Absolute madness.",
        "Ghost mode: optional. Suffering: not.",
        "Rotate. Stack. Repeat.",
        "The perfect quad? It exists.",
        "Hard drop go brrr.",
        "Floor kicks are legal here.",
        "Mirror mode: for true mastery only.",
        "You deserve the 7-bag.",
        "Sometimes the S-piece cooperates.",
        "DAS and ARR are life skills.",
        "Surgeon mode: singles only.",
        "The I-piece: always late.",
        "Stack high, stack proud.",
        "Scoring XP since the first drop.",
        "Block wizard detected.",
        "Spinning into the meta.",
        "Peak human performance.",
        "Legend doesn't happen overnight.",
        "Keep your stack flat. Mostly.",
        "Lucky day!",
        "Keep an eye on the falling blocks...",
        "Not every block is what it seems.",
        "Have you tried clicking around?",
        "Some things hide in plain sight.",
    ];
    const _SPLASH_COLORS = ['#ffff55', '#55ffff', '#ff77ff', '#88ff88', '#ffaa44', '#aaaaff'];
    { const _sq = document.getElementById('splash-quote'); if (_sq) { const _d = new Date(); const _daySeed = _d.getFullYear() * 10000 + (_d.getMonth()+1) * 100 + _d.getDate(); const _qi = _daySeed % _SPLASH_QUOTES.length; const _ci = _daySeed % _SPLASH_COLORS.length; _sq.textContent = _SPLASH_QUOTES[_qi]; _sq.style.color = _SPLASH_COLORS[_ci]; if (_SPLASH_QUOTES[_qi] === 'Lucky day!') { setTimeout(() => { if (!saveData.achievements?.['lucky_day']?.unlocked) { unlockAchievement('lucky_day'); saveDataToFile(); } }, 500); } } }

    const titleEl = document.getElementById('main-title');
    const titleText = titleEl.innerText;
    titleEl.innerHTML = '';
    const titleSpans =[];
    for (let char of titleText) {
        if (char === ' ') { titleEl.appendChild(document.createTextNode(' ')); } 
        else {
            const span = document.createElement('span'); span.innerText = char;
            span.style.color = 'var(--primary)'; span.style.textShadow = '0 0 15px var(--primary)';
            titleEl.appendChild(span); titleSpans.push(span);
        }
    }
    setInterval(() => {
        titleSpans.forEach(span => {
            if (Math.random() > 0.8) {
                const colorId = Math.floor(Math.random() * 7) + 1;
                const col = COLORS[colorId];
                span.style.color = col; span.style.textShadow = `0 0 15px ${col}`;
            }
        });
    }, 3000);
    // logo_click achievement + visual effects
    let _logoClickCooldown = 0;
    let _logoAnimIdx = 0;
    const _logoFonts = ["'Orbitron'","'Press Start 2P'","'Audiowide'","'Russo One'","'VT323'","'Teko'","Impact","'Bebas Neue'","'Chakra Petch'"];
    function _logoReset() {
        titleSpans.forEach(s => {
            s.style.transition = '';
            s.style.transform = '';
            s.style.fontFamily = '';
            s.style.fontSize = '';
            s.style.display = '';
            s.style.opacity = '';
            // Don't reset color — let the ambient color interval handle it
        });
    }
    titleEl.addEventListener('click', () => {
        const _now = Date.now();
        if (_now - _logoClickCooldown < 2000) return;
        _logoClickCooldown = _now;
        _logoAnimIdx = (_logoAnimIdx + 1) % 6;
        // Track seen animations for Curious badge
        if (!saveData.stats.seenTitleAnims) saveData.stats.seenTitleAnims = [];
        if (!saveData.stats.seenTitleAnims.includes(_logoAnimIdx)) {
            saveData.stats.seenTitleAnims.push(_logoAnimIdx);
            saveDataToFile();
        }
        if (!saveData.achievements?.['logo_click']?.unlocked && saveData.stats.seenTitleAnims.length >= 6) {
            unlockAchievement('logo_click'); saveDataToFile();
        }

        if (_logoAnimIdx === 0) {
            // 1: Rainbow wave pop — letters jump up one by one, each with different color + scale
            titleSpans.forEach((s, i) => {
                const c = COLORS[(i % 7) + 1];
                setTimeout(() => {
                    s.style.transition = 'transform 0.2s cubic-bezier(.34,1.56,.64,1), color 0.1s, text-shadow 0.1s';
                    s.style.color = c;
                    s.style.textShadow = `0 0 20px ${c}, 0 0 40px ${c}`;
                    s.style.transform = 'translateY(-16px) scale(1.35)';
                    setTimeout(() => {
                        s.style.transition = 'transform 0.35s cubic-bezier(.34,1.56,.64,1)';
                        s.style.transform = 'translateY(0) scale(1)';
                    }, 200);
                }, i * 65);
            });
            setTimeout(_logoReset, titleSpans.length * 65 + 600);

        } else if (_logoAnimIdx === 1) {
            // 2: Explosion — letters fly outward in random directions, shrink to 0, then snap back
            titleSpans.forEach((s, i) => {
                const c = COLORS[(i % 7) + 1];
                const rx = (Math.random() - 0.5) * 120;
                const ry = (Math.random() - 0.5) * 80;
                const rr = (Math.random() - 0.5) * 360;
                s.style.transition = 'transform 0.4s cubic-bezier(.25,.8,.25,1), color 0.1s, text-shadow 0.1s, opacity 0.3s';
                s.style.color = c;
                s.style.textShadow = `0 0 25px ${c}`;
                s.style.transform = `translate(${rx}px,${ry}px) rotate(${rr}deg) scale(0)`;
                s.style.opacity = '0';
            });
            setTimeout(() => {
                titleSpans.forEach(s => {
                    s.style.transition = 'transform 0.5s cubic-bezier(.34,1.56,.64,1), opacity 0.2s';
                    s.style.transform = 'translate(0,0) rotate(0) scale(1)';
                    s.style.opacity = '1';
                });
            }, 450);
            setTimeout(_logoReset, 1100);

        } else if (_logoAnimIdx === 2) {
            // 3: Font roulette — letters rapidly cycle through random fonts, colors, sizes
            const _dur = 600, _interval = 50;
            let _frame = 0;
            const _timer = setInterval(() => {
                _frame++;
                titleSpans.forEach((s, i) => {
                    const f = _logoFonts[Math.floor(Math.random() * _logoFonts.length)];
                    const c = COLORS[Math.floor(Math.random() * 7) + 1];
                    const sc = 0.8 + Math.random() * 0.5;
                    const oy = (Math.random() - 0.5) * 10;
                    s.style.transition = 'none';
                    s.style.fontFamily = f;
                    s.style.color = c;
                    s.style.textShadow = `0 0 12px ${c}`;
                    s.style.transform = `translateY(${oy}px) scale(${sc})`;
                });
                if (_frame * _interval >= _dur) {
                    clearInterval(_timer);
                    titleSpans.forEach(s => {
                        s.style.transition = 'transform 0.3s ease';
                        s.style.transform = 'translateY(0) scale(1)';
                        s.style.fontFamily = '';
                    });
                    setTimeout(_logoReset, 400);
                }
            }, _interval);

        } else if (_logoAnimIdx === 3) {
            // 4: Slam down — letters grow huge, slam down, bounce, shake the whole title
            titleSpans.forEach((s, i) => {
                s.style.transition = 'none';
                s.style.transform = 'translateY(-40px) scale(2)';
                s.style.opacity = '0';
            });
            setTimeout(() => {
                titleSpans.forEach((s, i) => {
                    const c = COLORS[(i % 7) + 1];
                    setTimeout(() => {
                        s.style.transition = 'transform 0.15s ease-in, opacity 0.1s, color 0.1s, text-shadow 0.1s';
                        s.style.color = c;
                        s.style.textShadow = `0 0 20px ${c}`;
                        s.style.transform = 'translateY(6px) scale(1.1)';
                        s.style.opacity = '1';
                        setTimeout(() => {
                            s.style.transition = 'transform 0.3s cubic-bezier(.34,1.56,.64,1)';
                            s.style.transform = 'translateY(0) scale(1)';
                        }, 100);
                    }, i * 40);
                });
            }, 50);
            setTimeout(() => {
                titleEl.style.animation = 'none'; void titleEl.offsetWidth;
                titleEl.style.animation = 'titleShake 0.4s ease';
                setTimeout(() => { titleEl.style.animation = ''; }, 400);
            }, titleSpans.length * 40 + 100);
            setTimeout(_logoReset, titleSpans.length * 40 + 700);

        } else if (_logoAnimIdx === 4) {
            // 5: Spin scatter — letters rotate out, spread apart, snap back
            const _midIdx = (titleSpans.length - 1) / 2;
            titleSpans.forEach((s, i) => {
                s.style.transition = 'transform 0.35s cubic-bezier(.25,.8,.25,1), color 0.15s, text-shadow 0.15s';
                const spread = (i - _midIdx) * 14;
                const rot = (i - _midIdx) * 25;
                const c = COLORS[(i % 7) + 1];
                s.style.color = c;
                s.style.textShadow = `0 0 18px ${c}`;
                s.style.transform = `translateX(${spread}px) rotate(${rot}deg) scale(1.2)`;
            });
            setTimeout(() => {
                titleSpans.forEach(s => {
                    s.style.transition = 'transform 0.45s cubic-bezier(.34,1.56,.64,1)';
                    s.style.transform = 'translateX(0) rotate(0) scale(1)';
                });
            }, 400);
            setTimeout(_logoReset, 1000);

        } else {
            // 6: Glitch — letters jitter with random offsets, colors, sizes rapidly, then snap back
            const _dur = 500, _interval = 40;
            let _frame = 0;
            const _timer = setInterval(() => {
                _frame++;
                titleSpans.forEach((s, i) => {
                    const ox = (Math.random() - 0.5) * 16;
                    const oy = (Math.random() - 0.5) * 16;
                    const rot = (Math.random() - 0.5) * 20;
                    const sc = 0.7 + Math.random() * 0.7;
                    const c = COLORS[Math.floor(Math.random() * 7) + 1];
                    s.style.transition = 'none';
                    s.style.transform = `translate(${ox}px,${oy}px) rotate(${rot}deg) scale(${sc})`;
                    s.style.color = c;
                    s.style.textShadow = `${(Math.random()-0.5)*6}px ${(Math.random()-0.5)*4}px 0 #ff0055, ${(Math.random()-0.5)*6}px ${(Math.random()-0.5)*4}px 0 #00ffff`;
                });
                if (_frame * _interval >= _dur) {
                    clearInterval(_timer);
                    titleSpans.forEach(s => {
                        s.style.transition = 'transform 0.25s cubic-bezier(.34,1.56,.64,1), text-shadow 0.3s';
                        s.style.transform = '';
                        // Remove the glitchy cyan/magenta offset shadow, restore normal glow
                        const c = s.style.color || 'var(--primary)';
                        s.style.textShadow = `0 0 15px ${c}`;
                    });
                    setTimeout(_logoReset, 350);
                }
            }, _interval);
        }
    });
    // afk achievement setup is deferred (see after variable declarations)

    function _animateOut(el, animClass, onDone) {
        if (!el || el.classList.contains('hidden')) { onDone && onDone(); return; }
        el.classList.remove('anim-in-right', 'anim-in-left', 'anim-in-up', 'anim-in-down');
        el.classList.add(animClass);
        function _done(e) {
            if (e.target !== el) return;
            el.removeEventListener('animationend', _done);
            el.classList.remove(animClass);
            el.classList.add('hidden');
            onDone && onDone();
        }
        el.addEventListener('animationend', _done);
    }
    function _animateIn(el, animClass) {
        if (!el) return;
        el.classList.remove(animClass);
        void el.offsetWidth;
        el.classList.add(animClass);
        function _done(e) {
            if (e.target !== el) return;
            el.classList.remove(animClass);
            el.removeEventListener('animationend', _done);
        }
        el.addEventListener('animationend', _done);
    }
    // For dynamic modals (position:fixed backdrop + inner div child): animate inner out then remove outer
    window._closeModal = function(id) {
        const ov = document.getElementById(id);
        if (!ov) return;
        const inner = ov.querySelector('div');
        if (inner) {
            inner.classList.add('anim-out-down');
            function _done(e) {
                if (e.target !== inner) return;
                inner.removeEventListener('animationend', _done);
                ov.remove();
            }
            inner.addEventListener('animationend', _done);
        } else { ov.remove(); }
    };

    let alertCallback = null;
    function customAlert(msg, title="NOTICE", isError=false, callback=null) {
        document.getElementById('alert-title').innerText = title;
        document.getElementById('alert-title').style.color = isError ? 'var(--error)' : 'var(--primary)';
        document.getElementById('alert-box').style.borderColor = isError ? 'var(--error)' : '#444';
        document.getElementById('alert-text').innerHTML = msg;
        document.getElementById('custom-alert').classList.remove('hidden');
        _animateIn(document.getElementById('alert-box'), 'anim-in-down');
        alertCallback = callback;
    }
    function closeAlert() {
        const box = document.getElementById('alert-box');
        const outer = document.getElementById('custom-alert');
        box.classList.add('anim-out-down');
        box.addEventListener('animationend', function() {
            box.classList.remove('anim-out-down');
            outer.classList.add('hidden');
            if(alertCallback) { alertCallback(); alertCallback = null; }
        }, { once: true });
    }
    function customConfirm(msg, confirmBtnText) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('custom-confirm');
            const inner = overlay.querySelector('.modal-box');
            document.getElementById('confirm-text').innerHTML = msg;
            const yesBtn = document.getElementById('confirm-yes');
            yesBtn.textContent = confirmBtnText || 'PROCEED';
            overlay.classList.remove('hidden');
            _animateIn(inner, 'anim-in-down');
            const closeConfirm = (val) => {
                inner.classList.add('anim-out-down');
                inner.addEventListener('animationend', function() {
                    inner.classList.remove('anim-out-down');
                    overlay.classList.add('hidden');
                    resolve(val);
                }, { once: true });
            };
            yesBtn.onclick = (e) => { e.stopPropagation(); closeConfirm(true); };
            document.getElementById('confirm-no').onclick = (e) => { e.stopPropagation(); closeConfirm(false); };
        });
    }

    const canvas = document.getElementById('tetris'); const ctx = canvas.getContext('2d');
    const pcNextCtx = document.getElementById('pc-next-canvas').getContext('2d');
    const mNextCtx = document.getElementById('m-next-canvas') ? document.getElementById('m-next-canvas').getContext('2d') : null;
    const pcNext2Ctx = document.getElementById('pc-next2-canvas') ? document.getElementById('pc-next2-canvas').getContext('2d') : null;
    const mNext2Ctx  = document.getElementById('m-next2-canvas')  ? document.getElementById('m-next2-canvas').getContext('2d')  : null;
    const pcNext3Ctx = document.getElementById('pc-next3-canvas') ? document.getElementById('pc-next3-canvas').getContext('2d') : null;
    const mNext3Ctx  = document.getElementById('m-next3-canvas')  ? document.getElementById('m-next3-canvas').getContext('2d')  : null;
    const rankCanvas = document.getElementById('rank-canvas'); const rankCtx = rankCanvas.getContext('2d');
    // Scale rank canvas for device pixel ratio so shapes render crisply
    { const dpr = window.devicePixelRatio || 1; const sz = 300;
      rankCanvas.width = sz * dpr; rankCanvas.height = sz * dpr;
      rankCanvas.style.width = sz + 'px'; rankCanvas.style.height = sz + 'px';
      rankCtx.scale(dpr, dpr); }

    function _sizeGameCanvas(cv, width, height) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv._logicalWidth = width; cv._logicalHeight = height;
        const rect=cv.getBoundingClientRect();
        cv.width = Math.max(1,Math.round((rect.width||width)*dpr));
        cv.height = Math.max(1,Math.round((rect.height||height)*dpr));
        cv.getContext('2d').scale(cv.width/width,cv.height/height);
    }
    [canvas, ...document.querySelectorAll('canvas[id*="next"][id$="canvas"], canvas[id*="hold"][id$="canvas"]')].forEach(cv => _sizeGameCanvas(cv,cv.width,cv.height));
    function _syncBadgeLoop() {
        if (document.hidden || !_rankBadgeVisible || document.getElementById('menu-overlay').classList.contains('hidden')) {
            if (badgeAnimFrame) cancelAnimationFrame(badgeAnimFrame);
            badgeAnimFrame=null;
        } else drawRankBadge();
    }
    new MutationObserver(_syncBadgeLoop).observe(document.getElementById('menu-overlay'),{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',_syncBadgeLoop);
    function _refreshGameDPR() {
        [canvas, ...document.querySelectorAll('canvas[id*="next"][id$="canvas"], canvas[id*="hold"][id$="canvas"]')].forEach(cv => {
            _sizeGameCanvas(cv,cv._logicalWidth,cv._logicalHeight);
        });
        drawNext(); drawHold(); drawGame();
    }
    window.addEventListener('resize',_refreshGameDPR);
    let ROWS = 22; const VISIBLE_ROWS = 20; let COLS = 10; let BLOCK = 30;
    const SPEED_MULTIPLIERS =[1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8];

    let particles =[], shockwaves =[], floatingTexts =[], shakeIntensity = 0;
    class Particle{constructor(x,y,c){this.x=x;this.y=y;this.vx=(Math.random()-.5)*8;this.vy=(Math.random()-.5)*8;this.c=c;this.s=Math.random()*5+2;this.l=1}update(dt=1000/60){const f=dt*60/1000;this.x+=this.vx*f;this.y+=this.vy*f+.2*f*(f-1);this.vy+=.4*f;this.l-=.04*f}draw(c){c.save();c.globalAlpha=Math.max(0,this.l);c.fillStyle=this.c;c.fillRect(this.x,this.y,this.s,this.s);c.restore()}}
    class Shockwave{constructor(y,s){this.y=y;this.s=s;this.r=0;this.l=1}update(dt=1000/60){const f=dt*60/1000;this.r+=this.s*2*f;this.l-=.04*f}draw(c){c.save();c.globalAlpha=Math.max(0,this.l);c.strokeStyle="#fff";c.lineWidth=3;c.beginPath();c.arc(c.canvas._logicalWidth/2,this.y,this.r,0,Math.PI*2);c.stroke();c.restore()}}
    
    class FloatingText{
        constructor(x,y,txt,c,sz,startL){this.x=x+(Math.random()-0.5)*20;this.y=y;this.txt=txt;this.c=c;this.l=startL!==undefined?startL:1.0;this.vy=-1.5;this.sz=sz||22;this.paused=false;this.punchT=1;}
        update(dt=1000/60){const f=dt*60/1000;if(!this.paused){this.y+=this.vy*f;this.l-=0.0165*f;if(this.punchT<1)this.punchT=Math.min(1,this.punchT+0.14*f);}}
        draw(ctx){
            ctx.save();
            ctx.globalAlpha=Math.max(0,this.l);
            let scale = 1 + (1 - this.l) * 0.4;
            if(this.punchT<1){const t=this.punchT;scale*=(t<0.5?t/0.5*1.4:1.4-(t-0.5)/0.5*0.4);}
            ctx.translate(this.x, this.y);
            ctx.scale(scale, scale);
            if(settings.optMirror){ctx.scale(1,-1);}
            if (!this.sprite) {
                const tile=document.createElement('canvas'), tc=tile.getContext('2d');
                const dpr=Math.min(2,window.devicePixelRatio||1), font=`900 ${this.sz}px 'Orbitron'`;
                tc.font=font;
                this.spriteWidth=Math.ceil(tc.measureText(this.txt).width+48);
                this.spriteHeight=this.sz*2+48;
                tile.width=Math.ceil(this.spriteWidth*dpr); tile.height=Math.ceil(this.spriteHeight*dpr);
                tc.scale(dpr,dpr); tc.font=font; tc.textAlign='center';
                tc.strokeStyle='#000'; tc.lineWidth=4;
                tc.strokeText(this.txt,this.spriteWidth/2,this.sz+24);
                tc.fillStyle=this.c; tc.shadowColor=this.c; tc.shadowBlur=10*dpr;
                tc.fillText(this.txt,this.spriteWidth/2,this.sz+24);
                this.sprite=tile;
            }
            ctx.drawImage(this.sprite,-this.spriteWidth/2,-this.sz-24,this.spriteWidth,this.spriteHeight);
            ctx.restore();
        }
    }
    const _noiseBuffers = new WeakMap();
    function _noiseBuffer(seconds) {
        let buffers=_noiseBuffers.get(audioCtx);
        if (!buffers) { buffers=new Map();_noiseBuffers.set(audioCtx,buffers); }
        if (!buffers.has(seconds)) {
            const buffer=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*seconds),audioCtx.sampleRate);
            const data=buffer.getChannelData(0);
            for (let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
            buffers.set(seconds,buffer);
        }
        return buffers.get(seconds);
    }
    function triggerShake(f=5){shakeIntensity=f}

    let saveData = {}; let gainedXPThisRound = 0; let _boosterUsedThisRound = false; let _leveledUpThisGame = false;
    let _gameInProgress = false; // true between startGame and gameOver — blocks mid-game file saves
    const defaultSaveData = { totalXP: 0, highscore: 0, parts: {}, universalParts: 0, ownedSkins: ['neon'], ownedFonts: ['Orbitron'], ownedThemes: [], ownedBtnStyles: [], ownedBlockShapes: [], ownedBgStyles: ['default'], ownedSfxPacks: ['default'], ownedPalettes: ['classic'], lastDailyGift: null, dailyGiftUnlockReq: null, boosters: {}, ghostColorUnlocked: false, seenFunRules: false, seenMasterRules: false, pendingLevelBox: null, missions: null, stats: { gamesPlayed: 0, totalTimePlayed: 0, totalBlocksPlaced: 0, totalLinesCleared: 0, totalQuads: 0, totalBoostersUsed: 0, rareItemsFromDailyBox: 0, dailyStreak: 0, highestDailyStreak: 0, maxCombo: 0, lastPlayDate: '', playHistory: {}, blockTypeUsage: {}, luckySevenCount: 0 }, leaderboard:[], pinnedScores: [], achievements: {}, pendingAchievementClaims: [] };

    // --- FILE SYSTEM ACCESS API ---
    const _nativeAdapter = window.Capacitor?.isNativePlatform()
        ? window.LBNativeSave.createFilesystemSave(window.Capacitor.Plugins.Filesystem)
        : window.__TAURI__ ? {
            load: () => window.__TAURI__.core.invoke('load_save'),
            write: json => window.__TAURI__.core.invoke('write_save', { json })
        } : null;
    const _desktopSave = !!_nativeAdapter;
    let _desktopLoadPromise = null;
    let _desktopSaveReady = false;
    let fileHandle = null;

    async function openIDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('TetrisRPG', 2);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
                if (!db.objectStoreNames.contains('savedata')) db.createObjectStore('savedata');
            };
            req.onsuccess = e => {
                const db = e.target.result;
                db.onversionchange = () => db.close(); // yield to future upgrades
                resolve(db);
            };
            req.onerror = e => reject(e.target.error);
            req.onblocked = () => reject(new Error('IDB upgrade blocked')); // fall through to null save path
        });
    }
    async function saveHandleToIDB(handle) {
        try {
            const db = await openIDB();
            await new Promise((res, rej) => {
                const tx = db.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(handle, 'saveFile');
                tx.oncomplete = res; tx.onerror = rej;
            });
        } catch(e) {}
    }
    async function getHandleFromIDB() {
        try {
            const db = await openIDB();
            return await new Promise(resolve => {
                const tx = db.transaction('handles', 'readonly');
                tx.onabort = () => resolve(null);
                const req = tx.objectStore('handles').get('saveFile');
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch { return null; }
    }
    async function readSaveFile(handle) {
        const file = await handle.getFile();
        return JSON.parse(await file.text());
    }
    async function writeIDBSave(data) {
        try {
            const db = await openIDB();
            await new Promise((res, rej) => {
                const tx = db.transaction('savedata', 'readwrite');
                tx.objectStore('savedata').put(JSON.stringify(data), 'save');
                tx.oncomplete = res; tx.onerror = rej;
            });
        } catch(e) {}
    }
    async function readIDBSave() {
        try {
            const db = await openIDB();
            return await new Promise(resolve => {
                const tx = db.transaction('savedata', 'readonly');
                tx.onabort = () => resolve(null);
                const req = tx.objectStore('savedata').get('save');
                req.onsuccess = () => { try { resolve(req.result ? JSON.parse(req.result) : null); } catch(e) { resolve(null); } };
                req.onerror = () => resolve(null);
            });
        } catch { return null; }
    }
    let _saveWritePromise = null;
    let _pendingSaveJSON = null;
    function writeSaveFile(data) {
        if (_desktopSave && !_desktopSaveReady) return Promise.resolve();
        _pendingSaveJSON = JSON.stringify(data, null, 2);
        if (!_saveWritePromise) {
            _saveWritePromise = (async () => {
                while (_pendingSaveJSON !== null) {
                    const json = _pendingSaveJSON;
                    _pendingSaveJSON = null;
                    try {
                        if (_desktopSave) {
                            await _nativeAdapter.write(json);
                        } else if (fileHandle) {
                            const writable = await fileHandle.createWritable();
                            await writable.write(json);
                            await writable.close();
                        } else {
                            await writeIDBSave(JSON.parse(json));
                        }
                    } catch(e) { console.error('Save failed:', e); }
                }
            })().finally(() => { _saveWritePromise = null; });
        }
        return _saveWritePromise;
    }

    // Settings
    const defaultSettings = { classicColors: false, musicVol: 30, sfxVol: 50, sfxPack: 'default', theme: 'default', skin: 'neon', fontSize: '5', gameScale: '5', das: 160, arr: 50, ghostColor: 'white', btnStyle: 'square', blockShape: 'square', heavyBg: 1, hardDropLock: false, hardDropLockMs: 50, stylePack: 'modern', optGhost: true, optHold: false, opt3Next: false, optMirror: false, optNoNext: false, gridOpacity: 40, gridStyle: 'lines', shakeStrength: 2, lineClearMs: 150, musicMuted: false, sfxMuted: false, colorPalette: 'classic', randomPieceColors: false, randomBlockColors: false };
    let settings = { ...defaultSettings };
    function loadSettings() {
        try { settings = { ...defaultSettings, ...JSON.parse(localStorage.getItem('tetrisRPG_settings') || '{}') }; } catch(e) {}
        if (!settings.gridStyle) settings.gridStyle = 'lines';
        settings.keyBindings = LBControls.normalizeBindings(settings.keyBindings);
    }
    function saveSettings() { localStorage.setItem('tetrisRPG_settings', JSON.stringify(settings)); saveDataToFile(); }
    let _saveFileDebounceId = null;
    function saveSettingsDebounced() {
        localStorage.setItem('tetrisRPG_settings', JSON.stringify(settings));
        clearTimeout(_saveFileDebounceId);
        _saveFileDebounceId = setTimeout(saveDataToFile, 600);
    }

    function applyFontSize(size) {
        const map = { '1':0.78,'2':0.91,'3':1.04,'4':1.17,'5':1.30,'6':1.43,'7':1.56,'8':1.76,'9':1.95,'10':2.15 };
        document.documentElement.style.setProperty('--font-scale', map[size] || 1.30);
    }
    function applyGameScale(size) {
        const map = { '1':0.42,'2':0.49,'3':0.56,'4':0.63,'5':0.70,'6':0.77,'7':0.84,'8':0.94,'9':1.05,'10':1.15 };
        const baseScale = map[size] || 1.0;
        document.documentElement.style.setProperty('--game-scale', baseScale);
        // Cap menu scale so badge doesn't go above viewport top
        const vh = window.innerHeight || 900;
        const desired = 1.3 * baseScale;
        // 550 = approx half-distance from wrapper center to badge canvas top * 2
        const maxScale = Math.max(0.8, (vh - 40) / 550);
        document.documentElement.style.setProperty('--menu-scale', Math.min(desired, maxScale));
    }
    function applyBtnStyle(key) {
        const s = BTN_STYLES[key] || BTN_STYLES.square;
        document.documentElement.style.setProperty('--btn-clip', s.clip);
        document.documentElement.style.setProperty('--btn-radius', s.radius);
        settings.btnStyle = key;
        saveSettings();
        document.body.dataset.btnclip = key;
        _populateVisualCustomize();
    }
    function applyGridStyle(key) {
        settings.gridStyle = key;
        saveSettings();
        _populateVisualCustomize();
    }
    function applyFont(name) {
        const f = FONTS[name];
        if (!f) return;
        document.documentElement.style.setProperty('--ui-font', f.css);
        settings.font = name;
        saveSettings();
        document.querySelectorAll('[data-font]').forEach(b => b.classList.toggle('active', b.dataset.font === name));
    }

    function hexToRgba(hex, alpha) {
        if (!hex || hex[0] !== '#') return `rgba(255,255,255,${alpha})`;
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    const FONTS = {
        'Orbitron': { label:'Orbitron', css:"'Orbitron', sans-serif", free:true },
    };
    const THEMES = {
        default:  { primary: '#00ffff', bg: 'radial-gradient(ellipse at center, #0d1b3e 0%, #020818 60%, #000 100%)', btnGrad: 'linear-gradient(45deg, #00ffff, #0088ff)', radius: '30px', clip: 'none' },
        ocean:    { primary: '#0099ff', bg: 'radial-gradient(ellipse at center, #00204d 0%, #000c24 60%, #000 100%)', btnGrad: 'linear-gradient(45deg, #0099ff, #003399)', radius: '8px', clip: 'none' },
        forest:   { primary: '#00dd55', bg: 'radial-gradient(ellipse at center, #0a2e10 0%, #010d02 60%, #000 100%)', btnGrad: 'linear-gradient(45deg, #00dd55, #007722)', radius: '30px', clip: 'none' },
        fire:     { primary: '#ff3300', bg: 'radial-gradient(ellipse at center, #3a0800 0%, #150100 60%, #000 100%)', btnGrad: 'linear-gradient(45deg, #ff3300, #cc0000)', radius: '4px', clip: 'none' },
        dragon:   { primary: '#ffcc00', bg: 'radial-gradient(ellipse at 50% 20%, #3d0800 0%, #1a0300 55%, #000 100%)', btnGrad: 'linear-gradient(45deg, #ffcc00, #cc4400)', radius: '6px', clip: 'none' },
        void:     { primary: '#cc44ff', bg: 'radial-gradient(ellipse at center, #1a0030 0%, #07000f 60%, #000 100%)', btnGrad: 'linear-gradient(45deg, #cc44ff, #7700cc)', radius: '16px', clip: 'none' },
        sunset:   { primary: '#ff7722', bg: 'radial-gradient(ellipse at 50% 70%, #3a1500 0%, #180400 60%, #000 100%)', btnGrad: 'linear-gradient(45deg, #ff7722, #ff0055)', radius: '30px', clip: 'none' },
        arctic:   { primary: '#88ddff', bg: 'radial-gradient(ellipse at center, #0d2840 0%, #030d18 60%, #000 100%)', btnGrad: 'linear-gradient(45deg, #88ddff, #0066cc)', radius: '10px', clip: 'none' },
        midnight: { primary: '#aa77ff', bg: 'radial-gradient(ellipse at center, #0e0025 0%, #04000e 60%, #000 100%)', btnGrad: 'linear-gradient(45deg, #aa77ff, #550099)', radius: '20px', clip: 'none' },
        sakura:   { primary: '#ff88cc', bg: 'radial-gradient(ellipse at 50% 30%, #280818 0%, #0e0010 60%, #000 100%)', btnGrad: 'linear-gradient(45deg, #ff88cc, #cc0055)', radius: '30px', clip: 'none' },
    };
    const BTN_STYLES = {
        square:  { name: 'Square Buttons', clip: 'none', radius: '4px', free: true },
    };
    const GRID_STYLES = {
        lines:    { name: 'Classic Lines',  free: true },
        dots:     { name: 'Corner Dots' },
        boxes:    { name: 'Cell Boxes' },
        dotboxes: { name: 'Dot Boxes' },
    };
    const BLOCK_SHAPES = {
        square: { name: 'Square', free: true },
        round:  { name: 'Round',  free: true },
    };
    const _SVG_GIFT = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>`;
    const _SVG_STATS = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-4"/></svg>`;
    const _SVG_SETTINGS = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 3px currentColor);"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    const _SVG_ACHIEVEMENTS = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4H4v5c0 1.65 1.35 3 3 3"/><path d="M17 4h3v5c0 1.65-1.35 3-3 3"/><path d="M7 12c0 2.76 2.24 5 5 5s5-2.24 5-5V4H7v8z"/><line x1="12" y1="17" x2="12" y2="21"/><polyline points="9 21 12 21 15 21"/></svg>`;
    const _SVG_INVENTORY = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a4 4 0 014-4h8a4 4 0 014 4v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9z"/><path d="M9 6V5a3 3 0 016 0v1"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`;
    const _SVG_CALENDAR = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:2px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const _SVG_TIMER = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:2px"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14.5 15.5"/><path d="M9 2h6"/></svg>`;
    const STYLE_PACKS = {
        modern: {
            name: 'Modern', desc: 'SVG icons · Square buttons', blockShape: 'square', btnRadius: '4px', free: true,
            font: "Tahoma, Arial, sans-serif",
            icons: { gift: _SVG_GIFT, stats: _SVG_STATS, settings: _SVG_SETTINGS, achievements: _SVG_ACHIEVEMENTS, inventory: _SVG_INVENTORY },
        },
    };
    const FREE_THEMES = ['default'];
    function applyTheme(name) {
        // Check if theme needs to be unlocked
        if (!FREE_THEMES.includes(name)) {
            const ownedThemes = saveData.ownedThemes || [];
            if (!ownedThemes.includes(name)) {
                customAlert(`This theme is not yet unlocked.<br><br>Collect <b>parts</b> from the daily gift to unlock it.`, 'NOT OWNED', true);
                return;
            }
        }
        _doApplyTheme(name);
    }
    function _doApplyTheme(name) {
        if (name === 'custom' && saveData.customThemeColor) {
            const _ch = saveData.customThemeColor;
            document.documentElement.style.setProperty('--primary', _ch);
            document.documentElement.style.setProperty('--primary-dim', hexToRgba(_ch, 0.35));
            const _r=parseInt(_ch.slice(1,3),16),_g=parseInt(_ch.slice(3,5),16),_b=parseInt(_ch.slice(5,7),16);
            const _mx=Math.max(_r,_g,_b)/255,_mn=Math.min(_r,_g,_b)/255;let _h=0;
            if(_mx!==_mn){const d=_mx-_mn;if(_mx===_r/255)_h=((_g/255-_b/255)/d+(_g<_b?6:0))/6;else if(_mx===_g/255)_h=((_b/255-_r/255)/d+2)/6;else _h=((_r/255-_g/255)/d+4)/6;}
            const _pb=document.getElementById('btn-play');if(_pb)_pb.style.setProperty('--play-hue',Math.round(_h*360));
            settings.theme='custom'; return;
        }
        const t = THEMES[name] || THEMES.default;
        document.documentElement.style.setProperty('--primary', t.primary);
        document.documentElement.style.setProperty('--primary-dim', hexToRgba(t.primary, 0.35));
        document.querySelector('.bg-gradient').style.background = t.bg;
        const playBtn = document.getElementById('btn-play');
        if (playBtn) {
            // Use theme primary as base hue for the color cycle
            // Parse hue from primary hex color
            const r = parseInt(t.primary.slice(1,3)||'00',16);
            const g = parseInt(t.primary.slice(3,5)||'ff',16);
            const b = parseInt(t.primary.slice(5,7)||'ff',16);
            const max = Math.max(r,g,b)/255, min = Math.min(r,g,b)/255;
            let h = 0;
            if (max !== min) {
                const d = max - min;
                if (max === r/255) h = ((g/255 - b/255)/d + (g < b ? 6 : 0)) / 6;
                else if (max === g/255) h = ((b/255 - r/255)/d + 2) / 6;
                else h = ((r/255 - g/255)/d + 4) / 6;
            }
            playBtn.style.setProperty('--play-hue', Math.round(h * 360));
            playBtn.style.background = ''; // let CSS animation handle it
        }
        settings.theme = name;
        saveSettings();
        // Re-render theme list if inventory is open
        const ownedThemeContainer = document.getElementById('owned-theme-btns');
        if (ownedThemeContainer) {
            _populateVisualCustomize();
        }
    }
    function _applyCustomTheme(hex) {
        saveData.customThemeColor = hex;
        // Apply the custom color as theme
        document.documentElement.style.setProperty('--primary', hex);
        document.documentElement.style.setProperty('--primary-dim', hexToRgba(hex, 0.35));
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        const max = Math.max(r,g,b)/255, min = Math.min(r,g,b)/255;
        let h = 0;
        if (max !== min) { const d = max-min; if (max===r/255) h=((g/255-b/255)/d+(g<b?6:0))/6; else if (max===g/255) h=((b/255-r/255)/d+2)/6; else h=((r/255-g/255)/d+4)/6; }
        const playBtn = document.getElementById('btn-play');
        if (playBtn) playBtn.style.setProperty('--play-hue', Math.round(h * 360));
        settings.theme = 'custom';
        saveSettings(); saveDataToFile();
        const ownedThemeContainer = document.getElementById('owned-theme-btns');
        if (ownedThemeContainer) _populateVisualCustomize();
    }
    window._applyCustomTheme = _applyCustomTheme;
    function _openColorPickerModal() {
        const existing = document.getElementById('color-picker-modal');
        if (existing) existing.remove();
        const cur = saveData.customThemeColor || '#ff00ff';
        const presets = ['#00ffff','#0099ff','#00dd55','#ff3300','#ffcc00','#cc44ff','#ff7722','#88ddff','#aa77ff','#ff88cc','#ff0055','#44ff88','#ffff00','#ff8800','#8844ff','#00ff99'];
        const ov = document.createElement('div');
        ov.id = 'color-picker-modal';
        ov.className = 'lb-r3 lb-r3-picker';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `<div style="background:#12121e;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:24px;width:min(320px,88vw);position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.9);">
            <button aria-label="Close" onclick="window._closeModal('color-picker-modal')" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#555;font-size:1.1rem;cursor:pointer;padding:4px;line-height:1;">✕</button>
            <div style="font-size:0.6rem;letter-spacing:2px;color:#888;margin-bottom:14px;">CUSTOM THEME COLOR</div>
            <div id="cp-preview" style="width:100%;height:40px;border-radius:8px;background:${cur};margin-bottom:14px;box-shadow:0 0 20px ${cur}44;transition:background 0.2s,box-shadow 0.2s;"></div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                <span style="font-size:0.7rem;color:#666;min-width:28px;height:36px;display:flex;align-items:center;">HEX</span>
                <input type="text" id="cp-hex-input" aria-label="Theme hex color" value="${cur}" maxlength="7" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:10px 10px 0;color:#fff;font-family:'Orbitron',sans-serif;font-size:0.85rem;letter-spacing:1px;outline:none;height:36px;box-sizing:border-box;" oninput="window._cpUpdateFromHex(this.value)">
                <div style="position:relative;width:36px;height:36px;flex-shrink:0;">
                    <input type="color" id="cp-native" aria-label="Theme color" value="${cur}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;" oninput="window._cpUpdateFromNative(this.value)">
                    <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);pointer-events:none;">${_SVG_EYEDROPPER}</div>
                </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">${presets.map(c => `<button type="button" class="lb-color-preset" aria-label="Use ${c}" onclick="window._cpSelectPreset('${c}')" style="--preset:${c};"></button>`).join('')}</div>
            <button onclick="window._cpApply()" style="width:100%;padding:10px;font-size:0.75rem;font-family:inherit;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;cursor:pointer;font-weight:bold;letter-spacing:1px;">APPLY</button>
        </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) window._closeModal('color-picker-modal'); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-up');
        document.getElementById('cp-hex-input').focus();
    }
    window._openColorPickerModal = _openColorPickerModal;
    window._cpUpdateFromHex = function(val) {
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            document.getElementById('cp-preview').style.background = val;
            document.getElementById('cp-preview').style.boxShadow = `0 0 20px ${val}44`;
            document.getElementById('cp-native').value = val;
        }
    };
    window._cpUpdateFromNative = function(val) {
        document.getElementById('cp-hex-input').value = val;
        document.getElementById('cp-preview').style.background = val;
        document.getElementById('cp-preview').style.boxShadow = `0 0 20px ${val}44`;
    };
    window._cpSelectPreset = function(c) {
        document.getElementById('cp-hex-input').value = c;
        document.getElementById('cp-native').value = c;
        document.getElementById('cp-preview').style.background = c;
        document.getElementById('cp-preview').style.boxShadow = `0 0 20px ${c}44`;
    };
    window._cpApply = function() {
        const hex = document.getElementById('cp-hex-input').value;
        if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
            _applyCustomTheme(hex);
            window._closeModal('color-picker-modal');
        }
    };

    const _PIECE_LABELS = ['I','O','T','S','Z','J','L'];

    // --- Render piece to image using current skin via drawGameBlock ---
    function _renderPieceToImg(pieceMatrix, colorId, cellSize) {
        const rows = pieceMatrix.length, cols = pieceMatrix[0].length;
        const c = document.createElement('canvas');
        c.width = cols * cellSize; c.height = rows * cellSize;
        const ctx = c.getContext('2d');
        for (let r = 0; r < rows; r++) {
            for (let col = 0; col < cols; col++) {
                if (pieceMatrix[r][col]) {
                    drawGameBlock(ctx, col, r, colorId, cellSize);
                }
            }
        }
        return c.toDataURL();
    }

    // --- Floating "Copied!" feedback ---
    function _showCopyFeedback(x, y) {
        const el = document.createElement('div');
        el.textContent = 'Copied!';
        el.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translateX(-50%);z-index:99999;font-size:0.7rem;font-weight:bold;color:#22cc55;text-shadow:0 0 8px rgba(34,204,85,0.5);pointer-events:none;transition:all 0.8s ease-out;opacity:1;`;
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.top = (y - 30) + 'px'; el.style.opacity = '0'; });
        setTimeout(() => el.remove(), 900);
    }
    window._showCopyFeedback = _showCopyFeedback;

    // --- Block hover preview tooltip ---
    function _swatchHtml(i, color, showHex) {
        const bs = settings.blockShape || 'square';
        const br = bs === 'round' ? '50%' : bs === 'square' ? '2px' : '4px';
        const hoverHandler = ' onmouseenter="window._showBlockPreview(this,' + i + ',\'' + color + '\')" onmouseleave="window._hideBlockPreview()"';
        const swatch = '<div style="width:24px;height:24px;border-radius:' + br + ';background:' + color + ';flex-shrink:0;border:2px solid rgba(0,0,0,0.3);"></div>';
        const hex = showHex ? '<span style="font-size:0.72rem;color:#888;font-family:Orbitron,sans-serif;">' + color + '</span>' : '';
        return '<div class="pal-swatch" data-piece="' + i + '" style="display:flex;align-items:center;gap:8px;cursor:pointer;border-radius:6px;height:34px;"' + hoverHandler + '>' + swatch + hex + '</div>';
    }
    let _blockPreviewActiveSwatch = null;
    window._showBlockPreview = function(el, pieceIdx, color) {
        window._hideBlockPreview();
        const rect = el.getBoundingClientRect();
        const oldC = COLORS[pieceIdx + 1];
        COLORS[pieceIdx + 1] = color;
        const imgSrc = _renderPieceToImg(BASE_PIECES[pieceIdx + 1], pieceIdx + 1, BLOCK);
        COLORS[pieceIdx + 1] = oldC;

        const tip = document.createElement('div');
        tip.id = 'block-preview-tip';
        tip.style.cssText = 'position:fixed;z-index:99999;background:rgba(5,5,20,0.97);border:1px solid color-mix(in srgb, var(--primary) 30%, transparent);border-radius:8px;padding:8px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
        tip.innerHTML = '<img src="' + imgSrc + '" style="image-rendering:pixelated;display:block;">';

        tip.style.left = (rect.left + rect.width / 2 - 60) + 'px';
        tip.style.top = (rect.top - BLOCK * 4 - 20) + 'px';
        document.body.appendChild(tip);
        _blockPreviewActiveSwatch = el;
    };
    window._hideBlockPreview = function() {
        const existing = document.getElementById('block-preview-tip');
        if (existing) existing.remove();
        _blockPreviewActiveSwatch = null;
    };
    // Mobile: toggle block preview on tap
    window._toggleBlockPreview = function(el, pieceIdx, color) {
        if (_blockPreviewActiveSwatch === el) {
            window._hideBlockPreview();
        } else {
            window._showBlockPreview(el, pieceIdx, color);
        }
    };
    // --- PALETTE EDITOR (for editing any owned palette when all palettes owned) ---
    let _palEditState = null;

    function _openPaletteEditor(paletteKey) {
        document.getElementById('pal-edit-modal')?.remove();
        const pal = BLOCK_PALETTES[paletteKey];
        if (!pal) return;
        // If there are already overrides, use those; otherwise use current palette colors
        const currentColors = saveData.customPaletteOverrides?.[paletteKey] || pal.colors.slice(0, 7);
        _palEditState = { key: paletteKey, colors: currentColors.slice(0, 7) };

        const ov = document.createElement('div');
        ov.id = 'pal-edit-modal';
        ov.className = 'lb-r3 lb-r3-picker';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';

        let pickersHtml = '';
        _PIECE_LABELS.forEach((lbl, i) => {
            const c = _palEditState.colors[i] || '#ffffff';
            pickersHtml += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span style="font-size:0.72rem;color:#ccc;font-weight:bold;min-width:16px;">${lbl}</span>
                <div style="position:relative;width:34px;height:34px;flex-shrink:0;">
                    <input type="color" id="pe-c${i}-native" aria-label="Piece ${i + 1} native color" value="${c}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;" oninput="window._palEditChange(${i},this.value)">
                    <div style="width:100%;height:100%;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:${c};pointer-events:none;box-sizing:border-box;"></div>
                </div>
                <input type="text" id="pe-c${i}-hex" aria-label="Piece ${i + 1} hex color" value="${c}" maxlength="7" style="width:80px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:0 8px;color:#fff;font-family:'Orbitron',sans-serif;font-size:0.78rem;letter-spacing:1px;outline:none;height:34px;box-sizing:border-box;" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))window._palEditChange(${i},this.value)">
                <button onclick="window._palEditEyedrop(${i})" title="Eyedropper" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:6px;width:34px;height:34px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${_SVG_EYEDROPPER}</button>
                <button onclick="navigator.clipboard?.writeText(document.getElementById('pe-c${i}-hex').value);_showCopyFeedback(event.clientX,event.clientY)" title="Copy hex" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:6px;width:34px;height:34px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${_SVG_COPY}</button>
            </div>`;
        });

        ov.innerHTML = `<div style="background:#12121e;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:24px;width:min(420px,92vw);max-height:85vh;overflow-y:auto;position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.9);">
            <button aria-label="Close" onclick="window._closeModal('pal-edit-modal')" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#555;font-size:1.1rem;cursor:pointer;padding:4px;line-height:1;">&#10005;</button>
            <div style="font-size:0.6rem;letter-spacing:2px;color:#888;margin-bottom:6px;">EDIT PALETTE</div>
            <div style="font-size:0.82rem;color:#fff;margin-bottom:14px;font-weight:bold;">${pal.name}</div>
            ${pickersHtml}
            <div id="pe-preview-row" style="display:flex;gap:4px;margin:16px 0 12px;justify-content:center;"></div>
            <div style="display:flex;gap:8px;">
                <button onclick="window._palEditApply()" style="flex:1;padding:10px;font-size:0.75rem;font-family:inherit;border-radius:8px;border:1px solid var(--primary,#00ffff);background:rgba(0,255,255,0.08);color:var(--primary,#00ffff);cursor:pointer;font-weight:bold;letter-spacing:1px;">APPLY</button>
                <button onclick="window._palEditReset()" style="padding:10px;font-size:0.75rem;font-family:inherit;border-radius:8px;border:1px solid #ff5555;background:rgba(255,85,85,0.08);color:#ff5555;cursor:pointer;letter-spacing:1px;" title="Reset to default colors">RESET</button>
                <button onclick="window._closeModal('pal-edit-modal')" style="flex:1;padding:10px;font-size:0.75rem;font-family:inherit;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:#888;cursor:pointer;letter-spacing:1px;">CANCEL</button>
            </div>
        </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) window._closeModal('pal-edit-modal'); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-up');
        window._palEditRefreshPreview();
    }
    window._openPaletteEditor = _openPaletteEditor;

    window._palEditChange = function(i, val) {
        if (!/^#[0-9a-fA-F]{6}$/.test(val)) return;
        _palEditState.colors[i] = val;
        document.getElementById('pe-c' + i + '-hex').value = val;
        document.getElementById('pe-c' + i + '-native').value = val;
        // Update the color swatch div next to the native input
        const nativeEl = document.getElementById('pe-c' + i + '-native');
        if (nativeEl) { const swatchDiv = nativeEl.nextElementSibling; if (swatchDiv) swatchDiv.style.background = val; }
        window._palEditRefreshPreview();
    };

    window._palEditEyedrop = function(i) {
        if (!window.EyeDropper) { customAlert('EyeDropper API is not supported in this browser.', 'NOT SUPPORTED', true); return; }
        new EyeDropper().open().then(r => {
            window._palEditChange(i, r.sRGBHex);
        }).catch(() => {});
    };

    window._palEditRefreshPreview = function() {
        const row = document.getElementById('pe-preview-row');
        if (!row || !_palEditState) return;
        row.innerHTML = _palEditState.colors.map((c, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
            <div style="width:36px;height:36px;border-radius:6px;background:${c};border:1px solid rgba(255,255,255,0.1);box-shadow:0 0 8px ${c}33;"></div>
            <span style="font-size:0.55rem;color:#666;">${_PIECE_LABELS[i]}</span>
            <span style="font-size:0.5rem;color:#555;font-family:'Orbitron',sans-serif;">${c}</span>
        </div>`).join('');
    };

    window._palEditApply = function() {
        if (!_palEditState) return;
        const key = _palEditState.key;
        if (!saveData.customPaletteOverrides) saveData.customPaletteOverrides = {};
        saveData.customPaletteOverrides[key] = _palEditState.colors.slice();
        if (settings.colorPalette === key) _applyColorPalette(key);
        saveSettings();
        saveDataToFile();
        _populateInventoryOther();
        window._closeModal('pal-edit-modal');
    };

    window._palEditReset = function() {
        if (!_palEditState) return;
        const key = _palEditState.key;
        if (saveData.customPaletteOverrides) delete saveData.customPaletteOverrides[key];
        if (settings.colorPalette === key) _applyColorPalette(key);
        saveSettings();
        saveDataToFile();
        _populateInventoryOther();
        window._closeModal('pal-edit-modal');
    };

    function _allPalettesOwned() {
        const owned = saveData.ownedPalettes || ['classic'];
        return Object.keys(BLOCK_PALETTES).every(k => BLOCK_PALETTES[k].free || owned.includes(k));
    }

    window._onCustomPickerColor = function(idx, val) {
        if (!saveData.customPickerColors) saveData.customPickerColors = BLOCK_PALETTES.classic.colors.slice(0, 7);
        saveData.customPickerColors[idx] = val;
        if (settings.colorPalette === '_custom_picker') {
            for (let i = 0; i < 7; i++) COLORS[i + 1] = saveData.customPickerColors[i];
        }
        saveDataToFile();
    };
    window._activateCustomPicker = function() {
        if (!saveData.customPickerColors) saveData.customPickerColors = BLOCK_PALETTES.classic.colors.slice(0, 7);
        settings.colorPalette = '_custom_picker';
        settings.randomBlockColors = false;
        for (let i = 0; i < 7; i++) COLORS[i + 1] = saveData.customPickerColors[i];
        saveSettings();
        _populateVisualCustomize();
    };

    // --- SVG ICON CONSTANTS ---
    const _SVG_COPY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
    const _SVG_EYEDROPPER = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.7 4.7a2.4 2.4 0 00-3.4 0L14 8l2 2 3.3-3.3a2.4 2.4 0 000-3.4z"/><path d="M14 8l-8.6 8.6a2 2 0 00-.5 1V20h2.4c.4 0 .7-.2 1-.5L17 11"/></svg>';

    // --- PALETTE VIEW MODAL (read-only color info with copy) ---
    function _openPaletteViewModal(paletteKey) {
        document.getElementById('palette-view-modal')?.remove();
        const pal = BLOCK_PALETTES[paletteKey];
        if (!pal) return;
        const displayColors = (saveData.customPaletteOverrides?.[paletteKey]) ? saveData.customPaletteOverrides[paletteKey] : pal.colors;

        let rowsHtml = '';
        _PIECE_LABELS.forEach((lbl, i) => {
            const c = displayColors[i] || '#ffffff';
            rowsHtml += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;">
                ${_swatchHtml(i, c, true)}
                <span style="flex:1;"></span>
                <button onclick="navigator.clipboard?.writeText('${c}');_showCopyFeedback(event.clientX,event.clientY)" title="Copy hex" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:6px;width:34px;height:34px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${_SVG_COPY}</button>
            </div>`;
        });

        const ov = document.createElement('div');
        ov.id = 'palette-view-modal';
        ov.className = 'lb-r3 lb-r3-picker';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `<div style="background:#12121e;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:24px;width:min(340px,88vw);position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.9);">
            <button aria-label="Close" onclick="window._closeModal('palette-view-modal')" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#555;font-size:1.1rem;cursor:pointer;padding:4px;line-height:1;">&#10005;</button>
            <div style="font-size:0.6rem;letter-spacing:2px;color:#888;margin-bottom:14px;">${pal.name.toUpperCase()} PALETTE</div>
            ${rowsHtml}
            <button onclick="window._closeModal('palette-view-modal')" style="width:100%;margin-top:14px;padding:10px;font-size:0.75rem;font-family:inherit;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:#888;cursor:pointer;letter-spacing:1px;">CLOSE</button>
        </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) window._closeModal('palette-view-modal'); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-up');
    }
    window._openPaletteViewModal = _openPaletteViewModal;

    // --- CUSTOM PALETTE MODAL (full editor modal for custom picker) ---
    let _customPalState = null;

    function _openCustomPaletteModal() {
        document.getElementById('custom-palette-modal')?.remove();
        const colors = (saveData.customPickerColors || BLOCK_PALETTES.classic.colors.slice(0, 7)).slice(0, 7);
        _customPalState = colors.slice();
        let _cpmMode = saveData._cpmMode || 'perpiece';
        let _cpmBaseColor = saveData._cpmBaseColor || '#00ffff';

        function _buildContent() {
            const tabStyle = (active) => `font-size:0.55rem;padding:5px 12px;border-radius:6px;border:1px solid ${active ? 'var(--primary)' : '#333'};background:${active ? 'rgba(0,255,255,0.12)' : 'rgba(255,255,255,0.04)'};color:${active ? 'var(--primary)' : '#777'};cursor:pointer;font-family:inherit;font-weight:${active ? 'bold' : 'normal'};`;
            let bodyHtml = '';

            // Temporarily set COLORS for rendering
            const _oldCols = COLORS.slice();

            if (_cpmMode === 'perpiece') {
                for (let i = 0; i < 7; i++) COLORS[i + 1] = _customPalState[i] || '#ffffff';
                _PIECE_LABELS.forEach((lbl, i) => {
                    const c = _customPalState[i] || '#ffffff';
                    const piece = BASE_PIECES[i + 1];
                    const _btnStyle = 'border:1px solid rgba(255,255,255,0.15);border-radius:6px;width:34px;height:34px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(255,255,255,0.05);';
                    bodyHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                        ${_swatchHtml(i, c)}
                        <input type="text" id="cpm-hex-${i}" aria-label="Piece ${i + 1} hex color" value="${c}" maxlength="7" style="width:90px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:0 8px;color:#fff;font-family:'Orbitron',sans-serif;font-size:0.75rem;letter-spacing:0.5px;outline:none;height:34px;box-sizing:border-box;" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))window._cpmChange(${i},this.value)">
                        <div style="position:relative;width:34px;height:34px;flex-shrink:0;">
                            <input type="color" id="cpm-native-${i}" aria-label="Piece ${i + 1} color" value="${c}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;" oninput="window._cpmChange(${i},this.value)">
                            <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);pointer-events:none;">${_SVG_EYEDROPPER}</div>
                        </div>
                        <button onclick="window._cpmRandom(${i})" title="Random color" style="${_btnStyle}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg></button>
                        <button onclick="window._cpmCopy(${i},event)" title="Copy" style="${_btnStyle}">${_SVG_COPY}</button>
                    </div>`;
                });
            } else if (_cpmMode === 'shade') {
                const shades = _generateShades(_cpmBaseColor, 7);
                _customPalState = shades;
                for (let i = 0; i < 7; i++) COLORS[i + 1] = shades[i];
                bodyHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
                    <span style="font-size:0.7rem;color:#666;min-width:60px;height:34px;display:flex;align-items:center;">Base color</span>
                    <input type="text" id="cpm-shade-hex" aria-label="Base hex color" value="${_cpmBaseColor}" maxlength="7" style="width:90px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:0 8px;color:#fff;font-family:'Orbitron',sans-serif;font-size:0.75rem;outline:none;height:34px;box-sizing:border-box;" oninput="window._cpmShadeChange(this.value)">
                    <div style="position:relative;width:34px;height:34px;flex-shrink:0;">
                        <input type="color" id="cpm-shade-native" aria-label="Base color" value="${_cpmBaseColor}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;" oninput="(function(v){const h=document.getElementById('cpm-shade-hex');if(h)h.value=v;})(this.value)" onchange="window._cpmShadeChange(this.value)">
                        <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);pointer-events:none;">${_SVG_EYEDROPPER}</div>
                    </div>
                    <button onclick="window._cpmShadeChange('#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'))" title="Random color" style="border:1px solid rgba(255,255,255,0.15);border-radius:6px;width:34px;height:34px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(255,255,255,0.05);"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg></button>
                </div>`;
                shades.forEach((c, i) => {
                    bodyHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        ${_swatchHtml(i, c, true)}
                    </div>`;
                });
            } else if (_cpmMode === 'single') {
                _customPalState = Array(7).fill(_cpmBaseColor);
                for (let i = 0; i < 7; i++) COLORS[i + 1] = _cpmBaseColor;
                bodyHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
                    <span style="font-size:0.7rem;color:#666;min-width:60px;height:34px;display:flex;align-items:center;">Color</span>
                    <input type="text" id="cpm-single-hex" value="${_cpmBaseColor}" maxlength="7" style="width:90px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:0 8px;color:#fff;font-family:'Orbitron',sans-serif;font-size:0.75rem;outline:none;height:34px;box-sizing:border-box;" oninput="window._cpmSingleChange(this.value)">
                    <div style="position:relative;width:34px;height:34px;flex-shrink:0;">
                        <input type="color" id="cpm-single-native" value="${_cpmBaseColor}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;" oninput="(function(v){const h=document.getElementById('cpm-single-hex');if(h)h.value=v;})(this.value)" onchange="window._cpmSingleChange(this.value)">
                        <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);pointer-events:none;">${_SVG_EYEDROPPER}</div>
                    </div>
                    <button onclick="window._cpmSingleChange('#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'))" title="Random color" style="border:1px solid rgba(255,255,255,0.15);border-radius:6px;width:34px;height:34px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(255,255,255,0.05);"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg></button>
                </div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
                    ${_swatchHtml(0, _cpmBaseColor)}
                    <span style="font-size:0.6rem;color:#555;">All 7 pieces will use this color</span>
                </div>`;
            }

            // Restore colors
            for (let i = 0; i < _oldCols.length; i++) COLORS[i] = _oldCols[i];

            return `<div style="display:flex;gap:6px;margin-bottom:14px;">
                <button onclick="window._cpmSetMode('perpiece')" style="${tabStyle(_cpmMode === 'perpiece')}">Per Piece</button>
                <button onclick="window._cpmSetMode('shade')" style="${tabStyle(_cpmMode === 'shade')}">Auto Shade</button>
                <button onclick="window._cpmSetMode('single')" style="${tabStyle(_cpmMode === 'single')}">Single Color</button>
            </div>${bodyHtml}`;
        }

        const ov = document.createElement('div');
        ov.id = 'custom-palette-modal';
        ov.className = 'lb-r3 lb-r3-picker';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `<div style="background:#12121e;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:24px;width:min(420px,92vw);max-height:85vh;overflow-y:auto;position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.9);">
            <button aria-label="Close" onclick="window._closeModal('custom-palette-modal')" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#555;font-size:1.1rem;cursor:pointer;padding:4px;line-height:1;">&#10005;</button>
            <div style="font-size:0.6rem;letter-spacing:2px;color:#888;margin-bottom:14px;">CUSTOM BLOCK PALETTE</div>
            <div id="cpm-body">${_buildContent()}</div>
            <div style="margin-top:14px;">
                <button onclick="window._cpmApply()" style="width:100%;padding:10px;font-size:0.75rem;font-family:inherit;border-radius:8px;border:1px solid var(--primary,#00ffff);background:rgba(0,255,255,0.08);color:var(--primary,#00ffff);cursor:pointer;font-weight:bold;letter-spacing:1px;">APPLY</button>
            </div>
        </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) window._closeModal('custom-palette-modal'); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-up');

        window._cpmSetMode = function(mode) {
            _cpmMode = mode;
            if (mode !== 'perpiece') {
                const shades = mode === 'shade' ? _generateShades(_cpmBaseColor, 7) : Array(7).fill(_cpmBaseColor);
                _customPalState = shades;
            }
            document.getElementById('cpm-body').innerHTML = _buildContent();
        };
        window._cpmShadeChange = function(val) {
            if (!/^#[0-9a-fA-F]{6}$/.test(val)) return;
            _cpmBaseColor = val;
            _customPalState = _generateShades(val, 7);
            const hexEl = document.getElementById('cpm-shade-hex'); if (hexEl) hexEl.value = val;
            const natEl = document.getElementById('cpm-shade-native'); if (natEl) natEl.value = val;
            document.getElementById('cpm-body').innerHTML = _buildContent();
        };
        window._cpmSingleChange = function(val) {
            if (!/^#[0-9a-fA-F]{6}$/.test(val)) return;
            _cpmBaseColor = val;
            _customPalState = Array(7).fill(val);
            const hexEl = document.getElementById('cpm-single-hex'); if (hexEl) hexEl.value = val;
            const natEl = document.getElementById('cpm-single-native'); if (natEl) natEl.value = val;
            document.getElementById('cpm-body').innerHTML = _buildContent();
        };
    }
    window._openCustomPaletteModal = _openCustomPaletteModal;

    window._cpmChange = function(i, val) {
        if (!/^#[0-9a-fA-F]{6}$/.test(val)) return;
        _customPalState[i] = val;
        const hexEl = document.getElementById('cpm-hex-' + i); if (hexEl) hexEl.value = val;
        const natEl = document.getElementById('cpm-native-' + i); if (natEl) natEl.value = val;
        // Update the swatch color and its hover handler
        const row = hexEl?.closest('div[style*="margin-bottom"]');
        if (row) {
            const swatch = row.querySelector('.pal-swatch');
            if (swatch) {
                const innerSquare = swatch.querySelector('div');
                if (innerSquare) innerSquare.style.background = val;
                swatch.setAttribute('onmouseenter', "window._showBlockPreview(this," + i + ",'" + val + "')");
            }
        }
    };
    window._cpmRandom = function(i) {
        const hex = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
        window._cpmChange(i, hex);
    };
    window._cpmCopy = function(i, e) {
        const hex = document.getElementById('cpm-hex-' + i)?.value || '';
        navigator.clipboard?.writeText(hex).catch(() => {});
        if (e) _showCopyFeedback(e.clientX, e.clientY);
    };
    window._cpmApply = function() {
        if (!_customPalState) return;
        saveData.customPickerColors = _customPalState.slice();
        settings.colorPalette = '_custom_picker';
        settings.randomBlockColors = false;
        for (let i = 0; i < 7; i++) COLORS[i + 1] = _customPalState[i];
        saveSettings();
        saveDataToFile();
        _populateVisualCustomize();
        _populateInventoryOther();
        document.getElementById('custom-palette-modal')?.remove();
    };

    function applyBlockSkin(skin) {
        if (!_skinAvailable(skin)) return;
        const owned = (saveData.ownedSkins || ['neon']).includes(skin);
        if (!owned) {
            customAlert(`This skin is not yet unlocked.<br><br>Collect <b>parts</b> from the daily gift to unlock it.`, 'NOT OWNED', true);
            return;
        }
        settings.skin = skin;
        saveSettings();
        const sc = document.getElementById('owned-skin-btns');
        if (sc) _populateVisualCustomize();
    }
    function applyBlockShape(shape) {
        const s = BLOCK_SHAPES[shape];
        if (!s) return;
        if (!s.free && !(saveData.ownedBlockShapes||[]).includes(shape)) {
            customAlert(`This block shape is not yet unlocked.`, 'NOT OWNED', true);
            return;
        }
        settings.blockShape = shape;
        saveSettings();
        document.querySelectorAll('[data-blockshape]').forEach(btn => btn.classList.toggle('active', btn.dataset.blockshape === shape));
    }
    function applyStylePack(key) {
        const pack = STYLE_PACKS[key] || STYLE_PACKS.modern;
        settings.stylePack = key;
        settings.blockShape = pack.blockShape;
        document.documentElement.style.setProperty('--btn-radius', pack.btnRadius);
        document.documentElement.style.setProperty('--btn-clip', 'none');
        document.body.dataset.pack = key;
        document.querySelectorAll('[data-icon]').forEach(el => {
            const iconKey = el.dataset.icon;
            if (pack.icons[iconKey] !== undefined) el.innerHTML = pack.icons[iconKey];
        });
        document.querySelectorAll('link[data-pack-link]').forEach(el => el.remove());
        (pack.cssLinks || []).forEach(href => {
            if (document.querySelector(`link[href="${href}"]`)) return;
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = href; link.dataset.packLink = key;
            document.head.appendChild(link);
        });
        if (pack.font) document.documentElement.style.setProperty('--ui-font', pack.font);
        saveSettings();
    }

    let audioCtx = null, masterGain = null, sfxGain = null, musicPlaying = false;
    // All SFX are now fully synthesized — no file loading needed
    const _sfxBuffers = {};

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = _musicMuted ? 0 : settings.musicVol / 100 * 0.2;
            masterGain.connect(audioCtx.destination);
            sfxGain = audioCtx.createGain();
            sfxGain.gain.value = _sfxMuted ? 0 : settings.sfxVol / 100 * 0.4;
            sfxGain.connect(audioCtx.destination);
            // All SFX synthesized — no files to load
        }
    }

    function playSFX(type) {
        if (!audioCtx || settings.sfxVol === 0) return;
        if (settings.sfxPack === 'cyber') { _playSFX_B(type); return; }
        if (settings.sfxPack === 'retro') { _playSFX_C(type); return; }
        if (settings.sfxPack === 'zen') { _playSFX_D(type); return; }
        if (settings.sfxPack === 'arcade') { _playSFX_E(type); return; }
        const t = audioCtx.currentTime;
        if (type === 'clear') {
            [523, 659, 784, 1047].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type='sine'; o.frequency.value=freq;
                const s=t+i*0.06; g.gain.setValueAtTime(0.4,s); g.gain.exponentialRampToValueAtTime(0.001,s+0.2);
                o.start(s); o.stop(s+0.2);
            });
        } else if (type === 'drop') {
            // Deep thump
            const o1 = audioCtx.createOscillator(), g1 = audioCtx.createGain();
            o1.type = 'sine';
            o1.frequency.setValueAtTime(220, t); o1.frequency.exponentialRampToValueAtTime(38, t+0.09);
            g1.gain.setValueAtTime(0.85, t); g1.gain.exponentialRampToValueAtTime(0.001, t+0.18);
            o1.connect(g1); g1.connect(sfxGain); o1.start(t); o1.stop(t+0.2);
            // Click transient
            const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
            o2.type = 'square';
            o2.frequency.setValueAtTime(900, t); o2.frequency.exponentialRampToValueAtTime(80, t+0.025);
            g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.001, t+0.03);
            o2.connect(g2); g2.connect(sfxGain); o2.start(t); o2.stop(t+0.035);
            // Noise texture
            const _nb = _noiseBuffer(0.06);
            const _ns = audioCtx.createBufferSource(), _ng = audioCtx.createGain();
            _ns.buffer = _nb; _ng.gain.setValueAtTime(0.28, t); _ng.gain.exponentialRampToValueAtTime(0.001, t+0.055);
            _ns.connect(_ng); _ng.connect(sfxGain); _ns.start(t); _ns.stop(t+0.06);
        } else if (type === 'levelup') {
            [523, 659, 784].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type='square'; o.frequency.value=freq;
                const s=t+i*0.08; g.gain.setValueAtTime(0.25,s); g.gain.exponentialRampToValueAtTime(0.001,s+0.15);
                o.start(s); o.stop(s+0.15);
            });
        } else if (type === 'click') {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.connect(g); g.connect(sfxGain); o.type='sine'; o.frequency.value=900;
            g.gain.setValueAtTime(0.08,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.05);
            o.start(t); o.stop(t+0.06);
        } else if (type === 'gameover') {
            [440, 349, 294, 220].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type='square'; o.frequency.value=freq;
                const s=t+i*0.18; g.gain.setValueAtTime(0.3,s); g.gain.exponentialRampToValueAtTime(0.001,s+0.3);
                o.start(s); o.stop(s+0.32);
            });
        } else if (type === 'unlock') {
            // Ascending sparkle sound for unlocking/purchasing items
            [880, 1108, 1320, 1760, 2200].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type='sine'; o.frequency.value=freq;
                const s=t+i*0.07; g.gain.setValueAtTime(0.25,s); g.gain.exponentialRampToValueAtTime(0.001,s+0.18);
                o.start(s); o.stop(s+0.2);
            });
        } else if (type === 'gift') {
            // Magical chime for daily gift
            [1047, 1319, 1568, 1319, 1568, 2093].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type='sine'; o.frequency.value=freq;
                const s=t+i*0.09; g.gain.setValueAtTime(0.22,s); g.gain.exponentialRampToValueAtTime(0.001,s+0.22);
                o.start(s); o.stop(s+0.24);
            });
        } else if (type === 'booster') {
            // Power-up whoosh for using a booster
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.connect(g); g.connect(sfxGain); o.type='sawtooth';
            o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(1600, t+0.15);
            g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.25);
            o.start(t); o.stop(t+0.26);
            // Shimmer tail
            const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
            o2.connect(g2); g2.connect(sfxGain); o2.type='sine'; o2.frequency.value=1200;
            g2.gain.setValueAtTime(0.15, t+0.1); g2.gain.exponentialRampToValueAtTime(0.001, t+0.35);
            o2.start(t+0.1); o2.stop(t+0.36);
        } else if (type === 'achievement') {
            // Triumphant short fanfare for achievements
            [523, 659, 784, 1047, 1047].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type = i < 3 ? 'square' : 'sine'; o.frequency.value=freq;
                const s=t+i*0.1; const dur = i === 4 ? 0.3 : 0.12;
                g.gain.setValueAtTime(0.2,s); g.gain.exponentialRampToValueAtTime(0.001,s+dur);
                o.start(s); o.stop(s+dur+0.02);
            });
        } else if (type === 'newrecord') {
            // Bright triumphant 4-note fanfare for personal best
            [784, 988, 1175, 1568].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type = i < 2 ? 'square' : 'sine'; o.frequency.value=freq;
                const s=t+i*0.1; const dur = i === 3 ? 0.45 : 0.14;
                g.gain.setValueAtTime(0.22,s); g.gain.exponentialRampToValueAtTime(0.001,s+dur);
                o.start(s); o.stop(s+dur+0.02);
            });
        } else if (type === 'rankup') {
            // Grand ascending fanfare for XP level up (longer than levelup)
            [523, 659, 784, 1047, 1319, 1568].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type = i < 4 ? 'square' : 'sine'; o.frequency.value=freq;
                const s=t+i*0.09; const dur = i === 5 ? 0.35 : 0.15;
                g.gain.setValueAtTime(0.22,s); g.gain.exponentialRampToValueAtTime(0.001,s+dur);
                o.start(s); o.stop(s+dur+0.02);
            });
            // Harmony layer
            [330, 415, 494, 659].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type='sine'; o.frequency.value=freq;
                const s=t+i*0.09+0.04; g.gain.setValueAtTime(0.1,s); g.gain.exponentialRampToValueAtTime(0.001,s+0.2);
                o.start(s); o.stop(s+0.22);
            });
        } else if (type === 'newrank') {
            // Full fanfare with harmonics for new rank (Bronze->Silver etc.)
            // Main melody — triumphant ascending
            [523, 659, 784, 1047, 1319, 1568, 2093].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type = i < 4 ? 'square' : 'sine'; o.frequency.value=freq;
                const s=t+i*0.1; const dur = i === 6 ? 0.5 : 0.18;
                g.gain.setValueAtTime(0.25,s); g.gain.exponentialRampToValueAtTime(0.001,s+dur);
                o.start(s); o.stop(s+dur+0.02);
            });
            // Harmony — thirds below
            [415, 523, 659, 831, 1047, 1319].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type='sine'; o.frequency.value=freq;
                const s=t+i*0.1+0.05; g.gain.setValueAtTime(0.12,s); g.gain.exponentialRampToValueAtTime(0.001,s+0.22);
                o.start(s); o.stop(s+0.24);
            });
            // Bass octave pulse
            [262, 330, 392, 523].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.connect(g); g.connect(sfxGain); o.type='triangle'; o.frequency.value=freq;
                const s=t+i*0.15; g.gain.setValueAtTime(0.15,s); g.gain.exponentialRampToValueAtTime(0.001,s+0.25);
                o.start(s); o.stop(s+0.27);
            });
        }
    }
    // --- SFX PACK B: "Cyber" — darker, glitchy, industrial vibe ---
    function _playSFX_B(type) {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        if (type === 'clear') {
            // Metallic sweep down then burst
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(2000, t); o.frequency.exponentialRampToValueAtTime(200, t+0.12);
            g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.2);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.22);
            // Burst
            const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
            o2.type = 'square'; o2.frequency.value = 440;
            g2.gain.setValueAtTime(0.2, t+0.1); g2.gain.exponentialRampToValueAtTime(0.001, t+0.25);
            o2.connect(g2); g2.connect(sfxGain); o2.start(t+0.1); o2.stop(t+0.27);
        } else if (type === 'drop') {
            // Heavy digital thud — low square + noise crunch
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'square'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(35, t+0.06);
            g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.1);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.12);
            // Crunch noise
            const nb = _noiseBuffer(0.04);
            const ns = audioCtx.createBufferSource(), ng = audioCtx.createGain();
            ns.buffer = nb; ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.001, t+0.05);
            ns.connect(ng); ng.connect(sfxGain); ns.start(t); ns.stop(t+0.06);
        } else if (type === 'levelup') {
            // Glitchy ascending — rapid pitch steps
            [220, 330, 440, 660, 880].forEach((freq, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sawtooth'; o.frequency.value = freq;
                const s = t + i * 0.05; g.gain.setValueAtTime(0.2, s); g.gain.exponentialRampToValueAtTime(0.001, s+0.06);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s+0.07);
            });
        } else if (type === 'click') {
            // Digital tick — very short square pulse
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'square'; o.frequency.value = 1400;
            g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.02);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.03);
        } else if (type === 'gameover') {
            // Distorted descending — sawtooth grind
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(50, t+0.8);
            g.gain.setValueAtTime(0.3, t); g.gain.linearRampToValueAtTime(0.001, t+0.9);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+1);
            // Static overlay
            const nb = _noiseBuffer(0.5);
            const ns = audioCtx.createBufferSource(), ng = audioCtx.createGain();
            ns.buffer = nb; ng.gain.setValueAtTime(0.08, t); ng.gain.linearRampToValueAtTime(0.001, t+0.7);
            ns.connect(ng); ng.connect(sfxGain); ns.start(t); ns.stop(t+0.75);
        } else if (type === 'unlock') {
            // Electric zap ascending
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(3000, t+0.15);
            g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.2);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.22);
            // Sparkle tail
            [2400, 3200, 4000].forEach((f, i) => {
                const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
                o2.type = 'sine'; o2.frequency.value = f;
                const s = t + 0.12 + i * 0.04;
                g2.gain.setValueAtTime(0.1, s); g2.gain.exponentialRampToValueAtTime(0.001, s+0.08);
                o2.connect(g2); g2.connect(sfxGain); o2.start(s); o2.stop(s+0.1);
            });
        } else if (type === 'gift') {
            // Mysterious reveal — low rumble then chime
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'triangle'; o.frequency.value = 80;
            g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.2);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.22);
            [660, 880, 1320].forEach((f, i) => {
                const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
                o2.type = 'sine'; o2.frequency.value = f;
                const s = t + 0.15 + i * 0.08;
                g2.gain.setValueAtTime(0.18, s); g2.gain.exponentialRampToValueAtTime(0.001, s+0.15);
                o2.connect(g2); g2.connect(sfxGain); o2.start(s); o2.stop(s+0.17);
            });
        } else if (type === 'booster') {
            // Turbine spin-up
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(2500, t+0.3);
            g.gain.setValueAtTime(0.15, t); g.gain.setValueAtTime(0.25, t+0.15); g.gain.exponentialRampToValueAtTime(0.001, t+0.4);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.42);
        } else if (type === 'achievement') {
            // Cyber horn — two-tone power chord
            [330, 440].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.35);
                o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.37);
            });
            // Impact hit
            const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
            o2.type = 'sawtooth'; o2.frequency.setValueAtTime(1200, t); o2.frequency.exponentialRampToValueAtTime(200, t+0.05);
            g2.gain.setValueAtTime(0.3, t); g2.gain.exponentialRampToValueAtTime(0.001, t+0.08);
            o2.connect(g2); g2.connect(sfxGain); o2.start(t); o2.stop(t+0.1);
        } else if (type === 'rankup') {
            // Rising power — stacked fifths
            [165, 247, 330, 494, 660].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sawtooth'; o.frequency.value = f;
                const s = t + i * 0.08;
                g.gain.setValueAtTime(0.18, s); g.gain.exponentialRampToValueAtTime(0.001, s+0.2);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s+0.22);
            });
            // Sub bass
            const ob = audioCtx.createOscillator(), gb = audioCtx.createGain();
            ob.type = 'triangle'; ob.frequency.value = 82;
            gb.gain.setValueAtTime(0.2, t); gb.gain.exponentialRampToValueAtTime(0.001, t+0.5);
            ob.connect(gb); gb.connect(sfxGain); ob.start(t); ob.stop(t+0.52);
        } else if (type === 'newrecord') {
            [880, 1109, 1319, 1760].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t+i*0.09; const dur = i===3?0.4:0.12;
                g.gain.setValueAtTime(0.18, s); g.gain.exponentialRampToValueAtTime(0.001, s+dur);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s+dur+0.02);
            });
        } else if (type === 'newrank') {
            // Epic industrial fanfare — layered power chords
            [165, 220, 330].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sawtooth'; o.frequency.value = f;
                g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0.25, t+0.2); g.gain.exponentialRampToValueAtTime(0.001, t+0.8);
                o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t+0.82);
            });
            // Second chord delayed
            [247, 330, 494].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t + 0.3;
                g.gain.setValueAtTime(0.15, s); g.gain.exponentialRampToValueAtTime(0.001, s+0.5);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s+0.52);
            });
            // Rising noise sweep
            const nb = _noiseBuffer(0.6);
            const ns = audioCtx.createBufferSource(), ng = audioCtx.createGain();
            ns.buffer = nb; ng.gain.setValueAtTime(0.01, t); ng.gain.linearRampToValueAtTime(0.1, t+0.3); ng.gain.exponentialRampToValueAtTime(0.001, t+0.6);
            ns.connect(ng); ng.connect(sfxGain); ns.start(t); ns.stop(t+0.65);
        }
    }

    // --- SFX PACK C: "Retro" — warm 8-bit, playful chiptune vibe ---
    function _playSFX_C(type) {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        if (type === 'clear') {
            // Quick 8-bit arpeggio up
            [262, 330, 392, 523].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t + i * 0.04; g.gain.setValueAtTime(0.18, s); g.gain.setValueAtTime(0.001, s + 0.035);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.04);
            });
        } else if (type === 'drop') {
            // Blip down
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'square'; o.frequency.setValueAtTime(300, t); o.frequency.setValueAtTime(80, t + 0.03);
            g.gain.setValueAtTime(0.3, t); g.gain.setValueAtTime(0.001, t + 0.06);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.07);
        } else if (type === 'levelup') {
            // Mario-style power up
            [523, 659, 784, 1047, 1319].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t + i * 0.06; g.gain.setValueAtTime(0.15, s); g.gain.setValueAtTime(0.001, s + 0.055);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.06);
            });
        } else if (type === 'click') {
            // Tiny blip
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'square'; o.frequency.value = 660;
            g.gain.setValueAtTime(0.06, t); g.gain.setValueAtTime(0.001, t + 0.02);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.025);
        } else if (type === 'gameover') {
            // Sad descending — classic game over
            [392, 349, 330, 262, 220, 196].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t + i * 0.12; g.gain.setValueAtTime(0.2, s); g.gain.setValueAtTime(0.001, s + 0.11);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.12);
            });
        } else if (type === 'unlock') {
            // Coin collect — two quick notes
            const o1 = audioCtx.createOscillator(), g1 = audioCtx.createGain();
            o1.type = 'square'; o1.frequency.value = 988;
            g1.gain.setValueAtTime(0.2, t); g1.gain.setValueAtTime(0.001, t + 0.06);
            o1.connect(g1); g1.connect(sfxGain); o1.start(t); o1.stop(t + 0.07);
            const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
            o2.type = 'square'; o2.frequency.value = 1319;
            g2.gain.setValueAtTime(0.2, t + 0.07); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            o2.connect(g2); g2.connect(sfxGain); o2.start(t + 0.07); o2.stop(t + 0.22);
        } else if (type === 'gift') {
            // Treasure chest — ascending with trill
            [262, 330, 392, 523, 523, 659].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t + i * 0.07; g.gain.setValueAtTime(0.15, s); g.gain.setValueAtTime(0.001, s + 0.06);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.07);
            });
        } else if (type === 'booster') {
            // Speed boost — rising pitch sweep square
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'square'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.15);
            g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.22);
        } else if (type === 'achievement') {
            // Zelda-style item get — da-da-da-DAAA
            [392, 392, 392, 523].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t + i * 0.1; const dur = i === 3 ? 0.3 : 0.08;
                g.gain.setValueAtTime(0.2, s); g.gain.exponentialRampToValueAtTime(0.001, s + dur);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + dur + 0.02);
            });
        } else if (type === 'rankup') {
            // Fanfare — classic RPG level up
            [262, 330, 392, 523, 392, 523, 659].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t + i * 0.08; const dur = i === 6 ? 0.25 : 0.07;
                g.gain.setValueAtTime(0.18, s); g.gain.exponentialRampToValueAtTime(0.001, s + dur);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + dur + 0.02);
            });
        } else if (type === 'newrecord') {
            [523, 659, 784, 1047].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t+i*0.09; const dur = i===3?0.35:0.1;
                g.gain.setValueAtTime(0.18, s); g.gain.exponentialRampToValueAtTime(0.001, s+dur);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s+dur+0.02);
            });
        } else if (type === 'newrank') {
            // Grand 8-bit fanfare — two-part
            [262, 330, 392, 523].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t + i * 0.08; g.gain.setValueAtTime(0.2, s); g.gain.setValueAtTime(0.001, s + 0.07);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.08);
            });
            [523, 659, 784, 1047].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square'; o.frequency.value = f;
                const s = t + 0.4 + i * 0.1; const dur = i === 3 ? 0.35 : 0.08;
                g.gain.setValueAtTime(0.2, s); g.gain.exponentialRampToValueAtTime(0.001, s + dur);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + dur + 0.02);
            });
        }
    }

    // --- SFX PACK D: "Zen" — soft, organic, calm ambient vibe ---
    function _playSFX_D(type) {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        if (type === 'clear') {
            // Gentle bell chord
            [528, 660, 792].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                const s = t + i * 0.05; g.gain.setValueAtTime(0.15, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.4);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.42);
            });
        } else if (type === 'drop') {
            // Soft pluck — sine with fast decay
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sine'; o.frequency.value = 220;
            g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.14);
        } else if (type === 'levelup') {
            // Wind chime ascending
            [440, 554, 659, 880].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                const s = t + i * 0.12; g.gain.setValueAtTime(0.12, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.35);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.37);
            });
        } else if (type === 'click') {
            // Tiny water drop
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sine'; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(800, t + 0.04);
            g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.07);
        } else if (type === 'gameover') {
            // Slow fading chord — melancholy
            [220, 262, 330].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                g.gain.setValueAtTime(0.15, t); g.gain.linearRampToValueAtTime(0.001, t + 1.2);
                o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 1.25);
            });
        } else if (type === 'unlock') {
            // Harp glissando
            [523, 587, 659, 784, 880, 988, 1047].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                const s = t + i * 0.05; g.gain.setValueAtTime(0.1, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.25);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.27);
            });
        } else if (type === 'gift') {
            // Music box melody
            [659, 784, 659, 523, 659].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                const s = t + i * 0.13; g.gain.setValueAtTime(0.12, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.2);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.22);
            });
        } else if (type === 'booster') {
            // Breeze whoosh — filtered noise
            const nb = _noiseBuffer(0.3);
            const ns = audioCtx.createBufferSource(), ng = audioCtx.createGain();
            ns.buffer = nb;
            ng.gain.setValueAtTime(0.001, t); ng.gain.linearRampToValueAtTime(0.12, t + 0.1); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            ns.connect(ng); ng.connect(sfxGain); ns.start(t); ns.stop(t + 0.32);
            // Subtle tone
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sine'; o.frequency.value = 440;
            g.gain.setValueAtTime(0.08, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            o.connect(g); g.connect(sfxGain); o.start(t + 0.05); o.stop(t + 0.27);
        } else if (type === 'achievement') {
            // Gentle triumph — major chord bloom
            [523, 659, 784].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.15, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
                o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.52);
            });
        } else if (type === 'newrecord') {
            [440, 554, 659, 880].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                const s = t + i * 0.09; const dur = i===3?0.4:0.12;
                g.gain.setValueAtTime(0.001, s); g.gain.linearRampToValueAtTime(0.15, s+0.04); g.gain.exponentialRampToValueAtTime(0.001, s+dur);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s+dur+0.02);
            });
        } else if (type === 'rankup') {
            // Ethereal ascending — sine layers
            [330, 440, 554, 659, 880].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                const s = t + i * 0.1;
                g.gain.setValueAtTime(0.001, s); g.gain.linearRampToValueAtTime(0.12, s + 0.05); g.gain.exponentialRampToValueAtTime(0.001, s + 0.4);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.42);
            });
        } else if (type === 'newrank') {
            // Celestial — layered sines with slow bloom
            [262, 330, 392, 523].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 1);
                o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 1.02);
            });
            // High shimmer
            [1047, 1319, 1568].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                const s = t + 0.3 + i * 0.15;
                g.gain.setValueAtTime(0.001, s); g.gain.linearRampToValueAtTime(0.08, s + 0.05); g.gain.exponentialRampToValueAtTime(0.001, s + 0.5);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.52);
            });
        }
    }

    // --- SFX PACK E: "Arcade" — punchy, loud, classic arcade cabinet ---
    function _playSFX_E(type) {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        if (type === 'clear') {
            // Explosion burst + ping
            const nb = _noiseBuffer(0.08);
            const ns = audioCtx.createBufferSource(), ng = audioCtx.createGain();
            ns.buffer = nb; ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            ns.connect(ng); ng.connect(sfxGain); ns.start(t); ns.stop(t + 0.09);
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sine'; o.frequency.value = 1200;
            g.gain.setValueAtTime(0.2, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            o.connect(g); g.connect(sfxGain); o.start(t + 0.03); o.stop(t + 0.17);
        } else if (type === 'drop') {
            // Punch — very short loud hit
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(250, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.04);
            g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.07);
        } else if (type === 'levelup') {
            // Rapid fire pew-pew ascending
            [440, 660, 880, 1320, 1760].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'triangle'; o.frequency.setValueAtTime(f, t + i * 0.04); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + i * 0.04 + 0.03);
                g.gain.setValueAtTime(0.2, t + i * 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.04);
                o.connect(g); g.connect(sfxGain); o.start(t + i * 0.04); o.stop(t + i * 0.04 + 0.05);
            });
        } else if (type === 'click') {
            // Hard tick
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'triangle'; o.frequency.value = 2000;
            g.gain.setValueAtTime(0.12, t); g.gain.setValueAtTime(0.001, t + 0.015);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.02);
        } else if (type === 'gameover') {
            // Alarm siren + crash
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(800, t); o.frequency.setValueAtTime(400, t + 0.15); o.frequency.setValueAtTime(800, t + 0.3); o.frequency.setValueAtTime(200, t + 0.5);
            g.gain.setValueAtTime(0.25, t); g.gain.linearRampToValueAtTime(0.001, t + 0.7);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.72);
        } else if (type === 'unlock') {
            // Ka-ching! — cash register
            [1568, 2093].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'triangle'; o.frequency.value = f;
                g.gain.setValueAtTime(0.25, t + i * 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15);
                o.connect(g); g.connect(sfxGain); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.17);
            });
        } else if (type === 'gift') {
            // Slot machine jackpot — slower repeating note then big chord
            for (let i = 0; i < 6; i++) {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'triangle'; o.frequency.value = 880;
                const s = t + i * 0.09; g.gain.setValueAtTime(0.15, s); g.gain.setValueAtTime(0.001, s + 0.06);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.07);
            }
            [523, 659, 784, 1047].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'triangle'; o.frequency.value = f;
                g.gain.setValueAtTime(0.2, t + 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + 1);
                o.connect(g); g.connect(sfxGain); o.start(t + 0.6); o.stop(t + 1.02);
            });
        } else if (type === 'booster') {
            // Laser charge — rising then pop
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(3000, t + 0.2);
            g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.24);
            // Pop
            const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
            o2.type = 'sine'; o2.frequency.setValueAtTime(3000, t + 0.2); o2.frequency.exponentialRampToValueAtTime(500, t + 0.25);
            g2.gain.setValueAtTime(0.3, t + 0.2); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            o2.connect(g2); g2.connect(sfxGain); o2.start(t + 0.2); o2.stop(t + 0.32);
        } else if (type === 'achievement') {
            // Victory punch — impact + horn
            const nb = _noiseBuffer(0.03);
            const ns = audioCtx.createBufferSource(), ng = audioCtx.createGain();
            ns.buffer = nb; ng.gain.setValueAtTime(0.4, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            ns.connect(ng); ng.connect(sfxGain); ns.start(t); ns.stop(t + 0.05);
            [523, 659].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sawtooth'; o.frequency.value = f;
                g.gain.setValueAtTime(0.2, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                o.connect(g); g.connect(sfxGain); o.start(t + 0.03); o.stop(t + 0.27);
            });
        } else if (type === 'rankup') {
            // Stadium horn — big brassy, slower
            [262, 330, 392].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sawtooth'; o.frequency.value = f;
                g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
                o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.62);
            });
            [523, 659, 784].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sawtooth'; o.frequency.value = f;
                const s = t + 0.4; g.gain.setValueAtTime(0.001, s); g.gain.linearRampToValueAtTime(0.18, s + 0.05); g.gain.exponentialRampToValueAtTime(0.001, s + 0.5);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + 0.52);
            });
        } else if (type === 'newrecord') {
            [392, 523, 659, 784].forEach((f, i) => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'sawtooth'; o.frequency.value = f;
                const s = t+i*0.09; const dur = i===3?0.4:0.12;
                g.gain.setValueAtTime(0.001, s); g.gain.linearRampToValueAtTime(0.16, s+0.04); g.gain.exponentialRampToValueAtTime(0.001, s+dur);
                o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s+dur+0.02);
            });
        } else if (type === 'newrank') {
            // Full stadium — three waves of horns, slower buildup
            [[262,330,392],[392,494,587],[523,659,784]].forEach((chord, ci) => {
                chord.forEach(f => {
                    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                    o.type = 'sawtooth'; o.frequency.value = f;
                    const s = t + ci * 0.4;
                    g.gain.setValueAtTime(0.001, s); g.gain.linearRampToValueAtTime(ci === 2 ? 0.22 : 0.15, s + 0.06); g.gain.exponentialRampToValueAtTime(0.001, s + (ci === 2 ? 0.8 : 0.45));
                    o.connect(g); g.connect(sfxGain); o.start(s); o.stop(s + (ci === 2 ? 0.82 : 0.47));
                });
            });
        }
    }

    let _menuSourceNode = null;
    let _currentMode = 'menu';
    let _menuFileNames = [];
    let _currentMenuTrackIdx = 0;
    let _gameFileNames = [];
    let _gameSourceNode = null;
    let _actionFileNames = [];
    let _musicCatalogPromise;
    let _nowPlayingName = '';
    let _nowPlayingArtist = '';
    let _trackStartTime = 0;
    let _trackPauseOffset = 0;
    let _trackDuration = 0;
    let _musicPaused = false;
    let _widgetIntervalId = null;
    const _trackPool = new Map();
    let _settingsTrackPollId = null;
    let _menuShuffleQueue = []; // queue-based no-repeat playback
    function _createMusicSource(descriptor) {
        if (descriptor.synth) return window.LBMusicSynth.createSource(audioCtx, descriptor);
        const media = new Audio(); media.preload = 'metadata';
        media.src = descriptor.url;
        const node = audioCtx.createMediaElementSource(media);
        let stopped = false, paused = false;
        const source = {
            onended: null,
            connect(target) { node.connect(target); },
            start(when=0, offset=0) {
                const ready = () => {
                    if (stopped) return;
                    if (Number.isFinite(media.duration)) {
                        descriptor.duration=media.duration;
                        if (_menuSourceNode === source || _gameSourceNode === source) {
                            _trackDuration=media.duration;
                            _currentTrackDuration30s=media.duration;
                        }
                    }
                    media.currentTime=Math.max(0,Math.min(offset,Math.max(0,(media.duration||Infinity)-0.1)));
                    if (!paused) media.play().catch(error => { if (!stopped) console.error('Music playback failed:',error); });
                };
                if (media.readyState >= 1) ready();
                else media.addEventListener('loadedmetadata',ready,{once:true});
            },
            pause() { paused=true; media.pause(); },
            resume() {
                paused=false;
                if (!stopped && media.readyState>=1) media.play().catch(error => console.error('Music resume failed:',error));
            },
            stop() {
                stopped=true; media.pause(); media.removeAttribute('src'); media.load(); node.disconnect();
            }
        };
        media.onended=() => { node.disconnect(); if (!stopped && source.onended) source.onended(); };
        media.onerror=() => { if (!stopped) console.error('Music load failed:',descriptor?.url); };
        return source;
    }
    function _fillMenuQueue(playlist, currentName) {
        const copy = [...playlist];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        // avoid immediate repeat of currently playing track
        if (copy.length > 1 && copy[0] === currentName) copy.push(copy.shift());
        _menuShuffleQueue.push(...copy);
    }
    function _playMenuFileTrack(idx) {
        const playlist = _getPlaylist('menu');
        if (!playlist.length) return;
        const realIdx = ((idx % playlist.length) + playlist.length) % playlist.length;
        _currentMenuTrackIdx = realIdx;
        _playMenuTrack(playlist[realIdx]);
    }
    function _playMenuTrack(name, offset = 0) {
        const entry = _trackPool.get(name);
        if (!musicPlaying || !audioCtx || !entry) return;
        _menuSourceNode?.stop();
        _musicPaused = false;
        _trackPauseOffset = Math.max(0, Math.min(offset, (entry.buf.duration || Infinity) - 0.1));
        const src = _createMusicSource(entry.buf);
        src.connect(masterGain);
        src.onended = () => {
            if (!musicPlaying || _currentMode !== 'menu' || _musicPaused) return;
            const pl = _getPlaylist('menu');
            _menuShuffleQueue = _menuShuffleQueue.filter(track => pl.includes(track));
            if (!_menuShuffleQueue.length) _fillMenuQueue(pl, name);
            const nextName = _menuShuffleQueue.shift();
            const nextIdx = pl.indexOf(nextName);
            _playMenuFileTrack(nextIdx >= 0 ? nextIdx : 0);
        };
        _trackStartTime = audioCtx.currentTime;
        _trackDuration = entry.buf.duration;
        _menuSourceNode = src;
        src.start(0, _trackPauseOffset);
        updateNowPlaying(name, entry.artist);
        if (!document.getElementById('playlist-overlay')?.classList.contains('hidden')) _renderPlaylistPanel();
    }
    function _startGameMusicForCurrentSpeed() {
        if (!musicPlaying || !audioCtx || _currentMode !== 'game') return;
        const game = _getPlaylist('game');
        const intense = _getPlaylist('action');
        const playlist = intense.length && (!game.length || Math.random() < 0.38) ? intense : game;
        if (!playlist.length) return;
        const choices = playlist.length > 1 ? playlist.filter(name => name !== _nowPlayingName) : playlist;
        const name = choices[Math.floor(Math.random() * choices.length)];
        const entry = _trackPool.get(name);
        _gameSourceNode?.stop();
        const src = _createMusicSource(entry.buf);
        src.connect(masterGain);
        src.onended = () => {
            if (_gameSourceNode === src) _startGameMusicForCurrentSpeed();
        };
        _gameSourceNode = src;
        _trackStartTime = audioCtx.currentTime;
        _trackDuration = entry.buf.duration;
        src.start();
        updateNowPlaying(name, entry.artist);
    }
    async function _startMenuMusic() {
        await _initTrackCatalog();
        if (_currentMode !== 'menu' || !musicPlaying || _menuSourceNode || _musicPaused) return;
        const pl = _getPlaylist('menu');
        _menuShuffleQueue = [];
        _fillMenuQueue(pl, '');
        _playMenuFileTrack(pl.indexOf(_menuShuffleQueue.shift()));
    }
    function startMusic(mode = 'menu') {
        if (musicPlaying) return;
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        musicPlaying = true;
        // Sync mute icons with actual settings.musicVol
        const _isMuted = settings.musicVol === 0;
        const _isPix = settings.stylePack === 'pixel';
        const _muteIco = _isMuted ? (_isPix ? _SVG_PIX_MUTED : _SVG_MUTED) : (_isPix ? _SVG_PIX_VOL : _SVG_VOL);
        const _mwMute = document.getElementById('mw-mute');
        if (_mwMute) _mwMute.innerHTML = _muteIco;
        const _plMwMute = document.getElementById('pl-mw-mute');
        if (_plMwMute) _plMwMute.innerHTML = (_isMuted ? _SVG_MUTED : _SVG_VOL).replace('width="14"','width="11"').replace('height="14"','height="11"');
        switchMusicMode(mode);
    }
    function _stopMusicSources() {
        if (_menuSourceNode) { try { _menuSourceNode.stop(); } catch(e) {} _menuSourceNode = null; }
        if (_gameSourceNode) { try { _gameSourceNode.stop(); } catch(e) {} _gameSourceNode = null; }
        _musicPaused = false;
        _trackPauseOffset = _trackStartTime = _trackDuration = 0;
    }
    async function switchMusicMode(mode) {
        _stopMusicSources();
        _currentMode = mode;
        _menuShuffleQueue = [];
        updateNowPlaying('');
        if (!musicPlaying || !audioCtx) return;
        if (mode === 'menu') {
            _startMenuMusic();
        } else {
            await _initTrackCatalog();
            if (_currentMode !== 'game' || !musicPlaying || _gameSourceNode) return;
            _startGameMusicForCurrentSpeed();
            if (audioCtx && masterGain) {
                const targetVol = _musicMuted ? 0 : settings.musicVol / 100 * 0.2;
                masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
                masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
                masterGain.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 1.5);
            }
        }
    }
    function stopMusic() {
        musicPlaying = false;
        _stopMusicSources();
        if (audioCtx) { audioCtx.close().catch(()=>{}); audioCtx = null; masterGain = null; sfxGain = null; }
    }
    function pauseMusic() {
        [_menuSourceNode,_gameSourceNode].forEach(source=>source?.pause());
        if (audioCtx && audioCtx.state==='running') audioCtx.suspend();
    }
    function resumeMusic() {
        if (audioCtx && audioCtx.state==='suspended') audioCtx.resume();
        [_menuSourceNode,_gameSourceNode].forEach(source=>source?.resume());
    }
    // === END MUSIC SYSTEM ===

    // Pulsowanie przycisku PLAY z cykliczną zmianą koloru
    let _playBtnInterval = null;
    function randomizePlayButton() {
        const btn = document.getElementById('btn-play');
        if (!btn) return;
        clearInterval(_playBtnInterval);
        btn.classList.add('play-color-cycle');
        if (!btn._shimmerListenerAttached) {
            btn._shimmerListenerAttached = true;
            btn.addEventListener('mouseenter', () => {
                if (btn.classList.contains('shimmer-cooldown')) return;
                setTimeout(() => {
                    btn.classList.add('shimmer-cooldown');
                    setTimeout(() => btn.classList.remove('shimmer-cooldown'), 1000);
                }, 600);
            });
        }
        if (!_widgetIntervalId) {
            _widgetIntervalId = setInterval(() => {
                if (_currentMode === 'menu' && !_musicPaused && _trackDuration > 0) _updateMusicWidget();
            }, 500);
        }
    }

    async function _readMusicCatalog(path) {
        try {
            const response = await fetch(path);
            return response.ok ? (await response.json()) || {} : {};
        } catch (error) { return {}; }
    }

    async function _registerTracks(tracks) {
        const names = await Promise.all(tracks.map(async track => {
            const synth = window.LBMusicSynth?.getTrack(track.synth);
            let buf;
            if (synth) buf = { synth, duration: synth.duration };
            else if (track.file) {
                const url = 'assets/music/' + encodeURIComponent(track.file);
                try {
                    const response = await fetch(url, { method: 'HEAD' });
                    if (response.ok && !response.headers?.get('content-type')?.startsWith('text/html')) buf = { url, duration: 0 };
                } catch (error) {}
            }
            if (!buf) return null;
            const name = track.title || track.file?.replace(/\.mp3$/i, '');
            if (name && !_trackPool.has(name)) _trackPool.set(name, { buf, artist: track.artist || '', tags: track.tags || [] });
            return name;
        }));
        return [...new Set(names.filter(Boolean))];
    }

    function _initTrackCatalog() {
        return _musicCatalogPromise ||= (async () => {
            const local = await _readMusicCatalog('assets/music.json');
            const hasSynth = Object.values(local).some(tracks => Array.isArray(tracks) && tracks.some(track => track.synth));
            const original = hasSynth ? {} : await _readMusicCatalog('assets/music.release.json');
            [_menuFileNames, _gameFileNames, _actionFileNames] = await Promise.all([
                _registerTracks([...(original.menu || []), ...(local.menu || [])]),
                _registerTracks([...(original.game || []), ...(local.game || [])]),
                _registerTracks([...(original.intense || []), ...(local.intense || []), ...(local.action || [])])
            ]);
        })();
    }

    async function loadData() {
        // Failsafe: if something hangs, dismiss loading screen after 8s
        const _loadTimeout = setTimeout(() => {
            const ls = document.getElementById('loading-screen');
            if (ls && !ls.dataset.dismissed) {
                console.warn('Tetris RPG: load timeout — forcing start');
                showFileSetup(null);
            }
        }, 8000);
        try {
            _initTrackCatalog(); // fire-and-forget: populates catalog from JSON, no AudioContext needed
            _setLoadProgress(55, 'Checking save data…');
            const existingHandle = _desktopSave ? null : await getHandleFromIDB();
            _setLoadProgress(75, 'Loading save file…');
            showFileSetup(existingHandle);
        } catch(e) {
            console.error('loadData error:', e);
            showFileSetup(null);
        } finally {
            clearTimeout(_loadTimeout);
        }
    }

    function _setLoadProgress(pct, label) {
        const bar = document.getElementById('ls-bar');
        const statusEl = document.getElementById('ls-status');
        if (bar) bar.style.width = Math.min(100, pct) + '%';
        if (statusEl && label) statusEl.textContent = label;
    }
    function _dismissLoadingScreen() {
        const ls = document.getElementById('loading-screen');
        if (!ls || ls.dataset.dismissed) return;
        ls.dataset.dismissed = '1';
        _setLoadProgress(100, 'Ready!');
        setTimeout(() => {
            ls.classList.add('ls-hidden');
            setTimeout(() => { ls.style.display = 'none'; }, 600);
        }, 350);
    }

    function applyLoadedData(data) {
        data = sanitizeSave(data, { ...defaultSaveData, _settings: defaultSettings }, { palettes: BLOCK_PALETTES, boosters: BOOSTER_INFO, ranks: [...RANKS, CELESTITE_RANK], missionDefaults: _defaultMissions(), items: _getAllPartsItems() });
        if (data && typeof data.totalXP === 'number') {
            saveData = { ...JSON.parse(JSON.stringify(defaultSaveData)), ...data };
            if (data.stats) saveData.stats = { ...defaultSaveData.stats, ...data.stats };
            if (!saveData.ownedSkins) saveData.ownedSkins = ['neon'];
            if (!saveData.ownedThemes) saveData.ownedThemes = [];
            if (!saveData.boosters) saveData.boosters = {};
            if (!saveData.parts) saveData.parts = {};
            if (saveData.universalParts == null) saveData.universalParts = 0;
            if (!saveData.ownedFonts) saveData.ownedFonts = ['Orbitron'];
            if (!saveData.ownedBtnStyles) saveData.ownedBtnStyles = [];
            if (saveData.ghostColorUnlocked == null) saveData.ghostColorUnlocked = false;
            if (!saveData.ownedSfxPacks) saveData.ownedSfxPacks = ['default'];
            if (!saveData.ownedPalettes) saveData.ownedPalettes = ['classic'];
            if (!saveData.customPaletteOverrides) saveData.customPaletteOverrides = {};
            // Migrate old booster keys
            if (saveData.boosters['1.3x_game']) { saveData.boosters['1.25x_game'] = (saveData.boosters['1.25x_game']||0) + saveData.boosters['1.3x_game']; delete saveData.boosters['1.3x_game']; }
            if (saveData.boosters['1.6x_game']) { saveData.boosters['1.5x_game'] = (saveData.boosters['1.5x_game']||0) + saveData.boosters['1.6x_game']; delete saveData.boosters['1.6x_game']; }
            // Remove deprecated/removed skins from owned
            saveData.ownedSkins = saveData.ownedSkins.filter(s => !['matrix','gold','golddragon','lava','circuit','marble','fire','toxic','ice','flat','glossy','metal','puffy','bordered','gloss2k','lumines','minimal'].includes(s));
            // If active skin is a removed one, reset to neon
            const _removedSkins = ['metal','puffy','bordered','gloss2k','lumines','minimal'];
            if (_removedSkins.includes(settings.skin)) { settings.skin = 'neon'; saveSettings(); }
            // If active skin/theme from localStorage is not in ownedSkins (e.g. file write lagged), restore ownership
            const _validSkins = ['neon','retro','glass','shadow','outline','holo','journey','gem','bubble','gameboy','monochrome','modern','candy','vim','aerolab','classic','window'];
            const _activeSkin = settings.skin || 'neon';
            if (_skinAvailable(_activeSkin) && _validSkins.includes(_activeSkin) && !saveData.ownedSkins.includes(_activeSkin)) {
                saveData.ownedSkins.push(_activeSkin);
            }
            const _validThemes = ['default','ocean','forest','fire','dragon','void','sunset','arctic','midnight','sakura'];
            const _activeTheme = settings.theme || 'default';
            if (_activeTheme !== 'default' && _validThemes.includes(_activeTheme) && !saveData.ownedThemes.includes(_activeTheme)) {
                saveData.ownedThemes.push(_activeTheme);
            }
            // Ensure pinnedScores array exists
            if (!saveData.pinnedScores) saveData.pinnedScores = [];
            // Ensure achievements exists
            if (!saveData.achievements) saveData.achievements = {};
            if (!saveData.pendingAchievementClaims) saveData.pendingAchievementClaims = [];
            if (!saveData.stats.blockTypeUsage) saveData.stats.blockTypeUsage = {};
            if (!saveData.funLeaderboard) saveData.funLeaderboard = [];
            // Load settings from file only when no local settings exist (new device / first run)
            // localStorage is authoritative — avoids stale file overwriting fresh settings on reload
            if (data._settings && !localStorage.getItem('tetrisRPG_settings')) {
                Object.assign(settings, { ...defaultSettings, ...data._settings });
                localStorage.setItem('tetrisRPG_settings', JSON.stringify(settings));
                _doApplyTheme(settings.theme || 'default');
                applyFontSize(settings.fontSize || '5');
                applyGameScale(settings.gameScale || '5');
                applyStylePack(settings.stylePack || 'modern');
                _applyColorPalette(settings.colorPalette || 'classic');
            } else {
                // Always apply visual/scale from localStorage (already loaded by loadSettings())
                _doApplyTheme(settings.theme || 'default');
                applyFontSize(settings.fontSize || '5');
                applyGameScale(settings.gameScale || '5');
                applyStylePack(settings.stylePack || 'modern');
                _applyColorPalette(settings.colorPalette || 'classic');
                // Migration: reset btn style to square if current style is not owned/free
                if (settings.btnStyle && !BTN_STYLES[settings.btnStyle]?.free && !(saveData.ownedBtnStyles||[]).includes(settings.btnStyle)) {
                    settings.btnStyle = 'square'; applyBtnStyle('square'); saveSettings();
                }
                // Migration: reset palette if not owned (skip _random and _custom_picker — they are valid non-palette values)
                if (settings.colorPalette && settings.colorPalette !== 'classic' && settings.colorPalette !== '_random' && settings.colorPalette !== '_custom_picker' && !(saveData.ownedPalettes||['classic']).includes(settings.colorPalette)) {
                    settings.colorPalette = 'classic'; _applyColorPalette('classic'); saveSettings();
                }
                // Migration: reset grid style to lines if stored value is not a valid key
                if (!GRID_STYLES[settings.gridStyle]) {
                    settings.gridStyle = 'lines'; saveSettings();
                }
            }
        } else {
            saveData = JSON.parse(JSON.stringify(defaultSaveData));
            if (!saveData.pinnedScores) saveData.pinnedScores = [];
            if (!saveData.achievements) saveData.achievements = {};
        }
        updateDailyGiftBtn();
        checkTimeManipulation();
        setTimeout(_checkGlowNotifications, 100);
        _checkMissionsRefresh();
        _initTrackCatalog(); // re-run now that saveData is loaded
    }

    async function showFileSetup(existingHandle) {
        _dismissLoadingScreen();
        const overlay = document.getElementById('file-setup-overlay');
        const text = document.getElementById('file-setup-text');
        const btnOpen = document.getElementById('btn-open-save');
        const btnNew = document.getElementById('btn-new-save');

        if (_desktopSave) {
            // One boot read even if the loading-screen failsafe fires concurrently.
            _desktopLoadPromise ||= _nativeAdapter.load();
            try {
                const json = await _desktopLoadPromise;
                applyLoadedData(json === null ? null : JSON.parse(json));
                _desktopSaveReady = true;
                checkAchievementsOnLoad();
                if (overlay) overlay.classList.add('hidden');
                randomizePlayButton(); drawRankBadge(); _checkAchGlow(); startMusic('menu');
            } catch (e) {
                // Do not start with defaults and overwrite an unreadable desktop save.
                console.error('Native save load failed:', e);
                customAlert('Unable to load native save. Restart the app after checking save.json / save.bak. ' + e, 'SAVE ERROR', true);
            }
            return;
        }

        // === Android WebView / no File System Access API ===
        if (!_hasFileAPI) {
            applyLoadedData(await readIDBSave());
            checkAchievementsOnLoad();
            if (overlay) overlay.classList.add('hidden');
            randomizePlayButton(); drawRankBadge(); _checkAchGlow(); startMusic('menu');
            return;
        }

        if (existingHandle) {
            // Try auto-load if permission already granted
            try {
                const autoP = await existingHandle.queryPermission({ mode: 'readwrite' });
                if (autoP === 'granted') {
                    applyLoadedData(await readSaveFile(existingHandle));
                    fileHandle = existingHandle;
                    checkAchievementsOnLoad();
                    overlay.classList.add('hidden');
                    randomizePlayButton(); drawRankBadge(); _checkAchGlow(); startMusic('menu');
                    return; // skip showing overlay
                }
            } catch(e) { console.error('Auto-load error:', e); }

            text.innerHTML = 'Previous save file found.<br>Click to load your progress.';
            btnOpen.innerHTML = '▶ LOAD SAVE';
            btnOpen.style.cssText = 'width:100%; margin-bottom:10px; background:linear-gradient(45deg,#00ffff,#0088ff); color:#000; border:none; font-weight:bold;';
            btnNew.innerHTML = '📂 Choose different file';
            btnNew.style.cssText = 'width:100%;';

            btnOpen.onclick = async () => {
                try {
                    const perm = await existingHandle.requestPermission({ mode: 'readwrite' });
                    if (perm === 'granted') {
                        applyLoadedData(await readSaveFile(existingHandle));
                        fileHandle = existingHandle;
                        checkAchievementsOnLoad();
                        overlay.classList.add('hidden');
                        randomizePlayButton(); drawRankBadge(); _checkAchGlow(); startMusic('menu');
                        return;
                    }
                } catch(e) { console.error('Load save error:', e); }
                showFileSetup(null);
            };
            btnNew.onclick = () => showFileSetup(null);

        } else {
            text.innerHTML = 'Progress is saved as a <b style="color:var(--primary)">JSON file</b> on your disk.<br><br>Open an existing save or create a new one.';
            btnOpen.innerHTML = '📂 Open existing save';
            btnOpen.style.cssText = 'width:100%; margin-bottom:10px; background:rgba(0,255,255,0.1); border-color:var(--primary);';
            btnNew.innerHTML = '✨ New save';
            btnNew.style.cssText = 'width:100%;';

            btnOpen.onclick = async () => {
                try {
                    const [handle] = await window.showOpenFilePicker({
                        types: [{ description: 'Linebreaker Save', accept: { 'application/json': ['.json'] } }],
                        excludeAcceptAllOption: true
                    });
                    applyLoadedData(await readSaveFile(handle));
                    fileHandle = handle;
                    checkAchievementsOnLoad();
                    await saveHandleToIDB(handle);
                    overlay.classList.add('hidden');
                    randomizePlayButton(); drawRankBadge(); _checkAchGlow(); startMusic();
                } catch(e) { console.error('Open save error:', e); customAlert('Error loading save: ' + e.message, 'ERROR', true); }
            };
            btnNew.onclick = async () => {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: 'Linebreaker_save.json',
                        types: [{ description: 'Linebreaker Save', accept: { 'application/json': ['.json'] } }]
                    });
                    saveData = JSON.parse(JSON.stringify(defaultSaveData));
                    fileHandle = handle;
                    await writeSaveFile(saveData);
                    await saveHandleToIDB(handle);
                    overlay.classList.add('hidden');
                    randomizePlayButton(); drawRankBadge(); startMusic();
                } catch(e) {}
            };
        }
        overlay.classList.remove('hidden');
    }

    function saveDataToFile() {
        if (_gameInProgress) return; // defer saves until game over — keeps score and achievements in sync
        return writeSaveFile({ _settings: { ...settings }, ...saveData });
    }

    function _getDailyGiftReq() {
        const info = getLevelInfo(saveData.totalXP);
        if (info.isCelestite) return 450;
        if (info.isDiamond) return 400;
        const rankIdx = info.level === 0 ? 0 : RANKS.indexOf(info.rank);
        return (rankIdx + 1) * 50; // Bronze=50, Silver=100, ..., Amethyst=350
    }
    function updateDailyGiftBtn() { /* daily gift button removed from menu */ }
    function checkTimeManipulation() {
        if (!saveData.lastDailyGift) return;
        const today = new Date().toISOString().slice(0, 10);
        if (saveData.lastDailyGift > today) {
            window._timeBlocked = true;
            setTimeout(() => {
                customAlert('⚠️ Your save file contains data from the future.<br><br>Please sync your system clock and reload the page.<br><br><span style="color:var(--error);">Gameplay is blocked until resolved.</span>', 'SYSTEM TIME ERROR', true);
                const btn = document.getElementById('btn-play');
                if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; btn.title = 'Sync system clock to play'; }
            }, 600);
        }
    }

    const BOOSTER_INFO = {
        '1.25x_game': { label:'1.25x Score Booster', icon:'⚡', rarity:'common',   mult:1.25 },
        '1.5x_game':  { label:'1.5x Score Booster',  icon:'⚡', rarity:'rare',     mult:1.5  },
        '2xp_game':   { label:'2x Score Booster',     icon:'⚡', rarity:'rare',     mult:2.0  },
    };
    const DAILY_MILESTONES = [
        { day:  3, label:'3-Day Streak',   rewards:[{ type:'booster', key:'1.25x_game' }] },
        { day:  7, label:'Weekly Streak',  rewards:[{ type:'booster', key:'1.5x_game' }, { type:'universal_parts', amount:2 }] },
        { day: 14, label:'2-Week Streak',  rewards:[{ type:'booster', key:'2xp_game'  }, { type:'universal_parts', amount:3 }] },
        { day: 21, label:'3-Week Streak',  rewards:[{ type:'booster', key:'1.5x_game' }, { type:'booster', key:'1.5x_game' }] },
        { day: 30, label:'Monthly Streak', rewards:[{ type:'booster', key:'2xp_game'  }, { type:'universal_parts', amount:5 }] },
    ];
    let _dgCountdownInterval = null;

    function getBoosterMult() { return 1; }
    function updateBoosterHUD() {
        const el = document.getElementById('booster-hud');
        if (!el) return;
        el.style.display = 'none';
    }
    function addBoosterToSave(type) {
        if (!saveData.boosters) saveData.boosters = {};
        saveData.boosters[type] = (saveData.boosters[type] || 0) + 1;
    }

    const ITEM_PART_COST = { ghostColor: 20, boxes: 10, dots: 5, dotboxes: 15, sfxCyber: 30, sfxRetro: 15, sfxZen: 30, sfxArcade: 20, pastel: 10, neon: 15, dark: 10, greyscale: 5, synthwave: 10, earth: 10, ice: 5 };
    function _getItemCost(key) { return ITEM_PART_COST[key] || 10; }

    function _getAllPartsItems() {
        const items = [];
        const skinNames = ['retro','glass','shadow','outline','holo','journey','gem','bubble','gameboy','monochrome','modern','candy','vim','aerolab','classic','window'];
        skinNames.filter(_skinAvailable).forEach(k => { if (!(saveData.ownedSkins||['neon']).includes(k)) items.push({cat:'skin',key:k}); });
        const themeNames = ['ocean','forest','fire','dragon','void','sunset','arctic','midnight','sakura'];
        themeNames.forEach(k => { if (!(saveData.ownedThemes||[]).includes(k)) items.push({cat:'theme',key:k}); });
        // Fonts are tied to style packs — not separately unlockable via parts
        if (!saveData.ghostColorUnlocked) items.push({cat:'ghostColor',key:'ghostColor'});
        // Button styles removed from pool (only square exists now)
        const ownedGridStyles = saveData.ownedGridStyles || [];
        ['dots','boxes','dotboxes'].forEach(k => { if (!ownedGridStyles.includes(k)) items.push({cat:'gridStyle',key:k}); });
        const ownedSfx = saveData.ownedSfxPacks || ['default'];
        if (!ownedSfx.includes('cyber')) items.push({cat:'sfxPack',key:'sfxCyber'});
        if (!ownedSfx.includes('retro')) items.push({cat:'sfxPack',key:'sfxRetro'});
        if (!ownedSfx.includes('zen')) items.push({cat:'sfxPack',key:'sfxZen'});
        if (!ownedSfx.includes('arcade')) items.push({cat:'sfxPack',key:'sfxArcade'});
        const ownedPals = saveData.ownedPalettes || ['classic'];
        Object.keys(BLOCK_PALETTES).forEach(k => { if (k !== 'classic' && !ownedPals.includes(k)) items.push({cat:'palette',key:k}); });
        return items;
    }
    function _getPartsEligibleItems() {
        return _getAllPartsItems().filter(item => (saveData.parts?.[item.key] || 0) < _getItemCost(item.key));
    }
    function _weightedPickParts(items, count) {
        const picks = [];
        const pool = items.slice();
        for (let i = 0; i < count && pool.length > 0; i++) {
            const weights = pool.map(item => item.cat === 'ghostColor' ? 1 : item.cat === 'palette' ? 4 : 5);
            const total = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            let idx = 0;
            for (; idx < pool.length - 1; idx++) { r -= weights[idx]; if (r <= 0) break; }
            picks.push(pool[idx]);
            pool.splice(idx, 1);
        }
        return picks;
    }
    function addPartsToItem(key, count) {
        if (!saveData.parts) saveData.parts = {};
        saveData.parts[key] = Math.min(_getItemCost(key), (saveData.parts[key] || 0) + count);
    }
    function addUniversalParts(count) {
        saveData.universalParts = Math.round(((saveData.universalParts || 0) + count) * 10) / 10;
    }
    function giveItemDirectly(cat, key) {
        if (cat === 'skin' && !_skinAvailable(key)) return;
        if (cat === 'skin') { if (!saveData.ownedSkins) saveData.ownedSkins = ['neon']; if (!saveData.ownedSkins.includes(key)) saveData.ownedSkins.push(key); }
        else if (cat === 'theme') { if (!saveData.ownedThemes) saveData.ownedThemes = []; if (!saveData.ownedThemes.includes(key)) saveData.ownedThemes.push(key); }
        else if (cat === 'font') { if (!saveData.ownedFonts) saveData.ownedFonts = ['Orbitron']; if (!saveData.ownedFonts.includes(key)) saveData.ownedFonts.push(key); }
        else if (cat === 'ghostColor') { saveData.ghostColorUnlocked = true; }
        else if (cat === 'btnStyle') { if (!saveData.ownedBtnStyles) saveData.ownedBtnStyles = []; if (!saveData.ownedBtnStyles.includes(key)) saveData.ownedBtnStyles.push(key); }
        else if (cat === 'gridStyle') { if (!saveData.ownedGridStyles) saveData.ownedGridStyles = []; if (!saveData.ownedGridStyles.includes(key)) saveData.ownedGridStyles.push(key); }
        else if (cat === 'sfxPack') { if (!saveData.ownedSfxPacks) saveData.ownedSfxPacks = ['default']; const _sfxMap = {sfxCyber:'cyber',sfxRetro:'retro',sfxZen:'zen',sfxArcade:'arcade'}; const _sfxVal = _sfxMap[key]; if (_sfxVal && !saveData.ownedSfxPacks.includes(_sfxVal)) saveData.ownedSfxPacks.push(_sfxVal); }
        else if (cat === 'palette') { if (!saveData.ownedPalettes) saveData.ownedPalettes = ['classic']; if (!saveData.ownedPalettes.includes(key)) saveData.ownedPalettes.push(key); }
        else if (cat === 'stylePack') { settings.stylePack = key; saveSettings(); }
        if (saveData.parts) delete saveData.parts[key];
    }
    function playerUnlockItem(cat, key) {
        if (cat === 'skin' && !_skinAvailable(key)) return;
        const partsHave = saveData.parts?.[key] || 0;
        if (partsHave < _getItemCost(key)) return;
        giveItemDirectly(cat, key);
        playSFX('unlock');
        saveDataToFile();
        _populateVisualCustomize();
        _populateInventoryOther();
        _checkGlowNotifications();
    }
    function openUseUniversalPart() {
        if ((saveData.universalParts || 0) < 1) return;
        document.getElementById('uni-modal-overlay')?.remove();
        const SKIN_NAMES = {retro:'Retro',glass:'Glass',shadow:'Shadow',outline:'Outline',holo:'Holo',journey:'Journey',gem:'Gem',bubble:'Bubble (test)',gameboy:'Gameboy (test)',monochrome:'Monochrome (test)',modern:'Modern (test)',candy:'Candy (test)',vim:'Vim (test)',aerolab:'Aerolab (test)',classic:'Classic (test)',window:'Window (test)'};
        const THEME_NAMES = {ocean:'Ocean',forest:'Forest',fire:'Fire',dragon:'Golden',void:'Void',sunset:'Sunset',arctic:'Arctic',midnight:'Midnight',sakura:'Sakura'};
        const _inputVals = {};
        let _holdRaf = null, _holdStart = null;
        const BTN_STYLE_NAMES = {};
        const GRID_STYLE_NAMES = { dots: 'Corner Dots Grid', boxes: 'Cell Boxes Grid', dotboxes: 'Dot Boxes Grid' };
        const SFX_PACK_NAMES = { sfxCyber: 'Cyber SFX', sfxRetro: 'Retro SFX', sfxZen: 'Zen SFX', sfxArcade: 'Arcade SFX' };
        const MUSIC_NAMES = {};
        const PALETTE_NAMES = {}; Object.keys(BLOCK_PALETTES).forEach(k => { PALETTE_NAMES[k] = BLOCK_PALETTES[k].name + ' Palette'; });
        function _getLabel(item) { return item.key === 'ghostColor' ? 'Colored Ghost' : (SKIN_NAMES[item.key] || THEME_NAMES[item.key] || BTN_STYLE_NAMES[item.key] || GRID_STYLE_NAMES[item.key] || SFX_PACK_NAMES[item.key] || MUSIC_NAMES[item.key] || PALETTE_NAMES[item.key] || item.key); }
        function _avail() { return saveData.universalParts || 0; }
        function _totalQueued() { return Object.values(_inputVals).reduce((s,v)=>s+(v||0),0); }
        function _updateBar(key) {
            const bar = document.getElementById(`uni-bar-${key}`);
            const lbl = document.getElementById(`uni-lbl-${key}`);
            if (!bar) return;
            const parts = saveData.parts?.[key] || 0;
            const pending = _inputVals[key] || 0;
            const cost = _getItemCost(key);
            const actualPct = (parts / cost) * 100;
            const pendingPct = (pending / cost) * 100;
            const total = actualPct + pendingPct;
            if (pending > 0) {
                bar.style.width = Math.min(100, total) + '%';
                const splitPct = actualPct / Math.min(100, total) * 100;
                bar.style.background = `linear-gradient(to right, #4477ff ${splitPct.toFixed(1)}%, #ffd700 ${splitPct.toFixed(1)}%)`;
            } else {
                bar.style.width = actualPct + '%';
                bar.style.background = '#4477ff';
            }
            if (lbl) lbl.textContent = pending > 0 ? `${parts}+${pending}/${cost}` : `${parts}/${cost}`;
        }
        function _updateApplyBtn() {
            const btn = document.getElementById('uni-apply-btn');
            if (!btn) return;
            const total = _totalQueued();
            btn.disabled = total === 0;
            btn.style.opacity = total === 0 ? '0.3' : '1';
            const lbl = document.getElementById('uni-apply-label');
            if (lbl) lbl.textContent = total > 0 ? `Hold to Apply (${total} part${total!==1?'s':''})` : 'Hold to Apply';
        }
        function _updateAvailLbl() {
            const el = document.getElementById('uni-avail-lbl');
            if (el) el.textContent = `${Math.max(0, _avail() - _totalQueued())} available`;
        }
        function _updateAllIncBtns() {
            const remaining = Math.max(0, _avail() - _totalQueued());
            document.querySelectorAll('[id^="uni-inc-"]').forEach(btn => {
                const key = btn.id.replace('uni-inc-', '');
                const parts = saveData.parts?.[key] || 0;
                const cur = _inputVals[key] || 0;
                const canAdd = remaining > 0 && (_getItemCost(key) - parts - cur) > 0;
                btn.style.opacity = canAdd ? '1' : '0.3';
                btn.style.cursor = canAdd ? 'pointer' : 'default';
            });
        }
        function _buildSection(label, items) {
            if (!items.length) return '';
            const btnStyle = 'font-size:0.65rem;padding:3px 9px;border-radius:5px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.07);color:#bbb;cursor:pointer;font-family:inherit;line-height:1.4;user-select:none;';
            return `<div style="font-size:0.62rem;color:var(--primary,#00ffcc);letter-spacing:2px;font-weight:bold;padding:18px 0 10px;text-shadow:0 0 8px rgba(0,255,200,0.3);">${label}</div>`
                + items.map(item => {
                    const parts = saveData.parts?.[item.key] || 0;
                    const cost = _getItemCost(item.key);
                    const maxAdd = Math.min(_avail(), cost - parts);
                    const pct = (parts / cost) * 100;
                    const cur = _inputVals[item.key] || 0;
                    const showControls = maxAdd > 0 || cur > 0;
                    return `<div style="display:flex;align-items:center;padding:9px 2px;gap:10px;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:0.74rem;color:#ddd;margin-bottom:5px;">${_getLabel(item)}</div>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <div style="width:90px;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
                                    <div id="uni-bar-${item.key}" style="height:100%;width:${pct}%;background:#4477ff;border-radius:3px;transition:width 0.4s ease,background 0.2s;"></div>
                                </div>
                                <span id="uni-lbl-${item.key}" style="font-size:0.62rem;color:#666;">${parts}/${cost}</span>
                            </div>
                        </div>
                        ${showControls ? `<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                            <button onclick="window._uniDec('${item.key}')" id="uni-dec-${item.key}" style="${btnStyle}display:${cur>0?'inline':'none'};">−</button>
                            <span id="uni-n-${item.key}" style="font-size:0.75rem;color:#ffd700;min-width:20px;text-align:center;display:${cur>0?'inline':'none'};">${cur>0?cur:''}</span>
                            <button onclick="window._uniInc('${item.key}')" id="uni-inc-${item.key}" style="${btnStyle}${maxAdd<=0?'opacity:0.3;cursor:default;':''}">+</button>
                        </div>` : `<span style="font-size:0.62rem;color:#444;">Full</span>`}
                    </div>`;
                }).join('');
        }
        function _rebuildContent() {
            const c = document.getElementById('uni-modal-body');
            if (!c) return;
            const all = _getAllPartsItems();
            const avail = _avail();
            c.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;padding-right:30px;">
                <div style="font-size:0.82rem;font-weight:bold;color:#ffd700;">⭐ Universal Parts</div>
                <div id="uni-avail-lbl" style="font-size:0.76rem;color:#ffd700;font-weight:bold;">${avail} available</div>
            </div>
            <div style="position:relative;margin:10px 0 4px;">
                <button id="uni-apply-btn" disabled style="width:100%;padding:9px;font-size:0.68rem;font-family:inherit;border-radius:8px;border:1px solid #ffd700;background:rgba(255,215,0,0.08);color:#ffd700;cursor:pointer;font-weight:bold;opacity:0.3;transition:opacity 0.2s;position:relative;overflow:hidden;user-select:none;-webkit-user-select:none;">
                    <div id="uni-apply-progress" style="position:absolute;left:0;top:0;bottom:0;width:0%;background:rgba(255,215,0,0.25);border-radius:8px;transition:none;pointer-events:none;"></div>
                    <span id="uni-apply-label" style="position:relative;z-index:1;">Hold to Apply</span>
                </button>
            </div>`
            + _buildSection('SKINS', all.filter(i => i.cat === 'skin'))
            + _buildSection('THEMES', all.filter(i => i.cat === 'theme'))
            + _buildSection('GHOST COLOR', all.filter(i => i.cat === 'ghostColor'))
            + _buildSection('GRID STYLES', all.filter(i => i.cat === 'gridStyle'))
            + _buildSection('PALETTES', all.filter(i => i.cat === 'palette'))
            + _buildSection('SFX PACKS', all.filter(i => i.cat === 'sfxPack'))
            + _buildSection('MUSIC', all.filter(i => i.cat === 'music'))
            + (all.length === 0 ? `<div style="text-align:center;color:#888;font-size:0.7rem;padding:16px;">You already own everything!<br><span style="color:#555;font-size:0.65rem;">Universal parts will carry forward.</span></div>` : avail === 0 && _totalQueued() === 0 ? `<div style="text-align:center;color:#555;font-size:0.7rem;padding:16px;">No universal parts remaining.</div>` : '');
            // Re-attach hold events
            const applyBtn = document.getElementById('uni-apply-btn');
            if (applyBtn) {
                applyBtn.addEventListener('mousedown', window._uniStartHold);
                applyBtn.addEventListener('mouseup', window._uniStopHold);
                applyBtn.addEventListener('mouseleave', window._uniStopHold);
            }
            // Restore bar states
            Object.keys(_inputVals).forEach(key => { if (_inputVals[key] > 0) _updateBar(key); });
        }
        window._uniInc = key => {
            const parts = saveData.parts?.[key] || 0;
            const queued = _totalQueued();
            const cur = _inputVals[key] || 0;
            const maxForItem = _getItemCost(key) - parts - cur;
            const maxFromAvail = _avail() - (queued - cur);
            if (maxForItem <= 0 || maxFromAvail <= 0) return;
            _inputVals[key] = cur + 1;
            const nEl = document.getElementById(`uni-n-${key}`);
            const dEl = document.getElementById(`uni-dec-${key}`);
            if (nEl) { nEl.textContent = cur + 1; nEl.style.display = 'inline'; }
            if (dEl) dEl.style.display = 'inline';
            _updateBar(key); _updateApplyBtn(); _updateAvailLbl(); _updateAllIncBtns();
        };
        window._uniDec = key => {
            const cur = _inputVals[key] || 0;
            if (cur <= 0) return;
            _inputVals[key] = cur - 1;
            const nEl = document.getElementById(`uni-n-${key}`);
            const dEl = document.getElementById(`uni-dec-${key}`);
            if (nEl) { nEl.textContent = cur > 1 ? (cur - 1).toString() : ''; nEl.style.display = cur > 1 ? 'inline' : 'none'; }
            if (dEl) dEl.style.display = cur > 1 ? 'inline' : 'none';
            _updateBar(key); _updateApplyBtn(); _updateAvailLbl(); _updateAllIncBtns();
        };
        window._uniStartHold = () => {
            const total = _totalQueued();
            if (total === 0) return;
            _holdStart = Date.now();
            const prog = document.getElementById('uni-apply-progress');
            const lbl = document.getElementById('uni-apply-label');
            function tick() {
                const elapsed = Date.now() - _holdStart;
                const pct = Math.min(100, (elapsed / 2000) * 100);
                if (prog) prog.style.width = pct + '%';
                if (lbl) lbl.textContent = pct < 100 ? `Hold… ${Math.ceil((2000 - elapsed) / 100) / 10}s` : 'Applying…';
                if (elapsed >= 2000) { window._uniDoApply(); return; }
                _holdRaf = requestAnimationFrame(tick);
            }
            _holdRaf = requestAnimationFrame(tick);
        };
        window._uniStopHold = () => {
            if (_holdRaf) { cancelAnimationFrame(_holdRaf); _holdRaf = null; }
            _holdStart = null;
            const prog = document.getElementById('uni-apply-progress');
            if (prog) prog.style.width = '0%';
            _updateApplyBtn();
        };
        window._uniDoApply = () => {
            window._uniStopHold();
            const changes = Object.entries(_inputVals).filter(([,v]) => v > 0);
            if (!changes.length) return;
            changes.forEach(([key, count]) => {
                const parts = saveData.parts?.[key] || 0;
                const actual = Math.min(count, _avail(), _getItemCost(key) - parts);
                if (actual > 0) {
                    addPartsToItem(key, actual);
                    saveData.universalParts = Math.max(0, (saveData.universalParts||0) - actual);
                }
            });
            Object.keys(_inputVals).forEach(k => { _inputVals[k] = 0; });
            saveDataToFile(); _populateInventoryOther(); _populateVisualCustomize();
            _checkGlowNotifications();
            // Animate bars filling
            changes.forEach(([key]) => {
                const bar = document.getElementById(`uni-bar-${key}`);
                if (bar) {
                    const newPct = ((saveData.parts?.[key] || 0) / _getItemCost(key)) * 100;
                    bar.style.transition = 'width 0.6s ease, background 0.3s';
                    bar.style.background = '#4477ff';
                    setTimeout(() => { bar.style.width = newPct + '%'; }, 50);
                }
                const lbl = document.getElementById(`uni-lbl-${key}`);
                if (lbl) lbl.textContent = `${saveData.parts?.[key] || 0}/${_getItemCost(key)}`;
            });
            setTimeout(() => _rebuildContent(), 700);
        };
        const ov = document.createElement('div');
        ov.id = 'uni-modal-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `<div style="background:#12121e;border:1px solid rgba(255,215,0,0.25);border-radius:14px;padding:20px;width:min(420px,92vw);max-height:80vh;overflow-y:auto;position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.8);">
            <button onclick="window._closeModal('uni-modal-overlay')" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#555;font-size:1.1rem;cursor:pointer;padding:4px;line-height:1;z-index:1;">✕</button>
            <div id="uni-modal-body"></div>
        </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) window._closeModal('uni-modal-overlay'); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-down');
        _rebuildContent();
    }

    function openExchangeUniversalParts() {
        const avail = Math.floor(saveData.universalParts || 0);
        if (avail < 1) return;
        const XP_PER_PART = 5000;
        document.getElementById('uni-xch-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'uni-xch-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:1200;display:flex;align-items:center;justify-content:center;font-family:inherit;';
        ov.innerHTML = `
            <div style="background:rgba(8,8,18,0.98);border:1px solid #ffd700;border-radius:14px;padding:22px 20px;max-width:300px;width:90%;text-align:center;box-shadow:0 0 30px rgba(255,215,0,0.15);">
                <div style="font-size:0.85rem;font-weight:bold;color:#ffd700;letter-spacing:2px;margin-bottom:6px;">⭐ EXCHANGE PARTS</div>
                <div style="font-size:0.63rem;color:#777;margin-bottom:14px;">All items unlocked — convert Universal Parts to XP.</div>
                <div style="background:rgba(255,215,0,0.06);border:1px solid rgba(255,215,0,0.14);border-radius:8px;padding:10px 14px;margin-bottom:14px;text-align:left;font-size:0.62rem;color:#666;">
                    <div style="margin-bottom:3px;">Rate: <span style="color:#ffd700;font-weight:bold;">1 ⭐ = ${XP_PER_PART.toLocaleString()} XP</span></div>
                    <div>You have: <span style="color:#fff;font-weight:bold;">${avail}</span> part${avail !== 1 ? 's' : ''}</div>
                </div>
                <div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:#666;margin-bottom:6px;">
                        <span>Parts to exchange:</span>
                        <span id="uni-xch-lbl" style="color:#ffd700;font-weight:bold;">${avail}</span>
                    </div>
                    <input type="range" id="uni-xch-slider" min="1" max="${avail}" value="${avail}" step="1" style="width:100%;accent-color:#ffd700;cursor:pointer;">
                </div>
                <div style="font-size:0.7rem;color:#aaa;margin-bottom:18px;min-height:1.4em;">
                    <span id="uni-xch-count" style="color:#ffd700;font-weight:bold;">${avail}</span> part${avail !== 1 ? 's' : ''} → <span id="uni-xch-xp" style="color:#ffd700;font-weight:bold;">+${(avail * XP_PER_PART).toLocaleString()} XP</span>
                </div>
                <div style="display:flex;gap:10px;justify-content:center;">
                    <button onclick="document.getElementById('uni-xch-overlay').remove()" style="font-size:0.7rem;padding:7px 18px;background:rgba(255,255,255,0.05);border:1px solid #444;border-radius:8px;color:#888;cursor:pointer;font-family:inherit;">CANCEL</button>
                    <button id="uni-xch-confirm" style="font-size:0.7rem;padding:7px 18px;background:linear-gradient(135deg,rgba(255,215,0,0.2),rgba(255,215,0,0.1));border:1px solid #ffd700;border-radius:8px;color:#ffd700;cursor:pointer;font-family:inherit;font-weight:bold;box-shadow:0 0 8px rgba(255,215,0,0.2);">EXCHANGE</button>
                </div>
            </div>`;
        const slider = ov.querySelector('#uni-xch-slider');
        slider.addEventListener('input', () => {
            const v = parseInt(slider.value);
            const lbl = document.getElementById('uni-xch-lbl');
            const cnt = document.getElementById('uni-xch-count');
            const xpEl = document.getElementById('uni-xch-xp');
            if (lbl) lbl.textContent = v;
            if (cnt) cnt.textContent = v + (v !== 1 ? ' parts' : ' part');
            if (xpEl) xpEl.textContent = '+' + (v * XP_PER_PART).toLocaleString() + ' XP';
        });
        ov.querySelector('#uni-xch-confirm').addEventListener('click', () => {
            const v = parseInt(slider.value);
            if (v < 1) return;
            const xpGain = v * XP_PER_PART;
            saveData.universalParts = Math.max(0, (saveData.universalParts || 0) - v);
            _grantXP(xpGain);
            document.getElementById('uni-xch-overlay')?.remove();
            drawRankBadge();
            _populateInventoryOther();
            saveDataToFile();
            customAlert(`+${xpGain.toLocaleString()} XP`, `Exchanged ${v} Universal Part${v !== 1 ? 's' : ''}!`);
        });
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
    }

    const RARITY_COLORS = { common:'#4caf50', rare:'#4499ff', epic:'#9932cc', legendary:'#ff9900', mythic:'#cc1111' };
    const RARITY_LABELS = { common:'COMMON', rare:'RARE', epic:'EPIC', legendary:'LEGENDARY', mythic:'MYTHIC' };

    // Daily gift pools (separate rolls, cash is always guaranteed)
    const _DAILY_BOOSTER_POOL = [
        { w:70, type:'booster', v:'1.25x_game', rarity:'common'   },
        { w:20, type:'booster', v:'1.5x_game',  rarity:'uncommon' },
        { w:10, type:'booster', v:'2xp_game',   rarity:'rare'     },
    ];
    function _rollPool(pool) {
        const tw = pool.reduce((s,r) => s+r.w, 0);
        let rand = Math.random() * tw;
        for (const r of pool) { rand -= r.w; if (rand <= 0) return r; }
        return pool[0];
    }

    function openDailyGiftInfo() {
        const row = (label, val, rar) => {
            const col = RARITY_COLORS[rar] || '#ccc';
            return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1a1a1a;font-size:0.72rem;"><span>${label}</span><span style="color:${col};font-weight:bold;">${val}</span></div>`;
        };
        const html = `
            <div style="font-size:0.65rem;color:#888;margin-bottom:8px;">Parts are given to unowned/incomplete items. Boosters are a bonus roll.</div>
            <div style="font-size:0.65rem;color:#aaa;margin-bottom:4px;font-weight:bold;">Parts:</div>
            ${row('1 part', '8%', 'common')}
            ${row('2 parts', '22%', 'common')}
            ${row('3 parts', '50%', 'common')}
            ${row('4 parts', '15%', 'uncommon')}
            ${row('5 parts', '5%', 'rare')}
            ${row('Universal Part', '3% chance', 'epic')}
            <div style="font-size:0.65rem;color:#888;margin:6px 0 2px;">Booster bonus (50% total):</div>
            ${row('1.25× Booster', '35%', 'common')}
            ${row('1.5× Booster', '10%', 'uncommon')}
            ${row('2× Booster', '5%', 'rare')}
            <div style="font-size:0.65rem;color:#888;margin-top:6px;">Collect 10 parts for an item to unlock it manually from Inventory.</div>
        `;
        customAlert(html, 'REWARD CHANCES', false);
    }

    function openDailyGift() {
        const today = new Date().toISOString().slice(0, 10);
        // gift_ignore: check if 3+ days since last gift
        if (saveData.lastDailyGift && !saveData.achievements?.['gift_ignore']?.unlocked) {
            const _lastGiftDate = new Date(saveData.lastDailyGift);
            const _daysSince = Math.floor((new Date(today) - _lastGiftDate) / 86400000);
            if (_daysSince >= 3) { unlockAchievement('gift_ignore'); saveDataToFile(); }
        }
        const overlay = document.getElementById('daily-gift-overlay');
        ['dg-ready','dg-result','dg-claimed'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
        const req = _getDailyGiftReq();
        const xpEarned = saveData.xpEarnedSinceLastGift || 0;
        // Check if already claimed today FIRST (before XP check, since xpEarnedSinceLastGift resets after claim)
        if (saveData.lastDailyGift === today) {
            const el = document.getElementById('dg-claimed');
            if (el) {
                el.style.display = '';
                const streak = saveData.dailyGiftStreak || 1;
                const nextMilestone = DAILY_MILESTONES.find(m => m.day > streak);
                const daysToNext = nextMilestone ? nextMilestone.day - streak : null;
                const milestoneInfo = nextMilestone
                    ? `<div style="font-size:0.68rem;color:#888;margin:8px 0;">✨ Better reward in <span style="color:var(--gold);font-weight:bold;">${daysToNext} day${daysToNext!==1?'s':''}</span></div>`
                    : `<div style="font-size:0.68rem;color:var(--gold);margin:8px 0;">Max streak reached!</div>`;
                el.innerHTML = `
                    <div style="margin-bottom:10px;"><svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="#22cc55" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 13 9 18 20 7"></polyline></svg></div>
                    <div style="font-weight:bold;font-size:0.85rem;margin-bottom:12px;">Already claimed today!</div>
                    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;">
                        <span style="font-size:1.4rem;">🔥</span>
                        <div style="text-align:left;">
                            <div style="font-size:1.1rem;font-weight:bold;color:#fff;">${streak} day${streak!==1?'s':''}</div>
                            <div style="font-size:0.58rem;color:#666;">current streak</div>
                        </div>
                    </div>
                    <div style="margin:8px auto;padding:8px 12px;background:rgba(0,255,255,0.05);border:1px solid rgba(0,255,255,0.15);border-radius:8px;max-width:200px;">
                        <div style="font-size:0.5rem;color:#555;letter-spacing:2px;margin-bottom:4px;">NEXT GIFT IN</div>
                        <div id="dg-countdown" style="font-size:1.3rem;font-weight:bold;font-family:'Orbitron',sans-serif;color:var(--primary);">--:--:--</div>
                    </div>
                    ${milestoneInfo}
                    <button class="btn-secondary" style="margin-top:10px;border:none;" onclick="window.closeDailyGift()">CLOSE</button>`;
                if (_dgCountdownInterval) clearInterval(_dgCountdownInterval);
                _dgCountdownInterval = setInterval(() => {
                    const cdEl = document.getElementById('dg-countdown');
                    if (!cdEl) { clearInterval(_dgCountdownInterval); return; }
                    const now = new Date(), midnight = new Date(now);
                    midnight.setHours(24, 0, 0, 0);
                    const diff = midnight - now;
                    if (diff <= 0) { cdEl.textContent = '00:00:00'; return; }
                    const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
                    cdEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                }, 1000);
                // Trigger once immediately
                const cdEl = document.getElementById('dg-countdown');
                if (cdEl) {
                    const now = new Date(), midnight = new Date(now); midnight.setHours(24,0,0,0);
                    const diff = midnight - now;
                    const h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
                    cdEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                }
            }
        } else if (xpEarned < req) {
            // Not enough XP earned yet
            const el = document.getElementById('dg-claimed');
            if (el) {
                el.style.display = '';
                const pct = Math.round(Math.min(100, xpEarned / req * 100));
                const progressBar = `<div style="width:100%;max-width:180px;margin:12px auto 0;">
                        <div style="display:flex;justify-content:space-between;font-size:0.62rem;color:#666;margin-bottom:4px;"><span>${xpEarned} / ${req} XP earned</span></div>
                        <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:var(--primary);border-radius:3px;"></div></div>
                      </div>`;
                el.innerHTML = `<div style="margin-bottom:8px;"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></div><span style="color:#aaa;font-size:0.8rem;">Earn <b style="color:#fff;">${req - xpEarned} more XP</b> to unlock today's gift.</span>${progressBar}<br><button class="btn-secondary" style="margin-top:12px;border:none;" onclick="window.closeDailyGift()">CLOSE</button>`;
            }
        } else {
            const el = document.getElementById('dg-ready');
            if (el) {
                el.style.display = '';
                const openBtn = el.querySelector('.btn-main');
                if (openBtn) openBtn.disabled = false;
            }
            const giftBox = document.getElementById('dg-gift-box');
            if (giftBox) giftBox.classList.remove('dg-opening');
        }
        overlay.classList.remove('hidden');
    }

    function claimDailyGift() {
        const today = new Date().toISOString().slice(0, 10);
        if (saveData.lastDailyGift === today) return;
        playSFX('gift');

        // Streak tracking
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);
        if (saveData.lastDailyGift === yesterdayStr) {
            saveData.dailyGiftStreak = (saveData.dailyGiftStreak || 0) + 1;
        } else {
            saveData.dailyGiftStreak = 1;
        }
        const currentStreak = saveData.dailyGiftStreak;
        saveData.lastDailyGift = today;
        saveData.xpEarnedSinceLastGift = 0;

        const rewards = [];

        // 1. Parts: 1-5 weighted random (most common=3; 4&5 rarer than 1&2)
        const _partsRoll = () => { const r=Math.random()*100; return r<8?1:r<30?2:r<80?3:r<95?4:5; };
        const eligible = _getPartsEligibleItems();
        const allUnowned = _getAllPartsItems();
        if (allUnowned.length > 0) {
            // Pick items (allow same item multiple times)
            const numParts = _partsRoll();
            const partMap = {};
            for (let i = 0; i < numParts; i++) {
                const pool = eligible.length > 0 ? eligible : allUnowned;
                const pick = pool[Math.floor(Math.random() * pool.length)];
                const key = pick.key;
                const isOwned = !eligible.find(e => e.key === key);
                if (isOwned) {
                    // Duplicate part for owned item → 0.2 universal parts
                    if (!saveData.universalParts) saveData.universalParts = 0;
                    saveData.universalParts = Math.round((saveData.universalParts + 0.2) * 10) / 10;
                    partMap[key] = partMap[key] || { count: 0, dupCount: 0, cat: pick.cat };
                    partMap[key].dupCount++;
                } else {
                    addPartsToItem(key, 1);
                    partMap[key] = partMap[key] || { count: 0, dupCount: 0, cat: pick.cat };
                    partMap[key].count++;
                }
            }
            Object.entries(partMap).forEach(([key, info]) => {
                const displayKey = key === 'ghostColor' ? 'Colored Ghost' : key.charAt(0).toUpperCase() + key.slice(1);
                const cost = _getItemCost(key);
                if (info.count > 0) {
                    const partCount = saveData.parts[key] || 0;
                    rewards.push({ icon:'🧩', label:`+${info.count} Part${info.count>1?'s':''}: ${displayKey}`, desc:`${partCount}/${cost} parts collected`, rarity:'common' });
                }
                if (info.dupCount > 0) {
                    const uniGain = Math.round(info.dupCount * 0.2 * 10) / 10;
                    rewards.push({ icon:'⭐', label:`<s style="color:#666;font-weight:normal;">${displayKey}</s> → +${uniGain} Universal Part${uniGain!==1?'s':''}`, desc:`duplicate converted`, rarity:'rare' });
                }
            });
        } else {
            // All items owned — give XP instead
            const numParts = _partsRoll();
            const xpGain = numParts * 1000;
            _grantXP(xpGain);
            rewards.push({ icon:'✨', label:`+${xpGain.toLocaleString()} XP`, desc:'All items collected! Parts converted to XP.', rarity:'epic' });
        }

        // 2. Universal part: 3% chance
        if (Math.random() < 0.03) {
            if (_getAllPartsItems().length === 0) {
                // All items owned — convert universal part to XP
                const uniXp = 5000;
                _grantXP(uniXp);
                rewards.push({ icon:'✨', label:`+${uniXp.toLocaleString()} XP`, desc:'Universal Part converted to XP!', rarity:'epic' });
            } else {
                addUniversalParts(1);
                rewards.push({ icon:'⭐', label:'+1 Universal Part', desc:'Can be used for any item!', rarity:'epic' });
            }
        }

        // 3. Booster: 50% chance
        if (Math.random() < 0.5) {
            const b = _rollPool(_DAILY_BOOSTER_POOL);
            addBoosterToSave(b.v);
            const info = BOOSTER_INFO[b.v];
            rewards.push({ type:'booster', icon:info.icon, label:info.label, desc:'Booster added to inventory', rarity:b.rarity });
        }

        // 4. Milestone bonus rewards
        const milestone = DAILY_MILESTONES.find(m => m.day === currentStreak);
        if (milestone) {
            milestone.rewards.forEach(r => {
                if (r.type === 'booster') {
                    addBoosterToSave(r.key);
                    rewards.push({ type:'booster', icon:'⚡', label:`MILESTONE: ${BOOSTER_META[r.key].label}`, desc:`${currentStreak}-day streak reward! 🔥`, rarity:'epic' });
                } else if (r.type === 'universal_parts') {
                    addUniversalParts(r.amount);
                    rewards.push({ icon:'⭐', label:`MILESTONE: +${r.amount} Universal Parts`, desc:`${currentStreak}-day streak reward! 🔥`, rarity:'rare' });
                }
            });
        }

        rewards.forEach(r => { if (['rare','epic','legendary'].includes(r.rarity)) { saveData.stats.rareItemsFromDailyBox = (saveData.stats.rareItemsFromDailyBox||0) + 1; } });
        const _dgNewAch = checkProgressAchievements();
        if (_dgNewAch.length) setTimeout(() => _showAchievementToast(_dgNewAch), 1500);
        const readyBox = document.getElementById('dg-gift-box');
        if (readyBox) readyBox.classList.add('dg-opening');
        const openBtn = document.querySelector('#dg-ready .btn-main');
        if (openBtn) openBtn.disabled = true;

        setTimeout(() => {
            ['dg-ready','dg-claimed'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
            const resultEl = document.getElementById('dg-result');
            if (!resultEl) return;
            resultEl.style.display = 'block';
            const rewardsHtml = rewards.map(rw => {
                const col = RARITY_COLORS[rw.rarity] || '#ccc';
                return `<div class="dg-item-reveal" style="border-color:${col};box-shadow:0 0 14px ${col}40;margin-bottom:8px;padding:8px 12px;">
                    <div style="display:flex;align-items:center;gap:8px;justify-content:center;">
                        <span style="font-size:1.5rem;">${rw.icon}</span>
                        <div>
                            <div style="font-size:0.9rem;font-weight:bold;color:${col};">${rw.label}</div>
                            <div style="font-size:0.65rem;color:#aaa;">${rw.desc}</div>
                        </div>
                    </div>
                </div>`;
            }).join('');
            resultEl.innerHTML = rewardsHtml + `<button class="btn-secondary" style="margin-top:10px;border:none;" onclick="window.closeDailyGift()">AWESOME!</button>`;
        }, 700);
        saveDataToFile();
        setTimeout(_checkGlowNotifications, 800);
    }

    function _checkMilestoneBoxes() {
        if ((!saveData.pendingMilestoneReward && !saveData.pendingMilestoneBoxes?.length) || _levelBoxShowing) return;
        const lv = saveData.pendingMilestoneReward?.level || saveData.pendingMilestoneBoxes[0];
        _showMilestoneBox(lv);
    }
    function _showMilestoneBox(lv) {
        if (_levelBoxShowing) return;
        _levelBoxShowing = true;
        let box = saveData.pendingMilestoneReward;
        if (!box) {
            box = { level: lv, rewards: _generateLevelBoxRewards() };
            saveData.pendingMilestoneReward = box;
            saveData.pendingMilestoneBoxes.shift();
            saveDataToFile();
        }
        const rewards = box.rewards;
        const overlay = document.createElement('div');
        overlay.className = 'lb-reward-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Earned rewards');
        overlay.id = 'level-box-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:3100;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
        const color = '#ffd700';
        const panel = document.createElement('div');
        panel.style.cssText = 'background:rgba(5,5,20,0.98);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px 20px;max-width:420px;width:100%;text-align:center;max-height:90vh;overflow-y:auto;';
        panel.innerHTML = `
            <div style="font-size:0.55rem;letter-spacing:3px;color:#666;margin-bottom:4px;font-family:var(--ui-font);">LEVEL MILESTONE</div>
            <div style="font-size:1rem;font-weight:bold;color:${color};font-family:var(--ui-font);letter-spacing:1px;margin-bottom:2px;">LEVEL ${lv}</div>
            <div style="font-size:0.6rem;color:#555;margin-bottom:16px;">Every 10 levels — milestone reward!</div>
        `;
        const preOpen = document.createElement('div');
        preOpen.id = 'lb-pre-open';
        preOpen.innerHTML = `
            <svg viewBox="0 0 64 64" width="80" height="80" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:8px auto;display:block;filter:drop-shadow(0 0 12px ${color}55);">
                <rect x="8" y="28" width="48" height="28" rx="3"/>
                <path d="M8 36h48"/>
                <path d="M32 8c0 0-8-4-12 0s-4 12 0 12h24c4 0 4-8 0-12s-12 0-12 0z"/>
                <line x1="32" y1="20" x2="32" y2="36"/>
                <line x1="32" y1="42" x2="32" y2="56"/>
            </svg>
            <div style="font-size:0.65rem;color:#666;margin-bottom:16px;">Contains 10 parts + 2 universal parts</div>
            <button id="lb-open-btn" style="font-family:var(--ui-font);font-size:0.7rem;letter-spacing:2px;padding:10px 28px;border-radius:10px;border:1px solid ${color};background:${color}22;color:${color};cursor:pointer;transition:all 0.2s;">OPEN BOX</button>
        `;
        panel.appendChild(preOpen);
        const rewardsDiv = document.createElement('div');
        rewardsDiv.id = 'lb-rewards-grid';
        rewardsDiv.style.cssText = 'display:none;';
        const grid = document.createElement('div');
        grid.className = 'lb-reward-grid';
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;';
        const RARITY_COLS = { common:'#4caf50', rare:'#4499ff', epic:'#9932cc', legendary:'#ff9900', mythic:'#cc1111' };
        rewards.forEach(r => {
            const card = document.createElement('div');
            card.className = 'lb-reward-card';
            const rc = RARITY_COLS[r.rarity] || '#aaa';
            card.style.cssText = `background:rgba(255,255,255,0.04);border:1px solid ${rc}44;border-radius:8px;padding:8px 4px;text-align:center;`;
            card.innerHTML = `<div style="font-size:1.3rem;margin-bottom:4px;">${r.icon}</div><div style="font-size:0.58rem;color:${rc};font-weight:bold;line-height:1.3;">${r.label}</div><div style="font-size:0.52rem;color:#555;margin-top:2px;">${r.desc}</div><div class="lb-reward-rarity">${r.rarity}</div>`;
            grid.appendChild(card);
        });
        rewardsDiv.appendChild(grid);
        rewardsDiv.innerHTML += `<button id="lb-claim-btn" style="font-family:var(--ui-font);font-size:0.7rem;letter-spacing:2px;padding:10px 28px;border-radius:10px;border:1px solid #22cc55;background:rgba(34,204,85,0.12);color:#22cc55;cursor:pointer;box-shadow:0 0 10px rgba(34,204,85,0.45);animation:pulse-glow-green 1.8s ease-in-out infinite;">CLAIM</button>`;
        panel.appendChild(rewardsDiv);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        _animateIn(panel, 'anim-in-down');
        panel.querySelector('#lb-open-btn').onclick = () => {
            preOpen.style.display = 'none';
            rewardsDiv.style.display = 'block';
            Array.from(grid.children).forEach((card, i) => {
                card.style.opacity = '0'; card.style.transform = 'scale(0.8)';
                card.style.transition = `opacity 0.25s ${i*0.06}s, transform 0.25s ${i*0.06}s`;
                setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 20);
            });
        };
        const claim = () => {
            overlay.remove();
            _levelBoxShowing = false;
            saveData.pendingMilestoneReward = null;
            saveDataToFile();
            drawRankBadge();
            _populateVisualCustomize();
            // Show next pending milestone box if any
            if (saveData.pendingMilestoneReward || saveData.pendingMilestoneBoxes?.length) {
                setTimeout(() => _checkMilestoneBoxes(), 400);
            }
        };
        rewardsDiv.addEventListener('click', e => { if (e.target.id === 'lb-claim-btn') claim(); });
    }
    function _generateLevelBoxRewards() {
        const rewards = [];
        const allItems = _getAllPartsItems();
        const picks = _weightedPickParts(allItems, Math.min(10, allItems.length));
        picks.forEach(item => {
            addPartsToItem(item.key, 1);
            const partCount = saveData.parts[item.key] || 0;
            const displayKey = item.key === 'ghostColor' ? 'Colored Ghost' : item.key.charAt(0).toUpperCase() + item.key.slice(1);
            rewards.push({ icon: '🧩', label: `+1 Part: ${displayKey}`, desc: `${partCount}/10 parts`, rarity: item.cat === 'ghostColor' ? 'epic' : 'common' });
        });
        // Pad with universal parts if fewer than 10 unique items available
        const partsGiven = picks.length;
        for (let i = partsGiven; i < 10; i++) {
            addUniversalParts(1);
            rewards.push({ icon: '⭐', label: '+1 Universal Part', desc: 'Added to your inventory', rarity: 'rare' });
        }
        // Always give 2 universal parts
        addUniversalParts(1);
        rewards.push({ icon: '⭐', label: '+1 Universal Part', desc: 'Added to your inventory', rarity: 'rare' });
        addUniversalParts(1);
        rewards.push({ icon: '⭐', label: '+1 Universal Part', desc: 'Added to your inventory', rarity: 'rare' });
        return rewards;
    }

    function _queueLevelBox(box) {
        if (!saveData.pendingLevelBox) saveData.pendingLevelBox = box;
        else {
            if (!saveData.pendingLevelBoxes) saveData.pendingLevelBoxes = [];
            saveData.pendingLevelBoxes.push(box);
        }
    }
    function _grantXP(amount) {
        const oldLevel = getLevelInfo(saveData.totalXP).level;
        saveData.totalXP += amount;
        _processLevelUps(oldLevel, getLevelInfo(saveData.totalXP).level);
    }
    function _processLevelUps(oldLevel, newLevel) {
        // Level-up milestone rewards
        const LEVEL_MILESTONE_REWARDS = {
            11: [{ type:'universal_parts', amount:3, icon:'⭐', label:'+3 Universal Parts', desc:'Silver milestone reward', rarity:'rare' }],
            21: [{ type:'universal_parts', amount:3, icon:'⭐', label:'+3 Universal Parts', desc:'Gold milestone reward', rarity:'rare' }],
            31: [{ type:'skin', key:'shadow', icon:'🎨', label:'Shadow Skin', desc:'Unlocked at Emerald!', rarity:'rare' }, { type:'universal_parts', amount:3, icon:'⭐', label:'+3 Universal Parts', desc:'Emerald milestone reward', rarity:'rare' }],
            41: [{ type:'skin', key:'holo', icon:'🎨', label:'Holo Skin', desc:'Unlocked at Sapphire!', rarity:'rare' }, { type:'universal_parts', amount:3, icon:'⭐', label:'+3 Universal Parts', desc:'Sapphire milestone reward', rarity:'rare' }],
            51: [{ type:'universal_parts', amount:6, icon:'⭐', label:'+6 Universal Parts', desc:'Ruby milestone reward', rarity:'rare' }],
            61: [{ type:'ghostColor', key:'ghostColor', icon:'👻', label:'Colored Ghost', desc:'Unlocked at Amethyst!', rarity:'epic' }, { type:'universal_parts', amount:5, icon:'⭐', label:'+5 Universal Parts', desc:'Amethyst milestone reward', rarity:'epic' }],
            71: [{ type:'universal_parts', amount:8, icon:'⭐', label:'+8 Universal Parts', desc:'Diamond milestone reward', rarity:'legendary' }],
            81: [{ type:'universal_parts', amount:10, icon:'⭐', label:'+10 Universal Parts', desc:'Celestite milestone reward', rarity:'legendary' }],
        };
        const MID_TIER_BOOSTER = {
            5:  '1.25x_game',
            15: '1.25x_game',
            25: '1.5x_game',
            35: '1.5x_game',
            45: '1.5x_game',
            55: '2xp_game',
            65: '2xp_game',
        };
        let _levelUpRewards = [];
        for (let lv = Math.max(oldLevel, saveData.levelRewardsThrough || oldLevel) + 1; lv <= newLevel; lv++) {
            if (LEVEL_MILESTONE_REWARDS[lv]) {
                LEVEL_MILESTONE_REWARDS[lv].forEach(r => {
                    if (r.type === 'stylePack') { giveItemDirectly('stylePack', r.key); _levelUpRewards.push(r); }
                    else if (r.type === 'skin') { giveItemDirectly('skin', r.key); _levelUpRewards.push(r); }
                    else if (r.type === 'ghostColor') { giveItemDirectly('ghostColor', r.key); _levelUpRewards.push(r); }
                    else if (r.type === 'universal_parts') { addUniversalParts(r.amount); _levelUpRewards.push(r); }
                });
            }
            if (MID_TIER_BOOSTER[lv]) {
                addBoosterToSave(MID_TIER_BOOSTER[lv]);
                const bInfo = BOOSTER_INFO[MID_TIER_BOOSTER[lv]];
                _levelUpRewards.push({ icon:'⚡', label:bInfo.label, desc:`Level ${lv} reward`, rarity: bInfo.rarity });
            }
            // Level box at each new rarity tier start
            const _LEVEL_BOX_BOUNDARIES = [11, 21, 31, 41, 51, 61, 71, 81];
            if (_LEVEL_BOX_BOUNDARIES.includes(lv)) {
                const _boxRankInfo = { rank: RANKS[(lv - 1) / 10] || CELESTITE_RANK };
                const _boxRewards = _generateLevelBoxRewards();
                _queueLevelBox({ level: lv, rankName: _boxRankInfo.rank.name, rankColor: _boxRankInfo.rank.c, rewards: _boxRewards });
            }
            // Milestone box every 10th level (10, 20, 30, ...)
            if (lv % 10 === 0) {
                if (!saveData.pendingMilestoneBoxes) saveData.pendingMilestoneBoxes = [];
                if (!saveData.pendingMilestoneBoxes.includes(lv)) saveData.pendingMilestoneBoxes.push(lv);
            }
        }
        saveData.levelRewardsThrough = Math.max(saveData.levelRewardsThrough || oldLevel, newLevel);
        if (_levelUpRewards.length > 0) {
            setTimeout(() => _showLevelUpRewardPopup(newLevel, _levelUpRewards), 2500);
        }
        if (saveData.pendingLevelBox) {
            const _boxDelay = _levelUpRewards.length > 0 ? 4500 : 2500;
            setTimeout(() => _showLevelBox(), _boxDelay);
        }
        if (saveData.pendingMilestoneReward || saveData.pendingMilestoneBoxes?.length) {
            const _mDelay = (_levelUpRewards.length > 0 ? 4500 : 2500) + (saveData.pendingLevelBox ? 2000 : 0);
            setTimeout(() => _checkMilestoneBoxes(), _mDelay);
        }
    }

    let _levelBoxShowing = false;
    function _showLevelBox() {
        if (_levelBoxShowing || !saveData.pendingLevelBox) return;
        _levelBoxShowing = true;
        const { level, rankName, rankColor, rewards } = saveData.pendingLevelBox;

        const overlay = document.createElement('div');
        overlay.className = 'lb-reward-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Earned rewards');
        overlay.id = 'level-box-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:3100;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

        const RARITY_COLS = { common:'#4caf50', rare:'#4499ff', epic:'#9932cc', legendary:'#ff9900', mythic:'#cc1111' };

        const panel = document.createElement('div');
        panel.style.cssText = 'background:rgba(5,5,20,0.98);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px 20px;max-width:420px;width:100%;text-align:center;max-height:90vh;overflow-y:auto;';

        // Title
        panel.innerHTML = `
            <div style="font-size:0.55rem;letter-spacing:3px;color:#666;margin-bottom:4px;font-family:var(--ui-font);">MILESTONE REWARD</div>
            <div class="lb-rank-identity" style="font-size:1rem;font-weight:bold;color:${rankColor};font-family:var(--ui-font);letter-spacing:1px;margin-bottom:2px;">${rankName}</div>
            <div style="font-size:0.6rem;color:#555;margin-bottom:16px;">Level ${level} — New rank reached!</div>
        `;

        // Box icon + open button (pre-open state)
        const preOpen = document.createElement('div');
        preOpen.id = 'lb-pre-open';
        preOpen.innerHTML = `
            <svg viewBox="0 0 64 64" width="80" height="80" fill="none" stroke="${rankColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:8px auto;display:block;filter:drop-shadow(0 0 12px ${rankColor}55);">
                <rect x="8" y="28" width="48" height="28" rx="3"/>
                <path d="M8 36h48"/>
                <path d="M32 8c0 0-8-4-12 0s-4 12 0 12h24c4 0 4-8 0-12s-12 0-12 0z"/>
                <line x1="32" y1="20" x2="32" y2="36"/>
                <line x1="32" y1="42" x2="32" y2="56"/>
            </svg>
            <div style="font-size:0.65rem;color:#666;margin-bottom:16px;">Contains 10 parts + 2 universal parts</div>
            <button id="lb-open-btn" style="font-family:var(--ui-font);font-size:0.7rem;letter-spacing:2px;padding:10px 28px;border-radius:10px;border:1px solid ${rankColor};background:${rankColor}22;color:${rankColor};cursor:pointer;transition:all 0.2s;">OPEN BOX</button>
        `;
        panel.appendChild(preOpen);

        // Rewards grid (hidden initially)
        const rewardsDiv = document.createElement('div');
        rewardsDiv.id = 'lb-rewards-grid';
        rewardsDiv.style.cssText = 'display:none;';
        const grid = document.createElement('div');
        grid.className = 'lb-reward-grid';
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;';
        rewards.forEach(r => {
            const card = document.createElement('div');
            card.className = 'lb-reward-card';
            const rc = RARITY_COLS[r.rarity] || '#aaa';
            card.style.cssText = `background:rgba(255,255,255,0.04);border:1px solid ${rc}44;border-radius:8px;padding:8px 4px;text-align:center;`;
            card.innerHTML = `<div style="font-size:1.3rem;margin-bottom:4px;">${r.icon}</div><div style="font-size:0.58rem;color:${rc};font-weight:bold;line-height:1.3;">${r.label}</div><div style="font-size:0.52rem;color:#555;margin-top:2px;">${r.desc}</div><div class="lb-reward-rarity">${r.rarity}</div>`;
            grid.appendChild(card);
        });
        rewardsDiv.appendChild(grid);
        rewardsDiv.innerHTML += `<button id="lb-claim-btn" style="font-family:var(--ui-font);font-size:0.7rem;letter-spacing:2px;padding:10px 28px;border-radius:10px;border:1px solid #22cc55;background:rgba(34,204,85,0.12);color:#22cc55;cursor:pointer;box-shadow:0 0 10px rgba(34,204,85,0.45);animation:pulse-glow-green 1.8s ease-in-out infinite;">CLAIM</button>`;
        panel.appendChild(rewardsDiv);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        _animateIn(panel, 'anim-in-down');

        panel.querySelector('#lb-open-btn').onclick = () => {
            preOpen.style.display = 'none';
            rewardsDiv.style.display = 'block';
            // Animate cards
            Array.from(grid.children).forEach((card, i) => {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.8)';
                card.style.transition = `opacity 0.25s ${i*0.06}s, transform 0.25s ${i*0.06}s`;
                setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 20);
            });
        };

        const claim = () => {
            overlay.remove();
            _levelBoxShowing = false;
            saveData.pendingLevelBox = (saveData.pendingLevelBoxes || []).shift() || null;
            setTimeout(() => _showLevelBox(), 0);
            saveDataToFile();
            drawRankBadge();
            _populateVisualCustomize();
        };

        // Use event delegation for claim button since it's added via innerHTML
        rewardsDiv.addEventListener('click', e => { if (e.target.id === 'lb-claim-btn') claim(); });
    }

    function devSetXP() { devSetXPorLevel(); }
    function devSetXPorLevel() {
        const choice = confirm("OK = enter XP directly\nCancel = enter Level number");
        if (choice) {
            const input = prompt("Enter total XP:", saveData.totalXP);
            if (input !== null && !isNaN(input) && input.trim() !== '') {
                const oldLevel = getLevelInfo(saveData.totalXP).level;
                saveData.totalXP = Math.max(0, parseInt(input));
                _processLevelUps(oldLevel, getLevelInfo(saveData.totalXP).level);
                saveDataToFile(); drawRankBadge();
                customAlert(`XP set to ${saveData.totalXP}`, 'DEV MODE');
            }
        } else {
            const input = prompt("Enter level (1–81+):\n 1–10  Bronze\n11–20  Silver\n21–30  Gold\n31–40  Emerald\n41–50  Sapphire\n51–60  Ruby\n61–70  Amethyst\n71–80  Diamond\n  81+  Celestite", getLevelInfo(saveData.totalXP).level);
            if (input !== null && !isNaN(input) && input.trim() !== '') {
                const targetLevel = Math.max(1, parseInt(input));
                let xp = 0, lvl = 0;
                for (let ri = 0; ri < _RANK_XP_PER_LEVEL.length && lvl < targetLevel - 1; ri++) {
                    const cost = _RANK_XP_PER_LEVEL[ri];
                    for (let i = 0; i < 10 && lvl < targetLevel - 1; i++) { xp += cost; lvl++; }
                }
                // Celestite levels beyond 80
                if (lvl < targetLevel - 1) {
                    const celestiteCost = 24000;
                    while (lvl < targetLevel - 1) { xp += celestiteCost; lvl++; }
                }
                const oldLevel = getLevelInfo(saveData.totalXP).level;
                saveData.totalXP = xp;
                _processLevelUps(oldLevel, getLevelInfo(saveData.totalXP).level);
                saveDataToFile(); drawRankBadge();
                customAlert(`Level set to ${targetLevel} (XP: ${xp})`, 'DEV MODE');
            }
        }
    }
    function devResetDailyGift() {
        saveData.lastDailyGift = null;
        updateDailyGiftBtn();
        customAlert('Daily gift reset! Gift is now available.', 'DEV');
    }
    function devResetStore() {
        saveData.ownedSkins = ['neon'];
        saveData.ownedFonts = ['Orbitron'];
        saveData.ownedThemes = [];
        saveData.ownedBtnStyles = [];
        saveData.ownedBlockShapes = [];
        saveData.ownedGridStyles = [];
        saveData.ghostColorUnlocked = false;
        saveData.boosters = {};
        saveData.parts = {};
        saveData.universalParts = 0;
        saveDataToFile();
        customAlert('Items reset! All unlocked items removed.', 'DEV');
    }
    function devAddRandomScores() {
        if (!saveData.leaderboard) saveData.leaderboard = [];
        const now = new Date();
        const entries = [
            [48200, 87, 312, 214, 11, 48200, 5],
            [31500, 62, 240, 178, 9,  31500, 3],
            [72400, 134, 498, 341, 14, 72400, 8],
            [9800,  22, 80,  67,  6,  9800,  1],
            [155000,289, 1040, 720, 15, 155000, 12],
            [22100, 44, 165, 130, 8,  22100, 2],
            [5300,  11, 42,  38,  4,  5300,  0],
            [88700, 162, 590, 410, 13, 88700, 7],
            [41000, 78, 285, 195, 10, 41000, 4],
            [3100,  7,  28,  24,  3,  3100,  0],
            [120000,225, 810, 560, 15, 120000, 10],
            [67300, 123, 450, 302, 12, 67300, 6],
            [18600, 36, 132, 98,  7,  18600, 2],
            [250000,460, 1640, 1120, 15, 250000, 18],
            [11200, 24, 90,  72,  5,  11200, 1],
        ];
        entries.forEach(([score, lines, blocks, time, maxSpeed, xp, maxCombo], i) => {
            const d = new Date(now - i * 8.64e7 * (1 + Math.random()));
            const dd=String(d.getDate()).padStart(2,'0'), mm=String(d.getMonth()+1).padStart(2,'0');
            const hh=String(d.getHours()).padStart(2,'0'), mn=String(d.getMinutes()).padStart(2,'0');
            saveData.leaderboard.push({ score, date:`${dd}.${mm}.${d.getFullYear()} ${hh}:${mn}`, lines, blocks, time, maxSpeed, xp, maxCombo });
        });
        saveData.leaderboard.sort((a,b) => b.score - a.score);
        saveDataToFile();
        customAlert(`Added ${entries.length} random scores!`, 'DEV');
    }
    function devResetScores() {
        if (!confirm('Reset ALL leaderboard scores? This cannot be undone.')) return;
        saveData.leaderboard = [];
        saveData.highscore = 0;
        saveData.pinnedScores = [];
        saveDataToFile();
        customAlert('Leaderboard scores reset!', 'DEV');
    }
    function devAddLeaderboardScore() {
        const scoreIn = prompt("Score:", 10000);
        if (scoreIn === null || isNaN(scoreIn)) return;
        const linesIn = prompt("Lines:", 40);
        if (linesIn === null || isNaN(linesIn)) return;
        const timeIn = prompt("Time (seconds):", 120);
        if (timeIn === null || isNaN(timeIn)) return;
        const score = parseInt(scoreIn), lines = parseInt(linesIn), time = parseInt(timeIn);
        saveToLeaderboard(score, lines, Math.floor(score/10), time, 5, score);
        saveDataToFile();
        customAlert(`Score ${score.toLocaleString()} added to leaderboard.`, 'DEV MODE');
    }
    function devEditStats() {
        const gp = prompt("Games played:", saveData.stats.gamesPlayed);
        if (gp === null) return;
        const tp = prompt("Total time played (seconds):", saveData.stats.totalTimePlayed);
        if (tp === null) return;
        const bp = prompt("Total blocks placed:", saveData.stats.totalBlocksPlaced);
        if (bp === null) return;
        const lc = prompt("Total lines cleared:", saveData.stats.totalLinesCleared);
        if (lc === null) return;
        if (!isNaN(gp)) saveData.stats.gamesPlayed = parseInt(gp);
        if (!isNaN(tp)) saveData.stats.totalTimePlayed = parseInt(tp);
        if (!isNaN(bp)) saveData.stats.totalBlocksPlaced = parseInt(bp);
        if (!isNaN(lc)) saveData.stats.totalLinesCleared = parseInt(lc);
        saveDataToFile();
        customAlert('Stats updated.', 'DEV MODE');
    }
    function devUnlockAllAchievements() {
        if (!saveData.achievements) saveData.achievements = {};
        if (!saveData.pendingAchievementClaims) saveData.pendingAchievementClaims = [];
        ACHIEVEMENTS_DEF.forEach(a => {
            if (a.type === 'tiered') {
                const cur = saveData.achievements[a.id]?.tier || 0;
                for (let i = cur; i < a.tiers.length; i++) {
                    const tier = a.tiers[i];
                    const xp = _ACH_XP[tier.rarity] || 500;
                    saveData.pendingAchievementClaims.push({ id: a.id, tierNum: i + 1, rarity: tier.rarity, xp, name: tier.name });
                }
                saveData.achievements[a.id] = { tier: a.tiers.length };
            } else {
                unlockAchievement(a.id);
            }
        });
        _checkAchGlow();
        saveDataToFile();
        customAlert(`Unlocked all ${ACHIEVEMENTS_DEF.length} achievements.`, 'DEV MODE');
    }
    function devLockAllAchievements() {
        saveData.achievements = {};
        saveData.pendingAchievementClaims = [];
        _checkAchGlow();
        saveDataToFile();
        customAlert('All achievements locked/reset.', 'DEV MODE');
    }

    function devLegendaryPreview() { /* removed */ }


    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        return `${m}m ${s}s`;
    }

    function _seedTestScores() {
        if (saveData.leaderboard.length >= 50) return; // only seed if few scores
        const now = Date.now();
        const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
        for (let i = 0; i < 300; i++) {
            const ts = now - Math.random() * twoYearsMs;
            const d = new Date(ts);
            const dd = String(d.getDate()).padStart(2,'0');
            const mm = String(d.getMonth()+1).padStart(2,'0');
            const yy = d.getFullYear();
            const hh = String(d.getHours()).padStart(2,'0');
            const mi = String(d.getMinutes()).padStart(2,'0');
            const score = Math.floor(Math.random() * 8000) + 100;
            const lines = Math.floor(Math.random() * 40);
            const blocks = Math.floor(lines * 3 + Math.random() * 30);
            const time = Math.floor(Math.random() * 600) + 30;
            const maxSpeed = Math.min(15, Math.floor(lines / 10) + 1);
            saveData.leaderboard.push({ score, date:`${dd}.${mm}.${yy} ${hh}:${mi}`, lines, blocks, time, maxSpeed, xp: score });
            const key = `${yy}-${mm}-${dd}`;
            if (!saveData.stats.playHistory) saveData.stats.playHistory = {};
            saveData.stats.playHistory[key] = (saveData.stats.playHistory[key] || 0) + 1;
        }
        saveData.leaderboard.sort((a,b) => b.score - a.score);
        saveDataToFile();
    }

    function openStats() {
        checkProgressAchievements();
        const _s = v => v ? v : '—';
        const _sn = v => v ? v.toLocaleString() : '—';
        document.getElementById('stat-total-xp').innerText = _sn(saveData.totalXP);
        document.getElementById('stat-games').innerText = _s(saveData.stats.gamesPlayed);
        document.getElementById('stat-time').innerText = saveData.stats.totalTimePlayed ? formatTime(saveData.stats.totalTimePlayed) : '—';
        document.getElementById('stat-blocks').innerText = _s(saveData.stats.totalBlocksPlaced);
        document.getElementById('stat-lines').innerText = _s(saveData.stats.totalLinesCleared);
        const streakEl = document.getElementById('stat-daily-streak');
        if (streakEl) { const sv = saveData.stats.highestDailyStreak || saveData.stats.dailyStreak || 0; streakEl.innerText = sv ? sv + ' days' : '—'; }
        const comboEl = document.getElementById('stat-max-combo');
        if (comboEl) { const cv = saveData.stats.maxCombo || 0; comboEl.innerText = cv ? '×' + cv : '—'; }
        // Average Score
        const bestScoreEl = document.getElementById('stat-best-score');
        if (bestScoreEl) {
            const gp = saveData.stats.gamesPlayed || 0;
            const ts = saveData.stats.totalScore || 0;
            const avg = gp > 0 ? Math.round(ts / gp) : 0;
            bestScoreEl.innerText = avg > 0 ? avg.toLocaleString() : '—';
            const bestScoreLabel = bestScoreEl.parentElement?.querySelector('span:first-child');
            if (bestScoreLabel) bestScoreLabel.innerText = 'Average Score';
        }
        const _fmt2 = t => { const m = Math.floor(t / 60), s = t % 60; return `${m}m ${String(s).padStart(2, '0')}s`; };
        const daysPlayedEl = document.getElementById('stat-days-played');
        if (daysPlayedEl) { const ph = saveData.stats?.playHistory || {}; const dpv = Object.keys(ph).length; daysPlayedEl.innerText = dpv ? dpv : '—'; }
        // Items Collected (X / Y)
        const bestXpEl = document.getElementById('stat-best-xp');
        if (bestXpEl) {
            const _ownedSkins = (saveData.ownedSkins || ['neon']).filter(_skinAvailable).length;
            const _totalSkins = _devMode ? 17 : 8;
            const _ownedThemes = (saveData.ownedThemes || []).length + 1; // +1 for default
            const _totalThemes = Object.keys(THEMES).length;
            const _ownedGrid = (saveData.ownedGridStyles || []).length + 1; // +1 for lines (free)
            const _totalGrid = Object.keys(GRID_STYLES).length;
            const _ownedPal = (saveData.ownedPalettes || ['classic']).length;
            const _totalPal = Object.keys(BLOCK_PALETTES).length;
            const _ownedSfx = (saveData.ownedSfxPacks || ['default']).length;
            const _totalSfx = 5;
            const _ghost = saveData.ghostColorUnlocked ? 1 : 0;
            const _collected = _ownedSkins + _ownedThemes + _ownedGrid + _ownedPal + _ownedSfx + _ghost;
            const _total = _totalSkins + _totalThemes + _totalGrid + _totalPal + _totalSfx + 1;
            bestXpEl.innerText = `${_collected} / ${_total}`;
            const bestXpLabel = bestXpEl.parentElement?.querySelector('span:first-child');
            if (bestXpLabel) bestXpLabel.innerText = 'Items Collected';
        }
        _renderActivityCalendar(null);
        const usageEl = document.getElementById('stat-block-usage');
        if (usageEl) {
            const usage = saveData.stats.blockTypeUsage || {};
            usageEl.innerHTML = `<div style="font-size:0.83rem;letter-spacing:2px;color:#555;margin-bottom:12px;">BLOCK USAGE</div>` +
                `<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">` +
                [1,2,3,4,5,6,7].map(t => {
                    const count = usage[t] || 0;
                    const color = COLORS[t];
                    const shape = BASE_PIECES[t].filter(row => row.some(c => c));
                    const miniCell = 11;
                    const miniPiece = shape.map(row =>
                        `<div style="display:flex;">` + row.map(c =>
                            `<div style="width:${miniCell}px;height:${miniCell}px;${c ? `background:${color};box-shadow:0 0 4px ${color};` : 'background:transparent;'};margin:0.5px;border-radius:1px;"></div>`
                        ).join('') + `</div>`
                    ).join('');
                    return `<div style="display:flex;flex-direction:column;align-items:center;gap:5px;min-width:66px;">
                        <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:50px;">${miniPiece}</div>
                        <div style="font-size:1rem;color:${color};font-weight:bold;line-height:1;">${count}</div>
                    </div>`;
                }).join('') + `</div>`;
        }
        statsLbTab('leaderboard');
        const _statsEl = document.getElementById('stats-overlay');
        _statsEl.classList.remove('hidden');
        _animateIn(_statsEl, 'anim-in-right');
    }
    function _renderActivityCalendar(year) {
        const container = document.getElementById('stat-activity-calendar');
        if (!container) return;

        // Build history: start from playHistory, add leaderboard entries
        const history = {};
        const ph = saveData.stats.playHistory || {};
        Object.keys(ph).forEach(k => { history[k] = ph[k] || 0; });
        // Migrate old playDates array
        if (saveData.stats.playDates && Array.isArray(saveData.stats.playDates)) {
            saveData.stats.playDates.forEach(d => { history[d] = (history[d] || 0) + 1; });
            saveData.stats.playHistory = Object.assign({}, ph, history);
            delete saveData.stats.playDates;
        }
        // Supplement from leaderboard for historical data (before playHistory was tracked)
        const lbCounted = {};
        (saveData.leaderboard || []).forEach(entry => {
            if (!entry.date) return;
            const m = entry.date.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
            if (!m) return;
            const key = `${m[3]}-${m[2]}-${m[1]}`;
            lbCounted[key] = (lbCounted[key] || 0) + 1;
        });
        // Use max(playHistory[d], lbCounted[d]) — playHistory is accurate for new games,
        // leaderboard fills in old dates where playHistory has no record
        Object.keys(lbCounted).forEach(k => {
            if ((lbCounted[k] || 0) > (history[k] || 0)) history[k] = lbCounted[k];
        });

        const now = new Date();
        const nowYear = now.getFullYear();
        const yearSet = new Set([nowYear]);
        Object.keys(history).forEach(d => { const y = parseInt(d.split('-')[0]); if (!isNaN(y)) yearSet.add(y); });
        (saveData.leaderboard || []).forEach(entry => {
            if (entry.date) { const m2 = entry.date.match(/\d{4}$/m); if (m2) yearSet.add(parseInt(m2[0])); }
        });
        const years = Array.from(yearSet).sort((a, b) => a - b);
        if (year === undefined || year === null) year = parseInt(container.dataset.calYear) || nowYear;
        if (!years.includes(year)) year = years[years.length - 1];
        container.dataset.calYear = year;

        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        const _ldk = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

        // Build cell data
        const firstDay = new Date(year, 0, 1);
        const lastDay = new Date(year, 11, 31);
        const startDow = (firstDay.getDay() + 6) % 7; // Mon=0, Sun=6
        const totalDays = Math.round((lastDay - firstDay) / 86400000) + 1;
        const totalWeeks = Math.ceil((startDow + totalDays) / 7);

        const cells = [];
        for (let w = 0; w < totalWeeks; w++) {
            for (let d = 0; d < 7; d++) {
                const dayIndex = w * 7 + d - startDow;
                if (dayIndex < 0 || dayIndex >= totalDays) { cells.push(null); continue; }
                const date = new Date(year, 0, 1 + dayIndex);
                const key = _ldk(date);
                cells.push({ key, count: history[key] || 0 });
            }
        }

        // Compute cell size to fit full year without scrolling
        // Container width is dynamic; we compute after setting innerHTML once
        // Use CSS approach: fixed small cells, let container scroll only if truly needed
        const GAP = 4;
        // We'll use CSS variable approach: compute in JS after render
        const ROW_LBL = 34; // px for day labels

        // Year tabs
        let html = `<div style="display:flex;justify-content:center;gap:5px;margin-bottom:8px;">`;
        years.forEach(y => {
            const active = y === year;
            html += `<button data-cal-year="${y}" style="border:1px solid ${active?'var(--primary)':'#333'};background:${active?'var(--primary)':'transparent'};color:${active?'#000':'#666'};border-radius:20px;padding:2px 12px;font-size:0.58rem;cursor:pointer;font-family:inherit;font-weight:bold;">${y}</button>`;
        });
        html += `</div>`;

        // Month labels (absolutely positioned over week columns)
        // We compute month positions using week index * (CELL+GAP) + ROW_LBL
        // We'll use a data attribute and compute positions after render
        html += `<div id="cal-month-row" style="position:relative;height:14px;margin-bottom:3px;padding-left:${ROW_LBL}px;" data-start-dow="${startDow}" data-first-year="${year}">`;
        for (let m = 0; m < 12; m++) {
            const firstOfMonth = new Date(year, m, 1);
            const dayIdx = Math.round((firstOfMonth - firstDay) / 86400000);
            const weekCol = Math.floor((startDow + dayIdx) / 7);
            const dow = (startDow + dayIdx) % 7;
            const lastOfMonth = new Date(year, m+1, 0);
            const lastDayIdx = Math.round((lastOfMonth - firstDay) / 86400000);
            const wcEnd = Math.floor((startDow + lastDayIdx) / 7);
            // Separator is drawn at the boundary AFTER the last day of the previous month (shift +1 day)
            const sepDayIdx = dayIdx + 1;
            const sepWc = Math.floor((startDow + sepDayIdx) / 7);
            const sepDow = (startDow + sepDayIdx) % 7;
            html += `<span data-week-col="${weekCol}" data-dow="${dow}" data-wc-end="${wcEnd}" data-sep-wc="${sepWc}" data-sep-dow="${sepDow}" style="position:absolute;font-size:0.52rem;color:#888;font-weight:bold;white-space:nowrap;transform:translateX(-50%);">${MONTHS[m]}</span>`;
        }
        html += `</div>`;

        // Grid: day labels + week columns
        html += `<div style="display:flex;gap:0;">`;
        // Day labels
        html += `<div id="cal-day-labels" style="display:flex;flex-direction:column;gap:${GAP}px;width:${ROW_LBL}px;flex-shrink:0;">`;
        DAY_LABELS.forEach(l => {
            html += `<div style="font-size:0.5rem;color:#555;text-align:right;padding-right:4px;display:flex;align-items:center;justify-content:flex-end;">${l}</div>`;
        });
        html += `</div>`;
        // Week columns wrapper
        html += `<div id="cal-grid" style="display:flex;gap:${GAP}px;flex:1;">`;
        for (let w = 0; w < totalWeeks; w++) {
            html += `<div style="display:flex;flex-direction:column;gap:${GAP}px;flex:1;">`;
            for (let d = 0; d < 7; d++) {
                const cell = cells[w * 7 + d];
                if (!cell) {
                    html += `<div style="flex:1;min-height:4px;"></div>`;
                } else {
                    const c = cell.count;
                    let bg, op, extra = '';
                    if (c === 0) {
                        bg = 'rgba(255,255,255,0.07)'; op = '1';
                    } else if (c === 1) {
                        bg = 'var(--primary)'; op = '0.55';
                    } else if (c === 2) {
                        bg = 'var(--primary)'; op = '0.70';
                    } else if (c <= 4) {
                        bg = 'var(--primary)'; op = '0.84';
                    } else if (c <= 7) {
                        bg = 'var(--primary)'; op = '0.94';
                    } else {
                        bg = 'var(--primary)'; op = '1'; extra = 'box-shadow:0 0 5px var(--primary);';
                    }
                    const isToday = cell.key === _ldk(now);
                    if (isToday) {
                        op = '1';
                        const bdrColor = c === 0 ? 'var(--primary)' : 'rgba(255,255,255,0.85)';
                        extra += `outline:2px solid ${bdrColor};outline-offset:-1px;border-radius:1px;`;
                    }
                    const [cy, cm, cd] = cell.key.split('-');
                    const fmtDate = `${cd}.${cm}.${cy}`;
                    const tip = c > 0 ? `${fmtDate} — ${c} game${c>1?'s':''}` : fmtDate;
                    html += `<div data-ctip="${tip}" style="flex:1;min-height:4px;border-radius:2px;background:${bg};opacity:${op};${extra}"></div>`;
                }
            }
            html += `</div>`;
        }
        html += `</div></div>`;

        // --- TODAY's stats section ---
        const todayKey = _ldk(now);
        const todayGames = history[todayKey] || 0;
        const [tY, tM, tD] = todayKey.split('-');
        const todayDatePrefix = `${tD}.${tM}.${tY}`;
        const todayEntries = (saveData.leaderboard || []).filter(e => e.date && e.date.startsWith(todayDatePrefix));
        const todayBestScore = todayEntries.length > 0 ? Math.max(...todayEntries.map(e => e.score || 0)) : 0;
        const todayAvgScore = todayEntries.length > 0 ? Math.round(todayEntries.reduce((s, e) => s + (e.score || 0), 0) / todayEntries.length) : 0;
        const todayTotalTime = todayEntries.reduce((s, e) => s + (e.time || 0), 0);
        const todayTimeFmt = todayTotalTime >= 3600 ? `${Math.floor(todayTotalTime/3600)}h ${Math.floor((todayTotalTime%3600)/60)}m` : `${Math.floor(todayTotalTime/60)}m ${todayTotalTime%60}s`;
        const todayXP = todayEntries.reduce((s, e) => s + (e.xp || 0), 0);
        html += `<div style="display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:10px;padding:8px 6px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.05);">
            <div style="font-size:0.55rem;color:#888;letter-spacing:1.5px;font-weight:bold;width:100%;margin-bottom:2px;">TODAY</div>
            <div style="flex:1;min-width:80px;"><span style="font-size:0.52rem;color:#555;text-transform:uppercase;">Games</span><div style="font-size:0.82rem;font-weight:bold;color:#fff;">${todayGames > 0 ? todayGames : '—'}</div></div>
            <div style="flex:1;min-width:80px;"><span style="font-size:0.52rem;color:#555;text-transform:uppercase;">Best Score</span><div style="font-size:0.82rem;font-weight:bold;color:#fff;">${todayBestScore > 0 ? todayBestScore.toLocaleString() : '—'}</div></div>
            <div style="flex:1;min-width:80px;"><span style="font-size:0.52rem;color:#555;text-transform:uppercase;">Avg Score</span><div style="font-size:0.82rem;font-weight:bold;color:#fff;">${todayAvgScore > 0 ? todayAvgScore.toLocaleString() : '—'}</div></div>
            <div style="flex:1;min-width:80px;"><span style="font-size:0.52rem;color:#555;text-transform:uppercase;">Time Played</span><div style="font-size:0.82rem;font-weight:bold;color:#fff;">${todayTotalTime > 0 ? todayTimeFmt : '—'}</div></div>
            <div style="flex:1;min-width:80px;"><span style="font-size:0.52rem;color:#555;text-transform:uppercase;">XP Earned</span><div style="font-size:0.82rem;font-weight:bold;color:#fff;">${todayXP > 0 ? todayXP.toLocaleString() : '—'}</div></div>
        </div>`;

        container.innerHTML = html;

        requestAnimationFrame(() => {
            // After render: compute actual cell size and position month labels
            const grid = document.getElementById('cal-grid');
            if (grid) {
                const gridW = grid.offsetWidth;
                const cellW = Math.max(4, Math.floor((gridW - GAP * (totalWeeks - 1)) / totalWeeks));
                const rowH = cellW; // square cells
                // Apply sizes
                grid.querySelectorAll(':scope > div').forEach(col => {
                    col.style.flex = 'none';
                    col.style.width = cellW + 'px';
                    col.querySelectorAll(':scope > div').forEach(cell => {
                        cell.style.flex = 'none';
                        cell.style.height = rowH + 'px';
                        cell.style.minHeight = '';
                        cell.style.borderRadius = Math.max(1, Math.round(cellW * 0.2)) + 'px';
                    });
                });
                // Fix day label heights
                const dayLabels = document.getElementById('cal-day-labels');
                if (dayLabels) {
                    dayLabels.querySelectorAll('div').forEach(el => {
                        el.style.height = rowH + 'px';
                        el.style.lineHeight = rowH + 'px';
                    });
                }
                // Position month labels (centered over each month's span)
                const monthRow = document.getElementById('cal-month-row');
                if (monthRow) {
                    monthRow.querySelectorAll('span').forEach(span => {
                        const wcStart = parseInt(span.dataset.weekCol);
                        const wcEnd = parseInt(span.dataset.wcEnd) || wcStart;
                        const xCenter = ((wcStart + wcEnd + 1) / 2) * (cellW + GAP) - GAP / 2;
                        span.style.left = (ROW_LBL + xCenter) + 'px';
                    });
                }
                // Month separator lines — L-shaped to follow actual month boundaries
                const calGrid2 = document.getElementById('cal-grid');
                if (calGrid2 && monthRow) {
                    calGrid2.style.position = 'relative';
                    const gridH = rowH * 7 + GAP * 6;
                    // Build single SVG overlay for all separators
                    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svgEl.style.cssText = `position:absolute;left:0;top:0;pointer-events:none;z-index:1;overflow:visible;`;
                    svgEl.setAttribute('width', totalWeeks * (cellW + GAP));
                    svgEl.setAttribute('height', gridH);
                    monthRow.querySelectorAll('span').forEach((span, idx) => {
                        if (idx === 0) return;
                        const wc = parseInt(span.dataset.sepWc ?? span.dataset.weekCol);
                        const dow = parseInt(span.dataset.sepDow ?? span.dataset.dow) || 0;
                        if (isNaN(wc) || wc === 0) return;
                        const xL = wc * (cellW + GAP) - GAP / 2;       // left of gap before col wc
                        const xR = (wc + 1) * (cellW + GAP) - GAP / 2; // right of col wc
                        const yStep = Math.round(dow * (rowH + GAP) - GAP / 2);
                        let pathD;
                        if (dow === 0) {
                            pathD = `M ${xL} 0 L ${xL} ${gridH}`;
                        } else {
                            pathD = `M ${xR} 0 L ${xR} ${yStep} L ${xL} ${yStep} L ${xL} ${gridH}`;
                        }
                        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        pathEl.setAttribute('d', pathD);
                        pathEl.setAttribute('stroke', getComputedStyle(document.documentElement).getPropertyValue('--primary-dim').trim() || 'rgba(0,255,255,0.2)');
                        pathEl.setAttribute('stroke-width', '1');
                        pathEl.setAttribute('fill', 'none');
                        svgEl.appendChild(pathEl);
                    });
                    calGrid2.appendChild(svgEl);
                }
            }
            // Year tab clicks
            container.querySelectorAll('[data-cal-year]').forEach(btn => {
                btn.addEventListener('click', () => _renderActivityCalendar(parseInt(btn.dataset.calYear)));
            });
        });
        // Tooltips
        let calTip = document.getElementById('cal-tip');
        if (!calTip) {
            calTip = document.createElement('div');
            calTip.id = 'cal-tip';
            calTip.style.cssText = 'display:none;position:fixed;z-index:2300;background:rgba(5,5,20,0.97);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:4px 10px;font-size:0.6rem;pointer-events:none;color:#ccc;font-family:inherit;white-space:nowrap;';
            document.body.appendChild(calTip);
        }
        container.querySelectorAll('[data-ctip]').forEach(el => {
            const _origOutline = el.style.outline || '';
            el.addEventListener('mouseenter', e => { calTip.textContent = el.dataset.ctip; calTip.style.display = 'block'; calTip.style.left=(e.clientX+12)+'px'; calTip.style.top=(e.clientY-30)+'px'; el.style.outline = '1.5px solid rgba(255,255,255,0.7)'; });
            el.addEventListener('mouseleave', () => { calTip.style.display = 'none'; el.style.outline = _origOutline; });
            el.addEventListener('mousemove', e => { calTip.style.left=(e.clientX+12)+'px'; calTip.style.top=(e.clientY-30)+'px'; });
        });
    }
    function statsLbTab(tab) {
        const _statOv = document.getElementById('stats-overlay');
        const _prevStatTab = _statOv ? _statOv._statTab : null;
        if (_statOv) _statOv._statTab = tab;
        const lbEl = document.getElementById('leaderboard-container');
        const pinEl = document.getElementById('pinned-container');
        const hsEl = document.getElementById('highscores-container');
        const funEl = document.getElementById('fun-container');
        const tabLb = document.getElementById('stats-tab-lb');
        const tabPin = document.getElementById('stats-tab-pin');
        const tabHs = document.getElementById('stats-tab-hs');
        const tabFun = document.getElementById('stats-tab-fun');
        if (lbEl) lbEl.style.display = tab === 'leaderboard' ? '' : 'none';
        if (pinEl) pinEl.style.display = tab === 'pinned' ? '' : 'none';
        if (hsEl) hsEl.style.display = tab === 'highscores' ? '' : 'none';
        if (funEl) funEl.style.display = tab === 'fun' ? '' : 'none';
        if (tabLb) tabLb.classList.toggle('active', tab === 'leaderboard');
        if (tabPin) tabPin.classList.toggle('active', tab === 'pinned');
        if (tabHs) tabHs.classList.toggle('active', tab === 'highscores');
        if (tabFun) tabFun.classList.toggle('active', tab === 'fun');
        if (tab === 'leaderboard') drawLeaderboard();
        if (tab === 'pinned') drawPinnedScores();
        if (tab === 'highscores') _drawHighscoreHistory();
        if (tab === 'fun') _drawFunLeaderboard();
        if (_prevStatTab && _prevStatTab !== tab) {
            const _ord = ['leaderboard', 'pinned', 'highscores', 'fun'];
            const _oi = _ord.indexOf(_prevStatTab), _ni = _ord.indexOf(tab);
            const _ids = { leaderboard: lbEl, pinned: pinEl, highscores: hsEl, fun: funEl };
            const _p = _ids[tab];
            if (_p) _animateIn(_p, _ni > _oi ? 'tab-slide-in-right' : 'tab-slide-in-left');
        }
    }

    function _drawFunLeaderboard() {
        const container = document.getElementById('fun-list');
        if (!container) return;
        container.innerHTML = '';
        const fl = saveData.funLeaderboard || [];
        if (!fl.length) {
            container.innerHTML = "<div style='color:#666;text-align:center;padding:15px 0;'>No fun mode games yet!</div>";
            return;
        }
        const lbFmt = (t) => { const m = Math.floor(t/60); const s = t%60; return `${m}m ${String(s).padStart(2,'0')}s`; };
        let _shown = 50;
        function _renderRows(upTo) {
            container.querySelectorAll('.lb-row, .lb-load-more').forEach(el => el.remove());
            const max = Math.min(upTo, fl.length);
            for (let i = 0; i < max; i++) {
                const e = fl[i];
                const div = document.createElement('div'); div.className = 'lb-row';
                const rankColor = i === 0 ? '#ffd700' : i < 3 ? '#c0c0c0' : i < 10 ? '#9b59b6' : '#666';
                const configStr = `${e.cols||10}×${e.rows||20}` + (e.startSpeed && e.startSpeed > 1 ? ` · spd ${e.startSpeed}` : '');
                const details = `<span class="lb-detail">${configStr}</span><span class="lb-detail">${lbFmt(e.time||0)}</span><span class="lb-detail">${e.lines||0} lines</span>`;
                div.innerHTML = `<span class="lb-rank" style="font-size:0.85rem;font-weight:bold;color:${rankColor};min-width:52px;text-align:center;">#${i+1}</span><span class="lb-score">${e.score.toLocaleString()} <span class="lb-pts">pts</span></span><span class="lb-details-row">${details}</span><span class="lb-date">${e.date}</span>`;
                container.appendChild(div);
            }
            if (max < fl.length) {
                const moreBtn = document.createElement('div');
                moreBtn.className = 'lb-load-more';
                moreBtn.style.cssText = 'text-align:center;padding:12px;cursor:pointer;color:var(--primary);font-size:0.7rem;font-weight:bold;letter-spacing:1px;opacity:0.7;transition:opacity 0.2s;';
                moreBtn.textContent = `LOAD MORE (${fl.length - max} remaining)`;
                moreBtn.addEventListener('mouseenter', () => moreBtn.style.opacity = '1');
                moreBtn.addEventListener('mouseleave', () => moreBtn.style.opacity = '0.7');
                moreBtn.addEventListener('click', () => { _shown += 50; _renderRows(_shown); });
                container.appendChild(moreBtn);
            }
        }
        _renderRows(_shown);
    }

    function closeStats() {
        const _mEl = document.getElementById('menu-overlay');
        _animateOut(document.getElementById('stats-overlay'), 'anim-out-right');
        if (_mEl && !_mEl.classList.contains('hidden')) _animateIn(_mEl, 'anim-in-left');
    }

    function openTransferMenu() {
        const _trEl = document.getElementById('transfer-overlay');
        _trEl.classList.remove('hidden');
        _animateIn(_trEl, 'anim-in-right');
    }
    function closeTransferMenu() {
        _animateOut(document.getElementById('transfer-overlay'), 'anim-out-right', function() {
            const inp = document.getElementById('target-id-input');
            if (inp) inp.value = '';
        });
    }

    function settingsTab(tab) { /* tabs removed — settings is a single scroll */ }
    function inventoryTab(tab) {
        const _invOv = document.getElementById('inventory-overlay');
        const _prevInvTab = _invOv ? _invOv._invTab : null;
        if (_invOv) _invOv._invTab = tab;
        document.querySelectorAll('[data-invtab]').forEach(b => b.classList.toggle('active', b.dataset.invtab === tab));
        document.querySelectorAll('[data-invtab-content]').forEach(p => p.classList.toggle('hidden', p.dataset.invtabContent !== tab));
        if (tab === 'other') _populateInventoryOther();
        if (tab === 'blocks' || tab === 'colors' || tab === 'fonts') _populateVisualCustomize();
        if (_prevInvTab && _prevInvTab !== tab) {
            const _ord = ['blocks', 'colors', 'other'];
            const _oi = _ord.indexOf(_prevInvTab), _ni = _ord.indexOf(tab);
            const _p = document.querySelector(`[data-invtab-content="${tab}"]`);
            if (_p) _animateIn(_p, _ni > _oi ? 'tab-slide-in-right' : 'tab-slide-in-left');
        }
    }
    function settingsVisualSubTab(tab) {
        document.querySelectorAll('[data-vstab]').forEach(b => b.classList.toggle('active', b.dataset.vstab === tab));
        document.querySelectorAll('[data-vstab-content]').forEach(p => p.classList.toggle('hidden', p.dataset.vstabContent !== tab));
    }
    let _prevMusicVol = 60, _prevSfxVol = 50;
    let _musicMuted = settings.musicMuted || false, _sfxMuted = settings.sfxMuted || false;
    const _SVG_PIX_VOL = `<svg viewBox="0 0 16 16" width="14" height="14" shape-rendering="crispEdges"><rect fill="currentColor" x="0" y="6" width="4" height="4"/><rect fill="currentColor" x="4" y="4" width="2" height="8"/><rect fill="currentColor" x="6" y="2" width="2" height="12"/><rect fill="currentColor" x="10" y="5" width="2" height="6"/><rect fill="currentColor" x="13" y="3" width="2" height="10"/></svg>`;
    const _SVG_PIX_MUTED = `<svg viewBox="0 0 16 16" width="14" height="14" shape-rendering="crispEdges"><rect fill="currentColor" x="0" y="6" width="4" height="4"/><rect fill="currentColor" x="4" y="4" width="2" height="8"/><rect fill="currentColor" x="6" y="2" width="2" height="12"/><rect fill="currentColor" x="10" y="4" width="2" height="2"/><rect fill="currentColor" x="12" y="6" width="2" height="2"/><rect fill="currentColor" x="14" y="8" width="2" height="2"/><rect fill="currentColor" x="12" y="10" width="2" height="2"/><rect fill="currentColor" x="10" y="12" width="2" height="2"/></svg>`;
    const _SVG_PIX_PAUSE = `<svg viewBox="0 0 16 16" width="14" height="14" shape-rendering="crispEdges"><rect fill="currentColor" x="3" y="2" width="4" height="12"/><rect fill="currentColor" x="9" y="2" width="4" height="12"/></svg>`;
    const _SVG_PIX_PLAY = `<svg viewBox="0 0 16 16" width="14" height="14" shape-rendering="crispEdges"><rect fill="currentColor" x="3" y="2" width="2" height="12"/><rect fill="currentColor" x="5" y="4" width="2" height="8"/><rect fill="currentColor" x="7" y="5" width="2" height="6"/><rect fill="currentColor" x="9" y="6" width="2" height="4"/><rect fill="currentColor" x="11" y="7" width="2" height="2"/></svg>`;
    const _SVG_VOL = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
    const _SVG_MUTED = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
    function toggleMute(type) {
        const isPix = settings.stylePack === 'pixel';
        const svgVol = isPix ? _SVG_PIX_VOL : _SVG_VOL;
        const svgMuted = isPix ? _SVG_PIX_MUTED : _SVG_MUTED;
        if (type === 'music') {
            const _syncMuteButtons = (muted) => {
                const ico = muted ? svgMuted : svgVol;
                const mb = document.getElementById('music-mute-btn');
                if (mb) mb.innerHTML = ico;
                const mw = document.getElementById('mw-mute');
                if (mw) mw.innerHTML = ico.replace('width="14"','width="14"').replace('height="14"','height="14"');
                const plMw = document.getElementById('pl-mw-mute');
                if (plMw) plMw.innerHTML = (muted ? _SVG_MUTED : _SVG_VOL).replace('width="14"','width="11"').replace('height="14"','height="11"');
            };
            if (!_musicMuted) {
                _musicMuted = true;
                if (masterGain) masterGain.gain.value = 0;
                _syncMuteButtons(true);
                settings.musicMuted = true; saveSettings();
                // mute_jarvis tracking (5s min gap)
                { const _now = Date.now(); if (_now - _lastMuteTime >= 5000) { saveData.stats.muteCount = (saveData.stats.muteCount || 0) + 1; _lastMuteTime = _now; if ((saveData.stats.muteCount || 0) >= 10 && !saveData.achievements?.['mute_jarvis']?.unlocked) { unlockAchievement('mute_jarvis'); } saveDataToFile(); } }
            } else {
                _musicMuted = false;
                if (masterGain) masterGain.gain.value = settings.musicVol / 100 * 0.2;
                _syncMuteButtons(false);
                settings.musicMuted = false; saveSettings();
            }
        } else {
            if (!_sfxMuted) {
                _sfxMuted = true;
                if (sfxGain) sfxGain.gain.value = 0;
                settings.sfxMuted = true; saveSettings();
                const sb = document.getElementById('sfx-mute-btn');
                if (sb) sb.innerHTML = svgMuted;
            } else {
                _sfxMuted = false;
                if (sfxGain) sfxGain.gain.value = settings.sfxVol / 100 * 0.4;
                settings.sfxMuted = false; saveSettings();
                const sb = document.getElementById('sfx-mute-btn');
                if (sb) sb.innerHTML = svgVol;
            }
        }
        _updateMusicWidget();
    }
    function _makeTrackRow(label, isActive, isOwned, partCount, onEnableJs, onUnlockJs, extraHtml, itemKey) {
        const svgCheck = `<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 6 12 13 4"/></svg>`;
        let rightSide;
        if (isOwned && isActive) {
            rightSide = `<span style="display:flex;align-items:center;gap:4px;font-size:0.68rem;font-weight:bold;color:#22cc55;flex-shrink:0;">${svgCheck} Equipped</span>`;
        } else if (isOwned) {
            rightSide = `<button onclick="event.stopPropagation();${onEnableJs}" style="font-size:0.65rem;padding:6px 16px;border-radius:8px;border:1px solid #444;background:rgba(255,255,255,0.05);color:#aaa;cursor:pointer;font-family:inherit;flex-shrink:0;">Enable</button>`;
        } else {
            const _cost = _getItemCost(itemKey);
            if (partCount >= _cost) {
            rightSide = `<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                <div style="font-size:0.6rem;color:#ffd700;font-weight:bold;">${_cost}/${_cost} parts</div>
                <button onclick="${onUnlockJs}" style="font-size:0.65rem;padding:4px 12px;border-radius:8px;border:1px solid #ffd700;background:rgba(255,215,0,0.12);color:#ffd700;cursor:pointer;font-family:inherit;font-weight:bold;box-shadow:0 0 8px rgba(255,215,0,0.45);animation:pulse-glow-gold 1.8s ease-in-out infinite;">Unlock</button>
            </div>`;
            } else {
            rightSide = `<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                <progress class="lb-progress lb-progress--pattern" aria-label="${label} parts" max="${_cost}" value="${partCount}"></progress>
                <span style="font-size:0.6rem;color:#555;min-width:36px;text-align:right;font-family:inherit;">${partCount}/${_cost} parts</span>
            </div>`;
            }
        }
        const _glowReady = !isOwned && itemKey && partCount >= _getItemCost(itemKey);
        const _rowClickable = isOwned && !isActive && onEnableJs;
        const _rowCursor = _rowClickable ? 'cursor:pointer;' : '';
        const _rowClick = _rowClickable ? ` onclick="${onEnableJs}"` : '';
        const _labelCursor = isOwned && onEnableJs ? 'cursor:pointer;' : '';
        return `<div ${itemKey ? `data-item-key="${itemKey}"` : ''} data-owned="${isOwned}" data-equipped="${isActive}" class="inv-row${_glowReady ? ' glow-notify' : ''}" style="display:flex;align-items:center;padding:7px 4px;gap:8px;border-radius:6px;${_rowCursor}"${_rowClick}>
            <div style="flex:1;text-align:left;${_labelCursor}">
                <div style="font-size:0.8rem;color:${isOwned?'#fff':'#666'};">${label}</div>
                <div class="lb-item-state">${isActive ? 'Equipped' : isOwned ? 'Owned' : 'Locked · Collect parts to unlock'}</div>
                ${extraHtml ? `<div style="font-size:0.62rem;color:#666;margin-top:2px;">${extraHtml}</div>` : ''}
            </div>
            <div style="min-width:130px;display:flex;align-items:center;justify-content:flex-end;">${rightSide}</div>
        </div>`;
    }

    function _populateVisualCustomize() {
        function _positionTip(tip, e) {
            const mx = e.clientX, my = e.clientY;
            const tw = tip.offsetWidth || 120, th = tip.offsetHeight || 80;
            let lx = mx + 16, ly = my - 10;
            if (lx + tw > window.innerWidth - 8) lx = mx - tw - 16;
            if (ly + th > window.innerHeight - 8) ly = window.innerHeight - th - 8;
            if (ly < 8) ly = 8;
            tip.style.left = lx + 'px'; tip.style.top = ly + 'px';
        }
        const _ccEl = document.getElementById('setting-classic-colors'); if (_ccEl) _ccEl.checked = settings.classicColors;
        // Color palette dropdown sync
        const _palSelInv = document.getElementById('setting-color-palette');
        if (_palSelInv) {
            const _ownedPalsInv = saveData.ownedPalettes || ['classic'];
            _palSelInv.innerHTML = Object.keys(BLOCK_PALETTES).filter(k => BLOCK_PALETTES[k].free || _ownedPalsInv.includes(k)).map(k => `<option value="${k}"${settings.colorPalette === k ? ' selected' : ''}>${BLOCK_PALETTES[k].name}</option>`).join('');
        }
        const _rpcCheckInv = document.getElementById('setting-random-piece-colors');
        if (_rpcCheckInv) _rpcCheckInv.checked = settings.randomPieceColors || false;

        if (settings.stylePack === 'pixel') { settings.stylePack = 'modern'; saveSettings(); applyStylePack('modern'); }

        // Ghost section (in Blocks tab) — fully hidden until Silver I
        const ghostWrap = document.getElementById('ghost-section-wrap');
        if (ghostWrap) {
            const _ghostLevel = getLevelInfo(saveData.totalXP).level;
            if (_ghostLevel < 11) {
                ghostWrap.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);opacity:0.5;margin:8px 0;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span style="font-size:0.72rem;color:#555;">Locked</span>
                    <span style="font-size:0.55rem;color:#444;margin-left:auto;">Unlocks at Silver I</span>
                </div>`;
            } else {
                const gc = settings.ghostColor || 'white';
                const parts = saveData.parts?.['ghostColor'] || 0;
                const whiteRow = _makeTrackRow('White Ghost', gc === 'white', true, 10, "window.onSettingChange('ghostColor','white')", '', '');
                const coloredOwned = saveData.ghostColorUnlocked;
                const coloredRow = _makeTrackRow('Colored Ghost', gc === 'colored', coloredOwned, parts, "window.onSettingChange('ghostColor','colored')", "window.playerUnlockItem('ghostColor','ghostColor')", 'ghost matches piece color', 'ghostColor');
                ghostWrap.innerHTML = `<div style="font-size:0.68rem;color:#888;letter-spacing:1px;font-weight:600;margin:10px 0 4px;">GHOST PIECE</div><div>${whiteRow}${coloredRow}</div>`;
            }
        }

        // Owned skins (in Blocks tab)
        const ownedSkinContainer = document.getElementById('owned-skin-btns');
        if (ownedSkinContainer) {
            const skinNames = SKIN_NAMES;
            const ownedSkins = (saveData.ownedSkins || ['neon']).filter(_skinAvailable).filter(s => !['matrix','gold','golddragon','lava','circuit','marble','fire','toxic'].includes(s));
            const allSkinKeys = Object.keys(skinNames).filter(_skinAvailable);
            const skinCountEl = document.getElementById('skin-owned-count');
            if (skinCountEl) skinCountEl.innerText = `(${ownedSkins.length}/${allSkinKeys.length})`;
            const rows = allSkinKeys.map(s => {
                const isOwned = ownedSkins.includes(s);
                const isActive = settings.skin === s;
                const parts = saveData.parts?.[s] || 0;
                return _makeTrackRow(
                    skinNames[s],
                    isActive, isOwned, parts,
                    `window.applyBlockSkin('${s}')`,
                    `window.playerUnlockItem('skin','${s}')`,
                    '', s
                );
            }).join('');
            ownedSkinContainer.innerHTML = rows;
            // Persistent previews use the same renderer as the game, including locked skins.
            ownedSkinContainer.querySelectorAll('[data-item-key]').forEach(row => {
                const canvas = document.createElement('canvas');
                canvas.className = 'lb-inventory-preview';
                canvas.width = 96; canvas.height = 64;
                canvas.setAttribute('role', 'img');
                canvas.setAttribute('aria-label', `${skinNames[row.dataset.itemKey]} block preview`);
                const ctx = canvas.getContext('2d');
                const previousSkin = settings.skin;
                try {
                    settings.skin = row.dataset.itemKey;
                    BASE_PIECES[6].forEach((cells, y) => cells.forEach((cell, x) => {
                        if (cell) drawGameBlock(ctx, x, y, 6, 30);
                    }));
                } finally { settings.skin = previousSkin; }
                row.prepend(canvas);
            });
            // Hover preview for owned skins
            let skinTip = document.getElementById('skin-preview-tip');
            if (!skinTip) {
                skinTip = document.createElement('div');
                skinTip.id = 'skin-preview-tip';
                skinTip.style.cssText = 'position:fixed;z-index:9999;background:#111;border:1px solid #444;border-radius:8px;padding:6px;display:none;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.7);';
                document.body.appendChild(skinTip);
            }
            ownedSkinContainer.querySelectorAll('[data-item-key]').forEach(btn => {
                let _skinBuilt = false;
                btn.addEventListener('mouseenter', (e) => {
                    const skinName = btn.dataset.itemKey;
                    const piece = BASE_PIECES[6];
                    const bs = 22;
                    const cols = piece[0].length, rows2 = piece.length;
                    const pc = document.createElement('canvas');
                    pc.width = cols * bs; pc.height = rows2 * bs;
                    const pCtx = pc.getContext('2d');
                    pCtx.fillStyle = '#111'; pCtx.fillRect(0, 0, pc.width, pc.height);
                    const colorId = Math.floor(Math.random() * 7) + 1;
                    const oldSkin = settings.skin;
                    settings.skin = skinName;
                    piece.forEach((row2, y) => row2.forEach((v, x) => { if (v) drawGameBlock(pCtx, x, y, colorId, bs); }));
                    settings.skin = oldSkin;
                    skinTip.innerHTML = '';
                    skinTip.appendChild(pc);
                    skinTip.style.display = 'block';
                    _skinBuilt = true;
                    _positionTip(skinTip, e);
                });
                btn.addEventListener('mousemove', (e) => { if (_skinBuilt) _positionTip(skinTip, e); });
                btn.addEventListener('mouseleave', () => { skinTip.style.display = 'none'; _skinBuilt = false; });
            });
        }

        // Themes (in Colors tab)
        const ownedThemeContainer = document.getElementById('owned-theme-btns');
        if (ownedThemeContainer) {
            const themeNames = { default:'Default', ocean:'Ocean', forest:'Forest', fire:'Fire', dragon:'Golden', void:'Void', sunset:'Sunset', arctic:'Arctic', midnight:'Midnight', sakura:'Sakura' };
            const ownedThemes = ['default', ...(saveData.ownedThemes||[])];
            const themeCountEl = document.getElementById('theme-owned-count');
            if (themeCountEl) themeCountEl.innerText = `(${ownedThemes.length}/${Object.keys(themeNames).length})`;
            const rows = Object.keys(themeNames).map(t => {
                const isOwned = ownedThemes.includes(t);
                const isActive = settings.theme === t;
                const parts = saveData.parts?.[t] || 0;
                return _makeTrackRow(
                    themeNames[t], isActive, isOwned, parts,
                    `window.applyTheme('${t}')`,
                    `window.playerUnlockItem('theme','${t}')`,
                    '', t
                );
            }).join('');
            // Custom color picker — unlocks when all themes owned
            const allThemeKeys = Object.keys(themeNames);
            const allThemesOwned = allThemeKeys.every(t => ownedThemes.includes(t));
            let customThemeRow = '';
            if (allThemesOwned) {
                const isCustomTheme = settings.theme === 'custom';
                const curColor = saveData.customThemeColor || '#ff00ff';
                customThemeRow = `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;margin-top:6px;background:${isCustomTheme ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'};border:1px solid ${isCustomTheme ? curColor+'55' : 'rgba(255,255,255,0.06)'};cursor:pointer;transition:border-color 0.2s;" onclick="window._openColorPickerModal()">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:20px;height:20px;border-radius:50%;background:${curColor};box-shadow:0 0 8px ${curColor}66;border:1px solid rgba(255,255,255,0.15);flex-shrink:0;"></div>
                        <div>
                            <div style="font-size:0.72rem;color:${isCustomTheme ? '#fff' : '#aaa'};font-weight:${isCustomTheme ? 'bold' : 'normal'};">Custom Color</div>
                            <div style="font-size:0.55rem;color:#555;margin-top:1px;">Pick any theme color</div>
                        </div>
                    </div>
                    ${isCustomTheme ? `<span style="display:flex;align-items:center;gap:4px;font-size:0.68rem;font-weight:bold;color:#22cc55;flex-shrink:0;"><svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 6 12 13 4"/></svg> Enabled</span>` : `<span style="font-size:0.6rem;color:#555;font-family:'Orbitron',sans-serif;">Pick…</span>`}
                </div>`;
            } else {
                customThemeRow = `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;margin-top:6px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);opacity:0.5;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span style="font-size:0.72rem;color:#555;">Locked</span>
                    <span style="margin-left:auto;font-size:0.55rem;color:#444;">Own all themes to unlock</span>
                </div>`;
            }
            ownedThemeContainer.innerHTML = rows + customThemeRow;
            // Hover preview for themes (color swatch)
            const _THEME_COLORS = { default:'#00ffff', ocean:'#0099ff', forest:'#00dd55', fire:'#ff3300', dragon:'#ffcc00', void:'#cc44ff', sunset:'#ff7722', arctic:'#88ddff', midnight:'#aa77ff', sakura:'#ff88cc' };
            let themeTip = document.getElementById('theme-preview-tip');
            if (!themeTip) {
                themeTip = document.createElement('div');
                themeTip.id = 'theme-preview-tip';
                themeTip.style.cssText = 'position:fixed;z-index:9999;background:#0d0d1a;border:1px solid #333;border-radius:10px;padding:10px 14px;display:none;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.8);min-width:110px;';
                document.body.appendChild(themeTip);
            }
            ownedThemeContainer.querySelectorAll('[data-item-key]').forEach(row => {
                row.addEventListener('mouseenter', (e) => {
                    const key = row.dataset.itemKey;
                    const col = _THEME_COLORS[key] || '#fff';
                    const name = themeNames[key] || key;
                    themeTip.innerHTML = `<div style="font-size:0.5rem;color:#666;letter-spacing:1.5px;margin-bottom:6px;text-transform:uppercase;">${name}</div><div style="display:flex;gap:8px;align-items:center;"><div style="width:28px;height:28px;border-radius:50%;background:${col};box-shadow:0 0 10px ${col}88;flex-shrink:0;"></div><span style="font-size:0.7rem;font-weight:bold;color:${col};text-shadow:0 0 8px ${col}66;">${col}</span></div><div style="margin-top:8px;font-size:0.65rem;font-weight:bold;color:${col};letter-spacing:2px;text-shadow:0 0 6px ${col}66;">${name.toUpperCase()}</div>`;
                    themeTip.style.display = 'block';
                    _positionTip(themeTip, e);
                });
                row.addEventListener('mousemove', (e) => { if (themeTip.style.display !== 'none') _positionTip(themeTip, e); });
                row.addEventListener('mouseleave', () => { themeTip.style.display = 'none'; });
            });
            // Theme row click -> copy hex color (override enable behavior); buttons still work
            ownedThemeContainer.querySelectorAll('[data-item-key]').forEach(row => {
                const key = row.dataset.itemKey;
                const col = _THEME_COLORS[key];
                if (!col) return;
                const sample = document.createElement('div');
                sample.className = 'lb-theme-sample';
                sample.style.setProperty('--sample', col);
                sample.textContent = col;
                row.prepend(sample);
                row.onclick = (e) => {
                    if (e.target.closest('button')) return; // let Enable/Unlock button clicks through
                    navigator.clipboard?.writeText(col).catch(() => {});
                    _showCopyFeedback(e.clientX, e.clientY);
                };
                row.style.cursor = 'pointer';
            });
        }

        // Color palettes (in Colors/Themes tab)
        const ownedPaletteContainer = document.getElementById('owned-palette-btns');
        if (ownedPaletteContainer) {
            const ownedPals = saveData.ownedPalettes || ['classic'];
            const _activePal = settings.colorPalette || 'classic';
            const _allPalsOwned = typeof _allPalettesOwned === 'function' ? _allPalettesOwned() : false;
            const palCountEl = document.getElementById('palette-owned-count');
            if (palCountEl) palCountEl.innerText = `(${ownedPals.length}/${Object.keys(BLOCK_PALETTES).length})`;
            const palRows = Object.entries(BLOCK_PALETTES).map(([k, p]) => {
                const isOwned = p.free || ownedPals.includes(k);
                const isActive = _activePal === k;
                const parts = saveData.parts?.[k] || 0;
                const displayColors = (saveData.customPaletteOverrides?.[k]) ? saveData.customPaletteOverrides[k] : p.colors;
                const swatches = displayColors.slice(0,7).map(c => `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${c};"></span>`).join('');
                let extra = `<div class="lb-palette-preview" aria-label="${p.name} block colors">${displayColors.slice(0,7).map(c => `<span style="--piece-color:${c}"></span>`).join('')}</div><div style="display:flex;gap:2px;margin-top:2px;">${swatches}</div>`;
                // Palette name click opens color view popup (handled via data attribute below)
                const enableJs = `window.onSettingChange('colorPalette','${k}')`;
                return _makeTrackRow(p.name, isActive, isOwned, parts,
                    enableJs,
                    `window.playerUnlockItem('palette','${k}')`,
                    extra, k);
            }).join('');
            // Custom Picker row at the end (styled like Custom Color theme row)
            let customPickerHtml = '';
            if (_allPalsOwned) {
                const customColors = saveData.customPickerColors || BLOCK_PALETTES.classic.colors.slice(0, 7);
                const isCustomActive = settings.colorPalette === '_custom_picker';
                const gradientColors = customColors.slice(0, 7).join(', ');
                customPickerHtml = `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;margin-top:6px;background:${isCustomActive ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'};border:1px solid ${isCustomActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'};cursor:pointer;transition:border-color 0.2s;" onclick="window._openCustomPaletteModal()">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:20px;height:20px;border-radius:50%;background:conic-gradient(${gradientColors});box-shadow:0 0 8px rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.15);flex-shrink:0;"></div>
                        <div>
                            <div style="font-size:0.72rem;color:${isCustomActive ? '#fff' : '#aaa'};font-weight:${isCustomActive ? 'bold' : 'normal'};">Custom Palette</div>
                            <div style="font-size:0.55rem;color:#555;margin-top:1px;">Pick any block colors</div>
                        </div>
                    </div>
                    ${isCustomActive ? `<span style="display:flex;align-items:center;gap:4px;font-size:0.68rem;font-weight:bold;color:#22cc55;flex-shrink:0;"><svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 6 12 13 4"/></svg> Enabled</span>` : `<span style="font-size:0.6rem;color:#555;font-family:'Orbitron',sans-serif;">Pick\u2026</span>`}
                </div>`;
            } else {
                customPickerHtml = `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;margin-top:6px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);opacity:0.5;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span style="font-size:0.72rem;color:#555;">Custom Palette</span>
                    <span style="margin-left:auto;font-size:0.55rem;color:#444;">Own all palettes to unlock</span>
                </div>`;
            }
            const _shuffleHtml = `<div class="inv-row" style="display:flex;align-items:center;padding:7px 4px;gap:8px;border-radius:6px;">
                <div style="flex:1;text-align:left;"><div style="font-size:0.8rem;color:#fff;">Shuffle Colors</div><div style="font-size:0.62rem;color:#666;margin-top:2px;">Colors not fixed to piece types</div></div>
                <label class="toggle" style="flex-shrink:0;"><input type="checkbox" ${settings.randomPieceColors ? 'checked' : ''} onchange="window.onSettingChange('randomPieceColors',this.checked)"><span class="toggle-slider"></span></label>
            </div>`;
            const _allPalOwned = Object.keys(BLOCK_PALETTES).every(k => BLOCK_PALETTES[k].free || ownedPals.includes(k));
            let _randomHtml;
            if (_allPalOwned) {
                const _randomActive = !!settings.randomBlockColors;
                _randomHtml = _makeTrackRow('Random Colors', _randomActive, true, 10,
                    "window.onSettingChange('randomBlockColors',true);window.onSettingChange('colorPalette','_random')",
                    '', 'Every block is a different random color', '_randomColors');
            } else {
                _randomHtml = `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-top:6px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:8px;opacity:0.5;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span style="font-size:0.72rem;color:#555;">Locked</span>
                    <span style="font-size:0.55rem;color:#444;margin-left:auto;">Own all palettes to unlock</span>
                </div>`;
            }
            ownedPaletteContainer.innerHTML = _shuffleHtml + palRows + _randomHtml + customPickerHtml;
            // Palette row click -> open palette view modal (override enable behavior); buttons still work
            ownedPaletteContainer.querySelectorAll('[data-item-key]').forEach(row => {
                const key = row.dataset.itemKey;
                if (!BLOCK_PALETTES[key]) return;
                row.onclick = (e) => {
                    if (e.target.closest('button')) return; // let Enable/Unlock button clicks through
                    if (key === '_custom_picker') { window._openCustomPaletteModal(); }
                    else { window._openPaletteViewModal(key); }
                };
                row.style.cursor = 'pointer';
            });
        }

        // Button styles (in Blocks tab)
        const ownedBtnStyleContainer = document.getElementById('owned-btn-style-btns');
        if (ownedBtnStyleContainer) {
            const owned = saveData.ownedBtnStyles || [];
            const rows = Object.entries(BTN_STYLES)
                .map(([k, bs]) => {
                    const isOwned = bs.free || owned.includes(k);
                    const parts = saveData.parts?.[k] || 0;
                    return _makeTrackRow(bs.name, settings.btnStyle === k, isOwned, parts,
                        `window.applyBtnStyle('${k}')`,
                        isOwned ? '' : `window.playerUnlockItem('btnStyle','${k}')`,
                        '', k);
                }).join('');
            ownedBtnStyleContainer.innerHTML = rows;
        }

        // Grid styles (in Blocks tab)
        const ownedGridContainer = document.getElementById('owned-grid-style-btns');
        if (ownedGridContainer) {
            const ownedGridStyles = saveData.ownedGridStyles || [];
            const gridStyleRows = Object.entries(GRID_STYLES).map(([k, gs]) => {
                const isOwned = gs.free || ownedGridStyles.includes(k);
                const _curGrid = settings.gridStyle || 'lines';
                const isActive = (GRID_STYLES[_curGrid] ? _curGrid : 'lines') === k;
                const parts = saveData.parts?.[k] || 0;
                return _makeTrackRow(gs.name, isActive, isOwned, parts,
                    `window.applyGridStyle('${k}')`,
                    `window.playerUnlockItem('gridStyle','${k}')`,
                    '', k
                );
            }).join('');
            ownedGridContainer.innerHTML = gridStyleRows;
            // Hover preview for grid styles
            let gridTip = document.getElementById('grid-preview-tip');
            if (!gridTip) {
                gridTip = document.createElement('div');
                gridTip.id = 'grid-preview-tip';
                gridTip.style.cssText = 'position:fixed;z-index:9999;background:#111;border:1px solid #333;border-radius:8px;padding:6px;display:none;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.8);';
                document.body.appendChild(gridTip);
            }
            function _drawGridPreview(style) {
                const GC = 5, GR = 7, BS = 16;
                const gc = document.createElement('canvas');
                gc.width = GC * BS; gc.height = GR * BS;
                const gx = gc.getContext('2d');
                gx.fillStyle = '#0a0a18'; gx.fillRect(0, 0, gc.width, gc.height);
                const alpha = 0.55;
                if (style === 'dots') {
                    gx.fillStyle = `rgba(190,220,255,${alpha})`;
                    for (let xi = 0; xi <= GC; xi++) for (let yi = 0; yi <= GR; yi++) { gx.beginPath(); gx.arc(xi*BS, yi*BS, 1.2, 0, Math.PI*2); gx.fill(); }
                } else if (style === 'boxes') {
                    gx.strokeStyle = `rgba(190,220,255,${alpha})`; gx.lineWidth = 1;
                    const pad = 2, r = 2;
                    for (let yi = 0; yi < GR; yi++) for (let xi = 0; xi < GC; xi++) {
                        const bx = xi*BS+pad, by = yi*BS+pad, bw = BS-pad*2, bh = BS-pad*2;
                        gx.beginPath(); gx.moveTo(bx+r,by); gx.lineTo(bx+bw-r,by); gx.arcTo(bx+bw,by,bx+bw,by+r,r); gx.lineTo(bx+bw,by+bh-r); gx.arcTo(bx+bw,by+bh,bx+bw-r,by+bh,r); gx.lineTo(bx+r,by+bh); gx.arcTo(bx,by+bh,bx,by+bh-r,r); gx.lineTo(bx,by+r); gx.arcTo(bx,by,bx+r,by,r); gx.closePath(); gx.stroke();
                    }
                } else if (style === 'dotboxes') {
                    gx.strokeStyle = `rgba(190,220,255,${alpha})`; gx.lineWidth = 1;
                    const pad = 2, r = 2;
                    for (let yi = 0; yi < GR; yi++) for (let xi = 0; xi < GC; xi++) {
                        const bx = xi*BS+pad, by = yi*BS+pad, bw = BS-pad*2, bh = BS-pad*2;
                        gx.beginPath(); gx.moveTo(bx+r,by); gx.lineTo(bx+bw-r,by); gx.arcTo(bx+bw,by,bx+bw,by+r,r); gx.lineTo(bx+bw,by+bh-r); gx.arcTo(bx+bw,by+bh,bx+bw-r,by+bh,r); gx.lineTo(bx+r,by+bh); gx.arcTo(bx,by+bh,bx,by+bh-r,r); gx.lineTo(bx,by+r); gx.arcTo(bx,by,bx+r,by,r); gx.closePath(); gx.stroke();
                    }
                    gx.fillStyle = `rgba(190,220,255,${alpha})`;
                    for (let xi = 0; xi <= GC; xi++) for (let yi = 0; yi <= GR; yi++) { gx.beginPath(); gx.arc(xi*BS, yi*BS, 1.4, 0, Math.PI*2); gx.fill(); }
                } else {
                    gx.strokeStyle = `rgba(190,220,255,${alpha})`; gx.lineWidth = 1;
                    gx.beginPath(); for (let x=1;x<GC;x++){const px=x*BS+.5;gx.moveTo(px,0);gx.lineTo(px,gc.height);} gx.stroke();
                    gx.beginPath(); for (let y=1;y<GR;y++){const py=y*BS+.5;gx.moveTo(0,py);gx.lineTo(gc.width,py);} gx.stroke();
                }
                return gc;
            }
            ownedGridContainer.querySelectorAll('[data-item-key]').forEach(row => {
                row.addEventListener('mouseenter', (e) => {
                    const key = row.dataset.itemKey;
                    const gc = _drawGridPreview(key);
                    gridTip.innerHTML = '';
                    gridTip.appendChild(gc);
                    gridTip.style.display = 'block';
                    _positionTip(gridTip, e);
                });
                row.addEventListener('mousemove', (e) => { if (gridTip.style.display !== 'none') _positionTip(gridTip, e); });
                row.addEventListener('mouseleave', () => { gridTip.style.display = 'none'; });
            });
        }

        // Background toggle
        const heavyBgCb = document.getElementById('setting-heavy-bg');
        if (heavyBgCb) heavyBgCb.checked = !!(settings.heavyBg);

        // Fonts: tied to style packs, not separately unlockable
    }
    const BOOSTER_KEYS = ['1.25x_game', '1.5x_game', '2xp_game'];
    const BOOSTER_META = {
        '1.25x_game': { label: '1.25× Booster', color: '#aaaaaa', tier: 0, rarity: 'common'   },
        '1.5x_game':  { label: '1.5× Booster',  color: '#4499ff', tier: 1, rarity: 'rare'      },
        '2xp_game':   { label: '2× Booster',     color: '#cc44ff', tier: 2, rarity: 'epic'      }
    };
    function _openExchangeModal(fromKey, toKey, type) {
        const meta   = BOOSTER_META[fromKey];
        const metaTo = BOOSTER_META[toKey];
        const count  = saveData.boosters?.[fromKey] || 0;
        const maxSets = Math.floor(count / 3);
        if (maxSets < 1) { customAlert(`Need at least 3× ${meta.label} to exchange.`, 'Not enough'); return; }
        document.getElementById('exc-modal-overlay')?.remove();
        const color = meta.color;
        const overlay = document.createElement('div');
        overlay.id = 'exc-modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:1200;display:flex;align-items:center;justify-content:center;font-family:inherit;';
        overlay.innerHTML = `
            <div style="background:rgba(8,8,18,0.98);border:1px solid ${color};border-radius:14px;padding:22px 20px;max-width:300px;width:90%;text-align:center;box-shadow:0 0 30px ${color}30;">
                <div style="font-size:0.85rem;font-weight:bold;color:${color};letter-spacing:2px;margin-bottom:8px;">EXCHANGE</div>
                <div style="font-size:0.7rem;color:#888;margin-bottom:4px;">3× <span style="color:${color};">${meta.label}</span> → 1× <span style="color:${metaTo.color};">${metaTo.label}</span></div>
                <div style="font-size:0.6rem;color:#555;margin-bottom:16px;">You have <span style="color:#fff;font-weight:bold;">${count}</span> × ${meta.label}</div>
                <div style="margin-bottom:18px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.62rem;color:#666;margin-bottom:8px;">
                        <span>Sets:</span>
                        <span id="exc-label" style="color:${color};font-weight:bold;">1&nbsp;(3 → 1)</span>
                    </div>
                    <input type="range" id="exc-slider" min="1" max="${maxSets}" value="1" step="1"
                        style="width:100%;accent-color:${color};cursor:pointer;"
                        oninput="const v=parseInt(this.value);document.getElementById('exc-label').innerHTML=v+'&nbsp;('+(v*3)+' → '+v+')'">
                </div>
                <div style="display:flex;gap:10px;justify-content:center;">
                    <button onclick="window._closeModal('exc-modal-overlay')"
                        style="font-size:0.7rem;padding:7px 18px;background:rgba(255,255,255,0.05);border:1px solid #444;border-radius:8px;color:#888;cursor:pointer;font-family:inherit;">CANCEL</button>
                    <button onclick="window._doExchange('${fromKey}','${toKey}','${type}')"
                        style="font-size:0.7rem;padding:7px 18px;background:linear-gradient(135deg,${color}33,${color}18);border:1px solid ${color};border-radius:8px;color:${color};cursor:pointer;font-family:inherit;font-weight:bold;box-shadow:0 0 8px ${color}30;">EXCHANGE</button>
                </div>
            </div>`;
        overlay.addEventListener('click', e => { if (e.target === overlay) window._closeModal('exc-modal-overlay'); });
        document.body.appendChild(overlay);
        _animateIn(overlay.querySelector('div'), 'anim-in-down');
    }
    function exchangeBoosters(from, to) { _openExchangeModal(from, to, 'booster'); }
    function _populateInventoryOther() {
        const container = document.getElementById('inventory-other-content');
        if (!container) return;
        const boosters = saveData.boosters || {};
        const rowStyle = 'display:flex;align-items:center;padding:8px 4px;gap:8px;';
        const secTitle = 'font-size:0.6rem;color:var(--primary);letter-spacing:2px;font-weight:bold;margin:16px 0 8px;padding-bottom:5px;';

        const xchSvg = `<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>`;
        function _xchBtn(color, fromKey, toKey, type, enabled) {
            if (enabled) return `<button onclick="window._openExchangeModal('${fromKey}','${toKey}','${type}')" style="font-size:0.6rem;padding:5px 10px;border-radius:8px;font-family:inherit;white-space:nowrap;cursor:pointer;background:linear-gradient(135deg,${color}22,${color}11);border:1px solid ${color};color:${color};font-weight:600;box-shadow:0 0 6px ${color}28;display:inline-flex;align-items:center;gap:4px;">${xchSvg}Exchange</button>`;
            return `<button disabled style="font-size:0.6rem;padding:5px 10px;border-radius:8px;font-family:inherit;white-space:nowrap;cursor:default;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.18);display:inline-flex;align-items:center;gap:4px;">${xchSvg}Exchange</button>`;
        }

        // Universal parts section
        const _uniVal = saveData.universalParts || 0;
        const _uniInt = Math.floor(_uniVal);
        const _uniDec = Math.round((_uniVal - _uniInt) * 10);
        const _uniDisplay = _uniDec > 0 ? `${_uniInt}<span style="font-size:0.6em;opacity:0.7;">.${_uniDec}</span>` : `${_uniInt}`;
        const uniRow = `<div style="display:flex;align-items:center;padding:10px 4px;gap:8px;margin-bottom:4px;">
            <span style="font-size:0.75rem;color:#ffd700;font-weight:600;flex:1;">⭐ Universal Parts</span>
            <span style="font-size:1rem;font-weight:bold;color:#ffd700;">${_uniDisplay}</span>
            ${(saveData.universalParts||0) >= 1 ? (_getAllPartsItems().length === 0 ? `<button onclick="window.openExchangeUniversalParts()" style="font-size:0.65rem;padding:4px 12px;border-radius:8px;border:1px solid #ffd700;background:rgba(255,215,0,0.1);color:#ffd700;cursor:pointer;font-family:inherit;font-weight:bold;">Exchange</button>` : `<button onclick="window.openUseUniversalPart()" style="font-size:0.65rem;padding:4px 12px;border-radius:8px;border:1px solid #ffd700;background:rgba(255,215,0,0.1);color:#ffd700;cursor:pointer;font-family:inherit;font-weight:bold;">Use</button>`) : ''}
        </div>`;

        // Boosters section
        let boosterHtml = BOOSTER_KEYS.map((key, i) => {
            const meta = BOOSTER_META[key];
            const count = boosters[key] || 0;
            const nextKey = BOOSTER_KEYS[i + 1];
            const canExchange = count >= 3;
            const xchBtnHtml = nextKey ? _xchBtn(meta.color, key, nextKey, 'booster', canExchange) : '';
            const rarityColor = (RARITY_ACH[meta.rarity] || RARITY_ACH.common).color;
            const labelParts = meta.label.split(' ');
            const multiplier = labelParts[0];
            const boosterText = labelParts.slice(1).join(' ');
            return `<div style="${rowStyle}display:grid;grid-template-columns:50px 65px 1fr 36px 100px;align-items:center;">
                <span style="font-size:0.75rem;color:${rarityColor};font-weight:600;">${multiplier}</span>
                <span style="font-size:0.75rem;color:${rarityColor};font-weight:600;">${boosterText}</span>
                <span style="font-size:0.55rem;color:${rarityColor};opacity:0.7;text-transform:uppercase;letter-spacing:1px;text-align:center;">${meta.rarity}</span>
                <span style="font-size:0.85rem;font-weight:700;color:#fff;text-align:center;">${count}</span>
                <div style="display:flex;gap:5px;justify-content:flex-end;">${xchBtnHtml}</div>
            </div>`;
        }).join('');

        // SFX Packs section
        const _sfxPackDefs = [
            { key: 'sfxRetro', label: 'Retro SFX', packId: 'retro' },
            { key: 'sfxArcade', label: 'Arcade SFX', packId: 'arcade' },
            { key: 'sfxCyber', label: 'Cyber SFX', packId: 'cyber' },
            { key: 'sfxZen', label: 'Zen SFX', packId: 'zen' },
        ];
        const _ownedSfx = saveData.ownedSfxPacks || ['default'];
        const _activeSfxPack = settings.sfxPack || 'default';
        let sfxPacksHtml = `<div style="${secTitle}">SFX PACKS</div>`;
        // Default pack row (always owned)
        sfxPacksHtml += _makeTrackRow('Default SFX', _activeSfxPack === 'default', true, 0, "window.onSettingChange('sfxPack','default')", '', 'the original sound effects');
        _sfxPackDefs.forEach(p => {
            const owned = _ownedSfx.includes(p.packId);
            const active = _activeSfxPack === p.packId;
            const parts = saveData.parts?.[p.key] || 0;
            sfxPacksHtml += _makeTrackRow(p.label, active, owned, parts,
                `window.onSettingChange('sfxPack','${p.packId}')`,
                `window.playerUnlockItem('sfxPack','${p.key}')`,
                '', p.key);
        });

        container.innerHTML = `
            ${uniRow}
            <div style="${secTitle}">BOOSTERS</div>
            ${boosterHtml}
            ${sfxPacksHtml}`;

        // SFX pack rows — click to open preview (not on buttons)
        const _sfxPlayFns = { default: playSFX, cyber: _playSFX_B, retro: _playSFX_C, zen: _playSFX_D, arcade: _playSFX_E };
        const _sfxPackNames = { default: 'Default', cyber: 'Cyber', retro: 'Retro', zen: 'Zen', arcade: 'Arcade' };
        container.querySelectorAll('.inv-row').forEach(row => {
            const key = row.dataset?.itemKey;
            const packMap = { sfxCyber:'cyber', sfxRetro:'retro', sfxZen:'zen', sfxArcade:'arcade' };
            let packId = packMap[key];
            // Check if it's the default row (no data-item-key but contains "Default SFX")
            if (!packId && row.textContent.includes('Default SFX')) packId = 'default';
            if (!packId) return;
            const owned = (saveData.ownedSfxPacks || ['default']).includes(packId);
            row.style.cursor = 'pointer';
            const origClick = row.onclick;
            row.onclick = (e) => {
                if (e.target.closest('button')) { if (origClick) origClick(e); return; }
                _openSfxPreviewPopup(packId);
            };
        });
    }

    function _openSfxPreviewPopup(packId) {
        document.getElementById('sfx-inv-preview')?.remove();
        const _sfxPlayFns = { default: playSFX, cyber: _playSFX_B, retro: _playSFX_C, zen: _playSFX_D, arcade: _playSFX_E };
        const _sfxPackNames = { default: 'Default', cyber: 'Cyber', retro: 'Retro', zen: 'Zen', arcade: 'Arcade' };
        const playFn = _sfxPlayFns[packId] || playSFX;
        const sfxList = [
            { name: 'clear', desc: 'Line clear' },
            { name: 'drop', desc: 'Block placed' },
            { name: 'levelup', desc: 'Speed up' },
            { name: 'click', desc: 'UI click' },
            { name: 'gameover', desc: 'Game over' },
            { name: 'unlock', desc: 'Item unlocked' },
            { name: 'gift', desc: 'Gift claimed' },
            { name: 'booster', desc: 'Booster used' },
            { name: 'achievement', desc: 'Achievement' },
            { name: 'rankup', desc: 'Level up' },
            { name: 'newrank', desc: 'New rank' },
        ];
        const ov = document.createElement('div');
        ov.id = 'sfx-inv-preview';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `<div style="background:#12121e;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:20px;width:min(340px,90vw);max-height:80vh;overflow-y:auto;position:relative;">
            <button onclick="window._closeModal('sfx-inv-preview')" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#555;font-size:1.1rem;cursor:pointer;">✕</button>
            <div style="font-size:0.6rem;letter-spacing:2px;color:var(--primary);margin-bottom:12px;">🔊 ${(_sfxPackNames[packId] || packId).toUpperCase()} SFX</div>
            ${sfxList.map(s => `<div class="sfx-prev-row" data-sfx="${s.name}" style="display:flex;align-items:center;gap:10px;padding:7px 6px;cursor:pointer;border-radius:6px;transition:background 0.15s;">
                <div style="width:28px;height:28px;border-radius:6px;background:rgba(0,255,255,0.06);border:1px solid rgba(0,255,255,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="var(--primary)"><polygon points="2,5 5,5 9,2 9,14 5,11 2,11"/><path d="M11 5.5a3 3 0 010 5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M13 3.5a5.5 5.5 0 010 9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
                </div>
                <div>
                    <div style="font-size:0.72rem;color:#fff;font-weight:bold;">${s.name}</div>
                    <div style="font-size:0.55rem;color:#666;">${s.desc}</div>
                </div>
            </div>`).join('')}
        </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) window._closeModal('sfx-inv-preview'); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-up');
        ov.querySelectorAll('.sfx-prev-row').forEach(row => {
            row.addEventListener('click', () => playFn(row.dataset.sfx));
        });
    }
    function _updateBtnSweep(el, active) {
        if (!el) return;
        let sweep = el.querySelector('.btn-sweep');
        if (active && !sweep) {
            sweep = document.createElement('span');
            sweep.className = 'btn-sweep';
            el.insertBefore(sweep, el.firstChild);
        } else if (!active && sweep) {
            sweep.remove();
        }
    }
    function _shakeNotifyBtn(el) {
        if (!el) return;
        el.classList.remove('btn-notify-shake');
        void el.offsetWidth;
        el.classList.add('btn-notify-shake');
        el.addEventListener('animationend', function _sh(e) {
            if (e.target !== el) return;
            el.classList.remove('btn-notify-shake');
            el.removeEventListener('animationend', _sh);
        });
    }
    function _checkGlowNotifications() {
        // Check if any parts item is ready to unlock (parts >= cost)
        const allItems = _getAllPartsItems();
        const readyItems = allItems.filter(item => (saveData.parts?.[item.key] || 0) >= _getItemCost(item.key));
        // Tab glow: blocks tab has skins, colors tab has themes, other tab has ghostColor/gridStyle/music
        const skinReady = readyItems.some(i => i.cat === 'skin');
        const themeReady = readyItems.some(i => i.cat === 'theme');
        const otherReady = readyItems.some(i => i.cat === 'ghostColor' || i.cat === 'gridStyle' || i.cat === 'btnStyle' || i.cat === 'music' || i.cat === 'sfxPack' || i.cat === 'palette');
        document.querySelectorAll('[data-invtab]').forEach(btn => {
            const tab = btn.dataset.invtab;
            const hasReady = (tab === 'blocks' && skinReady) || (tab === 'colors' && themeReady) || (tab === 'other' && otherReady);
            btn.classList.toggle('glow-notify', hasReady);
        });
        // Inventory button glow in main menu
        const invReady = readyItems.length > 0;
        const invBtn = document.querySelector('[onclick="window.openInventory()"]');
        if (invBtn) { const _wgi = invBtn.classList.contains('glow-notify'); invBtn.classList.toggle('glow-notify', invReady); _updateBtnSweep(invBtn, invReady); if (invReady && !_wgi) _shakeNotifyBtn(invBtn); }
        // Achievements button glow when there are pending XP claims
        const hasPendingClaims = (saveData.pendingAchievementClaims?.length || 0) > 0;
        const achBtn = document.querySelector('[onclick="window.openAchievements()"]');
        if (achBtn) { const _wga = achBtn.classList.contains('glow-notify'); achBtn.classList.toggle('glow-notify', hasPendingClaims); _updateBtnSweep(achBtn, hasPendingClaims); if (hasPendingClaims && !_wga) _shakeNotifyBtn(achBtn); }
        // Missions button glow when unclaimed milestones or quest XP available
        const _hasMissionReward = (() => {
            if (!saveData.missions) return false;
            try {
                const dp = saveData.missions.daily?.pointsToday || 0;
                const dClaimed = saveData.missions.daily?.claimedMilestones || [];
                const hasD = MQ_DAILY_MILESTONES.some(ms => dp >= ms.pts && !dClaimed.includes(ms.pts));
                const wp = saveData.missions.weekly?.points || 0;
                const wClaimed = saveData.missions.weekly?.claimedMilestones || [];
                const hasW = MQ_WEEKLY_MILESTONES.some(ms => wp >= ms.pts && !wClaimed.includes(ms.pts));
                const hasNewVisit = saveData.missions.daily?.newVisit || saveData.missions.weekly?.newVisit;
                const hasUnclaimedPts = (saveData.missions.daily?.quests?.some(q => q.completed && !q.ptsClaimed)) ||
                    (saveData.missions.daily?.secret?.completed && !saveData.missions.daily?.secret?.ptsClaimed) ||
                    (saveData.missions.weekly?.missions?.some(wm => wm.completed && !wm.ptsClaimed));
                const hasPendingUniParts = (saveData.missions.weekly?.pendingUniversalParts || 0) > 0;
                return hasD || hasW || hasNewVisit || hasUnclaimedPts || hasPendingUniParts;
            } catch(e) { return false; }
        })();
        const missionsBtn = document.querySelector('[onclick="window.openMissions()"]');
        if (missionsBtn) { const _wgm = missionsBtn.classList.contains('glow-notify'); missionsBtn.classList.toggle('glow-notify', _hasMissionReward); _updateBtnSweep(missionsBtn, _hasMissionReward); if (_hasMissionReward && !_wgm) _shakeNotifyBtn(missionsBtn); }
    }
    function openInventory() {
        inventoryTab('blocks');
        _populateVisualCustomize();
        _checkGlowNotifications();
        const _invEl = document.getElementById('inventory-overlay');
        _invEl.classList.remove('hidden');
        _animateIn(_invEl, 'anim-in-right');
    }
    function closeInventory() {
        const _mEl = document.getElementById('menu-overlay');
        _animateOut(document.getElementById('inventory-overlay'), 'anim-out-right');
        if (_mEl && !_mEl.classList.contains('hidden')) _animateIn(_mEl, 'anim-in-left');
    }

    // --- UI CONTROL HELPERS ---
    function _cPillSync(id, value) {
        const v = Math.max(0, Math.min(100, parseFloat(value)));
        const fill = document.getElementById(id + '-pill-fill');
        const knob = document.getElementById(id + '-pill-knob');
        if (fill) {
            fill.style.width = v + '%';
            // Shade: low volume = darker, high volume = full brightness
            const brightness = 0.3 + (v / 100) * 0.7;
            fill.style.opacity = brightness;
        }
        if (knob) {
            knob.style.left = v + '%';
        }
    }
    function _dStepsSync(trackId, fillId, inputEl, min, max) {
        if (!inputEl) return;
        const v = parseFloat(inputEl.value);
        const track = document.getElementById(trackId);
        if (!track) return;
        const dots = Array.from(track.querySelectorAll('.d-step-dot'));
        const lastOn = [...dots].reverse().find(d => parseFloat(d.dataset.v) <= v) || null;
        const onDots = dots.filter(d => d !== lastOn && parseFloat(d.dataset.v) <= v);
        dots.forEach(dot => {
            dot.classList.remove('on', 'cur');
            dot.style.opacity = '';
        });
        onDots.forEach((dot, i) => {
            dot.classList.add('on');
            const frac = onDots.length > 1 ? i / (onDots.length - 1) : 1;
            dot.style.opacity = (0.35 + frac * 0.55).toFixed(2);
        });
        if (lastOn) lastOn.classList.add('cur');
    }
    function _eStepChange(id, delta) {
        const inp = document.getElementById('slider-' + id);
        if (!inp) return;
        const v = Math.max(parseInt(inp.min), Math.min(parseInt(inp.max), parseInt(inp.value) + delta * parseInt(inp.step || '1')));
        inp.value = v;
        inp.dispatchEvent(new Event('input'));
        const valEl = document.getElementById(id + '-step-val');
        if (valEl) valEl.innerText = v;
        const fillEl = document.getElementById(id + '-step-fill');
        if (fillEl) fillEl.style.width = ((v - parseInt(inp.min)) / (parseInt(inp.max) - parseInt(inp.min)) * 100).toFixed(1) + '%';
    }
    function _setXpBarFill(pct) {
        const fill = document.getElementById('menu-xp-bar-fill');
        const notch = document.getElementById('menu-xp-bar-notch');
        if (!fill) return;
        fill.style.width = pct.toFixed(1) + '%';
        const nearEnd = pct >= 97;
        fill.style.borderRadius = nearEnd ? '4px' : '4px 0 0 4px';
        if (notch) {
            if (pct < 1 || nearEnd) { notch.style.display = 'none'; }
            else { notch.style.display = ''; notch.style.left = pct.toFixed(1) + '%'; }
        }
    }

    function openSettings() {
        controlsEditor.render();
        const mv = settings.musicVol, sv = settings.sfxVol;
        document.getElementById('setting-music-vol').value = mv;
        document.getElementById('setting-sfx-vol').value = sv;
        _cPillSync('music', mv); _cPillSync('sfx', sv);
        const mvEl0 = document.getElementById('setting-music-val'); if (mvEl0) mvEl0.innerText = mv + '%';
        const svEl0 = document.getElementById('setting-sfx-val'); if (svEl0) svEl0.innerText = sv + '%';
        const isPix = settings.stylePack === 'pixel';
        const musicMuteBtn = document.getElementById('music-mute-btn');
        if (musicMuteBtn) musicMuteBtn.innerHTML = _musicMuted ? (isPix ? _SVG_PIX_MUTED : _SVG_MUTED) : (isPix ? _SVG_PIX_VOL : _SVG_VOL);
        const sfxMuteBtn = document.getElementById('sfx-mute-btn');
        if (sfxMuteBtn) sfxMuteBtn.innerHTML = _sfxMuted ? (isPix ? _SVG_PIX_MUTED : _SVG_MUTED) : (isPix ? _SVG_PIX_VOL : _SVG_VOL);
        // SFX Pack dropdown sync
        const _sfxSel = document.getElementById('setting-sfx-pack');
        if (_sfxSel) {
            const _ownedPacks = saveData.ownedSfxPacks || ['default'];
            const _packLabels = { default: 'Default', cyber: 'Cyber', retro: 'Retro', zen: 'Zen', arcade: 'Arcade' };
            _sfxSel.innerHTML = _ownedPacks.map(p => `<option value="${p}"${settings.sfxPack === p ? ' selected' : ''}>${_packLabels[p] || p}</option>`).join('');
        }
        // Color Palette dropdown sync
        const _palSel = document.getElementById('setting-color-palette');
        if (_palSel) {
            const _ownedPals = saveData.ownedPalettes || ['classic'];
            _palSel.innerHTML = Object.keys(BLOCK_PALETTES).filter(k => BLOCK_PALETTES[k].free || _ownedPals.includes(k)).map(k => `<option value="${k}"${settings.colorPalette === k ? ' selected' : ''}>${BLOCK_PALETTES[k].name}</option>`).join('');
        }
        // Random piece colors sync
        const _rpcCheck = document.getElementById('setting-random-piece-colors');
        if (_rpcCheck) _rpcCheck.checked = settings.randomPieceColors || false;
        const snpEl = document.getElementById('settings-now-playing');
        const snpName = document.getElementById('settings-np-name');
        if (snpEl && snpName) {
            snpEl.style.display = _nowPlayingName ? '' : 'none';
            if (_nowPlayingName) snpName.innerText = _nowPlayingName;
        }
        const _sutCheck = document.getElementById('setting-speed-up-text');
        if (_sutCheck) _sutCheck.checked = settings.showSpeedUp !== false;
        const hdlSlider = document.getElementById('setting-hard-drop-lock-slider-wrap');
        const hdlCheck = document.getElementById('setting-hard-drop-lock');
        if (hdlCheck) hdlCheck.checked = settings.hardDropLock || false;
        if (hdlSlider) hdlSlider.style.display = (settings.hardDropLock) ? 'flex' : 'none';
        const hdlRange = document.getElementById('setting-hard-drop-lock-ms');
        if (hdlRange) { hdlRange.value = settings.hardDropLockMs || 50; _dStepsSync('hdl-dtrack','',hdlRange,0,100); }
        const hdlVal = document.getElementById('setting-hard-drop-lock-ms-val');
        if (hdlVal) hdlVal.innerText = (settings.hardDropLockMs || 50) + 'ms';
        // Font size & game size steppers
        const fsV = parseInt(settings.fontSize || '5');
        const gsV = parseInt(settings.gameScale || '5');
        const fsSlider = document.getElementById('slider-fontsize'); if (fsSlider) fsSlider.value = fsV;
        const gsSlider = document.getElementById('slider-gamescale'); if (gsSlider) gsSlider.value = gsV;
        const fsValEl = document.getElementById('fontsize-step-val'); if (fsValEl) fsValEl.innerText = fsV;
        const fsFill = document.getElementById('fontsize-step-fill'); if (fsFill) fsFill.style.width = ((fsV-1)/9*100).toFixed(1)+'%';
        const gsValEl = document.getElementById('gamescale-step-val'); if (gsValEl) gsValEl.innerText = gsV;
        const gsFill = document.getElementById('gamescale-step-fill'); if (gsFill) gsFill.style.width = ((gsV-1)/9*100).toFixed(1)+'%';
        // DAS / ARR / Grid D-steps
        const dasSlider = document.getElementById('slider-das');
        if (dasSlider) { dasSlider.value = settings.das || 160; _dStepsSync('das-dtrack','',dasSlider,50,300); }
        const dasVal = document.getElementById('setting-das-val'); if (dasVal) dasVal.innerText = (settings.das||160)+'ms';
        const arrSlider = document.getElementById('slider-arr');
        if (arrSlider) { arrSlider.value = settings.arr ?? 50; _dStepsSync('arr-dtrack','',arrSlider,0,100); }
        const arrVal = document.getElementById('setting-arr-val'); if (arrVal) arrVal.innerText = (settings.arr??50)+'ms';
        const gridSlider = document.getElementById('slider-grid');
        if (gridSlider) { gridSlider.value = settings.gridOpacity ?? 40; _dStepsSync('grid-dtrack','',gridSlider,0,100); }
        const gridVal = document.getElementById('setting-grid-val'); if (gridVal) gridVal.innerText = (settings.gridOpacity??30)+'%';
        // Shake
        const shakeSlider = document.getElementById('slider-shake');
        const shakeV = settings.shakeStrength ?? 2;
        if (shakeSlider) { shakeSlider.value = shakeV; _dStepsSync('shake-dtrack','',shakeSlider,0,3); }
        const shakeVal = document.getElementById('setting-shake-val'); if (shakeVal) shakeVal.innerText = ['None','Light','Medium','Strong'][shakeV] || shakeV;
        // Line clear speed
        const _lcSteps = [0, 50, 100, 150, 200, 300];
        const lcMs = settings.lineClearMs ?? 150;
        const lcIdx = _lcSteps.indexOf(lcMs) >= 0 ? _lcSteps.indexOf(lcMs) : 3;
        const lcSlider = document.getElementById('slider-lineclear');
        if (lcSlider) { lcSlider.value = lcIdx; _dStepsSync('lineclear-dtrack','',lcSlider,0,5); }
        const lcVal = document.getElementById('setting-lineclear-val'); if (lcVal) lcVal.innerText = lcMs === 0 ? 'Instant' : lcMs + 'ms';
        // Heavy fall D-step
        const hbV = parseInt(settings.heavyBg) || 1;
        const hbSlider = document.getElementById('slider-heavybg');
        if (hbSlider) { hbSlider.value = hbV; _dStepsSync('heavybg-dtrack','',hbSlider,1,3); }
        const hbVal = document.getElementById('setting-heavybg-val'); if (hbVal) hbVal.innerText = ['','Light','Medium','Heavy'][hbV] || '';
        const _pauseVisible = !document.getElementById('pause-overlay').classList.contains('hidden');
        window._settingsFromPause = _pauseVisible;
        if (!_pauseVisible) document.getElementById('menu-overlay').classList.add('hidden');
        const _settEl = document.getElementById('settings-overlay');
        _settEl.classList.remove('hidden');
        _animateIn(_settEl, 'anim-in-right');
    }
    async function resetAllProgress() {
        const phrase = 'RESET MY PROGRESS';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:inherit;';
        overlay.innerHTML = `
            <div style="background:rgba(8,4,4,0.98);border:1px solid #ff4444;border-radius:14px;padding:24px 20px;max-width:320px;width:90%;text-align:center;box-shadow:0 0 40px rgba(255,68,68,0.3);">
                <div style="font-size:0.85rem;font-weight:bold;color:#ff4444;letter-spacing:2px;margin-bottom:10px;">⚠ RESET ALL PROGRESS</div>
                <p style="font-size:0.7rem;color:#aaa;margin-bottom:14px;line-height:1.6;">This will permanently delete <b style="color:#fff;">all XP, scores, unlocks, and achievements</b>.<br>To confirm, type exactly:</p>
                <div style="font-size:0.75rem;color:#ff4444;font-weight:bold;letter-spacing:1px;margin-bottom:10px;">"${phrase}"</div>
                <input id="reset-phrase-input" type="text" placeholder="Type here…" style="width:100%;box-sizing:border-box;padding:8px 10px;background:rgba(255,255,255,0.04);border:1px solid #555;border-radius:6px;color:#fff;font-family:inherit;font-size:0.72rem;margin-bottom:14px;outline:none;" autocomplete="off">
                <div style="display:flex;gap:8px;justify-content:center;">
                    <button type="button" id="reset-cancel-btn" style="flex:1;padding:8px;font-size:0.72rem;border:1px solid #555;border-radius:8px;background:rgba(255,255,255,0.05);color:#888;cursor:pointer;font-family:inherit;">Cancel</button>
                    <button type="button" id="reset-confirm-btn" style="flex:1;padding:8px;font-size:0.72rem;border:1px solid #ff4444;border-radius:8px;background:rgba(255,68,68,0.12);color:#ff4444;cursor:pointer;font-family:inherit;font-weight:bold;">RESET</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const inp = overlay.querySelector('#reset-phrase-input');
        inp.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); overlay.querySelector('#reset-confirm-btn').click(); }
        });
        inp.focus();
        overlay.querySelector('#reset-cancel-btn').onclick = () => overlay.remove();
        overlay.querySelector('#reset-confirm-btn').onclick = async (e) => {
            e.preventDefault();
            if (inp.value !== phrase) { inp.style.borderColor='#ff4444'; inp.style.background='rgba(255,68,68,0.08)'; inp.value=''; inp.placeholder='Incorrect phrase, try again'; return; }
            overlay.remove();
            saveData = JSON.parse(JSON.stringify(defaultSaveData));
            // Reset visual settings to defaults so owned items show correctly
            settings.skin = 'neon';
            settings.theme = 'default';
            settings.ghostColor = 'white';
            settings.gridStyle = 'lines';
            settings.colorPalette = 'classic';
            settings.randomBlockColors = false;
            settings.sfxPack = 'default';
            settings.btnStyle = 'square';
            // Save settings directly to localStorage (no file write) to avoid concurrent write race
            localStorage.setItem('tetrisRPG_settings', JSON.stringify(settings));
            _doApplyTheme('default');
            await saveDataToFile();
            drawRankBadge();
            _populateVisualCustomize();
            customAlert("All progress has been reset.", "RESET COMPLETE");
        };
    }
    window.resetAllProgress = resetAllProgress;
    function closeSettings() {
        controlsEditor.cancel();
        if (_settingsTrackPollId) { clearInterval(_settingsTrackPollId); _settingsTrackPollId = null; }
        const _fromPause = window._settingsFromPause;
        window._settingsFromPause = false;
        _animateOut(document.getElementById('settings-overlay'), 'anim-out-right', function() {
            if (!_fromPause) {
                const _mEl = document.getElementById('menu-overlay');
                _mEl.classList.remove('hidden');
                _animateIn(_mEl, 'anim-in-left');
            }
        });
    }
    function toggleInstructions() {
        const hidden = document.getElementById('instr-content').classList.toggle('hidden');
        document.getElementById('instr-arrow').innerText = hidden ? '▶' : '▼';
    }
    function onSettingChange(key, value) {
        if (key === 'classicColors') { settings.classicColors = value; }
        else if (key === 'musicVol') {
            settings.musicVol = parseInt(value);
            _cPillSync('music', value);
            const mvEl = document.getElementById('setting-music-val'); if (mvEl) mvEl.innerText = value + '%';
            if (masterGain) masterGain.gain.value = settings.musicVol / 100 * 0.2;
            const isPix2 = settings.stylePack === 'pixel';
            const _isMuted2 = settings.musicVol === 0 || _musicMuted;
            const _ico2 = _isMuted2 ? (isPix2?_SVG_PIX_MUTED:_SVG_MUTED) : (isPix2?_SVG_PIX_VOL:_SVG_VOL);
            const mb = document.getElementById('music-mute-btn');
            if (mb) mb.innerHTML = _ico2;
            const _mwMute2 = document.getElementById('mw-mute');
            if (_mwMute2) _mwMute2.innerHTML = _ico2;
            const _plMute2 = document.getElementById('pl-mw-mute');
            if (_plMute2) _plMute2.innerHTML = (_isMuted2 ? _SVG_MUTED : _SVG_VOL).replace('width="14"','width="11"').replace('height="14"','height="11"');
            saveSettingsDebounced(); return;
        } else if (key === 'sfxVol') {
            settings.sfxVol = parseInt(value);
            _cPillSync('sfx', value);
            const svEl = document.getElementById('setting-sfx-val'); if (svEl) svEl.innerText = value + '%';
            if (sfxGain) sfxGain.gain.value = settings.sfxVol / 100 * 0.4;
            const isPix2 = settings.stylePack === 'pixel';
            const sb = document.getElementById('sfx-mute-btn');
            if (sb) sb.innerHTML = settings.sfxVol === 0 ? (isPix2?_SVG_PIX_MUTED:_SVG_MUTED) : (isPix2?_SVG_PIX_VOL:_SVG_VOL);
            saveSettingsDebounced(); return;
        } else if (key === 'fontSize') {
            settings.fontSize = value;
            applyFontSize(value);
            const fsSl = document.getElementById('slider-fontsize'); if (fsSl) fsSl.value = value;
            const fsVEl = document.getElementById('fontsize-step-val'); if (fsVEl) fsVEl.innerText = value;
            const fsFEl = document.getElementById('fontsize-step-fill'); if (fsFEl) fsFEl.style.width = ((parseInt(value)-1)/9*100).toFixed(1)+'%';
            saveSettingsDebounced(); return;
        } else if (key === 'gameScale') {
            settings.gameScale = value;
            applyGameScale(value);
            const gsSl = document.getElementById('slider-gamescale'); if (gsSl) gsSl.value = value;
            const gsVEl = document.getElementById('gamescale-step-val'); if (gsVEl) gsVEl.innerText = value;
            const gsFEl = document.getElementById('gamescale-step-fill'); if (gsFEl) gsFEl.style.width = ((parseInt(value)-1)/9*100).toFixed(1)+'%';
            saveSettingsDebounced(); return;
        } else if (key === 'heavyBg') {
            settings.heavyBg = parseInt(value) || 1;
            _rebuildBgBlocks();
            const _hbLabels = ['','Light','Medium','Heavy'];
            const hbVal = document.getElementById('setting-heavybg-val'); if (hbVal) hbVal.innerText = _hbLabels[settings.heavyBg] || '';
            _dStepsSync('heavybg-dtrack','',document.getElementById('slider-heavybg'),1,3);
        } else if (key === 'ghostColor') {
            if (value === 'colored' && !saveData.ghostColorUnlocked) return;
            settings.ghostColor = value;
            const ghostContainer = document.getElementById('ghost-color-btns');
            if (ghostContainer) {
                ghostContainer.querySelectorAll('.opt-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().startsWith(value)));
            }
            saveSettings(); _populateVisualCustomize(); return;
        } else if (key === 'sfxPack') { settings.sfxPack = value; saveSettings(); _populateInventoryOther(); return; }
        else if (key === 'colorPalette') {
            if (value === '_random') {
                // Random Colors is a palette — treat as mutually exclusive with others
                settings.randomBlockColors = true;
                settings.colorPalette = '_random';
                saveSettings(); _populateVisualCustomize(); _populateInventoryOther();
                return;
            }
            const owned = saveData.ownedPalettes || ['classic'];
            const pal = BLOCK_PALETTES[value];
            if (!pal || (!pal.free && !owned.includes(value))) return;
            settings.randomBlockColors = false;
            settings.colorPalette = value;
            settings._lastPalette = value;
            _applyColorPalette(value);
            saveSettings(); _populateVisualCustomize(); _populateInventoryOther();
            const selEl = document.getElementById('setting-color-palette'); if (selEl) selEl.value = value;
            return;
        }
        else if (key === 'randomPieceColors') { settings.randomPieceColors = !!value; saveSettings(); _populateVisualCustomize(); return; }
        else if (key === 'randomBlockColors') { settings.randomBlockColors = !!value; settings.colorPalette = value ? '_random' : (settings._lastPalette || 'classic'); if (!value) _applyColorPalette(settings.colorPalette); saveSettings(); _populateVisualCustomize(); return; }
        else if (key === 'btnStyle') { applyBtnStyle(value); return; }
        if (key === 'das') { settings.das = parseInt(value); const v = document.getElementById('setting-das-val'); if (v) v.innerText = value + 'ms'; saveSettingsDebounced(); return; }
        if (key === 'arr') { settings.arr = parseInt(value); const v = document.getElementById('setting-arr-val'); if (v) v.innerText = value + 'ms'; saveSettingsDebounced(); return; }
        if (key === 'hardDropLock') {
            settings.hardDropLock = value;
            const sliderEl = document.getElementById('setting-hard-drop-lock-slider-wrap');
            if (sliderEl) sliderEl.style.display = value ? 'flex' : 'none';
        }
        if (key === 'hardDropLockMs') {
            settings.hardDropLockMs = parseInt(value);
            const valEl = document.getElementById('setting-hard-drop-lock-ms-val');
            if (valEl) valEl.innerText = value + 'ms';
            saveSettingsDebounced(); return;
        }
        if (key === 'gridOpacity') {
            settings.gridOpacity = parseInt(value);
            const gv = document.getElementById('setting-grid-val');
            if (gv) gv.innerText = value + '%';
            saveSettingsDebounced(); return;
        }
        if (key === 'shakeStrength') {
            settings.shakeStrength = parseInt(value);
            const lbl = document.getElementById('setting-shake-label');
            if (lbl) lbl.innerText = ['Off','Light','Medium','Strong'][settings.shakeStrength] || '';
            const sv2 = document.getElementById('setting-shake-val'); if (sv2) sv2.innerText = ['None','Light','Medium','Strong'][parseInt(value)] || value;
            saveSettingsDebounced(); return;
        }
        if (key === 'lineClearMs') {
            const _lcSteps = [0, 50, 100, 150, 200, 300];
            settings.lineClearMs = _lcSteps[parseInt(value)] ?? 150;
            const lcv = document.getElementById('setting-lineclear-val');
            if (lcv) lcv.innerText = settings.lineClearMs === 0 ? 'Instant' : settings.lineClearMs + 'ms';
            saveSettingsDebounced(); return;
        }
        saveSettings();
    }

    function downloadFile(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    const _SK = ['T','e','t','R','P','G','_','x','4','K','9','#','m','Q','2','$','v','L','5','@','n','P','8','!','w','R','3','&','z','J','6','%'].join('');
    function _encSave(s) {
        const bytes = new TextEncoder().encode(s);
        let o = '';
        for (let i = 0; i < bytes.length; i++) o += String.fromCharCode(bytes[i] ^ _SK.charCodeAt(i % _SK.length));
        return 'TRPG2:' + btoa(o);
    }
    function _decSave(s) {
        if (!s.startsWith('TRPG1:') && !s.startsWith('TRPG2:')) return null;
        try {
            const d = atob(s.slice(6));
            const bytes = Uint8Array.from(d, (c, i) => c.charCodeAt(0) ^ _SK.charCodeAt(i % _SK.length));
            if (s.startsWith('TRPG2:')) return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            return Array.from(bytes, b => String.fromCharCode(b)).join('');
        } catch(e) { return null; }
    }

    async function startExportProcess() {
        try {
            const saveFile = _encSave(JSON.stringify({ version: 3, data: saveData }, null, 2));
            downloadFile('Linebreaker_Save.lbsave', saveFile);
            customAlert('Save file (.lbsave) downloaded. Your progress was NOT reset.', 'EXPORT SUCCESS', false);
        } catch(e) {
            customAlert('Could not export your save. Please try again.', 'EXPORT ERROR', false);
        }
    }

    function handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(e) {
            let importedData = null;
            try {
                const raw = _decSave(e.target.result.trim());
                const parsed = JSON.parse(raw);
                importedData = parsed.data || parsed;
            } catch(err) {}
            if (importedData && typeof importedData.totalXP === 'number') {
                const confirmed = await customConfirm("Importing will <b>OVERWRITE</b> your current progress. Proceed?");
                if (!confirmed) { document.getElementById('file-import-input').value = ''; return; }
                applyLoadedData(importedData);
                // save_transfer achievement
                if (!saveData.achievements) saveData.achievements = {};
                if (!saveData.achievements['save_transfer']?.unlocked) unlockAchievement('save_transfer');
                saveDataToFile(); drawRankBadge();
                customAlert("Progress restored from file!", "SUCCESS", false, () => { closeTransferMenu(); });
            } else {
                customAlert("Invalid or unrecognised save file!", "ERROR", true);
            }
            document.getElementById('file-import-input').value = '';
        };
        reader.readAsText(file);
    }
    
    function saveToLeaderboard(score, lines, blocks, time, maxSpeed, xp, maxCombo) {
        const now = new Date();
        const d=String(now.getDate()).padStart(2,'0'), m=String(now.getMonth()+1).padStart(2,'0'), y=now.getFullYear();
        const hh=String(now.getHours()).padStart(2,'0'), mm=String(now.getMinutes()).padStart(2,'0');
        saveData.leaderboard.push({ score, date:`${d}.${m}.${y} ${hh}:${mm}`, lines, blocks, time, maxSpeed, xp, maxCombo: maxCombo || 0 });
        saveData.leaderboard.sort((a,b) => b.score - a.score);
    }

    let _lastGameStats = null; // stores stats from most recent game for pinning

    function pinScore(score, lines, blocks, time, maxSpeed, xp, note) {
        if (!saveData.pinnedScores) saveData.pinnedScores = [];
        const now = new Date();
        const d=String(now.getDate()).padStart(2,'0'), m=String(now.getMonth()+1).padStart(2,'0'), y=now.getFullYear();
        const hh=String(now.getHours()).padStart(2,'0'), mm=String(now.getMinutes()).padStart(2,'0');
        saveData.pinnedScores.push({ score, date:`${d}.${m}.${y}, ${hh}:${mm}`, lines, blocks, time, maxSpeed, xp, note: note || '' });
        if (saveData.pinnedScores.length > 50) saveData.pinnedScores = saveData.pinnedScores.slice(-50);
        // pin_record achievement — pinned score equals the top leaderboard score (works with dev-added scores too)
        const _effectiveHS = (saveData.leaderboard?.length > 0 ? saveData.leaderboard[0].score : null) ?? saveData.highscore;
        if (score === _effectiveHS && _effectiveHS > 0 && !saveData.achievements?.['pin_record']?.unlocked) unlockAchievement('pin_record');
        // pin_collector tracking
        saveData.stats.pinnedCount = (saveData.stats.pinnedCount || 0) + 1;
        if ((saveData.stats.pinnedCount || 0) >= 15 && !saveData.achievements?.['pin_collector']?.unlocked) unlockAchievement('pin_collector');
        saveDataToFile();
    }
    function pinCurrentScore() {
        if (!_lastGameStats) { customAlert('No completed game to pin.', 'PIN SCORE'); return; }
        const s = _lastGameStats;
        pinScore(s.score, s.lines, s.blocks, s.time, s.maxSpeed, s.xp, s.note);
        customAlert('Score pinned!', 'PIN SCORE');
    }
    function pinLeaderboardEntry(idx) {
        const e = saveData.leaderboard[idx];
        if (!e) return;
        pinScore(e.score, e.lines, e.blocks, e.time, e.maxSpeed, e.xp, 'from leaderboard');
    }
    function unpinScore(realIdx) {
        if (!saveData.pinnedScores) return;
        saveData.pinnedScores.splice(realIdx, 1);
        saveDataToFile();
        drawPinnedScores();
    }
    function _showScorePinPopup(x, y, label, action) {
        let popup = document.getElementById('score-pin-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'score-pin-popup';
            popup.style.cssText = 'position:fixed;z-index:2200;background:rgba(5,5,20,0.97);border:1px solid rgba(255,215,0,0.5);border-radius:8px;padding:7px 14px;font-size:0.72rem;cursor:pointer;color:#ffd700;font-family:inherit;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.6);transition:opacity 0.1s;';
            document.body.appendChild(popup);
            document.addEventListener('click', (e) => { if (!popup.contains(e.target)) popup.style.display = 'none'; });
        }
        popup.innerHTML = label;
        popup.style.display = 'block';
        popup.style.left = Math.min(x + 6, window.innerWidth - 210) + 'px';
        popup.style.top = (y - 36) + 'px';
        popup.onclick = (e) => { e.stopPropagation(); popup.style.display = 'none'; action(); };
    }
    function _lbIcons() {
        const _ico = (p, w, h) => `<svg viewBox="0 0 16 16" width="${w||12}" height="${h||12}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;opacity:0.8">${p}</svg>`;
        return {
            time:  _ico(`<circle cx="8" cy="9" r="5.5"/><polyline points="8 6 8 9 10 11"/><line x1="5.5" y1="1.5" x2="10.5" y2="1.5"/>`, 16, 16),
            lines: _ico(`<rect x="1" y="6" width="14" height="4" rx="0.8" fill="currentColor" stroke="none"/><line x1="3" y1="3.5" x2="3" y2="6"/><line x1="6.5" y1="3" x2="6.5" y2="6"/><line x1="9.5" y1="3" x2="9.5" y2="6"/><line x1="13" y1="3.5" x2="13" y2="6"/><line x1="3" y1="10" x2="3" y2="12.5"/><line x1="6.5" y1="10" x2="6.5" y2="13"/><line x1="9.5" y1="10" x2="9.5" y2="13"/><line x1="13" y1="10" x2="13" y2="12.5"/>`, 16, 16),
            speed: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px;opacity:0.85"><path d="M3 16a9 9 0 1 1 18 0"/><line x1="12" y1="16" x2="8" y2="11"/><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none"/></svg>`,
            cal:   `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;opacity:0.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        };
    }
    function drawPinnedScores() {
        const container = document.getElementById('pinned-list');
        if (!container) return;
        const pins = saveData.pinnedScores || [];
        if (pins.length === 0) { container.innerHTML = "<div style='color:#666;text-align:center;padding:15px 0;'>No pinned scores yet.<br><span style='font-size:0.65rem;'>Pin scores from leaderboard.</span></div>"; return; }
        const lbFmt = (t) => { const m = Math.floor(t/60); const s = t%60; return `${m}m ${String(s).padStart(2,'0')}s`; };
        const ico = _lbIcons();
        const tipEl = document.getElementById('lb-tooltip-global');
        container.innerHTML = '';
        [...pins].reverse().forEach((e, ri) => {
            const realIdx = pins.length - 1 - ri;
            const div = document.createElement('div'); div.className = 'lb-row';
            div.style.cssText = 'border-left:2px solid #ffd700;padding-left:8px;';
            const details = e.lines != null
                ? `<span class="lb-detail">${ico.time}${lbFmt(e.time||0)}</span><span class="lb-detail">${ico.lines}${e.lines||0} lines</span><span class="lb-detail">${ico.speed}speed ${e.maxSpeed||1}</span>`
                : '';
            const noteHtml = e.note ? `<span style="font-size:0.55rem;color:#888;margin-left:6px;">${e.note}</span>` : '';
            div.innerHTML = `<span class="lb-rank" style="color:#ffd700;min-width:24px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffd700" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg></span><span class="lb-score">${e.score.toLocaleString()} <span class="lb-pts">pts</span></span><span class="lb-details-row">${details}${noteHtml}</span><span class="lb-date">${e.date}</span>`;
            div.style.cursor = 'pointer';
            div.addEventListener('click', (ev) => {
                ev.stopPropagation();
                _showScorePinPopup(ev.clientX, ev.clientY, '📌 Unpin', () => unpinScore(realIdx));
            });
            container.appendChild(div);
        });
    }
    function _drawHighscoreHistory() {
        const container = document.getElementById('highscores-list');
        if (!container) return;
        const history = saveData.highscoreHistory || [];
        // Build full list: history + current highscore
        const all = [...history];
        if (saveData.highscore > 0) {
            const _hsd = saveData.highscoreData;
            all.push({ score: saveData.highscore, date: 'Current', isCurrent: true, lines: _hsd?.lines, time: _hsd?.time, maxSpeed: _hsd?.maxSpeed });
        }
        if (all.length === 0) { container.innerHTML = "<div style='color:#666;text-align:center;padding:15px 0;'>No highscores yet.<br><span style='font-size:0.65rem;'>Play to set your first record!</span></div>"; return; }
        container.innerHTML = '';
        // Sort descending by score
        all.sort((a, b) => b.score - a.score);
        const lbFmt = (t) => { const m = Math.floor(t/60); const s = t%60; return `${m}m ${String(s).padStart(2,'0')}s`; };
        const ico = _lbIcons();
        all.forEach((e, i) => {
            const div = document.createElement('div'); div.className = 'lb-row';
            const isCur = e.isCurrent;
            div.style.cssText = isCur ? 'border-left:2px solid var(--primary);padding-left:8px;' : 'padding-left:10px;';
            const rankColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#e8922a' : '#666';
            const details = e.lines != null
                ? `<span class="lb-detail">${ico.time}${lbFmt(e.time||0)}</span><span class="lb-detail">${ico.lines}${e.lines||0} lines</span><span class="lb-detail">${ico.speed}spd ${e.maxSpeed||1}</span>`
                : '';
            div.innerHTML = `<span class="lb-rank" style="color:${rankColor};min-width:24px;font-weight:bold;">#${i+1}</span><span class="lb-score">${e.score.toLocaleString()} <span class="lb-pts">pts</span></span><span class="lb-details-row">${details}</span><span class="lb-date" style="${isCur?'color:var(--primary);font-weight:bold;':''}">${isCur ? '⭐ CURRENT' : e.date}</span>`;
            container.appendChild(div);
        });
    }
    function drawLeaderboard() {
        const container = document.getElementById('lb-list'); container.innerHTML = "";
        if (saveData.leaderboard.length === 0) { container.innerHTML = "<div style='color:#666;text-align:center;padding:15px 0;'>Play your first game!</div>"; return; }
        const lb = saveData.leaderboard;
        const lbFmt = (t) => { const m = Math.floor(t/60); const s = t%60; return `${m}m ${String(s).padStart(2,'0')}s`; };
        const ico = _lbIcons();
        const tipEl = document.getElementById('lb-tooltip-global');

        // --- PODIUM (top 3) ---
        const podiumOrder = [
            lb[1] ? { e: lb[1], rank: 2, medal: '🥈', color: '#c0c0c0', h: 58, lbIdx: 1 } : null,
            lb[0] ? { e: lb[0], rank: 1, medal: '🥇', color: '#ffd700', h: 88, lbIdx: 0 } : null,
            lb[2] ? { e: lb[2], rank: 3, medal: '🥉', color: '#e8922a', h: 40, lbIdx: 2 } : null,
        ].filter(Boolean);
        const podiumWrap = document.createElement('div');
        podiumWrap.style.cssText = 'display:flex;align-items:flex-end;justify-content:center;gap:3px;margin-bottom:4px;';
        podiumOrder.forEach(p => {
            const block = document.createElement('div');
            block.style.cssText = `display:flex;flex-direction:column;align-items:center;flex:1;max-width:130px;`;
            const scoreDiv = document.createElement('div');
            scoreDiv.style.cssText = `font-size:0.7rem;font-weight:bold;color:${p.color};margin-bottom:5px;font-family:'Orbitron',sans-serif;letter-spacing:0.5px;`;
            scoreDiv.innerHTML = `${p.e.score.toLocaleString()} <span style="font-weight:normal;opacity:0.5;font-size:0.6rem;">pts</span>`;
            const podBlock = document.createElement('div');
            podBlock.style.cssText = `width:100%;height:${p.h}px;background:linear-gradient(180deg,${p.color}28,${p.color}0d);border:1px solid ${p.color}55;border-bottom:none;border-radius:6px 6px 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;`;
            podBlock.innerHTML = `<div style="font-size:1.5rem;line-height:1;">${p.medal}</div>`;
            block.style.cursor = 'pointer';
            block.appendChild(scoreDiv);
            block.appendChild(podBlock);
            block.addEventListener('click', (ev) => {
                ev.stopPropagation();
                _showScorePinPopup(ev.clientX, ev.clientY, '📌 Pin this score', () => pinLeaderboardEntry(p.lbIdx));
            });
            block.addEventListener('mouseenter', (ev) => {
                if (!tipEl) return;
                const e = p.e;
                let tipHtml = `<div style="font-size:0.7rem;font-weight:bold;color:${p.color};margin-bottom:5px;">${p.medal} #${p.rank} — ${e.score.toLocaleString()} pts</div>`;
                if (e.lines != null) {
                    tipHtml += `<div style="display:flex;flex-direction:column;gap:2px;">`;
                    tipHtml += `<span>${ico.time} ${lbFmt(e.time||0)}</span>`;
                    tipHtml += `<span>${ico.lines} ${e.lines||0} lines</span>`;
                    tipHtml += `<span>${ico.speed} speed ${e.maxSpeed||1}</span>`;
                    if (e.maxCombo > 1) tipHtml += `<span>🔥 combo x${e.maxCombo}</span>`;
                    tipHtml += `</div>`;
                }
                tipHtml += `<div style="color:#555;font-size:0.6rem;margin-top:4px;">${e.date}</div>`;
                tipEl.innerHTML = tipHtml;
                tipEl.style.display = 'block';
                const tx = Math.min(ev.clientX + 14, window.innerWidth - 190);
                tipEl.style.left = tx + 'px'; tipEl.style.top = (ev.clientY - 10) + 'px';
            });
            block.addEventListener('mousemove', (ev) => {
                if (!tipEl) return;
                const tx = Math.min(ev.clientX + 14, window.innerWidth - 190);
                tipEl.style.left = tx + 'px'; tipEl.style.top = (ev.clientY - 10) + 'px';
            });
            block.addEventListener('mouseleave', () => { if (tipEl) tipEl.style.display = 'none'; });
            podiumWrap.appendChild(block);
        });
        const ground = document.createElement('div');
        ground.style.cssText = 'height:3px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent);border-radius:2px;margin-bottom:14px;';
        container.appendChild(podiumWrap);
        container.appendChild(ground);

        // --- Regular rows (4th+) with Load More ---
        let _lbShown = 50;
        function _renderLbRows(upTo) {
            // Remove existing rows and load-more button
            container.querySelectorAll('.lb-row, .lb-load-more').forEach(el => el.remove());
            const max = Math.min(upTo, lb.length);
            for (let i = 3; i < max; i++) {
                const e = lb[i];
                const div = document.createElement('div'); div.className = 'lb-row';
                const rankColor = i < 10 ? '#9b59b6' : i < 20 ? '#3d85c8' : '#666';
                const details = e.lines != null
                    ? `<span class="lb-detail">${ico.time}${lbFmt(e.time)}</span><span class="lb-detail">${ico.lines}${e.lines} lines</span><span class="lb-detail">${ico.speed}speed ${e.maxSpeed}</span>`
                    : '';
                div.innerHTML = `<span class="lb-rank" style="font-size:0.85rem;font-weight:bold;color:${rankColor};min-width:52px;text-align:center;">#${i+1}</span><span class="lb-score">${e.score.toLocaleString()} <span class="lb-pts">pts</span></span><span class="lb-details-row">${details}</span><span class="lb-date">${e.date}</span>`;
                div.style.cursor = 'pointer';
                div.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    _showScorePinPopup(ev.clientX, ev.clientY, '📌 Pin this score', () => pinLeaderboardEntry(i));
                });
                container.appendChild(div);
            }
            // Load More button
            if (max < lb.length) {
                const moreBtn = document.createElement('div');
                moreBtn.className = 'lb-load-more';
                moreBtn.style.cssText = 'text-align:center;padding:12px;cursor:pointer;color:var(--primary);font-size:0.7rem;font-weight:bold;letter-spacing:1px;opacity:0.7;transition:opacity 0.2s;';
                moreBtn.textContent = `LOAD MORE (${lb.length - max} remaining)`;
                moreBtn.addEventListener('mouseenter', () => moreBtn.style.opacity = '1');
                moreBtn.addEventListener('mouseleave', () => moreBtn.style.opacity = '0.7');
                moreBtn.addEventListener('click', () => {
                    _lbShown += 50;
                    _renderLbRows(_lbShown);
                });
                container.appendChild(moreBtn);
            }
        }
        _renderLbRows(_lbShown);
    }

    const RANKS = [
        { maxLvl: 10,  name: "BRONZE",   c: "#e8922a", shape: {sides:0} },
        { maxLvl: 20,  name: "SILVER",   c: "#c8d8e8", shape: {sides:4} },
        { maxLvl: 30,  name: "GOLD",     c: "#ffd700", shape: {sides:5} },
        { maxLvl: 40,  name: "EMERALD",  c: "#50c878", shape: {sides:6} },
        { maxLvl: 50,  name: "SAPPHIRE", c: "#3377ff", shape: {sides:4, star:true, innerRatio:0.48} },
        { maxLvl: 60,  name: "RUBY",     c: "#ff0033", shape: {sides:5, star:true, innerRatio:0.45} },
        { maxLvl: 70,  name: "AMETHYST", c: "#8e44ad", shape: {sides:8, star:true, innerRatio:0.76} },
        { maxLvl: 80,  name: "DIAMOND",  c: "#94ffff", shape: {sides:10, star:true, innerRatio:0.74} },
    ];
    const CELESTITE_RANK = { name: "CELESTITE", c: "#7ec8e3" };

    function getShapePoints(cx, cy, r, shape) {
        if (!shape || shape.sides === 0) return null;
        const isStar = !!shape.star;
        const total = isStar ? shape.sides * 2 : shape.sides;
        const pts = [];
        const startAngle = -Math.PI / 2;
        for (let i = 0; i < total; i++) {
            const angle = startAngle + (i * Math.PI * 2) / total;
            const rad = (isStar && i % 2 === 1) ? r * (shape.innerRatio || 0.45) : r;
            pts.push([cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad]);
        }
        return pts;
    }
    // ===================== ACHIEVEMENTS =====================
    const RARITY_ACH = {
        common:   { color: '#39ff57', label: 'COMMON',    glow: 'rgba(57,255,87,0.6)'    },
        rare:     { color: '#5cb8ff', label: 'RARE',      glow: 'rgba(92,184,255,0.6)'   },
        epic:     { color: '#9932cc', label: 'EPIC',      glow: 'rgba(153,50,204,0.6)'   },
        legendary:{ color: '#ffd740', label: 'LEGENDARY', glow: 'rgba(255,215,64,0.6)'   },
        mythic:   { color: '#cc1111', label: 'MYTHIC',    glow: 'rgba(204,17,17,0.6)'    },
    };
    const _ACH_XP = { common: 500, rare: 1000, epic: 2500, legendary: 5000, mythic: 10000 };

    const _ACH_SVG = {
        trophy:     `<path d="M7 3h10v7a5 5 0 01-10 0V3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 7H4a3 3 0 003 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M17 7h3a3 3 0 01-3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="15" x2="12" y2="20" stroke="currentColor" stroke-width="1.5"/><path d="M8 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
        controller: `<rect x="2" y="7" width="20" height="12" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="11" x2="7" y2="16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="4.5" y1="13.5" x2="9.5" y2="13.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="15.5" cy="11.5" r="1.2" fill="currentColor"/><circle cx="17.5" cy="13.5" r="1.2" fill="currentColor"/>`,
        bolt:       `<polyline points="13 2 13 9 19 9 11 22 11 15 5 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
        quad:       `<line x1="4" y1="5.5" x2="20" y2="5.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="4" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="4" y1="14.5" x2="20" y2="14.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="4" y1="19" x2="20" y2="19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`,
        smiley:     `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="10.5" r="1.2" fill="currentColor"/><path d="M8 15 Q12 18.5 16 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
        stopwatch:  `<circle cx="12" cy="14" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="12 10 12 14 15 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="3" x2="12" y2="7" stroke="currentColor" stroke-width="1.5"/>`,
        turtle:     `<ellipse cx="12" cy="14" rx="7" ry="5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="18" x2="5" y2="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="17" y1="18" x2="19" y2="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="14" x2="2" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="19" y1="14" x2="22" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
        mirror:     `<line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/><path d="M6 6h3v12H6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M18 6h-3v12h3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
        flame:      `<path d="M12 22c-4.5 0-8-3.5-8-8 0-3.5 2-6 4-8 0 3 2 4.5 3 5-1-3.5 1-6 3-8 0 3.5 3 5 3 8 1-1.5 1-4 0-5.5 2.5 2 4 5 4 8.5 0 4.5-3.5 8-9 8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
    };

    const ACHIEVEMENTS_DEF = [
        // ── TIERED ────────────────────────────────────────────────
        {
            id: 'score', cat: 'basic', name: 'High Score', type: 'tiered',
            svgIcon: `<path d="M7 3h10v7a5 5 0 01-10 0V3z" fill="none" stroke="#FFD700" stroke-width="1.5" stroke-linejoin="round"/><path d="M5 4H3v4a3 3 0 003 3M19 4h2v4a3 3 0 01-3 3" fill="none" stroke="#FFD700" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="17" x2="12" y2="21" stroke="#FFD700" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="21" x2="16" y2="21" stroke="#FFD700" stroke-width="1.5" stroke-linecap="round"/>`,
            counter: { path:'highscore', label:'Personal Best' },
            tiers: [
                { rarity:'common',    name:'On the Board',  desc:'Reach a score of 500',    check: g => g.score >= 500,   progressDisplay:{ path:'highscore', target:500   } },
                { rarity:'rare',      name:'High Roller',   desc:'Reach a score of 1,000',  check: g => g.score >= 1000,  progressDisplay:{ path:'highscore', target:1000  } },
                { rarity:'epic',      name:'Going Further', desc:'Reach a score of 2,000',  check: g => g.score >= 2000,  progressDisplay:{ path:'highscore', target:2000  } },
                { rarity:'legendary', name:'Top Scorer',    desc:'Reach a score of 5,000',  check: g => g.score >= 5000,  progressDisplay:{ path:'highscore', target:5000  } },
                { rarity:'mythic',    name:'Untouchable',   desc:'Reach a score of 10,000', check: g => g.score >= 10000, progressDisplay:{ path:'highscore', target:10000 } },
            ],
        },
        {
            id: 'games', cat: 'basic', name: 'Games Played', type: 'tiered',
            svgIcon: _ACH_SVG.controller,
            counter: { path:'stats.gamesPlayed', label:'Games Played' },
            tiers: [
                { rarity:'common',    name:'Newbie',     desc:'Play 10 games',    progress:{ path:'stats.gamesPlayed', target:10   } },
                { rarity:'rare',      name:'Hooked',     desc:'Play 50 games',    progress:{ path:'stats.gamesPlayed', target:50   } },
                { rarity:'epic',      name:'Committed',  desc:'Play 100 games',   progress:{ path:'stats.gamesPlayed', target:100  } },
                { rarity:'legendary', name:'The Grind',  desc:'Play 500 games',   progress:{ path:'stats.gamesPlayed', target:500  } },
                { rarity:'mythic',    name:'No Life',    desc:'Play 1,000 games', progress:{ path:'stats.gamesPlayed', target:1000 } },
            ],
        },
        {
            id: 'speed', cat: 'basic', name: 'Throttle', type: 'tiered',
            svgIcon: `<path transform="scale(0.75)" fill="currentColor" d="M15.999 1.129c-8.812 0-15.98 7.169-15.98 15.981 0 5.536 2.803 10.6 7.497 13.544 0.467 0.296 1.084 0.152 1.378-0.316s0.152-1.085-0.316-1.378c-1.691-1.061-3.095-2.439-4.17-4.027l1.048-0.605c0.478-0.276 0.643-0.887 0.366-1.366-0.277-0.48-0.889-0.642-1.366-0.366l-1.050 0.606c-0.763-1.579-1.228-3.306-1.353-5.107h1.113c0.552 0 1-0.448 1-1s-0.447-1-1-1h-1.108c0.132-1.834 0.618-3.572 1.393-5.143l1.005 0.58c0.157 0.091 0.329 0.134 0.499 0.134 0.346 0 0.681-0.179 0.867-0.5 0.277-0.479 0.112-1.090-0.366-1.366l-0.995-0.574c1.003-1.463 2.277-2.728 3.75-3.719l0.563 0.975c0.185 0.322 0.521 0.5 0.867 0.5 0.17 0 0.342-0.043 0.499-0.134 0.479-0.277 0.643-0.887 0.366-1.366l-0.561-0.971c1.542-0.744 3.24-1.208 5.030-1.338v1.246c0 0.553 0.447 1 1 1s1-0.447 1-1v-1.25c1.831 0.127 3.567 0.606 5.137 1.373l-0.543 0.939c-0.276 0.479-0.113 1.090 0.366 1.366 0.157 0.091 0.329 0.134 0.499 0.134 0.346 0 0.681-0.178 0.867-0.5l0.54-0.936c1.459 0.993 2.721 2.255 3.715 3.713l-0.936 0.541c-0.479 0.277-0.642 0.887-0.366 1.366 0.186 0.322 0.521 0.5 0.867 0.5 0.17 0 0.342-0.043 0.499-0.134l0.942-0.543c0.768 1.571 1.248 3.307 1.377 5.139h-1.098c-0.552 0-1 0.448-1 1s0.448 1 1 1h1.098c-0.127 1.777-0.581 3.482-1.328 5.041l-0.99-0.572c-0.477-0.276-1.091-0.111-1.366 0.366-0.276 0.479-0.113 1.090 0.366 1.366l0.993 0.573c-1.097 1.633-2.545 3.044-4.292 4.119-0.471 0.29-0.616 0.907-0.327 1.376 0.189 0.306 0.517 0.476 0.852 0.476 0.178 0 0.36-0.048 0.523-0.148 4.764-2.934 7.608-8.024 7.608-13.614 0-8.811-7.169-15.98-15.98-15.98zM23.378 13.992c0.478-0.277 0.642-0.887 0.366-1.366s-0.888-0.642-1.366-0.366l-5.432 3.136c-0.29-0.164-0.62-0.265-0.977-0.265-1.102 0-1.995 0.893-1.995 1.994 0 1.102 0.893 1.995 1.995 1.995s1.995-0.893 1.995-1.995c0-0.002-0-0.005-0-0.007z"/>`,
            counter: { path:'stats.bestMaxSpeed', label:'Best Speed (Normal)' },
            tiers: [
                { rarity:'common',    name:'First Gear',  desc:'Reach speed 3 in Normal Mode',  check: g => g.maxSpeed >= 3  && g.mode === 'normal', progressDisplay:{ path:'stats.bestMaxSpeed', target:3  } },
                { rarity:'rare',      name:'No Brakes',   desc:'Reach speed 5 in Normal Mode',  check: g => g.maxSpeed >= 5  && g.mode === 'normal', progressDisplay:{ path:'stats.bestMaxSpeed', target:5  } },
                { rarity:'epic',      name:'Overdrive',   desc:'Reach speed 8 in Normal Mode',  check: g => g.maxSpeed >= 8  && g.mode === 'normal', progressDisplay:{ path:'stats.bestMaxSpeed', target:8  } },
                { rarity:'legendary', name:'Supersonic',  desc:'Reach speed 12 in Normal Mode', check: g => g.maxSpeed >= 12 && g.mode === 'normal', progressDisplay:{ path:'stats.bestMaxSpeed', target:12 } },
                { rarity:'mythic',    name:'Turbo',       desc:'Reach speed 15 in Normal Mode', check: g => g.maxSpeed >= 15 && g.mode === 'normal', progressDisplay:{ path:'stats.bestMaxSpeed', target:15 } },
            ],
        },
        // ── SINGLE ────────────────────────────────────────────────
        // ── SECRET ────────────────────────────────────────────────
        {
            id: 'sec_symmetric_board', cat: 'secret', name: 'Mirror Universe', type: 'single',
            rarity: 'rare', clue: 'Balance is everything.',
            desc: 'Have at least 15 blocks arranged in a perfectly symmetric layout on the board (left–right mirror).',
            svgIcon: `<line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2" stroke-linecap="round"/><rect x="3" y="6" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.8"/><rect x="17" y="6" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.8"/><rect x="6" y="12" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.8"/><rect x="14" y="12" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.8"/><rect x="3" y="17" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5"/><rect x="17" y="17" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5"/>`,
            check: g => g.boardSymmetric,
        },
        {
            id: 'sec_nice', cat: 'secret', name: 'Nice', type: 'single',
            rarity: 'epic', clue: 'Some numbers are... memorable.',
            desc: 'Finish a game where the score contains "69" (e.g. 169, 690, 6983…). Score must be ≥ 100.',
            svgIcon: `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="10" r="1.2" fill="currentColor"/><path d="M14 9.5c0.8-0.8 2.2-0.8 3 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7.5 15c1.5 2.5 6.5 2.5 8 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
            check: g => String(g.score).includes('69') && g.score >= 100,
        },
        {
            id: 'sec_turtle', cat: 'secret', name: 'Lazy Stack', type: 'single',
            rarity: 'common', clue: 'Plenty of pieces. Nothing to show for it.',
            desc: 'Place 80 pieces but score under 200.',
            svgIcon: `<g transform="scale(0.046875)" fill="currentColor"><path d="M73.083,165.387c-3.182-2.652-7.91-2.225-10.565,0.956c-7.83,9.389-14.527,19.715-19.903,30.693c-1.823,3.723-0.327,8.306,3.437,10.037c3.703,1.703,8.733-0.778,10.036-3.438c4.85-9.902,10.89-19.216,17.952-27.683C76.692,172.77,76.265,168.041,73.083,165.387z"/><path d="M470.605,117.376c22.823,0,41.391-18.567,41.391-41.391c0-22.823-18.568-41.39-41.391-41.39s-41.39,18.567-41.39,41.39c0,15.412,8.473,28.874,21,35.998l-12.535,35.222c-3.346-0.938-7.022-1.515-11.03-1.515c-4.413,0-9.925,0.728-15.903,3.193L397.551,111.8c12.352-7.169,20.682-20.533,20.682-35.815c0-22.823-18.568-41.39-41.391-41.39s-41.391,18.567-41.391,41.39s18.568,41.391,41.391,41.391c2.24,0,4.437-0.185,6.581-0.529l14.284,40.137c-1.708,1.461-3.419,3.094-5.118,4.935c-11.226,12.153-17.432,26.705-18.445,43.253c-0.813,13.284-3.496,24.478-8.111,33.859c-30.619-91.293-126.738-145.883-222.146-123.09c-19.369,4.629-37.323,12.818-53.363,24.342c-3.365,2.416-4.133,7.104-1.715,10.469c2.416,3.364,7.105,4.133,10.469,1.715c14.449-10.381,30.631-17.76,48.097-21.934c45.001-10.755,91.498-3.338,130.921,20.879c38.613,23.719,65.916,60.774,77.127,104.57c-2.944,5.12-11.145,18.02-25.201,30.229c-21.583,18.746-47.12,27.966-76.02,27.477c2.563-14.609,2.136-29.67-1.347-44.247c-11.386-47.649-59.414-77.15-107.061-65.765c-18.857,4.506-34.827,16.084-44.974,32.602c-10.147,16.519-13.253,36-8.748,54.855c7.632,31.943,39.829,51.721,71.774,44.089c4.029-0.963,6.516-5.011,5.553-9.039c-0.963-4.03-5.011-6.516-9.039-5.553c-23.898,5.71-47.985-9.086-53.695-32.983c-3.575-14.957-1.109-30.412,6.94-43.516c8.048-13.103,20.718-22.289,35.677-25.862c39.602-9.464,78.237,15.385,88.983,54.659c5.025,18.363,5.025,86.374-62.016,102.847c-57.918,14.231-116.476-22.057-130.335-80.062c-4.63-19.372-5.031-39.021-1.195-58.398c0.804-4.064-1.838-8.01-5.902-8.814c-4.063-0.81-8.01,1.838-8.814,5.902c-4.258,21.509-3.814,43.311,1.32,64.797c8.293,34.704,30.614,62.444,59.504,78.688c-43.883,18.117-75.193,29.557-75.537,29.683c-0.36,0.132-17.704,7.241-15.001,28.587c1.436,11.339,10.298,20.505,21.475,22.889c3.517,0.75,87.2,18.353,181.959,18.355c70.365,0,128.527-9.781,172.869-29.071c28.731-12.498,52.016-29.185,69.21-49.595c19.58-23.239,31.377-51.301,35.059-83.367c0.298-2.476,2.896-25.007,2.414-53.319c-0.703-41.28-7.567-73.604-20.402-96.073c-0.575-1.006-4.879-8.956-11.607-12.179l13.128-36.887C466.415,117.215,468.492,117.376,470.605,117.376z M376.844,102.374c-14.574,0-26.388-11.814-26.388-26.388c0-14.573,11.814-26.387,26.388-26.387c14.574,0,26.388,11.814,26.388,26.387S391.418,102.374,376.844,102.374z M468.268,262.303c0.466,27.312-2.023,48.898-2.313,51.31c-3.345,29.124-13.986,54.51-31.631,75.453c-15.692,18.626-37.132,33.936-63.723,45.504c-42.443,18.463-98.59,27.825-166.899,27.825c-93.18-0.002-175.363-17.289-178.815-18.024c-5.081-1.083-9.003-5.265-9.762-10.405c-0.733-4.973,1.63-9.941,5.908-12.526c5.077-1.867,41.085-15.201,88.369-35.037c13.192,4.773,27.274,7.35,41.706,7.348c9.444-0.001,19.046-1.098,28.625-3.387c32.111-7.674,58.557-31.095,70.266-61.798c42.872,1.832,72.784-15.878,90.555-31.462c20.05-17.585,42.922-44.85,48.568-91.016c1.582-12.936,5.672-24.444,14.491-33.992c8.707-9.427,17.336-11.524,23.039-11.406c15.834,0.327,22.928,12.27,23.189,12.726C461.408,193.669,467.608,223.574,468.268,262.303z M444.218,75.986c-0.464-14.565,11.814-26.387,26.387-26.387c14.573,0,26.388,11.814,26.388,26.387s-11.814,26.388-26.388,26.388C468.166,102.374,444.985,100.093,444.218,75.986z"/><path d="M328.389,263.556c-3.492-24.092-14.072-45.671-31.449-64.138c-2.839-3.018-7.587-3.163-10.604-0.322c-3.016,2.838-3.161,7.586-0.322,10.604c15.224,16.181,24.486,35.025,27.526,56.01c0.542,3.736,3.748,6.426,7.414,6.426c0.358,0,0.721-0.025,1.086-0.079C326.141,271.461,328.983,267.657,328.389,263.556z"/><path d="M274.127,179.817c-16.016-11.176-29.364-16.054-29.925-16.256c-3.894-1.405-8.195,0.613-9.602,4.511c-1.406,3.898,0.614,8.196,4.511,9.602c0.118,0.043,12.026,4.395,26.43,14.446c1.307,0.913,2.805,1.351,4.286,1.351c2.368,0,4.7-1.119,6.158-3.211C278.357,186.865,277.524,182.188,274.127,179.817z"/><path d="M376.843,59.599c-9.034,0-16.386,7.351-16.386,16.387c0,9.034,7.351,16.386,16.386,16.386c9.035,0,16.387-7.35,16.387-16.386C393.229,66.95,385.878,59.599,376.843,59.599z"/><path d="M470.605,59.599c-9.034,0-16.386,7.351-16.386,16.387c0,9.034,7.351,16.386,16.386,16.386c9.035,0,16.387-7.35,16.387-16.386C486.992,66.95,479.64,59.599,470.605,59.599z"/></g>`,
            check: g => g.blocks >= 80 && g.score < 200,
        },
        {
            id: 'sec_palindrome', cat: 'secret', name: 'Look Backwards', type: 'single',
            rarity: 'rare', clue: 'Symmetry in numbers.',
            desc: 'End with a palindrome score.',
            svgIcon: `<rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" opacity="0.7"/><rect x="13" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="13" width="8" height="8" rx="1" fill="currentColor" opacity="0.7"/>`,
            check: g => { const s = String(g.score); return s.length > 1 && s === s.split('').reverse().join(''); },
        },
        {
            id: 'sec_420', cat: 'secret', name: 'Smoke Break', type: 'single',
            rarity: 'common', clue: 'A legendary number lurks.',
            desc: 'Achieve a score of exactly 420.',
            svgIcon: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="none" stroke="#FF7700" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="#FF7700" opacity="0.2" stroke="none"/>`,
            check: g => g.score === 420,
        },
        // ── NEW VISIBLE TIERED ────────────────────────────────────────────────
        {
            id: 'survival', cat: 'basic', name: 'Survivor', type: 'tiered',
            svgIcon: `<path d="M12 2l8 3v6c0 5-4 8.5-8 10-4-1.5-8-5-8-10V5l8-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
            counter: { path:'stats.bestSurvivalTime', label:'Longest Game', fmt:'time' },
            tiers: [
                { rarity:'common',    name:'Enduring',      desc:'Survive for 3 minutes',  check: g => g.time >= 180, progressDisplay:{ path:'stats.bestSurvivalTime', target:180 } },
                { rarity:'rare',      name:'Barely Alive',  desc:'Survive for 5 minutes',  check: g => g.time >= 300, progressDisplay:{ path:'stats.bestSurvivalTime', target:300 } },
                { rarity:'epic',      name:'Never Give Up', desc:'Survive for 7 minutes',  check: g => g.time >= 420, progressDisplay:{ path:'stats.bestSurvivalTime', target:420 } },
                { rarity:'legendary', name:'Nine Lives',    desc:'Survive for 9 minutes',  check: g => g.time >= 540, progressDisplay:{ path:'stats.bestSurvivalTime', target:540 } },
                { rarity:'mythic',    name:'Eternal',       desc:'Survive for 11 minutes', check: g => g.time >= 660, progressDisplay:{ path:'stats.bestSurvivalTime', target:660 } },
            ],
        },
        {
            id: 'speed_placer', cat: 'basic', name: 'Rapid Fire', type: 'tiered',
            svgIcon: `<line x1="5" y1="2" x2="5" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="2 7 5 11 8 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="14" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="15 10 15 14 18 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
            counter: { path:'stats.bestBlocksIn60s', label:'Best (pieces/60s)' },
            tiers: [
                { rarity:'rare',      name:'Fast Fingers', desc:'Place 50 pieces in 60 seconds',  check: g => g.maxBlocksIn60s >= 50,  progressDisplay:{ path:'stats.bestBlocksIn60s', target:50  } },
                { rarity:'epic',      name:'On Fire',      desc:'Place 75 pieces in 60 seconds',  check: g => g.maxBlocksIn60s >= 75,  progressDisplay:{ path:'stats.bestBlocksIn60s', target:75  } },
                { rarity:'legendary', name:'Machine Gun',  desc:'Place 100 pieces in 60 seconds', check: g => g.maxBlocksIn60s >= 100, progressDisplay:{ path:'stats.bestBlocksIn60s', target:100 } },
            ],
        },
        {
            id: 'total_blocks', cat: 'basic', name: 'Builder', type: 'tiered',
            svgIcon: `<g transform="scale(0.046875)"><rect x="16.568" y="367.165" fill="#F9D84E" width="68.409" height="68.409"/><rect x="16.568" y="418.472" fill="#FFC20D" width="68.409" height="17.102"/><rect x="16.568" y="367.165" fill="#FFC20D" width="17.102" height="68.409"/><rect x="84.977" y="367.165" fill="#F9D84E" width="68.409" height="68.409"/><rect x="84.977" y="418.472" fill="#FFC20D" width="68.409" height="17.102"/><rect x="84.977" y="367.165" fill="#FFC20D" width="17.102" height="68.409"/><rect x="84.977" y="298.756" fill="#F9D84E" width="68.409" height="68.409"/><rect x="84.977" y="350.063" fill="#FFC20D" width="68.409" height="17.102"/><rect x="84.977" y="298.756" fill="#FFC20D" width="17.102" height="68.409"/><rect x="16.568" y="298.756" fill="#F9D84E" width="68.409" height="68.409"/><rect x="16.568" y="350.063" fill="#FFC20D" width="68.409" height="17.102"/><rect x="16.568" y="298.756" fill="#FFC20D" width="17.102" height="68.409"/><rect x="16.568" y="435.574" fill="#B169BF" width="68.409" height="68.409"/><rect x="16.568" y="435.574" fill="#844A8F" width="17.102" height="68.409"/><rect x="16.568" y="486.881" fill="#844A8F" width="68.409" height="17.102"/><rect x="84.977" y="435.574" fill="#B169BF" width="68.409" height="68.409"/><rect x="84.977" y="435.574" fill="#844A8F" width="17.102" height="68.409"/><rect x="84.977" y="486.881" fill="#844A8F" width="68.409" height="17.102"/><rect x="153.386" y="435.574" fill="#B169BF" width="68.409" height="68.409"/><rect x="153.386" y="435.574" fill="#844A8F" width="17.102" height="68.409"/><rect x="153.386" y="486.881" fill="#844A8F" width="68.409" height="17.102"/><rect x="221.795" y="435.574" fill="#B169BF" width="68.409" height="68.409"/><rect x="221.795" y="435.574" fill="#844A8F" width="17.102" height="68.409"/><rect x="221.795" y="486.881" fill="#844A8F" width="68.409" height="17.102"/><rect x="221.795" y="367.165" fill="#FD5E95" width="68.409" height="68.409"/><rect x="221.795" y="418.472" fill="#D14D7B" width="68.409" height="17.102"/><rect x="221.795" y="367.165" fill="#D14D7B" width="17.102" height="68.409"/><rect x="290.205" y="367.165" fill="#FD5E95" width="68.409" height="68.409"/><rect x="290.205" y="418.472" fill="#D14D7B" width="68.409" height="17.102"/><rect x="290.205" y="367.165" fill="#D14D7B" width="17.102" height="68.409"/><rect x="290.205" y="435.574" fill="#FD5E95" width="68.409" height="68.409"/><rect x="290.205" y="486.881" fill="#D14D7B" width="68.409" height="17.102"/><rect x="290.205" y="435.574" fill="#D14D7B" width="17.102" height="68.409"/><rect x="358.614" y="435.574" fill="#FD5E95" width="68.409" height="68.409"/><rect x="358.614" y="486.881" fill="#D14D7B" width="68.409" height="17.102"/><rect x="358.614" y="435.574" fill="#D14D7B" width="17.102" height="68.409"/><rect x="256" y="8.017" fill="#FD5E95" width="68.409" height="68.409"/><rect x="256" y="59.324" fill="#D14D7B" width="68.409" height="17.102"/><rect x="256" y="8.017" fill="#D14D7B" width="17.102" height="68.409"/><rect x="324.409" y="8.017" fill="#FD5E95" width="68.409" height="68.409"/><rect x="324.409" y="59.324" fill="#D14D7B" width="68.409" height="17.102"/><rect x="324.409" y="8.017" fill="#D14D7B" width="17.102" height="68.409"/><rect x="324.409" y="76.426" fill="#FD5E95" width="68.409" height="68.409"/><rect x="324.409" y="127.733" fill="#D14D7B" width="68.409" height="17.102"/><rect x="324.409" y="76.426" fill="#D14D7B" width="17.102" height="68.409"/><rect x="392.818" y="76.426" fill="#FD5E95" width="68.409" height="68.409"/><rect x="392.818" y="127.733" fill="#D14D7B" width="68.409" height="17.102"/><rect x="392.818" y="76.426" fill="#D14D7B" width="17.102" height="68.409"/><rect x="358.614" y="367.165" fill="#7DBB34" width="68.409" height="68.409"/><rect x="358.614" y="418.472" fill="#60A333" width="68.409" height="17.102"/><rect x="358.614" y="367.165" fill="#60A333" width="17.102" height="68.409"/><rect x="427.023" y="367.165" fill="#7DBB34" width="68.409" height="68.409"/><rect x="427.023" y="418.472" fill="#60A333" width="68.409" height="17.102"/><rect x="427.023" y="367.165" fill="#60A333" width="17.102" height="68.409"/><rect x="427.023" y="435.574" fill="#7DBB34" width="68.409" height="68.409"/><rect x="427.023" y="486.881" fill="#60A333" width="68.409" height="17.102"/><rect x="427.023" y="435.574" fill="#60A333" width="17.102" height="68.409"/><rect x="358.614" y="298.756" fill="#7DBB34" width="68.409" height="68.409"/><rect x="358.614" y="350.063" fill="#60A333" width="68.409" height="17.102"/><rect x="358.614" y="298.756" fill="#60A333" width="17.102" height="68.409"/><rect x="153.386" y="127.733" fill="#45CAE0" width="68.409" height="68.409"/><rect x="153.386" y="179.04" fill="#0AADBF" width="68.409" height="17.102"/><rect x="153.386" y="127.733" fill="#0AADBF" width="17.102" height="68.409"/><rect x="153.386" y="196.142" fill="#45CAE0" width="68.409" height="68.409"/><rect x="153.386" y="247.449" fill="#0AADBF" width="68.409" height="17.102"/><rect x="153.386" y="196.142" fill="#0AADBF" width="17.102" height="68.409"/><rect x="221.795" y="196.142" fill="#45CAE0" width="68.409" height="68.409"/><rect x="221.795" y="247.449" fill="#0AADBF" width="68.409" height="17.102"/><rect x="221.795" y="196.142" fill="#0AADBF" width="17.102" height="68.409"/><rect x="153.386" y="264.551" fill="#45CAE0" width="68.409" height="68.409"/><rect x="153.386" y="315.858" fill="#0AADBF" width="68.409" height="17.102"/><rect x="153.386" y="264.551" fill="#0AADBF" width="17.102" height="68.409"/><path fill="#000000" d="M256,84.443h60.392v60.392c0,4.428,3.588,8.017,8.017,8.017h136.818c4.428,0,8.017-3.588,8.017-8.017V76.426c0-4.428-3.588-8.017-8.017-8.017h-60.392V8.017c0-4.428-3.588-8.017-8.017-8.017H256c-4.427,0-8.017,3.588-8.017,8.017v68.409C247.983,80.854,251.573,84.443,256,84.443z M332.426,84.443h52.376v52.376h-52.376V84.443z M453.211,136.818h-52.376V84.443h52.376V136.818z M384.802,68.409h-52.376V16.033h52.376V68.409z M264.017,16.033h52.376v52.376h-52.376V16.033z"/><path fill="#000000" d="M495.432,359.148H435.04v-60.392c0-4.428-3.588-8.017-8.017-8.017h-68.409c-4.428,0-8.017,3.588-8.017,8.017v60.392h-9.086c-4.428,0-8.017,3.588-8.017,8.017c0,4.428,3.588,8.017,8.017,8.017h9.086v52.376h-52.376v-52.376h9.086c4.428,0,8.017-3.588,8.017-8.017c0-4.428-3.588-8.017-8.017-8.017h-85.511c-4.427,0-8.017,3.588-8.017,8.017v60.392h-52.376v-86.58h60.392c4.427,0,8.017-3.588,8.017-8.017v-60.392h60.392c4.428,0,8.017-3.588,8.017-8.017v-68.409c0-4.428-3.588-8.017-8.017-8.017h-60.392v-60.392c0-4.428-3.589-8.017-8.017-8.017h-68.409c-4.427,0-8.017,3.588-8.017,8.017v17.102c0,4.428,3.589,8.017,8.017,8.017c4.427,0,8.017-3.588,8.017-8.017v-9.086h52.376v52.376h-52.376v-9.086c0-4.428-3.589-8.017-8.017-8.017c-4.427,0-8.017,3.588-8.017,8.017v111.699H67.875c-4.427,0-8.017,3.588-8.017,8.017s3.589,8.017,8.017,8.017h9.086v52.376H24.585v-52.376h9.086c4.427,0,8.017-3.588,8.017-8.017s-3.589-8.017-8.017-8.017H16.568c-4.427,0-8.017,3.588-8.017,8.017v205.228c0,4.428,3.589,8.017,8.017,8.017h478.864c4.428,0,8.017-3.588,8.017-8.017V367.165C503.449,362.737,499.861,359.148,495.432,359.148z M487.415,427.557H435.04v-52.376h52.376V427.557z M366.63,375.182h52.376v52.376H366.63V375.182z M366.63,306.772h52.376v52.376H366.63V306.772z M229.812,375.182h52.376v52.376h-52.376V375.182z M92.994,375.182h52.376v52.376H92.994V375.182z M213.779,324.944h-52.376v-52.376h52.376V324.944z M282.188,256.534h-52.376v-52.376h52.376V256.534z M213.779,204.159v52.376h-52.376v-52.376H213.779z M145.37,359.148H92.994v-52.376h52.376V359.148z M76.96,375.182v52.376H24.585v-52.376H76.96z M24.585,443.591H76.96v52.376H24.585V443.591z M92.994,443.591h52.376v52.376H92.994V443.591z M161.403,443.591h52.376v52.376h-52.376V443.591z M229.812,443.591h52.376v52.376h-52.376V443.591z M298.221,443.591h52.376v52.376h-52.376V443.591z M366.63,443.591h52.376v52.376H366.63V443.591z M487.415,495.967H435.04v-52.376h52.376V495.967z"/></g>`,
            counter: { path:'stats.totalBlocksPlaced', label:'Total Placed', unit:'pieces' },
            tiers: [
                { rarity:'common',    name:'Bricklayer', desc:'Place 500 pieces total',     progress:{ path:'stats.totalBlocksPlaced', target:500   } },
                { rarity:'rare',      name:'Sculptor',   desc:'Place 2,000 pieces total',   progress:{ path:'stats.totalBlocksPlaced', target:2000  } },
                { rarity:'epic',      name:'Mason',      desc:'Place 7,000 pieces total',   progress:{ path:'stats.totalBlocksPlaced', target:7000  } },
                { rarity:'legendary', name:'Architect',  desc:'Place 25,000 pieces total',  progress:{ path:'stats.totalBlocksPlaced', target:25000 } },
                { rarity:'mythic',    name:'Monument',   desc:'Place 100,000 pieces total', progress:{ path:'stats.totalBlocksPlaced', target:100000 } },
            ],
        },
        {
            id: 'total_lines', cat: 'basic', name: 'Line Breaker', type: 'tiered',
            svgIcon: `<line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2" stroke-linecap="round"/>`,
            counter: { path:'stats.totalLinesCleared', label:'Total Cleared', unit:'lines' },
            tiers: [
                { rarity:'common',    name:'Sweeper',     desc:'Clear 100 lines total',    progress:{ path:'stats.totalLinesCleared', target:100   } },
                { rarity:'rare',      name:'Cleaner',     desc:'Clear 500 lines total',    progress:{ path:'stats.totalLinesCleared', target:500   } },
                { rarity:'epic',      name:'Eraser',      desc:'Clear 2,000 lines total',  progress:{ path:'stats.totalLinesCleared', target:2000  } },
                { rarity:'legendary', name:'Destroyer',   desc:'Clear 7,500 lines total',  progress:{ path:'stats.totalLinesCleared', target:7500  } },
                { rarity:'mythic',    name:'Annihilator', desc:'Clear 30,000 lines total', progress:{ path:'stats.totalLinesCleared', target:30000 } },
            ],
        },
        {
            id: 'speedrunner', cat: 'basic', name: 'Speedrunner', type: 'tiered',
            svgIcon: `<circle cx="12" cy="14" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="12 10 12 14 15 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="3" x2="12" y2="7" stroke="currentColor" stroke-width="1.5"/>`,
            counter: { path:'stats.bestSpeedrunnerTime', label:'Best Time (10 lines)', fmt:'time' },
            tiers: [
                { rarity:'common',    name:'Runner',    desc:'Clear 10 lines in under 1 minute',   check: g => g.speedrunner <= 60,  progressDisplay:{ path:'stats.bestSpeedrunnerTime', target:60  } },
                { rarity:'rare',      name:'Swift',     desc:'Clear 10 lines in under 50 seconds', check: g => g.speedrunner <= 50,  progressDisplay:{ path:'stats.bestSpeedrunnerTime', target:50  } },
                { rarity:'epic',      name:'Flash',     desc:'Clear 10 lines in under 40 seconds', check: g => g.speedrunner <= 40,  progressDisplay:{ path:'stats.bestSpeedrunnerTime', target:40  } },
                { rarity:'legendary', name:'Supersonic',desc:'Clear 10 lines in under 30 seconds', check: g => g.speedrunner <= 30,  progressDisplay:{ path:'stats.bestSpeedrunnerTime', target:30  } },
            ],
        },
        {
            id: 'quad_count', cat: 'basic', name: 'Four at Once', type: 'tiered',
            svgIcon: `<rect x="2" y="3.5" width="20" height="3" rx="1" fill="currentColor" opacity="0.4"/><rect x="2" y="8.5" width="20" height="3" rx="1" fill="currentColor" opacity="0.6"/><rect x="2" y="13.5" width="20" height="3" rx="1" fill="currentColor" opacity="0.8"/><rect x="2" y="18.5" width="20" height="3" rx="1" fill="currentColor"/><line x1="3" y1="22" x2="21" y2="2" stroke="#ff3333" stroke-width="2" stroke-linecap="round"/>`,
            counter: { path:'stats.totalQuads', label:'Total Quads', unit:'clears' },
            tiers: [
                { rarity:'common',    name:'Four and Done',    desc:'Clear 4 lines at once 10 times total',  progress:{ path:'stats.totalQuads', target:10  } },
                { rarity:'rare',      name:'Clear Obsessed',   desc:'Clear 4 lines at once 50 times total',  progress:{ path:'stats.totalQuads', target:50  } },
                { rarity:'epic',      name:'Quad Century',     desc:'Clear 4 lines at once 100 times total', progress:{ path:'stats.totalQuads', target:100 } },
                { rarity:'legendary', name:'Quarter K',        desc:'Clear 4 lines at once 250 times total', progress:{ path:'stats.totalQuads', target:250 } },
            ],
        },
        {
            id: 'combo_master', cat: 'basic', name: 'Combo', type: 'tiered',
            svgIcon: `<polyline points="3 20 7 16 11 18 15 10 19 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="15 6 19 6 19 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
            counter: { path:'stats.maxCombo', label:'Best Combo', fmt:'combo' },
            tiers: [
                { rarity:'common',    name:'First Hits',        desc:'Reach combo ×5',  progress:{ path:'stats.maxCombo', target:5  } },
                { rarity:'rare',      name:'Just Warming Up',   desc:'Reach combo ×7',  progress:{ path:'stats.maxCombo', target:7  } },
                { rarity:'epic',      name:'Not Stoping Now',   desc:'Reach combo ×9',  progress:{ path:'stats.maxCombo', target:9  } },
                { rarity:'legendary', name:'Infinite Chain',    desc:'Reach combo ×11', progress:{ path:'stats.maxCombo', target:11 } },
            ],
        },
        {
            id: 'high_placer', cat: 'basic', name: 'Floor Dweller', type: 'tiered',
            svgIcon: `<rect x="2" y="2" width="20" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="5" y="15" width="4" height="4" fill="currentColor" opacity="0.7"/><rect x="10" y="13" width="4" height="6" fill="currentColor" opacity="0.7"/><rect x="15" y="16" width="4" height="3" fill="currentColor" opacity="0.7"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2" opacity="0.4"/>`,
            counter: { path:'stats.bestHighPlacer', label:'Best (in one game)', unit:'pieces' },
            tiers: [
                { rarity:'rare',      name:'Low Life',       desc:'Place 50 pieces fully in the bottom half (one game)',  check: g => g.highPlacer >= 50  },
                { rarity:'epic',      name:'Subterranean',   desc:'Place 100 pieces fully in the bottom half (one game)', check: g => g.highPlacer >= 100 },
                { rarity:'legendary', name:'The Undertaker', desc:'Place 200 pieces fully in the bottom half (one game)', check: g => g.highPlacer >= 200 },
            ],
        },
        {
            id: 'booster_user', cat: 'basic', name: 'Boosted', type: 'tiered',
            svgIcon: `<path d="M7 17l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 11l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2"/>`,
            counter: { path:'stats.totalBoostersUsed', label:'Boosters Used' },
            tiers: [
                { rarity:'common',    name:'All In',             desc:'Use 3 score boosters',  progress:{ path:'stats.totalBoostersUsed', target:3  } },
                { rarity:'rare',      name:'Stronger Than Ever', desc:'Use 6 score boosters',  progress:{ path:'stats.totalBoostersUsed', target:6  } },
                { rarity:'epic',      name:'Juiced',             desc:'Use 12 score boosters', progress:{ path:'stats.totalBoostersUsed', target:12 } },
                { rarity:'legendary', name:'Supercharged',       desc:'Use 24 score boosters', progress:{ path:'stats.totalBoostersUsed', target:24 } },
            ],
        },
        {
            id: 'fun_score', cat: 'basic', name: 'Fun Run', type: 'tiered',
            svgIcon: `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`,
            counter: { path:'stats.bestFunScore', label:'Fun Mode Best' },
            tiers: [
                { rarity:'common',    name:'Just for Fun',      desc:'Reach 500 score in Fun Mode',   check: g => g.mode === 'fun' && g.score >= 500,  progressDisplay:{ path:'stats.bestFunScore', target:500  } },
                { rarity:'rare',      name:'Vibing',            desc:'Reach 1,000 score in Fun Mode', check: g => g.mode === 'fun' && g.score >= 1000, progressDisplay:{ path:'stats.bestFunScore', target:1000 } },
                { rarity:'epic',      name:'Committed Casual',  desc:'Reach 2,000 score in Fun Mode', check: g => g.mode === 'fun' && g.score >= 2000, progressDisplay:{ path:'stats.bestFunScore', target:2000 } },
                { rarity:'legendary', name:'Fun Overdose',      desc:'Reach 5,000 score in Fun Mode', check: g => g.mode === 'fun' && g.score >= 5000, progressDisplay:{ path:'stats.bestFunScore', target:5000 } },
            ],
        },
        {
            id: 'tetris_lines', cat: 'basic', name: 'I-Piece Devotion', type: 'tiered',
            svgIcon: `<rect x="2" y="10" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="10" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="12" y="10" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="17" y="10" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
            counter: { path:'stats.bestIPieceLines', label:'Best (one game)', unit:'I-lines' },
            tiers: [
                { rarity:'common', name:'Straight Shot',     desc:'Clear 2 lines using I-pieces in one game',  check: g => g.iPieceLines >= 2  },
                { rarity:'rare',   name:'Bar Lover',         desc:'Clear 5 lines using I-pieces in one game',  check: g => g.iPieceLines >= 5  },
                { rarity:'epic',   name:'Strictly Vertical', desc:'Clear 10 lines using I-pieces in one game', check: g => g.iPieceLines >= 10 },
            ],
        },
        {
            id: 'daily_streak', cat: 'basic', name: 'Day by Day', type: 'tiered',
            svgIcon: `<rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><text x="12" y="17" text-anchor="middle" font-size="7" fill="currentColor" font-family="sans-serif" font-weight="bold">🔥</text>`,
            counter: { path:'missions.streaks.bestDaily', label:'Best Streak', unit:'days' },
            tiers: [
                { rarity:'common',    name:'Consistent', desc:'Keep a 3-day XP streak',  progress:{ path:'missions.streaks.daily', target:3  } },
                { rarity:'rare',      name:'Dedicated',  desc:'Keep a 6-day XP streak',  progress:{ path:'missions.streaks.daily', target:6  } },
                { rarity:'epic',      name:'Committed',  desc:'Keep an 11-day XP streak', progress:{ path:'missions.streaks.daily', target:11 } },
                { rarity:'legendary', name:'Addicted',   desc:'Keep a 21-day XP streak', progress:{ path:'missions.streaks.daily', target:21 } },
            ],
        },
        // ── NEW VISIBLE SINGLE ────────────────────────────────────────────────
        {
            id: 'board_clear', cat: 'basic', name: 'Clean Sweep', type: 'single',
            rarity: 'epic', desc: 'Clear the entire board — not a single block remains.',
            svgIcon: `<rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="8" x2="21" y2="8" stroke="currentColor" stroke-width="1" opacity="0.3"/><line x1="3" y1="13" x2="21" y2="13" stroke="currentColor" stroke-width="1" opacity="0.3"/><line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="1" opacity="0.3"/><line x1="8" y1="3" x2="8" y2="21" stroke="currentColor" stroke-width="1" opacity="0.3"/><line x1="13" y1="3" x2="13" y2="21" stroke="currentColor" stroke-width="1" opacity="0.3"/><line x1="18" y1="3" x2="18" y2="21" stroke="currentColor" stroke-width="1" opacity="0.3"/><path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
            check: g => g.boardCleared,
        },
        {
            id: 'top_line', cat: 'basic', name: 'Sky High', type: 'single',
            rarity: 'epic', desc: 'Clear the very top row of the board.',
            svgIcon: `<rect x="3" y="3" width="18" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="3" width="18" height="4" rx="1" fill="currentColor" opacity="0.2"/><path d="M12 11v6M9 14l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="3" y1="21" x2="21" y2="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
            check: g => g.clearedTopLine,
        },
        {
            id: 'level_101', cat: 'secret', name: 'Is This the End?', type: 'single',
            rarity: 'legendary', clue: 'What lies beyond the highest peak?',
            desc: 'Reach the highest rank.',
            svgIcon: `<polygon points="12,2 15,9 22,9 16,13.5 18.5,21 12,16.5 5.5,21 8,13.5 2,9 9.5,9" fill="#7700cc" opacity="0.25"/><polygon points="12,2 15,9 22,9 16,13.5 18.5,21 12,16.5 5.5,21 8,13.5 2,9 9.5,9" fill="none" stroke="#ff0099" stroke-width="2.5" opacity="0.4"/><polygon points="12,2 15,9 22,9 16,13.5 18.5,21 12,16.5 5.5,21 8,13.5 2,9 9.5,9" fill="none" stroke="#ffd700" stroke-width="1.5"/><polygon points="12,6 13.5,10.5 18,10.5 14.5,13 15.5,17.5 12,15 8.5,17.5 9.5,13 6,10.5 10.5,10.5" fill="#ffd700" opacity="0.95"/><polygon points="12,6 13.5,10.5 18,10.5 14.5,13 15.5,17.5 12,15 8.5,17.5 9.5,13 6,10.5 10.5,10.5" fill="#ffffff" opacity="0.5"/>`,
            check: g => getLevelInfo(saveData.totalXP).isCelestite,
        },
        {
            id: 'daily_rare', cat: 'basic', name: 'Jackpot', type: 'tiered',
            svgIcon: `<path d="M20 12v10H4V12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M22 7H2v5h20V7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 22V7" stroke="currentColor" stroke-width="1.5"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
            counter: { path:'stats.rareItemsFromDailyBox', label:'Total Rare Items' },
            tiers: [
                { rarity:'common', name:'Lucky',   desc:'Get 10 rare+ items from any reward box', progress:{ path:'stats.rareItemsFromDailyBox', target:10 } },
                { rarity:'rare',   name:'Gambler', desc:'Get 20 rare+ items from any reward box', progress:{ path:'stats.rareItemsFromDailyBox', target:20 } },
                { rarity:'epic',   name:'Blessed', desc:'Get 30 rare+ items from any reward box', progress:{ path:'stats.rareItemsFromDailyBox', target:30 } },
            ],
        },
        // ── NEW HIDDEN ────────────────────────────────────────────────────────
        {
            id: 'sec_booster_waste', cat: 'secret', name: 'That Was Dumb', type: 'single',
            rarity: 'common', clue: 'Sometimes the math just... doesn\'t work out.',
            desc: 'Use the 2x XP booster on a score under 100. Just to flex.',
            svgIcon: `<g transform="scale(0.375)"><path d="M30.02,5c-8.18,0-14.81,6.63-14.81,14.81,0,5.56,3.12,10.66,8.07,13.19l8.05,6.25,10.43-10.41c1.99-2.59,3.07-5.76,3.07-9.03,0-8.18-6.63-14.81-14.81-14.81Z" fill="#f2d865"/><path d="M30.02,5c-.56,0-1.12,.03-1.66,.1,7.4,.83,13.15,7.1,13.15,14.71,0,3.27-1.08,6.44-3.07,9.03l-8.97,8.95,1.87,1.45,10.43-10.41c1.99-2.59,3.07-5.76,3.07-9.03,0-8.18-6.63-14.81-14.81-14.81h0Z" fill="#f2d865"/><path d="M14.44,33c-2.4,0-4.33,1.93-4.33,4.33s1.93,4.33,4.33,4.33v8.67c-2.4,0-4.33,1.94-4.33,4.34s1.93,4.33,4.33,4.33h20.3c1,0,1.93-.34,2.66-.91l-1.92-18.93-6.9-6.17H14.44Z" fill="#f2d865"/><path d="M26.04,50.33H14.45c-2.4,0-4.34-1.93-4.34-4.33s1.93-4.33,4.34-4.33h9.94l1.65,8.67Z" fill="#e9c03d"/><circle cx="39.08" cy="43.39" fill="#f5e680" r="14.81" transform="translate(-15.15 21.73) rotate(-26.22)"/><circle cx="39.08" cy="43.39" fill="#ebb680" r="8.12"/><circle cx="30.02" cy="19.81" fill="#ebb680" r="8.12" transform="translate(8.18 48.38) rotate(-86.02)"/><path d="M39.08,28.58c-.67,0-1.33,.05-1.99,.14,7.32,1.01,12.78,7.27,12.78,14.67,0,7.4-5.47,13.66-12.8,14.66,.67,.09,1.34,.14,2.01,.14,8.18,0,14.81-6.63,14.81-14.81s-6.63-14.81-14.81-14.81Z" fill="#f2d865"/><path d="M39.08,35.27c-.46,0-.9,.04-1.34,.11,3.85,.64,6.79,3.98,6.79,8.01s-2.94,7.37-6.79,8.01c.43,.07,.88,.11,1.34,.11,4.49,0,8.12-3.64,8.12-8.12s-3.63-8.12-8.12-8.12Z" fill="#e6a361"/><path d="M30.02,11.69c-.44,0-.87,.04-1.29,.1,3.87,.62,6.83,3.97,6.83,8.02s-2.96,7.4-6.83,8.02c.42,.07,.85,.1,1.29,.1,4.49,0,8.12-3.63,8.12-8.12s-3.64-8.12-8.12-8.12Z" fill="#e6a361"/><path d="M43.33,28.23c1.59-2.52,2.5-5.44,2.5-8.42,0-8.72-7.09-15.81-15.81-15.81s-15.81,7.09-15.81,15.81c0,4.81,2.17,9.22,5.79,12.19h-5.56c-2.94,0-5.33,2.39-5.33,5.33,0,1.79,.89,3.37,2.25,4.33-1.36,.97-2.25,2.55-2.25,4.33s.89,3.37,2.25,4.33c-1.35,.97-2.25,2.54-2.25,4.33,0,2.94,2.39,5.33,5.33,5.33h20.3c1.07,0,2.08-.35,2.95-.94,.46,.04,.91,.14,1.38,.14,8.72,0,15.81-7.09,15.81-15.81,0-7.24-4.91-13.29-11.56-15.15Zm-27.12-8.42c0-7.61,6.19-13.81,13.81-13.81s13.81,6.19,13.81,13.81c0,2.86-.93,5.66-2.59,7.99-.71-.1-1.42-.22-2.16-.22-4.23,0-8.07,1.7-10.91,4.42h-4.62c-4.53-2.4-7.34-7.04-7.34-12.19Zm-5.1,17.52c0-1.84,1.5-3.33,3.33-3.33h12c-1.44,1.94-2.46,4.19-2.89,6.67H14.44c-1.84,0-3.33-1.5-3.33-3.33Zm3.33,12c-1.84,0-3.33-1.5-3.33-3.33s1.5-3.33,3.33-3.33h8.91c-.01,.25-.07,.48-.07,.72,0,2.1,.43,4.11,1.18,5.94H14.44Zm0,8.67c-1.84,0-3.33-1.5-3.33-3.33s1.5-3.33,3.33-3.33h11.05c1.74,2.97,4.38,5.35,7.6,6.67H14.44Zm24.64-.8c-7.61,0-13.81-6.19-13.81-13.81s6.15-13.81,13.81-13.81,13.81,6.19,13.81,13.81-6.19,13.81-13.81,13.81Z"/><path d="M39.08,34.27c-5.03,0-9.12,4.09-9.12,9.12s4.09,9.12,9.12,9.12,9.12-4.09,9.12-9.12-4.09-9.12-9.12-9.12Zm0,16.24c-3.93,0-7.12-3.2-7.12-7.12s3.2-7.12,7.12-7.12,7.12,3.19,7.12,7.12-3.19,7.12-7.12,7.12Z"/><path d="M30.02,28.93c5.03,0,9.12-4.09,9.12-9.12s-4.09-9.12-9.12-9.12-9.12,4.09-9.12,9.12,4.09,9.12,9.12,9.12Zm0-16.24c3.93,0,7.12,3.2,7.12,7.12s-3.2,7.12-7.12,7.12-7.12-3.19-7.12-7.12,3.19-7.12,7.12-7.12Z"/><path d="M30.02,20.81c.4,0,.72,.32,.72,.72s-.32,.72-.72,.72c-.19,0-.37-.08-.51-.21-.39-.39-1.02-.39-1.41,0s-.39,1.02,0,1.41c.27,.27,.58,.46,.92,.6v.28c0,.55,.45,1,1,1s1-.45,1-1v-.29c1.01-.4,1.72-1.37,1.72-2.52,0-1.5-1.22-2.72-2.72-2.72-.4,0-.72-.32-.72-.72s.32-.72,.72-.72c.19,0,.38,.08,.51,.21,.39,.39,1.02,.39,1.41,0s.39-1.02,0-1.41c-.27-.27-.58-.46-.92-.6v-.28c0-.55-.45-1-1-1s-1,.45-1,1v.29c-1,.4-1.72,1.37-1.72,2.52,0,1.5,1.22,2.72,2.72,2.72Z"/><path d="M39.08,42.39c-.4,0-.72-.32-.72-.72s.32-.72,.72-.72c.19,0,.37,.07,.51,.21,.39,.39,1.02,.39,1.41,0s.39-1.02,0-1.41c-.27-.27-.58-.47-.92-.6v-.28c0-.55-.45-1-1-1s-1,.45-1,1v.29c-1,.4-1.72,1.37-1.72,2.52,0,1.5,1.22,2.72,2.72,2.72,.4,0,.72,.32,.72,.72s-.32,.72-.72,.72c-.19,0-.37-.08-.51-.21-.39-.39-1.02-.39-1.41,0s-.39,1.02,0,1.41c.27,.27,.58,.46,.92,.6v.28c0,.55,.45,1,1,1s1-.45,1-1v-.29c1-.4,1.72-1.37,1.72-2.52,0-1.5-1.22-2.72-2.72-2.72Z"/><circle cx="39.08" cy="31.92" r="1"/><circle cx="39.08" cy="54.85" r="1"/><circle cx="50.55" cy="43.39" r="1"/><circle cx="27.62" cy="43.39" r="1"/><path d="M47.9,35.99c.39-.39,.39-1.03,0-1.41-.39-.39-1.03-.39-1.41,0-.39,.39-.39,1.03,0,1.41s1.03,.39,1.41,0Z"/><path d="M30.27,50.79c-.39,.39-.39,1.03,0,1.41,.39,.39,1.03,.39,1.41,0,.39-.39,.39-1.03,0-1.41-.39-.39-1.03-.39-1.41,0Z"/><path d="M47.19,50.49c-.27,0-.52,.11-.71,.29-.39,.39-.39,1.03,0,1.41,.19,.19,.44,.29,.71,.29s.52-.11,.71-.29c.39-.39,.39-1.03,0-1.41-.19-.19-.44-.29-.71-.29Z"/><path d="M30.98,36.28c.26,0,.52-.11,.71-.29,.39-.39,.39-1.03,0-1.41-.19-.19-.44-.29-.71-.29s-.52,.11-.71,.29c-.39,.39-.39,1.03,0,1.41,.19,.19,.44,.29,.71,.29Z"/><circle cx="30.02" cy="8.34" r="1"/><circle cx="41.48" cy="19.81" r="1"/><circle cx="18.55" cy="19.81" r="1"/><path d="M38.83,12.41c.39-.39,.39-1.03,0-1.41-.39-.39-1.03-.39-1.41,0-.39,.39-.39,1.03,0,1.41s1.03,.39,1.41,0Z"/><path d="M21.2,27.21c-.39,.39-.39,1.03,0,1.41,.39,.39,1.03,.39,1.41,0,.39-.39,.39-1.03,0-1.41-.39-.39-1.03-.39-1.41,0Z"/><path d="M21.91,12.7c.27,0,.52-.11,.71-.29,.39-.39,.39-1.03,0-1.41-.19-.19-.44-.29-.71-.29s-.52,.11-.71,.29c-.39,.39-.39,1.03,0,1.41,.19,.19,.44,.29,.71,.29Z"/></g>`,
            check: () => false, // Unlocked directly in useScoreBooster
        },
        {
            id: 'sec_no_rotate', cat: 'secret', name: 'No Spin', type: 'single',
            rarity: 'rare', clue: 'Some pieces are perfect just the way they are.',
            desc: 'Place 100+ pieces in a single game without rotating once.',
            svgIcon: `<rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 11V7a4 4 0 018 0v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/>`,
            check: g => g.noRotate && g.blocks >= 100,
        },
        {
            id: 'sec_equal_pieces', cat: 'secret', name: 'Perfectly Balanced', type: 'single',
            rarity: 'epic', clue: 'All things in equal measure.',
            desc: 'Use all 7 piece types an equal number of times in one game (50+ pieces).',
            svgIcon: `<path transform="scale(0.046875)" fill="currentColor" d="M500.609,322.275l-57.428-162.834c0.135,0.008,0.279,0.025,0.406,0.025c39.538,0.677,49.422-20.58,54.566-27.94c7.118-10.171-7.91-20.343-15.816-13.558c-7.906,6.775-29.264,21.011-70.386,2.024C374.874,102.875,309.87,73.098,271.92,67.399v-39c0-8.799-7.127-15.921-15.918-15.921c-8.795,0-15.922,7.122-15.922,15.921v39c-37.95,5.699-102.953,35.476-140.031,52.593c-41.121,18.987-62.48,4.751-70.386-2.024c-7.906-6.784-22.935,3.388-15.816,13.558c5.145,7.36,15.028,28.617,54.566,27.94c0.132,0,0.276-0.017,0.402-0.025L11.391,322.275H0c11.497,38.025,46.804,65.736,88.595,65.736c41.786,0,77.093-27.711,88.59-65.736h-11.386l-60.355-171.134c37.183-11.467,89.569-31.056,134.636-34.072v24.23h-8.507v267.748H218.37v23.858c-8.715,0-17.569,0-24.874,0c-23.354,0-22.663,32.969-22.663,32.969c-19.233,0-28.85,15.101-28.85,33.648h228.033c0-18.546-9.616-33.648-28.845-33.648c0,0,0.686-32.969-22.668-32.969c-7.305,0-16.159,0-24.874,0v-23.858h-13.203V141.3h-8.507v-24.23c45.072,3.015,97.457,22.604,134.64,34.072l-60.358,171.134h-11.387c11.496,38.025,46.804,65.736,88.59,65.736c41.79,0,77.098-27.711,88.594-65.736H500.609z M141.243,322.275H35.948L88.595,173L141.243,322.275z M370.758,322.275L423.41,173l52.643,149.275H370.758z"/>`,
            check: g => g.equalPieces,
        },
        {
            id: 'sec_seven', cat: 'secret', name: 'Seven of Seven', type: 'single',
            rarity: 'rare', clue: 'Patterns repeat... seventy-seven times.',
            desc: 'Receive all 7 piece types in 7 consecutive turns, 77 times total across all games.',
            svgIcon: `<path transform="scale(1.71429)" fill="currentColor" d="m 12.324082,8.1685 -0.05633,0.1972 -0.211224,0.063 -0.213551,0.066 0.211224,0.061 0.211225,0.063 0.06098,0.2113 0.06098,0.2088 0.06575,-0.2112 0.06343,-0.2135 0.19947,-0.054 c 0.108,-0.03 0.190163,-0.063 0.178408,-0.073 -0.0094,-0.01 -0.08914,-0.035 -0.173633,-0.059 -0.08682,-0.021 -0.168979,-0.047 -0.183061,-0.056 -0.01408,-0.01 -0.04922,-0.096 -0.07739,-0.1925 -0.02816,-0.094 -0.05633,-0.1831 -0.06576,-0.1925 -0.0095,-0.01 -0.04004,0.07 -0.07053,0.1808 z M 1.483429,7.2203 C 1.413019,7.462 1.415349,7.455 1.382531,7.4668 c -0.01641,0 -0.110327,0.033 -0.206572,0.061 L 1,7.5818 1.197143,7.6428 c 0.110326,0.035 0.206571,0.078 0.218326,0.096 0.0094,0.019 0.04224,0.1126 0.07041,0.2089 l 0.05167,0.1761 0.05865,-0.1925 c 0.03282,-0.1057 0.07041,-0.2018 0.07984,-0.2112 0.01176,-0.01 0.105673,-0.045 0.211224,-0.078 L 2.079753,7.5811 1.892039,7.5271 C 1.788814,7.4961 1.694896,7.4641 1.680814,7.4521 1.669054,7.4401 1.629144,7.3418 1.596324,7.2362 L 1.535094,7.0437 1.483424,7.2197 Z M 5.623551,5.9365 C 5.316082,6.0398 4.952286,6.3379 4.839633,6.582 l -0.05633,0.122 -0.335633,0 -0.335632,0 L 3.75767,6.9834 C 2.929181,7.6359 2.497303,8.0935 2.236854,8.6004 2.023303,9.0182 1.955221,9.4241 2.030283,9.849 l 0.02584,0.1526 1.037388,0.01 1.037388,0 0.02584,-0.1338 C 4.245879,9.4248 4.457106,8.9484 4.757596,8.5188 4.921922,8.2841 4.940657,8.2466 4.978249,8.0636 5.104984,7.4557 5.464126,6.7586 5.949882,6.1743 6.083718,6.0147 6.118861,5.9607 6.095351,5.9467 6.029591,5.9087 5.7198,5.9047 5.623555,5.9347 Z M 12.432082,4.918 c -0.06808,0.075 -0.347388,0.2089 -0.521021,0.2511 -0.201796,0.049 -0.699428,0.052 -0.941143,0 L 10.798612,5.1361 10.582735,5.3614 C 10.324612,5.629 10.148531,5.8285 9.967796,6.0655 l -0.133714,0.1737 0.206571,0.066 c 0.227633,0.075 0.504612,0.1337 0.661837,0.1431 l 0.103224,0.01 L 10.432612,6.74 C 9.730857,7.2681 9.12302,7.8148 8.939959,8.0801 c -0.08216,0.1197 -0.180735,0.596 -0.201796,0.988 -0.01641,0.2722 0.0023,0.8449 0.02816,0.9153 0.0094,0.026 0.255795,0.03 1.377673,0.03 1.288531,0 1.363592,0 1.347184,-0.042 C 11.41612,9.7812 11.333955,9.4926 11.301016,9.3095 11.249346,9.0044 11.265746,8.3543 11.336286,8.0586 11.531102,7.2207 11.993469,6.4509 12.753878,5.6975 L 13,5.4536 12.739429,5.1625 C 12.596286,5.0053 12.478857,4.8739 12.476531,4.8739 c -0.0023,0 -0.02339,0.021 -0.04445,0.045 z m -11.162204,0.8355 0,0.9739 0.455265,0 c 0.431877,0 0.457714,0 0.471796,-0.044 0.02351,-0.075 0.345061,-0.3615 0.485877,-0.4319 0.07273,-0.038 0.187715,-0.073 0.262898,-0.08 l 0.131388,-0.014 0,-0.6806 0,-0.6806 -0.194816,0.012 c -0.131388,0.01 -0.241715,0.033 -0.347388,0.075 -0.08449,0.033 -0.176082,0.061 -0.204122,0.061 -0.06098,0 -0.122082,-0.059 -0.122082,-0.1197 0,-0.042 -0.02106,-0.045 -0.469347,-0.045 l -0.469469,0 0,0.9741 z m 2.065346,-0.6806 0,1.3729 0.640776,0 0.638327,0 0.0469,-0.082 C 4.719877,6.2535 5.015595,5.9742 5.194003,5.8592 5.597717,5.5965 5.900411,5.5893 6.635105,5.8242 7.095146,5.9697 7.346289,6.026 7.616166,6.0448 l 0.229959,0.014 -0.396734,0.2981 c -0.852,0.6336 -1.488,1.1687 -1.891592,1.5889 -0.849551,0.8848 -1.227429,1.7062 -1.182857,2.5699 0.0094,0.1572 0.03049,0.3474 0.0469,0.4248 l 0.03049,0.1408 2.189755,0.01 c 1.750898,0 2.187306,0 2.178,-0.023 C 8.587801,10.5378 8.477474,9.9887 8.475148,9.3667 8.472848,7.8506 9.174576,6.3932 10.566332,5.0155 L 10.934781,4.6517 10.573311,4.248 C 10.373842,4.025 10.204862,3.8443 10.19776,3.8443 c -0.0071,0 -0.05865,0.038 -0.110326,0.084 C 9.95127,4.0456 9.653229,4.1841 9.402087,4.2475 9.219025,4.2945 9.132209,4.3015 8.744903,4.2995 8.155801,4.2995 7.975066,4.2645 6.949434,3.9662 5.989556,3.6845 5.569434,3.6634 5.060168,3.8653 4.961598,3.9053 4.855923,3.9383 4.82776,3.9383 4.75735,3.9383 4.672862,3.8443 4.672862,3.767 l 0,-0.063 -0.668939,0 -0.668938,0 0,1.3731 z M 5.801837,4.1834 c 0.05633,0.068 -0.0047,0.1127 -0.183061,0.1409 -0.08914,0.012 -0.227633,0.049 -0.30747,0.077 -0.154898,0.059 -0.215877,0.045 -0.215877,-0.044 0,-0.061 0.04922,-0.092 0.239387,-0.1549 0.204245,-0.066 0.420123,-0.075 0.467021,-0.019 z m 0.267551,6.4049 0,0.07 -0.612612,0.01 c -0.657184,0.01 -0.69,0 -0.654858,-0.1127 0.01408,-0.047 0.02584,-0.047 0.640653,-0.042 l 0.626694,0.01 0,0.07 z M 8.827061,3.0826 c -0.02816,0.1009 -0.06331,0.1948 -0.07984,0.2089 -0.01408,0.014 -0.09392,0.045 -0.178408,0.068 -0.234734,0.063 -0.237061,0.07 -0.01408,0.1314 l 0.204122,0.056 0.06343,0.2112 0.06588,0.2089 0.054,-0.1854 c 0.03049,-0.1032 0.06331,-0.1994 0.07506,-0.2112 0.01176,-0.014 0.110327,-0.052 0.215878,-0.084 L 9.425593,3.4254 9.249511,3.3734 C 9.153271,3.3454 9.059348,3.3144 9.040613,3.3054 9.021883,3.2954 8.981963,3.2045 8.953793,3.1012 8.923303,3.0003 8.895143,2.9134 8.890363,2.9087 c -0.0045,0 -0.03269,0.075 -0.06331,0.1737 z"/>`,
            check: g => (g.luckySevenCount || 0) >= 77,
        },
        {
            id: 'sec_early_bird', cat: 'secret', name: 'Early Bird', type: 'single',
            rarity: 'rare', clue: 'The early bird catches the block.',
            desc: 'Play a game before 7 AM.',
            svgIcon: `<path fill="#FFD700" d="M12,6a6.006,6.006,0,0,1,6,6,1,1,0,0,1-2,0,4,4,0,0,0-8,0,1,1,0,0,1-2,0A6.006,6.006,0,0,1,12,6Zm1-2V3a1,1,0,0,0-2,0V4a1,1,0,0,0,2,0Zm5.364,1.292L17.657,6a1,1,0,0,0,1.414,1.415l.707-.707a1,1,0,0,0-1.414-1.416ZM19,12a1,1,0,0,0,1,1h1a1,1,0,0,0,0-2H20A1,1,0,0,0,19,12ZM2,12a1,1,0,0,0,1,1H4a1,1,0,0,0,0-2H3A1,1,0,0,0,2,12ZM4.221,5.293a1,1,0,0,0,0,1.415l.707.707A1,1,0,1,0,6.343,6l-.707-.708A1,1,0,0,0,4.221,5.293Z"/><path fill="#ffffff" d="M22,14H2a1,1,0,0,0,0,2H22a1,1,0,0,0,0-2Zm-2,4a1,1,0,0,0-1-1H5a1,1,0,0,0,0,2H19A1,1,0,0,0,20,18ZM8,20a1,1,0,0,0,0,2h8a1,1,0,0,0,0-2Z"/>`,
            check: g => g.earlyBird,
        },
        {
            id: 'sec_no_drop', cat: 'secret', name: 'Gentle', type: 'single',
            rarity: 'rare', clue: 'No rush. Let gravity do the work.',
            desc: 'Reach a score of 1,000+ without using hard drop once.',
            svgIcon: `<rect x="9" y="4" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="12" x2="12" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="9 17 12 20 15 17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
            check: g => g.score >= 1000 && g.noHardDrop,
        },
        {
            id: 'sec_all_drop', cat: 'secret', name: 'No Hesitation', type: 'single',
            rarity: 'epic', clue: 'Commitment at maximum velocity.',
            desc: 'Reach 1,000+ score hard-dropping every single piece.',
            svgIcon: `<rect x="9" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="11" x2="12" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="8 17 12 21 16 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="7" y1="13" x2="9" y2="15" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.5"/><line x1="17" y1="13" x2="15" y2="15" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.5"/>`,
            check: g => g.score >= 1000 && g.allHardDrop,
        },
        {
            id: 'sec_big_font', cat: 'secret', name: 'Go Big', type: 'single',
            rarity: 'common', clue: 'Go big or go home.',
            desc: 'Play a game with font size and game scale both set to maximum.',
            svgIcon: `<path fill-rule="evenodd" clip-rule="evenodd" d="M13.9928 6.6967L17.1747 3.51472L20.3567 6.6967L19.2961 7.75736L17.9247 6.38604L17.9247 17.614L19.2961 16.2426L20.3567 17.3033L17.1747 20.4853L13.9928 17.3033L15.0534 16.2426L16.4247 17.614V6.38604L15.0534 7.75736L13.9928 6.6967Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M3.75 4.5L4.5 3.75H12L12.75 4.5V19.5L12 20.25H4.5L3.75 19.5V4.5ZM5.25 5.25V18.75H11.25V17.25H8.25V15.75H11.25V14.25H8.25V12.75H11.25V11.25H7.5V9.75H11.25V8.25H8.25V6.75H11.25V5.25H5.25Z" fill="currentColor"/>`,
            check: g => g.bigFont,
        },
        {
            id: 'sec_exact_100', cat: 'secret', name: 'Hundred Percent', type: 'single',
            rarity: 'rare', clue: 'Exactly. Not one more, not one less.',
            desc: 'Place exactly 100 pieces in a single game.',
            svgIcon: `<circle cx="12" cy="12" r="10" fill="none" stroke="#44cc44" stroke-width="1.5"/><path d="M8.5 12l2.5 3 5-6" fill="none" stroke="#44cc44" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
            check: g => g.exactBlocks100,
        },
    {
        id: 'sec_exact_level', cat: 'secret', name: 'Zero Overflow', type: 'single',
        rarity: 'rare', clue: 'Zero to spare. Zero in excess.',
        desc: 'Earn enough XP to hit a level boundary exactly — zero XP overflow.',
        svgIcon: `<circle cx="7.5" cy="7.5" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16.5" cy="16.5" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
        check: () => false, // checked directly in gameOver
    },
    {
        id: 'sec_speedgames', cat: 'secret', name: 'Quick Five', type: 'single',
        rarity: 'epic', clue: 'Five blinks of an eye.',
        desc: 'Play 5 games in under 1 minute, each clearing at least one line.',
        svgIcon: `<path d="M13 2L7 10h4l-2 6 8-8h-4z" fill="none" stroke="#FFD700" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><text x="14" y="20" font-size="9" font-weight="bold" fill="currentColor" stroke="none" font-family="sans-serif">5</text>`,
        check: () => false, // checked directly in gameOver
    },
    {
        id: 'surgeon', cat: 'basic', name: 'Precision Cutter', type: 'tiered',
        svgIcon: `<text x="6" y="9" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">1</text><line x1="5" y1="20" x2="19" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><text x="18" y="19" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">2</text>`,
        counter: { path:'stats.surgeonLines', label:'Total Lines (1–2)', unit:'lines' },
        tiers: [
            { rarity:'common', name:'Precise',    desc:'Clear 100 single or double lines', progress:{ path:'stats.surgeonLines', target:100 } },
            { rarity:'rare',   name:'Careful',    desc:'Clear 250 single or double lines', progress:{ path:'stats.surgeonLines', target:250 } },
            { rarity:'epic',   name:'Specialist', desc:'Clear 500 single or double lines', progress:{ path:'stats.surgeonLines', target:500 } },
        ],
    },
    // ── NEW ACHIEVEMENTS (batch 2) ────────────────────────────────────────
    {
        id: 'pin_record', cat: 'secret', name: "What's the Point?", type: 'single',
        rarity: 'common', clue: 'Why would you do that?',
        desc: 'Pin your current personal record.',
        svgIcon: `<line x1="12" y1="2" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="5" x2="12" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="5" x2="12" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
        check: () => false,
    },
    {
        id: 'daily_xp', cat: 'basic', name: 'Daily Grinder', type: 'tiered',
        svgIcon: `<rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9 14.5l2.5 2.5 4-4" fill="none" stroke="#44cc44" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
        counter: { path:'stats.bestDailyXP', label:'Best Daily XP (raw)' },
        tiers: [
            { rarity:'common',    name:'Good Progress', desc:'Earn 500 raw XP in one day (from games only, no multipliers)',   progress:{ path:'stats.bestDailyXP', target:500   } },
            { rarity:'rare',      name:'Locked In',     desc:'Earn 1,500 raw XP in one day (from games only, no multipliers)', progress:{ path:'stats.bestDailyXP', target:1500  } },
            { rarity:'epic',      name:'Farming',       desc:'Earn 4,000 raw XP in one day (from games only, no multipliers)', progress:{ path:'stats.bestDailyXP', target:4000  } },
            { rarity:'legendary', name:'No Life',       desc:'Earn 10,000 raw XP in one day (from games only, no multipliers)',progress:{ path:'stats.bestDailyXP', target:10000 } },
        ],
    },
    {
        id: 'rules_reader', cat: 'secret', name: 'Dementia', type: 'single',
        rarity: 'common', clue: 'Knowledge is power... or is it?',
        desc: 'Check the rules 5 times.',
        svgIcon: `<path d="M4 19.5A2.5 2.5 0 016.5 17H20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="7" x2="16" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="9" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
        check: () => false,
    },
    {
        id: 'prosperity', cat: 'secret', name: 'Loaded', type: 'single',
        rarity: 'rare', clue: 'Saving for a rainy day.',
        desc: 'Have 20+ boosters saved at once.',
        svgIcon: `<rect x="3" y="10" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 10V6a5 5 0 0110 0v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16" r="2" fill="currentColor"/>`,
        check: () => false,
    },
    {
        id: 'music_listener', cat: 'basic', name: 'In the Zone', type: 'tiered',
        svgIcon: `<path d="M3 18V11a9 9 0 0118 0v7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="3" y="15" width="4" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="17" y="15" width="4" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
        counter: { path:'stats.musicTracksListened', label:'Tracks Listened' },
        tiers: [
            { rarity:'common', name:'Background Music', desc:'Listen to 25 music tracks',  progress:{ path:'stats.musicTracksListened', target:25  } },
            { rarity:'rare',   name:'Listener',         desc:'Listen to 50 music tracks',  progress:{ path:'stats.musicTracksListened', target:50  } },
            { rarity:'epic',   name:'Tuned In',         desc:'Listen to 100 music tracks', progress:{ path:'stats.musicTracksListened', target:100 } },
        ],
    },
    {
        id: 'third_charm', cat: 'secret', name: "Third Time's the Charm", type: 'single',
        rarity: 'epic', clue: "Third time's the charm.",
        desc: 'Come close to your record at least twice (not necessarily consecutively), then beat it.',
        svgIcon: `<g transform="translate(0,2.475) scale(0.046875)"><path fill="rgba(255,255,255,0.88)" fill-rule="nonzero" d="M334.22 1.61c27.26 3.44 52.63 12.14 75.16 24.98 23.39 13.31 43.7 31.1 59.95 52.04 16.21 20.88 28.41 44.97 35.5 71.01 6.84 25.02 8.99 51.75 5.56 78.97-3.43 27.26-12.14 52.62-24.98 75.16-13.31 23.38-31.1 43.69-52.04 59.94-20.88 16.22-44.97 28.41-71.01 35.5-25.02 6.85-51.75 8.99-78.97 5.56-27.26-3.43-52.62-12.13-75.16-24.97-23.38-13.32-43.69-31.11-59.91-52l-.03-.04a203.687 203.687 0 01-22.82-36.93c13.03-.38 25.67-2.24 37.8-5.39 4.01 7.08 8.53 13.85 13.52 20.27 13.38 17.24 30.09 31.86 49.25 42.79 18.47 10.51 39.33 17.71 61.86 20.55 22.52 2.83 44.46 1.07 65.01-4.57 21.31-5.83 41.09-15.85 58.33-29.24 17.24-13.38 31.86-30.09 42.79-49.25 10.51-18.47 17.71-39.33 20.55-61.86 2.84-22.52 1.08-44.46-4.57-65.01-5.83-21.31-15.85-41.09-29.23-58.33-13.39-17.24-30.1-31.86-49.26-42.79-18.47-10.51-39.33-17.71-61.85-20.55-20.74-2.61-40.98-1.32-60.09 3.3a170.278 170.278 0 00-21.86-31.3c2.47-.78 4.95-1.51 7.44-2.2 25.11-6.92 51.8-9.07 79.06-5.64zm-36.45 102.85c.62-4.94 3.21-9.14 6.82-11.98 3.64-2.83 8.35-4.26 13.29-3.63 4.95.62 9.15 3.17 11.98 6.82 2.84 3.64 4.26 8.35 3.64 13.29l-11.85 94.06 65.03 50.53a18.05 18.05 0 016.8 11.97c.58 4.56-.56 9.35-3.6 13.25l-.01.04c-3.04 3.9-7.41 6.23-11.96 6.8-4.56.58-9.35-.56-13.26-3.6h-.03l-72.75-56.57c-2.52-1.84-4.48-4.31-5.77-7.1a17.967 17.967 0 01-1.46-9.65l13.13-104.23z"/><path fill="red" d="M120.46.93c66.53 0 120.46 53.94 120.46 120.47 0 66.52-53.93 120.46-120.46 120.46C53.94 241.86 0 187.92 0 121.4 0 54.87 53.94.93 120.46.93z"/><path fill="#fff" fill-rule="nonzero" d="M128.02 105.32V91.45c-14.26-2.37-31.88-.15-45.87 2.78l-4.52-23.14c14.13-4.4 27.8-6.6 41-6.6 11.36 0 19.59.7 24.68 2.09 5.1 1.39 8.86 3.07 11.3 5.04 5.33 4.51 7.99 11.35 7.99 20.5 0 11.58-4.81 19.92-14.42 25.02v.87c11.46 4.75 17.2 13.38 17.2 25.89 0 6.14-.96 11.38-2.87 15.72-1.91 4.35-4.31 7.71-7.21 10.09-2.9 2.37-6.72 4.25-11.47 5.64-7.07 1.97-17 2.96-29.8 2.96s-25.63-1.51-38.48-4.53l4.86-26.09c16.41 3.98 30.87 5.09 47.61 2.96v-13.7l-29.89-2.96V108.8l29.89-3.48z"/></g>`,
        check: () => false,
    },
    {
        id: 'risky_break', cat: 'secret', name: 'No Risk, No Break', type: 'single',
        rarity: 'common', clue: 'Living on the edge.',
        desc: 'Pause the game at speed 3 or higher.',
        svgIcon: `<path transform="scale(0.02341)" fill="currentColor" d="m960.428 896l-576-128q-44-8-64-32l-96-160l-32 256q0 26-18.5 45t-45.5 19t-45.5-18.5t-18.5-45.5l54-377q14-75 42-103q9-8 52.5-46t52.5-47l119-99V64q0-25 18-44.5t46-19.5q29 0 46.5 19t17.5 45v128q-1 4-6.5 15.5t-14 27t-11.5 21.5l-117 95q-2 3 3.5 11t11.5 15l6 7l128 160l135-127q6-11 10-16q19-18 44.5-18t43.5 18l197 196q18 19 18 44.5t-18.5 44t-44 18.5t-43.5-18l-150-150l-160 136l416 96q27 0 45.5 18.5t18.5 45t-18.5 45.5t-45.5 19zm-832-640q-53 0-90.5-37.5T.428 128t37.5-90.5t90.5-37.5t90.5 37.5t37.5 90.5t-37.5 90.5t-90.5 37.5zm160 640h192q13 0 22.5 9.5t9.5 22.5t-9.5 22.5t-22.5 9.5h-192q-13 0-22.5-9.5t-9.5-22.5t9.5-22.5t22.5-9.5zm320 64h320q13 0 22.5 9.5t9.5 22.5t-9.5 22.5t-22.5 9.5h-320q-13 0-22.5-9.5t-9.5-22.5t9.5-22.5t22.5-9.5z"/>`,
        check: () => false,
    },
    {
        id: 'loser', cat: 'secret', name: 'Loser', type: 'single',
        rarity: 'rare', clue: 'Rock bottom.',
        desc: 'Lose 5 games in a row without clearing any lines.',
        svgIcon: `<path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3z" fill="none" stroke="#ff3333" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" fill="none" stroke="#ff3333" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
        check: () => false,
    },
    {
        id: 'marathon', cat: 'secret', name: 'Marathon', type: 'single',
        rarity: 'rare', clue: 'Do you ever stop?',
        desc: 'Play 20 games in a single session.',
        svgIcon: `<g transform="scale(0.046875)" fill="currentColor"><path d="M196.267,409.597h-153.6c-4.71,0-8.533,3.823-8.533,8.533s3.823,8.533,8.533,8.533h153.6c4.71,0,8.533-3.823,8.533-8.533S200.977,409.597,196.267,409.597z"/><path d="M25.6,324.263h68.267c4.71,0,8.533-3.823,8.533-8.533s-3.823-8.533-8.533-8.533H25.6c-4.71,0-8.533,3.823-8.533,8.533S20.89,324.263,25.6,324.263z"/><path d="M153.6,366.93c0-4.71-3.823-8.533-8.533-8.533H8.533c-4.71,0-8.533,3.823-8.533,8.533s3.823,8.533,8.533,8.533h136.533C149.777,375.463,153.6,371.64,153.6,366.93z"/><path d="M435.2,375.463H384c-4.71,0-8.533,3.823-8.533,8.533s3.823,8.533,8.533,8.533h51.2c31.13,0,55.202,21.495,59.11,51.2H353.399L80.333,170.663L209.143,41.853c7.074,22.46,23.33,66.15,49.357,92.177c29.158,29.167,79.761,35.115,99.9,36.326v68.574h-20.147c-2.961-5.077-8.405-8.533-14.694-8.533c-9.412,0-17.067,7.654-17.067,17.067c0,9.412,7.654,17.067,17.067,17.067c6.289,0,11.733-3.456,14.694-8.533H358.4v51.2h-20.147c-2.961-5.077-8.405-8.533-14.694-8.533c-9.412,0-17.067,7.654-17.067,17.067s7.654,17.067,17.067,17.067c6.289,0,11.733-3.456,14.694-8.533H358.4v8.533c0,2.261,0.896,4.437,2.5,6.033l17.067,17.067c3.337,3.337,8.73,3.337,12.066,0c3.337-3.336,3.337-8.73,0-12.066l-14.566-14.566V162.13c0-4.71-3.823-8.533-8.533-8.533c-0.649,0-65.092-0.358-96.367-31.633c-32.034-32.034-48.794-97.783-48.956-98.441c-0.751-2.978-3.038-5.333-5.999-6.153c-2.978-0.802-6.144,0.026-8.311,2.193L62.242,164.622c0,0-0.009,0-0.009,0.009c-0.008,0-0.008,0.009-0.008,0.009l-11.657,11.665c-10.641,10.633-10.325,29.602,0.666,40.593l266.999,266.999c1.126,1.126,11.503,11.034,27.768,11.034H486.4c14.353,0,25.6-11.247,25.6-25.6v-17.067C512,409.196,478.268,375.463,435.2,375.463z M494.933,469.33c0,4.864-3.669,8.533-8.533,8.533H346.001c-9.31,0-15.693-6.033-15.701-6.033l-266.999-267c-4.403-4.403-4.727-12.407-0.666-16.461l5.632-5.641l275.567,275.567c1.596,1.604,3.772,2.5,6.033,2.5h145.067V469.33z"/><path d="M273.067,230.397v102.4c0,4.71,3.823,8.533,8.533,8.533s8.533-3.823,8.533-8.533v-102.4c0-4.71-3.823-8.533-8.533-8.533S273.067,225.686,273.067,230.397z"/><path d="M332.715,202.971c4.173,0,7.825-3.063,8.431-7.322c0.674-4.659-2.569-8.986-7.236-9.66c-56.977-8.183-105.634-44.305-130.15-96.614c-1.997-4.267-7.066-6.093-11.349-4.105c-4.267,2.005-6.101,7.083-4.105,11.349c26.965,57.532,80.495,97.263,143.181,106.266C331.904,202.945,332.305,202.971,332.715,202.971z"/></g>`,
        check: () => false,
    },
    {
        id: 'lucky_day', cat: 'secret', name: 'Lucky Day', type: 'single',
        rarity: 'legendary', clue: 'Fortune favors the patient.',
        desc: 'See the "Lucky day!" quote on the splash screen.',
        svgIcon: `<path transform="scale(0.05185)" fill="#44cc44" d="m333.171,166.387c21.089-6.853 38.021-15.961 48.289-26.229 21.408-21.408 21.945-55.705 1.197-76.454-8.919-8.919-20.784-14.205-33.417-15.07-0.866-12.634-6.151-24.499-15.07-33.417-20.749-20.749-55.046-20.212-76.454,1.197-10.268,10.268-19.376,27.2-26.229,48.289-6.853-21.089-15.961-38.021-26.229-48.289-21.408-21.408-55.706-21.945-76.454-1.197-8.919,8.919-14.205,20.784-15.07,33.417-12.632,0.866-24.499,6.151-33.417,15.07-20.748,20.749-20.211,55.045 1.197,76.454 10.268,10.268 27.2,19.376 48.289,26.228-21.089,6.853-38.021,15.961-48.289,26.229-21.408,21.408-21.945,55.705-1.197,76.454 8.918,8.918 20.784,14.204 33.417,15.07 0.865,12.633 6.151,24.498 15.07,33.417 20.748,20.75 55.045,20.212 76.454-1.197 6.48-6.48 12.496-15.619 17.777-26.776-1.054,52.578-0.624,118.128 17.391,168.421 0.723,2.02 2.277,3.632 4.268,4.431 0.898,0.36 1.846,0.54 2.793,0.54 1.151,0 2.301-0.265 3.354-0.792l32-16c1.946-0.973 3.374-2.743 3.912-4.851 0.539-2.108 0.136-4.346-1.104-6.133-22.706-32.723-36.597-90.135-42.811-139.846 4.547,8.556 9.555,15.683 14.878,21.006 10.334,10.334 23.95,16.17 38.338,16.432 0.338,0.006 0.673,0.009 1.01,0.009 14.109,0 27.253-5.391 37.105-15.244 8.919-8.919 14.205-20.784 15.07-33.417 12.632-0.866 24.499-6.151 33.417-15.07 20.748-20.749 20.211-55.046-1.198-76.454-10.267-10.268-27.199-19.376-48.287-26.228zm-81.305,278.512c-8.314-26.839-11.962-57.924-13.378-88.714 6.15,25.828 15.771,56.552 30.153,80.326l-16.775,8.388zm120.184-186.437c-7.696,7.695-18.525,11.588-29.731,10.671-2.188-0.178-4.356,0.615-5.913,2.172-1.557,1.557-2.351,3.719-2.172,5.913 0.914,11.199-2.976,22.035-10.671,29.731-7.181,7.182-16.847,11.05-27.236,10.843-10.485-0.19-20.431-4.467-28.004-12.041-12.345-12.344-23.364-38.2-29.478-69.165-0.694-3.514-3.776-6.047-7.358-6.047s-6.664,2.533-7.358,6.047c-6.113,30.964-17.132,56.82-29.477,69.165-7.574,7.574-17.52,11.85-28.004,12.04-10.384,0.196-20.055-3.662-27.236-10.843-7.695-7.695-11.585-18.532-10.671-29.73 0.179-2.194-0.615-4.356-2.172-5.913-1.556-1.557-3.717-2.352-5.913-2.172-11.2,0.914-22.037-2.977-29.731-10.671-14.899-14.9-14.362-39.681 1.197-55.241 12.345-12.345 38.201-23.364 69.166-29.478 3.514-0.694 6.047-3.776 6.047-7.358s-2.533-6.664-6.047-7.358c-30.965-6.113-56.821-17.132-69.166-29.477-15.56-15.56-16.097-40.341-1.197-55.241 7.696-7.695 18.53-11.584 29.731-10.671 2.192,0.179 4.356-0.615 5.913-2.172 1.557-1.557 2.351-3.719 2.172-5.913-0.914-11.199 2.976-22.035 10.671-29.731 14.9-14.899 39.68-14.362 55.241,1.197 12.344,12.344 23.364,38.201 29.477,69.166 0.694,3.514 3.776,6.047 7.358,6.047s6.664-2.533 7.358-6.047c6.113-30.965 17.133-56.821 29.477-69.166 15.56-15.56 40.34-16.097 55.241-1.197 7.695,7.695 11.584,18.532 10.671,29.731-0.179,2.194 0.615,4.356 2.172,5.913 1.557,1.556 3.715,2.349 5.913,2.172 11.201-0.915 22.035,2.976 29.731,10.671 14.899,14.9 14.362,39.681-1.197,55.241-12.345,12.344-38.201,23.364-69.165,29.477-3.514,0.694-6.047,3.776-6.047,7.358s2.533,6.664 6.047,7.358c30.964,6.113 56.82,17.132 69.165,29.477 15.558,15.561 16.095,40.342 1.196,55.242z"/>`,
        check: () => false,
    },
    {
        id: 'mirror_score', cat: 'basic', name: 'Other Side', type: 'tiered',
        svgIcon: `<line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/><path d="M6 6h3v12H6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M18 6h-3v12h3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`,
        counter: { path:'stats.bestMirrorScore', label:'Mirror Mode Best' },
        tiers: [
            { rarity:'common',    name:'Reflected',    desc:'Score 250 in Mirror Mode',   check: g => g.mirror && g.score >= 250,  progressDisplay:{ path:'stats.bestMirrorScore', target:250  } },
            { rarity:'rare',      name:'Flipped',      desc:'Score 500 in Mirror Mode',   check: g => g.mirror && g.score >= 500,  progressDisplay:{ path:'stats.bestMirrorScore', target:500  } },
            { rarity:'epic',      name:'Reversed',     desc:'Score 1,000 in Mirror Mode', check: g => g.mirror && g.score >= 1000, progressDisplay:{ path:'stats.bestMirrorScore', target:1000 } },
            { rarity:'legendary', name:'Full Reverse',  desc:'Score 2,500 in Mirror Mode', check: g => g.mirror && g.score >= 2500, progressDisplay:{ path:'stats.bestMirrorScore', target:2500 } },
        ],
    },
    {
        id: 'loyal_piece', cat: 'secret', name: 'Loyal Holder', type: 'single',
        rarity: 'rare', clue: 'Saving it for later... forever.',
        desc: 'Hold a piece for 30+ placements, then use it.',
        svgIcon: `<path d="M21 12 A9 9 0 1 1 15 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 7v5l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><text x="21" y="10" text-anchor="middle" font-size="5.5" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">30</text>`,
        check: () => false,
        progressDisplay: { path:'stats.bestLoyalPiece', target:30 },
    },
    {
        id: 'logo_click', cat: 'secret', name: 'Explorer', type: 'single',
        rarity: 'rare', clue: 'Curiosity.',
        desc: 'See every title animation.',
        svgIcon: `<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="15.9" y1="15.9" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><text x="10" y="10" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="bold" fill="currentColor" stroke="none" font-family="sans-serif">?</text>`,
        check: () => false,
    },
    {
        id: 'mute_jarvis', cat: 'secret', name: 'On and Off', type: 'single',
        rarity: 'rare', clue: 'Make up your mind.',
        desc: 'Mute music 10 times (5s minimum gaps).',
        svgIcon: `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
        check: () => false,
    },
    {
        id: 'save_transfer', cat: 'secret', name: 'Backed Up', type: 'single',
        rarity: 'common', clue: 'Trust, but verify.',
        desc: 'Import or transfer a save file.',
        svgIcon: `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="12" y1="10" x2="12" y2="15" stroke="#ff0000" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17.5" x2="12.01" y2="17.5" stroke="#ff0000" stroke-width="2.5" stroke-linecap="round"/>`,
        check: () => false,
    },
    {
        id: 'pin_collector', cat: 'secret', name: 'Pin Collector', type: 'single',
        rarity: 'rare', clue: "Collector's instinct.",
        desc: 'Pin 15+ scores.',
        svgIcon: `<line x1="12" y1="17" x2="12" y2="22" stroke="#aaaaaa" stroke-width="1.5" stroke-linecap="round"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" fill="none" stroke="#cc3333" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
        check: () => false,
        progressDisplay: { path:'stats.pinnedCount', target:15 },
    },
    {
        id: 'exact_death', cat: 'secret', name: 'Angel Numbers', type: 'single',
        rarity: 'rare', clue: 'Angel numbers.',
        desc: 'End a game with a repeating score: 111, 222… or 1111, 2222… up to 9999. Score must be ≥ 100.',
        svgIcon: `<path d="m9.5,5.5c0,1.379,1.122,2.5,2.5,2.5s2.5-1.121,2.5-2.5-1.122-2.5-2.5-2.5-2.5,1.121-2.5,2.5Zm4,0c0,.827-.673,1.5-1.5,1.5s-1.5-.673-1.5-1.5.673-1.5,1.5-1.5,1.5.673,1.5,1.5Zm7,.5c-3.373,0-6.02,2.984-6.555,3.632-1.256.475-2.633.475-3.889,0-.535-.648-3.182-3.632-6.555-3.632C.918,6,.185,11.139.024,15.45c-.015.409.132.796.416,1.09.286.297.67.46,1.083.46.263,0,.477.214.477.5,0,.827.673,1.5,1.494,1.5.231.006.506.098.506.5v2c0,.099.036.186.086.264.069.315.174.623.353.905.514.807,1.392,1.288,2.346,1.288l10.428.043c.957,0,1.834-.481,2.348-1.288.191-.299.298-.628.364-.964.043-.074.075-.156.075-.248v-2c0-.275.224-.5.5-.5.827,0,1.5-.673,1.5-1.5,0-.275.224-.5.509-.5.412,0,.795-.162,1.079-.457.283-.294.43-.681.414-1.089-.134-3.531-.768-9.454-3.502-9.454ZM3.5,18c-.276,0-.5-.225-.5-.523,0-.814-.663-1.477-1.477-1.477-.139,0-.268-.055-.363-.153-.093-.097-.142-.225-.137-.359.192-5.156,1.165-8.487,2.477-8.487,2.712,0,5.005,2.377,5.669,3.136l-4.315,8.675c-.279-.583-.899-.811-1.354-.811Zm15.218,4.175c-.33.517-.892.825-1.503.825l-10.428-.043c-.613,0-1.176-.309-1.505-.825s-.371-1.157-.118-1.701l4.847-9.744c1.29.416,2.687.417,3.976,0l4.843,9.774c.259.556.217,1.196-.112,1.714Zm4.15-6.326c-.094.098-.221.151-.368.151-.827,0-1.5.673-1.5,1.5,0,.275-.224.5-.5.5-.596,0-1.107.352-1.349.856l-4.32-8.72c.663-.758,2.957-3.136,5.669-3.136,1.304,0,2.311,3.412,2.503,8.491.005.135-.043.262-.135.357Z" fill="currentColor"/><path d="M7.634,4.486c-.415-.445-.634-.96-.634-1.486,0-1.683,2.196-3,5-3s5,1.317,5,3c0,.526-.219,1.041-.634,1.486-.099.106-.232.16-.366.16-.122,0-.244-.044-.34-.134-.202-.188-.214-.504-.026-.706.243-.262.366-.533.366-.807,0-.946-1.643-2-4-2s-4,1.054-4,2c0,.273.123.545.366.807.188.202.176.519-.026.706-.202.188-.519.177-.707-.026Z" fill="#FFD700"/>`,
        check: () => false,
    },
    {
        id: 'skin_loyal', cat: 'secret', name: 'Never Changing', type: 'single',
        rarity: 'rare', clue: "If it ain't broke...",
        desc: 'Play 50+ games without changing block skin.',
        svgIcon: `<polygon points="12,2 15.1,9.5 23,9.5 16.9,14.5 19.4,22 12,17.5 4.6,22 7.1,14.5 1,9.5 8.9,9.5" fill="none" stroke="#FFD700" stroke-width="1.5" stroke-linejoin="round"/>`,
        check: () => false,
        progressDisplay: { path:'stats.sameSkinStreak', target:50 },
    },
    {
        id: 'fun_squared', cat: 'basic', name: 'Fun Fanatic', type: 'tiered',
        svgIcon: `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 14s1.5 3 4 3 4-3 4-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="9" x2="9.01" y2="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="15" y1="9" x2="15.01" y2="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M7 2l2 3M17 2l-2 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,
        counter: { path:'stats.funGamesPlayed', label:'Fun Games Played' },
        tiers: [
            { rarity:'common',    name:'Just for Giggles', desc:'Play 5 games in Fun Mode clearing at least 1 line each',   progress:{ path:'stats.funGamesPlayed', target:5   } },
            { rarity:'rare',      name:'Good Vibes',       desc:'Play 20 games in Fun Mode clearing at least 1 line each',  progress:{ path:'stats.funGamesPlayed', target:20  } },
            { rarity:'epic',      name:'Party Mode',       desc:'Play 50 games in Fun Mode clearing at least 1 line each',  progress:{ path:'stats.funGamesPlayed', target:50  } },
            { rarity:'legendary', name:'Party Animal',     desc:'Play 100 games in Fun Mode clearing at least 1 line each', progress:{ path:'stats.funGamesPlayed', target:100 } },
        ],
    },
    {
        id: 'abort_mission', cat: 'secret', name: 'Mission Failed', type: 'single',
        rarity: 'rare', clue: 'Mission failed.',
        desc: 'Leave 20+ games.',
        svgIcon: `<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="16 17 21 12 16 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
        check: () => false,
        progressDisplay: { path:'stats.gamesAborted', target:20 },
    },
    {
        id: 'deja_vu', cat: 'secret', name: 'Deja Vu', type: 'single',
        rarity: 'epic', clue: "Haven't I been here before?",
        desc: 'Finish a game with the same score as one of your past highscores.',
        svgIcon: `<path d="M19 7A9 9 0 0 0 5.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="5.5,4.5 5.5,9 9.5,9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 17A9 9 0 0 0 18.5 19.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="18.5,19.5 18.5,15 14.5,15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="13" text-anchor="middle" dominant-baseline="central" font-size="7" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">123</text>`,
        check: () => false,
    },
    {
        id: 'streak_lost', cat: 'secret', name: 'The End of the Run', type: 'single',
        rarity: 'rare', clue: 'All good things...',
        desc: 'Lose a daily streak of 20+ days.',
        svgIcon: `<path d="M21 12 L21 6 Q21 4 19 4 L5 4 Q3 4 3 6 L3 20 Q3 22 5 22 L11 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="14" y1="2" x2="14" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="13" x2="14" y2="17" stroke="#ff3333" stroke-width="1.5" stroke-linecap="round"/><line x1="14" y1="13" x2="10" y2="17" stroke="#ff3333" stroke-width="1.5" stroke-linecap="round"/><text x="20" y="22" text-anchor="middle" font-size="5" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">20+</text>`,
        check: () => false,
    },
    {
        id: 'gift_ignore', cat: 'secret', name: 'Ungrateful', type: 'single',
        rarity: 'common', clue: 'Ungrateful.',
        desc: 'Have 10+ unclaimed mission XP rewards or milestone boxes combined (resets with missions).',
        svgIcon: `<path d="M20 12v10H4V12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M22 7H2v5h20V7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 22V7" stroke="currentColor" stroke-width="1.5"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="22" y1="2" x2="2" y2="22" stroke="#ff3333" stroke-width="2" stroke-linecap="round"/>`,
        check: () => false,
    },
    {
        id: 'back_to_back', cat: 'secret', name: 'Back to Back', type: 'single',
        rarity: 'epic', clue: 'Lightning strikes twice.',
        desc: 'Get the same score in two consecutive games.',
        svgIcon: `<text x="3" y="11" font-size="9" font-weight="900" fill="currentColor" font-family="sans-serif">123</text><g transform="translate(24,24) scale(-1,-1)"><text x="3" y="11" font-size="9" font-weight="900" fill="currentColor" font-family="sans-serif" opacity="0.45">123</text></g>`,
        check: () => false,
    },
    {
        id: 'afk', cat: 'secret', name: 'AFK', type: 'single',
        rarity: 'rare', clue: 'Still there?',
        desc: 'Spend 15 minutes in the menu without playing.',
        svgIcon: `<text x="8" y="10" font-size="10" font-weight="bold" fill="currentColor" stroke="none" font-family="sans-serif">Z</text><text x="13" y="16" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif" opacity="0.6">z</text><text x="16" y="20" font-size="6" fill="currentColor" stroke="none" font-family="sans-serif" opacity="0.3">z</text>`,
        check: () => false,
    },
    {
        id: 'parachute_catcher', cat: 'secret', name: 'Supply Drop', type: 'single',
        rarity: 'common', clue: 'Not every falling block is ordinary.',
        desc: 'Catch a color-changing block in the menu.',
        svgIcon: `<path d="M8 12V5a2 2 0 014 0v7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 10v-1a2 2 0 014 0v3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 12v-1a2 2 0 014 0v4a8 8 0 01-16 0v-3a2 2 0 014 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
        check: () => false,
    },
    {
        id: 'collector', cat: 'basic', name: 'Collector', type: 'tiered',
        svgIcon: `<path d="M3 5h2l1 9h12l1-7H6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="19" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="19" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
        counter: { path:'_computed.itemsBought', label:'Items Bought' },
        tiers: [
            { rarity:'common',    name:'Starter Pack',  desc:'Buy 10 items',    progress:{ path:'_computed.itemsBought', target:10 } },
            { rarity:'rare',      name:'Accumulator',   desc:'Buy 20 items',    progress:{ path:'_computed.itemsBought', target:20 } },
            { rarity:'epic',      name:'Completist',    desc:'Buy every item',  progress:{ path:'_computed.itemsBought', target:0 } },
        ],
    },
    {
        id: 'pause_spam', cat: 'secret', name: 'Anxiety', type: 'single',
        rarity: 'common', clue: 'Anxiety.',
        desc: 'Pause 5+ times in a single game.',
        svgIcon: `<rect x="4" y="4" width="5" height="16" rx="1" fill="currentColor" opacity="0.5"/><rect x="15" y="4" width="5" height="16" rx="1" fill="currentColor" opacity="0.5"/><rect x="4" y="4" width="5" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="15" y="4" width="5" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
        check: () => false,
    },
    // ── NEW ACHIEVEMENTS (batch 3) ────────────────────────────────────────
    {
        id: 'leaning_tower', cat: 'secret', name: 'Leaning Tower', type: 'single',
        rarity: 'rare', clue: 'A precarious structure, barely standing.',
        desc: 'Game over with bottom row having exactly 1 filled cell and no other row having more than 3 filled cells (must clear at least 1 line).',
        svgIcon: `<path transform="scale(0.04687)" fill="currentColor" d="M393.503,141.288l-10.645-0.747l3.776-53.205c0.597-8.533-2.155-16.768-7.744-23.232c-3.179-3.669-7.104-6.4-11.435-8.277l0.896-12.544c0.597-8.533-2.155-16.768-7.744-23.232c-5.589-6.464-13.376-10.368-21.909-10.965L211.017,0.04c-17.259-0.853-32.939,12.075-34.176,29.675l-0.917,12.8c-12.523,3.691-22.379,14.464-23.36,28.245l-3.776,53.184l-10.667-0.768c-5.931-0.597-10.944,4.032-11.392,9.899c-0.427,5.867,3.989,10.965,9.877,11.392l10.667,0.747l-4.523,63.851l-10.667-0.747c-5.931-0.384-10.965,4.032-11.392,9.899c-0.427,5.867,4.011,10.965,9.877,11.392l10.667,0.747l-4.523,63.851l-10.667-0.747c-5.696-0.405-10.965,4.032-11.392,9.899c-0.427,5.867,4.011,10.965,9.877,11.392l10.667,0.747l-4.523,63.808l-10.645-0.747c-5.717-0.405-10.965,4.032-11.392,9.899c-0.427,5.867,3.989,10.965,9.877,11.392l10.645,0.747l-6.784,95.787c-0.427,5.845,4.011,10.944,9.899,11.371l60.629,4.267h153.685c5.589,0,10.24-4.331,10.667-9.92l6.016-84.907l10.624,0.747c0.256,0.021,0.512,0.021,0.768,0.021c5.547,0,10.219-4.288,10.624-9.92c0.427-5.867-3.989-10.965-9.877-11.392l-10.624-0.747l4.523-63.829l10.603,0.747c0.256,0.021,0.512,0.021,0.768,0.021c5.568,0,10.24-4.309,10.624-9.92c0.427-5.867-4.011-10.965-9.877-11.392l-10.624-0.747l4.523-63.851l10.624,0.747c0.256,0.021,0.512,0.021,0.768,0.021c5.547,0,10.24-4.288,10.624-9.92c0.427-5.867-4.011-10.965-9.877-11.392l-10.624-0.747l4.523-63.808l10.624,0.747c0.256,0.021,0.512,0.021,0.768,0.021c5.547,0,10.219-4.288,10.624-9.92C403.807,146.813,399.391,141.715,393.503,141.288z M198.111,31.208c0.192-2.837,1.493-5.44,3.648-7.296c2.133-1.877,4.843-2.795,7.744-2.581l127.68,9.045c2.837,0.192,5.44,1.493,7.296,3.648c1.877,2.133,2.795,4.885,2.603,7.744l-0.768,10.624l-97.365-6.891l-51.605-3.669L198.111,31.208z M253.087,462.824l-1.984,27.861h-21.376l2.048-29.355c0.427-5.888,5.419-10.389,11.413-9.899c2.837,0.192,5.44,1.493,7.296,3.648C252.361,457.213,253.279,459.965,253.087,462.824z M336.649,490.685H272.5l1.856-26.347c1.237-17.621-12.053-32.939-29.675-34.197c-17.771-0.96-32.939,12.117-34.176,29.696l-2.176,30.869h-14.677l-49.237-3.477l6.037-85.141l31.851,2.261c0.021,0,0.043,0.021,0.085,0.021c0.128,0,0.256,0,0.384,0l63.403,4.501c0.021,0,0.043,0.021,0.064,0.021c0.085,0,0.171,0,0.277,0l63.552,4.501h0.021c0.043,0,0.085,0,0.128,0l31.787,2.261L336.649,490.685z M343.455,394.387l-21.291-1.515l2.261-31.915c0.427-5.867-4.011-10.965-9.877-11.392c-5.888-0.448-10.965,4.032-11.392,9.899l-2.261,31.893l-42.581-3.029l2.283-31.915c0.427-5.867-3.989-10.965-9.877-11.392c-5.867-0.512-10.965,4.032-11.392,9.899l-2.261,31.893l-42.56-3.029l2.261-31.915c0.427-5.867-4.011-10.965-9.877-11.392c-5.845-0.597-10.965,4.032-11.392,9.899l-2.261,31.936l-21.291-1.515l4.523-63.808l191.531,13.568L343.455,394.387z M349.492,309.267l-21.269-1.515l2.261-31.915c0.427-5.867-4.011-10.965-9.877-11.392c-5.867-0.427-10.965,4.032-11.392,9.899l-2.261,31.915l-42.581-3.008l2.283-31.915c0.427-5.867-3.989-10.965-9.877-11.392c-5.845-0.491-10.965,4.032-11.392,9.899l-2.283,31.915l-42.56-3.029l2.261-31.915c0.427-5.867-4.011-10.965-9.877-11.392c-5.824-0.576-10.965,4.032-11.392,9.899l-2.261,31.915l-21.312-1.536l4.523-63.851l31.829,2.261c0.043,0,0.064,0.021,0.107,0.021c0.171,0.021,0.32,0.021,0.491,0.021l127.168,9.003h0.021l31.893,2.261L349.492,309.267z M355.529,224.125l-21.291-1.515l2.283-31.915c0.405-5.867-3.989-10.965-9.877-11.392c-5.867-0.384-10.965,4.032-11.392,9.899l-2.261,31.915l-42.56-3.008l2.283-31.915c0.427-5.867-3.989-10.965-9.877-11.392c-5.845-0.469-10.965,4.032-11.392,9.899l-2.261,31.915l-42.56-3.008l2.261-31.893c0.427-5.867-4.011-10.965-9.877-11.392c-5.888-0.576-11.008,3.989-11.435,9.856l-2.261,31.893l-21.312-1.515l4.523-63.829l159.573,11.328c0.021,0,0.021,0,0.043,0c0.043,0,0.107,0,0.149,0l31.765,2.261L355.529,224.125z M365.343,85.843l-3.776,53.184l-21.291-1.515l2.283-31.915c0.427-5.867-3.989-10.965-9.877-11.392c-5.845-0.384-10.965,4.032-11.392,9.899l-2.261,31.893l-42.581-3.029l2.283-31.915c0.405-5.867-4.011-10.965-9.877-11.392c-6.059-0.448-10.965,4.032-11.392,9.899l-2.304,31.936l-42.56-3.029l2.261-31.936c0.427-5.867-4.011-10.965-9.877-11.392c-5.803-0.512-10.965,4.032-11.413,9.899l-2.24,31.915l-21.291-1.493l3.776-53.184c0.192-2.837,1.493-5.44,3.648-7.296c2.133-1.877,4.736-2.859,7.744-2.581l170.24,12.053c2.837,0.192,5.44,1.493,7.296,3.648C364.617,80.232,365.535,82.984,365.343,85.843z"/>`,
        check: () => false,
    },
    {
        id: 'dry_spell', cat: 'secret', name: 'Let It Stack', type: 'single',
        rarity: 'rare', clue: 'The well has run dry.',
        desc: 'Place 30+ pieces without clearing a single line.',
        svgIcon: `<rect x="10" y="4" width="4" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="7" y="10" width="4" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="10" width="4" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="16" width="4" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="16" width="4" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="16" y="16" width="4" height="4" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.5"/>`,
        check: () => false,
    },
    {
        id: 'double_satisfaction', cat: 'secret', name: 'Double the Satisfaction', type: 'single',
        rarity: 'rare', clue: 'Four and four. Back to back.',
        desc: 'Clear 4 lines twice in a row.',
        svgIcon: `<path transform="translate(4.8,4.5) scale(0.19)" fill="currentColor" d="M26.85,1.24A36.12,36.12,0,0,1,54.33,4.86l.12.08A36.14,36.14,0,0,1,68.79,20.38,9.37,9.37,0,0,0,65,21.74,32,32,0,0,0,52.42,8.4l-.1-.06a32.2,32.2,0,1,0-7.86,59l.2,0A31.91,31.91,0,0,0,56.85,61a9.58,9.58,0,0,0,1.26,2.11,7.53,7.53,0,0,0,.75.87l.32.31a36.08,36.08,0,0,1-13.58,7h-.06a36.22,36.22,0,0,1-18.69-70ZM18,41.44A22.25,22.25,0,0,0,23,46.13a23.81,23.81,0,0,0,13.9,4.19A22.5,22.5,0,0,0,50.29,45.8a20,20,0,0,0,4.18-4.38.12.12,0,0,1,.17,0L56,42.74a.11.11,0,0,1,0,.15,25.45,25.45,0,0,1-7.84,8.45A21.07,21.07,0,0,1,37,54.89,21.8,21.8,0,0,1,25.48,51.8a28.13,28.13,0,0,1-9-8.82.14.14,0,0,1,0-.16l1.4-1.39a.13.13,0,0,1,.18,0ZM44.94,20c2.4,0,4.34,2.81,4.34,6.28s-1.94,6.27-4.34,6.27-4.33-2.81-4.33-6.27S42.55,20,44.94,20ZM27.5,20c2.4,0,4.34,2.81,4.34,6.28s-1.94,6.27-4.34,6.27-4.33-2.81-4.33-6.27S25.11,20,27.5,20ZM70,27.74h5.92A2.07,2.07,0,0,1,78,29.8V57.22a2.07,2.07,0,0,1-2.07,2.06H65.57a2.07,2.07,0,0,1-2.06-2.06c1.78-9.52,3-18.28,4.4-27.42A2.06,2.06,0,0,1,70,27.74Z"/><path transform="translate(0.5,5.5) scale(0.195)" fill="currentColor" d="M92.12,7.74a3.55,3.55,0,0,1,1.77-1.86,4.18,4.18,0,0,1,2.85-.16,7.78,7.78,0,0,1,2.71,1.39,13.41,13.41,0,0,1,5,9.65,29.31,29.31,0,0,1-.06,4.27c-.08,1-.21,2.06-.39,3.15h10.34A11.15,11.15,0,0,1,119,25.37a7.48,7.48,0,0,1,2.87,2.52,6.39,6.39,0,0,1,1,3.84,9.06,9.06,0,0,1-.93,3.55,11.23,11.23,0,0,1,.28,4.29,5,5,0,0,1-1.43,2.9,12.91,12.91,0,0,1-.71,4.83,10.28,10.28,0,0,1-2.3,3.6,14.53,14.53,0,0,1-.46,2.56A8.83,8.83,0,0,1,116,56.22h0c-1.76,2.48-3.16,2.42-5.38,2.33-.31,0-.64,0-1.16,0H89.37a9.78,9.78,0,0,1-4.53-.91,10.92,10.92,0,0,1-3.55-3.1l-.3-.86V30.19l1-.27c2.6-.7,4.64-2.92,6.23-5.58a39.58,39.58,0,0,0,3.55-8.51V9.73a3.85,3.85,0,0,1,.33-2ZM95,8.38a1.11,1.11,0,0,0-.51.8V16l-.06.39a42.58,42.58,0,0,1-3.89,9.34c-1.72,2.87-4,5.34-6.85,6.48V53.17a7.79,7.79,0,0,0,2.33,2,7.28,7.28,0,0,0,3.31.61H109.5c.36,0,.83,0,1.26,0,1.33,0,2.16.09,3-1.17h0a6,6,0,0,0,.87-1.91,12.15,12.15,0,0,0,.41-2.54l.42-.9a7.6,7.6,0,0,0,2-2.94A10.66,10.66,0,0,0,118,41.9l0-.82.69-.43a2.1,2.1,0,0,0,.84-1.53,9.11,9.11,0,0,0-.35-3.64l.11-1a7,7,0,0,0,.86-2.86,3.75,3.75,0,0,0-.6-2.24,5,5,0,0,0-1.84-1.6,8.16,8.16,0,0,0-3.43-.87H100.69L101,25.3c.29-1.57.5-3.07.63-4.49a25.39,25.39,0,0,0,.06-3.87,10.58,10.58,0,0,0-3.9-7.64,5.09,5.09,0,0,0-1.74-.92,1.5,1.5,0,0,0-1,0Z"/><path transform="translate(23.5,5.5) scale(-0.195,0.195)" fill="currentColor" d="M92.12,7.74a3.55,3.55,0,0,1,1.77-1.86,4.18,4.18,0,0,1,2.85-.16,7.78,7.78,0,0,1,2.71,1.39,13.41,13.41,0,0,1,5,9.65,29.31,29.31,0,0,1-.06,4.27c-.08,1-.21,2.06-.39,3.15h10.34A11.15,11.15,0,0,1,119,25.37a7.48,7.48,0,0,1,2.87,2.52,6.39,6.39,0,0,1,1,3.84,9.06,9.06,0,0,1-.93,3.55,11.23,11.23,0,0,1,.28,4.29,5,5,0,0,1-1.43,2.9,12.91,12.91,0,0,1-.71,4.83,10.28,10.28,0,0,1-2.3,3.6,14.53,14.53,0,0,1-.46,2.56A8.83,8.83,0,0,1,116,56.22h0c-1.76,2.48-3.16,2.42-5.38,2.33-.31,0-.64,0-1.16,0H89.37a9.78,9.78,0,0,1-4.53-.91,10.92,10.92,0,0,1-3.55-3.1l-.3-.86V30.19l1-.27c2.6-.7,4.64-2.92,6.23-5.58a39.58,39.58,0,0,0,3.55-8.51V9.73a3.85,3.85,0,0,1,.33-2ZM95,8.38a1.11,1.11,0,0,0-.51.8V16l-.06.39a42.58,42.58,0,0,1-3.89,9.34c-1.72,2.87-4,5.34-6.85,6.48V53.17a7.79,7.79,0,0,0,2.33,2,7.28,7.28,0,0,0,3.31.61H109.5c.36,0,.83,0,1.26,0,1.33,0,2.16.09,3-1.17h0a6,6,0,0,0,.87-1.91,12.15,12.15,0,0,0,.41-2.54l.42-.9a7.6,7.6,0,0,0,2-2.94A10.66,10.66,0,0,0,118,41.9l0-.82.69-.43a2.1,2.1,0,0,0,.84-1.53,9.11,9.11,0,0,0-.35-3.64l.11-1a7,7,0,0,0,.86-2.86,3.75,3.75,0,0,0-.6-2.24,5,5,0,0,0-1.84-1.6,8.16,8.16,0,0,0-3.43-.87H100.69L101,25.3c.29-1.57.5-3.07.63-4.49a25.39,25.39,0,0,0,.06-3.87,10.58,10.58,0,0,0-3.9-7.64,5.09,5.09,0,0,0-1.74-.92,1.5,1.5,0,0,0-1,0Z"/>`,
        check: () => false,
    },
    {
        id: 'one_at_a_time', cat: 'basic', name: 'Single Minded', type: 'tiered',
        svgIcon: `<line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`,
        counter: { path:'stats.singleLineClears', label:'Single Line Clears' },
        tiers: [
            { rarity:'common',    name:'Patient',    desc:'Clear 50 single lines',    progress:{ path:'stats.singleLineClears', target:50  } },
            { rarity:'rare',      name:'Methodical', desc:'Clear 200 single lines',   progress:{ path:'stats.singleLineClears', target:200 } },
            { rarity:'epic',      name:'One by One', desc:'Clear 500 single lines',   progress:{ path:'stats.singleLineClears', target:500 } },
        ],
    },
    {
        id: 'surgeons_streak', cat: 'secret', name: 'Crescendo', type: 'single',
        rarity: 'legendary', clue: '1, 2, 3, 4. Precision in sequence.',
        desc: 'Clear 1 line, then 2, then 3, then 4 in exactly that order — consecutive clears with no other clears between.',
        svgIcon: `<line x1="3" y1="6" x2="6" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="10" x2="10" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="14" x2="14" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="18" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="19 4 21 6 19 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><line x1="18" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,
        check: () => false,
    },
    {
        id: 'spinner', cat: 'basic', name: 'Spinner', type: 'tiered',
        svgIcon: `<path d="M20 15A9 9 0 0 0 7 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="23,12 20,15 18,12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9A9 9 0 0 0 17 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="1,12 4,9 6,12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
        counter: { path:'stats.totalRotations', label:'Total Rotations' },
        tiers: [
            { rarity:'common',    name:'Twister', desc:'Rotate 500 times',    progress:{ path:'stats.totalRotations', target:500   } },
            { rarity:'rare',      name:'Vortex',  desc:'Rotate 2,000 times',  progress:{ path:'stats.totalRotations', target:2000  } },
            { rarity:'epic',      name:'Tornado', desc:'Rotate 7,500 times',  progress:{ path:'stats.totalRotations', target:7500  } },
            { rarity:'legendary', name:'Cyclone', desc:'Rotate 30,000 times', progress:{ path:'stats.totalRotations', target:30000 } },
        ],
    },
    {
        id: 'dizzy', cat: 'secret', name: 'Overthinker', type: 'single',
        rarity: 'common', clue: 'Round and round and round...',
        desc: 'Rotate a single piece 20+ times before placing it.',
        svgIcon: `<circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1.5"/><g transform="scale(0.06)" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M151.856 244.712C157.142 238.518 163.516 230.818 172.188 227.63C222.539 209.123 271.458 269.703 222.195 285.339C191.96 294.935 139.608 285.366 152.954 244.25"/><path d="M131.03 191.497C102.484 189.705 90.9062 113.358 144.845 111.048C200.489 108.666 181.763 195.058 140.287 166.758C125.566 156.709 138.727 130.949 153.033 137.186"/><path d="M231.722 115.862C270.273 98.942 309.383 144.843 287.118 177.253C276.697 192.419 256.98 196.373 240.043 191.675C229.704 188.81 223.939 180.086 223.939 170.042C223.939 125.018 288.185 149.846 253.498 164.272"/></g>`,
        check: () => false,
    },
    {
        id: 'fav_track', cat: 'secret', name: 'Favorite Song', type: 'single',
        rarity: 'common', clue: "You've got a favorite.",
        desc: 'Listen to the same track 10 times.',
        svgIcon: `<rect x="3" y="14" width="3" height="8" rx="1" fill="currentColor"/><rect x="7" y="8" width="3" height="14" rx="1" fill="currentColor"/><rect x="11" y="4" width="3" height="18" rx="1" fill="currentColor"/><rect x="15" y="10" width="3" height="12" rx="1" fill="currentColor"/><rect x="19" y="6" width="3" height="16" rx="1" fill="currentColor"/>`,
        check: () => false,
    },
    {
        id: 'clutch', cat: 'secret', name: 'Clutch', type: 'single',
        rarity: 'legendary', clue: 'The T-piece at its absolute peak.',
        desc: 'Clear 3 lines with a T-spin.',
        svgIcon: `<rect x="4" y="9" width="5" height="5" rx="0.5" fill="none" stroke="#ffffff" stroke-width="1.5"/><rect x="9" y="9" width="5" height="5" rx="0.5" fill="none" stroke="#ffffff" stroke-width="1.5"/><rect x="14" y="9" width="5" height="5" rx="0.5" fill="none" stroke="#ffffff" stroke-width="1.5"/><rect x="9" y="14" width="5" height="5" rx="0.5" fill="none" stroke="#ffffff" stroke-width="1.5"/>`,
        check: () => false,
        progressDisplay: { path:'stats.tSpinTriples', target:1 },
    },
    {
        id: 'staircase', cat: 'secret', name: 'Step by Step', type: 'single',
        rarity: 'epic', clue: 'Step by step, column by column.',
        desc: 'Create a perfect staircase pattern: each column is exactly 1 block higher than the previous, across all 10 columns.',
        svgIcon: `<path d="M2 22 L2 17 L7 17 L7 12 L12 12 L12 7 L17 7 L17 2 L22 2 L22 22 Z" fill="currentColor" opacity="0.15" stroke="none"/><path d="M2 22 L2 17 L7 17 L7 12 L12 12 L12 7 L17 7 L17 2 L22 2 L22 22 L2 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
        check: () => false,
    },
    {
        id: 'indecisive', cat: 'secret', name: 'Left Right Left', type: 'single',
        rarity: 'common', clue: 'Left... no, right... no, left!',
        desc: 'Move a piece from wall to wall 3+ times before placing it.',
        svgIcon: `<polyline points="12 4 18 4 18 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="18" y1="4" x2="10" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="12 20 6 20 6 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="20" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
        check: () => false,
    },
    {
        id: 'too_fast', cat: 'secret', name: 'Difficulty Spike', type: 'single',
        rarity: 'rare', clue: 'So close to the next gear.',
        desc: 'Game over on the first line after a speed-up (at speed 3+).',
        svgIcon: `<path d="M5 12C5 8.13401 8.13401 5 12 5M16.4999 7.5L11.9999 12M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM13 12C13 12.5523 12.5523 13 12 13C11.4477 13 11 12.5523 11 12C11 11.4477 11.4477 11 12 11C12.5523 11 13 11.4477 13 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
        check: () => false,
    },
    {
        id: 'the_2048', cat: 'secret', name: 'Power of Two', type: 'single',
        rarity: 'legendary', clue: 'A familiar number for puzzle fans.',
        desc: 'Score exactly 2,048 in a game.',
        svgIcon: `<text x="3" y="17" font-size="13" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="11" y="10" font-size="8" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">10</text>`,
        check: () => false,
    },
    // ── MISSIONS ──────────────────────────────────────────────
    {
        id: 'mq_first_easy', cat: 'basic', name: 'First Steps', type: 'single',
        rarity: 'common', clue: 'Every journey begins somewhere.',
        desc: 'Complete your first Easy daily quest.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_normal_10', cat: 'basic', name: 'Quest Veteran', type: 'single',
        rarity: 'rare', clue: 'A veteran of the grind.',
        desc: 'Complete 10 Normal tier daily quests.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_hard_5', cat: 'basic', name: 'Hard Worker', type: 'single',
        rarity: 'epic', clue: 'You don\'t back down from a challenge.',
        desc: 'Complete 5 Hard tier daily quests.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_secret_1', cat: 'basic', name: 'Secret Keeper', type: 'single',
        rarity: 'epic', clue: 'Not everything is what it seems.',
        desc: 'Complete a Secret daily quest.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_total_50', cat: 'basic', name: 'Quest Machine', type: 'single',
        rarity: 'legendary', clue: 'Fifty goals. Fifty victories.',
        desc: 'Complete 50 total daily quests.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_streak_7', cat: 'basic', name: 'Week Warrior', type: 'single',
        rarity: 'rare', clue: 'Seven days in a row.',
        desc: 'Maintain a 7-day daily quest streak.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_streak_30', cat: 'basic', name: 'Monthly Master', type: 'single',
        rarity: 'legendary', clue: 'Thirty days of dedication.',
        desc: 'Maintain a 30-day daily quest streak.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    // ── TIERED MISSION COUNT BADGES ───────────────────────────────────────
    {
        id: 'mq_easy_quests', cat: 'basic', name: 'Easy Runner', type: 'tiered',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        counter: { path: 'missions.stats.byTier.easy', label: 'Easy Quests Done' },
        tiers: [
            { rarity: 'common',    name: 'Casual Grinder', desc: 'Complete 10 Easy quests (daily or weekly)',    progress: { path: 'missions.stats.byTier.easy', target: 10  } },
            { rarity: 'rare',      name: 'Easy Streak',    desc: 'Complete 30 Easy quests (daily or weekly)',    progress: { path: 'missions.stats.byTier.easy', target: 30  } },
            { rarity: 'epic',      name: 'Green Thumb',    desc: 'Complete 50 Easy quests (daily or weekly)',    progress: { path: 'missions.stats.byTier.easy', target: 50  } },
        ],
    },
    {
        id: 'mq_normal_quests', cat: 'basic', name: 'Middle Ground', type: 'tiered',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        counter: { path: 'missions.stats.byTier.normal', label: 'Normal Quests Done' },
        tiers: [
            { rarity: 'common',    name: 'Solid Player',   desc: 'Complete 10 Normal quests (daily or weekly)',  progress: { path: 'missions.stats.byTier.normal', target: 10  } },
            { rarity: 'rare',      name: 'Blue Collar',    desc: 'Complete 30 Normal quests (daily or weekly)',  progress: { path: 'missions.stats.byTier.normal', target: 30  } },
            { rarity: 'epic',      name: 'Mid Grinder',    desc: 'Complete 50 Normal quests (daily or weekly)',  progress: { path: 'missions.stats.byTier.normal', target: 50  } },
        ],
    },
    {
        id: 'mq_hard_quests', cat: 'basic', name: 'Hard Core', type: 'tiered',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        counter: { path: 'missions.stats.byTier.hard', label: 'Hard Quests Done' },
        tiers: [
            { rarity: 'rare',      name: 'Red Zone',       desc: 'Complete 5 Hard quests (daily or weekly)',    progress: { path: 'missions.stats.byTier.hard', target: 5   } },
            { rarity: 'epic',      name: 'Hard Earned',    desc: 'Complete 15 Hard quests (daily or weekly)',   progress: { path: 'missions.stats.byTier.hard', target: 15  } },
            { rarity: 'legendary', name: 'Relentless',     desc: 'Complete 25 Hard quests (daily or weekly)',   progress: { path: 'missions.stats.byTier.hard', target: 25  } },
        ],
    },
    {
        id: 'mq_total_quests', cat: 'basic', name: 'The Grind', type: 'tiered',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        counter: { path: 'missions.stats.totalCompleted', label: 'Total Quests Done' },
        tiers: [
            { rarity: 'common',    name: 'Quest Taker',    desc: 'Complete 30 quests total',                    progress: { path: 'missions.stats.totalCompleted', target: 30  } },
            { rarity: 'rare',      name: 'Mission Count',  desc: 'Complete 80 quests total',                    progress: { path: 'missions.stats.totalCompleted', target: 80  } },
            { rarity: 'epic',      name: 'The Grind',      desc: 'Complete 130 quests total',                   progress: { path: 'missions.stats.totalCompleted', target: 130 } },
            { rarity: 'legendary', name: 'Committed',      desc: 'Complete 200 quests total',                   progress: { path: 'missions.stats.totalCompleted', target: 200 } },
        ],
    },
    {
        id: 'mq_secret_quests', cat: 'basic', name: 'Secret Hunter', type: 'tiered',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        counter: { path: 'missions.stats.byTier.secret', label: 'Secret Quests Done' },
        tiers: [
            { rarity: 'common',    name: 'Curious',        desc: 'Complete 2 Secret daily quests',              progress: { path: 'missions.stats.byTier.secret', target: 2   } },
            { rarity: 'rare',      name: 'Mystery Hunter', desc: 'Complete 5 Secret daily quests',              progress: { path: 'missions.stats.byTier.secret', target: 5   } },
            { rarity: 'epic',      name: 'The Unseen',     desc: 'Complete 10 Secret daily quests',             progress: { path: 'missions.stats.byTier.secret', target: 10  } },
        ],
    },
    // ── SECRET MISSION CHALLENGE BADGES ──────────────────────────────────
    {
        id: 'mq_daily_perfect', cat: 'secret', name: 'Perfect Day', type: 'single',
        rarity: 'mythic', clue: 'All 5 quests AND the secret — flawless.',
        desc: 'Complete all 5 daily quests AND the secret quest in one day.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_all_cleared', cat: 'secret', name: 'All Cleared', type: 'single',
        rarity: 'epic', clue: 'A perfect week — nothing left undone.',
        desc: 'Complete all weekly missions AND all 5 daily quests every day for an entire week.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_no_easy_epic', cat: 'secret', name: 'No Easy Day', type: 'single',
        rarity: 'epic', clue: 'The easy path is not for you.',
        desc: 'Have at least 4 Normal-or-harder daily quests rolled in one day.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_no_easy_legendary', cat: 'secret', name: 'No Easy Day', type: 'single',
        rarity: 'legendary', clue: 'Only the hardest.',
        desc: 'Have at least 3 Hard daily quests rolled in one day.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_hard_they_said', cat: 'secret', name: 'Hard They Said', type: 'single',
        rarity: 'epic', clue: 'You proved a point.',
        desc: 'Complete only the Hard weekly mission — leave all others unfinished.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_lazy_lucky', cat: 'secret', name: 'Lazy or Lucky?', type: 'single',
        rarity: 'epic', clue: 'One day, one secret, nothing more.',
        desc: 'Complete only the secret daily quest in a day — leave all regular quests unfinished.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_barely', cat: 'secret', name: 'Barely', type: 'single',
        rarity: 'epic', clue: 'You survived without the rewards.',
        desc: 'Keep a 7+ daily streak for a whole week without claiming any milestone rewards.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    {
        id: 'mq_double_badge', cat: 'secret', name: 'Two Birds', type: 'single',
        rarity: 'rare', clue: 'One run. Two victories.',
        desc: 'Unlock any 2 achievements in a single game.',
        svgIcon: `<text x="3" y="16" font-size="14" font-weight="900" fill="currentColor" stroke="none" font-family="sans-serif">!!!</text>`,
        check: () => false,
    },
    ];

    // Patch collector badge — set final tier target to total buyable items
    (function() {
        const coll = ACHIEVEMENTS_DEF.find(a => a.id === 'collector');
        if (!coll || !coll.tiers) return;
        // Count buyable items (exclude defaults: neon skin, default theme, lines grid, classic palette, default sfx)
        const _buyable = 7 + (Object.keys(THEMES).length - 1) + (Object.keys(GRID_STYLES).length - 1) + (Object.keys(BLOCK_PALETTES).length - 1) + 4 + 1;
        const finalTier = coll.tiers[coll.tiers.length - 1];
        if (finalTier) finalTier.progress = { path: '_computed.itemsBought', target: _buyable };
    })();

    function _getProgressVal(path) {
        if (path === '_computed.itemsCollected') {
            const _os = (saveData.ownedSkins || ['neon']).length;
            const _ot = (saveData.ownedThemes || []).length + 1;
            const _og = (saveData.ownedGridStyles || []).length + 1;
            const _op = (saveData.ownedPalettes || ['classic']).length;
            const _ox = (saveData.ownedSfxPacks || ['default']).length;
            const _gh = saveData.ghostColorUnlocked ? 1 : 0;
            return _os + _ot + _og + _op + _ox + _gh;
        }
        if (path === '_computed.itemsBought') {
            // Count only non-default/non-free items
            const _os = (saveData.ownedSkins || ['neon']).filter(s => s !== 'neon').length;
            const _ot = (saveData.ownedThemes || []).length; // default not in array
            const _og = (saveData.ownedGridStyles || []).length; // free 'lines' not in array
            const _op = (saveData.ownedPalettes || ['classic']).filter(p => p !== 'classic').length;
            const _ox = (saveData.ownedSfxPacks || ['default']).filter(s => s !== 'default').length;
            const _gh = saveData.ghostColorUnlocked ? 1 : 0;
            return _os + _ot + _og + _op + _ox + _gh;
        }
        if (path === '_computed.achievementsUnlocked') {
            if (!saveData.achievements) return 0;
            let count = 0;
            for (const a of ACHIEVEMENTS_DEF) {
                const st = saveData.achievements[a.id];
                if (!st) continue;
                if (a.type === 'tiered') count += (st.tier || 0);
                else if (st.unlocked) count++;
            }
            return count;
        }
        const parts = path.split('.');
        let obj = saveData;
        for (const p of parts) { if (obj == null) return 0; obj = obj[p]; }
        return typeof obj === 'number' ? obj : 0;
    }

    function _fmtCounter(counter, v) {
        if (counter.fmt === 'time') {
            const m = Math.floor(v / 60), s = v % 60;
            return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
        }
        if (counter.fmt === 'combo') return '×' + v.toLocaleString();
        return v.toLocaleString() + (counter.unit ? ' ' + counter.unit : '');
    }

    function unlockAchievement(id) {
        if (!saveData.achievements) saveData.achievements = {};
        if (!saveData.pendingAchievementClaims) saveData.pendingAchievementClaims = [];
        const ach = ACHIEVEMENTS_DEF.find(a => a.id === id);
        if (!ach) return false;
        if (ach.type === 'tiered') {
            const cur = saveData.achievements[id]?.tier || 0;
            if (cur >= ach.tiers.length) return false;
            // Add pending claim for each newly unlocked tier
            for (let i = cur; i < ach.tiers.length; i++) {
                const tier = ach.tiers[i];
                const xp = _ACH_XP[tier.rarity] || 500;
                saveData.pendingAchievementClaims.push({ id, tierNum: i + 1, rarity: tier.rarity, xp, name: tier.name });
            }
            saveData.achievements[id] = { tier: ach.tiers.length };
            playSFX('achievement');
            _checkAchGlow();
            const _menuEl1 = document.getElementById('menu-overlay');
            if (_menuEl1 && !_menuEl1.classList.contains('hidden')) _showMenuAchPopup(ach);
            return true;
        }
        if (saveData.achievements[id]?.unlocked) return false;
        const now = new Date();
        const d = String(now.getDate()).padStart(2,'0'), m = String(now.getMonth()+1).padStart(2,'0'), y = now.getFullYear();
        saveData.achievements[id] = { unlocked: true, unlockedAt: `${d}.${m}.${y}` };
        // Add pending claim for single achievement
        const xp = _ACH_XP[ach.rarity] || 500;
        saveData.pendingAchievementClaims.push({ id, rarity: ach.rarity, xp, name: ach.name });
        playSFX('achievement');
        _checkAchGlow();
        // Menu popup
        const _menuEl2 = document.getElementById('menu-overlay');
        if (_menuEl2 && !_menuEl2.classList.contains('hidden')) _showMenuAchPopup(ach);
        // Track per-game badge count for "Two Birds" (mq_double_badge)
        if (id !== 'mq_double_badge') {
            _achsThisGame++;
            if (_achsThisGame >= 2 && !saveData.achievements?.['mq_double_badge']?.unlocked) {
                unlockAchievement('mq_double_badge');
            }
        }
        return true;
    }
    function _showMenuAchPopup(ach) {
        const rc = RARITY_ACH[ach.rarity || (ach.tiers ? ach.tiers[0].rarity : 'common')] || RARITY_ACH.common;
        const el = document.createElement('div');
        el.style.cssText = `position:fixed;bottom:-80px;right:20px;z-index:9990;background:rgba(5,5,20,0.97);border:1px solid ${rc.color};border-radius:12px;padding:10px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 24px rgba(0,0,0,0.7),0 0 16px ${rc.color}30;min-width:200px;max-width:320px;font-family:inherit;transition:bottom 0.4s cubic-bezier(.22,.68,0,1.2),opacity 0.3s ease;opacity:0;`;
        el.innerHTML = `<div style="width:36px;height:36px;border-radius:50%;background:${rc.color}22;border:1px solid ${rc.color}55;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 24 24" width="20" height="20" style="color:${rc.color};">${ach.svgIcon}</svg></div><div><div style="font-size:0.55rem;color:${rc.color};font-weight:bold;letter-spacing:1.5px;">${rc.label}</div><div style="font-size:0.72rem;font-weight:bold;color:#fff;">${ach.name}</div></div>`;
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.bottom = '20px'; el.style.opacity = '1'; });
        setTimeout(() => { el.style.bottom = '-80px'; el.style.opacity = '0'; }, 4500);
        setTimeout(() => el.remove(), 5200);
    }

    function checkAchievements(gameData) {
        if (!saveData.achievements) saveData.achievements = {};
        if (!saveData.pendingAchievementClaims) saveData.pendingAchievementClaims = [];
        const newlyUnlocked = [];
        for (const ach of ACHIEVEMENTS_DEF) {
            if (ach.type === 'tiered') {
                let current = saveData.achievements[ach.id]?.tier || 0;
                if (current >= ach.tiers.length) continue;
                for (let i = current; i < ach.tiers.length; i++) {
                    const tier = ach.tiers[i];
                    const triggered = tier.progress
                        ? _getProgressVal(tier.progress.path) >= tier.progress.target
                        : typeof tier.check === 'function' && tier.check(gameData);
                    if (triggered) {
                        if (!saveData.achievements[ach.id]) saveData.achievements[ach.id] = {};
                        saveData.achievements[ach.id].tier = i + 1;
                        if (!saveData.achievements[ach.id].tierDates) saveData.achievements[ach.id].tierDates = {};
                        if (!saveData.achievements[ach.id].tierDates[i+1]) {
                            const _nd = new Date(); saveData.achievements[ach.id].tierDates[i+1] = `${String(_nd.getDate()).padStart(2,'0')}.${String(_nd.getMonth()+1).padStart(2,'0')}.${_nd.getFullYear()}`;
                        }
                        // Add pending claim for this tier
                        const xp = _ACH_XP[tier.rarity] || 500;
                        saveData.pendingAchievementClaims.push({ id: ach.id, tierNum: i + 1, rarity: tier.rarity, xp, name: tier.name });
                        current = i + 1;
                        newlyUnlocked.push({ ...ach, _newTier: tier, _newTierNum: i + 1 });
                    } else { break; }
                }
            } else {
                if (saveData.achievements[ach.id]?.unlocked) continue;
                if (ach.check && ach.check(gameData)) {
                    unlockAchievement(ach.id);
                    newlyUnlocked.push(ach);
                }
            }
        }
        if (newlyUnlocked.length) _checkAchGlow();
        return newlyUnlocked;
    }

    function checkAchievementsOnLoad() {
        if (!saveData.achievements) saveData.achievements = {};
        if (!saveData.pendingAchievementClaims) saveData.pendingAchievementClaims = [];
        let changed = false;
        for (const ach of ACHIEVEMENTS_DEF) {
            if (ach.type !== 'tiered') continue;
            let current = saveData.achievements[ach.id]?.tier || 0;
            if (current >= ach.tiers.length) continue;
            for (let i = current; i < ach.tiers.length; i++) {
                const tier = ach.tiers[i];
                const pInfo = tier.progress || tier.progressDisplay;
                if (pInfo) {
                    if (_getProgressVal(pInfo.path) >= pInfo.target) {
                        if (!saveData.achievements[ach.id]) saveData.achievements[ach.id] = {};
                        saveData.achievements[ach.id].tier = i + 1;
                        const xp = _ACH_XP[tier.rarity] || 500;
                        saveData.pendingAchievementClaims.push({ id: ach.id, tierNum: i + 1, rarity: tier.rarity, xp, name: tier.name });
                        current = i + 1;
                        changed = true;
                    } else break;
                } else if (tier.check) {
                    // Check against best known stats from leaderboard
                    const _lbBest = (saveData.leaderboard || []).reduce((best, e) => ({
                        score: Math.max(best.score, e.score || 0),
                        maxSpeed: Math.max(best.maxSpeed, e.maxSpeed || 0),
                        lines: Math.max(best.lines, e.lines || 0),
                        time: Math.max(best.time, e.time || 0),
                    }), { score: saveData.highscore || 0, maxSpeed: 0, lines: 0, time: 0 });
                    if (tier.check({ ..._lbBest, mode: 'normal', blocks: 0, quadraKill: false, boardCleared: false, maxLineStreak: 0, maxBlocksIn60s: 0, iPieceLines: 0, clearedTopLine: false, highPlacer: 0, noRotate: false, equalPieces: false, luckySevenCount: 0, waitedTetris: false, noHardDrop: false, allHardDrop: false, bigFont: false, exactBlocks100: false, speedrunner: 9999, earlyBird: false })) {
                        if (!saveData.achievements[ach.id]) saveData.achievements[ach.id] = {};
                        saveData.achievements[ach.id].tier = i + 1;
                        const xp = _ACH_XP[tier.rarity] || 500;
                        saveData.pendingAchievementClaims.push({ id: ach.id, tierNum: i + 1, rarity: tier.rarity, xp, name: tier.name });
                        current = i + 1;
                        changed = true;
                    } else break;
                }
            }
        }
        if (changed) { _checkAchGlow(); if (fileHandle) saveDataToFile(); }
    }

    function checkProgressAchievements() {
        // Re-verify all progress-based tiered achievements against current saveData values
        // Returns newly unlocked achievements (for toast display)
        if (!saveData.achievements) saveData.achievements = {};
        if (!saveData.pendingAchievementClaims) saveData.pendingAchievementClaims = [];
        const newlyUnlocked = [];
        // Backfill missing tierDates for already-unlocked tiers (set when first observed)
        const _today = (() => { const n = new Date(); return `${String(n.getDate()).padStart(2,'0')}.${String(n.getMonth()+1).padStart(2,'0')}.${n.getFullYear()}`; })();
        for (const ach of ACHIEVEMENTS_DEF) {
            if (ach.type !== 'tiered') continue;
            const _curT = saveData.achievements?.[ach.id]?.tier || 0;
            if (_curT === 0) continue;
            if (!saveData.achievements[ach.id].tierDates) saveData.achievements[ach.id].tierDates = {};
            for (let i = 0; i < _curT; i++) {
                if (!saveData.achievements[ach.id].tierDates[i+1])
                    saveData.achievements[ach.id].tierDates[i+1] = _today;
            }
        }
        for (const ach of ACHIEVEMENTS_DEF) {
            if (ach.type !== 'tiered') continue;
            let current = saveData.achievements[ach.id]?.tier || 0;
            if (current >= ach.tiers.length) continue;
            for (let i = current; i < ach.tiers.length; i++) {
                const tier = ach.tiers[i];
                if (!tier.progress) continue;
                if (_getProgressVal(tier.progress.path) >= tier.progress.target) {
                    if (!saveData.achievements[ach.id]) saveData.achievements[ach.id] = {};
                    saveData.achievements[ach.id].tier = i + 1;
                    if (!saveData.achievements[ach.id].tierDates) saveData.achievements[ach.id].tierDates = {};
                    if (!saveData.achievements[ach.id].tierDates[i+1]) {
                        const _nd = new Date(); saveData.achievements[ach.id].tierDates[i+1] = `${String(_nd.getDate()).padStart(2,'0')}.${String(_nd.getMonth()+1).padStart(2,'0')}.${_nd.getFullYear()}`;
                    }
                    // Add pending claim for this tier
                    const xp = _ACH_XP[tier.rarity] || 500;
                    saveData.pendingAchievementClaims.push({ id: ach.id, tierNum: i + 1, rarity: tier.rarity, xp, name: tier.name });
                    current = i + 1;
                    newlyUnlocked.push({ ...ach, _newTier: tier, _newTierNum: i + 1 });
                } else break;
            }
        }
        if (newlyUnlocked.length) _checkAchGlow();
        return newlyUnlocked;
    }

    // Pool of secret badge icons — deterministically assigned by achievement id hash
    // Same opacity as locked basic badges (iconColor = #2e2e3a)
    const _SECRET_ICON_POOL = [
        // Eye crossed out
        `<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="1.2"/>`,
        // Lock (smaller)
        `<rect x="7" y="12" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/><path d="M9 12V9a3 3 0 016 0v3" fill="none" stroke="currentColor" stroke-width="1"/>`,
        // Eye crossed out (same direction as first)
        `<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="1.2"/>`,
        // ? standalone
        `<path d="M9 9c0-2 1.5-3 3-3s3 1 3 3-1.5 2-3 3v1" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="12" cy="17" r="1" fill="currentColor"/>`,
    ];
    function _getSecretQMark(rarity, achId) {
        // Deterministic hash of achievement id to pick icon
        let hash = 0;
        for (let i = 0; i < (achId || '').length; i++) hash = ((hash << 5) - hash + (achId || '').charCodeAt(i)) | 0;
        const idx = Math.abs(hash) % _SECRET_ICON_POOL.length;
        return _SECRET_ICON_POOL[idx];
    }
    function _achShapeStyle(rarity) {
        switch(rarity) {
            case 'common':    return { outer: 'border-radius:50%;', inner: 'border-radius:50%;' };
            case 'rare':      return { outer: 'border-radius:3px;', inner: 'border-radius:2px;' };
            case 'epic':      return { outer: 'clip-path:polygon(25% 6.7%,75% 6.7%,100% 50%,75% 93.3%,25% 93.3%,0% 50%);', inner: 'clip-path:polygon(25% 6.7%,75% 6.7%,100% 50%,75% 93.3%,25% 93.3%,0% 50%);' };
            case 'legendary': return { outer: 'clip-path:polygon(50% 0%,64.5% 14.9%,85.4% 14.6%,85.1% 35.5%,100% 50%,85.1% 64.5%,85.4% 85.4%,64.5% 85.1%,50% 100%,35.5% 85.1%,14.6% 85.4%,14.9% 64.5%,0% 50%,14.9% 35.5%,14.6% 14.6%,35.5% 14.9%);', inner: 'clip-path:polygon(50% 0%,64.5% 14.9%,85.4% 14.6%,85.1% 35.5%,100% 50%,85.1% 64.5%,85.4% 85.4%,64.5% 85.1%,50% 100%,35.5% 85.1%,14.6% 85.4%,14.9% 64.5%,0% 50%,14.9% 35.5%,14.6% 14.6%,35.5% 14.9%);' };
            case 'mythic':    return { outer: 'clip-path:polygon(50% 0%,60% 11%,75% 7%,78% 22%,93% 25%,89% 40%,100% 50%,89% 60%,93% 75%,78% 78%,75% 93%,60% 89%,50% 100%,40% 89%,25% 93%,22% 78%,7% 75%,11% 60%,0% 50%,11% 40%,7% 25%,22% 22%,25% 7%,40% 11%);', inner: 'clip-path:polygon(50% 0%,60% 11%,75% 7%,78% 22%,93% 25%,89% 40%,100% 50%,89% 60%,93% 75%,78% 78%,75% 93%,60% 89%,50% 100%,40% 89%,25% 93%,22% 78%,7% 75%,11% 60%,0% 50%,11% 40%,7% 25%,22% 22%,25% 7%,40% 11%);' };
            default:          return { outer: 'border-radius:50%;', inner: 'border-radius:50%;' };
        }
    }
    // SVG path for achievement badge progress outline — inset by half the border width (1.5px)
    // so the progress stroke aligns with the center of the 3px badge border
    function _achShapePath(rarity, s) {
        const c = s / 2; // center
        const inset = 1.5; // half of 3px border
        if (rarity === 'common') {
            const r = c - inset;
            return `M${c},${inset} A${r},${r} 0 1,1 ${c - 0.01},${inset} Z`;
        }
        if (rarity === 'rare') {
            // Start from top-center, go clockwise
            return `M${c},${inset} L${s-inset},${inset} L${s-inset},${s-inset} L${inset},${s-inset} L${inset},${inset} Z`;
        }
        // Polygon shapes: scale percentage points inward toward center by inset amount
        // Points ordered to start from top-center (or nearest to top-center)
        const rawPts = {
            epic:      [[50,6.7],[75,6.7],[100,50],[75,93.3],[25,93.3],[0,50],[25,6.7]],
            legendary: [[50,0],[64.5,14.9],[85.4,14.6],[85.1,35.5],[100,50],[85.1,64.5],[85.4,85.4],[64.5,85.1],[50,100],[35.5,85.1],[14.6,85.4],[14.9,64.5],[0,50],[14.9,35.5],[14.6,14.6],[35.5,14.9]],
            mythic:    [[50,0],[60,11],[75,7],[78,22],[93,25],[89,40],[100,50],[89,60],[93,75],[78,78],[75,93],[60,89],[50,100],[40,89],[25,93],[22,78],[7,75],[11,60],[0,50],[11,40],[7,25],[22,22],[25,7],[40,11]],
        };
        const pts = rawPts[rarity] || rawPts.epic;
        // Convert to pixel coords and shrink toward center by inset
        const mapped = pts.map(([px, py]) => {
            const x = px * s / 100, y = py * s / 100;
            const dx = x - c, dy = y - c;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            return [x - dx / dist * inset, y - dy / dist * inset];
        });
        return 'M' + mapped.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L') + ' Z';
    }
    // Cache path lengths to avoid measuring each render
    const _achPathLenCache = new Map();
    function _achProgressOutlineSvg(rarity, pct, color, size) {
        if (pct <= 0) return '';
        const d = _achShapePath(rarity, size);
        const cacheKey = `${rarity}_${size}`;
        let totalLen = _achPathLenCache.get(cacheKey);
        if (totalLen === undefined) {
            const ns = 'http://www.w3.org/2000/svg';
            const tmpSvg = document.createElementNS(ns, 'svg');
            tmpSvg.setAttribute('width', '0'); tmpSvg.setAttribute('height', '0');
            tmpSvg.style.cssText = 'position:absolute;visibility:hidden;';
            const tmpPath = document.createElementNS(ns, 'path');
            tmpPath.setAttribute('d', d);
            tmpSvg.appendChild(tmpPath);
            document.body.appendChild(tmpSvg);
            totalLen = tmpPath.getTotalLength();
            document.body.removeChild(tmpSvg);
            _achPathLenCache.set(cacheKey, totalLen);
        }
        const filled = totalLen * Math.min(1, pct);
        return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="position:absolute;inset:0;pointer-events:none;z-index:2;">
            <path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"
                stroke-dasharray="${filled} ${totalLen - filled}" stroke-dashoffset="0" opacity="0.85"/>
        </svg>`;
    }

    function _spawnAchClaimFloat(x, y, xp, color) {
        const el = document.createElement('div');
        el.style.cssText = `position:fixed;z-index:9999;pointer-events:none;left:${x}px;top:${y}px;transform:translate(-50%,0);font-family:'Orbitron',sans-serif;font-size:0.85rem;font-weight:900;color:${color};text-shadow:0 0 12px ${color},0 0 24px ${color}60,0 2px 6px rgba(0,0,0,0.7);white-space:nowrap;opacity:1;transition:transform 0.8s cubic-bezier(.22,.68,0,1.1),opacity 0.8s ease;`;
        el.textContent = `+${xp.toLocaleString()} XP`;
        document.body.appendChild(el);
        requestAnimationFrame(() => {
            el.style.transform = 'translate(-50%,-60px)';
            el.style.opacity = '0';
        });
        setTimeout(() => el.remove(), 900);
    }

    function _isColoredSvg(s) { return s && /(fill|stroke)="#[0-9a-fA-F]/i.test(s); }

    function _checkAchGlow() {
        const hasPending = saveData.pendingAchievementClaims?.length > 0;
        const achBtn = document.querySelector('[onclick="window.openAchievements()"]');
        if (achBtn) { achBtn.classList.toggle('glow-notify', hasPending); _updateBtnSweep(achBtn, hasPending); }
    }

    function _showGoAchievements(list) {
        const el = document.getElementById('go-achievements-new');
        if (!el) return;
        if (!list || !list.length) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.innerHTML = `<div style="font-size:0.6rem;color:var(--gold);font-weight:bold;letter-spacing:2px;margin-bottom:8px;text-align:center;opacity:0;transform:translateY(-8px);transition:opacity 0.35s ease,transform 0.35s ease;" class="go-ach-header">🏆 NEW ACHIEVEMENT${list.length>1?'S':''}!</div>` +
            list.map(a => {
                const rarity = a._newTier ? a._newTier.rarity : a.rarity;
                const name   = a._newTier ? a._newTier.name   : a.name;
                const rc = RARITY_ACH[rarity] || RARITY_ACH.common;
                const sh = _achShapeStyle(rarity);
                const tierBadge = a._newTierNum ? ` <span style="font-size:0.45rem;color:${rc.color};"> TIER ${a._newTierNum}</span>` : '';
                return `<div class="go-ach-card" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid ${rc.color}40;margin-bottom:5px;opacity:0;transform:translateX(-18px);transition:opacity 0.4s ease,transform 0.4s ease;box-shadow:0 2px 12px ${rc.color}20;">
                    <div style="width:32px;height:32px;${sh.outer}background:${rc.color}55;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <svg viewBox="0 0 24 24" width="18" height="18" ${_isColoredSvg(a.svgIcon)?'class="ach-badge-colored"':`class="ach-badge-icon" style="color:#fff;--glow-c:${rc.color};"`}>${a.svgIcon}</svg>
                    </div>
                    <div>
                        <div style="font-size:0.68rem;font-weight:bold;color:#fff;">${name}${tierBadge}</div>
                        <div style="font-size:0.55rem;color:${rc.color};font-weight:bold;letter-spacing:1px;">${rc.label}</div>
                    </div>
                </div>`;
            }).join('');
        // stagger animation
        const header = el.querySelector('.go-ach-header');
        const cards = el.querySelectorAll('.go-ach-card');
        setTimeout(() => { if (header) { header.style.opacity='1'; header.style.transform='translateY(0)'; } }, 60);
        cards.forEach((card, i) => setTimeout(() => { card.style.opacity='1'; card.style.transform='translateX(0)'; }, 180 + i * 130));
    }

    function _showGameAchievement(ach, tierIdx) {
        const feed = document.getElementById('game-ach-feed');
        if (!feed) return;
        const tier = ach.tiers ? ach.tiers[tierIdx] : { rarity: ach.rarity, name: ach.name };
        const RARITY_COLORS = { common:'#4caf50', rare:'#4499ff', epic:'#9932cc', legendary:'#ff9900', mythic:'#cc1111' };
        const c = RARITY_COLORS[tier.rarity] || '#888';
        const card = document.createElement('div');
        const existingCount = feed.children.length;
        card.style.cssText = `margin-top:${existingCount > 0 ? '-8px' : '0'};position:relative;z-index:${10 + existingCount};background:rgba(5,5,20,0.93);border:1px solid ${c}44;border-radius:6px;padding:5px 8px;display:flex;align-items:center;gap:6px;font-family:inherit;transition:margin-top 0.2s;`;
        card.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="${c}" stroke-width="1.8">${ach.svgIcon || ''}</svg><div style="min-width:0;"><div style="font-size:0.5rem;color:${c};letter-spacing:1px;text-transform:uppercase;">${tier.rarity}</div><div style="font-size:0.58rem;color:#ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;">${tier.name || ach.name}</div></div>`;
        feed.appendChild(card);
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        requestAnimationFrame(() => {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '1';
            card.style.transform = 'translateX(0)';
        });
    }

    function _showAchievementToast(list) {
        if (!list || !list.length) return;
        const existing = document.querySelectorAll('.ach-menu-toast');
        const stackOffset = existing.length * 82;
        let delay = 0;
        list.forEach((a, idx) => {
            const rarity = a._newTier ? a._newTier.rarity : a.rarity;
            const name   = a._newTier ? a._newTier.name   : a.name;
            const rc = RARITY_ACH[rarity] || RARITY_ACH.common;
            const sh = _achShapeStyle(rarity);
            const tierBadge = a._newTierNum ? ` <span style="font-size:0.5rem;opacity:0.8;">TIER ${a._newTierNum}</span>` : '';
            const toast = document.createElement('div');
            toast.className = 'ach-menu-toast';
            toast.setAttribute('role', 'status');
            toast.style.cssText = `
                position:fixed;top:${16 + (stackOffset + idx * 82)}px;left:50%;transform:translateX(-50%) translateY(-70px);
                z-index:9990;opacity:0;
                background:rgba(5,5,20,0.97);border:1px solid ${rc.color};border-radius:12px;
                padding:10px 16px;display:flex;align-items:center;gap:10px;
                box-shadow:0 4px 24px rgba(0,0,0,0.7),0 0 16px ${rc.color}40;
                min-width:220px;max-width:320px;pointer-events:none;
                font-family:inherit;transition:transform 0.35s cubic-bezier(.22,.68,0,1.2),opacity 0.3s ease;
            `;
            toast.innerHTML = `
                <div style="width:38px;height:38px;flex-shrink:0;${sh.outer}background:${rc.color}55;display:flex;align-items:center;justify-content:center;">
                    <svg viewBox="0 0 24 24" width="22" height="22" ${_isColoredSvg(a.svgIcon)?'class="ach-badge-colored"':`class="ach-badge-icon" style="color:#fff;--glow-c:${rc.color};"`}>${a.svgIcon}</svg>
                </div>
                <div>
                    <div style="font-size:0.58rem;color:var(--gold);font-weight:bold;letter-spacing:2px;margin-bottom:2px;">ACHIEVEMENT!</div>
                    <div style="font-size:0.72rem;font-weight:bold;color:#fff;">${name}${tierBadge}</div>
                    <div style="font-size:0.55rem;color:${rc.color};font-weight:bold;letter-spacing:1px;">${rc.label}</div>
                </div>`;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(0)';
                toast.style.opacity = '1';
            }, 50 + delay);
            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(-70px)';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 350);
            }, 3200 + delay);
            delay += 220;
        });
    }

    let _achShowDates = false;

    function renderAchievementsOverlay(tab) {
        tab = tab || 'all';
        checkProgressAchievements(); // Re-verify progress-based achievements before rendering
        const overlay = document.getElementById('achievements-overlay');
        if (!overlay) return;

        // Tab switch tracking
        const _prevAchTab = overlay._achTab || null;
        overlay._achTab = tab;
        const _isAchTabSwitch = !!_prevAchTab && _prevAchTab !== tab;
        const _ACH_ORD = ['all', 'unlocked', 'locked'];

        overlay.querySelectorAll('[data-achtab]').forEach(b => b.classList.toggle('active', b.dataset.achtab === tab));

        const container = document.getElementById('ach-list');
        if (!container) return;

        // Exit animation clone on tab switch
        if (_isAchTabSwitch && container.innerHTML.trim()) {
            const _bRect = container.getBoundingClientRect();
            const _exitEl = document.createElement('div');
            _exitEl.style.cssText = `position:fixed;top:${_bRect.top}px;left:${_bRect.left}px;width:${_bRect.width}px;height:${_bRect.height}px;pointer-events:none;z-index:2000;overflow:hidden;`;
            _exitEl.innerHTML = container.innerHTML;
            document.body.appendChild(_exitEl);
            const _oi = _ACH_ORD.indexOf(_prevAchTab), _ni = _ACH_ORD.indexOf(tab);
            _exitEl.classList.add(_ni > _oi ? 'mq-tab-slide-out-left' : 'mq-tab-slide-out-right');
            _exitEl.addEventListener('animationend', () => _exitEl.remove(), { once: true });
        }

        container.innerHTML = '';

        // Animate in new content
        if (_isAchTabSwitch) {
            const _oi = _ACH_ORD.indexOf(_prevAchTab), _ni = _ACH_ORD.indexOf(tab);
            _animateIn(container, _ni > _oi ? 'tab-slide-in-right' : 'tab-slide-in-left');
        }

        // Remove stale tooltip
        const oldTip = document.getElementById('ach-tip');
        if (oldTip) oldTip.remove();

        // --- Pending Achievement Claims Section ---
        if (saveData.pendingAchievementClaims?.length > 0) {
            const pendingSection = document.createElement('div');
            pendingSection.style.cssText = 'width:100%;margin-bottom:20px;padding:12px;border-radius:10px;background:rgba(0,255,255,0.04);border:1px solid rgba(0,255,255,0.15);';
            const pendingHeader = document.createElement('div');
            pendingHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';
            pendingHeader.innerHTML = `<span style="font-size:0.62rem;color:var(--primary);letter-spacing:2px;font-weight:bold;">PENDING REWARDS</span>`;
            if (saveData.pendingAchievementClaims.length > 1) {
                const claimAllBtn = document.createElement('button');
                claimAllBtn.className = 'btn-secondary';
                claimAllBtn.style.cssText = 'font-size:0.55rem;padding:4px 12px;min-height:unset;background:rgba(0,255,255,0.1);border:1px solid var(--primary);color:var(--primary);cursor:pointer;border-radius:6px;font-weight:bold;letter-spacing:1px;';
                claimAllBtn.textContent = 'CLAIM ALL';
                claimAllBtn.addEventListener('click', () => {
                    let totalXpGained = 0;
                    const claims = [...saveData.pendingAchievementClaims];
                    saveData.pendingAchievementClaims = [];
                    claims.forEach(c => { _grantXP(c.xp); totalXpGained += c.xp; });
                    playSFX('unlock');
                    // Floating text for total
                    const rect = claimAllBtn.getBoundingClientRect();
                    _spawnAchClaimFloat(rect.left + rect.width / 2, rect.top, totalXpGained, '#00ffff');
                    _checkAchGlow();
                    saveDataToFile();
                    drawRankBadge();
                    const activeTab = document.querySelector('[data-achtab].active')?.dataset.achtab || 'all';
                    renderAchievementsOverlay(activeTab);
                });
                pendingHeader.appendChild(claimAllBtn);
            }
            pendingSection.appendChild(pendingHeader);
            const pendingGrid = document.createElement('div');
            pendingGrid.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
            saveData.pendingAchievementClaims.forEach((claim, idx) => {
                const rc = RARITY_ACH[claim.rarity] || RARITY_ACH.common;
                const card = document.createElement('div');
                card.style.cssText = `display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid ${rc.color}30;`;
                const nameHtml = `<div style="font-size:0.48rem;color:${rc.color};font-weight:bold;letter-spacing:1px;min-width:55px;text-align:center;">${rc.label}</div><div style="flex:1;min-width:0;font-size:0.65rem;font-weight:bold;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${claim.name}</div>`;
                const xpHtml = `<div style="font-size:0.65rem;font-weight:bold;color:${rc.color};white-space:nowrap;text-shadow:0 0 8px ${rc.color}40;">+${claim.xp.toLocaleString()} XP</div>`;
                const claimBtn = document.createElement('button');
                claimBtn.className = 'btn-secondary';
                claimBtn.style.cssText = `font-size:0.5rem;padding:4px 10px;min-height:unset;background:${rc.color}18;border:1px solid ${rc.color}60;color:${rc.color};cursor:pointer;border-radius:5px;font-weight:bold;letter-spacing:1px;`;
                claimBtn.textContent = 'CLAIM';
                claimBtn.addEventListener('click', () => {
                    _grantXP(claim.xp);
                    saveData.pendingAchievementClaims.splice(idx, 1);
                    playSFX('unlock');
                    // Floating text
                    const rect = claimBtn.getBoundingClientRect();
                    _spawnAchClaimFloat(rect.left + rect.width / 2, rect.top, claim.xp, rc.color);
                    _checkAchGlow();
                    saveDataToFile();
                    drawRankBadge();
                    const activeTab = document.querySelector('[data-achtab].active')?.dataset.achtab || 'all';
                    renderAchievementsOverlay(activeTab);
                });
                card.innerHTML = nameHtml + xpHtml;
                card.appendChild(claimBtn);
                pendingGrid.appendChild(card);
            });
            pendingSection.appendChild(pendingGrid);
            container.appendChild(pendingSection);
        }

        // --- Counter (counts tiers individually) ---
        let totalCount = 0, doneCount = 0;
        for (const ach of ACHIEVEMENTS_DEF) {
            if (ach.type === 'tiered') {
                totalCount += ach.tiers.length;
                doneCount += Math.min(saveData.achievements?.[ach.id]?.tier || 0, ach.tiers.length);
            } else {
                totalCount++;
                doneCount += saveData.achievements?.[ach.id]?.unlocked ? 1 : 0;
            }
        }
        const ctr = document.getElementById('ach-counter');
        if (ctr) ctr.innerText = `${doneCount} / ${totalCount}`;

        // --- Build render items ---
        // Each tiered achievement generates: 1 unlocked card (if curTier>0) + 1 locked card (if curTier<maxTier)
        // Single achievements generate 1 card
        const renderItems = [];
        for (const ach of ACHIEVEMENTS_DEF) {
            const maxTier = ach.type === 'tiered' ? ach.tiers.length : 1;
            const curTier = ach.type === 'tiered' ? Math.min(saveData.achievements?.[ach.id]?.tier || 0, maxTier) : 0;
            const unlocked = ach.type === 'tiered' ? curTier > 0 : !!(saveData.achievements?.[ach.id]?.unlocked);
            if (ach.type === 'tiered') {
                if (curTier > 0 && (tab === 'all' || tab === 'unlocked'))
                    renderItems.push({ ach, kind: 'unlocked', curTier, maxTier });
                if (curTier < maxTier && (tab === 'all' || tab === 'locked'))
                    renderItems.push({ ach, kind: 'locked', curTier, maxTier });
            } else {
                if (tab === 'all' || (tab === 'unlocked' && unlocked) || (tab === 'locked' && !unlocked))
                    renderItems.push({ ach, kind: unlocked ? 'unlocked' : 'locked', curTier: unlocked ? 1 : 0, maxTier: 1 });
            }
        }

        // Sort: unlocked first (rarity desc), then locked (progress desc, rarity asc, name asc)
        const _RARITY_ORDER = { common:1, rare:2, epic:3, legendary:4, mythic:5 };
        function _getRarityOfItem(item) {
            const { ach, kind, curTier } = item;
            if (ach.type === 'tiered') {
                return kind === 'unlocked' ? ach.tiers[curTier - 1].rarity : ach.tiers[curTier].rarity;
            }
            return ach.rarity;
        }
        function _getProgressOfItem(item) {
            const { ach, kind, curTier } = item;
            if (kind === 'unlocked') return 1;
            if (ach.type === 'tiered' && curTier < ach.tiers.length) {
                const nxt = ach.tiers[curTier];
                const progressInfo = nxt.progress || nxt.progressDisplay;
                if (progressInfo) {
                    const cur = _getProgressVal(progressInfo.path);
                    return Math.min(1, cur / progressInfo.target);
                }
            }
            return 0;
        }
        function _getNameOfItem(item) {
            const { ach, kind, curTier } = item;
            if (ach.type === 'tiered') {
                return kind === 'unlocked' ? ach.tiers[curTier - 1].name : ach.tiers[curTier].name;
            }
            return ach.name;
        }
        renderItems.sort((a, b) => {
            // Unlocked before locked
            if (a.kind !== b.kind) return a.kind === 'unlocked' ? -1 : 1;
            // Rarity descending (mythic first)
            const ra = _RARITY_ORDER[_getRarityOfItem(a)] || 0, rb = _RARITY_ORDER[_getRarityOfItem(b)] || 0;
            if (ra !== rb) return rb - ra;
            // Same rarity: progress descending
            const pa = _getProgressOfItem(a), pb = _getProgressOfItem(b);
            if (Math.abs(pa - pb) > 0.001) return pb - pa;
            // Same rarity + progress: name alphabetical
            return _getNameOfItem(a).localeCompare(_getNameOfItem(b));
        });

        if (!renderItems.length) {
            container.innerHTML = '<div style="text-align:center;color:#555;padding:40px;font-size:0.75rem;">Nothing here yet.</div>';
            return;
        }

        // --- Floating tooltip ---
        function _posAchTip(t, e) {
            const tw = t.offsetWidth || 280, th = t.offsetHeight || 200;
            let tx = e.clientX + 14, ty = e.clientY - 10;
            if (tx + tw > window.innerWidth - 10) tx = e.clientX - tw - 10;
            if (ty + th > window.innerHeight - 10) ty = window.innerHeight - th - 10;
            if (ty < 10) ty = 10;
            if (tx < 10) tx = 10;
            t.style.left = tx + 'px'; t.style.top = ty + 'px';
        }
        const tip = document.createElement('div');
        tip.id = 'ach-tip';
        tip.style.cssText = 'display:none;position:fixed;z-index:2100;background:rgba(5,5,20,0.97);border:1px solid color-mix(in srgb, var(--primary) 30%, transparent);border-radius:8px;padding:8px 10px;min-width:270px;max-width:340px;pointer-events:none;font-family:inherit;font-size:0.68rem;color:#bbb;line-height:1.5;';
        document.body.appendChild(tip);

        // --- Build one achievement card ---
        function buildCard(item) {
            const { ach, kind, curTier, maxTier } = item;
            const isUnlocked = kind === 'unlocked';
            let rarity;
            if (ach.type === 'tiered') {
                rarity = isUnlocked ? ach.tiers[curTier - 1].rarity : ach.tiers[curTier].rarity;
            } else {
                rarity = ach.rarity;
            }
            const rc = RARITY_ACH[rarity] || RARITY_ACH.common;
            const sh = _achShapeStyle(rarity);
            const borderColor = isUnlocked ? rc.color : '#3a3a4a';
            const innerBg     = isUnlocked ? 'rgba(15,10,30,0.95)' : 'rgba(10,10,14,0.95)';
            const iconColor   = isUnlocked ? '#fff' : '#2e2e3a';
            const tierBadge = '';

            // Compute progress fraction for locked badges
            let _progressFrac = 0;
            if (!isUnlocked) {
                if (ach.type === 'tiered' && curTier < maxTier) {
                    const nxt = ach.tiers[curTier];
                    const progressInfo = nxt.progress || nxt.progressDisplay;
                    if (progressInfo) {
                        const cur2 = _getProgressVal(progressInfo.path);
                        _progressFrac = Math.min(1, cur2 / progressInfo.target);
                    }
                }
            }

            const isLeg = rarity === 'mythic';
            const isGold = rarity === 'legendary';
            const effectiveBorderColor = borderColor;
            const wrap = document.createElement('div');
            const _badgeSize = rarity === 'rare' ? 62 : 68;
            wrap.style.cssText = `position:relative;width:68px;height:68px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;`;
            const innerWrap = document.createElement('div');
            innerWrap.style.cssText = `width:${_badgeSize}px;height:${_badgeSize}px;position:relative;`;
            if (isUnlocked && isGold) {
                wrap.style.filter = 'drop-shadow(0 0 4px rgba(255,215,64,0.4))';
            }
            // Secret locked badges show ? inside rarity shape
            const isSecretLocked = ach.cat === 'secret' && !isUnlocked;
            const _secretQIcon = isSecretLocked ? _getSecretQMark(rarity, ach.id) : '';
            const _displayIcon = isSecretLocked ? _secretQIcon : ach.svgIcon;
            const _pulseDelay = (Math.random() * 20).toFixed(1);
            const _iconAttrs = isSecretLocked
                ? `style="color:#3a3a4a;"`
                : (isUnlocked ? (_isColoredSvg(_displayIcon) ? 'class="ach-badge-colored"' : `class="ach-badge-icon" style="color:#fff;--glow-c:${rc.color};--ach-pulse-delay:-${_pulseDelay}s;"`) : `style="color:${iconColor};"`);
            // Progress outline SVG for in-progress badges
            const _progressSvg = (_progressFrac > 0 && !isUnlocked) ? _achProgressOutlineSvg(rarity, _progressFrac, rc.color, _badgeSize) : '';
            innerWrap.innerHTML = `
                <div style="width:100%;height:100%;${sh.outer}background:${effectiveBorderColor};display:flex;align-items:center;justify-content:center;">
                    <div style="width:calc(100% - 6px);height:calc(100% - 6px);${sh.inner}background:${innerBg};display:flex;align-items:center;justify-content:center;position:relative;">
                        <svg viewBox="0 0 24 24" width="${isSecretLocked ? '44' : '30'}" height="${isSecretLocked ? '44' : '30'}" ${_iconAttrs}>${_displayIcon}</svg>
                        ${tierBadge}
                    </div>
                </div>
                ${_progressSvg}`;
            wrap.appendChild(innerWrap);
            // --- Tooltip content ---
            const _showAchTooltip = (e) => {
                const isSecret = ach.cat === 'secret';
                let html = '';
                if (ach.type === 'tiered') {
                    html += `<div style="font-weight:bold;color:${isUnlocked?'#fff':'#888'};margin-bottom:4px;font-size:0.72rem;white-space:nowrap;">${ach.name}</div>`;
                    if (isUnlocked) {
                        // Show all unlocked tiers
                        const tierDates = saveData.achievements?.[ach.id]?.tierDates || {};
                        for (let i = 0; i < curTier; i++) {
                            const t = ach.tiers[i]; const tr = RARITY_ACH[t.rarity] || RARITY_ACH.common;
                            html += `<div style="color:${tr.color};font-weight:bold;letter-spacing:1px;">${tr.label} — ${t.name}</div>`;
                            html += `<div style="color:#555;font-size:0.58rem;font-style:italic;margin-bottom:2px;">${t.desc}</div>`;
                            if (_achShowDates && tierDates[i+1]) html += `<div style="color:#666;font-size:0.55rem;margin-bottom:3px;">${_SVG_CALENDAR}${tierDates[i+1]}</div>`;
                        }
                        if (ach.counter && curTier >= maxTier) {
                            const cv = _getProgressVal(ach.counter.path);
                            if (cv > 0) {
                                const lastRc = RARITY_ACH[ach.tiers[maxTier - 1].rarity];
                                html += `<div style="margin-top:5px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.07);"><span style="font-size:0.55rem;color:#555;">${ach.counter.label}: </span><span style="color:${lastRc.color};font-weight:bold;">${_fmtCounter(ach.counter, cv)}</span></div>`;
                            }
                        }
                    } else {
                        const nxt = ach.tiers[curTier]; const ntr = RARITY_ACH[nxt.rarity];
                        html += `<div style="color:#888;">${curTier === 0 ? 'First tier' : 'Next'}: <span style="color:${ntr.color};">${nxt.name}</span></div>`;
                        html += `<div style="color:#888;font-style:italic;margin-top:2px;">${nxt.desc}</div>`;
                        const progressInfo = nxt.progress || nxt.progressDisplay;
                        if (progressInfo) {
                            const cur2 = _getProgressVal(progressInfo.path);
                            const pct = Math.min(100, Math.round(cur2 / progressInfo.target * 100));
                            html += `<div class="ach-progress-bar" style="margin-top:4px;width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;"><div class="ach-progress-fill" style="height:100%;width:${pct}%;background:${ntr.color};border-radius:2px;"></div></div>`;
                            html += `<div style="color:#555;margin-top:2px;">${cur2} / ${progressInfo.target}</div>`;
                        }
                        if (ach.counter && !ach.tiers.some(t => t.progress || t.progressDisplay)) {
                            const cv = _getProgressVal(ach.counter.path);
                            if (cv > 0) {
                                html += `<div style="margin-top:5px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.07);"><span style="font-size:0.55rem;color:#555;">${ach.counter.label}: </span><span style="color:${ntr.color};font-weight:bold;">${_fmtCounter(ach.counter, cv)}</span></div>`;
                            }
                        }
                    }
                    // Tier progress dots — always shown for tiered achievements
                    const _dots = ach.tiers.map((t2, i) => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${i<curTier?(RARITY_ACH[t2.rarity]?.color||'#888'):'#2a2a3a'};margin-right:2px;"></span>`).join('');
                    html += `<div style="margin:4px 0;">${_dots} <span style="color:#666;">${curTier}/${maxTier}</span></div>`;
                } else {
                    const tr = RARITY_ACH[ach.rarity] || RARITY_ACH.common;
                    const showReal = isUnlocked || !isSecret;
                    html += `<div style="font-weight:bold;color:${isUnlocked?'#fff':'#888'};margin-bottom:3px;font-size:0.72rem;white-space:nowrap;">${showReal ? ach.name : '???'}</div>`;
                    if (isUnlocked || !isSecret) html += `<div style="color:${isUnlocked?tr.color:'#555'};font-weight:bold;letter-spacing:1px;margin-bottom:5px;">${tr.label}</div>`;
                    if (isSecret && !isUnlocked) {
                        html += `<div style="color:#555;font-style:italic;">"${ach.clue}"</div>`;
                    } else {
                        html += `<div style="color:#aaa;">${ach.desc}</div>`;
                        if (_achShowDates && isUnlocked && saveData.achievements?.[ach.id]?.unlockedAt)
                            html += `<div style="color:#666;margin-top:3px;font-size:0.55rem;">${_SVG_CALENDAR}${saveData.achievements[ach.id].unlockedAt}</div>`;
                        if (isSecret && ach.clue)
                            html += `<div style="color:#555;font-style:italic;margin-top:4px;">"${ach.clue}"</div>`;
                        // "The best:" stat for specific secret badges
                        if (isUnlocked && isSecret) {
                            let _bestHtml = '';
                            if (ach.id === 'afk') {
                                const _secs = saveData.stats?.menuIdleTime || 0;
                                if (_secs > 0) { const _m = Math.floor(_secs/60), _s = _secs%60; _bestHtml = `Longest idle: ${_m}m ${String(_s).padStart(2,'0')}s`; }
                            }
                            if (_bestHtml) html += `<div style="margin-top:5px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.07);font-size:0.6rem;color:#888;">${_bestHtml}</div>`;
                        }
                    }
                }
                tip.innerHTML = html;
                tip.style.display = 'block';
                _posAchTip(tip, e);
            };
            wrap.addEventListener('mouseenter', e => { _showAchTooltip(e); });
            wrap.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
            wrap.addEventListener('mousemove', e => { _posAchTip(tip, e); });
            return wrap;
        }

        // --- Section counts (counting tiers) ---
        function sectionCounts(cat) {
            let total = 0, done = 0;
            for (const ach of ACHIEVEMENTS_DEF.filter(a => a.cat === cat)) {
                if (ach.type === 'tiered') {
                    total += ach.tiers.length;
                    done += Math.min(saveData.achievements?.[ach.id]?.tier || 0, ach.tiers.length);
                } else {
                    total++;
                    done += saveData.achievements?.[ach.id]?.unlocked ? 1 : 0;
                }
            }
            return { total, done };
        }

        // --- Render section with header ---
        function renderSection(items, title, counts) {
            if (!items.length) return;
            const section = document.createElement('div');
            section.style.cssText = 'width:100%;margin-bottom:4px;';
            const header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;';
            header.innerHTML = `<span style="font-size:0.58rem;color:#666;letter-spacing:2px;font-weight:bold;">${title}</span><span style="flex:1;height:1px;background:rgba(255,255,255,0.07);"></span><span style="font-size:0.58rem;color:#444;">${counts.done}/${counts.total}</span>`;
            section.appendChild(header);
            const grid = document.createElement('div');
            grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;justify-content:flex-start;padding:0 0 20px 0;align-items:center;';
            items.forEach(item => grid.appendChild(buildCard(item)));
            section.appendChild(grid);
            container.appendChild(section);
        }

        const sortItems = arr => [
            ...arr.filter(it => it.kind === 'unlocked'),
            ...arr.filter(it => it.kind === 'locked'),
        ];
        const basicItems  = sortItems(renderItems.filter(it => it.ach.cat === 'basic'));
        const secretItems = sortItems(renderItems.filter(it => it.ach.cat === 'secret'));
        renderSection(basicItems,  'BASIC',  sectionCounts('basic'));
        if (secretItems.length) {
            renderSection(secretItems, 'SECRET', sectionCounts('secret'));
        }
    }
    // ===================== END ACHIEVEMENTS =====================

    function getPolyPerimeter(pts) {
        let p = 0;
        for (let i = 0; i < pts.length; i++) {
            const n = pts[(i + 1) % pts.length];
            const dx = n[0] - pts[i][0], dy = n[1] - pts[i][1];
            p += Math.sqrt(dx*dx + dy*dy);
        }
        return p;
    }
    function _getShapeClipPath(shape) {
        if (!shape || shape.sides === 0) return null;
        const pts = getShapePoints(0.5, 0.5, 0.5, shape);
        return 'polygon(' + pts.map(([x, y]) => `${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%`).join(', ') + ')';
    }
    function drawPartialPoly(ctx, pts, fromLen, toLen) {
        let acc = 0, inRange = false;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const n = pts[(i + 1) % pts.length];
            const dx = n[0] - pts[i][0], dy = n[1] - pts[i][1];
            const sl = Math.sqrt(dx*dx + dy*dy);
            const ss = acc, se = acc + sl;
            acc = se;
            if (se <= fromLen || ss >= toLen) continue;
            const t0 = Math.max(0, (fromLen - ss) / sl);
            const t1 = Math.min(1, (toLen - ss) / sl);
            const x0 = pts[i][0] + dx * t0, y0 = pts[i][1] + dy * t0;
            const x1 = pts[i][0] + dx * t1, y1 = pts[i][1] + dy * t1;
            if (!inRange) { ctx.moveTo(x0, y0); inRange = true; }
            ctx.lineTo(x1, y1);
        }
        if (inRange) ctx.stroke();
    }

    const _RANK_XP_PER_LEVEL = [1000, 2000, 3500, 5500, 8000, 11000, 14500, 18500];

    function getLevelInfo(xp) {
        // Missing or invalid XP must never fall through to the endless rank.
        if (!Number.isFinite(xp)) xp = 0;
        if (xp <= 0) return { level: 1, lvlInRank: 0, currentXP: 0, neededXP: _RANK_XP_PER_LEVEL[0], percent: 0, rank: RANKS[0], isUltimateChampion: false, isLegend: false, isDiamond: false, isCelestite: false };
        let level = 0;
        let cumulative = 0;

        for (let rankIdx = 0; rankIdx < _RANK_XP_PER_LEVEL.length; rankIdx++) {
            const costPerLevel = _RANK_XP_PER_LEVEL[rankIdx];
            for (let lvlInRank = 0; lvlInRank < 10; lvlInRank++) {
                const nextBase = cumulative + costPerLevel;
                if (xp < nextBase) {
                    const r = RANKS[rankIdx];
                    const xpIntoLevel = xp - cumulative;
                    return { level: level + 1, lvlInRank: lvlInRank, currentXP: xpIntoLevel, neededXP: costPerLevel, percent: xpIntoLevel / costPerLevel, rank: r, isUltimateChampion: false, isLegend: false, isDiamond: r.name === 'DIAMOND', isCelestite: false };
                }
                level++;
                cumulative = nextBase;
            }
        }

        // Celestite — endless rank (level 81+), no shapes
        const celestiteXpPerLvl = 24000;
        const celestiteLevel = level + 1 + Math.floor((xp - cumulative) / celestiteXpPerLvl);
        const celestiteXpInto = (xp - cumulative) % celestiteXpPerLvl;
        return { level: celestiteLevel, lvlInRank: 0, currentXP: celestiteXpInto, neededXP: celestiteXpPerLvl, percent: celestiteXpInto / celestiteXpPerLvl, rank: { name: CELESTITE_RANK.name, c: CELESTITE_RANK.c, shape: null }, isUltimateChampion: false, isLegend: true, isDiamond: false, isCelestite: true };
    }
    
    // --- ORBITAL LEVEL BADGE ---
    let badgeAnimFrame = null;
    let _rankBadgeVisible = true;
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
            _rankBadgeVisible=entries.some(entry=>entry.isIntersecting);
            _syncBadgeLoop();
        }).observe(rankCanvas);
    }
    let _badgeTime = 0; // increments each frame for carousel + sway

    function _getShapePerimeter(shape, r) {
        if (!shape || shape.sides === 0) return 2 * Math.PI * r;
        const pts = getShapePoints(0, 0, r, shape);
        let perim = 0;
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            perim += Math.hypot(b[0] - a[0], b[1] - a[1]);
        }
        return perim;
    }

    function _toRoman(n) {
        if (n <= 0) return '';
        const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
        const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
        let result = '';
        for (let i = 0; i < vals.length; i++) {
            while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
        }
        return result;
    }
    function _isLightHex(hex) {
        if (!hex || hex[0] !== '#' || hex.length < 7) return false;
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return (0.299*r + 0.587*g + 0.114*b) > 160;
    }

    // --- Area-proportional fill LUTs for all rank shapes ---
    // For each shape, LUT[i] gives the height fraction h (0..1, bottom-up) such that
    // the area below h equals i% of the total shape area.

    // Circle LUT (Bronze, sides:0): analytic formula
    const _CIRCLE_FILL_LUT = (() => {
        const LUT = new Float32Array(101);
        for (let i = 0; i <= 100; i++) {
            const tf = i / 100;
            let lo = 0, hi = 1;
            for (let iter = 0; iter < 32; iter++) {
                const mid = (lo + hi) / 2;
                const frac = mid <= 0 ? 0 : mid >= 1 ? 1 : (Math.acos(1 - 2 * mid) - 2 * (1 - 2 * mid) * Math.sqrt(mid * (1 - mid))) / Math.PI;
                if (frac < tf) lo = mid; else hi = mid;
            }
            LUT[i] = (lo + hi) / 2;
        }
        return LUT;
    })();

    // Polygon fill LUT builder: computes the corrFL value (used by the fill rect in _drawMiniShape)
    // for each target area percentage, accounting for the fill rotation angle.
    //
    // In _drawMiniShape, the fill rect top is at Y = rFill*(1 - 2*corrFL) in the rotated frame.
    // The shape is clipped, so only the intersection matters. We need corrFL such that
    // the area of the shape below Y = rFill*(1-2*corrFL) equals the target percentage.
    //
    // Since the polygon is at radius r and rFill = r+4, we work in normalized coords (radius 1)
    // and account for the rFill/r scale factor.
    function _buildPolyFillLUT(shape, fillAngle, r, rFill) {
        const rawPts = getShapePoints(0, 0, 1, shape);
        if (!rawPts || rawPts.length < 3) return _CIRCLE_FILL_LUT;

        // Rotate vertices so fill direction aligns with +Y (bottom-up fill)
        const rot = -(Math.PI + fillAngle);
        const cosR = Math.cos(rot), sinR = Math.sin(rot);
        const pts = rawPts.map(([x, y]) => [x * cosR - y * sinR, x * sinR + y * cosR]);

        // Total area via shoelace
        let totalArea = 0;
        for (let i = 0; i < pts.length; i++) {
            const j = (i + 1) % pts.length;
            totalArea += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
        }
        totalArea = Math.abs(totalArea) / 2;
        if (totalArea < 1e-12) return _CIRCLE_FILL_LUT;

        // Area of polygon where y >= cutY (the filled region, since fill rises from +Y)
        function areaBelow(cutY) {
            const clipped = [];
            const n = pts.length;
            for (let i = 0; i < n; i++) {
                const curr = pts[i], next = pts[(i + 1) % n];
                const cIn = curr[1] >= cutY, nIn = next[1] >= cutY;
                if (cIn) clipped.push(curr);
                if (cIn !== nIn) {
                    const t = (cutY - curr[1]) / (next[1] - curr[1]);
                    clipped.push([curr[0] + t * (next[0] - curr[0]), cutY]);
                }
            }
            if (clipped.length < 3) return 0;
            let a = 0;
            for (let i = 0; i < clipped.length; i++) {
                const j = (i + 1) % clipped.length;
                a += clipped[i][0] * clipped[j][1] - clipped[j][0] * clipped[i][1];
            }
            return Math.abs(a) / 2;
        }

        // The fill rect in _drawMiniShape uses:
        //   fillHeight = corrFL * 2 * rFill
        //   rect top Y = rFill - fillHeight = rFill * (1 - 2*corrFL)
        // In normalized coords (polygon at radius 1), the cut Y is:
        //   cutY_norm = rFill/r * (1 - 2*corrFL)
        // Solving for corrFL:
        //   corrFL = 0.5 * (1 - cutY_norm * r / rFill)
        const k = rFill / r;

        // Build LUT: for each target area %, find corrFL
        const LUT = new Float32Array(101);
        LUT[0] = 0;
        LUT[100] = 1;
        for (let i = 1; i < 100; i++) {
            const targetArea = (i / 100) * totalArea;
            // Binary search for cutY_norm where areaBelow(cutY_norm) = targetArea
            // cutY_norm ranges from +k (below shape, area=0) to -k (above shape, area=total)
            let lo = -k, hi = k;
            for (let iter = 0; iter < 40; iter++) {
                const mid = (lo + hi) / 2;
                if (areaBelow(mid) < targetArea) hi = mid; else lo = mid;
            }
            const cutY = (lo + hi) / 2;
            LUT[i] = Math.max(0, Math.min(1, 0.5 * (1 - cutY / k)));
        }
        return LUT;
    }

    // Cache LUTs keyed by shape + fill angle + radius
    const _SHAPE_FILL_LUTS = new Map();
    function _getShapeFillLUT(shape, fillAngle, r, rFill) {
        if (!shape || shape.sides === 0) return _CIRCLE_FILL_LUT;
        // Quantize angle to 1° to keep cache bounded
        const aDeg = Math.round(((fillAngle || 0) * 180 / Math.PI) % 360 + 360) % 360;
        const key = `${shape.sides}_${shape.star ? 1 : 0}_${shape.innerRatio || 0}_${shape.rounded ? 1 : 0}_${aDeg}`;
        if (_SHAPE_FILL_LUTS.has(key)) return _SHAPE_FILL_LUTS.get(key);
        const lut = _buildPolyFillLUT(shape, fillAngle || 0, r, rFill);
        _SHAPE_FILL_LUTS.set(key, lut);
        return lut;
    }

    function _drawMiniShape(ctx, sx, sy, r, shape, fillLevel, color, orbitAngle) {
        // Convert hex color to rgb components for rgba() usage (canvas needs proper rgba, not 8-char hex)
        const _cr = parseInt(color.slice(1,3),16), _cg = parseInt(color.slice(3,5),16), _cb = parseInt(color.slice(5,7),16);
        function buildPath() {
            ctx.beginPath();
            if (!shape || shape.sides === 0) {
                ctx.arc(sx, sy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
            } else if (shape.rounded) {
                // Rounded polygon
                const pts = getShapePoints(sx, sy, r, shape);
                const n = pts.length;
                const cr = r * 0.30;
                for (let i = 0; i < n; i++) {
                    const prev = pts[(i + n - 1) % n];
                    const curr = pts[i];
                    const next = pts[(i + 1) % n];
                    const dx1 = curr[0] - prev[0], dy1 = curr[1] - prev[1];
                    const len1 = Math.hypot(dx1, dy1);
                    const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
                    const ax = curr[0] - cr * dx1/len1, ay = curr[1] - cr * dy1/len1;
                    const bx = curr[0] + cr * dx2/Math.hypot(dx2, dy2), by = curr[1] + cr * dy2/Math.hypot(dx2, dy2);
                    if (i === 0) ctx.moveTo(ax, ay);
                    else ctx.lineTo(ax, ay);
                    ctx.arcTo(curr[0], curr[1], bx, by, cr);
                }
                ctx.closePath();
            } else {
                const pts = getShapePoints(sx, sy, r, shape);
                ctx.moveTo(pts[0][0], pts[0][1]);
                for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
                ctx.closePath();
            }
        }
        ctx.save();
        // Dim background with slight color tint
        buildPath(); ctx.fillStyle = `rgba(${_cr},${_cg},${_cb},0.08)`; ctx.fill();
        // Aquarium fill — sweeps in the orbit tangent direction
        if (fillLevel > 0) {
            ctx.save();
            buildPath(); ctx.clip();
            const oA = orbitAngle !== undefined ? orbitAngle : -Math.PI / 2;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(Math.PI + oA);
            const rEff = Math.max(1, r - 2.5); // for gradient endpoints (visual quality)
            const rFill = r + 4; // fill rect oversized so clip handles shape; 100% fill covers shape fully
            // Area-proportional correction using shape-specific LUT (accounts for fill rotation + rFill scale)
            const corrFL = _getShapeFillLUT(shape, oA, r, rFill)[Math.min(100, Math.round(fillLevel * 100))];
            // Gradient fill — saturated, matching rank gem color
            const _fillBright = 0.15;
            const _fr = Math.min(255, Math.round(_cr + (255 - _cr) * _fillBright));
            const _fg = Math.min(255, Math.round(_cg + (255 - _cg) * _fillBright));
            const _fb = Math.min(255, Math.round(_cb + (255 - _cb) * _fillBright));
            const grad = ctx.createLinearGradient(0, rEff, 0, rEff - corrFL * 2 * rEff);
            grad.addColorStop(0, `rgba(${_fr},${_fg},${_fb},0.95)`);
            grad.addColorStop(1, `rgba(${Math.min(255,_fr+30)},${Math.min(255,_fg+30)},${Math.min(255,_fb+30)},0.85)`);
            ctx.fillStyle = grad;
            const fillHeight = corrFL * 2 * rFill;
            ctx.fillRect(-rFill * 2, rFill - fillHeight, rFill * 4, fillHeight + 2);
            ctx.restore();
            ctx.restore();
        }
        // Bronze matte iron overlay — cool gray diffuse shading, no specular
        if (color.toLowerCase() === '#e8922a') {
            ctx.save();
            buildPath(); ctx.clip();
            const lin = ctx.createLinearGradient(sx - r, sy - r, sx + r, sy + r);
            lin.addColorStop(0,   'rgba(210, 210, 220, 0.38)');
            lin.addColorStop(0.4, 'rgba(160, 155, 165, 0.12)');
            lin.addColorStop(0.65,'rgba( 60,  55,  65, 0.08)');
            lin.addColorStop(1,   'rgba( 15,  10,  20, 0.50)');
            ctx.fillStyle = lin;
            ctx.fill();
            ctx.restore();
        }
        // Outer glow
        const glowAlpha = 0.18 + fillLevel * 0.35;
        buildPath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = `rgba(${_cr},${_cg},${_cb},${glowAlpha.toFixed(2)})`;
        ctx.shadowColor = `rgba(${_cr},${_cg},${_cb},0.9)`;
        ctx.shadowBlur = fillLevel > 0 ? 10 : 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Sharp inner outline
        const blend = 0.45;
        const or = Math.round(_cr + (255 - _cr) * blend);
        const og = Math.round(_cg + (255 - _cg) * blend);
        const ob = Math.round(_cb + (255 - _cb) * blend);
        buildPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(${or},${og},${ob},${(0.45 + fillLevel * 0.55).toFixed(2)})`;
        ctx.stroke();
        ctx.restore();
    }

    function _spawnXPParticles(rankColor, rankShape) {
        const badgeEl = document.getElementById('level-badge-container');
        const xpEl = document.getElementById('menu-xp-detail');
        if (!badgeEl || !xpEl) return;
        const br = badgeEl.getBoundingClientRect();
        const xr = xpEl.getBoundingClientRect();
        const targetX = br.left + br.width / 2;
        const targetY = br.top + br.height / 2;
        const clipPath = _getShapeClipPath(rankShape);
        const shapeStyle = clipPath ? `clip-path:${clipPath};` : `border-radius:50%;`;
        for (let i = 0; i < 8; i++) {
            const el = document.createElement('div');
            const startX = xr.left + xr.width / 2 + (Math.random() - 0.5) * 60;
            const startY = xr.top + (Math.random() - 0.5) * 10;
            const size = 3.5 + Math.random() * 3.5;
            const pColor = Math.random() < 0.25 ? '#ffd700' : '#ffffff';
            el.style.cssText = `position:fixed;z-index:9999;pointer-events:none;width:${size}px;height:${size}px;${shapeStyle}background:${pColor};box-shadow:0 0 8px ${pColor},0 0 16px rgba(255,255,255,0.4),0 0 3px #fff;left:${startX}px;top:${startY}px;transform:translate(-50%,-50%);opacity:0.7;`;
            document.body.appendChild(el);
            const delay = i * 25 + Math.random() * 15;
            const dur = 180 + Math.random() * 80;
            setTimeout(() => {
                el.style.transition = `left ${dur}ms ease-in, top ${dur}ms ease-in, opacity ${dur * 0.35}ms ${dur * 0.65}ms ease-in, transform ${dur}ms ease-in`;
                el.style.left = targetX + 'px';
                el.style.top = targetY + 'px';
                el.style.opacity = '0';
                el.style.transform = 'translate(-50%,-50%) scale(0)';
            }, delay);
            setTimeout(() => el.remove(), delay + dur + 100);
        }
    }

    function _drawBadgeCanvas(displayLevel, displayPercent, info, xpLabel, xpProgress) {
        const ctx = rankCtx;
        const w = 300, h = 300; // CSS pixel dimensions (canvas is DPR-scaled internally)
        const cx = w / 2, cy = h / 2;
        const rankColor = info.isLegend ? '#ffffff' : info.rank.c;
        const shape = info.rank.shape;
        const ORBIT_R = 108, SHAPE_R = 24, N = 10;
        // groupStart: overridable for rank-transition preview
        const groupStart = info._overrideGroupStart || Math.max(1, Math.floor((displayLevel - 1) / 10) * 10 + 1);

        // Carousel: full rotation ~60s at 60fps (2π / 3600 per frame)
        _badgeTime++;
        const carouselAngle = 0;

        ctx.clearRect(0, 0, w, h);

        if (info.isCelestite || info.isLegend) {
            const sc = CELESTITE_RANK.c;
            const pct = displayPercent || 0;
            const t = _badgeTime;
            // Cycle outline color: white → gold → light blue
            const _celColors2 = ['#ffffff', '#ffd700', '#7ec8e3'];
            const _cc = (t * 0.003) % _celColors2.length;
            const _ci = Math.floor(_cc), _cf = _cc - _ci;
            const _cA2 = _celColors2[_ci], _cB2 = _celColors2[(_ci + 1) % _celColors2.length];
            const _r1 = parseInt(_cA2.slice(1,3),16), _g1 = parseInt(_cA2.slice(3,5),16), _b1 = parseInt(_cA2.slice(5,7),16);
            const _r2 = parseInt(_cB2.slice(1,3),16), _g2 = parseInt(_cB2.slice(3,5),16), _b2 = parseInt(_cB2.slice(5,7),16);
            const gold = `rgb(${Math.round(_r1+(_r2-_r1)*_cf)},${Math.round(_g1+(_g2-_g1)*_cf)},${Math.round(_b1+(_b2-_b1)*_cf)})`;

            // Shield path
            const shieldPath = new Path2D();
            shieldPath.moveTo(150, 30);
            shieldPath.lineTo(250, 75);
            shieldPath.lineTo(250, 170);
            shieldPath.quadraticCurveTo(250, 248, 150, 275);
            shieldPath.quadraticCurveTo(50, 248, 50, 170);
            shieldPath.lineTo(50, 75);
            shieldPath.closePath();

            // Inner shield path
            const innerPath = new Path2D();
            innerPath.moveTo(150, 50);
            innerPath.lineTo(230, 88);
            innerPath.lineTo(230, 168);
            innerPath.quadraticCurveTo(230, 232, 150, 255);
            innerPath.quadraticCurveTo(70, 232, 70, 168);
            innerPath.lineTo(70, 88);
            innerPath.closePath();

            // --- AURORA FILL (color slowly shifts hue) ---
            const fillTop = 275 - (275 - 30) * pct;
            const hueShift = t * 0.005;
            ctx.save();
            ctx.clip(shieldPath);
            // Aurora: 3 vertical color bands that slowly shift
            const auroraGrad = ctx.createLinearGradient(40, 0, 260, 0);
            const h1 = (190 + Math.sin(hueShift) * 30) % 360;
            const h2 = (160 + Math.sin(hueShift + 1.5) * 40) % 360;
            const h3 = (220 + Math.sin(hueShift + 3) * 30) % 360;
            auroraGrad.addColorStop(0, `hsla(${h1},70%,55%,0.12)`);
            auroraGrad.addColorStop(0.5, `hsla(${h2},60%,60%,0.16)`);
            auroraGrad.addColorStop(1, `hsla(${h3},70%,55%,0.12)`);
            ctx.fillStyle = auroraGrad;
            ctx.fillRect(0, fillTop, w, 275 - fillTop);
            // Vertical fade: more transparent at top edge
            const fadeGrad = ctx.createLinearGradient(0, fillTop, 0, 275);
            fadeGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
            fadeGrad.addColorStop(0.3, 'rgba(0,0,0,0)');
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = fadeGrad;
            ctx.fillRect(0, fillTop, w, 275 - fillTop);
            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();

            // --- OUTLINE: gold ---
            ctx.strokeStyle = gold;
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.45;
            ctx.stroke(shieldPath);

            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.2;
            ctx.stroke(innerPath);

            // --- SPARKLES: multiple, random positions, different sizes, grow/shrink ---
            const _shieldPts = [
                [150,30],[200,52],[250,75],[250,120],[250,170],[230,220],[200,248],[150,275],
                [100,248],[70,220],[50,170],[50,120],[50,75],[100,52]
            ];
            // Use hash-like seeds for pseudo-random but deterministic sparkles
            for (let sp = 0; sp < 5; sp++) {
                // Each sparkle has its own random-ish cycle offset and duration
                const seed1 = Math.sin(sp * 73.17 + 0.5) * 0.5 + 0.5; // 0-1 position seed
                const seed2 = Math.sin(sp * 127.3 + 2.3) * 0.5 + 0.5; // size seed
                const cycleDur = 90 + Math.floor(seed1 * 120); // 90-210 frames per cycle
                const offset = Math.floor(seed2 * 300); // random start offset
                const frame = (t + offset) % cycleDur;
                const activeDur = 40 + Math.floor(seed2 * 40); // 40-80 frames visible
                if (frame >= activeDur) continue; // not visible this cycle

                const spLife = frame / activeDur; // 0 to 1
                // Grow then shrink
                const sizeMult = Math.sin(spLife * Math.PI);
                const spAlpha = sizeMult;
                if (spAlpha < 0.05) continue;

                // Random point along outline (use different hash per cycle)
                const cycleNum = Math.floor((t + offset) / cycleDur);
                const ptSeed = Math.abs(Math.sin(cycleNum * 91.7 + sp * 43.1)) ;
                const ptIdx = Math.floor(ptSeed * _shieldPts.length);
                const spPt = _shieldPts[ptIdx % _shieldPts.length];

                // Drift upward
                const spx = spPt[0] + (150 - spPt[0]) * spLife * 0.1;
                const spy = spPt[1] - spLife * 18;
                if (spy < 20 || spy > 280) continue;

                // Different sizes per sparkle
                const baseSize = 2 + seed2 * 3; // 2-5
                const sz = baseSize * sizeMult;

                ctx.save();
                ctx.globalAlpha = spAlpha * 0.55;
                ctx.fillStyle = gold;
                ctx.shadowColor = gold;
                ctx.shadowBlur = 3 + sz;
                ctx.fillRect(spx - 0.5, spy - sz, 1, sz * 2);
                ctx.fillRect(spx - sz, spy - 0.5, sz * 2, 1);
                ctx.restore();
            }

            ctx.globalAlpha = 1;
            return;
        }
        for (let i = 0; i < N; i++) {
            const shapeLevel = groupStart + i;
            const baseAngle = -Math.PI / 2 + Math.PI / N + (i / N) * Math.PI * 2 + carouselAngle;

            const sx = cx + Math.cos(baseAngle) * ORBIT_R;
            const sy = cy + Math.sin(baseAngle) * ORBIT_R;

            let fill = shapeLevel < displayLevel ? 1 : shapeLevel === displayLevel ? displayPercent : 0;
            const _shapeR = (shape && shape.rounded) ? Math.round(SHAPE_R * 1.38) : SHAPE_R;
            _drawMiniShape(ctx, sx, sy, _shapeR, shape, fill, rankColor, baseAngle);

            // Draw Roman numeral inside shape — only for 100% filled shapes
            const _shapeIdx = (shapeLevel - groupStart) % 10;
            const romanNum = _toRoman(_shapeIdx + 1);
            if (fill >= 1 && romanNum) {
                const _lightRank = _isLightHex(rankColor);
                ctx.save();
                // Adaptive font size: shrink if text is too wide for the shape
                // For star shapes the inner area is smaller, use tighter maxW
                const _isStar = shape && shape.star;
                const baseFontPx = Math.round(_shapeR * (_isStar ? 0.52 : 0.62));
                ctx.font = `bold ${baseFontPx}px 'Arial Narrow', Arial, sans-serif`;
                ctx.textBaseline = 'alphabetic';
                ctx.textAlign = 'center';
                const maxW = _isStar ? _shapeR * (shape.innerRatio || 0.5) * 1.7 : _shapeR * 1.55;
                let fontPx = baseFontPx;
                if (ctx.measureText(romanNum).width > maxW) {
                    fontPx = Math.max(6, Math.floor(baseFontPx * maxW / ctx.measureText(romanNum).width));
                    ctx.font = `bold ${fontPx}px 'Arial Narrow', Arial, sans-serif`;
                }
                // True visual centering: place baseline so glyph center aligns with sy
                const m = ctx.measureText(romanNum);
                const drawY = sy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
                ctx.globalAlpha = 0.95;
                ctx.shadowColor = _lightRank ? 'rgba(0,0,0,0.5)' : rankColor;
                ctx.shadowBlur = 8;
                ctx.fillStyle = _lightRank ? '#111111' : '#ffffff';
                ctx.fillText(romanNum, sx, drawY);
                ctx.restore();
            }

            // Draw XP transfer label near the currently-filling shape
            if (xpLabel && shapeLevel === displayLevel) {
                const prog = Math.min(1, Math.max(0, xpProgress || 0));
                const textSize = Math.round(14 * (1 - prog));
                if (textSize > 1) {
                    // Offset away from orbit center
                    const offDist = SHAPE_R + 10;
                    const lx = sx + Math.cos(baseAngle) * offDist;
                    const ly = sy + Math.sin(baseAngle) * offDist;
                    ctx.save();
                    ctx.font = `900 ${textSize}px 'Orbitron', sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const alpha = Math.max(0, 1 - prog);
                    ctx.globalAlpha = alpha;
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 3;
                    ctx.strokeText(xpLabel, lx, ly);
                    ctx.fillStyle = rankColor || '#ffd700';
                    ctx.shadowColor = rankColor || '#ffd700';
                    ctx.shadowBlur = 6;
                    ctx.fillText(xpLabel, lx, ly);
                    ctx.restore();
                }
            }
        }
    }

    function drawRankBadge(overridePercent = null) {
        if (badgeAnimFrame) cancelAnimationFrame(badgeAnimFrame);

        const info = getLevelInfo(saveData.totalXP);
        const displayPercent = overridePercent !== null ? overridePercent : info.percent;

        const badgeMenu = document.getElementById('menu-overlay');
        function renderLoop() {
            badgeAnimFrame = null;
            if (document.hidden || !_rankBadgeVisible || badgeMenu.classList.contains('hidden')) return;
            if (info.level === 0) {
                rankCtx.clearRect(0, 0, 300, 300);
            } else {
                _drawBadgeCanvas(info.level, displayPercent, info);
            }
            // Update Celestite text color every frame to match outline cycling
            if (info.isCelestite) {
                const _cc3 = ['#ffffff', '#ffd700', '#7ec8e3'];
                const _cy = (_badgeTime * 0.003) % _cc3.length;
                const _i3 = Math.floor(_cy), _f3 = _cy - _i3;
                const a = _cc3[_i3], b = _cc3[(_i3+1)%_cc3.length];
                const r = Math.round(parseInt(a.slice(1,3),16)+(parseInt(b.slice(1,3),16)-parseInt(a.slice(1,3),16))*_f3);
                const g = Math.round(parseInt(a.slice(3,5),16)+(parseInt(b.slice(3,5),16)-parseInt(a.slice(3,5),16))*_f3);
                const bl = Math.round(parseInt(a.slice(5,7),16)+(parseInt(b.slice(5,7),16)-parseInt(a.slice(5,7),16))*_f3);
                const col = `rgb(${r},${g},${bl})`;
                const ne = nameEl;
                const le = lvlEl;
                const pe = pctEl;
                if (ne) ne.style.color = col;
                if (le) le.style.color = col;
                if (pe) pe.style.color = col;
            }
            if (!document.hidden && !badgeMenu.classList.contains('hidden')) {
                badgeAnimFrame = requestAnimationFrame(renderLoop);
            }
        }

        const nameEl = document.getElementById('badge-rank-name');
        const lvlEl  = document.getElementById('badge-level-num');
        const pctEl  = document.getElementById('menu-percent');

        const _xpBarWrap = document.getElementById('menu-xp-bar-wrap');
        if (info.isCelestite) {
            // Cycle: white → gold → light blue (~12s full cycle)
            const _celColors = ['#ffffff', '#ffd700', '#7ec8e3'];
            const _celCycle = (_badgeTime * 0.003) % _celColors.length;
            const _celIdx = Math.floor(_celCycle);
            const _celFrac = _celCycle - _celIdx;
            const _cA = _celColors[_celIdx], _cB = _celColors[(_celIdx + 1) % _celColors.length];
            // Lerp hex colors
            const _lerpC = (a, b, f) => {
                const ra = parseInt(a.slice(1,3),16), ga = parseInt(a.slice(3,5),16), ba = parseInt(a.slice(5,7),16);
                const rb = parseInt(b.slice(1,3),16), gb = parseInt(b.slice(3,5),16), bb = parseInt(b.slice(5,7),16);
                const r = Math.round(ra + (rb-ra)*f), g = Math.round(ga + (gb-ga)*f), bl = Math.round(ba + (bb-ba)*f);
                return `rgb(${r},${g},${bl})`;
            };
            const _celCurrentColor = _lerpC(_cA, _cB, _celFrac);
            nameEl.innerText = 'CELESTITE';
            nameEl.style.fontSize = '22px';
            nameEl.style.color = _celCurrentColor;
            lvlEl.innerText  = _toRoman(info.level);
            lvlEl.style.fontSize = '20px';
            lvlEl.style.fontWeight = '900';
            lvlEl.style.fontFamily = "'Noto Serif', serif";
            lvlEl.style.color = _celCurrentColor;
            nameEl.classList.remove('legend-glow'); lvlEl.classList.remove('legend-glow'); pctEl.classList.remove('legend-glow');
            pctEl.style.color = _celCurrentColor;
            let pct = Math.min(99.9, displayPercent * 100);
            if (isNaN(pct) || pct < 0) pct = 0;
            pctEl.innerText = pct.toFixed(1) + '%';
            if (_xpBarWrap) _xpBarWrap.style.display = '';
            _setXpBarFill(displayPercent * 100);
            document.getElementById('menu-xp-detail').innerText = `${(saveData.totalXP||0).toLocaleString()} total XP`;
            const _ucXpEl = document.getElementById('uc-xp-display');
            if (_ucXpEl) _ucXpEl.style.display = 'none';
        } else if (info.level === 0) {
            nameEl.innerText = info.rank.name;
            nameEl.style.fontSize = '28px';
            nameEl.style.color = info.rank.c;
            lvlEl.innerText  = '';
            lvlEl.style.fontSize = '0.6rem';
            lvlEl.style.fontWeight = 'normal';
            lvlEl.style.fontFamily = "'Noto Serif', serif";
            lvlEl.style.color = '#888';
            nameEl.classList.remove('legend-glow'); lvlEl.classList.remove('legend-glow'); pctEl.classList.remove('legend-glow');
            pctEl.style.color  = '#888';
            pctEl.innerText = '';
            if (_xpBarWrap) _xpBarWrap.style.display = 'none';
            document.getElementById('menu-xp-detail').innerText = (saveData.stats?.gamesPlayed || 0) === 0 ? 'Play your first game!' : '';
            const _ucXpEl0 = document.getElementById('uc-xp-display'); if (_ucXpEl0) _ucXpEl0.style.display = 'none';
        } else if (info.lvlInRank === 0) {
            // First level of a new rank — same name size as normal, "Rank Up!" instead of numeral
            nameEl.innerText = info.rank.name;
            nameEl.style.fontSize = '';
            nameEl.style.color = info.rank.c;
            lvlEl.innerText  = info.level === 1 ? '1' : 'New Rank';
            lvlEl.style.fontSize = info.level === 1 ? '' : '18px';
            lvlEl.style.fontWeight = '';
            lvlEl.style.fontFamily = "'Noto Serif', serif";
            lvlEl.style.color = '#fff';
            nameEl.classList.remove('legend-glow'); lvlEl.classList.remove('legend-glow'); pctEl.classList.remove('legend-glow');
            pctEl.style.color  = info.rank.c;
            let pct = Math.min(99.9, displayPercent * 100);
            if (isNaN(pct) || pct < 0) pct = 0;
            pctEl.innerText = pct.toFixed(1) + '%';
            document.getElementById('menu-xp-detail').innerText = `${Math.floor(info.currentXP)} / ${info.neededXP} XP`;
            const _ucXpEl2 = document.getElementById('uc-xp-display'); if (_ucXpEl2) _ucXpEl2.style.display = 'none';
            if (_xpBarWrap) _xpBarWrap.style.display = '';
            _setXpBarFill(displayPercent * 100);
        } else {
            nameEl.innerText = info.rank.name;
            nameEl.style.fontSize = '';
            lvlEl.innerText = _toRoman(info.lvlInRank);
            lvlEl.style.fontSize = '';
            lvlEl.style.fontWeight = '';
            lvlEl.style.fontFamily = "'Noto Serif', serif";
            lvlEl.style.color = '';
            nameEl.classList.remove('legend-glow'); lvlEl.classList.remove('legend-glow'); pctEl.classList.remove('legend-glow');
            nameEl.style.color = info.rank.c;
            pctEl.style.color  = info.rank.c;
            let pct = Math.min(99.9, displayPercent * 100);
            if (isNaN(pct) || pct < 0) pct = 0;
            pctEl.innerText = pct.toFixed(1) + '%';
            document.getElementById('menu-xp-detail').innerText = `${Math.floor(info.currentXP)} / ${info.neededXP} XP`;
            const _ucXpEl1 = document.getElementById('uc-xp-display'); if (_ucXpEl1) _ucXpEl1.style.display = 'none';
            if (_xpBarWrap) _xpBarWrap.style.display = '';
            _setXpBarFill(displayPercent * 100);
        }

        // Hover: show XP detail inline (no popup box — text appears/disappears)
        if (_xpBarWrap && !_xpBarWrap._xpHoverSetup) {
            _xpBarWrap._xpHoverSetup = true;
            _xpBarWrap.addEventListener('mouseenter', () => {
                const _i = getLevelInfo(saveData.totalXP);
                if (_i.level === 0 && !_i.currentXP) return;
                const _exact = (_i.percent * 100).toFixed(1);
                const det = document.getElementById('menu-xp-detail');
                if (det) {
                    det.innerHTML =
                        `<span style="font-weight:bold;color:#fff;">${Math.floor(_i.currentXP).toLocaleString()}</span>`
                        + `<span style="color:rgba(255,255,255,0.3);margin:0 3px;">/</span>`
                        + `<span style="color:rgba(255,255,255,0.5);">${_i.neededXP.toLocaleString()}</span>`
                        + `<span style="color:var(--primary);margin-left:8px;font-weight:bold;text-shadow:0 0 8px var(--primary);">${_exact}%</span>`;
                    det.style.visibility = 'visible';
                }
            });
            _xpBarWrap.addEventListener('mouseleave', () => {
                const det = document.getElementById('menu-xp-detail');
                if (det) det.style.visibility = 'hidden';
            });
        }

        renderLoop();
        // Show pending level box if any
        if (saveData.pendingLevelBox && !_levelBoxShowing && !document.getElementById('level-box-overlay')) {
            setTimeout(() => _showLevelBox(), 600);
        }
        if ((saveData.pendingMilestoneReward || saveData.pendingMilestoneBoxes?.length) && !_levelBoxShowing && !document.getElementById('level-box-overlay')) {
            setTimeout(() => _checkMilestoneBoxes(), saveData.pendingLevelBox ? 2000 : 600);
        }
    }

    function animateXPGain() {
        if (gainedXPThisRound <= 0) { drawRankBadge(); return; }
        if (badgeAnimFrame) cancelAnimationFrame(badgeAnimFrame);

        const startXP = saveData.totalXP - gainedXPThisRound;
        const duration = 1500;
        let startTime = null;
        const xpLabelText = '+' + gainedXPThisRound;

        function anim(time) {
            if (!startTime) startTime = time;
            const progress = Math.min((time - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const tempInfo = getLevelInfo(startXP + gainedXPThisRound * ease);

            // Draw +XP label on badge canvas near filling shape (shrinks as fill progresses)
            _drawBadgeCanvas(tempInfo.level, tempInfo.percent, tempInfo, xpLabelText, ease);
            const _tLvlInRank = tempInfo.lvlInRank ?? ((tempInfo.level - 1) % 10);
            document.getElementById('badge-level-num').innerText = tempInfo.isCelestite ? _toRoman(tempInfo.level) : (_tLvlInRank === 0 ? '' : _toRoman(_tLvlInRank));
            document.getElementById('menu-xp-detail').innerText = tempInfo.isCelestite ? `${Math.floor(startXP + gainedXPThisRound * ease).toLocaleString()} total XP` : `${Math.floor(tempInfo.currentXP)} / ${tempInfo.neededXP} XP`;
            _setXpBarFill(tempInfo.percent * 100);

            if (progress < 1) {
                badgeAnimFrame = requestAnimationFrame(anim);
            } else {
                gainedXPThisRound = 0;
                if (_leveledUpThisGame) {
                    const _badge = document.getElementById('level-badge-container');
                    if (_badge) {
                        _badge.classList.remove('badge-level-bounce');
                        void _badge.offsetWidth;
                        _badge.classList.add('badge-level-bounce');
                        _badge.addEventListener('animationend', function _bd(e) {
                            if (e.target !== _badge) return;
                            _badge.classList.remove('badge-level-bounce');
                            _badge.removeEventListener('animationend', _bd);
                        });
                    }
                    _leveledUpThisGame = false;
                }
                drawRankBadge();
            }
        }
        badgeAnimFrame = requestAnimationFrame(anim);
    }

    const heldMoves = new Map(), softDropSources = new Set();
    const DAS_DELAY=160, ARR_DELAY=50; let dasTimer, arrTimer;
    let board=[], score=0, gameTime=0, dropInterval=1000, dropCounter=0, lastTime=0, currentScoreMultiplier=1.0;
    let isPaused=true, isGameOver=false, isAnimating=false, animatingLines=[];
    let _hardDropAnimating=false;
    let _quadraKillThisGame = false;
    let _nextPieceType = 0, _currentPieceType = 0;
    let _maxLineStreakThisGame = 0, _currentLineStreak = 0;
    let _blockTimestampsThisGame = [];
    let _maxBlocksIn60sThisGame = 0;
    let _iPieceLinesThisGame = 0;
    let _boardClearedThisGame = false;
    let _boardSymmetricAchieved = false;
    let _clearedTopLineThisGame = false;
    let _rotatedThisGame = false;
    let _pieceTypeCounts = {};
    let _sec7CountThisGame = 0;
    let _sec7Last = [];
    let _earlyBirdThisGame = false;
    let _recentGameEndTimes = [];
    let _sessionGamesPlayed = 0;
    let _pauseCountThisGame = 0;
    let _loyalPieceCounter = 0;
    let _lastMuteTime = 0;
    let _menuIdleStart = Date.now();
    let _menuIdleInterval = null;
    let _prevGameScore = -1;
    // afk achievement: 15 minutes in menu without playing
    _menuIdleInterval = setInterval(() => {
        if (!document.getElementById('menu-overlay')?.classList.contains('hidden') && !saveData.achievements?.['afk']?.unlocked) {
            const _idleMs = Date.now() - _menuIdleStart;
            saveData.stats.menuIdleTime = Math.max(saveData.stats.menuIdleTime || 0, Math.floor(_idleMs / 1000));
            if (_idleMs >= 15 * 60 * 1000) { unlockAchievement('afk'); saveDataToFile(); }
        }
    }, 30000);

    // --- AIRDROP EVENT (uses bg-canvas special block, 1-10 min random interval) ---
    function _doSpawnParachute() { _spawnSpecialBlock(); }
    let _nextDropTime = Date.now() + (60 + Math.random() * 540) * 1000; // first drop 1-10 min
    setInterval(() => {
        if (_specialBlock) return;
        const menuEl = document.getElementById('menu-overlay');
        if (!menuEl || menuEl.classList.contains('hidden')) return;
        if (Date.now() < _nextDropTime) return;
        _spawnSpecialBlock();
        _nextDropTime = Date.now() + (60 + Math.random() * 540) * 1000; // next in 1-10 min
    }, 5000);

    let _musicTrackStartTime30s = null;
    let _currentTrackName30s = '';
    let _currentTrackDuration30s = 0;
    let _waitedTetrisThisGame = false;
    let _lastIPieceGameTime = -999;
    let _hardDropsThisGame = 0;
    let _pendingHardDrop = false;
    let _piecesThisGame = 0, _piecesHardDroppedThisGame = 0;
    let _quadrasThisGame = 0;
    let _comboCount = 0, _maxComboThisGame = 0;
    let _lastMoveWasRotation = false;
    let _bufferedMove = 0; // Input buffered during line clear animation
    let _prevHighscore = 0;
    let _bigFontGameFlag = false;
    let _nice69Triggered = false; // true if a single line-clear scored exactly 69 this game
    let _maxBlocksUnderHalfThisGame = 0, _currentBlocksUnderHalf = 0;
    // New achievement tracking variables
    let _noLinePlacementCount = 0; // Dry Spell
    let _pieceRotatedThisPlacement = false; // No Spin Zone
    let _lastClearWasQuad = false; // Double the Satisfaction
    let _surgeonStreakStep = 0; // Surgeon's Streak
    let _rotationsThisPiece = 0; // Dizzy
    let _wallBounceCount = 0; // Indecisive
    let _wallTouchedLeft = false, _wallTouchedRight = false; // Indecisive tracking
    let _lastPlacedTime=0;
    let timeInterval;
    let speedLevel=1, linesClearedThisGame=0, blocksPlacedThisGame=0, _surgeonLinesThisGame=0, _highStackBlocksThisGame=0;
    let xpFromBlocksThisGame=0, xpFromLinesThisGame=0, rawGameplayXPThisGame=0;
    let _gameOverProtect = false;
    // Mission tracking per game
    let _mq_hatTrickDone = false;
    let _mq_dangerEntryTime = -1, _mq_narrowEscape = false;
    let _mq_iFloor = false, _mq_bottomQuarterBlocks = 0, _mq_speedRun = false;
    let _rotationsThisGame = 0, _doublesThisGame = 0, _triplesThisGame = 0, _tSpinsThisGame = 0;
    let _bottomTwoRowsThisGame = 0, _softDropUsedThisGame = false;
    let _mq_perfectClear = false, _mq_comebackKidEntryTime = -1, _mq_comebackKid = false;
    let _mq_monochrome = false, _mq_speedQueen = false;
    let _mq_minimalistFailed = false, _mq_minimalistLines = 0, _mq_minimalist = false;
    let _achsThisGame = 0;
    let _mq_quadStreak = false, _mq_flatEarth = false, _mq_flatEarthStart = -1;
    let _animId = 0;
    let currentGameMode = 'normal'; // 'normal', 'fun'
    let holdPiece = null, holdUsed = false;
    let funModeConfig = { cols: 10, rows: 20, startSpeed: 1 };
    try { const _fmc = JSON.parse(localStorage.getItem('tetrisRPG_funConfig') || 'null'); if (_fmc && typeof _fmc === 'object') funModeConfig = { ...funModeConfig, ..._fmc }; } catch(e) {}

    let player = {pos:{x:0,y:0},matrix:null,next:null};
    let pieceBag = []; let lastPieceColor = 0; let _nextQueue = [];

    function togglePause() {
        if (isGameOver || isAnimating || !document.getElementById('start-animation-overlay').classList.contains('hidden')) return;
        resetHeldInputs();
        isPaused = true;
        pauseMusic();
        document.getElementById('pause-overlay').classList.remove('hidden');
        // risky_break: pause at speed 3+
        if (speedLevel >= 3 && !saveData.achievements?.['risky_break']?.unlocked) { unlockAchievement('risky_break'); saveDataToFile(); }
        // pause_spam: 15+ pauses in one game
        _pauseCountThisGame++;
        if (_pauseCountThisGame >= 5 && !saveData.achievements?.['pause_spam']?.unlocked) { unlockAchievement('pause_spam'); saveDataToFile(); }
    }

    function resumeGame() {
        if (isGameOver) return;
        isPaused = false;
        resumeMusic();
        lastTime = performance.now();
        requestAnimationFrame(update);
        _animateOut(document.getElementById('pause-overlay'), 'anim-out-down');
    }

    async function quitGame() {
        if (score === 0) {
            _animateOut(document.getElementById('pause-overlay'), 'anim-out-down');
            if(timeInterval) clearInterval(timeInterval);
            saveData.stats.gamesAborted = (saveData.stats.gamesAborted || 0) + 1;
            if ((saveData.stats.gamesAborted || 0) >= 20 && !saveData.achievements?.['abort_mission']?.unlocked) { unlockAchievement('abort_mission'); }
            _gameInProgress = false;
            saveDataToFile();
            gameOver(); return;
        }
        const confirmed = await customConfirm("Are you sure you want to quit?<br><br><b style='color:var(--primary);'>Your current score and XP will be saved.</b>", "QUIT");
        if(confirmed) {
            _animateOut(document.getElementById('pause-overlay'), 'anim-out-down');
            if(timeInterval) clearInterval(timeInterval);
            saveData.stats.gamesAborted = (saveData.stats.gamesAborted || 0) + 1;
            if ((saveData.stats.gamesAborted || 0) >= 20 && !saveData.achievements?.['abort_mission']?.unlocked) { unlockAchievement('abort_mission'); }
            _gameInProgress = false;
            saveDataToFile();
            gameOver();
        }
    }

    const _blockCache = new Map();
    let _blockCacheStyle = '';
    function drawGameBlock(c,x,y,id,s,g=false){
        if (!id) return;
        const style = [_renderSkin(), COLORS.join(','), settings.blockShape, settings.ghostColor, saveData.ghostColorUnlocked, window.devicePixelRatio].join('|');
        if (style !== _blockCacheStyle) { _blockCache.clear(); _blockCacheStyle = style; }
        const key = [id,s,g].join('|');
        let tile = _blockCache.get(key);
        const pad = 24, dpr = Math.min(2, window.devicePixelRatio || 1);
        if (!tile) {
            tile = document.createElement('canvas');
            tile.width = tile.height = Math.ceil((s+pad*2)*dpr);
            const tc = tile.getContext('2d'); tc.scale(dpr,dpr); tc.translate(pad,pad); tc._pixelRatio=dpr;
            _paintGameBlock(tc,0,0,id,s,g);
            _blockCache.set(key,tile);
        }
        c.drawImage(tile,x*s-pad,y*s-pad,tile.width/dpr,tile.height/dpr);
    }
    function _paintGameBlock(c,x,y,id,s,g=false){
        if(id===0)return;
        const col=COLORS[id];
        const blockShape = settings.blockShape || 'square';
        if(g){
            c.save();
            if (blockShape !== 'square') {
                c.beginPath();
                const px=x*s+2,py=y*s+2,pw=s-4,ph=s-4;
                if(blockShape==='round'){c.arc(px+pw/2,py+ph/2,pw/2,0,Math.PI*2);}
                else{const cut=pw*0.22;c.moveTo(px+cut,py);c.lineTo(px+pw-cut,py);c.lineTo(px+pw,py+cut);c.lineTo(px+pw,py+ph-cut);c.lineTo(px+pw-cut,py+ph);c.lineTo(px+cut,py+ph);c.lineTo(px,py+ph-cut);c.lineTo(px,py+cut);c.closePath();}
                c.clip();
            }
            if ((settings.ghostColor === 'colored') && saveData.ghostColorUnlocked) {
                c.strokeStyle=col; c.lineWidth=2; c.globalAlpha=0.35; c.strokeRect(x*s+2,y*s+2,s-4,s-4);
                c.fillStyle=col; c.globalAlpha=0.08; c.fillRect(x*s,y*s,s,s);
            } else {
                c.strokeStyle='rgba(255,255,255,0.45)'; c.lineWidth=2; c.globalAlpha=1; c.strokeRect(x*s+2,y*s+2,s-4,s-4);
                c.fillStyle='rgba(255,255,255,0.06)'; c.fillRect(x*s,y*s,s,s);
            }
            c.restore(); return;
        }
        const skin = _renderSkin();
        if (blockShape !== 'square') {
            c.save();
            c.beginPath();
            const px=x*s+1,py=y*s+1,pw=s-2,ph=s-2;
            if(blockShape==='round'){c.arc(px+pw/2,py+ph/2,pw/2,0,Math.PI*2);}
            else{const cut=pw*0.22;c.moveTo(px+cut,py);c.lineTo(px+pw-cut,py);c.lineTo(px+pw,py+cut);c.lineTo(px+pw,py+ph-cut);c.lineTo(px+pw-cut,py+ph);c.lineTo(px+cut,py+ph);c.lineTo(px,py+ph-cut);c.lineTo(px,py+cut);c.closePath();}
            c.clip();
        }
        if (skin === 'retro') {
            c.fillStyle=col; c.fillRect(x*s+1,y*s+1,s-2,s-2);
            c.fillStyle='rgba(255,255,255,0.55)'; c.fillRect(x*s+1,y*s+1,s-2,2); c.fillRect(x*s+1,y*s+1,2,s-2);
            c.fillStyle='rgba(0,0,0,0.45)'; c.fillRect(x*s+1,y*s+s-3,s-2,2); c.fillRect(x*s+s-3,y*s+1,2,s-2);
        } else if (skin === 'glass') {
            c.globalAlpha=0.32; c.fillStyle=col; c.fillRect(x*s+1,y*s+1,s-2,s-2); c.globalAlpha=1;
            c.strokeStyle=col; c.lineWidth=1.5; c.strokeRect(x*s+1,y*s+1,s-2,s-2);
        } else if (skin === 'shadow') {
            c.fillStyle='rgba(20,20,30,0.96)'; c.fillRect(x*s+1,y*s+1,s-2,s-2);
            c.strokeStyle=col; c.lineWidth=1.5; c.shadowColor=col; c.shadowBlur=6*(c._pixelRatio||1);
            c.strokeRect(x*s+2,y*s+2,s-4,s-4); c.shadowBlur=0;
        } else if (skin === 'outline') {
            c.strokeStyle=col; c.lineWidth=2; c.shadowColor=col; c.shadowBlur=10*(c._pixelRatio||1);
            c.strokeRect(x*s+2,y*s+2,s-4,s-4); c.shadowBlur=0;
            c.globalAlpha=0.25; c.strokeRect(x*s+5,y*s+5,s-10,s-10); c.globalAlpha=1;
        } else if (skin === 'holo') {
            c.fillStyle='rgba(3,3,15,0.9)';c.fillRect(x*s,y*s,s,s);
            c.strokeStyle=col;c.lineWidth=1.5;c.shadowColor=col;c.shadowBlur=8*(c._pixelRatio||1);c.strokeRect(x*s+1,y*s+1,s-2,s-2);c.shadowBlur=0;
            c.fillStyle=col;c.globalAlpha=0.14;
            for(let _sy=y*s+2;_sy<y*s+s-1;_sy+=3)c.fillRect(x*s+2,_sy,s-4,1);
            c.globalAlpha=1;
        } else if (skin === 'journey') {
            const _jr=Math.min(s*0.28,8),_jx=x*s,_jy=y*s;
            const _jrr=()=>{c.beginPath();c.moveTo(_jx+_jr,_jy);c.lineTo(_jx+s-_jr,_jy);c.arcTo(_jx+s,_jy,_jx+s,_jy+_jr,_jr);c.lineTo(_jx+s,_jy+s-_jr);c.arcTo(_jx+s,_jy+s,_jx+s-_jr,_jy+s,_jr);c.lineTo(_jx+_jr,_jy+s);c.arcTo(_jx,_jy+s,_jx,_jy+s-_jr,_jr);c.lineTo(_jx,_jy+_jr);c.arcTo(_jx,_jy,_jx+_jr,_jy,_jr);c.closePath();};
            _jrr(); c.fillStyle=col; c.fill();
            const _jg=c.createLinearGradient(_jx,_jy,_jx+s,_jy+s);
            _jg.addColorStop(0,'rgba(255,255,255,0.22)');_jg.addColorStop(0.5,'rgba(255,255,255,0)');_jg.addColorStop(1,'rgba(0,0,0,0.3)');
            _jrr(); c.fillStyle=_jg; c.fill();
            _jrr(); c.strokeStyle='rgba(0,0,0,0.38)'; c.lineWidth=1.5; c.stroke();
        } else if (skin === 'gem') {
            c.fillStyle=col; c.fillRect(x*s+1,y*s+1,s-2,s-2);
            c.fillStyle='rgba(0,0,0,0.28)';
            c.beginPath(); c.moveTo(x*s+s-1,y*s+1); c.lineTo(x*s+s-1,y*s+s-1); c.lineTo(x*s+1,y*s+s-1); c.closePath(); c.fill();
            c.fillStyle='rgba(255,255,255,0.3)';
            c.beginPath(); c.moveTo(x*s+1,y*s+1); c.lineTo(x*s+s-1,y*s+1); c.lineTo(x*s+1,y*s+s-1); c.closePath(); c.fill();
            c.fillStyle='rgba(255,255,255,0.28)';
            c.beginPath(); c.moveTo(x*s+1,y*s+1); c.lineTo(x*s+Math.floor(s*0.58),y*s+1); c.lineTo(x*s+1,y*s+Math.floor(s*0.58)); c.closePath(); c.fill();
            c.fillStyle='rgba(255,255,255,0.6)';
            c.beginPath(); c.arc(x*s+s*0.28,y*s+s*0.28,s*0.09,0,Math.PI*2); c.fill();
            c.strokeStyle='rgba(255,255,255,0.38)'; c.lineWidth=0.8;
            c.beginPath(); c.moveTo(x*s+1,y*s+Math.floor(s*0.52)); c.lineTo(x*s+Math.floor(s*0.52),y*s+1); c.stroke();
            c.strokeStyle='rgba(0,0,0,0.6)'; c.lineWidth=1; c.strokeRect(x*s+0.5,y*s+0.5,s-1,s-1);
        } else if (skin === 'bubble') {
            // Rounded gel block — inspired by ambar/Tetris bubble theme
            const _br=s*0.28,_bx=x*s+1,_by=y*s+1,_bw=s-2,_bh=s-2;
            const _bp=()=>{c.beginPath();c.moveTo(_bx+_br,_by);c.lineTo(_bx+_bw-_br,_by);c.arcTo(_bx+_bw,_by,_bx+_bw,_by+_br,_br);c.lineTo(_bx+_bw,_by+_bh-_br);c.arcTo(_bx+_bw,_by+_bh,_bx+_bw-_br,_by+_bh,_br);c.lineTo(_bx+_br,_by+_bh);c.arcTo(_bx,_by+_bh,_bx,_by+_bh-_br,_br);c.lineTo(_bx,_by+_br);c.arcTo(_bx,_by,_bx+_br,_by,_br);c.closePath();};
            _bp(); c.fillStyle=col; c.fill();
            const _rg=c.createRadialGradient(_bx+_bw*0.35,_by+_bh*0.3,0,_bx+_bw*0.5,_by+_bh*0.5,_bw*0.75);
            _rg.addColorStop(0,'rgba(255,255,255,0.52)');_rg.addColorStop(0.45,'rgba(255,255,255,0.07)');_rg.addColorStop(1,'rgba(0,0,0,0.32)');
            _bp(); c.fillStyle=_rg; c.fill();
            _bp(); c.strokeStyle='rgba(0,0,0,0.22)'; c.lineWidth=1; c.stroke();
        } else if (skin === 'gameboy') {
            // Classic Game Boy LCD palette — ignores piece color; inspired by blockrain.js gameboy theme
            c.fillStyle='#9bbc0f'; c.fillRect(x*s,y*s,s,s);
            c.fillStyle='#306230'; c.fillRect(x*s+1,y*s+1,s-2,s-2);
            c.fillStyle='#8bac0f'; c.fillRect(x*s+1,y*s+1,s-2,2); c.fillRect(x*s+1,y*s+1,2,s-2);
            c.fillStyle='#0f380f'; c.fillRect(x*s+1,y*s+s-3,s-2,2); c.fillRect(x*s+s-3,y*s+1,2,s-2);
            c.fillStyle='#4a7c2f'; c.fillRect(x*s+3,y*s+3,s-6,s-6);
        } else if (skin === 'monochrome') {
            // Grayscale raised bevel — ignores piece color; inspired by blockrain.js monochrome theme
            c.fillStyle='#c0c0c0'; c.fillRect(x*s+1,y*s+1,s-2,s-2);
            c.fillStyle='rgba(255,255,255,0.88)'; c.fillRect(x*s+1,y*s+1,s-2,2); c.fillRect(x*s+1,y*s+1,2,s-2);
            c.fillStyle='rgba(0,0,0,0.38)'; c.fillRect(x*s+1,y*s+s-3,s-2,2); c.fillRect(x*s+s-3,y*s+1,2,s-2);
            c.fillStyle='#d8d8d8'; c.fillRect(x*s+3,y*s+3,s-6,s-6);
            c.strokeStyle='#444'; c.lineWidth=1; c.strokeRect(x*s+0.5,y*s+0.5,s-1,s-1);
        } else if (skin === 'modern') {
            // Clean flat block with linear top-to-bottom gradient; inspired by blockrain.js modern theme
            c.fillStyle=col; c.fillRect(x*s+1,y*s+1,s-2,s-2);
            const _mg=c.createLinearGradient(x*s,y*s,x*s,y*s+s);
            _mg.addColorStop(0,'rgba(255,255,255,0.22)'); _mg.addColorStop(1,'rgba(0,0,0,0.22)');
            c.fillStyle=_mg; c.fillRect(x*s+1,y*s+1,s-2,s-2);
            c.strokeStyle='rgba(0,0,0,0.38)'; c.lineWidth=1; c.strokeRect(x*s+0.5,y*s+0.5,s-1,s-1);
        } else if (skin === 'candy') {
            // Pastel rounded with top-fade shine + glint dot; inspired by blockrain.js candy theme
            const _cr=s*0.3,_cx=x*s+1,_cy=y*s+1,_cw=s-2,_ch=s-2;
            const _cp=()=>{c.beginPath();c.moveTo(_cx+_cr,_cy);c.lineTo(_cx+_cw-_cr,_cy);c.arcTo(_cx+_cw,_cy,_cx+_cw,_cy+_cr,_cr);c.lineTo(_cx+_cw,_cy+_ch-_cr);c.arcTo(_cx+_cw,_cy+_ch,_cx+_cw-_cr,_cy+_ch,_cr);c.lineTo(_cx+_cr,_cy+_ch);c.arcTo(_cx,_cy+_ch,_cx,_cy+_ch-_cr,_cr);c.lineTo(_cx,_cy+_cr);c.arcTo(_cx,_cy,_cx+_cr,_cy,_cr);c.closePath();};
            _cp(); c.fillStyle=col; c.fill();
            const _cg=c.createLinearGradient(_cx,_cy,_cx,_cy+_ch);
            _cg.addColorStop(0,'rgba(255,255,255,0.5)'); _cg.addColorStop(0.45,'rgba(255,255,255,0.08)'); _cg.addColorStop(1,'rgba(0,0,0,0.18)');
            _cp(); c.fillStyle=_cg; c.fill();
            c.fillStyle='rgba(255,255,255,0.72)';
            c.beginPath(); c.arc(_cx+_cw*0.28,_cy+_ch*0.25,s*0.1,0,Math.PI*2); c.fill();
        } else if (skin === 'vim') {
            // Dark terminal bg + colored border + inner cursor block; inspired by blockrain.js vim theme
            c.fillStyle='#1e1e2e'; c.fillRect(x*s,y*s,s,s);
            c.strokeStyle=col; c.lineWidth=1.5; c.shadowColor=col; c.shadowBlur=3*(c._pixelRatio||1);
            c.strokeRect(x*s+1.5,y*s+1.5,s-3,s-3); c.shadowBlur=0;
            const _vi=Math.round(s*0.3);
            c.fillStyle=col; c.globalAlpha=0.55; c.fillRect(x*s+_vi,y*s+_vi,s-_vi*2,s-_vi*2); c.globalAlpha=1;
        } else if (skin === 'aerolab') {
            // Diagonal gradient with subtle scan lines; inspired by blockrain.js aerolab theme
            const _ag=c.createLinearGradient(x*s,y*s,x*s+s,y*s+s);
            _ag.addColorStop(0,'rgba(255,255,255,0.28)'); _ag.addColorStop(0.45,col); _ag.addColorStop(1,'rgba(0,0,0,0.4)');
            c.fillStyle=_ag; c.fillRect(x*s+1,y*s+1,s-2,s-2);
            c.fillStyle='rgba(255,255,255,0.1)';
            for(let _ai=y*s+2;_ai<y*s+s-1;_ai+=3) c.fillRect(x*s+2,_ai,s-4,1);
            c.strokeStyle='rgba(255,255,255,0.45)'; c.lineWidth=1; c.strokeRect(x*s+1,y*s+1,s-2,s-2);
        } else if (skin === 'classic') {
            // Plain solid block with single-pixel border + faint top highlight; inspired by ambar/Tetris classic theme
            c.fillStyle=col; c.fillRect(x*s,y*s,s,s);
            c.strokeStyle='rgba(0,0,0,0.7)'; c.lineWidth=1; c.strokeRect(x*s+0.5,y*s+0.5,s-1,s-1);
            c.fillStyle='rgba(255,255,255,0.2)'; c.fillRect(x*s+2,y*s+2,s-4,2); c.fillRect(x*s+2,y*s+2,2,s-4);
        } else if (skin === 'window') {
            // Windows 95-style raised 3D bevel; inspired by ambar/Tetris window theme
            c.fillStyle=col; c.fillRect(x*s+2,y*s+2,s-4,s-4);
            c.fillStyle='#fff'; c.fillRect(x*s,y*s,s,2); c.fillRect(x*s,y*s,2,s);
            c.fillStyle='#333'; c.fillRect(x*s,y*s+s-2,s,2); c.fillRect(x*s+s-2,y*s,2,s);
            c.fillStyle='rgba(255,255,255,0.55)'; c.fillRect(x*s+2,y*s+2,s-4,2); c.fillRect(x*s+2,y*s+2,2,s-4);
            c.fillStyle='rgba(0,0,0,0.4)'; c.fillRect(x*s+2,y*s+s-4,s-4,2); c.fillRect(x*s+s-4,y*s+2,2,s-4);
        } else { // neon (default)
            c.fillStyle=col;c.shadowBlur=10*(c._pixelRatio||1);c.shadowColor=col;c.fillRect(x*s+1,y*s+1,s-2,s-2);c.shadowBlur=0;
            const _ni=Math.round(s*0.27);
            c.fillStyle="rgba(0,0,0,.5)";c.fillRect(x*s+_ni,y*s+_ni,s-_ni*2,s-_ni*2);
            c.strokeStyle="rgba(255,255,255,.8)";c.lineWidth=1;c.strokeRect(x*s+1,y*s+1,s-2,s-2);
        }
        if (blockShape !== 'square') c.restore();
    }
    const SPAWN_ROWS = 2;
    let _gridCache = null, _lineFlash = null;
    function _paintGrid(ctx) {
        const _gOp = (settings.gridOpacity ?? 40) / 100;
        const _gStyle = settings.gridStyle || 'lines';
        if (_gOp > 0) {
            const _gAlpha = (_gOp * 0.38).toFixed(3);
            const _visRows = ROWS - SPAWN_ROWS;
            if (_gStyle === 'dots') {
                // Corner dots — snapped to half-pixel for sharpness
                ctx.fillStyle = `rgba(190,220,255,${_gAlpha})`;
                const dotR = 1.5;
                for (let xi = 0; xi <= COLS; xi++) {
                    for (let yi = SPAWN_ROWS; yi <= SPAWN_ROWS + _visRows; yi++) {
                        const dx = Math.round(xi*BLOCK), dy = Math.round(yi*BLOCK);
                        ctx.beginPath();
                        ctx.arc(dx, dy, dotR, 0, Math.PI*2);
                        ctx.fill();
                    }
                }
            } else if (_gStyle === 'boxes') {
                // Cell box outlines — crisp 1.5px stroke, snapped to half-pixel
                ctx.strokeStyle = `rgba(190,220,255,${(_gOp * 0.6).toFixed(3)})`;
                ctx.lineWidth = 1.5;
                const pad = 2.5, r = 3;
                for (let yi = SPAWN_ROWS; yi < SPAWN_ROWS + _visRows; yi++) {
                    for (let xi = 0; xi < COLS; xi++) {
                        const bx = Math.round(xi*BLOCK)+pad, by = Math.round(yi*BLOCK)+pad;
                        const bw = BLOCK-pad*2, bh = BLOCK-pad*2;
                        ctx.beginPath();
                        ctx.moveTo(bx+r, by); ctx.lineTo(bx+bw-r, by);
                        ctx.arcTo(bx+bw, by, bx+bw, by+r, r);
                        ctx.lineTo(bx+bw, by+bh-r);
                        ctx.arcTo(bx+bw, by+bh, bx+bw-r, by+bh, r);
                        ctx.lineTo(bx+r, by+bh);
                        ctx.arcTo(bx, by+bh, bx, by+bh-r, r);
                        ctx.lineTo(bx, by+r);
                        ctx.arcTo(bx, by, bx+r, by, r);
                        ctx.closePath();
                        ctx.stroke();
                    }
                }
            } else if (_gStyle === 'dotboxes') {
                // Cell boxes + corner dots — crisp rendering
                const pad = 2.5, r = 3;
                ctx.strokeStyle = `rgba(190,220,255,${(_gOp * 0.6).toFixed(3)})`;
                ctx.lineWidth = 1.5;
                for (let yi = SPAWN_ROWS; yi < SPAWN_ROWS + _visRows; yi++) {
                    for (let xi = 0; xi < COLS; xi++) {
                        const bx = Math.round(xi*BLOCK)+pad, by = Math.round(yi*BLOCK)+pad;
                        const bw = BLOCK-pad*2, bh = BLOCK-pad*2;
                        ctx.beginPath();
                        ctx.moveTo(bx+r, by); ctx.lineTo(bx+bw-r, by);
                        ctx.arcTo(bx+bw, by, bx+bw, by+r, r);
                        ctx.lineTo(bx+bw, by+bh-r); ctx.arcTo(bx+bw, by+bh, bx+bw-r, by+bh, r);
                        ctx.lineTo(bx+r, by+bh); ctx.arcTo(bx, by+bh, bx, by+bh-r, r);
                        ctx.lineTo(bx, by+r); ctx.arcTo(bx, by, bx+r, by, r);
                        ctx.closePath(); ctx.stroke();
                    }
                }
                ctx.fillStyle = `rgba(190,220,255,${(_gOp * 0.65).toFixed(3)})`;
                const dotR = 1.8;
                for (let xi = 0; xi <= COLS; xi++) {
                    for (let yi = SPAWN_ROWS; yi <= SPAWN_ROWS + _visRows; yi++) {
                        const dx = Math.round(xi*BLOCK), dy = Math.round(yi*BLOCK);
                        ctx.beginPath();
                        ctx.arc(dx, dy, dotR, 0, Math.PI*2);
                        ctx.fill();
                    }
                }
            } else {
                // Default: classic lines
                ctx.strokeStyle=`rgba(190,220,255,${_gAlpha})`;ctx.lineWidth=1;
                const _gridTop = SPAWN_ROWS * BLOCK, _gridBot = (SPAWN_ROWS + _visRows) * BLOCK;
                ctx.beginPath();
                for(let x=1;x<COLS;x++){const px=Math.round(x*BLOCK)+.5;ctx.moveTo(px,_gridTop);ctx.lineTo(px,_gridBot);}
                ctx.stroke();
                ctx.beginPath();
                for(let y=SPAWN_ROWS+1;y<SPAWN_ROWS+_visRows;y++){const py=Math.round(y*BLOCK)+.5;ctx.moveTo(0,py);ctx.lineTo(canvas._logicalWidth,py);}
                ctx.stroke();
            }
        }
    }
    let _effectTime = null;
    function drawGame() {
        const now = performance.now();
        const effectDt = _effectTime === null || isPaused ? 0 : Math.min(100, now - _effectTime);
        _effectTime = now;
        ctx.save();
        if(shakeIntensity>0){ctx.translate((Math.random()-.5)*shakeIntensity,(Math.random()-.5)*shakeIntensity);shakeIntensity*=Math.pow(.9,effectDt*60/1000);if(shakeIntensity<.5)shakeIntensity=0;}
        ctx.fillStyle='#000';ctx.fillRect(-10,-10,canvas._logicalWidth+20,canvas._logicalHeight+20);
        ctx.translate(0, -SPAWN_ROWS * BLOCK);
        const gridKey = [COLS,ROWS,BLOCK,settings.gridOpacity,settings.gridStyle,window.devicePixelRatio].join('|');
        if (!_gridCache || _gridCache.key !== gridKey) {
            const tile = document.createElement('canvas'), dpr = Math.min(2,window.devicePixelRatio||1);
            tile.width = Math.ceil(COLS*BLOCK*dpr); tile.height = Math.ceil(ROWS*BLOCK*dpr);
            const gc = tile.getContext('2d'); gc.scale(dpr,dpr);
            _paintGrid(gc);
            _gridCache = {key:gridKey,tile,dpr};
        }
        ctx.drawImage(_gridCache.tile,0,0,COLS*BLOCK,ROWS*BLOCK);
        
        board.forEach((r,y)=>r.forEach((v,x)=>{if(v)drawGameBlock(ctx,x,y,v,BLOCK)}));
        if(player.matrix){
            if(settings.optGhost){let gY=player.pos.y; while(!collide(board,{matrix:player.matrix,pos:{x:player.pos.x,y:gY}}))gY++; gY--;
            player.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v)drawGameBlock(ctx,player.pos.x+x,gY+y,v,BLOCK,true)}));}
            player.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v)drawGameBlock(ctx,player.pos.x+x,player.pos.y+y,v,BLOCK)}));
        }
        for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.update(effectDt); p.draw(ctx); if (p.l <= 0) particles.splice(i, 1); }
        for (let i = shockwaves.length - 1; i >= 0; i--) { const s = shockwaves[i]; s.update(effectDt); s.draw(ctx); if (s.l <= 0) shockwaves.splice(i, 1); }
        for (let i = floatingTexts.length - 1; i >= 0; i--) { const ft = floatingTexts[i]; ft.update(effectDt); ft.draw(ctx); if (ft.l <= 0) floatingTexts.splice(i, 1); }

        if(isAnimating&&animatingLines.length){
            const key=[COLS,BLOCK,window.devicePixelRatio].join('|');
            if (!_lineFlash || _lineFlash.key!==key) {
                const tile=document.createElement('canvas'), dpr=Math.min(2,window.devicePixelRatio||1);
                tile.width=Math.ceil((COLS*BLOCK+80)*dpr);tile.height=Math.ceil((BLOCK+80)*dpr);
                const fc=tile.getContext('2d');fc.scale(dpr,dpr);
                fc.fillStyle='rgba(255,255,255,.8)';fc.shadowBlur=20*dpr;fc.shadowColor='#fff';
                fc.fillRect(40,40,COLS*BLOCK,BLOCK);_lineFlash={key,tile,dpr};
            }
            animatingLines.forEach(y=>ctx.drawImage(_lineFlash.tile,-40,y*BLOCK-40,_lineFlash.tile.width/_lineFlash.dpr,_lineFlash.tile.height/_lineFlash.dpr));
        }
        ctx.restore()
    }
    function drawCenteredPiece(c,p){
        if(!p)return;
        // Cell size relative to canvas — fills more of the canvas area
        const s = BLOCK; // use exact gameplay block size so skins render perfectly
        let mX=10,gX=0,mY=10,gY=0;
        for(let y=0;y<p.length;y++)for(let x=0;x<p[y].length;x++)if(p[y][x]){if(x<mX)mX=x;if(x>gX)gX=x;if(y<mY)mY=y;if(y>gY)gY=y;}
        const pW=gX-mX+1, pH=gY-mY+1;
        const oX = (c.canvas._logicalWidth - pW * s) / 2 - mX * s;
        const oY = (c.canvas._logicalHeight - pH * s) / 2 - mY * s;
        p.forEach((r,y)=>r.forEach((v,x)=>{if(v)drawGameBlock(c, oX/s + x, oY/s + y, v, s)}));
    }
    function drawNext(){
        if (settings.optNoNext) { [pcNextCtx,mNextCtx].filter(Boolean).forEach(c=>{c.clearRect(0,0,c.canvas._logicalWidth,c.canvas._logicalHeight);}); return; }
        [pcNextCtx,mNextCtx].filter(Boolean).forEach(c=>{c.clearRect(0,0,c.canvas._logicalWidth,c.canvas._logicalHeight);drawCenteredPiece(c,player.next)});
        if (settings.opt3Next) {
            [pcNext2Ctx, pcNext3Ctx].forEach((pc, i) => {
                const piece = _nextQueue[i];
                if (pc) { pc.clearRect(0,0,pc.canvas._logicalWidth,pc.canvas._logicalHeight); if(piece) drawCenteredPiece(pc,piece); }
            });
        }
    }

    function getNextPiece() {
        if(pieceBag.length === 0) {
            pieceBag =[1,2,3,4,5,6,7];
            for(let i=6; i>0; i--) { let j = Math.floor(Math.random()*(i+1)); [pieceBag[i], pieceBag[j]]=[pieceBag[j], pieceBag[i]]; }
        }
        const type = pieceBag.pop(); _nextPieceType = type; let colorId;
        if (settings.randomBlockColors) {
            // Whole block gets one random color (not tied to piece type)
            colorId = Math.floor(Math.random() * 7) + 1;
        } else if (settings.randomPieceColors) {
            colorId = Math.floor(Math.random() * 7) + 1;
        } else {
            colorId = type;
        }
        lastPieceColor = colorId;
        return BASE_PIECES[type].map(r => r.map(v => v ? colorId : 0));
    }
    function _refillNextQueue() {
        while (_nextQueue.length < 3) _nextQueue.push(getNextPiece());
    }
    function resetPlayer(){
        _refillNextQueue();
        if(!player.next) { player.next = _nextQueue.shift(); _refillNextQueue(); }
        _currentPieceType = _nextPieceType;
        player.matrix = player.next;
        player.next = _nextQueue.shift();
        _refillNextQueue();
        player.pos.y=0;
        player.pos.x=(COLS/2|0)-(player.matrix[0].length/2|0);
        // Track high_placer: check board after potential line clears
        { const halfRow = Math.floor(ROWS / 2); const aboveHalf = board.slice(0, halfRow).some(row => row.some(v => v !== 0)); if (aboveHalf) { _currentBlocksUnderHalf = 0; } else if (_piecesThisGame > 0) { _currentBlocksUnderHalf++; if (_currentBlocksUnderHalf > _maxBlocksUnderHalfThisGame) _maxBlocksUnderHalfThisGame = _currentBlocksUnderHalf; } }
        // Reset per-piece tracking
        _pieceRotatedThisPlacement = false;
        _rotationsThisPiece = 0;
        _wallBounceCount = 0; _wallTouchedLeft = false; _wallTouchedRight = false;
        drawNext();
        if(collide(board,player)){gameOver();return;}
        // Continue the held direction without restarting DAS on each piece.
        if(!isGameOver && !isPaused){
            const direction = _moveDirection;
            if (direction) {
                _moveDirection=direction;
                _moveRepeatAt=performance.now();
                _updateHeldMove(_moveRepeatAt);
            }
        }
    }

    function doHold() {
        if (!settings.optHold || holdUsed || isGameOver || isPaused || isAnimating) return;
        holdUsed = true;
        // loyal_piece: check counter BEFORE resetting (player is using the held piece)
        if (holdPiece && _loyalPieceCounter >= 30 && !saveData.achievements?.['loyal_piece']?.unlocked) { unlockAchievement('loyal_piece'); saveDataToFile(); }
        _loyalPieceCounter = 0; // reset loyal_piece counter on hold use
        if (!holdPiece) {
            holdPiece = player.matrix;
            resetPlayer();
        } else {
            const tmp = holdPiece;
            holdPiece = player.matrix;
            player.matrix = tmp;
            player.pos.y = 0;
            player.pos.x = (COLS/2|0) - (player.matrix[0].length/2|0);
            if (collide(board, player)) { gameOver(); return; }
            drawNext();
        }
        drawHold();
    }
    function drawHold() {
        const canvases = [document.getElementById('pc-hold-canvas'), document.getElementById('m-hold-canvas')].filter(Boolean);
        canvases.forEach(cv => {
            const c = cv.getContext('2d');
            c.clearRect(0, 0, cv._logicalWidth, cv._logicalHeight);
            if (holdPiece) drawCenteredPiece(c, holdPiece);
        });
        const panel = document.getElementById('hold-panel');
        if (panel) panel.style.opacity = holdUsed ? '0.4' : '1';
    }
    function collide(b,p){const[m,o]=[p.matrix,p.pos];for(let y=0;y<m.length;++y)for(let x=0;x<m[y].length;++x)if(m[y][x]!==0&&(b[y+o.y]&&b[y+o.y][x+o.x])!==0)return true;return false}
    function rotate(m,d){for(let y=0;y<m.length;++y)for(let x=0;x<y;++x)[m[x][y],m[y][x]]=[m[y][x],m[x][y]];if(d>0)m.forEach(r=>r.reverse());else m.reverse()}
    function playerRotate(d){
        _rotatedThisGame=true;_lastMoveWasRotation=true;
        _pieceRotatedThisPlacement=true;
        _rotationsThisPiece++;
        _rotationsThisGame++;
        saveData.stats.totalRotations = (saveData.stats.totalRotations || 0) + 1;
        const ox=player.pos.x,oy=player.pos.y;
        rotate(player.matrix,d);
        // SRS-style kick tables for I (type 1) and T (type 6)
        let kicks;
        if(_currentPieceType===1){
            kicks=[{x:0,y:0},{x:-2,y:0},{x:1,y:0},{x:-2,y:1},{x:1,y:-2},
                   {x:2,y:0},{x:-1,y:0},{x:2,y:-1},{x:-1,y:2}];
        } else if(_currentPieceType===6){
            kicks=[{x:0,y:0},{x:-1,y:0},{x:1,y:0},{x:0,y:-1},
                   {x:-1,y:1},{x:1,y:1},{x:-1,y:-1},{x:1,y:-1}];
        } else {
            kicks=[{x:0,y:0},{x:-1,y:0},{x:1,y:0},{x:-2,y:0},{x:2,y:0},{x:0,y:-1}];
        }
        for(const k of kicks){
            player.pos.x=ox+k.x;player.pos.y=oy+k.y;
            if(!collide(board,player))return;
        }
        // All kicks failed — undo rotation
        rotate(player.matrix,-d);player.pos.x=ox;player.pos.y=oy;
    }
    
    function nativeHaptic(clear = false) {
        if (!window.Capacitor?.isNativePlatform()) return;
        const haptics = window.Capacitor.Plugins.Haptics;
        if (haptics) Promise.resolve(clear ? haptics.notification({ type: 'SUCCESS' }) : haptics.impact({ style: 'LIGHT' })).catch(() => {});
    }
    function merge(b,p){
        nativeHaptic();
        p.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v){b[y+p.pos.y][x+p.pos.x]=v;}}));
        blocksPlacedThisGame++;
        if (!_boardSymmetricAchieved) {
            let _symOk = true, _symCnt = 0;
            outer: for (let _sy = 0; _sy < b.length; _sy++) for (let _sx = 0; _sx < b[_sy].length; _sx++) { if (b[_sy][_sx]) _symCnt++; if (!!b[_sy][_sx] !== !!b[_sy][b[_sy].length-1-_sx]) { _symOk = false; break outer; } }
            if (_symOk && _symCnt >= 15) _boardSymmetricAchieved = true;
        }
        // No Spin Zone: track blocks placed without rotation
        if (!_pieceRotatedThisPlacement) saveData.stats.noSpinBlocks = (saveData.stats.noSpinBlocks || 0) + 1;
        // Dry Spell: track placements without line clears (incremented here, reset in arenaSweep)
        _noLinePlacementCount++;
        // Dizzy: 20+ rotations on a single piece
        if (_rotationsThisPiece >= 20 && !saveData.achievements?.['dizzy']?.unlocked) { unlockAchievement('dizzy'); saveDataToFile(); }
        // Indecisive: 3+ wall bounces
        if (_wallBounceCount >= 3 && !saveData.achievements?.['indecisive']?.unlocked) { unlockAchievement('indecisive'); saveDataToFile(); }
        _piecesThisGame++;
        if (_pendingHardDrop) { _piecesHardDroppedThisGame++; } _pendingHardDrop = false;
        if (_currentPieceType >= 1 && _currentPieceType <= 7) {
            if (!saveData.stats.blockTypeUsage) saveData.stats.blockTypeUsage = {};
            const _typeKey = String(_currentPieceType);
            saveData.stats.blockTypeUsage[_typeKey] = (saveData.stats.blockTypeUsage[_typeKey] || 0) + 1;
            _pieceTypeCounts[_currentPieceType] = (_pieceTypeCounts[_currentPieceType] || 0) + 1;
            _sec7Last.push(_currentPieceType);
            if (_sec7Last.length > 7) _sec7Last.shift();
            if (_sec7Last.length === 7 && new Set(_sec7Last).size === 7) _sec7CountThisGame++;
        }
        const _isI = p.matrix.some(row => row.filter(v=>v!==0).length === 4) || (() => { const nc=p.matrix[0]?.length||0; for(let c=0;c<nc;c++) if(p.matrix.filter(r=>r[c]!==0).length===4) return true; return false; })();
        if (_isI) _lastIPieceGameTime = gameTime;
        _blockTimestampsThisGame.push(gameTime);
        const _cnt60 = _blockTimestampsThisGame.filter(t => t >= gameTime - 60).length;
        if (_cnt60 > _maxBlocksIn60sThisGame) _maxBlocksIn60sThisGame = _cnt60;
        let pts = Math.floor(1 * SPEED_MULTIPLIERS[speedLevel-1]);
        rawGameplayXPThisGame += pts;
        const _bPts = Math.round(pts * currentScoreMultiplier);
        xpFromBlocksThisGame += _bPts; score += _bPts; _spawnScoreFly(_bPts); updateUI();
        // Let It Stack: 30+ placements without a line clear
        if (_noLinePlacementCount >= 30 && !saveData.achievements?.['dry_spell']?.unlocked) { unlockAchievement('dry_spell'); saveDataToFile(); }
        // Staircase: perfect staircase pattern on board
        if (!saveData.achievements?.['staircase']?.unlocked) {
            const _colHeights = [];
            for (let c = 0; c < COLS; c++) { let h = 0; for (let r = 0; r < ROWS; r++) { if (b[r][c] !== 0) { h = ROWS - r; break; } } _colHeights.push(h); }
            const _hasBlocks = _colHeights.some(h => h > 0);
            if (_hasBlocks) {
                let _isStairAsc = true, _isStairDesc = true;
                for (let c = 1; c < COLS; c++) { if (_colHeights[c] !== _colHeights[c-1] + 1) _isStairAsc = false; if (_colHeights[c] !== _colHeights[c-1] - 1) _isStairDesc = false; }
                if (_isStairAsc || _isStairDesc) { unlockAchievement('staircase'); saveDataToFile(); }
            }
        }
        // Track blocks placed when stack is high (top 5 rows filled = height >= 15)
        const _bh = board.findIndex(row => row.some(v => v !== 0));
        if (_bh >= 0 && _bh < 5) _highStackBlocksThisGame++;
        // Mission: bottom quarter + bottom 2 rows blocks
        if (p.matrix) p.matrix.forEach((r,dy) => r.forEach((v,dx) => { if(v) { if((p.pos.y+dy) >= ROWS - Math.floor(ROWS/4)) _mq_bottomQuarterBlocks++; if((p.pos.y+dy) >= ROWS - 2) _bottomTwoRowsThisGame++; } }));
        // Mission: I-piece on bottom row
        const _mIsI2 = p.matrix && (p.matrix.some(row=>row.filter(v=>v!==0).length===4)||(() => { const nc=p.matrix[0]?.length||0; for(let c=0;c<nc;c++) if(p.matrix.filter(r=>r[c]!==0).length===4) return true; return false; })());
        if (_mIsI2) { const _pb = p.pos.y + p.matrix.length - 1; if (_pb >= ROWS-1) _mq_iFloor = true; }
        // Mission: narrow escape (stack in top 4 rows)
        const _danger = board.slice(0,4).some(r=>r.some(v=>v!==0));
        if (_danger && _mq_dangerEntryTime < 0) _mq_dangerEntryTime = gameTime;
        else if (!_danger) _mq_dangerEntryTime = -1;
        if (_mq_dangerEntryTime >= 0 && gameTime - _mq_dangerEntryTime >= 20) _mq_narrowEscape = true;
        // Mission: comebackKid (blocks in top 2 visible rows, then survive 60s more)
        const _topDanger = board[SPAWN_ROWS] && board[SPAWN_ROWS].some(v => v !== 0);
        if (_topDanger && _mq_comebackKidEntryTime < 0) _mq_comebackKidEntryTime = gameTime;
        if (_mq_comebackKidEntryTime >= 0 && !_mq_comebackKid && gameTime - _mq_comebackKidEntryTime >= 60) _mq_comebackKid = true;
        // Mission: monochrome (20+ blocks of same piece type in one game)
        if (_currentPieceType >= 1 && _currentPieceType <= 7 && (_pieceTypeCounts[_currentPieceType] || 0) >= 20) _mq_monochrome = true;
        // Mission: flatEarth (stack height ≤ 5 for 60s continuous)
        { const _bHi = board.findIndex(row => row.some(v => v !== 0)); const _sH = _bHi >= 0 ? ROWS - _bHi : 0;
          if (_sH <= 5) { if (_mq_flatEarthStart < 0) _mq_flatEarthStart = gameTime; if (gameTime - _mq_flatEarthStart >= 60) _mq_flatEarth = true; }
          else _mq_flatEarthStart = -1; }
        holdUsed = false; if (settings.optHold) drawHold();
        // loyal_piece: track blocks placed while hold slot is occupied
        if (holdPiece) _loyalPieceCounter++; else _loyalPieceCounter = 0;
    }
    const _LINE_PTS = [0, 10, 20, 30, 40];
    const _CLEAR_LABELS = ['', '', 'Double Clear', 'Triple Clear', 'QUAD!'];
    const _COMBO_COLORS = { 2: '#ffaa44', 3: '#ffdd22', 4: '#22ffaa', 5: '#00eeff', 6: '#aa44ff', 7: '#ff44ff', default: '#ff2222' };
    function _getComboColor(n) { return _COMBO_COLORS[Math.min(n, 7)] || _COMBO_COLORS.default; }

    let _midGameAchsShown = new Set();
    function _checkMidGameAchievements() {
        if (isGameOver || isPaused) return;
        const feed = document.getElementById('game-ach-feed');
        if (!feed) return;
        const g = {
            score, lines: linesClearedThisGame, blocks: blocksPlacedThisGame, time: gameTime,
            maxSpeed: speedLevel, mode: currentGameMode, mirror: !!settings.optMirror,
            maxLineStreak: _maxLineStreakThisGame, iPieceLines: _iPieceLinesThisGame,
            clearedTopLine: _clearedTopLineThisGame, boardCleared: _boardClearedThisGame,
        };
        const _prospective = {
            totalBlocksPlaced: (saveData.stats.totalBlocksPlaced || 0) + blocksPlacedThisGame,
            totalLinesCleared: (saveData.stats.totalLinesCleared || 0) + linesClearedThisGame,
            totalQuads: (saveData.stats.totalQuads || 0) + _quadrasThisGame,
            surgeonLines: (saveData.stats.surgeonLines || 0) + _surgeonLinesThisGame,
            highStackBlocks: (saveData.stats.highStackBlocks || 0) + _highStackBlocksThisGame,
        };
        // Check secret (single) achievements during gameplay
        for (const ach of ACHIEVEMENTS_DEF) {
            if (ach.cat !== 'secret') continue;
            if (saveData.achievements?.[ach.id]?.unlocked) continue;
            const key = `sec_${ach.id}`;
            if (_midGameAchsShown.has(key)) continue;
            if (ach.check) {
                try {
                    if (ach.check(g)) { _midGameAchsShown.add(key); _showGameAchievement(ach, 0); }
                } catch(e) {}
            }
        }
        // Check tiered achievements
        for (const ach of ACHIEVEMENTS_DEF) {
            if (ach.cat === 'secret') continue;
            if (!ach.tiers) continue;
            const current = saveData.achievements?.[ach.id]?.tier || 0;
            if (current >= ach.tiers.length) continue;
            const nextTier = ach.tiers[current];
            if (!nextTier) continue;
            const key = `${ach.id}_${current}`;
            if (_midGameAchsShown.has(key)) continue;
            let met = false;
            if (nextTier.progress) {
                const path = nextTier.progress.path;
                const statKey = path.replace('stats.', '');
                const val = _prospective[statKey] !== undefined ? _prospective[statKey] : _getProgressVal(path);
                met = val >= nextTier.progress.target;
            } else if (nextTier.check) {
                try { met = nextTier.check(g); } catch(e) {}
            }
            if (met) {
                _midGameAchsShown.add(key);
                _showGameAchievement(ach, current);
            }
        }
    }

    function arenaSweep(){
        let rows=[];for(let y=ROWS-1;y>=0;--y){let full=true;for(let x=0;x<COLS;++x)if(board[y][x]===0){full=false;break;}if(full)rows.push(y)}
        if(rows.length){
            nativeHaptic(true);
            const midY=(rows[0]+rows[rows.length-1])/2*BLOCK+BLOCK/2; const str=rows.length; triggerShake(str*3); shockwaves.push(new Shockwave(midY,str));
            rows.forEach(y=>{for(let x=0;x<COLS;x++){const v=board[y][x];if(v){const c=COLORS[v];for(let i=0;i<str*2;i++)particles.push(new Particle(x*BLOCK+BLOCK/2,y*BLOCK+BLOCK/2,c))}}});
            if (rows.length >= 4) { _quadraKillThisGame = true; _quadrasThisGame++; }
            if (rows.length <= 2) _surgeonLinesThisGame += rows.length;
            // Single line clears tracking (One at a Time)
            if (rows.length === 1) saveData.stats.singleLineClears = (saveData.stats.singleLineClears || 0) + 1;
            // Mission: doubles/triples tracking
            if (rows.length === 2) _doublesThisGame++;
            else if (rows.length === 3) _triplesThisGame++;
            // Mission: minimalist (8 single-line clears only, no doubles+)
            if (rows.length === 1) { _mq_minimalistLines++; if (!_mq_minimalistFailed && _mq_minimalistLines >= 8) _mq_minimalist = true; }
            else if (rows.length > 1) _mq_minimalistFailed = true;
            // Dry Spell reset on line clear
            _noLinePlacementCount = 0;
            // Double the Satisfaction: back-to-back quads
            if (rows.length >= 4 && _lastClearWasQuad && !saveData.achievements?.['double_satisfaction']?.unlocked) { unlockAchievement('double_satisfaction'); }
            // Mission: quad streak (2 quads in a row)
            if (rows.length >= 4 && _lastClearWasQuad) _mq_quadStreak = true;
            _lastClearWasQuad = rows.length >= 4;
            // Surgeon's Streak: 1,2,3,4 in exact order
            if (rows.length === _surgeonStreakStep + 1) { _surgeonStreakStep++; if (_surgeonStreakStep >= 4 && !saveData.achievements?.['surgeons_streak']?.unlocked) { unlockAchievement('surgeons_streak'); } }
            else { _surgeonStreakStep = (rows.length === 1) ? 1 : 0; }
            if (rows.includes(0)) _clearedTopLineThisGame = true;
            // I-piece line tracking
            const _isIPiece = player.matrix && (player.matrix.some(row => row.filter(v=>v!==0).length === 4) || (() => { const nc=player.matrix[0]?.length||0; for(let c=0;c<nc;c++) if(player.matrix.filter(r=>r[c]!==0).length===4) return true; return false; })());
            if (_isIPiece) {
                _iPieceLinesThisGame += rows.length;
                if (rows.length >= 4 && (gameTime - _lastIPieceGameTime) >= 90) _waitedTetrisThisGame = true;
            }
            // Line streak
            _currentLineStreak++; if (_currentLineStreak > _maxLineStreakThisGame) _maxLineStreakThisGame = _currentLineStreak;
            // Mission: hat trick (3 consecutive line-clearing placements)
            if (_currentLineStreak >= 3) _mq_hatTrickDone = true;
            // T-spin detection: T-piece + last move was rotation + 3/4 corners occupied
            const _isTSpin = _lastMoveWasRotation && _currentPieceType === 6 && (() => {
                const px = player.pos.x, py = player.pos.y;
                let corners = 0;
                [[0,0],[0,2],[2,0],[2,2]].forEach(([dr,dc]) => {
                    const r = py + dr, c = px + dc;
                    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== 0) corners++;
                });
                return corners >= 3;
            })();
            _lastMoveWasRotation = false;
            // Combo tracking
            const _comboCountBefore = _comboCount;
            _comboCount += rows.length;
            if (_comboCount > _maxComboThisGame) _maxComboThisGame = _comboCount;
            isAnimating=true;animatingLines=rows;clearTimeout(dasTimer);clearInterval(arrTimer);drawGame();
            setTimeout(()=>{
                let newB=board.filter((r,y)=>!rows.includes(y));let lR=ROWS-newB.length;
                for(let i=0;i<lR;i++)newB.unshift(Array(COLS).fill(0));board=newB;

                const basePts = _LINE_PTS[lR] || lR * 10;
                rawGameplayXPThisGame += Math.floor(basePts * SPEED_MULTIPLIERS[speedLevel-1]);
                let actualPts = Math.round(Math.floor(basePts * SPEED_MULTIPLIERS[speedLevel-1]) * currentScoreMultiplier);
                xpFromLinesThisGame += actualPts; score += actualPts; _spawnScoreFly(actualPts); linesClearedThisGame+=lR;
                playSFX('clear');

                const ftColor = COLORS[Math.floor(Math.random() * 7) + 1];
                const ftCenterY = (rows[0] + rows[rows.length-1]) / 2 * BLOCK;
                let ftY = ftCenterY - 20; // start position, stack downward
                // T-spin label
                if (_isTSpin) {
                    _tSpinsThisGame++;
                    floatingTexts.push(new FloatingText(canvas._logicalWidth / 2, ftY, 'T-SPIN!', '#ff44ff', 28));
                    ftY += 24;
                    triggerShake(6);
                    if (lR === 3) { saveData.stats.tSpinTriples = (saveData.stats.tSpinTriples || 0) + 1; if (!saveData.achievements?.['clutch']?.unlocked) unlockAchievement('clutch'); }
                }
                // Multi-line label
                const _label = _CLEAR_LABELS[lR];
                if (_label) { floatingTexts.push(new FloatingText(canvas._logicalWidth / 2, ftY, _label, ftColor)); ftY += 22; }
                // Points
                floatingTexts.push(new FloatingText(canvas._logicalWidth / 2, ftY, `+${actualPts}`, ftColor));
                ftY += 22;
                // Combo display (starting at combo 2)
                if (_comboCount >= 2) {
                    rawGameplayXPThisGame += (_comboCount - 1) * 10;
                    const comboBonus = Math.round((_comboCount - 1) * 10 * currentScoreMultiplier);
                    score += comboBonus; xpFromLinesThisGame += comboBonus; _spawnScoreFly(comboBonus);
                    const cColor = _getComboColor(_comboCount);
                    const comboSz = Math.min(38, 20 + _comboCount * 2);
                    const comboY = ftY;
                    const numSteps = _comboCount - _comboCountBefore; // equals lR
                    const ft = new FloatingText(canvas._logicalWidth/2, comboY, `COMBO ×${_comboCount}`, cColor, comboSz);
                    ft.x = canvas._logicalWidth/2;
                    if (numSteps > 1) ft.punchT = 0;
                    floatingTexts.push(ft);
                    ftY += 24;
                    floatingTexts.push(new FloatingText(canvas._logicalWidth / 2, ftY, `+${comboBonus}`, cColor));
                    if (_comboCount >= 5) triggerShake(Math.min(15, _comboCount * 2));
                }

                const oldSpeed = speedLevel;
                const _baseSpeed = currentGameMode === 'fun' ? Math.max(1, funModeConfig.startSpeed) : 1;
                speedLevel = Math.min(15, Math.floor(linesClearedThisGame/10) + _baseSpeed);
                // Mission: reach speed 5 in under 3 minutes / speed 4 in under 2 minutes
                if (speedLevel >= 5 && !_mq_speedRun && gameTime < 180) _mq_speedRun = true;
                if (speedLevel >= 4 && !_mq_speedQueen && gameTime < 120) _mq_speedQueen = true;
                if (speedLevel > oldSpeed) {
                    playSFX('levelup');
                    if (settings.showSpeedUp !== false) {
                        floatingTexts.push(new FloatingText(canvas._logicalWidth / 2, canvas._logicalHeight / 2 - 20, `SPEED UP!`, '#ffcc00', 32));
                        floatingTexts.push(new FloatingText(canvas._logicalWidth / 2, canvas._logicalHeight / 2 + 10, `Speed ${speedLevel}`, '#ffcc00', 20));
                    }
                }
                dropInterval = Math.floor(1000 / speedLevel);
                // Board clear check (after removing lines)
                if (board.every(row => row.every(v => v === 0))) _boardClearedThisGame = true;
                updateUI();isAnimating=false;animatingLines=[];lastTime=performance.now();resetPlayer();if(_bufferedMove){playerMove(_bufferedMove);_bufferedMove=0;}
                _checkMidGameAchievements();
            }, settings.lineClearMs ?? 150);return true
        }return false
    }
    function playerMove(d){_lastMoveWasRotation=false;const _md=settings.optMirror?-d:d;player.pos.x+=_md;if(collide(board,player))player.pos.x-=_md;
        // Indecisive: track wall touches
        if(player.matrix){const pw=player.matrix[0].length;const atLeft=player.pos.x<=0;const atRight=player.pos.x+pw>=COLS;if(atLeft&&!_wallTouchedLeft){_wallTouchedLeft=true;if(_wallTouchedRight)_wallBounceCount++;}if(atRight&&!_wallTouchedRight){_wallTouchedRight=true;if(_wallTouchedLeft)_wallBounceCount++;}}}
    function playerDrop(){player.pos.y++;_lastMoveWasRotation=false;if(collide(board,player)){player.pos.y--;_lastPlacedTime=performance.now();merge(board,player);if(!arenaSweep()){_currentLineStreak=0;_comboCount=0;_lastClearWasQuad=false;_surgeonStreakStep=0;resetPlayer();}}dropCounter=0}
    function playerHardDrop(){
        if(_hardDropAnimating)return;
        if(settings.hardDropLock && (performance.now()-_lastPlacedTime)<(settings.hardDropLockMs||100))return;
        const startY=player.pos.y;
        while(!collide(board,player))player.pos.y++;player.pos.y--;
        const targetY=player.pos.y;
        player.pos.y=startY;
        const dist=targetY-startY;
        function finishDrop(){player.pos.y=targetY;_lastPlacedTime=performance.now();_pendingHardDrop=true;_hardDropsThisGame++;merge(board,player);const _sa=[0,2,3,5][settings.shakeStrength??2];if(_sa>0)triggerShake(_sa);playSFX('drop');if(!arenaSweep()){_currentLineStreak=0;_comboCount=0;_lastClearWasQuad=false;_surgeonStreakStep=0;resetPlayer();}dropCounter=0;}
        if(dist<=1){finishDrop();return;}
        _hardDropAnimating=true;
        const dur=Math.min(80,dist*5);
        const t0=performance.now();
        function animFrame(now){
            const p=Math.min(1,(now-t0)/dur);
            player.pos.y=startY+Math.round((targetY-startY)*p);
            drawGame();
            if(p<1){requestAnimationFrame(animFrame);}
            else{_hardDropAnimating=false;lastTime=performance.now();finishDrop();}
        }
        requestAnimationFrame(animFrame);
    }
    function update(t=0){
        if(isPaused) return;
        const dt=Math.max(0,t-lastTime); lastTime=t;
        if(_hardDropAnimating) { requestAnimationFrame(update); return; }
        if(isAnimating) { drawGame(); requestAnimationFrame(update); return; }
        _updateHeldMove(t);
        dropCounter+=dt;
        if(softDropSources.size) {
            _softDropUsedThisGame = true;
            // Cap soft drop to 50ms/row max — prevents insane speed at high speedLevels
            const softBonus = Math.max(0, dropInterval / 50 - 1);
            dropCounter += dt * softBonus;
        }
        if(dropCounter>dropInterval) playerDrop();
        drawGame(); requestAnimationFrame(update);
    }
    function _buildSpeedTapes() {
        const C = ['#4488ff','#3399ff','#22aaff','#33bbff','#44ccff','#44dd77','#88dd44','#ccdd22','#ffcc00','#ffaa00','#ff8800','#ff5500','#ff3300','#ff1100','#ff0000'];
        const SPEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        const W = 14, H = 22;
        let h = `<div style="width:${W}px;height:${H}px;flex-shrink:0;"></div><div style="width:${W}px;height:${H}px;flex-shrink:0;"></div>`;
        SPEEDS.forEach((spd, ci) => {
            h += `<div data-spd="${spd}" style="width:${W}px;height:${H}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;color:${C[ci]};transition:font-size 0.2s ease,opacity 0.2s ease;">${spd}</div>`;
        });
        h += `<div style="width:${W}px;height:${H}px;flex-shrink:0;"></div><div style="width:${W}px;height:${H}px;flex-shrink:0;"></div>`;
        ['m-speed-inner','pc-speed-inner'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = h; });
    }
    function _updateSpeedTape(speed) {
        const W = 14;
        const SPEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        const idx = SPEEDS.indexOf(speed);
        const tx = 35 - (idx + 2.5) * W;
        ['m-speed-inner','pc-speed-inner'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!el.querySelector('[data-spd]')) _buildSpeedTapes();
            el.style.transform = `translateX(${tx}px)`;
            el.querySelectorAll('[data-spd]').forEach(cell => {
                const s = parseFloat(cell.dataset.spd);
                const d = Math.abs(SPEEDS.indexOf(s) - idx);
                if (s === speed) { cell.style.opacity = '1'; cell.style.fontSize = '0.72rem'; cell.style.fontWeight = 'bold'; }
                else if (d <= 2) { cell.style.opacity = d === 1 ? '0.5' : '0.25'; cell.style.fontSize = '0.55rem'; cell.style.fontWeight = 'normal'; }
                else { cell.style.opacity = '0'; cell.style.fontSize = '0.5rem'; cell.style.fontWeight = 'normal'; }
            });
        });
    }
    function _fmtScoreHTML(v){const i=Math.floor(v);const d=Math.round((v-i)*10);return i.toLocaleString()+(d>0?`<span style="font-size:0.6em;opacity:0.7;">.${d}</span>`:'');}
    function updateUI(){const m=Math.floor(gameTime/60),s=gameTime%60;const tS=(m<10?"0"+m:m)+":"+(s<10?"0"+s:s);document.getElementById('pc-score').innerHTML=_fmtScoreHTML(score);document.getElementById('pc-time').innerText=tS;_updateSpeedTape(speedLevel);document.getElementById('pc-lines').innerText=linesClearedThisGame;const _isFunHud=currentGameMode==='fun';const _hudRec=_isFunHud?(saveData.stats?.bestFunScore||0):_prevHighscore;const _hudRecLabel=_isFunHud?'Fun Record':'Personal Record';if(_hudRec>0){const diff=score-_hudRec;['m-pb-hint','pc-pb-hint'].forEach(id=>{const el=document.getElementById(id);if(!el)return;if(diff>=0){el.innerHTML=`<span style="font-size:0.6rem;color:#44ff88;font-weight:bold;display:block;letter-spacing:1px;text-transform:uppercase;">New record!</span><span style="font-size:1rem;color:#44ff88;font-weight:bold;display:block;line-height:1.1;">+${diff.toLocaleString()}</span>`;}else{el.innerHTML=`<span style="font-size:0.48rem;color:rgba(255,255,255,0.38);display:block;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:1px;">${_hudRecLabel}</span><span style="font-size:0.9rem;color:#ddd;font-weight:bold;display:block;line-height:1.1;">${_hudRec.toLocaleString()}</span><span style="font-size:0.6rem;color:#ffaa44;display:block;margin-top:2px;">${(-diff).toLocaleString()} to beat</span>`;}});}else{['m-pb-hint','pc-pb-hint'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=`<span style="font-size:0.48rem;color:rgba(255,255,255,0.2);display:block;letter-spacing:1.5px;text-transform:uppercase;">No records yet</span>`;});}}
    const _scoreFlyRects = new Map();
    function _refreshScoreFlyRects() {
        ['pc-score','m-score'].forEach(id => {
            const el=document.getElementById(id);
            if (el) _scoreFlyRects.set(id,el.getBoundingClientRect());
        });
    }
    const _scheduleScoreFlyRects = () => requestAnimationFrame(_refreshScoreFlyRects);
    window.addEventListener('resize',_scheduleScoreFlyRects);
    new MutationObserver(_scheduleScoreFlyRects).observe(document.getElementById('app'),{attributes:true,attributeFilter:['class','style']});
    _scheduleScoreFlyRects();
    function _spawnScoreFly(pts) {
        if (!pts || pts <= 0) return;
        const isBig = pts >= 10;
        const dur = isBig ? 600 : 450;
        ['pc-score','m-score'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const rect = _scoreFlyRects.get(id);
            if (!rect || rect.width === 0) return;
            el.classList.remove('score-pop'); requestAnimationFrame(() => el.classList.add('score-pop'));
            el.addEventListener('animationend', function _sp(e) { if (e.target !== el) return; el.classList.remove('score-pop'); el.removeEventListener('animationend', _sp); });
            const fly = document.createElement('div');
            fly.textContent = '+' + Math.round(pts).toLocaleString();
            fly.style.cssText = `position:fixed;left:${rect.left+rect.width/2}px;top:${rect.bottom+2}px;`+
                `transform:translateX(-50%);font-family:inherit;font-weight:900;`+
                `color:${isBig?'#ffe844':'#aaffaa'};`+
                `font-size:${isBig?'0.9rem':'0.6rem'};pointer-events:none;z-index:9999;`+
                `white-space:nowrap;text-shadow:0 0 6px currentColor;`+
                `animation:scoreFly ${dur}ms ease-out forwards;`;
            document.body.appendChild(fly);
            setTimeout(()=>fly.remove(), dur+50);
        });
    }
    
    function gameOver(){
        _gameInProgress = false; // allow saves again — score and achievements saved together below
        isGameOver=true; isPaused=true;
        isAnimating=false; animatingLines=[]; _hardDropAnimating=false; // safety: clear all animation locks
        _boosterUsedThisRound = false;
        try {
        const _gcGO = document.getElementById('game-container');
        if (_gcGO) _gcGO.style.transform = '';
        musicPlaying = false;
        _stopMusicSources();
        updateNowPlaying('');
        setTimeout(()=>playSFX('gameover'), 200);

        // Fun mode: no XP, no leaderboard — but still check score-based achievements
        if (currentGameMode === 'fun') {
            // fun_squared tracking (only count games where at least 1 line was cleared)
            if (linesClearedThisGame >= 1) saveData.stats.funGamesPlayed = (saveData.stats.funGamesPlayed || 0) + 1;
            const m = Math.floor(gameTime/60); const s = gameTime%60;
            const timeStr = (m<10?"0"+m:m)+":"+(s<10?"0"+s:s);
            // Track best-ever stats for achievement progress bars
            if (gameTime > (saveData.stats.bestSurvivalTime || 0)) saveData.stats.bestSurvivalTime = gameTime;
            if (_maxLineStreakThisGame > (saveData.stats.bestLineStreak || 0)) saveData.stats.bestLineStreak = _maxLineStreakThisGame;
            if (_maxBlocksIn60sThisGame > (saveData.stats.bestBlocksIn60s || 0)) saveData.stats.bestBlocksIn60s = _maxBlocksIn60sThisGame;
            if (_iPieceLinesThisGame > (saveData.stats.bestIPieceLines || 0)) saveData.stats.bestIPieceLines = _iPieceLinesThisGame;
            if (_maxBlocksUnderHalfThisGame > (saveData.stats.bestHighPlacer || 0)) saveData.stats.bestHighPlacer = _maxBlocksUnderHalfThisGame;
            if (score > (saveData.stats.bestFunScore || 0)) saveData.stats.bestFunScore = score;
            // Save to fun leaderboard (skip zero scores)
            if (Math.round(score) > 0) { const _fnow = new Date(); const _fd = String(_fnow.getDate()).padStart(2,'0'); const _fm = String(_fnow.getMonth()+1).padStart(2,'0'); const _fy = _fnow.getFullYear(); const _fhh = String(_fnow.getHours()).padStart(2,'0'); const _fmm = String(_fnow.getMinutes()).padStart(2,'0'); if (!saveData.funLeaderboard) saveData.funLeaderboard = []; saveData.funLeaderboard.push({ score: Math.round(score), date:`${_fd}.${_fm}.${_fy} ${_fhh}:${_fmm}`, lines: linesClearedThisGame, time: gameTime, maxSpeed: speedLevel, cols: funModeConfig.cols, rows: funModeConfig.rows, startSpeed: funModeConfig.startSpeed }); saveData.funLeaderboard.sort((a,b) => b.score - a.score); if (saveData.funLeaderboard.length > 200) saveData.funLeaderboard = saveData.funLeaderboard.slice(0, 200); }
            // Check achievements even in fun mode (score-based ones apply)
            saveData.stats.luckySevenCount = (saveData.stats.luckySevenCount || 0) + _sec7CountThisGame;
            const funNewAch = checkAchievements({ score, lines: linesClearedThisGame, blocks: blocksPlacedThisGame, time: gameTime, maxSpeed: speedLevel, mode: currentGameMode, mirror: !!settings.optMirror, quadraKill: _quadraKillThisGame, boardCleared: _boardClearedThisGame, maxLineStreak: _maxLineStreakThisGame, maxBlocksIn60s: _maxBlocksIn60sThisGame, iPieceLines: _iPieceLinesThisGame, clearedTopLine: _clearedTopLineThisGame, highPlacer: _maxBlocksUnderHalfThisGame, noRotate: !_rotatedThisGame, equalPieces: false, luckySevenCount: saveData.stats.luckySevenCount, waitedTetris: _waitedTetrisThisGame, noHardDrop: _hardDropsThisGame === 0, allHardDrop: _piecesThisGame >= 20 && _piecesThisGame === _piecesHardDroppedThisGame, bigFont: _bigFontGameFlag, exactBlocks100: blocksPlacedThisGame === 100, speedrunner: linesClearedThisGame >= 10 ? gameTime : 9999, earlyBird: _earlyBirdThisGame, nice69: _nice69Triggered, boardSymmetric: _boardSymmetricAchieved });
            if (funNewAch.length) { _showGoAchievements(funNewAch); }
            saveDataToFile();
            // Show fun stats panel, hide normal XP breakdown
            document.getElementById('go-xp-breakdown').style.display = 'none';
            const funStats = document.getElementById('go-fun-stats');
            if (funStats) {
                funStats.style.display = '';
                document.getElementById('go-fun-score').innerText = Math.round(score).toLocaleString();
                document.getElementById('go-fun-time').innerText = timeStr;
                document.getElementById('go-fun-lines').innerText = linesClearedThisGame;
                document.getElementById('go-fun-speed').innerText = speedLevel;
                const _funRecEl = document.getElementById('go-fun-record');
                if (_funRecEl) {
                    const _funBest = saveData.stats.bestFunScore || 0;
                    const _isNewFunRec = _funBest > 0 && Math.round(score) >= _funBest && score > 0;
                    _funRecEl.innerHTML = _funBest > 0
                        ? (_isNewFunRec ? `<span style="color:#ffd700;font-weight:bold;">★ NEW FUN RECORD!</span>` : `Fun Record: <span style="color:var(--primary);">${_funBest.toLocaleString()}</span>`)
                        : '';
                }
            }
            if (document.getElementById('go-boost-row')) document.getElementById('go-boost-row').style.display = 'none';
            return; // skip XP/leaderboard processing
        }

        let finalXP=0, pbBonus=0;
        const m = Math.floor(gameTime/60); const s = gameTime%60;
        document.getElementById('go-time-played').innerText = (m<10?"0"+m:m)+":"+(s<10?"0"+s:s);
        document.getElementById('go-max-speed').innerText = speedLevel;

        if(linesClearedThisGame===0){
            document.getElementById('go-penalty').style.display='block';
            document.getElementById('go-stats-group').style.display='none';
        }else{
            document.getElementById('go-penalty').style.display='none';
            document.getElementById('go-stats-group').style.display='block';
            document.getElementById('go-blocks-cnt').innerText = blocksPlacedThisGame;
            document.getElementById('go-blocks-xp').innerText = Math.round(xpFromBlocksThisGame) + " XP";
            document.getElementById('go-lines-cnt').innerText = linesClearedThisGame;
            document.getElementById('go-lines-xp').innerText = Math.round(xpFromLinesThisGame) + " XP";

            if(Math.round(score) > saveData.highscore && score > 0){
                playSFX('newrecord');
                const oldHS = saveData.highscore;
                // Track highscore history
                if (!saveData.highscoreHistory) saveData.highscoreHistory = [];
                if (oldHS > 0) {
                    const _d = new Date();
                    // Archive old highscore: use its saved stats if available, otherwise just date
                    const _oldEntry = saveData.highscoreData
                        ? { ...saveData.highscoreData }
                        : { score: oldHS, date: `${String(_d.getDate()).padStart(2,'0')}.${String(_d.getMonth()+1).padStart(2,'0')}.${_d.getFullYear()}` };
                    saveData.highscoreHistory.push(_oldEntry);
                }
                const _d2 = new Date();
                saveData.highscoreData = { score: Math.round(score), date: `${String(_d2.getDate()).padStart(2,'0')}.${String(_d2.getMonth()+1).padStart(2,'0')}.${_d2.getFullYear()}`, lines: linesClearedThisGame, time: Math.floor(gameTime), maxSpeed: speedLevel };
                const diffPts = Math.round(score) - (oldHS > 0 ? oldHS : 0);
                const bonusPct = Math.floor(diffPts / 100) * 10;
                pbBonus = Math.round(score * bonusPct / 100);
                saveData.highscore = Math.round(score);
                document.getElementById('go-pb-row').style.display='flex';
                document.getElementById('go-pb-xp').innerText="+"+pbBonus+" XP";
                document.getElementById('go-pb-pct').innerText=`(+${bonusPct}% BONUS)`;
            }else{
                document.getElementById('go-pb-row').style.display='none';
            }
            finalXP = Math.round(score + pbBonus);
            const _rawGameXP = finalXP;
            // Apply daily mission streak XP multiplier
            { const _msxm = _getMissionStreakXPMult(); if (_msxm > 1) finalXP = Math.round(finalXP * _msxm); }
            // Multiplier already applied to score during gameplay
            saveToLeaderboard(Math.round(score), linesClearedThisGame, blocksPlacedThisGame, gameTime, speedLevel, finalXP, _maxComboThisGame);
            // Track raw XP (pre-multiplier) for daily streak threshold check
            if (saveData.missions?.daily) saveData.missions.daily.rawXPToday = (saveData.missions.daily.rawXPToday || 0) + _rawGameXP;
        }
        // Show leaderboard position in game over
        const _lbPos = saveData.leaderboard.findIndex(e => e.score === Math.round(score) && Math.abs((e.xp||0) - finalXP) < 2) + 1;
        const _lbPosEl = document.getElementById('go-lb-position');
        if (_lbPosEl && _lbPos > 0) {
            const _posColor = _lbPos === 1 ? '#ffd700' : _lbPos <= 3 ? '#c0c0c0' : _lbPos <= 10 ? '#9b59b6' : '#4488ff';
            const _medal = _lbPos === 1 ? '🥇' : _lbPos === 2 ? '🥈' : _lbPos === 3 ? '🥉' : '';
            _lbPosEl.style.display = '';
            _lbPosEl.innerHTML = `<span style="font-size:0.55rem;color:#555;letter-spacing:2px;">LEADERBOARD</span><br><span style="font-size:1.4rem;font-weight:bold;color:${_posColor};">${_medal}#${_lbPos}</span><span style="font-size:0.65rem;color:#777;"> of ${saveData.leaderboard.length}</span>`;
        } else if (_lbPosEl) {
            _lbPosEl.style.display = 'none';
        }
        gainedXPThisRound = finalXP;
        // Snapshot completed state before update so we can detect newly-completed quests this game
        const _preCompD = saveData.missions ? new Set(
            [...(saveData.missions.daily.quests || []).filter(q => q.completed).map(q => q.id),
             ...(saveData.missions.daily.secret?.completed ? ['__secret__'] : [])]
        ) : null;
        const _preCompW = saveData.missions ? new Set(
            (saveData.missions.weekly.missions || []).filter(wm => wm.completed).map(wm => wm.id)
        ) : null;
        // Update mission progress at game end
        _updateMissionProgress();
        // Show mission summary on game-over screen
        { const _goMR = document.getElementById('go-mission-row');
          if (_goMR && saveData.missions && _preCompD !== null) {
              const _mq = saveData.missions;
              const _newD = (_mq.daily.quests || []).filter(q => q.completed && !_preCompD.has(q.id)).length
                          + (_mq.daily.secret?.completed && !_preCompD.has('__secret__') ? 1 : 0);
              const _newW = (_mq.weekly.missions || []).filter(wm => wm.completed && !_preCompW.has(wm.id)).length;
              const _ptsEarned = _mq.daily.pointsToday || 0;
              if (_newD > 0 || _newW > 0) {
                  const _parts = [];
                  if (_newD > 0) _parts.push(`${_newD} daily quest${_newD !== 1 ? 's' : ''}`);
                  if (_newW > 0) _parts.push(`${_newW} weekly mission${_newW !== 1 ? 's' : ''}`);
                  _goMR.innerHTML = `<span style="color:#44ff88;">✓ ${_parts.join(' + ')} completed</span> <span style="color:#555;font-size:0.5rem;">— tap to view</span>`;
                  _goMR.style.display = 'block';
              } else if (_ptsEarned > 0) {
                  _goMR.innerHTML = `<span style="color:#4499ff;">📋 ${_ptsEarned} daily pts earned</span> <span style="color:#555;font-size:0.5rem;">— tap to view</span>`;
                  _goMR.style.display = 'block';
              } else {
                  _goMR.style.display = 'none';
              }
          } }
        const _lvlBefore = getLevelInfo(saveData.totalXP).level;
        saveData.totalXP += finalXP;
        saveData.xpEarnedSinceLastGift = (saveData.xpEarnedSinceLastGift || 0) + finalXP;
        const _lvlAfter = getLevelInfo(saveData.totalXP).level;

        // Level-up sound effects
        if (_lvlAfter > _lvlBefore) {
            _leveledUpThisGame = true;
            const _RANK_BOUNDARIES = [11, 21, 31, 41, 51, 61, 71, 81];
            let _hitNewRank = false;
            for (let _lv = _lvlBefore + 1; _lv <= _lvlAfter; _lv++) {
                if (_RANK_BOUNDARIES.includes(_lv)) { _hitNewRank = true; break; }
            }
            if (_hitNewRank) {
                playSFX('newrank');
            } else {
                playSFX('rankup');
            }
        }

        _processLevelUps(_lvlBefore, _lvlAfter);
        saveData.stats.gamesPlayed++; saveData.stats.totalTimePlayed+=gameTime; saveData.stats.totalBlocksPlaced+=blocksPlacedThisGame; saveData.stats.totalLinesCleared+=linesClearedThisGame;
        saveData.stats.totalScore = (saveData.stats.totalScore || 0) + Math.round(score);
        saveData.stats.surgeonLines = (saveData.stats.surgeonLines || 0) + _surgeonLinesThisGame;
        saveData.stats.highStackBlocks = (saveData.stats.highStackBlocks || 0) + _highStackBlocksThisGame;
        saveData.stats.totalQuads = (saveData.stats.totalQuads||0) + _quadrasThisGame;
        if (_maxComboThisGame > (saveData.stats.maxCombo || 0)) saveData.stats.maxCombo = _maxComboThisGame;
        // Track best-ever stats for achievement progress bars
        if (speedLevel > (saveData.stats.bestMaxSpeed || 0)) saveData.stats.bestMaxSpeed = speedLevel;
        if (gameTime > (saveData.stats.bestSurvivalTime || 0)) saveData.stats.bestSurvivalTime = gameTime;
        if (_maxLineStreakThisGame > (saveData.stats.bestLineStreak || 0)) saveData.stats.bestLineStreak = _maxLineStreakThisGame;
        if (_maxBlocksIn60sThisGame > (saveData.stats.bestBlocksIn60s || 0)) saveData.stats.bestBlocksIn60s = _maxBlocksIn60sThisGame;
        if (_iPieceLinesThisGame > (saveData.stats.bestIPieceLines || 0)) saveData.stats.bestIPieceLines = _iPieceLinesThisGame;
        if (_maxBlocksUnderHalfThisGame > (saveData.stats.bestHighPlacer || 0)) saveData.stats.bestHighPlacer = _maxBlocksUnderHalfThisGame;
        if (score > (saveData.stats.bestNormalScore || 0)) saveData.stats.bestNormalScore = score;
        if (finalXP > (saveData.stats.bestEarnedXP || 0)) saveData.stats.bestEarnedXP = finalXP;
        if (linesClearedThisGame >= 10 && gameTime < (saveData.stats.bestSpeedrunnerTime || 9999)) saveData.stats.bestSpeedrunnerTime = gameTime;
        // streak_lost: must check BEFORE daily streak gets reset
        { const _ldk2 = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); const _today = _ldk2(new Date()); const _lastPlay = saveData.stats.lastPlayDate || ''; const _prevDay = _ldk2(new Date(Date.now()-86400000)); if (_lastPlay !== _today && _lastPlay !== _prevDay && _lastPlay !== '') { const _oldStreak = saveData.stats.dailyStreak || 0; if (_oldStreak >= 20 && !saveData.achievements?.['streak_lost']?.unlocked) unlockAchievement('streak_lost'); } }
        // Daily streak tracking
        { const _ldk2 = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); const _today = _ldk2(new Date()); const _lastPlay = saveData.stats.lastPlayDate || ''; const _prevDay = _ldk2(new Date(Date.now()-86400000)); if (_lastPlay === _today) {} else if (_lastPlay === _prevDay) { saveData.stats.dailyStreak = (saveData.stats.dailyStreak||0) + 1; } else { saveData.stats.dailyStreak = 1; } saveData.stats.lastPlayDate = _today; saveData.stats.highestDailyStreak = Math.max(saveData.stats.highestDailyStreak || 0, saveData.stats.dailyStreak); }
        // Track play history for calendar
        { const _ldk2 = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); const _today = _ldk2(new Date()); if (!saveData.stats.playHistory) saveData.stats.playHistory = {}; saveData.stats.playHistory[_today] = (saveData.stats.playHistory[_today] || 0) + 1; }
        // --- NEW ACHIEVEMENT TRACKING (batch 2) ---
        // loser: 5 games with 0 lines in a row
        if (linesClearedThisGame === 0) { saveData.stats.noLineStreak = (saveData.stats.noLineStreak || 0) + 1; } else { saveData.stats.noLineStreak = 0; }
        if ((saveData.stats.noLineStreak || 0) >= 5 && !saveData.achievements?.['loser']?.unlocked) unlockAchievement('loser');
        // marathon: 20 games this session
        if (_sessionGamesPlayed >= 20 && !saveData.achievements?.['marathon']?.unlocked) unlockAchievement('marathon');
        // exact_death: finish with an angel number score (111, 222...999, 1111...9999)
        { const _s = String(Math.round(score)); if ((_s.length === 3 || _s.length === 4) && [..._s].every(c => c === _s[0]) && !saveData.achievements?.['exact_death']?.unlocked) unlockAchievement('exact_death'); }
        // deja_vu: same score as a past highscore
        if (saveData.highscoreHistory && saveData.highscoreHistory.length > 0) {
            const _roundScore = Math.round(score);
            if (_roundScore > 0 && saveData.highscoreHistory.some(e => e.score === _roundScore) && !saveData.achievements?.['deja_vu']?.unlocked) unlockAchievement('deja_vu');
        }
        // back_to_back: same score as previous game
        if (_prevGameScore >= 0 && Math.round(score) === _prevGameScore && Math.round(score) >= 100 && !saveData.achievements?.['back_to_back']?.unlocked) unlockAchievement('back_to_back');
        _prevGameScore = Math.round(score);
        // third_charm: score within 10% of record 3 times, then beat it
        { const _hs = saveData.highscore || 0; if (_hs > 0 && Math.round(score) >= _hs * 0.9 && Math.round(score) < _hs) { saveData.stats.nearMissCount = (saveData.stats.nearMissCount || 0) + 1; } else if (Math.round(score) > _hs && _hs > 0) { if ((saveData.stats.nearMissCount || 0) >= 2 && !saveData.achievements?.['third_charm']?.unlocked) unlockAchievement('third_charm'); saveData.stats.nearMissCount = 0; } }
        // prosperity: 20+ boosters saved
        { let _totalBoosters = 0; if (saveData.boosters) { for (const k in saveData.boosters) _totalBoosters += (saveData.boosters[k] || 0); } if (_totalBoosters >= 20 && !saveData.achievements?.['prosperity']?.unlocked) unlockAchievement('prosperity'); }
        // mirror_score tracking
        if (settings.optMirror && score > (saveData.stats.bestMirrorScore || 0)) saveData.stats.bestMirrorScore = Math.round(score);
        // daily_xp tracking
        { const _today = _missionDateKey(); if (saveData.stats.dailyXPDate !== _today) { saveData.stats.dailyXPDate = _today; saveData.stats.dailyXPAmount = 0; } saveData.stats.dailyXPAmount = (saveData.stats.dailyXPAmount || 0) + rawGameplayXPThisGame; if (saveData.stats.dailyXPAmount > (saveData.stats.bestDailyXP || 0)) saveData.stats.bestDailyXP = saveData.stats.dailyXPAmount; }
        // loyal_piece tracking - save best
        if (_loyalPieceCounter > (saveData.stats.bestLoyalPiece || 0)) saveData.stats.bestLoyalPiece = _loyalPieceCounter;
        // --- END NEW ACHIEVEMENT TRACKING ---
        // sec_exact_level check
        if (!saveData.achievements?.['sec_exact_level']?.unlocked && finalXP > 0) {
            if (getLevelInfo(saveData.totalXP).currentXP === 0) {
                unlockAchievement('sec_exact_level');
            }
        }
        // Too Fast: game over when lines cleared mod 10 === 9 and speed >= 6
        if (linesClearedThisGame % 10 === 1 && linesClearedThisGame > 1 && speedLevel >= 3 && !saveData.achievements?.['too_fast']?.unlocked) unlockAchievement('too_fast');
        // The 2048: score exactly 2048
        if (Math.round(score) === 2048 && !saveData.achievements?.['the_2048']?.unlocked) unlockAchievement('the_2048');
        // Leaning Tower: bottom row has exactly 1 filled cell and no other row has more than 3 filled cells, and cleared at least 1 line
        if (linesClearedThisGame >= 1 && !saveData.achievements?.['leaning_tower']?.unlocked) {
            const _btmRow = board[ROWS - 1]; const _btmFilled = _btmRow ? _btmRow.filter(v => v !== 0).length : 0;
            if (_btmFilled === 1) { let _towerOk = true; for (let r = 0; r < ROWS - 1; r++) { if (board[r].filter(v => v !== 0).length > 3) { _towerOk = false; break; } } if (_towerOk) unlockAchievement('leaning_tower'); }
        }
        // sec_speedgames check
        { const _now = Date.now(); _recentGameEndTimes.push({t:_now, lines:linesClearedThisGame}); _recentGameEndTimes = _recentGameEndTimes.filter(e => _now - e.t <= 60000); if (_recentGameEndTimes.filter(e => e.lines >= 1).length >= 5 && !saveData.achievements?.['sec_speedgames']?.unlocked) { unlockAchievement('sec_speedgames'); } }
        _lastGameStats = { score, lines: linesClearedThisGame, blocks: blocksPlacedThisGame, time: gameTime, maxSpeed: speedLevel, xp: finalXP, maxCombo: _maxComboThisGame };
        // Best combo display
        const goComboEl = document.getElementById('go-best-combo');
        if (goComboEl) { goComboEl.style.display = _maxComboThisGame >= 2 ? '' : 'none'; document.getElementById('go-combo-val').innerText = `×${_maxComboThisGame}`; }

        // Check achievements
        saveData.stats.luckySevenCount = (saveData.stats.luckySevenCount || 0) + _sec7CountThisGame;
        const _allHardDropped = _piecesThisGame >= 20 && _piecesThisGame === _piecesHardDroppedThisGame;
        const _equalPieces = Object.keys(_pieceTypeCounts).length === 7 && Object.values(_pieceTypeCounts).every(c => c === Object.values(_pieceTypeCounts)[0]) && blocksPlacedThisGame >= 50;
        const newAch = checkAchievements({ score, lines: linesClearedThisGame, blocks: blocksPlacedThisGame, time: gameTime, maxSpeed: speedLevel, mode: currentGameMode, mirror: !!settings.optMirror, quadraKill: _quadraKillThisGame, boardCleared: _boardClearedThisGame, maxLineStreak: _maxLineStreakThisGame, maxBlocksIn60s: _maxBlocksIn60sThisGame, iPieceLines: _iPieceLinesThisGame, clearedTopLine: _clearedTopLineThisGame, highPlacer: _maxBlocksUnderHalfThisGame, noRotate: !_rotatedThisGame, equalPieces: _equalPieces, luckySevenCount: saveData.stats.luckySevenCount, waitedTetris: _waitedTetrisThisGame, noHardDrop: _hardDropsThisGame === 0, allHardDrop: _allHardDropped, bigFont: _bigFontGameFlag, exactBlocks100: blocksPlacedThisGame === 100, prevHighscore: _prevHighscore, speedrunner: linesClearedThisGame >= 10 ? gameTime : 9999, earlyBird: _earlyBirdThisGame, nice69: _nice69Triggered, boardSymmetric: _boardSymmetricAchieved });
        newAch.forEach(a => { const tIdx = a._newTierNum ? a._newTierNum - 1 : 0; const _mgKey = `${a.id}_${tIdx}`; if (!_midGameAchsShown.has(_mgKey)) _showGameAchievement(a, tIdx); });
        _showGoAchievements(newAch);
        saveDataToFile();

        document.getElementById('go-total-xp').innerText=finalXP+" XP";
        _renderGoBoostRow(finalXP);
        // Ensure normal XP breakdown visible, fun stats hidden
        document.getElementById('go-xp-breakdown').style.display = '';
        const goFunStats2 = document.getElementById('go-fun-stats');
        if (goFunStats2) goFunStats2.style.display = 'none';
        } catch (error) {
            console.error('Game-over bookkeeping failed:', error);
        } finally {
            document.getElementById('go-overlay').classList.remove('hidden');
            _gameOverProtect = true;
            if (document.activeElement) document.activeElement.blur();
            resetHeldInputs();
            setTimeout(() => { _gameOverProtect = false; }, 800);
        }
    }

    function useScoreBooster(key) {
        if (gainedXPThisRound <= 0 || _boosterUsedThisRound) return;
        const BOOST_MULTS = { '2xp_game':2.0, '1.5x_game':1.5, '1.25x_game':1.25 };
        const mult = BOOST_MULTS[key];
        if (!mult || !saveData.boosters || !saveData.boosters[key]) return;
        playSFX('booster');
        saveData.boosters[key]--;
        _boosterUsedThisRound = true;
        saveData.stats.totalBoostersUsed = (saveData.stats.totalBoostersUsed||0) + 1;
        if (key === '2xp_game' && score < 100 && !saveData.achievements?.['sec_booster_waste']?.unlocked) {
            unlockAchievement('sec_booster_waste');
        }
        const originalXP = gainedXPThisRound;
        const bonus = Math.round(originalXP * (mult - 1));
        gainedXPThisRound += bonus;
        _grantXP(bonus);
        document.getElementById('go-total-xp').innerText = gainedXPThisRound + ' XP';
        _renderGoBoostRow(gainedXPThisRound);
        animateXPGain();
        saveDataToFile();
    }
    function _renderGoBoostRow(xp) {
        const row = document.getElementById('go-boost-row');
        if (!row) return;
        if (_boosterUsedThisRound || xp <= 0) { row.style.display = 'none'; return; }
        const boostDefs = [
            { key:'2xp_game',   label:'2× XP' },
            { key:'1.5x_game',  label:'1.5× XP' },
            { key:'1.25x_game', label:'1.25× XP' },
        ];
        const available = boostDefs.filter(b => saveData.boosters && saveData.boosters[b.key] > 0);
        if (available.length === 0) { row.style.display = 'none'; return; }
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.width = 'min(480px, 94vw)';
        row.innerHTML = `<div style="font-size:0.65rem;color:#cc44ff;margin-bottom:6px;font-weight:bold;letter-spacing:1px;">USE BOOSTER:</div>` +
            available.map(b => `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 0;">
                <div style="display:flex;flex-direction:column;gap:1px;">
                    <span style="font-size:0.72rem;color:#cc44ff;white-space:nowrap;">${b.label}</span>
                    <span style="font-size:0.6rem;color:#888;">left: ${saveData.boosters[b.key]}</span>
                </div>
                <button class="btn-secondary" style="border-color:#cc44ff;color:#cc44ff;font-size:0.65rem;padding:4px 14px;flex-shrink:0;" onclick="window.useScoreBooster('${b.key}')">USE</button>
            </div>`).join('');
    }

    function startAnimation() {
        const thisAnim = ++_animId;
        const overlay = document.getElementById('start-animation-overlay');
        const container = document.getElementById('start-text-container');
        overlay.classList.remove('hidden');
        const letters = "LINEBREAKER".split(""); let html = ""; let lastColor = 0;
        for (let l of letters) {
            let c; do { c = Math.floor(Math.random() * 7) + 1; } while (c === lastColor);
            lastColor = c; html += `<span style="color: ${COLORS[c]}">${l}</span>`;
        }
        container.innerHTML = html;
        setTimeout(() => {
            if (thisAnim !== _animId || isGameOver) return;
            overlay.classList.add('hidden');
            document.getElementById('app').classList.add('active-game');
            _refreshGameDPR();
            isPaused=false;
            if(timeInterval)clearInterval(timeInterval);
            timeInterval=setInterval(()=>{if(!isPaused&&!isGameOver&&!document.hidden){gameTime++;updateUI()}},1000);
            lastTime=performance.now(); update(lastTime);
            switchMusicMode('game');
        }, 1600);
    }

    function startGame(){
        if (window._timeBlocked || _gameOverProtect) return;
        // Show rules on first fun/master play
        if (currentGameMode === 'fun' && !saveData.seenFunRules) {
            saveData.seenFunRules = true;
            saveDataToFile();
            customAlert(
                `<b style="color:#ffcc00;">FUN MODE</b><br><br>Grasz w trybie Fun:<br>• Stała prędkość — szybka przez cały czas<br>• Wyższe mnożniki score<br>• Idealne do zabawy<br>• Osobny ranking wyników<br><br><span style="color:#f88;font-size:0.75em;font-weight:bold;">OSIĄGNIĘCIA</span><br><span style="color:#aaa;font-size:0.73em;">Większość osiągnięć jest niedostępna. Można zdobyć:<br>• Score, Czas, Linie per grę, Klocki per grę<br>• Fun Run (score w Fun Mode)<br>• Ukryte osiągnięcia per-growe<br>Nie liczą się: Łączne statystyki, Ilość gier, Prędkość</span>`,
                'ZASADY TRYBU FUN', false, startGame
            );
            return;
        }
        resetHeldInputs();
        document.getElementById('pause-overlay').classList.add('hidden');
        _gameInProgress = true;
        // advanced mode removed
        clearInterval(_playBtnInterval);
        // Reset mode-specific vars
        holdPiece = null; holdUsed = false;
        // Apply Fun mode config
        const _gcFun = document.getElementById('game-container');
        if (currentGameMode === 'fun') {
            COLS = funModeConfig.cols; ROWS = funModeConfig.rows + SPAWN_ROWS;
            BLOCK = Math.max(14, Math.min(Math.floor(300 / COLS), Math.floor(600 / funModeConfig.rows)));
            _sizeGameCanvas(canvas,COLS*BLOCK,funModeConfig.rows*BLOCK);
            if (_gcFun) _gcFun.style.aspectRatio = `${funModeConfig.cols} / ${funModeConfig.rows}`;
        } else {
            ROWS = 22; COLS = 10; BLOCK = 30;
            _sizeGameCanvas(canvas,300,VISIBLE_ROWS*BLOCK);
            if (_gcFun) _gcFun.style.aspectRatio = '1 / 2';
        }
        // Show/hide hold panel
        const holdPanel = document.getElementById('hold-panel');
        if (holdPanel) holdPanel.style.display = settings.optHold ? '' : 'none';
        const mHoldStat = document.getElementById('m-hold-stat');
        if (mHoldStat) mHoldStat.style.display = settings.optHold ? '' : 'none';
        // Update mode badge
        const modeBadge = document.getElementById('mode-badge');
        if (modeBadge) {
            if (currentGameMode === 'fun') { modeBadge.textContent = 'FUN MODE'; modeBadge.style.display = ''; modeBadge.style.color = '#ffcc00'; modeBadge.style.borderColor = '#ffcc00'; }
            else { modeBadge.style.display = 'none'; }
        }
        const is3Next = settings.opt3Next;
        const isNoNext = settings.optNoNext;
        ['pc-next2-canvas','pc-next3-canvas','m-next2-canvas','m-next3-canvas','pc-next2-wrap','m-next2-wrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = (is3Next && !isNoNext) ? '' : 'none'; });
        // Hide entire next piece section when optNoNext is enabled
        ['pc-next-wrap','pc-next2-wrap','pc-next3-wrap','m-next-wrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = isNoNext ? 'none' : ''; });
        // Fade out menu music over 1.2s (duration of start animation)
        if (audioCtx && masterGain && musicPlaying) {
            masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
            masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
            masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.2);
        }
        document.getElementById('menu-overlay').classList.add('hidden');
        const _goEl = document.getElementById('go-overlay');
        _goEl.classList.add('hidden'); _goEl.style.pointerEvents = '';
        board=Array.from({length:ROWS},()=>Array(COLS).fill(0)); drawGame();
        const _achFeed = document.getElementById('game-ach-feed');
        if (_achFeed) _achFeed.innerHTML = '';
        _midGameAchsShown = new Set();
        // Mirror mode visual flip
        const _gc = document.getElementById('game-container');
        if (_gc) _gc.style.transform = settings.optMirror ? 'scaleY(-1)' : '';
        isPaused=true;isGameOver=false; score=0;gameTime=0;particles=[];shockwaves=[];pieceBag=[];_nextQueue=[];floatingTexts=[];lastPieceColor=0;
        currentScoreMultiplier = currentGameMode === 'fun' ? 1.0 : Math.max(0.1, _calcModeXpMult());
        speedLevel=1;linesClearedThisGame=0;blocksPlacedThisGame=0; _surgeonLinesThisGame=0; _highStackBlocksThisGame=0; xpFromBlocksThisGame=0; xpFromLinesThisGame=0; rawGameplayXPThisGame=0; dropInterval=1000;
        _quadraKillThisGame = false;
        _nextPieceType = 0; _currentPieceType = 0;
        _maxLineStreakThisGame = 0; _currentLineStreak = 0;
        _blockTimestampsThisGame = []; _maxBlocksIn60sThisGame = 0;
        _iPieceLinesThisGame = 0; _boardClearedThisGame = false; _boardSymmetricAchieved = false; _clearedTopLineThisGame = false;
        _rotatedThisGame = false; _pieceTypeCounts = {}; _sec7CountThisGame = 0; _sec7Last = []; const _ebH = new Date().getHours(); _earlyBirdThisGame = _ebH >= 5 && _ebH < 7;
        _waitedTetrisThisGame = false; _lastIPieceGameTime = -999;
        _hardDropsThisGame = 0; _pendingHardDrop = false; _piecesThisGame = 0; _piecesHardDroppedThisGame = 0;
        _rotationsThisGame = 0; _doublesThisGame = 0; _triplesThisGame = 0; _tSpinsThisGame = 0;
        _bottomTwoRowsThisGame = 0; _softDropUsedThisGame = false;
        _quadrasThisGame = 0; _comboCount = 0; _maxComboThisGame = 0; _lastMoveWasRotation = false; _prevHighscore = saveData.highscore || 0;
        _bigFontGameFlag = (settings.fontSize === '10' && settings.gameScale === '10');
        _nice69Triggered = false;
        _maxBlocksUnderHalfThisGame = 0; _currentBlocksUnderHalf = 0;
        _pauseCountThisGame = 0; _loyalPieceCounter = 0;
        _noLinePlacementCount = 0; _pieceRotatedThisPlacement = false; _lastClearWasQuad = false;
        _resetMissionGameTracking();
        _surgeonStreakStep = 0; _rotationsThisPiece = 0; _wallBounceCount = 0;
        _wallTouchedLeft = false; _wallTouchedRight = false;
        _sessionGamesPlayed++;
        // skin_loyal tracking
        { const curSkin = settings.skin || 'neon'; if (curSkin === (saveData.stats._lastSkin || curSkin)) { saveData.stats.sameSkinStreak = (saveData.stats.sameSkinStreak || 0) + 1; } else { saveData.stats.sameSkinStreak = 1; } saveData.stats._lastSkin = curSkin; if ((saveData.stats.sameSkinStreak || 0) >= 50 && !saveData.achievements?.['skin_loyal']?.unlocked) unlockAchievement('skin_loyal'); }
        if (currentGameMode === 'fun') { speedLevel = Math.max(1, funModeConfig.startSpeed); dropInterval = 1000 / speedLevel; }
        // Rebuild speed tape for current mode
        ['m-speed-inner','pc-speed-inner'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
        _buildSpeedTapes();
        resetPlayer();updateUI(); startAnimation();
        if (settings.optHold) drawHold();
    }
    function resetGameToMenu(){
        if (_gameOverProtect) return;
        isGameOver = false; isPaused = true;
        musicPlaying = false;
        startMusic('menu');
        const goOverlay = document.getElementById('go-overlay');
        _animateOut(goOverlay, 'anim-out-down', function() {
            document.getElementById('app').classList.remove('active-game');
            const _menuEl = document.getElementById('menu-overlay');
            _menuEl.classList.remove('hidden');
            _animateIn(_menuEl, 'anim-in-left');
            randomizePlayButton();
        });
        if (audioCtx && masterGain) {
            const targetVol = _musicMuted ? 0 : settings.musicVol / 100 * 0.2;
            masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
            masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
            masterGain.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 0.8);
        }
        animateXPGain();
        _checkAchGlow();
        _menuIdleStart = Date.now(); // reset afk timer
    }
    
    const runActive = () => !isGameOver && document.getElementById('app').classList.contains('active-game')
        && document.getElementById('start-animation-overlay').classList.contains('hidden');

    function pauseFromInput(overlay = LBGamepad.topOverlay()) {
        if (!runActive()) return;
        if (isPaused && overlay?.id === 'pause-overlay') resumeGame();
        else if (!isPaused && !overlay && !document.getElementById('pause-overlay').classList.contains('anim-out-down')) togglePause();
    }

    function backFromOverlay(overlay) {
        if (controlsEditor.cancel()) return;
        switch (overlay.id) {
            case 'pause-overlay': pauseFromInput(overlay); return;
            case 'go-overlay': resetGameToMenu(); return;
            case 'custom-alert': closeAlert(); return;
            case 'custom-confirm': document.getElementById('confirm-no').click(); return;
            case 'mq-confirm-overlay': document.getElementById('mq-confirm-cancel').click(); return;
        }
        const close = [...overlay.querySelectorAll('.btn-back, [onclick*="close"], [onclick*="_closeModal"]')]
            .find(LBGamepad.visible);
        if (close) close.click();
        else if (overlay.id.endsWith('-modal') || overlay.id.endsWith('-preview')) window._closeModal(overlay.id);
    }

    function handleKeyDown(event) {
        if (event.defaultPrevented || controlsEditor.capture(event)) return;
        if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.code !== 'Escape' && event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
        const action = LBControls.actionForKey(settings.keyBindings, event.code);
        if (!action && event.code !== 'Escape') return;
        const overlay = LBGamepad.topOverlay();
        const back = event.code === 'Escape' && overlay && overlay.id !== 'menu-overlay';
        const pause = overlay?.id === 'pause-overlay' && action === 'pause';
        const restart = ['pause-overlay', 'go-overlay'].includes(overlay?.id) && action === 'restart';
        if (overlay && !back && !pause && !restart) return;
        if (!overlay && (!runActive() || !action)) return;
        event.preventDefault();
        if (event.repeat) return;
        if (back) backFromOverlay(overlay);
        else if (action) pressGameInput(action, `key:${event.code}`, overlay);
    }

    function handleKeyUp(event) { releaseGameInput(`key:${event.code}`); }
    let _moveDirection = 0, _moveRepeatAt = 0;
    function handleMove(d) {
        if (isPaused || isGameOver) return;
        _moveDirection = d;
        _moveRepeatAt = performance.now() + (settings.das ?? 160);
        if (isAnimating || _hardDropAnimating) { _bufferedMove = d; return; }
        playerMove(d);
    }
    function _updateHeldMove(now) {
        if (!_moveDirection || isPaused || isGameOver || isAnimating || _hardDropAnimating) return;
        if (now < _moveRepeatAt) return;
        const arr = Math.max(0, settings.arr ?? 50);
        const repeats = arr === 0 ? COLS : Math.min(COLS, 1 + Math.floor((now - _moveRepeatAt) / arr));
        for (let i = 0; i < repeats; i++) playerMove(_moveDirection);
        _moveRepeatAt = arr === 0 ? now : _moveRepeatAt + (1 + Math.floor((now - _moveRepeatAt) / arr)) * arr;
    }
    function stopMove(){_moveDirection=0;clearTimeout(dasTimer);clearInterval(arrTimer)}

    function updateInputMove() {
        let direction = 0;
        for (const held of heldMoves.values()) direction = held;
        if (direction && direction !== _moveDirection) handleMove(direction);
        else if (!direction) stopMove();
    }

    function releaseGameInput(source) {
        softDropSources.delete(source);
        if (heldMoves.delete(source)) updateInputMove();
    }

    function resetHeldInputs() {
        heldMoves.clear();
        softDropSources.clear();
        _bufferedMove = 0;
        stopMove();
    }

    const touchActive = () => runActive() && !isPaused && !isAnimating && !_hardDropAnimating;

    function gameAction(action) {
        if (action === 'pause') { pauseFromInput(); return; }
        if (!touchActive()) return;
        if (action === 'left') playerMove(-1);
        else if (action === 'right') playerMove(1);
        else if (action === 'cw') playerRotate(1);
        else if (action === 'ccw') playerRotate(-1);
        else if (action === 'soft') { _softDropUsedThisGame = true; playerDrop(); }
        else if (action === 'hard') playerHardDrop();
        else if (action === 'hold') doHold();
    }

    function pressGameInput(action, source, overlay) {
        if (action === 'pause') { pauseFromInput(overlay); return; }
        if (action === 'restart') {
            if (!isAnimating && !_hardDropAnimating && (runActive() || overlay?.id === 'go-overlay')) startGame();
            return;
        }
        if (!runActive() || isPaused) return;
        if (action === 'soft') softDropSources.add(source);
        else if (action === 'left' || action === 'right') {
            heldMoves.set(source, action === 'left' ? -1 : 1);
            updateInputMove();
        } else gameAction(action);
    }

    window.LBInput = {
        active: touchActive,
        unlockAudio() { initAudio(); if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {}); },
        action: gameAction,
        press(action) { if (touchActive()) pressGameInput(action, 'touch'); },
        release() { releaseGameInput('touch'); }
    };

    // Android shell only: keep native navigation isolated from desktop input.
    if (window.Capacitor?.isNativePlatform()) {
        const nativeApp = window.Capacitor.Plugins.App;
        nativeApp.addListener('backButton', async () => {
            const visible = el => el && !el.classList.contains('hidden')
                && getComputedStyle(el).display !== 'none';
            const overlays = [...document.querySelectorAll(
                '[id$="-overlay"], [id$="-modal"], #custom-confirm, #custom-alert, #sfx-inv-preview'
            )].filter(el => visible(el) && !['menu-overlay', 'start-animation-overlay'].includes(el.id));
            overlays.sort((a, b) => (parseInt(getComputedStyle(b).zIndex) || 0)
                - (parseInt(getComputedStyle(a).zIndex) || 0));
            const top = overlays[0];
            if (top?.id === 'custom-confirm') {
                document.getElementById('confirm-no').click();
            } else if (top?.id === 'custom-alert') {
                closeAlert();
            } else if (top) {
                const close = top.querySelector('.btn-back, [onclick*="close"], [onclick*="_closeModal"]');
                if (close) close.click();
                else if (top.id.endsWith('-modal') || top.id.endsWith('-preview')) {
                    window._closeModal(top.id);
                } else if (!['pause-overlay', 'go-overlay'].includes(top.id)) {
                    top.classList.add('hidden');
                } else if (top.id === 'pause-overlay') pauseFromInput(top);
            } else if (document.getElementById('app').classList.contains('active-game')) {
                if (!isPaused && !isGameOver) togglePause();
            } else if (await customConfirm('Exit Linebreaker?', 'EXIT')) {
                await nativeApp.exitApp();
            }
        }).catch(error => console.error('Android back button setup failed', error));
        nativeApp.addListener('appStateChange', ({ isActive }) => {
            if (!isActive && !isPaused && !isGameOver
                && document.getElementById('app').classList.contains('active-game')) togglePause();
        }).catch(error => console.error('Android lifecycle setup failed', error));
    }

    document.addEventListener('keydown',handleKeyDown); document.addEventListener('keyup',handleKeyUp);
    window.addEventListener('blur', resetHeldInputs);
    
    document.addEventListener('visibilitychange', () => {
        if(document.hidden && document.getElementById('app').classList.contains('active-game') && !isGameOver && !isPaused && !isAnimating && document.getElementById('start-animation-overlay').classList.contains('hidden')) togglePause();
    });


    document.addEventListener('click', (e) => {
        if (e.target.closest('button, .ctrl-btn') && audioCtx) {
            playSFX('click');
        }
    });

    function _trackListenThresholdMs() {
        // 80% of track duration (min 10s), fallback 30s if duration unknown
        const dur = _currentTrackDuration30s;
        return dur > 0 ? Math.max(dur * 0.8, 10) * 1000 : 30000;
    }
    function updateNowPlaying(name, artist) {
        // music_listener: track when a new track starts playing
        if (name && name !== _currentTrackName30s) {
            // Check if previous track was listened to enough
            if (_currentTrackName30s && _musicTrackStartTime30s) {
                const elapsed = Date.now() - _musicTrackStartTime30s;
                if (elapsed >= _trackListenThresholdMs()) {
                    saveData.stats.musicTracksListened = (saveData.stats.musicTracksListened || 0) + 1;
                    checkProgressAchievements();
                    // song play count tracking
                    if (!saveData.stats.songPlayCounts) saveData.stats.songPlayCounts = {};
                    saveData.stats.songPlayCounts[_currentTrackName30s] = (saveData.stats.songPlayCounts[_currentTrackName30s] || 0) + 1;
                    const _maxPlays = Math.max(...Object.values(saveData.stats.songPlayCounts));
                    if (_maxPlays > (saveData.stats.mostPlayedSongCount || 0)) saveData.stats.mostPlayedSongCount = _maxPlays;
                    if (_maxPlays >= 5 && !saveData.achievements?.['fav_track']?.unlocked) { unlockAchievement('fav_track'); }
                    saveDataToFile();
                }
            }
            _currentTrackName30s = name;
            _musicTrackStartTime30s = Date.now();
            _currentTrackDuration30s = _trackDuration || 0;
        } else if (!name) {
            // Music stopped - check if last track counted
            if (_currentTrackName30s && _musicTrackStartTime30s) {
                const elapsed = Date.now() - _musicTrackStartTime30s;
                if (elapsed >= _trackListenThresholdMs()) {
                    saveData.stats.musicTracksListened = (saveData.stats.musicTracksListened || 0) + 1;
                    if (!saveData.stats.songPlayCounts) saveData.stats.songPlayCounts = {};
                    saveData.stats.songPlayCounts[_currentTrackName30s] = (saveData.stats.songPlayCounts[_currentTrackName30s] || 0) + 1;
                    const _maxPlays = Math.max(...Object.values(saveData.stats.songPlayCounts));
                    if (_maxPlays > (saveData.stats.mostPlayedSongCount || 0)) saveData.stats.mostPlayedSongCount = _maxPlays;
                    if (_maxPlays >= 5 && !saveData.achievements?.['fav_track']?.unlocked) { unlockAchievement('fav_track'); }
                    saveDataToFile();
                }
            }
            _currentTrackName30s = '';
            _musicTrackStartTime30s = null;
            _currentTrackDuration30s = 0;
        }
        _nowPlayingName = name || '';
        _nowPlayingArtist = (artist !== undefined ? artist : _nowPlayingArtist) || '';
        _updateMusicWidget();
    }
    function _fmtTime(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); }
    function _updateMusicWidget() {
        const titleEl = document.getElementById('mw-title');
        if (!titleEl) return;
        const titleText = _nowPlayingName || '—';
        titleEl.innerHTML = `<span class="mw-title-inner">${titleText}</span>`;
        const inner = titleEl.querySelector('.mw-title-inner');
        requestAnimationFrame(() => {
            if (inner && inner.scrollWidth > titleEl.clientWidth) {
                titleEl.style.setProperty('--mw-scroll', -(inner.scrollWidth - titleEl.clientWidth) + 'px');
                titleEl.classList.add('mw-scrolling');
            } else {
                titleEl.classList.remove('mw-scrolling');
            }
        });
        const artistEl = document.getElementById('mw-artist');
        if (artistEl) artistEl.textContent = _nowPlayingArtist ? 'by ' + _nowPlayingArtist : '';
        const elapsed = _musicPaused
            ? _trackPauseOffset
            : (audioCtx ? Math.min(audioCtx.currentTime - _trackStartTime + _trackPauseOffset, _trackDuration || 0) : 0);
        const dur = _trackDuration || 0;
        const elEl = document.getElementById('mw-elapsed');
        const totEl = document.getElementById('mw-total');
        const fillEl = document.getElementById('mw-progress-fill');
        if (elEl) elEl.textContent = _fmtTime(elapsed);
        if (totEl) totEl.textContent = dur > 0 ? _fmtTime(dur) : '0:00';
        if (fillEl) fillEl.style.width = (dur > 0 ? Math.min(100, elapsed / dur * 100) : 0) + '%';
        // Sync playlist mini widget
        const plTitle = document.getElementById('pl-mw-title');
        const plEl = document.getElementById('pl-mw-elapsed');
        const plTot = document.getElementById('pl-mw-total');
        const plFill = document.getElementById('pl-mw-progress-fill');
        if (plTitle) plTitle.textContent = _nowPlayingName || '—';
        if (plEl) plEl.textContent = _fmtTime(elapsed);
        if (plTot) plTot.textContent = dur > 0 ? _fmtTime(dur) : '0:00';
        if (plFill) plFill.style.width = (dur > 0 ? Math.min(100, elapsed / dur * 100) : 0) + '%';
        const isPix = settings.stylePack === 'pixel';
        const pauseBtn = document.getElementById('mw-pause');
        if (pauseBtn) {
            pauseBtn.innerHTML = _musicPaused
                ? (isPix ? _SVG_PIX_PLAY : `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><polygon points="3,2 13,8 3,14"/></svg>`)
                : (isPix ? _SVG_PIX_PAUSE : `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="3" y="2" width="3" height="12"/><rect x="10" y="2" width="3" height="12"/></svg>`);
        }
        const muteBtn = document.getElementById('mw-mute');
        if (muteBtn) {
            muteBtn.innerHTML = settings.musicVol === 0
                ? (isPix ? _SVG_PIX_MUTED : _SVG_MUTED)
                : (isPix ? _SVG_PIX_VOL : _SVG_VOL);
        }
        // Sync playlist mini widget pause/mute buttons
        const plPause = document.getElementById('pl-mw-pause');
        if (plPause) plPause.innerHTML = _musicPaused
            ? `<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><polygon points="3,2 13,8 3,14"/></svg>`
            : `<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><rect x="3" y="2" width="3" height="12"/><rect x="10" y="2" width="3" height="12"/></svg>`;
        const plMute = document.getElementById('pl-mw-mute');
        if (plMute) plMute.innerHTML = settings.musicVol === 0 ? _SVG_MUTED.replace('width="14"','width="11"').replace('height="14"','height="11"') : _SVG_VOL.replace('width="14"','width="11"').replace('height="14"','height="11"');
        // Sync mute button visuals on both widgets
        const _isMutedNow = settings.musicVol === 0 || _musicMuted;
        const isPix3 = settings.stylePack === 'pixel';
        const _muteIco = _isMutedNow ? (isPix3 ? _SVG_PIX_MUTED : _SVG_MUTED) : (isPix3 ? _SVG_PIX_VOL : _SVG_VOL);
        const mwMuteBtn = document.getElementById('mw-mute');
        if (mwMuteBtn) mwMuteBtn.innerHTML = _muteIco;
        if (plMute) plMute.innerHTML = (_isMutedNow ? _SVG_MUTED : _SVG_VOL).replace('width="14"','width="11"').replace('height="14"','height="11"');
    }
    window.musicWidgetPrev = function() {
        if (_currentMode !== 'menu' || !musicPlaying) return;
        _menuShuffleQueue = [];
        _playMenuFileTrack(_currentMenuTrackIdx - 1);
    };
    window.musicWidgetNext = function() {
        if (_currentMode !== 'menu' || !musicPlaying) return;
        _menuShuffleQueue = [];
        _playMenuFileTrack(_currentMenuTrackIdx + 1);
    };
    window.musicWidgetPause = function() {
        if (!audioCtx || !musicPlaying || !_nowPlayingName || _currentMode !== 'menu') return;
        if (!_musicPaused) {
            _trackPauseOffset = Math.min(audioCtx.currentTime - _trackStartTime + _trackPauseOffset, Math.max(0, _trackDuration - 0.1));
            _menuSourceNode?.stop();
            _menuSourceNode = null;
            _musicPaused = true;
            _updateMusicWidget();
        } else {
            _playMenuTrack(_nowPlayingName, _trackPauseOffset);
        }
    };
    window.musicWidgetSeek = function(e, el) {
        if (!audioCtx || !_trackDuration || _currentMode !== 'menu') return;
        const rect = el.getBoundingClientRect();
        if (!rect.width) return;
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        _playMenuTrack(_nowPlayingName, frac * _trackDuration);
    };
    function skipSong() { /* song skipping disabled */ }

    function _showLevelUpRewardPopup(level, rewards) {
        const li = getLevelInfo(saveData.totalXP);
        const rankName = li.isCelestite ? 'CELESTITE' : li.rank;
        const _liLvlInRank = li.lvlInRank ?? ((li.level - 1) % 10);
        const levelStr = li.isCelestite ? (' ' + _toRoman(li.level)) : (_liLvlInRank === 0 ? '' : (' ' + _toRoman(_liLvlInRank)));
        document.getElementById('level-up-popup-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.className = 'lb-reward-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Earned rewards');
        overlay.id = 'level-up-popup-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1300;display:flex;align-items:center;justify-content:center;font-family:inherit;';
        const rewardsHtml = rewards.map(r => {
            const col = RARITY_COLORS[r.rarity] || '#ccc';
            return `<div style="border:1px solid ${col};border-radius:10px;padding:8px 12px;margin-bottom:7px;box-shadow:0 0 10px ${col}30;display:flex;align-items:center;gap:8px;">
                <span style="font-size:1.4rem;">${r.icon}</span>
                <div><div style="font-size:0.85rem;font-weight:bold;color:${col};">${r.label}</div><div style="font-size:0.62rem;color:#aaa;">${r.desc}</div><div class="lb-reward-rarity">${r.rarity}</div></div>
            </div>`;
        }).join('');
        overlay.innerHTML = `<div style="background:rgba(6,6,20,0.98);border:1px solid var(--primary);border-radius:16px;padding:24px 22px;max-width:340px;width:90%;text-align:center;box-shadow:0 0 40px var(--primary)30;">
            <div style="font-size:0.55rem;letter-spacing:3px;color:var(--primary);margin-bottom:6px;">LEVEL UP!</div>
            <div class="lb-rank-identity" style="font-size:1.1rem;font-weight:bold;color:#fff;margin-bottom:16px;">${rankName}${levelStr}</div>
            <div style="text-align:left;max-height:280px;overflow-y:auto;">${rewardsHtml}</div>
            <button onclick="document.getElementById('level-up-popup-overlay').remove()" style="margin-top:16px;padding:10px 24px;background:linear-gradient(45deg,var(--primary)33,var(--primary)18);border:1px solid var(--primary);border-radius:10px;color:var(--primary);cursor:pointer;font-family:inherit;font-weight:bold;font-size:0.8rem;box-shadow:0 0 10px var(--primary)30;">AWESOME!</button>
        </div>`;
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }



    function _getPlaylist(ctx) {
        const saved = saveData[ctx + 'Playlist'];
        if (Array.isArray(saved)) {
            const playable = [...new Set(saved.filter(name => _trackPool.has(name)))];
            if (playable.length || (ctx === 'action' && !saved.length)) return playable;
        }
        return ctx === 'menu' ? _menuFileNames : ctx === 'game' ? _gameFileNames : _actionFileNames;
    }
    function _renderMusicTrackContent() {
        const el = document.getElementById('mt-content');
        if (!el) return;
        if (_trackPool.size === 0) {
            el.innerHTML = `<div style="font-size:0.6rem;color:#555;padding:12px 2px;font-style:italic;">Loading tracks…</div>`;
            return;
        }
        const esc = s => s.replace(/'/g, "\\'");
        const svgCheck = `<svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 5 4 8 8.5 2"/></svg>`;
        const menuPlaylist = _getPlaylist('menu');
        const gamePlaylist = _getPlaylist('game');
        const actionPlaylist = _getPlaylist('action');
        const allNames = [..._trackPool.keys()];
        const rows = allNames.map(name => {
            const entry = _trackPool.get(name);
            const artist = entry.artist || '';
            const isPlaying = name === _nowPlayingName;
            const isAction = _actionFileNames.includes(name);
            const menuOn = menuPlaylist.includes(name);
            const gameOn = isAction ? actionPlaylist.includes(name) : gamePlaylist.includes(name);
            const gameCtx = isAction ? 'action' : 'game';
            const artistSpan = artist ? `<span style="display:block;font-size:0.72em;color:#666;margin-top:1px;">by ${artist}</span>` : '';
            const playMark = isPlaying ? `<span style="color:var(--primary);margin-right:2px;">▶</span>` : '';
            const col = isPlaying ? 'var(--primary)' : '#ccc';
            const mOn = menuOn; const gOn = gameOn;
            const mBtnS = `font-size:0.58rem;padding:3px 8px;border-radius:5px;border:1px solid ${mOn?'#4488ff':'#333'};background:${mOn?'rgba(68,136,255,0.15)':'rgba(255,255,255,0.03)'};color:${mOn?'#7aadff':'#555'};cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:3px;white-space:nowrap;min-width:52px;justify-content:center;`;
            const gBtnS = `font-size:0.58rem;padding:3px 8px;border-radius:5px;border:1px solid ${gOn?'#44aa55':'#333'};background:${gOn?'rgba(68,170,85,0.15)':'rgba(255,255,255,0.03)'};color:${gOn?'#7acc88':'#555'};cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:3px;white-space:nowrap;min-width:52px;justify-content:center;`;
            return `<div style="display:flex;align-items:center;gap:6px;padding:5px 2px;">
                <span style="flex:1;font-size:0.62rem;color:${col};line-height:1.3;">${playMark}${name}${artistSpan}</span>
                <button type="button" style="${mBtnS}" onclick="window.moveTrack('menu','${esc(name)}',${!mOn})">${mOn?svgCheck:''}Menu</button>
                <button type="button" style="${gBtnS}" onclick="window.moveTrack('${gameCtx}','${esc(name)}',${!gOn})">${gOn?svgCheck:''}Game</button>
            </div>`;
        }).join('');
        el.innerHTML = rows || `<div style="font-size:0.58rem;color:#555;padding:6px 2px;font-style:italic;">No tracks found</div>`;
    }
    window.switchMusicTab = function() {}; // no-op: tabs removed
    window.moveTrack = function(ctx, name, toOn) {
        const key = ctx + 'Playlist';
        saveData[key] = _getPlaylist(ctx).slice();
        if (toOn) {
            if (!saveData[key].includes(name)) saveData[key].push(name);
        } else {
            saveData[key] = saveData[key].filter(n => n !== name);
            if (!saveData[key].length && ctx !== 'action') {
                const def = ctx === 'menu' ? _menuFileNames : _gameFileNames;
                saveData[key] = def.slice();
            }
            if (ctx === 'menu' && _nowPlayingName === name && _currentMode === 'menu') {
                _playMenuFileTrack(_currentMenuTrackIdx);
            }
        }
        saveDataToFile();
        _renderMusicTrackContent();
        _renderPlaylistPanel();
    };
    // ===== MISSIONS SYSTEM =====
    const DAILY_QUEST_POOL = [
        // EASY (pts: 2)
        { id: 'blocks_175',     tier: 'easy',   title: 'Block Layer',       desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 175,  pts: 2 },
        { id: 'blocks_200',     tier: 'easy',   title: 'Block Flood',       desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 200,  pts: 2 },
        { id: 'lines_15',       tier: 'easy',   title: 'Line Breaker',      desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 15,   pts: 2 },
        { id: 'lines_20e',      tier: 'easy',   title: 'Line Grinder',      desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 20,   pts: 2 },
        { id: 'score_250',      tier: 'easy',   title: 'First Points',      desc: 'Score {n} points in one game',                     metric: 'score',          target: 250,  pts: 2 },
        { id: 'score_300',      tier: 'easy',   title: 'Score Rookie',      desc: 'Score {n} points in one game',                     metric: 'score',          target: 300,  pts: 2 },
        { id: 'survive_90',     tier: 'easy',   title: 'Time Keeper',       desc: 'Survive for {n} in one game',                      metric: 'gameTime',       target: 90,   pts: 2 },
        { id: 'survive_120',    tier: 'easy',   title: 'Two Minutes',       desc: 'Survive for {n} in one game',                      metric: 'gameTime',       target: 120,  pts: 2 },
        { id: 'reach_speed2',   tier: 'easy',   title: 'Pick Up the Pace',  desc: 'Reach speed level {n}',                            metric: 'maxSpeed',       target: 2,    pts: 2 },
        { id: 'hard_drops_5',   tier: 'easy',   title: 'Drop It',           desc: 'Hard-drop {n} times in one game',                  metric: 'hardDrops',      target: 5,    pts: 2 },
        { id: 'bottom2_30',     tier: 'easy',   title: 'Floor Lover',       desc: 'Place {n} blocks in the bottom 2 rows',      metric: 'bottomTwoRows',  target: 30,   pts: 2, cumulative: true },
        { id: 'games_7',        tier: 'easy',   title: 'Show Up',           desc: 'Complete {n} games',                         metric: 'gamesPlayed',    target: 7,    pts: 2, cumulative: true },
        { id: 'rotations_300',  tier: 'easy',   title: 'Spin Cycle',        desc: 'Rotate pieces {n} times',                    metric: 'rotations',      target: 300,  pts: 2, cumulative: true },
        { id: 'doubles_3',      tier: 'easy',   title: 'Double Trouble',    desc: 'Clear {n} doubles',         metric: 'doubles',        target: 3,    pts: 2, cumulative: true },
        { id: 'triples_2',      tier: 'easy',   title: 'Triple Threat',     desc: 'Clear {n} triples',         metric: 'triples',        target: 2,    pts: 2, cumulative: true },
        // NORMAL (pts: 3)
        { id: 'blocks_300',     tier: 'normal', title: 'Block Builder',     desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 300,  pts: 3 },
        { id: 'blocks_350',     tier: 'normal', title: 'Production Run',    desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 350,  pts: 3 },
        { id: 'lines_25',       tier: 'normal', title: 'Half Dozen',        desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 25,   pts: 3 },
        { id: 'lines_30',       tier: 'normal', title: 'Line Destroyer',    desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 30,   pts: 3 },
        { id: 'score_500',      tier: 'normal', title: 'Score Hunter',      desc: 'Score {n} points in one game',                     metric: 'score',          target: 500,  pts: 3 },
        { id: 'score_600',      tier: 'normal', title: 'Score Seeker',      desc: 'Score {n} points in one game',                     metric: 'score',          target: 600,  pts: 3 },
        { id: 'hard_drops_200', tier: 'normal', title: 'Free Fall',         desc: 'Hard-drop {n} times',                        metric: 'hardDrops',      target: 200,  pts: 3, cumulative: true },
        { id: 'survive_180',    tier: 'normal', title: 'Endurance',         desc: 'Survive for {n} in one game',                      metric: 'gameTime',       target: 180,  pts: 3 },
        { id: 'reach_speed3',   tier: 'normal', title: 'Ramping Up',        desc: 'Reach speed level {n}',                            metric: 'maxSpeed',       target: 3,    pts: 3 },
        { id: 'quad_1',         tier: 'easy',   title: 'Quad Attempt',      desc: 'Clear 4 lines at once in one game',                metric: 'quads',          target: 1,    pts: 2 },
        { id: 'combo_5',        tier: 'normal', title: 'Chain Reaction',    desc: 'Get a {n}-combo in one game',                      metric: 'maxCombo',       target: 5,    pts: 3 },
        { id: 'bottom2_50',     tier: 'normal', title: 'Ground Level',      desc: 'Place {n} blocks in the bottom 2 rows',      metric: 'bottomTwoRows',  target: 50,   pts: 3, cumulative: true },
        { id: 'games_10',       tier: 'normal', title: 'Grinder',           desc: 'Complete {n} games',                         metric: 'gamesPlayed',    target: 10,   pts: 3, cumulative: true },
        { id: 'doubles_5',      tier: 'normal', title: 'Double Trouble',    desc: 'Clear {n} doubles',         metric: 'doubles',        target: 5,    pts: 3, cumulative: true },
        { id: 'triples_4',      tier: 'normal', title: 'Triple Threat',     desc: 'Clear {n} triples',         metric: 'triples',        target: 4,    pts: 3, cumulative: true },
        { id: 'rotations_450',  tier: 'normal', title: 'Spin Cycle',        desc: 'Rotate pieces {n} times',                    metric: 'rotations',      target: 450,  pts: 3, cumulative: true },
        { id: 't_spin_1',       tier: 'normal', title: 'T-Spinner',         desc: 'Perform {n} T-spin clear in one game',             metric: 'tSpins',         target: 1,    pts: 3 },
        // HARD (pts: 5)
        { id: 'blocks_450',     tier: 'hard',   title: 'Stack Veteran',     desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 450,  pts: 5 },
        { id: 'blocks_500',     tier: 'hard',   title: 'Block Storm',       desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 500,  pts: 5 },
        { id: 'lines_35',       tier: 'hard',   title: 'Marathon',          desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 35,   pts: 5 },
        { id: 'lines_40',       tier: 'hard',   title: 'Line Executioner',  desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 40,   pts: 5 },
        { id: 'score_900',      tier: 'hard',   title: 'High Scorer',       desc: 'Score {n} points in one game',                     metric: 'score',          target: 900,  pts: 5 },
        { id: 'score_1000',     tier: 'hard',   title: 'Elite Score',       desc: 'Score {n} points in one game',                     metric: 'score',          target: 1000, pts: 5 },
        { id: 'hard_drops_350', tier: 'hard',   title: 'Gravity Master',    desc: 'Hard-drop {n} times',                        metric: 'hardDrops',      target: 350,  pts: 5, cumulative: true },
        { id: 'survive_300',    tier: 'hard',   title: 'Endurance Run',     desc: 'Survive for {n} in one game',                      metric: 'gameTime',       target: 300,  pts: 5 },
        { id: 'reach_speed4',   tier: 'hard',   title: 'Ludicrous Speed',   desc: 'Reach speed level {n}',                            metric: 'maxSpeed',       target: 4,    pts: 5 },
        { id: 'quad_2',         tier: 'normal', title: 'Double Quad',       desc: 'Get {n} quad clears in one game', metric: 'quads',          target: 2,    pts: 3 },
        { id: 'quad_3',         tier: 'hard',   title: 'Triple Quad',       desc: 'Get {n} quad clears in one game', metric: 'quads',          target: 3,    pts: 5 },
        { id: 'combo_6',        tier: 'hard',   title: 'Combo God',         desc: 'Get a {n}-combo in one game',                      metric: 'maxCombo',       target: 6,    pts: 5 },
        { id: 'bottom2_80',     tier: 'hard',   title: 'Ground Pounder',    desc: 'Place {n} blocks in the bottom 2 rows',      metric: 'bottomTwoRows',  target: 80,   pts: 5, cumulative: true },
        { id: 'games_15',       tier: 'hard',   title: 'No Life',           desc: 'Complete {n} games',                         metric: 'gamesPlayed',    target: 15,   pts: 5, cumulative: true },
        { id: 'doubles_8',      tier: 'hard',   title: 'Double Mania',      desc: 'Clear {n} doubles',         metric: 'doubles',        target: 8,    pts: 5, cumulative: true },
        { id: 'triples_6',      tier: 'hard',   title: 'Triple Threat',     desc: 'Clear {n} triples',         metric: 'triples',        target: 6,    pts: 5, cumulative: true },
        { id: 'rotations_700',  tier: 'hard',   title: 'Spin Master',       desc: 'Rotate pieces {n} times',                    metric: 'rotations',      target: 700,  pts: 5, cumulative: true },
        { id: 't_spin_2',       tier: 'hard',   title: 'T-Spin Expert',     desc: 'Perform {n} T-spins in one game',                  metric: 'tSpins',         target: 2,    pts: 5 },
        // SECRET pool (pts: 5) — title/desc hidden until completed; displayTier assigned on generation
        { id: 'hat_trick',        tier: 'secret', title: 'Hat Trick',         desc: 'Clear lines on 3 consecutive placements',                    metric: 'hatTrick',       target: 1,  pts: 5 },
        { id: 'narrow_escape',    tier: 'secret', title: 'Narrow Escape',     desc: 'Survive 20 seconds with blocks in the top 4 rows',           metric: 'narrowEscape',   target: 1,  pts: 5 },
        { id: 'i_floor',          tier: 'secret', title: 'Floor Liner',       desc: 'Land an I-piece flat on the bottom row',                     metric: 'iFloor',         target: 1,  pts: 5 },
        { id: 'bottom_builder',   tier: 'secret', title: 'Deep Diver',        desc: 'Place 15 blocks in the bottom quarter of the board',         metric: 'bottomQuarter',  target: 15, pts: 5 },
        { id: 'speed_run',        tier: 'secret', title: 'Speed Runner',      desc: 'Reach speed level 5 in under 3 minutes',                     metric: 'speedRun',       target: 1,  pts: 5 },
        { id: 'perfect_clear',    tier: 'secret', title: 'Perfect Clear',     desc: 'Clear the entire board in one game',                         metric: 'perfectClear',   target: 1,  pts: 5 },
        { id: 'no_soft',          tier: 'secret', title: 'Hard Only',         desc: 'Finish a game without using soft-drop',                      metric: 'noSoftDrop',     target: 1,  pts: 5 },
        { id: 'comeback_kid',     tier: 'secret', title: 'Comeback Kid',      desc: 'Have blocks reach the top 2 rows, then survive 60 more seconds', metric: 'comebackKid', target: 1, pts: 5 },
        { id: 'monochrome',       tier: 'secret', title: 'Monochrome',        desc: 'Place 20 blocks of the same piece type in one game',         metric: 'monochrome',     target: 1,  pts: 5 },
        { id: 'speed_queen',      tier: 'secret', title: 'Speed Queen',       desc: 'Reach speed level 4 within the first 2 minutes',             metric: 'speedQueen',     target: 1,  pts: 5 },
        { id: 'minimalist',       tier: 'secret', title: 'Minimalist',        desc: 'Clear 8 lines using only singles — no doubles or better',     metric: 'minimalist',     target: 1,  pts: 5 },
        { id: 'quad_streak',      tier: 'secret', title: 'Quad Streak',       desc: 'Get 2 quad clears in a row',               metric: 'quadStreak',     target: 1,  pts: 5 },
        { id: 'flat_earth',       tier: 'secret', title: 'Flat Earther',      desc: 'Keep your max stack height under 5 for 60 seconds',          metric: 'flatEarth',      target: 1,  pts: 5 },
        { id: 'nice_bonus',       tier: 'secret', title: 'Nice Bonus',        desc: 'Complete all other daily quests in one run',                  metric: 'niceBonus',      target: 1,  pts: 5 },
        { id: 'double_completion',tier: 'secret', title: 'Double Completion', desc: 'Complete any 2 missions (daily or weekly) in one run',        metric: 'doubleCompletion', target: 1, pts: 5 },
    ];
    // Weekly missions — 3E+2N+1H drawn per week
    const WEEKLY_MISSION_POOL = [
        // EASY (pts: 10)
        { id: 'w_lines_100',    tier: 'easy',   title: 'Line Week',         desc: 'Clear {n} lines total',                  metric: 'linesCleared',      target: 100,  pts: 10, cumulative: true  },
        { id: 'w_blocks_800',   tier: 'easy',   title: 'Block Flood',       desc: 'Place {n} blocks total',                 metric: 'blocksPlaced',      target: 800,  pts: 10, cumulative: true  },
        { id: 'w_games_35',     tier: 'easy',   title: 'Warm-Up',           desc: 'Complete {n} games',                     metric: 'gamesPlayed',       target: 35,   pts: 10, cumulative: true  },
        { id: 'w_quads_5',      tier: 'easy',   title: 'Four-Line Habit',   desc: 'Get {n} quad clears',  metric: 'quads',             target: 5,    pts: 10, cumulative: true  },
        { id: 'w_survive_1200', tier: 'easy',   title: 'Short Session',     desc: 'Play for {n} total',                     metric: 'gameTime',          target: 1200, pts: 10, cumulative: true  },
        { id: 'w_speed2_5',     tier: 'easy',   title: 'Getting Faster',    desc: 'Reach speed 2 in {n} separate games',    metric: 'gamesReachedSpeed2',target: 5,    pts: 10, cumulative: true  },
        { id: 'w_score_1500',   tier: 'easy',   title: 'Score Sprint',      desc: 'Score {n} points total',                 metric: 'score',             target: 1500, pts: 10, cumulative: true  },
        // NORMAL (pts: 15)
        { id: 'w_lines_150',    tier: 'normal', title: 'Line Machine',      desc: 'Clear {n} lines total',                  metric: 'linesCleared',      target: 150,  pts: 15, cumulative: true  },
        { id: 'w_blocks_1400',  tier: 'normal', title: 'Block Mountain',    desc: 'Place {n} blocks total',                 metric: 'blocksPlaced',      target: 1400, pts: 15, cumulative: true  },
        { id: 'w_score_3000',   tier: 'normal', title: 'Weekly Scorer',     desc: 'Score {n} points total',                 metric: 'score',             target: 3000, pts: 15, cumulative: true  },
        { id: 'w_games_50',     tier: 'normal', title: 'Grinder',           desc: 'Complete {n} games',                     metric: 'gamesPlayed',       target: 50,   pts: 15, cumulative: true  },
        { id: 'w_quads_10',     tier: 'normal', title: 'Quad Collector',    desc: 'Get {n} quad clears',  metric: 'quads',             target: 10,   pts: 15, cumulative: true  },
        { id: 'w_tspin_3',      tier: 'normal', title: 'Spin Doctor',       desc: 'Perform {n} T-spins',                    metric: 'tSpins',            target: 3,    pts: 15, cumulative: true  },
        { id: 'w_combo4_4',     tier: 'normal', title: 'Weekly Combo',      desc: 'Get a 4+ combo in {n} separate games',   metric: 'gamesWithCombo4',   target: 4,    pts: 15, cumulative: true  },
        { id: 'w_speed3_5',     tier: 'normal', title: 'Weekly Speed',      desc: 'Reach speed 3 in {n} separate games',    metric: 'gamesReachedSpeed3',target: 5,    pts: 15, cumulative: true  },
        // HARD (pts: 25)
        { id: 'w_lines_250',    tier: 'hard',   title: 'Line God',          desc: 'Clear {n} lines total',                  metric: 'linesCleared',      target: 250,  pts: 25, cumulative: true  },
        { id: 'w_blocks_2000',  tier: 'hard',   title: 'Unstoppable Force', desc: 'Place {n} blocks total',                 metric: 'blocksPlaced',      target: 2000, pts: 25, cumulative: true  },
        { id: 'w_score_4500',   tier: 'hard',   title: 'Score Legend',      desc: 'Score {n} points total',                 metric: 'score',             target: 4500, pts: 25, cumulative: true  },
        { id: 'w_games_75',     tier: 'hard',   title: 'No Life',           desc: 'Complete {n} games',                     metric: 'gamesPlayed',       target: 75,   pts: 25, cumulative: true  },
        { id: 'w_quads_15',     tier: 'hard',   title: 'Quad Legend',       desc: 'Get {n} quad clears',  metric: 'quads',             target: 15,   pts: 25, cumulative: true  },
        { id: 'w_tspin_5',      tier: 'hard',   title: 'T-Spin Streak',     desc: 'Perform {n} T-spins',                    metric: 'tSpins',            target: 5,    pts: 25, cumulative: true  },
        { id: 'w_survive_2400', tier: 'hard',   title: 'Weekly Warrior',    desc: 'Play for {n} total',                     metric: 'gameTime',          target: 2400, pts: 25, cumulative: true  },
        { id: 'w_speed4_5',     tier: 'hard',   title: 'Speed Week',        desc: 'Reach speed 4 in {n} separate games',    metric: 'gamesReachedSpeed4',target: 5,    pts: 25, cumulative: true  },
        { id: 'w_combo4_5',     tier: 'hard',   title: 'Weekly Combo',      desc: 'Get a 4+ combo in {n} separate games',   metric: 'gamesWithCombo4',   target: 5,    pts: 25, cumulative: true  },
    ];
    const MISSION_TIER_COLORS = { easy: '#44ff88', normal: '#4499ff', hard: '#ff3355' };
    const MQ_DAILY_MILESTONES = [
        { pts: 6,  reward: { type: 'parts', amount: 1 }, label: '+1 Part'  },
        { pts: 9,  reward: { type: 'parts', amount: 2 }, label: '+2 Parts' },
        { pts: 12, reward: { type: 'parts', amount: 3 }, label: '+3 Parts' },
    ];
    const MQ_WEEKLY_MILESTONES = [
        { pts: 60,  reward: { type: 'parts', amount: 2  }, label: '+2 Parts'  },
        { pts: 90,  reward: { type: 'parts', amount: 4  }, label: '+4 Parts'  },
        { pts: 120, reward: { type: 'parts', amount: 7  }, label: '+7 Parts'  },
        { pts: 150, reward: { type: 'parts', amount: 10 }, label: '+10 Parts' },
    ];
    const MQ_WEEKLY_GOLDEN_THRESHOLD = 180; // pts above this earn 1 universal part each

    const MQ_SPECIAL_BOX_CAP = 30;
    function _defaultMissions() {
        return {
            daily:   { quests: [], secret: null, lastRefreshDate: '', changeUsed: false, pointsToday: 0, claimedMilestones: [], completedToday: false, newVisit: false, rawXPToday: 0 },
            weekly:  { missions: [], weekKey: '', changeUsed: false, points: 0, claimedMilestones: [], anyCompleted: false, daysPlayedThisWeek: {}, dailyPtsLog: {}, newVisit: false, pendingUniversalParts: 0, universalPtsTracked: 0, hitAnyMilestone: false, dailyAllCompleteCount: 0, dailyAllCompleteDate: '' },
            streaks: { daily: 0 },
            stats:   { totalCompleted: 0, byTier: { easy: 0, normal: 0, hard: 0, secret: 0 }, weeklyCompleted: 0, totalPts: 0, completionHistory: {} },
            specialBox: { pts: 0 },
        };
    }
    function _missionDateKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
    function _legacyMissionWeekKey() {
        const d = new Date(); const jan1 = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${week}`;
    }
    function _missionWeekKey(date = new Date()) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const year = d.getUTCFullYear();
        const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
        return `${year}-W${String(week).padStart(2, '0')}`;
    }
    const _MISSION_RANK_MULTS = [1.00, 1.20, 1.40, 1.60, 1.80, 2.00, 2.20, 2.40, 2.60];
    function _missionRankMult() {
        const lv = getLevelInfo(saveData.totalXP).level;
        const BOUNDS = [1, 11, 21, 31, 41, 51, 61, 71, 81];
        let rank = 0;
        for (let i = BOUNDS.length - 1; i >= 0; i--) { if (lv >= BOUNDS[i]) { rank = i; break; } }
        return _MISSION_RANK_MULTS[rank] || 1.00;
    }
    function _niceRound(n) {
        if (n < 10)   return Math.max(1, Math.round(n));
        if (n < 30)   return Math.round(n / 5) * 5;
        if (n < 100)  return Math.round(n / 10) * 10;
        if (n < 500)  return Math.round(n / 25) * 25;
        if (n < 2000) return Math.round(n / 50) * 50;
        return Math.round(n / 100) * 100;
    }
    function _shuffleArr(arr) { return arr.slice().sort(() => Math.random() - 0.5); }
    function _applyVariation(n) {
        const factor = 0.9 + Math.random() * 0.2;
        return _niceRound(n * factor);
    }
    function _fmtMissionTime(s) {
        s = Math.round(s);
        const m = Math.floor(s / 60), r = s % 60;
        return r === 0 ? `${m}m` : `${m}m ${r}s`;
    }
    function _makeMissionDesc(metric, template, target) {
        const val = metric === 'gameTime' ? _fmtMissionTime(target) : target;
        return template.replace('{n}', val);
    }
    function _dailyStreakXPThreshold() {
        const lv = getLevelInfo(saveData.totalXP).level;
        const BOUNDS = [1, 11, 21, 31, 41, 51, 61, 71, 81];
        const THRESHOLDS = [50, 100, 150, 200, 250, 300, 400, 500, 600];
        let rank = 0;
        for (let i = BOUNDS.length - 1; i >= 0; i--) { if (lv >= BOUNDS[i]) { rank = i; break; } }
        return THRESHOLDS[rank] || 50;
    }
    function _missionTarget(q, mult) {
        const rankMult = ['maxSpeed', 'maxCombo'].includes(q.metric) ? 1 : mult;
        return _applyVariation(q.target * rankMult);
    }
    function _generateDailyQuests() {
        const mult = _missionRankMult();
        const byTier = t => DAILY_QUEST_POOL.filter(q => q.tier === t);
        // Start: 2 easy, 2 normal, 1 hard; each easy has 20% to evolve to normal, each normal has 20% to evolve to hard
        let tiers = ['easy','easy','normal','normal','hard'];
        tiers = tiers.map(t => { const r = Math.random(); if (t==='easy' && r<0.2) return 'normal'; if (t==='normal' && r<0.2) return 'hard'; return t; });
        const pools = { easy: _shuffleArr(byTier('easy')), normal: _shuffleArr(byTier('normal')), hard: _shuffleArr(byTier('hard')) };
        const idx = { easy:0, normal:0, hard:0 };
        const used = new Set();
        const usedMetrics = new Set();
        const quests = [];
        for (const tier of tiers) {
            while (idx[tier] < pools[tier].length && (used.has(pools[tier][idx[tier]].id) || usedMetrics.has(pools[tier][idx[tier]].metric))) idx[tier]++;
            if (idx[tier] < pools[tier].length) {
                const q = pools[tier][idx[tier]++];
                used.add(q.id);
                usedMetrics.add(q.metric);
                const scaled = _missionTarget(q, mult);
                quests.push({ ...q, target: scaled, progress: 0, completed: false, ptsClaimed: false, desc: _makeMissionDesc(q.metric, q.desc, scaled) });
            }
        }
        // Secret quest: 30% chance; assign a display tier (normal or hard) — title/desc hidden
        let secret = null;
        if (Math.random() < 0.3) {
            const sq = _shuffleArr(byTier('secret'))[0];
            if (sq) {
                const displayTier = Math.random() < 0.5 ? 'normal' : 'hard';
                // Secret quest targets are mostly 1 (binary), apply variation only to non-binary
                const scaledTarget = sq.target > 1 ? _missionTarget(sq, mult) : sq.target;
                secret = { ...sq, target: scaledTarget, progress: 0, completed: false, ptsClaimed: false, displayTier };
            }
        }
        return { quests, secret };
    }
    function _generateWeeklyMissions() {
        const mult = _missionRankMult();
        const byTier = t => WEEKLY_MISSION_POOL.filter(m => m.tier === t);
        // Base: 3 easy + 2 normal + 1 hard = 6 missions
        const baseTiers = ['easy','easy','easy','normal','normal','hard'];
        const pools = { easy: _shuffleArr(byTier('easy')), normal: _shuffleArr(byTier('normal')), hard: _shuffleArr(byTier('hard')) };
        const idx = { easy:0, normal:0, hard:0 };
        const used = new Set();
        const usedMetrics = new Set();
        const missions = [];
        for (const tier of baseTiers) {
            while (idx[tier] < pools[tier].length && (used.has(pools[tier][idx[tier]].id) || usedMetrics.has(pools[tier][idx[tier]].metric))) idx[tier]++;
            if (idx[tier] < pools[tier].length) {
                const m = pools[tier][idx[tier]++];
                used.add(m.id);
                usedMetrics.add(m.metric);
                const _scaledT = _missionTarget(m, mult);
                missions.push({ ...m, target: _scaledT, progress: 0, completed: false, ptsClaimed: false, desc: _makeMissionDesc(m.metric, m.desc, _scaledT) });
            }
        }
        // Maximum 1 mission can evolve by 1 tier (50% chance)
        if (Math.random() < 0.5 && missions.length) {
            let i = Math.floor(Math.random() * missions.length);
            const cur = missions[i].tier;
            if (cur === 'hard') {
                const nonHard = missions.map((_,j) => j).filter(j => missions[j].tier !== 'hard');
                if (nonHard.length) i = nonHard[Math.floor(Math.random() * nonHard.length)];
            }
            const t = missions[i].tier;
            if (t === 'easy') { missions[i] = { ...missions[i], tier: 'normal', pts: 15 }; }
            else if (t === 'normal') { missions[i] = { ...missions[i], tier: 'hard', pts: 25 }; }
        }
        return missions;
    }
    function _checkMissionsRefresh() {
        if (!saveData.missions) saveData.missions = _defaultMissions();
        const m = saveData.missions;
        if (!m.daily)   m.daily   = _defaultMissions().daily;
        if (!m.weekly)  m.weekly  = _defaultMissions().weekly;
        if (!m.streaks) m.streaks = _defaultMissions().streaks;
        if (!m.stats)   m.stats   = _defaultMissions().stats;
        // Migration: ensure new fields exist
        if (m.daily.completedToday === undefined) m.daily.completedToday = false;
        if (m.weekly.anyCompleted === undefined) m.weekly.anyCompleted = false;
        if (m.daily.newVisit === undefined) m.daily.newVisit = false;
        if (m.weekly.newVisit === undefined) m.weekly.newVisit = false;
        if (!m.weekly.dailyPtsLog) m.weekly.dailyPtsLog = {};
        if (m.streaks.bestDaily === undefined) m.streaks.bestDaily = m.streaks.daily || 0;
        if (m.daily.rawXPToday === undefined) m.daily.rawXPToday = 0;
        if (!m.specialBox) m.specialBox = { pts: 0 };
        if (m.stats.totalPts === undefined) m.stats.totalPts = 0;
        if (!m.stats.completionHistory) m.stats.completionHistory = {};
        // Migration: recompute descriptions from pool templates (so scaled rank targets show correctly)
        { const _poolById = Object.fromEntries([...DAILY_QUEST_POOL, ...WEEKLY_MISSION_POOL].map(p => [p.id, p]));
          const _reDesc = (arr) => arr && arr.forEach(q => { const p = _poolById[q.id]; if (p && p.tier !== 'secret') q.desc = _makeMissionDesc(p.metric, p.desc, q.target); });
          _reDesc(m.daily.quests); _reDesc(m.weekly.missions); }
        // Migration: fix corrupted weekly missions (invalid tiers)
        if (m.weekly.missions && m.weekly.missions.some(wm => !['easy','normal','hard'].includes(wm.tier))) {
            m.weekly.missions = _generateWeeklyMissions();
        }
        // Migration: fix old inflated daily quest pts (10/20/40/60 → 2/3/4/5)
        const _ptsFix = { 10: 2, 20: 3, 40: 4, 60: 5 };
        if (m.daily.quests && m.daily.quests.some(q => _ptsFix[q.pts])) {
            m.daily.quests.forEach(q => { if (_ptsFix[q.pts]) q.pts = _ptsFix[q.pts]; });
            if (m.daily.secret && _ptsFix[m.daily.secret.pts]) m.daily.secret.pts = _ptsFix[m.daily.secret.pts];
            m.daily.pointsToday = 0;
            m.daily.claimedMilestones = [];
        }
        // Migration: add golden zone tracking fields
        if (m.weekly.pendingUniversalParts === undefined) m.weekly.pendingUniversalParts = 0;
        if (m.weekly.universalPtsTracked === undefined) m.weekly.universalPtsTracked = 0;
        if (m.weekly.hitAnyMilestone === undefined) m.weekly.hitAnyMilestone = false;
        if (m.weekly.dailyAllCompleteCount === undefined) m.weekly.dailyAllCompleteCount = 0;
        if (m.weekly.dailyAllCompleteDate === undefined) m.weekly.dailyAllCompleteDate = '';
        // Migration: add ptsClaimed field — completed quests get true (pts already in bar from old system), new ones false
        if (m.daily.quests) m.daily.quests.forEach(q => { if (q.ptsClaimed === undefined) q.ptsClaimed = !!q.completed; });
        if (m.daily.secret && m.daily.secret.ptsClaimed === undefined) m.daily.secret.ptsClaimed = !!m.daily.secret.completed;
        if (m.weekly.missions) m.weekly.missions.forEach(wm => { if (wm.ptsClaimed === undefined) wm.ptsClaimed = !!wm.completed; });
        // Migration: hard daily pts 4→5, hard weekly pts 20→25
        if (m.daily.quests && m.daily.quests.some(q => q.tier === 'hard' && q.pts === 4)) {
            m.daily.quests.forEach(q => { if (q.tier === 'hard' && q.pts === 4) q.pts = 5; });
        }
        if (m.daily.secret && m.daily.secret.tier === 'hard' && m.daily.secret.pts === 4) m.daily.secret.pts = 5;
        if (m.weekly.missions && m.weekly.missions.some(wm => wm.tier === 'hard' && wm.pts === 20)) {
            m.weekly.missions.forEach(wm => { if (wm.tier === 'hard' && wm.pts === 20) wm.pts = 25; });
        }
        const today = _missionDateKey();
        const thisWeek = _missionWeekKey();
        let changed = false;
        let recovered = false;
        if (!m.weekly.isoWeekKey && m.weekly.weekKey === _legacyMissionWeekKey()) {
            m.weekly.weekKey = thisWeek;
            m.weekly.isoWeekKey = true;
            changed = true;
        }
        if (m.daily.lastRefreshDate !== today) {
            recovered = _autoClaimMissions(false) || recovered;
            // Check "Lazy or Lucky?" badge before daily reset
            { const _tryU = id => { if (!saveData.achievements?.[id]?.unlocked) unlockAchievement(id); };
              const _regDone = m.daily.quests?.filter(q => q.completed).length || 0;
              if ((m.daily.secret?.completed) && _regDone === 0) _tryU('mq_lazy_lucky'); }
            // Streak: only increment if enough raw XP earned on previous day
            const prev = new Date(m.daily.lastRefreshDate || 0); prev.setHours(0,0,0,0);
            const now = new Date(); now.setHours(0,0,0,0);
            const diff = Math.round((now - prev) / 86400000);
            const _xpThresh = _dailyStreakXPThreshold();
            if (diff === 1 && (m.daily.rawXPToday || 0) >= _xpThresh) {
                m.streaks.daily++;
                if (m.streaks.daily > (m.streaks.bestDaily || 0)) m.streaks.bestDaily = m.streaks.daily;
            } else if (diff >= 1) { m.streaks.daily = 0; }
            const { quests, secret } = _generateDailyQuests();
            m.daily = { quests, secret, lastRefreshDate: today, changeUsed: false, pointsToday: 0, claimedMilestones: [], completedToday: false, newVisit: true, rawXPToday: 0 };
            if (m.specialBox) m.specialBox.excessTracked = 0;
            changed = true;
        }
        if (!m.weekly.isoWeekKey) { m.weekly.isoWeekKey = true; changed = true; }
        if (m.weekly.weekKey !== thisWeek) {
            recovered = _autoClaimMissions(true) || recovered;
            // Check week-end badges before weekly reset
            { const _tryU = id => { if (!saveData.achievements?.[id]?.unlocked) unlockAchievement(id); };
              const wm = m.weekly.missions || [];
              // "Hard They Said" — complete only the hard weekly mission(s)
              const _hardDone = wm.filter(x => x.tier === 'hard' && x.completed).length;
              const _nonHardDone = wm.filter(x => x.tier !== 'hard' && x.completed).length;
              if (_hardDone >= 1 && _nonHardDone === 0 && wm.length > 0) _tryU('mq_hard_they_said');
              // "Barely" — 7+ streak but no milestones claimed all week
              if ((m.streaks?.daily || 0) >= 7 && !m.weekly.hitAnyMilestone && m.weekly.anyCompleted) _tryU('mq_barely');
              // "All Cleared" — all weekly done AND all daily done every day for 7 days
              const _allWeeklyDone = wm.length > 0 && wm.every(x => x.completed);
              if (_allWeeklyDone && (m.weekly.dailyAllCompleteCount || 0) >= 7) _tryU('mq_all_cleared');
            }
            const missions = _generateWeeklyMissions();
            m.weekly = { missions, weekKey: thisWeek, isoWeekKey: true, changeUsed: false, points: 0, claimedMilestones: [], anyCompleted: false, daysPlayedThisWeek: {}, dailyPtsLog: {}, newVisit: true, pendingUniversalParts: 0, universalPtsTracked: 0, hitAnyMilestone: false, dailyAllCompleteCount: 0, dailyAllCompleteDate: '' };
            changed = true;
        }
        if (changed) saveDataToFile();
        if (recovered) customAlert('Unclaimed rewards from the last day/week were added.', 'REWARDS ADDED');
    }

    function _resetMissionGameTracking() {
        _mq_hatTrickDone = false;
        _mq_dangerEntryTime = -1; _mq_narrowEscape = false;
        _mq_iFloor = false; _mq_bottomQuarterBlocks = 0; _mq_speedRun = false;
        _mq_perfectClear = false; _mq_comebackKidEntryTime = -1; _mq_comebackKid = false;
        _mq_monochrome = false; _mq_speedQueen = false;
        _mq_minimalistFailed = false; _mq_minimalistLines = 0; _mq_minimalist = false;
        _mq_quadStreak = false; _mq_flatEarth = false; _mq_flatEarthStart = -1;
        _achsThisGame = 0;
    }

    function _getMissionStreakXPMult() {
        const streak = saveData.missions?.streaks?.daily || 0;
        if (streak >= 21)  return 2.00;
        if (streak >= 11)  return 1.75;
        if (streak >= 6)   return 1.50;
        if (streak >= 3)   return 1.25;
        return 1.0;
    }

    function _updateMissionProgress() {
        if (!saveData.missions) return;
        // Fun Mode doesn't count toward quests/missions
        if (currentGameMode === 'fun') return;
        // Games with 0 lines cleared don't count
        if (linesClearedThisGame === 0) return;
        _checkMissionsRefresh();
        const m = saveData.missions;
        const metrics = {
            blocksPlaced: blocksPlacedThisGame, linesCleared: linesClearedThisGame,
            score: Math.round(score), gameTime, maxSpeed: speedLevel,
            hardDrops: _hardDropsThisGame, maxCombo: _maxComboThisGame, quads: _quadrasThisGame,
            hatTrick: _mq_hatTrickDone ? 1 : 0, narrowEscape: _mq_narrowEscape ? 1 : 0,
            iFloor: _mq_iFloor ? 1 : 0, bottomQuarter: _mq_bottomQuarterBlocks,
            speedRun: _mq_speedRun ? 1 : 0, gamesPlayed: 1,
            // new metrics
            bottomTwoRows: _bottomTwoRowsThisGame,
            rotations: _rotationsThisGame,
            doubles: _doublesThisGame,
            triples: _triplesThisGame,
            tSpins: _tSpinsThisGame,
            perfectClear: _boardClearedThisGame ? 1 : 0,
            noSoftDrop: (!_softDropUsedThisGame) ? 1 : 0,
            comebackKid: _mq_comebackKid ? 1 : 0,
            monochrome: _mq_monochrome ? 1 : 0,
            speedQueen: _mq_speedQueen ? 1 : 0,
            minimalist: _mq_minimalist ? 1 : 0,
            quadStreak: _mq_quadStreak ? 1 : 0,
            flatEarth: _mq_flatEarth ? 1 : 0,
            gamesReachedSpeed2: speedLevel >= 2 ? 1 : 0,
            gamesReachedSpeed3: speedLevel >= 3 ? 1 : 0,
            gamesReachedSpeed4: speedLevel >= 4 ? 1 : 0,
            gamesWithCombo4: _maxComboThisGame >= 4 ? 1 : 0,
            // niceBonus/doubleCompletion computed after other quests run
            niceBonus: 0, doubleCompletion: 0,
        };
        let _completedThisCall = 0;
        // Daily quests — best single-game OR cumulative across games today
        m.daily.quests.forEach(q => {
            if (q.completed) return;
            const val = metrics[q.metric] ?? 0;
            if (q.cumulative) {
                q.progress = Math.min(q.target, (q.progress || 0) + val);
            } else {
                q.progress = Math.min(q.target, Math.max(q.progress || 0, val));
            }
            if (q.progress >= q.target) {
                q.completed = true;
                m.daily.completedToday = true;
                m.stats.totalCompleted++;
                m.stats.byTier[q.tier] = (m.stats.byTier[q.tier] || 0) + 1;
                _completedThisCall++;
            }
        });
        // Track days where all regular daily quests complete (for mq_all_cleared badge)
        { const _allDone = m.daily.quests.length > 0 && m.daily.quests.every(q => q.completed);
          const _today2 = _missionDateKey();
          if (_allDone && m.weekly.dailyAllCompleteDate !== _today2) {
              m.weekly.dailyAllCompleteDate = _today2;
              m.weekly.dailyAllCompleteCount = (m.weekly.dailyAllCompleteCount || 0) + 1;
          } }
        // Weekly missions (run before secret so doubleCompletion can count them)
        const today = _missionDateKey();
        if (!m.weekly.daysPlayedThisWeek) m.weekly.daysPlayedThisWeek = {};
        if (!m.weekly.dailyPtsLog) m.weekly.dailyPtsLog = {};
        m.weekly.daysPlayedThisWeek[today] = true;
        m.weekly.missions.forEach(wm => {
            if (wm.completed) return;
            const val = metrics[wm.metric] ?? 0;
            wm.progress = wm.cumulative
                ? Math.min(wm.target, (wm.progress || 0) + val)
                : Math.min(wm.target, Math.max(wm.progress || 0, val));
            if (wm.progress >= wm.target) {
                wm.completed = true;
                m.weekly.anyCompleted = true;
                m.stats.totalCompleted++;
                m.stats.byTier[wm.tier] = (m.stats.byTier[wm.tier] || 0) + 1;
                _completedThisCall++;
            }
        });
        // Secret quest — compute special metrics now
        if (m.daily.secret && !m.daily.secret.completed) {
            const sq = m.daily.secret;
            let val = metrics[sq.metric] ?? 0;
            if (sq.metric === 'niceBonus') {
                val = (m.daily.quests.length > 0 && m.daily.quests.every(q => q.completed)) ? 1 : 0;
            } else if (sq.metric === 'doubleCompletion') {
                val = _completedThisCall >= 2 ? 1 : 0;
            }
            sq.progress = Math.min(sq.target, Math.max(sq.progress || 0, val));
            if (sq.progress >= sq.target) {
                sq.completed = true;
                m.daily.completedToday = true;
                m.stats.totalCompleted++;
                m.stats.byTier.secret = (m.stats.byTier.secret || 0) + 1;
                _completedThisCall++;
            }
        }
        // All daily pts flow to weekly bar
        { const _curDailyPts = m.daily.pointsToday || 0;
          const _prevDailyTracked = m.daily.ptsTrackedForWeekly || 0;
          const _dailyDelta = _curDailyPts - _prevDailyTracked;
          if (_dailyDelta > 0) {
              m.daily.ptsTrackedForWeekly = _curDailyPts;
              m.weekly.points = (m.weekly.points || 0) + _dailyDelta;
              m.weekly.dailyPtsLog[today] = (m.weekly.dailyPtsLog[today] || 0) + _dailyDelta;
          } }
        // Golden zone: 1 universal part per pt above MQ_WEEKLY_GOLDEN_THRESHOLD
        { const _wPts = m.weekly.points || 0;
          const _above = Math.max(0, _wPts - MQ_WEEKLY_GOLDEN_THRESHOLD);
          const _tracked = m.weekly.universalPtsTracked || 0;
          const _newParts = _above - _tracked;
          if (_newParts > 0) {
              m.weekly.universalPtsTracked = _above;
              m.weekly.pendingUniversalParts = (m.weekly.pendingUniversalParts || 0) + _newParts;
          } }
        // Excess daily pts (above last milestone) → special bonus box
        { const _lastMS = MQ_DAILY_MILESTONES[MQ_DAILY_MILESTONES.length - 1].pts;
          const _curDPts = m.daily.pointsToday || 0;
          const _newExcess = Math.max(0, _curDPts - _lastMS);
          const _excessTracked = m.specialBox.excessTracked || 0;
          const _excessDelta = _newExcess - _excessTracked;
          if (_excessDelta > 0) {
              m.specialBox.excessTracked = _newExcess;
              m.specialBox.pts = (m.specialBox.pts || 0) + _excessDelta;
              if (m.specialBox.pts >= MQ_SPECIAL_BOX_CAP) {
                  m.specialBox.pts -= MQ_SPECIAL_BOX_CAP;
                  saveData.universalParts = (saveData.universalParts || 0) + 5;
                  _showMissionReward('+5 Universal Parts — Bonus Box!');
              }
          } }
        // Track completions per day and total pts for stats
        if (_completedThisCall > 0) {
            const _n = new Date(); const _histKey = _n.getFullYear()+'-'+String(_n.getMonth()+1).padStart(2,'0')+'-'+String(_n.getDate()).padStart(2,'0');
            if (!m.stats.completionHistory) m.stats.completionHistory = {};
            m.stats.completionHistory[_histKey] = (m.stats.completionHistory[_histKey] || 0) + _completedThisCall;
        }
        _checkMissionBadges();
        saveDataToFile();
        _checkGlowNotifications();
    }

    function _checkMissionBadges() {
        if (!saveData.missions?.stats) return;
        const s = saveData.missions.stats;
        const m = saveData.missions;
        const tryU = id => { if (!saveData.achievements?.[id]?.unlocked) unlockAchievement(id); };
        // Existing single badges
        if ((s.byTier?.easy || 0) >= 1)   tryU('mq_first_easy');
        if ((s.byTier?.normal || 0) >= 10) tryU('mq_normal_10');
        if ((s.byTier?.hard || 0) >= 5)   tryU('mq_hard_5');
        if ((s.byTier?.secret || 0) >= 1)  tryU('mq_secret_1');
        if ((s.totalCompleted || 0) >= 50)  tryU('mq_total_50');
        if ((m.streaks?.daily || 0) >= 7)  tryU('mq_streak_7');
        if ((m.streaks?.daily || 0) >= 30) tryU('mq_streak_30');
        const allDone = m.daily.quests?.every(q => q.completed);
        const secDone = m.daily.secret?.completed;
        if (allDone && secDone) tryU('mq_daily_perfect');
        // "No Easy Day" — check tier distribution of today's quests
        const dailyQ = m.daily.quests || [];
        const normalOrHarder = dailyQ.filter(q => q.tier === 'normal' || q.tier === 'hard').length;
        const hardOnly = dailyQ.filter(q => q.tier === 'hard').length;
        if (normalOrHarder >= 4) tryU('mq_no_easy_epic');
        if (hardOnly >= 3) tryU('mq_no_easy_legendary');
    }

    // ---- MISSIONS UI ----
    function _miniWell(progress, target, color) {
        const W = 5, H = 5;
        const pct = Math.min(1, (progress || 0) / Math.max(1, target || 1));
        const filled = Math.floor(pct * W * H);
        let rows = '';
        for (let r = 0; r < H; r++) {
            let tds = '';
            for (let c = 0; c < W; c++) {
                const fromBottom = (H - 1 - r) * W + c;
                tds += fromBottom < filled
                    ? `<td style="background:${color};box-shadow:0 0 4px ${color},0 0 8px ${color}44;"></td>`
                    : '<td></td>';
            }
            rows += `<tr>${tds}</tr>`;
        }
        return `<table class="mq-mini-well" style="box-shadow:0 0 0 1px ${color}44;"><tbody>${rows}</tbody></table>`;
    }

    function _cellBar(progress, target, color, cells) {
        cells = cells || 18;
        const pct = Math.min(1, (progress || 0) / Math.max(1, target || 1));
        const filled = Math.round(pct * cells);
        let items = '';
        for (let i = 0; i < cells; i++) {
            if (i < filled) {
                const op = 0.55 + (i / cells) * 0.45;
                items += `<div style="flex:1;background:${color};opacity:${op.toFixed(2)};box-shadow:inset -1px -1px 0 rgba(0,0,0,0.3),inset 1px 1px 0 rgba(255,255,255,0.18);"></div>`;
            } else {
                items += `<div style="flex:1;background:rgba(255,255,255,0.04);"></div>`;
            }
        }
        return `<div style="display:flex;gap:1px;height:8px;background:rgba(0,0,0,0.4);border:1px solid ${color}33;padding:1px;">${items}</div>`;
    }

    function _missionQuestCard(q, index, isWeekly) {
        const isSecret = q.tier === 'secret';
        const displayTier = isSecret ? (q.displayTier || 'normal') : (q.tier || 'normal');
        const tc = isSecret ? '#cc44ff' : (MISSION_TIER_COLORS[displayTier] || '#4499ff');
        const tierLabel = isSecret ? 'SECRET' : displayTier.toUpperCase();
        const done = q.completed;
        const claimedState = done && q.ptsClaimed;
        const readyState = done && !q.ptsClaimed;
        const changeAvail = isWeekly ? !saveData.missions?.weekly?.changeUsed : !saveData.missions?.daily?.changeUsed;
        const canSwapThis = !isSecret && !done && changeAvail && typeof index === 'number';
        const inChangeMode = !!window._mqChangeMode;
        const title = isSecret && !done ? '???' : q.title;
        const desc  = isSecret && !done ? '<span class="mq-secret-hint">Complete to reveal…</span>' : `<span>${q.desc}</span>`;
        const hasProgress = !isSecret && q.target > 1;
        const pct = hasProgress ? Math.min(100, ((q.progress || 0) / q.target) * 100) : 0;
        const _progFmt = hasProgress
            ? (q.metric === 'gameTime'
                ? `<span style="color:${tc}">${_fmtMissionTime(q.progress || 0)}</span><span style="color:#444">/${_fmtMissionTime(q.target)}</span>`
                : `<span style="color:${tc}">${q.progress || 0}</span><span style="color:#444">/${q.target}</span>`)
            : '';
        const miniWellHtml = hasProgress ? _miniWell(q.progress, q.target, tc) : '';
        // Progress row: continuous HUD-style bar (Section D) + progress/target on right
        const progressRowHtml = hasProgress ? `
            <div style="display:flex;align-items:center;gap:10px;margin-top:12px;margin-bottom:8px;">
                <div style="flex:1;height:11px;background:rgba(255,255,255,0.04);border:1px solid ${tc}44;padding:2px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${tc};box-shadow:0 0 6px ${tc};background-image:linear-gradient(90deg,${tc}cc 0%,${tc} 100%);"></div>
                </div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.55rem;min-width:52px;text-align:center;white-space:nowrap;">${_progFmt}</div>
            </div>` : '';
        // Action row (bottom of card)
        let actionHtml = '';
        if (claimedState) {
            actionHtml = `<div style="font-family:var(--ui-font);font-size:0.48rem;color:#44ff88;letter-spacing:0.18em;">&#x2713; CLAIMED</div>`;
        } else if (readyState) {
            actionHtml = `<div style="text-align:center;margin-top:8px;"><button class="mq-pts-claim-btn" style="color:${tc};border-color:${tc};background:${tc}22;box-shadow:0 0 10px ${tc}22;" onclick="window._claimQuestPts('${q.id}',${!!isWeekly},'${tc}',this)">CLAIM +${q.pts} PTS</button></div>`;
        } else if (!done && hasProgress) {
            actionHtml = `<div style="font-family:var(--ui-font);font-size:0.48rem;color:#555;letter-spacing:0.1em;">${Math.floor(pct)}% complete</div>`;
        }
        // Card appearance: claimed = dimmed, ready/active = full opacity
        const cardStyle = claimedState
            ? `background:${tc}06;border:1px solid rgba(255,255,255,0.08);opacity:0.55;`
            : `background:${tc}12;border:2px solid ${tc}44;`;
        const changeModeCls = inChangeMode ? (canSwapThis ? ' mq-card--changeable' : ' mq-card--change-dimmed') : '';
        const changeOverlay = (inChangeMode && canSwapThis)
            ? `<div class="mq-change-overlay" onclick="window._changeMission(${index},${!!isWeekly})"><span class="mq-change-overlay-label">↺ TAP TO SWAP</span></div>`
            : '';
        return `<div class="mq-card-wrap">
            <div class="mq-card${isSecret?' mq-card--secret':''}${changeModeCls}" style="${cardStyle}">
                <div class="mq-card-hdr">
                    <span class="mq-tier-badge" style="color:${tc};border-color:${tc}44">${tierLabel}</span>
                    <span class="mq-pts" style="color:${tc}">+${q.pts} pts</span>
                </div>
                <div class="mq-card-body${miniWellHtml ? '' : ' mq-card-body--nowell'}">
                    ${miniWellHtml}
                    <div class="mq-card-text">
                        <div class="mq-card-title">${title}</div>
                        <div class="mq-card-desc">${desc}</div>
                    </div>
                </div>
                ${progressRowHtml}${actionHtml}
            </div>
            ${changeOverlay}
        </div>`;
    }

    function _missionProgressBar(points, milestones, claimed, isWeekly) {
        // For weekly: extend maxPts beyond the golden threshold so the golden zone is visible
        const lastMsPts = milestones[milestones.length - 1].pts;
        const maxPts = isWeekly
            ? Math.max(lastMsPts * 1.12, MQ_WEEKLY_GOLDEN_THRESHOLD * 1.12)
            : lastMsPts * 1.18;
        const isGolden = isWeekly && points > MQ_WEEKLY_GOLDEN_THRESHOLD;
        const stepSize = isWeekly ? 4 : 1;
        const totalSteps = Math.ceil(maxPts / stepSize);
        const stepColor = isGolden ? '#ffcc44' : (isWeekly ? '#ff9900' : '#44ff88');
        const barParts = [];
        for (let i = 0; i < totalSteps; i++) {
            const fill = Math.min(1, Math.max(0, (points - i * stepSize) / stepSize));
            const opacity = (0.55 + (i / totalSteps) * 0.45).toFixed(2);
            if (i > 0) barParts.push(`<div style="width:1px;flex-shrink:0;"></div>`);
            if (fill <= 0) {
                barParts.push(`<div style="flex:1;background:rgba(255,255,255,0.04);"></div>`);
            } else if (fill >= 1) {
                barParts.push(`<div style="flex:1;background:${stepColor};opacity:${opacity};box-shadow:inset -1px -1px 0 rgba(0,0,0,0.3),inset 1px 1px 0 rgba(255,255,255,0.18);"></div>`);
            } else {
                barParts.push(`<div style="flex:1;overflow:hidden;background:rgba(255,255,255,0.04);"><div style="width:${(fill*100).toFixed(1)}%;height:100%;background:${stepColor};opacity:${opacity};box-shadow:inset -1px -1px 0 rgba(0,0,0,0.3),inset 1px 1px 0 rgba(255,255,255,0.18);"></div></div>`);
            }
        }
        const stepsHtml = barParts.join('');
        // Milestone tick marks — sit behind the bar, protrude above and below
        const _tickStyle = `position:absolute;top:-3px;transform:translateX(-50%);width:3px;height:15px;background:rgba(255,255,255,0.7);border-radius:1px;box-shadow:0 0 2px rgba(255,255,255,0.4),0 0 4px rgba(0,0,0,0.6);`;
        const goldenTickHtml = isWeekly
            ? `<div style="${_tickStyle}left:${((MQ_WEEKLY_GOLDEN_THRESHOLD/stepSize)/totalSteps*100).toFixed(2)}%;"></div>`
            : '';
        const msTicksHtml = milestones.map(ms => {
            const tPct = ((ms.pts / stepSize) / totalSteps * 100).toFixed(2);
            return `<div style="${_tickStyle}left:${tPct}%;"></div>`;
        }).join('') + goldenTickHtml;
        const boxIcon = `<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 3.66333L20.25 7.7398V17.01L12 21.0865L3.75 17.01V7.7398L12 3.66333ZM5.25 9.41292V16.078L11.25 19.0427V12.3776L5.25 9.41292ZM12.75 12.3776V19.0427L18.75 16.078V9.41292L16.5 10.5247V13.4999L15 14.2499V11.2659L12.75 12.3776ZM17.807 8.20577L15.8527 9.17139C15.8099 9.13606 15.7624 9.10498 15.7106 9.07908L10.1015 6.27454L12 5.33645L17.807 8.20577ZM8.41452 7.1081L14.1871 9.9944L12 11.0751L6.19304 8.20577L8.41452 7.1081Z"/></svg>`;
        const labels = milestones.map(ms => {
            const lPct = (ms.pts / stepSize) / totalSteps * 100;
            return `<div class="mq-pb-label-item" style="left:${lPct}%;color:#fff;">${ms.pts}</div>`;
        }).join('');
        // Weekly: golden threshold label
        const goldenLabelHtml = isWeekly
            ? `<div class="mq-pb-label-item" style="left:${(MQ_WEEKLY_GOLDEN_THRESHOLD/stepSize/totalSteps)*100}%;color:#aa8800;font-weight:bold;">${MQ_WEEKLY_GOLDEN_THRESHOLD}</div>`
            : '';
        const icons = milestones.map(ms => {
            const iPct = (ms.pts / stepSize) / totalSteps * 100;
            const reached = points >= ms.pts;
            const isClaimed = (claimed || []).includes(ms.pts);
            const canClaim = reached && !isClaimed;
            const cls = reached ? (isWeekly ? 'reached-w' : 'reached-d') : '';
            const claimedColor = isWeekly ? '#ff9900' : '#44ff88';
            const checkIcon = `<svg viewBox="0 0 10 10" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 4.5 9 8.5 1"/></svg>`;
            const iconContent = isClaimed
                ? `<span class="mq-ms-icon" style="color:${claimedColor};filter:drop-shadow(0 0 4px ${claimedColor}66);display:inline-flex;width:40px;height:40px;align-items:center;justify-content:center;">${checkIcon}</span>`
                : `<span class="mq-ms-icon ${cls}">${boxIcon}</span>`;
            return `<div class="mq-pb-icon-wrap" style="left:${iPct}%">${canClaim
                ? `<button class="mq-ms-claim-btn" onclick="window._claimMissionMilestone(${ms.pts},${!!isWeekly})" title="Claim reward">${iconContent}</button>`
                : iconContent}</div>`;
        }).join('');
        // Weekly: pending universal parts — claimable box replaces star when available
        const pending = isWeekly ? (saveData.missions?.weekly?.pendingUniversalParts || 0) : 0;
        const goldenIconHtml = isWeekly ? (() => {
            const gPct = (MQ_WEEKLY_GOLDEN_THRESHOLD / stepSize) / totalSteps * 100;
            if (pending > 0) {
                return `<div class="mq-pb-icon-wrap" style="left:${gPct}%;">
                    <div style="position:relative;display:inline-block;">
                        <button class="mq-ms-claim-btn" onclick="window._claimWeeklyUniversalParts()" title="Collect +${pending} Universal Part${pending !== 1 ? 's' : ''}">
                            <span class="mq-ms-icon reached-w">${boxIcon}</span>
                        </button>
                        <div style="position:absolute;top:-3px;right:-5px;background:#ffcc44;color:#050510;font-family:var(--ui-font);font-size:0.32rem;font-weight:bold;padding:1px 3px;border-radius:3px;line-height:1.4;pointer-events:none;">+${pending}</div>
                    </div>
                </div>`;
            }
            const starCol = isGolden ? '#ffcc44' : '#2a2a3a';
            const starFilter = isGolden ? 'filter:drop-shadow(0 0 6px rgba(255,204,68,0.55));' : '';
            const starSvg = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="${starCol}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            return `<div class="mq-pb-icon-wrap" style="left:${gPct}%;top:10px;"><span class="mq-star-tip" data-mqctip="${MQ_WEEKLY_GOLDEN_THRESHOLD}+ pts: earn +1 Universal Part per extra point" style="${starFilter}cursor:help;display:block;">${starSvg}</span></div>`;
        })() : '';
        const ptsColor = isGolden ? '#ffcc44' : (isWeekly ? '#ffcc44' : '#4499ff');
        const ptsDimColor = isWeekly ? '#664400' : '#223355';
        return `<div class="mq-pb-wrap" style="position:relative;">
            <div style="display:flex;align-items:baseline;gap:5px;margin-bottom:3px;">
                <span style="font-family:var(--ui-font);font-size:1.4rem;font-weight:900;color:${ptsColor};letter-spacing:1px;line-height:1;${isGolden?'text-shadow:0 0 12px rgba(255,204,68,0.45);':''}">${points}</span>
                <span style="font-family:var(--ui-font);font-size:0.52rem;color:${ptsDimColor};letter-spacing:2px;padding-bottom:1px;">PTS</span>
            </div>
            <div class="mq-pb-labels">${labels}${goldenLabelHtml}</div>
            <div style="position:relative;">
                <div style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;">${msTicksHtml}</div>
                <div class="mq-step-bar" style="display:flex;height:9px;background:rgba(0,0,0,0.4);border:1px solid ${stepColor}33;padding:1px;overflow:hidden;">${stepsHtml}</div>
            </div>
            <div class="mq-pb-icons">${icons}${goldenIconHtml}</div>
        </div>`;
    }

    function _renderMissionStatsSection() {
        const el = document.getElementById('mq-stats-section');
        if (!el || !saveData.missions) return;
        const m = saveData.missions;
        const st = m.stats || {};
        const hist = st.completionHistory || {};
        const now = new Date();
        const _ldk = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        const todayStr = _ldk(now);

        // Current week boundaries (Mon-Sun)
        const dow = now.getDay(); // 0=Sun
        const daysToMon = dow === 0 ? 6 : dow - 1;
        const weekStart = new Date(now); weekStart.setHours(0,0,0,0); weekStart.setDate(now.getDate() - daysToMon);

        // Daily pts from weeklyLog (keys are non-zero-padded YYYY-M-D)
        const ptsLog = m.weekly?.dailyPtsLog || {};
        const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const DAY_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

        // Build 7 day entries Mon-Sun
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
            const key = _ldk(d);
            const ptsKey = d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
            const isFuture = key > todayStr;
            const isToday = key === todayStr;
            const count = hist[key] || 0;
            const pts = ptsLog[ptsKey] || ptsLog[key] || 0;
            weekDays.push({ key, d, isFuture, isToday, count, pts });
        }

        // Weekly missions row
        const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        const squaresHtml = weekDays.map((day, i) => {
            const c = day.count;
            let bg, opacity, outline = '';
            if (day.isFuture) {
                bg = 'rgba(255,255,255,0.04)'; opacity = '0.5';
            } else if (c === 0) {
                bg = 'rgba(255,255,255,0.07)'; opacity = '1';
            } else if (c === 1) {
                bg = '#4499ff'; opacity = '0.6';
            } else if (c <= 3) {
                bg = '#4499ff'; opacity = '0.8';
            } else {
                bg = '#4499ff'; opacity = '1';
            }
            if (day.isToday) outline = 'outline:2px solid rgba(255,255,255,0.7);outline-offset:-2px;';
            const tipAttr = !day.isFuture ? `data-mq-day-count="${c}"` : '';
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;">
                <div style="font-size:0.38rem;color:${day.isToday?'#ccc':'#444'};letter-spacing:0.5px;">${DAY_SHORT[i]}</div>
                <div ${tipAttr} style="width:100%;aspect-ratio:1/1;border-radius:4px;background:${bg};opacity:${opacity};${outline}cursor:default;"></div>
                ${c > 0 && !day.isFuture ? `<div style="font-size:0.38rem;color:#4499ff;font-weight:bold;">${c}</div>` : `<div style="font-size:0.38rem;color:transparent;">0</div>`}
            </div>`;
        }).join('');

        el.innerHTML = `<div style="padding:10px 10px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
            <div style="font-family:var(--ui-font);font-size:0.42rem;letter-spacing:1.5px;color:#555;margin-bottom:8px;">THIS WEEK</div>
            <div style="display:flex;gap:4px;">${squaresHtml}</div>
        </div>`;

        // Size squares to be actually square after render
        requestAnimationFrame(() => {
            // Tooltips
            let mqTip = document.getElementById('mq-cal-tip');
            if (!mqTip) {
                mqTip = document.createElement('div');
                mqTip.id = 'mq-cal-tip';
                mqTip.style.cssText = 'display:none;position:fixed;z-index:9999;background:rgba(5,5,20,0.97);border:1px solid rgba(68,153,255,0.25);border-radius:10px;padding:10px 16px;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.7);text-align:center;min-width:60px;';
                document.body.appendChild(mqTip);
            }
            el.querySelectorAll('[data-mq-day-count]').forEach(cell => {
                cell.addEventListener('mouseenter', e => {
                    const cnt = parseInt(cell.dataset.mqDayCount, 10);
                    mqTip.innerHTML = cnt > 0
                        ? `<div style="font-family:var(--ui-font);font-size:1.3rem;font-weight:900;color:#4499ff;line-height:1;">${cnt}</div><div style="font-size:0.5rem;color:#778;margin-top:4px;letter-spacing:0.08em;">${cnt === 1 ? 'MISSION' : 'MISSIONS'}</div>`
                        : `<div style="font-size:1rem;color:#333;line-height:1;">—</div><div style="font-size:0.5rem;color:#444;margin-top:4px;letter-spacing:0.08em;">NO MISSIONS</div>`;
                    mqTip.style.display = 'block';
                    mqTip.style.left = (e.clientX + 14) + 'px';
                    mqTip.style.top = (e.clientY - 56) + 'px';
                });
                cell.addEventListener('mouseleave', () => { mqTip.style.display = 'none'; });
                cell.addEventListener('mousemove', e => { mqTip.style.left = (e.clientX + 14) + 'px'; mqTip.style.top = (e.clientY - 56) + 'px'; });
            });
        });
    }

    function _sortQuests(quests) {
        const tierOrder = { hard: 0, normal: 1, easy: 2, secret: 3 };
        return [...quests].sort((a, b) => {
            const ta = tierOrder[a.tier] ?? 2, tb = tierOrder[b.tier] ?? 2;
            if (ta !== tb) return ta - tb;
            const pa = a.target > 0 ? (a.progress || 0) / a.target : 0;
            const pb = b.target > 0 ? (b.progress || 0) / b.target : 0;
            return pb - pa;
        });
    }
    // Reorder sorted items for column-first display in a 2-col grid:
    // first half fills left column top-to-bottom, second half fills right column
    function _columnarOrder(items) {
        const half = Math.ceil(items.length / 2);
        const result = [];
        for (let i = 0; i < half; i++) {
            result.push(items[i]);
            if (i + half < items.length) result.push(items[i + half]);
        }
        return result;
    }

    function renderMissionsOverlay(tab) {
        if (!saveData.missions) saveData.missions = _defaultMissions();
        _checkMissionsRefresh();
        const m = saveData.missions;
        const el = document.getElementById('missions-overlay');
        if (!el) return;
        // Block tab switch while in swap mode
        if (window._mqChangeMode && tab && tab !== (el._mTab || 'daily')) return;
        const _prevTab = el._mTab || null;
        tab = tab || el._mTab || 'daily';
        el._mTab = tab;
        const _isTabSwitch = !!_prevTab && _prevTab !== tab;

        // Streak panel (below tabs)
        const dStreak = m.streaks?.daily || 0;
        const bestD = m.streaks?.bestDaily || dStreak;
        const xpMult = _getMissionStreakXPMult();
        const sbPts = m.specialBox?.pts || 0;
        const sbPct = Math.min(100, (sbPts / MQ_SPECIAL_BOX_CAP) * 100);
        const xpThresh = _dailyStreakXPThreshold();
        const rawXP = m.daily.rawXPToday || 0;
        const xpPct = Math.min(100, (rawXP / xpThresh) * 100);
        const xpDone = rawXP >= xpThresh;
        const xpColor = xpDone ? '#44ff88' : '#ffcc44';
        const xpBarBg = xpDone ? 'linear-gradient(90deg,#22aa44,#44ff88)' : 'linear-gradient(90deg,#996600,#ffcc44)';
        const multRows = [{d:3,x:'×1.25'},{d:6,x:'×1.50'},{d:11,x:'×1.75'},{d:21,x:'×2.00'}].map(r =>
            `<div style="display:flex;justify-content:space-between;gap:14px;font-size:0.58rem;color:${dStreak>=r.d?'#ffcc44':'#444'};margin-bottom:3px;"><span>${r.d} days</span><span>${r.x}</span></div>`).join('');
        const streakPanelHtml = `
            <div style="border:1px solid rgba(255,204,68,0.25);border-radius:10px;overflow:hidden;">
            <div class="mq-streak-half" style="padding:14px 16px;background:rgba(255,204,68,0.05);border:none;border-radius:0;position:relative;overflow:hidden;">
                <div style="position:absolute;right:-12px;top:-12px;font-size:4rem;opacity:0.08;line-height:1;pointer-events:none;">🔥</div>
                <div style="display:flex;align-items:center;gap:8px;position:relative;">
                    <span style="font-size:1.4rem;">🔥</span>
                    <span style="font-family:var(--ui-font);font-size:1.8rem;font-weight:900;color:#ffcc44;line-height:1;">${dStreak}</span>
                    <span style="font-size:0.55rem;color:#aa8800;font-family:monospace;align-self:flex-end;margin-bottom:3px;">${dStreak === 1 ? 'day' : 'days'}</span>
                </div>
                <div style="font-size:0.42rem;color:#776633;letter-spacing:0.15em;margin-top:6px;position:relative;">DAILY STREAK · BEST <b style="color:#ffcc44;">${bestD}</b></div>
                ${xpMult > 1 ? `<div style="margin-top:5px;font-size:0.45rem;color:#aa8800;position:relative;">XP Multiplier: ${xpMult.toFixed(2)}× active</div>` : ''}
                <div class="mq-streak-panel-tip">
                    <div style="font-family:var(--ui-font);font-size:0.48rem;letter-spacing:1.5px;color:#666;margin-bottom:5px;">XP MULTIPLIER</div>
                    ${multRows}
                    ${xpMult > 1 ? `<div style="margin-top:4px;font-size:0.58rem;color:#ffcc44;">Active: ${xpMult.toFixed(2)}×</div>` : ''}
                    <div style="font-size:0.5rem;color:#555;margin-top:4px;">Streak requires ${xpThresh} raw XP/day</div>
                </div>
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
            <div style="padding:14px 16px;background:${xpDone?'rgba(68,255,136,0.04)':'rgba(255,204,68,0.03)'};">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;">
                    <span style="font-size:0.45rem;color:#666;letter-spacing:0.18em;font-family:var(--ui-font);">TODAY'S XP</span>
                    <span style="font-family:var(--ui-font);font-size:0.8rem;font-weight:bold;color:${xpColor};">${rawXP}<span style="color:#555;font-size:0.55rem;font-weight:normal;">/${xpThresh}</span></span>
                </div>
                <div style="height:5px;background:rgba(255,255,255,0.06);overflow:hidden;">
                    <div style="height:100%;width:${xpPct}%;background:${xpBarBg};transition:width 0.4s;"></div>
                </div>
                ${!xpDone ? `<div style="font-size:0.42rem;color:#555;margin-top:5px;">Hit ${xpThresh} XP to keep your streak alive</div>` : ''}
            </div>
            </div>
            <button id="mq-change-toggle" class="mq-change-toggle${window._mqChangeMode ? ' mq-change-toggle--active' : ''}" ${(tab==='weekly'?m.weekly.changeUsed:m.daily.changeUsed) && !window._mqChangeMode ? 'disabled' : ''} onclick="event.stopPropagation();window._toggleChangeMode()">
                <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 20.75C10.08 20.75 8.23 19.99 6.87 18.63C5.51 17.27 4.75 15.42 4.75 13.5C4.75 11.58 5.51 9.73 6.87 8.37C8.23 7.01 10.08 6.25 12 6.25H14.5C14.9 6.25 15.25 6.6 15.25 7C15.25 7.4 14.9 7.75 14.5 7.75H12C10.86 7.75 9.75 8.09 8.81 8.72C7.86 9.35 7.12 10.25 6.69 11.3C6.25 12.35 6.14 13.51 6.36 14.62C6.58 15.74 7.13 16.76 7.93 17.57C8.74 18.37 9.76 18.92 10.88 19.14C11.99 19.36 13.15 19.25 14.2 18.81C15.25 18.38 16.15 17.64 16.78 16.69C17.41 15.75 17.75 14.64 17.75 13.5C17.75 13.1 18.1 12.75 18.5 12.75C18.9 12.75 19.25 13.1 19.25 13.5C19.25 15.42 18.48 17.26 17.12 18.62C15.76 19.98 13.92 20.75 12 20.75Z"/><path d="M12 10.75C11.6 10.75 11.25 10.4 11.25 10C11.25 9.8 11.33 9.61 11.47 9.47L13.94 7L11.47 4.53C11.18 4.24 11.18 3.76 11.47 3.47C11.76 3.18 12.24 3.18 12.53 3.47L15.53 6.47C15.67 6.61 15.75 6.8 15.75 7C15.75 7.2 15.67 7.39 15.53 7.53L12.53 10.53C12.39 10.67 12.2 10.75 12 10.75Z"/></svg>
                    ${window._mqChangeMode ? 'CANCEL SWAP' : (tab==='weekly'?m.weekly.changeUsed:m.daily.changeUsed) ? 'SWAP USED' : 'SWAP QUEST'}
                </div>
                <div style="font-size:0.42rem;letter-spacing:0.06em;font-weight:normal;opacity:0.5;margin-top:2px;">once per ${tab === 'weekly' ? 'week' : 'day'}</div>
            </button>`;
        const streakPanelEl = document.getElementById('mq-streak-panel');
        if (streakPanelEl) streakPanelEl.innerHTML = streakPanelHtml;

        const bonusBoxHtml = `            <div id="mq-bonus-box" style="padding:14px 16px;background:rgba(255,204,68,0.04);border:1px solid rgba(255,204,68,0.2);border-radius:10px;transition:box-shadow 0.3s,border-color 0.3s;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                    <span style="line-height:0;flex-shrink:0;"><svg viewBox="0 0 24 24" width="22" height="22" fill="white" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 3.66333L20.25 7.7398V17.01L12 21.0865L3.75 17.01V7.7398L12 3.66333ZM5.25 9.41292V16.078L11.25 19.0427V12.3776L5.25 9.41292ZM12.75 12.3776V19.0427L18.75 16.078V9.41292L16.5 10.5247V13.4999L15 14.2499V11.2659L12.75 12.3776ZM17.807 8.20577L15.8527 9.17139C15.8099 9.13606 15.7624 9.10498 15.7106 9.07908L10.1015 6.27454L12 5.33645L17.807 8.20577ZM8.41452 7.1081L14.1871 9.9944L12 11.0751L6.19304 8.20577L8.41452 7.1081Z"/></svg></span>
                    <div style="flex:1;">
                        <div style="font-family:var(--ui-font);font-size:0.95rem;color:#ffcc44;font-weight:bold;">${sbPts} <span style="color:#666;font-weight:normal;font-size:0.6rem;">/ ${MQ_SPECIAL_BOX_CAP}</span></div>
                        <div style="font-size:0.42rem;color:#776633;letter-spacing:0.12em;">BONUS BOX</div>
                    </div>
                </div>
                <div style="height:5px;background:rgba(255,255,255,0.06);overflow:hidden;">
                    <div style="height:100%;width:${sbPct}%;background:linear-gradient(90deg,#aa8800,#ffcc44);transition:width 0.4s;"></div>
                </div>
            </div>
`;
        let bodyHtml = '';
        if (tab === 'daily') {
            const pts = m.daily.pointsToday || 0;
            const allQuests = m.daily.quests || [];
            const secretQ = m.daily.secret;
            // Active = not yet claimed (includes completed-but-unclaimed); Done = fully claimed
            const allActiveQuests = _sortQuests([
                ...allQuests.filter(q => !q.ptsClaimed),
                ...(secretQ && !secretQ.ptsClaimed ? [secretQ] : [])
            ]);
            const allDone = _sortQuests([
                ...allQuests.filter(q => q.ptsClaimed),
                ...(secretQ?.ptsClaimed ? [secretQ] : [])
            ]);
            let cardsHtml = _columnarOrder(allActiveQuests).map(q => {
                const idx = q.tier === 'secret' ? 'secret' : allQuests.indexOf(q);
                return _missionQuestCard(q, idx, false);
            }).join('');
            let completedHtml = '';
            if (allDone.length) {
                completedHtml = `<div class="mq-completed-sep">— COMPLETED —</div>` +
                    `<div class="mq-cards">` + _columnarOrder(allDone).map(q => _missionQuestCard(q, null, false)).join('') + `</div>`;
            }
            bodyHtml = `${_missionProgressBar(pts, MQ_DAILY_MILESTONES, m.daily.claimedMilestones, false)}
            <div class="mq-cards">${cardsHtml}</div>
            ${completedHtml}`;
        } else {
            const pts = m.weekly.points || 0;
            const allMissions = m.weekly.missions || [];
            // Active = not yet claimed; Done = fully claimed, sorted hardest-first
            const activeMissions = _sortQuests(allMissions.filter(wm => !wm.ptsClaimed));
            const doneMissions   = _sortQuests(allMissions.filter(wm => wm.ptsClaimed));
            let cardsHtml = _columnarOrder(activeMissions).map(wm => _missionQuestCard(wm, allMissions.indexOf(wm), true)).join('');
            let completedHtml = '';
            if (doneMissions.length) {
                completedHtml = `<div class="mq-completed-sep">— COMPLETED —</div>` +
                    `<div class="mq-cards">` + _columnarOrder(doneMissions).map(wm => _missionQuestCard(wm, null, true)).join('') + `</div>`;
            }
            bodyHtml = `${_missionProgressBar(pts, MQ_WEEKLY_MILESTONES, m.weekly.claimedMilestones, true)}
            <div class="mq-cards">${cardsHtml}</div>
            ${completedHtml}`;
        }

        const body = el.querySelector('#missions-body');
        if (body) {
            if (_isTabSwitch && body.innerHTML.trim()) {
                // Snapshot old content into fixed overlay for exit animation
                const _bRect = body.getBoundingClientRect();
                const _exitEl = document.createElement('div');
                _exitEl.style.cssText = `position:fixed;top:${_bRect.top}px;left:${_bRect.left}px;width:${_bRect.width}px;pointer-events:none;z-index:2000;overflow:hidden;`;
                _exitEl.innerHTML = body.innerHTML;
                document.body.appendChild(_exitEl);
                const _outClass = tab === 'weekly' ? 'mq-tab-slide-out-left' : 'mq-tab-slide-out-right';
                void _exitEl.offsetWidth;
                _exitEl.classList.add(_outClass);
                _exitEl.addEventListener('animationend', () => _exitEl.remove(), { once: true });
            }
            body.innerHTML = bodyHtml;
            const cards = body.querySelector('.mq-cards');
            if (cards) cards.insertAdjacentHTML('beforeend', bonusBoxHtml);
            if (_isTabSwitch) {
                const _inClass = tab === 'weekly' ? 'mq-tab-in-right' : 'mq-tab-in-left';
                body.classList.remove('mq-tab-in-right', 'mq-tab-in-left');
                void body.offsetWidth;
                body.classList.add(_inClass);
                // Remove after slide finishes (longest child: 0.28s)
                setTimeout(() => body.classList.remove(_inClass), 350);
            }
        }
        // Custom tooltip for [data-mqctip] elements in the body (star icon, etc.)
        if (body) {
            let _bTip = document.getElementById('mq-body-tip');
            if (!_bTip) {
                _bTip = document.createElement('div');
                _bTip.id = 'mq-body-tip';
                _bTip.style.cssText = 'display:none;position:fixed;z-index:2300;background:rgba(5,5,20,0.97);border:1px solid rgba(255,204,68,0.3);border-radius:8px;padding:6px 12px;font-size:0.58rem;pointer-events:none;color:#ccc;font-family:inherit;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.6);';
                document.body.appendChild(_bTip);
            }
            body.querySelectorAll('[data-mqctip]').forEach(el => {
                el.addEventListener('mouseenter', e => { _bTip.textContent = el.dataset.mqctip; _bTip.style.display = 'block'; _bTip.style.left = (e.clientX + 14) + 'px'; _bTip.style.top = (e.clientY - 36) + 'px'; });
                el.addEventListener('mouseleave', () => { _bTip.style.display = 'none'; });
                el.addEventListener('mousemove', e => { _bTip.style.left = (e.clientX + 14) + 'px'; _bTip.style.top = (e.clientY - 36) + 'px'; });
            });
        }
        _renderMissionStatsSection();
        el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('mq-tab-active', b.dataset.tab === tab));
        // Clear newVisit for current tab and update dot indicators
        if (tab === 'daily' && m.daily.newVisit) { m.daily.newVisit = false; saveDataToFile(); }
        if (tab === 'weekly' && m.weekly.newVisit) { m.weekly.newVisit = false; saveDataToFile(); }
        el.querySelectorAll('[data-tab]').forEach(b => {
            const isNew = b.dataset.tab === 'daily' ? !!m.daily.newVisit : !!m.weekly.newVisit;
            b.classList.toggle('mq-tab-new', isNew);
            // Dim tab buttons in swap mode so user knows they're locked
            b.classList.toggle('mq-swap-disabled', !!window._mqChangeMode);
            b.style.pointerEvents = window._mqChangeMode ? 'none' : '';
        });
        // Dim BACK button in swap mode
        const backBtn = el.querySelector('.btn-back');
        if (backBtn) {
            backBtn.classList.toggle('mq-swap-disabled', !!window._mqChangeMode);
            backBtn.style.pointerEvents = window._mqChangeMode ? 'none' : '';
        }
        const rulesBtn = el.querySelector('.mq-v4-rules');
        if (rulesBtn) {
            rulesBtn.classList.toggle('mq-swap-disabled', !!window._mqChangeMode);
            rulesBtn.style.pointerEvents = window._mqChangeMode ? 'none' : '';
        }
        _updateMissionCountdown();
        _checkGlowNotifications();
    }

    let _missionCountdownInterval = null;
    function _updateMissionCountdown() {
        const el = document.getElementById('mq-countdown');
        if (!el) return;
        const tab = document.getElementById('missions-overlay')?._mTab || 'daily';
        const now = new Date();
        let ms;
        if (tab === 'daily') {
            const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
            ms = midnight - now;
        } else {
            const dayOfWeek = now.getDay();
            const daysUntil = dayOfWeek === 1 ? 7 : ((1 - dayOfWeek + 7) % 7);
            const nextMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil);
            ms = nextMon - now;
        }
        if (ms <= 0) {
            _checkMissionsRefresh();
            const _ovEl = document.getElementById('missions-overlay');
            if (_ovEl && !_ovEl.classList.contains('hidden')) renderMissionsOverlay(tab);
            return;
        }
        const accentColor = ms <= 600000 ? '#ff3344' : ms <= 3600000 ? '#ff9900' : '#44ff88';
        const totalSec = Math.floor(ms / 1000);
        const d = Math.floor(totalSec / 86400);
        const h = Math.floor((totalSec % 86400) / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const hms = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        const timeStr = d > 0 ? `${d}d ${hms}` : hms;
        el.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;font-family:var(--ui-font);font-size:0.52rem;color:${accentColor};letter-spacing:0.1em;background:${accentColor}10;border:1px solid ${accentColor}33;padding:5px 11px;"><span style="width:6px;height:6px;background:${accentColor};border-radius:50%;box-shadow:0 0 6px ${accentColor};display:inline-block;flex-shrink:0;"></span>RESET IN ${timeStr}</span>`;
    }

    window._mqChangeMode = false;

    window._toggleChangeMode = function() {
        window._mqChangeMode = !window._mqChangeMode;
        renderMissionsOverlay();
    };

    window._exitChangeMode = function() {
        window._mqChangeMode = false;
    };

    window._mqOverlayClick = function(e) {
        if (!window._mqChangeMode) return;
        if (e.target.closest('.mq-card-wrap') || e.target.closest('#mq-change-toggle')) return;
        window._toggleChangeMode();
    };

    window.openMissions = function() {
        if (!saveData.missions) saveData.missions = _defaultMissions();
        _checkMissionsRefresh();
        window._mqChangeMode = false;
        renderMissionsOverlay('daily');
        const _mqEl = document.getElementById('missions-overlay');
        _mqEl.classList.remove('hidden');
        _animateIn(_mqEl, 'anim-in-right');
        _updateMissionCountdown();
        if (_missionCountdownInterval) clearInterval(_missionCountdownInterval);
        _missionCountdownInterval = setInterval(_updateMissionCountdown, 1000);
    };
    window.closeMissions = function() {
        if (window._mqChangeMode) return;
        const _mEl = document.getElementById('menu-overlay');
        _animateOut(document.getElementById('missions-overlay'), 'anim-out-right', function() {
            if (_missionCountdownInterval) { clearInterval(_missionCountdownInterval); _missionCountdownInterval = null; }
        });
        if (_mEl && !_mEl.classList.contains('hidden')) _animateIn(_mEl, 'anim-in-left');
    };
    window.renderMissionsOverlay = renderMissionsOverlay;

    function _mqConfirm(title, msg, note, onOk) {
        const ov = document.getElementById('mq-confirm-overlay');
        if (!ov) { onOk(); return; }
        document.getElementById('mq-confirm-title').textContent = title;
        document.getElementById('mq-confirm-msg').textContent = msg;
        document.getElementById('mq-confirm-note').textContent = note;
        ov.classList.remove('hidden');
        const inner = ov.querySelector('div');
        _animateIn(inner, 'anim-in-down');
        const ok = document.getElementById('mq-confirm-ok');
        const cancel = document.getElementById('mq-confirm-cancel');
        const close = (cb) => {
            inner.classList.add('anim-out-down');
            inner.addEventListener('animationend', function() {
                inner.classList.remove('anim-out-down');
                ov.classList.add('hidden');
                cb && cb();
            }, { once: true });
        };
        ok.onclick = () => close(onOk);
        cancel.onclick = () => close();
    }

    window._changeMission = function(index, isWeekly) {
        if (!saveData.missions) return;
        const period = isWeekly ? 'week' : 'day';
        _mqConfirm(
            'CHANGE MISSION?',
            'This will replace the selected mission with a new one of the same tier.',
            `You can only use this once per ${period}.`,
            () => {
                const m = saveData.missions;
                if (isWeekly) {
                    if (m.weekly.changeUsed) return;
                    const missions = m.weekly.missions;
                    const eligible = missions.map((wm,i) => i).filter(i => !missions[i].completed);
                    if (!eligible.length) return;
                    const idx = (typeof index === 'number' && index >= 0 && index < missions.length && !missions[index].completed)
                        ? index : eligible[Math.floor(Math.random() * eligible.length)];
                    const tier = missions[idx].tier;
                    const existingIds = new Set(missions.map(wm => wm.id));
                    existingIds.delete(missions[idx].id);
                    const pool = _shuffleArr(WEEKLY_MISSION_POOL.filter(p => p.tier === tier && !existingIds.has(p.id)));
                    if (!pool.length) return;
                    const mult = _missionRankMult();
                    const _ct = _niceRound(pool[0].target * (['maxSpeed', 'maxCombo'].includes(pool[0].metric) ? 1 : mult));
                    missions[idx] = { ...pool[0], target: _ct, progress: 0, completed: false, ptsClaimed: false, desc: _makeMissionDesc(pool[0].metric, pool[0].desc, _ct) };
                    m.weekly.changeUsed = true;
                } else {
                    if (m.daily.changeUsed) return;
                    const quests = m.daily.quests;
                    const eligible = quests.map((q,i) => i).filter(i => !quests[i].completed);
                    if (!eligible.length) return;
                    const idx = (typeof index === 'number' && index >= 0 && index < quests.length && !quests[index].completed)
                        ? index : eligible[Math.floor(Math.random() * eligible.length)];
                    const tier = quests[idx].tier;
                    const existingIds = new Set(quests.map(q => q.id));
                    existingIds.delete(quests[idx].id);
                    const pool = _shuffleArr(DAILY_QUEST_POOL.filter(p => p.tier === tier && !existingIds.has(p.id)));
                    if (!pool.length) return;
                    const mult = _missionRankMult();
                    const _ct = _niceRound(pool[0].target * (['maxSpeed', 'maxCombo'].includes(pool[0].metric) ? 1 : mult));
                    quests[idx] = { ...pool[0], target: _ct, progress: 0, completed: false, ptsClaimed: false, desc: _makeMissionDesc(pool[0].metric, pool[0].desc, _ct) };
                    m.daily.changeUsed = true;
                }
                saveDataToFile();
                window._exitChangeMode();
                renderMissionsOverlay();
            }
        );
    };

    function _autoClaimMissions(isWeekly) {
        const m = saveData.missions;
        const period = isWeekly ? m.weekly : m.daily;
        const quests = isWeekly ? (period.missions || []) : [...(period.quests || []), period.secret].filter(Boolean);
        let recovered = false;
        quests.forEach(q => {
            if (q.completed && !q.ptsClaimed) {
                window._claimQuestPts(q.id, isWeekly, null, null, true);
                recovered = true;
            }
        });
        (isWeekly ? MQ_WEEKLY_MILESTONES : MQ_DAILY_MILESTONES).forEach(ms => {
            if ((isWeekly ? period.points : period.pointsToday) >= ms.pts && !period.claimedMilestones.includes(ms.pts)) {
                window._claimMissionMilestone(ms.pts, isWeekly, true);
                recovered = true;
            }
        });
        if ((m.weekly.pendingUniversalParts || 0) > 0) {
            window._claimWeeklyUniversalParts(true);
            recovered = true;
        }
        return recovered;
    }

    window._claimMissionMilestone = function(pts, isWeekly, silent = false) {
        if (!saveData.missions) return;
        const m = saveData.missions;
        const milestones = isWeekly ? MQ_WEEKLY_MILESTONES : MQ_DAILY_MILESTONES;
        const ms = milestones.find(x => x.pts === pts);
        if (!ms) return;
        const claimed = isWeekly ? m.weekly.claimedMilestones : m.daily.claimedMilestones;
        if (claimed.includes(pts)) return;
        const currentPts = isWeekly ? (m.weekly.points || 0) : (m.daily.pointsToday || 0);
        if (currentPts < pts) return;
        claimed.push(pts);
        if (m.weekly) m.weekly.hitAnyMilestone = true;
        const r = ms.reward;
        const rewards = [];
        if (r.type === 'parts') {
            for (let i = 0; i < r.amount; i++) {
                const items = _getAllPartsItems();
                if (!items.length) {
                    addUniversalParts(1);
                    rewards.push({ icon:'⭐', label:'+1 Universal Part', desc:'All items collected', rarity:'rare' });
                    continue;
                }
                const item = items[Math.floor(Math.random() * items.length)];
                if ((saveData.parts?.[item.key] || 0) >= _getItemCost(item.key)) {
                    addUniversalParts(0.2);
                    rewards.push({ icon:'⭐', label:'+0.2 Universal Parts', desc:`Duplicate: ${item.key}`, rarity:'rare' });
                } else {
                    addPartsToItem(item.key, 1);
                    rewards.push({ icon:'🧩', label:`+1 Part: ${item.key}`, desc:`${saveData.parts[item.key]}/${_getItemCost(item.key)} parts`, rarity:'common' });
                }
            }
        }
        saveDataToFile();
        if (!silent) _showMilestoneRewardBox(ms, isWeekly, rewards);
    };

    window._claimWeeklyUniversalParts = function(silent = false) {
        if (!saveData.missions?.weekly) return;
        const pending = saveData.missions.weekly.pendingUniversalParts || 0;
        if (pending <= 0) return;
        saveData.missions.weekly.pendingUniversalParts = 0;
        saveData.universalParts = (saveData.universalParts || 0) + pending;
        saveDataToFile();
        if (silent) return;
        _showMissionReward(`+${pending} Universal Part${pending !== 1 ? 's' : ''}!`);
        renderMissionsOverlay('weekly');
        _checkGlowNotifications();
    };

    window._claimQuestPts = function(questId, isWeekly, color, btnEl, silent = false) {
        if (!saveData.missions) return;
        const m = saveData.missions;
        let q;
        if (isWeekly) {
            q = m.weekly.missions?.find(wm => wm.id === questId);
        } else {
            q = m.daily.quests?.find(dq => dq.id === questId);
            if (!q && m.daily.secret?.id === questId) q = m.daily.secret;
        }
        if (!q || !q.completed || q.ptsClaimed) return;
        q.ptsClaimed = true;
        const pts = q.pts;
        if (isWeekly) {
            m.weekly.points = (m.weekly.points || 0) + pts;
        } else {
            m.daily.pointsToday = (m.daily.pointsToday || 0) + pts;
            // Sync daily pts delta to weekly bar
            const today = _missionDateKey();
            if (!m.weekly.dailyPtsLog) m.weekly.dailyPtsLog = {};
            const _cur = m.daily.pointsToday;
            const _prev = m.daily.ptsTrackedForWeekly || 0;
            const _delta = _cur - _prev;
            if (_delta > 0) {
                m.daily.ptsTrackedForWeekly = _cur;
                m.weekly.points = (m.weekly.points || 0) + _delta;
                m.weekly.dailyPtsLog[today] = (m.weekly.dailyPtsLog[today] || 0) + _delta;
            }
        }
        // Golden zone check
        { const _wPts = m.weekly.points || 0;
          const _above = Math.max(0, _wPts - MQ_WEEKLY_GOLDEN_THRESHOLD);
          const _newParts = _above - (m.weekly.universalPtsTracked || 0);
          if (_newParts > 0) {
              m.weekly.universalPtsTracked = _above;
              m.weekly.pendingUniversalParts = (m.weekly.pendingUniversalParts || 0) + _newParts;
          } }
        // Excess daily pts → bonus box
        let _bonusBoxDelta = 0;
        if (!isWeekly) {
            if (!m.specialBox) m.specialBox = { pts: 0, excessTracked: 0 };
            const _lastMS = MQ_DAILY_MILESTONES[MQ_DAILY_MILESTONES.length - 1].pts;
            const _newExcess = Math.max(0, (m.daily.pointsToday || 0) - _lastMS);
            _bonusBoxDelta = _newExcess - (m.specialBox.excessTracked || 0);
            if (_bonusBoxDelta > 0) {
                m.specialBox.excessTracked = _newExcess;
                m.specialBox.pts = (m.specialBox.pts || 0) + _bonusBoxDelta;
                if (m.specialBox.pts >= MQ_SPECIAL_BOX_CAP) {
                    m.specialBox.pts -= MQ_SPECIAL_BOX_CAP;
                    saveData.universalParts = (saveData.universalParts || 0) + 5;
                    if (!silent) _showMissionReward('+5 Universal Parts — Bonus Box!');
                }
            }
        }
        m.stats.totalPts = (m.stats.totalPts || 0) + pts;
        // Capture button position BEFORE re-render destroys it
        const _fromRect = btnEl ? btnEl.getBoundingClientRect() : null;
        saveDataToFile();
        if (silent) return;
        // Re-render immediately so correct pts are visible even if Chrome live-reloads
        renderMissionsOverlay(isWeekly ? 'weekly' : 'daily');
        _checkGlowNotifications();
        // Animations are purely visual (data already committed above)
        const _bonusDeltaCapture = _bonusBoxDelta;
        if (_fromRect) {
            _flyPtsToBar(pts, _fromRect, color || '#4499ff', isWeekly, function() {
                if (_bonusDeltaCapture > 0) {
                    setTimeout(() => _flyPtsToBox(_bonusDeltaCapture), 150);
                }
            });
        }
    };

    function _flyPtsToBar(pts, fromEl, color, isWeekly, onDone) {
        const fromRect = (fromEl && typeof fromEl.getBoundingClientRect === 'function') ? fromEl.getBoundingClientRect() : fromEl;
        // Find the progress bar pts number (big number at top of bar)
        const barEl = document.querySelector('.mq-pb-wrap');
        if (!barEl) { onDone && onDone(); return; }
        const barRect = barEl.getBoundingClientRect();
        const destX = barRect.left + barRect.width * 0.12;
        const destY = barRect.top + 14;

        const flyEl = document.createElement('div');
        flyEl.className = 'mq-fly-pts';
        flyEl.textContent = `+${pts}`;
        flyEl.style.left = `${fromRect.left + fromRect.width / 2}px`;
        flyEl.style.top  = `${fromRect.top + fromRect.height / 2}px`;
        flyEl.style.color = color;
        flyEl.style.textShadow = `0 0 10px ${color}`;
        flyEl.style.opacity = '1';
        document.body.appendChild(flyEl);

        requestAnimationFrame(() => requestAnimationFrame(() => {
            flyEl.style.left = `${destX}px`;
            flyEl.style.top  = `${destY}px`;
            flyEl.style.fontSize = '0.55rem';
            flyEl.style.opacity = '0';
        }));

        setTimeout(() => {
            flyEl.remove();
            // Flash the progress bar
            if (barEl) {
                barEl.style.transition = 'filter 0.2s';
                barEl.style.filter = `drop-shadow(0 0 6px ${color})`;
                setTimeout(() => { barEl.style.filter = ''; }, 350);
            }
            onDone && onDone();
        }, 580);
    }

    function _flyPtsToBox(delta) {
        const barEl = document.querySelector('.mq-pb-wrap');
        const boxEl = document.getElementById('mq-bonus-box');
        if (!barEl || !boxEl) return;
        const fromRect = barEl.getBoundingClientRect();
        const toRect   = boxEl.getBoundingClientRect();

        const flyEl = document.createElement('div');
        flyEl.className = 'mq-fly-pts';
        flyEl.textContent = `+${delta}`;
        flyEl.style.left   = `${fromRect.left + fromRect.width * 0.12}px`;
        flyEl.style.top    = `${fromRect.top + 14}px`;
        flyEl.style.color  = '#ffcc44';
        flyEl.style.textShadow = '0 0 10px #ffcc44';
        flyEl.style.opacity = '1';
        document.body.appendChild(flyEl);

        requestAnimationFrame(() => requestAnimationFrame(() => {
            flyEl.style.left    = `${toRect.left + toRect.width / 2}px`;
            flyEl.style.top     = `${toRect.top + toRect.height / 2}px`;
            flyEl.style.fontSize = '0.55rem';
            flyEl.style.opacity = '0';
        }));

        setTimeout(() => {
            flyEl.remove();
            if (boxEl) {
                boxEl.style.transition = 'box-shadow 0.15s, border-color 0.15s';
                boxEl.style.boxShadow = '0 0 16px rgba(255,204,68,0.6), inset 0 0 10px rgba(255,204,68,0.1)';
                boxEl.style.borderColor = 'rgba(255,204,68,0.7)';
                setTimeout(() => {
                    boxEl.style.boxShadow = '';
                    boxEl.style.borderColor = '';
                }, 500);
            }
        }, 580);
    }

    function _showMissionReward(label) {
        const el = document.getElementById('missions-overlay');
        if (!el) return;
        const banner = document.createElement('div');
        banner.className = 'mq-reward-banner';
        banner.textContent = `Claimed: ${label}`;
        el.appendChild(banner);
        setTimeout(() => banner.classList.add('mq-reward-show'), 10);
        setTimeout(() => { banner.classList.remove('mq-reward-show'); setTimeout(() => banner.remove(), 400); }, 2200);
    }

    function _showMilestoneRewardBox(ms, isWeekly, rewards) {
        const color = isWeekly ? '#ff9900' : '#44ff88';
        const bgColor = isWeekly ? 'rgba(255,153,0,0.1)' : 'rgba(68,255,136,0.1)';
        const RARITY_COLS = { common:'#4caf50', rare:'#4499ff', epic:'#9932cc', legendary:'#ff9900', mythic:'#cc1111' };
        const overlay = document.createElement('div');
        overlay.className = 'lb-reward-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Earned rewards');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:3200;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
        const panel = document.createElement('div');
        panel.style.cssText = `background:rgba(5,5,20,0.98);border:1px solid ${color}44;border-radius:16px;padding:24px 20px;max-width:380px;width:100%;text-align:center;max-height:90vh;overflow-y:auto;`;
        const typeLabel = isWeekly ? 'WEEKLY MILESTONE' : 'DAILY MILESTONE';
        panel.innerHTML = `
            <div style="font-size:0.55rem;letter-spacing:3px;color:#666;margin-bottom:4px;font-family:var(--ui-font);">${typeLabel}</div>
            <div style="font-size:0.85rem;font-weight:bold;color:${color};font-family:var(--ui-font);letter-spacing:1px;margin-bottom:2px;">${ms.pts} POINTS</div>
            <div style="font-size:0.55rem;color:#555;margin-bottom:16px;">Milestone reached!</div>
        `;
        const preOpen = document.createElement('div');
        preOpen.innerHTML = `
            <svg viewBox="0 0 64 64" width="80" height="80" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:8px auto;display:block;filter:drop-shadow(0 0 14px ${color}66);">
                <rect x="8" y="28" width="48" height="28" rx="3"/>
                <path d="M8 36h48"/>
                <path d="M32 8c0 0-8-4-12 0s-4 12 0 12h24c4 0 4-8 0-12s-12 0-12 0z"/>
                <line x1="32" y1="20" x2="32" y2="36"/>
                <line x1="32" y1="42" x2="32" y2="56"/>
            </svg>
            <div style="font-size:0.65rem;color:#888;margin-bottom:16px;">${ms.label}</div>
            <button id="ms-open-btn" style="font-family:var(--ui-font);font-size:0.7rem;letter-spacing:2px;padding:10px 28px;border-radius:10px;border:1px solid ${color};background:${bgColor};color:${color};cursor:pointer;transition:all 0.2s;">OPEN BOX</button>
        `;
        panel.appendChild(preOpen);
        const rewardsDiv = document.createElement('div');
        rewardsDiv.style.display = 'none';
        const grid = document.createElement('div');
        grid.className = 'lb-reward-grid';
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;';
        rewards.forEach(rw => {
            const card = document.createElement('div');
            card.className = 'lb-reward-card';
            const rc = RARITY_COLS[rw.rarity] || '#aaa';
            card.style.cssText = `background:rgba(255,255,255,0.04);border:1px solid ${rc}44;border-radius:8px;padding:8px 4px;text-align:center;opacity:0;transform:scale(0.8);transition:opacity 0.25s, transform 0.25s;`;
            card.innerHTML = `<div style="font-size:1.3rem;margin-bottom:4px;">${rw.icon}</div><div style="font-size:0.58rem;color:${rc};font-weight:bold;line-height:1.3;">${rw.label}</div><div style="font-size:0.52rem;color:#555;margin-top:2px;">${rw.desc}</div><div class="lb-reward-rarity">${rw.rarity}</div>`;
            grid.appendChild(card);
        });
        rewardsDiv.appendChild(grid);
        const claimBtn = document.createElement('button');
        claimBtn.style.cssText = `font-family:var(--ui-font);font-size:0.7rem;letter-spacing:2px;padding:10px 28px;border-radius:10px;border:1px solid ${color};background:${bgColor};color:${color};cursor:pointer;box-shadow:0 0 10px ${color}40;`;
        claimBtn.textContent = 'CLAIM';
        rewardsDiv.appendChild(claimBtn);
        panel.appendChild(rewardsDiv);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        panel.querySelector('#ms-open-btn').onclick = () => {
            preOpen.style.display = 'none';
            rewardsDiv.style.display = 'block';
            Array.from(grid.children).forEach((card, i) => {
                card.style.transitionDelay = `${i * 0.1}s`;
                setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 20);
            });
        };
        claimBtn.onclick = () => {
            overlay.remove();
            renderMissionsOverlay(isWeekly ? 'weekly' : 'daily');
            _checkGlowNotifications();
        };
    }

    // ===== PLAYLIST PANEL =====
    function openPlaylistPanel() {
        _initTrackCatalog().then(_renderPlaylistPanel);
        _renderPlaylistPanel();
        const _plEl = document.getElementById('playlist-overlay');
        _plEl.classList.remove('hidden');
        _animateIn(_plEl, 'anim-in-right');
    }
    function closePlaylistPanel() {
        const _mEl = document.getElementById('menu-overlay');
        _animateOut(document.getElementById('playlist-overlay'), 'anim-out-right');
        if (_mEl && !_mEl.classList.contains('hidden')) _animateIn(_mEl, 'anim-in-left');
    }
    function _renderPlaylistPanel() {
        const el = document.getElementById('playlist-panel-content');
        if (!el) return;
        if (_trackPool.size === 0) {
            el.innerHTML = `<div style="font-size:0.6rem;color:#555;padding:20px 2px;font-style:italic;">Loading tracks…</div>`;
            return;
        }
        const esc = s => s.replace(/'/g, "\\'");
        const svgCheck = `<svg viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 5 4 8 8.5 2"/></svg>`;
        const menuPlaylist = _getPlaylist('menu');
        const gamePlaylist = _getPlaylist('game');
        const actionPlaylist = _getPlaylist('action');
        const allNames = [..._trackPool.keys()].sort((a, b) => a.localeCompare(b));
        const TAG_COLORS = { chill:'#4488cc', electronic:'#44bb88', retro:'#cc8844', intense:'#cc4444', upbeat:'#aa44cc' };
        // Fixed column widths so header and rows always align
        const COL = 'grid-template-columns:1fr 44px 44px 130px;';
        const GAP = 'gap:0;';
        const mkCb = (on, color, ctx, name) => {
            const border = on ? color : '#333';
            const bg = on ? color + '22' : 'transparent';
            return `<button type="button" aria-label="${ctx} playlist: ${name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" aria-pressed="${on}" onclick="window.moveTrack('${ctx}','${esc(name)}',${!on})" style="width:20px;height:20px;border-radius:4px;border:1.5px solid ${border};background:${bg};cursor:pointer;display:flex;align-items:center;justify-content:center;color:${on?color:'transparent'};flex-shrink:0;">${on?svgCheck:''}</button>`;
        };
        const header = `<div data-pl-row style="position:relative;display:grid;${COL}${GAP}align-items:center;padding:0 0 8px 0;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:2px;cursor:default;">
            <div style="font-size:0.5rem;color:#444;letter-spacing:1.5px;">TRACK</div>
            <div style="font-size:0.5rem;color:#4488ff;letter-spacing:1px;text-align:center;">MENU</div>
            <div style="font-size:0.5rem;color:#44aa55;letter-spacing:1px;text-align:center;">GAME</div>
            <div style="font-size:0.5rem;color:#444;letter-spacing:1px;padding-left:16px;padding-right:82px;">TAGS</div>
            <button onclick="window.resetPlaylist()" style="position:absolute;right:0;top:calc(50% - 4px);transform:translateY(-50%);font-size:0.55rem;padding:3px 9px;background:rgba(255,60,60,0.08);border:1px solid rgba(255,60,60,0.35);border-radius:5px;color:#ff6666;cursor:pointer;font-family:inherit;white-space:nowrap;">↺ Reset</button>
        </div>`;
        const rows = allNames.map(name => {
            const entry = _trackPool.get(name);
            const artist = entry.artist || '';
            const tags = entry.tags;
            const isPlaying = name === _nowPlayingName;
            const isAction = _actionFileNames.includes(name) || (tags.includes('action') && !_menuFileNames.includes(name) && !_gameFileNames.includes(name));
            const menuOn = menuPlaylist.includes(name);
            const gameOn = isAction ? actionPlaylist.includes(name) : gamePlaylist.includes(name);
            const gameCtx = isAction ? 'action' : 'game';
            const col = isPlaying ? 'var(--primary)' : '#ccc';
            const playMark = isPlaying ? `<span style="color:var(--primary);margin-right:4px;font-size:0.55rem;">▶</span>` : '';
            const tagChips = [...tags].sort().map(t => {
                const tc = TAG_COLORS[t] || '#888';
                return `<span style="font-size:0.47rem;padding:2px 5px;border-radius:3px;background:${tc}20;border:1px solid ${tc}55;color:${tc};letter-spacing:0.3px;white-space:nowrap;">${t}</span>`;
            }).join('');
            return `<div style="display:grid;${COL}${GAP}align-items:center;padding:7px 0;">
                <div onclick="window.playTrackInPlaylist('${esc(name)}')" style="min-width:0;padding-right:8px;text-align:left;cursor:pointer;" title="Play now">
                    <div style="font-size:0.63rem;color:${col};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${playMark}${name}</div>
                    ${artist ? `<div style="font-size:0.53rem;color:#444;margin-top:1px;">by ${artist}</div>` : ''}
                </div>
                <div style="display:flex;justify-content:center;align-items:center;">${mkCb(menuOn,'#4488ff','menu',name)}</div>
                <div style="display:flex;justify-content:center;align-items:center;">${mkCb(gameOn,'#44aa55',gameCtx,name)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center;padding-left:16px;">${tagChips}</div>
            </div>`;
        }).join('');
        let _plTip = document.getElementById('pl-row-tip');
        if (!_plTip) {
            _plTip = document.createElement('div');
            _plTip.id = 'pl-row-tip';
            _plTip.style.cssText = 'display:none;position:fixed;z-index:3000;background:rgba(5,5,20,0.97);border:1px solid color-mix(in srgb, var(--primary) 30%, transparent);border-radius:8px;padding:8px 12px;font-size:0.65rem;color:#bbb;line-height:1.6;pointer-events:none;font-family:inherit;max-width:260px;';
            _plTip.innerHTML = '<b style="color:#4488ff;">MENU</b> — plays in the background during menus, settings and transition screens.<br><b style="color:#44aa55;">GAME</b> — plays during gameplay.<br><span style="color:#666;font-size:0.58rem;">Click a track name to play it immediately.</span>';
            document.body.appendChild(_plTip);
        }
        el.innerHTML = header + (rows || `<div style="font-size:0.58rem;color:#555;padding:12px 4px;">No tracks found</div>`);
        el.querySelectorAll('[data-pl-row]').forEach(row => {
            row.addEventListener('mouseenter', ev => { _plTip.style.display = 'block'; _plTip.style.left = (ev.clientX + 14) + 'px'; _plTip.style.top = (ev.clientY - 10) + 'px'; });
            row.addEventListener('mousemove', ev => { _plTip.style.left = (ev.clientX + 14) + 'px'; _plTip.style.top = (ev.clientY - 10) + 'px'; });
            row.addEventListener('mouseleave', () => { _plTip.style.display = 'none'; });
        });
    }
    window.openPlaylistPanel = openPlaylistPanel;
    window.closePlaylistPanel = closePlaylistPanel;
    window.playTrackInPlaylist = function(name) {
        if (_currentMode !== 'menu' || !_trackPool.has(name)) return;
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        musicPlaying = true;
        const idx = _getPlaylist('menu').indexOf(name);
        if (idx >= 0) _currentMenuTrackIdx = idx;
        _menuShuffleQueue = [];
        _playMenuTrack(name);
    };
    window.resetPlaylist = function() {
        delete saveData.menuPlaylist;
        delete saveData.gamePlaylist;
        delete saveData.actionPlaylist;
        saveDataToFile();
        _renderPlaylistPanel();
    };

    function toggleTrack(mode, name, enabled) {
        const key = mode === 'menu' ? 'enabledMenuTracks' : 'enabledGameTracks';
        const allTracks = mode === 'menu' ? _menuFileNames : _gameFileNames;
        if (!settings[key]) settings[key] = [...allTracks];
        if (enabled) {
            if (!settings[key].includes(name)) settings[key].push(name);
        } else {
            settings[key] = settings[key].filter(t => t !== name);
            if (settings[key].length === 0) settings[key] = [...allTracks]; // can't disable all
            // If this track is currently playing in menu mode, skip to a random enabled one
            if (mode === 'menu' && _nowPlayingName === name && _menuSourceNode) {
                const nextEnabled = settings[key];
                const nextName = nextEnabled[Math.floor(Math.random() * nextEnabled.length)];
                const nextIdx = _menuFileNames.indexOf(nextName);
                if (nextIdx >= 0) _playMenuFileTrack(nextIdx);
            }
        }
        saveSettings();
    }

    function openModeSelect() {
        if (window._timeBlocked) return;
        const _msEl = document.getElementById('mode-select-overlay');
        _msEl.classList.remove('hidden');
        _animateIn(_msEl, 'anim-in-up');
        const fc = document.getElementById('fun-cols'); if (fc) fc.value = funModeConfig.cols;
        const fr = document.getElementById('fun-rows'); if (fr) fr.value = funModeConfig.rows;
        const _speedMap2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        const fs = document.getElementById('fun-speed'); if (fs) fs.value = _speedMap2.indexOf(funModeConfig.startSpeed) + 1 || 1;
        updateFunConfigDisplay();

        // Check unlock levels
        const playerLevel = getLevelInfo(saveData.totalXP).level;
        const funCard = document.querySelector('.mode-card[data-mode="fun"]');
        if (funCard) {
            const locked = playerLevel < 11;
            funCard.style.pointerEvents = locked ? 'none' : '';
            funCard.style.position = 'relative';
            funCard.style.overflow = locked ? 'hidden' : '';
            // Hide children content when locked so nothing leaks through
            Array.from(funCard.children).forEach(child => {
                if (!child.classList.contains('lock-overlay')) {
                    child.style.visibility = locked ? 'hidden' : '';
                }
            });
            funCard.style.boxShadow = locked ? 'inset 0 0 0 1px rgba(255,255,255,0.12)' : '';
            let lockOv = funCard.querySelector('.lock-overlay');
            if (locked) {
                if (!lockOv) {
                    lockOv = document.createElement('div');
                    lockOv.className = 'lock-overlay';
                    lockOv.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-start;padding-left:16px;gap:5px;pointer-events:none;';
                    lockOv.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg><span style="font-size:0.65rem;color:rgba(255,255,255,0.7);font-weight:bold;margin-left:4px;">Unlocks at <span style="color:#e0e0e0">Silver I</span></span>`;
                    funCard.appendChild(lockOv);
                }
            } else if (lockOv) { lockOv.remove(); funCard.style.boxShadow = ''; funCard.style.overflow = ''; }
        }

        // Set up options panel checkboxes and lock states
        _updateModeOptionsPanel(playerLevel);

        // If current mode is locked, fall back to normal
        if (currentGameMode === 'fun' && playerLevel < 21) currentGameMode = 'normal';
        if (currentGameMode === 'advanced') currentGameMode = 'normal'; // advanced removed
        selectMode(currentGameMode || 'normal');
    }
    function closeModeSelect() {
        _animateOut(document.getElementById('mode-select-overlay'), 'anim-out-down');
    }
    function selectMode(mode) {
        currentGameMode = mode;
        document.querySelectorAll('.mode-card').forEach(c => c.classList.toggle('selected', c.dataset.mode === mode));
        const funConfig = document.getElementById('fun-mode-config');
        if (funConfig) funConfig.style.display = mode === 'fun' ? '' : 'none';
        const optPanel = document.getElementById('mode-options-panel');
        if (optPanel) optPanel.style.display = '';
        // Hide multiplier box in fun mode (keep space so layout doesn't shift)
        const multBox = document.getElementById('mode-xp-mult-box');
        if (multBox) multBox.style.visibility = mode === 'fun' ? 'hidden' : 'visible';
        // Hide/show only the percentage text (not option names)
        document.querySelectorAll('.opt-pct').forEach(el => {
            el.style.visibility = mode === 'fun' ? 'hidden' : 'visible';
        });
        _updateModeXpMultDisplay();
    }
    function updateFunConfigDisplay() {
        const _speedMap = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        const fc = document.getElementById('fun-cols'); const fr = document.getElementById('fun-rows'); const fs = document.getElementById('fun-speed');
        if (fc) { funModeConfig.cols = parseInt(fc.value); document.getElementById('fun-cols-val').textContent = fc.value; }
        if (fr) { funModeConfig.rows = parseInt(fr.value); document.getElementById('fun-rows-val').textContent = fr.value; }
        if (fs) {
            const idx = parseInt(fs.value) - 1;
            funModeConfig.startSpeed = _speedMap[Math.min(idx, _speedMap.length - 1)];
            const spd = funModeConfig.startSpeed;
            document.getElementById('fun-speed-val').textContent = spd;
        }
        localStorage.setItem('tetrisRPG_funConfig', JSON.stringify(funModeConfig));
    }
    function _calcModeXpMult() {
        let m = 1.0;
        if (settings.optMirror) m += 0.2;
        if (settings.optNoNext) m += 0.1;
        if (settings.optHold)   m -= 0.2;
        if (settings.opt3Next)  m -= 0.1;
        if (settings.optGhost)  m -= 0.2;
        return Math.max(0.1, m);
    }
    function _updateModeXpMultDisplay() {
        const val = document.getElementById('mode-xp-mult-val');
        const tags = document.getElementById('mode-xp-mult-tags');
        if (!val) return;
        const m = currentGameMode === 'fun' ? 1.0 : _calcModeXpMult();
        const pct = Math.round(m * 100);
        val.innerText = pct + '%';
        val.style.color = m > 1 ? '#66ff99' : m < 1 ? '#ff8866' : '#00ffc8';
        if (tags) {
            const lines = [];
            if (currentGameMode !== 'fun') {
                if (settings.optMirror) lines.push('Mirror +20%');
                if (settings.optNoNext) lines.push('No Next +10%');
                if (settings.optHold)   lines.push('Hold −20%');
                if (settings.opt3Next)  lines.push('3-Next −10%');
                if (settings.optGhost)  lines.push('Ghost −20%');
            }
            tags.innerText = lines.join('\n');
        }
    }
    function _updateModeOptionsPanel(playerLevel) {
        const lvl = playerLevel !== undefined ? playerLevel : getLevelInfo(saveData.totalXP).level;
        // Force-off options that are locked by level
        let _changed = false;
        if (lvl < 11  && settings.optGhost)  { settings.optGhost  = false; _changed = true; }
        if (lvl < 11  && settings.optMirror) { settings.optMirror = false; _changed = true; }
        if (lvl < 21  && settings.optHold)   { settings.optHold   = false; _changed = true; }
        if (lvl < 31  && settings.opt3Next)  { settings.opt3Next  = false; _changed = true; }
        if (lvl < 31  && settings.optNoNext) { settings.optNoNext = false; _changed = true; }
        if (_changed) saveSettings();
        // Sync checkbox states
        const mirrorEl  = document.getElementById('opt-mirror');
        const holdEl    = document.getElementById('opt-hold');
        const nextEl    = document.getElementById('opt-3next');
        const ghostEl   = document.getElementById('opt-ghost');
        const noNextEl  = document.getElementById('opt-nonext');
        if (mirrorEl)  mirrorEl.checked  = !!settings.optMirror;
        if (holdEl)    holdEl.checked    = !!settings.optHold;
        if (nextEl)    nextEl.checked    = !!settings.opt3Next;
        if (ghostEl)   ghostEl.checked   = !!settings.optGhost;
        if (noNextEl)  noNextEl.checked  = !!settings.optNoNext;
        // Apply opacity+overlay for locked rows
        const lockDefs = [
            { id:'opt-row-mirror', locked: lvl < 11,  text:'Silver I' },
            { id:'opt-row-ghost',  locked: lvl < 11,  text:'Silver I' },
            { id:'opt-row-hold',   locked: lvl < 21,  text:'Gold I' },
            { id:'opt-row-3next',  locked: lvl < 31,  text:'Emerald I' },
            { id:'opt-row-nonext', locked: lvl < 31,  text:'Emerald I' },
        ];
        lockDefs.forEach(({ id, locked, text }) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.pointerEvents = locked ? 'none' : '';
            // Hide children content when locked — no blurred text visible
            Array.from(el.children).forEach(child => {
                if (!child.classList.contains('lock-overlay')) {
                    child.style.visibility = locked ? 'hidden' : '';
                }
            });
            el.style.boxShadow = locked ? 'inset 0 0 0 1px rgba(255,255,255,0.1)' : '';
            let ov = el.querySelector('.lock-overlay');
            if (locked) {
                if (!ov) {
                    ov = document.createElement('div');
                    ov.className = 'lock-overlay';
                    ov.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-start;padding-left:12px;gap:5px;pointer-events:none;background:rgba(10,10,20,0.85);border-radius:8px;';
                    const _rc = text.startsWith('Silver') ? '#e0e0e0' : text.startsWith('Gold') ? '#ffd700' : text.startsWith('Emerald') ? '#50c878' : 'rgba(255,255,255,0.7)';
                    ov.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg><span style="font-size:0.65rem;color:rgba(255,255,255,0.7);font-weight:bold;margin-left:4px;">Unlocks at <span style="color:${_rc}">${text}</span></span>`;
                    el.appendChild(ov);
                }
            } else if (ov) {
                ov.remove();
                el.style.boxShadow = '';
            }
        });
        // Sort options: unlocked positive first, unlocked negative, then locked by unlock level asc, within same level by pct desc
        const _optContainer = document.querySelector('#mode-options-panel > div:last-child');
        if (_optContainer) {
            const _optRows = Array.from(_optContainer.querySelectorAll('.mode-opt-row'));
            _optRows.sort((a, b) => {
                const aL = !!a.querySelector('.lock-overlay');
                const bL = !!b.querySelector('.lock-overlay');
                if (aL !== bL) return aL ? 1 : -1;
                if (aL && bL) {
                    // Both locked: sort by unlock level ascending
                    const aLvl = parseInt(a.dataset.unlockLvl || '99');
                    const bLvl = parseInt(b.dataset.unlockLvl || '99');
                    if (aLvl !== bLvl) return aLvl - bLvl;
                }
                // Same lock status (or same level): sort by pct descending
                const aP = parseFloat(a.querySelector('.opt-pct')?.textContent) || 0;
                const bP = parseFloat(b.querySelector('.opt-pct')?.textContent) || 0;
                return bP - aP;
            });
            _optRows.forEach(r => _optContainer.appendChild(r));
        }
        // Bind hover tooltips for all rows
        document.querySelectorAll('.mode-opt-row[data-opt-info]').forEach(row => {
            if (!row._tipBound) {
                row._tipBound = true;
                const tip = document.getElementById('mode-opt-tooltip');
                if (!tip) return;
                row.addEventListener('mouseenter', ev => {
                    const info = row.getAttribute('data-opt-info');
                    if (!info) return;
                    tip.textContent = info;
                    tip.style.display = 'block';
                    const tw = tip.offsetWidth || 200, th = tip.offsetHeight || 50;
                    let tx = ev.clientX + 14, ty = ev.clientY - 10;
                    if (tx + tw > window.innerWidth - 10) tx = ev.clientX - tw - 10;
                    if (ty + th > window.innerHeight - 10) ty = window.innerHeight - th - 10;
                    if (ty < 10) ty = 10;
                    tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
                });
                row.addEventListener('mousemove', ev => {
                    const tw = tip.offsetWidth || 200, th = tip.offsetHeight || 50;
                    let tx = ev.clientX + 14, ty = ev.clientY - 10;
                    if (tx + tw > window.innerWidth - 10) tx = ev.clientX - tw - 10;
                    if (ty + th > window.innerHeight - 10) ty = window.innerHeight - th - 10;
                    if (ty < 10) ty = 10;
                    tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
                });
                row.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
            }
        });
        _updateModeXpMultDisplay();
    }
    window.onModeOptionChange = function() {
        const mirrorEl  = document.getElementById('opt-mirror');
        const holdEl    = document.getElementById('opt-hold');
        const nextEl    = document.getElementById('opt-3next');
        const ghostEl   = document.getElementById('opt-ghost');
        const noNextEl  = document.getElementById('opt-nonext');
        if (mirrorEl)  settings.optMirror  = mirrorEl.checked;
        if (holdEl)    settings.optHold    = holdEl.checked;
        if (ghostEl)   settings.optGhost   = ghostEl.checked;
        // Mutual exclusivity: optNoNext and opt3Next
        if (noNextEl && nextEl) {
            const noNextJustEnabled = noNextEl.checked && !settings.optNoNext;
            const nextJustEnabled   = nextEl.checked   && !settings.opt3Next;
            if (noNextJustEnabled && nextEl.checked)   { nextEl.checked = false; }
            if (nextJustEnabled   && noNextEl.checked) { noNextEl.checked = false; }
        }
        if (nextEl)    settings.opt3Next   = nextEl.checked;
        if (noNextEl)  settings.optNoNext  = noNextEl.checked;
        saveSettings();
        _updateModeXpMultDisplay();
    };
    function startSelectedMode() {
        _animateOut(document.getElementById('mode-select-overlay'), 'anim-out-down');
        startGame();
    }

    window.closeAlert = closeAlert;
    window.settingsTab = settingsTab;
    window.resumeGame = resumeGame;
    window.quitGame = quitGame;
    window.startGame = startGame;
    window.openTransferMenu = openTransferMenu;
    window.startExportProcess = startExportProcess;
    window.handleFileImport = handleFileImport;
    window.closeTransferMenu = closeTransferMenu;
    window.resetGameToMenu = resetGameToMenu;
    window.togglePause = togglePause;
    window.openStats = openStats;
    window.closeStats = closeStats;
    window.openSettings = openSettings;
    window.closeSettings = closeSettings;
    window.openInventory = openInventory;
    window.closeInventory = closeInventory;
    window.inventoryTab = inventoryTab;
    window.exchangeBoosters = exchangeBoosters;
    window._openExchangeModal = _openExchangeModal;
    window.onSettingChange = onSettingChange;
    window._cPillSync = _cPillSync;
    window._dStepsSync = _dStepsSync;
    window._eStepChange = _eStepChange;
    window.toggleInstructions = toggleInstructions;
    if (_devMode) {
    window.devSetXP = devSetXP;
    window.devSetXPorLevel = devSetXPorLevel;
    window.devResetDailyGift = devResetDailyGift;
    window.devResetStore = devResetStore;
    window.devResetScores = devResetScores;
    window.devAddLeaderboardScore = devAddLeaderboardScore;
    window.devAddRandomScores = devAddRandomScores;
    window.devAdd250Scores = function() {
        if (!saveData.leaderboard) saveData.leaderboard = [];
        for (let i = 0; i < 250; i++) {
            const score = Math.floor(Math.random() * 50000) + 500;
            const lines = Math.floor(score / 200);
            const blocks = lines * 4 + Math.floor(Math.random() * 50);
            const time = Math.floor(lines * 8 + Math.random() * 60);
            const maxSpeed = Math.min(15, Math.floor(lines / 10) + 1);
            const combo = Math.floor(Math.random() * 8);
            const d = new Date(Date.now() - Math.random() * 30 * 86400000);
            const date = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            saveData.leaderboard.push({ score, date, lines, blocks, time, maxSpeed, xp: score, maxCombo: combo });
        }
        saveData.leaderboard.sort((a, b) => b.score - a.score);
        saveDataToFile();
        customAlert('Added 250 random scores!', 'DEV MODE');
    };
    window.devEditStats = devEditStats;
    window.devUnlockAllAchievements = devUnlockAllAchievements;
    window.devLockAllAchievements = devLockAllAchievements;
    window.devSpawnParachute = function() { _doSpawnParachute(); customAlert('Parachute spawned!', 'DEV MODE'); };
    window.devUnlockShop = function() {
        // Unlock all skins
        const allSkins = ['neon','retro','glass','shadow','outline','holo','journey','gem','bubble','gameboy','monochrome','modern','candy','vim','aerolab','classic','window'];
        saveData.ownedSkins = [...allSkins];
        // Unlock all themes
        const allThemes = Object.keys(THEMES).filter(k => k !== 'default');
        saveData.ownedThemes = [...allThemes];
        // Unlock ghost color
        saveData.ghostColorUnlocked = true;
        // Unlock grid styles
        saveData.ownedGridStyles = Object.keys(GRID_STYLES).filter(k => !GRID_STYLES[k].free);
        // Unlock all palettes
        saveData.ownedPalettes = Object.keys(BLOCK_PALETTES);
        // Unlock all SFX packs
        saveData.ownedSfxPacks = ['default','cyber','retro','zen','arcade'];
        saveDataToFile();
        customAlert('All shop items unlocked!', 'DEV MODE');
    };
    window.devSFXPanel = function() {
        const existing = document.getElementById('sfx-panel-modal');
        if (existing) { existing.remove(); return; }
        const sfxList = [
            { name: 'clear', desc: 'Line clear — ascending chord' },
            { name: 'drop', desc: 'Block placed — deep thump + click' },
            { name: 'levelup', desc: 'Speed increase — ascending square wave' },
            { name: 'click', desc: 'UI click — short sine blip' },
            { name: 'gameover', desc: 'Game over — descending chord' },
            { name: 'unlock', desc: 'Item unlocked — ascending sparkle' },
            { name: 'gift', desc: 'Daily gift claimed — magical chime' },
            { name: 'booster', desc: 'Booster used — power-up whoosh' },
            { name: 'achievement', desc: 'Achievement unlocked — triumphant fanfare' },
            { name: 'rankup', desc: 'XP level up — ascending fanfare' },
            { name: 'newrank', desc: 'New rank reached — grand fanfare with harmonics' },
            { name: 'newrecord', desc: 'Personal best — triumphant 4-note fanfare' },
        ];
        const ov = document.createElement('div');
        ov.id = 'sfx-panel-modal';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `<div style="background:#12121e;border:1px solid rgba(255,50,50,0.3);border-radius:14px;padding:20px;width:min(380px,90vw);max-height:80vh;overflow-y:auto;position:relative;">
            <button id="sfx-panel-close" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#555;font-size:1.1rem;cursor:pointer;">✕</button>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div style="font-size:0.6rem;letter-spacing:2px;color:#ff6666;">🔊 SFX PREVIEW</div>
                <div style="display:flex;gap:4px;">
                    <button class="sfx-pack-tab active" data-pack="a" style="font-size:0.5rem;padding:3px 7px;border-radius:4px;border:1px solid #ff6666;background:rgba(255,100,100,0.15);color:#ff9999;cursor:pointer;font-family:inherit;font-weight:bold;">DEFAULT</button>
                    <button class="sfx-pack-tab" data-pack="b" style="font-size:0.5rem;padding:3px 7px;border-radius:4px;border:1px solid #555;background:rgba(255,255,255,0.05);color:#888;cursor:pointer;font-family:inherit;">CYBER</button>
                    <button class="sfx-pack-tab" data-pack="c" style="font-size:0.5rem;padding:3px 7px;border-radius:4px;border:1px solid #555;background:rgba(255,255,255,0.05);color:#888;cursor:pointer;font-family:inherit;">RETRO</button>
                    <button class="sfx-pack-tab" data-pack="d" style="font-size:0.5rem;padding:3px 7px;border-radius:4px;border:1px solid #555;background:rgba(255,255,255,0.05);color:#888;cursor:pointer;font-family:inherit;">ZEN</button>
                    <button class="sfx-pack-tab" data-pack="e" style="font-size:0.5rem;padding:3px 7px;border-radius:4px;border:1px solid #555;background:rgba(255,255,255,0.05);color:#888;cursor:pointer;font-family:inherit;">ARCADE</button>
                </div>
            </div>
            ${sfxList.map(s => `<div class="sfx-row" data-sfx="${s.name}" style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;">
                <div style="width:28px;height:28px;border-radius:6px;background:rgba(255,100,100,0.1);border:1px solid rgba(255,100,100,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="#ff9999"><polygon points="2,5 5,5 9,2 9,14 5,11 2,11"/><path d="M11 5.5a3 3 0 010 5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M13 3.5a5.5 5.5 0 010 9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
                </div>
                <div>
                    <div style="font-size:0.75rem;color:#fff;font-weight:bold;">${s.name}</div>
                    <div style="font-size:0.6rem;color:#666;">${s.desc}</div>
                </div>
            </div>`).join('')}
        </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
        ov.querySelector('#sfx-panel-close').addEventListener('click', () => ov.remove());
        let _devSfxPack = 'a';
        ov.querySelectorAll('.sfx-pack-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                _devSfxPack = tab.dataset.pack;
                ov.querySelectorAll('.sfx-pack-tab').forEach(t => {
                    const active = t.dataset.pack === _devSfxPack;
                    t.style.borderColor = active ? '#ff6666' : '#555';
                    t.style.background = active ? 'rgba(255,100,100,0.15)' : 'rgba(255,255,255,0.05)';
                    t.style.color = active ? '#ff9999' : '#888';
                    t.style.fontWeight = active ? 'bold' : 'normal';
                    t.classList.toggle('active', active);
                });
            });
        });
        ov.querySelectorAll('.sfx-row').forEach(row => {
            row.addEventListener('click', () => {
                initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
                const n = row.dataset.sfx;
                if (_devSfxPack === 'b') _playSFX_B(n);
                else if (_devSfxPack === 'c') _playSFX_C(n);
                else if (_devSfxPack === 'd') _playSFX_D(n);
                else if (_devSfxPack === 'e') _playSFX_E(n);
                else playSFX(n);
            });
        });
    };
    }
    window.openSfxPackPreview = function() {
        const existing = document.getElementById('sfx-preview-modal');
        if (existing) { existing.remove(); return; }
        const ownedPacks = saveData.ownedSfxPacks || ['default'];
        const packDefs = [
            { id: 'default', label: 'DEFAULT', fn: (n) => { const _origPack = settings.sfxPack; settings.sfxPack = 'default'; playSFX(n); settings.sfxPack = _origPack; } },
            { id: 'cyber', label: 'CYBER', fn: (n) => _playSFX_B(n) },
            { id: 'retro', label: 'RETRO', fn: (n) => _playSFX_C(n) },
            { id: 'zen', label: 'ZEN', fn: (n) => _playSFX_D(n) },
            { id: 'arcade', label: 'ARCADE', fn: (n) => _playSFX_E(n) },
        ].filter(p => ownedPacks.includes(p.id));
        const sfxList = [
            { name: 'clear', desc: 'Line clear' },
            { name: 'drop', desc: 'Block placed' },
            { name: 'levelup', desc: 'Speed increase' },
            { name: 'click', desc: 'UI click' },
            { name: 'gameover', desc: 'Game over' },
            { name: 'unlock', desc: 'Item unlocked' },
            { name: 'gift', desc: 'Daily gift claimed' },
            { name: 'booster', desc: 'Booster used' },
            { name: 'achievement', desc: 'Achievement unlocked' },
            { name: 'rankup', desc: 'XP level up' },
            { name: 'newrank', desc: 'New rank reached' },
        ];
        const ov = document.createElement('div');
        ov.id = 'sfx-preview-modal';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;';
        let _activePack = packDefs[0];
        ov.innerHTML = `<div style="background:#12121e;border:1px solid rgba(0,255,255,0.2);border-radius:14px;padding:20px;width:min(380px,90vw);max-height:80vh;overflow-y:auto;position:relative;">
            <button id="sfx-prev-close" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#555;font-size:1.1rem;cursor:pointer;">✕</button>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div style="font-size:0.6rem;letter-spacing:2px;color:var(--primary);">SFX PACK PREVIEW</div>
                <div id="sfx-prev-tabs" style="display:flex;gap:4px;">
                    ${packDefs.map((p, i) => `<button class="sfx-prev-tab${i===0?' active':''}" data-pack="${p.id}" style="font-size:0.5rem;padding:3px 7px;border-radius:4px;border:1px solid ${i===0?'var(--primary)':'#555'};background:${i===0?'rgba(0,255,255,0.12)':'rgba(255,255,255,0.05)'};color:${i===0?'var(--primary)':'#888'};cursor:pointer;font-family:inherit;${i===0?'font-weight:bold;':''}">${p.label}</button>`).join('')}
                </div>
            </div>
            ${sfxList.map(s => `<div class="sfx-prev-row" data-sfx="${s.name}" style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;border-radius:6px;transition:background 0.15s;">
                <div style="width:28px;height:28px;border-radius:6px;background:rgba(0,255,255,0.08);border:1px solid rgba(0,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="var(--primary)"><polygon points="2,5 5,5 9,2 9,14 5,11 2,11"/><path d="M11 5.5a3 3 0 010 5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M13 3.5a5.5 5.5 0 010 9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
                </div>
                <div>
                    <div style="font-size:0.75rem;color:#fff;font-weight:bold;">${s.name}</div>
                    <div style="font-size:0.6rem;color:#666;">${s.desc}</div>
                </div>
            </div>`).join('')}
        </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) window._closeModal('sfx-preview-modal'); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-down');
        ov.querySelector('#sfx-prev-close').addEventListener('click', () => window._closeModal('sfx-preview-modal'));
        ov.querySelectorAll('.sfx-prev-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const pid = tab.dataset.pack;
                _activePack = packDefs.find(p => p.id === pid) || packDefs[0];
                ov.querySelectorAll('.sfx-prev-tab').forEach(t => {
                    const act = t.dataset.pack === pid;
                    t.style.borderColor = act ? 'var(--primary)' : '#555';
                    t.style.background = act ? 'rgba(0,255,255,0.12)' : 'rgba(255,255,255,0.05)';
                    t.style.color = act ? 'var(--primary)' : '#888';
                    t.style.fontWeight = act ? 'bold' : 'normal';
                    t.classList.toggle('active', act);
                });
            });
        });
        ov.querySelectorAll('.sfx-prev-row').forEach(row => {
            row.addEventListener('mouseenter', () => { row.style.background = 'rgba(0,255,255,0.05)'; });
            row.addEventListener('mouseleave', () => { row.style.background = ''; });
            row.addEventListener('click', () => { _activePack.fn(row.dataset.sfx); });
        });
    };
    window.pinCurrentScore = pinCurrentScore;
    window.pinLeaderboardEntry = pinLeaderboardEntry;
    window.statsLbTab = statsLbTab;
    window.applyTheme = applyTheme;
    window.applyBlockSkin = applyBlockSkin;
    window.applyFont = applyFont;
    window.openDailyGift = openDailyGift;
    window.openDailyGiftInfo = openDailyGiftInfo;
    window.claimDailyGift = claimDailyGift;
    window._doExchange = function(fromKey, toKey, type) {
        const slider = document.getElementById('exc-slider');
        const sets = parseInt(slider?.value || 1);
        document.getElementById('exc-modal-overlay')?.remove();
        if (type === 'booster') {
            if (!saveData.boosters) saveData.boosters = {};
            saveData.boosters[fromKey] = (saveData.boosters[fromKey] || 0) - sets * 3;
            saveData.boosters[toKey]   = (saveData.boosters[toKey]   || 0) + sets;
        } else {
            if (!saveData.boxes) saveData.boxes = {};
            saveData.boxes[fromKey] = (saveData.boxes[fromKey] || 0) - sets * 3;
            saveData.boxes[toKey]   = (saveData.boxes[toKey]   || 0) + sets;
        }
        saveDataToFile();
        _populateInventoryOther();
        const meta = BOOSTER_META[fromKey];
        const metaTo = BOOSTER_META[toKey];
        customAlert(`Exchanged ${sets * 3}× ${meta.label} → ${sets}× ${metaTo.label}`, 'EXCHANGED');
    };
    window.closeDailyGift = () => {
        document.getElementById('daily-gift-overlay').classList.add('hidden');
        if (_dgCountdownInterval) { clearInterval(_dgCountdownInterval); _dgCountdownInterval = null; }
    };
    window.useScoreBooster = useScoreBooster;
    window.playerUnlockItem = playerUnlockItem;
    window.openUseUniversalPart = openUseUniversalPart;
    window.openExchangeUniversalParts = openExchangeUniversalParts;
    window.giveItemDirectly = giveItemDirectly;
    window.applyBtnStyle = applyBtnStyle;
    window.applyGridStyle = applyGridStyle;
    window.applyBlockShape = applyBlockShape;
    window.openCredits = function() { const _crEl = document.getElementById('credits-overlay'); if (!_crEl) return; _crEl.classList.remove('hidden'); _animateIn(_crEl, 'anim-in-right'); };
    if (_devMode) {
    window.devTriggerMilestone = function() {
        if (_levelBoxShowing || document.getElementById('level-box-overlay')) { customAlert('A box is already showing!', 'DEV'); return; }
        const _MS = {
            11: { rankName:'Silver',   rankColor:'#aaaaaa', rewards:[{ type:'universal_parts', amount:3, icon:'⭐', label:'+3 Universal Parts', desc:'Silver milestone reward', rarity:'rare' }] },
            21: { rankName:'Gold',     rankColor:'#ffd700', rewards:[{ type:'universal_parts', amount:3, icon:'⭐', label:'+3 Universal Parts', desc:'Gold milestone reward', rarity:'rare' }] },
            31: { rankName:'Emerald',  rankColor:'#00cc88', rewards:[{ type:'skin', key:'shadow', icon:'🎨', label:'Shadow Skin', desc:'Unlocked at Emerald!', rarity:'rare' }, { type:'universal_parts', amount:3, icon:'⭐', label:'+3 Universal Parts', desc:'Emerald milestone reward', rarity:'rare' }] },
            41: { rankName:'Sapphire', rankColor:'#4488ff', rewards:[{ type:'skin', key:'holo', icon:'🎨', label:'Holo Skin', desc:'Unlocked at Sapphire!', rarity:'rare' }, { type:'universal_parts', amount:3, icon:'⭐', label:'+3 Universal Parts', desc:'Sapphire milestone reward', rarity:'rare' }] },
            51: { rankName:'Ruby',     rankColor:'#ff4444', rewards:[{ type:'universal_parts', amount:6, icon:'⭐', label:'+6 Universal Parts', desc:'Ruby milestone reward', rarity:'rare' }] },
            61: { rankName:'Amethyst', rankColor:'#cc44ff', rewards:[{ type:'ghostColor', key:'ghostColor', icon:'👻', label:'Colored Ghost', desc:'Unlocked at Amethyst!', rarity:'epic' }, { type:'universal_parts', amount:5, icon:'⭐', label:'+5 Universal Parts', desc:'Amethyst milestone reward', rarity:'epic' }] },
            71: { rankName:'Diamond',  rankColor:'#44ddff', rewards:[{ type:'universal_parts', amount:8, icon:'⭐', label:'+8 Universal Parts', desc:'Diamond milestone reward', rarity:'legendary' }] },
            81: { rankName:'Celestite',rankColor:'#e8e8ff', rewards:[{ type:'universal_parts', amount:10, icon:'⭐', label:'+10 Universal Parts', desc:'Celestite milestone reward', rarity:'legendary' }] },
        };
        let _sel = document.getElementById('_dev-milestone-sel');
        if (_sel) { _sel.remove(); return; }
        _sel = document.createElement('div');
        _sel.id = '_dev-milestone-sel';
        _sel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(10,5,5,0.97);border:1px solid rgba(255,50,50,0.5);border-radius:10px;padding:14px;z-index:99999;display:flex;flex-direction:column;gap:6px;min-width:180px;';
        _sel.innerHTML = '<div style="font-size:0.55rem;color:#ff6666;font-weight:bold;letter-spacing:1px;margin-bottom:4px;">CHOOSE MILESTONE</div>' +
            Object.entries(_MS).map(([lv, m]) =>
                `<button data-ms-lv="${lv}" style="font-size:0.6rem;padding:5px 10px;background:rgba(255,0,0,0.08);border:1px solid ${m.rankColor}55;border-radius:4px;color:${m.rankColor};cursor:pointer;font-family:inherit;text-align:left;">Lv ${lv} — ${m.rankName}</button>`
            ).join('') +
            '<button data-ms-cancel style="font-size:0.55rem;padding:4px;background:none;border:none;color:#666;cursor:pointer;margin-top:4px;">Cancel</button>';
        _sel.addEventListener('click', e => {
            const btn = e.target.closest('[data-ms-lv],[data-ms-cancel]');
            if (!btn) return;
            _sel.remove();
            if (btn.dataset.msCancel !== undefined) return;
            const lv = parseInt(btn.dataset.msLv);
            const m = _MS[lv];
            if (!m) return;
            _queueLevelBox({ level: lv, rankName: m.rankName, rankColor: m.rankColor, rewards: m.rewards });
            _showLevelBox();
        });
        document.body.appendChild(_sel);
    };
    window.devResetDailyMissions = function() {
        if (!saveData.missions) saveData.missions = _defaultMissions();
        const { quests, secret } = _generateDailyQuests();
        const today = _missionDateKey();
        saveData.missions.daily = { quests, secret, lastRefreshDate: today, changeUsed: false, pointsToday: 0, claimedMilestones: [], completedToday: false, newVisit: true, rawXPToday: 0 };
        saveDataToFile();
        if (!document.getElementById('missions-overlay').classList.contains('hidden')) renderMissionsOverlay('daily');
        customAlert('Daily missions reset!', 'DEV MODE');
    };
    window.devResetWeeklyMissions = function() {
        if (!saveData.missions) saveData.missions = _defaultMissions();
        const missions = _generateWeeklyMissions();
        const thisWeek = _missionWeekKey();
        saveData.missions.weekly = { missions, weekKey: thisWeek, isoWeekKey: true, changeUsed: false, points: 0, claimedMilestones: [], anyCompleted: false, daysPlayedThisWeek: {}, dailyPtsLog: {}, newVisit: true, pendingUniversalParts: 0, universalPtsTracked: 0 };
        saveDataToFile();
        if (!document.getElementById('missions-overlay').classList.contains('hidden')) renderMissionsOverlay('weekly');
        customAlert('Weekly missions reset!', 'DEV MODE');
    };
    window.devCompleteAllMissions = function() {
        if (!saveData.missions) saveData.missions = _defaultMissions();
        const m = saveData.missions;
        m.daily.quests?.forEach(q => { q.progress = q.target; q.completed = true; });
        if (m.daily.secret) { m.daily.secret.progress = m.daily.secret.target; m.daily.secret.completed = true; }
        m.weekly.missions?.forEach(wm => { wm.progress = wm.target; wm.completed = true; });
        m.daily.completedToday = true;
        saveDataToFile();
        const isOpen = !document.getElementById('missions-overlay').classList.contains('hidden');
        if (isOpen) renderMissionsOverlay(window._mqActiveTab || 'daily');
        _checkGlowNotifications();
        customAlert('All missions completed — ready to claim!', 'DEV MODE');
    };
    window.devAddMissionPts = function() {
        const which = prompt('Add pts to: daily or weekly?', 'daily');
        if (!which) return;
        const amt = parseInt(prompt('How many points?', '20'));
        if (!amt || isNaN(amt)) return;
        if (!saveData.missions) saveData.missions = _defaultMissions();
        if (which === 'weekly') {
            saveData.missions.weekly.points = (saveData.missions.weekly.points || 0) + amt;
        } else {
            saveData.missions.daily.pointsToday = (saveData.missions.daily.pointsToday || 0) + amt;
            const _dm = saveData.missions;
            const _lastMS2 = MQ_DAILY_MILESTONES[MQ_DAILY_MILESTONES.length - 1].pts;
            const _newExcess2 = Math.max(0, (_dm.daily.pointsToday || 0) - _lastMS2);
            const _excessDelta2 = _newExcess2 - (_dm.specialBox.excessTracked || 0);
            if (_excessDelta2 > 0) {
                _dm.specialBox.excessTracked = _newExcess2;
                _dm.specialBox.pts = (_dm.specialBox.pts || 0) + _excessDelta2;
                if (_dm.specialBox.pts >= MQ_SPECIAL_BOX_CAP) {
                    _dm.specialBox.pts -= MQ_SPECIAL_BOX_CAP;
                    saveData.universalParts = (saveData.universalParts || 0) + 5;
                }
            }
        }
        saveDataToFile();
        const tab = which === 'weekly' ? 'weekly' : 'daily';
        if (!document.getElementById('missions-overlay').classList.contains('hidden')) renderMissionsOverlay(tab);
        customAlert(`+${amt} pts added to ${which} bar!`, 'DEV MODE');
    };
    }
    window.closeCredits = function() {
        const _mEl = document.getElementById('menu-overlay');
        _animateOut(document.getElementById('credits-overlay'), 'anim-out-right');
        if (_mEl && !_mEl.classList.contains('hidden')) _animateIn(_mEl, 'anim-in-left');
    };
    window.applyStylePack = applyStylePack;
    window.settingsVisualSubTab = settingsVisualSubTab;
    window.toggleMute = toggleMute;
    window.toggleTrack = toggleTrack;
    window.openRules = function() {
        const el = document.getElementById('rules-secret-count');
        if (el) el.textContent = ACHIEVEMENTS_DEF.filter(a => a.cat === 'secret').length;
        const _rlEl = document.getElementById('rules-overlay');
        _rlEl.classList.remove('hidden');
        _animateIn(_rlEl, 'anim-in-right');
        // rules_reader achievement tracking
        saveData.stats.rulesOpened = (saveData.stats.rulesOpened || 0) + 1;
        if ((saveData.stats.rulesOpened || 0) >= 5 && !saveData.achievements?.['rules_reader']?.unlocked) { unlockAchievement('rules_reader'); }
        saveDataToFile();
    };
    window.closeRules = function() {
        const _mEl = document.getElementById('menu-overlay');
        _animateOut(document.getElementById('rules-overlay'), 'anim-out-right');
        if (_mEl && !_mEl.classList.contains('hidden')) _animateIn(_mEl, 'anim-in-left');
    };
    window.openRulesMissions = function() {
        if (window._mqChangeMode) return;
        window.openRules();
        setTimeout(() => {
            const sec = document.getElementById('rules-missions-section');
            if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    };
    window.openTutorial = function() { const _tutEl = document.getElementById('tutorial-overlay'); _tutEl.classList.remove('hidden'); _animateIn(_tutEl, 'anim-in-right'); };
    window.closeTutorial = function() {
        const _mEl = document.getElementById('menu-overlay');
        _animateOut(document.getElementById('tutorial-overlay'), 'anim-out-right');
        if (_mEl && !_mEl.classList.contains('hidden')) _animateIn(_mEl, 'anim-in-left');
    };
    window.renderAchievementsOverlay = renderAchievementsOverlay;
    window.toggleAchDates = function(val) {
        _achShowDates = val;
        if (!document.getElementById('achievements-overlay').classList.contains('hidden')) {
            const activeTab = document.querySelector('[data-achtab].active')?.dataset.achtab || 'all';
            renderAchievementsOverlay(activeTab);
        }
    };
    window.openAchievements = function(tab) { renderAchievementsOverlay(tab || 'all'); const _achEl = document.getElementById('achievements-overlay'); _achEl.classList.remove('hidden'); _animateIn(_achEl, 'anim-in-right'); };
    window.closeAchievements = function() {
        const _mEl = document.getElementById('menu-overlay');
        _animateOut(document.getElementById('achievements-overlay'), 'anim-out-right', function() {
            const t = document.getElementById('ach-tip'); if (t) t.remove();
            _checkAchGlow();
        });
        if (_mEl && !_mEl.classList.contains('hidden')) _animateIn(_mEl, 'anim-in-left');
    };
    window.openModeSelect = openModeSelect;
    window.closeModeSelect = closeModeSelect;
    window.selectMode = selectMode;
    window.updateFunConfigDisplay = updateFunConfigDisplay;
    window.startSelectedMode = startSelectedMode;
    window.doHold = doHold;
    window._rebuildBgBlocks = _rebuildBgBlocks;

    // Snap d-steps range inputs to nearest dot value before oninput handlers fire
    document.addEventListener('input', function(e) {
        if (!e.target.classList.contains('d-steps-input')) return;
        const track = e.target.closest('.d-steps-flex');
        if (!track) return;
        const dots = Array.from(track.querySelectorAll('.d-step-dot'));
        if (!dots.length) return;
        const v = parseFloat(e.target.value);
        const nearest = dots.map(d => parseFloat(d.dataset.v)).reduce((a, b) => Math.abs(b - v) <= Math.abs(a - v) ? b : a);
        if (parseFloat(e.target.value) !== nearest) e.target.value = String(nearest);
    }, true);
    // Direct click on d-step dots
    document.addEventListener('click', function(e) {
        const dot = e.target.closest('.d-step-dot');
        if (!dot) return;
        const flex = dot.closest('.d-steps-flex');
        if (!flex) return;
        const input = flex.querySelector('.d-steps-input');
        if (!input) return;
        input.value = dot.dataset.v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    if (_visualReview) {
        const sfxPacks = { default: 'Default', cyber: 'Cyber', retro: 'Retro', zen: 'Zen', arcade: 'Arcade' };
        window.__lb ??= {};
        window.__lb.visualReview = {
            catalog: JSON.parse(JSON.stringify({
                skins: SKIN_NAMES, testSkins: _testSkins, defaults: defaultSettings, palettes: BLOCK_PALETTES,
                themes: THEMES, grids: GRID_STYLES, shapes: BLOCK_SHAPES, backgrounds: BG_STYLES,
                sfxPacks, pieces: BASE_PIECES
            })),
            partCost: _getItemCost,
            drawSample(context, { cell, swatches, stack, ghost, skin = defaultSettings.skin, palette = defaultSettings.colorPalette,
                colors, grid = defaultSettings.gridStyle, ghostColor = defaultSettings.ghostColor, shape = defaultSettings.blockShape }) {
                const oldSettings = settings, oldSave = saveData, oldColors = COLORS.slice();
                const dimensions = [COLS, ROWS, BLOCK, canvas._logicalWidth];
                settings = { ...defaultSettings, skin, gridStyle: grid, ghostColor, blockShape: shape };
                saveData = { customPickerColors: colors, ghostColorUnlocked: true };
                context.save();
                try {
                    _applyColorPalette(palette);
                    if (swatches) {
                        [1, 2, 3, 4, 5, 6, 7].forEach((id, index) => drawGameBlock(context, index + 1.5, 0, id, cell));
                        context.translate(0, cell + 12);
                    }
                    if (stack) {
                        COLS = stack[0].length; ROWS = stack.length + SPAWN_ROWS; BLOCK = cell;
                        canvas._logicalWidth = COLS * cell;
                        context.fillStyle = '#000';
                        context.fillRect(0, 0, COLS * cell, stack.length * cell);
                        context.save();
                        context.translate(0, -SPAWN_ROWS * cell);
                        _paintGrid(context);
                        context.restore();
                        stack.forEach((row, y) => row.forEach((id, x) => drawGameBlock(context, x, y, id, cell)));
                        if (ghost) ghost.cells.forEach(([x, y]) => drawGameBlock(context, x, y, ghost.id, cell, true));
                    }
                } finally {
                    context.restore();
                    [COLS, ROWS, BLOCK, canvas._logicalWidth] = dimensions;
                    settings = oldSettings; saveData = oldSave;
                    oldColors.forEach((color, index) => { COLORS[index] = color; });
                }
            },
            drawBackground(context, key, width, height) {
                const style = BG_STYLES[key];
                for (let index = 0; index < style.count; index++) {
                    const size = (style.sizeMin + (index % 5) * (style.sizeMax - style.sizeMin) / 4) / 2;
                    context.save();
                    context.translate(width * ((0.12 + index * 0.618) % 1), height * ((0.25 + index * 0.387) % 1));
                    context.rotate(index * 0.7);
                    BgBlock.prototype._paint.call({ style, size, shape: BASE_PIECES[index % 7 + 1],
                        color: COLORS[index % 7 + 1], skin: ['glass', 'shadow', 'retro', 'neon'][index % 4] }, context);
                    context.restore();
                }
            },
            async playSound(pack, sound) {
                initAudio();
                if (audioCtx.state === 'suspended') await audioCtx.resume();
                const previousPack = settings.sfxPack;
                settings.sfxPack = pack;
                try { playSFX(sound); } finally { settings.sfxPack = previousPack; }
            }
        };
        return;
    }

    _setLoadProgress(5, 'Initializing…');
    loadSettings();
    const controlsEditor = LBControls.createEditor(document.getElementById('controls-settings'),
        () => settings.keyBindings, bindings => { settings.keyBindings = bindings; saveSettings(); });
    LBGamepad.start({ press: pressGameInput, release: releaseGameInput, back: backFromOverlay });
    _musicMuted = settings.musicMuted || false;
    _sfxMuted = settings.sfxMuted || false;
    // Sync mute button icons on load
    { const _isPix = settings.stylePack === 'pixel';
      const _mBtn = document.getElementById('mw-mute');
      if (_mBtn) _mBtn.innerHTML = (_musicMuted ? _SVG_MUTED : _SVG_VOL);
      const _sBtn = document.getElementById('sfx-mute-btn');
      if (_sBtn) _sBtn.innerHTML = (_sfxMuted ? (_isPix?_SVG_PIX_MUTED:_SVG_MUTED) : (_isPix?_SVG_PIX_VOL:_SVG_VOL));
    }
    _setLoadProgress(20, 'Loading settings…');
    try {
        _rebuildBgBlocks();
        _applyColorPalette(settings.colorPalette || 'classic');
        _doApplyTheme(settings.theme || 'default');
        applyFontSize(settings.fontSize || '5');
        applyGameScale(settings.gameScale || '5');
        applyStylePack(settings.stylePack || 'modern');
    } catch(e) { console.error('Startup error:', e); }
    _setLoadProgress(40, 'Applying theme…');
    loadData();
    window.addEventListener('resize', () => applyGameScale(settings.gameScale || '5'));


    // Characterization-only access; production startup and gameplay are unchanged.
    if (window.__LB_TEST__ === true) {
        const copy = value => JSON.parse(JSON.stringify(value));
        window.__lb = {
            get state() { return copy({board, player, score, lines: linesClearedThisGame, level: speedLevel, holdPiece, holdUsed, combo: _comboCount, isGameOver, dropInterval}); },
            get save() { return copy(saveData); },
            get pieces() { return copy(BASE_PIECES); },
            setup({cells, type = 6, x = 3, y = 0, speed = 1, save} = {}) {
                board = cells ? copy(cells) : Array.from({length: ROWS}, () => Array(COLS).fill(0));
                saveData = Object.assign(copy(defaultSaveData), save || {});
                player = {pos: {x,y}, matrix: BASE_PIECES[type].map(r => r.map(v => v ? type : 0)), next: null};
                _currentPieceType = type; pieceBag = []; _nextQueue = [];
                score = 0; linesClearedThisGame = 0; speedLevel = speed; dropInterval = Math.floor(1000 / speed);
                dropCounter = 0; lastTime = performance.now(); currentScoreMultiplier = 1;
                isPaused = false; isGameOver = false; isAnimating = false; _hardDropAnimating = false;
                holdPiece = null; holdUsed = false; _comboCount = 0; _lastMoveWasRotation = false;
                settings.optHold = true; settings.hardDropLock = false;
                document.getElementById('go-overlay').classList.add('hidden');
            },
            setBoard(cells) { board = copy(cells); },
            setSave(value) { saveData = copy(value); },
            seed(seed) { let n = seed >>> 0; Math.random = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); pieceBag = []; _nextQueue = []; },
            spawn: resetPlayer, move: playerMove, rotate: playerRotate, hardDrop: playerHardDrop,
            hold: doHold, drop: playerDrop, sweep: arenaSweep, tick(dtMs) { update(lastTime + dtMs); },
            nextPiece: getNextPiece, gameOver, getLevelInfo, drawRankBadge,
            missionWeekKey: _missionWeekKey, missionDateKey: _missionDateKey,
            encSave: _encSave, decSave: _decSave,
            defaultMissions: _defaultMissions, refreshMissions: _checkMissionsRefresh,
            autoClaimMissions: _autoClaimMissions, streakMultiplier: _getMissionStreakXPMult,
            streakThreshold: _dailyStreakXPThreshold
        };
    }
})();
