
// service_worker.js - Tracked v1.9.4 - Hybrid Event Detector

// ==================== INITIALIZATION ====================
chrome.runtime.onInstalled.addListener((details) => {
  // Always ensure popup (not side panel) opens on action click
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }

  // Güncelleme kurulunca changelog badge'i sıfırla (options sayfası açılınca gösterilecek)
  if (details.reason === 'update') {
    const manifest = chrome.runtime.getManifest();
    chrome.storage.local.remove('rota_changelog_seen');
    console.log('[SW] Extension updated to', manifest.version, '— changelog badge reset');
  }

  if (details.reason === 'install') {
    chrome.storage.local.get('rota_settings', (data) => {
      if (!data.rota_settings) {
        const defaults = {
          timeoutMs: 3000,
          cacheMinutes: 10,
          animationsEnabled: true,
          silentMode: false,
          eventDetection: {
            enabled: true,
            notifyDefiniteOnly: true,
            playerSpikeThreshold: 1.5,  // %50 artış
            checkInterval: 10  // dakika
          },
          probes: {
             "Almanya (DE)": "https://s3.eu-central-1.amazonaws.com",
             "Hollanda (NL)": "https://s3.eu-west-1.amazonaws.com",
             "Fransa (FR)": "https://s3.eu-west-3.amazonaws.com",
             "Polonya (PL)": "https://s3.eu-north-1.amazonaws.com",
             "Romanya (RO)": "https://s3.eu-south-1.amazonaws.com"
          }
        };
        chrome.storage.local.set({ rota_settings: defaults });
      }
    });
  }

  chrome.alarms.create('trackPlaytime', { periodInMinutes: 1 });
  chrome.alarms.create('trackGameLibrary', { periodInMinutes: 5 });
  chrome.alarms.create('detectLiveEvents', { periodInMinutes: 10 });
  chrome.alarms.create('playerSpikeCheck', { periodInMinutes: 5 });
  // Auto-Reconnect / Crash Recovery — 30sn polling (Chrome alarm minimum 0.5dk)
  chrome.alarms.create('monitorActiveSession', { periodInMinutes: 0.5 });
  chrome.alarms.create('checkSavedServers', { periodInMinutes: 5 });
  // Ücretsiz Item Takipi — her 30 dakikada catalog'da yeni free item ara
  chrome.alarms.create('checkFreeItems', { periodInMinutes: 30 });
});

// Tarayıcı yeniden başlarsa: aktif bir Sunucu Bekçisi varsa alarmını yeniden kur (sağlamlık).
chrome.runtime.onStartup.addListener(async () => {
  try {
    const { tracked_server_watch: w } = await chrome.storage.local.get('tracked_server_watch');
    if (w && w.placeId) chrome.alarms.create('serverWatch', { periodInMinutes: 1 });
  } catch (_) {}
});

// ============================================================
// SIDE PANEL STATE TRACKING (Port-based — REAL-TIME, no async lag)
// ============================================================
// Side panel mount'unda port açar, kapanınca disconnect tetiklenir → in-memory state
const _sidePanelState = { isOpen: false, port: null };

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'tracked-sidepanel') {
    _sidePanelState.isOpen = true;
    _sidePanelState.port = port;
    port.onDisconnect.addListener(() => {
      _sidePanelState.isOpen = false;
      _sidePanelState.port = null;
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'trackPlaytime') checkPresenceAndTrack();
  if (alarm.name === 'trackGameLibrary') trackGameLibraryActivity();
  if (alarm.name === 'detectLiveEvents') detectLiveEvents();
  if (alarm.name === 'playerSpikeCheck') detectPlayerSpikes();
  if (alarm.name === 'monitorActiveSession') monitorActiveSession();
  if (alarm.name === 'checkSavedServers') checkSavedServers();
  if (alarm.name === 'checkFreeItems') checkForNewFreeItems().catch(e => console.warn('[FreeItems]', e?.message));
  if (alarm.name === 'serverWatch') runServerWatchCheck().catch(e => console.warn('[ServerWatch]', e?.message));
  // Free Item notification auto-clear (30sn sonra çalışır) — hem item hem summary
  if (alarm.name.startsWith('fi_autoclear_')) {
    const suffix = alarm.name.replace('fi_autoclear_', '');
    try {
      if (suffix.startsWith('summary_')) {
        const ts = suffix.replace('summary_', '');
        chrome.notifications.clear(`tracked_free_summary_${ts}`);
      } else {
        chrome.notifications.clear(`tracked_free_item_${suffix}`);
        chrome.storage.local.remove(`tracked_free_meta_${suffix}`);
      }
      chrome.alarms.clear(alarm.name);
    } catch {}
  }
});

// Avatar Sandbox — BrickColor numarası → hex. /v1/users/{id}/avatar bodyColors'ı
// colorId (sayı) verir; render endpoint'i hex ister. 1030=FFCC99 klasik ten rengi.
const TRACKED_BRICK_HEX = {
  1:"F2F3F3",2:"A1A5A2",3:"F9E999",5:"D7C59A",6:"C2DAB8",9:"E8BAC8",11:"80BBDB",12:"CB8442",18:"CC8E69",21:"C4281C",
  22:"C470A0",23:"0D69AC",24:"F5CD30",25:"624732",26:"1B2A35",27:"6D6E6C",28:"287F47",29:"A1C48C",36:"F3CF9B",37:"4B974B",
  38:"A05F35",39:"C1CADE",40:"ECECEC",41:"CD5453",42:"C1DFF0",43:"7BB6E8",44:"F7F18D",45:"B4D2E4",47:"D98570",48:"84B68D",
  49:"F8F184",50:"ECE8DE",100:"EEC4B6",101:"DA867A",102:"6E99CA",103:"C7C1B7",104:"6B327C",105:"E29B40",106:"DA8541",107:"008F9C",
  108:"685C43",110:"435493",111:"BFB7B1",112:"6874AC",113:"E5ADC8",115:"C7D23C",116:"55A5AF",118:"B7D7D5",119:"A4BD47",120:"D9E4A7",
  121:"E7AC58",123:"D36F4C",124:"923978",125:"EAB892",126:"A5A5CB",127:"DCBC81",128:"AE7A59",131:"9CA3A8",133:"D5733D",134:"D8DD56",
  135:"74869D",136:"877C90",137:"E09864",138:"95A773",140:"203A56",141:"27462D",143:"CFE2F7",145:"7988A1",146:"958EA3",147:"938767",
  148:"575857",149:"161D32",150:"ABADAC",151:"789082",153:"957977",154:"7B2E2F",157:"FFF67B",158:"E1A4C2",168:"756D62",176:"976B5B",
  178:"B48455",179:"898788",180:"D7A94B",190:"F9D62E",191:"E8AB2D",192:"694028",193:"CF6024",194:"A3A2A5",195:"4667A4",196:"23478B",
  198:"8E4285",199:"635F62",200:"828A5D",208:"E5E4DF",209:"B08E44",210:"709578",211:"79B5B5",212:"9FC3E9",213:"6C81B7",216:"904C2A",
  217:"7C5C46",218:"967F9F",219:"6B629B",220:"A7A9CE",221:"CD6298",222:"E4ADC8",223:"DC9095",224:"F0D5A0",225:"EBB87F",226:"FDEAA0",
  232:"7DBBDD",268:"342B75",301:"506D54",302:"5B5D69",303:"0010B0",304:"2C651D",305:"527CAE",306:"335882",307:"102ADC",308:"3D1585",
  309:"348E40",310:"5B9A4C",311:"9FA1AC",312:"592259",313:"1F801D",314:"9FADC0",315:"0989CF",316:"7B007B",317:"7C9C6B",318:"8AAB85",
  319:"B9C4B1",320:"CACBD1",321:"A75E9B",322:"7B2F7B",323:"94BE81",324:"A8BD99",325:"DFDFDF",327:"970000",328:"B1E5A6",329:"98C2DB",
  330:"FF98DC",331:"FF5959",332:"750000",333:"EFB838",334:"F8D96D",335:"E7E7EC",336:"C7D4E4",337:"FF9494",338:"BE6862",339:"562424",
  340:"F1E7C7",341:"FEF3BB",342:"E0B2D0",343:"D490BD",344:"965555",345:"8F4C2A",346:"D3BE96",347:"E2DCBC",348:"EDEAEA",349:"E9DADA",
  350:"883E3E",351:"BC9B5D",352:"C7AC78",353:"CABFA3",354:"BBB3B2",355:"6C584B",356:"A0844F",357:"958988",358:"ABA89E",359:"AF9483",
  360:"966766",361:"56423A",362:"7E683F",363:"696659",364:"5A4C42",365:"6A3909",
  1001:"F8F8F8",1002:"CDCDCD",1003:"111111",1004:"FF0000",1005:"FFB000",1006:"B480FF",1007:"A34B4B",1008:"C1BE42",1009:"FFFF00",1010:"0000FF",
  1011:"002060",1012:"2154B9",1013:"04AFEC",1014:"AA5500",1015:"AA00AA",1016:"FF66CC",1017:"FFAF00",1018:"12EED4",1019:"00FFFF",1020:"00FF00",
  1021:"3A7D15",1022:"7F8E64",1023:"8C5B9F",1024:"AFDDFF",1025:"FFC9C9",1026:"B1A7FF",1027:"9FF3E9",1028:"CCFFCC",1029:"FFFFCC",1030:"FFCC99",
  1031:"6225D1",1032:"FF00BF"
};
function trackedBrickToHex(id) { const h = TRACKED_BRICK_HEX[Number(id)]; return "#" + (h || "FFCC99"); }
function trackedBodyColorsToHex(bc) {
  bc = bc || {};
  return {
    headColor: trackedBrickToHex(bc.headColorId),
    torsoColor: trackedBrickToHex(bc.torsoColorId),
    leftArmColor: trackedBrickToHex(bc.leftArmColorId),
    rightArmColor: trackedBrickToHex(bc.rightArmColorId),
    leftLegColor: trackedBrickToHex(bc.leftLegColorId),
    rightLegColor: trackedBrickToHex(bc.rightLegColorId)
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SUNUCU BÖLGE TESPİTİ — Roblox datacenter IP → şehir + koordinat (CIDR /24 prefix)
// Veritabanı + ipToRegion() datacenters.js'te. globalThis.TRACKED_DC / globalThis.ipToRegion
// importScripts ile yüklenir (üst-seviye, senkron — listener'lar tetiklenmeden önce çalışır).
// ═══════════════════════════════════════════════════════════════════════════
try { importScripts('datacenters.js'); } catch (e) { console.warn('[SW] datacenters.js yüklenemedi:', e); }

const TK_REGION_TTL = 6 * 60 * 60 * 1000;   // 6 saat — bölge jobId başına sabit

// IP → şehir + koordinat objesini cevaba uygula (datacenters.js → ipToRegion).
function tkApplyRegion(r) {
  if (!r || !r.ok || !r.ip) return r;
  const reg = ipToRegion(r.ip);
  if (reg && typeof reg === 'object') { r.region = reg.city; r.lat = reg.lat; r.lon = reg.lon; }
  else { r.region = reg; r.lat = null; r.lon = null; }
  return r;
}

// Konum cevabı + kullanıcının EN YAKIN datacenter'ı (erken çıkış hedefi için).
function tkGeoOut(lat, lon, city, cached) {
  const nd = (typeof nearestDc === 'function') ? nearestDc(lat, lon) : null;
  const out = { ok: true, lat, lon, city: city || null, nearestDcKm: nd ? nd.km : null, nearestDcCity: nd ? nd.city : null };
  if (cached) out.cached = true;
  return out;
}

// ── Bölgesel ping ölçümü (ARKA PLAN, OTOMATİK) — TK_PING_PROBES'a no-cors HEAD RTT.
// Sonuç: tracked_region_pings = { ts, probes:[{cc,lat,lon,ms}] }. 30 dk cache. Manuel test gerektirmez.
const TK_RPING_TTL = 30 * 60 * 1000;
async function tkPingOnce(url, timeout) {
  const u = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now() + Math.random().toString(36).slice(2, 8);
  const ctrl = new AbortController();
  const tmr = setTimeout(() => ctrl.abort(), timeout);
  const s = performance.now();
  try { await fetch(u, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal }); clearTimeout(tmr); return performance.now() - s; }
  catch (_) { clearTimeout(tmr); return -1; }
}
async function tkPingMedian(url, timeout, samples) {
  await tkPingOnce(url, Math.min(timeout, 2500)).catch(() => {});   // warmup (TCP/TLS)
  const arr = [];
  for (let i = 0; i < samples; i++) { const v = await tkPingOnce(url, timeout); if (v > 0 && v < timeout) arr.push(v); }
  if (!arr.length) return -1;
  arr.sort((a, b) => a - b);
  return Math.round(arr[Math.floor(arr.length / 2)]);
}
async function tkEnsureRegionalPings(force) {
  try {
    const { tracked_region_pings: cur } = await chrome.storage.local.get('tracked_region_pings');
    if (!force && cur && Array.isArray(cur.probes) && cur.probes.length && (Date.now() - (cur.ts || 0)) < TK_RPING_TTL) {
      return { ok: true, cached: true, count: cur.probes.length };
    }
    const probes = globalThis.TK_PING_PROBES || [];
    if (!probes.length) return { ok: false, error: 'no_probes' };
    const out = (await Promise.all(probes.map(async p => {
      const ms = await tkPingMedian(p.url, 3000, 3);
      return ms > 0 ? { cc: p.cc, lat: p.lat, lon: p.lon, ms } : null;
    }))).filter(Boolean);
    if (!out.length) return { ok: false, error: 'all_failed' };
    await chrome.storage.local.set({ tracked_region_pings: { ts: Date.now(), probes: out } });
    return { ok: true, cached: false, count: out.length };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

// Popup'ta ölçülen gerçek bölgesel ping'ler → ülke koduna göre harita (Bekçi yakınlık filtresi için).
// rota_ping_cache.results = [{region:"Almanya (DE)", ms:45}, ...] → { DE:45, NL:52, ... }
async function tkPingMap() {
  try {
    const st = await chrome.storage.local.get(['rota_ping_cache', 'rota_ping_results']);
    let results = st?.rota_ping_cache?.results;
    if (!Array.isArray(results) || !results.length) results = st?.rota_ping_results;
    const map = {};
    if (Array.isArray(results)) {
      for (const r of results) {
        if (!r || typeof r.ms !== 'number' || r.ms <= 0 || r.ms >= 900) continue;
        const m = /\(([A-Z]{2})\)/.exec(r.region || '');
        if (m) { const cc = m[1]; if (!(cc in map) || r.ms < map[cc]) map[cc] = Math.round(r.ms); }
      }
    }
    return map;
  } catch (_) { return {}; }
}
// Sunucunun bölgesi ("Frankfurt, DE") için kullanıcının ölçülen ping'i → ms | null
function tkMeasuredPing(region, pingMap) {
  if (!region || typeof region !== 'string' || !pingMap) return null;
  const m = /,\s*([A-Z]{2})\s*$/.exec(region);
  return m ? (pingMap[m[1]] ?? null) : null;
}

// Kullanıcı konumunu ÇÖZ (cache → geojs → ipwho → ipapi → Cloudflare ülke). Sonucu 7 gün cache'ler.
// tkGeoOut formatı: { ok, lat, lon, city, nearestDcKm, nearestDcCity } | null.
// Bekçi bunu çağırıp konumu GARANTİLER (önceden cache'lenmiş olmasına bağlı kalmaz).
async function tkResolveUserGeo() {
  const GEO_TTL = 7 * 24 * 60 * 60 * 1000;
  try {
    const { tracked_user_geo: geo } = await chrome.storage.local.get('tracked_user_geo');
    if (geo && typeof geo.lat === 'number' && (Date.now() - (geo.at || 0)) < GEO_TTL) {
      return tkGeoOut(geo.lat, geo.lon, geo.city, true);
    }
  } catch (_) {}
  const tryFetch = async (u, pick, asText) => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(u, { headers: { Accept: asText ? 'text/plain' : 'application/json' }, signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      const d = asText ? await r.text() : await r.json();
      const out = pick(d);
      return (out && typeof out.lat === 'number' && typeof out.lon === 'number' && !isNaN(out.lat) && !isNaN(out.lon)) ? out : null;
    } catch (_) { return null; }
  };
  let loc = await tryFetch('https://get.geojs.io/v1/ip/geo.json', d => ({ lat: +d.latitude, lon: +d.longitude, city: [d.city, d.country].filter(Boolean).join(', ') }));
  if (!loc) loc = await tryFetch('https://ipwho.is/', d => (d && d.success !== false) ? { lat: d.latitude, lon: d.longitude, city: [d.city, d.country].filter(Boolean).join(', ') } : null);
  if (!loc) loc = await tryFetch('https://ipapi.co/json/', d => (d && !d.error) ? { lat: d.latitude, lon: d.longitude, city: [d.city, d.country_name].filter(Boolean).join(', ') } : null);
  if (!loc) loc = await tryFetch('https://www.cloudflare.com/cdn-cgi/trace', txt => {
    const m = /(?:^|\n)loc=([A-Z]{2})/.exec(txt);
    const cen = (m && globalThis.COUNTRY_CENTROID) ? globalThis.COUNTRY_CENTROID[m[1]] : null;
    return cen ? { lat: cen[0], lon: cen[1], city: m[1] } : null;
  }, true);
  if (!loc) return null;
  try { await chrome.storage.local.set({ tracked_user_geo: { ...loc, at: Date.now() } }); } catch (_) {}
  return tkGeoOut(loc.lat, loc.lon, loc.city);
}

// ── BTRoblox yöntemi: gamejoin'i Roblox İSTEMCİ User-Agent'ı ile çağır → joinScript (IP) açılır.
// Tarayıcı UA'sıyla status 12 alınır; BAT/CSRF gerekmez. UA, fetch'ten değiştirilemediği için
// declarativeNetRequest SESSION kuralıyla değiştirilir; initiatorDomains=[extension id] ile
// SADECE uzantının kendi isteği etkilenir (normal Roblox trafiği değil). İstek SW'den atılır
// (tab/MAIN world gerekmez → Bekçi de tabsız çalışır). Ref: github.com/AntiBoomz/BTRoblox
const TK_UA_RULE_ID = 9013;
let tkUaRuleTimer = null;

async function tkEnableClientUA() {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [TK_UA_RULE_ID],
      addRules: [{
        id: TK_UA_RULE_ID,
        action: { type: 'modifyHeaders', requestHeaders: [{ header: 'User-Agent', operation: 'set', value: 'Roblox/WinInet' }] },
        condition: {
          requestMethods: ['post'],
          urlFilter: 'https://gamejoin.roblox.com/v1/join-game-instance',
          initiatorDomains: [chrome.runtime.id]
        }
      }]
    });
  } catch (e) { console.warn('[Region] UA kuralı eklenemedi:', e?.message); return false; }
  // Kuralı kalıcı bırakma — kısa süre sonra kaldır (yalnızca kendi isteğimizi etkilesin).
  if (tkUaRuleTimer) clearTimeout(tkUaRuleTimer);
  tkUaRuleTimer = setTimeout(() => {
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [TK_UA_RULE_ID] }).catch(() => {});
    tkUaRuleTimer = null;
  }, 6000);
  return true;
}

