if (window._trackedThemesSetup) {} else {
(function() {
'use strict';
window._trackedThemesSetup = true;

const STORAGE_KEY  = 'tracked_wallpaper';
const THEME_KEY    = 'tracked_color_theme';
const ADJ_KEY      = 'tracked_theme_adj';
const OVERRIDES_KEY= 'tracked_page_overrides';
const ACCENT_KEY   = 'tracked_custom_accent';
const LAYER_ID     = 'tracked-wallpaper-layer';
const THEME_CSS_ID = 'tracked-theme-css';
const SIDEBAR_ID   = 'tracked-themes-nav-item';
const OVERLAY_ID   = 'tracked-themes-overlay';
const STYLE_ID     = 'tracked-themes-styles';
const AVATAR_CTRL_ID = 'tracked-avatar-ctrl';
const PANEL_COLOR_KEY   = 'tracked_panel_color';
const PANEL_OPACITY_KEY = 'tracked_panel_opacity';
const PANEL_BLUR_KEY    = 'tracked_panel_blur';
const HEADER_OPACITY_KEY  = 'tracked_header_opacity';
const DEFAULT_HEADER_OPACITY = 0;
const PANEL_WIDTH_KEY     = 'tracked_content_panel_width';
const DEFAULT_PANEL_WIDTH = 100;  // v1.9.0: ayar kaldırıldı, default %100 — UI kayma bug'ları önlenir
const CARD_FRAME_KEY      = 'tracked_card_frame';
const DEFAULT_CARD_FRAME  = true;

// ── Gelişmiş kart ayarları (Advanced) — default KAPALI ──
const CARD_ADV_KEY        = 'tracked_card_adv';        // master aç/kapa
const CARD_COLOR_KEY      = 'tracked_card_color';      // karta özel renk
const CARD_OPACITY_KEY    = 'tracked_card_opacity';    // karta özel opaklık (alpha)
const CARD_BLUR_KEY       = 'tracked_card_blur';       // karta özel cam/blur px
const DEFAULT_CARD_ADV     = false;
const DEFAULT_CARD_COLOR   = '#1a1b22';
const DEFAULT_CARD_OPACITY = 0.7;
const DEFAULT_CARD_BLUR    = 0;
// ── Arama kutusu rengi (özelleştirilebilir) — default KAPALI = Roblox varsayılanı korunur ──
const SEARCH_CUSTOM_KEY    = 'tracked_search_custom';   // master aç/kapa (kapalı = Roblox default)
const SEARCH_COLOR_KEY     = 'tracked_search_color';
const SEARCH_OPACITY_KEY   = 'tracked_search_opacity';
const DEFAULT_SEARCH_CUSTOM  = false;
const DEFAULT_SEARCH_COLOR   = '#1a1b22';
const DEFAULT_SEARCH_OPACITY = 0.85;
// ── Yazı rengi + yazı tipi (Gelişmiş) — default Varsayılan (dokunma) ──
const TEXT_COLOR_KEY = 'tracked_text_color';
const TEXT_FONT_KEY  = 'tracked_text_font';
const DEFAULT_TEXT_COLOR = '';   // '' = tema/Roblox varsayılan rengi (dokunma)
const DEFAULT_TEXT_FONT  = '';   // '' = varsayılan font
const TEXT_FONTS = {
  '':           { label: 'Varsayılan (Roblox)', stack: '' },
  'system':     { label: 'Sistem',          stack: 'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' },
  'rounded':    { label: 'Yuvarlak',        stack: 'ui-rounded,"SF Pro Rounded","Segoe UI",system-ui,sans-serif' },
  'serif':      { label: 'Serif',           stack: 'Georgia,"Times New Roman",Times,serif' },
  'slab':       { label: 'Slab Serif',      stack: '"Rockwell","Roboto Slab","Bookman Old Style",Georgia,serif' },
  'mono':       { label: 'Monospace',       stack: 'ui-monospace,"SF Mono",Menlo,Consolas,"Courier New",monospace' },
  'verdana':    { label: 'Verdana',         stack: 'Verdana,Geneva,Tahoma,sans-serif' },
  'tahoma':     { label: 'Tahoma',          stack: 'Tahoma,Verdana,Geneva,sans-serif' },
  'trebuchet':  { label: 'Trebuchet',       stack: '"Trebuchet MS","Lucida Grande",Tahoma,sans-serif' },
  'condensed':  { label: 'Dar (Condensed)', stack: '"Bahnschrift","Arial Narrow","Roboto Condensed","Segoe UI",sans-serif' },
  'impact':     { label: 'Impact',          stack: 'Impact,Haettenschweiler,"Franklin Gothic Bold","Arial Narrow",sans-serif' },
  'comic':      { label: 'Komik',           stack: '"Comic Sans MS","Comic Sans","Chalkboard SE",cursive' },
  'handwriting':{ label: 'El Yazısı',       stack: '"Segoe Script","Bradley Hand","Brush Script MT",cursive' },
};
const TEXT_COLOR_SWATCHES = [
  { hex: '',        label: 'Varsayılan' },
  { hex: '#ffffff', label: 'Beyaz' },
  { hex: '#f5d76e', label: 'Altın' },
  { hex: '#7fd1ff', label: 'Mavi' },
  { hex: '#9be59b', label: 'Yeşil' },
  { hex: '#ff9d9d', label: 'Kırmızı' },
  { hex: '#e0c3ff', label: 'Mor' },
];
// Metin kontrastı (tüm dokunulan alanlardaki yazıların okunurluğunu artırır) — default KAPALI
const TEXT_CONTRAST_KEY     = 'tracked_text_contrast';
const DEFAULT_TEXT_CONTRAST = false;

// ── Tracked teması ana aç/kapa (Default = Roblox varsayılanı) — default AÇIK ──
// false olunca tüm Tracked efektleri kaldırılır, saf Roblox teması gelir.
const THEME_ENABLED_KEY     = 'tracked_theme_enabled';
const DEFAULT_THEME_ENABLED = true;

const DEFAULT_PANEL_COLOR   = '#1a1b22';
const DEFAULT_PANEL_OPACITY = 0.85;
const DEFAULT_PANEL_BLUR    = 0;

const PANEL_SWATCHES = [
  { hex: '#1a1b22', label: 'Midnight (varsayılan)' },
  { hex: '#0a0a0a', label: 'Tam Siyah' },
  { hex: '#1e1208', label: 'Kahve' },
  { hex: '#0e1a10', label: 'Orman' },
  { hex: '#0d1220', label: 'Okyanus' },
  { hex: '#1a0f1e', label: 'Mor' },
  { hex: '#1e1010', label: 'Bordo' },
];
const IDB_NAME     = 'tracked-wp-db';
const IDB_STORE    = 'wallpaper';
const LS_THEME     = 'tk_theme';
const LS_ADJ       = 'tk_adj';
const LS_ACCENT    = 'tk_custom_accent';
const MAX_BYTES    = 50 * 1024 * 1024;
const NAV_PATHS    = ['/home','/profile','/friends','/avatar','/inventory','/trade','/messages'];

const ROBLOX_SELECTORS = {
  // Topbar: Roblox sürümleri arası dayanıklılık için bilinen başlık seçicilerinin tümü.
  // (Çubuk opaklığı default 0 = şeffaf olduğu için fazladan eşleşme görsel risk taşımaz;
  //  yalnızca kullanıcı opaklığı yükselttiğinde renk uygulanır.)
  topbar:  '.rbx-header,#header,[class*="rbx-header"],.rbx-navbar,nav.rbx-navbar',
  sidebar: '.left-nav,[class*="bg-surface-0"]',
  navitem: '.left-nav [class*="bg-shift-100"]',
  card:    '.game-card-thumb-container,[class*="thumbnail-2d-container"]',
};

const PRESETS = {
  default:  { label:'Default',  mood:'',           topbar:[230,15,9],  sidebar:[230,18,6],  accent:[220,70,58],  fg:[245,240,232] },
  midnight: { label:'Midnight', mood:'Cinematic',  topbar:[230,20,8],  sidebar:[230,25,5],  accent:[220,75,58],  fg:[245,240,232] },
  cream:    { label:'Cream',    mood:'Editorial',  topbar:[38,15,10],  sidebar:[38,18,7],   accent:[38,60,55],   fg:[247,242,233] },
  ember:    { label:'Ember',    mood:'Smoldering', topbar:[18,25,8],   sidebar:[18,30,5],   accent:[22,80,55],   fg:[246,237,224] },
  slate:    { label:'Slate',    mood:'Nordic',     topbar:[210,12,10], sidebar:[210,14,7],  accent:[210,55,58],  fg:[238,242,246] },
  forest:   { label:'Forest',   mood:'Organic',    topbar:[148,20,8],  sidebar:[148,25,5],  accent:[148,55,45],  fg:[232,240,232] },
  plum:     { label:'Plum',     mood:'Mystic',     topbar:[278,22,9],  sidebar:[278,28,6],  accent:[278,65,58],  fg:[240,232,245] },
};

const THEME_MAP   = { emerald:'forest', crimson:'ember', violet:'plum', sunset:'ember', ocean:'slate' };
const VALID_PRESETS = Object.keys(PRESETS);

const VALID_ADJ_BOUNDS = { hue:[-180,180], sat:[-50,50], light:[-30,30], fgOpacity:[0.4,1.0] };
const VALID_NAV_PATHS  = NAV_PATHS;

// Sayfa Temaları kayıtlarını ayıkla — bozuk anahtarlar ("undefined" gibi) export/import'u kırmasın.
function sanitizeOverrides(ov) {
  const out = {};
  if (ov && typeof ov === 'object') {
    for (const [p, k] of Object.entries(ov)) {
      if (VALID_NAV_PATHS.includes(p) && VALID_PRESETS.includes(k)) out[p] = k;
    }
  }
  return out;
}

let _state = { theme:'midnight', adj:{}, customAccent:'', fgBase:null, pageOverrides:{}, panelColor: DEFAULT_PANEL_COLOR, panelOpacity: DEFAULT_PANEL_OPACITY, panelBlur: DEFAULT_PANEL_BLUR, headerOpacity: DEFAULT_HEADER_OPACITY, panelWidth: DEFAULT_PANEL_WIDTH, cardFrame: DEFAULT_CARD_FRAME, cardAdv: DEFAULT_CARD_ADV, cardColor: DEFAULT_CARD_COLOR, cardOpacity: DEFAULT_CARD_OPACITY, cardBlur: DEFAULT_CARD_BLUR, searchCustom: DEFAULT_SEARCH_CUSTOM, searchColor: DEFAULT_SEARCH_COLOR, searchOpacity: DEFAULT_SEARCH_OPACITY, textColor: DEFAULT_TEXT_COLOR, textFont: DEFAULT_TEXT_FONT, textContrast: DEFAULT_TEXT_CONTRAST, themeEnabled: DEFAULT_THEME_ENABLED };
let _wpObjectUrl = null;
// Tracked Plus durum önbelleği (senkron erişim için — onNavChange/storage handler async await yapamaz).
// Fail-closed: Plus doğrulanana kadar false → tema asla bypass'la uygulanmaz.
let _tkPlusCached = false;
let _wpMeta      = null;
let _cssReinjector = null;
let pendingFile  = null;
let _adjDebounce = null;
let _adjSaveDebounce = null;
let _panelDebounce = null;
let _panelSaveDebounce = null;

// ── HASH ROUTING ──────────────────────────────────────────────
// Roblox Next.js React Router /themes ve /free-items rotalarını tanımıyor → 404.
// pushState'le URL değişse de Roblox router'ı popstate dinlemiyor → re-route yok.
// Çözüm: pathname yerine HASH kullan. React Router hash'i HİÇ görmez → 404 imkansız.
// Browser back/forward, refresh, bookmark hash ile native çalışır.
const TK_HASH_THEMES = 'tk-themes';
const TK_HASH_FI     = 'tk-free-items';

function getActiveTkHash() {
  // v1.9.0: Roblox profil sayfası hash'imizin başına `#!` (hashbang) ekliyor
  // → URL `profile#!#tk-themes` oluyor. Tek `#` kabul edemeyiz; segment'e bakmalı.
  // Hash'i `#`, `!`, `&` karakterleriyle parçala, hangisi bizim hash'imizle eşleşirse al.
  const segments = (location.hash || '').split(/[#!&]/).filter(Boolean);
  for (const seg of segments) {
    if (seg === TK_HASH_THEMES) return TK_HASH_THEMES;
    if (seg === TK_HASH_FI)     return TK_HASH_FI;
  }
  return null;
}

// Hash'i set et — first entry için push (back tuşu paneli kapatır),
// panel değiştiriyorsak (themes ↔ free-items) replace (history kirletme, katman oluşturma).
function setTkHash(hash) {
  const newUrl = location.pathname + location.search + (hash ? '#' + hash : '');
  const currentTk = getActiveTkHash();
  try {
    if (currentTk) {
      // Zaten bir TK panelindeydik → REPLACE (geri tuşu hâlâ underlying page'e döner)
      history.replaceState({ _tk: hash }, '', newUrl);
    } else {
      // İlk giriş → PUSH (geri tuşu önceki sayfaya dönsün)
      history.pushState({ _tk: hash }, '', newUrl);
    }
  } catch(_) {}
}

// Hash'i temizle. v1.9.0: profil sayfası gibi yerlerde Roblox `#!` ekliyor,
// sadece BİZİM hash'imizi temizle, Roblox'unkini koru.
function clearTkHash() {
  if (!location.hash) return;
  // Mevcut hash'ten BİZİM key'imizi çıkar, geri kalan Roblox parçaları koru
  const oldHash = location.hash;
  let cleaned = oldHash
    .replace(new RegExp(`#?${TK_HASH_THEMES}\\b`, 'g'), '')
    .replace(new RegExp(`#?${TK_HASH_FI}\\b`, 'g'), '')
    .replace(/^#+!?#*/, '#!')  // Roblox `#!` prefix'i koru
    .replace(/^#$|^#!$/, '');   // tamamen boşaldıysa sil

  const hasOurState = history.state && history.state._tk;
  const newUrl = location.pathname + location.search + cleaned;
  if (hasOurState) {
    try { history.back(); } catch(_) {
      try { history.replaceState(null, '', newUrl); } catch(__) {}
    }
  } else {
    try { history.replaceState(null, '', newUrl); } catch(_) {}
  }
}

// ─────────────────────────────────────────────────────────────
// PanelManager — tek otoritatif state machine.
// Tüm açma/kapama/geçişler buradan geçer. Race condition yok, mutual exclusion otomatik.
//
// Public API:
//   PanelManager.request('themes' | 'free-items' | null) → Promise
//   PanelManager.toggle('themes' | 'free-items')          → Promise
//   PanelManager.syncFromUrl()                            → Promise (URL → state sync)
//
// Internal contract:
//   - Aynı anda sadece BİR transition çalışır (pending Promise ile lock)
//   - Eski state'ten yeni state'e: önce eski paneli kapat (anim ile), sonra yeni paneli aç
//   - URL hash'i her transition sonunda senkronize edilir
//   - openThemesPage / openFreeItemsPanel _fromManager flag'i ile çağrıldığında URL'e dokunmaz
// ─────────────────────────────────────────────────────────────
const PanelManager = {
  current: null,    // null | 'themes' | 'free-items'
  pending: null,    // in-flight transition Promise (lock)

  _hashFor(name) {
    return name === 'themes' ? TK_HASH_THEMES
         : name === 'free-items' ? TK_HASH_FI
         : null;
  },
  _nameFromHash(h) {
    return h === TK_HASH_THEMES ? 'themes'
         : h === TK_HASH_FI ? 'free-items'
         : null;
  },

  async request(desired) {
    // Aynı state'e geçiş istek geliyorsa no-op
    if (this.current === desired && !this.pending) return;

    // In-flight transition varsa: tamamlanmasını bekle, sonra tekrar dene
    // (en son istek kazanır — kullanıcı hızlı tıklamada doğru final state'e ulaşır)
    if (this.pending) {
      this._nextDesired = desired;
      return this.pending.then(() => {
        if (this._nextDesired === desired) {
          this._nextDesired = null;
          return this.request(desired);
        }
      });
    }

    this.pending = (async () => {
      try {
        // 1) Mevcut paneli kapat (varsa) — animation tamamlanana kadar bekle
        if (this.current === 'themes') {
          await this._closeThemes();
        } else if (this.current === 'free-items') {
          await this._closeFreeItems();
        }

        // v1.9.0: html.tk-panel-active class'ı paneli RENDER ETMEDEN ÖNCE ekle.
        // Böylece overflow-y:scroll CSS aktifleşir, getScrollbarWidth() doğru ölçer.
        document.documentElement.classList.toggle('tk-panel-active', desired !== null);

        // 2) Yeni paneli aç
        if (desired === 'themes') {
          await openThemesPage({ _fromManager: true });
        } else if (desired === 'free-items') {
          await openFreeItemsPanel({ _fromManager: true });
        }

        // 3) State + URL sync (tk-panel-active class yukarıda zaten set edildi)
        this.current = desired;
        this._syncUrlToState();
      } finally {
        this.pending = null;
      }
    })();

    return this.pending;
  },

  toggle(name) {
    return this.request(this.current === name ? null : name);
  },

  // URL'den hash oku, gerekirse state'i değiştir (popstate, hashchange, polling buraya çağırır)
  syncFromUrl() {
    const desired = this._nameFromHash(getActiveTkHash());
    if (desired !== this.current) {
      return this.request(desired);
    }
  },

  // State → URL (transition sonunda otomatik çağrılır)
  _syncUrlToState() {
    const desiredHash = this._hashFor(this.current);
    const currentHash = getActiveTkHash();
    if (desiredHash === currentHash) return;
    if (desiredHash) {
      setTkHash(desiredHash);
    } else {
      clearTkHash();
    }
  },

  // Themes overlay kapat (animation + Promise)
  _closeThemes() {
    return new Promise(resolve => {
      const ov = document.getElementById(OVERLAY_ID);
      if (!ov) return resolve();
      if (ov._closing) {
        setTimeout(resolve, 230);
        return;
      }
      ov._closing = true;
      try { if (ov._removeLayoutResize) ov._removeLayoutResize(); } catch(_) {}
      try { if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl); } catch(_) {}
      pendingFile = null;
      document.documentElement.style.overflow = '';
      ov.classList.add('tto-closing');
      setTimeout(() => {
        ov.remove();
        // Tema KAPALI (Default) iken panel açmak için enjekte ettiğimiz STYLE_ID'yi geri soy
        // → kapanınca sayfa tekrar saf Roblox olur.
        if (!_state.themeEnabled) disableAllTheming();
        resolve();
      }, 220);
    });
  },

  // Free Items panel kapat (animation + Promise)
  _closeFreeItems() {
    return new Promise(resolve => {
      const panel = document.getElementById(FI_PANEL_ID);
      if (!panel) return resolve();
      if (panel._closing) {
        setTimeout(resolve, 230);
        return;
      }
      panel._closing = true;
      try { if (panel._escHandler) document.removeEventListener('keydown', panel._escHandler); } catch(_) {}
      try { if (panel._removeLayoutResize) panel._removeLayoutResize(); } catch(_) {}
      document.documentElement.style.overflow = '';
      panel.classList.add('tfi-closing');
      setTimeout(() => {
        panel.remove();
        // Tema KAPALI (Default) iken panel açmak için enjekte ettiğimiz STYLE_ID'yi geri soy
        // → kapanınca sayfa tekrar saf Roblox olur.
        if (!_state.themeEnabled) disableAllTheming();
        resolve();
      }, 220);
    });
  },
};

// ── IndexedDB ─────────────────────────────────────────────────
function openWpDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE, { keyPath:'id' });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function readWp() {
  const db = await openWpDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).get('main');
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror   = e => reject(e.target.error);
  });
}

async function writeWp(blob, type, mimeType) {
  const b = blob instanceof Blob ? blob : new Blob([blob], { type: mimeType });
  const db = await openWpDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE,'readwrite').objectStore(IDB_STORE).put({ id:'main', blob:b, type, mimeType });
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

async function deleteWp() {
  const db = await openWpDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE,'readwrite').objectStore(IDB_STORE).delete('main');
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

// ── Storage helpers ───────────────────────────────────────────
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
function storeRemove(keys) {
  return new Promise(resolve => {
    try { chrome.storage.local.remove(keys, () => resolve()); }
    catch { resolve(); }
  });
}

// ── Color engine ──────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hslAdj(base, d) {
  return [
    ((base[0] + (d.hue || 0)) % 360 + 360) % 360,
    clamp(base[1] + (d.sat || 0), 0, 100),
    clamp(base[2] + (d.light || 0), 0, 100),
  ];
}

function hexToHSL(hex) {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b), l = (mx+mn)/2, d = mx-mn;
  if (d === 0) return [0, 0, l*100];
  const s = d / (1 - Math.abs(2*l - 1));
  let h = 0;
  if (mx === r) h = ((g-b)/d + 6) % 6;
  else if (mx === g) h = (b-r)/d + 2;
  else h = (r-g)/d + 4;
  return [h*60, s*100, l*100];
}

function computeThemeVars(presetKey, adj = {}, customAccent = '', fgBase = null) {
  const p  = PRESETS[presetKey] || PRESETS.midnight;
  const tb = hslAdj(p.topbar, adj);
  const sb = hslAdj(p.sidebar, adj);
  const ac = (customAccent && /^#[0-9a-f]{6}$/i.test(customAccent))
    ? hexToHSL(customAccent)
    : hslAdj(p.accent, adj);
  // (—tk-fg / fgOpacity KALDIRILDI: hiçbir CSS kuralı tüketmiyordu — ölü "Metin opaklığı" ayarı temizlendi)
  const f = v => v.toFixed(1);
  const tbRGB = hslToRGB(tb[0], tb[1], tb[2]);
  const sbRGB = hslToRGB(sb[0], sb[1], sb[2]);
  return {
    '--tk-topbar':      `hsl(${f(tb[0])},${f(tb[1])}%,${f(tb[2])}%)`,
    '--tk-sidebar':     `hsl(${f(sb[0])},${f(sb[1])}%,${f(sb[2])}%)`,
    '--tk-topbar-rgb':  `${tbRGB[0]},${tbRGB[1]},${tbRGB[2]}`,
    '--tk-sidebar-rgb': `${sbRGB[0]},${sbRGB[1]},${sbRGB[2]}`,
    '--tk-card':    `hsla(${f(ac[0])},${f(ac[1])}%,${f(ac[2])}%,0.12)`,
    '--tk-navitem': `hsla(${f(ac[0])},${f(ac[1])}%,${f(ac[2])}%,0.05)`,
    '--tk-accent':  `hsla(${f(ac[0])},${f(ac[1])}%,${f(ac[2])}%,0.10)`,
  };
}

function buildThemeCSS(vars) {
  const root = Object.entries(vars).map(([k,v]) => `${k}:${v}`).join(';');
  return `:root{${root}}` +
    `${ROBLOX_SELECTORS.topbar}{background-color:rgba(var(--tk-topbar-rgb),var(--tk-header-opacity,0))!important;transition:background-color .2s!important}` +
    `${ROBLOX_SELECTORS.sidebar}{background-color:rgba(var(--tk-sidebar-rgb),var(--tk-header-opacity,0))!important;transition:background-color .2s!important}` +
    `${ROBLOX_SELECTORS.navitem}{background-color:var(--tk-navitem)!important}` +
    `${ROBLOX_SELECTORS.card}{background-color:var(--tk-card)!important}`;
}

function applyColorTheme(presetKey, adj, customAccent, fgBase, skipTransition) {
  const key  = VALID_PRESETS.includes(presetKey) ? presetKey : 'midnight';
  const vars = computeThemeVars(key, adj || {}, customAccent || '', fgBase);
  const css  = buildThemeCSS(vars);

  const doApply = () => {
    let el = document.getElementById(THEME_CSS_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = THEME_CSS_ID;
      document.head.appendChild(el);
    } else {
      document.head.appendChild(el);
    }
    el.textContent = css;
  };

  if (!skipTransition && document.startViewTransition) {
    document.startViewTransition(doApply);
  } else {
    doApply();
  }

  try {
    localStorage.setItem(LS_THEME, key);
    localStorage.setItem(LS_ADJ, JSON.stringify(adj || {}));
    if (customAccent) localStorage.setItem(LS_ACCENT, customAccent);
    else localStorage.removeItem(LS_ACCENT);
  } catch(_) {}
}

// Vurgu rengini SÜRÜKLERKEN ucuz canlı önizleme: tüm CSS'i yeniden enjekte etmek (applyColorTheme →
// el.textContent = css → CSS re-parse + head taşıma + localStorage) yerine SADECE :root değişkenlerini
// günceller (inline). Bırakınca (change) tam applyColorTheme çağrılır. clearLiveThemeVars inline
// önizleme değişkenlerini temizler → sonradan preset değişince stylesheet devralsın, eski inline takılmasın.
function applyAccentVarsLive(presetKey, adj, customAccent, fgBase) {
  const key = VALID_PRESETS.includes(presetKey) ? presetKey : 'midnight';
  const vars = computeThemeVars(key, adj || {}, customAccent || '', fgBase);
  const root = document.documentElement;
  for (const k in vars) root.style.setProperty(k, vars[k]);
}
function clearLiveThemeVars() {
  const root = document.documentElement;
  ['--tk-topbar','--tk-sidebar','--tk-topbar-rgb','--tk-sidebar-rgb','--tk-card','--tk-navitem','--tk-accent']
    .forEach(v => root.style.removeProperty(v));
}

function hexToRGB(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

function hslToRGB(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
  return [f(0), f(8), f(4)];
}

function applyPanelVars(color, opacity, blur, width) {
  const root = document.documentElement;
  root.style.setProperty('--tk-panel-rgb',    hexToRGB(color || DEFAULT_PANEL_COLOR));
  root.style.setProperty('--tk-panel-opacity', opacity ?? DEFAULT_PANEL_OPACITY);
  root.style.setProperty('--tk-panel-blur',   `${blur ?? DEFAULT_PANEL_BLUR}px`);
  // (--tk-panel-width kaldırıldı: genişlik ayarı v1.9.0'da çıkarıldı, hiçbir CSS kuralı kullanmıyordu)
  // tke-glass class'ı sadece blur > 0 ise eklenir.
  // Blur=0'da backdrop-filter eklemek bile yeni stacking context yaratır → SPA layout bozulur.
  const b = Number(blur ?? DEFAULT_PANEL_BLUR);
  root.classList.toggle('tke-glass', isFinite(b) && b > 0);
}

function applyHeaderOpacity(opacity) {
  document.documentElement.style.setProperty('--tk-header-opacity', opacity ?? DEFAULT_HEADER_OPACITY);
}

function applyCardFrame(on) {
  document.documentElement.classList.toggle('tke-frame', !!on);
}

// Gelişmiş kart modu: aktifse karta özel renk/opaklık/blur değişkenlerini yazar
// + html.tke-card-adv class'ını ekler (CSS bu class ile kart selektörlerini override eder).
// Kapalıyken değişkenler temizlenir → kartlar panel değişkenlerine geri döner (mevcut davranış).
function applyCardAdvanced(on, color, opacity, blur) {
  const root = document.documentElement;
  const enabled = !!on;
  root.classList.toggle('tke-card-adv', enabled);
  if (enabled) {
    root.style.setProperty('--tk-card-rgb',     hexToRGB(color || DEFAULT_CARD_COLOR));
    root.style.setProperty('--tk-card-opacity', opacity ?? DEFAULT_CARD_OPACITY);
    root.style.setProperty('--tk-card-blur',    `${blur ?? DEFAULT_CARD_BLUR}px`);
  } else {
    root.style.removeProperty('--tk-card-rgb');
    root.style.removeProperty('--tk-card-opacity');
    root.style.removeProperty('--tk-card-blur');
  }
}

// Arama kutusu rengi: aktifse #navbar-search-input'a özel renk/opaklık verir + html.tke-search-custom
// class'ı (CSS bu class ile uygular). Kapalı/geçersiz renkte → Roblox varsayılan görünümü korunur.
function applySearchColor(on, color, opacity) {
  const root = document.documentElement;
  const enabled = !!on && /^#[0-9a-f]{6}$/i.test(color || '');
  root.classList.toggle('tke-search-custom', enabled);
  if (enabled) {
    root.style.setProperty('--tk-search-rgb', hexToRGB(color));
    root.style.setProperty('--tk-search-opacity', opacity ?? DEFAULT_SEARCH_OPACITY);
  } else {
    root.style.removeProperty('--tk-search-rgb');
    root.style.removeProperty('--tk-search-opacity');
  }
}

// Metin kontrastı: html.tke-text-contrast class'ı → CSS dokunulan alanlardaki
// metinlere gölge + soluk metinlere parlaklık ekler (renkleri bozmadan okunurluk).
function applyTextContrast(on) {
  document.documentElement.classList.toggle('tke-text-contrast', !!on);
}

// Renk seçicide sürüklerken `input` saniyede onlarca kez tetiklenir → her seferinde uygula+kaydet
// KASMA yapar (özellikle vurgu rengi tüm CSS'i yeniden enjekte eder). Throttle: en fazla her `ms`'de
// bir uygular + son değeri de garanti uygular (trailing).
function tkThrottle(fn, ms) {
  let last = 0, timer = null, lastArg;
  return (arg) => {
    lastArg = arg;
    const now = Date.now(), wait = ms - (now - last);
    if (wait <= 0) { last = now; fn(arg); }
    else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn(lastArg); }, wait); }
  };
}

// Yazı rengi: geçerli hex → içerik metnini o renge boyar + html.tke-text-color. '' = dokunma (varsayılan).
function applyTextColor(color) {
  const root = document.documentElement;
  const valid = /^#[0-9a-f]{6}$/i.test(color || '');
  root.classList.toggle('tke-text-color', valid);
  if (valid) root.style.setProperty('--tk-text-color', color);
  else root.style.removeProperty('--tk-text-color');
}
// Yazı tipi: seçili font → içerik metninin fontunu değiştirir (ikon font'ları HARİÇ) + html.tke-text-font.
function applyTextFont(fontKey) {
  const root = document.documentElement;
  const f = TEXT_FONTS[fontKey];
  const on = !!(f && f.stack);
  root.classList.toggle('tke-text-font', on);
  if (on) root.style.setProperty('--tk-text-font', f.stack);
  else root.style.removeProperty('--tk-text-font');
}

// ── TRACKED TEMASINI TAMAMEN KAPAT (Default = Roblox varsayılanı) ──
// Tüm Tracked tema efektlerini söker: enjekte CSS'ler (statik blok + tema renk + erken
// kritik tema), wallpaper layer, html tke-* class'ları, inline --tk-*/--twp- değişkenleri.
// localStorage('tk_theme_off') flag'i → themes_critical.js bir sonraki tam yüklemede de atlar
// (FOUC engellenir, reload'da da saf Roblox).
function disableAllTheming(opts) {
  // keepPanelStyles: açık bir panel (themes/FI) varken çağrılırsa STYLE_ID'yi (panel UI CSS'i
  // de içeriyor) SİLME → panel stilsiz kalmasın. Panel kapanınca _close* tam soyma yapar.
  const keepPanelStyles = !!(opts && opts.keepPanelStyles);
  try { localStorage.setItem('tk_theme_off', '1'); } catch(_) {}
  // Reinjector'ı durdur (yoksa tema renk CSS'ini geri ekler)
  if (_cssReinjector) { try { _cssReinjector.disconnect(); } catch(_) {} _cssReinjector = null; }
  document.getElementById('tracked-critical-theme')?.remove();
  if (!keepPanelStyles) document.getElementById(STYLE_ID)?.remove();
  document.getElementById(THEME_CSS_ID)?.remove();
  document.getElementById(LAYER_ID)?.remove();
  if (_wpObjectUrl) { try { URL.revokeObjectURL(_wpObjectUrl); } catch(_) {} _wpObjectUrl = null; }
  const root = document.documentElement;
  root.classList.remove('tke-glass', 'tke-frame', 'tke-card-adv', 'tke-search-custom', 'tke-text-color', 'tke-text-font', 'tke-text-contrast');
  // tke-off: Default modda STYLE_ID panel için geçici enjekte olsa bile body'yi şeffaflaştıran
  // kural (ve diğer tke-off-duyarlı kurallar) devre dışı kalsın → üst navbar Roblox opak kalır.
  root.classList.add('tke-off');
  ['--tk-panel-rgb','--tk-panel-opacity','--tk-panel-blur','--tk-header-opacity',
   '--tk-card-rgb','--tk-card-opacity','--tk-card-blur',
   '--tk-search-rgb','--tk-search-opacity',
   '--tk-text-color','--tk-text-font'].forEach(v => root.style.removeProperty(v));
  document.body?.classList.remove('tk-communities-page');
}

// ── TRACKED TEMASINI YENİDEN ETKİNLEŞTİR ──
// Kayıtlı _state ayarlarıyla tüm efektleri tekrar uygular (Default'tan geri dönüş).
function enableAllTheming() {
  try { localStorage.removeItem('tk_theme_off'); } catch(_) {}
  document.documentElement.classList.remove('tke-off');
  injectStyles();
  applyColorTheme(_state.theme, _state.adj, _state.customAccent, _state.fgBase, true);
  applyPanelVars(_state.panelColor, _state.panelOpacity, _state.panelBlur, _state.panelWidth);
  applyHeaderOpacity(_state.headerOpacity);
  applyCardFrame(_state.cardFrame);
  applyCardAdvanced(_state.cardAdv, _state.cardColor, _state.cardOpacity, _state.cardBlur);
  applySearchColor(_state.searchCustom, _state.searchColor, _state.searchOpacity);
  applyTextColor(_state.textColor);
  applyTextFont(_state.textFont);
  applyTextContrast(_state.textContrast);
  applyWallpaper();
  startCSSReinjector();
  document.body?.classList.toggle('tk-communities-page', /^\/communities(\/|$)/.test(location.pathname));
  setTimeout(fixCardTextBorders, 100);
}


