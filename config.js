// config.js - Tracked Extension v3.7 Configuration Module

const TrackedConfig = {
    // API Settings - v3.0: Çok daha konservatif
    API: {
        MAX_SERVERS: 200,           // v3.0: 500 → 200 (derin tarama daha az)
        SERVERS_PER_PAGE: 100,
        DELAY_MS: 1500,             // v3.0: 1000 → 1500ms (daha uzun bekleme)
        RETRY_ATTEMPTS: 2,          // v3.0: 3 → 2 deneme
        RETRY_DELAY_MS: 3000,       // v3.0: 2000 → 3000ms
        RATE_LIMIT_DELAY_MS: 15000, // v3.0: 30000 → 15000ms (15 saniye)
        MIN_PLAYERS: 1,
        MAX_SCORED_SERVERS: 20,
        // v3.0: Yeni Server Tarama Ayarları
        NEW_SERVER: {
            MAX_SCAN: 100,          // v3.0: 200 → 100 (daha az istek)
            MIN_FRESHNESS_SCORE: 50,
            PING_THRESHOLD: 150
        }
    },

    // DOM Selectors
    SELECTORS: {
        INJECTION_TARGETS: [
            '#game-details-play-button-container',
            '.game-details-button-container',
            '[data-testid="play-button-container"]',
            '.game-calls-to-action',
            '.game-details-play-container',
            '.game-title-container',
            '#game-details-page',
            '.container-main .game-main-content',
            'main'
        ],
        GAME_TITLE: 'h1.game-name, h1[data-testid="game-name"], .game-name-title',
        CONTENT_AREA: '#game-details-page, .game-main-content, main, body'
    },

    // Timing
    TIMING: {
        INJECTION_RETRY_DELAY: 500,
        INJECTION_MAX_RETRIES: 25,
        SPA_DEBOUNCE_MS: 300,
        STATUS_CLEAR_DELAY: 3000,
        BUTTON_COOLDOWN_MS: 5000,    // v3.0: 3000 → 5000ms (daha uzun cooldown)
        RATE_LIMIT_COOLDOWN_MS: 15000 // v3.0: 30000 → 15000ms
    },

    // Visual
    UI: {
        Z_INDEX: 2147483647,
        THEME: {
            accentBlue: '#0A84FF',
            accentGreen: '#30D158',
            accentRed: '#FF453A',
            accentYellow: '#FFD60A',
            accentPurple: '#BF5AF2'
        }
    }
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackedConfig;
}
