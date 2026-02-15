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
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);

            // v2.4.4: Rate limit handling - daha agresif
            if (response.status === 429) {
                console.log(`[Tracked] Rate limit uyarısı (deneme ${attempt})`);
                
                // v2.4.4: Max attempt kontrolü
                if (attempt >= 3) {
                    // 3 denemeden sonra rate limit aktif et (15 saniye)
                    this.setRateLimit(15000);
                    throw new Error('Rate limit aşıldı. Lütfen 15 saniye bekleyin.');
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
            while (hasMore && servers.length < maxServers && consecutiveErrors < 3) {
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
                    if (err.message && err.message.includes('Rate limit exceeded')) {
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
            while (hasMore && servers.length < maxScan && consecutiveErrors < 3 && pageCount < 8) {
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
                    if (err.message && err.message.includes('Rate limit exceeded')) {
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
                if (ping < 80) score += 100;
                else if (ping < 120) score += 50;
                else if (ping > 200) score -= 50;
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
    // v2.9: SAFE HUNTER - Rate-Limit Dostu Tarama
    // ============================================
    // Sürekli polling + Anında katılma + Çift yönlü tarama
    forceNewInstance: async function(placeId, onProgress = null, onServerFound = null) {
        console.log('[Tracked] SAFE HUNTER v2.9: Starting...');
        
        if (this.state.isForceProcessing) {
            throw new Error('Tarama zaten çalışıyor');
        }
        
        if (this.state.isRateLimited) {
            const remaining = this.state.rateLimitResetTime - Date.now();
            if (remaining > 0) {
                const wait = Math.ceil(remaining / 1000);
                throw new Error(`Rate limit: ${wait}s bekleyin`);
            } else {
                // Süre dolmuş, rate limit'i resetle
                this.state.isRateLimited = false;
                this.state.rateLimitResetTime = 0;
            }
        }
        
        this.state.isForceProcessing = true;
        this.state.huntStartTime = Date.now();
        
        // Seri istek fonksiyonu (rate limit dostu)
        const safeRequest = async (sortOrder) => {
            try {
                const url = this.buildUrl(placeId, null, sortOrder);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
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
        
        // Sürekli av döngüsü - SERİ (paralel değil!)
        let attempts = 0;
        const MAX_ATTEMPTS = 15; // 15 deneme
        const POLL_INTERVAL = 8000; // 8 saniye bekleme (daha güvenli)
        
        try {
            // İlk istek öncesi bekleme (butona çift tıklama koruması)
            await TrackedUtils.delay(1000);
            
            while (attempts < MAX_ATTEMPTS && this.state.isForceProcessing) {
                attempts++;
                const elapsed = Math.floor((Date.now() - this.state.huntStartTime) / 1000);
                
                if (onProgress) {
                    onProgress({
                        attempt: attempts,
                        maxAttempts: MAX_ATTEMPTS,
                        elapsed: elapsed,
                        status: 'hunting',
                        message: `Taranıyor... (${attempts}/${MAX_ATTEMPTS})`
                    });
                }
                
                // 1. SIRAYLA: Desc (Yeni sunucular)
                const descResult = await safeRequest('Desc');
                
                if (descResult.rateLimited) {
                    this.setRateLimit(15000);
                    console.log('[Tracked] Rate limit detected (Desc), pausing...');
                    return null; // Graceful exit
                }
                
                if (descResult.data?.data) {
                    const descTargets = descResult.data.data.filter(s => 
                        s && s.id && typeof s.playing === 'number' && 
                        s.playing <= 1 && s.playing < s.maxPlayers
                    ).sort((a, b) => a.playing - b.playing);
                    
                    if (descTargets.length > 0) {
                        const best = descTargets[0];
                        console.log(`[Tracked] v2.9: Found in Desc - ${best.playing} players`);
                        if (onServerFound) onServerFound(best);
                        return best;
                    }
                }
                
                // 2. SIRAYLA: Asc (Eski/boş sunucular)
                const ascResult = await safeRequest('Asc');
                
                if (ascResult.rateLimited) {
                    this.setRateLimit(15000);
                    console.log('[Tracked] Rate limit detected (Asc), pausing...');
                    return null; // Graceful exit
                }
                
                if (ascResult.data?.data) {
                    const ascTargets = ascResult.data.data.filter(s => 
                        s && s.id && typeof s.playing === 'number' && 
                        s.playing <= 1 && s.playing < s.maxPlayers
                    ).sort((a, b) => a.playing - b.playing);
                    
                    if (ascTargets.length > 0) {
                        const best = ascTargets[0];
                        console.log(`[Tracked] v2.9: Found in Asc - ${best.playing} players`);
                        if (onServerFound) onServerFound(best);
                        return best;
                    }
                }
                
                // Bekle ve devam et
                await TrackedUtils.delay(POLL_INTERVAL);
            }
            
            // Maksimum deneme aşıldı
            console.log('[Tracked] v2.9: Max attempts reached');
            return null;
            
        } catch (err) {
            console.error('[Tracked] v2.9 Error:', err);
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
    },

    // ============================================
    // v3.0: AUTO-BLOCKER - Akıllı Filtreleme ve Otomatik Bağlanma
    // ============================================
    autoBlockerScan: async function(placeId, onProgress = null, onBlocked = null, onServerFound = null) {
        console.log('[Tracked] AUTO-BLOCKER v3.0: Akıllı filtreleme başlatılıyor...');
        
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
        
        const BLOCKER_DELAY = 500; // 500ms - hızlı ama güvenli
        const MAX_PAGES = 10; // Maksimum sayfa
        const MAX_PLAYERS = 2; // 0-1 oyuncu kabul edilir
        const MAX_PING = 150; // 150ms üstü engellenir
        
        let blockedCount = 0; // Engellenen sunucu sayısı
        let scannedCount = 0; // Tarlanan toplam sunucu
        
        // İstek fonksiyonu
        const fetchPage = async (cursor, sortOrder) => {
            try {
                const url = this.buildUrl(placeId, cursor, sortOrder);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
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
        
        // Filtreleme fonksiyonu
        const filterServer = (server) => {
            // Temel validasyon
            if (!server || !server.id || typeof server.playing !== 'number') {
                return { valid: false, reason: 'invalid' };
            }
            
            // Kriter 1: Oyuncu sayısı > 2 ise engelle
            if (server.playing > MAX_PLAYERS) {
                return { valid: false, reason: 'too_many_players', 
                         detail: `${server.playing} oyuncu` };
            }
            
            // Kriter 2: Ping > 150 ise engelle
            const ping = server.ping || 0;
            if (ping > MAX_PING && ping > 0) {
                return { valid: false, reason: 'high_ping', 
                         detail: `${ping}ms` };
            }
            
            // Kriter 3: Dolu sunucuları engelle
            if (server.playing >= server.maxPlayers) {
                return { valid: false, reason: 'full' };
            }
            
            return { valid: true };
        };
        
        // Cursor'lar
        let cursorAsc = null, cursorDesc = null;
        let pageCount = 0;
        
        try {
            while (pageCount < MAX_PAGES * 2 && this.state.isScanning) {
                pageCount++;
                
                // 1. SIRAYLA: Asc (Eski/boş sunucular)
                const ascResult = await fetchPage(cursorAsc, 'Asc');
                
                if (ascResult.rateLimited) {
                    this.setRateLimit(15000);
                    console.log('[Tracked] Rate limit detected, pausing...');
                    return null;
                }
                
                if (ascResult.data?.data) {
                    for (const server of ascResult.data.data) {
                        scannedCount++;
                        const check = filterServer(server);
                        
                        if (!check.valid) {
                            blockedCount++;
                            if (onBlocked) {
                                onBlocked({ 
                                    server, 
                                    reason: check.reason, 
                                    detail: check.detail,
                                    totalBlocked: blockedCount 
                                });
                            }
                            continue; // Bu sunucuyu atla
                        }
                        
                        // UYGUN SUNUCU BULUNDU!
                        console.log(`[Tracked] v3.0: Uygun sunucu bulundu! ${server.playing} oyuncu, ${server.ping || '?'}ms ping`);
                        
                        if (onServerFound) {
                            onServerFound(server);
                        }
                        
                        return server;
                    }
                    
                    // Sonraki cursor
                    const nextCursor = ascResult.data.nextPageCursor;
                    if (nextCursor && typeof nextCursor === 'string' && nextCursor !== 'null') {
                        cursorAsc = nextCursor;
                    }
                }
                
                // Progress bildir
                if (onProgress) {
                    onProgress({
                        scanned: scannedCount,
                        blocked: blockedCount,
                        page: pageCount,
                        status: 'filtering'
                    });
                }
                
                await TrackedUtils.delay(BLOCKER_DELAY);
                
                // 2. SIRAYLA: Desc (Yeni sunucular)
                const descResult = await fetchPage(cursorDesc, 'Desc');
                
                if (descResult.rateLimited) {
                    this.setRateLimit(15000);
                    console.log('[Tracked] Rate limit detected, pausing...');
                    return null;
                }
                
                if (descResult.data?.data) {
                    for (const server of descResult.data.data) {
                        scannedCount++;
                        const check = filterServer(server);
                        
                        if (!check.valid) {
                            blockedCount++;
                            if (onBlocked) {
                                onBlocked({ 
                                    server, 
                                    reason: check.reason, 
                                    detail: check.detail,
                                    totalBlocked: blockedCount 
                                });
                            }
                            continue;
                        }
                        
                        // UYGUN SUNUCU BULUNDU!
                        console.log(`[Tracked] v3.0: Uygun sunucu bulundu! ${server.playing} oyuncu, ${server.ping || '?'}ms ping`);
                        
                        if (onServerFound) {
                            onServerFound(server);
                        }
                        
                        return server;
                    }
                    
                    // Sonraki cursor
                    const nextCursor = descResult.data.nextPageCursor;
                    if (nextCursor && typeof nextCursor === 'string' && nextCursor !== 'null') {
                        cursorDesc = nextCursor;
                    }
                }
                
                // Progress bildir
                if (onProgress) {
                    onProgress({
                        scanned: scannedCount,
                        blocked: blockedCount,
                        page: pageCount,
                        status: 'filtering'
                    });
                }
                
                await TrackedUtils.delay(BLOCKER_DELAY);
            }
            
            // Hiç uygun sunucu bulunamadı
            console.log(`[Tracked] v3.0: ${scannedCount} sunucu tarandı, ${blockedCount} tanesi engellendi. Uygun sunucu bulunamadı.`);
            return null;
            
        } catch (err) {
            console.error('[Tracked] v3.0 Error:', err);
            throw err;
        } finally {
            this.state.isScanning = false;
        }
    },

    // ============================================
    // v3.6: ADVANCED PLAYER INSIGHT - Simüle edilmiş kullanıcı kalite analizi
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
            badges.push({ type: 'elite', icon: '💎', label: 'Elit Sunucu' });
            trustScore += 40;
        }
        // ⭐ GÜVENLİ KULLANICI: Stabil + Orta doluluk
        else if (ping > 0 && ping < 120 && fps >= 50 && fullness >= 20) {
            badges.push({ type: 'safe', icon: '⭐', label: 'Güvenli Kullanıcı' });
            trustScore += 25;
        }
        
        // 🤓 YENİ KULLANICI: Az doluluk veya yeni sunucu
        if (fullness < 25 || server.playing <= 2) {
            badges.push({ type: 'newbie', icon: '🤓', label: 'Yeni Kullanıcı' });
            trustScore -= 10;
        }
        
        // 🛡️ STABİL: Uzun süre açık kalmış (simüle edilmiş)
        if (simulatedAge > 100 && fps >= 45) {
            badges.push({ type: 'stable', icon: '🛡️', label: 'Stabil' });
            trustScore += 15;
        }
        
        // ⚠️ RİSKLİ: Yüksek ping veya düşük FPS
        if (ping > 180 || (fps > 0 && fps < 35)) {
            badges.push({ type: 'risky', icon: '⚠️', label: 'Riskli' });
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
    },

    abort: function() {
        if (this.state.abortController) {
            this.state.abortController.abort();
            this.state.isScanning = false;
            this.state.progress = 0;
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackedScanner;
}