// ── State loader ──────────────────────────────────────────────
async function loadState() {
  const d = await storeGet([THEME_KEY, ADJ_KEY, OVERRIDES_KEY, ACCENT_KEY, PANEL_COLOR_KEY, PANEL_OPACITY_KEY, PANEL_BLUR_KEY, HEADER_OPACITY_KEY, PANEL_WIDTH_KEY, CARD_FRAME_KEY, CARD_ADV_KEY, CARD_COLOR_KEY, CARD_OPACITY_KEY, CARD_BLUR_KEY, SEARCH_CUSTOM_KEY, SEARCH_COLOR_KEY, SEARCH_OPACITY_KEY, TEXT_COLOR_KEY, TEXT_FONT_KEY, TEXT_CONTRAST_KEY, THEME_ENABLED_KEY]);
  _state.theme         = VALID_PRESETS.includes(d[THEME_KEY]) ? d[THEME_KEY] : 'midnight';
  _state.adj           = d[ADJ_KEY]      || {};
  _state.pageOverrides = sanitizeOverrides(d[OVERRIDES_KEY]);   // storage'daki bozuk anahtarlar yüklemede ayıklanır
  _state.customAccent  = d[ACCENT_KEY]   || '';
  _state.panelColor    = (/^#[0-9a-f]{6}$/i.test(d[PANEL_COLOR_KEY] || '')) ? d[PANEL_COLOR_KEY] : DEFAULT_PANEL_COLOR;
  _state.panelOpacity  = d[PANEL_OPACITY_KEY]  != null ? clamp(Number(d[PANEL_OPACITY_KEY]),  0.1, 1.0) : DEFAULT_PANEL_OPACITY;
  _state.panelBlur     = d[PANEL_BLUR_KEY]     != null ? clamp(Number(d[PANEL_BLUR_KEY]),     0,   24)  : DEFAULT_PANEL_BLUR;
  _state.headerOpacity = d[HEADER_OPACITY_KEY] != null ? clamp(Number(d[HEADER_OPACITY_KEY]), 0,   1.0) : DEFAULT_HEADER_OPACITY;
  _state.panelWidth    = DEFAULT_PANEL_WIDTH;  // v1.9.0: ayar kaldırıldı, daima %100 (eski kayıtlar yoksayılır)
  _state.cardFrame     = d[CARD_FRAME_KEY]     != null ? !!d[CARD_FRAME_KEY]                             : DEFAULT_CARD_FRAME;
  _state.cardAdv       = d[CARD_ADV_KEY]        != null ? !!d[CARD_ADV_KEY]                               : DEFAULT_CARD_ADV;
  _state.cardColor     = (/^#[0-9a-f]{6}$/i.test(d[CARD_COLOR_KEY] || '')) ? d[CARD_COLOR_KEY] : DEFAULT_CARD_COLOR;
  _state.cardOpacity   = d[CARD_OPACITY_KEY]   != null ? clamp(Number(d[CARD_OPACITY_KEY]),   0.1, 1.0) : DEFAULT_CARD_OPACITY;
  _state.cardBlur      = d[CARD_BLUR_KEY]      != null ? clamp(Number(d[CARD_BLUR_KEY]),      0,   24)  : DEFAULT_CARD_BLUR;
  _state.searchCustom  = d[SEARCH_CUSTOM_KEY]   != null ? !!d[SEARCH_CUSTOM_KEY]                          : DEFAULT_SEARCH_CUSTOM;
  _state.searchColor   = (/^#[0-9a-f]{6}$/i.test(d[SEARCH_COLOR_KEY] || '')) ? d[SEARCH_COLOR_KEY] : DEFAULT_SEARCH_COLOR;
  _state.searchOpacity = d[SEARCH_OPACITY_KEY]  != null ? clamp(Number(d[SEARCH_OPACITY_KEY]), 0.1, 1.0) : DEFAULT_SEARCH_OPACITY;
  _state.textColor     = (/^#[0-9a-f]{6}$/i.test(d[TEXT_COLOR_KEY] || '')) ? d[TEXT_COLOR_KEY] : DEFAULT_TEXT_COLOR;
  _state.textFont      = (d[TEXT_FONT_KEY] != null && TEXT_FONTS[d[TEXT_FONT_KEY]]) ? d[TEXT_FONT_KEY] : DEFAULT_TEXT_FONT;
  _state.textContrast  = d[TEXT_CONTRAST_KEY]   != null ? !!d[TEXT_CONTRAST_KEY]                          : DEFAULT_TEXT_CONTRAST;
  _state.themeEnabled  = d[THEME_ENABLED_KEY]   != null ? !!d[THEME_ENABLED_KEY]                          : DEFAULT_THEME_ENABLED;
}

function resolveThemeForPath(pathname) {
  const ov = _state.pageOverrides[pathname];
  return (ov && VALID_PRESETS.includes(ov)) ? ov : _state.theme;
}

function fixCardTextBorders() {
  const sel = '.item-card-caption,.item-card-name,.item-card-name-link,.item-card-price,.game-card-info,.game-card-name,.game-card-price-container';
  document.querySelectorAll(sel).forEach(el => {
    el.style.setProperty('border', 'none', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('outline', 'none', 'important');
    el.style.setProperty('background-color', 'transparent', 'important');
  });
}

function onNavChange(rawUrl) {
  // Tema KAPALI (Roblox Varsayılanı/Default) → hiçbir tema/efekt uygulama. Aksi halde
  // panel hash değişimi (history.replaceState) bu fonksiyonu tetikleyip applyColorTheme ile
  // THEME_CSS_ID'yi GERİ enjekte ediyor → topbar rgba(...,0) ile şeffaflaşıp gri bant bırakıyordu.
  if (!_state.themeEnabled || !_tkPlusCached) return;
  let pathname;
  try { pathname = rawUrl ? new URL(rawUrl, location.origin).pathname : location.pathname; }
  catch { pathname = location.pathname; }
  const theme = resolveThemeForPath(pathname);
  applyColorTheme(theme, _state.adj, _state.customAccent, _state.fgBase, true);
  // v1.9.0: Communities sayfası için body'ye class ekle (CSS exclude için pathname-based, daha güvenilir)
  document.body?.classList.toggle('tk-communities-page', /^\/communities(\/|$)/.test(pathname));
  document.getElementById(AVATAR_CTRL_ID)?.remove();
  setTimeout(fixCardTextBorders, 600);
  if (isAvatarViewerPage(pathname)) {
    let av = 0;
    const tryAv = () => {
      injectAvatarControls();
      if (!document.getElementById(AVATAR_CTRL_ID) && av++ < 25) setTimeout(tryAv, 400);
    };
    setTimeout(tryAv, 300);
  }
}

// ── CSS reinjector (Roblox stylesheet hot-swap guard) ─────────
function startCSSReinjector() {
  if (_cssReinjector || !document.head) return;
  _cssReinjector = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.tagName === 'LINK' && node.rel === 'stylesheet') {
          const el = document.getElementById(THEME_CSS_ID);
          if (el) document.head.appendChild(el);
        }
      }
    }
  });
  _cssReinjector.observe(document.head, { childList: true });
}

// ── Wallpaper utilities ───────────────────────────────────────
async function hasQuota(sizeBytes) {
  if (!navigator.storage?.estimate) return true;
  try {
    const { quota, usage } = await navigator.storage.estimate();
    return (quota - usage) > sizeBytes * 1.2;
  } catch { return true; }
}

async function detectLuma(objectUrl) {
  // Phase 4 — returns [r,g,b] recommended fg or null
  return null;
}

async function getWallpaperMeta() {
  const d = await storeGet([STORAGE_KEY]);
  return d[STORAGE_KEY] || null;
}

async function applyWallpaper() {
  if (_wpObjectUrl) { URL.revokeObjectURL(_wpObjectUrl); _wpObjectUrl = null; }

  const [meta, rec] = await Promise.all([
    getWallpaperMeta(),
    readWp().catch(() => null),
  ]);

  const existing = document.getElementById(LAYER_ID);

  let displayUrl = null;
  if (meta?.dataUrl) {
    displayUrl = meta.dataUrl;
  } else if (rec?.blob) {
    _wpObjectUrl = URL.createObjectURL(rec.blob);
    displayUrl = _wpObjectUrl;
  }

  _wpMeta = meta;
  _state.fgBase = meta?.fgBase || null;

  if (!displayUrl) {
    existing?.remove();
    document.getElementById('tracked-content-bg')?.remove();
    return;
  }

  if (existing) {
    existing.style.setProperty('--twp-opacity', meta?.opacity ?? 1);
    existing.style.setProperty('--twp-blur', `${meta?.blur ?? 0}px`);
    existing.style.setProperty('--twp-dim', meta?.dimOpacity ?? 0.45);
    const m = existing.querySelector('.twp-media');
    if (m && m.src === displayUrl) {
      return;
    }
    existing.remove();
  }

  const wrap = document.createElement('div');
  wrap.id = LAYER_ID;
  wrap.style.setProperty('--twp-opacity', meta?.opacity ?? 1);
  wrap.style.setProperty('--twp-blur', `${meta?.blur ?? 0}px`);
  wrap.style.setProperty('--twp-dim', meta?.dimOpacity ?? 0.45);

  let media;
  const isVideo = (meta?.type || rec?.type) === 'video';
  if (isVideo) {
    media = document.createElement('video');
    media.autoplay = true; media.loop = true; media.muted = true; media.playsInline = true;
  } else {
    media = document.createElement('img');
    media.alt = '';
  }
  media.className = 'twp-media';
  media.src = displayUrl;

  const dim = document.createElement('div');
  dim.className = 'twp-dim';
  wrap.appendChild(media);
  wrap.appendChild(dim);
  document.body.prepend(wrap);
}

// ── Export / Import (engine, no UI yet) ──────────────────────
function exportTheme() {
  // TAM kapsam: tema + panel + çerçeve + gelişmiş kart + yazı (renk/font/kontrast) + arama kutusu.
  const obj = {
    theme: _state.theme, adj: _state.adj, overrides: sanitizeOverrides(_state.pageOverrides), customAccent: _state.customAccent,
    panelColor: _state.panelColor, panelOpacity: _state.panelOpacity, panelBlur: _state.panelBlur,
    headerOpacity: _state.headerOpacity, panelWidth: _state.panelWidth, cardFrame: _state.cardFrame,
    cardAdv: _state.cardAdv, cardColor: _state.cardColor, cardOpacity: _state.cardOpacity, cardBlur: _state.cardBlur,
    textColor: _state.textColor, textFont: _state.textFont, textContrast: _state.textContrast,
    searchCustom: _state.searchCustom, searchColor: _state.searchColor, searchOpacity: _state.searchOpacity,
  };
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
  catch { return ''; }
}

function validateImport(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('invalid');
  if (obj.theme && !VALID_PRESETS.includes(obj.theme)) throw new Error('bad_theme');
  if (obj.customAccent && !/^#[0-9a-f]{6}$/i.test(obj.customAccent)) throw new Error('bad_accent');
  if (obj.adj) {
    for (const [k, [lo, hi]] of Object.entries(VALID_ADJ_BOUNDS)) {
      if (obj.adj[k] == null) continue;
      const v = Number(obj.adj[k]);
      if (!isFinite(v) || v < lo || v > hi) throw new Error(`adj.${k}`);
    }
  }
  // Sayfa Temaları: bozuk/eski girişler tüm kodu REDDETTİRMESİN — sessizce ayıkla (geçerliler uygulanır).
  if (obj.overrides) obj.overrides = sanitizeOverrides(obj.overrides);
  if (obj.panelColor    !== undefined && !/^#[0-9a-f]{6}$/i.test(obj.panelColor)) throw new Error('bad_panelColor');
  if (obj.panelOpacity  !== undefined) { const v = Number(obj.panelOpacity);  if (!isFinite(v) || v < 0.1 || v > 1.0) throw new Error('bad_panelOpacity'); }
  if (obj.panelBlur     !== undefined) { const v = Number(obj.panelBlur);     if (!isFinite(v) || v < 0   || v > 24)  throw new Error('bad_panelBlur'); }
  if (obj.headerOpacity !== undefined) { const v = Number(obj.headerOpacity); if (!isFinite(v) || v < 0   || v > 1.0) throw new Error('bad_headerOpacity'); }
  // panelWidth v1.9.0'da kaldırıldı → yoksayılır; eski config'leri reddetmemek için doğrulanmaz.
  // Gelişmiş kart + yazı + arama kutusu (v1.9.3'te pakete eklendi)
  if (obj.cardColor     !== undefined && !/^#[0-9a-f]{6}$/i.test(obj.cardColor))   throw new Error('bad_cardColor');
  if (obj.cardOpacity   !== undefined) { const v = Number(obj.cardOpacity);   if (!isFinite(v) || v < 0.1 || v > 1.0) throw new Error('bad_cardOpacity'); }
  if (obj.cardBlur      !== undefined) { const v = Number(obj.cardBlur);      if (!isFinite(v) || v < 0   || v > 24)  throw new Error('bad_cardBlur'); }
  if (obj.textColor     !== undefined && obj.textColor !== '' && !/^#[0-9a-f]{6}$/i.test(obj.textColor)) throw new Error('bad_textColor');
  if (obj.textFont      !== undefined && obj.textFont  !== '' && !TEXT_FONTS[obj.textFont]) throw new Error('bad_textFont');
  if (obj.searchColor   !== undefined && !/^#[0-9a-f]{6}$/i.test(obj.searchColor)) throw new Error('bad_searchColor');
  if (obj.searchOpacity !== undefined) { const v = Number(obj.searchOpacity); if (!isFinite(v) || v < 0.1 || v > 1.0) throw new Error('bad_searchOpacity'); }
}

async function importTheme(str) {
  const obj = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
  validateImport(obj);
  const updates = {};
  if (obj.theme)        updates[THEME_KEY]    = obj.theme;
  if (obj.adj)          updates[ADJ_KEY]       = obj.adj;
  if (obj.overrides)    updates[OVERRIDES_KEY] = obj.overrides;
  if (obj.customAccent !== undefined) updates[ACCENT_KEY] = obj.customAccent || '';
  if (obj.panelColor    !== undefined) updates[PANEL_COLOR_KEY]    = obj.panelColor;
  if (obj.panelOpacity  !== undefined) updates[PANEL_OPACITY_KEY]  = Number(obj.panelOpacity);
  if (obj.panelBlur     !== undefined) updates[PANEL_BLUR_KEY]     = Number(obj.panelBlur);
  if (obj.headerOpacity !== undefined) updates[HEADER_OPACITY_KEY] = Number(obj.headerOpacity);
  updates[PANEL_WIDTH_KEY] = DEFAULT_PANEL_WIDTH;   // panelWidth daima %100 (ayar v1.9.0'da kaldırıldı)
  if (obj.cardFrame     !== undefined) updates[CARD_FRAME_KEY]     = !!obj.cardFrame;
  if (obj.cardAdv       !== undefined) updates[CARD_ADV_KEY]       = !!obj.cardAdv;
  if (obj.cardColor     !== undefined) updates[CARD_COLOR_KEY]     = obj.cardColor;
  if (obj.cardOpacity   !== undefined) updates[CARD_OPACITY_KEY]   = Number(obj.cardOpacity);
  if (obj.cardBlur      !== undefined) updates[CARD_BLUR_KEY]      = Number(obj.cardBlur);
  if (obj.textColor     !== undefined) updates[TEXT_COLOR_KEY]     = obj.textColor || '';
  if (obj.textFont      !== undefined) updates[TEXT_FONT_KEY]      = obj.textFont || '';
  if (obj.textContrast  !== undefined) updates[TEXT_CONTRAST_KEY]  = !!obj.textContrast;
  if (obj.searchCustom  !== undefined) updates[SEARCH_CUSTOM_KEY]  = !!obj.searchCustom;
  if (obj.searchColor   !== undefined) updates[SEARCH_COLOR_KEY]   = obj.searchColor;
  if (obj.searchOpacity !== undefined) updates[SEARCH_OPACITY_KEY] = Number(obj.searchOpacity);
  await storeSet(updates);
  if (obj.theme)        _state.theme         = obj.theme;
  if (obj.adj)          _state.adj           = obj.adj;
  if (obj.overrides)    _state.pageOverrides = obj.overrides;
  if (obj.customAccent  !== undefined) _state.customAccent  = obj.customAccent || '';
  if (obj.panelColor    !== undefined) _state.panelColor    = obj.panelColor;
  if (obj.panelOpacity  !== undefined) _state.panelOpacity  = Number(obj.panelOpacity);
  if (obj.panelBlur     !== undefined) _state.panelBlur     = Number(obj.panelBlur);
  if (obj.headerOpacity !== undefined) _state.headerOpacity = Number(obj.headerOpacity);
  _state.panelWidth = DEFAULT_PANEL_WIDTH;   // panelWidth ayarı v1.9.0'da kaldırıldı — import edilse bile %100 zorla (kayma bug'ı önlenir)
  if (obj.cardFrame     !== undefined) { _state.cardFrame = !!obj.cardFrame; applyCardFrame(_state.cardFrame); }
  // Gelişmiş kart + yazı + arama kutusu — state'e işle ve CANLI uygula
  if (obj.cardAdv       !== undefined) _state.cardAdv       = !!obj.cardAdv;
  if (obj.cardColor     !== undefined) _state.cardColor     = obj.cardColor;
  if (obj.cardOpacity   !== undefined) _state.cardOpacity   = Number(obj.cardOpacity);
  if (obj.cardBlur      !== undefined) _state.cardBlur      = Number(obj.cardBlur);
  if (obj.textColor     !== undefined) { _state.textColor   = obj.textColor || '';  applyTextColor(_state.textColor); }
  if (obj.textFont      !== undefined) { _state.textFont    = obj.textFont  || '';  applyTextFont(_state.textFont); }
  if (obj.textContrast  !== undefined) { _state.textContrast = !!obj.textContrast;  applyTextContrast(_state.textContrast); }
  if (obj.searchCustom !== undefined || obj.searchColor !== undefined || obj.searchOpacity !== undefined) {
    if (obj.searchCustom  !== undefined) _state.searchCustom  = !!obj.searchCustom;
    if (obj.searchColor   !== undefined) _state.searchColor   = obj.searchColor;
    if (obj.searchOpacity !== undefined) _state.searchOpacity = Number(obj.searchOpacity);
    applySearchColor(_state.searchCustom, _state.searchColor, _state.searchOpacity);
  }
  if (obj.cardAdv !== undefined || obj.cardColor !== undefined || obj.cardOpacity !== undefined || obj.cardBlur !== undefined) {
    applyCardAdvanced(_state.cardAdv, _state.cardColor, _state.cardOpacity, _state.cardBlur);
  }
  applyColorTheme(_state.theme, _state.adj, _state.customAccent, _state.fgBase, false);
  applyPanelVars(_state.panelColor, _state.panelOpacity, _state.panelBlur, _state.panelWidth);
  applyHeaderOpacity(_state.headerOpacity);
}

// ── Migration ─────────────────────────────────────────────────
async function migrateThemeKey() {
  const d   = await storeGet([THEME_KEY]);
  const old = d[THEME_KEY];
  if (!old || !THEME_MAP[old]) return;
  const next = THEME_MAP[old];
  await storeSet({ [THEME_KEY]: next });
  try { localStorage.setItem(LS_THEME, next); } catch(_) {}
}

async function migrateWallpaper() {
  const d = await storeGet(['wallpaperMigratedV2', STORAGE_KEY]);
  if (d.wallpaperMigratedV2) return;
  const wp = d[STORAGE_KEY];
  if (!wp?.dataUrl) { await storeSet({ wallpaperMigratedV2: true }); return; }

  try {
    const res  = await fetch(wp.dataUrl);
    const blob = await res.blob();
    await writeWp(blob, wp.type || 'image', blob.type || 'image/jpeg');

    const rb = await readWp();
    if (!rb?.blob || rb.blob.size !== blob.size) {
      console.error('[Tracked] Wallpaper migration read-back mismatch — chrome.storage preserved, will retry');
      return;
    }

    const { dataUrl: _, ...meta } = wp;
    await storeSet({ [STORAGE_KEY]: meta, wallpaperMigratedV2: true });
  } catch (e) {
    console.error('[Tracked] Wallpaper migration error:', e.message);
  }
}

// ── Injected styles ───────────────────────────────────────────
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
#tracked-wallpaper-layer{position:fixed!important;inset:0!important;z-index:-2!important;pointer-events:none!important;overflow:hidden!important;}
#tracked-wallpaper-layer .twp-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:var(--twp-opacity,1);filter:blur(var(--twp-blur,0px));transition:opacity .4s;}
#tracked-wallpaper-layer .twp-dim{position:absolute;inset:0;background:rgba(0,0,0,var(--twp-dim,.45));}
/* html.tke-off (Roblox Varsayılanı/Default modu) → bu kuralı UYGULAMA. Aksi halde Default'ta
   FI/Themes paneli açılınca STYLE_ID enjekte olup body'yi şeffaflaştırıyor; üst navbar bg'sini
   body'den aldığı için navbar da şeffaflaşıp gri bant bırakıyordu. tke-off ile navbar Roblox opak kalır. */
html:not(.tke-off),html:not(.tke-off) body{background-color:transparent!important;}

/* v1.9.0: Premium Tracked Scrollbar — Roblox sayfası global (warm gold gradient) */
/* Her zaman aktif (panel açık/kapalı fark etmez) */
html,body{scrollbar-width:thin!important;scrollbar-color:rgba(200,169,110,.5) rgba(0,0,0,.15)!important;}
::-webkit-scrollbar{width:10px!important;height:10px!important;}
::-webkit-scrollbar-track{background:rgba(0,0,0,.15)!important;border-radius:10px!important;}
::-webkit-scrollbar-thumb{background:linear-gradient(180deg,rgba(200,169,110,.5),rgba(160,125,85,.6))!important;background-clip:content-box!important;border:2px solid transparent!important;border-radius:10px!important;transition:background-color .2s ease!important;}
::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,rgba(200,169,110,.75),rgba(160,125,85,.85))!important;background-clip:content-box!important;}
::-webkit-scrollbar-thumb:active{background:linear-gradient(180deg,rgba(200,169,110,.95),rgba(160,125,85,1))!important;background-clip:content-box!important;}
::-webkit-scrollbar-corner{background:transparent!important;}
/* Panel açıkken: sayfa scroll kilitli + viewport tam genişlik (sağ bant olmasın) */
html.tk-panel-active{overflow:hidden!important;scrollbar-gutter:auto!important;width:100vw!important;max-width:100vw!important;padding-right:0!important;margin-right:0!important;}
html.tk-panel-active body{overflow:hidden!important;width:100vw!important;max-width:100vw!important;padding-right:0!important;margin-right:0!important;}
/* Sayfa scrollbar gizli (html), panel iç scrollbar GÖLD (aşağıda tanımlı) */
html.tk-panel-active::-webkit-scrollbar,html.tk-panel-active>body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}
html.tk-panel-active,html.tk-panel-active>body{scrollbar-width:none!important;-ms-overflow-style:none!important;}
/* Panel sağ kenara TAM yapışsın */
html.tk-panel-active #tracked-themes-overlay,
html.tk-panel-active #tracked-fi-panel{right:0!important;max-width:none!important;min-width:0!important;}

/* === PANEL İÇ SCROLLBAR — Premium Gold (sadece panel scroll alanlarında) === */
#tracked-themes-overlay .tto-scroll,#tracked-fi-panel .tfi-body{
  scrollbar-width:thin!important;
  scrollbar-color:rgba(200,169,110,.55) rgba(255,255,255,.04)!important;
}
#tracked-themes-overlay .tto-scroll::-webkit-scrollbar,
#tracked-fi-panel .tfi-body::-webkit-scrollbar{
  width:10px!important;height:10px!important;display:block!important;
}
#tracked-themes-overlay .tto-scroll::-webkit-scrollbar-track,
#tracked-fi-panel .tfi-body::-webkit-scrollbar-track{
  background:rgba(255,255,255,.03)!important;border-radius:10px!important;margin:6px 0!important;
}
#tracked-themes-overlay .tto-scroll::-webkit-scrollbar-thumb,
#tracked-fi-panel .tfi-body::-webkit-scrollbar-thumb{
  background:linear-gradient(180deg,rgba(200,169,110,.55),rgba(160,125,85,.65))!important;
  background-clip:content-box!important;
  border:2px solid transparent!important;
  border-radius:10px!important;
  transition:background-color .2s ease!important;
}
#tracked-themes-overlay .tto-scroll::-webkit-scrollbar-thumb:hover,
#tracked-fi-panel .tfi-body::-webkit-scrollbar-thumb:hover{
  background:linear-gradient(180deg,rgba(200,169,110,.8),rgba(160,125,85,.9))!important;
  background-clip:content-box!important;
}
#tracked-themes-overlay .tto-scroll::-webkit-scrollbar-thumb:active,
#tracked-fi-panel .tfi-body::-webkit-scrollbar-thumb:active{
  background:linear-gradient(180deg,rgba(200,169,110,1),rgba(160,125,85,1))!important;
  background-clip:content-box!important;
}
#tracked-themes-overlay .tto-scroll::-webkit-scrollbar-corner,
#tracked-fi-panel .tfi-body::-webkit-scrollbar-corner{background:transparent!important;}
/* v1.9.0: Panel açıkken diğer Tracked widget'larını gizle (envanter değeri, catalog insights vb.) */
html.tk-panel-active #tracked-inv-panel,
html.tk-panel-active #tracked-catalog-insights,
html.tk-panel-active #tracked-otopilot-retry{display:none!important;}
/* v1.9.0: Panel açıkken Roblox'un ana içerik alanını gizle (game cards bleed-through olmasın)
   Native Roblox sayfası hissi — topbar + sidebar görünür, geri kalan opak panel.
   visibility:hidden kullanılır (display:none Roblox JS state'ini bozabilir) */
html.tk-panel-active main,
html.tk-panel-active [role="main"],
html.tk-panel-active .container-main,
html.tk-panel-active .rbx-page-content,
html.tk-panel-active #content,
html.tk-panel-active [class*="page-content"]:not([class*="navigation"]):not([class*="left-nav"]):not([class*="sidebar"]){visibility:hidden!important;}
html{padding-bottom:20px!important;}
.profile-platform-container{position:relative!important;background:transparent!important;}
.thumbnail-2d-container.no-background-thumbnail,.thumbnail-span.no-background-thumbnail{background-color:transparent!important;}
body[data-internal-page-name="Profile"] #user-profile-header-bg,
body[data-internal-page-name="Profile"] .profile-header-overlay,
body[data-internal-page-name="Profile"] [class*="user-profile-header"],
body[data-internal-page-name="Profile"] [class*="ProfileHeader"],
body[data-internal-page-name="Profile"] [class*="profileHeader"],
body[data-internal-page-name="Profile"] [class*="profile-avatar-gradient"],
body[data-internal-page-name="Profile"] [class*="AvatarGradient"],
body[data-internal-page-name="Profile"] [class*="avatar-gradient"],
body[data-internal-page-name="Profile"] .thumbnail-3d-container,
body[data-internal-page-name="Profile"] .avatar-thumbnail-container,
body[data-internal-page-name="Profile"] [class*="AvatarThumbnail"],
body[data-internal-page-name="Profile"] [class*="avatarThumbnail"],
body[data-internal-page-name="Profile"] [class*="userAvatarThumbnail"]{background:transparent!important;background-color:transparent!important;background-image:none!important;}
body[data-internal-page-name="Profile"] .user-profile-header,
body[data-internal-page-name="Profile"] .profile-platform-container{border-bottom:none!important;box-shadow:none!important;background:transparent!important;background-color:transparent!important;background-image:none!important;}
body[data-internal-page-name="Profile"] .user-profile-header *[class*="bg-surface"]:not([role="dialog"]):not([role="menu"]):not([role="listbox"]):not([role="tooltip"]),
body[data-internal-page-name="Profile"] [class*="ProfileHeader"] *[class*="bg-surface"]:not([role="dialog"]):not([role="menu"]):not([role="listbox"]):not([role="tooltip"]),
body[data-internal-page-name="Profile"] .thumbnail-3d-container *[class*="bg-surface"]:not([role="dialog"]):not([role="menu"]):not([role="listbox"]):not([role="tooltip"]){background:transparent!important;background-color:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}
/* v1.9.0: Profile cover overlay — Roblox cover image üstüne iki absolute
   overlay enjekte ediyor (linear-gradient + blurred copy). Gradient'in keskin
   alt kenarı "siyah yatay bant" olarak görünüyor. display:none ile ikisini de
   tamamen kaldır. Avatar ve username sibling element olarak render edildiği
   için overlay gizlense de görünür kalır. */
body[data-internal-page-name="Profile"] [class*="cover-gradient-overlay"],
body[data-internal-page-name="Profile"] [class*="cover-blur-overlay"]{
  display:none!important;
  background:transparent!important;
  background-image:none!important;
}
.navbar-fixed-top.rbx-header,.rbx-header{border-bottom:none!important;}
/* NOKTA ATIŞI: Üst menü listesi <ul class="nav rbx-navbar ...">, #header'ın İÇİNDE olmasına rağmen
   'rbx-navbar' sınıfı yüzünden topbar tint'ini İKİNCİ kez alıyordu → Charts/Marketplace/Create/Robux
   butonlarının arkası ÇİFT koyulaşıyordu (logo tarafı tek kat, buton tarafı çift kat). Listeyi
   şeffaf yap → tint yalnızca #header'da kalır, butonların arkasındaki fazladan koyuluk biter. */
body ul.nav.rbx-navbar{
  background-color:transparent!important;
}
/* Arama kutusu özel rengi (Themes → Arama Kutusu) — KONSOL VERİSİNE göre kesin yapı:
   Dış kutu .navbar-search (bg 18,18,21 + radius 8px) ile içteki #navbar-search-input/.input-group
   FARKLI renkti → opaklık düşünce iç dolgu saydamlaşıp altındaki dış kutu "çerçeve" gibi görünüyordu.
   Çözüm: TEK renkli katman = dış .navbar-search (opaklık burada); iç katmanlar ŞEFFAF → ne çerçeve
   ne katman üst üste binmesi. Default kapalı = kural uygulanmaz = Roblox varsayılanı. */
html.tke-search-custom body .navbar-search{
  background-color:rgba(var(--tk-search-rgb,26,27,34),var(--tk-search-opacity,.85))!important;
}
html.tke-search-custom body .navbar-search .input-group,
html.tke-search-custom body #navbar-search-input,
html.tke-search-custom body .navbar-search .input-addon-btn{
  background-color:transparent!important;
  border-color:transparent!important;
}
/* Oyun detay: Favori/Bildirim/oy satırı — BLUR YOK. Şeffaf zeminde ikon + yazıların KONTRASTINI
   artır: yazılara güçlü koyu gölge, ikonlara koyu drop-shadow halo → wallpaper üstünde net okunur. */
body .favorite-follow-vote-share .icon-label,
body .favorite-follow-vote-share .vote-text{
  color:#fff!important;
  text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.85)!important;
  font-weight:700!important;
}
body .favorite-follow-vote-share #game-favorite-icon,
body .favorite-follow-vote-share #game-follow-icon,
body .favorite-follow-vote-share .icon-favorite,
body .favorite-follow-vote-share .icon-notifications-bell,
body .favorite-follow-vote-share .icon-like,
body .favorite-follow-vote-share .icon-dislike{
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.95)) drop-shadow(0 0 1px rgba(0,0,0,.8))!important;
}
/* v1.9.0: Avatar sayfasında Roblox editör (X butonu + sekmeler) top:0'dan başlıyor → şeffaf topbar
   altından görünüyor. Kök neden fix: editör elementlerini topbar yüksekliği kadar aşağı it. */
body[data-internal-page-name="Avatar"] [class*="avatar-editor"],
body[data-internal-page-name="Avatar"] [class*="AvatarEditor"],
body[data-internal-page-name="Avatar"] [class*="avatar-customizer"],
body[data-internal-page-name="Avatar"] [class*="AvatarCustomizer"],
body[data-internal-page-name="Avatar"] [data-testid*="avatar-editor"]{
  margin-top: 60px !important;
}
body[data-internal-page-name="Profile"] .profile-tab.active,
body[data-internal-page-name="Profile"] .rbx-tab-heading.active{box-shadow:0 -2px 0 0 var(--tk-accent) inset!important;}
#tracked-themes-nav-item{list-style:none!important;}
#tracked-themes-nav-item a:hover{background:rgba(255,255,255,.08)!important;border-radius:6px!important;}
#tracked-themes-nav-item a:focus,#tracked-themes-nav-item a:focus-visible{outline:none!important;box-shadow:none!important;}
#tracked-themes-nav-item .tracked-nav-icon{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;width:24px!important;height:24px!important;}
#tracked-themes-nav-item svg{width:24px!important;height:24px!important;flex-shrink:0!important;overflow:visible!important;}

@keyframes tto-enter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes tto-fadein{from{opacity:0}to{opacity:1}}
@keyframes tto-pulse-save{0%,100%{box-shadow:0 2px 12px rgba(176,104,56,.6)}50%{box-shadow:0 0 0 4px rgba(176,104,56,.35),0 2px 12px rgba(176,104,56,.8)}}

/* Smooth panel entrance/exit — Material Design easing */
@keyframes tto-panel-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
@keyframes tto-panel-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(6px); }
}

