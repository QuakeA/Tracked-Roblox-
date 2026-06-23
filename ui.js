// ui.js - Tracked Extension v3.7 UI Module (Universal Insight Tags)

const TrackedUI = {
    // v2.4.5: Global buton kilitleme durumu
    buttonLockState: {
        isLocked: false,
        lockedButtons: ['btn-find-new', 'btn-deep-scan', 'btn-copy-id', 'btn-autopilot', 'btn-watch']
    },

    createGameBar: (placeId) => {
        const bar = TrackedUtils.createElement('div', {
            id: 'tracked-game-bar',
            className: 'tracked-game-bar'
        });

        bar.innerHTML = `
            <div class="tracked-bar-logo brand" aria-hidden="true">
                <span class="tk-ping"></span>
                <span class="tk-ico tk-brand-ico">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <g class="tk-brand-rings"><circle cx="12" cy="12" r="9.5"></circle><circle cx="12" cy="12" r="3"></circle></g>
                    </svg>
                </span>
            </div>
            <button class="tracked-bar-btn btn-autopilot tk-play" id="btn-autopilot" title="Oto-Pilot ile en yakın sunucuya otomatik bağlan">
                <span class="tk-ico">
                    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2.6l7.4 3v5.1c0 4.4-3.1 7.8-7.4 9-4.3-1.2-7.4-4.6-7.4-9V5.6l7.4-3z"></path>
                        <path class="tk-shield-check" pathLength="1" d="M8.7 12.1l2.3 2.3 4.3-4.5"></path>
                    </svg>
                </span>
                <span class="tk-tip">Oto-Pilot</span>
            </button>
            <div class="tracked-divider"></div>
            <button class="tracked-bar-btn btn-new-server tk-act" id="btn-find-new" title="Yeni açılmış sunucu bul">
                <span class="tk-ico">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <rect class="tk-sig tk-sig1" x="3" y="14" width="3.4" height="7" rx="1.5"></rect>
                        <rect class="tk-sig tk-sig2" x="8" y="10.5" width="3.4" height="10.5" rx="1.5"></rect>
                        <rect class="tk-sig tk-sig3" x="13" y="7" width="3.4" height="14" rx="1.5"></rect>
                        <rect class="tk-sig tk-sig4" x="18" y="3.5" width="3.4" height="17.5" rx="1.5"></rect>
                    </svg>
                </span>
                <span class="tk-tip">Yeni</span>
            </button>
            <button class="tracked-bar-btn tk-act" id="btn-deep-scan" title="Derin tarama">
                <span class="tk-ico">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
                        <g class="tk-lens"><circle cx="10.5" cy="10.5" r="6.2"></circle></g>
                        <line x1="20.5" y1="20.5" x2="15" y2="15"></line>
                    </svg>
                </span>
                <span class="tk-tip">Derin</span>
            </button>
            <button class="tracked-bar-btn tk-act" id="btn-copy-id" title="Oyun ID'sini kopyala">
                <span class="tk-ico">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="6" width="18" height="12" rx="2.4"></rect>
                        <circle cx="8.2" cy="11.2" r="2.1"></circle>
                        <path d="M6 15.2c.5-1.1 1.3-1.7 2.2-1.7s1.7.6 2.2 1.7" stroke-width="1.4"></path>
                        <line class="tk-id-l tk-id-l1" x1="13.5" y1="10" x2="18" y2="10"></line>
                        <line class="tk-id-l tk-id-l2" x1="13.5" y1="13.4" x2="17" y2="13.4"></line>
                    </svg>
                </span>
                <span class="tk-tip">ID</span>
            </button>
            <button class="tracked-bar-btn btn-watch tk-act" id="btn-watch" title="Sunucu Bekçisi — kriterli sunucu açılınca bildir/oto-katıl">
                <span class="tk-ico">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2.4 12s3.7-6.6 9.6-6.6S21.6 12 21.6 12s-3.7 6.6-9.6 6.6S2.4 12 2.4 12z"></path>
                        <circle class="tk-pupil" cx="12" cy="12" r="2.8"></circle>
                    </svg>
                </span>
                <span class="tk-tip">Bekçi</span>
            </button>
            <span class="tk-ind" aria-hidden="true"></span>
            <button class="tk-bar-lock" id="tk-bar-lock" title="Gelişmiş sunucu araçları Tracked Plus'ta — yükseltmek için tıkla">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z"/></svg>
            </button>
            <div class="tk-scan-lock" aria-hidden="true">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4.5" y="10.5" width="15" height="10" rx="3.2"></rect>
                    <path d="M7.8 10.5V7.4a4.2 4.2 0 0 1 8.4 0v3.1"></path>
                    <path d="M12 14.4v2"></path>
                </svg>
            </div>
            <span id="tracked-status" class="tracked-status"></span>
        `;

        // v3.0: Event listener'ları güvenli şekilde ekle
        setTimeout(() => {
            // ── Tracked Plus: gelişmiş sunucu araçları (Yeni/Derin/Oto-Pilot/Bekçi) Pro. Her butona
            //    ayrı rozet yerine bar'da TEK kilit (logodan sonra). Plus alınca kilit gizlenir. ──
            const isPlus = () => (window.TrackedLicense ? window.TrackedLicense.isPlus() : Promise.resolve(false));
            const proGuard = async () => { if (await isPlus()) return true; try { chrome.runtime.sendMessage({ action: 'openPlusPage' }); } catch (_) {} return false; };
            const barLock = bar.querySelector('#tk-bar-lock');
            if (barLock) barLock.onclick = (e) => { e.stopPropagation(); proGuard(); };
            const refreshLocks = async () => { bar.classList.toggle('tk-plus', await isPlus()); };
            refreshLocks();
            if (window.TrackedLicense) window.TrackedLicense.onChange(refreshLocks);

            // Yan ray: hover'da kayan mavi gösterge (aktif ikonun yanına)
            const railInd = bar.querySelector('.tk-ind');
            if (railInd) {
                bar.querySelectorAll('.tk-act, .tk-play').forEach((b) => {
                    b.addEventListener('mouseenter', () => {
                        railInd.style.setProperty('--tk-y', (b.offsetTop + b.offsetHeight / 2 - 11) + 'px');
                        railInd.classList.add('show');
                    });
                });
                bar.addEventListener('mouseleave', () => railInd.classList.remove('show'));
            }

            const btnNew = bar.querySelector('#btn-find-new');
            const btnDeep = bar.querySelector('#btn-deep-scan');
            const btnCopy = bar.querySelector('#btn-copy-id');

            if (btnNew) {
                btnNew.onclick = async () => {
                    if (!(await proGuard())) return;
                    if (TrackedUI.isAnyButtonLocked()) return;
                    if (!btnNew.disabled) TrackedApp.findNewServer(placeId);
                };
            }
            if (btnDeep) {
                btnDeep.onclick = async () => {
                    if (!(await proGuard())) return;
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

            // Oto-Pilot — bağımsız buton (en yakın sunucuya otomatik bağlan)
            const btnAutoPilot = bar.querySelector('#btn-autopilot');
            if (btnAutoPilot) {
                btnAutoPilot.onclick = async () => {
                    if (!(await proGuard())) return;
                    if (TrackedUI.isAnyButtonLocked()) return;
                    if (!btnAutoPilot.disabled) TrackedApp.autoBlockerScan(placeId);
                };
            }

            // Sunucu Bekçisi — modal aç (tarama kilidinden bağımsız; sadece modal açar)
            const btnWatch = bar.querySelector('#btn-watch');
            if (btnWatch) {
                btnWatch.dataset.placeId = String(placeId);
                btnWatch.onclick = async () => { if (!(await proGuard())) return; TrackedApp.openServerWatch(placeId); };
                // Bu oyun için bekçi aktifse butonu işaretle
                try {
                    chrome.runtime.sendMessage({ action: 'getServerWatch', placeId }, (resp) => {
                        const w = resp && resp.ok ? resp.watch : null;
                        btnWatch.classList.toggle('watching', !!(w && Number(w.placeId) === Number(placeId)));
                    });
                } catch (_) {}
                // CANLI: bekçi durunca (sunucu bulununca/SW silince) butonun yeşil işareti otomatik gitsin.
                if (!window._tkWatchStorageListener) {
                    window._tkWatchStorageListener = true;
                    try {
                        chrome.storage.onChanged.addListener((changes, area) => {
                            if (area !== 'local' || !('tracked_server_watch' in changes)) return;
                            const b = document.getElementById('btn-watch');
                            if (!b) return;
                            const nw = changes.tracked_server_watch.newValue; // silinince undefined
                            const pid = b.dataset.placeId;
                            b.classList.toggle('watching', !!(nw && pid && String(nw.placeId) === String(pid)));
                        });
                    } catch (_) {}
                }
            }
        }, 0);

        return bar;
    },

    // Sunucu Bekçisi modal'ı — kriter belirle + bildir/oto-katıl, ya da aktifse durdur.
    // watch = bu oyunun bekçisi; active = (tek-oyun) herhangi bir oyunda aktif bekçi.
    showServerWatchModal: (placeId, watch, active) => {
        const EYE = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
        // Bu oyun izlenmiyor ama BAŞKA oyunda bekçi aktifse → uyar (tek oyun; başlatmak onu durdurur).
        const otherActive = (!watch && active) ? active : null;
        const warnHtml = otherActive
            ? `<div class="watch-warn">${TrackedI18n.t('watchOtherActive').replace('{game}', esc(otherActive.gameTitle))}</div>`
            : '';
        let content;
        if (watch) {
            const actLabel = watch.action === 'autojoin' ? TrackedI18n.t('watchAutoJoin') : TrackedI18n.t('watchNotify');
            const desc = TrackedI18n.t('watchActiveDesc').replace('{max}', watch.maxPlayers).replace('{action}', actLabel);
            content = `
                <div class="tracked-modal">
                    <div class="tracked-modal-icon">${EYE}</div>
                    <h3>${TrackedI18n.t('serverWatchTitle')}</h3>
                    <p>${desc}</p>
                    <div class="tracked-modal-actions">
                        <button class="btn-secondary" id="watch-close">${TrackedI18n.t('close')}</button>
                        <button class="btn-danger" id="watch-stop">${TrackedI18n.t('watchStop')}</button>
                    </div>
                </div>`;
        } else {
            content = `
                <div class="tracked-modal">
                    <div class="tracked-modal-icon">${EYE}</div>
                    <h3>${TrackedI18n.t('serverWatchTitle')}</h3>
                    <p>${TrackedI18n.t('serverWatchDesc')}</p>
                    ${warnHtml}
                    <div class="server-filter-row">
                        <label class="filter-label" style="flex:1 1 100%;"><span>${TrackedI18n.t('watchTargetLabel')}</span>
                            <input type="number" id="watch-target" placeholder="—" min="1" max="200"></label>
                    </div>
                    <p class="watch-region-note">${TrackedI18n.t('watchRegionNote')}</p>
                    <div class="watch-action-row">
                        <button class="watch-act-btn active" data-act="notify">${TrackedI18n.t('watchNotify')}</button>
                        <button class="watch-act-btn" data-act="autojoin">${TrackedI18n.t('watchAutoJoin')}</button>
                    </div>
                    <div class="tracked-modal-actions">
                        <button class="btn-secondary" id="watch-close">${TrackedI18n.t('close')}</button>
                        <button class="btn-primary" id="watch-start">${TrackedI18n.t('watchStart')}</button>
                    </div>
                </div>`;
        }
        const modal = TrackedUI.createModal(content);
        modal.querySelector('#watch-close').onclick = () => modal.remove();
        if (watch) {
            modal.querySelector('#watch-stop').onclick = () => { modal.remove(); TrackedApp.stopServerWatch(); };
        } else {
            let act = 'notify';
            let gameCapacity = null;   // oyunun gerçek sunucu kapasitesi
            let maxTarget = 200;       // izin verilen en yüksek hedef (kapasite gelince cap-1 olur; dolu katılınamaz)
            modal.querySelectorAll('.watch-act-btn').forEach(b => b.onclick = () => {
                act = b.dataset.act;
                modal.querySelectorAll('.watch-act-btn').forEach(x => x.classList.toggle('active', x === b));
            });

            const targetIn = modal.querySelector('#watch-target');
            const clampTarget = () => {
                if (!targetIn) return;
                const v = parseInt(targetIn.value);
                if (!isNaN(v) && v > maxTarget) targetIn.value = String(maxTarget);   // kapasiteyi AŞAMAZ (canlı)
            };
            if (targetIn) {
                targetIn.addEventListener('input', clampTarget);   // yazarken anında sınırla
                targetIn.addEventListener('blur', () => {          // odaktan çıkınca alt sınırı da düzelt
                    const v = parseInt(targetIn.value);
                    if (!isNaN(v) && v < 1) targetIn.value = '1';
                });
            }

            modal.querySelector('#watch-start').onclick = () => {
                const known = (typeof gameCapacity === 'number' && gameCapacity > 0);
                let target = parseInt(targetIn && targetIn.value);
                // Boşsa: kapasite biliniyorsa en dolu joinable (cap-1); bilinmiyorsa makul bir hedef (10).
                if (!target || target < 1) target = known ? maxTarget : Math.min(10, maxTarget);
                if (target > maxTarget) target = maxTarget;          // güvenlik: kapasiteyi aşamaz
                const gameTitle = (typeof document !== 'undefined' && document.title) ? document.title.replace(/\s*-\s*Roblox\s*$/i, '').trim() : '';
                modal.remove();
                // maxPlayers: kapasite BİLİNİYORSA gerçek değer, bilinmiyorsa 0 (gösterimde "/kapasite" gizlenir;
                // filtre zaten per-server kapasiteyle "dolu değil" kontrolü yapar). Sahte sayı (201 gibi) ÜRETİLMEZ.
                TrackedApp.startServerWatch(placeId, { maxPlayers: known ? gameCapacity : 0, minPlayers: target, action: act, gameTitle });
            };

            // AKILLI KAPASİTE: oyunun gerçek sunucu kapasitesini çek → hedef sınırını (cap-1) ayarla + ipucu.
            (async () => {
                try {
                    const r = await fetch(`https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100`, { headers: { Accept: 'application/json' }, credentials: 'omit' });
                    if (!r.ok) return;
                    const d = await r.json();
                    const cap = (d.data || []).map(s => s && s.maxPlayers).find(n => typeof n === 'number' && n > 0);
                    if (!cap) return;
                    gameCapacity = cap;
                    maxTarget = Math.max(1, cap - 1);
                    if (targetIn) {
                        targetIn.max = String(maxTarget);
                        if (!targetIn.value) targetIn.value = String(maxTarget);   // boşsa varsayılan = en dolu joinable
                        else clampTarget();                                        // zaten yazılmış değer aşıyorsa geri çek
                    }
                    const note = modal.querySelector('.watch-region-note');
                    if (note && note.parentNode && !modal.querySelector('.watch-capacity-hint')) {
                        const hint = document.createElement('p');
                        hint.className = 'watch-capacity-hint';
                        hint.textContent = TrackedI18n.t('watchCapacityHint').replace(/\{cap\}/g, cap).replace(/\{max\}/g, maxTarget);
                        note.parentNode.insertBefore(hint, note);
                    }
                } catch (_) {}
            })();
        }
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
        // Bar genelinde tarama animasyonu (Yeni / Derin / Oto-Pilot — hepsi)
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

    // Sunucu satırı için perf + bölge chip'leri (Derin + Yeni listesi paylaşır).
    // Durumlar: çözüldü → bölge/mesafe/sürüm; başarısız → bilinmiyor; pending → loading; aksi → tıkla-çöz.
    regionChipsHtml: function (s) {
        const PIN = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
        const perf = (typeof TrackedRegion !== 'undefined') ? TrackedRegion.perfPct(s) : null;
        const perfChip = (perf !== null)
            ? `<span class="server-perf ${perf >= 85 ? 'perf-good' : perf >= 60 ? 'perf-ok' : 'perf-bad'}" title="${TrackedI18n.t('perfLabel')}">${perf}%</span>`
            : '';
        const TARGET = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4.5"></circle></svg>';
        let regionChip;
        if (s.regionResolved && s.region && !s.regionFailed) {
            // Yakınlık: bölgesinin ölçülen ping'i varsa GERÇEK ping; yoksa mesafe (km).
            const closeness = (typeof s.measuredPing === 'number')
                ? `<span class="server-ping" title="${TrackedI18n.t('measuredPingTip')}">${s.measuredPing} ms</span>`
                : '';
            const ver = s.placeVersion ? `<span class="server-version">v${s.placeVersion}</span>` : '';
            const rec = s.recommended ? `<span class="region-recommend" title="${TrackedI18n.t('recommendedTip')}">${TARGET}${TrackedI18n.t('recommended')}</span>` : '';
            const flag = (typeof tkFlag === 'function') ? tkFlag(s.region) : '';
            regionChip = `${rec}<span class="server-region">${flag || PIN}${s.region}</span>${closeness}${ver}`;
        } else if (s.regionResolved && s.regionFailed) {
            regionChip = `<span class="server-region unknown">${PIN}${TrackedI18n.t('regionUnknown')}</span>`;
        } else if (s.regionPending) {
            regionChip = `<span class="server-region region-loading">${TrackedI18n.t('regionLoading')}</span>`;
        } else {
            regionChip = `<button class="region-show-btn" data-job="${s.id}">${PIN}${TrackedI18n.t('regionShow')}</button>`;
        }
        return perfChip + regionChip;
    },

    // Çözülmüş sunucular içinde EN YAKINI (ölçülen ping → mesafe) "Önerilen" işaretle (Derin + Yeni paylaşır).
    markRecommended: function (arr) {
        if (typeof TrackedRegion === 'undefined' || !Array.isArray(arr)) return;
        let best = null, bestKey = null;
        arr.forEach(s => { s.recommended = false; });
        for (const s of arr) {
            if (!s.regionResolved || s.regionFailed) continue;
            const k = TrackedRegion.regionSortKey(s);
            if (k[0] === 2) continue;
            if (!best || k[0] < bestKey[0] || (k[0] === bestKey[0] && k[1] < bestKey[1])) { best = s; bestKey = k; }
        }
        if (best) best.recommended = true;
    },

    showJoinModal: (placeId, server) => {
        if (!server || !server.id) {
            TrackedUI.showErrorModal('Sunucu bilgisi geçersiz');
            return;
        }

        const newBadge = server.isNew ? `<span class="new-badge">${TrackedI18n.t('newBadge')}</span>` : '';
        // v2.5: Instance Trigger başarılı olduğunda özel badge (emoji kuralı: emoji yok, düz metin)
        const forceBadge = server.isForced ? '<span class="force-badge">TRIGGER</span>' : '';

        // Bölge satırı — BLOKLAMADAN: modal hemen açılır, bölge arkadan dolar (loading → sonuç).
        const pinSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
        const hasRegion = (typeof TrackedRegion !== 'undefined');
        const perfPct = hasRegion ? TrackedRegion.perfPct(server) : null;
        const regionLineInner = (s) => {
            if (s.regionResolved && s.region && !s.regionFailed) {
                const close = (typeof s.measuredPing === 'number') ? ` · ${s.measuredPing} ms` : '';
                const ver = s.placeVersion ? ` · v${s.placeVersion}` : '';
                const flag = (typeof tkFlag === 'function') ? tkFlag(s.region) : '';
                return `<div class="tracked-modal-region">${flag || pinSvg}<span>${s.region}${close}${ver}</span></div>`;
            }
            if (s.regionResolved && s.regionFailed) {
                return `<div class="tracked-modal-region unknown">${pinSvg}<span>${TrackedI18n.t('regionUnknown')}</span></div>`;
            }
            return `<div class="tracked-modal-region region-loading"><span>${TrackedI18n.t('regionLoading')}</span></div>`;
        };
        const regionHtml = hasRegion ? `<div id="tk-join-region">${regionLineInner(server)}</div>` : '';
        const perfHtml = (perfPct !== null)
            ? `<div class="stat-divider"></div><div class="stat-item"><span class="stat-label">${TrackedI18n.t('perfLabel')}</span><span class="stat-value">${perfPct}%</span></div>`
            : '';

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
                        <span class="stat-label">${TrackedI18n.t('fps')}</span>
                        <span class="stat-value">${server.fps ? Math.round(server.fps) : 'N/A'}</span>
                    </div>
                    ${perfHtml}
                </div>
                ${regionHtml}
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

        // Bölgeyi arkadan çöz (modal zaten açık) → satırı yerinde güncelle.
        if (hasRegion && !server.regionResolved) {
            server.regionPending = true;
            TrackedRegion.resolveAndApply(placeId, server).then(() => {
                const slot = modal.querySelector('#tk-join-region');
                if (slot) slot.innerHTML = regionLineInner(server);
            }).catch(() => {});
        }
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
                <div class="tracked-modal-icon warning" style="background: linear-gradient(135deg, rgba(77,139,240,0.2), rgba(77,139,240,0.05)); color: #5e9bff;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <rect x="3" y="14" width="3.4" height="7" rx="1.5"></rect>
                        <rect x="8" y="10.5" width="3.4" height="10.5" rx="1.5"></rect>
                        <rect x="13" y="7" width="3.4" height="14" rx="1.5"></rect>
                        <rect x="18" y="3.5" width="3.4" height="17.5" rx="1.5"></rect>
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
        let modalRef = null;
        let userSorted = false;   // kullanıcı manuel sıraladıysa otomatik bölge-sıralamasını ezme
        const defaultDirs = { score: 'desc', ping: 'asc', players: 'asc', fps: 'desc', region: 'asc' };

        const hasRegion = (typeof TrackedRegion !== 'undefined');

        // Bir sunucunun bölge-hücresi içeriği — paylaşılan helper (TrackedUI.regionChipsHtml).
        const regionCellInner = (s) => TrackedUI.regionChipsHtml(s);

        // Çözüm sonrası satırı yerinde güncelle (tam re-render yok → scroll korunur).
        function updateRegionCell(s) {
            const cell = modalRef && modalRef.querySelector(`.server-region-cell[data-job="${s.id}"]`);
            if (!cell) return;
            cell.innerHTML = regionCellInner(s);
            const btn = cell.querySelector('.region-show-btn');
            if (btn) bindRegionShow(btn);
        }

        function bindRegionShow(btn) {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const jobId = btn.dataset.job;
                const s = servers.find(x => String(x.id) === String(jobId));
                if (!s || s.regionPending) return;
                s.regionPending = true;
                updateRegionCell(s);   // loading göster
                await TrackedRegion.resolveAndApply(placeId, s);
                updateRegionCell(s);
            };
        }

        function sortServers(arr) {
            const sorted = [...arr];
            sorted.sort((a, b) => {
                if (sortField === 'region') {
                    // İki katmanlı (hibrit): ölçülen ping (gerçek) önce, sonra mesafe, çözülmemiş en sona.
                    const ka = TrackedRegion.regionSortKey(a), kb = TrackedRegion.regionSortKey(b);
                    if (ka[0] === 2 && kb[0] === 2) return 0;
                    if (ka[0] === 2) return 1;
                    if (kb[0] === 2) return -1;
                    const cmp = (ka[0] - kb[0]) || (ka[1] - kb[1]);
                    return sortDir === 'asc' ? cmp : -cmp;
                }
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

                // Ping gösterimi tamamen kaldırıldı (güvenilmez). Doğrulanmış sunucular rozet alır.
                const verifiedBadge = s.verified
                    ? `<span class="verified-badge" title="${TrackedI18n.t('verifiedTooltip')}"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ${TrackedI18n.t('verifiedBadge')}</span>`
                    : '';

                return `
                    <div class="server-item${s.verified ? ' verified' : ''}" data-job="${s.id}">
                        <div class="srv-head">
                            <span class="server-rank">#${i + 1}</span>
                            <div class="srv-stats">
                                <div class="srv-stat" title="${fillPct}% dolu">
                                    <span class="srv-stat-v server-players">${s.playing}<i>/${s.maxPlayers}</i></span>
                                    <span class="srv-stat-k">${TrackedI18n.t('player')}${newBadge ? ' ' + newBadge : ''}</span>
                                </div>
                                <div class="srv-stat">
                                    <span class="srv-stat-v server-fps ${fpsClass}">${fps ?? 'N/A'}</span>
                                    <span class="srv-stat-k">${TrackedI18n.t('fps')}</span>
                                </div>
                                <div class="srv-stat">
                                    <span class="srv-stat-v" style="color:${barColor}">${normScore}</span>
                                    <span class="srv-stat-k">${TrackedI18n.t('sortByScore')}</span>
                                </div>
                            </div>
                            <span class="srv-flex"></span>
                            <button class="server-copy-btn" data-job="${s.id}" title="${TrackedI18n.t('copyJobId')}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                                    <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                            <button class="server-join-btn" data-job="${s.id}">${TrackedI18n.t('join')}</button>
                        </div>
                        <div class="server-region-cell" data-job="${s.id}">${regionCellInner(s)}</div>
                        <div class="server-score-row">
                            <div class="server-score-bar">
                                <div class="server-score-fill" style="width:${normScore}%;background:${barColor}"></div>
                            </div>
                        </div>
                        ${(verifiedBadge || insightBadges) ? `<div class="srv-tags">${verifiedBadge}${insightBadges}</div>` : ''}
                    </div>
                `;
            }).join('');
        }

        function applyFilters(modal) {
            // Ping filtresi KALDIRILDI (güvenilmez). Güvenilir filtreler: max oyuncu + min FPS.
            const maxPlayers = parseInt(modal.querySelector('#filter-players').value) || Infinity;
            const minFps     = parseInt(modal.querySelector('#filter-fps').value)     || 0;

            const filtered = servers.filter(s => {
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

            list.querySelectorAll('.server-copy-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const jobId = btn.dataset.job;
                    navigator.clipboard.writeText(jobId).then(() => {
                        btn.classList.add('copied');
                        const origHtml = btn.innerHTML;
                        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                        btn.title = TrackedI18n.t('jobIdCopied');
                        setTimeout(() => {
                            btn.classList.remove('copied');
                            btn.innerHTML = origHtml;
                            btn.title = TrackedI18n.t('copyJobId');
                        }, 1200);
                    }).catch(() => {});
                };
            });

            if (hasRegion) list.querySelectorAll('.region-show-btn').forEach(bindRegionShow);

            modal.querySelectorAll('.sort-btn').forEach(btn => {
                const isActive = btn.dataset.sort === sortField;
                btn.classList.toggle('active', isActive);
                const arrow = btn.querySelector('.sort-arrow');
                if (arrow) arrow.textContent = isActive ? (sortDir === 'asc' ? '↑' : '↓') : '';
            });
        }

        const content = `
            <div class="tracked-modal tk-srv" style="width: 444px;">
                <div class="tracked-modal-icon">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
                <h3>${TrackedI18n.t('bestServers')}</h3>
                <p>${servers.length} ${TrackedI18n.t('serversScanned')}</p>
                <div class="server-filter-row">
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
                    <button class="sort-btn" data-sort="players">${TrackedI18n.t('player')}<span class="sort-arrow"></span></button>
                    <button class="sort-btn" data-sort="fps">${TrackedI18n.t('fps')}<span class="sort-arrow"></span></button>
                    <button class="sort-btn" data-sort="region">${TrackedI18n.t('sortByRegion')}<span class="sort-arrow"></span></button>
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
        modalRef = modal;

        // RoSeal tarzı: üst ~8 sunucunun bölgesini otomatik çöz (aşamalı). Önce 'pending'
        // işaretle ki ilk render loading rozetiyle çıksın; kalan satırlarda 'bölgeyi göster'.
        let autoTargets = [];
        if (hasRegion) {
            autoTargets = [...servers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, TrackedRegion.AUTO_LIMIT);
            autoTargets.forEach(s => { if (!s.regionResolved) s.regionPending = true; });
        }

        applyFilters(modal);

        if (autoTargets.length) {
            TrackedRegion.enrich(placeId, autoTargets, TrackedRegion.AUTO_LIMIT, (s) => updateRegionCell(s)).then(() => {
                TrackedUI.markRecommended(servers);
                // Kullanıcı manuel sıralamadıysa otomatik EN YAKIN (bölge/ping) sıralamasına geç.
                if (!userSorted) { sortField = 'region'; sortDir = 'asc'; }
                applyFilters(modal);
            });
        }

        ['filter-players', 'filter-fps'].forEach(id => {
            const input = modal.querySelector(`#${id}`);
            if (input) input.addEventListener('input', () => applyFilters(modal));
        });

        modal.querySelectorAll('.sort-btn').forEach(btn => {
            btn.onclick = () => {
                userSorted = true;   // artık otomatik bölge-sıralaması ezmesin
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

        // Bölge: gösterilen ≤8 sunucunun hepsini aşamalı çöz (Yeni = "taze + yakın" için).
        const hasRegion = (typeof TrackedRegion !== 'undefined');
        const shown = servers.slice(0, 8);
        if (hasRegion) shown.forEach(s => { if (!s.regionResolved) s.regionPending = true; });

        // Ping gösterimi KALDIRILDI (güvenilmez). Bölge çözülünce en-yakına göre yeniden sıralanır.
        const rowHtml = (s, i) => {
            const freshness = s.playing <= 2 ? TrackedI18n.t('veryFresh') : (s.playing <= 5 ? TrackedI18n.t('fresh') : TrackedI18n.t('newBadge'));
            const regionCell = hasRegion ? `<div class="server-region-cell" data-job="${s.id}">${TrackedUI.regionChipsHtml(s)}</div>` : '';
            return `
                <div class="server-item new-server-item" data-job="${s.id}">
                    <div class="server-item-row">
                        <div class="server-info">
                            <span class="server-rank" style="color: #BF5AF2;">#${i + 1}</span>
                            <span class="server-players">${s.playing}/${s.maxPlayers}</span>
                            <span class="freshness-badge">${freshness}</span>
                        </div>
                        <div class="server-actions">
                            <button class="server-join-btn btn-new" data-job="${s.id}">${TrackedI18n.t('join')}</button>
                        </div>
                    </div>
                    ${regionCell}
                </div>
            `;
        };

        const content = `
            <div class="tracked-modal" style="width: 440px;">
                <div class="tracked-modal-icon" style="background: linear-gradient(135deg, rgba(77,139,240,0.2), rgba(77,139,240,0.05)); color: #5e9bff;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <rect x="3" y="14" width="3.4" height="7" rx="1.5"></rect>
                        <rect x="8" y="10.5" width="3.4" height="10.5" rx="1.5"></rect>
                        <rect x="13" y="7" width="3.4" height="14" rx="1.5"></rect>
                        <rect x="18" y="3.5" width="3.4" height="17.5" rx="1.5"></rect>
                    </svg>
                </div>
                <h3>${TrackedI18n.t('newServersFound')}</h3>
                <p>${TrackedI18n.t('freshServers')}</p>
                <div class="server-list">${shown.map(rowHtml).join('')}</div>
                <button class="btn-secondary" id="modal-close" style="width: 100%; margin-top: 12px;">${TrackedI18n.t('close')}</button>
            </div>
        `;

        const modal = TrackedUI.createModal(content);

        const bindJoins = () => {
            modal.querySelectorAll('.server-join-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const jobId = e.currentTarget.dataset.job;
                    modal.remove();
                    TrackedApp.joinServer(placeId, jobId);
                };
            });
        };
        const renderList = () => {
            const list = modal.querySelector('.server-list');
            if (list) list.innerHTML = shown.map(rowHtml).join('');
            bindJoins();
        };
        bindJoins();

        modal.querySelector('#modal-close').onclick = () => {
            modal.remove();
            TrackedUI.unlockAllButtons(); // v2.4.5
        };

        // Bölgeleri aşamalı çöz → hücreleri doldur → bitince EN YAKINA göre sırala + "Önerilen" işaretle.
        if (hasRegion) {
            TrackedRegion.enrich(placeId, shown, shown.length, (s) => {
                const cell = modal.querySelector(`.server-region-cell[data-job="${s.id}"]`);
                if (cell) cell.innerHTML = TrackedUI.regionChipsHtml(s);
            }).then(() => {
                TrackedUI.markRecommended(shown);
                shown.sort((a, b) => {
                    const ka = TrackedRegion.regionSortKey(a), kb = TrackedRegion.regionSortKey(b);
                    if (ka[0] === 2 && kb[0] === 2) return 0;
                    if (ka[0] === 2) return 1;
                    if (kb[0] === 2) return -1;
                    return (ka[0] - kb[0]) || (ka[1] - kb[1]);
                });
                renderList();
            });
        }
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
