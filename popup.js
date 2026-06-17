
// popup.js - Vanilla JS, clean architecture

/**
 * CONSTANTS & CONFIG
 */
const STORAGE_KEYS = {
    FAVORITES: 'rota_favorites',
    SETTINGS: 'rota_settings',
    MODE: 'rota_mode', // 'auto' or 'manual'
    SELECTED_REGION: 'rota_selected_region',
    TARGET_REGION: 'rota_target_region', // null = otomatik (en yakın) | {code, label, lat, lon} → Oto-Pilot O bölgede sunucu arar
    JOIN_STRATEGY: 'rota_join_strategy', // 'normal' or 'fast'
    THEME: 'rota_theme', // 'dark' or 'light'
    PING_CACHE: 'rota_ping_cache', // { timestamp: number, results: [], jitter: number, grade: string }
    PING_HISTORY: 'rota_ping_history', // Array of { timestamp, results }
    LIBRARY_VIEW: 'rota_library_view' // 'comfort' (varsayılan, eski geniş kart) | 'compact' (yeni tek-satır)
};

// HEDEF BÖLGE — ÜLKE bazlı; şehirler Roblox'un GERÇEK datacenter konumları (datacenters.js CITY ile senkron,
// 10 ülke / 18 şehir). Oto-Pilot ülke seçilince O ÜLKEDEKİ şehirlerden sunucuya EN YAKIN olana göre sıralar.
const TARGET_REGIONS = [
    { code: 'DE', continent: 'EU', cities: [{ city: 'Frankfurt', lat: 50.1109, lon: 8.6821 }] },
    { code: 'NL', continent: 'EU', cities: [{ city: 'Amsterdam', lat: 52.3676, lon: 4.9041 }] },
    { code: 'FR', continent: 'EU', cities: [{ city: 'Paris', lat: 48.8566, lon: 2.3522 }] },
    { code: 'GB', continent: 'EU', cities: [{ city: 'London', lat: 51.5074, lon: -0.1278 }] },
    { code: 'US', continent: 'NA', cities: [
        { city: 'Ashburn',     lat: 39.0438, lon: -77.4874 },
        { city: 'New York',    lat: 40.7128, lon: -74.0060 },
        { city: 'Atlanta',     lat: 33.7490, lon: -84.3880 },
        { city: 'Miami',       lat: 25.7617, lon: -80.1918 },
        { city: 'Chicago',     lat: 41.8781, lon: -87.6298 },
        { city: 'Dallas',      lat: 32.7767, lon: -96.7970 },
        { city: 'Seattle',     lat: 47.6062, lon: -122.3321 },
        { city: 'San Jose',    lat: 37.3382, lon: -121.8863 },
        { city: 'Los Angeles', lat: 34.0522, lon: -118.2437 }
    ] },
    { code: 'BR', continent: 'SA', cities: [{ city: 'São Paulo', lat: -23.5505, lon: -46.6333 }] },
    { code: 'JP', continent: 'AS', cities: [{ city: 'Tokyo', lat: 35.6762, lon: 139.6503 }] },
    { code: 'SG', continent: 'AS', cities: [{ city: 'Singapore', lat: 1.3521, lon: 103.8198 }] },
    { code: 'IN', continent: 'AS', cities: [{ city: 'Mumbai', lat: 19.0760, lon: 72.8777 }] },
    { code: 'AU', continent: 'OC', cities: [{ city: 'Sydney', lat: -33.8688, lon: 151.2093 }] }
];
const CONTINENT_KEYS = { EU: 'continentEU', NA: 'continentNA', SA: 'continentSA', AS: 'continentAS', OC: 'continentOC' };
function targetRegionLabel(t) {
    if (!t) return TrackedI18n.t('bestLocationAuto');
    const country = TrackedI18n.t('country' + t.code);
    return (country && country !== 'country' + t.code) ? country : t.code;
}

const DEFAULT_SETTINGS = {
    timeoutMs: 3000,
    cacheMinutes: 10,
    reducedMotion: false,
    silentMode: false,
    nowPlaying: false,
    gameCodes: true,
    // Varsayılan = AVRUPA şablonu (PROBE_PRESETS.eu ile birebir). Diğer bölgeler için kullanıcı
    // ayarlardan "Bölge Şablonu" seçer (NA/Asya/SA/AU/Global) → problar O setle DEĞİŞİR (üstüne eklenmez).
    // NOT: Sunucu listesi ms'i bu sete BAĞLI DEĞİL — SW'nin kendi 20 küresel probe'unu (TK_PING_PROBES) kullanır.
    // Etiketler AWS bölgesinin GERÇEK konumudur (dürüst veri): eu-west-1=İrlanda, eu-north-1=İsveç, eu-south-1=İtalya.
    // (Eski etiketler NL/PL/RO yazıyordu ama oralarda AWS bölgesi yok — yanlıştı.)
    probes: {
        "Almanya (DE)": "https://s3.eu-central-1.amazonaws.com",
        "İrlanda (IE)": "https://s3.eu-west-1.amazonaws.com",
        "Fransa (FR)": "https://s3.eu-west-3.amazonaws.com",
        "İsveç (SE)": "https://s3.eu-north-1.amazonaws.com",
        "İtalya (IT)": "https://s3.eu-south-1.amazonaws.com"
    }
};

const REGION_FLAGS = {};

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
    targetRegion: null,   // HEDEF BÖLGE: null = otomatik (en yakın) | {code,city,lat,lon} → Oto-Pilot bu bölgede arar
    pingResults: [], // Array of { region, ms }
    pingHistory: [], // Array of { timestamp, results: [{region, ms},...] }
    bestRegion: null,
    settings: { ...DEFAULT_SETTINGS },
    favorites: [],
    theme: 'dark',
    pingCache: null,
    libraryView: 'comfort', // 'comfort' (eski geniş kart, VARSAYILAN) | 'compact' (yeni tek-satır)
    viewMode: 'list', // 'list' | 'graph'
    ipInfo: null,
    gameData: {} // v3.7: Live game activity data
};

// Buton spam koruması — son tıklama ve son uyarı zamanları
const _btnLastClick = {};
const _btnLastWarn = {};
function guardClick(key, cooldownMs, fn) {
    const now = Date.now();
    if (_btnLastClick[key] && now - _btnLastClick[key] < cooldownMs) {
        // Uyarıyı sadece cooldown başına bir kez göster
        if (!_btnLastWarn[key] || now - _btnLastWarn[key] >= cooldownMs) {
            const remaining = Math.ceil((cooldownMs - (now - _btnLastClick[key])) / 1000);
            showToast(TrackedI18n.t('cooldownWait').replace('{n}', remaining), 'warning');
            _btnLastWarn[key] = now;
        }
        return;
    }
    _btnLastClick[key] = now;
    delete _btnLastWarn[key];
    fn();
}

// DOM Elements
const ui = {
    root: document.getElementById('root'),
    overlayRoot: document.getElementById('overlay-root'),
    btnOptions: document.getElementById('btn-options'),
    btnTheme: document.getElementById('btn-theme'),
    btnPin: document.getElementById('btn-pin'),
    btnRefreshPing: document.getElementById('btn-refresh-ping'),
    btnToggleGraph: document.getElementById('btn-toggle-graph'),
    btnAddFav: document.getElementById('btn-add-fav'),
    btnLibView: document.getElementById('btn-lib-view'),
    libViewMenu: document.getElementById('lib-view-menu'),
    libViewSwitch: document.getElementById('lib-view-switch'),
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

    // Reduced motion: kullanıcı options'tan açtıysa body class'ı ekle (tüm animasyonlar durur)
    if (state.settings?.reducedMotion === true) {
        document.body.classList.add('reduced-motion');
    }

    // v3.7: Apply language from settings
    if (state.settings.language) {
        TrackedI18n.setLocale(state.settings.language);
    }
    applyTranslations();
    
    setupEventListeners();
    renderUI();
    
    // v3.7: Trigger initial game library tracking
    triggerGameLibraryUpdate();
    
    // v1.6: Check for live event auto-scan trigger
    checkLiveEventAlert();
    
    // Check network status before measuring
    if (navigator.onLine) {
        checkNetworkIdentity(); // NEW: Check Public IP / VPN status
        measurePings();
    } else {
        handleOfflineState();
    }

    // Storage listener tek yerde (setupEventListeners içinde, line ~560) — duplicate kaldırıldı

    // v1.6.6: Load recent games
    loadRecentGames();
    renderServerWatch(); // Sunucu Bekçisi — aktif canlı izleme paneli
    // Bekçi durumu değişince (başlat/durdur/sunucu bulundu) kartı canlı güncelle
    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && 'tracked_server_watch' in changes) renderServerWatch();
        });
    } catch (_) {}
    loadFriends();

    // v1.9.0: Friends panelini periyodik yenile — panel/sidepanel uzun açık kalınca
    // eski/boş veri kalmasın (bug: 1 saat sonra arkadaşlar boş). 45sn'de bir, yalnızca
    // sayfa GÖRÜNÜRken (gizliyken boşa istek atma). Cache TTL 60sn → spinner flicker yok.
    setInterval(() => { if (document.visibilityState === 'visible') loadFriends(); }, 45000);

    // Refresh friends button — spin while loading, re-enable on completion
    const btnRefreshFriends = document.getElementById('btn-refresh-friends');
    if (btnRefreshFriends) {
        btnRefreshFriends.addEventListener('click', () => {
            guardClick('friends', 3000, async () => {
                if (btnRefreshFriends.disabled) return;
                btnRefreshFriends.disabled = true;
                btnRefreshFriends.querySelector('svg')?.classList.add('spin');
                try {
                    await loadFriends();
                } finally {
                    btnRefreshFriends.disabled = false;
                    btnRefreshFriends.querySelector('svg')?.classList.remove('spin');
                }
            });
        });
    }

    const btnClearRecent = document.getElementById('btn-clear-recent');
    if (btnClearRecent) {
        btnClearRecent.addEventListener('click', () => {
            guardClick('clearRecent', 1500, clearRecentGames);
        });
    }

    const btnClearSaved = document.getElementById('btn-clear-saved-servers');
    if (btnClearSaved) {
        btnClearSaved.addEventListener('click', () => {
            chrome.storage.local.remove('rota_saved_servers', () => renderSavedServers());
        });
    }
});

// v3.7: Apply translations to all elements with data-i18n attribute
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) el.textContent = TrackedI18n.t(key);
    });

    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (key) el.innerHTML = TrackedI18n.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.placeholder = TrackedI18n.t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) el.title = TrackedI18n.t(key);
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        if (key) el.setAttribute('aria-label', TrackedI18n.t(key));
    });
}

/**
 * v3.7: Trigger background game library update — throttled to once per 60sn.
 * Eskiden her popup/sidepanel açılışında refresh tetikliyordu (sidepanel.html da popup.js yükler) —
 * tek bir test seansında 12x trigger görüldü. SW'nin 5dk alarm'ı zaten yeterli, biz sadece
 * "kullanıcı popup açtı, taze veri istiyor" durumu için throttle'lı manuel trigger sağlıyoruz.
 */
async function triggerGameLibraryUpdate() {
    try {
        const data = await chrome.storage.local.get('rota_last_lib_refresh');
        const last = data?.rota_last_lib_refresh || 0;
        const now = Date.now();
        if (now - last < 60 * 1000) {
            // 60sn içinde yenilendi → skip (SW alarm'ı arka planda çalışıyor)
            return;
        }
        await chrome.storage.local.set({ rota_last_lib_refresh: now });
        chrome.runtime.sendMessage({ action: 'refreshGameLibrary' });
    } catch (e) {
        console.log('[Popup] Could not trigger library update:', e);
    }
}

