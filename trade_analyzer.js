// trade_analyzer.js - Tracked Extension: Trade Analyzer Overlay
// Roblox /trades sayfasinda item RAP degerlerini ve trade dengesini gosterir

(function () {
  'use strict';
  if (window._trackedTradeSetup) return;
  window._trackedTradeSetup = true;

  // ─── Constants ─────────────────────────────────────────────────────────────
  const STYLE_ID  = 'tracked-trade-styles';
  const PANEL_ID  = 'tracked-trade-panel';
  const BADGE_CLS = 'ta-badge';
  const CACHE_KEY = 'tracked_rolimons_cache';
  const CACHE_TTL = 30 * 60 * 1000; // 30 dakika

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

  // ─── CSS ───────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      /* ── Floating Analysis Panel ────────────────────────────── */
      #tracked-trade-panel {
        position: fixed !important;
        right: 18px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        z-index: 2147483647 !important;
        width: 252px;
        background: rgba(11, 11, 16, 0.96) !important;
        backdrop-filter: blur(32px) saturate(1.6) !important;
        -webkit-backdrop-filter: blur(32px) saturate(1.6) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 16px !important;
        color: rgba(255,255,255,0.88) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 12px !important;
        box-shadow:
          0 16px 56px rgba(0,0,0,0.70),
          0 2px 8px rgba(0,0,0,0.40),
          inset 0 1px 0 rgba(255,255,255,0.06) !important;
        user-select: none;
        overflow: hidden;
      }

      /* Header */
      .ta-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 11px 13px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
      }
      .ta-title {
        font-size: 12.5px;
        font-weight: 650;
        color: rgba(255,255,255,0.95);
        letter-spacing: 0.015em;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ta-close {
        background: none !important;
        border: none !important;
        color: rgba(255,255,255,0.32) !important;
        cursor: pointer;
        font-size: 13px;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: color .12s, background .12s;
        flex-shrink: 0;
        padding: 0 !important;
      }
      .ta-close:hover {
        color: rgba(255,255,255,0.80) !important;
        background: rgba(255,255,255,0.08) !important;
      }

      /* Stale cache uyarisi */
      .ta-stale {
        background: rgba(255,200,0,0.08);
        color: rgba(255,210,0,0.85);
        font-size: 10px;
        padding: 5px 13px;
        border-bottom: 1px solid rgba(255,200,0,0.10);
        letter-spacing: 0.01em;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Trade taraflari */
      .ta-panel-side {
        padding: 9px 13px 10px;
      }
      .ta-side-label {
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.28);
        margin-bottom: 6px;
      }
      .ta-panel-item {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 2.5px 0;
        gap: 8px;
      }
      .ta-item-name {
        color: rgba(255,255,255,0.68);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11.5px;
      }
      .ta-item-rap {
        color: rgba(255,255,255,0.90);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        flex-shrink: 0;
        font-size: 11.5px;
      }
      .ta-item-rap.unknown { color: rgba(255,255,255,0.24); font-weight: 400; }

      /* Toplam satiri */
      .ta-panel-total {
        margin-top: 7px;
        padding-top: 7px;
        border-top: 1px solid rgba(255,255,255,0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: rgba(255,255,255,0.44);
      }
      .ta-panel-total strong {
        color: rgba(255,255,255,0.86);
        font-weight: 650;
        font-variant-numeric: tabular-nums;
        font-size: 11.5px;
      }
      .ta-empty {
        color: rgba(255,255,255,0.20);
        font-size: 11px;
        padding: 1px 0;
      }

      /* Bolme cizgisi */
      .ta-divider {
        height: 1px;
        background: rgba(255,255,255,0.055);
        margin: 0;
      }

      /* Sonuc satiri */
      .ta-result {
        padding: 10px 13px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11.5px;
        font-weight: 600;
        border-top: 1px solid rgba(255,255,255,0.055);
        gap: 8px;
        border-radius: 0 0 16px 16px;
      }
      .ta-result.balanced {
        color: #FFD60A;
        background: rgba(255,214,10,0.06);
      }
      .ta-result.gain {
        color: #30D158;
        background: rgba(48,209,88,0.07);
      }
      .ta-result.loss {
        color: #FF453A;
        background: rgba(255,69,58,0.07);
      }
      .ta-result.advantage {
        color: rgba(255,255,255,0.75);
        background: rgba(255,255,255,0.03);
      }
      .ta-result-sub {
        font-size: 10.5px;
        font-weight: 500;
        opacity: 0.72;
        white-space: nowrap;
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
      }

      /* ── Item Badges (kose etiketi) ─────────────────────── */
      .${BADGE_CLS} {
        position: absolute !important;
        top: 3px !important;
        left: 3px !important;
        background: rgba(6, 6, 14, 0.90) !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        border: 1px solid rgba(255,255,255,0.09) !important;
        border-radius: 7px !important;
        padding: 3px 6px 4px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        pointer-events: none !important;
        z-index: 2147483640 !important;
        line-height: 1 !important;
        min-width: 42px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.45) !important;
      }
      .ta-badge-rap {
        font-size: 10px;
        font-weight: 700;
        color: rgba(255,255,255,0.92);
        line-height: 1.4;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.01em;
      }
      .ta-badge-demand {
        display: flex;
        align-items: center;
        gap: 2px;
        margin-top: 2px;
      }
      .ta-d-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: rgba(255,255,255,0.12);
        display: inline-block;
        flex-shrink: 0;
      }
      .ta-d-dot.on { background: currentColor; }

      /* Flag pill'leri (Projected / Rare / Hyped) */
      .ta-flags { display:flex; gap:3px; margin-top:3px; flex-wrap:wrap; }
      .ta-flag   { font-size:7px; font-weight:800; letter-spacing:0.06em; line-height:1; }

      /* Trend göstergesi */
      .ta-trend-up   { color:#30D158 !important; font-size:8px; }
      .ta-trend-down { color:#FF453A !important; font-size:8px; }

      /* Geçmiş butonu (panel header'da) */
      .ta-hist-btn {
        background:none !important; border:none !important;
        color:rgba(255,255,255,0.32) !important; cursor:pointer;
        width:22px; height:22px; display:flex; align-items:center; justify-content:center;
        border-radius:6px; transition:color .12s, background .12s; flex-shrink:0; padding:0 !important;
      }
      .ta-hist-btn:hover, .ta-hist-btn.ta-active {
        color:rgba(255,255,255,0.80) !important; background:rgba(255,255,255,0.08) !important;
      }
      .ta-header-actions { display:flex; align-items:center; gap:3px; }
      .ta-refresh-btn {
        background:none !important; border:none !important;
        color:rgba(255,255,255,0.32) !important; cursor:pointer;
        width:22px; height:22px; display:flex; align-items:center; justify-content:center;
        border-radius:6px; transition:color .12s, background .12s; flex-shrink:0; padding:0 !important;
      }
      .ta-refresh-btn:hover { color:rgba(255,255,255,0.80) !important; background:rgba(255,255,255,0.08) !important; }
      .ta-refresh-btn.spinning svg { animation: ta-spin 1s linear infinite; }
      @keyframes ta-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      /* Canlı floor satırları */
      .ta-item-value-wrap { display:flex; flex-direction:column; align-items:flex-end; gap:1px; flex-shrink:0; }
      .ta-item-sub { font-size:9px; color:rgba(255,255,255,0.32); font-variant-numeric:tabular-nums; display:flex; align-items:center; gap:3px; }
      .ta-diff { font-size:9px; font-weight:600; padding:1px 4px; border-radius:3px; font-variant-numeric:tabular-nums; }
      .ta-diff.up { color:#30D158; background:rgba(48,209,88,0.10); }
      .ta-diff.dn { color:#FF453A; background:rgba(255,69,58,0.10); }
      .ta-diff.flat { color:rgba(255,255,255,0.40); background:rgba(255,255,255,0.05); }
      .ta-live-badge { font-size:8.5px; font-weight:600; color:#30D158; background:rgba(48,209,88,0.12); padding:1.5px 5px; border-radius:3px; display:inline-flex; align-items:center; gap:3px; }
      .ta-live-badge::before { content:''; width:4px; height:4px; border-radius:50%; background:#30D158; animation:ta-pulse 2s ease-in-out infinite; }
      @keyframes ta-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      .ta-live-meta { display:flex; align-items:center; gap:5px; margin-top:4px; font-size:9px; color:rgba(255,255,255,0.30); }
      .ta-total-sub { font-size:9.5px; color:rgba(255,255,255,0.40); font-weight:400; margin-top:2px; display:block; }

      /* Quick action butonları (her item satırında) */
      .ta-item-actions {
        display:flex; align-items:center; gap:4px; margin-left:6px;
        opacity:0; transition:opacity .15s;
      }
      .ta-panel-item:hover .ta-item-actions { opacity:1; }
      .ta-item-link {
        width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center;
        color:rgba(255,255,255,0.40) !important; cursor:pointer; border-radius:4px;
        text-decoration:none !important; transition:color .12s, background .12s;
      }
      .ta-item-link:hover { color:rgba(255,255,255,0.95) !important; background:rgba(255,255,255,0.10); }
      .ta-item-link.rol:hover { color:#FFD60A !important; background:rgba(255,214,10,0.10); }

      /* Win-Rate Dashboard (trade history view başında) */
      .ta-stats-dash {
        display:grid; grid-template-columns:1fr 1fr; gap:8px;
        padding:10px 13px 12px; border-bottom:1px solid rgba(255,255,255,0.06);
        background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0));
      }
      .ta-stat-card {
        background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.05);
        border-radius:8px; padding:8px 10px;
      }
      .ta-stat-card.full { grid-column:1 / -1; }
      .ta-stat-label {
        display:flex; align-items:center; gap:4px;
        font-size:9.5px; color:rgba(255,255,255,0.45);
        text-transform:uppercase; letter-spacing:0.04em; font-weight:600;
        margin-bottom:3px;
      }
      .ta-stat-value {
        font-size:15px; font-weight:700; color:rgba(255,255,255,0.95);
        font-variant-numeric:tabular-nums; letter-spacing:-0.01em;
        display:flex; align-items:center; gap:5px;
      }
      .ta-stat-value.pos { color:#30D158; }
      .ta-stat-value.neg { color:#FF453A; }
      .ta-stat-value.flat { color:rgba(255,255,255,0.85); }
      .ta-stat-sub { font-size:9.5px; color:rgba(255,255,255,0.40); margin-top:2px; }
      .ta-stat-bar {
        margin-top:6px; height:4px; background:rgba(255,255,255,0.06);
        border-radius:2px; overflow:hidden;
      }
      .ta-stat-bar-fill {
        height:100%; background:#30D158; border-radius:2px;
        transition: width .3s ease;
      }
      .ta-stat-bar-fill.warn { background:#FFD60A; }
      .ta-stat-bar-fill.bad { background:#FF453A; }

      /* Boş history için stats placeholder */
      .ta-stats-empty {
        padding:14px 13px; font-size:10.5px; color:rgba(255,255,255,0.35);
        text-align:center; line-height:1.55;
      }
      .ta-floor-trend { font-size:8.5px; font-weight:600; display:inline-flex; align-items:center; gap:1px; margin-left:3px; }
      .ta-floor-trend.up { color:#30D158; }
      .ta-floor-trend.down { color:#FF453A; }
      .ta-diag {
        padding:5px 13px 7px; font-size:8.5px; font-family:'SF Mono','Monaco',Consolas,monospace;
        color:rgba(255,255,255,0.36); line-height:1.6; border-top:1px solid rgba(255,255,255,0.05);
        background:rgba(255,255,255,0.015); cursor:pointer;
      }
      .ta-diag b { color:rgba(255,255,255,0.65); font-weight:600; }
      .ta-diag.expanded { white-space:pre-wrap; word-break:break-all; }
      .ta-diag-tag { display:inline-block; padding:0 5px; border-radius:3px; margin-right:3px; font-size:8.5px; }
      .ta-diag-tag.ok { color:#30D158; background:rgba(48,209,88,0.08); }
      .ta-diag-tag.warn { color:#FFD60A; background:rgba(255,200,0,0.08); }
      .ta-diag-tag.err { color:#FF453A; background:rgba(255,69,58,0.08); }

      /* Geçmiş view */
      .ta-view-history { overflow-y:auto; max-height:340px; padding:4px 0; }
      .ta-hist-empty {
        padding:18px 13px; color:rgba(255,255,255,0.28); font-size:11px;
        line-height:1.55; text-align:center;
      }
      .ta-hist-item { border-bottom:1px solid rgba(255,255,255,0.04); }
      .ta-hist-row  { display:flex; align-items:center; padding:7px 13px; gap:7px; }
      .ta-hist-outcome { flex-shrink:0; display:flex; align-items:center; }
      .ta-hist-accepted { color:#30D158; }
      .ta-hist-declined { color:#FF453A; }
      .ta-hist-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
      .ta-hist-diff { font-weight:650; font-size:11.5px; font-variant-numeric:tabular-nums; }
      .ta-hist-diff.pos { color:#30D158; }
      .ta-hist-diff.neg { color:#FF453A; }
      .ta-hist-date { font-size:9.5px; color:rgba(255,255,255,0.28); }
      .ta-hist-tog  {
        background:none !important; border:none !important;
        color:rgba(255,255,255,0.28) !important; cursor:pointer;
        font-size:10px; padding:2px 4px !important; flex-shrink:0;
      }
      .ta-hist-detail { padding:0 13px 9px; }
      .ta-hist-sides  { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:5px; }
      .ta-hist-slabel {
        font-size:8px; font-weight:700; letter-spacing:0.09em; text-transform:uppercase;
        color:rgba(255,255,255,0.22); margin-bottom:3px; display:block;
      }
      .ta-hist-ditem {
        display:flex; justify-content:space-between; font-size:10px;
        color:rgba(255,255,255,0.55); padding:1.5px 0; gap:4px;
      }
      .ta-hist-ditem span:last-child {
        color:rgba(255,255,255,0.82); font-weight:600; font-variant-numeric:tabular-nums; flex-shrink:0;
      }
      .ta-hist-clear {
        display:block; width:calc(100% - 26px); margin:6px 13px;
        background:rgba(255,255,255,0.05) !important; border:1px solid rgba(255,255,255,0.08) !important;
        color:rgba(255,255,255,0.40) !important; cursor:pointer; font-size:10px;
        padding:5px 0 !important; border-radius:7px; text-align:center;
        transition:background .12s, color .12s;
      }
      .ta-hist-clear:hover { background:rgba(255,60,60,0.12) !important; color:#FF453A !important; }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ─── Rolimons — Service Worker üzerinden (CORS bypass) ────────────────────
  async function fetchRolimons() {
    // Önce cache kontrol
    const stored = await storeGet(CACHE_KEY);
    const cached = stored[CACHE_KEY];
    if (cached?.data && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
      return { data: cached.data, stale: false };
    }

    // SW'ye mesaj gönder — SW extension origin'den fetch eder (CORS yok)
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage({ action: 'fetchRolimonsData' }, async resp => {
          if (chrome.runtime.lastError) {
            console.warn('[TradeAnalyzer] SW hatasi:', chrome.runtime.lastError.message);
            resolve(cached?.data ? { data: cached.data, stale: true } : { data: null });
            return;
          }
          if (!resp?.ok || !resp.items) {
            console.warn('[TradeAnalyzer] Rolimons verisi alinamadi:', resp?.error);
            resolve(cached?.data ? { data: cached.data, stale: true } : { data: null });
            return;
          }
          await storeSet({ [CACHE_KEY]: { data: resp.items, fetchedAt: Date.now() } });
          resolve({ data: resp.items, stale: false });
        });
      } catch (e) {
        resolve(cached?.data ? { data: cached.data, stale: true } : { data: null });
      }
    });
  }

  // ─── Item ID Çıkarma (3-layer fallback) ───────────────────────────────────
  function extractItemId(container) {
    for (const a of container.querySelectorAll('a[href]')) {
      const m = (a.getAttribute('href') || '').match(/\/catalog\/(\d+)/);
      if (m) return m[1];
    }
    for (const img of container.querySelectorAll('img[src]')) {
      const src = img.getAttribute('src') || '';
      const m = src.match(/[?&]assetIds?=(\d+)/i)
             || src.match(/[?&]assetId=(\d+)/i)
             || src.match(/\/thumbnail\/(\d+)/);
      if (m) return m[1];
    }
    const d = container.querySelector('[data-item-id],[data-asset-id],[data-itemid]');
    if (d) return d.getAttribute('data-item-id') || d.getAttribute('data-asset-id') || d.getAttribute('data-itemid');
    return null;
  }

  function extractItemName(container) {
    for (const sel of ['[class*="name" i]', '[class*="title" i]', 'p', 'span']) {
      for (const el of container.querySelectorAll(sel)) {
        const t = el.textContent?.trim();
        if (t && t.length > 1 && t.length < 80 && !/^\d+$/.test(t)) return t;
      }
    }
    return null;
  }

  // ─── Trade DOM Tespiti ────────────────────────────────────────────────────
  const OFFER_SELS = [
    '[class*="TradeOffer" i]', '[class*="tradeOffer" i]',
    '[class*="OfferSection" i]', '[class*="offerSection" i]',
    '[class*="ItemsList" i]', '[class*="itemsList" i]',
    '[class*="TradeItemList" i]', '[class*="tradeItemList" i]',
    // Test mock selector
    '[class*="TradeOfferSection" i]',
  ];

  const ITEM_CARD_SELS = [
    '[class*="TradeItemTile" i]', '[class*="tradeItemTile" i]',
    '[class*="ItemCard" i]', '[class*="itemCard" i]',
    '[class*="item-card" i]',
    '[class*="TradeItem" i]:not([class*="List" i]):not([class*="list" i])',
    // Test mock selector
    '[class*="TradeItem"][class*="Tile" i]',
  ];

  function findItemCards(root) {
    for (const sel of ITEM_CARD_SELS) {
      const cards = root.querySelectorAll(sel);
      if (cards.length > 0) return [...cards];
    }
    // Fallback: thumbnail URL'si olan img'lerin container'larini bul
    const imgs = root.querySelectorAll('img[src*="thumbnails.roblox.com"], img[src*="rbxcdn.com"]');
    if (!imgs.length) return [];
    const seen = new Set();
    return [...imgs].map(img => {
      let el = img.parentElement;
      while (el && el !== root) {
        if (el.querySelector('a[href*="/catalog/"]')) return el;
        el = el.parentElement;
      }
      return img.parentElement;
    }).filter(el => el && !seen.has(el) && seen.add(el));
  }

  function extractItemsFromContainer(container) {
    if (!container) return [];
    return findItemCards(container)
      .map(card => ({ el: card, id: extractItemId(card), name: extractItemName(card) }))
      .filter(item => item.id);
  }

  function findTradeSections() {
    for (const sel of OFFER_SELS) {
      const found = document.querySelectorAll(sel);
      if (found.length >= 2) return [found[0], found[1]];
    }
    // Fallback: item card'larin parent'larini say
    for (const cardSel of ITEM_CARD_SELS) {
      const allCards = document.querySelectorAll(cardSel);
      if (allCards.length < 2) continue;
      const counter = new Map();
      allCards.forEach(c => { const p = c.parentElement; if (p) counter.set(p, (counter.get(p) || 0) + 1); });
      const sorted = [...counter.entries()].sort((a, b) => b[1] - a[1]);
      if (sorted.length >= 2) return [sorted[0][0], sorted[1][0]];
    }
    return null;
  }

  function getSectionLabel(container, fallback) {
    // Önce container IÇINDEN bak (en güvenilir — kendi başlığı)
    const h = container.querySelector('h1,h2,h3,h4,h5,[class*="header" i],[class*="username" i],[class*="title" i]');
    if (h?.textContent?.trim()) return h.textContent.trim();

    // Önceki kardeş basit bir etiket mi?
    // Catalog linki veya thumbnail içeriyorsa başka bir section'dır, etiket değil
    const prev = container.previousElementSibling;
    if (prev
        && !prev.querySelector('a[href*="/catalog/"]')
        && !prev.querySelector('img[src*="thumbnails"]')
        && !prev.querySelector('img[src*="rbxcdn"]')) {
      const t = prev.textContent?.trim();
      if (t && t.length > 0 && t.length < 55) return t;
    }
    return fallback;
  }

  // ─── Formatlama ───────────────────────────────────────────────────────────
  function formatRAP(n) {
    if (!n || n <= 0) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 100_000)   return Math.round(n / 1_000) + 'K';
    if (n >= 10_000)    return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString('tr-TR');
  }

  const DEMAND_COLORS = ['#FF453A','#FF6B35','#FFD60A','#8FE35C','#30D158','#00E676'];
  const DEMAND_LABELS = ['Çok Düşük','Düşük','Normal','İyi','Yüksek','Çok Yüksek'];

  // ─── SVG İkon Sabitleri ───────────────────────────────────────────────────
  // Header: iki karşıt ok → trade/exchange kavramı
  const ICON_TRADE = `<svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.82"><line x1="1" y1="3" x2="11" y2="3"/><polyline points="9,1 11,3 9,5"/><line x1="13" y1="8" x2="3" y2="8"/><polyline points="5,6 3,8 5,10"/></svg>`;
  // Badge RAP: elmas (limited item değer göstergesi)
  const ICON_DIAMOND = `<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style="flex-shrink:0;opacity:.60;display:inline-block;vertical-align:middle;margin-right:2px"><path d="M4 0.5L7.5 4L4 7.5L0.5 4Z"/></svg>`;
  // Dengeli: terazi
  const ICON_SCALE = `<svg width="12" height="11" viewBox="0 0 12 11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" style="flex-shrink:0;opacity:.9;margin-right:5px;vertical-align:middle"><line x1="6" y1="0.5" x2="6" y2="10"/><line x1="0.5" y1="2.5" x2="11.5" y2="2.5"/><path d="M0.5 2.5 Q0.5 5.5 3 5.5 Q5.5 5.5 5.5 2.5"/><path d="M11.5 2.5 Q11.5 5.5 9 5.5 Q6.5 5.5 6.5 2.5"/><line x1="3.5" y1="10" x2="8.5" y2="10"/></svg>`;
  // Stale uyarı: üçgen uyarı
  const ICON_WARN = `<svg width="12" height="11" viewBox="0 0 12 11" fill="none" style="flex-shrink:0;opacity:.9"><path d="M5.268 1.134a.8.8 0 011.464 0l4.8 8.4A.8.8 0 0110.8 10.8H1.2a.8.8 0 01-.732-1.266l4.8-8.4Z" fill="currentColor" opacity=".18"/><path d="M5.268 1.134a.8.8 0 011.464 0l4.8 8.4A.8.8 0 0110.8 10.8H1.2a.8.8 0 01-.732-1.266l4.8-8.4Z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><rect x="5.4" y="4.2" width="1.2" height="3" rx="0.5" fill="currentColor"/><circle cx="6" cy="8.8" r="0.7" fill="currentColor"/></svg>`;
  // Geçmiş: saat
  const ICON_HISTORY = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" style="flex-shrink:0"><circle cx="6" cy="6" r="5"/><polyline points="6,3.5 6,6 7.8,7.2"/></svg>`;
  const ICON_REFRESH_TA = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M13.5 8a5.5 5.5 0 11-1.61-3.89"/><path d="M13.5 2v3h-3"/></svg>`;
  const ICON_EXTERNAL = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 1H9V4.5"/><line x1="4" y1="6" x2="9" y2="1"/><path d="M7 5.5V9H1V3H4.5"/></svg>`;
  const ICON_ROLIMONS = `<svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><path d="M5.5 0L7 4H11L7.7 6.4L9 10L5.5 7.8L2 10L3.3 6.4L0 4H4L5.5 0Z"/></svg>`;
  const ICON_TROPHY = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M3 2h6v3a3 3 0 01-6 0V2z"/><path d="M3 3.5H1.5V5a1.5 1.5 0 001.5 1.5"/><path d="M9 3.5h1.5V5A1.5 1.5 0 019 6.5"/><line x1="4.5" y1="10.5" x2="7.5" y2="10.5"/><line x1="6" y1="8" x2="6" y2="10.5"/></svg>`;
  // Madalya/ödül ikonu — En İyi trade için (yıldız+çelenk)
  const ICON_MEDAL  = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M3.5 1L6 4.5L8.5 1"/><circle cx="6" cy="8" r="3.2"/><path d="M6 6.5l.6 1.3 1.4.2-1 1 .2 1.4L6 9.7l-1.2.7.2-1.4-1-1 1.4-.2z" fill="currentColor" stroke="none"/></svg>`;
  // Aşağı ok ikonu — En Kötü trade için (kayıp/düşüş)
  const ICON_DOWNTREND = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="1.5,3 5,6.5 7,4.5 10.5,8"/><polyline points="8,8 10.5,8 10.5,5.5"/></svg>`;
  // Takvim ikonu — Son 30 Gün için
  const ICON_CALENDAR = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="1.5" y="2.5" width="9" height="8" rx="1"/><line x1="1.5" y1="5" x2="10.5" y2="5"/><line x1="3.5" y1="1.5" x2="3.5" y2="3.5"/><line x1="8.5" y1="1.5" x2="8.5" y2="3.5"/></svg>`;
  const TA_AUTO_REFRESH_MS = 5 * 60 * 1000; // 5dk

  // Canlı floor (Best Price) cache + state
  const floorState = {
    map: new Map(),          // id → { price: number|null, fetchedAt: number, source: string }
    historyMap: new Map(),   // id → [{ p, t }, ...] price snapshots
    loading: false,
    lastUpdate: 0,
    rateLimited: false,
    autoTimer: null,
    lastDiag: null,
  };
  // Kazançlı: tik
  const ICON_CHECK =`<svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.9;margin-right:5px;vertical-align:middle"><polyline points="1,5.5 4.5,9 11,1"/></svg>`;
  // Kayıplı: çarpı
  const ICON_CROSS = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;opacity:.9;margin-right:5px;vertical-align:middle"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>`;

  function getDemandInfo(d) {
    if (d == null || d < 0 || d > 5) return { color: 'rgba(255,255,255,0.18)', dots: -1, label: '' };
    return { color: DEMAND_COLORS[d], dots: d, label: DEMAND_LABELS[d] };
  }

  function demandDotsHTML(d) {
    const info = getDemandInfo(d);
    if (info.dots < 0) return '';
    return Array.from({ length: 5 }, (_, i) =>
      `<span class="ta-d-dot${i < info.dots ? ' on' : ''}" style="${i < info.dots ? `color:${info.color}` : ''}"></span>`
    ).join('');
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  // ─── Badge Render ─────────────────────────────────────────────────────────
  function clearBadges() {
    document.querySelectorAll(`.${BADGE_CLS}`).forEach(b => b.remove());
  }

  function getItemData(id, data) {
    return data[id] || data[String(id)] || null;
  }

  function renderBadges(allItems, itemsData) {
    clearBadges();
    allItems.forEach(({ el, id }) => {
      if (!id || !el) return;
      const info  = getItemData(id, itemsData);
      const rap    = info?.[2] || 0;
      const demand = info != null ? (info[5] ?? -1) : -1;
      const dInfo  = getDemandInfo(demand);

      if (window.getComputedStyle(el).position === 'static')
        el.style.setProperty('position', 'relative', 'important');

      const badge = document.createElement('div');
      badge.className = BADGE_CLS;

      const rapHtml = rap > 0
        ? `${ICON_DIAMOND}${escapeHtml(formatRAP(rap))}`
        : `<span style="color:rgba(255,255,255,0.25)">—</span>`;

      const dotsHtml = demandDotsHTML(demand);

      const flags = [];
      if (info?.[7] === 1) flags.push({ l: 'PRJ',  c: '#A78BFA' });
      if (info?.[8] === 1) flags.push({ l: 'HYP',  c: '#EC4899' });
      if (info?.[9] === 1) flags.push({ l: 'RARE', c: '#F59E0B' });
      const flagsHtml = flags.length
        ? `<div class="ta-flags">${flags.map(f => `<span class="ta-flag" style="color:${f.c}">${f.l}</span>`).join('')}</div>`
        : '';

      badge.innerHTML = `
        <div class="ta-badge-rap">${rapHtml}</div>
        ${dotsHtml ? `<div class="ta-badge-demand" style="color:${dInfo.color}">${dotsHtml}</div>` : ''}
        ${flagsHtml}
      `;
      el.appendChild(badge);
    });
  }

  // ─── Panel Render ─────────────────────────────────────────────────────────
  // Bir item'ın floor (Best Price) değerini döndür; yoksa null.
  function getFloor(id) {
    const entry = floorState.map.get(String(id));
    return (entry && typeof entry.price === 'number' && entry.price > 0) ? entry.price : null;
  }
  // Bir item'ın değerlendirme değeri: floor varsa floor, yoksa RAP.
  function getItemValue(id, itemsData) {
    const floor = getFloor(id);
    if (floor !== null) return floor;
    const info = getItemData(id, itemsData);
    return info?.[2] || 0;
  }

  function buildItemRowHTML(item, itemsData) {
    const info  = getItemData(item.id, itemsData);
    const name  = info?.[0] || item.name || `#${item.id}`;
    const rap   = info?.[2] || 0;
    const floor = getFloor(item.id);
    const trend = info?.[6] ?? 0;
    const short = name.length > 22 ? name.substring(0, 20) + '…' : name;
    const trendHtml = trend > 0
      ? ' <span class="ta-trend-up">▲</span>'
      : trend < 0 ? ' <span class="ta-trend-down">▼</span>' : '';

    const floorTrend = floor !== null ? computeFloorTrend(item.id, floor) : null;
    const floorTrendHtml = floorTrend
      ? (floorTrend.dir === 'up'   ? `<span class="ta-floor-trend up">▲${floorTrend.pct}%</span>`
       : floorTrend.dir === 'down' ? `<span class="ta-floor-trend down">▼${Math.abs(floorTrend.pct)}%</span>`
       : '')
      : '';

    let valueCell;
    if (floor !== null && rap > 0 && Math.abs(floor - rap) / rap > 0.005) {
      const diff = floor - rap;
      const pct = Math.round((diff / rap) * 100);
      const dirCls = diff > 0 ? 'up' : 'dn';
      const sign = diff > 0 ? '+' : '';
      valueCell = `<div class="ta-item-value-wrap">
        <span class="ta-item-rap">${formatRAP(floor)}${floorTrendHtml}</span>
        <div class="ta-item-sub"><span>RAP ${formatRAP(rap)}</span><span class="ta-diff ${dirCls}">${sign}${pct}%</span></div>
      </div>`;
    } else if (floor !== null) {
      valueCell = `<div class="ta-item-value-wrap">
        <span class="ta-item-rap">${formatRAP(floor)}${floorTrendHtml}</span>
        <div class="ta-item-sub">canlı · RAP eşit</div>
      </div>`;
    } else {
      valueCell = `<span class="ta-item-rap${rap <= 0 ? ' unknown' : ''}">${formatRAP(rap)}</span>`;
    }

    return `<div class="ta-panel-item" data-item-id="${escapeHtml(String(item.id))}">
      <span class="ta-item-name" title="${escapeHtml(name)}">${escapeHtml(short)}${trendHtml}</span>
      ${valueCell}
      <span class="ta-item-actions">
        <a class="ta-item-link" href="https://www.roblox.com/catalog/${escapeHtml(String(item.id))}" target="_blank" rel="noopener" title="Roblox Catalog'ta aç" onclick="event.stopPropagation()">${ICON_EXTERNAL}</a>
        <a class="ta-item-link rol" href="https://www.rolimons.com/item/${escapeHtml(String(item.id))}" target="_blank" rel="noopener" title="Rolimons sayfasında aç" onclick="event.stopPropagation()">${ICON_ROLIMONS}</a>
      </span>
    </div>`;
  }

  function getTotalRAP(items, itemsData) {
    return items.reduce((s, it) => s + (getItemData(it.id, itemsData)?.[2] || 0), 0);
  }
  function getTotalValue(items, itemsData) {
    return items.reduce((s, it) => s + getItemValue(it.id, itemsData), 0);
  }

  function renderPanel(sideA, sideB, labelA, labelB, itemsData, stale) {
    document.getElementById(PANEL_ID)?.remove();

    // Değerlendirme için canlı floor varsa onu kullan, yoksa RAP'e fallback.
    const totalA = getTotalValue(sideA, itemsData);
    const totalB = getTotalValue(sideB, itemsData);
    const rapA   = getTotalRAP(sideA, itemsData);
    const rapB   = getTotalRAP(sideB, itemsData);
    const hasFloor = [...sideA, ...sideB].some(it => getFloor(it.id) !== null);
    const base   = Math.min(totalA, totalB);
    const diff   = Math.abs(totalA - totalB);
    const pct    = base > 0 ? Math.round((diff / base) * 100) : 0;
    const isBalanced = pct < 10;

    // Hangi taraf "alıyor" (receiving) → label metniyle belirle
    const RE_RECV = /ali[yı]yor|receiv|request/i;
    const RE_GIVE = /veriyor|offer|give|giving/i;
    let receivingTotal = null;
    if      (RE_RECV.test(labelB) || RE_GIVE.test(labelA)) receivingTotal = totalB;
    else if (RE_RECV.test(labelA) || RE_GIVE.test(labelB)) receivingTotal = totalA;

    // userGains: kullanıcının net kazancı (RAP). null = yön belirlenemedi
    let userGains = null;
    let resultClass, resultText, subText;
    if (isBalanced) {
      userGains   = 0;
      resultClass = 'balanced';
      resultText  = `${ICON_SCALE}Dengeli`;
      subText     = `±${pct}%${diff > 0 ? '  ' + formatRAP(diff) + ' RAP' : ''}`;
    } else if (receivingTotal !== null) {
      const offerTotal = receivingTotal === totalB ? totalA : totalB;
      userGains   = receivingTotal - offerTotal;
      const youWin = userGains > 0;
      resultClass = youWin ? 'gain' : 'loss';
      resultText  = youWin ? `${ICON_CHECK}Kazançlı` : `${ICON_CROSS}Kayıplı`;
      subText     = youWin
        ? `+${formatRAP(diff)} RAP · +${pct}%`
        : `-${formatRAP(diff)} RAP · -${pct}%`;
    } else {
      const higherLabel = totalA >= totalB ? labelA : labelB;
      resultClass = 'advantage';
      resultText  = `${escapeHtml(higherLabel)} fazla`;
      subText     = `+${formatRAP(diff)} RAP · +${pct}%`;
    }

    const totalLabelA = hasFloor && rapA !== totalA
      ? `<strong>${formatRAP(totalA)}<span class="ta-total-sub">RAP ${formatRAP(rapA)}</span></strong>`
      : `<strong>${formatRAP(totalA)} RAP</strong>`;
    const totalLabelB = hasFloor && rapB !== totalB
      ? `<strong>${formatRAP(totalB)}<span class="ta-total-sub">RAP ${formatRAP(rapB)}</span></strong>`
      : `<strong>${formatRAP(totalB)} RAP</strong>`;

    const liveStrip = hasFloor
      ? `<div class="ta-live-meta">
           <span class="ta-live-badge">CANLI</span>
           <span>floor fiyatları · ${taRelativeTime(floorState.lastUpdate)}</span>
         </div>`
      : (floorState.loading
          ? `<div class="ta-live-meta"><span>canlı fiyatlar yükleniyor…</span></div>`
          : '');

    // Diagnostics — MAIN-FAIL artık sadece fresh fetch denemesine rağmen başarısız olduysa gösterilir.
    const diag = floorState.lastDiag;
    const attemptedFresh = diag && (diag.requested > 0) && (diag.cacheHits < diag.requested);
    const mainFailed = attemptedFresh && !diag.mainWorldUsed && (diag.catalogOk + diag.resellersOk) === 0;
    const hasIssue = diag && (
      diag.rateLimited || (diag.errors?.length > 0) || mainFailed
    );
    const diagHtml = diag ? `
      <div class="ta-diag${hasIssue ? ' expanded' : ''}" title="Tıkla — tanı detayları">
        ${diag.catalogOk > 0 ? `<span class="ta-diag-tag ok">CATALOG ${diag.catalogOk}</span>` : ''}
        ${diag.resellersOk > 0 ? `<span class="ta-diag-tag ok">RESELLERS ${diag.resellersOk}</span>` : ''}
        ${diag.cacheHits > 0 ? `<span class="ta-diag-tag">CACHE ${diag.cacheHits}</span>` : ''}
        ${diag.catalogNull > 0 ? `<span class="ta-diag-tag warn">NULL ${diag.catalogNull}</span>` : ''}
        ${diag.rateLimited ? `<span class="ta-diag-tag err">RATE-LIMIT</span>` : ''}
        ${mainFailed ? `<span class="ta-diag-tag warn">MAIN-FAIL</span>` : ''}
        ${diag.errors?.length ? `<span class="ta-diag-tag err">ERR ${diag.errors.length}</span>` : ''}
        ${hasIssue && diag.errors?.length ? `<br><b>errors:</b><br>${diag.errors.map(e => escapeHtml(e)).join('<br>')}` : ''}
      </div>` : '';

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="ta-header">
        <span class="ta-title">${ICON_TRADE}Trade Analyzer</span>
        <div class="ta-header-actions">
          <button class="ta-refresh-btn" title="Canlı fiyatları yenile">${ICON_REFRESH_TA}</button>
          <button class="ta-hist-btn" title="Trade Geçmişi">${ICON_HISTORY}</button>
          <button class="ta-close" title="Kapat">&#x2715;</button>
        </div>
      </div>
      <div class="ta-view-analysis">
        ${stale ? `<div class="ta-stale">${ICON_WARN}Önbellekten — değerler eskişmiş olabilir</div>` : ''}
        ${floorState.rateLimited ? `<div class="ta-stale">${ICON_WARN}Roblox rate-limit — birkaç dakika sonra tekrar denenecek</div>` : ''}
        ${liveStrip}
        <div class="ta-panel-side">
          <div class="ta-side-label">${escapeHtml(labelA)}</div>
          ${sideA.length ? sideA.map(it => buildItemRowHTML(it, itemsData)).join('') : '<div class="ta-empty">—</div>'}
          <div class="ta-panel-total"><span>Toplam</span>${totalLabelA}</div>
        </div>
        <div class="ta-divider"></div>
        <div class="ta-panel-side">
          <div class="ta-side-label">${escapeHtml(labelB)}</div>
          ${sideB.length ? sideB.map(it => buildItemRowHTML(it, itemsData)).join('') : '<div class="ta-empty">—</div>'}
          <div class="ta-panel-total"><span>Toplam</span>${totalLabelB}</div>
        </div>
        <div class="ta-result ${resultClass}">
          <span>${resultText}</span>
          <span class="ta-result-sub">${subText}</span>
        </div>
        ${diagHtml}
      </div>
      <div class="ta-view-history" style="display:none"></div>
    `;

    (document.documentElement || document.body).appendChild(panel);
    panel.querySelector('.ta-close').addEventListener('click', () => {
      panel.remove();
      stopTaAutoRefresh();
    });
    panel.querySelector('.ta-refresh-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      loadFloorPricesForTrade([...sideA, ...sideB], true);
    });
    panel.querySelector('.ta-diag')?.addEventListener('click', e => {
      e.currentTarget.classList.toggle('expanded');
    });
    panel.querySelector('.ta-hist-btn').addEventListener('click', () => {
      const analysisEl = panel.querySelector('.ta-view-analysis');
      const historyEl  = panel.querySelector('.ta-view-history');
      const btn        = panel.querySelector('.ta-hist-btn');
      const showing    = historyEl.style.display !== 'none';
      analysisEl.style.display = showing ? '' : 'none';
      historyEl.style.display  = showing ? 'none' : '';
      btn.classList.toggle('ta-active', !showing);
      if (!showing) renderHistoryView(historyEl);
    });

    // Kabul/Ret butonlarını izle
    hookTradeButtons(totalA, totalB, labelA, labelB, sideA, sideB, itemsData, userGains);
  }

  // ─── Trade History ────────────────────────────────────────────────────────
  const HISTORY_KEY = 'tracked_trade_history';

  function formatDate(ts) {
    const d = new Date(ts), now = Date.now(), diff = now - ts;
    if (diff < 60000)      return 'Az önce';
    if (diff < 3600000)    return `${Math.floor(diff / 60000)}dk önce`;
    if (diff < 86400000)   return `${Math.floor(diff / 3600000)}sa önce`;
    if (diff < 172800000)  return 'Dün';
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }

  async function saveTrade(outcome, snapshot) {
    if (!snapshot) return;
    const stored  = await storeGet(HISTORY_KEY);
    const history = stored[HISTORY_KEY] || [];
    history.unshift({ id: Date.now(), outcome, timestamp: Date.now(), ...snapshot });
    if (history.length > 100) history.length = 100;
    await storeSet({ [HISTORY_KEY]: history });
  }

  function hookTradeButtons(totalA, totalB, labelA, labelB, sideA, sideB, itemsData, userGains) {
    const snapshot = {
      labelA, labelB, totalA, totalB, userGains,
      itemsA: sideA.map(it => ({ id: it.id, name: getItemData(it.id, itemsData)?.[0] || it.name || it.id, rap: getItemData(it.id, itemsData)?.[2] || 0 })),
      itemsB: sideB.map(it => ({ id: it.id, name: getItemData(it.id, itemsData)?.[0] || it.name || it.id, rap: getItemData(it.id, itemsData)?.[2] || 0 })),
    };
    document.querySelectorAll('button:not([data-ta-h])').forEach(btn => {
      const txt = (btn.textContent || '').trim();
      const isAccept  = /accept|kabul/i.test(txt);
      const isDecline = /decline|reddet|reject/i.test(txt);
      if (!isAccept && !isDecline) return;
      btn.dataset.taH = '1';
      btn.addEventListener('click', () => {
        // Roblox'un olası onay dialogunu bekle; buton disabled/kalktıysa trade gerçekleşmiştir
        setTimeout(async () => {
          if (!document.contains(btn) || btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
            await saveTrade(isAccept ? 'accepted' : 'declined', snapshot);
          }
        }, 600);
      }, { capture: true, once: true });
    });
  }

  // ─── Win-Rate Dashboard Stats ─────────────────────────────────────────────
  // Trade history'den özet istatistikler hesaplar:
  //   • Win rate (kabul edilen kazançlı / toplam kabul)
  //   • Toplam net kâr/zarar (yalnız kabul edilen tradeler)
  //   • Ortalama kazanç per trade
  //   • En iyi & en kötü trade
  //   • Son 30 günde trade aktivitesi (sayı + net)
  function computeTradeStats(history) {
    if (!history?.length) return null;
    const accepted = history.filter(h => h.outcome === 'accepted' && typeof (h.userGains ?? null) === 'number');
    const declined = history.filter(h => h.outcome === 'declined');

    let totalProfit = 0, wins = 0, losses = 0, even = 0;
    let best = null, worst = null;
    for (const t of accepted) {
      const g = t.userGains;
      totalProfit += g;
      if (g > 0) wins++;
      else if (g < 0) losses++;
      else even++;
      if (best === null || g > best.userGains) best = t;
      if (worst === null || g < worst.userGains) worst = t;
    }

    const winRate = accepted.length > 0 ? Math.round((wins / accepted.length) * 100) : 0;
    const avgGain = accepted.length > 0 ? Math.round(totalProfit / accepted.length) : 0;

    // Son 30 gün stats
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = history.filter(h => h.timestamp >= thirtyDaysAgo);
    const recentAccepted = recent.filter(h => h.outcome === 'accepted' && typeof (h.userGains ?? null) === 'number');
    const recentProfit = recentAccepted.reduce((s, t) => s + t.userGains, 0);
    const declineRate = history.length > 0 ? Math.round((declined.length / history.length) * 100) : 0;

    return {
      total: history.length,
      accepted: accepted.length,
      declined: declined.length,
      wins, losses, even,
      winRate,
      totalProfit,
      avgGain,
      best,
      worst,
      recent30: { count: recent.length, accepted: recentAccepted.length, profit: recentProfit },
      declineRate,
    };
  }

  function renderStatsDashboard(stats) {
    if (!stats || stats.total === 0) {
      return `<div class="ta-stats-empty">İstatistik için en az 1 kayıtlı trade gerekli.</div>`;
    }

    const profitCls = stats.totalProfit > 0 ? 'pos' : stats.totalProfit < 0 ? 'neg' : 'flat';
    const profitSign = stats.totalProfit > 0 ? '+' : stats.totalProfit < 0 ? '−' : '';
    const profitStr = `${profitSign}${formatRAP(Math.abs(stats.totalProfit))}`;

    const avgCls = stats.avgGain > 0 ? 'pos' : stats.avgGain < 0 ? 'neg' : 'flat';
    const avgSign = stats.avgGain > 0 ? '+' : stats.avgGain < 0 ? '−' : '';
    const avgStr = `${avgSign}${formatRAP(Math.abs(stats.avgGain))}`;

    const winRateBarCls = stats.winRate >= 60 ? '' : stats.winRate >= 40 ? 'warn' : 'bad';

    const recentProfitCls = stats.recent30.profit > 0 ? 'pos' : stats.recent30.profit < 0 ? 'neg' : 'flat';
    const recentSign = stats.recent30.profit > 0 ? '+' : stats.recent30.profit < 0 ? '−' : '';

    const bestStr = stats.best ? `+${formatRAP(stats.best.userGains)}` : '—';
    const worstStr = stats.worst && stats.worst.userGains < 0 ? `−${formatRAP(Math.abs(stats.worst.userGains))}` : '—';

    return `
      <div class="ta-stats-dash">
        <div class="ta-stat-card full">
          <div class="ta-stat-label">${ICON_TROPHY}Win Rate · ${stats.accepted} kabul edilen</div>
          <div class="ta-stat-value ${stats.winRate >= 50 ? 'pos' : 'neg'}">%${stats.winRate}</div>
          <div class="ta-stat-bar"><div class="ta-stat-bar-fill ${winRateBarCls}" style="width:${stats.winRate}%"></div></div>
          <div class="ta-stat-sub">${stats.wins} kazanç · ${stats.losses} kayıp · ${stats.even} dengeli</div>
        </div>
        <div class="ta-stat-card">
          <div class="ta-stat-label">Net Kâr/Zarar</div>
          <div class="ta-stat-value ${profitCls}">${profitStr}</div>
          <div class="ta-stat-sub">RAP toplam</div>
        </div>
        <div class="ta-stat-card">
          <div class="ta-stat-label">Trade Başına</div>
          <div class="ta-stat-value ${avgCls}">${avgStr}</div>
          <div class="ta-stat-sub">ortalama</div>
        </div>
        <div class="ta-stat-card">
          <div class="ta-stat-label">${ICON_MEDAL}En İyi</div>
          <div class="ta-stat-value pos">${bestStr}</div>
          <div class="ta-stat-sub">${stats.best ? formatDate(stats.best.timestamp) : ''}</div>
        </div>
        <div class="ta-stat-card">
          <div class="ta-stat-label">${ICON_DOWNTREND}En Kötü</div>
          <div class="ta-stat-value neg">${worstStr}</div>
          <div class="ta-stat-sub">${stats.worst && stats.worst.userGains < 0 ? formatDate(stats.worst.timestamp) : ''}</div>
        </div>
        <div class="ta-stat-card full">
          <div class="ta-stat-label">${ICON_CALENDAR}Son 30 Gün</div>
          <div class="ta-stat-value ${recentProfitCls}">${recentSign}${formatRAP(Math.abs(stats.recent30.profit))} RAP</div>
          <div class="ta-stat-sub">${stats.recent30.count} trade · ${stats.recent30.accepted} kabul · %${stats.declineRate} red oranı</div>
        </div>
      </div>
    `;
  }

  async function renderHistoryView(container) {
    container.innerHTML = '<div class="ta-hist-empty" style="padding:12px 13px">Yükleniyor…</div>';
    const stored      = await storeGet(HISTORY_KEY);
    const fullHistory = stored[HISTORY_KEY] || [];          // Stats için tam liste
    const history     = fullHistory.slice(0, 30);           // Görünür liste (UI'da 30 son trade)
    const stats       = computeTradeStats(fullHistory);
    const dashHtml    = renderStatsDashboard(stats);

    if (!fullHistory.length) {
      container.innerHTML = `<div class="ta-hist-empty">Henüz kayıtlı trade yok.<br>Kabul ya da ret ettiğin tradeler burada görünür.</div>`;
      return;
    }

    const rows = history.map((rec, i) => {
      // userGains: pozitif = kazandı, negatif = kaybetti, null = yön bilinmiyor (eski kayıtlar)
      const gain    = rec.userGains ?? (rec.totalB - rec.totalA);
      const diffStr = gain >= 0 ? `+${formatRAP(gain)}` : `−${formatRAP(Math.abs(gain))}`;
      const oCls    = rec.outcome === 'accepted' ? 'ta-hist-accepted' : 'ta-hist-declined';
      const oIcon   = rec.outcome === 'accepted' ? ICON_CHECK : ICON_CROSS;
      const dCls    = gain >= 0 ? 'pos' : 'neg';
      const detailId = `ta-hd-${i}`;
      const sidesHtml = `
        <div class="ta-hist-sides">
          <div>
            <span class="ta-hist-slabel">${escapeHtml(rec.labelA)}</span>
            ${(rec.itemsA || []).map(it => `<div class="ta-hist-ditem"><span>${escapeHtml((it.name||'').substring(0,18))}</span><span>${formatRAP(it.rap)}</span></div>`).join('')}
          </div>
          <div>
            <span class="ta-hist-slabel">${escapeHtml(rec.labelB)}</span>
            ${(rec.itemsB || []).map(it => `<div class="ta-hist-ditem"><span>${escapeHtml((it.name||'').substring(0,18))}</span><span>${formatRAP(it.rap)}</span></div>`).join('')}
          </div>
        </div>`;
      return `
        <div class="ta-hist-item">
          <div class="ta-hist-row">
            <span class="ta-hist-outcome ${oCls}">${oIcon}</span>
            <div class="ta-hist-info">
              <span class="ta-hist-diff ${dCls}">${diffStr} RAP</span>
              <span class="ta-hist-date">${formatDate(rec.timestamp)}</span>
            </div>
            <button class="ta-hist-tog" data-det="${detailId}">▾</button>
          </div>
          <div class="ta-hist-detail" id="${detailId}" style="display:none">${sidesHtml}</div>
        </div>`;
    }).join('');

    container.innerHTML = dashHtml + rows + `<button class="ta-hist-clear" id="ta-hist-clr">Geçmişi Temizle</button>`;

    container.querySelectorAll('.ta-hist-tog').forEach(btn => {
      btn.addEventListener('click', () => {
        const det  = document.getElementById(btn.dataset.det);
        const open = det.style.display !== 'none';
        det.style.display = open ? 'none' : '';
        btn.textContent   = open ? '▾' : '▴';
      });
    });
    container.querySelector('#ta-hist-clr').addEventListener('click', async () => {
      await storeSet({ [HISTORY_KEY]: [] });
      renderHistoryView(container);
    });
  }

  // ─── Ana Orchestrator ─────────────────────────────────────────────────────
  let _busy = false;
  function taRelativeTime(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return 'şimdi';
    if (s < 60) return `${s}sn önce`;
    if (s < 3600) return `${Math.floor(s / 60)}dk önce`;
    return `${Math.floor(s / 3600)}sa önce`;
  }

  // Trade'deki tüm item'lar için Best Price (canlı floor) çek; geldikçe paneli yeniden render et.
  // Service worker yeni MAIN world batch catalog endpoint'i kullanıyor — tek istekte 120 item.
  async function loadFloorPricesForTrade(allItems, force = false) {
    if (floorState.loading) return;
    floorState.loading = true;
    const btn = document.querySelector(`#${PANEL_ID} .ta-refresh-btn`);
    btn?.classList.add('spinning');
    try {
      const ids = [...new Set(allItems.map(it => String(it.id)))];

      const sendMsg = (msg) => new Promise(resolve => {
        try {
          chrome.runtime.sendMessage(msg, r => {
            if (chrome.runtime.lastError) resolve(null); else resolve(r);
          });
        } catch { resolve(null); }
      });

      const resp = await sendMsg({
        action: 'fetchFloorPricesBatch',
        assetIds: ids,
        forceRefresh: force
      });

      if (resp?.ok) {
        const now = Date.now();
        const sources = resp.sources || {};
        for (const [id, price] of Object.entries(resp.floors || {})) {
          floorState.map.set(id, {
            price,
            fetchedAt: now,
            source: sources[id] || 'unknown'
          });
        }
        floorState.lastUpdate = now;
        floorState.rateLimited = !!resp.rateLimited;
        floorState.lastDiag = resp.diag || null;
      }

      // Price history — trend hesabı için
      const histResp = await sendMsg({
        action: 'getPriceHistory',
        assetIds: ids
      });
      if (histResp?.ok) {
        for (const [id, snapshots] of Object.entries(histResp.history || {})) {
          if (Array.isArray(snapshots) && snapshots.length > 0) {
            floorState.historyMap.set(id, snapshots);
          }
        }
      }
    } catch (e) {
      console.warn('[TradeAnalyzer] loadFloorPricesForTrade error:', e);
    }
    floorState.loading = false;
    btn?.classList.remove('spinning');
    // Re-render: yeni analyze gerek yok, sadece mevcut panel'i yenile
    if (_lastSnapshot) {
      const { sideA, sideB, labelA, labelB, itemsData, stale } = _lastSnapshot;
      renderPanel(sideA, sideB, labelA, labelB, itemsData, stale);
    }
  }

  // Trend hesabı (7 günlük ortalamaya göre)
  function computeFloorTrend(id, currentPrice) {
    if (!currentPrice || currentPrice <= 0) return null;
    const history = floorState.historyMap.get(String(id));
    if (!history || history.length < 2) return null;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = history.filter(s => s.t >= sevenDaysAgo);
    if (recent.length < 2) return null;
    const prevSamples = recent.slice(0, -1);
    if (prevSamples.length === 0) return null;
    const prevAvg = prevSamples.reduce((s, x) => s + x.p, 0) / prevSamples.length;
    if (prevAvg <= 0) return null;
    const pct = ((currentPrice - prevAvg) / prevAvg) * 100;
    if (Math.abs(pct) < 1) return { dir: 'flat', pct: 0 };
    return { dir: pct > 0 ? 'up' : 'down', pct: Math.round(pct) };
  }

  function startTaAutoRefresh() {
    stopTaAutoRefresh();
    floorState.autoTimer = setInterval(() => {
      if (document.getElementById(PANEL_ID) && !document.hidden && _lastSnapshot) {
        const all = [..._lastSnapshot.sideA, ..._lastSnapshot.sideB];
        loadFloorPricesForTrade(all, true);
      }
    }, TA_AUTO_REFRESH_MS);
  }
  function stopTaAutoRefresh() {
    if (floorState.autoTimer) { clearInterval(floorState.autoTimer); floorState.autoTimer = null; }
  }

  // En son render edilen analiz snapshot'ı (auto-refresh için)
  let _lastSnapshot = null;

  async function analyze() {
    if (_busy) return;
    _busy = true;
    try {
      const sections = findTradeSections();
      if (!sections) {
        clearBadges();
        document.getElementById(PANEL_ID)?.remove();
        return;
      }

      const [secA, secB] = sections;
      const labelA  = getSectionLabel(secA, 'Taraf 1');
      const labelB  = getSectionLabel(secB, 'Taraf 2');
      const itemsA  = extractItemsFromContainer(secA);
      const itemsB  = extractItemsFromContainer(secB);
      const allItems = [...itemsA, ...itemsB];

      if (!allItems.length) {
        clearBadges();
        document.getElementById(PANEL_ID)?.remove();
        return;
      }

      const { data: itemsData, stale } = await fetchRolimons();
      if (!itemsData) { clearBadges(); return; }

      renderBadges(allItems, itemsData);
      _lastSnapshot = { sideA: itemsA, sideB: itemsB, labelA, labelB, itemsData, stale };
      renderPanel(itemsA, itemsB, labelA, labelB, itemsData, stale);

      // Canlı floor — background, RAP'ten sonra. Geldikçe panel güncellenir.
      loadFloorPricesForTrade(allItems, false);
      startTaAutoRefresh();
    } catch (err) {
      console.error('[TradeAnalyzer] Hata:', err);
    } finally {
      _busy = false;
    }
  }

  // ─── SPA Observer ─────────────────────────────────────────────────────────
  function setupObserver() {
    let debounce;

    const trigger = () => { clearTimeout(debounce); debounce = setTimeout(analyze, 400); };

    const obs = new MutationObserver(trigger);
    obs.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('popstate', trigger);
    window.addEventListener('hashchange', trigger);
    window.addEventListener('beforeunload', () => { obs.disconnect(); stopTaAutoRefresh(); });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  // ─── DEMO MODE — Premium yoksa test için sahte trade verisi ──────────────
  // Konsoldan tetikle: window.dispatchEvent(new CustomEvent('tracked:trade-demo'))
  // Veya hızlı: __trackedDemo() (window'a expose ediliyor)
  function renderDemoTrade() {
    // Rolimons format: [name, acronym, rap, value, defaultValue, demand, trend, projected, hyped, rare]
    const mockData = {
      '1117747196': ['Violet Valkyrie',         'VV',   4150000, 4500000, 0, 5, 1, 0, 1, 1],
      '215718515':  ['Sparkle Time Fedora',     'STF',  3620000, 3800000, 0, 4, 1, 0, 0, 1],
      '4194052':    ['Red Sparkle Time Fedora', 'RSTF', 5800000, 6000000, 0, 5, 1, 0, 0, 1],
      '215719598':  ['Sinister Bloxxy Cola',    'SBC',   234000,  280000, 0, 3, 1, 0, 0, 0],
      '1031429':    ['Dominus Empyreus',        'DE',  21000000, 22000000, 0, 5, 0, 0, 0, 1],
    };
    const sideA = [
      { id: '1117747196', name: 'Violet Valkyrie' },
      { id: '215718515',  name: 'Sparkle Time Fedora' },
    ];
    const sideB = [
      { id: '4194052',    name: 'Red Sparkle Time Fedora' },
      { id: '215719598',  name: 'Sinister Bloxxy Cola' },
    ];

    _lastSnapshot = {
      sideA, sideB,
      labelA: 'Sen veriyorsun (DEMO)',
      labelB: 'Sen alıyorsun (DEMO)',
      itemsData: mockData,
      stale: false
    };
    renderPanel(sideA, sideB, 'Sen veriyorsun (DEMO)', 'Sen alıyorsun (DEMO)', mockData, false);
    // Gerçek floor fiyatlarını da çek — quick action linkleri ve diff'ler dolsun
    loadFloorPricesForTrade([...sideA, ...sideB], false);
    console.log('%c[Tracked-TA] Demo trade yüklendi', 'background:#5AC8FA;color:#000;padding:2px 6px;border-radius:3px',
      '\n  Sen veriyorsun: Violet Valkyrie + Sparkle Time Fedora',
      '\n  Sen alıyorsun: Red Sparkle Time Fedora + Sinister Bloxxy Cola',
      '\n  Demo\'yu tekrar yüklemek için: __trackedDemo()');
  }

  // Custom event ile tetikleme (page F12 console → content script köprüsü)
  // CSP-friendly: DOM eventleri page ↔ content script arasında her zaman çalışır
  window.addEventListener('tracked:trade-demo', renderDemoTrade);

  // Sayfa yüklendiğinde console'a demo komutunu göster (CSP'den bağımsız)
  console.log(
    '%c[Tracked-TA] Demo modu hazır',
    'background:#5AC8FA;color:#000;font-weight:bold;padding:3px 8px;border-radius:4px',
    '\n  F12 konsoluna şu komutu yapıştır → panel sahte trade ile dolar:',
    '\n\n  window.dispatchEvent(new CustomEvent("tracked:trade-demo"))\n'
  );

  async function init() {
    injectStyles();
    await analyze();
    setupObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
