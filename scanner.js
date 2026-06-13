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

    // Aktif rate-limit'in kalan süresi (ms). Otomatik yeniden deneme bunu bekler.
    rateLimitRemainingMs: function() {
        if (!this.state.isRateLimited) return 0;
        return Math.max(0, this.state.rateLimitResetTime - Date.now());
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
                // Roblox'un KESİN bekleme süresini oku (varsa) → sabit 15s yerine tam o kadar bekle (genelde daha kısa).
                const ra = parseInt(response.headers.get('Retry-After') || '0', 10);
                const cooldownMs = ra > 0 ? Math.min(ra * 1000, 30000) : 12000;
                console.log(`[Tracked] Rate limit (deneme ${attempt}), Retry-After=${ra || '-'}s → cooldown ${cooldownMs}ms`);

                // v2.4.4: Max attempt kontrolü
                if (attempt >= 3) {
                    this.setRateLimit(cooldownMs);
                    throw new Error('RATE_LIMIT');
                }

                const backoffDelay = this.calculateBackoff(attempt, true);
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

        // BUG FIX: sortOrder=Asc → Roblox EN AZ oyunculu (en yeni/boş) sunucuyu ilk sıraya koyar.
        // Eskiden Desc (en dolu ilk) idi → en dolu sayfalardan tarayıp 5 sayfada durunca gerçekten
        // yeni/boş sunuculara ulaşamıyordu. Asc ile taze sunucular İLK sayfalarda gelir.
        console.log('[Tracked] Starting NEW SERVER scan (sortOrder=Asc)...');

        try {
            while (hasMore && servers.length < maxScan && consecutiveErrors < 3 && pageCount < 8 && !this.state.abortController?.signal?.aborted) {
                try {
                    pageCount++;
                    
                    if (pageCount > 1) {
                        await TrackedUtils.delay(TrackedConfig.API.DELAY_MS);
                    }

                    const url = this.buildUrl(placeId, cursor, 'Asc');
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
                        if (s.playing >= s.maxPlayers) return false; // sadece DOLU olmayan
                        // GARANTİ: ping/fullness SERT filtresi YOK → boş sunucular ping/doluluk yüzünden
                        // elenmesin (eski bug: "ara sıra bulamıyor"). Asc en boşları zaten öne koyuyor;
                        // scoreNewServers en taze (≤2 oyuncu) + en iyi pingi tepeye sıralayıp nokta atışı verir.
                        return true;
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

    // ============================================
    // SNAPSHOT-FARK: GERÇEKTEN TAZE SUNUCU (Roblox sunucu YAŞI vermiyor → tek dürüst yol budur)
    // Listeyi al → ~watchMs izle → tekrar al. Arada YENİ beliren jobId'ler = o pencerede DOĞMUŞ sunucular
    // (bir sunucu listede ancak ilk oyuncusu girince görünür → "yeni belirdi" = "yeni açıldı").
    // Hiç yeni belirmezse [] döner → dürüst "yeni açılan sunucu yok". Tahmin/uydurma YOK.
    // ============================================
    findFreshServers: async function(placeId, onProgress = null, watchMs = 35000) {
        if (!placeId) return [];
        try { this.checkRateLimit(); } catch (err) { throw err; }
        if (this.state.isScanning) { console.warn('[Tracked] Scan already in progress'); return []; }

        this.state.isScanning = true;
        this.state.scanType = 'fresh';
        this.state.abortController = new AbortController();
        const signal = this.state.abortController.signal;

        const SNAP_DELAY = 800; // snapshot sayfaları arası — GET liste hafif, kısa gecikme yeter

        // Asc sayfalardan jobId→server haritası (en boş aralık = taze sunucular ilk sayfalarda belirir).
        const snapshot = async (maxPages) => {
            const map = new Map();
            let cursor = null;
            for (let p = 0; p < maxPages; p++) {
                if (signal.aborted) break;
                let data = null;
                try { data = await this.fetchWithRetry(this.buildUrl(placeId, cursor, 'Asc')); }
                catch (e) { if (e.message && e.message.includes('RATE_LIMIT')) throw e; break; }
                if (!data || !Array.isArray(data.data) || data.data.length === 0) break;
                for (const s of data.data) {
                    if (s && s.id && typeof s.playing === 'number' && typeof s.maxPlayers === 'number') map.set(s.id, s);
                }
                const nc = data.nextPageCursor;
                if (nc && typeof nc === 'string' && nc !== '' && nc !== 'null' && nc !== 'undefined') {
                    cursor = nc;
                    await TrackedUtils.delay(SNAP_DELAY);
                } else break;
            }
            return map;
        };

        try {
            // 1) BAŞLANGIÇ snapshot — geniş (mevcut sunucuları kaydet → sonradan "yeni" sanılanlardan ayrılsın)
            if (onProgress) onProgress({ phase: 'snapshot1' });
            const before = await snapshot(6);
            if (signal.aborted) return [];

            // 2) İZLEME penceresi — beklerken geri sayım
            const start = Date.now();
            while (Date.now() - start < watchMs) {
                if (signal.aborted) return [];
                const remain = Math.max(1, Math.ceil((watchMs - (Date.now() - start)) / 1000));
                if (onProgress) onProgress({ phase: 'watch', remain });
                await TrackedUtils.delay(1000);
            }

            // 3) İKİNCİ snapshot — en boş aralık yeter (taze sunucular düşük oyunculu, ilk sayfalarda)
            if (onProgress) onProgress({ phase: 'snapshot2' });
            const after = await snapshot(4);
            if (signal.aborted) return [];

            // 4) YENİ beliren + katılabilir = TAZE
            const fresh = [];
            for (const [id, s] of after) {
                if (before.has(id)) continue;            // zaten vardı → taze değil
                if (s.playing >= s.maxPlayers) continue;  // dolu → atla
                fresh.push({ ...s, isNew: true, freshlyOpened: true });
            }
            fresh.sort((a, b) => a.playing - b.playing);  // en boş (en taze) önce
            console.log(`[Tracked] Taze tarama: önce=${before.size}, sonra=${after.size}, TAZE=${fresh.length}`);
            return fresh;
        } finally {
            this.state.isScanning = false;
            this.state.abortController = null;
        }
    },

    // v3.4: userBestPing destekli GÖRECELI scoring — server.ping ≈ user'ın best regional pingi en iyi
    scoreNewServers: (servers, userBestPing = null) => {
        if (!Array.isArray(servers)) {
            console.warn('[Tracked] scoreNewServers received non-array');
            return [];
        }
        if (servers.length === 0) return [];

        return servers.map(server => {
            let score = 0;

            // Boşluk oranı — birincil faktör (%50 ağırlık)
            const emptyRatio = 1 - (server.playing / server.maxPlayers);
            score += Math.round(emptyRatio * 500);
            if (server.playing <= 2)      score += 150;
            else if (server.playing <= 5) score += 80;

            // Ping — kullanıcının best regional pingine GÖRECELI değerlendir
            const ping = server.ping || 0;
            if (ping > 0) {
                if (userBestPing && userBestPing > 0) {
                    // v4.0: Fiziksel sınır farkındalıklı scoring
                    const delta = ping - userBestPing;

                    if (delta < -5) {
                        // Filter normalde yakalar, bypass olursa: ÇOK CİDDİ ceza
                        score -= 400;
                    } else if (delta >= -5 && delta < 5) {
                        // Tam user'ın best'i ± 5ms — sınırda, biraz şüpheli (outlier olabilir)
                        score += 280;
                    } else if (delta >= 5 && delta <= 25) {
                        score += 450;  // İdeal: bir tık üstte = bölge eşleşmesi belirgin
                    } else if (delta <= 60) {
                        score += 320;
                    } else if (delta <= 100) {
                        score += 180;
                    } else if (delta <= 150) {
                        score += 30;
                    } else {
                        score -= 120;
                    }
                } else {
                    // Fallback: absolute bins (eski davranış)
                    if (ping < 80)       score += 400;
                    else if (ping < 100) score += 320;
                    else if (ping < 130) score += 220;
                    else if (ping < 160) score += 120;
                    else if (ping < 200) score += 40;
                    else if (ping < 250) score -= 60;
                    else                 score -= 150;
                }
            } else {
                // v3.5: ping=0 (bilinmeyen). userBest biliniyorsa CESARETSİZ değerlendir —
                // known-good ping'li bir sunucu varsa o seçilsin, çünkü tahmin edilebilir.
                // Eskiden +100 idi (nötr) → known-good ile beraber ranked. Şimdi +30 (known < bilinmeyen).
                score += userBestPing ? 30 : 100;
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
            // GÜVENİLİR metrikler: oyuncu sayısı (boşluk/tazelik) + doluluk + FPS (sunucu sağlığı).
            // PING ÇIKARILDI — Roblox'un ortalama-oyuncu-pingi güvenilmez (yarısı yanlış), sıralamayı
            // yanıltıyordu. Artık skor yalnızca doğrulanabilir verilere dayanıyor.
            score -= (server.playing * 80);                       // az oyuncu = daha taze/boş

            const fullness = (server.playing / server.maxPlayers) * 100;
            if (fullness < 30) score += 60;
            else if (fullness < 60) score += 20;
            else if (fullness > 85) score -= 60;

            // FPS = sunucunun anlık sağlığı (yüksek = akıcı, düşük = lag). Roblox'un verdiği gerçek veri.
            const fps = server.fps ? Math.round(server.fps) : 0;
            if (fps >= 58) score += 120;
            else if (fps >= 45) score += 50;
            else if (fps > 0 && fps < 30) score -= 100;          // lag'li sunucu cezası

            return { ...server, score };
        }).sort((a, b) => b.score - a.score);
    },

    // ÇİFT-DOĞRULAMA GEÇİŞİ: en iyi adayları TAZE veriyle yeniden kontrol et. Hâlâ canlı mı, bu arada
    // doldu mu, oyuncu/FPS durumu ne? Bulunmayan (kapanmış) ya da dolmuş adaylar ELENİR; bulunanlar
    // GÜNCEL veriyle döner → kullanıcıya yalnızca gerçekten katılabilir, doğrulanmış sunucular gider.
    verifyServers: async function(placeId, candidates, onProgress = null) {
        if (!Array.isArray(candidates) || candidates.length === 0) return [];
        const wanted = new Map(candidates.map(c => [String(c.id), c]));
        const fresh = new Map(); // jobId → güncel sunucu durumu
        let cursor = null, page = 0;
        // Asc → en boş (= adaylarımız) ilk gelir → 6 sayfa içinde yakalanırlar.
        while (page < 6 && fresh.size < wanted.size) {
            page++;
            if (page > 1) await TrackedUtils.delay(TrackedConfig.API.DELAY_MS);
            let data;
            try { data = await this.fetchWithRetry(this.buildUrl(placeId, cursor, 'Asc')); }
            catch (e) { break; }
            if (!data || !Array.isArray(data.data) || data.data.length === 0) break;
            data.data.forEach(s => { if (s && s.id && wanted.has(String(s.id))) fresh.set(String(s.id), s); });
            if (onProgress) onProgress({ found: fresh.size, target: wanted.size, page });
            const nc = data.nextPageCursor;
            if (nc && typeof nc === 'string' && nc !== '' && nc !== 'null') cursor = nc; else break;
        }
        const verified = [];
        wanted.forEach((cand, id) => {
            const f = fresh.get(id);
            if (!f) return;                              // kapanmış/bulunamadı → doğrulanmadı, ele
            if (typeof f.playing === 'number' && typeof f.maxPlayers === 'number' && f.playing >= f.maxPlayers) return; // bu arada DOLDU → ele
            verified.push({
                ...cand,
                playing: (typeof f.playing === 'number') ? f.playing : cand.playing,
                maxPlayers: (typeof f.maxPlayers === 'number') ? f.maxPlayers : cand.maxPlayers,
                fps: (f.fps != null) ? f.fps : cand.fps,
                verified: true
            });
        });
        return verified;
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
        const scanStartTime = Date.now();
        console.log(`[Tracked] Oto-Pilot v3.8: SCAN BAŞLADI — placeId=${placeId}, maxPing=${opts.maxPing}ms, userBest=${opts.userBestPing}ms`);

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

        const BLOCKER_DELAY = 900;
        const MAX_PAGES     = 14;  // v3.3: 10 → 14 — büyük oyunlarda daha derin tarama
        const MAX_PLAYERS   = opts.maxPlayers ?? 5;
        const MAX_PING      = opts.maxPing    ?? 300;
        const USER_BEST_PING = opts.userBestPing ?? null;  // v3.4: kullanıcının ölçtüğü best regional ping
        const signal        = opts.signal ?? null;

        // v3.6: Bad-server blocklist — manuel "ping kötü" feedback'iyle birikiyor (24h TTL)
        let badJobIds = new Set();
        try {
            const blStore = await chrome.storage.local.get('rota_otopilot_blocklist');
            const bl = blStore?.rota_otopilot_blocklist || [];
            const now = Date.now();
            const TTL = 24 * 60 * 60 * 1000;
            badJobIds = new Set(bl.filter(e => e?.ts && (now - e.ts) < TTL).map(e => e.id));
            if (badJobIds.size > 0) console.log(`[Tracked] v3.6: ${badJobIds.size} bad server jobId blocklist'te (24h)`);
        } catch (_) {}

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
            // v3.6: önceden "kötü" işaretlenmiş jobId'leri reject
            if (badJobIds.has(server.id)) {
                return { valid: false, reason: 'blocklisted', detail: 'bad ping geçmişi' };
            }
            if (server.playing > MAX_PLAYERS) {
                return { valid: false, reason: 'too_many_players', detail: `${server.playing} oyuncu` };
            }
            const ping = server.ping || 0;
            if (ping > MAX_PING && ping > 0) {
                return { valid: false, reason: 'high_ping', detail: `${ping}ms` };
            }
            // v4.0: SIKİ fiziksel sınır kontrolü — flat 5ms tolerans
            // userBest = senin ölçtüğün physical min. 5ms altı = measurement noise sınırı.
            // Daha düşük = server FARKLI BÖLGEDE, oradaki oyunculara göre düşük (sen 200ms+ alırsın).
            // user=47ms → reject <42ms. user=40ms → reject <35ms. Net ve agresif.
            if (USER_BEST_PING && ping > 0 && ping < USER_BEST_PING - 5) {
                return { valid: false, reason: 'far_region', detail: `${ping}ms < ${USER_BEST_PING-5}ms (uzak bölge sinyali)` };
            }
            if (server.playing >= server.maxPlayers) {
                return { valid: false, reason: 'full' };
            }
            return { valid: true };
        };

        let cursorAsc = null, cursorDesc = null;
        let pageCount = 0;
        let rl429Retries = 0; // 429 sonrası kaç kez bekleme yapıldı

        // v4.0: COMPREHENSIVE scan — early exit threshold yüksek tutuldu (30)
        // → daha geniş aday havuzu = filter+scoring sonrası daha güvenilir seçim
        const allCandidates = [];
        const MIN_PAGES_BEFORE_PICK = 4;       // 3 → 4 — minimum derinlik
        const EARLY_EXIT_CANDIDATE_COUNT = 30; // 12 → 30 — geniş örneklem

        // İptal-uyumlu bekleme: signal abort edilirse erken çıkar
        const abortableSleep = (ms) => new Promise((resolve) => {
            const tid = setTimeout(resolve, ms);
            signal?.addEventListener('abort', () => { clearTimeout(tid); resolve(); }, { once: true });
        });

        try {
            while (pageCount < MAX_PAGES && this.state.isScanning) {
                if (signal?.aborted) {
                    console.log('[Tracked] v3.1: Kullanıcı taramayı durdurdu.');
                    return null;
                }

                pageCount++;

                // Asc + Desc sıralı çek — paralel 2x fetch Roblox rate-limiter'ı tetikliyor
                const ascResult = await fetchPage(cursorAsc, 'Asc');
                if (signal?.aborted) return null;
                await abortableSleep(600); // iki istek arası nefes
                const descResult = await fetchPage(cursorDesc, 'Desc');

                // Rate limit (429) → akıllı bekleme + 1 retry
                if (ascResult.rateLimited || descResult.rateLimited) {
                    console.log(`[Tracked] v3.1: 429 rate limit (retry #${rl429Retries + 1})`);
                    if (rl429Retries < 1) {
                        rl429Retries++;
                        const waitMs = 25000; // 25sn — Roblox rate-limit window'u genellikle bu kadardır
                        onProgress?.({ scanned: scannedCount, blocked: blockedCount, page: pageCount, status: 'rate_limit_wait', waitMs });
                        await abortableSleep(waitMs);
                        if (signal?.aborted) return null;
                        pageCount--; // aynı sayfayı tekrar dene
                        continue;
                    }
                    // İkinci 429 → yeterli aday varsa onlarla devam, yoksa dur
                    this.setRateLimit(20000);
                    console.log('[Tracked] v3.1: Rate limit (2. deneme de başarısız), duruyorum.');
                    if (allCandidates.length > 0) break;
                    return null;
                }
                rl429Retries = 0; // başarılı istek → sayacı sıfırla

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

                onProgress?.({ scanned: scannedCount, blocked: blockedCount, page: pageCount, status: 'filtering' });

                if (pageCount >= MIN_PAGES_BEFORE_PICK && allCandidates.length >= EARLY_EXIT_CANDIDATE_COUNT) {
                    break;
                }

                if (!cursorAsc && !cursorDesc) break;

                await abortableSleep(BLOCKER_DELAY);
            }

            // v3.4: userBestPing ile GÖRECELI scoring
            // v3.6: Top 5 adayı storage'a kaydet — "ping kötü" feedback için sıradaki adayı kullanmak üzere
            if (allCandidates.length > 0) {
                const scored = this.scoreNewServers(allCandidates, USER_BEST_PING);
                const best = scored[0];

                // Top 5'i storage'a yaz (retry için)
                try {
                    const topCandidates = scored.slice(0, 5).map(s => ({
                        jobId: s.id,
                        players: s.playing,
                        ping: s.ping,
                        score: s.score
                    }));
                    chrome.storage.local.set({
                        rota_otopilot_last_scan: {
                            placeId,
                            selectedJobId: best.id,
                            candidates: topCandidates,
                            userBestPing: USER_BEST_PING,
                            timestamp: Date.now()
                        }
                    }).catch(() => {});
                } catch (_) {}

                const scanDuration = ((Date.now() - scanStartTime) / 1000).toFixed(1);
                console.log(`[Tracked] v3.8: SCAN BİTTİ (${scanDuration}sn) — ${scannedCount} server tarandı, ${blockedCount} filtrelendi, ${allCandidates.length} aday → ${pageCount} sayfa`);
                console.log(`[Tracked] v3.8: SEÇİLEN → ${best.playing} oyuncu, ${best.ping || '?'}ms ping (user best=${USER_BEST_PING}ms), skor=${best.score}`);
                console.log(`[Tracked] v3.8: Top 3 adaylar:`, scored.slice(0, 3).map(s => ({ players: s.playing, ping: s.ping, score: s.score })));
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
        if (!server || !server.id) return { score: 0, badges: [], simulated: false };

        // DÜRÜST SUNUCU SAĞLIĞI: yalnızca GERÇEK/doğrulanabilir veri → doluluk + FPS.
        // (Eski hâli: ping + sahte "sunucu yaşı" hash'i ile uydurma "oyuncu analizi" yapıyordu.
        //  Roblox public API'si oyuncuların kim olduğunu vermez → gerçek oyuncu analizi mümkün değil.)
        const badges = [];
        let health = 50;
        const fps = server.fps ? Math.round(server.fps) : 0;
        const playing = server.playing || 0;
        const maxP = server.maxPlayers || 1;
        const fullness = (playing / maxP) * 100;

        // ── Popülasyon (gerçek doluluk) ──
        if (playing <= 2 || fullness < 20) {
            badges.push({ type: 'fresh', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(48,209,88,0.22)" stroke="#30D158" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6"></path></svg>', label: 'Taze' });
            health += 20;
        } else if (fullness > 85) {
            badges.push({ type: 'crowded', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,159,10,0.22)" stroke="#FF9F0A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>', label: 'Dolu' });
            health -= 15;
        } else {
            badges.push({ type: 'balanced', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64B4FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M7 12h10"></path><path d="M10 18h4"></path></svg>', label: 'Dengeli' });
            health += 10;
        }

        // ── Sunucu sağlığı (gerçek FPS) ──
        if (fps >= 58) {
            badges.push({ type: 'smooth', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#30D158" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>', label: 'Akıcı' });
            health += 30;
        } else if (fps > 0 && fps < 35) {
            badges.push({ type: 'laggy', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,69,58,0.22)" stroke="#FF453A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>', label: 'Lag\'li' });
            health -= 30;
        }

        return {
            score: Math.max(0, Math.min(100, health)),
            badges: badges,
            fps: fps,
            fullness: Math.round(fullness),
            simulated: false // artık tamamen GERÇEK veri (doluluk + FPS)
        };
    }
};

