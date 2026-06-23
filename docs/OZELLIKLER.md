# Tracked — Özellikler & Mimari Referansı

> **Bu dosya Claude (ve geliştirici) için iç referanstır.** Projedeki TÜM özellikler, ne işe yaradıkları,
> hangi dosyada/sayfada çalıştıkları ve teknik notlar burada. Unutunca buradan oku.
> Kök README.md pazarlama amaçlı ve **eski** (v1.8.0, kaldırılan A+B/C+D'den bahsediyor) — **güncel doğru kaynak budur.**
>
> Sürüm: 1.9.6 · Manifest V3 · Diller: TR (varsayılan) + EN ([i18n.js](../i18n.js))

---

## 0. Hızlı Dosya Haritası

| Dosya | Yüklendiği yer (manifest) | Ne yapar |
|---|---|---|
| `service_worker.js` | background | Tüm arka plan: CORS-bypass fetch, avatar render, free items, canlı etkinlik, auto-reconnect monitor, MAIN-world sunucu işlemleri, Rolimons/trade verisi, **sunucu bölge tespiti + bölgesel ping ölçümü** |
| `datacenters.js` | SW `importScripts('datacenters.js')` | Roblox datacenter **CIDR /24 prefix → şehir + koordinat** DB (kaynak: BTRoblox) + `ipToRegion`/`nearestDc`/`haversineKm` + **küresel ping probe listesi `TK_PING_PROBES`** (20 nokta, koordinatlı) |
| `lib/flags.js` + `lib/flags.css` + `lib/flags/*.svg` | `/games/*` content script + popup/options/sidepanel + `web_accessible_resources` | **Gerçek bayrak ikonları** (flag-icons 4x3 SVG, 22 ülke). `tkFlag(code)` → `chrome.runtime.getURL` ile lazy `<img>` (her yerde aynı çalışır, ID çakışması/CSS-bloat yok). `tkFlagCode()` "Frankfurt, DE"/"Virginia (US-E)"/"Singapore" gibi etiketlerden ISO kodu çıkarır. Bilinmeyen ülke → boş (kod-badge fallback). Kullanım: Derin tarama bölge chip'i, popup TARA sonuçları, Ayarlar prob satırları |
| `themes_critical.js` | MAIN world, document_start, tüm roblox.com | Tema FOUC önleme + WebGL clearColor patch (avatar/profil canvas şeffaflığı) |
| `config.js` `utils.js` `scanner.js` `ui.js` `i18n.js` `main.js` `themes_content.js` | `/games/*` | **Oyun-bar** (Yeni/Derin/ID/Oto-Pilot sunucu bulma) + Themes + Free Items paneli |
| `recent_games_content.js` | `/games/*` | Ziyaret edilen oyunları "son oyunlar"a kaydeder |
| `reconnect_overlay.js` | tüm roblox.com | Auto-Reconnect (crash) overlay'i |
| `trade_analyzer.js` | `/trades*` | Trade sayfasında RAP/değer + denge analizi (Rolimons) |
| `inventory_rac.js` | `/users/*/inventory*` | Envanter RAP/değer hesaplayıcı paneli |
| `catalog_enhancer.js` | `/catalog/*` | Item sayfasına RAP/Floor/Demand/Trend/Value widget'ı |
| `avatar_cost.js` | `/my/avatar*`, `/users/*/avatar*` | Giyili item'ların toplam Robux değeri |
| `avatar_sandbox.js` | `/my/avatar*` | Avatar Try-On (Marketplace/Inventory'den dene, 2B/3B render) |
| `profile_insight.js` (+`i18n.js`) | `/users/*/profile*` | **Oyuncu İçgörü Paneli** — profil sayfasına sağda yüzen kart: künye (yaş/oluşturma/doğrulanmış/eski adlar) + değer (RAP+değer+top item) + sosyal (sayımlar+ortak arkadaş+presence+Katıl) + dürüst güven sinyalleri (§16) |
| `now_playing.js` | tüm roblox.com (all + games) | **Şu An Çalıyor** — opt-in medya widget'ı; Spotify/YT/YT Music'te çalanı sol-altta animasyonlu kartta gösterir + kontrol (§17) |
| `popup.js` (`popup.html`) | toolbar popup | Ping ölçümü, VPN tespiti, arkadaşlar, kayıtlı sunucular, ping grafiği |
| `sidepanel.js` (`sidepanel.html`) | yan panel | Pinlenebilir yan panel |
| `options.js` (`options.html`) | ayarlar | Tüm ayarlar + changelog |
| `instance_trigger.js` | **SİLİNDİ** | Eski blok-bazlı tetikleyici; dosya kaldırıldı, force-join mantığı scanner.js'te |

**Storage (`chrome.storage.local`) ana anahtarlar:** `rota_settings` (ayarlar), `rota_theme`, `rota_ping_cache`/`rota_ping_results` (popup bölgesel ping), NetID cache, `tracked_active_session` (auto-reconnect), `tracked_sandbox_session` + `tracked_sandbox_mkt_state` + `tracked_sandbox_inv_state` (avatar try-on), `tracked_themes_ui`, `tracked_rolimons_cache`, free items history, `tracked_sidepanel_open`, `tracked_server_watch` (Bekçi).
**Bölge/ping (v1.9.3):** `tracked_region_cache` (jobId→bölge, 6 saat TTL), `tracked_region_pings` (SW'nin ölçtüğü 20 küresel probe ping'i {ts, probes:[{cc,lat,lon,ms}]}, 30 dk TTL), `tracked_user_geo` (kullanıcı konumu, 7 gün).
**Themes:** `tracked_color_theme`, `tracked_theme_adj`, `tracked_page_overrides`, `tracked_custom_accent`, `tracked_panel_color/opacity/blur`, `tracked_header_opacity`, `tracked_card_frame/adv/color/opacity/blur`, `tracked_search_custom/color/opacity`, `tracked_text_color/font/contrast`, `tracked_wallpaper`, `tracked_theme_enabled`.

---

## 1. Sunucu Bulma & Katılma — Oyun-Bar (5 buton)

**Nerede:** Roblox oyun sayfası (`/games/*`) → oyun başlığının yanına enjekte edilen bar.
**Dosyalar:** [main.js](../main.js) (akış), [scanner.js](../scanner.js) (tarama/skor), [ui.js](../ui.js) (bar + modal'lar), SW (join + bekçi handler'ları).

Bardaki butonlar (ui.js): **Yeni · Derin · ID · Oto-Pilot · Bekçi**.

### 1a. "Yeni" — GERÇEKTEN Taze Sunucu (snapshot-fark)
- `TrackedApp.findNewServer` → `TrackedScanner.findFreshServers`.
- **Kök gerçek:** Roblox sunucu listesi API'si sunucu YAŞINI vermez → tek snapshot'tan "kaç dk önce açıldı" bilinemez. (Eski `findNewServers` sadece `sortOrder=Asc` ile en az oyunculu sunucuyu bulup hepsine "YENİ" basıyordu → yarı dolu sunucular bile "taze" görünüyordu = uydurma. Kaldırıldı.)
- **Snapshot-fark (dürüst yöntem):** Asc liste snapshot'ı al (`before`, ~6 sayfa) → **~35sn izle** (geri sayım statusbar'da) → tekrar al (`after`, ~4 sayfa). `after`'da olup `before`'da OLMAYAN jobId'ler = o pencerede DOĞMUŞ sunucular (sunucu listede ancak ilk oyuncusu girince görünür → "yeni belirdi" = "yeni açıldı"). En boş (en taze) önce sıralanır, `freshlyOpened:true` işaretlenir.
- **Taze yoksa** → dürüstçe "Şu anda yeni açılmış sunucu bulunmuyor" (`showNoNewServerModal`). Uydurma veri YOK.
- `findNewServers` (eski, Asc-en-boş) ve `scoreNewServers` kodda duruyor ama "Yeni" artık çağırmıyor.
- Sonuç: tek taze → join modal, çok → liste modal'ı (region aşamalı dolar).

### 1b. "Derin" — Derin Tarama + Çift-Doğrulama
- `TrackedApp.performDeepScan` → `TrackedScanner.deepScan` (çok turlu, ~400 sunucu) → `score` → **`verifyServers`** → `showServerListModal`.
- **Skor sadece GÜVENİLİR veriden**: oyuncu sayısı (boşluk) + doluluk + **FPS (sunucu sağlığı)**. *Ping skordan da, UI'dan da tamamen çıkarıldı (Roblox'un ortalama-oyuncu-pingi güvenilmez).*
- **Çift-doğrulama (`verifyServers`)**: en iyi 10 adayı taze veriyle (Asc) yeniden tarar; kapanmış/dolmuş olanları eler, kalanları güncel oyuncu/FPS ile döndürür → liste yalnızca **DOĞRULANDI** rozetli, gerçekten katılabilir sunucular gösterir. Doğrulama boş dönerse skorlanmış listeyle devam eder (boş bırakmaz).
- **Sunucu sağlığı rozetleri** (`analyzeServerPlayers`, dürüst sürüm): **Taze / Dengeli / Dolu** (doluluk) + **Akıcı / Lag'li** (FPS). Yalnızca gerçek veri; eski sahte "Elit/Güvenli/Riskli kullanıcı" + uydurma "sunucu yaşı" kaldırıldı. (İki kopya: scanner.js + ping_utils.js — senkron tutulmalı.)
- **Bölge/mesafe/ping zenginleştirmesi (v1.9.3):** Modal açıldıktan sonra üst ~8 sunucu **aşamalı** çözülür (`TrackedRegion.enrich` → `resolveOne` → SW `resolveServerRegion`). Her satıra: **gerçek bölge** (📍 şehir, ülke) + **ölçülen ping** (en yakın probe) ya da yoksa **~mesafe (km)** + **PlaceVersion** chip'i. Bkz. §1.5. Kalan satırlarda "bölgeyi göster" tıkla-çöz butonu. En yakın (ölçülen ping → mesafe) sunucuya **"Önerilen"** etiketi (`markRecommended`).
- Modal'da filtre: Max Oyuncu · Min FPS; sıralama: Skor · Oyuncu · FPS · **Bölge** (en yakın). *(Roblox'un kendi `ping` field'ı — ortalama-oyuncu-pingi — hâlâ güvenilmez kabul edilir; gösterilen ping bizim ÖLÇTÜĞÜMÜZ bölgesel RTT'dir.)*

