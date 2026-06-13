// ─────────────────────────────────────────────────────────────────────────
// Tracked v1.9.4 — Catalog Enhancer
// Roblox catalog item sayfasına RAP, Floor, Demand, Trend, Flags, Value
// widget'ı enjekte eder. Roblox sadece "Best Price" gösteriyor, biz tüm
// kritik trader bilgilerini ekleyelim. Premium gerektirmez.
//
// Mimari:
//   1. URL'den item ID çıkar (/catalog/{id}/...)
//   2. SW'ye 2 mesaj: fetchRolimonsForRAC (cache) + fetchFloorPricesBatch
//   3. "Best Price" bölümünün altına widget enjekte et
//   4. SPA navigation: item değişince yeniden çalış
// ─────────────────────────────────────────────────────────────────────────

(function() {
  'use strict';
  if (window._trackedCatalogSetup) return;
  window._trackedCatalogSetup = true;

  const WIDGET_ID = 'tracked-catalog-insights';
  const STYLE_ID  = 'tracked-catalog-styles';

  // ─── Icons ─────────────────────────────────────────────────────────────
  const ICON_BAG     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.85"><rect x="1.5" y="4" width="10" height="8.5" rx="1.5"/><path d="M4.5 4V3a2 2 0 014 0v1"/></svg>`;
  // Robux ikonu — GERÇEK Roblox SVG path'i (rbxcdn economy_28x28_dark Fill-1). Sprite'a bağımlı DEĞİL; 1em → yazıyla ölçeklenir, currentColor → metin rengi.
  const ICON_ROBUX   = `<svg width="1em" height="1em" viewBox="0 0 28 28" fill="currentColor" fill-rule="evenodd" style="flex-shrink:0;display:inline-block;vertical-align:-0.12em;margin-right:3px"><path d="M23.402,5.571 C25.009,6.499 26,8.215 26,10.071 L26,17.927 C26,19.784 25.009,21.499 23.402,22.427 L16.597,26.356 C14.99,27.284 13.009,27.284 11.402,26.356 L4.597,22.427 C2.99,21.499 2,19.784 2,17.927 L2,10.071 C2,8.215 2.99,6.499 4.597,5.571 L11.402,1.643 C13.009,0.715 14.99,0.715 16.597,1.643 L23.402,5.571 Z M12.313,3.426 L5.686,7.252 C4.642,7.855 4,8.968 4,10.174 L4,17.825 C4,19.03 4.642,20.144 5.686,20.747 L12.313,24.572 C13.357,25.175 14.642,25.175 15.686,24.572 L22.313,20.747 C23.357,20.144 24,19.03 24,17.825 L24,10.174 C24,8.968 23.357,7.855 22.313,7.252 L15.686,3.426 C14.642,2.823 13.357,2.823 12.313,3.426 L12.313,3.426 Z M15.385,5.564 L20.614,8.582 C21.471,9.077 22,9.992 22,10.983 L22,17.02 C22,18.01 21.471,18.925 20.614,19.42 L15.385,22.439 C14.528,22.934 13.471,22.934 12.614,22.439 L7.385,19.42 C6.528,18.925 6,18.01 6,17.02 L6,10.983 C6,9.992 6.528,9.077 7.385,8.582 L12.614,5.564 C13.471,5.069 14.528,5.069 15.385,5.564 L15.385,5.564 Z M11,17.001 L17,17.001 L17,11.001 L11,11.001 L11,17.001 Z"/></svg>`;
  const ICON_REFRESH = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8a5.5 5.5 0 11-1.61-3.89"/><path d="M13.5 2v3h-3"/></svg>`;
  const ICON_ROLIMONS = `<svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><path d="M5.5 0L7 4H11L7.7 6.4L9 10L5.5 7.8L2 10L3.3 6.4L0 4H4L5.5 0Z"/></svg>`;
  // PROJECTED — yukarı trend + sparkle (gelecekte değer kazanacak gösterimi)
  const ICON_PROJECTED = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="1.5,9 5,5.5 7,7.5 10.5,4"/><polyline points="8,4 10.5,4 10.5,6.5"/><circle cx="2.5" cy="3" r="0.5" fill="currentColor" stroke="none"/></svg>`;
  // HYPED — alev (talep yüksek, sıcak)
  const ICON_HYPED = `<svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" style="flex-shrink:0"><path d="M6 0.5c0.8 2.2 2.5 3.3 2.5 5.5 0 1.5-1.1 2.5-2.5 2.5S3.5 7.5 3.5 6c0-0.9 0.4-1.6 0.4-2.4-0.5 0.5-1 1.1-1.2 2C2.4 6 2 6.7 2 7.5 2 9.4 3.8 11 6 11s4-1.6 4-3.5C10 4.5 7.5 3 6 0.5z"/></svg>`;
  // RARE — 5 köşeli yıldız (nadir, çok az kişi sahip)
  const ICON_RARE = `<svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" style="flex-shrink:0"><path d="M6 0.5L7.4 4.1L11.3 4.4L8.3 7L9.3 10.8L6 8.7L2.7 10.8L3.7 7L0.7 4.4L4.6 4.1Z"/></svg>`;

  // ─── Demand mapping (Rolimons skalası) ─────────────────────────────────
  const DEMAND_LABELS = ['Çok Düşük', 'Düşük', 'Normal', 'İyi', 'Yüksek', 'Çok Yüksek'];
  const DEMAND_COLORS = ['#FF453A', '#FF6B35', '#FFD60A', '#8FE35C', '#30D158', '#00E676'];

  // ─── Utility ───────────────────────────────────────────────────────────
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

  function formatRobux(n) {
    if (!n || n <= 0) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 100_000)   return Math.round(n / 1_000) + 'K';
    if (n >= 10_000)    return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString('tr-TR');
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function getItemId() {
    const m = location.pathname.match(/\/catalog\/(\d+)/);
    return m ? m[1] : null;
  }

  // ─── Styles ────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${WIDGET_ID} {
        /* Sağ tarafta fixed floating widget (yatay yerine dikey) */
        position: fixed !important;
        right: 16px !important;
        top: 90px !important;
        width: 280px !important;
        max-height: calc(100vh - 110px) !important;
        overflow-y: auto !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 14px 16px !important;
        background: linear-gradient(180deg, rgba(20,20,26,0.92), rgba(15,15,20,0.96)) !important;
        backdrop-filter: blur(28px) saturate(1.4) !important;
        -webkit-backdrop-filter: blur(28px) saturate(1.4) !important;
        border: 1px solid rgba(255,255,255,0.10) !important;
        border-radius: 14px !important;
        color: rgba(255,255,255,0.88) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 12px !important;
        box-shadow: 0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05) !important;
        line-height: 1.45 !important;
        z-index: 9000 !important;
        scrollbar-width: thin !important;
        animation: tce-slide-in .35s cubic-bezier(0.4,0,0.2,1) both !important;
      }
      #${WIDGET_ID}::-webkit-scrollbar { width: 4px; }
      #${WIDGET_ID}::-webkit-scrollbar-track { background: transparent; }
      #${WIDGET_ID}::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 2px; }
      @keyframes tce-slide-in {
        from { opacity: 0; transform: translateX(20px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      #${WIDGET_ID} .tce-header {
        display: flex; align-items: center; justify-content: space-between;
        padding-bottom: 10px; margin-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      #${WIDGET_ID} .tce-title {
        display: flex; align-items: center; gap: 6px;
        font-size: 12px; font-weight: 650; color: rgba(255,255,255,0.95);
        letter-spacing: 0.015em;
      }
      #${WIDGET_ID} .tce-actions {
        display: flex; align-items: center; gap: 4px;
      }
      #${WIDGET_ID} .tce-icon-btn {
        background: none !important; border: none !important;
        color: rgba(255,255,255,0.40) !important; cursor: pointer;
        width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
        border-radius: 5px; transition: color .12s, background .12s; padding: 0 !important;
      }
      #${WIDGET_ID} .tce-icon-btn:hover {
        color: rgba(255,255,255,0.95) !important;
        background: rgba(255,255,255,0.08) !important;
      }
      #${WIDGET_ID} .tce-icon-btn.rol:hover {
        color: #FFD60A !important; background: rgba(255,214,10,0.10) !important;
      }
      #${WIDGET_ID} .tce-icon-btn.spin svg { animation: tce-spin 1s linear infinite; }
      @keyframes tce-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      #${WIDGET_ID} .tce-prices {
        display: grid; grid-template-columns: 1fr; gap: 8px;
        margin-bottom: 10px;
      }
      #${WIDGET_ID} .tce-price-cell {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 8px; padding: 8px 10px;
      }
      #${WIDGET_ID} .tce-price-label {
        font-size: 9.5px; color: rgba(255,255,255,0.40);
        text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;
        margin-bottom: 3px;
      }
      #${WIDGET_ID} .tce-price-value {
        font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.95);
        font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 3px;
      }
      #${WIDGET_ID} .tce-price-value.muted { color: rgba(255,255,255,0.50); font-weight: 500; }
      #${WIDGET_ID} .tce-diff {
        font-size: 9.5px; font-weight: 600; padding: 1px 5px;
        border-radius: 3px; font-variant-numeric: tabular-nums; margin-left: 5px;
      }
      #${WIDGET_ID} .tce-diff.up { color: #30D158; background: rgba(48,209,88,0.12); }
      #${WIDGET_ID} .tce-diff.dn { color: #FF453A; background: rgba(255,69,58,0.12); }
      #${WIDGET_ID} .tce-diff.flat { color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.05); }

      #${WIDGET_ID} .tce-meta {
        display: grid; grid-template-columns: 1fr; gap: 6px;
      }
      #${WIDGET_ID} .tce-meta-row {
        display: flex; align-items: center; gap: 6px;
        font-size: 11.5px; color: rgba(255,255,255,0.72);
        padding: 4px 0;
      }
      #${WIDGET_ID} .tce-meta-label {
        font-size: 9.5px; color: rgba(255,255,255,0.40);
        text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;
        min-width: 50px;
      }
      #${WIDGET_ID} .tce-dots { display: inline-flex; gap: 2px; }
      #${WIDGET_ID} .tce-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: rgba(255,255,255,0.10);
      }
      #${WIDGET_ID} .tce-trend { display: inline-flex; align-items: center; gap: 3px; font-weight: 600; }
      #${WIDGET_ID} .tce-trend.up { color: #30D158; }
      #${WIDGET_ID} .tce-trend.dn { color: #FF453A; }
      #${WIDGET_ID} .tce-trend.flat { color: rgba(255,255,255,0.55); }

      #${WIDGET_ID} .tce-flags {
        display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px;
      }
      #${WIDGET_ID} .tce-flag {
        font-size: 10px; font-weight: 700; padding: 3px 7px;
        border-radius: 4px; letter-spacing: 0.04em;
        display: inline-flex; align-items: center; gap: 4px;
      }
      #${WIDGET_ID} .tce-flag.proj { color: #5AC8FA; background: rgba(90,200,250,0.14); }
      #${WIDGET_ID} .tce-flag.hyped { color: #FF9F0A; background: rgba(255,159,10,0.14); }
      #${WIDGET_ID} .tce-flag.rare { color: #BF5AF2; background: rgba(191,90,242,0.14); }
      #${WIDGET_ID} .tce-flag.coll { color: #30D158; background: rgba(48,209,88,0.12); }

      #${WIDGET_ID} .tce-loading {
        padding: 8px 0; text-align: center;
        font-size: 11px; color: rgba(255,255,255,0.40);
      }
      #${WIDGET_ID} .tce-empty {
        padding: 10px 0; text-align: center;
        font-size: 11px; color: rgba(255,255,255,0.45);
      }
      #${WIDGET_ID} .tce-update {
        font-size: 9.5px; color: rgba(255,255,255,0.32);
        text-align: right; margin-top: 8px;
      }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ─── HTML Builders ─────────────────────────────────────────────────────
  function demandHTML(d) {
    if (typeof d !== 'number' || d < 0) {
      return `<span style="color:rgba(255,255,255,0.40)">—</span>`;
    }
    const lvl   = Math.max(0, Math.min(5, d));
    const color = DEMAND_COLORS[lvl];
    const label = DEMAND_LABELS[lvl];
    const dots  = [0,1,2,3,4].map(i =>
      `<span class="tce-dot" style="background:${i <= lvl - 1 ? color : 'rgba(255,255,255,0.10)'}"></span>`
    ).join('');
    return `<span class="tce-dots">${dots}</span> <span style="color:${color};font-weight:600">${label}</span>`;
  }

  function trendHTML(t) {
    if (typeof t !== 'number') return `<span class="tce-trend flat">—</span>`;
    if (t > 0)  return `<span class="tce-trend up">▲ Yükseliyor</span>`;
    if (t < 0)  return `<span class="tce-trend dn">▼ Düşüyor</span>`;
    return `<span class="tce-trend flat">— Sabit</span>`;
  }

  function flagsHTML(info) {
    if (!info) return '';
    const flags = [];
    if (info[7]) flags.push(`<span class="tce-flag proj">${ICON_PROJECTED}PROJECTED</span>`);
    if (info[8]) flags.push(`<span class="tce-flag hyped">${ICON_HYPED}HYPED</span>`);
    if (info[9]) flags.push(`<span class="tce-flag rare">${ICON_RARE}RARE</span>`);
    return flags.length > 0 ? `<div class="tce-flags">${flags.join('')}</div>` : '';
  }

  function relativeTime(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5)    return 'şimdi';
    if (s < 60)   return `${s} sn önce`;
    if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
    return `${Math.floor(s / 3600)} sa önce`;
  }

  // ─── Render Widget ─────────────────────────────────────────────────────
  function buildWidget(itemId, data, isLoading, lastUpdate) {
    const info = data?.rolimons || null;
    const floor = data?.floor;
    const rap   = info?.[2] || 0;
    const value = info?.[3] || 0;
    const demand = info?.[5] ?? -1;
    const trend  = info?.[6] ?? 0;
    const isCollectible = data?.isCollectible; // UGC limited mı

    // Floor vs RAP diff
    let floorDiffHtml = '';
    if (floor && floor > 0 && rap > 0) {
      const diff = floor - rap;
      const pct  = Math.round((diff / rap) * 100);
      const dirCls = Math.abs(pct) < 1 ? 'flat' : (diff > 0 ? 'up' : 'dn');
      const sign = diff > 0 ? '+' : '';
      floorDiffHtml = `<span class="tce-diff ${dirCls}">${sign}${pct}%</span>`;
    }

    return `
      <div class="tce-header">
        <span class="tce-title">${ICON_BAG} Market Insights</span>
        <div class="tce-actions">
          <button class="tce-icon-btn ${isLoading ? 'spin' : ''}" title="Yenile" id="tce-refresh-btn">${ICON_REFRESH}</button>
          <a class="tce-icon-btn rol" href="https://www.rolimons.com/item/${escapeHtml(itemId)}" target="_blank" rel="noopener" title="Rolimons'ta aç">${ICON_ROLIMONS}</a>
        </div>
      </div>

      <div class="tce-prices">
        <div class="tce-price-cell">
          <div class="tce-price-label">Floor (Canlı)</div>
          <div class="tce-price-value ${!floor ? 'muted' : ''}">${ICON_ROBUX}${formatRobux(floor)}${floorDiffHtml}</div>
        </div>
        <div class="tce-price-cell">
          <div class="tce-price-label">RAP</div>
          <div class="tce-price-value ${!rap ? 'muted' : ''}">${ICON_ROBUX}${formatRobux(rap)}</div>
        </div>
        <div class="tce-price-cell">
          <div class="tce-price-label">Value (Rolimons)</div>
          <div class="tce-price-value ${!value ? 'muted' : ''}">${ICON_ROBUX}${formatRobux(value)}</div>
        </div>
      </div>

      <div class="tce-meta">
        <div class="tce-meta-row">
          <span class="tce-meta-label">Talep</span>
          ${demandHTML(demand)}
        </div>
        <div class="tce-meta-row">
          <span class="tce-meta-label">Trend</span>
          ${trendHTML(trend)}
        </div>
      </div>

      ${flagsHTML(info)}

      ${(!info && !floor) ? '<div class="tce-empty">Bu item için piyasa verisi bulunamadı (Rolimons\'ta yok veya limited değil).</div>' : ''}
      ${lastUpdate ? `<div class="tce-update">Son güncelleme: ${relativeTime(lastUpdate)}</div>` : ''}
    `;
  }

  // ─── Find Best Anchor ──────────────────────────────────────────────────
  // Tercih sırası:
  //   1. "Price Chart" başlığı → widget'ı bunun ÖNÜNE koy (full-width, doğal akış)
  //   2. "Recommendations" başlığı → fallback (sayfada Price Chart yoksa)
  //   3. "Best Price" alanı → son çare (eski davranış)
  //
  // Bu yerleşim item detaylarının (Tradable/Type/Description) hemen ALTINA,
  // Price Chart'ın hemen ÜSTÜNE koyar. Sayfanın doğal "market data" bölgesi.
  function findAnchor() {
    // 1. Price Chart başlığı (en iyi yer — natural transition zone)
    for (const el of document.querySelectorAll('h1, h2, h3, [class*="container-header"], [class*="section-header"]')) {
      const t = el.textContent?.trim();
      if (t === 'Price Chart' || /^price\s*chart/i.test(t || '')) {
        return { el, position: 'before' };
      }
    }

    // 2. Recommendations başlığı (Price Chart yoksa)
    for (const el of document.querySelectorAll('h1, h2, h3, [class*="container-header"], [class*="section-header"]')) {
      const t = el.textContent?.trim();
      if (t === 'Recommendations' || /^recommend/i.test(t || '')) {
        return { el, position: 'before' };
      }
    }

    // 3. Son çare — Best Price area (eski davranış)
    const direct = document.querySelector('.price-container-text');
    if (direct) {
      const container = direct.closest('.price-row-container') || direct.parentElement;
      if (container) return { el: container, position: 'after' };
    }

    const section = document.querySelector('.item-details-section, [class*="item-details"]');
    if (section) {
      for (const el of section.querySelectorAll('div, span')) {
        const t = el.textContent?.trim();
        if (t === 'Best Price' || t === 'Price' || t === 'Resellers') {
          const container = el.closest('.price-row-container') || el.closest('[class*="price"]') || el.parentElement?.parentElement;
          if (container) return { el: container, position: 'after' };
        }
      }
    }
    return null;
  }

  // ─── State ─────────────────────────────────────────────────────────────
  const state = {
    currentId: null,
    data: null,
    isLoading: false,
    lastUpdate: 0,
    isLimited: false,    // Item tradeable limited mı? (sadece bu durumda widget göster)
  };

  // ─── Item Restrictions Check ───────────────────────────────────────────
  // Widget'ı sadece tradeable limited (Limited/LimitedUnique) veya UGC limited
  // (Collectible) item'larda göster. Normal gear/avatar item'larda widget yok.
  async function checkIsLimited(itemId) {
    const info = await swMsg({ action: 'fetchCatalogItemInfo', itemId });
    if (!info?.ok || !info.item) return false;
    const restrictions = info.item.itemRestrictions || [];
    return restrictions.includes('Limited')
        || restrictions.includes('LimitedUnique')
        || restrictions.includes('Collectible');
  }

  // ─── Data Fetching ─────────────────────────────────────────────────────
  async function loadData(itemId) {
    state.isLoading = true;
    // Spinner aç
    document.getElementById('tce-refresh-btn')?.classList.add('spin');

    try {
      const [rolimonsResp, floorResp] = await Promise.all([
        swMsg({ action: 'fetchRolimonsForRAC' }),
        swMsg({ action: 'fetchFloorPricesBatch', assetIds: [itemId], forceRefresh: false }),
      ]);

      const rolimonsInfo = rolimonsResp?.data?.[itemId] || null;
      const floor = floorResp?.floors?.[itemId];

      state.data = {
        rolimons: rolimonsInfo,
        floor: (typeof floor === 'number' && floor > 0) ? floor : null,
      };
      state.lastUpdate = Date.now();
    } catch (e) {
      console.warn('[Tracked-Catalog] Veri yükleme hatası:', e);
    }

    state.isLoading = false;
    // Spinner kapat ve widget'ı yeniden render et
    renderWidget();
  }

  // ─── Render Widget into DOM ────────────────────────────────────────────
  function renderWidget() {
    if (!document.body) return false;

    // Eski widget varsa kaldır
    document.getElementById(WIDGET_ID)?.remove();

    const widget = document.createElement('div');
    widget.id = WIDGET_ID;
    widget.innerHTML = buildWidget(state.currentId, state.data, state.isLoading, state.lastUpdate);

    // Fixed-positioned widget → doğrudan body'ye append (anchor'a gerek yok)
    document.body.appendChild(widget);

    // Refresh butonu — cache bypass
    widget.querySelector('#tce-refresh-btn')?.addEventListener('click', () => {
      // Force refresh (cache bypass)
      (async () => {
        state.isLoading = true;
        widget.querySelector('#tce-refresh-btn')?.classList.add('spin');
        try {
          const floorResp = await swMsg({
            action: 'fetchFloorPricesBatch',
            assetIds: [state.currentId],
            forceRefresh: true
          });
          const floor = floorResp?.floors?.[state.currentId];
          if (state.data) {
            state.data.floor = (typeof floor === 'number' && floor > 0) ? floor : null;
          }
          state.lastUpdate = Date.now();
        } catch {}
        state.isLoading = false;
        renderWidget();
      })();
    });

    return true;
  }

  // ─── Wait for anchor element to appear ─────────────────────────────────
  function waitForAnchor(maxMs = 6000) {
    return new Promise(resolve => {
      const a = findAnchor();
      if (a) { resolve(a); return; }
      let done = false;
      const finish = () => { if (!done) { done = true; obs.disconnect(); clearTimeout(t); resolve(findAnchor()); } };
      const t = setTimeout(finish, maxMs);
      const obs = new MutationObserver(() => {
        if (findAnchor()) finish();
      });
      obs.observe(document.body, { childList: true, subtree: true });
    });
  }

  // ─── Init for current item ─────────────────────────────────────────────
  async function init() {
    const id = getItemId();
    if (!id) {
      document.getElementById(WIDGET_ID)?.remove();
      state.currentId = null;
      state.isLimited = false;
      return;
    }
    if (id === state.currentId) return; // Aynı item

    state.currentId = id;
    state.data = null;
    state.lastUpdate = 0;
    state.isLoading = true;
    state.isLimited = false;

    injectStyles();

    // ÖNCE item'ın limited olup olmadığını kontrol et.
    // Tradeable limited değilse (Vampire's Top Hat gibi normal item) widget gösterme.
    const isLimited = await checkIsLimited(id);
    state.isLimited = isLimited;

    if (!isLimited) {
      // Normal item — widget'ı kaldır, market insights gösterme
      document.getElementById(WIDGET_ID)?.remove();
      return;
    }

    // Limited item — anchor'ı bekle ve widget'ı render et
    await waitForAnchor();
    renderWidget();
    await loadData(id);
  }

  // ─── SPA Navigation ────────────────────────────────────────────────────
  function watchNavigation() {
    let lastUrl = location.href;
    let debounce;
    const trigger = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const cur = location.href;
        if (cur !== lastUrl) { lastUrl = cur; init(); }
      }, 300);
    };
    window.addEventListener('popstate', trigger);
    window.addEventListener('hashchange', trigger);
    new MutationObserver(trigger).observe(document.body, { childList: true, subtree: false });
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); watchNavigation(); });
  } else {
    init();
    watchNavigation();
  }
})();
