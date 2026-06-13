// reconnect_overlay.js
// Self-contained overlay for Auto-Reconnect — runs on ALL roblox.com pages
// (so kullanıcı oyun sayfasından çıkıp ana sayfaya/avatara gitse bile crash overlay görünür)

(function() {
    'use strict';

    // Çift yükleme koruması (scripting.executeScript fallback re-injects the file)
    if (window._trackedReconnectSetup) return;
    window._trackedReconnectSetup = true;

    // Reduced motion ayarı
    try {
        chrome.storage?.local?.get('rota_settings').then(d => {
            if (d?.rota_settings?.reducedMotion === true) {
                document.documentElement.classList.add('tracked-reduced-motion');
            }
        }).catch(() => {});
    } catch (_) {}

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    function showReconnectOverlay(session) {
        const existing = document.getElementById('tracked-reconnect-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'tracked-reconnect-overlay';
        overlay.className = 'tracked-reconnect-overlay';

        const sameUrl = session.jobId
            ? `roblox://experiences/start?placeId=${session.placeId}&gameInstanceId=${encodeURIComponent(session.jobId)}`
            : `roblox://experiences/start?placeId=${session.placeId}`;
        const fallbackUrl = `roblox://experiences/start?placeId=${session.placeId}`;

        const title = String(session.gameTitle || 'Roblox Oyunu').replace(/\s*\|\s*Roblox\s*$/i, '').trim();
        const shortTitle = title.length > 38 ? title.substring(0, 36) + '…' : title;

        const sameButton = session.jobId
            ? `<button class="tr-reconnect-btn primary" data-action="rejoin-same">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                <span>Aynı Server'a Dön</span>
                <span class="tr-reconnect-btn-shine"></span>
              </button>`
            : '';

        const jobChip = session.jobId
            ? `<div class="tr-reconnect-chip">
                <div class="tr-chip-header">
                  <span>Server ID</span>
                  <button class="tr-copy-btn" data-full-id="${escapeHtml(session.jobId)}" title="Kopyala">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                </div>
                <code class="tr-full-id">${escapeHtml(session.jobId)}</code>
               </div>`
            : `<div class="tr-reconnect-chip warn">Server ID kayıt edilmedi — yeni server'a düşersin</div>`;

        const saveButton = session.jobId
            ? `<button class="tr-save-server-btn" data-action="save-server">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span>Bu Serveri Kaydet</span>
               </button>`
            : '';

        // İkinci buton: jobId varsa "Optimal Server" (ping-sorted), yoksa "Yeniden Gir" (fallback default join)
        const optimalLabel = session.jobId ? 'Optimal Sunucu' : 'Yeniden Gir';

        overlay.innerHTML = `
            <div class="tr-reconnect-backdrop"></div>
            <div class="tr-reconnect-card" role="dialog" aria-modal="true" aria-labelledby="tr-reconnect-title">
                <button class="tr-reconnect-close" data-action="close" aria-label="Kapat" title="Kapat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>

                <div class="tr-reconnect-glow"></div>

                <div class="tr-reconnect-header">
                    <div class="tr-reconnect-thumb" id="tr-reconnect-thumb">
                        <div class="tr-reconnect-thumb-fallback">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                        </div>
                    </div>
                    <div class="tr-reconnect-icon-mini">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                    </div>
                </div>

                <div class="tr-reconnect-eyebrow">
                    <span class="tr-reconnect-pulse"></span>
                    <span>BAĞLANTI KESİLDİ</span>
                </div>

                <div class="tr-reconnect-title" id="tr-reconnect-title">${escapeHtml(shortTitle)}</div>

                <div class="tr-reconnect-desc">Az önce bu oyunda oynuyordun. Bağlantın koptu — devam etmek ister misin?</div>

                ${jobChip}
                ${saveButton}

                <div class="tr-reconnect-actions">
                    ${sameButton}
                    <button class="tr-reconnect-btn ${session.jobId ? 'secondary' : 'primary'}" data-action="rejoin-optimal">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        <span data-label-text>${optimalLabel}</span>
                    </button>
                </div>

                <div class="tr-reconnect-hint">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    Tıkla ve bağlan, pencere otomatik kapanır
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Game thumbnail SW üzerinden (CORS bypass)
        try {
            chrome.runtime.sendMessage({ action: 'getGameThumbnail', placeId: session.placeId }, (resp) => {
                if (chrome.runtime.lastError) {
                    console.log('[Tracked] Thumbnail fetch error:', chrome.runtime.lastError.message);
                    return;
                }
                if (resp?.ok && resp.imageUrl) {
                    const thumb = overlay.querySelector('#tr-reconnect-thumb');
                    if (thumb) {
                        // !important ile inline style — CSS'teki shorthand !important'i override eder
                        thumb.style.setProperty('background-image', `url("${resp.imageUrl}")`, 'important');
                        thumb.style.setProperty('background-color', '#0a1929', 'important');
                        thumb.classList.add('loaded');
                    }
                } else {
                    console.log('[Tracked] Thumbnail not available:', resp?.error);
                }
            });
        } catch (_) {}

        const closeOverlay = () => {
            overlay.classList.add('closing');
            setTimeout(() => overlay.remove(), 200);
        };

        // Aynı Server'a Dön — direkt deep-link
        overlay.querySelector('[data-action="rejoin-same"]')?.addEventListener('click', () => {
            window.location.href = sameUrl;
            closeOverlay();
        });

        // Optimal Sunucu — Roblox matchmaker'a bırak (region-based selection).
        // Roblox API'sinin `ping` field'i kullanıcı-sunucu pingi DEĞİL (server iç metrik).
        // Manuel jobId-pick güvenilmez (Tokyo gibi uzak sunucu seçebiliyor).
        // Roblox matchmaker IP'den region tespit edip en yakın server'ı seçer — en güvenilir yöntem bu.
        overlay.querySelector('[data-action="rejoin-optimal"]')?.addEventListener('click', () => {
            console.log('[Tracked] Optimal Sunucu: Roblox matchmaker tetiklendi (region-optimal)');
            window.location.href = fallbackUrl; // no-jobId → Roblox region matchmaker
            closeOverlay();
        });

        overlay.querySelector('[data-action="close"]')?.addEventListener('click', closeOverlay);

        // Kopyala butonu — tam jobId panoya kopyalanır
        overlay.querySelector('.tr-copy-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const fullId = e.currentTarget.dataset.fullId;
            const btn = e.currentTarget;
            navigator.clipboard?.writeText(fullId).then(() => {
                const orig = btn.innerHTML;
                btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#30D158" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(() => { btn.innerHTML = orig; }, 1500);
            }).catch(() => {});
        });

        // Serveri kaydet butonu — rota_saved_servers'a ekler
        overlay.querySelector('[data-action="save-server"]')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            if (btn.disabled) return;
            try {
                const data = await chrome.storage.local.get('rota_saved_servers');
                const servers = data.rota_saved_servers || [];
                const alreadySaved = servers.some(s => s.jobId === session.jobId);
                if (!alreadySaved) {
                    servers.unshift({
                        placeId: session.placeId,
                        jobId: session.jobId,
                        gameTitle: String(session.gameTitle || 'Roblox Oyunu').replace(/\s*\|\s*(?:Play on\s*)?Roblox\s*$/i, '').trim(),
                        savedAt: Date.now()
                    });
                    await chrome.storage.local.set({ rota_saved_servers: servers.slice(0, 30) });
                }
                btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#30D158" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg><span>Kaydedildi ✓</span>';
                btn.classList.add('saved');
                btn.disabled = true;
            } catch (_) {}
        });
    }

    // Mesaj listener — SW'den crash overlay broadcast'ini dinle
    try {
        chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
            if (req?.action === 'showReconnectOverlay' && req.session) {
                showReconnectOverlay(req.session);
                sendResponse({ ok: true });
                return false;
            }
        });
    } catch (_) {}

    // Global expose (debugging için)
    window.TrackedReconnectOverlay = { show: showReconnectOverlay };
})();
