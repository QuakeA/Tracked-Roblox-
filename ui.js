// ui.js - Tracked Extension v3.7 UI Module (Universal Insight Tags)

const TrackedUI = {
    // v2.4.5: Global buton kilitleme durumu
    buttonLockState: {
        isLocked: false,
        // v3.0: btn-autopilot eklendi (5. buton)
        lockedButtons: ['btn-find-new', 'btn-deep-scan', 'btn-copy-id', 'btn-force-join', 'btn-cd-targeted', 'btn-autopilot']
    },

    createGameBar: (placeId) => {
        const bar = TrackedUtils.createElement('div', {
            id: 'tracked-game-bar',
            className: 'tracked-game-bar'
        });

        bar.innerHTML = `
            <div class="tracked-bar-logo" title="Tracked v3.7">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            </div>
            <button class="tracked-bar-btn btn-new-server" id="btn-find-new" title="Yeni açılmış sunucu bul">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span>Yeni</span>
            </button>
            <div class="tracked-divider"></div>
            <button class="tracked-bar-btn" id="btn-deep-scan" title="Derin tarama">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="14"></line>
                </svg>
                <span>Derin</span>
            </button>
            <div class="tracked-divider"></div>
            <button class="tracked-bar-btn" id="btn-copy-id" title="Oyun ID'sini kopyala">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>ID</span>
            </button>
            <div class="tracked-divider"></div>
            <!-- v4.1: A+B Kombo — Sniper + GameJoin API paralel yeni server -->
            <button class="tracked-bar-btn btn-force btn-beta" id="btn-force-join" title="A+B: 3 fazlı yeni server zorla — Hızlı snipe → Community block-flood → Post-block snipe">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span>A+B</span>
                <span class="beta-tag">β</span>
            </button>
            <div class="tracked-divider"></div>
            <!-- C+D Cerrahi: Public servers'tan token→userId resolve → her server'dan 1 strategic block -->
            <button class="tracked-bar-btn btn-targeted btn-beta" id="btn-cd-targeted" title="C+D Cerrahi: Token→UserID resolution ile her server'dan 1 strategic block. Minimum block, %100 kapsama hedefi.">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="6"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                </svg>
                <span>C+D</span>
                <span class="beta-tag">β</span>
            </button>
            <div class="tracked-divider"></div>
            <!-- v3.0: 5. Buton - Oto-Pilot (Mor/Auto-Blocker) -->
            <button class="tracked-bar-btn btn-autopilot" id="btn-autopilot" title="Otomatik bağlan">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span>Oto-Pilot</span>
            </button>
            <span id="tracked-status" class="tracked-status"></span>
        `;

        // v3.0: Event listener'ları güvenli şekilde ekle
        setTimeout(() => {
            const btnNew = bar.querySelector('#btn-find-new');
            const btnDeep = bar.querySelector('#btn-deep-scan');
            const btnCopy = bar.querySelector('#btn-copy-id');

            if (btnNew) {
                btnNew.onclick = () => {
                    if (TrackedUI.isAnyButtonLocked()) return;
                    if (!btnNew.disabled) TrackedApp.findNewServer(placeId);
                };
            }
            if (btnDeep) {
                btnDeep.onclick = () => {
                    if (TrackedUI.isAnyButtonLocked()) return;
                    if (!btnDeep.disabled) TrackedApp.performDeepScan(placeId);
                };
            }
            if (btnCopy) {
                btnCopy.onclick = () => {
                    if (TrackedUI.isAnyButtonLocked()) return;
                    if (!btnCopy.disabled) TrackedApp.copyGameId(placeId);
                };
            }
            
            // v4.1: A+B Kombo butonu
            const btnForce = bar.querySelector('#btn-force-join');
            if (btnForce) {
                btnForce.onclick = () => {
                    if (TrackedUI.isAnyButtonLocked()) return;
                    if (!btnForce.disabled) TrackedApp.comboNewInstance(placeId);
                };
            }

            // C+D Cerrahi: token→userId surgical targeting
            const btnTargeted = bar.querySelector('#btn-cd-targeted');
            if (btnTargeted) {
                btnTargeted.onclick = () => {
                    if (TrackedUI.isAnyButtonLocked()) return;
                    if (!btnTargeted.disabled) TrackedApp.targetedNewInstance(placeId);
                };
            }

            // v3.0: Oto-Pilot butonu - bağımsız 5. özellik
            const btnAutoPilot = bar.querySelector('#btn-autopilot');
            if (btnAutoPilot) {
                btnAutoPilot.onclick = () => {
                    if (TrackedUI.isAnyButtonLocked()) return;
                    if (!btnAutoPilot.disabled) TrackedApp.autoBlockerScan(placeId);
                };
            }
        }, 0);

        return bar;
    },

    // v2.4.5: Herhangi bir buton kilitli mi kontrol et
    isAnyButtonLocked: function() {
        return this.buttonLockState.isLocked;
    },

    // v2.4.5: TÜM butonları kilitle (global)
    lockAllButtons: function() {
        this.buttonLockState.isLocked = true;
        this.buttonLockState.lockedButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = true;
                btn.classList.add('scanning');
            }
        });
        // Bar genelinde tarama animasyonu (Yeni / Derin / A+B / Oto-Pilot — hepsi)
        const bar = document.getElementById('tracked-game-bar');
        if (bar) bar.classList.add('scanning');
        console.log('[Tracked] All buttons locked');
    },

    // v2.4.5: TÜM butonların kilidini aç
    unlockAllButtons: function() {
        this.buttonLockState.isLocked = false;
        this.buttonLockState.lockedButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('scanning');
            }
        });
        const bar = document.getElementById('tracked-game-bar');
        if (bar) bar.classList.remove('scanning');
        console.log('[Tracked] All buttons unlocked');
    },

    // v2.4.5: Geriye dönük uyumluluk için setScanning (artık tüm butonları etkiler)
    setScanning: function(btnId, active) {
        if (active) {
            this.lockAllButtons(); // v2.4.5: Aktif olduğunda hepsini kilitle
        } else {
            this.unlockAllButtons(); // v2.4.5: Pasif olduğunda hepsini aç
        }
    },

    // v2.4.5: Tüm butonları resetle
    resetAllButtons: function() {
        this.unlockAllButtons();
    },

    setStatus: (text, isError = false) => {
        const el = document.getElementById('tracked-status');
        if (!el) return;
        el.textContent = text || '';
        el.className = 'tracked-status' + (isError ? ' error' : '');
    },

    // Derin #10: Outer-edge aura pulse during scan — no DOM wrapper, just class toggle
    scanProgressEl: null,

    startScanProgress: function() {
        const bar = document.getElementById('tracked-game-bar');
        if (bar) bar.classList.add('scanning');
    },

    updateScanProgress: function(_ratio) {
        // No-op — animation is pure CSS aura pulse, no fill bar
    },

    endScanProgress: function() {
        const bar = document.getElementById('tracked-game-bar');
        if (bar) bar.classList.remove('scanning');
    },

    // ============================================
    // v2.7: Rapid Hunter - Force Mode UI
    // ============================================
    forceModeState: {
        isActive: false,
        progressBar: null,
        stopButton: null
    },

    setForceMode: function(active, onStopCallback = null) {
        const bar = document.getElementById('tracked-game-bar');
        if (!bar) return;
        
        this.forceModeState.isActive = active;
        
        if (active) {
            bar.classList.add('force-mode-active');
            
            // Progress bar oluştur
            if (!this.forceModeState.progressBar) {
                const progressContainer = document.createElement('div');
                progressContainer.className = 'force-progress-container';
                progressContainer.innerHTML = '<div class="force-progress-bar"></div>';
                bar.appendChild(progressContainer);
                this.forceModeState.progressBar = progressContainer.querySelector('.force-progress-bar');
            }
            
            // Durdur butonu ekle (eğer callback varsa)
            if (onStopCallback && !this.forceModeState.stopButton) {
                const stopBtn = document.createElement('button');
                stopBtn.className = 'tracked-bar-btn btn-stop-hunt';
                stopBtn.innerHTML = '<span>⏹ Durdur</span>';
                stopBtn.onclick = onStopCallback;
                bar.appendChild(stopBtn);
                this.forceModeState.stopButton = stopBtn;
            }
            
        } else {
            bar.classList.remove('force-mode-active');
            
            // Progress bar'ı kaldır
            const container = bar.querySelector('.force-progress-container');
            if (container) container.remove();
            this.forceModeState.progressBar = null;
            
            // Durdur butonunu kaldır
            if (this.forceModeState.stopButton) {
                this.forceModeState.stopButton.remove();
                this.forceModeState.stopButton = null;
            }
        }
    },

    updateForceProgress: function(current, total, phase) {
        if (!this.forceModeState.progressBar) return;
        
        const percent = Math.min(100, Math.round((current / total) * 100));
        this.forceModeState.progressBar.style.width = percent + '%';
        
        // Hunting modunda sürekli hareket
        if (phase === 'hunting') {
            this.forceModeState.progressBar.style.animation = 'hunting-pulse 1s infinite';
        }
    },

    clearModals: () => {
        document.querySelectorAll('.tracked-modal-overlay').forEach(m => m.remove());
    },

    createModal: (content) => {
        TrackedUI.clearModals();
        
        const overlay = TrackedUtils.createElement('div', {
            className: 'tracked-modal-overlay'
        });
        
        overlay.innerHTML = content;
        document.body.appendChild(overlay);
        
        return overlay;
    },

    showJoinModal: (placeId, server) => {
        if (!server || !server.id) {
            TrackedUI.showErrorModal('Sunucu bilgisi geçersiz');
            return;
        }

        const pingText = server.ping ? `${server.ping}ms` : 'N/A';
        const pingClass = server.ping && server.ping < 120 ? 'good' : (server.ping > 200 ? 'bad' : 'warn');
        const newBadge = server.isNew ? `<span class="new-badge">${TrackedI18n.t('newBadge')}</span>` : '';
        // v2.5: Instance Trigger başarılı olduğunda özel badge
        const forceBadge = server.isForced ? '<span class="force-badge">🔥 TRIGGER</span>' : '';

        const content = `
            <div class="tracked-modal">
                <div class="tracked-modal-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </div>
                <h3>${TrackedI18n.t('serverFound')} ${newBadge} ${forceBadge}</h3>
                <p><strong>${server.playing} ${TrackedI18n.t('playersCount')}</strong> ${TrackedI18n.t('joinQuestion')}</p>
                <div class="tracked-modal-stats">
                    <div class="stat-item">
                        <span class="stat-label">${TrackedI18n.t('player')}</span>
                        <span class="stat-value">${server.playing}/${server.maxPlayers}</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-label">${TrackedI18n.t('ping')}</span>
                        <span class="stat-value ${pingClass}">${pingText}</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-label">${TrackedI18n.t('fps')}</span>
                        <span class="stat-value">${server.fps ? Math.round(server.fps) : 'N/A'}</span>
                    </div>
                </div>
                <div class="tracked-modal-actions">
                    <button class="btn-secondary" id="modal-cancel">${TrackedI18n.t('cancel')}</button>
                    <button class="btn-primary" id="modal-join">${TrackedI18n.t('joinBtn')}</button>
                </div>
            </div>
        `;

        const modal = TrackedUI.createModal(content);
        
        modal.querySelector('#modal-cancel').onclick = () => {
            modal.remove();
            TrackedUI.unlockAllButtons(); // v2.4.5: Modal kapandığında butonları aç
        };
        
        modal.querySelector('#modal-join').onclick = () => {
            modal.remove();
            TrackedApp.joinServer(placeId, server.id);
        };
    },

    showNoServerModal: (placeId) => {
        const content = `
            <div class="tracked-modal">
                <div class="tracked-modal-icon warning">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <h3>${TrackedI18n.t('noServerFound')}</h3>
                <p>${TrackedI18n.t('noServerDesc')}</p>
                <div class="tracked-modal-actions">
                    <button class="btn-secondary" id="modal-close">${TrackedI18n.t('closeBtn')}</button>
                    <button class="btn-primary" id="modal-retry">${TrackedI18n.t('retry')}</button>
                </div>
            </div>
        `;

        const modal = TrackedUI.createModal(content);
        
        modal.querySelector('#modal-close').onclick = () => {
            modal.remove();
            TrackedUI.unlockAllButtons(); // v2.4.5
        };
        
        modal.querySelector('#modal-retry').onclick = () => {
            modal.remove();
            TrackedApp.performDeepScan(placeId);
        };
    },

    showNoNewServerModal: (placeId) => {
        const content = `
            <div class="tracked-modal">
                <div class="tracked-modal-icon warning" style="background: linear-gradient(135deg, rgba(191,90,242,0.2), rgba(191,90,242,0.05)); color: #BF5AF2;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                </div>
                <h3>${TrackedI18n.t('newServerFound')}</h3>
                <p>${TrackedI18n.t('newServerDesc')}</p>
                <div class="tracked-modal-actions">
                    <button class="btn-secondary" id="modal-close">${TrackedI18n.t('closeBtn')}</button>
                    <button class="btn-primary" id="modal-retry-normal">${TrackedI18n.t('normalScan')}</button>
                </div>
            </div>
        `;

        const modal = TrackedUI.createModal(content);
        
        modal.querySelector('#modal-close').onclick = () => {
            modal.remove();
            TrackedUI.unlockAllButtons(); // v2.4.5
        };
        
        modal.querySelector('#modal-retry-normal').onclick = () => {
            modal.remove();
            TrackedApp.performDeepScan(placeId);
        };
    },

    showErrorModal: (message) => {
        const content = `
            <div class="tracked-modal">
                <div class="tracked-modal-icon error">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                </div>
                <h3>${TrackedI18n.t('errorOccurred')}</h3>
                <p id="modal-error-msg"></p>
                <div class="tracked-modal-actions">
                    <button class="btn-danger" id="modal-ok">${TrackedI18n.t('ok')}</button>
                </div>
            </div>
        `;

        const modal = TrackedUI.createModal(content);
        modal.querySelector('#modal-error-msg').textContent = message || 'Bilinmeyen bir hata oluştu.';
        modal.querySelector('#modal-ok').onclick = () => {
            modal.remove();
            TrackedUI.unlockAllButtons(); // v2.4.5
        };
    },

    showServerListModal: (placeId, servers) => {
        if (!servers || servers.length === 0) {
            TrackedUI.showNoServerModal(placeId);
            return;
        }

        let sortField = 'score';
        let sortDir = 'desc';
        const defaultDirs = { score: 'desc', ping: 'asc', players: 'asc', fps: 'desc' };

        function sortServers(arr) {
            const sorted = [...arr];
            sorted.sort((a, b) => {
                let av = 0, bv = 0;
                switch (sortField) {
                    case 'score':   av = a.score ?? 0; bv = b.score ?? 0; break;
                    case 'ping':    av = a.ping ?? 9999; bv = b.ping ?? 9999; break;
                    case 'players': av = a.playing ?? 0; bv = b.playing ?? 0; break;
                    case 'fps':     av = a.fps ? Math.round(a.fps) : 0; bv = b.fps ? Math.round(b.fps) : 0; break;
                }
                return sortDir === 'asc' ? av - bv : bv - av;
            });
            return sorted;
        }

        function buildListHtml(filtered) {
            if (filtered.length === 0) {
                return `<div class="server-filter-empty">${TrackedI18n.t('filterNoResults')}</div>`;
            }
            const top = filtered.slice(0, 25);
            const scores = top.map(s => s.score ?? 0);
            const maxScore = Math.max(...scores, 1);
            const minScore = Math.min(...scores, 0);
            const scoreRange = maxScore - minScore || 1;

            return top.map((s, i) => {
                const pingClass = s.ping && s.ping < 100 ? 'good' : (s.ping > 200 ? 'bad' : 'warn');
                const newBadge = s.isNew ? `<span class="new-badge-small">${TrackedI18n.t('newBadge')}</span>` : '';

                const fps = s.fps ? Math.round(s.fps) : null;
                const fpsClass = fps >= 58 ? 'fps-good' : fps >= 45 ? 'fps-ok' : 'fps-bad';
                const fpsHtml = fps
                    ? `<span class="server-fps ${fpsClass}">${fps} FPS</span>`
                    : `<span class="server-fps fps-bad">N/A</span>`;

                // Derin #8: Doluluk barı (oyuncu/maxOyuncu)
                const maxP = s.maxPlayers || 1;
                const fillPct = Math.min(100, Math.round((s.playing / maxP) * 100));
                const fillColor = fillPct >= 90 ? 'rgba(255,69,58,0.40)'
                                : fillPct >= 70 ? 'rgba(255,159,10,0.35)'
                                : fillPct >= 40 ? 'rgba(255,214,10,0.30)'
                                : 'rgba(48,209,88,0.30)';

                const normScore = Math.round(((s.score - minScore) / scoreRange) * 100);
                const barColor = normScore >= 70 ? '#30D158' : normScore >= 40 ? '#FF9F0A' : '#FF453A';

                let insightBadges = '';
                if (typeof TrackedScanner !== 'undefined' && TrackedScanner.analyzeServerPlayers) {
                    const insight = TrackedScanner.analyzeServerPlayers(s);
                    insightBadges = insight.badges.map(b =>
                        `<span class="insight-badge ${b.type}" title="${b.label}">${b.icon} ${b.label}</span>`
                    ).join('');
                }

                // Ping görsel + custom tooltip — baseline ölçüldüyse her durumda tahmin
                const isEstimated = s.baseline > 0;
                const pingText = s.ping ? `${isEstimated ? '~' : ''}${s.ping}ms` : 'N/A';
                const apiPingRow = s.apiPing > 0
                    ? `<div class="ping-tt-row"><span class="ping-tt-label">API (DC içi)</span><span class="ping-tt-value">${s.apiPing}ms</span></div>`
                    : `<div class="ping-tt-row"><span class="ping-tt-label">API (DC içi)</span><span class="ping-tt-value" style="color:rgba(255,255,255,0.4);">—</span></div>`;

                // Region — muhtemel DC tahmini (ping bazlı). Baseline absurdsa region null
                const regionRow = s.region && s.region.info
                    ? `<div class="ping-tt-row"><span class="ping-tt-label">Tahmini bölge</span><span class="ping-tt-value">${s.region.info.icon} ${s.region.info.name} (${s.region.confidence === 'high' ? 'yüksek' : s.region.confidence === 'medium' ? 'orta' : 'düşük'} güven)</span></div>`
                    : `<div class="ping-tt-row"><span class="ping-tt-label">Tahmini bölge</span><span class="ping-tt-value" style="color:rgba(255,255,255,0.4);">—</span></div>`;

                // Baseline yüksekse uyarı notu (muhtemelen VPN/proxy/Roblox erişim engeli)
                const baselineHigh = s.baseline > 150;
                const noteText = baselineHigh
                    ? 'Baseline RTT yüksek — VPN/proxy/erişim engeli nedeniyle ölçüm yanıltıcı olabilir. Bölge tahmini bu nedenle gizli.'
                    : 'Pingler tahminidir, bölge ping uzaklığına göre kestirim — kesin değildir. UDP game-server pingi tarayıcıdan ölçülemez.';

                const pingTooltipHtml = isEstimated
                    ? `<div class="ping-tooltip">
                           ${apiPingRow}
                           <div class="ping-tt-row"><span class="ping-tt-label">Baseline RTT</span><span class="ping-tt-value">${s.baseline}ms</span></div>
                           <div class="ping-tt-row ping-tt-total"><span class="ping-tt-label">Tahmin</span><span class="ping-tt-value">~${s.ping}ms</span></div>
                           ${regionRow}
                           <div class="ping-tt-note">${noteText}</div>
                       </div>`
                    : '';
                const pingClasses = `server-ping ${pingClass}${isEstimated ? ' estimated' : ''}`;

                // Region badge (görsel) — düşük güvende "?" eklenir
                const regionBadgeHtml = s.region && s.region.info
                    ? `<span class="server-region" data-confidence="${s.region.confidence}" title="Tahmini bölge — ping uzaklığına göre kestirim, kesin değildir">${s.region.info.icon} ${s.region.info.name}${s.region.confidence === 'low' ? ' ?' : ''}</span>`
                    : '';

                return `
                    <div class="server-item" data-job="${s.id}">
                        <div class="server-item-row">
                            <div class="server-info">
                                <span class="server-rank">#${i + 1}</span>
                                <span class="server-players" style="--fill-pct:${fillPct}%;--fill-color:${fillColor};" title="${fillPct}% dolu">${s.playing}/${s.maxPlayers}${newBadge ? ' ' + newBadge : ''}</span>
                                <span class="${pingClasses}">${pingText}${pingTooltipHtml}</span>
                                ${fpsHtml}
                                ${regionBadgeHtml}
                            </div>
                            <div class="server-actions">
                                <button class="server-copy-btn" data-job="${s.id}" title="${TrackedI18n.t('copyJobId')}">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                                <button class="server-join-btn" data-job="${s.id}">${TrackedI18n.t('join')}</button>
                            </div>
                        </div>
                        <div class="server-score-row">
                            <div class="server-score-bar">
                                <div class="server-score-fill" style="width:${normScore}%;background:${barColor}"></div>
                            </div>
                            <span class="server-score-label" style="color:${barColor}">${normScore}</span>
                        </div>
                        ${insightBadges ? `<div class="insight-badges">${insightBadges}</div>` : ''}
                    </div>
                `;
            }).join('');
        }

        function applyFilters(modal) {
            const maxPing    = parseInt(modal.querySelector('#filter-ping').value)    || Infinity;
            const maxPlayers = parseInt(modal.querySelector('#filter-players').value) || Infinity;
            const minFps     = parseInt(modal.querySelector('#filter-fps').value)     || 0;

            const filtered = servers.filter(s => {
                if (s.ping && s.ping > maxPing) return false;
                if (s.playing > maxPlayers) return false;
                if (minFps > 0 && (!s.fps || Math.round(s.fps) < minFps)) return false;
                return true;
            });

            const sorted = sortServers(filtered);

            const list = modal.querySelector('.server-list');
            list.innerHTML = buildListHtml(sorted);

            list.querySelectorAll('.server-join-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const jobId = e.currentTarget.dataset.job;
                    modal.remove();
                    TrackedApp.joinServer(placeId, jobId);
                };
            });

            // Ping tooltip — fixed positioning, hover'da konum güncelle
            list.querySelectorAll('.server-ping.estimated').forEach(span => {
                const tooltip = span.querySelector('.ping-tooltip');
                if (!tooltip) return;
                span.addEventListener('mouseenter', () => {
                    const rect = span.getBoundingClientRect();
                    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                    tooltip.style.top = rect.top + 'px';
                });
            });

            list.querySelectorAll('.server-copy-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const jobId = btn.dataset.job;
                    navigator.clipboard.writeText(jobId).then(() => {
                        btn.classList.add('copied');
                        const origHtml = btn.innerHTML;
                        btn.innerHTML = '<span style="font-size:13px;font-weight:800;">✓</span>';
                        btn.title = TrackedI18n.t('jobIdCopied');
                        setTimeout(() => {
                            btn.classList.remove('copied');
                            btn.innerHTML = origHtml;
                            btn.title = TrackedI18n.t('copyJobId');
                        }, 1200);
                    }).catch(() => {});
                };
            });

            modal.querySelectorAll('.sort-btn').forEach(btn => {
                const isActive = btn.dataset.sort === sortField;
                btn.classList.toggle('active', isActive);
                const arrow = btn.querySelector('.sort-arrow');
                if (arrow) arrow.textContent = isActive ? (sortDir === 'asc' ? '↑' : '↓') : '';
            });
        }

        const content = `
            <div class="tracked-modal" style="width: 420px;">
                <div class="tracked-modal-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <h3>${TrackedI18n.t('bestServers')}</h3>
                <p>${servers.length} ${TrackedI18n.t('serversScanned')}</p>
                <div class="server-filter-row">
                    <label class="filter-label">
                        <span>${TrackedI18n.t('filterMaxPing')}</span>
                        <input type="number" id="filter-ping" placeholder="∞" min="0" max="9999" step="10">
                    </label>
                    <label class="filter-label">
                        <span>${TrackedI18n.t('filterMaxPlayers')}</span>
                        <input type="number" id="filter-players" placeholder="∞" min="0">
                    </label>
                    <label class="filter-label">
                        <span>${TrackedI18n.t('filterMinFps')}</span>
                        <input type="number" id="filter-fps" placeholder="—" min="0" max="60">
                    </label>
                </div>
                <div class="server-sort-row">
                    <button class="sort-btn active" data-sort="score">${TrackedI18n.t('sortByScore')}<span class="sort-arrow">↓</span></button>
                    <button class="sort-btn" data-sort="ping">${TrackedI18n.t('ping')}<span class="sort-arrow"></span></button>
                    <button class="sort-btn" data-sort="players">${TrackedI18n.t('player')}<span class="sort-arrow"></span></button>
                    <button class="sort-btn" data-sort="fps">${TrackedI18n.t('fps')}<span class="sort-arrow"></span></button>
                </div>
                <div class="server-list"></div>
                <div class="modal-action-row">
                    <button class="btn-secondary modal-refresh-btn" id="modal-refresh">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <polyline points="1 20 1 14 7 14"></polyline>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        <span>${TrackedI18n.t('refresh')}</span>
                    </button>
                    <button class="btn-secondary" id="modal-close">${TrackedI18n.t('close')}</button>
                </div>
            </div>
        `;

        const modal = TrackedUI.createModal(content);
        applyFilters(modal);

        ['filter-ping', 'filter-players', 'filter-fps'].forEach(id => {
            const input = modal.querySelector(`#${id}`);
            if (input) input.addEventListener('input', () => applyFilters(modal));
        });

        modal.querySelectorAll('.sort-btn').forEach(btn => {
            btn.onclick = () => {
                const field = btn.dataset.sort;
                if (sortField === field) {
                    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    sortField = field;
                    sortDir = defaultDirs[field];
                }
                applyFilters(modal);
            };
        });

        const refreshBtn = modal.querySelector('#modal-refresh');
        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                if (refreshBtn.disabled) return;
                refreshBtn.disabled = true;
                refreshBtn.classList.add('refreshing');
                try {
                    const newServers = await TrackedApp.refreshDeepScanForModal(placeId);
                    if (Array.isArray(newServers) && newServers.length > 0) {
                        servers.length = 0;
                        servers.push(...newServers);
                        const countP = modal.querySelector('.tracked-modal > p');
                        if (countP) countP.textContent = `${servers.length} ${TrackedI18n.t('serversScanned')}`;
                        applyFilters(modal);
                    } else {
                        const list = modal.querySelector('.server-list');
                        if (list) list.innerHTML = `<div class="server-filter-empty">${TrackedI18n.t('filterNoResults')}</div>`;
                    }
                } catch (err) {
                    console.log('[Tracked] Modal refresh hatası:', err.message);
                    const list = modal.querySelector('.server-list');
                    if (list) list.innerHTML = `<div class="server-filter-empty">${TrackedI18n.t('scanError')}</div>`;
                } finally {
                    refreshBtn.disabled = false;
                    refreshBtn.classList.remove('refreshing');
                }
            };
        }

        modal.querySelector('#modal-close').onclick = () => {
            modal.remove();
            TrackedUI.unlockAllButtons();
        };
    },

    showNewServerListModal: (placeId, servers) => {
        if (!servers || servers.length === 0) {
            TrackedUI.showNoNewServerModal(placeId);
            return;
        }

        const listHtml = servers.slice(0, 8).map((s, i) => {
            const pingClass = s.ping && s.ping < 100 ? 'good' : (s.ping > 200 ? 'bad' : 'warn');
            const freshness = s.playing <= 2 ? TrackedI18n.t('veryFresh') : (s.playing <= 5 ? TrackedI18n.t('fresh') : TrackedI18n.t('newBadge'));
            return `
                <div class="server-item new-server-item" data-job="${s.id}">
                    <div class="server-item-row">
                        <div class="server-info">
                            <span class="server-rank" style="color: #BF5AF2;">#${i + 1}</span>
                            <span class="server-players">${s.playing}/${s.maxPlayers}</span>
                            <span class="freshness-badge">${freshness}</span>
                            <span class="server-ping ${pingClass}">${s.ping ? s.ping + 'ms' : 'N/A'}</span>
                        </div>
                        <div class="server-actions">
                            <button class="server-join-btn btn-new" data-job="${s.id}">${TrackedI18n.t('join')}</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const content = `
            <div class="tracked-modal" style="width: 440px;">
                <div class="tracked-modal-icon" style="background: linear-gradient(135deg, rgba(191,90,242,0.2), rgba(191,90,242,0.05)); color: #BF5AF2;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                </div>
                <h3>${TrackedI18n.t('newServersFound')}</h3>
                <p>${TrackedI18n.t('freshServers')}</p>
                <div class="server-list">${listHtml}</div>
                <button class="btn-secondary" id="modal-close" style="width: 100%; margin-top: 12px;">${TrackedI18n.t('close')}</button>
            </div>
        `;

        const modal = TrackedUI.createModal(content);
        
        modal.querySelectorAll('.server-join-btn').forEach(btn => {
            btn.onclick = (e) => {
                const jobId = e.target.dataset.job;
                modal.remove();
                TrackedApp.joinServer(placeId, jobId);
            };
        });
        
        modal.querySelector('#modal-close').onclick = () => {
            modal.remove();
            TrackedUI.unlockAllButtons(); // v2.4.5
        };
    },

    // ============================================
    // v2.5: Instance Trigger - Failed Modal
    // ============================================
    showForceFailedModal: (placeId) => {
        const content = `
            <div class="tracked-modal">
                <div class="tracked-modal-icon warning" style="background: linear-gradient(135deg, rgba(255,69,58,0.2), rgba(255,69,58,0.05)); color: #FF453A;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                    </svg>
                </div>
                <h3>${TrackedI18n.t('instanceTriggerFailed')}</h3>
                <p>${TrackedI18n.t('instanceTriggerDesc')}</p>
                <div class="tracked-modal-actions">
                    <button class="btn-secondary" id="modal-close">${TrackedI18n.t('closeBtn')}</button>
                    <button class="btn-primary" id="modal-retry-normal">${TrackedI18n.t('normalScanRetry')}</button>
                </div>
            </div>
        `;

        const modal = TrackedUI.createModal(content);
        
        modal.querySelector('#modal-close').onclick = () => {
            modal.remove();
            TrackedUI.unlockAllButtons();
        };
        
        modal.querySelector('#modal-retry-normal').onclick = () => {
            modal.remove();
            TrackedApp.performDeepScan(placeId);
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackedUI;
}
