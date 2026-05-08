// options.js - Tracked Extension v3.8 - Enhanced Settings UI

const DEFAULT_SETTINGS = {
    timeoutMs: 3000,
    cacheMinutes: 10,
    openInNewTab: false,
    appendRegionParam: false,
    silentMode: false,
    reducedMotion: false,
    language: 'tr',
    // Performance / A+B / C+D defaults
    blockTarget: 100,
    propagationSeconds: 15,
    useFingerprint: true,
    friendsExpansion: true,
    aggressiveSnipe: false,
    // Auto-Reconnect
    autoReconnectEnabled: true,
    autoReconnectNative: false,
    probes: {
        "Almanya (DE)": "https://s3.eu-central-1.amazonaws.com",
        "Hollanda (NL)": "https://s3.eu-west-1.amazonaws.com",
        "Fransa (FR)": "https://s3.eu-west-3.amazonaws.com",
        "Polonya (PL)": "https://s3.eu-north-1.amazonaws.com",
        "Romanya (RO)": "https://s3.eu-south-1.amazonaws.com"
    }
};

const ui = {
    // Connection
    inpTimeout: document.getElementById('inp-timeout'),
    inpCache: document.getElementById('inp-cache'),
    chkNewTab: document.getElementById('chk-newtab'),
    chkAppendParam: document.getElementById('chk-appendparam'),
    // Appearance
    chkSilent: document.getElementById('chk-silent'),
    chkReducedMotion: document.getElementById('chk-reduced-motion'),
    // Performance
    inpBlockTarget: document.getElementById('inp-block-target'),
    inpPropagation: document.getElementById('inp-propagation'),
    chkFingerprint: document.getElementById('chk-fingerprint'),
    chkFriendsExpansion: document.getElementById('chk-friends-expansion'),
    chkAggressiveSnipe: document.getElementById('chk-aggressive-snipe'),
    // Auto-Reconnect
    chkAutoReconnect: document.getElementById('chk-auto-reconnect'),
    chkAutoReconnectNative: document.getElementById('chk-auto-reconnect-native'),
    // Language
    selLanguage: document.getElementById('sel-language'),
    langCurrentBtn: document.getElementById('lang-current-btn'),
    langDropdown: document.getElementById('lang-dropdown'),
    currentFlag: document.getElementById('current-lang-code'),
    currentLangName: document.getElementById('current-lang-name'),
    // Probes
    probeList: document.getElementById('probe-list'),
    btnAddProbe: document.getElementById('btn-add-probe'),
    btnTestAllProbes: document.getElementById('btn-test-all-probes'),
    // Diagnostics
    diagFavorites: document.getElementById('diag-favorites'),
    diagCacheSize: document.getElementById('diag-cache-size'),
    diagVersion: document.getElementById('diag-version'),
    diagBaseline: document.getElementById('diag-baseline'),
    btnExport: document.getElementById('btn-export'),
    fileImport: document.getElementById('file-import'),
    // Actions
    btnSave: document.getElementById('btn-save'),
    btnReset: document.getElementById('btn-reset'),
    btnClearFavs: document.getElementById('btn-clear-favs'),
    btnClearCache: document.getElementById('btn-clear-cache'),
    toastContainer: document.getElementById('toast-container'),
    unsavedIndicator: document.getElementById('unsaved-indicator'),
    actionsFooter: document.getElementById('actions-footer'),
    // Layout
    versionPill: document.getElementById('version-pill'),
    footerVersion: document.getElementById('footer-version'),
    tocLinks: document.querySelectorAll('.toc-link'),
};

let hasChanges = false;
let currentSettings = { ...DEFAULT_SETTINGS };

document.addEventListener('DOMContentLoaded', async () => {
    loadVersionInfo();
    await loadSettings();
    setupStepperControls();
    setupSmartLanguageSelector();
    setupKeyboardShortcuts();
    setupScrollSpy();
    setupProbeActions();
    setupDataActions();
    applyTranslations();
    loadDiagnostics();
    clearUnsaved();
});

