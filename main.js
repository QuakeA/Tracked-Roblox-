// main.js - Tracked Extension v3.7 Main Application Module (Smart Activity Tracking)

// Roblox known DC bölge profili — ülkeye göre tipik RTT (ms)
// Kullanıcının baseline ölçümüyle birleşip server'ın muhtemel DC'sini tahmin eder
const COUNTRY_DC_RTT = {
    TR: { EU: 60,  'US-E': 130, 'US-W': 200, AS: 230, OC: 290, SA: 220 },
    DE: { EU: 20,  'US-E': 100, 'US-W': 170, AS: 250, OC: 300, SA: 220 },
    GB: { EU: 25,  'US-E': 80,  'US-W': 150, AS: 250, OC: 280, SA: 200 },
    FR: { EU: 25,  'US-E': 90,  'US-W': 160, AS: 250, OC: 290, SA: 200 },
    NL: { EU: 15,  'US-E': 90,  'US-W': 160, AS: 250, OC: 290, SA: 210 },
    PL: { EU: 35,  'US-E': 110, 'US-W': 180, AS: 240, OC: 290, SA: 230 },
    IT: { EU: 30,  'US-E': 110, 'US-W': 180, AS: 250, OC: 290, SA: 220 },
    ES: { EU: 30,  'US-E': 100, 'US-W': 170, AS: 260, OC: 300, SA: 200 },
    RU: { EU: 70,  'US-E': 130, 'US-W': 200, AS: 200, OC: 280, SA: 240 },
    UA: { EU: 50,  'US-E': 120, 'US-W': 190, AS: 220, OC: 290, SA: 240 },
    US: { EU: 90,  'US-E': 30,  'US-W': 80,  AS: 180, OC: 220, SA: 130 },
    CA: { EU: 100, 'US-E': 40,  'US-W': 70,  AS: 180, OC: 220, SA: 140 },
    MX: { EU: 130, 'US-E': 60,  'US-W': 70,  AS: 200, OC: 230, SA: 130 },
    BR: { EU: 200, 'US-E': 120, 'US-W': 200, AS: 350, OC: 350, SA: 30  },
    AR: { EU: 220, 'US-E': 140, 'US-W': 200, AS: 350, OC: 350, SA: 50  },
    JP: { EU: 250, 'US-E': 150, 'US-W': 100, AS: 30,  OC: 130, SA: 280 },
    KR: { EU: 250, 'US-E': 180, 'US-W': 110, AS: 40,  OC: 150, SA: 290 },
    CN: { EU: 220, 'US-E': 200, 'US-W': 150, AS: 60,  OC: 130, SA: 320 },
    HK: { EU: 200, 'US-E': 200, 'US-W': 150, AS: 30,  OC: 140, SA: 320 },
    SG: { EU: 180, 'US-E': 230, 'US-W': 180, AS: 30,  OC: 110, SA: 350 },
    AU: { EU: 290, 'US-E': 220, 'US-W': 170, AS: 130, OC: 20,  SA: 320 },
    NZ: { EU: 290, 'US-E': 230, 'US-W': 170, AS: 150, OC: 30,  SA: 320 },
    IN: { EU: 130, 'US-E': 230, 'US-W': 250, AS: 100, OC: 230, SA: 330 },
    ID: { EU: 200, 'US-E': 240, 'US-W': 200, AS: 70,  OC: 130, SA: 360 },
    PH: { EU: 220, 'US-E': 220, 'US-W': 170, AS: 50,  OC: 150, SA: 340 },
    ZA: { EU: 160, 'US-E': 220, 'US-W': 290, AS: 290, OC: 380, SA: 310 },
    AE: { EU: 130, 'US-E': 200, 'US-W': 250, AS: 130, OC: 250, SA: 290 },
    SA: { EU: 120, 'US-E': 190, 'US-W': 240, AS: 140, OC: 260, SA: 280 },
    EG: { EU: 100, 'US-E': 180, 'US-W': 240, AS: 180, OC: 290, SA: 270 },
    _:  { EU: 100, 'US-E': 130, 'US-W': 180, AS: 220, OC: 280, SA: 220 }
};

// Bölge ikonları — ülke bayrağı yerine global region simgesi (kafa karışıklığı önler)
const DC_INFO = {
    'EU':   { icon: '🌍', name: 'Europe',         short: 'EU' },
    'US-E': { icon: '🌎', name: 'US East',        short: 'US-E' },
    'US-W': { icon: '🌎', name: 'US West',        short: 'US-W' },
    'AS':   { icon: '🌏', name: 'Asia',           short: 'AS' },
    'OC':   { icon: '🌏', name: 'Oceania',        short: 'OC' },
    'SA':   { icon: '🌎', name: 'South America',  short: 'SA' }
};

