// codes_content.js — Tracked: Oyun Kodları paneli (oyun sayfası).
// DÜRÜST kaynaklar: küratörlü repo (varsa gerçek) + oyun açıklaması + oyunun RESMİ sosyal linkleri
// (kodlar gerçekten orada duyurulur) + "web'de güncel ara". Resmi kod API'si YOK → uydurma yok;
// her şey kaynak + "doğrulanmamış" etiketiyle. Veri gerçek, geçerlilik iddiası yok (kullanıcı deneyerek görür).
(function () {
  'use strict';
  if (window._trackedCodesSetup) return;
  window._trackedCodesSetup = true;

  const WID = 'tracked-codes';
  const STYLE = 'tracked-codes-style';
  let _enabled = false, _open = false, _loaded = false, _data = null, _placeId = null;

  const ICON_GIFT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M12 8v13M3 12h18M12 8S10.5 4 8 4a2 2 0 0 0 0 4zM12 8s1.5-4 4-4a2 2 0 0 1 0 4z"/></svg>';
  const ICON_COPY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const ICON_OUT = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const MARK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3.5l2.2-6.5 4.2 13 2.3-6.5H21"/></svg>';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const swMsg = (m) => new Promise(res => { try { chrome.runtime.sendMessage(m, r => { if (chrome.runtime.lastError) { res(null); return; } res(r || null); }); } catch { res(null); } });
  function placeIdFromUrl() { const m = location.pathname.match(/\/games\/(\d+)/); return m ? m[1] : null; }
  function socialMeta(type) {
    const t = String(type || '').toLowerCase();
    if (t.indexOf('twitter') >= 0 || t === 'x') return { label: 'Twitter/X', col: '#1d9bf0' };
    if (t.indexOf('discord') >= 0) return { label: 'Discord', col: '#5865f2' };
    if (t.indexOf('youtube') >= 0) return { label: 'YouTube', col: '#ff0000' };
    if (t.indexOf('facebook') >= 0) return { label: 'Facebook', col: '#1877f2' };
    if (t.indexOf('twitch') >= 0) return { label: 'Twitch', col: '#9146ff' };
    if (t.indexOf('guilded') >= 0) return { label: 'Guilded', col: '#f5c400' };
    return { label: type || 'Bağlantı', col: '#8aa0b6' };
  }

  function injectStyles() {
    if (document.getElementById(STYLE)) return;
    const s = document.createElement('style'); s.id = STYLE;
    s.textContent = `
      #${WID}-btn{position:fixed;right:18px;bottom:18px;z-index:9000;display:flex;align-items:center;gap:7px;
        padding:9px 13px;border-radius:13px;border:1px solid rgba(255,255,255,.12);cursor:pointer;
        background:linear-gradient(150deg,#7b4cff,#4c8bf5);color:#fff;font:600 12.5px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        box-shadow:0 8px 24px rgba(80,60,200,.45);transition:transform .15s,box-shadow .2s;}
      #${WID}-btn:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(80,60,200,.6);}
      #${WID}-btn .c{background:rgba(255,255,255,.22);border-radius:8px;padding:1px 6px;font-size:11px;}
      #${WID}{position:fixed;right:18px;bottom:18px;z-index:9001;width:330px;max-width:calc(100vw - 36px);box-sizing:border-box;
        background:linear-gradient(180deg,rgba(23,23,29,.97),rgba(13,13,18,.99));backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
        border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 14px 44px rgba(0,0,0,.6);
        color:rgba(255,255,255,.9);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden;
        animation:tc-in .3s cubic-bezier(.2,.85,.25,1) both;}
      @keyframes tc-in{from{opacity:0;transform:translateY(14px) scale(.97);}to{opacity:1;transform:none;}}
      .tc-head{display:flex;align-items:center;gap:7px;padding:12px 14px 10px;}
      .tc-logo{display:inline-flex;color:#6f9cff;}
      .tc-ttl{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.55);}
      .tc-name{flex:1;min-width:0;font-size:11px;color:rgba(255,255,255,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .tc-x{margin-left:auto;background:none;border:none;color:rgba(255,255,255,.45);cursor:pointer;padding:4px;border-radius:7px;display:inline-flex;}
      .tc-x:hover{background:rgba(255,255,255,.12);color:#fff;}
      .tc-body{padding:0 14px 14px;max-height:min(60vh,520px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;}
      .tc-warn{font-size:10.5px;color:#ffcf6b;background:rgba(255,180,40,.1);border:1px solid rgba(255,180,40,.22);border-radius:9px;padding:7px 10px;line-height:1.45;margin-bottom:10px;}
      .tc-sec{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:rgba(255,255,255,.4);margin:10px 0 7px;}
      .tc-code{display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:6px;}
      .tc-code .tc-cmeta{flex:1;min-width:0;}
      .tc-code .tc-c{font-size:13px;font-weight:700;color:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.3px;word-break:break-all;}
      .tc-code .tc-r{font-size:10.5px;color:rgba(255,255,255,.55);margin-top:1px;}
      .tc-copy{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.06);color:#fff;cursor:pointer;font:600 11px/1 inherit;transition:background .15s,border-color .15s;}
      .tc-copy:hover{background:var(--tc-accent,#4c8bf5);border-color:transparent;}
      .tc-copy.ok{background:#2faf5a;border-color:transparent;}
      .tc-src{font-size:9.5px;color:rgba(255,255,255,.35);margin-left:6px;}
      .tc-links{display:flex;flex-wrap:wrap;gap:6px;}
      .tc-link{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.05);color:#fff;cursor:pointer;font:600 11px/1 inherit;text-decoration:none;transition:background .15s,transform .12s;}
      .tc-link:hover{background:rgba(255,255,255,.12);transform:translateY(-1px);}
      .tc-link .dot{width:7px;height:7px;border-radius:50%;}
      .tc-search{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:10px;padding:10px;border-radius:11px;
        border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#fff;cursor:pointer;font:600 12px/1 inherit;transition:background .15s;}
      .tc-search:hover{background:rgba(255,255,255,.12);}
      .tc-empty{font-size:11px;color:rgba(255,255,255,.45);line-height:1.5;padding:4px 0 2px;}
      .tc-load{font-size:11px;color:rgba(255,255,255,.5);text-align:center;padding:18px 0;}
      .tc-foot{font-size:9px;color:rgba(255,255,255,.3);margin-top:11px;line-height:1.5;}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function renderBtn() {
    if (document.getElementById(WID) || document.getElementById(WID + '-btn')) return;
    const b = document.createElement('button'); b.id = WID + '-btn';
    b.innerHTML = `${ICON_GIFT}<span>Kodlar</span>`;
    b.addEventListener('click', () => { _open = true; document.getElementById(WID + '-btn')?.remove(); renderPanel(); if (!_loaded) load(); });
    document.body.appendChild(b);
  }

  function panelClose() { _open = false; document.getElementById(WID)?.remove(); if (_enabled) renderBtn(); }

  function renderPanel() {
    let w = document.getElementById(WID);
    if (!w) { w = document.createElement('div'); w.id = WID; document.body.appendChild(w); }
    const d = _data;
    let body;
    if (!_loaded) {
      body = `<div class="tc-load">Kodlar aranıyor…</div>`;
    } else if (!d || !d.ok) {
      body = `<div class="tc-empty">Kod bilgisi alınamadı.</div>`;
    } else {
      const codes = d.codes || [];
      const warn = `<div class="tc-warn">⚠ Doğrulanmamış — süresi dolmuş olabilir. Roblox'ta resmi kod API'si yok; kodlar topluluk/açıklama kaynaklı. Çalışmazsa aşağıdaki resmi kaynaklara bak.</div>`;
      let codesHtml;
      if (codes.length) {
        codesHtml = `<div class="tc-sec">Bulunan kodlar (${codes.length})</div>` + codes.map((c, i) => `
          <div class="tc-code">
            <span class="tc-cmeta"><div class="tc-c">${esc(c.code)}</div>${c.reward ? `<div class="tc-r">${esc(c.reward)}</div>` : ''}<span class="tc-src">${c.source === 'repo' ? 'ProGameGuides' : 'oyun açıklaması'}</span></span>
            <button class="tc-copy" data-code="${esc(c.code)}" data-i="${i}">${ICON_COPY}<span>Kopyala</span></button>
          </div>`).join('');
      } else {
        codesHtml = `<div class="tc-empty">Otomatik kaynaklarda kod bulunamadı. Bu oyun kodlarını muhtemelen aşağıdaki resmi kanallarında ya da oyun içinde duyuruyor.</div>`;
      }
      const socials = (d.socials || []).filter(s => s.url);
      let socialHtml = '';
      if (socials.length) {
        socialHtml = `<div class="tc-sec">Resmi kaynaklar (kodlar burada duyurulur)</div><div class="tc-links">` +
          socials.map(s => { const m = socialMeta(s.type); return `<a class="tc-link" href="${esc(s.url)}" target="_blank" rel="noopener"><span class="dot" style="background:${m.col}"></span>${esc(m.label)}${ICON_OUT}</a>`; }).join('') + `</div>`;
      }
      const repoHtml = d.repoUrl ? `<div class="tc-foot">Kod kaynağı: <a href="${esc(d.repoUrl)}" target="_blank" rel="noopener" style="color:#7b9cff">ProGameGuides</a> · denenerek doğrulanmalı</div>` : '';
      body = warn + codesHtml + socialHtml +
        `<button class="tc-search" data-search="1">Web'de güncel kodları ara${ICON_OUT}</button>` + repoHtml;
    }
    w.innerHTML = `
      <div class="tc-head"><span class="tc-logo">${MARK}</span><span class="tc-ttl">Kodlar</span><span class="tc-name">${esc(d && d.name ? d.name : '')}</span><button class="tc-x" title="Kapat">${ICON_X}</button></div>
      <div class="tc-body">${body}</div>`;
    w.querySelector('.tc-x')?.addEventListener('click', panelClose);
    w.querySelectorAll('.tc-copy').forEach(btn => btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      try { navigator.clipboard.writeText(code); } catch (_) { const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
      btn.classList.add('ok'); btn.innerHTML = `${ICON_CHECK}<span>Kopyalandı</span>`;
      setTimeout(() => { btn.classList.remove('ok'); btn.innerHTML = `${ICON_COPY}<span>Kopyala</span>`; }, 1400);
    }));
    w.querySelector('.tc-search')?.addEventListener('click', () => { if (_data && _data.searchUrl) window.open(_data.searchUrl, '_blank', 'noopener'); });
  }

  async function load() {
    _loaded = false; renderPanel();
    _data = await swMsg({ action: 'getGameCodes', placeId: _placeId });
    _loaded = true;
    if (_open) renderPanel();
  }

  function start() {
    if (_enabled) return; _enabled = true; injectStyles();
    _placeId = placeIdFromUrl();
    if (!_placeId) return;
    if (_open) renderPanel(); else renderBtn();
  }
  function stop() { _enabled = false; _open = false; document.getElementById(WID)?.remove(); document.getElementById(WID + '-btn')?.remove(); }

  // SPA navigasyon: oyun değişince sıfırla
  let _lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname === _lastPath) return;
    _lastPath = location.pathname;
    const pid = placeIdFromUrl();
    if (pid !== _placeId) { _placeId = pid; _loaded = false; _data = null; _open = false; document.getElementById(WID)?.remove(); document.getElementById(WID + '-btn')?.remove(); if (_enabled && pid) renderBtn(); }
  }, 1200);

  (async () => {
    try {
      const d = await chrome.storage.local.get(['rota_settings']);
      if (d?.rota_settings?.gameCodes !== false) start(); // varsayılan AÇIK
    } catch (_) { start(); }
  })();
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !ch.rota_settings) return;
      const on = !ch.rota_settings.newValue || ch.rota_settings.newValue.gameCodes !== false;
      if (on && !_enabled) start(); else if (!on && _enabled) stop();
    });
  } catch (_) {}
})();