ui.btnSave?.addEventListener('click', saveSettings);
ui.btnReset?.addEventListener('click', restoreDefaults);
ui.btnClearFavs?.addEventListener('click', clearFavorites);
ui.btnClearCache?.addEventListener('click', clearCache);

// Change listeners (everything that affects settings)
[
    ui.inpTimeout, ui.inpCache, ui.chkNewTab, ui.chkAppendParam,
    ui.chkSilent, ui.chkReducedMotion, ui.selLanguage,
    ui.inpBlockTarget, ui.inpPropagation,
    ui.chkFingerprint, ui.chkFriendsExpansion, ui.chkAggressiveSnipe,
    ui.chkAutoReconnect, ui.chkAutoReconnectNative
].forEach(el => {
    if (el) {
        el.addEventListener('change', markUnsaved);
        el.addEventListener('input', markUnsaved);
    }
});

// ── Version info from manifest ──
function loadVersionInfo() {
    try {
        const manifest = chrome.runtime.getManifest();
        const v = `v${manifest.version}`;
        if (ui.versionPill) ui.versionPill.textContent = v;
        if (ui.footerVersion) ui.footerVersion.textContent = `Tracked ${v}`;
        if (ui.diagVersion) ui.diagVersion.textContent = v;
    } catch (e) {
        console.warn('[Options] Could not load version:', e);
    }
}

// ── i18n ──
function applyTranslations() {
    if (typeof TrackedI18n === 'undefined') return;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            const translation = TrackedI18n.t(key);
            if (translation && translation !== key) {
                // Preserve nested SVG/badge children: if textContent only update
                if (el.children.length === 0) {
                    el.textContent = translation;
                } else {
                    // Replace text-only span content
                    const txt = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
                    if (txt) txt.nodeValue = translation;
                }
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.placeholder = TrackedI18n.t(key);
    });
}

// ── Unsaved state ──
function markUnsaved() {
    hasChanges = true;
    ui.actionsFooter?.classList.remove('no-changes');
    if (ui.btnSave) ui.btnSave.textContent = TrackedI18n.t('saveSettings') + ' *';
}

function clearUnsaved() {
    hasChanges = false;
    ui.actionsFooter?.classList.add('no-changes');
    if (ui.btnSave) ui.btnSave.textContent = TrackedI18n.t('saveSettings');
}

// ── Steppers ──
function setupStepperControls() {
    document.querySelectorAll('.step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const group = btn.closest('.metric-input-group');
            const input = group?.querySelector('input[type="number"]');
            if (!input) return;

            const action = btn.dataset.action;
            let val = parseInt(input.value) || 0;
            const step = parseInt(input.getAttribute('step')) || 1;
            const min = parseInt(input.getAttribute('min'));
            const max = parseInt(input.getAttribute('max'));

            val = action === 'inc' ? val + step : val - step;
            if (!isNaN(min) && val < min) val = min;
            if (!isNaN(max) && val > max) val = max;

            input.value = val;
            input.dispatchEvent(new Event('input'));
        });
    });
}

// ── Smart Language Selector ──
function setupSmartLanguageSelector() {
    if (!ui.langCurrentBtn || !ui.langDropdown) return;

    ui.langCurrentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.langCurrentBtn.classList.toggle('active');
        ui.langDropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        ui.langCurrentBtn.classList.remove('active');
        ui.langDropdown.classList.remove('show');
    });

    document.querySelectorAll('.lang-option').forEach(option => {
        option.addEventListener('click', () => {
            const selectedLang = option.dataset.lang;
            updateLanguageDisplay(selectedLang);
            if (ui.selLanguage) {
                ui.selLanguage.value = selectedLang;
                ui.selLanguage.dispatchEvent(new Event('change'));
            }
        });
    });
}

function updateLanguageDisplay(lang) {
    const langMap = {
        'tr': { code: 'TR', name: 'Türkçe' },
        'en': { code: 'GB', name: 'English' }
    };
    const info = langMap[lang];
    if (!info) return;
    if (ui.currentFlag) ui.currentFlag.textContent = info.code;
    if (ui.currentLangName) ui.currentLangName.textContent = info.name;

    document.querySelectorAll('.lang-option').forEach(option => {
        option.classList.toggle('hidden', option.dataset.lang === lang);
    });
}

