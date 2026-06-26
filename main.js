// main.js - Tracked Extension v3.7 Main Application Module (Smart Activity Tracking)

// ─── SUNUCU BÖLGE TESPİTİ (RoSeal tarzı) ──────────────────────────────────────
// Sunucunun gerçek datacenter bölgesi + sana mesafe + sürüm. Kaynak: gamejoin
// joinScript IP'si (BAT'lı) → SW resolveServerRegion → datacenters.js CIDR eşleme.
// Performans% buradan DEĞİL, sunucu listesi fps'inden gelir (BAT'sız, her zaman çalışır).
const TrackedRegion = {
    _geo: null,                      // { lat, lon } kullanıcı konumu (oturum içi cache)
    _pingByCountry: null,            // { DE:45, NL:52, ... } popup'ta ölçülen gerçek bölgesel ping (geri düşüş)
    _regionPings: null,              // [{cc,lat,lon,ms}] SW'nin ölçtüğü KÜRESEL koordinatlı ping'ler (birincil)
    AUTO_LIMIT: 8,                   // Derin'de otomatik çözülen üst sunucu sayısı
    STEP_MS: 350,                    // Çağrılar arası yastık (rate-limit'e karşı)

    _swMsg(msg) {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(msg, (resp) => {
                    if (chrome.runtime.lastError) resolve(null); else resolve(resp);
                });
            } catch (_) { resolve(null); }
        });
    },

    async getUserGeo(placeId) {
        if (this._geo) return this._geo;
        // 1) IP-geo (varsa daha ince konum)
        let r = await this._swMsg({ action: 'resolveUserLocation' });
        if (r && r.ok && typeof r.lat === 'number') { this._geo = { lat: r.lat, lon: r.lon, nearestDcKm: r.nearestDcKm ?? null, nearestDcCity: r.nearestDcCity ?? null }; return this._geo; }
        // 2) AD-BLOCKER-PROOF fallback: Roblox matchmaker bölgesi (gameId'siz gamejoin → senin bölgen)
        const pid = placeId || (location.pathname.match(/\/games\/(\d+)/) || [])[1];
        if (pid) {
            r = await this._swMsg({ action: 'resolveMyRegion', placeId: pid });
            if (r && r.ok && typeof r.lat === 'number') { this._geo = { lat: r.lat, lon: r.lon, nearestDcKm: r.nearestDcKm ?? null, nearestDcCity: r.nearestDcCity ?? null }; return this._geo; }
        }
        return this._geo;  // null → mesafe hesaplanamaz (bölge yine gösterilir)
    },

    // Haversine — iki koordinat arası km (tam sayı). Eksik veri → null.
    distanceKm(lat1, lon1, lat2, lon2) {
        if ([lat1, lon1, lat2, lon2].some(v => typeof v !== 'number')) return null;
        const R = 6371, toRad = d => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    },

    // Performans % = fps/60 (fizik adım hızı). Liste verisinden, BAT'sız.
    perfPct(server) {
        const fps = server && server.fps;
        if (!fps || fps <= 0) return null;
        return Math.max(0, Math.min(100, Math.round((fps / 60) * 100)));
    },

    // Popup'ta ölçülen gerçek bölgesel ping'leri ülke koduna göre yükle (bir kez, oturum cache).
    // rota_ping_cache.results = [{region:"Almanya (DE)", ms:45}, ...] → { DE:45, NL:52, ... }
    async _loadPingMap() {
        if (this._pingByCountry !== null) return this._pingByCountry;
        this._pingByCountry = {};
        try {
            const st = await new Promise(res => { try { chrome.storage.local.get(['rota_ping_cache', 'rota_ping_results'], res); } catch (_) { res({}); } });
            let results = st?.rota_ping_cache?.results;
            if (!Array.isArray(results) || !results.length) results = st?.rota_ping_results;
            if (Array.isArray(results)) {
                for (const r of results) {
                    if (!r || typeof r.ms !== 'number' || r.ms <= 0 || r.ms >= 900) continue;
                    const m = /\(([A-Z]{2})\)/.exec(r.region || '');
                    if (m) {
                        const cc = m[1];
                        if (!(cc in this._pingByCountry) || r.ms < this._pingByCountry[cc]) this._pingByCountry[cc] = Math.round(r.ms);
                    }
                }
            }
        } catch (_) {}
        return this._pingByCountry;
    },

    // Sunucunun bölgesi için kullanıcının ÖLÇÜLEN ping'i → ms | null
    // 1) KOORDİNAT bazlı (kapsamlı/doğru): datacenter'a EN YAKIN ölçülen probe. US-Doğu/Batı bile ayrışır,
    //    ülke etiketi tutmasa bile çalışır (mesafeyle eşler).
    // 2) Geri düşüş: ülke kodu haritası (popup manuel testi).
    measuredPing(server) {
        if (!server) return null;
        const lat = server.regionLat, lon = server.regionLon;
        if (Array.isArray(this._regionPings) && this._regionPings.length && typeof lat === 'number' && typeof lon === 'number') {
            let best = null, bestD = Infinity;
            for (const p of this._regionPings) {
                const d = this.distanceKm(lat, lon, p.lat, p.lon);
                if (d != null && d < bestD) { bestD = d; best = p; }
            }
            if (best && typeof best.ms === 'number') return best.ms;
        }
        if (this._pingByCountry && typeof server.region === 'string') {
            const m = /,\s*([A-Z]{2})\s*$/.exec(server.region);
            if (m && this._pingByCountry[m[1]] != null) return this._pingByCountry[m[1]];
        }
        return null;
    },

    // SW'nin ölçtüğü küresel bölgesel ping'leri storage'dan yükle (her çağrıda taze).
    async _loadRegionPings() {
        try {
            const st = await new Promise(res => { try { chrome.storage.local.get(['tracked_region_pings'], res); } catch (_) { res({}); } });
            const rp = st && st.tracked_region_pings;
            this._regionPings = (rp && Array.isArray(rp.probes))
                ? rp.probes.filter(p => p && typeof p.ms === 'number' && p.ms > 0 && p.ms < 900 && typeof p.lat === 'number' && typeof p.lon === 'number')
                : [];
        } catch (_) { this._regionPings = []; }
        return this._regionPings;
    },
    // Arka planda bölgesel ping'leri ölç (SW, 30dk cache) + yükle. ms için — MANUEL TEST GEREKMEZ.
    async ensureRegionalPings() {
        try { await this._swMsg({ action: 'ensureRegionalPings' }); } catch (_) {}
        await this._loadRegionPings();
        return this._regionPings;
    },

    // İki katmanlı sıralama anahtarı: [tier, value]. tier 0=ölçülen ping (gerçek), 1=mesafe, 2=çözülmemiş.
    // Ölçülen ping olanlar önce (gerçek ping'e göre), sonra mesafeyle diğerleri, en son çözülmemiş.
    regionSortKey(s) {
        if (s && typeof s.measuredPing === 'number') return [0, s.measuredPing];
        if (s && typeof s.distanceKm === 'number') return [1, s.distanceKm];
        return [2, Infinity];
    },

    // Tek sunucu bölge çözümü → { region, lat, lon, version, distanceKm } | null
    async resolveOne(placeId, jobId) {
        const r = await this._swMsg({ action: 'resolveServerRegion', placeId, jobId });
        if (!r || !r.ok || !r.region) return null;
        const geo = await this.getUserGeo();
        const dist = (geo && typeof r.lat === 'number') ? this.distanceKm(geo.lat, geo.lon, r.lat, r.lon) : null;
        return { region: r.region, lat: r.lat ?? null, lon: r.lon ?? null, version: r.version ?? null, distanceKm: dist };
    },

    // Çözülen veriyi sunucu objesine işle.
    apply(server, info) {
        if (info) {
            server.region = info.region;
            server.regionLat = info.lat;
            server.regionLon = info.lon;
            server.placeVersion = info.version;
            server.distanceKm = info.distanceKm;
            server.measuredPing = this.measuredPing(server);   // bölgesinin probu varsa gerçek ping
            server.regionFailed = false;
        } else {
            server.regionFailed = true;
        }
        server.regionResolved = true;
        server.regionPending = false;
        return server;
    },

    // Tek sunucuyu çöz + uygula (tıkla-çöz ve Yeni/Bekçi için).
    async resolveAndApply(placeId, server) {
        if (!server || !server.id) return server;
        try {
            await Promise.all([this._loadPingMap(), this.ensureRegionalPings()]);
            server.regionPending = true;
            const info = await this.resolveOne(placeId, server.id);
            return this.apply(server, info);
        } catch (_) {
            // Ağ/çözümleme hatası hücreyi "yükleniyor"da BIRAKMASIN — apply()'ın başarısızlık semantiğiyle aynı.
            server.regionFailed = true; server.regionResolved = true; server.regionPending = false;
            return server;
        }
    },

    // Üst N sunucuyu sıralı/aşamalı çöz. onUpdate(server, index) UI'ı günceller.
    async enrich(placeId, servers, n, onUpdate) {
        if (!Array.isArray(servers) || !servers.length) return;
        await this.getUserGeo();
        await Promise.all([this._loadPingMap(), this.ensureRegionalPings()]);
        const limit = Math.min(n ?? this.AUTO_LIMIT, servers.length);
        const targets = [];
        for (let i = 0; i < limit; i++) {
            const s = servers[i];
            if (s && !s.regionResolved) { s.regionPending = true; targets.push({ s, i }); }
        }
        // Hız: TEK TEK (350ms ara) yerine PARALEL gruplar — her sunucunun bölgesi bağımsız bir
        // çözüm. Oto-Pilot 6-paralel kullanıyor; UI'da 4 → daha temkinli = rate-limit'e sıkıntısız.
        // Her sunucu çözülünce onUpdate ile hücresi anında güncellenir (aşamalı dolar).
        const CONCURRENCY = 4;
        for (let b = 0; b < targets.length; b += CONCURRENCY) {
            const batch = targets.slice(b, b + CONCURRENCY);
            await Promise.all(batch.map(async ({ s, i }) => {
                try {
                    const info = await this.resolveOne(placeId, s.id);
                    this.apply(s, info);
                } catch (_) {
                    // Tek sunucunun hatası grubu kesip kalanları "yükleniyor"da bırakmasın.
                    s.regionFailed = true; s.regionResolved = true; s.regionPending = false;
                }
                if (typeof onUpdate === 'function') { try { onUpdate(s, i); } catch (_) {} }
            }));
            if (b + CONCURRENCY < targets.length) await new Promise(r => setTimeout(r, 200));
        }
    }
};