async function loadState() {
    try {
        const data = await chrome.storage.local.get([
            STORAGE_KEYS.SETTINGS,
            STORAGE_KEYS.MODE,
            STORAGE_KEYS.SELECTED_REGION,
            STORAGE_KEYS.TARGET_REGION,
            STORAGE_KEYS.FAVORITES,
            STORAGE_KEYS.JOIN_STRATEGY, 
            STORAGE_KEYS.THEME,
            STORAGE_KEYS.PING_CACHE,
            STORAGE_KEYS.PING_HISTORY,
            STORAGE_KEYS.LIBRARY_VIEW,
            'rota_game_data' // v3.7: Game activity data
        ]);
        console.log('[Popup] Loaded state:', data);

        state.settings = { ...DEFAULT_SETTINGS, ...data[STORAGE_KEYS.SETTINGS] };

        // Migrate: Google CDN probe'larını gerçek AWS bölge endpoint'lerine güncelle
        if (state.settings.probes) {
            const googleToAws = {
                'www.google.de': 's3.eu-central-1.amazonaws.com',
                'www.google.nl': 's3.eu-west-1.amazonaws.com',
                'www.google.fr': 's3.eu-west-3.amazonaws.com',
                'www.google.pl': 's3.eu-north-1.amazonaws.com',
                'www.google.ro': 's3.eu-south-1.amazonaws.com',
            };
            let probesMigrated = false;
            Object.keys(state.settings.probes).forEach(key => {
                const url = state.settings.probes[key];
                for (const [googleHost, awsHost] of Object.entries(googleToAws)) {
                    if (url.includes(googleHost)) {
                        state.settings.probes[key] = `https://${awsHost}`;
                        probesMigrated = true;
                        break;
                    }
                }
            });
            if (probesMigrated) safeStorageSet({ [STORAGE_KEYS.SETTINGS]: state.settings });
        }

        state.mode = data[STORAGE_KEYS.MODE] || 'auto';
        state.selectedRegion = data[STORAGE_KEYS.SELECTED_REGION] || Object.keys(state.settings.probes)[0];
        state.targetRegion = data[STORAGE_KEYS.TARGET_REGION] || null;
        state.favorites = data[STORAGE_KEYS.FAVORITES] || [];
        state.joinStrategy = data[STORAGE_KEYS.JOIN_STRATEGY] || 'fast';
        state.theme = data[STORAGE_KEYS.THEME] || 'dark';
        state.pingCache = data[STORAGE_KEYS.PING_CACHE] || null;
        state.pingHistory = data[STORAGE_KEYS.PING_HISTORY] || [];
        state.libraryView = (data[STORAGE_KEYS.LIBRARY_VIEW] === 'compact') ? 'compact' : 'comfort'; // varsayılan: eski geniş kart
        state.gameData = data.rota_game_data || {}; // v3.7: Live game data

        // v3.7: Set language from settings
        if (state.settings.language) {
            TrackedI18n.setLocale(state.settings.language);
        }

        applyTheme(state.theme);
        applyAppearanceSettings();
    } catch (err) {
        console.error('[Popup] Failed to load state:', err);
        showToast(TrackedI18n.t('settingsLoadError'), 'error');
        // Fallback to defaults allows the app to render even if storage fails
        applyTheme('dark');
    }
}

function applyAppearanceSettings() {
    // Reduced motion artık animasyonları kontrol ediyor (legacy animationsEnabled kaldırıldı)
    // Reduced motion açıksa blooms'u gizle
    if (ui.blooms) {
        if (state.settings.reducedMotion === true) {
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
        showToast(TrackedI18n.t('settingsLoadError'), 'error');
    }
}

function handleOfflineState() {
    if (ui.globalStatus) {
        ui.globalStatus.textContent = TrackedI18n.t('statusOffline');
        ui.globalStatus.style.color = "var(--accent-red)";
    }
    if (ui.pingList) {
        ui.pingList.innerHTML = `<div class="empty-state"><p>${TrackedI18n.t('statusOffline')}.</p></div>`;
    }
    if (ui.netDashboard) ui.netDashboard.style.display = 'none';
}

function formatPlaytime(seconds) {
    if (!seconds) return `0 ${TrackedI18n.t('minutes')}`;
    if (seconds < 60) return TrackedI18n.t('lessThanMinute');
    
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        // e.g. 1.5 h
        const displayHours = (minutes / 60).toFixed(1).replace('.0', '');
        return `${displayHours} ${TrackedI18n.t('hours')}`;
    }
    return `${minutes} ${TrackedI18n.t('minutes')}`;
}

function setupEventListeners() {
    if (ui.btnOptions) ui.btnOptions.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });
    
    // Side panel pin button — TOGGLE davranışı: açıksa kapat, kapalıysa aç.
    // chrome.runtime.getContexts ile REAL-TIME state check (storage flag'in async gecikmesi yok).
    if (ui.btnPin) {
        ui.btnPin.addEventListener('click', () => {
            if (!chrome.sidePanel || !chrome.sidePanel.open) {
                showToast(TrackedI18n.t('sidePanelUnsupported') || 'Side panel not supported', 'error');
                return;
            }

            chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
                const tab = tabs && tabs[0];
                if (!tab || !tab.id) {
                    showToast(TrackedI18n.t('sidePanelOpenFailed') || 'Yan panel açılamadı', 'error');
                    return;
                }

                // REAL-TIME check: Side panel'e DOĞRUDAN ping at.
                // Side panel açıksa onMessage listener'ı cevap verir (alive: true).
                // Kapalıysa Chrome "Receiving end does not exist" döner → kapalı.
                // SW state cache yok, port lag yok, broadcast pattern → en sağlam tespit.
                let isOpen = false;
                try {
                    isOpen = await new Promise((resolve) => {
                        let resolved = false;
                        const finish = (v) => { if (!resolved) { resolved = true; resolve(v); } };

                        try {
                            chrome.runtime.sendMessage({ action: 'sidePanelPing' }, (resp) => {
                                // chrome.runtime.lastError → no listener (side panel kapalı)
                                if (chrome.runtime.lastError) { finish(false); return; }
                                finish(resp?.alive === true);
                            });
                        } catch (_) { finish(false); }

                        // Safety timeout — 150ms cevap gelmezse kapalı say
                        setTimeout(() => finish(false), 150);
                    });
                } catch (_) {}

                if (isOpen) {
                    // KAPAT: enabled: false → 100ms sonra tekrar enabled: true (re-arm pattern)
                    try {
                        await chrome.sidePanel.setOptions({
                            tabId: tab.id,
                            enabled: false
                        });
                        await chrome.storage.local.set({ tracked_sidepanel_open: false });
                        // Bir sonraki açılış için yeniden enable et
                        setTimeout(() => {
                            chrome.sidePanel.setOptions({
                                tabId: tab.id,
                                path: 'sidepanel.html',
                                enabled: true
                            }).catch(() => {});
                        }, 150);
                        showToast(TrackedI18n.t('sidePanelClosed') || 'Yan panel kapatıldı', 'success');
                        setTimeout(() => window.close(), 200);
                    } catch (err) {
                        console.warn('[Tracked] sidePanel close failed:', err?.message || err);
                        showToast('Yan panel kapatılamadı', 'error');
                    }
                } else {
                    // AÇ
                    Promise.resolve(
                        chrome.sidePanel.setOptions({
                            tabId: tab.id,
                            path: 'sidepanel.html',
                            enabled: true
                        })
                    ).catch(() => {})
                    .then(() => chrome.sidePanel.open({ tabId: tab.id }))
                    .then(() => {
                        chrome.storage.local.set({ tracked_sidepanel_open: true }).catch(() => {});
                        showToast(TrackedI18n.t('sidePanelPinned') || 'Yan panel açıldı', 'success');
                        setTimeout(() => window.close(), 150);
                    })
                    .catch(err => {
                        console.warn('[Tracked] sidePanel.open failed:', err?.message || err);
                        showToast(
                            (TrackedI18n.t('sidePanelOpenFailed') || 'Yan panel açılamadı') +
                            ' (Chrome > Ayarlar > Yan panel)',
                            'error'
                        );
                    });
                }
            });
        });
    }
    
    if (ui.btnTheme) {
        ui.btnTheme.addEventListener('click', toggleTheme);
    }
    
    // Segmented Control (Auto/Manual)
    if (ui.segments) {
        ui.segments.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newMode = e.target.dataset.mode;
                if (newMode) { setMode(newMode); return; }
                // "En İyi Konum" pill'i: hedef bölgeyi OTOMATİK'e (en yakın) sıfırlar.
                state.targetRegion = null;
                safeStorageSet({ [STORAGE_KEYS.TARGET_REGION]: null });
                renderControls();
            });
        });
    }

    // Strategy Dropdown with Integrated Descriptions
    if (ui.btnJoinStrategy) {
        ui.btnJoinStrategy.addEventListener('click', (e) => {
            openDropdown(ui.btnJoinStrategy, [
                { 
                    label: TrackedI18n.t('normalJoin'), 
                    value: 'normal', 
                    desc: TrackedI18n.t('normalJoinDesc')
                },
                { 
                    label: TrackedI18n.t('fastRoute'), 
                    value: 'fast', 
                    desc: TrackedI18n.t('fastRouteDesc')
                }
            ], (val) => {
                console.log('[Popup] Strategy changed to:', val);
                state.joinStrategy = val;
                safeStorageSet({ [STORAGE_KEYS.JOIN_STRATEGY]: val });
                renderControls();
            });
        });
    }

    // HEDEF BÖLGE dropdown — Oto-Pilot'un sunucu ARAYACAĞI bölge (Roblox'un GERÇEK datacenter konumları).
    // 'auto' = sana en yakın (varsayılan). Bölge seçilirse Oto-Pilot O bölgedeki sunucuyu bulur.
    if (ui.btnManualRegion) {
        ui.btnManualRegion.addEventListener('click', () => {
            // Kıta başlıklarıyla gruplu liste (EU → NA → SA → AS → OC)
            const items = [
                { label: TrackedI18n.t('bestLocationAuto'), value: 'auto', desc: TrackedI18n.t('bestLocationAutoDesc') }
            ];
            ['EU', 'NA', 'SA', 'AS', 'OC'].forEach(ct => {
                const group = TARGET_REGIONS.map((t, i) => ({ t, i })).filter(x => x.t.continent === ct);
                if (!group.length) return;
                items.push({ header: TrackedI18n.t(CONTINENT_KEYS[ct]) });
                group.forEach(x => items.push({ label: targetRegionLabel(x.t), value: String(x.i) }));
            });
            openDropdown(ui.btnManualRegion, items, (val) => {
                const sel = (val === 'auto') ? null : (TARGET_REGIONS[Number(val)] || null);
                // label snapshot'ı da kaydet → content script (Oto-Pilot) mesajlarında kullanır
                state.targetRegion = sel ? { code: sel.code, label: targetRegionLabel(sel), cities: sel.cities } : null;
                safeStorageSet({ [STORAGE_KEYS.TARGET_REGION]: state.targetRegion });
                console.log('[Popup] Hedef bölge:', state.targetRegion ? state.targetRegion.label : 'otomatik');
                renderControls();
            });
        });
    }

    // Refresh Button — 3s cooldown (ölçüm yapılırken tekrar spam önleme)
    if (ui.btnRefreshPing) ui.btnRefreshPing.addEventListener('click', () => {
        guardClick('ping', 3000, () => {
            measurePings(true);
            checkNetworkIdentity();
        });
    });
    
    // Graph Toggle
    if (ui.btnToggleGraph) ui.btnToggleGraph.addEventListener('click', toggleGraphView);
    
    if (ui.btnAddFav) ui.btnAddFav.addEventListener('click', addToFavorites);

    // Oyun kütüphanesi görünüm anahtarı (Win11 Gezgini "Görünüm" menüsü gibi)
    setupLibraryViewSwitch();

    // Search input
    if (ui.inpSearch) {
        ui.inpSearch.addEventListener('input', () => renderLibrary());
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
            if (changes[STORAGE_KEYS.LIBRARY_VIEW]) {
                state.libraryView = (changes[STORAGE_KEYS.LIBRARY_VIEW].newValue === 'compact') ? 'compact' : 'comfort';
                renderLibrary();
            }
            if (changes[STORAGE_KEYS.SETTINGS]) {
                console.log('[Popup] Settings updated externally');
                const newSettings = { ...DEFAULT_SETTINGS, ...changes[STORAGE_KEYS.SETTINGS].newValue };
                const langChanged = newSettings.language !== state.settings?.language;
                state.settings = newSettings;
                // reducedMotion → body class toggle (önceki duplicate listener'dan birleştirildi)
                document.body.classList.toggle('reduced-motion', newSettings.reducedMotion === true);
                applyAppearanceSettings();
                // Dil değiştiyse translations'ı yeniden uygula (kullanıcı options'tan dil değiştirdiyse popup/sidepanel anında güncellensin)
                if (langChanged && newSettings.language) {
                    try {
                        TrackedI18n.setLocale(newSettings.language);
                        applyTranslations();
                    } catch (_) {}
                }
            }
            // v3.7: Listen for game data updates
            if (changes.rota_game_data) {
                state.gameData = changes.rota_game_data.newValue || {};
                renderLibrary();
            }
            if (changes.rota_saved_servers) {
                renderSavedServers();
            }
            
            // v1.6: Listen for auto-scan trigger from service worker
            if (changes.rota_auto_scan) {
                const placeId = changes.rota_auto_scan.newValue;
                if (placeId) {
                    checkLiveEventAlert();
                }
            }
        }
    });
    
    // v1.6: Live Event Panel Event Listeners
    const btnCloseEvent = document.getElementById('btn-close-event');
    const btnEventScan = document.getElementById('btn-event-scan');
    const btnEventLater = document.getElementById('btn-event-later');
    
    if (btnCloseEvent) {
        btnCloseEvent.addEventListener('click', closeLiveEventPanel);
    }
    
    if (btnEventScan) {
        btnEventScan.addEventListener('click', () => {
            const placeId = btnEventScan.dataset.placeId;
            if (placeId) {
                closeLiveEventPanel();
                scanServers(placeId);
            }
        });
    }
    
    if (btnEventLater) {
        btnEventLater.addEventListener('click', () => {
            closeLiveEventPanel();
            showToast(TrackedI18n.t('remindLaterMessage') || '10 dakika sonra tekrar hatırlatılacak', 'info');
        });
    }
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
    renderSavedServers();
    // Default to list view
    if (state.viewMode === 'graph') {
        renderGraph();
    }
}

