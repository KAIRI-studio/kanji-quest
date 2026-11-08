/* CASTOR analytics: fail closed until the owner supplies a GA4 measurement ID. */
(function () {
  'use strict';
  if (window.castorAnalytics) return;
  const script = document.currentScript;
  const site = script && script.dataset.site;
  const excludedKey = 'castor_analytics_excluded_v1';
  const query = new URLSearchParams(location.search);
  // Embedded showcases and review URLs are not real visits or game starts.
  const preview = window.self !== window.top || Array.from(query.keys()).some(function (key) {
    return key.startsWith('preview-') || key === 'screen-review';
  });
  if (preview) {
    window.castorAnalytics = {event: function () {}};
    return;
  }
  let excluded = false;
  let family = '';
  try {
    if (query.get('analytics-exclude') === '1') localStorage.setItem(excludedKey, '1');
    if (query.get('analytics-exclude') === '0') localStorage.removeItem(excludedKey);
    excluded = localStorage.getItem(excludedKey) === '1';
    const slot = localStorage.getItem('castor_analytics_family_v1');
    if (['owner_pc', 'owner_iphone', 'son_iphone'].includes(slot)) family = slot;
  } catch (_) { excluded = query.get('analytics-exclude') === '1'; }
  let id = '', ready = false, queue = [];
  const allowed = new Set(['game_start', 'game_open', 'select_game', 'view_game_guide']);
  const gameIds = new Set(['kuku-collect', 'kanji-quest', 'cactus-factory', 'sengoku-yokai']);
  function event(name, details) {
    const gameId = details && gameIds.has(details.game_id) ? details.game_id : null;
    if (excluded || !allowed.has(name)) return;
    if (!ready) { if (queue.length < 20) queue.push({name: name, game_id: gameId}); return; }
    if (id) {
      const params = {send_to: id, castor_site: site, transport_type: 'beacon'};
      if (gameId) params.game_id = gameId;
      if (family) params.castor_family_slot = family;
      window.gtag('event', name, params);
    }
  }
  window.castorAnalytics = {event: event};
  // Record only known game destinations, never link text, queries or player data.
  if (site === 'castor') document.addEventListener('click', function (e) {
    const link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!link) return;
    let url;
    try { url = new URL(link.href, location.href); } catch (_) { return; }
    if (url.origin !== 'https://kairi-studio.github.io') return;
    const game = url.pathname.match(/^\/(kuku-collect|kanji-quest|cactus-factory|sengoku-yokai)\/(?:index\.html)?$/);
    const guide = url.pathname.match(/^\/castor\/(kuku-collect|kanji-quest|cactus-factory|sengoku-yokai)\.html$/);
    if (game) event('select_game', {game_id: game[1]});
    else if (guide) event('view_game_guide', {game_id: guide[1]});
  });

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
      try { const r = new URL(document.referrer); referrer = r.origin; } catch (_) {}
      window.gtag('event', 'page_view', {
        send_to: id, page_location: location.origin + location.pathname,
        page_referrer: referrer, page_title: document.title, castor_site: site,
        ...(family ? {castor_family_slot: family} : {})
      });
      const tag = document.createElement('script');
      tag.async = true;
      tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
      document.head.appendChild(tag);
      ready = true;
      queue.splice(0).forEach(function (item) { event(item.name, item); });
      if (site !== 'castor') event('game_open');
    }).catch(function () {}).finally(function () { clearTimeout(timeout); queue = []; ready = true; });
})();