const TrackedApp = {
    state: {
        currentPlaceId: null,
        injected: false,
        retryCount: 0,
        lastScanTime: 0,
        isProcessing: false,
        globalCooldown: 0,
    },

    applyPingEstimate: function(servers) {
        if (!Array.isArray(servers)) return servers;
        return servers.map(s => ({ ...s, apiPing: s.ping || 0 }));
    },

    init: function() {
        console.log('[Tracked] v3.7 Initializing...');
        // Reduced motion ayarını yükle ve documentElement'e class ekle
        try {
            chrome.storage?.local?.get('rota_settings').then(d => {
                if (d?.rota_settings?.reducedMotion === true) {
                    document.documentElement.classList.add('tracked-reduced-motion');
                }
            }).catch(() => {});
        } catch (_) {}

        // Auto-Reconnect overlay listener artık reconnect_overlay.js'de (tüm roblox.com sayfalarında çalışır)
        // main.js sadece /games/* sayfalarına yüklenir; reconnect_overlay.js exclude_matches ile çakışmayı önler

        this.setupSPAWatcher();
        this.tryInject();
        this.initServerListEnhancer();
    },

    // Auto-Reconnect overlay artık reconnect_overlay.js'de — tüm roblox.com sayfalarında çalışır

    tryInject: async function() {
        if (!TrackedUtils.isGamePage()) {
            this.removeBar();
            return;
        }

        if (document.getElementById('tracked-game-bar')) return;

        const placeId = TrackedUtils.extractPlaceId();
        if (!placeId) return;

        this.state.currentPlaceId = placeId;

        const target = await this.findInjectionTarget();
        
        if (target) {
            this.injectBar(target, placeId);
        } else if (this.state.retryCount < TrackedConfig.TIMING.INJECTION_MAX_RETRIES) {
            this.state.retryCount++;
            setTimeout(() => this.tryInject(), TrackedConfig.TIMING.INJECTION_RETRY_DELAY);
        } else {
            this.injectToBody(placeId);
        }
    },

    findInjectionTarget: async function() {
        for (const selector of TrackedConfig.SELECTORS.INJECTION_TARGETS) {
            const el = document.querySelector(selector);
            if (el) {
                return el;
            }
        }
        return null;
    },

    injectBar: function(target, placeId) {
        // Yan ray: bar artık sağ-kenara yapışan FIXED dock. Roblox layout'una inline koymak yerine
        // doğrudan body'ye ekle → transform'lu ata-eleman fixed konumu bozmaz, kenara tam oturur.
        // (target yalnız "sayfa hazır" sinyali; konumlama CSS'te.)
        const bar = TrackedUI.createGameBar(placeId);
        document.body.appendChild(bar);
        this.state.injected = true;
        this.state.retryCount = 0;
        console.log('[Tracked] v3.7 Bar injected (yan ray)');
        this.maybeAutoPilotFromUrl(placeId);
    },

    injectToBody: function(placeId) {
        const container = TrackedUtils.createElement('div', {
            id: 'tracked-fallback-container',
            style: 'position: fixed; top: 120px; right: 20px; z-index: 999999 !important;'
        });

        const bar = TrackedUI.createGameBar(placeId);
        container.appendChild(bar);
        document.body.appendChild(container);

        this.state.injected = true;
        this.maybeAutoPilotFromUrl(placeId);
    },

    // Kart Oto-Pilot butonu → oyun sayfasına ?tracked_ap=1 ile gelir. Burada Pro kontrolü + Oto-Pilot.
    maybeAutoPilotFromUrl: function(placeId) {
        try {
            if (this._apFromUrlDone) return;
            const params = new URLSearchParams(window.location.search);
            if (params.get('tracked_ap') !== '1') return;
            this._apFromUrlDone = true;
            // URL'i temizle (yenilemede tekrar tetiklenmesin)
            params.delete('tracked_ap');
            const clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
            try { window.history.replaceState(null, '', clean); } catch (_) {}
            setTimeout(async () => {
                const isPlus = window.TrackedLicense ? await window.TrackedLicense.isPlus() : false;
                if (!isPlus) { try { chrome.runtime.sendMessage({ action: 'openPlusPage' }); } catch (_) {} return; }
                try { TrackedApp.autoBlockerScan(placeId); } catch (_) {}
            }, 1200);   // bar + lisans hazır olsun
        } catch (_) {}
    },

    // ============================================
    // Server List Enhancer — Roblox "Other Servers" sekmesine ping + bölge enjekte et
    // ============================================
    initServerListEnhancer: async function() {
        if (this._serverEnhancerActive) return;
        this._serverEnhancerActive = true;

        const placeId = TrackedUtils.extractPlaceId();
        if (!placeId) { this._serverEnhancerActive = false; return; }

        const self = this;
        let serverDataCache = null;
        let fetchPromise = null;

        const fetchServerData = async () => {
            if (serverDataCache) return serverDataCache;
            if (fetchPromise) return fetchPromise;

            fetchPromise = (async () => {
                try {
                    const resp = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage(
                            { action: 'getServerListData', placeId },
                            r => chrome.runtime.lastError
                                ? reject(new Error(chrome.runtime.lastError.message))
                                : resolve(r)
                        );
                    });

                    if (!resp?.ok) {
                        console.warn('[Tracked] ServerEnhancer API error:', resp?.error, '| universeId:', resp?.universeId);
                        return null;
                    }
                    if (!resp.servers?.length) {
                        // Roblox 0 public sunucu döndürdü (oyunun o an listelenecek sunucusu yok: sessiz/private/dolu).
                        // Bu NORMAL bir durum, hata değil → sessizce atla (warn değil, sakin log).
                        console.log('[Tracked] ServerEnhancer: public sunucu yok — atlanıyor');
                        return null;
                    }

                    console.log('[Tracked] ServerEnhancer: got', resp.servers.length, 'servers');
                    const enhanced = self.applyPingEstimate(resp.servers);
                    serverDataCache = enhanced;
                    setTimeout(() => { serverDataCache = null; fetchPromise = null; }, 20000);
                    return enhanced;
                } catch (e) {
                    console.warn('[Tracked] ServerEnhancer fetchServerData failed:', e.message);
                    fetchPromise = null;
                    return null;
                }
            })();

            return fetchPromise;
        };

        const matchServer = (servers, displayId) => {
            // "9345-40d3" → UUID'nin ortasındaki segment'ler, includes ile ara
            const clean = displayId.replace(/[^0-9a-f]/gi, '').toLowerCase();
            if (clean.length < 6) return null;
            return servers.find(s => s.id.replace(/-/g, '').toLowerCase().includes(clean));
        };

        const ID_RE = /ID[:\s]+([0-9a-f]{4}[\s-][0-9a-f]{4})/i;

        // Konum pini (SVG — emoji yok). Derin Tarama ile aynı ikon.
        const PIN = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';

        // Bölgesel ping'leri bir kez ölç (memoize) — tüm kartlar aynı promise'i bekler, SW 30dk cache'ler.
        let pingsReady = null;
        const ensurePings = () => pingsReady || (pingsReady = TrackedRegion.ensureRegionalPings().catch(() => {}));

        // Bölge çözümünü SIRAYLA + aralıklı yap (gamejoin anti-abuse). jobId SW'de cache'li → tekrar bedava.
        let regionChain = Promise.resolve();
        const queueRegion = (jobId) => {
            const p = regionChain.then(async () => {
                if (typeof TrackedRegion === 'undefined') return null;
                const info = await TrackedRegion.resolveOne(placeId, jobId).catch(() => null);
                await new Promise(r => setTimeout(r, 320));   // çağrılar arası nefes
                return info;
            });
            regionChain = p.catch(() => {});
            return p;
        };

        // Badge'i doğrudan ID elementinin içine (sonuna) ekle.
        // Roblox kartları overflow:hidden kullandığından, afterend clipping'e uğrar.
        const processIdEl = async (idEl, displayId) => {
            if (idEl.dataset.trEnh === '1') return;     // zaten badge var
            if (idEl.dataset.trEnh === 'pending') return; // başka döngü işliyor
            if (idEl.querySelector('.tracked-sv-enhancer')) return;
            idEl.dataset.trEnh = 'pending'; // eşzamanlı duplicate işlemeyi önle

            const servers = await fetchServerData();
            if (!servers) {
                delete idEl.dataset.trEnh; // API başarısız → retry'a izin ver
                return;
            }

            const server = matchServer(servers, displayId);
            if (!server) {
                idEl.dataset.trEnh = '1'; // ID eşleşmedi — server kapanmış olabilir, retry yok
                return;
            }

            // Yükleniyor rozeti (anında görünür) — bölge çözülünce içerik dolar.
            const badge = document.createElement('span');
            badge.className = 'tracked-sv-enhancer';
            const regionSpan = document.createElement('span');
            regionSpan.className = 'tracked-sv-region region-loading';
            regionSpan.innerHTML = PIN + ' <span class="tracked-sv-txt">Bölge çözülüyor…</span>';
            badge.appendChild(regionSpan);
            // Badge'i kartın "game-server-details" kabına MUTLAK ekle (CSS'te alt boşluk ayrıldı, kab position:relative).
            // Mutlak + ayrılmış alan = kart yüksekliği DEĞİŞMEZ → float-grid bozulmaz/zıplamaz, badge KART İÇİNDE.
            const host = idEl.closest('.game-server-details, .rbx-public-game-server-details') || idEl.parentElement || idEl;
            if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
            host.appendChild(badge);
            idEl.dataset.trEnh = '1';

            // Dolu sunucu: Roblox dolu sunucuya katılım uç noktası vermez → bölge çözülemez. Boşuna gamejoin atma.
            if (server.playing != null && server.maxPlayers != null && server.playing >= server.maxPlayers) {
                regionSpan.classList.remove('region-loading');
                regionSpan.dataset.confidence = 'medium';
                regionSpan.title = 'Sunucu dolu — dolu sunucuya katılım uç noktası verilmediği için bölge çözülemiyor';
                const t = regionSpan.querySelector('.tracked-sv-txt'); if (t) t.textContent = 'Dolu — bölge yok';
                return;
            }

            // GERÇEK datacenter bölgesi (sunucunun IP'si → datacenters.js). Sıraya gir.
            const info = await queueRegion(server.id);
            await Promise.all([ ensurePings(), TrackedRegion._loadPingMap().catch(() => {}) ]);
            const txt = regionSpan.querySelector('.tracked-sv-txt');
            regionSpan.classList.remove('region-loading');

            if (info && info.region && txt) {
                regionSpan.title = 'Sunucunun gerçek datacenter bölgesi (IP tabanlı)';
                txt.textContent = info.region;
                // GERÇEK yakınlık: ölçülen bölgesel ping (en yakın probe) → yoksa kuş uçuşu mesafe (km).
                const mp = TrackedRegion.measuredPing({ region: info.region, regionLat: info.lat, regionLon: info.lon });
                if (typeof mp === 'number') {
                    const cls = mp <= 80 ? 'good' : mp <= 150 ? 'warn' : 'bad';
                    const ps = document.createElement('span');
                    ps.className = `tracked-sv-ping ${cls}`;
                    ps.title = 'Senin ölçtüğün bölgesel ping (popup ping testi)';
                    ps.textContent = `${mp} ms`;
                    badge.appendChild(ps);
                }
            } else if (txt) {
                // Dürüst: çözülemedi (uydurma sayı göstermeyiz).
                regionSpan.dataset.confidence = 'medium';
                regionSpan.title = 'Bölge çözülemedi (gamejoin yanıtı yok / sınırlandı)';
                txt.textContent = 'Bölge bilinmiyor';
            }
        };

        // "ID: XXXX-XXXX" içeren küçük elementleri bul.
        // innerText: CSS'e göre görünür metni alır (gizli elementleri atlar).
        // childElementCount <= 6: büyük card container'ları atar.
        const processCards = () => {
            // 1) İşlenmemiş aday ID elementlerini topla.
            const candidates = [];
            const tags = document.querySelectorAll('p, span, div, li, small, label');
            for (const el of tags) {
                if (el.childElementCount > 6) continue;
                if (el.dataset.trEnh === '1' || el.dataset.trEnh === 'pending') continue;
                if (el.querySelector('.tracked-sv-enhancer')) continue;
                if (!el.textContent.includes('ID')) continue;
                const visible = el.innerText || el.textContent;
                if (!visible) continue;
                const m = visible.match(ID_RE);
                if (!m) continue;
                // Sadece en içteki elementi işle: direkt child'ı da eşleşiyorsa container — atla.
                const hasMatchingChild = [...el.children].some(c => ID_RE.test(c.innerText || c.textContent || ''));
                if (hasMatchingChild) continue;
                candidates.push({ el, id: m[1] });
            }
            if (!candidates.length) return;
            // İşle. (Refresh tazeliği: kısa cache ömrü + Refresh butonu kancası halleder — burada DÖNGÜ/temizleme YOK.)
            for (const c of candidates) processIdEl(c.el, c.id);
        };

        // Leading debounce: ilk mutasyondan 500ms sonra çalış,
        // ardından 1.5sn kilitle (avatar yüklemeleri debounce'ı sıfırlamasın)
        let scanTimeout = null;
        let scanLocked = false;
        const scheduleScan = () => {
            if (scanLocked || scanTimeout) return;
            scanTimeout = setTimeout(() => {
                processCards();
                scanTimeout = null;
                scanLocked = true;
                setTimeout(() => { scanLocked = false; }, 1500);
            }, 500);
        };

        const observer = new MutationObserver(scheduleScan);
        observer.observe(document.body, { childList: true, subtree: true });
        this._serverEnhancerObserver = observer;

        // Refresh butonu → cache + badge'leri BİR KEZ temizle (tek-atış, döngü yok) → yeni kartlar taze veriyle gelsin.
        const onRefreshClick = (e) => {
            const b = e.target && e.target.closest && e.target.closest('button, a, [role="button"]');
            if (!b) return;
            const t = (b.textContent || '').trim().toLowerCase();
            if (!(t.includes('refresh') || t.includes('yenile'))) return;
            serverDataCache = null; fetchPromise = null;
            document.querySelectorAll('.tracked-sv-enhancer').forEach(x => x.remove());
            document.querySelectorAll('[data-tr-enh]').forEach(x => { delete x.dataset.trEnh; });
            setTimeout(processCards, 800);   // Roblox yeni kartları render edince taze veriyle işle
        };
        document.addEventListener('click', onRefreshClick, true);
        this._serverEnhancerRefreshHandler = onRefreshClick;

        // İlk tarama (React render bitmesini bekle)
        setTimeout(processCards, 300);
        // Tekrarlayan kontrol: sayfada yeni kartlar geldikçe yakala
        const pollInterval = setInterval(() => {
            if (!this._serverEnhancerActive) { clearInterval(pollInterval); return; }
            processCards();
        }, 3000);
        this._serverEnhancerPoll = pollInterval;
    },

    cleanupServerListEnhancer: function() {
        this._serverEnhancerActive = false;
        if (this._serverEnhancerObserver) {
            this._serverEnhancerObserver.disconnect();
            this._serverEnhancerObserver = null;
        }
        if (this._serverEnhancerPoll) {
            clearInterval(this._serverEnhancerPoll);
            this._serverEnhancerPoll = null;
        }
        if (this._serverEnhancerRefreshHandler) {
            document.removeEventListener('click', this._serverEnhancerRefreshHandler, true);
            this._serverEnhancerRefreshHandler = null;
        }
    },

    removeBar: function() {
        const bar = document.getElementById('tracked-game-bar');
        const container = document.getElementById('tracked-fallback-container');

        if (bar) bar.remove();
        if (container) container.remove();

        // Aktif taramaları iptal et (SPA navigasyonunda orphan fetch'leri önle)
        if (TrackedScanner.state.isScanning || TrackedScanner.state.isForceProcessing) {
            TrackedScanner.abort();
            console.log('[Tracked] Active scan aborted due to navigation');
        }

        this.cleanupServerListEnhancer();

        this.state.injected = false;
        this.state.isProcessing = false;
    },

    setupSPAWatcher: function() {
        let lastUrl = location.href;
        
        const handleChange = TrackedUtils.debounce(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                this.removeBar();
                this.state.retryCount = 0;
                this.tryInject();
                this.initServerListEnhancer();
            }
        }, TrackedConfig.TIMING.SPA_DEBOUNCE_MS);

        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            handleChange();
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            handleChange();
        };
        
        window.addEventListener('popstate', handleChange);

        const observer = new MutationObserver((mutations) => {
            const hasRelevantChange = mutations.some(m => 
                m.type === 'childList' && 
                Array.from(m.addedNodes).some(n => 
                    n.nodeType === 1 && (
                        n.matches?.('#game-details-page, .game-main-content, h1') ||
                        n.querySelector?.('#game-details-play-button-container, h1.game-name')
                    )
                )
            );
            
            if (hasRelevantChange && !document.getElementById('tracked-game-bar')) {
                handleChange();
            }
        });

        observer.observe(document.documentElement, { 
            childList: true, 
            subtree: true 
        });
    },

    // ============================================
    // v2.4.5: Global Cooldown Kontrolü
    // ============================================
    checkGlobalCooldown: function() {
        const now = Date.now();
        if (now < this.state.globalCooldown) {
            const waitSeconds = Math.ceil((this.state.globalCooldown - now) / 1000);
            TrackedUI.setStatus(`Lütfen ${waitSeconds}s bekleyin...`);
            return false;
        }
        return true;
    },

    setGlobalCooldown: function(durationMs = 5000) {
        this.state.globalCooldown = Date.now() + durationMs;
    },

    // ============================================
    // v2.4.5: Global Buton Kilitleme ile findNewServer
    // ============================================
    findNewServer: async function(placeId) {
        // Tracked Plus gerektirir (gelişmiş sunucu aracı)
        if (!(await (window.TrackedLicense && window.TrackedLicense.isPlus()))) { try { chrome.runtime.sendMessage({ action: 'openPlusPage' }); } catch (_) {} return; }
        // Cooldown kontrolü
        if (!this.checkGlobalCooldown()) return;
        
        // v2.4.5: İşlem kontrolü
        if (TrackedScanner.state.isScanning || this.state.isProcessing || TrackedUI.isAnyButtonLocked()) {
            TrackedUI.setStatus('Tarama devam ediyor...');
            return;
        }
        
        // v2.4.5: TÜM butonları kilitle
        TrackedUI.lockAllButtons();
        this.setGlobalCooldown(8000);
        this.state.isProcessing = true;
        TrackedUI.setStatus('Sunucu listesi alınıyor...');

        const onProg = (p) => {
            if (p.phase === 'snapshot1') TrackedUI.setStatus('Sunucu listesi alınıyor...');
            else if (p.phase === 'watch') TrackedUI.setStatus(`Taze sunucular izleniyor… ${p.remain}sn`);
            else if (p.phase === 'snapshot2') TrackedUI.setStatus('Yeni belirenler kontrol ediliyor...');
        };

        try {
            // RATE LIMIT'i ATLAYAMAYIZ (Roblox dayatır) ama elle tıklatmadan arka planda bekleyip
            // otomatik yineleriz → kullanıcı için sorunsuz "geçmiş" gibi olur. En çok 2 oto-deneme.
            let attempt = 0;
            while (true) {
                try {
                    // SNAPSHOT-FARK: listeyi al → izle → tekrar al → arada YENİ belirenler = gerçekten taze.
                    const fresh = await TrackedScanner.findFreshServers(placeId, onProg);
                    TrackedUI.setStatus('');

                    if (!Array.isArray(fresh) || fresh.length === 0) {
                        TrackedUI.showNoNewServerModal(placeId);   // "Şu anda yeni açılmış sunucu bulunmuyor."
                        return;
                    }
                    if (fresh.length === 1) {
                        TrackedUI.showJoinModal(placeId, fresh[0]);
                    } else {
                        TrackedUI.showNewServerListModal(placeId, fresh);
                    }
                    return;
                } catch (err) {
                    const rl = err && err.message && (err.message.includes('RATE_LIMIT') || err.message.includes('Çok fazla istek') || err.message.includes('Rate limit'));
                    if (rl && attempt < 2) {
                        attempt++;
                        // Roblox'un verdiği gerçek süreyi bekle (Retry-After tabanlı), geri sayım göster, sonra otomatik yinele.
                        const waitMs = TrackedScanner.rateLimitRemainingMs() || 12000;
                        await this._rateLimitCountdown(waitMs);
                        continue;
                    }
                    throw err; // başka hata ya da oto-deneme bitti
                }
            }
        } catch (err) {
            console.log('[Tracked] Taze sunucu arama hatası:', err.message);
            TrackedUI.setStatus('');

            if (err.message && (err.message.includes('RATE_LIMIT') || err.message.includes('Çok fazla istek') || err.message.includes('Rate limit'))) {
                TrackedUI.showErrorModal(TrackedI18n.t('rateLimitError'));
                this.setGlobalCooldown(15000);
            } else {
                TrackedUI.showErrorModal(TrackedI18n.t('scanError') + ': ' + (err.message || TrackedI18n.t('unknown')));
            }
        } finally {
            // v2.4.5: HER DURUMDA tüm butonları aç
            TrackedUI.unlockAllButtons();
            this.state.isProcessing = false;
        }
    },

    // Rate limit beklemesini arka planda geri sayımla geçir (elle tıklama yok → sonra otomatik yinelenir).
    _rateLimitCountdown: async function(ms) {
        const end = Date.now() + Math.max(1000, ms);
        while (Date.now() < end) {
            const s = Math.max(1, Math.ceil((end - Date.now()) / 1000));
            TrackedUI.setStatus(`Sunucu meşgul — otomatik yeniden deneniyor… ${s}sn`);
            await new Promise(r => setTimeout(r, 1000));
        }
    },

    // ============================================
    // v2.4.5: Global Buton Kilitleme ile performDeepScan
    // ============================================
    performDeepScan: async function(placeId) {
        // Tracked Plus gerektirir (Tara Pro özelliğidir)
        if (!(await (window.TrackedLicense && window.TrackedLicense.isPlus()))) { TrackedUI.setStatus('Tara · Tracked Plus özelliği — Ayarlar\'dan 7 gün ücretsiz dene'); return; }
        // Cooldown kontrolü
        if (!this.checkGlobalCooldown()) return;
        
        // v2.4.5: İşlem kontrolü
        if (TrackedScanner.state.isScanning || this.state.isProcessing || TrackedUI.isAnyButtonLocked()) {
            TrackedUI.setStatus('Tarama devam ediyor...');
            return;
        }
        
        // v2.4.5: TÜM butonları kilitle
        TrackedUI.lockAllButtons();
        this.setGlobalCooldown(8000);
        this.state.isProcessing = true;
        TrackedUI.setStatus('Derin tarama başlıyor...');

        try {
            TrackedUI.startScanProgress();
            const servers = await TrackedScanner.deepScan(placeId, 400, ({ scanned, round, maxRounds }) => {
                TrackedUI.setStatus(`Tur ${round}/${maxRounds} — ${scanned} sunucu tarandı...`);
                TrackedUI.updateScanProgress(round / maxRounds);
            });

            TrackedUI.setStatus('');
            TrackedUI.endScanProgress();

            if (!Array.isArray(servers) || servers.length === 0) {
                TrackedUI.showNoServerModal(placeId);
                return;
            }

            const scored = TrackedScanner.score(servers).slice(0, TrackedConfig.API.MAX_SCORED_SERVERS);

            if (!Array.isArray(scored) || scored.length === 0) {
                TrackedUI.showNoServerModal(placeId);
                return;
            }

            // ÇİFT-DOĞRULAMA: en iyi adayları TAZE veriyle teyit et (kapanmış/dolmuş olanları ele) →
            // yalnızca gerçekten katılabilir, doğrulanmış sunucular gösterilir.
            TrackedUI.setStatus(TrackedI18n.t('verifyingStatus'));
            const topCandidates = scored.slice(0, 10);
            const verified = await TrackedScanner.verifyServers(placeId, topCandidates, ({ found, target }) => {
                TrackedUI.setStatus(`${TrackedI18n.t('verifyingStatus')} ${found}/${target}`);
            });
            // Doğrulama hiç sonuç vermezse (ağ/kapsama) → boş bırakma, skorlanmış listeyle devam et.
            const finalList = (verified && verified.length)
                ? TrackedScanner.score(verified)   // güncel veriyle yeniden skorla
                : scored;
            TrackedUI.setStatus('');

            const topServers = this.applyPingEstimate(finalList);

            TrackedUI.showServerListModal(placeId, topServers);

        } catch (err) {
            console.log('[Tracked] Derin tarama hatası:', err.message);
            TrackedUI.setStatus('');
            
            // v2.4.5: Rate limit hatası
            if (err.message && err.message.includes('RATE_LIMIT')) {
                TrackedUI.showErrorModal(TrackedI18n.t('rateLimitError'));
                this.setGlobalCooldown(15000);
            } else {
                TrackedUI.showErrorModal(TrackedI18n.t('scanError') + ': ' + (err.message || TrackedI18n.t('unknown')));
            }
        } finally {
            // v2.4.5: HER DURUMDA tüm butonları aç
            TrackedUI.unlockAllButtons();
            TrackedUI.endScanProgress();
            this.state.isProcessing = false;
        }
    },

    // Derin #7: Modal içi yenile — kapanmadan tekrar tarar
    refreshDeepScanForModal: async function(placeId) {
        if (TrackedScanner.state.isScanning || this.state.isProcessing) return null;
        this.state.isProcessing = true;
        TrackedUI.startScanProgress();
        try {
            const servers = await TrackedScanner.deepScan(placeId, 400, ({ scanned, round, maxRounds }) => {
                TrackedUI.updateScanProgress(round / maxRounds);
                const list = document.querySelector('.tracked-modal-overlay .server-list');
                if (list) {
                    list.innerHTML = `<div class="server-filter-empty">${TrackedI18n.t('processing')} (${round}/${maxRounds} — ${scanned})</div>`;
                }
            });
            if (!Array.isArray(servers) || servers.length === 0) return [];
            const scored = TrackedScanner.score(servers).slice(0, TrackedConfig.API.MAX_SCORED_SERVERS);
            return this.applyPingEstimate(scored);
        } finally {
            TrackedUI.endScanProgress();
            this.state.isProcessing = false;
        }
    },

    joinServer: function(placeId, jobId) {
        if (!placeId || !jobId) {
            console.error('[Tracked] Invalid placeId or jobId');
            TrackedUI.unlockAllButtons(); // v2.4.5
            return;
        }

        // Native launcher (MAIN world) — fallback sayfa açmaz, manuel tıklatma yok
        // gameTitle: SW saveActiveSession için (Auto-Reconnect notification mesajı)
        const gameTitle = (typeof document !== 'undefined' && document.title) ? document.title : '';
        const fallbackJoin = () => {
            window.location.href = `roblox://experiences/start?placeId=${encodeURIComponent(placeId)}&gameInstanceId=${encodeURIComponent(jobId)}`;
        };

        try {
            chrome.runtime.sendMessage({
                action: 'launchRobloxGame',
                placeId: String(placeId),
                jobId: String(jobId),
                gameTitle
            }, (resp) => {
                if (chrome.runtime.lastError || !resp || !resp.success) {
                    try {
                        chrome.runtime.sendMessage({
                            action: 'saveActiveSession',
                            placeId: String(placeId),
                            jobId: String(jobId),
                            gameTitle
                        }, () => { /* fire-and-forget */ });
                    } catch (_) {}
                    fallbackJoin();
                }
            });
        } catch (err) {
            // Extension context invalidated (reload sonrası) → doğrudan deep-link
            console.warn('[Tracked] Extension context geçersiz, deep-link fallback kullanılıyor.');
            fallbackJoin();
        }

        setTimeout(() => {
            TrackedUI.unlockAllButtons();
            this.state.isProcessing = false;
        }, 1500);
    },

    copyGameId: function(placeId) {
        if (!placeId) {
            TrackedUI.unlockAllButtons(); // v2.4.5
            return;
        }
        
        navigator.clipboard.writeText(placeId).then(() => {
            TrackedUI.setStatus('ID Kopyalandı!');
            setTimeout(() => {
                TrackedUI.setStatus('');
                TrackedUI.unlockAllButtons(); // v2.4.5
            }, 2000);
        }).catch(() => {
            TrackedUI.setStatus('Kopyalama hatası', true);
            TrackedUI.unlockAllButtons(); // v2.4.5
        });
    },

    // ============================================
    // SUNUCU BEKÇİSİ — kriterli sunucu izleme (SW arka planda çalışır)
    // ============================================
    openServerWatch: async function(placeId) {
        // Tracked Plus gerektirir (Sunucu Bekçisi gelişmiş özellik)
        if (!(await (window.TrackedLicense && window.TrackedLicense.isPlus()))) { try { chrome.runtime.sendMessage({ action: 'openPlusPage' }); } catch (_) {} return; }
        try {
            chrome.runtime.sendMessage({ action: 'getServerWatch', placeId }, (resp) => {
                const watch = (resp && resp.ok) ? resp.watch : null;    // bu oyunun bekçisi
                const active = (resp && resp.ok) ? resp.active : null;   // herhangi bir aktif bekçi (başka oyun olabilir)
                TrackedUI.showServerWatchModal(placeId, watch, active);
            });
        } catch (_) {
            TrackedUI.showServerWatchModal(placeId, null, null);
        }
    },
    startServerWatch: function(placeId, opts) {
        try {
            chrome.runtime.sendMessage({
                action: 'startServerWatch', placeId,
                maxPlayers: opts.maxPlayers, minPlayers: opts.minPlayers,
                watchAction: opts.action, gameTitle: opts.gameTitle
            }, (resp) => {
                if (resp && resp.ok) {
                    TrackedUI.setStatus(TrackedI18n.t('watchActiveStatus'));
                    this.updateWatchButton(true);
                    setTimeout(() => TrackedUI.setStatus(''), 3000);
                }
            });
        } catch (_) {}
    },
    stopServerWatch: function() {
        try {
            chrome.runtime.sendMessage({ action: 'stopServerWatch' }, () => {
                TrackedUI.setStatus(TrackedI18n.t('watchStoppedStatus'));
                this.updateWatchButton(false);
                setTimeout(() => TrackedUI.setStatus(''), 2000);
            });
        } catch (_) {}
    },
    updateWatchButton: function(active) {
        const btn = document.getElementById('btn-watch');
        if (btn) btn.classList.toggle('watching', !!active);
    },

    // ============================================
    // v5.0: Oto-Pilot BÖLGE-GARANTİLİ SEÇİM
    // Adayların gerçek datacenter mesafesini çözüp sana EN YAKIN açık sunucuyu seçer.
    // Konum/aday/çözüm yoksa null döner → autoBlockerScan eski matchmaker+ping akışına düşer.
    // ranked listesi storage'a yazılır → "Sıradaki sunucu" en yakından devam eder.
    // ============================================
    autoPilotPickClosest: async function(placeId, abortCtrl, statusCb) {
        if (typeof TrackedRegion === 'undefined') return null;
        const signal = abortCtrl?.signal;

        // 0) HEDEF BÖLGE (popup "Hedef Bölge"): ÜLKE seçiliyse mesafe = o ülkenin Roblox DC şehirlerinden
        // sunucuya EN YAKINI ("ABD'de sunucu bul" → ülke içindeki en uygun şehir kendiliğinden).
        let target = null;
        try {
            const t = (await chrome.storage.local.get('rota_target_region'))?.rota_target_region;
            if (t && t.code && Array.isArray(t.cities) && t.cities.length) target = t;
        } catch (_) {}
        if (target) console.log(`[Tracked] v5.0: HEDEF BÖLGE → ${target.label || target.code} (${target.cities.length} şehir)`);

        // 1) Konum (otomatik modda mesafe için şart; hedef modda gerekmez) — IP-geo → matchmaker fallback
        const geo = await TrackedRegion.getUserGeo(placeId);
        if (!geo && !target) { console.log('[Tracked] v5.0: konum yok (IP-geo + matchmaker başarısız) → eski akış'); return null; }

        // 2) Blocklist (kötü olarak işaretlenenleri atla)
        let blocked = new Set();
        try {
            const blStore = await chrome.storage.local.get('rota_otopilot_blocklist');
            const bl = blStore?.rota_otopilot_blocklist || [];
            const now = Date.now(), TTL = 24 * 60 * 60 * 1000;
            blocked = new Set(bl.filter(e => e?.ts && (now - e.ts) < TTL).map(e => e.id));
        } catch (_) {}

        // 3) Aday havuzu — açık (dolu değil) sunucular, en boş/taze önce (Asc), ~2 sayfa
        const fetchPage = async (cursor) => {
            const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
            try {
                const r = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit', signal });
                if (!r.ok) return { error: r.status };
                return await r.json();
            } catch (e) { return { error: e.message }; }
        };
        const pool = [];
        let cursor = '';
        for (let p = 0; p < 3; p++) {
            if (signal?.aborted) return null;
            const d = await fetchPage(cursor);
            if (!d || d.error || !Array.isArray(d.data)) break;
            for (const s of d.data) {
                if (s && s.id && typeof s.playing === 'number' && typeof s.maxPlayers === 'number'
                    && s.playing < s.maxPlayers && !blocked.has(s.id)) pool.push(s);
            }
            cursor = d.nextPageCursor;
            if (!cursor) break;
        }
        if (!pool.length) { console.log('[Tracked] v5.0: uygun aday yok → eski akış'); return null; }

        // En boş→dolu sırala, sonra listeye YAYILMIŞ ~16 aday seç (stride). Böylece adaylar tek
        // bölgeye (ör. en boş sunucuların kümelendiği ABD'ye) sıkışmaz → bölge çeşitliliği artar.
        pool.sort((a, b) => {
            const pa = a.playing || 0, pb = b.playing || 0;
            if (pa !== pb) return pa - pb;
            const fa = a.fps ? Math.round(a.fps) : 0, fb = b.fps ? Math.round(b.fps) : 0;
            return fb - fa;
        });
        const WANT = 24;
        let candidates;
        if (pool.length <= WANT) {
            candidates = pool;
        } else {
            candidates = [];
            const stride = pool.length / WANT;
            for (let k = 0; k < WANT; k++) candidates.push(pool[Math.floor(k * stride)]);
        }

        // 4) Bölgeleri çöz — PARALEL gruplar (4'erli, hız için), abort'a duyarlı.
        // ERKEN ÇIKIŞ: otomatik modda en yakın DC mesafenin ~1.3 katı + 200km (= senin bölgen);
        // HEDEF modda ≤150km (= hedef şehrin datacenter'ı bulundu, daha iyisi olamaz).
        const nearTarget = target ? 150 : ((typeof geo?.nearestDcKm === 'number') ? Math.round(geo.nearestDcKm * 1.3 + 200) : null);
        const CONCURRENCY = 6;     // hız için 6'lı paralel grup (önbellekli olanlar zaten anında)
        const resolved = [];
        let done = 0, earlyExit = false;
        for (let i = 0; i < candidates.length && !earlyExit; i += CONCURRENCY) {
            if (signal?.aborted) return null;
            const batch = candidates.slice(i, i + CONCURRENCY);
            const infos = await Promise.all(batch.map(s => TrackedRegion.resolveOne(placeId, s.id).catch(() => null)));
            for (let j = 0; j < batch.length; j++) {
                done++;
                const info = infos[j];
                // Mesafe referansı: HEDEF ülke seçiliyse o ülkenin EN YAKIN DC şehrine, değilse sana (info.distanceKm).
                let dKm = info ? info.distanceKm : null;
                if (info && target && typeof info.lat === 'number') {
                    const ds = target.cities
                        .map(c => TrackedRegion.distanceKm(c.lat, c.lon, info.lat, info.lon))
                        .filter(v => typeof v === 'number');
                    dKm = ds.length ? Math.min(...ds) : null;
                }
                if (info && typeof dKm === 'number') {
                    resolved.push({ server: batch[j], region: info.region, distanceKm: dKm, version: info.version });
                    if (nearTarget !== null && dKm <= nearTarget) earlyExit = true;
                }
            }
            const closestSoFar = resolved.length ? Math.min(...resolved.map(r => r.distanceKm)) : null;
            if (typeof statusCb === 'function') statusCb(done, candidates.length, closestSoFar !== null ? `${target ? 'hedef ' + (target.label || target.code) : 'en yakın'}` : null);
            if (earlyExit) { console.log(`[Tracked] v5.0: erken çıkış — bölgendeki sunucu bulundu (hedef ≤ ${nearTarget}km)`); break; }
            if (!signal?.aborted && i + CONCURRENCY < candidates.length) await new Promise(r => setTimeout(r, 150));
        }
        if (!resolved.length) { console.log('[Tracked] v5.0: hiçbir aday çözülemedi → eski akış'); return null; }

        // 5) En yakın (mesafe asc; eşitlikte fps desc)
        resolved.sort((a, b) => {
            if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
            const fa = a.server.fps ? Math.round(a.server.fps) : 0, fb = b.server.fps ? Math.round(b.server.fps) : 0;
            return fb - fa;
        });

        // 6) ranked'ı sakla → "Sıradaki sunucu" en yakından devam etsin
        try {
            await chrome.storage.local.set({
                rota_otopilot_region_candidates: {
                    placeId, ts: Date.now(),
                    ranked: resolved.map(r => ({ jobId: r.server.id, region: r.region, distanceKm: r.distanceKm, players: r.server.playing, maxPlayers: r.server.maxPlayers }))
                }
            });
        } catch (_) {}

        const best = resolved[0];
        console.log(`[Tracked] v5.0: ${target ? 'HEDEF ' + (target.label || target.code) + ' → EN YAKIN' : 'EN YAKIN'} → ${best.region} ~${best.distanceKm}km (${resolved.length}/${candidates.length} çözüldü)`);
        return { server: best.server, region: best.region, distanceKm: best.distanceKm, target: target ? (target.label || target.code) : null };
    },

    // ============================================
    // v3.0: AUTO-BLOCKER - Akıllı Filtreleme ve Otomatik Bağlanma
    // ============================================
    autoBlockerScan: async function(placeId) {
        // Tracked Plus gerektirir (Oto-Pilot Pro özelliğidir)
        if (!(await (window.TrackedLicense && window.TrackedLicense.isPlus()))) { TrackedUI.setStatus('Oto-Pilot · Tracked Plus özelliği — Ayarlar\'dan 7 gün ücretsiz dene'); return; }
        if (!this.checkGlobalCooldown()) return;

        if (TrackedScanner.state.isScanning || this.state.isProcessing || TrackedUI.isAnyButtonLocked()) {
            TrackedUI.setStatus(TrackedI18n.t('processing'));
            return;
        }

        const abortCtrl = new AbortController();
        const stopScan = () => { abortCtrl.abort(); };

        TrackedUI.lockAllButtons();
        TrackedUI.setForceMode(true, stopScan);
        this.setGlobalCooldown(8000);
        this.state.isProcessing = true;
        TrackedUI.setStatus('Oto-Pilot: Başlatılıyor...');

        // Kullanıcının ölçülmüş bölgesel ping'ini al → akıllı GÖRECELI filtering + scoring
        // KRİTİK: Roblox'un server.ping field'i = mevcut oyuncuların avg ping'i.
        // Eğer server US'taysa ve içindekiler US'lı ise ping=30ms görünür AMA sen TR'den
        // girince 200ms+ olur. Çözüm: server.ping'i SENİN best regional ping'inle karşılaştır:
        //   - server.ping ≈ userBestPing → server senin bölgende, gerçek ping benzer olur ✅
        //   - server.ping çok düşük (<userBest/2) → server uzak kıtada (oradaki oyunculara göre düşük) ❌
        //   - server.ping >> userBest → server zaten yüksek pingli ❌
        let userBestPing = null; // null = bilinmiyor (fallback'le default'a düşülür)
        let dynamicMaxPing = 120;
        try {
            // İki storage source: popup cache (user-measured) + SW results (background).
            // İkisini de oku, hangisi daha taze ise onu kullan.
            const stored = await chrome.storage.local.get(['rota_ping_cache', 'rota_ping_results']);
            let results = null;
            const cacheResults = stored?.rota_ping_cache?.results;
            const swResults    = stored?.rota_ping_results;
            const cacheTs      = stored?.rota_ping_cache?.timestamp || 0;
            // Popup cache daha taze ise onu tercih et (timestamp var), yoksa SW results'ı kullan
            if (Array.isArray(cacheResults) && cacheResults.length > 0) {
                results = cacheResults;
            } else if (Array.isArray(swResults) && swResults.length > 0) {
                results = swResults;
            }
            if (Array.isArray(results) && results.length > 0) {
                const validPings = results.map(r => r.ms).filter(ms => ms > 0 && ms < 900);
                if (validPings.length > 0) {
                    userBestPing = Math.min(...validPings);
                    // Max ping cap: best * 2.5, clamp 60-200ms
                    // TR kullanıcı best=40ms → max=100ms (eskiden 200ms idi, 200ms server geçiyordu!)
                    dynamicMaxPing = Math.max(60, Math.min(200, Math.round(userBestPing * 2.5)));
                    console.log(`[Tracked] Auto-pilot v3.5: userBestPing=${userBestPing}ms (source: ${cacheResults ? 'popup' : 'SW'}), MAX_PING=${dynamicMaxPing}ms`);
                }
            } else {
                console.log('[Tracked] Auto-pilot: userBestPing bilinmiyor — popup\'ta ping ölçümü yapılmamış. Default mantığa düşülüyor.');
            }
        } catch (e) {
            console.warn('[Tracked] Auto-pilot ping read failed:', e?.message);
        }

        // ─────────────────────────────────────────
        // v5.0: BÖLGE-GARANTİLİ SEÇİM (BİRİNCİL) — adayların gerçek mesafesini çözüp EN YAKINI seç.
        // Konum/aday/çözüm yoksa null → aşağıdaki eski matchmaker+ping akışına düşülür (bozulmaz).
        // ─────────────────────────────────────────
        try {
            TrackedUI.setStatus('Oto-Pilot: En yakın bölge aranıyor...');
            const best = await this.autoPilotPickClosest(placeId, abortCtrl, (i, n, label) => {
                TrackedUI.setStatus(`Oto-Pilot: Bölge çözülüyor ${i}/${n}${label ? ' · ' + label : ''}`);
            });
            if (best && best.server) {
                TrackedUI.setStatus(`${best.target ? 'Hedef ' + best.target : 'En yakın'}: ${best.region} — bağlanılıyor...`);
                this.joinServer(placeId, best.server.id);
                setTimeout(() => {
                    this.showOtopilotRetryFloater(placeId, best.server.id, {
                        region: best.region, distanceKm: best.distanceKm,
                        players: best.server.playing, maxPlayers: best.server.maxPlayers
                    });
                }, 300);
                TrackedUI.unlockAllButtons(); TrackedUI.setForceMode(false); this.state.isProcessing = false;
                return;
            }
            if (abortCtrl.signal.aborted) {
                TrackedUI.setStatus('Oto-Pilot durduruldu.');
                TrackedUI.unlockAllButtons(); TrackedUI.setForceMode(false); this.state.isProcessing = false;
                return;
            }
            console.log('[Tracked] v5.0: Bölge-garantili seçim sonuç vermedi — eski akışa düşülüyor.');
        } catch (e) {
            if (abortCtrl.signal.aborted) {
                TrackedUI.setStatus('Oto-Pilot durduruldu.');
                TrackedUI.unlockAllButtons(); TrackedUI.setForceMode(false); this.state.isProcessing = false;
                return;
            }
            console.warn('[Tracked] v5.0 bölge seçim hatası:', e?.message);
        }

        // ─────────────────────────────────────────
        // v4.1: PHASE 0 — Roblox REGION-AWARE MATCHMAKER
        // gamejoin API'sini MAIN world'de çağırıp Roblox'un kendi matchmaker'ından server al.
        // Roblox senin IP'ni biliyor → bölgene yakın server atar. Bu en güvenilir region detection'tır.
        // ─────────────────────────────────────────
        try {
            TrackedUI.setStatus('Oto-Pilot: Roblox matchmaker sorgulanıyor...');
            const blStore = await chrome.storage.local.get('rota_otopilot_blocklist');
            const bl = blStore?.rota_otopilot_blocklist || [];
            const now = Date.now();
            const TTL = 24 * 60 * 60 * 1000;
            const blockedSet = new Set(bl.filter(e => e?.ts && (now - e.ts) < TTL).map(e => e.id));

            const mmResult = await new Promise(resolve => {
                try {
                    chrome.runtime.sendMessage({ action: 'swMainWorldMatchmaker', placeId }, r => {
                        if (chrome.runtime.lastError) resolve(null); else resolve(r);
                    });
                } catch { resolve(null); }
            });

            if (mmResult?.ok && mmResult?.jobId && !blockedSet.has(mmResult.jobId)) {
                console.log(`[Tracked] v4.1: Phase 0 — Roblox matchmaker jobId=${mmResult.jobId.substring(0,8)}... (status=${mmResult.status}) — region-aware pick`);
                TrackedUI.setStatus('Roblox matchmaker önerisi alındı, bağlanılıyor...');
                this.joinServer(placeId, mmResult.jobId);
                // Floater her zaman göster — matchmaker'ın da yanılma şansı var, user verify etsin
                setTimeout(() => {
                    this.showOtopilotRetryFloater(placeId, mmResult.jobId, {
                        confidence: 'high',
                        apiPing: 0,
                        userBestPing,
                        delta: null
                    });
                }, 300);
                TrackedUI.unlockAllButtons();
                TrackedUI.setForceMode(false);
                this.state.isProcessing = false;
                return;
            } else if (mmResult?.ok && mmResult?.jobId && blockedSet.has(mmResult.jobId)) {
                console.log(`[Tracked] v4.1: Phase 0 matchmaker jobId blocklist'te — scan fallback'e geçiliyor`);
            } else {
                console.log(`[Tracked] v4.1: Phase 0 fail (${mmResult?.error || mmResult?.status || 'no_result'}) — scan fallback`);
            }
        } catch (e) {
            console.warn('[Tracked] v4.1: Phase 0 matchmaker error:', e?.message);
        }

        try {
            // PHASE 1 (fallback): Public server scan — matchmaker fail olduğunda
            TrackedUI.setStatus('Oto-Pilot: En iyi sunucu aranıyor (fallback)...');
            let filterReasons = { too_many_players: 0, high_ping: 0, full: 0, invalid: 0 };

            const server = await TrackedScanner.autoBlockerScan(
                placeId,
                ({ scanned, blocked, page, status, waitMs }) => {
                    if (status === 'rate_limit_wait') {
                        const sec = Math.ceil((waitMs || 25000) / 1000);
                        TrackedUI.setStatus(`Çok hızlı tarandı — ${sec}sn bekleniyor, devam ediyor...`);
                    } else {
                        TrackedUI.setStatus(`Oto-Pilot: Taranan: ${scanned} | Filtrelenen: ${blocked}`);
                    }
                },
                ({ reason }) => {
                    if (reason in filterReasons) filterReasons[reason]++;
                },
                (foundServer) => {
                    console.log(`[Tracked] Uygun sunucu bulundu: ${foundServer.playing} oyuncu, ping=${foundServer.ping}ms, skor=${foundServer.score}`);
                    TrackedUI.setStatus('Sunucu bulundu! Bağlanıyor...');
                    setTimeout(() => {
                        this.joinServer(placeId, foundServer.id);
                        // v4.0: Floater HER ZAMAN gösterilir — heuristik unreliable, user karar versin.
                        // Confidence label ile şeffaf bilgi: pozitif delta = iyi, sıfır/negatif = riskli.
                        const apiPing = foundServer.ping || 0;
                        const delta = userBestPing > 0 && apiPing > 0 ? apiPing - userBestPing : null;
                        let confidence = 'unknown';
                        if (delta !== null) {
                            if (delta >= 5 && delta <= 25)   confidence = 'high';   // yeşil — büyük olasılıkla iyi
                            else if (delta >= -3 && delta <= 60) confidence = 'medium'; // sarı — kontrol et
                            else                              confidence = 'low';    // kırmızı — risk var
                        }
                        console.log(`[Tracked] v4.0: Floater (confidence=${confidence}, delta=${delta}ms, apiPing=${apiPing}, userBest=${userBestPing})`);
                        this.showOtopilotRetryFloater(placeId, foundServer.id, { confidence, apiPing, userBestPing, delta });
                    }, 300);
                },
                { maxPlayers: 9999, maxPing: dynamicMaxPing, userBestPing, signal: abortCtrl.signal }
            );

            if (!server) {
                if (abortCtrl.signal.aborted) {
                    TrackedUI.setStatus('Oto-Pilot durduruldu.');
                } else {
                    TrackedUI.setStatus('');
                    if (TrackedScanner.state.isRateLimited) {
                        const remaining = Math.ceil((TrackedScanner.state.rateLimitResetTime - Date.now()) / 1000);
                        const waitSeconds = remaining > 0 ? remaining : 15;
                        TrackedUI.showErrorModal(`Çok fazla istek gönderildi. Güvenlik için ${waitSeconds} saniye beklemeniz gerekiyor.`);
                        this.setGlobalCooldown(waitSeconds * 1000);
                    } else {
                        const reasons = [];
                        if (filterReasons.high_ping > 0) reasons.push(`${filterReasons.high_ping} sunucu yüksek ping (>${dynamicMaxPing}ms)`);
                        if (filterReasons.full > 0)       reasons.push(`${filterReasons.full} sunucu tamamen dolu`);
                        const detail = reasons.length > 0 ? `\n\nSebep: ${reasons.join(', ')}.` : '';
                        TrackedUI.showErrorModal(`Oto-Pilot: Tüm sunucular yüksek ping'li veya tamamen dolu.${detail}\n\nNormal tarama ile deneyin.`);
                    }
                }
            }

        } catch (err) {
            if (abortCtrl.signal.aborted || err.name === 'AbortError') {
                TrackedUI.setStatus('Oto-Pilot durduruldu.');
            } else {
                console.log('[Tracked] Oto-Pilot hatası:', err.message);
                TrackedUI.setStatus('');
                if (err.message && (err.message.includes('Rate limit') || err.message.includes('15') || err.message.includes('30'))) {
                    const remaining = Math.ceil((TrackedScanner.state.rateLimitResetTime - Date.now()) / 1000);
                    const waitSeconds = remaining > 0 ? remaining : 15;
                    TrackedUI.showErrorModal(`Çok fazla istek gönderildi. Güvenlik için ${waitSeconds} saniye beklemeniz gerekiyor.`);
                    this.setGlobalCooldown(waitSeconds * 1000);
                } else {
                    TrackedUI.showErrorModal('Oto-Pilot hatası: ' + (err.message || 'İşlem başarısız'));
                }
            }
        } finally {
            TrackedUI.setForceMode(false);
            TrackedUI.unlockAllButtons();
            this.state.isProcessing = false;
        }
    },

    // ============================================
    // v4.0: Oto-Pilot Retry Floater — confidence-aware, her zaman gösterilir
    // ============================================
    showOtopilotRetryFloater: function(placeId, currentJobId, info = {}) {
        document.getElementById('tracked-otopilot-retry')?.remove();

        // v5.0: İki mod — (1) BÖLGE: gerçek datacenter mesafesi (dürüst), (2) eski PING tahmini (fallback).
        let c, infoText;
        if (info && typeof info.region === 'string' && info.region) {
            const d = (typeof info.distanceKm === 'number') ? info.distanceKm : null;
            // AKILLI güven: mutlak km DEĞİL, SENİN en yakın mümkün bölgene GÖRE.
            // Seçilen sunucu, senin en yakın datacenter'ına ne kadar yakınsa o kadar "iyi" — çünkü
            // daha iyisi yok. (Örn. Türkiye için EU = en yakın bölge → "EN İYİ", 2000km olsa bile.)
            const nearest = (typeof TrackedRegion !== 'undefined' && TrackedRegion._geo && typeof TrackedRegion._geo.nearestDcKm === 'number')
                ? TrackedRegion._geo.nearestDcKm : null;
            let conf;
            if (d === null) {
                conf = 'unknown';
            } else if (nearest !== null) {
                const excess = d - nearest;                 // en yakın bölgenin ne kadar ötesi
                conf = excess <= 1800 ? 'high' : (excess <= 4000 ? 'medium' : 'low');
            } else {
                conf = d <= 2800 ? 'high' : (d <= 6000 ? 'medium' : 'low');  // konum yoksa: kıta-içi makul
            }
            const rMap = {
                high:    { color: '#30D158', bg: 'rgba(48,209,88,0.14)', border: 'rgba(48,209,88,0.4)', label: 'EN İYİ BÖLGE', desc: 'Sana en yakın bölgedeki açık sunucu bu — daha iyisi yok. Oyun içi ping yine kötüyse sıradakini dene.' },
                medium:  { color: '#FFD60A', bg: 'rgba(255,214,10,0.12)', border: 'rgba(255,214,10,0.35)', label: 'KABUL EDİLİR', desc: 'En yakın açık sunucu bu ama bölgen biraz uzak kaldı. Gerekirse sıradakine geç.' },
                low:     { color: '#FF453A', bg: 'rgba(255,69,58,0.14)', border: 'rgba(255,69,58,0.4)', label: 'UZAK BÖLGE', desc: 'Bu oyunun sunucuları sana uzakta; en yakını bile uzak çıktı. Sıradakini deneyebilirsin.' },
                unknown: { color: '#8E8E93', bg: 'rgba(142,142,147,0.12)', border: 'rgba(142,142,147,0.35)', label: 'BÖLGE', desc: 'Bölge bulundu, mesafe hesaplanamadı.' },
            };
            c = rMap[conf];
            const distTxt = '';
            const playersTxt = (typeof info.players === 'number' && typeof info.maxPlayers === 'number') ? ` · ${info.players}/${info.maxPlayers} oyuncu` : '';
            infoText = `Bölge: ${info.region}${distTxt}${playersTxt}`;
        } else {
            const { confidence = 'unknown', apiPing = 0, userBestPing = 0, delta = null } = info;
            const confMap = {
                high:    { color: '#30D158', bg: 'rgba(48,209,88,0.14)', border: 'rgba(48,209,88,0.4)', label: 'PING İYİ TAHMİN EDİLİYOR', desc: 'Server senin bölgende görünüyor. Yine de in-game ping kötüyse sıradakini dene.' },
                medium:  { color: '#FFD60A', bg: 'rgba(255,214,10,0.12)', border: 'rgba(255,214,10,0.35)', label: 'PİNG BELİRSİZ', desc: 'Tahmin güvenilir değil. Oyuna girince ping kötüyse sıradakini dene.' },
                low:     { color: '#FF453A', bg: 'rgba(255,69,58,0.14)', border: 'rgba(255,69,58,0.4)', label: 'PİNG RİSKLİ', desc: 'Sinyaller yüksek ping olabileceğini gösteriyor. Kontrol et, gerekirse sıradakine geç.' },
                unknown: { color: '#8E8E93', bg: 'rgba(142,142,147,0.12)', border: 'rgba(142,142,147,0.35)', label: 'PİNG VERİSİ YOK', desc: 'API ping bilgisi yoktu. In-game ping\'i kontrol et.' },
            };
            c = confMap[confidence] || confMap.unknown;
            infoText = userBestPing > 0
                ? `API: ${apiPing || '?'}ms  ·  Senin best: ${userBestPing}ms  ·  Δ: ${delta !== null ? (delta >= 0 ? '+' : '') + delta + 'ms' : '?'}`
                : `API ping: ${apiPing || '?'}ms`;
        }

        const floater = document.createElement('div');
        floater.id = 'tracked-otopilot-retry';
        floater.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 9999998;
            background: linear-gradient(135deg, rgba(20,21,26,0.95), rgba(15,15,20,0.95));
            backdrop-filter: blur(20px) saturate(1.4);
            -webkit-backdrop-filter: blur(20px) saturate(1.4);
            border: 1px solid ${c.border};
            border-radius: 12px;
            padding: 12px 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 12px;
            color: rgba(255,255,255,0.9);
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            display: flex; flex-direction: column; gap: 8px;
            min-width: 270px; max-width: 320px;
            animation: tk-floater-in .35s cubic-bezier(0.4,0,0.2,1);
        `;

        if (!document.getElementById('tracked-otopilot-floater-css')) {
            const style = document.createElement('style');
            style.id = 'tracked-otopilot-floater-css';
            style.textContent = `
                @keyframes tk-floater-in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
                @keyframes tk-floater-out { from { opacity:1; transform: translateY(0); } to { opacity:0; transform: translateY(8px); } }
                #tracked-otopilot-retry .tk-fl-title { font-weight:700; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; display:flex; align-items:center; gap:6px; }
                #tracked-otopilot-retry .tk-fl-confbadge { padding:2px 7px; border-radius:4px; font-size:9.5px; font-weight:700; letter-spacing:.06em; }
                #tracked-otopilot-retry .tk-fl-msg { line-height:1.4; color:rgba(255,255,255,.78); }
                #tracked-otopilot-retry .tk-fl-info { font-size:10.5px; color:rgba(255,255,255,.45); font-family:'SF Mono',monospace; padding:5px 8px; background:rgba(255,255,255,.03); border-radius:5px; border:1px solid rgba(255,255,255,.04); }
                #tracked-otopilot-retry .tk-fl-actions { display:flex; gap:6px; align-items:center; }
                #tracked-otopilot-retry button { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.10); color: rgba(255,255,255,.92); padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background .2s; display:inline-flex; align-items:center; }
                #tracked-otopilot-retry button.tk-fl-retry { background: rgba(255,159,10,.18); border-color: rgba(255,159,10,.4); color: #FFB84D; }
                #tracked-otopilot-retry button:hover { background: rgba(255,255,255,.14); }
                #tracked-otopilot-retry button.tk-fl-retry:hover { background: rgba(255,159,10,.3); }
                #tracked-otopilot-retry .tk-fl-countdown { font-size:10px; color:rgba(255,255,255,.4); margin-left:auto; }
            `;
            document.head.appendChild(style);
        }

        const ICON_SHIELD = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
        const ICON_TARGET = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`;

        floater.innerHTML = `
            <div class="tk-fl-title" style="color:${c.color}">${ICON_SHIELD} OTO-PİLOT
                <span class="tk-fl-confbadge" style="background:${c.bg}; color:${c.color}; border:1px solid ${c.border}; margin-left:auto;">${c.label}</span>
            </div>
            <div class="tk-fl-msg">${c.desc}</div>
            <div class="tk-fl-info">${infoText}</div>
            <div class="tk-fl-actions">
                <button class="tk-fl-retry" id="tk-fl-retry-btn">${ICON_TARGET}Sıradaki sunucu</button>
                <button id="tk-fl-dismiss-btn">İyiyim</button>
                <span class="tk-fl-countdown" id="tk-fl-countdown">45sn</span>
            </div>
        `;

        document.body.appendChild(floater);

        // Auto-dismiss countdown
        let remaining = 45;
        const countdownEl = floater.querySelector('#tk-fl-countdown');
        const interval = setInterval(() => {
            remaining--;
            if (countdownEl) countdownEl.textContent = `${remaining}sn`;
            if (remaining <= 0) {
                clearInterval(interval);
                dismiss();
            }
        }, 1000);

        const dismiss = () => {
            clearInterval(interval);
            floater.style.animation = 'tk-floater-out .25s cubic-bezier(0.4,0,1,1) forwards';
            setTimeout(() => floater.remove(), 260);
        };

        floater.querySelector('#tk-fl-retry-btn').addEventListener('click', async () => {
            clearInterval(interval);
            await this.tryNextOtopilotCandidate(placeId, currentJobId);
            dismiss();
        });

        floater.querySelector('#tk-fl-dismiss-btn').addEventListener('click', dismiss);
    },

    // v3.6: Mevcut server'ı blocklist'e ekle + storage'daki sıradaki adaya geç
    tryNextOtopilotCandidate: async function(placeId, badJobId) {
        try {
            // 1) Blocklist'e ekle (TTL: 24h, max 50 FIFO)
            const stored = await chrome.storage.local.get('rota_otopilot_blocklist');
            const existing = stored?.rota_otopilot_blocklist || [];
            const now = Date.now();
            const TTL = 24 * 60 * 60 * 1000;
            const filtered = existing.filter(e => e?.ts && (now - e.ts) < TTL && e.id !== badJobId);
            filtered.unshift({ id: badJobId, ts: now });
            const trimmed = filtered.slice(0, 50);
            await chrome.storage.local.set({ rota_otopilot_blocklist: trimmed });
            console.log(`[Tracked] v3.6: ${badJobId} blocklist'e eklendi (${trimmed.length}/50)`);

            // v5.0: Bölge adayları varsa → sıradaki EN YAKIN sunucuya geç (gerçek mesafe)
            const regStore = await chrome.storage.local.get('rota_otopilot_region_candidates');
            const reg = regStore?.rota_otopilot_region_candidates;
            if (reg && reg.placeId === placeId && Array.isArray(reg.ranked)) {
                const nextR = reg.ranked.find(c => c.jobId !== badJobId && !trimmed.some(b => b.id === c.jobId));
                if (nextR) {
                    console.log(`[Tracked] v5.0: Sıradaki en yakın → ${nextR.region} ~${nextR.distanceKm}km`);
                    TrackedUI.setStatus?.(`Sıradaki en yakın: ${nextR.region}`);
                    this.joinServer(placeId, nextR.jobId);
                    this.showOtopilotRetryFloater(placeId, nextR.jobId, {
                        region: nextR.region, distanceKm: nextR.distanceKm,
                        players: nextR.players, maxPlayers: nextR.maxPlayers
                    });
                    return;
                }
            }

            // 2) Son scan'den sıradaki adayı bul (fallback — bölge adayı yoksa eski ping akışı)
            const scanStore = await chrome.storage.local.get('rota_otopilot_last_scan');
            const lastScan = scanStore?.rota_otopilot_last_scan;
            if (!lastScan || lastScan.placeId !== placeId || !Array.isArray(lastScan.candidates)) {
                TrackedUI.showErrorModal('Sıradaki aday bulunamadı — Oto-Pilot\'u yeniden çalıştır.');
                return;
            }
            // badJobId'yi atla, ilk başka adayı al
            const next = lastScan.candidates.find(c => c.jobId !== badJobId && !trimmed.some(b => b.id === c.jobId));
            if (!next) {
                TrackedUI.showErrorModal('Sıradaki uygun aday kalmadı. Oto-Pilot\'u yeniden çalıştır.');
                return;
            }

            console.log(`[Tracked] v3.6: Sıradaki aday → ${next.jobId.substring(0,8)}... (${next.players} oyuncu, ${next.ping || '?'}ms)`);
            TrackedUI.setStatus?.(`Sıradaki: ${next.players} oyuncu, ${next.ping || '?'}ms`);

            // 3) Aktif join
            this.joinServer(placeId, next.jobId);

            // 4) Tekrar floater (eğer bu da kötüyse 3. aday için)
            this.showOtopilotRetryFloater(placeId, next.jobId);
        } catch (e) {
            console.error('[Tracked] tryNextOtopilotCandidate failed:', e);
            TrackedUI.showErrorModal('Sıradaki aday hata verdi: ' + e.message);
        }
    }
};

// ============================================
// BOOTSTRAP
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TrackedApp.init());
} else {
    TrackedApp.init();
}

console.log('[Tracked] v3.7 - Simulated Player Analytics - Loaded');

// v3.5: Advanced Player Insight - Sunucu kalite skoru (Hesap yaşı verisi olmadan meta-veri kullanımı)
