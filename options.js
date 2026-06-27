// options.js - Tracked Extension v3.8 - Enhanced Settings UI

// Toggle FOUC kökten çözüm: durumları localStorage önbelleğinden (SENKRON) PAINT öncesi uygula.
// chrome.storage async (~0.5sn) olduğu için tek başına geç kalıp "kapalı→yeşil" sıçramasına/gecikmeye
// yol açıyordu. Bu önbellek her load + save'de tazelenir; ilk açılışta yoksa <head>'deki tk-pre hide
// devreye girer (loadSettings'e kadar gizler). options.js body sonunda yüklendiği için toggle'lar burada hazır.
(function () {
  try {
    const c = JSON.parse(localStorage.getItem('tk_opt_toggles') || 'null');
    if (c && typeof c === 'object') {
      for (const id in c) { const el = document.getElementById(id); if (el) el.checked = !!c[id]; }
      document.documentElement.classList.remove('tk-pre');   // doğru durumla ANINDA göster
    }
  } catch (_) {}
  // Plus kutusunu da senkron kur → "Ücretsiz/Plus'a Yükselt → Aktif" sıçraması + altın layout kayması olmasın
  try {
    const p = JSON.parse(localStorage.getItem('tk_opt_plus') || 'null');
    if (p && typeof p === 'object') applyPlusState(p);
  } catch (_) {}
})();

const DEFAULT_SETTINGS = {
    timeoutMs: 3000,
    cacheMinutes: 10,
    silentMode: false,
    reducedMotion: false,
    nowPlaying: false,
    trelloEnabled: false,
    gameCodes: true,
    language: 'tr',
    // Auto-Reconnect
    autoReconnectEnabled: true,
    autoReconnectNative: false,
    // Etiketler AWS bölgesinin GERÇEK konumu (popup.js DEFAULT_SETTINGS ile senkron tutulmalı).
    probes: {
        "Almanya (DE)": "https://s3.eu-central-1.amazonaws.com",
        "İrlanda (IE)": "https://s3.eu-west-1.amazonaws.com",
        "Fransa (FR)": "https://s3.eu-west-3.amazonaws.com",
        "İsveç (SE)": "https://s3.eu-north-1.amazonaws.com",
        "İtalya (IT)": "https://s3.eu-south-1.amazonaws.com"
    }
};

const ui = {
    // Connection
    inpTimeout: document.getElementById('inp-timeout'),
    inpCache: document.getElementById('inp-cache'),
    // Plus
    plusBadge: document.getElementById('plus-badge'),
    plusName: document.getElementById('plus-name'),
    plusKey: document.getElementById('plus-key'),
    plusActivate: document.getElementById('plus-activate'),
    plusDeactivate: document.getElementById('plus-deactivate'),
    plusUpgrade: document.getElementById('plus-upgrade'),
    plusMsg: document.getElementById('plus-msg'),
    plusKeyRow: document.getElementById('plus-key-row'),
    // Appearance
    chkNowPlaying: document.getElementById('chk-now-playing'),
    chkTrello: document.getElementById('chk-trello'),
    chkGameCodes: document.getElementById('chk-game-codes'),
    // Performance
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
    // Ayarlar uygulandı → toggle'ları aç (FOUC sıçraması bitti). tk-pre <head>'de eklenmişti.
    try { document.documentElement.classList.remove('tk-pre'); } catch (_) {}
    setupStepperControls();
    setupSmartLanguageSelector();
    setupKeyboardShortcuts();
    setupScrollSpy();
    setupProbeActions();
    setupDataActions();
    applyTranslations();
    loadDiagnostics();
    clearUnsaved();
    setupChangelog();
    setupPlus();
});