// SW'den BAT'sız gamejoin POST (istemci UA'sı DNR ile ayarlı) → joinScript IP/sürüm.
async function tkFetchRegion(placeId, jobId) {
  const uaOk = await tkEnableClientUA();
  const url = 'https://gamejoin.roblox.com/v1/join-game-instance';
  // jobId yoksa gameId göndermeyiz → Roblox matchmaker SENİN bölgendeki sunucuyu seçer (kendi bölgen).
  // Matchmaker isteğine gerçek istemcinin alanlarını ekle (status 12 reddini azaltır).
  const reqBody = jobId
    ? JSON.stringify({ placeId: parseInt(placeId, 10), gameId: jobId })
    : JSON.stringify({ placeId: parseInt(placeId, 10), isTeleport: false, gameJoinAttemptId: (crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`) });
  const doPost = () => fetch(url, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: reqBody
  });
  let res;
  try {
    res = await doPost();
    if (res.status === 429) { await new Promise(r => setTimeout(r, 1000)); res = await doPost(); }
  } catch (e) { return { ok: false, error: String(e && e.message || e), uaOk }; }
  if (!res.ok) return { ok: false, status: res.status, uaOk };
  let data;
  try { data = await res.json(); } catch (_) { return { ok: false, error: 'bad_json', uaOk }; }
  const js = data.joinScript || {};
  // IP: UdmuxEndpoints[].Address → MachineAddress → ServerConnections[].Address (büyük/küçük harf toleranslı)
  let ip = null, src = '';
  const ud = js.UdmuxEndpoints || js.udmuxEndpoints;
  if (Array.isArray(ud) && ud[0]) { ip = ud[0].Address || ud[0].address; src = 'UdmuxEndpoints'; }
  if (!ip && (js.MachineAddress || js.machineAddress)) { ip = js.MachineAddress || js.machineAddress; src = 'MachineAddress'; }
  if (!ip && Array.isArray(js.ServerConnections) && js.ServerConnections[0]) { ip = js.ServerConnections[0].Address || js.ServerConnections[0].address; src = 'ServerConnections'; }
  if (!ip) return { ok: false, status: data.status, message: data.message, uaOk, jsKeys: Object.keys(js) };
  const version = js.PlaceVersion ?? js.placeVersion ?? data.placeVersion ?? null;
  return tkApplyRegion({ ok: true, status: data.status, ip, src, version, uaOk });
}

// Önbellek-farkında bölge çözümü (tab gerekmez). Başarılı çözüm jobId bazlı önbelleğe yazılır.
async function tkResolveServerRegion(placeId, jobId) {
  // 1) Önbellek
  try {
    const { tracked_region_cache: cache = {} } = await chrome.storage.local.get('tracked_region_cache');
    const hit = cache[jobId];
    if (hit && hit.region && (Date.now() - hit.at) < TK_REGION_TTL) {
      return { ok: true, cached: true, status: 2, ip: hit.ip, region: hit.region, lat: hit.lat, lon: hit.lon, version: hit.version };
    }
  } catch (_) {}
  // 2) Çöz
  let r;
  try { r = await tkFetchRegion(placeId, jobId); }
  catch (err) { return { ok: false, error: err.message }; }
  // 3) Önbelleğe yaz
  if (r && r.ok && r.region) {
    try {
      const { tracked_region_cache: cache = {} } = await chrome.storage.local.get('tracked_region_cache');
      cache[jobId] = { ip: r.ip || null, region: r.region, lat: r.lat ?? null, lon: r.lon ?? null, version: r.version ?? null, at: Date.now() };
      await chrome.storage.local.set({ tracked_region_cache: cache });
    } catch (_) {}
  }
  return r;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Avatar editör — giyili item'ların toplam Robux değeri (CORS bypass: SW'den fetch).
  if (request.action === "trackedAvatarCost") {
    (async () => {
      try {
        const uid = request.userId;
        if (!uid) { sendResponse({ ok: false, error: "no_user" }); return; }
        // 1) Giyili asset'ler (public endpoint, doğru: /v1/users/{id}/avatar)
        const av = await fetch(`https://avatar.roblox.com/v1/users/${uid}/avatar`, { credentials: "include" });
        if (!av.ok) { sendResponse({ ok: false, error: "avatar_" + av.status }); return; }
        const avd = await av.json();
        const ids = (avd.assets || []).map(a => a.id).filter(Boolean);
        if (!ids.length) { sendResponse({ ok: true, ids: [], prices: [] }); return; }
        // 2) Fiyatlar — catalog batch (CSRF 403-retry)
        const body = JSON.stringify({ items: ids.map(id => ({ itemType: "Asset", id })) });
        const doPost = (tok) => fetch("https://catalog.roblox.com/v1/catalog/items/details", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": tok || "", "Accept": "application/json" },
          body
        });
        let pr = await doPost("");
        if (pr.status === 403) {
          const t = pr.headers.get("x-csrf-token");
          if (t) pr = await doPost(t);
        }
        let prices = [];
        if (pr.ok) { const pd = await pr.json(); prices = pd.data || []; }
        sendResponse({ ok: true, ids, prices });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true; // async
  }

  // ── Avatar Sandbox ("Avatarımda Dene") — sahip OLMADAN item'ı avatara giydirip render et.
  //    Hibrit 3D: Roblox sunucusu OBJ üretir, içerikteki Three.js viewer döndürülebilir gösterir.
  //    CORS-proof: obj/mtl metni + texture'lar data URL olarak döner (içerik script'i CORS'a takılmaz).
  //    NOT: render endpoint şeması araştırmaya dayanıyor; ilk testte dönen `diag` ile ayarlanacak.
  if (request.action === "trackedSandboxRender") {
    (async () => {
      const diag = { steps: [] };
      const log = (s, extra) => diag.steps.push(Object.assign({ s }, extra || {}));
      // arrayBuffer -> base64 (SW'de FileReader yerine güvenli yol)
      const abToB64 = (buf) => {
        let bin = ""; const bytes = new Uint8Array(buf); const CH = 0x8000;
        for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        return btoa(bin);
      };
      try {
        // Çoklu item desteği: assetIds dizisi (geriye dönük: tek assetId de kabul).
        const assetIds = Array.isArray(request.assetIds)
          ? request.assetIds.map(Number).filter(Boolean)
          : (request.assetId ? [Number(request.assetId)] : []);
        const thumbType = request.thumbnailType === "2d" ? "2d" : "3d";
        // assetIds boş olabilir → sadece giyili avatarı render et (taban önizleme).

        // 0) Kullanıcı ID — verilmemişse authenticated endpoint'ten
        let uid = request.userId;
        if (!uid) {
          try {
            const me = await fetch("https://users.roblox.com/v1/users/authenticated", { credentials: "include" });
            if (me.ok) { const md = await me.json(); uid = md.id; }
          } catch {}
          log("auth_user", { uid });
        }
        if (!uid) { sendResponse({ ok: false, error: "no_user", diag }); return; }

        // 1) Mevcut avatar tanımı (giyili asset'ler + renkler + scale + tip)
        const av = await fetch(`https://avatar.roblox.com/v1/users/${uid}/avatar`, { credentials: "include" });
        log("avatar_fetch", { status: av.status });
        if (!av.ok) { sendResponse({ ok: false, error: "avatar_" + av.status, diag }); return; }
        const avd = await av.json();
        // Kullanıcının SKIN TONE'u (gövde rengi) → texture'sız/sculpted gövdeleri Roblox gibi tene boya.
        const _skin = trackedBodyColorsToHex(avd.bodyColors || {});
        const skinTone = _skin.torsoColor || _skin.headColor || _skin.leftArmColor || "#b8b2ad";

        // 2) Aday item'ların assetType'ları — tek batch catalog details
        const typeOf = {}; // id -> assetTypeId
        if (assetIds.length) {
          try {
            const idBody = JSON.stringify({ items: assetIds.map(id => ({ itemType: "Asset", id })) });
            const dp = (tok) => fetch("https://catalog.roblox.com/v1/catalog/items/details", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": tok || "", "Accept": "application/json" }, body: idBody });
            let dr = await dp(""); if (dr.status === 403) { const t = dr.headers.get("x-csrf-token"); if (t) dr = await dp(t); }
            if (dr.ok) { const dd = await dr.json(); (dd?.data || []).forEach(it => { if (it && it.id != null) typeOf[Number(it.id)] = Number(it.assetType) || 0; }); }
          } catch {}
          log("assettype_lookup", { typeOf });
        }

        // 3) assets: giyili avatar + aday item'lar. Tek-slot tipler (tişört/gömlek/pantolon/
        //    yüz/kafa) aynı tipi DEĞİŞTİRİR; aksesuarlar eklenir (clipping testi için).
        const SINGLE_SLOT = new Set([2, 11, 12, 18, 17]);
        // RENDER EDİLEMEYEN tipler — ANİMASYONLAR (24=Animation, 48-56=Climb/Death/Fall/Idle/Jump/
        // Run/Swim/Walk/Pose, 61=EmoteAnimation). Bunlar avatarda OYNAR, statik render/3D'de
        // GÖSTERİLEMEZ; Roblox render API'si reddedip TÜM render'ı 400 ile bozuyordu. → Sessizce
        // atla (diğer item'lar render olsun), atlananları client'a bildir.
        const NON_RENDERABLE = new Set([24, 48, 49, 50, 51, 52, 53, 54, 55, 56, 61]);
        const baseAssets = (avd.assets || []).map(a => ({ id: Number(a.id), assetType: { id: Number(a.assetType?.id) || 0 } }));
        let assets = baseAssets.slice();
        const skipped = [];
        for (const cid of assetIds) {
          const t = Number(typeOf[cid]) || 0;
          if (NON_RENDERABLE.has(t)) { skipped.push(cid); continue; } // animasyon → render dışı
          if (t && SINGLE_SLOT.has(t)) assets = assets.filter(a => Number(a.assetType?.id) !== t);
          assets = assets.filter(a => Number(a.id) !== cid); // çift eklenmesin
          assets.push({ id: cid, assetType: { id: t } });
        }
        if (skipped.length) diag.skipped = skipped;

        // 4) Render POST. Doğru şema (devforum doğrulaması): thumbnailConfig.thumbnailId,
        //    bodyColors HEX (BrickColor→hex), playerAvatarType OBJE, assets [{id}].
        const patString = (typeof avd.playerAvatarType === "string")
          ? avd.playerAvatarType
          : (avd.playerAvatarType && avd.playerAvatarType.playerAvatarType) || "R15";
        const buildBody = (assetList) => JSON.stringify({
          thumbnailConfig: { thumbnailId: 1, size: "420x420", thumbnailType: thumbType },
          avatarDefinition: {
            scales: avd.scales,
            bodyColors: trackedBodyColorsToHex(avd.bodyColors),
            playerAvatarType: { playerAvatarType: patString },
            assets: (assetList || []).map(a => ({ id: Number(a.id) }))
          }
        });
        const doRender = (bodyStr, tok) => fetch("https://avatar.roblox.com/v1/avatar/render", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": tok || "", "Accept": "application/json" },
          body: bodyStr
        });
        const postCsrf = async (bodyStr) => {
          let r = await doRender(bodyStr, "");
          if (r.status === 403) { const t = r.headers.get("x-csrf-token"); if (t) r = await doRender(bodyStr, t); }
          return r;
        };

        const withItemBody = buildBody(assets);
        let rr = await postCsrf(withItemBody);
        log("render_post", { status: rr.status });

        // 500 izolasyonu: item'sız (mevcut avatar) render edilebiliyor mu? → sebebi daralt.
        if (rr.status === 500) {
          try {
            const rrBase = await postCsrf(buildBody(baseAssets));
            log("render_baseonly", { status: rrBase.status });
            if (rrBase.ok) {
              const bt = await rr.text().catch(() => "");
              sendResponse({ ok: false, error: "render_item_500", note: "base_ok_item_fails", typeOf, body: bt.slice(0, 300), diag });
              return;
            }
          } catch (e) { log("render_baseonly_err", { e: String(e && e.message || e) }); }
        }

        if (!rr.ok) {
          const txt = await rr.text().catch(() => "");
          sendResponse({ ok: false, error: "render_" + rr.status, body: txt.slice(0, 400), diag });
          return;
        }
        let rd = await rr.json();
        let state = rd.state || rd.status;
        let imageUrl = rd.imageUrl || rd.url;
        let tries = 0;
        while ((state === "Pending" || !imageUrl) && tries < 8) {
          await new Promise(r => setTimeout(r, 700));
          let pr = await postCsrf(withItemBody);
          if (pr.ok) { rd = await pr.json(); state = rd.state || rd.status; imageUrl = rd.imageUrl || rd.url; }
          tries++;
        }
        log("render_state", { state, hasUrl: !!imageUrl, tries });
        if (!imageUrl) { sendResponse({ ok: false, error: "no_image", state, raw: JSON.stringify(rd).slice(0, 400), diag }); return; }

        // 5a) 2D → sadece görsel URL
        if (thumbType === "2d") { sendResponse({ ok: true, type: "2d", imageUrl, state, diag }); return; }

        // 5b) 3D → imageUrl bir JSON manifest (obj/mtl/textures hash'leri). HER hash'in CDN
        //     alt-domain'i KENDİ hash'inden hesaplanır (Roblox t0-t7 algoritması) — manifest
        //     host'u değil. CORS-proof: obj/mtl metin, texture'lar data URL döner.
        // rbxcdn public + Access-Control-Allow-Origin:* → credentials:"include" istek bloklanır
        // ("Failed to fetch"). Cookie gerekmez → omit.
        // Manifest fetch'i DAYANIKLI yap: rbxcdn ara sıra "Failed to fetch" (transient ağ/CDN) atıyor,
        // tek deneme yetmiyordu. 3 deneme + backoff, hem omit hem include credentials. URL'i logla.
        // Tek node (ör. t4) ERR_CONNECTION_RESET verebiliyor → AYNI dosyayı tüm t0-t7'den dene.
        log("manifest_try", { url: String(imageUrl).slice(0, 140) });
        const manName = String(imageUrl).split("/").pop().split("?")[0];
        const manUrls = [imageUrl];
        if (/rbxcdn\.com/i.test(imageUrl)) for (let t = 0; t < 8; t++) manUrls.push("https://t" + t + ".rbxcdn.com/" + manName);
        const uniqMan = [...new Set(manUrls)];
        // 403/404 = manifest CDN'e henüz YAYILMADI (render yeni bitti) → bekle ve tekrar dene (propagation).
        let man = null, manErr = "";
        for (let round = 0; round < 4 && !man; round++) {
          if (round) await new Promise(r => setTimeout(r, 800 * round));
          for (const u of uniqMan) {
            for (const cred of ["omit", "include"]) {
              try { const r = await fetch(u, { credentials: cred }); if (r.ok) { man = r; break; } manErr = "http_" + r.status; }
              catch (e) { manErr = String(e && e.message || e); }
            }
            if (man) break;
          }
        }
        log("manifest_fetch", { ok: !!man, err: manErr });
        if (!man) { sendResponse({ ok: false, error: "manifest_fetch_failed", manErr, imageUrl: String(imageUrl).slice(0, 180), skinTone, diag }); return; }
        const manText = await man.text();
        let manifest = null;
        try { manifest = JSON.parse(manText); } catch (_) {}

        // obj/mtl/texture'ı çek. Manifest formatları farklı CDN düzeni kullanabiliyor:
        //  (a) hash'ten hesaplanan t0-t7 alt-domain'i, (b) manifest'le AYNI alt-domain.
        //  İkisini de dene; her fetch try/catch'li (biri "Failed to fetch" atsa render çökmesin).
        const base = imageUrl.slice(0, imageUrl.lastIndexOf("/") + 1);
        const cdnAlgo = (name) => { let i = 31; for (let k = 0; k < name.length; k++) i ^= name.charCodeAt(k); return "https://t" + (i & 7) + ".rbxcdn.com/" + name; };
        const tryFetch = async (u) => {
          for (let a = 0; a < 2; a++) {
            if (a) await new Promise(r => setTimeout(r, 250));
            try { const r = await fetch(u, { credentials: "omit" }); if (r.ok) return r; } catch (_) {}
          }
          return null;
        };
        const urlsFor = (h) => {
          const name = String(h).split("/").pop().split("?")[0];
          const urls = [];
          if (/^https?:/i.test(h)) urls.push(h);
          else urls.push(cdnAlgo(name), base + name);
          // rbxcdn → tüm t0-t7 node'larını dene (tek node reset edebiliyor).
          if (/rbxcdn\.com/i.test(h) || !/^https?:/i.test(h)) for (let t = 0; t < 8; t++) urls.push("https://t" + t + ".rbxcdn.com/" + name);
          return [...new Set(urls)];
        };
        // texture: BOŞ-OLMAYAN gövde bulana kadar TÜM node'ları dene (bazı node 200 ama boş gövde
        // döndürüyor → bozuk/beyaz texture; eski fetchAsset boş cevabı da kabul ediyordu). İlk dolu
        // buffer'ı döndür — fetchAssetText'in (obj/mtl) ikiz mantığı, binary için.
        const fetchAssetBuf = async (h) => {
          if (!h) return null;
          for (const u of urlsFor(h)) {
            const r = await tryFetch(u);
            if (!r) continue;
            const buf = await r.arrayBuffer().catch(() => null);
            if (buf && buf.byteLength > 0) return { buf, type: r.headers.get("content-type") || "image/png" };
          }
          return null;
        };
        // obj/mtl için BOŞ-OLMAYAN metin bulana kadar tüm node'ları dene: bazı node 200 ama BOŞ
        // gövde döndürüyor (mtlLen:0 → materyalsiz/beyaz avatar). İlk dolu metni döndür.
        const fetchAssetText = async (h) => {
          if (!h) return "";
          for (const u of urlsFor(h)) {
            const r = await tryFetch(u);
            if (r) { const t = await r.text().catch(() => ""); if (t && t.trim().length) return t; }
          }
          return "";
        };

        let objText = "", mtlText = "", textures = {};
        if (manifest && (manifest.obj || manifest.mtl)) {
          log("manifest_keys", { keys: Object.keys(manifest), version: manifest.version });
          objText = await fetchAssetText(manifest.obj);
          mtlText = await fetchAssetText(manifest.mtl);
          // TEŞHİS: obj/mtl dolu mu?
          log("obj_mtl", { objLen: objText.length, mtlLen: mtlText.length, objRef: String(manifest.obj ?? '').slice(0, 90), mtlRef: String(manifest.mtl ?? '').slice(0, 90) });
          await Promise.all((manifest.textures || []).map(async (h) => {
            try {
              const got = await fetchAssetBuf(h);
              if (!got) return;
              textures[String(h).split("/").pop()] = `data:${got.type};base64,${abToB64(got.buf)}`;
            } catch {}
          }));
        } else {
          // imageUrl doğrudan OBJ olabilir (manifest JSON değilse)
          log("manifest_not_json", { head: manText.slice(0, 50) });
          if (/^\s*(#|v |o |g |mtllib|usemtl)/.test(manText)) objText = manText;
        }
        log("assets_fetch", { objLen: objText.length, mtlLen: mtlText.length, texCount: Object.keys(textures).length });
        if (!objText) {
          sendResponse({ ok: false, error: "no_obj", imageUrl, manifestKeys: manifest ? Object.keys(manifest) : null, diag });
          return;
        }
        sendResponse({ ok: true, type: "3d", objText, mtlText, textures, manifest, skinTone, diag });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e), diag });
      }
    })();
    return true; // async
  }

  // Three.js + loader'ları içerik script'inin isolated world'üne talep üzerine yükle
  // (her katalog sayfasında 593KB taşımamak için lazy — sadece "Dene"ye basınca).
  if (request.action === "trackedSandboxLoadThree") {
    const tabId = sender?.tab?.id;
    if (!tabId) { sendResponse({ ok: false, error: "no_tab" }); return true; }
    chrome.scripting.executeScript({
      target: { tabId, frameIds: [sender.frameId ?? 0] },
      files: ["lib/three.min.js", "lib/OBJLoader.js", "lib/MTLLoader.js", "lib/OrbitControls.js"]
    }).then(() => sendResponse({ ok: true })).catch(err => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true; // async
  }

  // Avatar Sandbox — kullanıcının envanterindeki GİYİLEBİLİR item'lar (Quick Equip seçici).
  // Çoklu assetType tek çağrıda; thumbnail'lar batch. CORS bypass: SW fetch.
  if (request.action === "trackedSandboxInventory") {
    (async () => {
      try {
        let uid = request.userId;
        if (!uid) {
          try { const me = await fetch("https://users.roblox.com/v1/users/authenticated", { credentials: "include" }); if (me.ok) uid = (await me.json()).id; } catch {}
        }
        if (!uid) { sendResponse({ ok: false, error: "no_user" }); return; }

        const types = request.assetTypes ||
          "Hat,HairAccessory,FaceAccessory,NeckAccessory,ShoulderAccessory,FrontAccessory,BackAccessory,WaistAccessory," +
          "TShirtAccessory,ShirtAccessory,SweaterAccessory,JacketAccessory,PantsAccessory,ShortsAccessory,DressSkirtAccessory,LeftShoeAccessory,RightShoeAccessory," +
          "TShirt,Shirt,Pants,Head,Face,EyebrowAccessory,EyelashAccessory,Gear";
        const items = [];
        let cursor = "", pages = 0;
        do {
          const url = `https://inventory.roblox.com/v2/users/${uid}/inventory?assetTypes=${encodeURIComponent(types)}&limit=100&sortOrder=Desc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
          const r = await fetch(url, { credentials: "include" });
          if (!r.ok) { if (!items.length) { sendResponse({ ok: false, error: "inv_" + r.status }); return; } break; }
          const d = await r.json();
          (d.data || []).forEach(it => {
            const id = it.assetId || it.id;
            if (id) items.push({ id: Number(id), name: it.name || ("Item " + id), assetType: it.assetType || it.type || null });
          });
          cursor = d.nextPageCursor || "";
          pages++;
        } while (cursor && pages < 4); // ilk ~400 item

        // Thumbnail'ler — batch (100'lük)
        const ids = items.map(i => i.id);
        const thumbs = {};
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          try {
            const tr = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(",")}&size=150x150&format=Png&isCircular=false`, { credentials: "include" });
            if (tr.ok) { const td = await tr.json(); (td.data || []).forEach(t => { if (t.targetId && t.imageUrl) thumbs[t.targetId] = t.imageUrl; }); }
          } catch {}
        }
        items.forEach(it => it.thumb = thumbs[it.id] || "");
        sendResponse({ ok: true, items });
      } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    })();
    return true; // async
  }

  // Avatar Sandbox — "Sana Özel" feed: kullanıcının GİYDİĞİ türlere göre, o kategorilerdeki
  // en favori (popüler) item'ları getirir → tarzına göre kişiselleştirilmiş öneri.
  if (request.action === "trackedSandboxRecommended") {
    (async () => {
      try {
        let uid = request.userId;
        if (!uid) { try { const me = await fetch("https://users.roblox.com/v1/users/authenticated", { credentials: "include" }); if (me.ok) uid = (await me.json()).id; } catch {} }
        const MAP = { 8: "Accessories", 41: "Accessories", 42: "Accessories", 43: "Accessories", 44: "Accessories", 45: "Accessories", 46: "Accessories", 47: "Accessories", 11: "Clothing", 2: "Clothing", 12: "Clothing", 64: "Clothing", 65: "Clothing", 66: "Clothing", 67: "Clothing", 68: "Clothing", 69: "Clothing", 72: "Clothing" };
        const cats = []; const seen = new Set();
        if (uid) {
          try {
            const av = await fetch(`https://avatar.roblox.com/v1/users/${uid}/avatar`, { credentials: "include" });
            if (av.ok) { const avd = await av.json(); (avd.assets || []).forEach(a => { const c = MAP[Number(a.assetType && a.assetType.id)]; if (c && !seen.has(c)) { seen.add(c); cats.push(c); } }); }
          } catch {}
        }
        const personalized = cats.length > 0;
        if (!cats.length) cats.push(""); // fallback: genel popüler
        const collected = []; const idset = new Set(); const diag = [];
        // Limit YALNIZCA 10/28/30 kabul ediyor (field 'l'). 3+ kategori → 10 (karışım), aksi → 30.
        const lim = cats.length >= 3 ? 10 : 30;
        const oneSearch = async (category) => {
          // SortType=1 (MostFavorited) + SortAggregation=5 (AllTime) + MinPrice=1 → ücretli popüler.
          let url = `https://catalog.roblox.com/v1/search/items/details?Limit=${lim}&SortType=1&SortAggregation=5&MinPrice=1`;
          if (category) url += `&Category=${encodeURIComponent(category)}`;
          const dg = (tok) => fetch(url, { credentials: "include", headers: tok ? { "X-CSRF-TOKEN": tok } : {} });
          let r = await dg(""); if (r.status === 403) { const t = r.headers.get("x-csrf-token"); if (t) r = await dg(t); }
          if (r.status === 429 || r.status === 503 || r.status === 504) { await new Promise(s => setTimeout(s, 500)); r = await dg(""); }
          if (!r.ok) { const b = await r.text().catch(() => ""); diag.push({ c: category || "all", s: r.status, e: b.slice(0, 70) }); return; }
          const d = await r.json();
          const arr = (d.data || []).filter(it => it.itemType === "Asset");
          arr.forEach(it => { const id = Number(it.id); if (!idset.has(id)) { idset.add(id); collected.push({ id, name: it.name || ("Item " + id), price: (it.price != null ? it.price : (it.lowestPrice != null ? it.lowestPrice : null)) }); } });
          diag.push({ c: category || "all", s: 200, n: arr.length });
        };
        await Promise.all(cats.slice(0, 3).map((c) => oneSearch(c)));
        // Ücretsizleri (lowestPrice=0 / off-sale limited dahil) feed'de ASLA gösterme.
        const pool = collected.filter(it => it.price !== 0 && it.price != null);
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        const items = pool.slice(0, 30);
        const ids = items.map(i => i.id); const thumbs = {};
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          try { const tr = await fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(",")}&size=150x150&format=Png&isCircular=false`, { credentials: "include" }); if (tr.ok) { const td = await tr.json(); (td.data || []).forEach(t => { if (t.targetId && t.imageUrl) thumbs[t.targetId] = t.imageUrl; }); } } catch {}
        }
        items.forEach(it => it.thumb = thumbs[it.id] || "");
        sendResponse({ ok: true, items, personalized, diag, cats: cats.slice(0, 3) });
      } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    })();
    return true; // async
  }

  // Avatar Sandbox — Roblox marketplace/katalog araması (Marketplace'ten Dene seçici).
  if (request.action === "trackedSandboxCatalogSearch") {
    (async () => {
      try {
        const kw = (request.keyword || "").trim();
        const category = request.category || "";
        const sub = request.subcategory || "";
        const fallbackKw = (request.fallbackKeyword || "").trim(); // enum tutmazsa isim-bazlı arama
        const reqVariant = (request.variant != null) ? String(request.variant) : null; // sonraki sayfa: çözülmüş varyant
        const reqCursor = request.cursor || ""; // sonsuz kaydırma cursor'ı
        const bundleType = (request.bundleType || "").trim(); // "BodyParts" → bundle araması (Full Bodies)
        // SortType SAYISAL olmalı (0=Relevance,1=MostFavorited,2=Bestselling,3=RecentlyUpdated,
        // 4=PriceLowToHigh,5=PriceHighToLow). String yollanırsa API yok sayar → ücretsiz junk gelir.
        let sortType = (request.sortType != null && request.sortType !== "") ? Number(request.sortType) : 0;
        const minP = request.minPrice, maxP = request.maxPrice;
        const salesType = request.salesType || "";
        const showUnavailable = !!request.showUnavailable;
        const includeFree = !!request.includeFree;
        const creatorName = (request.creatorName || "").trim();

        // "All" (filtresiz) durumda kategori/keyword yok → SortType=0 (Relevance) anlamsız/boş döndürür.
        // Bu durumda popüler (MostFavorited, AllTime) varsayılanına geç → dolu, anlamlı bir "All" feed'i.
        const bareSearch = !category && !sub && !kw && !fallbackKw && !bundleType;
        if (bareSearch && sortType === 0) sortType = 1;

        // Ortak parametreler — tüm denemelerde aynı (limit, sort, kullanıcı keyword'ü, fiyat, satış, yaratıcı).
        let base = `Limit=30&SortType=${sortType}`;
        if (kw) base += `&Keyword=${encodeURIComponent(kw)}`;
        // Favori/ÇokSatan/Yeni sıralaması SortAggregation olmadan saçmalıyor → AllTime ekle.
        if (sortType === 1 || sortType === 2 || sortType === 3) base += `&SortAggregation=5`;
        // Varsayılan: ücretsizleri gizle (MinPrice=1). "Include free" işaretliyse serbest.
        let mp = (minP != null && minP !== "") ? Number(minP) : null;
        if (!includeFree && (mp == null || mp < 1)) mp = 1;
        if (mp != null) base += `&MinPrice=${mp}`;
        if (maxP != null && maxP !== "") base += `&MaxPrice=${encodeURIComponent(maxP)}`;
        if (salesType === "Limited") base += `&salesTypeFilter=2`;
        if (showUnavailable) base += `&IncludeNotForSale=true`;
        if (creatorName) {
          try {
            const ur = await fetch("https://users.roblox.com/v1/usernames/users", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: [creatorName], excludeBannedUsers: false }) });
            if (ur.ok) { const ud = await ur.json(); const cid = ud?.data?.[0]?.id; if (cid) base += `&CreatorTargetId=${cid}&CreatorType=User`; }
          } catch {}
        }
        // Kategori/alt-kategori DENEME ZİNCİRİ — ilk 200 dönen kullanılır. Uyumsuz kombinasyon ya da
        // yanlış enum 400 verirse sıradakine geçilir; en sonda item adıyla (keyword) aranır. Böylece
        // "Category subcategory selection not supported" 400'ü kullanıcıya HİÇ yansımaz.
        // SAYFALAMA: ilk sayfada zincir denenir; sonraki sayfalarda (reqVariant verilmiş) çözülmüş
        // varyant doğrudan + cursor ile kullanılır (cursor o varyanta özgüdür, zincir tekrar denenmez).
        let variants;
        if (reqVariant != null) {
          variants = [reqVariant];
        } else if (bundleType) {
          // BUNDLE MODU (Full Bodies vb.): bundle'lar itemType="Bundle" döner; Subcategory/Category=Bundles
          // ile listelenir, aşağıda bundleType'a göre süzülür (animasyon/shoe bundle'ları elenir).
          variants = [`&Subcategory=Bundles`, `&Category=Bundles`];
        } else {
          variants = [];
          if (category && sub) variants.push(`&Category=${encodeURIComponent(category)}&Subcategory=${encodeURIComponent(sub)}`);
          if (sub) variants.push(`&Subcategory=${encodeURIComponent(sub)}`);
          if (category && !sub) variants.push(`&Category=${encodeURIComponent(category)}`);
          if (fallbackKw && !kw) variants.push(`&Keyword=${encodeURIComponent(fallbackKw)}`);
          if (!variants.length) variants.push("");
        }
        const cursorParam = reqCursor ? `&Cursor=${encodeURIComponent(reqCursor)}` : "";
        const doGet = (u, tok) => fetch(u, { credentials: "include", headers: tok ? { "X-CSRF-TOKEN": tok } : {} });
        let d = null, lastErr = "", lastBody = "", usedVariant = "";
        for (const v of variants) {
          const u = `https://catalog.roblox.com/v1/search/items/details?${base}${v}${cursorParam}`;
          let r = await doGet(u, "");
          if (r.status === 403) { const t = r.headers.get("x-csrf-token"); if (t) r = await doGet(u, t); }
          if (r.status === 504 || r.status === 503) { await new Promise(s => setTimeout(s, 400)); r = await doGet(u, ""); }
          if (r.ok) { d = await r.json(); usedVariant = v; break; }
          lastErr = "search_" + r.status; lastBody = (await r.text().catch(() => "")).slice(0, 200);
        }
        if (!d) { sendResponse({ ok: false, error: lastErr || "search_failed", body: lastBody }); return; }
        let items;
        if (bundleType) {
          // Bundle'ları al, istenen bundleType'a göre süz (BodyParts → tam gövde; animasyon/shoe bundle elenir).
          const wantBody = /body/i.test(bundleType);
          items = (d.data || []).filter(it => it.itemType === "Bundle").filter(it => {
            const bt = String(it.bundleType != null ? it.bundleType : "");
            if (bt === "") return true; // bundleType alanı yoksa ele alma (boş kalmasın)
            if (wantBody) return /body/i.test(bt) || bt === "1"; // BodyParts ya da sayısal 1
            return bt.toLowerCase() === bundleType.toLowerCase();
          }).map(it => ({
            id: Number(it.id), name: it.name || ("Bundle " + it.id),
            price: (it.price != null ? it.price : (it.lowestPrice != null ? it.lowestPrice : null)),
            creator: it.creatorName || "", isBundle: true
          }));
        } else {
          items = (d.data || []).filter(it => it.itemType === "Asset").map(it => ({
            id: Number(it.id), name: it.name || ("Item " + it.id),
            price: (it.price != null ? it.price : (it.lowestPrice != null ? it.lowestPrice : null)),
            creator: it.creatorName || ""
          }));
        }
        // Varsayılan: gösterdiğimiz fiyatı 0 olan (ücretsiz / lowestPrice=0) item'ları ayıkla.
        if (!includeFree) items = items.filter(it => it.price !== 0);
        const ids = items.map(i => i.id);
        const thumbs = {};
        const thumbDiag = { mode: bundleType ? "bundle" : "asset", n: ids.length, ok: 0, status: 0, sample: "" };
        // Bundle thumbnail'ı farklı UÇTAN gelir: /v1/bundles/thumbnails (asset'te /v1/assets).
        // (v1/bundles → 404; doğru yol /thumbnails ekiyle; bundle için geçerli boyut 420x420.)
        const thumbUrlFor = (chunk) => bundleType
          ? `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${chunk.join(",")}&size=420x420&format=Png&isCircular=false`
          : `https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(",")}&size=150x150&format=Png&isCircular=false`;
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          try {
            const tr = await fetch(thumbUrlFor(chunk), { credentials: "include" });
            thumbDiag.status = tr.status;
            if (tr.ok) {
              const td = await tr.json();
              if (i === 0) thumbDiag.sample = JSON.stringify((td.data || [])[0] || {}).slice(0, 180);
              (td.data || []).forEach(t => { if (t.targetId && t.imageUrl) { thumbs[t.targetId] = t.imageUrl; thumbDiag.ok++; } });
            } else if (i === 0) { thumbDiag.sample = (await tr.text().catch(() => "")).slice(0, 180); }
          } catch (e) { if (i === 0) thumbDiag.sample = String(e).slice(0, 180); }
        }
        items.forEach(it => it.thumb = thumbs[it.id] || "");
        // cursor + çözülmüş varyant → client sonraki sayfayı aynı varyantla ister (sonsuz kaydırma).
        // thumbDiag/dataLen = teşhis (thumbnail neden boş / cursor var mı).
        sendResponse({ ok: true, items, cursor: d.nextPageCursor || "", variant: usedVariant, thumbDiag, dataLen: (d.data || []).length });
      } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    })();
    return true; // async
  }

  // Avatar Sandbox — bundle'ı içerdiği asset'lere çöz (Full Bodies try-on: bundleId → assetIds).
  if (request.action === "trackedSandboxBundleDetails") {
    (async () => {
      try {
        const bid = request.bundleId;
        const r = await fetch(`https://catalog.roblox.com/v1/bundles/${bid}/details`, { credentials: "include", headers: { "Accept": "application/json" } });
        if (!r.ok) { sendResponse({ ok: false, error: "bundle_" + r.status }); return; }
        const d = await r.json();
        // Bundle "items": tip "Asset" olanlar giyilebilir parçalardır (gövde/saç/aksesuar);
        // "UserOutfit" tipini atlıyoruz (tek asset değil, ayrı çözüm gerektirir).
        const assetIds = (d.items || []).filter(it => String(it.type).toLowerCase() === "asset").map(it => Number(it.id)).filter(Boolean);
        sendResponse({ ok: true, assetIds, bundleType: d.bundleType || "" });
      } catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    })();
    return true; // async
  }

  // Avatar Sandbox — taban avatarın GİYİLİ asset parmak izi (canlı senkron: native editörde
  // item ekle/çıkar yapınca try-on render'ı güncellensin). Sadece giyili ID'leri döndürür (ucuz).
  if (request.action === "trackedSandboxAvatarState") {
    (async () => {
      try {
        let uid = request.userId;
        if (!uid) { try { const me = await fetch("https://users.roblox.com/v1/users/authenticated", { credentials: "include" }); if (me.ok) uid = (await me.json()).id; } catch {} }
        if (!uid) { sendResponse({ ok: false }); return; }
        const av = await fetch(`https://avatar.roblox.com/v1/users/${uid}/avatar`, { credentials: "include" });
        if (!av.ok) { sendResponse({ ok: false }); return; }
        const avd = await av.json();
        const ids = (avd.assets || []).map(a => Number(a.id)).filter(Boolean).sort((a, b) => a - b);
        sendResponse({ ok: true, fp: ids.join(",") });
      } catch (e) { sendResponse({ ok: false }); }
    })();
    return true; // async
  }

  if (request.action === "measurePingForContent") {
    measureBestPing()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  if (request.action === "refreshGameLibrary") {
    trackGameLibraryActivity();
    sendResponse({ success: true });
    return true;
  }
  if (request.action === "testEventDetection") {
    testEventDetection(request.placeId)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  if (request.action === "analyzeGame") {
    analyzeSingleGame(request.placeId)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  if (request.action === "getEventHistory") {
    getEventHistory(request.placeId)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  
  // Server List Enhancer — MAIN world proxy (sayfa context'i: cookie + CORS sorunsuz)
  if (request.action === "getServerListData") {
    const tabId = sender?.tab?.id;
    if (!tabId) { sendResponse({ ok: false, error: 'no_tab_id' }); return true; }

    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (placeId) => {
        try {
          let universeId = null;

          // 1. Roblox sayfası zaten servers API'sini çağırdıysa → URL'den al (en güvenilir)
          for (const entry of performance.getEntriesByType('resource')) {
            const m = entry.name.match(/games\.roblox\.com\/v1\/games\/(\d+)\/servers/);
            if (m) { universeId = parseInt(m[1], 10); break; }
          }

          // 2. multiget-place-details — placeId'yi doğrudan kabul eder, gerçek universeId döner
          if (!universeId) {
            try {
              const r = await fetch(
                `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`,
                { credentials: 'include' }
              );
              if (r.ok) {
                const d = await r.json();
                universeId = d?.[0]?.universeId || null;
              }
            } catch {}
          }

          // 3. DOM data attribute
          if (!universeId) {
            const domEl = document.querySelector('[data-universe-id]');
            if (domEl) universeId = parseInt(domEl.dataset.universeId, 10) || null;
          }

          // 4. Inline script tag'lardaki JSON
          if (!universeId) {
            for (const s of document.querySelectorAll('script')) {
              if (!s.textContent.includes('universeId')) continue;
              try {
                const m = s.textContent.match(/"universeId"\s*:\s*(\d+)/);
                if (m) { universeId = parseInt(m[1], 10); break; }
              } catch {}
            }
          }

          // 5. universes API (son çare — daha önce yanlış sonuç verdi)
          if (!universeId) {
            try {
              const r = await fetch(
                `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
                { credentials: 'include' }
              );
              if (r.ok) {
                const d = await r.json();
                universeId = d?.universeId || null;
              }
            } catch {}
          }

          if (!universeId) return { ok: false, error: 'no_universeId' };

          const tryFetchId = async (id) => {
            const url = `https://games.roblox.com/v1/games/${id}/servers/Public?sortOrder=Desc&excludeFullGames=false&limit=25`;
            const r = await fetch(url, { credentials: 'include' });
            if (!r.ok) {
              const body = await r.text().catch(() => '');
              return { status: r.status, body: body.slice(0, 300), usedId: id };
            }
            return { status: 200, data: await r.json(), usedId: id };
          };

          let res = await tryFetchId(universeId);
          // Son çare: placeId'yi universeId olarak dene
          if (res.status !== 200 && String(placeId) !== String(universeId)) {
            const r2 = await tryFetchId(placeId);
            if (r2.status === 200) res = r2;
          }

          if (res.status !== 200) {
            return { ok: false, error: `sv_${res.status}: ${res.body}`, universeId };
          }

          const allServers = [];
          if (Array.isArray(res.data?.data)) allServers.push(...res.data.data);

          const cursor = res.data?.nextPageCursor;
          if (cursor && allServers.length < 100) {
            const url2 = `https://games.roblox.com/v1/games/${res.usedId}/servers/Public?sortOrder=Desc&excludeFullGames=false&limit=25&cursor=${encodeURIComponent(cursor)}`;
            const r2 = await fetch(url2, { credentials: 'include' });
            if (r2.ok) {
              const d2 = await r2.json();
              if (Array.isArray(d2?.data)) allServers.push(...d2.data);
            }
          }

          return { ok: true, servers: allServers, universeId: res.usedId };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      },
      args: [String(request.placeId)]
    }).then(results => {
      sendResponse(results?.[0]?.result || { ok: false, error: 'no_result' });
    }).catch(err => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }

  // v1.7: Widget handlers
  if (request.action === "openPopup") {
    // Widget'tan popup açma isteği
    chrome.action.openPopup();
    sendResponse({ success: true });
    return true;
  }
  
  // Side panel state query — port-based, real-time, async lag yok.
  if (request.action === "getSidePanelState") {
    sendResponse({ isOpen: _sidePanelState.isOpen });
    return false;
  }

  // Auto-Reconnect: join akışlarının çağırdığı action — placeId/jobId/gameTitle ile session kaydet
  if (request.action === "saveActiveSession") {
    saveActiveSession(request.placeId, request.jobId, request.gameTitle)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // Auto-Reconnect: content script CORS bypass için thumbnail proxy
  if (request.action === "getGameThumbnail") {
    (async () => {
      try {
        const placeId = request.placeId;
        if (!placeId) { sendResponse({ ok: false, error: 'no_placeId' }); return; }
        // placeId -> universeId
        const uniRes = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
        if (!uniRes.ok) { sendResponse({ ok: false, error: 'universe_lookup_failed' }); return; }
        const uniData = await uniRes.json();
        const universeId = uniData?.universeId;
        if (!universeId) { sendResponse({ ok: false, error: 'no_universe' }); return; }
        // universeId -> icon URL
        const iconRes = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=256x256&format=Png&isCircular=false`);
        if (!iconRes.ok) { sendResponse({ ok: false, error: 'icon_fetch_failed' }); return; }
        const iconData = await iconRes.json();
        const url = iconData?.data?.[0]?.imageUrl;
        if (url && url !== 'https://t1.rbxcdn.com/none.png') {
          sendResponse({ ok: true, imageUrl: url });
        } else {
          sendResponse({ ok: false, error: 'no_icon' });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
    })();
    return true;
  }

  // Auto-Reconnect: manuel monitor tetikleme (debugging için)
  if (request.action === "triggerSessionMonitor") {
    monitorActiveSession()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // Auto-Reconnect: manuel crash notification testi (debugging için)
  if (request.action === "testCrashNotification") {
    chrome.storage.local.get(['tracked_active_session', 'rota_settings'], (data) => {
      const s = data.tracked_active_session;
      const settings = data.rota_settings || {};
      if (!s) {
        sendResponse({ ok: false, error: 'No active session — bir oyuna gir önce' });
        return;
      }
      // In-page overlay HER ZAMAN (test'in amacı bu)
      broadcastReconnectOverlay(s);
      // Native sadece ayar açıksa
      if (settings.autoReconnectNative === true) {
        triggerCrashNotification(s);
      }
      sendResponse({ ok: true, session: s, broadcastedOverlay: true, broadcastedNative: settings.autoReconnectNative === true });
    });
    return true;
  }

  // Tracked Derin: Native in-page launcher — Roblox.GameLauncher.joinGameInstance
  // Sayfa MAIN world'inde çalışır → CSP/isolated world bypass; manuel "Play" sayfası açılmaz.
  if (request.action === "launchRobloxGame") {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab' });
      return false;
    }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (placeId, jobId) => {
        try {
          const pid = parseInt(placeId, 10);
          if (window.Roblox && Roblox.GameLauncher && typeof Roblox.GameLauncher.joinGameInstance === 'function') {
            Roblox.GameLauncher.joinGameInstance(pid, jobId);
            return 'native';
          }
        } catch (e) {
          console.warn('[Tracked] Native launcher hata:', e);
        }
        try {
          window.location.href = 'roblox://experiences/start?placeId=' + encodeURIComponent(placeId) + '&gameInstanceId=' + encodeURIComponent(jobId);
          return 'deeplink';
        } catch (e) {
          return 'fail';
        }
      },
      args: [String(request.placeId), String(request.jobId)]
    }).then(results => {
      const method = results && results[0] && results[0].result;
      // Auto-Reconnect: native launcher tetiklendiğinde session kaydet
      if (method === 'native' || method === 'deeplink') {
        saveActiveSession(request.placeId, request.jobId, request.gameTitle).catch(() => {});
      }
      sendResponse({ success: method !== 'fail', method });
    }).catch(err => {
      console.error('[SW] launchRobloxGame error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  // Oto-Pilot: MAIN world matchmaker query.
  // Tarayıcı content-script fetch'i gamejoin endpoint'inden status:12 yiyor.
  // MAIN world'de Roblox sayfasının kendi JS context'inden POST yaparak anti-automation'ı bypass ediyoruz.
  // Block list aktifken matchmaker'ın bize verdiği jobId = "blocksuz veya yeni" server.
  if (request.action === "swMainWorldMatchmaker") {
    const placeId = request.placeId;
    const senderTabId = sender.tab && sender.tab.id;

    const runOnTab = (tabId) => {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: async (placeId) => {
          const getCsrf = () => {
            try {
              return document.querySelector('meta[name="csrf-token"]')?.content
                || (window.Roblox?.XsrfToken?.getToken?.() ?? '');
            } catch (_) { return ''; }
          };

          // Minimal body — Roblox web client gamejoin için bunlardan fazlasını göndermiyor.
          // Önceki denemede joinAttemptOrigin/joinAttemptId eklenmesi status:12'ye sebep olmuştu.
          const buildBody = () => JSON.stringify({
            placeId: parseInt(placeId, 10),
            isTeleport: false,
            gameId: null,
            gameJoinAttemptId: (crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`)
          });

          const doPost = (csrf) => fetch('https://gamejoin.roblox.com/v1/join-game-instance', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-TOKEN': csrf,
              'Accept': 'application/json'
            },
            body: buildBody()
          });

          try {
            let res = await doPost(getCsrf());
            // 403 + x-csrf-token rotation → 1 kere retry
            if (res.status === 403) {
              const fresh = res.headers.get('x-csrf-token');
              if (fresh) res = await doPost(fresh);
            }
            if (!res.ok) return { ok: false, status: res.status };
            const data = await res.json();
            const jobId = data.jobId || data.joinScript?.JobId || data.joinScript?.jobId;
            return { ok: true, status: data.status, jobId, message: data.message };
          } catch (err) {
            return { ok: false, error: String(err && err.message || err) };
          }
        },
        args: [String(placeId)]
      }).then(results => {
        sendResponse(results?.[0]?.result || { ok: false, error: 'no_result' });
      }).catch(err => {
        console.error('[SW] swMainWorldMatchmaker error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    };

    if (senderTabId) {
      // Content script'ten geldi → o tab'ı kullan (en doğru, en hızlı)
      runOnTab(senderTabId);
    } else {
      // Popup/sidepanel'den geldi → aktif Roblox tab bul
      chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        const tab = tabs.find(t => /roblox\.com/.test(t.url || ''));
        if (!tab) { sendResponse({ ok: false, error: 'no_roblox_tab' }); return; }
        runOnTab(tab.id);
      }).catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    }
    return true;
  }

  if (request.action === "joinGame") {
    (async () => {
      try {
        const { placeId, useBestServer, jobId } = request;
        
        if (!placeId) {
          sendResponse({ success: false, error: 'Place ID required' });
          return;
        }
        
        // Get best server from cache if requested
        let targetJobId = jobId;
        if (useBestServer && !targetJobId) {
          const storage = await chrome.storage.local.get('rota_best_region');
          const bestRegion = storage.rota_best_region;
          if (bestRegion && bestRegion.jobId) {
            targetJobId = bestRegion.jobId;
          }
        }
        
        // Create join link
        const joinUrl = targetJobId 
          ? `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${targetJobId}`
          : `roblox://experiences/start?placeId=${placeId}`;
        
        // Open in new tab
        await chrome.tabs.create({ url: joinUrl });
        
        sendResponse({ success: true });
      } catch (err) {
        console.error('[SW] Join game error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  
  if (request.action === "getCachedPingData") {
    (async () => {
      try {
        const storage = await chrome.storage.local.get(['rota_ping_results', 'rota_best_region']);
        sendResponse({
          success: true,
          pings: storage.rota_ping_results || [],
          best: storage.rota_best_region || null
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // ── Instance Trigger: CORS-free istekler (SW context = host_permissions bypass) ──

  if (request.action === "swGetGameInfo") {
    (async () => {
      try {
        const univRes = await fetch(
          `https://apis.roblox.com/universes/v1/places/${request.placeId}/universe`,
          { credentials: 'omit' }
        );
        if (!univRes.ok) { sendResponse({ groupId: null, playing: 0 }); return; }
        const universeId = (await univRes.json()).universeId;

        // v2 → creator info
        let creatorType = null, creatorId = null;
        try {
          const gameRes = await fetch(
            `https://games.roblox.com/v2/games?universeIds=${universeId}`,
            { credentials: 'omit' }
          );
          if (gameRes.ok) {
            const game = (await gameRes.json()).data?.[0];
            creatorType = game?.creator?.type;
            creatorId = game?.creator?.id;
          }
        } catch (_) {}

        // v1 → playing count (gerçek aktif oyuncu sayısı)
        let playing = 0;
        try {
          const v1Res = await fetch(
            `https://games.roblox.com/v1/games?universeIds=${universeId}`,
            { credentials: 'omit' }
          );
          if (v1Res.ok) {
            const v1 = await v1Res.json();
            playing = v1.data?.[0]?.playing || 0;
          }
        } catch (_) {}

        const groupId = creatorType === 'Group' ? creatorId : null;
        sendResponse({ groupId, universeId, playing, creatorType, creatorId });
      } catch (e) {
        sendResponse({ groupId: null, universeId: null, playing: 0 });
      }
    })();
    return true;
  }

  // Trade Analyzer: Rolimons fetch — content script'in CORS'unu bypass eder
  if (request.action === "fetchRolimonsData") {
    (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 14000);
        const res = await fetch('https://www.rolimons.com/itemapi/itemdetails', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'omit',
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) { sendResponse({ ok: false, error: `HTTP ${res.status}` }); return; }
        const json = await res.json();
        sendResponse({ ok: true, items: json.items || {} });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  // Envanter RAC: tüm limited itemları çek (V1 klasik + V2 UGC)
  // V1 klasik limitedları çek (doğru assetId + recentAveragePrice içerir)
  // UGC limitedlar DOM scraping ile ayrıca işlenir (inventory_rac.js)
  if (request.action === "fetchCollectiblesPage") {
    const tabId = sender?.tab?.id;
    (async () => {
      try {
        const { userId } = request;
        if (!tabId) { sendResponse({ ok: false, error: 'no_tab_id' }); return; }

        const results = await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: async (uid) => {
            try {
              const opts = { credentials: 'include', headers: { 'Accept': 'application/json' } };
              let allData = [];
              let cursor = '';
              let page = 0;
              do {
                const url = `https://inventory.roblox.com/v1/users/${uid}/assets/collectibles?sortOrder=Desc&limit=100` +
                  (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
                const r = await fetch(url, opts);
                if (!r.ok) return { ok: false, status: r.status };
                const d = await r.json();
                allData = allData.concat((d.data || []).map(it => ({
                  assetId: it.assetId || it.AssetId || 0,
                  name: it.name || it.Name || it.assetName || '',
                  recentAveragePrice: it.recentAveragePrice || it.RecentAveragePrice || 0,
                })).filter(it => it.assetId > 0));
                cursor = d.nextPageCursor || '';
                page++;
                if (page > 50) break;
              } while (cursor);
              return { ok: true, data: allData };
            } catch (e) {
              return { ok: false, error: String(e) };
            }
          },
          args: [String(userId)]
        });

        const res = results?.[0]?.result;
        sendResponse(res || { ok: false, error: 'no_result' });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  // Envanter RAC: Rolimons verisi — SW'dan çek (CORS yok)
  if (request.action === "fetchRolimonsForRAC") {
    const ROLI_KEY = 'tracked_rolimons_cache';
    const ROLI_TTL = 30 * 60 * 1000;
    (async () => {
      const stored = await chrome.storage.local.get(ROLI_KEY);
      const cached = stored[ROLI_KEY];
      if (cached?.data && (Date.now() - cached.fetchedAt) < ROLI_TTL) {
        sendResponse({ ok: true, data: cached.data, stale: false });
        return;
      }
      try {
        const r = await fetch('https://www.rolimons.com/itemapi/itemdetails', {
          headers: { 'Accept': 'application/json' }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (!json.success || !json.items) throw new Error('invalid_response');
        await chrome.storage.local.set({ [ROLI_KEY]: { data: json.items, fetchedAt: Date.now() } });
        sendResponse({ ok: true, data: json.items, stale: false });
      } catch {
        if (cached?.data) {
          sendResponse({ ok: true, data: cached.data, stale: true });
        } else {
          sendResponse({ ok: false, error: 'Rolimons yüklenemedi' });
        }
      }
    })();
    return true;
  }

  // Envanter RAC: Rolimons player assets — kullanıcının Rolimons'ta izlenen limited envanteri
  if (request.action === "fetchRolimonsPlayerAssets") {
    const { userId } = request;
    (async () => {
      try {
        const r = await fetch(`https://www.rolimons.com/api/playerassets/${userId}`, {
          headers: { 'Accept': 'application/json', 'Referer': 'https://www.rolimons.com/' }
        });
        if (!r.ok) { sendResponse({ ok: false, status: r.status }); return; }
        const json = await r.json();
        if (!json.success) { sendResponse({ ok: false }); return; }
        sendResponse({ ok: true, playerassets: json.playerassets || {} });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  // Envanter RAC: limited RAP — economy resale API, batch (UGC limiteds için)
  if (request.action === "fetchResaleDataBatch") {
    const { assetIds } = request;
    (async () => {
      try {
        const rap = {};
        const RAP_CACHE_KEY = 'tracked_resale_cache';
        const RAP_TTL = 15 * 60 * 1000; // 15dk
        const stored = await chrome.storage.local.get(RAP_CACHE_KEY);
        const cache = stored[RAP_CACHE_KEY] || {};
        const now = Date.now();
        const toFetch = [];
        for (const id of (assetIds || [])) {
          const hit = cache[id];
          if (hit && (now - hit.t) < RAP_TTL) { rap[id] = hit.v; }
          else toFetch.push(id);
        }
        for (const id of toFetch) {
          try {
            const r = await fetch(`https://economy.roblox.com/v1/assets/${id}/resale-data`, {
              headers: { 'Accept': 'application/json' }
            });
            if (r.ok) {
              const d = await r.json();
              const v = d.recentAveragePrice || 0;
              rap[id] = v;
              cache[id] = { v, t: now };
            }
          } catch { }
          await new Promise(res => setTimeout(res, 60)); // 60ms aralık
        }
        if (toFetch.length > 0) chrome.storage.local.set({ [RAP_CACHE_KEY]: cache });
        sendResponse({ ok: true, rap });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CANLI PİYASA TAKİBİ — Çoklu kaynak, MAIN world batch, akıllı cache
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Mimari:
  //   Method 1 (Birincil): catalog.roblox.com/v1/catalog/items/details
  //     - MAIN world execution (Roblox sayfası context'inden çağrı, CORS/CSRF sorunsuz)
  //     - 120 item per batch → 48 item'lık envanter için TEK request
  //     - lowestPrice field = gerçek canlı Best Price (Roblox marketplace'de görünen)
  //     - Rate-limit çok daha geniş (batch endpoint olduğu için)
  //
  //   Method 2 (Fallback): economy.roblox.com/v1/assets/{id}/resellers?limit=1
  //     - Per-item çağrı, sadece catalog'da lowestPrice null olan UGC limited'lar için
  //     - En fazla 20 item ile sınırlı (rate-limit koruması)
  //
  //   Cache: 5 dk TTL, force refresh ile bypass edilebilir
  //   Price history: Her fresh fetch storage'a snapshot kaydeder (son 50 örnek)
  //
  // ─────────────────────────────────────────────────────────────────────────
  // Single item catalog info — itemRestrictions check için
  // (catalog_enhancer.js sadece limited/collectible item'larda widget gösterir)
  // ─────────────────────────────────────────────────────────────────────────
  if (request.action === "fetchCatalogItemInfo") {
    const { itemId } = request;
    (async () => {
      try {
        let tab = null;
        if (sender?.tab?.id && /\.roblox\.com/.test(sender.tab.url || '')) {
          tab = sender.tab;
        } else {
          const tabs = await chrome.tabs.query({ url: ['*://*.roblox.com/*'] });
          tab = tabs.find(t => t.active) || tabs[0];
        }
        if (!tab) { sendResponse({ ok: false, error: 'no_tab' }); return; }

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: async (id) => {
            try {
              const getCsrf = async () => {
                const meta = document.querySelector('meta[name="csrf-token"]')?.content;
                if (meta) return meta;
                try {
                  const rbx = window.Roblox?.XsrfToken?.getToken?.();
                  if (rbx) return rbx;
                } catch {}
                try {
                  const r = await fetch('https://auth.roblox.com/v2/logout', {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }, body: '{}'
                  });
                  return r.headers.get('x-csrf-token') || '';
                } catch { return ''; }
              };

              const body = JSON.stringify({
                items: [{ itemType: 'Asset', id: parseInt(id, 10) }]
              });
              const doPost = (csrf) => fetch('https://catalog.roblox.com/v1/catalog/items/details', {
                method: 'POST', credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'X-CSRF-TOKEN': csrf,
                  'Accept': 'application/json'
                },
                body
              });

              let csrf = await getCsrf();
              let res = await doPost(csrf);
              if (res.status === 403) {
                const fresh = res.headers.get('x-csrf-token');
                if (fresh && fresh !== csrf) res = await doPost(fresh);
              }
              if (!res.ok) return { ok: false, status: res.status };
              const data = await res.json();
              return { ok: true, item: (data.data || [])[0] || null };
            } catch (e) {
              return { ok: false, error: String(e) };
            }
          },
          args: [String(itemId)]
        }).catch(execErr => null);

        sendResponse(results?.[0]?.result || { ok: false, error: 'no_main_result' });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (request.action === "fetchFloorPricesBatch") {
    const { assetIds, forceRefresh } = request;
    (async () => {
      const FLOOR_CACHE_KEY = 'tracked_floor_cache';
      const FLOOR_TTL = 5 * 60 * 1000; // 5dk
      const HISTORY_KEY = 'tracked_price_history';
      const HISTORY_MAX_PER_ITEM = 50;
      const HISTORY_MIN_INTERVAL = 10 * 60 * 1000; // En az 10dk arayla snapshot

      try {
        const stored = await chrome.storage.local.get([FLOOR_CACHE_KEY, HISTORY_KEY]);
        const cache = stored[FLOOR_CACHE_KEY] || {};
        const history = stored[HISTORY_KEY] || {};
        const now = Date.now();

        const floors = {};
        const sources = {}; // id → 'cache' | 'catalog' | 'resellers' | 'missing'
        const toFetch = [];
        const diag = {
          requested: (assetIds || []).length,
          cacheHits: 0,
          catalogOk: 0,
          catalogNull: 0,
          resellersOk: 0,
          resellersNull: 0,
          mainWorldUsed: false,
          rateLimited: false,
          tabFound: false,
          errors: [],
          fetchedAt: now,
        };

        // 1. Cache check
        for (const id of (assetIds || [])) {
          const sid = String(id);
          const hit = cache[sid];
          if (!forceRefresh && hit && (now - hit.t) < FLOOR_TTL) {
            floors[sid] = hit.v;
            sources[sid] = 'cache';
            diag.cacheHits++;
          } else {
            toFetch.push(sid);
          }
        }

        if (toFetch.length === 0) {
          sendResponse({ ok: true, floors, sources, diag, rateLimited: false });
          return;
        }

        // 2. Tab keşfi — MAIN world execution için aktif Roblox sekmesi
        let tab = null;
        try {
          // Önce mesajı gönderen tab (en güvenilir — kullanıcı orada)
          if (sender?.tab?.id && sender.tab.url && /\.roblox\.com/.test(sender.tab.url)) {
            tab = sender.tab;
          } else {
            const tabs = await chrome.tabs.query({ url: ['*://*.roblox.com/*'] });
            tab = tabs.find(t => t.active && t.status === 'complete')
                || tabs.find(t => t.status === 'complete')
                || tabs[0];
          }
          diag.tabFound = !!tab;
        } catch (e) {
          diag.errors.push('tab_query: ' + e.message);
        }

        // 3. Method 1 — Batch catalog endpoint (MAIN world)
        if (tab) {
          for (let i = 0; i < toFetch.length && !diag.rateLimited; i += 120) {
            const batch = toFetch.slice(i, i + 120);

            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: async (itemIds) => {
                  // ─ SAĞLAM CSRF Token Edinme — birden fazla kaynak + dummy POST fallback
                  const getCsrfRobust = async () => {
                    const meta = document.querySelector('meta[name="csrf-token"]')?.content;
                    if (meta) return meta;
                    try {
                      const rbx = window.Roblox?.XsrfToken?.getToken?.();
                      if (rbx) return rbx;
                    } catch {}
                    try {
                      const ctx = window.Roblox?.GameLauncher?.csrfToken
                               || window.Roblox?.AppContext?.csrfToken
                               || window.Roblox?.csrfToken;
                      if (ctx) return ctx;
                    } catch {}
                    const dummyEndpoints = [
                      'https://auth.roblox.com/v2/logout',
                      'https://friends.roblox.com/v1/users/0/follow',
                    ];
                    for (const url of dummyEndpoints) {
                      try {
                        const res = await fetch(url, {
                          method: 'POST',
                          credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: '{}'
                        });
                        const fresh = res.headers.get('x-csrf-token');
                        if (fresh) return fresh;
                      } catch {}
                    }
                    return '';
                  };

                  const body = JSON.stringify({
                    items: itemIds.map(id => ({ itemType: 'Asset', id: parseInt(id, 10) }))
                  });

                  const doPost = async (csrf) =>
                    fetch('https://catalog.roblox.com/v1/catalog/items/details', {
                      method: 'POST',
                      credentials: 'include',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrf,
                        'Accept': 'application/json'
                      },
                      body
                    });

                  try {
                    let csrfToken = await getCsrfRobust();
                    let res = await doPost(csrfToken);
                    // CSRF rotation: 403 → fresh token (response header veya dummy POST)
                    if (res.status === 403) {
                      const fresh = res.headers.get('x-csrf-token');
                      if (fresh && fresh !== csrfToken) {
                        res = await doPost(fresh);
                      } else {
                        const newToken = await getCsrfRobust();
                        if (newToken && newToken !== csrfToken) {
                          res = await doPost(newToken);
                        }
                      }
                    }
                    if (res.status === 429) return { ok: false, rateLimited: true };
                    if (!res.ok) {
                      const bodyText = await res.text().catch(() => '');
                      return { ok: false, status: res.status, errorBody: bodyText.slice(0, 200) };
                    }
                    const data = await res.json();
                    return { ok: true, data: data.data || [] };
                  } catch (err) {
                    return { ok: false, error: String(err) };
                  }
                },
                args: [batch]
              });

              const result = results?.[0]?.result;
              diag.mainWorldUsed = true;

              if (result?.rateLimited) {
                diag.rateLimited = true;
                break;
              }

              if (result?.ok && Array.isArray(result.data)) {
                // Response'tan gelen item'ları işle
                const seenInResponse = new Set();
                for (const item of result.data) {
                  const sid = String(item.id);
                  seenInResponse.add(sid);
                  // lowestPrice = gerçek canlı Best Price (Roblox sayfasında "Best Price" olarak görünür)
                  const price = (typeof item.lowestPrice === 'number' && item.lowestPrice > 0)
                    ? item.lowestPrice
                    : null;
                  floors[sid] = price;
                  sources[sid] = 'catalog';
                  cache[sid] = { v: price, t: now, s: 'catalog' };
                  if (price !== null) diag.catalogOk++;
                  else diag.catalogNull++;
                }
                // Batch'te istenmiş ama response'ta dönmemiş item'lar: silinmiş veya geçersiz
                for (const id of batch) {
                  if (!seenInResponse.has(id)) {
                    floors[id] = null;
                    sources[id] = 'missing';
                    cache[id] = { v: null, t: now, s: 'missing' };
                  }
                }
              } else if (result) {
                diag.errors.push('catalog_batch: status=' + result.status + ' err=' + (result.error || '') + ' body=' + (result.errorBody || '').slice(0, 80));
              }
            } catch (e) {
              diag.errors.push('exec_script: ' + e.message);
            }

            // Batch'ler arası ufak bekleme
            if (i + 120 < toFetch.length) {
              await new Promise(r => setTimeout(r, 300));
            }
          }
        } else {
          diag.errors.push('no_roblox_tab');
        }

        // 4. Method 2 — Per-item resellers fallback (catalog'da lowestPrice null olanlar için)
        // UGC limited'lar genelde catalog'da off-sale görünür → resellers API'sinden floor çekmek gerekir
        const stillNull = toFetch.filter(id => floors[id] === null || floors[id] === undefined);
        if (stillNull.length > 0 && !diag.rateLimited) {
          const fallbackBatch = stillNull.slice(0, 20); // Maks 20 item (rate-limit koruması)
          for (const id of fallbackBatch) {
            try {
              const r = await fetch(
                `https://economy.roblox.com/v1/assets/${id}/resellers?limit=1`,
                {
                  headers: { 'Accept': 'application/json' },
                  credentials: 'include'
                }
              );
              if (r.status === 429) { diag.rateLimited = true; break; }
              if (r.ok) {
                const d = await r.json();
                const first = (d.data || [])[0];
                const price = (first && typeof first.price === 'number' && first.price > 0)
                  ? first.price
                  : null;
                if (price !== null) {
                  floors[id] = price;
                  sources[id] = 'resellers';
                  cache[id] = { v: price, t: now, s: 'resellers' };
                  diag.resellersOk++;
                } else {
                  diag.resellersNull++;
                }
              }
            } catch (e) {
              diag.errors.push('resellers_' + id + ': ' + e.message);
            }
            await new Promise(r => setTimeout(r, 200));
          }
        }

        // 5. Price history — her item için fresh fiyat geldiyse snapshot kaydet
        let historyChanged = false;
        for (const id of toFetch) {
          const price = floors[id];
          if (price === null || price === undefined) continue;
          if (!history[id]) history[id] = [];
          const last = history[id][history[id].length - 1];
          // En az 10dk arayla snapshot al (storage spam'i engelle)
          if (!last || (now - last.t) >= HISTORY_MIN_INTERVAL || last.p !== price) {
            history[id].push({ p: price, t: now });
            if (history[id].length > HISTORY_MAX_PER_ITEM) {
              history[id] = history[id].slice(-HISTORY_MAX_PER_ITEM);
            }
            historyChanged = true;
          }
        }

        // 6. Storage write — cache ve history (sadece değişiklik varsa)
        const writes = { [FLOOR_CACHE_KEY]: cache };
        if (historyChanged) writes[HISTORY_KEY] = history;
        chrome.storage.local.set(writes);

        sendResponse({ ok: true, floors, sources, diag, rateLimited: diag.rateLimited });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TÜM KATEGORİLERDE LIMITED TARAMA — UGC + Classic limited'ları topla
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Sorun: DOM scan sadece görüntülenen kategorideki item'ları bulur. UGC limited'lar
  // Rolimons'ta yok, sadece DOM'da. Bu yüzden kullanıcı kategori bazında gezerken
  // her zaman eksik veri görür.
  //
  // Çözüm: Roblox'un kendi inventory API'sini kullan:
  //   1. UGC asset type'larının her biri için kullanıcının envanterini getir
  //      (inventory.roblox.com/v2/users/{id}/inventory/{typeId})
  //   2. Topladığın tüm asset ID'lerini catalog details batch endpoint'ine yolla
  //   3. itemRestrictions = ["Limited"|"LimitedUnique"|"Collectible"] olanları al
  //
  // Tek istekte tüm classic + UGC limited'ları döndürür. 10dk cache.
  //
  if (request.action === "fetchUserAllLimiteds") {
    const { userId, forceRefresh } = request;
    let responded = false;
    const respond = (data) => {
      if (responded) return;
      responded = true;
      try { sendResponse(data); }
      catch (e) { console.error('[SW-UGC] sendResponse exception:', e); }
    };

    (async () => {
      const CACHE_KEY = `tracked_ugc_inv_${userId}`;
      const CACHE_TTL = 10 * 60 * 1000; // 10 dakika

      try {
        // Cache hit?
        if (!forceRefresh) {
          const stored = await chrome.storage.local.get(CACHE_KEY);
          const cached = stored[CACHE_KEY];
          if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
            respond({ ok: true, limiteds: cached.limiteds, diag: { fromCache: true, total: cached.limiteds.length } });
            return;
          }
        }

        // Roblox tab bul (MAIN world için)
        let tab = null;
        if (sender?.tab?.id && sender.tab.url && /\.roblox\.com/.test(sender.tab.url)) {
          tab = sender.tab;
        } else {
          const tabs = await chrome.tabs.query({ url: ['*://*.roblox.com/*'] });
          tab = tabs.find(t => t.active && t.status === 'complete')
              || tabs.find(t => t.status === 'complete')
              || tabs[0];
        }
        if (!tab) {
          console.error('[SW-UGC] Roblox tab bulunamadı');
          respond({ ok: false, error: 'no_roblox_tab' });
          return;
        }

        // UGC limited'ların çoğunlukla göründüğü asset type'lar
        // https://create.roblox.com/docs/reference/engine/enums/AssetType
        const UGC_TYPE_IDS = [
          8,   // Hat
          41,  // HairAccessory
          42,  // FaceAccessory
          43,  // NeckAccessory
          44,  // ShoulderAccessory
          45,  // FrontAccessory
          46,  // BackAccessory
          47,  // WaistAccessory
          17,  // Head
          19,  // Gear
          61,  // EmoteAnimation
          27,  // Torso
          28,  // RightArm
          29,  // LeftArm
          30,  // LeftLeg
          31,  // RightLeg
        ];

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: async (userId, typeIds) => {
            // Sorun olduğunda sayfa F12 console'una uyarı/hata bas (info logları kaldırıldı)
            const warn = (...a) => { try { console.warn('[Tracked-UGC]', ...a); } catch {} };
            const err = (...a) => { try { console.error('[Tracked-UGC]', ...a); } catch {} };

            // TOP-LEVEL try/catch — herhangi bir uncaught exception olursa structured response dön
            try {

            // SANITY CHECK — userId valid mi?
            if (!userId || userId === 'null' || userId === 'undefined' || !/^\d+$/.test(String(userId))) {
              err('🚨 GEÇERSİZ userId — inventory API çağrılamaz. userId:', JSON.stringify(userId));
              return {
                limiteds: [], totalAssets: 0, typesWithData: 0, catalogRequests: 0,
                errors: ['invalid_userid: ' + JSON.stringify(userId)],
                privateInventory: false
              };
            }

            const errors = [];
            const allAssetIds = new Set();
            let typesWithData = 0;
            let privateInventory = false;
            let firstApiResp = null; // İlk API çağrısının status'unu sakla (debug için)

            // STEP 1: Kullanıcının her UGC asset type'ı için envanterini getir
            for (const typeId of typeIds) {
              try {
                let cursor = '';
                let pages = 0;
                let typeCount = 0;
                while (pages < 5) { // Type başına maks 500 item
                  const url = `https://inventory.roblox.com/v2/users/${userId}/inventory/${typeId}?limit=100&sortOrder=Desc`
                    + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
                  const res = await fetch(url, { credentials: 'include' });
                  // İlk API çağrısının status'unu sakla (debug için)
                  if (firstApiResp === null) firstApiResp = { typeId, status: res.status, url };
                  if (!res.ok) {
                    if (res.status === 403) {
                      privateInventory = true;
                      throw new Error('private_inventory');
                    }
                    // 400/404'leri de logla — sessizce yutmak debug'ı zorlaştırıyor
                    const bodyText = await res.text().catch(() => '');
                    if (res.status !== 400 && res.status !== 404) {
                      warn(`inv_${typeId} status=${res.status}`, bodyText.slice(0, 200));
                      errors.push(`inv_${typeId}: ${res.status}`);
                    } else if (typeId === typeIds[0]) {
                      // İlk type 400/404 dönerse mutlaka logla (büyük ihtimal userId sorunu)
                      warn(`inv_${typeId} ${res.status} (ilk çağrı)`, bodyText.slice(0, 200));
                      errors.push(`inv_${typeId}_${res.status}: ${bodyText.slice(0, 80)}`);
                    }
                    break;
                  }
                  const data = await res.json();
                  for (const item of (data.data || [])) {
                    if (item.assetId) {
                      allAssetIds.add(String(item.assetId));
                      typeCount++;
                    }
                  }
                  cursor = data.nextPageCursor;
                  if (!cursor) break;
                  pages++;
                  await new Promise(r => setTimeout(r, 80));
                }
                if (typeCount > 0) typesWithData++;
                await new Promise(r => setTimeout(r, 50));
              } catch (e) {
                if (e.message === 'private_inventory') break;
                warn(`type_${typeId} exception:`, e.message);
                errors.push(`type_${typeId}: ${e.message}`);
              }
            }

            if (privateInventory) {
              return {
                limiteds: [],
                totalAssets: 0,
                typesWithData: 0,
                catalogRequests: 0,
                errors,
                privateInventory: true
              };
            }

            // STEP 2: Topladığın tüm ID'leri catalog details batch'e yolla
            //         itemRestrictions'a göre limited olanları filtrele
            const limiteds = [];
            const allIds = [...allAssetIds];

            // ─ SAĞLAM CSRF Token Edinme — 5 katmanlı fallback ─
            const getCsrfRobust = async () => {
              const meta = document.querySelector('meta[name="csrf-token"]')?.content;
              if (meta) return meta;
              try {
                const rbx = window.Roblox?.XsrfToken?.getToken?.();
                if (rbx) return rbx;
              } catch {}
              try {
                const ctx = window.Roblox?.GameLauncher?.csrfToken
                         || window.Roblox?.AppContext?.csrfToken
                         || window.Roblox?.csrfToken;
                if (ctx) return ctx;
              } catch {}
              warn('Meta/JS kaynakları boş, dummy POST ile force-fetch...');
              const dummyEndpoints = [
                'https://auth.roblox.com/v2/logout',
                'https://friends.roblox.com/v1/users/0/follow',
              ];
              for (const url of dummyEndpoints) {
                try {
                  const res = await fetch(url, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                  });
                  const fresh = res.headers.get('x-csrf-token');
                  if (fresh) return fresh;
                } catch (e) { warn(`dummy ${url} exception:`, e.message); }
              }
              err('Hiçbir CSRF kaynağı çalışmadı');
              return '';
            };

            let csrfToken = await getCsrfRobust();
            if (!csrfToken) errors.push('csrf_unobtainable');

            let catalogRequests = 0;
            let catalog403s = 0;
            for (let i = 0; i < allIds.length; i += 120) {
              const batch = allIds.slice(i, i + 120);
              const body = JSON.stringify({
                items: batch.map(id => ({ itemType: 'Asset', id: parseInt(id, 10) }))
              });

              const doPost = async (csrf) => fetch('https://catalog.roblox.com/v1/catalog/items/details', {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'X-CSRF-TOKEN': csrf,
                  'Accept': 'application/json'
                },
                body
              });

              try {
                const batchNum = Math.floor(i/120) + 1;
                let res = await doPost(csrfToken);
                // CSRF retry — 3 attempt'a kadar (Roblox bazen üst üste rotate ediyor)
                let attempt = 0;
                while (res.status === 403 && attempt < 3) {
                  attempt++;
                  catalog403s++;
                  const fresh = res.headers.get('x-csrf-token');
                  let nextToken = null;
                  if (fresh && fresh !== csrfToken) {
                    nextToken = fresh;
                  } else {
                    // Force-fetch yeni token (dummy POST endpoint'leri)
                    nextToken = await getCsrfRobust();
                    if (nextToken === csrfToken) nextToken = null;
                  }
                  if (!nextToken) {
                    err(`Batch ${batchNum} attempt ${attempt}: yeni token alınamadı`);
                    break;
                  }
                  csrfToken = nextToken;
                  res = await doPost(nextToken);
                  if (res.status !== 403) break; // Başarılı veya başka hata
                }
                if (res.status === 429) {
                  warn('Rate-limit (429) — tarama durduruldu');
                  errors.push('catalog_rate_limit');
                  break;
                }
                if (!res.ok) {
                  const bodyText = await res.text().catch(() => '');
                  err(`Batch ${batchNum} fail status=${res.status}`, bodyText.slice(0, 400));
                  errors.push(`catalog_${res.status}: ${bodyText.slice(0, 120)}`);
                  continue;
                }
                catalogRequests++;
                const data = await res.json();
                for (const item of (data.data || [])) {
                  const restrictions = item.itemRestrictions || [];
                  // Classic limited: Limited / LimitedUnique
                  // UGC limited: Collectible
                  const isLimited = restrictions.includes('Limited')
                    || restrictions.includes('LimitedUnique')
                    || restrictions.includes('Collectible');
                  if (isLimited) {
                    limiteds.push({
                      assetId: String(item.id),
                      name: item.name || '',
                      lowestPrice: (typeof item.lowestPrice === 'number' && item.lowestPrice > 0)
                        ? item.lowestPrice : null,
                      restrictions: restrictions,
                      isUGC: restrictions.includes('Collectible'),
                    });
                  }
                }
              } catch (e) {
                errors.push('catalog_err: ' + e.message);
              }

              await new Promise(r => setTimeout(r, 250));
            }

            // 403 sayısını errors'a EKLEMİYORUZ — CSRF token rotation normal davranış,
            // başarılı retry'larda kullanıcıyı rahatsız etmemeli. Sadece yüksek sayıda
            // veya retry'sı da başarısız olan durumlar zaten catalog_${status} ile loglanıyor.
            // İstatistik olarak isteyenler için diag'da ayrı bir field olarak göstereceğiz.

            if (errors.length > 0) warn('UGC tarama errors:', errors);

            return {
              limiteds,
              totalAssets: allAssetIds.size,
              typesWithData,
              catalogRequests,
              csrfRotations: catalog403s, // Informational (errors değil)
              firstApiResp,               // İlk inventory API yanıtı (debug için)
              errors,
              privateInventory: false
            };

            } catch (topErr) {
              // MAIN world içinde unhandled exception — structured response dön
              err('💥 MAIN world TOP-LEVEL exception:', topErr.message, topErr.stack);
              return {
                limiteds: [],
                totalAssets: 0,
                typesWithData: 0,
                catalogRequests: 0,
                errors: ['top_level_exception: ' + topErr.message + ' | stack: ' + (topErr.stack || '').slice(0, 300)],
                privateInventory: false
              };
            }
          },
          args: [String(userId), UGC_TYPE_IDS]
        }).catch(execErr => {
          // "Frame with ID 0 was removed" = kullanıcı sayfadan ayrıldı (race condition).
          // Bu normal davranış, error olarak loglamayalım — sessizce null dön.
          const msg = String(execErr?.message || execErr || '');
          const isFrameRemoved = /frame.*(removed|gone|destroyed)|no tab with id|cannot access/i.test(msg);
          if (!isFrameRemoved) {
            console.error('[SW-UGC] executeScript exception:', execErr);
          }
          return { __frameRemoved: isFrameRemoved };
        });

        // Frame removed durumunda erken çık (zaten kullanıcı yok, response gönderilse de unutulur)
        if (results?.__frameRemoved) {
          respond({ ok: false, error: 'frame_removed', diag: { errors: ['frame_removed'] } });
          return;
        }

        const result = results?.[0]?.result;
        if (!result) {
          // results[0] da olabilir undefined; ya da result undefined olabilir
          const r0 = results?.[0] || {};
          const scriptError = r0.error || (r0.frameId === undefined ? 'no_frame_or_error' : null);
          // Sadece gerçek script hatalarında error logla (no_frame_or_error race condition)
          if (scriptError && scriptError !== 'no_frame_or_error') {
            console.error('[SW-UGC] MAIN world script error:', scriptError, r0);
          }
          respond({
            ok: false,
            error: 'no_main_result',
            diag: {
              errors: [
                'executeScript_returned_null',
                'results_length=' + (results?.length || 0),
                'result0_keys=' + Object.keys(r0).join(','),
                scriptError ? ('script_error: ' + JSON.stringify(scriptError)) : ''
              ].filter(Boolean)
            }
          });
          return;
        }

        const diag = {
          typesScanned: UGC_TYPE_IDS.length,
          typesWithData: result.typesWithData,
          totalAssets: result.totalAssets,
          catalogRequests: result.catalogRequests,
          limitedsFound: result.limiteds.length,
          firstApiResp: result.firstApiResp,
          errors: result.errors,
          privateInventory: result.privateInventory,
          fromCache: false
        };

        // Inventory API hiç response döndürmediyse (network sorunu / extension blocked) uyarı
        if (!result.firstApiResp && !result.privateInventory) {
          console.warn('[SW-UGC] Inventory API\'den hiç yanıt gelmedi — network sorunu olabilir');
          if (!result.errors.includes('no_inventory_response')) {
            result.errors.push('no_inventory_response');
          }
        }

        // FETCH SAĞLIĞI — sadece anlamlı sonuçları cache'le, kötü fetch'leri eski cache'le değiştirme
        const hasCatalogFailure = (result.errors || []).some(e => /^catalog_4\d\d|csrf_unobtainable/.test(e));
        const inventoryEmpty   = (result.totalAssets || 0) === 0;  // ← Yeni kontrol!
        const fetchFailed = hasCatalogFailure || inventoryEmpty;

        // STALE CACHE FALLBACK — Fresh fetch fail olursa (catalog 403 VEYA inventory boş)
        // ve eski cache'de gerçek veri varsa onu döndür
        if (result.limiteds.length === 0 && fetchFailed && !result.privateInventory) {
          try {
            const stored = await chrome.storage.local.get(CACHE_KEY);
            const cached = stored[CACHE_KEY];
            if (cached?.limiteds?.length > 0) {
              const ageMin = Math.floor((Date.now() - cached.fetchedAt) / 60000);
              console.warn('[SW-UGC] Fresh fetch fail → STALE cache kullanılıyor:',
                cached.limiteds.length, 'item,', ageMin, 'dk eski',
                '(catalog_fail:', hasCatalogFailure, 'inventory_empty:', inventoryEmpty + ')');
              diag.usedStaleCache = true;
              diag.staleCacheAge = ageMin;
              respond({ ok: true, limiteds: cached.limiteds, diag });
              return;
            }
          } catch {}
        }

        // CACHE WRITE — sadece sağlıklı sonuçlar cache'lenmeli
        // Eski iyi cache'i kötü fetch ile overwrite etme.
        // Cache'lenecek koşullar:
        //   - limited bulundu (en az 1), VEYA
        //   - inventory API'den asset geldi (taradı, sadece limited yok)
        const shouldCache = !result.privateInventory
          && (result.limiteds.length > 0 || (result.totalAssets > 0 && !hasCatalogFailure));
        if (shouldCache) {
          try {
            await chrome.storage.local.set({
              [CACHE_KEY]: {
                limiteds: result.limiteds,
                fetchedAt: Date.now()
              }
            });
          } catch {}
        } else if (inventoryEmpty && !result.privateInventory) {
          console.warn('[SW-UGC] Inventory API 0 asset döndü — cache yazılmadı (geçici hata olabilir, eski cache korunuyor)');
        }

        respond({ ok: true, limiteds: result.limiteds, diag });
      } catch (e) {
        console.error('[SW-UGC] Handler exception:', e, e?.stack);
        respond({ ok: false, error: e.message, diag: { errors: ['handler_exception: ' + e.message] } });
      }
    })();
    return true;
  }

  // ── Ücretsiz Item Takipi: manuel trigger + history sorgu + ayarlar ──
  if (request.action === "checkFreeItemsNow") {
    // Manuel "Şimdi Tara" — bildirim toggle'ından bağımsız, her zaman tarar
    checkForNewFreeItems(true)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (request.action === "getFreeItemsHistory") {
    chrome.storage.local.get(['tracked_free_items_history', 'tracked_free_items_last_check', 'tracked_free_items_enabled'])
      .then(d => sendResponse({
        ok: true,
        history: d.tracked_free_items_history || [],
        lastCheck: d.tracked_free_items_last_check || 0,
        enabled: d.tracked_free_items_enabled !== false,
      }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (request.action === "setFreeItemsEnabled") {
    chrome.storage.local.set({ tracked_free_items_enabled: !!request.enabled })
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  // Mevcut history'deki item'ları catalog'dan re-verify et — hala ücretsiz mi?
  // Expired/off-sale olanları sil + eksik thumbnail'leri Thumbnails API'sinden al.
  if (request.action === "verifyFreeItemsHistory") {
    (async () => {
      try {
        const stored = await chrome.storage.local.get('tracked_free_items_history');
        const history = stored.tracked_free_items_history || [];
        if (history.length === 0) {
          sendResponse({ ok: true, history: [] });
          return;
        }

        const ids = history.map(it => String(it.id));

        // Roblox tab bul (MAIN world catalog details için)
        let tab = null;
        if (sender?.tab?.id && /\.roblox\.com/.test(sender.tab.url || '')) {
          tab = sender.tab;
        } else {
          const tabs = await chrome.tabs.query({ url: ['*://*.roblox.com/*'] });
          tab = tabs.find(t => t.active) || tabs[0];
        }
        if (!tab) {
          // Tab yoksa thumbnails'i çek ama status check yapma — eski history dönsün
          const thumbMap = await fetchItemThumbnails(ids);
          const enriched = history.map(it => ({
            ...it,
            imageUrl: thumbMap[String(it.id)] || it.imageUrl || null,
          }));
          sendResponse({ ok: true, history: enriched, partial: true });
          return;
        }

        // MAIN world: catalog details (CSRF gerekli, fetchUserAllLimiteds ile aynı pattern)
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: async (itemIds) => {
            const getCsrfRobust = async () => {
              const meta = document.querySelector('meta[name="csrf-token"]')?.content;
              if (meta) return meta;
              try {
                const rbx = window.Roblox?.XsrfToken?.getToken?.();
                if (rbx) return rbx;
              } catch {}
              try {
                const r = await fetch('https://auth.roblox.com/v2/logout', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json' }, body: '{}'
                });
                return r.headers.get('x-csrf-token') || '';
              } catch { return ''; }
            };

            const detailsMap = {};
            let csrf = await getCsrfRobust();
            for (let i = 0; i < itemIds.length; i += 120) {
              const batch = itemIds.slice(i, i + 120);
              const body = JSON.stringify({
                items: batch.map(id => ({ itemType: 'Asset', id: parseInt(id, 10) }))
              });
              const doPost = (token) => fetch('https://catalog.roblox.com/v1/catalog/items/details', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token, 'Accept': 'application/json' },
                body
              });
              try {
                let res = await doPost(csrf);
                if (res.status === 403) {
                  const fresh = res.headers.get('x-csrf-token');
                  if (fresh && fresh !== csrf) { csrf = fresh; res = await doPost(fresh); }
                  else { const t = await getCsrfRobust(); if (t && t !== csrf) { csrf = t; res = await doPost(t); } }
                }
                if (!res.ok) continue;
                const data = await res.json();
                for (const item of (data.data || [])) {
                  detailsMap[String(item.id)] = item;
                }
              } catch {}
            }
            return detailsMap;
          },
          args: [ids]
        }).catch(() => null);

        const detailsMap = results?.[0]?.result || {};
        const thumbMap = await fetchItemThumbnails(ids);

        // GÜVENLİK: catalog details çağrısı TAMAMEN başarısızsa (detailsMap boş — CSRF/rate-limit/
        // network) history'i SİLME, olduğu gibi döndür. Aksi halde tek bir API hatası tüm listeyi
        // siliyordu ("bildirim geldi ama panel boş" sorunu).
        if (Object.keys(detailsMap).length === 0) {
          const keepAll = history.map(it => ({ ...it, imageUrl: thumbMap[String(it.id)] || it.imageUrl || null }));
          await chrome.storage.local.set({ tracked_free_items_history: keepAll });
          sendResponse({ ok: true, history: keepAll, partial: true });
          return;
        }

        // PHASE 1: details DÖNEN item'ları ele. details DÖNMEYEN'i KORU (API bu çağrıda döndürmemiş
        // olabilir → false-negative ile silme); det var ama free değilse SİL (gerçekten off-sale).
        let candidates = [];
        const kept = [];
        for (const it of history) {
          const det = detailsMap[String(it.id)];
          if (!det) { kept.push(it); continue; }
          if (!isItemActuallyFree(det)) continue;
          candidates.push({ ...det, _historyEntry: it });
        }

        // PHASE 2: Collectible item'lar için marketplace API ile GERÇEK stok bilgisi al
        candidates = await enrichCollectibleStock(candidates);

        // PHASE 3: Enriched data ile tekrar filtrele (gerçek stok)
        const refreshed = [];
        for (const det of candidates) {
          if (!isItemActuallyFree(det)) continue;
          const it = det._historyEntry;
          refreshed.push({
            id: it.id,
            name: det.name || it.name,
            creatorName: det.creatorName || it.creatorName,
            imageUrl: thumbMap[String(it.id)] || it.imageUrl || null,
            saleLocationType: det.saleLocationType || it.saleLocationType || 'NotApplicable',
            saleLocation: det.saleLocation || it.saleLocation || null,
            unitsAvailable: det.marketplaceData?.unitsAvailable ?? det.unitsAvailable ?? null,
            unitsAvailableForConsumption: det.marketplaceData?.unitsAvailableForConsumption ?? det.unitsAvailableForConsumption ?? null,
            isLowStock: isItemLowStock(det),
            detectedAt: it.detectedAt,
          });
        }
        // details DÖNMEYEN ama silmediğimiz item'ları cached haliyle koru (false-negative önle)
        for (const it of kept) {
          refreshed.push({ ...it, imageUrl: thumbMap[String(it.id)] || it.imageUrl || null });
        }

        // Storage'a kaydet (cleaned + enriched)
        await chrome.storage.local.set({ tracked_free_items_history: refreshed });

        sendResponse({
          ok: true,
          history: refreshed,
          removed: history.length - refreshed.length
        });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  // Price history sorgu — son N gün için trend hesabı (UI tarafında kullanılır)
  if (request.action === "getPriceHistory") {
    const { assetIds } = request;
    (async () => {
      try {
        const stored = await chrome.storage.local.get('tracked_price_history');
        const history = stored.tracked_price_history || {};
        const out = {};
        for (const id of (assetIds || [])) {
          out[String(id)] = history[String(id)] || [];
        }
        sendResponse({ ok: true, history: out });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  // Envanter RAC: item görselleri — Roblox Thumbnails API (public, auth yok)
  if (request.action === "fetchItemThumbnails") {
    const { assetIds } = request;
    (async () => {
      try {
        if (!assetIds?.length) { sendResponse({ ok: true, map: {} }); return; }
        const map = {};
        for (let i = 0; i < assetIds.length; i += 100) {
          const batch = assetIds.slice(i, i + 100).join(',');
          const url = `https://thumbnails.roblox.com/v1/assets?assetIds=${batch}&size=75x75&format=Png&isCircular=false`;
          const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (!r.ok) continue;
          const json = await r.json();
          for (const it of (json.data || [])) {
            if (it.state === 'Completed' && it.imageUrl) map[String(it.targetId)] = it.imageUrl;
          }
        }
        sendResponse({ ok: true, map });
      } catch { sendResponse({ ok: false }); }
    })();
    return true;
  }

  // Envanter RAC: giriş yapan kullanıcı ID'si — MAIN world'den
  if (request.action === "getAuthUserId") {
    const tabId = sender?.tab?.id;
    (async () => {
      try {
        // MAIN world: Roblox global veya authenticated API
        if (tabId) {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: async () => {
              try {
                const uid = window.Roblox?.CurrentUser?.userId
                  || window.Roblox?.sessionInfo?.userId;
                if (uid) return { ok: true, userId: uid };
                const res = await fetch('https://users.roblox.com/v1/users/authenticated', {
                  credentials: 'include', headers: { 'Accept': 'application/json' }
                });
                if (!res.ok) return { ok: false, status: res.status };
                const d = await res.json();
                return { ok: true, userId: d.id, name: d.name };
              } catch (e) { return { ok: false, error: String(e) }; }
            },
            args: []
          });
          const result = results?.[0]?.result;
          if (result?.ok) { sendResponse(result); return; }
        }
        // SW direkt fetch fallback
        const res = await fetch('https://users.roblox.com/v1/users/authenticated', { credentials: 'include' });
        if (!res.ok) { sendResponse({ ok: false, status: res.status }); return; }
        const d = await res.json();
        sendResponse({ ok: true, userId: d.id, name: d.name });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  // ── OYUNCU İÇGÖRÜ PANELİ (Profil sayfası) — künye + sosyal sayımlar + presence + rozet ──
  // Tek mesajda CORS-bypass batch. Her alan hata-toleranslı (başarısız → null → panel o satırı gizler).
  if (request.action === "getUserProfileInsight") {
    const uid = String(request.userId || '').replace(/\D/g, '');
    (async () => {
      if (!uid) { sendResponse({ ok: false, error: 'no_userId' }); return; }
      const jget = async (url) => {
        try {
          const r = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'include' });
          if (!r.ok) return null;
          return await r.json();
        } catch { return null; }
      };
      // Presence: POST + CSRF challenge (popup loadFriends deseni)
      const fetchPresence = async () => {
        const body = JSON.stringify({ userIds: [Number(uid)] });
        const doPost = (csrf) => fetch('https://presence.roblox.com/v1/presence/users', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
          body
        });
        try {
          let r = await doPost();
          if (r.status === 403 && r.headers.get('x-csrf-token')) r = await doPost(r.headers.get('x-csrf-token'));
          if (!r.ok) return null;
          const d = await r.json();
          return d?.userPresences?.[0] || null;
        } catch { return null; }
      };

      const [info, names, fc, foc, fic, badges, pres] = await Promise.all([
        jget(`https://users.roblox.com/v1/users/${uid}`),
        jget(`https://users.roblox.com/v1/users/${uid}/username-history?limit=25&sortOrder=Desc`),
        jget(`https://friends.roblox.com/v1/users/${uid}/friends/count`),
        jget(`https://friends.roblox.com/v1/users/${uid}/followers/count`),
        jget(`https://friends.roblox.com/v1/users/${uid}/followings/count`),
        jget(`https://badges.roblox.com/v1/users/${uid}/badges?limit=100&sortOrder=Desc`),
        fetchPresence()
      ]);

      sendResponse({
        ok: !!info,
        user: info ? {
          id: info.id, name: info.name, displayName: info.displayName,
          created: info.created || null, isBanned: !!info.isBanned,
          hasVerifiedBadge: !!info.hasVerifiedBadge
        } : null,
        usernameHistory: Array.isArray(names?.data) ? names.data.map(x => x.name).filter(Boolean) : [],
        counts: {
          friends: typeof fc?.count === 'number' ? fc.count : null,
          followers: typeof foc?.count === 'number' ? foc.count : null,
          followings: typeof fic?.count === 'number' ? fic.count : null
        },
        badges: badges ? { count: (badges.data || []).length, hasMore: !!badges.nextPageCursor } : null,
        presence: pres ? {
          type: pres.userPresenceType, lastLocation: pres.lastLocation || '',
          placeId: pres.placeId || pres.rootPlaceId || null, gameId: pres.gameId || null, universeId: pres.universeId || null
        } : null
      });
    })();
    return true;
  }

  // Profil: seninle ORTAK arkadaş sayısı (benim arkadaş listem ∩ profilin arkadaş listesi)
  if (request.action === "getMutualFriendCount") {
    const uid = String(request.userId || '').replace(/\D/g, '');
    (async () => {
      if (!uid) { sendResponse({ ok: false }); return; }
      try {
        const me = await fetch('https://users.roblox.com/v1/users/authenticated', { credentials: 'include' })
          .then(r => r.ok ? r.json() : null).catch(() => null);
        if (!me?.id) { sendResponse({ ok: false }); return; }
        if (String(me.id) === uid) { sendResponse({ ok: true, self: true, mutual: null }); return; }
        const [mine, theirs] = await Promise.all([
          fetch(`https://friends.roblox.com/v1/users/${me.id}/friends`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`https://friends.roblox.com/v1/users/${uid}/friends`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (!Array.isArray(mine?.data) || !Array.isArray(theirs?.data)) { sendResponse({ ok: false }); return; }
        const mineSet = new Set(mine.data.map(f => f.id));
        const mutual = theirs.data.filter(f => mineSet.has(f.id));
        sendResponse({ ok: true, mutual: mutual.length, sample: mutual.slice(0, 3).map(f => f.displayName || f.name) });
      } catch { sendResponse({ ok: false }); }
    })();
    return true;
  }

  // ── ŞU AN ÇALIYOR (medya widget) — youtube/yt-music/spotify sekmelerinden now-playing + kontrol ──
  // Opt-in: SW yalnız content script istek atınca (özellik açıkken) medya sekmelerine dokunur.
  // Performans: audible ön-filtre + son çalan sekme önbelleği (self._mediaLastTabId) → her seferde tüm tarama yok.
  if (request.action === "mediaGetNowPlaying") {
    (async () => {
      try {
        // Offscreen oynatıcı aktifse onun durumunu döndür (gizli iframe — sekme taraması yapma)
        if (self._offActive) {
          const r = await chrome.runtime.sendMessage({ off: 'state' }).catch(() => null);
          const st = r && r.state;
          if (st && (st.title || st.videoId)) {
            sendResponse({ ok: true, media: {
              title: st.title || '', artist: (st.author || '').replace(/\s*-\s*Topic\s*$/i, ''), album: '',
              artwork: st.videoId ? `https://i.ytimg.com/vi/${st.videoId}/mqdefault.jpg` : '',
              playing: !!st.playing, position: st.position || 0, duration: st.duration || 0,
              host: 'www.youtube.com', volume: st.volume != null ? st.volume : 100, muted: !!st.muted, tabId: -1
            } });
            return;
          }
        }
        const PATTERNS = ['*://open.spotify.com/*', '*://music.youtube.com/*', '*://*.youtube.com/*'];
        const isMedia = (t) => t && t.url && /(open\.spotify\.com|music\.youtube\.com|youtube\.com)/.test(t.url);
        const [audible, all] = await Promise.all([
          chrome.tabs.query({ audible: true }).catch(() => []),
          chrome.tabs.query({ url: PATTERNS }).catch(() => [])
        ]);
        const seen = new Set(); const cand = [];
        const add = (t) => { if (isMedia(t) && !seen.has(t.id)) { seen.add(t.id); cand.push(t); } };
        audible.forEach(add);                                   // ses çıkaranlar önce
        if (self._mediaLastTabId) add(all.find(t => t.id === self._mediaLastTabId)); // sonra önbellek
        all.forEach(add);                                       // sonra diğer medya sekmeleri
        if (!cand.length) { self._mediaLastTabId = null; sendResponse({ ok: true, media: null }); return; }

        const readFn = () => {
          try {
            const h = location.hostname;
            // PATH KAPISI: youtube.com'da yalnız gerçek izleme sayfaları — ana sayfa/arama/önizleme/masthead reklamı DEĞİL
            if (h.indexOf('youtube') >= 0 && h.indexOf('music.youtube') < 0) {
              if (!/^\/(watch|shorts|embed)/.test(location.pathname)) return null;
            }
            const ms = navigator.mediaSession, md = ms && ms.metadata;
            // GERÇEK now-playing sinyali: mediaSession.metadata + başlık ZORUNLU.
            // Bu, tarayıcının OS medya kutusunu besleyen resmî sinyali — siteler bunu yalnız kullanıcının
            // SEÇTİĞİ gerçek oynatma için doldurur; ana sayfa önizlemeleri ve reklamların çoğu doldurmaz.
            if (!md || !md.title) return null;
            // Ana oynatıcıyı seç (önizleme/reklam videolarını değil)
            const el = (h.indexOf('youtube') >= 0)
              ? (document.querySelector('.html5-main-video') || document.querySelector('video.video-stream') || document.querySelector('video'))
              : document.querySelector('video, audio');
            let art = '';
            if (md.artwork && md.artwork.length) {
              let best = md.artwork[0];
              for (const a of md.artwork) {
                const s = parseInt((a.sizes || '0').split('x')[0], 10) || 0;
                const bs = parseInt((best.sizes || '0').split('x')[0], 10) || 0;
                if (s > bs) best = a;
              }
              art = best.src || '';
            }
            const playing = el ? !el.paused : (ms.playbackState === 'playing');
            return {
              title: String(md.title || '').trim(), artist: String(md.artist || '').trim(),
              album: md.album || '', artwork: art, playing: !!playing,
              position: el && isFinite(el.currentTime) ? el.currentTime : null,
              duration: el && isFinite(el.duration) ? el.duration : null, host: h,
              volume: el ? Math.round((el.volume != null ? el.volume : 1) * 100) : null,
              muted: el ? !!el.muted : false
            };
          } catch (e) { return null; }
        };

        let pausedFallback = null, chosen = null;
        for (const t of cand) {
          let r = null;
          try { const out = await chrome.scripting.executeScript({ target: { tabId: t.id }, world: 'MAIN', func: readFn }); r = out && out[0] && out[0].result; }
          catch (_) {}
          if (r) { r.tabId = t.id; if (r.playing) { chosen = r; break; } if (!pausedFallback) pausedFallback = r; }
        }
        chosen = chosen || pausedFallback;
        self._mediaLastTabId = chosen ? chosen.tabId : null;
        sendResponse({ ok: true, media: chosen || null });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  if (request.action === "mediaControl") {
    const { cmd, value, tabId } = request;
    (async () => {
      try {
        // Offscreen oynatıcı aktifse komutu ona yönlendir (gizli iframe)
        if (self._offActive) { try { await chrome.runtime.sendMessage({ off: 'cmd', cmd, value }); } catch (_) {} sendResponse({ ok: true, offscreen: true }); return; }
        const tid = tabId || self._mediaLastTabId;
        if (!tid) { sendResponse({ ok: false, reason: 'no-tab' }); return; }
        // allFrames: YouTube oynatıcısı bazen alt frame'de (örn. gömülü/eski düzen) → tüm frame'lere uygula
        const res = await chrome.scripting.executeScript({
          // value undefined ise null gönder — undefined args'ta serileştirilemez (tüm çağrı patlar)
          target: { tabId: tid, allFrames: true }, world: 'MAIN', args: [cmd, value === undefined ? null : value],
          func: (cmd, value) => {
            const info = { cmd, host: location.hostname, top: window.top === window, did: null };
            try {
              const h = location.hostname;
              const isYT = h.indexOf('youtube') >= 0;
              const el = isYT
                ? (document.querySelector('.html5-main-video') || document.querySelector('video.video-stream') || document.querySelector('video'))
                : document.querySelector('video, audio');
              // Oynatıcı API'si: #movie_player (yt/yt-music) ya da .html5-video-player
              const mp = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
              const mpApi = !!(mp && typeof mp.playVideo === 'function');
              info.hasEl = !!el; info.hasMP = !!mp; info.mpApi = mpApi; info.elPaused = el ? el.paused : null;
              // Yalnız GERÇEK oynatıcı frame'inde aksiyon al: oynatıcı API'si olan ya da üst frame + video.
              // Böylece reklam/gömülü alt-frame'ler komuta tepki verip çift-toggle yapmaz.
              const mayAct = mpApi || (window.top === window && !!el);
              if (!mayAct) { info.did = 'skip'; return info; }
              const click = (sel) => { const b = document.querySelector(sel); if (b) { b.click(); return sel; } return null; };
              const SEL = h.indexOf('spotify') >= 0
                ? { toggle: '[data-testid="control-button-playpause"]', next: '[data-testid="control-button-skip-forward"]', prev: '[data-testid="control-button-skip-back"]' }
                : (h.indexOf('music.youtube') >= 0
                  ? { toggle: '#play-pause-button', next: 'tp-yt-paper-icon-button.next-button', prev: 'tp-yt-paper-icon-button.previous-button' }
                  : { toggle: '.ytp-play-button', next: '.ytp-next-button', prev: '.ytp-prev-button' });

              if (cmd === 'play' || cmd === 'pause') {
                const want = (cmd === 'play');
                if (mpApi) { want ? mp.playVideo() : mp.pauseVideo(); info.did = 'mpApi'; }
                else if (el) {
                  try { want ? el.play() : el.pause(); info.did = 'el'; } catch (_) {}
                  if (want ? el.paused : !el.paused) { const c = click(SEL.toggle); if (c) info.did = 'el+btn'; } // hâlâ yanlışsa buton
                } else { const c = click(SEL.toggle); info.did = c ? 'btn' : 'none'; }
              }
              else if (cmd === 'next') {
                if (mpApi && typeof mp.nextVideo === 'function') { mp.nextVideo(); info.did = 'mp.next'; }
                else { const c = click(SEL.next); info.did = c ? 'btn.next' : 'no-next'; }
              }
              else if (cmd === 'prev') {
                // Standart oynatıcı davranışı: 3sn'den ileriyse mevcut şarkıyı başa sar; başındaysa önceki şarkı.
                const atStart = !el || !isFinite(el.currentTime) || el.currentTime <= 3;
                if (mpApi) {
                  if (!atStart && typeof mp.seekTo === 'function') { mp.seekTo(0, true); info.did = 'mp.restart'; }
                  else if (typeof mp.previousVideo === 'function') { mp.previousVideo(); info.did = 'mp.prev'; }
                  else if (el) { el.currentTime = 0; info.did = 'el.restart'; }
                } else {
                  // Spotify/diğer: site butonu zaten restart-veya-önceki mantığını uygular
                  const c = click(SEL.prev); info.did = c ? 'btn.prev' : (el ? (el.currentTime = 0, 'el.restart') : 'no-prev');
                }
              }
              else if (cmd === 'seek' && isFinite(value)) {
                if (mpApi && typeof mp.seekTo === 'function') { mp.seekTo(value, true); info.did = 'mp.seek'; }
                else if (el) { el.currentTime = value; info.did = 'el.seek'; }
              }
              else if (cmd === 'volume' && isFinite(value)) {
                const v = Math.max(0, Math.min(100, value));
                let done = false;
                // YouTube / YT Music: oynatıcı API
                if (mpApi && typeof mp.setVolume === 'function') { try { mp.setVolume(v); if (v > 0 && mp.unMute) mp.unMute(); done = true; } catch (_) {} }
                // YT Music: ses paper-slider'ı
                const ps = document.querySelector('tp-yt-paper-slider#volume-slider, #volume-slider');
                if (ps) { try { ps.value = v; ps.dispatchEvent(new CustomEvent('immediate-value-change', { bubbles: true })); ps.dispatchEvent(new CustomEvent('value-change', { bubbles: true })); done = true; } catch (_) {} }
                // Spotify: gizli range input (React kontrollü → native setter + input event)
                const sp = document.querySelector('[data-testid="volume-bar"] input[type="range"]');
                if (sp) { try { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(sp, String(v / 100)); sp.dispatchEvent(new Event('input', { bubbles: true })); sp.dispatchEvent(new Event('change', { bubbles: true })); done = true; } catch (_) {} }
                // Genel medya elementi (yedek)
                if (el) { try { el.volume = v / 100; if (v > 0) el.muted = false; } catch (_) {} }
                info.did = done ? 'vol' : 'vol.el';
              }
              else if (cmd === 'mute') {
                if (h.indexOf('spotify') >= 0) { const mb = document.querySelector('[data-testid="volume-bar-toggle-mute-button"], button[aria-label="Mute"], button[aria-label="Sessize al"], button[aria-label="Unmute"]'); if (mb) { mb.click(); info.did = 'sp.mute'; } else if (el) { el.muted = !el.muted; info.did = 'mute'; } }
                else if (mpApi && typeof mp.isMuted === 'function') { mp.isMuted() ? mp.unMute() : mp.mute(); info.did = 'mp.mute'; }
                else if (el) { el.muted = !el.muted; info.did = 'mute'; }
              }
            } catch (e) { info.err = String((e && e.message) || e); }
            return info;
          }
        });
        // Oynatıcıyı bulan frame'i öne al (reklam/alt-frame'leri ele)
        const frames = (res || []).map(r => r && r.result).filter(Boolean);
        const acted = frames.find(f => f.did && f.did !== 'none' && f.did !== 'no-next' && f.did !== 'no-prev' && f.did !== 'skip');
        sendResponse({ ok: true, info: acted || frames[0] || null });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  if (request.action === "mediaFocusTab") {
    (async () => {
      try {
        const tid = request.tabId || self._mediaLastTabId;
        if (!tid) { sendResponse({ ok: false }); return; }
        const tab = await chrome.tabs.get(tid).catch(() => null);
        if (tab) { await chrome.tabs.update(tid, { active: true }); if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true, state: 'normal' }).catch(() => {}); } // gizli pencereyi geri aç
        sendResponse({ ok: true });
      } catch (e) { sendResponse({ ok: false }); }
    })();
    return true;
  }

  // ── Hızlı açma: YouTube / YT Music / Spotify'ı ARKA PLANDA sekmede aç (varsa yeniden kullan, çoğaltma) ──
  if (request.action === "mediaOpenSite") {
    (async () => {
      try {
        const URLS = { youtube: 'https://www.youtube.com/', ytmusic: 'https://music.youtube.com/', spotify: 'https://open.spotify.com/' };
        const url = URLS[request.site];
        if (!url) { sendResponse({ ok: false }); return; }
        const tabs = await chrome.tabs.query({}).catch(() => []);
        const match = (u) => {
          if (!u) return false;
          if (request.site === 'ytmusic') return /music\.youtube\.com/.test(u);
          if (request.site === 'youtube') return /(^|\.)youtube\.com/.test(u) && !/music\.youtube\.com/.test(u);
          return /open\.spotify\.com/.test(u);
        };
        const ex = tabs.find(t => match(t.url));
        if (ex) { sendResponse({ ok: true, reused: true, tabId: ex.id }); } // arka planda — zaten açık, odak çalmadan bırak
        else { const t = await chrome.tabs.create({ url, active: false }); sendResponse({ ok: true, created: true, tabId: t.id }); }
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  // ── Widget-içi arama. Strateji: AÇIK sekme varsa onun SAYFA CONTEXT'inde ara (yeni sekme yok, güvenilir);
  //    yoksa YouTube=headless (sekme açmaz), YTM/Spotify=tek seferlik gizli arka plan işçi sekme. "_site"=sitede aç. ──
  if (request.action === "mediaSearch") {
    (async () => {
      const q = String(request.query || '').trim();
      const source = request.source || 'youtube';
      if (!q) { sendResponse({ ok: false }); return; }
      try {
        if (source.endsWith('_site')) {
          const base = source.replace('_site', '');
          const url = base === 'ytmusic' ? `https://music.youtube.com/search?q=${encodeURIComponent(q)}`
            : base === 'spotify' ? `https://open.spotify.com/search/${encodeURIComponent(q)}`
            : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
          const ex = await npFindSiteTab(base);
          if (ex) await chrome.tabs.update(ex.id, { url, active: true }); else await chrome.tabs.create({ url, active: true });
          sendResponse({ ok: true, opened: true });
          return;
        }
        // 1) Zaten açık sekme varsa onun sayfa context'inde ara (en güvenilir, sekme açmaz)
        const open = await npFindSiteTab(source);
        if (open) {
          const r = await npSearchInTab(open.id, source, q);
          if (r && r.ok && (r.results || []).length) { sendResponse(r); return; }
        }
        // 2) Açık sekme yoksa/başarısızsa → HEADLESS (hiç sekme AÇMADAN)
        if (source === 'youtube') { sendResponse(await npYoutubeHeadless(q)); return; }
        if (source === 'ytmusic') {
          // music.youtube.com SW fetch'i "eski tarayıcı" sayfası döndürüyor (UA) → headless YTM güvenilmez.
          // Güvenilir yedek: YouTube araması (gerçek müzik sonuçları), ama YT Music'te çal (target=ytmusic).
          let r = await npYtmHeadless(q);
          if (!r || !r.ok || !(r.results || []).length) {
            const yt = await npYoutubeHeadless(q);
            if (yt && yt.ok && (yt.results || []).length) { yt.results.forEach(c => { c.target = 'ytmusic'; }); r = yt; }
          }
          sendResponse(r || { ok: false }); return;
        }
        if (source === 'spotify') { sendResponse(await npSpHeadless(q)); return; }
        sendResponse({ ok: false });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  // ── Widget'tan seçilen videoyu çal: çalma sekmesi zaten varsa player API ile ARKA PLANDA yükle (flash YOK);
  //    yoksa ilk kez foreground'da başlat (tek seferlik kısa flash). Garanti çalar (tam izleme sayfası). ──
  if (request.action === "mediaPlayYouTube") {
    (async () => {
      const id = String(request.videoId || '').replace(/[^\w-]/g, '');
      if (!id) { sendResponse({ ok: false }); return; }
      const ytm = request.target === 'ytmusic';
      try {
        self._offActive = false;
        // Mevcut çalma sekmesi YouTube/YT Music'teyse: sayfayı yenilemeden player API ile yeni videoyu yükle → flash YOK
        let tab = self._mediaPlayTab != null ? await chrome.tabs.get(self._mediaPlayTab).catch(() => null) : null;
        if (tab) {
          const sameSite = ytm ? /music\.youtube\.com/.test(tab.url || '') : (/(^|\.)youtube\.com/.test(tab.url || '') && !/music\.youtube\.com/.test(tab.url || ''));
          if (sameSite) {
            const res = await chrome.scripting.executeScript({
              target: { tabId: tab.id }, world: 'MAIN', args: [id],
              func: (vid) => { try { const mp = document.querySelector('#movie_player'); if (mp && mp.loadVideoById) { mp.loadVideoById(vid); try { if (mp.isMuted && mp.isMuted()) mp.unMute(); } catch (_) {} return true; } return false; } catch (_) { return false; } }
            }).catch(() => null);
            if (res && res[0] && res[0].result) { self._mediaLastTabId = tab.id; sendResponse({ ok: true, mode: 'bg-api' }); return; }
          }
        }
        // İlk kez / player yok → foreground'da başlat (tek seferlik kısa flash)
        const url = (ytm ? `https://music.youtube.com/watch?v=${id}` : `https://www.youtube.com/watch?v=${id}`) + '&autoplay=1';
        npPlayInWindow(url, id);
        sendResponse({ ok: true, mode: 'fg' });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  // ── Spotify parçası: DRM yüzünden arka planda çaldıramayız → parçayı aç + ÖNE getir (kullanıcı orada oynatır) ──
  if (request.action === "mediaOpenTrack") {
    (async () => {
      const url = String(request.url || '');
      if (!/^https:\/\/open\.spotify\.com\//.test(url)) { sendResponse({ ok: false }); return; }
      self._offActive = false; try { chrome.runtime.sendMessage({ off: 'stop' }).catch(() => {}); } catch (_) {} // Spotify'a geçiş → offscreen YouTube'u durdur
      try {
        const tabs = await chrome.tabs.query({}).catch(() => []);
        let tab = tabs.find(t => /open\.spotify\.com/.test(t.url || ''));
        if (tab) { await chrome.tabs.update(tab.id, { url, active: true }); if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {}); }
        else { tab = await chrome.tabs.create({ url, active: true }); }
        self._mediaLastTabId = tab.id;
        sendResponse({ ok: true, tabId: tab.id });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  // ── OYUN KODLARI — dürüst kaynaklar (küratörlü repo + açıklama + resmi sosyal linkler + web araması) ──
  if (request.action === "getGameCodes") {
    (async () => {
      try {
        const placeId = String(request.placeId || '').replace(/\D/g, '');
        if (!placeId) { sendResponse({ ok: false }); return; }
        const universeId = await gcGetUniverse(placeId);
        const details = universeId ? await gcGetDetails(universeId) : null;
        const name = (details && details.name) || request.name || '';
        const [socials, repo] = await Promise.all([
          universeId ? gcGetSocials(universeId) : Promise.resolve([]),
          gcGetRepoCodes(name)
        ]);
        const descCodes = gcScanDescription(details && details.description);
        const map = new Map();
        const add = (c) => { const k = c.code.toUpperCase(); if (!map.has(k)) map.set(k, c); };
        if (repo) repo.codes.forEach(add);
        descCodes.forEach(add);
        const yr = new Date().getFullYear();
        sendResponse({
          ok: true, name, universeId,
          codes: Array.from(map.values()),
          repoUrl: repo ? `https://github.com/Progameguides/Roblox-Games-Codes/blob/main/codes/${repo.file}` : null,
          socials: (socials || []).map(s => ({ type: s.type, url: s.url, title: s.title })),
          searchUrl: `https://www.google.com/search?q=${encodeURIComponent(name + ' roblox codes ' + yr)}`
        });
      } catch (e) { sendResponse({ ok: false, error: e.message }); }
    })();
    return true;
  }

  // ── SUNUCU BEKÇİSİ (Server Watch): TEK oyun — aynı anda yalnızca bir oyun izlenir ──
  if (request.action === "startServerWatch") {
    (async () => {
      const w = {
        placeId: Number(request.placeId),
        gameTitle: request.gameTitle || ("Place " + request.placeId),
        maxPlayers: Math.max(0, Number(request.maxPlayers) || 0),  // oyun kapasitesi (gösterim); 0 = bilinmiyor
        minPlayers: Math.max(1, Number(request.minPlayers) || 1),  // HEDEF (en az X oyuncu)
        action: request.watchAction === 'autojoin' ? 'autojoin' : 'notify',
        startedAt: Date.now(), checks: 0
      };
      await chrome.storage.local.set({ tracked_server_watch: w });
      chrome.alarms.create('serverWatch', { periodInMinutes: 1 });
      // Başlangıç onayı — bildirim kanalının çalıştığını ANINDA doğrular + izlemenin aktif olduğunu gösterir.
      try {
        chrome.notifications.create(`tracked_watchstart_${Date.now()}`, {
          type: 'basic', iconUrl: 'icons/icon128.png', title: 'Sunucu Bekçisi — Aktif',
          message: `${w.gameTitle}: izleme başladı (hedef: en az ${w.minPlayers} oyuncu). Uygun + sana yakın bir sunucu açılınca haber verilecek.`,
          priority: 1
        });
      } catch (_) {}
      runServerWatchCheck(); // hemen ilk kontrol
      sendResponse({ ok: true, watch: w });
    })();
    return true;
  }
  if (request.action === "stopServerWatch") {
    (async () => { await stopServerWatchInternal(); sendResponse({ ok: true }); })();
    return true;
  }
  if (request.action === "getServerWatch") {
    (async () => {
      const { tracked_server_watch: w } = await chrome.storage.local.get('tracked_server_watch');
      const pid = Number(request.placeId);
      // watch = bu oyunun bekçisi (varsa); active = HANGİ oyun olursa olsun aktif bekçi (modal uyarısı + popup widget için)
      const thisGame = (w && pid && Number(w.placeId) === pid) ? w : null;
      sendResponse({ ok: true, watch: thisGame, active: w || null });
    })();
    return true;
  }

  // ── Belirli sunucunun bölgesini çöz (jobId → join-game-instance → UdmuxEndpoints IP → şehir) ──
  // İstemci UA'sı (DNR) ile SW'den çağrılır; tkResolveServerRegion önbelleği yönetir.
  if (request.action === "resolveServerRegion") {
    tkResolveServerRegion(request.placeId, request.jobId)
      .then(r => sendResponse(r))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // ── Bölgesel ping'leri arka planda ölç (otomatik, 30dk cache) → tracked_region_pings ──
  if (request.action === "ensureRegionalPings") {
    tkEnsureRegionalPings(request.force)
      .then(r => sendResponse(r))
      .catch(e => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  }

  // ── Kullanıcı konumu — mesafe hesabı için (tkResolveUserGeo: cache + çoklu kaynak) ──────────
  if (request.action === "resolveUserLocation") {
    tkResolveUserGeo()
      .then(r => sendResponse(r || { ok: false, error: 'geo_failed' }))
      .catch(e => sendResponse({ ok: false, error: e?.message || 'geo_error' }));
    return true;
  }

  // ── Kullanıcı bölgesi (Roblox matchmaker) — IP-geo engelliyse/erişilemezse AD-BLOCKER-PROOF fallback.
  // gamejoin'i gameId'siz çağır → Roblox seni KENDİ bölgendeki sunucuya yönlendirir → o datacenter = senin bölgen.
  if (request.action === "resolveMyRegion") {
    const GEO_TTL = 7 * 24 * 60 * 60 * 1000;
    (async () => {
      try {
        const { tracked_user_geo: geo } = await chrome.storage.local.get('tracked_user_geo');
        if (geo && typeof geo.lat === 'number' && (Date.now() - (geo.at || 0)) < GEO_TTL) {
          sendResponse(tkGeoOut(geo.lat, geo.lon, geo.city, true));
          return;
        }
      } catch (_) {}
      if (!request.placeId) { sendResponse({ ok: false, error: 'no_placeId' }); return; }
      let r;
      try { r = await tkFetchRegion(request.placeId, null); }   // gameId yok → matchmaker → senin bölgen
      catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); return; }
      if (!r || !r.ok || typeof r.lat !== 'number') { sendResponse({ ok: false, error: r?.error || r?.status || 'no_region' }); return; }
      try { await chrome.storage.local.set({ tracked_user_geo: { lat: r.lat, lon: r.lon, city: r.region || null, at: Date.now(), src: 'roblox-matchmaker' } }); } catch (_) {}
      sendResponse(tkGeoOut(r.lat, r.lon, r.region));
    })();
    return true;
  }

});
// ==================== ULTIMATE EVENT DETECTION SYSTEM ====================

// KESIN YAZI KALIPLARI
const DEFINITE_PATTERNS = {
  live_events: [
    /\bevent\s+is\s+now\s+live\b/i, /\bevent\s+has\s+started\b/i,
    /\blive\s+event\s+active\b/i, /\bevent\s+is\s+active\b/i,
    /\bjoin\s+the\s+event\s+now\b/i, /\bevent\s+now\s+live\b/i,
    /\bnew\s+event\s+released?\b/i, /\bevent\s+just\s+started\b/i,
    /\betkinlik\s+başladı\b/i, /\betkinlik\s+şu an\s+aktif\b/i,
    /\betkinlik\s+canlı\b/i, /\byeni\s+etkinlik\s+başladı\b/i
  ],
  limited_time: [
    /\blimited\s+time\s+event\b/i, /\blimited\s+event\s+now\s+live\b/i,
    /\bsınırlı\s+süreli\s+etkinlik\b/i, /\bsınırlı\s+etkinlik\s+başladı\b/i,
    /\blimited\s+item\s+drop\b/i, /\bsınırlı\s+eşya\s+dağıtımı\b/i
  ],
  multiplier_events: [
    /\bdouble\s+xp\s+weekend\b/i, /\b2x\s+xp\s+event\b/i,
    /\b3x\s+xp\s+active\b/i, /\bdouble\s+coins?\s+event\b/i,
    /\b2x\s+cash\s+weekend\b/i, /\bçifte\s+xp\s+hafta\s+sonu\b/i
  ],
  season_events: [
    /\bnew\s+season\s+started\b/i, /\bseason\s+\d+\s+live\b/i,
    /\bchapter\s+\d+\s+released?\b/i, /\byeni\s+sezon\s+başladı\b/i
  ],
  reward_events: [
    /\bfree\s+item\s+drop\b/i, /\bfree\s+reward\s+event\b/i,
    /\btoken\s+event\s+live\b/i, /\bbedava\s+eşya\s+etkinliği\b/i
  ]
};

const DEFINITE_NEGATIVE_PATTERNS = [
  /\bevent\s+ended\b/i, /\bevent\s+over\b/i,
  /\bno\s+active\s+event\b/i, /\bevent\s+coming\s+soon\b/i,
  /\betkinlik\s+bitti\b/i, /\baktif\s+etkinlik\s+yok\b/i
];

// ==================== HYBRID ANALYZER ====================

class HybridEventAnalyzer {
  constructor() {
    this.SIGNALS = {
      TITLE_DEFINITE:    120,  // Başlıkta kesin etkinlik kalıbı
      TITLE_STRONG:       75,  // Başlıkta güçlü etkinlik kelimesi
      TEXT_DEFINITE:     100,  // Açıklamada kesin kalıp
      TEXT_STRONG:        55,  // Açıklamada güçlü kalıp
      PLAYER_SPIKE:       70,  // %30–99 oyuncu artışı
      PLAYER_SPIKE_BIG:   90,  // %100+ oyuncu artışı
      RECENT_UPDATE:      45,  // 12 saat içinde güncelleme
      RECENT_UPDATE_24:   30,  // 24 saat içinde güncelleme
      THUMBNAIL_CHANGE:   35,  // Thumbnail değişikliği
      WEEKEND_EVENT_HOUR: 25,  // Haftasonu event saati
      // Yeni sinyaller (v3.8 — daha derin analiz)
      FAVORITE_SPIKE:     60,  // Favorilenme oranında ani artış (%20+)
      FAVORITE_SPIKE_BIG: 85,  // Favorilenme oranında patlama (%50+)
      LIKE_RATIO_JUMP:    50,  // Beğeni oranı son 24h'da iyileşti
      SERVER_COUNT_SPIKE: 75,  // Aktif server sayısı ani artış (%40+)
      AVG_SERVER_FULLER:  40,  // Server doluluk ortalaması arttı (oyuncular oyna takılıyor)
      VOICE_CHAT_NEW:     35,  // Voice chat yeni etkinleştirildi
      BADGE_NEW:          30,  // Yeni badge eklendi (event badge sıkça)
      EVENING_PEAK_HOUR:  20,  // Hafta içi akşam peak (18-23)
      DESC_TR_EXTRA:      40,  // Genişletilmiş TR açıklama pattern (yarışma, ödül, vb)
    };
    this.THRESHOLD_DEFINITE = 110;
    this.THRESHOLD_POSSIBLE =  60;
  }

  async analyze(gameId, universeId, currentData, historyData) {
    const signals = [];
    let totalScore = 0;
    const add = (type, score, reason) => { signals.push({ type, score, reason }); totalScore += score; };

    // 1. BAŞLIK ANALİZİ — en güvenilir kaynak
    const titleResult = this.analyzeTitle(currentData.title, historyData.title);
    if (titleResult) add(titleResult.type, this.SIGNALS[titleResult.type], titleResult.reason);

    // 2. AÇIKLAMA ANALİZİ — sadece ilk 800 karakter, eski metinlerden kaçın
    const descResult = this.analyzeDescription(currentData.description);
    if (descResult) add(descResult.type, this.SIGNALS[descResult.type], descResult.reason);

    // 3. OYUNCU ARTIŞI
    if (historyData.playerCount > 0 && currentData.playerCount > 0) {
      const ratio = currentData.playerCount / historyData.playerCount;
      if (ratio >= 2.0) {
        add('PLAYER_SPIKE_BIG', this.SIGNALS.PLAYER_SPIKE_BIG,
          `Oyuncu sayısı 2x+ arttı (${historyData.playerCount.toLocaleString()} → ${currentData.playerCount.toLocaleString()})`);
      } else if (ratio >= 1.3) {
        add('PLAYER_SPIKE', this.SIGNALS.PLAYER_SPIKE,
          `Oyuncu sayısı %${Math.round((ratio - 1) * 100)} arttı (${historyData.playerCount.toLocaleString()} → ${currentData.playerCount.toLocaleString()})`);
      }
    }

    // 4. SON GÜNCELLEME
    if (currentData.updated) {
      const hoursAgo = (Date.now() - currentData.updated) / 3_600_000;
      if (hoursAgo < 12) {
        add('RECENT_UPDATE', this.SIGNALS.RECENT_UPDATE,
          `${Math.round(hoursAgo)} saat önce güncellendi`);
      } else if (hoursAgo < 24) {
        add('RECENT_UPDATE_24', this.SIGNALS.RECENT_UPDATE_24,
          `${Math.round(hoursAgo)} saat önce güncellendi`);
      }
    }

    // 5. THUMBNAIL DEĞİŞİKLİĞİ
    if (historyData.thumbnail && currentData.thumbnail &&
        historyData.thumbnail !== currentData.thumbnail) {
      add('THUMBNAIL_CHANGE', this.SIGNALS.THUMBNAIL_CHANGE, 'Oyun görseli değişti');
    }

    // 6. ZAMAN BAZLI
    const timeSignal = this.analyzeTimePatterns();
    if (timeSignal) add(timeSignal.type, timeSignal.score, timeSignal.reason);

    // 7. FAVORITE SPIKE — favorilenme oranı ani artış (event döneminde insanlar favorile)
    if (typeof historyData.favoritedCount === 'number' && typeof currentData.favoritedCount === 'number'
        && historyData.favoritedCount > 0) {
      const favRatio = currentData.favoritedCount / historyData.favoritedCount;
      if (favRatio >= 1.5) {
        add('FAVORITE_SPIKE_BIG', this.SIGNALS.FAVORITE_SPIKE_BIG,
          `Favorilenme %${Math.round((favRatio - 1) * 100)} arttı (${historyData.favoritedCount.toLocaleString()} → ${currentData.favoritedCount.toLocaleString()})`);
      } else if (favRatio >= 1.2) {
        add('FAVORITE_SPIKE', this.SIGNALS.FAVORITE_SPIKE,
          `Favorilenme %${Math.round((favRatio - 1) * 100)} arttı`);
      }
    }

    // 8. LIKE RATIO JUMP — beğeni oranı iyileşti (yeni içerik tepki sinyali)
    if (typeof historyData.likeRatio === 'number' && typeof currentData.likeRatio === 'number'
        && historyData.likeRatio > 0 && currentData.likeRatio - historyData.likeRatio >= 0.05) {
      add('LIKE_RATIO_JUMP', this.SIGNALS.LIKE_RATIO_JUMP,
        `Beğeni oranı +%${Math.round((currentData.likeRatio - historyData.likeRatio) * 100)} (${Math.round(historyData.likeRatio * 100)}% → ${Math.round(currentData.likeRatio * 100)}%)`);
    }

    // 9. SERVER COUNT SPIKE — aktif server sayısı patlaması (event = matchmaker yeni instance açar)
    if (typeof historyData.serverCount === 'number' && typeof currentData.serverCount === 'number'
        && historyData.serverCount > 0) {
      const srvRatio = currentData.serverCount / historyData.serverCount;
      if (srvRatio >= 1.4) {
        add('SERVER_COUNT_SPIKE', this.SIGNALS.SERVER_COUNT_SPIKE,
          `Aktif server sayısı %${Math.round((srvRatio - 1) * 100)} arttı (${historyData.serverCount} → ${currentData.serverCount})`);
      }
    }

    // 10. AVG SERVER FULLNESS — server'lar daha dolu (insanlar oyunda takılıyor → event sürüyor)
    if (typeof historyData.avgFullness === 'number' && typeof currentData.avgFullness === 'number'
        && currentData.avgFullness - historyData.avgFullness >= 0.15) {
      add('AVG_SERVER_FULLER', this.SIGNALS.AVG_SERVER_FULLER,
        `Server doluluk %${Math.round((currentData.avgFullness - historyData.avgFullness) * 100)} arttı`);
    }

    // 11. VOICE CHAT NEW — voice chat yeni etkinleştirildi (event organizasyonu için)
    if (currentData.voiceEnabled && !historyData.voiceEnabled) {
      add('VOICE_CHAT_NEW', this.SIGNALS.VOICE_CHAT_NEW, 'Voice chat yeni etkinleştirildi');
    }

    // 12. BADGE NEW — yeni badge eklendi (event badge yaygın)
    if (typeof currentData.badgeCount === 'number' && typeof historyData.badgeCount === 'number'
        && currentData.badgeCount > historyData.badgeCount) {
      const newBadges = currentData.badgeCount - historyData.badgeCount;
      add('BADGE_NEW', this.SIGNALS.BADGE_NEW, `${newBadges} yeni badge eklendi`);
    }

    const isDefiniteEvent = totalScore >= this.THRESHOLD_DEFINITE;
    const isPossibleEvent = totalScore >= this.THRESHOLD_POSSIBLE;

    return {
      isEvent: isDefiniteEvent || isPossibleEvent,
      isDefinite: isDefiniteEvent,
      confidence: isDefiniteEvent ? 'kesin' : (isPossibleEvent ? 'olası' : 'yok'),
      totalScore,
      signals,
      recommendation: this.getRecommendation(isDefiniteEvent, isPossibleEvent, signals)
    };
  }

  analyzeTitle(title, previousTitle) {
    if (!title) return null;
    const t = title.toLowerCase();

    for (const pattern of DEFINITE_NEGATIVE_PATTERNS) {
      if (pattern.test(t)) return null;
    }

    // Köşeli parantez etiketi: [EVENT], [LIVE], [UPDATE], [ETKİNLİK] vb.
    if (/\[(?:event|live|update|etkinlik|aktif|season|new|yeni|fest)\]/i.test(t)) {
      return { type: 'TITLE_DEFINITE', reason: `Başlık etiketi: "${title}"` };
    }

    // Kesin kalıplar başlıkta
    for (const patterns of Object.values(DEFINITE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(t)) {
          return { type: 'TITLE_DEFINITE', reason: `Başlıkta kesin kalıp: "${title}"` };
        }
      }
    }

    // Güçlü tekil kelimeler başlıkta
    const STRONG = ['event', 'etkinlik', 'festival', 'halloween', 'christmas', 'summer',
      'winter', 'collab', 'update', 'limited', 'anniversary', 'seasonal',
      'celebration', 'tournament', 'bonus', 'fest', 'holiday', 'special'];
    const found = STRONG.filter(kw => t.includes(kw));
    if (found.length > 0) {
      // Başlık değiştiyse sinyal daha güçlü
      const titleChanged = previousTitle && previousTitle.toLowerCase() !== t;
      if (titleChanged) {
        return { type: 'TITLE_DEFINITE', reason: `Başlık değişti + etkinlik kelimesi: "${title}"` };
      }
      return { type: 'TITLE_STRONG', reason: `Başlıkta: ${found.join(', ')}` };
    }

    return null;
  }

  analyzeDescription(description) {
    if (!description) return null;
    const d = description.toLowerCase().slice(0, 800);

    for (const pattern of DEFINITE_NEGATIVE_PATTERNS) {
      if (pattern.test(d)) return null;
    }

    for (const patterns of Object.values(DEFINITE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(d)) {
          return { type: 'TEXT_DEFINITE', reason: 'Açıklamada kesin etkinlik kalıbı' };
        }
      }
    }

    const STRONG = ['event', 'live now', 'active now', 'etkinlik', '2x', 'double xp', 'bonus weekend', 'limited time'];
    const found = STRONG.filter(kw => d.includes(kw));

    // GENİŞLETİLMİŞ TR pattern'lar — kombinasyon tetikleyicisi
    // Yarışma/turnuva/ödül/katılma süresi gibi event'e işaret eden TR keywords.
    const TR_EXTRA = [
      'yarışma', 'turnuva', 'ödül', 'kazan', 'hediye', 'çekiliş',
      'son gün', 'son şans', 'kaçırma', 'katıl', 'katılma süresi',
      'bonus', 'çift xp', 'sınırlı', 'güncelleme', 'yeni güncelleme',
      'kod', 'redeem', 'free', 'ücretsiz', 'beta'
    ];
    const trFound = TR_EXTRA.filter(kw => d.includes(kw));
    if (trFound.length >= 2) {
      // Aynı zamanda STRONG eşleşmesi varsa toplam skor için her ikisini de döndür
      if (found.length >= 1) {
        return { type: 'TEXT_STRONG', reason: `Açıklamada: ${found.concat(trFound).slice(0, 4).join(', ')}` };
      }
      return { type: 'DESC_TR_EXTRA', reason: `TR event sinyali: ${trFound.slice(0, 4).join(', ')}` };
    }

    if (found.length >= 2) {
      return { type: 'TEXT_STRONG', reason: `Açıklamada: ${found.join(', ')}` };
    }

    return null;
  }

  analyzeTimePatterns() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    // Cumartesi prime time
    if (day === 6 && hour >= 15 && hour <= 21)
      return { type: 'WEEKEND_EVENT_HOUR', score: this.SIGNALS.WEEKEND_EVENT_HOUR, reason: 'Haftasonu event saati (Cumartesi 15-21)' };
    // Pazar prime time
    if (day === 0 && hour >= 14 && hour <= 20)
      return { type: 'WEEKEND_EVENT_HOUR', score: Math.round(this.SIGNALS.WEEKEND_EVENT_HOUR * 0.7), reason: 'Haftasonu event saati (Pazar)' };
    // Hafta içi akşam peak (geleneksel oyuncu yoğunluğu — event'ler bunu hedefler)
    if (day >= 1 && day <= 5 && hour >= 18 && hour <= 23)
      return { type: 'EVENING_PEAK_HOUR', score: this.SIGNALS.EVENING_PEAK_HOUR, reason: 'Hafta içi akşam peak (18-23)' };
    return null;
  }

  getRecommendation(isDefinite, isPossible, signals) {
    if (isDefinite) return 'event_rec_definite';
    if (isPossible) return 'event_rec_possible';
    return 'event_rec_none';
  }
}

const analyzer = new HybridEventAnalyzer();

// ==================== MAIN DETECTION ====================

async function detectLiveEvents() {
  if (!navigator.onLine) { console.log('[SW] Offline, skipping detectLiveEvents'); return; }
  try {
    const data = await chrome.storage.local.get([
      'rota_favorites', 'rota_detected_events', 'rota_settings',
      'rota_game_history', 'rota_player_history'
    ]);
    
    const favorites = data.rota_favorites || [];
    const detectedEvents = data.rota_detected_events || {};
    const settings = data.rota_settings || {};
    const gameHistory = data.rota_game_history || {};
    const playerHistory = data.rota_player_history || {};

    if (!settings.eventDetection?.enabled) return;
    if (favorites.length === 0) return;
    if (settings.silentMode) return;

    console.log('[SW] Hybrid Event Detection starting...');

    for (const game of favorites) {
      try {
        // Universe ID
        const universeRes = await fetch(`https://apis.roblox.com/universes/v1/places/${game.placeId}/universe`);
        if (!universeRes.ok) continue;
        const universeData = await universeRes.json();
        const universeId = universeData.universeId;
        if (!universeId) continue;

        // Game Details
        const gameRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        if (!gameRes.ok) continue;
        const gameData = await gameRes.json();
        if (!gameData.data || gameData.data.length === 0) continue;
        
        const details = gameData.data[0];
        
        // Thumbnail kontrolü
        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`);
        let thumbnailUrl = null;
        if (thumbRes.ok) {
          const thumbData = await thumbRes.json();
          thumbnailUrl = thumbData.data?.[0]?.imageUrl;
        }

        // Yeni signal'ler için ek metrikler — votes, favori, server, voice, badge.
        // PAYLAŞILAN helper (on-demand "Analiz" ile aynı) → iki yol bir daha kopmaz.
        const metrics = await collectEventMetrics(game.placeId, universeId, details);

        // Mevcut veri (genişletilmiş)
        const currentData = {
          title: details.name || '',
          description: details.description || '',
          playerCount: details.playing || 0,
          updated: details.updated ? new Date(details.updated).getTime() : null,
          thumbnail: thumbnailUrl,
          ...metrics
        };

        // Geçmiş veri
        const history = gameHistory[game.placeId] || {};
        const playerHist = playerHistory[game.placeId] || {};
        const historyData = {
          title: history.title || '',
          description: history.description || '',
          playerCount: playerHist.count || currentData.playerCount,
          thumbnail: history.thumbnail,
          favoritedCount: history.favoritedCount,
          likeRatio: history.likeRatio,
          serverCount: history.serverCount,
          avgFullness: history.avgFullness,
          voiceEnabled: history.voiceEnabled,
          badgeCount: history.badgeCount
        };

        // Hybrid analiz
        const result = await analyzer.analyze(game.placeId, universeId, currentData, historyData);

        // Verileri kaydet (universeId'yi de sakla ki detectPlayerSpikes kullanabilsin)
        gameHistory[game.placeId] = {
          ...currentData,
          universeId: universeId,
          lastChecked: Date.now()
        };
        playerHistory[game.placeId] = {
          count: currentData.playerCount,
          timestamp: Date.now()
        };
        await chrome.storage.local.set({ 
          rota_game_history: gameHistory,
          rota_player_history: playerHistory
        });

        console.log(`[SW] ${currentData.title}: Score=${result.totalScore}, Event=${result.isEvent} (${result.confidence})`);

        // Bildirim (sadece kesin)
        if (result.isEvent && result.isDefinite) {
          const eventKey = `${game.placeId}_${currentData.title}_${Math.floor(Date.now()/86400000)}`;
          
          if (detectedEvents[eventKey]) {
            console.log(`[SW] Already notified for ${currentData.title}`);
            continue;
          }

          detectedEvents[eventKey] = true;
          await chrome.storage.local.set({ rota_detected_events: detectedEvents });

          // En güçlü sinyali bul
          const strongestSignal = result.signals.sort((a, b) => b.score - a.score)[0];

          // Locale-aware notification strings
          const settings = await chrome.storage.local.get('rota_settings');
          const locale = settings.rota_settings?.language || 'tr';
          const notifStrings = {
            tr: { event: 'Canlı Etkinlik!', join: '🎮 Hemen Katıl', close: '🔔 Kapat' },
            en: { event: 'Live Event!', join: '🎮 Join Now', close: '🔔 Close' }
          };
          const strings = notifStrings[locale] || notifStrings.tr;

          chrome.notifications.create(`event-${game.placeId}`, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: `🔴 ${currentData.title}`,
            message: `${strings.event} ${strongestSignal.reason}`,
            priority: 2,
            requireInteraction: true,
            buttons: [
              { title: strings.join },
              { title: strings.close }
            ]
          });

          console.log(`[SW] 🎉 EVENT DETECTED: ${currentData.title} (Score: ${result.totalScore})`);
        }

      } catch (err) {
        console.warn(`[SW] Error checking ${game.placeId}:`, err);
      }
    }

  } catch (error) {
    console.warn('[SW] Event detection failed:', error);
  }
}

// ==================== NOTIFICATION HANDLERS ====================

/**
 * Güvenli popup açma - Pencere kontrolü ile
 */
async function safeOpenPopup(placeId) {
  try {
    // Önce auto_scan verisini kaydet
    await chrome.storage.local.set({ 'rota_auto_scan': placeId });
    
    // Aktif pencere var mı kontrol et
    const windows = await chrome.windows.getAll({ populate: false });
    const normalWindow = windows.find(w => w.type === 'normal' && !w.state?.includes('minimized'));
    
    if (!normalWindow) {
      console.log('[SW] No active normal window, creating new window...');
      // Yeni pencere aç ve oyun sayfasına git
      await chrome.windows.create({ 
        url: `https://www.roblox.com/games/${placeId}/`,
        type: 'normal',
        focused: true
      });
      return;
    }
    
    // Aktif pencere var, önce ona odaklan
    await chrome.windows.update(normalWindow.id, { focused: true });
    
    // Popup'u açmaya çalış
    try {
      // chrome.action.openPopup() sadece kullanıcı etkileşimi ile çalışır
      // Service worker'dan otomatik açılamaz, bu yüzden popup yerine direkt oyun sayfası açalım
      const [activeTab] = await chrome.tabs.query({ active: true, windowId: normalWindow.id });
      
      if (activeTab && activeTab.url?.includes('roblox.com')) {
        // Zaten Roblox'ta, popup'u açmayı dene
        await chrome.action.openPopup();
      } else {
        // Roblox'ta değil, yeni sekme aç
        await chrome.tabs.create({
          windowId: normalWindow.id,
          url: `https://www.roblox.com/games/${placeId}/`,
          active: true
        });
      }
    } catch (popupErr) {
      // Popup açılamadı, direkt oyun sayfasına git
      console.log('[SW] Popup could not open, navigating to game page...');
      await chrome.tabs.create({
        windowId: normalWindow.id,
        url: `https://www.roblox.com/games/${placeId}/`,
        active: true
      });
    }
  } catch (err) {
    console.error('[SW] safeOpenPopup failed:', err);
    // Son çare: Yeni pencere aç
    try {
      await chrome.windows.create({ 
        url: `https://www.roblox.com/games/${placeId}/`,
        focused: true
      });
    } catch (e) {
      console.error('[SW] Failed to create window:', e);
    }
  }
}

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId.startsWith('event-')) {
    const placeId = notificationId.replace('event-', '');
    
    if (buttonIndex === 0) {
      // "Hemen Katıl" butonu
      await safeOpenPopup(placeId);
    }
    
    // Bildirimi kapat
    await chrome.notifications.clear(notificationId);
  }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId.startsWith('event-')) {
    const placeId = notificationId.replace('event-', '');
    await safeOpenPopup(placeId);
    await chrome.notifications.clear(notificationId);
  }
});

// ==================== PLAYER SPIKE DETECTION ====================

async function detectPlayerSpikes() {
  if (!navigator.onLine) { console.log('[SW] Offline, skipping detectPlayerSpikes'); return; }
  try {
    const data = await chrome.storage.local.get(['rota_favorites', 'rota_player_history', 'rota_settings', 'rota_game_history']);
    const favorites = data.rota_favorites || [];
    const playerHistory = data.rota_player_history || {};
    const gameHistory = data.rota_game_history || {};
    const settings = data.rota_settings || {};

    const threshold = settings.eventDetection?.playerSpikeThreshold || 1.5;

    for (const game of favorites) {
      const history = playerHistory[game.placeId];
      if (!history || !history.count) continue;

      // universeId'yi önce gameHistory'den al, yoksa API'den çek
      let universeId = gameHistory[game.placeId]?.universeId;
      if (!universeId) {
        try {
          const uniRes = await fetch(`https://apis.roblox.com/universes/v1/places/${game.placeId}/universe`);
          if (!uniRes.ok) continue;
          const uniData = await uniRes.json();
          universeId = uniData.universeId;
          if (!universeId) continue;
        } catch (e) {
          continue;
        }
      }

      try {
        const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        if (!res.ok) continue;
        
        const data = await res.json();
        const currentPlayers = data.data?.[0]?.playing || 0;
        
        const ratio = currentPlayers / history.count;
        
        if (ratio >= threshold) {
          console.log(`[SW] Player spike detected: ${game.title || game.placeId} - ${Math.round(ratio * 100)}% increase`);
          
          // Event detection'ı hemen tetikle
          chrome.alarms.create('detectLiveEvents', { when: Date.now() + 1000 });
        }

        // Güncelle
        playerHistory[game.placeId] = {
          count: currentPlayers,
          timestamp: Date.now()
        };

      } catch (e) {
        console.warn('[SW] Spike check failed:', e);
      }
    }

    await chrome.storage.local.set({ rota_player_history: playerHistory });

  } catch (err) {
    console.warn('[SW] Player spike detection error:', err);
  }
}

// ==================== TEST & HISTORY ====================

// ── KATMAN 1: Roblox'un RESMİ Experience Events sistemi (geliştiricinin beyanı = ground truth, tahmin DEĞİL) ──
// Cevap: { data: [ { displayTitle, displaySubtitle, eventTime:{startUtc,endUtc}, eventStatus, eventVisibility,
//                    host:{hostName,hasVerifiedBadge}, eventCategories:[{category}] } ] }
async function fetchVirtualEvents(universeId) {
  try {
    const res = await fetch(`https://apis.roblox.com/virtual-events/v1/universes/${universeId}/virtual-events`, { credentials: 'include' });
    if (!res.ok) return [];
    const json = await res.json();
    const list = Array.isArray(json?.data) ? json.data : [];
    const now = Date.now();
    const TWELVE_H = 12 * 60 * 60 * 1000;
    return list
      .filter(e => e && (!e.eventVisibility || e.eventVisibility === 'public'))
      .map(e => {
        const start = e.eventTime?.startUtc ? Date.parse(e.eventTime.startUtc) : null;
        const end = e.eventTime?.endUtc ? Date.parse(e.eventTime.endUtc) : null;
        let state = 'live';
        if (start && now < start) state = 'upcoming';
        else if (end && now > end) state = 'ended';
        return {
          id: e.id || null,
          title: e.displayTitle || e.title || '',
          subtitle: e.displaySubtitle || e.subtitle || '',
          startUtc: e.eventTime?.startUtc || null,
          endUtc: e.eventTime?.endUtc || null,
          state,
          hostName: e.host?.hostName || '',
          hostVerified: !!e.host?.hasVerifiedBadge,
          category: e.eventCategories?.[0]?.category || ''
        };
      })
      // Uzun süre önce bitmişleri ele (12 saatten eski). Canlı + yakında + yeni bitmiş kalır.
      .filter(e => e.state !== 'ended' || (e.endUtc && (now - Date.parse(e.endUtc)) < TWELVE_H))
      .sort((a, b) => {
        const rank = s => (s === 'live' ? 0 : s === 'upcoming' ? 1 : 2);
        if (rank(a.state) !== rank(b.state)) return rank(a.state) - rank(b.state);
        return (Date.parse(a.startUtc || 0) || 0) - (Date.parse(b.startUtc || 0) || 0);
      });
  } catch (_) {
    return [];
  }
}

// ── KATMAN 2 yardımcısı: sezgi motoru için zengin metrikler (votes, favori, server, doluluk, voice, badge). ──
// Arka plan izleyici ile on-demand "Analiz" AYNI helper'ı kullanır → bir daha drift olmaz.
async function collectEventMetrics(placeId, universeId, details) {
  let likeRatio = null, favoritedCount = null, serverCount = null, avgFullness = null;
  let voiceEnabled = false, badgeCount = null;
  try {
    const votesRes = await fetch(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`, { credentials: 'omit' });
    if (votesRes.ok) {
      const v = (await votesRes.json()).data?.[0];
      if (v && (v.upVotes + v.downVotes > 0)) likeRatio = v.upVotes / (v.upVotes + v.downVotes);
    }
  } catch (_) {}
  try { favoritedCount = (typeof details.favoritedCount === 'number') ? details.favoritedCount : null; } catch (_) {}
  try {
    const srvRes = await fetch(`https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Desc&limit=100`, { credentials: 'omit' });
    if (srvRes.ok) {
      const servers = (await srvRes.json()).data || [];
      serverCount = servers.length;
      if (servers.length > 0) {
        const totalFullness = servers.reduce((sum, s) => (s.maxPlayers > 0 ? sum + (s.playing / s.maxPlayers) : sum), 0);
        avgFullness = totalFullness / servers.length;
      }
    }
  } catch (_) {}
  try {
    voiceEnabled = !!(details.universeAvatarType === 'PlayerChoice' || details.allowedGearGenres);
    if (typeof details.isVoiceEnabled === 'boolean') voiceEnabled = details.isVoiceEnabled;
  } catch (_) {}
  try {
    const badgeRes = await fetch(`https://badges.roblox.com/v1/universes/${universeId}/badges?limit=10&sortOrder=Desc`, { credentials: 'omit' });
    if (badgeRes.ok) badgeCount = ((await badgeRes.json()).data || []).length;
  } catch (_) {}
  return { likeRatio, favoritedCount, serverCount, avgFullness, voiceEnabled, badgeCount };
}

async function testEventDetection(placeId) {
  try {
    const universeRes = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    if (!universeRes.ok) return { success: false, error: 'Universe not found' };

    const universeData = await universeRes.json();
    const universeId = universeData.universeId;
    if (!universeId) return { success: false, error: 'No universe ID' };

    // Tüm verileri çek
    const [gameRes, thumbRes] = await Promise.all([
      fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`),
      fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png`)
    ]);

    if (!gameRes.ok) return { success: false, error: 'Game data not found' };

    const gameData = await gameRes.json();
    const thumbData = thumbRes.ok ? await thumbRes.json() : { data: [] };

    if (!gameData.data || gameData.data.length === 0) return { success: false, error: 'No game data' };

    const details = gameData.data[0];

    // KATMAN 1 — RESMİ etkinlikler (kesin). KATMAN 2 — zengin metrikler + sezgi (tahmin, fallback).
    const officialEvents = await fetchVirtualEvents(universeId);
    const metrics = await collectEventMetrics(placeId, universeId, details);

    const currentData = {
      title: details.name,
      description: details.description,
      playerCount: details.playing,
      updated: details.updated ? new Date(details.updated).getTime() : null,
      thumbnail: thumbData.data?.[0]?.imageUrl,
      ...metrics
    };

    // Geçmiş — rota_game_history'deki TÜM zengin alanları oku (eskiden sadece 3 alan → 6 sinyal ölüydü)
    const storage = await chrome.storage.local.get(['rota_game_history', 'rota_player_history']);
    const history = storage.rota_game_history?.[placeId] || {};
    const playerHist = storage.rota_player_history?.[placeId] || {};

    const historyData = {
      title: history.title || '',
      description: history.description || '',
      playerCount: playerHist.count || currentData.playerCount,
      thumbnail: history.thumbnail,
      favoritedCount: history.favoritedCount,
      likeRatio: history.likeRatio,
      serverCount: history.serverCount,
      avgFullness: history.avgFullness,
      voiceEnabled: history.voiceEnabled,
      badgeCount: history.badgeCount
    };

    // Analiz yap (sezgi katmanı)
    const result = await analyzer.analyze(placeId, universeId, currentData, historyData);

    return {
      success: true,
      title: details.name,
      officialEvents,
      currentData,
      historyData,
      analysis: result,
      signals: result.signals
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function analyzeSingleGame(placeId) {
  return await testEventDetection(placeId);
}

async function getEventHistory(placeId) {
  const data = await chrome.storage.local.get(['rota_game_history', 'rota_player_history', 'rota_detected_events']);
  return {
    history: data.rota_game_history?.[placeId] || null,
    playerHistory: data.rota_player_history?.[placeId] || null,
    detectedEvents: Object.keys(data.rota_detected_events || {})
      .filter(k => k.startsWith(placeId))
      .map(k => ({ key: k, date: data.rota_detected_events[k] }))
  };
}

// ==================== GAME LIBRARY ACTIVITY TRACKING ====================

async function trackGameLibraryActivity() {
  if (!navigator.onLine) { console.log('[SW] Offline, skipping trackGameLibraryActivity'); return; }
  try {
    const storage = await chrome.storage.local.get(['rota_favorites', 'rota_settings']);
    const favorites = storage.rota_favorites || [];
    const settings = storage.rota_settings || {};

    if (favorites.length === 0) return;

    const gameData = {};

    // Her favori oyunun canlı verisini çek (rate limit'e dikkat: max 10 oyun)
    const gamesToCheck = favorites.slice(0, 10);

    for (const game of gamesToCheck) {
      try {
        if (!game.placeId) continue;

        // 1. Universe ID al
        const uniRes = await fetch(`https://apis.roblox.com/universes/v1/places/${game.placeId}/universe`);
        if (!uniRes.ok) continue;
        const uniData = await uniRes.json();
        const universeId = uniData.universeId;
        if (!universeId) continue;

        // 2. Oyun detaylarını al
        const gameRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        if (!gameRes.ok) continue;
        const gameInfo = await gameRes.json();
        const details = gameInfo.data?.[0];
        if (!details) continue;

        // 3. Önceki player count'u al (trend hesabı için)
        const prevStorage = await chrome.storage.local.get('rota_game_data');
        const prevData = prevStorage.rota_game_data || {};
        const prevCount = prevData[game.placeId]?.playerCount || 0;
        const currentCount = details.playing || 0;

        // 4. Trend ikonu hesapla
        let trendIcon = '';
        if (prevCount > 0) {
          const ratio = currentCount / prevCount;
          if (ratio >= 1.3) trendIcon = '🔥';      // %30+ artış
          else if (ratio >= 1.1) trendIcon = '📈';  // %10+ artış
          else if (ratio <= 0.7) trendIcon = '📉';  // %30+ düşüş
          else if (ratio <= 0.9) trendIcon = '📉';  // %10+ düşüş
          else trendIcon = '➡️';                     // Stabil
        }

        // 5. Son güncelleme kontrolü (24 saat içinde mi?)
        const updateTime = details.updated ? new Date(details.updated).getTime() : 0;
        const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const hasRecentUpdate = updateTime > dayAgo;

        // 6. Update zaman metni
        let updateTimeText = '';
        if (hasRecentUpdate && updateTime) {
          const hoursAgo = Math.floor((Date.now() - updateTime) / (1000 * 60 * 60));
          if (hoursAgo < 1) updateTimeText = 'Az önce';
          else updateTimeText = `${hoursAgo} saat önce`;
        }

        gameData[game.placeId] = {
          playerCount: currentCount,
          trendIcon,
          hasRecentUpdate,
          updateTimeText,
          liveTitle: details.name || '', // güncel oyun başlığı ([POSE WHEEL!] gibi prefix'ler dahil)
          lastChecked: Date.now()
        };

        // API rate limit koruması: oyunlar arası bekleme
        await new Promise(r => setTimeout(r, 500));

      } catch (innerErr) {
        console.warn(`[SW] Library activity error for ${game.placeId}:`, innerErr.message);
      }
    }

    // Storage'a kaydet (gameData) + favorites title'larını da senkronize et
    if (Object.keys(gameData).length > 0) {
      await chrome.storage.local.set({ rota_game_data: gameData });

      // Favorites title sync: API'den gelen güncel title eskiyse update et (kullanıcı her açılışta güncel görsün)
      let favsChanged = false;
      const updatedFavs = favorites.map(fav => {
        const live = gameData[fav.placeId]?.liveTitle;
        if (live && live.trim() && live !== fav.title) {
          favsChanged = true;
          return { ...fav, title: live };
        }
        return fav;
      });
      if (favsChanged) {
        await chrome.storage.local.set({ rota_favorites: updatedFavs });
        console.log('[SW] Favorites titles synced with live Roblox names');
      }
      console.log(`[SW] Game library updated: ${Object.keys(gameData).length} games tracked`);
    }

  } catch (err) {
    console.error('[SW] trackGameLibraryActivity failed:', err);
  }
}

// ==================== BACKGROUND PING MEASUREMENT ====================

async function measureBestPing() {
  if (!navigator.onLine) return null;
  try {
    const storage = await chrome.storage.local.get('rota_settings');
    const settings = storage.rota_settings || {};
    const probes = settings.probes || {
      "Almanya (DE)": "https://s3.eu-central-1.amazonaws.com",
      "Hollanda (NL)": "https://s3.eu-west-1.amazonaws.com",
      "Fransa (FR)": "https://s3.eu-west-3.amazonaws.com",
      "Polonya (PL)": "https://s3.eu-north-1.amazonaws.com",
      "Romanya (RO)": "https://s3.eu-south-1.amazonaws.com"
    };
    const timeout = settings.timeoutMs || 3000;

    const results = [];

    for (const [region, url] of Object.entries(probes)) {
      try {
        // 3 örnek al, en iyisini seç
        // v1.9.0 fix: bare S3 endpoint HEAD → 405. Path + cacheBuster ekleyince 403/404 döner
        // (RTT aynı, console'a kırmızı hata düşmez)
        const pings = [];
        for (let i = 0; i < 3; i++) {
          const cacheBuster = `/ping?_=${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const pingUrl = url + cacheBuster;
          const start = performance.now();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          try {
            await fetch(pingUrl, {
              method: 'HEAD',
              mode: 'no-cors',
              cache: 'no-store',
              signal: controller.signal
            });
            const elapsed = Math.round(performance.now() - start);
            pings.push(elapsed);
          } catch {
            pings.push(999);
          } finally {
            clearTimeout(timeoutId);
          }

          // Örnekler arası kısa bekleme
          if (i < 2) await new Promise(r => setTimeout(r, 100));
        }

        // En düşük geçerli değeri al
        const validPings = pings.filter(p => p < 900);
        const bestPing = validPings.length > 0
          ? Math.min(...validPings)
          : 999;

        results.push({ region, ms: bestPing });
      } catch {
        results.push({ region, ms: 999 });
      }
    }

    // Sırala (en düşük ping önce)
    results.sort((a, b) => a.ms - b.ms);

    // En iyi bölgeyi belirle
    const bestRegion = results.length > 0 && results[0].ms < 900
      ? results[0].region
      : null;

    // Cache'e kaydet
    await chrome.storage.local.set({
      rota_ping_results: results,
      rota_best_region: bestRegion
    });

    console.log(`[SW] Ping measured: best=${bestRegion} (${results[0]?.ms}ms)`);

    return { success: true, results, best: bestRegion };

  } catch (err) {
    console.error('[SW] measureBestPing failed:', err);
    return { success: false, error: err.message };
  }
}

// ==================== PLAYTIME TRACKING ====================

async function checkPresenceAndTrack() {
  if (!navigator.onLine) return;
  try {
    const storage = await chrome.storage.local.get(['rota_favorites', 'tracked_active_session']);
    const favorites = storage.rota_favorites || [];
    if (favorites.length === 0) return;

    const now = Date.now();
    const activePlaceIds = new Set();

    // Yöntem 1: Tarayıcı sekmesi (mevcut davranış)
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.roblox.com/games/*' });
      for (const tab of tabs) {
        const match = tab.url?.match(/games\/(\d+)\//);
        if (match) activePlaceIds.add(match[1]);
      }
    } catch (_) {}

    // Yöntem 2: tracked_active_session — monitorActiveSession her 30sn güncelliyor.
    // Roblox client ile oynarken sekme kapalı olsa bile bu yöntem in-game tespiti yapar.
    // 3dk içinde lastSeenInGame varsa kullanıcı aktif in-game sayılır.
    const session = storage.tracked_active_session;
    if (session?.placeId && session.lastSeenInGame > 0 && (now - session.lastSeenInGame) < 3 * 60 * 1000) {
      activePlaceIds.add(String(session.placeId));
    }

    // Yöntem 3: Direkt Presence API — sekme ve session yoksa doğrudan sorgula (son çare).
    // autoReconnect kapalıysa veya session henüz açılmamışsa bu yol devreye girer.
    if (activePlaceIds.size === 0) {
      try {
        const myId = await getMyUserId();
        if (myId) {
          const res = await fetch('https://presence.roblox.com/v1/presence/users', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: [myId] })
          });
          if (res.ok) {
            const d = await res.json();
            const p = (d.userPresences || [])[0];
            if (p?.userPresenceType === 2 && p.placeId) {
              activePlaceIds.add(String(p.placeId));
            }
          }
        }
      } catch (_) {}
    }

    if (activePlaceIds.size === 0) return;

    let updated = false;
    for (const placeId of activePlaceIds) {
      const favIndex = favorites.findIndex(f => String(f.placeId) === placeId);
      if (favIndex === -1) continue;
      favorites[favIndex].playtimeSeconds = (favorites[favIndex].playtimeSeconds || 0) + 60;
      updated = true;
    }

    if (updated) {
      await chrome.storage.local.set({ rota_favorites: favorites });
      console.log('[SW] Playtime updated:', [...activePlaceIds].join(', '));
    }

  } catch (err) {
    console.error('[SW] checkPresenceAndTrack failed:', err);
  }
}

// ==================== UTILITY FUNCTIONS ====================

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ==================== STARTUP ====================

chrome.runtime.onStartup.addListener(() => {
  console.log('[SW] Tracked extension started');
  // Alarmlar zaten onInstalled'da oluşturuldu, burada tekrar oluşturmaya gerek yok
  // Sadece log seviyesinde bilgi veriyoruz
});

// ============================================================
// AUTO-RECONNECT / CRASH RECOVERY
// ============================================================
// Kullanıcı oyuna girince placeId+jobId saklanır.
// 30sn aralıkla presence polling: in-game'den offline geçişi → crash bildirimi.
// Notification button → roblox:// deep-link ile aynı server'a rejoin.

// Cached userId (her presence çağrısında yeniden fetch etmemek için)
let _cachedMyUserId = null;
let _cachedMyUserIdAt = 0;
async function getMyUserId() {
  // 1 saatlik cache
  if (_cachedMyUserId && (Date.now() - _cachedMyUserIdAt) < 3600000) {
    return _cachedMyUserId;
  }
  try {
    const res = await fetch('https://users.roblox.com/v1/users/authenticated', { credentials: 'include' });
    if (!res.ok) return null;
    const d = await res.json();
    _cachedMyUserId = d.id;
    _cachedMyUserIdAt = Date.now();
    return _cachedMyUserId;
  } catch (_) { return null; }
}

// Helper — join sonrası storage'a session kaydet
async function saveActiveSession(placeId, jobId, gameTitle) {
  if (!placeId) return;
  const myId = await getMyUserId();
  if (!myId) return; // Kullanıcı login değil — session açmaya gerek yok
  const session = {
    placeId: parseInt(placeId, 10),
    jobId: jobId || null,
    gameTitle: gameTitle || `Place ${placeId}`,
    joinedAt: Date.now(),
    lastSeenInGame: 0,
    sessionId: (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    myUserId: myId
  };
  await chrome.storage.local.set({ tracked_active_session: session });
}

// Periyodik monitor — alarm her 30sn tetiklenir.
// 2 mod: (a) session varsa crash detection, (b) session yoksa AUTO-DISCOVER (presence in-game ise yeni session aç).
// ============================================================
// SAVED SERVER LIVENESS CHECK
// ============================================================
// Her 5 dakikada bir kaydedilen serverların hâlâ aktif olup olmadığını kontrol eder.
// Roblox Games API'sinden ilk 2 sayfa (200 server) tarıyarak jobId aranır.
// 2 ardışık çekte bulunamazsa (≥10dk) server "kapalı" sayılıp otomatik silinir.
async function checkSavedServers() {
  try {
    const stored = await chrome.storage.local.get(['rota_saved_servers', 'rota_gameHistory']);
    const servers = stored.rota_saved_servers;
    if (!servers || servers.length === 0) return;

    const gameHistory = stored.rota_gameHistory || {};
    const now = Date.now();

    // placeId başına universeId önbellekle (tek API çağrısı per placeId)
    const universeCache = {};
    const getUniverseId = async (placeId) => {
      const key = String(placeId);
      if (universeCache[key]) return universeCache[key];
      // Önce gameHistory'den bak
      if (gameHistory[key]?.universeId) {
        universeCache[key] = gameHistory[key].universeId;
        return universeCache[key];
      }
      try {
        const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
        if (!res.ok) return null;
        const d = await res.json();
        if (d?.universeId) universeCache[key] = d.universeId;
        return universeCache[key] || null;
      } catch (_) { return null; }
    };

    // jobId → placeId haritası: hangi server'ı hangi oyunda arayacağız
    const placeGroups = {};
    for (const s of servers) {
      if (!s.jobId) continue; // jobId'siz serverı kontrol edemeyiz
      const pk = String(s.placeId);
      if (!placeGroups[pk]) placeGroups[pk] = [];
      placeGroups[pk].push(s.jobId);
    }

    // Her placeId için canlı jobId'leri topla (max 2 sayfa = 200 server)
    const liveJobIds = new Set();
    for (const [placeId, jobIds] of Object.entries(placeGroups)) {
      const universeId = await getUniverseId(placeId);
      if (!universeId) continue;

      let cursor = '';
      for (let page = 0; page < 2; page++) {
        try {
          const url = `https://games.roblox.com/v1/games/${universeId}/servers/Public?sortOrder=Desc&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
          const res = await fetch(url, { credentials: 'include' });
          if (!res.ok) break;
          const d = await res.json();
          for (const srv of (d.data || [])) {
            if (srv.id) liveJobIds.add(srv.id);
          }
          cursor = d.nextPageCursor || '';
          if (!cursor) break;
        } catch (_) { break; }
      }
    }

    // Her server'ı kontrol et: canlı → notFoundSince sıfırla; ölü → timestamp yaz
    let changed = false;
    const updated = servers.map(s => {
      if (!s.jobId) return s; // jobId yoksa dokunma
      const alive = liveJobIds.has(s.jobId);
      if (alive) {
        if (s.notFoundSince) {
          const { notFoundSince: _, ...rest } = s;
          changed = true;
          return rest; // Server yeniden canlı, notFoundSince temizle
        }
        return s;
      }
      // Ölü görünüyor
      if (!s.notFoundSince) {
        changed = true;
        return { ...s, notFoundSince: now }; // İlk ölü tespiti: timestamp yaz
      }
      return s; // Zaten işaretli
    });

    // notFoundSince > 10dk VE savedAt > 5dk olanları kaldır (false-positive önlemi)
    const DEAD_THRESHOLD_MS = 10 * 60 * 1000;
    const MIN_AGE_MS = 5 * 60 * 1000;
    const final = updated.filter(s => {
      if (!s.notFoundSince) return true;
      const deadDuration = now - s.notFoundSince;
      const serverAge = now - (s.savedAt || 0);
      if (deadDuration >= DEAD_THRESHOLD_MS && serverAge >= MIN_AGE_MS) {
        console.log(`[SW] Saved server removed (dead): ${s.gameTitle} | ${s.jobId?.substring(0, 8)}...`);
        changed = true;
        return false;
      }
      return true;
    });

    if (changed) {
      await chrome.storage.local.set({ rota_saved_servers: final });
      console.log(`[SW] checkSavedServers: ${servers.length - final.length} dead server(s) removed, ${final.length} remaining`);
    }
  } catch (err) {
    console.warn('[SW] checkSavedServers error:', err.message);
  }
}

async function monitorActiveSession() {
  // Settings: auto-reconnect kapalıysa hiç çalıştırma
  let settings = {};
  try {
    const sd = await chrome.storage.local.get('rota_settings');
    settings = sd.rota_settings || {};
  } catch (_) {}
  if (settings.autoReconnectEnabled === false) {
    // Açık değilse mevcut session da temizle (kullanıcı kapatmışsa stale data kalmasın)
    chrome.storage.local.remove('tracked_active_session').catch(() => {});
    return;
  }

  let session;
  try {
    const data = await chrome.storage.local.get('tracked_active_session');
    session = data.tracked_active_session;
  } catch (_) { return; }

  const myId = await getMyUserId();
  if (!myId) {
    console.log('[SW] monitorActiveSession: kullanıcı login değil, atlanıyor');
    return;
  }

  // Presence check (her durum için — auto-discover veya monitor)
  let presence;
  try {
    const res = await fetch('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [myId] })
    });
    if (!res.ok) {
      console.log('[SW] monitorActiveSession: presence API status', res.status);
      return;
    }
    const d = await res.json();
    presence = (d.userPresences || [])[0];
  } catch (e) {
    console.log('[SW] monitorActiveSession: presence fetch error', e.message);
    return;
  }
  if (!presence) return;

  const inGameNow = presence.userPresenceType === 2 && presence.placeId;

  // ─ AUTO-DISCOVER MODE: session yok ama kullanıcı in-game → session oluştur ─
  if (!session) {
    if (inGameNow) {
      const newSession = {
        placeId: parseInt(presence.placeId, 10),
        jobId: presence.gameId || null,
        gameTitle: presence.lastLocation || `Place ${presence.placeId}`,
        joinedAt: Date.now(),
        lastSeenInGame: Date.now(), // hemen aktif say (auto-discover halihazırda in-game tespit etti)
        sessionId: (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        myUserId: myId,
        autoDiscovered: true
      };
      await chrome.storage.local.set({ tracked_active_session: newSession });
      console.log('[SW] Auto-discovered active session:', { placeId: newSession.placeId, hasJobId: !!newSession.jobId, title: newSession.gameTitle });
    }
    return;
  }

  // ─ MONITOR MODE: session var ─
  const now = Date.now();
  const ageMs = now - (session.joinedAt || now);
  const inactiveMs = session.lastSeenInGame ? (now - session.lastSeenInGame) : 0;

  // Auto-discover'da placeId değişmiş olabilir (kullanıcı oyun değiştirdi) → session güncelle
  const matchesSession = inGameNow && String(presence.placeId) === String(session.placeId);
  const inDifferentGame = inGameNow && String(presence.placeId) !== String(session.placeId);

  if (matchesSession) {
    // Aktif in-game (aynı oyun): lastSeen + jobId güncelle
    session.lastSeenInGame = now;
    if (presence.gameId && presence.gameId !== session.jobId) {
      session.jobId = presence.gameId; // server değişti
    }
    await chrome.storage.local.set({ tracked_active_session: session });

    // Defensive fast re-check: SW kısa süre canlı kalır, 15sn sonra ek presence check.
    // Chrome alarm minimum 30sn olduğundan bu sayede ortalama tespit süresi yarıya iner.
    // SW ölürse timeout kaybolur — bir sonraki alarm zaten 30sn'de ateşler, veri kaybı yok.
    const lastFast = monitorActiveSession._lastFastCheck || 0;
    if (now - lastFast > 12 * 1000) {
      monitorActiveSession._lastFastCheck = now;
      setTimeout(() => {
        monitorActiveSession().catch(err => console.log('[SW] fast-recheck error:', err.message));
      }, 15 * 1000);
    }
    return;
  }

  if (inDifferentGame) {
    // Kullanıcı başka oyuna geçti → eski session'ı sıfırla, yenisini auto-discover
    console.log('[SW] User switched games, refreshing session');
    await chrome.storage.local.remove('tracked_active_session');
    return;
  }

  // Presence offline (oyun değil)
  if (session.lastSeenInGame === 0) {
    // Henüz hiç in-game algılanmadı → 5dk içinde girememişse session sil
    if (ageMs > 5 * 60 * 1000) await chrome.storage.local.remove('tracked_active_session');
    return;
  }

  // CRASH DETECTION: önceden in-game'di, şimdi değil
  // 15sn buffer (false-positive engelle, ama hızlı algıla)
  const sinceLastSeen = now - session.lastSeenInGame;
  if (sinceLastSeen < 15 * 1000) return;

  // Crash confirmed
  console.log('[SW] CRASH detected:', { placeId: session.placeId, sinceLastSeen: Math.round(sinceLastSeen / 1000) + 's' });

  // In-page overlay HER ZAMAN gönderilir (Roblox sayfası açıksa görünür)
  broadcastReconnectOverlay(session);

  // Native Chrome notification SADECE kullanıcı ayarlardan açtıysa
  if (settings.autoReconnectNative === true) {
    triggerCrashNotification(session);
  } else {
    console.log('[SW] Native notification disabled in settings — sadece in-page overlay');
  }

  await chrome.storage.local.remove('tracked_active_session');
}

// Tüm açık Roblox tab'larına in-page overlay broadcast et (custom themed modal)
async function broadcastReconnectOverlay(session) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.roblox.com/*' });
    let shown = 0;
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'showReconnectOverlay', session });
        shown++;
      } catch (_) {
        // Content script yüklü değil → scripting ile direkt inject et
        try {
          await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content_styles.css'] });
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['reconnect_overlay.js'] });
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (s) => window.TrackedReconnectOverlay?.show(s),
            args: [session]
          });
          shown++;
        } catch (e2) {
          console.warn('[SW] broadcastReconnectOverlay inject failed for tab', tab.id, e2.message);
        }
      }
    }
    console.log(`[SW] Broadcast reconnect overlay: ${shown}/${tabs.length} Roblox tabs`);
  } catch (e) {
    console.warn('[SW] broadcastReconnectOverlay error:', e);
  }
}

// Stale tracked_pending_* entry'lerini temizle (kullanıcı notification'ı ignore ettiyse 24h sonra sil)
async function cleanupStalePendingNotifications() {
  try {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const TTL_MS = 24 * 60 * 60 * 1000; // 24 saat
    const stale = [];
    for (const key of Object.keys(all)) {
      if (!key.startsWith('tracked_pending_')) continue;
      const entry = all[key];
      const age = now - (entry?.joinedAt || 0);
      if (age > TTL_MS) stale.push(key);
    }
    if (stale.length > 0) {
      await chrome.storage.local.remove(stale);
      console.log(`[SW] Cleaned up ${stale.length} stale tracked_pending_* entries`);
    }
  } catch (e) {
    console.warn('[SW] cleanupStalePendingNotifications error:', e);
  }
}

function triggerCrashNotification(session) {
  const id = `tracked_reconnect_${session.sessionId}`;
  const buttons = session.jobId
    ? [{ title: 'Aynı Server\'a Dön' }, { title: 'Yeni Server' }]
    : [{ title: 'Yeniden Gir' }];

  console.log('[SW] Creating crash notification:', id, 'for', session.gameTitle);

  // Yeni notification yaratırken stale entry'leri de temizle (best-effort, await yok)
  cleanupStalePendingNotifications();

  try {
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🔄 Bağlantı Kesildi',
      message: `${session.gameTitle} oynamaktaydın. Geri dönmek ister misin?`,
      buttons,
      requireInteraction: true,
      priority: 2
    }, (createdId) => {
      if (chrome.runtime.lastError) {
        console.warn('[SW] Notification create failed:', chrome.runtime.lastError.message);
        console.warn('[SW] Chrome notification permission verilmemiş olabilir — sistem ayarlarından kontrol et');
        // Notification yaratamadıysak metadata kaydetme (orphan storage leak önle)
        return;
      }
      console.log('[SW] Notification created successfully:', createdId);
      // Metadata sadece notification başarıyla oluşturulduysa kaydedilsin → handler'lar temizleyebilir
      chrome.storage.local.set({ [`tracked_pending_${id}`]: session });
    });
  } catch (err) {
    console.error('[SW] triggerCrashNotification error:', err);
  }
}

// Reconnect URL üret + tab aç
function performReconnect(session, useJobId) {
  const url = (useJobId && session.jobId)
    ? `roblox://experiences/start?placeId=${session.placeId}&gameInstanceId=${encodeURIComponent(session.jobId)}`
    : `roblox://experiences/start?placeId=${session.placeId}`;
  try {
    chrome.tabs.create({ url, active: true });
  } catch (e) {
    console.error('[SW] Reconnect tab.create failed:', e);
  }
}

// Notification handlers — sadece kendi prefix'imizi işle, mevcut handler'lara karışma
chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
  if (!notifId.startsWith('tracked_reconnect_')) return;
  try {
    const data = await chrome.storage.local.get(`tracked_pending_${notifId}`);
    const session = data[`tracked_pending_${notifId}`];
    if (!session) return;
    // Button 0 = same server (jobId varsa), Button 1 = new server
    const useJobId = (btnIdx === 0 && !!session.jobId);
    performReconnect(session, useJobId);
    chrome.notifications.clear(notifId);
    chrome.storage.local.remove(`tracked_pending_${notifId}`);
  } catch (e) { console.error('[SW] reconnect button handler error:', e); }
});

chrome.notifications.onClicked.addListener(async (notifId) => {
  if (!notifId.startsWith('tracked_reconnect_')) return;
  try {
    const data = await chrome.storage.local.get(`tracked_pending_${notifId}`);
    const session = data[`tracked_pending_${notifId}`];
    if (!session) return;
    // Body click = button 0 (rejoin same)
    performReconnect(session, !!session.jobId);
    chrome.notifications.clear(notifId);
    chrome.storage.local.remove(`tracked_pending_${notifId}`);
  } catch (e) { console.error('[SW] reconnect body click handler error:', e); }
});

chrome.notifications.onClosed.addListener((notifId) => {
  if (notifId.startsWith('tracked_reconnect_')) {
    chrome.storage.local.remove(`tracked_pending_${notifId}`);
  }
  if (notifId.startsWith('tracked_free_item_')) {
    const itemId = notifId.replace('tracked_free_item_', '');
    chrome.storage.local.remove(`tracked_free_meta_${itemId}`);
  }
  if (notifId.startsWith('tracked_watchjoin_')) {
    chrome.storage.local.remove(`tracked_watchpending_${notifId}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SUNUCU BEKÇİSİ (Server Watch) — kriterli sunucu izleme motoru
// ═══════════════════════════════════════════════════════════════════════════
async function stopServerWatchInternal() {
  try { await chrome.storage.local.remove('tracked_server_watch'); } catch {}
  try { chrome.alarms.clear('serverWatch'); } catch {}
}

let tkWatchRunning = false;   // aynı anda iki tik çalışmasın (geniş tarama uzun sürebilir → çakışmayı önle)
async function runServerWatchCheck() {
  if (tkWatchRunning) { console.log('[ServerWatch] önceki tik hâlâ sürüyor → bu tik atlandı'); return; }
  tkWatchRunning = true;
  try {
  const { tracked_server_watch: w } = await chrome.storage.local.get('tracked_server_watch');
  if (!w || !w.placeId) { try { chrome.alarms.clear('serverWatch'); } catch {} return; }

  // Güvenlik: süresiz çalışmasın → ~60 kontrol (~1 saat) sonra dur.
  w.checks = (w.checks || 0) + 1;
  if (w.checks > 60) { await stopServerWatchInternal(); return; }

  try {
    const fetchPage = async (order, cursor) => {
      try {
        const u = `https://games.roblox.com/v1/games/${w.placeId}/servers/Public?sortOrder=${order}&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
        const r = await fetch(u, { headers: { 'Accept': 'application/json' }, credentials: 'omit' });
        if (!r.ok) return null;
        return await r.json();
      } catch (_) { return null; }
    };
    // Kritere uyan sunucular (dolu değil, ≤ en fazla X, ≥ min FPS).
    const passes = (s) =>
      s && s.id && typeof s.playing === 'number' && typeof s.maxPlayers === 'number' &&
      s.playing < s.maxPlayers &&                          // dolu değil (per-server gerçek kapasite)
      s.playing >= (w.minPlayers || 0);                     // ≥ HEDEF (en az). Üst sınır yok: hedef bir alt sınırdır.

    // GENİŞ HAVUZ (~500): en boş sayfalar (Asc) sayfalanarak + en dolu 1 sayfa (Desc, yüksek hedef için). Dedupe.
    const seenIds = new Set();
    const allMatches = [];
    const POOL_MAX = 500;
    let cursor = '';
    for (let p = 0; p < 5 && allMatches.length < POOL_MAX; p++) {
      const d = await fetchPage('Asc', cursor);
      if (!d || !Array.isArray(d.data)) break;
      for (const s of d.data) { if (passes(s) && !seenIds.has(s.id)) { seenIds.add(s.id); allMatches.push(s); } }
      cursor = d.nextPageCursor;
      if (!cursor) break;   // daha fazla sayfa yok
    }
    {
      const d = await fetchPage('Desc', '');   // en dolu sayfa (yüksek hedef için)
      if (d && Array.isArray(d.data)) for (const s of d.data) { if (passes(s) && !seenIds.has(s.id)) { seenIds.add(s.id); allMatches.push(s); } }
    }
    if (!allMatches.length) { console.log(`[ServerWatch] tik ${w.checks}: kritere uyan sunucu yok (hedef ≥${w.minPlayers || 0}/${w.maxPlayers}) → bekleniyor`); await chrome.storage.local.set({ tracked_server_watch: w }); return; }

    // BÖLGE FİLTRESİ: sadece sana YAKIN sunucuları dikkate al; aralarından en dolusunu seç.
    // Konum tkResolveUserGeo ile GARANTİLENİR (cache yoksa Bekçi'nin kendisi çözer). Ölçülen ping bonus.
    const pingMap = await tkPingMap();
    const hasPing = Object.keys(pingMap).length > 0;
    const geo = await tkResolveUserGeo();                          // konumu garantile
    const hasGeo = !!(geo && geo.ok && typeof geo.lat === 'number');
    const userBest = hasPing ? Math.min(...Object.values(pingMap)) : null;
    const pingThr = (userBest != null) ? userBest + 60 : 130;      // ölçülen ping eşiği
    const distThr = (hasGeo && typeof geo.nearestDcKm === 'number') ? Math.round(geo.nearestDcKm * 1.5 + 400) : null; // mesafe eşiği (bölge kümen)

    // KRİTİK: Yakınlık verisi HİÇ yoksa (konum çözülemedi VE ping ölçümü yok) → uzak sunucu BİLDİRME, sessiz kal.
    // (Eski hatalı davranış: filtre kapanıp "en dolu"yu bildiriyordu → Tokyo gibi uzak sunucu geçiyordu.)
    if (!hasGeo && !hasPing) {
      console.warn('[ServerWatch] Yakınlık verisi yok (geo+ping çözülemedi) → uzak bildirimi önlemek için tik atlandı');
      await chrome.storage.local.set({ tracked_server_watch: w });
      return;
    }

    // Hedefe EN YAKIN (en az dolu ≥hedef) önce sırala; sırayla bölge çöz, İLK YAKIN olanı seç.
    // = en boş yakın sunucu (hedefe en yakın). En boş birkaçı uzaksa daha derine bakılır (15'e kadar).
    allMatches.sort((a, b) => (a.playing || 0) - (b.playing || 0));
    const SCAN_LIMIT = 100;       // GENİŞ: en fazla bu kadar aday çöz (İLK yakın bulununca durur — early-exit, genelde çok daha az)
    const SCAN_STEP_MS = 300;     // DİKKATLİ: gerçek (önbeleksiz) gamejoin çağrıları arası yastık → rate-limit'e takılmaz
    const scanN = Math.min(SCAN_LIMIT, allMatches.length);
    let match = null, mRegion = null, mMp = null, mDist = null;
    for (let i = 0; i < scanN; i++) {
      const s = allMatches[i];
      let reg = null;
      try { reg = await tkResolveServerRegion(w.placeId, s.id); } catch (_) {}
      const wasLiveCall = !(reg && reg.cached);   // cache hit değilse gerçek gamejoin atıldı
      if (reg && reg.ok && reg.region) {
        const mp = tkMeasuredPing(reg.region, pingMap);
        const dist = (hasGeo && typeof reg.lat === 'number' && typeof haversineKm === 'function') ? haversineKm(geo.lat, geo.lon, reg.lat, reg.lon) : null;
        let isNear = false;
        if (mp != null) isNear = mp <= pingThr;
        else if (dist != null && distThr != null) isNear = dist <= distThr;
        if (isNear) { match = s; mRegion = reg.region; mMp = mp; mDist = dist; break; }   // İLK yakın = hedefe en yakın
      }
      // Dikkatli ilerleme: yalnızca gerçek (önbeleksiz) çağrıdan sonra yastık bırak; önbellek hit'i anında geçilir.
      if (i < scanN - 1 && wasLiveCall) await new Promise(r => setTimeout(r, SCAN_STEP_MS));
    }
    if (!match) { console.log(`[ServerWatch] tik ${w.checks}: ${scanN} aday tarandı, sana YAKIN yok (distThr:${distThr}km) → bekleniyor`); await chrome.storage.local.set({ tracked_server_watch: w }); return; }

    // İZLEME mantığı (KRİTİK + NOKTA ATIŞI): yakın sunucu TAM hedef sayıda değilse BİLDİRME, izlemeye DEVAM et.
    // TARGET_TOL=0 → hedef 1 ise sadece yakın 1/22 sunucu açılınca bildirir (2/22 bile atılmaz).
    // (Watch'un amacı: tam kriterine uyan sunucu çıkana kadar bekleyip o anda haber vermek.)
    const TARGET_TOL = 0;
    if (match.playing > (w.minPlayers || 0) + TARGET_TOL) {
      console.log(`[ServerWatch] tik ${w.checks}: en boş yakın ${match.playing}/${match.maxPlayers}, hedef TAM ${w.minPlayers} değil → İZLEMEYE DEVAM (tam ${w.minPlayers}/${match.maxPlayers} bekleniyor)`);
      await chrome.storage.local.set({ tracked_server_watch: w });
      return;
    }
    const close = (mMp != null) ? ` ${mMp}ms` : (mDist != null ? ` ~${mDist}km` : '');
    const regionSuffix = ` · ${mRegion}${close}`;
    console.log(`[ServerWatch] YAKIN eşleşme: ${mRegion}${close} (${match.playing}/${match.maxPlayers}) — hedef≥${w.minPlayers}, geo:${hasGeo} ping:${hasPing}`);

    // ── EŞLEŞME bulundu → aksiyon, sonra DUR (tek eşleşme) ──
    if (w.action === 'autojoin') {
      try { chrome.tabs.create({ url: `roblox://experiences/start?placeId=${w.placeId}&gameInstanceId=${encodeURIComponent(match.id)}`, active: true }); } catch {}
      chrome.notifications.create(`tracked_watchinfo_${Date.now()}`, {
        type: 'basic', iconUrl: 'icons/icon128.png', title: 'Sunucu Bekçisi',
        message: `${w.gameTitle}: uygun sunucu bulundu (${match.playing}/${match.maxPlayers}${regionSuffix}) — katılınıyor.`,
        priority: 2
      });
    } else {
      const id = `tracked_watchjoin_${w.placeId}_${Date.now()}`;
      chrome.notifications.create(id, {
        type: 'basic', iconUrl: 'icons/icon128.png', title: 'Sunucu Bekçisi',
        message: `${w.gameTitle}: kriterine uygun sunucu açıldı (${match.playing}/${match.maxPlayers}${regionSuffix}). Katılmak için tıkla.`,
        buttons: [{ title: 'Katıl' }], requireInteraction: true, priority: 2
      }, (cid) => {
        if (chrome.runtime.lastError) return;
        chrome.storage.local.set({ [`tracked_watchpending_${id}`]: { placeId: w.placeId, jobId: match.id } });
      });
    }
    await stopServerWatchInternal();
  } catch (e) {
    try { await chrome.storage.local.set({ tracked_server_watch: w }); } catch {}
  }
  } finally { tkWatchRunning = false; }   // çakışma koruması: tik bitince serbest bırak
}

// Bekçi bildirimi → tıkla/buton: o sunucuya katıl
async function watchNotifJoin(notifId) {
  try {
    const data = await chrome.storage.local.get(`tracked_watchpending_${notifId}`);
    const p = data[`tracked_watchpending_${notifId}`];
    if (!p) return;
    chrome.tabs.create({ url: `roblox://experiences/start?placeId=${p.placeId}&gameInstanceId=${encodeURIComponent(p.jobId)}`, active: true });
    chrome.notifications.clear(notifId);
    chrome.storage.local.remove(`tracked_watchpending_${notifId}`);
  } catch (e) { console.error('[ServerWatch] join handler error:', e); }
}
chrome.notifications.onButtonClicked.addListener((notifId) => { if (notifId.startsWith('tracked_watchjoin_')) watchNotifJoin(notifId); });
chrome.notifications.onClicked.addListener((notifId) => { if (notifId.startsWith('tracked_watchjoin_')) watchNotifJoin(notifId); });

// ═══════════════════════════════════════════════════════════════════════════
// ÜCRETSİZ ITEM TAKİBİ — Catalog'daki yeni free item drop'larını yakala
// ═══════════════════════════════════════════════════════════════════════════
//
// Akış:
//   1. Her 30 dk Catalog API'sinden yeni free item'ları getir (SortType=Recent)
//   2. Cache'lenmiş "seen" listesi ile karşılaştır → yeni olanları bul
//   3. Yeni item'lar için Chrome notification göster (icon, button, click handler)
//   4. İlk çalıştırmada mevcut item'ları "seen" olarak işaretle (spam engelle)
//
// Settings:
//   tracked_free_items_enabled (bool, default: true)
//   tracked_free_items_seen (array of asset IDs, capped at 500)
//   tracked_free_items_initialized (bool — first-run protection)
//   tracked_free_items_last_check (timestamp)
//   tracked_free_items_history (array of recently detected items, capped at 30)
// ═══════════════════════════════════════════════════════════════════════════

async function checkForNewFreeItems(manual = false) {
  try {
    const stored = await chrome.storage.local.get([
      'tracked_free_items_enabled',
      'tracked_free_items_seen',
      'tracked_free_items_initialized',
      'tracked_free_items_history',
    ]);

    // "Bildirim" toggle'ı SADECE bildirim göndermeyi kontrol eder, taramayı DEĞİL.
    // Otomatik tarama (alarm): kapalıysa atla. MANUEL "Şimdi Tara": her zaman tara,
    // bildirim yalnızca açıksa gönderilir. (Bug fix: kapalıyken manuel tarama çalışmıyordu.)
    const notifyAllowed = stored.tracked_free_items_enabled !== false;
    if (!manual && !notifyAllowed) return;

    const items = await fetchCurrentFreeItems();
    if (!items.length) return;

    await chrome.storage.local.set({ tracked_free_items_last_check: Date.now() });

    const seenIds = new Set(stored.tracked_free_items_seen || []);
    const isInitialized = stored.tracked_free_items_initialized === true;

    // İlk çalıştırma: mevcut tüm free item'ları "seen" olarak işaretle, notification atma
    if (!isInitialized) {
      const allIds = items.map(it => String(it.id));
      await chrome.storage.local.set({
        tracked_free_items_seen: allIds,
        tracked_free_items_initialized: true,
      });
      console.log('[FreeItems] İlk seed:', allIds.length, 'item — notification atılmadı');
      return;
    }

    // Yeni (daha önce görülmemiş) item'lar — SADECE bildirim için. Panel HEPSİNİ gösterir.
    const newItems = items.filter(it => !seenIds.has(String(it.id)));

    // Bildirimler YALNIZCA yeni item'lar için + toggle açıkken (görülene tekrar bildirme).
    if (notifyAllowed && newItems.length > 0) {
      const lowStockItems = newItems.filter(it => it.isLowStock);
      const normalItems   = newItems.filter(it => !it.isLowStock);
      if (lowStockItems.length === 1) showFreeItemNotification(lowStockItems[0], /* urgent */ true);
      else if (lowStockItems.length > 1) showFreeItemsSummaryNotification(lowStockItems, /* urgent */ true);
      if (normalItems.length === 1) showFreeItemNotification(normalItems[0], /* urgent */ false);
      else if (normalItems.length > 1) showFreeItemsSummaryNotification(normalItems, /* urgent */ false);
    }

    // Tüm güncel item'ları seen olarak işaretle (bildirim dedup).
    for (const it of items) seenIds.add(String(it.id));

    // HISTORY = O ANKİ TÜM ücretsiz item'lar (panel her zaman güncel + dolu; yalnız "yeni drop"
    // değil — kullanıcı catalog'daki tüm ücretsiz itemleri görür). Önceki detectedAt'i KORU →
    // "X dk önce" doğru kalsın.
    const oldHistory = stored.tracked_free_items_history || [];
    const seenAt = new Map(oldHistory.map(h => [String(h.id), h.detectedAt]));
    const newHistory = items.map(it => ({
      id: it.id,
      name: it.name,
      creatorName: it.creatorName,
      imageUrl: it.imageUrl,
      saleLocationType: it.saleLocationType,
      saleLocation: it.saleLocation,
      unitsAvailable: it.unitsAvailable,
      unitsAvailableForConsumption: it.unitsAvailableForConsumption,
      isLowStock: it.isLowStock,
      detectedAt: seenAt.get(String(it.id)) || Date.now(),
    })).slice(0, 30);

    // Storage güncelle (seen listesi son 500 ile cap)
    await chrome.storage.local.set({
      tracked_free_items_seen: [...seenIds].slice(-500),
      tracked_free_items_history: newHistory,
    });

    console.log('[FreeItems] Yeni:', newItems.length, 'item bulundu, bildirim:', notifyAllowed ? 'açık' : 'kapalı', '(manuel:', manual, ')');
  } catch (e) {
    console.warn('[FreeItems] checkForNewFreeItems hatası:', e?.message);
  }
}

// Item'ın HALA ücretsiz ve alınabilir olduğunu doğrulayan KATI kontrol.
// Hem fresh fetch'te hem verify'da kullanılır → tutarlı davranış.
function isItemActuallyFree(it) {
  if (!it || !it.id || !it.name) return false;

  // 1. Fiyat 0 OLMALI (price veya lowestPrice)
  const priceZero = it.price === 0 || it.lowestPrice === 0;
  if (!priceZero) return false;

  // 2. priceStatus: sadece KESİN BİTMİŞ/PASİF durumları reject et.
  //    'Free', 'Limited' (UGC limited dağıtılıyor), null/undefined → ✓ kabul
  //    'OffSale', 'Sold', 'Discontinued', 'OutOfStock' → ✗ reject
  if (it.priceStatus === 'OffSale' || it.priceStatus === 'Sold'
      || it.priceStatus === 'Discontinued' || it.priceStatus === 'OutOfStock') return false;

  // 3. Süresi dolmuş OLMAMALI
  if (it.offSaleDeadline) {
    const deadline = new Date(it.offSaleDeadline).getTime();
    if (deadline && deadline < Date.now()) return false;
  }

  // 4. Satışa kapatılmış olmamalı
  if (it.isForSale === false) return false;

  // 5. STOK kontrolleri — Roblox tutarsız field kullanıyor, hepsini dene
  if (typeof it.unitsAvailableForConsumption === 'number' && it.unitsAvailableForConsumption <= 0) return false;
  if (typeof it.remainingStock === 'number' && it.remainingStock <= 0) return false;
  // totalQuantity vs quantitySold: tüm distributable kodlar dağıtıldı mı?
  if (typeof it.totalQuantity === 'number' && typeof it.quantitySold === 'number'
      && it.totalQuantity > 0 && it.quantitySold >= it.totalQuantity) return false;

  // 6. UGC limited (Collectible) SPECIAL: stok detection daha karmaşık
  if (it.itemRestrictions?.includes('Collectible')) {
    // lowestPrice null + lowestResalePrice > 0 → orijinal stok bitti, sadece resale market var
    if (it.lowestPrice == null && typeof it.lowestResalePrice === 'number' && it.lowestResalePrice > 0) return false;
    // saleLocation kontrolü: in-game distributed item ise, catalog 'available' gösterse bile
    // gerçek stok game tarafında bilinir. EK garanti: collectibleItemDetails varsa stok check
    if (it.collectibleItemDetails) {
      const det = it.collectibleItemDetails;
      // saleStatus 'Active' değilse reddet (PreSale, Ended, SoldOut, vb. hepsi reject)
      if (det.saleStatus && det.saleStatus !== 'Active') return false;
      // Available unit sayısı 0 ise reddet
      if (typeof det.unitsAvailable === 'number' && det.unitsAvailable <= 0) return false;
    }

    // ── AKILLI FİLTRE (Phase 3 — enrichCollectibleStock'tan gerçek marketplace verisi) ──
    // marketplace-items API: item sayfasının "Quantity Left / availability" gösterdiği AYNI kaynak.
    // Kullanıcı talebi: STOĞU/SATIŞI gözükmeyen item'ları radara ALMA.
    //   • saleStatus 'Active' değilse → fiilen satışta değil (PreSale/Paused/Ended/SoldOut) → reddet.
    //   • GLOBAL stok (unitsAvailable) gerçek pozitif sayı değilse → "stok gözükmüyor" demektir
    //     (experience-only item'larda global stok exposed edilmez → null/undefined) → reddet.
    //     (89473/gazaearrings gibi Flex UGC Codes item'larında unitsAvailable GERÇEK → geçer.)
    const md = it.marketplaceData;
    if (md) {
      // saleStatus AÇIKÇA Active değilse (OffSale/Ended/SoldOut/PreSale) → ele.
      if (md.saleStatus && md.saleStatus !== 'Active') return false;
      // SADECE açıkça tükenmiş (0/negatif) stoğu ele. null/undefined = API stok döndürmedi →
      // ELEME (sınırsız-ücretsiz ya da enrichment eksik olabilir; yoksa tüm liste boşalıyordu).
      if (typeof md.unitsAvailable === 'number' && md.unitsAvailable <= 0) return false;
    }
  }

  // 7. En azından bir fiyat field'ı tanımlı OLMALI (her ikisi de null = catalog'da olmadığını gösterir)
  //    Free Collectible'lar için lowestPrice 0 (price null olabilir) → OK çünkü priceZero check geçti
  //    Klasik free için price 0 olabilir → OK
  //    Sadece ikisi de null ise (no purchase data) reject
  if (it.lowestPrice == null && it.price == null) return false;

  return true;
}

// Collectible item'lar için Roblox marketplace-items API'sinden GERÇEK stok bilgisini al.
// Catalog details API bu konuda yetersiz — bu endpoint asıl truth source.
// Input: catalog details items array (Collectible olanlar)
// Output: enriched items with realStock { saleStatus, unitsAvailable, unitsAvailableForConsumption }
async function enrichCollectibleStock(items) {
  const collectibles = items.filter(it => it.itemRestrictions?.includes('Collectible') && it.collectibleItemId);
  if (collectibles.length === 0) return items;

  // Roblox tab bul (CSRF için MAIN world)
  let tab = null;
  try {
    const tabs = await chrome.tabs.query({ url: ['*://*.roblox.com/*'] });
    tab = tabs.find(t => t.active) || tabs[0];
  } catch {}
  if (!tab) return items;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: async (collectibleItemIds) => {
        const getCsrf = async () => {
          const meta = document.querySelector('meta[name="csrf-token"]')?.content;
          if (meta) return meta;
          try {
            const r = await fetch('https://auth.roblox.com/v2/logout', {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/json' }, body: '{}'
            });
            return r.headers.get('x-csrf-token') || '';
          } catch { return ''; }
        };

        const detailsMap = {};
        let csrf = await getCsrf();
        // marketplace-items endpoint — Collectible stok için doğru kaynak
        // Batch endpoint var: itemIds array geçilebilir
        for (let i = 0; i < collectibleItemIds.length; i += 30) {
          const batch = collectibleItemIds.slice(i, i + 30);
          const body = JSON.stringify({ itemIds: batch });
          const doPost = (token) => fetch('https://apis.roblox.com/marketplace-items/v1/items/details', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token, 'Accept': 'application/json' },
            body
          });
          try {
            let res = await doPost(csrf);
            if (res.status === 403) {
              const fresh = res.headers.get('x-csrf-token');
              if (fresh && fresh !== csrf) { csrf = fresh; res = await doPost(fresh); }
            }
            if (!res.ok) continue;
            const data = await res.json();
            const arr = data.data || data || [];
            for (const item of arr) {
              if (item.collectibleItemId) {
                detailsMap[String(item.collectibleItemId)] = {
                  saleStatus: item.saleStatus,
                  saleLocation: item.saleLocation,
                  unitsAvailable: item.unitsAvailable,
                  unitsAvailableForConsumption: item.unitsAvailableForConsumption,
                  quantityLimitPerUser: item.quantityLimitPerUser,
                  offSaleDeadline: item.offSaleDeadline,
                  price: item.price,
                  lowestPrice: item.lowestPrice,
                  lowestResalePrice: item.lowestResalePrice,
                };
              }
            }
          } catch {}
        }
        return detailsMap;
      },
      args: [collectibles.map(it => it.collectibleItemId)]
    }).catch(() => null);

    const detailsMap = results?.[0]?.result || {};
    return items.map(it => {
      if (!it.itemRestrictions?.includes('Collectible') || !it.collectibleItemId) return it;
      const real = detailsMap[String(it.collectibleItemId)];
      if (!real) return it;
      return {
        ...it,
        // Gerçek stok bilgisini override et
        marketplaceData: real,
        unitsAvailable: real.unitsAvailable ?? it.unitsAvailable,
        unitsAvailableForConsumption: real.unitsAvailableForConsumption ?? it.unitsAvailableForConsumption,
        saleStatus: real.saleStatus,
      };
    });
  } catch (e) {
    console.warn('[FreeItems] enrichCollectibleStock error:', e?.message);
    return items;
  }
}

// Item'ın gerçekten DÜŞÜK stoğu var mı (uyarı için, threshold = 5)
function isItemLowStock(it) {
  if (!it) return false;
  // SADECE experience-only (yalnız oyun içinde dağıtılan) item'larda catalog stoğu yanıltıcı —
  // bunları düşük-stok sayma. Flex UGC Codes / shop / catalog item'larında stok GERÇEK, sayılır.
  // SADECE gerçek oyun-içi (bir oyunun İÇİNDE satılan) item'larda stok sayma — orada uac per-user
  // limittir, yanıltıcı. ExperiencesDevApiOnly (Flex UGC Codes) + NotApplicable (catalog) → güvenilir.
  const slt = it.marketplaceData?.saleLocationType || it.saleLocationType || 'NotApplicable';
  if (/MyExperiencesOnly|ExperiencesById/i.test(slt)) return false;
  // Global stok (catalog) varsa onu; yoksa (Flex codes) mevcut adet (uac).
  const u = it.marketplaceData?.unitsAvailable ?? it.unitsAvailable;
  const c = it.marketplaceData?.unitsAvailableForConsumption ?? it.unitsAvailableForConsumption;
  const units = (typeof u === 'number') ? u : c;
  return typeof units === 'number' && units > 0 && units <= 5;
}

// Catalog API'sinden mevcut SATIN ALINABILIR free item'ları getir
// Off-sale, süresi dolmuş veya gerçekten ücretsiz olmayan item'ları filtreler.
async function fetchCurrentFreeItems() {
  const urls = [
    'https://catalog.roblox.com/v1/search/items/details?Category=1&Subcategory=2&MaxPrice=0&Limit=30&SortType=3',
    'https://catalog.roblox.com/v1/search/items/details?Category=1&MaxPrice=0&Limit=30&SortType=3',
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) continue;
      const data = await r.json();
      // PHASE 1: İlk filter (catalog details bazında)
      let filtered = (data.data || []).filter(it => isItemActuallyFree(it));
      if (filtered.length === 0) continue;

      // PHASE 2: Collectible item'lar için marketplace-items API ile GERÇEK stok bilgisi al
      filtered = await enrichCollectibleStock(filtered);

      // PHASE 3: Enriched data ile tekrar filtrele (stok gerçekten var mı?)
      filtered = filtered.filter(it => isItemActuallyFree(it));
      if (filtered.length === 0) continue;

      // Thumbnails API ile gerçek görsel URL'lerini al
      const ids = filtered.map(it => it.id);
      const thumbMap = await fetchItemThumbnails(ids);

      return filtered.map(it => ({
        id: it.id,
        name: it.name,
        creatorName: it.creatorName || it.creator?.name || 'Roblox',
        creatorType: it.creatorType,
        itemType: it.itemType,
        imageUrl: thumbMap[String(it.id)] || null,
        saleLocationType: it.saleLocationType || 'NotApplicable',
        saleLocation: it.saleLocation || null,
        // Stok bilgileri (düşük stok uyarısı için)
        unitsAvailable: it.marketplaceData?.unitsAvailable ?? it.unitsAvailable ?? null,
        unitsAvailableForConsumption: it.marketplaceData?.unitsAvailableForConsumption ?? it.unitsAvailableForConsumption ?? null,
        isLowStock: isItemLowStock(it),
      }));
    } catch { }
  }
  return [];
}

// Roblox Thumbnails API — proper image URLs (asset-thumbnail/image deprecated bazı item'lar için)
async function fetchItemThumbnails(assetIds) {
  if (!assetIds?.length) return {};
  const out = {};
  // Thumbnails API batch — 100 ID per request
  for (let i = 0; i < assetIds.length; i += 100) {
    const batch = assetIds.slice(i, i + 100).join(',');
    try {
      const url = `https://thumbnails.roblox.com/v1/assets?assetIds=${batch}&size=150x150&format=Png&isCircular=false`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) continue;
      const data = await r.json();
      for (const item of (data.data || [])) {
        if (item.state === 'Completed' && item.imageUrl) {
          out[String(item.targetId)] = item.imageUrl;
        }
      }
    } catch { }
  }
  return out;
}

function showFreeItemNotification(item, urgent = false) {
  const notifId = `tracked_free_item_${item.id}`;

  chrome.storage.local.set({
    [`tracked_free_meta_${item.id}`]: { id: item.id, name: item.name }
  });

  const units = item.unitsAvailable; // global stok (per-user limit DEĞİL → yanıltıcı sayı olmaz)
  let title, message;
  if (urgent && typeof units === 'number') {
    title = `STOK AZ — ${units} adet kaldı`;
    message = `${item.name}\nBy ${item.creatorName}\nAcele et, stok bitiyor!`;
  } else if (urgent) {
    title = 'STOK AZ — Son birkaç adet';
    message = `${item.name}\nBy ${item.creatorName}\nAcele et!`;
  } else {
    title = 'Yeni Ücretsiz Item';
    message = `${item.name}\nBy ${item.creatorName}`;
  }

  chrome.notifications.create(notifId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message,
    buttons: [
      { title: 'Görüntüle' },
      { title: 'Kapat' },
    ],
    requireInteraction: false, // 30 saniye sonra otomatik kapansın
    priority: urgent ? 2 : 1,  // Urgent için yüksek öncelik (üstte gözüksün)
  });

  // Auto-clear after 30 seconds via chrome.alarms (SW kill-resistant)
  try { chrome.alarms.create(`fi_autoclear_${item.id}`, { delayInMinutes: 0.5 }); } catch {}
}

// Birden çok yeni item için tek özet bildirim — "Hepsini Gör" Free Items panelini açar
function showFreeItemsSummaryNotification(items, urgent = false) {
  if (!items || items.length === 0) return;
  const summaryId = `tracked_free_summary_${Date.now()}`;
  const count = items.length;

  // İlk 3 item adı message body'sinde gösterilsin
  const previewNames = items.slice(0, 3).map(it => `• ${it.name}`).join('\n');
  const more = count > 3 ? `\n+${count - 3} daha…` : '';

  const title = urgent
    ? `STOK AZ — ${count} item kritik`
    : `${count} yeni ücretsiz item bulundu`;
  const message = `${previewNames}${more}`;

  chrome.notifications.create(summaryId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title,
    message,
    buttons: [
      { title: 'Hepsini Gör' },
      { title: 'Kapat' },
    ],
    requireInteraction: false,
    priority: urgent ? 2 : 1,
  });

  // Auto-clear (30 saniye)
  try { chrome.alarms.create(`fi_autoclear_summary_${summaryId.split('_').pop()}`, { delayInMinutes: 0.5 }); } catch {}
}

// Notification handlers — free item prefix'i ile (mevcut reconnect handler'larıyla çakışmaz)
chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
  // Summary notification: "Hepsini Gör" → Free Items panelini aç
  if (notifId.startsWith('tracked_free_summary_')) {
    try {
      if (btnIdx === 0) {
        chrome.tabs.create({ url: 'https://www.roblox.com/home#tk-free-items', active: true });
      }
      chrome.notifications.clear(notifId);
    } catch (e) { console.error('[FreeItems] summary button handler:', e); }
    return;
  }

  if (!notifId.startsWith('tracked_free_item_')) return;
  try {
    const itemId = notifId.replace('tracked_free_item_', '');
    if (btnIdx === 0) {
      // Görüntüle — catalog sayfasını yeni sekmede aç
      chrome.tabs.create({ url: `https://www.roblox.com/catalog/${itemId}`, active: true });
    }
    chrome.notifications.clear(notifId);
    chrome.storage.local.remove(`tracked_free_meta_${itemId}`);
    chrome.alarms.clear(`fi_autoclear_${itemId}`); // Auto-clear alarm'ı iptal et
  } catch (e) { console.error('[FreeItems] button handler:', e); }
});

chrome.notifications.onClicked.addListener(async (notifId) => {
  // Summary notification body click → Free Items panelini aç
  if (notifId.startsWith('tracked_free_summary_')) {
    try {
      chrome.tabs.create({ url: 'https://www.roblox.com/home#tk-free-items', active: true });
      chrome.notifications.clear(notifId);
    } catch (e) { console.error('[FreeItems] summary click handler:', e); }
    return;
  }
  if (!notifId.startsWith('tracked_free_item_')) return;
  try {
    const itemId = notifId.replace('tracked_free_item_', '');
    chrome.tabs.create({ url: `https://www.roblox.com/catalog/${itemId}`, active: true });
    chrome.notifications.clear(notifId);
    chrome.storage.local.remove(`tracked_free_meta_${itemId}`);
    chrome.alarms.clear(`fi_autoclear_${itemId}`);
  } catch (e) { console.error('[FreeItems] click handler:', e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Medya araması — yardımcılar (gizli işçi sekme + sayfa-context arama)
// ─────────────────────────────────────────────────────────────────────────────
async function npFindSiteTab(source) {
  const tabs = await chrome.tabs.query({}).catch(() => []);
  const m = (u) => source === 'ytmusic' ? /music\.youtube\.com/.test(u || '')
    : source === 'spotify' ? /open\.spotify\.com/.test(u || '')
    : (/(^|\.)youtube\.com/.test(u || '') && !/music\.youtube\.com/.test(u || ''));
  return tabs.find(t => m(t.url)) || null;
}
function npWaitTabComplete(tabId, timeout) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; try { chrome.tabs.onUpdated.removeListener(l); } catch (_) {} resolve(); };
    const l = (id, info) => { if (id === tabId && info.status === 'complete') finish(); };
    chrome.tabs.onUpdated.addListener(l);
    chrome.tabs.get(tabId).then(t => { if (t && t.status === 'complete') finish(); }).catch(() => {});
    setTimeout(finish, timeout || 9000);
  });
}
async function npGetWorker(source) {
  const existing = await npFindSiteTab(source);
  if (existing) return existing.id;
  self._npWorker = self._npWorker || {};
  const prev = self._npWorker[source];
  if (prev != null) { const t = await chrome.tabs.get(prev).catch(() => null); if (t) return prev; }
  const url = source === 'ytmusic' ? 'https://music.youtube.com/' : 'https://open.spotify.com/';
  const tab = await chrome.tabs.create({ url, active: false }).catch(() => null); // gizli arka plan işçi (odaksız)
  if (!tab) return null;
  self._npWorker[source] = tab.id;
  await npWaitTabComplete(tab.id, 12000);
  await new Promise(r => setTimeout(r, 800)); // SPA cfg/jeton oturması için ek pay
  return tab.id;
}
async function npSearchInTab(tabId, source, q) {
  const fn = source === 'ytmusic' ? npYtmSearchInPage : source === 'spotify' ? npSpSearchInPage : npYtSearchInPage;
  for (let i = 0; i < 7; i++) {
    try {
      const res = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', args: [q], func: fn });
      const r = res && res[0] && res[0].result;
      if (r && r.ok) return r;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 700));
  }
  return { ok: false, error: 'page' };
}

// YouTube headless (sekme yokken) — sonuç sayfası HTML'i + ytInitialData + gerçek context ile continuation (33'e kadar)
async function npYoutubeHeadless(q) {
  try {
    const html = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=tr`, { credentials: 'include' }).then(r => r.text());
    const raw = npBraceMatch(html, 'ytInitialData = ') || npBraceMatch(html, 'ytInitialData"]');
    if (!raw) return { ok: false, error: 'parse' };
    let data; try { data = JSON.parse(raw); } catch (_) { return { ok: false, error: 'json' }; }
    const out = []; let cont = null;
    const walk = (o) => {
      if (!o || typeof o !== 'object' || out.length >= 33) return;
      if (Array.isArray(o)) { for (const x of o) walk(x); return; }
      const vr = o.videoRenderer;
      if (vr && vr.videoId && vr.title && vr.title.runs && vr.title.runs[0]) {
        const th = (vr.thumbnail && vr.thumbnail.thumbnails) || [];
        out.push({ id: vr.videoId, target: 'youtube', title: vr.title.runs[0].text || '', channel: (vr.ownerText && vr.ownerText.runs && vr.ownerText.runs[0] && vr.ownerText.runs[0].text) || (vr.longBylineText && vr.longBylineText.runs && vr.longBylineText.runs[0] && vr.longBylineText.runs[0].text) || '', duration: (vr.lengthText && vr.lengthText.simpleText) || '', thumb: th.length ? th[0].url : '' });
      }
      if (o.continuationItemRenderer) { try { const tk = o.continuationItemRenderer.continuationEndpoint.continuationCommand.token; if (tk) cont = tk; } catch (_) {} }
      for (const k in o) walk(o[k]);
    };
    walk(data);
    // Devam (gerçek INNERTUBE_CONTEXT ile → güvenilir; host izniyle CORS aşılır) — 33'e kadar döngü
    const key = (html.match(/"INNERTUBE_API_KEY":"(.*?)"/) || [])[1];
    const ctxRaw = npBraceMatch(html, '"INNERTUBE_CONTEXT":');
    let context = null; try { context = ctxRaw ? JSON.parse(ctxRaw) : null; } catch (_) {}
    let guard = 0;
    while (out.length < 33 && cont && key && context && guard++ < 4) {
      const c = cont; cont = null;
      try {
        const d2 = await fetch('https://www.youtube.com/youtubei/v1/search?key=' + key + '&prettyPrint=false', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context, continuation: c }) }).then(r => r.json());
        walk(d2);
      } catch (_) { break; }
    }
    return { ok: true, results: out };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Aşağıdakiler MAIN world'de (sitenin SAYFA CONTEXT'inde) çalışır → key/çerez/jeton/sürüm hep geçerli
async function npYtSearchInPage(query) {
  try {
    const cfg = (window.ytcfg && ytcfg.get) ? ytcfg : null;
    const key = cfg ? cfg.get('INNERTUBE_API_KEY') : (window.yt && yt.config_ && yt.config_.INNERTUBE_API_KEY);
    const ctx = cfg ? cfg.get('INNERTUBE_CONTEXT') : (window.yt && yt.config_ && yt.config_.INNERTUBE_CONTEXT);
    if (!key || !ctx) return { ok: false, error: 'cfg' };
    const post = (extra) => fetch('/youtubei/v1/search?key=' + key + '&prettyPrint=false', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ context: ctx }, extra)) }).then(r => r.json());
    const out = []; let cont = null;
    const walk = (o) => {
      if (!o || typeof o !== 'object' || out.length >= 33) return;
      if (Array.isArray(o)) { for (const x of o) walk(x); return; }
      const vr = o.videoRenderer;
      if (vr && vr.videoId && vr.title && vr.title.runs && vr.title.runs[0]) {
        const th = (vr.thumbnail && vr.thumbnail.thumbnails) || [];
        out.push({ id: vr.videoId, target: 'youtube', title: vr.title.runs[0].text || '', channel: (vr.ownerText && vr.ownerText.runs && vr.ownerText.runs[0] && vr.ownerText.runs[0].text) || (vr.longBylineText && vr.longBylineText.runs && vr.longBylineText.runs[0] && vr.longBylineText.runs[0].text) || '', duration: (vr.lengthText && vr.lengthText.simpleText) || '', thumb: th.length ? th[0].url : '' });
      }
      if (o.continuationItemRenderer) { try { const tk = o.continuationItemRenderer.continuationEndpoint.continuationCommand.token; if (tk) cont = tk; } catch (_) {} }
      for (const k in o) walk(o[k]);
    };
    walk(await post({ query }));
    let guard = 0;
    while (out.length < 33 && cont && guard++ < 4) { const c = cont; cont = null; try { walk(await post({ continuation: c })); } catch (_) { break; } }
    return { ok: true, results: out };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
async function npYtmSearchInPage(query) {
  try {
    const cfg = (window.ytcfg && ytcfg.get) ? ytcfg : null;
    const key = cfg ? cfg.get('INNERTUBE_API_KEY') : null;
    const ctx = cfg ? cfg.get('INNERTUBE_CONTEXT') : null;
    if (!key || !ctx) return { ok: false, error: 'cfg' };
    const r = await fetch('/youtubei/v1/search?key=' + key + '&prettyPrint=false', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: ctx, query }) }).then(x => x.json());
    const out = [];
    const walk = (o) => {
      if (!o || typeof o !== 'object' || out.length >= 33) return;
      if (Array.isArray(o)) { for (const x of o) walk(x); return; }
      const it = o.musicResponsiveListItemRenderer;
      if (it) {
        let vid = '';
        try { vid = it.playlistItemData && it.playlistItemData.videoId; } catch (_) {}
        if (!vid) { try { vid = it.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.videoId; } catch (_) {} }
        const cols = it.flexColumns || [];
        const colText = (i) => { try { return cols[i].musicResponsiveListItemFlexColumnRenderer.text.runs.map(x => x.text).join(''); } catch (_) { return ''; } };
        const title = colText(0), sub = colText(1);
        let thumb = '';
        try { const tt = it.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails; thumb = tt.length ? tt[0].url : ''; } catch (_) {}
        if (vid && title) out.push({ id: vid, target: 'ytmusic', title, channel: sub, duration: '', thumb });
      }
      for (const k in o) walk(o[k]);
    };
    walk(r);
    return { ok: true, results: out };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
async function npSpSearchInPage(query) {
  try {
    const tk = await fetch('/get_access_token?reason=transport&productType=web_player', { credentials: 'include' }).then(r => r.json()).catch(() => null);
    const at = tk && tk.accessToken;
    if (!at) return { ok: false, error: 'token' };
    const data = await fetch('https://api.spotify.com/v1/search?type=track&limit=33&q=' + encodeURIComponent(query), { headers: { Authorization: 'Bearer ' + at } }).then(r => r.json()).catch(() => null);
    const items = (data && data.tracks && data.tracks.items) || [];
    const fmt = (ms) => { const s = Math.round((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const out = items.map(t => ({ id: t.id, target: 'spotify', url: (t.external_urls && t.external_urls.spotify) || ('https://open.spotify.com/track/' + t.id), title: t.name || '', channel: (t.artists || []).map(a => a.name).join(', '), duration: fmt(t.duration_ms), thumb: (t.album && t.album.images && t.album.images.length) ? t.album.images[t.album.images.length - 1].url : '' }));
    return { ok: true, results: out };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

// Parantez-eşleştirmeli JSON çıkarıcı (string/escape duyarlı)
function npBraceMatch(s, marker) {
  const i = s.indexOf(marker); if (i < 0) return null;
  let st = s.indexOf('{', i); if (st < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = st; j < s.length; j++) {
    const ch = s[j];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; }
    else if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { if (--depth === 0) return s.slice(st, j + 1); }
  }
  return null;
}
function npWalkYtm(data, out) {
  const walk = (o) => {
    if (!o || typeof o !== 'object' || out.length >= 33) return;
    if (Array.isArray(o)) { for (const x of o) walk(x); return; }
    const it = o.musicResponsiveListItemRenderer;
    if (it) {
      let vid = '';
      try { vid = it.playlistItemData && it.playlistItemData.videoId; } catch (_) {}
      if (!vid) { try { vid = it.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.videoId; } catch (_) {} }
      const cols = it.flexColumns || [];
      const colText = (i) => { try { return cols[i].musicResponsiveListItemFlexColumnRenderer.text.runs.map(x => x.text).join(''); } catch (_) { return ''; } };
      const title = colText(0), sub = colText(1);
      let thumb = '';
      try { const tt = it.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails; thumb = tt.length ? tt[0].url : ''; } catch (_) {}
      if (vid && title) out.push({ id: vid, target: 'ytmusic', title, channel: sub, duration: '', thumb });
    }
    for (const k in o) walk(o[k]);
  };
  walk(data);
}
// Headless YT Music — sayfanın gerçek INNERTUBE_CONTEXT'ini HTML'den çıkar, InnerTube POST (sekme açmaz)
async function npYtmHeadless(q) {
  try {
    const html = await fetch('https://music.youtube.com/', { credentials: 'include' }).then(r => r.text());
    const key = (html.match(/"INNERTUBE_API_KEY":"(.*?)"/) || [])[1];
    const ctxRaw = npBraceMatch(html, '"INNERTUBE_CONTEXT":');
    if (!key || !ctxRaw) return { ok: false, error: 'cfg' };
    let context; try { context = JSON.parse(ctxRaw); } catch (_) { return { ok: false, error: 'ctx' }; }
    const data = await fetch('https://music.youtube.com/youtubei/v1/search?key=' + key + '&prettyPrint=false', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context, query: q })
    }).then(r => r.json());
    const out = []; npWalkYtm(data, out);
    return { ok: true, results: out };
  } catch (e) { return { ok: false, error: e.message }; }
}
// Headless Spotify — oturum/anonim jeton (sekme açmaz)
async function npSpHeadless(q) {
  try {
    const tok = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', { credentials: 'include' }).then(r => r.json()).catch(() => null);
    const at = tok && tok.accessToken;
    if (!at) return { ok: false, error: 'token' };
    const data = await fetch('https://api.spotify.com/v1/search?type=track&limit=33&q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + at } }).then(r => r.json()).catch(() => null);
    const items = (data && data.tracks && data.tracks.items) || [];
    const fmt = (ms) => { const s = Math.round((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const out = items.map(t => ({ id: t.id, target: 'spotify', url: (t.external_urls && t.external_urls.spotify) || ('https://open.spotify.com/track/' + t.id), title: t.name || '', channel: (t.artists || []).map(a => a.name).join(', '), duration: fmt(t.duration_ms), thumb: (t.album && t.album.images && t.album.images.length) ? t.album.images[t.album.images.length - 1].url : '' }));
    return { ok: true, results: out };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Offscreen gizli oynatıcı (varsayılan) + pencere yedeği (gömülemeyen videolar)
// ─────────────────────────────────────────────────────────────────────────────
async function ensureOffscreen() {
  if (!chrome.offscreen) return false; // eski tarayıcı → pencereye düş
  try { if (await chrome.offscreen.hasDocument()) return true; } catch (_) {}
  try {
    await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Şu An Çalıyor: arka planda gizli müzik çalma' });
    return true;
  } catch (e) { return /already|single/i.test(String((e && e.message) || e)); } // zaten varsa OK say
}

// NORMAL sekmede çal (popup pencere DEĞİL). Arka plan sekmesi gizli sayıldığı için YouTube başlatmaz →
// sekmeyi KISA SÜRE öne al, çalmaya başlat, sonra kullanıcının sekmesine geri dön. Tek sekme, yeniden kullanılır.
async function npPlayInWindow(url, id) {
  try {
    const qa = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    const cur = qa && qa[0]; // geri dönülecek (Roblox) sekme
    let tab = self._mediaPlayTab != null ? await chrome.tabs.get(self._mediaPlayTab).catch(() => null) : null;
    if (tab) { await chrome.tabs.update(tab.id, { url, active: true }); }
    else { tab = await chrome.tabs.create({ url, active: true }); self._mediaPlayTab = tab.id; }
    self._mediaLastTabId = tab.id;
    const playId = id; self._mediaPlayReq = playId;
    // Öndeyken çalmaya başlat (foreground → autoplay çalışır)
    for (let i = 0; i < 10; i++) {
      if (self._mediaPlayReq !== playId) return;
      let playing = false;
      try {
        const res = await chrome.scripting.executeScript({
          target: { tabId: tab.id }, world: 'MAIN',
          func: () => { try { const mp = document.querySelector('#movie_player'); if (!mp || !mp.playVideo) return false; if (mp.getPlayerState && mp.getPlayerState() === 1) return true; try { if (mp.isMuted && mp.isMuted()) mp.unMute(); } catch (_) {} mp.playVideo(); return false; } catch (_) { return false; } }
        });
        playing = !!(res && res[0] && res[0].result);
      } catch (_) {}
      if (playing) break;
      await new Promise(r => setTimeout(r, 400));
    }
    // çalmaya başladı → kullanıcının (Roblox) sekmesine geri dön (YouTube arka planda çalmaya devam eder)
    if (self._mediaPlayReq === playId && cur && cur.id && cur.id !== tab.id) { try { await chrome.tabs.update(cur.id, { active: true }); } catch (_) {} }
  } catch (_) {}
}

// Offscreen çalmadı/gömülemedi → o video için PENCERE yedeğine düş (şarkı her zaman çalsın)
function npFallbackToWindow(videoId, target) {
  if (!videoId || self._offFellBack) return;
  self._offFellBack = true; self._offActive = false;
  try { chrome.runtime.sendMessage({ off: 'stop' }).catch(() => {}); } catch (_) {}
  const url = ((target || self._offTarget) === 'ytmusic' ? `https://music.youtube.com/watch?v=${videoId}` : `https://www.youtube.com/watch?v=${videoId}`) + '&autoplay=1';
  npPlayInWindow(url, videoId);
}
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.off === 'error') {
    console.warn('[Tracked NP] offscreen onError code=', msg.code, 'video=', msg.videoId);
    if (msg.videoId && msg.videoId === self._offVideoId) npFallbackToWindow(msg.videoId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OYUN KODLARI — DÜRÜST kaynaklar: küratörlü repo (varsa gerçek) + oyun açıklaması +
// oyunun RESMİ sosyal linkleri (kodlar gerçekten orada duyurulur) + web araması.
// Resmi/yapısal Roblox kod API'si YOK → uydurma yok; her şey kaynak + "doğrulanmamış" etiketli.
// ─────────────────────────────────────────────────────────────────────────────
async function gcGetUniverse(placeId) {
  try { const r = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`).then(r => r.json()); return r && r.universeId; } catch (_) { return null; }
}
async function gcGetDetails(universeId) {
  try { const r = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`, { credentials: 'include' }).then(r => r.json()); return (r && r.data && r.data[0]) || null; } catch (_) { return null; }
}
async function gcGetSocials(universeId) {
  try { const r = await fetch(`https://games.roblox.com/v1/games/${universeId}/social-links/list`, { credentials: 'include' }).then(r => r.json()); return (r && r.data) || []; } catch (_) { return []; }
}
function gcScanDescription(desc) {
  if (!desc) return [];
  const out = [], seen = new Set();
  const bad = new Set(['CODE', 'CODES', 'KOD', 'KODLAR', 'HERE', 'FREE', 'NEW', 'GAME', 'PLAY', 'USE', 'THE', 'FOR', 'AND', 'GET', 'YOUR', 'THIS', 'UPDATE', 'SHUTDOWN', 'VISIT', 'LIKE', 'JOIN', 'GROUP', 'NOW', 'OUT', 'WIP', 'BETA', 'SOON', 'TWITTER', 'DISCORD', 'YOUTUBE', 'REDEEM']);
  const re = /(?:code[s]?|kod[lar]*|redeem|use)\s*[:\-—]?\s*["“'`]?([A-Za-z0-9][A-Za-z0-9_]{2,23})/gi;
  let m;
  while ((m = re.exec(desc)) && out.length < 25) {
    const t = m[1], up = t.toUpperCase();
    if (seen.has(up) || bad.has(up)) continue;
    const codeLike = /\d/.test(t) || (t === up && t.length >= 4) || (/[A-Z]/.test(t) && /[a-z]/.test(t) && t.length >= 5);
    if (!codeLike) continue;
    seen.add(up); out.push({ code: t, reward: '', source: 'desc' });
  }
  return out;
}
async function gcGetRepoCodes(name) {
  try {
    if (!self._gcRepoList || Date.now() - self._gcRepoList.t > 6 * 3600e3) {
      const list = await fetch('https://api.github.com/repos/Progameguides/Roblox-Games-Codes/contents/codes').then(r => r.json());
      self._gcRepoList = { files: Array.isArray(list) ? list.map(f => f.name) : [], t: Date.now() };
    }
    const clean = String(name || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return null;
    const fullSlug = clean.replace(/ /g, '-');
    // jenerik kelimeleri ele (yanlış eşleşme olmasın), ayırt edici kelimelerle eşle
    const generic = new Set(['game', 'games', 'update', 'codes', 'code', 'beta', 'live', 'event', 'replays', 'chapter', 'new', 'simulator', 'tycoon', 'pets', 'pet', 'rpg', 'the', 'and', 'with', 'roblox', 'obby', 'story', 'world', 'battle', 'battlegrounds', 'defense', 'legacy', 'remastered']);
    // tam slug eşleşmesi önce; sonra YALNIZ ayırt edici (6+ harf) kelimeyle gevşek eşleşme (yanlış eşleşmeyi önler)
    const words = clean.split(' ').filter(w => w.length >= 6 && !generic.has(w));
    const file = self._gcRepoList.files.find(f => f === fullSlug + '-codes.md') ||
      self._gcRepoList.files.find(f => words.some(w => f.includes(w)));
    if (!file) return null;
    const md = await fetch(`https://raw.githubusercontent.com/Progameguides/Roblox-Games-Codes/main/codes/${file}`).then(r => r.text());
    const cut = md.search(/expired/i);
    const head = cut > 0 ? md.slice(0, cut) : md;
    const codes = []; const rowRe = /^\|\s*\*{0,2}([A-Za-z0-9_!#@%&\-]{3,30})\*{0,2}\s*\|\s*([^|]+?)\s*\|/gm;
    let m;
    while ((m = rowRe.exec(head)) && codes.length < 30) {
      const code = m[1].trim(), reward = m[2].replace(/\*/g, '').trim();
      if (/^code$/i.test(code) || /^-+$/.test(code)) continue;
      codes.push({ code, reward, source: 'repo' });
    }
    return codes.length ? { file, codes } : null;
  } catch (_) { return null; }
}


