// trello_panel.js — Tracked v1.9.5: Oyun sayfasına native "Trello" SEKMESİ ekler.
// About/Store/Servers ile birebir aynı sekme tasarımı (.rbx-tab); tıklayınca tam-genişlik
// tab-pane açılır → Trello board (yatay list kolonları + kapak görselleri) rahatça görünür.
// Board oyundan OTOMATİK bulunur (SW). PUBLIC pano auth'suz; private için key+token. OPT-IN.

(function () {
  'use strict';
  if (window._trackedTrelloSetup) return;
  window._trackedTrelloSetup = true;

  const TAB_ID  = 'tab-tracked-trello';
  const PANE_ID = 'tracked-trello';
  const STYLE_ID = 'tracked-trello-style';

  // ── İkonlar ──
  const ICON_TRELLO = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="6.5" y="6.5" width="4" height="9.5" rx="1"/><rect x="13.5" y="6.5" width="4" height="6" rx="1"/></svg>';
  const ICON_REFRESH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>';
  const ICON_EDIT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const ICON_CAL = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>';
  const ICON_EMPTY = '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="opacity:.5"><rect x="3" y="3" width="18" height="18" rx="3"/><rect x="6.5" y="6.5" width="3.5" height="9" rx="1"/><rect x="13.5" y="6.5" width="3.5" height="5.5" rx="1"/></svg>';

  const t = (k, fb) => { try { if (typeof TrackedI18n !== 'undefined') { const v = TrackedI18n.t(k); if (v && v !== k) return v; } } catch (_) {} return fb; };
  function swMsg(msg) { return new Promise(res => { try { chrome.runtime.sendMessage(msg, r => { if (chrome.runtime.lastError) { res(null); return; } res(r || null); }); } catch { res(null); } }); }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function parseBoardId(v) { v = String(v || '').trim(); const m = v.match(/trello\.com\/b\/([A-Za-z0-9]+)/); if (m) return m[1]; if (/^[A-Za-z0-9]{6,32}$/.test(v)) return v; return ''; }
  const LABEL_COLORS = { green:'#61bd4f', yellow:'#f2d600', orange:'#ff9f1a', red:'#eb5a46', purple:'#c377e0', blue:'#0079bf', sky:'#00c2e0', lime:'#51e898', pink:'#ff78cb', black:'#344563' };
  function fmtDue(iso) { try { const d = new Date(iso); if (isNaN(d)) return ''; return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (_) { return ''; } }

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
  const curPlace = () => (location.pathname.match(/\/games\/(\d+)/) || [])[1] || '';

  // Kapak proxy kuyruğu — çok sayıda kapak aynı anda SW'yi boğmasın (4 eşzamanlı)
  const _pq = []; let _pqActive = 0;
  function dropCover(img) { const c = img && img.closest('.tk-cover'); if (c) c.remove(); }
  function enqueueProxy(img) { _pq.push(img); pumpProxy(); }
  function pumpProxy() {
    while (_pqActive < 4 && _pq.length) {
      const img = _pq.shift(); _pqActive++;
      swMsg({ action: 'trelloImg', url: img.getAttribute('src') }).then(r => {
        _pqActive--;
        if (r && r.ok && r.dataUrl) { img.addEventListener('error', () => dropCover(img), { once: true }); img.src = r.dataUrl; }
        else dropCover(img);
        pumpProxy();
      });
    }
  }

  let _enabled = false, _loading = false, _place = '';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      /* Sekme satırı: Trello eklenince ALT SATIRA kaymasın — tek satırda EŞİT dağılsın */
      #horizontal-tabs{display:flex!important;flex-wrap:nowrap!important;}
      #horizontal-tabs>li.rbx-tab{flex:1 1 0!important;width:auto!important;min-width:0!important;float:none!important;}
      /* Koyu-opak, okunaklı board UI (sayfa temasından bağımsız) */
      #${PANE_ID}{padding:6px 0 6px;color:#e8eaef;}
      #${PANE_ID} .tk-bar{display:flex;align-items:center;gap:11px;padding:8px 4px 4px;}
      #${PANE_ID} .tk-ttl{display:flex;align-items:center;gap:11px;font-size:19px;font-weight:750;color:#fff;letter-spacing:-.01em;}
      #${PANE_ID} .tk-ttl svg{color:#4d8bf0;flex-shrink:0;}
      #${PANE_ID} .tk-act{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13);color:#cdd2da;cursor:pointer;width:34px;height:34px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;transition:background .15s,color .15s,transform .4s;}
      #${PANE_ID} .tk-act:hover{background:rgba(255,255,255,.16);color:#fff;}
      #${PANE_ID} .tk-refresh.spin svg{animation:tk-spin .8s linear infinite;}
      @keyframes tk-spin{to{transform:rotate(360deg);}}
      #${PANE_ID} .tk-board{display:flex;gap:16px;overflow-x:auto;overflow-y:hidden;padding:16px 4px 20px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.26) transparent;}
      #${PANE_ID} .tk-board::-webkit-scrollbar{height:11px;}
      #${PANE_ID} .tk-board::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22);border-radius:8px;border:2px solid transparent;background-clip:content-box;}
      #${PANE_ID} .tk-col{flex:0 0 345px;max-width:345px;max-height:920px;display:flex;flex-direction:column;
        background:linear-gradient(180deg,rgba(27,30,38,.975),rgba(20,22,29,.985));
        border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:13px 11px 11px;
        box-shadow:0 12px 32px rgba(0,0,0,.42);backdrop-filter:blur(6px);}
      #${PANE_ID} .tk-col-h{display:flex;align-items:center;gap:9px;font-weight:750;font-size:14.5px;color:#fff;margin:0 4px 12px;}
      #${PANE_ID} .tk-col-h .tk-dot{width:9px;height:9px;border-radius:3px;background:#4d8bf0;flex-shrink:0;box-shadow:0 0 8px rgba(77,139,240,.6);}
      #${PANE_ID} .tk-col-h .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      #${PANE_ID} .tk-col-h .cnt{font-size:11px;color:#aeb4c0;font-weight:700;background:rgba(255,255,255,.1);border-radius:20px;padding:2px 9px;flex-shrink:0;}
      #${PANE_ID} .tk-col-cards{overflow-y:auto;display:flex;flex-direction:column;gap:9px;padding-right:4px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent;}
      #${PANE_ID} .tk-col-cards::-webkit-scrollbar{width:8px;}
      #${PANE_ID} .tk-col-cards::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:8px;border:2px solid transparent;background-clip:content-box;}
      #${PANE_ID} .tk-card{background:rgba(46,50,61,.97);border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden;transition:transform .12s,box-shadow .15s,border-color .15s;}
      #${PANE_ID} .tk-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.2);box-shadow:0 12px 26px rgba(0,0,0,.45);}
      #${PANE_ID} .tk-cover{width:100%;height:178px;min-height:178px;flex:0 0 178px;background:rgba(0,0,0,.28);line-height:0;overflow:hidden;}
      #${PANE_ID} .tk-cover img{display:block!important;width:100%!important;height:178px!important;max-height:178px!important;object-fit:cover!important;}
      #${PANE_ID} .tk-card-b{padding:10px 12px;display:flex;flex-direction:column;gap:7px;}
      #${PANE_ID} .tk-labels{display:flex;flex-wrap:wrap;gap:5px;}
      #${PANE_ID} .tk-lab{height:8px;min-width:36px;border-radius:5px;}
      #${PANE_ID} .tk-card-t{font-size:13.5px;line-height:1.42;color:#edeff3;word-break:break-word;}
      #${PANE_ID} .tk-due{align-self:flex-start;display:inline-flex;align-items:center;gap:5px;font-size:11px;color:#c4c9d2;background:rgba(255,255,255,.08);border-radius:7px;padding:3px 8px;}
      #${PANE_ID} .tk-due svg{opacity:.85;}
      #${PANE_ID} .tk-empty{font-size:12px;color:#7e828c;padding:6px 4px;}
      #${PANE_ID} .tk-msg{padding:42px 16px;text-align:center;color:#b6bbc4;font-size:14px;line-height:1.7;}
      #${PANE_ID} .tk-link{color:#4d8bf0;cursor:pointer;text-decoration:underline;}
      #${PANE_ID} .tk-sk{flex:0 0 345px;height:300px;border-radius:16px;background:linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.11),rgba(255,255,255,.05));background-size:200% 100%;animation:tk-sh 1.3s infinite;}
      @keyframes tk-sh{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
      #${PANE_ID} .tk-setup{max-width:430px;margin:28px auto;display:flex;flex-direction:column;gap:11px;}
      #${PANE_ID} .tk-setup p{margin:0;font-size:13px;color:#b6bbc4;line-height:1.55;}
      #${PANE_ID} .tk-setup input{box-sizing:border-box;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:9px;color:#fff;font:inherit;font-size:13.5px;padding:11px 13px;outline:none;}
      #${PANE_ID} .tk-setup input:focus{border-color:#4d8bf0;}
      #${PANE_ID} .tk-btn{background:linear-gradient(180deg,#4d8bf0,#2f6fe0);border:none;color:#fff;font-weight:750;font-size:13.5px;padding:11px;border-radius:9px;cursor:pointer;font-family:inherit;transition:filter .15s;}
      #${PANE_ID} .tk-btn:hover{filter:brightness(1.08);}
      #${PANE_ID} .tk-btn.ghost{background:rgba(255,255,255,.1);color:#dfe3ea;font-weight:650;}
      @media (prefers-reduced-motion: reduce){#${PANE_ID} *{animation:none!important;}}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ── Sekme grubu ──
  function tabGroup() {
    const ul = document.querySelector('#horizontal-tabs') || document.querySelector('.rbx-tabs-horizontal .nav-tabs');
    const panes = document.querySelector('.rbx-tab-content') || document.querySelector('.rbx-tabs-horizontal .tab-content');
    return (ul && panes) ? { ul, panes } : null;
  }

  function ensureTab() {
    const g = tabGroup(); if (!g) return false;
    let tab = document.getElementById(TAB_ID), pane = document.getElementById(PANE_ID);
    const ok = tab && g.ul.contains(tab) && pane && g.panes.contains(pane);
    if (ok) return true;
    if (tab) tab.remove(); if (pane) pane.remove();
    // Sekme başlığı — About/Store/Servers ile BİREBİR aynı yapı
    tab = document.createElement('li');
    tab.id = TAB_ID; tab.className = 'rbx-tab tab-tracked-trello';
    tab.innerHTML = `<a class="rbx-tab-heading" href="#${PANE_ID}"><span class="text-lead">Trello</span></a>`;
    g.ul.appendChild(tab);
    // İçerik bölmesi
    pane = document.createElement('div');
    pane.id = PANE_ID; pane.className = 'tab-pane';
    g.panes.appendChild(pane);
    // Sekme geçişi
    tab.querySelector('.rbx-tab-heading').addEventListener('click', (e) => {
      e.preventDefault();
      g.ul.querySelectorAll('.rbx-tab').forEach(x => x.classList.remove('active'));
      g.panes.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('active'));
      tab.classList.add('active'); pane.classList.add('active');
      onShow();
    });
    // Native sekmeler tıklanınca bizimkini kapat (Roblox kendi pane'ini açar)
    g.ul.querySelectorAll('.rbx-tab:not(.tab-tracked-trello) .rbx-tab-heading').forEach(h => {
      h.addEventListener('click', () => { tab.classList.remove('active'); pane.classList.remove('active'); });
    });
    return true;
  }

  function onShow() {
    const pane = document.getElementById(PANE_ID); if (!pane) return;
    const pid = curPlace();
    if (pane.dataset.loadedFor === pid) return;   // bu oyun için zaten yüklendi (tembel yükleme)
    pane.dataset.loadedFor = pid;
    renderInto(pane, { kind: 'loading' });
    refresh();
  }

  // ── Render ──
  function cardHtml(c) {
    const cover = c.cover ? `<div class="tk-cover"><img src="${esc(c.cover)}" alt="" referrerpolicy="no-referrer" loading="lazy"></div>` : '';
    const labs = (c.labels || []).filter(l => l.color).map(l => `<span class="tk-lab" style="background:${LABEL_COLORS[l.color] || '#5e6c84'}" title="${esc(l.name || l.color)}"></span>`).join('');
    const due = c.due ? `<span class="tk-due">${ICON_CAL}${esc(fmtDue(c.due))}</span>` : '';
    return `<div class="tk-card">${cover}<div class="tk-card-b">${labs ? `<div class="tk-labels">${labs}</div>` : ''}<div class="tk-card-t">${esc(c.name || '')}</div>${due}</div></div>`;
  }
  function barHtml(title, busy) {
    return `<div class="tk-bar"><span class="tk-ttl">${ICON_TRELLO}${esc(title)}</span>
      <button class="tk-act tk-edit" title="${t('trelloEdit', 'Pano değiştir')}" style="margin-left:auto">${ICON_EDIT}</button>
      <button class="tk-act tk-refresh${busy ? ' spin' : ''}" title="${t('trelloRefresh', 'Yenile')}">${ICON_REFRESH}</button></div>`;
  }
  function wire(pane) {
    pane.querySelector('.tk-edit')?.addEventListener('click', () => renderInto(pane, { kind: 'setup' }));
    pane.querySelector('.tk-refresh')?.addEventListener('click', () => refresh());
    pane.querySelector('.tk-manual')?.addEventListener('click', () => renderInto(pane, { kind: 'setup' }));
    // Kapak görseli: doğrudan trello.com URL'i önce denenir; Roblox img-CSP'si engellerse
    // SW proxy KUYRUĞUNA alınır (data-URL → CSP bypass). Kuyruk eşzamanlılığı sınırlar → hepsi yüklenir.
    pane.querySelectorAll('.tk-cover img').forEach(img => {
      img.addEventListener('error', function onErr() {
        img.removeEventListener('error', onErr);
        if (img.dataset.proxied) { dropCover(img); return; }
        img.dataset.proxied = '1';
        enqueueProxy(img);
      });
    });
  }
  function renderInto(pane, st) {
    if (!pane) return;
    const k = st.kind;
    if (k === 'loading') { pane.innerHTML = barHtml('Trello', true) + `<div class="tk-board">${'<div class="tk-sk"></div>'.repeat(5)}</div>`; wire(pane); return; }
    if (k === 'board') {
      const d = st.data, lists = Array.isArray(d.lists) ? d.lists : [];
      const board = lists.length
        ? `<div class="tk-board">${lists.map(l => `<div class="tk-col"><div class="tk-col-h"><span class="tk-dot"></span><span class="nm">${esc(l.name || '')}</span><span class="cnt">${(l.cards || []).length}</span></div><div class="tk-col-cards">${(l.cards || []).length ? (l.cards || []).map(cardHtml).join('') : `<div class="tk-empty">—</div>`}</div></div>`).join('')}</div>`
        : `<div class="tk-msg">${ICON_EMPTY}<br>${t('trelloEmpty', 'Bu panoda liste yok.')}</div>`;
      pane.innerHTML = barHtml((d.board && d.board.name) || 'Trello', false) + board;
      wire(pane); return;
    }
    if (k === 'noBoard') { pane.innerHTML = barHtml('Trello', false) + `<div class="tk-msg">${t('trelloNoBoard', 'Bu oyunun açıklamasında Trello linki bulunamadı.')} <span class="tk-link tk-manual">${t('trelloManual', 'Elle gir')}</span></div>`; wire(pane); return; }
    if (k === 'error') { pane.innerHTML = barHtml('Trello', false) + `<div class="tk-msg">${t('trelloLoadErr', 'Trello yüklenemedi.')}${st.msg ? ' (' + esc(st.msg) + ')' : ''} <span class="tk-link tk-manual">${t('trelloRetry', 'Tekrar dene')}</span></div>`; wire(pane); pane.querySelector('.tk-manual')?.addEventListener('click', () => refresh()); return; }
    // setup
    const pv = st.private ? `<p>${t('trelloPrivate', 'Bu pano GİZLİ — okumak için API key + token gir (public panolar otomatik açılır).')}</p>` : `<p>${t('trelloManualHint', 'API key + token gir; pano otomatik bulunur (gerekiyorsa pano linkini de yazabilirsin).')}</p>`;
    pane.innerHTML = barHtml('Trello', false) + `
      <div class="tk-setup">
        ${pv}
        <input class="tk-key" type="text" placeholder="API key" autocomplete="off" spellcheck="false">
        <button class="tk-btn ghost tk-gettoken">${t('trelloGetToken', 'Token al (key gir → tıkla)')}</button>
        <input class="tk-token" type="text" placeholder="Token" autocomplete="off" spellcheck="false">
        <input class="tk-board-in" type="text" placeholder="${t('trelloBoardUrl', 'Pano URL (otomatikse boş bırak)')}" autocomplete="off" spellcheck="false">
        <button class="tk-btn tk-save">${t('trelloSave', 'Bağla')}</button>
      </div>`;
    wire(pane);
    const keyIn = pane.querySelector('.tk-key'), tokIn = pane.querySelector('.tk-token'), boardIn = pane.querySelector('.tk-board-in');
    pane.querySelector('.tk-gettoken')?.addEventListener('click', () => { const k2 = (keyIn.value || '').trim(); if (!k2) { keyIn.focus(); return; } try { window.open(`https://trello.com/1/authorize?expiration=never&scope=read&response_type=token&name=Tracked&key=${encodeURIComponent(k2)}`, '_blank', 'noopener'); } catch (_) {} });
    pane.querySelector('.tk-save')?.addEventListener('click', async () => {
      const key = (keyIn.value || '').trim(), token = (tokIn.value || '').trim(), bid = parseBoardId(boardIn.value);
      if (!key || !token) { keyIn.focus(); return; }
      try { const cur = await chrome.storage.local.get('rota_settings'); const rs = cur.rota_settings || {}; rs.trello = Object.assign({}, rs.trello, { key, token }); if (bid) rs.trello.boardId = bid; await chrome.storage.local.set({ rota_settings: rs }); } catch (_) {}
      const pane2 = document.getElementById(PANE_ID); if (pane2) pane2.dataset.loadedFor = '';
      refresh();
    });
  }

  // ── Çekme ──
  async function refresh() {
    const pane0 = document.getElementById(PANE_ID); if (!pane0 || _loading) return;
    _loading = true;
    const rb = pane0.querySelector('.tk-refresh'); if (rb) rb.classList.add('spin');
    if (!pane0.querySelector('.tk-board')) renderInto(pane0, { kind: 'loading' });
    try {
      const boardId = getBoardId();
      const r = await swMsg({ action: 'trelloFetchBoard', boardId, placeId: curPlace() });
      if (!_enabled) return;
      const pane = document.getElementById(PANE_ID); if (!pane) return;
      if (r && r.ok) renderInto(pane, { kind: 'board', data: r });
      else if (!r || r.needSetup) renderInto(pane, { kind: 'setup', private: r && r.private });
      else if (r.noBoard) renderInto(pane, { kind: 'noBoard' });
      else renderInto(pane, { kind: 'error', msg: r.error || '' });
    } catch (_) { const pane = document.getElementById(PANE_ID); if (pane) renderInto(pane, { kind: 'error' }); }
    finally { _loading = false; const r2 = document.getElementById(PANE_ID)?.querySelector('.tk-refresh'); if (r2) r2.classList.remove('spin'); }
  }

  // ── Bekçi: sekmeyi enjekte tut; oyun değişince sıfırla ──
  function tick() {
    if (!_enabled || !/\/games\/(\d+)/.test(location.pathname)) { document.getElementById(TAB_ID)?.remove(); document.getElementById(PANE_ID)?.remove(); _place = ''; return; }
    const pid = curPlace();
    if (pid !== _place) { _place = pid; _boardId = ''; _detectedFor = ''; document.getElementById(TAB_ID)?.remove(); document.getElementById(PANE_ID)?.remove(); }
    ensureTab();   // About/Store/Servers yüklendiyse sekmeyi ekler (yoksa bir sonraki tick'te)
  }

  let _timer = null;
  function start() { injectStyles(); clearInterval(_timer); _timer = setInterval(tick, 1500); tick(); }
  function stop() { clearInterval(_timer); _timer = null; _place = ''; document.getElementById(TAB_ID)?.remove(); document.getElementById(PANE_ID)?.remove(); }
  function applyState(on) { _enabled = !!on; if (_enabled) start(); else stop(); }

  (async () => { try { const d = await chrome.storage.local.get('rota_settings'); applyState(d?.rota_settings?.trelloEnabled === true); } catch (_) {} })();
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !ch.rota_settings) return;
      const wasOn = _enabled;
      applyState((ch.rota_settings.newValue || {}).trelloEnabled === true);
      if (wasOn && _enabled) { _detectedFor = ''; const p = document.getElementById(PANE_ID); if (p) { p.dataset.loadedFor = ''; if (p.classList.contains('active')) refresh(); } }
    });
  } catch (_) {}
})();