// ── Keyboard shortcuts ──
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S → save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (hasChanges) saveSettings();
            else showToast(TrackedI18n.t('alreadySaved') || 'Zaten kayıtlı', 'warn');
        }
        // Esc → close lang dropdown
        if (e.key === 'Escape') {
            ui.langCurrentBtn?.classList.remove('active');
            ui.langDropdown?.classList.remove('show');
        }
    });
}

// ── Scroll spy: section vurgulayıcı ──
function setupScrollSpy() {
    const sections = ['sec-appearance', 'sec-connection', 'sec-performance', 'sec-probes', 'sec-diagnostics', 'sec-data']
        .map(id => document.getElementById(id))
        .filter(Boolean);

    if (sections.length === 0 || !ui.tocLinks.length) return;

    // Smooth scroll on TOC click
    ui.tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(link.dataset.target);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // Observer for active link
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                ui.tocLinks.forEach(link => {
                    link.classList.toggle('active', link.dataset.target === id);
                });
            }
        });
    }, {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
    });

    sections.forEach(s => observer.observe(s));
}

// ── Settings load/save ──
async function loadSettings() {
    const data = await chrome.storage.local.get('rota_settings');
    const settings = { ...DEFAULT_SETTINGS, ...(data.rota_settings || {}) };

    // Migrate Google→AWS probe URLs
    if (settings.probes) {
        const googleToAws = {
            'www.google.de': 's3.eu-central-1.amazonaws.com',
            'www.google.nl': 's3.eu-west-1.amazonaws.com',
            'www.google.fr': 's3.eu-west-3.amazonaws.com',
            'www.google.pl': 's3.eu-north-1.amazonaws.com',
            'www.google.ro': 's3.eu-south-1.amazonaws.com',
        };
        let migrated = false;
        Object.keys(settings.probes).forEach(key => {
            const url = settings.probes[key];
            for (const [g, a] of Object.entries(googleToAws)) {
                if (url.includes(g)) {
                    settings.probes[key] = `https://${a}`;
                    migrated = true;
                    break;
                }
            }
        });
        if (migrated) await chrome.storage.local.set({ rota_settings: settings });
    }

    if (settings.language && typeof TrackedI18n !== 'undefined') {
        TrackedI18n.setLocale(settings.language);
    }

    currentSettings = settings;

    // Apply to UI
    if (ui.inpTimeout) ui.inpTimeout.value = settings.timeoutMs;
    if (ui.inpCache) ui.inpCache.value = settings.cacheMinutes;
    if (ui.chkNewTab) ui.chkNewTab.checked = settings.openInNewTab;
    if (ui.chkAppendParam) ui.chkAppendParam.checked = settings.appendRegionParam;
    if (ui.chkSilent) ui.chkSilent.checked = settings.silentMode === true;
    if (ui.chkReducedMotion) {
        ui.chkReducedMotion.checked = settings.reducedMotion === true;
        document.body.classList.toggle('reduced-motion', settings.reducedMotion === true);
    }
    if (ui.inpBlockTarget) ui.inpBlockTarget.value = settings.blockTarget ?? 100;
    if (ui.inpPropagation) ui.inpPropagation.value = settings.propagationSeconds ?? 15;
    if (ui.chkFingerprint) ui.chkFingerprint.checked = settings.useFingerprint !== false;
    if (ui.chkFriendsExpansion) ui.chkFriendsExpansion.checked = settings.friendsExpansion !== false;
    if (ui.chkAggressiveSnipe) ui.chkAggressiveSnipe.checked = settings.aggressiveSnipe === true;
    if (ui.chkAutoReconnect) ui.chkAutoReconnect.checked = settings.autoReconnectEnabled !== false;
    if (ui.chkAutoReconnectNative) ui.chkAutoReconnectNative.checked = settings.autoReconnectNative === true;
    if (ui.selLanguage) ui.selLanguage.value = settings.language || 'tr';

    updateLanguageDisplay(settings.language || 'tr');
    renderProbes(settings.probes);
}

