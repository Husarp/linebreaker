(() => {
    const stickThreshold = 0.55;

    function gamepadActions(pad, menu = false) {
        if (!pad || pad.connected === false || pad.mapping !== 'standard') return [];
        const pressed = index => pad.buttons[index]?.pressed;
        const actions = [];
        if (menu) {
            if (pressed(12) || pressed(14)) actions.push('previous');
            if (pressed(13) || pressed(15)) actions.push('next');
            if (pressed(0)) actions.push('activate');
            if (pressed(1)) actions.push('back');
        } else {
            if (pressed(14) || pad.axes[0] <= -stickThreshold) actions.push('left');
            if (pressed(15) || pad.axes[0] >= stickThreshold) actions.push('right');
            if (pressed(4)) actions.push('soft');
            if (pressed(5)) actions.push('hard');
            if (pressed(0)) actions.push('cw');
            if (pressed(1)) actions.push('ccw');
            if (pressed(2) || pressed(3)) actions.push('hold');
        }
        if (pressed(9)) actions.push('pause');
        return actions;
    }

    function visible(element) {
        return !element.closest('.hidden, [hidden], [inert]') && element.getClientRects().length
            && getComputedStyle(element).visibility === 'visible';
    }

    function topOverlay() {
        let top = null, topZ = -Infinity;
        for (const overlay of document.querySelectorAll('.overlay:not(.hidden), [id$="-overlay"]:not(.hidden), [id$="-modal"]:not(.hidden), #sfx-inv-preview')) {
            if ([...overlay.classList].some(name => name.startsWith('anim-out-')) || !visible(overlay)) continue;
            const z = Number.parseInt(getComputedStyle(overlay).zIndex, 10) || 0;
            if (z >= topZ) { top = overlay; topZ = z; }
        }
        return top;
    }

    function navigate(overlay, action) {
        const buttons = [...overlay.querySelectorAll('button:not(:disabled), [role="button"][tabindex]')]
            .filter(button => button.tabIndex >= 0 && button.getAttribute('aria-disabled') !== 'true' && visible(button));
        if (!buttons.length) return;
        const index = buttons.indexOf(document.activeElement);
        const next = index === -1 ? (action === 'previous' ? buttons.length - 1 : 0)
            : (index + (action === 'previous' ? buttons.length - 1 : action === 'next' ? 1 : 0)) % buttons.length;
        const button = buttons[next];
        if (!button.classList.contains('lb-gamepad-focus')) {
            button.classList.add('lb-gamepad-focus');
            button.addEventListener('blur', () => button.classList.remove('lb-gamepad-focus'), { once: true });
        }
        button.focus();
        if (action === 'activate') button.click();
    }

    function start({ press, release, back }) {
        const previous = new Map();
        let frame = null;
        const source = (index, action) => `gamepad:${index}:${action}`;
        function connectedPads() {
            try {
                return Array.from(navigator.getGamepads?.() || [])
                    .filter(pad => pad?.connected && pad.mapping === 'standard');
            } catch {
                return [];
            }
        }
        function poll() {
            frame = null;
            const pads = connectedPads();
            const indexes = new Set(pads.map(pad => pad.index));
            for (const [index, state] of previous) {
                if (indexes.has(index)) continue;
                state.game.forEach(action => release(source(index, action)));
                previous.delete(index);
            }
            for (const pad of pads) {
                const old = previous.get(pad.index) || { game: [], menu: [] };
                const game = gamepadActions(pad);
                const menu = gamepadActions(pad, true);
                previous.set(pad.index, { game, menu });
                old.game.filter(action => !game.includes(action)).forEach(action => release(source(pad.index, action)));
                const gamePresses = game.filter(action => !old.game.includes(action));
                const menuPresses = menu.filter(action => !old.menu.includes(action));
                if (document.hidden || (!gamePresses.length && !menuPresses.length)) continue;
                const overlay = topOverlay();
                if (!overlay) {
                    gamePresses.forEach(action => press(action, source(pad.index, action)));
                } else if (menuPresses.includes('back')) {
                    back(overlay);
                } else if (menuPresses.includes('pause') && overlay.id === 'pause-overlay') {
                    press('pause', source(pad.index, 'pause'));
                } else {
                    const action = menuPresses.find(action => action !== 'pause');
                    if (action) navigate(overlay, action);
                }
            }
            if (pads.length) frame = requestAnimationFrame(poll);
        }
        function sync() {
            if (frame !== null) cancelAnimationFrame(frame);
            poll();
        }
        window.addEventListener('gamepadconnected', sync);
        window.addEventListener('gamepaddisconnected', sync);
        sync();
    }

    globalThis.LBGamepad = { gamepadActions, topOverlay, visible, start };
})();
