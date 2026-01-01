
// popup.js - Vanilla JS, clean architecture

/**
 * CONSTANTS & CONFIG
 */
const STORAGE_KEYS = {
    FAVORITES: 'rota_favorites',
    SETTINGS: 'rota_settings',
    MODE: 'rota_mode', // 'auto' or 'manual'
    SELECTED_REGION: 'rota_selected_region',
    JOIN_STRATEGY: 'rota_join_strategy', // 'normal' or 'fast'
    THEME: 'rota_theme', // 'dark' or 'light'
    PING_CACHE: 'rota_ping_cache', // { timestamp: number, results: [], jitter: number, grade: string }
    PING_HISTORY: 'rota_ping_history' // Array of { timestamp, results }
};

const DEFAULT_SETTINGS = {
    timeoutMs: 3000,
    cacheMinutes: 10,
    openInNewTab: false,
    appendRegionParam: false,
    animationsEnabled: true,
    silentMode: false,
    probes: {
        "Almanya (DE)": "https://www.google.de/favicon.ico",
        "Hollanda (NL)": "https://www.google.nl/favicon.ico",
        "Fransa (FR)": "https://www.google.fr/favicon.ico",
        "Polonya (PL)": "https://www.google.pl/favicon.ico",
        "Romanya (RO)": "https://www.google.ro/favicon.ico"
    }
};

const REGION_FLAGS = {
  "Almanya (DE)": "🇩🇪", "Hollanda (NL)": "🇳🇱", "Fransa (FR)": "🇫🇷",
  "Polonya (PL)": "🇵🇱", "Romanya (RO)": "🇷🇴"
};

// Colors for graph lines matching common region sets
const GRAPH_COLORS = [
    '#0A84FF', // Blue
    '#FF9F0A', // Orange
    '#BF5AF2', // Purple
    '#FF453A', // Red
    '#30D158'  // Green
];

/**
 * STATE MANAGEMENT
 */
const state = {
    mode: 'auto', // 'auto' | 'manual'
    joinStrategy: 'fast', // 'normal' | 'fast'
    selectedRegion: null, // manual selection
    pingResults: [], // Array of { region, ms }
    pingHistory: [], // Array of { timestamp, results: [{region, ms},...] }
    bestRegion: null,
    settings: { ...DEFAULT_SETTINGS },
    favorites: [],
    theme: 'dark',
    pingCache: null,
    viewMode: 'list', // 'list' | 'graph'
    ipInfo: null
};

// DOM Elements
const ui = {
    root: document.getElementById('root'),
    overlayRoot: document.getElementById('overlay-root'),
    btnOptions: document.getElementById('btn-options'),
    btnTheme: document.getElementById('btn-theme'),
    btnRefreshPing: document.getElementById('btn-refresh-ping'),
    btnToggleGraph: document.getElementById('btn-toggle-graph'),
    btnAddFav: document.getElementById('btn-add-fav'),
    pingList: document.getElementById('ping-list'),
    pingGraphContainer: document.getElementById('ping-graph-container'),
    pingChartSvg: document.getElementById('ping-chart-svg'),
    graphLegend: document.getElementById('graph-legend'),
    libraryList: document.getElementById('library-list'),
    globalStatus: document.getElementById('global-status'),
    segments: document.querySelectorAll('.segment-btn'),
    segmentBg: document.querySelector('.segment-bg'),
    btnJoinStrategy: document.getElementById('btn-join-strategy'),
    lblStrategy: document.getElementById('lbl-strategy'),
    btnManualRegion: document.getElementById('btn-manual-region'),
    lblManualRegion: document.getElementById('lbl-manual-region'),
    manualRegionRow: document.getElementById('manual-region-row'),
    inpSearch: document.getElementById('inp-search-library'),
    btnVoiceSearch: document.getElementById('btn-voice-search'),
    blooms: document.querySelector('.blooms'),
    // Dashboard Els
    netDashboard: document.getElementById('net-dashboard'),
    valGrade: document.getElementById('val-grade'),
    valAvgPing: document.getElementById('val-avg-ping'),
    valJitter: document.getElementById('val-jitter'),
    valBestRegion: document.getElementById('val-best-region'),
    // Identity Els
    vpnStatus: document.getElementById('vpn-status'),
    netLocation: document.getElementById('net-location'),
    netIsp: document.getElementById('net-isp'),
    // Scanner Modal
    modalScanner: document.getElementById('server-scanner-modal'),
    btnCloseScanner: document.getElementById('btn-close-scanner'),
    scannerStatus: document.getElementById('scanner-status'),
    scannerList: document.getElementById('scanner-list')
};

