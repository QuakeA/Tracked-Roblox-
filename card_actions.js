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
        position: absolute; left: 7px; right: 7px; bottom: 7px; transform: translateY(6px);
        display: flex; justify-content: space-between; z-index: 40; opacity: 0; pointer-events: none;
        transition: opacity .16s ease, transform .18s cubic-bezier(.2,.8,.25,1);
      }
      .tk-ca-card:hover .tk-ca, .tk-ca-thumb:hover .tk-ca {
        opacity: 1; pointer-events: auto; transform: translateY(0);
      }
      .tk-ca-btn {
        width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center;
        cursor: pointer; color: #fff; border: 1px solid rgba(255,255,255,.22); padding: 0;
        background: linear-gradient(160deg, #4d8bf0, #2f6ad6);
        box-shadow: 0 4px 11px rgba(20,50,120,.5), inset 0 1px 0 rgba(255,255,255,.28);
        transition: transform .12s ease, filter .12s ease, box-shadow .12s ease;
        -webkit-backdrop-filter: blur(2px);
      }
      .tk-ca-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
      .tk-ca-btn:active { transform: translateY(0); }
      .tk-ca-btn svg { display: block; pointer-events: none; }
      .tk-ca-btn.tk-ca-ap { background: linear-gradient(160deg, #5b9cff, #3a6fd8); }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // Karttan placeId çıkar (href: /games/<id>/...)
  function placeIdOf(link) {
    const href = link.getAttribute('href') || '';
    const m = href.match(/\/games\/(\d{4,})/);
    return m ? m[1] : null;
  }

  // Roblox kartının üç-nokta (⋯) menü butonunu thumbnail'ın ÜST-SAĞ bölgesinde bul → merkez x
  // (thumb soluna göre, px). Bulamazsa null. Yanlış-pozitifi azaltmak için ihtiyatlı.
  function findMenuX(scope, tr) {
    if (!scope || !tr || !tr.width) return null;
    let bx = null, bs = Infinity;
    let els;
    try { els = scope.querySelectorAll('button, [role="button"], a[aria-haspopup], [class*="menu" i], [class*="context" i], [class*="overflow" i]'); }
    catch (_) { return null; }
    for (const el of els) {
      if (el.closest('.tk-ca')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.width > 50 || r.height < 10 || r.height > 50) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const rx = (cx - tr.left) / tr.width, ry = (cy - tr.top) / tr.height;
      if (rx < 0.62 || rx > 1.08 || ry < -0.08 || ry > 0.48) continue;   // üst-sağ bölge
      const s = ry + (1 - rx);   // en üst-sağ olanı seç
      if (s < bs) { bs = s; bx = cx - tr.left; }
    }
    return bx;
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
      `<button class="tk-ca-btn tk-ca-play" type="button" title="Hemen oyna (rastgele sunucu)">${PLAY_SVG}</button>` +
      `<button class="tk-ca-btn tk-ca-ap" type="button" title="Oto-Pilot — en yakın sunucuya bağlan">${AP_SVG}</button>`;
    thumb.appendChild(ov);

    // Butonları Roblox'un üç-nokta (⋯) menüsüyle hizala: SAĞ buton ⋯'nin altına, SOL buton
    // simetrik karşısına. ⋯ hover'da gelebilir → bulamazsa ilk hover'da tekrar dener.
    const realign = () => {
      try {
        const tr = thumb.getBoundingClientRect();
        const mx = findMenuX(link.parentElement || link, tr);
        if (mx != null && tr.width > 40) {
          const inset = Math.max(4, Math.min(tr.width / 2 - 17, Math.round(tr.width - mx - 15)));
          ov.style.left = inset + 'px'; ov.style.right = inset + 'px';
          return true;
        }
      } catch (_) {}
      return false;
    };
    if (!realign()) link.addEventListener('mouseenter', function once() { if (realign()) link.removeEventListener('mouseenter', once); });

    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ov.querySelector('.tk-ca-play').addEventListener('click', (e) => {
      stop(e);
      // Normal giriş: rastgele sunucu (Roblox "Play" gibi)
      try { window.location.href = 'roblox://experiences/start?placeId=' + encodeURIComponent(placeId); } catch (_) {}
    });
    ov.querySelector('.tk-ca-ap').addEventListener('click', (e) => {
      stop(e);
      // Oto-Pilot: oyun sayfasına git, orada otomatik tetiklensin (tüm akış + Pro-gate hazır)
      window.location.href = '/games/' + placeId + '?tracked_ap=1';
    });
    // Kartın kendi tıklamasını overlay alanında engelle (yanlışlıkla oyun sayfası açılmasın)
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
