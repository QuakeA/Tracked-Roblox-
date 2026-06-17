// license_client.js — içerik scriptleri için Tracked Plus kontrolü.
// window.TrackedLicense.isPlus() → Promise<bool>; gate(), paywall kartı, checkout.
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

  function injectStyles() {
    if (document.getElementById('tkplus-style')) return;
    const s = document.createElement('style'); s.id = 'tkplus-style';
    s.textContent = `
      .tkplus-card{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        background:linear-gradient(150deg,rgba(123,76,255,.16),rgba(76,139,245,.14));border:1px solid rgba(140,120,255,.35);
        border-radius:14px;padding:14px 15px;color:#fff;max-width:320px;}
      .tkplus-card .h{display:flex;align-items:center;gap:8px;font-weight:800;font-size:13px;}
      .tkplus-card .h .star{color:#ffd166;}
      .tkplus-card .d{font-size:11.5px;color:rgba(255,255,255,.7);margin:6px 0 11px;line-height:1.5;}
      .tkplus-card .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:none;border-radius:10px;cursor:pointer;
        background:linear-gradient(150deg,#7b4cff,#4c8bf5);color:#fff;font:700 12px/1 inherit;transition:transform .12s,box-shadow .2s;}
      .tkplus-card .btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(100,80,220,.5);}
      .tkplus-card .free{font-size:10px;color:rgba(255,255,255,.5);margin-top:7px;}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  const TL = {
    async isPlus() { if (_plus === null) _plus = await fetchPlus(); return _plus; },
    refresh() { _plus = null; return this.isPlus(); },
    onChange(cb) { try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.tracked_license) { _plus = null; this.isPlus().then(cb); } }); } catch (_) {} },
    checkoutUrl: CHECKOUT_URL,
    openCheckout() { try { window.open(CHECKOUT_URL, '_blank', 'noopener'); } catch (_) {} },
    // Plus değilse onAllowed çalışmaz; isteğe bağlı onBlocked(çağrılır)
    async gate(onAllowed, onBlocked) {
      if (await this.isPlus()) { onAllowed && onAllowed(); return true; }
      onBlocked && onBlocked(); return false;
    },
    // Yükseltme kartı elementi (özellik adı + 7 gün ücretsiz dene). İçeriğe gömülür.
    paywallCard(feature) {
      injectStyles();
      const el = document.createElement('div'); el.className = 'tkplus-card';
      el.innerHTML = `<div class="h"><span class="star">★</span>${feature} · Tracked Plus</div>
        <div class="d">Bu özellik Tracked Plus aboneliğinde. <b>7 gün ücretsiz</b> dene.</div>
        <button class="btn" type="button">Plus'a Yükselt</button>
        <div class="free">Diğer özellikler ücretsiz kullanılabilir.</div>`;
      el.querySelector('.btn').addEventListener('click', () => this.openCheckout());
      return el;
    }
  };
  window.TrackedLicense = TL;
})();