/**
 * INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Defensive check for testing environment where DOM might be partial
    if (!ui.root) return; 

    await loadState();
    setupEventListeners();
    renderUI();
    
    // Check network status before measuring
    if (navigator.onLine) {
        checkNetworkIdentity(); // NEW: Check Public IP / VPN status
        measurePings(); 
    } else {
        handleOfflineState();
    }
});

async function loadState() {
    try {
        const data = await chrome.storage.local.get([
            STORAGE_KEYS.SETTINGS, 
            STORAGE_KEYS.MODE, 
            STORAGE_KEYS.SELECTED_REGION, 
            STORAGE_KEYS.FAVORITES, 
            STORAGE_KEYS.JOIN_STRATEGY, 
            STORAGE_KEYS.THEME,
            STORAGE_KEYS.PING_CACHE,
            STORAGE_KEYS.PING_HISTORY
        ]);
        console.log('[Popup] Loaded state:', data);

        state.settings = { ...DEFAULT_SETTINGS, ...data[STORAGE_KEYS.SETTINGS] };
        state.mode = data[STORAGE_KEYS.MODE] || 'auto';
        state.selectedRegion = data[STORAGE_KEYS.SELECTED_REGION] || Object.keys(state.settings.probes)[0];
        state.favorites = data[STORAGE_KEYS.FAVORITES] || [];
        state.joinStrategy = data[STORAGE_KEYS.JOIN_STRATEGY] || 'fast';
        state.theme = data[STORAGE_KEYS.THEME] || 'dark';
        state.pingCache = data[STORAGE_KEYS.PING_CACHE] || null;
        state.pingHistory = data[STORAGE_KEYS.PING_HISTORY] || [];

        applyTheme(state.theme);
        applyAppearanceSettings();
    } catch (err) {
        console.error('[Popup] Failed to load state:', err);
        showToast('Ayarlar yüklenirken hata oluştu.', 'error');
        // Fallback to defaults allows the app to render even if storage fails
        applyTheme('dark');
    }
}

function applyAppearanceSettings() {
    // Handle Blooms Toggle
    if (ui.blooms) {
        if (state.settings.animationsEnabled === false) {
            ui.blooms.style.display = 'none';
        } else {
            ui.blooms.style.display = 'block';
        }
    }
}

/**
 * UTILS
 */
async function safeStorageSet(items) {
    try {
        await chrome.storage.local.set(items);
    } catch (err) {
        console.error('[Popup] Storage save failed:', err);
        showToast('Veriler kaydedilemedi. Depolama hatası.', 'error');
    }
}

function handleOfflineState() {
    if (ui.globalStatus) {
        ui.globalStatus.textContent = "Çevrimdışı";
        ui.globalStatus.style.color = "var(--accent-red)";
    }
    if (ui.pingList) {
        ui.pingList.innerHTML = `<div class="empty-state"><p>İnternet bağlantısı yok.</p></div>`;
    }
    if (ui.netDashboard) ui.netDashboard.style.display = 'none';
}

function formatPlaytime(seconds) {
    if (!seconds) return '0 dk';
    if (seconds < 60) return '< 1 dk';
    
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        // e.g. 1.5 sa
        const displayHours = (minutes / 60).toFixed(1).replace('.0', '');
        return `${displayHours} sa`;
    }
    return `${minutes} dk`;
}

function setupEventListeners() {
    if (ui.btnOptions) ui.btnOptions.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });
    
    // Theme Toggle
    if (ui.btnTheme) {
        ui.btnTheme.addEventListener('click', toggleTheme);
    }
    
    // Segmented Control (Auto/Manual)
    if (ui.segments) {
        ui.segments.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newMode = e.target.dataset.mode;
                setMode(newMode);
            });
        });
    }

    // Strategy Dropdown with Integrated Descriptions
    if (ui.btnJoinStrategy) {
        ui.btnJoinStrategy.addEventListener('click', (e) => {
            openDropdown(ui.btnJoinStrategy, [
                { 
                    label: 'Normal Giriş', 
                    value: 'normal', 
                    desc: 'Standart Roblox bağlantısı ile oyuna katılır.' 
                },
                { 
                    label: 'Hızlı Rota (Önerilen)', 
                    value: 'fast', 
                    desc: 'En düşük ping değerine sahip bölge üzerinden yönlendirme yapar.' 
                }
            ], (val) => {
                console.log('[Popup] Strategy changed to:', val);
                state.joinStrategy = val;
                safeStorageSet({ [STORAGE_KEYS.JOIN_STRATEGY]: val });
                renderControls();
            });
        });
    }

    // Manual Region Dropdown
    if (ui.btnManualRegion) {
        ui.btnManualRegion.addEventListener('click', (e) => {
            const items = Object.keys(state.settings.probes).map(r => ({ label: r, value: r }));
            openDropdown(ui.btnManualRegion, items, (val) => {
                console.log('[Popup] Manual region selected:', val);
                state.selectedRegion = val;
                safeStorageSet({ [STORAGE_KEYS.SELECTED_REGION]: val });
                renderControls();
            });
        });
    }

    // Refresh Button forces a refresh (passes event object which is truthy)
    if (ui.btnRefreshPing) ui.btnRefreshPing.addEventListener('click', () => {
        measurePings(true);
        checkNetworkIdentity(); // Refresh identity too
    });

    // Graph Toggle
    if (ui.btnToggleGraph) ui.btnToggleGraph.addEventListener('click', toggleGraphView);
    
    if (ui.btnAddFav) ui.btnAddFav.addEventListener('click', addToFavorites);

    // Search input
    if (ui.inpSearch) {
        ui.inpSearch.addEventListener('input', () => renderLibrary());
    }

    // Voice Search
    if (ui.btnVoiceSearch) {
        setupVoiceSearch();
    }
    
    // Close Scanner Modal
    if (ui.btnCloseScanner) {
        ui.btnCloseScanner.addEventListener('click', () => {
            ui.modalScanner.style.display = 'none';
        });
    }

    // Network status listeners
    window.addEventListener('online', () => {
        if (ui.globalStatus) {
            ui.globalStatus.textContent = "Bağlandı";
            ui.globalStatus.style.color = "var(--accent-green)";
        }
        measurePings();
        checkNetworkIdentity();
    });
    window.addEventListener('offline', handleOfflineState);

    // Live update for playtime and settings
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes[STORAGE_KEYS.FAVORITES]) {
                state.favorites = changes[STORAGE_KEYS.FAVORITES].newValue || [];
                renderLibrary();
            }
            if (changes[STORAGE_KEYS.SETTINGS]) {
                console.log('[Popup] Settings updated externally');
                state.settings = { ...DEFAULT_SETTINGS, ...changes[STORAGE_KEYS.SETTINGS].newValue };
                applyAppearanceSettings();
            }
        }
    });
}

