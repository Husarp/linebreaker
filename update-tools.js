(function () {
  const holdTime = 650;
  const releaseNotes = {
    '1.1.3': 'Settings opens to a category menu, with a separate Notifications page for game reminders.\nTop notices and Inventory now respect the camera cutout.',
    '1.1.2': 'Settings now has tabs and a permanent What’s new section.\nMission Swap works on phones again, and Missions and Season use rarity crate art.\nMenu screens open faster. Android uses the Linebreaker icon for update notifications.',
    '1.1.1': 'Removed falling background blocks and Supply Drops. Completed rank badges now show rank-coloured numbers.',
    '1.1.0': 'Improved phone controls, game-over rewards, music transitions, rank badges, and mission progression.',
  };
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
    panel.dataset.releaseNotes = '';
    panel.querySelector('[data-notes]').textContent = notes || 'This version is installed. See GitHub for release notes.';
    if (!notes && fallback) {
      const github = document.createElement('button');
      github.className = 'lb-block-btn';
      github.textContent = 'GitHub';
      github.onclick = fallback;
      panel.querySelector('.lb149-actions').append(github);
    }
    if (document.getElementById('settings-whats-new')) {
      const settings = document.createElement('button');
      settings.className = 'lb-block-btn';
      settings.textContent = 'Open Settings → Updates';
      settings.onclick = () => { panel.close(); window.openSettings(false, 'updates'); };
      panel.querySelector('.lb149-actions').append(settings);
    }
    panel.addEventListener('close', () => panel.remove(), { once: true });
    panel.showModal();
  }

  const sources = new Map();
  const dismissed = new Set();
  let banner, showing, swipe;
  const getLabel = (version, ready = false) => `${ready ? 'Install' : 'Download'} update ${version}`;
  const githubIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.09c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.99 0 0 .95-.3 3.08 1.16a10.7 10.7 0 0 1 5.61 0c2.14-1.46 3.08-1.16 3.08-1.16.61 1.56.23 2.71.11 2.99.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.28-5.15 5.56.4.35.76 1.03.76 2.08v3.1c0 .3.21.64.77.53A11.2 11.2 0 0 0 12 .8Z"/></svg>';
  const statusMarkup = '<div class="lb184-status"><span data-status></span> <span data-percent></span></div><progress class="lb-block-progress" aria-label="Update download progress" max="100" hidden></progress>';
  function setStatus(container, text, percent) {
    const status = container.querySelector('[data-status]');
    const digits = container.querySelector('[data-percent]');
    const progress = container.querySelector('progress');
    const value = Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.floor(percent))) : null;
    if (status.textContent !== text) status.textContent = text;
    const label = value === null ? '' : `${value}%`;
    if (digits.textContent !== label) digits.textContent = label;
    progress.hidden = percent === undefined;
    if (value === null) progress.removeAttribute('value'); else if (progress.value !== value || !progress.hasAttribute('value')) progress.value = value;
  }
  function closeNotice() {
    if (!showing) return;
    dismissed.add(showing.key);
    showing.dismiss?.();
    showing = null;
    renderNotice();
  }
  function notices(source, items) {
    sources.set(source, items.filter(Boolean));
    renderNotice();
  }
  function queueNotice(source, item) {
    const pending = (sources.get(source) || []).filter(entry => !dismissed.has(entry.key));
    notices(source, [...pending, item]);
  }
  function renderNotice() {
    if (!banner) {
      banner = document.createElement('aside');
      banner.className = 'lb-block-panel lb184-banner';
      banner.setAttribute('aria-label', 'Update notice');
      banner.innerHTML = `<svg class="lb184-notice-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#lb-icon-update"/></svg>
        <div class="lb184-notice-copy"><div role="status"><strong data-title></strong><p data-detail></p></div>${statusMarkup}<div class="lb149-actions" data-actions></div></div>
        <button type="button" class="lb-block-btn lb-block-back" data-dismiss aria-label="Dismiss update notice">✕</button>`;
      banner.querySelector('[data-dismiss]').onclick = closeNotice;
      banner.addEventListener('pointerdown', event => {
        swipe = event.target.closest('button') ? null : event.clientY;
        if (swipe !== null) banner.setPointerCapture?.(event.pointerId);
      });
      banner.addEventListener('pointerup', event => { if (swipe != null && swipe - event.clientY > 35) closeNotice(); swipe = null; });
      banner.addEventListener('pointercancel', () => { swipe = null; });
      document.body.append(banner);
    }
    const queue = [...sources.values()].flat().filter(item => !dismissed.has(item.key));
    const item = queue.find(entry => entry.key === showing?.key) || queue[0];
    banner.hidden = !item;
    if (!item) { showing = null; return; }
    if (showing?.key !== item.key) {
      banner.dataset.notice = item.key;
      banner.getAnimations?.().forEach(animation => animation.cancel());
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        banner.animate?.([{ transform: 'translateY(-110%)', opacity: 0 }, { transform: 'none', opacity: 1 }], 220);
      }
      banner.querySelector('[data-title]').textContent = item.title;
      banner.querySelector('[data-detail]').textContent = item.text || '';
      banner.querySelector('[data-actions]').replaceChildren(...(item.actions || []).map(([label, action], index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `lb-block-btn${index === 0 ? ' lb-block-btn--primary' : ''}`;
        button.textContent = label;
        button.onclick = () => { closeNotice(); action(); };
        return button;
      }));
    }
    setStatus(banner, '', item.percent);
    showing = item;
  }
  function setReleaseNotes(version, suppliedNotes, fallback) {
    const section = document.getElementById('settings-whats-new');
    if (!section || !version) return;
    const entries = { ...releaseNotes, [version]: releaseNotes[version] || suppliedNotes || 'This version is installed.' };
    const older = Object.keys(entries).filter(other => newer(version, other));
    const key = JSON.stringify([version, entries[version]]);
    if (section.dataset.release === key) return;
    section.dataset.release = key;
    section.innerHTML = `<h2 class="settings-title">What's new</h2><div class="lb149-latest-note"></div>`;
    const add = (container, entry) => {
      const heading = document.createElement('h3');
      heading.textContent = `Version ${entry}`;
      const text = document.createElement('p');
      text.textContent = entries[entry];
      container.append(heading, text);
    };
    add(section.querySelector('.lb149-latest-note'), version);
    if (older.length) {
      const history = document.createElement('details');
      history.className = 'lb-block-expand lb149-note-history';
      history.innerHTML = '<summary>Show all versions</summary><div class="lb-block-expand-body"></div>';
      older.forEach(entry => add(history.lastElementChild, entry));
      section.append(history);
    }
    if (!releaseNotes[version] && !suppliedNotes && fallback) {
      const link = document.createElement('button');
      link.className = 'lb-block-btn';
      link.textContent = 'Release notes on GitHub';
      link.onclick = fallback;
      section.append(link);
    }
  }

  function showReleaseNotice(version, notes, { upgraded = false, suppressed = false, fallback, preview = false } = {}) {
    const key = `lb149:release-notice:${version}`;
    if (upgraded && !localStorage.getItem(key)) localStorage.setItem(key, 'pending');
    notices('installed', suppressed || (!preview && localStorage.getItem(key) !== 'pending') ? [] : [{
      key, title: 'Update installed', text: `You’re now playing version ${version}.`,
      actions: [["What's new", () => showNotes(version, releaseNotes[version] || notes, fallback)]],
      dismiss: () => { if (!preview) localStorage.setItem(key, 'dismissed'); },
    }]);
  }
  async function copy(text, field) {
    try { await navigator.clipboard.writeText(text); }
    catch { field.focus(); field.select(); if (!document.execCommand('copy')) throw new Error('Copy failed'); }
  }
  window.LBUpdateTools = { newer, startupUpgrade, attachVersion, dialog, size, setReleaseNotes, showReleaseNotice, copy,
    notices, queueNotice, getLabel, githubIcon, statusMarkup, setStatus, showNotes };
  const version = window.BUNDLE?.version;
  setReleaseNotes(version);
  const browser = version && !window.__TAURI__ && window.Capacitor?.getPlatform?.() !== 'android';
  if (browser) {
    const section = document.createElement('section');
    section.className = 'settings-section lb-block-panel lb149-settings';
    section.innerHTML = `<div class="lb149-actions lb184-toolbar"><button type="button" class="lb-block-btn">What's new</button></div><p>Reload the page to pick up browser updates.</p>`;
    section.querySelector('button').onclick = () => showNotes(version, releaseNotes[version]);
    document.getElementById('settings-updates')?.prepend(section);
    if (!new URLSearchParams(location.search).has('demo')) {
      showReleaseNotice(version, null, { upgraded: !!startupUpgrade(localStorage, 'lb149:web', version) });
    }
  }
})();
