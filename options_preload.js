// Toggle FOUC önleme — ayarlar yüklenene kadar toggle'ları gizle (tk-pre).
// <head>'de, body'den ÖNCE çalışır → toggle'lar PAINT olmadan gizlenir.
// options.js, loadSettings() bitince tk-pre'yi kaldırır (toggle'lar statik-doğru belirir).
// 1.5sn güvence: bir aksilikte bile toggle'lar gizli kalmaz.
// NOT: inline <script> extension CSP'sine (script-src 'self') takıldığı için AYRI dosya.
document.documentElement.classList.add('tk-pre');
setTimeout(function () { document.documentElement.classList.remove('tk-pre'); }, 1500);