function setupVoiceSearch() {
    if (!('webkitSpeechRecognition' in window)) {
        ui.btnVoiceSearch.style.display = 'none'; // Hide if not supported
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'tr-TR'; // Turkish context

    let isListening = false;

    ui.btnVoiceSearch.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isListening = true;
        ui.btnVoiceSearch.classList.add('listening');
        showToast('Dinleniyor...', 'info');
    };

    recognition.onend = () => {
        isListening = false;
        ui.btnVoiceSearch.classList.remove('listening');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (ui.inpSearch) {
            ui.inpSearch.value = transcript;
            // Remove ending punctuation that might interfere with search
            ui.inpSearch.value = ui.inpSearch.value.replace(/[.,?!]$/, '');
            renderLibrary();
            showToast(`"${ui.inpSearch.value}" aranıyor.`, 'success');
        }
    };

    recognition.onerror = (event) => {
        isListening = false;
        ui.btnVoiceSearch.classList.remove('listening');
        console.error('[Popup] Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
            showToast('Mikrofon izni verilmedi.', 'error');
        } else {
            showToast('Ses anlaşılamadı.', 'error');
        }
    };
}

/**
 * THEME LOGIC
 */
function toggleTheme() {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    state.theme = newTheme;
    safeStorageSet({ [STORAGE_KEYS.THEME]: newTheme });
    applyTheme(newTheme);
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-mode');
        // Show Moon Icon (to indicate switch to dark available)
        if (ui.btnTheme) ui.btnTheme.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    } else {
        document.body.classList.remove('light-mode');
        // Show Sun Icon (to indicate switch to light available)
        if (ui.btnTheme) ui.btnTheme.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    }
}

/**
 * UI RENDERING
 */
function renderUI() {
    renderControls();
    renderLibrary();
    // Default to list view
    if (state.viewMode === 'graph') {
        renderGraph();
    }
}

function renderControls() {
    // Mode UI
    ui.segments.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });
    
    // Animate Segment BG
    const isManual = state.mode === 'manual';
    if (ui.segmentBg) ui.segmentBg.style.transform = isManual ? 'translateX(100%)' : 'translateX(0)';
    if (document.querySelector('.segmented-control')) document.querySelector('.segmented-control').setAttribute('data-selected', state.mode);

    // Show/Hide Manual Dropdown
    if (ui.manualRegionRow) ui.manualRegionRow.style.display = isManual ? 'block' : 'none';

    // Update Labels
    if (ui.lblStrategy) ui.lblStrategy.textContent = state.joinStrategy === 'normal' ? 'Normal Giriş' : 'Hızlı Rota';
    if (ui.lblManualRegion) ui.lblManualRegion.textContent = state.selectedRegion || 'Seçiniz';
}

function setMode(mode) {
    console.log('[Popup] Mode set to:', mode);
    state.mode = mode;
    safeStorageSet({ [STORAGE_KEYS.MODE]: mode });
    renderControls();
}

function toggleGraphView() {
    state.viewMode = state.viewMode === 'list' ? 'graph' : 'list';
    
    if (state.viewMode === 'graph') {
        ui.pingList.style.display = 'none';
        ui.netDashboard.style.display = 'none'; // Hide stats in graph mode for cleaner view
        ui.pingGraphContainer.style.display = 'flex';
        renderGraph();
    } else {
        ui.pingGraphContainer.style.display = 'none';
        ui.pingList.style.display = 'flex';
        ui.netDashboard.style.display = 'flex';
        // Re-render list incase data updated while in graph mode
        if (state.pingResults.length > 0) renderPingList(state.pingResults);
    }
}

/**
 * NEW: NETWORK IDENTITY & VPN CHECK
 */
