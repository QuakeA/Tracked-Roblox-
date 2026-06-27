// avatar_cost.js — Tracked v1.9.5
// Avatar editöründe ÜSTÜNDEKİ (giyili) item'ların TOPLAM Robux değerini gösterir.
// Avatar önizlemesinin hemen altına native görünümlü bir ibare enjekte eder, canlı güncellenir.
// Standalone IIFE — reconnect_overlay.js pattern'i.

(function () {
  'use strict';
  if (window._trackedOutfitCostSetup) return; // çift yükleme koruması
  window._trackedOutfitCostSetup = true;

  const STYLE_ID = 'tracked-outfit-cost-style';
  const LABEL_ID = 'tracked-outfit-cost';
  const priceCache = new Map();          // assetId -> { price:Number|null }
  let debounce = null;
  let lastIdsKey = '';                   // gereksiz yeniden hesabı önler
  let busy = false;

  // ── Robux ikonu (inline SVG — Roblox sprite'ına bağımlı değil) ──
  const ROBUX_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true" style="flex-shrink:0"><path d="M5.5 5.5h13v13h-13z" fill="none"/><path d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm3.2 5.2v7.6h2.1v-2.6h1.1l1.5 2.6h2.4l-1.8-3a2.3 2.3 0 0 0 1.3-2.2c0-1.6-1.2-2.4-3-2.4H9.2Zm2.1 1.7h1c.8 0 1.2.3 1.2.9s-.4.9-1.2.9h-1V9.9Z"/></svg>`;

  // ── Sadece avatar editör sayfasında çalış ──
  function onAvatarPage() {
    return /^\/(my\/avatar|users\/\d+\/avatar)/.test(location.pathname) ||
           !!document.getElementById('avatar-web-app') ||
           !!document.querySelector('.avatar-back');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${LABEL_ID}{
        display:flex;align-items:center;gap:8px;
        margin:10px 0 6px;padding:9px 12px;
        border-radius:10px;
        background:rgba(12,13,18,.62);
        border:1px solid rgba(255,255,255,.12);
        font-family:"Builder Sans","Gotham SSm",Helvetica,Arial,sans-serif;
        backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
        box-shadow:0 2px 10px rgba(0,0,0,.3);
        box-sizing:border-box;
      }
      #${LABEL_ID} .toc-icon{
        width:24px;height:24px;border-radius:7px;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        background:rgba(255,255,255,.12);color:#fff;
      }
      #${LABEL_ID} .toc-main{display:flex;flex-direction:column;min-width:0;line-height:1.25;}
      #${LABEL_ID} .toc-label{font-size:10px;letter-spacing:.4px;text-transform:uppercase;color:rgba(255,255,255,.72);text-shadow:0 1px 2px rgba(0,0,0,.5);}
      #${LABEL_ID} .toc-value{display:flex;align-items:center;gap:4px;font-size:15px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.55);}
      #${LABEL_ID} .toc-value .toc-rbx{display:inline-flex;align-items:center;}
      #${LABEL_ID} .toc-sub{font-size:10.5px;color:rgba(255,255,255,.7);margin-left:auto;text-align:right;flex-shrink:0;text-shadow:0 1px 2px rgba(0,0,0,.5);}
      #${LABEL_ID}.toc-loading .toc-value{opacity:.5;}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // Current user ID — DOM'daki profil linkinden (/users/{id}/profile)
  function getCurrentUserId() {
    const a = document.querySelector('a[href*="/users/"][href*="/profile"]');
    if (a) { const m = (a.getAttribute('href') || '').match(/\/users\/(\d+)/); if (m) return m[1]; }
    // fallback: avatar headshot linki
    const a2 = document.querySelector('a[href*="/users/"]');
    if (a2) { const m = (a2.getAttribute('href') || '').match(/\/users\/(\d+)/); if (m) return m[1]; }
    return null;
  }

  // Veriyi service worker'dan al (CORS bypass) — { ok, ids, prices }
  function fetchCostData(userId) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ action: 'trackedAvatarCost', userId }, resp => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(resp || null);
        });
      } catch (_) { resolve(null); }
    });
  }

  function fmt(n) { return n.toLocaleString('en-US'); }

  function mountPoint() {
    // Avatar önizlemesinin (.avatar-back) hemen altı — Body Type slider'ından önce
    return document.querySelector('.left-wrapper .avatar-back') ||
           document.querySelector('.avatar-back') ||
           document.querySelector('.left-wrapper .section-content');
  }

  function ensureLabel() {
    let el = document.getElementById(LABEL_ID);
    if (el) return el;
    const anchor = mountPoint();
    if (!anchor) return null;
    el = document.createElement('div');
    el.id = LABEL_ID;
    el.innerHTML = `
      <div class="toc-icon"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg></div>
      <div class="toc-main">
        <span class="toc-label">Üzerindekiler</span>
        <span class="toc-value"><span class="toc-rbx"><svg width="1em" height="1em" viewBox="0 0 28 28" fill="currentColor" fill-rule="evenodd" style="display:block"><path d="M23.402,5.571 C25.009,6.499 26,8.215 26,10.071 L26,17.927 C26,19.784 25.009,21.499 23.402,22.427 L16.597,26.356 C14.99,27.284 13.009,27.284 11.402,26.356 L4.597,22.427 C2.99,21.499 2,19.784 2,17.927 L2,10.071 C2,8.215 2.99,6.499 4.597,5.571 L11.402,1.643 C13.009,0.715 14.99,0.715 16.597,1.643 L23.402,5.571 Z M12.313,3.426 L5.686,7.252 C4.642,7.855 4,8.968 4,10.174 L4,17.825 C4,19.03 4.642,20.144 5.686,20.747 L12.313,24.572 C13.357,25.175 14.642,25.175 15.686,24.572 L22.313,20.747 C23.357,20.144 24,19.03 24,17.825 L24,10.174 C24,8.968 23.357,7.855 22.313,7.252 L15.686,3.426 C14.642,2.823 13.357,2.823 12.313,3.426 L12.313,3.426 Z M15.385,5.564 L20.614,8.582 C21.471,9.077 22,9.992 22,10.983 L22,17.02 C22,18.01 21.471,18.925 20.614,19.42 L15.385,22.439 C14.528,22.934 13.471,22.934 12.614,22.439 L7.385,19.42 C6.528,18.925 6,18.01 6,17.02 L6,10.983 C6,9.992 6.528,9.077 7.385,8.582 L12.614,5.564 C13.471,5.069 14.528,5.069 15.385,5.564 L15.385,5.564 Z M11,17.001 L17,17.001 L17,11.001 L11,11.001 L11,17.001 Z"/></svg></span><span class="toc-num">—</span></span>
      </div>
      <span class="toc-sub"></span>`;
    // .avatar-back'in altına; yoksa section-content'in başına
    if (anchor.classList.contains('avatar-back')) anchor.insertAdjacentElement('afterend', el);
    else anchor.insertAdjacentElement('afterbegin', el);
    return el;
  }

  function setLabel(total, offsale, count, loading) {
    const el = ensureLabel();
    if (!el) return;
    el.classList.toggle('toc-loading', !!loading);
    const numEl = el.querySelector('.toc-num');
    const subEl = el.querySelector('.toc-sub');
    if (numEl) numEl.textContent = fmt(total);
    if (subEl) {
      const parts = [`${count} parça`];
      if (offsale > 0) parts.push(`${offsale} satışta değil`);
      subEl.textContent = parts.join(' · ');
    }
  }

  async function recompute() {
    if (!onAvatarPage()) return;
    // ÖNCE mount et — .avatar-back hazır değilse observer tekrar dener.
    const el = ensureLabel();
    if (!el) return;
    if (busy) return;
    busy = true;
    try {
      const userId = getCurrentUserId();
      const numEl = el.querySelector('.toc-num');
      const subEl = el.querySelector('.toc-sub');
      if (!userId) {
        if (numEl) numEl.textContent = '—';
        if (subEl) subEl.textContent = 'kullanıcı bulunamadı';
        el.classList.remove('toc-loading'); busy = false; return;
      }
      const resp = await fetchCostData(userId);
      if (!resp || !resp.ok) {
        if (numEl) numEl.textContent = '—';
        if (subEl) subEl.textContent = 'değer alınamadı';
        el.classList.remove('toc-loading'); busy = false; return;
      }
      const ids = resp.ids || [];
      const key = ids.slice().sort().join(',');
      if (key === lastIdsKey) { busy = false; return; }
      lastIdsKey = key;
      // Toplam değer + satışta-değil sayısı SW'de hesaplanır (BUNDLE-farkında: karakter/gövde
      // bundle'ları tek tek satılmaz → bundle fiyatı bir kez sayılır; limited resale floor dahil).
      setLabel(resp.total || 0, resp.offsale || 0, ids.length, false);
    } catch (_) { /* sessiz */ }
    busy = false;
  }

  // Değişiklik algılanınca: önce mutasyonlar DURSUN (settle 500ms), sonra BURST
  // (avatar editörü değişikliği ~1-2sn sonra sunucuya kaydeder; tek fetch eski
  // veriyi alır). Burst birkaç gecikmeyle tekrar hesaplar — lastIdsKey guard'ı
  // sayesinde sadece YENİ veri geldiğinde UI güncellenir. Burst, settle'dan sonra
  // başlar ve mutasyonlarla resetlenmez (sürekli mutasyonda kilitlenmeyi önler).
  let _settleTimer = null, _burst = [];
  function schedule() {
    clearTimeout(_settleTimer);
    _settleTimer = setTimeout(() => {
      _burst.forEach(t => clearTimeout(t));
      _burst = [0, 1500, 3000].map(ms => setTimeout(recompute, ms));
    }, 500);
  }

  function init() {
    if (!onAvatarPage()) {
      // SPA: avatar sayfasına sonradan gelinirse yakala
      const navObs = new MutationObserver(() => {
        if (onAvatarPage()) { navObs.disconnect(); start(); }
      });
      navObs.observe(document.body, { childList: true, subtree: true });
      // URL değişimini de poll et (Roblox pushState)
      let lastPath = location.pathname;
      setInterval(() => {
        if (location.pathname !== lastPath) {
          lastPath = location.pathname;
          if (onAvatarPage()) start();
        }
      }, 1000);
      return;
    }
    start();
  }

  function start() {
    injectStyles();
    recompute();
    // Equip/unequip → DOM değişir → debounce ile yeniden hesapla
    const obs = new MutationObserver(() => schedule());
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
