// avatar_sandbox.js — Tracked v1.9.4
// "Avatarda Dene" — AVATAR EDİTÖRÜ sayfasında. AKILLI HİBRİT:
//   • Deneme item'ı YOKKEN → Roblox'un native 3D önizlemesi (canlı) görünür.
//   • Deneme item'ı EKLENİNCE → bizim render, native önizleme kutusunun ÜSTÜNE (aynı
//     boyut) overlay olarak geçer; satın almadan deneme. Temizle/kaldır → native geri gelir.
// Seçiciler: Envanterden Dene (RoPro Quick Equip mantığı) + Marketplace'ten Dene (katalog).
// Gerçek avatar HİÇ değişmez (hibrit render: Roblox sunucusu OBJ üretir, Three.js gösterir).
// Three.js talep üzerine yüklenir. Standalone IIFE. Emoji yok, SVG ikon.

(function () {
  'use strict';
  if (window._trackedSandboxSetup) return;
  window._trackedSandboxSetup = true;

  const STYLE_ID = 'tracked-sandbox-style';
  const PANEL_ID = 'tracked-sandbox-panel';
  const OVERLAY_ID = 'tracked-sandbox-overlay';
  const PICK_ID = 'tracked-sandbox-picker';
  const SESSION_KEY = 'tracked_sandbox_session';
  const MKT_KEY = 'tracked_sandbox_mkt_state';   // Marketplace picker son durumu (hafıza)
  const INV_KEY = 'tracked_sandbox_inv_state';   // Inventory picker son durumu (hafıza)
  const ACCENT = '#5b8cff';

  // ── İkonlar ──
  const ICON_TRY = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>`;
  const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const ICON_X_SM = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const ICON_CUBE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"/></svg>`;
  const ICON_ROTATE = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`;
  const ICON_TRASH = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
  const ICON_SEARCH = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-3.5-3.5"/></svg>`;
  const ICON_PLUS = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
  const ICON_CHECK = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  const ICON_INV = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3m18 0H3m18 0v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8m6 4h6"/></svg>`;
  const ICON_STORE = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9 4.5 4h15L21 9M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9M3 9h18M8 9v3a4 4 0 0 0 8 0V9"/></svg>`;
  const ICON_CHEVRON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
  const ICON_ROBUX = `<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm3.2 5.2v7.6h2.1v-2.6h1.1l1.5 2.6h2.4l-1.8-3a2.3 2.3 0 0 0 1.3-2.2c0-1.6-1.2-2.4-3-2.4H9.2Zm2.1 1.7h1c.8 0 1.2.3 1.2.9s-.4.9-1.2.9h-1V9.9Z"/></svg>`;
  const ICON_EXT = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

  // ── Durum ──
  let session = [];
  let panelEl = null, overlayEl = null, viewer = null, currentMode = '2d', collapsed = false;
  let avatarSyncTimer = null, lastAvatarFp = null; // canlı senkron: native avatar değişince re-render
  let resizeObs = null, startObs = null;
  const comboCache = new Map();

  // ── Storage ──
  function storeGet(k) { return new Promise(r => { try { chrome.storage.local.get(k, v => r(v || {})); } catch (_) { r({}); } }); }
  function storeSet(o) { return new Promise(r => { try { chrome.storage.local.set(o, () => r()); } catch (_) { r(); } }); }
  async function loadSession() { const v = await storeGet(SESSION_KEY); session = Array.isArray(v[SESSION_KEY]) ? v[SESSION_KEY] : []; }
  function saveSession() { storeSet({ [SESSION_KEY]: session }); }
  // Picker hafızası: son seçilen kategori/filtre/arama (geri açınca oradan devam et).
  async function loadPickerState(key) { const v = await storeGet(key); return (v && v[key] && typeof v[key] === 'object') ? v[key] : {}; }
  function savePickerState(key, state) { try { storeSet({ [key]: state }); } catch (_) {} }
  function enabledIds() {
    // Bundle girişleri bundleId DEĞİL, içerdikleri asset'lerle render edilir → assetIds'e aç.
    const ids = [];
    session.filter(s => s.enabled).forEach(s => {
      if (s.isBundle && Array.isArray(s.assetIds)) s.assetIds.forEach(a => { const n = Number(a); if (n) ids.push(n); });
      else { const n = Number(s.id); if (n) ids.push(n); }
    });
    return ids;
  }
  function inSession(id) { return session.some(s => String(s.id) === String(id)); }
  function toggleSessionItem(it) {
    if (inSession(it.id)) {
      session = session.filter(s => String(s.id) !== String(it.id));
      saveSession(); renderTray(); runRender(currentMode);
      return;
    }
    const entry = { id: String(it.id), name: it.name, thumb: it.thumb, enabled: true };
    if (it.isBundle) {
      // FULL BODY TEK SLOT: yeni gövde (bundle) eklenince önceki gövdeyi kaldır → aynı anda yalnızca
      // 1 full body. (Sadece bundle'lar için; aksesuar/kıyafet birikmeye devam eder.)
      session = session.filter(s => !s.isBundle);
      // Bundle: girişi ANINDA ekle (UI tepkisi), asset'leri arkada çöz, gelince render et.
      entry.isBundle = true; entry.assetIds = []; entry.resolving = true;
      session.push(entry); saveSession(); renderTray();
      sandboxRequest({ action: 'trackedSandboxBundleDetails', bundleId: it.id }).then((resp) => {
        entry.assetIds = (resp && resp.ok && Array.isArray(resp.assetIds)) ? resp.assetIds : [];
        entry.resolving = false;
        if (!inSession(it.id)) return; // kullanıcı bu arada kaldırmışsa render etme
        saveSession(); renderTray(); runRender(currentMode);
      });
      return;
    }
    session.push(entry);
    saveSession(); renderTray(); runRender(currentMode);
  }

  function onEditorPage() { return /^\/my\/avatar/.test(location.pathname); }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ── Stil ──
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      /* Render overlay — native önizleme kutusunun üstünü kaplar (aynı boyut) */
      #${OVERLAY_ID}{position:absolute;inset:0;z-index:40;border-radius:inherit;overflow:hidden;display:none;background:radial-gradient(120% 120% at 50% 22%,#262a3a 0%,#15171f 60%,#0e0f15 100%);}
      #${OVERLAY_ID}.tks-show{display:block;}
      #${OVERLAY_ID} .tks-stage{position:absolute;inset:0;}
      #${OVERLAY_ID} .tks-stage canvas{display:block;width:100%!important;height:100%!important;}
      #${OVERLAY_ID} .tks-2d{position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;object-fit:contain;}
      #${OVERLAY_ID} .tks-ov-tag{position:absolute;top:8px;left:8px;z-index:3;display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:8px;background:rgba(91,140,255,.9);color:#fff;font:700 10.5px/1 "Builder Sans",sans-serif;letter-spacing:.3px;box-shadow:0 2px 8px rgba(0,0,0,.35);}
      #${OVERLAY_ID} .tks-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:18px;z-index:2;}
      #${OVERLAY_ID} .tks-spin{width:36px;height:36px;border-radius:50%;border:3px solid rgba(255,255,255,.14);border-top-color:${ACCENT};animation:tks-rot .8s linear infinite;}
      @keyframes tks-rot{to{transform:rotate(360deg);}}
      #${OVERLAY_ID} .tks-status{font:500 12.5px/1.4 "Builder Sans",sans-serif;color:rgba(255,255,255,.82);max-width:85%;}
      #${OVERLAY_ID} .tks-err-title{font:700 13px "Builder Sans",sans-serif;color:#fff;}
      #${OVERLAY_ID} .tks-err-detail{font:500 11px "Builder Sans",sans-serif;color:rgba(255,255,255,.55);max-width:92%;word-break:break-word;}
      #${OVERLAY_ID} .tks-retry{margin-top:2px;padding:7px 14px;border:none;border-radius:8px;cursor:pointer;background:${ACCENT};color:#fff;font-weight:700;font-size:12px;}

      /* Kontrol paneli (native önizlemenin altında) */
      #${PANEL_ID}{margin:12px 0;border-radius:14px;overflow:hidden;background:rgba(17,18,26,.92);border:1px solid rgba(255,255,255,.10);box-shadow:0 8px 26px rgba(0,0,0,.35);box-sizing:border-box;width:100%;font-family:"Builder Sans","Gotham SSm",Helvetica,Arial,sans-serif;}
      #${PANEL_ID} .tks-p-head{display:flex;align-items:center;gap:9px;padding:11px 13px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.06);}
      #${PANEL_ID} .tks-badge{width:26px;height:26px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,${ACCENT},#4a6fd6);}
      #${PANEL_ID} .tks-p-title{font-size:13.5px;font-weight:800;color:#fff;}
      #${PANEL_ID} .tks-p-badge{margin-left:6px;padding:1px 7px;border-radius:9px;background:rgba(91,140,255,.22);color:#cdd9ff;font-size:11px;font-weight:800;}
      #${PANEL_ID} .tks-p-chev{margin-left:auto;color:rgba(255,255,255,.55);transition:transform .18s;}
      #${PANEL_ID}.tks-collapsed .tks-p-chev{transform:rotate(-90deg);}
      #${PANEL_ID}.tks-collapsed .tks-p-body{display:none;}
      #${PANEL_ID} .tks-p-body{padding:11px 12px 12px;}
      #${PANEL_ID} .tks-hint{font-size:11.5px;color:rgba(255,255,255,.48);line-height:1.45;padding:4px 2px 2px;}

      #${PANEL_ID} .tks-tray{display:flex;gap:9px;overflow-x:auto;min-height:8px;scrollbar-width:thin;padding:9px 8px 4px 4px;}
      #${PANEL_ID} .tks-tray:empty{display:none;}
      #${PANEL_ID} .tks-tray::-webkit-scrollbar{height:6px;}
      #${PANEL_ID} .tks-tray::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:3px;}
      #${PANEL_ID} .tks-chip{position:relative;width:56px;height:56px;flex-shrink:0;border-radius:10px;cursor:pointer;overflow:visible;transition:opacity .12s,transform .12s;}
      #${PANEL_ID} .tks-chip:hover{transform:translateY(-1px);}
      #${PANEL_ID} .tks-chip-inner{position:relative;width:100%;height:100%;border-radius:10px;overflow:hidden;border:2px solid transparent;background:rgba(255,255,255,.06);}
      #${PANEL_ID} .tks-chip img{width:100%;height:100%;object-fit:contain;}
      #${PANEL_ID} .tks-chip .tks-chip-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);}
      #${PANEL_ID} .tks-chip.tks-off{opacity:.34;}
      #${PANEL_ID} .tks-chip.tks-off .tks-chip-inner::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(135deg,transparent,transparent 5px,rgba(0,0,0,.25) 5px,rgba(0,0,0,.25) 7px);}
      #${PANEL_ID} .tks-chip .tks-rm{position:absolute;top:-7px;right:-7px;width:20px;height:20px;border:2px solid #15171f;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;background:#e0414a;opacity:0;transform:scale(.6);transition:opacity .12s,transform .12s;box-shadow:0 1px 5px rgba(0,0,0,.5);z-index:3;}
      #${PANEL_ID} .tks-chip:hover .tks-rm{opacity:1;transform:scale(1);}
      #${PANEL_ID} .tks-chip .tks-rm:hover{background:#f25560;}
      #${PANEL_ID} .tks-chip .tks-rm svg{width:15px!important;height:15px!important;display:block;flex-shrink:0;}
      #${PANEL_ID} .tks-chip .tks-rm svg path{stroke:#fff!important;stroke-width:3!important;}
      #${PANEL_ID} .tks-chip .tks-open{position:absolute;bottom:-7px;right:-7px;width:20px;height:20px;border:2px solid #15171f;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;background:#3b6fe0;opacity:0;transform:scale(.6);transition:opacity .12s,transform .12s;box-shadow:0 1px 5px rgba(0,0,0,.5);z-index:3;}
      #${PANEL_ID} .tks-chip:hover .tks-open{opacity:1;transform:scale(1);}
      #${PANEL_ID} .tks-chip .tks-open:hover{background:#4f81f0;}
      #${PANEL_ID} .tks-chip .tks-open svg{width:12px!important;height:12px!important;display:block;flex-shrink:0;}

      #${PANEL_ID} .tks-actions{display:flex;gap:8px;margin-top:12px;}
      #${PANEL_ID} .tks-act{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 8px;border-radius:10px;cursor:pointer;font-size:12.5px;font-weight:700;color:rgba(255,255,255,.92);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);transition:background .12s,transform .12s,border-color .12s;}
      #${PANEL_ID} .tks-act:hover{background:rgba(255,255,255,.13);transform:translateY(-1px);color:#fff;}
      #${PANEL_ID} .tks-act:active{background:linear-gradient(135deg,${ACCENT},#4a6fd6);border-color:transparent;color:#fff;transform:translateY(0);}
      #${PANEL_ID} .tks-foot2{display:flex;gap:7px;margin-top:8px;}
      #${PANEL_ID} .tks-mini{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:rgba(255,255,255,.72);font-size:11.5px;font-weight:600;transition:background .12s,color .12s;}
      #${PANEL_ID} .tks-mini:hover{background:rgba(255,255,255,.1);color:#fff;}
      #${PANEL_ID} #tks-clear:hover{background:rgba(224,65,74,.18);border-color:rgba(224,65,74,.4);}
      #${PANEL_ID} #tks-autorot.tks-on{background:${ACCENT};border-color:${ACCENT};color:#fff;}
      #${PANEL_ID} .tks-mini.tks-fill{margin-left:auto;}

      /* Seçici pencere */
      #${PICK_ID}{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:rgba(6,7,11,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overscroll-behavior:contain;font-family:"Builder Sans","Gotham SSm",Helvetica,Arial,sans-serif;opacity:0;transition:opacity .16s;}
      #${PICK_ID}.tks-open{opacity:1;}
      #${PICK_ID} .tks-pk-card{width:min(97vw,1060px);height:min(90vh,880px);display:flex;flex-direction:column;background:rgba(17,18,26,.96);border:1px solid rgba(255,255,255,.10);border-radius:16px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.6);}
      #${PICK_ID} .tks-pk-head{display:flex;align-items:center;gap:9px;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.07);}
      #${PICK_ID} .tks-pk-titles{display:flex;flex-direction:column;min-width:0;line-height:1.25;}
      #${PICK_ID} .tks-pk-title{font-size:14px;font-weight:800;color:#fff;}
      #${PICK_ID} .tks-pk-sub{font-size:11px;color:rgba(255,255,255,.5);}
      #${PICK_ID} .tks-pk-x{margin-left:auto;width:30px;height:30px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.7);background:rgba(255,255,255,.06);border-radius:8px;}
      #${PICK_ID} .tks-pk-x:hover{background:rgba(255,255,255,.13);color:#fff;}
      #${PICK_ID} .tks-pk-search{display:flex;align-items:center;gap:8px;margin:12px 14px 8px;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.6);}
      #${PICK_ID} .tks-pk-search input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:13px;font-family:inherit;}
      #${PICK_ID} .tks-pk-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 14px 8px;}
      #${PICK_ID} .tks-pk-chip{padding:5px 11px;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:rgba(255,255,255,.7);font-size:11.5px;font-weight:600;}
      #${PICK_ID} .tks-pk-chip.tks-sel{background:${ACCENT};border-color:${ACCENT};color:#fff;}
      #${PICK_ID} .tks-pk-filters{display:flex;flex-wrap:wrap;gap:7px;margin:2px 14px 10px;align-items:center;}
      #${PICK_ID} .tks-pk-filters:empty{display:none;}
      #${PICK_ID} .tks-pk-fld{display:flex;flex-direction:column;gap:4px;min-width:0;}
      #${PICK_ID} .tks-pk-fld>label{font-size:9.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:rgba(255,255,255,.42);padding-left:1px;}
      #${PICK_ID} .tks-pk-fld select,#${PICK_ID} .tks-pk-fld input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;font-size:12.5px;padding:7px 9px;outline:none;font-family:inherit;cursor:pointer;}
      #${PICK_ID} .tks-pk-fld select:focus,#${PICK_ID} .tks-pk-fld input:focus{border-color:${ACCENT};}
      #${PICK_ID} .tks-pk-fld select option{background:#1b1d27;color:#fff;}
      #${PICK_ID} .tks-pk-fld select optgroup{background:#13141c;color:rgba(255,255,255,.55);font-weight:700;}
      #${PICK_ID} .tks-pk-fld input{cursor:text;width:62px;-moz-appearance:textfield;}
      #${PICK_ID} .tks-pk-fld input::-webkit-outer-spin-button,#${PICK_ID} .tks-pk-fld input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
      #${PICK_ID} .tks-pk-price-row{display:flex;gap:6px;align-items:center;color:rgba(255,255,255,.5);font-size:12px;}
      #${PICK_ID} .tks-pk-price-tag{flex-shrink:0;display:inline-flex;align-items:center;gap:3px;margin-right:8px;padding:3px 8px;border-radius:7px;background:rgba(255,255,255,.07);color:#d6e6a6;font-size:11.5px;font-weight:700;}
      /* Özel filtre pill + popover (Roblox filtreleri, bizim tasarımda) */
      #${PICK_ID} .tks-flt{position:relative;}
      #${PICK_ID} .tks-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:9px;cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#fff;font:600 12px "Builder Sans",sans-serif;}
      #${PICK_ID} .tks-pill:hover{background:rgba(255,255,255,.1);}
      #${PICK_ID} .tks-flt-open .tks-pill{border-color:${ACCENT};background:rgba(91,140,255,.14);}
      #${PICK_ID} .tks-pill-lbl{color:rgba(255,255,255,.5);}
      #${PICK_ID} .tks-pill-val{color:#fff;font-weight:700;}
      #${PICK_ID} .tks-pill svg{color:rgba(255,255,255,.5);transition:transform .15s;flex-shrink:0;}
      #${PICK_ID} .tks-flt-open .tks-pill svg{transform:rotate(180deg);}
      #${PICK_ID} .tks-pop{position:absolute;top:calc(100% + 6px);left:0;z-index:60;min-width:212px;max-height:300px;overflow-y:auto;overscroll-behavior:contain;background:rgba(22,24,33,.99);border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 16px 44px rgba(0,0,0,.55);padding:7px;display:none;}
      #${PICK_ID} .tks-flt-open .tks-pop{display:block;}
      #${PICK_ID} .tks-pop::-webkit-scrollbar{width:8px;}
      #${PICK_ID} .tks-pop::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:4px;}
      #${PICK_ID} .tks-opt-grp{font:700 9.5px/1 "Builder Sans",sans-serif;text-transform:uppercase;color:rgba(255,255,255,.4);padding:9px 8px 4px;letter-spacing:.4px;}
      #${PICK_ID} .tks-opt{display:flex;align-items:center;gap:10px;padding:8px 9px;border-radius:8px;cursor:pointer;}
      #${PICK_ID} .tks-opt:hover{background:rgba(255,255,255,.06);}
      #${PICK_ID} .tks-opt-txt{font:600 12.5px "Builder Sans",sans-serif;color:rgba(255,255,255,.82);}
      #${PICK_ID} .tks-opt.tks-sel .tks-opt-txt{color:#fff;}
      #${PICK_ID} .tks-radio{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.3);flex-shrink:0;position:relative;transition:border-color .12s;}
      #${PICK_ID} .tks-opt.tks-sel .tks-radio{border-color:${ACCENT};}
      #${PICK_ID} .tks-opt.tks-sel .tks-radio::after{content:"";position:absolute;inset:2.5px;border-radius:50%;background:${ACCENT};}
      #${PICK_ID} .tks-apply{width:100%;margin-top:7px;padding:9px;border:none;border-radius:8px;cursor:pointer;background:${ACCENT};color:#fff;font:700 12.5px "Builder Sans",sans-serif;}
      #${PICK_ID} .tks-apply:hover{filter:brightness(1.08);}
      #${PICK_ID} .tks-pop-in{width:100%;box-sizing:border-box;margin-top:5px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#fff;font-size:12.5px;outline:none;font-family:inherit;}
      #${PICK_ID} .tks-pop-in:focus{border-color:${ACCENT};}
      #${PICK_ID} .tks-pop-prices{display:flex;align-items:center;gap:8px;padding:2px 2px;color:rgba(255,255,255,.5);}
      #${PICK_ID} .tks-pop-check{display:flex;align-items:center;gap:8px;padding:9px 4px 3px;font-size:12px;color:rgba(255,255,255,.78);cursor:pointer;}
      #${PICK_ID} .tks-pop-check input{width:15px;height:15px;accent-color:${ACCENT};cursor:pointer;}
      #${PICK_ID} .tks-pop-prices input{flex:1;min-width:0;-moz-appearance:textfield;}
      #${PICK_ID} .tks-pop-prices input::-webkit-outer-spin-button,#${PICK_ID} .tks-pop-prices input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
      #${PICK_ID} .tks-pk-list{overflow-y:auto;overscroll-behavior:contain;padding:0 8px 12px;flex:1 1 auto;min-height:380px;}
      #${PICK_ID} .tks-pk-list::-webkit-scrollbar{width:8px;}
      #${PICK_ID} .tks-pk-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:4px;}
      #${PICK_ID} .tks-pk-row{display:flex;align-items:center;gap:11px;padding:8px;border-radius:10px;transition:background .1s;}
      #${PICK_ID} .tks-pk-row:hover{background:rgba(255,255,255,.05);}
      #${PICK_ID} .tks-pk-thumb{width:44px;height:44px;flex-shrink:0;border-radius:8px;background:rgba(255,255,255,.06);overflow:hidden;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);cursor:pointer;transition:filter .12s;}
      #${PICK_ID} .tks-pk-thumb:hover{filter:brightness(1.12);}
      #${PICK_ID} .tks-pk-thumb img{width:100%;height:100%;object-fit:contain;}
      #${PICK_ID} .tks-pk-name{flex:1;min-width:0;font-size:13px;color:#eef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}
      #${PICK_ID} .tks-pk-name:hover{color:#fff;text-decoration:underline;}
      #${PICK_ID} .tks-pk-add{width:32px;height:32px;flex-shrink:0;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;background:${ACCENT};transition:filter .12s;}
      #${PICK_ID} .tks-pk-add:hover{filter:brightness(1.1);}
      #${PICK_ID} .tks-pk-add.added{background:#2e9e5b;}
      #${PICK_ID} .tks-pk-empty,#${PICK_ID} .tks-pk-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:36px 18px;text-align:center;font-size:12.5px;color:rgba(255,255,255,.5);}
      #${PICK_ID} .tks-pk-loading .tks-spin{width:32px;height:32px;border-radius:50%;border:3px solid rgba(255,255,255,.14);border-top-color:${ACCENT};animation:tks-rot .8s linear infinite;}
      /* 7'li grid kart düzeni — gerçek marketplace gibi (thumbnail + isim + geliştirici + Robux fiyat) */
      #${PICK_ID} .tks-pk-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:11px;padding:4px 2px 10px;}
      #${PICK_ID} .tks-ci{display:flex;flex-direction:column;gap:2px;min-width:0;}
      #${PICK_ID} .tks-ci-thumb{position:relative;width:100%;aspect-ratio:1/1;border-radius:11px;background:rgba(255,255,255,.06);overflow:hidden;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.3);cursor:pointer;transition:filter .12s;}
      #${PICK_ID} .tks-ci-thumb:hover{filter:brightness(1.1);}
      #${PICK_ID} .tks-ci-thumb img{width:100%;height:100%;object-fit:contain;}
      #${PICK_ID} .tks-ci-thumb svg{width:34px;height:34px;}
      #${PICK_ID} .tks-ci-add{position:absolute;bottom:5px;right:5px;width:27px;height:27px;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;background:${ACCENT};opacity:.94;box-shadow:0 2px 7px rgba(0,0,0,.45);transition:filter .12s,opacity .12s,transform .12s;}
      #${PICK_ID} .tks-ci-add:hover{filter:brightness(1.12);opacity:1;transform:scale(1.06);}
      #${PICK_ID} .tks-ci-add.added{background:#2e9e5b;}
      #${PICK_ID} .tks-ci-add svg{width:16px!important;height:16px!important;display:block;}
      #${PICK_ID} .tks-ci-name{font-size:11.5px;line-height:1.25;font-weight:600;color:#eef;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer;margin-top:3px;}
      #${PICK_ID} .tks-ci-name:hover{color:#fff;text-decoration:underline;}
      #${PICK_ID} .tks-ci-by{font-size:10px;color:rgba(255,255,255,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      #${PICK_ID} .tks-ci-price{display:inline-flex;align-items:center;gap:3px;font-size:12px;font-weight:800;color:#fff;margin-top:1px;}
      #${PICK_ID} .tks-ci-price svg{flex-shrink:0;opacity:.92;}
      #${PICK_ID} .tks-ci-free{color:#7fd99a;}
      #${PICK_ID} .tks-ci-na{color:rgba(255,255,255,.38);font-weight:600;}
      #${PICK_ID} .tks-pk-more{display:flex;align-items:center;justify-content:center;padding:16px 0 6px;}
      #${PICK_ID} .tks-pk-more .tks-spin{width:24px;height:24px;border-radius:50%;border:3px solid rgba(255,255,255,.14);border-top-color:${ACCENT};animation:tks-rot .8s linear infinite;}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ── Three.js (talep üzerine) ──
  let _threePromise = null;
  function ensureThree() {
    if (window.THREE && window.THREE.OBJLoader && window.THREE.MTLLoader && window.THREE.OrbitControls) return Promise.resolve(true);
    if (_threePromise) return _threePromise;
    _threePromise = new Promise((resolve) => {
      try { chrome.runtime.sendMessage({ action: 'trackedSandboxLoadThree' }, () => {}); }
      catch (_) { resolve(false); return; }
      let n = 0;
      const iv = setInterval(() => {
        n++;
        const ok = window.THREE && window.THREE.OBJLoader && window.THREE.MTLLoader && window.THREE.OrbitControls;
        if (ok) { clearInterval(iv); resolve(true); }
        else if (n > 120) { clearInterval(iv); resolve(false); }
      }, 50);
    });
    return _threePromise;
  }

  // ── Native önizleme kutusunu bul (render overlay'inin biniceği yer) ──
  function findPreviewBox() {
    const sels = ['.thumbnail-holder', '[class*="thumbnail-holder"]', '[class*="avatar-3d"]', '[class*="AvatarThumbnail"]'];
    for (const s of sels) { const el = document.querySelector(s); if (el && el.clientWidth > 120) return el; }
    const back = document.querySelector('.avatar-back');
    if (back) {
      const par = back.parentElement;
      if (par && par.clientWidth > 120 && par.clientHeight > 120) return par;
      return back;
    }
    const canvas = document.querySelector('canvas[data-engine*="three"]');
    if (canvas && canvas.parentElement) return canvas.parentElement;
    return null;
  }

  function ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) { overlayEl = document.getElementById(OVERLAY_ID); return; }
    const box = findPreviewBox();
    if (!box) return;
    const cs = getComputedStyle(box);
    if (cs.position === 'static') box.style.position = 'relative';
    const ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.innerHTML = `<div class="tks-stage"></div>`;
    box.appendChild(ov);
    overlayEl = ov;
    if (resizeObs) { try { resizeObs.disconnect(); } catch (_) {} }
    resizeObs = new ResizeObserver(() => { if (viewer && overlayEl && overlayEl.classList.contains('tks-show')) viewer.resize(); });
    resizeObs.observe(box);
  }

  function getStage() { return overlayEl && overlayEl.querySelector('.tks-stage'); }
  function showOverlay(on) { if (overlayEl) overlayEl.classList.toggle('tks-show', !!on); }

  // ── Kontrol paneli ──
  function mountPoint() {
    return document.querySelector('.left-wrapper .avatar-back') ||
           document.querySelector('.avatar-back') ||
           document.querySelector('.left-wrapper') ||
           document.querySelector('[class*="avatar-card"]');
  }
  function ensurePanel() {
    if (!onEditorPage()) return;
    ensureOverlay();
    if (document.getElementById(PANEL_ID)) return;
    const anchor = mountPoint(); if (!anchor) return;
    const p = document.createElement('div');
    p.id = PANEL_ID;
    if (collapsed) p.classList.add('tks-collapsed');
    p.innerHTML = `
      <div class="tks-p-head">
        <div class="tks-badge">${ICON_TRY}</div>
        <span class="tks-p-title">Avatar Try-On</span>
        <span class="tks-p-badge" id="tks-p-count" style="display:none">0</span>
        <span class="tks-p-chev">${ICON_CHEVRON}</span>
      </div>
      <div class="tks-p-body">
        <div class="tks-tray"></div>
        <div class="tks-hint" id="tks-hint">Add items from your inventory or the marketplace — tried on above, no purchase.</div>
        <div class="tks-actions">
          <button class="tks-act" id="tks-inv">${ICON_INV}<span>Inventory</span></button>
          <button class="tks-act" id="tks-mkt">${ICON_STORE}<span>Marketplace</span></button>
        </div>
        <div class="tks-foot2">
          <button class="tks-mini" id="tks-clear">${ICON_TRASH}<span>Clear</span></button>
          <button class="tks-mini tks-fill" id="tks-mode" title="2B (kusursuz) - 3B (dondurulebilir)">${ICON_CUBE}<span>3D</span></button>
          <button class="tks-mini" id="tks-autorot">${ICON_ROTATE}<span>Rotate</span></button>
        </div>
      </div>`;
    if (anchor.classList.contains('avatar-back') || anchor.matches('[class*="avatar-card"]')) anchor.insertAdjacentElement('afterend', p);
    else anchor.insertAdjacentElement('beforeend', p);
    panelEl = p;

    p.querySelector('.tks-p-head').addEventListener('click', () => { collapsed = !collapsed; p.classList.toggle('tks-collapsed', collapsed); });
    p.querySelector('#tks-inv').addEventListener('click', openInventory);
    p.querySelector('#tks-mkt').addEventListener('click', openMarketplace);
    p.querySelector('#tks-clear').addEventListener('click', () => { session = []; saveSession(); renderTray(); runRender(currentMode); });
    p.querySelector('#tks-autorot').addEventListener('click', () => {
      const btn = p.querySelector('#tks-autorot');
      if (viewer) btn.classList.toggle('tks-on', viewer.toggleAutoRotate());
      else btn.classList.toggle('tks-on');
    });
    // HİBRİT 2B/3B: varsayılan 2B (Roblox'un kusursuz render'ı, texture sorunu yok). Toggle ile 3B'ye
    // geç (döndürülebilir). Rotate yalnızca 3B'de anlamlı → 2B'de gizle.
    const modeBtn = p.querySelector('#tks-mode'), rotBtn = p.querySelector('#tks-autorot');
    function updateModeUI() {
      const lbl = modeBtn.querySelector('span'); if (lbl) lbl.textContent = currentMode === '2d' ? '3D' : '2D';
      modeBtn.classList.toggle('tks-on', currentMode === '3d');
      rotBtn.style.display = currentMode === '3d' ? '' : 'none';
    }
    modeBtn.addEventListener('click', () => { currentMode = currentMode === '2d' ? '3d' : '2d'; updateModeUI(); runRender(currentMode); });
    updateModeUI();

    renderTray();
    runRender(currentMode); // varsayılan 2B
  }

  function updateCount() {
    if (!panelEl) return;
    const b = panelEl.querySelector('#tks-p-count'); if (b) { const n = session.length; b.style.display = n ? '' : 'none'; if (n) b.textContent = String(n); }
    const hint = panelEl.querySelector('#tks-hint'); if (hint) hint.style.display = session.length ? 'none' : '';
  }
  function renderTray() {
    updateCount();
    const tray = panelEl && panelEl.querySelector('.tks-tray');
    if (!tray) return;
    tray.innerHTML = '';
    session.forEach((it) => {
      const chip = document.createElement('div');
      chip.className = 'tks-chip' + (it.enabled ? '' : ' tks-off');
      chip.title = it.name || ('Item ' + it.id);
      chip.innerHTML = `<div class="tks-chip-inner">${it.thumb ? `<img src="${escapeHtml(it.thumb)}" alt="">` : `<span class="tks-chip-ph">${ICON_CUBE}</span>`}</div>` +
        `<button class="tks-open" title="Roblox'ta aç (animasyonu izle)">${ICON_EXT}</button>` +
        `<button class="tks-rm" title="Kaldır">${ICON_X_SM}</button>`;
      // Chip gövdesi → enabled aç/kapa; X → kaldır; dış-link → Roblox catalog sayfasını aç (animasyonu
      // burada oynatamayız ama catalog'da Roblox motoru oynatır → "Watch on Roblox").
      chip.addEventListener('click', (e) => { if (e.target.closest('.tks-rm') || e.target.closest('.tks-open')) return; it.enabled = !it.enabled; saveSession(); renderTray(); runRender(currentMode); });
      chip.querySelector('.tks-open').addEventListener('click', (e) => { e.stopPropagation(); window.open('https://www.roblox.com/' + (it.isBundle ? 'bundles/' : 'catalog/') + it.id, '_blank', 'noopener'); });
      chip.querySelector('.tks-rm').addEventListener('click', (e) => { e.stopPropagation(); session = session.filter(s => s !== it); saveSession(); renderTray(); runRender(currentMode); });
      tray.appendChild(chip);
    });
  }

  function setOverlay(html) {
    const stage = getStage(); if (!stage) return;
    let ov = stage.querySelector('.tks-overlay');
    if (!ov) { ov = document.createElement('div'); ov.className = 'tks-overlay'; stage.appendChild(ov); }
    ov.innerHTML = html; ov.style.display = 'flex';
  }
  function hideStatus() { const stage = getStage(); const ov = stage && stage.querySelector('.tks-overlay'); if (ov) ov.style.display = 'none'; }
  function setStatus(t) { setOverlay(`<div class="tks-spin"></div><div class="tks-status">${escapeHtml(t)}</div>`); }
  // Kısa, kendiliğinden kaybolan bilgi notu (ör. animasyon önizlenemez) — render'ı engellemez.
  function showNote(text) {
    if (!overlayEl) return;
    let n = overlayEl.querySelector('.tks-note');
    if (!n) {
      n = document.createElement('div'); n.className = 'tks-note';
      n.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(20,20,28,.94);color:rgba(255,255,255,.92);font-size:11px;line-height:1.3;padding:6px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.12);max-width:92%;text-align:center;z-index:30;pointer-events:none;transition:opacity .3s;';
      overlayEl.appendChild(n);
    }
    n.textContent = text; n.style.opacity = '1';
    clearTimeout(n._t); n._t = setTimeout(() => { n.style.opacity = '0'; }, 4500);
  }
  function showError(title, detail, allow2d) {
    const retry = allow2d ? `<button class="tks-retry" id="tks-r2">Try as image</button>` : `<button class="tks-retry" id="tks-r3">Try again</button>`;
    setOverlay(`<div class="tks-err-title">${escapeHtml(title)}</div><div class="tks-err-detail">${escapeHtml(detail || '')}</div>${retry}`);
    const r2 = overlayEl.querySelector('#tks-r2'), r3 = overlayEl.querySelector('#tks-r3');
    if (r2) r2.addEventListener('click', () => runRender('2d'));
    if (r3) r3.addEventListener('click', () => runRender('3d'));
  }

  function sandboxRequest(payload) {
    return new Promise((resolve) => {
      try { chrome.runtime.sendMessage(payload, (resp) => { if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; } resolve(resp || { ok: false, error: 'empty' }); }); }
      catch (e) { resolve({ ok: false, error: String(e) }); }
    });
  }

  async function runRender(mode) {
    ensureOverlay();
    currentMode = mode || currentMode;
    const ids = enabledIds();

    // Deneme item'ı yok → overlay'i kaldır, NATIVE önizleme görünsün
    if (!ids.length) { if (viewer) { try { viewer.dispose(); } catch (_) {} viewer = null; } showOverlay(false); return; }
    if (!overlayEl) return;
    showOverlay(true);

    const key = currentMode + ':' + ids.slice().sort((a, b) => a - b).join(',');
    if (currentMode === '3d') {
      setStatus('Loading 3D engine…');
      const ready = await ensureThree();
      if (!overlayEl || !overlayEl.classList.contains('tks-show')) return;
      if (!ready) { showError('3D engine failed to load', 'Three.js couldn\'t start.', true); return; }
    }
    if (comboCache.has(key)) { applyResp(comboCache.get(key), currentMode); return; }
    setStatus(currentMode === '3d' ? 'Preparing your avatar…' : 'Preparing preview…');
    const resp = await sandboxRequest({ action: 'trackedSandboxRender', assetIds: ids, thumbnailType: currentMode });
    if (!overlayEl || !overlayEl.classList.contains('tks-show')) return;
    if (!resp || !resp.ok) {
      // SW rbxcdn manifestine ulaşamadıysa (manifest_fetch_failed) → SAYFA context'inden dene.
      // 2B görselleri sayfadan yüklendiğine göre sayfa rbxcdn'e erişebiliyor; SW bloklanmış olabilir.
      if (resp && resp.error === 'manifest_fetch_failed' && resp.imageUrl && currentMode === '3d') {
        const okClient = await clientFetch3D(resp.imageUrl, key, resp.skinTone);
        if (okClient) return;
      }
      const err = (resp && resp.error) || 'bilinmeyen hata';
      let stepInfo = '';
      try { const st = resp && resp.diag && resp.diag.steps; if (st && st.length) { const l = st[st.length - 1]; stepInfo = ' · ' + l.s + (l.status != null ? ' (' + l.status + ')' : ''); } } catch (_) {}
      showError(currentMode === '3d' ? 'Couldn\'t load 3D preview' : 'Couldn\'t load preview', 'Error: ' + err + stepInfo, currentMode === '3d');
      console.warn('[Tracked Sandbox] render →', JSON.stringify(resp));
      return;
    }
    comboCache.set(key, resp);
    if (comboCache.size > 12) comboCache.delete(comboCache.keys().next().value);
    applyResp(resp, currentMode);
    // Animasyon eklenmişse: render edilemez (avatarda oynar) → kullanıcıya kısa not.
    const sk = resp.diag && resp.diag.skipped;
    if (sk && sk.length) showNote(sk.length === 1
      ? 'Animation can\'t be previewed here — click the item\'s ↗ to watch on Roblox.'
      : `${sk.length} animations can't be previewed — click ↗ to watch on Roblox.`);
  }

  // SW rbxcdn'e ulaşamazsa (manifest_fetch_failed) → 3B varlıklarını SAYFA context'inden çek.
  // rbxcdn genelde Access-Control-Allow-Origin:* gönderir → sayfa fetch'i CORS-uyumlu okuyabilir.
  // (2B görselleri zaten sayfadan yükleniyor; SW bloklanmışsa sayfa erişebilir.) Olmazsa false döner.
  async function clientFetch3D(manUrl, key, skinTone) {
    if (!overlayEl || !overlayEl.classList.contains('tks-show')) return false;
    setStatus('Loading 3D…');
    const base = manUrl.slice(0, manUrl.lastIndexOf('/') + 1);
    const cdnAlgo = (name) => { let i = 31; for (let k = 0; k < name.length; k++) i ^= name.charCodeAt(k); return 'https://t' + (i & 7) + '.rbxcdn.com/' + name; };
    // rbxcdn dosyalarını TÜM t0-t7 alt-domain'lerinden dene: tek node (ör. t4) ERR_CONNECTION_RESET
    // verirse diğeri çoğu zaman çalışır. + base + algo. İlk 200 döneni kullan.
    const urlsFor = (h) => {
      const nm = String(h).split('/').pop().split('?')[0];
      let urls = [];
      if (/^https?:/i.test(h)) urls.push(h);
      else urls.push(cdnAlgo(nm), base + nm);
      if (/rbxcdn\.com/i.test(h) || !/^https?:/i.test(h)) for (let t = 0; t < 8; t++) urls.push('https://t' + t + '.rbxcdn.com/' + nm);
      return [...new Set(urls)];
    };
    const fetchA = async (h) => {
      if (!h) return null;
      for (const u of urlsFor(h)) { try { const r = await fetch(u, { credentials: 'omit' }); if (r.ok) return r; } catch (_) {} }
      return null;
    };
    // obj/mtl için BOŞ-OLMAYAN metin bulana kadar tüm node'ları dene: bazı node 200 ama BOŞ gövde
    // döndürüyor (mtlLen:0 → beyaz avatar). İlk dolu metni kullan.
    const fetchText = async (h) => {
      if (!h) return '';
      for (const u of urlsFor(h)) {
        try { const r = await fetch(u, { credentials: 'omit' }); if (r.ok) { const t = await r.text(); if (t && t.trim().length) return t; } } catch (_) {}
      }
      return '';
    };
    try {
      const manText = await fetchText(manUrl);
      if (!manText) throw new Error('manifest unreachable');
      let manifest = null; try { manifest = JSON.parse(manText); } catch (_) {}
      if (!manifest || !(manifest.obj || manifest.mtl)) {
        if (/^\s*(#|v |o |g |mtllib|usemtl)/.test(manText)) { const r = { type: '3d', objText: manText, mtlText: '', textures: {}, manifest: null, skinTone }; comboCache.set(key, r); applyResp(r, '3d'); return true; }
        throw new Error('bad manifest');
      }
      const objText = await fetchText(manifest.obj);
      const mtlText = manifest.mtl ? await fetchText(manifest.mtl) : '';
      if (!objText) throw new Error('no obj');
      const textures = {};
      await Promise.all((manifest.textures || []).map(async (h) => {
        const tr = await fetchA(h); if (!tr) return;
        const blob = await tr.blob();
        textures[String(h).split('/').pop()] = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(blob); });
      }));
      if (!overlayEl || !overlayEl.classList.contains('tks-show')) return true;
      const r = { type: '3d', objText, mtlText, textures, manifest, skinTone };
      comboCache.set(key, r); if (comboCache.size > 12) comboCache.delete(comboCache.keys().next().value);
      applyResp(r, '3d');
      console.log('[Tracked 3D] page-fetch OK', { obj: objText.length, mtl: mtlText.length, tex: Object.keys(textures).length });
      return true;
    } catch (e) {
      console.warn('[Tracked Sandbox] clientFetch3D →', e && e.message || e);
      return false; // sayfa fetch'i de olmadı → çağıran showError gösterir
    }
  }

  function clear2D() { const stage = getStage(); const o = stage && stage.querySelector('.tks-2d'); if (o) o.remove(); }
  function applyResp(resp, mode) {
    if (resp.type === '2d' && resp.imageUrl) { if (viewer) { try { viewer.dispose(); } catch (_) {} viewer = null; } hideStatus(); clear2D(); const img = document.createElement('img'); img.className = 'tks-2d'; img.src = resp.imageUrl; getStage().appendChild(img); return; }
    if (resp.type === '3d' && resp.objText) { try { build3D(resp); hideStatus(); } catch (e) { console.error('[Tracked Sandbox] 3D error:', e); showError('Couldn\'t render 3D', String(e && e.message || e), true); } return; }
    showError('Unexpected response', 'Render data missing.', mode === '3d');
  }

  // ── Three.js 3D viewer ──
  function build3D(data) {
    const THREE = window.THREE;
    const stage = getStage();
    if (viewer) { try { viewer.dispose(); } catch (_) {} viewer = null; }
    clear2D();

    const W = stage.clientWidth || 300, H = stage.clientHeight || 360;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    // Tone mapping → highlight'ları sıkıştırır; Roblox texture'ları zaten gölgeli olduğu için
    // güçlü ışık + tone mapping olmadan "parlak beyaz"a patlıyordu.
    if ('toneMapping' in renderer && THREE.ACESFilmicToneMapping != null) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; }
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 5000);
    // Roblox avatar texture'ları BAKED (gölgeli) → düz, dengeli ışık; az yönlü, çok ortam.
    // Eski toplam ~3.0 idi → beyaza patlıyordu. Yeni toplam ~1.85 + tone mapping.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444a55, 0.8));
    const kl = new THREE.DirectionalLight(0xffffff, 0.55); kl.position.set(2, 3, 4); scene.add(kl);
    const fl = new THREE.DirectionalLight(0xcfe0ff, 0.2); fl.position.set(-3, 1, -2); scene.add(fl);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const textures = data.textures || {};
    const texKeys = Object.keys(textures);
    // Kullanıcının skin tone'u (SW'den). Texture'sız/sculpted gövdeler Roblox gibi bu renge boyanır.
    const skinHex = (() => { const s = String(data.skinTone || '').replace('#', ''); const n = parseInt(s, 16); return (s.length === 6 && !isNaN(n)) ? n : 0xb8b2ad; })();
    const manager = new THREE.LoadingManager();
    // Texture eşleme: önce tam URL, sonra dosya adı, sonra FUZZY (hash içerme). Roblox'un MTL'i
    // texture'ı bazen farklı/uzun bir adla referanslıyor (özellikle gövde kompozit texture'ı) →
    // tam isim tutmayınca gövde BEYAZ kalıyordu. Hash substring eşlemesi bunu kurtarır.
    manager.setURLModifier((url) => {
      if (!url) return url;
      if (textures[url]) return textures[url];
      const b = url.split('/').pop().split('?')[0];
      if (textures[b]) return textures[b];
      const hit = texKeys.find(k => k && (b.includes(k) || k.includes(b)));
      return hit ? textures[hit] : url;
    });

    let materials = null;
    if ((data.mtlText || '').trim()) {
      try { const ml = new THREE.MTLLoader(manager); materials = ml.parse(data.mtlText, ''); materials.preload(); }
      catch (e) { console.warn('[Tracked Sandbox] MTL uyarı:', e); }
    }
    const ol = new THREE.OBJLoader(manager);
    if (materials) ol.setMaterials(materials);
    const root = ol.parse(data.objText);

    const tl = new THREE.TextureLoader(manager);
    let meshCount = 0, mappedCount = 0, nameMatched = 0;
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      meshCount++;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => {
        // MTL boş/eksikse materyalin map'i olmaz → usemtl adını texture hash'iyle eşleyip map'i
        // KENDİMİZ atarız (MTL'e bağımlılığı kır). İsim hash içermiyorsa nötr tene düşer (beyaz değil).
        if (!mat.map && mat.name && texKeys.length) {
          const nm = String(mat.name);
          const hit = texKeys.find(k => k && (nm.includes(k) || k.includes(nm)));
          if (hit) { try { mat.map = tl.load(textures[hit]); nameMatched++; } catch (_) {} }
        }
        if (mat.map) {
          mappedCount++;
          if ('encoding' in mat.map) mat.map.encoding = THREE.sRGBEncoding;
          if ('colorSpace' in mat.map && THREE.SRGBColorSpace) mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.map.anisotropy = 4;
          if (mat.color) mat.color.setHex(0xffffff);
        } else if (mat.color) {
          mat.color.setHex(skinHex); // texture yok → kullanıcının SKIN TONE'u (sculpted gövde Roblox gibi tene boyanır)
        }
        if ('shininess' in mat) mat.shininess = 6;
        if (mat.specular && mat.specular.setHex) mat.specular.setHex(0x111111);
        mat.transparent = false; mat.alphaTest = 0; mat.depthWrite = true; mat.depthTest = true; mat.side = THREE.DoubleSide; mat.needsUpdate = true;
      });
    });
    console.log('[Tracked 3D]', { meshes: meshCount, mapped: mappedCount, nameMatched, textures: texKeys.length, mtlLen: (data.mtlText || '').length, objLen: (data.objText || '').length });
    // GARANTİ — hiçbir koşulda parlak beyaz olmasın: yüklenemeyen (boş image) map'leri nötr tene çevir.
    // manager.onLoad + zamanlayıcı (onLoad bazen erken/geç tetikleniyor; ikisi birden güvence).
    // GARANTİ YÖNTEM — texture'ın ortalama rengini örnekle (data-URL → canvas taint YOK):
    //  • Açık + DÜŞÜK doygunluk (beyaz/gri TEN texture'ı, sculpted gövde) → skin tone ile ÇARP (Roblox gibi).
    //  • Renkli texture (maymun kürkü/aksesuar) → olduğu gibi bırak (color beyaz = map'i değiştirme).
    //  • Yüklenemeyen (boş) map → skin tone (asla parlak beyaz).
    const sampleAvg = (img) => {
      try {
        const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
        const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 16, 16);
        const d = cx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 10) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        return n ? { r: r / n, g: g / n, b: b / n } : null;
      } catch (_) { return null; }
    };
    const colorPass = () => {
      root.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => {
          if (!mat.map || mat._tkTint) return;
          const img = mat.map.image;
          if (!img || !img.width) { mat.map = null; if (mat.color) mat.color.setHex(skinHex); mat.needsUpdate = true; return; }
          const a = sampleAvg(img); if (!a) return;
          const mx = Math.max(a.r, a.g, a.b), mn = Math.min(a.r, a.g, a.b);
          const sat = mx ? (mx - mn) / mx : 0, bright = mx / 255;
          // Açık + orta-düşük doygunluk → ten texture'ı (gövde/kol/bacak) → skin tone ile çarp.
          // Eşik gevşetildi (sat<0.40, bright>0.42) ki bacak gibi biraz daha doygun ten parçaları da girsin.
          if (mat.color) mat.color.setHex((bright > 0.42 && sat < 0.40) ? skinHex : 0xffffff);
          mat._tkTint = true; mat.needsUpdate = true;
        });
      });
    };
    manager.onLoad = colorPass;
    [700, 1800, 3500].forEach(t => setTimeout(colorPass, t));
    scene.add(root);

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = (maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.45;
    camera.position.set(0, size.y * 0.05, dist);
    camera.near = dist / 100; camera.far = dist * 100; camera.updateProjectionMatrix();

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
    controls.minDistance = dist * 0.45; controls.maxDistance = dist * 2.2;
    controls.target.set(0, 0, 0);
    const autoBtn = panelEl && panelEl.querySelector('#tks-autorot');
    controls.autoRotate = !!(autoBtn && autoBtn.classList.contains('tks-on'));
    controls.autoRotateSpeed = 1.4; controls.update();

    let raf = 0, alive = true;
    const loop = () => { if (!alive) return; controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();
    const resize = () => { if (!alive) return; const w = stage.clientWidth || W, h = stage.clientHeight || H; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
    window.addEventListener('resize', resize);

    viewer = {
      resize,
      toggleAutoRotate() { controls.autoRotate = !controls.autoRotate; return controls.autoRotate; },
      dispose() {
        alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
        try { controls.dispose(); } catch (_) {}
        try { scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }); } catch (_) {}
        try { renderer.dispose(); } catch (_) {}
        try { renderer.forceContextLoss && renderer.forceContextLoss(); } catch (_) {}
        if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }

  // ── Seçici pencere ──
  function closePicker() { const el = document.getElementById(PICK_ID); if (el) { el.classList.remove('tks-open'); setTimeout(() => { try { el.remove(); } catch (_) {} }, 180); } }
  function buildPicker(title, sub) {
    closePicker();
    const ov = document.createElement('div');
    ov.id = PICK_ID;
    ov.innerHTML = `
      <div class="tks-pk-card" role="dialog" aria-modal="true">
        <div class="tks-pk-head">
          <div class="tks-pk-titles"><span class="tks-pk-title">${escapeHtml(title)}</span><span class="tks-pk-sub">${escapeHtml(sub)}</span></div>
          <button class="tks-pk-x" title="Kapat">${ICON_CLOSE}</button>
        </div>
        <div class="tks-pk-search">${ICON_SEARCH}<input type="text" placeholder="Search…" /></div>
        <div class="tks-pk-filters"></div>
        <div class="tks-pk-list"></div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('tks-open'));
    ov.querySelector('.tks-pk-x').addEventListener('click', closePicker);
    ov.addEventListener('click', (e) => { if (e.target === ov) closePicker(); });
    // SCROLL SIZINTISI FIX: liste dışındaki (backdrop/başlık/filtre) wheel olayları arkadaki SAYFAYI
    // kaydırmasın. Liste içi sınır-zincirlemesi ayrıca CSS overscroll-behavior:contain ile kesilir.
    ov.addEventListener('wheel', (e) => { if (!e.target.closest('.tks-pk-list') && !e.target.closest('.tks-pop')) e.preventDefault(); }, { passive: false });
    return ov;
  }
  function mkSelect(opts, val) { const s = document.createElement('select'); opts.forEach(([t, v]) => { const o = document.createElement('option'); o.textContent = t; o.value = v; if (v === val) o.selected = true; s.appendChild(o); }); return s; }
  function mkGroupedSelect(groups) {
    const s = document.createElement('select');
    groups.forEach(([label, opts]) => {
      const parent = label ? document.createElement('optgroup') : s;
      if (label) { parent.label = label; s.appendChild(parent); }
      opts.forEach(([t, v]) => { const o = document.createElement('option'); o.textContent = t; o.value = v; parent.appendChild(o); });
    });
    return s;
  }
  function mkField(label, control) { const f = document.createElement('div'); f.className = 'tks-pk-fld'; const l = document.createElement('label'); l.textContent = label; f.appendChild(l); f.appendChild(control); return f; }

  // ── Özel filtre pill + popover (radio seçenek + Uygula) ──
  function _fltPlumbing(wrap) {
    const outside = (e) => { if (!wrap.contains(e.target)) wrap._close(); };
    wrap._open = () => { wrap.classList.add('tks-flt-open'); setTimeout(() => document.addEventListener('mousedown', outside, true), 0); };
    wrap._close = () => { wrap.classList.remove('tks-flt-open'); document.removeEventListener('mousedown', outside, true); };
  }
  // groups: [[groupLabel|null, [[text,val],...]], ...]
  function createFilter(label, groups, value, onApply) {
    const labelOf = (v) => { for (const g of groups) { const o = g[1].find(x => x[1] === v); if (o) return o[0]; } return ''; };
    const wrap = document.createElement('div'); wrap.className = 'tks-flt';
    let cur = value, pending = value;
    const pill = document.createElement('button'); pill.type = 'button'; pill.className = 'tks-pill';
    const setPill = () => { pill.innerHTML = `<span class="tks-pill-lbl">${escapeHtml(label)}</span><span class="tks-pill-val">${escapeHtml(labelOf(cur))}</span>${ICON_CHEVRON}`; };
    setPill();
    const pop = document.createElement('div'); pop.className = 'tks-pop';
    const render = () => {
      pop.innerHTML = '';
      groups.forEach(([gl, opts]) => {
        if (gl) { const h = document.createElement('div'); h.className = 'tks-opt-grp'; h.textContent = gl; pop.appendChild(h); }
        opts.forEach(([t, v]) => {
          const o = document.createElement('div'); o.className = 'tks-opt' + (v === pending ? ' tks-sel' : '');
          o.innerHTML = `<span class="tks-radio"></span><span class="tks-opt-txt">${escapeHtml(t)}</span>`;
          o.addEventListener('click', () => { pending = v; render(); });
          pop.appendChild(o);
        });
      });
      const ap = document.createElement('button'); ap.type = 'button'; ap.className = 'tks-apply'; ap.textContent = 'Apply';
      ap.addEventListener('click', () => { cur = pending; setPill(); wrap._close(); onApply(cur); });
      pop.appendChild(ap);
    };
    _fltPlumbing(wrap);
    pill.addEventListener('click', (e) => { e.stopPropagation(); if (wrap.classList.contains('tks-flt-open')) wrap._close(); else { pending = cur; render(); wrap._open(); } });
    wrap.append(pill, pop);
    return { el: wrap, get value() { return cur; } };
  }
  function createPriceFilter(onApply, init) {
    const wrap = document.createElement('div'); wrap.className = 'tks-flt';
    let min = (init && init.min) || '', max = (init && init.max) || '', includeFree = !!(init && init.includeFree);
    const pill = document.createElement('button'); pill.type = 'button'; pill.className = 'tks-pill';
    const setPill = () => { const v = (min || max) ? ((min || '0') + '–' + (max || '∞')) : (includeFree ? 'Any +Free' : 'Any'); pill.innerHTML = `<span class="tks-pill-lbl">Price</span><span class="tks-pill-val">${escapeHtml(v)}</span>${ICON_CHEVRON}`; };
    setPill();
    const pop = document.createElement('div'); pop.className = 'tks-pop'; pop.style.minWidth = '194px';
    const render = () => {
      pop.innerHTML = '';
      const row = document.createElement('div'); row.className = 'tks-pop-prices';
      const mn = document.createElement('input'); mn.type = 'number'; mn.min = '0'; mn.placeholder = 'Min'; mn.value = min; mn.className = 'tks-pop-in';
      const mx = document.createElement('input'); mx.type = 'number'; mx.min = '0'; mx.placeholder = 'Max'; mx.value = max; mx.className = 'tks-pop-in';
      row.append(mn, document.createTextNode('–'), mx); pop.appendChild(row);
      const fr = document.createElement('label'); fr.className = 'tks-pop-check';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = includeFree;
      fr.appendChild(cb); fr.appendChild(document.createTextNode('Include free items'));
      pop.appendChild(fr);
      const ap = document.createElement('button'); ap.type = 'button'; ap.className = 'tks-apply'; ap.textContent = 'Apply';
      ap.addEventListener('click', () => { min = mn.value.trim(); max = mx.value.trim(); includeFree = cb.checked; setPill(); wrap._close(); onApply(); });
      pop.appendChild(ap);
    };
    _fltPlumbing(wrap);
    pill.addEventListener('click', (e) => { e.stopPropagation(); if (wrap.classList.contains('tks-flt-open')) wrap._close(); else { render(); wrap._open(); } });
    wrap.append(pill, pop);
    return { el: wrap, get min() { return min; }, get max() { return max; }, get includeFree() { return includeFree; } };
  }
  function createCreatorFilter(onApply, init) {
    const wrap = document.createElement('div'); wrap.className = 'tks-flt';
    let name = (init && init.name) || '';
    const pill = document.createElement('button'); pill.type = 'button'; pill.className = 'tks-pill';
    const setPill = () => { pill.innerHTML = `<span class="tks-pill-lbl">Creator</span><span class="tks-pill-val">${escapeHtml(name || 'All')}</span>${ICON_CHEVRON}`; };
    setPill();
    const pop = document.createElement('div'); pop.className = 'tks-pop';
    let mode = 'all';
    const render = () => {
      pop.innerHTML = '';
      [['All Creators', 'all'], ['Specific creator', 'name']].forEach(([t, m]) => {
        const o = document.createElement('div'); o.className = 'tks-opt' + (mode === m ? ' tks-sel' : '');
        o.innerHTML = `<span class="tks-radio"></span><span class="tks-opt-txt">${t}</span>`;
        o.addEventListener('click', () => { mode = m; render(); if (m === 'name') { const i = pop.querySelector('input'); if (i) i.focus(); } });
        pop.appendChild(o);
      });
      const inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'Creator name'; inp.value = name; inp.className = 'tks-pop-in';
      inp.addEventListener('focus', () => { mode = 'name'; });
      pop.appendChild(inp);
      const ap = document.createElement('button'); ap.type = 'button'; ap.className = 'tks-apply'; ap.textContent = 'Apply';
      ap.addEventListener('click', () => { name = mode === 'name' ? inp.value.trim() : ''; setPill(); wrap._close(); onApply(name); });
      pop.appendChild(ap);
    };
    _fltPlumbing(wrap);
    pill.addEventListener('click', (e) => { e.stopPropagation(); if (wrap.classList.contains('tks-flt-open')) wrap._close(); else { mode = name ? 'name' : 'all'; render(); wrap._open(); } });
    wrap.append(pill, pop);
    return { el: wrap, get name() { return name; } };
  }

  // Tek item kartı oluşturur (7'li grid + sonsuz kaydırma ekleme için ortak).
  function makeCard(it) {
    const card = document.createElement('div');
    card.className = 'tks-ci';
    const added = inSession(it.id);
    const priceHtml = (it.price == null)
      ? ''
      : (it.price === 0
        ? `<div class="tks-ci-price tks-ci-free">Free</div>`
        : `<div class="tks-ci-price">${ICON_ROBUX}<span>${Number(it.price).toLocaleString('en-US')}</span></div>`);
    const creatorHtml = it.creator ? `<div class="tks-ci-by" title="By ${escapeHtml(it.creator)}">By ${escapeHtml(it.creator)}</div>` : '';
    card.innerHTML =
      `<div class="tks-ci-thumb">${it.thumb ? `<img src="${escapeHtml(it.thumb)}">` : ICON_CUBE}` +
        `<button class="tks-ci-add ${added ? 'added' : ''}" title="Add to try-on">${added ? ICON_CHECK : ICON_PLUS}</button>` +
      `</div>` +
      `<div class="tks-ci-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</div>` +
      creatorHtml + priceHtml;
    // İsim/thumbnail'a tıkla → item'ın katalog/bundle sayfasını yeni sekmede aç (add butonu hariç)
    const openItem = () => window.open('https://www.roblox.com/' + (it.isBundle ? 'bundles/' : 'catalog/') + it.id, '_blank', 'noopener');
    card.querySelector('.tks-ci-thumb').addEventListener('click', (e) => { if (e.target.closest('.tks-ci-add')) return; openItem(); });
    card.querySelector('.tks-ci-name').addEventListener('click', openItem);
    const btn = card.querySelector('.tks-ci-add');
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleSessionItem(it); const now = inSession(it.id); btn.classList.toggle('added', now); btn.innerHTML = now ? ICON_CHECK : ICON_PLUS; });
    return card;
  }
  // append=true → mevcut grid'e ekle (sonsuz kaydırma); değilse temizleyip yeniden çiz.
  function renderRows(listEl, items, append) {
    let grid = append ? listEl.querySelector('.tks-pk-grid') : null;
    if (!grid) {
      listEl.innerHTML = '';
      if (!items.length) { listEl.innerHTML = `<div class="tks-pk-empty">No results</div>`; return; }
      grid = document.createElement('div'); grid.className = 'tks-pk-grid';
      listEl.appendChild(grid);
    }
    items.forEach((it) => grid.appendChild(makeCard(it)));
  }
  function loadingHtml(text) { return `<div class="tks-pk-loading"><div class="tks-spin"></div><div>${escapeHtml(text)}</div></div>`; }

  async function openInventory() {
    const ov = buildPicker('Try from Inventory', 'Wearable items you own');
    const listEl = ov.querySelector('.tks-pk-list');
    const input = ov.querySelector('.tks-pk-search input');
    const filters = ov.querySelector('.tks-pk-filters');
    // HAFIZA: son durumu yükle (type/sort/arama) → geri açınca oradan devam.
    const st = await loadPickerState(INV_KEY);
    if (!document.getElementById(PICK_ID)) return;
    if (st.search) input.value = st.search;
    // Grouped type filter matching all wearable categories of the native avatar editor
    const typeF = createFilter('Type', [
      [null, [['All types', '']]],
      ['Accessories', [['Hat', 'Hat'], ['Face', 'FaceAccessory'], ['Neck', 'NeckAccessory'], ['Shoulder', 'ShoulderAccessory'], ['Front', 'FrontAccessory'], ['Back', 'BackAccessory'], ['Waist', 'WaistAccessory']]],
      ['Hair & Head', [['Hair', 'HairAccessory'], ['Head', 'Head'], ['Face (classic)', 'Face']]],
      ['Makeup', [['Eyebrow', 'EyebrowAccessory'], ['Eyelash', 'EyelashAccessory']]],
      ['Clothing (Layered)', [['T-Shirt', 'TShirtAccessory'], ['Shirt', 'ShirtAccessory'], ['Sweater', 'SweaterAccessory'], ['Jacket', 'JacketAccessory'], ['Pants', 'PantsAccessory'], ['Shorts', 'ShortsAccessory'], ['Dress/Skirt', 'DressSkirtAccessory'], ['Left Shoe', 'LeftShoeAccessory'], ['Right Shoe', 'RightShoeAccessory']]],
      ['Clothing (Classic)', [['Classic T-Shirt', 'TShirt'], ['Classic Shirt', 'Shirt'], ['Classic Pants', 'Pants']]],
      ['Other', [['Gear', 'Gear']]]
    ], st.type || '', () => apply());
    const sortF = createFilter('Sort By', [[null, [['Default', 'default'], ['Name A-Z', 'az'], ['Name Z-A', 'za']]]], st.sort || 'default', () => apply());
    filters.append(typeF.el, sortF.el);

    listEl.innerHTML = loadingHtml('Loading inventory…');
    const resp = await sandboxRequest({ action: 'trackedSandboxInventory' });
    if (!document.getElementById(PICK_ID)) return;
    if (!resp || !resp.ok) { listEl.innerHTML = `<div class="tks-pk-empty">Couldn't load inventory.<br>${escapeHtml((resp && resp.error) || '')}</div>`; return; }
    const all = resp.items || [];
    if (!all.length) { listEl.innerHTML = `<div class="tks-pk-empty">No wearable items found.</div>`; return; }

    function apply() {
      savePickerState(INV_KEY, { type: typeF.value, sort: sortF.value, search: input.value.trim() }); // HAFIZA
      const q = (input.value || '').toLowerCase().trim();
      const t = typeF.value;
      let rows = all.filter(it => (!q || (it.name || '').toLowerCase().includes(q)) && (!t || String(it.assetType) === t));
      if (sortF.value === 'az') rows = rows.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      else if (sortF.value === 'za') rows = rows.slice().sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      renderRows(listEl, rows);
    }
    apply();
    let t = null; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 180); });
    input.focus();
  }

  async function openMarketplace() {
    const ov = buildPicker('Try from Marketplace', 'Roblox catalog — filter & try on without buying');
    const listEl = ov.querySelector('.tks-pk-list');
    const input = ov.querySelector('.tks-pk-search input');
    const filters = ov.querySelector('.tks-pk-filters');

    // ── Kategori ağacı: gerçek Roblox marketplace'iyle birebir (grup + alt-kategori TEK menüde) ──
    // Değer formatı "Category~Subcategory": Category = grup API kategorisi (boşsa yok), Subcategory =
    // catalog enum. SW bir DENEME ZİNCİRİ uygular (cat+sub → sub → cat → keyword) → uyumsuz kombinasyon
    // ya da yanlış enum 400 vermez, en kötü ihtimalle item adıyla (keyword) aranır. Onaylı çiftler
    // (Accessories+*, Clothing+klasik) ilk denemede tutar; belirsizler (Makeup/Bodysuit/Shoes/Bundles)
    // keyword fallback'ine düşer ama yine ilgili sonuç döner.
    const CAT_OPTS = [
      [null, [['All', '']]],
      ['Body', [['All Body', '4~'], ['Full Bodies', '~~BodyParts'], ['Hair', 'Accessories~HairAccessories'], ['Heads', '~Heads']]],
      ['Makeup', [['All Makeup', '~EyebrowAccessories'], ['Eyebrows', '~EyebrowAccessories'], ['Eyelashes', '~EyelashAccessories'], ['Eyes', '~EyeAccessories'], ['Lips', '~MoodAnimations'], ['Face', '~FaceAccessories']]],
      ['Clothing', [['All Clothing', 'Clothing~'], ['Shirts', 'Clothing~Shirts'], ['T-Shirts', 'Clothing~Tshirts'], ['Sweaters', 'Clothing~SweaterAccessories'], ['Jackets', 'Clothing~JacketAccessories'], ['Pants', 'Clothing~Pants'], ['Dresses & Skirts', 'Clothing~DressSkirtAccessories'], ['Bodysuits', '~BodySuit'], ['Shorts', 'Clothing~ShortsAccessories'], ['Shoes', '~RightShoeAccessories'], ['Classic Shirts', 'Clothing~ClassicShirts'], ['Classic T-Shirts', 'Clothing~ClassicTShirts'], ['Classic Pants', 'Clothing~ClassicPants']]],
      ['Accessories', [['All Accessories', 'Accessories~'], ['Head', 'Accessories~Hats'], ['Face', 'Accessories~FaceAccessories'], ['Neck', 'Accessories~NeckAccessories'], ['Shoulder', 'Accessories~ShoulderAccessories'], ['Front', 'Accessories~FrontAccessories'], ['Back', 'Accessories~BackAccessories'], ['Waist', 'Accessories~WaistAccessories'], ['Gear', 'Gear~']]],
      ['Animations', [['All Animations', 'AvatarAnimations~'], ['Bundles', '~AnimationBundles'], ['Emotes', '~EmoteAnimations']]]
    ];
    // value → keyword fallback etiketi ("All " ön-eki atılır). value geçerli mi kontrolü.
    const catLabelOf = (val) => { if (!val) return ''; for (const g of CAT_OPTS) { const o = g[1].find(x => x[1] === val); if (o) return o[0].replace(/^All\s+/, ''); } return ''; };
    const catValid = (val) => CAT_OPTS.some(g => g[1].some(x => x[1] === val));

    // HAFIZA: son durumu yükle → geri açınca aynı kategori/filtre/aramadan devam.
    const st = await loadPickerState(MKT_KEY);
    if (!document.getElementById(PICK_ID)) return;
    // Kayıtlı değeri doğrula: menüde artık olmayan eski değer yüklenip kafa karıştırmasın.
    let catVal = catValid(st.catVal) ? st.catVal : '';
    if (st.keyword) input.value = st.keyword;

    const catF = createFilter('Category', CAT_OPTS, catVal, (v) => { catVal = v; refresh(); });
    const sortF = createFilter('Sort By', [[null, [['Relevance', '0'], ['Most Favorited', '1'], ['Bestselling', '2'], ['Recently Published', '3'], ['Price (High to Low)', '5'], ['Price (Low to High)', '4']]]], st.sortType || '0', () => refresh());
    const priceF = createPriceFilter(() => refresh(), { min: st.min, max: st.max, includeFree: st.includeFree });
    const salesF = createFilter('Sales Type', [[null, [['All', ''], ['Limited', 'Limited']]]], st.salesType || '', () => refresh());
    const stockF = createFilter('Unavailable Items', [[null, [['Hide', 'hide'], ['Show', 'show']]]], st.showUnavailable ? 'show' : 'hide', () => refresh());
    const creatorF = createCreatorFilter(() => refresh(), { name: st.creatorName });

    filters.append(catF.el, sortF.el, priceF.el, salesF.el, stockF.el, creatorF.el);

    // SONSUZ KAYDIRMA: Roblox gibi aşağı indikçe sonraki sayfa yüklenir (30 sınırı YOK, her filtrede).
    // pg = sayfalama durumu; doSearch ilk sayfayı, loadMore sonrakileri çeker (aynı varyant + cursor).
    let pg = { cursor: '', variant: null, loading: false, done: true, baseReq: null };
    listEl.addEventListener('scroll', () => {
      if (pg.done || pg.loading || !pg.cursor) return;
      if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 320) loadMore();
    });

    // HERHANGİ bir filtre/arama default'tan farklıysa → gerçek catalog araması (filtreler devrede).
    // SADECE tertemiz durumda (hiçbir filtre dokunulmamış) → kişiselleştirilmiş "For You" feed.
    // (Eski bug: Category "All" iken Sort/Price/SalesType/Creator değişse bile feed gösteriliyordu
    //  → filtreler çalışmıyor görünüyordu.)
    function saveState() {
      savePickerState(MKT_KEY, {
        catVal, sortType: sortF.value,
        min: priceF.min, max: priceF.max, includeFree: priceF.includeFree,
        salesType: salesF.value, showUnavailable: stockF.value === 'show',
        creatorName: creatorF.name, keyword: input.value.trim()
      });
    }
    function refresh() {
      saveState(); // HAFIZA: her değişimde son durumu kaydet
      // ARTIK her durumda sayfalı arama → "All" (filtresiz) dahil sonsuz kaydırma çalışır.
      // Filtresiz/bare durumda SW popüler (MostFavorited) sonuç döndürür (popularDefault).
      doSearch();
    }
    async function doSearch() {
      const kw = input.value.trim();
      const [pcat, psub, pbundle] = (catVal || '').split('~'); // "Category~Subcategory~BundleType"
      const subEl = ov.querySelector('.tks-pk-sub');
      if (subEl) subEl.textContent = 'Roblox catalog — filter & try on without buying';
      listEl.innerHTML = loadingHtml(kw ? 'Searching…' : 'Loading…');
      const baseReq = {
        action: 'trackedSandboxCatalogSearch', keyword: kw,
        category: pcat || '', subcategory: psub || '', bundleType: pbundle || '', fallbackKeyword: catLabelOf(catVal),
        sortType: sortF.value,
        minPrice: priceF.min, maxPrice: priceF.max,
        salesType: salesF.value, showUnavailable: stockF.value === 'show',
        creatorName: creatorF.name, includeFree: priceF.includeFree
      };
      pg = { cursor: '', variant: null, loading: true, done: false, baseReq };
      const resp = await sandboxRequest(baseReq);
      pg.loading = false;
      if (!document.getElementById(PICK_ID)) return;
      if (!resp || !resp.ok) {
        const body = resp && resp.body ? `<br><span style="opacity:.55;font-size:11px">${escapeHtml(resp.body)}</span>` : '';
        listEl.innerHTML = `<div class="tks-pk-empty">Couldn't load.<br>${escapeHtml((resp && resp.error) || '')}${body}</div>`;
        pg.done = true; return;
      }
      renderRows(listEl, resp.items || []);
      listEl.scrollTop = 0;
      pg.cursor = resp.cursor || ''; pg.variant = (resp.variant != null) ? resp.variant : null;
      pg.done = !pg.cursor; // cursor yoksa son sayfa
      // İçerik scrollbar oluşturmadıysa (filtre çoğunu eledi) → kendiliğinden bir sonraki sayfayı çek.
      if (!pg.done && listEl.scrollHeight <= listEl.clientHeight + 4) loadMore();
    }
    // Sonsuz kaydırma: dibe yaklaşınca sıradaki sayfayı çek + grid'e EKLE (aynı çözülmüş varyant + cursor).
    async function loadMore() {
      if (pg.loading || pg.done || !pg.cursor || !pg.baseReq) return;
      pg.loading = true;
      const more = document.createElement('div'); more.className = 'tks-pk-more';
      more.innerHTML = `<div class="tks-spin"></div>`; listEl.appendChild(more);
      const resp = await sandboxRequest({ ...pg.baseReq, cursor: pg.cursor, variant: pg.variant });
      pg.loading = false; more.remove();
      if (!document.getElementById(PICK_ID)) return;
      if (!resp || !resp.ok) { pg.done = true; return; }
      renderRows(listEl, resp.items || [], true); // append modu → mevcut grid'e ekle
      pg.cursor = resp.cursor || ''; pg.done = !pg.cursor;
      if (!pg.done && listEl.scrollHeight <= listEl.clientHeight + 4) loadMore();
    }
    // On open: personalized "For You" feed (based on what you wear). Switches to search on filter/keyword.
    async function showRecommended() {
      pg = { cursor: '', variant: null, loading: false, done: true, baseReq: null }; // For You feed → sayfalama yok
      listEl.innerHTML = loadingHtml('Preparing your recommendations…');
      const resp = await sandboxRequest({ action: 'trackedSandboxRecommended' });
      if (!document.getElementById(PICK_ID)) return;
      const subEl = ov.querySelector('.tks-pk-sub');
      if (!resp || !resp.ok || !(resp.items && resp.items.length)) {
        if (subEl) subEl.textContent = 'No recommendations — search or pick a category';
        const diagStr = (resp && resp.diag) ? (' · diag: ' + JSON.stringify(resp.diag)) : '';
        const catsStr = (resp && resp.cats) ? (' · cats: ' + JSON.stringify(resp.cats)) : '';
        listEl.innerHTML = `<div class="tks-pk-empty">Couldn't load recommendations.<br><span style="opacity:.6;font-size:11px;word-break:break-word">${escapeHtml((resp && (resp.error || (resp.ok ? 'empty' : ''))) || 'no response')}${escapeHtml(catsStr)}${escapeHtml(diagStr)}</span><br>Search above or pick a category.</div>`;
        return;
      }
      if (subEl) subEl.textContent = resp.personalized ? 'For You — based on your style · try on without buying' : 'Popular items · try on without buying';
      renderRows(listEl, resp.items || []);
    }
    let t = null; input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(refresh, 350); });
    refresh();
    input.focus();
  }

  // ── Init + SPA ──
  function start() {
    injectStyles(); ensurePanel();
    // Eski observer'ı disconnect et → start() tekrar çağrılırsa observer BİRİKMESİN (perf sızıntısı).
    if (startObs) { try { startObs.disconnect(); } catch (_) {} }
    let t = null;
    startObs = new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = null; if (onEditorPage()) { ensureOverlay(); if (!document.getElementById(PANEL_ID)) ensurePanel(); } }, 300); });
    startObs.observe(document.body, { childList: true, subtree: true });
    startAvatarSync();
  }
  // CANLI SENKRON: native editörde item ekle/çıkar yapınca taban avatar değişir → try-on render'ı
  // güncelle. Ucuz parmak-izi (giyili ID'ler) ile kontrol; sadece try-on aktifken (panel açık + item var).
  function startAvatarSync() {
    if (avatarSyncTimer) return;
    avatarSyncTimer = setInterval(async () => {
      if (!panelEl || collapsed || !overlayEl || !session.length) return;
      const resp = await sandboxRequest({ action: 'trackedSandboxAvatarState' });
      if (!resp || !resp.ok) return;
      if (lastAvatarFp === null) { lastAvatarFp = resp.fp; return; } // ilk snapshot
      if (resp.fp !== lastAvatarFp) {
        lastAvatarFp = resp.fp;
        comboCache.clear();          // taban avatar değişti → eski render'lar geçersiz
        runRender(currentMode);      // güncel avatar + try-on item'larla yeniden çiz
      }
    }, 5000);
  }
  function stopAvatarSync() { if (avatarSyncTimer) { clearInterval(avatarSyncTimer); avatarSyncTimer = null; } lastAvatarFp = null; }
  // Editör sayfasından AYRILINCA temizlik: 3D viewer (RAF loop + WebGL context),
  // observer'lar ve enjekte DOM bırakılır → leak/CPU-GPU israfı önlenir.
  function stop() {
    stopAvatarSync();
    if (startObs) { try { startObs.disconnect(); } catch (_) {} startObs = null; }
    if (resizeObs) { try { resizeObs.disconnect(); } catch (_) {} resizeObs = null; }
    if (viewer) { try { viewer.dispose(); } catch (_) {} viewer = null; }
    document.getElementById(OVERLAY_ID)?.remove(); overlayEl = null;
    document.getElementById(PANEL_ID)?.remove(); panelEl = null;
  }
  async function init() {
    await loadSession();
    let lastPath = location.pathname;
    if (onEditorPage()) start();
    // SPA nav izleme — HER durumda kur (direkt editör yüklemesinde de ayrılış yakalansın).
    setInterval(() => {
      if (location.pathname === lastPath) return;
      lastPath = location.pathname;
      if (onEditorPage()) start();
      else stop();
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