function renderSavedServers() {
    const panel = document.getElementById('saved-servers-panel');
    const list = document.getElementById('saved-servers-list');
    if (!panel || !list) return;

    chrome.storage.local.get('rota_saved_servers', (data) => {
        const servers = data.rota_saved_servers || [];
        panel.style.display = servers.length > 0 ? '' : 'none';
        if (servers.length === 0) return;

        const fmt = (ts) => new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        const abbr = (id) => id ? `${id.substring(0, 8)}…${id.slice(-4)}` : '';
        const cleanTitle = (t) => String(t || '').replace(/\s*\|\s*(?:Play on\s*)?Roblox\s*$/i, '').trim() || 'Roblox Oyunu';

        list.innerHTML = servers.map((s, i) => {
            const dead = !!s.notFoundSince;
            const deadBadge = dead
                ? `<span class="saved-sv-dead-badge" title="Server kapalı olabilir — 5 dk sonra otomatik silinir">Kapalı?</span>`
                : '';
            return `
            <div class="saved-sv-item${dead ? ' sv-possibly-dead' : ''}">
                <div class="saved-sv-main">
                    <div class="saved-sv-title" title="${escHtml(s.gameTitle)}">${escHtml(cleanTitle(s.gameTitle))}${deadBadge}</div>
                    <div class="saved-sv-meta" title="${escHtml(s.jobId)}">${abbr(s.jobId)} · ${fmt(s.savedAt)}</div>
                </div>
                <div class="saved-sv-actions">
                    <button class="pill-btn saved-sv-join" data-sv-idx="${i}" data-sv-place="${s.placeId}" data-sv-job="${escHtml(s.jobId)}">Katıl</button>
                    <button class="icon-btn-danger sv-del-btn" data-sv-idx="${i}" title="Sil">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('.saved-sv-join').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = `roblox://experiences/start?placeId=${btn.dataset.svPlace}&gameInstanceId=${encodeURIComponent(btn.dataset.svJob)}`;
                chrome.tabs.create({ url, active: true });
            });
        });

        list.querySelectorAll('.sv-del-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.svIdx);
                chrome.storage.local.get('rota_saved_servers', (d) => {
                    const updated = (d.rota_saved_servers || []).filter((_, i) => i !== idx);
                    chrome.storage.local.set({ rota_saved_servers: updated }, () => renderSavedServers());
                });
            });
        });
    });
}