function renderProbes(userProbes) {
    if (!ui.probeList) return;
    ui.probeList.innerHTML = '';

    const countryCodeMap = {
        'Almanya (DE)': 'DE',
        'Hollanda (NL)': 'NL',
        'Fransa (FR)': 'FR',
        'Polonya (PL)': 'PL',
        'Romanya (RO)': 'RO'
    };

    // Probe sırası: defaultlar önce, kullanıcının eklediği customlar sonra
    const orderedKeys = [
        ...Object.keys(DEFAULT_SETTINGS.probes),
        ...Object.keys(userProbes).filter(k => !(k in DEFAULT_SETTINGS.probes))
    ];

    orderedKeys.forEach(regionName => {
        const userUrl = userProbes[regionName] ?? DEFAULT_SETTINGS.probes[regionName] ?? '';
        const isDefault = regionName in DEFAULT_SETTINGS.probes;
        const code = countryCodeMap[regionName] || regionName.match(/\(([A-Z]+)\)/)?.[1] || '';

        let displayName = regionName;
        if (code && typeof TrackedI18n !== 'undefined') {
            const tr = TrackedI18n.t('country' + code);
            if (tr && tr !== 'country' + code) displayName = `${tr} (${code})`;
        }

        const row = document.createElement('div');
        row.className = 'probe-row';
        row.dataset.region = regionName;

        // SVG icons inline (htm escaped)
        const flagSpan = code ? `<span class="probe-flag">${escapeHtml(code)}</span>` : '';
        const removeBtn = !isDefault ? `<button class="btn-icon danger" title="${TrackedI18n.t('remove') || 'Sil'}" data-action="remove-row" type="button"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>` : '';

        row.innerHTML = `
            <div class="probe-label-container">
                ${flagSpan}
                <span class="probe-name-static">${escapeHtml(displayName)}</span>
            </div>
            <input type="text" class="probe-url-input" value="${escapeAttr(userUrl)}" placeholder="https://..." spellcheck="false">
            <span class="probe-result idle" data-result>—</span>
            <button class="btn-icon-test" title="${TrackedI18n.t('testProbe') || 'Test'}" data-action="test-row" type="button">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <button class="btn-icon" title="${TrackedI18n.t('resetToDefault') || 'Varsayılana Dön'}" data-action="reset-row" type="button">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6M21.5 22v-6h-6"/><path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/></svg>
            </button>
            ${removeBtn}
        `;

        const input = row.querySelector('.probe-url-input');
        input.addEventListener('input', markUnsaved);

        row.querySelector('[data-action="reset-row"]').addEventListener('click', () => {
            input.value = DEFAULT_SETTINGS.probes[regionName] || '';
            markUnsaved();
            showToast(`${displayName} ${TrackedI18n.t('resetToDefault') || 'sıfırlandı'}`, 'success');
        });

        row.querySelector('[data-action="test-row"]').addEventListener('click', () => {
            testProbeRow(row);
        });

        const remBtn = row.querySelector('[data-action="remove-row"]');
        if (remBtn) {
            remBtn.addEventListener('click', () => {
                row.remove();
                markUnsaved();
                showToast(`${displayName} ${TrackedI18n.t('removed') || 'kaldırıldı'}`, 'warn');
            });
        }

        ui.probeList.appendChild(row);
    });
}

// ── Probe live ping test ──
async function testProbeRow(row) {
    const input = row.querySelector('.probe-url-input');
    const resultEl = row.querySelector('[data-result]');
    const testBtn = row.querySelector('[data-action="test-row"]');
    const url = (input?.value || '').trim();

    if (!url) {
        showToast(TrackedI18n.t('emptyUrl') || 'URL boş', 'error');
        return;
    }

    resultEl.className = 'probe-result loading';
    resultEl.textContent = '...';
    testBtn.classList.add('testing');

    try {
        const startTime = performance.now();
        // HEAD ile dene; CORS engellerse no-cors'a düş (süre yine ölçülür)
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 5000);

        try {
            await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
        } finally {
            clearTimeout(timeoutId);
        }

        const elapsed = Math.round(performance.now() - startTime);
        let cls = 'good';
        if (elapsed > 200) cls = 'warn';
        if (elapsed > 400) cls = 'bad';

        resultEl.className = `probe-result ${cls}`;
        resultEl.textContent = `${elapsed} ms`;
    } catch (e) {
        resultEl.className = 'probe-result bad';
        resultEl.textContent = e.name === 'AbortError' ? 'timeout' : 'fail';
    } finally {
        testBtn.classList.remove('testing');
    }
}

