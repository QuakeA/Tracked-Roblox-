// main.js - Tracked Extension v3.7 Main Application Module (Smart Activity Tracking)

const TrackedApp = {
    state: {
        currentPlaceId: null,
        injected: false,
        retryCount: 0,
        lastScanTime: 0,
        isProcessing: false,
        globalCooldown: 0
    },

    init: function() {
        console.log('[Tracked] v2.4.5 Initializing...');
        this.setupSPAWatcher();
        this.tryInject();
    },

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
        console.log('[Tracked] v2.4.5 Bar injected');
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
        
        this.state.injected = false;
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
    // v2.4.5: Global Buton Kilitleme ile findEmptyServer
    // ============================================
    findEmptyServer: async function(placeId) {
        // Cooldown kontrolü
        if (!this.checkGlobalCooldown()) return;
        
        // v2.4.5: Zaten işlem devam ediyor mu kontrol et
        if (TrackedScanner.state.isScanning || this.state.isProcessing || TrackedUI.isAnyButtonLocked()) {
            TrackedUI.setStatus('Tarama devam ediyor...');
            return;
        }
        
        // v2.4.5: TÜM butonları kilitle (sadece birini değil)
        TrackedUI.lockAllButtons();
        this.setGlobalCooldown(8000);
        this.state.isProcessing = true;
        TrackedUI.setStatus('Boş sunucular taranıyor...');

        try {
            const servers = await TrackedScanner.scan(placeId, 100, ({ scanned }) => {
                TrackedUI.setStatus(`${scanned} sunucu taranıyor...`);
            });

            TrackedUI.setStatus('');

            // Rate limit kontrol
            if (TrackedScanner.state.isRateLimited) {
                const remaining = Math.ceil((TrackedScanner.state.rateLimitResetTime - Date.now()) / 1000);
                const waitSeconds = remaining > 0 ? remaining : 15;
                TrackedUI.showErrorModal(`Çok fazla istek gönderildi. Güvenlik için ${waitSeconds} saniye beklemeniz gerekiyor.`);
                this.setGlobalCooldown(waitSeconds * 1000);
                return;
            }

            if (!Array.isArray(servers) || servers.length === 0) {
                TrackedUI.showNoServerModal(placeId);
                return;
            }

            const scored = TrackedScanner.score(servers);
            
            if (!Array.isArray(scored) || scored.length === 0) {
                TrackedUI.showNoServerModal(placeId);
                return;
            }

            TrackedUI.showJoinModal(placeId, scored[0]);

        } catch (err) {
            console.log('[Tracked] Boş sunucu arama hatası:', err.message);
            TrackedUI.setStatus('');
            
            // v2.4.5: Rate limit hatası
            if (err.message && err.message.includes('Rate limit')) {
                TrackedUI.showErrorModal('Roblox API sınırına ulaşıldı. ' + err.message);
                this.setGlobalCooldown(15000);
            } else {
                TrackedUI.showErrorModal('Tarama hatası: ' + (err.message || 'Bilinmeyen hata'));
            }
        } finally {
            // v2.4.5: HER DURUMDA tüm butonları aç
            TrackedUI.unlockAllButtons();
            this.state.isProcessing = false;
        }
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
            if (err.message && err.message.includes('Rate limit')) {
                TrackedUI.showErrorModal('Roblox API sınırına ulaşıldı. ' + err.message);
                this.setGlobalCooldown(15000);
            } else {
                TrackedUI.showErrorModal('Tarama hatası: ' + (err.message || 'Bilinmeyen hata'));
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
        TrackedUI.setStatus('Derin tarama başlıyor (max 100 sunucu)...');

        try {
            // v3.0: Derin tarama için daha düşük limit (100 sunucu)
            const DEEP_SCAN_LIMIT = 100;
            const servers = await TrackedScanner.scan(placeId, DEEP_SCAN_LIMIT, ({ scanned, target }) => {
                TrackedUI.setStatus(`${scanned}/${target} sunucu taranıyor...`);
            });

            TrackedUI.setStatus('');

            if (!Array.isArray(servers) || servers.length === 0) {
                TrackedUI.showNoServerModal(placeId);
                return;
            }

            const topServers = TrackedScanner.score(servers).slice(0, TrackedConfig.API.MAX_SCORED_SERVERS);
            
            if (!Array.isArray(topServers) || topServers.length === 0) {
                TrackedUI.showNoServerModal(placeId);
                return;
            }

            TrackedUI.showServerListModal(placeId, topServers);

        } catch (err) {
            console.log('[Tracked] Derin tarama hatası:', err.message);
            TrackedUI.setStatus('');
            
            // v2.4.5: Rate limit hatası
            if (err.message && err.message.includes('Rate limit')) {
                TrackedUI.showErrorModal('Roblox API sınırına ulaşıldı. ' + err.message);
                this.setGlobalCooldown(15000);
            } else {
                TrackedUI.showErrorModal('Tarama hatası: ' + (err.message || 'Bilinmeyen hata'));
            }
        } finally {
            // v2.4.5: HER DURUMDA tüm butonları aç
            TrackedUI.unlockAllButtons();
            this.state.isProcessing = false;
        }
    },

    joinServer: function(placeId, jobId) {
        if (!placeId || !jobId) {
            console.error('[Tracked] Invalid placeId or jobId');
            TrackedUI.unlockAllButtons(); // v2.4.5
            return;
        }
        
        window.location.href = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${jobId}`;
        
        setTimeout(() => {
            if (!document.hidden) {
                window.open(`https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${jobId}`, '_blank');
            }
        }, 2000);

        setTimeout(() => {
            TrackedUI.unlockAllButtons(); // v2.4.5
            this.state.isProcessing = false;
        }, 3000);
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
    // v2.9: SAFE HUNTER - Rate-Limit Dostu Tarama
    // ============================================
    forceNewInstance: async function(placeId) {
        if (!this.checkGlobalCooldown()) return;
        
        if (TrackedScanner.state.isScanning || this.state.isProcessing || TrackedUI.isAnyButtonLocked()) {
            TrackedUI.setStatus('İşlem devam ediyor...');
            return;
        }
        
        // Hunt modunu aktif et (durdur butonu ile)
        TrackedUI.lockAllButtons();
        TrackedUI.setForceMode(true, () => {
            // Durdur butonu callback
            console.log('[Tracked] v2.9: Hunt stopped by user');
            TrackedScanner.stopForceHunt();
            TrackedUI.setStatus('Av durduruldu');
            TrackedUI.setForceMode(false);
            TrackedUI.unlockAllButtons();
            this.state.isProcessing = false;
        });
        this.setGlobalCooldown(8000);
        this.state.isProcessing = true;
        
        // 10 saniyede bir UI recovery (güvenlik için)
        const recoveryTimer = setInterval(() => {
            if (!TrackedScanner.state.isForceProcessing && this.state.isProcessing) {
                console.log('[Tracked] v2.9: Recovery triggered');
                TrackedUI.unlockAllButtons();
                TrackedUI.setForceMode(false);
                this.state.isProcessing = false;
                clearInterval(recoveryTimer);
            }
        }, 10000);

        try {
            // Rapid Hunter başlat - anında katılma callback'i ile
            const server = await TrackedScanner.forceNewInstance(
                placeId,
                // Progress callback
                ({ attempt, maxAttempts, elapsed, message }) => {
                    TrackedUI.setStatus(`${message} 🔴`);
                    TrackedUI.updateForceProgress(attempt, maxAttempts, 'hunting');
                },
                // Server found callback - ANINDA KATIL
                (foundServer) => {
                    console.log('[Tracked] v2.9: Auto-joining found server!');
                    TrackedScanner.stopForceHunt(); // Avı durdur
                    TrackedUI.setStatus('Sunucu bulundu! Katılıyor... 🔴');
                    
                    // 500ms sonra otomatik katıl (UI güncellemesi için bekle)
                    setTimeout(() => {
                        this.joinServer(placeId, foundServer.id);
                    }, 500);
                }
            );

            // Eğer callback çalışmadan buraya gelindiyse
            if (!server) {
                TrackedUI.setStatus('');
                TrackedUI.setForceMode(false);
                
                // Rate limit aktif mi kontrol et
                if (TrackedScanner.state.isRateLimited) {
                    const remaining = Math.ceil((TrackedScanner.state.rateLimitResetTime - Date.now()) / 1000);
                    const waitSeconds = remaining > 0 ? remaining : 15;
                    TrackedUI.showErrorModal(`Çok fazla istek gönderildi. Güvenlik için ${waitSeconds} saniye beklemeniz gerekiyor.`);
                    this.setGlobalCooldown(waitSeconds * 1000);
                } else {
                    TrackedUI.showForceFailedModal(placeId);
                }
            }

        } catch (err) {
            console.log('[Tracked] Zorla modu hatası:', err.message);
            TrackedUI.setStatus('');
            TrackedUI.setForceMode(false);
            
            if (err.message && (err.message.includes('Rate limit') || err.message.includes('15') || err.message.includes('30'))) {
                TrackedUI.showErrorModal('Roblox API sınırına ulaşıldı. ' + err.message);
                this.setGlobalCooldown(15000);
            } else {
                TrackedUI.showErrorModal('Tarama hatası: ' + (err.message || 'İşlem başarısız'));
            }
        } finally {
            clearInterval(recoveryTimer);
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
            TrackedUI.setStatus('İşlem devam ediyor...');
            return;
        }
        
        TrackedUI.lockAllButtons();
        this.setGlobalCooldown(8000);
        this.state.isProcessing = true;
        TrackedUI.setStatus('Oto-Pilot: Başlatılıyor... 🛡️');

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
                    console.log('[Tracked] v3.0: Uygun sunucu bulundu, otomatik bağlanıyor!');
                    TrackedScanner.abort();
                    TrackedUI.setStatus('Sunucu bulundu! Bağlanıyor... 🛡️');
                    
                    setTimeout(() => {
                        this.joinServer(placeId, foundServer.id);
                    }, 300);
                }
            );

            if (!server) {
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

        } catch (err) {
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
        } finally {
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

console.log('[Tracked] v3.6 - Simulated Player Analytics - Loaded');

// v3.5: Advanced Player Insight - Sunucu kalite skoru (Hesap yaşı verisi olmadan meta-veri kullanımı)
