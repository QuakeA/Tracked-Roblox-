# Tracked — Chrome Web Store Listeleme Metni & Yayın Kontrol Listesi

> Bu dosya mağaza panosuna kopyalanacak hazır metinleri içerir. Görseller (ekran görüntüleri/promo) ayrı hazırlanmalı.

---

## 1. Temel alanlar

**İsim (Name):** `Tracked - Roblox Route Optimizer` (32/45 karakter — uygun)

**Kategori (Category):** Tools (Araçlar)

**Kısa açıklama / Summary (TR, ≤132 karakter):**
```
Roblox için en yakın sunucuyu bul, gerçek ping ölç, bölge tespit et, sunucu bekçisi ve daha fazlası. Yarısı ücretsiz.
```

**Short description / Summary (EN, ≤132 chars):**
```
Find the nearest Roblox server, measure real ping, detect regions, server watcher and more. Half free, half Plus.
```

**Tek amaç beyanı / Single purpose (Chrome zorunlu):**
```
Roblox oyuncularının en düşük gecikmeli/en yakın sunucuya bağlanmasına ve sunucu bilgilerini görmesine yardımcı olmak.
(EN) Help Roblox players connect to the lowest-latency / nearest server and view server information.
```

---

## 2. Detaylı açıklama (Detailed description)

### TR
```
Tracked, Roblox deneyimini hızlandıran bir "rota/bağlantı optimize edici"dir. Gerçek ölçümlere dayanır — uydurma veri yoktur.

— ÜCRETSİZ —
• Oyun ID kopyalama
• Oyun kütüphanesi & favoriler
• Sunucu bilgi etiketleri
• En yakın açık sunucuya katıl
• Bölgesel gerçek ping ölçümü (AWS uç noktalarına median gecikme)
• IP tabanlı yaklaşık konum ile en yakın bölge tespiti
• VPN/proxy tespiti
• "Şu An Çalıyor" müzik widget'ı (YouTube/Spotify) — çalan şarkıyı göster & kontrol et

— TRACKED PLUS (abonelik) —
• Gelişmiş sunucu araçları: Yeni sunucu bul · Derin tarama · Sunucu Bekçisi (kriterli sunucu açılınca bildir/oto-katıl)
• Oto-Pilot: en yakın sunucuya otomatik bağlan
• Auto-Reconnect: atılınca otomatik yeniden bağlan
• Envanter değeri analizi
• Site temaları + wallpaper
• Oyun Kodları paneli
• Etkinlik analizi

Gizlilik: Tracked'in backend'i YOKTUR. Ayarların ve geçmişin yalnızca cihazında tutulur; hiçbir veri geliştiriciye gönderilmez veya satılmaz. Ödeme Lemon Squeezy üzerinden güvenli yapılır.

7 gün ücretsiz dene. İstediğin zaman iptal et.
```

### EN
```
Tracked is a "route / connection optimizer" that speeds up your Roblox experience. It is built on real measurements — no fabricated data.

— FREE —
• Copy game ID
• Game library & favorites
• Server info tags
• Join the nearest open server
• Real regional ping measurement (median latency to AWS endpoints)
• Nearest-region detection via approximate IP location
• VPN/proxy detection
• "Now Playing" music widget (YouTube/Spotify) — show & control the current track

— TRACKED PLUS (subscription) —
• Advanced server tools: Find new server · Deep scan · Server Watcher (notify/auto-join when a matching server opens)
• Auto-Pilot: auto-connect to the nearest server
• Auto-Reconnect: rejoin automatically after a disconnect
• Inventory value analysis
• Site themes + wallpaper
• Game codes panel
• Event analysis

Privacy: Tracked has NO backend. Your settings and history stay on your device; no data is sent to the developer or sold. Payments are handled securely by Lemon Squeezy.

7-day free trial. Cancel anytime.
```

---

## 3. İzin gerekçeleri (Permission justifications — inceleme formu)

