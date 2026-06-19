// plus.js — Tracked Plus yükseltme ekranı. SW license.js handler'larına konuşur
// (licenseGet / licenseActivate / licenseDeactivate). EN/TR dilli; veri çekmez.

// TODO: Lemon Squeezy ürünü açılınca GERÇEK checkout URL'i buraya:
var CHECKOUT_URL = 'https://tracked.lemonsqueezy.com/buy/REPLACE-ME';

var $ = function (id) { return document.getElementById(id); };
var lang = 'en';

var STR = {
  en: {
    free: 'Free plan', active: 'Tracked Plus active', expired: 'Subscription expired',
    subStart: 'Start 7-day trial', subManage: 'Manage subscription', lic: 'License: ',
    enterKey: 'Enter your license key.', verifying: 'Verifying…',
    activated: 'Activated — Tracked Plus is on!',
    notActive: 'Key is valid but the subscription is not active (status: ',
    failed: 'Activation failed. Check the key.', deactivated: 'License removed from this device.',
    confirm: 'Remove the license from this device?', home: '← Home'
  },
  tr: {
    free: 'Ücretsiz sürüm', active: 'Tracked Plus aktif', expired: 'Aboneliğin süresi dolmuş',
    subStart: '7 günlük denemeyi başlat', subManage: 'Aboneliği Yönet', lic: 'Lisans: ',
    enterKey: 'Lisans anahtarı gir.', verifying: 'Doğrulanıyor…',
    activated: 'Aktive edildi — Tracked Plus açık!',
    notActive: 'Anahtar geçerli ama abonelik aktif değil (durum: ',
    failed: 'Aktivasyon başarısız. Anahtarı kontrol et.', deactivated: 'Lisans bu cihazdan çıkarıldı.',
    confirm: 'Lisansı bu cihazdan çıkarmak istediğine emin misin?', home: '← Ana sayfa'
  }
};
function L(k) { return STR[lang][k]; }

function msg(t, cls) { var m = $('plus-msg'); if (!m) return; m.textContent = t; m.className = 'plus-msg ' + (cls || ''); }

function loadStatus() {
  try {
    chrome.runtime.sendMessage({ action: 'licenseGet' }, function (r) {
      if (chrome.runtime.lastError) r = null;
      var isPlus = !!(r && r.isPlus), status = (r && r.status) || 'free';
      var pill = $('status-pill'), txt = $('status-text');
      if (pill) pill.classList.toggle('active', isPlus);
      if (txt) txt.textContent = isPlus ? L('active') : (status === 'expired' ? L('expired') : L('free'));
      if ($('plus-name')) $('plus-name').textContent = (r && r.name) ? (L('lic') + r.name) : '';
      if ($('plus-deactivate')) $('plus-deactivate').style.display = (r && r.hasKey) ? '' : 'none';
      if (r && r.hasKey && r.keyMasked && $('plus-key')) $('plus-key').placeholder = r.keyMasked;
      var sub = $('btn-subscribe'), lbl = sub && sub.querySelector('span');
      if (lbl) lbl.textContent = isPlus ? L('subManage') : L('subStart');
    });
  } catch (_) {}
}

function activate() {
  var key = ($('plus-key').value || '').trim();
  if (!key) { msg(L('enterKey'), 'err'); return; }
  msg(L('verifying'), ''); $('plus-activate').disabled = true;
  try {
    chrome.runtime.sendMessage({ action: 'licenseActivate', key: key }, function (r) {
      if (chrome.runtime.lastError) r = null;
      $('plus-activate').disabled = false;
      if (r && r.ok && r.isPlus) { msg(L('activated'), 'ok'); $('plus-key').value = ''; }
      else if (r && r.ok) msg(L('notActive') + (r.status || '?') + ').', 'err');
      else msg((r && r.error) || L('failed'), 'err');
      loadStatus();
    });
  } catch (_) { $('plus-activate').disabled = false; msg(L('failed'), 'err'); }
}

function deactivate() {
  if (!confirm(L('confirm'))) return;
  try { chrome.runtime.sendMessage({ action: 'licenseDeactivate' }, function () { msg(L('deactivated'), ''); loadStatus(); }); } catch (_) {}
}

function openCheckout() { try { window.open(CHECKOUT_URL, '_blank', 'noopener'); } catch (_) {} }

function setLang(l) {
  lang = l; document.documentElement.lang = l;
  document.querySelectorAll('[data-en]').forEach(function (e) {
    var t = e.getAttribute('data-' + l); if (t !== null) e.textContent = t;
  });
  if ($('lg-en')) $('lg-en').classList.toggle('on', l === 'en');
  if ($('lg-tr')) $('lg-tr').classList.toggle('on', l === 'tr');
  if ($('t-home')) $('t-home').textContent = L('home');
  try { localStorage.setItem('tk_lang', l); } catch (_) {}
  loadStatus(); // durum metnini yeni dilde tekrar uygula (data-en varsayılanını ezer)
}

function setupReveal() {
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(function (e) { io.observe(e); });
}

document.addEventListener('DOMContentLoaded', function () {
  setupReveal();
  setLang((function () { try { return localStorage.getItem('tk_lang') || 'en'; } catch (_) { return 'en'; } })());
  if ($('btn-subscribe')) $('btn-subscribe').addEventListener('click', openCheckout);
  if ($('plus-activate')) $('plus-activate').addEventListener('click', activate);
  if ($('plus-key')) $('plus-key').addEventListener('keydown', function (e) { if (e.key === 'Enter') activate(); });
  if ($('plus-deactivate')) $('plus-deactivate').addEventListener('click', deactivate);
  try { chrome.storage.onChanged.addListener(function (ch, area) { if (area === 'local' && ch.tracked_license) loadStatus(); }); } catch (_) {}
});
