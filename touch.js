/* Pure mapping is also used by the Pointer Events controller below. */
(function (root) {
    function gestureActions(g, end = false) {
        const dx = g.x - g.startX, dy = g.y - g.startY;
        const cell = Math.max(1, g.cell);
        if (g.fingers > 1) return end && !g.moved ? ['ccw'] : [];
        if (end) {
            if (Math.abs(dx) < cell / 2 && Math.abs(dy) < cell / 2 && !g.moved)
                return [g.startX < g.left + g.width / 3 ? 'ccw' : 'cw'];
            if (Math.abs(dy) > Math.abs(dx) && dy < -cell * 2) return ['hold'];
            if (dy > cell * 2 && Math.abs(dy) > Math.abs(dx) && dy / Math.max(1, g.elapsed) > .5) return ['hard'];
            return [];
        }
        const steps = Math.trunc(dx / cell) - (g.steps || 0);
        const actions = Array(Math.abs(steps)).fill(steps < 0 ? 'left' : 'right');
        // Delay downward movement until a fast swipe has been ruled out.
        if (g.elapsed > 180 && dy / Math.max(1, g.elapsed) <= .5) {
            const down = Math.max(0, Math.trunc(dy / cell) - (g.down || 0));
            actions.push(...Array(down).fill('soft'));
        }
        return actions;
    }
    root.LBTouch = { gestureActions };
    if (!root.document) return;
    const game = root.LBInput, board = document.getElementById('game-board');
    if (!game || !board) return;
    const native = root.Capacitor?.isNativePlatform();
    const enabled = native || root.matchMedia?.('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    document.addEventListener('pointerdown', () => game.unlockAudio(), { once: true });
    if (!enabled) return;
    document.documentElement.classList.add('lb-touch');
    const bar = document.createElement('div');
    bar.className = 'lb-touch-controls'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Touch game controls');
    const pointers = new Map(); let gesture;
    const heldButtons = new Map();
    const resetGesture = () => { pointers.clear(); gesture = null; };
    const releaseButton = pointerId => {
        const action = heldButtons.get(pointerId);
        heldButtons.delete(pointerId);
        if (action === 'left' || action === 'right' || action === 'soft') game.release(pointerId);
    };
    const reset = () => {
        resetGesture();
        for (const pointerId of heldButtons.keys()) releaseButton(pointerId);
    };
    function bindButton(button, action, repeat = false) {
        button.addEventListener('pointerdown', event => {
            if (event.button !== 0 || heldButtons.has(event.pointerId)) return;
            if (event.pointerType === 'mouse') button.setPointerCapture?.(event.pointerId);
            heldButtons.set(event.pointerId, action);
            if (repeat) game.press(action, event.pointerId);
            else game.action(action);
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            button.addEventListener(type, event => releaseButton(event.pointerId));
        }
        button.addEventListener('click', event => {
            if (!event.pointerType && event.detail === 0) game.action(action);
        });
    }
    const glyphs = {
        left: 'M12 5l-7 7 7 7m-7-7h14', right: 'M12 5l7 7-7 7m7-7H5',
        cw: 'M5 9a8 8 0 1 1 0 7m0-7V3m0 6h6',
        soft: 'M5 9l7 7 7-7', hard: 'M5 5l7 7 7-7M5 12l7 7 7-7'
    };
    for (const [action, label] of [['left','Left'],['right','Right'],['cw','Rotate'],['soft','Soft drop'],['hard','Hard drop'],['hold','Hold'],['pause','Pause']]) {
        const button = document.createElement('button'); button.type = 'button';
        button.dataset.action = action;
        button.setAttribute('aria-label', label);
        const caption = document.createElement('span'); caption.textContent = label;
        button.append(caption);
        if (glyphs[action]) button.insertAdjacentHTML('beforeend', `<svg class="lb-touch-glyph" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${glyphs[action]}"/></svg>`);
        const isMove = action === 'left' || action === 'right';
        bindButton(button, action, isMove || action === 'soft');
        if (isMove) button.addEventListener('pointermove', event => {
            const held = heldButtons.get(event.pointerId);
            if (!held) return;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('button');
            const direction = target?.dataset.action;
            if (target?.parentElement !== bar || direction === held || (direction !== 'left' && direction !== 'right')) return;
            heldButtons.set(event.pointerId, direction);
            game.press(direction, event.pointerId);
        });
        bar.append(button);
    }
    document.getElementById('app').append(bar);
    const holdPanel = document.getElementById('hold-panel');
    if (holdPanel) {
        const holdButton = document.createElement('button'); holdButton.type = 'button';
        holdButton.className = 'lb-phone-hold';
        holdButton.setAttribute('aria-label', 'Hold piece');
        bindButton(holdButton, 'hold');
        holdPanel.append(holdButton);
    }
    const pauseButton = document.querySelector('#app .btn-pause-pc');
    if (pauseButton) {
        pauseButton.onclick = null;
        bindButton(pauseButton, 'pause');
    }
    board.addEventListener('pointerdown', event => {
        if (!game.active()) return;
        event.preventDefault(); board.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (!gesture) {
            const rect = board.getBoundingClientRect();
            gesture = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, left: rect.left, width: rect.width, cell: rect.width / 10, started: event.timeStamp, steps: 0, down: 0, fingers: 1, moved: false, primary: event.pointerId };
        } else gesture.fingers = Math.max(gesture.fingers, pointers.size);
    });
    board.addEventListener('pointermove', event => {
        if (!gesture || !pointers.has(event.pointerId)) return;
        event.preventDefault();
        const origin = pointers.get(event.pointerId);
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > gesture.cell / 2) gesture.moved = true;
        if (event.pointerId !== gesture.primary) return;
        Object.assign(gesture, { x: event.clientX, y: event.clientY, elapsed: event.timeStamp - gesture.started });
        gestureActions(gesture).forEach(action => { game.action(action); if (action === 'soft') gesture.down++; });
        gesture.steps = Math.trunc((gesture.x - gesture.startX) / gesture.cell);
    });
    board.addEventListener('pointerup', event => {
        if (!gesture || !pointers.has(event.pointerId)) return;
        const origin = pointers.get(event.pointerId);
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > gesture.cell / 2) gesture.moved = true;
        if (event.pointerId === gesture.primary) Object.assign(gesture, { x: event.clientX, y: event.clientY });
        pointers.delete(event.pointerId);
        if (pointers.size) return;
        gesture.elapsed = event.timeStamp - gesture.started;
        gestureActions(gesture, true).forEach(game.action);
        resetGesture();
    });
    board.addEventListener('pointercancel', resetGesture);
    board.addEventListener('lostpointercapture', event => { if (pointers.has(event.pointerId)) resetGesture(); });
    root.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
})(globalThis);
