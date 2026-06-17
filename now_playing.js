// now_playing.js — Tracked v1.9.4: "Şu An Çalıyor" medya widget'ı
// Spotify Web / YouTube Music / YouTube'da çalan şarkıyı algılar, Roblox sayfasında sol-altta
// animasyonlu bir kartta gösterir + kontrol (çal/duraklat/sonraki/önceki/seek) sağlar.
// OPT-IN: yalnız ayar (rota_settings.nowPlaying) AÇIKKEN çalışır. Veri gerçek (mediaSession),
// hiçbir şey dışarı gitmez. SW mediaGetNowPlaying/mediaControl/mediaFocusTab handler'larına konuşur.

(function () {
  'use strict';
  if (window._trackedNowPlayingSetup) return;
  window._trackedNowPlayingSetup = true;

  const WIDGET_ID = 'tracked-now-playing';
  const STYLE_ID  = 'tracked-now-playing-style';
  const MIN_KEY   = 'tracked_np_minimized';
  const VERSION   = (() => { try { return chrome.runtime.getManifest().version; } catch (_) { return ''; } })();

  // ── İkonlar (inline SVG, emoji yok) ──
  const ICON_NOTE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  const ICON_PREV = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 6h2v12H6zM20 6v12l-9-6z"/></svg>';
  const ICON_NEXT = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M16 6h2v12h-2zM4 6l9 6-9 6z"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  const ICON_MIN  = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>';
  const ICON_EXPAND = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  const ICON_OPEN = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>';
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>';
  const ICON_BACK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  const ICON_VOL = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12"/></svg>';
  const ICON_MUTE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>';
  // Görünmez kenar bölgeleri (pencere gibi kenardan resize): sağ=genişlik, alt=yükseklik/ölçek, köşe=çapraz
  const RESIZE_HTML = '<div class="np-edge np-edge-r"></div><div class="np-edge np-edge-b"></div><div class="np-edge np-edge-c"></div>';
  const SRC_SPOTIFY = '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="11" fill="#1DB954"/><path fill="#fff" d="M17.2 16.4a.66.66 0 0 1-.9.22c-2.46-1.5-5.56-1.84-9.2-1a.66.66 0 1 1-.3-1.28c3.98-.91 7.4-.52 10.16 1.16.31.2.41.6.24.9zm1.3-2.9a.82.82 0 0 1-1.13.27c-2.82-1.73-7.12-2.23-10.45-1.22a.82.82 0 1 1-.48-1.57c3.81-1.16 8.55-.6 11.79 1.39.39.24.5.74.27 1.13zm.11-3.02C16.54 8.5 10.94 8.32 7.8 9.28a.98.98 0 1 1-.57-1.88c3.6-1.1 9.79-.88 13.66 1.42a.98.98 0 1 1-1 1.68z"/></svg>';
  const SRC_YTMUSIC = '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="11" fill="#FF0000"/><path fill="#fff" d="M10 8.2v7.6l6.2-3.8z"/></svg>';
  const SRC_YOUTUBE = '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="#FF0000" d="M23 12s0-3.2-.41-4.73a2.46 2.46 0 0 0-1.73-1.74C19.32 5.12 12 5.12 12 5.12s-7.32 0-8.86.41A2.46 2.46 0 0 0 1.41 7.27C1 8.8 1 12 1 12s0 3.2.41 4.73a2.46 2.46 0 0 0 1.73 1.74c1.54.41 8.86.41 8.86.41s7.32 0 8.86-.41a2.46 2.46 0 0 0 1.73-1.74C23 15.2 23 12 23 12z"/><path fill="#fff" d="M9.75 15.27V8.73L15.5 12z"/></svg>';
  // Tracked imzası (rota/dalga formu — "Route Optimizer")
  const TRACKED_MARK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3.5l2.2-6.5 4.2 13 2.3-6.5H21"/></svg>';

  function swMsg(msg) {
    return new Promise(res => { try { chrome.runtime.sendMessage(msg, r => { if (chrome.runtime.lastError) { res(null); return; } res(r || null); }); } catch { res(null); } });
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function fmtTime(s) { if (s == null || !isFinite(s) || s < 0) return '0:00'; const m = Math.floor(s / 60), ss = Math.floor(s % 60); return m + ':' + (ss < 10 ? '0' : '') + ss; }
  function sourceOf(host) { host = host || ''; if (host.indexOf('spotify') >= 0) return { key: 'spotify', icon: SRC_SPOTIFY }; if (host.indexOf('music.youtube') >= 0) return { key: 'ytmusic', icon: SRC_YTMUSIC }; return { key: 'youtube', icon: SRC_YOUTUBE }; }

  // ── State ──
  let _enabled = false, _minimized = false;
  let _media = null, _tabId = null;
  let _pos = 0, _dur = 0, _posAt = 0, _playing = false;   // ilerleme interpolasyonu
  let _trackKey = '';   // host|title|artist — yalnız bu değişince tam render
  let _accentUrl = '';  // accent'i tekrar hesaplamamak için son kapak url'i
  let _pollTimer = null, _progTimer = null;
  let _pendPlay = null, _pendUntil = 0;   // çal/duraklat sonrası iyimser durum (poll'un titremesini önler)
  let _nullMiss = 0;                      // şarkı geçişinde anlık metadata boşluğunu yutmak için
  let _mode = null;                       // 'player' | 'idle' | 'search' — idle/search her poll'da yeniden kurulmasın
  let _idleSource = 'youtube';            // arama kaynağı
  let _searchTimer = null;                // canlı arama debounce
  let _vol = 100, _muted = false, _volPendUntil = 0;  // ses durumu + iyimser pencere
  let _searchSeq = 0;                                 // arama isteklerini sıralamak (eski yanıtı yok say)

  // ── Konum/boyut: sürükle (8 simetrik snap noktası) + sınırlı resize (210–340px), kalıcı ──
  const LAYOUT_KEY = 'tracked_np_layout';
  let _anchor = 'bl', _width = 260, _resH = 230, _dragMoved = false, _dragWired = false;
  const M = 14, TOPY = 64;
  const clampW = (n) => Math.max(180, Math.min(520, Math.round(n)));   // yana doğru
  const clampH = (n) => Math.max(150, Math.min(620, Math.round(n)));   // aşağı/yukarı (sonuç listesi yüksekliği)
  const saveLayout = () => { try { chrome.storage.local.set({ [LAYOUT_KEY]: { anchor: _anchor, width: _width, resH: _resH } }); } catch (_) {} };
  // Sürükleme/resize: pointer'ı yakala → fare olayları Roblox'a SIZMAZ (mavi seçim/hover olmaz) + sayfada metin seçimi engellenir
  function beginDrag(el, e, onMove, onEnd) {
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    document.documentElement.classList.add('np-dragging-global');
    e.preventDefault();
    const mv = (ev) => { ev.preventDefault(); onMove(ev); };
    const up = (ev) => {
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      document.documentElement.classList.remove('np-dragging-global');
      if (onEnd) onEnd(ev);
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  function anchorPos(key, wd, ht) {
    const W = window.innerWidth, H = window.innerHeight;
    const m = {
      tl: [M, TOPY], tr: [W - wd - M, TOPY], bl: [M, H - ht - M], br: [W - wd - M, H - ht - M],
      t: [(W - wd) / 2, TOPY], b: [(W - wd) / 2, H - ht - M], l: [M, (H - ht) / 2], r: [W - wd - M, (H - ht) / 2]
    };
    return m[key] || m.bl;
  }
  const SQ = 56; // küçültülmüş kare boyutu
  let _hSide = 'r', _vSide = 't'; // resize tutamaçlarının (serbest) kenarı — çıpaya göre
  function applyLayout() {
    const w = document.getElementById(WIDGET_ID); if (!w) return;
    const isSearch = (_mode === 'idle' || _mode === 'search');
    const A = _anchor;
    const ox = (A === 'tl' || A === 'bl' || A === 'l') ? 'left' : (A === 'tr' || A === 'br' || A === 'r') ? 'right' : 'center';
    const oy = (A === 'tl' || A === 'tr' || A === 't') ? 'top' : (A === 'bl' || A === 'br' || A === 'b') ? 'bottom' : 'center';
    _hSide = (ox === 'right') ? 'l' : 'r';   // serbest yatay kenar (çıpanın tersi)
    _vSide = (oy === 'top') ? 'b' : 't';     // serbest dikey kenar
    // arama: alt-resize sonuç listesini büyütür; oynatıcı: tüm widget ÖLÇEKLENİR (çapraz)
    w.style.setProperty('--np-resh', _resH + 'px');
    const scale = (_minimized || isSearch) ? 1 : Math.max(0.85, Math.min(1.55, 1 + (_resH - 230) / 760));
    w.style.setProperty('--np-scale', scale);
    w.style.transformOrigin = ox + ' ' + oy;
    // tutamaç kenarlarını çıpaya göre yerleştir (serbest kenarlar)
    w.classList.toggle('np-h-l', _hSide === 'l'); w.classList.toggle('np-h-r', _hSide === 'r');
    w.classList.toggle('np-v-t', _vSide === 't'); w.classList.toggle('np-v-b', _vSide === 'b');
    w.style.width = _minimized ? '' : (_width + 'px');
    const rect = w.getBoundingClientRect();
    const uw = _minimized ? SQ : _width;                 // ölçeklenmemiş genişlik (CSS)
    const uh = _minimized ? SQ : (rect.height / scale);  // ölçeklenmemiş yükseklik
    const W = window.innerWidth, H = window.innerHeight;
    const left = (ox === 'left') ? M : (ox === 'right') ? (W - M - uw) : (W - uw) / 2;
    const top = (oy === 'top') ? TOPY : (oy === 'bottom') ? (H - M - uh) : (H - uh) / 2;
    w.style.left = Math.round(Math.max(6, left)) + 'px';
    w.style.top = Math.round(Math.max(6, top)) + 'px';
    w.style.right = 'auto'; w.style.bottom = 'auto';
  }
  function nearestAnchor(cx, cy, wd, ht) {
    let best = 'bl', bd = Infinity;
    for (const k of ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r']) {
      const p = anchorPos(k, wd, ht);
      const dx = cx - (p[0] + wd / 2), dy = cy - (p[1] + ht / 2), d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function wireDrag(w) {
    if (_dragWired) return; _dragWired = true;
    w.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.np-btn,.np-min-btn,.np-bar,.np-edge,.np-search,.np-srcseg,.np-results,.np-vol')) return; // etkileşimli alanlar hariç
      const sx = e.clientX, sy = e.clientY; const r0 = w.getBoundingClientRect(); const sl = r0.left, st = r0.top; let moved = false;
      w.style.transition = 'none'; w.classList.add('np-dragging');
      beginDrag(w, e, (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        const r = w.getBoundingClientRect();
        const l = Math.max(6, Math.min(window.innerWidth - r.width - 6, sl + dx));
        const t = Math.max(6, Math.min(window.innerHeight - r.height - 6, st + dy));
        w.style.left = l + 'px'; w.style.top = t + 'px'; w.style.right = 'auto'; w.style.bottom = 'auto';
      }, () => {
        w.classList.remove('np-dragging'); _dragMoved = moved;
        if (moved) {
          const r = w.getBoundingClientRect();
          _anchor = nearestAnchor(r.left + r.width / 2, r.top + r.height / 2, r.width, r.height);
          w.style.transition = 'left .18s ease, top .18s ease, width .18s ease';
          applyLayout(); saveLayout();
        }
      });
    });
  }
  function wireResize(w) {
    const wire = (sel, axis) => {  // axis: 'h'=yatay 'v'=dikey 'c'=köşe(çapraz)
      const h = w.querySelector(sel); if (!h) return;
      h.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const sx = e.clientX, sy = e.clientY, sw = _width, sh = _resH;
        w.style.transition = 'none';
        beginDrag(h, e, (ev) => {
          // sağ/sol kenar = YALNIZ genişlik (yana); üst/alt kenar + KÖŞE = yükseklik/ölçek (çapraz, yukarı büyür)
          if (axis === 'h') { const sg = (_hSide === 'l') ? -1 : 1; _width = clampW(sw + sg * (ev.clientX - sx)); }
          else { const sg = (_vSide === 't') ? -1 : 1; _resH = clampH(sh + sg * (ev.clientY - sy)); }
          applyLayout();
        }, () => saveLayout());
      });
    };
    wire('.np-edge-r', 'h'); wire('.np-edge-b', 'v'); wire('.np-edge-c', 'c');
  }

  // ── Stiller ──
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${WIDGET_ID}{position:fixed;left:14px;bottom:14px;width:260px;box-sizing:border-box;z-index:9000;--np-accent:#5b9cff;
        background:linear-gradient(180deg,rgba(23,23,29,.95),rgba(12,12,17,.985));
        backdrop-filter:blur(30px) saturate(1.55);-webkit-backdrop-filter:blur(30px) saturate(1.55);
        border:1px solid rgba(255,255,255,.10);border-radius:16px;
        box-shadow:0 12px 44px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.06);
        color:rgba(255,255,255,.9);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        padding:11px 13px 12px;overflow:hidden;
        transform:scale(var(--np-scale,1));transform-origin:0 0;
        animation:np-in .42s cubic-bezier(.2,.85,.25,1) both;
        transition:width .24s cubic-bezier(.2,.85,.25,1),height .24s cubic-bezier(.2,.85,.25,1),border-radius .24s,box-shadow .3s;}
      /* üstte kapaktan gelen yumuşak accent ışıması */
      #${WIDGET_ID}::before{content:'';position:absolute;inset:0 0 auto 0;height:52px;pointer-events:none;
        background:radial-gradient(130% 90% at 16% -10%,color-mix(in srgb,var(--np-accent) 30%,transparent),transparent 72%);
        opacity:.75;transition:background .5s ease;}
      @keyframes np-in{from{opacity:0;transform:translateY(16px) scale(.97);}to{opacity:1;transform:none;}}

      .np-head{position:relative;display:flex;align-items:center;gap:5px;margin:-1px 0 9px;cursor:grab;}
      .np-head .np-logo{display:inline-flex;color:var(--np-accent);filter:drop-shadow(0 0 5px color-mix(in srgb,var(--np-accent) 50%,transparent));transition:color .5s,filter .5s;}
      .np-head .np-brand{font-size:11px;font-weight:800;letter-spacing:.4px;
        background:linear-gradient(90deg,rgba(255,255,255,.62),color-mix(in srgb,var(--np-accent) 65%,#fff));
        -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;user-select:none;transition:background .5s;}
      .np-head .np-ver{font-size:9px;font-weight:700;letter-spacing:.2px;color:rgba(255,255,255,.3);margin-left:2px;user-select:none;}
      #${WIDGET_ID}.np-min .np-head{display:none!important;}

      .np-top{position:relative;display:flex;align-items:center;gap:11px;cursor:grab;}
      .np-art-link{position:relative;cursor:pointer;flex-shrink:0;border:none;padding:0;background:none;border-radius:10px;display:block;
        transition:transform .25s cubic-bezier(.2,.85,.25,1);}
      .np-art-link:hover{transform:scale(1.04);}
      .np-art{width:48px;height:48px;border-radius:10px;flex-shrink:0;object-fit:cover;display:block;
        background:rgba(255,255,255,.06);box-shadow:0 3px 10px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.08);
        animation:np-art-in .45s cubic-bezier(.2,.85,.25,1) both;}
      @keyframes np-art-in{from{opacity:0;transform:scale(.85);}to{opacity:1;transform:none;}}
      .np-art.fb{display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);}
      /* küçük modda kapak üstü mini ekolayzer + hover genişlet overlay (normalde gizli) */
      .np-min-eq,.np-min-ov{display:none;}
      .np-mid{flex:1;min-width:0;animation:np-mid-in .45s ease both;}
      @keyframes np-mid-in{from{opacity:0;transform:translateX(6px);}to{opacity:1;transform:none;}}
      .np-title-wrap{overflow:hidden;white-space:nowrap;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent);}
      .np-title{font-size:12.5px;font-weight:650;color:#fff;display:inline-block;white-space:nowrap;letter-spacing:.1px;}
      .np-title.np-scroll{animation:np-marq 10s linear infinite;}
      @keyframes np-marq{0%,10%{transform:translateX(0);}90%,100%{transform:translateX(var(--np-shift,0));}}
      .np-artist{font-size:10.5px;color:rgba(255,255,255,.58);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1.5px;}
      .np-srcrow{display:flex;align-items:center;gap:6px;margin-top:4px;}
      .np-src{display:inline-flex;opacity:.95;}
      .np-eq{display:inline-flex;align-items:flex-end;gap:2px;height:11px;}
      .np-eq i{width:2.5px;background:var(--np-accent);border-radius:1px;height:30%;transform-origin:bottom;animation:np-eq .95s ease-in-out infinite;box-shadow:0 0 4px color-mix(in srgb,var(--np-accent) 60%,transparent);}
      .np-eq i:nth-child(1){animation-delay:0s;} .np-eq i:nth-child(2){animation-delay:.22s;}
      .np-eq i:nth-child(3){animation-delay:.46s;} .np-eq i:nth-child(4){animation-delay:.12s;} .np-eq i:nth-child(5){animation-delay:.34s;}
      @keyframes np-eq{0%,100%{height:22%;}50%{height:100%;}}
      #${WIDGET_ID}.np-paused .np-eq i{animation-play-state:paused;height:28%;background:rgba(255,255,255,.32);box-shadow:none;}

      .np-min-btn{position:relative;z-index:8;background:none;border:none;color:rgba(255,255,255,.42);cursor:pointer;width:24px;height:24px;padding:0;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;align-self:flex-start;transition:background .18s,color .18s,transform .18s;}
      .np-min-btn:hover{background:rgba(255,255,255,.12);color:#fff;transform:scale(1.08);}

      .np-prog{display:flex;align-items:center;gap:8px;margin-top:11px;}
      .np-bar{flex:1;height:4px;border-radius:4px;background:rgba(255,255,255,.14);position:relative;cursor:pointer;transition:height .15s;}
      .np-bar:not(.np-ro):hover{height:6px;}
      .np-bar.np-ro{cursor:default;}
      .np-fill{position:absolute;left:0;top:0;height:100%;border-radius:4px;width:0;
        background:linear-gradient(90deg,color-mix(in srgb,var(--np-accent) 75%,#fff),var(--np-accent));
        box-shadow:0 0 8px color-mix(in srgb,var(--np-accent) 65%,transparent);transition:background .5s;}
      .np-fill::after{content:'';position:absolute;right:-4px;top:50%;width:9px;height:9px;border-radius:50%;background:#fff;
        transform:translateY(-50%) scale(0);transition:transform .15s;box-shadow:0 0 6px color-mix(in srgb,var(--np-accent) 70%,transparent);}
      .np-bar:not(.np-ro):hover .np-fill::after{transform:translateY(-50%) scale(1);}
      .np-time{font-size:9.5px;color:rgba(255,255,255,.55);font-variant-numeric:tabular-nums;white-space:nowrap;}

      .np-ctrls{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:9px;}
      .np-btn{background:none;border:none;color:rgba(255,255,255,.82);cursor:pointer;padding:5px;border-radius:9px;display:inline-flex;
        transition:background .18s,color .18s,transform .12s cubic-bezier(.2,.85,.25,1);}
      .np-btn:hover{background:rgba(255,255,255,.1);color:#fff;transform:scale(1.12);} .np-btn:active{transform:scale(.88);}
      .np-btn.np-pp{color:#fff;background:linear-gradient(150deg,color-mix(in srgb,var(--np-accent) 92%,#fff),var(--np-accent));
        width:36px;height:36px;align-items:center;justify-content:center;border-radius:50%;
        box-shadow:0 4px 14px color-mix(in srgb,var(--np-accent) 45%,transparent);transition:transform .12s,box-shadow .25s,background .5s;}
      .np-btn.np-pp:hover{transform:scale(1.08);box-shadow:0 6px 18px color-mix(in srgb,var(--np-accent) 60%,transparent);}
      .np-btn.np-pp:active{transform:scale(.92);}

      .np-vol{display:flex;align-items:center;gap:8px;margin-top:10px;}
      .np-vol-ic{background:none;border:none;color:rgba(255,255,255,.58);cursor:pointer;padding:3px;display:inline-flex;flex-shrink:0;border-radius:7px;transition:color .15s,background .15s,transform .12s;}
      .np-vol-ic:hover{color:#fff;background:rgba(255,255,255,.1);transform:scale(1.08);}
      .np-vol-bar{flex:1;height:4px;border-radius:4px;background:rgba(255,255,255,.14);position:relative;cursor:pointer;transition:height .15s;}
      .np-vol-bar:hover{height:6px;}
      .np-vol-fill{position:absolute;left:0;top:0;height:100%;border-radius:4px;background:rgba(255,255,255,.5);width:100%;transition:background .2s;}
      .np-vol-bar:hover .np-vol-fill{background:var(--np-accent);box-shadow:0 0 7px color-mix(in srgb,var(--np-accent) 55%,transparent);}
      .np-vol-fill::after{content:'';position:absolute;right:-4px;top:50%;width:9px;height:9px;border-radius:50%;background:#fff;transform:translateY(-50%) scale(0);transition:transform .15s;}
      .np-vol-bar:hover .np-vol-fill::after{transform:translateY(-50%) scale(1);}
      .np-vol-pct{font-size:9.5px;color:rgba(255,255,255,.55);font-variant-numeric:tabular-nums;width:32px;text-align:right;flex-shrink:0;}
      #${WIDGET_ID}.np-min .np-vol{display:none!important;}
      .np-back-btn{margin-right:1px;}

      #${WIDGET_ID}.np-dragging{cursor:grabbing;user-select:none;}
      #${WIDGET_ID}.np-dragging *{user-select:none;}
      /* Görünmez kenar bölgeleri — pencere gibi kenardan resize (çıpaya göre serbest kenarlarda) */
      .np-edge{position:absolute;z-index:6;touch-action:none;}
      .np-edge-r{top:12px;bottom:12px;width:12px;cursor:ew-resize;}
      #${WIDGET_ID}.np-h-r .np-edge-r{right:-3px;} #${WIDGET_ID}.np-h-l .np-edge-r{left:-3px;}
      .np-edge-b{left:12px;right:12px;height:12px;cursor:ns-resize;}
      #${WIDGET_ID}.np-v-b .np-edge-b{bottom:-3px;} #${WIDGET_ID}.np-v-t .np-edge-b{top:-3px;}
      .np-edge-c{width:22px;height:22px;z-index:7;}
      #${WIDGET_ID}.np-h-r .np-edge-c{right:-3px;} #${WIDGET_ID}.np-h-l .np-edge-c{left:-3px;}
      #${WIDGET_ID}.np-v-b .np-edge-c{bottom:-3px;} #${WIDGET_ID}.np-v-t .np-edge-c{top:-3px;}
      #${WIDGET_ID}.np-h-r.np-v-b .np-edge-c,#${WIDGET_ID}.np-h-l.np-v-t .np-edge-c{cursor:nwse-resize;}
      #${WIDGET_ID}.np-h-r.np-v-t .np-edge-c,#${WIDGET_ID}.np-h-l.np-v-b .np-edge-c{cursor:nesw-resize;}
      #${WIDGET_ID}.np-min .np-edge{display:none;}
      /* sürükleme/resize sırasında sayfada (Roblox dahil) seçim/sürükleme olmasın */
      .np-dragging-global, .np-dragging-global *{user-select:none !important;-webkit-user-select:none !important;}
      #${WIDGET_ID}.np-min .np-edge{display:none;}

      /* Idle — widget-içi arama */
      .np-idle-note{display:none;text-align:center;color:var(--np-accent);}
      .np-search{display:flex;align-items:center;gap:7px;padding:7px 10px;margin-top:1px;border-radius:11px;
        background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);transition:border-color .2s,background .2s;}
      .np-search:focus-within{border-color:color-mix(in srgb,var(--np-accent) 60%,transparent);background:rgba(255,255,255,.09);}
      .np-search-ic{display:inline-flex;color:rgba(255,255,255,.45);flex-shrink:0;}
      .np-q{flex:1;min-width:0;background:none;border:none;outline:none;color:#fff;font-size:12px;font-family:inherit;padding:0;}
      .np-q::placeholder{color:rgba(255,255,255,.38);}
      .np-srcseg{display:flex;gap:5px;margin-top:8px;}
      .np-segbtn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:6px 4px;border-radius:9px;
        border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.03);color:rgba(255,255,255,.62);cursor:pointer;
        font-size:9.5px;font-weight:600;transition:background .16s,color .16s,border-color .16s,transform .12s;}
      .np-segbtn svg{width:13px;height:13px;}
      .np-segbtn:hover{background:rgba(255,255,255,.08);color:#fff;}
      .np-segbtn:active{transform:scale(.95);}
      .np-segbtn.on{background:color-mix(in srgb,var(--np-accent) 16%,transparent);border-color:color-mix(in srgb,var(--np-accent) 45%,transparent);color:#fff;}
      .np-results{margin-top:9px;max-height:var(--np-resh,230px);overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:3px;scrollbar-width:none;-ms-overflow-style:none;}
      .np-results::-webkit-scrollbar{display:none;}
      .np-hint{font-size:10.5px;color:rgba(255,255,255,.42);text-align:center;padding:14px 6px;line-height:1.5;}
      .np-hint-link{background:none;border:none;color:var(--np-accent);cursor:pointer;font:inherit;text-decoration:underline;padding:0;}
      .np-res{display:flex;align-items:center;gap:9px;padding:5px;border:none;border-radius:9px;background:none;cursor:pointer;width:100%;text-align:left;
        transition:background .14s;animation:np-mid-in .3s ease both;}
      .np-res:hover{background:rgba(255,255,255,.08);}
      .np-res:active{transform:scale(.98);}
      .np-res-th{position:relative;width:46px;height:34px;border-radius:6px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);}
      .np-res-th img{width:100%;height:100%;object-fit:cover;display:block;}
      .np-res-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(0,0,0,.45);opacity:0;transition:opacity .15s;}
      .np-res:hover .np-res-play{opacity:1;}
      .np-res-meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;}
      .np-res-t{font-size:11.5px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .np-res-c{font-size:9.5px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .np-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--np-accent);animation:np-eq .8s ease-in-out infinite;}
      /* küçültülmüş idle = nota kare */
      #${WIDGET_ID}.np-min .np-search,#${WIDGET_ID}.np-min .np-srcseg,#${WIDGET_ID}.np-min .np-results{display:none!important;}
      #${WIDGET_ID}.np-min .np-idle-note{display:flex;align-items:center;justify-content:center;width:100%;height:100%;}
      #${WIDGET_ID}.np-min .np-idle-note svg{width:26px;height:26px;}

      /* şarkı değişimi — taze giriş (yalnız track değişince) */
      #${WIDGET_ID}.np-fresh .np-art{animation:np-art-in .5s cubic-bezier(.2,.85,.25,1) both;}
      #${WIDGET_ID}.np-fresh .np-mid{animation:np-mid-in .5s ease both;}

      /* Küçültülmüş — düzgün kare */
      #${WIDGET_ID}.np-min{width:${56}px!important;height:${56}px;padding:0;border-radius:13px;cursor:pointer;overflow:hidden;
        border:1px solid rgba(255,255,255,.13);box-shadow:0 7px 24px rgba(0,0,0,.5),0 0 0 1px color-mix(in srgb,var(--np-accent) 22%,transparent);}
      #${WIDGET_ID}.np-min::before{height:100%;opacity:.0;}
      #${WIDGET_ID}.np-min .np-mid,#${WIDGET_ID}.np-min .np-prog,#${WIDGET_ID}.np-min .np-ctrls,#${WIDGET_ID}.np-min .np-min-btn{display:none!important;}
      #${WIDGET_ID}.np-min .np-top{height:100%;width:100%;gap:0;cursor:pointer;}
      #${WIDGET_ID}.np-min .np-art-link{width:100%;height:100%;border-radius:0;}
      #${WIDGET_ID}.np-min .np-art-link:hover{transform:none;}
      #${WIDGET_ID}.np-min .np-art{width:100%;height:100%;border-radius:0;box-shadow:none;animation:none;}
      #${WIDGET_ID}.np-min .np-min-eq{display:inline-flex;position:absolute;left:5px;bottom:5px;align-items:flex-end;gap:1.5px;height:9px;
        padding:2px 3px;border-radius:5px;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);}
      #${WIDGET_ID}.np-min .np-min-eq i{width:2px;background:var(--np-accent);border-radius:1px;height:35%;animation:np-eq .95s ease-in-out infinite;}
      #${WIDGET_ID}.np-min .np-min-eq i:nth-child(2){animation-delay:.25s;} #${WIDGET_ID}.np-min .np-min-eq i:nth-child(3){animation-delay:.45s;}
      #${WIDGET_ID}.np-min.np-paused .np-min-eq i{animation-play-state:paused;background:rgba(255,255,255,.4);}
      #${WIDGET_ID}.np-min .np-min-ov{display:flex;position:absolute;inset:0;align-items:center;justify-content:center;color:#fff;
        background:rgba(0,0,0,.5);opacity:0;transition:opacity .2s;}
      #${WIDGET_ID}.np-min .np-art-link:hover .np-min-ov{opacity:1;}

      @media (prefers-reduced-motion: reduce){#${WIDGET_ID},#${WIDGET_ID} *{animation:none!important;}}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ── Marquee (taşan başlık) — render + büyütmede çağrılır ──
  function applyMarquee() {
    const w = document.getElementById(WIDGET_ID); if (!w) return;
    const titleEl = w.querySelector('.np-title'), wrap = w.querySelector('.np-title-wrap');
    if (!titleEl || !wrap) return;
    titleEl.classList.remove('np-scroll'); titleEl.style.removeProperty('--np-shift');
    if (titleEl.scrollWidth > wrap.clientWidth + 4) {
      titleEl.style.setProperty('--np-shift', (wrap.clientWidth - titleEl.scrollWidth - 8) + 'px');
      titleEl.classList.add('np-scroll');
    }
  }

  // ── Çal/duraklat durumunu yeniden render etmeden uygula (titreme yok) ──
  function syncPlayUI() {
    const w = document.getElementById(WIDGET_ID); if (!w) return;
    w.classList.toggle('np-paused', !_playing);
    const pp = w.querySelector('.np-pp'); if (pp) pp.innerHTML = _playing ? ICON_PAUSE : ICON_PLAY;
  }

  // ── Dürüst dinamik accent: kapaktan baskın rengi çıkar (CORS izin verirse), yoksa varsayılan ──
  function setAccent(col) { const w = document.getElementById(WIDGET_ID); if (w) w.style.setProperty('--np-accent', col || '#5b9cff'); }
  function vibrant(r, g, b) {
    // RGB→HSL, doygunluğu artır + parlaklığı dengele → canlı ama okunur bir vurgu
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0, s = 0; const l = (mx + mn) / 2;
    if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    s = Math.min(1, Math.max(.5, s)); const L = Math.min(.64, Math.max(.46, l));
    // HSL→RGB
    const hue = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
    const q = L < .5 ? L * (1 + s) : L + s - L * s, p = 2 * L - q;
    const R = Math.round(hue(p, q, h + 1/3) * 255), G = Math.round(hue(p, q, h) * 255), B = Math.round(hue(p, q, h - 1/3) * 255);
    return `rgb(${R},${G},${B})`;
  }
  function applyArtAccent(url) {
    if (url === _accentUrl) return; _accentUrl = url;
    if (!url) { setAccent(null); return; }
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const n = 14, c = document.createElement('canvas'); c.width = n; c.height = n;
        const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data; let r = 0, g = 0, b = 0, cnt = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; cnt++; }
        if (!cnt) { setAccent(null); return; }
        setAccent(vibrant(r / cnt, g / cnt, b / cnt));
      } catch (_) { setAccent(null); } // CORS tainted → dürüst geri dönüş (varsayılan accent)
    };
    img.onerror = () => setAccent(null);
    img.src = url;
  }

  function expand() {
    const w = document.getElementById(WIDGET_ID); if (!w || !_minimized) return;
    _minimized = false; w.classList.remove('np-min'); saveMin(false); applyLayout();
    requestAnimationFrame(applyMarquee); // içerik açılınca başlık ölçümü
  }
  function minimize() {
    const w = document.getElementById(WIDGET_ID); if (!w || _minimized) return;
    _minimized = true; w.classList.add('np-min'); saveMin(true); applyLayout();
  }

  function ensureWidget() {
    let w = document.getElementById(WIDGET_ID);
    if (!w) {
      w = document.createElement('div'); w.id = WIDGET_ID; document.body.appendChild(w);
      w.addEventListener('click', () => { if (_dragMoved) { _dragMoved = false; return; } if (_minimized) expand(); });
      wireDrag(w);
    }
    return w;
  }

  // ── Arama görünümü: idle (çalan yok) ya da overlay (çalarken "back" ile). YouTube/YTM = listele+çal, Spotify = listele+aç ──
  const SRC_OF = { youtube: { icon: SRC_YOUTUBE, label: 'YouTube' }, ytmusic: { icon: SRC_YTMUSIC, label: 'Müzik' }, spotify: { icon: SRC_SPOTIFY, label: 'Spotify' } };
  function renderIdle() { renderSearch(false); }
  function renderSearch(back) {
    const w = ensureWidget();
    _mode = back ? 'search' : 'idle'; _trackKey = ''; _accentUrl = ''; if (!back) setAccent(null); stopProg();
    w.classList.remove('np-paused', 'np-fresh');
    w.classList.toggle('np-min', _minimized);
    const seg = Object.keys(SRC_OF).map(s =>
      `<button class="np-segbtn${s === _idleSource ? ' on' : ''}" data-s="${s}" title="${SRC_OF[s].label}">${SRC_OF[s].icon}<span>${SRC_OF[s].label}</span></button>`).join('');
    const backBtn = back ? `<button class="np-min-btn np-back-btn" title="Çalana dön">${ICON_BACK}</button>` : '';
    w.innerHTML = `
      <div class="np-head">${back ? backBtn : ''}<span class="np-logo">${TRACKED_MARK}</span><span class="np-brand">Tracked music</span>${VERSION ? `<span class="np-ver">• v${VERSION}</span>` : ''}<button class="np-min-btn np-min-only" title="Küçült" style="margin-left:auto">${ICON_MIN}</button></div>
      <div class="np-idle-note">${ICON_NOTE}</div>
      <div class="np-search">
        <span class="np-search-ic"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg></span>
        <input class="np-q" type="text" placeholder="Şarkı / video ara…" autocomplete="off" spellcheck="false">
      </div>
      <div class="np-srcseg">${seg}</div>
      <div class="np-results"><div class="np-hint">Aramak için yaz, Enter'a bas</div></div>
      ${RESIZE_HTML}`;
    w.querySelector('.np-min-only')?.addEventListener('click', (e) => { e.stopPropagation(); minimize(); });
    w.querySelector('.np-back-btn')?.addEventListener('click', (e) => { e.stopPropagation(); closeSearch(); });
    if (back) requestAnimationFrame(() => w.querySelector('.np-q')?.focus());
    const inp = w.querySelector('.np-q');
    inp?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(_searchTimer); doSearch(inp.value); } });
    inp?.addEventListener('input', () => {
      clearTimeout(_searchTimer);
      if (_idleSource !== 'youtube') return;            // YTM/Spotify: Enter ile ara (işçi sekme maliyeti)
      const v = inp.value;
      _searchTimer = setTimeout(() => doSearch(v), 450); // YouTube: canlı arama (debounce)
    });
    // Kaydırmayı liste içinde tut — sınıra gelince Roblox sayfasına sızdırma (scroll chaining)
    const box0 = w.querySelector('.np-results');
    box0?.addEventListener('wheel', (e) => {
      const atTop = box0.scrollTop <= 0, atBottom = box0.scrollTop + box0.clientHeight >= box0.scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) e.preventDefault();
      e.stopPropagation();
    }, { passive: false });
    w.querySelectorAll('.np-segbtn').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      _idleSource = b.dataset.s;
      w.querySelectorAll('.np-segbtn').forEach(x => x.classList.toggle('on', x === b));
      clearTimeout(_searchTimer);
      if (inp && inp.value.trim()) doSearch(inp.value);
      else setResults(`<div class="np-hint">Aramak için yaz</div>`);
      inp?.focus();
    }));
    wireResize(w);
    applyLayout();
  }

  function setResults(html) { const box = document.getElementById(WIDGET_ID)?.querySelector('.np-results'); if (box) { box.innerHTML = html; applyLayout(); } } // yükseklik değişti → alta yapışıksa yeniden konumla
  function doSearch(query) {
    const q = String(query || '').trim();
    const src = _idleSource;
    if (!q) { setResults(`<div class="np-hint">Aramak için yaz</div>`); return; }
    const seq = ++_searchSeq;
    setResults(`<div class="np-hint">Aranıyor… <span class="np-dot"></span></div>`);
    // stale = bu istek eskidi (yeni arama başladı) ya da arama görünümünden çıkıldı (idle/search dışı)
    const stale = () => seq !== _searchSeq || (_mode !== 'idle' && _mode !== 'search');
    const fail = (msg) => { if (stale()) return; setResults(`<div class="np-hint">${msg} <button class="np-hint-link">Sitede ara</button></div>`); wireHintFallback(q, src); };
    const to = setTimeout(() => fail('Zaman aşımı — tekrar dene.'), 15000); // takılı kalmasın
    swMsg({ action: 'mediaSearch', query: q, source: src }).then(r => {
      clearTimeout(to);
      if (stale()) return;
      if (!r || !r.ok) { fail(src === 'spotify' ? "Spotify alınamadı (giriş gerekebilir)." : "Sonuç alınamadı."); return; }
      const list = r.results || [];
      if (!list.length) { setResults(`<div class="np-hint">Sonuç yok</div>`); return; }
      renderResults(list);
    });
  }
  function wireHintFallback(q, src) {
    document.getElementById(WIDGET_ID)?.querySelector('.np-hint-link')?.addEventListener('click', (e) => {
      e.stopPropagation(); swMsg({ action: 'mediaSearch', query: q, source: src + '_site' });
    });
  }
  function renderResults(list) {
    const rows = list.map(v => `
      <button class="np-res" data-id="${esc(v.id)}" data-target="${esc(v.target || 'youtube')}" data-url="${esc(v.url || '')}" title="${esc(v.title)}">
        <span class="np-res-th">${v.thumb ? `<img src="${esc(v.thumb)}" alt="" referrerpolicy="no-referrer">` : ICON_NOTE}<span class="np-res-play">${v.target === 'spotify' ? ICON_OPEN : ICON_PLAY}</span></span>
        <span class="np-res-meta"><span class="np-res-t">${esc(v.title)}</span><span class="np-res-c">${esc(v.channel)}${v.duration ? ' · ' + esc(v.duration) : ''}</span></span>
      </button>`).join('');
    setResults(rows);
    document.getElementById(WIDGET_ID)?.querySelectorAll('.np-res').forEach(b =>
      b.addEventListener('click', (e) => { e.stopPropagation(); playResult(b.dataset); }));
  }
  function playResult(ds) {
    const target = ds.target || 'youtube';
    if (target === 'spotify') {
      if (!ds.url) return;
      setResults(`<div class="np-hint">Spotify'da açılıyor… (DRM nedeniyle çalmak orada)</div>`);
      swMsg({ action: 'mediaOpenTrack', url: ds.url });
      return;
    }
    if (!ds.id) return;
    setResults(`<div class="np-hint">Çalınıyor… <span class="np-dot"></span></div>`);
    swMsg({ action: 'mediaPlayYouTube', videoId: ds.id, target });
    [1400, 2600, 4000, 5500].forEach(d => setTimeout(poll, d)); // çalmaya başlayınca oynatıcıya geç
    if (_mode === 'search') closeSearch(); // overlay'den çıkıp çalana dön (yeni şarkı yüklenince güncellenir)
  }

  // ── Render (yalnız ŞARKI değişince tam yeniden kurar; çal/duraklat ayrı) ──
  function render(fresh) {
    let w = document.getElementById(WIDGET_ID);
    if (!_enabled) { if (w) w.remove(); _trackKey = ''; _accentUrl = ''; _mode = null; stopProg(); return; }
    if (!_media) { if (_mode !== 'idle') renderIdle(); return; } // idle'ı her poll'da yeniden kurma (arama/odak korunur)
    w = ensureWidget();
    _mode = 'player';
    const src = sourceOf(_media.host);
    const seekRO = src.key === 'spotify'; // Spotify'da seek güvenilmez → salt-okunur
    const artHtml = _media.artwork
      ? `<img class="np-art" src="${esc(_media.artwork)}" alt="">`
      : `<div class="np-art fb">${ICON_NOTE}</div>`;
    w.innerHTML = `
      <div class="np-head"><span class="np-logo">${TRACKED_MARK}</span><span class="np-brand">Tracked music</span>${VERSION ? `<span class="np-ver">• v${VERSION}</span>` : ''}<button class="np-min-btn np-search-btn" title="Başka müzik ara" style="margin-left:auto">${ICON_SEARCH}</button><button class="np-min-btn" title="Küçült">${ICON_MIN}</button></div>
      <div class="np-top">
        <button class="np-art-link" title="Sekmeye geç">${artHtml}<span class="np-min-eq"><i></i><i></i><i></i></span><span class="np-min-ov">${ICON_EXPAND}</span></button>
        <div class="np-mid">
          <div class="np-title-wrap"><span class="np-title">${esc(_media.title || '—')}</span></div>
          <div class="np-artist">${esc(_media.artist || '')}</div>
          <div class="np-srcrow"><span class="np-src">${src.icon}</span><span class="np-eq"><i></i><i></i><i></i><i></i><i></i></span></div>
        </div>
      </div>
      <div class="np-prog">
        <div class="np-bar ${seekRO ? 'np-ro' : ''}"><div class="np-fill"></div></div>
        <span class="np-time">0:00</span>
      </div>
      <div class="np-ctrls">
        <button class="np-btn" data-cmd="prev" title="Önceki">${ICON_PREV}</button>
        <button class="np-btn np-pp" data-cmd="toggle" title="Çal/Duraklat">${_playing ? ICON_PAUSE : ICON_PLAY}</button>
        <button class="np-btn" data-cmd="next" title="Sonraki">${ICON_NEXT}</button>
      </div>
      <div class="np-vol">
        <button class="np-vol-ic" title="Sessize al">${(_muted || _vol === 0) ? ICON_MUTE : ICON_VOL}</button>
        <div class="np-vol-bar"><div class="np-vol-fill"></div></div>
        <span class="np-vol-pct"></span>
      </div>
      ${RESIZE_HTML}`;
    // Sınıflar (className sıfırlamadan — sürükleme/min durumunu koru)
    w.classList.toggle('np-paused', !_playing);
    w.classList.toggle('np-min', _minimized);
    if (fresh) { w.classList.add('np-fresh'); setTimeout(() => { const x = document.getElementById(WIDGET_ID); if (x) x.classList.remove('np-fresh'); }, 600); }

    applyMarquee();
    applyArtAccent(_media.artwork);
    syncVol();

    // Aksiyonlar
    w.querySelector('.np-search-btn')?.addEventListener('click', (e) => { e.stopPropagation(); openSearch(); });
    wireVol(w);
    w.querySelector('.np-min-btn:not(.np-search-btn)')?.addEventListener('click', (e) => { e.stopPropagation(); minimize(); });
    w.querySelector('.np-art-link')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_dragMoved) { _dragMoved = false; return; }   // sürükleme sonrası tıklamayı yut
      if (_minimized) { expand(); return; }              // küçükken: büyüt
      swMsg({ action: 'mediaFocusTab', tabId: _tabId }); // açıkken: medya sekmesine geç
    });
    w.querySelectorAll('.np-btn').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); onControl(b.dataset.cmd); }));
    const bar = w.querySelector('.np-bar');
    if (bar && !seekRO) bar.addEventListener('click', (e) => {
      if (!_dur) return; const r = bar.getBoundingClientRect(); const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      _pos = pct * _dur; _posAt = Date.now(); updateProg(); swMsg({ action: 'mediaControl', cmd: 'seek', value: _pos, tabId: _tabId });
    });
    wireResize(w);
    applyLayout();
    startProg();
  }

  // ── İlerleme (interpolasyon, render'sız) ──
  function updateProg() {
    const w = document.getElementById(WIDGET_ID); if (!w) return;
    const cur = _playing ? _pos + (Date.now() - _posAt) / 1000 : _pos;
    const c = _dur ? Math.max(0, Math.min(_dur, cur)) : 0;
    const fill = w.querySelector('.np-fill'), time = w.querySelector('.np-time');
    if (fill) fill.style.width = _dur ? (c / _dur * 100) + '%' : '0%';
    if (time) time.textContent = _dur ? (fmtTime(c) + ' / ' + fmtTime(_dur)) : fmtTime(c);
  }
  function startProg() { stopProg(); _progTimer = setInterval(updateProg, 400); updateProg(); }
  function stopProg() { if (_progTimer) { clearInterval(_progTimer); _progTimer = null; } }

  // ── Ses (yüzdeli) ──
  function syncVol() {
    const w = document.getElementById(WIDGET_ID); if (!w) return;
    const fill = w.querySelector('.np-vol-fill'), pct = w.querySelector('.np-vol-pct'), ic = w.querySelector('.np-vol-ic');
    const shown = _muted ? 0 : Math.max(0, Math.min(100, _vol));
    if (fill) fill.style.width = shown + '%';
    if (pct) pct.textContent = shown + '%';
    if (ic) ic.innerHTML = (_muted || shown === 0) ? ICON_MUTE : ICON_VOL;
  }
  function wireVol(w) {
    const ic = w.querySelector('.np-vol-ic'), bar = w.querySelector('.np-vol-bar');
    ic?.addEventListener('click', (e) => { e.stopPropagation(); _muted = !_muted; _volPendUntil = Date.now() + 1500; syncVol(); swMsg({ action: 'mediaControl', cmd: 'mute', tabId: _tabId }); });
    if (!bar) return;
    let lastSend = 0, pending = null;
    const send = () => { lastSend = Date.now(); clearTimeout(pending); pending = null; swMsg({ action: 'mediaControl', cmd: 'volume', value: _vol, tabId: _tabId }); };
    const setFromX = (x, final) => {
      const r = bar.getBoundingClientRect(); const p = Math.max(0, Math.min(1, (x - r.left) / r.width));
      _vol = Math.round(p * 100); _muted = false; _volPendUntil = Date.now() + 1500; syncVol();
      if (final || Date.now() - lastSend > 150) send(); else { clearTimeout(pending); pending = setTimeout(send, 160); }
    };
    bar.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); setFromX(e.clientX, false);
      beginDrag(bar, e, (ev) => setFromX(ev.clientX, false), (ev) => setFromX(ev.clientX, true));
    });
  }

  // ── Arama overlay (çalarken başka müzik aramak için) ──
  function openSearch() { if (_media) renderSearch(true); }
  function closeSearch() { _mode = 'player'; _trackKey = ''; render(); }

  // ── Kontrol (optimistic) ──
  function onControl(cmd) {
    if (cmd === 'toggle') {
      const wantPlay = !_playing;
      _playing = wantPlay; if (_media) _media.playing = wantPlay; _posAt = Date.now();
      _pendPlay = wantPlay; _pendUntil = Date.now() + 2000; // gerçek durum yakalayana kadar iyimser durumu koru
      syncPlayUI();
      swMsg({ action: 'mediaControl', cmd: wantPlay ? 'play' : 'pause', tabId: _tabId });
      setTimeout(poll, 500); // durumu doğrula
    } else {
      swMsg({ action: 'mediaControl', cmd, tabId: _tabId });
      // sonraki/önceki: sitenin yeni şarkı bilgisini güncellemesi ~0.3–1.5sn sürer → kısa seri yoklama
      setTimeout(poll, 300); setTimeout(poll, 800); setTimeout(poll, 1500);
    }
  }

  // ── Veri uygula ──
  function applyMedia(media, tabId) {
    _media = media; _tabId = tabId != null ? tabId : _tabId;
    if (!media) { _trackKey = ''; render(); return; }
    _pos = media.position != null ? media.position : 0;
    _dur = media.duration != null ? media.duration : 0;
    _posAt = Date.now();
    let playing = !!media.playing;
    // İyimser çal/duraklat: gerçek durum yakalanana (ya da 2sn) kadar poll'un titretmesini engelle
    if (_pendPlay !== null) {
      if (playing === _pendPlay || Date.now() >= _pendUntil) _pendPlay = null;
      else playing = _pendPlay;
    }
    media.playing = playing; _playing = playing;
    // Ses: kullanıcı az önce ayarladıysa (iyimser pencere) siteden geleni yok say, yoksa güncelle
    if (Date.now() >= _volPendUntil) { if (media.volume != null) _vol = media.volume; _muted = !!media.muted; }
    if (_mode === 'search') return; // arama overlay açık — oynatıcıyı render etme (durum saklandı)
    // Yalnız ŞARKI değişince tam render (taze animasyon + accent); aksi halde durum/ilerleme güncelle (titreme yok)
    const tk = (media.host || '') + '|' + (media.title || '') + '|' + (media.artist || '');
    if (tk !== _trackKey) { const firstOrNew = _trackKey !== ''; _trackKey = tk; render(firstOrNew); }
    else { syncPlayUI(); updateProg(); syncVol(); }
  }

  // ── Yoklama (görünürlük-kapılı + backoff) ──
  function scheduleNext() {
    clearTimeout(_pollTimer);
    let delay = 1500;
    if (!_media) delay = 4000; else if (_minimized) delay = 3000; else if (!_media.playing) delay = 3000;
    _pollTimer = setTimeout(poll, delay);
  }
  async function poll() {
    if (!_enabled) return;
    if (document.hidden) { scheduleNext(); return; }
    const r = await swMsg({ action: 'mediaGetNowPlaying' });
    if (!_enabled) return;
    const media = (r && r.ok) ? r.media : null;
    // Şarkı geçişinde metadata anlık boşalabilir → tek seferlik null'ı yut (idle'a düşüp geri dönerek titremesin)
    if (!media && _media && _nullMiss < 1) { _nullMiss++; scheduleNext(); return; }
    _nullMiss = 0;
    applyMedia(media, media ? media.tabId : null);
    scheduleNext();
  }

  function start() { if (_enabled) return; _enabled = true; injectStyles(); poll(); }
  function stop() { _enabled = false; clearTimeout(_pollTimer); clearTimeout(_searchTimer); stopProg(); document.getElementById(WIDGET_ID)?.remove(); _media = null; _trackKey = ''; _accentUrl = ''; _mode = null; }
  const saveMin = (v) => { try { chrome.storage.local.set({ [MIN_KEY]: !!v }); } catch (_) {} };

  // ── Başlat: ayar oku + canlı aç/kapa ──
  (async () => {
    try {
      const d = await chrome.storage.local.get(['rota_settings', MIN_KEY, LAYOUT_KEY]);
      _minimized = !!d[MIN_KEY];
      const lay = d[LAYOUT_KEY];
      if (lay) { if (lay.anchor) _anchor = lay.anchor; if (lay.width) _width = clampW(lay.width); if (lay.resH) _resH = clampH(lay.resH); }
      if (d?.rota_settings?.nowPlaying === true) start();
    } catch (_) {}
  })();
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local') return;
      if (ch.rota_settings) {
        const on = ch.rota_settings.newValue && ch.rota_settings.newValue.nowPlaying === true;
        if (on && !_enabled) start();
        else if (!on && _enabled) stop();
      }
    });
  } catch (_) {}
  // Sekme tekrar görünür olunca anında tazele
  document.addEventListener('visibilitychange', () => { if (_enabled && !document.hidden) poll(); });
  // Pencere yeniden boyutlanınca seçili köşeye yapışık kal
  let _rzT = null;
  window.addEventListener('resize', () => { clearTimeout(_rzT); _rzT = setTimeout(() => { if (_enabled && document.getElementById(WIDGET_ID)) applyLayout(); }, 120); });
})();
