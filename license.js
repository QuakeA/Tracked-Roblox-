// license.js — Tracked Plus aboneliği (Lemon Squeezy lisans doğrulama). Service worker tarafı.
// Backend YOK: Lemon Squeezy "License API" (activate/validate/deactivate) lisans anahtarıyla doğrudan çağrılır
// (gizli API anahtarı GEREKMEZ). Durum chrome.storage.local'da; isPlus + çevrimdışı pay + periyodik yeniden doğrulama.
'use strict';
(function () {
  const LS = 'https://api.lemonsqueezy.com/v1/licenses';
  const KEY = 'tracked_license';
  const GRACE_MS = 7 * 24 * 60 * 60 * 1000; // doğrulama yapılamazsa (çevrimdışı) bu kadar süre son durumu koru

  async function getState() { try { const d = await chrome.storage.local.get(KEY); return d[KEY] || null; } catch (_) { return null; } }
  async function setState(s) { try { await chrome.storage.local.set({ [KEY]: s }); } catch (_) {} self._tkLic = s; }

  // Abonelik aktifse (trial dahil) LS lisans durumu 'active' olur.
  function isPlus(s) {
    if (!s || !s.key) return false;
    if (s.valid && s.status === 'active') return true;
    // Çevrimdışı pay: en son 'active' doğrulamadan beri GRACE içindeyse, iptal/expired/disabled değilse koru
    if (s.lastActive && (Date.now() - (s.validatedAt || 0)) < GRACE_MS && s.status !== 'expired' && s.status !== 'disabled') return true;
    return false;
  }

  async function lsPost(path, params) {
    const r = await fetch(`${LS}/${path}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });
    return r.json().catch(() => null);
  }

  async function activate(rawKey) {
    const key = String(rawKey || '').trim();
    if (!key) return { ok: false, error: 'Lisans anahtarı boş.' };
    const instName = 'tracked-' + ((self.crypto && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
    let res;
    try { res = await lsPost('activate', { license_key: key, instance_name: instName }); }
    catch (_) { return { ok: false, error: 'Ağ hatası — internet bağlantını kontrol et.' }; }
    if (res && res.activated && res.instance && res.license_key) {
      const lk = res.license_key;
      const s = { key, instanceId: res.instance.id, status: lk.status, valid: true, lastActive: lk.status === 'active', expiresAt: lk.expires_at || null, validatedAt: Date.now(), name: (res.meta && res.meta.customer_name) || '' };
      await setState(s);
      return { ok: true, isPlus: isPlus(s), status: s.status };
    }
    return { ok: false, error: (res && res.error) || 'Geçersiz lisans anahtarı veya aktivasyon limiti dolu.' };
  }

  async function validate() {
    const s = await getState();
    if (!s || !s.key) { self._tkLic = s; return false; }
    try {
      const res = await lsPost('validate', s.instanceId ? { license_key: s.key, instance_id: s.instanceId } : { license_key: s.key });
      if (res && typeof res.valid === 'boolean') {
        const lk = res.license_key || {};
        const ns = Object.assign({}, s, { status: lk.status || s.status, valid: res.valid, lastActive: (lk.status || s.status) === 'active', expiresAt: lk.expires_at || s.expiresAt, validatedAt: Date.now() });
        await setState(ns);
        return isPlus(ns);
      }
    } catch (_) { /* ağ hatası → çevrimdışı pay ile mevcut durumu koru */ }
    self._tkLic = s;
    return isPlus(s);
  }

  async function deactivate() {
    const s = await getState();
    if (s && s.key && s.instanceId) { try { await lsPost('deactivate', { license_key: s.key, instance_id: s.instanceId }); } catch (_) {} }
    await setState(null);
    return { ok: true };
  }

  const mask = (k) => k ? ('••••' + String(k).replace(/-/g, '').slice(-4)) : '';

  chrome.runtime.onMessage.addListener((req, sender, send) => {
    if (!req || !req.action) return;
    if (req.action === 'licenseGet') {
      getState().then(s => send({ ok: true, isPlus: isPlus(s), status: (s && s.status) || 'free', name: (s && s.name) || '', expiresAt: (s && s.expiresAt) || null, hasKey: !!(s && s.key), keyMasked: mask(s && s.key) }));
      return true;
    }
    if (req.action === 'licenseActivate') { activate(req.key).then(send); return true; }
    if (req.action === 'licenseValidate') { validate().then(p => send({ ok: true, isPlus: p })); return true; }
    if (req.action === 'licenseDeactivate') { deactivate().then(send); return true; }
  });

  // SW içinden Plus kontrolü (diğer modüller için): sync (önbellek) + async (storage)
  self.tkIsPlus = () => isPlus(self._tkLic);
  self.tkIsPlusAsync = async () => isPlus(await getState());

  // Periyodik yeniden doğrulama (12 saat) + açılışta bir kez
  try { chrome.alarms.create('tkLicenseRevalidate', { periodInMinutes: 720 }); } catch (_) {}
  chrome.alarms.onAlarm.addListener(a => { if (a && a.name === 'tkLicenseRevalidate') validate(); });
  validate();
})();