function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function renderControls() {
    // HEDEF BÖLGE kontrolü: pill = otomatik (en yakın), dropdown = seçili hedef.
    // Oto-Pilot (main.js v5.0) rota_target_region'ı storage'dan okur → o bölgede sunucu arar.
    const isAuto = !state.targetRegion;
    ui.segments.forEach(btn => { if (!btn.dataset.mode) btn.classList.toggle('active', isAuto); });
    if (ui.manualRegionRow) ui.manualRegionRow.style.display = 'block';
    if (ui.lblManualRegion) ui.lblManualRegion.textContent = targetRegionLabel(state.targetRegion);
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
 * NETWORK IDENTITY & VPN CHECK
 * Birden fazla HTTPS provider denenir (ad-blocker bir tanesini blocklarsa diğeri çalışır).
 * 5sn timeout ile hang sorunu önlenir.
 */
async function checkNetworkIdentity() {
    if (ui.netLocation) ui.netLocation.textContent = '...';
    if (ui.netIsp) ui.netIsp.textContent = '...';
    if (ui.vpnStatus) ui.vpnStatus.textContent = TrackedI18n.t('analyzing');

    // 10dk cache — IP/ISP genelde session boyunca değişmez, her popup açılışında network call gereksiz.
    // Eskiden popup/sidepanel her açıldığında 3 ad-blocker'lı provider deniyordu (ipwho.is, ipapi.co fail).
    try {
        const cached = await chrome.storage.local.get('rota_netid_cache');
        const c = cached?.rota_netid_cache;
        if (c && c.data && c.timestamp && (Date.now() - c.timestamp) < 10 * 60 * 1000) {
            const data = c.data;
            console.log('[NetID] Cache hit (', Math.round((Date.now() - c.timestamp) / 1000), 'sn old)');
            state.ipInfo = data;
            if (ui.netLocation) ui.netLocation.textContent = `${data.country} (${data.countryCode})`;
            if (ui.netIsp) ui.netIsp.textContent = data.isp.length > 20 ? data.isp.substring(0, 18) + '..' : data.isp;
            const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            let pingHint = '';
            if (state.bestRegion) {
                const bestCode = state.bestRegion.match(/\(([A-Z]+)\)/)?.[1];
                if (bestCode && data.countryCode === bestCode) pingHint = TrackedI18n.t('optimum');
            }
            if (ui.vpnStatus) {
                if (data.timezone && browserTz !== data.timezone) {
                    ui.vpnStatus.textContent = TrackedI18n.t('probableVPN') + pingHint;
                    ui.vpnStatus.style.color = 'var(--accent-purple)';
                } else {
                    ui.vpnStatus.textContent = TrackedI18n.t('directConnection') + pingHint;
                    ui.vpnStatus.style.color = 'var(--accent-green)';
                }
            }
            return;
        }
    } catch (_) {}

    // 5sn timeout ile fetch wrapper
    const fetchWithTimeout = async (url, timeoutMs = 5000) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: ctrl.signal });
            return res;
        } finally {
            clearTimeout(t);
        }
    };

    // Provider'lar (ad-blocker fallback chain). Hepsi HTTPS.
    // Her provider'ın response shape'i normalize edilir.
    const providers = [
        {
            name: 'ipwho.is',
            url: 'https://ipwho.is/?fields=success,country,country_code,connection,timezone,ip',
            parse: (d) => d.success ? {
                country: d.country,
                countryCode: d.country_code,
                isp: d.connection?.isp || d.connection?.org || 'Unknown',
                timezone: d.timezone?.id,
                ip: d.ip
            } : null
        },
        {
            name: 'ipapi.co',
            url: 'https://ipapi.co/json/',
            parse: (d) => (d && !d.error) ? {
                country: d.country_name,
                countryCode: d.country_code,
                isp: d.org || 'Unknown',
                timezone: d.timezone,
                ip: d.ip
            } : null
        },
        {
            name: 'ipinfo.io',
            url: 'https://ipinfo.io/json',
            parse: (d) => (d && d.country) ? {
                country: d.country,
                countryCode: d.country,
                isp: d.org?.replace(/^AS\d+\s+/, '') || 'Unknown',
                timezone: d.timezone,
                ip: d.ip
            } : null
        }
    ];

    let data = null;
    let usedProvider = null;
    for (const p of providers) {
        try {
            const res = await fetchWithTimeout(p.url, 5000);
            if (!res.ok) continue;
            const raw = await res.json();
            const normalized = p.parse(raw);
            if (normalized && normalized.country) {
                data = normalized;
                usedProvider = p.name;
                break;
            }
        } catch (e) {
            console.warn(`[NetID] ${p.name} fail:`, e.message);
        }
    }

    if (!data) {
        if (ui.vpnStatus) ui.vpnStatus.textContent = TrackedI18n.t('serviceUnavailable');
        if (ui.netLocation) ui.netLocation.textContent = '--';
        if (ui.netIsp) ui.netIsp.textContent = '--';
        console.warn('[NetID] Tüm providerlar başarısız (ad-blocker olabilir)');
        return;
    }

    console.log(`[NetID] ${usedProvider}'dan alındı:`, data);
    state.ipInfo = data;
    // Cache'e kaydet (10dk geçerli) → sonraki popup/sidepanel açılışları network call yapmadan kullanır
    try { chrome.storage.local.set({ rota_netid_cache: { data, timestamp: Date.now() } }); } catch (_) {}

    ui.netLocation.textContent = `${data.country} (${data.countryCode})`;
    ui.netIsp.textContent = data.isp.length > 20 ? data.isp.substring(0, 18) + '..' : data.isp;

    // VPN heuristic: browser timezone vs IP timezone
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const ipTz = data.timezone;

    let pingHint = "";
    if (state.bestRegion) {
        const bestCode = state.bestRegion.match(/\(([A-Z]+)\)/)?.[1];
        if (bestCode && data.countryCode === bestCode) {
            pingHint = TrackedI18n.t('optimum');
        }
    }

    if (ipTz && browserTz !== ipTz) {
        ui.vpnStatus.textContent = TrackedI18n.t('probableVPN') + pingHint;
        ui.vpnStatus.style.color = "var(--accent-purple)";
    } else {
        ui.vpnStatus.textContent = TrackedI18n.t('directConnection') + pingHint;
        ui.vpnStatus.style.color = "var(--accent-green)";
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
                ui.globalStatus.textContent = TrackedI18n.t('statusReadyCache');
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
        ui.globalStatus.textContent = TrackedI18n.t('statusMeasuring');
        ui.globalStatus.style.color = "var(--accent-yellow)";
    }

    const probes = state.settings.probes;
    if (!probes || Object.keys(probes).length === 0) {
        showToast(TrackedI18n.t('noProbesFound'), 'error');
        if (ui.pingList) ui.pingList.innerHTML = '';
        return;
    }
    
    // Run probes in parallel for speed
    const promises = Object.entries(probes).map(async ([region, url]) => {
        try {
            const result = await PingUtils.measureMedianLatency(url, state.settings.timeoutMs, 5);
            return { region, ms: result.ms, jitter: result.jitter };
        } catch (e) {
            console.warn(`[Popup] Probe failed for ${region}:`, e);
            return { region, ms: 999, jitter: 0 };
        }
    });

    try {
        const results = await Promise.all(promises);

        // Sort by latency for Best Region determination
        results.sort((a, b) => a.ms - b.ms);
        state.pingResults = results;

        // CALC STATS — özet SENİN EN YAKIN/erişilebilir bölgelerine göre (uzak kıtalar bozmasın).
        const validResults = results.filter(r => r.ms < 900);
        const pings = validResults.map(r => r.ms);

        let avgPing = 0;
        let jitter = 0;
        let grade = 'F';

        if (pings.length > 0) {
            const best = Math.min(...pings);
            // ORTALAMA: sadece YAKIN bölgeler (en iyinin ~2 katına kadar) → Japonya/Avustralya/Brezilya gibi
            // uzak kıtalar global ortalamayı şişirip notu yanlış düşürmesin. Bağlanacağın bölgeler bunlar.
            const nearThr = best * 2 + 25;
            const nearby = validResults.filter(r => r.ms <= nearThr);
            avgPing = Math.round(nearby.reduce((a, r) => a + r.ms, 0) / nearby.length);
            // Jitter: yakın bölgelerin varyans ortalaması
            const jitterValues = nearby.map(r => r.jitter).filter(j => j >= 0);
            jitter = jitterValues.length > 0
                ? Math.round(jitterValues.reduce((a, b) => a + b, 0) / jitterValues.length)
                : 0;
            // AĞ NOTU: bağlanacağın EN YAKIN bölgeye göre (gerçek deneyimin) — global ortalamaya göre DEĞİL.
            grade = PingUtils.calculateGrade(best, jitter);
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
            ui.globalStatus.textContent = TrackedI18n.t('statusReady');
            ui.globalStatus.style.color = "var(--accent-green)";
        }
    } catch (err) {
        const isNetworkBlock = err && (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError'));
        if (!isNetworkBlock) {
            console.error('[Popup] Ping measurement failed:', err);
        }
        // Toast zaten gösteriliyor, ad-blocker durumunda console'u kirletme
        showToast(TrackedI18n.t('pingMeasureFailed'), 'error');
        if (ui.btnRefreshPing) ui.btnRefreshPing.querySelector('svg').classList.remove('spin');
        if (ui.globalStatus) ui.globalStatus.textContent = TrackedI18n.t('statusError');
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
    ui.valAvgPing.textContent = avgPing > 0 ? `${avgPing}${TrackedI18n.t('ms')}` : '--';
    ui.valJitter.textContent = jitter >= 0 ? `${jitter}${TrackedI18n.t('ms')}` : '--';
    
    const bestReg = state.bestRegion ? TrackedI18n.localizeRegionName(state.bestRegion).split(' ')[0] : '--';
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
        ui.pingList.innerHTML = `<div class="empty-state"><p>${TrackedI18n.t('allServersFailed')}</p></div>`;
        return;
    }

    results.forEach(res => {
        const item = document.createElement('div');
        item.className = 'ping-item';
        
        // Use shared logic for color
        const colorClass = PingUtils.getStatus(res.ms);

        // Display > 900 as "Error/Timeout"
        const msDisplay = res.ms >= 900 ? TrackedI18n.t('error') : `${res.ms}${TrackedI18n.t('ms')}`;
        // If it's an error, force red dot
        const finalColorClass = res.ms >= 900 ? 'red' : colorClass;

        const flag = (typeof tkFlag === 'function') ? tkFlag(res.region) : '';
        item.innerHTML = `
            <div class="ping-left">
                <div class="status-dot ${finalColorClass}"></div>
                ${flag}<span>${TrackedI18n.localizeRegionName(res.region)}</span>
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
        svg.innerHTML = `<text x="150" y="60" text-anchor="middle" fill="#888" font-size="12">${TrackedI18n.t('noData')}</text>`;
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
            <span>${TrackedI18n.localizeRegionName(region).split(' ')[0]}</span>
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
            showToast(TrackedI18n.t('notRobloxPage'), 'error');
            return;
        }

        // Extract ID from URL
        const match = tab.url.match(/games\/(\d+)\//);
        if (!match) {
            showToast(TrackedI18n.t('idNotFound'), 'error');
            return;
        }
        const placeId = match[1];

        // Check duplicate
        if (state.favorites.some(f => f.placeId === placeId)) {
            showToast(TrackedI18n.t('alreadyInLibrary'), 'info');
            return;
        }

        // Get Title via Content Script (if injected and ready)
        let title = tab.title;
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: "getTitle" });
            if (response && response.title) title = response.title;
        } catch (e) {
            // Content script may not be injected yet (page loading or just opened)
            // This is expected behavior - silently use tab.title as fallback
            // console.log("[Popup] Content script not ready, using tab title fallback");
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
        showToast(TrackedI18n.t('addedToLibrary'), 'success');
    } catch (err) {
        console.error('[Popup] Add Favorites failed:', err);
        showToast(TrackedI18n.t('errorOccurred'), 'error');
    }
}

function cleanTitle(t) {
    if (!t) return 'Untitled Game';
    // Roblox başlık suffix'lerinin tümü: " - Roblox", " | Roblox", " | Play on Roblox" (case-insensitive)
    return String(t)
        .replace(/\s*\|\s*(?:Play on\s*)?Roblox\s*$/i, '')
        .replace(/\s*-\s*Roblox\s*$/i, '')
        .trim() || 'Untitled Game';
}

// ── Oyun Kütüphanesi Görünüm Anahtarı (Win11 Gezgini "Görünüm" menüsü tarzı) ──
function handleLibViewOutside(e) {
    if (ui.libViewSwitch && !ui.libViewSwitch.contains(e.target)) closeLibViewMenu();
}
function openLibViewMenu() {
    if (!ui.libViewMenu || !ui.btnLibView) return;
    ui.libViewMenu.hidden = false;
    ui.btnLibView.setAttribute('aria-expanded', 'true');
    if (ui.libViewSwitch) ui.libViewSwitch.classList.add('open');
    // Aktif görünümü işaretle (tik işareti)
    ui.libViewMenu.querySelectorAll('.lib-view-opt').forEach(opt => {
        const on = opt.dataset.view === state.libraryView;
        opt.classList.toggle('active', on);
        opt.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    document.addEventListener('click', handleLibViewOutside, true);
}
function closeLibViewMenu() {
    if (!ui.libViewMenu) return;
    ui.libViewMenu.hidden = true;
    if (ui.btnLibView) ui.btnLibView.setAttribute('aria-expanded', 'false');
    if (ui.libViewSwitch) ui.libViewSwitch.classList.remove('open');
    document.removeEventListener('click', handleLibViewOutside, true);
}
function setLibraryView(view) {
    const v = (view === 'compact') ? 'compact' : 'comfort';
    if (state.libraryView === v) return;
    state.libraryView = v;
    safeStorageSet({ [STORAGE_KEYS.LIBRARY_VIEW]: v });
    renderLibrary();
}
function setupLibraryViewSwitch() {
    if (!ui.btnLibView || !ui.libViewMenu) return;
    ui.btnLibView.addEventListener('click', (e) => {
        e.stopPropagation();
        if (ui.libViewMenu.hidden) openLibViewMenu();
        else closeLibViewMenu();
    });
    ui.libViewMenu.querySelectorAll('.lib-view-opt').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            setLibraryView(opt.dataset.view);
            closeLibViewMenu();
        });
    });
}

function renderLibrary() {
    if (!ui.libraryList) return;
    ui.libraryList.innerHTML = '';
    // Görünüm modu sınıfı (CSS düzeni buna göre değişir)
    ui.libraryList.classList.toggle('view-compact', state.libraryView === 'compact');
    ui.libraryList.classList.toggle('view-comfort', state.libraryView !== 'compact');

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
        const iconSvg = isSearching
            ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
            : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
        const title = isSearching ? TrackedI18n.t('noResults') : TrackedI18n.t('emptyLibraryTitle');
        const desc = isSearching 
            ? `"${searchTerm}" ${TrackedI18n.t('noResultsDesc')}` 
            : TrackedI18n.t('emptyLibraryDesc');
        
        ui.libraryList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" style="margin-bottom:8px;">${iconSvg}</div>
                <div class="empty-title">${title}</div>
                <div class="empty-desc">${desc}</div>
            </div>`;
        return;
    }

    const compactView = state.libraryView === 'compact';

    displayList.forEach((game) => {
        const el = document.createElement('div');
        el.className = 'lib-item';

        const playtimeStr = formatPlaytime(game.playtimeSeconds || 0);

        // v3.7: Get live game data
        const liveData = state.gameData && state.gameData[game.placeId];
        const playerCount = liveData ? liveData.playerCount : null;
        const trendIcon = liveData ? liveData.trendIcon : '';
        const hasUpdate = liveData && liveData.hasRecentUpdate;
        const updateText = liveData ? liveData.updateTimeText : '';

        // Title kaynağı: SW'nin son fetch ettiği liveTitle (favorites'tan daha güncel olabilir) → cleanTitle ile suffix temizle
        const liveTitle = liveData?.liveTitle;
        const displayTitle = cleanTitle(liveTitle || game.title);

        if (compactView) {
            // ── KOMPAKT TEK-SATIR KART (eski 2 katlı kart ~110px → ~52px; 50+ oyunda scroll yarıya iner) ──
            const metaBits = [];
            if (playerCount !== null) {
                metaBits.push(`<span class="player-count-badge"><span class="live-dot"></span>${playerCount.toLocaleString()}</span>`);
                if (trendIcon) metaBits.push(`<span class="trend-indicator" title="Trend">${getTrendSvg(trendIcon)}</span>`);
            }
            if (hasUpdate) metaBits.push(`<span class="update-chip" title="${TrackedI18n.t('newUpdate')}">${BELL_SVG}<span>${updateText}</span></span>`);
            metaBits.push(`<span class="playtime-badge">${playtimeStr}</span>`);

            el.innerHTML = `
                <div class="lib-icon-box" data-place-id="${game.placeId}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
                <div class="lib-info">
                    <div class="lib-title" title="ID: ${game.placeId}">${displayTitle}</div>
                    <div class="lib-meta">${metaBits.join('')}</div>
                </div>
                <div class="lib-acts">
                    <button class="lib-act scan" data-id="${game.placeId}" title="${TrackedI18n.t('scan')}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </button>
                    <button class="lib-act join" data-id="${game.placeId}" title="${TrackedI18n.t('join')}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </button>
                    <button class="lib-act analyze" data-id="${game.placeId}" title="${TrackedI18n.t('eventAnalysisTip')}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    </button>
                    <button class="lib-act danger delete-btn" data-original-idx="${game.originalIndex}" data-id="${game.placeId}" title="${TrackedI18n.t('deleteGame')}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
        } else {
            // ── GENİŞ KART (VARSAYILAN / eski hâl): 2 katlı, büyük ikon + canlı istatistik + güncelleme rozeti + pill butonlar ──
            let liveStatsHtml = '';
            if (playerCount !== null) {
                liveStatsHtml = `
                    <div class="live-stats">
                        <span class="player-count-badge">
                            <span class="live-dot"></span>
                            ${playerCount.toLocaleString()} ${TrackedI18n.t('players')}
                        </span>
                        <span class="trend-indicator" title="Trend">${getTrendSvg(trendIcon)}</span>
                    </div>`;
            }
            let updateBadgeHtml = '';
            if (hasUpdate) {
                updateBadgeHtml = `
                    <div class="update-badge">
                        ${BELL_SVG} ${TrackedI18n.t('newUpdate')}
                        <span class="update-time">${updateText}</span>
                    </div>`;
            }

            el.innerHTML = `
                <div class="lib-header">
                    <div class="lib-icon-box" data-place-id="${game.placeId}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </div>
                    <div class="lib-info">
                        <div class="lib-title" title="ID: ${game.placeId}">
                            ${displayTitle}
                            ${trendIcon ? `<span class="title-trend">${getTrendSvg(trendIcon)}</span>` : ''}
                        </div>
                        <div class="lib-sub">
                            <span>ID: ${game.placeId}</span>
                            <span class="playtime-badge">• ${playtimeStr}</span>
                        </div>
                        ${liveStatsHtml}
                        ${updateBadgeHtml}
                    </div>
                    <button class="icon-btn-danger delete-btn" data-original-idx="${game.originalIndex}" data-id="${game.placeId}" title="${TrackedI18n.t('deleteGame')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
                <div class="lib-actions-row">
                    <button class="pill-btn scan" data-id="${game.placeId}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        ${TrackedI18n.t('scan')}
                    </button>
                    <button class="pill-btn join" data-id="${game.placeId}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        ${TrackedI18n.t('join')}
                    </button>
                    <button class="pill-btn analyze" data-id="${game.placeId}" title="${TrackedI18n.t('eventAnalysisTip')}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    </button>
                </div>
            `;
        }
        ui.libraryList.appendChild(el);
    });

    // Event Delegation
    const joinBtns = ui.libraryList.querySelectorAll('.join');
    joinBtns.forEach(b => b.addEventListener('click', (e) => joinClosestServer(e.target.closest('.join').dataset.id)));
    
    // Scan Buttons
    const scanBtns = ui.libraryList.querySelectorAll('.scan');
    scanBtns.forEach(b => b.addEventListener('click', (e) => scanServers(e.target.closest('.scan').dataset.id)));
    
    // v1.6: Analyze Buttons
    const analyzeBtns = ui.libraryList.querySelectorAll('.analyze');
    analyzeBtns.forEach(b => b.addEventListener('click', (e) => showEventAnalysis(e.target.closest('.analyze').dataset.id)));

    const delBtns = ui.libraryList.querySelectorAll('.delete-btn');
    delBtns.forEach(b => b.addEventListener('click', (e) => {
        // Find closest button in case SVG clicked
        const btn = e.target.closest('.delete-btn');
        const placeId = btn.dataset.id;
        const itemEl = btn.closest('.lib-item');

        deleteGame(placeId, itemEl);
    }));

    loadLibraryThumbnails(displayList);
}

const THUMB_CACHE_KEY = 'rota_thumb_cache';
const THUMB_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat

async function getThumbCache() {
    const s = await chrome.storage.local.get(THUMB_CACHE_KEY);
    return s[THUMB_CACHE_KEY] || {};
}

async function saveThumbCache(updates) {
    const cache = await getThumbCache();
    const now = Date.now();
    for (const [pid, url] of Object.entries(updates)) cache[String(pid)] = { url, ts: now };
    await chrome.storage.local.set({ [THUMB_CACHE_KEY]: cache });
}

function applyThumb(container, placeId, url) {
    const box = container?.querySelector(`.lib-icon-box[data-place-id="${placeId}"]`);
    if (box) box.innerHTML = `<img src="${url}" class="lib-thumb" alt="">`;
}

async function fetchThumbsFromApi(placeIds) {
    const query = placeIds.map(id => `placeIds=${id}`).join('&');
    const gamesRes = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?${query}`, { credentials: 'include' });
    if (!gamesRes.ok) return {};
    const gamesData = await gamesRes.json();

    const universeToPlace = {};
    gamesData.forEach(d => { if (d.universeId && d.placeId) universeToPlace[d.universeId] = String(d.placeId); });
    const universeIds = Object.keys(universeToPlace);
    if (!universeIds.length) return {};

    const iconsRes = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
    if (!iconsRes.ok) return {};
    const iconsData = await iconsRes.json();
    if (!iconsData?.data) return {};

    const result = {};
    iconsData.data.forEach(info => {
        const pid = universeToPlace[info.targetId];
        if (pid && info.imageUrl) result[pid] = info.imageUrl;
    });
    return result;
}

async function loadLibraryThumbnails(games) {
    try {
        const placeIds = games.map(g => String(g.placeId));
        const cache = await getThumbCache();
        const now = Date.now();

        const fresh = {};
        const stale = [];
        for (const pid of placeIds) {
            const entry = cache[pid];
            if (entry && (now - entry.ts) < THUMB_CACHE_TTL) {
                fresh[pid] = entry.url;
            } else {
                stale.push(pid);
            }
        }

        // Cache'den anında göster
        for (const [pid, url] of Object.entries(fresh)) {
            applyThumb(ui.libraryList, pid, url);
        }

        // Eksik/eski olanları API'den çek, sonra göster + cache'e yaz
        if (stale.length > 0) {
            const fetched = await fetchThumbsFromApi(stale);
            for (const [pid, url] of Object.entries(fetched)) {
                applyThumb(ui.libraryList, pid, url);
            }
            if (Object.keys(fetched).length > 0) await saveThumbCache(fetched);
        }
    } catch (_) {}
}

/**
 * v1.6: LIVE EVENT DETECTOR FUNCTIONS
 */
async function checkLiveEventAlert() {
    try {
        const data = await chrome.storage.local.get(['rota_auto_scan', 'rota_favorites']);
        const autoScanPlaceId = data.rota_auto_scan;
        const favorites = data.rota_favorites || [];
        
        if (!autoScanPlaceId) return;
        
        // Find the game in favorites
        const game = favorites.find(g => g.placeId === autoScanPlaceId);
        if (!game) {
            // Clear auto-scan if game not found
            await chrome.storage.local.remove('rota_auto_scan');
            return;
        }
        
        // Show the live event panel
        showLiveEventPanel(game);
        
        // Clear the auto-scan trigger
        await chrome.storage.local.remove('rota_auto_scan');
        
    } catch (err) {
        console.error('[Popup] v1.6: Failed to check live event alert:', err);
    }
}

function showLiveEventPanel(game) {
    const panel = document.getElementById('live-event-panel');
    const gameNameEl = document.getElementById('event-game-name');
    const btnEventScan = document.getElementById('btn-event-scan');
    
    if (!panel || !gameNameEl || !btnEventScan) return;
    
    gameNameEl.textContent = (game.title || 'Oyun').replace(/\s*\|\s*(?:Play on\s*)?Roblox\s*$/i, '').trim();
    btnEventScan.dataset.placeId = game.placeId;
    
    panel.style.display = 'block';
    
    // Scroll to the panel
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * v1.6: Show Event Analysis Modal for a game
 * Sade: Ya var ya yok
 */
// Göreli zaman: "3 saat", "2 gün" (dile göre birim)
function eventRelTime(ms) {
    const m = Math.round(Math.abs(ms) / 60000);
    if (m < 60) return `${Math.max(1, m)} ${TrackedI18n.t('unitMin')}`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} ${TrackedI18n.t('unitHour')}`;
    return `${Math.round(h / 24)} ${TrackedI18n.t('unitDay')}`;
}

// "3 saat sonra bitiyor" / "2 gün sonra başlıyor" / "5 saat önce bitti"
function eventTimingLabel(ev) {
    const now = Date.now();
    const start = ev.startUtc ? Date.parse(ev.startUtc) : null;
    const end = ev.endUtc ? Date.parse(ev.endUtc) : null;
    if (ev.state === 'upcoming' && start) return TrackedI18n.t('eventStartsIn').replace('{t}', eventRelTime(start - now));
    if (ev.state === 'live' && end) return TrackedI18n.t('eventEndsIn').replace('{t}', eventRelTime(end - now));
    if (ev.state === 'ended' && end) return TrackedI18n.t('eventEndedAgo').replace('{t}', eventRelTime(now - end));
    return '';
}

// KATMAN 1: Roblox'un RESMİ etkinlikleri (geliştiricinin beyanı — kesin, tahmin değil)
function renderOfficialEvents(events) {
    if (!events || events.length === 0) return '';
    const VERIFIED = '<svg class="ev-verified" width="12" height="12" viewBox="0 0 24 24" fill="#0A84FF" stroke="none" title="Doğrulanmış"><path d="M12 1.5l2.6 1.95 3.25.2.95 3.15L21.5 10l-1.95 2.6.95 3.15-3.15.95L15.4 19.8 12 21.5l-2.6-1.7-3.25-.05-.95-3.15L3.25 13.8 4.2 10.65 2.5 7l3.15-.95.95-3.15 3.25-.2z"/><polyline points="8.4 12 11 14.5 15.6 9.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const SHIELD = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:middle"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>';
    const cards = events.map(ev => {
        const stateKey = ev.state === 'live' ? 'eventStatusLive' : ev.state === 'upcoming' ? 'eventStatusUpcoming' : 'eventStatusEnded';
        const timing = eventTimingLabel(ev);
        const host = ev.hostName
            ? `<div class="ev-host">${TrackedI18n.t('eventHostedBy').replace('{h}', escapeHtml(ev.hostName))}${ev.hostVerified ? VERIFIED : ''}</div>`
            : '';
        return `
            <div class="official-event ev-${ev.state}">
                <div class="ev-top">
                    <span class="ev-badge ev-badge-${ev.state}">${ev.state === 'live' ? '<span class="ev-live-dot"></span>' : ''}${TrackedI18n.t(stateKey)}</span>
                    ${timing ? `<span class="ev-timing">${timing}</span>` : ''}
                </div>
                <div class="ev-title">${escapeHtml(ev.title)}</div>
                ${ev.subtitle ? `<div class="ev-subtitle">${escapeHtml(ev.subtitle)}</div>` : ''}
                ${host}
            </div>`;
    }).join('');
    return `
        <div class="official-events-panel">
            <div class="official-events-header">${SHIELD} ${TrackedI18n.t('officialEvent')} <span class="oe-verified-note">· ${TrackedI18n.t('officialEventVerified')}</span></div>
            ${cards}
        </div>`;
}

async function showEventAnalysis(placeId) {
    let modal = document.getElementById('event-analysis-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'event-analysis-modal';
        modal.className = 'analysis-modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="analysis-content">
            <div class="analysis-header">
                <h3><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:6px;vertical-align:middle;opacity:0.8"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>${TrackedI18n.t('hybridEventAnalysis')}</h3>
                <button class="close-analysis" id="btn-close-analysis"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div class="analysis-body">
                <div class="analysis-loading">
                    <div class="pulse-spinner"></div>
                    <p>${TrackedI18n.t('analyzingText')}</p>
                    <small>${TrackedI18n.t('analysisDetails')}</small>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    
    modal.querySelector('#btn-close-analysis').addEventListener('click', closeEventAnalysis);
    
    try {
        const response = await chrome.runtime.sendMessage({ 
            action: "analyzeGame", 
            placeId 
        });
        
        if (!response.success) {
            modal.querySelector('.analysis-body').innerHTML = `
                <div class="analysis-error"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF453A" stroke-width="2.5" style="margin-right:6px;flex-shrink:0"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>${response.error}</div>
            `;
            return;
        }
        
        const result = response.analysis;
        const officialEvents = response.officialEvents || [];
        const hasLiveOrUpcoming = officialEvents.some(e => e.state === 'live' || e.state === 'upcoming');
        const officialHtml = renderOfficialEvents(officialEvents);
        const signals = result.signals || [];

        const signalListHtml = signals.map(s => {
            const icon = SIGNAL_ICONS[s.type] || SIGNAL_DEFAULT;
            return `
                <div class="signal-item">
                    <span class="signal-icon">${icon}</span>
                    <span class="signal-text">${s.reason}</span>
                    <span class="signal-score">+${s.score}</span>
                </div>
            `;
        }).join('');

        let resultHtml = '';
        if (result.isEvent && result.isDefinite) {
            resultHtml = `
                <div class="event-result-box event-yes">
                    <div class="event-result-icon">${EVENT_ICON_YES}</div>
                    <div class="event-result-text">${TrackedI18n.t('eventYes')}</div>
                    <div class="event-result-sub">${TrackedI18n.t(result.recommendation) || result.recommendation}</div>
                </div>`;
        } else if (result.isEvent) {
            resultHtml = `
                <div class="event-result-box event-maybe">
                    <div class="event-result-icon">${EVENT_ICON_MAYBE}</div>
                    <div class="event-result-text">${TrackedI18n.t('eventMaybe')}</div>
                    <div class="event-result-sub">${TrackedI18n.t(result.recommendation) || result.recommendation}</div>
                </div>`;
        } else {
            resultHtml = `
                <div class="event-result-box event-no">
                    <div class="event-result-icon">${EVENT_ICON_NO}</div>
                    <div class="event-result-text">${TrackedI18n.t('eventNo')}</div>
                    <div class="event-result-sub">${TrackedI18n.t(result.recommendation) || result.recommendation}</div>
                </div>`;
        }
        
        modal.querySelector('.analysis-body').innerHTML = `
            <div class="analysis-game">${response.title}</div>
            ${officialHtml}
            ${officialEvents.length === 0 ? `<div class="official-events-none">${TrackedI18n.t('officialEventNone')}</div>` : ''}
            <div class="estimate-section">
                <div class="estimate-header">${TrackedI18n.t('signalEstimate')}</div>
                ${!hasLiveOrUpcoming ? `<div class="estimate-note">${TrackedI18n.t('signalEstimateNote')}</div>` : ''}
                ${resultHtml}
                ${signals.length > 0 ? `
                    <div class="signals-panel">
                        <strong>${CHART_SVG} ${TrackedI18n.t('detectedSignals')} (${signals.length}):</strong>
                        ${signalListHtml}
                    </div>
                    <div class="score-bar">
                        <div class="score-label">${TrackedI18n.t('totalScore')}: <b>${result.totalScore}</b></div>
                        <div class="score-track">
                            <div class="score-fill" style="width: ${Math.min(100, (result.totalScore / 160) * 100)}%; background: ${result.totalScore >= 110 ? '#30D158' : result.totalScore >= 60 ? '#FF9F0A' : '#8E8E93'}"></div>
                        </div>
                        <div class="score-thresholds">
                            <span>0</span><span>${TrackedI18n.t('threshold')}: 60</span><span>${TrackedI18n.t('definite')}: 110</span>
                        </div>
                    </div>
                ` : `<div class="no-signals">${TrackedI18n.t('noSignals')}</div>`}
            </div>
            <div class="analysis-actions">
                <button class="pill-btn primary" id="btn-refresh-analysis">${REFRESH_SVG} ${TrackedI18n.t('refresh')}</button>
            </div>
        `;
        
        modal.querySelector('#btn-refresh-analysis')?.addEventListener('click', () => {
            showEventAnalysis(placeId);
        });
        
    } catch (err) {
        // Ad-blocker durumu için kullanıcı dostu mesaj
        const isNetworkBlock = err && (
            err.message?.includes('Failed to fetch') ||
            err.message?.includes('NetworkError') ||
            err.message?.includes('ERR_BLOCKED')
        );

        if (isNetworkBlock) {
            // Sessizce geç — UI'da kullanıcıya zaten apiBlocked mesajı gösteriliyor
            modal.querySelector('.analysis-body').innerHTML = `
                <div class="analysis-blocked" style="text-align:center; padding:24px 16px;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow,#FFD60A)" stroke-width="2" style="margin-bottom:12px;opacity:0.85"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">${TrackedI18n.t('apiBlocked') || 'Roblox API Engellendi'}</div>
                    <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;max-width:280px;margin:0 auto 16px;">
                        ${TrackedI18n.t('adBlockerExplain') || 'Tarayıcındaki ad-blocker (uBlock, AdBlock vb.) Roblox API\'sini engelliyor. Bu sayfa için ad-blocker\'ı kapatıp tekrar dene.'}
                    </div>
                    <button class="pill-btn primary" id="btn-retry-analysis" style="padding:8px 18px;">
                        ${TrackedI18n.t('retry') || 'Tekrar Dene'}
                    </button>
                </div>
            `;
            modal.querySelector('#btn-retry-analysis')?.addEventListener('click', () => {
                showEventAnalysis(placeId);
            });
        } else {
            console.error('[EventAnalysis] Error:', err);
            modal.querySelector('.analysis-body').innerHTML = `
                <div class="analysis-error"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF453A" stroke-width="2.5" style="margin-right:6px;flex-shrink:0"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>${TrackedI18n.t('error')}: ${err.message}</div>
            `;
        }
    }
}

function closeEventAnalysis() {
    const modal = document.getElementById('event-analysis-modal');
    if (modal) modal.style.display = 'none';
}

function closeLiveEventPanel() {
    const panel = document.getElementById('live-event-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

/**
 * SERVER SCANNER
 */
const SCAN_SVG_SPIN   = `<svg class="spin-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
const SCAN_SVG_OK     = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#30d158" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const SCAN_SVG_WARN   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF9F0A" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
const SCAN_SVG_ERR    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF453A" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
const SCAN_SVG_PEOPLE = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;

// ── BÖLGE SİSTEMİ (popup) ──────────────────────────────────────────────────
// KATIL ve TARA artık kullanıcının bölgesine EN YAKIN sunucuyu bulur/gösterir.
// Doluluk ÖNEMSİZ (yeter ki dolu olmasın) — tek kriter: bölge yakınlığı (mesafe).
let _popupGeo = null;
function popupHaversine(la1, lo1, la2, lo2) {
    const R = 6371, dLa = (la2 - la1) * Math.PI / 180, dLo = (lo2 - lo1) * Math.PI / 180;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
async function popupGetGeo() {
    if (_popupGeo) return _popupGeo;
    try {
        const r = await chrome.runtime.sendMessage({ action: 'resolveUserLocation' });
        if (r && r.ok && typeof r.lat === 'number') { _popupGeo = r; return r; }
    } catch (_) {}
    return null;
}
async function popupResolveRegion(placeId, jobId) {
    try { return await chrome.runtime.sendMessage({ action: 'resolveServerRegion', placeId, jobId }); }
    catch (_) { return null; }
}
// Dolu OLMAYAN (joinable) sunucu havuzu — Asc+Desc, dedupe. Doluluk filtresi yok.
async function popupFetchPool(placeId) {
    const fetchPage = async (order) => {
        try {
            const r = await fetch(`https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=${order}&limit=100`, { credentials: 'omit' });
            if (!r.ok) return [];
            return (await r.json()).data || [];
        } catch (_) { return []; }
    };
    const seen = new Set(), pool = [];
    for (const order of ['Asc', 'Desc']) {
        for (const s of await fetchPage(order)) {
            if (s && s.id && typeof s.playing === 'number' && typeof s.maxPlayers === 'number' && s.playing < s.maxPlayers && !seen.has(s.id)) {
                seen.add(s.id); pool.push(s);
            }
        }
    }
    return pool;
}
// Çeşitli örnekleme: havuzdan eşit aralıklı n aday (sadece baştakiler değil → bölge çeşitliliği).
function popupSample(pool, n) {
    const N = Math.min(n, pool.length);
    if (N >= pool.length) return pool.slice();
    const stride = pool.length / N, out = [];
    for (let i = 0; i < N; i++) out.push(pool[Math.floor(i * stride)]);
    return out;
}

// KATIL → bölgesine EN YAKIN açık sunucuyu bul ve ONA katıl (erken çıkış: kendi bölgen bulununca dur).
async function joinClosestServer(placeId) {
    const geo = await popupGetGeo();
    if (!geo) { joinGame(placeId); return; }                 // konum yok → eski genel katıl
    showToast(TrackedI18n.t('scanning') || 'En yakın sunucu aranıyor…', 'success');
    const pool = await popupFetchPool(placeId);
    if (!pool.length) { joinGame(placeId); return; }
    const nearTarget = (typeof geo.nearestDcKm === 'number') ? Math.round(geo.nearestDcKm * 1.3 + 200) : null;
    const cand = popupSample(pool, 16);
    let best = null;
    for (let i = 0; i < cand.length; i++) {
        const s = cand[i];
        const reg = await popupResolveRegion(placeId, s.id);
        if (reg && reg.ok && reg.region && typeof reg.lat === 'number') {
            const dist = popupHaversine(geo.lat, geo.lon, reg.lat, reg.lon);
            if (!best || dist < best.dist) best = { server: s, region: reg.region, dist };
            if (nearTarget != null && dist <= nearTarget) break;   // kendi bölgen → daha iyisi olamaz
        }
        const wasLive = !(reg && reg.cached);
        if (i < cand.length - 1 && wasLive) await new Promise(r => setTimeout(r, 200));
    }
    if (!best) { joinGame(placeId); return; }                 // hiç çözülemedi → eski katıl
    const deepLink = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${best.server.id}`;
    showToast(`${TrackedI18n.t('launching') || 'Başlatılıyor'} · ${best.region}`, 'success');
    openUrl(deepLink, false);
}

async function scanServers(placeId) {
    if (!ui.modalScanner) {
        console.warn('[Scanner] modal element not found');
        return;
    }
    ui.modalScanner.style.display = 'flex';
    ui.scannerStatus.innerHTML = `${SCAN_SVG_SPIN} ${TrackedI18n.t('scanning')}`;
    ui.scannerList.innerHTML = '';
    
    try {
        const geo = await popupGetGeo();
        const pool = await popupFetchPool(placeId);
        if (!pool.length) {
            ui.scannerStatus.innerHTML = `${SCAN_SVG_WARN} ${TrackedI18n.t('noActiveServer') || 'Aktif sunucu yok'}`;
            return;
        }

        // YENİ SİSTEM: bölgeleri çöz → kullanıcının bölgesine EN YAKIN sırala (doluluk önemsiz).
        const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
        const cand = popupSample(pool, 14);
        const resolved = [];
        for (let i = 0; i < cand.length; i++) {
            ui.scannerStatus.innerHTML = `${SCAN_SVG_SPIN} Bölge çözülüyor ${i + 1}/${cand.length}…`;
            const s = cand[i];
            const reg = await popupResolveRegion(placeId, s.id);
            if (reg && reg.ok && reg.region) {
                const dist = (geo && typeof reg.lat === 'number') ? popupHaversine(geo.lat, geo.lon, reg.lat, reg.lon) : null;
                resolved.push({ server: s, region: reg.region, dist });
            }
            const wasLive = !(reg && reg.cached);
            if (i < cand.length - 1 && wasLive) await new Promise(r => setTimeout(r, 200));
        }

        if (!resolved.length) {
            ui.scannerStatus.innerHTML = `${SCAN_SVG_WARN} Bölge çözülemedi`;
            return;
        }

        resolved.sort((a, b) => (a.dist == null ? 1e9 : a.dist) - (b.dist == null ? 1e9 : b.dist));
        ui.scannerStatus.innerHTML = geo
            ? `${SCAN_SVG_OK} <strong>${resolved.length}</strong> sunucu · en yakın önce`
            : `${SCAN_SVG_OK} <strong>${resolved.length}</strong> sunucu (konum yok — bölge gösteriliyor)`;

        resolved.forEach((item, index) => {
            const { server, region, dist } = item;
            const rank = index + 1;
            const rankColor = rank <= 3 ? RANK_COLORS[rank - 1] : 'var(--text-tertiary)';
            const distTxt = '';
            const flag = (typeof tkFlag === 'function') ? tkFlag(region) : '';

            const row = document.createElement('div');
            row.className = 'server-item';
            row.innerHTML = `
                <div class="server-rank" style="color:${rankColor}">#${rank}</div>
                <div class="server-details">
                    <div class="server-main-row">
                        <span class="server-players">${SCAN_SVG_PEOPLE} ${server.playing}/${server.maxPlayers}</span>
                        <span class="stat-badge" style="color:#30D158;border-color:#30D15840;" title="Bölge: ${region}${distTxt}">${flag}${region}${distTxt}</span>
                    </div>
                </div>
                <button class="server-action-btn join-server" data-place-id="${placeId}" data-job-id="${server.id}">${TrackedI18n.t('join')}</button>
            `;

            const joinBtn = row.querySelector('.join-server');
            joinBtn.addEventListener('click', () => {
                const deepLink = `roblox://experiences/start?placeId=${joinBtn.dataset.placeId}&gameInstanceId=${joinBtn.dataset.jobId}`;
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs.length > 0) {
                        chrome.tabs.update(tabs[0].id, { url: deepLink });
                        joinBtn.textContent = TrackedI18n.t('launching');
                        joinBtn.style.background = 'var(--text-secondary)';
                        setTimeout(() => { joinBtn.textContent = TrackedI18n.t('join'); joinBtn.style.background = ''; }, 3000);
                    } else {
                        showToast(TrackedI18n.t('noActiveTab'), 'error');
                    }
                });
            });

            ui.scannerList.appendChild(row);
        });

    } catch (e) {
        console.error(e);
        ui.scannerStatus.innerHTML = `${SCAN_SVG_ERR} ${TrackedI18n.t('error')}: API`;
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
    const isFast = state.joinStrategy === 'fast';

    if (isFast) {
        // Deep link: tarayıcıyı atla, Roblox client'ı doğrudan başlat
        const deepLink = `roblox://experiences/start?placeId=${placeId}`;
        showToast(TrackedI18n.t('launching'), 'success');
        openUrl(deepLink, false);
    } else {
        openUrl(`https://www.roblox.com/games/${placeId}/`, false);
    }
}

