
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
        if (!server || !server.id) return { score: 0, badges: [], simulated: false };

        // DÜRÜST SUNUCU SAĞLIĞI: yalnızca GERÇEK/doğrulanabilir veri → doluluk + FPS.
        // (Eski hâli ping + sahte "sunucu yaşı" hash'i ile uydurma analiz yapıyordu; Roblox public
        //  API'si oyuncuların kim olduğunu vermez → gerçek oyuncu analizi mümkün değil.)
        // NOT: TrackedScanner.analyzeServerPlayers ile AYNI tutulmalı (iki kopya).
        const badges = [];
        let health = 50;
        const fps = server.fps ? Math.round(server.fps) : 0;
        const playing = server.playing || 0;
        const maxP = server.maxPlayers || 1;
        const fullness = (playing / maxP) * 100;

        // ── Popülasyon (gerçek doluluk) ──
        if (playing <= 2 || fullness < 20) {
            badges.push({ type: 'fresh', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(48,209,88,0.22)" stroke="#30D158" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6"></path></svg>', label: 'Taze' });
            health += 20;
        } else if (fullness > 85) {
            badges.push({ type: 'crowded', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,159,10,0.22)" stroke="#FF9F0A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>', label: 'Dolu' });
            health -= 15;
        } else {
            badges.push({ type: 'balanced', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64B4FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M7 12h10"></path><path d="M10 18h4"></path></svg>', label: 'Dengeli' });
            health += 10;
        }

        // ── Sunucu sağlığı (gerçek FPS) ──
        if (fps >= 58) {
            badges.push({ type: 'smooth', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#30D158" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>', label: 'Akıcı' });
            health += 30;
        } else if (fps > 0 && fps < 35) {
            badges.push({ type: 'laggy', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,69,58,0.22)" stroke="#FF453A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>', label: 'Lag\'li' });
            health -= 30;
        }

        return {
            score: Math.max(0, Math.min(100, health)),
            badges: badges,
            fps: fps,
            fullness: Math.round(fullness),
            simulated: false
        };
    }
};
