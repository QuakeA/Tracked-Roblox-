// license_client.js — içerik scriptleri için Tracked Plus kontrolü.
// window.TrackedLicense.isPlus() → Promise<bool>; gate(), kilit kartı, Plus ekranı.
(function () {
  if (window.TrackedLicense) return;

  // TODO: Lemon Squeezy ürünü açılınca GERÇEK checkout URL'i buraya (tek yer):
  const CHECKOUT_URL = 'https://tracked.lemonsqueezy.com/buy/REPLACE-ME';

  let _plus = null;
  async function fetchPlus() {
    try {
      const r = await new Promise(res => { try { chrome.runtime.sendMessage({ action: 'licenseGet' }, x => res(chrome.runtime.lastError ? null : x)); } catch (_) { res(null); } });
      return !!(r && r.isPlus);
    } catch (_) { return false; }
  }

  // Kilit ikonu (inline SVG — emoji YOK)
  function lockSvg(size) {
    const s = size || 36;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none"/></svg>`;
  }

  function injectStyles() {
    if (document.getElementById('tkplus-style')) return;
    const s = document.createElement('style'); s.id = 'tkplus-style';
    s.textContent = `
      .tkplus-card{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        background:linear-gradient(150deg,rgba(123,76,255,.16),rgba(76,139,245,.14));border:1px solid rgba(140,120,255,.35);
        border-radius:14px;padding:14px 15px;color:#fff;max-width:320px;}
      .tkplus-card .h{display:flex;align-items:center;gap:8px;font-weight:800;font-size:13px;}
      .tkplus-card .h .lk{display:inline-flex;color:#b9a5ff;}
      .tkplus-card .d{font-size:11.5px;color:rgba(255,255,255,.7);margin:6px 0 11px;line-height:1.5;}
      .tkplus-card .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:none;border-radius:10px;cursor:pointer;
        background:linear-gradient(150deg,#7b4cff,#4c8bf5);color:#fff;font:700 12px/1 inherit;transition:transform .12s,box-shadow .2s;}
      .tkplus-card .btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(100,80,220,.5);}
      .tkplus-card .free{font-size:10px;color:rgba(255,255,255,.5);margin-top:7px;}
      /* Ortak kilit kartı (panel gövdesine gömülür — Trade/Envanter/Müzik) */
      .tkplus-lock{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:20px 16px 16px;color:#fff;}
      .tkplus-lock-ic{width:68px;height:68px;border-radius:50%;display:flex;align-items:center;justify-content:center;
        background:linear-gradient(150deg,rgba(123,76,255,.26),rgba(76,139,245,.12));color:#b9a5ff;box-shadow:inset 0 0 0 1px rgba(140,120,255,.3);}
      .tkplus-lock-ic svg{width:36px;height:36px;}
      .tkplus-lock-h{font-size:14.5px;font-weight:800;}
      .tkplus-lock-d{font-size:11.5px;line-height:1.55;color:rgba(255,255,255,.62);max-width:248px;}
      .tkplus-lock-btn{margin-top:4px;padding:9px 22px;border:none;border-radius:11px;cursor:pointer;font:800 12.5px/1 inherit;color:#fff;
        background:linear-gradient(135deg,#7b4cff,#4c8bf5);box-shadow:0 8px 22px rgba(80,60,200,.45);transition:transform .12s,box-shadow .2s;}
      .tkplus-lock-btn:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(80,60,200,.6);}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  const TL = {
    async isPlus() { if (_plus === null) _plus = await fetchPlus(); return _plus; },
    refresh() { _plus = null; return this.isPlus(); },
    onChange(cb) { try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.tracked_license) { _plus = null; this.isPlus().then(cb); } }); } catch (_) {} },
    checkoutUrl: CHECKOUT_URL,
    openCheckout() { try { window.open(CHECKOUT_URL, '_blank', 'noopener'); } catch (_) {} },
    // Plus ekranı = eklenti Ayarları'ndaki Tracked Plus bölümü (lisans gir / yükselt). Kilitler buraya yönlendirir.
    openPlusPage() { try { chrome.runtime.sendMessage({ action: 'openPlusPage' }); } catch (_) {} },
    lockSvg,
    // Plus değilse onAllowed çalışmaz; isteğe bağlı onBlocked(çağrılır)
    async gate(onAllowed, onBlocked) {
      if (await this.isPlus()) { onAllowed && onAllowed(); return true; }
      onBlocked && onBlocked(); return false;
    },
    // Ortak kilit kartı HTML'i (panel gövdesine string olarak gömülür). Buton .tkplus-lock-btn
    // global delege dinleyici ile Plus ekranını açar → ayrıca wiring gerekmez.
    lockCardHtml(title, sub) {
      injectStyles();
      return `<div class="tkplus-lock">` +
        `<div class="tkplus-lock-ic">${lockSvg(36)}</div>` +
        `<div class="tkplus-lock-h">${title} · Tracked Plus</div>` +
        `<div class="tkplus-lock-d">${sub || 'Bu özellik Tracked Plus aboneliğinde.'}</div>` +
        `<button class="tkplus-lock-btn" type="button">Plus'a Yükselt</button>` +
        `</div>`;
    },
    // Yükseltme kartı elementi (özellik adı + 7 gün ücretsiz dene). İçeriğe gömülür.
    paywallCard(feature) {
      injectStyles();
      const el = document.createElement('div'); el.className = 'tkplus-card';
      el.innerHTML = `<div class="h"><span class="lk">${lockSvg(15)}</span>${feature} · Tracked Plus</div>
        <div class="d">Bu özellik Tracked Plus aboneliğinde. <b>7 gün ücretsiz</b> dene.</div>
        <button class="btn tkplus-lock-btn" type="button">Plus'a Yükselt</button>
        <div class="free">Diğer özellikler ücretsiz kullanılabilir.</div>`;
      return el;
    }
  };

  // Global delege: herhangi bir .tkplus-lock-btn (ya da [data-tkplus-upgrade]) tıklaması → Plus ekranı.
  // Böylece kilit kartını string olarak gömen yerler ayrıca event bağlamak zorunda kalmaz.
  try {
    document.addEventListener('click', (e) => {
      const t = e.target;
      const b = t && t.closest && t.closest('.tkplus-lock-btn,[data-tkplus-upgrade]');
      if (b) { e.preventDefault(); e.stopPropagation(); TL.openPlusPage(); }
    }, true);
  } catch (_) {}

  window.TrackedLicense = TL;
})();