async function checkNetworkIdentity() {
    if (ui.netLocation) ui.netLocation.textContent = '...';
    if (ui.netIsp) ui.netIsp.textContent = '...';
    if (ui.vpnStatus) ui.vpnStatus.textContent = 'Analiz Ediliyor...';

    try {
        // Fetch from a free JSON IP API (http required for some, https for others, check manifest)
        const res = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,isp,query,timezone');
        const data = await res.json();

        if (data.status === 'success') {
            state.ipInfo = data;
            
            // Display Info
            ui.netLocation.textContent = `${data.country} (${data.countryCode})`;
            ui.netIsp.textContent = data.isp.length > 20 ? data.isp.substring(0, 18) + '..' : data.isp;

            // VPN Heuristic Detection
            // Logic: Mismatch between Browser Timezone and IP Timezone usually indicates VPN/Proxy
            const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const ipTz = data.timezone;
            
            // Also check if the country matches the "Best Region" found by ping (roughly)
            let pingHint = "";
            if (state.bestRegion) {
                // If I am pinging Germany best, and my IP is Germany, it's consistent.
                const bestCode = state.bestRegion.match(/\(([A-Z]+)\)/)?.[1];
                if (bestCode && data.countryCode === bestCode) {
                    pingHint = " (Optimum)";
                }
            }

            if (browserTz !== ipTz) {
                ui.vpnStatus.textContent = "Muhtemel VPN" + pingHint;
                ui.vpnStatus.style.color = "var(--accent-purple)";
            } else {
                ui.vpnStatus.textContent = "Direkt Bağlantı" + pingHint;
                ui.vpnStatus.style.color = "var(--accent-green)";
            }

        } else {
            ui.vpnStatus.textContent = "Bilinmiyor";
            ui.netLocation.textContent = "Hata";
        }

    } catch (e) {
        console.warn('Network identity check failed:', e);
        if (ui.vpnStatus) ui.vpnStatus.textContent = "Servis Dışı";
    }
}


/**
 * PING LOGIC
 */
async function measurePings(force = false) {
    if (!navigator.onLine) {
        handleOfflineState();
        return;
    }

    // Check Cache first if not forced
    if (!force && state.pingCache) {
        const now = Date.now();
        const cacheAgeMinutes = (now - state.pingCache.timestamp) / 60000;
        
        if (cacheAgeMinutes < state.settings.cacheMinutes) {
            console.log(`[Popup] Using cached ping results (${cacheAgeMinutes.toFixed(1)}m old)`);
            state.pingResults = state.pingCache.results;
            updateBestRegion();
            renderPingList(state.pingResults);
            renderDashboard(state.pingCache.grade, state.pingCache.jitter, state.pingCache.avgPing);
            
            if (state.viewMode === 'graph') renderGraph();
            if (ui.globalStatus) {
                ui.globalStatus.textContent = "Hazır (Önbellek)";
                ui.globalStatus.style.color = "var(--accent-green)";
            }
            return;
        }
    }

    console.log('[Popup] Starting ping measurement...');
    // Show loading skeleton
    if (ui.btnRefreshPing) ui.btnRefreshPing.querySelector('svg').classList.add('spin');
    
    if (state.viewMode === 'list' && ui.pingList) {
        ui.pingList.innerHTML = `
            <div class="ping-item skeleton"></div>
            <div class="ping-item skeleton"></div>
            <div class="ping-item skeleton"></div>
        `;
    }
    if (ui.netDashboard) ui.netDashboard.style.display = 'none'; // Hide while loading

    if (ui.globalStatus) {
        ui.globalStatus.textContent = "Ölçülüyor...";
        ui.globalStatus.style.color = "var(--accent-yellow)";
    }

    const probes = state.settings.probes;
    if (!probes || Object.keys(probes).length === 0) {
        showToast('Ayarlarda tanımlı prob bulunamadı.', 'error');
        if (ui.pingList) ui.pingList.innerHTML = '';
        return;
    }
    
    // Run probes in parallel for speed
    const promises = Object.entries(probes).map(async ([region, url]) => {
        try {
            // Take 5 samples for better jitter calculation
            const ms = await PingUtils.measureMedianLatency(url, state.settings.timeoutMs, 5);
            return { region, ms };
        } catch (e) {
            console.warn(`[Popup] Probe failed for ${region}:`, e);
            return { region, ms: 999 };
        }
    });

    try {
        const results = await Promise.all(promises);
        
        // Sort by latency for Best Region determination
        results.sort((a, b) => a.ms - b.ms);
        state.pingResults = results;
        
        // CALC STATS
        const validResults = results.filter(r => r.ms < 900);
        const pings = validResults.map(r => r.ms);
        
        let avgPing = 0;
        let jitter = 0;
        let grade = 'F';

        if (pings.length > 0) {
            const sum = pings.reduce((a, b) => a + b, 0);
            avgPing = Math.round(sum / pings.length);
            jitter = PingUtils.calculateJitter(pings);
            grade = PingUtils.calculateGrade(avgPing, jitter);
        }

        // Save to Cache
        const cacheData = { timestamp: Date.now(), results, grade, jitter, avgPing };
        state.pingCache = cacheData;
        
        // Add to History (Keep max 20)
        state.pingHistory.push(cacheData);
        if (state.pingHistory.length > 20) state.pingHistory.shift();

        // Save All
        await safeStorageSet({ 
            [STORAGE_KEYS.PING_CACHE]: cacheData,
            [STORAGE_KEYS.PING_HISTORY]: state.pingHistory
        });

        updateBestRegion();
        renderPingList(results);
        renderDashboard(grade, jitter, avgPing);
        
        if (state.viewMode === 'graph') renderGraph();

        if (ui.btnRefreshPing) ui.btnRefreshPing.querySelector('svg').classList.remove('spin');
        if (ui.globalStatus) {
            ui.globalStatus.textContent = "Güncel";
            ui.globalStatus.style.color = "var(--accent-green)";
        }
    } catch (err) {
        console.error('[Popup] Ping measurement failed:', err);
        showToast('Ping ölçümü başarısız.', 'error');
        if (ui.btnRefreshPing) ui.btnRefreshPing.querySelector('svg').classList.remove('spin');
        if (ui.globalStatus) ui.globalStatus.textContent = "Hata";
    }
}

