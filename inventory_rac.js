// inventory_rac.js - Tracked Extension: Envanter RAP Hesaplayici

(function () {
  'use strict';
  if (window._trackedInvRAC) return;
  window._trackedInvRAC = true;

  const PANEL_ID = 'tracked-inv-panel';
  const STYLE_ID = 'tracked-inv-styles';

  // ─── Storage ───────────────────────────────────────────────────────────────
  function storeGet(keys) {
    return new Promise(resolve => {
      try { chrome.storage.local.get(keys, d => resolve(chrome.runtime.lastError ? {} : d)); }
      catch { resolve({}); }
    });
  }
  function storeSet(obj) {
    return new Promise(resolve => {
      try { chrome.storage.local.set(obj, () => resolve()); }
      catch { resolve(); }
    });
  }

  const ICON_BAG  = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.82"><rect x="1.5" y="4" width="10" height="8.5" rx="1.5"/><path d="M4.5 4V3a2 2 0 014 0v1"/></svg>`;
  const ICON_WARN = `<svg width="11" height="10" viewBox="0 0 12 11" fill="none" style="flex-shrink:0;opacity:.85"><path d="M5.268 1.134a.8.8 0 011.464 0l4.8 8.4A.8.8 0 0110.8 10.8H1.2a.8.8 0 01-.732-1.266l4.8-8.4Z" fill="currentColor" opacity=".18"/><path d="M5.268 1.134a.8.8 0 011.464 0l4.8 8.4A.8.8 0 0110.8 10.8H1.2a.8.8 0 01-.732-1.266l4.8-8.4Z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><rect x="5.4" y="4.2" width="1.2" height="3" rx="0.5" fill="currentColor"/><circle cx="6" cy="8.8" r="0.7" fill="currentColor"/></svg>`;
  // Robux ikonu — GERÇEK Roblox SVG path'i (rbxcdn economy_28x28_dark Fill-1). Sprite'a bağımlı DEĞİL.
  // 1em → çevreleyen yazı boyutuyla ölçeklenir; currentColor → metin rengini alır (panelde beyaz).
  const ICON_ROBUX = `<svg width="1em" height="1em" viewBox="0 0 28 28" fill="currentColor" fill-rule="evenodd" style="flex-shrink:0;display:inline-block;vertical-align:-0.12em;margin-right:3px"><path d="M23.402,5.571 C25.009,6.499 26,8.215 26,10.071 L26,17.927 C26,19.784 25.009,21.499 23.402,22.427 L16.597,26.356 C14.99,27.284 13.009,27.284 11.402,26.356 L4.597,22.427 C2.99,21.499 2,19.784 2,17.927 L2,10.071 C2,8.215 2.99,6.499 4.597,5.571 L11.402,1.643 C13.009,0.715 14.99,0.715 16.597,1.643 L23.402,5.571 Z M12.313,3.426 L5.686,7.252 C4.642,7.855 4,8.968 4,10.174 L4,17.825 C4,19.03 4.642,20.144 5.686,20.747 L12.313,24.572 C13.357,25.175 14.642,25.175 15.686,24.572 L22.313,20.747 C23.357,20.144 24,19.03 24,17.825 L24,10.174 C24,8.968 23.357,7.855 22.313,7.252 L15.686,3.426 C14.642,2.823 13.357,2.823 12.313,3.426 L12.313,3.426 Z M15.385,5.564 L20.614,8.582 C21.471,9.077 22,9.992 22,10.983 L22,17.02 C22,18.01 21.471,18.925 20.614,19.42 L15.385,22.439 C14.528,22.934 13.471,22.934 12.614,22.439 L7.385,19.42 C6.528,18.925 6,18.01 6,17.02 L6,10.983 C6,9.992 6.528,9.077 7.385,8.582 L12.614,5.564 C13.471,5.069 14.528,5.069 15.385,5.564 L15.385,5.564 Z M11,17.001 L17,17.001 L17,11.001 L11,11.001 L11,17.001 Z"/></svg>`;
  const ICON_REFRESH = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8a5.5 5.5 0 11-1.61-3.89"/><path d="M13.5 2v3h-3"/></svg>`;
  const ICON_RESCAN = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>`;
  const ICON_COLLAPSE = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 8,11 13,6"/></svg>`;
  const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5dk

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #tracked-inv-panel {
        position: fixed !important; right: 18px !important; top: 50% !important;
        transform: translateY(-50%) !important; z-index: 2147483647 !important;
        width: 320px; background: rgba(11,11,16,0.96) !important;
        backdrop-filter: blur(32px) saturate(1.6) !important;
        -webkit-backdrop-filter: blur(32px) saturate(1.6) !important;
        border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 16px !important;
        color: rgba(255,255,255,0.88) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 12px !important;
        box-shadow: 0 16px 56px rgba(0,0,0,0.70), 0 2px 8px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06) !important;
        user-select: none; overflow: hidden;
      }
      .irac-header { display:flex; align-items:center; justify-content:space-between; padding:11px 13px 10px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.02); }
      .irac-title { font-size:12.5px; font-weight:650; color:rgba(255,255,255,0.95); letter-spacing:0.015em; display:flex; align-items:center; gap:6px; }
      .irac-collapse { background:none !important; border:none !important; color:rgba(255,255,255,0.45) !important; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:6px; transition:color .12s,background .12s,transform .2s; padding:0 !important; }
      .irac-collapse:hover { color:rgba(255,255,255,0.90) !important; background:rgba(255,255,255,0.08) !important; }
      .irac-collapse svg { transition: transform .2s ease; }
      #tracked-inv-panel.collapsed .irac-collapse svg { transform: rotate(180deg); }
      #tracked-inv-panel.collapsed .irac-summary,
      #tracked-inv-panel.collapsed .irac-items,
      #tracked-inv-panel.collapsed .irac-stale,
      #tracked-inv-panel.collapsed .irac-scan-banner,
      #tracked-inv-panel.collapsed .irac-private,
      #tracked-inv-panel.collapsed .irac-diag,
      #tracked-inv-panel.collapsed .irac-more { display:none !important; }
      #tracked-inv-panel.collapsed .irac-header { border-bottom: none !important; }
      .irac-summary { padding:10px 13px; border-bottom:1px solid rgba(255,255,255,0.05); }
      .irac-total { font-size:20px; font-weight:700; letter-spacing:-0.02em; color:rgba(255,255,255,0.95); font-variant-numeric:tabular-nums; margin-bottom:2px; display:flex; align-items:center; gap:4px; }
      .irac-meta { font-size:10.5px; color:rgba(255,255,255,0.35); }
      .irac-items { overflow-y:auto; max-height:520px; padding:6px 0; scrollbar-width:none; -ms-overflow-style:none; }
      .irac-items::-webkit-scrollbar { display:none; width:0; height:0; }
      .irac-item { display:flex; align-items:center; padding:6px 13px; gap:9px; cursor:pointer; text-decoration:none; }
      .irac-item:hover { background:rgba(255,255,255,0.06); }
      .irac-item:hover .irac-name { color:rgba(255,255,255,0.92); }
      .irac-thumb { width:36px; height:36px; border-radius:7px; object-fit:cover; flex-shrink:0; background:rgba(255,255,255,0.06); display:block; }
      .irac-thumb-ph { width:36px; height:36px; border-radius:7px; background:rgba(255,255,255,0.06); flex-shrink:0; display:inline-block; }
      .irac-name { flex:1; min-width:0; font-size:11.5px; color:rgba(255,255,255,0.72); line-height:1.35; word-break:break-word; }
      .irac-rap { font-size:11.5px; font-weight:600; color:rgba(255,255,255,0.90); font-variant-numeric:tabular-nums; flex-shrink:0; white-space:nowrap; display:flex; align-items:center; gap:2px; }
      .irac-value-wrap { display:flex; flex-direction:column; align-items:flex-end; gap:1px; flex-shrink:0; }
      .irac-sub { font-size:9.5px; color:rgba(255,255,255,0.34); font-variant-numeric:tabular-nums; display:flex; align-items:center; gap:3px; }
      .irac-diff { font-size:9px; font-weight:600; padding:1px 4px; border-radius:3px; font-variant-numeric:tabular-nums; }
      .irac-diff.up { color:#30D158; background:rgba(48,209,88,0.10); }
      .irac-diff.dn { color:#FF453A; background:rgba(255,69,58,0.10); }
      .irac-diff.flat { color:rgba(255,255,255,0.40); background:rgba(255,255,255,0.05); }
      .irac-refresh { background:none !important; border:none !important; color:rgba(255,255,255,0.45) !important; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:6px; transition:color .12s,background .12s,transform .4s; padding:0 !important; }
      .irac-refresh:hover { color:rgba(255,255,255,0.90) !important; background:rgba(255,255,255,0.08) !important; }
      .irac-refresh.spinning svg { animation: irac-spin 1s linear infinite; }
      .irac-rescan { background:none !important; border:none !important; color:rgba(255,255,255,0.45) !important; cursor:pointer; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:6px; transition:color .12s,background .12s; padding:0 !important; }
      .irac-rescan:hover { color:rgba(255,255,255,0.90) !important; background:rgba(255,255,255,0.08) !important; }
      .irac-rescan.spinning svg { animation: irac-spin 1s linear infinite; }
      @keyframes irac-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .irac-header-actions { display:flex; align-items:center; gap:2px; }
      .irac-live-badge { font-size:9px; font-weight:600; color:#30D158; background:rgba(48,209,88,0.12); padding:2px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px; }
      .irac-live-badge::before { content:''; width:5px; height:5px; border-radius:50%; background:#30D158; animation:irac-pulse 2s ease-in-out infinite; }
      @keyframes irac-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      .irac-live-meta { display:flex; align-items:center; gap:6px; margin-top:3px; }
      .irac-update-time { font-size:9.5px; color:rgba(255,255,255,0.30); }
      .irac-src-tag { font-size:8px; font-weight:600; padding:1px 4px; border-radius:3px; letter-spacing:0.04em; text-transform:uppercase; }
      .irac-src-tag.catalog { color:#30D158; background:rgba(48,209,88,0.10); }
      .irac-src-tag.resellers { color:#5AC8FA; background:rgba(90,200,250,0.12); }
      .irac-src-tag.cache { color:rgba(255,255,255,0.42); background:rgba(255,255,255,0.05); }
      .irac-src-tag.missing { color:rgba(255,255,255,0.30); background:rgba(255,255,255,0.04); }
      .irac-trend { font-size:9px; font-weight:600; display:inline-flex; align-items:center; gap:1px; }
      .irac-trend.up { color:#30D158; }
      .irac-trend.down { color:#FF453A; }
      .irac-trend.flat { color:rgba(255,255,255,0.40); }
      .irac-diag {
        padding:6px 13px 8px; font-size:9px; font-family:'SF Mono','Monaco',Consolas,monospace;
        color:rgba(255,255,255,0.36); line-height:1.6; border-top:1px solid rgba(255,255,255,0.05);
        background:rgba(255,255,255,0.015); cursor:pointer;
      }
      .irac-diag b { color:rgba(255,255,255,0.65); font-weight:600; }
      .irac-diag.expanded { white-space:pre-wrap; word-break:break-all; }
      .irac-diag-tag { display:inline-block; padding:0 5px; border-radius:3px; margin-right:4px; }
      .irac-diag-tag.ok { color:#30D158; background:rgba(48,209,88,0.08); }
      .irac-diag-tag.warn { color:#FFD60A; background:rgba(255,200,0,0.08); }
      .irac-diag-tag.err { color:#FF453A; background:rgba(255,69,58,0.08); }
      .irac-more { padding:5px 13px 10px; font-size:10.5px; color:rgba(255,255,255,0.28); text-align:center; }
      .irac-stale { display:flex; align-items:center; gap:5px; padding:5px 13px; font-size:10px; color:rgba(255,210,0,0.80); background:rgba(255,200,0,0.07); border-top:1px solid rgba(255,200,0,0.09); }
      .irac-scan-banner { display:flex; align-items:center; gap:6px; padding:5px 13px; font-size:10px; color:rgba(90,200,250,0.95); background:rgba(90,200,250,0.06); border-top:1px solid rgba(90,200,250,0.10); }
      .irac-scan-spin { width:9px; height:9px; border:1.5px solid rgba(90,200,250,0.30); border-top-color:#5AC8FA; border-radius:50%; animation:irac-spin 0.8s linear infinite; flex-shrink:0; }
      .irac-private { display:flex; align-items:center; gap:5px; padding:6px 13px; font-size:10px; color:rgba(255,69,58,0.85); background:rgba(255,69,58,0.07); border-top:1px solid rgba(255,69,58,0.10); }
      .irac-state { padding:20px 13px; text-align:center; font-size:11px; color:rgba(255,255,255,0.30); line-height:1.55; }
      .irac-state.err { color:rgba(255,80,80,0.70); }
      .irac-debug { padding:8px 13px 10px; border-top:1px solid rgba(255,255,255,0.05); font-size:9.5px; font-family:monospace; color:rgba(255,200,80,0.7); line-height:1.7; word-break:break-all; }
      .irac-debug b { color:rgba(255,200,80,0.95); }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function formatRAP(n) {
    if (!n || n <= 0) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 100_000)   return Math.round(n / 1_000) + 'K';
    if (n >= 10_000)    return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString('tr-TR');
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function showPanel(html) {
    document.getElementById(PANEL_ID)?.remove();
    const el = document.createElement('div');
    el.id = PANEL_ID;
    if (state.collapsed) el.classList.add('collapsed');
    el.innerHTML = html;
    (document.documentElement || document.body).appendChild(el);
    // Collapse butonu — panel'i daraltır/açar (kapatmaz, kalıcı görünür)
    el.querySelector('.irac-collapse')?.addEventListener('click', () => {
      state.collapsed = !state.collapsed;
      el.classList.toggle('collapsed', state.collapsed);
    });
    return el;
  }
  function header(title, withRefresh) {
    const refresh = withRefresh
      ? `<button class="irac-refresh" title="Canlı fiyatları yenile">${ICON_REFRESH}</button>
         <button class="irac-rescan" title="Tüm kategorileri yeniden tara">${ICON_RESCAN}</button>`
      : '';
    return `<div class="irac-header"><span class="irac-title">${ICON_BAG}${title}</span><div class="irac-header-actions">${refresh}<button class="irac-collapse" title="Daralt / Aç">${ICON_COLLAPSE}</button></div></div>`;
  }

  // Geçen süreyi insan okuyabilir formatta döndür
  function relativeTime(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return 'şimdi';
    if (s < 60) return `${s}sn önce`;
    if (s < 3600) return `${Math.floor(s / 60)}dk önce`;
    return `${Math.floor(s / 3600)}sa önce`;
  }

  function swMsg(msg) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(msg, resp => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(resp || null);
        });
      } catch { resolve(null); }
    });
  }

  async function getMyUserId() {
    try {
      const rbx = window.Roblox;
      const uid = rbx?.CurrentUser?.userId || rbx?.sessionInfo?.userId || rbx?.user?.id;
      if (uid && Number.isFinite(Number(uid))) return String(uid);
    } catch { }
    for (const key of ['myUserId', 'tracked_auth_uid', 'tracked_user_id']) {
      const c = await storeGet(key);
      if (c[key] && Number.isFinite(Number(c[key]))) return String(c[key]);
    }
    const resp = await swMsg({ action: 'getAuthUserId' });
    if (resp?.ok && resp.userId) {
      await storeSet({ tracked_auth_uid: resp.userId });
      return String(resp.userId);
    }
    return null;
  }

  async function getRolimonsData() {
    const resp = await swMsg({ action: 'fetchRolimonsForRAC' });
    if (resp?.ok && resp.data) return { data: resp.data, stale: resp.stale || false };
    const stored = await storeGet('tracked_rolimons_cache');
    const cached = stored['tracked_rolimons_cache'];
    if (cached?.data) return { data: cached.data, stale: true };
    return { data: null };
  }

  // ─── DOM scan: görünür inventory kartlarından catalog ID + RAP ───────────────
  // Recommendations bölümü hariç (sayfanın alt kısmındaki öneri itemları false positive)
  function scanDOM() {
    const found = new Map();

    // Recommendations bölümünün Y başlangıcını bul
    let recommendedY = Infinity;
    for (const el of document.querySelectorAll('h2,h3,[class*="section-header"],[class*="label-header"]')) {
      if (/^Recommended/i.test(el.textContent?.trim() || '')) {
        recommendedY = el.getBoundingClientRect().top + window.scrollY;
        break;
      }
    }

    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/catalog\/(\d+)\//);
      if (!m) continue;
      const id = m[1];
      if (found.has(id)) continue;

      // Recommendations bölümündeyse atla
      const aTop = a.getBoundingClientRect().top + window.scrollY;
      if (aTop >= recommendedY) continue;

      const card = a.closest('li') || a.closest('[class]') || a.parentElement;
      // İsim: URL slug tercih et (inventory display ismi daha güvenilir)
      const slugMatch = href.match(/\/catalog\/\d+\/([^/?#]+)/);
      const slugName = slugMatch ? decodeURIComponent(slugMatch[1]).replace(/-/g, ' ').trim() : '';
      const cardName = extractTextName(card);
      const name = slugName || cardName;
      // Limited badge kontrolü — birden fazla detection yolu:
      // 1) Card metninde "Limited" veya "LIMITED U" geçiyor mu
      // 2) Card içinde class adında "limited" geçen bir element var mı
      // 3) Card içinde data-* attribute'lerinde "limited" var mı
      const cardText = card?.textContent || '';
      const textLimited = /Limited/i.test(cardText);
      const badgeLimited = !!card?.querySelector('[class*="limited" i]');
      let dataLimited = false;
      if (card?.attributes) {
        for (const attr of card.attributes) {
          if (/limited/i.test(attr.value || '')) { dataLimited = true; break; }
        }
      }
      const isLimited = textLimited || badgeLimited || dataLimited;
      const rap = extractPrice(card || a);
      if (isLimited || rap > 0) found.set(id, { assetId: id, name, rap, isLimited });
    }
    return [...found.values()];
  }

  function extractTextName(container) {
    if (!container) return '';
    for (const el of [...container.querySelectorAll('*')].filter(e => e.children.length === 0)) {
      const t = el.textContent?.trim() || '';
      if (t.length < 3 || t.length > 55 || /^\d+$/.test(t) || /^By\s/i.test(t) || t.startsWith('#') || /^Off\s?Sale$/i.test(t)) continue;
      return t;
    }
    return '';
  }

  function extractPrice(container) {
    if (!container) return 0;
    for (const el of [...container.querySelectorAll('*')].filter(e => e.children.length === 0)) {
      const raw = el.textContent?.trim() || '';
      if (!raw || raw.startsWith('#') || raw.startsWith('By ') || raw.length > 15) continue;
      // Binlik ayraç (virgül veya nokta) silerek düz sayıya çevir
      const stripped = raw.replace(/[,\.]/g, '');
      if (/^\d+$/.test(stripped)) {
        const n = parseInt(stripped, 10);
        if (n >= 1 && n <= 9_999_999) return n;
      }
      // Fallback: sondaki rakam grubunu al
      const mm = raw.match(/(\d[\d,\.]{0,8}\d|\d)$/);
      if (mm) {
        const n = parseInt(mm[0].replace(/[,\.]/g, ''), 10);
        if (n >= 1 && n <= 9_999_999) return n;
      }
    }
    return 0;
  }

  // Stability-based wait — item sayısı stabil olana kadar bekler (lazy-loaded UGC için kritik).
  // İlk item'ı bulduktan sonra 700ms süreyle yeni item gelmezse resolve eder.
  // Maks bekleme: maxMs (varsayılan 6 saniye).
  function waitForDomItems(maxMs = 6000) {
    return new Promise(resolve => {
      let lastCount = 0;
      let stableTimer = null;
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(globalTimer);
        clearTimeout(stableTimer);
        obs.disconnect();
        resolve(scanDOM());
      };

      const recheck = () => {
        const r = scanDOM();
        if (r.length !== lastCount) {
          lastCount = r.length;
          clearTimeout(stableTimer);
          // Item sayısı değişti → 700ms süreyle daha gelmezse "stabilleşti" say
          stableTimer = setTimeout(finish, 700);
        }
      };

      const globalTimer = setTimeout(finish, maxMs);
      const obs = new MutationObserver(recheck);
      obs.observe(document.body, { childList: true, subtree: true });

      // İlk kontrol — sayfa zaten render edilmiş olabilir
      recheck();
      // Hiç item bulunamazsa 1.5sn sonra resolve (boş envanter olabilir)
      setTimeout(() => { if (lastCount === 0) finish(); }, 1500);
    });
  }

  // ─── Modül seviyesi state — kategori geçişlerinde korunur ──────────────────
  const state = {
    ready: false,
    pageUserId: null,
    myUserId: null,
    rolimons: null,
    stale: false,
    thumbMap: {},
    itemMap: new Map(),
    floorMap: new Map(),       // assetId → { price: number|null, fetchedAt: number, source: string }
    historyMap: new Map(),     // assetId → [{ p, t }, ...] (price snapshots)
    floorLoading: false,
    lastFloorUpdate: 0,
    autoRefreshTimer: null,
    rateLimited: false,
    lastDiag: null,            // Service worker'dan gelen tanı bilgisi
    ugcScanDiag: null,         // Tüm-kategori UGC tarama tanısı
    ugcScanLoading: false,     // Şu an UGC tarama yapılıyor mu (loading indicator için)
    privateInventory: false,   // Sayfa user'ı envanterini private yapmış mı
    collapsed: false,          // Panel daraltılmış mı (kalıcı, re-render'da korunur)
  };

  // ─── V1 collectibles — tüm envanter, tek çağrı, SW relay ────────────────
  async function fetchV1Collectibles(userId) {
    const resp = await swMsg({ action: 'fetchCollectiblesPage', userId });
    return { items: resp?.data || [], apiOk: resp?.ok === true };
  }

  // ─── Rolimons player assets — garanti limited envanteri, sıfır false positive ──
  async function fetchRolimonsPlayerAssets(userId) {
    const resp = await swMsg({ action: 'fetchRolimonsPlayerAssets', userId });
    return resp?.ok ? (resp.playerassets || {}) : null;
  }

  // ─── Kategori geçişinde DOM rescan + güncelleme ──────────────────────────
  async function onCategoryChange() {
    if (!state.ready) return;
    const domItems = scanDOM();
    const newThumbIds = [];
    const rapMissIds = [];
    let added = false;

    for (const it of domItems) {
      if (state.itemMap.has(it.assetId)) continue;
      const info = state.rolimons?.[it.assetId];
      if (info?.[2] > 0) {
        state.itemMap.set(it.assetId, { assetId: it.assetId, name: info[0] || it.name, rap: info[2] });
        if (!state.thumbMap[it.assetId]) newThumbIds.push(it.assetId);
        added = true;
      } else if (it.isLimited && it.rap > 0) {
        state.itemMap.set(it.assetId, { assetId: it.assetId, name: it.name, rap: it.rap });
        if (!state.thumbMap[it.assetId]) newThumbIds.push(it.assetId);
        added = true;
      } else {
        rapMissIds.push(it.assetId);
      }
    }

    // Economy API fallback — UGC limitedlar için
    if (rapMissIds.length > 0) {
      const resaleResp = await swMsg({ action: 'fetchResaleDataBatch', assetIds: rapMissIds.slice(0, 30) });
      if (resaleResp?.ok) {
        for (const [id, rapVal] of Object.entries(resaleResp.rap || {})) {
          if (rapVal > 0 && !state.itemMap.has(id)) {
            const domIt = domItems.find(i => i.assetId === id);
            const info  = state.rolimons?.[id];
            state.itemMap.set(id, { assetId: id, name: info?.[0] || domIt?.name || `#${id}`, rap: rapVal });
            if (!state.thumbMap[id]) newThumbIds.push(id);
            added = true;
          }
        }
      }
    }

    if (!added) return;
    if (newThumbIds.length > 0) {
      swMsg({ action: 'fetchItemThumbnails', assetIds: newThumbIds }).then(r => {
        if (r?.ok) Object.assign(state.thumbMap, r.map || {});
        doRender();
      });
    } else {
      doRender();
    }
    // Yeni eklenen item'lar için floor çek (cache hit varsa anında, yoksa fetch eder)
    loadFloorPrices(false);
  }

  function doRender() {
    renderPanel(state.pageUserId, state.myUserId, [...state.itemMap.values()], state.rolimons, state.stale, state.thumbMap);
  }

  // ─── Canlı floor (Best Price) — Multi-source batch endpoint ──────────────
  // Service worker artık MAIN world batch catalog endpoint kullanıyor;
  // tek istekte 120 item, çok daha geniş rate-limit toleransı.
  async function loadFloorPrices(force = false) {
    if (state.floorLoading) return;
    const items = [...state.itemMap.values()];
    if (items.length === 0) return;

    state.floorLoading = true;
    const btn = document.querySelector(`#${PANEL_ID} .irac-refresh`);
    btn?.classList.add('spinning');

    try {
      // Tüm item'ları gönder (batch catalog 120/req kapasiteli; rate-limit korunması SW'de)
      const ids = items.map(it => it.assetId);

      const resp = await swMsg({
        action: 'fetchFloorPricesBatch',
        assetIds: ids,
        forceRefresh: force
      });

      if (resp?.ok) {
        const now = Date.now();
        const sources = resp.sources || {};
        for (const [id, price] of Object.entries(resp.floors || {})) {
          state.floorMap.set(id, {
            price,
            fetchedAt: now,
            source: sources[id] || 'unknown'
          });
        }
        state.lastFloorUpdate = now;
        state.rateLimited = !!resp.rateLimited;
        state.lastDiag = resp.diag || null;
      }

      // Price history — trend arrow için
      const histResp = await swMsg({
        action: 'getPriceHistory',
        assetIds: ids
      });
      if (histResp?.ok) {
        for (const [id, snapshots] of Object.entries(histResp.history || {})) {
          if (Array.isArray(snapshots) && snapshots.length > 0) {
            state.historyMap.set(id, snapshots);
          }
        }
      }
    } catch (e) {
      console.warn('[Tracked-Inv] loadFloorPrices error:', e);
    }

    state.floorLoading = false;
    btn?.classList.remove('spinning');
    doRender();
  }

  // ─── Tüm kategorilerde UGC + Classic Limited tarama ─────────────────────
  // Roblox'un inventory API'sini kullanarak kullanıcının TÜM asset type'larındaki
  // item'ları getirir, sonra catalog details ile itemRestrictions'a göre limited
  // olanları filtreler. Kategori bağımsız — tek seferde tüm limited'ları bulur.
  //
  // 10 dakika cache. Force refresh için forceRefresh:true gönder.
  async function loadAllUGCLimiteds(userId, force = false) {
    if (state.ugcScanLoading) return;
    state.ugcScanLoading = true;
    doRender(); // Loading state'i göster

    try {
      // 90 saniyelik timeout — SW takılırsa kullanıcıyı sonsuza dek bekletme
      const resp = await Promise.race([
        swMsg({
          action: 'fetchUserAllLimiteds',
          userId,
          forceRefresh: force
        }),
        new Promise(resolve => setTimeout(() => resolve({ ok: false, error: 'timeout_90s' }), 90000))
      ]);

      if (resp?.error === 'timeout_90s') {
        console.warn('[Tracked-Inv] UGC tarama timeout (90sn)');
        state.ugcScanDiag = { ...state.ugcScanDiag, errors: ['timeout_90s'], limitedsFound: 0 };
      }

      if (resp?.ok && Array.isArray(resp.limiteds)) {
        state.ugcScanDiag = resp.diag;
        state.privateInventory = !!resp.diag?.privateInventory;

        let added = 0;
        const now = Date.now();
        for (const it of resp.limiteds) {
          if (state.itemMap.has(it.assetId)) {
            // Halihazırda eklenmiş ama floor verisi eksikse ekleyelim
            if (it.lowestPrice && !state.floorMap.has(it.assetId)) {
              state.floorMap.set(it.assetId, {
                price: it.lowestPrice,
                fetchedAt: now,
                source: 'catalog'
              });
            }
            continue;
          }
          // Rolimons'ta var mı (RAP kaynağı)?
          const rolimonsInfo = state.rolimons?.[it.assetId];
          const rap = rolimonsInfo?.[2] || it.lowestPrice || 0;
          const name = rolimonsInfo?.[0] || it.name || `#${it.assetId}`;
          if (rap > 0 || it.lowestPrice > 0) {
            state.itemMap.set(it.assetId, {
              assetId: it.assetId,
              name,
              rap: rap,
              isUGC: it.isUGC,
            });
            // Floor fiyatı catalog'dan zaten geldi → cache'le
            if (it.lowestPrice && it.lowestPrice > 0) {
              state.floorMap.set(it.assetId, {
                price: it.lowestPrice,
                fetchedAt: now,
                source: 'catalog'
              });
            }
            added++;
          }
        }

        // Yeni item'lar için thumbnail çek
        const newIds = resp.limiteds
          .filter(it => !state.thumbMap[it.assetId])
          .map(it => it.assetId);
        if (newIds.length > 0) {
          const thumbResp = await swMsg({ action: 'fetchItemThumbnails', assetIds: newIds });
          if (thumbResp?.ok) Object.assign(state.thumbMap, thumbResp.map || {});
        }

        // Sadece TEKNİK problemlerde uyarı bas (catalog/CSRF/MAIN world fail vb).
        // Private envanter NORMAL davranıştır → console.warn değil, panel banner ile gösteriyoruz.
        // Sıfır asset de Roblox'un anlık glitch'i olabilir → panelde mesaj gösteriyoruz, console'a yazmıyoruz.
        const diagInfo = resp.diag || {};
        const diagErrs = diagInfo.errors || [];
        const SERIOUS_PATTERNS = /catalog_rate_limit|csrf_unobtainable|handler_exception|top_level_exception|no_main_result|executeScript_returned_null|invalid_userid/;
        const hasSeriousErr = diagErrs.some(e => SERIOUS_PATTERNS.test(e));
        if (hasSeriousErr) {
          const summary = [
            `${resp.limiteds.length} limited bulundu`,
            `${diagInfo.totalAssets || 0} asset / ${diagInfo.typesWithData || 0} kategori tarandı`,
            `hatalar: ${diagErrs.join(' | ')}`,
          ].join(' • ');
          console.warn('[Tracked-Inv] UGC tarama uyarı —', summary);
        }
      } else {
        console.error('[Tracked-Inv] UGC tarama hatası:', resp);
      }
    } catch (e) {
      console.warn('[Tracked-Inv] loadAllUGCLimiteds error:', e);
    }

    state.ugcScanLoading = false;
    doRender();
  }

  // Trend hesabı — son fiyat vs son 7 günün ortalaması
  function computeTrend(id, currentPrice) {
    if (!currentPrice || currentPrice <= 0) return null;
    const history = state.historyMap.get(String(id));
    if (!history || history.length < 2) return null;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = history.filter(s => s.t >= sevenDaysAgo);
    if (recent.length < 2) return null;

    // Önceki ortalama (en son hariç) vs şimdi
    const prevSamples = recent.slice(0, -1);
    if (prevSamples.length === 0) return null;
    const prevAvg = prevSamples.reduce((s, x) => s + x.p, 0) / prevSamples.length;
    if (prevAvg <= 0) return null;

    const pct = ((currentPrice - prevAvg) / prevAvg) * 100;
    if (Math.abs(pct) < 1) return { dir: 'flat', pct: 0 };
    return { dir: pct > 0 ? 'up' : 'down', pct: Math.round(pct) };
  }

  // Otomatik yenileme — panel görünür olduğunda her 5dk
  function startAutoRefresh() {
    stopAutoRefresh();
    state.autoRefreshTimer = setInterval(() => {
      if (document.getElementById(PANEL_ID) && !document.hidden) {
        loadFloorPrices(true);
      }
    }, AUTO_REFRESH_MS);
  }
  function stopAutoRefresh() {
    if (state.autoRefreshTimer) {
      clearInterval(state.autoRefreshTimer);
      state.autoRefreshTimer = null;
    }
  }

  // ─── Panel render ─────────────────────────────────────────────────────────
  function renderPanel(userId, myUserId, items, rolimonsData, stale, thumbMap) {
    const isOwn = String(userId) === String(myUserId);
    const title = isOwn ? 'Envanter Değerin' : 'Envanter Değeri';

    const enriched = items.map(item => {
      const id   = String(item.assetId);
      const info = rolimonsData?.[id];
      const rap  = (info?.[2] > 0 ? info[2] : 0) || item.rap || item.recentAveragePrice || 0;
      const name = info?.[0] || item.name || `#${id}`;
      const imgSrc = thumbMap?.[id] || item.imgSrc || '';
      const floorEntry = state.floorMap.get(id);
      const floor = (floorEntry && typeof floorEntry.price === 'number' && floorEntry.price > 0)
        ? floorEntry.price : null;
      const source = floorEntry?.source || null;
      const trend = floor !== null ? computeTrend(id, floor) : null;
      // Görüntülenen değer: floor varsa floor, yoksa RAP
      const value = floor ?? rap;
      return { id, name, rap, floor, value, imgSrc, source, trend };
    }).filter(it => it.value > 0).sort((a, b) => b.value - a.value);

    const totalValue = enriched.reduce((s, it) => s + it.value, 0);
    const totalRAP   = enriched.reduce((s, it) => s + it.rap, 0);
    const hasFloor   = enriched.some(it => it.floor !== null);
    const top        = enriched.slice(0, 248);
    const remaining  = enriched.length - top.length;

    // Trend arrow HTML üretici
    const trendHtml = (trend) => {
      if (!trend) return '';
      if (trend.dir === 'up')   return `<span class="irac-trend up">▲${trend.pct}%</span>`;
      if (trend.dir === 'down') return `<span class="irac-trend down">▼${Math.abs(trend.pct)}%</span>`;
      return '';
    };

    const rows = top.map(it => {
      let valueLine;
      if (it.floor !== null && it.rap > 0 && Math.abs(it.floor - it.rap) / it.rap > 0.005) {
        // Floor varsa ve RAP'ten farklıysa: ana değer = floor, alt satır = RAP karşılaştırma
        const diff = it.floor - it.rap;
        const pct  = Math.round((diff / it.rap) * 100);
        const dirCls = diff > 0 ? 'up' : (diff < 0 ? 'dn' : 'flat');
        const sign = diff > 0 ? '+' : '';
        valueLine = `
          <div class="irac-value-wrap">
            <span class="irac-rap">${ICON_ROBUX}${formatRAP(it.floor)} ${trendHtml(it.trend)}</span>
            <div class="irac-sub">
              <span>RAP ${formatRAP(it.rap)}</span>
              <span class="irac-diff ${dirCls}">${sign}${pct}%</span>
            </div>
          </div>`;
      } else if (it.floor !== null) {
        // Floor RAP'e eşit
        valueLine = `
          <div class="irac-value-wrap">
            <span class="irac-rap">${ICON_ROBUX}${formatRAP(it.floor)} ${trendHtml(it.trend)}</span>
            <div class="irac-sub">canlı · RAP eşit</div>
          </div>`;
      } else {
        // Floor yok: sadece RAP göster
        valueLine = `
          <div class="irac-value-wrap">
            <span class="irac-rap">${ICON_ROBUX}${formatRAP(it.rap)}</span>
            <div class="irac-sub">RAP</div>
          </div>`;
      }
      return `
        <div class="irac-item" data-catalog-id="${escapeHtml(it.id)}">
          ${it.imgSrc
            ? `<img class="irac-thumb" src="${escapeHtml(it.imgSrc)}" alt="" loading="lazy">`
            : `<span class="irac-thumb irac-thumb-ph"></span>`}
          <span class="irac-name">${escapeHtml(it.name)}</span>
          ${valueLine}
        </div>`;
    }).join('');

    const totalDiff = totalValue - totalRAP;
    const totalPct = totalRAP > 0 ? Math.round((totalDiff / totalRAP) * 100) : 0;
    const totalDirCls = totalDiff > 0 ? 'up' : (totalDiff < 0 ? 'dn' : 'flat');
    const totalSign = totalDiff > 0 ? '+' : '';

    // Source breakdown — kaç item hangi kaynaktan geldi
    const srcCount = { catalog: 0, resellers: 0, cache: 0, missing: 0, none: 0 };
    for (const it of enriched) {
      if (it.source === 'catalog') srcCount.catalog++;
      else if (it.source === 'resellers') srcCount.resellers++;
      else if (it.source === 'cache') srcCount.cache++;
      else if (it.source === 'missing') srcCount.missing++;
      else srcCount.none++;
    }

    const liveMeta = hasFloor
      ? `<div class="irac-live-meta">
           <span class="irac-live-badge">CANLI</span>
           ${(totalRAP > 0 && Math.abs(totalDiff) / totalRAP > 0.005)
             ? `<span class="irac-diff ${totalDirCls}">${totalSign}${totalPct}% RAP</span>`
             : ''}
           <span class="irac-update-time">${relativeTime(state.lastFloorUpdate)}</span>
         </div>`
      : (state.floorLoading
          ? `<div class="irac-live-meta"><span class="irac-update-time">canlı veriler yükleniyor…</span></div>`
          : '');

    // Diagnostics — tıklanınca açılır kapanır, sadece gerçek sorunda otomatik gösterilir
    // MAIN-FAIL artık yalnızca fresh fetch denenmesine rağmen MAIN world çağrısı çalışmadıysa gösterilir.
    const diag = state.lastDiag;
    const attemptedFresh = diag && (diag.requested > 0) && (diag.cacheHits < diag.requested);
    const mainFailed = attemptedFresh && !diag.mainWorldUsed && (diag.catalogOk + diag.resellersOk) === 0;
    const hasIssue = diag && (
      diag.rateLimited || (diag.errors?.length > 0) || mainFailed
    );
    const ugc = state.ugcScanDiag;
    const ugcTagHtml = ugc ? `
      ${ugc.limitedsFound > 0 ? `<span class="irac-diag-tag ok">UGC-SCAN ${ugc.limitedsFound}</span>` : ''}
      ${ugc.totalAssets > 0 ? `<span class="irac-diag-tag">${ugc.totalAssets} asset / ${ugc.typesWithData} kategori</span>` : ''}
      ${ugc.fromCache ? `<span class="irac-diag-tag">UGC-CACHE</span>` : ''}
    ` : '';

    const diagHtml = (diag || ugc) ? `
      <div class="irac-diag${hasIssue ? ' expanded' : ''}" title="Tıkla — tanı detayları">
        ${diag?.catalogOk > 0 ? `<span class="irac-diag-tag ok">CATALOG ${diag.catalogOk}</span>` : ''}
        ${diag?.resellersOk > 0 ? `<span class="irac-diag-tag ok">RESELLERS ${diag.resellersOk}</span>` : ''}
        ${diag?.cacheHits > 0 ? `<span class="irac-diag-tag">CACHE ${diag.cacheHits}</span>` : ''}
        ${diag?.catalogNull > 0 ? `<span class="irac-diag-tag warn">NULL ${diag.catalogNull}</span>` : ''}
        ${diag?.rateLimited ? `<span class="irac-diag-tag err">RATE-LIMIT</span>` : ''}
        ${mainFailed ? `<span class="irac-diag-tag warn">MAIN-FAIL</span>` : ''}
        ${diag?.errors?.length ? `<span class="irac-diag-tag err">ERR ${diag.errors.length}</span>` : ''}
        ${ugcTagHtml}
        ${hasIssue && diag?.errors?.length ? `<br><b>errors:</b><br>${diag.errors.map(e => escapeHtml(e)).join('<br>')}` : ''}
      </div>` : '';

    const panelEl = showPanel(`
      ${header(title, true)}
      <div class="irac-summary">
        <div class="irac-total">${ICON_ROBUX}${formatRAP(totalValue)}</div>
        <div class="irac-meta">${enriched.length} limited item</div>
        ${liveMeta}
      </div>
      <div class="irac-items">
        ${rows || '<div class="irac-state">Item bulunamadı</div>'}
        ${remaining > 0 ? `<div class="irac-more">+ ${remaining} item daha</div>` : ''}
      </div>
      ${state.ugcScanLoading ? `<div class="irac-scan-banner"><span class="irac-scan-spin"></span>Tüm kategoriler taranıyor — UGC limited'lar bulunuyor…</div>` : ''}
      ${state.privateInventory ? `<div class="irac-private">${ICON_WARN}Kullanıcı envanteri private — UGC limited'lar görüntülenemiyor</div>` : ''}
      ${state.rateLimited ? `<div class="irac-stale">${ICON_WARN}Roblox rate-limit — sonraki tıkta yeniden denenecek</div>` : ''}
      ${stale ? `<div class="irac-stale">${ICON_WARN}Rolimons önbellekten — 30dk+ eski</div>` : ''}
      ${diagHtml}
    `);

    // Diagnostics tıklayınca toggle
    panelEl.querySelector('.irac-diag')?.addEventListener('click', e => {
      e.currentTarget.classList.toggle('expanded');
    });

    panelEl.querySelectorAll('.irac-item[data-catalog-id]').forEach(row => {
      row.addEventListener('click', () => {
        window.open(`https://www.roblox.com/catalog/${row.dataset.catalogId}/`, '_blank');
      });
    });

    // Refresh butonu
    panelEl.querySelector('.irac-refresh')?.addEventListener('click', e => {
      e.stopPropagation();
      loadFloorPrices(true);
    });
    // Rescan butonu — Kapsamlı tarama: tüm kategorilerde + DOM scan + floor refresh
    panelEl.querySelector('.irac-rescan')?.addEventListener('click', async e => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.classList.add('spinning');
      try {
        // 1) Kapsamlı UGC tarama (force refresh — cache'i bypass et)
        await loadAllUGCLimiteds(state.pageUserId, true);
        // 2) DOM scan ile mevcut kategorideki item'ları da topla
        const startY = window.scrollY;
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        await new Promise(r => setTimeout(r, 600));
        window.scrollTo({ top: startY, behavior: 'smooth' });
        await new Promise(r => setTimeout(r, 300));
        await onCategoryChange();
        // 3) Tüm item'lar için fresh floor fetch
        await loadFloorPrices(true);
      } finally {
        btn.classList.remove('spinning');
      }
    });
    // (Collapse butonu showPanel'da yönetiliyor — burada ek listener gerekmiyor)
  }

  // ─── Sürekli DOM gözlemcisi — kullanıcı scroll edince yeni item'ları yakala ──
  // Roblox inventory grid'i lazy-load kullanıyor: kullanıcı aşağı scroll edince yeni
  // item kartları DOM'a ekleniyor. Bu observer yeni catalog link'i tespit edince
  // onCategoryChange() tetikliyor → yeni item'lar paneline geliyor.
  function watchInventoryGrowth() {
    let seenIds = new Set();
    let debounce = null;

    const collectIds = () => {
      const ids = new Set();
      for (const a of document.querySelectorAll('a[href*="/catalog/"]')) {
        const m = (a.getAttribute('href') || '').match(/\/catalog\/(\d+)\//);
        if (m) ids.add(m[1]);
      }
      return ids;
    };

    seenIds = collectIds();

    const obs = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (!state.ready) return;
        const cur = collectIds();
        let hasNew = false;
        for (const id of cur) {
          if (!seenIds.has(id)) { hasNew = true; seenIds.add(id); }
        }
        if (hasNew) onCategoryChange();
      }, 500);
    });

    obs.observe(document.body, { childList: true, subtree: true });
  }

  // ─── SPA navigasyon: inventory dışına çıkınca kaldır, kategori değişince rescan ─
  function watchSpaNavigation() {
    let lastHref = location.href;
    const onUrlChange = () => {
      const newHref = location.href;
      if (newHref === lastHref) return;
      lastHref = newHref;
      if (!/\/users\/(\d+\/)?inventory/.test(location.pathname)) {
        // Inventory dışına çıkıldı — paneli kaldır
        document.getElementById(PANEL_ID)?.remove();
        state.ready = false;
        stopAutoRefresh();
      } else {
        // Aynı inventory, farklı kategori (#!accessories/shoulder gibi) — DOM rescan
        onCategoryChange();
      }
    };
    window.addEventListener('popstate', onUrlChange);
    window.addEventListener('hashchange', onUrlChange);
    let debounce;
    new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(onUrlChange, 350);
    }).observe(document.body, { childList: true, subtree: false });

    // Polling fallback — Roblox bazı navigation'ları pushState ile değil
    // direkt window.location veya başka mekanizma ile yapıyor (örn: ROBLOX logo).
    // Bu durumda yukarıdaki listener'lar fire etmiyor → polling KESİN yakalar.
    // Çift kayıt koruması: watchSpaNavigation birden fazla kez çağrılırsa eski interval temizlenir.
    if (window._trackedInvPollInterval) clearInterval(window._trackedInvPollInterval);
    window._trackedInvPollInterval = setInterval(() => {
      if (location.href !== lastHref) onUrlChange();
    }, 300);
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    const idMatch  = location.pathname.match(/\/users\/(\d+)\/inventory/);
    const isOwnUrl = !idMatch && /\/users\/inventory/.test(location.pathname);
    if (!idMatch && !isOwnUrl) return;

    injectStyles();
    showPanel(`${header('Envanter Değeri')}<div class="irac-state">Yükleniyor…</div>`);

    const myUserId   = await getMyUserId();
    const pageUserId = idMatch ? idMatch[1] : myUserId;
    const isOwn      = isOwnUrl || String(pageUserId) === String(myUserId);
    if (!pageUserId) {
      showPanel(`${header('Envanter Değeri')}<div class="irac-state err">Kullanıcı ID tespit edilemedi.</div>`);
      return;
    }

    // 4 kaynak paralel: Rolimons item verileri + Rolimons player assets + V1 API + DOM
    const [rolimonsResult, rolimonsAssets, { items: v1Items }, domItems] = await Promise.all([
      getRolimonsData(),
      fetchRolimonsPlayerAssets(pageUserId),
      fetchV1Collectibles(pageUserId),
      waitForDomItems(4000),
    ]);

    state.rolimons  = rolimonsResult.data;
    state.stale     = rolimonsResult.stale || false;
    state.pageUserId = pageUserId;
    state.myUserId   = myUserId;
    state.itemMap.clear();
    state.floorMap.clear();
    state.historyMap.clear();
    state.thumbMap = {};
    state.ugcScanDiag = null;
    state.ugcScanLoading = false;
    state.privateInventory = false;
    state.rateLimited = false;
    state.lastDiag = null;

    // 1. Rolimons player assets — garanti limited, false positive yok
    if (rolimonsAssets) {
      for (const assetId of Object.keys(rolimonsAssets)) {
        const info = rolimonsResult.data?.[assetId];
        const rap  = info?.[2] || 0;
        const name = info?.[0] || '';
        if (rap > 0) state.itemMap.set(assetId, { assetId, name, rap });
      }
    }

    // 2. V1 API — klasik limiteds (Rolimons'ta olmayabilir)
    for (const it of v1Items) {
      const id = String(it.assetId);
      if (id && it.recentAveragePrice > 0 && !state.itemMap.has(id)) {
        state.itemMap.set(id, { assetId: id, name: it.name || '', rap: it.recentAveragePrice });
      }
    }

    // 3. DOM scan — SADECE kendi envanterinde. Başka kullanıcıda sayfa-geneli /catalog tarama
    //    senin kişisel öneri/item linklerini sızdırıp onun (özellikle private) envanterine
    //    yanlış değer ekliyordu → başkalarında yalnız kullanıcıya-özel API'ler kullanılır.
    const rapMissIds = [];
    for (const it of (isOwn ? domItems : [])) {
      if (state.itemMap.has(it.assetId)) continue;
      const info = rolimonsResult.data?.[it.assetId];
      if (info?.[2] > 0) {
        // Rolimons'ta var → Rolimons RAP kullan
        state.itemMap.set(it.assetId, { assetId: it.assetId, name: info[0] || it.name, rap: info[2] });
      } else if (it.isLimited && it.rap > 0) {
        // Limited rozeti + DOM fiyatı → floor price'ı RAP proxy olarak kullan (UGC limited)
        state.itemMap.set(it.assetId, { assetId: it.assetId, name: it.name, rap: it.rap });
      } else {
        rapMissIds.push(it.assetId); // Economy API son çare
      }
    }

    // 4. Economy resale API — UGC limitedlar için (Off Sale, RAP yok, diğer kaynaklarda da yok)
    if (rapMissIds.length > 0) {
      const resaleResp = await swMsg({ action: 'fetchResaleDataBatch', assetIds: rapMissIds.slice(0, 40) });
      if (resaleResp?.ok) {
        for (const [id, rapVal] of Object.entries(resaleResp.rap || {})) {
          if (rapVal > 0 && !state.itemMap.has(id)) {
            const domIt = domItems.find(i => i.assetId === id);
            const info  = rolimonsResult.data?.[id];
            state.itemMap.set(id, {
              assetId: id,
              name: info?.[0] || domIt?.name || `#${id}`,
              rap: rapVal,
            });
          }
        }
      }
    }

    state.ready = true;

    const allItems = [...state.itemMap.values()];

    // İlk kaynaklar boş geldi → kapanma! UGC tarama henüz başlamadı.
    // Loading state göster, taramayı tetikle, sonra tekrar değerlendir.
    // NOT: state.ugcScanLoading'i burada pre-set ETMİYORUZ — loadAllUGCLimiteds kendi
    // başına yönetir, yoksa fonksiyon "zaten yükleniyor" diye skip eder (deadlock).
    if (allItems.length === 0) {
      showPanel(`
        ${header('Envanter Değeri', true)}
        <div class="irac-scan-banner"><span class="irac-scan-spin"></span>Tüm kategoriler taranıyor — limited item'lar bulunuyor… (5-10 sn)</div>
        <div class="irac-state">Roblox inventory API'sinden tüm asset type'lar getiriliyor.<br>Lütfen bekleyin.</div>
      `);
    } else {
      // Görseller
      const thumbResp = await swMsg({ action: 'fetchItemThumbnails', assetIds: allItems.map(it => it.assetId) });
      state.thumbMap = thumbResp?.ok ? (thumbResp.map || {}) : {};
      doRender();
    }

    // Canlı floor — background, RAP'ten sonra. Panel'i geldikçe günceller.
    loadFloorPrices(false);
    startAutoRefresh();

    // Sürekli DOM gözlemcisi — sadece KENDİ envanterinde (başkasında sayfa-geneli sızıntıyı önler)
    if (isOwn) watchInventoryGrowth();

    // KAPSAMLI TARAMA — Tüm asset type'larındaki classic + UGC limited'ları yakala
    // HER ZAMAN çalışır, ilk kaynaklar 0 item bulsa bile.
    // Roblox inventory API + catalog details ile kategori bağımsız tarama.
    // 10 dk cache, force refresh için rescan butonu kullan.
    loadAllUGCLimiteds(pageUserId, false).then(() => {
      // UGC tarama tamamlandı → eğer hâlâ 0 item varsa final mesaj göster
      const afterUgc = [...state.itemMap.values()];
      if (afterUgc.length === 0) {
        state.ugcScanLoading = false;
        const d = state.ugcScanDiag || {};
        const errs = d.errors || [];
        // Spesifik sebep tespiti
        let reason;
        if (state.privateInventory) {
          reason = `<div class="irac-private">${ICON_WARN}Bu kullanıcının envanteri private — UGC limited'lar görüntülenemiyor</div>`;
        } else if (errs.some(e => /^catalog_4\d\d|csrf_unobtainable/.test(e))) {
          // Catalog API blocked — kullanıcıya net mesaj
          reason = `<div class="irac-state err">⚠ Roblox catalog API'sine erişilemiyor (CSRF/403).<br>Bu geçici bir Roblox sorunu olabilir.<br><br>Çözüm: Sayfayı yenile (F5) veya panel header'daki <b>🔍 Yeniden tara</b> butonuna tıkla.<br><br>Hata: ${escapeHtml(errs.find(e => /^catalog_4\d\d|csrf_unobtainable/.test(e)) || '')}</div>`;
        } else if (errs.length > 0) {
          const apiInfo = d.firstApiResp ? `<br><span style="font-family:monospace;font-size:9.5px;opacity:.6">İlk API: type=${d.firstApiResp.typeId} status=${d.firstApiResp.status}</span>` : '';
          reason = `<div class="irac-state err">⚠ Tarama tamamlandı ama veri alınamadı.<br><br>Detay:<br><span style="font-family:monospace;font-size:9.5px;opacity:.7">${errs.slice(0, 3).map(escapeHtml).join('<br>')}</span>${apiInfo}</div>`;
        } else if ((d.totalAssets || 0) === 0) {
          // Inventory API hiç veri döndürmedi — büyük ihtimal session/auth sorunu
          const apiInfo = d.firstApiResp
            ? `<br><span style="font-family:monospace;font-size:9.5px;opacity:.6">İlk API: type=${d.firstApiResp.typeId} status=${d.firstApiResp.status}</span>`
            : `<br><span style="font-family:monospace;font-size:9.5px;opacity:.6">Inventory API'den hiç yanıt gelmedi</span>`;
          reason = `<div class="irac-state err">⚠ Inventory API 0 asset döndürdü.<br>Bu genelde geçici Roblox sorunudur.<br><br>Çözüm: <b>F5</b> ile yenile veya <b>🔍 Yeniden tara</b> butonuna tıkla.${apiInfo}</div>`;
        } else {
          reason = `<div class="irac-state">Bu kullanıcının envanterinde limited item bulunamadı.<br>(Tarama: ${d.totalAssets || 0} asset / ${d.typesWithData || 0} kategori)<br><br>Eğer item'ın olduğunu biliyorsan <b>🔍 Yeniden tara</b> butonuna tıkla.</div>`;
        }
        showPanel(`${header('Envanter Değeri', true)}${reason}`);
        // Rescan butonuna handler ekle (showPanel collapse handler'ı zaten ekler)
        document.querySelector(`#${PANEL_ID} .irac-rescan`)?.addEventListener('click', async () => {
          await loadAllUGCLimiteds(state.pageUserId, true);
          const newCount = [...state.itemMap.values()].length;
          if (newCount > 0) loadFloorPrices(false);
        });
      } else {
        // Yeni eklenen item'lar için floor fetch'i tetikle
        loadFloorPrices(false);
      }
    }).catch(err => {
      console.warn('[Tracked-Inv] loadAllUGCLimiteds failed:', err);
      state.ugcScanLoading = false;
      doRender();
    });
  }

  // Tracked Plus gerektirir (Envanter analizi Pro özelliğidir). Plus yoksa GİZLEMEK yerine
  // panel çerçevesi + kilit gösterilir (tıkla → Plus ekranı). Veri yalnız Plus ile çekilir.
  const plus = () => (window.TrackedLicense ? window.TrackedLicense.isPlus() : Promise.resolve(false));
  const onInvPage = () => /\/users\/(\d+\/)?inventory/.test(location.pathname);
  let _inited = false, _lockWatch = false;

  function showLockedPanel() {
    if (_inited || !onInvPage()) { return; }
    injectStyles();
    const card = (window.TrackedLicense && window.TrackedLicense.lockCardHtml)
      ? window.TrackedLicense.lockCardHtml('Envanter Analizi', 'Envanterinin canlı Rolimons değerini ve dağılımını görmek için Tracked Plus.')
      : '';
    showPanel(`${header('Envanter Değeri')}${card}`);
  }
  function watchLockedNav() {
    if (_lockWatch) return; _lockWatch = true;
    let lastHref = location.href;
    const onUrlChange = () => {
      if (_inited) return; // Plus'a geçildi → gerçek izleyici devralır
      if (location.href === lastHref) return;
      lastHref = location.href;
      if (!onInvPage()) document.getElementById(PANEL_ID)?.remove();
      else if (!document.getElementById(PANEL_ID)) showLockedPanel();
    };
    window.addEventListener('popstate', onUrlChange);
    window.addEventListener('hashchange', onUrlChange);
    let db; new MutationObserver(() => { clearTimeout(db); db = setTimeout(onUrlChange, 350); }).observe(document.body, { childList: true, subtree: false });
    if (window._trackedInvLockPoll) clearInterval(window._trackedInvLockPoll);
    window._trackedInvLockPoll = setInterval(() => { if (location.href !== lastHref) onUrlChange(); }, 350);
  }

  const gatedStart = async () => {
    const p = await plus();
    if (p) {
      // Plus var → kilitli paneli kaldır, gerçek analizi başlat
      if (_lockWatch) { if (window._trackedInvLockPoll) { clearInterval(window._trackedInvLockPoll); window._trackedInvLockPoll = null; } document.getElementById(PANEL_ID)?.remove(); }
      if (!_inited) { _inited = true; init(); watchSpaNavigation(); }
    } else if (!_inited) {
      // Plus yok → kilitli panel + nav izleyici (veri ÇEKİLMEZ)
      showLockedPanel();
      watchLockedNav();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gatedStart);
  } else {
    gatedStart();
  }
  if (window.TrackedLicense) window.TrackedLicense.onChange(() => gatedStart());

})();