function setupProbeActions() {
    ui.btnAddProbe?.addEventListener('click', () => {
        const name = prompt(TrackedI18n.t('promptProbeName') || 'Yeni prob için bölge adı (ör. "Türkiye (TR)"):');
        if (!name || !name.trim()) return;
        const url = prompt(TrackedI18n.t('promptProbeUrl') || 'Test URL (https://...):', 'https://');
        if (!url || !url.trim()) return;

        const probes = collectProbes();
        probes[name.trim()] = url.trim();
        renderProbes(probes);
        markUnsaved();
        showToast(`${name} ${TrackedI18n.t('added') || 'eklendi'}`, 'success');
    });

    ui.btnTestAllProbes?.addEventListener('click', async () => {
        const rows = ui.probeList.querySelectorAll('.probe-row');
        showToast(`${rows.length} prob test ediliyor...`, 'success');
        for (const row of rows) {
            await testProbeRow(row);
            await new Promise(r => setTimeout(r, 200));
        }
    });
}

function collectProbes() {
    const probes = {};
    if (!ui.probeList) return probes;
    ui.probeList.querySelectorAll('.probe-row').forEach(row => {
        const region = row.dataset.region;
        const url = row.querySelector('.probe-url-input')?.value.trim();
        if (region && url) probes[region] = url;
    });
    return probes;
}

// ── Save / Reset ──
async function saveSettings() {
    const newProbes = collectProbes();
    const selectedLanguage = ui.selLanguage ? ui.selLanguage.value : 'tr';

    if (typeof TrackedI18n !== 'undefined') {
        TrackedI18n.setLocale(selectedLanguage);
    }

    const newSettings = {
        timeoutMs: parseInt(ui.inpTimeout?.value) || 3000,
        cacheMinutes: parseInt(ui.inpCache?.value) || 10,
        openInNewTab: !!ui.chkNewTab?.checked,
        appendRegionParam: !!ui.chkAppendParam?.checked,
        silentMode: !!ui.chkSilent?.checked,
        reducedMotion: !!ui.chkReducedMotion?.checked,
        language: selectedLanguage,
        blockTarget: parseInt(ui.inpBlockTarget?.value) || 100,
        propagationSeconds: parseInt(ui.inpPropagation?.value) || 15,
        useFingerprint: !!ui.chkFingerprint?.checked,
        friendsExpansion: !!ui.chkFriendsExpansion?.checked,
        aggressiveSnipe: !!ui.chkAggressiveSnipe?.checked,
        autoReconnectEnabled: ui.chkAutoReconnect ? !!ui.chkAutoReconnect.checked : true,
        autoReconnectNative: !!ui.chkAutoReconnectNative?.checked,
        probes: Object.keys(newProbes).length > 0 ? newProbes : DEFAULT_SETTINGS.probes
    };

    await chrome.storage.local.set({ 'rota_settings': newSettings });
    currentSettings = newSettings;

    document.body.classList.toggle('reduced-motion', newSettings.reducedMotion);

    applyTranslations();
    renderProbes(newSettings.probes);
    clearUnsaved();
    loadDiagnostics();
    showToast(TrackedI18n.t('settingsSaved') || 'Ayarlar kaydedildi', 'success');
}

