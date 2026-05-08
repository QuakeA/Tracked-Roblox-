// instance_trigger.js - Blok Bazlı Yeni Server Tetikleyici v2
//
// 3 strateji — hangisi çalışırsa o kullanılır:
//   A) Sosyal Grafik  : Arkadaşlar + takipçiler + takip edilenler → presence filtresi → engelle
//   B) Grup Üyeleri   : Oyunun yaratıcı grubundan binlerce üye → presence filtresi → engelle
//   C) Adaptive Sniper: Mevcut boş server ara (fallback)
//
// Engel kaldırma:
//   Oyuna girdiğin ANI presence API ile tespit edip anında kaldırılır.
//   Popup kapansa bile chrome.storage'a yazılır, service worker devam eder.

const TrackedInstanceTrigger = (() => {

  const BASE = 'https://';
  const EP = {
    serversApi:  (pid, sort, lim) => `${BASE}games.roblox.com/v1/games/${pid}/servers/Public?sortOrder=${sort}&limit=${lim}`,
    thumbBatch:  `${BASE}thumbnails.roblox.com/v1/batch`,
    block:       (uid) => `${BASE}accountinformation.roblox.com/v1/users/${uid}/block`,
    unblock:     (uid) => `${BASE}accountinformation.roblox.com/v1/users/${uid}/unblock`,
    csrfProbe:   `${BASE}auth.roblox.com/v2/logout`,
    whoAmI:      `${BASE}users.roblox.com/v1/users/authenticated`,
    presence:    `${BASE}presence.roblox.com/v1/presence/users`,
    friends:     (uid) => `${BASE}friends.roblox.com/v1/users/${uid}/friends?limit=200`,
    followers:   (uid, cur) => `${BASE}friends.roblox.com/v1/users/${uid}/followers?limit=100${cur ? `&cursor=${encodeURIComponent(cur)}` : ''}`,
    followings:  (uid, cur) => `${BASE}friends.roblox.com/v1/users/${uid}/followings?limit=100${cur ? `&cursor=${encodeURIComponent(cur)}` : ''}`,
    universe:    (pid) => `${BASE}apis.roblox.com/universes/v1/places/${pid}/universe`,
    gameInfo:    (uid) => `${BASE}games.roblox.com/v1/games?universeIds=${uid}`,
    groupMembers:(gid, cur) => `${BASE}groups.roblox.com/v1/groups/${gid}/users?limit=100&sortOrder=Asc${cur ? `&cursor=${encodeURIComponent(cur)}` : ''}`,
    deepLink:    (pid) => `roblox://experiences/start?placeId=${pid}`,
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ── CSRF ─────────────────────────────────────────────────────
  async function getCsrf() {
    const res = await fetch(EP.csrfProbe, { method: 'POST', credentials: 'include' });
    const token = res.headers.get('X-CSRF-Token');
    if (!token) throw new Error('Roblox oturumu bulunamadı. Tarayıcında roblox.com\'a giriş yap.');
    return token;
  }

  // ── Kendi userId ─────────────────────────────────────────────
  async function getMyId() {
    const res = await fetch(EP.whoAmI, { credentials: 'include' });
    if (!res.ok) throw new Error('Kullanıcı bilgisi alınamadı.');
    const d = await res.json();
    return d.id;
  }

  // ── SW mesaj yardımcısı ───────────────────────────────────────
  function swMsg(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (res) => resolve(res || {}));
    });
  }

  // ── Universe ID + Yaratıcı Grup (SW üzerinden — CORS bypass) ─
  async function getGameInfo(placeId) {
    return swMsg({ action: 'swGetGameInfo', placeId });
  }

  // ── DOM'dan community/group ID scrape (fallback) ─────────────
  // Roblox communities (eski groups) sayfada link olarak görünür
  function getCommunityIdFromDOM() {
    try {
      const links = document.querySelectorAll('a[href*="/communities/"], a[href*="/groups/"]');
      for (const link of links) {
        const m = (link.getAttribute('href') || '').match(/\/(?:communities|groups)\/(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
      // Alternatif: data attribute / metadata
      const metaLinks = document.querySelectorAll('[data-community-id], [data-group-id]');
      for (const el of metaLinks) {
        const id = el.dataset.communityId || el.dataset.groupId;
        if (id && /^\d+$/.test(id)) return parseInt(id, 10);
      }
    } catch (_) {}
    return null;
  }

  // ── Akıllı game info: API + DOM fallback ─────────────────────
  async function getGameInfoSmart(placeId) {
    const info = await getGameInfo(placeId);
    if (info.groupId) return info;
    // API'den groupId gelmezse (creator User olabilir) DOM'dan dene
    const domId = getCommunityIdFromDOM();
    if (domId) {
      console.log(`[Trigger] Community ID DOM'dan alındı: ${domId} (creator: ${info.creatorType})`);
      return { ...info, groupId: domId };
    }
    return info;
  }

  // ── Presence filtresi: hangi userId'ler bu oyunda? ───────────
  async function filterInGame(userIds, placeId) {
    const result = new Set();
    // Presence API max 200/istek
    for (let i = 0; i < userIds.length; i += 200) {
      const batch = userIds.slice(i, i + 200);
      try {
        const res = await fetch(EP.presence, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userIds: batch })
        });
        if (!res.ok) { await sleep(1000); continue; }
        const d = await res.json();
        for (const p of (d.userPresences || [])) {
          // userPresenceType 2 = InGame, placeId eşleşmeli
          if (p.userPresenceType === 2 && String(p.placeId) === String(placeId)) {
            result.add(p.userId);
          }
        }
      } catch (_) {}
      await sleep(400);
    }
    return [...result];
  }

  // ═══════════════════════════════════════════════════════════
  // ACTIVITY-AWARE FILTERING (C+D 2.0)
  // /v1/presence/users TEK çağrı ile hem in-game hem lastOnline döndürür.
  // → inGame: şu an oyunda (presence type 2 + placeId match) — kesin hedef
  // → recentlyActive: son N saatte online — fingerprint havuzu için yüksek olasılık
  // → offline: pas geç, fingerprint kaynağı israfı
  // ═══════════════════════════════════════════════════════════
  async function filterByActivity(userIds, placeId, hoursWindow = 24, onProgress = null) {
    const cutoff = Date.now() - hoursWindow * 3_600_000;
    const inGame = [];
    const recentlyActive = []; // [{ userId, lastOnlineMs }] — recency-sorted için
    let firstBatchLogged = false;

    let processed = 0;
    for (let i = 0; i < userIds.length; i += 200) {
      const batch = userIds.slice(i, i + 200);
      try {
        const res = await fetch(EP.presence, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userIds: batch })
        });
        if (!res.ok) { await sleep(1500); continue; }
        const d = await res.json();

        // Diagnostic: ilk batch response shape'ini dök → lastOnline field var mı?
        if (!firstBatchLogged && d.userPresences && d.userPresences.length > 0) {
          const sample = d.userPresences[0];
          console.log('[Trigger] Presence response shape:', {
            fields: Object.keys(sample),
            hasLastOnline: 'lastOnline' in sample,
            sampleLastOnline: sample.lastOnline,
            userPresenceType: sample.userPresenceType,
            fullSample: sample
          });
          firstBatchLogged = true;
        }

        for (const p of (d.userPresences || [])) {
          if (!p.userId) continue;
          // 1) Şu an bu oyunda mı?
          if (p.userPresenceType === 2 && String(p.placeId) === String(placeId)) {
            inGame.push(p.userId);
            continue;
          }
          // 2) Son aktiflik kontrolü — multiple field name variants
          // Roblox bazen `lastOnline`, bazen `lastLocation` (string), bazen başka bir şey döndürüyor
          let lastOnlineRaw = p.lastOnline || p.lastOnlineDateTime || p.LastOnline;
          if (lastOnlineRaw) {
            const ts = new Date(lastOnlineRaw).getTime();
            if (!isNaN(ts) && ts >= cutoff) {
              recentlyActive.push({ userId: p.userId, lastOnlineMs: ts });
            }
          } else {
            // Fallback: userPresenceType 1 (Online) veya 2 (InGame) → şu an aktif sayar
            if (p.userPresenceType === 1 || p.userPresenceType === 2) {
              recentlyActive.push({ userId: p.userId, lastOnlineMs: Date.now() });
            }
          }
        }
      } catch (_) {}
      processed += batch.length;
      if (onProgress) onProgress({ phase: 'activity_filter_progress', processed, total: userIds.length, inGame: inGame.length, active: recentlyActive.length });
      await sleep(400);
    }

    // Recency-weighted: en son aktif olanlar başta
    recentlyActive.sort((a, b) => b.lastOnlineMs - a.lastOnlineMs);

    return {
      inGame,
      recentlyActive: recentlyActive.map(x => x.userId), // sadece userIds
      recentlyActiveDetailed: recentlyActive
    };
  }

  // Multi-pass presence: 4 ayrı zamanda tara → server hopping yapan oyuncuları + sonradan giren'leri yakala.
  // Düşük community engagement'lı oyunlarda presence count'u 2-3x'e çıkarabilir.
  async function filterInGameMultiPass(userIds, placeId, passes = 4, onProgress = null) {
    const all = new Set();
    for (let pass = 0; pass < passes; pass++) {
      const found = await filterInGame(userIds, placeId);
      found.forEach(id => all.add(id));
      if (onProgress) onProgress({ phase: 'presence_pass', pass: pass + 1, totalPasses: passes, inGame: all.size });
      if (pass < passes - 1) await sleep(8000); // 8sn bekle — bu sürede çoğu transient join olur
    }
    return [...all];
  }

  // ═══════════════════════════════════════════════════════════
  // EXCLUSION LIST — ASLA blocklanmayacak kişiler
  // (Arkadaşlar + Takipçiler + Takip Edilenler)
  // ═══════════════════════════════════════════════════════════
  async function buildExclusionList(myId, onProgress) {
    const ids = new Set();
    ids.add(myId); // kendini de hariç tut

    // Arkadaşlar — KESİN ASLA blocklanmaz
    try {
      const res = await fetch(EP.friends(myId), { credentials: 'include' });
      if (res.ok) { const d = await res.json(); (d.data || []).forEach(u => ids.add(u.id)); }
    } catch (_) {}

    // Takipçiler — koru
    let cur = null;
    for (let p = 0; p < 10; p++) {
      try {
        const res = await fetch(EP.followers(myId, cur), { credentials: 'include' });
        if (!res.ok) break;
        const d = await res.json();
        (d.data || []).forEach(u => ids.add(u.id));
        cur = d.nextPageCursor;
        if (!cur) break;
        await sleep(500);
      } catch (_) { break; }
    }

    // Takip edilenler — koru
    cur = null;
    for (let p = 0; p < 10; p++) {
      try {
        const res = await fetch(EP.followings(myId, cur), { credentials: 'include' });
        if (!res.ok) break;
        const d = await res.json();
        (d.data || []).forEach(u => ids.add(u.id));
        cur = d.nextPageCursor;
        if (!cur) break;
        await sleep(500);
      } catch (_) { break; }
    }

    if (onProgress) onProgress({ phase: 'exclusion_built', protected: ids.size });
    return ids;
  }

  // ═══════════════════════════════════════════════════════════
  // Grup Üyeleri — verilen groupId ile (oyunun community'sinden)
  // ═══════════════════════════════════════════════════════════
  async function harvestGroupMembersById(groupId, onProgress) {
    if (!groupId) return [];

    const ids = new Set();
    let cursor = null;
    const MAX_PAGES = 50; // max 5000 üye (presence isabet oranı %0.5 → daha çok aday gerekli)

    for (let p = 0; p < MAX_PAGES; p++) {
      try {
        const res = await fetch(EP.groupMembers(groupId, cursor), { credentials: 'omit' });
        if (res.status === 429) { await sleep(10000); p--; continue; }
        if (!res.ok) break;
        const d = await res.json();
        (d.data || []).forEach(m => { if (m.user?.userId) ids.add(m.user.userId); });
        cursor = d.nextPageCursor;
        if (onProgress) onProgress({ strategy: 'group', groupId, collected: ids.size, page: p + 1 });
        if (!cursor) break;
        await sleep(600); // rate-limit dostu
      } catch (_) { break; }
    }

    return [...ids];
  }

  // ═══════════════════════════════════════════════════════════
  // FRIENDS-OF-IN-GAME EXPANSION
  // Düşük community engagement'lı oyunlarda en kritik düzeltme:
  // 3 in-game kullanıcı yetersiz → onların friend list'lerini çek → presence check.
  // İnsanlar arkadaşlarıyla aynı oyunda olur → 3 → 15-25 in-game user'a genişletir.
  // ═══════════════════════════════════════════════════════════
  async function expandViaFriends(seedInGameIds, placeId, protectedIds, onProgress) {
    if (!seedInGameIds || seedInGameIds.length === 0) return [];

    const friendsPool = new Set();
    const MAX_SEEDS = 10; // max 10 seed user, fazlası rate-limit yer
    const seeds = seedInGameIds.slice(0, MAX_SEEDS);

    if (onProgress) onProgress({ phase: 'friends_expansion_start', seedCount: seeds.length });

    for (let i = 0; i < seeds.length; i++) {
      const uid = seeds[i];
      try {
        // friends.roblox.com authenticated istek gerektirmez (public friend list)
        const res = await fetch(`https://friends.roblox.com/v1/users/${uid}/friends?limit=200`, {
          credentials: 'omit'
        });
        if (res.status === 429) { await sleep(3000); continue; }
        if (!res.ok) continue;
        const d = await res.json();
        (d.data || []).forEach(u => {
          if (u?.id && !protectedIds.has(u.id)) friendsPool.add(u.id);
        });
        if (onProgress) onProgress({ phase: 'friends_seed_done', seed: i + 1, total: seeds.length, pool: friendsPool.size });
      } catch (_) {}
      await sleep(400);
    }

    if (friendsPool.size === 0) {
      if (onProgress) onProgress({ phase: 'friends_expansion_empty' });
      return [];
    }

    // Cap to 500 — presence API max 200/req, 2-3 batch yeter
    const friendsArr = [...friendsPool].slice(0, 500);
    if (onProgress) onProgress({ phase: 'friends_presence_check', count: friendsArr.length });

    const inGameFriends = await filterInGame(friendsArr, placeId);
    if (onProgress) onProgress({ phase: 'friends_expansion_done', friendsChecked: friendsArr.length, friendsInGame: inGameFriends.length });

    // Final safety: protection list filter
    return inGameFriends.filter(id => !protectedIds.has(id));
  }

  // ═══════════════════════════════════════════════════════════
  // KİTLESEL ENGEL
  // ═══════════════════════════════════════════════════════════
  async function blockUsers(userIds, myId, csrf, onProgress, protectedIds, targetCount = 50) {
    const blocked = [];
    const statusCount = {};
    // SLOW START: 600 → 1500ms. Hızlı burst Roblox'un anti-spam tespitini tetikliyor.
    // Yavaş başlayıp başarı serisinde hızlandırma → daha çok başarılı block.
    let baseDelay = 1500;
    let consecutive429 = 0;
    let consecutiveAuthFail = 0;
    let consecutive200 = 0;
    const MAX_BLOCKS = Math.max(10, Math.min(300, targetCount));
    const MAX_ATTEMPTS = Math.round(MAX_BLOCKS * 2.4);
    const MAX_DURATION_MS = 180_000; // 150 → 180sn (3dk) — daha çok fırsat
    const MAX_429_FATIGUE = 15;      // 10 → 15 — daha sabırlı (cooldown öncesi)
    const MAX_COOLDOWNS = 3;         // 2 → 3 — bir cooldown daha
    const COOLDOWN_MS = 20_000;
    let cooldownsUsed = 0;
    const startTime = Date.now();

    // Güvenlik: protected set yoksa boş Set oluştur (yine de myId'yi koru)
    const protect = protectedIds instanceof Set ? protectedIds : new Set();
    protect.add(myId);

    let attempts = 0;
    let skippedProtected = 0;
    let exitReason = 'completed';
    for (let i = 0; i < userIds.length && blocked.length < MAX_BLOCKS && attempts < MAX_ATTEMPTS; i++) {
      // Time budget: 150sn'i geçtiysek mevcut block sayısıyla yetin
      if (Date.now() - startTime > MAX_DURATION_MS) {
        exitReason = `time_cap (${Math.round((Date.now() - startTime)/1000)}s)`;
        break;
      }
      // 429 fatigue: rate limit dalgası → uzun cooldown, sonra resume
      // Roblox'un burst limit'i yenilensin diye 20sn dinleniyoruz; max 2 kez bunu yapıyoruz.
      if (consecutive429 >= MAX_429_FATIGUE) {
        if (cooldownsUsed >= MAX_COOLDOWNS) {
          exitReason = `429_fatigue_max_cooldowns (${cooldownsUsed} cooldowns used, ${consecutive429} consecutive 429)`;
          break;
        }
        cooldownsUsed++;
        console.warn(`[Trigger] 429 fatigue → ${COOLDOWN_MS/1000}sn cooldown #${cooldownsUsed}/${MAX_COOLDOWNS}, sonra devam...`);
        if (onProgress) onProgress({ phase: 'block_cooldown', cooldown: cooldownsUsed, max: MAX_COOLDOWNS, blocked: blocked.length });
        await sleep(COOLDOWN_MS);
        consecutive429 = 0;     // sayacı sıfırla
        baseDelay = 1500;        // delay'i resetle (yumuşak başlangıç)
        i--;                     // bu kullanıcıyı atlamayalım
        continue;
      }

      const uid = userIds[i];
      // ⚠️ KRİTİK GÜVENLİK: arkadaş/takipçi/takip → SKIP
      if (protect.has(uid)) {
        skippedProtected++;
        continue;
      }
      if (uid === myId) continue;
      attempts++;
      if (onProgress) onProgress({ phase: 'block', done: i, total: userIds.length, uid, blocked: blocked.length });

      try {
        const result = await swMsg({ action: 'swBlockUser', userId: uid, csrf });
        if (result.csrf) csrf = result.csrf;

        const st = result.status || 'err';
        statusCount[st] = (statusCount[st] || 0) + 1;

        if (result.ok) {
          blocked.push(uid);
          consecutive429 = 0;
          consecutiveAuthFail = 0;
          consecutive200++;
          // ardışık başarı → delay düşür (AIMD)
          // 5+ ardışık başarı sonrası kademeli hızlanma (3 → 5: daha sabırlı slow-start)
          if (consecutive200 >= 5) {
            baseDelay = Math.max(700, baseDelay - 100);
          }
        } else if (st === 429) {
          consecutive200 = 0;
          consecutive429++;
          // Retry-After'a uy + jitter (cap'lı — 5sn'den fazla bekleme yok artık fatigue var)
          const retryMs = (result.retryAfter > 0 ? Math.min(result.retryAfter * 1000, 5000) : 0) || (2000 + consecutive429 * 800);
          const wait = retryMs + Math.floor(Math.random() * 500);
          console.warn(`[Trigger] 429 rate limit. Waiting ${wait}ms (consecutive: ${consecutive429})`);
          baseDelay = Math.min(3000, baseDelay + 300);
          await sleep(wait);
          // İlk 2 ardışıkta retry, sonrası direkt geç
          if (consecutive429 < 2) i--;
          continue;
        } else if (st === 401 || st === 403) {
          consecutiveAuthFail++;
          if (consecutiveAuthFail <= 3) {
            console.warn(`[Trigger] Auth fail uid=${uid} status=${st}`);
          }
          if (consecutiveAuthFail >= 5) {
            console.error('[Trigger] 5 ardışık auth fail. Roblox oturumu sorunlu olabilir.');
            break;
          }
        } else {
          // 400 (zaten engelli), 404, vs.
          if (Object.keys(statusCount).length <= 2) {
            console.warn(`[Trigger] Block fail uid=${uid} status=${st}`);
          }
        }
      } catch (e) {}

      await sleep(baseDelay + Math.floor(Math.random() * 200));
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Trigger] Block exit: ${exitReason} | blocked=${blocked.length} attempts=${attempts} elapsed=${elapsed}s | status:`, statusCount, 'protected_skipped:', skippedProtected);
    return { blocked, csrf };
  }

  // ═══════════════════════════════════════════════════════════
  // ENGEL KALDIRMA — Presence tabanlı (oyuna girince anında)
  // ═══════════════════════════════════════════════════════════
  async function unblockAfterJoin(myId, placeId, blockedIds, csrf, onProgress) {
    // Blocked ID'leri storage'a yaz (popup kapansa bile)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({
        trigger_pending_unblock: { ids: blockedIds, placeId, csrf }
      });
    }

    const POLL_INTERVAL = 4000;
    const MAX_WAIT_MS   = 180_000; // 3 dakika max bekle
    const started       = Date.now();

    if (onProgress) onProgress({ phase: 'waiting_join' });

    while (Date.now() - started < MAX_WAIT_MS) {
      await sleep(POLL_INTERVAL);
      try {
        const res = await fetch(EP.presence, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userIds: [myId] })
        });
        if (!res.ok) continue;
        const d = await res.json();
        const me = (d.userPresences || [])[0];
        // InGame (type 2) + doğru placeId → oyuna girdi
        if (me?.userPresenceType === 2 && String(me.placeId) === String(placeId)) {
          break; // Oyuna girdi, engelleri kaldır
        }
      } catch (_) {}
    }

    // Engelleri kaldır
    if (onProgress) onProgress({ phase: 'unblock', total: blockedIds.length });
    for (let i = 0; i < blockedIds.length; i++) {
      try {
        await swMsg({ action: 'swUnblockUser', userId: blockedIds[i], csrf });
      } catch (_) {}
      await sleep(150);
    }

    // Storage temizle
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.remove('trigger_pending_unblock');
    }
    if (onProgress) onProgress({ phase: 'unblock_done', total: blockedIds.length });
  }

  // ═══════════════════════════════════════════════════════════
  // JOIN (jobId'siz → Roblox yeni server açmak zorunda)
  // ═══════════════════════════════════════════════════════════
  async function forceJoin(placeId) {
    // Auto-Reconnect: jobId'siz session kaydet (rejoin'de yine yeni server)
    try { swMsg({ action: 'saveActiveSession', placeId, jobId: null, gameTitle: document?.title || null }); } catch (_) {}

    const url = EP.deepLink(placeId);
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && /roblox\.com/.test(tab.url || '')) {
          await chrome.tabs.update(tab.id, { url }); return;
        }
      } catch (_) {}
      await chrome.tabs.create({ url, active: true }); return;
    }
    const a = document.createElement('a');
    a.href = url; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ═══════════════════════════════════════════════════════════
  // ANA FONKSİYON
  // opts.onProgress(obj): ilerleme callback
  // GÜVENLİK: Arkadaşlar/takipçiler/takip edilenler ASLA blocklanmaz
  // ═══════════════════════════════════════════════════════════
  async function run(placeId, opts = {}) {
    const log = opts.onProgress || (() => {});
    const blockTarget = opts.blockTarget ?? 50;
    const skipJoin = opts.skipJoin === true;
    const postBlockWaitMs = opts.postBlockWaitMs ?? 500;

    // Hazırlık
    log({ phase: 'csrf' });
    let csrf = await getCsrf();
    const myId = await getMyId();

    // Kalan bekleyen engel kaldırmayı kontrol et (önceki yarım kalan)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const s = await chrome.storage.local.get('trigger_pending_unblock');
      if (s.trigger_pending_unblock?.ids?.length) {
        log({ phase: 'cleanup_previous', count: s.trigger_pending_unblock.ids.length });
        for (const uid of s.trigger_pending_unblock.ids) {
          try {
            await swMsg({ action: 'swUnblockUser', userId: uid, csrf });
          } catch (_) {}
          await sleep(150);
        }
        await chrome.storage.local.remove('trigger_pending_unblock');
      }
    }

    // ── Oyun bilgisi al (community/group + aktif oyuncu sayısı) ──
    log({ phase: 'game_info' });
    const gameInfo = await getGameInfoSmart(placeId);
    console.log(`[Trigger] Game info: groupId=${gameInfo.groupId}, playing=${gameInfo.playing}, creatorType=${gameInfo.creatorType}`);

    // ⚠️ GÜVENLİK: Mega oyunlarda block-flood matematik olarak işe yaramaz
    // (10K+ oyuncu, yüzlerce server → 200 block kapsamaz). Realistik tavan: 5K.
    // Drift 36 (~1K), JJSploit oyunları gibi popüler ama mega olmayanları kapsar.
    const PLAYER_LIMIT = opts.playerLimit ?? 5000;
    if (gameInfo.playing > PLAYER_LIMIT) {
      throw new Error(`Bu oyunda ${gameInfo.playing.toLocaleString()} aktif oyuncu var. Block-flood ${PLAYER_LIMIT.toLocaleString()} kişi altındaki oyunlarda etkili çalışır (yüzlerce server'a yetişemez).`);
    }

    if (!gameInfo.groupId) {
      throw new Error('Bu oyuna bağlı topluluk (community) bulunamadı. Topluluk sahipli oyunlarda çalışır.');
    }

    // ── EXCLUSION LIST: Arkadaşlar/takipçiler/takip edilenler — ASLA blocklanmaz ──
    log({ phase: 'building_safelist' });
    const protectedIds = await buildExclusionList(myId, log);
    console.log(`[Trigger] 🛡️ ${protectedIds.size} kişi koruma altında (arkadaş/takipçi/takip edilen) — ASLA blocklanmayacak`);

    // ── Aday havuzu: SADECE grup/community üyeleri ──
    log({ phase: 'harvest', strategy: 'group', groupId: gameInfo.groupId });
    const groupIds = await harvestGroupMembersById(gameInfo.groupId, log);
    log({ phase: 'harvest_done', strategy: 'group', count: groupIds.length });

    if (groupIds.length === 0) {
      throw new Error(`Community üyesi alınamadı (groupId: ${gameInfo.groupId}). API engellemiş olabilir.`);
    }

    // KRİTİK FILTER: koruma altındaki kişileri ÇIKAR
    let candidateIds = groupIds.filter(id => !protectedIds.has(id));
    const removedCount = groupIds.length - candidateIds.length;
    if (removedCount > 0) {
      console.log(`[Trigger] 🛡️ ${removedCount} sosyal bağlantı aday havuzundan çıkarıldı`);
    }

    if (candidateIds.length === 0) {
      throw new Error('Tüm grup üyeleri koruma listesinde. Block için aday yok.');
    }

    // ── Şu an bu oyunda olanları filtrele (multi-pass: 4 pass × 8sn → 32sn boyunca tarama) ──
    // Düşük community engagement'lı oyunlarda kritik: 2 pass'da 3 kişi bulurken 4 pass'da 6-9 kişi yakalayabiliriz.
    log({ phase: 'presence_filter', candidates: candidateIds.length });
    let inGameIds = await filterInGameMultiPass(candidateIds, placeId, 4, log);
    log({ phase: 'presence_done', inGame: inGameIds.length });

    // ── FRIENDS-OF-IN-GAME EXPANSION ──
    // Eğer in-game count düşükse (community engagement zayıf), bulduğumuz oyuncuların
    // arkadaşlarını çek ve presence-check et. İnsanlar arkadaşlarıyla aynı oyunda olur.
    // 3 in-game → typically 8-15'e çıkar; popüler oyunlarda 30+'a kadar.
    if (inGameIds.length > 0 && inGameIds.length < 30) {
      const expandedIds = await expandViaFriends(inGameIds, placeId, protectedIds, log);
      if (expandedIds.length > 0) {
        const beforeCount = inGameIds.length;
        const inGameSet = new Set(inGameIds);
        expandedIds.forEach(id => inGameSet.add(id));
        inGameIds = [...inGameSet];
        log({ phase: 'expansion_merged', before: beforeCount, added: inGameIds.length - beforeCount, total: inGameIds.length });
      }
    }

    // Çift kontrol: presence sonrası da exclusion uygula (paranoid safety)
    const safeInGame = inGameIds.filter(id => !protectedIds.has(id));
    const safeCandidates = candidateIds.filter(id => !protectedIds.has(id));

    // ⚡ ÖNCELİK SIRASI: in-game oyuncular ÖNCE, sonra random üyeler
    // In-game block 100x daha değerli (gerçekten o anki server'ları etkiler)
    const inGameSet = new Set(safeInGame);
    const otherCandidates = safeCandidates.filter(id => !inGameSet.has(id));
    // Karıştır → farklı server'lara dağılma şansı arttır
    for (let i = otherCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherCandidates[i], otherCandidates[j]] = [otherCandidates[j], otherCandidates[i]];
    }
    const toBlock = [...safeInGame, ...otherCandidates.slice(0, 200)];
    console.log(`[Trigger] 🎯 Block sırası: ${safeInGame.length} in-game (öncelikli) + ${Math.min(otherCandidates.length, 200)} random üye`);

    // ── Kitlesel engel ────────────────────────────────────
    log({ phase: 'block', total: toBlock.length });
    const { blocked, csrf: newCsrf } = await blockUsers(toBlock, myId, csrf, log, protectedIds, blockTarget);
    csrf = newCsrf;
    log({ phase: 'block_done', blocked: blocked.length });

    if (blocked.length < 5) {
      throw new Error(`Yalnızca ${blocked.length} kişi engellenebildi. Yeterli değil.`);
    }

    // skipJoin: caller (örn. runCombo) join'i kendi yapar; biz sadece block listini döneriz.
    // Caller daha sonra unblockAfterJoin'i schedule etmek zorundadır.
    if (skipJoin) {
      log({ phase: 'block_only_done', blocked: blocked.length });
      return { success: true, blocked, csrf, myId, skipJoin: true };
    }

    // ── Oyuna gir ─────────────────────────────────────────
    log({ phase: 'join' });
    await sleep(postBlockWaitMs); // Engellerin Roblox'a yayılması için bekleme
    await forceJoin(placeId);

    // ── Presence ile oyuna girişi bekle → engelleri kaldır ─
    // Bu kısım arka planda çalışır, await etmiyoruz (popup kapansa bile devam eder)
    unblockAfterJoin(myId, placeId, blocked, csrf, log).catch(e => {
      console.error('[Trigger] Unblock hatası:', e);
    });

    return { success: true, blocked: blocked.length };
  }

  // ═══════════════════════════════════════════════════════════
  // Manuel engel kaldırma (acil buton için)
  // ═══════════════════════════════════════════════════════════
  async function emergencyUnblock() {
    if (typeof chrome === 'undefined' || !chrome.storage) return 0;
    const s = await chrome.storage.local.get('trigger_pending_unblock');
    const data = s.trigger_pending_unblock;
    if (!data?.ids?.length) return 0;

    let csrf;
    try { csrf = await getCsrf(); } catch (_) { return 0; }

    for (const uid of data.ids) {
      try {
        await swMsg({ action: 'swUnblockUser', userId: uid, csrf });
      } catch (_) {}
      await sleep(150);
    }
    await chrome.storage.local.remove('trigger_pending_unblock');
    return data.ids.length;
  }

  // ═══════════════════════════════════════════════════════════
  // A+B KOMBO — 3 Fazlı Yeni Server Yakalama
  // Faz 1: Quick Snipe (5sn) — eğer şanslıysak hazır boş server bul
  // Faz 2: Block-Flood   — community block ile matchmaker'ı zorla (gerçek mekanizma)
  // Faz 3: Post-Block Snipe (10sn) — block sonrası açılan yeni server'ı yakala
  // ═══════════════════════════════════════════════════════════

  // ── Paralel Asc+Desc poll snipe ─────────────────────────────
  // En düşük oyunculu server'ı arar; başarısızlığa düşmeden hızlıca tarar.
  // baselineIds verilirse: yalnızca yeni gelen server'ları (bu set'te olmayan) hedefler.
  // Geri dönüş: { jobId, playing, seenIds } veya { seenIds } (bulamazsa).
  // seenIds = bu çağrıda görülen tüm server ID'leri (Phase 3 baseline olarak kullanılabilir).
  async function quickSnipe(placeId, onProgress, durationMs, baselineIds = null) {
    const started = Date.now();
    const seen = new Set(baselineIds || []);
    const observed = new Set(); // bu çağrıda gördüğümüz tüm ID'ler (return için)
    let polls = 0;
    let bestSeen = null;
    let consecutive429 = 0;

    const fetchPage = async (sort) => {
      try {
        const res = await fetch(
          `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=${sort}&limit=100`,
          { credentials: 'omit' }
        );
        if (res.status === 429) return { rateLimited: true };
        if (!res.ok) return { ok: false };
        const d = await res.json();
        return { ok: true, servers: d.data || [] };
      } catch (_) { return { ok: false }; }
    };

    while (Date.now() - started < durationMs) {
      polls++;
      const [asc, desc] = await Promise.all([
        fetchPage('Asc'),
        sleep(250).then(() => fetchPage('Desc'))
      ]);

      const all = [];
      if (asc.ok) all.push(...asc.servers);
      if (desc.ok) all.push(...desc.servers);

      // Tüm görülen ID'leri kaydet (baseline için)
      all.forEach(s => s?.id && observed.add(s.id));

      for (const srv of all) {
        if (!srv?.id || typeof srv.playing !== 'number') continue;
        if (seen.has(srv.id)) continue;
        if (srv.playing <= 1 && srv.maxPlayers > 0) {
          onProgress?.({ phase: 'snipe_found', jobId: srv.id, playing: srv.playing, polls });
          return { jobId: srv.id, playing: srv.playing, seenIds: observed };
        }
        if (!bestSeen || srv.playing < bestSeen.playing) {
          if (srv.playing <= 3) bestSeen = { jobId: srv.id, playing: srv.playing };
        }
      }

      onProgress?.({ phase: 'snipe_poll', polls, found: all.length });

      // 429 backoff: art arda gelen rate-limit'lerde delay'i artır
      if (asc.rateLimited || desc.rateLimited) {
        consecutive429++;
        await sleep(3500 + consecutive429 * 1500);
      } else {
        consecutive429 = 0;
        await sleep(900); // 600 → 900 (rate limit dostu)
      }
    }

    if (bestSeen) {
      onProgress?.({ phase: 'snipe_best', jobId: bestSeen.jobId, playing: bestSeen.playing });
      return { ...bestSeen, seenIds: observed };
    }
    return { seenIds: observed };
  }

  // ═══════════════════════════════════════════════════════════
  // PASSIVE OBSERVER SNIPE (C+D 2.0)
  // Agresif poll yerine sabırlı izleme. Önce baseline al, sonra 3-4sn'lik döngülerde
  // YENİ servers'ları izle. Yeni açılan boş server = matchmaker'ın az önce yarattığı.
  // 429 yiyici poll'lere kıyasla 5x daha az API çağrısı.
  // ═══════════════════════════════════════════════════════════
  async function passiveObserverSnipe(placeId, onProgress, durationMs = 25000) {
    const started = Date.now();
    const seen = new Set();         // tüm görülen server ID'leri (baseline + sonraki)
    const candidates = new Map();   // jobId → { server, firstSeenAt }
    let polls = 0;

    // İlk baseline poll — mevcut tüm server'ları kaydet (bunlar "eski")
    for (const sort of ['Asc', 'Desc']) {
      const r = await swMsg({ action: 'swMainWorldFetchServers', placeId, sort });
      if (r?.ok && r.data?.data) {
        r.data.data.forEach(s => s?.id && seen.add(s.id));
      }
      await sleep(300);
    }
    if (onProgress) onProgress({ phase: 'observer_baseline', count: seen.size });

    // İzleme döngüsü
    while (Date.now() - started < durationMs) {
      polls++;
      await sleep(3500); // 3.5sn — rate-limit dostu

      let newThisCycle = 0;
      for (const sort of ['Asc', 'Desc']) {
        const r = await swMsg({ action: 'swMainWorldFetchServers', placeId, sort });
        if (!r?.ok || !r.data?.data) continue;

        for (const srv of r.data.data) {
          if (!srv?.id || seen.has(srv.id)) continue;
          seen.add(srv.id);
          newThisCycle++;
          // YENİ server tespit edildi
          if (srv.maxPlayers > 0 && srv.playing <= 2) {
            candidates.set(srv.id, { server: srv, firstSeenAt: Date.now() });
            // Süper-fresh (playing <= 1) → hemen dön
            if (srv.playing <= 1) {
              if (onProgress) onProgress({ phase: 'observer_found_fresh', jobId: srv.id, playing: srv.playing, polls });
              return { jobId: srv.id, playing: srv.playing, fresh: true, seenIds: seen };
            }
          }
        }
        await sleep(150);
      }

      if (onProgress) onProgress({
        phase: 'observer_poll',
        polls,
        seen: seen.size,
        candidates: candidates.size,
        newThisCycle
      });
    }

    // Süre doldu — adaylardan en boş olanı seç
    if (candidates.size > 0) {
      const best = [...candidates.values()].sort((a, b) => a.server.playing - b.server.playing)[0];
      if (onProgress) onProgress({ phase: 'observer_best', jobId: best.server.id, playing: best.server.playing });
      return { jobId: best.server.id, playing: best.server.playing, fresh: false, seenIds: seen };
    }

    if (onProgress) onProgress({ phase: 'observer_empty', polls });
    return { seenIds: seen };
  }

  // ── JOIN (belirli jobId ile) ──────────────────────────────────
  async function forceJoinWithJobId(placeId, jobId) {
    // Auto-Reconnect: jobId ile session kaydet (rejoin same-server için kritik)
    try { swMsg({ action: 'saveActiveSession', placeId, jobId, gameTitle: document?.title || null }); } catch (_) {}

    const url = `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${encodeURIComponent(jobId)}`;
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && /roblox\.com/.test(tab.url || '')) {
          await chrome.tabs.update(tab.id, { url }); return;
        }
      } catch (_) {}
      await chrome.tabs.create({ url, active: true }); return;
    }
    window.location.href = url;
  }

  // ── ANA KOMBO FONKSİYONU ─────────────────────────────────────
  // 3 fazlı strateji — Roblox'ta yeni server forcing'in pratik tek doğru yolu.
  async function runCombo(placeId, opts = {}) {
    const log = opts.onProgress || (() => {});

    // ── Faz 1: Quick Snipe (5sn) ─────────────────────────────
    // Şanslıysak biri yeni server açmış olabilir — hızlıca bak, varsa hemen gir.
    // Bonus: bu fazda görülen tüm server ID'leri Faz 3 baseline'ı olarak kullanılacak.
    log({ phase: 'phase1_start', desc: 'Hızlı kontrol: hazır boş server var mı?' });
    const quickResult = await quickSnipe(placeId, (p) => log({ ...p, combo_phase: 1 }), 5000);
    if (quickResult?.jobId) {
      log({ phase: 'phase1_join', jobId: quickResult.jobId, playing: quickResult.playing });
      await sleep(200);
      await forceJoinWithJobId(placeId, quickResult.jobId);
      return { success: true, jobId: quickResult.jobId, phase: 1, method: 'quick_snipe' };
    }

    // Phase 1 baseline'ı: gördüğü tüm server ID'leri (boş bile olsa observed Set döner)
    const baseline = quickResult?.seenIds || new Set();
    log({ phase: 'phase2_baseline', count: baseline.size });

    // ── Faz 2: Block-Flood ─────────────────────────────────
    // Boş server yok → Roblox matchmaker'ı yeni instance açmaya zorla.
    log({ phase: 'phase2_start', desc: 'Block-Flood başlatılıyor...' });

    // Block hedefini oyun büyüklüğüne göre ölçekle — gerçekçi tavanlar.
    // 90sn time-cap'le 200 zaten ulaşılamaz; 100 hedeflemek hem hızlı hem yeterli.
    // ~50 oyuncu: 30. ~500: 60. ~1000: 80. ~3000+: 100 (cap).
    let blockTarget = 50;
    try {
      const info = await getGameInfoSmart(placeId);
      const playing = info?.playing || 0;
      blockTarget = Math.min(100, Math.max(30, Math.round(30 + (playing / 1500) * 70)));
      log({ phase: 'phase2_target', blockTarget, gamePlaying: playing });
    } catch (_) { /* default 50 */ }

    let blockResult;
    try {
      blockResult = await run(placeId, {
        onProgress: (p) => log({ ...p, combo_phase: 2 }),
        blockTarget,
        skipJoin: true,
        postBlockWaitMs: 0
      });
    } catch (err) {
      log({ phase: 'phase2_fail', error: err.message });
      log({ phase: 'fallback' });
      await forceJoin(placeId);
      return { success: false, method: 'fallback', error: err.message };
    }

    const blockedCount = blockResult?.blocked?.length || 0;
    if (!blockResult?.blocked || blockedCount === 0) {
      // Hiç block yok → matchmaker query bile anlamsız (block list aynı eski hali).
      log({ phase: 'phase2_zero_blocks' });
      await forceJoin(placeId);
      return { success: false, method: 'fallback', blocked: 0 };
    }
    if (blockedCount < 10) {
      // Az block var ama yine de matchmaker query'ye değer (her ihtimal şans).
      log({ phase: 'phase2_low_blocks', blocked: blockedCount, note: 'Düşük kapsama, başarı şansı sınırlı' });
    }

    // ── Faz 3: Block Propagation + Multi-Strategy Join ─────
    // 3 paralel saldırı:
    // 3a) MAIN world REST query (minimal body — status:12 bypass denemesi)
    // 3b) Snipe fallback (public list polling)
    // 3c) joinMultiplayerGame native (Roblox.GameLauncher direkt çağrı — Play button mekanizması)
    log({ phase: 'phase3_propagation', desc: 'Block yayılması bekleniyor (15sn)...' });
    await sleep(15000); // 8 → 15sn (Roblox cache yayılması için daha gerçekçi)

    let joinJobId = null;
    let method = 'block_then_default';
    let useNativeJoin = false; // joinMultiplayerGame ile bitti mi?

    // Faz 3a: MAIN world REST matchmaker query
    log({ phase: 'phase3_mainworld', desc: 'Roblox page context\'inden matchmaker sorgulanıyor...' });
    const mm = await swMsg({ action: 'swMainWorldMatchmaker', placeId });

    if (mm?.ok && mm.jobId) {
      joinJobId = mm.jobId;
      const isNew = !baseline.has(joinJobId);
      method = isNew ? 'block_then_mainworld_new' : 'block_then_mainworld_existing';
      log({ phase: 'phase3_mainworld_ok', jobId: joinJobId, mmStatus: mm.status, isNew });
    } else {
      log({ phase: 'phase3_mainworld_miss', status: mm?.status, error: mm?.error || mm?.message });

      // Faz 3b: Snipe fallback (5sn)
      log({ phase: 'phase3_snipe', desc: 'Snipe fallback (5sn)...' });
      const snipe = await quickSnipe(placeId, (p) => log({ ...p, combo_phase: 3 }), 5000, baseline);
      if (snipe?.jobId) {
        joinJobId = snipe.jobId;
        method = 'block_then_snipe';
        const isNew = !baseline.has(joinJobId);
        log({ phase: 'phase3_snipe_ok', jobId: joinJobId, playing: snipe.playing, isNew });
      } else {
        log({ phase: 'phase3_no_snipe' });

        // Faz 3c: joinMultiplayerGame (Roblox.GameLauncher direkt çağrı)
        // Roblox web client'ın Play button mekanizması — block list aktifken matchmaker yenisini açabilir.
        log({ phase: 'phase3_native_join', desc: 'Roblox.GameLauncher.joinMultiplayerGame çağrılıyor...' });
        const native = await swMsg({ action: 'swMainWorldJoinMultiplayer', placeId });
        if (native?.ok) {
          useNativeJoin = true;
          method = 'block_then_native_' + (native.method || 'unknown');
          log({ phase: 'phase3_native_ok', method: native.method });
        } else {
          log({ phase: 'phase3_native_miss', error: native?.error });
        }
      }
    }

    // ── Final Join + Unblock Schedule ─────────────────────
    await sleep(300);
    if (joinJobId) {
      // jobId varsa: REST query veya snipe başarılı → o jobId'yi kullan
      await forceJoinWithJobId(placeId, joinJobId);
    } else if (useNativeJoin) {
      // joinMultiplayerGame zaten Roblox client'ın join flow'unu tetikledi, ekstra çağrı gerekmez
      log({ phase: 'native_join_initiated' });
    } else {
      // Hiçbiri tutmadıysa son çare: deep-link (block list aktif → Roblox client respect eder)
      await forceJoin(placeId);
    }

    // Unblock'u arka planda schedule et (run() skipJoin'de bunu yapmadı)
    unblockAfterJoin(blockResult.myId, placeId, blockResult.blocked, blockResult.csrf, log)
      .catch(e => console.error('[Trigger] Unblock hatası:', e));

    return {
      success: true,
      jobId: joinJobId,
      blocked: blockResult.blocked.length,
      phase: joinJobId ? 3 : 2,
      method
    };
  }

  // ═══════════════════════════════════════════════════════════
  // C+D: SURGICAL TARGETED BLOCK
  // Public servers'tan playerTokens çek → thumbnails batch API ile token→userId resolve
  // → Her server'dan SADECE 1 strategic block → minimum block, maksimum kapsama
  // ═══════════════════════════════════════════════════════════

  // Tüm public server'ları topla (Asc + Desc, dedupe)
  // MAIN world fetch — content-script'te playerTokens gizleniyor; page context tam response verir.
  async function fetchAllPublicServers(placeId, onProgress) {
    const map = new Map();
    const MAX_PAGES = 5; // 5 sayfa × 100 server × 2 yön = 1000 server tavanı
    let firstResponseLogged = false;

    for (const sort of ['Asc', 'Desc']) {
      let cursor = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await swMsg({ action: 'swMainWorldFetchServers', placeId, sort, cursor });

        if (!result?.ok || !result.data) {
          if (result?.rateLimited) { await sleep(3000); continue; }
          console.warn('[Trigger] fetchServers fail:', result?.status || result?.error);
          break;
        }

        const d = result.data;

        // Diagnostic: ilk yanıttaki server'ın yapısını dök → playerTokens var mı, field adı ne?
        if (!firstResponseLogged && d.data && d.data.length > 0) {
          const sample = d.data[0];
          console.log('[Trigger] MAIN-world public servers response shape:', {
            fields: Object.keys(sample),
            hasPlayerTokens: Array.isArray(sample.playerTokens),
            tokenCount: sample.playerTokens?.length || 0,
            samplePlaying: sample.playing,
            sampleMax: sample.maxPlayers
          });
          firstResponseLogged = true;
        }

        (d.data || []).forEach(s => {
          if (s?.id && !map.has(s.id)) map.set(s.id, s);
        });
        if (onProgress) onProgress({ phase: 'targeted_fetch_page', sort, page: page + 1, totalServers: map.size });
        cursor = d.nextPageCursor;
        if (!cursor) break;
        await sleep(500);
      }
    }
    return [...map.values()];
  }

  // Token → userId resolution via thumbnails batch API (MAIN world).
  // Birden fazla resolution stratejisi denenir:
  //  1. response.data[i].targetId (Roblox bazen tokens'ı targetId'ye resolve ediyor)
  //  2. imageUrl pattern'da userId bul (eski URL formatlarında userId vardı)
  async function resolveTokensToUserIds(servers, onProgress) {
    const serverUserMap = new Map();
    const allRequests = [];
    const requestServerMap = new Map();

    servers.forEach(server => {
      serverUserMap.set(server.id, []);
      (server.playerTokens || []).forEach((token, idx) => {
        const requestId = `${server.id}__${idx}`;
        allRequests.push({
          requestId,
          type: 'AvatarHeadShot',
          targetId: 0,
          token,
          format: 'Png',
          size: '150x150'
        });
        requestServerMap.set(requestId, server.id);
      });
    });

    if (onProgress) onProgress({ phase: 'targeted_resolve_start', totalTokens: allRequests.length });

    const CHUNK = 100;
    let resolved = 0;
    let firstResponseLogged = false;

    // URL'den userId çıkarmak için olası pattern'lar
    const urlPatterns = [
      /\/(\d{5,})\/AvatarHeadshot/i,        // /USERID/AvatarHeadshot/
      /-(\d{5,})-AvatarHeadshot/i,           // -USERID-AvatarHeadshot
      /avatar-headshot\/[a-f0-9]+\/(\d{5,})/i // /avatar-headshot/HASH/USERID
    ];

    for (let i = 0; i < allRequests.length; i += CHUNK) {
      const chunk = allRequests.slice(i, i + CHUNK);

      // MAIN world thumbnails fetch — auth context'te daha fazla field dönebilir
      const result = await swMsg({ action: 'swMainWorldThumbnailsBatch', requests: chunk });

      if (!result?.ok || !result.data) {
        if (result?.rateLimited) { await sleep(2000); i -= CHUNK; continue; }
        console.warn('[Trigger] thumbnailsBatch fail:', result?.status || result?.error);
        await sleep(400);
        continue;
      }

      const d = result.data;

      // Diagnostic: ilk response'daki bir item'in tüm field'larını göster
      if (!firstResponseLogged && d.data && d.data.length > 0) {
        const sample = d.data[0];
        console.log('[Trigger] Thumbnails MAIN-world response sample:', {
          fields: Object.keys(sample),
          targetId: sample.targetId,
          imageUrl: sample.imageUrl,
          state: sample.state,
          errorCode: sample.errorCode,
          fullSample: sample
        });
        firstResponseLogged = true;
      }

      (d.data || []).forEach(item => {
        if (!item.requestId) return;
        const serverId = requestServerMap.get(item.requestId);
        if (!serverId) return;

        let uid = null;

        // Strateji 1: response.targetId field'ı (eğer Roblox burada userId döndürüyorsa)
        if (item.targetId && item.targetId > 0) {
          uid = item.targetId;
        }

        // Strateji 2: imageUrl regex (URL'de userId pattern'ı varsa)
        if (!uid && item.imageUrl) {
          for (const pattern of urlPatterns) {
            const m = item.imageUrl.match(pattern);
            if (m) {
              uid = parseInt(m[1], 10);
              break;
            }
          }
        }

        if (uid && uid > 0) {
          const list = serverUserMap.get(serverId);
          if (list && !list.includes(uid)) {
            list.push(uid);
            resolved++;
          }
        }
      });

      if (onProgress) onProgress({
        phase: 'targeted_resolve_chunk',
        chunk: Math.floor(i / CHUNK) + 1,
        total: Math.ceil(allRequests.length / CHUNK),
        resolved
      });
      await sleep(400);
    }

    if (onProgress) onProgress({ phase: 'targeted_resolve_done', servers: serverUserMap.size, resolvedTotal: resolved });
    return serverUserMap;
  }

  // ── FINGERPRINT MATCHING (Roblox tokens'ı obfuscate ediyor — bu yan kapı) ──
  // Thumbnail URL'in hash'i (rüstgar) avatar render'ın content-address'i.
  // Aynı user → aynı hash, ister token mode'da sorgula ister userId mode'da.
  // → Server token'larının hash'leriyle bilinen userId hash'lerini match'le → kim hangi server'da.

  // URL'den avatar hash'i çıkar — birden fazla pattern denenir (Roblox CDN URL formatları varyant).
  function extractAvatarHash(url) {
    if (!url || typeof url !== 'string') return null;
    const patterns = [
      /AvatarHeadshot-([a-fA-F0-9]{16,})/i,
      /Avatar-([a-fA-F0-9]{16,})/i,
      /\/([a-fA-F0-9]{32,})[\/\-]/i,
      /\/([a-fA-F0-9]{32,})$/i
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m && m[1]) return m[1].toLowerCase();
    }
    return null;
  }

  // Tüm server token'ları için hash topla → Map<serverId, Set<hash>>
  async function buildServerFingerprints(servers, onProgress) {
    const result = new Map();
    const allRequests = [];
    const requestServerMap = new Map();

    servers.forEach(server => {
      result.set(server.id, new Set());
      (server.playerTokens || []).forEach((token, idx) => {
        const requestId = `srv_${server.id}__${idx}`;
        allRequests.push({
          requestId,
          type: 'AvatarHeadShot',
          targetId: 0,
          token,
          format: 'Png',
          size: '150x150'
        });
        requestServerMap.set(requestId, server.id);
      });
    });

    if (onProgress) onProgress({ phase: 'fingerprint_servers_start', tokens: allRequests.length });

    const CHUNK = 100;
    let extracted = 0;
    for (let i = 0; i < allRequests.length; i += CHUNK) {
      const chunk = allRequests.slice(i, i + CHUNK);
      const r = await swMsg({ action: 'swMainWorldThumbnailsBatch', requests: chunk });
      if (!r?.ok || !r.data) {
        if (r?.rateLimited) { await sleep(2000); i -= CHUNK; continue; }
        await sleep(400); continue;
      }
      (r.data.data || []).forEach(item => {
        const serverId = requestServerMap.get(item.requestId);
        if (!serverId) return;
        const hash = extractAvatarHash(item.imageUrl);
        if (hash) {
          result.get(serverId).add(hash);
          extracted++;
        }
      });
      if (onProgress) onProgress({
        phase: 'fingerprint_servers_chunk',
        chunk: Math.floor(i / CHUNK) + 1,
        total: Math.ceil(allRequests.length / CHUNK),
        extracted
      });
      await sleep(400);
    }

    if (onProgress) onProgress({ phase: 'fingerprint_servers_done', servers: result.size, hashes: extracted });
    return result;
  }

  // Bilinen userId havuzunun hash'lerini topla → Map<userId, hash>
  async function buildUserFingerprints(userIds, onProgress) {
    const result = new Map();
    const allRequests = userIds.map((uid, idx) => ({
      requestId: `usr_${uid}_${idx}`,
      type: 'AvatarHeadShot',
      targetId: uid,
      token: '',
      format: 'Png',
      size: '150x150'
    }));

    if (onProgress) onProgress({ phase: 'fingerprint_users_start', users: allRequests.length });

    const CHUNK = 100;
    let extracted = 0;
    for (let i = 0; i < allRequests.length; i += CHUNK) {
      const chunk = allRequests.slice(i, i + CHUNK);
      const r = await swMsg({ action: 'swMainWorldThumbnailsBatch', requests: chunk });
      if (!r?.ok || !r.data) {
        if (r?.rateLimited) { await sleep(2000); i -= CHUNK; continue; }
        await sleep(400); continue;
      }
      (r.data.data || []).forEach(item => {
        // requestId formatı: usr_{uid}_{idx}
        const m = (item.requestId || '').match(/^usr_(\d+)_/);
        if (!m) return;
        const uid = parseInt(m[1], 10);
        const hash = extractAvatarHash(item.imageUrl);
        if (hash && uid > 0) {
          result.set(uid, hash);
          extracted++;
        }
      });
      if (onProgress) onProgress({
        phase: 'fingerprint_users_chunk',
        chunk: Math.floor(i / CHUNK) + 1,
        total: Math.ceil(allRequests.length / CHUNK),
        extracted
      });
      await sleep(400);
    }

    if (onProgress) onProgress({ phase: 'fingerprint_users_done', users: result.size });
    return result;
  }

  // Hash match: her server'dan en fazla 1 unique userId döndür
  function matchUsersToServers(serverFingerprints, userFingerprints, protectedIds, myId) {
    const matches = new Map();   // serverId → userId
    const usedUsers = new Set();

    // Reverse map: hash → userId (hızlı lookup için)
    const hashToUser = new Map();
    for (const [uid, hash] of userFingerprints) {
      if (uid === myId || protectedIds.has(uid)) continue;
      // Aynı hash birden fazla user'a denk gelebilir (avatar collision); ilk uid'i tut.
      if (!hashToUser.has(hash)) hashToUser.set(hash, uid);
    }

    for (const [serverId, hashSet] of serverFingerprints) {
      for (const hash of hashSet) {
        const uid = hashToUser.get(hash);
        if (uid && !usedUsers.has(uid)) {
          matches.set(serverId, uid);
          usedUsers.add(uid);
          break;
        }
      }
    }

    return matches;
  }

  // Server-level targeting: her server'dan 1 user seç (protected/myId hariç).
  // Aynı user birden fazla server'da görünüyorsa 2. server için yedek seç.
  function buildSurgicalTargets(serverUserMap, protectedIds, myId) {
    const targets = []; // sıralı, server bazında
    const targetMap = new Map(); // serverId → userId
    const targetSet = new Set(); // dedupe — aynı user iki server için seçilmesin

    for (const [serverId, userIds] of serverUserMap) {
      for (const uid of userIds) {
        if (!uid || uid === myId) continue;
        if (protectedIds.has(uid)) continue;
        if (targetSet.has(uid)) continue; // başka server için zaten seçildi
        targets.push(uid);
        targetMap.set(serverId, uid);
        targetSet.add(uid);
        break; // bu server için 1 user yeterli
      }
    }

    return { targets, targetMap };
  }

  // Ana fonksiyon — fingerprint matching ile server-level surgical targeting
  async function runTargeted(placeId, opts = {}) {
    const log = opts.onProgress || (() => {});

    log({ phase: 'csrf' });
    let csrf;
    try { csrf = await getCsrf(); } catch (e) {
      throw new Error('Roblox oturumu bulunamadı. roblox.com\'a giriş yap.');
    }

    const myId = await getMyId();

    // Önceki bekleyen block'ları temizle
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const s = await chrome.storage.local.get('trigger_pending_unblock');
      if (s.trigger_pending_unblock?.ids?.length) {
        log({ phase: 'cleanup_previous', count: s.trigger_pending_unblock.ids.length });
        for (const uid of s.trigger_pending_unblock.ids) {
          try { await swMsg({ action: 'swUnblockUser', userId: uid, csrf }); } catch (_) {}
          await sleep(150);
        }
        await chrome.storage.local.remove('trigger_pending_unblock');
      }
    }

    // ─ Faz -1: RESERVED SERVER PROBE (kısa yol — eğer destekleniyorsa garanti boş!) ─
    // Bazı oyunlar için Roblox /private-server/reserve endpoint'i ücretsiz boş server veriyor.
    // Eğer destekleniyorsa BLOK FLOOD GEREKMEZ — direkt boş private server'a gir.
    // Çoğu oyun için fail eder ama 2sn'lik probe değer.
    log({ phase: 'reserve_probe', desc: 'Faz -1: Reserved Server probe — ücretsiz boş server var mı?' });
    try {
      const gameInfoForProbe = await getGameInfoSmart(placeId);
      const universeId = gameInfoForProbe?.universeId;
      if (universeId) {
        const reserve = await swMsg({ action: 'swMainWorldReserveServer', universeId, placeId });
        if (reserve?.ok && reserve.accessCode) {
          log({ phase: 'reserve_found', accessCode: reserve.accessCode.substring(0, 12) + '...', source: reserve.source || 'reserved' });
          // Access code ile deep-link → garantili boş server
          const url = `roblox://placeId=${placeId}&accessCode=${encodeURIComponent(reserve.accessCode)}`;
          if (typeof chrome !== 'undefined' && chrome.tabs) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && /roblox\.com/.test(tab.url || '')) {
              await chrome.tabs.update(tab.id, { url });
            } else {
              await chrome.tabs.create({ url, active: true });
            }
          }
          return {
            success: true,
            jobId: null,
            accessCode: reserve.accessCode,
            method: 'reserved_server',
            blocked: 0,
            coveredServers: 1,
            totalServers: 1,
            coveragePercent: 100,
            estimatedCoveragePercent: 100,
            blockedInGameCount: 0
          };
        } else {
          log({ phase: 'reserve_not_available', error: reserve?.error || 'Game does not support free reserved servers' });
        }
      } else {
        log({ phase: 'reserve_skip', reason: 'universeId not available' });
      }
    } catch (e) {
      log({ phase: 'reserve_error', error: e.message });
    }

    // ─ Faz 0: PASSIVE OBSERVER SNIPE (C+D 2.0 — kısa yol) ─
    // 45sn boyunca yeni açılan boş server'ı izle. Bulursa direkt gir, blok-flood gereksiz.
    // 25 → 45sn: popüler oyunlarda her ~30sn yeni server açılıyor, daha sabırlı izleme = daha fazla yakalama şansı.
    log({ phase: 'observer_start', desc: 'Faz 0/9: Yeni server izleyici (45sn) — sabırlı yakalama denemesi...' });
    const observerResult = await passiveObserverSnipe(placeId, log, 45000);
    if (observerResult?.jobId) {
      log({ phase: 'observer_join', jobId: observerResult.jobId, playing: observerResult.playing, fresh: observerResult.fresh });
      await sleep(200);
      await forceJoinWithJobId(placeId, observerResult.jobId);
      return {
        success: true,
        jobId: observerResult.jobId,
        method: observerResult.fresh ? 'observer_fresh' : 'observer_low',
        blocked: 0,
        coveredServers: 1,
        totalServers: observerResult.seenIds.size,
        coveragePercent: 100,
        estimatedCoveragePercent: 100,
        blockedInGameCount: 0
      };
    }
    log({ phase: 'observer_skip', desc: 'Observer boş döndü, fingerprint matching\'e geçiliyor...' });

    // ─ Faz 1: Public server'ları topla (tokens dahil) ─
    log({ phase: 'targeted_phase1' });
    const servers = await fetchAllPublicServers(placeId, log);
    if (servers.length === 0) {
      throw new Error('Hiç public server bulunamadı. Oyun erişilemez olabilir.');
    }
    const totalTokens = servers.reduce((a, s) => a + (s.playerTokens?.length || 0), 0);
    log({ phase: 'targeted_servers_done', serverCount: servers.length, totalTokens });

    if (totalTokens === 0) {
      throw new Error(`Roblox playerTokens API erişilemiyor — ${servers.length} server bulundu ama 0 token döndü. A+B (community block) deneyin.`);
    }

    // ─ Faz 2: Server fingerprint'lerini topla (token → hash) ─
    log({ phase: 'targeted_phase2_server_fp', desc: 'Server token\'larından avatar fingerprint\'leri çıkarılıyor...' });
    const serverFingerprints = await buildServerFingerprints(servers, log);

    // Sanity check
    let totalServerHashes = 0;
    for (const hashSet of serverFingerprints.values()) totalServerHashes += hashSet.size;
    if (totalServerHashes === 0) {
      throw new Error(`Server token URL'lerinden hiç hash çıkarılamadı. URL formatı değişmiş olabilir.`);
    }

    // ─ Faz 3: Candidate pool oluştur (community + presence + friends-expansion) ─
    log({ phase: 'building_safelist' });
    const protectedIds = await buildExclusionList(myId, log);

    log({ phase: 'targeted_phase3_candidates', desc: 'Aday havuzu oluşturuluyor (community + presence + friends)...' });
    const gameInfo = await getGameInfoSmart(placeId);

    let candidatePool = new Set();

    // Community group üyeleri (varsa)
    if (gameInfo.groupId) {
      const groupIds = await harvestGroupMembersById(gameInfo.groupId, log);
      groupIds.forEach(id => {
        if (!protectedIds.has(id) && id !== myId) candidatePool.add(id);
      });
    }

    if (candidatePool.size === 0) {
      throw new Error('Community grubu yok ve aday havuzu boş. Bu oyun için C+D çalışamaz.');
    }

    // ─ ACTIVITY-AWARE FILTERING (C+D 2.0) ─
    // Tek presence çağrısıyla hem in-game hem son aktif kullanıcıları al.
    // Offline community üyeleri fingerprint havuzundan ÇIKAR (boş hash, israf).
    const candidateArr = [...candidatePool];
    log({ phase: 'activity_filter_start', desc: 'Activity-aware filter (24h)...', candidates: candidateArr.length });
    const activity = await filterByActivity(candidateArr, placeId, 24, log);
    log({
      phase: 'activity_filter_done',
      total: candidateArr.length,
      inGame: activity.inGame.length,
      recentlyActive: activity.recentlyActive.length,
      activeRatio: candidateArr.length > 0 ? Math.round(((activity.inGame.length + activity.recentlyActive.length) / candidateArr.length) * 100) : 0
    });

    let inGameIds = [...activity.inGame];

    // Multi-pass: 8sn arayla 2 ek pass — geçici/server-hopping kullanıcıları yakala
    if (inGameIds.length < 30) {
      for (let pass = 1; pass <= 2; pass++) {
        await sleep(8000);
        const more = await filterInGame(candidateArr, placeId);
        const set = new Set(inGameIds);
        more.forEach(id => set.add(id));
        const added = set.size - inGameIds.length;
        inGameIds = [...set];
        log({ phase: 'presence_pass', pass: pass + 1, totalPasses: 3, inGame: inGameIds.length, added });
      }
    }
    log({ phase: 'presence_done', inGame: inGameIds.length });

    // Friends-expansion (in-game seedleri varsa)
    if (inGameIds.length > 0 && inGameIds.length < 30) {
      const expandedIds = await expandViaFriends(inGameIds, placeId, protectedIds, log);
      if (expandedIds.length > 0) {
        const before = inGameIds.length;
        const set = new Set(inGameIds);
        expandedIds.forEach(id => {
          set.add(id);
          candidatePool.add(id);
        });
        inGameIds = [...set];
        log({ phase: 'expansion_merged', before, added: inGameIds.length - before, total: inGameIds.length });
      }
    }

    // ─ Pool: ACTIVITY-WEIGHTED prioritization (C+D 2.0) ─
    // Eski yaklaşım: Tüm community (5000) → fingerprint çağrısı → çoğu offline → boş hash → israf
    // Yeni yaklaşım: Sadece in-game + recentlyActive + friends-expansion → kaliteli pool, küçük & isabetli
    // Recency-sorted: en son aktif kullanıcılar başta (matchmaker'a göre yüksek hit ihtimali)
    const fingerprintSet = new Set();
    inGameIds.forEach(id => fingerprintSet.add(id));                  // 1. öncelik: kesin in-game
    activity.recentlyActive.forEach(id => fingerprintSet.add(id));    // 2. öncelik: son aktif (recency-sorted zaten)

    // 3. öncelik: friends-expansion'dan eklenen kullanıcılar (zaten candidatePool'da)
    // Eğer pool çok küçükse (<200), community fallback ekle
    const FINGERPRINT_POOL_TARGET = 1500; // Daha çok fingerprint = daha fazla match şansı
    if (fingerprintSet.size < FINGERPRINT_POOL_TARGET) {
      // Fallback: community'den geri kalanları ekle (offline kabul, ama avatar match için yine de değerli)
      for (const id of candidatePool) {
        if (fingerprintSet.size >= FINGERPRINT_POOL_TARGET) break;
        fingerprintSet.add(id);
      }
    }

    const fingerprintCandidates = [...fingerprintSet].filter(id => !protectedIds.has(id) && id !== myId);
    log({
      phase: 'targeted_pool_built',
      poolSize: fingerprintCandidates.length,
      inGame: inGameIds.length,
      recentlyActive: activity.recentlyActive.length,
      activityFiltered: true
    });

    // ─ Faz 4: Candidate fingerprint'lerini topla (userId → hash) ─
    log({ phase: 'targeted_phase4_user_fp', desc: 'Aday userId\'lerin avatar fingerprint\'leri çekiliyor...' });
    const userFingerprints = await buildUserFingerprints(fingerprintCandidates, log);

    // ─ Faz 5: Fingerprint matching (hash intersection) ─
    log({ phase: 'targeted_phase5_match', desc: 'Hash matching — kim hangi server\'da?' });
    const matches = matchUsersToServers(serverFingerprints, userFingerprints, protectedIds, myId);
    const fingerprintMatches = [...new Set(matches.values())];

    // ── HİBRİT TARGET BUILDER ──
    // Strateji: Fingerprint match'leri (server-spesifik) + presence-confirmed in-game'ler (kanıtlı bir server'da).
    // Avatar collision false-positive riskine karşı: presence-confirmed olmayan match'leri filtrele.
    // Sonra TÜM presence-confirmed in-game kullanıcıları ekle (her biri bir server'da garanti).
    const inGameSet = new Set(inGameIds);
    const verifiedMatches = fingerprintMatches.filter(uid => inGameSet.has(uid));
    const matchOnlyButNotInGame = fingerprintMatches.filter(uid => !inGameSet.has(uid));

    // 1. Verified (fingerprint + presence) → en güvenilir
    // 2. Tüm presence-confirmed in-game (verified olanlar dahil — set ile dedupe)
    // 3. Fingerprint-only match'ler (presence yok ama hash çakışıyor — düşük güven, sona ekle)
    const targetSet = new Set();
    verifiedMatches.forEach(uid => targetSet.add(uid));
    inGameIds.filter(id => !protectedIds.has(id) && id !== myId).forEach(uid => targetSet.add(uid));
    matchOnlyButNotInGame.forEach(uid => targetSet.add(uid));
    const targets = [...targetSet];

    const coverage = serverFingerprints.size > 0 ? Math.round((matches.size / serverFingerprints.size) * 100) : 0;
    log({
      phase: 'targeted_targets_built',
      totalServers: serverFingerprints.size,
      fingerprintMatches: fingerprintMatches.length,
      verifiedMatches: verifiedMatches.length,
      inGameTargets: inGameIds.length,
      finalTargets: targets.length,
      matchedServers: matches.size,
      coverage
    });

    if (targets.length === 0) {
      throw new Error(`Aday yok: ${fingerprintMatches.length} fingerprint match, ${inGameIds.length} presence-confirmed in-game, hepsi koruma listesinde veya yok.`);
    }

    // ─ ADAPTIVE BLOCK TARGET (C+D 2.0) ─
    // Server sayısına göre minimum block hedefi belirle. Rate-limit dalgasında bile yeterli kapsama için fazla hedef koy.
    // Formül: max(server_count × 2, in_game × 1.5, 15) — 6 serverlı oyun için min 15.
    const serverCount = serverFingerprints.size;
    const adaptiveMinTarget = Math.max(
      Math.ceil(serverCount * 2),       // her server için 2 block (rate-limit kayıp payı)
      Math.ceil(inGameIds.length * 1.5),
      15                                // mutlak alt sınır
    );

    // Hedef sayısı yetersizse: community pool'dan rastgele üyeler ekle (offline da olsa fallback değeri var)
    if (targets.length < adaptiveMinTarget) {
      const communityFallback = [...candidatePool].filter(id =>
        !targetSet.has(id) &&
        !protectedIds.has(id) &&
        id !== myId
      );
      // Karıştır, farklı server'lara dağılma şansı
      for (let i = communityFallback.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [communityFallback[i], communityFallback[j]] = [communityFallback[j], communityFallback[i]];
      }
      const needed = adaptiveMinTarget - targets.length;
      const added = communityFallback.slice(0, needed);
      added.forEach(id => targets.push(id));
      log({ phase: 'targets_expanded', from: targets.length - added.length, added: added.length, finalTotal: targets.length, reason: `Server count (${serverCount}) için min hedef ${adaptiveMinTarget}` });
    }

    // ─ Faz 6: ITERATIVE BLOCK-SNIPE LOOP (C+D 2.0) ─
    // Tek seferde tüm block'lar yerine batch'ler halinde:
    //   3 block → 5sn bekle → snipe (yeni server var mı?) → bulamadıysan 3 daha → tekrar
    // Bu sayede her batch sonrası matchmaker yeni server açabilir, ilk fırsatta yakalarız.
    // Eski yaklaşım 1 snipe denemesi yapıyordu, yeni 4-5 snipe denemesi yapacak.
    const baselineForLoop = new Set(servers.map(s => s.id));
    let allBlocked = [];
    let workingCsrf = csrf;
    let iterativeJobId = null;
    let iterativeFresh = false;

    const BATCH_SIZE = 3;
    const SNIPE_BETWEEN_BATCHES_MS = 4000;
    const MAX_BATCHES = Math.ceil(targets.length / BATCH_SIZE);

    log({ phase: 'block', total: targets.length, adaptiveMin: adaptiveMinTarget, serverCount, mode: 'iterative' });

    for (let b = 0; b < MAX_BATCHES; b++) {
      const slice = targets.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE)
        .filter(id => !allBlocked.includes(id));
      if (slice.length === 0) continue;

      log({ phase: 'iterative_batch', batch: b + 1, total: MAX_BATCHES, batchSize: slice.length, totalBlocked: allBlocked.length });

      const batchResult = await blockUsers(slice, myId, workingCsrf, log, protectedIds, slice.length);
      workingCsrf = batchResult.csrf;
      batchResult.blocked.forEach(uid => {
        if (!allBlocked.includes(uid)) allBlocked.push(uid);
      });

      // Erken çıkış: blok sayısı server count × 1.5'i geçtiyse yeterince agresif
      if (allBlocked.length >= serverCount * 1.5 && b < MAX_BATCHES - 1) {
        log({ phase: 'iterative_early_block_exit', blocked: allBlocked.length, threshold: Math.ceil(serverCount * 1.5) });
      }

      // Son batch değilse → snipe & matchmaker query dene
      if (b < MAX_BATCHES - 1) {
        log({ phase: 'iterative_snipe', batch: b + 1, blocked: allBlocked.length });
        await sleep(SNIPE_BETWEEN_BATCHES_MS);

        // Hızlı poll — yeni server var mı?
        const quickPoll = await passiveObserverSnipe(placeId, (p) => log({ ...p, iter: b + 1 }), 5000);
        if (quickPoll?.jobId && !baselineForLoop.has(quickPoll.jobId)) {
          iterativeJobId = quickPoll.jobId;
          iterativeFresh = quickPoll.fresh;
          log({ phase: 'iterative_jobid_found', batch: b + 1, jobId: iterativeJobId, fresh: iterativeFresh });
          break; // Loop'tan çık
        }

        // Erken çıkış kontrolü: yeterince block, devam etmenin değeri düşük
        if (allBlocked.length >= serverCount * 1.5) break;
      }
    }

    const blocked = allBlocked;
    csrf = workingCsrf;
    log({ phase: 'block_done', blocked: blocked.length, iterativeJobIdFound: !!iterativeJobId });

    if (blocked.length < 2) {
      throw new Error(`Yalnızca ${blocked.length} kişi engellenebildi. Yeterli değil.`);
    }

    // Gerçek server kapsamı — kaç match'lenen target başarıyla blocklandı (fingerprint-confirmed coverage)
    const blockedSet = new Set(blocked);
    let coveredServers = 0;
    for (const [serverId, uid] of matches) {
      if (blockedSet.has(uid)) coveredServers++;
    }
    // ESTIMATED coverage: presence-confirmed in-game user'lar fingerprint dışı server'lara da denk geliyor olabilir.
    // 1 in-game user = 1 server (kesinlikle bir yerdeler), block sayısı = max kapsama estimate.
    const blockedInGameCount = inGameIds.filter(id => blockedSet.has(id)).length;
    const estimatedCoveragePercent = serverFingerprints.size > 0
      ? Math.min(100, Math.round((blockedInGameCount / serverFingerprints.size) * 100))
      : 0;
    const coveragePercent = serverFingerprints.size > 0 ? Math.round((coveredServers / serverFingerprints.size) * 100) : 0;
    log({
      phase: 'targeted_coverage',
      fingerprintCovered: coveredServers,
      total: serverFingerprints.size,
      fingerprintPercent: coveragePercent,
      blockedInGame: blockedInGameCount,
      estimatedPercent: estimatedCoveragePercent
    });

    // ─ Faz 7: Multi-strategy join ─
    const baseline = new Set(servers.map(s => s.id));

    let joinJobId = null;
    let method = 'targeted_default';
    // Note: useNativeJoin kaldırıldı — auth fail riski nedeniyle joinMultiplayerGame artık kullanılmıyor.

    // İteratif loop'ta jobId yakalanmışsa Phase 7-8 atla, direkt onunla devam
    if (iterativeJobId) {
      joinJobId = iterativeJobId;
      method = iterativeFresh ? 'targeted_iterative_fresh' : 'targeted_iterative_low';
      log({ phase: 'iterative_join_skip', jobId: iterativeJobId, fresh: iterativeFresh });
    }

    if (!joinJobId) {
      log({ phase: 'phase3_propagation', desc: 'Block yayılması bekleniyor (15sn)...' });
      await sleep(15000);
    }

    // ─ Faz 7a: POST-BLOCK OBSERVER (yeni!) ─
    // Block list aktifken Roblox matchmaker bize uygun server BULAMAZSA yeni instance açar.
    // 12sn boyunca yeni gelen server ID'leri izle — baseline'da olmayan = matchmaker'ın bize özel açtığı.
    log({ phase: 'phase3_post_observer', desc: 'Post-block observer (12sn) — matchmaker bize yeni server açtı mı?' });
    const postObs = await passiveObserverSnipe(placeId, (p) => log({ ...p, combo_phase: 'post_observer' }), 12000);
    // Sadece baseline DIŞINDA olanları kabul et (gerçek yeni)
    if (postObs?.jobId && !baseline.has(postObs.jobId)) {
      joinJobId = postObs.jobId;
      method = 'targeted_post_observer';
      log({ phase: 'phase3_post_observer_ok', jobId: joinJobId, playing: postObs.playing, fresh: postObs.fresh });
    }

    // 7b) MAIN world REST query (sadece post-observer boş döndüyse)
    if (!joinJobId) {
    log({ phase: 'phase3_mainworld', desc: 'Roblox page context\'inden matchmaker sorgulanıyor...' });
    const mm = await swMsg({ action: 'swMainWorldMatchmaker', placeId });
    if (mm?.ok && mm.jobId) {
      joinJobId = mm.jobId;
      const isNew = !baseline.has(joinJobId);
      method = isNew ? 'targeted_mainworld_new' : 'targeted_mainworld_existing';
      log({ phase: 'phase3_mainworld_ok', jobId: joinJobId, mmStatus: mm.status, isNew });
    } else {
      log({ phase: 'phase3_mainworld_miss', status: mm?.status, error: mm?.error || mm?.message });

      // 6b) Snipe fallback
      log({ phase: 'phase3_snipe', desc: 'Snipe fallback (5sn)...' });
      const snipe = await quickSnipe(placeId, (p) => log({ ...p, combo_phase: 3 }), 5000, baseline);
      if (snipe?.jobId) {
        joinJobId = snipe.jobId;
        method = 'targeted_snipe';
        const isNew = !baseline.has(joinJobId);
        log({ phase: 'phase3_snipe_ok', jobId: joinJobId, playing: snipe.playing, isNew });
      } else {
        log({ phase: 'phase3_no_snipe', desc: 'Snipe da yetişemedi — block-active deep-link ile gireceğiz (Roblox client block list\'i respect eder)' });
        // ÖNEMLİ: Native joinMultiplayerGame KALDIRILDI.
        // Sebep: Roblox client'ın PlaceLauncher.ashx auth'u rate-limited session'da "Authentication Failed" veriyor.
        // Çözüm: Plain deep-link `roblox://experiences/start?placeId=X` — auth token oluşturmaz, Roblox client
        // block listesini server-side respect eder, bu yöntem güvenilir.
        method = 'targeted_block_active_deeplink';
      }
    }
    } // end of if (!joinJobId)

    // Final join + unblock schedule
    await sleep(300);
    if (joinJobId) {
      // Specific jobId varsa direkt onunla gir (en güvenli yol)
      await forceJoinWithJobId(placeId, joinJobId);
    } else {
      // jobId yok — plain deep-link. Block list aktif → Roblox client matchmaker yeni server seçer.
      // Auth fail riski yok (PlaceLauncher.ashx çağrılmaz, direkt placeId launch).
      log({ phase: 'final_deeplink', desc: 'Plain deep-link ile giriş — block list aktif, Roblox client karar verecek' });
      await forceJoin(placeId);
    }

    unblockAfterJoin(myId, placeId, blocked, csrf, log)
      .catch(e => console.error('[Trigger] Unblock hatası:', e));

    return {
      success: true,
      jobId: joinJobId,
      blocked: blocked.length,
      coveredServers,
      totalServers: serverFingerprints.size,
      coveragePercent,
      estimatedCoveragePercent,
      blockedInGameCount,
      method
    };
  }

  return { run, runCombo, runTargeted, emergencyUnblock };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrackedInstanceTrigger;
}
