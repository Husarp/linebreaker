(function() {

    const startup = window.LBStartup;
    const startupWait = startup?.bounded || ((label, action) => action());
    startup?.step('Initializing game…');
    const _qaDemo = window.LBQADemo;
    const _visualReview = window.__LB_TEST__ === true && window.__LB_VISUAL_REVIEW__ === true;
    const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, char => HTML_ENTITIES[char]);
    }
    function hexColor(value, fallback) {
        return typeof value === 'string' && value.length === 7 && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    }

    const _devMode = (() => {
        if (_visualReview || new URLSearchParams(window.location.search).has('dev')) return true;
        try { return localStorage.getItem('lb_dev') === '1'; } catch(e) { return false; }
    })();
    const DEFAULT_BLOCK_SKIN = 'retro';
    const SKIN_CATALOG_VERSION = 1;
    const seasonPass = window.LBSeason;
    const IMAGE_SKINS = new Map([...window.LBImageSkins, seasonPass.exclusiveSkin].map(skin => [skin.key, skin]));
    const SKIN_NAMES = { retro:'Retro', glass:'Glass', shadow:'Shadow', outline:'Outline', holo:'Holo', journey:'Journey', bubble:'Bubble',
        ...Object.fromEntries([...IMAGE_SKINS.values()].map(({ key, name }) => [key, name])) };
    const REMOVED_SKINS = new Set(['holo-foil','lava','nebula','wood-inlay','neon-tube','neon','gem','gameboy','monochrome','modern','candy','vim','aerolab','classic','window',
        'matrix','gold','golddragon','circuit','marble','fire','toxic','ice','flat','glossy','metal','puffy','bordered','gloss2k','lumines','minimal']);
    function _skinAvailable(key) { return Object.hasOwn(SKIN_NAMES, key); }
    function _renderSkin() { return _skinAvailable(settings.skin) ? settings.skin : DEFAULT_BLOCK_SKIN; }
    const _devPanel = document.getElementById('dev-panel');
    if (_devPanel && _devMode && !_qaDemo) _devPanel.style.display = 'flex';

    const _hasFileAPI = !_qaDemo && 'showOpenFilePicker' in window; // false on Firefox/Safari

    const COLORS=[null,'#00ffff','#3388ff','#ff9900','#ffff33','#33ff33','#cc33ff','#ff3366'];
    const CLASSIC_COLOR_KEY = COLORS.join(',');

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

    function paletteColors(colors, defaults = BLOCK_PALETTES.classic.colors) {
        return defaults.map((color, index) => hexColor(Array.isArray(colors) ? colors[index] : null, color));
    }

    function _applyColorPalette(name) {
        // Custom picker palette
        if (name === '_custom_picker' && saveData.customPickerColors) {
            COLORS.splice(1, 7, ...paletteColors(saveData.customPickerColors));
            return;
        }
        // Check custom palette overrides first (edited palettes)
        if (saveData.customPaletteOverrides?.[name]) {
            const ov = saveData.customPaletteOverrides[name];
            COLORS.splice(1, 7, ...paletteColors(ov, BLOCK_PALETTES[name]?.colors));
            return;
        }
        const pal = BLOCK_PALETTES[name] || BLOCK_PALETTES.classic;
        for (let i = 0; i < 7; i++) COLORS[i + 1] = pal.colors[i];
    }

    function lightenHex(hex, amt) {
        if (!hex || hex[0] !== '#' || hex.length < 7) return '#ffffff';
        const r = Math.min(255, parseInt(hex.slice(1,3),16) + amt);
        const g = Math.min(255, parseInt(hex.slice(3,5),16) + amt);
        const b = Math.min(255, parseInt(hex.slice(5,7),16) + amt);
        return `rgb(${r},${g},${b})`;
    }
    const BASE_PIECES=[null,[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],[[1,0,0],[1,1,1],[0,0,0]],[[0,0,1],[1,1,1],[0,0,0]],[[1,1],[1,1]],[[0,1,1],[1,1,0],[0,0,0]],[[0,1,0],[1,1,1],[0,0,0]],[[1,1,0],[0,1,1],[0,0,0]]];

    window.addEventListener('resize', () => {
        if (settings?.gameScale) applyGameScale(settings.gameScale);
    });

    const _SPLASH_QUOTES = [
        "100% gravity!",
        "Now with more pieces!",
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
        "Not every block is what it seems.",
        "Have you tried clicking around?",
        "Some things hide in plain sight.",
    ];
    {
        const splash = document.getElementById('splash-quote');
        const today = new Date();
        const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        const quote = _SPLASH_QUOTES[daySeed % _SPLASH_QUOTES.length];
        splash.textContent = quote;
        splash.style.setProperty('--splash-length', quote.length);
        if (quote === 'Lucky day!') {
            setTimeout(() => {
                if (!saveData.achievements?.lucky_day?.unlocked) {
                    unlockAchievement('lucky_day');
                    saveDataToFile();
                }
            }, 500);
        }
    }

    const logoButton = document.getElementById('lb122-logo-button');
    const logo = logoButton.querySelector('img');
    const logoEffects = [
        [{ transform: 'scale(1.08)' }],
        [{ transform: 'scale(.93)', filter: 'brightness(1.6)' }],
        [{ filter: 'brightness(1) hue-rotate(100deg)' }],
        [{ transform: 'translateY(5px) scale(1.04)' }],
        [{ transform: 'rotate(-4deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(-1deg)' }],
        [{ filter: 'brightness(1) drop-shadow(4px 0 #ff3fb5) drop-shadow(-4px 0 #00eaff)' }],
    ];
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let logoEffectIndex = -1;
    let logoAnimation;
    logoButton.addEventListener('click', () => {
        logoEffectIndex = (logoEffectIndex + 1) % logoEffects.length;
        logoAnimation?.cancel();
        logoAnimation = reducedMotion?.matches
            ? logo.animate?.([{ filter: 'brightness(1.5)' }, { filter: 'brightness(1.5)' }], 180)
            : logo.animate?.([{ filter: 'brightness(1.24)', transform: 'none' }, ...logoEffects[logoEffectIndex],
                { filter: 'none', transform: 'none' }]
                .map(frame => ({ easing: 'ease-in-out', ...frame })), { duration: 1200 });
        const seenEffects = saveData.stats.seenTitleAnims ??= [];
        if (!seenEffects.includes(logoEffectIndex)) {
            seenEffects.push(logoEffectIndex);
            saveDataToFile();
        }
        if (!saveData.achievements?.logo_click?.unlocked && seenEffects.length >= logoEffects.length) {
            unlockAchievement('logo_click');
            saveDataToFile();
        }
    });

    let activeInfo;
    let infoPointer;
    let infoDragged = false;

    function closeInfo(anchor) {
        if (!activeInfo || (anchor && activeInfo.anchor !== anchor)) return;
        const { dismiss } = activeInfo;
        activeInfo = undefined;
        dismiss();
    }

    function keepInfo(anchor, panel, dismiss) {
        if (activeInfo?.anchor !== anchor || activeInfo.panel !== panel) closeInfo();
        activeInfo = { anchor, panel, dismiss };
    }

    function positionInfo(panel, anchor) {
        const bounds = anchor.getBoundingClientRect();
        const margin = 10, gap = 8;
        const width = panel.offsetWidth, height = panel.offsetHeight;
        const spaceAbove = bounds.top - gap - margin;
        const spaceBelow = window.innerHeight - bounds.bottom - gap - margin;
        const above = height <= spaceAbove || (height > spaceBelow && spaceAbove >= spaceBelow);
        const left = bounds.left + (bounds.width - width) / 2;
        const top = above ? bounds.top - height - gap : bounds.bottom + gap;
        panel.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - width - margin))}px`;
        panel.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
    }

    function infoPanel(id) {
        let panel = document.getElementById(id);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = id;
            panel.className = 'lb-floating-tip lb-block-panel';
            panel.setAttribute('role', 'tooltip');
            panel.hidden = true;
            document.body.appendChild(panel);
        }
        return panel;
    }

    function showInfo(panel, anchor, { position = anchor, dismiss = () => { panel.hidden = true; } } = {}) {
        keepInfo(anchor, panel, dismiss);
        panel.hidden = false;
        positionInfo(panel, position);
    }

    function bindInfoPreview(anchor, show, { tap = false, toggle = false } = {}) {
        let pinned = false;
        anchor.addEventListener('mouseenter', event => {
            if (toggle && event.sourceCapabilities?.firesTouchEvents) return;
            if ((!infoPointer || !infoDragged) && activeInfo?.anchor !== anchor) { pinned = false; show(); }
        });
        anchor.addEventListener('mouseleave', () => { if (!pinned && !anchor.matches(':focus-visible')) closeInfo(anchor); });
        anchor.addEventListener('focusin', event => { if (event.target.matches(':focus-visible')) show(); });
        anchor.addEventListener('focusout', event => { if (!anchor.contains(event.relatedTarget)) closeInfo(anchor); });
        if (tap) anchor.addEventListener('click', event => {
            if (infoDragged && event.detail) return;
            if (toggle && pinned && activeInfo?.anchor === anchor) { pinned = false; closeInfo(anchor); return; }
            pinned = toggle;
            show();
        });
    }

    function closeInfoOutside(event) {
        if (activeInfo && !activeInfo.anchor.contains(event.target) && !activeInfo.panel.contains(event.target)) closeInfo();
    }

    document.addEventListener('pointerdown', event => {
        if (event.isPrimary === false) return;
        infoPointer = event;
        infoDragged = false;
        closeInfoOutside(event);
    }, true);
    document.addEventListener('pointermove', event => {
        if (!infoPointer || event.pointerId !== infoPointer.pointerId) return;
        if (Math.hypot(event.clientX - infoPointer.clientX, event.clientY - infoPointer.clientY) < 6) return;
        infoDragged = true;
        closeInfo();
    }, { capture: true, passive: true });
    document.addEventListener('pointerup', () => { infoPointer = undefined; }, true);
    document.addEventListener('pointercancel', () => {
        infoPointer = undefined;
        infoDragged = true;
        closeInfo();
    }, true);
    document.addEventListener('click', closeInfoOutside, true);
    document.addEventListener('scroll', () => closeInfo(), { capture: true, passive: true });
    window.addEventListener('scroll', () => closeInfo(), { passive: true });
    window.addEventListener('wheel', () => closeInfo(), { capture: true, passive: true });
    for (const event of ['resize', 'popstate', 'pagehide', 'blur']) window.addEventListener(event, () => closeInfo());
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeInfo(); }, true);

    function showControlInfo(anchor) {
        const panel = infoPanel('control-info-tip');
        panel.textContent = anchor.dataset.controlTip;
        showInfo(panel, anchor);
    }

    document.addEventListener('pointerover', event => {
        const anchor = event.target.closest?.('[data-control-tip]');
        if (anchor && event.pointerType !== 'touch' && !(infoPointer && infoDragged) && !anchor.contains(event.relatedTarget)) showControlInfo(anchor);
    });
    document.addEventListener('pointerout', event => {
        const anchor = event.target.closest?.('[data-control-tip]');
        if (anchor && !anchor.contains(event.relatedTarget) && !anchor.matches(':focus-visible')) closeInfo(anchor);
    });
    document.addEventListener('focusin', event => {
        const anchor = event.target.closest?.('[data-control-tip]');
        if (anchor && event.target.matches(':focus-visible')) showControlInfo(anchor);
    });
    document.addEventListener('focusout', event => {
        const anchor = event.target.closest?.('[data-control-tip]');
        if (anchor && !anchor.contains(event.relatedTarget)) closeInfo(anchor);
    });
    document.addEventListener('click', event => {
        if (activeInfo?.panel.id === 'control-info-tip' && activeInfo.anchor.contains(event.target)) closeInfo();
    }, true);

    for (const source of document.querySelectorAll('#settings-overlay .settings-tip')) {
        const row = source.closest('.settings-row');
        bindInfoPreview(row, () => {
            const panel = infoPanel('settings-info-tip');
            panel.textContent = source.textContent;
            showInfo(panel, row);
        });
    }
    for (const details of document.querySelectorAll('details.lb-block-info')) {
        const summary = details.querySelector('summary');
        const source = details.querySelector('.lb-block-tooltip');
        summary.addEventListener('click', event => {
            event.preventDefault();
            if (details.open) return closeInfo(summary);
            if (infoDragged && event.detail) return;
            const panel = infoPanel('disclosure-info-tip');
            panel.textContent = source.textContent;
            summary.setAttribute('aria-describedby', panel.id);
            details.open = true;
            showInfo(panel, summary, { dismiss: () => {
                panel.hidden = true;
                details.open = false;
                summary.removeAttribute('aria-describedby');
            } });
        });
    }

    const xpTrigger = document.getElementById('lb122-xp-trigger');
    const xpTooltip = document.getElementById('lb122-xp-tooltip');
    const xpProgress = document.getElementById('lb122-xp-progress');
    const xpHelp = document.getElementById('lb122-xp-help');
    const xpBar = document.getElementById('menu-xp-bar-wrap');
    let xpTooltipTimer;
    function showXpTooltip(showHelp) {
        const info = getLevelInfo(saveData.totalXP);
        xpProgress.textContent = `${(info.percent * 100).toFixed(1)}% · ${Math.floor(info.currentXP).toLocaleString()} / ${info.neededXP.toLocaleString()} XP`;
        xpHelp.hidden = !showHelp;
        keepInfo(xpBar, xpTooltip, hideXpTooltip);
        xpTooltip.hidden = false;
    }
    function hideXpTooltip() {
        clearTimeout(xpTooltipTimer);
        xpTooltipTimer = undefined;
        xpTooltip.hidden = true;
    }
    xpBar.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'touch' && (!infoPointer || !infoDragged) && xpTooltipTimer === undefined) showXpTooltip(true);
    });
    xpBar.addEventListener('pointerleave', () => {
        if (xpTooltipTimer === undefined && !xpTrigger.matches(':focus-visible')) closeInfo(xpBar);
    });
    xpTrigger.addEventListener('focus', () => {
        if (xpTrigger.matches(':focus-visible')) showXpTooltip(true);
    });
    xpTrigger.addEventListener('blur', () => closeInfo(xpBar));
    xpTrigger.addEventListener('click', event => {
        if (infoDragged && event.detail) return;
        clearTimeout(xpTooltipTimer);
        showXpTooltip(false);
        xpTooltipTimer = setTimeout(() => closeInfo(xpBar), 3000);
    });
    // afk achievement setup is deferred (see after variable declarations)

    function _animateOut(el, animClass, onDone) {
        closeInfo();
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
        closeInfo();
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
        if (ov.classList.contains('lb-color-dialog')) { ov.close(); return; }
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
        document.getElementById('alert-box').classList.toggle('lb-block-dialog--warning', isError);
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

    const canvas = document.getElementById('game-board'); const ctx = canvas.getContext('2d');
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
    let ROWS = 22; const VISIBLE_ROWS = 20; const COLS_NORMAL = 10; let COLS = COLS_NORMAL; let BLOCK = 30;
    const SPEED_MULTIPLIERS =[1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8];
    const LINES_PER_SPEED = 10;

    let floatingTexts =[], shakeIntensity = 0;
    const lineClear = LBLineClear.create();
    
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
    const defaultSaveData = { schemaVersion: LBSave.version, totalXP: 0, parts: {}, universalParts: 0, ownedSkins: [DEFAULT_BLOCK_SKIN], skinCatalogVersion: SKIN_CATALOG_VERSION, ownedThemes: [], ownedBtnStyles: [], ownedSfxPacks: ['default'], ownedPalettes: ['classic'], lastDailyGift: null, boosters: {}, ghostColorUnlocked: false, seenFunRules: false, pendingLevelBox: null, missions: null, season: seasonPass.emptySeason(), lastSeenTime: 0, seasonBlockedUntil: 0, stats: { gamesPlayed: 0, totalTimePlayed: 0, totalBlocksPlaced: 0, totalLinesCleared: 0, totalQuads: 0, totalBoostersUsed: 0, rareItemsFromDailyBox: 0, dailyStreak: 0, highestDailyStreak: 0, maxCombo: 0, lastPlayDate: '', playHistory: {}, blockTypeUsage: {}, luckySevenCount: 0 }, leaderboard:[], pinnedScores: [], achievements: {}, pendingAchievementClaims: [] };

    Object.assign(defaultSaveData, { dailyGiftStreak: 0, lastSeenTime: 0 });

    // --- FILE SYSTEM ACCESS API ---
    const _nativeAdapter = _qaDemo ? null : window.Capacitor?.isNativePlatform()
        ? window.LBNativeSave.createFilesystemSave(window.Capacitor.Plugins.Filesystem)
        : window.__TAURI__ ? {
            load: () => window.__TAURI__.core.invoke('load_save'),
            write: json => window.__TAURI__.core.invoke('write_save', { json })
        } : null;
    const _desktopSave = !!_nativeAdapter;
    let _desktopSaveReady = false;
    let _readOnlyRawSave = null;
    let _bootReadOnly = false;
    let fileHandle = null;

    function openSaveDatabase(name, legacy = false) {
        return new Promise((resolve, reject) => {
            const req = legacy ? indexedDB.open(name) : indexedDB.open(name, 2);
            let missing = false;
            req.onupgradeneeded = e => {
                if (legacy) {
                    missing = true;
                    req.transaction.abort();
                    return;
                }
                const db = e.target.result;
                if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
                if (!db.objectStoreNames.contains('savedata')) db.createObjectStore('savedata');
            };
            req.onsuccess = e => {
                const db = e.target.result;
                db.onversionchange = () => db.close(); // yield to future upgrades
                resolve(db);
            };
            req.onerror = () => missing ? resolve(null) : reject(req.error);
            req.onblocked = () => reject(new Error('IDB upgrade blocked')); // fall through to null save path
        });
    }
    function readSaveRecord(db, store, key) {
        if (!db?.objectStoreNames.contains(store)) return Promise.resolve(undefined);
        return new Promise((resolve, reject) => {
            const req = db.transaction(store).objectStore(store).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    let _saveDatabase;
    function openIDB() {
        return _saveDatabase ??= (async () => {
            const db = await openSaveDatabase('linebreaker_progress');
            try {
                if (await readSaveRecord(db, 'savedata', 'legacyMigrated')) return db;
                const legacy = await openSaveDatabase('\u0054etrisRPG', true);
                let handle, save;
                try {
                    [handle, save] = await Promise.all([
                        readSaveRecord(legacy, 'handles', 'saveFile'),
                        readSaveRecord(legacy, 'savedata', 'save'),
                    ]);
                } finally { legacy?.close(); }
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(['handles', 'savedata'], 'readwrite');
                    const records = tx.objectStore('savedata');
                    const migrated = records.get('legacyMigrated');
                    migrated.onsuccess = () => {
                        if (migrated.result) return;
                        for (const [store, key, value] of [[tx.objectStore('handles'), 'saveFile', handle], [records, 'save', save]]) {
                            if (value === undefined) continue;
                            const existing = store.get(key);
                            existing.onsuccess = () => { if (existing.result === undefined) store.put(value, key); };
                        }
                        records.put(true, 'legacyMigrated');
                    };
                    tx.oncomplete = resolve;
                    tx.onabort = () => reject(tx.error);
                });
                return db;
            } catch (error) {
                db.close();
                throw error;
            }
        })().catch(error => { _saveDatabase = null; throw error; });
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
    window.flushLinebreakerSave = () => _saveWritePromise;
    window.linebreakerCanInterrupt = () => !_gameInProgress && !_saveWritePromise && _saveFileDebounceId === null
        && !document.querySelector('#pal-edit-modal, .lb-reward-overlay, #transfer-overlay:not(.hidden)');
    let _otaSavePaused = !!window.LBAndroidUpdates;
    let _otaSettingsDirty = false;
    let _pendingSaveJSON = null;
    window.resumeLinebreakerOtaWrites = () => {
        _otaSavePaused = false;
        if (_otaSettingsDirty) { _otaSettingsDirty = false; persistSettings(); }
        return flushPendingSave();
    };
    function writeSaveFile(data) {
        if (_qaDemo || _readOnlyRawSave || _bootReadOnly) return Promise.resolve();
        if (_desktopSave && !_desktopSaveReady) return Promise.resolve();
        _pendingSaveJSON = JSON.stringify(LBSave.serializeSave(data, WEEKLY_MISSION_POOL), null, 2);
        return flushPendingSave();
    }
    function flushPendingSave() {
        if (_otaSavePaused || _pendingSaveJSON === null) return _saveWritePromise || Promise.resolve();
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
            })().finally(() => {
                _saveWritePromise = null;
                if (!_otaSavePaused && _pendingSaveJSON !== null) return flushPendingSave();
                window.LBAndroidUpdates?.syncSafety();
            });
            window.LBAndroidUpdates?.syncSafety();
        }
        return _saveWritePromise;
    }

    // Settings
    const defaultSettings = { musicVol: 30, sfxVol: 50, sfxPack: 'default', theme: 'default', skin: DEFAULT_BLOCK_SKIN, fontSize: '5', gameScale: '5', das: 160, arr: 50, ghostColor: 'white', btnStyle: 'square', blockShape: 'square', hardDropLock: false, hardDropLockMs: 50, stylePack: 'modern', optGhost: true, optHold: false, opt3Next: false, optMirror: false, optNoNext: false, gridOpacity: 40, gridStyle: 'lines', shakeStrength: 2, lineClearMs: 150, musicMuted: false, sfxMuted: false, colorPalette: 'classic', randomPieceColors: false, randomBlockColors: false, colorHistory: [] };
    Object.assign(defaultSettings, { showRunMissions: false, musicFollowsSpeed: true, musicPaused: false, showSpeedUp: true });
    defaultSettings.themeBackground = 'image';
    defaultSettings.uiTheme = 'dark';
    defaultSettings.movingBackground = true;
    defaultSettings.lineClearEffect = 'default';
    let settings = { ...defaultSettings };
    let closeDropdown;
    for (const control of document.querySelectorAll('.lb-dropdown')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'lb-block-btn lb-dropdown-trigger';
        button.setAttribute('aria-haspopup', 'listbox');
        button.setAttribute('aria-expanded', 'false');
        const label = document.createElement('span');
        button.append(label);
        const list = document.createElement('div');
        list.className = 'lb-dropdown-list lb-block-panel';
        list.id = `${control.id}-list`;
        list.hidden = true;
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', control.dataset.label);
        button.setAttribute('aria-controls', list.id);
        document.body.append(list);
        const options = new Map();
        let value;
        Object.defineProperty(control, 'value', {
            get: () => value,
            set(next) {
                if (!options.has(next)) return;
                options.get(value)?.setAttribute('aria-selected', 'false');
                value = next;
                const option = options.get(value);
                option.setAttribute('aria-selected', 'true');
                label.textContent = option.textContent;
                button.setAttribute('aria-label', `${control.dataset.label}: ${option.textContent}`);
            }
        });
        function close(restoreFocus = false) {
            list.hidden = true;
            button.setAttribute('aria-expanded', 'false');
            if (closeDropdown === close) closeDropdown = undefined;
            if (restoreFocus) button.focus({ preventScroll: true });
        }
        control.addOption = (key, text) => {
            const option = document.createElement('div');
            option.className = 'lb-dropdown-option';
            option.tabIndex = -1;
            option.dataset.value = key;
            option.textContent = text;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            option.addEventListener('click', () => {
                const changed = value !== key;
                control.value = key;
                close(true);
                if (changed) control.dispatchEvent(new Event('change', { bubbles: true }));
            });
            options.set(key, option);
            list.append(option);
            if (value === undefined) control.value = key;
        };
        const template = control.querySelector('template');
        for (const option of template.content.querySelectorAll('option')) {
            control.addOption(option.value, option.textContent);
            if (option.hasAttribute('selected')) control.value = option.value;
        }
        control.replaceChildren(button);
        function open() {
            closeDropdown?.();
            closeDropdown = close;
            button.setAttribute('aria-expanded', 'true');
            list.hidden = false;
            const bounds = button.getBoundingClientRect();
            const below = window.innerHeight - bounds.bottom - 8;
            const above = bounds.top - 8 - (document.querySelector('.lb-top-band')?.offsetHeight || 0);
            const flip = below < Math.min(list.scrollHeight, 200) && above > below;
            const width = Math.min(Math.max(bounds.width, 168), window.innerWidth - 16);
            list.style.width = `${width}px`;
            list.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8))}px`;
            list.style.maxHeight = `${Math.max(44, Math.min(280, flip ? above : below))}px`;
            list.style.top = flip ? 'auto' : `${bounds.bottom + 4}px`;
            list.style.bottom = flip ? `${window.innerHeight - bounds.top + 4}px` : 'auto';
            options.get(value)?.focus();
        }
        button.addEventListener('click', () => list.hidden ? open() : close());
        button.addEventListener('keydown', event => {
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault();
            open();
        });
        list.addEventListener('keydown', event => {
            if (event.key === 'Tab') { close(true); return; }
            const entries = [...options.values()];
            const index = entries.indexOf(event.target);
            switch (event.key) {
                case 'ArrowDown': entries[Math.min(index + 1, entries.length - 1)]?.focus(); break;
                case 'ArrowUp': entries[Math.max(index - 1, 0)]?.focus(); break;
                case 'Home': entries[0]?.focus(); break;
                case 'End': entries.at(-1)?.focus(); break;
                case 'Enter': case ' ': event.target.click(); break;
                case 'Escape': close(true); break;
                default: return;
            }
            event.preventDefault();
            event.stopPropagation();
        });
        list.addEventListener('focusout', event => {
            if (!list.contains(event.relatedTarget) && event.relatedTarget !== button) close();
        });
        document.addEventListener('pointerdown', event => {
            if (!list.hidden && !control.contains(event.target) && !list.contains(event.target)) close();
        }, true);
        document.addEventListener('scroll', event => {
            if (!list.hidden && !list.contains(event.target)) close();
        }, { capture: true, passive: true });
    }
    window.addEventListener('resize', () => closeDropdown?.());
    const _themeBackgroundSelect = document.getElementById('setting-theme-background');
    const uiThemeButtons = document.querySelectorAll('#settings-display [data-ui-theme]');
    const systemUiTheme = window.matchMedia?.('(prefers-color-scheme: light)');
    const wallpaperPreview = document.querySelector('.lb102-wallpaper-preview');
    for (const name of LBArtPack.wallpapers) {
        _themeBackgroundSelect.addOption(name, name[0].toUpperCase() + name.slice(1));
    }
    function syncUiTheme() {
        for (const button of uiThemeButtons) button.setAttribute('aria-pressed', String(button.dataset.uiTheme === settings.uiTheme));
        const theme = settings.uiTheme === 'system' ? (systemUiTheme?.matches ? 'light' : 'dark') : settings.uiTheme;
        document.documentElement.dataset.lbUiTheme = theme;
        const native = window.Capacitor;
        if (!_qaDemo && native?.isPluginAvailable?.('Ota')) {
            void native.Plugins.Ota.setUiTheme?.({ theme })?.catch(() => {});
        }
    }
    const onSystemUiThemeChange = () => { if (settings.uiTheme === 'system') syncUiTheme(); };
    if (systemUiTheme?.addEventListener) systemUiTheme.addEventListener('change', onSystemUiThemeChange);
    else systemUiTheme?.addListener?.(onSystemUiThemeChange);
    for (const button of uiThemeButtons) button.onclick = () => onSettingChange('uiTheme', button.dataset.uiTheme);
    const _movingBackgroundToggle = document.getElementById('setting-moving-background');
    const wallpaper = document.querySelector('.lb-wallpaper');
    let wallpaperAnimation;
    function driftWallpaper(from) {
        const to = `translate(${Math.random() * 4 - 2}%, ${Math.random() * 4 - 2}%)`;
        const previous = wallpaperAnimation;
        const animation = wallpaper.animate([{ transform: from }, { transform: to }], {
            duration: 18000 + Math.random() * 10000,
            easing: 'ease-in-out',
            fill: 'both',
        });
        wallpaperAnimation = animation;
        previous?.cancel();
        animation.onfinish = () => {
            if (wallpaperAnimation !== animation) return;
            driftWallpaper(to);
            if (document.hidden) wallpaperAnimation.pause();
        };
    }
    function syncWallpaperArt(theme) {
        LBArtPack.applyThemeBackground(wallpaper.parentElement, theme, settings.themeBackground);
        const featureTheme = theme === 'default' ? 'forest' : theme;
        for (const element of document.querySelectorAll('.lb-menu-banner, .go-score-card, #inventory-overlay, #achievements-overlay')) {
            LBArtPack.applyThemeBackground(element, featureTheme, settings.themeBackground);
        }
    }
    function syncWallpaper() {
        const preview = LBArtPack.themeBackground(settings.theme, settings.themeBackground);
        wallpaperPreview.style.backgroundImage = preview ? `url("${preview}")` : '';
        const enabled = settings.movingBackground !== false && !reducedMotion?.matches
            && Boolean(preview)
            && typeof wallpaper.animate === 'function';
        wallpaper.classList.toggle('lb-wallpaper--moving', enabled);
        if (!enabled) {
            wallpaperAnimation?.cancel();
            wallpaperAnimation = undefined;
        } else if (document.hidden) {
            if (wallpaperAnimation?.playState === 'running') wallpaperAnimation.pause();
        } else if (!wallpaperAnimation) {
            driftWallpaper('translate(0%, 0%)');
        } else if (wallpaperAnimation.playState === 'paused') {
            wallpaperAnimation.play();
        }
    }
    document.addEventListener('visibilitychange', syncWallpaper);
    reducedMotion?.addEventListener?.('change', syncWallpaper);
    const _lineClearEffectSelect = document.getElementById('setting-line-clear-effect');
    const _runMissionsSelect = document.getElementById('setting-run-missions');
    const _musicFollowsSpeedToggle = document.getElementById('setting-music-follows-speed');
    _themeBackgroundSelect.addEventListener('change', () => onSettingChange('themeBackground', _themeBackgroundSelect.value));
    _movingBackgroundToggle.addEventListener('change', () => onSettingChange('movingBackground', _movingBackgroundToggle.checked));
    _runMissionsSelect.addEventListener('change', () => onSettingChange('showRunMissions', _runMissionsSelect.value === 'on'));
    _musicFollowsSpeedToggle.addEventListener('change', () => onSettingChange('musicFollowsSpeed', _musicFollowsSpeedToggle.checked));
    document.getElementById('setting-speed-up-text').addEventListener('change', event => onSettingChange('showSpeedUp', event.target.checked));
    document.getElementById('setting-hard-drop-lock').addEventListener('change', event => onSettingChange('hardDropLock', event.target.checked));
    document.getElementById('settings-reset-progress').addEventListener('click', resetAllProgress);
    _lineClearEffectSelect.addEventListener('change', () => onSettingChange('lineClearEffect', _lineClearEffectSelect.value));
    function readLocalSave(key) {
        const currentKey = `linebreaker_${key}`;
        const legacyKey = `\u0074etrisRPG_${key}`;
        let value = localStorage.getItem(currentKey);
        const legacy = localStorage.getItem(legacyKey);
        if (legacy !== null) {
            if (value === null) {
                value = legacy;
                try { localStorage.setItem(currentKey, value); } catch { return value; }
            }
            localStorage.removeItem(legacyKey);
        }
        return value;
    }
    function loadSettings() {
        if (!_qaDemo) try { settings = { ...defaultSettings, ...LBSave.cleanSettings(JSON.parse(readLocalSave('settings') || '{}')) }; } catch(e) {}
        if (!settings.gridStyle) settings.gridStyle = 'lines';
        settings.lineClearEffect = LBLineClear.normalizeMode(settings.lineClearEffect);
        settings.keyBindings = LBControls.normalizeBindings(settings.keyBindings);
    }
    function persistSettings() {
        if (_qaDemo || _readOnlyRawSave || _bootReadOnly) return;
        if (_otaSavePaused) { _otaSettingsDirty = true; return; }
        localStorage.setItem('linebreaker_settings', JSON.stringify(settings));
    }
    function saveSettings() { persistSettings(); saveDataToFile(); }
    let _saveFileDebounceId = null;
    function saveSettingsDebounced() {
        persistSettings();
        clearTimeout(_saveFileDebounceId);
        _saveFileDebounceId = setTimeout(() => {
            _saveFileDebounceId = null;
            saveDataToFile();
            window.LBAndroidUpdates?.syncSafety();
        }, 600);
        window.LBAndroidUpdates?.syncSafety();
    }

    function applyFontSize(size) {
        const map = { '1':0.78,'2':0.91,'3':1.04,'4':1.17,'5':1.30,'6':1.43,'7':1.56,'8':1.76,'9':1.95,'10':2.15 };
        document.documentElement.style.setProperty('--font-scale', (map[size] || map['5']) / map['5']);
    }
    function applyGameScale(size) {
        const map = { '1':0.42,'2':0.49,'3':0.56,'4':0.63,'5':0.70,'6':0.77,'7':0.84,'8':0.94,'9':1.05,'10':1.15 };
        const baseScale = map[size] || 1.0;
        document.documentElement.style.setProperty('--game-scale', baseScale);
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
    const _SVG_GIFT = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>`;
    const _SVG_STATS = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-4"/></svg>`;
    const _SVG_ACHIEVEMENTS = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4H4v5c0 1.65 1.35 3 3 3"/><path d="M17 4h3v5c0 1.65-1.35 3-3 3"/><path d="M7 12c0 2.76 2.24 5 5 5s5-2.24 5-5V4H7v8z"/><line x1="12" y1="17" x2="12" y2="21"/><polyline points="9 21 12 21 15 21"/></svg>`;
    const _SVG_INVENTORY = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a4 4 0 014-4h8a4 4 0 014 4v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9z"/><path d="M9 6V5a3 3 0 016 0v1"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`;
    const _SVG_TIMER = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:2px"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14.5 15.5"/><path d="M9 2h6"/></svg>`;
    const STYLE_PACKS = {
        modern: {
            name: 'Modern', desc: 'SVG icons · Square buttons', btnRadius: '4px', free: true,
            font: "Tahoma, Arial, sans-serif",
            icons: { gift: _SVG_GIFT, stats: _SVG_STATS, achievements: _SVG_ACHIEVEMENTS, inventory: _SVG_INVENTORY },
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
    function _doApplyTheme(name, { persist = true } = {}) {
        const background = document.querySelector('.bg-gradient');
        syncWallpaperArt(name);
        if (name === 'custom' && saveData.customThemeColor) {
            const _ch = hexColor(saveData.customThemeColor, '#ff00ff');
            document.documentElement.style.setProperty('--primary', _ch);
            document.documentElement.style.setProperty('--primary-dim', hexToRgba(_ch, 0.35));
            settings.theme = 'custom';
            syncWallpaper();
            return;
        }
        const t = THEMES[name] || THEMES.default;
        document.documentElement.style.setProperty('--primary', t.primary);
        document.documentElement.style.setProperty('--primary-dim', hexToRgba(t.primary, 0.35));
        background.style.background = t.bg;
        settings.theme = name;
        syncWallpaper();
        if (persist) saveSettings();
        // Re-render theme list if inventory is open
        const ownedThemeContainer = document.getElementById('owned-theme-btns');
        if (ownedThemeContainer) {
            _populateVisualCustomize();
        }
    }
    function _allThemesOwned() {
        const owned = saveData.ownedThemes || [];
        return Object.keys(THEMES).every(key => FREE_THEMES.includes(key) || owned.includes(key));
    }

    window._openColorPickerModal = function() {
        if (!_allThemesOwned()) return;
        LBColorPicker.open({
            id: 'color-picker-modal',
            title: 'Custom Color',
            color: LBColorPicker.normalizeHex(saveData.customThemeColor) || '#ff00ff',
            history: settings.colorHistory,
            onApply(hex, recent) {
                settings.colorHistory = LBColorPicker.colorHistory(settings.colorHistory, recent);
                saveData.customThemeColor = hex;
                _doApplyTheme('custom');
                saveSettings();
                _populateVisualCustomize();
            },
        });
    };

    function _colorPickerButton(id, label, swatch, active, handler) {
        return _colorInventoryCard({ label, owned: true, equipped: active,
            preview: `<button type="button" id="${id}" class="lb-block-btn lb-block-btn--primary lb-colors-launch" aria-label="Edit ${label}" onclick="window.${handler}()">
                <span class="lb-color-launch-mark" aria-hidden="true" style="--swatch:${swatch}"></span><span>Edit</span>
            </button>` });
    }

    const _PIECE_LABELS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

    function _palettePiecePreviews(colors, showLabels = false) {
        return colors.map((color, index) => `<span class="lb83-piece" style="--piece-color:${color}">${LBColorPicker.pieceSvg(BASE_PIECES[index + 1])}${showLabels ? _PIECE_LABELS[index] : ''}</span>`).join('');
    }

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
        const hoverHandler = ' onmouseenter="window._showBlockPreview(this,' + i + ',\'' + color + '\')" onmouseleave="window._hideBlockPreview()"';
        const swatch = '<div style="width:24px;height:24px;border-radius:2px;background:' + color + ';flex-shrink:0;border:2px solid rgba(0,0,0,0.3);"></div>';
        const hex = showHex ? '<span style="font-size:0.72rem;color:#888;font-family:Orbitron,sans-serif;">' + color + '</span>' : '';
        return '<div class="pal-swatch" data-piece="' + i + '" style="display:flex;align-items:center;gap:8px;cursor:pointer;border-radius:6px;height:34px;"' + hoverHandler + '>' + swatch + hex + '</div>';
    }
    let _blockPreviewActiveSwatch = null;
    window._showBlockPreview = function(el, pieceIdx, color) {
        if (infoPointer && infoDragged) return;
        const piece = BASE_PIECES[pieceIdx + 1];
        const oldC = COLORS[pieceIdx + 1];
        COLORS[pieceIdx + 1] = color;
        const imgSrc = _renderPieceToImg(piece, pieceIdx + 1, BLOCK);
        COLORS[pieceIdx + 1] = oldC;

        const tip = infoPanel('block-preview-tip');
        tip.innerHTML = `<img src="${imgSrc}" alt="Piece preview" width="${piece[0].length * BLOCK}" height="${piece.length * BLOCK}">`;
        showInfo(tip, el, { dismiss: () => {
            tip.hidden = true;
            _blockPreviewActiveSwatch = null;
        } });
        _blockPreviewActiveSwatch = el;
    };
    window._hideBlockPreview = function() {
        if (_blockPreviewActiveSwatch) closeInfo(_blockPreviewActiveSwatch);
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
        _palEditState = { key: paletteKey, colors: paletteColors(saveData.customPaletteOverrides?.[paletteKey], pal.colors) };

        const ov = document.createElement('div');
        ov.id = 'pal-edit-modal';
        ov.className = 'lb-palette-window';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';

        let pickersHtml = '';
        _PIECE_LABELS.forEach((lbl, i) => {
            const c = _palEditState.colors[i] || '#ffffff';
            pickersHtml += `<div class="lb-palette-edit-row">
                <span>${lbl}</span>
                <div class="lb-palette-native">
                    <input type="color" id="pe-c${i}-native" aria-label="Piece ${i + 1} native color" value="${c}" oninput="window._palEditChange(${i},this.value)">
                    <div style="background:${c}" aria-hidden="true"></div>
                </div>
                <input type="text" id="pe-c${i}-hex" aria-label="${lbl} piece hex color" value="${c}" maxlength="7" autocomplete="off" spellcheck="false" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))window._palEditChange(${i},this.value)">
                <button type="button" class="lb-block-btn lb-block-btn--icon lb-palette-tool" onclick="window._palEditEyedrop(${i})" aria-label="Eyedropper for ${lbl}" data-control-tip="Eyedropper">${_SVG_EYEDROPPER}</button>
                <button type="button" class="lb-block-btn lb-block-btn--icon lb-palette-tool" onclick="navigator.clipboard?.writeText(document.getElementById('pe-c${i}-hex').value);_showCopyFeedback(event.clientX,event.clientY)" aria-label="Copy ${lbl} hex" data-control-tip="Copy hex">${_SVG_COPY}</button>
            </div>`;
        });

        ov.innerHTML = `<div class="lb-block-dialog" role="dialog" aria-modal="true" aria-labelledby="palette-edit-title">
            <header class="lb-palette-header">
                <div><h2 id="palette-edit-title">Edit Palette</h2><p>${pal.name}</p></div>
                <button type="button" class="lb-block-btn lb-block-btn--icon" aria-label="Close" onclick="this.closest('.lb-palette-window').remove()">×</button>
            </header>
            ${pickersHtml}
            <div id="pe-preview-row" aria-hidden="true"></div>
            <div class="lb-palette-actions">
                <button class="lb-block-btn lb-block-btn--primary" onclick="window._palEditApply()">Apply</button>
                <button class="lb-block-btn" onclick="window._palEditReset()" aria-label="Reset to default colors" data-control-tip="Reset to default colors">Reset</button>
                <button class="lb-block-btn" onclick="this.closest('.lb-palette-window').remove()">Cancel</button>
            </div>
        </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-up');
        window._palEditRefreshPreview();
    }
    window._openPaletteEditor = _openPaletteEditor;

    window._palEditChange = function(i, val) {
        if (!hexColor(val)) return;
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
        row.innerHTML = _palettePiecePreviews(_palEditState.colors, true);
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
        document.getElementById('pal-edit-modal')?.remove();
    };

    window._palEditReset = function() {
        if (!_palEditState) return;
        const key = _palEditState.key;
        if (saveData.customPaletteOverrides) delete saveData.customPaletteOverrides[key];
        if (settings.colorPalette === key) _applyColorPalette(key);
        saveSettings();
        saveDataToFile();
        _populateInventoryOther();
        document.getElementById('pal-edit-modal')?.remove();
    };

    function _allPalettesOwned() {
        const owned = saveData.ownedPalettes || ['classic'];
        return Object.keys(BLOCK_PALETTES).every(k => BLOCK_PALETTES[k].free || owned.includes(k));
    }

    // --- SVG ICON CONSTANTS ---
    const _SVG_COPY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
    const _SVG_EYEDROPPER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 8 4 4m-3-3 5-5a2.1 2.1 0 0 1 3 3l-5 5m-3-3-8 8v2h2l8-8M5 19l-2 2"/></svg>';

    // --- PALETTE VIEW MODAL (read-only color info with copy) ---
    function _openPaletteViewModal(paletteKey) {
        document.getElementById('palette-view-modal')?.remove();
        const pal = BLOCK_PALETTES[paletteKey];
        if (!pal) return;
        const displayColors = paletteColors(saveData.customPaletteOverrides?.[paletteKey], pal.colors);

        let rowsHtml = '';
        _PIECE_LABELS.forEach((lbl, i) => {
            const c = displayColors[i] || '#ffffff';
            rowsHtml += `<div class="lb-palette-view-row">
                ${_swatchHtml(i, c, true)}
                <button class="lb-block-btn lb-block-btn--icon" onclick="navigator.clipboard?.writeText('${c}');_showCopyFeedback(event.clientX,event.clientY)" aria-label="Copy ${lbl} hex" data-control-tip="Copy hex">${_SVG_COPY}</button>
            </div>`;
        });

        const ov = document.createElement('div');
        ov.id = 'palette-view-modal';
        ov.className = 'lb-palette-window';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `<div class="lb-block-dialog" role="dialog" aria-modal="true" aria-labelledby="palette-view-title">
            <header class="lb-palette-header">
                <h2 id="palette-view-title">${pal.name} Palette</h2>
                <button type="button" class="lb-block-btn lb-block-btn--icon" aria-label="Close" onclick="this.closest('.lb-palette-window').remove()">×</button>
            </header>
            ${rowsHtml}
            <button class="lb-block-btn" onclick="this.closest('.lb-palette-window').remove()">Close</button>
        </div>`;
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-up');
    }
    window._openPaletteViewModal = _openPaletteViewModal;

    function _customPaletteColors() {
        return BLOCK_PALETTES.classic.colors.map((fallback, index) => LBColorPicker.normalizeHex(saveData.customPickerColors?.[index]) || fallback);
    }

    function _openCustomPaletteModal() {
        if (!_allPalettesOwned()) return;
        const pieces = _customPaletteColors().map((color, index) => ({
            name: _PIECE_LABELS[index], matrix: BASE_PIECES[index + 1], color,
        }));
        LBColorPicker.open({
            id: 'custom-palette-modal',
            title: 'Custom Palette',
            pieces,
            history: settings.colorHistory,
            onApply(colors, recent) {
                settings.colorHistory = LBColorPicker.colorHistory(settings.colorHistory, recent);
                saveData.customPickerColors = colors;
                settings.colorPalette = '_custom_picker';
                settings.randomBlockColors = false;
                _applyColorPalette(settings.colorPalette);
                saveSettings();
                _populateVisualCustomize();
                _populateInventoryOther();
            },
        });
    }
    window._openCustomPaletteModal = _openCustomPaletteModal;

    function applyBlockSkin(skin) {
        if (!_skinAvailable(skin)) return;
        const owned = (saveData.ownedSkins || [DEFAULT_BLOCK_SKIN]).includes(skin);
        if (!owned) {
            customAlert(`This skin is not yet unlocked.<br><br>Collect <b>parts</b> from the daily gift to unlock it.`, 'NOT OWNED', true);
            return;
        }
        settings.skin = skin;
        saveSettings();
        const sc = document.getElementById('owned-skin-btns');
        if (sc) _populateVisualCustomize();
    }
    function applyStylePack(key, { persist = true } = {}) {
        const pack = STYLE_PACKS[key] || STYLE_PACKS.modern;
        settings.stylePack = key;
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
        syncMusicMuteButtons();
        if (persist) saveSettings();
    }

    let audioCtx = null, masterGain = null, musicFadeGain = null, sfxGain = null, musicPlaying = false;
    let _audioResumePending = null;
    let _audioPageHidden = false, _audioAppActive = true, _audioAppPaused = false, _audioRetired = false;
    // All SFX are now fully synthesized — no file loading needed
    const _sfxBuffers = {};

    function _audioInForeground() {
        return !_audioRetired && !document.hidden && !_audioPageHidden && _audioAppActive && !_audioAppPaused;
    }

    function syncMusicGain() {
        if (masterGain) masterGain.gain.value = settings.musicMuted || !_audioInForeground() ? 0 : settings.musicVol / 100 * 0.2;
        _syncPlaylistEqualizer();
    }

    function _syncSfxOutput() {
        if (!_audioInForeground()) {
            sfxGain?.disconnect();
            sfxGain = null;
        } else if (audioCtx && !sfxGain) {
            sfxGain = audioCtx.createGain();
            sfxGain.gain.value = _sfxMuted ? 0 : settings.sfxVol / 100 * 0.4;
            sfxGain.connect(audioCtx.destination);
        }
    }

    function fadeMusic(target, duration, from = musicFadeGain?.gain.value) {
        if (!musicFadeGain) return;
        const time = audioCtx.currentTime;
        musicFadeGain.gain.cancelScheduledValues(time);
        musicFadeGain.gain.setValueAtTime(duration > 0 ? from : target, time);
        if (duration > 0) musicFadeGain.gain.linearRampToValueAtTime(target, time + duration);
    }

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioCtx.addEventListener?.('statechange', _syncPlaylistEqualizer);
            masterGain = audioCtx.createGain();
            syncMusicGain();
            musicFadeGain = audioCtx.createGain();
            musicFadeGain.gain.value = 1;
            masterGain.connect(musicFadeGain);
            musicFadeGain.connect(audioCtx.destination);
            _syncSfxOutput();
            // All SFX synthesized — no files to load
        }
    }

    function _unlockAudio(gesture = false) {
        if (_audioRetired) return;
        try {
            initAudio();
            if (!_audioInForeground()) return;
            const context = audioCtx;
            if (context.state === 'running' || (!gesture && _audioResumePending?.context === context)) return;
            const pending = { context };
            _audioResumePending = pending;
            void context.resume().catch(error => {
                if (audioCtx === context) console.warn('Audio resume failed:', error);
            }).finally(() => {
                if (_audioResumePending === pending) _audioResumePending = null;
                if (audioCtx === context) _syncPlaylistEqualizer();
            });
        } catch (error) {
            _audioResumePending = null;
            console.warn('Audio unavailable:', error);
        }
    }

    function playSFX(type) {
        if (!_audioInForeground() || !sfxGain || settings.sfxVol === 0) return;
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

    let _activeMusic = null, _musicRevision = 0;
    let _currentMode = 'menu';
    let _menuFileNames = [];
    let _currentMenuTrackIdx = 0;
    let _gameFileNames = [];
    let _actionFileNames = [];
    let _musicCatalogPromise;
    let _nowPlayingName = '';
    let _nowPlayingArtist = '';
    let _trackStartTime = 0;
    let _trackPauseOffset = 0;
    let _trackDuration = 0;
    let _runMusicPaused = false;
    const _runMusicTempo = LBMusicTempo.createRunTempo();
    let _widgetIntervalId = null;
    const _trackPool = new Map();
    const _failedMusicFiles = new Set();
    const _playlistContent = document.getElementById('playlist-panel-content');
    let _settingsTrackPollId = null;
    let _menuShuffleQueue = []; // queue-based no-repeat playback
    function _createMusicSource(descriptor) {
        if (descriptor.synth) return window.LBMusicSynth.createSource(audioCtx, descriptor);
        const media = new Audio(); media.preload = 'metadata';
        const node = audioCtx.createMediaElementSource(media);
        let stopped = false, paused = true, attempt = 0, deadline, offset = 0;
        function seek() {
            if (offset > 0 && media.readyState >= 1) {
                media.currentTime = Math.min(offset, Math.max(0, (media.duration || Infinity) - 0.1));
                offset = 0;
            }
        }
        function fail(error) {
            clearTimeout(deadline);
            if (!stopped) source.onerror?.(error);
        }
        const source = {
            onended: null,
            onerror: null,
            playing: false,
            get position() { return offset || media.currentTime; },
            connect(target) { node.connect(target); },
            start(when, position = 0) {
                if (stopped) return;
                offset = position;
                media.src = descriptor.url;
                source.resume();
            },
            pause() {
                paused = true;
                clearTimeout(deadline);
                source.playing = false;
                media.pause();
            },
            resume() {
                if (stopped || !paused) return;
                paused = false;
                const request = ++attempt;
                const reject = error => { if (!paused && request === attempt) fail(error); };
                seek();
                deadline = setTimeout(() => reject(new Error('Timed out starting audio')), 8000);
                void media.play().then(() => {
                    if (stopped || paused) media.pause();
                }, reject);
            },
            stop() {
                stopped = true;
                node.disconnect();
                source.pause();
                media.removeAttribute('src');
                media.load();
            }
        };
        media.onloadedmetadata = () => {
            if (_activeMusic?.source !== source) return;
            if (Number.isFinite(media.duration)) _trackDuration = _currentTrackDuration30s = descriptor.duration = media.duration;
            try { seek(); } catch (error) { fail(error); }
        };
        media.onplaying = () => {
            if (stopped || paused) { media.pause(); return; }
            clearTimeout(deadline);
            source.playing = true;
            _syncPlaylistEqualizer();
        };
        media.onwaiting = () => {
            if (stopped || paused || !source.playing) return;
            source.playing = false;
            deadline = setTimeout(() => fail(new Error('Audio stopped buffering')), 8000);
            _syncPlaylistEqualizer();
        };
        media.onended = () => { if (!stopped && !paused) source.onended?.(); };
        media.onerror = () => fail(media.error || new Error('Audio could not load'));
        return source;
    }

    function _releaseMusicSource() {
        const previous = _activeMusic;
        _activeMusic = null;
        if (!previous) return;
        previous.output.gain.value = 0;
        previous.output.disconnect();
        previous.source.onended = previous.source.onerror = null;
        try { previous.source.stop(); } catch (error) { console.warn('Music stop failed:', error); }
    }

    function _musicPosition() {
        const active = _activeMusic;
        return active?.source.position ?? (_trackPauseOffset + (active?.playing ? audioCtx.currentTime - _trackStartTime : 0));
    }

    function _syncMusicPlayback(retryAudio = false) {
        const active = _activeMusic;
        const shouldPlay = musicPlaying && _audioInForeground() && !settings.musicPaused && !(_currentMode === 'game' && _runMusicPaused);
        if (shouldPlay && audioCtx && audioCtx.state !== 'running' && musicPlaying) _unlockAudio(retryAudio);
        if (active && active.playing !== shouldPlay) {
            try {
                if (shouldPlay) {
                    _trackStartTime = audioCtx.currentTime;
                    active.playing = true;
                    if (active.started) active.source.resume();
                    else {
                        active.started = true;
                        active.source.start(0, _trackPauseOffset);
                    }
                } else {
                    _trackPauseOffset = _musicPosition();
                    active.playing = false;
                    active.source.pause();
                }
            } catch (error) { active.fail(error); }
        }
        _syncPlaylistEqualizer();
    }

    function _syncAudioLifecycle() {
        _syncSfxOutput();
        syncMusicGain();
        _syncMusicPlayback(_audioInForeground());
    }

    function _selectMusicTracks(group) {
        const playlist = _getPlaylist(group);
        const enabled = playlist.filter(name => !_failedMusicFiles.has(name));
        if (enabled.length || (group === 'action' && !playlist.length)) return enabled;
        return _fallbackMusicTracks(group);
    }

    function _fallbackMusicTracks(group) {
        const defaults = group === 'menu' ? _menuFileNames : group === 'action' ? _actionFileNames : _gameFileNames;
        const synthOnly = names => names.filter(name => _trackPool.get(name)?.buf.synth);
        const enabled = synthOnly(_getPlaylist(group));
        return enabled.length ? enabled : synthOnly(defaults);
    }

    function _replaceMusicSource(name, group, offset, onEnded, tempo) {
        const entry = _trackPool.get(name);
        if (_audioRetired || !audioCtx || !musicPlaying || !entry || (group === 'menu') !== (_currentMode === 'menu')) return;
        _stopMusicSources();
        const revision = _musicRevision;
        const failed = error => {
            if (revision !== _musicRevision) return;
            console.warn(`Music playback failed (${name}${entry.buf.url ? ': ' + entry.buf.url : ''}):`, error);
            _releaseMusicSource();
            if (entry.buf.url) {
                _failedMusicFiles.add(name);
                const fallback = _fallbackMusicTracks(group)[0] || (group === 'action' && _fallbackMusicTracks('game')[0]);
                if (fallback) {
                    console.info(`Music fallback: ${fallback}`);
                    _replaceMusicSource(fallback, group, 0, onEnded, tempo);
                    return;
                }
            }
            updateNowPlaying('');
        };
        try {
            const output = audioCtx.createGain();
            const source = _createMusicSource(entry.buf);
            const active = { source, output, started: false, playing: false, fail: error => { if (_activeMusic === active) failed(error); } };
            _activeMusic = active;
            source.connect(output);
            output.gain.value = 1;
            output.connect(masterGain);
            if (tempo !== undefined) source.setTempo?.(tempo);
            source.onerror = active.fail;
            source.onended = () => {
                if (_activeMusic !== active || revision !== _musicRevision) return;
                _releaseMusicSource();
                if (!settings.musicPaused) onEnded();
            };
            _trackPauseOffset = Math.max(0, Math.min(offset, (entry.buf.duration || Infinity) - 0.1));
            _trackDuration = entry.buf.duration;
        } catch (error) {
            failed(error);
            return;
        }
        updateNowPlaying(name, entry.artist);
        _syncMusicPlayback();
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
        const playlist = _selectMusicTracks('menu');
        if (!playlist.length) return;
        const realIdx = ((idx % playlist.length) + playlist.length) % playlist.length;
        _currentMenuTrackIdx = realIdx;
        _playMenuTrack(playlist[realIdx]);
    }
    function _playMenuTrack(name, offset = 0) {
        if (_currentMode !== 'menu' || !musicPlaying || !audioCtx || !_trackPool.has(name)) return;
        _replaceMusicSource(name, 'menu', offset, () => {
            const pl = _selectMusicTracks('menu');
            _menuShuffleQueue = _menuShuffleQueue.filter(track => pl.includes(track));
            if (!_menuShuffleQueue.length) _fillMenuQueue(pl, _nowPlayingName);
            const nextName = _menuShuffleQueue.shift();
            const nextIdx = pl.indexOf(nextName);
            _playMenuFileTrack(nextIdx >= 0 ? nextIdx : 0);
        });
    }
    function _syncGameMusicTempo() {
        if (_currentMode !== 'game') return;
        const tempo = _runMusicTempo.update(speedLevel, settings.musicFollowsSpeed);
        _activeMusic?.source.setTempo?.(tempo);
    }
    function _startGameMusicForCurrentSpeed(continuing = false) {
        if (!musicPlaying || !audioCtx || _currentMode !== 'game') return;
        const game = _selectMusicTracks('game');
        const intense = _selectMusicTracks('action');
        const useIntense = intense.length && (!game.length || LBMusicTempo.isIntenseSpeed(speedLevel) || Math.random() < 0.38);
        const playlist = useIntense ? intense : game;
        if (!playlist.length) return;
        const choices = playlist.length > 1 ? playlist.filter(name => name !== _nowPlayingName) : playlist;
        const name = choices[Math.floor(Math.random() * choices.length)];
        const tempo = continuing ? _runMusicTempo.update(speedLevel, settings.musicFollowsSpeed) : undefined;
        _replaceMusicSource(name, useIntense ? 'action' : 'game', 0, () => _startGameMusicForCurrentSpeed(true), tempo);
        if (!continuing) _syncGameMusicTempo();
    }
    function startMusic(mode = 'menu') {
        if (_audioRetired || (musicPlaying && mode === _currentMode)) return;
        musicPlaying = true;
        _unlockAudio();
        syncMusicMuteButtons();
        return switchMusicMode(mode);
    }
    function _stopMusicSources() {
        _musicRevision++;
        _releaseMusicSource();
        _trackPauseOffset = _trackStartTime = _trackDuration = 0;
    }
    async function switchMusicMode(mode) {
        _stopMusicSources();
        _runMusicTempo.reset();
        _currentMode = mode;
        if (mode === 'menu') _runMusicPaused = false;
        _menuShuffleQueue = [];
        updateNowPlaying('');
        if (!musicPlaying) return;
        if (mode === 'menu') fadeMusic(1, 0);
        const revision = _musicRevision;
        await _initTrackCatalog();
        if (revision !== _musicRevision || !musicPlaying || !audioCtx || _activeMusic || settings.musicPaused) return;
        if (mode === 'menu') {
            const playlist = _selectMusicTracks('menu');
            _fillMenuQueue(playlist, '');
            _playMenuFileTrack(playlist.indexOf(_menuShuffleQueue.shift()));
        } else {
            fadeMusic(1, 1.5, 0);
            _startGameMusicForCurrentSpeed();
        }
    }
    function stopMusic() {
        musicPlaying = false;
        _stopMusicSources();
        updateNowPlaying('');
        if (audioCtx) { void audioCtx.close().catch(error => console.warn('Audio close failed:', error)); audioCtx = null; masterGain = null; musicFadeGain = null; sfxGain = null; }
        _audioResumePending = null;
    }
    function retireAudio() {
        _audioRetired = true;
        _syncSfxOutput();
        stopMusic();
    }
    function pauseMusic() {
        _runMusicPaused = true;
        _syncMusicPlayback();
    }
    function resumeMusic() {
        _runMusicPaused = false;
        _syncMusicPlayback();
    }
    // === END MUSIC SYSTEM ===

    function refreshSeasonCard() {
        const { id, day } = seasonPass.seasonWindow(Date.now());
        const date = document.getElementById('lb-menu-season-date');
        const format = number => String(number).padStart(2, '0');
        date.textContent = id ? `Season ${format(id)} · Day ${day} of ${seasonPass.DAYS}` : 'Season Calendar';
        _seasonScreen.updatePreview();
    }
    function refreshMenuUtilities() {
        dailyGiftReady = true;
        dailyGift.refresh();
        refreshSeasonCard();
        if (!_widgetIntervalId) {
            _widgetIntervalId = setInterval(() => {
                if (_currentMode === 'menu' && !settings.musicPaused && _trackDuration > 0) _updateMusicWidget();
            }, 500);
        }
    }

    async function _readMusicCatalog(path) {
        try {
            return await startupWait(`Music catalog ${path}`, async () => {
                const response = await fetch(path);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const catalog = await response.json();
                return catalog && typeof catalog === 'object' ? catalog : {};
            });
        } catch (error) {
            console.warn(`Music catalog could not load (${path}):`, error);
            return {};
        }
    }

    async function _registerTracks(tracks) {
        const names = await Promise.all(tracks.map(async track => {
            if (!track) return null;
            const synth = window.LBMusicSynth?.getTrack(track.synth);
            let buf;
            if (synth) buf = { synth, duration: synth.duration };
            else if (track.file) {
                const url = 'assets/music/' + encodeURIComponent(track.file);
                try {
                    const response = await startupWait('Checking optional audio', () => fetch(url, { method: 'HEAD' }));
                    if (response.ok && !response.headers?.get('content-type')?.startsWith('text/html')) buf = { url, duration: 0 };
                } catch (error) { console.warn(`Music file could not be checked (${url}):`, error); }
            }
            if (!buf) return null;
            const name = track.title || track.file?.replace(/\.ogg$/i, '');
            if (name && !_trackPool.has(name)) _trackPool.set(name, { buf, artist: track.artist || '', tags: track.tags || [] });
            return name;
        }));
        return [...new Set(names.filter(Boolean))];
    }

    function _initTrackCatalog() {
        return _musicCatalogPromise ||= (async () => {
            const local = await _readMusicCatalog('assets/music.json');
            const hasSynth = Object.values(local).some(tracks => Array.isArray(tracks) && tracks.some(track => track?.synth));
            const original = hasSynth ? {} : await _readMusicCatalog('assets/music.release.json');
            const tracks = (catalog, group) => Array.isArray(catalog[group]) ? catalog[group] : [];
            [_menuFileNames, _gameFileNames, _actionFileNames] = await Promise.all([
                _registerTracks([...tracks(original, 'menu'), ...tracks(local, 'menu')]),
                _registerTracks([...tracks(original, 'game'), ...tracks(local, 'game')]),
                _registerTracks([...tracks(original, 'intense'), ...tracks(local, 'intense'), ...tracks(local, 'action')])
            ]);
            if (!_menuFileNames.some(name => _trackPool.get(name).buf.synth)) {
                _menuFileNames.push(...await _registerTracks([{ synth: 'glass-harbor', title: 'Glass Harbor' }]));
            }
            if (!_gameFileNames.some(name => _trackPool.get(name).buf.synth)) {
                _gameFileNames.push(...await _registerTracks([{ synth: 'copper-relay', title: 'Copper Relay' }]));
            }
        })();
    }

    async function loadData() {
        if (!_qaDemo) startup?.recoverWith(() => {
            _bootReadOnly = true;
            applyLoadedData(null, false);
            enterMenuAfterSave();
            customAlert('This session will not save progress or settings. Restart to retry loading your save.', 'SAVE UNAVAILABLE');
            _dismissLoadingScreen();
        });
        _setLoadProgress(50, 'Loading missions…');
        await _loadMissionCatalog();
        if (_bootReadOnly) return;
        if (_qaDemo) {
            applyLoadedData(_qaDemo.createSave(defaultSaveData, _defaultMissions()), false);
            _qaDemo.seedMissions(saveData.missions);
            const previewCrate = async (rarity, details) => {
                saveData.storedCrates.unshift({ rarity, ...details });
                await openInventory('crates');
                _openStoredCrates(rarity);
            };
            _qaDemo.mount({
                run: startQARun, resetRun: resetQARun, alert: customAlert, confirm: customConfirm,
                tracksReady: _initTrackCatalog,
                levelUp: () => {
                    const level = getLevelInfo(saveData.totalXP).level;
                    _showLevelUpRewardPopup(level, _rankRewards(Math.max(2, level - 4), level), () => {});
                },
                levelCrate: () => previewCrate('rare', { source: 'rank' }),
                missionCrate: () => _openMissionCrate(MQ_DAILY_MILESTONES[0], false),
                closeCrate() {
                    document.getElementById('inventory-crate-overlay')?.remove();
                    if (!document.getElementById('inventory-overlay').classList.contains('hidden')) closeInventory();
                },
                dailyGift() {
                    saveData.lastDailyGift = _qaDemo.previousDate();
                    return dailyGift.claim();
                },
            });
            refreshMenuUtilities(); drawRankBadge(); _checkGlowNotifications(); startMusic('menu');
            _dismissLoadingScreen();
            return;
        }
        _setLoadProgress(55, 'Checking save storage…');
        const existingHandle = !_desktopSave && _hasFileAPI ? await startupWait('Save handle lookup', getHandleFromIDB) : null;
        if (!_bootReadOnly) await showFileSetup(existingHandle);
    }

    function _setLoadProgress(pct, label) {
        if (label) window.LBStartup?.step(label);
        const bar = document.getElementById('ls-bar');
        const statusEl = document.getElementById('ls-status');
        if (bar) bar.style.width = Math.min(100, pct) + '%';
        if (statusEl && label && document.getElementById('ls-actions')?.hidden) statusEl.textContent = label;
    }
    function _dismissLoadingScreen() {
        const ls = document.getElementById('loading-screen');
        if (!ls || ls.dataset.dismissed) return;
        ls.dataset.dismissed = '1';
        document.getElementById('ls-actions').hidden = true;
        _setLoadProgress(100, 'Ready!');
        startup?.finish();
        if (_qaDemo) { ls.style.display = 'none'; return; }
        setTimeout(() => {
            ls.classList.add('ls-hidden');
            setTimeout(() => { ls.style.display = 'none'; }, 600);
        }, 350);
    }

    function applyLoadedData(data, showSkinNotice = true) {
        const legacySkins = data != null && !(Number.isFinite(data.skinCatalogVersion) && data.skinCatalogVersion >= SKIN_CATALOG_VERSION);
        const wasRemoved = key => REMOVED_SKINS.has(key) || (legacySkins && key === 'lava');
        const removed = Array.isArray(data?.ownedSkins) ? [...new Set(data.ownedSkins.slice(0, 2000).filter(wasRemoved))] : [];
        const originalFileSkin = data?._settings?.skin;
        const originalFileShape = data?._settings?.blockShape;
        const legacyLavaParts = legacySkins && Object.hasOwn(data?.parts || {}, 'lava');
        data = sanitizeSave(data, { ...defaultSaveData, _settings: defaultSettings }, { palettes: BLOCK_PALETTES, boosters: BOOSTER_INFO, ranks: [...RANKS, CELESTITE_RANK], missionDefaults: _defaultMissions(), items: _getAllPartsItems(), skins: SKIN_NAMES, partCost: _getItemCost, partLabel: _partItemName });
        if (data.missions) _restoreMissionDefinitions(data.missions);
        let skinNotice = '', skinSettingsChanged = false;
        if (data && typeof data.totalXP === 'number') {
            const fileSettings = data._settings;
            const useFileSettings = fileSettings && (_qaDemo || !localStorage.getItem('linebreaker_settings'));
            saveData = { ...JSON.parse(JSON.stringify(defaultSaveData)), ...data };
            if (useFileSettings) {
                Object.assign(settings, defaultSettings, fileSettings);
                settings.lineClearEffect = LBLineClear.normalizeMode(settings.lineClearEffect);
                syncUiTheme();
                syncMusicGain();
            }
            if (data.stats) saveData.stats = { ...defaultSaveData.stats, ...data.stats };
            if (!saveData.ownedThemes) saveData.ownedThemes = [];
            if (!saveData.boosters) saveData.boosters = {};
            if (!saveData.parts) saveData.parts = {};
            if (saveData.universalParts == null) saveData.universalParts = 0;
            if (!saveData.ownedBtnStyles) saveData.ownedBtnStyles = [];
            if (saveData.ghostColorUnlocked == null) saveData.ghostColorUnlocked = false;
            if (!saveData.ownedSfxPacks) saveData.ownedSfxPacks = ['default'];
            if (!saveData.ownedPalettes) saveData.ownedPalettes = ['classic'];
            if (!saveData.customPaletteOverrides) saveData.customPaletteOverrides = {};
            // Migrate old booster keys
            if (saveData.boosters['1.3x_game']) { saveData.boosters['1.25x_game'] = (saveData.boosters['1.25x_game']||0) + saveData.boosters['1.3x_game']; delete saveData.boosters['1.3x_game']; }
            if (saveData.boosters['1.6x_game']) { saveData.boosters['1.5x_game'] = (saveData.boosters['1.5x_game']||0) + saveData.boosters['1.6x_game']; delete saveData.boosters['1.6x_game']; }
            const resetSkin = removed.length > 0 || wasRemoved(settings.skin) || wasRemoved(originalFileSkin);
            const refund = removed.reduce((total, key) => total + Math.max(1, Math.floor((ITEM_PART_COST[key] || 10) / 10)), 0);
            if (refund) addUniversalParts(refund);
            if (legacyLavaParts) delete saveData.parts.lava;
            const unavailableSkin = !_skinAvailable(settings.skin)
                || (IMAGE_SKINS.get(settings.skin)?.exclusive && !saveData.ownedSkins.includes(settings.skin));
            skinSettingsChanged = legacyLavaParts || resetSkin || unavailableSkin
                || settings.blockShape !== 'square' || (originalFileShape != null && originalFileShape !== 'square');
            if (resetSkin || unavailableSkin) settings.skin = DEFAULT_BLOCK_SKIN;
            settings.blockShape = 'square';
            if (fileSettings && resetSkin) fileSettings.skin = DEFAULT_BLOCK_SKIN;
            saveData.ownedSkins = [...new Set([DEFAULT_BLOCK_SKIN,
                ...saveData.ownedSkins.filter(key => !wasRemoved(key)), settings.skin])];
            saveData.skinCatalogVersion = SKIN_CATALOG_VERSION;
            if (resetSkin) {
                skinNotice = 'Retired block skins have been removed. Retro is now equipped.';
                if (refund) skinNotice += ` You received ${refund} universal ${refund === 1 ? 'part' : 'parts'} for retired skins you owned.`;
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
            if (useFileSettings) {
                persistSettings();
                _doApplyTheme(settings.theme || 'default');
                applyFontSize(settings.fontSize || '5');
                applyGameScale(settings.gameScale || '5');
                applyStylePack(settings.stylePack || 'modern', { persist: false });
                _applyColorPalette(settings.colorPalette || 'classic');
            } else {
                // Always apply visual/scale from localStorage (already loaded by loadSettings())
                _doApplyTheme(settings.theme || 'default');
                applyFontSize(settings.fontSize || '5');
                applyGameScale(settings.gameScale || '5');
                applyStylePack(settings.stylePack || 'modern', { persist: false });
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
        LBCrates.migratePendingCrates(saveData);
        seasonPass.observe(saveData);
        LBCrates.observeTime(saveData);
        dailyGift.refresh();
        if (dailyGiftReady) _scheduleRankRewards();
        setTimeout(_checkGlowNotifications, 100);
        _checkMissionsRefresh();
        _reminders?.refresh();
        _initTrackCatalog(); // re-run now that saveData is loaded
        if (skinSettingsChanged) saveSettings();
        if (skinNotice && showSkinNotice) customAlert(skinNotice, 'BLOCK SKINS UPDATED');
        return { skinNotice, skinSettingsChanged };
    }

    function enterMenuAfterSave() {
        checkAchievementsOnLoad();
        document.getElementById('file-setup-overlay')?.classList.add('hidden');
        refreshMenuUtilities(); drawRankBadge(); _checkAchGlow(); startMusic('menu');
        _scheduleRankRewards();
    }

    async function showFileSetup(existingHandle) {
        const overlay = document.getElementById('file-setup-overlay');
        const text = document.getElementById('file-setup-text');
        const btnOpen = document.getElementById('btn-open-save');
        const btnNew = document.getElementById('btn-new-save');

        if (_desktopSave) {
            let loaded;
            try {
                _setLoadProgress(75, 'Reading native save…');
                const json = await startupWait('Native save read', () => _nativeAdapter.load(), 2000);
                if (_bootReadOnly) return;
                _setLoadProgress(85, 'Preparing save schema…');
                const backup = _nativeAdapter.backupSchema;
                loaded = await LBNativeSave.prepareLoadedSave(json, LBSave.version,
                    backup && ((...args) => startupWait('Save schema backup', () => backup(...args), 2000)));
            } catch (error) {
                if (_bootReadOnly) return;
                if (window.LBStartup) window.LBStartup.fail(error, true);
                else {
                    _dismissLoadingScreen();
                    customAlert('Unable to load native save. Restart the app after checking save.json / save.bak. ' + escapeHtml(error), 'SAVE ERROR', true);
                }
                return;
            }
            if (_bootReadOnly) return;
            const { data, readOnly } = loaded;
            if (readOnly) console.warn('Native save opened read-only:', readOnly);
            _readOnlyRawSave = readOnly ? data : null;
            const { skinSettingsChanged } = applyLoadedData(data, !readOnly);
            _desktopSaveReady = true;
            if (skinSettingsChanged) saveDataToFile();
            enterMenuAfterSave();
            if (readOnly) customAlert(`${readOnly} Your original save is unchanged. You can export it from Save Transfer.`, 'SAVE IS READ-ONLY');
            _dismissLoadingScreen();
            signalUpdateReady();
            return;
        }

        if (!_hasFileAPI) {
            _setLoadProgress(75, 'Reading browser save…');
            const data = await startupWait('Browser save read', readIDBSave);
            if (_bootReadOnly) return;
            applyLoadedData(data);
            enterMenuAfterSave();
            _dismissLoadingScreen();
            signalUpdateReady();
            return;
        }

        if (existingHandle) {
            _setLoadProgress(75, 'Opening saved file handle…');
            // Try auto-load if permission already granted
            try {
                const autoP = await startupWait('Save handle permission', () => existingHandle.queryPermission({ mode: 'readwrite' }));
                if (_bootReadOnly) return;
                if (autoP === 'granted') {
                    const data = await startupWait('Save file read', () => readSaveFile(existingHandle));
                    if (_bootReadOnly) return;
                    fileHandle = existingHandle;
                    applyLoadedData(data);
                    checkAchievementsOnLoad();
                    overlay.classList.add('hidden');
                    refreshMenuUtilities(); drawRankBadge(); _checkAchGlow(); startMusic('menu');
                    _dismissLoadingScreen();
                    return; // skip showing overlay
                }
            } catch(e) { console.error('Auto-load error:', e); }
            if (_bootReadOnly) return;

            text.innerHTML = 'Previous save file found.<br>Click to load your progress.';
            btnOpen.innerHTML = '▶ LOAD SAVE';
            btnOpen.style.cssText = 'width:100%; margin-bottom:10px; background:linear-gradient(45deg,#00ffff,#0088ff); color:#000; border:none; font-weight:bold;';
            btnNew.innerHTML = '📂 Choose different file';
            btnNew.style.cssText = 'width:100%;';

            btnOpen.onclick = async () => {
                try {
                    const perm = await existingHandle.requestPermission({ mode: 'readwrite' });
                    if (perm === 'granted') {
                        const data = await readSaveFile(existingHandle);
                        fileHandle = existingHandle;
                        applyLoadedData(data);
                        checkAchievementsOnLoad();
                        overlay.classList.add('hidden');
                        refreshMenuUtilities(); drawRankBadge(); _checkAchGlow(); startMusic('menu');
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
                    const data = await readSaveFile(handle);
                    fileHandle = handle;
                    applyLoadedData(data);
                    checkAchievementsOnLoad();
                    await saveHandleToIDB(handle);
                    overlay.classList.add('hidden');
                    refreshMenuUtilities(); drawRankBadge(); _checkAchGlow(); startMusic();
                } catch(e) { console.error('Open save error:', e); customAlert('Error loading save: ' + escapeHtml(e.message), 'ERROR', true); }
            };
            btnNew.onclick = async () => {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: 'linebreaker_save.json',
                        types: [{ description: 'Linebreaker Save', accept: { 'application/json': ['.json'] } }]
                    });
                    saveData = JSON.parse(JSON.stringify(defaultSaveData));
                    settings.skin = DEFAULT_BLOCK_SKIN;
                    settings.blockShape = 'square';
                    fileHandle = handle;
                    persistSettings();
                    await saveDataToFile();
                    await saveHandleToIDB(handle);
                    overlay.classList.add('hidden');
                    refreshMenuUtilities(); drawRankBadge(); startMusic();
                } catch(e) {}
            };
        }
        overlay.classList.remove('hidden');
        _dismissLoadingScreen();
    }

    function signalUpdateReady() {
        window.linebreakerReadyForUpdates = true;
        window.dispatchEvent(new Event('linebreaker-update-ready'));
    }

    function saveDataToFile() {
        if (_qaDemo || _gameInProgress) return; // defer saves until game over — keeps score and achievements in sync
        seasonPass.observe(saveData);
        LBCrates.observeTime(saveData);
        return writeSaveFile({ ...saveData, _settings: { ...settings } });
    }

    let pendingClaim = false;
    function _claimAfterPaint(button, claim) {
        if (pendingClaim || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
        pendingClaim = true;
        button.setAttribute('aria-busy', 'true');
        const profile = saveData;
        return new Promise((resolve, reject) => {
            let frame;
            const finish = () => {
                cancelAnimationFrame(frame);
                clearTimeout(fallback);
                try {
                    if (profile === saveData && !_gameInProgress && button.isConnected && !button.closest('[hidden], .hidden, .anim-out-left, .anim-out-right')) claim();
                    resolve();
                } catch (error) {
                    reject(error);
                } finally {
                    pendingClaim = false;
                    button.removeAttribute('aria-busy');
                }
            };
            const fallback = setTimeout(finish, 100);
            frame = requestAnimationFrame(() => { frame = requestAnimationFrame(finish); });
        });
    }

    const BOOSTER_INFO = {
        '1.25x_game': { label:'1.25x Score Booster', icon:'⚡', rarity:'common',   mult:1.25 },
        '1.5x_game':  { label:'1.5x Score Booster',  icon:'⚡', rarity:'rare',     mult:1.5  },
        '2xp_game':   { label:'2x Score Booster',     icon:'⚡', rarity:'rare',     mult:2.0  },
    };

    function getBoosterMult() { return 1; }
    function updateBoosterHUD() {
        const el = document.getElementById('booster-hud');
        if (!el) return;
        el.style.display = 'none';
    }
    function addBoosterToSave(type, amount = 1) {
        if (!saveData.boosters) saveData.boosters = {};
        saveData.boosters[type] = (saveData.boosters[type] || 0) + amount;
    }

    const ITEM_PART_COST = { ghostColor: 20, boxes: 10, dots: 5, dotboxes: 15, sfxCyber: 30, sfxRetro: 15, sfxZen: 30, sfxArcade: 20, pastel: 10, neon: 15, dark: 10, greyscale: 5, synthwave: 10, earth: 10, ice: 5 };
    function _getItemCost(key) { return IMAGE_SKINS.get(key)?.cost || ITEM_PART_COST[key] || 10; }

    function _getAllPartsItems() {
        const items = [];
        Object.keys(SKIN_NAMES).forEach(k => { if (!IMAGE_SKINS.get(k)?.exclusive && !(saveData.ownedSkins || [DEFAULT_BLOCK_SKIN]).includes(k)) items.push({cat:'skin',key:k}); });
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
    function _partItemName(key) {
        if (key === 'ghostColor') return 'Colored Ghost';
        return _skinAvailable(key) ? SKIN_NAMES[key] : key.charAt(0).toUpperCase() + key.slice(1);
    }
    const PARTS_PER_UNIVERSAL = 5;
    function _partConversion(key, amount) {
        return { type: 'converted_parts', key, amount, icon: '⭐', desc: 'Duplicate converted', rarity: 'rare' };
    }
    function _rewardLabel(reward) {
        if (reward.type !== 'converted_parts') return escapeHtml(reward.label);
        const { key, amount } = reward;
        const universal = amount / PARTS_PER_UNIVERSAL;
        const item = key === 'dragon' ? 'Golden' : key.startsWith('sfx') ? `${key.slice(3)} SFX`
            : GRID_STYLES[key]?.name || BLOCK_PALETTES[key]?.name || _partItemName(key);
        const original = `+${amount} part${amount === 1 ? '' : 's'} (${item})`;
        const converted = `+${universal} universal part${universal === 1 ? '' : 's'}`;
        return `<s>${escapeHtml(original)}</s> → ${escapeHtml(converted)}`;
    }
    function _grantRewardPart(key) {
        if ((saveData.parts?.[key] || 0) < _getItemCost(key) && _getAllPartsItems().some(item => item.key === key)) {
            addPartsToItem(key, 1);
            return false;
        }
        addUniversalParts(1 / PARTS_PER_UNIVERSAL);
        return true;
    }
    function giveItemDirectly(cat, key) {
        if (cat === 'skin' && !_skinAvailable(key)) return;
        if (cat === 'skin') { if (!saveData.ownedSkins) saveData.ownedSkins = [DEFAULT_BLOCK_SKIN]; if (!saveData.ownedSkins.includes(key)) saveData.ownedSkins.push(key); }
        else if (cat === 'theme') { if (!saveData.ownedThemes) saveData.ownedThemes = []; if (!saveData.ownedThemes.includes(key)) saveData.ownedThemes.push(key); }
        else if (cat === 'ghostColor') { saveData.ghostColorUnlocked = true; }
        else if (cat === 'btnStyle') { if (!saveData.ownedBtnStyles) saveData.ownedBtnStyles = []; if (!saveData.ownedBtnStyles.includes(key)) saveData.ownedBtnStyles.push(key); }
        else if (cat === 'gridStyle') { if (!saveData.ownedGridStyles) saveData.ownedGridStyles = []; if (!saveData.ownedGridStyles.includes(key)) saveData.ownedGridStyles.push(key); }
        else if (cat === 'sfxPack') { if (!saveData.ownedSfxPacks) saveData.ownedSfxPacks = ['default']; const _sfxMap = {sfxCyber:'cyber',sfxRetro:'retro',sfxZen:'zen',sfxArcade:'arcade'}; const _sfxVal = _sfxMap[key]; if (_sfxVal && !saveData.ownedSfxPacks.includes(_sfxVal)) saveData.ownedSfxPacks.push(_sfxVal); }
        else if (cat === 'palette') { if (!saveData.ownedPalettes) saveData.ownedPalettes = ['classic']; if (!saveData.ownedPalettes.includes(key)) saveData.ownedPalettes.push(key); }
        else if (cat === 'stylePack') { settings.stylePack = key; saveSettings(); }
        if (saveData.parts) delete saveData.parts[key];
    }
    function playerUnlockItem(cat, key) {
        if (cat === 'skin' && (!_skinAvailable(key) || IMAGE_SKINS.get(key)?.exclusive)) return;
        const partsHave = saveData.parts?.[key] || 0;
        if (partsHave < _getItemCost(key)) return;
        giveItemDirectly(cat, key);
        playSFX('unlock');
        saveDataToFile();
        _populateVisualCustomize();
        _populateInventoryOther();
        _checkGlowNotifications();
    }
    function _exchangePartsIcon() {
        return `<img class="lb-exchange-parts-icon" src="${window.LBArtPack.universalPart}" width="28" height="28" alt="">`;
    }
    function openUseUniversalPart() {
        if ((saveData.universalParts || 0) < 1) return;
        document.getElementById('uni-modal-overlay')?.remove();
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
                bar.style.setProperty('--lb-exchange-owned-stop', `${splitPct.toFixed(1)}%`);
            } else {
                bar.style.width = actualPct + '%';
                bar.style.removeProperty('--lb-exchange-owned-stop');
            }
            if (lbl) lbl.textContent = pending > 0 ? `${parts}+${pending}/${cost} parts` : `${parts}/${cost} parts`;
        }
        function _updateApplyBtn() {
            const btn = document.getElementById('uni-apply-btn');
            if (!btn) return;
            const total = _totalQueued();
            btn.disabled = total === 0;
            const lbl = document.getElementById('uni-apply-label');
            if (lbl) lbl.textContent = total > 0 ? `Hold to Apply (${total} part${total!==1?'s':''})` : 'Hold to Apply';
        }
        function _updateAvailLbl() {
            const el = document.getElementById('uni-avail-lbl');
            if (el) el.textContent = `${Number(Math.max(0, _avail() - _totalQueued()).toFixed(1))} available`;
        }
        function _updateAllIncBtns() {
            const remaining = Math.max(0, _avail() - _totalQueued());
            document.querySelectorAll('[id^="uni-inc-"]').forEach(btn => {
                const key = btn.id.replace('uni-inc-', '');
                const parts = saveData.parts?.[key] || 0;
                const cur = _inputVals[key] || 0;
                const canAdd = remaining >= 1 && (_getItemCost(key) - parts - cur) > 0;
                btn.disabled = !canAdd;
            });
        }
        function _buildSection(label, items) {
            if (!items.length) return '';
            return `<section class="lb-exchange-section"><h3 class="lb-block-section-title">${label}</h3>`
                + items.map(item => {
                    const parts = saveData.parts?.[item.key] || 0;
                    const cost = _getItemCost(item.key);
                    const maxAdd = Math.min(_avail(), cost - parts);
                    const pct = (parts / cost) * 100;
                    const cur = _inputVals[item.key] || 0;
                    const name = escapeHtml(_getLabel(item));
                    return `<div class="lb-block-card lb-exchange-row">
                        <div class="lb-exchange-row-art">${_exchangePartsIcon()}</div>
                        <div class="lb-exchange-row-detail">
                            <strong>${name}</strong>
                            <div class="lb-exchange-row-meta lb-inventory-parts-allocation">
                                <div class="lb-exchange-meter" aria-hidden="true">
                                    <div id="uni-bar-${item.key}" style="width:${pct}%"></div>
                                </div>
                                <span id="uni-lbl-${item.key}">${escapeHtml(parts)}/${cost} parts</span>
                            </div>
                        </div>
                        ${parts < cost ? `<div class="lb-exchange-stepper">
                            <button type="button" class="lb-block-btn lb-block-btn--icon" aria-label="Remove part from ${name}" data-part-remove="${item.key}" id="uni-dec-${item.key}" ${cur > 0 ? '' : 'hidden'}>−</button>
                            <button type="button" class="lb-block-btn lb-block-btn--icon" aria-label="Add part to ${name}" data-part-add="${item.key}" id="uni-inc-${item.key}" ${maxAdd < 1 ? 'disabled' : ''}>+</button>
                        </div>` : `<span class="lb-exchange-badge">Full</span>`}
                    </div>`;
                }).join('') + '</section>';
        }
        function _rebuildContent() {
            const c = document.getElementById('uni-modal-body');
            if (!c) return;
            const all = _getAllPartsItems();
            const avail = _avail();
            c.innerHTML = `<header class="lb-exchange-parts-head">
                <div class="lb-exchange-title-row">
                    <h2 id="uni-title" class="lb-block-dialog-title">Universal Parts</h2>
                    <button type="button" class="lb-block-btn lb-block-btn--icon" aria-label="Close" onclick="window._closeModal('uni-modal-overlay')">×</button>
                </div>
                <div class="lb-exchange-balance">${_exchangePartsIcon()}<span id="uni-avail-lbl" class="lb-exchange-badge" aria-live="polite">${Number(avail.toFixed(1))} available</span></div>
                <button type="button" class="lb-block-btn lb-block-btn--primary" id="uni-apply-btn" disabled>
                    <span id="uni-apply-progress" aria-hidden="true"></span>
                    <span id="uni-apply-label">Hold to Apply</span>
                </button>
            </header><div id="uni-modal-list" class="lb-scroll-fade" tabindex="0" aria-label="Available parts">`
            + _buildSection('SKINS', all.filter(i => i.cat === 'skin'))
            + _buildSection('THEMES', all.filter(i => i.cat === 'theme'))
            + _buildSection('GHOST COLOR', all.filter(i => i.cat === 'ghostColor'))
            + _buildSection('GRID STYLES', all.filter(i => i.cat === 'gridStyle'))
            + _buildSection('PALETTES', all.filter(i => i.cat === 'palette'))
            + _buildSection('SFX PACKS', all.filter(i => i.cat === 'sfxPack'))
            + _buildSection('MUSIC', all.filter(i => i.cat === 'music'))
            + (all.length === 0 ? '<p>You already own everything. Universal parts will carry forward.</p>' : avail === 0 ? '<p>No universal parts remaining.</p>' : '')
            + '</div>';
            c.querySelectorAll('[data-part-add]').forEach(button => button.addEventListener('click', () => window._uniInc(button.dataset.partAdd)));
            c.querySelectorAll('[data-part-remove]').forEach(button => button.addEventListener('click', () => window._uniDec(button.dataset.partRemove)));
            // Re-attach hold events
            const applyBtn = document.getElementById('uni-apply-btn');
            if (applyBtn) {
                applyBtn.addEventListener('pointerdown', event => { if (event.button === 0) window._uniStartHold(); });
                ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(type => applyBtn.addEventListener(type, window._uniStopHold));
                applyBtn.addEventListener('keydown', event => {
                    if (![' ', 'Enter'].includes(event.key)) return;
                    event.preventDefault();
                    if (!event.repeat) window._uniStartHold();
                });
                applyBtn.addEventListener('keyup', event => {
                    if ([' ', 'Enter'].includes(event.key)) window._uniStopHold();
                });
            }
            // Restore bar states
            Object.keys(_inputVals).forEach(key => { if (_inputVals[key] > 0) _updateBar(key); });
        }
        window._uniInc = key => {
            const parts = saveData.parts?.[key] || 0;
            const queued = _totalQueued();
            const cur = _inputVals[key] || 0;
            const maxForItem = _getItemCost(key) - parts - cur;
            if (maxForItem <= 0 || _avail() - queued < 1) return;
            _inputVals[key] = cur + 1;
            const dEl = document.getElementById(`uni-dec-${key}`);
            if (dEl) dEl.hidden = false;
            _updateBar(key); _updateApplyBtn(); _updateAvailLbl(); _updateAllIncBtns();
        };
        window._uniDec = key => {
            const cur = _inputVals[key] || 0;
            if (cur <= 0) return;
            _inputVals[key] = cur - 1;
            const dEl = document.getElementById(`uni-dec-${key}`);
            if (dEl) dEl.hidden = cur <= 1;
            _updateBar(key); _updateApplyBtn(); _updateAvailLbl(); _updateAllIncBtns();
        };
        window._uniStartHold = () => {
            const total = _totalQueued();
            if (total === 0) return;
            _holdStart = Date.now();
            const prog = document.getElementById('uni-apply-progress');
            const lbl = document.getElementById('uni-apply-label');
            function tick() {
                if (!prog?.isConnected) { _holdRaf = null; _holdStart = null; return; }
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
                    bar.style.removeProperty('--lb-exchange-owned-stop');
                    setTimeout(() => { bar.style.width = newPct + '%'; }, 50);
                }
                const lbl = document.getElementById(`uni-lbl-${key}`);
                if (lbl) lbl.textContent = `${saveData.parts?.[key] || 0}/${_getItemCost(key)} parts`;
            });
            setTimeout(() => _rebuildContent(), 700);
        };
        const ov = document.createElement('div');
        ov.id = 'uni-modal-overlay';
        ov.className = 'lb-exchange-overlay';
        ov.innerHTML = '<div class="lb-block-dialog lb-exchange-dialog lb-exchange-dialog--parts" role="dialog" aria-modal="true" aria-labelledby="uni-title"><div id="uni-modal-body"></div></div>';
        ov.addEventListener('click', e => { if (e.target === ov) window._closeModal('uni-modal-overlay'); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-down');
        _rebuildContent();
    }

    function _exchangeItemCard({ name, art, rarity, count, detail, amountId, amount }) {
        return `<div class="lb-block-reward lb-exchange-item" data-rarity="${rarity}">
            <div class="lb-exchange-item-art">${art}</div>
            <span class="lb-exchange-item-balance">${count != null ? `You have ${escapeHtml(count)}` : ''}</span>
            <strong>${name}</strong>
            <span class="lb-exchange-item-detail">${detail}</span>
            <strong class="lb-exchange-item-amount" id="${amountId}">${amount}</strong>
        </div>`;
    }
    function _exchangeQuantity(id, label, max, initial) {
        return `<div class="lb-exchange-quantity">
            <label for="${id}">${label}</label>
            <div class="lb-exchange-quantity-controls">
                <button type="button" class="lb-block-btn lb-block-btn--icon" data-quantity-step="-1" aria-label="Decrease quantity">−</button>
                <input type="number" id="${id}" min="1" max="${max}" value="${initial}" step="1" inputmode="numeric">
                <button type="button" class="lb-block-btn lb-block-btn--icon" data-quantity-step="1" aria-label="Increase quantity">+</button>
            </div>
        </div>`;
    }
    function _bindExchangeQuantity(dialog, updatePreview) {
        const input = dialog.querySelector('.lb-exchange-quantity input');
        const [decrease, increase] = dialog.querySelectorAll('[data-quantity-step]');
        const max = Number(input.max);
        function setQuantity(value, keepEmpty = false) {
            const quantity = Math.max(1, Math.min(max, Math.trunc(value) || 1));
            if (!keepEmpty || input.value !== '') {
                if (input.valueAsNumber !== quantity) input.value = quantity;
            }
            decrease.disabled = quantity === 1;
            increase.disabled = quantity === max;
            updatePreview(quantity);
            return quantity;
        }
        input.addEventListener('input', () => setQuantity(input.valueAsNumber, true));
        input.addEventListener('blur', () => setQuantity(input.valueAsNumber));
        [decrease, increase].forEach(button => button.addEventListener('click', () => {
            setQuantity((input.valueAsNumber || 1) + Number(button.dataset.quantityStep));
        }));
        setQuantity(input.valueAsNumber);
        return () => setQuantity(input.valueAsNumber);
    }
    function openExchangeUniversalParts() {
        const avail = Math.floor(saveData.universalParts || 0);
        if (avail < 1) return;
        const XP_PER_PART = 5000;
        document.getElementById('uni-xch-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'uni-xch-overlay';
        ov.className = 'lb-exchange-overlay';
        ov.innerHTML = `
            <div class="lb-block-dialog lb-exchange-dialog" role="dialog" aria-modal="true" aria-labelledby="uni-xch-title">
                <h2 id="uni-xch-title" class="lb-block-dialog-title">Exchange Parts</h2>
                <p>All items unlocked · ${XP_PER_PART.toLocaleString()} XP per part</p>
                <div class="lb-exchange-pair">
                    ${_exchangeItemCard({ name: 'Universal Parts', art: _exchangePartsIcon(), rarity: 'common', count: avail, detail: 'You spend', amountId: 'uni-xch-count', amount: `${avail} ${avail === 1 ? 'part' : 'parts'}` })}
                    <span class="lb-exchange-arrow" aria-hidden="true">→</span>
                    ${_exchangeItemCard({ name: 'Experience', art: '<img src="assets/ui/boosters/common-xp.png" alt="">', rarity: 'common', detail: 'You receive', amountId: 'uni-xch-xp', amount: `+${(avail * XP_PER_PART).toLocaleString()} XP` })}
                </div>
                ${_exchangeQuantity('uni-xch-quantity', 'Parts to exchange', avail, avail)}
                <div class="lb-block-dialog-actions">
                    <button type="button" class="lb-block-btn" onclick="document.getElementById('uni-xch-overlay').remove()">Cancel</button>
                    <button type="button" class="lb-block-btn lb-block-btn--primary" id="uni-xch-confirm">Exchange</button>
                </div>
            </div>`;
        const getQuantity = _bindExchangeQuantity(ov, quantity => {
            ov.querySelector('#uni-xch-count').textContent = `${quantity} ${quantity === 1 ? 'part' : 'parts'}`;
            ov.querySelector('#uni-xch-xp').textContent = `+${(quantity * XP_PER_PART).toLocaleString()} XP`;
        });
        ov.querySelector('#uni-xch-confirm').addEventListener('click', () => {
            const v = getQuantity();
            if (v > Math.floor(saveData.universalParts || 0)) return;
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

    function _crateRewardGrid(rewards, showPartProgress = false) {
        return LBCrates.rewardGrid(rewards.map(reward => {
            if (reward.type === 'converted_parts') {
                const item = reward.key === 'dragon' ? 'Golden' : reward.key.startsWith('sfx') ? `${reward.key.slice(3)} SFX`
                    : GRID_STYLES[reward.key]?.name || BLOCK_PALETTES[reward.key]?.name || _partItemName(reward.key);
                return { type: 'universal_parts', label: 'Universal Part', amount: reward.amount / PARTS_PER_UNIVERSAL,
                    desc: `From duplicate ${item} parts`, rarity: reward.rarity };
            }
            const item = /^\+(\d+) Part: (.+)$/.exec(reward.label);
            if (item) return { ...reward, type: 'parts', label: `${item[2]} Part`, amount: reward.amount ?? Number(item[1]), desc: showPartProgress ? reward.desc : undefined };
            const universal = /^\+(\d+) Universal Parts?$/.exec(reward.label);
            if (universal) return { ...reward, type: 'universal_parts', label: 'Universal Part', amount: reward.amount ?? Number(universal[1]), desc: undefined };
            return { ...reward, amount: reward.amount ?? 1 };
        }), rankUnlockText);
    }
    function _rewardRankIdentity(level) {
        const rank = RANKS[Math.floor((level - 1) / 10)] || CELESTITE_RANK;
        const division = rank === CELESTITE_RANK ? level : (level - 1) % 10;
        const name = rank.name[0] + rank.name.slice(1).toLowerCase();
        return { rank, name: division ? `${name} ${_toRoman(division)}` : name };
    }
    function _generateLevelBoxRewards() {
        const rewards = [];
        const allItems = _getAllPartsItems();
        const picks = _weightedPickParts(allItems, Math.min(10, allItems.length));
        picks.forEach(item => {
            if (_grantRewardPart(item.key)) {
                rewards.push(_partConversion(item.key, 1));
                return;
            }
            const partCount = saveData.parts[item.key] || 0;
            rewards.push({ type: 'parts', key: item.key, icon: '🧩', label: `+1 Part: ${_partItemName(item.key)}`,
                desc: `${partCount}/${_getItemCost(item.key)} parts`, rarity: item.cat === 'ghostColor' ? 'epic' : 'common' });
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

    function _grantXP(amount) {
        const oldLevel = getLevelInfo(saveData.totalXP).level;
        saveData.totalXP += amount;
        _processLevelUps(oldLevel, getLevelInfo(saveData.totalXP).level);
    }
    const RANK_REWARD_BOOSTER = '1.5x_game';
    let rankRewardTimer;
    function _rankRewards(from, through) {
        const fifths = Math.floor(through / 5) - Math.floor((from - 1) / 5);
        const rankChanges = RANKS.filter(({ maxLvl }) => maxLvl + 1 >= from && maxLvl + 1 <= through).length;
        return [
            ...Object.entries({ common: through - from + 1 - fifths + 2 * rankChanges, rare: fifths + rankChanges, epic: rankChanges })
                .map(([rarity, amount]) => ({ type: 'crate', label: LBCrates.crateLabel(rarity), rarity, amount })),
            { type: 'universal_parts', label: 'Universal Part', rarity: 'rare', amount: 3 * rankChanges },
            { type: 'booster', key: RANK_REWARD_BOOSTER, ...BOOSTER_INFO[RANK_REWARD_BOOSTER], amount: rankChanges },
        ].filter(reward => reward.amount > 0);
    }

    function _processLevelUps(oldLevel, newLevel) {
        const from = Math.max(oldLevel, saveData.levelRewardsThrough || oldLevel) + 1;
        saveData.levelRewardsThrough = Math.max(saveData.levelRewardsThrough || oldLevel, newLevel);
        if (from > newLevel) return;
        saveData.pendingRankRewards = { from: saveData.pendingRankRewards?.from ?? from, through: newLevel };
        _scheduleRankRewards();
    }

    function _scheduleRankRewards(delay = 2500) {
        clearTimeout(rankRewardTimer);
        if (!saveData.pendingRankRewards) return;
        const profile = saveData;
        rankRewardTimer = setTimeout(() => {
            if (profile !== saveData || !profile.pendingRankRewards) return;
            if (_gameInProgress || document.querySelector('.lb-reward-overlay:not(#level-up-popup-overlay), dialog[open]')) {
                _scheduleRankRewards(500);
                return;
            }
            const { from, through } = profile.pendingRankRewards;
            _showLevelUpRewardPopup(through, _rankRewards(from, through), () => {
                if (profile !== saveData || !profile.pendingRankRewards) return;
                const pending = profile.pendingRankRewards;
                profile.pendingRankRewards = null;
                for (const { type, key, rarity, amount } of _rankRewards(pending.from, pending.through)) {
                    if (type === 'crate') {
                        const stock = profile.storedCrates ??= [];
                        for (let index = 0; index < amount; index++) stock.push({ rarity, source: 'rank' });
                    } else if (type === 'universal_parts') addUniversalParts(amount);
                    else addBoosterToSave(key, amount);
                }
                saveDataToFile();
                if (!document.getElementById('inventory-overlay').classList.contains('hidden')) _populateInventoryOther();
                _checkGlowNotifications();
            });
        }, delay);
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
                customAlert(`XP set to ${escapeHtml(saveData.totalXP)}`, 'DEV MODE');
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
        dailyGift.refresh();
        saveDataToFile();
        customAlert('Daily gift reset! Gift is now available.', 'DEV');
    }
    function devResetStore() {
        saveData.ownedSkins = [DEFAULT_BLOCK_SKIN];
        settings.skin = DEFAULT_BLOCK_SKIN;
        saveData.ownedThemes = [];
        saveData.ownedBtnStyles = [];
        saveData.ownedGridStyles = [];
        saveData.ghostColorUnlocked = false;
        saveData.boosters = {};
        saveData.parts = {};
        saveData.universalParts = 0;
        saveSettings();
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
            saveData.leaderboard.push({ score, ..._scoreDate(d), lines, blocks, time, maxSpeed, xp, maxCombo });
        });
        saveData.leaderboard.sort((a,b) => b.score - a.score);
        saveDataToFile();
        customAlert(`Added ${entries.length} random scores!`, 'DEV');
    }
    function devResetScores() {
        if (!confirm('Reset ALL leaderboard scores? This cannot be undone.')) return;
        saveData.leaderboard = [];
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
            const score = Math.floor(Math.random() * 8000) + 100;
            const lines = Math.floor(Math.random() * 40);
            const blocks = Math.floor(lines * 3 + Math.random() * 30);
            const time = Math.floor(Math.random() * 600) + 30;
            const maxSpeed = Math.min(15, Math.floor(lines / 10) + 1);
            saveData.leaderboard.push({ score, ..._scoreDate(d), lines, blocks, time, maxSpeed, xp: score });
            const key = LBSave.localDate(d);
            if (!saveData.stats.playHistory) saveData.stats.playHistory = {};
            saveData.stats.playHistory[key] = (saveData.stats.playHistory[key] || 0) + 1;
        }
        saveData.leaderboard.sort((a,b) => b.score - a.score);
        saveDataToFile();
    }

    function openStats() {
        checkProgressAchievements();
        const overlay = document.getElementById('stats-overlay');
        overlay.classList.remove('hidden');
        statsLbTab('general');
        statsTabs[0].focus({ preventScroll: true });
        overlay.scrollTop = 0;
        _animateIn(overlay, 'anim-in-right');
    }

    function statsPercentOfAverage(best, average) {
        return best > 0 && average > 0 ? Math.round(best / average * 100) : null;
    }

    function drawGeneralStats() {
        const { stats, leaderboard } = saveData;
        const averageScore = stats.gamesPlayed > 0 ? (stats.totalScore || 0) / stats.gamesPlayed : 0;
        const bestScore = _bestScore();
        let bestXP = stats.bestEarnedXP || 0;
        let recordedXP = 0;
        let xpRuns = 0;
        for (const { xp } of leaderboard) {
            if (!Number.isFinite(xp)) continue;
            bestXP = Math.max(bestXP, xp);
            recordedXP += xp;
            xpRuns++;
        }
        const formatCount = value => value ? value.toLocaleString() : '—';
        const stat = (name, value) => { document.getElementById('stat-' + name).textContent = value; };
        const comparison = (name, best, average, label) => {
            const percent = statsPercentOfAverage(best, average);
            const element = document.getElementById(`stat-${name}-pct`);
            element.hidden = percent === null;
            element.textContent = percent === null ? '' : `${percent}% of ${label}`;
        };
        stat('best-score', formatCount(bestScore));
        stat('average-score', averageScore > 0 ? Math.round(averageScore).toLocaleString() : '—');
        stat('best-xp', formatCount(bestXP));
        stat('max-combo', stats.maxCombo ? '×' + stats.maxCombo : '—');
        stat('total-xp', formatCount(saveData.totalXP));
        stat('games', formatCount(stats.gamesPlayed));
        stat('time', stats.totalTimePlayed ? formatTime(stats.totalTimePlayed) : '—');
        stat('days-played', formatCount(Object.keys(stats.playHistory || {}).length));
        stat('lines', formatCount(stats.totalLinesCleared));
        stat('blocks', formatCount(stats.totalBlocksPlaced));
        comparison('best-score', bestScore, averageScore, 'your average');
        comparison('best-xp', bestXP, xpRuns ? recordedXP / xpRuns : 0, 'recorded average XP');

        const ownedSkins = (saveData.ownedSkins || ['neon']).filter(_skinAvailable).length;
        const ownedThemes = (saveData.ownedThemes || []).length + 1;
        const ownedGrid = (saveData.ownedGridStyles || []).length + 1;
        const ownedPal = (saveData.ownedPalettes || ['classic']).length;
        const ownedSfx = (saveData.ownedSfxPacks || ['default']).length;
        const collected = ownedSkins + ownedThemes + ownedGrid + ownedPal + ownedSfx + Number(!!saveData.ghostColorUnlocked);
        const total = (_devMode ? 17 : 8) + Object.keys(THEMES).length + Object.keys(GRID_STYLES).length + Object.keys(BLOCK_PALETTES).length + 6;
        stat('items-collected', `${collected} / ${total}`);
        _renderActivityCalendar(document.getElementById('stat-activity-calendar').dataset.calYear || 'recent');
    }
    function _activityDaysThatFit(container) {
        if (!container.clientWidth) return 14;
        const style = getComputedStyle(container);
        const inset = parseFloat(style.getPropertyValue('--recent-inset')) || 4;
        const width = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2 * (inset + 1);
        const cell = parseFloat(style.getPropertyValue('--recent-cell')) || 18;
        const gap = parseFloat(style.getPropertyValue('--recent-gap')) || 3;
        return Math.max(1, Math.floor((width + gap) / (cell + gap)));
    }
    const activityCalendar = document.getElementById('stat-activity-calendar');
    const resizeActivityCalendar = () => {
        if (!activityCalendar.clientWidth || !activityCalendar.dataset.calYear) return;
        const days = _activityDaysThatFit(activityCalendar);
        const recentButton = activityCalendar.querySelector('button[data-cal-year="recent"]');
        if (activityCalendar.dataset.calYear !== 'recent') recentButton.textContent = `Last ${days} days`;
        else if (Number(activityCalendar.dataset.calDays) !== days) {
            const focused = activityCalendar.contains(document.activeElement);
            _renderActivityCalendar('recent');
            if (focused) activityCalendar.querySelector('button[data-cal-year="recent"]').focus({ preventScroll: true });
        }
    };
    const activityCalendarObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resizeActivityCalendar) : null;
    activityCalendarObserver?.observe(activityCalendar);
    window.addEventListener('resize', resizeActivityCalendar);

    function _renderActivityCalendar(mode) {
        const container = document.getElementById('stat-activity-calendar');
        const history = { ...saveData.stats.playHistory };
        const entriesByDate = new Map();
        for (const entry of saveData.leaderboard || []) {
            const key = LBSave.date(entry.date);
            if (!key) continue;
            if (!entriesByDate.has(key)) entriesByDate.set(key, []);
            const entries = entriesByDate.get(key);
            entries.push(entry);
            history[key] = Math.max(history[key] || 0, entries.length);
        }

        const today = new Date();
        const todayKey = LBSave.localDate(today);
        const currentYear = today.getFullYear();
        const years = [...new Set([currentYear, ...Object.keys(history).map(key => Number(key.split('-')[0]))])].sort((left, right) => left - right);
        const year = Number(mode);
        const recent = !years.includes(year);
        container.dataset.calYear = recent ? 'recent' : year;

        const days = recent ? _activityDaysThatFit(container) : (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
        container.dataset.calDays = days;
        const firstDay = recent ? new Date(currentYear, today.getMonth(), today.getDate() - days + 1) : new Date(year, 0, 1);
        const offset = (firstDay.getDay() + 6) % 7;
        const weeks = recent ? days : Math.ceil((offset + days) / 7);
        const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'full' });
        const monthFormat = new Intl.DateTimeFormat('en', { month: 'short' });
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const cells = [];
        const months = [];
        const separators = [];
        let selectedIndex = 0;
        for (let index = 0; index < days; index++) {
            const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + index);
            const key = LBSave.localDate(date);
            const week = recent ? index : Math.floor((offset + index) / 7);
            const weekday = recent ? 0 : (offset + index) % 7;
            if (!recent && date.getDate() === 1) {
                months.push({ label: monthFormat.format(date), start: week, end: week });
                if (index > 0) {
                    const edge = week * 7;
                    const step = weekday * 7;
                    separators.push(step ? `M${edge + 7} 0V${step}H${edge}V49` : `M${edge} 0V49`);
                }
            }
            if (!recent) months.at(-1).end = week;
            if (key === todayKey) selectedIndex = index;
            const count = history[key] || 0;
            const level = count >= 8 ? 4 : count >= 5 ? 3 : count >= 2 ? 2 : count > 0 ? 1 : 0;
            cells.push({ key, week, weekday, level, label: `${dateFormat.format(date)} — ${count.toLocaleString()} ${count === 1 ? 'game' : 'games'}` });
        }

        container.innerHTML = `<div class="lb-stats-chart-toolbar">
                <div class="lb-actions lb-stats-years" role="group" aria-label="Activity range">
                    <button class="lb-block-btn lb-block-tab" type="button" data-cal-year="recent" aria-pressed="${recent}">Last ${recent ? days : _activityDaysThatFit(container)} days</button>
                    ${years.map(value => `<button class="lb-block-btn lb-block-tab" type="button" data-cal-year="${value}" aria-pressed="${!recent && value === year}">${value}</button>`).join('')}
                </div>
            </div>
            <div class="lb-stats-chart${recent ? ' lb-stats-chart--recent' : ''}">
                ${recent ? '' : `<div id="cal-day-labels" aria-hidden="true">${dayLabels.map(label => `<span>${label}</span>`).join('')}</div>`}
                <div class="lb-stats-calendar-scroll" role="region" aria-label="Activity calendar" ${recent ? '' : 'tabindex="0"'}>
                    <div class="lb-stats-calendar" style="--calendar-weeks:${weeks}">
                        ${recent ? '' : `<div id="cal-month-row" aria-hidden="true">${months.map(({ label, start, end }) => `<span style="grid-column:${start + 1}/${end + 2}">${label}</span>`).join('')}</div>`}
                        <div id="cal-grid" role="group" aria-label="${recent ? `Last ${days} days` : year} daily activity">
                            ${recent ? '' : `<svg class="lb-stats-month-edges" aria-hidden="true" viewBox="0 0 ${weeks * 7} 49" preserveAspectRatio="none"><path d="${separators.join(' ')}" vector-effect="non-scaling-stroke"/></svg>`}
                            ${cells.map(({ key, week, weekday, level, label }, index) => `<button type="button" class="lb-stats-day" style="grid-area:${weekday + 1}/${week + 1}" data-cal-day="${index}" data-level="${level}" tabindex="${index === selectedIndex ? 0 : -1}" aria-pressed="${index === selectedIndex}" ${key === todayKey ? 'aria-current="date"' : ''} aria-label="${escapeHtml(label)}"></button>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="lb-stats-chart-foot">
                <output class="lb-stats-day-value">${escapeHtml(cells[selectedIndex].label)}</output>
                <div class="lb-stats-chart-key" aria-label="Games per day: 0, 1, 2 to 4, 5 to 7, 8 or more">
                    <span>Fewer</span>${[0, 1, 2, 3, 4].map(level => `<i data-level="${level}" aria-hidden="true"></i>`).join('')}<span>More</span>
                </div>
            </div>`;

        const todayGames = history[todayKey] || 0;
        const todayEntries = entriesByDate.get(todayKey) || [];
        const todayBestScore = todayEntries.reduce((best, entry) => Math.max(best, entry.score || 0), 0);
        const todayAvgScore = todayEntries.length ? todayEntries.reduce((sum, entry) => sum + (entry.score || 0), 0) / todayEntries.length : 0;
        const todayBestPercent = statsPercentOfAverage(todayBestScore, todayAvgScore);
        const todayTotalTime = todayEntries.reduce((sum, entry) => sum + (entry.time || 0), 0);
        const todayXP = todayEntries.reduce((sum, entry) => sum + (entry.xp || 0), 0);
        container.insertAdjacentHTML('beforeend', `<h3>Today</h3><dl class="lb-stats-metrics lb-stats-today">
            <div><dt>Games</dt><dd>${todayGames.toLocaleString()}</dd></div>
            <div><dt>Best score</dt><dd>${todayBestScore > 0 ? todayBestScore.toLocaleString() : '—'}</dd>${todayBestPercent === null ? '' : `<dd class="lb-stats-comparison">${todayBestPercent}% of today's average</dd>`}</div>
            <div><dt>Average score</dt><dd>${Math.round(todayAvgScore) > 0 ? Math.round(todayAvgScore).toLocaleString() : '—'}</dd></div>
            <div><dt>Time played</dt><dd>${todayTotalTime > 0 ? formatTime(todayTotalTime) : '—'}</dd></div>
            <div><dt>XP earned</dt><dd>${todayXP > 0 ? todayXP.toLocaleString() : '—'}</dd></div>
        </dl>`);

        for (const button of container.querySelectorAll('button[data-cal-year]')) {
            button.addEventListener('click', () => {
                _renderActivityCalendar(button.dataset.calYear);
                container.querySelector('.lb-stats-years [aria-pressed="true"]').focus({ preventScroll: true });
            });
        }
        const grid = container.querySelector('#cal-grid');
        const scroller = container.querySelector('.lb-stats-calendar-scroll');
        const dayButtons = [...grid.querySelectorAll('[data-cal-day]')];
        const value = container.querySelector('.lb-stats-day-value');
        const showValue = index => { value.textContent = cells[index].label; };
        const selectDay = index => {
            dayButtons[selectedIndex].tabIndex = -1;
            dayButtons[selectedIndex].setAttribute('aria-pressed', 'false');
            selectedIndex = index;
            dayButtons[index].tabIndex = 0;
            dayButtons[index].setAttribute('aria-pressed', 'true');
            showValue(index);
        };
        const revealDay = index => {
            if (recent) return;
            const { left, right } = dayButtons[index].getBoundingClientRect();
            const bounds = scroller.getBoundingClientRect();
            if (left < bounds.left + 3) scroller.scrollLeft += left - bounds.left - 3;
            if (right > bounds.right - 3) scroller.scrollLeft += right - bounds.right + 3;
        };
        grid.addEventListener('pointerover', event => {
            if (event.pointerType === 'mouse' && event.target.matches('[data-cal-day]')) showValue(Number(event.target.dataset.calDay));
        });
        grid.addEventListener('pointerleave', () => showValue(selectedIndex));
        grid.addEventListener('click', event => {
            if (event.target.matches('[data-cal-day]')) selectDay(Number(event.target.dataset.calDay));
        });
        grid.addEventListener('keydown', event => {
            if (!event.target.matches('[data-cal-day]')) return;
            const index = Number(event.target.dataset.calDay);
            const weekday = cells[index].weekday;
            const step = recent ? 1 : 7;
            const targets = { ArrowLeft: index - step, ArrowRight: index + step, Home: 0, End: days - 1 };
            if (!recent) Object.assign(targets, { ArrowUp: weekday === 0 ? index : index - 1, ArrowDown: weekday === 6 ? index : index + 1 });
            if (!Object.hasOwn(targets, event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const next = targets[event.key];
            if (next < 0 || next >= days || next === index) return;
            selectDay(next);
            dayButtons[next].focus({ preventScroll: true });
            revealDay(next);
        });
        grid.addEventListener('focusin', event => {
            if (event.target.matches('[data-cal-day]')) revealDay(Number(event.target.dataset.calDay));
        });
        requestAnimationFrame(() => {
            if (scroller.isConnected) revealDay(selectedIndex);
        });
    }
    function statsLbTab(tab) {
        const selected = statsTabs.find(button => button.dataset.statsTab === tab);
        if (!selected) return;
        closeInfo();
        const focusedTab = statsTabs.includes(document.activeElement);
        for (const button of statsTabs) {
            const active = button === selected;
            button.setAttribute('aria-selected', active);
            button.tabIndex = active ? 0 : -1;
            document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
        }
        if (focusedTab && document.activeElement !== selected) selected.focus({ preventScroll: true });
        if (tab === 'general') drawGeneralStats();
        if (tab === 'leaderboard') statsLeaderboardMode('standard');
        if (tab === 'pinned') drawPinnedScores();
        if (tab === 'highscores') _drawHighscoreHistory();
    }

    function statsLeaderboardMode(mode) {
        closeInfo();
        for (const button of document.querySelectorAll('#leaderboard-container [data-stats-board]')) {
            const active = button.dataset.statsBoard === mode;
            button.setAttribute('aria-pressed', active);
            document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
        }
        if (mode === 'fun') _drawFunLeaderboard();
        else drawLeaderboard();
    }

    const statsTabs = Array.from(document.querySelectorAll('#stats-overlay [data-stats-tab]'));
    statsTabs.forEach((button, index) => {
        button.addEventListener('click', () => statsLbTab(button.dataset.statsTab));
        button.addEventListener('keydown', event => {
            const last = statsTabs.length - 1;
            const next = { ArrowLeft: index === 0 ? last : index - 1, ArrowRight: index === last ? 0 : index + 1, Home: 0, End: last }[event.key];
            if (!Number.isInteger(next)) return;
            event.preventDefault();
            statsLbTab(statsTabs[next].dataset.statsTab);
            statsTabs[next].focus({ preventScroll: true });
        });
    });
    document.querySelectorAll('#leaderboard-container [data-stats-board]').forEach(button => {
        button.addEventListener('click', () => statsLeaderboardMode(button.dataset.statsBoard));
    });

    function _drawFunLeaderboard() {
        const container = document.getElementById('fun-list');
        if (!container) return;
        container.innerHTML = '';
        const fl = saveData.funLeaderboard || [];
        if (!fl.length) {
            container.innerHTML = '<p class="lb-block-card lb-empty">No Fun mode games yet.</p>';
            return;
        }
        const lbFmt = (t) => { const m = Math.floor(t/60); const s = t%60; return `${m}m ${String(s).padStart(2,'0')}s`; };
        let _shown = 50;
        function _renderRows(upTo) {
            container.querySelectorAll('.lb-row, .lb-load-more').forEach(el => el.remove());
            const max = Math.min(upTo, fl.length);
            for (let i = 0; i < max; i++) {
                const e = fl[i];
                const div = document.createElement('button'); div.className = 'lb-row';
                const rankColor = i === 0 ? '#ffd700' : i < 3 ? '#c0c0c0' : i < 10 ? '#9b59b6' : '#666';
                const configStr = `${e.cols||10}×${e.rows||20}` + (e.startSpeed && e.startSpeed > 1 ? ` · spd ${e.startSpeed}` : '');
                const details = `<span class="lb-detail">${escapeHtml(configStr)}</span><span class="lb-detail">${lbFmt(e.time||0)}</span><span class="lb-detail">${escapeHtml(e.lines||0)} lines</span>`;
                div.innerHTML = `<span class="lb-rank" style="font-size:0.85rem;font-weight:bold;color:${rankColor};min-width:52px;text-align:center;">#${i+1}</span><span class="lb-score">${escapeHtml(e.score.toLocaleString())} <span class="lb-pts">pts</span></span><span class="lb-details-row">${details}</span><span class="lb-date">${escapeHtml(LBSave.displayDate(e.date, e.clock))}</span>`;
                _bindScoreInfo(div, e, `#${i + 1} Fun`, { board: configStr });
                container.appendChild(div);
            }
            if (max < fl.length) {
                const moreBtn = document.createElement('button');
                moreBtn.className = 'lb-block-btn lb-load-more';
                moreBtn.textContent = `LOAD MORE (${fl.length - max} remaining)`;
                moreBtn.addEventListener('click', () => { _shown += 50; _renderRows(_shown); });
                container.appendChild(moreBtn);
            }
        }
        _renderRows(_shown);
    }

    function closeStats() {
        const _mEl = document.getElementById('menu-overlay');
        _animateOut(document.getElementById('stats-overlay'), 'anim-out-right', () => {
            if (!_mEl.classList.contains('hidden')) document.getElementById('btn-stats').focus();
        });
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

    const settingsMenu = document.querySelector('.lb102-directory');
    const settingsSearch = settingsMenu.querySelector('input');
    const settingsGroups = [...settingsMenu.querySelectorAll('[data-settings-group]')];
    const settingsScroll = document.querySelector('.lb102-settings-scroll');
    const settingsBack = document.getElementById('settings-back');
    const settingsTitle = document.querySelector('#settings-overlay .lb-topbar-title');
    const settingsKicker = document.querySelector('#settings-overlay .lb-topbar-kicker');
    const settingsCategories = new Map([
        ['controls', 'Controls', 'Touch, gestures, vibration', 'game', '<path d="M2 7h20v10H2zm4 5h6m-3-3v6m7-2v.1m3-2v.1"/>', 'key bindings gameplay assistance timing'],
        ['display', 'Display', 'Background, effects, contrast', 'game', '<path d="M3 4h18v13H3zm5 16h8m-4-3v3"/>', 'wallpaper theme palette accent cyan green motion screen'],
        ['audio', 'Audio', 'Music, effects, tempo', 'game', '<path d="M3 9h4l5-4v14l-5-4H3zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>', 'sound volume mute sfx'],
        ['notifications', 'Notifications', 'Reminders, updates', 'app', '<path d="M7 10a5 5 0 0 1 10 0v3l2 3H5l2-3zm3 9h4"/>', 'daily weekly streak missions'],
        ['updates', 'Data & updates', 'Save data and app version', 'app', '<path d="M4 5l8-3 8 3v7c0 5-8 10-8 10s-8-5-8-10z"/>', 'install release notes help credits transfer reset'],
        ['game', 'Gameplay', '', '', '', '', 'controls'],
        ['about', 'Save data and help', '', '', '', '', 'updates'],
    ].map(([key, title, summary, group, icon, keywords, parent]) => {
        const page = document.getElementById(`settings-${key}`);
        const button = group ? document.createElement('button') : document.querySelector(`[data-settings-subpage="${key}"]`);
        if (group) {
            button.type = 'button';
            button.className = 'lb-block-btn lb-ledger-row';
            button.dataset.settingsCategory = key;
            button.dataset.settingsSearch = `${title} ${summary} ${keywords}`.toLowerCase();
            button.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24">${icon}</svg><span><strong>${escapeHtml(title)}</strong><small>${summary}</small></span><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#lb-topbar-next"/></svg>`;
            settingsMenu.querySelector(`[data-settings-group="${group}"]`).append(button);
        }
        button.setAttribute('aria-controls', page.id);
        button.onclick = () => { showSettingsCategory(key); settingsBack.focus(); };
        return [key, { title, button, page, parent }];
    }));
    function filterSettings() {
        const terms = settingsSearch.value.trim().toLowerCase().split(/\s+/);
        for (const group of settingsGroups) {
            for (const button of group.children) button.hidden = !terms.every(term => button.dataset.settingsSearch.includes(term));
            group.parentElement.hidden = [...group.children].every(button => button.hidden);
        }
        settingsMenu.querySelector('.lb102-no-results').hidden = settingsGroups.some(group => !group.parentElement.hidden);
    }
    settingsSearch.addEventListener('input', filterSettings);
    let activeSettingsCategory;
    function showSettingsCategory(key) {
        activeSettingsCategory = settingsCategories.get(key);
        settingsMenu.hidden = !!activeSettingsCategory;
        for (const category of settingsCategories.values()) category.page.hidden = category !== activeSettingsCategory;
        settingsTitle.textContent = activeSettingsCategory?.title || 'Settings';
        settingsKicker.textContent = activeSettingsCategory ? 'Settings' : 'Preferences';
        const isBack = activeSettingsCategory || settingsFromPause;
        settingsBack.querySelector('span').textContent = isBack ? 'Back' : 'Menu';
        settingsScroll.scrollTop = 0;
    }
    settingsBack.onclick = () => {
        if (!activeSettingsCategory) return closeSettings();
        const { button, parent } = activeSettingsCategory;
        controlsEditor.cancel();
        showSettingsCategory(parent);
        (button.hidden ? settingsSearch : button).focus();
    };
    let inventoryPreviewTimer;
    let inventoryPreviewColor = 1;
    let inventoryPreviewPalette;
    let inventoryActivePreview;
    let inventoryPreviewObserver;
    let inventoryActivePreviewNearViewport = false;
    const inventoryStaticPreviews = new Map();

    function _inventorySkinPreview(skin, label, active) {
        const cached = active
            ? inventoryActivePreview?.dataset.skin === skin && inventoryActivePreview
            : inventoryStaticPreviews.get(skin);
        if (cached) return cached;

        const canvas = document.createElement('canvas');
        canvas.className = 'lb-inventory-preview';
        canvas.width = 144; canvas.height = 72;
        canvas.dataset.skin = skin;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${label} block preview`);
        if (active) inventoryActivePreview = canvas;
        else inventoryStaticPreviews.set(skin, canvas);
        return canvas;
    }

    function _observeInventoryPreviews(container) {
        inventoryPreviewObserver?.disconnect();
        inventoryActivePreviewNearViewport = false;
        if (typeof IntersectionObserver === 'function') {
            inventoryPreviewObserver = new IntersectionObserver((entries, observer) => {
                if (observer !== inventoryPreviewObserver) return;
                for (const { target, isIntersecting } of entries) {
                    if (!target.isConnected) continue;
                    if (target === inventoryActivePreview) inventoryActivePreviewNearViewport = isIntersecting;
                    if (!isIntersecting) continue;
                    if (!target.dataset.previewColor) _drawSkinPreview(target, target.dataset.skin, target === inventoryActivePreview ? inventoryPreviewColor : 1);
                    if (target !== inventoryActivePreview) observer.unobserve(target);
                }
            }, { root: container.closest('.lb-inventory-content'), rootMargin: '120px 0px' });
        }
        for (const canvas of container.querySelectorAll('.lb-inventory-preview')) {
            if (inventoryPreviewObserver) {
                if (canvas === inventoryActivePreview || !canvas.dataset.previewColor) inventoryPreviewObserver.observe(canvas);
            } else if (!canvas.dataset.previewColor) {
                _drawSkinPreview(canvas, canvas.dataset.skin, canvas === inventoryActivePreview ? inventoryPreviewColor : 1);
            }
        }
    }

    function inventoryTab(tab) {
        closeInfo();
        const _invOv = document.getElementById('inventory-overlay');
        const _prevInvTab = _invOv ? _invOv._invTab : null;
        if (_invOv) _invOv._invTab = tab;
        document.querySelectorAll('[data-invtab]').forEach(b => {
            const selected = b.dataset.invtab === tab;
            b.classList.toggle('active', selected);
            b.setAttribute('aria-selected', selected);
            b.tabIndex = selected ? 0 : -1;
        });
        document.querySelectorAll('[data-invtab-content]').forEach(p => p.classList.toggle('hidden', p.dataset.invtabContent !== tab));
        document.getElementById('inventory-quantity').hidden = !['crates', 'boosters', 'parts'].includes(tab);
        if (_prevInvTab !== tab) _invOv.querySelector('.lb-inventory-content').scrollTop = 0;
        if (['crates', 'boosters', 'parts', 'other'].includes(tab)) _populateInventoryOther();
        if (tab === 'blocks' || tab === 'colors' || tab === 'fonts') _populateVisualCustomize();
        clearInterval(inventoryPreviewTimer);
        if (tab === 'blocks' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            inventoryPreviewTimer = setInterval(() => {
                if (document.hidden || _invOv.classList.contains('hidden') || !inventoryActivePreview?.isConnected || (inventoryPreviewObserver && !inventoryActivePreviewNearViewport)) return;
                inventoryPreviewColor = inventoryPreviewColor % (BASE_PIECES.length - 1) + 1;
                _drawSkinPreview(inventoryActivePreview, inventoryActivePreview.dataset.skin, inventoryPreviewColor);
            }, 2500);
        }
        if (_prevInvTab && _prevInvTab !== tab) {
            const _ord = ['crates', 'boosters', 'parts', 'blocks', 'colors', 'other'];
            const _oi = _ord.indexOf(_prevInvTab), _ni = _ord.indexOf(tab);
            const _p = document.querySelector(`[data-invtab-content="${tab}"]`);
            if (_p) _animateIn(_p, _ni > _oi ? 'tab-slide-in-right' : 'tab-slide-in-left');
        }
    }
    document.querySelector('.lb-inventory-tabs')?.addEventListener('keydown', event => {
        const tabs = [...event.currentTarget.querySelectorAll('[data-invtab]')];
        const current = tabs.indexOf(event.target);
        if (current < 0) return;
        const next = { ArrowLeft: (current + tabs.length - 1) % tabs.length,
            ArrowRight: (current + 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
        if (typeof next !== 'number') return;
        event.preventDefault();
        inventoryTab(tabs[next].dataset.invtab);
        tabs[next].focus();
    });
    function settingsVisualSubTab(tab) {
        closeInfo();
        document.querySelectorAll('[data-vstab]').forEach(b => b.classList.toggle('active', b.dataset.vstab === tab));
        document.querySelectorAll('[data-vstab-content]').forEach(p => p.classList.toggle('hidden', p.dataset.vstabContent !== tab));
    }
    let _prevMusicVol = defaultSettings.musicVol;
    let _sfxMuted = settings.sfxMuted || false;
    const _SVG_PIX_VOL = `<svg viewBox="0 0 16 16" width="14" height="14" shape-rendering="crispEdges"><rect fill="currentColor" x="0" y="6" width="4" height="4"/><rect fill="currentColor" x="4" y="4" width="2" height="8"/><rect fill="currentColor" x="6" y="2" width="2" height="12"/><rect fill="currentColor" x="10" y="5" width="2" height="6"/><rect fill="currentColor" x="13" y="3" width="2" height="10"/></svg>`;
    const _SVG_PIX_MUTED = `<svg viewBox="0 0 16 16" width="14" height="14" shape-rendering="crispEdges"><rect fill="currentColor" x="0" y="6" width="4" height="4"/><rect fill="currentColor" x="4" y="4" width="2" height="8"/><rect fill="currentColor" x="6" y="2" width="2" height="12"/><rect fill="currentColor" x="10" y="4" width="2" height="2"/><rect fill="currentColor" x="12" y="6" width="2" height="2"/><rect fill="currentColor" x="14" y="8" width="2" height="2"/><rect fill="currentColor" x="12" y="10" width="2" height="2"/><rect fill="currentColor" x="10" y="12" width="2" height="2"/></svg>`;
    const _SVG_PIX_PAUSE = `<svg viewBox="0 0 16 16" width="14" height="14" shape-rendering="crispEdges"><rect fill="currentColor" x="3" y="2" width="4" height="12"/><rect fill="currentColor" x="9" y="2" width="4" height="12"/></svg>`;
    const _SVG_PIX_PLAY = `<svg viewBox="0 0 16 16" width="14" height="14" shape-rendering="crispEdges"><rect fill="currentColor" x="3" y="2" width="2" height="12"/><rect fill="currentColor" x="5" y="4" width="2" height="8"/><rect fill="currentColor" x="7" y="5" width="2" height="6"/><rect fill="currentColor" x="9" y="6" width="2" height="4"/><rect fill="currentColor" x="11" y="7" width="2" height="2"/></svg>`;
    const _SVG_VOL = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
    const _SVG_MUTED = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
    const miniMusicIcon = icon => icon.replace('width="14" height="14"', 'width="11" height="11"');
    function syncMusicMuteButtons() {
        const muted = settings.musicMuted || settings.musicVol === 0;
        const pixel = settings.stylePack === 'pixel';
        const icon = pixel ? (muted ? _SVG_PIX_MUTED : _SVG_PIX_VOL) : (muted ? _SVG_MUTED : _SVG_VOL);
        for (const id of ['music-mute-btn', 'mw-mute', 'pl-mw-mute']) {
            const button = document.getElementById(id);
            if (!button) continue;
            button.innerHTML = id === 'pl-mw-mute' ? miniMusicIcon(icon) : icon;
            button.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
        }
    }

    function toggleMute(type) {
        const isPix = settings.stylePack === 'pixel';
        const svgVol = isPix ? _SVG_PIX_VOL : _SVG_VOL;
        const svgMuted = isPix ? _SVG_PIX_MUTED : _SVG_MUTED;
        if (type === 'music') {
            if (settings.musicVol === 0) {
                settings.musicVol = _prevMusicVol;
                settings.musicMuted = false;
                syncMusicVolumeControl();
            } else {
                settings.musicMuted = !settings.musicMuted;
            }
            syncMusicGain();
            syncMusicMuteButtons();
            if (!settings.musicMuted) _syncMusicPlayback();
            saveSettings();
            if (settings.musicMuted) {
                // mute_jarvis tracking (5s min gap)
                { const _now = Date.now(); if (_now - _lastMuteTime >= 5000) { saveData.stats.muteCount = (saveData.stats.muteCount || 0) + 1; _lastMuteTime = _now; if ((saveData.stats.muteCount || 0) >= 10 && !saveData.achievements?.['mute_jarvis']?.unlocked) { unlockAchievement('mute_jarvis'); } saveDataToFile(); } }
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
    function _inventoryState(equipped, showLabel = false) {
        const label = equipped ? 'Equipped' : 'Locked';
        const path = equipped ? '<path d="m5 12 4 4L19 6"/>' : '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>';
        return `<svg class="lb-inventory-state" ${showLabel ? 'aria-hidden="true"' : `role="img" aria-label="${label}"`} viewBox="0 0 24 24" width="${equipped ? 26 : 18}" height="${equipped ? 26 : 18}" fill="none" stroke="currentColor" stroke-width="${equipped ? 3 : 2}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    }

    function _inventoryEquipButton(label, [type, value]) {
        return `<button type="button" class="lb-inventory-equip-target" aria-label="Equip ${escapeHtml(label)}" data-inventory-equip="${type}" data-equip-value="${value}"></button>`;
    }

    document.getElementById('inventory-overlay')?.addEventListener('click', event => {
        const target = event.target.closest('[data-inventory-equip]');
        if (!target) return;
        const groupId = target.parentElement.parentElement.id;
        const { inventoryEquip: type, equipValue: value } = target.dataset;
        if (type === 'theme') applyTheme(value);
        else if (type === 'skin') applyBlockSkin(value);
        else if (type === 'gridStyle') applyGridStyle(value);
        else if (type === 'btnStyle') applyBtnStyle(value);
        else if (['ghostColor', 'colorPalette', 'sfxPack'].includes(type)) onSettingChange(type, value);
        if (event.detail === 0) document.getElementById(groupId)?.querySelector(':scope > [data-equipped="true"]')?.focus();
    });

    function _makeInventoryRow(label, isActive, isOwned, partCount, equip, onUnlockJs, extraHtml, itemKey, previewPack = '') {
        const equipped = isOwned && isActive;
        const cost = !isOwned && itemKey ? _getItemCost(itemKey) : 0;
        const parts = Math.max(0, Number(partCount) || 0);
        const safeLabel = escapeHtml(label);
        const progress = cost > 0 ? `<div class="lb-inventory-progress">
            <progress class="lb-block-progress" aria-label="${safeLabel} parts" max="${cost}" value="${Math.min(parts, cost)}"></progress>
            <span>${Math.min(parts, cost)}/${cost} parts</span>
        </div>` : '';
        const unlock = cost > 0 && parts >= cost ? `<div class="lb-inventory-controls"><button type="button" class="lb-inventory-action lb-block-btn lb-block-btn--primary" onclick="${onUnlockJs}">Unlock</button></div>` : '';
        return `<div ${itemKey ? `data-item-key="${itemKey}"` : ''} data-owned="${isOwned}" data-equipped="${equipped}" class="inv-row lb-inventory-card lb-inventory-item lb-block-card"${equipped ? ' tabindex="-1"' : ''}>
            ${isOwned && !equipped && equip ? _inventoryEquipButton(label, equip) : ''}
            <div class="lb-inventory-heading">
                <div class="lb-inventory-name">${safeLabel}</div>
                ${equipped || !isOwned ? _inventoryState(equipped) : ''}
            </div>
            ${extraHtml ? `<div class="lb-inventory-detail">${extraHtml}</div>` : ''}
            ${progress}${unlock}
            ${previewPack ? `<button type="button" class="lb-block-btn lb82-sfx-preview" data-sfx-preview="${previewPack}" aria-label="Preview ${safeLabel}">Preview</button>` : ''}
        </div>`;
    }

    function _colorInventoryCard({ key, label, owned, equipped = false, preview = '', detail = '', equip = '', unlock = '' }) {
        const cost = !owned && unlock ? _getItemCost(key) : 0;
        const parts = Math.max(0, Math.min(cost, Number(saveData.parts?.[key]) || 0));
        return `<article class="lb-block-card lb-colors-card"${key ? ` data-item-key="${key}"` : ''} data-owned="${owned}" data-equipped="${equipped}"${equipped ? ' tabindex="-1"' : ''}>
            ${owned && !equipped && equip ? _inventoryEquipButton(label, equip) : ''}
            <header><h3>${label}</h3>${!owned ? `<span class="lb-colors-state">${_inventoryState(false)}</span>` : ''}</header>
            ${preview}${detail ? `<p>${detail}</p>` : ''}
            ${cost ? `<div class="lb-colors-parts"><progress class="lb-block-progress" aria-label="${label} parts" value="${parts}" max="${cost}"></progress><span>${parts}/${cost} parts</span></div>` : ''}
            ${equipped ? `<div class="lb-colors-state lb-inventory-equipped-label">${_inventoryState(true, true)} Equipped</div>` : ''}
            ${cost && parts === cost ? `<div class="lb-colors-actions"><button type="button" class="lb-block-btn lb-block-btn--primary" onclick="${unlock}">Unlock</button></div>` : ''}
        </article>`;
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
                ghostWrap.innerHTML = _makeInventoryRow('Ghost Piece', false, false, 0, '', '', rankUnlockText('Unlocks at Silver I'), '');
            } else {
                const gc = settings.ghostColor || 'white';
                const parts = saveData.parts?.['ghostColor'] || 0;
                const whiteRow = _makeInventoryRow('White Ghost', gc === 'white', true, 0, ['ghostColor', 'white'], '', '', '');
                const coloredOwned = saveData.ghostColorUnlocked;
                const coloredRow = _makeInventoryRow('Colored Ghost', gc === 'colored', Boolean(coloredOwned), parts, ['ghostColor', 'colored'], "window.playerUnlockItem('ghostColor','ghostColor')", 'Ghost matches piece color', 'ghostColor');
                ghostWrap.innerHTML = `<h3 class="lb-inventory-subtitle">Ghost Piece</h3>${whiteRow}${coloredRow}`;
            }
        }

        // Owned skins (in Blocks tab)
        const ownedSkinContainer = document.getElementById('owned-skin-btns');
        if (ownedSkinContainer) {
            const skinNames = SKIN_NAMES;
            const allSkinKeys = Object.keys(skinNames).filter(key => !IMAGE_SKINS.get(key)?.exclusive || saveData.ownedSkins?.includes(key));
            const ownedSkins = allSkinKeys.filter(key => (saveData.ownedSkins || [DEFAULT_BLOCK_SKIN]).includes(key));
            const activeSkin = _renderSkin();
            const displayKeys = ownedSkins.includes(activeSkin)
                ? [activeSkin, ...allSkinKeys.filter(key => key !== activeSkin)] : allSkinKeys;
            const skinCountEl = document.getElementById('skin-owned-count');
            if (skinCountEl) skinCountEl.innerText = `(${ownedSkins.length}/${allSkinKeys.length})`;
            const rows = displayKeys.map(s => {
                const isOwned = ownedSkins.includes(s);
                const isActive = activeSkin === s;
                const parts = saveData.parts?.[s] || 0;
                return _makeInventoryRow(
                    skinNames[s],
                    isActive, isOwned, parts,
                    ['skin', s],
                    `window.playerUnlockItem('skin','${s}')`,
                    escapeHtml(LBLineClear.description(s)), s
                );
            }).join('');
            const previewPalette = [COLORS.join(','), settings.colorPalette, Boolean(saveData.customPaletteOverrides?.classic), window.devicePixelRatio].join('|');
            if (inventoryPreviewPalette !== previewPalette) {
                inventoryPreviewPalette = previewPalette;
                inventoryStaticPreviews.clear();
                inventoryActivePreview = null;
            }
            ownedSkinContainer.innerHTML = rows;
            ownedSkinContainer.querySelectorAll('[data-item-key]').forEach(row => {
                const skin = row.dataset.itemKey;
                row.querySelector('.lb-inventory-heading').after(_inventorySkinPreview(skin, skinNames[skin], skin === activeSkin));
            });
            _observeInventoryPreviews(ownedSkinContainer);
        }

        const ownedThemeContainer = document.getElementById('owned-theme-btns');
        if (ownedThemeContainer) {
            const themeNames = { default:'Default', ocean:'Ocean', forest:'Forest', fire:'Fire', dragon:'Golden', void:'Void', sunset:'Sunset', arctic:'Arctic', midnight:'Midnight', sakura:'Sakura' };
            const themes = Object.entries(themeNames);
            const ownedThemes = new Set([...FREE_THEMES, ...(saveData.ownedThemes || [])]);
            document.getElementById('theme-owned-count').textContent = `${themes.filter(([key]) => ownedThemes.has(key)).length}/${themes.length}`;
            const rows = themes.map(([key, label]) => {
                const owned = ownedThemes.has(key);
                const equipped = settings.theme === key;
                const color = THEMES[key].primary;
                return _colorInventoryCard({ key, label, owned, equipped,
                    preview: `<div class="lb-inventory-theme-swatch"><span class="lb-colors-chip" aria-hidden="true" style="--swatch:${color}"></span>${owned ? `<button type="button" class="lb-block-btn lb-block-btn--icon" aria-label="Copy ${label} colour" onclick="navigator.clipboard?.writeText('${color}').catch(() => {});_showCopyFeedback(event.clientX,event.clientY)"><span aria-hidden="true">${_SVG_COPY}</span></button>` : ''}</div>`,
                    equip: ['theme', key],
                    unlock: `window.playerUnlockItem('theme','${key}')` });
            }).join('');
            ownedThemeContainer.innerHTML = rows + (_allThemesOwned()
                ? _colorPickerButton('custom-theme-picker-button', 'Custom Color', LBColorPicker.normalizeHex(saveData.customThemeColor) || '#ff00ff', settings.theme === 'custom', '_openColorPickerModal')
                : _colorInventoryCard({ label: 'Custom Color', owned: false, detail: 'Own all themes to unlock' }));
        }

        const ownedPaletteContainer = document.getElementById('owned-palette-btns');
        if (ownedPaletteContainer) {
            const palettes = Object.entries(BLOCK_PALETTES);
            const ownedPalettes = new Set(saveData.ownedPalettes || []);
            const allPalettesOwned = _allPalettesOwned();
            document.getElementById('palette-owned-count').textContent = `${palettes.filter(([key, palette]) => palette.free || ownedPalettes.has(key)).length}/${palettes.length}`;
            const rows = palettes.map(([key, palette]) => {
                const owned = palette.free || ownedPalettes.has(key);
                const equipped = (settings.colorPalette || 'classic') === key;
                const colors = paletteColors(saveData.customPaletteOverrides?.[key], palette.colors);
                return _colorInventoryCard({ key, label: palette.name, owned: !!owned, equipped,
                    preview: `<button type="button" class="lb-block-btn lb-palette-preview" aria-label="Preview ${palette.name} palette" onclick="window._openPaletteViewModal('${key}')">${_palettePiecePreviews(colors)}</button>`,
                    equip: ['colorPalette', key],
                    unlock: `window.playerUnlockItem('palette','${key}')` });
            }).join('');
            const shuffle = `<div class="lb-colors-shuffle">
                <div><strong>Shuffle Colors</strong><p>Colors not fixed to piece types</p></div>
                <label class="lb-block-switch"><input type="checkbox" role="switch" aria-label="Shuffle Colors" ${settings.randomPieceColors ? 'checked' : ''} onchange="window.onSettingChange('randomPieceColors',this.checked)"><span class="toggle-slider" aria-hidden="true"></span></label>
            </div>`;
            const randomEquipped = allPalettesOwned && !!settings.randomBlockColors;
            const random = _colorInventoryCard({ key: '_randomColors', label: 'Random Colors', owned: allPalettesOwned, equipped: randomEquipped,
                detail: allPalettesOwned ? 'Every block is a different random color' : 'Own all palettes to unlock',
                equip: ['colorPalette', '_random'] });
            const custom = allPalettesOwned
                ? _colorPickerButton('custom-palette-picker-button', 'Custom Palette', `conic-gradient(${_customPaletteColors().join(', ')})`, settings.colorPalette === '_custom_picker', '_openCustomPaletteModal')
                : _colorInventoryCard({ label: 'Custom Palette', owned: false, detail: 'Own all palettes to unlock' });
            ownedPaletteContainer.innerHTML = shuffle + rows + random + custom;
        }

        // Button styles (in Blocks tab)
        const ownedBtnStyleContainer = document.getElementById('owned-btn-style-btns');
        if (ownedBtnStyleContainer) {
            const owned = saveData.ownedBtnStyles || [];
            const rows = Object.entries(BTN_STYLES)
                .map(([k, bs]) => {
                    const isOwned = bs.free || owned.includes(k);
                    const parts = saveData.parts?.[k] || 0;
                    return _makeInventoryRow(bs.name, settings.btnStyle === k, isOwned, parts,
                        ['btnStyle', k],
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
                return _makeInventoryRow(gs.name, isActive, isOwned, parts,
                    ['gridStyle', k],
                    `window.playerUnlockItem('gridStyle','${k}')`,
                    '', k
                );
            }).join('');
            ownedGridContainer.innerHTML = gridStyleRows;
            function _drawGridPreview(style) {
                const GC = 5, GR = 7, BS = 16;
                const gc = document.createElement('canvas');
                gc.width = GC * BS; gc.height = GR * BS;
                const gx = gc.getContext('2d');
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
                const key = row.dataset.itemKey;
                const canvas = _drawGridPreview(key);
                canvas.className = 'lb-inventory-grid-preview';
                canvas.setAttribute('role', 'img');
                canvas.setAttribute('aria-label', `${GRID_STYLES[key].name} grid preview`);
                row.querySelector('.lb-inventory-heading').after(canvas);
            });
        }

        // Background toggle

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
        const overlay = document.createElement('div');
        overlay.id = 'exc-modal-overlay';
        overlay.className = 'lb-exchange-overlay';
        overlay.innerHTML = `
            <div class="lb-block-dialog lb-exchange-dialog" role="dialog" aria-modal="true" aria-labelledby="exc-title">
                <h2 id="exc-title" class="lb-block-dialog-title">Booster Exchange</h2>
                <p>Trade three boosters for one of the next tier.</p>
                <div class="lb-exchange-pair">
                    ${[fromKey, toKey].map((key, index) => {
                        const item = BOOSTER_META[key];
                        return _exchangeItemCard({ name: item.label, art: LBArtPack.boosterIcon(key), rarity: item.rarity,
                            count: saveData.boosters?.[key] || 0, detail: `${index === 0 ? 'Spend' : 'Receive'} · ${item.rarity}`,
                            amountId: index === 0 ? 'exc-spend' : 'exc-receive', amount: index === 0 ? '3' : '+1' });
                    }).join('<span class="lb-exchange-arrow" aria-hidden="true">→</span>')}
                </div>
                ${_exchangeQuantity('exc-quantity', 'Sets to exchange', maxSets, 1)}
                <div class="lb-block-dialog-actions">
                    <button type="button" class="lb-block-btn" onclick="window._closeModal('exc-modal-overlay')">Cancel</button>
                    <button type="button" class="lb-block-btn lb-block-btn--primary" id="exc-confirm">Exchange</button>
                </div>
            </div>`;
        const getQuantity = _bindExchangeQuantity(overlay, sets => {
            overlay.querySelector('#exc-spend').textContent = sets * 3;
            overlay.querySelector('#exc-receive').textContent = `+${sets}`;
        });
        overlay.querySelector('#exc-confirm').addEventListener('click', () => window._doExchange(fromKey, toKey, type, getQuantity()));
        overlay.addEventListener('click', e => { if (e.target === overlay) window._closeModal('exc-modal-overlay'); });
        document.body.appendChild(overlay);
        _animateIn(overlay.querySelector('div'), 'anim-in-down');
    }
    function exchangeBoosters(from, to) { _openExchangeModal(from, to, 'booster'); }
    function _populateInventoryOther() {
        const container = document.getElementById('inventory-other-content');
        if (!container) return;
        const boosterPanel = document.getElementById('inventory-boosters');
        const partsPanel = document.getElementById('inventory-parts');
        const boosters = saveData.boosters || {};
        const ownedBoosters = BOOSTER_KEYS.reduce((total, key) => total + (boosters[key] || 0), 0);
        const boosterTypes = BOOSTER_KEYS.filter(key => boosters[key] > 0).length;
        const locker = (category, detail, art, help = '') => `
            <section class="lb-collection-feature">
                <div><span class="lb-collection-label">Locker</span><h2>Stored ${category.toLowerCase()}</h2><p>${detail}</p></div>${art}
            </section>
            <div class="lb-collection-rule">
                <span class="lb-collection-label">${category}</span>${help}<span class="lb-collection-label">Quantity</span>
            </div>`;

        // Universal parts section
        const _uniVal = saveData.universalParts || 0;
        const activeTab = document.getElementById('inventory-overlay')._invTab;
        const crates = saveData.storedCrates || [];
        const stockTotals = { crates: crates.length, boosters: ownedBoosters, parts: Number(_uniVal.toFixed(1)) };
        if (activeTab === 'crates') LBCrates.renderLocker(document.getElementById('inventory-crates'), crates, _openStoredCrates);
        if (Object.hasOwn(stockTotals, activeTab)) {
            document.getElementById('inventory-quantity').textContent = `${stockTotals[activeTab].toLocaleString('en-US')} owned`;
        }
        const exchangeForXP = _getAllPartsItems().length === 0;
        const uniRow = `<div class="lb-block-card lb-exchange-row lb-inventory-parts">
            <div class="lb-exchange-row-art">${_exchangePartsIcon()}</div>
            <div class="lb-exchange-row-detail">
                <strong class="lb-help-label">Universal Parts <button type="button" class="lb-info-btn" data-help-section="boxes" aria-label="About universal parts" data-control-tip="About universal parts"></button></strong>
                <div class="lb-inventory-progress lb-inventory-universal-progress">
                    <progress class="lb-block-progress" aria-label="Progress toward one usable universal part" max="1" value="${Math.min(1, _uniVal)}"></progress>
                    <span>${Number(_uniVal.toFixed(1))} owned</span>
                </div>
            </div>
            <button type="button" class="lb-block-btn lb-block-btn--primary" data-use-parts ${_uniVal < 1 ? 'disabled' : ''}>${exchangeForXP ? 'Exchange' : 'Use'}</button>
        </div>`;

        // Boosters section
        const boosterHtml = BOOSTER_KEYS.map((key, i) => {
            const meta = BOOSTER_META[key];
            const count = boosters[key] || 0;
            const nextKey = BOOSTER_KEYS[i + 1];
            return `<div class="lb-block-card lb-inventory-booster" data-rarity="${meta.rarity}">
                <div class="lb-inventory-booster-stock">${LBArtPack.boosterIcon(key)}</div>
                <div class="lb-inventory-booster-copy"><strong>${meta.label}</strong><span class="lb-exchange-rarity">${meta.rarity}</span></div>
                <span class="lb-collection-quantity lb-ledger-tag">×${count}</span>
                ${nextKey ? `<button type="button" class="lb-block-btn lb-block-btn--primary" aria-label="Exchange ${meta.label}" data-exchange-booster="${i}" ${count < 3 ? 'disabled' : ''}>Exchange</button>` : ''}
            </div>`;
        }).join('');

        // SFX Packs section
        const _sfxPackDefs = [
            { key: '', label: 'Default SFX', packId: 'default' },
            { key: 'sfxRetro', label: 'Retro SFX', packId: 'retro' },
            { key: 'sfxArcade', label: 'Arcade SFX', packId: 'arcade' },
            { key: 'sfxCyber', label: 'Cyber SFX', packId: 'cyber' },
            { key: 'sfxZen', label: 'Zen SFX', packId: 'zen' },
        ];
        const _ownedSfx = saveData.ownedSfxPacks || ['default'];
        const _activeSfxPack = settings.sfxPack || 'default';
        const sfxPacksHtml = _sfxPackDefs.map(p => {
            const owned = p.packId === 'default' || _ownedSfx.includes(p.packId);
            const active = _activeSfxPack === p.packId;
            const parts = saveData.parts?.[p.key] || 0;
            return _makeInventoryRow(p.label, active, owned, parts,
                ['sfxPack', p.packId],
                `window.playerUnlockItem('sfxPack','${p.key}')`,
                '', p.key, p.packId);
        }).join('');

        partsPanel.innerHTML = locker('Parts', 'Universal parts unlock items or exchange for XP.', _exchangePartsIcon()) + uniRow;
        boosterPanel.innerHTML = locker('Boosters', `${boosterTypes} ${boosterTypes === 1 ? 'type' : 'types'} in your collection`,
            LBArtPack.boosterIcon(BOOSTER_KEYS.find(key => boosters[key] > 0) || BOOSTER_KEYS[0]),
            '<button type="button" class="lb-info-btn" data-help-section="boosters" aria-label="About boosters" data-control-tip="About boosters"></button>') +
            `<div class="lb-inventory-boosters">${boosterHtml}</div>`;
        container.innerHTML = `
            <section id="inventory-sfx-packs" class="lb-block-card lb-inventory-section lb82-sfx-packs">
                <h2 class="lb-block-section-title">SFX Packs</h2>
                ${sfxPacksHtml}
            </section>`;
        partsPanel.querySelector('[data-use-parts]').addEventListener('click', exchangeForXP ? openExchangeUniversalParts : openUseUniversalPart);
        boosterPanel.querySelectorAll('[data-exchange-booster]').forEach(button => button.addEventListener('click', () => {
            const index = Number(button.dataset.exchangeBooster);
            exchangeBoosters(BOOSTER_KEYS[index], BOOSTER_KEYS[index + 1]);
        }));

        container.querySelectorAll('[data-sfx-preview]').forEach(preview => {
            preview.addEventListener('click', () => _openSfxPreviewPopup(preview.dataset.sfxPreview, preview));
        });
    }

    function _openSfxPreviewPopup(packId, opener) {
        document.getElementById('sfx-inv-preview')?.remove();
        const _sfxPlayFns = { default: playSFX, cyber: _playSFX_B, retro: _playSFX_C, zen: _playSFX_D, arcade: _playSFX_E };
        const _sfxPackNames = { default: 'Default', cyber: 'Cyber', retro: 'Retro', zen: 'Zen', arcade: 'Arcade' };
        const playFn = _sfxPlayFns[packId] || playSFX;
        const sfxList = [
            { name: 'clear', desc: 'Line clear' },
            { name: 'drop', desc: 'Block placed' },
            { name: 'levelup', desc: 'Run level up' },
            { name: 'click', desc: 'UI click' },
            { name: 'gameover', desc: 'Game over' },
            { name: 'unlock', desc: 'Item unlocked' },
            { name: 'gift', desc: 'Gift claimed' },
            { name: 'booster', desc: 'Booster used' },
            { name: 'achievement', desc: 'Achievement' },
            { name: 'rankup', desc: 'Level up' },
            { name: 'newrank', desc: 'New rank' },
        ];
        const ov = document.createElement('dialog');
        ov.id = 'sfx-inv-preview';
        ov.className = 'lb-block-dialog';
        ov.setAttribute('aria-labelledby', 'sfx-inv-title');
        ov.innerHTML = `<div class="lb-inventory-sfx-head">
            <h2 class="lb-block-dialog-title" id="sfx-inv-title">${_sfxPackNames[packId] || packId} SFX</h2>
            <button type="button" class="lb-block-btn lb-block-btn--icon" aria-label="Close sound preview" autofocus onclick="this.closest('dialog').close()"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
        </div>
        <div class="lb-inventory-sound-list">
            ${sfxList.map(sound => `<button type="button" class="lb-block-btn sfx-prev-row" aria-label="Play ${sound.desc.toLowerCase()}" data-sfx="${sound.name}">
                <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M4 2.5v11L13 8z"/></svg>
                ${sound.desc}
            </button>`).join('')}
        </div>`;
        ov.addEventListener('click', e => {
            if (e.target !== ov) return;
            const bounds = ov.getBoundingClientRect();
            if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) ov.close();
        });
        ov.addEventListener('close', () => { ov.remove(); opener.focus(); });
        document.body.appendChild(ov);
        ov.showModal();
        _animateIn(ov, 'anim-in-up');
        ov.querySelectorAll('.sfx-prev-row').forEach(row => {
            row.addEventListener('click', () => playFn(row.dataset.sfx));
        });
    }
    function _grantRarityCrate(rarity, daily) {
        return LBCrates.grantDailyGift(saveData, LBCrates.giftContents(rarity), {
            pickParts: count => _weightedPickParts(_getPartsEligibleItems(), count), addPart: addPartsToItem,
            partName: _partItemName, addUniversal: addUniversalParts, addBooster: addBoosterToSave, boosterInfo: BOOSTER_INFO,
        }, daily);
    }

    function _openStoredCrates(rarity) {
        const inventory = document.getElementById('inventory-overlay');
        if (inventory.classList.contains('hidden') || inventory._invTab !== 'crates' || document.querySelector('.lb-reward-overlay')) return;
        const stock = saveData.storedCrates || [];
        const index = rarity ? stock.findIndex(crate => crate.rarity === rarity) : 0;
        if (!stock.length || index < 0) return;
        const crates = stock.splice(index, rarity ? 1 : stock.length);
        const cards = crates.flatMap(crate => {
            if (crate.source === 'legacy') return crate.rewards;
            if (crate.source === 'level') return _generateLevelBoxRewards();
            if (crate.source === 'mission') return _grantMissionCrateParts(crate.amount);
            return _grantRarityCrate(crate.rarity, crate.source === 'daily');
        });
        saveDataToFile();
        _populateInventoryOther();
        _checkGlowNotifications();
        playSFX('gift');
        LBCrates.showCrateReveal(crates[0].rarity, crates.length, _crateRewardGrid(cards), () => {
            const next = inventory.querySelector(rarity ? `[data-crate-rarity="${rarity}"]` : '.lb43-open-all:not([hidden])');
            (next || inventory.querySelector('[data-crate-rarity]') || document.getElementById('inventory-tab-crates')).focus({ preventScroll: true });
        });
        checkProgressAchievements();
    }

    function _checkGlowNotifications() {
        // Check if any parts item is ready to unlock (parts >= cost)
        const allItems = _getAllPartsItems();
        const readyItems = allItems.filter(item => (saveData.parts?.[item.key] || 0) >= _getItemCost(item.key));
        // Tab glow: blocks tab has skins, colors tab has themes, other tab has ghostColor/gridStyle/music
        const skinReady = readyItems.some(i => ['skin', 'ghostColor', 'gridStyle'].includes(i.cat));
        const themeReady = readyItems.some(i => i.cat === 'theme' || i.cat === 'palette');
        const otherReady = readyItems.some(i => i.cat === 'sfxPack');
        document.querySelectorAll('[data-invtab]').forEach(btn => {
            const tab = btn.dataset.invtab;
            const hasReady = (tab === 'blocks' && skinReady) || (tab === 'colors' && themeReady) || (tab === 'other' && otherReady);
            btn.classList.toggle('glow-notify', hasReady);
        });
        // Inventory button glow in main menu
        const invReady = readyItems.length > 0 || Boolean(saveData.storedCrates?.length);
        document.getElementById('btn-inventory').toggleAttribute('data-ready', invReady);
        // Achievements button glow when there are pending XP claims
        _checkAchGlow();
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
        document.getElementById('btn-missions').toggleAttribute('data-ready', Boolean(_hasMissionReward));
    }
    function fillScreenAfterPaint(overlay, fill) {
        const request = {};
        overlay.screenFill = request;
        return new Promise((resolve, reject) => requestAnimationFrame(() => requestAnimationFrame(() => {
            setTimeout(() => {
                if (overlay.screenFill !== request || overlay.classList.contains('hidden')) return resolve();
                try { resolve(fill()); }
                catch (error) { reject(error); }
                finally { overlay.screenFill = null; }
            }, 0);
        })));
    }

    function hideMenuScreen(overlay) {
        closeInfo();
        overlay.screenFill = null;
        overlay.classList.add('hidden');
    }

    function openInventory(tab = 'blocks') {
        const overlay = document.getElementById('inventory-overlay');
        overlay.classList.remove('hidden');
        return fillScreenAfterPaint(overlay, () => {
            inventoryTab(tab);
            overlay.querySelector('.lb-inventory-content').scrollTop = 0;
            _checkGlowNotifications();
        });
    }
    function closeInventory() {
        clearInterval(inventoryPreviewTimer);
        inventoryPreviewObserver?.disconnect();
        inventoryPreviewObserver = undefined;
        hideMenuScreen(document.getElementById('inventory-overlay'));
    }

    // --- UI CONTROL HELPERS ---
    function syncMusicVolumeControl() {
        const value = settings.musicVol;
        document.getElementById('setting-music-vol').value = value;
        document.getElementById('setting-music-val').innerText = value + '%';
        _cPillSync('music', value);
    }

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
        fill.style.width = `${Number(pct.toFixed(1))}%`;
    }

    let settingsFromPause = false;
    function openSettings(fromPause = false, category) {
        const overlay = document.getElementById('settings-overlay');
        settingsFromPause = fromPause;
        closeInfo();
        document.getElementById(fromPause ? 'pause-overlay' : 'menu-overlay').classList.add('hidden');
        overlay.classList.remove('hidden');
        settingsSearch.value = '';
        filterSettings();
        showSettingsCategory(category);
        return fillScreenAfterPaint(overlay, () => {
            if (!overlay.contains(document.activeElement)) settingsBack.focus({ preventScroll: true });
            syncSettingsControls();
        });
    }
    function syncSettingsControls() {
        controlsEditor.render();
        _reminders?.render();
        _musicFollowsSpeedToggle.checked = settings.musicFollowsSpeed !== false;
        const sv = settings.sfxVol;
        syncMusicVolumeControl();
        document.getElementById('setting-sfx-vol').value = sv;
        _cPillSync('sfx', sv);
        const svEl0 = document.getElementById('setting-sfx-val'); if (svEl0) svEl0.innerText = sv + '%';
        const isPix = settings.stylePack === 'pixel';
        syncMusicMuteButtons();
        const sfxMuteBtn = document.getElementById('sfx-mute-btn');
        if (sfxMuteBtn) sfxMuteBtn.innerHTML = _sfxMuted ? (isPix ? _SVG_PIX_MUTED : _SVG_MUTED) : (isPix ? _SVG_PIX_VOL : _SVG_VOL);
        // SFX Pack dropdown sync
        const _sfxSel = document.getElementById('setting-sfx-pack');
        if (_sfxSel) {
            const _ownedPacks = saveData.ownedSfxPacks || ['default'];
            const _packLabels = { default: 'Default', cyber: 'Cyber', retro: 'Retro', zen: 'Zen', arcade: 'Arcade' };
            _sfxSel.innerHTML = _ownedPacks.map(p => `<option value="${escapeHtml(p)}"${settings.sfxPack === p ? ' selected' : ''}>${escapeHtml(_packLabels[p] || p)}</option>`).join('');
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
        if (hdlSlider) hdlSlider.style.display = settings.hardDropLock ? '' : 'none';
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
        _lineClearEffectSelect.value = settings.lineClearEffect;
        _themeBackgroundSelect.value = LBArtPack.backgroundMode(settings.themeBackground);
        _movingBackgroundToggle.checked = settings.movingBackground !== false;
        _runMissionsSelect.value = settings.showRunMissions === true ? 'on' : 'off';
    }
    async function resetAllProgress() {
        if (_readOnlyRawSave) { customAlert('This version cannot change your save.', 'SAVE IS READ-ONLY'); return; }
        const phrase = 'RESET MY PROGRESS';
        const overlay = document.createElement('div');
        const opener = document.activeElement;
        overlay.className = 'lb-block-reset-overlay';
        overlay.setAttribute('role', 'alertdialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'reset-progress-title');
        overlay.setAttribute('aria-describedby', 'reset-progress-description');
        overlay.innerHTML = `
            <div class="lb-block-dialog lb-block-dialog--warning">
                <h2 class="lb-block-dialog-title" id="reset-progress-title">Reset all progress</h2>
                <p id="reset-progress-description">This will permanently delete <strong>all XP, scores, unlocks, and achievements</strong>.</p>
                <label for="reset-phrase-input">Type <strong>${phrase}</strong> to confirm.</label>
                <input id="reset-phrase-input" type="text" autocomplete="off" spellcheck="false">
                <p id="reset-phrase-error" role="status" hidden>Incorrect phrase. Try again.</p>
                <div class="lb-block-dialog-actions">
                    <button type="button" class="lb-block-btn" id="reset-cancel-btn">Cancel</button>
                    <button type="button" class="lb-block-btn lb-block-btn--danger" id="reset-confirm-btn">Reset</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const inp = overlay.querySelector('#reset-phrase-input');
        const error = overlay.querySelector('#reset-phrase-error');
        const cancel = () => { overlay.remove(); opener?.focus(); };
        overlay.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            if (e.key === 'Enter' && e.target === inp) { e.preventDefault(); overlay.querySelector('#reset-confirm-btn').click(); }
        });
        inp.focus();
        overlay.querySelector('#reset-cancel-btn').onclick = cancel;
        overlay.querySelector('#reset-confirm-btn').onclick = async (e) => {
            e.preventDefault();
            if (inp.value !== phrase) { inp.setAttribute('aria-invalid', 'true'); error.hidden = false; inp.select(); inp.focus(); return; }
            overlay.remove();
            saveData = JSON.parse(JSON.stringify(defaultSaveData));
            // Reset visual settings to defaults so owned items show correctly
            settings.skin = DEFAULT_BLOCK_SKIN;
            settings.theme = 'default';
            settings.ghostColor = 'white';
            settings.gridStyle = 'lines';
            settings.colorPalette = 'classic';
            settings.randomBlockColors = false;
            settings.sfxPack = 'default';
            settings.btnStyle = 'square';
            // Save settings directly to localStorage (no file write) to avoid concurrent write race
            persistSettings();
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
        const overlay = document.getElementById('settings-overlay');
        if (overlay.classList.contains('hidden')) return;
        const fromPause = settingsFromPause;
        hideMenuScreen(overlay);
        settingsFromPause = false;
        const parent = document.getElementById(fromPause ? 'pause-overlay' : 'menu-overlay');
        parent.classList.remove('hidden');
        if (fromPause) {
            document.getElementById('pause-settings').focus({ preventScroll: true });
        } else {
            requestAnimationFrame(() => {
                if (!parent.classList.contains('hidden') && (document.activeElement === document.body || overlay.contains(document.activeElement))) {
                    document.getElementById('btn-settings').focus({ preventScroll: true });
                }
            });
        }
    }
    function toggleInstructions() {
        const hidden = document.getElementById('instr-content').classList.toggle('hidden');
        document.getElementById('instr-arrow').innerText = hidden ? '▶' : '▼';
    }
    function onSettingChange(key, value) {
        if (key === 'musicFollowsSpeed') {
            settings.musicFollowsSpeed = value === true;
            _syncGameMusicTempo();
            saveSettingsDebounced(); return;
        } else if (key === 'showSpeedUp') {
            settings.showSpeedUp = value === true;
            saveSettings(); return;
        } else if (key === 'musicVol') {
            if (settings.musicVol > 0) _prevMusicVol = settings.musicVol;
            settings.musicVol = parseInt(value);
            syncMusicVolumeControl();
            syncMusicGain();
            syncMusicMuteButtons();
            if (settings.musicVol > 0 && !settings.musicMuted) _syncMusicPlayback();
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
            _syncRunMissions();
            const gsSl = document.getElementById('slider-gamescale'); if (gsSl) gsSl.value = value;
            const gsVEl = document.getElementById('gamescale-step-val'); if (gsVEl) gsVEl.innerText = value;
            const gsFEl = document.getElementById('gamescale-step-fill'); if (gsFEl) gsFEl.style.width = ((parseInt(value)-1)/9*100).toFixed(1)+'%';
            saveSettingsDebounced(); return;
        } else if (key === 'uiTheme') {
            if (!['dark', 'light', 'system'].includes(value)) return;
            settings.uiTheme = value;
            syncUiTheme();
        } else if (key === 'themeBackground') {
            settings.themeBackground = LBArtPack.backgroundMode(value);
            syncWallpaperArt(settings.theme);
            syncWallpaper();
        } else if (key === 'movingBackground') {
            settings.movingBackground = value === true;
            syncWallpaper();
        } else if (key === 'showRunMissions') {
            settings.showRunMissions = value === true;
            _syncRunMissions(true);
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
            if (sliderEl) sliderEl.style.display = value ? '' : 'none';
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
        if (key === 'lineClearEffect') {
            settings.lineClearEffect = LBLineClear.normalizeMode(value);
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
        if (_qaDemo) return;
        try {
            const data = _readOnlyRawSave || LBSave.serializeSave({ ...saveData, _settings: settings }, WEEKLY_MISSION_POOL);
            const saveFile = _encSave(JSON.stringify({ version: 3, data }, null, 2));
            downloadFile('linebreaker_save.lbsave', saveFile);
            customAlert('Save file (.lbsave) downloaded. Your progress was NOT reset.', 'EXPORT SUCCESS', false);
        } catch(e) {
            customAlert('Could not export your save. Please try again.', 'EXPORT ERROR', false);
        }
    }

    function handleFileImport(event) {
        if (_qaDemo) return;
        if (_readOnlyRawSave) { customAlert('This version cannot replace your save.', 'SAVE IS READ-ONLY'); event.target.value = ''; return; }
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(e) {
            let importedData = null;
            try {
                const raw = e.target.result.trim();
                const parsed = JSON.parse(_decSave(raw) ?? raw);
                importedData = parsed.data || parsed;
            } catch(err) {}
            if (LBNativeSave.schemaOf(importedData) > LBSave.version) {
                customAlert('This save requires a newer version of Linebreaker.', 'SAVE IMPORT');
            } else if (importedData && typeof importedData.totalXP === 'number') {
                const confirmed = await customConfirm("Importing will <b>OVERWRITE</b> your current progress. Proceed?");
                if (!confirmed) { document.getElementById('file-import-input').value = ''; return; }
                const { skinNotice } = applyLoadedData(importedData, false);
                // save_transfer achievement
                if (!saveData.achievements) saveData.achievements = {};
                if (!saveData.achievements['save_transfer']?.unlocked) unlockAchievement('save_transfer');
                saveDataToFile(); drawRankBadge();
                customAlert(`Progress restored from file!${skinNotice ? `<br><br>${skinNotice}` : ''}`, "SUCCESS", false, () => { closeTransferMenu(); });
            } else {
                customAlert("Invalid or unrecognised save file!", "ERROR", true);
            }
            document.getElementById('file-import-input').value = '';
        };
        reader.readAsText(file);
    }
    
    function _scoreDate(date = new Date()) {
        return { date: LBSave.localDate(date), clock: LBSave.localClock(date) };
    }
    function _bestScore() { return saveData.leaderboard?.[0]?.score || 0; }
    function saveToLeaderboard(score, lines, blocks, time, maxSpeed, xp, maxCombo, playedAt = _scoreDate()) {
        saveData.leaderboard.push({ score, ...playedAt, lines, blocks, time, maxSpeed, xp, maxCombo: maxCombo || 0 });
        saveData.leaderboard.sort((a,b) => b.score - a.score);
    }

    let _lastGameStats = null; // stores stats from most recent game for pinning

    function pinScore(score, lines, blocks, time, maxSpeed, xp, note, playedAt = _scoreDate()) {
        if (!saveData.pinnedScores) saveData.pinnedScores = [];
        saveData.pinnedScores.push({ score, date: playedAt.date, clock: playedAt.clock, lines, blocks, time, maxSpeed, xp, note: note || '' });
        if (saveData.pinnedScores.length > 50) saveData.pinnedScores = saveData.pinnedScores.slice(-50);
        // pin_record achievement — pinned score equals the top leaderboard score (works with dev-added scores too)
        const _effectiveHS = _bestScore();
        if (score === _effectiveHS && _effectiveHS > 0 && !saveData.achievements?.['pin_record']?.unlocked) unlockAchievement('pin_record');
        // pin_collector tracking
        saveData.stats.pinnedCount = (saveData.stats.pinnedCount || 0) + 1;
        if ((saveData.stats.pinnedCount || 0) >= 15 && !saveData.achievements?.['pin_collector']?.unlocked) unlockAchievement('pin_collector');
        saveDataToFile();
    }
    function pinCurrentScore() {
        if (!_lastGameStats) { customAlert('No completed game to pin.', 'PIN SCORE'); return; }
        const s = _lastGameStats;
        if (_findScorePin(s) === -1) pinScore(s.score, s.lines, s.blocks, s.time, s.maxSpeed, s.xp, s.note, s);
        customAlert('Score pinned!', 'PIN SCORE');
    }
    function unpinScore(realIdx) {
        if (!saveData.pinnedScores) return;
        saveData.pinnedScores.splice(realIdx, 1);
        saveDataToFile();
    }

    const _scorePinIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#lb-run-icon-pin"/></svg>';
    const _sameRunStats = (left, right) => ['score', 'lines', 'blocks', 'time', 'maxSpeed', 'xp'].every(key => (left[key] ?? null) === (right[key] ?? null));

    function _findScorePin(entry) {
        const pins = saveData.pinnedScores || [];
        const exact = pins.findLastIndex(pin => _sameRunStats(pin, entry) && pin.date === entry.date && pin.clock === entry.clock);
        if (exact !== -1) return exact;
        const legacy = pins.findLastIndex(pin => _sameRunStats(pin, entry) && pin.note === 'from leaderboard');
        const matches = saveData.leaderboard.filter(score => _sameRunStats(score, entry));
        return matches.length === 1 && matches[0] === entry ? legacy : -1;
    }

    function _bindScoreInfo(trigger, entry, title, { pinIndex, board } = {}) {
        trigger.type = 'button';
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', 'lb-tooltip-global');
        trigger.addEventListener('click', event => {
            if (infoDragged && event.detail) return;
            if (activeInfo?.anchor === trigger) { closeInfo(trigger); return; }
            closeInfo();
            const panel = infoPanel('lb-tooltip-global');
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-labelledby', 'lb-score-info-title');
            const icons = _lbIcons();
            const time = Number(entry.time) || 0;
            const pinControl = board ? '' : `<button type="button" class="lb-block-btn lb-block-btn--icon" id="score-pin-popup">${_scorePinIcon}</button>`;
            panel.tabIndex = -1;
            panel.innerHTML = `<header class="lb-score-info-head"><strong id="lb-score-info-title">${escapeHtml(title)} · ${escapeHtml(entry.score.toLocaleString())} pts</strong>${pinControl}</header>
                <div class="lb-score-info-details">
                    ${entry.lines != null ? `<span>${icons.lines} Lines: ${escapeHtml(entry.lines)}</span><span>${icons.time} Time: ${Math.floor(time / 60)}m ${String(time % 60).padStart(2, '0')}s</span>` : ''}
                    ${entry.maxSpeed != null ? `<span>${icons.speed} Speed level: ${escapeHtml(entry.maxSpeed)}</span>` : ''}
                    ${entry.maxCombo > 1 ? `<span>Combo: ×${escapeHtml(entry.maxCombo)}</span>` : ''}
                    ${board ? `<span>Board: ${escapeHtml(board)}</span>` : ''}
                    <span>${escapeHtml(LBSave.displayDate(entry.date, entry.clock))}</span>
                </div>`;
            const pinButton = panel.querySelector('#score-pin-popup');
            const updatePin = () => {
                const pinned = (pinIndex ?? _findScorePin(entry)) !== -1;
                pinButton.setAttribute('aria-pressed', pinned);
                pinButton.setAttribute('aria-label', pinned ? 'Unpin score' : 'Pin score');
            };
            if (pinButton) updatePin();
            showInfo(panel, trigger, { dismiss: () => {
                panel.hidden = true;
                trigger.setAttribute('aria-expanded', 'false');
            } });
            trigger.setAttribute('aria-expanded', 'true');
            pinButton?.addEventListener('click', () => {
                const index = pinIndex ?? _findScorePin(entry);
                if (index === -1) pinScore(entry.score, entry.lines, entry.blocks, entry.time, entry.maxSpeed, entry.xp, 'from leaderboard', entry);
                else unpinScore(index);
                if (pinIndex == null) updatePin();
                else {
                    closeInfo(trigger);
                    drawPinnedScores();
                    if (!event.detail) (document.querySelector('#pinned-list .lb-row') || document.getElementById('stats-tab-pin')).focus({ preventScroll: true });
                }
            });
            panel.onkeydown = key => {
                if (key.key === 'Escape') trigger.focus({ preventScroll: true });
                if (key.key === 'Tab') { key.preventDefault(); closeInfo(trigger); trigger.focus({ preventScroll: true }); }
            };
            if (!event.detail) (pinButton || panel).focus({ preventScroll: true });
        });
    }
    function _lbIcons() {
        const runIcon = name => `<svg class="lb-run-icon lb-run-icon--${name}" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><use href="#lb-run-icon-${name}"/></svg>`;
        return {
            time: '<svg class="lb-run-icon lb-run-icon--time" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><use href="#lb-metric-clock"/></svg>',
            lines: runIcon('lines'),
            speed: runIcon('speed'),
            cal:   `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px;opacity:0.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        };
    }
    function _statsCrown(rank, describePlace = false) {
        if (!Number.isInteger(rank) || rank < 1 || rank > 3) return '';
        return `<img class="lb-place-crown" src="assets/ui/crowns/${rank}.png" alt="${describePlace ? `#${rank}` : ''}">`;
    }

    function drawPinnedScores() {
        const container = document.getElementById('pinned-list');
        if (!container) return;
        const pins = saveData.pinnedScores || [];
        if (pins.length === 0) { container.innerHTML = '<p class="lb-block-card lb-empty">No pinned scores yet. Pin a score from the leaderboard.</p>'; return; }
        const lbFmt = (t) => { const m = Math.floor(t/60); const s = t%60; return `${m}m ${String(s).padStart(2,'0')}s`; };
        const ico = _lbIcons();
        container.innerHTML = '';
        [...pins].reverse().forEach((e, ri) => {
            const realIdx = pins.length - 1 - ri;
            const div = document.createElement('button'); div.className = 'lb-row lb-stats-pin';
            const details = e.lines != null
                ? `<span class="lb-detail">${ico.time}${lbFmt(e.time||0)}</span><span class="lb-detail">${ico.lines}${escapeHtml(e.lines||0)} lines</span><span class="lb-detail">${ico.speed}Level ${escapeHtml(e.maxSpeed||1)}</span>`
                : '';
            const noteHtml = e.note ? `<span class="lb-stats-meta">${escapeHtml(e.note)}</span>` : '';
            const matchesPin = entry => _sameRunStats(entry, e);
            const rankIndex = saveData.leaderboard.slice(0, 3).findIndex(matchesPin);
            const crown = rankIndex !== -1 && saveData.leaderboard.findLastIndex(matchesPin) === rankIndex ? _statsCrown(rankIndex + 1, true) : '';
            div.innerHTML = `<span class="lb-pin-icon">${crown || _scorePinIcon}</span><span class="lb-score">${escapeHtml(e.score.toLocaleString())} <span class="lb-pts">pts</span></span><span class="lb-details-row">${details}${noteHtml}</span><span class="lb-date">${escapeHtml(LBSave.displayDate(e.date, e.clock, true))}</span>`;
            _bindScoreInfo(div, e, 'Pinned score', { pinIndex: realIdx });
            container.appendChild(div);
        });
    }
    function _statsPodium(entries, onPlace) {
        const podium = document.createElement('div');
        podium.className = 'lb-stats-podium';
        const medals = ['Gold', 'Silver', 'Bronze'];
        for (const rank of [2, 1, 3]) {
            const entry = entries[rank - 1];
            if (!entry) continue;
            const medal = medals[rank - 1];
            const score = entry.score.toLocaleString();
            const place = document.createElement(onPlace ? 'button' : 'div');
            place.className = 'lb-stats-podium-place';
            place.dataset.place = rank;
            place.innerHTML = `<span class="lb-stats-podium-score">${escapeHtml(score)} <span class="lb-pts">pts</span></span><span class="lb-stats-podium-step">${_statsCrown(rank, !onPlace)}</span>`;
            if (onPlace) {
                place.type = 'button';
                place.classList.add('lb-block-btn');
                place.setAttribute('aria-label', `Rank ${rank}, ${medal}: ${score} points`);
                onPlace(place, entry, rank, medal);
            }
            podium.appendChild(place);
        }
        return podium;
    }

    function _drawHighscoreHistory() {
        const container = document.getElementById('highscores-list');
        if (!container) return;
        const history = saveData.highscoreHistory || [];
        // Build full list: history + current highscore
        const all = [...history];
        if (_bestScore() > 0) all.push({ ...saveData.leaderboard[0], isCurrent: true });
        if (all.length === 0) { container.innerHTML = '<p class="lb-block-card lb-empty">No highscores yet. Play to set your first record!</p>'; return; }
        container.innerHTML = '';
        // Sort descending by score
        all.sort((a, b) => b.score - a.score);
        const lbFmt = (t) => { const m = Math.floor(t/60); const s = t%60; return `${m}m ${String(s).padStart(2,'0')}s`; };
        const ico = _lbIcons();
        all.forEach((e, i) => {
            const div = document.createElement('div'); div.className = 'lb-row';
            const isCur = e.isCurrent;
            if (isCur) div.classList.add('lb-stats-current');
            const details = e.lines != null
                ? `<span class="lb-detail">${ico.lines} Lines ${escapeHtml(e.lines||0)}</span><span class="lb-detail">${ico.time} Time ${lbFmt(e.time||0)}</span><span class="lb-detail">${ico.speed} Lvl ${escapeHtml(e.maxSpeed||1)}</span>`
                : '';
            const rank = i + 1;
            div.innerHTML = `<span class="lb-rank">${_statsCrown(rank, true) || `#${rank}`}</span><span class="lb-score">${escapeHtml(e.score.toLocaleString())} <span class="lb-pts">pts</span></span><span class="lb-details-row">${details}</span><span class="lb-date">${isCur ? '<span class="lb-current-tag" aria-label="Current record">NOW</span>' : escapeHtml(LBSave.displayDate(e.date))}</span>`;
            container.appendChild(div);
        });
    }
    function drawLeaderboard() {
        const container = document.getElementById('lb-list'); container.innerHTML = "";
        if (saveData.leaderboard.length === 0) { container.innerHTML = '<p class="lb-block-card lb-empty">Play your first game to enter the leaderboard.</p>'; return; }
        const lb = saveData.leaderboard;
        const lbFmt = (t) => { const m = Math.floor(t/60); const s = t%60; return `${m}m ${String(s).padStart(2,'0')}s`; };
        const ico = _lbIcons();

        const podiumPanel = document.createElement('section');
        podiumPanel.className = 'lb-stats-podium-panel lb-stats-podium-original';
        podiumPanel.setAttribute('aria-label', 'Best scores');
        const podium = _statsPodium(lb, (block, e, rank, medal) => _bindScoreInfo(block, e, `#${rank} ${medal}`));
        podiumPanel.appendChild(podium);
        container.appendChild(podiumPanel);

        // --- Regular rows (4th+) with Load More ---
        let _lbShown = 50;
        function _renderLbRows(upTo) {
            // Remove existing rows and load-more button
            container.querySelectorAll('.lb-row, .lb-load-more').forEach(el => el.remove());
            const max = Math.min(upTo, lb.length);
            for (let i = 3; i < max; i++) {
                const e = lb[i];
                const div = document.createElement('button'); div.className = 'lb-row';
                const details = e.lines != null
                    ? `<span class="lb-detail">${ico.time}${lbFmt(e.time)}</span><span class="lb-detail">${ico.lines}${escapeHtml(e.lines)} lines</span><span class="lb-detail">${ico.speed}Level ${escapeHtml(e.maxSpeed)}</span>`
                    : '';
                div.innerHTML = `<span class="lb-rank">#${i+1}</span><span class="lb-score">${escapeHtml(e.score.toLocaleString())} <span class="lb-pts">pts</span></span><span class="lb-details-row">${details}</span><span class="lb-date">${escapeHtml(LBSave.displayDate(e.date, e.clock))}</span>`;
                _bindScoreInfo(div, e, `#${i + 1}`);
                container.appendChild(div);
            }
            // Load More button
            if (max < lb.length) {
                const moreBtn = document.createElement('button');
                moreBtn.className = 'lb-block-btn lb-load-more';
                moreBtn.textContent = `LOAD MORE (${lb.length - max} remaining)`;
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

    function rankUnlockText(text) {
        const match = /^(Unlock(?:s|ed) at )([A-Z]+)( [IVXLCDM]+)?(!?)$/i.exec(text);
        if (!match) return escapeHtml(text);
        const [, prefix, name, division = '', suffix] = match;
        const rank = [...RANKS, CELESTITE_RANK].find(entry => entry.name === name.toUpperCase());
        if (!rank) return escapeHtml(text);
        return `${prefix}<span class="lb-rank-unlock-name" style="--rank-unlock-color:${rank.c}">${escapeHtml(name + division)}</span>${suffix}`;
    }

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

    const ACH_QUEST_PAGE = 'M4 2h16v2h2v18H2V4h2zM4 6v14h16V6z';
    const ACH_QUEST_CHECK = 'M6 11h2v2h2v2h2v-2h2v-2h2V9h2v4h-2v2h-2v2h-4v-2H8v-2H6z';
    const ACH_QUEST_HARD = 'M11 8h2v2h2v2h2v2h2v4H5v-4h2v-2h2v-2h2zm0 3v2H9v2h2v-1h2v1h2v-2h-2v-2z';
    const ACH_QUEST_SECRET = 'M9 6h6v2h2v3h2v7H5v-7h2V8h2zm0 2v3h6V8zm2 5v3h2v-3z';
    const ACH_CALENDAR = 'M6 2h2v2h8V2h2v2h4v18H2V4h4zM4 9v11h16V9z';
    const ACH_QUAD = 'M2 3h20v3H2zm0 5h20v3H2zm0 5h20v3H2zm0 5h20v3H2z';
    const ACH_PAUSE = 'M6 4h4v16H6zm8 0h4v16h-4z';
    const ACH_PIXEL_ART = {
        score: '#lb-metric-trophy',
        games: '#lb-metric-gamepad',
        speed: '#lb-run-icon-speed',
        sec_symmetric_board: 'M11 2h2v20h-2zM3 6h4v3h2v9H3zm14 0h4v12h-6V9h2zM5 12v4h2v-4zm12 0v4h2v-4z',
        sec_nice: 'M4 6h6v2H6v3h4v2h1v4h-1v2H4v-2H2V8h2zm0 7v4h5v-4zm10-7h6v2h2v9h-2v2h-6v-2h6v-3h-6v-2h-2V8h2zm0 2v4h6V8z',
        sec_turtle: 'M6 6h9v2h3v4h2v-2h3v6h-5v2h-2v3h-3v-3H7v3H4v-3H2v-2H0v-2h3v-4h3zm2 2v3h5V8zm-2 5v2h3v-2zm7 0v2h3v-2z',
        sec_palindrome: 'M5 6h3v2h2v4H8v2H6v2h4v2H4v-4h2v-2h2V8H5zm9 0h6v2h-4v2h2v2h2v6h-6v-2h4v-4h-4zM11 3h2v18h-2z',
        sec_420: 'M6 22v-3h8v-2H9v-3h10v-2h-5V9H9V6h7V4h-5V1h8v3h2v4h-5v2h6v6h-5v3h2v3zM2 14h3v3H2zM3 6h3v3H3z',
        survival: 'M10 2h4v2h5v2h3v8h-2v4h-3v2h-3v2h-4v-2H7v-2H4v-4H2V6h3V4h5zm1 5v4H7v2h4v4h2v-4h4v-2h-4V7z',
        speed_placer: 'M2 5h8v2H2zm3 4h6v2H5zm-4 4h8v2H1zm11-7h4v4h-4zm5 0h4v4h-4zm0 5h4v4h-4zm-5 5h4v4h-4zm5 0h4v4h-4zM5 18h5v2H5z',
        total_blocks: '#lb-metric-blocks',
        total_lines: '#lb-run-icon-lines',
        speedrunner: 'M12 2h6v2h-2v2h3v2h3v4h1v4h-1v3h-3v3H11v-3H8v-3H7v-4h1V9h3V6h3V4h-2zM10 12v5h2v2h6v-2h2v-5h-2V9h-6v3zm4-2h2v4h2v2h-4zM1 7h7v2H1zm0 5h4v2H1zm2 5h4v2H3z',
        quad_count: ACH_QUAD,
        combo_master: '#lb-metric-combo',
        high_placer: 'M2 2h20v20H2zm2 2v16h16V4zm2 8h12v2H6zm0 4h3v2H6zm4 0h3v2h-3zm4 0h4v2h-4z',
        booster_user: 'M8 2h8v3h-1v4h3v3h2v8h-2v2H6v-2H4v-8h2V9h3V5H8zm5 8h-2v4H8v2h3v4h2v-4h3v-2h-3z',
        fun_score: 'M6 2h12v2h3v3h2v10h-2v3h-3v2H6v-2H3v-3H1V7h2V4h3zM6 8v3h3V8zm9 0v3h3V8zM6 14v2h2v2h8v-2h2v-2h-3v2H9v-2z',
        i_piece_lines: 'M9 2h6v4H9zm0 5h6v4H9zm0 5h6v4H9zm0 5h6v4H9zM2 18h5v2H2zm15 0h5v2h-5z',
        daily_streak: '#lb-metric-flame',
        board_clear: 'M2 2h20v20H2zm2 2v16h16V4zm7 3h2v3h3v2h-3v3h-2v-3H8v-2h3zm-4 8h2v2H7zm9-1h2v2h-2z',
        top_line: 'M2 3h20v19H2zm2 5v12h16V8zM4 5v1h2V5zm4 0v1h2V5zm4 0v1h2V5zm4 0v1h2V5zm-5 5h2v2h2v2h2v2h-4v3h-2v-3H7v-2h2v-2h2z',
        level_101: 'M2 4h3v3h2v3h3V7h1V3h2v4h1v3h3V7h2V4h3v6h-2v9H4v-9H2zm4 13h12v-2H6zm5-5v2h2v-2z',
        daily_rare: 'M2 8h3v-2h14v2h3v13H2zm2 6v5h16v-5h-6v3h-4v-3zM7 8v2h10V8zM11 1h2v3h-2zM3 3h2v2H3zm16 0h2v2h-2z',
        sec_booster_waste: 'M7 2h9v3h-2v5h3v3h2v7h-2v2H5v-2H3v-7h2v-3h4V5H7zm0 11v3h3v-3zm3 3v3h3v-3zm3-3v3h3v-3zM20 3h2v6h-2zm0 8h2v2h-2z',
        sec_no_rotate: 'M7 3h10v2h3v3h2v8h-2v3h-3v2H7v-2H4v-3H2V8h2V5h3zm1 3H7v3H5v6h2v3h9v-2h3v-2h-2v-2h-3v-2h-3V8H8zm4 0v2h3v2h3v2h1V9h-2V6z',
        sec_equal_pieces: 'M11 3h2v3h8v2h-2v4h3v4h-2v2h-5v-2h-2v-4h3V8H8v4h3v4H9v2H4v-2H2v-4h3V8H3V6h8zm0 13h2v4h5v2H6v-2h5z',
        sec_seven: 'M2 4h5v5H2zm7 0h6v5H9zm8 0h5v5h-5zM2 11h5v5H2zm7 0h6v5H9zm8 0h5v5h-5zM9 18h6v4H9z',
        sec_early_bird: 'M11 2h2v3h-2zm6 2h2v3h-2zM5 4h2v3H5zm2 6h2V8h6v2h3v2h4v2h-4v4h-3v3H6v-3H3v-3H1v-2h6zm6 2v2h2v-2z',
        sec_no_drop: 'M3 13h2v2h4v-2h8v-2h2V9h3v5h-2v3h-3v2H8v2H2v-4h2v-2H3zm5-9h5v2H8zm-3 4h5v2H5z',
        sec_all_drop: 'M9 2h6v4H9zm0 6h6v5h4v2h-2v2h-2v2H9v-2H7v-2H5v-2h4zM3 20h18v3H3z',
        sec_big_font: 'M3 3h7v2H5v5H3zm11 0h7v7h-2V5h-5zM3 14h2v5h5v2H3zm16 0h2v7h-7v-2h5zM7 7h10v3h-4v7h-2v-7H7z',
        sec_exact_100: 'M6 5h12v2h3v3h2v4h-2v3h-3v2H6v-2H3v-3H1v-4h2V7h3zm3 6v2h2v2h3v-2h2v-2h2V9h-3v2h-2v2h-1v-2z',
        sec_exact_level: 'M2 5h20v14H2zm3 3v8h14V8zm2 2h9v4H7zm10 0h1v4h-1zM8 21h8v2H8z',
        sec_speedgames: 'M2 10h5v3H2zm2 5h5v3H4zm7-12h10v3h-7v3h6v2h2v7h-2v3H11v-3h8v-6h-8z',
        surgeon: 'M19 2h4v4h-2v2h-2v2h-2v2h-2v-2h-2V8h2V6h2V4h2zM11 10h2v2h2v2h-2v2h-2v3H9v2H2v-4h2v-2h3v-2h4z',
        pin_record: 'M7 2h10v3h-2v5h2v2h2v4h-6v6h-2v-6H5v-4h2v-2h2V5H7z',
        daily_xp: ACH_CALENDAR + 'M12 10h2v3h3v2h-3v3h-2v-3H9v-2h3z',
        rules_reader: 'M2 3h8v2h4V3h8v16h-8v2h-4v-2H2zm2 2v12h6V7H8V5zm12 0v2h-2v10h6V5zM5 8h4v2H5zm0 4h4v2H5zm10-4h4v2h-4zm0 4h4v2h-4z',
        prosperity: 'M2 8h20v13H2zm2 2v9h16v-9zm0-6h16v2H4zm2-3h12v2H6zm6 10h2v2h3v2h-3v3h-2v-3H9v-2h3z',
        music_listener: 'M7 3h10v2h3v4h2v11h-6v-8h3V9h-2V6H7v3H5v3h3v8H2V9h2V5h3z',
        third_charm: 'M2 16h4v5H2zm6-4h4v9H8zm6-4h4v13h-4zm2-6h6v6h-2V6h-2V4h-2z',
        risky_break: 'M10 2h4v3h2v4h2v4h2v4h2v5H2v-5h2v-4h2V9h2V5h2zm-2 9v7h3v-7zm5 0v7h3v-7z',
        loser: 'M3 3h4v2h3v3h4V5h3V3h4v4h-2v3h-3v4h3v3h2v4h-4v-2h-3v-3h-4v3H7v2H3v-4h2v-3h3v-4H5V7H3z',
        marathon: 'M3 2h3v20H3zm5 0h14v14H8zm2 2v3h3V4zm6 0v3h4V4zm-3 3v4h3V7zm-3 4v3h3v-3zm6 0v3h4v-3z',
        lucky_day: 'M5 3h5v2h4V3h5v2h2v5h-2v4h2v5h-2v2h-5v-2h-2v3H7v-2h3v-3H5v-2H3v-5h2V8H3V5h2z',
        mirror_score: 'M2 5h8v2H4v3h5v2h1v5H2v-2h6v-3H2zm12 0h8v7h-6v3h6v2h-8v-7h6V7h-6zM11 2h2v20h-2z',
        loyal_piece: 'M2 3h20v19H2zm2 2v15h16V5zm3 3h3v3h3v3H7zm7 0h3v10h-3z',
        logo_click: 'M3 4h11v3h-4v7H7V7H3zm12 5h5v2h2v5h-2v3h-4v2h-5v-5h2v-4h2zm1 4v4h3v-4zM3 16h2v2H3z',
        mute_jarvis: 'M2 8h4V6h3V4h3v16H9v-2H6v-2H2zm12 1h2v2h3V9h2v3h-2v2h2v3h-2v-2h-3v2h-2v-3h2v-2h-2z',
        save_transfer: 'M2 2h16v2h2v2h2v16H2zm4 2v5h11V4h-3v3h-2V4zm0 11v5h12v-5z',
        pin_collector: 'M3 3h7v2H9v4h2v4H8v6H6v-6H2V9h2V5H3zm10 3h7v2h-1v4h3v4h-4v6h-2v-6h-4v-4h2V8h-1z',
        exact_death: 'M5 4h14v2h3v5H2V6h3zm0 3v2h14V7zM5 14h2v6H5zm6 0h2v6h-2zm6 0h2v6h-2z',
        skin_loyal: 'M2 4h20v16H2zm2 2v12h16V6zM6 8h4v3H6zm5 0h4v3h-4zm5 0h2v3h-2zM6 13h2v3H6zm3 0h4v3H9zm5 0h4v3h-4z',
        fun_squared: 'M2 7h15v15H2zm3 3v3h2v-3zm7 0v3h2v-3zm-7 5v2h2v2h5v-2h2v-2h-3v2H8v-2zM8 2h14v14h-3V5H8z',
        abort_mission: 'M2 2h11v4H6v12h7v4H2zM9 10h6V6h2v2h2v2h2v4h-2v2h-2v2h-2v-4H9z',
        deja_vu: 'M2 5h11v9H2zm2 2v5h7V7zm11-2h7v9h-7zm2 2v5h3V7zM5 16h2v2h10v-2h2v4H5z',
        gift_ignore: 'M5 3h5v2h4V3h5v2h2v4h2v5h-2v8H3v-8H1V9h2V5h2zm0 2v4h5V7H8V5zm11 2h-2v2h5V5h-3zM5 14v6h5v-6zm9 0v6h5v-6z',
        back_to_back: 'M2 3h20v7H2zm2 2v3h16V5zm-2 9h20v7H2zm2 2v3h16v-3zm4-5h8v2H8zM6 6h4v1H6zm8 0h4v1h-4zM6 17h4v1H6zm8 0h4v1h-4z',
        afk: 'M2 3h20v14H2zm2 2v10h16V5zm4 13h8v2h3v2H5v-2h3zM9 7h7v2h-2v2h-2v1h4v2H9v-2h1v-2h2V9H9z',
        collector: 'M2 5h14v3h6v12H2zm2 4v9h16v-7H13V8H4zm3 3h3v3H7zm6 1h3v3h-3z',
        pause_spam: ACH_PAUSE + 'M2 8h2v8H2zm18 0h2v8h-2z',
        leaning_tower: 'M12 2h7v5h-7zm-2 6h7v5h-7zm-3 6h7v5H7zm-4 6h18v2H3z',
        dry_spell: 'M3 14h5v6H3zm6-5h5v11H9zm6 3h6v8h-6zM3 21h18v2H3zM15 4h6v2h-6z',
        double_satisfaction: 'M2 4h9v3H2zm0 4h9v3H2zm0 4h9v3H2zm0 4h9v3H2zm11-12h9v3h-9zm0 4h9v3h-9zm0 4h9v3h-9zm0 4h9v3h-9z',
        one_at_a_time: 'M2 10h6v4H2zm14 0h6v4h-6zM11 4h2v5h-2zm0 11h2v5h-2zm-2-4h6v2H9z',
        surgeons_streak: 'M2 18h20v3H2zm5-5h15v3H7zm5-5h10v3H12zm5-5h5v3h-5z',
        spinner: 'M5 4h12V2h2v2h2v2h2v2h-2v2h-2v2h-2V8H7v2H5v6h2v2h11v3H5v-2H3v-3H1v-6h2V7h2zm5 7h5v5h-5z',
        dizzy: 'M5 2h14v3h3v14h-3v3H5v-3H2V5h3zm0 3v14h14V5zm2 2h10v10H9v-6h5v2h-3v2h4V9H7z',
        fav_track: 'M3 3h18v3h2v12h-3v3H4v-3H1V6h2zm2 6v4h2v2h2v2h2v-2h2v-2h2V9h-4v2H9V9zm12-2v8h3V7z',
        clutch: 'M3 3h14v4h-5v6H8V7H3zm11 6h4v2h2v2h2v4h-2v2h-2v2H5v-3h12v-3h2v-2h-5zM2 14h4v2H2zm5 0h5v2H7z',
        staircase: 'M2 16h5v-5h5V6h5V2h5v20H2zm2 2v2h16V4h-1v4h-5v5H9v5z',
        indecisive: 'M5 4h2v4h10V4h2v2h2v2h2v3h-2v2h-2v2h-2v-4H7v4H5v-2H3v-2H1V8h2V6h2zm3 13h8v4H8z',
        too_fast: 'M11 2h2v4h2v3h2v3h2v3h2v3h2v4H1v-4h2v-3h2v-3h2V9h2V6h2zm0 8v6h2v-6zm0 8v2h2v-2z',
        the_2048: 'M2 2h20v20H2zm2 2v16h16V4zM6 6h5v3H8v1h3v1H6V8h3V7H6zm7 0h5v5h-5zm2 1v3h1V7zm-9 6h2v2h1v-2h2v5H9v-1H6zm7 0h5v5h-5zm2 1v1h1v-1zm0 2v1h1v-1z',
        mq_first_easy: ACH_QUEST_PAGE + ACH_QUEST_CHECK,
        mq_normal_10: ACH_QUEST_PAGE + 'M7 8h10v2h2v4h-2v2h-3v3l-2-1-2 1v-3H7v-2H5v-4h2zm3 2v4h4v-4z',
        mq_hard_5: ACH_QUEST_PAGE + 'M7 8h8v2h2v3h-5v5H9v-5H6v-3h1z',
        mq_secret_1: ACH_QUEST_PAGE + ACH_QUEST_SECRET,
        mq_total_50: 'M8 1h8v3h3v3h3v10h-3v3h-3v3H8v-3H5v-3H2V7h3V4h3zm0 7v3h3V8zm5 0v3h3V8zM7 14v3h10v-3z',
        mq_easy_quests: 'M5 2h17v18h-2V4H5zM2 5h16v17H2zm2 2v13h12V7zM6 12h2v2h2v-2h2v-2h2v4h-2v2H8v-2H6z',
        mq_normal_quests: ACH_QUEST_PAGE + 'M5 9h14v3H5zm0 5h14v3H5z',
        mq_hard_quests: ACH_QUEST_PAGE + ACH_QUEST_HARD,
        mq_total_quests: 'M5 2h17v17h-2V4H5zM2 5h16v17H2zm2 2v13h12V7zm2 2h8v2H6zm0 4h8v2H6zm0 4h6v2H6z',
        mq_secret_quests: 'M7 2h9v2h3v3h2v9h-3v2h-2v2h-5v-2H7v-2H4V7h2V4h1zm1 4v3H6v6h3v2h7v-2h2V9h-2V6zm2 4h5v4h-5zm-6 7h3v2H5v2H3v2H1v-4h1v-2z',
        mq_daily_perfect: 'M11 1h2v3h-2zM3 4h3v3H3zm15 0h3v3h-3zM7 6h10v2h3v8h-3v3H7v-3H4V8h3zm0 5v2h2v2h4v-2h2v-2h2V9h-3v2h-2v2h-2v-2zm4 9h2v3h-2z',
        mq_no_easy_epic: ACH_QUEST_PAGE + 'M5 9h5v3H5zm9 0h5v3h-5zm-9 5h5v3H5zm9 0h5v3h-5z',
        mq_no_easy_legendary: ACH_QUEST_PAGE + 'M5 15h3v3H5zm5-3h3v6h-3zm5-4h4v10h-4z',
        mq_hard_they_said: 'M2 4h18v14h-2V6H2zm3 4h17v14H5zm2 2v10h13V10zm5 1h3v2h2v2h2v3H8v-3h2v-2h2z',
        mq_lazy_lucky: ACH_QUEST_PAGE + 'M11 7h2v4h4v2h-4v4h-2v-4H7v-2h4zM16 16h2v2h-2z',
        mq_double_badge: 'M2 3h7v2h2v7H9v2H7v4H4v-4H2zm2 3v5h5V6zm9 3h7v2h2v7h-2v2h-2v3h-3v-3h-2zm2 3v5h5v-5z',
        question: 'M7 3h10v2h3v8h-3v2h-3v2h-4v-4h3v-2h3V7H8v3H4V5h3zm3 16h4v4h-4z',
    };

    function achievementIcon(id) {
        const art = ACH_PIXEL_ART[id];
        if (art.startsWith('#')) {
            return `<use href="${art}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        }
        return `<path d="${art}" fill="currentColor" fill-rule="evenodd" shape-rendering="crispEdges"/>`;
    }

    const ACHIEVEMENTS_DEF = [
        // ── TIERED ────────────────────────────────────────────────
        {
            id: 'score', cat: 'basic', name: 'High Score', type: 'tiered',
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
            counter: { path:'stats.bestMaxSpeed', label:'Highest Run Level (Normal)' },
            tiers: [
                { rarity:'common',    name:'First Gear',  desc:'Reach level 3 in Normal Mode',  check: g => g.maxSpeed >= 3  && g.mode === 'normal', progressDisplay:{ path:'stats.bestMaxSpeed', target:3  } },
                { rarity:'rare',      name:'No Brakes',   desc:'Reach level 5 in Normal Mode',  check: g => g.maxSpeed >= 5  && g.mode === 'normal', progressDisplay:{ path:'stats.bestMaxSpeed', target:5  } },
                { rarity:'epic',      name:'Overdrive',   desc:'Reach level 8 in Normal Mode',  check: g => g.maxSpeed >= 8  && g.mode === 'normal', progressDisplay:{ path:'stats.bestMaxSpeed', target:8  } },
                { rarity:'legendary', name:'Supersonic',  desc:'Reach level 12 in Normal Mode', check: g => g.maxSpeed >= 12 && g.mode === 'normal', progressDisplay:{ path:'stats.bestMaxSpeed', target:12 } },
                { rarity:'mythic',    name:'Turbo',       desc:'Reach level 15 in Normal Mode', check: g => g.maxSpeed >= 15 && g.mode === 'normal', progressDisplay:{ path:'stats.bestMaxSpeed', target:15 } },
            ],
        },
        // ── SINGLE ────────────────────────────────────────────────
        // ── SECRET ────────────────────────────────────────────────
        {
            id: 'sec_symmetric_board', cat: 'secret', name: 'Mirror Universe', type: 'single',
            rarity: 'rare', clue: 'Balance is everything.',
            desc: 'Have at least 15 blocks arranged in a perfectly symmetric layout on the board (left–right mirror).',
            check: g => g.boardSymmetric,
        },
        {
            id: 'sec_nice', cat: 'secret', name: 'Nice', type: 'single',
            rarity: 'epic', clue: 'Some numbers are... memorable.',
            desc: 'Finish a game where the score contains "69" (e.g. 169, 690, 6983…). Score must be ≥ 100.',
            check: g => String(g.score).includes('69') && g.score >= 100,
        },
        {
            id: 'sec_turtle', cat: 'secret', name: 'Lazy Stack', type: 'single',
            rarity: 'common', clue: 'Plenty of pieces. Nothing to show for it.',
            desc: 'Place 80 pieces but score under 200.',
            check: g => g.blocks >= 80 && g.score < 200,
        },
        {
            id: 'sec_palindrome', cat: 'secret', name: 'Look Backwards', type: 'single',
            rarity: 'rare', clue: 'Symmetry in numbers.',
            desc: 'End with a palindrome score.',
            check: g => { const s = String(g.score); return s.length > 1 && s === s.split('').reverse().join(''); },
        },
        {
            id: 'sec_420', cat: 'secret', name: 'Smoke Break', type: 'single',
            rarity: 'common', clue: 'A legendary number lurks.',
            desc: 'Achieve a score of exactly 420.',
            check: g => g.score === 420,
        },
        // ── NEW VISIBLE TIERED ────────────────────────────────────────────────
        {
            id: 'survival', cat: 'basic', name: 'Survivor', type: 'tiered',
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
            counter: { path:'stats.bestBlocksIn60s', label:'Best (pieces/60s)' },
            tiers: [
                { rarity:'rare',      name:'Fast Fingers', desc:'Place 50 pieces in 60 seconds',  check: g => g.maxBlocksIn60s >= 50,  progressDisplay:{ path:'stats.bestBlocksIn60s', target:50  } },
                { rarity:'epic',      name:'On Fire',      desc:'Place 75 pieces in 60 seconds',  check: g => g.maxBlocksIn60s >= 75,  progressDisplay:{ path:'stats.bestBlocksIn60s', target:75  } },
                { rarity:'legendary', name:'Machine Gun',  desc:'Place 100 pieces in 60 seconds', check: g => g.maxBlocksIn60s >= 100, progressDisplay:{ path:'stats.bestBlocksIn60s', target:100 } },
            ],
        },
        {
            id: 'total_blocks', cat: 'basic', name: 'Builder', type: 'tiered',
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
            id: 'speedrunner', cat: 'basic', name: 'Time Trial', type: 'tiered',
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
            counter: { path:'stats.bestHighPlacer', label:'Best (in one game)', unit:'pieces' },
            tiers: [
                { rarity:'rare',      name:'Low Life',       desc:'Place 50 pieces fully in the bottom half (one game)',  check: g => g.highPlacer >= 50  },
                { rarity:'epic',      name:'Subterranean',   desc:'Place 100 pieces fully in the bottom half (one game)', check: g => g.highPlacer >= 100 },
                { rarity:'legendary', name:'The Undertaker', desc:'Place 200 pieces fully in the bottom half (one game)', check: g => g.highPlacer >= 200 },
            ],
        },
        {
            id: 'booster_user', cat: 'basic', name: 'Boosted', type: 'tiered',
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
            counter: { path:'stats.bestFunScore', label:'Fun Mode Best' },
            tiers: [
                { rarity:'common',    name:'Just for Fun',      desc:'Reach 500 score in Fun Mode',   check: g => g.mode === 'fun' && g.score >= 500,  progressDisplay:{ path:'stats.bestFunScore', target:500  } },
                { rarity:'rare',      name:'Vibing',            desc:'Reach 1,000 score in Fun Mode', check: g => g.mode === 'fun' && g.score >= 1000, progressDisplay:{ path:'stats.bestFunScore', target:1000 } },
                { rarity:'epic',      name:'Committed Casual',  desc:'Reach 2,000 score in Fun Mode', check: g => g.mode === 'fun' && g.score >= 2000, progressDisplay:{ path:'stats.bestFunScore', target:2000 } },
                { rarity:'legendary', name:'Fun Overdose',      desc:'Reach 5,000 score in Fun Mode', check: g => g.mode === 'fun' && g.score >= 5000, progressDisplay:{ path:'stats.bestFunScore', target:5000 } },
            ],
        },
        {
            id: 'i_piece_lines', cat: 'basic', name: 'I-Piece Devotion', type: 'tiered',
            counter: { path:'stats.bestIPieceLines', label:'Best (one game)', unit:'I-lines' },
            tiers: [
                { rarity:'common', name:'Straight Shot',     desc:'Clear 2 lines using I-pieces in one game',  check: g => g.iPieceLines >= 2  },
                { rarity:'rare',   name:'Bar Lover',         desc:'Clear 5 lines using I-pieces in one game',  check: g => g.iPieceLines >= 5  },
                { rarity:'epic',   name:'Strictly Vertical', desc:'Clear 10 lines using I-pieces in one game', check: g => g.iPieceLines >= 10 },
            ],
        },
        {
            id: 'daily_streak', cat: 'basic', name: 'Day by Day', type: 'tiered',
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
            check: g => g.boardCleared,
        },
        {
            id: 'top_line', cat: 'basic', name: 'Sky High', type: 'single',
            rarity: 'epic', desc: 'Clear the very top row of the board.',
            check: g => g.clearedTopLine,
        },
        {
            id: 'level_101', cat: 'secret', name: 'Is This the End?', type: 'single',
            rarity: 'legendary', clue: 'What lies beyond the highest peak?',
            desc: 'Reach the highest rank.',
            check: g => getLevelInfo(saveData.totalXP).isCelestite,
        },
        {
            id: 'daily_rare', cat: 'basic', name: 'Jackpot', type: 'tiered',
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
            check: () => false, // Unlocked directly in useScoreBooster
        },
        {
            id: 'sec_no_rotate', cat: 'secret', name: 'No Spin', type: 'single',
            rarity: 'rare', clue: 'Some pieces are perfect just the way they are.',
            desc: 'Place 100+ pieces in a single game without rotating once.',
            check: g => g.noRotate && g.blocks >= 100,
        },
        {
            id: 'sec_equal_pieces', cat: 'secret', name: 'Perfectly Balanced', type: 'single',
            rarity: 'epic', clue: 'All things in equal measure.',
            desc: 'Use all 7 piece types an equal number of times in one game (50+ pieces).',
            check: g => g.equalPieces,
        },
        {
            id: 'sec_seven', cat: 'secret', name: 'Seven of Seven', type: 'single',
            rarity: 'rare', clue: 'Patterns repeat... seventy-seven times.',
            desc: 'Receive all 7 piece types in 7 consecutive turns, 77 times total across all games.',
            check: g => (g.luckySevenCount || 0) >= 77,
        },
        {
            id: 'sec_early_bird', cat: 'secret', name: 'Early Bird', type: 'single',
            rarity: 'rare', clue: 'The early bird plays before sunrise.',
            desc: 'Play a game before 7 AM.',
            check: g => g.earlyBird,
        },
        {
            id: 'sec_no_drop', cat: 'secret', name: 'Gentle', type: 'single',
            rarity: 'rare', clue: 'No rush. Let gravity do the work.',
            desc: 'Reach a score of 1,000+ without using hard drop once.',
            check: g => g.score >= 1000 && g.noHardDrop,
        },
        {
            id: 'sec_all_drop', cat: 'secret', name: 'No Hesitation', type: 'single',
            rarity: 'epic', clue: 'Commitment at maximum velocity.',
            desc: 'Reach 1,000+ score hard-dropping every single piece.',
            check: g => g.score >= 1000 && g.allHardDrop,
        },
        {
            id: 'sec_big_font', cat: 'secret', name: 'Go Big', type: 'single',
            rarity: 'common', clue: 'Go big or go home.',
            desc: 'Play a game with font size and game scale both set to maximum.',
            check: g => g.bigFont,
        },
        {
            id: 'sec_exact_100', cat: 'secret', name: 'Hundred Percent', type: 'single',
            rarity: 'rare', clue: 'Exactly. Not one more, not one less.',
            desc: 'Place exactly 100 pieces in a single game.',
            check: g => g.exactBlocks100,
        },
    {
        id: 'sec_exact_level', cat: 'secret', name: 'Zero Overflow', type: 'single',
        rarity: 'rare', clue: 'Zero to spare. Zero in excess.',
        desc: 'Earn enough XP to hit a level boundary exactly — zero XP overflow.',
        check: () => false, // checked directly in gameOver
    },
    {
        id: 'sec_speedgames', cat: 'secret', name: 'Quick Five', type: 'single',
        rarity: 'epic', clue: 'Five blinks of an eye.',
        desc: 'Play 5 games in under 1 minute, each clearing at least one line.',
        check: () => false, // checked directly in gameOver
    },
    {
        id: 'surgeon', cat: 'basic', name: 'Precision Cutter', type: 'tiered',
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
        check: () => false,
    },
    {
        id: 'daily_xp', cat: 'basic', name: 'Daily Grinder', type: 'tiered',
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
        check: () => false,
    },
    {
        id: 'prosperity', cat: 'secret', name: 'Loaded', type: 'single',
        rarity: 'rare', clue: 'Saving for a rainy day.',
        desc: 'Have 20+ boosters saved at once.',
        check: () => false,
    },
    {
        id: 'music_listener', cat: 'basic', name: 'In the Zone', type: 'tiered',
        counter: { path:'_computed.musicTracksListened', label:'Tracks Listened' },
        tiers: [
            { rarity:'common', name:'Background Music', desc:'Listen to 25 music tracks',  progress:{ path:'_computed.musicTracksListened', target:25  } },
            { rarity:'rare',   name:'Listener',         desc:'Listen to 50 music tracks',  progress:{ path:'_computed.musicTracksListened', target:50  } },
            { rarity:'epic',   name:'Tuned In',         desc:'Listen to 100 music tracks', progress:{ path:'_computed.musicTracksListened', target:100 } },
        ],
    },
    {
        id: 'third_charm', cat: 'secret', name: "Third Time's the Charm", type: 'single',
        rarity: 'epic', clue: "Third time's the charm.",
        desc: 'Come close to your record at least twice (not necessarily consecutively), then beat it.',
        check: () => false,
    },
    {
        id: 'risky_break', cat: 'secret', name: 'No Risk, No Break', type: 'single',
        rarity: 'common', clue: 'Living on the edge.',
        desc: 'Pause the game at run level 3 or higher.',
        check: () => false,
    },
    {
        id: 'loser', cat: 'secret', name: 'Loser', type: 'single',
        rarity: 'rare', clue: 'Rock bottom.',
        desc: 'Lose 5 games in a row without clearing any lines.',
        check: () => false,
    },
    {
        id: 'marathon', cat: 'secret', name: 'Marathon', type: 'single',
        rarity: 'rare', clue: 'Do you ever stop?',
        desc: 'Play 20 games in a single session.',
        check: () => false,
    },
    {
        id: 'lucky_day', cat: 'secret', name: 'Lucky Day', type: 'single',
        rarity: 'legendary', clue: 'Fortune favors the patient.',
        desc: 'See the "Lucky day!" quote on the splash screen.',
        check: () => false,
    },
    {
        id: 'mirror_score', cat: 'basic', name: 'Other Side', type: 'tiered',
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
        check: () => false,
        progressDisplay: { path:'stats.bestLoyalPiece', target:30 },
    },
    {
        id: 'logo_click', cat: 'secret', name: 'Explorer', type: 'single',
        rarity: 'rare', clue: 'Curiosity.',
        desc: 'See every title animation.',
        check: () => false,
    },
    {
        id: 'mute_jarvis', cat: 'secret', name: 'On and Off', type: 'single',
        rarity: 'rare', clue: 'Make up your mind.',
        desc: 'Mute music 10 times (5s minimum gaps).',
        check: () => false,
    },
    {
        id: 'save_transfer', cat: 'secret', name: 'Backed Up', type: 'single',
        rarity: 'common', clue: 'Trust, but verify.',
        desc: 'Import or transfer a save file.',
        check: () => false,
    },
    {
        id: 'pin_collector', cat: 'secret', name: 'Pin Collector', type: 'single',
        rarity: 'rare', clue: "Collector's instinct.",
        desc: 'Pin 15+ scores.',
        check: () => false,
        progressDisplay: { path:'stats.pinnedCount', target:15 },
    },
    {
        id: 'exact_death', cat: 'secret', name: 'Angel Numbers', type: 'single',
        rarity: 'rare', clue: 'Angel numbers.',
        desc: 'End a game with a repeating score: 111, 222… or 1111, 2222… up to 9999. Score must be ≥ 100.',
        check: () => false,
    },
    {
        id: 'skin_loyal', cat: 'secret', name: 'Never Changing', type: 'single',
        rarity: 'rare', clue: "If it ain't broke...",
        desc: 'Play 50+ games without changing block skin.',
        check: () => false,
        progressDisplay: { path:'stats.sameSkinStreak', target:50 },
    },
    {
        id: 'fun_squared', cat: 'basic', name: 'Fun Fanatic', type: 'tiered',
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
        check: () => false,
        progressDisplay: { path:'stats.gamesAborted', target:20 },
    },
    {
        id: 'deja_vu', cat: 'secret', name: 'Deja Vu', type: 'single',
        rarity: 'epic', clue: "Haven't I been here before?",
        desc: 'Finish a game with the same score as one of your past highscores.',
        check: () => false,
    },
    {
        id: 'gift_ignore', cat: 'secret', name: 'Ungrateful', type: 'single',
        rarity: 'common', clue: 'Ungrateful.',
        desc: 'Have 10+ unclaimed mission XP rewards or milestone boxes combined (resets with missions).',
        check: () => false,
    },
    {
        id: 'back_to_back', cat: 'secret', name: 'Back to Back', type: 'single',
        rarity: 'epic', clue: 'Lightning strikes twice.',
        desc: 'Get the same score in two consecutive games.',
        check: () => false,
    },
    {
        id: 'afk', cat: 'secret', name: 'AFK', type: 'single',
        rarity: 'rare', clue: 'Still there?',
        desc: 'Spend 15 minutes in the menu without playing.',
        check: () => false,
    },
    {
        id: 'collector', cat: 'basic', name: 'Collector', type: 'tiered',
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
        check: () => false,
    },
    // ── NEW ACHIEVEMENTS (batch 3) ────────────────────────────────────────
    {
        id: 'leaning_tower', cat: 'secret', name: 'Leaning Tower', type: 'single',
        rarity: 'rare', clue: 'A precarious structure, barely standing.',
        desc: 'Game over with bottom row having exactly 1 filled cell and no other row having more than 3 filled cells (must clear at least 1 line).',
        check: () => false,
    },
    {
        id: 'dry_spell', cat: 'secret', name: 'Let It Stack', type: 'single',
        rarity: 'rare', clue: 'The well has run dry.',
        desc: 'Place 30+ pieces without clearing a single line.',
        check: () => false,
    },
    {
        id: 'double_satisfaction', cat: 'secret', name: 'Double the Satisfaction', type: 'single',
        rarity: 'rare', clue: 'Four and four. Back to back.',
        desc: 'Clear 4 lines twice in a row.',
        check: () => false,
    },
    {
        id: 'one_at_a_time', cat: 'basic', name: 'Single Minded', type: 'tiered',
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
        check: () => false,
    },
    {
        id: 'spinner', cat: 'basic', name: 'Spinner', type: 'tiered',
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
        check: () => false,
    },
    {
        id: 'fav_track', cat: 'secret', name: 'Favorite Song', type: 'single',
        rarity: 'common', clue: "You've got a favorite.",
        desc: 'Listen to the same track 10 times.',
        check: () => false,
    },
    {
        id: 'clutch', cat: 'secret', name: 'Clutch', type: 'single',
        rarity: 'legendary', clue: 'The T-piece at its absolute peak.',
        desc: 'Clear 3 lines with a T-spin.',
        check: () => false,
        progressDisplay: { path:'stats.tSpinTriples', target:1 },
    },
    {
        id: 'staircase', cat: 'secret', name: 'Step by Step', type: 'single',
        rarity: 'epic', clue: 'Step by step, column by column.',
        desc: 'Create a perfect staircase pattern: each column is exactly 1 block higher than the previous, across all 10 columns.',
        check: () => false,
    },
    {
        id: 'indecisive', cat: 'secret', name: 'Left Right Left', type: 'single',
        rarity: 'common', clue: 'Left... no, right... no, left!',
        desc: 'Move a piece from wall to wall 3+ times before placing it.',
        check: () => false,
    },
    {
        id: 'too_fast', cat: 'secret', name: 'Difficulty Spike', type: 'single',
        rarity: 'rare', clue: 'So close to the next gear.',
        desc: 'Game over on the first line after reaching run level 3 or higher.',
        check: () => false,
    },
    {
        id: 'the_2048', cat: 'secret', name: 'Power of Two', type: 'single',
        rarity: 'legendary', clue: 'A familiar number for puzzle fans.',
        desc: 'Score exactly 2,048 in a game.',
        check: () => false,
    },
    // ── MISSIONS ──────────────────────────────────────────────
    {
        id: 'mq_first_easy', cat: 'basic', name: 'First Steps', type: 'single',
        rarity: 'common', clue: 'Every journey begins somewhere.',
        desc: 'Complete your first Easy daily quest.',
        check: () => false,
    },
    {
        id: 'mq_normal_10', cat: 'basic', name: 'Quest Veteran', type: 'single',
        rarity: 'rare', clue: 'A veteran of the grind.',
        desc: 'Complete 10 Normal tier daily quests.',
        check: () => false,
    },
    {
        id: 'mq_hard_5', cat: 'basic', name: 'Hard Worker', type: 'single',
        rarity: 'epic', clue: 'You don\'t back down from a challenge.',
        desc: 'Complete 5 Hard tier daily quests.',
        check: () => false,
    },
    {
        id: 'mq_secret_1', cat: 'basic', name: 'Secret Keeper', type: 'single',
        rarity: 'epic', clue: 'Not everything is what it seems.',
        desc: 'Complete a Secret daily quest.',
        check: () => false,
    },
    {
        id: 'mq_total_50', cat: 'basic', name: 'Quest Machine', type: 'single',
        rarity: 'legendary', clue: 'Fifty goals. Fifty victories.',
        desc: 'Complete 50 total daily quests.',
        check: () => false,
    },
    // ── TIERED MISSION COUNT BADGES ───────────────────────────────────────
    {
        id: 'mq_easy_quests', cat: 'basic', name: 'Easy Runner', type: 'tiered',
        counter: { path: 'missions.stats.byTier.easy', label: 'Easy Quests Done' },
        tiers: [
            { rarity: 'common',    name: 'Casual Grinder', desc: 'Complete 10 Easy quests (daily or weekly)',    progress: { path: 'missions.stats.byTier.easy', target: 10  } },
            { rarity: 'rare',      name: 'Easy Streak',    desc: 'Complete 30 Easy quests (daily or weekly)',    progress: { path: 'missions.stats.byTier.easy', target: 30  } },
            { rarity: 'epic',      name: 'Green Thumb',    desc: 'Complete 50 Easy quests (daily or weekly)',    progress: { path: 'missions.stats.byTier.easy', target: 50  } },
        ],
    },
    {
        id: 'mq_normal_quests', cat: 'basic', name: 'Middle Ground', type: 'tiered',
        counter: { path: 'missions.stats.byTier.normal', label: 'Normal Quests Done' },
        tiers: [
            { rarity: 'common',    name: 'Solid Player',   desc: 'Complete 10 Normal quests (daily or weekly)',  progress: { path: 'missions.stats.byTier.normal', target: 10  } },
            { rarity: 'rare',      name: 'Blue Collar',    desc: 'Complete 30 Normal quests (daily or weekly)',  progress: { path: 'missions.stats.byTier.normal', target: 30  } },
            { rarity: 'epic',      name: 'Mid Grinder',    desc: 'Complete 50 Normal quests (daily or weekly)',  progress: { path: 'missions.stats.byTier.normal', target: 50  } },
        ],
    },
    {
        id: 'mq_hard_quests', cat: 'basic', name: 'Hard Core', type: 'tiered',
        counter: { path: 'missions.stats.byTier.hard', label: 'Hard Quests Done' },
        tiers: [
            { rarity: 'rare',      name: 'Red Zone',       desc: 'Complete 5 Hard quests (daily or weekly)',    progress: { path: 'missions.stats.byTier.hard', target: 5   } },
            { rarity: 'epic',      name: 'Hard Earned',    desc: 'Complete 15 Hard quests (daily or weekly)',   progress: { path: 'missions.stats.byTier.hard', target: 15  } },
            { rarity: 'legendary', name: 'Relentless',     desc: 'Complete 25 Hard quests (daily or weekly)',   progress: { path: 'missions.stats.byTier.hard', target: 25  } },
        ],
    },
    {
        id: 'mq_total_quests', cat: 'basic', name: 'The Grind', type: 'tiered',
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
        check: () => false,
    },
    {
        id: 'mq_no_easy_epic', cat: 'secret', name: 'No Easy Day', type: 'single',
        rarity: 'epic', clue: 'The easy path is not for you.',
        desc: 'Have at least 4 Normal-or-harder daily quests rolled in one day.',
        check: () => false,
    },
    {
        id: 'mq_no_easy_legendary', cat: 'secret', name: 'No Easy Day', type: 'single',
        rarity: 'legendary', clue: 'Only the hardest.',
        desc: 'Have at least 3 Hard daily quests rolled in one day.',
        check: () => false,
    },
    {
        id: 'mq_hard_they_said', cat: 'secret', name: 'Hard They Said', type: 'single',
        rarity: 'epic', clue: 'You proved a point.',
        desc: 'Complete only the Hard weekly mission — leave all others unfinished.',
        check: () => false,
    },
    {
        id: 'mq_lazy_lucky', cat: 'secret', name: 'Lazy or Lucky?', type: 'single',
        rarity: 'epic', clue: 'One day, one secret, nothing more.',
        desc: 'Complete only the secret daily quest in a day — leave all regular quests unfinished.',
        check: () => false,
    },
    {
        id: 'mq_double_badge', cat: 'secret', name: 'Two Birds', type: 'single',
        rarity: 'rare', clue: 'One run. Two victories.',
        desc: 'Unlock any 2 achievements in a single game.',
        check: () => false,
    },
    ].map(ach => ({ ...ach, svgIcon: achievementIcon(ach.id) }));

    // Patch collector badge — set final tier target to total buyable items
    (function() {
        const coll = ACHIEVEMENTS_DEF.find(a => a.id === 'collector');
        if (!coll || !coll.tiers) return;
        // Count buyable items (exclude defaults: Retro skin, default theme, lines grid, classic palette, default sfx)
        const _buyable = 7 + (Object.keys(THEMES).length - 1) + (Object.keys(GRID_STYLES).length - 1) + (Object.keys(BLOCK_PALETTES).length - 1) + 4 + 1;
        const finalTier = coll.tiers[coll.tiers.length - 1];
        if (finalTier) finalTier.progress = { path: '_computed.itemsBought', target: _buyable };
    })();

    function _getProgressVal(path) {
        if (path === '_computed.musicTracksListened') return LBSave.musicCounts(saveData.stats.songPlayCounts).total;
        if (path === '_computed.itemsCollected') {
            const _os = (saveData.ownedSkins || [DEFAULT_BLOCK_SKIN]).length;
            const _ot = (saveData.ownedThemes || []).length + 1;
            const _og = (saveData.ownedGridStyles || []).length + 1;
            const _op = (saveData.ownedPalettes || ['classic']).length;
            const _ox = (saveData.ownedSfxPacks || ['default']).length;
            const _gh = saveData.ghostColorUnlocked ? 1 : 0;
            return _os + _ot + _og + _op + _ox + _gh;
        }
        if (path === '_computed.itemsBought') {
            // Count only non-default/non-free items
            const _os = (saveData.ownedSkins || [DEFAULT_BLOCK_SKIN]).filter(s => s !== DEFAULT_BLOCK_SKIN).length;
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
                if (a.type === 'tiered') count += Number(st.tier) || 0;
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
        saveData.achievements[id] = { unlocked: true, unlockedAt: LBSave.localDate(new Date()) };
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
        if (!_audioInForeground()) return;
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
                            saveData.achievements[ach.id].tierDates[i+1] = LBSave.localDate(new Date());
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
                    }), { score: 0, maxSpeed: 0, lines: 0, time: 0 });
                    if (tier.check({ ..._lbBest, mode: 'normal', blocks: 0, quadraKill: false, boardCleared: false, maxLineStreak: 0, maxBlocksIn60s: 0, iPieceLines: 0, clearedTopLine: false, highPlacer: 0, noRotate: false, equalPieces: false, luckySevenCount: 0, waitedFourLineClear: false, noHardDrop: false, allHardDrop: false, bigFont: false, exactBlocks100: false, speedrunner: 9999, earlyBird: false })) {
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
        const _today = LBSave.localDate(new Date());
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
                        saveData.achievements[ach.id].tierDates[i+1] = LBSave.localDate(new Date());
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
        document.getElementById('btn-achievements').toggleAttribute('data-ready', saveData.pendingAchievementClaims?.length > 0);
    }

    function _showGoAchievements(list) {
        const el = document.getElementById('go-achievements-new');
        el.hidden = !list.length;
        el.innerHTML = el.hidden ? '' : `<h2 class="go-section-title" id="go-ach-title">New achievements</h2><ul class="go-reward-list">` +
            list.map(a => {
                const rarity = a._newTier ? a._newTier.rarity : a.rarity;
                const name   = a._newTier ? a._newTier.name   : a.name;
                const rc = RARITY_ACH[rarity] || RARITY_ACH.common;
                const tierLabel = a._newTierNum ? ` · Tier ${a._newTierNum}` : '';
                return `<li class="go-ach-card" data-rarity="${rarity}">
                    <div class="go-ach-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="22" height="22">${a.svgIcon}</svg>
                    </div>
                    <div><strong>${escapeHtml(name)}</strong><small>${rc.label}${tierLabel}</small></div>
                </li>`;
            }).join('') + '</ul>';
    }

    function _showGameAchievement(ach, tierIdx) {
        if (!_audioInForeground()) return;
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
        if (!_audioInForeground() || !list || !list.length) return;
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
                position:fixed;top:calc(var(--lb-band-height) + ${stackOffset + idx * 82}px);left:50%;transform:translateX(-50%) translateY(-70px);
                z-index:var(--lb-z-top-notice);opacity:0;
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

    const _SVG_CALENDAR = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:2px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

    const achievementProgressPaths = [...new Set(ACHIEVEMENTS_DEF.flatMap(ach => (ach.tiers || [])
        .map(tier => tier.progress?.path || tier.progressDisplay?.path)).filter(Boolean))];
    const retiredStreakAchievements = new Set(['streak_lost', 'mq_streak_7', 'mq_streak_30', 'mq_all_cleared', 'mq_barely']);
    function renderAchievementsOverlay(tab, opening = false) {
        tab = tab || 'all';
        checkProgressAchievements();
        const overlay = document.getElementById('achievements-overlay');
        if (!overlay) return;

        const _prevAchTab = overlay._achTab || null;
        overlay._achTab = tab;
        const _isAchTabSwitch = !opening && !!_prevAchTab && _prevAchTab !== tab;
        const _ACH_ORD = ['all', 'unlocked', 'locked'];

        overlay.querySelectorAll('[data-achtab]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.achtab === tab));
        });

        const container = document.getElementById('ach-list');
        if (!container) return;
        const showDates = overlay.querySelector('#ach-dates-toggle').checked;
        const category = overlay.querySelector('#ach-category').value;
        const sort = overlay.querySelector('#ach-sort').value;
        const pending = saveData.pendingAchievementClaims || [];
        const renderKey = JSON.stringify([tab, showDates, category, sort, saveData.achievements, pending, achievementProgressPaths.map(_getProgressVal)]);
        if (container.renderKey === renderKey && pending.every((claim, index) => claim === container.renderClaims[index])) return;
        container.renderKey = renderKey;
        container.renderClaims = pending.slice();

        if (_isAchTabSwitch && container.innerHTML.trim()) {
            const _bRect = container.getBoundingClientRect();
            const _exitEl = document.createElement('div');
            _exitEl.style.cssText = `position:fixed;top:${_bRect.top}px;left:${_bRect.left}px;width:${_bRect.width}px;height:${_bRect.height}px;pointer-events:none;z-index:2000;overflow:hidden;`;
            _exitEl.setAttribute('aria-hidden', 'true');
            _exitEl.append(...Array.from(container.childNodes, child => child.cloneNode(true)));
            _exitEl.inert = true;
            document.body.appendChild(_exitEl);
            const _oi = _ACH_ORD.indexOf(_prevAchTab), _ni = _ACH_ORD.indexOf(tab);
            _exitEl.classList.add(_ni > _oi ? 'mq-tab-slide-out-left' : 'mq-tab-slide-out-right');
            _exitEl.addEventListener('animationend', () => _exitEl.remove(), { once: true });
        }

        container.innerHTML = '';

        if (_isAchTabSwitch) {
            const _oi = _ACH_ORD.indexOf(_prevAchTab), _ni = _ACH_ORD.indexOf(tab);
            _animateIn(container, _ni > _oi ? 'tab-slide-in-right' : 'tab-slide-in-left');
        }

        closeInfo();
        const tip = infoPanel('ach-tip');

        if (saveData.pendingAchievementClaims?.length > 0) {
            const pendingSection = document.createElement('section');
            pendingSection.className = 'ach-pending lb-block-panel';
            pendingSection.setAttribute('aria-label', 'Pending rewards');
            const pendingHeader = document.createElement('div');
            pendingHeader.className = 'ach-pending-head lb-block-panel-head';
            pendingHeader.innerHTML = '<h2 class="lb-block-section-title">PENDING REWARDS</h2>';
            if (saveData.pendingAchievementClaims.length > 1) {
                const claimAllBtn = document.createElement('button');
                claimAllBtn.className = 'lb-block-btn lb-block-btn--primary';
                claimAllBtn.classList.add('lb-ledger-claim');
                claimAllBtn.textContent = 'Claim all';
                claimAllBtn.addEventListener('click', () => _claimAfterPaint(claimAllBtn, () => {
                    let totalXpGained = 0;
                    const claims = [...saveData.pendingAchievementClaims];
                    saveData.pendingAchievementClaims = [];
                    claims.forEach(c => { _grantXP(c.xp); totalXpGained += c.xp; });
                    playSFX('unlock');
                    const rect = claimAllBtn.getBoundingClientRect();
                    _spawnAchClaimFloat(rect.left + rect.width / 2, rect.top, totalXpGained, '#00ffff');
                    _checkAchGlow();
                    saveDataToFile();
                    drawRankBadge();
                    renderAchievementsOverlay(tab);
                }));
                pendingHeader.appendChild(claimAllBtn);
            }
            pendingSection.appendChild(pendingHeader);
            const pendingGrid = document.createElement('div');
            pendingGrid.className = 'ach-pending-list';
            saveData.pendingAchievementClaims.forEach(claim => {
                const rarity = Object.hasOwn(RARITY_ACH, claim.rarity) ? claim.rarity : 'common';
                const rc = RARITY_ACH[rarity];
                const card = document.createElement('div');
                card.className = 'ach-pending-row';
                card.dataset.rarity = rarity;
                const name = retiredStreakAchievements.has(claim.id) ? 'Legacy achievement' : claim.name;
                const nameHtml = `<div class="ach-row-copy"><strong>${escapeHtml(name)}</strong><small class="lb-ledger-rarity-label">${rc.label}</small></div>`;
                const claimBtn = document.createElement('button');
                claimBtn.className = 'lb-block-btn lb-block-btn--primary lb-ledger-claim';
                claimBtn.textContent = 'Claim';
                claimBtn.setAttribute('aria-label', `Claim ${name}`);
                claimBtn.addEventListener('click', () => _claimAfterPaint(claimBtn, () => {
                    const idx = saveData.pendingAchievementClaims.indexOf(claim);
                    if (idx < 0) return;
                    _grantXP(claim.xp);
                    saveData.pendingAchievementClaims.splice(idx, 1);
                    playSFX('unlock');
                    const rect = claimBtn.getBoundingClientRect();
                    _spawnAchClaimFloat(rect.left + rect.width / 2, rect.top, claim.xp, rc.color);
                    _checkAchGlow();
                    saveDataToFile();
                    drawRankBadge();
                    renderAchievementsOverlay(tab);
                }));
                card.innerHTML = nameHtml;
                card.appendChild(claimBtn);
                pendingGrid.appendChild(card);
            });
            pendingSection.appendChild(pendingGrid);
            container.appendChild(pendingSection);
        }

        const sectionCounts = new Map();
        let publicTotal = 0, publicDone = 0;
        const renderItems = [];
        for (const ach of ACHIEVEMENTS_DEF) {
            const entry = saveData.achievements?.[ach.id];
            const maxTier = ach.type === 'tiered' ? ach.tiers.length : 1;
            const curTier = ach.type === 'tiered' ? Math.min(Math.max(0, entry?.tier || 0), maxTier) : Number(!!entry?.unlocked);
            const counts = sectionCounts.get(ach.cat) || { total: 0, done: 0 };
            counts.total += maxTier;
            counts.done += curTier;
            sectionCounts.set(ach.cat, counts);
            if (ach.cat !== 'secret') {
                publicTotal += maxTier;
                publicDone += curTier;
            }
            if (category !== 'all' && ach.cat !== category) continue;
            if (ach.type === 'tiered') {
                if (curTier > 0 && (tab === 'all' || tab === 'unlocked'))
                    renderItems.push({ ach, kind: 'unlocked', curTier, maxTier });
                if (curTier < maxTier && (tab === 'all' || tab === 'locked'))
                    renderItems.push({ ach, kind: 'locked', curTier, maxTier });
            } else {
                const kind = curTier ? 'unlocked' : 'locked';
                if (tab === 'all' || tab === kind) renderItems.push({ ach, kind, curTier, maxTier });
            }
        }
        const secretCounts = sectionCounts.get('secret') || { total: 0, done: 0 };
        const completion = publicTotal ? Math.round(publicDone / publicTotal * 100) : 0;
        overlay.querySelector('#ach-counter').textContent = `${completion}% complete`;
        overlay.querySelector('#ach-secret-counter').textContent = `Secrets ${secretCounts.done} of ${secretCounts.total}`;
        overlay.querySelector('#ach-milestone-count').textContent = `${publicDone} of ${publicTotal} unlocked`;
        const milestoneProgress = overlay.querySelector('#ach-milestone-progress');
        milestoneProgress.max = publicTotal || 1;
        milestoneProgress.value = publicDone;

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
            if (ach.cat !== 'secret' && ach.type === 'tiered' && curTier < ach.tiers.length) {
                const nxt = ach.tiers[curTier];
                const progressInfo = nxt.progress || nxt.progressDisplay;
                if (progressInfo) {
                    const cur = _getProgressVal(progressInfo.path);
                    return Math.max(0, Math.min(1, cur / progressInfo.target));
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
        const byRarity = (a, b) => (_RARITY_ORDER[_getRarityOfItem(b)] || 0) - (_RARITY_ORDER[_getRarityOfItem(a)] || 0);
        const byProgress = (a, b) => _getProgressOfItem(b) - _getProgressOfItem(a);
        function defaultOrder(a, b) {
            const rarityDelta = byRarity(a, b);
            if (rarityDelta) return rarityDelta;
            const progressDelta = byProgress(a, b);
            if (Math.abs(progressDelta) > 0.001) return progressDelta;
            return _getNameOfItem(a).localeCompare(_getNameOfItem(b));
        }
        function unlockDate({ ach, kind, curTier }) {
            if (kind !== 'unlocked') return '';
            const entry = saveData.achievements?.[ach.id];
            return LBSave.date(ach.type === 'tiered' ? entry?.tierDates?.[curTier] : entry?.unlockedAt);
        }
        const sortOrders = {
            rarity: byRarity,
            progress: byProgress,
            recent: (a, b) => unlockDate(b).localeCompare(unlockDate(a)),
        };
        const order = sortOrders[sort];
        renderItems.sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === 'unlocked' ? -1 : 1;
            return (order?.(a, b) || 0) || defaultOrder(a, b);
        });

        if (!renderItems.length) {
            const empty = document.createElement('div');
            empty.className = 'ach-empty';
            empty.textContent = 'Nothing here yet.';
            container.appendChild(empty);
            return;
        }

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
            const isSecretLocked = ach.cat === 'secret' && !isUnlocked;
            const _progressFrac = _getProgressOfItem(item);
            const title = isSecretLocked ? 'Secret achievement' : _getNameOfItem(item);

            const wrap = document.createElement('button');
            wrap.type = 'button';
            wrap.className = 'ach-card lb-block-btn lb-ledger-row';
            wrap.dataset.state = kind;
            if (!isSecretLocked) wrap.dataset.achId = ach.id;
            const icon = isSecretLocked ? achievementIcon('question') : ach.svgIcon;
            const state = isUnlocked ? 'Unlocked' : 'Locked';
            const tier = ach.type === 'tiered' ? ach.tiers[isUnlocked ? curTier - 1 : curTier] : null;
            const detail = isSecretLocked ? state : tier?.desc || ach.desc || rc.label;
            const medal = tier && (rarity === 'common' ? 'bronze' : rarity === 'rare' ? 'silver' : 'gold');
            const progressInfo = !isSecretLocked && !isUnlocked && (tier?.progress || tier?.progressDisplay);
            const meter = progressInfo ? `<progress class="lb-block-progress" max="1" value="${_progressFrac}" aria-label="Achievement progress"></progress>` : '';
            const progressText = progressInfo && `${_getProgressVal(progressInfo.path).toLocaleString('en-US')} / ${progressInfo.target.toLocaleString('en-US')}`;
            const art = medal ? `<img class="ach-card-icon" src="assets/ui/medals/${medal}.png" alt="">`
                : `<svg class="ach-card-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${icon}</svg>`;
            wrap.innerHTML = `${art}
                <span class="ach-row-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small>${meter}</span>
                <span class="ach-card-state">${progressText ? `<small>${escapeHtml(progressText)}</small>`
                    : `<span class="lb-ledger-tag" role="img" aria-label="${state}">${isUnlocked
                        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#lb-reward-check"/></svg>' : ''}</span>`}</span>`;
            const iconEl = wrap.querySelector('.ach-card-icon');
            bindInfoPreview(wrap, () => {
                const dateLine = value => {
                    const date = showDates && LBSave.displayDate(value);
                    return date ? `<div class="ach-tip-note">${_SVG_CALENDAR}${escapeHtml(date)}</div>` : '';
                };
                const tierLine = (tier, prefix = '') => `<div class="ach-tip-tier" data-rarity="${tier.rarity}">${prefix}${escapeHtml(tier.name)}</div><div>${escapeHtml(tier.desc)}</div>`;
                const counterLine = () => {
                    const count = ach.counter && _getProgressVal(ach.counter.path);
                    return count > 0 ? `<div class="ach-tip-note">${escapeHtml(ach.counter.label)}: ${escapeHtml(_fmtCounter(ach.counter, count))}</div>` : '';
                };
                let html = `<div class="ach-tip-title">${isSecretLocked ? '???' : escapeHtml(ach.name)}</div>`;
                if (ach.type === 'tiered') {
                    if (isUnlocked) {
                        const tierDates = saveData.achievements?.[ach.id]?.tierDates || {};
                        for (const [index, tier] of ach.tiers.slice(0, curTier).entries()) {
                            html += tierLine(tier, `${RARITY_ACH[tier.rarity].label} — `) + dateLine(tierDates[index + 1]);
                        }
                        if (curTier === maxTier) html += counterLine();
                    } else {
                        const next = ach.tiers[curTier];
                        html += tierLine(next, curTier === 0 ? 'First tier: ' : 'Next: ');
                        const progressInfo = next.progress || next.progressDisplay;
                        if (progressInfo) {
                            html += `<div class="ach-tip-note">${escapeHtml(_getProgressVal(progressInfo.path))} / ${progressInfo.target}</div>`;
                        } else if (!ach.tiers.some(tier => tier.progress || tier.progressDisplay)) {
                            html += counterLine();
                        }
                    }
                    html += `<div class="ach-tip-total">Tiers earned: ${curTier} / ${maxTier}</div>`;
                } else {
                    if (!isSecretLocked) {
                        html += `<div class="ach-tip-tier" data-rarity="${rarity}">${rc.label}</div><div>${escapeHtml(ach.desc)}</div>`;
                        if (isUnlocked) html += dateLine(saveData.achievements?.[ach.id]?.unlockedAt);
                    }
                    if (ach.clue) html += `<div class="ach-tip-note">“${escapeHtml(ach.clue)}”</div>`;
                    if (isUnlocked && ach.id === 'afk') {
                        const seconds = saveData.stats?.menuIdleTime || 0;
                        if (seconds > 0) html += `<div class="ach-tip-total">Longest idle: ${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s</div>`;
                    }
                }
                tip.innerHTML = html;
                wrap.setAttribute('aria-describedby', tip.id);
                showInfo(tip, wrap, { position: iconEl, dismiss: () => {
                    tip.hidden = true;
                    wrap.removeAttribute('aria-describedby');
                } });
            }, { tap: true, toggle: true });
            return wrap;
        }

        function renderSection(items, cat, counts) {
            if (!items.length) return;
            const section = document.createElement('section');
            section.dataset.achGroup = cat;
            section.className = 'lb-block-panel ach-group';
            const header = document.createElement('div');
            header.className = 'lb-block-panel-head ach-section-head';
            header.innerHTML = `<h2 class="lb-block-section-title">${escapeHtml(cat.toUpperCase())}</h2><span class="ach-count-label">${counts.done} of ${counts.total}</span>`;
            section.appendChild(header);
            const grid = document.createElement('div');
            grid.className = 'ach-records';
            items.forEach(item => grid.appendChild(buildCard(item)));
            section.appendChild(grid);
            container.appendChild(section);
        }

        for (const [cat, counts] of sectionCounts) {
            renderSection(renderItems.filter(item => item.ach.cat === cat), cat, counts);
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
    const CELESTITE_XP_PER_LEVEL = 24000;

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
        const celestiteLevel = level + 1 + Math.floor((xp - cumulative) / CELESTITE_XP_PER_LEVEL);
        const celestiteXpInto = (xp - cumulative) % CELESTITE_XP_PER_LEVEL;
        return { level: celestiteLevel, lvlInRank: 0, currentXP: celestiteXpInto, neededXP: CELESTITE_XP_PER_LEVEL, percent: celestiteXpInto / CELESTITE_XP_PER_LEVEL, rank: { name: CELESTITE_RANK.name, c: CELESTITE_RANK.c, shape: null }, isUltimateChampion: false, isLegend: true, isDiamond: false, isCelestite: true };
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
    const _FILL_STEPS = 128;
    const _fillFractionAt = index => (1 - Math.cos(Math.PI * index / _FILL_STEPS)) / 2;

    const _CIRCLE_FILL_LUT = (() => {
        const LUT = new Float32Array(_FILL_STEPS + 1);
        LUT[0] = 1;
        LUT[_FILL_STEPS] = -1;
        for (let i = 1; i < _FILL_STEPS; i++) {
            const tf = _fillFractionAt(i);
            let lo = 0, hi = 1;
            for (let iter = 0; iter < 32; iter++) {
                const mid = (lo + hi) / 2;
                const frac = mid <= 0 ? 0 : mid >= 1 ? 1 : (Math.acos(1 - 2 * mid) - 2 * (1 - 2 * mid) * Math.sqrt(mid * (1 - mid))) / Math.PI;
                if (frac < tf) lo = mid; else hi = mid;
            }
            LUT[i] = 1 - lo - hi;
        }
        return LUT;
    })();

    function _buildPolyFillLUT(pts) {
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

        const LUT = new Float32Array(_FILL_STEPS + 1);
        const minY = Math.min(...pts.map(point => point[1]));
        const maxY = Math.max(...pts.map(point => point[1]));
        LUT[0] = maxY;
        LUT[_FILL_STEPS] = minY;
        for (let i = 1; i < _FILL_STEPS; i++) {
            const targetArea = _fillFractionAt(i) * totalArea;
            let lo = minY, hi = maxY;
            for (let iter = 0; iter < 24; iter++) {
                const mid = (lo + hi) / 2;
                if (areaBelow(mid) < targetArea) hi = mid; else lo = mid;
            }
            LUT[i] = (lo + hi) / 2;
        }
        return LUT;
    }

    const _SHAPE_FILL_LUTS = new Map();
    function _getShapeFillLUT(shape, orbitAngle) {
        if (!shape || shape.sides === 0) return _CIRCLE_FILL_LUT;
        const key = `${shape.sides}_${shape.star ? 1 : 0}_${shape.innerRatio || 0}_${orbitAngle}`;
        if (_SHAPE_FILL_LUTS.has(key)) return _SHAPE_FILL_LUTS.get(key);
        const rotation = -(Math.PI + orbitAngle);
        const cos = Math.cos(rotation), sin = Math.sin(rotation);
        const pts = getShapePoints(0, 0, 1, shape).map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
        const lut = _buildPolyFillLUT(pts);
        _SHAPE_FILL_LUTS.set(key, lut);
        return lut;
    }

    function _fillCut(lut, fraction) {
        const index = _FILL_STEPS * Math.acos(1 - 2 * Math.max(0, Math.min(1, fraction))) / Math.PI;
        const low = Math.floor(index);
        return lut[low] + (lut[Math.min(_FILL_STEPS, low + 1)] - lut[low]) * (index - low);
    }

    function _traceMiniShape(ctx, sx, sy, r, shape) {
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

    const _haloSprites = new Map();
    const _HALO_RIM_SCALE = .92;

    function _badgeTone(color, amount) {
        const target = amount < 0 ? 0 : 255;
        const channels = color.slice(1).match(/../g).map(hex => parseInt(hex, 16));
        return `rgb(${channels.map(channel => Math.round(channel + (target - channel) * Math.abs(amount))).join(',')})`;
    }

    function _makeBadgeSprite(size, paint) {
        const sprite = document.createElement('canvas');
        sprite.width = sprite.height = Math.ceil(size * rankCanvas.width / 300);
        const ctx = sprite.getContext('2d');
        const scale = sprite.width / size;
        ctx.scale(scale, scale);
        ctx.lineJoin = 'round';
        paint(ctx, scale);
        return sprite;
    }

    function _getHaloSprites(r, shape, color) {
        if (_haloSprites.has(color)) return _haloSprites.get(color);
        const extent = r + 12;
        const size = extent * 2;
        const muted = _badgeTone(color, -.42);
        const empty = _makeBadgeSprite(size, (ctx, scale) => {
            _traceMiniShape(ctx, extent, extent, r, shape);
            ctx.fillStyle = '#181c20';
            ctx.fill();
            _traceMiniShape(ctx, extent, extent, r * _HALO_RIM_SCALE, shape);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = color;
            ctx.shadowBlur = 5 * scale;
            ctx.stroke();
            ctx.shadowBlur = 0;
            _traceMiniShape(ctx, extent, extent, r * .68, shape);
            ctx.strokeStyle = _badgeTone(color, -.5);
            ctx.lineWidth = .8;
            ctx.stroke();
        });
        const filled = _makeBadgeSprite(size, ctx => {
            _traceMiniShape(ctx, extent, extent, r, shape);
            const surface = ctx.createLinearGradient(extent - r, extent - r, extent - r * .5, extent + r);
            surface.addColorStop(0, muted);
            surface.addColorStop(1, _badgeTone(color, -.83));
            ctx.fillStyle = surface;
            ctx.fill();

            _traceMiniShape(ctx, extent, extent, r * _HALO_RIM_SCALE, shape);
            ctx.strokeStyle = color;
            ctx.lineWidth = 4.2;
            ctx.stroke();
            ctx.strokeStyle = _badgeTone(color, .69);
            ctx.lineWidth = .9;
            ctx.stroke();

            _traceMiniShape(ctx, extent, extent, r * .68, shape);
            ctx.strokeStyle = color;
            ctx.lineWidth = .8;
            ctx.stroke();
        });
        const sprites = { empty, filled, extent, size, edge: _badgeTone(color, .35) };
        _haloSprites.set(color, sprites);
        return sprites;
    }

    function _drawMiniShape(ctx, sx, sy, r, shape, fillLevel, color, orbitAngle) {
        const { empty, filled, extent, size, edge } = _getHaloSprites(r, shape, color);
        ctx.drawImage(empty, sx - extent, sy - extent, size, size);
        if (fillLevel <= 0) return;
        if (fillLevel >= 1) {
            ctx.drawImage(filled, sx - extent, sy - extent, size, size);
            return;
        }

        const rotation = Math.PI + orbitAngle;
        const cut = r * _fillCut(_getShapeFillLUT(shape, orbitAngle), fillLevel);
        const reach = extent * Math.SQRT2;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.rect(-reach, cut, 2 * reach, reach - cut);
        ctx.clip();
        ctx.rotate(-rotation);
        ctx.drawImage(filled, -extent, -extent, size, size);
        ctx.restore();

        ctx.save();
        _traceMiniShape(ctx, sx, sy, r * _HALO_RIM_SCALE, shape);
        ctx.clip();
        ctx.translate(sx, sy);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.moveTo(-reach, cut);
        ctx.lineTo(reach, cut);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.4;
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

    const _CELESTITE_SHIELD = [[150, 30], [250, 75], [250, 170], [150, 275], [50, 170], [50, 75]];
    const _CELESTITE_CURVES = [[250, 248], [50, 248]];
    function _traceCelestiteShield(ctx) {
        ctx.beginPath();
        ctx.moveTo(..._CELESTITE_SHIELD[0]);
        ctx.lineTo(..._CELESTITE_SHIELD[1]);
        ctx.lineTo(..._CELESTITE_SHIELD[2]);
        ctx.quadraticCurveTo(..._CELESTITE_CURVES[0], ..._CELESTITE_SHIELD[3]);
        ctx.quadraticCurveTo(..._CELESTITE_CURVES[1], ..._CELESTITE_SHIELD[4]);
        ctx.lineTo(..._CELESTITE_SHIELD[5]);
        ctx.closePath();
    }

    function _getCelestiteFillLUT() {
        const points = _CELESTITE_SHIELD.slice(0, 3);
        _CELESTITE_CURVES.forEach((control, index) => {
            const start = _CELESTITE_SHIELD[index + 2];
            const end = _CELESTITE_SHIELD[index + 3];
            for (let step = 1; step <= 16; step++) {
                const t = step / 16;
                points.push(start.map((value, axis) => (1 - t) ** 2 * value + 2 * t * (1 - t) * control[axis] + t ** 2 * end[axis]));
            }
        });
        points.push(_CELESTITE_SHIELD[5]);
        return _buildPolyFillLUT(points);
    }

    let _celestiteHalo;
    let _celestiteFillLUT;

    const BADGE_LEVEL_LABEL = 'none';
    function _badgeLevelLabel(info, mode = BADGE_LEVEL_LABEL) {
        if (mode === 'roman') return _toRoman(info.lvlInRank);
        return mode === 'number' ? String(info.level) : '';
    }
    function _drawBadgeLabel(ctx, x, y, info, color) {
        const text = _badgeLevelLabel(info);
        if (!text) return;
        const fontSize = Math.min(52, 235 / text.length);
        ctx.save();
        ctx.font = `${fontSize}px Silkscreen, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const metrics = ctx.measureText(text);
        const offsetX = ((metrics.actualBoundingBoxLeft ?? 0) - (metrics.actualBoundingBoxRight ?? 0)) / 2;
        const offsetY = ((metrics.actualBoundingBoxAscent ?? fontSize) - (metrics.actualBoundingBoxDescent ?? 0)) / 2;
        ctx.fillStyle = color;
        ctx.fillText(text, x + offsetX, y + offsetY);
        ctx.restore();
    }

    function _drawBadgeCanvas(displayPercent, info, xpLabel, xpProgress) {
        const ctx = rankCtx;
        const w = 300, h = 300; // CSS pixel dimensions (canvas is DPR-scaled internally)
        const cx = w / 2, cy = h / 2;
        const rankColor = info.isLegend ? '#ffffff' : info.rank.c;
        const shape = info.rank.shape;
        _badgeTime++;

        ctx.clearRect(0, 0, w, h);

        if (info.isCelestite || info.isLegend) {
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

            // --- AURORA FILL (color slowly shifts hue) ---
            _celestiteFillLUT ??= _getCelestiteFillLUT();
            const fillTop = _fillCut(_celestiteFillLUT, pct);
            const hueShift = t * 0.005;
            ctx.save();
            _traceCelestiteShield(ctx);
            ctx.clip();
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

            _celestiteHalo ??= _makeBadgeSprite(300, (halo, scale) => {
                _traceCelestiteShield(halo);
                halo.fillStyle = '#181c20';
                halo.fill();
                halo.strokeStyle = CELESTITE_RANK.c;
                halo.lineWidth = 4.2;
                halo.shadowColor = CELESTITE_RANK.c;
                halo.shadowBlur = 12 * scale;
                halo.stroke();
            });
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.drawImage(_celestiteHalo, 0, 0, w, h);
            ctx.restore();
            ctx.strokeStyle = gold;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(.8, .8);
            ctx.translate(-cx, -cy);
            _traceCelestiteShield(ctx);
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.restore();

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
            _drawBadgeLabel(ctx, cx, cy, info, rankColor);
            return;
        }
        const tilt = -Math.PI / 2 + Math.PI / 10 + info.lvlInRank * Math.PI / 5;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(114 / 24, 114 / 24);
        _drawMiniShape(ctx, 0, 0, 24, shape, displayPercent, rankColor, tilt);
        ctx.restore();
        _drawBadgeLabel(ctx, cx, cy, info, rankColor);

        const alpha = 1 - Math.min(1, Math.max(0, xpProgress || 0));
        if (xpLabel && alpha > .07) {
            ctx.save();
            ctx.font = `${Math.round(52 * alpha)}px Silkscreen, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 6;
            ctx.strokeText(xpLabel, cx, cy + 70);
            ctx.fillStyle = rankColor;
            ctx.fillText(xpLabel, cx, cy + 70);
            ctx.restore();
        }
    }

    function renderMenuRank(info, percent, totalXP) {
        const name = document.getElementById('badge-rank-name');
        name.textContent = info.isCelestite ? 'Celestite' : _rewardRankIdentity(info.level).name;
        name.style.setProperty('--lb-rank-tone', info.rank.c);
        document.getElementById('level-badge-container').style.setProperty('--lb-rank-tone', info.rank.c);
        document.getElementById('badge-level-num').textContent = `Level ${info.level.toLocaleString()}`;
        document.getElementById('menu-xp-detail').textContent = info.isCelestite
            ? `${Math.floor(totalXP).toLocaleString()} total XP`
            : `${Math.floor(info.currentXP).toLocaleString()} / ${info.neededXP.toLocaleString()} XP`;
        _setXpBarFill(percent * 100);
    }

    function drawRankBadge(overridePercent = null) {
        if (badgeAnimFrame) cancelAnimationFrame(badgeAnimFrame);
        badgeAnimFrame = null;

        const info = getLevelInfo(saveData.totalXP);
        const displayPercent = overridePercent !== null ? overridePercent : info.percent;

        const badgeMenu = document.getElementById('menu-overlay');
        const canAnimateBadge = () => !document.hidden && _rankBadgeVisible && !badgeMenu.classList.contains('hidden');
        function renderLoop() {
            badgeAnimFrame = null;
            if (canAnimateBadge()) renderBadgeFrame();
        }

        function renderBadgeFrame() {
            _drawBadgeCanvas(displayPercent, info);
            if ((info.isCelestite || info.isLegend) && canAnimateBadge()) badgeAnimFrame = requestAnimationFrame(renderLoop);
        }

        renderMenuRank(info, displayPercent, saveData.totalXP);
        if (!badgeMenu.classList.contains('hidden')) renderBadgeFrame();
        // Show pending level box if any
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
            const currentXP = startXP + gainedXPThisRound * ease;
            const tempInfo = getLevelInfo(currentXP);

            // Draw +XP label on badge canvas near filling shape (shrinks as fill progresses)
            _drawBadgeCanvas(tempInfo.percent, tempInfo, xpLabelText, ease);
            renderMenuRank(tempInfo, tempInfo.percent, currentXP);

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
    let isPaused=true, isGameOver=false, isAnimating=false;
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

    let _musicTrackStartTime30s = null;
    let _currentTrackName30s = '';
    let _currentTrackDuration30s = 0;
    let _waitedFourLineClearThisGame = false;
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
    const START_FLASH_MS = 500;
    let startFlashTimer = null;
    let currentGameMode = 'normal'; // 'normal', 'fun'
    let holdPiece = null, holdUsed = false;
    let funModeConfig = { cols: 10, rows: 20, startSpeed: 1 };
    if (!_qaDemo) try { const _fmc = JSON.parse(readLocalSave('funConfig') || 'null'); if (_fmc && typeof _fmc === 'object') funModeConfig = { ...funModeConfig, ..._fmc }; } catch(e) {}

    let player = {pos:{x:0,y:0},matrix:null,next:null};
    let pieceBag = []; let lastPieceColor = 0; let _nextQueue = [];

    function togglePause() {
        if (isGameOver || isAnimating || !document.getElementById('start-animation-overlay').classList.contains('hidden')) return;
        resetHeldInputs();
        isPaused = true;
        pauseMusic();
        document.getElementById('pause-mode').textContent = currentGameMode === 'fun' ? 'Fun run' : 'Normal run';
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
        _effectTime = lastTime;
        requestAnimationFrame(update);
        _animateOut(document.getElementById('pause-overlay'), 'anim-out-down');
    }

    async function restartPausedRun() {
        if (await customConfirm('Restart this run? Your current run will be discarded.', 'RESTART')) startGame();
    }

    async function quitGame() {
        const message = score === 0 ? 'End this run and view the results?'
            : "End this run and view the results?<br><br><b style='color:var(--primary);'>Your current score and XP will be saved.</b>";
        const confirmed = await customConfirm(message, 'QUIT');
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

    const _skinAtlases = new Map();
    const _skinTints = new Map();
    const _pieceAtlasCells = [null, 0, 5, 6, 1, 3, 2, 4];
    const _greyAtlasCell = 7, _whiteAtlasCell = 8;
    function imageSkinAtlasCell(id, defaultPalette = true) {
        if (!id) return null;
        const cell = _pieceAtlasCells[id];
        return cell == null ? _greyAtlasCell : defaultPalette ? cell : _whiteAtlasCell;
    }
    function imageSkinTintKey(skin, color) {
        return `${skin}|${color.toLowerCase()}`;
    }
    function _getSkinAtlas(skin) {
        const metadata = IMAGE_SKINS.get(skin);
        if (!metadata) return null;
        if (!_skinAtlases.has(skin)) {
            const image = new Image();
            image.decoding = 'async';
            const atlas = { image, cell: metadata.cell, ready: false };
            atlas.promise = new Promise(resolve => {
                image.onload = () => {
                    atlas.ready = true;
                    resolve(true);
                    if (!_visualReview && _gameInProgress && _renderSkin() === skin) {
                        drawGame(); drawNext();
                        if (settings.optHold) drawHold();
                    }
                };
                image.onerror = () => resolve(false);
            });
            _skinAtlases.set(skin, atlas);
            image.src = metadata.asset || `assets/skins/${metadata.file}`;
        }
        return _skinAtlases.get(skin);
    }
    function _tintedSkinCell(skin, atlas, color) {
        const key = imageSkinTintKey(skin, color);
        if (!_skinTints.has(key)) {
            const {image, cell} = atlas;
            const tile = document.createElement('canvas');
            tile.width = tile.height = cell;
            const context = tile.getContext('2d');
            context.drawImage(image, _whiteAtlasCell * cell, 0, cell, cell, 0, 0, cell, cell);
            context.globalCompositeOperation = 'multiply';
            context.fillStyle = color;
            context.fillRect(0, 0, cell, cell);
            if (_skinTints.size >= 128) _skinTints.delete(_skinTints.keys().next().value);
            _skinTints.set(key, tile);
        }
        return _skinTints.get(key);
    }
    function _drawSkinPreview(canvas, skin, id) {
        canvas.dataset.previewColor = id;
        const context = canvas.getContext('2d');
        const piece = BASE_PIECES[id].filter(row => row.some(Boolean));
        const size = 34;
        const draw = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.save();
            context.translate((canvas.width - piece[0].length * size) / 2, (canvas.height - piece.length * size) / 2);
            piece.forEach((row, y) => row.forEach((cell, x) => {
                if (cell) drawGameBlock(context, x, y, id, size, false, skin);
            }));
            context.restore();
        };
        const atlas = _getSkinAtlas(skin);
        if (!atlas || atlas.ready) draw();
        else atlas.promise.then(loaded => {
            if (loaded && Number(canvas.dataset.previewColor) === id) draw();
        });
    }

    const _blockCache = new Map();
    let _blockCacheStyle = '';
    function drawGameBlock(c,x,y,id,s,g=false,skin=_renderSkin()){
        if (!id) return;
        const atlas = g ? null : _getSkinAtlas(skin);
        const colors = COLORS.join(',');
        const defaultPalette = settings.colorPalette === 'classic' && !saveData.customPaletteOverrides?.classic && colors === CLASSIC_COLOR_KEY;
        const style = [colors, defaultPalette, settings.ghostColor, saveData.ghostColorUnlocked, window.devicePixelRatio].join('|');
        if (style !== _blockCacheStyle) { _blockCache.clear(); _blockCacheStyle = style; }
        const key = [atlas && !atlas.ready ? DEFAULT_BLOCK_SKIN : skin,id,s,g].join('|');
        let tile = _blockCache.get(key);
        const pad = 24, dpr = Math.min(2, window.devicePixelRatio || 1);
        if (!tile) {
            tile = document.createElement('canvas');
            tile.width = tile.height = Math.ceil((s+pad*2)*dpr);
            const tc = tile.getContext('2d'); tc.scale(dpr,dpr); tc.translate(pad,pad); tc._pixelRatio=dpr;
            _paintGameBlock(tc,0,0,id,s,g,skin,atlas,defaultPalette);
            _blockCache.set(key,tile);
        }
        c.drawImage(tile,x*s-pad,y*s-pad,tile.width/dpr,tile.height/dpr);
    }
    function _paintGameBlock(c,x,y,id,s,g,skin,atlas,defaultPalette){
        const col=COLORS[id] || '#888888';
        if(g){
            c.save();
            if ((settings.ghostColor === 'colored') && saveData.ghostColorUnlocked) {
                c.strokeStyle=col; c.lineWidth=2; c.globalAlpha=0.35; c.strokeRect(x*s+2,y*s+2,s-4,s-4);
                c.fillStyle=col; c.globalAlpha=0.08; c.fillRect(x*s,y*s,s,s);
            } else {
                c.strokeStyle='rgba(255,255,255,0.45)'; c.lineWidth=2; c.globalAlpha=1; c.strokeRect(x*s+2,y*s+2,s-4,s-4);
                c.fillStyle='rgba(255,255,255,0.06)'; c.fillRect(x*s,y*s,s,s);
            }
            c.restore(); return;
        }
        if (atlas?.ready) {
            const index = imageSkinAtlasCell(id, defaultPalette);
            const {image, cell} = atlas;
            if (index === _whiteAtlasCell) {
                c.drawImage(_tintedSkinCell(skin, atlas, col), x*s+1, y*s+1, s-2, s-2);
            } else {
                c.drawImage(image, index * cell, 0, cell, cell, x*s+1, y*s+1, s-2, s-2);
            }
            return;
        }
        if (skin === DEFAULT_BLOCK_SKIN || atlas) {
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
        } else if (skin === 'bubble') {
            // Rounded gel block — inspired by a bubble theme
            const _br=s*0.28,_bx=x*s+1,_by=y*s+1,_bw=s-2,_bh=s-2;
            const _bp=()=>{c.beginPath();c.moveTo(_bx+_br,_by);c.lineTo(_bx+_bw-_br,_by);c.arcTo(_bx+_bw,_by,_bx+_bw,_by+_br,_br);c.lineTo(_bx+_bw,_by+_bh-_br);c.arcTo(_bx+_bw,_by+_bh,_bx+_bw-_br,_by+_bh,_br);c.lineTo(_bx+_br,_by+_bh);c.arcTo(_bx,_by+_bh,_bx,_by+_bh-_br,_br);c.lineTo(_bx,_by+_br);c.arcTo(_bx,_by,_bx+_br,_by,_br);c.closePath();};
            _bp(); c.fillStyle=col; c.fill();
            c.strokeStyle='rgba(0,0,0,0.16)'; c.lineWidth=1; c.stroke();
        }
    }
    const SPAWN_ROWS = 2;
    let _gridCache = null;
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
        const elapsed = _effectTime === null || isPaused ? 0 : now - _effectTime;
        const effectDt = Math.min(100, elapsed);
        _effectTime = now;
        lineClear.advance(elapsed);
        ctx.clearRect(0,0,canvas._logicalWidth,canvas._logicalHeight);
        ctx.save();
        if(shakeIntensity>0){ctx.translate((Math.random()-.5)*shakeIntensity,(Math.random()-.5)*shakeIntensity);shakeIntensity*=Math.pow(.9,effectDt*60/1000);if(shakeIntensity<.5)shakeIntensity=0;}
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
        
        board.forEach((values, row) => {
            if (isAnimating && lineClear.drawRow(ctx, row, values, BLOCK, drawGameBlock)) return;
            values.forEach((value, column) => { if (value) drawGameBlock(ctx, column, row, value, BLOCK); });
        });
        if(player.matrix && !isAnimating){
            if(settings.optGhost){let gY=player.pos.y; while(!collide(board,{matrix:player.matrix,pos:{x:player.pos.x,y:gY}}))gY++; gY--;
            player.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v)drawGameBlock(ctx,player.pos.x+x,gY+y,v,BLOCK,true)}));}
            player.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v)drawGameBlock(ctx,player.pos.x+x,player.pos.y+y,v,BLOCK)}));
        }
        lineClear.drawParticles(ctx, BLOCK);
        for (let i = floatingTexts.length - 1; i >= 0; i--) { const ft = floatingTexts[i]; ft.update(effectDt); ft.draw(ctx); if (ft.l <= 0) floatingTexts.splice(i, 1); }
        ctx.restore()
    }
    function drawCenteredPiece(c,p,cell = BLOCK){
        if(!p)return;
        // Cell size relative to canvas — fills more of the canvas area
        const s = cell;
        let mX=10,gX=0,mY=10,gY=0;
        for(let y=0;y<p.length;y++)for(let x=0;x<p[y].length;x++)if(p[y][x]){if(x<mX)mX=x;if(x>gX)gX=x;if(y<mY)mY=y;if(y>gY)gY=y;}
        const pW=gX-mX+1, pH=gY-mY+1;
        const oX = (c.canvas._logicalWidth - pW * s) / 2 - mX * s;
        const oY = (c.canvas._logicalHeight - pH * s) / 2 - mY * s;
        p.forEach((r,y)=>r.forEach((v,x)=>{if(v)drawGameBlock(c, oX/s + x, oY/s + y, v, s)}));
    }
    function drawNext(){
        if (settings.optNoNext) { [pcNextCtx,mNextCtx].filter(Boolean).forEach(c=>{c.clearRect(0,0,c.canvas._logicalWidth,c.canvas._logicalHeight);}); return; }
        [pcNextCtx,mNextCtx].filter(Boolean).forEach(c=>{c.clearRect(0,0,c.canvas._logicalWidth,c.canvas._logicalHeight);drawCenteredPiece(c,player.next, c.canvas._logicalWidth * .23)});
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
        const bufferedMove = _bufferedMove;
        _bufferedMove = 0;
        if(!isGameOver && !isPaused){
            if (_moveDirection) handleMove(_moveDirection);
            else if (bufferedMove) playerMove(bufferedMove);
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
        if (panel) {
            panel.toggleAttribute('data-empty', !holdPiece);
            panel.toggleAttribute('data-used', holdUsed);
            document.getElementById('pc-hold-canvas').setAttribute('aria-label', !holdPiece ? 'Hold is empty' : holdUsed ? 'Held piece (unavailable until next piece)' : 'Held piece');
        }
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
    const COMBO_STEP_POINTS = 10;
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
                if (rows.length >= 4 && (gameTime - _lastIPieceGameTime) >= 90) _waitedFourLineClearThisGame = true;
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
            const clearMs = settings.lineClearMs ?? 150;
            lineClear.start({ skin: _renderSkin(), mode: settings.lineClearEffect, rows, board, colors: COLORS, duration: clearMs });
            _effectTime = performance.now();
            isAnimating=true;clearTimeout(dasTimer);clearInterval(arrTimer);drawGame();
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
                    const baseComboBonus = (_comboCount - 1) * COMBO_STEP_POINTS;
                    rawGameplayXPThisGame += baseComboBonus;
                    const comboBonus = Math.round(baseComboBonus * currentScoreMultiplier);
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
                }

                const oldSpeed = speedLevel;
                const _baseSpeed = currentGameMode === 'fun' ? Math.max(1, funModeConfig.startSpeed) : 1;
                speedLevel = Math.min(SPEED_MULTIPLIERS.length, Math.floor(linesClearedThisGame / LINES_PER_SPEED) + _baseSpeed);
                // Mission: reach speed 5 in under 3 minutes / speed 4 in under 2 minutes
                if (speedLevel >= 5 && !_mq_speedRun && gameTime < 180) _mq_speedRun = true;
                if (speedLevel >= 4 && !_mq_speedQueen && gameTime < 120) _mq_speedQueen = true;
                if (speedLevel > oldSpeed) {
                    _syncGameMusicTempo();
                    if (!LBMusicTempo.isIntenseSpeed(oldSpeed) && LBMusicTempo.isIntenseSpeed(speedLevel)) {
                        const intense = _getPlaylist('action');
                        if (intense.length && !intense.includes(_nowPlayingName)) {
                            if (_activeMusic?.started && _activeMusic.source.finishAtBar) _activeMusic.source.finishAtBar();
                            else _startGameMusicForCurrentSpeed(true);
                        }
                    }
                    playSFX('levelup');
                    if (settings.showSpeedUp !== false) {
                        floatingTexts.push(new FloatingText(canvas._logicalWidth / 2, canvas._logicalHeight / 2 - 20, `LEVEL UP!`, '#ffcc00', 32));
                        floatingTexts.push(new FloatingText(canvas._logicalWidth / 2, canvas._logicalHeight / 2 + 10, `LV ${speedLevel}`, '#ffcc00', 20));
                    }
                }
                dropInterval = Math.floor(1000 / speedLevel);
                // Board clear check (after removing lines)
                if (board.every(row => row.every(v => v === 0))) _boardClearedThisGame = true;
                lineClear.finish();
                updateUI();isAnimating=false;lastTime=performance.now();resetPlayer();
                _checkMidGameAchievements();
            }, clearMs);return true
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
        if (!_runMissionsPanel.hidden && t >= _runMissionsNextUpdate) {
            _runMissionsNextUpdate = t + 200;
            _renderRunMissions();
        }
        drawGame(); requestAnimationFrame(update);
    }
    function _renderHudLevel() {
        const progress = document.getElementById('lb-hud-level-progress');
        const label = document.getElementById('lb-hud-level-label');
        const capped = speedLevel === SPEED_MULTIPLIERS.length;
        const lines = capped ? LINES_PER_SPEED : linesClearedThisGame % LINES_PER_SPEED;
        const text = `LV ${speedLevel} · ${capped ? 'Max' : `${lines}/${LINES_PER_SPEED} lines`}`;
        if (label.textContent === text) return;
        progress.max = LINES_PER_SPEED;
        progress.value = lines;
        label.textContent = text;
    }
    function _fmtScoreHTML(v){const i=Math.floor(v);const d=Math.round((v-i)*10);return i.toLocaleString()+(d>0?`<span style="font-size:0.6em;opacity:0.7;">.${d}</span>`:'');}
    function formatRunClock(time) {
        const minutes = String(Math.floor(time / 60)).padStart(2, '0');
        const seconds = String(time % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }
    function updateUI() {
        document.getElementById('pc-score').innerHTML = _fmtScoreHTML(score);
        document.getElementById('pc-time').textContent = formatRunClock(gameTime);
        document.getElementById('pc-lines').textContent = linesClearedThisGame;
        _renderHudLevel();
        const fun = currentGameMode === 'fun';
        const record = fun ? (saveData.stats?.bestFunScore || 0) : _prevHighscore;
        const difference = score - record;
        const hint = document.getElementById('pc-pb-hint');
        hint.toggleAttribute('data-beaten', record > 0 && difference >= 0);
        if (record <= 0) hint.innerHTML = '<span class="label">No records yet</span>';
        else if (difference >= 0) hint.innerHTML = `<span class="label">New record!</span><span class="value">+${difference.toLocaleString()}</span>`;
        else hint.innerHTML = `<span class="label">${fun ? 'Fun record' : 'Personal record'}</span><span class="value">${record.toLocaleString()}</span><small>${(-difference).toLocaleString()} to beat</small>`;
    }
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
    
    function _renderGoXP(xp, totalXP) {
        const info = getLevelInfo(totalXP);
        document.getElementById('go-total-xp').textContent = `+${xp.toLocaleString()} XP`;
        document.getElementById('go-xp-progress').textContent = info.isCelestite
            ? `${Math.floor(totalXP).toLocaleString()} total XP`
            : `${Math.floor(info.currentXP).toLocaleString()} / ${info.neededXP.toLocaleString()} XP to next level`;
    }

    function _renderGoStats(best, isRecord, funMode, xp, recordBonus = 0) {
        document.getElementById('go-score').textContent = Math.round(score).toLocaleString();
        document.getElementById('go-best-score').textContent = Math.round(best).toLocaleString();
        document.getElementById('go-record-label').hidden = !isRecord;
        document.getElementById('go-record-medal').hidden = !isRecord;
        document.getElementById('go-previous-best').hidden = isRecord;
        document.getElementById('go-mode').textContent = funMode ? 'Fun' : 'Normal';
        document.getElementById('go-lines-cnt').textContent = linesClearedThisGame;
        document.getElementById('go-max-speed').textContent = speedLevel;
        document.getElementById('go-time').textContent = formatRunClock(gameTime);
        document.getElementById('go-rewards').hidden = funMode;
        if (!funMode) _renderGoXP(xp, saveData.totalXP + xp);
        document.getElementById('go-pin-btn').hidden = funMode;
        const bonus = document.getElementById('go-record-bonus');
        bonus.hidden = funMode || recordBonus <= 0;
        document.getElementById('go-record-bonus-xp').textContent = bonus.hidden ? '' : `+${recordBonus.toLocaleString()} XP`;
    }

    function gameOver(){
        _gameInProgress = false; // allow saves again — score and achievements saved together below
        isGameOver=true; isPaused=true;
        _syncRunMissions();
        isAnimating=false; _hardDropAnimating=false; // safety: clear all animation locks
        lineClear.reset();
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
            _updateMissionProgress({ funRuns: 1 });
            // Track best-ever stats for achievement progress bars
            if (gameTime > (saveData.stats.bestSurvivalTime || 0)) saveData.stats.bestSurvivalTime = gameTime;
            if (_maxLineStreakThisGame > (saveData.stats.bestLineStreak || 0)) saveData.stats.bestLineStreak = _maxLineStreakThisGame;
            if (_maxBlocksIn60sThisGame > (saveData.stats.bestBlocksIn60s || 0)) saveData.stats.bestBlocksIn60s = _maxBlocksIn60sThisGame;
            if (_iPieceLinesThisGame > (saveData.stats.bestIPieceLines || 0)) saveData.stats.bestIPieceLines = _iPieceLinesThisGame;
            if (_maxBlocksUnderHalfThisGame > (saveData.stats.bestHighPlacer || 0)) saveData.stats.bestHighPlacer = _maxBlocksUnderHalfThisGame;
            const previousFunBest = saveData.stats.bestFunScore || 0;
            if (score > previousFunBest) saveData.stats.bestFunScore = score;
            // Save to fun leaderboard (skip zero scores)
            if (Math.round(score) > 0) { if (!saveData.funLeaderboard) saveData.funLeaderboard = []; saveData.funLeaderboard.push({ score: Math.round(score), ..._scoreDate(), lines: linesClearedThisGame, time: gameTime, maxSpeed: speedLevel, cols: funModeConfig.cols, rows: funModeConfig.rows, startSpeed: funModeConfig.startSpeed }); saveData.funLeaderboard.sort((a,b) => b.score - a.score); if (saveData.funLeaderboard.length > 200) saveData.funLeaderboard = saveData.funLeaderboard.slice(0, 200); }
            // Check achievements even in fun mode (score-based ones apply)
            saveData.stats.luckySevenCount = (saveData.stats.luckySevenCount || 0) + _sec7CountThisGame;
            const funNewAch = checkAchievements({ score, lines: linesClearedThisGame, blocks: blocksPlacedThisGame, time: gameTime, maxSpeed: speedLevel, mode: currentGameMode, mirror: !!settings.optMirror, quadraKill: _quadraKillThisGame, boardCleared: _boardClearedThisGame, maxLineStreak: _maxLineStreakThisGame, maxBlocksIn60s: _maxBlocksIn60sThisGame, iPieceLines: _iPieceLinesThisGame, clearedTopLine: _clearedTopLineThisGame, highPlacer: _maxBlocksUnderHalfThisGame, noRotate: !_rotatedThisGame, equalPieces: false, luckySevenCount: saveData.stats.luckySevenCount, waitedFourLineClear: _waitedFourLineClearThisGame, noHardDrop: _hardDropsThisGame === 0, allHardDrop: _piecesThisGame >= 20 && _piecesThisGame === _piecesHardDroppedThisGame, bigFont: _bigFontGameFlag, exactBlocks100: blocksPlacedThisGame === 100, speedrunner: linesClearedThisGame >= 10 ? gameTime : 9999, earlyBird: _earlyBirdThisGame, nice69: _nice69Triggered, boardSymmetric: _boardSymmetricAchieved });
            _showGoAchievements(funNewAch);
            saveDataToFile();
            _renderGoStats(Math.max(previousFunBest, score), Math.round(score) > Math.round(previousFunBest), true, 0);
            _renderGoBoostRow(0);
            return; // skip XP/leaderboard processing
        }

        let finalXP=0, pbBonus=0;
        const playedAt = _scoreDate();
        const previousBest = _bestScore();
        if(linesClearedThisGame>0){
            if(Math.round(score) > previousBest && score > 0){
                playSFX('newrecord');
                if (previousBest > 0) (saveData.highscoreHistory ||= []).push({ ...saveData.leaderboard[0] });
                const bonusPct = _gamePersonalBestBonusPercent(previousBest);
                pbBonus = Math.round(score * bonusPct / 100);
            }
            finalXP = Math.round(score + pbBonus);
            // Multiplier already applied to score during gameplay
            saveToLeaderboard(Math.round(score), linesClearedThisGame, blocksPlacedThisGame, gameTime, speedLevel, finalXP, _maxComboThisGame, playedAt);
        }
        const best = _bestScore();
        _renderGoStats(best, best > previousBest, false, finalXP, pbBonus);
        gainedXPThisRound = finalXP;
        _updateGameMissionProgress(finalXP);
        const _lvlBefore = getLevelInfo(saveData.totalXP).level;
        saveData.totalXP += finalXP;
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
        if (finalXP > (saveData.stats.bestEarnedXP || 0)) saveData.stats.bestEarnedXP = finalXP;
        if (linesClearedThisGame >= 10 && gameTime < (saveData.stats.bestSpeedrunnerTime || 9999)) saveData.stats.bestSpeedrunnerTime = gameTime;
        // Track play history for calendar
        const playDate = LBSave.localDate(new Date());
        saveData.stats.lastPlayDate = playDate;
        const playHistory = saveData.stats.playHistory ||= {};
        playHistory[playDate] = (playHistory[playDate] || 0) + 1;
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
        { const _hs = previousBest; if (_hs > 0 && Math.round(score) >= _hs * 0.9 && Math.round(score) < _hs) { saveData.stats.nearMissCount = (saveData.stats.nearMissCount || 0) + 1; } else if (Math.round(score) > _hs && _hs > 0) { if ((saveData.stats.nearMissCount || 0) >= 2 && !saveData.achievements?.['third_charm']?.unlocked) unlockAchievement('third_charm'); saveData.stats.nearMissCount = 0; } }
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
        _lastGameStats = { score: Math.round(score), ...playedAt, lines: linesClearedThisGame, blocks: blocksPlacedThisGame, time: gameTime, maxSpeed: speedLevel, xp: finalXP, maxCombo: _maxComboThisGame };

        // Check achievements
        saveData.stats.luckySevenCount = (saveData.stats.luckySevenCount || 0) + _sec7CountThisGame;
        const _allHardDropped = _piecesThisGame >= 20 && _piecesThisGame === _piecesHardDroppedThisGame;
        const _equalPieces = Object.keys(_pieceTypeCounts).length === 7 && Object.values(_pieceTypeCounts).every(c => c === Object.values(_pieceTypeCounts)[0]) && blocksPlacedThisGame >= 50;
        const newAch = checkAchievements({ score, lines: linesClearedThisGame, blocks: blocksPlacedThisGame, time: gameTime, maxSpeed: speedLevel, mode: currentGameMode, mirror: !!settings.optMirror, quadraKill: _quadraKillThisGame, boardCleared: _boardClearedThisGame, maxLineStreak: _maxLineStreakThisGame, maxBlocksIn60s: _maxBlocksIn60sThisGame, iPieceLines: _iPieceLinesThisGame, clearedTopLine: _clearedTopLineThisGame, highPlacer: _maxBlocksUnderHalfThisGame, noRotate: !_rotatedThisGame, equalPieces: _equalPieces, luckySevenCount: saveData.stats.luckySevenCount, waitedFourLineClear: _waitedFourLineClearThisGame, noHardDrop: _hardDropsThisGame === 0, allHardDrop: _allHardDropped, bigFont: _bigFontGameFlag, exactBlocks100: blocksPlacedThisGame === 100, prevHighscore: _prevHighscore, speedrunner: linesClearedThisGame >= 10 ? gameTime : 9999, earlyBird: _earlyBirdThisGame, nice69: _nice69Triggered, boardSymmetric: _boardSymmetricAchieved });
        newAch.forEach(a => { const tIdx = a._newTierNum ? a._newTierNum - 1 : 0; const _mgKey = `${a.id}_${tIdx}`; if (!_midGameAchsShown.has(_mgKey)) _showGameAchievement(a, tIdx); });
        _showGoAchievements(newAch);
        saveDataToFile();

        _renderGoBoostRow(finalXP);
        } catch (error) {
            console.error('Game-over bookkeeping failed:', error);
        } finally {
            _reminders?.refresh();
            const results = document.getElementById('go-overlay');
            results.classList.remove('hidden');
            results.querySelector('.go-dialog-body').scrollTop = 0;
            _gameOverProtect = true;
            if (document.activeElement) document.activeElement.blur();
            resetHeldInputs();
            setTimeout(() => { _gameOverProtect = false; }, 800);
        }
    }

    function useScoreBooster(key) {
        if (gainedXPThisRound <= 0 || _boosterUsedThisRound) return;
        const mult = BOOSTER_INFO[key]?.mult;
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
        if (bonus > 0) _updateMissionProgress({ totalXP: bonus });
        _renderGoXP(gainedXPThisRound, saveData.totalXP);
        _renderGoBoostRow(gainedXPThisRound);
        animateXPGain();
        saveDataToFile();
    }
    function _renderGoBoostRow(xp) {
        const row = document.getElementById('go-boost-row');
        const available = [...BOOSTER_KEYS].reverse().filter(key => saveData.boosters?.[key] > 0);
        row.hidden = _boosterUsedThisRound || xp <= 0 || !available.length;
        row.innerHTML = row.hidden ? '' : `<div class="go-boost-heading"><h2 class="go-section-title" id="go-boost-title">XP boosters</h2><button type="button" class="lb-info-btn" data-help-section="boosters" aria-label="About score boosters" data-control-tip="About score boosters"></button></div>
            <ul class="go-reward-list go-boost-list">${available.map(key => {
                const { label, rarity } = BOOSTER_META[key];
                return `<li><button type="button" class="lb-block-btn" data-rarity="${rarity}" onclick="window.useScoreBooster('${key}')" aria-label="Use ${label}, ${escapeHtml(saveData.boosters[key])} available">
                    ${LBArtPack.boosterIcon(key)}
                    <strong>${label.replace(' Booster', ' XP')}</strong>
                    <small>${rarity}</small>
                    <span class="lb-block-reward-amount">×${escapeHtml(saveData.boosters[key])}</span>
                </button></li>`;
            }).join('')}</ul>`;
    }

    function clearStartFlash() {
        clearTimeout(startFlashTimer);
        startFlashTimer = null;
        document.getElementById('start-animation-overlay').classList.add('hidden');
    }

    function startAnimation(onStarted) {
        const overlay = document.getElementById('start-animation-overlay');
        LBArtPack.applyThemeBackground(overlay, settings.theme, settings.themeBackground);
        overlay.classList.remove('hidden');
        startFlashTimer = setTimeout(() => {
            clearStartFlash();
            if (isGameOver) return;
            document.getElementById('app').classList.add('active-game');
            _syncRunMissions(true);
            _refreshGameDPR();
            isPaused=false;
            _runMusicPaused = false;
            if(timeInterval)clearInterval(timeInterval);
            timeInterval=setInterval(()=>{if(!isPaused&&!isGameOver&&!document.hidden){gameTime++;updateUI()}},1000);
            lastTime=performance.now(); update(lastTime);
            if (!isGameOver) {
                if (musicPlaying) switchMusicMode('game');
                else startMusic('game');
            }
            onStarted?.();
        }, START_FLASH_MS);
    }

    function startGame(onStarted){
        if (_gameOverProtect || startFlashTimer !== null) return;
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
        window.LBAndroidUpdates?.syncSafety();
        // advanced mode removed
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
            ROWS = 22; COLS = COLS_NORMAL; BLOCK = 30;
            _sizeGameCanvas(canvas,COLS_NORMAL*BLOCK,VISIBLE_ROWS*BLOCK);
            if (_gcFun) _gcFun.style.aspectRatio = '1 / 2';
        }
        canvas.closest('#app').style.setProperty('--hud-board-ratio', COLS / (ROWS - SPAWN_ROWS));
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
        ['pc-next2-canvas','pc-next3-canvas','m-next2-canvas','m-next3-canvas','m-next2-wrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = (is3Next && !isNoNext) ? '' : 'none'; });
        document.getElementById('pc-next-wrap').toggleAttribute('data-expanded', is3Next && !isNoNext);
        // Hide entire next piece section when optNoNext is enabled
        ['pc-next-wrap','m-next-wrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = isNoNext ? 'none' : ''; });
        if (musicPlaying) fadeMusic(0, START_FLASH_MS / 1000);
        document.getElementById('menu-overlay').classList.add('hidden');
        const _goEl = document.getElementById('go-overlay');
        _goEl.classList.add('hidden'); _goEl.style.pointerEvents = '';
        lineClear.reset();
        board=Array.from({length:ROWS},()=>Array(COLS).fill(0)); drawGame();
        const _achFeed = document.getElementById('game-ach-feed');
        if (_achFeed) _achFeed.innerHTML = '';
        _midGameAchsShown = new Set();
        // Mirror mode visual flip
        const _gc = document.getElementById('game-container');
        if (_gc) _gc.style.transform = settings.optMirror ? 'scaleY(-1)' : '';
        isPaused=true;isGameOver=false; score=0;gameTime=0;pieceBag=[];_nextQueue=[];floatingTexts=[];lastPieceColor=0;
        currentScoreMultiplier = currentGameMode === 'fun' ? 1.0 : Math.max(0.1, _calcModeXpMult());
        speedLevel=1;linesClearedThisGame=0;blocksPlacedThisGame=0; _surgeonLinesThisGame=0; _highStackBlocksThisGame=0; xpFromBlocksThisGame=0; xpFromLinesThisGame=0; rawGameplayXPThisGame=0; dropInterval=1000;
        _quadraKillThisGame = false;
        _nextPieceType = 0; _currentPieceType = 0;
        _maxLineStreakThisGame = 0; _currentLineStreak = 0;
        _blockTimestampsThisGame = []; _maxBlocksIn60sThisGame = 0;
        _iPieceLinesThisGame = 0; _boardClearedThisGame = false; _boardSymmetricAchieved = false; _clearedTopLineThisGame = false;
        _rotatedThisGame = false; _pieceTypeCounts = {}; _sec7CountThisGame = 0; _sec7Last = []; const _ebH = new Date().getHours(); _earlyBirdThisGame = _ebH >= 5 && _ebH < 7;
        _waitedFourLineClearThisGame = false; _lastIPieceGameTime = -999;
        _hardDropsThisGame = 0; _pendingHardDrop = false; _piecesThisGame = 0; _piecesHardDroppedThisGame = 0;
        _rotationsThisGame = 0; _doublesThisGame = 0; _triplesThisGame = 0; _tSpinsThisGame = 0;
        _bottomTwoRowsThisGame = 0; _softDropUsedThisGame = false;
        _quadrasThisGame = 0; _comboCount = 0; _maxComboThisGame = 0; _lastMoveWasRotation = false; _prevHighscore = _bestScore();
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
        { const curSkin = _renderSkin(); if (curSkin === (saveData.stats._lastSkin || curSkin)) { saveData.stats.sameSkinStreak = (saveData.stats.sameSkinStreak || 0) + 1; } else { saveData.stats.sameSkinStreak = 1; } saveData.stats._lastSkin = curSkin; if ((saveData.stats.sameSkinStreak || 0) >= 50 && !saveData.achievements?.['skin_loyal']?.unlocked) unlockAchievement('skin_loyal'); }
        if (currentGameMode === 'fun') { speedLevel = Math.max(1, funModeConfig.startSpeed); dropInterval = 1000 / speedLevel; }
        resetPlayer();updateUI(); startAnimation(typeof onStarted === 'function' ? onStarted : undefined);
        if (settings.optHold) drawHold();
    }
    function startQARun(screen) {
        currentGameMode = 'normal';
        if (screen === 'start-animation') return startGame();
        return new Promise(resolve => startGame(() => {
            if (screen === 'pause') togglePause();
            if (screen === 'game-over') {
                score = _bestScore() + 120;
                linesClearedThisGame = 4;
                gameTime = 266;
                gameOver();
            }
            resolve();
        }));
    }
    function resetQARun() {
        clearStartFlash();
        _gameOverProtect = false;
        _gameInProgress = false;
        clearInterval(timeInterval);
        for (const id of ['pause-overlay', 'go-overlay']) {
            document.getElementById(id).classList.add('hidden');
        }
        resetGameToMenu();
    }
    function resetGameToMenu(){
        if (_gameOverProtect) return;
        isGameOver = false; isPaused = true;
        startMusic('menu');
        const goOverlay = document.getElementById('go-overlay');
        _animateOut(goOverlay, 'anim-out-down', function() {
            document.getElementById('app').classList.remove('active-game');
            const _menuEl = document.getElementById('menu-overlay');
            _menuEl.classList.remove('hidden');
            _animateIn(_menuEl, 'anim-in-left');
            refreshMenuUtilities();
        });
        fadeMusic(1, 0.8);
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
        closeInfo();
        if (controlsEditor.cancel()) return;
        switch (overlay.id) {
            case 'inventory-crate-overlay': overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return;
            case 'start-animation-overlay': return;
            case 'pause-overlay': pauseFromInput(overlay); return;
            case 'mode-select-overlay': closeModeSelect(); return;
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
        if (!action && event.code === 'KeyM' && runActive()) {
            event.preventDefault();
            if (!event.repeat) toggleMute('music');
            return;
        }
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
            heldMoves.delete(source);
            heldMoves.set(source, action === 'left' ? -1 : 1);
            updateInputMove();
        } else gameAction(action);
    }

    window.LBInput = {
        active: touchActive,
        unlockAudio() { _unlockAudio(true); },
        action: gameAction,
        press(action, pointerId) { pressGameInput(action, `touch:${pointerId}`); },
        release(pointerId) { releaseGameInput(`touch:${pointerId}`); }
    };

    // Android shell only: keep native navigation isolated from desktop input.
    const nativeApp = window.Capacitor?.isNativePlatform() && window.Capacitor.Plugins?.App;
    if (nativeApp?.addListener) {
        void startupWait('Android back button listener', () => nativeApp.addListener('backButton', async () => {
            const visible = el => el && !el.classList.contains('hidden')
                && getComputedStyle(el).display !== 'none';
            const overlays = [...document.querySelectorAll(
                '[id$="-overlay"], [id$="-modal"], #custom-confirm, #custom-alert, #sfx-inv-preview'
            )].filter(el => visible(el) && el.id !== 'menu-overlay');
            overlays.sort((a, b) => (parseInt(getComputedStyle(b).zIndex) || 0)
                - (parseInt(getComputedStyle(a).zIndex) || 0));
            const top = overlays[0];
            if (top?.id === 'start-animation-overlay') return;
            if (top?.id === 'custom-confirm') {
                document.getElementById('confirm-no').click();
            } else if (top?.id === 'custom-alert') {
                closeAlert();
            } else if (top?.id === 'mode-select-overlay') {
                closeModeSelect();
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
        })).catch(error => console.error('Android back button setup failed', error));
        void startupWait('Android lifecycle listener', () => nativeApp.addListener('appStateChange', ({ isActive }) => {
            _audioAppActive = isActive;
            _syncAudioLifecycle();
            if (isActive) _reminders?.refresh();
            if (!isActive && !isPaused && !isGameOver
                && document.getElementById('app').classList.contains('active-game')) togglePause();
        })).catch(error => console.error('Android lifecycle setup failed', error));
        for (const [event, paused] of [['pause', true], ['resume', false]]) {
            void startupWait(`Android ${event} listener`, () => nativeApp.addListener(event, () => {
                _audioAppPaused = paused;
                _syncAudioLifecycle();
            })).catch(error => console.error(`Android ${event} setup failed`, error));
        }
    }

    document.addEventListener('keydown',handleKeyDown); document.addEventListener('keyup',handleKeyUp);
    window.addEventListener('blur', resetHeldInputs);
    
    document.addEventListener('visibilitychange', () => {
        _syncAudioLifecycle();
        if (!document.hidden) refreshSeasonCard();
        if(document.hidden && document.getElementById('app').classList.contains('active-game') && !isGameOver && !isPaused && !isAnimating && document.getElementById('start-animation-overlay').classList.contains('hidden')) togglePause();
    });
    window.addEventListener('pagehide', event => {
        _audioPageHidden = true;
        if (!event.persisted) retireAudio();
        else _syncAudioLifecycle();
    });
    window.addEventListener('lb:bundle-restart', retireAudio);
    window.addEventListener('pageshow', () => {
        _audioPageHidden = false;
        _syncAudioLifecycle();
    });
    for (const type of ['pointerup', 'click', 'keydown']) {
        document.addEventListener(type, event => {
            if (!event.isTrusted || event.repeat || audioCtx?.state === 'running') return;
            const hadContext = Boolean(audioCtx);
            _unlockAudio(true);
            if (musicPlaying && !hadContext && audioCtx) switchMusicMode(_currentMode);
        }, { capture: true });
    }


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
    function _recordTrackListen() {
        if (!_currentTrackName30s || !_musicTrackStartTime30s || Date.now() - _musicTrackStartTime30s < _trackListenThresholdMs()) return;
        const counts = saveData.stats.songPlayCounts ||= {};
        counts[_currentTrackName30s] = (counts[_currentTrackName30s] || 0) + 1;
        checkProgressAchievements();
        if (LBSave.musicCounts(counts).mostPlayed >= 5 && !saveData.achievements?.fav_track?.unlocked) unlockAchievement('fav_track');
        saveDataToFile();
    }
    function updateNowPlaying(name, artist) {
        // music_listener: track when a new track starts playing
        if (name && name !== _currentTrackName30s) {
            _recordTrackListen();
            _currentTrackName30s = name;
            _musicTrackStartTime30s = Date.now();
            _currentTrackDuration30s = _trackDuration || 0;
        } else if (!name) {
            _recordTrackListen();
            _currentTrackName30s = '';
            _musicTrackStartTime30s = null;
            _currentTrackDuration30s = 0;
        }
        _nowPlayingName = name || '';
        _nowPlayingArtist = (artist !== undefined ? artist : _nowPlayingArtist) || '';
        _updateMusicWidget();
        if (!document.getElementById('playlist-overlay')?.classList.contains('hidden')) _renderPlaylistPanel();
    }
    function _syncPlaylistEqualizer() {
        const source = _activeMusic?.source;
        const playing = _activeMusic?.playing && source?.playing !== false && audioCtx?.state === 'running'
            && !settings.musicMuted && settings.musicVol > 0;
        _playlistContent?.toggleAttribute('data-playing', Boolean(playing));
    }
    function _fmtTime(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); }
    function _updateMusicWidget() {
        const titleEl = document.getElementById('mw-title');
        if (!titleEl) return;
        const titleText = _nowPlayingName || '—';
        titleEl.innerHTML = `<span class="mw-title-inner">${escapeHtml(titleText)}</span>`;
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
        const elapsed = Math.min(_musicPosition(), _trackDuration || 0);
        const dur = _trackDuration || 0;
        const elEl = document.getElementById('mw-elapsed');
        const totEl = document.getElementById('mw-total');
        const progressEl = document.getElementById('mw-progress');
        if (elEl) elEl.textContent = _fmtTime(elapsed);
        if (totEl) totEl.textContent = dur > 0 ? _fmtTime(dur) : '0:00';
        if (progressEl) {
            progressEl.disabled = dur <= 0;
            if (!progressEl.matches(':active')) {
                progressEl.value = dur > 0 ? Math.max(0, Math.min(100, elapsed / dur * 100)) : 0;
                progressEl.style.setProperty('--track-progress', progressEl.value + '%');
            }
        }
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
        const icon = settings.musicPaused
            ? (isPix ? _SVG_PIX_PLAY : `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><polygon points="3,2 13,8 3,14"/></svg>`)
            : (isPix ? _SVG_PIX_PAUSE : `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="3" y="2" width="3" height="12"/><rect x="10" y="2" width="3" height="12"/></svg>`);
        const pauseBtn = document.getElementById('mw-pause');
        const label = settings.musicPaused ? 'Play music' : 'Pause music';
        if (pauseBtn) { pauseBtn.innerHTML = icon; pauseBtn.setAttribute('aria-label', label); }
        const plPause = document.getElementById('pl-mw-pause');
        if (plPause) { plPause.innerHTML = miniMusicIcon(icon); plPause.setAttribute('aria-label', label); }
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
        if (_currentMode !== 'menu') return;
        settings.musicPaused = !settings.musicPaused;
        saveSettings();
        if (!settings.musicPaused && !_activeMusic) {
            if (!musicPlaying) void startMusic();
            else if (_nowPlayingName) _playMenuTrack(_nowPlayingName, _trackPauseOffset);
            else void switchMusicMode('menu');
        } else {
            _syncMusicPlayback();
            _updateMusicWidget();
        }
    };
    window.musicWidgetSeek = function(e, el) {
        if (!audioCtx || !_trackDuration || _currentMode !== 'menu') return;
        if (el.id === 'mw-progress') {
            _playMenuTrack(_nowPlayingName, el.valueAsNumber / 100 * _trackDuration);
            return;
        }
        const rect = el.getBoundingClientRect();
        if (!rect.width) return;
        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        _playMenuTrack(_nowPlayingName, frac * _trackDuration);
    };
    function skipSong() { /* song skipping disabled */ }

    function _showLevelUpRewardPopup(level, rewards, collect) {
        const { rank, name } = _rewardRankIdentity(level);
        const points = getShapePoints(150, 150, 114, rank.shape)?.map(point => point.join(',')).join(' ');
        const emblem = rank === CELESTITE_RANK
            ? '<path d="M150 30 250 75V170Q250 248 150 275Q50 248 50 170V75Z"/>'
            : points ? `<polygon points="${points}"/>` : '<circle cx="150" cy="150" r="114"/>';
        document.getElementById('level-up-popup-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.className = 'lb-reward-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'lb105-level-title');
        overlay.id = 'level-up-popup-overlay';
        overlay.style.setProperty('--lb105-rank', rank.c);
        overlay.innerHTML = `<div class="lb105-level-panel lb-block-dialog">
            <header class="lb105-level-header">
                <h2 id="lb105-level-title" class="lb-block-dialog-title">Rewards to collect</h2>
                <div class="lb105-level-emblem">
                    <svg class="lb135-halo-emblem" viewBox="0 0 300 300" aria-hidden="true">
                        <defs>
                            <g id="lb135-emblem-shape">${emblem}</g>
                            <linearGradient id="lb135-emblem-surface" x2="25%" y2="100%">
                                <stop class="lb135-surface-start"/>
                                <stop class="lb135-surface-end" offset="100%"/>
                            </linearGradient>
                        </defs>
                        <use class="lb135-emblem-face" href="#lb135-emblem-shape"/>
                        <use class="lb135-emblem-rim" href="#lb135-emblem-shape"/>
                        <use class="lb135-emblem-highlight" href="#lb135-emblem-shape"/>
                        <use class="lb135-emblem-inner" href="#lb135-emblem-shape"/>
                    </svg>
                </div>
                <span class="lb105-level-value">Level ${level}</span>
                <strong class="lb105-level-rank">${name}</strong>
            </header>
            <div class="lb105-level-rewards lb-scroll-fade" role="region" aria-label="Level rewards"></div>
            <div class="lb-block-dialog-actions"><button type="button" class="lb-block-btn lb-block-btn--primary">Collect</button></div>
        </div>`;
        const scroller = overlay.querySelector('.lb105-level-rewards');
        scroller.append(_crateRewardGrid(rewards));
        const updateTabStop = () => { scroller.tabIndex = scroller.scrollHeight > scroller.clientHeight ? 0 : -1; };
        const button = overlay.querySelector('button');
        const previousFocus = document.activeElement;
        const close = () => {
            overlay.remove();
            previousFocus?.focus({ preventScroll: true });
        };
        button.addEventListener('click', () => { collect(); close(); }, { once: true });
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape' || event.key === 'Tab') {
                event.preventDefault();
                event.stopPropagation();
                if (event.key === 'Tab') (scroller.tabIndex === 0 && document.activeElement === button ? scroller : button).focus();
            }
        });
        document.body.appendChild(overlay);
        updateTabStop();
        button.focus({ preventScroll: true });
        if ('ResizeObserver' in window) {
            const resize = new ResizeObserver(() => overlay.isConnected ? updateTabStop() : resize.disconnect());
            resize.observe(scroller);
            resize.observe(scroller.firstElementChild);
        }
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
            const artistSpan = artist ? `<span style="display:block;font-size:0.72em;color:#666;margin-top:1px;">by ${escapeHtml(artist)}</span>` : '';
            const playMark = isPlaying ? `<span style="color:var(--primary);margin-right:2px;">▶</span>` : '';
            const col = isPlaying ? 'var(--primary)' : '#ccc';
            const mOn = menuOn; const gOn = gameOn;
            return `<div style="display:flex;align-items:center;gap:6px;padding:5px 2px;">
                <span style="flex:1;font-size:0.62rem;color:${col};line-height:1.3;">${playMark}${escapeHtml(name)}${artistSpan}</span>
                <button type="button" class="lb-block-btn lb-block-tab" aria-pressed="${mOn}" onclick="window.moveTrack('menu',${escapeHtml(JSON.stringify(name))},${!mOn})">${mOn?svgCheck:''}Menu</button>
                <button type="button" class="lb-block-btn lb-block-tab" aria-pressed="${gOn}" onclick="window.moveTrack('${gameCtx}',${escapeHtml(JSON.stringify(name))},${!gOn})">${gOn?svgCheck:''}Game</button>
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
    const FALLBACK_DAILY_QUESTS = [
        // EASY (pts: 2)
        { id: 'blocks_175',     tier: 'easy',   title: 'Block Layer',       desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 175,  pts: 2 },
        { id: 'blocks_200',     tier: 'easy',   title: 'Block Flood',       desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 200,  pts: 2 },
        { id: 'lines_15',       tier: 'easy',   title: 'Line Breaker',      desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 15,   pts: 2 },
        { id: 'lines_20e',      tier: 'easy',   title: 'Line Grinder',      desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 20,   pts: 2 },
        { id: 'score_250',      tier: 'easy',   title: 'First Points',      desc: 'Score {n} points in one game',                     metric: 'score',          target: 250,  pts: 2 },
        { id: 'score_300',      tier: 'easy',   title: 'Score Rookie',      desc: 'Score {n} points in one game',                     metric: 'score',          target: 300,  pts: 2 },
        { id: 'survive_90',     tier: 'easy',   title: 'Time Keeper',       desc: 'Survive for {n} in one game',                      metric: 'gameTime',       target: 90,   pts: 2 },
        { id: 'survive_120',    tier: 'easy',   title: 'Two Minutes',       desc: 'Survive for {n} in one game',                      metric: 'gameTime',       target: 120,  pts: 2 },
        { id: 'reach_speed2',   tier: 'easy',   title: 'Pick Up the Pace',  desc: 'Reach level {n} in a run',                          metric: 'maxSpeed',       target: 2,    pts: 2 },
        { id: 'hard_drops_5',   tier: 'easy',   title: 'Drop It',           desc: 'Hard-drop {n} times in one game',                  metric: 'hardDrops',      target: 5,    pts: 2 },
        { id: 'bottom2_30',     tier: 'easy',   title: 'Floor Lover',       desc: 'Place {n} blocks in the bottom 2 rows',      metric: 'bottomTwoRows',  target: 30,   pts: 2, cumulative: true },
        { id: 'games_7',        tier: 'easy',   title: 'Show Up',           desc: 'Complete {n} games',                         metric: 'gamesPlayed',    target: 7,    pts: 2, cumulative: true },
        { id: 'rotations_300',  tier: 'easy',   title: 'Spin Cycle',        desc: 'Rotate pieces {n} times',                    metric: 'rotations',      target: 300,  pts: 2, cumulative: true },
        { id: 'doubles_3',      tier: 'easy',   title: 'Double Trouble',    desc: 'Clear {n} doubles',         metric: 'doubles',        target: 3,    pts: 2, cumulative: true },
        { id: 'triples_2',      tier: 'easy',   title: 'Triple Threat',     desc: 'Clear {n} triples',         metric: 'triples',        target: 2,    pts: 2, cumulative: true },
        { id: 'raw_xp_easy',    tier: 'easy',   title: 'XP Warm-Up',        desc: 'Earn {n} raw XP in games',                         metric: 'rawXP',          target: 150,  pts: 2, cumulative: true },
        { id: 'total_xp_easy',  tier: 'easy',   title: 'XP Kickstart',      desc: 'Earn {n} total XP in games (with multipliers)',    metric: 'totalXP',        target: 200,  pts: 2, cumulative: true },
        // NORMAL (pts: 3)
        { id: 'blocks_300',     tier: 'normal', title: 'Block Builder',     desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 300,  pts: 3 },
        { id: 'blocks_350',     tier: 'normal', title: 'Production Run',    desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 350,  pts: 3 },
        { id: 'lines_25',       tier: 'normal', title: 'Half Dozen',        desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 25,   pts: 3 },
        { id: 'lines_30',       tier: 'normal', title: 'Line Destroyer',    desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 30,   pts: 3 },
        { id: 'score_500',      tier: 'normal', title: 'Score Hunter',      desc: 'Score {n} points in one game',                     metric: 'score',          target: 500,  pts: 3 },
        { id: 'score_600',      tier: 'normal', title: 'Score Seeker',      desc: 'Score {n} points in one game',                     metric: 'score',          target: 600,  pts: 3 },
        { id: 'hard_drops_200', tier: 'normal', title: 'Free Fall',         desc: 'Hard-drop {n} times',                        metric: 'hardDrops',      target: 200,  pts: 3, cumulative: true },
        { id: 'survive_180',    tier: 'normal', title: 'Endurance',         desc: 'Survive for {n} in one game',                      metric: 'gameTime',       target: 180,  pts: 3 },
        { id: 'reach_speed3',   tier: 'normal', title: 'Ramping Up',        desc: 'Reach level {n} in a run',                          metric: 'maxSpeed',       target: 3,    pts: 3 },
        { id: 'quad_1',         tier: 'easy',   title: 'Quad Attempt',      desc: 'Clear 4 lines at once in one game',                metric: 'quads',          target: 1,    pts: 2 },
        { id: 'combo_5',        tier: 'normal', title: 'Chain Reaction',    desc: 'Get a {n}-combo in one game',                      metric: 'maxCombo',       target: 5,    pts: 3 },
        { id: 'bottom2_50',     tier: 'normal', title: 'Ground Level',      desc: 'Place {n} blocks in the bottom 2 rows',      metric: 'bottomTwoRows',  target: 50,   pts: 3, cumulative: true },
        { id: 'games_10',       tier: 'normal', title: 'Grinder',           desc: 'Complete {n} games',                         metric: 'gamesPlayed',    target: 10,   pts: 3, cumulative: true },
        { id: 'doubles_5',      tier: 'normal', title: 'Double Trouble',    desc: 'Clear {n} doubles',         metric: 'doubles',        target: 5,    pts: 3, cumulative: true },
        { id: 'triples_4',      tier: 'normal', title: 'Triple Threat',     desc: 'Clear {n} triples',         metric: 'triples',        target: 4,    pts: 3, cumulative: true },
        { id: 'rotations_450',  tier: 'normal', title: 'Spin Cycle',        desc: 'Rotate pieces {n} times',                    metric: 'rotations',      target: 450,  pts: 3, cumulative: true },
        { id: 't_spin_1',       tier: 'normal', title: 'T-Spinner',         desc: 'T-spin clears in one game: {n}',                   metric: 'tSpins',         target: 1,    pts: 3 },
        { id: 'raw_xp_normal',  tier: 'normal', title: 'XP Builder',        desc: 'Earn {n} raw XP in games',                         metric: 'rawXP',          target: 350,  pts: 3, cumulative: true },
        { id: 'total_xp_normal', tier: 'normal', title: 'XP Momentum',      desc: 'Earn {n} total XP in games (with multipliers)',    metric: 'totalXP',        target: 450,  pts: 3, cumulative: true },
        // HARD (pts: 5)
        { id: 'blocks_450',     tier: 'hard',   title: 'Stack Veteran',     desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 450,  pts: 5 },
        { id: 'blocks_500',     tier: 'hard',   title: 'Block Storm',       desc: 'Place {n} blocks in one game',                     metric: 'blocksPlaced',   target: 500,  pts: 5 },
        { id: 'lines_35',       tier: 'hard',   title: 'Marathon',          desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 35,   pts: 5 },
        { id: 'lines_40',       tier: 'hard',   title: 'Line Executioner',  desc: 'Clear {n} lines in one game',                      metric: 'linesCleared',   target: 40,   pts: 5 },
        { id: 'score_900',      tier: 'hard',   title: 'High Scorer',       desc: 'Score {n} points in one game',                     metric: 'score',          target: 900,  pts: 5 },
        { id: 'score_1000',     tier: 'hard',   title: 'Elite Score',       desc: 'Score {n} points in one game',                     metric: 'score',          target: 1000, pts: 5 },
        { id: 'hard_drops_350', tier: 'hard',   title: 'Gravity Master',    desc: 'Hard-drop {n} times',                        metric: 'hardDrops',      target: 350,  pts: 5, cumulative: true },
        { id: 'survive_300',    tier: 'hard',   title: 'Endurance Run',     desc: 'Survive for {n} in one game',                      metric: 'gameTime',       target: 300,  pts: 5 },
        { id: 'reach_speed4',   tier: 'hard',   title: 'Fourth Gear',       desc: 'Reach level {n} in a run',                          metric: 'maxSpeed',       target: 4,    pts: 5 },
        { id: 'quad_2',         tier: 'normal', title: 'Double Quad',       desc: 'Get {n} quad clears in one game', metric: 'quads',          target: 2,    pts: 3 },
        { id: 'quad_3',         tier: 'hard',   title: 'Triple Quad',       desc: 'Get {n} quad clears in one game', metric: 'quads',          target: 3,    pts: 5 },
        { id: 'combo_6',        tier: 'hard',   title: 'Combo God',         desc: 'Get a {n}-combo in one game',                      metric: 'maxCombo',       target: 6,    pts: 5 },
        { id: 'bottom2_80',     tier: 'hard',   title: 'Ground Pounder',    desc: 'Place {n} blocks in the bottom 2 rows',      metric: 'bottomTwoRows',  target: 80,   pts: 5, cumulative: true },
        { id: 'games_15',       tier: 'hard',   title: 'No Life',           desc: 'Complete {n} games',                         metric: 'gamesPlayed',    target: 15,   pts: 5, cumulative: true },
        { id: 'doubles_8',      tier: 'hard',   title: 'Double Mania',      desc: 'Clear {n} doubles',         metric: 'doubles',        target: 8,    pts: 5, cumulative: true },
        { id: 'triples_6',      tier: 'hard',   title: 'Triple Threat',     desc: 'Clear {n} triples',         metric: 'triples',        target: 6,    pts: 5, cumulative: true },
        { id: 'rotations_700',  tier: 'hard',   title: 'Spin Master',       desc: 'Rotate pieces {n} times',                    metric: 'rotations',      target: 700,  pts: 5, cumulative: true },
        { id: 't_spin_2',       tier: 'hard',   title: 'T-Spin Expert',     desc: 'T-spin clears in one game: {n}',                   metric: 'tSpins',         target: 1,    pts: 5 },
        { id: 'raw_xp_hard',    tier: 'hard',   title: 'XP Grinder',        desc: 'Earn {n} raw XP in games',                         metric: 'rawXP',          target: 600,  pts: 5, cumulative: true },
        { id: 'total_xp_hard',  tier: 'hard',   title: 'XP Surge',          desc: 'Earn {n} total XP in games (with multipliers)',    metric: 'totalXP',        target: 800,  pts: 5, cumulative: true },
        // SECRET pool (pts: 5) — title/desc hidden until completed; displayTier assigned on generation
        { id: 'hat_trick',        tier: 'secret', title: 'Hat Trick',         desc: 'Clear lines on 3 consecutive placements',                    metric: 'hatTrick',       target: 1,  pts: 5 },
        { id: 'narrow_escape',    tier: 'secret', title: 'Narrow Escape',     desc: 'Survive 20 seconds with blocks in the top 4 rows',           metric: 'narrowEscape',   target: 1,  pts: 5 },
        { id: 'i_floor',          tier: 'secret', title: 'Floor Liner',       desc: 'Land an I-piece flat on the bottom row',                     metric: 'iFloor',         target: 1,  pts: 5 },
        { id: 'bottom_builder',   tier: 'secret', title: 'Deep Diver',        desc: 'Place 15 blocks in the bottom quarter of the board',         metric: 'bottomQuarter',  target: 15, pts: 5 },
        { id: 'speed_run',        tier: 'secret', title: 'Against the Clock', desc: 'Reach level 5 in under 3 minutes',                           metric: 'speedRun',       target: 1,  pts: 5 },
        { id: 'perfect_clear',    tier: 'secret', title: 'Perfect Clear',     desc: 'Clear the entire board in one game',                         metric: 'perfectClear',   target: 1,  pts: 5 },
        { id: 'no_soft',          tier: 'secret', title: 'Hard Only',         desc: 'Finish a game without using soft-drop',                      metric: 'noSoftDrop',     target: 1,  pts: 5 },
        { id: 'comeback_kid',     tier: 'secret', title: 'Comeback Kid',      desc: 'Have blocks reach the top 2 rows, then survive 60 more seconds', metric: 'comebackKid', target: 1, pts: 5 },
        { id: 'monochrome',       tier: 'secret', title: 'Monochrome',        desc: 'Place 20 blocks of the same piece type in one game',         metric: 'monochrome',     target: 1,  pts: 5 },
        { id: 'speed_queen',      tier: 'secret', title: 'Quick Climb',       desc: 'Reach level 4 within the first 2 minutes',                   metric: 'speedQueen',     target: 1,  pts: 5 },
        { id: 'minimalist',       tier: 'secret', title: 'Minimalist',        desc: 'Clear 8 lines using only singles — no doubles or better',     metric: 'minimalist',     target: 1,  pts: 5 },
        { id: 'quad_streak',      tier: 'secret', title: 'Quad Streak',       desc: 'Get 2 quad clears in a row',               metric: 'quadStreak',     target: 1,  pts: 5 },
        { id: 'flat_earth',       tier: 'secret', title: 'Flat Earther',      desc: 'Keep your max stack height under 5 for 60 seconds',          metric: 'flatEarth',      target: 1,  pts: 5 },
        { id: 'nice_bonus',       tier: 'secret', title: 'Nice Bonus',        desc: 'Complete all other daily quests in one run',                  metric: 'niceBonus',      target: 1,  pts: 5 },
        { id: 'double_completion',tier: 'secret', title: 'Double Completion', desc: 'Complete any 2 missions (daily or weekly) in one run',        metric: 'doubleCompletion', target: 1, pts: 5 },
    ];
    // Weekly missions — 3E+2N+1H drawn per week
    const FALLBACK_WEEKLY_MISSIONS = [
        // EASY (pts: 10)
        { id: 'w_lines_100',    tier: 'easy',   title: 'Line Week',         desc: 'Clear {n} lines total',                  metric: 'linesCleared',      target: 100,  pts: 10, cumulative: true  },
        { id: 'w_blocks_800',   tier: 'easy',   title: 'Block Flood',       desc: 'Place {n} blocks total',                 metric: 'blocksPlaced',      target: 800,  pts: 10, cumulative: true  },
        { id: 'w_games_35',     tier: 'easy',   title: 'Warm-Up',           desc: 'Complete {n} games',                     metric: 'gamesPlayed',       target: 35,   pts: 10, cumulative: true  },
        { id: 'w_quads_5',      tier: 'easy',   title: 'Four-Line Habit',   desc: 'Get {n} quad clears',  metric: 'quads',             target: 5,    pts: 10, cumulative: true  },
        { id: 'w_survive_1200', tier: 'easy',   title: 'Short Session',     desc: 'Play for {n} total',                     metric: 'gameTime',          target: 1200, pts: 10, cumulative: true  },
        { id: 'w_speed2_5',     tier: 'easy',   title: 'Getting Faster',    desc: 'Reach level 2 in {n} separate games',    metric: 'gamesReachedSpeed2',target: 5,    pts: 10, cumulative: true  },
        { id: 'w_score_1500',   tier: 'easy',   title: 'Score Sprint',      desc: 'Score {n} points total',                 metric: 'score',             target: 1500, pts: 10, cumulative: true  },
        { id: 'w_raw_xp_easy',    tier: 'easy',   title: 'Weekly XP Warm-Up', desc: 'Earn {n} raw XP in games',                      metric: 'rawXP',    target: 1250, pts: 10, cumulative: true },
        { id: 'w_total_xp_easy',  tier: 'easy',   title: 'Weekly XP Kickstart', desc: 'Earn {n} total XP in games (with multipliers)', metric: 'totalXP',  target: 1750, pts: 10, cumulative: true },
        // NORMAL (pts: 15)
        { id: 'w_lines_150',    tier: 'normal', title: 'Line Machine',      desc: 'Clear {n} lines total',                  metric: 'linesCleared',      target: 150,  pts: 15, cumulative: true  },
        { id: 'w_blocks_1400',  tier: 'normal', title: 'Block Mountain',    desc: 'Place {n} blocks total',                 metric: 'blocksPlaced',      target: 1400, pts: 15, cumulative: true  },
        { id: 'w_score_3000',   tier: 'normal', title: 'Weekly Scorer',     desc: 'Score {n} points total',                 metric: 'score',             target: 3000, pts: 15, cumulative: true  },
        { id: 'w_games_50',     tier: 'normal', title: 'Grinder',           desc: 'Complete {n} games',                     metric: 'gamesPlayed',       target: 50,   pts: 15, cumulative: true  },
        { id: 'w_quads_10',     tier: 'normal', title: 'Quad Collector',    desc: 'Get {n} quad clears',  metric: 'quads',             target: 10,   pts: 15, cumulative: true  },
        { id: 'w_tspin_3',      tier: 'normal', title: 'Spin Doctor',       desc: 'Perform {n} T-spins',                    metric: 'tSpins',            target: 2,    pts: 15, cumulative: true  },
        { id: 'w_combo4_4',     tier: 'normal', title: 'Weekly Combo',      desc: 'Get a 4+ combo in {n} separate games',   metric: 'gamesWithCombo4',   target: 4,    pts: 15, cumulative: true  },
        { id: 'w_speed3_5',     tier: 'normal', title: 'Third Gear',        desc: 'Reach level 3 in {n} separate games',    metric: 'gamesReachedSpeed3',target: 5,    pts: 15, cumulative: true  },
        { id: 'w_raw_xp_normal',  tier: 'normal', title: 'Weekly XP Builder',  desc: 'Earn {n} raw XP in games',                      metric: 'rawXP',    target: 2500, pts: 15, cumulative: true },
        { id: 'w_total_xp_normal', tier: 'normal', title: 'Weekly XP Momentum', desc: 'Earn {n} total XP in games (with multipliers)', metric: 'totalXP', target: 3500, pts: 15, cumulative: true },
        // HARD (pts: 25)
        { id: 'w_lines_250',    tier: 'hard',   title: 'Line God',          desc: 'Clear {n} lines total',                  metric: 'linesCleared',      target: 250,  pts: 25, cumulative: true  },
        { id: 'w_blocks_2000',  tier: 'hard',   title: 'Unstoppable Force', desc: 'Place {n} blocks total',                 metric: 'blocksPlaced',      target: 2000, pts: 25, cumulative: true  },
        { id: 'w_score_4500',   tier: 'hard',   title: 'Score Legend',      desc: 'Score {n} points total',                 metric: 'score',             target: 4500, pts: 25, cumulative: true  },
        { id: 'w_games_75',     tier: 'hard',   title: 'No Life',           desc: 'Complete {n} games',                     metric: 'gamesPlayed',       target: 75,   pts: 25, cumulative: true  },
        { id: 'w_quads_15',     tier: 'hard',   title: 'Quad Legend',       desc: 'Get {n} quad clears',  metric: 'quads',             target: 15,   pts: 25, cumulative: true  },
        { id: 'w_tspin_5',      tier: 'hard',   title: 'T-Spin Streak',     desc: 'Perform {n} T-spins',                    metric: 'tSpins',            target: 3,    pts: 25, cumulative: true  },
        { id: 'w_survive_2400', tier: 'hard',   title: 'Weekly Warrior',    desc: 'Play for {n} total',                     metric: 'gameTime',          target: 2400, pts: 25, cumulative: true  },
        { id: 'w_speed4_5',     tier: 'hard',   title: 'Higher Gear',       desc: 'Reach level 4 in {n} separate games',    metric: 'gamesReachedSpeed4',target: 5,    pts: 25, cumulative: true  },
        { id: 'w_combo4_5',     tier: 'hard',   title: 'Weekly Combo',      desc: 'Get a 4+ combo in {n} separate games',   metric: 'gamesWithCombo4',   target: 5,    pts: 25, cumulative: true  },
        { id: 'w_raw_xp_hard',    tier: 'hard',   title: 'Weekly XP Grinder',  desc: 'Earn {n} raw XP in games',                      metric: 'rawXP',    target: 4000, pts: 25, cumulative: true },
        { id: 'w_total_xp_hard',  tier: 'hard',   title: 'Weekly XP Surge',    desc: 'Earn {n} total XP in games (with multipliers)', metric: 'totalXP',  target: 5500, pts: 25, cumulative: true },
    ];
    const DAILY_MODE_QUESTS = [
        { id: 'ghost_lines', tier: 'easy', title: 'Ghost Guide', desc: 'Clear {n} lines with Ghost Piece on in Normal', metric: 'ghostLines', target: 5, pts: 2, minLevel: 11 },
        { id: 'mirror_lines', tier: 'easy', title: 'Mirror Match', desc: 'Clear {n} lines with Mirror on in Normal', metric: 'mirrorLines', target: 5, pts: 2, minLevel: 11 },
        { id: 'fun_run', tier: 'easy', title: 'Just for Fun', desc: 'Finish a Fun run with at least 1 line cleared', metric: 'funRuns', target: 1, pts: 2, minLevel: 11 },
    ];
    let DAILY_QUEST_POOL = FALLBACK_DAILY_QUESTS;
    let WEEKLY_MISSION_POOL = FALLBACK_WEEKLY_MISSIONS;
    async function _loadMissionCatalog() {
        const controller = window.AbortController ? new AbortController() : null;
        let timeout;
        try {
            const catalog = await Promise.race([
                fetch('data/missions.json', controller ? { signal: controller.signal } : {}).then(response => response.ok ? response.json() : null),
                new Promise(resolve => { timeout = setTimeout(() => {
                    resolve(null);
                    if (controller) controller.abort();
                    console.warn('Linebreaker: mission catalog timed out; using built-in missions.');
                }, 3000); }),
            ]);
            if (!catalog) return;
            const { daily, weekly } = catalog;
            const validPool = (pool, tiers) => Array.isArray(pool) && tiers.every(tier => pool.some(def => def?.tier === tier)) &&
                new Set(pool.map(def => def?.id)).size === pool.length && pool.every(def => ['id', 'title', 'desc', 'metric'].every(key => typeof def?.[key] === 'string') &&
                    tiers.includes(def.tier) && Number.isFinite(def.target) && def.target > 0 && Number.isFinite(def.pts));
            if (!validPool(daily, ['easy', 'normal', 'hard', 'secret']) || !validPool(weekly, ['easy', 'normal', 'hard'])) return;
            DAILY_QUEST_POOL = daily;
            WEEKLY_MISSION_POOL = weekly;
        } catch {} finally { clearTimeout(timeout); }
    }
    function _restoreMissionDefinitions(missions) {
        const restore = (state, def, weekly = false) => {
            if (!state || !def) return null;
            const promoted = weekly && ((def.tier === 'easy' && state.tier === 'normal') || (def.tier === 'normal' && state.tier === 'hard'));
            const target = state.target || def.target;
            return {
                ...def, ...state, title: def.title, target, tier: promoted ? state.tier : def.tier,
                pts: promoted ? (state.tier === 'normal' ? 15 : 25) : def.pts,
                desc: def.tier === 'secret' ? def.desc : _makeMissionDesc(def.metric, def.desc, target),
            };
        };
        const daily = new Map([...DAILY_QUEST_POOL, ...DAILY_MODE_QUESTS].map(def => [def.id, def]));
        const weekly = new Map(WEEKLY_MISSION_POOL.map(def => [def.id, def]));
        missions.daily.quests = missions.daily.quests.map(state => {
            const def = daily.get(state.id);
            return def?.tier === 'secret' ? null : restore(state, def);
        }).filter(Boolean);
        const secret = daily.get(missions.daily.secret?.id);
        missions.daily.secret = secret?.tier === 'secret' ? restore(missions.daily.secret, secret) : null;
        missions.weekly.missions = missions.weekly.missions.map(state => restore(state, weekly.get(state.id), true)).filter(Boolean);
    }
    const MQ_DAILY_MILESTONES = [
        { pts: 6,  reward: { type: 'parts', amount: 1 }, label: '+1 Part'  },
        { pts: 9,  reward: { type: 'parts', amount: 2 }, label: '+2 Parts' },
        { pts: 12, reward: { type: 'parts', amount: 3 }, label: '+3 Parts' },
    ];
    const MQ_WEEKLY_MILESTONES = [
        { pts: 60,  reward: { type: 'parts', amount: 2  }, label: '+2 Parts'  },
        { pts: 90,  reward: { type: 'parts', amount: 4  }, label: '+4 Parts'  },
        { pts: 120, reward: { type: 'parts', amount: 7  }, label: '+7 Parts'  },
    ];
    const MQ_WEEKLY_GOLDEN_THRESHOLD = 180; // pts above this earn 1 universal part each

    const MQ_SPECIAL_BOX_CAP = 30;
    const MQ_SPECIAL_BOX_PARTS = 5;
    function _defaultMissions() {
        return {
            daily:   { quests: [], secret: null, lastRefreshDate: '', swapDate: '', pointsToday: 0, claimedMilestones: [], completedToday: false, newVisit: false },
            weekly:  { missions: [], weekKey: '', swapDate: '', points: 0, claimedMilestones: [], dailyPtsLog: {}, newVisit: false, pendingUniversalParts: 0, universalPtsTracked: 0 },
            streaks: { daily: 0 },
            stats:   { totalCompleted: 0, byTier: { easy: 0, normal: 0, hard: 0, secret: 0 }, weeklyCompleted: 0, totalPts: 0, completionHistory: {} },
            specialBox: { pts: 0 },
        };
    }
    function _missionDateKey() { return LBSave.localDate(new Date()); }
    function _legacyMissionWeekKey() {
        const d = new Date(); const jan1 = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
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
    function _missionTarget(q, mult) {
        const rankMult = ['maxSpeed', 'maxCombo', 'funRuns'].includes(q.metric) ? 1 : mult;
        return _applyVariation(q.target * rankMult);
    }
    function _missionMetricKey({ metric }) {
        if (['speedRun', 'speedQueen', 'gamesReachedSpeed2', 'gamesReachedSpeed3', 'gamesReachedSpeed4'].includes(metric)) return 'maxSpeed';
        return metric;
    }
    function _missionSwapPool(pool, missions, index, secret = null) {
        const current = missions[index];
        const usedMetrics = new Set(missions.filter((_, slot) => slot !== index).map(_missionMetricKey));
        if (secret) usedMetrics.add(_missionMetricKey(secret));
        return pool.filter(m => m.tier === current.tier && m.id !== current.id && !usedMetrics.has(_missionMetricKey(m)));
    }

    function _availableDailyModes() {
        const level = getLevelInfo(saveData.totalXP).level;
        return DAILY_MODE_QUESTS.filter(quest => quest.minLevel <= level);
    }

    function _extraDailyQuest(quests) {
        const used = new Set(quests.map(_missionMetricKey));
        const modes = _availableDailyModes().filter(quest => !used.has(_missionMetricKey(quest)));
        const pool = modes.length ? modes : DAILY_QUEST_POOL.filter(quest => quest.tier === 'easy' && !used.has(_missionMetricKey(quest)));
        const quest = _shuffleArr(pool)[0];
        if (!quest) return null;
        const target = _missionTarget(quest, _missionRankMult());
        return { ...quest, target, progress: 0, completed: false, ptsClaimed: false, desc: _makeMissionDesc(quest.metric, quest.desc, target) };
    }

    function _generateDailyQuests() {
        const mult = _missionRankMult();
        const byTier = t => DAILY_QUEST_POOL.filter(q => q.tier === t);
        // Start: 2 easy, 2 normal, 1 hard; each easy has 20% to evolve to normal, each normal has 20% to evolve to hard
        let tiers = ['easy','easy','normal','normal','hard'];
        tiers = tiers.map(t => { const r = Math.random(); if (t==='easy' && r<0.2) return 'normal'; if (t==='normal' && r<0.2) return 'hard'; return t; });
        const pools = { easy: _shuffleArr(byTier('easy')), normal: _shuffleArr(byTier('normal')), hard: _shuffleArr(byTier('hard')) };
        const idx = { easy:0, normal:0, hard:0 };
        const usedMetrics = new Set();
        const quests = [];
        for (const tier of tiers) {
            while (idx[tier] < pools[tier].length && usedMetrics.has(_missionMetricKey(pools[tier][idx[tier]]))) idx[tier]++;
            if (idx[tier] < pools[tier].length) {
                const q = pools[tier][idx[tier]++];
                usedMetrics.add(_missionMetricKey(q));
                const scaled = _missionTarget(q, mult);
                quests.push({ ...q, target: scaled, progress: 0, completed: false, ptsClaimed: false, desc: _makeMissionDesc(q.metric, q.desc, scaled) });
            }
        }
        const extra = _extraDailyQuest(quests);
        if (extra) {
            quests.push(extra);
            usedMetrics.add(_missionMetricKey(extra));
        }
        // Secret quest: 30% chance; assign a display tier (normal or hard) — title/desc hidden
        let secret = null;
        if (Math.random() < 0.3) {
            const sq = _shuffleArr(byTier('secret').filter(q => !usedMetrics.has(_missionMetricKey(q))))[0];
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
        const usedMetrics = new Set();
        const missions = [];
        for (const tier of baseTiers) {
            while (idx[tier] < pools[tier].length && usedMetrics.has(_missionMetricKey(pools[tier][idx[tier]]))) idx[tier]++;
            if (idx[tier] < pools[tier].length) {
                const m = pools[tier][idx[tier]++];
                usedMetrics.add(_missionMetricKey(m));
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
        if (m.daily.newVisit === undefined) m.daily.newVisit = false;
        if (m.weekly.newVisit === undefined) m.weekly.newVisit = false;
        if (!m.weekly.dailyPtsLog) m.weekly.dailyPtsLog = {};
        if (!m.specialBox) m.specialBox = { pts: 0 };
        if (m.stats.totalPts === undefined) m.stats.totalPts = 0;
        if (!m.stats.completionHistory) m.stats.completionHistory = {};
        // Migration: add golden zone tracking fields
        if (m.weekly.pendingUniversalParts === undefined) m.weekly.pendingUniversalParts = 0;
        if (m.weekly.universalPtsTracked === undefined) m.weekly.universalPtsTracked = 0;
        const today = _missionDateKey();
        const thisWeek = _missionWeekKey();
        let changed = false;
        let recovered = false;
        if (!m.weekly.isoWeekKey && m.weekly.weekKey === _legacyMissionWeekKey()) {
            m.weekly.weekKey = thisWeek;
            m.weekly.isoWeekKey = true;
            changed = true;
        }
        const previousDay = LBSave.date(m.daily.lastRefreshDate);
        if (previousDay !== today) {
            recovered = _autoClaimMissions(false) || recovered;
            // Check "Lazy or Lucky?" badge before daily reset
            { const _tryU = id => { if (!saveData.achievements?.[id]?.unlocked) unlockAchievement(id); };
              const _regDone = m.daily.quests?.filter(q => q.completed).length || 0;
              if ((m.daily.secret?.completed) && _regDone === 0) _tryU('mq_lazy_lucky'); }
            const { quests, secret } = _generateDailyQuests();
            m.daily = { quests, secret, lastRefreshDate: today, swapDate: '', pointsToday: 0, claimedMilestones: [], completedToday: false, newVisit: true };
            if (m.specialBox) m.specialBox.excessTracked = 0;
            changed = true;
        }
        if (m.daily.quests.length === 5 && !m.daily.quests.some(quest => DAILY_MODE_QUESTS.some(mode => mode.id === quest.id))) {
            const extra = _extraDailyQuest(m.daily.secret ? [...m.daily.quests, m.daily.secret] : m.daily.quests);
            if (extra) {
                m.daily.quests.push(extra);
                changed = true;
            }
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
            }
            const missions = _generateWeeklyMissions();
            m.weekly = { missions, weekKey: thisWeek, isoWeekKey: true, swapDate: '', points: 0, claimedMilestones: [], dailyPtsLog: {}, newVisit: true, pendingUniversalParts: 0, universalPtsTracked: 0 };
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

    function _updateGameMissionProgress(totalXP) {
        _updateMissionProgress(_runMissionMetrics(totalXP));
    }

    function _gamePersonalBestBonusPercent(previousBest = _bestScore()) {
        return Math.max(0, Math.floor((Math.round(score) - previousBest) / 100)) * 10;
    }

    function _runMissionMetrics(totalXP) {
        if (totalXP === undefined) {
            const pbBonus = Math.round(score * _gamePersonalBestBonusPercent() / 100);
            totalXP = Math.round(score + pbBonus);
        }
        return {
            rawXP: rawGameplayXPThisGame, totalXP,
            ghostLines: settings.optGhost ? linesClearedThisGame : 0,
            mirrorLines: settings.optMirror ? linesClearedThisGame : 0,
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
    }

    function _missionRunProgress(quest, value, cumulative = quest.cumulative) {
        const previous = quest.progress || 0;
        return Math.min(quest.target, cumulative ? previous + value : Math.max(previous, value));
    }

    function _secretMissionValue(quest, metrics, allDailyDone, completions) {
        if (quest.metric === 'niceBonus') return Number(allDailyDone);
        if (quest.metric === 'doubleCompletion') return Number(completions >= 2);
        return metrics[quest.metric] ?? 0;
    }

    function _previewRunMissions(missions, metrics) {
        const daily = missions.daily;
        const project = quest => quest.completed ? quest.target : _missionRunProgress(quest, metrics?.[quest.metric] ?? 0);
        const progress = daily.quests.map(project);
        const rows = daily.quests.map((quest, index) => ({ title: quest.title, value: progress[index], target: quest.target, metric: quest.metric }));
        if (daily.secret) {
            const secret = daily.secret;
            const allDailyDone = rows.length > 0 && rows.every(row => row.value >= row.target);
            const completions = metrics && secret.metric === 'doubleCompletion'
                ? daily.quests.filter((quest, index) => !quest.completed && progress[index] >= quest.target).length
                    + missions.weekly.missions.filter(quest => !quest.completed && project(quest) >= quest.target).length
                : 0;
            const value = metrics ? _secretMissionValue(secret, metrics, allDailyDone, completions) : 0;
            rows.push({ title: secret.completed ? secret.title : 'Secret mission', value: secret.completed ? secret.target : _missionRunProgress(secret, value, false), target: secret.target });
        }
        return rows;
    }

    const _runMissionsPanel = document.getElementById('run-missions');
    const _runMissionsToggle = document.getElementById('run-missions-toggle');
    const _runMissionsBody = document.getElementById('run-missions-body');
    const _runMissionsNote = document.getElementById('run-missions-note');
    const _runMissionsList = document.getElementById('run-missions-list');
    const _runMissionsApp = document.getElementById('app');
    const _runMissionsHud = _runMissionsApp.querySelector('.portrait-right');
    let _runMissionsSnapshot = '';
    let _runMissionsNextUpdate = 0;

    function _setRunMissionsOpen(open) {
        _runMissionsBody.hidden = !open;
        _runMissionsToggle.setAttribute('aria-expanded', String(open));
        if (open) _renderRunMissions();
    }

    function _syncRunMissions(reset = false) {
        _runMissionsPanel.hidden = settings.showRunMissions !== true || currentGameMode === 'fun' || isGameOver || !_runMissionsApp.classList.contains('active-game');
        if (_runMissionsPanel.hidden) return;
        const beside = window.innerWidth > window.innerHeight && window.innerWidth - _runMissionsHud.getBoundingClientRect().right >= 230;
        const changed = _runMissionsPanel.classList.contains('is-beside') !== beside;
        _runMissionsPanel.classList.toggle('is-beside', beside);
        if (reset || changed) _setRunMissionsOpen(beside);
    }

    function _renderRunMissions() {
        if (_runMissionsPanel.hidden || _runMissionsBody.hidden || isGameOver) return;
        const eligible = linesClearedThisGame > 0;
        const missions = saveData.missions;
        const rows = missions ? _previewRunMissions(missions, eligible ? _runMissionMetrics() : null) : [];
        const note = !rows.length ? 'No daily missions available.' : eligible ? 'Progress saves at game over.' : 'Clear a line for this run to count.';
        const snapshot = JSON.stringify([note, rows]);
        if (snapshot === _runMissionsSnapshot) return;
        _runMissionsSnapshot = snapshot;
        _runMissionsNote.textContent = note;
        _runMissionsList.replaceChildren(...rows.map(({ title, value, target, metric }) => {
            const row = document.createElement('li');
            const name = document.createElement('span');
            const progress = document.createElement('span');
            name.textContent = title;
            progress.textContent = metric === 'gameTime' ? `${_fmtMissionTime(value)} / ${_fmtMissionTime(target)}` : `${value} / ${target}`;
            row.append(name, progress);
            return row;
        }));
    }

    _runMissionsToggle.addEventListener('click', () => _setRunMissionsOpen(_runMissionsBody.hidden));
    _runMissionsToggle.addEventListener('keydown', event => {
        if (event.code === 'Space' || event.code === 'Enter') event.stopPropagation();
    });
    window.addEventListener('resize', () => _syncRunMissions());

    function _updateMissionProgress(metrics) {
        if (!saveData.missions || linesClearedThisGame === 0) return;
        _checkMissionsRefresh();
        const m = saveData.missions;
        let _completedThisCall = 0;
        // Daily quests — best single-game OR cumulative across games today
        m.daily.quests.forEach(q => {
            const val = metrics[q.metric];
            if (q.completed || val === undefined) return;
            q.progress = _missionRunProgress(q, val);
            if (q.progress >= q.target) {
                q.completed = true;
                m.daily.completedToday = true;
                m.stats.totalCompleted++;
                m.stats.byTier[q.tier] = (m.stats.byTier[q.tier] || 0) + 1;
                _completedThisCall++;
            }
        });
        // Weekly missions (run before secret so doubleCompletion can count them)
        const today = _missionDateKey();
        if (!m.weekly.dailyPtsLog) m.weekly.dailyPtsLog = {};
        m.weekly.missions.forEach(wm => {
            const val = metrics[wm.metric];
            if (wm.completed || val === undefined) return;
            wm.progress = _missionRunProgress(wm, val);
            if (wm.progress >= wm.target) {
                wm.completed = true;
                m.stats.totalCompleted++;
                m.stats.byTier[wm.tier] = (m.stats.byTier[wm.tier] || 0) + 1;
                _completedThisCall++;
            }
        });
        // Secret quest — compute special metrics now
        if (m.daily.secret && !m.daily.secret.completed) {
            const sq = m.daily.secret;
            const val = _secretMissionValue(sq, metrics, m.daily.quests.length > 0 && m.daily.quests.every(q => q.completed), _completedThisCall);
            sq.progress = _missionRunProgress(sq, val, false);
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
                  saveData.universalParts = (saveData.universalParts || 0) + MQ_SPECIAL_BOX_PARTS;
                  _showMissionReward(`+${MQ_SPECIAL_BOX_PARTS} Universal Parts — Bonus Box!`);
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
    const missionMetricIcons = {
        blocksPlaced: 'lb-metric-blocks', bottomTwoRows: 'lb-metric-blocks', bottomQuarter: 'lb-metric-blocks',
        linesCleared: 'lb-run-icon-lines', doubles: 'lb-run-icon-lines', triples: 'lb-run-icon-lines',
        quads: 'lb-run-icon-lines', quadStreak: 'lb-run-icon-lines', perfectClear: 'lb-run-icon-lines',
        ghostLines: 'lb-run-icon-lines', mirrorLines: 'lb-run-icon-lines',
        score: 'lb-metric-trophy', gameTime: 'lb-metric-clock', gamesPlayed: 'lb-metric-gamepad', funRuns: 'lb-metric-gamepad',
        maxSpeed: 'lb-run-icon-speed', gamesReachedSpeed2: 'lb-run-icon-speed',
        gamesReachedSpeed3: 'lb-run-icon-speed', gamesReachedSpeed4: 'lb-run-icon-speed',
        maxCombo: 'lb-metric-combo', gamesWithCombo4: 'lb-metric-combo', rawXP: 'lb-metric-total-xp', totalXP: 'lb-metric-total-xp',
    };

    function _missionQuestCard(q, index, isWeekly) {
        const isSecret = q.tier === 'secret';
        const displayTier = isSecret ? (q.displayTier || 'normal') : (q.tier || 'normal');
        const tier = isSecret ? 'secret' : displayTier;
        const claimed = q.completed && q.ptsClaimed;
        const ready = q.completed && !claimed;
        const swapping = !!window._mqChangeMode;
        const canSwap = swapping && !isSecret && !q.completed && _swapCandidates(index, isWeekly).length > 0;
        const missionTitle = escapeHtml(isSecret && !q.completed ? '???' : q.title);
        const desc = isSecret && !q.completed ? 'Complete to reveal…' : escapeHtml(q.desc);
        const icon = isSecret && !q.completed ? 'lb-metric-best-xp' : (missionMetricIcons[q.metric] || 'lb-metric-blocks');
        const target = Math.max(1, q.target || 0);
        const progress = q.completed ? target : Math.min(target, Math.max(0, q.progress || 0));
        const format = q.metric === 'gameTime' ? _fmtMissionTime : String;
        const pointLabel = `+${escapeHtml(q.pts)} SP`;
        const reward = claimed ? '<span class="mq-claimed">✓ Claimed</span>' : ready && !swapping
            ? `<button type="button" class="mq-pts-claim-btn lb-block-btn lb-block-btn--primary lb-ledger-claim" aria-label="Claim ${pointLabel}" onclick="window._claimQuestPts(${escapeHtml(JSON.stringify(String(q.id)))},${!!isWeekly},null,this)">Claim</button>` : '';
        const swap = canSwap ? `<button type="button" class="mq-change-overlay lb-block-btn" aria-label="Swap ${escapeHtml(q.desc)}" onclick="window._changeMission(${index},${!!isWeekly})">Swap</button>` : '';
        const meter = isSecret ? '' : `<div class="mq-card-progress">
            <progress class="lb-block-progress" aria-label="${missionTitle} progress" max="${target}" value="${progress}"></progress>
            <span class="mq-card-progress-value">${format(progress)} / ${format(target)}</span>
        </div>`;
        return `<div class="mq-card-wrap"${index == null ? '' : ` data-mission-slot="${index}"`}>
            <article class="mq-card lb-block-card" data-tier="${escapeHtml(tier)}"${ready && !swapping ? ' data-ready' : ''}>
                <span class="lb-ledger-icon-frame lb-ledger-key" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#${icon}"/></svg></span>
                <div class="mq-card-text"><h3 class="mq-card-title">${missionTitle}</h3><p class="mq-card-desc">${desc}</p></div>
                <div class="mq-card-value"><span class="mq-pts lb-ledger-tag">${pointLabel}</span><span class="mq-tier-badge">${escapeHtml(tier)}</span></div>
                ${meter}${reward || swap ? `<div class="mq-card-action${ready && !swapping ? ' mq-card-action--claim' : ''}">${reward}${swap}</div>` : ''}
            </article>
        </div>`;
    }

    function _missionCrateMarker(rarity, locked = false) {
        return `<img class="mq-ms-crate${locked ? ' mq-ms-crate--locked' : ''}" src="assets/ui/crates/${rarity}.png" alt="" draggable="false">`;
    }

    function _missionProgressBar(points, milestones, claimed, isWeekly) {
        const lastThreshold = milestones[milestones.length - 1].pts;
        const goal = isWeekly ? MQ_WEEKLY_GOLDEN_THRESHOLD : lastThreshold;
        const markers = milestones.map(({ pts }) => {
            const isClaimed = (claimed || []).includes(pts);
            const reached = points >= pts || isClaimed;
            const rarity = reached || (!isWeekly && pts === lastThreshold) ? LBCrates.missionRarity(pts, isWeekly) : 'common';
            const crate = _missionCrateMarker(rarity, !reached);
            const label = `${pts} points: ${reached ? `${rarity} crate` : 'locked crate'}`;
            const content = `${crate}<span aria-hidden="true">${pts}</span>`;
            if (reached && !isClaimed) {
                return `<button type="button" class="lb-block-btn lb-block-btn--ghost mq-ms-claim-btn" onclick="window._claimMissionMilestone(${pts},${!!isWeekly},false,this)" aria-label="Claim ${label}" data-control-tip="Claim ${label}">${content}</button>`;
            }
            return `<span class="mq-ms-marker" role="img" aria-label="${label}${isClaimed ? ', claimed' : ''}" title="${label}${isClaimed ? ' (claimed)' : ''}">${content}${isClaimed ? '<span class="mq-ms-claimed" aria-hidden="true">✓</span>' : ''}</span>`;
        });
        if (isWeekly) {
            const pending = saveData.missions?.weekly?.pendingUniversalParts || 0;
            const content = `<img class="mq-ms-crate${points <= goal && !pending ? ' mq-ms-crate--locked' : ''}" src="${LBArtPack.universalPart}" alt=""><span aria-hidden="true">${goal}+</span>`;
            const label = `${goal}+ points: earn +1 Universal Part per extra point`;
            markers.push(pending > 0
                ? `<button type="button" class="lb-block-btn lb-block-btn--ghost mq-ms-claim-btn" onclick="window._claimWeeklyUniversalParts(false,this)" aria-label="Collect +${escapeHtml(pending)} Universal Part${pending !== 1 ? 's' : ''}">${content}<span class="mq-ms-claimed" aria-hidden="true">+${escapeHtml(pending)}</span></button>`
                : `<span class="mq-ms-marker" role="img" aria-label="${label}" data-mqctip="${label}">${content}</span>`);
        }
        return `<div class="mq-milestone-meter">
            <span class="mq-pb-points">${escapeHtml(points)} pts</span>
            <progress class="lb-block-progress" aria-label="Crate milestone progress" max="${goal}" value="${Math.min(points, goal)}"></progress>
        </div><div class="mq-pb-icons">${markers.join('')}</div>`;
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

    function missionCardPositions(body) {
        const cards = body.querySelectorAll('[data-mission-slot], #mq-bonus-box');
        return new Map([...cards].map(card => [card.dataset.missionSlot ?? 'bonus', { card, rect: card.getBoundingClientRect() }]));
    }

    function animateMissionClaims(body, previousCards) {
        const currentCards = missionCardPositions(body);
        const removed = [...previousCards].filter(([slot, { rect }]) =>
            slot !== 'bonus' && rect.height && !currentCards.has(slot));
        if (!removed.length) return;

        for (const [, { card, rect }] of removed) {
            card.classList.add('lb138-mission-exit');
            card.inert = true;
            Object.assign(card.style, { top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px` });
            body.closest('#missions-overlay').append(card);
            const exit = card.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-10px) scale(.9)' }],
                { duration: 220, easing: 'ease-in', fill: 'forwards' });
            exit.finished.then(() => card.remove(), () => card.remove());
        }

        for (const [slot, { card, rect }] of currentCards) {
            const prior = previousCards.get(slot)?.rect;
            if (!prior || !rect.height) continue;
            const dx = prior.left - rect.left;
            const dy = prior.top - rect.top;
            if (dx || dy) card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
                { duration: 260, easing: 'ease-out' });
        }
    }

    function renderMissionsOverlay(tab, opening = false) {
        if (tab === 'season') return window.openSeasonPass(document.querySelector('#missions-overlay [data-tab="season"]'));
        closeInfo();
        if (!saveData.missions) saveData.missions = _defaultMissions();
        _checkMissionsRefresh();
        const m = saveData.missions;
        const el = document.getElementById('missions-overlay');
        if (!el) return;
        const previousTab = el._mTab;
        tab = tab || previousTab || 'daily';
        if (window._mqChangeMode && tab !== previousTab) return;
        el._mTab = tab;
        const weekly = tab === 'weekly';
        const swapping = !!window._mqChangeMode;
        const view = el.querySelector('#mq-mission-view');
        _seasonScreen.updatePreview();
        el.querySelector('#mq-menu').disabled = swapping;
        view.querySelector('.lb-info-btn').disabled = swapping;
        el.querySelectorAll('[data-tab]').forEach(button => {
            if (button.dataset.tab !== 'season') button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
            button.disabled = swapping;
        });
        if (opening || previousTab !== tab) view.scrollTop = 0;

        const period = weekly ? m.weekly : m.daily;
        const points = (weekly ? period.points : period.pointsToday) || 0;
        const quests = (weekly ? period.missions : period.quests) || [];
        const entries = !weekly && period.secret ? [...quests, period.secret] : quests;
        const milestones = el.querySelector('#mq-milestones');
        milestones.innerHTML = _missionProgressBar(points, weekly ? MQ_WEEKLY_MILESTONES : MQ_DAILY_MILESTONES, period.claimedMilestones, weekly);
        el.querySelector('#mq-board-period').textContent = weekly ? 'Weekly objectives' : 'Daily objectives';
        el.querySelector('#mq-list-meta').textContent = `${entries.filter(quest => quest.completed).length} / ${entries.length} complete`;
        const swap = el.querySelector('#mq-change-toggle');
        const swapUsed = _missionSwapUsed(period);
        swap.setAttribute('aria-pressed', String(swapping));
        swap.disabled = swapUsed && !swapping;
        swap.textContent = swapping ? 'Cancel swap' : 'Swap';
        el.querySelector('#mq-swaps-left').textContent = swapUsed ? '0 swaps left today' : '1 swap left today';

        const active = _sortQuests(entries.filter(quest => !quest.ptsClaimed));
        const completed = _sortQuests(entries.filter(quest => quest.ptsClaimed));
        const bonus = m.specialBox?.pts || 0;
        const bonusBox = view.querySelector('#mq-bonus-box');
        const bonusProgress = bonusBox.querySelector('progress');
        bonusBox.querySelector('.mq-list-head span').textContent = `${bonus} / ${MQ_SPECIAL_BOX_CAP}`;
        bonusProgress.max = MQ_SPECIAL_BOX_CAP;
        bonusProgress.value = Math.min(bonus, MQ_SPECIAL_BOX_CAP);
        const body = el.querySelector('#missions-body');
        const beforeClaim = !opening && previousTab === tab && !el.classList.contains('hidden')
            && typeof body.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? missionCardPositions(body) : null;
        body.innerHTML = `<div class="mq-cards">${active.map(quest => _missionQuestCard(quest, quest === period.secret ? 'secret' : quests.indexOf(quest), weekly)).join('')}</div>
            ${completed.length ? `<h3 class="lb-block-section-title mq-completed">Completed</h3>
                <div class="mq-cards">${completed.map(quest => _missionQuestCard(quest, null, weekly)).join('')}</div>` : ''}`;
        if (beforeClaim) animateMissionClaims(body, beforeClaim);
        for (const star of milestones.querySelectorAll('[data-mqctip]')) {
            bindInfoPreview(star, () => {
                const panel = infoPanel('mq-body-tip');
                panel.textContent = star.dataset.mqctip;
                showInfo(panel, star);
            }, { tap: true });
        }
        if (tab === 'daily' && m.daily.newVisit) { m.daily.newVisit = false; saveDataToFile(); }
        if (tab === 'weekly' && m.weekly.newVisit) { m.weekly.newVisit = false; saveDataToFile(); }
        _updateMissionCountdown();
        _checkGlowNotifications();
    }

    let _missionCountdownInterval = null;
    function _updateMissionCountdown() {
        const el = document.getElementById('mq-countdown');
        if (!el) return;
        const tab = document.getElementById('missions-overlay')?._mTab || 'daily';
        const now = new Date();
        const missions = saveData.missions;
        if (missions && (missions.daily.lastRefreshDate !== LBSave.localDate(now) || missions.weekly.weekKey !== _missionWeekKey())) {
            window._exitChangeMode();
            renderMissionsOverlay(tab);
            return;
        }
        const ms = window.LBNotifications.nextReset(now, tab !== 'daily') - now;
        const totalSec = Math.floor(ms / 1000);
        const d = Math.floor(totalSec / 86400);
        const h = Math.floor((totalSec % 86400) / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const timeStr = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
        el.dataset.urgency = ms <= 600000 ? 'urgent' : ms <= 3600000 ? 'soon' : 'normal';
        const timer = el.querySelector('time');
        timer.dateTime = `P${d}DT${h}H${m}M${s}S`;
        timer.textContent = timeStr;
    }

    window._mqChangeMode = false;

    window._toggleChangeMode = function() {
        const weekly = document.getElementById('missions-overlay')._mTab === 'weekly';
        if (!window._mqChangeMode && _missionSwapUsed(saveData.missions?.[weekly ? 'weekly' : 'daily'])) return;
        window._mqChangeMode = !window._mqChangeMode;
        renderMissionsOverlay();
        if (window._mqChangeMode) document.querySelector('#missions-body .mq-change-overlay')?.focus();
    };

    window._exitChangeMode = function() {
        window._mqChangeMode = false;
    };

    window._mqOverlayClick = function(e) {
        if (!window._mqChangeMode) return;
        if (e.target.closest('.mq-card-wrap, .mq-swap-control')) return;
        window._toggleChangeMode();
    };

    window.openMissions = function(tab = 'daily') {
        if (tab === 'season') return window.openSeasonPass();
        window._mqChangeMode = false;
        const overlay = document.getElementById('missions-overlay');
        overlay.classList.remove('hidden');
        if (_missionCountdownInterval) clearInterval(_missionCountdownInterval);
        _missionCountdownInterval = setInterval(_updateMissionCountdown, 1000);
        return fillScreenAfterPaint(overlay, () => renderMissionsOverlay(tab, true));
    };
    window.closeMissions = function() {
        if (_seasonScreen.isOpen()) return _seasonScreen.close();
        if (window._mqChangeMode) return;
        hideMenuScreen(document.getElementById('missions-overlay'));
        clearInterval(_missionCountdownInterval);
        _missionCountdownInterval = null;
    };
    window.renderMissionsOverlay = renderMissionsOverlay;
    document.querySelectorAll('#missions-overlay [data-tab]').forEach(button => {
        if (button.dataset.tab === 'season') button.removeAttribute('aria-pressed');
        button.addEventListener('click', () => renderMissionsOverlay(button.dataset.tab));
    });

    const _seasonScreen = window.LBSeasonUI.mount({
        getSave: () => saveData,
        save: saveDataToFile,
        claimAfterPaint: _claimAfterPaint,
        onNavigate: closeInfo,
        partName: _partItemName,
        boosterName: key => BOOSTER_INFO[key]?.label || key,
        grantSkin: key => giveItemDirectly('skin', key),
        grantCrate(tier) {
            LBCrates.grantCrate(saveData, tier);
            return { type: 'crate', tier };
        },
    });
    window.openSeasonPass = function(opener) {
        const source = opener?.closest('.overlay, [id$="-overlay"]') || LBGamepad.topOverlay()
            || document.getElementById('menu-overlay');
        const trigger = opener || (source.id === 'menu-overlay' ? document.getElementById('btn-season-pass')
            : source.contains(document.activeElement) ? document.activeElement : source.querySelector('.lb-block-back'));
        return _seasonScreen.open(trigger, source);
    };

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
            if (ov.classList.contains('hidden')) return;
            ov.classList.add('hidden');
            inner.classList.remove('anim-in-down');
            cb?.();
        };
        ok.onclick = () => close(onOk);
        cancel.onclick = () => close();
    }

    const _missionSwapUsed = period => !!period?.swapDate && period.swapDate >= _missionDateKey();

    function _swapCandidates(index, isWeekly) {
        const period = saveData.missions?.[isWeekly ? 'weekly' : 'daily'];
        const list = isWeekly ? period?.missions : period?.quests;
        if (_missionSwapUsed(period) || !list?.[index] || list[index].completed || list[index].tier === 'secret') return [];
        const pool = isWeekly ? WEEKLY_MISSION_POOL : [...DAILY_QUEST_POOL, ..._availableDailyModes()];
        return _missionSwapPool(pool, list, index, isWeekly ? null : period.secret);
    }

    window._changeMission = function(index, isWeekly) {
        if (!_swapCandidates(index, isWeekly).length) return;
        const missionPeriod = saveData.missions[isWeekly ? 'weekly' : 'daily'];
        const list = isWeekly ? missionPeriod.missions : missionPeriod.quests;
        const original = list[index];
        _mqConfirm(
            'CHANGE MISSION?',
            'This will replace the selected mission with a new one of the same tier.',
            'You can swap one daily mission and one weekly mission each day.',
            () => {
                _checkMissionsRefresh();
                if (saveData.missions[isWeekly ? 'weekly' : 'daily'] !== missionPeriod || list[index] !== original) return;
                const [replacement] = _shuffleArr(_swapCandidates(index, isWeekly));
                if (!replacement) return;
                const mult = ['maxSpeed', 'maxCombo', 'funRuns'].includes(replacement.metric) ? 1 : _missionRankMult();
                const target = _niceRound(replacement.target * mult);
                list[index] = { ...replacement, target, progress: 0, completed: false, ptsClaimed: false, desc: _makeMissionDesc(replacement.metric, replacement.desc, target) };
                missionPeriod.swapDate = _missionDateKey();
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

    window._claimMissionMilestone = function(pts, isWeekly, silent = false, button) {
        if (button) return _claimAfterPaint(button, () => window._claimMissionMilestone(pts, isWeekly, silent));
        if (!saveData.missions) return;
        if (!silent && document.querySelector('.lb-reward-overlay')) return;
        const m = saveData.missions;
        const milestones = isWeekly ? MQ_WEEKLY_MILESTONES : MQ_DAILY_MILESTONES;
        const ms = milestones.find(x => x.pts === pts);
        if (!ms) return;
        const claimed = isWeekly ? m.weekly.claimedMilestones : m.daily.claimedMilestones;
        if (claimed.includes(pts)) return;
        const currentPts = isWeekly ? (m.weekly.points || 0) : (m.daily.pointsToday || 0);
        if (currentPts < pts) return;
        claimed.push(pts);
        _openMissionCrate(ms, isWeekly, silent);
    };

    function _openMissionCrate(ms, isWeekly, silent = false) {
        const cards = _grantMissionCrateParts(ms.reward.amount);
        saveDataToFile();
        if (silent) return;
        const overlay = document.getElementById('missions-overlay');
        const opener = document.activeElement;
        if (!overlay.classList.contains('hidden')) {
            renderMissionsOverlay(isWeekly ? 'weekly' : 'daily');
        }
        _checkGlowNotifications();
        playSFX('gift');
        LBCrates.showCrateReveal(LBCrates.missionRarity(ms.pts, isWeekly), 1, _crateRewardGrid(cards), () => {
            (opener?.isConnected ? opener : overlay.querySelector('#mq-menu')).focus({ preventScroll: true });
        });
    }

    function _grantMissionCrateParts(amount) {
        const rewards = [];
        for (let count = 0; count < amount; count++) {
            const items = _getAllPartsItems();
            if (!items.length) {
                addUniversalParts(1);
                rewards.push({ icon:'⭐', label:'+1 Universal Part', desc:'All items collected', rarity:'rare' });
                continue;
            }
            const item = items[Math.floor(Math.random() * items.length)];
            if (_grantRewardPart(item.key)) {
                rewards.push(_partConversion(item.key, 1));
            } else {
                rewards.push({ type: 'parts', key: item.key, label:`+1 Part: ${_partItemName(item.key)}`, desc:`${saveData.parts[item.key]}/${_getItemCost(item.key)} parts`, rarity:'common' });
            }
        }
        return rewards;
    }

    window._claimWeeklyUniversalParts = function(silent = false, button) {
        if (button) return _claimAfterPaint(button, () => window._claimWeeklyUniversalParts(silent));
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

    window._claimQuestPts = (questId, isWeekly, color, button, silent = false) => {
        const claim = () => _claimQuestPts(questId, isWeekly, color, button, silent);
        return button && !silent ? _claimAfterPaint(button, claim) : claim();
    };

    function _claimQuestPts(questId, isWeekly, color, btnEl, silent) {
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
        seasonPass.creditMissionPoints(saveData, pts);
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
                    saveData.universalParts = (saveData.universalParts || 0) + MQ_SPECIAL_BOX_PARTS;
                    if (!silent) _showMissionReward(`+${MQ_SPECIAL_BOX_PARTS} Universal Parts — Bonus Box!`);
                }
            }
        }
        m.stats.totalPts = (m.stats.totalPts || 0) + pts;
        // Capture button position BEFORE re-render destroys it
        const _fromRect = btnEl ? btnEl.getBoundingClientRect() : null;
        saveDataToFile();
        if (silent) return;
        renderMissionsOverlay(isWeekly ? 'weekly' : 'daily');
        _checkGlowNotifications();
        // Animations are purely visual (data already committed above)
        const _bonusDeltaCapture = _bonusBoxDelta;
        if (_fromRect) {
            _flyPtsToBar(pts, _fromRect, color || 'var(--lb-label)', function() {
                if (_bonusDeltaCapture > 0) {
                    setTimeout(() => _flyPtsToBox(_bonusDeltaCapture), 150);
                }
            });
        }
    }

    function _flyPtsToBar(pts, fromEl, color, onDone) {
        const fromRect = (fromEl && typeof fromEl.getBoundingClientRect === 'function') ? fromEl.getBoundingClientRect() : fromEl;
        const barEl = document.querySelector('.mq-pb-points');
        if (!barEl) { onDone && onDone(); return; }
        const barRect = barEl.getBoundingClientRect();
        const destX = barRect.left + barRect.width / 2;
        const destY = barRect.top + barRect.height / 2;

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
        const barEl = document.querySelector('.mq-pb-points');
        const boxEl = document.getElementById('mq-bonus-box');
        if (!barEl || !boxEl) return;
        const fromRect = barEl.getBoundingClientRect();
        const toRect   = boxEl.getBoundingClientRect();

        const flyEl = document.createElement('div');
        flyEl.className = 'mq-fly-pts';
        flyEl.textContent = `+${delta}`;
        flyEl.style.left   = `${fromRect.left + fromRect.width * 0.12}px`;
        flyEl.style.top    = `${fromRect.top + 14}px`;
        flyEl.style.color  = 'var(--lb-utility)';
        flyEl.style.textShadow = '0 0 10px var(--lb-utility)';
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
                boxEl.style.boxShadow = '0 0 8px var(--lb-utility)';
                boxEl.style.borderColor = 'var(--lb-utility)';
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

    // ===== PLAYLIST PANEL =====
    function openPlaylistPanel() {
        if (!_trackPool.size) _initTrackCatalog().then(_renderPlaylistPanel);
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
        const el = _playlistContent;
        if (!el?.isConnected) return;
        if (_trackPool.size === 0) {
            el.innerHTML = '<p class="lb-playlist-loading" role="status">Loading tracks…</p>';
            return;
        }
        const focusLabel = el.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
        const svgCheck = `<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 3 3 7-7"/></svg>`;
        const menuPlaylist = _getPlaylist('menu');
        const gamePlaylist = _getPlaylist('game');
        const actionPlaylist = _getPlaylist('action');
        const allNames = [..._trackPool.keys()].sort((a, b) => a.localeCompare(b));
        const trackToggle = (on, ctx, name) => `<button type="button" class="lb-block-btn lb-block-btn--icon lb-playlist-check" data-playlist="${ctx === 'menu' ? 'menu' : 'game'}" aria-label="${ctx === 'menu' ? 'Menu' : 'Game'} playlist: ${escapeHtml(name)}" aria-pressed="${on}" onclick="window.moveTrack('${ctx}',${escapeHtml(JSON.stringify(name))},${!on})">${svgCheck}</button>`;
        const header = `<div class="lb-playlist-grid lb-playlist-columns" aria-hidden="true">
            <span>Track</span><span>Menu</span><span>Game</span><span>Tags</span>
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
            const playMark = isPlaying ? '<span class="lb-playlist-equalizer" aria-hidden="true"><i></i><i></i><i></i></span>' : '';
            const tagChips = [...tags].sort().map(tag => `<span class="lb-playlist-tag">${escapeHtml(tag)}</span>`).join('');
            return `<div class="lb-playlist-grid lb-playlist-row">
                <button type="button" class="lb-block-btn lb-playlist-track" aria-label="Play ${escapeHtml(name)}" ${isPlaying ? 'aria-current="true"' : ''} onclick="window.playTrackInPlaylist(${escapeHtml(JSON.stringify(name))})">
                    <span class="lb-playlist-track-title">${playMark}<span>${escapeHtml(name)}</span></span>
                    ${artist ? `<small>by ${escapeHtml(artist)}</small>` : ''}
                </button>
                ${trackToggle(menuOn, 'menu', name)}
                ${trackToggle(gameOn, gameCtx, name)}
                <div class="lb-playlist-tags">${tagChips}</div>
            </div>`;
        }).join('');
        el.innerHTML = header + rows;
        if (focusLabel) [...el.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === focusLabel)?.focus({ preventScroll: true });
    }
    window.openPlaylistPanel = openPlaylistPanel;
    window.closePlaylistPanel = closePlaylistPanel;
    window.playTrackInPlaylist = function(name) {
        if (_currentMode !== 'menu' || !_trackPool.has(name)) return;
        if (!musicPlaying) startMusic('menu');
        else _unlockAudio(true);
        if (!audioCtx) return;
        const idx = _selectMusicTracks('menu').indexOf(name);
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
            if (settings[key].length === 0) settings[key] = [...allTracks];
            if (mode === 'menu' && _currentMode === 'menu' && _nowPlayingName === name && _activeMusic) {
                const nextEnabled = settings[key];
                const nextName = nextEnabled[Math.floor(Math.random() * nextEnabled.length)];
                const nextIdx = _selectMusicTracks('menu').indexOf(nextName);
                if (nextIdx >= 0) _playMenuFileTrack(nextIdx);
            }
        }
        saveSettings();
    }

    const playOverlay = document.getElementById('mode-select-overlay');
    const playModifiers = [
        { key: 'optMirror', name: 'Mirror', icon: 'mirror', percent: 20, level: 11, rank: 'Silver I', description: 'Flips board; swaps left/right.' },
        { key: 'optNoNext', name: 'No Next', icon: 'no-next', percent: 10, level: 31, rank: 'Emerald I', description: 'Hides the next piece.' },
        { key: 'optGhost', name: 'Ghost Piece', icon: 'ghost', percent: -20, level: 11, rank: 'Silver I', description: 'Marks the landing spot.' },
        { key: 'optHold', name: 'Hold', icon: 'hold', percent: -20, level: 21, rank: 'Gold I', description: 'Saves a piece for later.' },
        { key: 'opt3Next', name: '3 Next', icon: 'three-next', percent: -10, level: 31, rank: 'Emerald I', description: 'Previews three upcoming pieces.' },
    ];
    const playIcon = name => `<svg class="lb69-icon" aria-hidden="true"><use href="#play-icon-${name}"/></svg>`;
    const playPercent = percent => `${percent > 0 ? '+' : '−'}${Math.abs(percent)}%`;

    function openModeSelect() {
        const playerLevel = getLevelInfo(saveData.totalXP).level;
        const funCard = playOverlay.querySelector('[data-mode="fun"]');
        funCard.disabled = playerLevel < 11;
        funCard.classList.toggle('lb-block-btn--locked', funCard.disabled);
        document.getElementById('play-fun-lock').hidden = !funCard.disabled;
        document.getElementById('play-fun-rank').innerHTML = rankUnlockText('Unlocks at Silver I');
        document.getElementById('play-fun-desc').hidden = funCard.disabled;
        funCard.setAttribute('aria-describedby', funCard.disabled ? 'play-fun-lock' : 'play-fun-desc');

        document.getElementById('fun-cols').value = funModeConfig.cols;
        document.getElementById('fun-rows').value = funModeConfig.rows;
        const speed = funModeConfig.startSpeed;
        document.getElementById('fun-speed').value = Number.isInteger(speed) && speed >= 1 && speed <= 15 ? speed : 1;
        updateFunConfigDisplay();
        updatePlayModifiers(playerLevel);
        if (currentGameMode === 'advanced' || (currentGameMode === 'fun' && playerLevel < 21)) currentGameMode = 'normal';
        selectMode(currentGameMode || 'normal');

        playOverlay.classList.remove('hidden');
        playOverlay.querySelector('.lb148-play-content').scrollTop = 0;
        _animateIn(playOverlay, 'anim-in-up');
        playOverlay.focus({ preventScroll: true });
    }

    function closeModeSelect() {
        if (playOverlay.classList.contains('anim-out-down')) return;
        _animateOut(playOverlay, 'anim-out-down', () => document.getElementById('btn-play').focus({ preventScroll: true }));
    }

    function selectMode(mode) {
        const cards = [...playOverlay.querySelectorAll('.lb69-mode')];
        if (!cards.some(card => card.dataset.mode === mode && !card.disabled)) return;
        currentGameMode = mode;
        for (const card of cards) card.setAttribute('aria-pressed', card.dataset.mode === mode);
        const isFun = mode === 'fun';
        playOverlay.dataset.mode = mode;
        document.getElementById('fun-mode-config').hidden = !isFun;
        document.getElementById('play-board-preview').hidden = !isFun;
        updatePlaySummary();
    }

    function updateFunConfigDisplay() {
        funModeConfig.cols = document.getElementById('fun-cols').valueAsNumber;
        funModeConfig.rows = document.getElementById('fun-rows').valueAsNumber;
        funModeConfig.startSpeed = document.getElementById('fun-speed').valueAsNumber;
        document.getElementById('fun-cols-val').value = funModeConfig.cols;
        document.getElementById('fun-rows-val').value = funModeConfig.rows;
        document.getElementById('fun-speed-val').value = funModeConfig.startSpeed;
        if (!_qaDemo) localStorage.setItem('linebreaker_funConfig', JSON.stringify(funModeConfig));

        const board = document.getElementById('play-board-preview');
        board.style.setProperty('--play-cols', funModeConfig.cols);
        board.style.setProperty('--play-rows', funModeConfig.rows);
        document.getElementById('play-board-size').textContent = `${funModeConfig.cols} × ${funModeConfig.rows} board`;
    }

    function _calcModeXpMult(activeSettings = settings) {
        let multiplier = 1;
        for (const { key, percent } of playModifiers) {
            if (activeSettings[key]) multiplier += percent / 100;
        }
        return Math.max(0.1, multiplier);
    }

    function updatePlaySummary() {
        const isFun = currentGameMode === 'fun';
        document.getElementById('play-score-panel').hidden = isFun;
        for (const percent of playOverlay.querySelectorAll('.lb69-modifier-score')) percent.hidden = isFun;
        if (isFun) return;
        const multiplier = _calcModeXpMult();
        const score = document.getElementById('mode-xp-mult-val');
        score.textContent = `${Math.round(multiplier * 100)}%`;
        score.dataset.effect = multiplier > 1 ? 'bonus' : multiplier < 1 ? 'penalty' : 'base';

        const active = playModifiers.filter(({ key }) => settings[key]);
        const list = document.getElementById('play-active-modifiers');
        const items = active.map(({ name, percent }) => {
            const item = document.createElement('li');
            item.textContent = `${name} ${playPercent(percent)}`;
            return item;
        });
        list.replaceChildren(...items);
        list.hidden = !items.length;
        document.getElementById('play-no-modifiers').hidden = !!items.length;
    }

    function syncPlayModifierRows() {
        for (const input of playOverlay.querySelectorAll('input[data-play-modifier]')) {
            input.checked = !!settings[input.dataset.playModifier];
        }
    }

    function updatePlayModifiers(playerLevel) {
        let changed = false;
        for (const { key, level } of playModifiers) {
            if (playerLevel < level && settings[key]) {
                settings[key] = false;
                changed = true;
            }
        }
        if (changed) saveSettings();

        const ordered = [...playModifiers].sort((first, second) => {
            const firstLocked = playerLevel < first.level;
            const secondLocked = playerLevel < second.level;
            return Number(firstLocked) - Number(secondLocked) || (firstLocked ? first.level - second.level : 0);
        });
        const rows = ordered.map(({ key, name, icon, percent, level, rank, description }) => {
            if (playerLevel < level) {
                const row = document.createElement('button');
                row.type = 'button';
                row.disabled = true;
                row.className = 'lb69-modifier lb69-locked-row lb-block-btn lb-block-btn--locked';
                row.dataset.playModifier = key;
                row.innerHTML = `${playIcon('lock')}<strong>${name}</strong><span class="lb69-lock">${rankUnlockText(`Unlocks at ${rank}`)}</span>`;
                return row;
            }
            const row = document.createElement('label');
            row.className = 'lb69-modifier';
            row.innerHTML = `
                ${playIcon(icon)}
                <span class="lb69-modifier-copy">
                    <strong id="play-name-${key}">${name}</strong>
                    <small id="play-desc-${key}">${description}</small>
                </span>
                <span class="lb69-modifier-score" data-effect="${percent > 0 ? 'bonus' : 'penalty'}">${playPercent(percent)}</span>
                <span class="lb-block-switch">
                    <input type="checkbox" role="switch" data-play-modifier="${key}" aria-labelledby="play-name-${key}" aria-describedby="play-desc-${key}">
                    <span class="toggle-slider" aria-hidden="true"></span>
                </span>`;
            const input = row.querySelector('input');
            input.addEventListener('change', () => {
                settings[key] = input.checked;
                if (settings[key] && key === 'optNoNext') settings.opt3Next = false;
                if (settings[key] && key === 'opt3Next') settings.optNoNext = false;
                saveSettings();
                syncPlayModifierRows();
                updatePlaySummary();
            });
            return row;
        });
        document.getElementById('mode-options-panel').replaceChildren(...rows);
        syncPlayModifierRows();
    }

    function startSelectedMode() {
        _animateOut(playOverlay, 'anim-out-down');
        startGame();
    }

    document.getElementById('play-back').addEventListener('click', closeModeSelect);
    document.getElementById('play-rules').addEventListener('click', () => window.openRules());
    document.getElementById('play-start').addEventListener('click', startSelectedMode);
    for (const card of playOverlay.querySelectorAll('.lb69-mode')) {
        card.addEventListener('click', () => selectMode(card.dataset.mode));
    }
    for (const input of playOverlay.querySelectorAll('#fun-mode-config input')) {
        input.addEventListener('input', updateFunConfigDisplay);
    }

    window.closeAlert = closeAlert;
    window.resumeGame = resumeGame;
    window.quitGame = quitGame;
    window.restartPausedRun = restartPausedRun;
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
            const scoreDate = _scoreDate(d);
            saveData.leaderboard.push({ score, ...scoreDate, lines, blocks, time, maxSpeed, xp: score, maxCombo: combo });
        }
        saveData.leaderboard.sort((a, b) => b.score - a.score);
        saveDataToFile();
        customAlert('Added 250 random scores!', 'DEV MODE');
    };
    window.devEditStats = devEditStats;
    window.devUnlockAllAchievements = devUnlockAllAchievements;
    window.devLockAllAchievements = devLockAllAchievements;
    window.devUnlockShop = function() {
        // Unlock all skins
        saveData.ownedSkins = Object.keys(SKIN_NAMES);
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
        const packs = ['DEFAULT', 'CYBER', 'RETRO', 'ZEN', 'ARCADE'].map((label, index) => ({ label, id: 'abcde'[index] }));
        renderSfxPreview(ov, 'SFX Preview', packs, sfxList);
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
        ov.querySelector('.lb102-sfx-close').addEventListener('click', () => ov.remove());
        let _devSfxPack = 'a';
        ov.querySelectorAll('[data-pack]').forEach(tab => {
            tab.addEventListener('click', () => {
                _devSfxPack = tab.dataset.pack;
                ov.querySelectorAll('[data-pack]').forEach(t => {
                    const active = t.dataset.pack === _devSfxPack;
                    t.setAttribute('aria-pressed', active);
                    t.classList.toggle('active', active);
                });
            });
        });
        ov.querySelectorAll('[data-sfx]').forEach(row => {
            row.addEventListener('click', () => {
                _unlockAudio(true);
                if (!audioCtx) return;
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
    function renderSfxPreview(overlay, title, packs, sounds) {
        const titleId = `${overlay.id}-title`;
        overlay.className = 'lb102-sfx-overlay';
        overlay.innerHTML = `<div class="lb-block-panel lb102-sfx-window" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
            <header class="lb-block-panel-head lb102-sfx-head">
                <h2 class="lb-block-section-title" id="${titleId}">${title}</h2>
                <button type="button" class="lb-block-btn lb-block-btn--icon lb102-sfx-close" aria-label="Close sounds"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
            </header>
            <div class="lb-block-tabs lb102-sfx-tabs" role="group" aria-label="Sound packs">
                ${packs.map((pack, index) => `<button type="button" class="lb-block-btn lb-block-tab${index === 0 ? ' active' : ''}" data-pack="${pack.id}" aria-pressed="${index === 0}">${pack.label}</button>`).join('')}
            </div>
            <div class="lb-scroll-fade lb102-sfx-list">
                ${sounds.map(sound => `<button type="button" class="lb-block-btn lb102-sfx-row" data-sfx="${sound.name}" aria-label="Play ${sound.desc}">
                    <span class="lb102-sfx-speaker" aria-hidden="true">${_SVG_VOL}</span>
                    <span><strong>${sound.name}</strong><small>${sound.desc}</small></span>
                </button>`).join('')}
            </div>
        </div>`;
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
        let _activePack = packDefs[0];
        renderSfxPreview(ov, 'SFX Pack Preview', packDefs, sfxList);
        ov.addEventListener('click', e => { if (e.target === ov) window._closeModal('sfx-preview-modal'); });
        document.body.appendChild(ov);
        _animateIn(ov.querySelector('div'), 'anim-in-down');
        ov.querySelector('.lb102-sfx-close').addEventListener('click', () => window._closeModal('sfx-preview-modal'));
        ov.querySelectorAll('[data-pack]').forEach(tab => {
            tab.addEventListener('click', () => {
                const pid = tab.dataset.pack;
                _activePack = packDefs.find(p => p.id === pid) || packDefs[0];
                ov.querySelectorAll('[data-pack]').forEach(t => {
                    const act = t.dataset.pack === pid;
                    t.setAttribute('aria-pressed', act);
                    t.classList.toggle('active', act);
                });
            });
        });
        ov.querySelectorAll('[data-sfx]').forEach(row => {
            row.addEventListener('click', () => { _activePack.fn(row.dataset.sfx); });
        });
    };
    window.pinCurrentScore = pinCurrentScore;
    window.statsLbTab = statsLbTab;
    window.applyTheme = applyTheme;
    window.applyBlockSkin = applyBlockSkin;
    window.applyFont = applyFont;
    window._doExchange = function(fromKey, toKey, type, sets) {
        const source = type === 'booster' ? saveData.boosters : saveData.boxes;
        if (!Number.isInteger(sets) || sets < 1 || sets * 3 > (source?.[fromKey] || 0)) return;
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
    window.useScoreBooster = useScoreBooster;
    window.playerUnlockItem = playerUnlockItem;
    window.openUseUniversalPart = openUseUniversalPart;
    window.openExchangeUniversalParts = openExchangeUniversalParts;
    window.giveItemDirectly = giveItemDirectly;
    window.applyBtnStyle = applyBtnStyle;
    window.applyGridStyle = applyGridStyle;
    window.openCredits = function() { const _crEl = document.getElementById('credits-overlay'); if (!_crEl) return; _crEl.classList.remove('hidden'); _animateIn(_crEl, 'anim-in-right'); };
    if (_devMode) {
    window.devTriggerMilestone = function() {
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
                `<button type="button" class="lb-block-btn" data-ms-lv="${lv}" style="--bb-button-ink:${m.rankColor}">Lv ${lv} — ${m.rankName}</button>`
            ).join('') +
            '<button type="button" class="lb-block-btn" data-ms-cancel>Cancel</button>';
        _sel.addEventListener('click', e => {
            const btn = e.target.closest('[data-ms-lv],[data-ms-cancel]');
            if (!btn) return;
            _sel.remove();
            if (btn.dataset.msCancel !== undefined) return;
            const lv = parseInt(btn.dataset.msLv);
            const m = _MS[lv];
            if (!m) return;
            LBCrates.grantCrate(saveData, LBCrates.levelRarity(lv), { source: 'level' });
            saveDataToFile();
        });
        document.body.appendChild(_sel);
    };
    window.devResetDailyMissions = function() {
        if (!saveData.missions) saveData.missions = _defaultMissions();
        const { quests, secret } = _generateDailyQuests();
        const today = _missionDateKey();
        saveData.missions.daily = { quests, secret, lastRefreshDate: today, swapDate: '', pointsToday: 0, claimedMilestones: [], completedToday: false, newVisit: true };
        saveDataToFile();
        if (!document.getElementById('missions-overlay').classList.contains('hidden')) renderMissionsOverlay('daily');
        customAlert('Daily missions reset!', 'DEV MODE');
    };
    window.devResetWeeklyMissions = function() {
        if (!saveData.missions) saveData.missions = _defaultMissions();
        const missions = _generateWeeklyMissions();
        const thisWeek = _missionWeekKey();
        saveData.missions.weekly = { missions, weekKey: thisWeek, isoWeekKey: true, swapDate: '', points: 0, claimedMilestones: [], dailyPtsLog: {}, newVisit: true, pendingUniversalParts: 0, universalPtsTracked: 0 };
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
                    saveData.universalParts = (saveData.universalParts || 0) + MQ_SPECIAL_BOX_PARTS;
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
    const helpOverlay = document.getElementById('rules-overlay');
    const helpBack = document.getElementById('help-back');
    const helpNav = helpOverlay.querySelector('.lb-help-nav');
    const helpContent = helpOverlay.querySelector('.lb-help-content');
    let helpOpener;

    function renderHelp() {
        const number = value => value.toLocaleString();
        const definitions = entries => `<dl class="lb-help-rows">${entries.map(([term, text]) => `<div><dt>${term}</dt><dd>${text}</dd></div>`).join('')}</dl>`;
        const block = (title, body, id = '') => `<div class="lb-help-block"><h3 class="lb-block-section-title"${id ? ` id="help-${id}" tabindex="-1"` : ''}>${title}</h3>${body}</div>`;
        const table = (label, columns, rows) => `<table class="lb-help-table" aria-label="${label}"><thead><tr>${columns.map(column => `<th scope="col">${column}</th>`).join('')}</tr></thead><tbody>${rows.map(([heading, ...cells]) => `<tr><th scope="row">${heading}</th>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        const milestones = entries => definitions(entries.map(({ pts, label }) => [`${pts} pts`, escapeHtml(label)]));
        const keycap = code => `<kbd>${escapeHtml(LBControls.keyLabel(code))}</kbd>`;
        const settingRange = id => {
            const input = document.getElementById(id);
            return `${input.min}–${input.max}`;
        };
        const lineNames = ['Single', 'Double', 'Triple', 'Quad'];
        const controls = Object.entries(LBControls.actions).map(([action, label]) => {
            const keys = settings.keyBindings[action].filter(Boolean);
            return [label, keys.length ? `<span class="lb-help-keycaps">${keys.map(keycap).join('')}</span>` : '<span class="lb-help-unbound">Unbound</span>'];
        });
        const pieces = BASE_PIECES.slice(1).map((matrix, index) => {
            const cells = matrix.flatMap((row, rowIndex) => row.flatMap((filled, column) => filled ? [[column, rowIndex]] : []));
            const columns = cells.map(([column]) => column);
            const rows = cells.map(([, row]) => row);
            const left = (3 - Math.max(...columns) - Math.min(...columns)) * 5;
            const top = (1 - Math.max(...rows) - Math.min(...rows)) * 5;
            const blocks = cells.map(([column, row]) => `<g transform="translate(${column * 10 + left} ${row * 10 + top})"><rect width="9" height="9" rx="1"/><path class="lb-help-piece-highlight" d="M1 7V1H8"/><path class="lb-help-piece-shadow" d="M1 8H8V2"/></g>`).join('');
            return `<li><svg viewBox="-0.5 -0.5 40 20" width="40" height="20" color="${COLORS[index + 1]}" aria-hidden="true">${blocks}</svg><span>${'IJLOSTZ'[index]}</span></li>`;
        }).join('');
        const rankRows = RANKS.map(({ name, maxLvl }, index) => [
            name, `${(RANKS[index - 1]?.maxLvl || 0) + 1}–${maxLvl}`, number(_RANK_XP_PER_LEVEL[index])
        ]);
        rankRows.push([CELESTITE_RANK.name, `${RANKS.at(-1).maxLvl + 1}+`, number(CELESTITE_XP_PER_LEVEL)]);
        const modifiers = playModifiers.map(({ key, name, percent, level, description }) => {
            const text = key === 'optHold'
                ? 'Store or swap a piece once per turn using Hold.'
                : description;
            const pct = `${percent > 0 ? '+' : '−'}${Math.abs(percent)}%`;
            return [name, `${text}<span class="lb-help-meta">Level ${level} · ${pct} in Normal</span>`];
        });
        const sections = [
            ['basics', 'Basics & controls', `
                ${block('Stack & clear', `<p><strong>Fill a row</strong> to clear it. If the next piece can’t enter, the run ends.</p><ul class="lb-help-pieces" aria-label="The seven pieces">${pieces}</ul>`)}
                ${block('Keyboard bindings', `<p>In <strong>Settings → Controls</strong>, select a slot and press a key. Use ${keycap('Backspace')} to clear it, or the arrow beside Primary to reset both slots.</p>${definitions(controls)}`)}
                ${block('Touch', `<p>Use the on-screen buttons or gesture on the board.</p>${definitions([
                    ['Drag sideways', 'Move'], ['Drag down slowly', 'Soft drop'], ['Flick down', 'Hard drop'],
                    ['Swipe up', 'Hold'], ['Tap', 'Rotate'], ['Left-side or two-finger tap', 'Rotate counter-clockwise']
                ])}`)}
                ${block('Gamepad', `${definitions([
                    ['D-pad / left stick', 'Move'], ['Left / right bumper', 'Soft drop / hard drop'],
                    ['Bottom / right face button', 'Rotate in opposite directions'], ['Left / top face button', 'Hold'], ['Start', 'Pause']
                ])}<p>In menus: use the D-pad to move focus, the bottom button to select and the right button to go back.</p>`)}
                ${block('Sound settings', '<p>Adjust <strong>music and effects</strong> separately. Use the playlist to choose tracks.</p>', 'sound')}
                ${block('Display settings', '<p>Change text size in <strong>Settings</strong>, screen shake and grid visibility under <strong>Gameplay</strong>, and equip cosmetics in <strong>Inventory</strong>.</p>', 'display')}`],
            ['scoring', 'Scoring & run levels', `
                ${block('Line clear points', `<p>Placing pieces earns points. <strong>Line clears</strong> add these base points:</p>${table('Base line clear points', ['Clear', 'Lines', 'Points'], _LINE_PTS.slice(1).map((points, index) => [lineNames[index], index + 1, points]))}`)}
                ${block('Run levels', `<p>Every <strong>${LINES_PER_SPEED} lines</strong>, the run advances one level and pieces fall faster. Run levels top out at ${SPEED_MULTIPLIERS.length}; placement and clear points scale from ×${SPEED_MULTIPLIERS[0]} to ×${SPEED_MULTIPLIERS.at(-1)}.</p>`)}
                ${block('Combos', `<p>Each line adds a combo step. After the first step, each adds <strong>${COMBO_STEP_POINTS} points</strong> before modifiers. A placement without a clear breaks the combo.</p>`)}`],
            ['ranks', 'Ranks & XP', `
                ${block('Earn run XP', '<p>Clear <strong>at least one line in Normal</strong>. Your score and any personal-best bonus count toward run XP.</p><p>Total XP unlocks levels, ranks, rewards and modifiers.</p>')}
                ${block('Rank ladder', table('Rank ladder', ['Rank', 'Levels', 'XP / level'], rankRows))}`],
            ['missions', 'Missions & milestones', `
                ${block('Play & claim', '<p>Play <strong>Normal</strong> to progress most missions, or <strong>Fun</strong> for objectives that ask for it. Daily points count toward weekly milestones. Daily quests refresh each day and weekly missions reset on Monday.</p><p>Claim rewards in <strong>Missions</strong>. Each day you can swap one eligible daily mission and one eligible weekly mission. Secret quests cannot be swapped.</p>')}
                ${block('Daily milestones', milestones(MQ_DAILY_MILESTONES))}
                ${block('Weekly milestones', milestones(MQ_WEEKLY_MILESTONES))}
                ${block('Extra rewards', `<p><strong>Bonus Box:</strong> Earn ${MQ_SPECIAL_BOX_PARTS} universal parts for every ${MQ_SPECIAL_BOX_CAP} points past the last daily milestone.</p><p><strong>Golden Zone:</strong> Claim one universal part per weekly point above ${MQ_WEEKLY_GOLDEN_THRESHOLD}.</p>`)}`],
            ['boxes', 'Boxes & parts', `
                ${block('Find & use parts', '<p>Earn parts from <strong>level boxes, milestones and missions</strong>. Each cosmetic has its own parts. Collect enough to unlock and equip it in Inventory.</p>')}
                ${block('Universal parts', '<p>Fill in missing item parts in <strong>Inventory → Parts</strong>. Once no part unlocks remain, trade universal parts for XP.</p>')}`],
            ['achievements', 'Achievements & rarities', `
                ${block('Track & claim', '<p>Track goals and <strong>claim XP</strong> in Achievements. Secret goals stay hidden until you find them.</p>')}
                ${block('Rarity rewards', `<p>Check each card for its exact reward.</p>${table('Standard XP by rarity', ['Rarity', 'XP'], Object.entries(RARITY_ACH).map(([id, { label }]) => [label, number(_ACH_XP[id])]))}`)}`],
            ['boosters', 'Boosters', `
                ${block('Use a booster', '<p>Find boosters in <strong>Inventory → Boosters</strong>. Use one on the results screen after earning XP in <strong>Normal</strong>. It multiplies XP, not score.</p>')}
                ${block('XP multipliers', definitions(BOOSTER_KEYS.map(key => [BOOSTER_META[key].label, `×${BOOSTER_INFO[key].mult} run XP`])))}`],
            ['modes', 'Game modes & modifiers', `
                ${block('Normal', `<p>Play on a ${COLS_NORMAL} × ${VISIBLE_ROWS} board for <strong>XP, mission progress</strong> and Normal leaderboard scores.</p>`)}
                ${block('Fun', `<p>Set the board to ${settingRange('fun-cols')} columns × ${settingRange('fun-rows')} rows and starting level ${settingRange('fun-speed')}. Fun has its own leaderboard and counts toward some achievements and Fun missions, but gives <strong>no run XP</strong>.</p>`)}
                ${block('Modifiers', `<p>Toggle unlocked options before a run. In <strong>Normal</strong>, percentages add together and affect score and run XP. In <strong>Fun</strong>, modifiers change play only.</p>${definitions(modifiers)}`)}`],
            ['glossary', 'Glossary', `
                ${block('Line clear names', '<p><strong>Single, Double, Triple and Quad</strong> mean 1, 2, 3 or 4 lines cleared in one placement.</p>')}
                ${block('Moves & board', definitions([
                    ['Hard drop', 'Send a piece to the lowest valid row and lock it immediately.'],
                    ['Soft drop', 'Move the piece down faster without an instant lock.'],
                    ['T-spin', 'Rotate a T-piece into a tight slot so most of its corners are blocked.'],
                    ['Ghost piece', 'A preview of where the active piece would land.'],
                    ['Top out', 'The point at which a new piece cannot enter the board.']
                ]))}
                ${block('Scoring terms', definitions([
                    ['Combo', 'Lines cleared across uninterrupted line-clearing placements.'],
                    ['Line streak', 'Consecutive placements that clear at least one line.']
                ]))}
                <button type="button" class="lb-block-btn" id="help-tutorial">Open tutorials</button>`]
        ];
        helpNav.innerHTML = sections.map(([id, title]) => `<button type="button" class="lb-block-btn lb-block-tab" data-help-jump="${id}">${title}</button>`).join('');
        const topicIcons = { basics: 'lb-metric-gamepad', scoring: 'lb-run-icon-lines', ranks: 'lb-metric-total-xp', boxes: 'lb-metric-box', achievements: 'lb-metric-trophy' };
        const topicIcon = id => topicIcons[id] ? `<svg class="lb-metric-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#${topicIcons[id]}"/></svg>` : '';
        helpContent.innerHTML = sections.map(([id, title, body]) => `<section class="lb-help-topic lb-block-card" data-help-topic="${id}" aria-labelledby="help-${id}"><h2 id="help-${id}" class="lb-block-panel-head lb-block-section-title" tabindex="-1">${topicIcon(id)}${title}</h2>${body}</section>`).join('');
        document.getElementById('help-tutorial').addEventListener('click', () => {
            window.openTutorial();
            document.querySelector('#tutorial-overlay .btn-back').focus();
        });
    }

    function jumpToHelp(sectionId) {
        const candidate = document.getElementById(`help-${sectionId}`);
        const heading = candidate?.closest('[data-help-topic]') ? candidate : document.getElementById('help-basics');
        const topicId = heading.closest('[data-help-topic]').dataset.helpTopic;
        for (const button of helpNav.querySelectorAll('[data-help-jump]')) {
            if (button.dataset.helpJump === topicId) {
                button.setAttribute('aria-current', 'location');
                button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
            } else button.removeAttribute('aria-current');
        }
        heading.focus({ preventScroll: true });
        helpContent.scrollTop = heading.offsetTop - parseFloat(getComputedStyle(helpContent).paddingTop || 0);
    }

    window.openHelp = function(sectionId = 'basics') {
        if (helpOverlay.classList.contains('hidden')) {
            helpOpener = document.activeElement;
            controlsEditor.cancel();
            renderHelp();
            helpOverlay.classList.remove('hidden');
            if (saveData.stats) {
                saveData.stats.rulesOpened = (saveData.stats.rulesOpened || 0) + 1;
                if (saveData.stats.rulesOpened >= 5 && !saveData.achievements?.rules_reader?.unlocked) unlockAchievement('rules_reader');
                saveDataToFile();
            }
        }
        jumpToHelp(sectionId);
    };
    window.closeHelp = function() {
        helpOverlay.classList.add('hidden');
        helpOpener?.focus({ preventScroll: true });
        helpOpener = null;
    };
    document.addEventListener('click', event => {
        const trigger = event.target.closest?.('[data-help-section]');
        if (!trigger) return;
        closeInfo();
        trigger.focus({ preventScroll: true });
        window.openHelp(trigger.dataset.helpSection);
    });
    helpNav.addEventListener('click', event => {
        const button = event.target.closest('[data-help-jump]');
        if (button) jumpToHelp(button.dataset.helpJump);
    });
    helpOverlay.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const last = document.getElementById('help-tutorial');
        if (event.shiftKey ? event.target === helpBack : event.target === last) {
            event.preventDefault();
            (event.shiftKey ? last : helpBack).focus();
        }
    });
    const reduceDriftMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    for (const button of document.querySelectorAll('[data-lb-drift]')) {
        let drift;
        const freeze = () => { if (drift?.playState === 'running') drift.pause(); };
        button.addEventListener('pointerenter', event => {
            if (event.pointerType !== 'mouse' || reduceDriftMotion?.matches) return;
            if (drift) drift.play();
            else drift = button.animate?.([
                { '--lb-drift-tint': '0%' }, { '--lb-drift-tint': '38%' }
            ], { duration: 5000, easing: 'ease-in-out', direction: 'alternate', iterations: Infinity, fill: 'both' });
        });
        for (const type of ['pointerleave', 'pointercancel', 'click']) button.addEventListener(type, freeze);
        window.addEventListener('blur', freeze);
        reduceDriftMotion?.addEventListener?.('change', freeze);
    }
    window.openTutorial = function() { const _tutEl = document.getElementById('tutorial-overlay'); _tutEl.classList.remove('hidden'); _animateIn(_tutEl, 'anim-in-right'); };
    window.closeTutorial = function() {
        const _mEl = document.getElementById('menu-overlay');
        _animateOut(document.getElementById('tutorial-overlay'), 'anim-out-right', () => {
            if (!helpOverlay.classList.contains('hidden')) document.getElementById('help-tutorial').focus();
        });
        if (_mEl && !_mEl.classList.contains('hidden')) _animateIn(_mEl, 'anim-in-left');
    };
    window.renderAchievementsOverlay = renderAchievementsOverlay;
    const achievementsOverlay = document.getElementById('achievements-overlay');
    achievementsOverlay.querySelectorAll('[data-achtab]').forEach(button => {
        button.addEventListener('click', () => renderAchievementsOverlay(button.dataset.achtab));
    });
    const achievementCategory = achievementsOverlay.querySelector('#ach-category');
    for (const category of new Set(ACHIEVEMENTS_DEF.map(ach => ach.cat))) {
        achievementCategory.addOption(category, category[0].toUpperCase() + category.slice(1));
    }
    achievementsOverlay.querySelectorAll('#ach-category, #ach-sort, #ach-dates-toggle').forEach(control => {
        control.addEventListener('change', () => {
            if (!achievementsOverlay.classList.contains('hidden')) renderAchievementsOverlay(achievementsOverlay._achTab);
        });
    });
    window.openAchievements = function(tab = 'all') {
        const overlay = document.getElementById('achievements-overlay');
        overlay.classList.remove('hidden');
        return fillScreenAfterPaint(overlay, () => renderAchievementsOverlay(tab, true));
    };
    window.closeAchievements = function() {
        hideMenuScreen(document.getElementById('achievements-overlay'));
        _checkAchGlow();
    };
    window.openModeSelect = openModeSelect;
    window.closeModeSelect = closeModeSelect;
    window.selectMode = selectMode;
    window.updateFunConfigDisplay = updateFunConfigDisplay;
    window.startSelectedMode = startSelectedMode;
    window.doHold = doHold;

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
                skins: SKIN_NAMES, defaults: defaultSettings, palettes: BLOCK_PALETTES,
                themes: THEMES, grids: GRID_STYLES,
                sfxPacks, pieces: BASE_PIECES
            })),
            partCost: _getItemCost,
            loadSkinAtlases: () => Promise.all([...IMAGE_SKINS.keys()].map(key => _getSkinAtlas(key).promise)),
            drawSample(context, { cell, swatches, stack, ghost, skin = defaultSettings.skin, palette = defaultSettings.colorPalette,
                colors, grid = defaultSettings.gridStyle, ghostColor = defaultSettings.ghostColor }) {
                const oldSettings = settings, oldSave = saveData, oldColors = COLORS.slice();
                const dimensions = [COLS, ROWS, BLOCK, canvas._logicalWidth];
                settings = { ...defaultSettings, skin, colorPalette: palette, gridStyle: grid, ghostColor };
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
            async playSound(pack, sound) {
                if (!_audioInForeground()) return;
                initAudio();
                if (audioCtx.state === 'suspended') await audioCtx.resume();
                const previousPack = settings.sfxPack;
                settings.sfxPack = pack;
                try { playSFX(sound); } finally { settings.sfxPack = previousPack; }
            }
        };
        return;
    }

    let dailyGiftReady = false;
    let crateBannerTimer;
    document.addEventListener('lb-crate-added', ({ detail: { data, rarity } }) => {
        if (data !== saveData) return;
        document.getElementById('btn-inventory').setAttribute('data-ready', '');
        const inventory = document.getElementById('inventory-overlay');
        if (!inventory.classList.contains('hidden') && inventory._invTab === 'crates') _populateInventoryOther();
        const banner = document.getElementById('lb43-crate-banner');
        banner.textContent = `${LBCrates.crateLabel(rarity)} added to your inventory`;
        clearTimeout(crateBannerTimer);
        crateBannerTimer = setTimeout(() => { banner.textContent = ''; }, 2600);
    });
    const dailyGift = LBCrates.mountDailyGift({
        button: document.getElementById('lb43-daily-gift'), getSave: () => saveData,
        claimAfterPaint: _claimAfterPaint,
        ready: () => dailyGiftReady && !_gameInProgress, save: saveDataToFile,
        onShake: () => playSFX('drop'),
        openGift(rarity) {
            const cards = _grantRarityCrate(rarity, true);
            checkProgressAchievements();
            _checkGlowNotifications();
            return _crateRewardGrid(cards);
        },
    });

    _setLoadProgress(5, 'Initializing…');
    loadSettings();
    syncUiTheme();
    if (BADGE_LEVEL_LABEL !== 'none') document.fonts?.load('52px Silkscreen').then(_syncBadgeLoop, () => {});
    const controlsEditor = LBControls.createEditor(document.getElementById('controls-settings'),
        () => settings.keyBindings, bindings => { settings.keyBindings = bindings; saveSettings(); });
    LBGamepad.start({ press: pressGameInput, release: releaseGameInput, back: backFromOverlay });
    const _reminders = _qaDemo ? null : window.LBNotifications.mount({
        getSettings: () => settings,
        saveSettings
    });
    _sfxMuted = settings.sfxMuted || false;
    syncMusicGain();
    syncMusicMuteButtons();
    // Sync mute button icons on load
    { const _isPix = settings.stylePack === 'pixel';
      const _sBtn = document.getElementById('sfx-mute-btn');
      if (_sBtn) _sBtn.innerHTML = (_sfxMuted ? (_isPix?_SVG_PIX_MUTED:_SVG_MUTED) : (_isPix?_SVG_PIX_VOL:_SVG_VOL));
    }
    _setLoadProgress(20, 'Loading settings…');
    try {
        _applyColorPalette(settings.colorPalette || 'classic');
        _doApplyTheme(settings.theme || 'default', { persist: false });
        applyFontSize(settings.fontSize || '5');
        applyGameScale(settings.gameScale || '5');
        applyStylePack(settings.stylePack || 'modern', { persist: false });
    } catch(e) { console.error('Startup error:', e); }
    _setLoadProgress(40, 'Applying theme…');
    loadData().catch(error => {
        if (startup) startup.fail(error, true);
        else console.error('Startup failed:', error);
    });
    window.addEventListener('resize', () => applyGameScale(settings.gameScale || '5'));


    // Characterization-only access; production startup and gameplay are unchanged.
    if (window.__LB_TEST__ === true) {
        const copy = value => JSON.parse(JSON.stringify(value));
        window.__lb = {
            get state() { return copy({board, player, score, lines: linesClearedThisGame, level: speedLevel, holdPiece, holdUsed, combo: _comboCount, isGameOver, dropInterval}); },
            get save() { return copy(saveData); },
            get pieces() { return copy(BASE_PIECES); },
            setup({cells, type = 6, x = 3, y = 0, speed = 1, scoreMultiplier = 1, save} = {}) {
                board = cells ? copy(cells) : Array.from({length: ROWS}, () => Array(COLS).fill(0));
                saveData = Object.assign(copy(defaultSaveData), save || {});
                player = {pos: {x,y}, matrix: BASE_PIECES[type].map(r => r.map(v => v ? type : 0)), next: null};
                _currentPieceType = type; pieceBag = []; _nextQueue = [];
                score = 0; linesClearedThisGame = 0; rawGameplayXPThisGame = 0; speedLevel = speed; dropInterval = Math.floor(1000 / speed);
                dropCounter = 0; lastTime = performance.now(); currentScoreMultiplier = scoreMultiplier;
                isPaused = false; isGameOver = false; isAnimating = false; _hardDropAnimating = false;
                lineClear.reset();
                holdPiece = null; holdUsed = false; _comboCount = 0; _lastMoveWasRotation = false;
                settings.optHold = true; settings.hardDropLock = false;
                document.getElementById('go-overlay').classList.add('hidden');
            },
            setBoard(cells) { board = copy(cells); },
            setSave(value) { saveData = copy(value); },
            seed(seed) { let n = seed >>> 0; Math.random = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); pieceBag = []; _nextQueue = []; },
            spawn: resetPlayer, move: playerMove, rotate: playerRotate, hardDrop: playerHardDrop,
            hold: doHold, drop: playerDrop, sweep: arenaSweep, tick(dtMs) { update(lastTime + dtMs); },
            nextPiece: getNextPiece, gameOver, getLevelInfo, drawRankBadge, badgeLevelLabel: _badgeLevelLabel,
            imageSkinAtlasCell, imageSkinTintKey, drawGameBlock, partsItems: _getAllPartsItems, partCost: _getItemCost,
            missionWeekKey: _missionWeekKey, missionDateKey: _missionDateKey,
            rewardLabel: _rewardLabel, grantRewardPart: _grantRewardPart, generateLevelBoxRewards: _generateLevelBoxRewards,
            previewRunMissions: _previewRunMissions,
            encSave: _encSave, decSave: _decSave,
            defaultMissions: _defaultMissions, refreshMissions: _checkMissionsRefresh,
            generateDailyQuests: _generateDailyQuests, generateWeeklyMissions: _generateWeeklyMissions,
            missionSwapPool: _missionSwapPool,
            autoClaimMissions: _autoClaimMissions, modeXpMultiplier: _calcModeXpMult,
            processLevelUps: _processLevelUps,
        };
    }
})();
