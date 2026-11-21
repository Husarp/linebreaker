(() => {
    const root = document.documentElement;
    const margin = 12;
    const clearance = 8;

    function layout(insets) {
        const width = root.clientWidth;
        const top = insets?.top || 0;
        const obstructions = (insets?.rects || []).filter(rect => rect.top < top && rect.bottom > 0);
        const leftEdge = Math.max(margin, insets?.left || 0);
        const rightEdge = width - Math.max(margin, insets?.right || 0);
        let mode = '';
        let roomy = false;
        if (obstructions.length && (typeof CSS === 'undefined' || CSS.supports('selector(:has(*))'))) {
            const start = Math.max(leftEdge, Math.min(...obstructions.map(rect => rect.left)) - clearance);
            const end = Math.min(rightEdge, Math.max(...obstructions.map(rect => rect.right)) + clearance);
            const left = start - leftEdge;
            const right = rightEdge - end;
            if (end <= start) mode = 'clear';
            else if (end - start <= (rightEdge - leftEdge) / 3) {
                if (left >= 76 && right >= 96) mode = 'split';
                else if (Math.max(left, right) >= 224) mode = left >= right ? 'left' : 'right';
            }
            if (mode) {
                roomy = mode === 'split' && left >= 128;
                root.style.setProperty('--lb-cut-start', `${start}px`);
                root.style.setProperty('--lb-cut-end', `${end}px`);
            }
        }
        if (mode) root.dataset.lbCutout = mode;
        else delete root.dataset.lbCutout;
        root.toggleAttribute('data-lb-cutout-roomy', roomy);
    }

    window.addEventListener('lb-window-insets', event => layout(event.detail));
    window.addEventListener('resize', () => layout(window.__lbWindowInsets));
    layout(window.__lbWindowInsets);
})();