function renderDashboard(grade, jitter, avgPing) {
    if (!ui.netDashboard) return;
    
    // Only show if list view is active
    if (state.viewMode !== 'list') {
        ui.netDashboard.style.display = 'none';
        return;
    }

    ui.netDashboard.style.display = 'flex';
    
    // Animate Grade
    ui.valGrade.className = `grade-value grade-${grade}`;
    ui.valGrade.textContent = grade;
    
    // Update stats
    ui.valAvgPing.textContent = avgPing > 0 ? `${avgPing}ms` : '--';
    ui.valJitter.textContent = jitter >= 0 ? `${jitter}ms` : '--';
    
    const bestReg = state.bestRegion ? state.bestRegion.split(' ')[0] : '--';
    ui.valBestRegion.textContent = bestReg;
}

function updateBestRegion() {
    if (state.pingResults.length > 0) {
        state.bestRegion = state.pingResults[0].region;
        // Refresh VPN hint if needed
        if (state.ipInfo) checkNetworkIdentity();
    }
}

function renderPingList(results) {
    if (!ui.pingList) return;
    ui.pingList.innerHTML = '';
    
    // Check if all failed
    const allFailed = results.every(r => r.ms >= 999);
    if (allFailed) {
        ui.pingList.innerHTML = `<div class="empty-state"><p>Tüm sunuculardan yanıt alınamadı. Güvenlik duvarınızı kontrol edin.</p></div>`;
        return;
    }

    results.forEach(res => {
        const item = document.createElement('div');
        item.className = 'ping-item';
        
        // Use shared logic for color
        const colorClass = PingUtils.getStatus(res.ms);

        // Display > 900 as "Hata/Timeout"
        const msDisplay = res.ms >= 900 ? 'Hata' : `${res.ms}ms`;
        // If it's an error, force red dot
        const finalColorClass = res.ms >= 900 ? 'red' : colorClass;

        item.innerHTML = `
            <div class="ping-left">
                <div class="status-dot ${finalColorClass}"></div>
                <span>${res.region}</span>
            </div>
            <div class="ping-right">${msDisplay}</div>
        `;
        ui.pingList.appendChild(item);
    });
}

function renderGraph() {
    const history = state.pingHistory;
    const svg = ui.pingChartSvg;
    const legend = ui.graphLegend;
    
    svg.innerHTML = '';
    legend.innerHTML = '';

    if (!history || history.length < 2) {
        svg.innerHTML = '<text x="150" y="60" text-anchor="middle" fill="#888" font-size="12">Yeterli veri yok.</text>';
        return;
    }

    // Chart Dimensions
    const width = 300;
    const height = 120;
    const padding = 20;

    // Determine max Y
    let maxMs = 0;
    history.forEach(entry => {
        entry.results.forEach(r => {
            if (r.ms < 900 && r.ms > maxMs) maxMs = r.ms;
        });
    });
    if (maxMs === 0) maxMs = 200; // Default if all errors
    // Add buffer
    maxMs = Math.ceil(maxMs * 1.2);

    // Identify unique regions
    const uniqueRegions = [...new Set(history.flatMap(h => h.results.map(r => r.region)))];

    // Draw Grid Lines (Horizontal)
    for (let i = 0; i <= 4; i++) {
        const y = height - padding - (i * (height - 2 * padding) / 4);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", padding);
        line.setAttribute("y1", y);
        line.setAttribute("x2", width - padding);
        line.setAttribute("y2", y);
        line.setAttribute("stroke", "rgba(255,255,255,0.1)");
        line.setAttribute("stroke-dasharray", "4");
        svg.appendChild(line);
    }

    // Draw Lines for each region
    uniqueRegions.forEach((region, idx) => {
        const color = GRAPH_COLORS[idx % GRAPH_COLORS.length];
        
        // Generate Points
        let points = "";
        
        history.forEach((entry, i) => {
            const dataPoint = entry.results.find(r => r.region === region);
            let ms = dataPoint ? dataPoint.ms : 0;
            if (ms > 900) ms = maxMs; // Cap errors

            // Normalize coordinates
            // X: evenly spaced
            const x = padding + (i * (width - 2 * padding) / (history.length - 1));
            // Y: inverted (0 at bottom)
            const y = height - padding - ((ms / maxMs) * (height - 2 * padding));
            
            points += `${x},${y} `;

            // Draw Dot
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", x);
            circle.setAttribute("cy", y);
            circle.setAttribute("r", "2");
            circle.setAttribute("fill", color);
            svg.appendChild(circle);
        });

        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("points", points.trim());
        polyline.setAttribute("fill", "none");
        polyline.setAttribute("stroke", color);
        polyline.setAttribute("stroke-width", "2");
        polyline.setAttribute("stroke-linecap", "round");
        polyline.setAttribute("stroke-linejoin", "round");
        svg.appendChild(polyline);

        // Add to Legend
        const legItem = document.createElement('div');
        legItem.className = 'legend-item';
        legItem.innerHTML = `
            <div class="legend-color" style="background: ${color}"></div>
            <span>${region.split(' ')[0]}</span>
        `;
        legend.appendChild(legItem);
    });
}

