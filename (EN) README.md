<div align="center">

<img src="icons/icon128.png" alt="Tracked Logo" width="120"/>

# Tracked — Roblox Route Optimizer

**Smart server selection, crash recovery & real-time ping analytics**

[![Manifest](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](manifest.json)
[![Version](https://img.shields.io/badge/version-1.7.0-blue?style=flat-square)](manifest.json)
![License](https://img.shields.io/badge/License-All_Rights_Reserved-red?style=flat-square)
[![Roblox](https://img.shields.io/badge/Roblox-compatible-E2231A?style=flat-square&logo=roblox&logoColor=white)](https://roblox.com)
[![i18n](https://img.shields.io/badge/i18n-EN-orange?style=flat-square)](i18n.js)

</div>

---

## ✨ Overview

**Tracked** is a Chrome extension for Roblox users that offers advanced features such as finding the _closest regional server_, _crash recovery_ to return to the same server with a single click, _ping & VPN detection_, _live event notifications_, and _automatic server selection (auto-pilot)_.

Roblox's own web client settles for a single "Play" button — Tracked runs **parallel background server scanning**, **regional AWS ping measurement**, and **intelligent scoring algorithms** to optimize the gaming experience.

> 🌍 **Language support**: English and Turkish — switchable instantly from the popup/options page.

---

## 🚀 Key Features

### 🔄 Auto-Reconnect (Crash Recovery)
- Automatic detection after **crash, network drop, or ALT+F4** (within 15-30s)
- Theme-aware in-page overlay: _"Return to Same Server"_ or _"Optimal Server"_
- Roblox's own "Play" button forgets the jobId — Tracked **persistently stores placeId + jobId**, so you can return to the same server as your teammates with a single click
- Home page, profile, avatar — the overlay appears on _whatever Roblox page you're on_
- User-toggleable in settings; optional system notification (default off)

### 🛡️ Auto-Pilot (Smart Server Selector)
- **Regional ping awareness**: Measures your AWS region pings and sets a dynamic cap of `MAX_PING = bestRegion + 60ms`
- Parallel `Asc + Desc` pagination — 2x scan speed
- Multi-page candidate accumulation (8+ candidates) → picks the best score (1.5s)
- High-quality score based on FPS health + ping penalty combination
- Connects to an _empty + healthy + low-ping_ server with a single click

### 🎯 Force Join (Block-and-Join)
- 3-phase forced-join engine: fast scan → ambush → infiltration
- Token Bucket + AIMD rate-limit friendly polling
- **Block-flood**: Temporarily adds full servers to a block list → forces Roblox matchmaker to a new server
- 🔒 **Security guarantee**: Friends / followers / following are **NEVER** blocked
- A+B (block + new), C+D (fingerprint matching), Force Join (direct jobId) modes

### 📡 Regional Ping Measurement
- 5 AWS region probes (Germany, Netherlands, France, Poland, Romania) — customizable
- Ultra-stable algorithm: warmup + median + RFC 3550 jitter calculation
- Best-of-N strategy (median of the lowest 3 samples)
- 10-minute persistent cache → popup opens instantly

### 🌐 Network Identity (VPN Detection)
- IP / ISP / country detection (3-provider fallback chain)
- **VPN heuristic**: Browser timezone vs IP timezone comparison
- 10-minute cache (previous version made a network call on every open — fixed)

### 🎮 Live Event Detection
- Game library tracking — monitors player count spikes in favorite games
- Automatic notification: _"Event Y started in game X"_ (5-minute poll)
- Playtime counter when active tab is open

### 🛠️ Side Panel + Popup
- Modern glassmorphism UI (Apple-inspired)
- Light + dark theme
- Pin/unpin sidebar — allows users to see teammates' online status while working
- Recent games, friends list, server scanner modals

### 🌟 Sticky In-Game Bar
- Status bar injected into the Roblox game page
- 5 main buttons: Find New, Deep Scan, Force Join, C+D Targeted, Auto-Pilot
- SPA navigation watcher — fixed the issue where it was getting lost in Roblox's client-side routing

---

## 📦 Installation

### Manual Load (Developer Mode)

1. Clone this repo or download as ZIP:
   ```bash
   git clone https://github.com/QuakeA/tracked-roblox-route-optimizer.git
   ```
2. Go to `chrome://extensions/` in Chrome
3. Turn on **Developer mode** from the top right
4. Click **Load unpacked** → select the cloned folder
5. ✅ Tracked is now active. The bar will automatically appear on roblox.com.

### Chrome Web Store
> 🚧 _Coming soon. Manual installation is currently recommended._

---

## ⚙️ Configuration

Customizations accessible from the `Options` page:

| Category | Setting | Description |
|----------|---------|-------------|
| 🌍 **Language** | EN / TR | Changes instantly, no page refresh needed |
| 🎨 **Appearance** | Light/Dark, Reduced Motion | Accessibility-friendly |
| 📡 **Ping Probes** | Custom AWS endpoints | Add your own region |
| ⏱️ **Cache** | 1-60 min | TTL for ping results |
| 🔄 **Auto-Reconnect** | On/Off, Native notification | Crash recovery toggle |
| 🎯 **Force Join** | Block target, Propagation, Fingerprint, Aggressive snipe | Power user settings |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Service Worker                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Auto-Reconn. │  │ Game Library │  │ Live Event │ │
│  │ Monitor      │  │ Tracker      │  │ Detector   │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│  ┌──────────────────────────────────────────────┐   │
│  │ Background Ping Measurement (5 regions)      │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
            ▲                              ▲
            │ chrome.runtime.sendMessage   │
            │                              │
┌───────────┴──────────┐    ┌─────────────┴──────────┐
│  Content Scripts     │    │  Popup / Side Panel    │
│  ┌────────────────┐  │    │  ┌──────────────────┐  │
│  │ main.js (bar)  │  │    │  │ popup.js         │  │
│  │ scanner.js     │  │    │  │ sidepanel.js     │  │
│  │ instance_      │  │    │  │ options.js       │  │
│  │   trigger.js   │  │    │  └──────────────────┘  │
│  │ reconnect_     │  │    │                        │
│  │   overlay.js   │  │    │                        │
│  └────────────────┘  │    └────────────────────────┘
└──────────────────────┘
```

**Data flow**:
- `chrome.storage.local` — settings, ping cache, favorites, active session, NetID cache
- `chrome.alarms` — periodic triggers (30s, 1min, 5min, 10min)
- `chrome.runtime.onConnect` — port-based side panel state tracking
- `chrome.scripting.executeScript({ world: 'MAIN' })` — matchmaker bypass in Roblox page context

---

## 🛡️ Privacy & Security

- ✅ **No telemetry** — no statistics or usage data is sent
- ✅ **All data is local** — `chrome.storage.local` (stays on device)
- ✅ **3rd party APIs**: only for IP/ISP detection via ipinfo.io / ipwho.is / ipapi.co (10-minute cache, optional)
- ✅ **Open source** — full code is in this repo
- ✅ **Social safety**: friends/followers/following are **absolutely excluded** from block-flood

The `host_permissions` list can be seen in `manifest.json` — only roblox.com subdomains and necessary helper services.

---

## 🐛 Known Limitations

- **Roblox API's `ping` field is NOT user-server ping** — it's an internal server health metric. The "Optimal Server" button therefore uses Roblox's IP-based matchmaker (most reliable).
- **Chrome alarm minimum is 30s** — for faster polling, a fast-recheck timeout combination is used.
- **Block-flood may take 5 minutes** on Roblox's side; the `unblockAfterJoin` mechanism cleans up after auto-pilot usage.
- **Ad-blockers** may block ipwho.is / ipapi.co — fallback chain switches to ipinfo.io, no issue.

---

## 🧪 Testing

```bash
# Syntax check
node --check service_worker.js
node --check main.js
node --check reconnect_overlay.js
# ... other .js files

# Manifest validation
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```

**Auto-Reconnect manual test**:
```js
// Service Worker DevTools console
chrome.runtime.sendMessage({ action: 'testCrashNotification' }, console.log);
```

---

## 🛡️ Legal Notice & Copyright

![Copyright](https://img.shields.io/badge/Copyright-2026_Darkzzers-red?style=for-the-badge&logo=github)
![User](https://img.shields.io/badge/GitHub-QuakeA-blue?style=for-the-badge&logo=github)
![License](https://img.shields.io/badge/License-All_Rights_Reserved-black?style=for-the-badge)

**This project is private and strictly closed-source.**

> [!CAUTION]
> **Copyright © 2026 Darkzzers.** All rights reserved. 
> Any unauthorized copying, distribution, or use of this software will result in legal action. 
> All rights to this project belong solely to the developer: **Darkzzers (QuakeA)**

---

## 💬 Contact & Support

- 📧 **Email**: [slayer38tr@gmail.com](mailto:slayer38tr@gmail.com)
- ⭐ **If you like it**, don't forget to star the repo — it supports the project!

---

<div align="center">

**For Roblox users** <img src="https://cdn.simpleicons.org/roblox/FFFFFF" height="18" align="center" alt="Roblox">

_This project is not affiliated with Roblox Corporation._

</div>