// ── Tracked Plus (Lemon Squeezy lisans) ──
const PLUS_CHECKOUT_URL = 'https://tracked.lemonsqueezy.com/buy/REPLACE-ME'; // TODO: gerçek checkout URL
function setPlusMsg(t, cls) { if (!ui.plusMsg) return; ui.plusMsg.textContent = t; ui.plusMsg.className = 'plus-msg ' + (cls || ''); }
// Plus durumunu DOM'a uygula — loadPlusStatus + açılıştaki SENKRON önbellek ORTAK kullanır.
// getElementById ile (ui henüz kurulmamış olabilir, IIFE'den de çağrılıyor). Function decl = hoisted.
function applyPlusState(p) {
    const badge = document.getElementById('plus-badge');
    if (badge) {
        badge.classList.remove('active', 'trial');
        if (p.isPlus) { badge.textContent = 'Aktif'; badge.classList.add('active'); }
        else if (p.status === 'expired') badge.textContent = 'Süresi Dolmuş';
        else badge.textContent = 'Ücretsiz';
    }
    const name = document.getElementById('plus-name'); if (name) name.textContent = p.name || '';
    const deact = document.getElementById('plus-deactivate'); if (deact) deact.style.display = p.hasKey ? '' : 'none';
    const upg = document.getElementById('plus-upgrade'); if (upg) upg.style.display = p.isPlus ? 'none' : '';
    const key = document.getElementById('plus-key'); if (key && p.hasKey && p.keyMasked) key.placeholder = p.keyMasked;
}
async function loadPlusStatus() {
    let r = null;
    try { r = await chrome.runtime.sendMessage({ action: 'licenseGet' }); } catch (_) {}
    const p = { isPlus: !!(r && r.isPlus), status: (r && r.status) || 'free', hasKey: !!(r && r.hasKey), name: (r && r.name) || '', keyMasked: (r && r.keyMasked) || '' };
    applyPlusState(p);
    try { localStorage.setItem('tk_opt_plus', JSON.stringify(p)); } catch (_) {}   // sonraki açılış FOUC'suz
}
async function activateLicense() {
    const key = (ui.plusKey?.value || '').trim();
    if (!key) { setPlusMsg('Lisans anahtarı gir.', 'err'); return; }
    setPlusMsg('Doğrulanıyor…', '');
    if (ui.plusActivate) ui.plusActivate.disabled = true;
    let r = null;
    try { r = await chrome.runtime.sendMessage({ action: 'licenseActivate', key }); } catch (_) {}
    if (ui.plusActivate) ui.plusActivate.disabled = false;
    if (r && r.ok && r.isPlus) { setPlusMsg('Aktive edildi — Tracked Plus açık!', 'ok'); if (ui.plusKey) ui.plusKey.value = ''; }
    else if (r && r.ok) setPlusMsg('Anahtar geçerli ama abonelik aktif değil (durum: ' + (r.status || '?') + ').', 'err');
    else setPlusMsg((r && r.error) || 'Aktivasyon başarısız.', 'err');
    loadPlusStatus();
}
function setupPlus() {
    loadPlusStatus();
    ui.plusActivate?.addEventListener('click', activateLicense);
    ui.plusKey?.addEventListener('keydown', e => { if (e.key === 'Enter') activateLicense(); });
    ui.plusDeactivate?.addEventListener('click', async () => {
        if (!confirm('Lisansı bu cihazdan çıkarmak istediğine emin misin?')) return;
        try { await chrome.runtime.sendMessage({ action: 'licenseDeactivate' }); } catch (_) {}
        loadPlusStatus();
    });
    ui.plusUpgrade?.addEventListener('click', () => { try { window.open(PLUS_CHECKOUT_URL, '_blank', 'noopener'); } catch (_) {} });
}

ui.btnSave?.addEventListener('click', saveSettings);
ui.btnReset?.addEventListener('click', restoreDefaults);
ui.btnClearFavs?.addEventListener('click', clearFavorites);
ui.btnClearCache?.addEventListener('click', clearCache);

// v1.9.0: Oto-Pilot bad-server blocklist
const btnClearOtopilotBl = document.getElementById('btn-clear-otopilot-bl');
const otopilotBlInfo = document.getElementById('otopilot-bl-info');
async function updateOtopilotBlInfo() {
    if (!otopilotBlInfo) return;
    try {
        const stored = await chrome.storage.local.get('rota_otopilot_blocklist');
        const bl = stored?.rota_otopilot_blocklist || [];
        const now = Date.now();
        const TTL = 24 * 60 * 60 * 1000;
        const valid = bl.filter(e => e?.ts && (now - e.ts) < TTL);
        const count = valid.length;
        otopilotBlInfo.textContent = count > 0
            ? `${count} server blocklist'te (24h TTL otomatik silinir).`
            : 'Yüksek ping nedeniyle işaretlenmiş server\'ları siler (24h TTL otomatik).';
    } catch (_) {}
}
btnClearOtopilotBl?.addEventListener('click', async () => {
    if (!confirm('Oto-Pilot blocklist\'ini temizlemek istediğine emin misin?')) return;
    try {
        await chrome.storage.local.remove('rota_otopilot_blocklist');
        await updateOtopilotBlInfo();
        showToast('Oto-Pilot blocklist temizlendi', 'success');
    } catch (e) {
        showToast('Temizleme başarısız', 'error');
    }
});
updateOtopilotBlInfo(); // ilk yüklemede count göster

