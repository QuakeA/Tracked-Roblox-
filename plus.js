// plus.js — Tracked Plus özel yükseltme ekranı (kilitler buraya yönlenir).
// Lisans aktivasyonu SW license.js handler'larına konuşur (licenseGet/Activate/Deactivate).
// Karşılaştırma tablosu STATİK HTML (layout shift YOK). Animasyonlar: scroll-reveal.

// TODO: Lemon Squeezy ürünü açılınca GERÇEK checkout URL'i buraya:
const CHECKOUT_URL = 'https://tracked.lemonsqueezy.com/buy/REPLACE-ME';

const $ = (id) => document.getElementById(id);

function msg(t, cls) { const m = $('plus-msg'); if (!m) return; m.textContent = t; m.className = 'plus-msg ' + (cls || ''); }

async function loadStatus() {
  let r = null;
  try { r = await chrome.runtime.sendMessage({ action: 'licenseGet' }); } catch (_) {}
  const isPlus = !!(r && r.isPlus), status = (r && r.status) || 'free';
  const pill = $('status-pill'), txt = $('status-text');
  pill.classList.remove('active');
  if (isPlus) { pill.classList.add('active'); txt.textContent = 'Tracked Plus aktif'; }
  else if (status === 'expired') txt.textContent = 'Aboneliğin süresi dolmuş';
  else txt.textContent = 'Ücretsiz sürüm';

  $('plus-name').textContent = (r && r.name) ? ('Lisans: ' + r.name) : '';
  $('plus-deactivate').style.display = (r && r.hasKey) ? '' : 'none';
  if (r && r.hasKey && r.keyMasked) $('plus-key').placeholder = r.keyMasked;

  const sub = $('btn-subscribe'), lbl = sub && sub.querySelector('span');
  if (lbl) lbl.textContent = isPlus ? 'Aboneliği Yönet' : 'Aboneliği Başlat';
}

async function activate() {
  const key = ($('plus-key').value || '').trim();
  if (!key) { msg('Lisans anahtarı gir.', 'err'); return; }
  msg('Doğrulanıyor…', '');
  $('plus-activate').disabled = true;
  let r = null;
  try { r = await chrome.runtime.sendMessage({ action: 'licenseActivate', key }); } catch (_) {}
  $('plus-activate').disabled = false;
  if (r && r.ok && r.isPlus) { msg('Aktive edildi — Tracked Plus açık!', 'ok'); $('plus-key').value = ''; }
  else if (r && r.ok) msg('Anahtar geçerli ama abonelik aktif değil (durum: ' + (r.status || '?') + ').', 'err');
  else msg((r && r.error) || 'Aktivasyon başarısız. Anahtarı kontrol et.', 'err');
  loadStatus();
}

async function deactivate() {
  if (!confirm('Lisansı bu cihazdan çıkarmak istediğine emin misin?')) return;
  try { await chrome.runtime.sendMessage({ action: 'licenseDeactivate' }); } catch (_) {}
  msg('Lisans bu cihazdan çıkarıldı.', '');
  loadStatus();
}

function openCheckout() { try { window.open(CHECKOUT_URL, '_blank', 'noopener'); } catch (_) {} }

// Scroll-reveal — görünür alana giren .reveal öğeleri yumuşakça belirir (transform/opacity → CLS yok)
function setupReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  setupReveal();
  loadStatus();
  $('btn-subscribe')?.addEventListener('click', openCheckout);
  $('plus-activate')?.addEventListener('click', activate);
  $('plus-key')?.addEventListener('keydown', e => { if (e.key === 'Enter') activate(); });
  $('plus-deactivate')?.addEventListener('click', deactivate);
  // Lisans durumu başka sekmede değişince tazele
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.tracked_license) loadStatus(); }); } catch (_) {}
});