const TrackedApp = {
    state: {
        currentPlaceId: null,
        injected: false,
        retryCount: 0,
        lastScanTime: 0,
        isProcessing: false,
        globalCooldown: 0,
        // Tracked: kullanıcı → Roblox altyapı baseline RTT cache (5 dk TTL)
        baselineCache: { value: 0, timestamp: 0 },
        // Kullanıcı ülke kodu cache'i (24 saat TTL)
        countryCache: { code: '', timestamp: 0 }
    },

    // GeoIP — kullanıcının ülke kodu (region tahmini için)
    getUserCountry: async function() {
        const now = Date.now();
        const cache = this.state.countryCache;
        if (cache.code && now - cache.timestamp < 86400000) return cache.code;

        // Birden fazla GeoIP servisi — biri başarısızsa diğerine düş
        const sources = [
            { url: 'https://ipwho.is/',         pick: d => d.success && d.country_code },
            { url: 'https://ipapi.co/json/',    pick: d => d.country_code || d.country },
            { url: 'https://ipinfo.io/json',    pick: d => d.country }
        ];

        for (const src of sources) {
            try {
                const res = await fetch(src.url, { cache: 'no-store', credentials: 'omit' });
                if (!res.ok) continue;
                const data = await res.json();
                const code = src.pick(data);
                if (code && typeof code === 'string' && code.length >= 2) {
                    const upper = code.toUpperCase().slice(0, 2);
                    this.state.countryCache = { code: upper, timestamp: now };
                    console.log('[Tracked] Country tespit edildi:', upper, 'via', src.url);
                    return upper;
                }
            } catch (e) { /* try next */ }
        }
        console.warn('[Tracked] Country tespit edilemedi — default profile kullanılacak');
        return '';
    },

    // Estimated ping + ülke profilinden muhtemel DC tahmini
    guessServerRegion: function(estimatedPing, userCountry, baseline) {
        if (!estimatedPing || estimatedPing <= 0) return null;
        const profile = COUNTRY_DC_RTT[userCountry] || COUNTRY_DC_RTT._;

        // Baseline absurd kontrolü: ülkenin minimum DC RTT'sinden çok daha yüksekse
        // (örn TR için min=60, eşik=150). Aşıyorsa ülke profili kullanılamaz
        // → kullanıcı muhtemelen VPN/proxy/engelli rotada, region tahmini güvensiz
        const minDcRtt = Math.min(...Object.values(profile));
        const baselineSane = baseline > 0 && baseline <= minDcRtt * 2.5;

        // Baseline güvensizse hiç tahmin yapma — yanlış sonuç gösterme
        if (!baselineSane) return null;

        let bestDC = null;
        let smallestDelta = Infinity;
        for (const [dc, expectedRtt] of Object.entries(profile)) {
            const delta = Math.abs(estimatedPing - expectedRtt);
            if (delta < smallestDelta) {
                smallestDelta = delta;
                bestDC = dc;
            }
        }

        let confidence = 'low';
        if (smallestDelta < 25) confidence = 'high';
        else if (smallestDelta < 55) confidence = 'medium';

        return { dc: bestDC, confidence, delta: smallestDelta, info: DC_INFO[bestDC] };
    },

    // Browser → Roblox altyapısı baseline RTT (in-game ping tahmini için).
    // UDP game-server ping'i bir extension'dan ölçülemez; bu yüzden en azından
    // kullanıcının Roblox'a olan TCP/HTTP RTT'sini ölçüp, API'nin döndürdüğü
    // DC-içi ping'e ekliyoruz: estimated = baseline + apiPing
    measureUserBaseline: async function() {
        const now = Date.now();
        const cache = this.state.baselineCache;
        if (cache && cache.value > 0 && now - cache.timestamp < 300000) {
            return cache.value;
        }

        // Same-origin: TLS/DNS sorunu olmaz, persistent connection cache kullanılır
        const endpoint = 'https://www.roblox.com/favicon.ico';

        const probe = async (salt) => {
            try {
                const t0 = performance.now();
                const res = await fetch(endpoint + '?_=' + salt, {
                    method: 'GET',
                    cache: 'no-store',
                    credentials: 'omit',
                    mode: 'no-cors' // opaque response, preflight yok
                });
                if (res && res.body) {
                    try { await res.body.cancel(); } catch (_) {}
                }
                const dt = performance.now() - t0;
                return (dt > 0 && dt < 5000) ? dt : null;
            } catch (e) {
                return null;
            }
        };

        // Warmup — ilk 2 request'i ölçüme katma (TLS handshake, DNS, connection setup)
        await probe(now - 1000);
        await probe(now - 500);

        // Asıl ölçüm: 6 sample, en düşük 2'sini al (best-of-N approach)
        // Min sample = en az network jitter, gerçek RTT'ye en yakın
        const samples = [];
        for (let i = 0; i < 6; i++) {
            const dt = await probe(now + i);
            if (dt != null) samples.push(dt);
            if (i < 5 && typeof TrackedUtils !== 'undefined') await TrackedUtils.delay(50);
        }

        if (samples.length === 0) {
            console.warn('[Tracked] Baseline ölçülemedi — tüm probe başarısız');
            return 0;
        }

        samples.sort((a, b) => a - b);
        const best = samples.slice(0, Math.min(2, samples.length));
        const baseline = Math.round(best.reduce((a, b) => a + b, 0) / best.length);

        console.log('[Tracked] Baseline ölçüldü:', baseline + 'ms', '(min-of-6 samples:', samples.map(s => Math.round(s)).join(','), ')');
        this.state.baselineCache = { value: baseline, timestamp: now };
        return baseline;
    },

    // Server objelerine baseline + region tahmini uygula
    // Akıllı hibrit formül:
    //   - API ping yüksekse (>80ms) zaten kullanıcı route'unu yansıtıyor → ham göster
    //   - API ping düşükse (DC içi metric) → baseline + apiPing/2 ekle (yarı ağırlık)
    applyPingEstimate: function(servers, baseline, userCountry) {
        if (!Array.isArray(servers)) return servers;
        if (!baseline || baseline <= 0) {
            return servers.map(s => ({ ...s, apiPing: s.ping || 0, baseline: 0, region: null }));
        }
        return servers.map(s => {
            const apiPing = s.ping || 0;
            let estimated;
            if (apiPing > 80) {
                estimated = apiPing; // API zaten gerçek route — baseline ekleme
            } else if (apiPing > 0) {
                estimated = Math.round(baseline + apiPing / 2); // DC içi metric → yarı ağırlık
            } else {
                estimated = baseline;
            }
            const region = this.guessServerRegion(estimated, userCountry, baseline);
            return { ...s, apiPing, baseline, ping: estimated, region };
        });
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
        const bar = TrackedUI.createGameBar(placeId);
        
        if (target.parentNode) {
            target.parentNode.insertBefore(bar, target.nextSibling);
        } else if (target.appendChild) {
            target.appendChild(bar);
        }
        
        this.state.injected = true;
        this.state.retryCount = 0;
        console.log('[Tracked] v3.7 Bar injected');
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
        TrackedUI.setStatus('Yeni sunucular aranıyor...');

        try {
            const servers = await TrackedScanner.findNewServers(placeId, ({ scanned, page }) => {
                TrackedUI.setStatus(`${scanned} yeni sunucu (Sayfa: ${page})`);
            });

            TrackedUI.setStatus('');

            if (!Array.isArray(servers) || servers.length === 0) {
                TrackedUI.showNoNewServerModal(placeId);
                return;
            }

            const scoredServers = TrackedScanner.scoreNewServers(servers);
            
            if (!Array.isArray(scoredServers) || scoredServers.length === 0) {
                TrackedUI.showNoNewServerModal(placeId);
                return;
            }

            if (scoredServers.length === 1) {
                TrackedUI.showJoinModal(placeId, scoredServers[0]);
            } else {
                TrackedUI.showNewServerListModal(placeId, scoredServers);
            }

        } catch (err) {
            console.log('[Tracked] Yeni sunucu arama hatası:', err.message);
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
            this.state.isProcessing = false;
        }
    },

    // ============================================
    // v2.4.5: Global Buton Kilitleme ile performDeepScan
    // ============================================
    performDeepScan: async function(placeId) {
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

            // Kullanıcı baseline'ini + ülkeyi paralel ölç → region tahmini
            const [baseline, country] = await Promise.all([
                this.measureUserBaseline(),
                this.getUserCountry()
            ]);
            const topServers = this.applyPingEstimate(scored, baseline, country);

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
            const [baseline, country] = await Promise.all([
                this.measureUserBaseline(),
                this.getUserCountry()
            ]);
            return this.applyPingEstimate(scored, baseline, country);
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
        chrome.runtime.sendMessage({
            action: 'launchRobloxGame',
            placeId: String(placeId),
            jobId: String(jobId),
            gameTitle
        }, (resp) => {
            if (chrome.runtime.lastError || !resp || !resp.success) {
                // SW fail → fallback deeplink + Auto-Reconnect session'ı manuel tetikle
                try {
                    chrome.runtime.sendMessage({
                        action: 'saveActiveSession',
                        placeId: String(placeId),
                        jobId: String(jobId),
                        gameTitle
                    }, () => { /* fire-and-forget */ });
                } catch (_) {}
                window.location.href = `roblox://experiences/start?placeId=${encodeURIComponent(placeId)}&gameInstanceId=${encodeURIComponent(jobId)}`;
            }
        });

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
    // v4.0: INSTANCE TRIGGER - Blok Bazlı Boş Server Zorlaması
    // ============================================
    // Manuel yöntem: oyuna gir → herkesi engelle → çık → tekrar gir → 10-15 turda boş server
    // Bu sistem aynı mantığı otomatize eder:
    //   1. Server listesinden playerToken topla
    //   2. Token → userId çözümle (thumbnail batch API)
    //   3. Hepsini engelle (Roblox matchmaking artık seni mevcut serverlara koyamaz)
    //   4. jobId olmadan join → Roblox yeni boş server açmak zorunda kalır
    //   5. 30sn sonra engelleri otomatik kaldır
    forceNewInstance: async function(placeId) {
        if (!this.checkGlobalCooldown()) return;

        if (TrackedScanner.state.isScanning || this.state.isProcessing || TrackedUI.isAnyButtonLocked()) {
            TrackedUI.setStatus(TrackedI18n.t('processing') || 'İşlem devam ediyor...');
            return;
        }

        if (typeof TrackedInstanceTrigger === 'undefined') {
            TrackedUI.showErrorModal('instance_trigger.js yüklü değil.');
            return;
        }

        TrackedUI.lockAllButtons();
        TrackedUI.setForceMode(true, null); // Durdur butonu yok — işlem ortada kesilmemeli
        this.setGlobalCooldown(5000);
        this.state.isProcessing = true;

        const strategy = 'auto'; // group → social sırasıyla dener

        const PHASE_LABELS = {
            csrf:             '🔑 Oturum doğrulanıyor...',
            cleanup_previous: (p) => `🧹 Önceki engeller temizleniyor (${p.count})...`,
            harvest:          (p) => p.strategy === 'group'
                                      ? `👥 Grup üyeleri toplanıyor...`
                                      : `🔗 Sosyal ağ taranıyor...`,
            harvest_done:     (p) => p.strategy === 'group'
                                      ? `👥 ${p.count} grup üyesi bulundu`
                                      : `🔗 ${p.count} sosyal bağlantı bulundu`,
            presence_filter:  (p) => `🎮 Şu an oyunda olanlar tespit ediliyor (${p.candidates} kişi)...`,
            presence_done:    (p) => `🎯 ${p.inGame} kişi şu an bu oyunda`,
            block:            (p) => `🚫 Engelleniyor... (${p.done || 0}/${p.total})`,
            block_done:       (p) => `✅ ${p.blocked} kişi engellendi`,
            join:             '🚀 Oyuna giriliyor — Roblox boş server açıyor...',
            waiting_join:     '⏳ Oyuna girişin bekleniyor (engeller oyuna girince kalkacak)...',
            unblock:          (p) => `🔓 Engeller kaldırılıyor... (${p.total} kişi)`,
            unblock_done:     (p) => `✅ ${p.total} engel kaldırıldı`,
        };

        try {
            const result = await TrackedInstanceTrigger.run(placeId, {
                strategy,
                onProgress: (p) => {
                    const label = PHASE_LABELS[p.phase];
                    const msg   = typeof label === 'function' ? label(p) : (label || p.phase);
                    if (msg) TrackedUI.setStatus(msg);
                    console.log('[Tracked] v4.0:', p);
                }
            });

            if (result?.success) {
                TrackedUI.setStatus(`🚀 ${result.blocked} engel kuruldu — Roblox boş server açıyor. Giriş yapınca engeller otomatik kalkacak.`);
            }

        } catch (err) {
            console.error('[Tracked] v4.0 Hata:', err.message);
            TrackedUI.setStatus('');
            TrackedUI.showErrorModal(err.message || 'Instance Trigger başarısız.');
        } finally {
            TrackedUI.unlockAllButtons();
            TrackedUI.setForceMode(false);
            this.state.isProcessing = false;
        }
    },

    // ============================================
    // v4.1: A+B KOMBO — Sniper + GameJoin API Paralel
    // ============================================
    comboNewInstance: async function(placeId) {
        if (!this.checkGlobalCooldown()) return;

        if (TrackedScanner.state.isScanning || this.state.isProcessing || TrackedUI.isAnyButtonLocked()) {
            TrackedUI.setStatus(TrackedI18n.t('processing') || 'İşlem devam ediyor...');
            return;
        }

        if (typeof TrackedInstanceTrigger === 'undefined') {
            TrackedUI.showErrorModal('instance_trigger.js yüklü değil.');
            return;
        }

        TrackedUI.lockAllButtons();
        TrackedUI.setForceMode(true, null);
        this.setGlobalCooldown(5000);
        this.state.isProcessing = true;

        const LABELS = {
            // Faz 1: Quick snipe
            phase1_start:        '⚡ Faz 1/3: Hazır boş server kontrolü (5sn)...',
            phase1_join:         (p) => `🎯 Boş server bulundu! (${p.playing || 0} oyuncu) — bağlanılıyor...`,
            // Faz 2: Block-flood
            phase2_start:        '🛡️ Faz 2/3: Block-Flood başlatılıyor (community taraması)...',
            phase2_target:       (p) => `🎯 ${p.gamePlaying} oyunculu oyun → ${p.blockTarget} block hedeflendi`,
            phase2_baseline:     (p) => `📋 ${p.count} mevcut sunucu kaydedildi (yeniler ayırt edilecek)`,
            building_safelist:   '🛡️ Sosyal bağlantılar koruma listesine alınıyor...',
            exclusion_built:     (p) => `✅ ${p.protected} kişi koruma altında (arkadaş/takipçi/takip)`,
            harvest:             (p) => `🔍 Community üyeleri toplanıyor...`,
            harvest_done:        (p) => `✅ ${p.count} community üyesi toplandı`,
            presence_filter:        (p) => `🔎 ${p.candidates} aday içinden şu an oyunda olanlar süzülüyor (4 pass)...`,
            presence_pass:          (p) => `🔎 Presence pass ${p.pass}/${p.totalPasses} — ${p.inGame} kişi tespit edildi`,
            presence_done:          (p) => `✅ ${p.inGame} kişi şu an oyunda — öncelikli block listesi`,
            // Friends-of-in-game expansion
            friends_expansion_start:(p) => `🔗 Friends expansion: ${p.seedCount} seed kullanıcının arkadaşları taranıyor...`,
            friends_seed_done:      (p) => `🔗 Seed ${p.seed}/${p.total} → ${p.pool} arkadaş havuzu`,
            friends_presence_check: (p) => `🔎 ${p.count} arkadaş presence-check ediliyor...`,
            friends_expansion_done: (p) => `✅ Friends expansion: ${p.friendsInGame}/${p.friendsChecked} arkadaş in-game!`,
            friends_expansion_empty: '⚠️ Friends expansion sonuç vermedi',
            expansion_merged:       (p) => `🎯 In-game pool genişledi: ${p.before} → ${p.total} (+${p.added})`,
            block:               (p) => `🚫 Block: ${p.blocked || 0} başarılı (${p.done || 0}/${p.total})`,
            block_cooldown:      (p) => `⏸️ Rate-limit cooldown ${p.cooldown}/${p.max} — 20sn dinleniyor (${p.blocked} block aktif)...`,
            block_done:          (p) => `✅ ${p.blocked} kullanıcı blocklandı`,
            block_only_done:     (p) => `✅ Block tamamlandı (${p.blocked.length || p.blocked} kişi)`,
            phase2_fail:         (p) => `⚠️ Block-flood hatası: ${p.error}`,
            phase2_zero_blocks:  '⚠️ Hiç block yapılamadı — fallback',
            phase2_low_blocks:   (p) => `⚠️ Düşük block sayısı (${p.blocked}) — yine de matchmaker denenecek`,
            // Faz 3: Multi-strategy join — REST query → snipe → joinMultiplayerGame native
            phase3_propagation:    '⏳ Faz 3/3: Block yayılması (15sn)...',
            phase3_mainworld:      '🎯 MAIN world REST matchmaker query...',
            phase3_mainworld_ok:   (p) => `✅ REST server: ${p.jobId?.substring(0, 8)}... ${p.isNew ? '(YENİ 🆕)' : '(blocksuz)'}`,
            phase3_mainworld_miss: (p) => `⚠️ REST miss (${p.status || p.error || 'no_jobid'}), snipe deneniyor...`,
            phase3_snipe:          '🔍 Snipe fallback (5sn)...',
            phase3_snipe_ok:       (p) => `✅ Snipe server: ${p.jobId?.substring(0, 8)}... ${p.isNew ? '(YENİ 🆕)' : '(blocksuz)'}`,
            phase3_no_snipe:       '↪️ Snipe da yetişemedi, native join deneniyor...',
            phase3_native_join:    '🚀 Roblox.GameLauncher.joinMultiplayerGame native çağrı...',
            phase3_native_ok:      (p) => `✅ Native join tetiklendi (${p.method}) — Roblox client matchmaker\'a bırakıldı`,
            phase3_native_miss:    (p) => `⚠️ Native join başarısız (${p.error}), deep-link fallback`,
            native_join_initiated: '🚀 Roblox client join flow başlatıldı',
            snipe_poll:            (p) => `👁 Poll #${p.polls} (${p.found || 0} server görüldü)`,
            snipe_found:           (p) => `🎯 YENİ SUNUCU bulundu! (${p.playing || 0} oyuncu)`,
            snipe_best:            (p) => `🎯 En düşük oyunculu server seçildi (${p.playing || 0} oyuncu)`,
            // Common
            csrf:                '🔑 Oturum doğrulanıyor...',
            game_info:           '🎮 Oyun bilgisi alınıyor...',
            fallback:            '↪️ Standart deep-link ile giriş yapılıyor...',
            cleanup_previous:    (p) => `🧹 Önceki bekleyen ${p.count} block temizleniyor...`,
            waiting_join:        '⏳ Oyuna girişin bekleniyor (block kaldırma için)...',
            unblock:             (p) => `🔓 Block'lar kaldırılıyor (0/${p.total})...`,
            unblock_done:        (p) => `✅ ${p.total} block temizlendi`,
        };

        try {
            const result = await TrackedInstanceTrigger.runCombo(placeId, {
                onProgress: (p) => {
                    const label = LABELS[p.phase];
                    const msg = typeof label === 'function' ? label(p) : (label || p.phase);
                    if (msg) TrackedUI.setStatus(msg);
                    console.log('[Tracked] A+B Kombo:', p);
                }
            });

            if (result?.success) {
                if (result.method === 'quick_snipe') {
                    TrackedUI.setStatus(`🎯 Hızlı bulundu! Server ${result.jobId?.substring(0, 8)}... (Faz 1)`);
                } else if (result.method === 'block_then_mainworld_new') {
                    TrackedUI.setStatus(`🆕 YENİ server zorlandı! ${result.blocked} block + MAIN world REST (Faz 3a)`);
                } else if (result.method === 'block_then_mainworld_existing') {
                    TrackedUI.setStatus(`🎯 Blocksuz server bulundu! ${result.blocked} block + MAIN world REST`);
                } else if (result.method === 'block_then_snipe') {
                    TrackedUI.setStatus(`🎯 Snipe fallback başarılı! ${result.blocked} block + jobId (Faz 3b)`);
                } else if (result.method && result.method.startsWith('block_then_native_')) {
                    TrackedUI.setStatus(`🚀 Native join başlatıldı! ${result.blocked} block aktif — Roblox client karar verecek (Faz 3c)`);
                } else if (result.method === 'block_then_default') {
                    TrackedUI.setStatus(`🛡️ ${result.blocked} block aktif — Roblox client block listesini respect edecek`);
                } else {
                    TrackedUI.setStatus(`✅ Bağlandı (${result.method || 'unknown'})`);
                }
            } else {
                TrackedUI.setStatus(`⚠️ Yeni server zorlanamadı, standart bağlantı denendi (${result?.method || 'fallback'})`);
            }
        } catch (err) {
            console.error('[Tracked] A+B Kombo Hata:', err.message);
            TrackedUI.setStatus('');
            TrackedUI.showErrorModal(err.message || 'A+B Kombo başarısız.');
        } finally {
            TrackedUI.unlockAllButtons();
            TrackedUI.setForceMode(false);
            this.state.isProcessing = false;
        }
    },

    // ============================================
    // C+D CERRAHİ: Public servers'tan token→userId resolve → her server'dan 1 strategic block
    // ============================================
    targetedNewInstance: async function(placeId) {
        if (!this.checkGlobalCooldown()) return;

        if (TrackedScanner.state.isScanning || this.state.isProcessing || TrackedUI.isAnyButtonLocked()) {
            TrackedUI.setStatus(TrackedI18n.t('processing') || 'İşlem devam ediyor...');
            return;
        }

        if (typeof TrackedInstanceTrigger === 'undefined' || !TrackedInstanceTrigger.runTargeted) {
            TrackedUI.showErrorModal('instance_trigger.js güncel değil (runTargeted yok).');
            return;
        }

        TrackedUI.lockAllButtons();
        TrackedUI.setForceMode(true, null);
        this.setGlobalCooldown(5000);
        this.state.isProcessing = true;

        const LABELS = {
            csrf:                       '🔑 Oturum doğrulanıyor...',
            cleanup_previous:           (p) => `🧹 Önceki bekleyen ${p.count} block temizleniyor...`,
            // Faz -1: Reserved Server Probe (en kısa yol — eğer destekleniyorsa garanti çıkış!)
            reserve_probe:              '🔓 Faz -1: Reserved Server probe — ücretsiz boş server var mı?',
            reserve_found:              (p) => `🆕 RESERVED SERVER bulundu! (${p.source || 'reserved'}) → garanti boş server'a giriliyor...`,
            reserve_not_available:      (p) => `↪️ Reserved server desteklenmiyor (${p.error || 'no support'}), Faz 0'a devam`,
            reserve_skip:               (p) => `↪️ Reserve probe atlandı: ${p.reason}`,
            reserve_error:              (p) => `⚠️ Reserve probe hatası: ${p.error}`,
            // Faz 0: Passive Observer Snipe (kısa yol)
            observer_start:             '👁️ Faz 0/9: Yeni server izleyici (45sn) — sabırlı yakalama denemesi...',
            observer_baseline:          (p) => `👁️ Baseline: ${p.count} mevcut server kaydedildi`,
            observer_poll:              (p) => `👁️ Poll #${p.polls} — ${p.seen} server (${p.candidates} aday, ${p.newThisCycle} yeni bu turda)`,
            observer_found_fresh:       (p) => `🎯 SUPER-FRESH server: ${p.jobId?.substring(0, 8)}... (${p.playing} oyuncu)`,
            observer_best:              (p) => `🎯 En boş yeni server: ${p.jobId?.substring(0, 8)}... (${p.playing} oyuncu)`,
            observer_empty:             (p) => `↪️ Observer ${p.polls} pollda yeni server yakalayamadı`,
            observer_skip:              '↪️ Observer boş döndü, fingerprint matching\'e geçiliyor...',
            observer_join:              (p) => `🚀 Observer ile bağlanılıyor (${p.fresh ? 'fresh' : 'low'}, ${p.playing} oyuncu)`,
            // Faz 1: Public servers fetch
            targeted_phase1:            '📡 Faz 1/8: Public server\'lar toplanıyor (Asc + Desc)...',
            targeted_fetch_page:        (p) => `📄 ${p.sort} sayfa ${p.page} → ${p.totalServers} server`,
            targeted_servers_done:      (p) => `✅ ${p.serverCount} server (${p.totalTokens} token)`,
            // Faz 2: Server fingerprints (token → avatar hash)
            targeted_phase2_server_fp:  '🔬 Faz 2/7: Server token\'larından avatar fingerprint\'i çıkarılıyor...',
            fingerprint_servers_start:  (p) => `🔬 ${p.tokens} token fingerprint için işleniyor...`,
            fingerprint_servers_chunk:  (p) => `🔬 Server FP batch ${p.chunk}/${p.total} → ${p.extracted} hash`,
            fingerprint_servers_done:   (p) => `✅ ${p.servers} server'dan ${p.hashes} fingerprint çıkarıldı`,
            // Faz 3: Candidate pool
            building_safelist:          '🛡️ Faz 3/8: Sosyal bağlantılar koruma listesine alınıyor...',
            exclusion_built:            (p) => `✅ ${p.protected} kişi koruma altında`,
            targeted_phase3_candidates: '👥 Faz 3/8: Aday havuzu (community + activity-aware filter)...',
            // Activity-aware filtering (C+D 2.0)
            activity_filter_start:      (p) => `🔍 Activity-aware filter başlıyor (${p.candidates} aday)...`,
            activity_filter_progress:   (p) => `🔍 ${p.processed}/${p.total} işlendi → ${p.inGame} in-game, ${p.active} son aktif`,
            activity_filter_done:       (p) => `✅ Activity filter: ${p.inGame} in-game + ${p.recentlyActive} son aktif (%${p.activeRatio} aktif oran)`,
            targeted_pool_built:        (p) => `✅ Pool: ${p.poolSize} kişi (${p.inGame} in-game, ${p.recentlyActive} son aktif — recency-sorted)`,
            // Faz 4: User fingerprints (userId → avatar hash)
            targeted_phase4_user_fp:    '🔬 Faz 4/7: Aday userId\'lerin avatar fingerprint\'leri...',
            fingerprint_users_start:    (p) => `🔬 ${p.users} userId fingerprint için işleniyor...`,
            fingerprint_users_chunk:    (p) => `🔬 User FP batch ${p.chunk}/${p.total} → ${p.extracted} hash`,
            fingerprint_users_done:     (p) => `✅ ${p.users} userId fingerprint hazır`,
            // Faz 5: Fingerprint matching
            targeted_phase5_match:      '🎯 Faz 5/7: Hash matching — kim hangi server\'da?',
            targeted_targets_built:     (p) => `🎯 ${p.finalTargets} hedef (${p.verifiedMatches} verified + ${p.inGameTargets} in-game) — fingerprint: ${p.matchedServers}/${p.totalServers} server`,
            targets_expanded:           (p) => `📈 Adaptive expansion: ${p.from} → ${p.finalTotal} hedef (server count: ${p.reason || ''})`,
            targeted_coverage:          (p) => `📊 Kapsama: fingerprint %${p.fingerprintPercent} (${p.fingerprintCovered}) + estimated %${p.estimatedPercent} (${p.blockedInGame} in-game block)`,
            // Faz 5: Block
            block:                      (p) => `🚫 Block batch: ${p.total} hedef (${p.serverCount} server için ${p.adaptiveMin})`,
            iterative_batch:            (p) => `🚫 Batch ${p.batch}/${p.total} — ${p.batchSize} block (toplam: ${p.totalBlocked})`,
            iterative_snipe:            (p) => `🔍 Batch ${p.batch} sonrası snipe (${p.blocked} block aktif)`,
            iterative_jobid_found:      (p) => `🎯 Batch ${p.batch}'te YENİ server bulundu! ${p.fresh ? '(super-fresh!)' : ''} jobId: ${p.jobId?.substring(0, 8)}...`,
            iterative_early_block_exit: (p) => `✅ Erken çıkış: ${p.blocked} block (eşik: ${p.threshold}) — devam değer kaybediyor`,
            iterative_join_skip:        (p) => `⚡ Iterative jobId ile direkt giriş — Phase 7-9 atlandı`,
            block_cooldown:             (p) => `⏸️ Rate-limit cooldown ${p.cooldown}/${p.max} — 20sn dinleniyor (${p.blocked} block aktif)...`,
            block_done:                 (p) => `✅ ${p.blocked} block tamamlandı${p.iterativeJobIdFound ? ' + iterative jobId hazır!' : ''}`,
            targeted_coverage:          (p) => `🎯 Server kapsama: ${p.covered}/${p.total} (%${p.percent})`,
            // Faz 7: Multi-strategy join + post-block observer
            phase3_propagation:         '⏳ Faz 7/9: Block yayılması bekleniyor (15sn)...',
            phase3_post_observer:       '👁️ Post-block observer (12sn) — matchmaker bize yeni server açtı mı?',
            phase3_post_observer_ok:    (p) => `🆕 Post-block YENİ server: ${p.jobId?.substring(0, 8)}... ${p.fresh ? '(super-fresh!)' : ''}`,
            phase3_mainworld:           '🎯 MAIN world REST matchmaker query...',
            phase3_mainworld_ok:        (p) => `✅ REST server: ${p.jobId?.substring(0, 8)}... ${p.isNew ? '(YENİ 🆕)' : '(blocksuz)'}`,
            phase3_mainworld_miss:      (p) => `⚠️ REST miss (${p.status || p.error}), snipe deneniyor...`,
            phase3_snipe:               '🔍 Snipe fallback (5sn)...',
            phase3_snipe_ok:            (p) => `✅ Snipe: ${p.jobId?.substring(0, 8)}... ${p.isNew ? '(YENİ 🆕)' : ''}`,
            phase3_no_snipe:            '↪️ Snipe da yetişemedi, native join deneniyor...',
            phase3_native_join:         '🚀 Roblox.GameLauncher.joinMultiplayerGame...',
            phase3_native_ok:           (p) => `✅ Native join tetiklendi (${p.method})`,
            phase3_native_miss:         (p) => `⚠️ Native join başarısız (${p.error})`,
            native_join_initiated:      '🚀 Roblox client join flow başlatıldı',
            // Common
            waiting_join:               '⏳ Oyuna girişin bekleniyor (block kaldırma için)...',
            unblock:                    (p) => `🔓 Block'lar kaldırılıyor (${p.total})...`,
            unblock_done:               (p) => `✅ ${p.total} block temizlendi`,
        };

        try {
            const result = await TrackedInstanceTrigger.runTargeted(placeId, {
                onProgress: (p) => {
                    const label = LABELS[p.phase];
                    const msg = typeof label === 'function' ? label(p) : (label || p.phase);
                    if (msg) TrackedUI.setStatus(msg);
                    console.log('[Tracked] C+D Cerrahi:', p);
                }
            });

            if (result?.success) {
                if (result.method === 'reserved_server') {
                    TrackedUI.setStatus(`🔓 RESERVED SERVER ile garanti boş server'a girildi! (Faz -1, hiç block gerekmedi)`);
                } else if (result.method === 'observer_fresh') {
                    TrackedUI.setStatus(`🎯 SUPER-FRESH server (Faz 0): ${result.jobId?.substring(0, 8)}... — block hiç gerekmedi!`);
                } else if (result.method === 'observer_low') {
                    TrackedUI.setStatus(`🎯 Az dolu yeni server (Faz 0): ${result.jobId?.substring(0, 8)}... — block hiç gerekmedi!`);
                } else {
                    const fpCov = result.coveragePercent || 0;
                    const estCov = result.estimatedCoveragePercent || 0;
                    const cov = ` — fingerprint %${fpCov} + estimated %${estCov} (${result.blockedInGameCount} in-game block / ${result.totalServers} server)`;
                    if (result.method === 'targeted_iterative_fresh') {
                        TrackedUI.setStatus(`🆕 İteratif loop'ta SUPER-FRESH server yakalandı! ${result.blocked} block${cov}`);
                    } else if (result.method === 'targeted_iterative_low') {
                        TrackedUI.setStatus(`🎯 İteratif loop'ta yeni az dolu server! ${result.blocked} block${cov}`);
                    } else if (result.method === 'targeted_post_observer') {
                        TrackedUI.setStatus(`🆕 Post-block matchmaker yeni server açtı! ${result.blocked} block${cov}`);
                    } else if (result.method === 'targeted_mainworld_new') {
                        TrackedUI.setStatus(`🆕 YENİ server zorlandı! ${result.blocked} block${cov}`);
                    } else if (result.method === 'targeted_mainworld_existing') {
                        TrackedUI.setStatus(`🎯 Blocksuz server alındı${cov}`);
                    } else if (result.method === 'targeted_snipe') {
                        TrackedUI.setStatus(`🎯 Snipe başarılı${cov}`);
                    } else if (result.method && result.method.startsWith('targeted_native_')) {
                        TrackedUI.setStatus(`🚀 Native join başlatıldı${cov}`);
                    } else {
                        TrackedUI.setStatus(`🛡️ ${result.blocked} block aktif${cov} — Roblox karar verecek`);
                    }
                }
            } else {
                TrackedUI.setStatus(`⚠️ C+D başarısız (${result?.method || 'fallback'})`);
            }
        } catch (err) {
            console.error('[Tracked] C+D Cerrahi Hata:', err.message);
            TrackedUI.setStatus('');
            TrackedUI.showErrorModal(err.message || 'C+D Cerrahi başarısız.');
        } finally {
            TrackedUI.unlockAllButtons();
            TrackedUI.setForceMode(false);
            this.state.isProcessing = false;
        }
    },

    // ============================================
    // v3.0: AUTO-BLOCKER - Akıllı Filtreleme ve Otomatik Bağlanma
    // ============================================
    autoBlockerScan: async function(placeId) {
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
        TrackedUI.setStatus('Oto-Pilot: Başlatılıyor... 🛡️');

        // Kullanıcının ölçülmüş bölgesel ping'ini al (rota_ping_results) → dinamik MAX_PING
        // Roblox API'sinin ping field'i unreliable (server-internal metric, user-to-server değil),
        // ama kullanıcının kendi en iyi region pingini biliyorsak ona göre cap koyabiliriz:
        // best_region_ping + 60ms buffer (region matching için makul tolerance)
        let dynamicMaxPing = 120; // default: orta-sıkı
        try {
            const pingData = await chrome.storage.local.get('rota_ping_results');
            const results = pingData?.rota_ping_results;
            if (Array.isArray(results) && results.length > 0) {
                const validPings = results.map(r => r.ms).filter(ms => ms > 0 && ms < 900);
                if (validPings.length > 0) {
                    const bestRegionalPing = Math.min(...validPings);
                    // En iyi region + 60ms tolerans, ama 80-180ms arası clamp (çok sıkı/gevşek olmasın)
                    dynamicMaxPing = Math.max(80, Math.min(180, bestRegionalPing + 60));
                    console.log(`[Tracked] Auto-pilot: kullanıcı best region ${bestRegionalPing}ms, MAX_PING=${dynamicMaxPing}ms`);
                }
            }
        } catch (_) {}

        try {
            const server = await TrackedScanner.autoBlockerScan(
                placeId,
                // Progress callback
                ({ scanned, blocked, page, status }) => {
                    TrackedUI.setStatus(`Engellenen: ${blocked} | Taranan: ${scanned} 🛡️`);
                },
                // Blocked callback
                ({ reason, detail, totalBlocked }) => {
                    console.log(`[Auto-Blocker] Engellendi: ${reason}${detail ? ' (' + detail + ')' : ''}`);
                },
                // Server found callback - ANINDA BAĞLAN
                (foundServer) => {
                    console.log(`[Tracked] v3.1: Uygun sunucu bulundu (ping=${foundServer.ping}ms, max=${dynamicMaxPing}ms), bağlanıyor!`);
                    TrackedScanner.abort();
                    TrackedUI.setStatus('Sunucu bulundu! Bağlanıyor... 🛡️');

                    setTimeout(() => {
                        this.joinServer(placeId, foundServer.id);
                    }, 300);
                },
                { maxPlayers: 5, maxPing: dynamicMaxPing, signal: abortCtrl.signal }
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
                        TrackedUI.showForceFailedModal(placeId);
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