// Change listeners (everything that affects settings)
[
    ui.inpTimeout, ui.inpCache,
    ui.chkNowPlaying, ui.chkTrello, ui.chkGameCodes, ui.selLanguage,
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
    const sectionIds = ['sec-plus', 'sec-appearance', 'sec-connection', 'sec-reconnect', 'sec-probes', 'sec-diagnostics', 'sec-changelog'];
    const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

    if (sections.length === 0 || !ui.tocLinks.length) return;

    // Smooth scroll on TOC click
    ui.tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(link.dataset.target);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    const setActive = (id) => {
        ui.tocLinks.forEach(link => link.classList.toggle('active', link.dataset.target === id));
    };

    // Scroll-tabanlı spy: viewport'un üst kenarına en yakın (ama geçmemiş) section'ı seç.
    // IntersectionObserver yerine bu yöntem, aynı anda birden fazla section görünürken
    // doğru vurgulama yapar — "en yukarıdaki görünür section" her zaman kazanır.
    const updateActive = () => {
        const scrollY = window.scrollY;
        const OFFSET = 80; // sticky header veya padding için üst tolerans (px)
        const atBottom = (scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 10);

        if (atBottom) {
            // Sayfanın sonuna gelindi → son sekme aktif
            setActive(sections[sections.length - 1].id);
            return;
        }

        // En alta geçmiş son section'ı bul
        let activeId = sections[0].id;
        for (const section of sections) {
            if (section.getBoundingClientRect().top <= OFFSET) {
                activeId = section.id;
            }
        }
        setActive(activeId);
    };

    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive(); // ilk yüklemede çalıştır
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
    if (ui.chkNowPlaying) ui.chkNowPlaying.checked = settings.nowPlaying === true;
    if (ui.chkTrello) ui.chkTrello.checked = settings.trelloEnabled === true;
    if (ui.chkGameCodes) ui.chkGameCodes.checked = settings.gameCodes !== false;
    if (ui.chkAutoReconnect) ui.chkAutoReconnect.checked = settings.autoReconnectEnabled !== false;
    if (ui.chkAutoReconnectNative) ui.chkAutoReconnectNative.checked = settings.autoReconnectNative === true;
    if (ui.selLanguage) ui.selLanguage.value = settings.language || 'tr';

    updateLanguageDisplay(settings.language || 'tr');
    renderProbes(settings.probes);
    mirrorToggleCache();
}

