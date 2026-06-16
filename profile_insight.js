// profile_insight.js — Tracked v1.9.4: Oyuncu İçgörü Paneli (Profil Sayfası)
// /users/{id}/profile sayfasına native görünümlü, sağda yüzen bir bilgi kartı enjekte eder.
// Bölümler: Künye (yaş/oluşturma/doğrulanmış/eski adlar) · Değer (RAP+değer+top item) ·
//           Sosyal (arkadaş/takipçi/takip + ortak arkadaş + online "ne oynuyor" + Katıl) ·
//           Güven sinyalleri (DÜRÜST gerçek metrik rozetleri; uydurma skor YOK).
// Tüm veri gerçek Roblox/Rolimons API (SW CORS-bypass). catalog_enhancer floating panel deseni.

(function () {
  'use strict';
  if (window._trackedProfileInsightSetup) return;
  window._trackedProfileInsightSetup = true;

  const PANEL_ID = 'tracked-profile-insight';
  const STYLE_ID = 'tracked-profile-insight-style';
  const MIN_KEY  = 'tracked_pi_minimized'; // küçültülmüş hâl KALICI (refresh/profil geçişi)
  const saveMin = (v) => { try { chrome.storage.local.set({ [MIN_KEY]: !!v }); } catch (_) {} };

  // ── i18n yardımcısı (TrackedI18n yüklüyse onu kullan, değilse TR fallback) ──
  const t = (k, fb) => {
    try { if (typeof TrackedI18n !== 'undefined') { const v = TrackedI18n.t(k); if (v && v !== k) return v; } } catch (_) {}
    return fb;
  };

  // ── İkonlar (hepsi inline SVG — emoji YOK) ──
  const ICON_ROBUX = `<svg width="1em" height="1em" viewBox="0 0 28 28" fill="currentColor" fill-rule="evenodd" style="flex-shrink:0;display:inline-block;vertical-align:-0.12em;margin-right:3px"><path d="M23.402,5.571 C25.009,6.499 26,8.215 26,10.071 L26,17.927 C26,19.784 25.009,21.499 23.402,22.427 L16.597,26.356 C14.99,27.284 13.009,27.284 11.402,26.356 L4.597,22.427 C2.99,21.499 2,19.784 2,17.927 L2,10.071 C2,8.215 2.99,6.499 4.597,5.571 L11.402,1.643 C13.009,0.715 14.99,0.715 16.597,1.643 L23.402,5.571 Z M12.313,3.426 L5.686,7.252 C4.642,7.855 4,8.968 4,10.174 L4,17.825 C4,19.03 4.642,20.144 5.686,20.747 L12.313,24.572 C13.357,25.175 14.642,25.175 15.686,24.572 L22.313,20.747 C23.357,20.144 24,19.03 24,17.825 L24,10.174 C24,8.968 23.357,7.855 22.313,7.252 L15.686,3.426 C14.642,2.823 13.357,2.823 12.313,3.426 L12.313,3.426 Z M15.385,5.564 L20.614,8.582 C21.471,9.077 22,9.992 22,10.983 L22,17.02 C22,18.01 21.471,18.925 20.614,19.42 L15.385,22.439 C14.528,22.934 13.471,22.934 12.614,22.439 L7.385,19.42 C6.528,18.925 6,18.01 6,17.02 L6,10.983 C6,9.992 6.528,9.077 7.385,8.582 L12.614,5.564 C13.471,5.069 14.528,5.069 15.385,5.564 L15.385,5.564 Z M11,17.001 L17,17.001 L17,11.001 L11,11.001 L11,17.001 Z"/></svg>`;
  const ICON_VERIFIED = `<svg width="13" height="13" viewBox="0 0 24 24" fill="#0A84FF" stroke="none" style="vertical-align:-2px"><path d="M12 1.5l2.6 1.95 3.25.2.95 3.15L21.5 10l-1.95 2.6.95 3.15-3.15.95L15.4 19.8 12 21.5l-2.6-1.7-3.25-.05-.95-3.15L3.25 13.8 4.2 10.65 2.5 7l3.15-.95.95-3.15 3.25-.2z"/><polyline points="8.4 12 11 14.5 15.6 9.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_MIN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>`;
  const ICON_USER = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const ICON_PLAY = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

  // ── Yardımcılar ──
  function swMsg(msg) {
    return new Promise(resolve => {
      try { chrome.runtime.sendMessage(msg, resp => { if (chrome.runtime.lastError) { resolve(null); return; } resolve(resp || null); }); }
      catch { resolve(null); }
    });
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function abbrev(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K';
    return Number(n).toLocaleString('en-US');
  }
  // Profil URL'sinden userId çıkar (/users/{id}/profile)
  function getProfileUserId() {
    const m = location.pathname.match(/\/users\/(\d+)\/profile/);
    return m ? m[1] : null;
  }
  function accountAge(createdIso) {
    if (!createdIso) return null;
    const created = new Date(createdIso);
    if (isNaN(created)) return null;
    const now = new Date();
    let months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
    if (now.getDate() < created.getDate()) months--;
    const days = Math.floor((now - created) / 86400000);
    return { months: Math.max(0, months), days, created };
  }
  function fmtAge(age) {
    if (!age) return '—';
    if (age.days < 31) return `${age.days} ${t('piDay', 'gün')}`;
    const y = Math.floor(age.months / 12), m = age.months % 12;
    const parts = [];
    if (y > 0) parts.push(`${y} ${t('piYear', 'yıl')}`);
    if (m > 0) parts.push(`${m} ${t('piMonth', 'ay')}`);
    return parts.join(' ') || `${age.months} ${t('piMonth', 'ay')}`;
  }
  function fmtDate(d) {
    try { return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d.toISOString().slice(0, 10); }
  }

  // ── Değer pipeline ──
  // BİRİNCİL: Rolimons playerassets (başka kullanıcının public envanteri için en güvenilir/hızlı).
  // FALLBACK: derin UGC tarama (fetchUserAllLimiteds) — Rolimons'ta yoksa.
  async function finalizeValue(items) {
    items.sort((a, b) => b.val - a.val);
    const top = items.slice(0, 3);
    let thumbs = {};
    if (top.length) { const tr = await swMsg({ action: 'fetchItemThumbnails', assetIds: top.map(x => x.id) }); thumbs = (tr && tr.map) || {}; }
    let rap = 0, value = 0; for (const it of items) { rap += it.rap; value += it.val; }
    return { failed: false, private: false, rap, value, count: items.length, top, thumbs };
  }
  async function loadValue(userId) {
    const [pa, roli] = await Promise.all([
      swMsg({ action: 'fetchRolimonsPlayerAssets', userId }),
      swMsg({ action: 'fetchRolimonsForRAC' })
    ]);
    const rmap = (roli && roli.ok && roli.data) ? roli.data : {};

    // 1) Rolimons playerassets → { itemId: [uaids] | count }
    if (pa && pa.ok && pa.playerassets && Object.keys(pa.playerassets).length) {
      const items = [];
      for (const [idRaw, v] of Object.entries(pa.playerassets)) {
        const r = rmap[idRaw] || rmap[String(idRaw)];
        if (!r) continue;
        const count = Array.isArray(v) ? v.length : (Number(v) > 0 ? Number(v) : 1);
        const itemRap = r[2] > 0 ? r[2] : 0;
        const itemVal = r[3] > 0 ? r[3] : itemRap;   // Rolimons value[3] = -1 ise RAP'e dus
        if (itemRap > 0 || itemVal > 0) {
          items.push({ id: idRaw, name: r[0] || ('#' + idRaw), val: itemVal * count, rap: itemRap * count });
        }
      }
      if (items.length) return await finalizeValue(items);
    }

    // 2) Fallback: derin UGC tarama
    const lim = await swMsg({ action: 'fetchUserAllLimiteds', userId });
    if (!lim || !lim.ok || !Array.isArray(lim.limiteds)) {
      return { failed: true, private: !!(lim && lim.diag && lim.diag.privateInventory) };
    }
    const items = [];
    for (const it of lim.limiteds) {
      const r = rmap[it.assetId] || rmap[String(it.assetId)];
      const itemRap = (r && r[2] > 0) ? r[2] : (it.lowestPrice || 0);
      const itemVal = (r && r[3] > 0) ? r[3] : itemRap;
      if (itemRap > 0 || itemVal > 0) items.push({ id: it.assetId, name: (r && r[0]) || it.name || ('#' + it.assetId), val: itemVal, rap: itemRap });
    }
    if (!items.length) return { failed: false, private: !!(lim.diag && lim.diag.privateInventory), rap: 0, value: 0, count: 0, top: [], thumbs: {} };
    return await finalizeValue(items);
  }

  // ── Stiller (frosted floating kart, themes ile uyumlu) ──
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${PANEL_ID}{position:fixed;right:16px;top:88px;width:300px;max-height:calc(100vh - 110px);overflow-y:auto;box-sizing:border-box;padding:0;background:linear-gradient(180deg,rgba(20,20,26,.93),rgba(15,15,20,.96));backdrop-filter:blur(28px) saturate(1.4);-webkit-backdrop-filter:blur(28px) saturate(1.4);border:1px solid rgba(255,255,255,.10);border-radius:14px;color:rgba(255,255,255,.88);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.45;box-shadow:0 8px 40px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05);z-index:9000;animation:tpi-in .35s cubic-bezier(.4,0,.2,1) both;}
      #${PANEL_ID}{scrollbar-width:none;-ms-overflow-style:none;transition:width .2s ease,height .2s ease;}
      #${PANEL_ID}::-webkit-scrollbar{display:none;width:0;height:0;}
      @keyframes tpi-in{from{opacity:0;transform:translateX(18px);}to{opacity:1;transform:none;}}
      /* Küçültülmüş hâl — kare ikon (tıkla → büyüt) */
      #${PANEL_ID}.tpi-min{width:46px!important;height:46px!important;max-height:46px!important;overflow:hidden!important;cursor:pointer;padding:0;}
      #${PANEL_ID}.tpi-min .tpi-body{display:none!important;}
      #${PANEL_ID}.tpi-min .tpi-head{padding:0!important;height:100%!important;border-bottom:none!important;justify-content:center!important;}
      #${PANEL_ID}.tpi-min .tpi-title span,#${PANEL_ID}.tpi-min .tpi-min-btn{display:none!important;}
      #${PANEL_ID}.tpi-min .tpi-title{gap:0!important;}
      #${PANEL_ID}.tpi-min .tpi-title svg{width:21px!important;height:21px!important;opacity:.95;}
      #${PANEL_ID}.tpi-min:hover{filter:brightness(1.16);}
      .tpi-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06);}
      .tpi-title{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:650;color:rgba(255,255,255,.95);letter-spacing:.015em;}
      .tpi-title svg{opacity:.85;}
      .tpi-min-btn{background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;width:24px;height:24px;padding:0;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,color .15s;}
      .tpi-min-btn:hover{background:rgba(255,255,255,.1);color:#fff;}
      .tpi-min-btn:active{transform:scale(.92);}
      .tpi-min-btn svg{display:block;}
      .tpi-body{padding:10px 14px 14px;}
      .tpi-sec{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);}
      .tpi-sec:last-child{border-bottom:none;padding-bottom:2px;}
      .tpi-sec-label{font-size:9.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:rgba(255,255,255,.40);margin-bottom:7px;display:flex;align-items:center;gap:5px;}
      .tpi-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:2px 0;}
      .tpi-row .k{color:rgba(255,255,255,.62);font-size:11.5px;}
      .tpi-row .v{font-weight:650;color:rgba(255,255,255,.95);font-size:12.5px;font-variant-numeric:tabular-nums;text-align:right;}
      .tpi-row .v small{font-weight:500;color:rgba(255,255,255,.5);font-size:10px;}
      .tpi-stat3{display:flex;gap:6px;}
      .tpi-stat3 .cell{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:9px;padding:7px 4px;text-align:center;}
      .tpi-stat3 .cell .num{font-weight:750;font-size:14px;color:#fff;font-variant-numeric:tabular-nums;}
      .tpi-stat3 .cell .lbl{font-size:9px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.4px;margin-top:1px;}
      .tpi-val-big{display:flex;align-items:center;font-size:18px;font-weight:800;color:#fff;}
      .tpi-tops{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}
      .tpi-top{flex:0 0 auto;width:52px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:4px;text-align:center;}
      .tpi-top img{width:44px;height:44px;border-radius:6px;object-fit:cover;background:rgba(0,0,0,.2);display:block;margin:0 auto;}
      .tpi-top .tv{font-size:9px;font-weight:700;color:#fff;margin-top:2px;display:flex;align-items:center;justify-content:center;}
      .tpi-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px;}
      .tpi-chip{font-size:10px;font-weight:600;padding:3px 8px;border-radius:7px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.82);}
      .tpi-chip.good{background:rgba(48,209,88,.12);border-color:rgba(48,209,88,.3);color:#5fe389;}
      .tpi-chip.warn{background:rgba(255,214,10,.12);border-color:rgba(255,214,10,.3);color:#ffd60a;}
      .tpi-chip.blue{background:rgba(10,132,255,.14);border-color:rgba(10,132,255,.32);color:#5aa6ff;}
      .tpi-pres{display:flex;align-items:center;gap:7px;margin-top:7px;padding:8px 9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:9px;}
      .tpi-pres .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
      .tpi-pres.t2 .dot{background:#30D158;box-shadow:0 0 7px rgba(48,209,88,.55);} .tpi-pres.t1 .dot{background:#0A84FF;} .tpi-pres.t0 .dot,.tpi-pres.t4 .dot{background:rgba(255,255,255,.3);} .tpi-pres.t3 .dot{background:#FF9F0A;}
      .tpi-pres .pinfo{flex:1;min-width:0;} .tpi-pres .pst{font-size:11px;font-weight:650;color:#fff;} .tpi-pres .ploc{font-size:10px;color:rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .tpi-join{display:inline-flex;align-items:center;gap:4px;background:#0A84FF;border:none;color:#fff;font-weight:700;font-size:10.5px;padding:5px 10px;border-radius:7px;cursor:pointer;flex-shrink:0;transition:filter .15s,transform .08s;}
      .tpi-join:hover{filter:brightness(1.12);} .tpi-join:active{transform:scale(.96);}
      .tpi-mutual-names{font-size:10px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}
      .tpi-muted{color:rgba(255,255,255,.45);font-size:11px;}
      .tpi-sk{display:inline-block;height:11px;border-radius:4px;background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06));background-size:200% 100%;animation:tpi-sh 1.3s infinite;}
      @keyframes tpi-sh{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
      .tpi-link{color:#5aa6ff;text-decoration:none;font-size:10.5px;} .tpi-link:hover{text-decoration:underline;}
      @media (prefers-reduced-motion: reduce){#${PANEL_ID},.tpi-sk{animation:none!important;}}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  // ── Render ──
  // st: { userId, insight, value, mutual, self }
  function sectionKunye(st) {
    const ins = st.insight;
    if (!ins) return `<div class="tpi-row"><span class="k">${t('piAccountAge', 'Hesap yaşı')}</span><span class="v"><span class="tpi-sk" style="width:60px"></span></span></div>`;
    if (!ins.user) return `<div class="tpi-muted">${t('piNoData', 'Bilgi alınamadı')}</div>`;
    const age = accountAge(ins.user.created);
    const names = (ins.usernameHistory || []).filter(n => n && n !== ins.user.name);
    const verified = ins.user.hasVerifiedBadge ? ` ${ICON_VERIFIED}` : '';
    let html = '';
    html += `<div class="tpi-row"><span class="k">${t('piAccountAge', 'Hesap yaşı')}</span><span class="v">${fmtAge(age)}</span></div>`;
    if (age) html += `<div class="tpi-row"><span class="k">${t('piCreated', 'Oluşturma')}</span><span class="v"><small>${escapeHtml(fmtDate(age.created))}</small></span></div>`;
    html += `<div class="tpi-row"><span class="k">${t('piUsername', 'Kullanıcı adı')}</span><span class="v">@${escapeHtml(ins.user.name)}${verified}</span></div>`;
    if (ins.user.isBanned) html += `<div class="tpi-chips"><span class="tpi-chip warn">${t('piBanned', 'Hesap banlı')}</span></div>`;
    if (names.length) {
      const shown = names.slice(0, 3).map(escapeHtml).join(', ');
      const extra = names.length > 3 ? ` +${names.length - 3}` : '';
      html += `<div class="tpi-row"><span class="k">${t('piOldNames', 'Eski adlar')}</span><span class="v"><small>${shown}${extra}</small></span></div>`;
    }
    return html;
  }
  function sectionValue(st) {
    const v = st.value;
    if (v === undefined) return `<div class="tpi-val-big"><span class="tpi-sk" style="width:90px;height:18px"></span></div>`;
    if (!v || v.failed) {
      if (v && v.private) return `<div class="tpi-muted">${t('piPrivateInv', 'Envanter gizli')}</div>`;
      return `<div class="tpi-muted">${t('piValueUnavail', 'Değer verisi yok')}</div>`;
    }
    let html = '';
    html += `<div class="tpi-row"><span class="k">${t('piValue', 'Tahmini değer')}</span><span class="v tpi-val-big" style="font-size:16px">${ICON_ROBUX}${abbrev(v.value)}</span></div>`;
    html += `<div class="tpi-row"><span class="k">RAP</span><span class="v">${ICON_ROBUX}${abbrev(v.rap)}</span></div>`;
    html += `<div class="tpi-row"><span class="k">${t('piLimitedCount', 'Limited sayısı')}</span><span class="v">${abbrev(v.count)}</span></div>`;
    if (v.top && v.top.length) {
      html += `<div class="tpi-tops">` + v.top.map(it => {
        const img = v.thumbs && v.thumbs[String(it.id)];
        const thumb = img ? `<img src="${img}" alt="${escapeHtml(it.name)}" title="${escapeHtml(it.name)}">` : `<div style="width:100%;aspect-ratio:1;border-radius:6px;background:rgba(255,255,255,.05)"></div>`;
        return `<div class="tpi-top" title="${escapeHtml(it.name)}">${thumb}<div class="tv">${ICON_ROBUX}${abbrev(it.val)}</div></div>`;
      }).join('') + `</div>`;
    }
    html += `<div style="margin-top:7px"><a class="tpi-link" href="/users/${st.userId}/inventory" target="_blank" rel="noopener">${t('piViewInv', 'Envanteri gör →')}</a></div>`;
    return html;
  }
  function sectionSocial(st) {
    const ins = st.insight;
    let html = '';
    if (ins && ins.counts) {
      const c = ins.counts;
      html += `<div class="tpi-stat3">
        <div class="cell"><div class="num">${abbrev(c.friends)}</div><div class="lbl">${t('piFriends', 'Arkadaş')}</div></div>
        <div class="cell"><div class="num">${abbrev(c.followers)}</div><div class="lbl">${t('piFollowers', 'Takipçi')}</div></div>
        <div class="cell"><div class="num">${abbrev(c.followings)}</div><div class="lbl">${t('piFollowing', 'Takip')}</div></div>
      </div>`;
    } else {
      html += `<div class="tpi-stat3"><div class="cell"><div class="num"><span class="tpi-sk" style="width:24px"></span></div></div><div class="cell"><div class="num"><span class="tpi-sk" style="width:24px"></span></div></div><div class="cell"><div class="num"><span class="tpi-sk" style="width:24px"></span></div></div></div>`;
    }
    // Ortak arkadaş — sadece sayı (isim örneği kaldırıldı; taşma/"..." sorunu biter)
    if (st.mutual !== undefined && st.mutual && st.mutual.ok && !st.mutual.self && typeof st.mutual.mutual === 'number') {
      html += `<div class="tpi-row" style="margin-top:6px"><span class="k">${t('piMutual', 'Ortak arkadaş')}</span><span class="v">${st.mutual.mutual}</span></div>`;
    }
    // Presence
    if (ins && ins.presence) {
      const p = ins.presence;
      const tmap = { 0: t('piOffline', 'Çevrimdışı'), 1: t('piOnline', 'Çevrimiçi'), 2: t('piInGame', 'Oyunda'), 3: t('piInStudio', 'Studio'), 4: t('piOffline', 'Çevrimdışı') };
      const label = tmap[p.type] || t('piOffline', 'Çevrimdışı');
      const loc = p.lastLocation ? `<div class="ploc" title="${escapeHtml(p.lastLocation)}">${escapeHtml(p.lastLocation)}</div>` : '';
      const canJoin = p.type === 2 && p.placeId;
      const joinBtn = canJoin ? `<button class="tpi-join" data-join-place="${p.placeId}" data-join-game="${p.gameId || ''}">${ICON_PLAY}${t('piJoin', 'Katıl')}</button>` : '';
      html += `<div class="tpi-pres t${p.type}"><span class="dot"></span><div class="pinfo"><div class="pst">${label}</div>${loc}</div>${joinBtn}</div>`;
    }
    return html;
  }
  function sectionTrust(st) {
    if (st.self) return ''; // kendi profilinde vetting gereksiz
    const ins = st.insight; if (!ins || !ins.user) return '';
    const chips = [];
    const age = accountAge(ins.user.created);
    if (age) {
      if (age.days < 30) chips.push(`<span class="tpi-chip warn">${t('piNewAcc', 'Yeni hesap')}: ${age.days} ${t('piDay', 'gün')}</span>`);
      else if (age.months >= 60) chips.push(`<span class="tpi-chip good">${Math.floor(age.months / 12)}+ ${t('piYear', 'yıl')} ${t('piAccount', 'hesap')}</span>`);
    }
    if (ins.user.hasVerifiedBadge) chips.push(`<span class="tpi-chip blue">${t('piVerified', 'Doğrulanmış')}</span>`);
    if (st.value && !st.value.failed && st.value.value >= 100000) chips.push(`<span class="tpi-chip good">${t('piHighValue', 'Yüksek değerli envanter')}</span>`);
    if (ins.badges && (ins.badges.count > 0 || ins.badges.hasMore)) chips.push(`<span class="tpi-chip">${ins.badges.hasMore ? '100+' : ins.badges.count} ${t('piBadges', 'rozet')}</span>`);
    if (!chips.length) return '';
    return `<div class="tpi-chips">${chips.join('')}</div>`;
  }

  function render(st) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      document.body.appendChild(panel);
      // Küçükken panele tıklayınca büyüt (panel-level, kalıcı dinleyici)
      panel.addEventListener('click', () => { if (_minimized) { _minimized = false; panel.classList.remove('tpi-min'); saveMin(false); } });
    }
    panel.innerHTML = `
      <div class="tpi-head">
        <div class="tpi-title">${ICON_USER}<span>${t('piTitle', 'Oyuncu İçgörüsü')}</span></div>
        <button class="tpi-min-btn" title="${t('piMinimize', 'Küçült')}">${ICON_MIN}</button>
      </div>
      <div class="tpi-body">
        <div class="tpi-sec"><div class="tpi-sec-label">${t('piSecId', 'Künye')}</div>${sectionKunye(st)}</div>
        <div class="tpi-sec"><div class="tpi-sec-label">${t('piSecValue', 'Değer')}</div>${sectionValue(st)}</div>
        <div class="tpi-sec"><div class="tpi-sec-label">${t('piSecSocial', 'Sosyal')}</div>${sectionSocial(st)}</div>
        ${(!st.self && st.insight && st.insight.user) ? `<div class="tpi-sec"><div class="tpi-sec-label">${t('piSecTrust', 'Güven Sinyalleri')}</div>${sectionTrust(st)}</div>` : ''}
      </div>
    `;
    // Küçültülmüş durumu re-render'larda koru
    panel.classList.toggle('tpi-min', _minimized);
    panel.querySelector('.tpi-min-btn')?.addEventListener('click', (e) => { e.stopPropagation(); _minimized = true; panel.classList.add('tpi-min'); saveMin(true); });
    panel.querySelector('.tpi-join')?.addEventListener('click', (e) => {
      const b = e.currentTarget; const pid = b.dataset.joinPlace; const gid = b.dataset.joinGame;
      if (!pid) return;
      try { swMsg({ action: 'saveActiveSession', placeId: String(pid), jobId: gid || null, gameTitle: 'Profile Join' }); } catch (_) {}
      location.href = gid
        ? `roblox://experiences/start?placeId=${pid}&gameInstanceId=${encodeURIComponent(gid)}`
        : `https://www.roblox.com/games/${pid}/`;
    });
  }

  // ── Akış ──
  let _curId = null;
  let _minimized = false; // küçültülmüş hâl profil geçişlerinde korunur

  async function init() {
    const userId = getProfileUserId();
    if (!userId) { document.getElementById(PANEL_ID)?.remove(); _curId = null; return; }
    if (userId === _curId) return;
    _curId = userId;

    // Kayıtlı küçültme durumu + dil (locale) — ilk render'dan ÖNCE oku
    try {
      const d = await chrome.storage.local.get(['rota_settings', MIN_KEY]);
      _minimized = !!d[MIN_KEY];
      if (typeof TrackedI18n !== 'undefined' && d?.rota_settings?.language) TrackedI18n.setLocale(d.rota_settings.language);
    } catch (_) {}

    injectStyles();
    const st = { userId, insight: undefined, value: undefined, mutual: undefined, self: false };
    render(st); // skeleton

    // 1) Künye + sosyal + presence (hızlı)
    swMsg({ action: 'getUserProfileInsight', userId }).then(r => {
      if (_curId !== userId) return;
      st.insight = r || { user: null };
      render(st);
    });
    // 2) Ortak arkadaş (ayrı, self bilgisini de getirir)
    swMsg({ action: 'getMutualFriendCount', userId }).then(r => {
      if (_curId !== userId) return;
      st.mutual = r || { ok: false };
      if (r && r.self) st.self = true;
      render(st);
    });
    // 3) Değer (yavaş — envanter taraması)
    loadValue(userId).then(v => {
      if (_curId !== userId) return;
      st.value = v;
      render(st);
    }).catch(() => { if (_curId === userId) { st.value = { failed: true }; render(st); } });
  }

  // ── SPA navigasyon (catalog_enhancer deseni) ──
  function watchNavigation() {
    let lastUrl = location.href, debounce;
    const trigger = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { if (location.href !== lastUrl) { lastUrl = location.href; init(); } }, 300);
    };
    window.addEventListener('popstate', trigger);
    window.addEventListener('hashchange', trigger);
    new MutationObserver(trigger).observe(document.body, { childList: true, subtree: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); watchNavigation(); });
  } else {
    init(); watchNavigation();
  }
})();
