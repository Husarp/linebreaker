(function (root) {
    const presets = ['#ff718d', '#ffcc64', '#56e6af', '#62bdff', '#b494ff'];
    const normalizeHex = value => typeof value === 'string' && value.length === 7 && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : null;
    const clamp = value => Math.min(1, Math.max(0, value));

    function hexToHsv(hex) {
        const [red, green, blue] = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
        const value = Math.max(red, green, blue);
        const delta = value - Math.min(red, green, blue);
        let hue = 0;
        if (delta) {
            if (value === red) hue = (green - blue) / delta;
            else if (value === green) hue = 2 + (blue - red) / delta;
            else hue = 4 + (red - green) / delta;
        }
        return { hue: (hue * 60 + 360) % 360, saturation: value ? delta / value : 0, value };
    }

    function hsvToHex({ hue, saturation, value }) {
        const sector = ((hue % 360 + 360) % 360) / 60;
        const chroma = value * saturation;
        const intermediate = chroma * (1 - Math.abs(sector % 2 - 1));
        const base = value - chroma;
        const rgb = [[chroma, intermediate, 0], [intermediate, chroma, 0], [0, chroma, intermediate],
            [0, intermediate, chroma], [intermediate, 0, chroma], [chroma, 0, intermediate]][Math.floor(sector)];
        return '#' + rgb.map(channel => Math.round((channel + base) * 255).toString(16).padStart(2, '0')).join('');
    }

    function colorHistory(existing, newest = []) {
        const history = new Set();
        for (const colors of [newest, existing]) {
            if (!Array.isArray(colors)) continue;
            for (const color of colors) {
                const hex = normalizeHex(color);
                if (hex) history.add(hex);
                if (history.size === presets.length) return [...history];
            }
        }
        return [...history];
    }

    function harmoniousPalette(random = Math.random) {
        const base = Math.floor(random() * 360);
        const harmonies = [
            [-48, -32, -16, 0, 16, 32, 48],
            [-24, 0, 24, 145, 163, 197, 215],
            [-14, 0, 18, 108, 132, 225, 255],
        ];
        const hues = harmonies[Math.floor(random() * harmonies.length)];
        const saturations = [.72, .52, .83, .61, .75, .48, .87];
        const values = [.89, .99, .82, .97, .86, 1, .92];
        return hues.map((offset, index) => hsvToHex({ hue: base + offset, saturation: saturations[index], value: values[index] }));
    }

    function pieceSvg(matrix) {
        const rows = matrix.filter(row => row.some(Boolean));
        const cells = rows.flatMap((row, rowIndex) => row.map((cell, column) => cell
            ? `<rect x="${column * 10 + .5}" y="${rowIndex * 10 + .5}" width="9" height="9" rx="1"/>` : ''));
        return `<svg viewBox="0 0 ${rows[0].length * 10} ${rows.length * 10}" aria-hidden="true">${cells.join('')}</svg>`;
    }

    function open({ id, title, color, history, pieces, onApply }) {
        const previousFocus = document.activeElement;
        document.getElementById(id)?.remove();
        const dialog = document.createElement('dialog');
        dialog.id = id;
        dialog.className = 'lb-color-dialog lb-modal';
        dialog.setAttribute('aria-labelledby', `${id}-title`);
        const draft = pieces?.map(piece => piece.color);
        const edited = new Set();
        let selected = 0;
        let hsv;
        let activePointer;

        function drawPiece({ name, matrix }) {
            return `<button type="button" class="lb-block-btn lb-color-piece" aria-label="${name} piece" aria-pressed="false">
                ${pieceSvg(matrix)}
                <span aria-hidden="true">${name}</span>
            </button>`;
        }

        function swatches(colors) {
            return colors.map(hex => `<button type="button" class="lb-btn lb-btn--ghost lb-color-swatch" data-color="${hex}" aria-label="Use ${hex}" data-control-tip="${hex}" style="--swatch:${hex}"></button>`).join('');
        }

        dialog.innerHTML = `<div class="lb-color-content lb-scroll-fade">
            <header class="lb-color-header">
                <h2 id="${id}-title">${title}</h2>
                <button type="button" class="lb-block-btn lb-block-btn--icon lb102-picker-close" aria-label="Close"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
            </header>
            ${pieces ? `<div class="lb-color-piece-header">
                <span class="lb-color-label"></span>
                <button type="button" class="lb-block-info-icon lb-color-info" aria-label="Palette help" aria-expanded="false" aria-controls="${id}-help"></button>
            </div>
            <p id="${id}-help" class="lb-color-hint" hidden>Click a piece to change its colour.</p>
            <div class="lb-color-pieces" role="group" aria-label="Piece colours">${pieces.map(drawPiece).join('')}</div>` : ''}
            <div class="lb-color-controls">
                <div class="lb-color-plane" role="group" tabindex="0" aria-label="Saturation and brightness" aria-describedby="${id}-plane-help">
                    <span class="lb-color-marker" aria-hidden="true"></span>
                </div>
                <span class="lb-color-sr" id="${id}-plane-help">Use left and right to change saturation, and up and down to change brightness.</span>
                <label class="lb-color-hue-label">Hue
                    <input class="lb-slider lb-color-hue" type="range" min="0" max="360" step="1">
                </label>
                <div class="lb-color-hex-row">
                    <label for="${id}-hex">Hex</label>
                    <input class="lb-color-hex" id="${id}-hex" type="text" placeholder="#rrggbb" autocomplete="off" spellcheck="false" aria-describedby="${id}-hex-error">
                    <span class="lb-color-preview" aria-hidden="true"></span>
                </div>
                <p id="${id}-hex-error" class="lb-color-error" role="status" hidden>Enter a colour as #rrggbb.</p>
            </div>
            ${pieces ? `<div class="lb-color-actions">
                <button type="button" class="lb-block-btn lb-color-random">Random</button>
                <button type="button" class="lb-block-btn lb-color-all">Apply to all pieces</button>
            </div>` : ''}
            <div class="lb-color-presets">
                <p id="${id}-recent" class="lb-color-label">Recent colours</p>
                <div class="lb-color-swatches" role="group" aria-labelledby="${id}-recent">${swatches(colorHistory(history)) || '<span class="lb-color-hint">No colours used yet</span>'}</div>
                <p id="${id}-presets" class="lb-color-label">Curated colours</p>
                <div class="lb-color-swatches" role="group" aria-labelledby="${id}-presets">${swatches(presets)}</div>
            </div>
        </div>
        <div class="lb-color-footer">
            <button type="button" class="lb-block-btn lb-block-btn--primary lb-color-apply">${pieces ? 'Apply palette' : 'Apply colour'}</button>
        </div>`;

        const find = selector => dialog.querySelector(selector);
        const plane = find('.lb-color-plane');
        const hue = find('.lb-color-hue');
        const hexInput = find('.lb-color-hex');
        const preview = find('.lb-color-preview');
        const apply = find('.lb-color-apply');
        const applyAll = find('.lb-color-all');
        const pieceButtons = [...dialog.querySelectorAll('.lb-color-piece')];
        const info = find('.lb-color-info');
        const hexError = find('.lb-color-error');
        let currentColor;

        function setInvalid(invalid) {
            hexInput.setAttribute('aria-invalid', String(invalid));
            hexError.hidden = !invalid;
            apply.disabled = invalid;
            if (applyAll) applyAll.disabled = invalid;
        }

        function renderColor(hex, updateInput = true) {
            currentColor = hex;
            plane.style.setProperty('--picker-hue', `hsl(${hsv.hue} 100% 50%)`);
            plane.style.setProperty('--picker-x', `${hsv.saturation * 100}%`);
            plane.style.setProperty('--picker-y', `${(1 - hsv.value) * 100}%`);
            preview.style.setProperty('--swatch', hex);
            hue.value = Math.round(hsv.hue);
            if (updateInput) hexInput.value = hex;
            setInvalid(false);
        }

        function showColor(hex) {
            hsv = hexToHsv(hex);
            renderColor(hex);
        }

        function editPiece(index, hex) {
            draft[index] = hex;
            pieceButtons[index].style.setProperty('--piece-color', hex);
            edited.delete(index);
            edited.add(index);
        }

        function editColor(hex, updateInput) {
            renderColor(hex, updateInput);
            if (draft) editPiece(selected, hex);
        }

        function selectPiece(index) {
            selected = index;
            pieceButtons.forEach((button, buttonIndex) => button.setAttribute('aria-pressed', String(buttonIndex === index)));
            find('.lb-color-piece-header .lb-color-label').textContent = `Editing ${pieces[index].name} piece`;
            showColor(draft[index]);
        }

        function setPlaneFromPointer(event) {
            const bounds = plane.getBoundingClientRect();
            hsv.saturation = clamp((event.clientX - bounds.left) / bounds.width);
            hsv.value = 1 - clamp((event.clientY - bounds.top) / bounds.height);
            editColor(hsvToHex(hsv));
        }

        plane.addEventListener('pointerdown', event => {
            if (event.button !== 0 || activePointer !== undefined) return;
            activePointer = event.pointerId;
            plane.setPointerCapture(event.pointerId);
            setPlaneFromPointer(event);
        });
        plane.addEventListener('pointermove', event => {
            if (activePointer !== undefined && event.pointerId === activePointer) setPlaneFromPointer(event);
        });
        plane.addEventListener('lostpointercapture', () => { activePointer = undefined; });
        plane.addEventListener('keydown', event => {
            const step = event.shiftKey ? .1 : .01;
            if (event.key === 'ArrowLeft') hsv.saturation = clamp(hsv.saturation - step);
            else if (event.key === 'ArrowRight') hsv.saturation = clamp(hsv.saturation + step);
            else if (event.key === 'ArrowDown') hsv.value = clamp(hsv.value - step);
            else if (event.key === 'ArrowUp') hsv.value = clamp(hsv.value + step);
            else return;
            event.preventDefault();
            editColor(hsvToHex(hsv));
        });
        hue.addEventListener('input', () => {
            hsv.hue = Number(hue.value);
            editColor(hsvToHex(hsv));
        });
        hexInput.addEventListener('input', () => {
            const hex = normalizeHex(hexInput.value);
            if (!hex) { setInvalid(true); return; }
            hsv = hexToHsv(hex);
            editColor(hex, false);
        });
        dialog.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => {
            const hex = button.dataset.color;
            hsv = hexToHsv(hex);
            editColor(hex);
        }));

        if (pieces) {
            pieceButtons.forEach((button, index) => {
                button.style.setProperty('--piece-color', draft[index]);
                button.addEventListener('click', () => selectPiece(index));
            });
            info.addEventListener('click', () => {
                const help = document.getElementById(`${id}-help`);
                help.hidden = !help.hidden;
                info.setAttribute('aria-expanded', String(!help.hidden));
            });
            find('.lb-color-random').addEventListener('click', () => {
                harmoniousPalette().forEach((hex, index) => editPiece(index, hex));
                editPiece(selected, draft[selected]);
                selectPiece(selected);
            });
            applyAll.addEventListener('click', () => {
                draft.forEach((_, index) => editPiece(index, currentColor));
            });
            selectPiece(selected);
        } else {
            showColor(color);
        }

        find('[aria-label="Close"]').addEventListener('click', () => dialog.close());
        apply.addEventListener('click', () => {
            if (apply.disabled) return;
            const recent = draft ? [...edited].reverse().map(index => draft[index]) : [currentColor];
            onApply(draft || currentColor, recent);
            dialog.close();
        });
        let pointerOnBackdrop = false;
        dialog.addEventListener('pointerdown', event => { pointerOnBackdrop = event.target === dialog; });
        dialog.addEventListener('click', event => {
            if (pointerOnBackdrop && event.target === dialog) dialog.close();
        });
        dialog.addEventListener('close', () => {
            dialog.remove();
            const replacement = previousFocus?.id && document.getElementById(previousFocus.id);
            (previousFocus?.isConnected ? previousFocus : replacement)?.focus?.();
        });
        document.body.append(dialog);
        dialog.showModal();
        (pieceButtons[0] || plane).focus({ preventScroll: true });
    }

    root.LBColorPicker = { normalizeHex, hexToHsv, hsvToHex, colorHistory, harmoniousPalette, pieceSvg, open };
})(globalThis);