// Toggle durumlarını localStorage'a yansıt → sonraki açılışta paint öncesi SENKRON kurulur (FOUC yok).
function mirrorToggleCache() {
    try {
        localStorage.setItem('tk_opt_toggles', JSON.stringify({
            'chk-now-playing': !!(ui.chkNowPlaying && ui.chkNowPlaying.checked),
            'chk-trello': !!(ui.chkTrello && ui.chkTrello.checked),
            'chk-game-codes': !!(ui.chkGameCodes && ui.chkGameCodes.checked),
            'chk-auto-reconnect': !!(ui.chkAutoReconnect && ui.chkAutoReconnect.checked),
            'chk-auto-reconnect-native': !!(ui.chkAutoReconnectNative && ui.chkAutoReconnectNative.checked)
        }));
    } catch (_) {}
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

    // Verilen probları AYNEN render et: şablon uygulanınca o bölge seti GELİR (EU defaultları zorla
    // eklenmez → şablon "yer değiştirir", üstüne eklenmez). Hiç prob yoksa defaultlara düşülür.
    const providedKeys = Object.keys(userProbes || {});
    const orderedKeys = providedKeys.length ? providedKeys : Object.keys(DEFAULT_SETTINGS.probes);

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

        // Gerçek bayrak ikonu; yoksa harf koduna düş (akıllı fallback)
        const flagHtml = (typeof tkFlag === 'function') ? tkFlag(code || regionName) : '';
        const flagSpan = flagHtml
            ? `<span class="probe-flag has-flag">${flagHtml}</span>`
            : (code ? `<span class="probe-flag">${escapeHtml(code)}</span>` : '');
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
        // Popup ile AYNI motor (PingUtils): warmup + median → TCP/TLS el sıkışması ölçüme karışmaz.
        // (Eski tek soğuk fetch DNS+TCP+TLS'yi de sayıyordu → gerçek ping'in ~5-6 katı çıkıyordu.)
        const r = await PingUtils.measureMedianLatency(url, 5000, 5);
        const elapsed = r && r.ms > 0 ? Math.round(r.ms) : -1;
        if (elapsed <= 0) throw new Error('fail');

        let cls = 'good';
        if (elapsed > 120) cls = 'warn';
        if (elapsed > 250) cls = 'bad';

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

    // v4.2: Bölge Şablonu — kullanıcının coğrafyasına göre preset uygula
    const PROBE_PRESETS = {
        // Etiketler AWS bölgesinin GERÇEK konumu (dürüst veri) — NL/PL/RO'da AWS bölgesi yok, eski etiketler yanlıştı.
        eu: {
            "Almanya (DE)": "https://s3.eu-central-1.amazonaws.com",
            "İrlanda (IE)": "https://s3.eu-west-1.amazonaws.com",
            "Fransa (FR)": "https://s3.eu-west-3.amazonaws.com",
            "İsveç (SE)": "https://s3.eu-north-1.amazonaws.com",
            "İtalya (IT)": "https://s3.eu-south-1.amazonaws.com"
        },
        na: {
            "Virginia (US-E)": "https://s3.us-east-1.amazonaws.com",
            "Ohio (US-E2)":    "https://s3.us-east-2.amazonaws.com",
            "California (US-W)": "https://s3.us-west-1.amazonaws.com",
            "Oregon (US-W2)":  "https://s3.us-west-2.amazonaws.com",
            "Canada (CA-C)":   "https://s3.ca-central-1.amazonaws.com"
        },
        asia: {
            "Tokyo (JP)":      "https://s3.ap-northeast-1.amazonaws.com",
            "Seoul (KR)":      "https://s3.ap-northeast-2.amazonaws.com",
            "Singapore (SG)":  "https://s3.ap-southeast-1.amazonaws.com",
            "Mumbai (IN)":     "https://s3.ap-south-1.amazonaws.com",
            "Hong Kong (HK)":  "https://s3.ap-east-1.amazonaws.com"
        },
        sa: {
            "São Paulo (BR)":  "https://s3.sa-east-1.amazonaws.com",
            "Virginia (US-E)": "https://s3.us-east-1.amazonaws.com",
            "Frankfurt (DE)":  "https://s3.eu-central-1.amazonaws.com",
            "California (US-W)": "https://s3.us-west-1.amazonaws.com"
        },
        au: {
            "Sydney (AU)":     "https://s3.ap-southeast-2.amazonaws.com",
            "Singapore (SG)":  "https://s3.ap-southeast-1.amazonaws.com",
            "Tokyo (JP)":      "https://s3.ap-northeast-1.amazonaws.com",
            "California (US-W)": "https://s3.us-west-1.amazonaws.com"
        }
    };

    // ── Custom dropdown (dil seçici tarzı, smooth animation) ──
    const presetCurrentBtn   = document.getElementById('preset-current-btn');
    const presetDropdown     = document.getElementById('preset-dropdown');
    const presetSmartSelect  = document.getElementById('smart-preset-select');
    const presetApplyBtn     = document.getElementById('btn-apply-preset');
    const currentPresetCode  = document.getElementById('current-preset-code');
    const currentPresetName  = document.getElementById('current-preset-name');
    let selectedPresetKey    = null;

    if (presetCurrentBtn && presetDropdown) {
        presetCurrentBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            presetCurrentBtn.classList.toggle('active');
            presetDropdown.classList.toggle('show');
        });

        // Dışarı tıklayınca kapat
        document.addEventListener('click', (e) => {
            if (!presetSmartSelect?.contains(e.target)) {
                presetCurrentBtn.classList.remove('active');
                presetDropdown.classList.remove('show');
            }
        });

        // ESC tuşu ile kapat
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                presetCurrentBtn.classList.remove('active');
                presetDropdown.classList.remove('show');
            }
        });

        // Seçenek tıklama → display güncelle, Apply butonunu aktif et
        presetDropdown.querySelectorAll('.preset-option').forEach(opt => {
            opt.addEventListener('click', () => {
                selectedPresetKey = opt.dataset.key;
                const code = opt.querySelector('.preset-code')?.textContent || '?';
                const nameRaw = opt.querySelector('.preset-name')?.firstChild?.textContent?.trim() || 'Seçildi';
                if (currentPresetCode) currentPresetCode.textContent = code;
                if (currentPresetName) currentPresetName.textContent = nameRaw;
                // Selected state
                presetDropdown.querySelectorAll('.preset-option').forEach(o => o.classList.toggle('selected', o === opt));
                if (presetApplyBtn) presetApplyBtn.disabled = false;
                // Kapat
                presetCurrentBtn.classList.remove('active');
                presetDropdown.classList.remove('show');
            });
        });
    }

    presetApplyBtn?.addEventListener('click', () => {
        if (!selectedPresetKey || !PROBE_PRESETS[selectedPresetKey]) {
            showToast('Önce bir şablon seçin', 'warning');
            return;
        }
        const newProbes = PROBE_PRESETS[selectedPresetKey];
        renderProbes(newProbes);
        markUnsaved();
        const count = Object.keys(newProbes).length;
        const label = currentPresetName?.textContent || 'Şablon';
        showToast(`${label} uygulandı (${count} region) — Kaydet'e basın`, 'success');
    });

    // Sayfa yüklenince mevcut problar bir şablonla TAM eşleşiyorsa dropdown'da onu göster (kalıcı seçim hissi).
    const detectActivePreset = () => {
        if (!presetDropdown) return;
        const cur = (currentSettings && currentSettings.probes) || {};
        const curKeys = Object.keys(cur).sort();
        for (const [key, preset] of Object.entries(PROBE_PRESETS)) {
            const pKeys = Object.keys(preset).sort();
            const match = pKeys.length === curKeys.length && pKeys.every((k, i) => k === curKeys[i] && preset[k] === cur[k]);
            if (!match) continue;
            selectedPresetKey = key;
            const opt = presetDropdown.querySelector(`.preset-option[data-key="${key}"]`);
            if (opt) {
                const code = opt.querySelector('.preset-code')?.textContent || '?';
                const nameRaw = opt.querySelector('.preset-name')?.firstChild?.textContent?.trim() || '';
                if (currentPresetCode) currentPresetCode.textContent = code;
                if (currentPresetName) currentPresetName.textContent = nameRaw;
                presetDropdown.querySelectorAll('.preset-option').forEach(o => o.classList.toggle('selected', o === opt));
            }
            return;
        }
    };
    detectActivePreset();

    // ── Otomatik bölge önerisi: konumdan (geo) bölgeyi tespit et → uygun şablonu öner ──
    const templateFromLatLon = (lat, lon) => {
        if (typeof lat !== 'number' || typeof lon !== 'number') return null;
        if (lat >= 34 && lat <= 72 && lon >= -25 && lon <= 45) return 'eu';          // Avrupa
        if (lat >= 12 && lat <= 75 && lon >= -170 && lon <= -50) return 'na';        // Kuzey Amerika
        if (lat >= -56 && lat < 13 && lon >= -82 && lon <= -34) return 'sa';         // Güney Amerika
        if (lat >= -50 && lat <= 0 && lon >= 110 && lon <= 180) return 'au';         // Avustralya/Okyanusya
        if (lat >= -10 && lat <= 60 && lon > 45 && lon <= 150) return 'asia';        // Asya
        return 'eu';  // eşleşmeyen bölge → en yakın varsayılan (Karışık/global kaldırıldı)
    };
    const suggestRegionTemplate = async () => {
        if (!presetSmartSelect || !presetSmartSelect.parentNode) return;
        let geo = null;
        try {
            geo = await new Promise(res => { try { chrome.runtime.sendMessage({ action: 'resolveUserLocation' }, r => res(chrome.runtime.lastError ? null : r)); } catch (_) { res(null); } });
        } catch (_) {}
        if (!geo || !geo.ok || typeof geo.lat !== 'number') return;
        const key = templateFromLatLon(geo.lat, geo.lon);
        if (!key || !PROBE_PRESETS[key]) return;
        // Mevcut problar zaten bu şablonsa öneri gösterme (zaten doğru).
        const cur = (currentSettings && currentSettings.probes) || {};
        const preset = PROBE_PRESETS[key];
        const ck = Object.keys(cur).sort(), pk = Object.keys(preset).sort();
        if (pk.length === ck.length && pk.every((k, i) => k === ck[i] && preset[k] === cur[k])) return;
        const opt = presetDropdown?.querySelector(`.preset-option[data-key="${key}"]`);
        const label = opt?.querySelector('.preset-name')?.firstChild?.textContent?.trim() || key.toUpperCase();
        if (document.querySelector('.probe-suggest-banner')) return;
        const banner = document.createElement('div');
        banner.className = 'probe-suggest-banner';
        banner.innerHTML = `<span>Konumuna göre <b>${escapeHtml(label)}</b> bölgesi öneriliyor.</span><span class="psb-actions"><button type="button" class="psb-apply">Uygula</button><button type="button" class="psb-dismiss">Kapat</button></span>`;
        // Banner'ı preset SATIRININ ÜSTÜNE ekle (içine değil — flex satırını bozuyordu/üst üste biniyordu).
        const presetRow = presetSmartSelect.closest('.probe-preset-row') || presetSmartSelect.parentNode;
        presetRow.parentNode.insertBefore(banner, presetRow);
        banner.querySelector('.psb-apply').addEventListener('click', () => {
            selectedPresetKey = key;
            renderProbes(preset);
            markUnsaved();
            if (opt) {
                const code = opt.querySelector('.preset-code')?.textContent || '?';
                if (currentPresetCode) currentPresetCode.textContent = code;
                if (currentPresetName) currentPresetName.textContent = label;
                presetDropdown.querySelectorAll('.preset-option').forEach(o => o.classList.toggle('selected', o === opt));
            }
            banner.remove();
            showToast(`${label} uygulandı — Kaydet'e basın`, 'success');
        });
        banner.querySelector('.psb-dismiss').addEventListener('click', () => banner.remove());
    };
    suggestRegionTemplate();
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

    const existingRS = (await chrome.storage.local.get('rota_settings')).rota_settings || {};
    const newSettings = {
        timeoutMs: parseInt(ui.inpTimeout?.value) || 3000,
        cacheMinutes: parseInt(ui.inpCache?.value) || 10,
        silentMode: false,
        reducedMotion: false,
        nowPlaying: !!ui.chkNowPlaying?.checked,
        trelloEnabled: !!ui.chkTrello?.checked,
        gameCodes: ui.chkGameCodes ? !!ui.chkGameCodes.checked : true,
        language: selectedLanguage,
        autoReconnectEnabled: ui.chkAutoReconnect ? !!ui.chkAutoReconnect.checked : true,
        autoReconnectNative: !!ui.chkAutoReconnectNative?.checked,
        probes: Object.keys(newProbes).length > 0 ? newProbes : DEFAULT_SETTINGS.probes
    };
    // Trello kimlik bilgileri (key/token/board) panelin kurulum formunda ayarlanır → kaydederken KORU (silme).
    if (existingRS.trello) newSettings.trello = existingRS.trello;

    await chrome.storage.local.set({ 'rota_settings': newSettings });
    currentSettings = newSettings;
    mirrorToggleCache();   // localStorage önbelleğini tazele → sonraki açılış FOUC'suz

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

