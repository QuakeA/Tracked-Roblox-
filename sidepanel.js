// sidepanel.js - Tracked v1.9.5 Side Panel Script
// CSP uyumlu - harici dosya olarak yüklendi

// PING LISTENER (DOMContentLoaded öncesi register — açılır açılmaz hazır)
// Popup pin button bu mesajı gönderirse anında "alive: true" cevap → açık olduğumuzu bildirir.
// SW state tracking'inden ÇOK daha güvenilir (state cache problemi yok, doğrudan canlı kontrol).
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req?.action === 'sidePanelPing') {
        sendResponse({ alive: true });
        return false; // sync cevap
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Backward compat: SW state tracking de tutalım (3'lü güvence)
    try {
        chrome.runtime.connect({ name: 'tracked-sidepanel' });
    } catch (_) {}

    // Storage flag de güncellenir (eski Chrome fallback için)
    chrome.storage?.local?.set({ tracked_sidepanel_open: true }).catch(() => {});

    window.addEventListener('beforeunload', () => {
        chrome.storage?.local?.set({ tracked_sidepanel_open: false }).catch(() => {});
    });
    window.addEventListener('pagehide', () => {
        chrome.storage?.local?.set({ tracked_sidepanel_open: false }).catch(() => {});
    });

    // Footer sürümü: manifest'ten DİNAMİK oku → bir daha bayatlamaz (sabit v1.9.5 sorunu çözüldü)
    try {
        const v = chrome.runtime.getManifest().version;
        const sv = document.getElementById('sp-version');
        if (sv) sv.textContent = 'v' + v;
    } catch (_) {}

    // Reduced motion (accessibility): options'tan kontrol oku, body class'ı ekle
    chrome.storage?.local?.get('rota_settings').then(d => {
        if (d?.rota_settings?.reducedMotion === true) {
            document.body.classList.add('reduced-motion');
        }
    }).catch(() => {});

    // Unpin button (yan paneldeki pin/kapat butonu) — side panel'i kendi içinden kapatır.
    // ÖNCEKİ HATA: setOptions({enabled: false}) sonrası 100ms gecikme ile tekrar enabled: true
    // yapılıyordu → Chrome "kapat → aç" sinyalini override edip kapanma görünmüyordu.
    // YENİ: window.close() önce dener (en hızlı), sonra explicit tabId ile setOptions enabled:false.
    // Re-enable YAPILMIYOR — bir sonraki açılışı popup'taki pin button zaten path set'i ile başlatır.
    const btnUnpin = document.getElementById('btn-unpin');
    if (btnUnpin) {
        btnUnpin.addEventListener('click', async () => {
            // Storage flag + SW state derhal güncellenir (popup pin button toggle için)
            chrome.storage?.local?.set({ tracked_sidepanel_open: false }).catch(() => {});

            // Yöntem 1: window.close() — side panel iframe context'inde çoğu zaman çalışır
            try {
                window.close();
            } catch (_) {}

            // Yöntem 2: 50ms sonra hâlâ açıksa setOptions ile zorla kapat (tabId ile explicit)
            setTimeout(async () => {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                    if (tab?.id) {
                        await chrome.sidePanel.setOptions({ tabId: tab.id, enabled: false });
                        // 800ms sonra re-enable (Chrome'un kapatma animasyonuna fırsat ver, sonra hazır olsun)
                        setTimeout(() => {
                            chrome.sidePanel.setOptions({
                                tabId: tab.id,
                                enabled: true,
                                path: 'sidepanel.html'
                            }).catch(() => {});
                        }, 800);
                    } else {
                        // Tab bulunamazsa global setOptions
                        await chrome.sidePanel.setOptions({ enabled: false });
                    }
                } catch (err) {
                    console.warn('[SidePanel] Unpin setOptions failed:', err?.message || err);
                }
            }, 50);
        });
    }
    
    // Update status badge - side panel indicator (no background)
    const statusBadge = document.getElementById('global-status');
    if (statusBadge) {
        statusBadge.textContent = typeof TrackedI18n !== 'undefined' ? TrackedI18n.t('sidePanel') : 'Yan Panel';
        statusBadge.style.background = 'transparent';
        statusBadge.style.color = 'var(--accent-blue, #0A84FF)';
    }
    
    // Theme toggle for side panel
    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            // Save theme preference
            const isLight = document.body.classList.contains('light-mode');
            chrome.storage.local.set({ 'rota_theme': isLight ? 'light' : 'dark' });
        });
    }
    
    // Load saved theme
    chrome.storage.local.get('rota_theme', (data) => {
        if (data.rota_theme === 'light') {
            document.body.classList.add('light-mode');
        }
    });
    
    // Options button
    const btnOptions = document.getElementById('btn-options');
    if (btnOptions) {
        btnOptions.addEventListener('click', () => {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL('options.html'));
            }
        });
    }
});
