// datacenters.js — Roblox datacenter CIDR → şehir + koordinat veritabanı
// Tüm Roblox DC'leri 128.116.X.0/24 bloğunda. Prefix (128.116.X) → { city, lat, lon }.
// service_worker.js bunu importScripts('datacenters.js') ile yükler → globalThis.ipToRegion.
//
// KAYNAK (DÜRÜST/DOĞRULANMIŞ): BTRoblox'un topluluk-doğrulanmış serverRegionsByIp haritası
// (github.com/AntiBoomz/BTRoblox — js/feat/serverdetails.js). Yaygın kullanılan, bakımlı bir
// eklenti. Bilinmeyen prefix uydurulmaz → ipToRegion "Bilinmeyen DC (x.x.x)" döner.

(function () {
  'use strict';

  // Şehir koordinatları (lat, lon) — coğrafi bilinen değerler.
  const CITY = {
    "Los Angeles, US": [34.0522, -118.2437],
    "Frankfurt, DE":   [50.1109,    8.6821],
    "Ashburn, US":     [39.0438,  -77.4874],
    "Paris, FR":       [48.8566,    2.3522],
    "Amsterdam, NL":   [52.3676,    4.9041],
    "Atlanta, US":     [33.7490,  -84.3880],
    "London, GB":      [51.5074,   -0.1278],
    "New York, US":    [40.7128,  -74.0060],
    "Miami, US":       [25.7617,  -80.1918],
    "Singapore":       [ 1.3521,  103.8198],
    "San Jose, US":    [37.3382, -121.8863],
    "Chicago, US":     [41.8781,  -87.6298],
    "Sydney, AU":     [-33.8688,  151.2093],
    "Tokyo, JP":       [35.6762,  139.6503],
    "Dallas, US":      [32.7767,  -96.7970],
    "Mumbai, IN":      [19.0760,   72.8777],
    "Seattle, US":     [47.6062, -122.3321],
    "São Paulo, BR":  [-23.5505,  -46.6333],
  };

  // 128.116.X prefix → şehir (BTRoblox doğrulanmış haritası).
  const PREFIX_CITY = {
    "128.116.1":   "Los Angeles, US",
    "128.116.5":   "Frankfurt, DE",
    "128.116.11":  "Ashburn, US",
    "128.116.13":  "Paris, FR",
    "128.116.21":  "Amsterdam, NL",
    "128.116.22":  "Atlanta, US",
    "128.116.31":  "London, GB",
    "128.116.32":  "New York, US",
    "128.116.33":  "London, GB",
    "128.116.44":  "Frankfurt, DE",
    "128.116.45":  "Miami, US",
    "128.116.46":  "Singapore",
    "128.116.47":  "San Jose, US",
    "128.116.48":  "Chicago, US",
    "128.116.50":  "Singapore",
    "128.116.51":  "Sydney, AU",
    "128.116.53":  "Ashburn, US",
    "128.116.54":  "Singapore",
    "128.116.55":  "Tokyo, JP",
    "128.116.56":  "Ashburn, US",
    "128.116.57":  "San Jose, US",
    "128.116.63":  "Los Angeles, US",
    "128.116.64":  "San Jose, US",
    "128.116.67":  "San Jose, US",
    "128.116.74":  "Ashburn, US",
    "128.116.80":  "Ashburn, US",
    "128.116.81":  "San Jose, US",
    "128.116.84":  "Chicago, US",
    "128.116.86":  "São Paulo, BR",
    "128.116.87":  "Ashburn, US",
    "128.116.88":  "Chicago, US",
    "128.116.95":  "Dallas, US",
    "128.116.97":  "Singapore",
    "128.116.99":  "Atlanta, US",
    "128.116.102": "Ashburn, US",
    "128.116.104": "Mumbai, IN",
    "128.116.105": "San Jose, US",
    "128.116.115": "Seattle, US",
    "128.116.116": "Los Angeles, US",
    "128.116.117": "San Jose, US",
    "128.116.119": "London, GB",
    "128.116.120": "Tokyo, JP",
    "128.116.123": "Frankfurt, DE",
    "128.116.127": "Miami, US",
  };

  // prefix → { city, lat, lon } olarak birleştir.
  const TRACKED_DC = {};
  for (const prefix in PREFIX_CITY) {
    const city = PREFIX_CITY[prefix];
    const c = CITY[city];
    TRACKED_DC[prefix] = c ? { city, lat: c[0], lon: c[1] } : { city, lat: null, lon: null };
  }

  // IP → bölge. Bilinen prefix → { city, lat, lon }; bilinmeyen → açıklayıcı string.
  function ipToRegion(ip) {
    if (!ip || typeof ip !== 'string') return null;
    const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\./);
    if (!m) return null;
    const prefix = `${m[1]}.${m[2]}.${m[3]}`;
    return TRACKED_DC[prefix] || ('Bilinmeyen DC (' + prefix + '.x)');
  }

  // Ülke (ISO-2) → yaklaşık merkez koordinatı (centroid). Cloudflare trace `loc=XX` fallback'i için:
  // IP-geo servisleri başarısız olursa ülke-seviyesinde konumla mesafe sıralaması yine yapılır.
  const COUNTRY_CENTROID = {
    TR: [39.0, 35.0],   US: [39.8, -98.6], GB: [54.0, -2.0],  DE: [51.2, 10.4], FR: [46.6, 2.2],
    NL: [52.1, 5.3],    PL: [52.0, 19.1],  RU: [61.5, 105.3], BR: [-14.2, -51.9], AR: [-38.4, -63.6],
    MX: [23.6, -102.5], CA: [56.1, -106.3],AU: [-25.3, 133.8],JP: [36.2, 138.3], KR: [35.9, 127.8],
    CN: [35.9, 104.2],  IN: [20.6, 78.9],  ID: [-0.8, 113.9], PH: [12.9, 121.8], TH: [15.9, 100.9],
    VN: [14.1, 108.3],  SG: [1.35, 103.8], MY: [4.2, 101.9],  SA: [23.9, 45.1],  AE: [23.4, 53.8],
    EG: [26.8, 30.8],   ZA: [-30.6, 22.9], NG: [9.1, 8.7],    ES: [40.5, -3.7],  IT: [41.9, 12.6],
    PT: [39.4, -8.2],   SE: [60.1, 18.6],  NO: [60.5, 8.5],   FI: [61.9, 25.7],  DK: [56.3, 9.5],
    BE: [50.5, 4.5],    CH: [46.8, 8.2],   AT: [47.5, 14.6],  CZ: [49.8, 15.5],  RO: [45.9, 24.97],
    GR: [39.07, 21.8],  UA: [48.4, 31.2],  IE: [53.4, -8.2],  NZ: [-40.9, 174.9],CL: [-35.7, -71.5],
    CO: [4.6, -74.3],   PE: [-9.2, -75.0], IL: [31.0, 34.8],  PK: [30.4, 69.3],  BD: [23.7, 90.4],
    HU: [47.2, 19.5],   BG: [42.7, 25.5],  RS: [44.0, 21.0],  HR: [45.1, 15.2],  SK: [48.7, 19.7],
  };

  // Haversine — iki koordinat arası km (tam sayı).
  function haversineKm(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some(v => typeof v !== 'number')) return null;
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  // Kullanıcı konumuna EN YAKIN bilinen datacenter → { city, km }.
  // (Türkiye gibi DC olmayan ülkelerde bile "ulaşılabilir en yakın bölge"yi verir.)
  function nearestDc(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    let best = null;
    const seen = new Set();
    for (const prefix in TRACKED_DC) {
      const dc = TRACKED_DC[prefix];
      if (!dc || typeof dc.lat !== 'number' || seen.has(dc.city)) continue;
      seen.add(dc.city);
      const km = haversineKm(lat, lon, dc.lat, dc.lon);
      if (km != null && (!best || km < best.km)) best = { city: dc.city, km };
    }
    return best;
  }

  // ── Bölgesel ping probe'ları (KÜRESEL, koordinatlı) — service_worker.js arka planda ölçer.
  // Her sunucunun datacenter'ı (lat/lon) EN YAKIN probe'a eşlenir → ülke etiketi tutmasa bile gerçek ms.
  // URL'ler gerçek AWS S3 bölge endpoint'leri (no-cors HEAD ile RTT ölçülebilir). Maksimum kapsam.
  const TK_PING_PROBES = [
    { cc:'US', lat:38.9,  lon:-77.4,  url:'https://s3.us-east-1.amazonaws.com' },      // Virginia (Doğu)
    { cc:'US', lat:40.4,  lon:-82.9,  url:'https://s3.us-east-2.amazonaws.com' },      // Ohio (Merkez)
    { cc:'US', lat:37.8,  lon:-122.4, url:'https://s3.us-west-1.amazonaws.com' },      // N. California (Batı)
    { cc:'US', lat:45.6,  lon:-122.7, url:'https://s3.us-west-2.amazonaws.com' },      // Oregon (Batı)
    { cc:'CA', lat:45.5,  lon:-73.6,  url:'https://s3.ca-central-1.amazonaws.com' },   // Montreal
    { cc:'BR', lat:-23.5, lon:-46.6,  url:'https://s3.sa-east-1.amazonaws.com' },      // São Paulo
    { cc:'GB', lat:51.5,  lon:-0.1,   url:'https://s3.eu-west-2.amazonaws.com' },      // Londra
    { cc:'IE', lat:53.3,  lon:-6.3,   url:'https://s3.eu-west-1.amazonaws.com' },      // İrlanda
    { cc:'DE', lat:50.1,  lon:8.7,    url:'https://s3.eu-central-1.amazonaws.com' },   // Frankfurt
    { cc:'FR', lat:48.9,  lon:2.4,    url:'https://s3.eu-west-3.amazonaws.com' },      // Paris
    { cc:'SE', lat:59.3,  lon:18.1,   url:'https://s3.eu-north-1.amazonaws.com' },     // Stockholm
    { cc:'IT', lat:45.5,  lon:9.2,    url:'https://s3.eu-south-1.amazonaws.com' },     // Milano
    { cc:'BH', lat:26.1,  lon:50.6,   url:'https://s3.me-south-1.amazonaws.com' },     // Bahreyn (Orta Doğu)
    { cc:'ZA', lat:-33.9, lon:18.4,   url:'https://s3.af-south-1.amazonaws.com' },     // Cape Town
    { cc:'IN', lat:19.1,  lon:72.9,   url:'https://s3.ap-south-1.amazonaws.com' },     // Mumbai
    { cc:'SG', lat:1.3,   lon:103.8,  url:'https://s3.ap-southeast-1.amazonaws.com' }, // Singapur
    { cc:'JP', lat:35.7,  lon:139.7,  url:'https://s3.ap-northeast-1.amazonaws.com' }, // Tokyo
    { cc:'KR', lat:37.6,  lon:127.0,  url:'https://s3.ap-northeast-2.amazonaws.com' }, // Seul
    { cc:'HK', lat:22.3,  lon:114.2,  url:'https://s3.ap-east-1.amazonaws.com' },      // Hong Kong
    { cc:'AU', lat:-33.9, lon:151.2,  url:'https://s3.ap-southeast-2.amazonaws.com' }  // Sydney
  ];

  globalThis.TK_PING_PROBES = TK_PING_PROBES;
  globalThis.TRACKED_DC = TRACKED_DC;
  globalThis.ipToRegion = ipToRegion;
  globalThis.COUNTRY_CENTROID = COUNTRY_CENTROID;
  globalThis.haversineKm = haversineKm;
  globalThis.nearestDc = nearestDc;
})();