// ── Sürüm Notları ──────────────────────────────────────────────────────────
const CHANGELOG = [
    {
        version: 'v1.9.6',
        date: '23 Haziran 2026',
        isNew: true,
        entries: [
            { icon: '▸', text: 'Trello panosu (oyun sayfası): About/Store/Servers yanına "Trello" sekmesi eklendi — oyunun Trello panosunu OTOMATİK bulup gösterir (sen hiçbir şey girmezsin). Listeler + kartlar, kapak görselleri, içinde arama (kart adı/açıklamada, eşleşeni vurgular), karta tıklayınca büyük görsel + tam açıklama' },
            { icon: '▸', text: 'Trello otomatik bulma akıllandı: oyun açıklaması, geliştiricinin sosyal linkleri ve web araması taranır; bulunan pano önbelleğe alınır → tekrar girişte anında açılır. Manuel pano girme tamamen kaldırıldı' },
            { icon: '▸', text: 'Yan ray: oyun sayfasındaki Yeni/Derin/ID/Oto-Pilot/Bekçi araç çubuğu, sağ kenara yapışan dikey camsı bir "ray"a dönüştürüldü — yeni ikonlar, üstüne gelince sola açılan etiketler, ince mikro-animasyonlar ve sinematik bir tarama efekti. Tüm işlevler aynı kalır' },
            { icon: '▸', text: 'Müzik widget: sonraki şarkıya otomatik geçerken durması düzeltildi; YouTube\'da açılan video artık doğru algılanıyor' },
            { icon: '▸', text: 'Arkadaşlar listesi açılışta anında gelir, arka planda sessizce yenilenir — değişiklik yoksa liste hiç "oynamaz" (kayma/flicker yok)' },
            { icon: '▸', text: '"Canlı etkinlik var" rozeti yeşile çevrildi; "Kodlar" butonu tasarımla uyumlu hâle getirildi' },
            { icon: '▸', text: 'Kararlılık: Trello sekmesi nadiren boş kalırsa kendini ≤1 sn\'de onarır, kapaklar daha hızlı (kalıcı önbellek) yüklenir; çeşitli iyileştirmeler' },
        ]
    },
    {
        version: 'v1.9.5',
        date: '17 Haziran 2026',
        isNew: false,
        entries: [
            { icon: '▸', text: 'Şu An Çalıyor (medya widget): YouTube / YouTube Music / Spotify\'da çalan şarkıyı Roblox sayfasında gösterir; oynat/duraklat, sonraki/önceki, ileri-geri sarma ve yüzdeli ses kontrolü buradan yapılır. Veri gerçek (mediaSession), hiçbir şey tarayıcından çıkmaz. Ayarlardan açılır (varsayılan kapalı)' },
            { icon: '▸', text: 'Widget\'tan müzik arama: kartın içine yazıp ararsın, sonuçlardan birine tıklayınca YouTube/YT Music arka planda çalmaya başlar — sen Roblox\'ta kalırsın. Spotify\'da sonuç gösterilir, parça Spotify\'da açılır (DRM nedeniyle)' },
            { icon: '▸', text: 'Widget sürüklenebilir (8 köşeye yapışır) ve sağ/sol kenarından genişletilebilir; konum/boyut kalıcı. Kapaktan dürüst dinamik renk, küçültülebilir kare mod' },
            { icon: '▸', text: 'Oyun Kodları paneli: oyun sayfalarında sağ-altta "Kodlar" — o oyunun kodlarını bulup gösterir (küratörlü kaynak + oyun açıklaması + oyunun resmi sosyal kanalları + web araması). Resmi kod API\'si olmadığından kodlar "doğrulanmamış" etiketli; uydurma yok, gerçek kaynaklara yönlendirir' },
            { icon: '▸', text: 'Ayarlardan "Sessiz Mod" ve "Hareket Azalt" kaldırıldı' },
            { icon: '▸', text: 'Çeşitli kararlılık ve performans iyileştirmeleri' },
        ]
    },
    {
        version: 'v1.9.4',
        date: '13 Haziran 2026',
        isNew: false,
        entries: [
            { icon: '▸', text: 'Oyuncu İçgörü Paneli: profil sayfasında oyuncunun künyesi (hesap yaşı, oluşturma, doğrulanmış rozet), değeri (RAP/tahmini değer, en değerli itemler) ve sosyal bilgisi (arkadaş/takipçi, ortak arkadaş, çevrimiçi durumu) tek kartta' },
            { icon: '▸', text: 'Envanter gizlilik düzeltmesi: başkasının (özellikle private) envanter sayfasında yanlışlıkla senin değerin görünebiliyordu; artık başkalarında sadece yetkili API\'ler kullanılır, private ise dürüstçe "envanter gizli" der' },
            { icon: '▸', text: 'Oyun Kütüphanesi\'ne görünüm anahtarı eklendi: tek tıkla "Geniş" (büyük kart) veya "Kompakt" (tek satır — çok oyunda kaydırma yarıya iner) arasında geç; seçim kalıcı' },
            { icon: '▸', text: 'Etkinlik Analizi yenilendi: artık önce oyunun RESMİ Roblox etkinliklerini gösterir (adı, ne zaman başlıyor/bitiyor, canlı mı) — tahmin değil kesin bilgi. Resmi etkinlik yoksa sinyallere göre dürüstçe "tahmin" yapar' },
            { icon: '▸', text: 'Bölgesel ping ve ayar problarında artık gerçek ülke bayrağı ikonları görünüyor; bazı ülke isimleri (İtalya/İsveç/İrlanda) düzgün yazılıyor' },
            { icon: '▸', text: '"Yeni" sunucu bulma artık GERÇEKTEN yeni açılmış sunucuları buluyor: listeyi kısa süre izleyip o sırada açılanı yakalar. Yeni yoksa dürüstçe "yok" der — yarı dolu sunucuyu "yeni" diye göstermez' },
            { icon: '▸', text: 'Rate limit\'e takılınca artık seni bekletip tekrar tıklatmıyor; arka planda otomatik bekleyip kaldığı yerden kendi devam ediyor' },
            { icon: '▸', text: 'Oto-Pilot butonu tekrar alt çubuğa alındı; Roblox\'un Play butonu sade/native bırakıldı' },
            { icon: '▸', text: 'Envanter / Katalog / Avatar değerlerinin yanındaki Robux ikonu artık her zaman görünüyor (gerçek Robux ikonu kullanıldı)' },
            { icon: '▸', text: 'Themes: yazı tipi seçenekleri 5\'ten 13\'e çıktı (Verdana, Impact, El Yazısı, Slab Serif vb.); seçim menüsü güzelleştirildi ve her font kendi görünümünde önizleniyor' },
            { icon: '▸', text: 'Arkadaşlar listesi artık tek seferde, akıcı yükleniyor (kart-kart "pat pat" belirme giderildi)' },
            { icon: '▸', text: 'Çeşitli temizlik ve iyileştirmeler: emojiler yerine ikonlar, gereksiz konsol uyarıları susturuldu, kararlılık artırıldı' },
        ]
    },
    {
        version: 'v1.9.3',
        date: '7 Haziran 2026',
        isNew: false,
        entries: [
            { icon: '▸', text: 'Sunucu listesinde (Diğer Sunucular) artık her sunucunun GERÇEK ülkesi/şehri ve sana GERÇEK ping\'in gösteriliyor — eskiden yazan ping aslında sunucudaki oyuncuların ortalamasıydı, seninle alakası yoktu; kaldırıldı ve doğru veriyle değiştirildi' },
            { icon: '▸', text: 'Ping\'ler arka planda otomatik ölçülür (dünya genelinde 20 bölge) — hiçbir şey yapmana gerek yok, sayfayı açınca kendiliğinden gelir; ölçülmemiş bir bölge çıkarsa dürüstçe mesafe (km) gösterilir' },
            { icon: '▸', text: 'Bölge eşleştirme koordinat bazlı oldu: ABD-Doğu ile ABD-Batı bile ayrı ping gösterir, sana en yakın bölge gerçek mesafeyle bulunur' },
            { icon: '▸', text: 'Dolu (20/20) sunucularda bölge çözülemediği için artık dürüstçe "Dolu — bölge yok" yazıyor — uydurma bilgi yok' },
            { icon: '▸', text: 'Sunucu kartları liste yenilenince veya Refresh\'e basınca artık kaymıyor/zıplamıyor; ülke ve ping bilgisi kartın içinde düzgün duruyor' },
            { icon: '▸', text: 'Nadiren oluşan bir donma/çökme (sonsuz döngü) giderildi; genel kararlılık ve performans iyileştirildi' },
        ]
    },
    {
        version: 'v1.9.2',
        date: '6 Haziran 2026',
        isNew: false,
        entries: [
            { icon: '▸', text: 'Artık her sunucunun hangi ülkede/şehirde olduğunu, sana ne kadar uzak (km) olduğunu ve ne kadar akıcı çalıştığını gösteriyoruz' },
            { icon: '▸', text: 'Derin Tarama: Her sunucunun bölgesi, mesafesi ve performansı listede görünür; en yakın ve en hızlı sunucular en üste gelir, en iyisine "Önerilen" yazısı eklenir' },
            { icon: '▸', text: 'Oto-Pilot: Tek tıkla sana en yakın bölgedeki sunucuya otomatik katılırsın — daha hızlı ve daha isabetli, hangi bölgeye bağlandığın net yazar' },
            { icon: '▸', text: 'Yeni sunucu bulduğunda artık o sunucunun bölgesi de gösteriliyor' },
            { icon: '▸', text: 'Sunucu Bekçisi yenilendi: Sadece sana yakın sunucuları izler; "en az kaç kişi olsun" diye tek bir hedef girersin, sunucu kapasitesini kendisi anlar ve tam o sayıyı bulana kadar bekler' },
            { icon: '▸', text: 'Bekçi artık çok daha fazla sunucuyu (500 sunucuya kadar) dikkatlice tarıyor, sana uygun olanı kaçırmıyor' },
            { icon: '▸', text: 'Konumun otomatik bulunur; reklam engelleyici açıkken bile çalışır ve hiçbir izin penceresi çıkmaz' },
            { icon: '▸', text: 'Ping Ayarları: Seçtiğin bölge sayfayı yenileyince kayboluyordu, düzeltildi; ayrıca sana uygun bölge otomatik önerilir' },
            { icon: '▸', text: 'Hatalar giderildi: uzaktaki sunucu için yanlış bildirim, yanlış doluluk sayısı ve yanlış sunucu seçimi düzeltildi — artık sadece gerçek ve doğru bilgi' },
            { icon: '▸', text: 'Arka planda hız ve kararlılık iyileştirmeleri; gereksiz kodlar temizlendi, daha az veri ve istek harcanıyor' },
        ]
    },
    {
        version: 'v1.9.1',
        date: '31 Mayıs 2026',
        isNew: false,
        entries: [
            { icon: '▸', text: 'Roblox Varsayılan Teması (Default): tek anahtarla tüm Tracked tema efektlerini kapat, saf Roblox görünümüne dön — kalıcı' },
            { icon: '▸', text: 'Communities sayfası tam şeffaf: içerik ve sekme arkaları kalktı, sadece wallpaper (sol liste frosted kalır)' },
            { icon: '▸', text: 'About/Store sekmelerine çerçeve çizgileri geri geldi (düzgün buton görünümü)' },
            { icon: '▸', text: 'Ücretsiz Item butonu şeffaflaştı (arkadaki gri kutu kalktı, sadece ikon)' },
            { icon: '▸', text: 'Ücretsiz Item paneli Default temada da açılıyor; panel kapanınca üst çubukta beliren gri bant giderildi' },
            { icon: '▸', text: 'Ücretsiz Item: "context invalidated" hatası giderildi + akıllı stok filtresi (stoğu/satışı gözükmeyen itemler radara alınmıyor)' },
            { icon: '▸', text: 'Çubuk opaklığı Roblox arayüz güncellemelerine dayanıklı; performans iyileştirmeleri + ölü kod temizliği' },
        ]
    },
];

