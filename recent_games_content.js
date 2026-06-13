// recent_games_content.js - v1.6.6
// Roblox oyun sayfalarını izler ve son ziyaret edilenlere kaydeder

const RecentGamesTracker = {
    init() {
        console.log('[RecentGames] Initializing...');
        
        // Sayfa yüklenince kaydet
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.trackPage());
        } else {
            this.trackPage();
        }
        
        // URL değişikliklerini izle (SPA)
        let lastUrl = location.href;
        this._observer = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                setTimeout(() => this.trackPage(), 1000);
            }
        });
        this._observer.observe(document, { subtree: true, childList: true });
    },

    // Eklenti reload/güncelleme sonrası bu ESKİ content script "ölür" (context invalidated).
    // Ölü context'te chrome.* çağırmamak için: canlılık kontrolü + gözlemciyi durdurma.
    _alive() { try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; } },
    _stop() { try { this._observer && this._observer.disconnect(); } catch (_) {} this._observer = null; },
    
    async trackPage() {
        // Eklenti reload edildiyse bu eski script'in context'i geçersizdir → sessizce çık.
        if (!this._alive()) { this._stop(); return; }
        try {
            const url = window.location.href;
            
            // Sadece oyun sayfalarını kaydet
            const gameMatch = url.match(/roblox\.com\/games\/(\d+)\/([^\/]+)/);
            if (!gameMatch) return;
            
            const placeId = gameMatch[1];
            let title = this.getPageTitle();
            
            // Başlık yoksa URL'den çıkar
            if (!title || title === 'Roblox' || title === '') {
                title = decodeURIComponent(gameMatch[2]).replace(/-/g, ' ');
                title = title.replace(/\b\w/g, l => l.toUpperCase());
            }
            
            console.log('[RecentGames] Tracking:', { placeId, title, url });
            
            // Storage'dan mevcut listeyi al
            const storage = await chrome.storage.local.get('rota_recent_games');
            let recentGames = storage.rota_recent_games || [];
            
            // Aynı oyun varsa kaldır (üste eklenecek)
            recentGames = recentGames.filter(g => String(g.placeId) !== String(placeId));
            
            // Yeni oyunu ekle
            recentGames.unshift({
                placeId: placeId,
                title: title,
                url: url,
                timestamp: Date.now()
            });
            
            // Son 20 oyunu tut
            recentGames = recentGames.slice(0, 20);
            
            // Kaydet
            await chrome.storage.local.set({ rota_recent_games: recentGames });
            console.log('[RecentGames] Saved:', recentGames.length, 'games');
            
        } catch (err) {
            // Reload/güncelleme sonrası beklenen "context invalidated" — hata değil, sessizce dur.
            if (!this._alive() || /context invalidated|Extension context/i.test((err && err.message) || '')) {
                this._stop();
                return;
            }
            console.error('[RecentGames] Track error:', err);
        }
    },
    
    getPageTitle() {
        // Birkaç farklı selector dene
        const selectors = [
            'h1[data-testid="game-title"]',
            '.game-title',
            'h1.game-name',
            '[class*="game-title"]',
            'h1'
        ];
        
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim()) {
                return el.textContent.trim();
            }
        }
        
        // document.title'dan dene
        const title = document.title.replace(' - Roblox', '').trim();
        return title || null;
    }
};

// Başlat
if (window.location.hostname.includes('roblox.com')) {
    RecentGamesTracker.init();
}
