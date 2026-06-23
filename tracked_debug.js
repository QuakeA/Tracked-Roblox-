// tracked_debug.js — Tracked HATA AVCISI (orta seviye)
// Hem içerik scriptlerinde hem service worker'da yüklenir. Amaç: yakalanmamış hataları,
// promise reddlerini ve eklentinin kendi console.error/warn loglarını TOPLAYIP kaydetmek;
// konsoldan tek komutla dökmek. Varsayılan: sessiz toplar (kullanıcıyı rahatsız etmez),
// detaylı log için TrackedDebug.enable().
//
// KONSOL KULLANIMI:
//   TrackedDebug.dump()    → son hataları tablo + kopyalanabilir metin döndürür
//   TrackedDebug.copy()    → raporu panoya kopyalar (bana yapıştır)
//   TrackedDebug.clear()   → kaydı temizler
//   TrackedDebug.enable()  → detaylı (verbose) mod AÇ   ·  .disable() kapat
//   TrackedDebug.d(...)    → kodun içinden koşullu log (yalnız verbose'da basar)
(function () {
    'use strict';
    const g = (typeof self !== 'undefined') ? self : (typeof window !== 'undefined' ? window : globalThis);
    if (g.TrackedDebug && g.TrackedDebug.__init) return;   // idempotent (aynı dünyada 2. yükleme no-op)

    const MAX = 60;                          // halka tampon boyutu
    const KEY = 'tracked_debug_log';         // storage anahtarı (tüm context'ler birleştirir)
    const MODE_KEY = 'tracked_debug_mode';   // verbose modu

    const VERSION = (() => { try { return chrome.runtime.getManifest().version; } catch (_) { return '?'; } })();
    const CTX = (() => {
        try {
            if (typeof window === 'undefined') return 'sw';
            const p = location.pathname || '';
            if (p.endsWith('popup.html')) return 'popup';
            if (p.endsWith('options.html')) return 'options';
            if (p.endsWith('sidepanel.html')) return 'sidepanel';
            return 'content';
        } catch (_) { return '?'; }
    })();

    const TD = {
        __init: true,
        enabled: false,
        buf: [],
        _timer: null,

        _now() {
            const d = new Date();
            return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
        },

        // Stack'ten "dosya.js:satır" çıkar (eklenti dosyaları)
        _loc(stack) {
            if (!stack) return '';
            const m = String(stack).match(/(?:chrome-extension:\/\/[a-z]+\/)?([\w.-]+\.js):(\d+)(?::\d+)?/);
            return m ? (m[1] + ':' + m[2]) : '';
        },

        capture(type, msg, stack, extra) {
            const rec = {
                t: this._now(), ts: Date.now(), ctx: CTX, v: VERSION, type,
                loc: this._loc(stack),
                msg: String((msg && msg.message) || msg || '').slice(0, 600),
                stack: stack ? String(stack).split('\n').slice(0, 6).join('\n') : '',
                url: (CTX !== 'sw' && typeof location !== 'undefined') ? location.href : ''
            };
            if (extra !== undefined) { try { rec.extra = String(extra).slice(0, 200); } catch (_) {} }
            this.buf.push(rec);
            if (this.buf.length > MAX) this.buf.shift();
            this._persist();
            return rec;
        },

        // Tüm context'lerin hatasını TEK anahtarda birleştir (clobber'ı önlemek için oku→birleştir→yaz)
        _persist() {
            clearTimeout(this._timer);
            this._timer = setTimeout(() => {
                try {
                    chrome.storage.local.get([KEY], (st) => {
                        try {
                            const prev = (st && Array.isArray(st[KEY])) ? st[KEY] : [];
                            const seen = new Set();
                            const merged = prev.concat(this.buf)
                                .sort((a, b) => (a.ts || 0) - (b.ts || 0))
                                .filter(r => { const k = (r.ts || 0) + '|' + (r.msg || ''); if (seen.has(k)) return false; seen.add(k); return true; })
                                .slice(-MAX);
                            chrome.storage.local.set({ [KEY]: merged });
                        } catch (_) {}
                    });
                } catch (_) {}
            }, 500);
        },

        async _all() {
            try {
                const st = await new Promise(r => chrome.storage.local.get([KEY], r));
                if (st && Array.isArray(st[KEY]) && st[KEY].length) return st[KEY];
            } catch (_) {}
            return this.buf;
        },

        async dump() {
            const all = await this._all();
            if (!all.length) { console.log('%c[Tracked] Hata kaydı yok — tertemiz ✔', 'color:#4ad17a;font-weight:700'); return ''; }
            console.groupCollapsed(`%c[Tracked] Son ${all.length} kayıt (v${VERSION})`, 'color:#ff8f84;font-weight:700');
            console.table(all.map(r => ({ saat: r.t, yer: r.ctx, kaynak: r.loc || '—', tip: r.type, mesaj: r.msg })));
            console.groupEnd();
            return this._text(all);
        },

        _text(all) {
            const head = `Tracked rapor — v${VERSION} · ${all.length} kayıt · ${new Date().toLocaleString()}\n` +
                (CTX !== 'sw' && typeof navigator !== 'undefined' ? `UA: ${navigator.userAgent}\n` : '') +
                '─'.repeat(40) + '\n';
            return head + all.map(r =>
                `[${r.t}] (${r.ctx}/v${r.v}) ${r.type}${r.loc ? ' @' + r.loc : ''}\n  ${r.msg}` +
                (r.stack ? '\n  ' + r.stack.replace(/\n/g, '\n  ') : '')
            ).join('\n\n');
        },

        async copy() {
            const text = this._text(await this._all());
            try { await navigator.clipboard.writeText(text); console.log('%c[Tracked] Rapor panoya kopyalandı ✔ — bana yapıştırabilirsin.', 'color:#7fb0ff;font-weight:700'); }
            catch (_) { console.log(text); }
            return text;
        },

        clear() { this.buf = []; try { chrome.storage.local.remove(KEY); } catch (_) {} console.log('[Tracked] Hata kaydı temizlendi.'); },

        enable() { this.enabled = true; try { chrome.storage.local.set({ [MODE_KEY]: true }); } catch (_) {} console.log('%c[Tracked] Debug modu AÇIK (detaylı log).', 'color:#7fb0ff;font-weight:700'); },
        disable() { this.enabled = false; try { chrome.storage.local.set({ [MODE_KEY]: false }); } catch (_) {} console.log('[Tracked] Debug modu kapalı.'); },

        // Kodun içinden: TrackedDebug.d('[trello] xyz', veri) — yalnız verbose'da basar.
        d(...args) { if (this.enabled) { try { console.log('%c[TD]', 'color:#7fb0ff;font-weight:700', ...args); } catch (_) {} } }
    };

    try { chrome.storage.local.get([MODE_KEY], (st) => { if (st && st[MODE_KEY]) TD.enabled = true; }); } catch (_) {}

    // ── Yakalanmamış hatalar (yalnız EKLENTİNİN kendi hataları; sayfanın/Roblox'un değil) ──
    const isOurs = (file, stack) => CTX === 'sw' || /chrome-extension:\/\//.test(String(file || '') + String(stack || ''));

    const onError = (e) => {
        try {
            const err = (e && e.error) || e;
            const stack = (err && err.stack) || '';
            if (!isOurs(e && e.filename, stack)) return;
            TD.capture('error', (err && err.message) || (e && e.message) || 'error', stack);
            if (TD.enabled) console.error('%c[Tracked][HATA]', 'color:#ff6f62;font-weight:700', err);
        } catch (_) {}
    };
    const onRej = (e) => {
        try {
            const r = e && e.reason;
            const stack = (r && r.stack) || '';
            if (stack && !isOurs('', stack)) return;   // stack varsa ve bizim değilse atla
            TD.capture('promise', (r && r.message) || r, stack);
            if (TD.enabled) console.error('%c[Tracked][PROMISE]', 'color:#ffb340;font-weight:700', r);
        } catch (_) {}
    };

    try {
        if (typeof window !== 'undefined') {
            window.addEventListener('error', onError, true);
            window.addEventListener('unhandledrejection', onRej);
        } else if (typeof self !== 'undefined') {
            self.addEventListener('error', onError);
            self.addEventListener('unhandledrejection', onRej);
        }
    } catch (_) {}

    // ── console.error / console.warn yakalama (mevcut [Tracked]/[SW]/[trello]... hataları da kaydedilsin) ──
    try {
        const RX = /^\[(Tracked|SW|trello|DeepScan|ServerWatch|Popup|RecentGames|FreeItems|TradeAnalyzer|Region|AutoPilot)/i;
        ['error', 'warn'].forEach((lvl) => {
            const orig = console[lvl].bind(console);
            console[lvl] = function (...args) {
                try {
                    const first = args[0];
                    if (typeof first === 'string' && RX.test(first)) {
                        const errArg = args.find(a => a && a.stack);
                        const msg = args.map(a => (a && a.message) ? a.message : (a && typeof a === 'object' ? '' : a)).join(' ').trim();
                        TD.capture(lvl === 'error' ? 'console.error' : 'console.warn', msg, errArg ? errArg.stack : '');
                    }
                } catch (_) {}
                return orig.apply(console, args);
            };
        });
    } catch (_) {}

    g.TrackedDebug = TD;
    if (TD.enabled) console.log(`%c[Tracked] Hata avcısı aktif — ${CTX} · v${VERSION}. Dökmek için: TrackedDebug.dump()`, 'color:#7fb0ff;font-weight:700');
})();
