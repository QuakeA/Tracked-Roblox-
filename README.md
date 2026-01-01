# Tracked - Roblox Extension

Tracked is a Chrome Extension designed for Roblox users (specifically Turkish localization) to manage favorite games and estimate connection latency to various European regions.

## Features
- **Oyun Kütüphanesi (Library):** Save games from the current tab.
- **Bölgesel Ping (Regional Ping):** Estimates HTTP latency to configurable endpoints (DE, NL, FR, PL, RO).
- **Hızlı Rota (Route Suggestion):** Suggests the best region based on latency (UI label).
- **Dark Glass UI:** Premium iOS/visionOS aesthetic.

## Installation (Developer Mode)

1. Download/Unzip the source code.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.

## Privacy & Permissions

This extension is **Local Only**. No data is sent to external analytics servers.

- **Storage:** Used to save your favorite games and settings locally.
- **ActiveTab:** Used to read the Game ID and Title when you click "+ EKLE" on a Roblox page.
- **Host Permissions:**
  - `https://www.roblox.com/*`: To detect game pages.
  - `http://*/*` & `https://*/*`: Required to ping the custom probe endpoints defined in settings.

## Configuration

In **Ayarlar (Options)**, you can configure:
- **Ping Timeout:** How long to wait for a probe response.
- **Probes:** The URLs used to measure latency. Default is Google favicons for stability. You can change these to any HTTP endpoint you prefer for testing.

## Troubleshooting

1. **Ping shows "Timeout" or "Error":**
   - Ensure you have internet connection.
   - The probe URL might be blocked by CORS or Firewall. Try resetting defaults in Options.
   
2. **"Oyun Kütüphanesi" not adding game:**
   - Make sure you are on a specific game page (URL must contain `/games/NUMBER/`).
   - Refresh the page and try again.

## Test Plan (QA Checklist)

- [ ] **Installation:** Load unpacked extension without errors.
- [ ] **Add Favorite:** Go to a Roblox game page, open extension, click "+ EKLE". Verify item appears with correct title.
- [ ] **Duplicate Check:** Click "+ EKLE" again. Verify "Zaten listenizde" toast appears and **does not overlap** other buttons.
- [ ] **Ping:** Open extension. Verify ping list loads with green/yellow/red dots. Click refresh and verify spinner.
- [ ] **Scroll:** Add 5+ games. Verify the list scrolls smoothly and header/footer remain fixed.
- [ ] **Dropdown:** Click "Katılma Modu". Verify dropdown opens **on top** of everything (Portal implementation) and doesn't get cut off.
- [ ] **Manual Mode:** Switch to "Elle". Verify "Bölge Seçimi" dropdown appears. Select a region.
- [ ] **Join:** Click "KATIL". Verify it opens the game page (same tab or new tab based on settings).
- [ ] **Delete:** Click the trash icon. Verify item is removed instantly.
- [ ] **Options:** Go to Ayarlar. Change timeout to 5000. Save. Re-open extension to verify persistence.