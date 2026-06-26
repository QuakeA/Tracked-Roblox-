// card_actions.js — Oyun kartlarına hover'da 2 hızlı buton ekler:
//   SOL  = Normal giriş (rastgele sunucu, Roblox "Play" gibi)  → roblox://experiences/start?placeId=
//   SAĞ  = Oto-Pilot (en yakın sunucu)  → oyun sayfasına ?tracked_ap=1 ile git, orada otomatik tetiklenir
// Home / Charts / Discover / Arama / Profil — oyun kartı olan her yerde çalışır. SPA + React re-render'a
// dayanıklı (MutationObserver ile yeniden uygular). Eklentinin kendi UI'ı, isole IIFE.
(function () {
  'use strict';
  if (window.__tkCardActions) return; window.__tkCardActions = true;

  const HOST_ATTR = 'data-tk-ca';        // işaretlenmiş kart (tekrar işlenmesin)
  const PLAY_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.5-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z"/></svg>';
  const AP_SVG   = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.6l7.4 3v5.1c0 4.4-3.1 7.8-7.4 9-4.3-1.2-7.4-4.6-7.4-9V5.6l7.4-3z"/><path d="M8.7 12.1l2.3 2.3 4.3-4.5"/></svg>';
  const PRIV_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

  function injectStyles() {
    if (document.getElementById('tk-ca-style')) return;
    const s = document.createElement('style');
    s.id = 'tk-ca-style';
    s.textContent = `
      .tk-ca-thumb { position: relative !important; }
      .tk-ca {
        position: absolute; left: var(--tk-ca-inset, 8px); right: var(--tk-ca-inset, 8px); bottom: 8px;
        display: flex; justify-content: space-between; align-items: flex-end; z-index: 40; pointer-events: none;
        transform: translateY(9px) scale(.95);
        transition: transform .34s cubic-bezier(.34,1.46,.52,1);   /* yukarı süzül + hafif overshoot (yaylanma → havalı) */
      }
      .tk-ca-col { display: flex; flex-direction: column; gap: 7px; }   /* sol sütun: private üstte, play altta */
      .tk-ca-card:hover .tk-ca, .tk-ca-thumb:hover .tk-ca {
        pointer-events: auto; transform: translateY(0) scale(1);
      }
      .tk-ca-btn {
        position: relative;
        width: 32px; height: 32px; border-radius: 28%; display: grid; place-items: center;
        cursor: pointer; color: #fff; border: 1px solid rgba(255,255,255,.22); padding: 0;
        background: linear-gradient(160deg, #4d8bf0, #2f6ad6);
        box-shadow: 0 0 0 1.5px rgba(0,0,0,.22), 0 4px 12px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.3);
        opacity: 0;
        transition: opacity .26s ease, transform .12s ease, filter .12s ease, box-shadow .12s ease;
        -webkit-backdrop-filter: blur(2px);
      }
      .tk-ca-card:hover .tk-ca-btn, .tk-ca-thumb:hover .tk-ca-btn { opacity: 1; }
      .tk-ca-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
      .tk-ca-btn:active { transform: translateY(0); }
      .tk-ca-btn svg { display: block; pointer-events: none; width: 58%; height: 58%; }
      .tk-ca-btn.tk-ca-play svg { transform: translateX(-1px); }   /* play üçgeni sağa kırpık → optik merkeze çek */
      .tk-ca-btn.tk-ca-ap svg { width: 66%; height: 66%; }   /* ince çizgili kalkan, dolu üçgenin yanında küçük görünür → optik dengele */
      /* oto-pilot, oyna'dan hafif SONRA süzülür (stagger → premium his); gecikme yalnız opacity'de (hover-lift anında) */
      .tk-ca-btn.tk-ca-ap {
        background: linear-gradient(160deg, #5b9cff, #3a6fd8);
        transition: opacity .26s ease .08s, transform .12s ease, filter .12s ease, box-shadow .12s ease;
      }
      /* Özel sunucu butonu: yalnız bedava+açık özel sunucu doğrulanınca görünür (oyna'nın tam üstü) */
      .tk-ca-priv { display: none; }
      .tk-ca.tk-ca-haspriv .tk-ca-priv { display: grid; }
      .tk-ca-btn.tk-ca-priv {
        /* renk diğer butonlarla AYNI (base mavi) — sadece stagger gecikmesi farklı */
        transition: opacity .26s ease .04s, transform .12s ease, filter .12s ease, box-shadow .12s ease;
      }
      .tk-ca-btn.tk-ca-priv svg { width: 62%; height: 62%; }
      /* Oto-Pilot "en yakın sunucuyu buluyor" durumu: ikon gizlenir, dönen spinner gelir */
      .tk-ca-btn.tk-ca-busy { pointer-events: none; }
      .tk-ca-btn.tk-ca-busy svg { opacity: 0; }
      .tk-ca-btn.tk-ca-busy::after {
        content: ''; position: absolute; inset: 0; margin: auto; width: 15px; height: 15px;
        border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
        animation: tk-ca-spin .6s linear infinite;
      }
      @keyframes tk-ca-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .tk-ca { transform: none; transition: none; }
        .tk-ca-btn, .tk-ca-btn.tk-ca-ap { transition: opacity .15s ease; }
        .tk-ca-btn.tk-ca-busy::after { animation-duration: 1.2s; }
      }
      .tk-ca-tip {
        position: fixed; z-index: 2147483600; background: rgba(15,18,24,.97); color: #fff;
        font: 600 11px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        padding: 5px 9px; border-radius: 7px; white-space: nowrap; pointer-events: none;
        opacity: 0; transition: opacity .1s ease; box-shadow: 0 6px 18px rgba(0,0,0,.5);
      }
      .tk-ca-tip.on { opacity: 1; }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // Karttan placeId çıkar (href: /games/<id>/...)
  function placeIdOf(link) {
    const href = link.getAttribute('href') || '';
    const m = href.match(/\/games\/(\d{4,})/);
    return m ? m[1] : null;
  }

  // Yön kontrollü tooltip (fixed → overflow:hidden thumb'da KESİLMEZ). dir: 'left' (sola uzar) | 'right'.
  let _tip = null;
  function showTip(btn, text, dir) {
    if (!_tip) { _tip = document.createElement('div'); _tip.className = 'tk-ca-tip'; (document.body || document.documentElement).appendChild(_tip); }
    _tip.textContent = text;
    const r = btn.getBoundingClientRect();
    _tip.style.top = Math.round(r.bottom + 8) + 'px';
    _tip.style.left = '0px';
    _tip.classList.add('on');
    const w = _tip.offsetWidth;
    _tip.style.left = Math.round(dir === 'left' ? (r.right - w) : r.left) + 'px';
  }
  function hideTip() { if (_tip) _tip.classList.remove('on'); }

  // Sekme açmadan, sayfadan ayrılmadan oyuna gir: SW launchRobloxGame (mevcut sekmenin MAIN
  // world'ünde Roblox'un kendi launcher'ı → "now loading" overlay'i çıkar). jobId VAR → belirli
  // sunucu (oto-pilot); YOK → rastgele sunucu ("Oyna"). Başarısızsa roblox:// deep-link fallback.
  function launchJoin(placeId, jobId, accessCode) {
    let dl = 'roblox://experiences/start?placeId=' + encodeURIComponent(placeId);
    if (jobId) dl += '&gameInstanceId=' + encodeURIComponent(jobId);
    else if (accessCode) dl += '&accessCode=' + encodeURIComponent(accessCode);
    const deeplink = () => { try { window.location.href = dl; } catch (_) {} };
    try {
      chrome.runtime.sendMessage({ action: 'launchRobloxGame', placeId: String(placeId), jobId: jobId ? String(jobId) : '', accessCode: accessCode ? String(accessCode) : '', gameTitle: (document.title || '') }, (r) => {
        if (chrome.runtime.lastError || !r || !r.success) deeplink();
      });
    } catch (_) { deeplink(); }
  }

  // Kullanıcının TÜM aktif özel sunucuları TEK seferde çekilir (SW my-private-servers) → her kart
  // anında kontrol eder, per-kart API çağrısı YOK. _ownedPriv: { placeId(string): privateServerId }.
  let _ownedPriv = null, _ownedCbs = [];
  function ensureOwnedPriv(cb) {
    if (_ownedPriv) return cb(_ownedPriv);
    _ownedCbs.push(cb);
    if (_ownedCbs.length > 1) return;   // çekim zaten sürüyor
    const finish = (map) => { _ownedPriv = map || {}; const cbs = _ownedCbs; _ownedCbs = []; cbs.forEach(f => { try { f(_ownedPriv); } catch (_) {} }); };
    try {
      chrome.runtime.sendMessage({ action: 'cardPrivateList' }, (resp) => finish((resp && resp.ok && resp.owned) ? resp.owned : {}));
    } catch (_) { finish({}); }
  }
  function checkPriv(placeId, ov, privBtn) {
    ensureOwnedPriv((owned) => {
      const psid = owned[String(placeId)];
      if (psid) { ov.classList.add('tk-ca-haspriv'); privBtn._psid = psid; }
    });
  }

  // Roblox kartının üç-nokta (⋯) menü butonunu thumbnail'ın ÜST-SAĞ bölgesinde bul → rect (viewport). Bulamazsa null.
  function findMenuRect(scope, tr) {
    if (!scope || !tr || !tr.width) return null;
    let best = null, bs = Infinity;
    let els;
    try { els = scope.querySelectorAll('button, [role="button"], a[aria-haspopup], [class*="menu" i], [class*="context" i], [class*="overflow" i]'); }
    catch (_) { return null; }
    for (const el of els) {
      if (el.closest('.tk-ca')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.width > 52 || r.height < 12 || r.height > 52) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const rx = (cx - tr.left) / tr.width, ry = (cy - tr.top) / tr.height;
      if (rx < 0.6 || rx > 1.1 || ry < -0.1 || ry > 0.5) continue;   // üst-sağ bölge
      const s = ry + (1 - rx);   // en üst-sağ olanı seç
      if (s < bs) { bs = s; best = r; }
    }
    return best;
  }

  // ⋯'nin konumunu BİR KEZ ölç → global --tk-ca-inset (tüm kartlara uygulanır, tutarlı + ⋯ ile hizalı).
  // ⋯ sağ-kenardan hep aynı px uzaklıkta olduğu için tek ölçüm tüm kartlara yeter.
  const BTN = 32;        // .tk-ca-btn boyutuyla aynı
  const NUDGE_LEFT = 0;  // 0 = ölçülen ⋯ merkezine matematiksel kesin hizalama (göz kararı fudge yok)
  let _insetSet = false;
  function measureInset(scope, thumb) {
    if (_insetSet) return;
    try {
      const tr = thumb.getBoundingClientRect();
      const r = findMenuRect(scope, tr);
      if (r && tr.width > 40) {
        // oto-pilot (sağ buton) merkezi ⋯ merkezinin TAM altına gelsin:
        const menuCx = r.left + r.width / 2;
        const inset = (tr.right - menuCx) - BTN / 2 + NUDGE_LEFT;
        const clamped = Math.max(4, Math.min(Math.floor(tr.width / 2 - BTN - 4), inset));
        document.documentElement.style.setProperty('--tk-ca-inset', clamped + 'px');
        _insetSet = true;
      }
    } catch (_) {}
  }

  // Bir oyun kartını (link) işle: thumbnail'a 2 buton overlay ekle.
  function enhance(link) {
    if (!link || link.getAttribute(HOST_ATTR)) return;
    const placeId = placeIdOf(link);
    if (!placeId) return;
    const img = link.querySelector('img');
    if (!img) return;                                  // thumbnail yoksa atla (kart değil)
    // Thumbnail kutusu = img'in en yakın blok kapsayıcısı (kareye yakın, makul boyut)
    let thumb = img.parentElement;
    for (let i = 0; i < 3 && thumb && thumb !== link; i++) {
      const r = thumb.getBoundingClientRect();
      if (r.width >= 80 && r.height >= 70) break;       // yeterince büyük → thumbnail kutusu
      thumb = thumb.parentElement;
    }
    if (!thumb || thumb === document.body) thumb = img.parentElement;
    if (!thumb || thumb.querySelector(':scope > .tk-ca')) { link.setAttribute(HOST_ATTR, '1'); return; }

    link.setAttribute(HOST_ATTR, '1');
    link.classList.add('tk-ca-card');
    thumb.classList.add('tk-ca-thumb');

    const ov = document.createElement('div');
    ov.className = 'tk-ca';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML =
      `<div class="tk-ca-col">` +
        `<button class="tk-ca-btn tk-ca-priv" type="button" aria-label="Özel sunucu">${PRIV_SVG}</button>` +
        `<button class="tk-ca-btn tk-ca-play" type="button" aria-label="Oyna">${PLAY_SVG}</button>` +
      `</div>` +
      `<button class="tk-ca-btn tk-ca-ap" type="button" aria-label="Oto-Pilot">${AP_SVG}</button>`;
    thumb.appendChild(ov);

    // ⋯ konumunu bir kez ölç (global inset) + özel sunucu durumu (oyun başına, tembel).
    // ⋯ ve durum çoğunlukla hover'da gelir → enhance'te + ilk hover'da dene.
    const scope = link.parentElement || link;
    const privBtn = ov.querySelector('.tk-ca-priv');
    measureInset(scope, thumb);
    // Özel sunucu durumu yalnız HOVER'da sorulur (her kart için kitlesel API çağrısı olmasın).
    link.addEventListener('mouseenter', function once() {
      measureInset(scope, thumb);
      checkPriv(placeId, ov, privBtn);
      link.removeEventListener('mouseenter', once);
    });

    const playBtn = ov.querySelector('.tk-ca-play');
    const apBtn = ov.querySelector('.tk-ca-ap');
    privBtn.addEventListener('mouseenter', () => showTip(privBtn, 'Özel sunucu (bedava)', 'left'));   // sola uzar
    playBtn.addEventListener('mouseenter', () => showTip(playBtn, 'Oyna', 'left'));   // sola uzar
    apBtn.addEventListener('mouseenter', () => showTip(apBtn, 'Oto-Pilot — en yakın sunucuya bağlan', 'right')); // sağa uzar
    privBtn.addEventListener('mouseleave', hideTip);
    playBtn.addEventListener('mouseleave', hideTip);
    apBtn.addEventListener('mouseleave', hideTip);

    const stop = (e) => { e.preventDefault(); e.stopPropagation(); hideTip(); };
    playBtn.addEventListener('click', (e) => {
      stop(e);
      // Normal giriş: rastgele sunucu (Roblox "Play" gibi) — native launcher → Roblox'un "now loading" overlay'i çıkar
      launchJoin(placeId, null);
    });
    // Özel sunucu: kendi bedava sunucuna anında gir; yoksa SW bedava oluşturup verir (expectedPrice:0
    // → ücretliyse Robux harcanmaz). Sayfa değişmez. "Hallediyor" spinner'ı.
    let _privBusy = false;
    privBtn.addEventListener('click', async (e) => {
      stop(e);
      if (_privBusy) return;
      _privBusy = true; privBtn.classList.add('tk-ca-busy'); hideTip();
      let done = false;
      const finish = (ok, accessCode) => {
        if (done) return; done = true;
        clearTimeout(guard);
        _privBusy = false; privBtn.classList.remove('tk-ca-busy');
        if (ok && accessCode) launchJoin(placeId, null, accessCode);
        else { showTip(privBtn, 'Özel sunucu açılamadı — tekrar dene', 'left'); setTimeout(hideTip, 2400); }
      };
      const guard = setTimeout(() => finish(false), 25000);
      try {
        chrome.runtime.sendMessage({ action: 'cardPrivateJoin', placeId, privateServerId: privBtn._psid || undefined }, (resp) => {
          if (chrome.runtime.lastError) return finish(false);
          finish(!!(resp && resp.ok && resp.accessCode), resp && resp.accessCode);
        });
      } catch (_) { finish(false); }
    });
    // Oto-Pilot: oyun sayfasına GİTMEDEN, kartın üstünden en yakın sunucuyu bul (SW cardAutoPilot)
    // → native başlat (sekme yok, sayfa değişmez). Pro-gate + "buluyor" spinner'ı.
    let _apBusy = false;
    apBtn.addEventListener('click', async (e) => {
      stop(e);
      if (_apBusy) return;
      let isPlus = false;
      try { isPlus = window.TrackedLicense ? await window.TrackedLicense.isPlus() : false; } catch (_) {}
      if (!isPlus) { try { chrome.runtime.sendMessage({ action: 'openPlusPage' }); } catch (_) {} return; }
      _apBusy = true; apBtn.classList.add('tk-ca-busy'); hideTip();
      let done = false;
      const finish = (ok, jobId) => {
        if (done) return; done = true;
        clearTimeout(guard);
        _apBusy = false; apBtn.classList.remove('tk-ca-busy');
        if (ok && jobId) launchJoin(placeId, jobId);
        else { showTip(apBtn, 'En yakın sunucu bulunamadı — tekrar dene', 'right'); setTimeout(hideTip, 2200); }
      };
      const guard = setTimeout(() => finish(false), 25000);   // pick uzarsa serbest bırak
      try {
        chrome.runtime.sendMessage({ action: 'cardAutoPilot', placeId }, (resp) => {
          if (chrome.runtime.lastError) return finish(false);
          finish(!!(resp && resp.ok && resp.jobId), resp && resp.jobId);
        });
      } catch (_) { finish(false); }
    });
    ov.addEventListener('click', (e) => e.stopPropagation());
  }

  function scan() {
    try {
      document.querySelectorAll('a[href*="/games/"]:not([' + HOST_ATTR + '])').forEach(enhance);
    } catch (_) {}
  }

  // Throttle (debounce DEĞİL): sayfa yüklenirken DOM sürekli değişir; saf debounce her
  // mutasyonda sıfırlandığı için tarama mutasyonlar durana dek (~1-2sn) hiç çalışmıyordu →
  // butonlar geç geliyordu. Throttle, sürekli mutasyonda bile ~180ms'de bir tarar → kartlar
  // çıkar çıkmaz yakalanır, hover'da anında görünür.
  let _t = 0, _last = 0;
  function scheduleScan() {
    const now = Date.now(), since = now - _last;
    if (since >= 180) { _last = now; scan(); }
    else { clearTimeout(_t); _t = setTimeout(() => { _last = Date.now(); scan(); }, 180 - since); }
  }

  function start() {
    injectStyles();
    scan();
    try {
      const mo = new MutationObserver(scheduleScan);
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
    // İlk render'ı hızlı yakala (lazy görseller + React kademeli render): erken birkaç tarama
    [100, 300, 600, 1000, 1600].forEach((ms) => setTimeout(scan, ms));
    // SPA gezinmesinde de tara
    window.addEventListener('popstate', scheduleScan);
    setInterval(scan, 2500);   // güvenlik ağı (React kartları geç gelebilir / overlay'i silebilir)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
