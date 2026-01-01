
// ping_utils.js

/**
 * PingUtils
 * Shared logic for measuring endpoint latency and determining status.
 * Separated from popup.js to allow automated testing.
 */
window.PingUtils = {
    THRESHOLDS: {
        WARN: 90,
        DANGER: 140
    },

    /**
     * Measure latency to a URL.
     * @param {string} url - The endpoint to ping.
     * @param {number} timeout - Timeout in milliseconds.
     * @returns {Promise<number>} - Latency in ms.
     * @throws {Error} - Throws on network error or timeout.
     */
    async pingEndpoint(url, timeout) {
        const start = performance.now();
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            
            // Use no-store to bypass cache, no-cors to avoid CORS errors (opaque response is fine for timing)
            await fetch(url, { 
                method: 'GET', 
                mode: 'no-cors', 
                cache: 'no-store', 
                signal: controller.signal 
            });
            
            clearTimeout(id);
            return Math.round(performance.now() - start);
        } catch (err) {
            throw err;
        }
    },

    /**
     * Measure median latency with multiple samples.
     * @param {string} url 
     * @param {number} timeout 
     * @param {number} samples 
     * @returns {Promise<number>} - Median latency in ms.
     */
    async measureMedianLatency(url, timeout, samples = 3) {
        const results = [];
        for (let i = 0; i < samples; i++) {
            try {
                const ms = await this.pingEndpoint(url, timeout);
                results.push(ms);
            } catch (e) {
                // Treat error/timeout as the timeout value (penalty)
                results.push(timeout); 
            }
            // Small delay between samples to allow network socket recycling/pacing
            if (i < samples - 1) await new Promise(r => setTimeout(r, 50));
        }
        
        // Sort to find median
        results.sort((a, b) => a - b);
        const mid = Math.floor(results.length / 2);
        return results[mid];
    },

    /**
     * Calculate Jitter (Variation in latency)
     * Using standard deviation logic simplified for small samples
     */
    calculateJitter(pings) {
        if (!pings || pings.length < 2) return 0;
        // Calculate differences between consecutive measurements
        let diffSum = 0;
        for (let i = 0; i < pings.length - 1; i++) {
            diffSum += Math.abs(pings[i] - pings[i+1]);
        }
        return Math.round(diffSum / (pings.length - 1));
    },

    /**
     * Determine a network grade (S, A, B, C, D, F) based on Ping and Jitter
     */
    calculateGrade(avgPing, jitter) {
        // Score starts at 100
        // Penalties: 
        // - Ping: -1 point per 2ms over 20ms
        // - Jitter: -2 points per 1ms
        
        let score = 100;
        
        if (avgPing > 20) score -= (avgPing - 20) * 0.5;
        score -= jitter * 3;

        if (score >= 95) return 'S';
        if (score >= 85) return 'A';
        if (score >= 70) return 'B';
        if (score >= 50) return 'C';
        if (score >= 30) return 'D';
        return 'F';
    },

    /**
     * Determine status color based on latency.
     * @param {number} ms - Latency in milliseconds.
     * @returns {string} - 'green', 'yellow', or 'red'.
     */
    getStatus(ms) {
        if (ms > this.THRESHOLDS.DANGER) return 'red';
        if (ms > this.THRESHOLDS.WARN) return 'yellow';
        return 'green';
    }
};