function openUrl(url, newTab) {
    if (newTab) {
        chrome.tabs.create({ url });
    } else {
        // tabId açıkça belirtilmezse yanlış tab güncellenebilir
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                chrome.tabs.update(tabs[0].id, { url });
            } else {
                chrome.tabs.create({ url });
            }
        });
    }
}

// Join the exact server a friend is in (gameId = jobId from presence API)
// Falls back to regular game join if gameId is not available
const TREND_SVG = {
    // Lightning bolt — hızlı yükseliş, enerjik
    '🔥': `<svg width="14" height="14" viewBox="0 0 24 24" fill="#f97316" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    // Yukarı-sağ ok — yükseliyor
    '📈': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>`,
    // Aşağı-sağ ok — düşüyor
    '📉': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="7" x2="17" y2="17"></line><polyline points="17 7 17 17 7 17"></polyline></svg>`,
    // Çift yönlü yatay ok — stabil
    '➡️': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 16 3 12 7 8"></polyline><polyline points="17 8 21 12 17 16"></polyline><line x1="3" y1="12" x2="21" y2="12"></line></svg>`,
};
function getTrendSvg(emoji) { return TREND_SVG[emoji] || ''; }

const BELL_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;

// Etkinlik analizi ikonları
const EVENT_ICON_YES    = `<svg width="52" height="52" viewBox="0 0 24 24" fill="rgba(255,69,58,0.18)" stroke="#FF453A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
const EVENT_ICON_MAYBE  = `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#FF9F0A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="rgba(255,159,10,0.12)"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
const EVENT_ICON_NO     = `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#FF453A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="rgba(255,69,58,0.12)"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

const _SI = (stroke, path) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const SIGNAL_ICONS = {
    'TITLE_DEFINITE':    _SI('#f59e0b', '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'),
    'TITLE_STRONG':      _SI('#fbbf24', '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>'),
    'TEXT_DEFINITE':     _SI('#818cf8', '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline>'),
    'TEXT_STRONG':       _SI('#60a5fa', '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>'),
    'PLAYER_SPIKE':      _SI('#34d399', '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline>'),
    'PLAYER_SPIKE_BIG':  _SI('#10b981', '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline><circle cx="22" cy="7" r="2" fill="#10b981" stroke="none"></circle>'),
    'RECENT_UPDATE':     _SI('#f59e0b', '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'),
    'RECENT_UPDATE_24':  _SI('#d97706', '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'),
    'THUMBNAIL_CHANGE':  _SI('#a78bfa', '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>'),
    'WEEKEND_EVENT_HOUR':_SI('#fb923c', '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>'),
    'SOCIAL_HYPE':       _SI('#38bdf8', '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>'),
};
const SIGNAL_DEFAULT    = `<svg width="15" height="15" viewBox="0 0 24 24" fill="#64748b" stroke="none"><circle cx="12" cy="12" r="5"></circle></svg>`;
const CHART_SVG         = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;
const REFRESH_SVG       = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;

function initMarqueeTitle(el) {
    const inner = el.querySelector('.marquee-inner');
    if (!inner) return;
    let originalHTML = null;

    el.addEventListener('mouseenter', () => {
        const overflow = el.scrollWidth - el.clientWidth;
        if (overflow <= 2) return;

        originalHTML = inner.innerHTML;
        const GAP = 48;
        inner.innerHTML = `<span class="mq-copy">${originalHTML}</span><span class="mq-copy" style="padding-left:${GAP}px">${originalHTML}</span>`;

        const unitWidth = inner.querySelector('.mq-copy').offsetWidth + GAP;
        const duration = Math.max(2.5, unitWidth / 55);
        inner.style.setProperty('--mq-shift', `-${unitWidth}px`);
        inner.style.animationDuration = `${duration.toFixed(1)}s`;
        el.classList.add('marquee-active');
    });

    el.addEventListener('mouseleave', () => {
        el.classList.remove('marquee-active');
        inner.style.removeProperty('--mq-shift');
        inner.style.animationDuration = '';
        if (originalHTML !== null) {
            inner.innerHTML = originalHTML;
            originalHTML = null;
        }
    });
}

function joinFriendServer(placeId, gameId) {
    if (!placeId) return;

    // Auto-Reconnect: SW'ye session kaydet (crash sonrası rejoin için)
    try {
        chrome.runtime.sendMessage({
            action: 'saveActiveSession',
            placeId: String(placeId),
            jobId: gameId ? String(gameId) : null,
            gameTitle: 'Friend\'s Game'
        }, () => { /* fire-and-forget */ });
    } catch (_) {}

    const url = gameId
        ? `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${encodeURIComponent(gameId)}`
        : `https://www.roblox.com/games/${placeId}/`;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.update(tabs[0].id, { url });
        } else {
            chrome.tabs.create({ url });
        }
    });
}

