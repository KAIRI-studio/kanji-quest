/* CASTOR analytics: fail closed until the owner supplies a GA4 measurement ID. */
(function () {
  'use strict';
  if (window.castorAnalytics) return;
  const script = document.currentScript;
  const site = script && script.dataset.site;
  const excludedKey = 'castor_analytics_excluded_v1';
  const query = new URLSearchParams(location.search);
  let excluded = false;
  try {
    if (query.get('analytics-exclude') === '1') localStorage.setItem(excludedKey, '1');
    if (query.get('analytics-exclude') === '0') localStorage.removeItem(excludedKey);
    excluded = localStorage.getItem(excludedKey) === '1';
  } catch (_) { excluded = query.get('analytics-exclude') === '1'; }
  let id = '', ready = false, queue = [];
  const allowed = new Set(['game_start', 'game_open']);
  function event(name) {
    if (excluded || !allowed.has(name)) return;
    if (!ready) { if (queue.length < 20) queue.push(name); return; }
    if (id) window.gtag('event', name, {send_to: id, castor_site: site});
  }
  window.castorAnalytics = {event: event};

  if (excluded || !site || navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 5000);
  fetch('https://kairi-studio.github.io/castor/analytics-config.json', {cache:'no-store', signal:controller.signal})
    .then(function (r) { if (!r.ok) throw new Error('config'); return r.json(); })
    .then(function (config) {
      if (excluded) return;
      if (!/^G-[A-Z0-9]+$/.test(config.measurement_id || '')) return;
      id = config.measurement_id;
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', id, {
        send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, cookie_path: '/',
        cookie_flags: 'SameSite=Lax;Secure'
      });
      // Never transmit query parameters, fragment identifiers or player data.
      let referrer = '';
      try { const r = new URL(document.referrer); referrer = r.origin + r.pathname; } catch (_) {}
      window.gtag('event', 'page_view', {
        send_to: id, page_location: location.origin + location.pathname,
        page_referrer: referrer, page_title: document.title, castor_site: site
      });
      const tag = document.createElement('script');
      tag.async = true;
      tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
      document.head.appendChild(tag);
      ready = true;
      queue.splice(0).forEach(event);
      if (site !== 'castor') event('game_open');
    }).catch(function () {}).finally(function () { clearTimeout(timeout); queue = []; ready = true; });
})();
