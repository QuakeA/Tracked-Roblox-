// scanner.js - Tracked Extension v3.7 Smart Server Scanner & Player Analytics

const TrackedScanner = {
    state: {
        isScanning: false,
        abortController: null,
        progress: 0,
        scanType: 'normal',
        isRateLimited: false,  // v2.4.4: Global rate limit flag
        rateLimitResetTime: 0,  // v2.4.4: Rate limit bitiş zamanı
        isForceProcessing: false // v2.4.2+: Bağımsız force işlemi durumu
    },

    buildUrl: (placeId, cursor = null, sortOrder = 'Asc') => {
        let url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=${sortOrder}&limit=${TrackedConfig.API.SERVERS_PER_PAGE}`;
        if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
        return url;
    },

    // v3.0: Ultra konservatif backoff - rate limit için çok daha uzun
    calculateBackoff: (attempt, isRateLimit = false) => {
        if (isRateLimit) {
            // Rate limit için çok daha uzun bekleme - v3.0: 5s, 10s, 20s
            const base = 5000; // 5 saniye başlangıç (daha uzun)
            const exponential = base * Math.pow(2, attempt - 1); // 5s, 10s, 20s
            const jitter = Math.random() * 3000; // Daha fazla jitter
            return Math.min(exponential + jitter, 30000); // Max 30 saniye
        }
        // Normal hatalar için
        const base = 3000; // v3.0: 1500 → 3000ms (daha uzun)
        const exponential = base * Math.pow(1.5, attempt - 1);
        const jitter = Math.random() * 1000;
        return Math.min(exponential + jitter, 15000);
    },

    // v2.4.4: Rate limit durumunu kontrol et
    checkRateLimit: function() {
        if (this.state.isRateLimited) {
            const now = Date.now();
            if (now < this.state.rateLimitResetTime) {
                const waitSeconds = Math.ceil((this.state.rateLimitResetTime - now) / 1000);
                throw new Error(`Çok fazla istek gönderildi. Lütfen ${waitSeconds} saniye bekleyin.`);
            } else {
                // Rate limit süresi doldu
                this.state.isRateLimited = false;
            }
        }
    },

    // v2.4.4: Rate limit durumunu ayarla
    setRateLimit: function(durationMs = 15000) {
        this.state.isRateLimited = true;
        this.state.rateLimitResetTime = Date.now() + durationMs;
        console.log(`[Tracked] Rate limit active for ${durationMs}ms`);
    },

    fetchWithRetry: async function(url, attempt = 1) {
        // v2.4.4: Rate limit kontrolü
        this.checkRateLimit();
        
        try {
            await TrackedUtils.delay(TrackedConfig.API.DELAY_MS);
            
            // Abort kontrolü: parent controller iptal edilmiş mi?
            if (this.state.abortController?.signal?.aborted) {
                throw new Error('Scan cancelled');
            }
            
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), 15000);
            
            // Parent abort signal'ini de dinle
            const parentSignal = this.state.abortController?.signal;
            let parentAbortHandler;
            if (parentSignal && !parentSignal.aborted) {
                parentAbortHandler = () => timeoutController.abort();
                parentSignal.addEventListener('abort', parentAbortHandler, { once: true });
            }
            
            const response = await fetch(url, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                signal: timeoutController.signal,
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);
            if (parentAbortHandler && parentSignal) {
                parentSignal.removeEventListener('abort', parentAbortHandler);
            }

            // v2.4.4: Rate limit handling - daha agresif
            if (response.status === 429) {
                console.log(`[Tracked] Rate limit uyarısı (deneme ${attempt})`);
                
                // v2.4.4: Max attempt kontrolü
                if (attempt >= 3) {
                    // 3 denemeden sonra rate limit aktif et (15 saniye)
                    this.setRateLimit(15000);
                    throw new Error('RATE_LIMIT');
                }
                
                const backoffDelay = this.calculateBackoff(attempt, true);
                console.log(`[Tracked] Rate limit wait: ${Math.round(backoffDelay)}ms`);
                await TrackedUtils.delay(backoffDelay);
                
                return this.fetchWithRetry(url, attempt + 1);
            }

            if (response.status === 403) {
                throw new Error('API access forbidden (403)');
            }
            
            if (response.status === 404) {
                throw new Error('Game not found (404)');
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            // v2.4.4: Rate limit hatası ise tekrar deneme
            if (error.message && error.message.includes('Rate limited')) {
                throw error;
            }
            
            if (attempt < TrackedConfig.API.RETRY_ATTEMPTS) {
                const backoffDelay = this.calculateBackoff(attempt, false);
                await TrackedUtils.delay(backoffDelay);
                return this.fetchWithRetry(url, attempt + 1);
            }
            
            throw error;
        }
    },

    scan: async function(placeId, maxServers = TrackedConfig.API.MAX_SERVERS, onProgress = null) {
        // v2.4.4: Rate limit kontrolü
        try {
            this.checkRateLimit();
        } catch (err) {
            throw err;
        }
        
        if (this.state.isScanning) {
            console.warn('[Tracked] Scan already in progress');
            return [];
        }
        
        if (!placeId) {
            console.error('[Tracked] Invalid placeId');
            return [];
        }
        
        this.state.isScanning = true;
        this.state.scanType = 'normal';
        this.state.abortController = new AbortController();
        this.state.progress = 0;

        const servers = [];
        let cursor = null;
        let hasMore = true;
        let consecutiveErrors = 0;
        let pageCount = 0;
        let rateLimitHit = false;

        try {
            while (hasMore && servers.length < maxServers && consecutiveErrors < 3 && !this.state.abortController?.signal?.aborted) {
                try {
                    pageCount++;
                    const url = this.buildUrl(placeId, cursor, 'Asc');
                    
                    console.log(`[Tracked] Scan page ${pageCount}`);
                    
                    const data = await this.fetchWithRetry(url);

                    if (!data) {
                        console.warn('[Tracked] API returned null/undefined data');
                        consecutiveErrors++;
                        if (consecutiveErrors >= 3) break;
                        await TrackedUtils.delay(2000);
                        continue;
                    }

                    if (!data.data || !Array.isArray(data.data)) {
                        console.warn('[Tracked] API returned invalid data structure');
                        consecutiveErrors++;
                        if (consecutiveErrors >= 3) break;
                        await TrackedUtils.delay(2000);
                        continue;
                    }

                    if (data.data.length === 0) {
                        console.log('[Tracked] Empty data array, ending scan gracefully');
                        break;
                    }

                    const valid = data.data.filter(s => {
                        if (!s || typeof s !== 'object') return false;
                        if (!s.id) return false;
                        if (typeof s.playing !== 'number') return false;
                        if (typeof s.maxPlayers !== 'number') return false;
                        if (s.playing < TrackedConfig.API.MIN_PLAYERS) return false;
                        if (s.playing >= s.maxPlayers) return false;
                        return true;
                    });

                    if (valid.length > 0) {
                        servers.push(...valid);
                    }
                    
                    this.state.progress = Math.min(servers.length, maxServers);
                    consecutiveErrors = 0;
                    
                    if (onProgress) {
                        onProgress({ scanned: servers.length, target: maxServers, type: 'normal' });
                    }

                    const nextCursor = data.nextPageCursor;
                    
                    if (nextCursor && 
                        typeof nextCursor === 'string' && 
                        nextCursor !== '' && 
                        nextCursor !== 'null' && 
                        nextCursor !== 'undefined') {
                        cursor = nextCursor;
                        hasMore = true;
                    } else {
                        console.log('[Tracked] No valid cursor, ending scan');
                        hasMore = false;
                    }
                    
                    console.log(`[Tracked] Page ${pageCount}: ${valid.length} servers, total: ${servers.length}`);

                } catch (err) {
                    // v2.4.4: Rate limit hatası özel işleme
                    if (err.message && err.message.includes('RATE_LIMIT')) {
                        rateLimitHit = true;
                        throw err; // Yeniden fırlat, main.js'de yakalansın
                    }
                    
                    consecutiveErrors++;
                    console.warn(`[Tracked] Scan error (${consecutiveErrors}/3):`, err.message);
                    
                    if (consecutiveErrors >= 3) {
                        console.error('[Tracked] Max errors reached');
                        break;
                    }
                    
                    await TrackedUtils.delay(3000);
                }
            }

            console.log(`[Tracked] Scan complete: ${servers.length} servers`);
            return servers;
            
        } catch (globalErr) {
            console.error('[Tracked] Global scan error:', globalErr);
            throw globalErr; // v2.4.4: Hatayı yeniden fırlat
        } finally {
            this.state.isScanning = false;
            this.state.abortController = null;
        }
    },

    // Derin Tarama: Asc + Desc sayfalarını paralel çeker, ID bazlı dedup yapar
    deepScan: async function(placeId, maxServers = 400, onProgress = null) {
        this.checkRateLimit();

        if (this.state.isScanning) return [];
        if (!placeId) return [];

        this.state.isScanning = true;
        this.state.scanType = 'deep';
        this.state.abortController = new AbortController();

        const serverMap = new Map(); // id → server (dedup)
        let ascCursor = null;
        let descCursor = null;
        let ascDone = false;
        let descDone = false;
        const MAX_ROUNDS = 5; // 5 tur × 2 yön × 100 sunucu = max ~1000 tarama

        // Rate-limit tespiti: literal "RATE_LIMIT" + checkRateLimit'in attığı TR mesaj.
        const isRateLimitErr = (e) => {
            const m = e?.message || '';
            return m.includes('RATE_LIMIT') || m.includes('Çok fazla istek') || m.includes('Rate limit');
        };

        try {
            for (let round = 1; round <= MAX_ROUNDS; round++) {
                if (this.state.abortController?.signal?.aborted) break;
                if (serverMap.size >= maxServers) break;
                if (ascDone && descDone) break;

                // Asc + Desc paralel — 400ms stagger burst azaltır, 429 ihtimalini düşürür.
                const jobs = [];
                if (!ascDone) {
                    jobs.push(
                        this.fetchWithRetry(this.buildUrl(placeId, ascCursor, 'Asc'))
                            .then(data => ({ dir: 'Asc', data }))
                            .catch(err => ({ dir: 'Asc', error: err }))
                    );
                }
                if (!descDone) {
                    jobs.push(
                        TrackedUtils.delay(400)
                            .then(() => this.fetchWithRetry(this.buildUrl(placeId, descCursor, 'Desc')))
                            .then(data => ({ dir: 'Desc', data }))
                            .catch(err => ({ dir: 'Desc', error: err }))
                    );
                }

                const results = await Promise.all(jobs);

                let rateLimited = false;
                for (const result of results) {
                    if (result.error) {
                        if (isRateLimitErr(result.error)) {
                            rateLimited = true;
                            continue;
                        }
                        result.dir === 'Asc' ? (ascDone = true) : (descDone = true);
                        continue;
                    }

                    const data = result.data;
                    if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) {
                        result.dir === 'Asc' ? (ascDone = true) : (descDone = true);
                        continue;
                    }

                    data.data.forEach(s => {
                        if (s?.id && typeof s.playing === 'number' && typeof s.maxPlayers === 'number') {
                            if (!serverMap.has(s.id)) serverMap.set(s.id, s);
                        }
                    });

                    const next = data.nextPageCursor;
                    if (next && next !== '' && next !== 'null' && next !== 'undefined') {
                        result.dir === 'Asc' ? (ascCursor = next) : (descCursor = next);
                    } else {
                        result.dir === 'Asc' ? (ascDone = true) : (descDone = true);
                    }
                }

                if (onProgress) {
                    onProgress({ scanned: serverMap.size, round, maxRounds: MAX_ROUNDS });
                }

                // Rate limit: elimizde data varsa onu döndür, yoksa normalize edip fırlat.
                if (rateLimited) {
                    if (serverMap.size > 0) {
                        console.log(`[DeepScan] Rate limit — returning ${serverMap.size} partial results`);
                        return Array.from(serverMap.values());
                    }
                    throw new Error('RATE_LIMIT');
                }

                console.log(`[DeepScan] Round ${round}: ${serverMap.size} unique servers (Asc:${ascDone?'done':'cont'} Desc:${descDone?'done':'cont'})`);

                if (!ascDone || !descDone) await TrackedUtils.delay(700);
            }

            console.log(`[DeepScan] Complete: ${serverMap.size} unique servers`);
            return Array.from(serverMap.values());

        } catch (err) {
            // Hata sonrası bile data varsa kurtar — kullanıcı boş ekranla karşılaşmasın.
            if (serverMap.size > 0) {
                console.log(`[DeepScan] Error after ${serverMap.size} servers — returning partial:`, err.message);
                return Array.from(serverMap.values());
            }
            // Caller'lar tek string ile rate-limit'i tanısın diye normalize et.
            if (isRateLimitErr(err)) {
                console.log('[DeepScan] Rate limited (no partial data):', err.message);
                throw new Error('RATE_LIMIT');
            }
            console.error('[DeepScan] Error:', err);
            throw err;
        } finally {
            this.state.isScanning = false;
            this.state.abortController = null;
        }
    },

    findNewServers: async function(placeId, onProgress = null) {
        // v2.4.4: Rate limit kontrolü
        try {
            this.checkRateLimit();
        } catch (err) {
            throw err;
        }
        
        if (this.state.isScanning) {
            console.warn('[Tracked] Scan already in progress');
            return [];
        }
        
        if (!placeId) {
            console.error('[Tracked] Invalid placeId');
            return [];
        }
        
        this.state.isScanning = true;
        this.state.scanType = 'new';
        this.state.abortController = new AbortController();
        this.state.progress = 0;

        const servers = [];
        const maxScan = TrackedConfig.API.NEW_SERVER.MAX_SCAN;
        let cursor = null;
        let hasMore = true;
        let pageCount = 0;
        let consecutiveErrors = 0;

        console.log('[Tracked] Starting NEW SERVER scan (sortOrder=Desc)...');

        try {
            while (hasMore && servers.length < maxScan && consecutiveErrors < 3 && pageCount < 8 && !this.state.abortController?.signal?.aborted) {
                try {
                    pageCount++;
                    
                    if (pageCount > 1) {
                        await TrackedUtils.delay(TrackedConfig.API.DELAY_MS);
                    }

                    const url = this.buildUrl(placeId, cursor, 'Desc');
                    console.log(`[Tracked] New server scan - Page ${pageCount}`);
                    
                    const data = await this.fetchWithRetry(url);

                    if (!data) {
                        console.warn('[Tracked] API returned null/undefined');
                        consecutiveErrors++;
                        continue;
                    }

                    if (!data.data || !Array.isArray(data.data)) {
                        console.warn('[Tracked] API returned invalid data structure:', data);
                        consecutiveErrors++;
                        continue;
                    }

                    if (data.data.length === 0) {
                        console.log('[Tracked] Empty data, ending gracefully');
                        break;
                    }

                    const valid = data.data.filter(s => {
                        if (!s || typeof s !== 'object') return false;
                        if (!s.id) return false;
                        if (typeof s.playing !== 'number' || typeof s.maxPlayers !== 'number') return false;
                        if (s.playing >= s.maxPlayers) return false;
                        
                        const fullness = (s.playing / s.maxPlayers) * 100;
                        const ping = s.ping || 0;
                        
                        return fullness < 40 && (ping === 0 || ping < 200);
                    });

                    if (valid.length > 0) {
                        servers.push(...valid);
                    }
                    
                    this.state.progress = Math.min(servers.length, maxScan);
                    consecutiveErrors = 0;

                    if (onProgress) {
                        onProgress({ 
                            scanned: servers.length, 
                            target: maxScan, 
                            type: 'new',
                            page: pageCount 
                        });
                    }

                    const nextCursor = data.nextPageCursor;
                    
                    if (nextCursor && 
                        typeof nextCursor === 'string' && 
                        nextCursor !== '' && 
                        nextCursor !== 'null' && 
                        nextCursor !== 'undefined') {
                        cursor = nextCursor;
                        hasMore = true;
                    } else {
                        console.log('[Tracked] No valid cursor, ending');
                        hasMore = false;
                    }
                    
                    console.log(`[Tracked] New server page ${pageCount}: ${valid.length} valid, total: ${servers.length}`);

                    if (servers.length >= 15 || pageCount >= 5) {
                        console.log('[Tracked] Sufficient new servers found');
                        break;
                    }

                } catch (err) {
                    // v2.4.4: Rate limit hatası
                    if (err.message && err.message.includes('RATE_LIMIT')) {
                        throw err;
                    }
                    
                    consecutiveErrors++;
                    console.warn(`[Tracked] New server scan error (${consecutiveErrors}/3):`, err.message);
                    
                    if (consecutiveErrors >= 3) {
                        console.log('[Tracked] Yeni sunucu taraması: 3 ardışık hata sonrası durduruldu');
                        break;
                    }
                    
                    await TrackedUtils.delay(3000);
                }
            }

            console.log(`[Tracked] New server scan complete: ${servers.length} servers`);
            return servers;

        } catch (globalErr) {
            console.error('[Tracked] Global new server scan error:', globalErr);
            throw globalErr;
        } finally {
            this.state.isScanning = false;
            this.state.abortController = null;
        }
    },

    scoreNewServers: (servers) => {
        if (!Array.isArray(servers)) {
            console.warn('[Tracked] scoreNewServers received non-array');
            return [];
        }
        
        if (servers.length === 0) return [];
        
        return servers.map(server => {
            let score = 1000;
            
            const fullness = (server.playing / server.maxPlayers) * 100;
            score -= (fullness * 15);
            
            if (server.playing <= 2) score += 200;
            else if (server.playing <= 5) score += 100;
            else if (server.playing <= 10) score += 50;
            
            const ping = server.ping || 0;
            if (ping > 0) {
                if (ping < 60) score += 150;        // çok düşük: bonus arttı
                else if (ping < 90) score += 100;
                else if (ping < 120) score += 30;   // 50→30 (eski: 50)
                else if (ping > 150) score -= 100;  // 200→150 ve -50→-100 (sıkı ceza)
                else if (ping > 200) score -= 200;  // ekstra ceza yüksek ping
            }

            if (server.fps) {
                if (server.fps >= 58) score += 80;
                else if (server.fps >= 55) score += 40;
            }

            return { ...server, score, isNew: true };
        }).sort((a, b) => b.score - a.score);
    },

    score: (servers) => {
        if (!Array.isArray(servers)) {
            console.warn('[Tracked] score received non-array');
            return [];
        }
        
        if (servers.length === 0) return [];
        
        return servers.map(server => {
            let score = 1000;
            score -= (server.playing * 80);
            
            if (typeof server.ping === 'number') {
                if (server.ping < 80) score += 60;
                else if (server.ping < 120) score += 30;
                else if (server.ping > 200) score -= 40;
            }
            
            if (server.fps) {
                if (server.fps >= 58) score += 40;
                else if (server.fps >= 55) score += 20;
            }
            
            const fullness = (server.playing / server.maxPlayers) * 100;
            if (fullness < 30) score += 20;
            else if (fullness > 80) score -= 30;
            
            return { ...server, score };
        }).sort((a, b) => b.score - a.score);
    },

    // ============================================
    // v3.1: ADAPTIVE SNIPER - Tek İstek, Akıllı Aralık
    // ============================================
    // Matematiksel model:
    //   Roblox /servers/Public limiti: ~20 istek/dakika/IP
    //   Güvenli base aralık: 5000ms (12 istek/dk, diğer arka plan
    //   istekleriyle birlikte limitin altında kalır)
    //
    //   Adaptif ayar (sunucu doluluk oranına göre):
    //     min_playing = tüm sunucular arasında en az oyunculu
    //     min_playing <= 3  → interval = 4000ms  (boş sunucu yakın)
    //     min_playing 4-10  → interval = 5000ms  (normal)
    //     min_playing > 10  → interval = 7000ms  (hepsi dolu, yeni açılması zaman alır)
    //
    //   429 alınırsa: Retry-After başlığını oku, tam olarak bekle,
    //                 sonra interval = min(12000, interval * 1.5)
    //   Başarı sonrası interval yavaşça base'e döner.
    //
    //   Döngü başına 1 istek (Asc: en boşu önce getirir).
    //   Hiçbir zaman 2 istek art arda atılmaz.
    forceNewInstance: async function(placeId, onProgress = null, onServerFound = null) {
        console.log('[Tracked] ADAPTIVE SNIPER v3.1: Starting...');
        
        if (this.state.isForceProcessing) {
            throw new Error('Tarama zaten çalışıyor');
        }

        // Önceki rate limit süresi dolmuşsa temizle
        if (this.state.isRateLimited) {
            const remaining = this.state.rateLimitResetTime - Date.now();
            if (remaining > 0) {
                const wait = Math.ceil(remaining / 1000);
                throw new Error(`Rate limit: ${wait}s bekleyin`);
            }
            this.state.isRateLimited = false;
            this.state.rateLimitResetTime = 0;
        }

        this.state.isForceProcessing = true;
        this.state.huntStartTime = Date.now();

        // ── Tek istek fonksiyonu ──────────────────────────────
        // sortOrder=Asc → Roblox en az oyunculuyu ilk sıraya koyar
        // Döngü başına sadece 1 kez çağrılır. Hiçbir zaman 2 istek art arda değil.
        const singleRequest = async () => {
            const url = this.buildUrl(placeId, null, 'Asc');
            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), 8000);
            try {
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
                    signal: ctrl.signal,
                    credentials: 'omit'
                });
                clearTimeout(tid);
                if (res.status === 429) {
                    // Retry-After başlığı varsa onu kullan, yoksa 15sn varsayılan
                    const ra = parseInt(res.headers.get('Retry-After') || '15', 10);
                    return { rateLimited: true, retryAfter: ra };
                }
                if (!res.ok) return { error: res.status };
                const json = await res.json();
                return { servers: Array.isArray(json.data) ? json.data : [] };
            } catch (e) {
                clearTimeout(tid);
                return { error: e.message };
            }
        };

        // ── Adaptif interval hesabı ──────────────────────────
        // minPlaying = bu turdaki en az oyunculu sunucu
        const adaptInterval = (baseMs, minPlaying) => {
            if (minPlaying <= 3)  return Math.max(4000, baseMs - 1000); // Yakın, biraz hızlan
            if (minPlaying <= 10) return baseMs;                        // Normal
            return Math.min(8000, baseMs + 1000);                       // Hepsi dolu, yavaşla
        };

        // ── Ana döngü ────────────────────────────────────────
        let attempts  = 0;
        let baseMs    = 5000;   // Başlangıç aralığı (12 istek/dk — limitin altında)
        const MAX_ATTEMPTS = 20;

        try {
            await TrackedUtils.delay(800); // Çift-tık koruması

            while (attempts < MAX_ATTEMPTS && this.state.isForceProcessing) {
                attempts++;
                const elapsed = Math.floor((Date.now() - this.state.huntStartTime) / 1000);

                if (onProgress) {
                    onProgress({
                        attempt: attempts,
                        maxAttempts: MAX_ATTEMPTS,
                        elapsed,
                        status: 'hunting',
                        message: `Taranıyor... (${attempts}/${MAX_ATTEMPTS})`
                    });
                }

                const result = await singleRequest();

                // ── 429 ─────────────────────────────────────────────
                if (result.rateLimited) {
                    const waitMs = result.retryAfter * 1000;
                    baseMs = Math.min(12000, baseMs * 1.5); // Aralığı artır, bir daha yeme
                    this.setRateLimit(waitMs);
                    console.log(`[Tracked] v3.1: 429 — ${result.retryAfter}s bekleniyor, yeni base: ${baseMs}ms`);
                    await TrackedUtils.delay(waitMs);
                    continue; // Bekleme bitti, tekrar dene
                }

                // ── Ağ hatası ────────────────────────────────────────
                if (result.error || !result.servers) {
                    console.warn(`[Tracked] v3.1: İstek hatası — ${result.error}`);
                    await TrackedUtils.delay(baseMs);
                    continue;
                }

                // ── Sunucu değerlendirme ─────────────────────────────
                const servers = result.servers;
                const empties = servers.filter(s =>
                    s && s.id &&
                    typeof s.playing === 'number' &&
                    s.playing <= 1 &&
                    s.playing < s.maxPlayers
                ).sort((a, b) => a.playing - b.playing);

                if (empties.length > 0) {
                    console.log(`[Tracked] v3.1: Hedef bulundu — ${empties[0].playing} oyuncu`);
                    if (onServerFound) onServerFound(empties[0]);
                    return empties[0];
                }

                // Doluluk bazlı adaptif bekleme
                const minPlaying = servers.length > 0
                    ? Math.min(...servers.map(s => s.playing || 0))
                    : 99;
                const waitMs = adaptInterval(baseMs, minPlaying);
                console.log(`[Tracked] v3.1: Boş yok (en az ${minPlaying}). ${waitMs}ms bekleniyor...`);
                await TrackedUtils.delay(waitMs);
            }

            console.log('[Tracked] v3.1: Maksimum deneme aşıldı');
            return null;

        } catch (err) {
            console.error('[Tracked] v3.1 Hata:', err);
            throw err;
        } finally {
            this.state.isForceProcessing = false;
            this.state.huntStartTime = null;
        }
    },
    
    // v2.9: Av modunu durdur
    stopForceHunt: function() {
        console.log('[Tracked] v2.9: Stopping hunt...');
        this.state.isForceProcessing = false;
        // AbortController'ı da iptal et
        if (this.state.abortController) {
            this.state.abortController.abort();
        }
    },

    // Tüm aktif taramaları iptal et
    abort: function() {
        console.log('[Tracked] Aborting all scans...');
        if (this.state.abortController) {
            this.state.abortController.abort();
            this.state.abortController = null;
        }
        this.state.isScanning = false;
        this.state.isForceProcessing = false;
    },

    // ============================================
    // v3.0: AUTO-BLOCKER - Akıllı Filtreleme ve Otomatik Bağlanma
    // ============================================
    autoBlockerScan: async function(placeId, onProgress = null, onBlocked = null, onServerFound = null, opts = {}) {
        console.log('[Tracked] AUTO-BLOCKER v3.1: Paralel tarama başlatılıyor...');

        if (this.state.isScanning) {
            throw new Error('Tarama zaten çalışıyor');
        }

        if (this.state.isRateLimited) {
            const remaining = this.state.rateLimitResetTime - Date.now();
            if (remaining > 0) {
                const wait = Math.ceil(remaining / 1000);
                throw new Error(`Rate limit: ${wait}s bekleyin`);
            }
            this.state.isRateLimited = false;
        }

        this.state.isScanning = true;
        this.state.scanType = 'autoblocker';

        const BLOCKER_DELAY = 500;
        const MAX_PAGES     = 10;
        const MAX_PLAYERS   = opts.maxPlayers ?? 5;   // eski: 2 (çok katıydı)
        const MAX_PING      = opts.maxPing    ?? 300;  // eski: 150ms (çok katıydı)
        const signal        = opts.signal ?? null;

        let blockedCount = 0;
        let scannedCount = 0;

        const fetchPage = async (cursor, sortOrder) => {
            try {
                const url = this.buildUrl(placeId, cursor, sortOrder);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
                    signal: controller.signal,
                    credentials: 'omit'
                });

                clearTimeout(timeoutId);

                if (response.status === 429) return { rateLimited: true };
                if (!response.ok) return { error: response.status };

                const data = await response.json();
                return { data };
            } catch (err) {
                return { error: err.message };
            }
        };

        const filterServer = (server) => {
            if (!server || !server.id || typeof server.playing !== 'number') {
                return { valid: false, reason: 'invalid' };
            }
            if (server.playing > MAX_PLAYERS) {
                return { valid: false, reason: 'too_many_players', detail: `${server.playing} oyuncu` };
            }
            const ping = server.ping || 0;
            if (ping > MAX_PING && ping > 0) {
                return { valid: false, reason: 'high_ping', detail: `${ping}ms` };
            }
            if (server.playing >= server.maxPlayers) {
                return { valid: false, reason: 'full' };
            }
            return { valid: true };
        };

        let cursorAsc = null, cursorDesc = null;
        let pageCount = 0;

        // v3.2: Tüm aday sunucuları biriktir, sonunda en iyisini seç
        // (eski: ilk uygun adayı bulan kazanır → düşük kaliteli sonuçlar)
        // Yeni: 3 sayfa boyunca aday topla, sonra skorla ve en iyiyi seç (~1.5sn)
        const allCandidates = [];
        const MIN_PAGES_BEFORE_PICK = 3; // En az 3 sayfa ara (yeterli aday için)
        const EARLY_EXIT_CANDIDATE_COUNT = 8; // 8+ aday → erken çık (yeterli numune)

        try {
            while (pageCount < MAX_PAGES && this.state.isScanning) {
                // Kullanıcı durdurduysa çık
                if (signal?.aborted) {
                    console.log('[Tracked] v3.1: Kullanıcı taramayı durdurdu.');
                    return null;
                }

                pageCount++;

                // Asc + Desc PARALEL çek (2x hız)
                const [ascResult, descResult] = await Promise.all([
                    fetchPage(cursorAsc, 'Asc'),
                    fetchPage(cursorDesc, 'Desc')
                ]);

                // Rate limit kontrolü
                if (ascResult.rateLimited || descResult.rateLimited) {
                    this.setRateLimit(15000);
                    console.log('[Tracked] v3.1: Rate limit, duruyorum.');
                    // Şu ana kadar bulunan adayları kullanmaya çalış
                    if (allCandidates.length > 0) break;
                    return null;
                }

                // Her iki sayfadan gelen adayları topla
                for (const result of [ascResult, descResult]) {
                    if (!result.data?.data) continue;
                    for (const server of result.data.data) {
                        scannedCount++;
                        const check = filterServer(server);
                        if (!check.valid) {
                            blockedCount++;
                            onBlocked?.({ server, reason: check.reason, detail: check.detail, totalBlocked: blockedCount });
                        } else {
                            allCandidates.push(server);
                        }
                    }
                }

                // Cursor güncelle
                const nextAsc = ascResult.data?.nextPageCursor;
                if (nextAsc && nextAsc !== 'null') cursorAsc = nextAsc;
                const nextDesc = descResult.data?.nextPageCursor;
                if (nextDesc && nextDesc !== 'null') cursorDesc = nextDesc;

                // Progress
                onProgress?.({ scanned: scannedCount, blocked: blockedCount, page: pageCount, status: 'filtering' });

                // Erken çıkış: yeterli aday biriktirdik VE minimum sayfa eşiğini geçtik
                if (pageCount >= MIN_PAGES_BEFORE_PICK && allCandidates.length >= EARLY_EXIT_CANDIDATE_COUNT) {
                    break;
                }

                // Sayfada sonu vurmuşuz (cursor null) → daha fazla sayfa yok
                if (!cursorAsc && !cursorDesc) break;

                await TrackedUtils.delay(BLOCKER_DELAY);
            }

            // Tüm sayfalar tarandı (veya yeterli aday) → en iyiyi seç
            if (allCandidates.length > 0) {
                const scored = this.scoreNewServers(allCandidates);
                const best = scored[0];
                console.log(`[Tracked] v3.2: ${allCandidates.length} aday içinden en iyisi seçildi: ${best.playing} oyuncu, ${best.ping || '?'}ms ping, skor=${best.score}`);
                console.log(`[Tracked] v3.2: Top 3 adaylar:`, scored.slice(0, 3).map(s => ({ players: s.playing, ping: s.ping, fps: s.fps, score: s.score })));
                onServerFound?.(best);
                return best;
            }

            console.log(`[Tracked] v3.2: ${scannedCount} sunucu tarandı, uygun bulunamadı.`);
            return null;

        } catch (err) {
            console.error('[Tracked] v3.1 Error:', err);
            throw err;
        } finally {
            this.state.isScanning = false;
        }
    },

    // ============================================
    // v3.6: ADVANCED PLAYER INSIGHT - Simüle edilmiş kullanıcı kalite analizi
    // NOT: Bu fonksiyon PingUtils.analyzeServerPlayers ile kasıtlı olarak aynıdır.
    // Content Script (TrackedScanner) ve Popup (PingUtils) farklı JS ortamlarında çalışır.
    // Değişiklik yapıldığında HER İKİ KOPYA da güncellenmelidir.
    // ============================================
    analyzeServerPlayers: function(server) {
        if (!server || !server.id) return { score: 0, badges: [], simulated: true };
        
        const badges = [];
        let trustScore = 50; // Güven skoru 0-100
        
        const ping = server.ping || 0;
        const fps = server.fps || 0;
        const fullness = (server.playing / server.maxPlayers) * 100;
        
        // Sunucu ID'sinden "sözde yaş" hesapla (simülasyon)
        const serverHash = server.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const simulatedAge = (serverHash % 365); // 0-365 gün
        
        // 💎 ELİT SUNUCU: Mükemmel koşullar
        if (ping > 0 && ping < 60 && fps >= 58 && fullness > 30 && fullness < 80) {
            badges.push({ type: 'elite', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,215,0,0.35)" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>', label: 'Elit Sunucu' });
            trustScore += 40;
        }
        // ⭐ GÜVENLİ KULLANICI: Stabil + Orta doluluk
        else if (ping > 0 && ping < 120 && fps >= 50 && fullness >= 20) {
            badges.push({ type: 'safe', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(48,209,88,0.25)" stroke="#30D158" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>', label: 'Güvenli Kullanıcı' });
            trustScore += 25;
        }
        
        // 🤓 YENİ KULLANICI: Az doluluk veya yeni sunucu
        if (fullness < 25 || server.playing <= 2) {
            badges.push({ type: 'newbie', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(100,180,255,0.25)" stroke="#64B4FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>', label: 'Yeni Kullanıcı' });
            trustScore -= 10;
        }
        
        // 🛡️ STABİL: Uzun süre açık kalmış (simüle edilmiş)
        if (simulatedAge > 100 && fps >= 45) {
            badges.push({ type: 'stable', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(191,90,242,0.25)" stroke="#BF5AF2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>', label: 'Stabil' });
            trustScore += 15;
        }
        
        // ⚠️ RİSKLİ: Yüksek ping veya düşük FPS
        if (ping > 180 || (fps > 0 && fps < 35)) {
            badges.push({ type: 'risky', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,159,10,0.25)" stroke="#FF9F0A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>', label: 'Riskli' });
            trustScore -= 25;
        }
        
        return {
            score: Math.max(0, Math.min(100, trustScore)),
            badges: badges,
            simulatedServerAge: simulatedAge,
            ping: ping,
            fps: fps,
            simulated: true // Bu verilerin simüle edildiğini belirt
        };
    }
};

