
// options.js

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

const ui = {
    inpTimeout: document.getElementById('inp-timeout'),
    inpCache: document.getElementById('inp-cache'),
    chkNewTab: document.getElementById('chk-newtab'),
    chkAppendParam: document.getElementById('chk-appendparam'),
    chkAnimations: document.getElementById('chk-animations'),
    chkSilent: document.getElementById('chk-silent'),
    probeList: document.getElementById('probe-list'),
    btnSave: document.getElementById('btn-save'),
    btnReset: document.getElementById('btn-reset'),
    btnClearFavs: document.getElementById('btn-clear-favs'),
    toastContainer: document.getElementById('toast-container'),
    unsavedIndicator: document.getElementById('unsaved-indicator'),
    actionsFooter: document.querySelector('.actions-footer')
};

// State to track if changes made
let hasChanges = false;

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupStepperControls();
    // Initialize footer state
    clearUnsaved();
});
ui.btnSave.addEventListener('click', saveSettings);
ui.btnReset.addEventListener('click', restoreDefaults);
ui.btnClearFavs.addEventListener('click', clearFavorites);

// Add change listeners
[ui.inpTimeout, ui.inpCache, ui.chkNewTab, ui.chkAppendParam, ui.chkAnimations, ui.chkSilent].forEach(el => {
    if(el) { // Check existence
        el.addEventListener('change', markUnsaved);
        el.addEventListener('input', markUnsaved);
    }
});

function markUnsaved() {
    hasChanges = true;
    
    // Show text and adjust layout
    ui.unsavedIndicator.style.display = 'flex';
    ui.unsavedIndicator.style.opacity = '1';
    
    if (ui.actionsFooter) {
        ui.actionsFooter.classList.remove('no-changes');
    }
    
    ui.btnSave.textContent = 'Kaydet *';
}

function clearUnsaved() {
    hasChanges = false;
    
    // Hide text (display:none removes it from flow, collapsing the pill)
    ui.unsavedIndicator.style.display = 'none';
    ui.unsavedIndicator.style.opacity = '0';
    
    if (ui.actionsFooter) {
        ui.actionsFooter.classList.add('no-changes');
    }
    
    ui.btnSave.textContent = 'Ayarları Kaydet';
}

// Logic for custom +/- buttons
function setupStepperControls() {
    document.querySelectorAll('.step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Find parent group, then find input
            const group = btn.closest('.metric-input-group');
            const input = group.querySelector('input[type="number"]');
            
            if (!input) return;

            const action = btn.dataset.action; // 'inc' or 'dec'
            let val = parseInt(input.value) || 0;
            const step = parseInt(input.getAttribute('step')) || 1;
            const min = parseInt(input.getAttribute('min'));
            const max = parseInt(input.getAttribute('max'));

            if (action === 'inc') {
                val += step;
            } else {
                val -= step;
            }

            // Boundary checks
            if (!isNaN(min) && val < min) val = min;
            if (!isNaN(max) && val > max) val = max;

            input.value = val;
            
            // Trigger change event manually so "markUnsaved" works
            input.dispatchEvent(new Event('input'));
        });
    });
}

async function loadSettings() {
    const data = await chrome.storage.local.get('rota_settings');
    console.log('[Options] Loaded settings:', data);
    
    // Merge with defaults to ensure new keys exist
    const settings = { ...DEFAULT_SETTINGS, ...data.rota_settings };
    
    ui.inpTimeout.value = settings.timeoutMs;
    ui.inpCache.value = settings.cacheMinutes;
    ui.chkNewTab.checked = settings.openInNewTab;
    ui.chkAppendParam.checked = settings.appendRegionParam;
    ui.chkAnimations.checked = settings.animationsEnabled !== false;
    ui.chkSilent.checked = settings.silentMode === true;
    
    renderProbes(settings.probes);
}

function renderProbes(userProbes) {
    ui.probeList.innerHTML = '';
    
    // Iterate over DEFAULT keys to ensure structure is maintained.
    for (const [regionName, defaultUrl] of Object.entries(DEFAULT_SETTINGS.probes)) {
        const userUrl = userProbes[regionName] || defaultUrl;
        const flag = REGION_FLAGS[regionName] || '🌍';

        const row = document.createElement('div');
        row.className = 'probe-row';
        row.dataset.region = regionName; // Store key for saving later

        row.innerHTML = `
            <div class="probe-label-container">
                <span class="flag-icon">${flag}</span>
                <span class="probe-name-static">${regionName}</span>
            </div>
            <input type="text" class="probe-url-input" value="${userUrl}" placeholder="https://..." spellcheck="false">
            <button class="btn-icon" title="Varsayılan URL'ye dön" data-action="reset-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6M21.5 22v-6h-6"/><path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/></svg>
            </button>
        `;

        // Add Reset Listener for this row
        const resetBtn = row.querySelector('[data-action="reset-row"]');
        const input = row.querySelector('.probe-url-input');
        
        resetBtn.addEventListener('click', () => {
            input.value = defaultUrl;
            markUnsaved();
            showToast(`${regionName} varsayılana döndü.`);
        });

        input.addEventListener('input', markUnsaved);

        ui.probeList.appendChild(row);
    }
}

async function saveSettings() {
    const newProbes = {};
    const rows = ui.probeList.querySelectorAll('.probe-row');
    
    rows.forEach(row => {
        const region = row.dataset.region;
        const url = row.querySelector('.probe-url-input').value.trim();
        if (region && url) {
            newProbes[region] = url;
        } else {
            newProbes[region] = DEFAULT_SETTINGS.probes[region];
        }
    });

    const newSettings = {
        timeoutMs: parseInt(ui.inpTimeout.value) || 3000,
        cacheMinutes: parseInt(ui.inpCache.value) || 10,
        openInNewTab: ui.chkNewTab.checked,
        appendRegionParam: ui.chkAppendParam.checked,
        animationsEnabled: ui.chkAnimations.checked,
        silentMode: ui.chkSilent.checked,
        probes: newProbes
    };

    console.log('[Options] Saving settings:', newSettings);
    await chrome.storage.local.set({ 'rota_settings': newSettings });
    
    clearUnsaved();
    showToast('Ayarlar başarıyla kaydedildi.');
}

async function restoreDefaults() {
    if (confirm('DİKKAT: Tüm ayarları fabrika varsayılanlarına döndürmek istediğinize emin misiniz?')) {
        await chrome.storage.local.set({ 'rota_settings': DEFAULT_SETTINGS });
        await loadSettings(); // Reload UI
        clearUnsaved();
        showToast('Fabrika ayarları yüklendi.');
    }
}

async function clearFavorites() {
    if (confirm('Oyun kütüphanenizdeki TÜM oyunlar silinecek. Emin misiniz?')) {
        await chrome.storage.local.set({ 'rota_favorites': [] });
        showToast('Kütüphane temizlendi.');
    }
}

function showToast(msg) {
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.textContent = msg;
    ui.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
