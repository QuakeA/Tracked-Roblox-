// content_script.js - Advanced Server Scanner v2.2
// Robust Injection & Compact Layout Fixed

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION & CONSTANTS
    // ============================================
    const CONFIG = {
        MAX_SERVERS_TO_SCAN: 500,
        SERVERS_PER_PAGE: 100,
        API_DELAY_MS: 200,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY_MS: 1000,
        RATE_LIMIT_DELAY_MS: 3000,
        MIN_PLAYERS: 1,
        MAX_SCORED_SERVERS: 20
    };

    const SELECTORS = {
        PLAY_BUTTON_CONTAINER: '#game-details-play-button-container, .game-details-button-container, [data-testid="play-button-container"]',
        GAME_TITLE: 'h1.game-name, h1[data-testid="game-name"], h1'
    };

    // ============================================
    // STATE MANAGEMENT
    // ============================================
    const state = {
        isScanning: false,
        abortController: null,
        currentPlaceId: null,
        scanProgress: 0,
        gameBarInjected: false
    };

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    // ============================================
    // MESSAGE HANDLER
    // ============================================
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "getTitle") {
            const h1 = document.querySelector(SELECTORS.GAME_TITLE);
            sendResponse({ title: h1 ? h1.textContent.trim() : document.title });
            return true;
        }
        if (request.action === "getScanStatus") {
            sendResponse({ isScanning: state.isScanning, progress: state.scanProgress, total: CONFIG.MAX_SERVERS_TO_SCAN });
            return true;
        }
        if (request.action === "abortScan") {
            if (state.abortController) state.abortController.abort();
            state.isScanning = false;
            sendResponse({ aborted: true });
            return true;
        }
    });

    // ============================================
    // ROBUST INJECTION - v2.2 FIXED
    // ============================================
    function initGameBar() {
        if (!isGamePage()) {
            removeGameBar();
            return;
        }
        if (document.getElementById('tracked-game-bar')) return;

        const container = findInjectionContainer();
        if (!container) {
            setTimeout(initGameBar, 500);
            return;
        }
        injectGameBar(container);
    }

    function isGamePage() {
        return location.pathname.includes('/games/') && /\/games\/(\d+)\//.test(location.pathname);
    }

    function findInjectionContainer() {
        let container = document.querySelector(SELECTORS.PLAY_BUTTON_CONTAINER);
        if (!container) {
            container = document.querySelector(SELECTORS.GAME_TITLE);
            if (container) console.log('[Tracked] Fallback to Game Title used.');
        }
        return container;
    }

    function removeGameBar() {
        const bar = document.getElementById('tracked-game-bar');
        if (bar) {
            bar.remove();
            state.gameBarInjected = false;
        }
    }

    function injectGameBar(container) {
        const placeId = extractPlaceId();
        if (!placeId) return;

        state.currentPlaceId = placeId;
        const bar = createGameBarElement();

        if (container.parentNode) {
            container.parentNode.insertBefore(bar, container.nextSibling);
        } else {
            container.appendChild(bar);
        }

        bindGameBarEvents(bar, placeId);
        state.gameBarInjected = true;
        console.log('[Tracked] Game bar injected for placeId:', placeId);
    }

    function extractPlaceId() {
        const match = location.pathname.match(/\/games\/(\d+)\//);
        return match ? match[1] : null;
    }

    function createGameBarElement() {
        const bar = document.createElement('div');
        bar.id = 'tracked-game-bar';
        bar.className = 'tracked-game-bar';
        bar.innerHTML = `
            <div class="tracked-bar-logo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            </div>
            <button class="tracked-bar-btn" id="btn-find-empty">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                Boş Sunucu Bul
            </button>
            <div class="tracked-divider"></div>
            <button class="tracked-bar-btn" id="btn-copy-id">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                ID Kopyala
            </button>
            <button class="tracked-bar-btn" id="btn-deep-scan" title="Derin Tarama (500 Sunucu)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
                Derin Tarama
            </button>
            <span id="tracked-status-msg" class="tracked-status"></span>
        `;
        return bar;
    }

    function bindGameBarEvents(bar, placeId) {
        bar.querySelector('#btn-find-empty').addEventListener('click', () => findEmptyServer(placeId));
        bar.querySelector('#btn-copy-id').addEventListener('click', () => copyGameId(placeId));
        bar.querySelector('#btn-deep-scan').addEventListener('click', () => performDeepScan(placeId));
    }

    // ============================================
    // CURSOR-BASED SCANNING (500 Servers)
    // ============================================
    async function scanServersWithCursor(placeId, maxServers = CONFIG.MAX_SERVERS_TO_SCAN, onProgress = null) {
        const servers = [];
        let cursor = null;
        let hasMore = true;
        let attempts = 0;
        let requestCount = 0;

        state.isScanning = true;
        state.scanProgress = 0;
        state.abortController = new AbortController();

        try {
            while (hasMore && servers.length < maxServers && attempts < CONFIG.RETRY_ATTEMPTS) {
                try {
                    if (requestCount > 0) await delay(CONFIG.API_DELAY_MS);
                    requestCount++;

                    const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=${CONFIG.SERVERS_PER_PAGE}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
                    const response = await fetchWithTimeout(url, state.abortController.signal);

                    if (response.status === 429) {
                        console.warn('[Tracked] Rate limited, waiting...');
                        await delay(CONFIG.RATE_LIMIT_DELAY_MS);
                        attempts++;
                        continue;
                    }

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const data = await response.json();
                    if (data.data && Array.isArray(data.data)) {
                        const valid = data.data.filter(s => s.playing >= CONFIG.MIN_PLAYERS && s.playing < s.maxPlayers && s.id);
                        servers.push(...valid);
                        state.scanProgress = Math.min(servers.length, maxServers);
                        if (onProgress) onProgress({ scanned: servers.length, target: maxServers });
                    }

                    cursor = data.nextPageCursor;
                    hasMore = cursor !== null && cursor !== undefined;
                    attempts = 0;

                } catch (err) {
                    if (err.name === 'AbortError') throw err;
                    attempts++;
                    if (attempts >= CONFIG.RETRY_ATTEMPTS) throw err;
                    await delay(CONFIG.RETRY_DELAY_MS * attempts);
                }
            }
            return servers;
        } finally {
            state.isScanning = false;
            state.abortController = null;
        }
    }

    async function fetchWithTimeout(url, signal, timeout = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        if (signal) signal.addEventListener('abort', () => controller.abort());

        try {
            const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
            clearTimeout(timeoutId);
            return res;
        } catch (e) {
            clearTimeout(timeoutId);
            throw e;
        }
    }

    // ============================================
    // SERVER SCORING
    // ============================================
    function scoreServers(servers) {
        return servers.map(s => {
            let score = 1000 - (s.playing * 80);
            if (typeof s.ping === 'number') {
                if (s.ping < 80) score += 60;
                else if (s.ping < 120) score += 30;
                else if (s.ping > 200) score -= 40;
                else if (s.ping > 300) score -= 80;
            }
            if (s.fps) {
                if (s.fps >= 58) score += 40;
                else if (s.fps >= 55) score += 20;
                else if (s.fps < 45) score -= 20;
            }
            const fullness = (s.playing / s.maxPlayers) * 100;
            if (fullness < 30) score += 20;
            else if (fullness > 80) score -= 30;
            return { ...s, score };
        }).sort((a, b) => b.score - a.score);
    }

    // ============================================
    // DEEP SCAN (500 Servers)
    // ============================================
    async function performDeepScan(placeId) {
        const btn = document.getElementById('btn-deep-scan');
        if (state.isScanning) return;

        setScanningUI(btn, true);
        showStatus('Sunucular taranıyor...');

        try {
            const servers = await scanServersWithCursor(placeId, CONFIG.MAX_SERVERS_TO_SCAN, ({ scanned, target }) => {
                showStatus(`${scanned}/${target} sunucu taranıyor...`);
            });

            showStatus('');

            if (servers.length === 0) {
                showNoServerModal(placeId);
                return;
            }

            const topServers = scoreServers(servers).slice(0, CONFIG.MAX_SCORED_SERVERS);
            showServerSelectionModal(placeId, topServers);

        } catch (err) {
            console.error('[Tracked] Deep scan error:', err);
            showStatus('');
            showErrorModal('Tarama hatası: ' + err.message);
        } finally {
            setScanningUI(btn, false);
        }
    }

    // ============================================
    // FIND EMPTY SERVER (Quick 100)
    // ============================================
    async function findEmptyServer(placeId) {
        const btn = document.getElementById('btn-find-empty');
        if (state.isScanning) return;

        setScanningUI(btn, true);
        showStatus('Sunucular taranıyor...');

        try {
            const servers = await scanServersWithCursor(placeId, 100, ({ scanned }) => {
                showStatus(`${scanned} sunucu taranıyor...`);
            });

            showStatus('');

            if (servers.length === 0) {
                showNoServerModal(placeId);
                return;
            }

            const best = scoreServers(servers)[0];
            showJoinDecisionModal(placeId, best);

        } catch (err) {
            console.error('[Tracked] Find empty error:', err);
            showStatus('');
            showStatus('Hata: ' + err.message, true);
        } finally {
            setScanningUI(btn, false);
        }
    }

    function setScanningUI(btn, active) {
        btn.disabled = active;
        btn.classList.toggle('scanning', active);
    }

    function showStatus(text, isError = false) {
        const el = document.getElementById('tracked-status-msg');
        if (!el) return;
        el.textContent = text;
        el.style.color = isError ? 'var(--accent-red, #FF453A)' : 'var(--text-secondary, rgba(255,255,255,0.7))';
    }

    // ============================================
    // MODALS
    // ============================================
    function createModalOverlay() {
        const existing = document.querySelector('.tracked-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'tracked-modal-overlay';
        return overlay;
    }

    function showJoinDecisionModal(placeId, server) {
        const overlay = createModalOverlay();
        const pingText = server.ping ? `${server.ping}ms` : 'N/A';
        const pingClass = server.ping && server.ping < 120 ? 'good' : (server.ping > 200 ? 'bad' : 'warn');

        overlay.innerHTML = `
            <div class="tracked-modal">
                <div class="tracked-modal-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </div>
                <h3>Sunucu Bulundu!</h3>
                <p><strong>${server.playing} oyuncu</strong> olan bir sunucu bulundu. Katılmak istiyor musun?</p>
                <div class="tracked-modal-stat">
                    <div class="stat-col"><span class="label">OYUNCU</span><span class="value">${server.playing}/${server.maxPlayers}</span></div>
                    <div class="stat-divider"></div>
                    <div class="stat-col"><span class="label">PING</span><span class="value ${pingClass}">${pingText}</span></div>
                    <div class="stat-divider"></div>
                    <div class="stat-col"><span class="label">FPS</span><span class="value">${server.fps ? Math.round(server.fps) : 'N/A'}</span></div>
                </div>
                <div class="tracked-modal-actions">
                    <button class="tracked-modal-btn secondary" id="tm-cancel">VAZGEÇ</button>
                    <button class="tracked-modal-btn primary" id="tm-join">KATIL</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#tm-cancel').addEventListener('click', () => {
            overlay.remove();
            const btn = document.getElementById('btn-find-empty');
            if (btn) btn.disabled = false;
        });

        overlay.querySelector('#tm-join').addEventListener('click', () => {
            overlay.remove();
            joinServer(placeId, server.id);
        });
    }

    function showNoServerModal(placeId) {
        const overlay = createModalOverlay();
        overlay.innerHTML = `
            <div class="tracked-modal">
                <div class="tracked-modal-icon warning">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <h3>Uygun Sunucu Bulunamadı</h3>
                <p>500 sunucu tarandı ancak uygun bir sunucu bulunamadı.</p>
                <p style="font-size: 12px; opacity: 0.7; margin-top: -10px;">Tekrar denemek ister misin?</p>
                <div class="tracked-modal-actions">
                    <button class="tracked-modal-btn secondary" id="tm-no">HAYIR</button>
                    <button class="tracked-modal-btn primary" id="tm-retry">EVET, TEKRAR DENE</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#tm-no').addEventListener('click', () => {
            overlay.remove();
            document.querySelectorAll('.tracked-bar-btn').forEach(b => b.disabled = false);
        });

        overlay.querySelector('#tm-retry').addEventListener('click', () => {
            overlay.remove();
            findEmptyServer(placeId);
        });
    }

    function showErrorModal(message) {
        const overlay = createModalOverlay();
        overlay.innerHTML = `
            <div class="tracked-modal">
                <div class="tracked-modal-icon error">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                </div>
                <h3>Hata Oluştu</h3>
                <p>${message}</p>
                <div class="tracked-modal-actions">
                    <button class="tracked-modal-btn danger" id="tm-ok">TAMAM</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('#tm-ok').addEventListener('click', () => {
            overlay.remove();
            document.querySelectorAll('.tracked-bar-btn').forEach(b => b.disabled = false);
        });
    }

    function showServerSelectionModal(placeId, servers) {
        const overlay = createModalOverlay();

        const listHtml = servers.map((s, i) => {
            const pingClass = s.ping && s.ping < 100 ? 'good' : (s.ping > 200 ? 'bad' : 'warn');
            return `
                <div class="server-item" data-job="${s.id}">
                    <div class="server-info">
                        <span class="server-rank">#${i + 1}</span>
                        <span>${s.playing}/${s.maxPlayers} oyuncu</span>
                        <span class="ping ${pingClass}">${s.ping ? s.ping + 'ms' : 'N/A'}</span>
                    </div>
                    <button class="join-btn" data-job="${s.id}">KATIL</button>
                </div>
            `;
        }).join('');

        overlay.innerHTML = `
            <div class="tracked-modal" style="width: 420px; max-height: 70vh;">
                <div class="tracked-modal-icon" style="background: rgba(10,132,255,0.15); color: #0A84FF;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <h3>Sunucu Seçimi</h3>
                <p>500 sunucu içinden en iyiler:</p>
                <div class="server-list">${listHtml}</div>
                <button class="tracked-modal-btn secondary" id="tm-close" style="width: 100%; margin-top: 12px;">Kapat</button>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jobId = e.target.dataset.job;
                overlay.remove();
                joinServer(placeId, jobId);
            });
        });

        overlay.querySelector('#tm-close').addEventListener('click', () => {
            overlay.remove();
            document.getElementById('btn-deep-scan').disabled = false;
        });
    }

    // ============================================
    // UTILITIES
    // ============================================
    function joinServer(placeId, jobId) {
        window.location.href = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${jobId}`;
        setTimeout(() => {
            if (!document.hidden) {
                window.open(`https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${jobId}`, '_blank');
            }
        }, 2000);
        setTimeout(() => {
            const btn = document.getElementById('btn-find-empty');
            if (btn) btn.disabled = false;
            showStatus('');
        }, 4000);
    }

    function copyGameId(placeId) {
        navigator.clipboard.writeText(placeId).then(() => {
            showStatus('ID Kopyalandı!');
            setTimeout(() => showStatus(''), 2000);
        }).catch(() => showStatus('Kopyalama hatası', true));
    }

    // ============================================
    // SPA NAVIGATION
    // ============================================
    function initSPAWatcher() {
        let lastUrl = location.href;
        let debounceTimer;

        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            handleUrlChange();
        };

        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            handleUrlChange();
        };

        window.addEventListener('popstate', handleUrlChange);

        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) handleUrlChange();
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });

        function handleUrlChange() {
            if (location.href === lastUrl) return;
            lastUrl = location.href;
            removeGameBar();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(initGameBar, 300);
        }

        if (isGamePage()) initGameBar();
    }

    // ============================================
    // INITIALIZE
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSPAWatcher);
    } else {
        initSPAWatcher();
    }

    console.log('[Tracked] v3.7 Content script - Smart Activity Tracking & Universal Insights');

    // ============================================
    // v3.2: SERVER HOP HUD OVERLAY
    // ============================================
    function initHopOverlay() {
        if (!isGamePage()) return;
        if (document.getElementById('tracked-hop-overlay')) return;

        const placeId = extractPlaceId();
        if (!placeId) return;

        const overlay = document.createElement('div');
        overlay.id = 'tracked-hop-overlay';
        overlay.innerHTML = `
            <div class="tracked-hop-btn" id="tracked-hop-btn" title="Server Hop - Yeni Sunucu Bul">
                <span class="tracked-hop-icon">🐦‍⬛</span>
                <span class="tracked-hop-text">Hop</span>
            </div>
            <div class="tracked-hop-status" id="tracked-hop-status"></div>
        `;

        document.body.appendChild(overlay);

        // Event listener
        const hopBtn = overlay.querySelector('#tracked-hop-btn');
        const statusEl = overlay.querySelector('#tracked-hop-status');

        hopBtn.addEventListener('click', async () => {
            if (state.isScanning) return;

            // UI güncelleme - aranıyor durumu
            hopBtn.style.opacity = '0.5';
            hopBtn.style.pointerEvents = 'none';
            statusEl.textContent = 'Aranıyor...';
            statusEl.style.display = 'block';

            try {
                // Hızlı tarama - ilk uygun sunucuyu bul
                const servers = await quickScanForHop(placeId);
                
                if (servers.length > 0) {
                    const bestServer = servers[0];
                    statusEl.textContent = 'Bulundu! Yönlendiriliyor...';
                    
                    // roblox:// protokolüyle geçiş
                    setTimeout(() => {
                        window.location.href = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${bestServer.id}`;
                        
                        setTimeout(() => {
                            if (!document.hidden) {
                                window.open(`https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${bestServer.id}`, '_blank');
                            }
                        }, 1500);
                    }, 500);
                } else {
                    statusEl.textContent = 'Uygun sunucu bulunamadı';
                    setTimeout(() => {
                        statusEl.style.display = 'none';
                        hopBtn.style.opacity = '1';
                        hopBtn.style.pointerEvents = 'auto';
                    }, 2000);
                }
            } catch (err) {
                console.log('[Tracked Hop] Hata:', err.message);
                statusEl.textContent = 'Hata oluştu';
                setTimeout(() => {
                    statusEl.style.display = 'none';
                    hopBtn.style.opacity = '1';
                    hopBtn.style.pointerEvents = 'auto';
                }, 2000);
            }
        });

        console.log('[Tracked] v3.2 Server Hop Overlay injected');
    }

    // Hızlı tarama fonksiyonu (sadece ilk sayfa)
    async function quickScanForHop(placeId) {
        const servers = [];
        const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`;
        
        try {
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                credentials: 'omit'
            });
            
            if (!response.ok) return [];
            
            const data = await response.json();
            if (!data.data || !Array.isArray(data.data)) return [];
            
            // Filtreleme: 0-2 oyuncu, ping < 200ms
            return data.data
                .filter(s => s.playing >= 0 && s.playing <= 2 && s.playing < s.maxPlayers)
                .filter(s => !s.ping || s.ping < 200)
                .sort((a, b) => a.playing - b.playing)
                .slice(0, 5); // En fazla 5 sonuç
                
        } catch (e) {
            console.log('[Tracked Hop] Tarama hatası:', e);
            return [];
        }
    }

    // Hop overlay'i başlat
    setTimeout(initHopOverlay, 1000);

})();
