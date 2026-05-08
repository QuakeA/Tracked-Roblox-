
// service_worker.js - Tracked v1.7.0 - Hybrid Event Detector

// ==================== INITIALIZATION ====================
chrome.runtime.onInstalled.addListener((details) => {
  // Always ensure popup (not side panel) opens on action click
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }

  if (details.reason === 'install') {
    chrome.storage.local.get('rota_settings', (data) => {
      if (!data.rota_settings) {
        const defaults = {
          timeoutMs: 3000,
          cacheMinutes: 10,
          openInNewTab: false,
          appendRegionParam: false,
          animationsEnabled: true,
          silentMode: false,
          eventDetection: {
            enabled: true,
            notifyDefiniteOnly: true,
            playerSpikeThreshold: 1.5,  // %50 artış
            checkInterval: 10  // dakika
          },
          probes: {
             "Almanya (DE)": "https://s3.eu-central-1.amazonaws.com",
             "Hollanda (NL)": "https://s3.eu-west-1.amazonaws.com",
             "Fransa (FR)": "https://s3.eu-west-3.amazonaws.com",
             "Polonya (PL)": "https://s3.eu-north-1.amazonaws.com",
             "Romanya (RO)": "https://s3.eu-south-1.amazonaws.com"
          }
        };
        chrome.storage.local.set({ rota_settings: defaults });
      }
    });
  }

  chrome.alarms.create('trackPlaytime', { periodInMinutes: 1 });
  chrome.alarms.create('trackGameLibrary', { periodInMinutes: 5 });
  chrome.alarms.create('detectLiveEvents', { periodInMinutes: 10 });
  chrome.alarms.create('playerSpikeCheck', { periodInMinutes: 5 });
  // Auto-Reconnect / Crash Recovery — 30sn polling (Chrome alarm minimum 0.5dk)
  chrome.alarms.create('monitorActiveSession', { periodInMinutes: 0.5 });
});

