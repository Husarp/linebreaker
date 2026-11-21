(function () {
  const holdTime = 650;
  function newer(candidate, current) {
    if (![candidate, current].every(value => /^\d+\.\d+\.\d+$/.test(value))) return false;
    const parts = current.split('.').map(Number);
    return candidate.split('.').map(Number).map((part, index) => part - parts[index]).find(Boolean) > 0;
  }
  function startupUpgrade(storage, key, version) {
    const previous = storage.getItem(key);
    storage.setItem(key, version);
    return previous && newer(version, previous) ? version : null;
  }
  function attachVersion(version, open) {
    for (const trigger of document.querySelectorAll('[data-update-version]')) {
      trigger.textContent = `Version ${version}`;
      trigger.tabIndex = 0;
      trigger.setAttribute('aria-label', `Version ${version}. Hold to open update diagnostics.`);
      let timer, start;
      const stop = () => { clearTimeout(timer); timer = null; start = null; };
      const begin = () => { if (!timer) timer = setTimeout(() => { stop(); open(); }, holdTime); };
      trigger.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary) return;
        start = [event.clientX, event.clientY];
        begin();
      });
      trigger.addEventListener('pointermove', event => {
        if (start && Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 8) stop();
      });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave', 'keyup', 'blur']) trigger.addEventListener(type, stop);
      trigger.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); begin(); }
      });
      trigger.addEventListener('contextmenu', event => event.preventDefault());
    }
  }
  function dialog(title, markup) {
    const panel = document.createElement('dialog');
    panel.className = 'lb-block-panel lb149-dialog lb-scroll-fade';
    panel.setAttribute('aria-label', title);
    panel.innerHTML = '<h2 class="lb-topbar-title"></h2>' + markup;
    panel.querySelector('h2').textContent = title;
    panel.querySelector('[data-close]')?.addEventListener('click', () => panel.close());
    panel.addEventListener('keydown', event => event.stopPropagation());
    document.body.append(panel);
    return panel;
  }
  function size(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1048576).toFixed(1)} MiB`;
  }
  function showNotes(version, notes, fallback) {
    const panel = dialog(`What's new in ${version}`, '<p data-notes></p><div class="lb149-actions"><button class="lb-block-btn" data-close>Close</button></div>');
    panel.querySelector('[data-notes]').textContent = notes || 'This version is installed. See GitHub for release notes.';
    if (!notes && fallback) {
      const github = document.createElement('button');
      github.className = 'lb-block-btn';
      github.textContent = 'GitHub';
      github.onclick = fallback;
      panel.querySelector('.lb149-actions').append(github);
    }
    panel.addEventListener('close', () => panel.remove(), { once: true });
    panel.showModal();
  }
  async function copy(text, field) {
    try { await navigator.clipboard.writeText(text); }
    catch { field.focus(); field.select(); if (!document.execCommand('copy')) throw new Error('Copy failed'); }
  }
  window.LBUpdateTools = { newer, startupUpgrade, attachVersion, dialog, size, showNotes, copy };
})();
