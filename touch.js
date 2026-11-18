// Reuse the game's keyboard path, including DAS/ARR, hold and drop guards.
(() => {
    const controls = document.getElementById('touch-controls');
    const held = new Map();
    const send = (type, code) => document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
    const release = id => {
        const code = held.get(id);
        if (!code) return;
        held.delete(id);
        send('keyup', code);
    };
    const releaseAll = () => [...held.keys()].forEach(release);
    controls.addEventListener('pointerdown', event => {
        const button = event.target.closest('button[data-key]');
        if (!button || event.button !== 0) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        held.set(event.pointerId, button.dataset.key);
        send('keydown', button.dataset.key);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        controls.addEventListener(type, event => release(event.pointerId));
    }
    controls.addEventListener('click', event => {
        const button = event.target.closest('button[data-key]');
        if (event.detail === 0 && button) {
            send('keydown', button.dataset.key);
            send('keyup', button.dataset.key);
        }
    });
    window.addEventListener('blur', releaseAll);
    window.addEventListener('resize', releaseAll);
    document.addEventListener('visibilitychange', releaseAll);
    new MutationObserver(releaseAll).observe(document.getElementById('app'), { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(releaseAll).observe(document.getElementById('pause-overlay'), { attributes: true, attributeFilter: ['class'] });
})();