| İzin | Gerekçe (TR) | Justification (EN) |
|---|---|---|
| `storage` / `unlimitedStorage` | Ayarları, favorileri ve ping geçmişini cihazda saklamak | Store settings, favorites and ping history locally |
| `tabs` | Sunucuya katılmayı tetiklemek ve çalan medya sekmesini tespit etmek | Trigger server joins and detect the active media tab |
| `activeTab` / `scripting` | Roblox sayfasına arayüzü (bar/panel) eklemek ve yerel oyun başlatıcıyı çağırmak | Add in-page UI to Roblox and invoke the native game launcher |
| `declarativeNetRequestWithHostAccess` | Çapraz-köken API okumalarında CORS başlıklarını düzeltmek (cors_rules.json) | Fix CORS headers for cross-origin API reads |
| `alarms` | Sunucu Bekçisi ve arka plan kontrolleri | Server Watcher and background checks |
| `notifications` | Bekçi / yeniden bağlanma uyarıları | Watcher / reconnect alerts |
| `sidePanel` | Paneli Chrome yan paneline sabitlemek | Pin the panel to Chrome's side panel |
| `windows` | Katılma akışında pencere yönetimi | Window management during join flow |
| Host: `*.roblox.com` | Sunucu listesi, oyun/kullanıcı bilgisi, katılma (çekirdek) | Core: server lists, game/user info, joining |
| Host: geniş (`*/*`) | Ping ölçüm noktaları (AWS/Cloudflare), IP-konum (geojs/ipapi/ipinfo), item değerleri (Rolimons), lisans (Lemon Squeezy), müzik (YouTube/Spotify) | Ping endpoints, IP-geo, item values, license, music services |

> ⚠ **ÖNEMLİ (aşağıdaki §5'e bak):** Geniş `*/*` host izni inceleme riskini ARTIRIR. Mümkünse spesifik host listesine daraltılmalı.

---

## 4. Veri kullanımı beyanı (Data practices formu — örnek cevaplar)
- Kişisel veri **toplanmıyor / satılmıyor / geliştiriciye gönderilmiyor**.
- Konum: yaklaşık (IP tabanlı), yalnızca bölge optimizasyonu için, üçüncü taraf geo servisine gönderilir.
- Kimlik doğrulama bilgisi: yalnızca girilen lisans anahtarı (Lemon Squeezy doğrulaması).
- Veriler cihazda yerel; uzaktan saklama yok.
- Gizlilik politikası URL'si: **[privacy.html'i hostladığın adres]** (örn. GitHub Pages).

---

## 5. YAYIN ÖNCESİ KONTROL LİSTESİ

### Zorunlu blokerler
- [ ] **Lemon Squeezy:** ürün + aylık/yıllık varyant + 7 gün deneme + **License Keys** aç.
- [ ] `REPLACE-ME` → gerçek checkout URL: **plus.js**, **license_client.js**, **options.js** (3 yer).
- [ ] **Lisans akışını uçtan uca test et:** gerçek anahtar → plus.html "Aktive Et" → kilitler açılıyor mu, çevrimdışı pay çalışıyor mu.
- [ ] **privacy.html'i bir URL'de host et** (GitHub Pages/Netlify) + içindeki iletişim e-postasını doldur.
- [ ] Mağaza **ekran görüntüleri** (1280×800, 1-5 adet) + küçük tanıtım görseli (440×280).
- [ ] **Manifest açıklamasını güncelle** (Plus/abonelikten bahset, eski "v1.9.5 ..." metnini sadeleştir).

### Güçlü öneriler
- [ ] **Host iznini daralt:** `*/*` yerine spesifik liste (roblox, rbxcdn, amazonaws, cloudflare, geojs.io, ipapi.co, ipinfo.io, rolimons, api.lemonsqueezy.com, youtube, spotify). → "tüm sitelere erişim" uyarısı kalkar, inceleme hızlanır.
- [ ] **Konumlandırma:** "yardımcı/optimize edici" dilini öne çıkar; oto-katıl/sunucu-zıplamayı "kolaylık" olarak çerçevele (botlama değil).
- [ ] İlk sürümü **Unlisted** yayınla → birkaç kullanıcıyla test → sonra Public.

### Riskler (bilinçli ol)
- Roblox otomasyon hassasiyeti (oto-katıl, arka plan tarama). Chrome + Roblox politikası açısından izlenmeli.
- Ücretli + geniş izin = daha sıkı/yavaş inceleme.
```
