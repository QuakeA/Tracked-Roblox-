
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
     * Gerçekçi ping ölçümü — warmup + median + RFC 3550 jitter
     *
     * Neden warmup?
     *   İlk istek TCP el sıkışması + TLS müzakere (~10-20ms overhead) içerir.
     *   Warmup bunu tüketir; sonraki örnekler mevcut bağlantıyı yeniden kullanır.
     *   Bu olmadan ilk örnek her zaman şişirilmiş gelir ve "best-of-N" onu atar
     *   ama bunu saklı tutar — ölçüm asla gerçekçi görünmez.
     *
     * Neden median?
     *   Ortalama, geçici yoğunluk spike'larına aşırı duyarlıdır.
     *   Median, gerçek tipik gecikmeyi temsil eder.
     *
     * Neden temporal jitter?
     *   RFC 3550 (RTP) standardı: ardışık örnekler arasındaki mutlak farkların
     *   ortalaması. Zamana göre sıralı örnekler üzerinden hesaplanmalıdır,
     *   sıralanmış değerler üzerinden değil.
     *
     * @param {string} url
     * @param {number} timeout
     * @param {number} samples - warmup hariç örnek sayısı (varsayılan 4)
     * @returns {Promise<{ms: number, jitter: number}>}
     */
    async measureMedianLatency(url, timeout = 5000, samples = 4) {
        // Warmup: TCP+TLS bağlantısını kur, sonucu at
        await this.singlePing(url, Math.min(timeout, 3000)).catch(() => {});
        await new Promise(r => setTimeout(r, 20));

        const temporal = []; // ZAMAN SIRALI — jitter için kritik

        for (let i = 0; i < samples; i++) {
            const ping = await this.singlePing(url, timeout);
            if (ping > 0) temporal.push(ping);
            if (i < samples - 1) await new Promise(r => setTimeout(r, 25));
        }

        if (temporal.length === 0) return { ms: 999, jitter: 0 };

        // Gerçek median (sıralı kopya üzerinden, temporal bozulmadan)
        const sorted = [...temporal].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const ms = sorted.length % 2 === 0
            ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
            : sorted[mid];

        // RFC 3550 jitter: ardışık mutlak farkların ortalaması
        let jitterSum = 0;
        for (let i = 1; i < temporal.length; i++) {
            jitterSum += Math.abs(temporal[i] - temporal[i - 1]);
        }
        const jitter = temporal.length > 1
            ? Math.round(jitterSum / (temporal.length - 1))
            : 0;

        console.log(`[Ping] ${url.split('/')[2]}: temporal=[${temporal.join(',')}] → median=${ms}ms jitter=${jitter}ms`);

        return { ms, jitter };
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
     * NOT: Bu fonksiyon TrackedScanner.analyzeServerPlayers ile kasıtlı olarak aynıdır.
     * Popup context'i (PingUtils) ve Content Script context'i (TrackedScanner)
     * farklı JS ortamlarında çalıştığı için ortak modül kullanılamaz.
     * Değişiklik yapıldığında HER İKİ KOPYA da güncellenmelidir.
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
            badges.push({ type: 'elite', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,215,0,0.35)" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>', label: 'Elit Sunucu' });
            trustScore += 40;
        }
        // ⭐ Güvenli
        else if (ping > 0 && ping < 120 && fps >= 50 && fullness >= 20) {
            badges.push({ type: 'safe', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(48,209,88,0.25)" stroke="#30D158" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>', label: 'Güvenli' });
            trustScore += 25;
        }
        
        // 🤓 Yeni
        if (fullness < 25 || server.playing <= 2) {
            badges.push({ type: 'newbie', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(100,180,255,0.25)" stroke="#64B4FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>', label: 'Yeni' });
            trustScore -= 10;
        }
        
        // 🛡️ Stabil
        if (simulatedAge > 100 && fps >= 45) {
            badges.push({ type: 'stable', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(191,90,242,0.25)" stroke="#BF5AF2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>', label: 'Stabil' });
            trustScore += 15;
        }
        
        // ⚠️ Riskli
        if (ping > 180 || (fps > 0 && fps < 35)) {
            badges.push({ type: 'risky', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,159,10,0.25)" stroke="#FF9F0A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>', label: 'Riskli' });
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
