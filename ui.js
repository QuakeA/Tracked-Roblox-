// ui.js - Tracked Extension v3.7 UI Module (Universal Insight Tags)

const TrackedUI = {
    // v2.4.5: Global buton kilitleme durumu
    buttonLockState: {
        isLocked: false,
        // v3.0: btn-autopilot eklendi (5. buton)
        lockedButtons: ['btn-find-empty', 'btn-find-new', 'btn-deep-scan', 'btn-copy-id', 'btn-force-join', 'btn-autopilot']
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
            <button class="tracked-bar-btn" id="btn-find-empty" title="En boş sunucuyu bul">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span>Boş</span>
            </button>
            <div class="tracked-divider"></div>
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
            <!-- v2.4.2+: 4. Buton - Zorla Boş Sunucu Aç (Kırmızı/Deneysel) -->
            <button class="tracked-bar-btn btn-force" id="btn-force-join" title="Yeni sunucu oluşturmaya zorla">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                </svg>
                <span>Zorla</span>
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
            const btnEmpty = bar.querySelector('#btn-find-empty');
            const btnNew = bar.querySelector('#btn-find-new');
            const btnDeep = bar.querySelector('#btn-deep-scan');
            const btnCopy = bar.querySelector('#btn-copy-id');

            if (btnEmpty) {
                btnEmpty.onclick = () => {
                    if (TrackedUI.isAnyButtonLocked()) return;
                    if (!btnEmpty.disabled) TrackedApp.findEmptyServer(placeId);
                };
            }
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
            
            // v2.4.2+: Force Join butonu
            const btnForce = bar.querySelector('#btn-force-join');
            if (btnForce) {
                btnForce.onclick = () => {
                    if (TrackedUI.isAnyButtonLocked()) return;
                    if (!btnForce.disabled) TrackedApp.forceNewInstance(placeId);
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
        const newBadge = server.isNew ? '<span class="new-badge">YENİ</span>' : '';
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
                <h3>Sunucu Bulundu! ${newBadge} ${forceBadge}</h3>
                <p><strong>${server.playing} oyuncu</strong> olan bir sunucu bulundu. Katılmak istiyor musun?</p>
                <div class="tracked-modal-stats">
                    <div class="stat-item">
                        <span class="stat-label">OYUNCU</span>
                        <span class="stat-value">${server.playing}/${server.maxPlayers}</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-label">PING</span>
                        <span class="stat-value ${pingClass}">${pingText}</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-label">FPS</span>
                        <span class="stat-value">${server.fps ? Math.round(server.fps) : 'N/A'}</span>
                    </div>
                </div>
                <div class="tracked-modal-actions">
                    <button class="btn-secondary" id="modal-cancel">VAZGEÇ</button>
                    <button class="btn-primary" id="modal-join">KATIL</button>
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
                <h3>Sunucu Bulunamadı</h3>
                <p>Şu anda uygun bir sunucu bulunmuyor.</p>
                <div class="tracked-modal-actions">
                    <button class="btn-secondary" id="modal-close">KAPAT</button>
                    <button class="btn-primary" id="modal-retry">TEKRAR DENE</button>
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
            TrackedApp.findEmptyServer(placeId);
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
                <h3>Yeni Sunucu Bulunamadı</h3>
                <p>Şu anda yeni açılmış sunucu bulunmuyor.</p>
                <p style="font-size: 12px; opacity: 0.7;">Normal tarama ile devam edilsin mi?</p>
                <div class="tracked-modal-actions">
                    <button class="btn-secondary" id="modal-close">KAPAT</button>
                    <button class="btn-primary" id="modal-retry-normal">NORMAL TARA</button>
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
            TrackedApp.findEmptyServer(placeId);
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
                <h3>Hata Oluştu</h3>
                <p>${message || 'Bilinmeyen bir hata oluştu.'}</p>
                <div class="tracked-modal-actions">
                    <button class="btn-danger" id="modal-ok">TAMAM</button>
                </div>
            </div>
        `;

        const modal = TrackedUI.createModal(content);
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

        const listHtml = servers.slice(0, 10).map((s, i) => {
            const pingClass = s.ping && s.ping < 100 ? 'good' : (s.ping > 200 ? 'bad' : 'warn');
            const newBadge = s.isNew ? '<span class="new-badge-small">YENİ</span>' : '';
            
            // v3.6: Player Insight badges (simulated)
            let insightBadges = '';
            if (typeof TrackedScanner !== 'undefined' && TrackedScanner.analyzeServerPlayers) {
                const insight = TrackedScanner.analyzeServerPlayers(s);
                insightBadges = insight.badges.map(b => 
                    `<span class="insight-badge ${b.type}" title="${b.label}">${b.icon} ${b.label}</span>`
                ).join('');
            }
            
            return `
                <div class="server-item" data-job="${s.id}">
                    <div class="server-info">
                        <span class="server-rank">#${i + 1}</span>
                        <span class="server-players">${s.playing}/${s.maxPlayers} ${newBadge}</span>
                        <span class="server-ping ${pingClass}">${s.ping ? s.ping + 'ms' : 'N/A'}</span>
                    </div>
                    ${insightBadges ? `<div class="insight-badges">${insightBadges}</div>` : ''}
                    <button class="server-join-btn" data-job="${s.id}">KATIL</button>
                </div>
            `;
        }).join('');

        const content = `
            <div class="tracked-modal" style="width: 420px;">
                <div class="tracked-modal-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <h3>En İyi Sunucular</h3>
                <p>${servers.length} sunucu tarandı. En iyileri seç:</p>
                <div class="server-list">${listHtml}</div>
                <button class="btn-secondary" id="modal-close" style="width: 100%; margin-top: 12px;">Kapat</button>
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

    showNewServerListModal: (placeId, servers) => {
        if (!servers || servers.length === 0) {
            TrackedUI.showNoNewServerModal(placeId);
            return;
        }

        const listHtml = servers.slice(0, 8).map((s, i) => {
            const pingClass = s.ping && s.ping < 100 ? 'good' : (s.ping > 200 ? 'bad' : 'warn');
            const freshness = s.playing <= 2 ? 'Çok Taze' : (s.playing <= 5 ? 'Taze' : 'Yeni');
            return `
                <div class="server-item new-server-item" data-job="${s.id}">
                    <div class="server-info">
                        <span class="server-rank" style="color: #BF5AF2;">#${i + 1}</span>
                        <span class="server-players">${s.playing}/${s.maxPlayers}</span>
                        <span class="freshness-badge">${freshness}</span>
                        <span class="server-ping ${pingClass}">${s.ping ? s.ping + 'ms' : 'N/A'}</span>
                    </div>
                    <button class="server-join-btn btn-new" data-job="${s.id}">KATIL</button>
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
                <h3>🌟 Yeni Sunucular Bulundu!</h3>
                <p>Roblox'un en son eklediği taze sunucular:</p>
                <div class="server-list">${listHtml}</div>
                <button class="btn-secondary" id="modal-close" style="width: 100%; margin-top: 12px;">Kapat</button>
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
                <h3>Instance Trigger Başarısız</h3>
                <p>Yük dengeleyici yeni instance oluşturmadı.</p>
                <p style="font-size: 12px; opacity: 0.7;">10+ burst istek ve 2 lokasyon denemesine rağmen<br>boş slot açılamadı. Normal tarama denensin mi?</p>
                <div class="tracked-modal-actions">
                    <button class="btn-secondary" id="modal-close">KAPAT</button>
                    <button class="btn-primary" id="modal-retry-normal">NORMAL TARA</button>
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
            TrackedApp.findEmptyServer(placeId);
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackedUI;
}