/**
 * LIBRARY LOGIC
 */
async function addToFavorites() {
    try {
        // Get Active Tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url.includes('roblox.com/games/')) {
            showToast('Lütfen bir Roblox oyun sayfasındayken deneyin.', 'error');
            return;
        }

        // Extract ID from URL
        const match = tab.url.match(/games\/(\d+)\//);
        if (!match) {
            showToast('Oyun ID\'si URL\'den okunamadı.', 'error');
            return;
        }
        const placeId = match[1];

        // Check duplicate
        if (state.favorites.some(f => f.placeId === placeId)) {
            showToast('Bu oyun zaten listenizde ekli.', 'info');
            return;
        }

        // Get Title via Content Script
        let title = tab.title;
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: "getTitle" });
            if (response && response.title) title = response.title;
        } catch (e) {
            console.warn("[Popup] Content script unavailable, using tab title fallback:", e.message);
            // Proceed with tab.title logic (no 'return' here to allow fallback)
        }

        const newItem = {
            placeId,
            title: cleanTitle(title),
            addedAt: Date.now(),
            playtimeSeconds: 0 // Initialize playtime
        };

        console.log('[Popup] Adding to favorites:', newItem);
        state.favorites.unshift(newItem); // Add to top
        safeStorageSet({ [STORAGE_KEYS.FAVORITES]: state.favorites });
        renderLibrary();
        showToast('Kütüphaneye eklendi.', 'success');
    } catch (err) {
        console.error('[Popup] Add Favorites failed:', err);
        showToast('Beklenmedik bir hata oluştu.', 'error');
    }
}

function cleanTitle(t) {
    if (!t) return 'İsimsiz Oyun';
    return t.replace(' - Roblox', '').trim();
}

