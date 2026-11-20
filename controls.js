(() => {
    const actions = Object.freeze({
        left: 'Move left', right: 'Move right', soft: 'Soft drop', hard: 'Hard drop',
        cw: 'Rotate CW', ccw: 'Rotate CCW', hold: 'Hold', pause: 'Pause', restart: 'Restart'
    });
    const defaults = Object.freeze({
        left: Object.freeze(['ArrowLeft', 'KeyA']), right: Object.freeze(['ArrowRight', 'KeyD']),
        soft: Object.freeze(['ArrowDown', 'KeyS']), hard: Object.freeze(['Space', null]),
        cw: Object.freeze(['ArrowUp', 'KeyW']), ccw: Object.freeze([null, null]),
        hold: Object.freeze(['KeyH', null]), pause: Object.freeze(['Escape', 'KeyP']),
        restart: Object.freeze([null, null])
    });
    const actionNames = Object.keys(actions);
    const isBindable = code => typeof code === 'string' && /^[A-Z][a-zA-Z0-9]+$/.test(code)
        && !['Unidentified', 'Tab', 'Backspace'].includes(code);

    function normalizeBindings(saved) {
        const used = new Set();
        return Object.fromEntries(actionNames.map(action => {
            const slots = Array.isArray(saved?.[action]) ? saved[action] : defaults[action];
            return [action, [0, 1].map(slot => {
                const code = slots[slot];
                if (!isBindable(code) || used.has(code)) return null;
                used.add(code);
                return code;
            })];
        }));
    }

    function actionForKey(bindings, code) {
        return code ? actionNames.find(action => bindings[action].includes(code)) : undefined;
    }

    function rebind(bindings, action, slot, code) {
        const conflict = code && actionNames.find(name =>
            bindings[name].some((key, index) => key === code && (name !== action || index !== slot)));
        return conflict ? { conflict } : {
            bindings: { ...bindings, [action]: bindings[action].map((key, index) => index === slot ? code : key) }
        };
    }

    const keyLabel = code => code?.replace(/^(Key|Digit)(?=[A-Z0-9]$)/, '').replace(/^Arrow/, 'Arrow ') || 'Unbound';

    function createEditor(root, read, write) {
        const grid = root.querySelector('.lb-controls-grid');
        const status = root.querySelector('.lb-controls-status');
        const buttons = [];
        const restoreButtons = new Map();
        let editing = null;

        for (const action of actionNames) {
            const row = document.createElement('div');
            row.className = 'lb-controls-row';
            row.innerHTML = `<span>${actions[action]}</span>
                <button type="button" class="lb-block-btn lb-block-btn--icon lb-controls-restore" aria-label="Restore default keys for ${actions[action]}" title="Restore default keys" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#lb-run-icon-retry"/></svg></button>
                <button type="button" class="lb-btn lb-btn--ghost"></button><button type="button" class="lb-btn lb-btn--ghost"></button>`;
            const [restore, ...slots] = row.querySelectorAll('button');
            restoreButtons.set(action, restore);
            restore.addEventListener('click', () => {
                editing = null;
                const bindings = { ...read(), [action]: [...defaults[action]] };
                const cleared = [];
                for (const other of actionNames) {
                    if (other === action || !bindings[other].some(key => key && defaults[action].includes(key))) continue;
                    bindings[other] = bindings[other].map(key => defaults[action].includes(key) ? null : key);
                    cleared.push(actions[other]);
                }
                write(bindings);
                const note = cleared.length ? ` Reassigned keys cleared from: ${cleared.join(', ')}.` : '';
                showStatus(`${actions[action]}: default keys restored.${note}`);
                render();
                slots[0].focus();
            });
            slots.forEach((button, slot) => {
                const entry = { button, action, slot };
                buttons.push(entry);
                button.addEventListener('click', () => {
                    if (editing === entry) { cancel(); return; }
                    editing = entry;
                    showStatus('Press a key, or Backspace to clear.');
                    render();
                });
            });
            grid.append(row);
        }

        function showStatus(message, warning = false) {
            status.textContent = message;
            status.classList.toggle('lb-controls-warning', warning);
        }

        function render() {
            const bindings = read();
            for (const [action, button] of restoreButtons) {
                button.hidden = bindings[action].every((key, slot) => key === defaults[action][slot]);
            }
            for (const entry of buttons) {
                const { button, action, slot } = entry;
                const label = editing === entry ? 'Press a key…' : keyLabel(bindings[action][slot]);
                button.textContent = label;
                button.setAttribute('aria-label', `${actions[action]}, ${slot === 0 ? 'primary' : 'secondary'}: ${label}`);
                button.setAttribute('aria-pressed', String(editing === entry));
            }
        }

        function cancel() {
            if (!editing) return false;
            editing = null;
            showStatus('');
            render();
            return true;
        }

        function capture(event) {
            if (!editing) return false;
            if (event.code === 'Tab') { cancel(); return false; }
            if (event.ctrlKey || event.metaKey || event.altKey) return false;
            event.preventDefault();
            if (event.repeat) return true;
            const code = event.code === 'Backspace' ? null : event.code;
            if (code !== null && !isBindable(code)) return true;
            const { action, slot } = editing;
            const result = rebind(read(), action, slot, code);
            if (result.conflict) {
                showStatus(`${keyLabel(code)} is already assigned to ${actions[result.conflict]}.`, true);
            } else {
                editing = null;
                write(result.bindings);
                showStatus(`${actions[action]}: ${keyLabel(code)}`);
                render();
            }
            return true;
        }

        document.addEventListener('pointerdown', event => {
            if (editing && !editing.button.contains(event.target)) cancel();
        });
        render();
        return { capture, cancel, render };
    }

    globalThis.LBControls = { actions, keyLabel, normalizeBindings, actionForKey, rebind, createEditor };
})();
