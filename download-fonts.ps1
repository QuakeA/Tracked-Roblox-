# download-fonts.ps1 — Tracked: 30 temalı Google Fonts woff2'yi indirir → fonts/ klasörüne.
# TEK SEFERLİK çalıştır. Dosya adları themes_content.js'teki TEXT_FONTS key'leriyle birebir.
# Kaynak: Google Fonts CSS2 API (modern tarayıcı UA → woff2 döner). Hepsi OFL/Apache (gömülebilir).
#
# Çalıştırma:  PowerShell'i bu klasörde aç →  .\download-fonts.ps1
# (Gerekirse:  powershell -ExecutionPolicy Bypass -File .\download-fonts.ps1 )

$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot 'fonts'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

# key (dosya adı) -> Google Fonts aile adı
$fonts = [ordered]@{
  'bitcount'     = 'Bitcount'
  'oxanium'      = 'Oxanium'
  'rajdhani'     = 'Rajdhani'
  'chakra'       = 'Chakra Petch'
  'audiowide'    = 'Audiowide'
  'michroma'     = 'Michroma'
  'wallpoet'     = 'Wallpoet'
  'pressstart'   = 'Press Start 2P'
  'vt323'        = 'VT323'
  'pixelify'     = 'Pixelify Sans'
  'silkscreen'   = 'Silkscreen'
  'handjet'      = 'Handjet'
  'creepster'    = 'Creepster'
  'nosifer'      = 'Nosifer'
  'pirata'       = 'Pirata One'
  'eater'        = 'Eater'
  'unifraktur'   = 'UnifrakturMaguntia'
  'butcherman'   = 'Butcherman'
  'vampiro'      = 'Vampiro One'
  'cinzel'       = 'Cinzel'
  'cinzeldec'    = 'Cinzel Decorative'
  'playfair'     = 'Playfair Display'
  'cormorant'    = 'Cormorant'
  'gilda'        = 'Gilda Display'
  'bungee'       = 'Bungee'
  'marker'       = 'Permanent Marker'
  'caveat'       = 'Caveat'
  'inter'        = 'Inter'
  'spacegrotesk' = 'Space Grotesk'
  'outfit'       = 'Outfit'
}

$fail = @()
$ok = 0
foreach ($key in $fonts.Keys) {
  $fam = $fonts[$key]
  $famUrl = $fam -replace ' ', '+'
  $out = Join-Path $dir "$key.woff2"
  try {
    $cssUri = "https://fonts.googleapis.com/css2?family=$famUrl"
    $css = (Invoke-WebRequest -Uri $cssUri -UserAgent $ua -UseBasicParsing).Content
    # Önce 'latin' alt-kümesindeki woff2; yoksa ilk woff2.
    $m = [regex]::Match($css, '/\*\s*latin\s*\*/.*?url\((https://[^)]+?\.woff2)\)', 'Singleline')
    if (-not $m.Success) { $m = [regex]::Match($css, 'url\((https://[^)]+?\.woff2)\)') }
    if (-not $m.Success) { throw 'woff2 URL bulunamadi' }
    $woff2 = $m.Groups[1].Value
    Invoke-WebRequest -Uri $woff2 -UserAgent $ua -OutFile $out -UseBasicParsing
    $sz = [math]::Round((Get-Item $out).Length / 1KB)
    Write-Host ("OK   {0,-13} {1,-22} {2} KB" -f $key, $fam, $sz) -ForegroundColor Green
    $ok++
  } catch {
    Write-Host ("FAIL {0,-13} {1,-22} {2}" -f $key, $fam, $_.Exception.Message) -ForegroundColor Red
    $fail += $key
  }
  Start-Sleep -Milliseconds 200
}

Write-Host ""
Write-Host ("Bitti: {0}/{1} basarili → {2}" -f $ok, $fonts.Count, $dir) -ForegroundColor Cyan
if ($fail.Count) {
  Write-Host ("Basarisiz ({0}): {1}" -f $fail.Count, ($fail -join ', ')) -ForegroundColor Yellow
  Write-Host "Bunlari bana soyle, o fontlar icin alternatif/elle URL ayarlarim." -ForegroundColor Yellow
}