/**
 * PORTAL OVERLAY SYSTEM
 * Prevents z-index clipping by appending to #overlay-root
 */
let activeDropdownTrigger = null;
let globalClickHandler = null;

function openDropdown(triggerEl, items, onSelect) {
    const sc = document.querySelector('.scroll-container');
    if (sc) {
        sc.addEventListener('scroll', closeOverlay, { once: true });
    }
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
    // Pencerenin altına TAŞMASIN: kalan alana sığdır → iç scroll son öğeye kadar tam çalışır.
    const avail = Math.floor(window.innerHeight - rect.bottom - 14);
    dropdown.style.maxHeight = Math.max(140, Math.min(320, avail)) + 'px';

    items.forEach(item => {
        // Grup başlığı (tıklanamaz) — ör. kıta adları
        if (item.header) {
            const h = document.createElement('div');
            h.className = 'dropdown-group-header';
            h.textContent = item.header;
            dropdown.appendChild(h);
            return;
        }
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

    const overlayTarget = ui.overlayRoot || document.body;
    overlayTarget.appendChild(dropdown);

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



/**
 * v1.6.6: RECENT GAMES FEATURE
 */

// Sunucu Bekçisi — aktif canlı izlemeyi popup'ta göster (Son Ziyaret Edilen üstünde), kaldırılabilir.
function renderServerWatch() {
    const panel = document.getElementById('server-watch-panel');
    const card = document.getElementById('watch-live-card');
    if (!panel || !card) return;
    try {
        chrome.runtime.sendMessage({ action: 'getServerWatch' }, (resp) => {
            const w = (resp && resp.ok) ? resp.active : null;
            if (!w || !w.placeId) { panel.style.display = 'none'; card.innerHTML = ''; return; }
            const actLabel = w.action === 'autojoin' ? TrackedI18n.t('watchAutoJoin') : TrackedI18n.t('watchNotify');
            const crit = (w.minPlayers ? `≥${w.minPlayers}${w.maxPlayers > 0 ? '/' + w.maxPlayers : ''} ${TrackedI18n.t('player')}` : `${TrackedI18n.t('watchMaxPlayers')}: ${w.maxPlayers}`)
                + ` · ${actLabel}`;
            card.innerHTML = `
                <div class="watch-live-row">
                    <span class="watch-live-dot"></span>
                    <div class="watch-live-info">
                        <div class="watch-live-name">${escHtml(w.gameTitle || ('Place ' + w.placeId))}</div>
                        <div class="watch-live-crit">${escHtml(crit)}</div>
                    </div>
                    <button class="watch-live-remove" id="watch-live-remove" title="${escHtml(TrackedI18n.t('watchStop'))}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>`;
            panel.style.display = '';
            const rm = card.querySelector('#watch-live-remove');
            if (rm) rm.onclick = () => {
                try { chrome.runtime.sendMessage({ action: 'stopServerWatch' }, () => renderServerWatch()); }
                catch (_) { renderServerWatch(); }
            };
        });
    } catch (_) { panel.style.display = 'none'; }
}

async function loadRecentGames() {
    const container = document.getElementById('recent-games-list');
    if (!container) return;
    
    try {
        const storage = await chrome.storage.local.get(['rota_recent_games', 'rota_favorites']);
        const recentGames = storage.rota_recent_games || [];
        const favorites = storage.rota_favorites || [];
        
        if (recentGames.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon" style="margin-bottom:8px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4"></path><path d="M8 10v4"></path><circle cx="15" cy="13" r="1"></circle><circle cx="18" cy="11" r="1"></circle></svg></div>
                    <div class="empty-desc">${TrackedI18n.t('emptyRecentGames')}</div>
                </div>
            `;
            return;
        }
        
        const gamesToShow = recentGames.slice(0, 10);
        
        // --- ADDED: Fetching Game Icons ---
        const placeIds = gamesToShow.map(g => g.placeId);
        
        // 1. Resolve placeIds to universeIds
        const query = placeIds.map(id => `placeIds=${id}`).join('&');
        const gamesRes = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?${query}`, { credentials: 'include' });
        if (!gamesRes.ok) throw new Error('API failed');
        const gamesData = await gamesRes.json();

        // Build ID maps — API order is not guaranteed
        const universeToPlace = {};
        const nameMap = {};
        gamesData.forEach(d => {
            if (d.universeId && d.placeId) universeToPlace[d.universeId] = d.placeId;
            if (d.placeId && d.name) nameMap[d.placeId] = d.name;
        });
        const universeIds = Object.keys(universeToPlace);

        // 2. Fetch icons for the universeIds
        const iconsRes = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`);
        if (!iconsRes.ok) throw new Error('API failed');
        const iconsData = await iconsRes.json();

        const iconMap = {}; // Maps placeId to imageUrl
        if (iconsData && iconsData.data) {
            iconsData.data.forEach((iconInfo) => {
                const placeId = universeToPlace[iconInfo.targetId];
                if (placeId) iconMap[placeId] = iconInfo.imageUrl;
            });
        }
        
        container.innerHTML = gamesToShow.map(game => {
            const isAdded = favorites.some(f => String(f.placeId) === String(game.placeId));
            const timeAgo = getTimeAgo(game.timestamp);
            const checkIcon = '<polyline points="20 6 9 17 4 12"></polyline>';
            const plusIcon = '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>';
            
            const iconUrl = iconMap[game.placeId];
            const displayTitle = nameMap[game.placeId] || game.title;
            const iconHtml = iconUrl
                ? `<img src="${iconUrl}" class="recent-game-icon-img" alt="${escapeHtml(displayTitle)}">`
                : `<div class="recent-game-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M6 12h4"></path><path d="M8 10v4"></path><circle cx="15" cy="13" r="1"></circle><circle cx="18" cy="11" r="1"></circle></svg></div>`;

            return `
                <div class="recent-game-item" data-place-id="${game.placeId}" data-url="${game.url}">
                    ${iconHtml}
                    <div class="recent-game-info" style="flex:1;">
                        <div class="recent-game-title">${escapeHtml(displayTitle)}</div>
                        <div class="recent-game-time">${timeAgo}</div>
                    </div>
                    <button class="pill-btn primary btn-join-small" data-place-id="${game.placeId}" style="margin-right:8px; padding:4px 12px; font-size:11px; height:auto; min-height:24px;">${TrackedI18n.t('join')}</button>
                    <button class="recent-game-add ${isAdded ? 'added' : ''}" data-place-id="${game.placeId}" title="${TrackedI18n.t(isAdded ? 'inLibrary' : 'addToLibrary')}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            ${isAdded ? checkIcon : plusIcon}
                        </svg>
                    </button>
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.recent-game-item').forEach(item => {
            item.querySelector('.btn-join-small')?.addEventListener('click', () => {
                joinGame(item.dataset.placeId);
            });
        });
        
        container.querySelectorAll('.recent-game-add:not(.added)').forEach(btn => {
            btn.addEventListener('click', async () => {
                const placeId = btn.dataset.placeId;
                const game = recentGames.find(g => String(g.placeId) === placeId);
                if (game) {
                    await addRecentGameToFavorites(game);
                    btn.classList.add('added');
                    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                    btn.title = TrackedI18n.t('inLibrary');
                }
            });
        });
        
    } catch (err) {
        const isNetworkBlock = err && (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError'));
        if (!isNetworkBlock) {
            // Sadece gerçek hatalar — ad-blocker engelleri sessizce geçer
            console.error('[Recent Games] Load error:', err);
        }
    }
}

async function addRecentGameToFavorites(game) {
    try {
        const storage = await chrome.storage.local.get('rota_favorites');
        const favorites = storage.rota_favorites || [];
        
        if (favorites.some(f => String(f.placeId) === String(game.placeId))) {
            return;
        }
        
        favorites.push({
            placeId: game.placeId,
            title: game.title,
            thumbnail: `https://assetgame.roblox.com/Game/Tools/ThumbnailAsset.ashx?aid=${game.placeId}&fmt=png&wd=150&ht=150`
        });
        
        await safeStorageSet({ [STORAGE_KEYS.FAVORITES]: favorites });
        
        if (typeof renderLibrary === 'function') {
            renderLibrary();
        }
        showToast('Oyun kütüphaneye eklendi', 'success');
    } catch (err) {
        console.error('[Recent Games] Add to favorites error:', err);
    }
}

async function clearRecentGames() {
    try {
        await chrome.storage.local.remove('rota_recent_games');
        loadRecentGames();
        showToast('Geçmiş temizlendi', 'success');
    } catch (err) {
        console.error('[Recent Games] Clear error:', err);
    }
}

function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return TrackedI18n.t('justNow');
    if (seconds < 3600) return Math.floor(seconds / 60) + ' ' + TrackedI18n.t('minutesAgo');
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' ' + TrackedI18n.t('hoursAgo');
    return Math.floor(seconds / 86400) + ' ' + TrackedI18n.t('daysAgo');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


/**
 * FRIENDS MODULE (Stale-While-Revalidate)
 * Cached HTML anında render edilir → user 0ms gecikme algılar.
 * Arka planda fresh fetch yapılır, gelince DOM güncellenir.
 */
function rebindFriendClickHandlers(container) {
    container.querySelectorAll('.btn-join-small[data-place-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            joinFriendServer(btn.dataset.placeId, btn.dataset.gameId || null);
        });
    });
    container.querySelectorAll('.recent-game-meta').forEach(el => {
        try { initMarqueeTitle(el); } catch (_) {}
    });
}

