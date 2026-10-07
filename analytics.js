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

  function setExcluded(next) {
    try {
      if (next) localStorage.setItem(excludedKey, '1');
      else localStorage.removeItem(excludedKey);
    } catch (_) { return false; }
    excluded = next;
    queue = [];
    if (id) window['ga-disable-' + id] = next;
    return true;
  }
  function addExclusionSetting() {
    const host = site === 'cactus-factory'
      ? document.querySelector('.save-settings')
      : document.querySelector('#nameScreen .name-panel');
    if (!host || document.getElementById('castorAnalyticsSetting')) return;
    const box = document.createElement('div');
    box.id = 'castorAnalyticsSetting';
    box.style.cssText = 'margin:16px 0 4px;padding:14px;border:1px solid currentColor;border-radius:12px;font-size:14px;line-height:1.6;';
    const label = document.createElement('p');
    label.textContent = 'アクセスの かぞえかた（おとな用）';
    label.style.cssText = 'margin:0 0 8px;font-weight:bold;';
    const button = document.createElement('button');
    button.type = 'button';
    button.style.cssText = 'display:block;width:100%;min-height:44px;padding:10px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer;';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.style.cssText = 'margin:8px 0 0;font-size:14px;';
    function render() {
      button.textContent = excluded ? 'この端末の カウントを もどす' : 'この端末を カウントしない';
      button.setAttribute('aria-pressed', String(excluded));
      status.textContent = excluded ? '除外中：この端末では かぞえません。' : 'この端末のアクセスを かぞえます。';
    }
    button.addEventListener('click', function () {
      const next = !excluded;
      if (!setExcluded(next)) {
        status.textContent = '設定を保存できませんでした。もう一度お試しください。';
        return;
      }
      render();
      if (!next) status.textContent = '計測する設定に戻しました。';
    });
    window.addEventListener('storage', function (e) {
      if (e.key !== excludedKey) return;
      excluded = e.newValue === '1';
      queue = [];
      if (id) window['ga-disable-' + id] = excluded;
      render();
    });
    box.append(label, button, status);
    host.appendChild(box);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addExclusionSetting, {once:true});
  else addExclusionSetting();

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
