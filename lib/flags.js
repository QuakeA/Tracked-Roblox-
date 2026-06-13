// Tracked — gerçek bayrak ikonları (flag-icons 4x3 SVG, lib/flags/*.svg).
// chrome.runtime.getURL ile HEM content script HEM extension sayfalarında (popup/options/sidepanel) çalışır.
// Bayraklar <img> olarak lazy-load edilir → her sayfada ağır CSS parse yok; sadece gösterilen bayrak yüklenir.
(function () {
  // Elimizde SVG'si olan ülke kodları (lib/flags/ ile senkron tutulmalı).
  const SET = new Set(['au','bh','br','ca','de','fr','gb','hk','ie','in','it','jp','kr','nl','nz','pl','ro','se','sg','tr','us','za']);

  // Kod içermeyen etiketler / ülke adları → ISO kodu (akıllı eşleme).
  const ALIAS = {
    singapore: 'sg', 'hong kong': 'hk', uk: 'gb', en: 'gb', england: 'gb',
    almanya: 'de', germany: 'de', fransa: 'fr', france: 'fr', hollanda: 'nl', netherlands: 'nl',
    ingiltere: 'gb', 'birleşik krallık': 'gb', irlanda: 'ie', ireland: 'ie',
    isveç: 'se', sweden: 'se', italya: 'it', italy: 'it', polonya: 'pl', poland: 'pl',
    romanya: 'ro', romania: 'ro', türkiye: 'tr', turkey: 'tr', turkiye: 'tr',
    japonya: 'jp', japan: 'jp', singapur: 'sg', avustralya: 'au', australia: 'au',
    'kuzey amerika': null, 'güney amerika': null, asya: null, avrupa: null, okyanusya: null
  };

  // Herhangi bir etiketten ("DE", "Frankfurt, DE", "Virginia (US-E)", "Singapore") ISO kodunu çıkar.
  function norm(code) {
    if (!code) return '';
    let c = String(code).trim().toLowerCase();
    if (c in ALIAS) return ALIAS[c] || '';
    // Sondaki parantez/virgül kodunu yakala: "..., DE" / "... (US-E)" / "... (BR)"
    const m = c.match(/[,(]\s*([a-z]{2})(?:[-\s][a-z0-9]+)?\s*\)?\s*$/);
    if (m) c = m[1];
    else if (/^[a-z]{2}$/.test(c)) { /* zaten 2 harf */ }
    return c;
  }

  // Bayrak HTML'i döndür (bilinmeyen/eksik kod → boş string; çağıran taraf kod-badge'ini fallback tutar).
  function tkFlag(code, opts) {
    const c = norm(code);
    if (!c || !SET.has(c)) return '';
    let url = '';
    try { url = chrome.runtime.getURL('lib/flags/' + c + '.svg'); } catch (_) { return ''; }
    const cls = (opts && opts.class) ? ' ' + opts.class : '';
    const title = (opts && opts.title) ? ` title="${String(opts.title).replace(/"/g, '&quot;')}"` : '';
    return `<span class="tk-flag${cls}"${title}><img src="${url}" alt="${c.toUpperCase()}" loading="lazy"></span>`;
  }

  globalThis.tkFlag = tkFlag;
  globalThis.tkFlagCode = norm;
  globalThis.TK_FLAG_SET = SET;
})();
