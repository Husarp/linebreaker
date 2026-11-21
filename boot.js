(function () {
    let phase = 'Loading app scripts…';
    let finished = false;
    let recover;
    const timer = setTimeout(() => report('Startup is taking too long', true), 8000);

    function report(message, canContinue, error) {
        if (finished) return;
        clearTimeout(timer);
        console.error(`Linebreaker: ${message} (${phase})`, error);
        const show = () => {
            if (finished) return;
            const status = document.getElementById('ls-status');
            const actions = document.getElementById('ls-actions');
            status.textContent = `${message}: ${phase} ${canContinue && recover ? 'Continue without saving, or restart to try again.' : 'Restart to try again.'}`;
            actions.hidden = false;
            const next = document.getElementById('ls-continue');
            next.hidden = !canContinue || !recover;
            next.onclick = () => { try { recover(); } catch (failure) { report('Startup failed', false, failure); } };
            document.getElementById('ls-restart').onclick = () => location.reload();
        };
        if (document.getElementById('ls-actions')) show();
        else document.addEventListener('DOMContentLoaded', show, { once: true });
    }

    window.LBStartup = {
        step(label) { phase = label; },
        recoverWith(action) { recover = action; },
        fail(error, canContinue = false) { report('Startup failed', canContinue, error); },
        finish() { finished = true; clearTimeout(timer); window.removeEventListener('error', onError, true); },
    };
    function onError(event) {
        if (event.target === window || event.target instanceof HTMLScriptElement) {
            report('Startup failed', false, event.error || event.message || event.target.src);
        }
    }
    window.addEventListener('error', onError, true);
})();