function renderLibrary() {
    if (!ui.libraryList) return;
    ui.libraryList.innerHTML = '';
    
    const searchTerm = ui.inpSearch ? ui.inpSearch.value.trim().toLowerCase() : "";

    // Map to include original index for robust deletion
    const displayList = state.favorites.map((game, index) => ({...game, originalIndex: index}))
        .filter(item => {
            if (!searchTerm) return true;
            // Robust filtering: ensure title exists and handle numeric IDs safely
            const titleMatch = (item.title || "").toLowerCase().includes(searchTerm);
            const idMatch = (String(item.placeId) || "").includes(searchTerm);
            return titleMatch || idMatch;
        });

    if (displayList.length === 0) {
        // -- UPDATED EMPTY STATE LOGIC --
        const isSearching = !!searchTerm;
        const icon = isSearching ? '🔍' : '📂';
        const title = isSearching ? 'Sonuç Bulunamadı' : 'Kütüphaneniz Boş';
        const desc = isSearching 
            ? `"${searchTerm}" ile eşleşen oyun yok.` 
            : 'Roblox oyun sayfasına gidin ve <strong>+ EKLE</strong> butonuna basarak oyunları buraya sabitleyin.';
        
        ui.libraryList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${icon}</div>
                <div class="empty-title">${title}</div>
                <div class="empty-desc">${desc}</div>
            </div>`;
        return;
    }

    displayList.forEach((game) => {
        const el = document.createElement('div');
        el.className = 'lib-item';
        
        const playtimeStr = formatPlaytime(game.playtimeSeconds || 0);

        // Modern Card Layout
        el.innerHTML = `
            <div class="lib-header">
                <div class="lib-icon-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
                <div class="lib-info">
                    <div class="lib-title">${game.title}</div>
                    <div class="lib-sub">
                        <span>ID: ${game.placeId}</span>
                        <span class="playtime-badge">• ${playtimeStr}</span>
                    </div>
                </div>
                <button class="icon-btn-danger delete-btn" data-original-idx="${game.originalIndex}" data-id="${game.placeId}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
            <div class="lib-actions-row">
                <button class="pill-btn scan" data-id="${game.placeId}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    TARA
                </button>
                <button class="pill-btn join" data-id="${game.placeId}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    KATIL
                </button>
            </div>
        `;
        ui.libraryList.appendChild(el);
    });

    // Event Delegation
    const joinBtns = ui.libraryList.querySelectorAll('.join');
    joinBtns.forEach(b => b.addEventListener('click', (e) => joinGame(e.target.closest('.join').dataset.id)));
    
    // Scan Buttons
    const scanBtns = ui.libraryList.querySelectorAll('.scan');
    scanBtns.forEach(b => b.addEventListener('click', (e) => scanServers(e.target.closest('.scan').dataset.id)));

    const delBtns = ui.libraryList.querySelectorAll('.delete-btn');
    delBtns.forEach(b => b.addEventListener('click', (e) => {
        // Find closest button in case SVG clicked
        const btn = e.target.closest('.delete-btn');
        const placeId = btn.dataset.id;
        const itemEl = btn.closest('.lib-item');
        
        deleteGame(placeId, itemEl);
    }));
}

/**
 * NEW: SERVER SCANNER FUNCTIONALITY (Smart Sort & Fix)
 */
async function scanServers(placeId) {
    ui.modalScanner.style.display = 'flex';
    ui.scannerStatus.textContent = 'Sunucular taranıyor...';
    ui.scannerList.innerHTML = '';
    
    try {
        const res = await fetch(`https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Desc&limit=100`);
        const data = await res.json();
        
        if (!data.data || data.data.length === 0) {
            ui.scannerStatus.textContent = 'Aktif sunucu bulunamadı.';
            return;
        }

        let servers = data.data;

        // Filter: Server must have players but not be full
        servers = servers.filter(s => s.playing > 0 && s.playing < s.maxPlayers);

        // Smart Sort: Prioritize FPS (Health) then Ping
        servers.sort((a, b) => {
            const fpsA = a.fps || 0;
            const fpsB = b.fps || 0;
            
            // Tier 1: Good FPS (55+)
            const isGoodA = fpsA >= 55;
            const isGoodB = fpsB >= 55;

            // If both are good FPS, sort by Ping (Ascending)
            if (isGoodA && isGoodB) {
                const pingA = a.ping || 999;
                const pingB = b.ping || 999;
                return pingA - pingB;
            }

            // Otherwise sort by FPS (Descending)
            return fpsB - fpsA;
        });

        // Limit to top 20
        servers = servers.slice(0, 20);

        ui.scannerStatus.textContent = `${servers.length} uygun sunucu bulundu.`;
        
        servers.forEach(server => {
            const row = document.createElement('div');
            row.className = 'server-item';
            
            // Ping Formatting - Handle NULL
            let pingDisplay = '--';
            let pingClass = 'ping-ok';
            if (server.ping !== undefined && server.ping !== null) {
                pingDisplay = `${server.ping}ms`;
                if (server.ping < 100) pingClass = 'ping-good';
                else if (server.ping > 250) pingClass = 'ping-bad';
            }
            
            // FPS Formatting
            const fpsDisplay = server.fps ? `${Math.round(server.fps)} FPS` : '';

            row.innerHTML = `
                <div class="server-details">
                   <div class="player-count">${server.playing} / ${server.maxPlayers} Oyuncu</div>
                   <div class="server-stats-row">
                       <span class="stat-badge ${pingClass}">${pingDisplay}</span>
                       ${fpsDisplay ? `<span class="stat-badge">${fpsDisplay}</span>` : ''}
                   </div>
                </div>
                <!-- Direct Join Button using chrome.tabs.update -->
                <button class="server-action-btn join-server" data-place-id="${placeId}" data-job-id="${server.id}">
                    KATIL
                </button>
            `;
            
            const joinBtn = row.querySelector('.join-server');
            joinBtn.addEventListener('click', () => {
                const pId = joinBtn.dataset.placeId;
                const jId = joinBtn.dataset.jobId;
                
                // Roblox Deep Link Protocol
                const deepLink = `roblox://experiences/start?placeId=${pId}&gameInstanceId=${jId}`;
                
                // --- THE FIX ---
                // Query the active tab and update it. This is considered a browser action
                // and bypasses the user gesture restriction that window.open suffers from
                // when called inside async contexts in popups.
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs.length > 0) {
                        chrome.tabs.update(tabs[0].id, { url: deepLink });
                        
                        // Visual Feedback inside the callback to ensure sync
                        joinBtn.textContent = 'BAŞLATILIYOR...';
                        joinBtn.style.background = 'var(--text-secondary)';
                        setTimeout(() => {
                            joinBtn.textContent = 'KATIL';
                            joinBtn.style.background = '';
                        }, 3000);
                    } else {
                         showToast('Aktif sekme bulunamadı.', 'error');
                    }
                });
            });

            ui.scannerList.appendChild(row);
        });

    } catch (e) {
        console.error(e);
        ui.scannerStatus.textContent = 'Hata: API erişimi kısıtlı olabilir.';
    }
}