// Friends/presence fetch — 429 (rate-limit) ve 5xx/network hatasında backoff'lu retry.
// Uzun boşta + avatar sekmesi açıkken Roblox API'leri throttle ediyor; retry'siz tek hata
// panel'i boş bırakıyordu (bug: 1 saat sonra arkadaşlar boş, F5 düzeltmiyor).
async function fetchFriendsRetry(url, opts, tries = 3) {
    let r = null;
    for (let i = 0; i < tries; i++) {
        try { r = await fetch(url, opts); }
        catch (e) { if (i === tries - 1) throw e; await new Promise(s => setTimeout(s, 700 * (i + 1))); continue; }
        if (r.ok || ![429, 500, 502, 503].includes(r.status)) return r;
        await new Promise(s => setTimeout(s, 700 * (i + 1)));
    }
    return r;
}

// Avatar resimlerini render ÖNCESİ decode et → tüm kartlar aynı anda (dümdüz) görünür,
// tek tek "pat" diye belirmez. Her resme timeout; biri yavaşsa toplam render'ı kilitlemez.
function preloadImages(urls, timeoutMs = 1500) {
    const list = (urls || []).filter(Boolean);
    if (list.length === 0) return Promise.resolve();
    return Promise.all(list.map(url => new Promise((resolve) => {
        const img = new Image();
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        const t = setTimeout(finish, timeoutMs);
        img.onload = img.onerror = () => { clearTimeout(t); finish(); };
        img.src = url;
    })));
}

