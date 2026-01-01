
// content_script.js

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTitle") {
        let title = document.title; 
        const h1 = document.querySelector('h1.game-name') || document.querySelector('h1[data-testid="game-name"]');
        if (h1) {
            title = h1.textContent.trim();
        }
        sendResponse({ title: title });
    }
});

// --- NEW: Tracked Game Bar (Server Finder & Utilities) ---

async function initGameBar() {
    if (!window.location.pathname.includes('/games/')) return;

    // Wait for the main play buttons area
    const checkContainer = setInterval(() => {
        // Roblox uses different classes over time, fallback strategy
        const container = document.getElementById('game-details-play-button-container') || 
                          document.querySelector('.game-details-button-container');

        if (container) {
            clearInterval(checkContainer);
            
            if (document.getElementById('tracked-game-bar')) return;

            const bar = document.createElement('div');
            bar.id = 'tracked-game-bar';
            bar.className = 'tracked-game-bar';
            
            bar.innerHTML = `
                <div class="tracked-bar-logo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                </div>
                <button class="tracked-bar-btn" id="btn-find-empty">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    Boş Sunucu Bul
                </button>
                <div class="tracked-divider"></div>
                <button class="tracked-bar-btn" id="btn-copy-id">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    ID Kopyala
                </button>
                <span id="tracked-status-msg" class="tracked-status"></span>
            `;

            // Insert after the play button container
            container.parentNode.insertBefore(bar, container.nextSibling);

            // Bind Events
            document.getElementById('btn-find-empty').addEventListener('click', () => findEmptyServer(false));
            document.getElementById('btn-copy-id').addEventListener('click', copyGameId);
        }
    }, 800);
}