### 1c. "ID" — Oyun ID Kopyala
- `TrackedApp.copyGameId` → placeId'yi panoya kopyalar.

### 1d. "Oto-Pilot" — Otomatik Bağlan (En Yakın Sunucu, v5.0)
- `TrackedApp.autoBlockerScan` → `TrackedScanner.autoBlockerScan` (fonksiyon adı eski; artık kimseyi engellemez).
- **v5.0 BÖLGE-GARANTİLİ SEÇİM (birincil)** (`autoPilotPickClosest`): aday sunucuların gerçek bölgesini (jobId→IP→şehir) çözer, kullanıcıya (veya HEDEF BÖLGE seçiliyse hedef ülkenin en yakın DC şehrine) **en yakın** olanı seçer; ≤150km'de erken çıkar. Konum/aday/çözüm yoksa `null` döner → eski matchmaker + görece-ping akışına **zarifçe düşülür** (bozulmaz).
- **Görece-ping filtresi:** kullanıcının ölçtüğü `userBestPing`'e göre adayları skorlar (`server.ping` mevcut oyuncuların ortalama pingi olduğundan, çok düşük ping = uzak kıta sinyali → elenir). Bkz. §1.5.
- SW handler'ları: MAIN-world matchmaker (`swMainWorldMatchmaker`, `swMainWorldReserveServer`, `swMainWorldFetchServers`, `swMainWorldJoinMultiplayer`) + `resolveServerRegion`.
- 🔒 **TASARIM NOTU:** Eski "block-flood" mantığı (sunucudaki oyuncuları engelleyerek matchmaker'ı boş sunucuya zorlama) **tamamen kaldırıldı** — Roblox public API'si sunucudaki oyuncuların ID'sini vermez (kör engelleme arkadaş/takipçi koruma kuralını ihlal eder + ban riski). Oto-Pilot artık **hiçbir kullanıcıyı engellemez**. Bkz. hafıza: `feedback_never_block_friends`.

### 1e. "Bekçi" — Sunucu Bekçisi (arka plan izleme)
- **TEK oyun** (tasarım kararı: aynı anda yalnızca 1 oyun izlenir — daha sağlıklı). Durum tek obje: `tracked_server_watch`.
- UI: `TrackedApp.openServerWatch` → `TrackedUI.showServerWatchModal(placeId, watch, active)`. Kriter: **En Fazla Oyuncu** + min FPS; aksiyon: **Bildir** / **Oto-katıl**; başlat/durdur.
  - Kriter **mevcut oyuncu sayısına** uygulanır (kapasiteye değil; "1/20" = 1 oyuncu / 20 kapasite).
  - **EN DOLU ≤ X seçimi (X'e en yakın):** kritere uyan (dolu değil, `playing ≤ maxPlayers`, `fps ≥ minFps`) sunucular arasından **en dolu** olanı seçer → "en fazla X" anlamlı: X=1 → 1/20; X=20 → ~19/20. İsabet için önce **Desc** (en dolu sayfa), bulunamazsa **Asc** (en boş sayfa) taranır → düşük X'te 1/20 da yüksek X'te ~19/20 da doğru bulunur. (Kullanıcı kararı: "o sayıya en yakın dolu sunucu" — "hep en boş" değil. `minPlayers`/aralık denendi, kafa karıştırdı → kaldırıldı.) Max varsayılan **20**.
- **Bug-fix (sessiz üzerine yazma yok):** `getServerWatch` hem bu oyunun bekçisini (`watch`) hem de herhangi bir aktif bekçiyi (`active`) döndürür. Başka oyunda bekçi aktifken modal **uyarır** ("X izleniyor — başlatırsan durur", `watchOtherActive`).
- **Popup/Side-panel widget:** aktif bekçi "Son Ziyaret Edilen" ÜSTÜNDE canlı kartla gösterilir (yeşil pulse animasyon + oyun adı + kriter + **kaldır (X)** butonu). Hem [popup.html](../popup.html) hem [sidepanel.html](../sidepanel.html)'de `#server-watch-panel`; doldurma [popup.js](../popup.js) `renderServerWatch()`. Böylece aktif bekçi her zaman görünür → gizli/karışık durum yok.
- SW handler'ları: `startServerWatch` / `stopServerWatch` / `getServerWatch`.
- Motor: `serverWatch` alarmı (1 dk) → `runServerWatchCheck()`: oyunun sunucularını **Asc** çeker, kritere uyan (dolu değil, ≤X oyuncu, ≥min FPS) ilk sunucuyu bulunca:
  - **Bildir**: tıklanınca katılan bildirim (`tracked_watchjoin_*` + pending `tracked_watchpending_*`).
  - **Oto-katıl**: `roblox://...` deep-link ile tab açar + bilgi bildirimi (`tracked_watchinfo_*`).
  - **Tek eşleşmede durur** (güvenlik: ~60 kontrol/1 saat üst sınır). Roblox sayfası kapalı olsa da çalışır. `onStartup`'ta aktif bekçinin alarmı yeniden kurulur.
- Bar butonu aktifken yeşil pulse (`.btn-watch.watching`).

> **Not:** `config.js` → `TrackedConfig.API` tarama parametrelerini tutar (sayfa başı sunucu, gecikme, rate-limit, MAX_SCAN).

---

## 1.5. Sunucu Bölge Tespiti & Gerçek Ping (v1.9.3 — RoSeal/RoValra tarzı)

**Amaç:** Her sunucunun **gerçek datacenter ülkesi/şehri** + sana **gerçek ping'in** (ya da mesafe km). Tamamen gerçek veri; uydurma yok.
**Dosyalar:** [main.js](../main.js) (`TrackedRegion` + "Other Servers" enhancer), [service_worker.js](../service_worker.js) (`tkResolveServerRegion`, `tkEnsureRegionalPings`, `tkResolveUserGeo`), [datacenters.js](../datacenters.js) (CIDR DB + probe listesi), [ui.js](../ui.js) (Derin modal chip'leri), [content_styles.css](../content_styles.css) (rozet stilleri).

### Bölge çözümü (sunucu → ülke)
- **Akış:** jobId → SW `resolveServerRegion` → `tkResolveServerRegion` → `gamejoin.roblox.com/v1/join-game-instance` POST (MAIN-world/DNR ile, **istemci-UA spoof** + CSRF) → cevaptan `joinScript.UdmuxEndpoints[0].Address` = sunucunun **gerçek IP'si** → `ipToRegion(ip)` (datacenters.js, /24 prefix eşleme) → `{ city:"London, GB", lat, lon }`.
- **Önbellek:** `tracked_region_cache` (jobId → {ip, region, lat, lon, version}, **6 saat TTL**). jobId başına bölge sabit → bir kez çöz, tekrar bedava.
- **Dolu sunucu:** Roblox dolu (20/20) sunucuya katılım uç noktası vermez → IP yok → bölge çözülemez → UI'da dürüstçe **"Dolu — bölge yok"** (enhancer dolu sunucuda gamejoin'i hiç çağırmaz).
- **Kullanıcı konumu:** `resolveUserLocation` (`tkResolveUserGeo` — IP-geo, 7 gün cache) → engelliyse `resolveMyRegion` (gameId'siz gamejoin → Roblox matchmaker seni KENDİ bölgene atar = AD-BLOCKER-PROOF). Mesafe = haversine(kullanıcı, datacenter).

### Bölgesel ping (gerçek RTT — KOORDİNAT bazlı)
- **20 küresel probe** ([datacenters.js](../datacenters.js) `TK_PING_PROBES`): ABD Doğu/Merkez/Batı, Kanada, Brezilya, İngiltere, İrlanda, Almanya, Fransa, İsveç, İtalya, Bahreyn, Güney Afrika, Hindistan, Singapur, Japonya, Kore, Hong Kong, Avustralya — her biri `{cc, lat, lon, url}` (gerçek AWS S3 endpoint'i).
- **Otomatik arka plan ölçümü:** content script `TrackedRegion.ensureRegionalPings()` → SW `ensureRegionalPings` → `tkEnsureRegionalPings`: probelere **no-cors HEAD** RTT (warmup + 3 örnek median, paralel) → `tracked_region_pings` ({ts, probes:[{cc,lat,lon,ms}]}, **30 dk TTL**). **Manuel test/sayfa yenileme GEREKMEZ.**
- **Eşleştirme** (`TrackedRegion.measuredPing(server)`): sunucunun datacenter koordinatına (regionLat/regionLon) **EN YAKIN** ölçülen probe'un ms'i (haversine). → ABD-Doğu vs ABD-Batı **ayrışır**; ülke etiketi tutmasa bile çalışır. Geri düşüş: ülke-kodu haritası (popup manuel testi, `_pingByCountry`). Hiçbiri yoksa → **mesafe (km)**.

### "Other Servers" native liste enhancer (`initServerListEnhancer`)
- Roblox'un kendi oyun-sayfası sunucu listesine rozet enjekte eder. SW `getServerListData` ile sunucu listesini çeker; kart "ID: xxxx-xxxx" metnini eşler (`matchServer`).
- Her karta: **bölge rozeti** (📍 ülke/şehir) + **ms** (ölçülen) ya da **~km**. Bölge çözümü **sırayla + 320ms aralıklı** (`queueRegion`, gamejoin anti-abuse). Ping ölçümü memoize (`ensurePings`).
- **Layout (KRİTİK):** Roblox kartı `LI.col-md-3` = Bootstrap **float-grid** → farklı yükseklik = kayma/zıplama. Çözüm: CSS `.game-server-details{ padding-bottom:26px; position:relative }` (TÜM kartlara eşit yer ayır) + rozet `position:absolute; bottom:4px` (akıştan çıkık → kart yüksekliği DEĞİŞMEZ). Rozet `host`'a (`.game-server-details`) eklenir, ID'nin altında, KART İÇİNDE.
- **Refresh:** Refresh butonu kancası (tek-atış) → cache + badge'leri temizle → taze veriyle yeniden işle. Cache ömrü 20s. *(Eski "bayat-cache döngüsü" sonsuz döngü/RangeError yapıyordu → kaldırıldı.)*

### `TrackedRegion` (main.js) — özet API
`_geo`, `_pingByCountry`, `_regionPings`, `getUserGeo`, `distanceKm`, `perfPct`, `measuredPing`, `_loadPingMap`/`_loadRegionPings`, `ensureRegionalPings`, `resolveOne`, `apply`, `enrich`, `resolveAndApply`, `markRecommended`. **Oto-Pilot v5.0** bunu kullanır: gameId'siz region + adayları çözüp **garanti en-yakın** sunucuyu seçer.

### HEDEF BÖLGE (popup/sidepanel "Hedef Bölge" kontrolü)
- Storage: `rota_target_region` — `null` = otomatik (en yakın) | `{code, label, cities:[{city,lat,lon}]}` — **ÜLKE bazlı** (kullanıcı kararı). popup.js `TARGET_REGIONS`: 10 ülke, şehirler Roblox'un GERÇEK 18 DC konumu (datacenters.js CITY ile senkron; ABD = 9 şehir).
- Popup UI: "En İyi Konum" pill'i = otomatiğe sıfırla (aktif görünür); "Hedef Bölge" dropdown = **kıta başlıklı** (EU/NA/SA/AS/OC, `dropdown-group-header`) + **scroll'lu** (`portal-dropdown max-height:320px`). (Eski "Bölge Seçimi" hiçbir şey yapmıyordu — kalıntıydı.)
- Tüketim: `autoPilotPickClosest` (main.js) hedef ülke seçiliyse aday mesafesi = **o ülkenin DC şehirlerinden sunucuya EN YAKINI** (min-haversine; ABD'de en uygun şehir kendiliğinden), erken çıkış ≤150km, durum "Hedef ABD: ...". Otomatik modda davranış değişmez; hedef modda kullanıcı konumu gerekmez.
- NOT (yanılgı düzeltmesi): Ayarlardaki "Ping Noktaları/Bölge Şablonu" KATILMAYI ETKİLEMEZ — sadece popup ping panosu + Bekçi yakınlık + Oto-Pilot eski-akış userBestPing'i besler.

---

## 2. Auto-Reconnect (Crash Recovery)

**Nerede:** TÜM roblox.com sayfaları (oyun sayfasından çıksan bile overlay görünür).
**Dosyalar:** [reconnect_overlay.js](../reconnect_overlay.js) (overlay), SW handler'ları: `saveActiveSession`, `triggerSessionMonitor`, `testCrashNotification`.

- Oyuna katılınca `placeId + jobId` storage'a kaydedilir (`tracked_active_session`).
- SW periyodik olarak (alarm/monitor) presence kontrol eder; "önceden in-game → şimdi offline" geçişi = crash.
- Crash algılanınca overlay/bildirim: **"Aynı Server'a Dön"** (jobId ile) veya optimal sunucu. Roblox'un kendi "yeniden bağlan"ı rastgele sunucuya atar; bu seni tam yerine getirir.
- Ayarlardan açılıp kapatılır; native sistem bildirimi opsiyonel (varsayılan kapalı).

---

## 3. Ping Ölçümü & VPN Tespiti (Popup)

**Nerede:** Toolbar popup ([popup.js](../popup.js) / `popup.html`).

### 3a. Bölgesel Ping
- **Varsayılan: Avrupa şablonu** (DE/NL/FR/PL/RO) — `DEFAULT_SETTINGS.probes` ([popup.js](../popup.js)). Diğer bölgeler için kullanıcı ayarlardan **Bölge Şablonu** seçer (NA/Asya/SA/AU/Global, `PROBE_PRESETS`) → problar O setle **değişir** (üstüne eklenmez). Manuel "Bölge Seçimi" dropdown'ı bu set'i listeler. *(v1.9.3'te kısa süre "tüm global probe'ları zorla ekle" migration'ı vardı → şablonu eziyordu, KALDIRILDI. Sunucu listesi ms'i zaten bu sete bağlı değil — SW'nin `TK_PING_PROBES`'unu kullanır.)*
- `measurePings`: warmup + median + jitter; best-of-N (en düşük örneklerin medianı). 10dk persistent cache (popup hızlı açılır). Sonuç `rota_ping_cache.results` ({region:"Almanya (DE)", ms}).
- Manuel region seçimi + ping geçmişi grafiği (`toggleGraphView`). Ayarlarda **bölge şablonları** (EU/NA/Asya/SA/AU/Global preset).
- **NOT:** Bu manuel/popup testi artık "Other Servers" listesinin **birincil** ping kaynağı DEĞİL — orası SW'nin otomatik koordinatlı ölçümünü (`tracked_region_pings`) kullanır (§1.5), popup'ın ülke-kodu haritası yalnızca geri-düşüştür.
- SW tarafı: `measurePingForContent`, `getCachedPingData`.

### 3b. Network Identity / VPN
- `checkNetworkIdentity`: IP / ISP / ülke tespiti (3 sağlayıcı fallback: ipinfo.io / ipwho.is / ipapi.co, 10dk cache).
- **VPN sezgisi**: tarayıcı timezone vs IP timezone karşılaştırması → uyuşmazlık = "muhtemel VPN".

### 3c. Popup'taki diğerleri
- Arkadaş listesi (online durumu, `loadFriends`, 45sn yenileme).
- Kayıtlı sunucular (`renderSavedServers`).
- Light/dark tema, dil, reduced-motion.

---

## 4. Avatar Try-On Sandbox (2B/3B)

**Nerede:** `/my/avatar` → [avatar_sandbox.js](../avatar_sandbox.js) + SW sandbox handler'ları.

- Avatar editörüne **"Avatar Try-On"** paneli enjekte eder. Item'ları **satın almadan** dener.
- **Kaynaklar:** Inventory (sahip olunan giyilebilirler) ve **Marketplace** (gerçek Roblox kataloğu).
- **Marketplace** (`trackedSandboxCatalogSearch`): gerçek marketplace kategori ağacıyla birebir (Body/Makeup/Clothing/Accessories/Animations + alt-kategoriler), tek nested menü. Değer formatı `Category~Subcategory~BundleType`. SW bir **deneme zinciri** uygular (cat+sub → sub → cat → keyword) → uyumsuz enum 400 vermez. **Sonsuz kaydırma** (cursor pagination), 7'li grid kart (thumbnail + isim + geliştirici + Robux ikonu).
- **Full Bodies = bundle** (`trackedSandboxBundleDetails`): bundle'lar itemType="Bundle", ayrı thumbnail ucu (`/v1/bundles/thumbnails`), try-on'da bundle → asset'lere çözülür. Tek slot (1 gövde).
- **Render** (`trackedSandboxRender`): Roblox'un avatar/render API'si → 2B (PNG) veya 3B (OBJ manifest). **Hibrit**: varsayılan **2B** (Roblox'un kendi render'ı, her zaman kusursuz), tek tıkla **3B** (Three.js, döndürülebilir, best-effort).
  - 3B teknik: manifest (camera/obj/mtl/textures hash'leri) → SW veya **sayfa context'inden** (ad-blocker/SW bloklanırsa) t0-t7 rbxcdn node'larından çekilir; obj/mtl için boş-olmayan içerik bulunana kadar denenir; 403/propagation için retry.
  - 3B materyal: texture eşleme (URLModifier + fuzzy hash + materyal-adı eşleme); texture **içerik analizi** (açık+düşük doygunluk = ten texture'ı → kullanıcının **skin tone**'u ile çarp, Roblox gibi); başarısız texture → nötr ten (asla parlak beyaz). Sculpted (Advanced/PBR) gövdeler 3B'de best-effort, 2B'de kusursuz.
- **Hafıza:** son kategori/filtre/arama hatırlanır (`tracked_sandbox_mkt_state`/`inv_state`). **Canlı senkron** (`trackedSandboxAvatarState`): native editörden item ekle/çıkar yapınca ~5sn'de render güncellenir.
- **For You feed** (`trackedSandboxRecommended`): giydiklerine göre popüler öneriler.
- **Three.js** talep üzerine yüklenir (`trackedSandboxLoadThree`, [lib/](../lib/)).

---

## 5. Avatar Cost (Giyili Değer)

**Nerede:** `/my/avatar`, `/users/*/avatar` → [avatar_cost.js](../avatar_cost.js) + SW `trackedAvatarCost`.
- Avatar önizlemesinin altına **üstündeki item'ların toplam Robux değerini** native görünümlü ibareyle gösterir, canlı güncellenir.

---

## 5.5. Avatar Çerçeveleri — KALDIRILDI

Animasyonlu avatar çerçevesi özelliği (`avatar_frames.js`) **tamamen kaldırıldı** (kullanıcı kararı — fikirden vazgeçildi). Dosya silindi, manifest content_scripts girişleri çıkarıldı. Artık kullanılmayan storage anahtarları: `tracked_avatar_frame`, `tracked_frame_tone` (inert kaldı). `tracked_card_frame` DURUYOR ama artık yalnız Themes "Kart çerçevesi" (item/oyun kartı kenarlığı, `tke-frame`) için — avatar ile ilgisi yok.

---

## 6. Themes (Görsel Tema Sistemi)

**Nerede:** tüm roblox.com → [themes_content.js](../themes_content.js) (ana) + [themes_critical.js](../themes_critical.js) (erken patch) + [content_styles.css](../content_styles.css).

- Roblox'a özel **görsel tema**: wallpaper katmanı, frosted-glass paneller, kart-tabanlı tasarım, header opacity, custom renkler. CSS değişkenleri: `--tk-panel-rgb/opacity/blur`, `--tk-header-opacity`, `--tk-card-rgb`, `--tk-search-rgb`, `--tk-text-color/font`, `--tk-accent`; sınıflar `tke-glass`, `tke-frame`, `tke-card-adv`, `tke-search-custom`, `tke-text-color/font/contrast`.
- **Renk ayarları (5 satır):** Panel · Kart · Arama kutusu · Yazı · Vurgu (accent). Her satırda hex input + **ayarlanabilir native renk paleti** (`<input type="color">`, `.tto-colorpick`). Lag önlemek için **`change`-only** (kaydırırken iş yapmaz, picker kapanınca uygular).
- **Gelişmiş sekme:** Arama kutusu rengi/opaklığı (tek katman `.navbar-search`), **yazı rengi + font** (küratörlü `:is(...)` sınıf listesi — universal `*` SAYFAYI BOZUYOR, kullanma), genel kontrast.
- **Sohbet (chat):** liste + konuşma penceresi **frosted** (blur + hafif tint, kırmızı/şeffaf değil); başlık kutusu/girdi kenarları düzeltildi.
- **Wallpaper:** kaydedince **canlı uygular** (F5 gerekmez — save handler `await applyWallpaper()`).
- **Default modu** (`tke-off` / `localStorage.tk_theme_off`): tüm Tracked tema efektlerini kapatır → saf Roblox (FOUC yok; themes_critical erken kontrol eder).
- **Themes ayar sayfası**: sol sidebar'a "Themes" butonu enjekte edilir → overlay panel (`#tracked-themes-overlay`, `.tto-*`), canlı önizleme mock'u. Hafıza: `tracked_themes_ui` (scroll + açık bölümler).
- **Kart çerçevesi** (`tracked_card_frame`, `tke-frame`): item/oyun kartlarına kenarlık + köşe yumuşatma uygular. (Eskiden avatar çerçevelerini de tetikliyordu; o özellik kaldırıldı.)
- `themes_critical.js`: WebGL clearColor patch (avatar/profil canvas'ı şeffaf → wallpaper görünür).
- ⚠️ **panelWidth ayarı v1.9.0'da kaldırıldı** (daima %100 — UI kayma bug'ı). Kalıntı temizlendi: import artık eski panelWidth'i yoksayar/reddetmez. `#tto-panel-w` HTML'den çıkık (guard'lı null referanslar zararsız).
- ⚠️ **"Metin opaklığı" (adj.fgOpacity → --tk-fg) v1.9.3'te kaldırıldı** — ÖLÜ ayardı: `--tk-fg`'yi hiçbir CSS kuralı tüketmiyordu (kaydırıcı hiçbir şeyi değiştirmiyordu). UI satırı + handler + üretim (themes_content `computeThemeVars` + themes_critical) temizlendi. `VALID_ADJ_BOUNDS.fgOpacity` eski export'ları reddetmemek için bilerek duruyor (kabul+yoksay). `fgBase` (wallpaper luma) borusu yerinde — başka kullanım ihtimaline karşı dokunulmadı.

---

## 7. Ücretsiz Item Radarı (Free Items)

**Nerede:** Themes panelinden açılan **Free Items paneli** ([themes_content.js](../themes_content.js)) + SW handler'ları.
- SW: `checkFreeItemsNow`, `getFreeItemsHistory`, `setFreeItemsEnabled`, `verifyFreeItemsHistory`.
- Roblox kataloğundaki gerçekten **satın alınabilir ücretsiz** item'ları tespit eder (off-sale/expired/stoku gözükmeyenleri **akıllı filtre** ile eler).
- Gerçek stok: `apis.roblox.com/marketplace-items/.../items/details` (Flex UGC Codes = `ExperiencesDevApiOnly` gerçek stok; oyun-içi satılanlar yanıltıcı per-user limiti).
- History = mevcut tüm item'lar; verify **non-destructive** (API hatasında listeyi silmez). Bildirim + panel listesi.

---

## 8. Trade Analyzer

**Nerede:** `/trades*` → [trade_analyzer.js](../trade_analyzer.js) + SW `fetchRolimonsData`.
- Trade sayfasında her item'a **RAP/değer** badge'i + **trade dengesi** (veriyorsun/alıyorsun, kâr/zarar) paneli enjekte eder.
- Rolimons verisi (`tracked_rolimons_cache`, 30dk TTL).

---

## 9. Envanter RAP Hesaplayıcı

**Nerede:** `/users/*/inventory*` → [inventory_rac.js](../inventory_rac.js) + SW (`fetchRolimonsForRAC`, `fetchRolimonsPlayerAssets`, `fetchUserAllLimiteds`, `fetchResaleDataBatch`).
- Envanter sayfasına **toplam RAP/değer** paneli; kullanıcının limited'larını çekip Rolimons değeriyle hesaplar.
- **Gizlilik fix (v1.9.5):** DOM taraması (`scanDOM` + `watchInventoryGrowth`) sayfa-geneli `/catalog/` linklerini topladığından, **başka birinin** (özellikle **private**) envanter sayfasında **senin** kişisel öneri/item linklerini yakalayıp ona yanlış değer atıyordu (senin envanter değerin görünüyordu). Düzeltme: DOM taraması artık **yalnız KENDİ envanterinde** (`isOwn`); başkalarında sadece kullanıcıya-özel yetkili API'ler (Rolimons playerassets + V1 collectibles + UGC tarama) → private başka kullanıcı → tüm kaynaklar boş → dürüstçe **"Bu kullanıcının envanteri private"**, veri sızmaz.

---

## 10. Catalog Enhancer

**Nerede:** `/catalog/*` (item sayfası) → [catalog_enhancer.js](../catalog_enhancer.js) + SW (`fetchRolimonsForRAC`, `fetchFloorPricesBatch`, `fetchCatalogItemInfo`, `getPriceHistory`).
- Item sayfasına **RAP · Floor · Demand · Trend · Flags · Value** widget'ı ("Best Price" altına). Roblox sadece best price gösterir; biz trader bilgilerini ekleriz. Premium gerekmez.

---

## 11. Recent Games & Canlı Etkinlik

- **Recent Games** ([recent_games_content.js](../recent_games_content.js)): ziyaret edilen oyunları "son oyunlar"a kaydeder (popup'ta gösterilir).
- **Canlı Etkinlik Algılama** (SW: `refreshGameLibrary`, `analyzeGame`, `testEventDetection`, `getEventHistory`): favori/kütüphane oyunlarında oyuncu sayısı spike'larını izler (5dk poll) → "X oyununda etkinlik" bildirimi. Aktif tab açıkken playtime sayacı.
- **Etkinlik Analizi — İKİ KATMANLI** (kütüphane kartındaki "Analiz" butonu → `showEventAnalysis` → SW `analyzeGame`):
  - **KATMAN 1 — RESMİ Experience Events (ground truth, `fetchVirtualEvents`):** Roblox'un `apis.roblox.com/virtual-events/v1/universes/{universeId}/virtual-events` API'si. Geliştiricinin BİZZAT beyan ettiği etkinlik → ad (`displayTitle`) + başlangıç/bitiş (`eventTime.startUtc/endUtc`) + durum (canlı/yakında/bitti, zamandan hesaplanır) + düzenleyen (`host.hostName` + doğrulanmış rozeti). Tahmin YOK. Modalda en üstte mavi "Roblox onaylı" kartı, canlıysa pulse'lı CANLI rozeti + "X saat sonra bitiyor" geri sayımı. 12 saatten eski bitmişler elenir; canlı > yakında > yeni bitmiş sıralanır.
  - **KATMAN 2 — Sezgi motoru (`HybridEventAnalyzer`, fallback):** Resmi etkinlik yoksa açıkça "TAHMİN" etiketiyle gösterilir (sarı uyarı). 12 sinyal: başlık/açıklama regex, oyuncu/favori/server/doluluk spike, beğeni oranı, son güncelleme, thumbnail, voice, badge, zaman kalıbı. Eşik 60=olası, 110=kesin.
  - **Düzeltme (v1.9.3):** Eskiden on-demand "Analiz" sadece 5 alan toplayıp 6 sinyali ölü bırakıyordu. Artık metrik toplama tek paylaşılan helper'da (`collectEventMetrics`) — arka plan izleyici ile on-demand analiz **aynı** zengin veriyi kullanır (votes/favori/server/doluluk/voice/badge), geçmiş `rota_game_history`'den tam okunur. Drift bitti.

---

## 12. Popup / Side Panel / Options

- **Popup** (§3): ping, VPN, arkadaşlar, kayıtlı sunucular, grafik.
- **Oyun Kütüphanesi görünüm anahtarı** (popup + sidepanel, [popup.js](../popup.js) `renderLibrary`/`setupLibraryViewSwitch`): Win11 Gezgini "Görünüm" menüsü tarzı açılır menü (başlıkta ikon buton) — **Geniş** (varsayılan, eski 2 katlı kart: 40px ikon + canlı istatistik + güncelleme rozeti + pill butonlar) ve **Kompakt** (tek satır, 50+ oyunda scroll yarıya iner). Seçim `rota_library_view` (`comfort`|`compact`, varsayılan `comfort`) → kalıcı + popup/sidepanel arası `storage.onChanged` ile senkron. CSS düzeni `.view-comfort`/`.view-compact` sınıflarıyla ayrışır (`#library-list` üzerinde).
- **Side Panel** ([sidepanel.js](../sidepanel.js)): pinlenebilir yan panel (popup pin butonu açar); çalışırken arkadaş online durumu görünür.
- **Options** ([options.js](../options.js) / [options.html](../options.html)): bölümler — **Görünüm** (dil TR/EN, sessiz mod, reduced motion) · **Bağlantı** (ping timeout, cache TTL, yeni sekmede aç, URL bölge parametresi) · **Auto-Reconnect** (aç/kapa + native bildirim) · **Problar** (ping noktaları + **bölge şablonları** EU/NA/Asya/SA/AU/Global + test) · **Tanılama** (diag + export/import) · **Sürüm Notları** (changelog) · **Veri Yönetimi** (favori/cache/Oto-Pilot blocklist temizle, fabrika ayarları). Tüm `getElementById` referansları HTML'de mevcut (yetim element yok — v1.9.3 audit).
  - `appendRegionParam` ("URL Bölge Parametresi") **KALDIRILDI** — hiçbir akış tüketmiyordu, Roblox `rotaRegion` parametresini zaten tanımıyordu (çifte ölü). Gerçek bölge hedefleme = popup "Hedef Bölge" (§1.5).
  - `openInNewTab` ("Yeni Sekmede Aç") **KALDIRILDI** — yalnız "Normal Giriş" (web) stratejisinde etkiliydi; varsayılan "Hızlı Rota" deeplink'tir (sekme yok) ve Katılma Modu UI'sı kaldırıldığı için strateji değiştirilemiyordu → fiilen ölüydü. Bağlantı Ayarları'nda kalanlar: Ping Zaman Aşımı + Önbellek Süresi (ikisi de gerçek/çalışıyor).

---

## 13. Service Worker (Arka Plan Altyapısı)

**Dosya:** [service_worker.js](../service_worker.js). Tüm content script'ler buraya `chrome.runtime.sendMessage` ile konuşur.

Roller:
- **CORS-bypass fetch**: roblox.com API'lerine SW'den istek (host_permissions ile CORS atlanır). DNR kuralları ([cors_rules.json](../cors_rules.json)) bazı roblox alt-domain'lerine Origin/Referer set eder.
- **Avatar**: render (2B/3B), inventory, recommended, catalog search, bundle details, avatar state, avatar cost.
- **MAIN-world işlemler**: `chrome.scripting.executeScript({ world:'MAIN' })` ile Roblox sayfa context'inde matchmaker/join/thumbnail çağrıları (status-12 bypass için).
- **Sunucu bölge & ping (v1.9.3)**: `getServerListData` (liste), `resolveServerRegion` (jobId→bölge), `ensureRegionalPings` (20 probe arka plan ölçümü), `resolveUserLocation`/`resolveMyRegion` (kullanıcı konumu). importScripts `datacenters.js`. Bkz. §1.5.
- **Free items**, **canlı etkinlik**, **auto-reconnect monitor**, **ping ölçümü**, **Rolimons/trade verisi**, **thumbnail batch**.
- Alarmlar: periyodik tetikleyiciler (auto-reconnect monitor, game library, live event, ping).

---

## 14. Bilinen Sınırlar & Kararlar

- **Roblox `ping` field'ı güvenilmez** (ortalama-oyuncu-pingi, kullanıcı-sunucu değil) → her yerden kaldırıldı; sıralama doluluk + FPS'e dayanır. Bkz. hafıza: `feedback_honest_data_only`.
- **3B avatar re-render kırılgan** (PBR/sculpted gövdeler, rbxcdn node davranışı, ad-blocker) → **2B varsayılan ve kusursuz**, 3B best-effort.
- **rbxcdn t-serisi** bazen ERR_CONNECTION_RESET / 403 verir → t0-t7 brute-force + retry + sayfa-context fallback.
- **Roblox public API oyuncu kimliği vermez** → gerçek "oyuncu analizi" imkânsız; sunucu-sağlığı (doluluk+FPS) yapılır.
- **Tarayıcıdan gerçek ICMP ping imkânsız** (sunucu IP'si bize HTTP cevabı vermez) → ms = en yakın AWS probe'a ölçülen RTT (datacenter/bölge granülerliği, sunucu-bazlı değil). En dürüst yaklaşım.
- **Dolu (20/20) sunucu bölgesi çözülemez** — Roblox katılım uç noktası vermez → "Dolu — bölge yok".
- **AWS S3 probe'ları reklam engelleyici tarafından engellenirse** ms gelmez (nadir) → dürüstçe mesafe (km)'ye düşer.
- **datacenters.js statik snapshot** (BTRoblox kaynaklı) — bilinmeyen /24 prefix → "Bilinmeyen DC (x.x.x)"; Roblox IP bloğu eklerse güncelleme gerekir.
- **gamejoin bölge çözümü** CSRF + istemci-UA (DNR) gerektirir; jobId başına 1 çağrı (6 saat cache + aşamalı + tek-atış → anti-abuse).
- **instance_trigger.js SİLİNDİ** — force-join mantığı scanner.js'te.

---

## 15. Standing Kurallar (DEĞİŞMEZ)

- **Emoji ASLA** — her zaman SVG ikon (kod + UI).
- **Block ASLA arkadaş/takipçi/takip edileni vurmaz** — sosyal bağlantılar daima exclusion list'te (`feedback_never_block_friends`).
- **Güvenilmez/uydurma veri gösterme** — gerçek veriye dayandır ya da kaldır (`feedback_honest_data_only`).
- **Çalışanı bozma.** RoPro yalnızca ilham; bizimki daha iyi olmalı.

---

## 16. Oyuncu İçgörü Paneli (Profil Sayfası) (v1.9.5)

**Nerede:** `/users/{id}/profile` → [profile_insight.js](../profile_insight.js) (+ `i18n.js`, manifest'te aynı girişte) + SW `getUserProfileInsight` / `getMutualFriendCount`.

- **Tek dokunulmamış yüksek-değerli yüzeydi** — profil ana sayfasında daha önce hiç Tracked yoktu (sadece `/inventory` ve `/avatar` alt-sayfaları). RoPro'nun en sevilen profil özelliklerini bizim güçlerimizle birleştirir.
- **Sağda yüzen frosted kart** (`#tracked-profile-insight`, `position:fixed`) — catalog_enhancer deseni; profil DOM'una bağımlı DEĞİL (kırılgan mount yok). Themes ile uyumlu. SPA nav'da yeniden çalışır (catalog `watchNavigation`). Scrollbar gizli.
- **Küçült/aç (v1.9.5):** başlıktaki minimize butonu → panel **46×46 kare ikona** dönüşür (kareye tıkla → büyür). Durum **KALICI** (`tracked_pi_minimized` storage) → refresh/profil geçişi/tarayıcı kapatmada korunur; küçükken veri arkada yüklenmeye devam eder. Veri **aşamalı** dolar (künye/sosyal hızlı, değer yavaş — skeleton'dan).
- **Bölümler (özellik yığını):**
  - **Künye:** hesap yaşı + oluşturma tarihi + doğrulanmış rozeti + banlı mı + eski kullanıcı adları (username-history).
  - **Değer:** toplam RAP + tahmini değer (Rolimons) + limited sayısı + en değerli 3 item (küçük 44px thumbnail). **Pipeline (v1.9.5):** **BİRİNCİL = `fetchRolimonsPlayerAssets`** (başka kullanıcının public envanteri için en güvenilir/hızlı kaynak — fetchUserAllLimiteds tek başına profilde DOM olmadığı için boş dönüyordu) + `fetchRolimonsForRAC` (RAP/value haritası) + `fetchItemThumbnails`. **FALLBACK = `fetchUserAllLimiteds`** (Rolimons'ta yoksa). Rolimons `[2]`=RAP, `[3]`=value (−1 ise RAP'e düşer; count × değer). Private → dürüstçe "Envanter gizli".
  - **Sosyal:** arkadaş/takipçi/takip sayıları + **seninle ortak arkadaş** sayısı (`getMutualFriendCount`: benim liste ∩ profilin listesi; isim örneği taşma yüzünden kaldırıldı, sadece sayı) + **presence** (online/oyunda/studio) + oyundaysa **[Katıl]** (deep-link `roblox://...placeId+gameInstanceId`, joinFriendServer deseni).
  - **Güven Sinyalleri (DÜRÜST vetting):** yalnız gerçek metrik rozetleri — "Yeni hesap: X gün" / "5+ yıl hesap" / "Doğrulanmış" / "Yüksek değerli envanter" / "N rozet". **Uydurma risk skoru ASLA** (feedback_honest_data_only). Kendi profilinde gizli.
- **SW handler'ları:**
  - `getUserProfileInsight(userId)`: tek mesajda CORS-bypass batch — user info (`users/v1/users/{id}`) + 3 sayım (`friends/v1/.../count`) + username-history + badges (limit 100 → count/100+) + presence (POST + CSRF challenge). Her alan hata-toleranslı (null → o satır gizlenir).
  - `getMutualFriendCount(userId)`: authenticated user + iki arkadaş listesi kesişimi (örnek 3 isim). Kendi profilin → `self:true`.
- **Dürüstlük/gizlilik:** private/403 → satır gizlenir (çökme yok). Tüm metin i18n (`pi*` anahtarları, TR+EN). Emoji yok (inline SVG; Robux = gerçek rbxcdn path'i).

---

## 17. Şu An Çalıyor (Medya Widget'ı) (v1.9.5)

**Nerede:** tüm roblox.com → [now_playing.js](../now_playing.js) (all-roblox + games content_scripts) + SW `mediaGetNowPlaying`/`mediaControl`/`mediaFocusTab` + Options "Şu An Çalıyor" toggle.

- **Ne yapar:** Spotify Web / YouTube / YT Music sekmesinde çalan şarkıyı algılar; Roblox sayfasında **sol-altta animasyonlu kart** (`#tracked-now-playing`): kapak + ad/sanatçı (taşmada marquee) + kaynak rozeti (marka SVG) + **canlı ekolayzer** + ◀◀ ⏯ ▶▶ + ilerleme çubuğu (mm:ss). Küçült→54px kare, **kalıcı** (`tracked_np_minimized`).
- **OPT-IN:** `rota_settings.nowPlaying` (varsayılan **KAPALI**). Kapalıyken now_playing.js hiçbir şey yapmaz, SW medya sekmelerine **dokunmaz**. Options'tan açılır; `storage.onChanged` ile canlı aç/kapa.
- **İzin:** YENİ izin GEREKMEZ — manifest'te `host_permissions` zaten `https://*/*` içeriyor.
- **Veri (gerçek):** MAIN-world `executeScript` ile medya sekmesinin `navigator.mediaSession.metadata` + `<video>/<audio>` durumu okunur (DOM fallback: Spotify/YT başlık selektörleri). **Hiçbir şey dışarı gitmez** — sadece o anki şarkı bilgisini Roblox sekmesine taşır.
- **SW handler'ları:**
  - `mediaGetNowPlaying`: `tabs.query({audible:true})` ön-filtre + medya sekmesi listesi + **son çalan sekme önbelleği** (`self._mediaLastTabId`) → adaylara MAIN-world `readFn` → çalanı (yoksa metadata'lı duraklatılmışı) döndürür. Performans: her seferde tüm sekme taraması yok.
  - `mediaControl` {cmd:play/pause/next/prev/seek/mute}: aktif sekmeye MAIN-world kontrol. **Çal/duraklat site TOGGLE butonuyla** (Spotify Widevine-şifreli → `video.play()` güvenilmez): Spotify `[data-testid="control-button-playpause"]`, YT Music `#play-pause-button`, YouTube `.ytp-play-button`. next/prev site butonları. **Seek Spotify'da YOK** (şifreli) → widget'ta progress salt-okunur.
  - `mediaFocusTab`: kapağa tıkla → o medya sekmesine geç (`tabs.update active` + `windows focus`).
- **now_playing.js:** yoklama görünürlük-kapılı + backoff (çalıyor 1.5sn / duraklatılmış·küçük 3sn / boş 5sn); ilerleme **yerel interpolasyon** (akıcı, render'sız); kontrolde **optimistic** UI; full render yalnız şarkı/durum değişince (track key). SPA nav'da sürekli (sabit overlay, watchNavigation gerekmez).
- **Dürüstlük:** ekolayzer GERÇEK spektrum değil → sadece "çalıyor" durum animasyonu (FFT başka sekmeden alınamaz). Metadata `escapeHtml` (XSS). Emoji yok (marka SVG'leri inline). `prefers-reduced-motion` → animasyon durur.
- **Sınırlar:** yalnız WEB oynatıcılar (Spotify masaüstü uygulaması ALGILANAMAZ); next/prev sıradaki şarkı; buton selektörleri site değişirse güncellenir. `mediaSession` evrensel → 3 sitenin ötesi (SoundCloud vb.) basit play/pause/seek otomatik.

---

*Bu dosya değiştikçe güncellenmeli. Bir özellik eklenir/değişirse ilgili bölümü güncelle.*