// ============================================================
// SIDE PANEL STATE TRACKING (Port-based — REAL-TIME, no async lag)
// ============================================================
// Side panel mount'unda port açar, kapanınca disconnect tetiklenir → in-memory state
const _sidePanelState = { isOpen: false, port: null };

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'tracked-sidepanel') {
    _sidePanelState.isOpen = true;
    _sidePanelState.port = port;
    port.onDisconnect.addListener(() => {
      _sidePanelState.isOpen = false;
      _sidePanelState.port = null;
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'trackPlaytime') checkPresenceAndTrack();
  if (alarm.name === 'trackGameLibrary') trackGameLibraryActivity();
  if (alarm.name === 'detectLiveEvents') detectLiveEvents();
  if (alarm.name === 'playerSpikeCheck') detectPlayerSpikes();
  if (alarm.name === 'monitorActiveSession') monitorActiveSession();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "measurePingForContent") {
    measureBestPing()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  if (request.action === "refreshGameLibrary") {
    trackGameLibraryActivity();
    sendResponse({ success: true });
    return true;
  }
  if (request.action === "testEventDetection") {
    testEventDetection(request.placeId)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  if (request.action === "analyzeGame") {
    analyzeSingleGame(request.placeId)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  if (request.action === "getEventHistory") {
    getEventHistory(request.placeId)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
  
  // v1.7: Widget handlers
  if (request.action === "openPopup") {
    // Widget'tan popup açma isteği
    chrome.action.openPopup();
    sendResponse({ success: true });
    return true;
  }
  
  // Side panel state query — port-based, real-time, async lag yok.
  if (request.action === "getSidePanelState") {
    sendResponse({ isOpen: _sidePanelState.isOpen });
    return false;
  }

  // Auto-Reconnect: join akışlarının çağırdığı action — placeId/jobId/gameTitle ile session kaydet
  if (request.action === "saveActiveSession") {
    saveActiveSession(request.placeId, request.jobId, request.gameTitle)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // Auto-Reconnect: content script CORS bypass için thumbnail proxy
  if (request.action === "getGameThumbnail") {
    (async () => {
      try {
        const placeId = request.placeId;
        if (!placeId) { sendResponse({ ok: false, error: 'no_placeId' }); return; }
        // placeId -> universeId
        const uniRes = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
        if (!uniRes.ok) { sendResponse({ ok: false, error: 'universe_lookup_failed' }); return; }
        const uniData = await uniRes.json();
        const universeId = uniData?.universeId;
        if (!universeId) { sendResponse({ ok: false, error: 'no_universe' }); return; }
        // universeId -> icon URL
        const iconRes = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=256x256&format=Png&isCircular=false`);
        if (!iconRes.ok) { sendResponse({ ok: false, error: 'icon_fetch_failed' }); return; }
        const iconData = await iconRes.json();
        const url = iconData?.data?.[0]?.imageUrl;
        if (url && url !== 'https://t1.rbxcdn.com/none.png') {
          sendResponse({ ok: true, imageUrl: url });
        } else {
          sendResponse({ ok: false, error: 'no_icon' });
        }
      } catch (err) {
        sendResponse({ ok: false, error: String(err?.message || err) });
      }
    })();
    return true;
  }

  // Auto-Reconnect: manuel monitor tetikleme (debugging için)
  if (request.action === "triggerSessionMonitor") {
    monitorActiveSession()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // Auto-Reconnect: manuel crash notification testi (debugging için)
  if (request.action === "testCrashNotification") {
    chrome.storage.local.get(['tracked_active_session', 'rota_settings'], (data) => {
      const s = data.tracked_active_session;
      const settings = data.rota_settings || {};
      if (!s) {
        sendResponse({ ok: false, error: 'No active session — bir oyuna gir önce' });
        return;
      }
      // In-page overlay HER ZAMAN (test'in amacı bu)
      broadcastReconnectOverlay(s);
      // Native sadece ayar açıksa
      if (settings.autoReconnectNative === true) {
        triggerCrashNotification(s);
      }
      sendResponse({ ok: true, session: s, broadcastedOverlay: true, broadcastedNative: settings.autoReconnectNative === true });
    });
    return true;
  }

  // Tracked Derin: Native in-page launcher — Roblox.GameLauncher.joinGameInstance
  // Sayfa MAIN world'inde çalışır → CSP/isolated world bypass; manuel "Play" sayfası açılmaz.
  if (request.action === "launchRobloxGame") {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab' });
      return false;
    }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (placeId, jobId) => {
        try {
          const pid = parseInt(placeId, 10);
          if (window.Roblox && Roblox.GameLauncher && typeof Roblox.GameLauncher.joinGameInstance === 'function') {
            Roblox.GameLauncher.joinGameInstance(pid, jobId);
            return 'native';
          }
        } catch (e) {
          console.warn('[Tracked] Native launcher hata:', e);
        }
        try {
          window.location.href = 'roblox://experiences/start?placeId=' + encodeURIComponent(placeId) + '&gameInstanceId=' + encodeURIComponent(jobId);
          return 'deeplink';
        } catch (e) {
          return 'fail';
        }
      },
      args: [String(request.placeId), String(request.jobId)]
    }).then(results => {
      const method = results && results[0] && results[0].result;
      // Auto-Reconnect: native launcher tetiklendiğinde session kaydet
      if (method === 'native' || method === 'deeplink') {
        saveActiveSession(request.placeId, request.jobId, request.gameTitle).catch(() => {});
      }
      sendResponse({ success: method !== 'fail', method });
    }).catch(err => {
      console.error('[SW] launchRobloxGame error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  // A+B Phase 3: MAIN world matchmaker query.
  // Tarayıcı content-script fetch'i gamejoin endpoint'inden status:12 yiyor.
  // MAIN world'de Roblox sayfasının kendi JS context'inden POST yaparak anti-automation'ı bypass ediyoruz.
  // Block list aktifken matchmaker'ın bize verdiği jobId = "blocksuz veya yeni" server.
  if (request.action === "swMainWorldMatchmaker") {
    const placeId = request.placeId;
    const senderTabId = sender.tab && sender.tab.id;

    const runOnTab = (tabId) => {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: async (placeId) => {
          const getCsrf = () => {
            try {
              return document.querySelector('meta[name="csrf-token"]')?.content
                || (window.Roblox?.XsrfToken?.getToken?.() ?? '');
            } catch (_) { return ''; }
          };

          // Minimal body — Roblox web client gamejoin için bunlardan fazlasını göndermiyor.
          // Önceki denemede joinAttemptOrigin/joinAttemptId eklenmesi status:12'ye sebep olmuştu.
          const buildBody = () => JSON.stringify({
            placeId: parseInt(placeId, 10),
            isTeleport: false,
            gameId: null,
            gameJoinAttemptId: (crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`)
          });

          const doPost = (csrf) => fetch('https://gamejoin.roblox.com/v1/join-game-instance', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-TOKEN': csrf,
              'Accept': 'application/json'
            },
            body: buildBody()
          });

          try {
            let res = await doPost(getCsrf());
            // 403 + x-csrf-token rotation → 1 kere retry
            if (res.status === 403) {
              const fresh = res.headers.get('x-csrf-token');
              if (fresh) res = await doPost(fresh);
            }
            if (!res.ok) return { ok: false, status: res.status };
            const data = await res.json();
            const jobId = data.jobId || data.joinScript?.JobId || data.joinScript?.jobId;
            return { ok: true, status: data.status, jobId, message: data.message };
          } catch (err) {
            return { ok: false, error: String(err && err.message || err) };
          }
        },
        args: [String(placeId)]
      }).then(results => {
        sendResponse(results?.[0]?.result || { ok: false, error: 'no_result' });
      }).catch(err => {
        console.error('[SW] swMainWorldMatchmaker error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    };

    if (senderTabId) {
      // Content script'ten geldi → o tab'ı kullan (en doğru, en hızlı)
      runOnTab(senderTabId);
    } else {
      // Popup/sidepanel'den geldi → aktif Roblox tab bul
      chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        const tab = tabs.find(t => /roblox\.com/.test(t.url || ''));
        if (!tab) { sendResponse({ ok: false, error: 'no_roblox_tab' }); return; }
        runOnTab(tab.id);
      }).catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    }
    return true;
  }

  // C+D Cerrahi Faz -1: RESERVED SERVER PROBE
  // Roblox'un /private-server/v1/private-server/games/{universeId}/private-servers/reserve endpoint'i
  // bazı oyunlar için ÜCRETSİZ reserved (private) server veriyor. Eğer oyun bunu destekliyorsa
  // garantili boş server elde edebiliriz. MAIN world'de auth context ile çağırılır.
  if (request.action === "swMainWorldReserveServer") {
    const universeId = request.universeId;
    const placeId = request.placeId;
    const senderTabId = sender.tab && sender.tab.id;

    const runOnTab = (tabId) => {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: async (universeId, placeId) => {
          const getCsrf = () => {
            try {
              return document.querySelector('meta[name="csrf-token"]')?.content
                || (window.Roblox?.XsrfToken?.getToken?.() ?? '');
            } catch (_) { return ''; }
          };

          const tryEndpoints = async (csrf) => {
            const endpoints = [
              // Yeni endpoint
              `https://apis.roblox.com/private-server/v1/private-server/games/${universeId}/private-servers/reserve`,
              // Eski endpoint
              `https://games.roblox.com/v1/games/vip-servers/${universeId}`,
              // Fallback
              `https://gamejoin.roblox.com/v1/join-private-game`
            ];

            for (const url of endpoints) {
              try {
                const body = url.includes('join-private-game')
                  ? JSON.stringify({ placeId: parseInt(placeId, 10), accessCode: '' })
                  : '{}';
                const res = await fetch(url, {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf,
                    'Accept': 'application/json'
                  },
                  body
                });

                if (res.status === 403) {
                  const fresh = res.headers.get('x-csrf-token');
                  if (fresh && fresh !== csrf) {
                    csrf = fresh;
                    continue;
                  }
                }

                if (!res.ok) continue;
                const data = await res.json();
                const accessCode = data.accessCode || data.AccessCode || data.privateServerAccessCode || data.linkCode;
                if (accessCode) return { ok: true, accessCode, endpoint: url };
              } catch (_) {}
            }
            return null;
          };

          // Ayrıca: Kullanıcının zaten erişimi olan private server var mı kontrol et
          try {
            const ownedRes = await fetch(`https://games.roblox.com/v1/games/${universeId}/private-servers?limit=10`, {
              credentials: 'include'
            });
            if (ownedRes.ok) {
              const d = await ownedRes.json();
              const owned = (d.data || []).find(s => s.accessCode || s.linkCode);
              if (owned) {
                return { ok: true, accessCode: owned.accessCode || owned.linkCode, source: 'owned' };
              }
            }
          } catch (_) {}

          // Reserved server probe
          const result = await tryEndpoints(getCsrf());
          return result || { ok: false, error: 'No reserved server available' };
        },
        args: [universeId, String(placeId)]
      }).then(results => {
        sendResponse(results?.[0]?.result || { ok: false, error: 'no_result' });
      }).catch(err => {
        console.error('[SW] swMainWorldReserveServer error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    };

    if (senderTabId) {
      runOnTab(senderTabId);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        const tab = tabs.find(t => /roblox\.com/.test(t.url || ''));
        if (!tab) { sendResponse({ ok: false, error: 'no_roblox_tab' }); return; }
        runOnTab(tab.id);
      }).catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    }
    return true;
  }

  // C+D Cerrahi Faz 2: Thumbnails batch'i MAIN world'de çek.
  // Auth context'te daha fazla field dönebilir mi diye deneme — token→userId resolution için.
  if (request.action === "swMainWorldThumbnailsBatch") {
    const requests = request.requests || [];
    const senderTabId = sender.tab && sender.tab.id;

    const runOnTab = (tabId) => {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: async (requests) => {
          try {
            const res = await fetch('https://thumbnails.roblox.com/v1/batch', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(requests)
            });
            if (res.status === 429) return { ok: false, status: 429, rateLimited: true };
            if (!res.ok) return { ok: false, status: res.status };
            const data = await res.json();
            return { ok: true, data };
          } catch (err) {
            return { ok: false, error: String(err && err.message || err) };
          }
        },
        args: [requests]
      }).then(results => {
        sendResponse(results?.[0]?.result || { ok: false, error: 'no_result' });
      }).catch(err => {
        console.error('[SW] swMainWorldThumbnailsBatch error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    };

    if (senderTabId) {
      runOnTab(senderTabId);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        const tab = tabs.find(t => /roblox\.com/.test(t.url || ''));
        if (!tab) { sendResponse({ ok: false, error: 'no_roblox_tab' }); return; }
        runOnTab(tab.id);
      }).catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    }
    return true;
  }

  // C+D Cerrahi Faz 1: Public servers list'i MAIN world'de çek.
  // Sebep: content-script fetch'inde Roblox playerTokens field'ını gizleyebiliyor (anti-automation).
  // MAIN world = page context = Roblox.com'un kendi JS'i gibi → tam response (playerTokens dahil).
  if (request.action === "swMainWorldFetchServers") {
    const placeId = request.placeId;
    const sort = request.sort || 'Asc';
    const cursor = request.cursor || null;
    const senderTabId = sender.tab && sender.tab.id;

    const runOnTab = (tabId) => {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: async (placeId, sort, cursor) => {
          try {
            const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=${sort}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
            const res = await fetch(url, { credentials: 'include' });
            if (res.status === 429) return { ok: false, status: 429, rateLimited: true };
            if (!res.ok) return { ok: false, status: res.status };
            const data = await res.json();
            return { ok: true, data };
          } catch (err) {
            return { ok: false, error: String(err && err.message || err) };
          }
        },
        args: [String(placeId), sort, cursor]
      }).then(results => {
        sendResponse(results?.[0]?.result || { ok: false, error: 'no_result' });
      }).catch(err => {
        console.error('[SW] swMainWorldFetchServers error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    };

    if (senderTabId) {
      runOnTab(senderTabId);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        const tab = tabs.find(t => /roblox\.com/.test(t.url || ''));
        if (!tab) { sendResponse({ ok: false, error: 'no_roblox_tab' }); return; }
        runOnTab(tab.id);
      }).catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    }
    return true;
  }

  // A+B Phase 3 fallback: Roblox.GameLauncher.joinMultiplayerGame'i MAIN world'de doğrudan çağır.
  // Bu Roblox'un Play butonunun çağırdığı fonksiyon — kendi gamejoin flow'unu başlatır.
  // jobId görmüyoruz ama zaten bu noktaya geldiysek block list aktif → Roblox client respect edecek.
  if (request.action === "swMainWorldJoinMultiplayer") {
    const placeId = request.placeId;
    const senderTabId = sender.tab && sender.tab.id;

    const runOnTab = (tabId) => {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (placeId) => {
          try {
            const pid = parseInt(placeId, 10);
            // joinMultiplayerGame Roblox web client'ın Play button mekanizması
            if (window.Roblox?.GameLauncher?.joinMultiplayerGame) {
              Roblox.GameLauncher.joinMultiplayerGame(pid);
              return { ok: true, method: 'joinMultiplayerGame' };
            }
            // Alternatif: joinGameInstance jobId'siz çağırılabilir mi?
            if (window.Roblox?.GameLauncher?.joinGameInstance) {
              Roblox.GameLauncher.joinGameInstance(pid);
              return { ok: true, method: 'joinGameInstance_no_jobid' };
            }
            return { ok: false, error: 'no_launcher_api' };
          } catch (e) {
            return { ok: false, error: String(e.message || e) };
          }
        },
        args: [String(placeId)]
      }).then(results => {
        sendResponse(results?.[0]?.result || { ok: false, error: 'no_result' });
      }).catch(err => {
        console.error('[SW] swMainWorldJoinMultiplayer error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    };

    if (senderTabId) {
      runOnTab(senderTabId);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        const tab = tabs.find(t => /roblox\.com/.test(t.url || ''));
        if (!tab) { sendResponse({ ok: false, error: 'no_roblox_tab' }); return; }
        runOnTab(tab.id);
      }).catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    }
    return true;
  }

  if (request.action === "joinGame") {
    (async () => {
      try {
        const { placeId, useBestServer, jobId } = request;
        
        if (!placeId) {
          sendResponse({ success: false, error: 'Place ID required' });
          return;
        }
        
        // Get best server from cache if requested
        let targetJobId = jobId;
        if (useBestServer && !targetJobId) {
          const storage = await chrome.storage.local.get('rota_best_region');
          const bestRegion = storage.rota_best_region;
          if (bestRegion && bestRegion.jobId) {
            targetJobId = bestRegion.jobId;
          }
        }
        
        // Create join link
        const joinUrl = targetJobId 
          ? `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${targetJobId}`
          : `roblox://experiences/start?placeId=${placeId}`;
        
        // Open in new tab
        await chrome.tabs.create({ url: joinUrl });
        
        sendResponse({ success: true });
      } catch (err) {
        console.error('[SW] Join game error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  
  if (request.action === "getCachedPingData") {
    (async () => {
      try {
        const storage = await chrome.storage.local.get(['rota_ping_results', 'rota_best_region']);
        sendResponse({
          success: true,
          pings: storage.rota_ping_results || [],
          best: storage.rota_best_region || null
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // ── Instance Trigger: CORS-free istekler (SW context = host_permissions bypass) ──

  if (request.action === "swGetGameInfo") {
    (async () => {
      try {
        const univRes = await fetch(
          `https://apis.roblox.com/universes/v1/places/${request.placeId}/universe`,
          { credentials: 'omit' }
        );
        if (!univRes.ok) { sendResponse({ groupId: null, playing: 0 }); return; }
        const universeId = (await univRes.json()).universeId;

        // v2 → creator info
        let creatorType = null, creatorId = null;
        try {
          const gameRes = await fetch(
            `https://games.roblox.com/v2/games?universeIds=${universeId}`,
            { credentials: 'omit' }
          );
          if (gameRes.ok) {
            const game = (await gameRes.json()).data?.[0];
            creatorType = game?.creator?.type;
            creatorId = game?.creator?.id;
          }
        } catch (_) {}

        // v1 → playing count (gerçek aktif oyuncu sayısı)
        let playing = 0;
        try {
          const v1Res = await fetch(
            `https://games.roblox.com/v1/games?universeIds=${universeId}`,
            { credentials: 'omit' }
          );
          if (v1Res.ok) {
            const v1 = await v1Res.json();
            playing = v1.data?.[0]?.playing || 0;
          }
        } catch (_) {}

        const groupId = creatorType === 'Group' ? creatorId : null;
        sendResponse({ groupId, universeId, playing, creatorType, creatorId });
      } catch (e) {
        sendResponse({ groupId: null, universeId: null, playing: 0 });
      }
    })();
    return true;
  }

  // Endpoint cache: ilk başarılı endpoint'i hatırla
  if (!self._blockEpIdx) self._blockEpIdx = 0;
  if (!self._unblockEpIdx) self._unblockEpIdx = 0;

  const BLOCK_ENDPOINTS = [
    uid => `https://apis.roblox.com/user-blocking-api/v1/users/${uid}/block-user`,
    uid => `https://accountsettings.roblox.com/v1/users/${uid}/block`,
    uid => `https://accountinformation.roblox.com/v1/users/${uid}/block`,
    uid => `https://apis.roblox.com/user-blocking-service/v1/users/${uid}/block`,
  ];
  const UNBLOCK_ENDPOINTS = [
    uid => `https://apis.roblox.com/user-blocking-api/v1/users/${uid}/unblock-user`,
    uid => `https://accountsettings.roblox.com/v1/users/${uid}/unblock`,
    uid => `https://accountinformation.roblox.com/v1/users/${uid}/unblock`,
    uid => `https://apis.roblox.com/user-blocking-service/v1/users/${uid}/unblock`,
  ];

  if (request.action === "swBlockUser") {
    (async () => {
      try {
        let csrf = request.csrf;

        const tryFetch = async (epFn, c) => {
          return fetch(epFn(request.userId), {
            method: 'POST',
            headers: { 'X-CSRF-Token': c, 'Content-Type': 'application/json' },
            credentials: 'include',
            body: '{}'
          });
        };

        // Önce cached endpoint'i dene
        let epIdx = self._blockEpIdx;
        let res = await tryFetch(BLOCK_ENDPOINTS[epIdx], csrf);

        // CSRF refresh
        if (res.status === 403) {
          const probe = await fetch('https://auth.roblox.com/v2/logout', { method: 'POST', credentials: 'include' });
          csrf = probe.headers.get('X-CSRF-Token') || csrf;
          res = await tryFetch(BLOCK_ENDPOINTS[epIdx], csrf);
        }

        // 404 → diğer endpoint'leri dene
        if (res.status === 404) {
          for (let i = 0; i < BLOCK_ENDPOINTS.length; i++) {
            if (i === epIdx) continue;
            const r = await tryFetch(BLOCK_ENDPOINTS[i], csrf);
            console.log(`[SW] Block endpoint ${i} (${BLOCK_ENDPOINTS[i](request.userId)}) → status ${r.status}`);
            if (r.status !== 404) {
              self._blockEpIdx = i;
              res = r;
              break;
            }
          }
        }

        const ok = res.ok || res.status === 200;
        const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
        if (!ok) console.warn('[SW] Block failed uid=', request.userId, 'status:', res.status, 'retry-after:', retryAfter);
        sendResponse({ ok, csrf, status: res.status, retryAfter });
      } catch (e) {
        console.error('[SW] Block exception', e);
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (request.action === "swUnblockUser") {
    (async () => {
      try {
        const tryFetch = async (epFn) => fetch(epFn(request.userId), {
          method: 'POST',
          headers: { 'X-CSRF-Token': request.csrf, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: '{}'
        });

        let epIdx = self._unblockEpIdx;
        let res = await tryFetch(UNBLOCK_ENDPOINTS[epIdx]);

        if (res.status === 404) {
          for (let i = 0; i < UNBLOCK_ENDPOINTS.length; i++) {
            if (i === epIdx) continue;
            const r = await tryFetch(UNBLOCK_ENDPOINTS[i]);
            if (r.status !== 404) {
              self._unblockEpIdx = i;
              res = r;
              break;
            }
          }
        }

        sendResponse({ ok: res.ok, status: res.status });
      } catch (e) {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

});
// ==================== ULTIMATE EVENT DETECTION SYSTEM ====================

// KESIN YAZI KALIPLARI
const DEFINITE_PATTERNS = {
  live_events: [
    /\bevent\s+is\s+now\s+live\b/i, /\bevent\s+has\s+started\b/i,
    /\blive\s+event\s+active\b/i, /\bevent\s+is\s+active\b/i,
    /\bjoin\s+the\s+event\s+now\b/i, /\bevent\s+now\s+live\b/i,
    /\bnew\s+event\s+released?\b/i, /\bevent\s+just\s+started\b/i,
    /\betkinlik\s+başladı\b/i, /\betkinlik\s+şu an\s+aktif\b/i,
    /\betkinlik\s+canlı\b/i, /\byeni\s+etkinlik\s+başladı\b/i
  ],
  limited_time: [
    /\blimited\s+time\s+event\b/i, /\blimited\s+event\s+now\s+live\b/i,
    /\bsınırlı\s+süreli\s+etkinlik\b/i, /\bsınırlı\s+etkinlik\s+başladı\b/i,
    /\blimited\s+item\s+drop\b/i, /\bsınırlı\s+eşya\s+dağıtımı\b/i
  ],
  multiplier_events: [
    /\bdouble\s+xp\s+weekend\b/i, /\b2x\s+xp\s+event\b/i,
    /\b3x\s+xp\s+active\b/i, /\bdouble\s+coins?\s+event\b/i,
    /\b2x\s+cash\s+weekend\b/i, /\bçifte\s+xp\s+hafta\s+sonu\b/i
  ],
  season_events: [
    /\bnew\s+season\s+started\b/i, /\bseason\s+\d+\s+live\b/i,
    /\bchapter\s+\d+\s+released?\b/i, /\byeni\s+sezon\s+başladı\b/i
  ],
  reward_events: [
    /\bfree\s+item\s+drop\b/i, /\bfree\s+reward\s+event\b/i,
    /\btoken\s+event\s+live\b/i, /\bbedava\s+eşya\s+etkinliği\b/i
  ]
};

const DEFINITE_NEGATIVE_PATTERNS = [
  /\bevent\s+ended\b/i, /\bevent\s+over\b/i,
  /\bno\s+active\s+event\b/i, /\bevent\s+coming\s+soon\b/i,
  /\betkinlik\s+bitti\b/i, /\baktif\s+etkinlik\s+yok\b/i
];

// ==================== HYBRID ANALYZER ====================

class HybridEventAnalyzer {
  constructor() {
    this.SIGNALS = {
      TITLE_DEFINITE:    120,  // Başlıkta kesin etkinlik kalıbı
      TITLE_STRONG:       75,  // Başlıkta güçlü etkinlik kelimesi
      TEXT_DEFINITE:     100,  // Açıklamada kesin kalıp
      TEXT_STRONG:        55,  // Açıklamada güçlü kalıp
      PLAYER_SPIKE:       70,  // %30–99 oyuncu artışı
      PLAYER_SPIKE_BIG:   90,  // %100+ oyuncu artışı
      RECENT_UPDATE:      45,  // 12 saat içinde güncelleme
      RECENT_UPDATE_24:   30,  // 24 saat içinde güncelleme
      THUMBNAIL_CHANGE:   35,  // Thumbnail değişikliği
      WEEKEND_EVENT_HOUR: 25,  // Haftasonu event saati
      // Yeni sinyaller (v3.8 — daha derin analiz)
      FAVORITE_SPIKE:     60,  // Favorilenme oranında ani artış (%20+)
      FAVORITE_SPIKE_BIG: 85,  // Favorilenme oranında patlama (%50+)
      LIKE_RATIO_JUMP:    50,  // Beğeni oranı son 24h'da iyileşti
      SERVER_COUNT_SPIKE: 75,  // Aktif server sayısı ani artış (%40+)
      AVG_SERVER_FULLER:  40,  // Server doluluk ortalaması arttı (oyuncular oyna takılıyor)
      VOICE_CHAT_NEW:     35,  // Voice chat yeni etkinleştirildi
      BADGE_NEW:          30,  // Yeni badge eklendi (event badge sıkça)
      EVENING_PEAK_HOUR:  20,  // Hafta içi akşam peak (18-23)
      DESC_TR_EXTRA:      40,  // Genişletilmiş TR açıklama pattern (yarışma, ödül, vb)
    };
    this.THRESHOLD_DEFINITE = 110;
    this.THRESHOLD_POSSIBLE =  60;
  }

  async analyze(gameId, universeId, currentData, historyData) {
    const signals = [];
    let totalScore = 0;
    const add = (type, score, reason) => { signals.push({ type, score, reason }); totalScore += score; };

    // 1. BAŞLIK ANALİZİ — en güvenilir kaynak
    const titleResult = this.analyzeTitle(currentData.title, historyData.title);
    if (titleResult) add(titleResult.type, this.SIGNALS[titleResult.type], titleResult.reason);

    // 2. AÇIKLAMA ANALİZİ — sadece ilk 800 karakter, eski metinlerden kaçın
    const descResult = this.analyzeDescription(currentData.description);
    if (descResult) add(descResult.type, this.SIGNALS[descResult.type], descResult.reason);

    // 3. OYUNCU ARTIŞI
    if (historyData.playerCount > 0 && currentData.playerCount > 0) {
      const ratio = currentData.playerCount / historyData.playerCount;
      if (ratio >= 2.0) {
        add('PLAYER_SPIKE_BIG', this.SIGNALS.PLAYER_SPIKE_BIG,
          `Oyuncu sayısı 2x+ arttı (${historyData.playerCount.toLocaleString()} → ${currentData.playerCount.toLocaleString()})`);
      } else if (ratio >= 1.3) {
        add('PLAYER_SPIKE', this.SIGNALS.PLAYER_SPIKE,
          `Oyuncu sayısı %${Math.round((ratio - 1) * 100)} arttı (${historyData.playerCount.toLocaleString()} → ${currentData.playerCount.toLocaleString()})`);
      }
    }

    // 4. SON GÜNCELLEME
    if (currentData.updated) {
      const hoursAgo = (Date.now() - currentData.updated) / 3_600_000;
      if (hoursAgo < 12) {
        add('RECENT_UPDATE', this.SIGNALS.RECENT_UPDATE,
          `${Math.round(hoursAgo)} saat önce güncellendi`);
      } else if (hoursAgo < 24) {
        add('RECENT_UPDATE_24', this.SIGNALS.RECENT_UPDATE_24,
          `${Math.round(hoursAgo)} saat önce güncellendi`);
      }
    }

    // 5. THUMBNAIL DEĞİŞİKLİĞİ
    if (historyData.thumbnail && currentData.thumbnail &&
        historyData.thumbnail !== currentData.thumbnail) {
      add('THUMBNAIL_CHANGE', this.SIGNALS.THUMBNAIL_CHANGE, 'Oyun görseli değişti');
    }

    // 6. ZAMAN BAZLI
    const timeSignal = this.analyzeTimePatterns();
    if (timeSignal) add(timeSignal.type, timeSignal.score, timeSignal.reason);

    // 7. FAVORITE SPIKE — favorilenme oranı ani artış (event döneminde insanlar favorile)
    if (typeof historyData.favoritedCount === 'number' && typeof currentData.favoritedCount === 'number'
        && historyData.favoritedCount > 0) {
      const favRatio = currentData.favoritedCount / historyData.favoritedCount;
      if (favRatio >= 1.5) {
        add('FAVORITE_SPIKE_BIG', this.SIGNALS.FAVORITE_SPIKE_BIG,
          `Favorilenme %${Math.round((favRatio - 1) * 100)} arttı (${historyData.favoritedCount.toLocaleString()} → ${currentData.favoritedCount.toLocaleString()})`);
      } else if (favRatio >= 1.2) {
        add('FAVORITE_SPIKE', this.SIGNALS.FAVORITE_SPIKE,
          `Favorilenme %${Math.round((favRatio - 1) * 100)} arttı`);
      }
    }

    // 8. LIKE RATIO JUMP — beğeni oranı iyileşti (yeni içerik tepki sinyali)
    if (typeof historyData.likeRatio === 'number' && typeof currentData.likeRatio === 'number'
        && historyData.likeRatio > 0 && currentData.likeRatio - historyData.likeRatio >= 0.05) {
      add('LIKE_RATIO_JUMP', this.SIGNALS.LIKE_RATIO_JUMP,
        `Beğeni oranı +%${Math.round((currentData.likeRatio - historyData.likeRatio) * 100)} (${Math.round(historyData.likeRatio * 100)}% → ${Math.round(currentData.likeRatio * 100)}%)`);
    }

    // 9. SERVER COUNT SPIKE — aktif server sayısı patlaması (event = matchmaker yeni instance açar)
    if (typeof historyData.serverCount === 'number' && typeof currentData.serverCount === 'number'
        && historyData.serverCount > 0) {
      const srvRatio = currentData.serverCount / historyData.serverCount;
      if (srvRatio >= 1.4) {
        add('SERVER_COUNT_SPIKE', this.SIGNALS.SERVER_COUNT_SPIKE,
          `Aktif server sayısı %${Math.round((srvRatio - 1) * 100)} arttı (${historyData.serverCount} → ${currentData.serverCount})`);
      }
    }

    // 10. AVG SERVER FULLNESS — server'lar daha dolu (insanlar oyunda takılıyor → event sürüyor)
    if (typeof historyData.avgFullness === 'number' && typeof currentData.avgFullness === 'number'
        && currentData.avgFullness - historyData.avgFullness >= 0.15) {
      add('AVG_SERVER_FULLER', this.SIGNALS.AVG_SERVER_FULLER,
        `Server doluluk %${Math.round((currentData.avgFullness - historyData.avgFullness) * 100)} arttı`);
    }

    // 11. VOICE CHAT NEW — voice chat yeni etkinleştirildi (event organizasyonu için)
    if (currentData.voiceEnabled && !historyData.voiceEnabled) {
      add('VOICE_CHAT_NEW', this.SIGNALS.VOICE_CHAT_NEW, 'Voice chat yeni etkinleştirildi');
    }

    // 12. BADGE NEW — yeni badge eklendi (event badge yaygın)
    if (typeof currentData.badgeCount === 'number' && typeof historyData.badgeCount === 'number'
        && currentData.badgeCount > historyData.badgeCount) {
      const newBadges = currentData.badgeCount - historyData.badgeCount;
      add('BADGE_NEW', this.SIGNALS.BADGE_NEW, `${newBadges} yeni badge eklendi`);
    }

    const isDefiniteEvent = totalScore >= this.THRESHOLD_DEFINITE;
    const isPossibleEvent = totalScore >= this.THRESHOLD_POSSIBLE;

    return {
      isEvent: isDefiniteEvent || isPossibleEvent,
      isDefinite: isDefiniteEvent,
      confidence: isDefiniteEvent ? 'kesin' : (isPossibleEvent ? 'olası' : 'yok'),
      totalScore,
      signals,
      recommendation: this.getRecommendation(isDefiniteEvent, isPossibleEvent, signals)
    };
  }

  analyzeTitle(title, previousTitle) {
    if (!title) return null;
    const t = title.toLowerCase();

    for (const pattern of DEFINITE_NEGATIVE_PATTERNS) {
      if (pattern.test(t)) return null;
    }

    // Köşeli parantez etiketi: [EVENT], [LIVE], [UPDATE], [ETKİNLİK] vb.
    if (/\[(?:event|live|update|etkinlik|aktif|season|new|yeni|fest)\]/i.test(t)) {
      return { type: 'TITLE_DEFINITE', reason: `Başlık etiketi: "${title}"` };
    }

    // Kesin kalıplar başlıkta
    for (const patterns of Object.values(DEFINITE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(t)) {
          return { type: 'TITLE_DEFINITE', reason: `Başlıkta kesin kalıp: "${title}"` };
        }
      }
    }

    // Güçlü tekil kelimeler başlıkta
    const STRONG = ['event', 'etkinlik', 'festival', 'halloween', 'christmas', 'summer',
      'winter', 'collab', 'update', 'limited', 'anniversary', 'seasonal',
      'celebration', 'tournament', 'bonus', 'fest', 'holiday', 'special'];
    const found = STRONG.filter(kw => t.includes(kw));
    if (found.length > 0) {
      // Başlık değiştiyse sinyal daha güçlü
      const titleChanged = previousTitle && previousTitle.toLowerCase() !== t;
      if (titleChanged) {
        return { type: 'TITLE_DEFINITE', reason: `Başlık değişti + etkinlik kelimesi: "${title}"` };
      }
      return { type: 'TITLE_STRONG', reason: `Başlıkta: ${found.join(', ')}` };
    }

    return null;
  }

  analyzeDescription(description) {
    if (!description) return null;
    const d = description.toLowerCase().slice(0, 800);

    for (const pattern of DEFINITE_NEGATIVE_PATTERNS) {
      if (pattern.test(d)) return null;
    }

    for (const patterns of Object.values(DEFINITE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(d)) {
          return { type: 'TEXT_DEFINITE', reason: 'Açıklamada kesin etkinlik kalıbı' };
        }
      }
    }

    const STRONG = ['event', 'live now', 'active now', 'etkinlik', '2x', 'double xp', 'bonus weekend', 'limited time'];
    const found = STRONG.filter(kw => d.includes(kw));

    // GENİŞLETİLMİŞ TR pattern'lar — kombinasyon tetikleyicisi
    // Yarışma/turnuva/ödül/katılma süresi gibi event'e işaret eden TR keywords.
    const TR_EXTRA = [
      'yarışma', 'turnuva', 'ödül', 'kazan', 'hediye', 'çekiliş',
      'son gün', 'son şans', 'kaçırma', 'katıl', 'katılma süresi',
      'bonus', 'çift xp', 'sınırlı', 'güncelleme', 'yeni güncelleme',
      'kod', 'redeem', 'free', 'ücretsiz', 'beta'
    ];
    const trFound = TR_EXTRA.filter(kw => d.includes(kw));
    if (trFound.length >= 2) {
      // Aynı zamanda STRONG eşleşmesi varsa toplam skor için her ikisini de döndür
      if (found.length >= 1) {
        return { type: 'TEXT_STRONG', reason: `Açıklamada: ${found.concat(trFound).slice(0, 4).join(', ')}` };
      }
      return { type: 'DESC_TR_EXTRA', reason: `TR event sinyali: ${trFound.slice(0, 4).join(', ')}` };
    }

    if (found.length >= 2) {
      return { type: 'TEXT_STRONG', reason: `Açıklamada: ${found.join(', ')}` };
    }

    return null;
  }

  analyzeTimePatterns() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    // Cumartesi prime time
    if (day === 6 && hour >= 15 && hour <= 21)
      return { type: 'WEEKEND_EVENT_HOUR', score: this.SIGNALS.WEEKEND_EVENT_HOUR, reason: 'Haftasonu event saati (Cumartesi 15-21)' };
    // Pazar prime time
    if (day === 0 && hour >= 14 && hour <= 20)
      return { type: 'WEEKEND_EVENT_HOUR', score: Math.round(this.SIGNALS.WEEKEND_EVENT_HOUR * 0.7), reason: 'Haftasonu event saati (Pazar)' };
    // Hafta içi akşam peak (geleneksel oyuncu yoğunluğu — event'ler bunu hedefler)
    if (day >= 1 && day <= 5 && hour >= 18 && hour <= 23)
      return { type: 'EVENING_PEAK_HOUR', score: this.SIGNALS.EVENING_PEAK_HOUR, reason: 'Hafta içi akşam peak (18-23)' };
    return null;
  }

  getRecommendation(isDefinite, isPossible, signals) {
    if (isDefinite) return 'event_rec_definite';
    if (isPossible) return 'event_rec_possible';
    return 'event_rec_none';
  }
}

const analyzer = new HybridEventAnalyzer();

// ==================== MAIN DETECTION ====================

async function detectLiveEvents() {
  if (!navigator.onLine) { console.log('[SW] Offline, skipping detectLiveEvents'); return; }
  try {
    const data = await chrome.storage.local.get([
      'rota_favorites', 'rota_detected_events', 'rota_settings',
      'rota_game_history', 'rota_player_history'
    ]);
    
    const favorites = data.rota_favorites || [];
    const detectedEvents = data.rota_detected_events || {};
    const settings = data.rota_settings || {};
    const gameHistory = data.rota_game_history || {};
    const playerHistory = data.rota_player_history || {};

    if (!settings.eventDetection?.enabled) return;
    if (favorites.length === 0) return;
    if (settings.silentMode) return;

    console.log('[SW] Hybrid Event Detection starting...');

    for (const game of favorites) {
      try {
        // Universe ID
        const universeRes = await fetch(`https://apis.roblox.com/universes/v1/places/${game.placeId}/universe`);
        if (!universeRes.ok) continue;
        const universeData = await universeRes.json();
        const universeId = universeData.universeId;
        if (!universeId) continue;

        // Game Details
        const gameRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        if (!gameRes.ok) continue;
        const gameData = await gameRes.json();
        if (!gameData.data || gameData.data.length === 0) continue;
        
        const details = gameData.data[0];
        
        // Thumbnail kontrolü
        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`);
        let thumbnailUrl = null;
        if (thumbRes.ok) {
          const thumbData = await thumbRes.json();
          thumbnailUrl = thumbData.data?.[0]?.imageUrl;
        }

        // Yeni signal'ler için ek metrikler — votes, server count, voice chat
        let likeRatio = null, favoritedCount = null, serverCount = null, avgFullness = null;
        let voiceEnabled = false, badgeCount = null;
        try {
          // Votes (like/dislike ratio)
          const votesRes = await fetch(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`, { credentials: 'omit' });
          if (votesRes.ok) {
            const votesData = await votesRes.json();
            const v = votesData.data?.[0];
            if (v && (v.upVotes + v.downVotes > 0)) {
              likeRatio = v.upVotes / (v.upVotes + v.downVotes);
            }
          }
        } catch (_) {}
        try {
          // Favorite count (details endpoint zaten döndürüyorsa kullan, yoksa ayrı çağır)
          favoritedCount = (typeof details.favoritedCount === 'number') ? details.favoritedCount : null;
        } catch (_) {}
        try {
          // Active server count + average fullness (ilk 100 server snapshot)
          const srvRes = await fetch(`https://games.roblox.com/v1/games/${game.placeId}/servers/Public?sortOrder=Desc&limit=100`, { credentials: 'omit' });
          if (srvRes.ok) {
            const srvData = await srvRes.json();
            const servers = srvData.data || [];
            serverCount = servers.length;
            if (servers.length > 0) {
              const totalFullness = servers.reduce((sum, s) => {
                if (s.maxPlayers > 0) return sum + (s.playing / s.maxPlayers);
                return sum;
              }, 0);
              avgFullness = totalFullness / servers.length;
            }
          }
        } catch (_) {}
        try {
          // Voice chat ve badge bilgileri (details endpoint'inden gelirse)
          voiceEnabled = !!(details.universeAvatarType === 'PlayerChoice' || details.allowedGearGenres);
          // Daha güvenilir: voice chat capability check
          if (typeof details.isVoiceEnabled === 'boolean') voiceEnabled = details.isVoiceEnabled;
        } catch (_) {}
        try {
          // Badge count
          const badgeRes = await fetch(`https://badges.roblox.com/v1/universes/${universeId}/badges?limit=10&sortOrder=Desc`, { credentials: 'omit' });
          if (badgeRes.ok) {
            const badgeData = await badgeRes.json();
            // Toplam değil, son 10'un sayısı yeterli (yeni eklenen tetikler)
            badgeCount = (badgeData.data || []).length;
          }
        } catch (_) {}

        // Mevcut veri (genişletilmiş)
        const currentData = {
          title: details.name || '',
          description: details.description || '',
          playerCount: details.playing || 0,
          updated: details.updated ? new Date(details.updated).getTime() : null,
          thumbnail: thumbnailUrl,
          favoritedCount, likeRatio, serverCount, avgFullness, voiceEnabled, badgeCount
        };

        // Geçmiş veri
        const history = gameHistory[game.placeId] || {};
        const playerHist = playerHistory[game.placeId] || {};
        const historyData = {
          title: history.title || '',
          description: history.description || '',
          playerCount: playerHist.count || currentData.playerCount,
          thumbnail: history.thumbnail,
          favoritedCount: history.favoritedCount,
          likeRatio: history.likeRatio,
          serverCount: history.serverCount,
          avgFullness: history.avgFullness,
          voiceEnabled: history.voiceEnabled,
          badgeCount: history.badgeCount
        };

        // Hybrid analiz
        const result = await analyzer.analyze(game.placeId, universeId, currentData, historyData);

        // Verileri kaydet (universeId'yi de sakla ki detectPlayerSpikes kullanabilsin)
        gameHistory[game.placeId] = {
          ...currentData,
          universeId: universeId,
          lastChecked: Date.now()
        };
        playerHistory[game.placeId] = {
          count: currentData.playerCount,
          timestamp: Date.now()
        };
        await chrome.storage.local.set({ 
          rota_game_history: gameHistory,
          rota_player_history: playerHistory
        });

        console.log(`[SW] ${currentData.title}: Score=${result.totalScore}, Event=${result.isEvent} (${result.confidence})`);

        // Bildirim (sadece kesin)
        if (result.isEvent && result.isDefinite) {
          const eventKey = `${game.placeId}_${currentData.title}_${Math.floor(Date.now()/86400000)}`;
          
          if (detectedEvents[eventKey]) {
            console.log(`[SW] Already notified for ${currentData.title}`);
            continue;
          }

          detectedEvents[eventKey] = true;
          await chrome.storage.local.set({ rota_detected_events: detectedEvents });

          // En güçlü sinyali bul
          const strongestSignal = result.signals.sort((a, b) => b.score - a.score)[0];

          // Locale-aware notification strings
          const settings = await chrome.storage.local.get('rota_settings');
          const locale = settings.rota_settings?.language || 'tr';
          const notifStrings = {
            tr: { event: 'Canlı Etkinlik!', join: '🎮 Hemen Katıl', close: '🔔 Kapat' },
            en: { event: 'Live Event!', join: '🎮 Join Now', close: '🔔 Close' }
          };
          const strings = notifStrings[locale] || notifStrings.tr;

          chrome.notifications.create(`event-${game.placeId}`, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: `🔴 ${currentData.title}`,
            message: `${strings.event} ${strongestSignal.reason}`,
            priority: 2,
            requireInteraction: true,
            buttons: [
              { title: strings.join },
              { title: strings.close }
            ]
          });

          console.log(`[SW] 🎉 EVENT DETECTED: ${currentData.title} (Score: ${result.totalScore})`);
        }

      } catch (err) {
        console.warn(`[SW] Error checking ${game.placeId}:`, err);
      }
    }

  } catch (error) {
    console.warn('[SW] Event detection failed:', error);
  }
}

// ==================== NOTIFICATION HANDLERS ====================

/**
 * Güvenli popup açma - Pencere kontrolü ile
 */
async function safeOpenPopup(placeId) {
  try {
    // Önce auto_scan verisini kaydet
    await chrome.storage.local.set({ 'rota_auto_scan': placeId });
    
    // Aktif pencere var mı kontrol et
    const windows = await chrome.windows.getAll({ populate: false });
    const normalWindow = windows.find(w => w.type === 'normal' && !w.state?.includes('minimized'));
    
    if (!normalWindow) {
      console.log('[SW] No active normal window, creating new window...');
      // Yeni pencere aç ve oyun sayfasına git
      await chrome.windows.create({ 
        url: `https://www.roblox.com/games/${placeId}/`,
        type: 'normal',
        focused: true
      });
      return;
    }
    
    // Aktif pencere var, önce ona odaklan
    await chrome.windows.update(normalWindow.id, { focused: true });
    
    // Popup'u açmaya çalış
    try {
      // chrome.action.openPopup() sadece kullanıcı etkileşimi ile çalışır
      // Service worker'dan otomatik açılamaz, bu yüzden popup yerine direkt oyun sayfası açalım
      const [activeTab] = await chrome.tabs.query({ active: true, windowId: normalWindow.id });
      
      if (activeTab && activeTab.url?.includes('roblox.com')) {
        // Zaten Roblox'ta, popup'u açmayı dene
        await chrome.action.openPopup();
      } else {
        // Roblox'ta değil, yeni sekme aç
        await chrome.tabs.create({
          windowId: normalWindow.id,
          url: `https://www.roblox.com/games/${placeId}/`,
          active: true
        });
      }
    } catch (popupErr) {
      // Popup açılamadı, direkt oyun sayfasına git
      console.log('[SW] Popup could not open, navigating to game page...');
      await chrome.tabs.create({
        windowId: normalWindow.id,
        url: `https://www.roblox.com/games/${placeId}/`,
        active: true
      });
    }
  } catch (err) {
    console.error('[SW] safeOpenPopup failed:', err);
    // Son çare: Yeni pencere aç
    try {
      await chrome.windows.create({ 
        url: `https://www.roblox.com/games/${placeId}/`,
        focused: true
      });
    } catch (e) {
      console.error('[SW] Failed to create window:', e);
    }
  }
}

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId.startsWith('event-')) {
    const placeId = notificationId.replace('event-', '');
    
    if (buttonIndex === 0) {
      // "Hemen Katıl" butonu
      await safeOpenPopup(placeId);
    }
    
    // Bildirimi kapat
    await chrome.notifications.clear(notificationId);
  }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId.startsWith('event-')) {
    const placeId = notificationId.replace('event-', '');
    await safeOpenPopup(placeId);
    await chrome.notifications.clear(notificationId);
  }
});

// ==================== PLAYER SPIKE DETECTION ====================

async function detectPlayerSpikes() {
  if (!navigator.onLine) { console.log('[SW] Offline, skipping detectPlayerSpikes'); return; }
  try {
    const data = await chrome.storage.local.get(['rota_favorites', 'rota_player_history', 'rota_settings', 'rota_game_history']);
    const favorites = data.rota_favorites || [];
    const playerHistory = data.rota_player_history || {};
    const gameHistory = data.rota_game_history || {};
    const settings = data.rota_settings || {};

    const threshold = settings.eventDetection?.playerSpikeThreshold || 1.5;

    for (const game of favorites) {
      const history = playerHistory[game.placeId];
      if (!history || !history.count) continue;

      // universeId'yi önce gameHistory'den al, yoksa API'den çek
      let universeId = gameHistory[game.placeId]?.universeId;
      if (!universeId) {
        try {
          const uniRes = await fetch(`https://apis.roblox.com/universes/v1/places/${game.placeId}/universe`);
          if (!uniRes.ok) continue;
          const uniData = await uniRes.json();
          universeId = uniData.universeId;
          if (!universeId) continue;
        } catch (e) {
          continue;
        }
      }

      try {
        const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        if (!res.ok) continue;
        
        const data = await res.json();
        const currentPlayers = data.data?.[0]?.playing || 0;
        
        const ratio = currentPlayers / history.count;
        
        if (ratio >= threshold) {
          console.log(`[SW] Player spike detected: ${game.title || game.placeId} - ${Math.round(ratio * 100)}% increase`);
          
          // Event detection'ı hemen tetikle
          chrome.alarms.create('detectLiveEvents', { when: Date.now() + 1000 });
        }

        // Güncelle
        playerHistory[game.placeId] = {
          count: currentPlayers,
          timestamp: Date.now()
        };

      } catch (e) {
        console.warn('[SW] Spike check failed:', e);
      }
    }

    await chrome.storage.local.set({ rota_player_history: playerHistory });

  } catch (err) {
    console.warn('[SW] Player spike detection error:', err);
  }
}

// ==================== TEST & HISTORY ====================

async function testEventDetection(placeId) {
  try {
    const universeRes = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    if (!universeRes.ok) return { success: false, error: 'Universe not found' };
    
    const universeData = await universeRes.json();
    const universeId = universeData.universeId;
    if (!universeId) return { success: false, error: 'No universe ID' };

    // Tüm verileri çek
    const [gameRes, thumbRes] = await Promise.all([
      fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`),
      fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png`)
    ]);

    if (!gameRes.ok) return { success: false, error: 'Game data not found' };
    
    const gameData = await gameRes.json();
    const thumbData = thumbRes.ok ? await thumbRes.json() : { data: [] };
    
    if (!gameData.data || gameData.data.length === 0) return { success: false, error: 'No game data' };
    
    const details = gameData.data[0];
    const currentData = {
      title: details.name,
      description: details.description,
      playerCount: details.playing,
      updated: details.updated ? new Date(details.updated).getTime() : null,
      thumbnail: thumbData.data?.[0]?.imageUrl
    };

    // Geçmiş verileri al
    const storage = await chrome.storage.local.get(['rota_game_history', 'rota_player_history']);
    const history = storage.rota_game_history?.[placeId] || {};
    const playerHist = storage.rota_player_history?.[placeId] || {};
    
    const historyData = {
      title: history.title || '',
      playerCount: playerHist.count || currentData.playerCount,
      thumbnail: history.thumbnail
    };

    // Analiz yap
    const result = await analyzer.analyze(placeId, universeId, currentData, historyData);

    return {
      success: true,
      title: details.name,
      currentData,
      historyData,
      analysis: result,
      signals: result.signals
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function analyzeSingleGame(placeId) {
  return await testEventDetection(placeId);
}

async function getEventHistory(placeId) {
  const data = await chrome.storage.local.get(['rota_game_history', 'rota_player_history', 'rota_detected_events']);
  return {
    history: data.rota_game_history?.[placeId] || null,
    playerHistory: data.rota_player_history?.[placeId] || null,
    detectedEvents: Object.keys(data.rota_detected_events || {})
      .filter(k => k.startsWith(placeId))
      .map(k => ({ key: k, date: data.rota_detected_events[k] }))
  };
}

// ==================== GAME LIBRARY ACTIVITY TRACKING ====================

async function trackGameLibraryActivity() {
  if (!navigator.onLine) { console.log('[SW] Offline, skipping trackGameLibraryActivity'); return; }
  try {
    const storage = await chrome.storage.local.get(['rota_favorites', 'rota_settings']);
    const favorites = storage.rota_favorites || [];
    const settings = storage.rota_settings || {};

    if (favorites.length === 0) return;

    const gameData = {};

    // Her favori oyunun canlı verisini çek (rate limit'e dikkat: max 10 oyun)
    const gamesToCheck = favorites.slice(0, 10);

    for (const game of gamesToCheck) {
      try {
        if (!game.placeId) continue;

        // 1. Universe ID al
        const uniRes = await fetch(`https://apis.roblox.com/universes/v1/places/${game.placeId}/universe`);
        if (!uniRes.ok) continue;
        const uniData = await uniRes.json();
        const universeId = uniData.universeId;
        if (!universeId) continue;

        // 2. Oyun detaylarını al
        const gameRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        if (!gameRes.ok) continue;
        const gameInfo = await gameRes.json();
        const details = gameInfo.data?.[0];
        if (!details) continue;

        // 3. Önceki player count'u al (trend hesabı için)
        const prevStorage = await chrome.storage.local.get('rota_game_data');
        const prevData = prevStorage.rota_game_data || {};
        const prevCount = prevData[game.placeId]?.playerCount || 0;
        const currentCount = details.playing || 0;

        // 4. Trend ikonu hesapla
        let trendIcon = '';
        if (prevCount > 0) {
          const ratio = currentCount / prevCount;
          if (ratio >= 1.3) trendIcon = '🔥';      // %30+ artış
          else if (ratio >= 1.1) trendIcon = '📈';  // %10+ artış
          else if (ratio <= 0.7) trendIcon = '📉';  // %30+ düşüş
          else if (ratio <= 0.9) trendIcon = '📉';  // %10+ düşüş
          else trendIcon = '➡️';                     // Stabil
        }

        // 5. Son güncelleme kontrolü (24 saat içinde mi?)
        const updateTime = details.updated ? new Date(details.updated).getTime() : 0;
        const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const hasRecentUpdate = updateTime > dayAgo;

        // 6. Update zaman metni
        let updateTimeText = '';
        if (hasRecentUpdate && updateTime) {
          const hoursAgo = Math.floor((Date.now() - updateTime) / (1000 * 60 * 60));
          if (hoursAgo < 1) updateTimeText = 'Az önce';
          else updateTimeText = `${hoursAgo} saat önce`;
        }

        gameData[game.placeId] = {
          playerCount: currentCount,
          trendIcon,
          hasRecentUpdate,
          updateTimeText,
          lastChecked: Date.now()
        };

        // API rate limit koruması: oyunlar arası bekleme
        await new Promise(r => setTimeout(r, 500));

      } catch (innerErr) {
        console.warn(`[SW] Library activity error for ${game.placeId}:`, innerErr.message);
      }
    }

    // Storage'a kaydet
    if (Object.keys(gameData).length > 0) {
      await chrome.storage.local.set({ rota_game_data: gameData });
      console.log(`[SW] Game library updated: ${Object.keys(gameData).length} games tracked`);
    }

  } catch (err) {
    console.error('[SW] trackGameLibraryActivity failed:', err);
  }
}

// ==================== BACKGROUND PING MEASUREMENT ====================

async function measureBestPing() {
  if (!navigator.onLine) return null;
  try {
    const storage = await chrome.storage.local.get('rota_settings');
    const settings = storage.rota_settings || {};
    const probes = settings.probes || {
      "Almanya (DE)": "https://s3.eu-central-1.amazonaws.com",
      "Hollanda (NL)": "https://s3.eu-west-1.amazonaws.com",
      "Fransa (FR)": "https://s3.eu-west-3.amazonaws.com",
      "Polonya (PL)": "https://s3.eu-north-1.amazonaws.com",
      "Romanya (RO)": "https://s3.eu-south-1.amazonaws.com"
    };
    const timeout = settings.timeoutMs || 3000;

    const results = [];

    for (const [region, url] of Object.entries(probes)) {
      try {
        // 3 örnek al, en iyisini seç
        const pings = [];
        for (let i = 0; i < 3; i++) {
          const start = performance.now();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          try {
            await fetch(url, {
              method: 'HEAD',
              mode: 'no-cors',
              cache: 'no-store',
              signal: controller.signal
            });
            const elapsed = Math.round(performance.now() - start);
            pings.push(elapsed);
          } catch {
            pings.push(999);
          } finally {
            clearTimeout(timeoutId);
          }

          // Örnekler arası kısa bekleme
          if (i < 2) await new Promise(r => setTimeout(r, 100));
        }

        // En düşük geçerli değeri al
        const validPings = pings.filter(p => p < 900);
        const bestPing = validPings.length > 0
          ? Math.min(...validPings)
          : 999;

        results.push({ region, ms: bestPing });
      } catch {
        results.push({ region, ms: 999 });
      }
    }

    // Sırala (en düşük ping önce)
    results.sort((a, b) => a.ms - b.ms);

    // En iyi bölgeyi belirle
    const bestRegion = results.length > 0 && results[0].ms < 900
      ? results[0].region
      : null;

    // Cache'e kaydet
    await chrome.storage.local.set({
      rota_ping_results: results,
      rota_best_region: bestRegion
    });

    console.log(`[SW] Ping measured: best=${bestRegion} (${results[0]?.ms}ms)`);

    return { success: true, results, best: bestRegion };

  } catch (err) {
    console.error('[SW] measureBestPing failed:', err);
    return { success: false, error: err.message };
  }
}

// ==================== PLAYTIME TRACKING ====================

async function checkPresenceAndTrack() {
  if (!navigator.onLine) return;
  try {
    // Roblox oyun sayfası açık olan sekmeleri bul
    const tabs = await chrome.tabs.query({ url: '*://*.roblox.com/games/*' });

    if (tabs.length === 0) return;

    const storage = await chrome.storage.local.get('rota_favorites');
    const favorites = storage.rota_favorites || [];

    if (favorites.length === 0) return;

    let updated = false;

    for (const tab of tabs) {
      // URL'den placeId çıkar
      const match = tab.url?.match(/games\/(\d+)\//);
      if (!match) continue;

      const placeId = match[1];

      // Favori listesinde mi?
      const favIndex = favorites.findIndex(f => String(f.placeId) === placeId);
      if (favIndex === -1) continue;

      // Sekme aktif ve audible (oyun sesi var) veya aktif sekmeyse playtime say
      // Her alarm çağrısı 1 dakika = 60 saniye
      favorites[favIndex].playtimeSeconds = (favorites[favIndex].playtimeSeconds || 0) + 60;
      updated = true;
    }

    if (updated) {
      await chrome.storage.local.set({ rota_favorites: favorites });
      console.log('[SW] Playtime updated for active games');
    }

  } catch (err) {
    console.error('[SW] checkPresenceAndTrack failed:', err);
  }
}

// ==================== UTILITY FUNCTIONS ====================

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ==================== STARTUP ====================

chrome.runtime.onStartup.addListener(() => {
  console.log('[SW] Tracked extension started');
  // Alarmlar zaten onInstalled'da oluşturuldu, burada tekrar oluşturmaya gerek yok
  // Sadece log seviyesinde bilgi veriyoruz
});

// ============================================================
// AUTO-RECONNECT / CRASH RECOVERY
// ============================================================
// Kullanıcı oyuna girince placeId+jobId saklanır.
// 30sn aralıkla presence polling: in-game'den offline geçişi → crash bildirimi.
// Notification button → roblox:// deep-link ile aynı server'a rejoin.

// Cached userId (her presence çağrısında yeniden fetch etmemek için)
let _cachedMyUserId = null;
let _cachedMyUserIdAt = 0;
async function getMyUserId() {
  // 1 saatlik cache
  if (_cachedMyUserId && (Date.now() - _cachedMyUserIdAt) < 3600000) {
    return _cachedMyUserId;
  }
  try {
    const res = await fetch('https://users.roblox.com/v1/users/authenticated', { credentials: 'include' });
    if (!res.ok) return null;
    const d = await res.json();
    _cachedMyUserId = d.id;
    _cachedMyUserIdAt = Date.now();
    return _cachedMyUserId;
  } catch (_) { return null; }
}

// Helper — join sonrası storage'a session kaydet
async function saveActiveSession(placeId, jobId, gameTitle) {
  if (!placeId) return;
  const myId = await getMyUserId();
  if (!myId) return; // Kullanıcı login değil — session açmaya gerek yok
  const session = {
    placeId: parseInt(placeId, 10),
    jobId: jobId || null,
    gameTitle: gameTitle || `Place ${placeId}`,
    joinedAt: Date.now(),
    lastSeenInGame: 0,
    sessionId: (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    myUserId: myId
  };
  await chrome.storage.local.set({ tracked_active_session: session });
  console.log('[SW] Active session saved:', { placeId: session.placeId, hasJobId: !!session.jobId });
}

// Periyodik monitor — alarm her 30sn tetiklenir.
// 2 mod: (a) session varsa crash detection, (b) session yoksa AUTO-DISCOVER (presence in-game ise yeni session aç).
async function monitorActiveSession() {
  // Settings: auto-reconnect kapalıysa hiç çalıştırma
  let settings = {};
  try {
    const sd = await chrome.storage.local.get('rota_settings');
    settings = sd.rota_settings || {};
  } catch (_) {}
  if (settings.autoReconnectEnabled === false) {
    // Açık değilse mevcut session da temizle (kullanıcı kapatmışsa stale data kalmasın)
    chrome.storage.local.remove('tracked_active_session').catch(() => {});
    return;
  }

  let session;
  try {
    const data = await chrome.storage.local.get('tracked_active_session');
    session = data.tracked_active_session;
  } catch (_) { return; }

  const myId = await getMyUserId();
  if (!myId) {
    console.log('[SW] monitorActiveSession: kullanıcı login değil, atlanıyor');
    return;
  }

  // Presence check (her durum için — auto-discover veya monitor)
  let presence;
  try {
    const res = await fetch('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [myId] })
    });
    if (!res.ok) {
      console.log('[SW] monitorActiveSession: presence API status', res.status);
      return;
    }
    const d = await res.json();
    presence = (d.userPresences || [])[0];
  } catch (e) {
    console.log('[SW] monitorActiveSession: presence fetch error', e.message);
    return;
  }
  if (!presence) return;

  const inGameNow = presence.userPresenceType === 2 && presence.placeId;

  // ─ AUTO-DISCOVER MODE: session yok ama kullanıcı in-game → session oluştur ─
  if (!session) {
    if (inGameNow) {
      const newSession = {
        placeId: parseInt(presence.placeId, 10),
        jobId: presence.gameId || null,
        gameTitle: presence.lastLocation || `Place ${presence.placeId}`,
        joinedAt: Date.now(),
        lastSeenInGame: Date.now(), // hemen aktif say (auto-discover halihazırda in-game tespit etti)
        sessionId: (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        myUserId: myId,
        autoDiscovered: true
      };
      await chrome.storage.local.set({ tracked_active_session: newSession });
      console.log('[SW] Auto-discovered active session:', { placeId: newSession.placeId, hasJobId: !!newSession.jobId, title: newSession.gameTitle });
    }
    return;
  }

  // ─ MONITOR MODE: session var ─
  const now = Date.now();
  const ageMs = now - (session.joinedAt || now);
  const inactiveMs = session.lastSeenInGame ? (now - session.lastSeenInGame) : 0;

  // Auto-discover'da placeId değişmiş olabilir (kullanıcı oyun değiştirdi) → session güncelle
  const matchesSession = inGameNow && String(presence.placeId) === String(session.placeId);
  const inDifferentGame = inGameNow && String(presence.placeId) !== String(session.placeId);

  if (matchesSession) {
    // Aktif in-game (aynı oyun): lastSeen + jobId güncelle
    session.lastSeenInGame = now;
    if (presence.gameId && presence.gameId !== session.jobId) {
      session.jobId = presence.gameId; // server değişti
    }
    await chrome.storage.local.set({ tracked_active_session: session });

    // Defensive fast re-check: SW kısa süre canlı kalır, 15sn sonra ek presence check.
    // Chrome alarm minimum 30sn olduğundan bu sayede ortalama tespit süresi yarıya iner.
    // SW ölürse timeout kaybolur — bir sonraki alarm zaten 30sn'de ateşler, veri kaybı yok.
    const lastFast = monitorActiveSession._lastFastCheck || 0;
    if (now - lastFast > 12 * 1000) {
      monitorActiveSession._lastFastCheck = now;
      setTimeout(() => {
        monitorActiveSession().catch(err => console.log('[SW] fast-recheck error:', err.message));
      }, 15 * 1000);
    }
    return;
  }

  if (inDifferentGame) {
    // Kullanıcı başka oyuna geçti → eski session'ı sıfırla, yenisini auto-discover
    console.log('[SW] User switched games, refreshing session');
    await chrome.storage.local.remove('tracked_active_session');
    return;
  }

  // Presence offline (oyun değil)
  if (session.lastSeenInGame === 0) {
    // Henüz hiç in-game algılanmadı → 5dk içinde girememişse session sil
    if (ageMs > 5 * 60 * 1000) await chrome.storage.local.remove('tracked_active_session');
    return;
  }

  // CRASH DETECTION: önceden in-game'di, şimdi değil
  // 15sn buffer (false-positive engelle, ama hızlı algıla)
  const sinceLastSeen = now - session.lastSeenInGame;
  if (sinceLastSeen < 15 * 1000) return;

  // Crash confirmed
  console.log('[SW] CRASH detected:', { placeId: session.placeId, sinceLastSeen: Math.round(sinceLastSeen / 1000) + 's' });

  // In-page overlay HER ZAMAN gönderilir (Roblox sayfası açıksa görünür)
  broadcastReconnectOverlay(session);

  // Native Chrome notification SADECE kullanıcı ayarlardan açtıysa
  if (settings.autoReconnectNative === true) {
    triggerCrashNotification(session);
  } else {
    console.log('[SW] Native notification disabled in settings — sadece in-page overlay');
  }

  await chrome.storage.local.remove('tracked_active_session');
}

// Tüm açık Roblox tab'larına in-page overlay broadcast et (custom themed modal)
async function broadcastReconnectOverlay(session) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.roblox.com/*' });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'showReconnectOverlay',
          session: session
        });
      } catch (_) { /* content script yüklü değil veya tab erişilemez, sessiz geç */ }
    }
    console.log(`[SW] Broadcast reconnect overlay to ${tabs.length} Roblox tabs`);
  } catch (e) {
    console.warn('[SW] broadcastReconnectOverlay error:', e);
  }
}

// Stale tracked_pending_* entry'lerini temizle (kullanıcı notification'ı ignore ettiyse 24h sonra sil)
async function cleanupStalePendingNotifications() {
  try {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    const TTL_MS = 24 * 60 * 60 * 1000; // 24 saat
    const stale = [];
    for (const key of Object.keys(all)) {
      if (!key.startsWith('tracked_pending_')) continue;
      const entry = all[key];
      const age = now - (entry?.joinedAt || 0);
      if (age > TTL_MS) stale.push(key);
    }
    if (stale.length > 0) {
      await chrome.storage.local.remove(stale);
      console.log(`[SW] Cleaned up ${stale.length} stale tracked_pending_* entries`);
    }
  } catch (e) {
    console.warn('[SW] cleanupStalePendingNotifications error:', e);
  }
}

function triggerCrashNotification(session) {
  const id = `tracked_reconnect_${session.sessionId}`;
  const buttons = session.jobId
    ? [{ title: 'Aynı Server\'a Dön' }, { title: 'Yeni Server' }]
    : [{ title: 'Yeniden Gir' }];

  console.log('[SW] Creating crash notification:', id, 'for', session.gameTitle);

  // Yeni notification yaratırken stale entry'leri de temizle (best-effort, await yok)
  cleanupStalePendingNotifications();

  try {
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🔄 Bağlantı Kesildi',
      message: `${session.gameTitle} oynamaktaydın. Geri dönmek ister misin?`,
      buttons,
      requireInteraction: true,
      priority: 2
    }, (createdId) => {
      if (chrome.runtime.lastError) {
        console.warn('[SW] Notification create failed:', chrome.runtime.lastError.message);
        console.warn('[SW] Chrome notification permission verilmemiş olabilir — sistem ayarlarından kontrol et');
        // Notification yaratamadıysak metadata kaydetme (orphan storage leak önle)
        return;
      }
      console.log('[SW] Notification created successfully:', createdId);
      // Metadata sadece notification başarıyla oluşturulduysa kaydedilsin → handler'lar temizleyebilir
      chrome.storage.local.set({ [`tracked_pending_${id}`]: session });
    });
  } catch (err) {
    console.error('[SW] triggerCrashNotification error:', err);
  }
}

// Reconnect URL üret + tab aç
function performReconnect(session, useJobId) {
  const url = (useJobId && session.jobId)
    ? `roblox://experiences/start?placeId=${session.placeId}&gameInstanceId=${encodeURIComponent(session.jobId)}`
    : `roblox://experiences/start?placeId=${session.placeId}`;
  try {
    chrome.tabs.create({ url, active: true });
  } catch (e) {
    console.error('[SW] Reconnect tab.create failed:', e);
  }
}

// Notification handlers — sadece kendi prefix'imizi işle, mevcut handler'lara karışma
chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
  if (!notifId.startsWith('tracked_reconnect_')) return;
  try {
    const data = await chrome.storage.local.get(`tracked_pending_${notifId}`);
    const session = data[`tracked_pending_${notifId}`];
    if (!session) return;
    // Button 0 = same server (jobId varsa), Button 1 = new server
    const useJobId = (btnIdx === 0 && !!session.jobId);
    performReconnect(session, useJobId);
    chrome.notifications.clear(notifId);
    chrome.storage.local.remove(`tracked_pending_${notifId}`);
  } catch (e) { console.error('[SW] reconnect button handler error:', e); }
});

chrome.notifications.onClicked.addListener(async (notifId) => {
  if (!notifId.startsWith('tracked_reconnect_')) return;
  try {
    const data = await chrome.storage.local.get(`tracked_pending_${notifId}`);
    const session = data[`tracked_pending_${notifId}`];
    if (!session) return;
    // Body click = button 0 (rejoin same)
    performReconnect(session, !!session.jobId);
    chrome.notifications.clear(notifId);
    chrome.storage.local.remove(`tracked_pending_${notifId}`);
  } catch (e) { console.error('[SW] reconnect body click handler error:', e); }
});

chrome.notifications.onClosed.addListener((notifId) => {
  if (notifId.startsWith('tracked_reconnect_')) {
    chrome.storage.local.remove(`tracked_pending_${notifId}`);
  }
});

