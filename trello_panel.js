// trello_panel.js — Tracked v1.9.5: Oyun sayfası canlı Trello panosu
// /games/* sayfasına sağda yüzen native bir panel enjekte eder; SW (trelloFetchBoard) üzerinden
// Trello REST API'den (read-only) listeleri+kartları canlı çeker. CSP/iframe YOK — sade fetch.
// OPT-IN: yalnız ayar (rota_settings.trelloEnabled) AÇIKSA çalışır. Kimlik bilgileri (key/token/board)
// kullanıcının kendi tarayıcısında (chrome.storage.local) kalır; yalnız api.trello.com'a gider.

(function () {
  'use strict';
  if (window._trackedTrelloSetup) return;
  window._trackedTrelloSetup = true;

  const PANEL_ID = 'tracked-trello';
  const STYLE_ID = 'tracked-trello-style';
  const MIN_KEY  = 'tracked_trello_min';
  const POS_KEY  = 'tracked_trello_pos';   // sürüklenen konum (kalıcı)
  const REFRESH_MS = 60000;

  // ── İkonlar (inline SVG — emoji YOK) ──
  const ICON_TRELLO = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="6.5" y="6.5" width="4" height="9" rx="1"/><rect x="13.5" y="6.5" width="4" height="5.5" rx="1"/></svg>';
  const ICON_MIN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>';
  const ICON_REFRESH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>';
  const ICON_OPEN = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>';

  // ── i18n (TrackedI18n yüklüyse onu kullan, yoksa TR fallback) ──
  const t = (k, fb) => { try { if (typeof TrackedI18n !== 'undefined') { const v = TrackedI18n.t(k); if (v && v !== k) return v; } } catch (_) {} return fb; };

  // ── Yardımcılar ──
  function swMsg(msg) {
    return new Promise(res => { try { chrome.runtime.sendMessage(msg, r => { if (chrome.runtime.lastError) { res(null); return; } res(r || null); }); } catch { res(null); } });
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Trello pano URL'sinden / ya da ham id'den board kısa-kodunu çıkar
  function parseBoardId(v) {
    v = String(v || '').trim();
    const m = v.match(/trello\.com\/b\/([A-Za-z0-9]+)/);
    if (m) return m[1];
    if (/^[A-Za-z0-9]{6,32}$/.test(v)) return v;   // ham kısa-kod / id
    return '';
  }
  // Oyun sayfasından Trello panosunu OTOMATİK bul (kullanıcı bir şey yazmaz):
  // 1) açıklamadaki/sayfadaki trello.com/b/<id> linki (anchor ya da düz metin).
  let _detectedFor = '', _boardId = '';
  function detectBoardId() {
    try {
      const a = document.querySelector('a[href*="trello.com/b/"]');
      if (a) { const id = parseBoardId(a.getAttribute('href') || ''); if (id) return id; }
      const descEl = document.querySelector('.game-description, #game-description, [class*="escription"]');
      const txt = (descEl && descEl.textContent) || (document.body && document.body.innerText) || '';
      const m = txt.match(/trello\.com\/b\/([A-Za-z0-9]+)/i);
      return m ? m[1] : '';
    } catch (_) { return ''; }
  }
  function getBoardId() {
    if (_detectedFor === location.href && _boardId) return _boardId;   // URL başına önbellek (SPA'da yeniden bulunur)
    const id = detectBoardId();
    if (id) { _detectedFor = location.href; _boardId = id; }            // bulunamazsa önbelleğe alma → sonraki tazelemede tekrar dener
    return id;
  }
  const LABEL_COLORS = { green:'#61bd4f', yellow:'#f2d600', orange:'#ff9f1a', red:'#eb5a46', purple:'#c377e0', blue:'#0079bf', sky:'#00c2e0', lime:'#51e898', pink:'#ff78cb', black:'#344563' };
  function fmtDue(iso) {
    try { const d = new Date(iso); if (isNaN(d)) return ''; return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (_) { return ''; }
  }

  // ── State ──
  let _enabled = false, _minimized = false, _timer = null, _loading = false, _ents = false, _pos = null;

  // ── Stiller ──
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${PANEL_ID}{position:fixed;right:16px;bottom:74px;width:330px;max-height:min(440px,calc(100vh - 200px));box-sizing:border-box;
        display:flex;flex-direction:column;overflow:hidden;z-index:8800;
        background:linear-gradient(180deg,rgba(20,21,26,.95),rgba(13,14,18,.985));
        backdrop-filter:blur(28px) saturate(1.4);-webkit-backdrop-filter:blur(28px) saturate(1.4);
        border:1px solid rgba(255,255,255,.10);border-radius:14px;color:rgba(255,255,255,.9);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;
        box-shadow:0 12px 44px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05);
        animation:tt-in .32s cubic-bezier(.2,.85,.25,1) both;transition:width .2s,height .2s,border-radius .2s;}
      @keyframes tt-in{from{opacity:0;transform:translateY(14px) scale(.98);}to{opacity:1;transform:none;}}
      #${PANEL_ID}.tt-min{width:46px;height:46px;max-height:46px;border-radius:13px;cursor:pointer;}
      #${PANEL_ID}.tt-min .tt-body,#${PANEL_ID}.tt-min .tt-title span,#${PANEL_ID}.tt-min .tt-act{display:none!important;}
      #${PANEL_ID}.tt-min .tt-head{height:100%;justify-content:center;padding:0;border-bottom:none;}
      #${PANEL_ID}.tt-min .tt-title svg{width:20px;height:20px;}
      .tt-head{display:flex;align-items:center;gap:7px;padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;cursor:grab;}
      #${PANEL_ID}.tt-drag .tt-head{cursor:grabbing;}
      #${PANEL_ID}.tt-min .tt-head{cursor:pointer;}
      .tt-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:650;color:#fff;min-width:0;flex:1;}
      .tt-title svg{color:#5aa6ff;flex-shrink:0;}
      .tt-title span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .tt-act{background:none;border:none;color:rgba(255,255,255,.45);cursor:pointer;width:24px;height:24px;padding:0;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,color .15s,transform .2s;}
      .tt-act:hover{background:rgba(255,255,255,.12);color:#fff;}
      .tt-act.spin svg{animation:tt-spin .8s linear infinite;}
      @keyframes tt-spin{to{transform:rotate(360deg);}}
      .tt-body{overflow-y:auto;overscroll-behavior:contain;padding:10px 12px 12px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent;}
      .tt-body::-webkit-scrollbar{width:7px;} .tt-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:6px;}
      .tt-list{margin-bottom:12px;}
      .tt-list-h{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:rgba(255,255,255,.55);margin:0 2px 6px;}
      .tt-list-h .cnt{color:rgba(255,255,255,.38);font-weight:600;}
      .tt-card{display:flex;flex-direction:column;gap:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:8px 10px;margin-bottom:5px;}
      .tt-cover{margin:-2px -3px 7px;border-radius:7px;overflow:hidden;background:rgba(255,255,255,.04);}
      .tt-cover img{display:block;width:100%;max-height:130px;object-fit:cover;}
      .tt-card-t{font-size:12px;color:#fff;line-height:1.35;word-break:break-word;}
      .tt-labels{display:flex;flex-wrap:wrap;gap:4px;}
      .tt-lab{height:6px;min-width:26px;border-radius:4px;}
      .tt-due{align-self:flex-start;font-size:10px;color:rgba(255,255,255,.6);background:rgba(255,255,255,.06);border-radius:6px;padding:2px 7px;font-variant-numeric:tabular-nums;}
      .tt-empty{color:rgba(255,255,255,.4);font-size:11px;padding:4px 2px 8px;}
      .tt-webnote{font-size:10.5px;color:#e0b44a;background:rgba(224,180,74,.1);border:1px solid rgba(224,180,74,.25);border-radius:8px;padding:6px 9px;margin-bottom:10px;line-height:1.45;}
      .tt-webnote .tt-link{color:#e0b44a;}
      .tt-msg{padding:18px 14px;text-align:center;color:rgba(255,255,255,.6);font-size:12px;line-height:1.6;}
      .tt-msg .tt-link{color:#5aa6ff;cursor:pointer;text-decoration:underline;}
      .tt-sk{height:34px;border-radius:9px;margin-bottom:6px;background:linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.1),rgba(255,255,255,.05));background-size:200% 100%;animation:tt-sh 1.3s infinite;}
      @keyframes tt-sh{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
      /* setup formu */
      .tt-setup{padding:12px 13px 14px;display:flex;flex-direction:column;gap:9px;}
      .tt-setup p{margin:0 0 2px;font-size:11px;color:rgba(255,255,255,.6);line-height:1.5;}
      .tt-setup label{font-size:10px;font-weight:600;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.3px;}
      .tt-setup input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;font-size:12px;font-family:inherit;padding:8px 10px;outline:none;transition:border-color .15s;}
      .tt-setup input:focus{border-color:#5aa6ff;}
      .tt-setup .tt-row2{display:flex;gap:7px;}
      .tt-btn{background:#0079bf;border:none;color:#fff;font-weight:700;font-size:12px;padding:9px;border-radius:8px;cursor:pointer;font-family:inherit;transition:filter .15s,transform .08s;}
      .tt-btn:hover{filter:brightness(1.12);} .tt-btn:active{transform:scale(.98);}
      .tt-btn.ghost{background:rgba(255,255,255,.08);font-weight:600;}
      .tt-err{color:#ff8a80;font-size:11px;margin-top:1px;}
      @media (prefers-reduced-motion: reduce){#${PANEL_ID},#${PANEL_ID} *{animation:none!important;}}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function ensurePanel() {
    let p = document.getElementById(PANEL_ID);
    if (!p) {
      p = document.createElement('div'); p.id = PANEL_ID;
      (document.body || document.documentElement).appendChild(p);
      p.addEventListener('click', (e) => { if (_minimized && !e.target.closest('input,button,a')) { _minimized = false; p.classList.remove('tt-min'); saveMin(false); applyPos(p); refresh(); } });
      wireDrag(p);
      applyPos(p);
    }
    return p;
  }
  // Kaydedilmiş konumu uygula (varsa) — kullanıcı başlıktan sürükleyince hatırlanır.
  function applyPos(p) {
    if (!_pos || typeof _pos.left !== 'number') return;
    const w = p.offsetWidth || 330;
    p.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, _pos.left)) + 'px';
    p.style.top = Math.max(6, Math.min(window.innerHeight - 44, _pos.top)) + 'px';
    p.style.right = 'auto'; p.style.bottom = 'auto';
  }
  function wireDrag(p) {
    p.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || p.classList.contains('tt-min')) return;             // küçükken sürükleme yok (tık=büyüt)
      if (!e.target.closest('.tt-head') || e.target.closest('.tt-act')) return;  // yalnız başlıktan, butonlardan değil
      e.preventDefault();
      const r = p.getBoundingClientRect(); const sx = e.clientX, sy = e.clientY, sl = r.left, st = r.top;
      p.style.transition = 'none'; p.classList.add('tt-drag');
      try { p.setPointerCapture(e.pointerId); } catch (_) {}
      const mv = (ev) => {
        const l = Math.max(6, Math.min(window.innerWidth - p.offsetWidth - 6, sl + (ev.clientX - sx)));
        const t = Math.max(6, Math.min(window.innerHeight - 44, st + (ev.clientY - sy)));
        p.style.left = l + 'px'; p.style.top = t + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto';
      };
      const up = () => {
        p.removeEventListener('pointermove', mv); p.removeEventListener('pointerup', up); p.removeEventListener('pointercancel', up);
        p.style.transition = ''; p.classList.remove('tt-drag');
        const r2 = p.getBoundingClientRect(); _pos = { left: Math.round(r2.left), top: Math.round(r2.top) };
        try { chrome.storage.local.set({ [POS_KEY]: _pos }); } catch (_) {}
      };
      p.addEventListener('pointermove', mv); p.addEventListener('pointerup', up); p.addEventListener('pointercancel', up);
    });
  }
  const saveMin = (v) => { try { chrome.storage.local.set({ [MIN_KEY]: !!v }); } catch (_) {} };

  function headHtml(title, busy) {
    return `<div class="tt-head">
      <div class="tt-title">${ICON_TRELLO}<span>${esc(title)}</span></div>
      <button class="tt-act tt-refresh${busy ? ' spin' : ''}" title="${t('trelloRefresh', 'Yenile')}">${ICON_REFRESH}</button>
      <button class="tt-act tt-minbtn" title="${t('trelloMin', 'Küçült')}">${ICON_MIN}</button>
    </div>`;
  }
  function wireHead(p) {
    p.querySelector('.tt-refresh')?.addEventListener('click', (e) => { e.stopPropagation(); refresh(); });
    p.querySelector('.tt-minbtn')?.addEventListener('click', (e) => { e.stopPropagation(); _minimized = true; p.classList.add('tt-min'); saveMin(true); });
  }

  // Kurulum: yalnız API key + token (BİR KEZ). Pano her oyunda otomatik bulunur — kullanıcı board yazmaz.
  function renderSetup(errMsg) {
    const p = ensurePanel();
    p.classList.remove('tt-min'); _minimized = false;   // kurulumda açık dursun
    p.innerHTML = headHtml('Trello', false) + `
      <div class="tt-setup">
        <p>${t('trelloSetupHint', 'Public panolar otomatik açılır — giriş gerekmez. Bu pano GİZLİ olduğundan okumak için API key + token gir (bir kez). Veriler tarayıcında kalır, yalnız Trello\'ya gider.')}</p>
        <div><label>API key</label><input class="tt-key" type="text" placeholder="32 haneli key" autocomplete="off" spellcheck="false"></div>
        <button class="tt-btn ghost tt-gettoken">${t('trelloGetToken', 'Token al (key gir → tıkla)')}</button>
        <div><label>Token</label><input class="tt-token" type="text" placeholder="Token'ı yapıştır" autocomplete="off" spellcheck="false"></div>
        ${errMsg ? `<div class="tt-err">${esc(errMsg)}</div>` : ''}
        <button class="tt-btn tt-save">${t('trelloSave', 'Bağla')}</button>
      </div>`;
    wireHead(p);
    const keyIn = p.querySelector('.tt-key'), tokIn = p.querySelector('.tt-token');
    p.querySelector('.tt-gettoken')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const k = (keyIn.value || '').trim();
      if (!k) { keyIn.focus(); return; }
      const url = `https://trello.com/1/authorize?expiration=never&scope=read&response_type=token&name=Tracked&key=${encodeURIComponent(k)}`;
      try { window.open(url, '_blank', 'noopener'); } catch (_) {}
    });
    p.querySelector('.tt-save')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const key = (keyIn.value || '').trim(), token = (tokIn.value || '').trim();
      if (!key || !token) { renderSetup(t('trelloFillKT', 'API key ve token gerekli.')); return; }
      try {
        const cur = await chrome.storage.local.get('rota_settings');
        const rs = cur.rota_settings || {};
        rs.trello = Object.assign({}, rs.trello, { key, token });   // varsa manuel board fallback'i koru
        await chrome.storage.local.set({ rota_settings: rs });
      } catch (_) {}
      refresh();
    });
  }
  // Otomatik bulunamadı: isteğe bağlı sabit pano gir (zorunlu değil; otomatik her zaman öncelikli)
  function renderManual() {
    const p = ensurePanel();
    p.classList.remove('tt-min'); _minimized = false;
    p.innerHTML = headHtml('Trello', false) + `
      <div class="tt-setup">
        <p>${t('trelloManualHint', 'Bu oyunda otomatik bulunamadı. İstersen sabit bir pano gir (otomatik bulunan her zaman önceliklidir).')}</p>
        <div><label>${t('trelloBoardUrl', 'Pano URL / ID')}</label><input class="tt-board" type="text" placeholder="https://trello.com/b/XXXX/..." autocomplete="off" spellcheck="false"></div>
        <button class="tt-btn tt-saveboard">${t('trelloSave', 'Bağla')}</button>
      </div>`;
    wireHead(p);
    const boardIn = p.querySelector('.tt-board');
    p.querySelector('.tt-saveboard')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const boardId = parseBoardId(boardIn.value);
      if (!boardId) { boardIn.focus(); return; }
      try {
        const cur = await chrome.storage.local.get('rota_settings');
        const rs = cur.rota_settings || {};
        rs.trello = Object.assign({}, rs.trello, { boardId });
        await chrome.storage.local.set({ rota_settings: rs });
      } catch (_) {}
      refresh();
    });
  }
  function renderNoBoard() {
    const p = ensurePanel(); p.classList.toggle('tt-min', _minimized);
    p.innerHTML = headHtml('Trello', false) + `<div class="tt-msg">${t('trelloNoBoard', 'Bu oyunun açıklamasında Trello linki bulunamadı.')}<br><span class="tt-link tt-manual">${t('trelloManual', 'Pano linkini elle gir')}</span></div>`;
    wireHead(p);
    p.querySelector('.tt-manual')?.addEventListener('click', (e) => { e.stopPropagation(); renderManual(); });
  }

  function cardHtml(c) {
    const cover = c.cover ? `<div class="tt-cover"><img src="${esc(c.cover)}" alt="" referrerpolicy="no-referrer" loading="lazy"></div>` : '';
    const labs = (c.labels || []).filter(l => l.color).map(l => `<span class="tt-lab" style="background:${LABEL_COLORS[l.color] || '#5e6c84'}" title="${esc(l.name || l.color)}"></span>`).join('');
    const due = c.due ? `<span class="tt-due">${esc(fmtDue(c.due))}</span>` : '';
    return `<div class="tt-card">${cover}${labs ? `<div class="tt-labels">${labs}</div>` : ''}<div class="tt-card-t">${esc(c.name || '')}</div>${due}</div>`;
  }
  function renderBoard(data) {
    const p = ensurePanel(); p.classList.toggle('tt-min', _minimized);
    const lists = Array.isArray(data.lists) ? data.lists : [];
    const body = lists.length
      ? lists.map(l => `<div class="tt-list"><div class="tt-list-h"><span>${esc(l.name || '')}</span><span class="cnt">${(l.cards || []).length}</span></div>${
          (l.cards || []).length ? (l.cards || []).map(cardHtml).join('') : `<div class="tt-empty">—</div>`
        }</div>`).join('')
      : `<div class="tt-msg">${t('trelloEmpty', 'Bu panoda liste yok.')}</div>`;
    // Web aramasıyla bulunan pano TAHMİNDİR → dürüstçe etiketle + düzeltme yolu sun (sayfa/manuel kaynakta etiket yok).
    const note = data.source === 'web'
      ? `<div class="tt-webnote">${t('trelloWebGuess', 'Web\'den otomatik bulundu — yanlış olabilir.')} <span class="tt-link tt-manual">${t('trelloFix', 'Düzelt')}</span></div>`
      : '';
    p.innerHTML = headHtml((data.board && data.board.name) || 'Trello', false) + `<div class="tt-body">${note}${body}</div>`;
    wireHead(p);
    p.querySelector('.tt-manual')?.addEventListener('click', (e) => { e.stopPropagation(); renderManual(); });
    // Kapak görseli yüklenemezse (CSP/erişim) kırık resim gösterme → o kapağı kaldır
    p.querySelectorAll('.tt-cover img').forEach(img => img.addEventListener('error', () => { const c = img.closest('.tt-cover'); if (c) c.remove(); }, { once: true }));
  }
  function renderLoading() {
    const p = ensurePanel(); p.classList.toggle('tt-min', _minimized);
    p.innerHTML = headHtml('Trello', true) + `<div class="tt-body"><div class="tt-sk"></div><div class="tt-sk" style="width:80%"></div><div class="tt-sk" style="width:90%"></div></div>`;
    wireHead(p);
  }
  function renderError(msg) {
    const p = ensurePanel(); p.classList.toggle('tt-min', _minimized);
    p.innerHTML = headHtml('Trello', false) + `<div class="tt-msg">${esc(msg)}<br><span class="tt-link tt-reconf">${t('trelloReconfig', 'Yeniden bağla')}</span></div>`;
    wireHead(p);
    p.querySelector('.tt-reconf')?.addEventListener('click', (e) => { e.stopPropagation(); renderSetup(''); });
  }

  // ── Çekme (kurşungeçirmez — asla "yükleniyor"da takılmaz) ──
  async function refresh() {
    if (!_enabled || _loading) return;
    _loading = true;
    if (!_minimized && !document.querySelector(`#${PANEL_ID} .tt-card, #${PANEL_ID} .tt-setup`)) renderLoading();
    try {
      const boardId = getBoardId();   // sayfadan hızlı tespit (anchor/açıklama metni)
      const placeId = (location.pathname.match(/\/games\/(\d+)/) || [])[1] || '';
      const r = await swMsg({ action: 'trelloFetchBoard', boardId, placeId });   // bulamazsa SW tam açıklamadan (API) bulur
      if (!_enabled) return;
      // Auto-refresh, AÇIK bir formu (setup/manuel) yeniden çizip kullanıcının yazdığını SİLMESİN.
      const hasForm = !!document.querySelector(`#${PANEL_ID} .tt-setup`);
      if (r && r.ok) { renderBoard(r); }
      else if (!r || r.needSetup) {
        if (!hasForm) renderSetup(
          (r && r.error === 'auth') ? t('trelloAuthErr', 'Token geçersiz/süresi dolmuş. Yeniden bağla.')
          : (r && r.private) ? t('trelloPrivate', 'Bu pano GİZLİ — okumak için API key + token gir (public panolar otomatik açılır).')
          : ''
        );
      }
      else if (r.noBoard) { if (!hasForm) renderNoBoard(); }
      else { renderError(t('trelloLoadErr', 'Trello yüklenemedi.') + (r.error ? ' (' + r.error + ')' : '')); }
    } catch (_) {
      if (_enabled) renderError(t('trelloLoadErr', 'Trello yüklenemedi.'));
    } finally {
      _loading = false;
    }
  }

  function start() {
    if (_ents) return; _ents = true;
    injectStyles();
    refresh();
    clearInterval(_timer);
    _timer = setInterval(() => { if (_enabled && !document.hidden && !_minimized) refresh(); }, REFRESH_MS);
  }
  function stop() {
    _ents = false; clearInterval(_timer); _timer = null; _loading = false;
    document.getElementById(PANEL_ID)?.remove();
  }
  function applyState(on) { _enabled = !!on; if (_enabled) start(); else stop(); }

  // ── Başlat: ayar oku + canlı aç/kapa ──
  (async () => {
    try {
      const d = await chrome.storage.local.get(['rota_settings', MIN_KEY, POS_KEY]);
      _minimized = !!d[MIN_KEY];
      if (d[POS_KEY] && typeof d[POS_KEY].left === 'number') _pos = d[POS_KEY];
      applyState(d?.rota_settings?.trelloEnabled === true);
    } catch (_) {}
  })();
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !ch.rota_settings) return;
      const nv = ch.rota_settings.newValue || {};
      const wasEnabled = _enabled;
      applyState(nv.trelloEnabled === true);
      // Açıkken kimlik bilgileri değişirse tazele
      if (wasEnabled && _enabled) refresh();
    });
  } catch (_) {}
  document.addEventListener('visibilitychange', () => { if (!document.hidden && _enabled && !_minimized) refresh(); });
})();
