/* Optional Metricool page statistics. Form data and files are never read here. */
(() => {
  'use strict';
  const KEY = 'kramurai-statistics-v1';
  const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
  let choice = null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.version === 1 && ['allow', 'deny'].includes(saved.choice)
      && typeof saved.updatedAt === 'number' && saved.updatedAt <= Date.now()
      && Date.now() - saved.updatedAt < MAX_AGE) choice = saved.choice;
  } catch (_) { /* Without storage, a choice applies to this page only. */ }

  const privacySignal = navigator.globalPrivacyControl === true
    || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  let sent = false, loading = false, trackerScript;

  function track() {
    if (choice !== 'allow' || privacySignal || sent || loading
      || location.hostname !== 'kramurai.github.io' || location.protocol !== 'https:') return;
    // The vendor transmits the full page/referrer URL. Skip possibly personal URL values.
    if (location.search) return;
    if (location.hash && !document.getElementById(location.hash.slice(1))) return;
    if (document.referrer) {
      try {
        const ref = new URL(document.referrer);
        if (ref.search || ref.hash) return;
      } catch (_) { return; }
    }
    const send = () => {
      loading = false;
      if (choice !== 'allow' || privacySignal || sent || !window.beTracker) return;
      sent = true;
      window.beTracker.t({hash: '3f7b01db1a0d12bb36bbbba02f0f3ca2'});
    };
    if (window.beTracker) return send();
    loading = true;
    trackerScript = document.createElement('script');
    trackerScript.src = 'https://tracker.metricool.com/resources/be.js';
    trackerScript.async = true;
    trackerScript.referrerPolicy = 'strict-origin';
    trackerScript.onload = send;
    trackerScript.onerror = () => { loading = false; trackerScript.remove(); };
    document.head.appendChild(trackerScript);
  }

  const panel = document.createElement('aside');
  panel.className = 'statistics-panel screen-only';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'statistics-heading');
  panel.innerHTML = '<h2 id="statistics-heading">Freiwillige Besuchsstatistik</h2>'
    + '<p>Metricool zählt mit deiner Zustimmung Seitenaufrufe und Herkunftslinks. '
    + 'Dafür erhält Metricool deine IP-Adresse und Fenstergröße. Eingaben und Fotos bleiben lokal. '
    + 'Alle Helfer funktionieren ohne Statistik. <a href="/datenschutz/#besuchsstatistik">Mehr zum Datenschutz</a></p>'
    + '<p class="statistics-status" role="status"></p>'
    + '<div class="statistics-actions"><button type="button" data-statistics="deny">Ohne Statistik</button>'
    + '<button type="button" data-statistics="allow">Statistik erlauben</button></div>';
  document.body.appendChild(panel);
  const settings = document.createElement('button');
  settings.type = 'button';
  settings.className = 'statistics-settings screen-only';
  settings.textContent = 'Statistik-Einstellungen';
  settings.setAttribute('aria-expanded', 'false');
  panel.id = 'statistics-panel';
  settings.setAttribute('aria-controls', panel.id);
  const footer = document.querySelector('.legal-links, .footer-links') || document.body;
  footer.appendChild(settings);

  function show(moveFocus) {
    panel.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
    panel.querySelector('[data-statistics="allow"]').disabled = privacySignal;
    panel.querySelector('.statistics-status').textContent = privacySignal
      ? 'Dein Browser hat ein Datenschutzsignal aktiviert. Die Statistik bleibt ausgeschaltet.'
      : choice === 'allow' ? 'Statistik ist erlaubt. Du kannst deine Zustimmung hier widerrufen.'
        : choice === 'deny' ? 'Statistik ist ausgeschaltet.' : '';
    if (moveFocus) panel.querySelector('[data-statistics="deny"]').focus();
  }
  function hide() {
    panel.hidden = true;
    settings.setAttribute('aria-expanded', 'false');
  }
  settings.addEventListener('click', () => panel.hidden ? show(true) : hide());
  panel.querySelectorAll('[data-statistics]').forEach(button => button.addEventListener('click', () => {
    choice = button.dataset.statistics;
    try { localStorage.setItem(KEY, JSON.stringify({version: 1, choice, updatedAt: Date.now()})); } catch (_) {}
    if (choice === 'deny' && trackerScript && loading) {
      trackerScript.onload = null;
      trackerScript.remove();
      loading = false;
    }
    hide();
    settings.focus({preventScroll: true});
    track();
  }));
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    // A withdrawal in another tab must stop a pending tracker load here, too.
    try { choice = JSON.parse(event.newValue)?.choice === 'allow' ? 'allow' : 'deny'; }
    catch (_) { choice = 'deny'; }
    if (choice !== 'allow' && trackerScript && loading) {
      trackerScript.onload = null; trackerScript.remove(); loading = false;
    }
  });
  if (choice === null && !privacySignal) show(false);
  track();
})();