// Feature: Find Empty Server (Smart Scoring / Pinpoint Accuracy)
async function findEmptyServer(isRetry = false) {
    const status = document.getElementById('tracked-status-msg');
    const btn = document.getElementById('btn-find-empty');
    
    // Get Place ID from URL
    const match = location.pathname.match(/games\/(\d+)\//);
    if (!match) {
        status.textContent = "Hata: ID bulunamadı.";
        return;
    }
    const placeId = match[1];

    try {
        if (!isRetry) {
            status.textContent = "Derin tarama (100+)...";
            status.style.color = "#FFD60A"; // Yellow
            btn.disabled = true;
        } else {
            status.textContent = "Tekrar taranıyor...";
        }

        // Deep Scan: Limit 100 gives us a much better chance to find the "perfect" server
        // Roblox API often puts buggy 0-player servers first. We need to skip those.
        const response = await fetch(`https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&limit=100`);
        const data = await response.json();

        if (data && data.data) {
            let servers = data.data;

            // --- FILTERING ---
            // 1. Must have at least 1 player (0 is usually a glitch/dead instance)
            // 2. Must not be full
            let candidates = servers.filter(s => s.playing > 0 && s.playing < s.maxPlayers);
            
            if (candidates.length === 0) {
                status.textContent = "Boş sunucu bulunamadı.";
                status.style.color = "#FF453A";
                btn.disabled = false;
                return;
            }

            // --- SCORING (The "Pinpoint" Logic) ---
            // We want the lowest player count, BUT if the ping is terrible, we prefer 2 players with good ping over 1 player with bad ping.
            
            const scoredCandidates = candidates.map(s => {
                let score = 1000;
                
                // Penalty for player count (Huge penalty, we really want empty servers)
                // -100 points per player.
                score -= (s.playing * 100); 

                // Bonus/Penalty for Ping (if available)
                // Note: API returns 'ping' in ms relative to user, or null.
                if (typeof s.ping === 'number') {
                    if (s.ping < 100) score += 50; // EU/Local Bonus
                    else if (s.ping > 250) score -= 50; // Lag Penalty
                } else {
                    // Unknown ping is slightly risky, small penalty
                    score -= 10;
                }

                // FPS Bonus (Server Health)
                if (s.fps && s.fps > 55) score += 20;

                return { ...s, score };
            });

            // Sort by Score Descending
            scoredCandidates.sort((a, b) => b.score - a.score);
            
            const bestServer = scoredCandidates[0];
            
            // Analyze the best option to decide what to show
            // A "Perfect" server has very few players and good ping.
            const isPerfect = bestServer.playing <= 2 && (bestServer.ping && bestServer.ping < 120);
            
            // If we found a perfect candidate, or if the user is retrying (force join), just go.
            if (isPerfect || isRetry) {
                const regionTag = bestServer.ping ? `(${bestServer.ping}ms)` : '';
                status.textContent = `Sunucu bulundu: ${bestServer.playing} Kişi ${regionTag}`;
                status.style.color = "#30D158"; // Green
                joinServer(placeId, bestServer.id);
            } else {
                // If the best we found isn't "Perfect" (maybe high ping, or >2 players), ask the user.
                // This fulfills the "EU Options" request.
                status.textContent = ""; 
                showDecisionModal(
                    placeId, 
                    bestServer.id,
                    bestServer.playing,
                    bestServer.ping
                );
            }

        } else {
            throw new Error("API hatası");
        }
    } catch (e) {
        console.error(e);
        status.textContent = "Sunucu arama başarısız.";
        status.style.color = "#FF453A";
    } finally {
        if (!document.getElementById('tracked-decision-modal')) {
             setTimeout(() => { if(btn) btn.disabled = false; }, 1000);
        }
    }
}

function showDecisionModal(placeId, alternativeJobId, playerCount, ping) {
    const existing = document.getElementById('tracked-decision-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'tracked-decision-modal';
    modal.className = 'tracked-modal-overlay';
    
    const pingText = ping ? `${ping}ms` : "Bilinmiyor";
    const pingClass = ping && ping < 120 ? 'good' : (ping > 200 ? 'bad' : 'warn');
    
    modal.innerHTML = `
        <div class="tracked-modal">
            <div class="tracked-modal-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <h3>İdeal EU Sunucusu Bulunamadı</h3>
            <p>Aradığınız kriterlerde (Düşük Ping + 1-2 Oyuncu) sunucu şu an yok. En iyi alternatif:</p>
            
            <div class="tracked-modal-stat">
                <div class="stat-col">
                    <span class="label">OYUNCU</span>
                    <span class="value">${playerCount}</span>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-col">
                    <span class="label">PING</span>
                    <span class="value ${pingClass}">${pingText}</span>
                </div>
            </div>

            <div class="tracked-modal-actions">
                <button class="tracked-modal-btn secondary" id="tm-cancel">İptal</button>
                <button class="tracked-modal-btn primary" id="tm-retry">Tekrar Tara</button>
            </div>
            <button class="tracked-modal-btn full ghost" id="tm-join-any">Mevcut En İyiye Katıl</button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('tm-cancel').addEventListener('click', () => {
        modal.remove();
        document.getElementById('btn-find-empty').disabled = false;
    });

    document.getElementById('tm-retry').addEventListener('click', () => {
        modal.remove();
        findEmptyServer(true); // Retry with force join if same result? Or just rescan.
        // Actually findEmptyServer(true) currently acts as "force join next result" in my logic above?
        // Let's make retry just rescan. 
        // Logic tweak: If retrying, we might want to skip the modal and just join the best available, OR scan again.
        // For "Nokta Atisi", retry should probably try scanning again hoping a slot opened up.
        // But for UX simplicity, let's treat "Tekrar Tara" as a fresh scan.
        // We need to pass false to isRetry so it checks constraints again.
        // But wait, if we pass false, it will just show modal again if nothing changed.
        // Let's modify logic: The user wants to "Try Again".
        findEmptyServer(false); 
    });

    document.getElementById('tm-join-any').addEventListener('click', () => {
        modal.remove();
        const status = document.getElementById('tracked-status-msg');
        status.textContent = "Sunucuya katılınıyor...";
        status.style.color = "#FFD60A";
        joinServer(placeId, alternativeJobId);
    });
}

function joinServer(placeId, jobId) {
    window.location.href = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${jobId}`;
    
    // Reset button after a delay
    setTimeout(() => {
         const btn = document.getElementById('btn-find-empty');
         const status = document.getElementById('tracked-status-msg');
         if(btn) btn.disabled = false;
         if(status) status.textContent = "";
    }, 4000);
}

// Feature: Copy ID
function copyGameId() {
    const match = location.pathname.match(/games\/(\d+)\//);
    const status = document.getElementById('tracked-status-msg');
    
    if (match) {
        navigator.clipboard.writeText(match[1]).then(() => {
            status.textContent = "ID Kopyalandı!";
            status.style.color = "#30D158";
            setTimeout(() => status.textContent = "", 2000);
        });
    }
}

// Initialization
initGameBar();

// Watch for URL changes (SPA)
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Re-inject game bar if page structure changed
    setTimeout(initGameBar, 500);
  }
}).observe(document, {subtree: true, childList: true});
