// trello_panel.js — Tracked v1.9.5: Oyun sayfası Trello bölümü (INLINE — About sekmesine enjekte)
// Floating overlay DEĞİL: Roblox'un "About" sekmesine, native section yapısına (container-header) oturur;
// modern kart ızgarası + kapak görselleri. Board oyundan OTOMATİK bulunur (SW: trelloFetchBoard).
// PUBLIC pano auth'suz; private için key+token. Veri yalnız Trello'ya gider, local kalır. OPT-IN.

(function () {
  'use strict';
  if (window._trackedTrelloSetup) return;
  window._trackedTrelloSetup = true;

  const SECTION_ID = 'tracked-trello-section';
  const STYLE_ID   = 'tracked-trello-style';

  // ── İkonlar (inline SVG — emoji YOK) ──
  const ICON_TRELLO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="6.5" y="6.5" width="4" height="9.5" rx="1"/><rect x="13.5" y="6.5" width="4" height="6" rx="1"/></svg>';
  const ICON_REFRESH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>';
  const ICON_NOTE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  // ── i18n + yardımcılar ──
  const t = (k, fb) => { try { if (typeof TrackedI18n !== 'undefined') { const v = TrackedI18n.t(k); if (v && v !== k) return v; } } catch (_) {} return fb; };
  function swMsg(msg) { return new Promise(res => { try { chrome.runtime.sendMessage(msg, r => { if (chrome.runtime.lastError) { res(null); return; } res(r || null); }); } catch { res(null); } }); }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function parseBoardId(v) { v = String(v || '').trim(); const m = v.match(/trello\.com\/b\/([A-Za-z0-9]+)/); if (m) return m[1]; if (/^[A-Za-z0-9]{6,32}$/.test(v)) return v; return ''; }
  const LABEL_COLORS = { green:'#61bd4f', yellow:'#f2d600', orange:'#ff9f1a', red:'#eb5a46', purple:'#c377e0', blue:'#0079bf', sky:'#00c2e0', lime:'#51e898', pink:'#ff78cb', black:'#344563' };
  function fmtDue(iso) { try { const d = new Date(iso); if (isNaN(d)) return ''; return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (_) { return ''; } }

  // Oyun sayfasından board linkini hızlı tespit (SW ayrıca placeId ile tam açıklama + web araması yapar)
  let _detectedFor = '', _boardId = '';
  function detectBoardId() {
    try {
      const a = document.querySelector('a[href*="trello.com/b/"]');
      if (a) { const id = parseBoardId(a.getAttribute('href') || ''); if (id) return id; }
      const d = document.querySelector('.game-description, [class*="escription"]');
      const m = ((d && d.textContent) || '').match(/trello\.com\/b\/([A-Za-z0-9]+)/i);
      return m ? m[1] : '';
    } catch (_) { return ''; }
  }
  function getBoardId() {
    if (_detectedFor === location.href && _boardId) return _boardId;
    const id = detectBoardId();
    if (id) { _detectedFor = location.href; _boardId = id; }
    return id;
  }

  // ── State ──
  let _enabled = false, _loading = false, _curPlace = '', _tick = null;

  // ── Stiller (Roblox section'a oturur; nötr-modern, açık/koyu temada okunur) ──
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${SECTION_ID}{margin-top:18px;}
      #${SECTION_ID} .tk-head{display:flex;align-items:center;gap:9px;}
      #${SECTION_ID} .tk-head h3{display:flex;align-items:center;gap:8px;margin:0;}
      #${SECTION_ID} .tk-head h3 svg{color:#3b82f6;flex-shrink:0;}
      #${SECTION_ID} .tk-refresh{margin-left:auto;background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.2);color:inherit;cursor:pointer;width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;opacity:.75;transition:opacity .15s,background .15s,transform .4s;}
      #${SECTION_ID} .tk-refresh:hover{opacity:1;background:rgba(127,127,127,.2);}
      #${SECTION_ID} .tk-refresh.spin svg{animation:tk-spin .8s linear infinite;}
      @keyframes tk-spin{to{transform:rotate(360deg);}}
      #${SECTION_ID} .tk-webnote{font-size:11.5px;color:#b8860b;background:rgba(224,180,74,.12);border:1px solid rgba(224,180,74,.3);border-radius:9px;padding:7px 11px;margin:10px 0 4px;display:inline-flex;gap:6px;align-items:center;}
      #${SECTION_ID} .tk-webnote .tk-link,#${SECTION_ID} .tk-link{color:#3b82f6;cursor:pointer;text-decoration:underline;}
      /* Trello-board: yatay kaydırılan list kolonları */
      #${SECTION_ID} .tk-board{display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;padding:14px 2px 16px;scrollbar-width:thin;}
      #${SECTION_ID} .tk-board::-webkit-scrollbar{height:9px;}
      #${SECTION_ID} .tk-board::-webkit-scrollbar-thumb{background:rgba(127,127,127,.35);border-radius:6px;}
      #${SECTION_ID} .tk-col{flex:0 0 246px;max-width:246px;background:rgba(127,127,127,.08);border:1px solid rgba(127,127,127,.14);border-radius:13px;padding:11px;max-height:560px;display:flex;flex-direction:column;}
      #${SECTION_ID} .tk-col-h{display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:13.5px;margin:1px 4px 9px;}
      #${SECTION_ID} .tk-col-h .cnt{font-size:11px;opacity:.55;font-weight:600;background:rgba(127,127,127,.16);border-radius:10px;padding:1px 8px;}
      #${SECTION_ID} .tk-col-cards{overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:2px;scrollbar-width:thin;}
      #${SECTION_ID} .tk-col-cards::-webkit-scrollbar{width:6px;}
      #${SECTION_ID} .tk-col-cards::-webkit-scrollbar-thumb{background:rgba(127,127,127,.3);border-radius:6px;}
      #${SECTION_ID} .tk-card{background:rgba(127,127,127,.1);border:1px solid rgba(127,127,127,.16);border-radius:10px;overflow:hidden;transition:transform .12s,box-shadow .15s;}
      #${SECTION_ID} .tk-card:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.18);}
      #${SECTION_ID} .tk-cover{width:100%;background:rgba(127,127,127,.1);}
      #${SECTION_ID} .tk-cover img{display:block;width:100%;max-height:140px;object-fit:cover;}
      #${SECTION_ID} .tk-card-b{padding:8px 10px;display:flex;flex-direction:column;gap:5px;}
      #${SECTION_ID} .tk-labels{display:flex;flex-wrap:wrap;gap:4px;}
      #${SECTION_ID} .tk-lab{height:7px;min-width:30px;border-radius:4px;}
      #${SECTION_ID} .tk-card-t{font-size:13px;line-height:1.35;word-break:break-word;}
      #${SECTION_ID} .tk-due{align-self:flex-start;font-size:10.5px;opacity:.7;background:rgba(127,127,127,.16);border-radius:6px;padding:2px 7px;}
      #${SECTION_ID} .tk-empty{font-size:11.5px;opacity:.45;padding:4px;}
      #${SECTION_ID} .tk-msg{padding:22px 14px;text-align:center;opacity:.75;font-size:13px;line-height:1.6;}
      #${SECTION_ID} .tk-sk{flex:0 0 246px;height:160px;border-radius:13px;background:linear-gradient(90deg,rgba(127,127,127,.08),rgba(127,127,127,.16),rgba(127,127,127,.08));background-size:200% 100%;animation:tk-sh 1.3s infinite;}
      @keyframes tk-sh{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
      /* private kurulum (nadiren) */
      #${SECTION_ID} .tk-setup{max-width:380px;margin:14px auto;display:flex;flex-direction:column;gap:9px;}
      #${SECTION_ID} .tk-setup p{margin:0;font-size:12.5px;opacity:.8;line-height:1.5;}
      #${SECTION_ID} .tk-setup input{box-sizing:border-box;background:rgba(127,127,127,.1);border:1px solid rgba(127,127,127,.25);border-radius:8px;color:inherit;font:inherit;font-size:13px;padding:9px 11px;outline:none;}
      #${SECTION_ID} .tk-setup input:focus{border-color:#3b82f6;}
      #${SECTION_ID} .tk-btn{background:#0079bf;border:none;color:#fff;font-weight:700;font-size:13px;padding:9px;border-radius:8px;cursor:pointer;font-family:inherit;transition:filter .15s;}
      #${SECTION_ID} .tk-btn:hover{filter:brightness(1.1);}
      #${SECTION_ID} .tk-btn.ghost{background:rgba(127,127,127,.18);color:inherit;font-weight:600;}
      @media (prefers-reduced-motion: reduce){#${SECTION_ID} *{animation:none!important;}}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ── Enjeksiyon hedefi: About sekmesi konteyneri ──
  function aboutHost() {
    return document.querySelector('.game-about-tab-container') ||
           document.querySelector('#game-details-about-tab-container');
  }
  function ensureSection() {
    const host = aboutHost(); if (!host) return null;
    let sec = document.getElementById(SECTION_ID);
    if (sec && host.contains(sec)) return sec;
    if (sec) sec.remove();
    sec = document.createElement('div');
    sec.id = SECTION_ID;
    sec.className = 'section tk-trello';
    // Yerleştir: Açıklamadan sonra; yoksa sona
    const desc = host.querySelector('.game-description-container');
    if (desc && desc.parentNode === host) host.insertBefore(sec, desc.nextSibling);
    else host.appendChild(sec);
    return sec;
  }
  function removeSection() { document.getElementById(SECTION_ID)?.remove(); }

  // ── Render ──
  function cardHtml(c) {
    const cover = c.cover ? `<div class="tk-cover"><img src="${esc(c.cover)}" alt="" referrerpolicy="no-referrer" loading="lazy"></div>` : '';
    const labs = (c.labels || []).filter(l => l.color).map(l => `<span class="tk-lab" style="background:${LABEL_COLORS[l.color] || '#5e6c84'}" title="${esc(l.name || l.color)}"></span>`).join('');
    const due = c.due ? `<span class="tk-due">${esc(fmtDue(c.due))}</span>` : '';
    return `<div class="tk-card">${cover}<div class="tk-card-b">${labs ? `<div class="tk-labels">${labs}</div>` : ''}<div class="tk-card-t">${esc(c.name || '')}</div>${due}</div></div>`;
  }
  function headHtml(title, busy) {
    return `<div class="container-header tk-head"><h3>${ICON_TRELLO}<span>${esc(title)}</span></h3>
      <button class="tk-refresh${busy ? ' spin' : ''}" title="${t('trelloRefresh', 'Yenile')}">${ICON_REFRESH}</button></div>`;
  }
  function wire(sec) {
    sec.querySelector('.tk-refresh')?.addEventListener('click', () => refresh());
    sec.querySelectorAll('.tk-cover img').forEach(img => img.addEventListener('error', () => { const c = img.closest('.tk-cover'); if (c) c.remove(); }, { once: true }));
    sec.querySelector('.tk-manual')?.addEventListener('click', () => renderInto(sec, { kind: 'setup' }));
  }
  function renderInto(sec, st) {
    if (!sec) return;
    const k = st.kind;
    if (k === 'loading') {
      sec.innerHTML = headHtml('Trello', true) + `<div class="tk-board">${'<div class="tk-sk"></div>'.repeat(4)}</div>`;
      wire(sec); return;
    }
    if (k === 'board') {
      const d = st.data, lists = Array.isArray(d.lists) ? d.lists : [];
      const note = d.source === 'web'
        ? `<div class="tk-webnote">${ICON_NOTE}${t('trelloWebGuess', 'Web\'den otomatik bulundu — yanlış olabilir.')} <span class="tk-link tk-manual">${t('trelloFix', 'Düzelt')}</span></div>` : '';
      const board = lists.length
        ? `<div class="tk-board">${lists.map(l => `<div class="tk-col"><div class="tk-col-h"><span>${esc(l.name || '')}</span><span class="cnt">${(l.cards || []).length}</span></div><div class="tk-col-cards">${(l.cards || []).length ? (l.cards || []).map(cardHtml).join('') : `<div class="tk-empty">—</div>`}</div></div>`).join('')}</div>`
        : `<div class="tk-msg">${t('trelloEmpty', 'Bu panoda liste yok.')}</div>`;
      sec.innerHTML = headHtml((d.board && d.board.name) || 'Trello', false) + note + board;
      wire(sec); return;
    }
    if (k === 'noBoard') {
      sec.innerHTML = headHtml('Trello', false) + `<div class="tk-msg">${t('trelloNoBoard', 'Bu oyunun açıklamasında Trello linki bulunamadı.')} <span class="tk-link tk-manual">${t('trelloManual', 'Elle gir')}</span></div>`;
      wire(sec); return;
    }
    if (k === 'error') {
      sec.innerHTML = headHtml('Trello', false) + `<div class="tk-msg">${t('trelloLoadErr', 'Trello yüklenemedi.')}${st.msg ? ' (' + esc(st.msg) + ')' : ''} <span class="tk-link tk-refresh2">${t('trelloRetry', 'Tekrar dene')}</span></div>`;
      wire(sec); sec.querySelector('.tk-refresh2')?.addEventListener('click', () => refresh()); return;
    }
    // setup (private / manuel)
    const pv = st.private ? `<p>${t('trelloPrivate', 'Bu pano GİZLİ — okumak için API key + token gir (public panolar otomatik açılır).')}</p>` : `<p>${t('trelloManualHint', 'Otomatik bulunamadı. API key + token (ve gerekiyorsa pano linki) gir.')}</p>`;
    sec.innerHTML = headHtml('Trello', false) + `
      <div class="tk-setup">
        ${pv}
        <input class="tk-key" type="text" placeholder="API key" autocomplete="off" spellcheck="false">
        <button class="tk-btn ghost tk-gettoken">${t('trelloGetToken', 'Token al (key gir → tıkla)')}</button>
        <input class="tk-token" type="text" placeholder="Token" autocomplete="off" spellcheck="false">
        <input class="tk-board-in" type="text" placeholder="${t('trelloBoardUrl', 'Pano URL (otomatikse boş bırak)')}" autocomplete="off" spellcheck="false">
        <button class="tk-btn tk-save">${t('trelloSave', 'Bağla')}</button>
      </div>`;
    wire(sec);
    const keyIn = sec.querySelector('.tk-key'), tokIn = sec.querySelector('.tk-token'), boardIn = sec.querySelector('.tk-board-in');
    sec.querySelector('.tk-gettoken')?.addEventListener('click', () => {
      const k2 = (keyIn.value || '').trim(); if (!k2) { keyIn.focus(); return; }
      try { window.open(`https://trello.com/1/authorize?expiration=never&scope=read&response_type=token&name=Tracked&key=${encodeURIComponent(k2)}`, '_blank', 'noopener'); } catch (_) {}
    });
    sec.querySelector('.tk-save')?.addEventListener('click', async () => {
      const key = (keyIn.value || '').trim(), token = (tokIn.value || '').trim(), bid = parseBoardId(boardIn.value);
      if (!key || !token) { keyIn.focus(); return; }
      try { const cur = await chrome.storage.local.get('rota_settings'); const rs = cur.rota_settings || {}; rs.trello = Object.assign({}, rs.trello, { key, token }); if (bid) rs.trello.boardId = bid; await chrome.storage.local.set({ rota_settings: rs }); } catch (_) {}
      refresh();
    });
  }

  // ── Çekme (kurşungeçirmez) ──
  async function refresh() {
    const sec0 = document.getElementById(SECTION_ID); if (!sec0 || _loading) return;
    _loading = true;
    const rb = sec0.querySelector('.tk-refresh'); if (rb) rb.classList.add('spin');
    if (!sec0.querySelector('.tk-board')) renderInto(sec0, { kind: 'loading' });
    try {
      const boardId = getBoardId();
      const placeId = (location.pathname.match(/\/games\/(\d+)/) || [])[1] || '';
      const r = await swMsg({ action: 'trelloFetchBoard', boardId, placeId });
      if (!_enabled) return;
      const sec = document.getElementById(SECTION_ID); if (!sec) return;
      if (r && r.ok) renderInto(sec, { kind: 'board', data: r });
      else if (!r || r.needSetup) renderInto(sec, { kind: 'setup', private: r && r.private });
      else if (r.noBoard) renderInto(sec, { kind: 'noBoard' });
      else renderInto(sec, { kind: 'error', msg: r.error || '' });
    } catch (_) {
      const sec = document.getElementById(SECTION_ID); if (sec) renderInto(sec, { kind: 'error' });
    } finally { _loading = false; const r2 = document.getElementById(SECTION_ID)?.querySelector('.tk-refresh'); if (r2) r2.classList.remove('spin'); }
  }

  // ── Yerleşim bekçisi: About yüklenince enjekte et; SPA'da oyun değişince yenile ──
  function tick() {
    if (!_enabled || !/\/games\/(\d+)/.test(location.pathname)) { removeSection(); _curPlace = ''; return; }
    const pid = (location.pathname.match(/\/games\/(\d+)/) || [])[1] || '';
    if (pid !== _curPlace) { _curPlace = pid; _boardId = ''; _detectedFor = ''; removeSection(); }   // oyun değişti
    const host = aboutHost(); if (!host) return;                                                     // About henüz yok
    let sec = document.getElementById(SECTION_ID);
    if (!sec || !host.contains(sec)) { sec = ensureSection(); if (sec) { renderInto(sec, { kind: 'loading' }); refresh(); } }
  }

  function start() { injectStyles(); clearInterval(_tick); _tick = setInterval(tick, 1500); tick(); }
  function stop() { clearInterval(_tick); _tick = null; _curPlace = ''; removeSection(); }
  function applyState(on) { _enabled = !!on; if (_enabled) start(); else stop(); }

  // ── Başlat ──
  (async () => {
    try { const d = await chrome.storage.local.get('rota_settings'); applyState(d?.rota_settings?.trelloEnabled === true); } catch (_) {}
  })();
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !ch.rota_settings) return;
      const nv = ch.rota_settings.newValue || {};
      const wasOn = _enabled;
      applyState(nv.trelloEnabled === true);
      if (wasOn && _enabled) { _detectedFor = ''; refresh(); }   // kimlik bilgileri değişince tazele
    });
  } catch (_) {}
})();