// Liste tek blok hâlinde yumuşak belirir (kart-kart değil). Reflow ile animasyonu yeniden tetikler.
function applyListFadeIn(el) {
    if (!el) return;
    el.classList.remove('friends-fade-in');
    void el.offsetWidth;
    el.classList.add('friends-fade-in');
}

async function loadFriends() {
    const container = document.getElementById('friends-list');
    if (!container) return;

    // 1) CACHE HIT — fresh fetch beklerken anında göster (60sn TTL)
    let cacheRendered = false;
    try {
        const stored = await chrome.storage.local.get('rota_friends_cache');
        const cache = stored.rota_friends_cache;
        if (cache?.html && cache?.timestamp && (Date.now() - cache.timestamp < 60 * 1000)) {
            container.innerHTML = cache.html;
            rebindFriendClickHandlers(container);
            applyListFadeIn(container); // popup açılışında liste tek blok yumuşak belirir
            // Header text'i de restore et
            const headerSpan = document.querySelector('#friends-panel .module-header h2 span');
            if (headerSpan && cache.headerText) headerSpan.textContent = cache.headerText;
            cacheRendered = true;
        }
    } catch (_) {}

    // 2) Loading state SADECE cache yoksa göster
    if (!cacheRendered) {
        container.innerHTML = '<div class="empty-state"><div class="spinner" style="width:16px;height:16px;border-width:2px;"></div></div>';
    }

    try {
        // 1. Get authenticated user ID
        const userRes = await fetch('https://users.roblox.com/v1/users/authenticated', { credentials: 'include' });
        if (!userRes.ok) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon" style="margin-bottom:8px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line></svg></div><div class="empty-desc">${TrackedI18n.t('friendsNotLoggedIn')}</div></div>`;
            return;
        }
        const userData = await userRes.json();
        const userId = userData.id;

        const friendsListRes = await fetchFriendsRetry(`https://friends.roblox.com/v1/users/${userId}/friends`, { credentials: 'include' });
        if (!friendsListRes.ok) throw new Error('API failed');
        const friendsData = await friendsListRes.json();

        if (!friendsData.data || friendsData.data.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-desc">${TrackedI18n.t('noFriends')}</div></div>`;
            return;
        }

        const friendIds = friendsData.data.map(f => f.id);

        // 2. Get Presence (requires CSRF token)
        const getPresence = async (extraHeaders = {}) => fetchFriendsRetry('https://presence.roblox.com/v1/presence/users', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...extraHeaders },
            body: JSON.stringify({ userIds: friendIds })
        });

        let presenceRes = await getPresence();

        // Handle CSRF Token Challenge
        if (presenceRes.status === 403 && presenceRes.headers.has('x-csrf-token')) {
            presenceRes = await getPresence({ 'x-csrf-token': presenceRes.headers.get('x-csrf-token') });
        }
        
        if (!presenceRes.ok) throw new Error('Presence API failed: ' + presenceRes.status);
        const presenceData = await presenceRes.json();
        
        const onlinePresences = presenceData.userPresences.filter(p => p.userPresenceType === 2); // 2 = InGame

        // Online count badge in header
        const friendsHeader = document.querySelector('#friends-panel .module-header h2 span');
        if (friendsHeader) {
            friendsHeader.textContent = onlinePresences.length > 0
                ? `${TrackedI18n.t('friendsOnline') || 'Arkadaşlar'} (${onlinePresences.length})`
                : TrackedI18n.t('friendsOnline') || 'Arkadaşlar';
        }

        if (onlinePresences.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon" style="margin-bottom:8px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></div><div class="empty-desc">${TrackedI18n.t('friendsEmpty')}</div></div>`;
            return;
        }

        // 3. Get Avatars for online friends
        const onlineIds = onlinePresences.map(p => p.userId);
        const avatarRes = await fetchFriendsRetry(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${onlineIds.join(',')}&size=150x150&format=Png&isCircular=true`);
        if (!avatarRes.ok) throw new Error('API failed');
        const avatarData = await avatarRes.json();
        const avatarMap = {};
        // Roblox thumbnails on-demand üretilir; cache'de olmayan avatar ilk istekte
        // state:"Pending" + imageUrl:null döner. Bu ID'leri ayrı topla, ileride retry et.
        const pendingIds = [];
        if (avatarData && avatarData.data) {
            avatarData.data.forEach(a => {
                if (a.state === 'Completed' && a.imageUrl) {
                    avatarMap[a.targetId] = a.imageUrl;
                } else {
                    // Pending / Blocked / TemporarilyUnavailable — retry kandidatı
                    pendingIds.push(a.targetId);
                }
            });
        }

        // Avatarları render ÖNCESİ decode et → kartlar tek tek değil, tek blok belirir
        await preloadImages(Object.values(avatarMap));

        // Eksik isimleri ÖNCE paralel çöz. (Eskiden bu fetch döngü İÇİNDE await ediliyordu →
        // her eksik isimde render serileşip kartlar tek tek beliriyordu.) Artık döngü tamamen senkron.
        const nameFixes = {};
        const missingName = onlinePresences.filter(p => {
            const fi = friendsData.data.find(f => f.id === p.userId);
            return !fi || !fi.name;
        });
        if (missingName.length > 0) {
            await Promise.all(missingName.map(async (p) => {
                try {
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), 3000); // 3sn timeout
                    const r = await fetch(`https://users.roblox.com/v1/users/${p.userId}`, { signal: ctrl.signal, credentials: 'omit' });
                    clearTimeout(t);
                    if (r.ok) { const d = await r.json(); nameFixes[p.userId] = { name: d.name || '', displayName: d.displayName || '' }; }
                } catch (_) {
                    // Ad-blocker/network — sessizce geç; mevcut isimle (ya da "unknown") devam ederiz.
                }
            }));
        }

        // 4. Map back to friend data and render — TEK SEFERDE (DocumentFragment → tek paint, dümdüz görünüm)
        const frag = document.createDocumentFragment();

        for (const presence of onlinePresences) {
            const friendInfo = friendsData.data.find(f => f.id === presence.userId);
            const fix = nameFixes[presence.userId];
            const name = (friendInfo && friendInfo.displayName) || (fix && fix.displayName) || TrackedI18n.t('unknown');
            const realName = (friendInfo && friendInfo.name) || (fix && fix.name) || '';

            const avatarUrl = avatarMap[presence.userId] || '';
            const initial = name.charAt(0).toUpperCase();

            const avatarHtml = avatarUrl
                ? `<img src="${avatarUrl}" class="friend-avatar-img" alt="${name}" data-uid="${presence.userId}">`
                : `<div class="friend-avatar-img fallback" data-uid="${presence.userId}" style="background:var(--card-hover);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--text-primary);">${initial}</div>`;

            const gameName = presence.lastLocation || '';
            const gameLabel = gameName ? escapeHtml(gameName) : TrackedI18n.t('inGame') || 'In Game';
            // gameId = specific server jobId — lets us join the exact server the friend is in
            const friendGameId = presence.gameId || null;
            const joinLabel = TrackedI18n.t('join');
            const joinTitle = TrackedI18n.t(friendGameId ? 'joinSameServerTip' : 'joinGameTip');

            const item = document.createElement('div');
            item.className = 'recent-game-item';
            item.innerHTML = `
                ${avatarHtml}
                <div class="recent-game-info" style="flex:1;min-width:0;">
                    <div class="recent-game-title">${escapeHtml(name)}</div>
                    <div class="recent-game-meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(gameName)}"><span class="marquee-inner">@${escapeHtml(realName)} • ${gameLabel}</span></div>
                </div>
                <button class="pill-btn primary btn-join-small" title="${joinTitle}" style="margin-right:8px; padding:4px 12px; font-size:11px; height:auto; min-height:24px;flex-shrink:0;">${joinLabel}</button>
            `;

            const joinBtn = item.querySelector('.btn-join-small');
            // data attr'lar cache restore sonrası rebind için
            joinBtn.dataset.placeId = String(presence.placeId);
            if (friendGameId) joinBtn.dataset.gameId = String(friendGameId);
            joinBtn.addEventListener('click', () => {
                joinFriendServer(joinBtn.dataset.placeId, joinBtn.dataset.gameId || null);
            });

            initMarqueeTitle(item.querySelector('.recent-game-meta'));
            frag.appendChild(item);
        }

        // Tüm kartları TEK operasyonda DOM'a bas → aynı frame'de, sıralı/kart-kart değil.
        container.innerHTML = '';
        container.appendChild(frag);
        // Cache zaten gösterildiyse sessiz güncelle; ilk görünümse tek blok yumuşak belir.
        if (!cacheRendered) applyListFadeIn(container);

        // RETRY: Pending thumbnail'leri 1.5sn sonra tekrar dene. Roblox bu süre
        // içinde avatar render'ı tamamlar; fallback initial harfler asıl resimlerle
        // değiştirilir. Tek-shot retry — başarısız olursa fallback kalır.
        if (pendingIds.length > 0) {
            setTimeout(async () => {
                try {
                    const retryRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${pendingIds.join(',')}&size=150x150&format=Png&isCircular=true`);
                    if (!retryRes.ok) return;
                    const retryData = await retryRes.json();
                    if (!retryData?.data) return;

                    let replacedAny = false;
                    retryData.data.forEach(a => {
                        if (a.state !== 'Completed' || !a.imageUrl) return;
                        const target = container.querySelector(`[data-uid="${a.targetId}"]`);
                        if (!target) return;
                        // Fallback div'i img ile değiştir (zaten img ise URL'i güncelle)
                        if (target.tagName === 'IMG') {
                            target.src = a.imageUrl;
                        } else {
                            const img = document.createElement('img');
                            img.src = a.imageUrl;
                            img.className = 'friend-avatar-img avatar-late';
                            img.alt = target.getAttribute('alt') || '';
                            img.setAttribute('data-uid', String(a.targetId));
                            target.replaceWith(img);
                        }
                        replacedAny = true;
                    });

                    // Cache'i de güncelle ki bir sonraki popup açılışında resimler hazır görünsün
                    if (replacedAny) {
                        try {
                            const headerSpan = document.querySelector('#friends-panel .module-header h2 span');
                            chrome.storage.local.set({
                                rota_friends_cache: {
                                    html: container.innerHTML,
                                    headerText: headerSpan ? headerSpan.textContent : '',
                                    timestamp: Date.now()
                                }
                            }).catch(() => {});
                        } catch (_) {}
                    }
                } catch (_) { /* sessiz fail — fallback'ler kalır */ }
            }, 1500);
        }

        // CACHE SAVE — fresh render başarılı, sonraki popup açılışında anında göster
        try {
            const headerSpan = document.querySelector('#friends-panel .module-header h2 span');
            chrome.storage.local.set({
                rota_friends_cache: {
                    html: container.innerHTML,
                    headerText: headerSpan ? headerSpan.textContent : '',
                    timestamp: Date.now()
                }
            }).catch(() => {});
        } catch (_) {}

    } catch (err) {
        // "Failed to fetch" → genellikle ad-blocker (uBlock, AdBlock) Roblox API'lerini blocklar.
        // Bu beklenen bir durum, console'da error değil warn olarak göster.
        const isNetworkBlock = err && (
            err.message?.includes('Failed to fetch') ||
            err.message?.includes('NetworkError') ||
            err.message?.includes('ERR_BLOCKED')
        );
        // Cache zaten render edildiyse, hata durumunda eski veriyi koru (stale-but-better-than-nothing)
        if (cacheRendered) return;

        if (isNetworkBlock) {
            // Sessizce geç — UI'da kullanıcıya empty state gösteriliyor
            container.innerHTML = `<div class="empty-state"><div class="empty-desc" style="color:var(--text-secondary);font-size:12px">${TrackedI18n.t('adBlockerBlocked') || 'Ad-blocker Roblox API\'sini engelliyor'}</div></div>`;
        } else {
            console.error('[Friends Module] Error:', err);
            container.innerHTML = `<div class="empty-state"><div class="empty-desc" style="color:var(--status-bad)">${TrackedI18n.t('loadError')}</div></div>`;
        }
    }
}
