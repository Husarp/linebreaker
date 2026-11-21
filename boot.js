(function () {
    let phase = 'Loading app scripts…';
    let finished = false;
    let recover;
    let observer;
    let pending;

    function ota() {
        const capacitor = window.Capacitor;
        return capacitor && capacitor.Plugins && capacitor.Plugins.Ota;
    }

    function diagnostic(level, message) {
        const text = ('LBStartup: ' + message).slice(0, 1200);
        const fallback = () => console[level](text);
        try {
            const plugin = ota();
            if (plugin && typeof plugin.logWebDiagnostic === 'function') {
                const call = plugin.logWebDiagnostic({ level, message: text });
                bounded('Startup diagnostics', () => call, 1000).catch(fallback);
                return;
            }
        } catch (error) { fallback(); return; }
        fallback();
    }

    function detail(error) {
        return String(error && (error.stack || error.message) || error);
    }

    function bounded(label, action, ms = 3000) {
        let deadline;
        const timeout = new Promise((resolve, reject) => {
            deadline = setTimeout(() => reject(new Error(label + ' timed out')), ms);
        });
        const result = Promise.race([Promise.resolve().then(action), timeout]);
        return result.then(value => { clearTimeout(deadline); return value; },
            error => { clearTimeout(deadline); throw error; });
    }

    function show() {
        if (finished || !pending) return;
        const status = document.getElementById('ls-status');
        const actions = document.getElementById('ls-actions');
        const next = document.getElementById('ls-continue');
        const restart = document.getElementById('ls-restart');
        if (!status || !actions || !next || !restart) return;
        if (observer) { observer.disconnect(); observer = null; }
        const plugin = ota();
        const continueGame = pending.canContinue && recover;
        status.textContent = pending.message + ': ' + phase + ' ' + (continueGame
            ? 'Continue without saving, or restart to try again.' : 'Restart to try again.');
        const inner = document.getElementById('ls-inner');
        if (inner) inner.classList.add('ls-stalled');
        actions.hidden = false;
        next.hidden = !continueGame && !(plugin && typeof plugin.settings === 'function');
        next.textContent = continueGame ? 'Continue without saving' : 'Open app shell';
        next.onclick = () => {
            if (continueGame) {
                try { recover(); } catch (error) { report('Startup failed', false, error); }
            } else {
                bounded('Open app shell', () => plugin.settings()).catch(error => report('Could not open app shell', false, error));
            }
        };
        restart.onclick = () => location.reload();
    }

    function report(message, canContinue, error) {
        if (finished) return;
        clearTimeout(timer);
        diagnostic('error', message + ' (' + phase + ')' + (error ? ': ' + detail(error) : ''));
        pending = { message, canContinue };
        if (!observer && !document.getElementById('ls-actions') && document.readyState === 'loading') {
            observer = new MutationObserver(show);
            observer.observe(document.documentElement, { childList: true, subtree: true });
        }
        show();
    }

    const timer = setTimeout(() => report('Startup is taking too long', true), 8000);
    window.LBStartup = {
        step(label) { phase = label; diagnostic('info', label); },
        recoverWith(action) { recover = action; show(); },
        fail(error, canContinue = false) { report('Startup failed', canContinue, error); },
        bounded,
        finish() {
            finished = true;
            clearTimeout(timer);
            if (observer) observer.disconnect();
            observer = null;
            pending = null;
        },
    };
    window.addEventListener('error', event => {
        const target = event.target;
        if (target !== window && (!target || target.tagName !== 'SCRIPT')) return;
        const error = event.error || event.message || target.src;
        if (finished) diagnostic('error', 'window error: ' + detail(error));
        else report('Startup failed', true, error);
    }, true);
    window.addEventListener('unhandledrejection', event => diagnostic('error', 'unhandled rejection: ' + detail(event.reason)));
    window.LBStartup.step(phase);
})();
