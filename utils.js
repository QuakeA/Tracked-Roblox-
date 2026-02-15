// utils.js - Tracked Extension v3.7 Utility Module

const TrackedUtils = {
    // Delay utility
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // Safe query selector with multiple attempts
    querySelectorSafe: (selectors, timeout = 5000) => {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const check = () => {
                for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el) return resolve(el);
                }
                if (Date.now() - startTime < timeout) {
                    setTimeout(check, 100);
                } else {
                    resolve(null);
                }
            };
            check();
        });
    },

    // Extract place ID from URL
    extractPlaceId: () => {
        const match = location.pathname.match(/\/games\/(\d+)\//);
        return match ? match[1] : null;
    },

    // Check if current page is a game page
    isGamePage: () => {
        return location.pathname.includes('/games/') && 
               /\/games\/(\d+)\//.test(location.pathname);
    },

    // Safe fetch with timeout
    fetchWithTimeout: async (url, options = {}, timeout = 10000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    // Create element with attributes
    createElement: (tag, attrs = {}, children = []) => {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([key, val]) => {
            if (key === 'className') el.className = val;
            else if (key === 'innerHTML') el.innerHTML = val;
            else if (key === 'textContent') el.textContent = val;
            else if (key.startsWith('on') && typeof val === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), val);
            } else {
                el.setAttribute(key, val);
            }
        });
        children.forEach(child => el.appendChild(child));
        return el;
    },

    // Debounce function
    debounce: (fn, ms) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), ms);
        };
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackedUtils;
}
