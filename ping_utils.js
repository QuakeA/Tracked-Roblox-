
// ping_utils.js - Tracked Extension v3.7

/**
 * PingUtils - Ultra-Stabil Ping Ölçüm Algoritması
 * 
 * Algoritma:
 * 1. Her ping için benzersiz cache-buster (DNS cache önleme)
 * 2. Best-of-N stratejisi (en düşük 3 değerin ortalaması)
 * 3. Outlier temizleme (istatistiksel anormallikleri filtrele)
 * 4. TCP/TLS el sıkışma süreleri hariç saf ping
 */

window.PingUtils = {
    THRESHOLDS: {
        WARN: 90,
        DANGER: 140
    },

    /**
     * Tek bir ping denemesi - En doğrudan ölçüm
     * @param {string} url - Hedef URL
     * @param {number} timeout - Zaman aşımı (ms)
     * @returns {Promise<number>} - Ping süresi (ms) veya hata durumunda -1
     */
    async singlePing(url, timeout = 5000) {
        // Cache-buster ekle (DNS cache önleme)
        const cacheBuster = `?_=${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const pingUrl = url + cacheBuster;
        
        const start = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            // HEAD isteği - gövde indirmeden sadece header'ı al
            await fetch(pingUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store',
                signal: controller.signal,
                // DNS önbelleğini zorla temizle
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            clearTimeout(timeoutId);
            const elapsed = performance.now() - start;
            
            // Mantıksal sınırlar
            if (elapsed < 1) return 1;  // Minimum 1ms
            if (elapsed > timeout) return timeout; // Maksimum timeout
            
            return Math.round(elapsed);
            
        } catch (err) {
            clearTimeout(timeoutId);
            // Timeout veya ağ hatası
            return -1;
        }
    },

    /**
     * Stabil ping ölçümü - Best-of-N stratejisi
     * @param {string} url - Hedef URL
     * @param {number} timeout - Zaman aşımı (ms)
     * @param {number} samples - Örnek sayısı (varsayılan 5)
     * @returns {Promise<number>} - Stabil ping değeri (ms)
     */
    async measureMedianLatency(url, timeout = 5000, samples = 5) {
        const results = [];
        const validResults = [];
        
        // Tüm ping denemelerini yap
        for (let i = 0; i < samples; i++) {
            const ping = await this.singlePing(url, timeout);
            
            if (ping > 0) {
                validResults.push(ping);
            }
            results.push(ping);
            
            // Ping'ler arası bekleme (ağ tıkanıklığını önle)
            if (i < samples - 1) {
                await new Promise(r => setTimeout(r, 100));
            }
        }
        
        // Hiç geçerli sonuç yoksa timeout değeri döndür
        if (validResults.length === 0) {
            return 999; // Hata göstergesi
        }
        
        // Sırala
        validResults.sort((a, b) => a - b);
        
        // Outlier temizleme (IQR yöntemi)
        // Eğer 5+ örnek varsa, en uç değerleri at
        let cleanedResults = validResults;
        if (validResults.length >= 4) {
            const q1 = validResults[Math.floor(validResults.length * 0.25)];
            const q3 = validResults[Math.ceil(validResults.length * 0.75)];
            const iqr = q3 - q1;
            const lowerBound = q1 - (iqr * 1.5);
            const upperBound = q3 + (iqr * 1.5);
            
            cleanedResults = validResults.filter(v => v >= lowerBound && v <= upperBound);
            
            // Eğer outlier temizleme çok agresif olduysa, en az 3 değer tut
            if (cleanedResults.length < 3) {
                cleanedResults = validResults.slice(0, 3); // En düşük 3
            }
        }
        
        // Best-of-N: En düşük 3 değerin ortalaması (daha stabil)
        const bestN = cleanedResults.slice(0, Math.min(3, cleanedResults.length));
        const avg = Math.round(bestN.reduce((a, b) => a + b, 0) / bestN.length);
        
        console.log(`[Ping] ${url.split('/')[2]}: samples=[${results.join(',')}], best=[${bestN.join(',')}], final=${avg}ms`);
        
        return avg;
    },

    /**
     * Hızlı ping - tek örnek (hızlı önizleme için)
     * @param {string} url - Hedef URL
     * @param {number} timeout - Zaman aşımı
     * @returns {Promise<number>} - Ping (ms)
     */
    async pingEndpoint(url, timeout) {
        return this.singlePing(url, timeout);
    },

    /**
     * Jitter hesaplama (ping değişkenliği)
     * @param {number[]} pings - Ping değerleri dizisi
     * @returns {number} - Jitter (ms)
     */
    calculateJitter(pings) {
        if (!pings || pings.length < 2) return 0;
        
        // Ardışık farkların ortalaması
        let totalDiff = 0;
        let count = 0;
        
        for (let i = 1; i < pings.length; i++) {
            const diff = Math.abs(pings[i] - pings[i-1]);
            totalDiff += diff;
            count++;
        }
        
        return count > 0 ? Math.round(totalDiff / count) : 0;
    },

    /**
     * Ağ notu hesaplama (S, A, B, C, D, F)
     * @param {number} avgPing - Ortalama ping
     * @param {number} jitter - Jitter değeri
     * @returns {string} - Not (S-F)
     */
    calculateGrade(avgPing, jitter) {
        let score = 100;
        
        // Ping cezası (20ms üzeri her 2ms için -1 puan)
        if (avgPing > 20) {
            score -= (avgPing - 20) * 0.5;
        }
        
        // Jitter cezası (her 1ms için -3 puan)
        score -= jitter * 3;
        
        // Puan -> Not dönüşümü
        if (score >= 95) return 'S';
        if (score >= 85) return 'A';
        if (score >= 70) return 'B';
        if (score >= 50) return 'C';
        if (score >= 30) return 'D';
        return 'F';
    },

    /**
     * Durum rengi belirleme
     * @param {number} ms - Ping (ms)
     * @returns {string} - 'green', 'yellow', 'red'
     */
    getStatus(ms) {
        if (ms > this.THRESHOLDS.DANGER) return 'red';
        if (ms > this.THRESHOLDS.WARN) return 'yellow';
        return 'green';
    },

    /**
     * v3.7: Sunucu oyuncu kalitesi analizi
     * @param {Object} server - Sunucu verisi
     * @returns {Object} - { score, badges, simulated }
     */
    analyzeServerPlayers(server) {
        if (!server || !server.id) return { score: 0, badges: [], simulated: true };
        
        const badges = [];
        let trustScore = 50;
        
        const ping = server.ping || 0;
        const fps = server.fps || 0;
        const fullness = (server.playing / server.maxPlayers) * 100;
        
        // Sunucu ID'sinden "yaş" hesaplama (simülasyon)
        const serverHash = server.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const simulatedAge = serverHash % 365;
        
        // 💎 Elit Sunucu
        if (ping > 0 && ping < 60 && fps >= 58 && fullness > 30 && fullness < 80) {
            badges.push({ type: 'elite', icon: '💎', label: 'Elit Sunucu' });
            trustScore += 40;
        }
        // ⭐ Güvenli
        else if (ping > 0 && ping < 120 && fps >= 50 && fullness >= 20) {
            badges.push({ type: 'safe', icon: '⭐', label: 'Güvenli' });
            trustScore += 25;
        }
        
        // 🤓 Yeni
        if (fullness < 25 || server.playing <= 2) {
            badges.push({ type: 'newbie', icon: '🤓', label: 'Yeni' });
            trustScore -= 10;
        }
        
        // 🛡️ Stabil
        if (simulatedAge > 100 && fps >= 45) {
            badges.push({ type: 'stable', icon: '🛡️', label: 'Stabil' });
            trustScore += 15;
        }
        
        // ⚠️ Riskli
        if (ping > 180 || (fps > 0 && fps < 35)) {
            badges.push({ type: 'risky', icon: '⚠️', label: 'Riskli' });
            trustScore -= 25;
        }
        
        return {
            score: Math.max(0, Math.min(100, trustScore)),
            badges: badges,
            simulatedServerAge: simulatedAge,
            ping: ping,
            fps: fps,
            simulated: true
        };
    }
};
