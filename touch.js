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
    const game = root.LBInput, board = document.getElementById('tetris');
    if (!game || !board) return;
    const native = root.Capacitor?.isNativePlatform();
    const enabled = native || root.matchMedia?.('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    document.addEventListener('pointerdown', () => game.unlockAudio(), { once: true });
    if (!enabled) return;
    document.documentElement.classList.add('lb-touch');
    const bar = document.createElement('div');
    bar.className = 'lb-touch-controls'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Touch game controls');
    const pointers = new Map(); let gesture;
    const reset = () => { pointers.clear(); gesture = null; game.release(); };
    for (const [action, label] of [['left','Left'],['right','Right'],['cw','Rotate'],['soft','Soft drop'],['hard','Hard drop'],['hold','Hold'],['pause','Pause']]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.addEventListener('pointerdown', event => {
            event.preventDefault(); button.setPointerCapture(event.pointerId);
            if (action === 'left' || action === 'right' || action === 'soft') game.press(action);
            else game.action(action);
        });
        for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type, () => game.release());
        button.addEventListener('click', event => { if (event.detail === 0) game.action(action); });
        bar.append(button);
    }
    document.getElementById('app').append(bar);
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
        reset();
    });
    board.addEventListener('pointercancel', reset);
    board.addEventListener('lostpointercapture', event => { if (pointers.has(event.pointerId)) reset(); });
    root.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
})(globalThis);
