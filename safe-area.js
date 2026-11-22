(() => {
    const root = document.documentElement;
    function layout(insets) {
        const top = insets?.top || 0;
        const bottom = (insets?.rects || []).reduce((edge, rect) =>
            rect.top < top && Number.isFinite(rect.bottom) ? Math.max(edge, rect.bottom) : edge, top);
        root.style.setProperty('--lb-cutout-top', `${bottom}px`);
    }

    window.addEventListener('lb-window-insets', event => layout(event.detail));
    layout(window.__lbWindowInsets);
})();