async function restoreDefaults() {
    if (!confirm(TrackedI18n.t('confirmReset') || 'Tüm ayarları sıfırlamak istediğinden emin misin?')) return;
    await chrome.storage.local.set({ 'rota_settings': { ...DEFAULT_SETTINGS } });
    if (typeof TrackedI18n !== 'undefined') TrackedI18n.setLocale(DEFAULT_SETTINGS.language);
    await loadSettings();
    applyTranslations();
    clearUnsaved();
    loadDiagnostics();
    showToast(TrackedI18n.t('factoryReset') || 'Fabrika ayarları yüklendi', 'success');
}

async function clearFavorites() {
    if (!confirm(TrackedI18n.t('confirmClearFavs') || 'Tüm favorileri silmek istediğinden emin misin?')) return;
    await chrome.storage.local.set({ 'rota_favorites': [] });
    loadDiagnostics();
    showToast(TrackedI18n.t('libraryCleared') || 'Kütüphane temizlendi', 'success');
}

async function clearCache() {
    if (!confirm(TrackedI18n.t('confirmClearCache') || 'Cache\'i temizlemek istediğinden emin misin?')) return;
    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter(k =>
        k.startsWith('rota_cache_') ||
        k.startsWith('ping_cache_') ||
        k.startsWith('tracked_cache_')
    );
    if (keysToRemove.length > 0) await chrome.storage.local.remove(keysToRemove);
    loadDiagnostics();
    showToast(`${keysToRemove.length} ${TrackedI18n.t('cacheItemsCleared') || 'cache öğesi temizlendi'}`, 'success');
}

// ── Diagnostics ──
async function loadDiagnostics() {
    try {
        const all = await chrome.storage.local.get(null);

        // Favorites count
        const favs = all.rota_favorites || [];
        if (ui.diagFavorites) ui.diagFavorites.textContent = Array.isArray(favs) ? favs.length : 0;

        // Cache size estimate (KB)
        let totalBytes = 0;
        for (const [k, v] of Object.entries(all)) {
            try { totalBytes += new Blob([JSON.stringify(v)]).size + k.length; } catch (_) {}
        }
        const kb = (totalBytes / 1024).toFixed(1);
        if (ui.diagCacheSize) ui.diagCacheSize.textContent = `${kb} KB`;

        // Baseline RTT (popup tarafından kaydediliyorsa)
        const baseline = all.user_baseline_rtt;
        if (ui.diagBaseline) {
            ui.diagBaseline.textContent = (baseline && typeof baseline === 'number')
                ? `${Math.round(baseline)} ms` : '—';
        }
    } catch (e) {
        console.warn('[Options] Diagnostics load failed:', e);
    }
}

// ── Export / Import ──
function setupDataActions() {
    ui.btnExport?.addEventListener('click', async () => {
        const data = await chrome.storage.local.get(null);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tracked-settings-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(TrackedI18n.t('exported') || 'Ayarlar dışa aktarıldı', 'success');
    });

    ui.fileImport?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);

            if (typeof parsed !== 'object' || parsed === null) {
                throw new Error('Invalid JSON structure');
            }

            if (!confirm(TrackedI18n.t('confirmImport') || 'İçe aktarma mevcut ayarların üzerine yazacak. Devam edilsin mi?')) {
                e.target.value = '';
                return;
            }

            // Sadece bilinen anahtarları içe al — keyfi data kaydetme
            const safeKeys = ['rota_settings', 'rota_favorites'];
            const toImport = {};
            safeKeys.forEach(k => {
                if (k in parsed) toImport[k] = parsed[k];
            });

            await chrome.storage.local.set(toImport);
            await loadSettings();
            applyTranslations();
            loadDiagnostics();
            clearUnsaved();
            showToast(TrackedI18n.t('imported') || 'Ayarlar içe aktarıldı', 'success');
        } catch (err) {
            console.error('[Options] Import failed:', err);
            showToast(TrackedI18n.t('importFailed') || 'İçe aktarma hatalı: ' + err.message, 'error');
        } finally {
            e.target.value = '';
        }
    });
}

// ── Toast ──
function showToast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast-msg ${type}`;
    el.textContent = msg;
    ui.toastContainer?.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ── Helpers ──
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function escapeAttr(s) {
    return escapeHtml(s);
}