function renderChangelog() {
    const list = document.getElementById('changelog-list');
    if (!list) return;

    list.innerHTML = CHANGELOG.map(entry => `
        <div class="cl-entry${entry.isNew ? ' cl-entry--new' : ''}">
            <div class="cl-entry-header">
                <span class="cl-version">${entry.version}</span>
                ${entry.isNew ? '<span class="cl-new-badge">YENİ</span>' : ''}
                <span class="cl-date">${entry.date}</span>
            </div>
            <ul class="cl-list">
                ${entry.entries.map(e => `<li><span class="cl-icon">${e.icon}</span>${escapeHtml(e.text)}</li>`).join('')}
            </ul>
        </div>
    `).join('');
}

async function setupChangelog() {
    renderChangelog();

    const badge = document.getElementById('changelog-badge');
    const CURRENT = CHANGELOG[0].version;

    // Okunmamış sürüm varsa badge göster
    const { rota_changelog_seen: seen } = await chrome.storage.local.get('rota_changelog_seen');
    if (seen !== CURRENT && badge) badge.style.display = '';

    // Sürüm Notları nav'a tıklanınca → okundu say
    document.getElementById('toc-changelog')?.addEventListener('click', async () => {
        if (badge) badge.style.display = 'none';
        await chrome.storage.local.set({ rota_changelog_seen: CURRENT });
    });

    // Scroll ile section görünüre girince de okundu say
    const section = document.getElementById('sec-changelog');
    if (!section) return;
    const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
            if (badge) badge.style.display = 'none';
            chrome.storage.local.set({ rota_changelog_seen: CURRENT });
            obs.disconnect();
        }
    }, { threshold: 0.2 });
    obs.observe(section);
}