/* ── Shell ── */
#tracked-themes-overlay{position:fixed;top:var(--tto-top,60px);left:var(--tto-left,230px);right:0;bottom:0;z-index:9999999;background:#0c0d12;display:flex;flex-direction:column;overflow:hidden;font-family:"Gotham SSm","Helvetica Neue",Helvetica,Arial,sans-serif;animation:tto-panel-in .28s cubic-bezier(0.4,0,0.2,1) both;}
#tracked-themes-overlay.tto-closing{animation:tto-panel-out .22s cubic-bezier(0.4,0,1,1) both;}
#tracked-themes-overlay .tto-spacer{display:none;}
/* ── Tracked Plus kilit overlay (Temalar Pro özelliği — Plus yoksa panel kilitli) ── */
.tto-plus-lock{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,11,16,.82);backdrop-filter:blur(10px) saturate(120%);-webkit-backdrop-filter:blur(10px) saturate(120%);animation:tto-panel-in .26s cubic-bezier(0.4,0,0.2,1) both;}
.tto-lock-card{max-width:360px;width:100%;text-align:center;padding:36px 32px 30px;background:rgba(22,24,32,.92);border:1px solid rgba(255,255,255,.09);border-radius:20px;box-shadow:0 28px 70px rgba(0,0,0,.55);display:flex;flex-direction:column;align-items:center;gap:13px;}
.tto-lock-ic{width:92px;height:92px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(150deg,rgba(200,169,110,.24),rgba(200,169,110,.05));color:#e7c98a;box-shadow:inset 0 0 0 1px rgba(200,169,110,.25);margin-bottom:2px;}
.tto-lock-ic svg{width:46px;height:46px;}
.tto-lock-title{font-size:20px;font-weight:800;color:#f4f0e8;letter-spacing:.2px;}
.tto-lock-sub{font-size:13px;line-height:1.6;color:rgba(235,232,225,.66);max-width:300px;}
.tto-lock-btn{margin-top:9px;padding:12px 30px;border:none;border-radius:12px;background:linear-gradient(135deg,#d8b878,#c8a96e);color:#1a1206;font-size:14.5px;font-weight:800;cursor:pointer;transition:transform .12s ease,box-shadow .2s ease;box-shadow:0 8px 24px rgba(200,169,110,.34);}
.tto-lock-btn:hover{transform:translateY(-1px);box-shadow:0 13px 30px rgba(200,169,110,.46);}
.tto-lock-btn:active{transform:translateY(0);}
.tto-lock-back{background:none;border:none;color:rgba(235,232,225,.5);font-size:12.5px;cursor:pointer;padding:5px;text-decoration:underline;text-underline-offset:2px;}
.tto-lock-back:hover{color:rgba(235,232,225,.82);}

/* ── Header ── */
.tto-hdr{display:flex;align-items:center;gap:10px;padding:0 20px;height:50px;flex-shrink:0;background:#0c0d12;border-bottom:1px solid rgba(255,255,255,.055);}
.tto-back{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);color:rgba(255,255,255,.4);padding:6px 13px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap;}
.tto-back:hover{background:rgba(255,255,255,.09);color:rgba(255,255,255,.75);border-color:rgba(255,255,255,.13);}
.tto-brand{flex:1;text-align:center;font-size:11px;font-weight:700;color:rgba(255,255,255,.2);letter-spacing:2.5px;text-transform:uppercase;}
.tto-save{background:linear-gradient(135deg,#a07d55,#8b6f47);border:none;color:#f5f0e8;padding:7px 20px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:opacity .15s,box-shadow .15s;letter-spacing:.2px;box-shadow:0 2px 10px rgba(139,111,71,.4);}
.tto-save:hover{opacity:.88;box-shadow:0 4px 16px rgba(139,111,71,.55);}
.tto-save:disabled{opacity:.35;cursor:default;box-shadow:none;}

/* ── Body split ── */
.tto-body{display:flex;flex:1;overflow:hidden;position:relative;}
/* v1.9.0: Panel iç scroll bar'ı = browser default (Roblox'un kullandığı klasik scrollbar) */
#tracked-themes-overlay .tto-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 234px;  /* .tto-live (210px) + scrollbar (14px) için yer */
  box-sizing: border-box;
}
/* Live preview kendi scrollbar'ını gösterme — sadece .tto-scroll'unkini görsün */
#tracked-themes-overlay .tto-live::-webkit-scrollbar{display:none!important;width:0!important;}
#tracked-themes-overlay .tto-live{scrollbar-width:none!important;}
.tto-content{max-width:1080px;margin:0 auto;padding:30px 40px 84px;}

/* ── Section ── */
.tto-sec{margin-bottom:26px;animation:tto-fadein .3s ease both;}
.tto-sec-hdr{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.tto-sec-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(200,169,110,.1);border:1px solid rgba(200,169,110,.15);color:#c8a96e;flex-shrink:0;}
.tto-sec-title{font-size:11px;font-weight:700;color:rgba(255,255,255,.72);letter-spacing:.8px;text-transform:uppercase;}
.tto-sec-sub{font-size:11.5px;color:rgba(255,255,255,.5);margin-top:2px;line-height:1.4;}

/* ── Card ── */
.tto-card{background:#12141a;border:1px solid rgba(255,255,255,.055);border-radius:12px;overflow:hidden;}

/* ── Row ── */
.tto-row{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.038);}
.tto-row:last-child{border-bottom:none;}
.tto-row-label{font-size:12px;color:rgba(255,255,255,.62);width:110px;flex-shrink:0;letter-spacing:-.1px;}
.tto-row-ctrl{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
.tto-row-ctrl .tto-range{flex:1;min-width:0;}
.tto-val{font-size:10px;font-weight:700;color:rgba(255,255,255,.3);background:rgba(255,255,255,.06);border-radius:5px;padding:2px 8px;white-space:nowrap;min-width:40px;text-align:center;flex-shrink:0;font-family:monospace;letter-spacing:.2px;}

/* Toggle row */
.tto-row.tto-toggle-row{justify-content:space-between;}
.tto-toggle-label{font-size:12.5px;color:rgba(255,255,255,.72);flex:1;}
.tto-toggle-sub{font-size:11px;color:rgba(255,255,255,.5);line-height:1.45;margin-top:2px;}
.tto-toggle-pill{position:relative;width:40px;height:22px;flex-shrink:0;cursor:pointer;}
.tto-toggle-pill input{position:absolute;opacity:0;width:0;height:0;}
.tto-toggle-track{position:absolute;inset:0;background:rgba(255,255,255,.1);border-radius:11px;transition:background .2s;}
.tto-toggle-pill input:checked~.tto-toggle-track{background:rgba(200,169,110,.8);}
.tto-toggle-thumb{position:absolute;width:16px;height:16px;background:#f0ece4;border-radius:50%;top:3px;left:3px;transition:left .2s;box-shadow:0 1px 5px rgba(0,0,0,.5);}
.tto-toggle-pill input:checked~.tto-toggle-thumb{left:21px;}

/* Swatch row */
.tto-row.tto-swatch-row{flex-wrap:wrap;padding:12px 16px;gap:10px;}
.tto-swatch-row .tto-row-label{align-self:center;}
.tto-swatches-wrap{display:flex;flex-wrap:wrap;gap:6px;align-items:center;flex:1;}
.tto-swatch{width:28px;height:28px;border-radius:7px;cursor:pointer;border:2px solid rgba(255,255,255,.3);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 1px 4px rgba(0,0,0,.55);transition:border-color .15s,transform .12s,box-shadow .15s;flex-shrink:0;outline:none;}
.tto-swatch:hover{transform:scale(1.15);border-color:rgba(255,255,255,.55);}
.tto-swatch.active{border-color:rgba(255,255,255,.9)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 0 0 3px rgba(255,255,255,.22)!important;}
/* Panel/Kart/Arama renk örnekleri panel renkleri olduğu için çok KOYU → kareler birbirine benziyordu.
   Önizlemeyi parlat+doygunlaştır ki HUE (mavi/kahve/yeşil/mor…) belli olsun. Uygulanan gerçek renk
   yine seçilen koyu hex kalır — bu yalnızca swatch'ın GÖRÜNÜMÜ. */
#tto-panel-swatches .tto-swatch,
#tto-card-swatches .tto-swatch,
#tto-search-swatches .tto-swatch{
  filter:brightness(1.9) saturate(1.7);
}
/* Özel renk seçici (native color input) — rainbow halka + ortada seçili renk → "herhangi bir renk seç" */
.tto-colorpick{-webkit-appearance:none;appearance:none;width:28px;height:28px;border-radius:8px;padding:3px;border:none;cursor:pointer;flex-shrink:0;background:conic-gradient(from 0deg,#ff5d5d,#ffd24d,#5dff8f,#4dd2ff,#b85dff,#ff5d5d);box-shadow:0 1px 4px rgba(0,0,0,.55);transition:transform .12s;outline:none;}
.tto-colorpick:hover{transform:scale(1.12);}
.tto-colorpick::-webkit-color-swatch-wrapper{padding:0;}
.tto-colorpick::-webkit-color-swatch{border:1px solid rgba(0,0,0,.35);border-radius:5px;}
.tto-hex{height:26px;width:82px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:7px;color:rgba(255,255,255,.5);font-size:11px;font-family:monospace;padding:0 8px;outline:none;letter-spacing:.4px;}
.tto-hex:focus{border-color:rgba(200,169,110,.5);color:#f0ece4;}

/* ── Range ── */
.tto-range{-webkit-appearance:none;appearance:none;width:100%;height:3px;border-radius:2px;outline:none;cursor:pointer;background:linear-gradient(to right,rgba(200,169,110,.7) 0%,rgba(200,169,110,.7) var(--pct,50%),rgba(255,255,255,.1) var(--pct,50%),rgba(255,255,255,.1) 100%);}
.tto-range::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#f0ece4;cursor:pointer;box-shadow:0 0 0 3px rgba(200,169,110,.4),0 1px 5px rgba(0,0,0,.5);transition:box-shadow .15s;}
.tto-range:hover::-webkit-slider-thumb{box-shadow:0 0 0 4px rgba(200,169,110,.65),0 1px 5px rgba(0,0,0,.5);}
.tto-range:active::-webkit-slider-thumb{box-shadow:0 0 0 5px rgba(200,169,110,.5),0 1px 5px rgba(0,0,0,.5);}

/* ── Theme grid ── */
.tto-grid{display:grid;grid-template-columns:1fr 1.5fr 1fr;grid-template-rows:112px 112px 112px;gap:8px;animation:tto-enter .4s ease both;}
.tto-grid-card{border-radius:10px;overflow:hidden;position:relative;cursor:pointer;border:2px solid transparent;transition:border-color .15s,transform .15s,box-shadow .15s;}
.tto-grid-card:hover{transform:scale(1.025);box-shadow:0 6px 24px rgba(0,0,0,.55);}
.tto-grid-card.tto-gc-active{border-color:#c8a96e!important;box-shadow:0 0 0 3px rgba(200,169,110,.2);}
.tto-grid-card[data-preset="midnight"]{grid-column:1;grid-row:1;}
.tto-grid-card[data-preset="cream"]{grid-column:2;grid-row:1/4;}
.tto-grid-card[data-preset="ember"]{grid-column:1;grid-row:2;}
.tto-grid-card[data-preset="slate"]{grid-column:1;grid-row:3;}
.tto-grid-card[data-preset="forest"]{grid-column:3;grid-row:1;}
.tto-grid-card[data-preset="plum"]{grid-column:3;grid-row:2/4;}
.tto-card-bg{position:absolute;inset:0;transition:filter .2s;}
.tto-grid-card:hover .tto-card-bg{filter:brightness(1.12);}
.tto-card-info{position:absolute;bottom:0;left:0;right:0;padding:11px 12px 9px;background:linear-gradient(0deg,rgba(0,0,0,.78) 0%,transparent 100%);display:flex;flex-direction:column;gap:3px;}
.tto-card-name{font-family:Georgia,"Times New Roman",serif;font-size:15px;font-weight:400;color:rgba(255,255,255,.92);line-height:1;}
.tto-grid-card[data-preset="cream"] .tto-card-name{font-size:26px;}
.tto-grid-card[data-preset="plum"] .tto-card-name{font-size:19px;}
.tto-card-mood{font-size:11px;color:rgba(255,255,255,.42);letter-spacing:.3px;}
.tto-pal-dots{display:flex;gap:5px;margin-bottom:5px;}
.tto-pal-dot{width:11px;height:11px;border-radius:50%;flex-shrink:0;border:1px solid rgba(255,255,255,.45);box-shadow:0 1px 3px rgba(0,0,0,.45);filter:brightness(1.25) saturate(1.4);}

/* ── Wallpaper ── */
/* Wallpaper preview: full image (contain) + blur'lu backdrop fill (Spotify/YouTube tarzı), slider'lardan canlı yansır */
.tto-wp-prev{border-radius:12px;overflow:hidden;height:240px;position:relative;margin-bottom:14px;background:#0d0e14;
  --twp-prev-opacity:1; --twp-prev-blur:0px; --twp-prev-dim:.45;
}
/* Backdrop: aynı medya, blur'lu + scale (kenar artifact'lerini kapat) — boş alanı resmin renkleriyle doldurur */
.tto-wp-prev .tto-wp-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(36px) brightness(.55) saturate(1.1);transform:scale(1.18);opacity:.85;z-index:0;pointer-events:none;}
/* Ana medya: tam görünür (contain), slider'lara tepki verir */
.tto-wp-prev .tto-wp-fg{position:relative;width:100%;height:100%;object-fit:contain;display:block;z-index:1;opacity:var(--twp-prev-opacity);filter:blur(var(--twp-prev-blur));transition:opacity .15s,filter .15s;}
.tto-wp-prev::after{content:'';position:absolute;inset:0;pointer-events:none;background:rgba(0,0,0,var(--twp-prev-dim));transition:background .15s;z-index:2;}
.tto-wp-badge{position:absolute;top:9px;left:9px;display:flex;align-items:center;gap:4px;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:5px;padding:4px 8px;font-size:10px;color:rgba(255,255,255,.65);z-index:3;}
.tto-drop{position:relative;border:1.5px dashed rgba(255,255,255,.08);border-radius:14px;padding:38px 20px 32px;text-align:center;cursor:pointer;transition:all .2s;background:rgba(255,255,255,.015);margin-bottom:14px;}
.tto-drop:hover{border-color:rgba(200,169,110,.4);background:rgba(200,169,110,.04);}
.tto-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;}
.tto-drop-icon{display:flex;justify-content:center;margin-bottom:12px;color:rgba(255,255,255,.18);}
.tto-drop-icon svg{width:32px;height:32px;}
.tto-drop-main{font-size:14px;color:rgba(255,255,255,.42);font-weight:500;margin-bottom:6px;}
.tto-drop-sub{font-size:11px;color:rgba(255,255,255,.17);}
.tto-file-err{color:#ff6b6b;font-size:12px;margin-top:8px;text-align:center;}
.tto-sep{display:flex;align-items:center;gap:10px;margin:10px 0;}
.tto-sep-line{flex:1;height:1px;background:rgba(255,255,255,.05);}
.tto-sep-text{font-size:11px;color:rgba(255,255,255,.16);}
.tto-rm{width:100%;display:flex;align-items:center;justify-content:center;gap:7px;background:rgba(255,60,60,.05);border:1px solid rgba(255,60,60,.12);color:rgba(255,100,100,.65);border-radius:10px;padding:10px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
.tto-rm:hover{background:rgba(255,60,60,.12);color:#ff6b6b;border-color:rgba(255,60,60,.24);}
.tto-blur-hint{font-size:11px;color:rgba(255,160,60,.5);padding:4px 16px 6px;}
.tto-wp-save-note{font-size:11px;color:rgba(200,169,110,.38);padding:4px 16px 8px;font-style:italic;}
.tto-reset-adj{background:none;border:1px solid rgba(255,255,255,.07);color:rgba(255,255,255,.25);border-radius:6px;padding:3px 9px;font-size:10px;font-weight:500;cursor:pointer;transition:all .15s;margin-left:auto;white-space:nowrap;flex-shrink:0;}
.tto-reset-adj:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.5);border-color:rgba(255,255,255,.13);}

/* Hepsini Sıfırla (global red button) */
.tto-reset-all{display:inline-flex;align-items:center;gap:5px;background:rgba(255,69,58,.10);border:1px solid rgba(255,69,58,.30);color:#FF453A;padding:6px 13px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;margin-left:8px;}
.tto-reset-all:hover{background:rgba(255,69,58,.20);border-color:rgba(255,69,58,.50);color:#FF6B62;}
.tto-reset-all svg{flex-shrink:0;}

/* Confirmation Modal */
.tto-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:2147483646;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .18s;}
.tto-modal-overlay.show{opacity:1;pointer-events:auto;}
.tto-modal{background:linear-gradient(180deg,rgba(28,28,34,0.98),rgba(20,20,26,0.98));border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:22px 24px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.50);transform:scale(.95);transition:transform .18s;}
.tto-modal-overlay.show .tto-modal{transform:scale(1);}
.tto-modal-icon{width:42px;height:42px;border-radius:50%;background:rgba(255,69,58,.12);display:flex;align-items:center;justify-content:center;color:#FF453A;margin-bottom:12px;}
.tto-modal-title{font-size:16px;font-weight:700;color:rgba(255,255,255,0.95);margin-bottom:6px;letter-spacing:-0.01em;}
.tto-modal-text{font-size:12.5px;color:rgba(255,255,255,0.65);line-height:1.55;margin-bottom:18px;}
.tto-modal-text b{color:rgba(255,255,255,0.90);}
.tto-modal-actions{display:flex;gap:8px;justify-content:flex-end;}
.tto-modal-btn{padding:8px 16px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all .15s;}
.tto-modal-btn-cancel{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.08);}
.tto-modal-btn-cancel:hover{background:rgba(255,255,255,0.10);color:rgba(255,255,255,0.95);}
.tto-modal-btn-danger{background:#FF453A;color:#fff;}
.tto-modal-btn-danger:hover{background:#FF6B62;box-shadow:0 4px 12px rgba(255,69,58,0.35);}

/* ─── Free Items Header Button (Roblox top header'a inject, native pattern) ─── */
/* Diğer Roblox header item'larıyla (bell/robux/settings) birebir orantılı boyut + hover */
#tracked-fi-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  list-style: none !important;
  margin: 0 2px !important;
}
#tracked-fi-btn button {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  cursor: pointer !important;
  width: 36px !important;
  height: 36px !important;
  border-radius: 8px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: rgba(255,255,255,0.85) !important;
  transition: background-color .15s, color .15s !important;
  outline: none !important;
  box-shadow: none !important;
}
#tracked-fi-btn button:hover {
  background: rgba(255,255,255,0.08) !important;
  color: #fff !important;
}
#tracked-fi-btn button:active {
  background: rgba(255,255,255,0.12) !important;
  transform: scale(0.95) !important;
}
#tracked-fi-btn button:focus,
#tracked-fi-btn button:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
#tracked-fi-btn .rbx-menu-item {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 22px !important;
  height: 22px !important;
}
#tracked-fi-btn .rbx-menu-item svg {
  display: block !important;
  flex-shrink: 0 !important;
  width: 20px !important;
  height: 20px !important;
}

/* ─── FULL-PAGE OVERLAY (themes ile aynı pattern — sızıntı yok) ─── */
#tracked-fi-panel {
  position: fixed !important;
  top: var(--tto-top, 60px) !important;
  left: var(--tto-left, 230px) !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 9999999 !important;
  background: #0c0d12 !important;
  color: rgba(255,255,255,0.88) !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  font-size: 13px !important;
  display: flex !important; flex-direction: column !important;
  overflow: hidden !important;
  animation: tfi-panel-in .28s cubic-bezier(0.4,0,0.2,1) both !important;
  will-change: opacity, transform;
}
@keyframes tfi-panel-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes tfi-panel-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(6px); }
}
#tracked-fi-panel.tfi-closing { animation: tfi-panel-out .22s cubic-bezier(0.4,0,1,1) both !important; }
#tracked-fi-panel.no-anim { animation: none !important; }
#tracked-fi-panel .tfi-spacer { display: none; }

/* Header bar (themes overlay style) */
.tfi-hdr {
  display: flex; align-items: center; gap: 10px;
  padding: 0 20px; height: 50px; flex-shrink: 0;
  background: #0c0d12; border-bottom: 1px solid rgba(255,255,255,.055);
}
.tfi-back {
  display: inline-flex; align-items: center; gap: 5px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.07);
  color: rgba(255,255,255,.4); padding: 6px 13px; border-radius: 8px;
  font-size: 12px; font-weight: 500; cursor: pointer; transition: all .15s;
  white-space: nowrap;
}
.tfi-back:hover { background: rgba(255,255,255,.09); color: rgba(255,255,255,.75); border-color: rgba(255,255,255,.13); }
.tfi-brand {
  flex: 1; text-align: center; font-size: 11px; font-weight: 700;
  color: rgba(255,255,255,.2); letter-spacing: 2.5px; text-transform: uppercase;
}
.tfi-hdr-actions { display: flex; align-items: center; gap: 8px; }

/* İçerik alanı - scrollbar gizli ama scroll çalışıyor */
.tfi-body { flex: 1; overflow-y: auto; }

.tfi-pane {
  max-width: 1080px; margin: 0 auto;
  padding: 34px 40px 56px;
}
.tfi-page-title {
  display: flex; align-items: center; gap: 12px; margin-bottom: 6px;
  font-size: 24px; font-weight: 700; color: rgba(255,255,255,.95); letter-spacing: -.02em;
}
.tfi-page-title svg { color: #A07D55; flex-shrink: 0; }
.tfi-page-sub {
  font-size: 12.5px; color: rgba(255,255,255,.42); margin-bottom: 24px; line-height: 1.55;
  max-width: 600px;
}
.tfi-actions{display:flex;align-items:center;gap:8px;}
.tfi-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.85);padding:6px 13px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:5px;}
.tfi-btn:hover{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.16);color:#fff;}
.tfi-btn.primary{background:#5AC8FA;color:#0c0d12;border-color:transparent;}
.tfi-btn.primary:hover{background:#7AD4FB;box-shadow:0 2px 10px rgba(90,200,250,.35);}
.tfi-btn.spinning svg{animation:tfi-spin 1s linear infinite;}
@keyframes tfi-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
.tfi-status{display:flex;align-items:center;gap:14px;padding:12px 16px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:10px;margin-bottom:20px;flex-wrap:wrap;}
.tfi-status-pill{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;}
.tfi-status-pill.on{color:#30D158;background:rgba(48,209,88,.10);}
.tfi-status-pill.off{color:rgba(255,255,255,.45);background:rgba(255,255,255,.05);}
.tfi-status-pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;}
.tfi-status-info{font-size:11px;color:rgba(255,255,255,.55);}
.tfi-toggle-wrap{margin-left:auto;display:flex;align-items:center;gap:8px;}
.tfi-toggle{position:relative;width:34px;height:20px;cursor:pointer;}
.tfi-toggle input{position:absolute;opacity:0;width:0;height:0;}
.tfi-toggle-track{position:absolute;inset:0;background:rgba(255,255,255,.10);border-radius:10px;transition:background .2s;}
.tfi-toggle input:checked~.tfi-toggle-track{background:#30D158;}
.tfi-toggle-thumb{position:absolute;width:14px;height:14px;background:#f5f0e8;border-radius:50%;top:3px;left:3px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.4);}
.tfi-toggle input:checked~.tfi-toggle-thumb{left:17px;}

.tfi-list{display:flex;flex-direction:column;gap:6px;}
.tfi-item{display:flex;align-items:center;gap:14px;padding:12px 14px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05);border-radius:10px;transition:background .12s,border-color .12s,transform .12s;}
.tfi-item:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.10);transform:translateY(-1px);}
.tfi-thumb{width:56px;height:56px;border-radius:8px;background:rgba(255,255,255,.04);flex-shrink:0;object-fit:cover;border:1px solid rgba(255,255,255,.05);}
.tfi-meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}
.tfi-name{font-size:13.5px;font-weight:600;color:rgba(255,255,255,.95);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.005em;}
.tfi-sub{font-size:11px;color:rgba(255,255,255,.40);display:flex;align-items:center;gap:8px;}
.tfi-sub-creator{color:rgba(255,255,255,.55);font-weight:500;}
.tfi-go{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:7px 14px;background:rgba(48,209,88,.10);border:1px solid rgba(48,209,88,.28);color:#30D158;font-size:11.5px;font-weight:700;border-radius:7px;cursor:pointer;text-decoration:none;transition:all .15s;letter-spacing:.2px;}
.tfi-go:hover{background:rgba(48,209,88,.18);border-color:rgba(48,209,88,.45);box-shadow:0 3px 12px rgba(48,209,88,.18);transform:translateY(-1px);}
.tfi-go.ingame{background:rgba(90,200,250,.10);border-color:rgba(90,200,250,.28);color:#5AC8FA;}
.tfi-go.ingame:hover{background:rgba(90,200,250,.18);border-color:rgba(90,200,250,.45);box-shadow:0 3px 12px rgba(90,200,250,.18);}

/* Distribution badge (CATALOG vs OYUNDA) + Stock badge */
.tfi-badge{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:.06em;margin-left:6px;vertical-align:middle;}
.tfi-badge svg{flex-shrink:0;}
.tfi-badge.catalog{color:#30D158;background:rgba(48,209,88,.10);border:1px solid rgba(48,209,88,.22);}
.tfi-badge.ingame{color:#5AC8FA;background:rgba(90,200,250,.10);border:1px solid rgba(90,200,250,.22);}
.tfi-badge.stock{color:rgba(255,255,255,.6);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);}
.tfi-badge.lowstock{color:#FF9F0A;background:rgba(255,159,10,.12);border:1px solid rgba(255,159,10,.35);animation:tfi-pulse 1.8s ease-in-out infinite;}
@keyframes tfi-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,159,10,0);}50%{box-shadow:0 0 0 4px rgba(255,159,10,.15);}}
.tfi-item.low-stock{border-color:rgba(255,159,10,.18) !important;}
.tfi-item.low-stock:hover{border-color:rgba(255,159,10,.35) !important;}
.tfi-empty{padding:40px 20px;text-align:center;color:rgba(255,255,255,.4);font-size:12.5px;line-height:1.6;}
.tfi-empty-icon{display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.25);margin-bottom:10px;}

.tfi-clear-btn{display:block;margin:14px auto 0;padding:6px 14px;background:none;border:1px solid rgba(255,69,58,.30);color:rgba(255,69,58,.85);border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;}
.tfi-clear-btn:hover{background:rgba(255,69,58,.10);color:#FF453A;}
.tto-save-pending{background:linear-gradient(135deg,#b06838,#924e22)!important;box-shadow:0 2px 12px rgba(176,104,56,.6)!important;animation:tto-pulse-save .7s ease 2;}

/* ── Overrides ── */
.tto-collapse-btn{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;cursor:pointer;color:rgba(255,255,255,.28);font-size:12px;font-weight:600;letter-spacing:.3px;border-top:1px solid rgba(255,255,255,.038);user-select:none;transition:color .15s;}
.tto-collapse-btn:hover{color:rgba(255,255,255,.58);}
.tto-collapse-btn svg{transition:transform .2s;flex-shrink:0;}
.tto-collapse-btn.tto-col-open svg{transform:rotate(180deg);}
.tto-overrides-body{flex-direction:column;}
.tto-override-row{display:flex;align-items:center;justify-content:space-between;padding:9px 16px;border-bottom:1px solid rgba(255,255,255,.03);}
.tto-override-row:last-child{border-bottom:none;}
.tto-override-path{font-size:12px;color:rgba(255,255,255,.24);font-family:monospace;}
.tto-override-select{background:#1a1c24;border:1px solid rgba(255,255,255,.07);border-radius:7px;color:rgba(255,255,255,.42);font-size:12px;padding:5px 10px;cursor:pointer;outline:none;-webkit-appearance:none;appearance:none;}
.tto-override-select:focus{border-color:rgba(200,169,110,.45);}
/* Özel yazı tipi dropdown'ı (native select yerine — canlı font önizlemeli, temalı) */
.tto-fontdd{position:relative;display:inline-block;}
.tto-fontdd-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:172px;background:#1a1c24;border:1px solid rgba(255,255,255,.1);border-radius:9px;color:rgba(255,255,255,.88);font-size:13px;padding:8px 11px;cursor:pointer;outline:none;transition:border-color .15s,background .15s;}
.tto-fontdd-btn:hover{background:#20232d;border-color:rgba(200,169,110,.4);}
.tto-fontdd.open .tto-fontdd-btn{border-color:rgba(200,169,110,.6);background:#20232d;}
.tto-fontdd-cur{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tto-fontdd-chev{flex-shrink:0;opacity:.55;transition:transform .2s;}
.tto-fontdd.open .tto-fontdd-chev{transform:rotate(180deg);opacity:.85;}
.tto-fontdd-menu{position:fixed;z-index:99999999;min-width:190px;max-height:320px;overflow-y:auto;overflow-x:hidden;background:#1c1e27;border:1px solid rgba(255,255,255,.12);border-radius:11px;box-shadow:0 14px 40px rgba(0,0,0,.55);padding:6px;display:flex;flex-direction:column;gap:3px;animation:ttoFontIn .16s cubic-bezier(.2,.9,.2,1.1);}
.tto-fontdd-menu::-webkit-scrollbar{width:7px;}
.tto-fontdd-menu::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:4px;}
/* Sabit satır yüksekliği + dikey ortalama + taşma kırpma → font ne olursa olsun üst üste binmez */
.tto-fontdd-opt{display:flex;align-items:center;flex-shrink:0;box-sizing:border-box;height:38px;width:100%;text-align:left;background:transparent;border:none;border-radius:8px;color:rgba(255,255,255,.82);font-size:14px;line-height:1;padding:0 12px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .12s,color .12s;}
.tto-fontdd-opt:hover{background:rgba(255,255,255,.07);color:#fff;}
.tto-fontdd-opt.active{background:rgba(200,169,110,.16);color:#EBD8A9;}
@keyframes ttoFontIn{from{opacity:0;transform:translateY(-6px) scale(.98);}to{opacity:1;transform:none;}}

/* ── Share / Import ── */
.tto-export-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:rgba(255,255,255,.38);border-radius:10px;padding:11px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;margin-bottom:12px;}
.tto-export-btn:hover{background:rgba(255,255,255,.08);color:rgba(255,255,255,.65);border-color:rgba(255,255,255,.13);}
.tto-share-row{display:flex;gap:8px;align-items:stretch;}
.tto-share-input{flex:1;background:#12141a;border:1px solid rgba(255,255,255,.07);border-radius:9px;color:rgba(255,255,255,.45);font-size:11px;font-family:monospace;padding:10px 12px;outline:none;min-width:0;}
.tto-share-input:focus{border-color:rgba(200,169,110,.45);color:#f0ece4;}
.tto-share-btn{background:rgba(200,169,110,.12);border:1px solid rgba(200,169,110,.22);color:#c8a96e;border-radius:9px;padding:10px 16px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;}
.tto-share-btn:hover{background:rgba(200,169,110,.24);}
.tto-share-msg{font-size:12px;margin-top:8px;min-height:18px;color:rgba(255,255,255,.25);}
.tto-share-msg.tto-sm-ok{color:#4caf7d;}
.tto-share-msg.tto-sm-err{color:#ff6b6b;}

/* ── Avatar viewer ── */
#tracked-avatar-ctrl{position:absolute;pointer-events:none;display:flex;align-items:center;justify-content:space-between;padding:0 10px;z-index:10;}
.tracked-viewer-btn{pointer-events:auto;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.45);color:rgba(255,255,255,.75);cursor:pointer;transition:background .2s ease,color .2s ease,border-color .2s ease;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}
.tracked-viewer-btn:hover{background:rgba(139,111,71,.4);border-color:rgba(139,111,71,.55);color:#f5f0e8;}
.tracked-viewer-btn:active{transform:scale(.88);}
.tracked-viewer-btn svg{display:block;pointer-events:none;}

/* ── Live preview ── */
.tto-live{position:absolute;right:14px;top:0;bottom:0;width:210px;background:#0e0f15;border-left:1px solid rgba(255,255,255,.05);padding:20px 14px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;z-index:2;}
.tto-live-cap{font-size:9px;font-weight:700;color:rgba(255,255,255,.18);text-transform:uppercase;letter-spacing:1.5px;}
.tto-live-name{font-family:Georgia,"Times New Roman",serif;font-size:20px;font-weight:400;color:#f0ece4;line-height:1.1;transition:opacity .15s;}
.tto-live-mood{font-size:10px;color:rgba(255,255,255,.24);letter-spacing:.3px;}
.tto-mock{width:100%;aspect-ratio:16/10;border-radius:8px;overflow:hidden;background:#0d0e14;display:flex;flex-direction:column;box-shadow:0 4px 24px rgba(0,0,0,.7);}
.tto-mock-topbar{height:22%;background:var(--tk-topbar);flex-shrink:0;transition:background .2s;}
.tto-mock-body{display:flex;flex:1;overflow:hidden;}
.tto-mock-sidebar{width:32%;background:var(--tk-sidebar);padding:7px 5px;display:flex;flex-direction:column;gap:5px;flex-shrink:0;transition:background .2s;}
.tto-mock-navitem{height:8px;border-radius:2px;background:var(--tk-navitem);transition:background .2s;}
.tto-mock-content{flex:1;padding:5px;display:grid;grid-template-columns:1fr 1fr;gap:4px;align-content:start;overflow:hidden;}
.tto-mock-card{height:26px;border-radius:3px;background:var(--tk-card);transition:background .2s;}
/* === UNIVERSAL KART-TABANLI TASARIM (v1.9.0 — tüm sayfalarda) ===
   Strateji: her büyük section/kart kendi cam görünümlü kartı olur:
     • bg: rgba(15,16,22,.7) (tema değişkeniyle uyumlu)
     • border: 1px solid rgba(255,255,255,.07) (modern kart hattı)
     • border-radius: 12px (yuvarlatılmış kart)
     • box-shadow: hafif derinlik
   Wrapper'lar (container-main, content, group-details vs.) ŞEFFAF kalır —
   kartlar wallpaper üzerinde "ayrı kutucuklar" gibi yüzer.
   bg-surface-300, bg-surface-400 (küçük pill/badge UI) hariç tutulur — onlar
   kart değil küçük inline öğedir. */

/* ── KARTLAR (tint + border + radius) ── */
body [class*="bg-surface-100"]:not(.left-nav):not([class*="alert"]):not([class*="notification"]):not([class*="banner"]):not([role="alert"]):not([role="status"]):not([role="dialog"]):not([role="menu"]):not([role="listbox"]):not([role="tooltip"]),
body [class*="bg-surface-200"]:not(.left-nav):not([class*="alert"]):not([class*="notification"]):not([class*="banner"]):not([role="alert"]):not([role="status"]):not([role="dialog"]):not([role="menu"]):not([role="listbox"]):not([role="tooltip"]),
body .rbx-section,
body .section.rbx-section,
body .rbx-page-content,
body [class*="content-section"]:not(.left-nav),
body [class*="ContentSection"]:not(.left-nav),
body [class*="recommended"]:not([class*="recommended-item"]):not([class*="creator"]):not(a):not(.left-nav),
body [class*="Recommended"]:not([class*="Item"]):not([class*="reator"]):not(a):not(.left-nav),
body footer:not([class*="container-footer-mini"]),
body .container-footer,
body [class*="container-footer"]:not([class*="container-footer-mini"]),
body [class*="page-footer"],
body [class*="PageFooter"],
body .rbx-tabs-horizontal:not([data-place-id]),
body.tk-communities-page .group-profile-header,
body.tk-communities-page .section.group-announcements,
body.tk-communities-page .group-announcements,
body.tk-communities-page group-games > .section,
body.tk-communities-page group-payouts > .section,
body.tk-communities-page group-forums-discovery > .section,
body.tk-communities-page .groups-list-sidebar,
body.tk-communities-page [class*="groups-list-sidebar"]{
  background-color:rgba(var(--tk-panel-rgb,15,16,22),var(--tk-panel-opacity,0.7))!important;
  border:1px solid rgba(255,255,255,.07)!important;
  border-radius:12px!important;
  box-shadow:0 2px 8px rgba(0,0,0,.18)!important;
}

/* v1.9.3: Arkadaşlar sayfası (Friends/Requests/Followers) — kartların ARKA DUVARI şeffaf,
   sadece wallpaper görünsün (kartların kendisi yukarıdaki kart kurallarıyla boyalı kalır).
   KONSOL-DOĞRULANMIŞ kaynak: .rbx-tabs-horizontal.rbx-scrollable-tabs-horizontal bu sayfada
   TÜM içeriği sarıyor → üstteki .rbx-tabs-horizontal kart boyası koca duvara dönüşüyordu.
   tke-card-adv öncelikli kuralları da ezsin diye iki varyant. */
body .rbx-tabs-horizontal.rbx-scrollable-tabs-horizontal,
html.tke-card-adv body .rbx-tabs-horizontal.rbx-scrollable-tabs-horizontal,
body .friends-content.section,
body .friends-content,
html.tke-card-adv body .friends-content.section,
html.tke-card-adv body .friends-content{
  background:transparent!important;
  border:none!important;
  box-shadow:none!important;
}

/* === GELİŞMİŞ KART MODU (html.tke-card-adv) ===
   Gelişmiş ayarlardan açıldığında kartlar PANEL değişkenleri yerine KARTA ÖZEL
   değişkenleri (--tk-card-rgb / --tk-card-opacity / --tk-card-blur) kullanır +
   backdrop blur alır. Kapalıyken bu blok hiç uygulanmaz → kartlar panel
   değişkenlerine geri döner (mevcut davranış korunur). */
html.tke-card-adv body [class*="bg-surface-100"]:not(.left-nav):not([class*="alert"]):not([class*="notification"]):not([class*="banner"]):not([role="alert"]):not([role="status"]):not([role="dialog"]):not([role="menu"]):not([role="listbox"]):not([role="tooltip"]),
html.tke-card-adv body [class*="bg-surface-200"]:not(.left-nav):not([class*="alert"]):not([class*="notification"]):not([class*="banner"]):not([role="alert"]):not([role="status"]):not([role="dialog"]):not([role="menu"]):not([role="listbox"]):not([role="tooltip"]),
html.tke-card-adv body .rbx-section,
html.tke-card-adv body .section.rbx-section,
html.tke-card-adv body .rbx-page-content,
html.tke-card-adv body [class*="content-section"]:not(.left-nav),
html.tke-card-adv body [class*="ContentSection"]:not(.left-nav),
html.tke-card-adv body [class*="recommended"]:not([class*="recommended-item"]):not([class*="creator"]):not(a):not(.left-nav),
html.tke-card-adv body [class*="Recommended"]:not([class*="Item"]):not([class*="reator"]):not(a):not(.left-nav),
html.tke-card-adv body .rbx-tabs-horizontal:not([data-place-id]),
html.tke-card-adv body.tk-communities-page .group-profile-header,
html.tke-card-adv body.tk-communities-page .section.group-announcements,
html.tke-card-adv body.tk-communities-page .group-announcements,
html.tke-card-adv body.tk-communities-page group-games > .section,
html.tke-card-adv body.tk-communities-page group-payouts > .section,
html.tke-card-adv body.tk-communities-page group-forums-discovery > .section,
html.tke-card-adv body.tk-communities-page .groups-list-sidebar,
html.tke-card-adv body.tk-communities-page [class*="groups-list-sidebar"],
html.tke-card-adv body .avatar-card-container{
  background-color:rgba(var(--tk-card-rgb,15,16,22),var(--tk-card-opacity,0.7))!important;
  backdrop-filter:blur(var(--tk-card-blur,0px))!important;
  -webkit-backdrop-filter:blur(var(--tk-card-blur,0px))!important;
}

/* === METİN KONTRASTI (html.tke-text-contrast) ===
   Gelişmiş ayarlardan açılınca, dokunduğumuz alanlardaki yazıların okunurluğunu
   artırır: içerik metnine gölge (renkleri BOZMADAN — link mavi, fiyat yeşil kalır)
   + soluk/muted metni parlatır. Kapalıyken hiç uygulanmaz.
   KAPSAM (kullanıcı kararı): kullanıcı/grup adları, oyun adları, açıklamalar, rating/% sayıları.
   ANA BAŞLIKLAR HARİÇ (h1-h6, text-heading, font-header) — büyük yazıda gölge ucuz görünüyor. */
html.tke-text-contrast body :is(
  [class*="text-body"],[class*="text-title"],[class*="text-label"],
  [class*="text-lead"],[class*="font-caption"],[class*="font-body"],
  [class*="font-subheader"],.text-overflow,.item-card-name,.game-card-name,.avatar-name,
  .chat-friend-name,.groups-list-heading,.game-name,.game-description,.text,.text-name,
  .icon-label,.vote-text,.vote-percentage-label,.playing-counts-label,.info-label,
  .text-truncate-end,.see-all-link-icon,.friends-carousel-display-name,.friend-tile-non-styled-button,
  .friend-tile-dropdown-button,[class*="textIconRowText"],.age-rating-display-name,.text-link
){
  text-shadow:0 1px 2px rgba(0,0,0,.6)!important;
}
/* Soluk / ikincil metin — hem parlat hem gölge ver (kontrast belirgin artar) */
html.tke-text-contrast body :is(
  [class*="content-muted"],[class*="content-default"],.text-secondary,.text-muted,
  .text-info,.text-sec,.avatar-card-label,.chat-brief-timestamp,.chat-friend-message
){
  color:rgba(255,255,255,.82)!important;
  text-shadow:0 1px 2px rgba(0,0,0,.55)!important;
}

/* === YAZI RENGİ (html.tke-text-color, Gelişmiş) ===
   İçerik metnini seçilen renge boyar + okunurluk için hafif gölge. Kapalıyken (varsayılan) uygulanmaz. */
html.tke-text-color body :is(
  [class*="text-body"],[class*="text-title"],[class*="text-label"],[class*="text-heading"],
  [class*="text-lead"],[class*="font-caption"],[class*="font-header"],[class*="font-body"],
  [class*="font-subheader"],.text-overflow,.item-card-name,.game-card-name,.avatar-name,
  .chat-friend-name,.groups-list-heading,.game-name,.game-description,.text,.text-name,
  .icon-label,.vote-text,.vote-percentage-label,.playing-counts-label,.info-label,
  .text-truncate-end,.see-all-link-icon,.friends-carousel-display-name,.friend-tile-non-styled-button,
  .friend-tile-dropdown-button,[class*="textIconRowText"],.age-rating-display-name,.text-link,h1,h2,h3,h4,h5,h6
):not(body [class*="tracked"] *):not(body [id*="tracked"] *):not(body [class*="tk-"] *){
  color:var(--tk-text-color)!important;
  text-shadow:0 1px 2px rgba(0,0,0,.55)!important;
}
/* İSTİSNA: Roblox'a ENJEKTE edilen native-benzeri öğeler ("Themes" sol-nav + oyun
   sayfasındaki "Trello" sekmesi) → exclusion onları da kapatıyordu; diğer nav/sekme
   öğeleri gibi tema rengini ALSINLAR. Themes: etiket + ikon (palet svg currentColor). */
html.tke-text-color #tracked-themes-nav-item a span,
html.tke-text-color #tracked-themes-nav-item a svg,
html.tke-text-color #tab-tracked-trello .text-lead{
  color:var(--tk-text-color)!important;
}
html.tke-text-color #tracked-themes-nav-item a span:not(:has(svg)),
html.tke-text-color #tab-tracked-trello .text-lead{
  text-shadow:0 1px 2px rgba(0,0,0,.55)!important;
}
/* Aynı enjekte öğeler için YAZI TİPİ de uygulansın (tke-text-font) — etiketler default kalmasın. */
html.tke-text-font #tracked-themes-nav-item a span,
html.tke-text-font #tab-tracked-trello .text-lead{
  font-family:var(--tk-text-font)!important;
}

/* === YAZI TİPİ (html.tke-text-font, Gelişmiş) ===
   İçerik metninin fontunu değiştirir. İkon font'ları HARİÇ (icon glyph'leri bozulmasın). */
html.tke-text-font body :is(
  [class*="text-body"],[class*="text-title"],[class*="text-label"],[class*="text-heading"],
  [class*="text-lead"],[class*="font-caption"],[class*="font-header"],[class*="font-body"],
  [class*="font-subheader"],.text-overflow,.item-card-name,.game-card-name,.avatar-name,
  .chat-friend-name,.groups-list-heading,.game-name,.game-description,.text,.text-name,
  .icon-label,.vote-text,.vote-percentage-label,.playing-counts-label,.info-label,
  .text-truncate-end,.see-all-link-icon,.friends-carousel-display-name,.friend-tile-non-styled-button,
  .friend-tile-dropdown-button,[class*="textIconRowText"],.age-rating-display-name,.text-link,h1,h2,h3,h4,h5,h6,p
):not([class*="icon-"]):not([class*="Icon"]):not(body [class*="tracked"] *):not(body [id*="tracked"] *):not(body [class*="tk-"] *){
  font-family:var(--tk-text-font)!important;
}

/* ── Communities içerik kartları — daha ŞEFFAF ──
   Arkadaki wallpaper bölgesi koyu olduğu için aynı tint burada daha solid
   görünüyordu. Communities kartlarının tint'ini panel opacity'nin ~%55'ine
   düşür → wallpaper daha çok geçer, diğer sayfalarla görsel olarak eşit
   "cam" hissi verir. (Bu kural card bloğundan SONRA → override eder.) */
body.tk-communities-page .group-profile-header,
body.tk-communities-page .rbx-tabs-horizontal,
body.tk-communities-page .section.group-announcements,
body.tk-communities-page .group-announcements,
body.tk-communities-page group-games > .section,
body.tk-communities-page group-payouts > .section,
body.tk-communities-page group-forums-discovery > .section,
body.tk-communities-page .groups-list-sidebar,
body.tk-communities-page [class*="groups-list-sidebar"]{
  background-color:rgba(var(--tk-panel-rgb,15,16,22),calc(var(--tk-panel-opacity,0.7) * 0.55))!important;
}

/* v1.9.0: Communities ANA İÇERİK panelleri — TAM ŞEFFAF (kullanıcı tercihi: arka tamamen
   geçsin, wallpaper görünsün). Sol community LİSTESİ (.groups-list-sidebar) bu override'ın
   DIŞINDA → kendi frosted tint'ini KORUR. Normal + card-adv modunu ezmek için iki varyant. */
body.tk-communities-page .group-profile-header,
body.tk-communities-page .rbx-tabs-horizontal,
body.tk-communities-page .section.group-announcements,
body.tk-communities-page .group-announcements,
body.tk-communities-page group-games > .section,
body.tk-communities-page group-payouts > .section,
body.tk-communities-page group-forums-discovery > .section,
html.tke-card-adv body.tk-communities-page .group-profile-header,
html.tke-card-adv body.tk-communities-page .rbx-tabs-horizontal,
html.tke-card-adv body.tk-communities-page .section.group-announcements,
html.tke-card-adv body.tk-communities-page .group-announcements,
html.tke-card-adv body.tk-communities-page group-games > .section,
html.tke-card-adv body.tk-communities-page group-payouts > .section,
html.tke-card-adv body.tk-communities-page group-forums-discovery > .section{
  background-color:transparent!important;
  border:none!important;
  box-shadow:none!important;
}

/* v1.9.0: Communities DIŞ PENCERE/KONTEYNER + tüm section wrapper'lar TAM ŞEFFAF.
   #group-container içindeki HER .section (dış kutu + announcements + experiences) +
   .new-list + .group-details + tab-content. Sidebar (.groups-list-sidebar) bir .section
   DEĞİL → bu kuralın dışında, kendi tint'ini korur. */
body.tk-communities-page #group-container .section,
body.tk-communities-page #group-container .new-list,
body.tk-communities-page #group-container .group-details,
body.tk-communities-page #group-container .tab-content,
body.tk-communities-page #group-container .rbx-tab-content,
body.tk-communities-page #group-container [group-about]{
  background-color:transparent!important;
  border:none!important;
  box-shadow:none!important;
}

/* v1.9.0: Communities About/Store sekme çubuğu — TAM ŞEFFAF (kullanıcı: renk görünmesin).
   Çubuk + sekme öğeleri + aktif highlight + başlıklar tümüyle şeffaf (border/underline kalır). */
body.tk-communities-page .rbx-tabs-horizontal .nav-tabs.group-foundation-tabs,
body.tk-communities-page .rbx-tabs-horizontal .rbx-tab,
body.tk-communities-page .rbx-tabs-horizontal .group-tab,
body.tk-communities-page .rbx-tabs-horizontal .rbx-tab.active,
body.tk-communities-page .rbx-tabs-horizontal .rbx-tab-heading,
html.tke-card-adv body.tk-communities-page .rbx-tabs-horizontal .nav-tabs.group-foundation-tabs,
html.tke-card-adv body.tk-communities-page .rbx-tabs-horizontal .rbx-tab,
html.tke-card-adv body.tk-communities-page .rbx-tabs-horizontal .group-tab,
html.tke-card-adv body.tk-communities-page .rbx-tabs-horizontal .rbx-tab.active,
html.tke-card-adv body.tk-communities-page .rbx-tabs-horizontal .rbx-tab-heading{
  background-color:transparent!important;
  box-shadow:none!important;
}

/* v1.9.0: Communities About/Store sekmeleri — ÇERÇEVE ÇİZGİLERİ geri (düzgün buton görünümü).
   Arka plan ŞEFFAF kalır (kullanıcı tercihi: wallpaper görünsün) ama her sekme net bir
   çerçeve + köşe yuvarlaması kazanır; hover/aktif belirginleşir. Specificity bir önceki
   şeffaf kuralı (0,4,1) geçsin diye .rbx-tab .rbx-tab-heading (0,5,1) zinciri kullanıldı. */
body.tk-communities-page .rbx-tabs-horizontal .nav-tabs.group-foundation-tabs{
  gap:8px!important;
}
body.tk-communities-page .rbx-tabs-horizontal .rbx-tab .rbx-tab-heading{
  border:1px solid rgba(255,255,255,.20)!important;
  border-radius:8px!important;
  padding:7px 20px!important;
  transition:background-color .15s,border-color .15s!important;
}
body.tk-communities-page .rbx-tabs-horizontal .rbx-tab:hover .rbx-tab-heading{
  border-color:rgba(255,255,255,.34)!important;
  background-color:rgba(255,255,255,.06)!important;
}
body.tk-communities-page .rbx-tabs-horizontal .rbx-tab.active .rbx-tab-heading{
  border-color:rgba(255,255,255,.45)!important;
  background-color:rgba(255,255,255,.10)!important;
}

/* v1.9.0: Communities sayfasında wallpaper DIM scrim'ini KALDIR → içerik tam şeffaf
   olduğu için arkada SADECE saf wallpaper görünür (kullanıcı: arka plan/karartma gitsin).
   Layer body'nin çocuğu (document.body.prepend). Diğer sayfalarda dim korunur (okunurluk). */
body.tk-communities-page #tracked-wallpaper-layer .twp-dim{
  background:transparent!important;
}
/* Wallpaper'ın kendi opaklık fade'i de kalksın → communities'te TAM parlak saf wallpaper. */
body.tk-communities-page #tracked-wallpaper-layer .twp-media{
  opacity:1!important;
}

/* v1.9.0: Communities İÇERİK KOLONUNDAKİ (.group-details — sidebar HARİÇ) bg-surface /
   rbx-section panel-opaklık tint'ini KES. Universal kart kuralı yüksek :not specificity'siyle
   bunları --tk-panel-opacity'ye bağlıyordu (panel opaklığı değişince koyu alan değişiyordu).
   #group-container (ID) + .group-details ile specificity'yi geçip ŞEFFAF yapıyoruz.
   Sidebar .group-details içinde DEĞİL → tint'i korunur. */
body.tk-communities-page #group-container .group-details [class*="bg-surface-100"],
body.tk-communities-page #group-container .group-details [class*="bg-surface-200"],
body.tk-communities-page #group-container .group-details .rbx-section,
body.tk-communities-page #group-container .group-details .section.rbx-section,
body.tk-communities-page #group-container .group-details [class*="content-section"]{
  background-color:transparent!important;
  border:none!important;
  box-shadow:none!important;
}

/* v1.9.0: Communities İÇERİK KOLONU (.group-details) — HER alt elementin arka planı ŞEFFAF
   (kullanıcı: tamamen şeffaf, sadece wallpaper). Hangi element panel-opaklık tint'i taşıyorsa
   ne olursa olsun temizler. Küçük UI HARİÇ: görsel/ikon/input/buton/svg + bg-surface-300/400
   pill'leri (810K Members/Supporter Rank). Sidebar .group-details DIŞINDA → korunur.
   #group-container (ID) ile maksimum specificity → universal panel-opaklık kuralını ezer. */
body.tk-communities-page #group-container .group-details,
body.tk-communities-page #group-container .group-details *:not(img):not(input):not(svg):not(button):not(path):not([class*="thumbnail"]):not([class*="bg-surface-300"]):not([class*="bg-surface-400"]):not([class*="icon-"]):not([class*="Icon"]){
  background-color:transparent!important;
  /* "Mor arka zemin" = koyu panel tint'i + card-adv frosted blur'un sıcak wallpaper'ı
     bulanıklaştırıp morarması. İçerik kolonunda hem bg görseli/gradient'i hem blur'u KES
     → arka zemin baştan sona temiz/keskin şeffaf (footer bölgesiyle aynı). */
  background-image:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}

/* v1.9.0 SON DARBE: Communities ANA İÇERİK (#container-main) altındaki HER eleman —
   arka plan + bg görsel + frosted blur TAMAMEN kalkar. Kullanıcı DevTools'ta #container-main'i
   seçip "tamamen kaldır" dedi. SIDEBAR (.groups-list-sidebar) ve TÜM alt ağacı :not ile HARİÇ
   → frosted hali aynen korunur. Küçük UI (görsel/ikon/input/buton/pill) bg'si korunur.
   #container-main (ID) → tüm panel-opaklık + card-adv kurallarını ezer. */
body.tk-communities-page #container-main *:not(img):not(input):not(svg):not(button):not(path):not([class*="thumbnail"]):not([class*="bg-surface-300"]):not([class*="bg-surface-400"]):not([class*="icon-"]):not([class*="Icon"]):not(.groups-list-sidebar):not(.groups-list-sidebar *){
  background-color:transparent!important;
  background-image:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}

/* ── Friends sayfası paneli — ŞEFFAF ──
   Friends'te .tab-content, .rbx-tabs-horizontal'ın İÇİNDE (kardeş değil) →
   .rbx-tabs-horizontal hem sekmeleri hem istekleri saran tek kart oluyor.
   .rbx-scrollable-tabs-horizontal Friends'e özel; onu + içerik wrapper'larını
   şeffaf yap → büyük panel kalkar, istek kartları (.avatar-card-container)
   wallpaper üstünde kendi kartları olarak kalır. (Communities tab kartı etkilenmez.) */
body .rbx-scrollable-tabs-horizontal,
body .friends-content,
body .friends-content.section{
  background-color:transparent!important;
  border:none!important;
  box-shadow:none!important;
}
/* İstek kartları (.avatar-card-container) — HAFİF CAM: büyük panel şeffaf ama
   tek tek kartlar belli belirsiz tint + ince border + radius alsın → wallpaper
   üstünde subtle cam kart hissi. Tint panel opacity'nin ~%40'ı (çok hafif). */
body .avatar-card-container,
body .avatar-card-container.disabled{
  background-color:rgba(var(--tk-panel-rgb,15,16,22),calc(var(--tk-panel-opacity,0.7) * 0.4))!important;
  border:1px solid rgba(255,255,255,.06)!important;
  border-radius:12px!important;
  box-shadow:none!important;
  backdrop-filter:blur(24px)!important;
  -webkit-backdrop-filter:blur(24px)!important;
}
/* İstek kartı BUTON KONTEYNERİ (.avatar-card-btns) — aynı cam stil: tint + blur
   + border + radius. Butonların KENDİSİ native kalır (Ignore/Accept Roblox stili). */
body .avatar-card-btns{
  background-color:rgba(var(--tk-panel-rgb,15,16,22),calc(var(--tk-panel-opacity,0.7) * 0.4))!important;
  border:1px solid rgba(255,255,255,.06)!important;
  border-radius:12px!important;
  box-shadow:none!important;
  backdrop-filter:blur(8px)!important;
  -webkit-backdrop-filter:blur(8px)!important;
}

/* Avatar editör (#content.seven-column): ÖZEL PANEL/KART YOK — şeffaf bırakıldı.
   #content zaten genel wrapper transparent listesinde; RoPro kendi düzenini
   uygular, biz dokunmayız. (Cam panel denemesi geri alındı: RoPro çekişmesi,
   backdrop fixed-eleman bug'ı ve üst boş bant sorunları nedeniyle.) */

/* ── FOOTER override: TAM ŞEFFAF (üst içerikle aynı transparency) ──
   Üst sayfada wrapper'lar (container-main vs) zaten şeffaf, wallpaper net
   görünüyor. Footer da kart bg tinti ile koyu kalıyor → görsel uyumsuzluk.
   Footer'ı da tamamen şeffaf yap: bg + border + shadow + radius hepsi sıfır.
   Sonuç: footer link'leri wallpaper üzerinde direkt görünür, üst-alt
   transparency tutarlılığı sağlanır. */
body footer:not([class*="container-footer-mini"]),
body .container-footer,
body [class*="container-footer"]:not([class*="container-footer-mini"]),
body [class*="page-footer"],
body [class*="PageFooter"]{
  background-color:transparent!important;
  background-image:none!important;
  border:none!important;
  box-shadow:none!important;
  border-radius:0!important;
}
/* ── Footer İÇ ayrım çizgileri ──
   Roblox footer içinde footer-links ile copyright/language-selector row'u
   arasına .copyright-container'a border-top (veya .footer-links'e
   border-bottom) ekliyor → yatay ince hat. Bu hat'ı da nötralize et. */
body footer .copyright-container,
body footer [class*="copyright-container"],
body footer .footer-links,
body footer [class*="footer-links"],
body footer .footer,
body footer [class*="footer-note"],
body .container-footer .copyright-container,
body .container-footer [class*="copyright-container"],
body .container-footer .footer-links,
body .container-footer [class*="footer-links"],
body .container-footer .footer,
body [class*="container-footer"] .copyright-container,
body [class*="container-footer"] [class*="copyright-container"],
body [class*="container-footer"] .footer-links,
body [class*="container-footer"] [class*="footer-links"]{
  background-color:transparent!important;
  background-image:none!important;
  border:none!important;
  border-top:none!important;
  border-bottom:none!important;
  box-shadow:none!important;
}
body footer .copyright-container::before,
body footer .copyright-container::after,
body footer [class*="copyright-container"]::before,
body footer [class*="copyright-container"]::after,
body footer .footer-links::before,
body footer .footer-links::after,
body footer [class*="footer-links"]::before,
body footer [class*="footer-links"]::after{
  display:none!important;
  content:none!important;
  border:none!important;
  background:transparent!important;
}

/* ── WRAPPER'lar (şeffaf, kart container'ı olmasın) ── */
body main.container-main,
body #container-main,
body .container-main,
body #content,
body .content,
body #group-container,
body .group-details-container,
body .group-details-container-desktop-and-tablet,
body .group-details-container-mobile,
body .group-details,
body .tab-content.rbx-tab-content,
body .rbx-tabs-horizontal[data-place-id],
body .right-panel.seven-column,
body .right-wrapper-placeholder,
body .right-wrapper,
body .tab-wrapper,
body .rbx-tabs-horizontal-seven-column,
body.tk-communities-page .nav-tabs.group-foundation-tabs{
  background-color:transparent!important;
  border:none!important;
  box-shadow:none!important;
  /* Dış konteynerlerde frosted blur kalmasın (mor arka zemin kaynağı olabilir).
     Sidebar bu listede DEĞİL → kendi frosted görünümü korunur. */
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}

/* ── bg-surface-300 / bg-surface-400 (küçük pill / badge UI) ──
   kart olmamalı, sadece Roblox'un kendi inline tint'i kalsın */
body [class*="bg-surface-300"],
body [class*="bg-surface-400"]{
  border:none!important;
  border-radius:inherit!important;
  box-shadow:none!important;
}

/* ── Communities active item highlight ──
   .groups-list-item.active'in Roblox default bg-surface highlight'ı yukarıdaki
   kuralda transparent'a düşmemeli; subtle white tint ile aktifliği belli et */
body .groups-list-item.active{
  background-color:rgba(255,255,255,.07)!important;
  border-radius:8px!important;
  border:none!important;
}
body .groups-list-item:hover:not(.active){
  background-color:rgba(255,255,255,.04)!important;
  border-radius:8px!important;
}
/* ── Tab bar butonları (Recent/Avatars/Body... ve diğer rbx-tab sekmeleri) ──
   NATIVE GÖRÜNÜM: kutu/pill YOK. Roblox aktif sekmeye kendi alt-çizgisini
   koyuyor (.rbx-tab.active), ona dokunmuyoruz. Sadece:
     • çok hafif hover (kutu değil, ince ton)
     • focus ring'i sustur (yeşil/mavi outline flash'i gitsin)
   Böylece sekmeler temiz, native ve estetik kalır. */
body .rbx-tabs-horizontal .rbx-tab .rbx-tab-heading,
body .rbx-tabs-horizontal .rbx-tab > a{
  background-color:transparent!important;
  border-radius:6px!important;
  box-shadow:none!important;
  transition:background-color .12s ease,color .12s ease!important;
}
body .rbx-tabs-horizontal .rbx-tab:not(.active):hover .rbx-tab-heading,
body .rbx-tabs-horizontal .rbx-tab:not(.active):hover > a{
  background-color:rgba(255,255,255,.04)!important;
}
/* Aktif sekme: arka plan kutusu YOK — Roblox'un native alt-çizgisi kalsın */
body .rbx-tabs-horizontal .rbx-tab.active .rbx-tab-heading,
body .rbx-tabs-horizontal .rbx-tab.active > a{
  background-color:transparent!important;
}
/* Focus ring sustur (tıklayınca yeşil/mavi outline flash'ı) */
body .rbx-tabs-horizontal .rbx-tab-heading:focus,
body .rbx-tabs-horizontal .rbx-tab-heading:focus-visible,
body .rbx-tabs-horizontal .rbx-tab > a:focus,
body .rbx-tabs-horizontal .rbx-tab > a:focus-visible{
  outline:none!important;
  box-shadow:none!important;
}
/* Tab bar altındaki full-width RAIL çizgisi (ul.nav-tabs border-bottom) —
   koyu temada tab satırı altında "daha koyu bant/çizgi" gibi görünüyor.
   Kaldır → bant gider, kart kesintisiz tek parça olur. Aktif sekmenin KENDİ
   alt-çizgisi (.rbx-tab.active) ayrı, korunur. */
body .rbx-tabs-horizontal .nav-tabs,
body .rbx-tabs-horizontal #horizontal-tabs,
body .rbx-tabs-horizontal ul.nav{
  border-bottom:none!important;
  border-top:none!important;
  box-shadow:none!important;
}
/* groups-list-sidebar iç scrollbar gold yerine subtle (gold sayfa scrollbar'ı ile karışmasın) */
body.tk-communities-page .groups-list-sidebar,
body.tk-communities-page [class*="groups-list-sidebar"],
body.tk-communities-page .groups-list-sidebar *,
body.tk-communities-page [class*="groups-list-sidebar"] *{
  scrollbar-width:thin!important;
  scrollbar-color:rgba(255,255,255,.12) transparent!important;
}
body.tk-communities-page .groups-list-sidebar ::-webkit-scrollbar,
body.tk-communities-page [class*="groups-list-sidebar"] ::-webkit-scrollbar{
  width:6px!important;height:6px!important;
}
body.tk-communities-page .groups-list-sidebar ::-webkit-scrollbar-track,
body.tk-communities-page [class*="groups-list-sidebar"] ::-webkit-scrollbar-track{
  background:transparent!important;
}
body.tk-communities-page .groups-list-sidebar ::-webkit-scrollbar-thumb,
body.tk-communities-page [class*="groups-list-sidebar"] ::-webkit-scrollbar-thumb{
  background:rgba(255,255,255,.12)!important;
  border:none!important;
  border-radius:6px!important;
}
body.tk-communities-page .groups-list-sidebar ::-webkit-scrollbar-thumb:hover,
body.tk-communities-page [class*="groups-list-sidebar"] ::-webkit-scrollbar-thumb:hover{
  background:rgba(255,255,255,.22)!important;
}

/* v1.9.0: Chat paneli — TAM ŞEFFAF (bg + border + shadow tümüyle kaldırıldı).
   Collapsed durumda chat-header çubuğunun üst kenarı 1px border olarak
   görünüyor ve "ince çizgi" olarak algılanıyordu. Tüm görsel çerçeve
   kaldırıldı; chat içeriği (yazılar, ikonlar, friend list) kendi renkleriyle
   wallpaper üzerinde direkt görünür. Chat işlevselliği etkilenmez. */
#chat-container,
.chat-container,
[class*="chat-container"],
[class*="ChatContainer"],
[class*="WebChat"]{
  background-color:transparent!important;
  background-image:none!important;
  border:none!important;
  box-shadow:none!important;
}
/* Chat İÇİ — border'lar + bg'ler hep şeffaf (tüm chat görsel çerçevesi gider).
   '.border-bottom' utility class'ı .chat-search altında 1px hat çiziyordu;
   .chat-windows-header / .chat-header / .chat-body / .chat-main de Roblox'tan
   bg ve border alabiliyor. Hepsini nötralize et. */
#chat-container .border-bottom,
.chat-container .border-bottom,
[class*="chat-container"] .border-bottom,
#chat-container [class*="border-bottom"],
.chat-container [class*="border-bottom"],
[class*="chat-container"] [class*="border-bottom"],
#chat-container .chat-search,
.chat-container .chat-search,
[class*="chat-container"] [class*="chat-search"],
#chat-container .chat-windows-header,
.chat-container .chat-windows-header,
[class*="chat-container"] [class*="chat-windows-header"],
#chat-container .chat-header,
.chat-container .chat-header,
[class*="chat-container"] [class*="chat-header"]:not(.chat-header-action):not(.chat-header-label),
#chat-container .chat-body,
.chat-container .chat-body,
[class*="chat-container"] [class*="chat-body"],
#chat-container .chat-main,
.chat-container .chat-main,
[class*="chat-container"] [class*="chat-main"],
#chat-container .chat-friend-list,
[class*="chat-container"] [class*="chat-friend-list"]{
  background-color:transparent!important;
  background-image:none!important;
  border:none!important;
  border-top:none!important;
  border-bottom:none!important;
  border-left:none!important;
  border-right:none!important;
  box-shadow:none!important;
}
#chat-container .border-bottom::before,
#chat-container .border-bottom::after,
[class*="chat-container"] [class*="border-bottom"]::before,
[class*="chat-container"] [class*="border-bottom"]::after,
#chat-container .chat-search::before,
#chat-container .chat-search::after{
  display:none!important;
  content:none!important;
  border:none!important;
  background:transparent!important;
}
/* ── Chat — APPLE-STYLE FROSTED CAM DOKUNUŞ ──
   Çok şeffaftı; belirgin bir cam kimliği veriyoruz. backdrop-filter container'a
   KONMAZ (chat dialog/conversation pencerelerinin float'unu kırıyor) — sadece
   header bar'a (içinde fixed eleman yok, güvenli). Container'a tint + border +
   üst-yuvarlak radius + yukarı shadow; header'a frosted blur + accent alt çizgi.
   Collapsed "Chat" pill'i böylece frosted cam görünür. (Bu kurallar yukarıdaki
   "tam şeffaf" bloğundan SONRA → override eder.) */
#chat-container,
.chat-container,
[class*="chat-container"]{
  background-color:transparent!important;
  border:none!important;
  border-radius:0!important;
  box-shadow:none!important;
}
#chat-container .chat-windows-header,
#chat-container .chat-header,
.chat-container .chat-windows-header,
.chat-container .chat-header,
[class*="chat-container"] [class*="chat-windows-header"],
[class*="chat-container"] [class*="chat-header"]:not(.chat-header-action):not(.chat-header-label){
  background-color:rgba(22,24,30,.26)!important;
  backdrop-filter:blur(28px)!important;
  -webkit-backdrop-filter:blur(28px)!important;
  border-bottom:1px solid rgba(255,255,255,.06)!important;
  border-radius:0!important;
}
/* "Chat" başlığı — hafif harf aralığı, premium his */
#chat-container .chat-header-title,
.chat-container .chat-header-title{
  letter-spacing:.3px!important;
  background-color:transparent!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}
/* Chat custom scrollbar (mCustomScrollbar) — temayla uyumlu subtle frosted:
   yarı saydam beyaz thumb, ince track, hover'da belirginleşir. */
#chat-container .mCSB_scrollTools .mCSB_dragger .mCSB_dragger_bar,
.chat-container .mCSB_scrollTools .mCSB_dragger .mCSB_dragger_bar{
  background-color:rgba(255,255,255,.28)!important;
  border-radius:8px!important;
  width:6px!important;
}
#chat-container .mCSB_scrollTools .mCSB_draggerRail,
.chat-container .mCSB_scrollTools .mCSB_draggerRail{
  background-color:rgba(255,255,255,.06)!important;
  width:2px!important;
  border-radius:8px!important;
}
#chat-container .mCSB_scrollTools .mCSB_dragger:hover .mCSB_dragger_bar,
#chat-container .mCSB_scrollTools .mCSB_dragger:active .mCSB_dragger_bar,
.chat-container .mCSB_scrollTools .mCSB_dragger:hover .mCSB_dragger_bar{
  background-color:rgba(255,255,255,.45)!important;
}
/* Scrollbar kartlara yapışmasın — içeriğe sağdan boşluk (lane), scrollbar orada
   durur. Kartlar sola çekilir, scrollbar üstlerine binmez. */
#chat-container #chat-friends,
#chat-container .chat-friends{
  padding-right:10px!important;
  box-sizing:border-box!important;
}
#chat-container .mCSB_scrollTools{
  right:1px!important;
}
/* Chat GÖVDESİ (header + arama + arkadaş listesi) frosted cam — #chat-main'e
   tint + blur. #dialogs (konuşma pencereleri) #chat-main'in KARDEŞİ olduğu için
   blur onları etkilemez (float kırılmaz). Açık chat artık "çok şeffaf" değil,
   belirgin frosted cam. */
#chat-container #chat-main,
#chat-container .chat-main,
.chat-container .chat-main,
[class*="chat-container"] [class*="chat-main"]{
  background-color:rgba(22,24,30,.26)!important;
  backdrop-filter:blur(28px)!important;
  -webkit-backdrop-filter:blur(28px)!important;
}
/* Chat KONUŞMA penceresi — sıra sıra frosted cam (kullanıcı element element veriyor).
   ÖNEMLİ: bu pencere içerik üstünde yüzüyor → tint YETERİNCE opak olmalı +
   backdrop blur, ki arka kartlar keskin geçmesin (blur'lanıp yumuşasın). İç
   elemanları transparent YAPMIYORUZ (önceki bug oydu). */
/* Konuşma DIŞ kabı (.dialog-container) Roblox'tan SOLID koyu (rgb(39,41,48)) bg alıyor →
   frosted dialog-body'nin ARKASINI kapatıp "şeffaf/blur" görünmesini engelliyordu. Şeffaf yap
   ki frosted gövde wallpaper'ı (blurlu) göstersin. */
#dialogs .dialog-container,
.chat-container .dialog-container,
[class*="chat-container"] .dialog-container{
  background-color:transparent!important;
}
/* 1) .dialog-body — mesaj alanı */
#dialogs .dialog-body,
.chat-container .dialog-body,
[class*="chat-container"] .dialog-body{
  background-color:rgba(22,24,30,.26)!important;
  backdrop-filter:blur(28px)!important;
  -webkit-backdrop-filter:blur(28px)!important;
}
/* 2) .dialog-messages (mesaj listesi) — şeffaf, dialog-body frost'u görünsün.
   (osa-context-card'a dokunulmuyor — Roblox native bırakıldı.) */
#dialogs .dialog-messages,
.chat-container .dialog-messages{
  background-color:transparent!important;
}
/* 3) .dialog-header — konuşma penceresi başlığı (isim + kapat/info ikonları).
   Floating pencere → body ile aynı opak-frosted (.72) ki arka geçmesin.
   Üst-yuvarlak köşe + accent alt çizgi. */
#dialogs .dialog-header,
#dialogs .chat-windows-header,
.chat-container #dialogs .chat-windows-header,
.chat-container .dialog-header,
[class*="chat-container"] .dialog-header{
  background-color:rgba(22,24,30,.26)!important;
  backdrop-filter:blur(28px)!important;
  -webkit-backdrop-filter:blur(28px)!important;
  border-bottom:1px solid rgba(255,255,255,.10)!important;
  border-radius:0!important;
}
/* 4) #dialog-input — "Send a message" yazı alanı. Body ile aynı frosted,
   üstte accent çizgi (input'u gövdeden ayırır). Yazı okunur kalsın. */
/* Send-message DIŞ kabı (.dialog-input-container) frosted → gövde-input arası "ince boşluk"
   (şeffaf kaptan sızan wallpaper) kapanır + Roblox '.border-top' 1px utility çizgisi kalkar. */
#dialogs .dialog-input-container,
.chat-container .dialog-input-container,
[class*="chat-container"] .dialog-input-container{
  background-color:rgba(22,24,30,.26)!important;
  backdrop-filter:blur(28px)!important;
  -webkit-backdrop-filter:blur(28px)!important;
  border-top:none!important;
}
/* Textarea'nın KENDİSİ şeffaf (kap zaten frosted → çift karartma yok); köşeler sert. */
#dialogs #dialog-input,
#dialogs .dialog-input,
.chat-container .dialog-input,
[class*="chat-container"] .dialog-input{
  background-color:transparent!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
  border:none!important;
  border-radius:0!important;
}
/* 5) Başlık metni (.dialog-header-title) + label kabı — TEMİZ: kendi bg/kutu/
   border'ı olmasın, frosted header üstünde sadece metin dursun (title bug fix).
   Başlığın kendine backdrop-filter VERME (header zaten frosted; çift blur/box
   bug yaratır). */
#dialogs .dialog-header .chat-header-label,
#dialogs .dialog-header-title,
#dialogs .dialog-header .chat-header-title,
.chat-container .dialog-header .chat-header-label,
.chat-container .dialog-header-title{
  background-color:transparent!important;
  border:none!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
  border-radius:0!important;
}
/* 6) Chat Details paneli (Members / üye listesi) — wrapper class'ı bilinmiyordu
   (.dialog-details tutmadı). :has() ile "içinde .details-members-container olan"
   scroll wrapper'ı yakalayıp frost. İç üye satırları/label'lar şeffaf (frost görünsün). */
#dialogs .rbx-scrollbar:has(.details-members-container),
#dialogs .mCustomScrollBox:has(.details-members-container),
#dialogs .mCSB_container:has(.details-members-container),
.chat-container .rbx-scrollbar:has(.details-members-container){
  background-color:rgba(22,24,30,.26)!important;
  backdrop-filter:blur(28px)!important;
  -webkit-backdrop-filter:blur(28px)!important;
}
#dialogs .details-members-container,
#dialogs .participant-list,
#dialogs .friend-container,
#dialogs .details-members-label,
#dialogs .friend-info-action,
.chat-container .details-members-container,
.chat-container .participant-list{
  background-color:transparent!important;
}
/* 7) Back ok'unun arkasındaki renk kutusunu temizle — SADECE KAP elemanlar.
   DİKKAT: ikon span'ları (.icon-chat-back / .icon-chat-close-white vs.) Roblox
   sprite'ı olan BACKGROUND-IMAGE ile çizilir → onlara background-image:none
   YAPILMAZ, yoksa ikon kaybolur (X/back/info gider). Bu yüzden sadece kap
   elemanların bg-color/border/blur'unu sıfırlıyoruz, ikona DOKUNMUYORUZ. */
#chat-container .chat-header-action,
#chat-container *:has(> .icon-chat-back){
  background-color:transparent!important;
  border:none!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
  border-radius:0!important;
}
/* 8) .friend-container (Details üye satırları) — subtle cam satır: hafif tint +
   ince border + radius. Kendi blur'u YOK (panel zaten frosted; satır başına
   nested blur gereksiz/ağır). Satır arası border-bottom çizgisi kalkar. */
/* NOT: #chat-container bağımlılığı kaldırıldı (dialog portal'da olabilir →
   eşleşmiyordu). .friend-container chat'e özgü bir class; doğrudan hedeflenir.
   Tint belirgin (.13) ki koyu zeminde net görünsün. */
body .friend-container{
  background-color:rgba(255,255,255,.13)!important;
  border:1px solid rgba(255,255,255,.14)!important;
  border-radius:0!important;
  box-shadow:none!important;
  backdrop-filter:blur(12px)!important;
  -webkit-backdrop-filter:blur(12px)!important;
}
body .friend-container .friend-info-action,
body .friend-container .border-bottom{
  border-bottom:none!important;
  background-color:transparent!important;
}
/* 9) "Add Friends" satırı (.add-friends-option) — friend-container ile aynı
   subtle cam satır. Label'ın border-bottom çizgisi kalkar. + daire ikonunun
   background-image'ine DOKUNULMAZ (yoksa + ikonu kaybolur). */
#chat-container .add-friends-option,
#chat-container #dialogs .add-friends-option{
  background-color:rgba(255,255,255,.07)!important;
  border:1px solid rgba(255,255,255,.10)!important;
  border-radius:0!important;
  box-shadow:none!important;
  backdrop-filter:blur(12px)!important;
  -webkit-backdrop-filter:blur(12px)!important;
}
#chat-container .add-friends-label{
  background-color:transparent!important;
  border-bottom:none!important;
  border:none!important;
}
/* 10) Chat arkadaş/konuşma listesi satırları (.chat-friend-container) — aynı
   açık frosted cam kart + satır arası border-bottom çizgileri kalksın.
   (#chat-main zaten blur backdrop sağlıyor; satır başına hafif blur eklenir.) */
body .chat-friend-container{
  background-color:rgba(255,255,255,.13)!important;
  border:1px solid rgba(255,255,255,.14)!important;
  border-radius:0!important;
  box-shadow:none!important;
  backdrop-filter:blur(10px)!important;
  -webkit-backdrop-filter:blur(10px)!important;
}
body .chat-friend-info,
body .chat-friend-container .border-bottom{
  border-bottom:none!important;
  background-color:transparent!important;
}
/* Backdrop-filter (cam efekti) SADECE kullanıcı blur > 0 ayarladığında uygulanır.
   Sebep: blur(0px) bile yeni stacking context yaratır → Roblox'un nested SPA
   sayfalarında (özellikle /communities) position:absolute ve z-index'li child'ları
   kırma riski var. Communities kartlarına backdrop-filter UYGULANMIYOR (güvenli
   tarafta kalalım); diğer sayfalarda kart-tabanlı tasarımla beraber backdrop-filter
   her karta uygulanır — her kart kendi frosted glass'ına sahip olur. */
html.tke-glass body:not(.tk-communities-page) [class*="bg-surface-100"]:not(.left-nav):not([class*="alert"]):not([class*="notification"]):not([class*="banner"]):not([role="alert"]):not([role="status"]):not([role="dialog"]):not([role="menu"]):not([role="listbox"]):not([role="tooltip"]),
html.tke-glass body:not(.tk-communities-page) [class*="bg-surface-200"]:not(.left-nav):not([class*="alert"]):not([class*="notification"]):not([class*="banner"]):not([role="alert"]):not([role="status"]):not([role="dialog"]):not([role="menu"]):not([role="listbox"]):not([role="tooltip"]),
html.tke-glass body:not(.tk-communities-page) .rbx-section,
html.tke-glass body:not(.tk-communities-page) .section.rbx-section,
html.tke-glass body:not(.tk-communities-page) .rbx-page-content,
html.tke-glass body:not(.tk-communities-page) [class*="content-section"]:not(.left-nav),
html.tke-glass body:not(.tk-communities-page) [class*="ContentSection"]:not(.left-nav),
html.tke-glass body:not(.tk-communities-page) [class*="recommended"]:not([class*="recommended-item"]):not([class*="creator"]):not(a):not(.left-nav),
html.tke-glass body:not(.tk-communities-page) [class*="Recommended"]:not([class*="Item"]):not([class*="reator"]):not(a):not(.left-nav),
html.tke-glass body:not(.tk-communities-page) footer:not([class*="container-footer-mini"]),
html.tke-glass body:not(.tk-communities-page) .container-footer,
html.tke-glass body:not(.tk-communities-page) [class*="container-footer"]:not([class*="container-footer-mini"]),
html.tke-glass body:not(.tk-communities-page) [class*="page-footer"],
html.tke-glass body:not(.tk-communities-page) [class*="PageFooter"]{
  backdrop-filter:blur(var(--tk-panel-blur,8px))!important;
  -webkit-backdrop-filter:blur(var(--tk-panel-blur,8px))!important;
}
.alert,.alert-warning,.alert-danger,.alert-success,.alert-info{
  background-color:revert!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}
[class*="bg-surface"]:not(.left-nav):not([class*="alert"]):not([class*="notification"]):not([class*="banner"]):not([role="alert"]):not([role="status"]):not([role="dialog"]):not([role="menu"]):not([role="listbox"]):not([role="tooltip"]){
  border:none!important;
  box-shadow:none!important;
  outline:none!important;
}
/* ── Kart caption / isim / fiyat — iç border sıfırla ── */
.item-card-caption,.item-card-caption *,
.item-card-name,.item-card-name-link,.item-card-price,
.game-card-info,.game-card-name,.game-card-price-container{
  border:none!important;
  box-shadow:none!important;
  outline:none!important;
  background-color:transparent!important;
}
/* ── Kart çerçeve: sadece dış kart elementini hedefle (exact class) ── */
html.tke-frame .item-card,
html.tke-frame .game-card-thumb-container,
html.tke-frame [class*="GameTile"],html.tke-frame [class*="gameTile"],
html.tke-frame [class*="ItemCard"],
html.tke-frame [class*="CatalogItem"],html.tke-frame [class*="catalog-item"],
html.tke-frame .thumbnail-2d-container:not(.no-background-thumbnail){
  border-radius:12px!important;
  overflow:hidden!important;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.09),
    0 0 0 1px rgba(0,0,0,.65),
    0 0 0 2.5px rgba(155,160,195,.20),
    0 4px 18px rgba(0,0,0,.52)!important;
  transition:box-shadow .16s ease!important;
}
html.tke-frame .item-card:hover,
html.tke-frame .game-card-thumb-container:hover,
html.tke-frame [class*="GameTile"]:hover,html.tke-frame [class*="gameTile"]:hover,
html.tke-frame [class*="ItemCard"]:hover,
html.tke-frame [class*="CatalogItem"]:hover,
html.tke-frame .thumbnail-2d-container:not(.no-background-thumbnail):hover{
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.16),
    0 0 0 1px rgba(0,0,0,.72),
    0 0 0 2.5px rgba(195,205,255,.28),
    0 6px 24px rgba(0,0,0,.6)!important;
}
html.tke-frame .item-card img,
html.tke-frame .game-card-thumb-container img{
  transition:filter .16s ease!important;
}
html.tke-frame .item-card:hover img,
html.tke-frame .game-card-thumb-container:hover img{
  filter:brightness(1.07)!important;
}
.tto-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.tto-toggle-pill{position:relative;width:34px;height:20px;flex-shrink:0;cursor:pointer;}
.tto-toggle-pill input{position:absolute;opacity:0;width:0;height:0;}
.tto-toggle-track{position:absolute;inset:0;background:rgba(255,255,255,.12);border-radius:10px;transition:background .2s;}
.tto-toggle-pill input:checked~.tto-toggle-track{background:rgba(139,111,71,.75);}
.tto-toggle-thumb{position:absolute;width:14px;height:14px;background:#f5f0e8;border-radius:50%;top:3px;left:3px;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.4);}
.tto-toggle-pill input:checked~.tto-toggle-thumb{left:17px;}
`;

  document.head.appendChild(s);
}

// ── Sidebar helpers ───────────────────────────────────────────
function getLinkPathname(a) {
  try { return new URL(a.href, location.origin).pathname; } catch { return ''; }
}

// Roblox İngilizce-DIŞI dillerde URL'lere /de/, /tr/, /fr/ gibi LOCALE öneki ekler (ör. /de/home).
// Bu yüzden TAM-yol eşleşmesi (/home) İngilizce-dışında çuvallıyordu → yolun SON segmentine bak
// (/de/home → "home", /my/avatar → "avatar") → her dilde çalışır.
const NAV_LAST = new Set(['home', 'profile', 'friends', 'avatar', 'inventory', 'trade', 'messages']);
function navSeg(a) {
  const p = getLinkPathname(a).replace(/\/+$/, '');
  return p.slice(p.lastIndexOf('/') + 1);
}
// SOL sidebar = EN ÇOK farklı nav-link (home/profile/friends/...) içeren <ul>. Tek eşleşmeyle
// YETİNME: üst-sağ hesap menüsü de profile/avatar içerebilir → oraya yanlış enjekte olurdu.
// Sol sidebar her zaman en çoğunu (5-7) içerir, üst menüler az → en yüksek sayanı seç.
function findSidebarUL() {
  let best = null, bestCount = 0;
  for (const ul of document.querySelectorAll('ul')) {
    const lis = ul.querySelectorAll(':scope > li');
    if (lis.length < 4) continue;
    const seen = new Set();
    for (const li of lis) {
      const a = li.querySelector('a');
      if (!a) continue;
      const seg = navSeg(a);
      if (NAV_LAST.has(seg)) seen.add(seg);
    }
    if (seen.size > bestCount) { bestCount = seen.size; best = ul; }
  }
  return bestCount >= 2 ? best : null;
}

function getSidebarWidth() {
  // 1) Bizim inject ettiğimiz Themes button'dan yukarı yürü
  const item = document.getElementById(SIDEBAR_ID);
  if (item) {
    let el = item.parentElement;
    while (el && el !== document.body) {
      const r = el.getBoundingClientRect();
      if (r.left <= 5 && r.width > 50 && r.width < 400) return Math.round(r.right);
      el = el.parentElement;
    }
  }
  // 2) Bizim button yoksa (hash routing erken açılış) → sidebar UL'i direkt bul
  const ul = findSidebarUL();
  if (ul) {
    let el = ul;
    while (el && el !== document.body) {
      const r = el.getBoundingClientRect();
      if (r.left <= 5 && r.width > 50 && r.width < 400) return Math.round(r.right);
      el = el.parentElement;
    }
  }
  // 3) Generic Roblox left-nav selector'ları
  for (const sel of ['.left-nav', 'nav.left-col', 'nav[class*="left"]', '[class*="left-nav"]']) {
    const el = document.querySelector(sel);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.left <= 5 && r.width > 50 && r.width < 400) return Math.round(r.right);
    }
  }
  return 230;
}

function getTopbarHeight() {
  const candidates = document.querySelectorAll('header, nav, [class*="header"], [class*="topbar"], [class*="navbar"], [class*="top-nav"]');
  for (const el of candidates) {
    const r  = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if ((st.position === 'fixed' || st.position === 'sticky') && r.top <= 2 && r.height > 20 && r.height < 120) {
      return Math.round(r.bottom);
    }
  }
  return 60;
}

// v1.9.0: Browser scrollbar gerçek genişliğini ölç (15-17px Chrome, 0px Mac overlay, vb.)
// window.innerWidth = scrollbar dahil, documentElement.clientWidth = scrollbar hariç → fark
function getScrollbarWidth() {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

// Panel'in --tto-left, --tto-top, --tto-right CSS değişkenlerini güncel ölçümle senkronize tutar.
// 0/100/400/1500ms'de yeniden ölçer + window resize'da tetiklenir.
function applyPanelLayoutVars(panelEl) {
  if (!panelEl) return;
  const update = () => {
    if (!panelEl.isConnected) return;
    if (document.hidden) return;
    const sw = getSidebarWidth();
    const th = getTopbarHeight();
    const sb = getScrollbarWidth();
    panelEl.style.setProperty('--tto-left',  `${sw}px`);
    panelEl.style.setProperty('--tto-top',   `${th}px`);
    panelEl.style.setProperty('--tto-right', `${sb}px`);  // Roblox scrollbar tam görünür kalsın
  };
  update();
  requestAnimationFrame(update);
  setTimeout(update, 100);
  setTimeout(update, 400);
  setTimeout(update, 1500);
  const onResize = () => update();
  window.addEventListener('resize', onResize);
  panelEl._removeLayoutResize = () => window.removeEventListener('resize', onResize);
}

const PALETTE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`;
const CHEV_L_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>`;
const CHEV_R_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>`;

// Themes overlay SVG ikonları — module-level (her openThemesPage çağrısında yeniden allocate edilmesin)
const TTO_CHEVRON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const TTO_ICO_THEME  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`;
const TTO_ICO_TUNE   = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`;
const TTO_ICO_WP     = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
const TTO_ICO_PANEL  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
const TTO_ICO_PAGES  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
const TTO_ICO_SHARE  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
const TTO_ICO_EXPORT = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

const I = {
  folder:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  sliders: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
  trash:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  upload:  `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  image:   `<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  imgTag:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  vidTag:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
};

function injectSidebarItem() {
  if (document.getElementById(SIDEBAR_ID)) return;
  const ul = findSidebarUL();
  if (!ul) return;

  const allLis = [...ul.querySelectorAll(':scope > li')];
  const currentPath = location.pathname;

  const refLi = allLis.find(li2 => {
    const a2 = li2.querySelector('a');
    if (!a2) return false;
    const p = getLinkPathname(a2);
    return p && p !== currentPath && (
      p.includes('/communities') || p.includes('/friends') ||
      p.includes('/inventory')   || p.includes('/avatar') || p.includes('/trade')
    );
  }) || allLis.find(li2 => {
    const a2 = li2.querySelector('a');
    return a2 && getLinkPathname(a2) !== currentPath;
  }) || allLis.find(li2 => li2.querySelector('a'));

  if (!refLi) return;
  const refA = refLi.querySelector('a');
  if (!refA) return;

  // Categorize refA's direct children by role:
  //   absolute-positioned → hover overlay div (bg transition on hover)
  //   first non-absolute, empty text → icon container span (size-1000 etc.)
  //   first non-absolute with text → label span
  let refHoverDiv = null;
  let refIconSpan = null;
  let refLabel    = null;
  for (const ch of refA.children) {
    const pos = getComputedStyle(ch).position;
    const txt = ch.textContent?.trim() || '';
    if (pos === 'absolute') {
      if (!refHoverDiv) refHoverDiv = ch;
    } else if (!refIconSpan && txt.length === 0) {
      refIconSpan = ch;
    } else if (!refLabel && txt.length > 0 && txt.length < 40) {
      refLabel = ch;
    }
  }
  // Fallback: refIconSpan → first non-absolute child
  if (!refIconSpan) {
    for (const ch of refA.children) {
      if (getComputedStyle(ch).position !== 'absolute') { refIconSpan = ch; break; }
    }
  }

  // <li>
  const li = document.createElement('li');
  li.id = SIDEBAR_ID;
  if (refLi.className) li.className = refLi.className;

  // <a> — copy className, strip active/selected markers
  const a = document.createElement('a');
  a.href = '#';
  if (refA.className) {
    a.className = refA.className.split(/\s+/)
      .filter(c => c && !/\bactive\b|\bcurrent\b|\bselected\b/i.test(c))
      .join(' ');
  }

  // Hover overlay div — native CSS group-hover rules target this element
  if (refHoverDiv) {
    const hoverDiv = document.createElement(refHoverDiv.tagName.toLowerCase());
    if (refHoverDiv.className) hoverDiv.className = refHoverDiv.className;
    a.appendChild(hoverDiv);
  }

  // SVG icon
  const svgDiv = document.createElement('div');
  svgDiv.innerHTML = PALETTE_SVG;
  const ourSvg = svgDiv.firstElementChild;
  ourSvg.setAttribute('width',  '24');
  ourSvg.setAttribute('height', '24');

  // Icon container span — mirrors native 40×40 flex span so our SVG is
  // positioned identically to the native icon inside its container.
  const iconWrap = document.createElement('span');
  if (refIconSpan?.className) iconWrap.className = refIconSpan.className;
  iconWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;flex-shrink:0;';
  iconWrap.appendChild(ourSvg);
  a.appendChild(iconWrap);

  // Label
  const label = document.createElement('span');
  label.textContent = 'Themes';
  if (refLabel?.className) label.className = refLabel.className;
  a.appendChild(label);

  li.appendChild(a);

  // v1.9.0 fix: Click handler hem <li> hem <a>'da (capture phase) — profil sayfası gibi
  // React'in re-render edebileceği yerlerde <a> click'i Roblox tarafından intercept
  // edilebiliyor. İki yerde de olunca her senaryoda en azından biri çalışır.
  const handleThemesClick = e => {
    try {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleThemesPage();
    } catch (err) {
      console.error('[Tracked-Themes] Sidebar click handler error:', err);
    }
  };
  li.addEventListener('click', handleThemesClick, true);
  a.addEventListener('click', handleThemesClick, true);

  const blogLi = allLis.find(li2 => {
    const a2 = li2.querySelector('a');
    return a2 && (a2.textContent.trim().toLowerCase() === 'blog' || getLinkPathname(a2).includes('blog'));
  });
  if (blogLi) ul.insertBefore(li, blogLi);
  else ul.appendChild(li);
}

// ═══════════════════════════════════════════════════════════════
// ÜCRETSİZ ITEM PANELİ — Roblox layout'una entegre injected page
// /home#tk-free-items hash ile çalışır → bookmark/refresh edilebilir.
// ═══════════════════════════════════════════════════════════════
const FI_BTN_ID    = 'tracked-fi-btn';
const FI_PANEL_ID  = 'tracked-fi-panel';

// SVG ICONS (emoji yok — hep SVG)
const FI_ICON_GIFT  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`;
const FI_ICON_BOX   = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.29 7.7 12 12.71 20.71 7.7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>`;
const FI_ICON_WARN  = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
const FI_ICON_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const FI_ICON_REFR  = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8a5.5 5.5 0 11-1.61-3.89"/><path d="M13.5 2v3h-3"/></svg>`;

function tfiRelativeTime(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return `${s}sn önce`;
  if (s < 3600)  return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  return `${Math.floor(s / 86400)} gün önce`;
}

function tfiEscape(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function tfiRenderList(items) {
  if (!items || items.length === 0) {
    return `<div class="tfi-empty">
      <div class="tfi-empty-icon">${FI_ICON_BOX}</div>
      Şu an satışta ücretsiz item yok.<br>
      "Şimdi Tara" ile kontrol edebilirsin; sistem 30 dk'da bir otomatik tarar.
    </div>`;
  }
  const rows = items.map(it => {
    const thumb = it.imageUrl
      ? tfiEscape(it.imageUrl)
      : `https://www.roblox.com/asset-thumbnail/image?assetId=${tfiEscape(it.id)}&width=150&height=150&format=png`;

    // Distribution: catalog direct mi yoksa oyun içi mi?
    const isInGame = it.saleLocationType && it.saleLocationType !== 'NotApplicable';
    const FI_ICON_GAMEPAD = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z"/></svg>`;
    const distBadge = isInGame
      ? `<span class="tfi-badge ingame" title="Bu item bir oyun içinde dağıtılır">${FI_ICON_GAMEPAD}</span>`
      : `<span class="tfi-badge catalog" title="Bu item catalog'dan direkt alınabilir">CATALOG</span>`;
    // Stok rozeti. Gerçek oyun-içi (bir oyunun İÇİNDE satılan: MyExperiencesOnly/ExperiencesById)
    // item'larda uac per-user limittir → yanıltıcı, gösterme. ExperiencesDevApiOnly (Flex UGC Codes)
    // ve NotApplicable (catalog) → stok GÜVENİLİR. Global stok (ua) varsa onu, yoksa kod/mevcut adet (uac).
    const isGameOnly = /MyExperiencesOnly|ExperiencesById/i.test(it.saleLocationType || '');
    const units = (typeof it.unitsAvailable === 'number') ? it.unitsAvailable : it.unitsAvailableForConsumption;
    let stockBadge = '';
    if (!isGameOnly && typeof units === 'number' && units > 0) {
      if (units <= 5) {
        stockBadge = `<span class="tfi-badge lowstock" title="Son ${units} adet kaldı — acele et!">${units} ADET KALDI</span>`;
      } else if (units <= 50) {
        stockBadge = `<span class="tfi-badge stock" title="${units} adet mevcut">${units} ADET</span>`;
      }
    }

    return `
      <div class="tfi-item ${(it.isLowStock && !isGameOnly) ? 'low-stock' : ''}">
        <img class="tfi-thumb" src="${thumb}" alt="" loading="lazy" onerror="this.style.opacity=0.25;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23555%22><rect width=%2224%22 height=%2224%22/></svg>'">
        <div class="tfi-meta">
          <div class="tfi-name" title="${tfiEscape(it.name)}">${tfiEscape(it.name)} ${distBadge}${stockBadge}</div>
          <div class="tfi-sub">
            <span class="tfi-sub-creator">By ${tfiEscape(it.creatorName || 'Roblox')}</span>
            <span>•</span>
            <span>${tfiRelativeTime(it.detectedAt)}</span>
          </div>
        </div>
        <a class="tfi-go ${isInGame ? 'ingame' : ''}" data-item-id="${tfiEscape(it.id)}" href="https://www.roblox.com/catalog/${tfiEscape(it.id)}" target="_blank" rel="noopener noreferrer">
          Görüntüle
        </a>
      </div>
    `;
  }).join('');
  return rows + `<button class="tfi-clear-btn" id="tfi-clear-btn">Geçmişi Temizle</button>`;
}

// Full-page overlay (themes overlay tarzı)
// _fromManager flag → PanelManager çağırıyor: URL sync ve mutual exclusion yapma, sadece render et
async function openFreeItemsPanel(opts) {
  const fromManager = !!(opts && opts._fromManager);

  // Manager dışı çağrı → toggle/exclusion/URL'i PanelManager'a delege et
  if (!fromManager) {
    return PanelManager.toggle('free-items');
  }

  // Manager çağırdı: zaten DOM'da yoksa render et (mutual exclusion + URL Manager'ın işi)
  if (document.getElementById(FI_PANEL_ID)) return;

  // Tema KAPALI (Default) iken bile panelin kendi CSS'i (#tracked-fi-panel / .tfi-*) gereklidir —
  // bunlar STYLE_ID bloğunda. injectStyles idempotent; tema açıkken no-op, kapalıyken paneli
  // stilli açar (yoksa konumlanmaz → "açılmıyor" gibi görünür). Kapanınca _closeFreeItems soyar.
  injectStyles();

  const skipAnimation = !!(opts && opts.skipAnimation);

  const panel = document.createElement('div');
  panel.id = FI_PANEL_ID;
  if (skipAnimation) panel.classList.add('no-anim');
  panel.innerHTML = `
    <div class="tfi-spacer"></div>
    <div class="tfi-hdr">
      <button class="tfi-back" id="tfi-back">← Geri</button>
      <span class="tfi-brand">TRACKED · ÜCRETSİZ ITEM</span>
      <div class="tfi-hdr-actions">
        <button class="tfi-btn" id="tfi-rescan" title="Şimdi tara">${FI_ICON_REFR} Şimdi Tara</button>
      </div>
    </div>
    <div class="tfi-body">
      <div class="tfi-pane">
        <div class="tfi-page-title">${FI_ICON_GIFT} Ücretsiz Itemler</div>
        <div class="tfi-page-sub">
          Roblox catalog'unda şu an satışta olan ücretsiz itemler burada listelenir. Yeni bir drop
          çıktığında (bildirim açıksa) Chrome bildirimi alırsın. Sistem her 30 dakikada bir otomatik tarar.
        </div>

        <div class="tfi-status">
          <span class="tfi-status-pill on" id="tfi-status-pill">AKTİF</span>
          <span class="tfi-status-info" id="tfi-status-info">Son tarama: —</span>
          <div class="tfi-toggle-wrap">
            <span class="tfi-status-info">Bildirim</span>
            <label class="tfi-toggle">
              <input type="checkbox" id="tfi-toggle" checked>
              <span class="tfi-toggle-track"></span>
              <span class="tfi-toggle-thumb"></span>
            </label>
          </div>
        </div>

        <div class="tfi-list" id="tfi-list">
          <div class="tfi-empty"><div class="tfi-empty-icon">${FI_ICON_BOX}</div>Yükleniyor…</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  // v1.9.0: body overflow lock'ı CSS yapıyor (html.tk-panel-active{overflow-y:scroll}) — scrollbar saf default kalsın diye

  // Layout vars: sync + re-measure (sidebar/topbar geç render olursa otomatik düzelir)
  applyPanelLayoutVars(panel);

  // URL polling başlat — Roblox main world pushState'lerini yakala
  try { window._trackedEnsureHashPoll && window._trackedEnsureHashPoll(); } catch(_) {}

  // Handlers
  panel.querySelector('#tfi-back')?.addEventListener('click', closeFreeItemsPanel);
  panel.querySelector('#tfi-rescan')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('spinning');
    btn.disabled = true;
    // _swSendMessage: "Extension context invalidated" (extension reload sonrası eski content
    // script) durumunu throw etmeden yutar → uncaught hata çıkmaz.
    await _swSendMessage({ action: 'checkFreeItemsNow' });
    setTimeout(() => loadFreeItemsData(panel), 800);
    setTimeout(() => { btn.classList.remove('spinning'); btn.disabled = false; }, 1500);
  });
  panel.querySelector('#tfi-toggle')?.addEventListener('change', async (e) => {
    const enabled = e.currentTarget.checked;
    // Ham chrome.runtime.sendMessage yerine güvenli helper → context invalidated'da uncaught
    // promise hatası bırakmaz (extension reload + eski sayfa senaryosu).
    const r = await _swSendMessage({ action: 'setFreeItemsEnabled', enabled });
    const pill = panel.querySelector('#tfi-status-pill');
    if (pill) {
      pill.textContent = enabled ? 'AKTİF' : 'PASİF';
      pill.classList.toggle('on', enabled);
      pill.classList.toggle('off', !enabled);
    }
    // Context invalidated ise kullanıcıya sayfayı yenilemesi gerektiğini sezdir
    if (r?.error === 'context_invalidated') {
      const info = panel.querySelector('#tfi-status-info');
      if (info) info.textContent = 'Eklenti güncellendi — sayfayı yenileyin (F5)';
    }
  });

  // ESC ile kapat
  panel._escHandler = (e) => { if (e.key === 'Escape') closeFreeItemsPanel(); };
  document.addEventListener('keydown', panel._escHandler);

  // Data yükle
  loadFreeItemsData(panel);
}

function closeFreeItemsPanel() {
  // Manager üzerinden kapat → URL sync, state update, transition lock garanti
  if (PanelManager.current === 'free-items' || document.getElementById(FI_PANEL_ID)) {
    PanelManager.request(null);
  }
}

// Resilient sendMessage — retry'lı + context invalidated detection
// SW soğuk başlangıçta veya extension reload sonrası ilk istek fail olabilir; 3 deneme + 400ms backoff
function _swSendMessage(payload, retries = 3) {
  return new Promise(async (resolve) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      // Extension context invalidated kontrolü (extension reload edilmişse chrome.runtime.id undefined olur)
      if (!chrome?.runtime?.id) {
        resolve({ ok: false, error: 'context_invalidated' });
        return;
      }
      const result = await new Promise(r => {
        try {
          chrome.runtime.sendMessage(payload, resp => {
            if (chrome.runtime.lastError) r({ ok: false, error: chrome.runtime.lastError.message });
            else r(resp || { ok: false, error: 'empty_response' });
          });
        } catch (e) {
          r({ ok: false, error: e.message || String(e) });
        }
      });
      if (result?.ok) { resolve(result); return; }
      if (result?.error === 'context_invalidated' || /Extension context invalidated/i.test(result?.error || '')) {
        resolve({ ok: false, error: 'context_invalidated' });
        return;
      }
      // Final attempt? Don't retry
      if (attempt >= retries) { resolve(result); return; }
      await new Promise(r => setTimeout(r, 400 * (attempt + 1))); // 400, 800, 1200ms
    }
  });
}

async function loadFreeItemsData(panel) {
  const listEl    = panel.querySelector('#tfi-list');
  const statusInfo= panel.querySelector('#tfi-status-info');
  const statusPill= panel.querySelector('#tfi-status-pill');
  const toggleEl  = panel.querySelector('#tfi-toggle');
  if (!listEl) return;

  // 1) Cached history'yi anında göster — kullanıcı boş ekran görmesin
  const resp = await _swSendMessage({ action: 'getFreeItemsHistory' });

  if (resp?.ok) {
    if (statusInfo) statusInfo.textContent = `Son tarama: ${tfiRelativeTime(resp.lastCheck)}`;
    if (statusPill) {
      statusPill.textContent = resp.enabled ? 'AKTİF' : 'PASİF';
      statusPill.classList.toggle('on', resp.enabled);
      statusPill.classList.toggle('off', !resp.enabled);
    }
    if (toggleEl) toggleEl.checked = !!resp.enabled;
    listEl.innerHTML = tfiRenderList(resp.history || []);
    attachClearHandler(panel);
    attachItemLinkHandler(panel);
  } else {
    // Context invalidated → kullanıcıya net mesaj + reload butonu
    if (resp?.error === 'context_invalidated') {
      listEl.innerHTML = `<div class="tfi-empty"><div class="tfi-empty-icon">${FI_ICON_WARN}</div>
        Uzantı yeniden yüklendi.<br><br>
        <button id="tfi-reload-btn" class="tfi-clear-btn" style="display:inline-flex;width:auto;padding:8px 16px">Sayfayı Yenile</button>
      </div>`;
      panel.querySelector('#tfi-reload-btn')?.addEventListener('click', () => location.reload());
    } else {
      listEl.innerHTML = `<div class="tfi-empty"><div class="tfi-empty-icon">${FI_ICON_WARN}</div>
        Veri alınamadı. <br><span style="font-size:11px;opacity:.6">${resp?.error || 'Bilinmeyen hata'}</span>
      </div>`;
    }
    return;
  }

  // 2) Background verify — yeni veri gelirse sessizce update et
  const verifyResp = await _swSendMessage({ action: 'verifyFreeItemsHistory' }, 1);

  if (verifyResp?.ok) {
    listEl.innerHTML = tfiRenderList(verifyResp.history);
    attachClearHandler(panel);
    attachItemLinkHandler(panel);
    if (verifyResp.removed > 0) {
      console.log(`[FreeItems] ${verifyResp.removed} item süresi dolmuş/off-sale, temizlendi`);
    }
  }
}

// Item link'lerini garantili olarak yeni sekmede aç (target=_blank bazen interceptable)
function attachItemLinkHandler(panel) {
  panel.querySelectorAll('.tfi-go').forEach(link => {
    // Çift kayıt olmasın diye flag
    if (link.dataset.tfiBound === '1') return;
    link.dataset.tfiBound = '1';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = link.getAttribute('href');
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  });
}

function attachClearHandler(panel) {
  panel.querySelector('#tfi-clear-btn')?.addEventListener('click', async () => {
    if (!confirm('Geçmişi temizlemek istediğine emin misin? (Bildirimler etkilenmez)')) return;
    await new Promise(resolve => chrome.storage.local.set({ tracked_free_items_history: [] }, resolve));
    loadFreeItemsData(panel);
  });
}

// ── Header'a button inject et (rbx-navbar-icon-group'a, loft profilinin SOLUNA) ──
// Native pattern: <li class="navbar-icon-item"><button class="btn-navigation-nav-settings-md"><span class="rbx-menu-item">...</span></button></li>
function injectFreeItemsButton() {
  if (document.getElementById(FI_BTN_ID)) return true;

  // Hedef container: <ul class="nav navbar-right rbx-navbar-icon-group">
  // Anchor: <div class="age-bracket-label"> (loft profil) — bunun ÖNÜNE inject
  const ageLabel = document.querySelector('.rbx-navbar-icon-group .age-bracket-label')
                || document.querySelector('.rbx-navbar-right .age-bracket-label')
                || document.querySelector('.age-bracket-label');
  if (!ageLabel) return false;
  const parent = ageLabel.parentElement;
  if (!parent) return false;

  // Roblox header item'larıyla orantılı, kendi CSS'imizle stilize edilmiş
  // (Roblox CSS class'larına bağımlı değil — class'lar değişse bile bozulmaz)
  const li = document.createElement('li');
  li.id = FI_BTN_ID;
  li.className = 'navbar-icon-item';
  // ÖNEMLİ: Stilleri INLINE veriyoruz (STYLE_ID bloğuna DEĞİL). Çünkü "Roblox Varsayılanı"
  // modunda STYLE_ID kaldırılıyor; o blokta olsaydı çıplak <button> tarayıcı varsayılan GRİ
  // butonuna dönerdi (kullanıcının gördüğü gri kutu). Inline stil her durumda kalır →
  // arka plan daima ŞEFFAF, sadece ikon görünür. (!important YOK → normal modda STYLE_ID'deki
  // :hover efekti yine çalışır; Default modda inline UA gri butonunu ezer.)
  li.style.cssText = 'list-style:none;margin:0 2px;display:inline-flex;align-items:center;justify-content:center;background:transparent;';
  li.innerHTML = `
    <button type="button" title="Ücretsiz Item Geçmişi" aria-label="Ücretsiz Item Geçmişi"
      style="appearance:none;-webkit-appearance:none;background:transparent;border:none;box-shadow:none;outline:none;padding:0;margin:0;width:36px;height:36px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);cursor:pointer;font:inherit;">
      <span class="rbx-menu-item" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:transparent;border:none;box-shadow:none;">${FI_ICON_GIFT}</span>
    </button>
  `;
  li.querySelector('button').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openFreeItemsPanel();
  });
  parent.insertBefore(li, ageLabel);
  return true;
}

// Header'da button her zaman var olsun (SPA navigation, React re-render)
function watchFreeItemsButton() {
  if (!injectFreeItemsButton()) {
    const obs = new MutationObserver(() => {
      if (injectFreeItemsButton()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
}

// ── Themes page ───────────────────────────────────────────────
function toggleThemesPage() {
  PanelManager.toggle('themes');
}

function closeThemesPage() {
  // Manager üzerinden kapat
  if (PanelManager.current === 'themes' || document.getElementById(OVERLAY_ID)) {
    PanelManager.request(null);
  }
}

async function openThemesPage(opts) {
  const fromManager = !!(opts && opts._fromManager);

  // Manager dışı çağrı → PanelManager'a delege et
  if (!fromManager) {
    return PanelManager.request('themes');
  }

  // Manager çağırdı: zaten DOM'da varsa skip
  if (document.getElementById(OVERLAY_ID)) return;

  // Tema KAPALI (Default) iken bile panelin kendi CSS'i (.tto-*) gereklidir — STYLE_ID
  // bloğu hem sayfa temasını hem panel UI'ını içerir. injectStyles idempotent; tema açıkken
  // no-op, kapalıyken paneli stilli açar. Panel kapanınca _closeThemes tekrar soyar.
  injectStyles();

  console.log('[Tracked-Themes] openThemesPage start, path=' + location.pathname);
  // v1.9.0: body overflow lock'ı CSS yapıyor (html.tk-panel-active{overflow-y:scroll}) — scrollbar saf default kalsın diye

  // v1.9.0 fix: wallpaper meta çağrısı bazen IndexedDB hatasıyla takılıyor — try/catch
  let meta = null;
  try {
    meta = await getWallpaperMeta();
  } catch (e) {
    console.warn('[Tracked-Themes] getWallpaperMeta fail:', e?.message);
  }
  const previewUrl = _wpObjectUrl || meta?.dataUrl || null;
  const hasWp      = !!previewUrl;
  const opV        = meta?.opacity    ?? 1;
  const blV        = meta?.blur       ?? 0;
  const dmV        = meta?.dimOpacity ?? 0.45;

  const GRID_PRESETS = ['midnight','cream','ember','slate','forest','plum'];

  const gridHTML = GRID_PRESETS.map(key => {
    const p  = PRESETS[key];
    const tb = p.topbar, sb = p.sidebar, ac = p.accent;
    const bg = `linear-gradient(160deg,hsl(${tb[0]},${tb[1]}%,${tb[2]}%) 0%,hsl(${sb[0]},${sb[1]}%,${sb[2]}%) 70%)`;
    const dots = [
      `hsl(${tb[0]},${Math.min(tb[1]+10,100)}%,${Math.min(tb[2]+18,90)}%)`,
      `hsl(${sb[0]},${Math.min(sb[1]+10,100)}%,${Math.min(sb[2]+18,90)}%)`,
      `hsl(${ac[0]},${ac[1]}%,${Math.min(ac[2]+8,90)}%)`,
    ].map(c => `<span class="tto-pal-dot" style="background:${c}"></span>`).join('');
    const isActive = key === _state.theme;
    return `<div class="tto-grid-card${isActive ? ' tto-gc-active' : ''}" data-preset="${key}" tabindex="0" role="button" aria-pressed="${isActive}"><div class="tto-card-bg" style="background:${bg}"></div><div class="tto-card-info"><div class="tto-pal-dots">${dots}</div><div class="tto-card-name">${p.label}</div>${p.mood ? `<div class="tto-card-mood">${p.mood}</div>` : ''}</div></div>`;
  }).join('');

  const adjH   = _state.adj.hue       ?? 0;
  const adjS   = _state.adj.sat       ?? 0;
  const adjL   = _state.adj.light     ?? 0;

  const pnlColor = _state.panelColor;
  const pnlOp    = _state.panelOpacity;
  const pnlBl    = _state.panelBlur;
  const hdrOp    = _state.headerOpacity;
  const pnlWidth = _state.panelWidth;
  const swatchHTML = PANEL_SWATCHES.map(s =>
    `<div class="tto-swatch${s.hex.toLowerCase()===pnlColor.toLowerCase()?' active':''}" data-hex="${s.hex}" style="background:${s.hex}" title="${s.label}" tabindex="0"></div>`
  ).join('');

  // Tracked teması ana aç/kapa (Default toggle checked = Roblox varsayılanı = tema KAPALI)
  const themeOn = _state.themeEnabled;

  // ── Gelişmiş kart ayarları template değişkenleri ──
  const cardAdv   = _state.cardAdv;
  const cardColor = _state.cardColor;
  const cardOp    = _state.cardOpacity;
  const cardBl    = _state.cardBlur;
  const cardSwatchHTML = PANEL_SWATCHES.map(s =>
    `<div class="tto-swatch${s.hex.toLowerCase()===cardColor.toLowerCase()?' active':''}" data-hex="${s.hex}" style="background:${s.hex}" title="${s.label}" tabindex="0"></div>`
  ).join('');

  // ── Arama kutusu rengi template değişkenleri ──
  const searchCustom = _state.searchCustom;
  const searchColor  = _state.searchColor;
  const searchOp     = _state.searchOpacity;
  const searchSwatchHTML = PANEL_SWATCHES.map(s =>
    `<div class="tto-swatch${s.hex.toLowerCase()===searchColor.toLowerCase()?' active':''}" data-hex="${s.hex}" style="background:${s.hex}" title="${s.label}" tabindex="0"></div>`
  ).join('');

  // ── Yazı rengi + yazı tipi template değişkenleri ──
  const txtColor = _state.textColor;
  const txtFont  = _state.textFont;
  const txtColorSwatchHTML = TEXT_COLOR_SWATCHES.map(s => {
    const isActive = s.hex ? s.hex.toLowerCase()===txtColor.toLowerCase() : !txtColor;
    const bg = s.hex || 'conic-gradient(rgba(255,255,255,.08) 90deg,rgba(255,255,255,.02) 90deg 180deg,rgba(255,255,255,.08) 180deg 270deg,rgba(255,255,255,.02) 270deg) 0 0/8px 8px';
    return `<div class="tto-swatch${isActive ? ' active' : ''}" data-hex="${s.hex}" style="background:${bg}" title="${s.label}" tabindex="0"></div>`;
  }).join('');
  // Özel font dropdown tetikleyicisi için mevcut seçim (menü JS'te, body'e portal edilerek kurulur)
  const curFontKey   = TEXT_FONTS[txtFont] ? txtFont : '';
  const curFontLabel = TEXT_FONTS[curFontKey].label;
  const curFontStack = TEXT_FONTS[curFontKey].stack ? TEXT_FONTS[curFontKey].stack.replace(/"/g, '&quot;') : 'inherit';

  const ACCENT_SWATCHES_LIST = [
    { hex: '',        label: 'Tema varsayılanı' },
    { hex: '#c8a96e', label: 'Altın' },
    { hex: '#4a9eff', label: 'Mavi' },
    { hex: '#9b59b6', label: 'Mor' },
    { hex: '#27ae60', label: 'Yeşil' },
    { hex: '#e74c3c', label: 'Kırmızı' },
    { hex: '#ff6b9d', label: 'Pembe' },
  ];
  const curAccent = _state.customAccent || '';
  const accentSwatchHTML = ACCENT_SWATCHES_LIST.map(s => {
    const isActive = s.hex ? s.hex.toLowerCase() === curAccent.toLowerCase() : !curAccent;
    const bg = s.hex || 'conic-gradient(rgba(255,255,255,.08) 90deg,rgba(255,255,255,.02) 90deg 180deg,rgba(255,255,255,.08) 180deg 270deg,rgba(255,255,255,.02) 270deg) 0 0/8px 8px';
    return `<div class="tto-swatch${isActive ? ' active' : ''}" data-hex="${s.hex}" style="background:${bg}" title="${s.label}" tabindex="0"></div>`;
  }).join('');

  const overridesHTML = NAV_PATHS.map(path => {
    const cur  = _state.pageOverrides[path] || '';
    const opts = `<option value="">— Global —</option>` +
      VALID_PRESETS.map(k => `<option value="${k}"${cur===k?' selected':''}>${PRESETS[k].label}</option>`).join('');
    return `<div class="tto-override-row"><span class="tto-override-path">${path}</span><select class="tto-override-select" data-path="${path}">${opts}</select></div>`;
  }).join('');

  const activeP  = PRESETS[_state.theme] || PRESETS.midnight;

  // SVG ikonlar module-level (TTO_*) — performans: her openThemesPage çağrısında reallocate edilmesin
  const CHEVRON   = TTO_CHEVRON;
  const ICO_THEME = TTO_ICO_THEME;
  const ICO_TUNE  = TTO_ICO_TUNE;
  const ICO_WP    = TTO_ICO_WP;
  const ICO_PANEL = TTO_ICO_PANEL;
  const ICO_PAGES = TTO_ICO_PAGES;
  const ICO_SHARE = TTO_ICO_SHARE;
  const ICO_EXPORT= TTO_ICO_EXPORT;

  const wpType = meta?.type || 'image';
  const wpThumbHTML = hasWp
    ? (wpType === 'video'
        ? `<video class="tto-wp-bg" src="${previewUrl}" autoplay loop muted playsinline></video><video class="tto-wp-fg" src="${previewUrl}" autoplay loop muted playsinline></video>`
        : `<img class="tto-wp-bg" src="${previewUrl}" alt=""><img class="tto-wp-fg" src="${previewUrl}" alt="">`)
    : '';

  function pct(v, mn, mx) { return (((v - mn) / (mx - mn)) * 100).toFixed(1) + '%'; }
  const opPct  = pct(Math.round(opV*100), 0, 100);
  const blPct  = pct(blV, 0, 20);
  const dmPct  = pct(Math.round(dmV*100), 0, 85);
  const popPct = pct(Math.round(pnlOp*100), 10, 100);
  const pblPct = pct(pnlBl, 0, 24);
  const copPct = pct(Math.round(cardOp*100), 10, 100);
  const cblPct = pct(cardBl, 0, 24);
  const sopPct = pct(Math.round(searchOp*100), 10, 100);
  const hopPct = pct(Math.round(hdrOp*100), 0, 100);
  const pwPct  = pct(pnlWidth, 70, 100);
  const huePct = pct(adjH, -180, 180);
  const satPct = pct(adjS, -50, 50);
  const lgtPct = pct(adjL, -30, 30);

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;

  overlay.innerHTML = `
    <div class="tto-spacer"></div>
    <div class="tto-hdr">
      <button class="tto-back" id="tto-back">← Geri</button>
      <span class="tto-brand">TRACKED · THEMES</span>
      <button class="tto-reset-all" id="tto-reset-all" title="Tüm tema ayarlarını varsayılana döndür"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8a5.5 5.5 0 11-1.61-3.89"/><path d="M13.5 2v3h-3"/></svg>Hepsini Sıfırla</button>
      <button class="tto-save" id="tto-save">Kaydet</button>
    </div>
    <div class="tto-body">
      <div class="tto-scroll">
        <div class="tto-content">

          <!-- ── Tema Seçimi ── -->
          <div class="tto-sec">
            <div class="tto-sec-hdr">
              <div class="tto-sec-icon">${ICO_THEME}</div>
              <div>
                <div class="tto-sec-title">Renk Teması</div>
                <div class="tto-sec-sub">Tüm sitenin renk havasını seç — gece, kahve, orman, mor…</div>
              </div>
            </div>
            <div class="tto-grid" id="tto-grid">${gridHTML}</div>
          </div>

          <!-- ── Roblox Varsayılanı (Default — tüm Tracked efektlerini kapat) ── -->
          <div class="tto-sec">
            <div class="tto-card">
              <div class="tto-row tto-toggle-row">
                <div>
                  <div class="tto-toggle-label">Roblox Varsayılan Teması</div>
                  <div class="tto-toggle-sub">Açıkken <b>tüm Tracked tema efektleri</b> — wallpaper, paneller, renkler, kart çerçevesi, cam ve metin kontrastı — <b>kaldırılır</b> ve Roblox'un orijinal görünümü gelir. Kapatınca ya da yukarıdan bir renk teması seçince Tracked teması geri döner.</div>
                </div>
                <label class="tto-toggle-pill"><input type="checkbox" id="tto-theme-default" ${themeOn ? '' : 'checked'}><span class="tto-toggle-track"></span><span class="tto-toggle-thumb"></span></label>
              </div>
            </div>
          </div>

          <!-- ── Renk Tonu ── -->
          <div class="tto-sec">
            <div class="tto-sec-hdr">
              <div class="tto-sec-icon">${ICO_TUNE}</div>
              <div>
                <div class="tto-sec-title">İnce Ayar</div>
                <div class="tto-sec-sub">Seçtiğin temayı ince ayarla: daha sıcak, daha canlı veya daha parlak yap</div>
              </div>
              <button class="tto-reset-adj" id="tto-reset-adj" title="Tüm ince ayarları varsayılana döndür">Sıfırla</button>
            </div>
            <div class="tto-card">
              <div class="tto-row">
                <span class="tto-row-label" title="Renk tonunu kaydırır — sol: soğuk/mavi, sağ: sıcak/kırmızı">Ton</span>
                <div class="tto-row-ctrl">
                  <input class="tto-range" type="range" id="tto-adj-hue" min="-180" max="180" value="${adjH}" style="--pct:${huePct}">
                  <span class="tto-val" id="v-hue">${adjH > 0 ? '+'+adjH : adjH}°</span>
                </div>
              </div>
              <div class="tto-row">
                <span class="tto-row-label" title="Renklerin canlılığını ayarlar — negatif değerlerde siyah-beyaza yaklaşır">Doygunluk</span>
                <div class="tto-row-ctrl">
                  <input class="tto-range" type="range" id="tto-adj-sat" min="-50" max="50" value="${adjS}" style="--pct:${satPct}">
                  <span class="tto-val" id="v-sat">${adjS > 0 ? '+'+adjS : adjS}</span>
                </div>
              </div>
              <div class="tto-row">
                <span class="tto-row-label" title="Genel aydınlık seviyesini ayarlar — negatif: daha koyu, pozitif: daha açık">Parlaklık</span>
                <div class="tto-row-ctrl">
                  <input class="tto-range" type="range" id="tto-adj-lgt" min="-30" max="30" value="${adjL}" style="--pct:${lgtPct}">
                  <span class="tto-val" id="v-lgt">${adjL > 0 ? '+'+adjL : adjL}</span>
                </div>
              </div>
              <div class="tto-row tto-swatch-row">
                <span class="tto-row-label" title="Kart arka planı ve navigasyon vurgu rengi — ilk swatch temayı sıfırlar">Vurgu rengi</span>
                <div class="tto-swatches-wrap" id="tto-accent-swatches">
                  ${accentSwatchHTML}
                  <input class="tto-hex" id="tto-accent-hex" value="${curAccent}" maxlength="7" placeholder="Tema" spellcheck="false" autocomplete="off">
                  <input type="color" class="tto-colorpick" id="tto-accent-pick" value="${/^#[0-9a-f]{6}$/i.test(curAccent) ? curAccent : '#c8a96e'}" title="Özel renk seç (paletten)">
                </div>
              </div>
            </div>
          </div>

          <!-- ── Wallpaper ── -->
          <div class="tto-sec">
            <div class="tto-sec-hdr">
              <div class="tto-sec-icon">${ICO_WP}</div>
              <div>
                <div class="tto-sec-title">Wallpaper</div>
                <div class="tto-sec-sub">Arka plana kendi resmini ya da videonu koy</div>
              </div>
              <button class="tto-reset-adj" id="tto-reset-wp" title="Wallpaper ayarlarını (opaklık/bulanıklık/karartma) sıfırla">Sıfırla</button>
            </div>
            ${hasWp ? `
            <div class="tto-wp-prev" id="tto-wp-thumb">
              ${wpThumbHTML}
              <div class="tto-wp-badge">${wpType === 'video' ? I.vidTag + ' Video' : I.imgTag + ' Görsel'}</div>
            </div>
            <div class="tto-card" style="margin-bottom:0">
              <div class="tto-row">
                <span class="tto-row-label" title="Wallpaper'ın görünürlüğünü ayarlar — 0 = gizli, 100 = tam görünür">Opaklık</span>
                <div class="tto-row-ctrl">
                  <input class="tto-range" type="range" id="tto-op" min="0" max="100" value="${Math.round(opV*100)}" style="--pct:${opPct}">
                  <span class="tto-val" id="v-op">${Math.round(opV*100)}%</span>
                </div>
              </div>
              <div class="tto-row">
                <span class="tto-row-label" title="Wallpaper'ı bulanıklaştırır — içerik okunabilirliğini artırır">Bulanıklık</span>
                <div class="tto-row-ctrl">
                  <input class="tto-range" type="range" id="tto-bl" min="0" max="20" value="${blV}" style="--pct:${blPct}">
                  <span class="tto-val" id="v-bl">${blV}px</span>
                </div>
              </div>
              <div class="tto-row">
                <span class="tto-row-label" title="Wallpaper üzerine koyu bir katman ekler — içerik kontrastını artırır">Karartma</span>
                <div class="tto-row-ctrl">
                  <input class="tto-range" type="range" id="tto-dm" min="0" max="85" value="${Math.round(dmV*100)}" style="--pct:${dmPct}">
                  <span class="tto-val" id="v-dm">${Math.round(dmV*100)}%</span>
                </div>
              </div>
            </div>
            <div class="tto-wp-save-note">Slider değişiklikleri için Kaydet'e basın</div>
            ` : ''}
            <div class="tto-drop" id="tto-drop">
              <input type="file" id="tto-file" accept="image/*,image/gif,video/mp4,video/webm">
              <div class="tto-drop-icon">${I.image}</div>
              <div class="tto-drop-main">Tıkla veya sürükle-bırak</div>
              <div class="tto-drop-sub">JPG · PNG · GIF · WebP · MP4 · WebM · Maks 50 MB</div>
            </div>
            ${hasWp ? `
            <div class="tto-sep"><div class="tto-sep-line"></div><span class="tto-sep-text">veya</span><div class="tto-sep-line"></div></div>
            <button class="tto-rm" id="tto-rm">${I.trash} Wallpaper'ı Kaldır</button>
            ` : ''}
          </div>

          <!-- ── Görünüm ── -->
          <div class="tto-sec">
            <div class="tto-sec-hdr">
              <div class="tto-sec-icon">${ICO_PANEL}</div>
              <div>
                <div class="tto-sec-title">Görünüm</div>
                <div class="tto-sec-sub">Kart ve panellerin rengi/saydamlığı + üst çubuk görünümü</div>
              </div>
              <button class="tto-reset-adj" id="tto-reset-view" title="Görünüm ayarlarını (panel rengi/opaklık/genişlik/çerçeve) sıfırla">Sıfırla</button>
            </div>
            <div class="tto-card">
              <div class="tto-row tto-toggle-row">
                <div>
                  <div class="tto-toggle-label">Kart çerçevesi</div>
                  <div class="tto-toggle-sub">Oyun ve eşya kartlarının köşelerini yuvarlar; üzerine gelince hafif bir hareket verir</div>
                </div>
                <label class="tto-toggle-pill"><input type="checkbox" id="tto-card-frame" ${_state.cardFrame ? 'checked' : ''}><span class="tto-toggle-track"></span><span class="tto-toggle-thumb"></span></label>
              </div>
              <div class="tto-row tto-swatch-row">
                <span class="tto-row-label">Panel rengi</span>
                <div class="tto-swatches-wrap" id="tto-panel-swatches">
                  ${swatchHTML}
                  <input class="tto-hex" id="tto-panel-hex" value="${pnlColor}" maxlength="7" placeholder="#1a1b22" spellcheck="false" autocomplete="off">
                  <input type="color" class="tto-colorpick" id="tto-panel-pick" value="${pnlColor}" title="Özel renk seç (paletten)">
                </div>
              </div>
              <div class="tto-row">
                <span class="tto-row-label" title="İçerik panellerinin ne kadar saydam olduğu — düşük değerde wallpaper daha fazla görünür">Panel opaklığı</span>
                <div class="tto-row-ctrl">
                  <input class="tto-range" type="range" id="tto-panel-op" min="10" max="100" value="${Math.round(pnlOp*100)}" style="--pct:${popPct}">
                  <span class="tto-val" id="v-panel-op">${Math.round(pnlOp*100)}%</span>
                </div>
              </div>
              <div class="tto-row">
                <span class="tto-row-label" title="İçerik panellerini buzlu cam gibi gösterir — çalışması için Panel opaklığını düşürün">Cam efekti</span>
                <div class="tto-row-ctrl">
                  <input class="tto-range" type="range" id="tto-panel-bl" min="0" max="24" value="${pnlBl}" style="--pct:${pblPct}">
                  <span class="tto-val" id="v-panel-bl">${pnlBl}px</span>
                </div>
              </div>
              <div id="tto-panel-blur-hint" class="tto-blur-hint" style="display:none">⚠ Cam efekti aktif — Panel opaklığını düşürün</div>
              <div class="tto-row">
                <span class="tto-row-label" title="Topbar ve sidebar arka planının saydamlığı — 0 = tamamen şeffaf (wallpaper görünür), 100 = tam dolu">Çubuk opaklığı</span>
                <div class="tto-row-ctrl">
                  <input class="tto-range" type="range" id="tto-header-op" min="0" max="100" value="${Math.round(hdrOp*100)}" style="--pct:${hopPct}">
                  <span class="tto-val" id="v-header-op">${Math.round(hdrOp*100)}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Sayfa Temaları ── -->
          <div class="tto-sec">
            <div class="tto-sec-hdr">
              <div class="tto-sec-icon">${ICO_PAGES}</div>
              <div>
                <div class="tto-sec-title">Sayfa Temaları</div>
                <div class="tto-sec-sub">İstersen her Roblox sayfasına ayrı bir tema ver</div>
              </div>
              <button class="tto-reset-adj" id="tto-reset-pages" title="Tüm sayfa temalarını sıfırla (her sayfa varsayılan temayı kullanır)">Sıfırla</button>
            </div>
            <div class="tto-card">
              <div class="tto-collapse-btn" id="tto-col-btn"><span>Sayfalara göre tema seç</span>${CHEVRON}</div>
              <div class="tto-overrides-body" id="tto-overrides" style="display:none">${overridesHTML}</div>
            </div>
          </div>

          <!-- ── Gelişmiş Ayarlar ── -->
          <div class="tto-sec">
            <div class="tto-sec-hdr">
              <div class="tto-sec-icon">${ICO_TUNE}</div>
              <div>
                <div class="tto-sec-title">Gelişmiş Ayarlar</div>
                <div class="tto-sec-sub">İleri ayarlar: yazıların rengi ve fontu, kart ve arama kutusu rengi</div>
              </div>
            </div>
            <div class="tto-card">
              <div class="tto-collapse-btn" id="tto-adv-btn"><span>Gelişmiş ayarları aç</span>${CHEVRON}</div>
              <div class="tto-overrides-body" id="tto-adv-body" style="display:none">
                <div id="tto-adv-warn" style="display:flex;align-items:flex-start;gap:8px;padding:10px 12px;margin:10px 0;border-radius:8px;background:rgba(255,180,0,.08);border:1px solid rgba(255,180,0,.25);color:rgba(255,210,120,.95);font-size:11.5px;line-height:1.5">
                  <span style="flex-shrink:0">⚠</span>
                  <span>Bu ayarlar deneyseldir; bazı sayfalarda kart görünümünü bozabilir. Değişiklikler anlık uygulanır — istediğin an "Gelişmiş kart görünümü"nü kapatarak normale dönebilirsin.</span>
                </div>
                <div class="tto-row tto-toggle-row">
                  <div>
                    <div class="tto-toggle-label">Gelişmiş kart görünümü</div>
                    <div class="tto-toggle-sub">Açınca kartlar, panel ayarı yerine aşağıdaki kendi renk / saydamlık / cam ayarını kullanır</div>
                  </div>
                  <label class="tto-toggle-pill"><input type="checkbox" id="tto-card-adv" ${cardAdv ? 'checked' : ''}><span class="tto-toggle-track"></span><span class="tto-toggle-thumb"></span></label>
                </div>
                <div class="tto-row tto-swatch-row">
                  <span class="tto-row-label">Kart rengi</span>
                  <div class="tto-swatches-wrap" id="tto-card-swatches">
                    ${cardSwatchHTML}
                    <input class="tto-hex" id="tto-card-hex" value="${cardColor}" maxlength="7" placeholder="#1a1b22" spellcheck="false" autocomplete="off">
                    <input type="color" class="tto-colorpick" id="tto-card-pick" value="${cardColor}" title="Özel renk seç (paletten)">
                  </div>
                </div>
                <div class="tto-row">
                  <span class="tto-row-label" title="Kartların opaklığı/şeffaflığı — düşük değerde wallpaper daha çok görünür">Kart opaklığı</span>
                  <div class="tto-row-ctrl">
                    <input class="tto-range" type="range" id="tto-card-op" min="10" max="100" value="${Math.round(cardOp*100)}" style="--pct:${copPct}">
                    <span class="tto-val" id="v-card-op">${Math.round(cardOp*100)}%</span>
                  </div>
                </div>
                <div class="tto-row">
                  <span class="tto-row-label" title="Kartları buzlu cam gibi gösterir — arkadaki wallpaper bulanıklaşır">Kart camı (blur)</span>
                  <div class="tto-row-ctrl">
                    <input class="tto-range" type="range" id="tto-card-bl" min="0" max="24" value="${cardBl}" style="--pct:${cblPct}">
                    <span class="tto-val" id="v-card-bl">${cardBl}px</span>
                  </div>
                </div>
                <div class="tto-row tto-toggle-row">
                  <div>
                    <div class="tto-toggle-label">Metin kontrastını artır</div>
                    <div class="tto-toggle-sub">Tüm yazılara hafif gölge ekler → şeffaf veya parlak zeminde yazılar daha net okunur (renkleri değiştirmez)</div>
                  </div>
                  <label class="tto-toggle-pill"><input type="checkbox" id="tto-text-contrast" ${_state.textContrast ? 'checked' : ''}><span class="tto-toggle-track"></span><span class="tto-toggle-thumb"></span></label>
                </div>
                <div class="tto-row tto-swatch-row">
                  <span class="tto-row-label" title="Tüm yazıların rengini değiştirir — oyun adları, isimler ve SOHBET dahil; linkler de boyanır. Varsayılan = dokunmaz (Roblox/tema rengi)">Yazı rengi</span>
                  <div class="tto-swatches-wrap" id="tto-text-color-swatches">
                    ${txtColorSwatchHTML}
                    <input class="tto-hex" id="tto-text-color-hex" value="${txtColor}" maxlength="7" placeholder="Varsayılan" spellcheck="false" autocomplete="off">
                    <input type="color" class="tto-colorpick" id="tto-text-color-pick" value="${/^#[0-9a-f]{6}$/i.test(txtColor) ? txtColor : '#ffffff'}" title="Özel renk seç (paletten)">
                  </div>
                </div>
                <div class="tto-row">
                  <span class="tto-row-label" title="Tüm içerik yazılarının harf stili/fontu (ikonlar etkilenmez)">Yazı tipi (harf stili)</span>
                  <div class="tto-row-ctrl">
                    <div class="tto-fontdd" id="tto-font-dd">
                      <button type="button" class="tto-fontdd-btn" id="tto-font-btn" aria-haspopup="listbox" aria-expanded="false">
                        <span class="tto-fontdd-cur" id="tto-font-cur" style="font-family:${curFontStack}">${curFontLabel}</span>
                        <svg class="tto-fontdd-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="tto-row tto-toggle-row">
                  <div>
                    <div class="tto-toggle-label">Arama kutusu rengini özelleştir</div>
                    <div class="tto-toggle-sub">Üstteki arama kutusuna kendi rengini ver; kapalıyken Roblox'un kendi rengi kalır</div>
                  </div>
                  <label class="tto-toggle-pill"><input type="checkbox" id="tto-search-custom" ${searchCustom ? 'checked' : ''}><span class="tto-toggle-track"></span><span class="tto-toggle-thumb"></span></label>
                </div>
                <div class="tto-row tto-swatch-row">
                  <span class="tto-row-label">Arama kutusu rengi</span>
                  <div class="tto-swatches-wrap" id="tto-search-swatches">
                    ${searchSwatchHTML}
                    <input class="tto-hex" id="tto-search-hex" value="${searchColor}" maxlength="7" placeholder="#1a1b22" spellcheck="false" autocomplete="off">
                    <input type="color" class="tto-colorpick" id="tto-search-pick" value="${searchColor}" title="Özel renk seç (paletten)">
                  </div>
                </div>
                <div class="tto-row">
                  <span class="tto-row-label" title="Arama kutusunun opaklığı — düşük değerde wallpaper daha çok görünür">Arama kutusu opaklığı</span>
                  <div class="tto-row-ctrl">
                    <input class="tto-range" type="range" id="tto-search-op" min="10" max="100" value="${Math.round(searchOp*100)}" style="--pct:${sopPct}">
                    <span class="tto-val" id="v-search-op">${Math.round(searchOp*100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Paylaş / Aktar ── -->
          <div class="tto-sec">
            <div class="tto-sec-hdr">
              <div class="tto-sec-icon">${ICO_SHARE}</div>
              <div>
                <div class="tto-sec-title">Paylaş & Aktar</div>
                <div class="tto-sec-sub">Temanı kod olarak paylaş ya da başkasınınkini uygula</div>
              </div>
            </div>
            <div class="tto-card" style="padding:14px 16px">
              <button class="tto-export-btn" id="tto-export-btn">${ICO_EXPORT} Mevcut temayı dışa aktar</button>
              <div class="tto-share-row">
                <input class="tto-share-input" id="tto-imp-input" placeholder="Tema kodunu yapıştır..." autocomplete="off" spellcheck="false">
                <button class="tto-share-btn" id="tto-imp-btn">Uygula</button>
              </div>
              <div class="tto-share-msg" id="tto-share-msg"></div>
            </div>
          </div>

        </div>
      </div>

      <div class="tto-live" id="tto-live">
        <div class="tto-live-cap">Canlı Önizleme</div>
        <div class="tto-live-name" id="tto-live-name">${activeP.label}</div>
        <div class="tto-live-mood" id="tto-live-mood">${activeP.mood}</div>
        <div class="tto-mock" id="tto-mock">
          <div class="tto-mock-topbar"></div>
          <div class="tto-mock-body">
            <div class="tto-mock-sidebar">
              <div class="tto-mock-navitem"></div>
              <div class="tto-mock-navitem"></div>
              <div class="tto-mock-navitem"></div>
              <div class="tto-mock-navitem" style="margin-top:auto;opacity:.4"></div>
            </div>
            <div class="tto-mock-content">
              <div class="tto-mock-card"></div>
              <div class="tto-mock-card"></div>
              <div class="tto-mock-card"></div>
              <div class="tto-mock-card"></div>
              <div class="tto-mock-card" style="grid-column:1/-1;height:32px"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // ── TRACKED PLUS GATE: Temalar Pro özelliği. Plus değilse panelin üstüne kilit overlay bin ──
  _syncThemeLock();

  // ── HAFIZA: panel UI durumu (scroll konumu + açık collapse bölümleri) — geri açınca
  //    kaldığın yerden devam et. (Picker'lardaki hafıza sistemiyle aynı mantık.) ──
  const _ttoScrollEl = overlay.querySelector('.tto-scroll');
  function saveThemesUi() {
    try {
      storeSet({ tracked_themes_ui: {
        scrollTop: _ttoScrollEl ? _ttoScrollEl.scrollTop : 0,
        overridesOpen: overlay.querySelector('#tto-overrides')?.style.display !== 'none',
        advOpen: overlay.querySelector('#tto-adv-body')?.style.display !== 'none',
      }});
    } catch (_) {}
  }
  (async () => {
    try {
      const ui = (await storeGet(['tracked_themes_ui'])).tracked_themes_ui || {};
      if (ui.overridesOpen) { const b = overlay.querySelector('#tto-overrides'), btn = overlay.querySelector('#tto-col-btn'); if (b && btn) { b.style.display = 'flex'; btn.classList.add('tto-col-open'); } }
      if (ui.advOpen) { const b = overlay.querySelector('#tto-adv-body'), btn = overlay.querySelector('#tto-adv-btn'); if (b && btn) { b.style.display = 'flex'; btn.classList.add('tto-col-open'); } }
      if (_ttoScrollEl && typeof ui.scrollTop === 'number' && ui.scrollTop > 0) {
        requestAnimationFrame(() => requestAnimationFrame(() => { try { _ttoScrollEl.scrollTop = ui.scrollTop; } catch (_) {} }));
      }
    } catch (_) {}
  })();
  if (_ttoScrollEl) {
    let _ttoSd = null;
    _ttoScrollEl.addEventListener('scroll', () => { clearTimeout(_ttoSd); _ttoSd = setTimeout(saveThemesUi, 250); }, { passive: true });
  }

  // Layout vars: sync + re-measure (sidebar/topbar geç render olursa otomatik düzelir)
  applyPanelLayoutVars(overlay);

  // URL polling başlat — Roblox main world pushState'lerini yakala
  try { window._trackedEnsureHashPoll && window._trackedEnsureHashPoll(); } catch(_) {}

  // ── Back ──
  overlay.querySelector('#tto-back').addEventListener('click', () => {
    if (pendingFile) {
      const saveBtn = overlay.querySelector('#tto-save');
      if (saveBtn) {
        saveBtn.classList.add('tto-save-pending');
        saveBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => saveBtn.classList.remove('tto-save-pending'), 1400);
      }
      return;
    }
    closeThemesPage();
  });

  // ── Magazine grid: hover preview + click select ──
  const grid     = overlay.querySelector('#tto-grid');
  const mock     = overlay.querySelector('#tto-mock');
  const liveName = overlay.querySelector('#tto-live-name');
  const liveMood = overlay.querySelector('#tto-live-mood');
  const TK_KEYS  = ['--tk-topbar','--tk-sidebar','--tk-card','--tk-navitem','--tk-accent'];

  grid.addEventListener('mouseover', e => {
    const card = e.target.closest('.tto-grid-card');
    if (!card) return;
    const key = card.dataset.preset;
    const p = PRESETS[key]; if (!p) return;
    const vars = computeThemeVars(key, _state.adj, _state.customAccent, _state.fgBase);
    TK_KEYS.forEach(k => mock.style.setProperty(k, vars[k]));
    liveName.textContent = p.label;
    liveMood.textContent = p.mood;
  });

  grid.addEventListener('mouseleave', () => {
    TK_KEYS.forEach(k => mock.style.removeProperty(k));
    const p = PRESETS[_state.theme] || PRESETS.midnight;
    liveName.textContent = p.label;
    liveMood.textContent = p.mood;
  });

  grid.addEventListener('click', e => {
    const card = e.target.closest('.tto-grid-card');
    if (!card) return;
    const key = card.dataset.preset;
    if (!PRESETS[key]) return;
    // Tema KAPALIYKEN (Default) bir renk teması seçmek = Tracked'i yeniden etkinleştir
    if (!_state.themeEnabled) {
      _state.themeEnabled = true;
      storeSet({ [THEME_ENABLED_KEY]: true });
      enableAllTheming();
      const dtgl = overlay.querySelector('#tto-theme-default'); if (dtgl) dtgl.checked = false;
    }
    _state.theme = key;
    grid.querySelectorAll('.tto-grid-card').forEach(c => {
      c.classList.toggle('tto-gc-active', c.dataset.preset === key);
      c.setAttribute('aria-pressed', c.dataset.preset === key ? 'true' : 'false');
    });
    applyColorTheme(key, _state.adj, _state.customAccent, _state.fgBase, false);
    storeSet({ [THEME_KEY]: key });
    const p = PRESETS[key];
    liveName.textContent = p.label;
    liveMood.textContent = p.mood;
  });

  // ── Default (Roblox varsayılanı) toggle: tüm Tracked efektlerini aç/kapa ──
  {
    const defaultTgl = overlay.querySelector('#tto-theme-default');
    if (defaultTgl) defaultTgl.addEventListener('change', () => {
      const useDefault = defaultTgl.checked;       // checked = Roblox varsayılanı (tema KAPALI)
      _state.themeEnabled = !useDefault;
      storeSet({ [THEME_ENABLED_KEY]: _state.themeEnabled });
      // Themes paneli ŞU AN açık → keepPanelStyles ile STYLE_ID'yi koru (panel stilsiz kalmasın);
      // panel kapanınca _closeThemes tam soyma yapar.
      if (useDefault) disableAllTheming({ keepPanelStyles: true });
      else            enableAllTheming();
    });
  }

  // ── Range utils ──
  function setPct(r) {
    const p = ((parseFloat(r.value) - parseFloat(r.min)) / (parseFloat(r.max) - parseFloat(r.min)) * 100).toFixed(1) + '%';
    r.style.setProperty('--pct', p);
  }

  // ── HSL adj sliders ──
  const hueR = overlay.querySelector('#tto-adj-hue');
  const satR = overlay.querySelector('#tto-adj-sat');
  const lgtR = overlay.querySelector('#tto-adj-lgt');
  const vHue = overlay.querySelector('#v-hue');
  const vSat = overlay.querySelector('#v-sat');
  const vLgt = overlay.querySelector('#v-lgt');

  function getAdjFromSliders() {
    return {
      hue:   parseInt(hueR.value),
      sat:   parseInt(satR.value),
      light: parseInt(lgtR.value),
    };
  }

  hueR.addEventListener('input', () => {
    const v = parseInt(hueR.value); setPct(hueR);
    if (vHue) vHue.textContent = (v > 0 ? '+' + v : v) + '°';
    clearTimeout(_adjDebounce); _adjDebounce = setTimeout(() => applyColorTheme(_state.theme, getAdjFromSliders(), _state.customAccent, _state.fgBase, true), 60);
    clearTimeout(_adjSaveDebounce); _adjSaveDebounce = setTimeout(() => { _state.adj = getAdjFromSliders(); storeSet({ [ADJ_KEY]: _state.adj }); }, 400);
  });
  satR.addEventListener('input', () => {
    const v = parseInt(satR.value); setPct(satR);
    if (vSat) vSat.textContent = v > 0 ? '+' + v : String(v);
    clearTimeout(_adjDebounce); _adjDebounce = setTimeout(() => applyColorTheme(_state.theme, getAdjFromSliders(), _state.customAccent, _state.fgBase, true), 60);
    clearTimeout(_adjSaveDebounce); _adjSaveDebounce = setTimeout(() => { _state.adj = getAdjFromSliders(); storeSet({ [ADJ_KEY]: _state.adj }); }, 400);
  });
  lgtR.addEventListener('input', () => {
    const v = parseInt(lgtR.value); setPct(lgtR);
    if (vLgt) vLgt.textContent = v > 0 ? '+' + v : String(v);
    clearTimeout(_adjDebounce); _adjDebounce = setTimeout(() => applyColorTheme(_state.theme, getAdjFromSliders(), _state.customAccent, _state.fgBase, true), 60);
    clearTimeout(_adjSaveDebounce); _adjSaveDebounce = setTimeout(() => { _state.adj = getAdjFromSliders(); storeSet({ [ADJ_KEY]: _state.adj }); }, 400);
  });
  // ── Accent color ──
  {
    const accentWrap = overlay.querySelector('#tto-accent-swatches');
    const accentHexEl = overlay.querySelector('#tto-accent-hex');

    function setAccent(hex) {
      _state.customAccent = hex;
      if (accentHexEl) accentHexEl.value = hex;
      accentWrap?.querySelectorAll('.tto-swatch').forEach(s =>
        s.classList.toggle('active', hex ? s.dataset.hex?.toLowerCase() === hex.toLowerCase() : s.dataset.hex === '')
      );
      applyColorTheme(_state.theme, _state.adj, hex, _state.fgBase, true);
      storeSet({ [ACCENT_KEY]: hex });
      try { hex ? localStorage.setItem(LS_ACCENT, hex) : localStorage.removeItem(LS_ACCENT); } catch(_) {}
    }

    accentWrap?.addEventListener('click', e => {
      const s = e.target.closest('.tto-swatch');
      if (s) setAccent(s.dataset.hex || '');
    });

    accentHexEl?.addEventListener('input', () => {
      const v = accentHexEl.value.trim();
      if (!v) { setAccent(''); return; }
      if (/^#[0-9a-f]{6}$/i.test(v)) setAccent(v);
    });
    const accentPick = overlay.querySelector('#tto-accent-pick');
    // KASMA ÖNLEME: sürüklerken sayfaya dokunma (görünmüyor zaten + ağır) → renk BIRAKILINCA uygula.
    accentPick?.addEventListener('change', () => setAccent(accentPick.value));
  }

  // ── Wallpaper sliders ──
  function wireWpSliders() {
    const opR2 = overlay.querySelector('#tto-op');
    const blR2 = overlay.querySelector('#tto-bl');
    const dmR2 = overlay.querySelector('#tto-dm');
    if (!opR2) return;
    const prev = overlay.querySelector('#tto-wp-thumb');
    opR2.oninput = () => {
      setPct(opR2);
      const v = parseInt(opR2.value)/100;
      const vEl = overlay.querySelector('#v-op'); if (vEl) vEl.textContent = opR2.value + '%';
      const l = document.getElementById(LAYER_ID); if (l) l.style.setProperty('--twp-opacity', v);
      if (prev) prev.style.setProperty('--twp-prev-opacity', v); // canlı preview
    };
    blR2.oninput = () => {
      setPct(blR2);
      const vEl = overlay.querySelector('#v-bl'); if (vEl) vEl.textContent = blR2.value + 'px';
      const l = document.getElementById(LAYER_ID); if (l) l.style.setProperty('--twp-blur', `${blR2.value}px`);
      if (prev) prev.style.setProperty('--twp-prev-blur', `${blR2.value}px`); // canlı preview
    };
    dmR2.oninput = () => {
      setPct(dmR2);
      const v = parseInt(dmR2.value)/100;
      const vEl = overlay.querySelector('#v-dm'); if (vEl) vEl.textContent = dmR2.value + '%';
      const l = document.getElementById(LAYER_ID); if (l) l.style.setProperty('--twp-dim', v);
      if (prev) prev.style.setProperty('--twp-prev-dim', v); // canlı preview
    };
    // İlk açılışta mevcut değerleri preview'a uygula
    if (prev) {
      prev.style.setProperty('--twp-prev-opacity', parseInt(opR2.value)/100);
      prev.style.setProperty('--twp-prev-blur', `${blR2.value}px`);
      prev.style.setProperty('--twp-prev-dim', parseInt(dmR2.value)/100);
    }
  }
  wireWpSliders();

  // ── Sayfa Panelleri controls ──
  {
    const swatchWrap = overlay.querySelector('#tto-panel-swatches');
    const hexInput   = overlay.querySelector('#tto-panel-hex');
    const panelOpR   = overlay.querySelector('#tto-panel-op');
    const panelBlR   = overlay.querySelector('#tto-panel-bl');
    const blurHint   = overlay.querySelector('#tto-panel-blur-hint');

    let curPanelColor = pnlColor;

    function livePanel() {
      const op  = parseInt(panelOpR.value) / 100;
      const bl  = parseInt(panelBlR.value);
      const hex = hexInput.value.trim();
      const col = /^#[0-9a-f]{6}$/i.test(hex) ? hex : curPanelColor;
      applyPanelVars(col, op, bl, _state.panelWidth);
      if (blurHint) blurHint.style.display = bl > 0 ? '' : 'none';
    }

    function savePanelDebounced() {
      clearTimeout(_panelSaveDebounce);
      _panelSaveDebounce = setTimeout(() => {
        const op = parseInt(panelOpR.value) / 100;
        const bl = parseInt(panelBlR.value);
        _state.panelColor   = curPanelColor;
        _state.panelOpacity = op;
        _state.panelBlur    = bl;
        storeSet({ [PANEL_COLOR_KEY]: curPanelColor, [PANEL_OPACITY_KEY]: op, [PANEL_BLUR_KEY]: bl });
      }, 400);
    }

    function setActiveColor(hex) {
      curPanelColor = hex;
      hexInput.value = hex;
      swatchWrap.querySelectorAll('.tto-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.hex.toLowerCase() === hex.toLowerCase())
      );
      clearTimeout(_panelDebounce);
      _panelDebounce = setTimeout(livePanel, 60);
      savePanelDebounced();
    }

    swatchWrap.addEventListener('click', e => {
      const s = e.target.closest('.tto-swatch');
      if (s) setActiveColor(s.dataset.hex);
    });

    hexInput.addEventListener('input', () => {
      const v = hexInput.value.trim();
      if (!/^#[0-9a-f]{6}$/i.test(v)) return;
      setActiveColor(v);
    });
    const panelPick = overlay.querySelector('#tto-panel-pick');
    if (panelPick) panelPick.addEventListener('change', () => setActiveColor(panelPick.value));

    panelOpR.addEventListener('input', () => {
      setPct(panelOpR);
      const vEl = overlay.querySelector('#v-panel-op'); if (vEl) vEl.textContent = panelOpR.value + '%';
      clearTimeout(_panelDebounce); _panelDebounce = setTimeout(livePanel, 60);
      savePanelDebounced();
    });
    panelBlR.addEventListener('input', () => {
      setPct(panelBlR);
      const vEl = overlay.querySelector('#v-panel-bl'); if (vEl) vEl.textContent = panelBlR.value + 'px';
      clearTimeout(_panelDebounce); _panelDebounce = setTimeout(livePanel, 60);
      savePanelDebounced();
    });

    const headerOpR = overlay.querySelector('#tto-header-op');
    if (headerOpR) {
      let _hdrSaveDebounce = null;
      headerOpR.addEventListener('input', () => {
        const op = parseInt(headerOpR.value) / 100;
        setPct(headerOpR);
        const vEl = overlay.querySelector('#v-header-op'); if (vEl) vEl.textContent = headerOpR.value + '%';
        document.documentElement.style.setProperty('--tk-header-opacity', op);
        clearTimeout(_hdrSaveDebounce);
        _hdrSaveDebounce = setTimeout(() => {
          _state.headerOpacity = op;
          storeSet({ [HEADER_OPACITY_KEY]: op });
        }, 400);
      });
    }

    const cardFrameChk = overlay.querySelector('#tto-card-frame');
    if (cardFrameChk) {
      cardFrameChk.addEventListener('change', () => {
        _state.cardFrame = cardFrameChk.checked;
        applyCardFrame(_state.cardFrame);
        storeSet({ [CARD_FRAME_KEY]: _state.cardFrame });
      });
    }

    // v1.9.0: panelWR (İçerik genişliği) ayarı kaldırıldı — default %100, UI kayma bug'ları önlenir
  }

  // ── File drop ──
  const dropZone = overlay.querySelector('#tto-drop');
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.style.borderColor = 'rgba(139,111,71,.6)'; });
  dropZone.addEventListener('dragenter', e => { e.preventDefault(); });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.style.borderColor = '';
    const file = e.dataTransfer?.files[0]; if (!file) return;
    handleFile(file);
  });

  async function handleFile(file) {
    overlay.querySelectorAll('.tto-file-err').forEach(el => el.remove());
    if (file.size > MAX_BYTES) {
      const err = document.createElement('p');
      err.className = 'tto-file-err';
      err.textContent = `Dosya çok büyük — Maks 50 MB (seçilen: ${(file.size/1024/1024).toFixed(1)} MB)`;
      dropZone.after(err);
      return;
    }
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    const type   = file.type.startsWith('video/') ? 'video' : 'image';
    const url    = URL.createObjectURL(file);
    const fgBase = type === 'image' ? await detectLuma(url).catch(() => null) : null;
    pendingFile  = { blob: file, type, mimeType: file.type, previewUrl: url, fgBase };

    let thumb = overlay.querySelector('#tto-wp-thumb');
    if (!thumb) {
      const wpPrev = document.createElement('div');
      wpPrev.className = 'tto-wp-prev';
      wpPrev.id = 'tto-wp-thumb';
      const wpCard = document.createElement('div');
      wpCard.className = 'tto-card';
      wpCard.style.marginBottom = '10px';
      wpCard.innerHTML = `
        <div class="tto-row"><span class="tto-row-label">Opaklık</span><div class="tto-row-ctrl"><input class="tto-range" type="range" id="tto-op" min="0" max="100" value="100" style="--pct:100%"><span class="tto-val" id="v-op">100%</span></div></div>
        <div class="tto-row"><span class="tto-row-label">Bulanıklık</span><div class="tto-row-ctrl"><input class="tto-range" type="range" id="tto-bl" min="0" max="20" value="0" style="--pct:0%"><span class="tto-val" id="v-bl">0px</span></div></div>
        <div class="tto-row"><span class="tto-row-label">Karartma</span><div class="tto-row-ctrl"><input class="tto-range" type="range" id="tto-dm" min="0" max="85" value="45" style="--pct:52.9%"><span class="tto-val" id="v-dm">45%</span></div></div>`;
      dropZone.before(wpPrev);
      dropZone.before(wpCard);
      thumb = wpPrev;
      wireWpSliders();
    }
    thumb.innerHTML = (type === 'video'
      ? `<video class="tto-wp-bg" src="${url}" autoplay loop muted playsinline></video><video class="tto-wp-fg" src="${url}" autoplay loop muted playsinline></video>`
      : `<img class="tto-wp-bg" src="${url}" alt=""><img class="tto-wp-fg" src="${url}" alt="">`)
      + `<div class="tto-wp-badge">${type === 'video' ? I.vidTag + ' Video' : I.imgTag + ' Görsel'}</div>`;
    if (fgBase) applyColorTheme(_state.theme, _state.adj, _state.customAccent, fgBase, true);
    const saveBtn = overlay.querySelector('#tto-save');
    if (saveBtn) { saveBtn.textContent = 'Wallpaper Kaydet'; saveBtn.classList.add('tto-save-pending'); }
  }

  overlay.querySelector('#tto-file').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    handleFile(file);
  });

  // ── Remove wallpaper ──
  overlay.querySelector('#tto-rm')?.addEventListener('click', async () => {
    await Promise.all([deleteWp().catch(() => {}), storeRemove([STORAGE_KEY])]);
    if (_wpObjectUrl) { URL.revokeObjectURL(_wpObjectUrl); _wpObjectUrl = null; }
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    _state.fgBase = null; _wpMeta = null; pendingFile = null;
    closeThemesPage();
  });

  // ─── Reset Helpers — her section için temizleme fonksiyonları ──────────
  // İnce Ayar: hue/sat/light + vurgu rengi (customAccent)
  function resetAdjustments() {
    if (hueR) { hueR.value = 0; setPct(hueR); if (vHue) vHue.textContent = '0°'; }
    if (satR) { satR.value = 0; setPct(satR); if (vSat) vSat.textContent = '0'; }
    if (lgtR) { lgtR.value = 0; setPct(lgtR); if (vLgt) vLgt.textContent = '0'; }
    const adj = { hue: 0, sat: 0, light: 0 };
    _state.adj = adj;
    _state.customAccent = '';
    const acHexEl = overlay.querySelector('#tto-accent-hex');
    const acWrap  = overlay.querySelector('#tto-accent-swatches');
    if (acHexEl) acHexEl.value = '';
    if (acWrap) acWrap.querySelectorAll('.tto-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.hex === '')
    );
    applyColorTheme(_state.theme, adj, '', _state.fgBase, false);
    storeSet({ [ADJ_KEY]: adj, [ACCENT_KEY]: '' });
  }
  // Wallpaper: opacity/blur/dimOpacity (file kalır, sadece ayar slider'ları sıfırlanır)
  // Varsayılanlar: opacity=1.0, blur=0px, dimOpacity=0.45
  function resetWallpaper() {
    const opEl = overlay.querySelector('#tto-op');
    const blEl = overlay.querySelector('#tto-bl');
    const dmEl = overlay.querySelector('#tto-dm');
    if (opEl) { opEl.value = 100; setPct(opEl); const v = overlay.querySelector('#v-op'); if (v) v.textContent = '100%'; }
    if (blEl) { blEl.value = 0;   setPct(blEl); const v = overlay.querySelector('#v-bl'); if (v) v.textContent = '0px'; }
    if (dmEl) { dmEl.value = 45;  setPct(dmEl); const v = overlay.querySelector('#v-dm'); if (v) v.textContent = '45%'; }
    // Mevcut wallpaper layer'a CSS vars direkt uygula (anlık görsel etki)
    const layer = document.getElementById('tracked-wallpaper-layer') || document.querySelector('[id^="tracked-wallpaper"]');
    if (layer) {
      layer.style.setProperty('--twp-opacity', '1');
      layer.style.setProperty('--twp-blur', '0px');
      layer.style.setProperty('--twp-dim', '0.45');
    }
    // Meta storage'a kaydet (varsa)
    storeGet(STORAGE_KEY).then(d => {
      const meta = d?.[STORAGE_KEY];
      if (meta) {
        meta.opacity = 1.0; meta.blur = 0; meta.dimOpacity = 0.45;
        storeSet({ [STORAGE_KEY]: meta });
      }
    });
  }
  // Görünüm: kart çerçevesi, panel rengi/opaklık/blur, header opaklık, içerik genişliği
  function resetView() {
    _state.cardFrame    = DEFAULT_CARD_FRAME;
    _state.panelColor   = DEFAULT_PANEL_COLOR;
    _state.panelOpacity = DEFAULT_PANEL_OPACITY;
    _state.panelBlur    = DEFAULT_PANEL_BLUR;
    _state.headerOpacity= DEFAULT_HEADER_OPACITY;
    _state.panelWidth   = DEFAULT_PANEL_WIDTH;
    // UI elemanlarını güncelle
    const cfEl     = overlay.querySelector('#tto-card-frame');
    const pnlHex   = overlay.querySelector('#tto-panel-hex');
    const pnlSw    = overlay.querySelector('#tto-panel-swatches');
    const pnlOpEl  = overlay.querySelector('#tto-panel-op');
    const pnlBlEl  = overlay.querySelector('#tto-panel-bl');
    const hdrOpEl  = overlay.querySelector('#tto-header-op');
    const pnlWEl   = overlay.querySelector('#tto-panel-w');
    if (cfEl) cfEl.checked = DEFAULT_CARD_FRAME;
    if (pnlHex) pnlHex.value = DEFAULT_PANEL_COLOR;
    if (pnlSw) pnlSw.querySelectorAll('.tto-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.hex?.toLowerCase() === DEFAULT_PANEL_COLOR.toLowerCase())
    );
    if (pnlOpEl) { pnlOpEl.value = Math.round(DEFAULT_PANEL_OPACITY * 100); setPct(pnlOpEl); const v = overlay.querySelector('#v-panel-op'); if (v) v.textContent = pnlOpEl.value + '%'; }
    if (pnlBlEl) { pnlBlEl.value = DEFAULT_PANEL_BLUR; setPct(pnlBlEl); const v = overlay.querySelector('#v-panel-bl'); if (v) v.textContent = pnlBlEl.value + 'px'; }
    if (hdrOpEl) { hdrOpEl.value = Math.round(DEFAULT_HEADER_OPACITY * 100); setPct(hdrOpEl); const v = overlay.querySelector('#v-header-op'); if (v) v.textContent = hdrOpEl.value + '%'; }
    if (pnlWEl)  { pnlWEl.value  = DEFAULT_PANEL_WIDTH; setPct(pnlWEl);  const v = overlay.querySelector('#v-panel-w');  if (v) v.textContent = pnlWEl.value  + '%'; }
    // Arama kutusu → varsayılan (özelleştirme kapalı = Roblox görünümü)
    _state.searchCustom = DEFAULT_SEARCH_CUSTOM;
    _state.searchColor  = DEFAULT_SEARCH_COLOR;
    _state.searchOpacity= DEFAULT_SEARCH_OPACITY;
    const srchTgl = overlay.querySelector('#tto-search-custom');
    const srchHex = overlay.querySelector('#tto-search-hex');
    const srchSw  = overlay.querySelector('#tto-search-swatches');
    const srchOp  = overlay.querySelector('#tto-search-op');
    if (srchTgl) srchTgl.checked = DEFAULT_SEARCH_CUSTOM;
    if (srchHex) srchHex.value = DEFAULT_SEARCH_COLOR;
    if (srchSw) srchSw.querySelectorAll('.tto-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.hex?.toLowerCase() === DEFAULT_SEARCH_COLOR.toLowerCase())
    );
    if (srchOp) { srchOp.value = Math.round(DEFAULT_SEARCH_OPACITY*100); setPct(srchOp); const v = overlay.querySelector('#v-search-op'); if (v) v.textContent = srchOp.value + '%'; }
    // Yazı rengi + yazı tipi → varsayılan
    _state.textColor = DEFAULT_TEXT_COLOR;
    _state.textFont  = DEFAULT_TEXT_FONT;
    const tcSw  = overlay.querySelector('#tto-text-color-swatches');
    const tcHex = overlay.querySelector('#tto-text-color-hex');
    const tfCur = overlay.querySelector('#tto-font-cur');
    if (tcHex) tcHex.value = DEFAULT_TEXT_COLOR;
    if (tcSw) tcSw.querySelectorAll('.tto-swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.hex ? false : true)
    );
    if (tfCur) { tfCur.textContent = TEXT_FONTS[DEFAULT_TEXT_FONT].label; tfCur.style.fontFamily = TEXT_FONTS[DEFAULT_TEXT_FONT].stack || 'inherit'; }
    applyCardFrame(DEFAULT_CARD_FRAME);
    applyPanelVars(DEFAULT_PANEL_COLOR, DEFAULT_PANEL_OPACITY, DEFAULT_PANEL_BLUR, DEFAULT_PANEL_WIDTH);
    applyHeaderOpacity(DEFAULT_HEADER_OPACITY);
    applySearchColor(DEFAULT_SEARCH_CUSTOM, DEFAULT_SEARCH_COLOR, DEFAULT_SEARCH_OPACITY);
    applyTextColor(DEFAULT_TEXT_COLOR);
    applyTextFont(DEFAULT_TEXT_FONT);
    storeSet({
      [PANEL_COLOR_KEY]:   DEFAULT_PANEL_COLOR,
      [PANEL_OPACITY_KEY]: DEFAULT_PANEL_OPACITY,
      [PANEL_BLUR_KEY]:    DEFAULT_PANEL_BLUR,
      [HEADER_OPACITY_KEY]:DEFAULT_HEADER_OPACITY,
      [PANEL_WIDTH_KEY]:   DEFAULT_PANEL_WIDTH,
      [CARD_FRAME_KEY]:    DEFAULT_CARD_FRAME,
      [SEARCH_CUSTOM_KEY]:  DEFAULT_SEARCH_CUSTOM,
      [SEARCH_COLOR_KEY]:   DEFAULT_SEARCH_COLOR,
      [SEARCH_OPACITY_KEY]: DEFAULT_SEARCH_OPACITY,
      [TEXT_COLOR_KEY]:     DEFAULT_TEXT_COLOR,
      [TEXT_FONT_KEY]:      DEFAULT_TEXT_FONT,
    });
  }
  // Sayfa Temaları: tüm pageOverrides'ı temizle
  function resetPages() {
    _state.pageOverrides = {};
    overlay.querySelectorAll('.tto-override-select').forEach(sel => { sel.value = ''; });
    storeSet({ [OVERRIDES_KEY]: {} });
  }

  // ─── Reset Button Wiring ───────────────────────────────────────────────
  overlay.querySelector('#tto-reset-adj')?.addEventListener('click', resetAdjustments);
  overlay.querySelector('#tto-reset-wp')?.addEventListener('click', resetWallpaper);
  overlay.querySelector('#tto-reset-view')?.addEventListener('click', resetView);
  overlay.querySelector('#tto-reset-pages')?.addEventListener('click', resetPages);

  // ─── Hepsini Sıfırla — Onay Dialog'lu ──────────────────────────────────
  overlay.querySelector('#tto-reset-all')?.addEventListener('click', () => {
    // Modal oluştur
    const modal = document.createElement('div');
    modal.className = 'tto-modal-overlay';
    modal.innerHTML = `
      <div class="tto-modal">
        <div class="tto-modal-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="tto-modal-title">Tüm tema ayarları sıfırlansın mı?</div>
        <div class="tto-modal-text">
          Bu işlem <b>İnce Ayar</b>, <b>Wallpaper ayarları</b> (görsel hariç), <b>Görünüm</b> ve <b>Sayfa Temaları</b> bölümlerindeki tüm özelleştirmeleri varsayılana döndürür.
          <br><br>Bu işlem <b>geri alınamaz</b>.
        </div>
        <div class="tto-modal-actions">
          <button class="tto-modal-btn tto-modal-btn-cancel" id="tto-modal-cancel">İptal</button>
          <button class="tto-modal-btn tto-modal-btn-danger" id="tto-modal-confirm">Evet, Sıfırla</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // Animasyon için bir frame bekle
    requestAnimationFrame(() => modal.classList.add('show'));

    const close = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 200);
    };
    modal.querySelector('#tto-modal-cancel').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('#tto-modal-confirm').addEventListener('click', () => {
      resetAdjustments();
      resetWallpaper();
      resetView();
      resetPages();
      close();
    });
  });

  // ── Page overrides (collapsed) ──
  const colBtn  = overlay.querySelector('#tto-col-btn');
  const colBody = overlay.querySelector('#tto-overrides');
  colBtn.addEventListener('click', () => {
    const open = colBody.style.display !== 'none';
    colBody.style.display = open ? 'none' : 'flex';
    colBtn.classList.toggle('tto-col-open', !open);
    saveThemesUi(); // HAFIZA: açık/kapalı durumu hatırla
  });
  overlay.querySelectorAll('.tto-override-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const path = sel.dataset.path;
      if (!path || path === 'undefined') return;   // bozuk anahtar storage'a asla yazılmasın
      if (sel.value) _state.pageOverrides[path] = sel.value;
      else delete _state.pageOverrides[path];
      await storeSet({ [OVERRIDES_KEY]: _state.pageOverrides });
    });
  });

  // ── Gelişmiş Ayarlar (kartlara özel renk/opaklık/cam) ──
  {
    const advBtn   = overlay.querySelector('#tto-adv-btn');
    const advBody  = overlay.querySelector('#tto-adv-body');
    const advTgl   = overlay.querySelector('#tto-card-adv');
    const cSwatch  = overlay.querySelector('#tto-card-swatches');
    const cHex     = overlay.querySelector('#tto-card-hex');
    const cOpR     = overlay.querySelector('#tto-card-op');
    const cBlR     = overlay.querySelector('#tto-card-bl');
    let _advLive = null, _advSave = null;
    let curCardColor = _state.cardColor;

    // Collapse aç/kapa (uyarı banner body içinde, açınca görünür)
    if (advBtn && advBody) {
      advBtn.addEventListener('click', () => {
        const open = advBody.style.display !== 'none';
        advBody.style.display = open ? 'none' : 'flex';
        advBtn.classList.toggle('tto-col-open', !open);
        saveThemesUi(); // HAFIZA: açık/kapalı durumu hatırla
      });
    }

    function liveCard() {
      // Gelişmiş mod kapalıysa değişkenleri temizler (kartlar panele döner)
      applyCardAdvanced(
        !!(advTgl && advTgl.checked),
        /^#[0-9a-f]{6}$/i.test(cHex.value.trim()) ? cHex.value.trim() : curCardColor,
        parseInt(cOpR.value) / 100,
        parseInt(cBlR.value)
      );
    }
    function saveCardDebounced() {
      clearTimeout(_advSave);
      _advSave = setTimeout(() => {
        _state.cardAdv     = !!(advTgl && advTgl.checked);
        _state.cardColor   = curCardColor;
        _state.cardOpacity = parseInt(cOpR.value) / 100;
        _state.cardBlur    = parseInt(cBlR.value);
        storeSet({
          [CARD_ADV_KEY]:     _state.cardAdv,
          [CARD_COLOR_KEY]:   _state.cardColor,
          [CARD_OPACITY_KEY]: _state.cardOpacity,
          [CARD_BLUR_KEY]:    _state.cardBlur
        });
      }, 400);
    }
    function setCardColor(hex) {
      curCardColor = hex;
      if (cHex) cHex.value = hex;
      cSwatch && cSwatch.querySelectorAll('.tto-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.hex.toLowerCase() === hex.toLowerCase())
      );
      clearTimeout(_advLive); _advLive = setTimeout(liveCard, 60);
      saveCardDebounced();
    }

    if (advTgl) advTgl.addEventListener('change', () => { liveCard(); saveCardDebounced(); });

    // Metin kontrastı toggle — anlık uygula + kaydet
    const tcTgl = overlay.querySelector('#tto-text-contrast');
    if (tcTgl) tcTgl.addEventListener('change', () => {
      _state.textContrast = !!tcTgl.checked;
      applyTextContrast(_state.textContrast);
      storeSet({ [TEXT_CONTRAST_KEY]: _state.textContrast });
    });

    // Yazı rengi (swatch + hex) — '' = varsayılan (dokunma). Anlık uygula + kaydet.
    const txtColorSw  = overlay.querySelector('#tto-text-color-swatches');
    const txtColorHex = overlay.querySelector('#tto-text-color-hex');
    function setTextColor(hex) {
      _state.textColor = hex || '';
      if (txtColorHex) txtColorHex.value = _state.textColor;
      txtColorSw && txtColorSw.querySelectorAll('.tto-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.hex ? s.dataset.hex.toLowerCase() === _state.textColor.toLowerCase() : !_state.textColor)
      );
      applyTextColor(_state.textColor);
      storeSet({ [TEXT_COLOR_KEY]: _state.textColor });
    }
    if (txtColorSw) txtColorSw.addEventListener('click', e => {
      const s = e.target.closest('.tto-swatch'); if (s) setTextColor(s.dataset.hex || '');
    });
    if (txtColorHex) txtColorHex.addEventListener('input', () => {
      const v = txtColorHex.value.trim();
      if (v === '') { setTextColor(''); return; }
      if (!/^#[0-9a-f]{6}$/i.test(v)) return; setTextColor(v);
    });
    const txtColorPick = overlay.querySelector('#tto-text-color-pick');
    if (txtColorPick) txtColorPick.addEventListener('change', () => setTextColor(txtColorPick.value));

    // Yazı tipi — özel temalı dropdown (native select yerine). Menü body'e PORTAL edilir (.tto-scroll
    // overflow'undan kaçar), fixed konumlanır; yer yoksa yukarı açılır. Her seçenek KENDİ fontunda önizlenir.
    (function setupFontDropdown() {
      const fdd  = overlay.querySelector('#tto-font-dd');
      const fbtn = overlay.querySelector('#tto-font-btn');
      const fcur = overlay.querySelector('#tto-font-cur');
      if (!fdd || !fbtn) return;
      let menu = null;
      const optsHTML = Object.keys(TEXT_FONTS).map(k => {
        const f = TEXT_FONTS[k];
        const fam = f.stack ? f.stack.replace(/"/g, '&quot;') : 'inherit';
        const act = (k === (TEXT_FONTS[_state.textFont] ? _state.textFont : '')) ? ' active' : '';
        return `<button type="button" class="tto-fontdd-opt${act}" data-font="${k}" style="font-family:${fam}">${f.label}</button>`;
      }).join('');
      const close = () => {
        if (menu) { menu.remove(); menu = null; }
        fdd.classList.remove('open'); fbtn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('mousedown', onOut, true);
        document.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', close);
      };
      const onOut = (e) => { if (menu && !menu.contains(e.target) && !fdd.contains(e.target)) close(); };
      // Menü İÇİ kaydırmada kapanma; sadece dışarıdaki (panel/sayfa) kaydırmada kapat.
      const onScroll = (e) => { if (menu && menu.contains(e.target)) return; close(); };
      const open = () => {
        menu = document.createElement('div');
        menu.className = 'tto-fontdd-menu';
        menu.innerHTML = optsHTML;
        document.body.appendChild(menu);
        const r = fbtn.getBoundingClientRect();
        menu.style.minWidth = Math.max(190, r.width) + 'px';
        menu.style.left = Math.round(Math.min(r.left, window.innerWidth - menu.offsetWidth - 12)) + 'px';
        const spaceBelow = window.innerHeight - r.bottom;
        if (spaceBelow < 260 && r.top > 260) menu.style.bottom = Math.round(window.innerHeight - r.top + 6) + 'px';
        else menu.style.top = Math.round(r.bottom + 6) + 'px';
        fdd.classList.add('open'); fbtn.setAttribute('aria-expanded', 'true');
        menu.querySelectorAll('.tto-fontdd-opt').forEach(opt => {
          opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const k = TEXT_FONTS[opt.dataset.font] ? opt.dataset.font : '';
            _state.textFont = k;
            applyTextFont(k);
            storeSet({ [TEXT_FONT_KEY]: k });
            if (fcur) { fcur.textContent = TEXT_FONTS[k].label; fcur.style.fontFamily = TEXT_FONTS[k].stack || 'inherit'; }
            close();
          });
        });
        setTimeout(() => {
          document.addEventListener('mousedown', onOut, true);
          document.addEventListener('scroll', onScroll, true);
          window.addEventListener('resize', close);
        }, 0);
      };
      fbtn.addEventListener('click', (e) => { e.stopPropagation(); if (menu) close(); else open(); });
    })();
    if (cSwatch) cSwatch.addEventListener('click', e => {
      const s = e.target.closest('.tto-swatch'); if (s) setCardColor(s.dataset.hex);
    });
    if (cHex) cHex.addEventListener('input', () => {
      const v = cHex.value.trim(); if (!/^#[0-9a-f]{6}$/i.test(v)) return; setCardColor(v);
    });
    const cPick = overlay.querySelector('#tto-card-pick');
    if (cPick) cPick.addEventListener('change', () => setCardColor(cPick.value));
    if (cOpR) cOpR.addEventListener('input', () => {
      setPct(cOpR);
      const vEl = overlay.querySelector('#v-card-op'); if (vEl) vEl.textContent = cOpR.value + '%';
      clearTimeout(_advLive); _advLive = setTimeout(liveCard, 60); saveCardDebounced();
    });
    if (cBlR) cBlR.addEventListener('input', () => {
      setPct(cBlR);
      const vEl = overlay.querySelector('#v-card-bl'); if (vEl) vEl.textContent = cBlR.value + 'px';
      clearTimeout(_advLive); _advLive = setTimeout(liveCard, 60); saveCardDebounced();
    });
  }

  // ── Arama Kutusu rengi (özelleştirilebilir, default kapalı = Roblox varsayılanı) ──
  {
    const sTgl    = overlay.querySelector('#tto-search-custom');
    const sSwatch = overlay.querySelector('#tto-search-swatches');
    const sHex    = overlay.querySelector('#tto-search-hex');
    const sOpR    = overlay.querySelector('#tto-search-op');
    let _sLive = null, _sSave = null;
    let curSearchColor = _state.searchColor;

    function liveSearch() {
      applySearchColor(
        !!(sTgl && sTgl.checked),
        /^#[0-9a-f]{6}$/i.test(sHex.value.trim()) ? sHex.value.trim() : curSearchColor,
        parseInt(sOpR.value) / 100
      );
    }
    function saveSearchDebounced() {
      clearTimeout(_sSave);
      _sSave = setTimeout(() => {
        _state.searchCustom  = !!(sTgl && sTgl.checked);
        _state.searchColor   = curSearchColor;
        _state.searchOpacity = parseInt(sOpR.value) / 100;
        storeSet({
          [SEARCH_CUSTOM_KEY]:  _state.searchCustom,
          [SEARCH_COLOR_KEY]:   _state.searchColor,
          [SEARCH_OPACITY_KEY]: _state.searchOpacity
        });
      }, 400);
    }
    function setSearchColor(hex) {
      curSearchColor = hex;
      if (sHex) sHex.value = hex;
      sSwatch && sSwatch.querySelectorAll('.tto-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.hex.toLowerCase() === hex.toLowerCase())
      );
      clearTimeout(_sLive); _sLive = setTimeout(liveSearch, 60);
      saveSearchDebounced();
    }
    if (sTgl) sTgl.addEventListener('change', () => { liveSearch(); saveSearchDebounced(); });
    if (sSwatch) sSwatch.addEventListener('click', e => {
      const s = e.target.closest('.tto-swatch'); if (s) setSearchColor(s.dataset.hex);
    });
    if (sHex) sHex.addEventListener('input', () => {
      const v = sHex.value.trim(); if (!/^#[0-9a-f]{6}$/i.test(v)) return; setSearchColor(v);
    });
    const sPick = overlay.querySelector('#tto-search-pick');
    if (sPick) sPick.addEventListener('change', () => setSearchColor(sPick.value));
    if (sOpR) sOpR.addEventListener('input', () => {
      setPct(sOpR);
      const vEl = overlay.querySelector('#v-search-op'); if (vEl) vEl.textContent = sOpR.value + '%';
      clearTimeout(_sLive); _sLive = setTimeout(liveSearch, 60); saveSearchDebounced();
    });
  }

  // ── Export ──
  const exportBtn = overlay.querySelector('#tto-export-btn');
  const EXPORT_ICON_HTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
  exportBtn.addEventListener('click', async () => {
    const code = exportTheme(); if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      exportBtn.innerHTML = EXPORT_ICON_HTML + ' Panoya kopyalandı!';
    } catch {
      exportBtn.innerHTML = EXPORT_ICON_HTML + ' Hata — tekrar dene';
    }
    setTimeout(() => { exportBtn.innerHTML = EXPORT_ICON_HTML + ' Mevcut temayı dışa aktar'; }, 2200);
  });

  // ── Import ──
  const impInput = overlay.querySelector('#tto-imp-input');
  const impBtn   = overlay.querySelector('#tto-imp-btn');
  const shareMsg = overlay.querySelector('#tto-share-msg');
  impBtn.addEventListener('click', async () => {
    const str = impInput.value.trim();
    shareMsg.textContent = ''; shareMsg.className = 'tto-share-msg';
    if (!str) { shareMsg.textContent = 'Lütfen bir tema kodu yapıştır.'; return; }
    try {
      await importTheme(str);
      shareMsg.textContent = 'Tema uygulandı!'; shareMsg.className = 'tto-share-msg tto-sm-ok';
      impInput.value = '';
      grid.querySelectorAll('.tto-grid-card').forEach(c => {
        c.classList.toggle('tto-gc-active', c.dataset.preset === _state.theme);
        c.setAttribute('aria-pressed', c.dataset.preset === _state.theme ? 'true' : 'false');
      });
      hueR.value = _state.adj.hue   ?? 0; setPct(hueR); if (vHue) { const v=parseInt(hueR.value); vHue.textContent=(v>0?'+'+v:v)+'°'; }
      satR.value = _state.adj.sat   ?? 0; setPct(satR); if (vSat) { const v=parseInt(satR.value); vSat.textContent=v>0?'+'+v:String(v); }
      lgtR.value = _state.adj.light ?? 0; setPct(lgtR); if (vLgt) { const v=parseInt(lgtR.value); vLgt.textContent=v>0?'+'+v:String(v); }
      const pnlOpEl  = overlay.querySelector('#tto-panel-op');
      const pnlBlEl  = overlay.querySelector('#tto-panel-bl');
      const pnlHexEl = overlay.querySelector('#tto-panel-hex');
      const swWrap   = overlay.querySelector('#tto-panel-swatches');
      if (pnlOpEl)  { pnlOpEl.value  = Math.round(_state.panelOpacity * 100); setPct(pnlOpEl); const vEl=overlay.querySelector('#v-panel-op'); if(vEl) vEl.textContent=pnlOpEl.value+'%'; }
      if (pnlBlEl)  { pnlBlEl.value  = _state.panelBlur; setPct(pnlBlEl); const vEl=overlay.querySelector('#v-panel-bl'); if(vEl) vEl.textContent=pnlBlEl.value+'px'; }
      if (pnlHexEl) {
        pnlHexEl.value = _state.panelColor;
        swWrap?.querySelectorAll('.tto-swatch').forEach(s =>
          s.classList.toggle('active', s.dataset.hex.toLowerCase() === _state.panelColor.toLowerCase())
        );
      }
      const hdrOpEl = overlay.querySelector('#tto-header-op');
      if (hdrOpEl) { hdrOpEl.value = Math.round(_state.headerOpacity * 100); setPct(hdrOpEl); const vEl=overlay.querySelector('#v-header-op'); if(vEl) vEl.textContent=hdrOpEl.value+'%'; }
      const pnlWEl = overlay.querySelector('#tto-panel-w');
      if (pnlWEl) { pnlWEl.value = _state.panelWidth; setPct(pnlWEl); const vEl=overlay.querySelector('#v-panel-w'); if(vEl) vEl.textContent=pnlWEl.value+'%'; }
      const cfEl = overlay.querySelector('#tto-card-frame');
      if (cfEl) cfEl.checked = _state.cardFrame;
      const tfCurEl = overlay.querySelector('#tto-font-cur');
      if (tfCurEl) { const fk = TEXT_FONTS[_state.textFont] ? _state.textFont : ''; tfCurEl.textContent = TEXT_FONTS[fk].label; tfCurEl.style.fontFamily = TEXT_FONTS[fk].stack || 'inherit'; }
      const acHexEl2 = overlay.querySelector('#tto-accent-hex');
      const acWrap2  = overlay.querySelector('#tto-accent-swatches');
      if (acHexEl2) acHexEl2.value = _state.customAccent || '';
      if (acWrap2) acWrap2.querySelectorAll('.tto-swatch').forEach(s =>
        s.classList.toggle('active', _state.customAccent ? s.dataset.hex?.toLowerCase() === _state.customAccent.toLowerCase() : s.dataset.hex === '')
      );
      const p = PRESETS[_state.theme] || PRESETS.midnight;
      TK_KEYS.forEach(k => mock.style.removeProperty(k));
      liveName.textContent = p.label; liveMood.textContent = p.mood;
    } catch (e) {
      shareMsg.textContent = `Geçersiz kod: ${e.message}`; shareMsg.className = 'tto-share-msg tto-sm-err';
    }
  });
  impInput.addEventListener('keydown', e => { if (e.key === 'Enter') impBtn.click(); });

  // ── Save (wallpaper only) ──
  overlay.querySelector('#tto-save').addEventListener('click', async () => {
    const btn   = overlay.querySelector('#tto-save');
    const newOp = parseInt(overlay.querySelector('#tto-op')?.value ?? Math.round(opV*100)) / 100;
    const newBl = parseInt(overlay.querySelector('#tto-bl')?.value ?? blV);
    const newDm = parseInt(overlay.querySelector('#tto-dm')?.value ?? Math.round(dmV*100)) / 100;

    if (pendingFile) {
      if (!(await hasQuota(pendingFile.blob.size))) {
        const err = document.createElement('p'); err.className = 'tto-file-err';
        err.textContent = 'Yetersiz depolama alanı. Daha küçük bir dosya seçin.';
        dropZone.after(err); return;
      }
      btn.textContent = 'Kaydediliyor…'; btn.disabled = true;
      try {
        await writeWp(pendingFile.blob, pendingFile.type, pendingFile.mimeType);
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          btn.textContent = 'Kaydet'; btn.disabled = false;
          const err = document.createElement('p'); err.className = 'tto-file-err';
          err.textContent = 'Depolama dolu. Mevcut wallpaper kaldırılıp tekrar deneyin.';
          dropZone.after(err); return;
        }
        throw e;
      }
      const newMeta = { type: pendingFile.type, opacity: newOp, blur: newBl, dimOpacity: newDm };
      if (pendingFile.fgBase) newMeta.fgBase = pendingFile.fgBase;
      await storeSet({ [STORAGE_KEY]: newMeta });
    } else if (hasWp) {
      btn.textContent = 'Kaydediliyor…'; btn.disabled = true;
      const curMeta = await getWallpaperMeta();
      if (curMeta) await storeSet({ [STORAGE_KEY]: { ...curMeta, opacity: newOp, blur: newBl, dimOpacity: newDm } });
    }

    await applyWallpaper();   // F5 GEREKMEDEN canlı uygula (storage listener'ına güvenme — yarış/zamanlama)
    closeThemesPage();
  });
}

// ── Avatar rotation controls ──────────────────────────────────
function isAvatarViewerPage(pathname) {
  return /^\/users\/\d+\/profile/.test(pathname);
}

function findAvatarCanvas() {
  // Three.js renderer stamps data-engine on its canvas
  const threeCanvas = document.querySelector('canvas[data-engine*="three.js"]');
  if (threeCanvas) return threeCanvas;
  for (const sel of ['[class*="avatar"] canvas','[class*="Avatar"] canvas','[class*="character"] canvas','[class*="Character"] canvas']) {
    const c = document.querySelector(sel);
    if (c) return c;
  }
  let best = null, bestArea = 0;
  for (const canvas of document.querySelectorAll('canvas')) {
    const r = canvas.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea && r.width > 80) { best = canvas; bestArea = area; }
  }
  return best;
}

// Hem PointerEvent hem MouseEvent gönderir (viewer hangisini dinliyorsa) +
// movementX enjekte eder (bazı viewer'lar clientX deltası yerine movementX kullanır).
function _fireDragEvt(target, ptrType, mouseType, x, y, dx) {
  const common = {
    bubbles: true, cancelable: true, view: window,
    clientX: x, clientY: y, screenX: x, screenY: y,
    button: 0, buttons: 1
  };
  const pe = new PointerEvent(ptrType, { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true });
  if (dx != null) { try { Object.defineProperty(pe, 'movementX', { value: dx }); Object.defineProperty(pe, 'movementY', { value: 0 }); } catch (_) {} }
  target.dispatchEvent(pe);
  const me = new MouseEvent(mouseType, common);
  if (dx != null) { try { Object.defineProperty(me, 'movementX', { value: dx }); Object.defineProperty(me, 'movementY', { value: 0 }); } catch (_) {} }
  target.dispatchEvent(me);
}

function dragAvatar(totalDx) {
  const canvas = findAvatarCanvas();
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const cy = rect.top + rect.height / 2;
  let x = rect.left + rect.width / 2;

  // setPointerCapture(1) sahte pointer'da exception fırlatıp viewer handler'ını
  // kırabilir → geçici olarak no-op'la, drag bitince geri al.
  const origSet = canvas.setPointerCapture;
  const origRel = canvas.releasePointerCapture;
  try { canvas.setPointerCapture = () => {}; canvas.releasePointerCapture = () => {}; } catch (_) {}
  const restore = () => { try { canvas.setPointerCapture = origSet; canvas.releasePointerCapture = origRel; } catch (_) {} };

  _fireDragEvt(canvas, 'pointerdown', 'mousedown', x, cy, 0);

  const steps = 12;
  const per = totalDx / steps;
  let i = 0;
  const step = () => {
    if (i++ < steps) {
      x += per;
      // canvas + document (OrbitControls move/up listener'larını document'a ekler)
      _fireDragEvt(canvas, 'pointermove', 'mousemove', x, cy, per);
      _fireDragEvt(document, 'pointermove', 'mousemove', x, cy, per);
      requestAnimationFrame(step);
    } else {
      _fireDragEvt(canvas, 'pointerup', 'mouseup', x, cy, 0);
      _fireDragEvt(document, 'pointerup', 'mouseup', x, cy, 0);
      restore();
    }
  };
  requestAnimationFrame(step);
}

function patchAvatarCanvasTransparency(canvas) {
  if (canvas._tkPatched) return;
  canvas._tkPatched = true;
  const clearBg = el => {
    el.style.setProperty('background', 'transparent', 'important');
    el.style.setProperty('background-color', 'transparent', 'important');
    el.style.setProperty('background-image', 'none', 'important');
  };
  clearBg(canvas);
  let el = canvas.parentElement;
  for (let i = 0; i < 5 && el && el !== document.body; i++) {
    if ((el.id || '').startsWith('tracked-')) break;
    clearBg(el);
    el = el.parentElement;
  }
}

function injectAvatarControls() {
  if (document.getElementById(AVATAR_CTRL_ID)) return;
  const canvas = findAvatarCanvas();
  if (!canvas) return;

  patchAvatarCanvasTransparency(canvas);

  // Walk up to find an already-positioned ancestor — never modify existing layout,
  // which would create a new containing block and misplace Roblox's native 2D button.
  let container = canvas.parentElement;
  for (let i = 0; i < 8 && container && container !== document.body; i++) {
    if (getComputedStyle(container).position !== 'static') break;
    container = container.parentElement;
  }
  if (!container || container === document.body) {
    container = canvas.parentElement;
    if (!container) return;
    container.style.position = 'relative';
  }

  // Position the overlay to cover exactly the canvas area within the container.
  const canvasR = canvas.getBoundingClientRect();
  const contR   = container.getBoundingClientRect();

  const ctrl = document.createElement('div');
  ctrl.id = AVATAR_CTRL_ID;
  ctrl.style.top    = (canvasR.top  - contR.top  + container.scrollTop)  + 'px';
  ctrl.style.left   = (canvasR.left - contR.left + container.scrollLeft) + 'px';
  ctrl.style.width  = canvasR.width  + 'px';
  ctrl.style.height = canvasR.height + 'px';

  const btnL = document.createElement('button');
  btnL.className = 'tracked-viewer-btn';
  btnL.setAttribute('title', 'Rotate Left');
  btnL.innerHTML = CHEV_L_SVG;
  btnL.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); dragAvatar(-65); });

  const btnR = document.createElement('button');
  btnR.className = 'tracked-viewer-btn';
  btnR.setAttribute('title', 'Rotate Right');
  btnR.innerHTML = CHEV_R_SVG;
  btnR.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); dragAvatar(65); });

  ctrl.appendChild(btnL);
  ctrl.appendChild(btnR);
  container.appendChild(ctrl);

  // Fix native 2D/3D toggle button clip: walk its ancestor chain and unset any
  // overflow:hidden that causes the button's top edge to be cut off.
  for (const btn of document.querySelectorAll('button')) {
    const txt = btn.textContent?.trim();
    if (txt !== '2D' && txt !== '3D') continue;
    const btnR = btn.getBoundingClientRect();
    if (!btnR.width) continue;
    let el = btn.parentElement;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') {
        const elR = el.getBoundingClientRect();
        if (btnR.top < elR.top + 2) el.style.overflow = 'visible';
      }
      el = el.parentElement;
    }
    break;
  }
}

// ── Init ──────────────────────────────────────────────────────
// ── Tema efektlerini topluca uygula (init + Plus canlı-aktifleşmede ortak kullanılır) ──
function applyAllThemeEffects() {
  injectStyles();
  applyColorTheme(_state.theme, _state.adj, _state.customAccent, _state.fgBase, true);
  applyPanelVars(_state.panelColor, _state.panelOpacity, _state.panelBlur, _state.panelWidth);
  applyHeaderOpacity(_state.headerOpacity);
  applyCardFrame(_state.cardFrame);
  applyCardAdvanced(_state.cardAdv, _state.cardColor, _state.cardOpacity, _state.cardBlur);
  applySearchColor(_state.searchCustom, _state.searchColor, _state.searchOpacity);
  applyTextColor(_state.textColor);
  applyTextFont(_state.textFont);
  applyTextContrast(_state.textContrast);
  applyWallpaper();
}

// ── Açık themes paneline Plus kilidini senkronla: Plus yoksa kilit overlay bin, varsa kaldır ──
async function _syncThemeLock() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  let plus = false;
  try { plus = await _tkPlus(); } catch (_) {}
  _tkPlusCached = plus;
  const existing = overlay.querySelector('#tto-plus-lock');
  if (plus) { if (existing) existing.remove(); return; }
  if (existing) return;
  const lock = document.createElement('div');
  lock.id = 'tto-plus-lock';
  lock.className = 'tto-plus-lock';
  lock.innerHTML =
    '<div class="tto-lock-card">' +
      '<div class="tto-lock-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none"/></svg></div>' +
      '<div class="tto-lock-title">Temalar — Tracked Plus</div>' +
      '<div class="tto-lock-sub">Site temalarını, wallpaper\'ı ve tüm görünüm ayarlarını açmak için Tracked Plus\'a yükselt.</div>' +
      '<button class="tto-lock-btn" id="tto-lock-upgrade">Plus\'a Yükselt</button>' +
      '<button class="tto-lock-back" id="tto-lock-back">Geri dön</button>' +
    '</div>';
  overlay.appendChild(lock);
  lock.querySelector('#tto-lock-upgrade').addEventListener('click', () => {
    try { chrome.runtime.sendMessage({ action: 'openPlusPage' }); } catch (_) {}
  });
  lock.querySelector('#tto-lock-back').addEventListener('click', () => {
    try { closeThemesPage(); } catch (_) {}
  });
}

async function init() {
  // ── BACKWARD COMPAT: Eski /themes ve /free-items bookmark'larını hash'e migrate et ──
  // Hash routing'e geçildi. Eski path-based URL'lerden gelen kullanıcıyı /home#tk-... 'a yönlendir.
  // location.replace = tek seferlik hard redirect, history kirletmez.
  if (location.pathname === '/themes') {
    location.replace('/home#' + TK_HASH_THEMES);
    return;
  }
  if (location.pathname === '/free-items') {
    location.replace('/home#' + TK_HASH_FI);
    return;
  }

  await Promise.all([migrateThemeKey(), migrateWallpaper()]);
  await loadState();

  // v1.9.0: İlk yüklemede de Communities sayfası class'ını set et (onNavChange sadece nav'da çalışır)
  const setCommunitiesClass = () => {
    document.body?.classList.toggle('tk-communities-page', /^\/communities(\/|$)/.test(location.pathname));
  };

  // ── Themes sidebar butonu HER DURUMDA enjekte edilir (tema kapalı/Default iken bile
  //    kullanıcı panelden yeniden açabilsin diye) ──
  let attempts = 0;
  function tryInject() {
    injectSidebarItem();
    if (!document.getElementById(SIDEBAR_ID) && attempts++ < 40) setTimeout(tryInject, 350);
  }
  setTimeout(tryInject, 200);

  // ── Temalar = Tracked Plus özelliği. Plus yoksa tema UYGULANMAZ (sayfa saf Roblox kalır);
  //    ancak sidebar butonu + panel yine açılır → panelde kilit gösterilir. ──
  let _plusNow = false;
  try { _plusNow = await _tkPlus(); } catch (_) {}
  _tkPlusCached = _plusNow;
  if (_state.themeEnabled && _plusNow) {
    // ── Tracked teması AÇIK → tüm efektleri uygula ──
    try { localStorage.removeItem('tk_theme_off'); } catch(_) {}
    if (document.body) setCommunitiesClass();
    else document.addEventListener('DOMContentLoaded', setCommunitiesClass, { once: true });

    applyAllThemeEffects();

    startCSSReinjector();

    setTimeout(fixCardTextBorders, 800);
    let _cardBorderDebounce = null;
    const _cardBorderObserver = new MutationObserver(() => {
      if (document.hidden) return; // tab arka plandayken çalışma
      clearTimeout(_cardBorderDebounce);
      _cardBorderDebounce = setTimeout(fixCardTextBorders, 300);
    });
    // Tab visible olduğunda observe et, hidden olunca disconnect → CPU tasarrufu
    function startCardBorderObs() {
      if (!document.hidden) _cardBorderObserver.observe(document.body, { childList: true, subtree: true });
    }
    startCardBorderObs();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        _cardBorderObserver.disconnect();
        clearTimeout(_cardBorderDebounce);
      } else {
        startCardBorderObs();
        fixCardTextBorders(); // hidden iken kaçırdıklarımızı yakala
      }
    });
  } else {
    // ── Tracked teması KAPALI (Default) → saf Roblox: erken/kritik stilleri temizle, efekt uygulama ──
    disableAllTheming();
  }

  if (isAvatarViewerPage(location.pathname)) {
    let av = 0;
    const tryAv = () => {
      injectAvatarControls();
      if (!document.getElementById(AVATAR_CTRL_ID) && av++ < 25) setTimeout(tryAv, 400);
    };
    setTimeout(tryAv, 500);
  }

  // Header'a "Ücretsiz Item" button inject et (loft profil ikonunun soluna)
  setTimeout(() => watchFreeItemsButton(), 300);
  // SPA navigation'da button kaybolursa tekrar inject
  let _fiBtnDebounce = null;
  new MutationObserver(() => {
    clearTimeout(_fiBtnDebounce);
    _fiBtnDebounce = setTimeout(() => {
      if (!document.getElementById(FI_BTN_ID)) injectFreeItemsButton();
    }, 400);
  }).observe(document.body, { childList: true, subtree: false });

  // ── URL → PanelManager SYNC ──────────────────────────────────
  // Tek giriş noktası: PanelManager.syncFromUrl(). 3 kaynaktan çağrılır:
  //   1) hashchange — browser back/forward (yalnız hash değiştiğinde fire eder)
  //   2) popstate   — path+hash birlikte değişiminde fire eder
  //   3) polling    — Roblox main world pushState'lerini yakalar (isolated world'den görünmez)
  const syncFromUrl = () => PanelManager.syncFromUrl();

  // Polling — sadece panel açıkken + tab visible iken çalışır (CPU tasarrufu)
  let _hashPollInterval = null;
  let _lastObservedHref = location.href;
  function ensureHashPollWatcher() {
    if (_hashPollInterval) return;
    _lastObservedHref = location.href;
    _hashPollInterval = setInterval(() => {
      if (document.hidden) return; // tab arka plandayken atla
      if (location.href === _lastObservedHref) return;
      _lastObservedHref = location.href;
      syncFromUrl();
      if (PanelManager.current === null && !PanelManager.pending) {
        clearInterval(_hashPollInterval);
        _hashPollInterval = null;
      }
    }, 200);
  }
  window._trackedEnsureHashPoll = ensureHashPollWatcher;

  // Tab visible olunca URL'i tek seferlik yakalama yap (kaçırdığımız değişimi al)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (location.href !== _lastObservedHref) {
        _lastObservedHref = location.href;
        syncFromUrl();
      }
    }
  });

  // İlk yüklemede hash varsa Manager'a sync et (refresh/bookmark sonrası)
  const initialOpen = () => {
    if (!document.body) { requestAnimationFrame(initialOpen); return; }
    syncFromUrl();
  };
  if (getActiveTkHash()) initialOpen();

  window.addEventListener('hashchange', syncFromUrl);
  window.addEventListener('popstate', syncFromUrl);

  let ulObserver   = null;
  let bodyObserver = null;

  function attachULObserver(ul) {
    ulObserver?.disconnect();
    ulObserver = new MutationObserver(() => {
      if (!document.getElementById(SIDEBAR_ID)) injectSidebarItem();
    });
    ulObserver.observe(ul, { childList: true });
  }

  function observeUL() {
    const ul = findSidebarUL();
    if (!ul) return false;
    attachULObserver(ul);
    bodyObserver?.disconnect();
    bodyObserver = null;
    return true;
  }

  if (!observeUL()) {
    bodyObserver = new MutationObserver(() => {
      if (observeUL()) return;
      if (!document.getElementById(SIDEBAR_ID)) injectSidebarItem();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  const _origPush    = history.pushState.bind(history);
  const _origReplace = history.replaceState.bind(history);

  // Roblox SPA navigation pushState/replaceState ile yapılır; bu wrapper sidebar/observer
  // refresh + nav change hook'larını çalıştırır. Panel kapatma artık syncFromUrl'in işi
  // (hashchange + popstate listener'ları zaten dinliyor); pushState hash'i değiştirirse onlar
  // tetiklenir, değiştirmezse zaten bizim panellerle ilgisi yok.
  history.pushState = function(...a) {
    _origPush(...a);
    ulObserver?.disconnect(); ulObserver = null;
    setTimeout(() => {
      if (!observeUL()) {
        bodyObserver?.disconnect();
        bodyObserver = new MutationObserver(() => {
          if (observeUL()) return;
          if (!document.getElementById(SIDEBAR_ID)) injectSidebarItem();
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });
      }
      injectSidebarItem();
      onNavChange(a[2]);
      // Roblox pushState hash'i clearleyebilir → panelleri kapat
      syncFromUrl();
    }, 50);
  };

  history.replaceState = function(...a) {
    _origReplace(...a);
    if (!document.getElementById(SIDEBAR_ID)) injectSidebarItem();
    onNavChange(a[2]);
    syncFromUrl();
  };

  // (popstate zaten yukarıda syncFromUrl'e bağlandı — burada ek sidebar refresh için)
  window.addEventListener('popstate', () => {
    ulObserver?.disconnect(); ulObserver = null;
    setTimeout(() => {
      observeUL(); injectSidebarItem();
      onNavChange(location.href);
    }, 50);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    // Default toggle'ı BAŞKA sekmeden değiştiyse senkronla. Guard: yalnızca gerçek değişimde
    // çalış → aynı sekmedeki toggle handler zaten _state'i set edip uyguladığı için çift
    // çağrı/flicker olmasın.
    if (THEME_ENABLED_KEY in changes) {
      const newVal = changes[THEME_ENABLED_KEY].newValue !== false;
      if (newVal !== _state.themeEnabled) {
        _state.themeEnabled = newVal;
        // Plus yoksa tema uygulanmaz — sadece kapatma (disable) işle.
        if (newVal && _tkPlusCached) enableAllTheming();
        else                        disableAllTheming();
      }
    }
    // Tema KAPALIYKEN ya da Plus yokken tema/wallpaper güncellemelerini UYGULAMA.
    if (!_state.themeEnabled || !_tkPlusCached) return;
    if (STORAGE_KEY in changes)  applyWallpaper();
    if (THEME_KEY in changes) {
      const key = changes[THEME_KEY].newValue || 'midnight';
      _state.theme = VALID_PRESETS.includes(key) ? key : 'midnight';
      applyColorTheme(_state.theme, _state.adj, _state.customAccent, _state.fgBase, false);
    }
    if (ADJ_KEY in changes) {
      _state.adj = changes[ADJ_KEY].newValue || {};
      applyColorTheme(_state.theme, _state.adj, _state.customAccent, _state.fgBase, true);
    }
    if (OVERRIDES_KEY in changes) {
      _state.pageOverrides = changes[OVERRIDES_KEY].newValue || {};
      onNavChange(location.href);
    }
    if (ACCENT_KEY in changes) {
      _state.customAccent = changes[ACCENT_KEY].newValue || '';
      applyColorTheme(_state.theme, _state.adj, _state.customAccent, _state.fgBase, false);
    }
  });
}

// Temalar = Tracked Plus özelliği. ÖNEMLİ: sidebar butonu + panel HER DURUMDA görünür kalır
// (Plus yoksa panelde kilit gösterilir). Sadece temanın SAYFAYA UYGULANMASI Plus'a bağlıdır.
const _tkPlus = () => (window.TrackedLicense ? window.TrackedLicense.isPlus() : Promise.resolve(false));
let _themeInited = false;
const _gatedThemeInit = async () => {
  if (_themeInited) return;
  _themeInited = true;
  // Plus yoksa erken (critical) temayı hemen kaldır → themed flash olmasın. init yine çalışır:
  // sidebar butonu + panel enjekte edilir; tema apply'ı init içinde Plus'a göre gate'lenir.
  try { if (!(await _tkPlus())) document.getElementById('tracked-critical-theme')?.remove(); } catch (_) {}
  init();
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _gatedThemeInit);
else _gatedThemeInit();
// Plus durumu değişince temayı canlı uygula/kaldır + açık panelin kilidini güncelle.
if (window.TrackedLicense) window.TrackedLicense.onChange(async () => {
  let plus = false;
  try { plus = await _tkPlus(); } catch (_) {}
  _tkPlusCached = plus;
  if (plus && _state.themeEnabled) { try { applyAllThemeEffects(); } catch (_) {} }
  else { try { disableAllTheming(document.getElementById(OVERLAY_ID) ? { keepPanelStyles: true } : undefined); } catch (_) {} }
  _syncThemeLock();
});

})();
}
