(() => {
    const root = document.documentElement;
    function layout(insets) {
        const top = insets?.top || 0;
        const cutouts = (insets?.rects || []).filter(rect => rect.top < top && rect.bottom > 0 && Number.isFinite(rect.bottom));
        const bottom = cutouts.reduce((edge, rect) => Math.max(edge, rect.bottom), top);
        const spans = cutouts.filter(rect => Number.isFinite(rect.left) && Number.isFinite(rect.right) && rect.right > rect.left);
        root.style.setProperty('--lb-cutout-top', `${bottom}px`);
        if (spans.length) {
            root.style.setProperty('--lb-cutout-left', `${Math.min(...spans.map(rect => rect.left))}px`);
            root.style.setProperty('--lb-cutout-right', `${Math.max(...spans.map(rect => rect.right))}px`);
        } else {
            root.style.removeProperty('--lb-cutout-left');
            root.style.removeProperty('--lb-cutout-right');
        }
    }

    window.addEventListener('lb-window-insets', event => layout(event.detail));
    layout(window.__lbWindowInsets);
})();