async function deleteGame(placeId, domEl) {
    if (domEl) {
        domEl.classList.add('fade-out');
        await new Promise(r => setTimeout(r, 500)); // Wait for animation
        domEl.remove(); // Remove from DOM
    }
    
    const initialCount = state.favorites.length;
    // Filter by string comparison to be safe with IDs
    state.favorites = state.favorites.filter(g => String(g.placeId) !== String(placeId));
    
    if (state.favorites.length === initialCount) return; // ID not found

    await safeStorageSet({ [STORAGE_KEYS.FAVORITES]: state.favorites });
    
    // Check if we need to show empty state (if user deleted the last item in view)
    if (ui.libraryList.children.length === 0) {
        renderLibrary();
    }
}

/**
 * JOIN FLOW
 */
function joinGame(placeId) {
    const isNewTab = state.settings.openInNewTab;
    const isFast = state.joinStrategy === 'fast';
    // Logic: In Auto, use bestRegion. In Manual, use selectedRegion.
    const region = state.mode === 'auto' ? state.bestRegion : state.selectedRegion;
    
    console.log('[Popup] Joining game:', { placeId, isNewTab, isFast, region });

    // Robust URL construction
    const urlObj = new URL(`https://www.roblox.com/games/${placeId}/`);

    // Only apply routing logic if "Fast Rota" is active and we have a valid region
    if (isFast && region) {
        const flag = REGION_FLAGS[region] || '';
        showToast(`Rota: ${region} ${flag} üzerinden bağlanılıyor...`, 'success');
        
        // Append URL parameter if enabled in settings
        if (state.settings.appendRegionParam) {
            // Extract code from parentheses, e.g. "Almanya (DE)" -> "DE"
            const match = region.match(/\(([A-Z0-9]+)\)/i);
            if (match && match[1]) {
                urlObj.searchParams.set('rotaRegion', match[1]);
            }
        }
        
        // Small artificial delay to let user see the toast before tab switch
        setTimeout(() => openUrl(urlObj.toString(), isNewTab), 800);
    } else {
        openUrl(urlObj.toString(), isNewTab);
    }
}

function openUrl(url, newTab) {
    if (newTab) {
        chrome.tabs.create({ url });
    } else {
        chrome.tabs.update({ url });
    }
}

/**
 * PORTAL OVERLAY SYSTEM
 * Prevents z-index clipping by appending to #overlay-root
 */
let activeDropdownTrigger = null;
let globalClickHandler = null;

function openDropdown(triggerEl, items, onSelect) {
    // If clicking the same trigger that is currently active, just close it (toggle behavior)
    if (activeDropdownTrigger === triggerEl) {
        closeOverlay();
        return;
    }

    // Close existing if any
    closeOverlay();

    activeDropdownTrigger = triggerEl;
    triggerEl.classList.add('expanded'); // Visual state

    const rect = triggerEl.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.className = 'portal-dropdown';
    
    // Calculate Position (Bottom Left aligned)
    dropdown.style.top = (rect.bottom + 6) + 'px'; // +6px gap
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';

    items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'dropdown-item';
        
        // Render item with optional description
        if (item.desc) {
             btn.innerHTML = `
                <div class="dropdown-item-label">${item.label}</div>
                <div class="dropdown-item-desc">${item.desc}</div>
            `;
        } else {
            btn.textContent = item.label;
        }

        btn.addEventListener('click', () => {
            onSelect(item.value);
            closeOverlay();
        });
        dropdown.appendChild(btn);
    });

    ui.overlayRoot.appendChild(dropdown);

    // Global click handler to close when clicking outside
    globalClickHandler = (e) => {
        // If click is inside the dropdown, ignore (let item click handle it)
        if (dropdown.contains(e.target)) return;
        
        // If click is on the trigger, ignore (let the trigger click listener handle the toggle logic)
        if (triggerEl.contains(e.target)) return;

        // Otherwise, close
        closeOverlay();
    };

    // Defer adding the listener to avoid capturing the current click event
    setTimeout(() => {
        // Check if we are still active (in case it was closed immediately)
        if (activeDropdownTrigger === triggerEl) {
            document.addEventListener('click', globalClickHandler);
        }
    }, 0);
}

function showToast(msg, type = 'info') {
    if (!ui.overlayRoot) return;
    
    // Respect Silent Mode
    if (state.settings.silentMode) return;

    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${msg}</span>`;
    
    if (type === 'success') t.style.border = '1px solid var(--accent-green)';
    if (type === 'error') t.style.border = '1px solid var(--accent-red)';

    ui.overlayRoot.appendChild(t);

    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translate(-50%, 20px)';
        setTimeout(() => t.remove(), 300);
    }, 2500);
}

function closeOverlay() {
    if (ui.overlayRoot) ui.overlayRoot.innerHTML = '';
    
    // Remove expanded visual state
    if (activeDropdownTrigger) {
        activeDropdownTrigger.classList.remove('expanded');
    }

    if (globalClickHandler) {
        document.removeEventListener('click', globalClickHandler);
        globalClickHandler = null;
    }
    activeDropdownTrigger = null;
}

// Expose for testing
window.TrackedApp = {
    state,
    joinGame,
    openUrl,
    measurePings,
    ui
};
