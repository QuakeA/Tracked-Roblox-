
// service_worker.js

// Initialization logic
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default storage if empty
    chrome.storage.local.get('rota_settings', (data) => {
      if (!data.rota_settings) {
        const defaults = {
          timeoutMs: 3000,
          cacheMinutes: 10,
          openInNewTab: false,
          appendRegionParam: false,
          animationsEnabled: true,
          silentMode: false,
          probes: {
             "Almanya (DE)": "https://www.google.de/favicon.ico",
             "Hollanda (NL)": "https://www.google.nl/favicon.ico",
             "Fransa (FR)": "https://www.google.fr/favicon.ico",
             "Polonya (PL)": "https://www.google.pl/favicon.ico",
             "Romanya (RO)": "https://www.google.ro/favicon.ico"
          }
        };
        chrome.storage.local.set({ rota_settings: defaults });
      }
    });
  }

  // Create alarm for playtime tracking (runs every 1 minute)
  chrome.alarms.create('trackPlaytime', { periodInMinutes: 1 });
});

// Alarm Listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'trackPlaytime') {
    checkPresenceAndTrack();
  }
});

// --- NEW: Message Listener for Content Script Ping ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "measurePingForContent") {
    measureBestPing().then(result => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }
});

/**
 * Quick Ping Measurement Logic (Simplified version of ping_utils.js)
 * Since Service Workers cannot access window/DOM, we use fetch directly.
 */
async function measureBestPing() {
  try {
    const data = await chrome.storage.local.get('rota_settings');
    const settings = data.rota_settings;
    if (!settings || !settings.probes) return null;

    const probes = settings.probes;
    const promises = Object.entries(probes).map(async ([region, url]) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout for quick check
        
        await fetch(url, { 
            method: 'HEAD', 
            mode: 'no-cors', 
            cache: 'no-store',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const ms = Date.now() - start;
        return { region, ms };
      } catch (e) {
        return { region, ms: 9999 };
      }
    });

    const results = await Promise.all(promises);
    
    // Sort by lowest ping
    results.sort((a, b) => a.ms - b.ms);
    
    // Return the best one
    const best = results[0];
    if (best.ms < 9000) {
      return { ping: best.ms, region: best.region };
    }
    return null;

  } catch (e) {
    console.error('Ping measure failed:', e);
    return null;
  }
}


async function checkPresenceAndTrack() {
  try {
    // 1. Get Favorites
    const data = await chrome.storage.local.get('rota_favorites');
    const favorites = data.rota_favorites || [];
    
    if (favorites.length === 0) return; // No games to track

    // 2. Get Authenticated User ID
    const userResponse = await fetch('https://users.roblox.com/v1/users/authenticated', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!userResponse.ok) return; // Not logged in
    const userData = await userResponse.json();
    const userId = userData.id;

    if (!userId) return;

    // 3. Get User Presence
    const presenceResponse = await fetch('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ userIds: [userId] })
    });

    if (!presenceResponse.ok) return;
    const presenceData = await presenceResponse.json();
    
    // presenceData = { userPresences: [ { userPresenceType: 2, placeId: 12345, ... } ] }
    const presence = presenceData.userPresences && presenceData.userPresences[0];

    // UserPresenceType: 2 = InGame
    if (presence && presence.userPresenceType === 2) {
      const currentPlaceId = presence.placeId ? String(presence.placeId) : null;
      // Also check rootPlaceId (Universe start place) to track sub-places
      const currentRootPlaceId = presence.rootPlaceId ? String(presence.rootPlaceId) : null;

      let gameFound = false;
      
      const updatedFavorites = favorites.map(game => {
        const favId = String(game.placeId);
        // Match either the specific place ID or the root place ID
        if (favId === currentPlaceId || favId === currentRootPlaceId) {
          gameFound = true;
          // Increment by 60 seconds
          return { 
            ...game, 
            playtimeSeconds: (game.playtimeSeconds || 0) + 60 
          };
        }
        return game;
      });

      // 5. Save if updated
      if (gameFound) {
        await chrome.storage.local.set({ rota_favorites: updatedFavorites });
        console.log(`[SW] Tracked 1 minute for game. Place: ${currentPlaceId}, Root: ${currentRootPlaceId}`);
      }
    }

  } catch (error) {
    console.warn('[SW] Playtime tracking failed:', error);
  }
}
