// plus.js — Tracked Plus özel yükseltme ekranı (kilitler buraya yönlenir).
// Lisans aktivasyonu SW license.js handler'larına konuşur (licenseGet/Activate/Deactivate).

// TODO: Lemon Squeezy ürünü açılınca GERÇEK checkout URL'i buraya:
const CHECKOUT_URL = 'https://tracked.lemonsqueezy.com/buy/REPLACE-ME';

const $ = (id) => document.getElementById(id);

// Free/Plus karşılaştırma — Plus tüm satırlarda var; free: temel özellikler
const FEATURES = [
  { f: 'Oyun ID kopyalama', free: true },
  { f: 'Oyun kütüphanesi & favoriler', free: true },
  { f: 'Sunucu bilgi etiketleri', free: true },
  { f: 'En yakın sunucuya katıl', free: true },
  { f: 'Gelişmiş sunucu araçları', sub: 'Yeni sunucu bul · Derin tarama · Sunucu Bekçisi', free: false },
  { f: 'Oto-Pilot', sub: 'En yakın sunucuya otomatik bağlan', free: false },
  { f: 'Auto-Reconnect', sub: 'Atılınca otomatik yeniden bağlan', free: false },
  { f: 'Şu An Çalıyor müzik widget\'ı', sub: 'Çalan şarkıyı göster & kontrol et', free: false },
  { f: 'Trade analizi', sub: 'RAP / değer / canlı floor', free: false },
  { f: 'Envanter değeri analizi', free: false },
  { f: 'Site temaları + wallpaper', free: false },
  { f: 'Oyun Kodları paneli', free: false },
  { f: 'Etkinlik analizi', free: false },
];

const IC_YES = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="ic-yes"><path d="M20 6 9 17l-5-5"/></svg>';
const IC_NO  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="ic-no"><line x1="5" y1="12" x2="19" y2="12"/></svg>';

function buildCmp() {
  const head = '<div class="cmp-head"><span>Özellik</span><span class="h-free">Ücretsiz</span><span class="h-plus">Plus</span></div>';
  const rows = FEATURES.map(it =>
    '<div class="cmp-row">' +
      '<span class="feat">' + it.f + (it.sub ? '<small>' + it.sub + '</small>' : '') + '</span>' +
      '<span class="c">' + (it.free ? IC_YES : IC_NO) + '</span>' +
      '<span class="c c-plus on">' + IC_YES + '</span>' +
    '</div>'
  ).join('');
  $('cmp').innerHTML = head + rows;
}

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

  const sub = $('btn-subscribe');
  if (sub && sub.lastChild && sub.lastChild.nodeType === 3) {
    sub.lastChild.textContent = isPlus ? ' Aboneliği Yönet' : ' Aboneliği Başlat';
  }
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

document.addEventListener('DOMContentLoaded', () => {
  buildCmp();
  loadStatus();
  $('btn-subscribe')?.addEventListener('click', openCheckout);
  $('plus-activate')?.addEventListener('click', activate);
  $('plus-key')?.addEventListener('keydown', e => { if (e.key === 'Enter') activate(); });
  $('plus-deactivate')?.addEventListener('click', deactivate);
  // Lisans durumu değişince (başka sekmede aktive) tazele
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.tracked_license) loadStatus(); }); } catch (_) {}
});
