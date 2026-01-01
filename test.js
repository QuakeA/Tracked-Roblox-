
// test.js - Automated Test Suite

document.addEventListener('DOMContentLoaded', runTests);

async function runTests() {
    const output = document.getElementById('test-output');
    output.innerHTML = ''; // Clear init message

    const log = (msg, type = 'info') => {
        const el = document.createElement('div');
        el.className = `log-entry ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'pass') icon = '✅';
        if (type === 'fail') icon = '❌';

        el.innerHTML = `<span class="status-icon">${icon}</span> ${msg}`;
        output.appendChild(el);
        console.log(`[Test][${type.toUpperCase()}] ${msg}`);
    };

    // Store originals to restore later
    const originalFetch = window.fetch;
    
    // =========================================================================
    // SECTION 1: PingUtils Tests
    // =========================================================================
    log('Starting PingUtils Tests...', 'info');

    // TEST 1: Successful Ping
    try {
        window.fetch = async (url, options) => {
            if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
            await new Promise(resolve => setTimeout(resolve, 50));
            return new Response('ok');
        };

        const result = await PingUtils.pingEndpoint('https://mock-success.com', 1000);
        
        if (typeof result === 'number' && result >= 40) {
            log(`PingUtils (Success): Ping returned ${result}ms (Expected ~50ms)`, 'pass');
        } else {
            log(`PingUtils (Success): Failed. Result: ${result}ms`, 'fail');
        }
    } catch (e) {
        log(`PingUtils (Success): Threw unexpected error: ${e.message}`, 'fail');
    }

    // TEST 2: Timeout Handling
    try {
        window.fetch = async (url, options) => {
            return new Promise((resolve, reject) => {
                if (options.signal) {
                    options.signal.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
                }
            });
        };

        await PingUtils.pingEndpoint('https://mock-timeout.com', 100);
        log(`PingUtils (Timeout): Failed. Did not throw timeout error.`, 'fail');
    } catch (e) {
        if (e.name === 'AbortError') {
            log(`PingUtils (Timeout): Correctly timed out with AbortError.`, 'pass');
        } else {
            log(`PingUtils (Timeout): Threw wrong error: ${e.name}`, 'fail');
        }
    }

    // TEST 3: Status Logic
    const t1 = PingUtils.getStatus(50);
    const t2 = PingUtils.getStatus(150);
    if (t1 === 'green' && t2 === 'red') {
         log(`PingUtils (UI Logic): Status thresholds correct.`, 'pass');
    } else {
         log(`PingUtils (UI Logic): Failed status check.`, 'fail');
    }


    // =========================================================================
    // SECTION 2: joinGame Integration Tests
    // =========================================================================
    log('Starting joinGame Tests...', 'info');
    
    if (!window.TrackedApp) {
        log('joinGame: Skipped. TrackedApp not exposed.', 'fail');
    } else {
        const { joinGame, state } = window.TrackedApp;
        
        // --- Setup Chrome Spies ---
        let spyCreate = null;
        let spyUpdate = null;
        
        // Override the mocks defined in test.html
        window.chrome.tabs.create = (arg) => { spyCreate = arg; };
        window.chrome.tabs.update = (arg) => { spyUpdate = arg; };

        // Helper to reset spies and state defaults
        const resetTest = () => {
            spyCreate = null;
            spyUpdate = null;
            state.mode = 'auto';
            state.settings.openInNewTab = false;
            state.settings.appendRegionParam = false;
            state.bestRegion = 'Almanya (DE)'; 
            state.selectedRegion = 'Fransa (FR)';
        };

        // ---------------------------------------------------------------------
        // Test Case A: Normal Strategy + Same Tab
        // ---------------------------------------------------------------------
        resetTest();
        state.joinStrategy = 'normal';
        state.settings.openInNewTab = false;
        
        log('Test A: Normal Strategy + Same Tab', 'info');
        joinGame('1001');
        
        if (spyUpdate && spyUpdate.url === 'https://www.roblox.com/games/1001/') {
            log('-> PASS: Called tabs.update with correct URL.', 'pass');
        } else {
            log(`-> FAIL: Expected update(...1001/), got ${JSON.stringify(spyUpdate)}`, 'fail');
        }

        // ---------------------------------------------------------------------
        // Test Case B: Normal Strategy + New Tab
        // ---------------------------------------------------------------------
        resetTest();
        state.joinStrategy = 'normal';
        state.settings.openInNewTab = true;

        log('Test B: Normal Strategy + New Tab', 'info');
        joinGame('1002');

        if (spyCreate && spyCreate.url === 'https://www.roblox.com/games/1002/') {
            log('-> PASS: Called tabs.create with correct URL.', 'pass');
        } else {
            log(`-> FAIL: Expected create(...1002/), got ${JSON.stringify(spyCreate)}`, 'fail');
        }

        // ---------------------------------------------------------------------
        // Test Case C: Fast Strategy (Auto) + Same Tab (Check Delay)
        // ---------------------------------------------------------------------
        resetTest();
        state.joinStrategy = 'fast';
        state.mode = 'auto';
        state.bestRegion = 'Almanya (DE)'; // Valid region
        state.settings.openInNewTab = false;

        log('Test C: Fast Strategy (Auto) + Same Tab (Delay Check)', 'info');
        joinGame('1003');

        // Immediate check: Should be null because of 800ms delay for Toast
        if (spyUpdate !== null) {
            log('-> FAIL: Opened URL immediately (should wait for toast).', 'fail');
        } else {
            // Wait for delay
            await new Promise(r => setTimeout(r, 900));
            
            if (spyUpdate && spyUpdate.url === 'https://www.roblox.com/games/1003/') {
                log('-> PASS: Opened URL after delay.', 'pass');
            } else {
                log('-> FAIL: Did not open URL after delay.', 'fail');
            }
        }

        // ---------------------------------------------------------------------
        // Test Case D: Fast Strategy (Manual) + New Tab + Param Enabled
        // ---------------------------------------------------------------------
        resetTest();
        state.joinStrategy = 'fast';
        state.mode = 'manual';
        state.selectedRegion = 'Polonya (PL)'; // Manual selection
        state.settings.openInNewTab = true;
        state.settings.appendRegionParam = true;

        log('Test D: Fast Strategy (Manual) + New Tab + URL Param', 'info');
        joinGame('1004');

        await new Promise(r => setTimeout(r, 900));

        // Logic expects "PL" extracted from "Polonya (PL)"
        const expectedUrl = 'https://www.roblox.com/games/1004/?rotaRegion=PL';
        
        if (spyCreate && spyCreate.url === expectedUrl) {
            log('-> PASS: Correctly appended ?rotaRegion=PL parameter.', 'pass');
        } else {
            log(`-> FAIL: URL mismatch. Expected: ${expectedUrl}, Got: ${spyCreate?.url}`, 'fail');
        }

        // ---------------------------------------------------------------------
        // Test Case E: Fast Strategy but No Region Available
        // ---------------------------------------------------------------------
        resetTest();
        state.joinStrategy = 'fast';
        state.mode = 'auto';
        state.bestRegion = null; // No ping results yet
        
        log('Test E: Fast Strategy (No Region Data)', 'info');
        joinGame('1005');

        // Should fall back to immediate open without delay/toast
        if (spyUpdate && spyUpdate.url === 'https://www.roblox.com/games/1005/') {
            log('-> PASS: Fallback to immediate open when no region data.', 'pass');
        } else {
            log('-> FAIL: Fallback logic failed.', 'fail');
        }
    }

    // Restore original environment
    window.fetch = originalFetch;
    log('All Tests Completed.', 'info');
}