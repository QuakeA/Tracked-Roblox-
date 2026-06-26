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

  function injectStyles() {
    if (document.getElementById('tk-ca-style')) return;
    const s = document.createElement('style');
    s.id = 'tk-ca-style';
    s.textContent = `
      .tk-ca-thumb { position: relative !important; }
      .tk-ca {
        position: absolute; left: var(--tk-ca-inset, 8px); right: var(--tk-ca-inset, 8px); bottom: 8px; transform: translateY(6px);
        display: flex; justify-content: space-between; z-index: 40; opacity: 0; pointer-events: none;
        transition: opacity .16s ease, transform .18s cubic-bezier(.2,.8,.25,1);
      }
      .tk-ca-card:hover .tk-ca, .tk-ca-thumb:hover .tk-ca {
        opacity: 1; pointer-events: auto; transform: translateY(0);
      }
      .tk-ca-btn {
        width: 32px; height: 32px; border-radius: 28%; display: grid; place-items: center;
        cursor: pointer; color: #fff; border: 1px solid rgba(255,255,255,.22); padding: 0;
        background: linear-gradient(160deg, #4d8bf0, #2f6ad6);
        box-shadow: 0 0 0 1.5px rgba(0,0,0,.22), 0 4px 12px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.3);
        transition: transform .12s ease, filter .12s ease, box-shadow .12s ease;
        -webkit-backdrop-filter: blur(2px);
      }
      .tk-ca-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
      .tk-ca-btn:active { transform: translateY(0); }
      .tk-ca-btn svg { display: block; pointer-events: none; width: 58%; height: 58%; }
      .tk-ca-btn.tk-ca-play svg { transform: translateX(-1px); }   /* play üçgeni sağa kırpık → optik merkeze çek */
      .tk-ca-btn.tk-ca-ap svg { width: 66%; height: 66%; }   /* ince çizgili kalkan, dolu üçgenin yanında küçük görünür → optik dengele */
      .tk-ca-btn.tk-ca-ap { background: linear-gradient(160deg, #5b9cff, #3a6fd8); }
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
        // GARANTİ DOĞRULAMA: bir sonraki frame'de gerçek buton merkezini ölç, ⋯ ile karşılaştır → konsola yaz
        requestAnimationFrame(() => {
          try {
            const ap = thumb.querySelector('.tk-ca-ap');
            const mr = findMenuRect(scope, thumb.getBoundingClientRect());
            if (!ap || !mr) return;
            const ar = ap.getBoundingClientRect();
            const apCx = ar.left + ar.width / 2, mCx = mr.left + mr.width / 2, diff = apCx - mCx;
            console.log('%c[Tracked] Kart hizalama (garanti ölçüm)', 'color:#5b9cff;font-weight:700;font-size:12px',
              '\n  ⋯ menü       → merkez X:', mCx.toFixed(2), '| sağ kenar:', mr.right.toFixed(1), '| çap:', mr.width.toFixed(1),
              '\n  oto-pilot    → merkez X:', apCx.toFixed(2), '| sağ kenar:', ar.right.toFixed(1), '| boy:', ar.width.toFixed(1),
              '\n  MERKEZ FARKI:', diff.toFixed(2) + 'px', Math.abs(diff) < 0.6 ? '✓ tam hizalı' : '(NUDGE_LEFT ile düzelt)',
              '\n  sağ-kenar farkı:', (ar.right - mr.right).toFixed(1) + 'px', '(⋯ daha büyük olduğundan kenarlar normalde uyuşmaz)');
          } catch (_) {}
        });
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
      `<button class="tk-ca-btn tk-ca-play" type="button" aria-label="Hemen oyna">${PLAY_SVG}</button>` +
      `<button class="tk-ca-btn tk-ca-ap" type="button" aria-label="Oto-Pilot">${AP_SVG}</button>`;
    thumb.appendChild(ov);

    // ⋯ konumunu bir kez ölç (global inset). ⋯ çoğunlukla hover'da gelir → enhance'te + ilk hover'da dene.
    const scope = link.parentElement || link;
    measureInset(scope, thumb);
    if (!_insetSet) link.addEventListener('mouseenter', function once() { measureInset(scope, thumb); if (_insetSet) link.removeEventListener('mouseenter', once); });

    const playBtn = ov.querySelector('.tk-ca-play');
    const apBtn = ov.querySelector('.tk-ca-ap');
    playBtn.addEventListener('mouseenter', () => showTip(playBtn, 'Hemen oyna (rastgele sunucu)', 'left'));   // sola uzar
    apBtn.addEventListener('mouseenter', () => showTip(apBtn, 'Oto-Pilot — en yakın sunucuya bağlan', 'right')); // sağa uzar
    playBtn.addEventListener('mouseleave', hideTip);
    apBtn.addEventListener('mouseleave', hideTip);

    const stop = (e) => { e.preventDefault(); e.stopPropagation(); hideTip(); };
    playBtn.addEventListener('click', (e) => {
      stop(e);
      // Normal giriş: rastgele sunucu (Roblox "Play" gibi)
      try { window.location.href = 'roblox://experiences/start?placeId=' + encodeURIComponent(placeId); } catch (_) {}
    });
    apBtn.addEventListener('click', (e) => {
      stop(e);
      // Oto-Pilot: oyun sayfasına git, orada otomatik tetiklensin (tüm akış + Pro-gate hazır)
      window.location.href = '/games/' + placeId + '?tracked_ap=1';
    });
    ov.addEventListener('click', (e) => e.stopPropagation());
  }

  function scan() {
    try {
      document.querySelectorAll('a[href*="/games/"]:not([' + HOST_ATTR + '])').forEach(enhance);
    } catch (_) {}
  }

  let _t = 0;
  function scheduleScan() { clearTimeout(_t); _t = setTimeout(scan, 220); }

  function start() {
    injectStyles();
    scan();
    try {
      const mo = new MutationObserver(scheduleScan);
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
    // SPA gezinmesinde de tara
    window.addEventListener('popstate', scheduleScan);
    setInterval(scan, 2500);   // güvenlik ağı (React kartları geç gelebilir / overlay'i silebilir)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
