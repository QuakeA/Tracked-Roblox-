# Site görselleri (assets)

Buraya **site için render/ekran görüntüsü/görsel** dosyalarını bırak.
`index.html`, `plus.html`, `privacy.html` buradan görsel çeker.

## Nasıl çalışır
1. Görsel dosyanı bu klasöre koy:
   `c:\Users\PC\Desktop\Tracked Roblox Dev\assets\`
2. Bana **dosya adını + nereye gireceğini** söyle
   (örn. "auto-pilot.webp — Oto-Pilot moment'ına koy").
3. Ben HTML'e doğru şekilde bağlarım: `<img>` + genişlik/yükseklik (CLS yok)
   + `loading="lazy"` + `alt` metni + mevcut çerçeve/stil ile uyum.

> Not: Görseli **sohbete yapıştırırsan** onu yalnızca GÖREBİLİRİM (tasarım
> geri bildirimi için). Sitede KULLANMAK için dosyanın bu klasörde olması gerekir.

## Format & boyut önerileri
| Tür | Format | Not |
|---|---|---|
| Foto / 3B render / ekran görüntüsü | **WebP** (veya PNG) | WebP en küçük; kaliteyi korur |
| Saydam arka plan gerekiyorsa | PNG | |
| Vektör (logo, ikon, diyagram) | **SVG** | sınırsız ölçeklenir, en keskin |
| Animasyon | MP4/WebM (GIF değil) | GIF ağır + düşük kalite |

- **Genişlik:** hero/büyük görsel ~1600px, moment görselleri ~1200px, kart ~800px yeterli.
- **Dosya boyutu:** ideal < 250 KB/görsel (WebP ile kolay). Çok büyükse ben küçültürüm.
- **Retina için:** istersen `ad@2x.webp` de ekle, ben `srcset` ile bağlarım.

## İsimlendirme (önerilen)
küçük harf + tire: `ozellik-adi.webp`
Örnekler:
`hero-sonar.webp`, `auto-pilot.webp`, `themes.webp`, `now-playing.webp`,
`player-insight.webp`, `regional-ping.webp`, `server-watcher.webp`

## Nereye girebilir (seçenekler)
- **Moment mockup'larını gerçek render ile değiştir** (şu an CSS çizim) — en etkili.
- Hero'daki sonar yerine/yanına gerçek ürün görseli.
- Yeni bir "ekran görüntüleri" galerisi.
- Sosyal kanıt / kullanım örneği şeritleri.

Sen dosyaları koy + nereye dediğini söyle, gerisini ben hallederim.
