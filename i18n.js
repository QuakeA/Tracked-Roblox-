// i18n.js - Tracked Extension v3.7 - Multi-language Support
// Supports: Turkish (tr), English (en)

const TrackedI18n = {
    currentLocale: 'tr',
    
    translations: {
        tr: {
            // General
            appName: 'Tracked',
            appTagline: 'Smart Activity Tracking',
            
            // Header
            statusReady: 'Hazır',
            statusConnected: 'Bağlandı',
            statusOffline: 'Çevrimdışı',
            statusMeasuring: 'Ölçülüyor...',
            statusError: 'Hata',
            statusReadyCache: 'Hazır (Önbellek)',
            
            // Network Identity
            networkIdentity: 'AĞ KİMLİĞİ',
            analyzing: 'Analiz Ediliyor...',
            ipLocation: 'IP LOKASYON',
            ispNetwork: 'ISP / AĞ',
            directConnection: 'Bağlı',
            probableVPN: 'Muhtemel VPN',
            unknown: 'Bilinmiyor',
            serviceUnavailable: 'Servis Dışı',
            optimum: ' (Optimum)',
            
            // Control Module
            automatic: 'Otomatik',
            manual: 'Elle',
            joinMode: 'Katılma Modu',
            regionSelection: 'Bölge Seçimi',
            select: 'Seçiniz...',
            
            // Join Strategies
            normalJoin: 'Normal Giriş',
            normalJoinDesc: 'Standart Roblox bağlantısı ile oyuna katılır.',
            fastRoute: 'Hızlı Rota (Önerilen)',
            fastRouteDesc: 'En düşük ping değerine sahip bölge üzerinden yönlendirme yapar.',
            
            // Ping Module
            regionalPing: 'Bölgesel Ping',
            networkGrade: 'AĞ NOTU',
            average: 'Ortalama',
            jitter: 'Jitter',
            best: 'En İyi',
            ms: 'ms',
            error: 'Hata',
            timeout: 'Hata/Timeout',
            noData: 'Yeterli veri yok.',
            
            // Library Module
            gameLibrary: 'Oyun Kütüphanesi',
            add: '+ EKLE',
            searchPlaceholder: 'Oyun Ara (İsim veya ID)...',
            emptyLibraryTitle: 'Kütüphaneniz Boş',
            emptyLibraryDesc: 'Roblox oyun sayfasına gidin ve <strong>+ EKLE</strong> butonuna basarak oyunları buraya sabitleyin.',
            emptyRecentGames: 'Roblox\'ta gezindiğin oyunlar burada görünecek',
            inLibrary: 'Kütüphanede',
            addToLibrary: 'Kütüphaneye Ekle',
            noResults: 'Sonuç Bulunamadı',
            noResultsDesc: 'ile eşleşen oyun yok.',
            minutes: 'dk',
            hours: 'sa',
            lessThanMinute: '< 1 dk',
            players: 'Oyuncu',
            newUpdate: 'YENİ GÜNCELLEME!',
            recentGames: 'Son Ziyaret Edilen',
            
            // Scanner
            serverScanner: 'Sunucu Tarayıcı',
            scanning: 'Sunucular taranıyor...',
            connecting: 'Roblox API bağlanıyor...',
            noActiveServer: 'Aktif sunucu bulunamadı.',
            join: 'KATIL',
            scan: 'TARA',
            close: 'Kapat',
            
            // Game Bar
            emptyServer: 'Boş',
            newServer: 'Yeni',
            deepScan: 'Derin',
            copyID: 'ID',
            force: 'Zorla',
            autoPilot: 'Oto-Pilot',
            
            // Modals
            serverFound: 'Sunucu Bulundu!',
            playersCount: 'oyuncu',
            joinQuestion: 'olan bir sunucu bulundu. Katılmak istiyor musun?',
            player: 'OYUNCU',
            ping: 'PING',
            fps: 'FPS',
            cancel: 'VAZGEÇ',
            joinBtn: 'KATIL',
            noServerFound: 'Sunucu Bulunamadı',
            noServerDesc: 'Şu anda uygun bir sunucu bulunmuyor.',
            retry: 'TEKRAR DENE',
            closeBtn: 'KAPAT',
            newServerFound: 'Yeni Sunucu Bulunamadı',
            newServerDesc: 'Şu anda yeni açılmış sunucu bulunmuyor.',
            normalScan: 'NORMAL TARA',
            errorOccurred: 'Hata Oluştu',
            ok: 'TAMAM',
            bestServers: 'En İyi Sunucular',
            serversScanned: 'sunucu tarandı. En iyileri seç:',
            newServersFound: '🌟 Yeni Sunucular Bulundu!',
            freshServers: 'Roblox\'un en son eklediği taze sunucular:',
            veryFresh: 'Çok Taze',
            fresh: 'Taze',
            newBadge: 'Yeni',
            instanceTriggerFailed: 'Instance Trigger Başarısız',
            instanceTriggerDesc: 'Yük dengeleyici yeni instance oluşturmadı.',
            normalScanRetry: 'NORMAL TARA',
            
            // Insight Badges
            eliteServer: 'Elit Sunucu',
            safeUser: 'Güvenli Kullanıcı',
            newUser: 'Yeni Kullanıcı',
            stable: 'Stabil',
            risky: 'Riskli',
            
            // Toasts
            addedToLibrary: 'Kütüphaneye eklendi.',
            addError: 'Eklenirken hata oluştu',
            alreadyInLibrary: 'Bu oyun zaten listenizde ekli.',
            notRobloxPage: 'Lütfen bir Roblox oyun sayfasındayken deneyin.',
            idNotFound: 'Oyun ID\'si URL\'den okunamadı.',
            idCopied: 'ID Kopyalandı!',
            copyError: 'Kopyalama hatası',
            pingMeasureFailed: 'Ping ölçümü başarısız.',
            settingsLoadError: 'Ayarlar yüklenirken hata oluştu.',
            noProbesFound: 'Ayarlarda tanımlı prob bulunamadı.',
            allServersFailed: 'Tüm sunuculardan yanıt alınamadı. Güvenlik duvarınızı kontrol edin.',
            connectingTo: 'Rota: {region} üzerinden bağlanılıyor...',
            rateLimitError: 'Roblox API sınırına ulaşıldı. Lütfen 15 saniye bekleyin.',
            
            // Options Page
            settings: 'Tracked Ayarlar',
            subtitle: 'Performans, görünüm ve bağlantı yapılandırması',
            appearance: 'Görünüm ve Deneyim',
            animations: 'Arka Plan Animasyonları',
            animationsDesc: 'Performans için "blooms" efektlerini kapatabilirsiniz.',
            silentMode: 'Sessiz Mod',
            silentModeDesc: 'Ekran altındaki bilgi mesajlarını (Toast) gizler.',
            connectionSettings: 'Bağlantı Ayarları',
            pingTimeout: 'Ping Zaman Aşımı',
            cacheDuration: 'Önbellek Süresi',
            openNewTab: 'Yeni Sekmede Aç',
            openNewTabDesc: 'Katıl butonuna basınca oyun yeni sekmede açılır.',
            regionParam: 'URL Bölge Parametresi',
            regionParamDesc: 'Linke <code>?rotaRegion=CODE</code> parametresi ekler (Deneysel).',
            probes: 'Ping Noktaları (Problar)',
            probesDesc: 'Bölgesel gecikmeyi ölçmek için kullanılan sunucu adresleri. İsimler sabittir, sadece test adreslerini değiştirebilirsiniz.',
            advanced: 'Gelişmiş',
            dataManagement: 'Veri Yönetimi',
            clearFavorites: 'Favorileri Temizle',
            clearFavoritesDesc: 'Kaydedilen tüm oyunları kütüphaneden siler.',
            clear: 'Temizle',
            resetDefaults: 'Fabrika Ayarlarına Dön',
            resetDefaultsDesc: 'Tüm ayarları ve yapılandırmaları sıfırlar.',
            reset: 'Sıfırla',
            saveSettings: 'Ayarları Kaydet',
            unsavedChanges: 'Değişiklikler var...',
            settingsSaved: 'Ayarlar başarıyla kaydedildi.',
            resetToDefault: 'varsayılana döndü.',
            confirmReset: 'DİKKAT: Tüm ayarları fabrika varsayılanlarına döndürmek istediğinize emin misiniz?',
            factoryReset: 'Fabrika ayarları yüklendi.',
            confirmClearFavs: 'Oyun kütüphanenizdeki TÜM oyunlar silinecek. Emin misiniz?',
            libraryCleared: 'Kütüphane temizlendi.',
            language: 'Dil',
            languageDesc: 'Arayüz dilini seçin.',
            turkish: 'Türkçe',
            english: 'English',

            // v3.8: Options enhancements
            shortcutSave: 'Kaydet',
            performance: 'Performans',
            performanceDesc: 'Force-new-server stratejilerinin davranışı. Default değerler dengelidir — sadece bilinçli oynamak istediğinde değiştir.',
            diagnostics: 'Tanılama',
            diagnosticsDesc: 'Extension\'ın anlık durumu ve depolama bilgisi.',
            reducedMotion: 'Hareket Azalt',
            reducedMotionDesc: 'Tüm animasyonları kapatır (erişilebilirlik).',
            pingTimeoutHint: 'Önerilen: 2000–5000 ms',
            cacheDurationHint: 'Daha uzun = daha az API çağrısı',
            blockTarget: 'Block Hedef Sayısı',
            blockTargetHint: 'A+B için maks. block sayısı (50–200 önerilir)',
            propagationWait: 'Block Yayılma Süresi',
            propagationWaitHint: 'Phase 3 öncesi Roblox cache yayılma süresi (10–20sn ideal)',
            pieces: 'adet',
            seconds: 'sn',
            useFingerprint: 'Avatar Fingerprint Eşleme (C+D)',
            useFingerprintDesc: 'Token→hash eşleme ile server-bazlı surgical block. Düşük block sayısı, yüksek precision.',
            friendsExpansion: 'Friends-of-In-Game Genişletme',
            friendsExpansionDesc: 'Presence-confirmed kullanıcıların arkadaşlarını da hedef listeye ekler. Daha geniş kapsama.',
            aggressiveSnipe: 'Agresif Snipe Polling',
            aggressiveSnipeDesc: 'Daha sık server list polling. Hızlı yakalar ama 429 risk artar.',
            testAll: 'Tümünü Test Et',
            testProbe: 'Test Et',
            addProbe: 'Yeni Prob Ekle',
            diagFavorites: 'Kayıtlı Oyun',
            diagCache: 'Cache Boyutu',
            diagVersion: 'Sürüm',
            diagBaseline: 'Baseline RTT',
            exportSettings: 'Ayarları Dışa Aktar',
            exportSettingsDesc: 'Mevcut yapılandırmayı JSON dosyası olarak indir.',
            export: 'Dışa Aktar',
            importSettings: 'Ayarları İçe Aktar',
            importSettingsDesc: 'Önceden indirilen JSON dosyasından yapılandırmayı yükle.',
            import: 'İçe Aktar',
            clearCache: 'Cache\'i Temizle',
            clearCacheDesc: 'Ping ölçümleri ve geçici verileri temizler.',
            confirmClearCache: 'Cache\'i temizlemek istediğinden emin misin? Ping ölçümleri sıfırlanacak.',
            cacheItemsCleared: 'cache öğesi temizlendi',
            confirmImport: 'İçe aktarma mevcut ayarların üzerine yazacak. Devam edilsin mi?',
            exported: 'Ayarlar dışa aktarıldı.',
            imported: 'Ayarlar içe aktarıldı.',
            importFailed: 'İçe aktarma başarısız: ',
            alreadySaved: 'Zaten kayıtlı.',
            emptyUrl: 'URL boş.',
            promptProbeName: 'Yeni prob için bölge adı (ör. "Türkiye (TR)"):',
            promptProbeUrl: 'Test URL (https://...):',
            added: 'eklendi',
            removed: 'kaldırıldı',
            remove: 'Sil',
            
            // Time units
            minute: 'dakika',
            minutes_plural: 'dakika',
            hour: 'saat',
            hours_plural: 'saat',
            ago: 'önce',
            justNow: 'Az önce',
            minutesAgo: 'dk önce',
            hoursAgo: 'sa önce',
            daysAgo: 'gün önce',
            
            // v1.6: Live Event Detector
            liveEventDetected: 'Canlı Etkinlik!',
            emptyServerScan: 'Boş Sunucu Tara',
            remindLater: 'Sonra Hatırlat',
            remindLaterMessage: '10 dakika sonra tekrar hatırlatılacak',
            eventAnalysis: 'Etkinlik Kontrolü',
            eventYes: 'CANLI ETKINLIK VAR',
            eventNo: 'AKTIF ETKINLIK YOK',
            eventMaybe: 'OLASI ETKINLIK',
            eventReady: 'Şimdi katılmak için hazır!',
            eventNotReady: 'Şu anda herhangi bir etkinlik yok',
            eventCheck: 'Kesin değil, kontrol edin',
            event_rec_definite: '🔴 KESİN: Etkinlik şu anda aktif! Hemen katıl.',
            event_rec_possible: '🟡 OLASI: Etkinlik olabilir, kontrol etmelisin.',
            event_rec_none: '✅ YOK: Şu anda aktif bir etkinlik görünmüyor.',
            signalsFound: 'Tespit Edilen Sinyaller',
            totalScore: 'Toplam Skor',
            eventLive: 'CANLI ETKINLIK VAR',
            eventPossible: 'OLASI ETKINLIK',
            eventNone: 'AKTIF ETKINLIK YOK',
            eventRecommended: 'Şimdi katılmak için hazır!',
            hybridEventAnalysis: 'Hybrid Event Analysis',
            analyzingText: 'Analiz ediliyor...',
            analysisDetails: 'Metin + Oyuncu + Zaman + API',
            detectedSignals: 'Tespit Edilen Sinyaller',
            noSignals: 'Tespit edilen sinyal yok',
            threshold: 'Eşik',
            definite: 'Kesin',
            refresh: 'Yenile',
            refreshWait: 'Lütfen bekleyin...',
            
            // v1.6.2: Friends
            friendsOnline: 'Arkadaşlar',
            
            // Countries
            countryGermany: 'Almanya',
            countryNetherlands: 'Hollanda',
            countryFrance: 'Fransa',
            countryPoland: 'Polonya',
            countryRomania: 'Romanya',
            countryDE: 'Almanya',
            countryNL: 'Hollanda',
            countryFR: 'Fransa',
            countryPL: 'Polonya',
            countryRO: 'Romanya',
            friendsEmpty: 'Kütüphanenizdeki oyunlarda çevrimiçi arkadaşınız bulunmuyor',
            friendsNotLoggedIn: 'Roblox\'a giriş yapmalısınız',
            lastUpdate: 'Son güncelleme',

            // v3.7.1: Hardcoded string fixleri
            historyCleared: 'Geçmiş temizlendi',
            launching: 'BAŞLATILIYOR...',
            noActiveTab: 'Aktif sekme bulunamadı.',
            joinNow: '🎮 Hemen Katıl',
            closeNotification: '🔔 Kapat',
            inGame: 'Oyunda',
            sidePanelUnsupported: 'Tarayıcınız yan paneli desteklemiyor',
            sidePanelOpenFailed: 'Yan panel açılamadı',
            sidePanelPinned: 'Yan panel açıldı',
            sidePanelClosed: 'Yan panel kapatıldı',
            sidePanel: 'Yan Panel',
            // Auto-Reconnect / Crash Recovery
            reconnectTitle: '🔄 Bağlantı Kesildi',
            reconnectMessage: '{game} oynamaktaydın. Geri dönmek ister misin?',
            reconnectSameServer: 'Aynı Server\'a Dön',
            reconnectNewServer: 'Yeni Server',
            reconnectGenericRejoin: 'Yeniden Gir',
            reconnectFallbackTitle: 'Roblox Oturumu Sürmedi',
            // Settings
            autoReconnect: 'Otomatik Yeniden Bağlanma',
            autoReconnectDesc: 'Oyun aniden kapanırsa (crash, kick, network drop) extension bunu tespit edip aynı server\'a tek tıkla geri dönmeni sağlar.',
            autoReconnectEnabled: 'Auto-Reconnect Aktif',
            autoReconnectEnabledDesc: 'Crash tespiti yapılır ve oyuna girdiğinde Roblox sayfasında modal gösterilir. Kapalıysa hiçbir tespit yapılmaz.',
            autoReconnectNative: 'Sistem Bildirimini de Göster',
            autoReconnectNativeDesc: 'Roblox sayfası kapalıyken sağ alt köşede Chrome\'un native bildirimi de çıkar. Kapalıysa sadece in-page modal kullanılır.',
            loadError: 'Yüklenirken hata oluştu',
            adBlockerBlocked: 'Ad-blocker Roblox API\'sini engelliyor — kapatıp tekrar dene',
            apiBlocked: 'Roblox API Engellendi',
            adBlockerExplain: 'Tarayıcındaki ad-blocker (uBlock, AdBlock vb.) Roblox API\'sini engelliyor. Bu sayfa için ad-blocker\'ı kapatıp tekrar dene.',
            retry: 'Tekrar Dene',
            noFriends: 'Arkadaşınız yok.',
            processing: 'İşlem devam ediyor...',
            scanError: 'Tarama hatası',
            joinSameServerTip: 'Arkadaşınla aynı sunucuya gir',
            joinGameTip: 'Oyuna katıl',
            eventAnalysisTip: 'Etkinlik Analizi',
            deleteGame: 'Oyunu Sil',
            analyze: 'Analiz Et',
            playerSpike: 'Oyuncu Artışı',
            eventTextSignal: 'Etkinlik Metni',
            toggleTheme: 'Temayı Değiştir',
            settingsBtn: 'Ayarlar',
            toggleGraph: 'Grafik',
            pinPanel: 'Yan Panele Sabitle',
            closePanel: 'Paneyi Kapat',
            refreshFriends: 'Arkadaşları Yenile',
            clearRecent: 'Geçmişi Temizle',
            cooldownWait: 'Lütfen {n} saniye bekleyiniz',
            filterMaxPing: 'Max Ping',
            filterMaxPlayers: 'Max Oyuncu',
            filterMinFps: 'Min FPS',
            filterNoResults: 'Filtre eşleşmedi',
            sortByScore: 'SKOR',
            copyJobId: 'Job ID kopyala',
            jobIdCopied: 'Job ID kopyalandı',
        },
        
        en: {
            // General
            appName: 'Tracked',
            appTagline: 'Smart Activity Tracking',
            
            // Header
            statusReady: 'Ready',
            statusConnected: 'Connected',
            statusOffline: 'Offline',
            statusMeasuring: 'Measuring...',
            statusError: 'Error',
            statusReadyCache: 'Ready (Cache)',
            
            // Network Identity
            networkIdentity: 'NETWORK IDENTITY',
            analyzing: 'Analyzing...',
            ipLocation: 'IP LOCATION',
            ispNetwork: 'ISP / NETWORK',
            directConnection: 'Connected',
            probableVPN: 'Possible VPN',
            unknown: 'Unknown',
            serviceUnavailable: 'Service Unavailable',
            optimum: ' (Optimum)',
            
            // Control Module
            automatic: 'Automatic',
            manual: 'Manual',
            joinMode: 'Join Mode',
            regionSelection: 'Region Selection',
            select: 'Select...',
            
            // Join Strategies
            normalJoin: 'Normal Join',
            normalJoinDesc: 'Join game using standard Roblox connection.',
            fastRoute: 'Fast Route (Recommended)',
            fastRouteDesc: 'Route through the region with lowest ping.',
            
            // Ping Module
            regionalPing: 'Regional Ping',
            networkGrade: 'NETWORK GRADE',
            average: 'Average',
            jitter: 'Jitter',
            best: 'Best',
            ms: 'ms',
            error: 'Error',
            timeout: 'Error/Timeout',
            noData: 'Not enough data.',
            
            // Library Module
            gameLibrary: 'Game Library',
            add: '+ ADD',
            searchPlaceholder: 'Search games (Name or ID)...',
            emptyLibraryTitle: 'Your Library is Empty',
            emptyLibraryDesc: 'Go to a Roblox game page and click <strong>+ ADD</strong> to pin games here.',
            emptyRecentGames: 'Games you visit on Roblox will appear here',
            inLibrary: 'In Library',
            addToLibrary: 'Add to Library',
            noResults: 'No Results Found',
            noResultsDesc: 'No games match',
            minutes: 'min',
            hours: 'h',
            lessThanMinute: '< 1 min',
            players: 'Players',
            newUpdate: 'NEW UPDATE!',
            recentGames: 'Recent Games',
            
            // Scanner
            serverScanner: 'Server Scanner',
            scanning: 'Scanning servers...',
            connecting: 'Connecting to Roblox API...',
            noActiveServer: 'No active servers found.',
            join: 'JOIN',
            scan: 'SCAN',
            close: 'Close',
            
            // Game Bar
            emptyServer: 'Empty',
            newServer: 'New',
            deepScan: 'Deep',
            copyID: 'ID',
            force: 'Force',
            autoPilot: 'Auto-Pilot',
            
            // Modals
            serverFound: 'Server Found!',
            playersCount: 'players',
            joinQuestion: 'server found. Would you like to join?',
            player: 'PLAYERS',
            ping: 'PING',
            fps: 'FPS',
            cancel: 'CANCEL',
            joinBtn: 'JOIN',
            noServerFound: 'No Server Found',
            noServerDesc: 'No suitable server available at the moment.',
            retry: 'TRY AGAIN',
            closeBtn: 'CLOSE',
            newServerFound: 'No New Server Found',
            newServerDesc: 'No newly created servers available at the moment.',
            normalScan: 'NORMAL SCAN',
            errorOccurred: 'An Error Occurred',
            ok: 'OK',
            bestServers: 'Best Servers',
            serversScanned: 'servers scanned. Choose the best:',
            newServersFound: '🌟 New Servers Found!',
            freshServers: 'Fresh servers recently added by Roblox:',
            veryFresh: 'Very Fresh',
            fresh: 'Fresh',
            newBadge: 'New',
            instanceTriggerFailed: 'Instance Trigger Failed',
            instanceTriggerDesc: 'Load balancer did not create a new instance.',
            normalScanRetry: 'NORMAL SCAN',
            
            // Insight Badges
            eliteServer: 'Elite Server',
            safeUser: 'Safe User',
            newUser: 'New User',
            stable: 'Stable',
            risky: 'Risky',
            
            // Toasts
            addedToLibrary: 'Added to library.',
            addError: 'Error adding to library',
            alreadyInLibrary: 'This game is already in your library.',
            notRobloxPage: 'Please try this on a Roblox game page.',
            idNotFound: 'Could not read game ID from URL.',
            idCopied: 'ID Copied!',
            copyError: 'Copy error',
            pingMeasureFailed: 'Ping measurement failed.',
            settingsLoadError: 'Error loading settings.',
            noProbesFound: 'No probes defined in settings.',
            allServersFailed: 'Could not reach any servers. Check your firewall.',
            connectingTo: 'Route: Connecting via {region}...',
            rateLimitError: 'Roblox API rate limit reached. Please wait 15 seconds.',
            
            // Options Page
            settings: 'Tracked Settings',
            subtitle: 'Performance, appearance and connection configuration',
            appearance: 'Appearance & Experience',
            animations: 'Background Animations',
            animationsDesc: 'Disable "blooms" effects for better performance.',
            silentMode: 'Silent Mode',
            silentModeDesc: 'Hides toast messages at the bottom of the screen.',
            connectionSettings: 'Connection Settings',
            pingTimeout: 'Ping Timeout',
            cacheDuration: 'Cache Duration',
            openNewTab: 'Open in New Tab',
            openNewTabDesc: 'Opens game in a new tab when join button is clicked.',
            regionParam: 'URL Region Parameter',
            regionParamDesc: 'Adds <code>?rotaRegion=CODE</code> parameter to link (Experimental).',
            probes: 'Ping Probes',
            probesDesc: 'Server addresses used to measure regional latency. Names are fixed, only test addresses can be changed.',
            advanced: 'Advanced',
            dataManagement: 'Data Management',
            clearFavorites: 'Clear Favorites',
            clearFavoritesDesc: 'Removes all saved games from library.',
            clear: 'Clear',
            resetDefaults: 'Reset to Factory Defaults',
            resetDefaultsDesc: 'Resets all settings and configurations.',
            reset: 'Reset',
            saveSettings: 'Save Settings',
            unsavedChanges: 'Unsaved changes...',
            settingsSaved: 'Settings saved successfully.',
            resetToDefault: 'reset to default.',
            confirmReset: 'WARNING: Are you sure you want to reset all settings to factory defaults?',
            factoryReset: 'Factory settings loaded.',
            confirmClearFavs: 'ALL games in your library will be deleted. Are you sure?',
            libraryCleared: 'Library cleared.',
            language: 'Language',
            languageDesc: 'Select interface language.',
            turkish: 'Türkçe',
            english: 'English',

            // v3.8: Options enhancements
            shortcutSave: 'Save',
            performance: 'Performance',
            performanceDesc: 'Force-new-server strategy behavior. Defaults are balanced — only change if you know what you\'re doing.',
            diagnostics: 'Diagnostics',
            diagnosticsDesc: 'Extension status and storage information.',
            reducedMotion: 'Reduce Motion',
            reducedMotionDesc: 'Disables all animations (accessibility).',
            pingTimeoutHint: 'Recommended: 2000–5000 ms',
            cacheDurationHint: 'Longer = fewer API calls',
            blockTarget: 'Block Target Count',
            blockTargetHint: 'Max blocks for A+B (50–200 recommended)',
            propagationWait: 'Block Propagation Time',
            propagationWaitHint: 'Roblox cache propagation before Phase 3 (10–20s ideal)',
            pieces: 'pcs',
            seconds: 's',
            useFingerprint: 'Avatar Fingerprint Match (C+D)',
            useFingerprintDesc: 'Server-level surgical block via token→hash matching. Lower block count, higher precision.',
            friendsExpansion: 'Friends-of-In-Game Expansion',
            friendsExpansionDesc: 'Adds friends of presence-confirmed users to target list. Wider coverage.',
            aggressiveSnipe: 'Aggressive Snipe Polling',
            aggressiveSnipeDesc: 'More frequent server list polling. Faster catch but higher 429 risk.',
            testAll: 'Test All',
            testProbe: 'Test',
            addProbe: 'Add New Probe',
            diagFavorites: 'Saved Games',
            diagCache: 'Cache Size',
            diagVersion: 'Version',
            diagBaseline: 'Baseline RTT',
            exportSettings: 'Export Settings',
            exportSettingsDesc: 'Download current configuration as JSON file.',
            export: 'Export',
            importSettings: 'Import Settings',
            importSettingsDesc: 'Load configuration from a previously downloaded JSON file.',
            import: 'Import',
            clearCache: 'Clear Cache',
            clearCacheDesc: 'Clears ping measurements and temporary data.',
            confirmClearCache: 'Are you sure you want to clear the cache? Ping measurements will be reset.',
            cacheItemsCleared: 'cache items cleared',
            confirmImport: 'Importing will overwrite current settings. Continue?',
            exported: 'Settings exported.',
            imported: 'Settings imported.',
            importFailed: 'Import failed: ',
            alreadySaved: 'Already saved.',
            emptyUrl: 'URL is empty.',
            promptProbeName: 'Region name for new probe (e.g. "Turkey (TR)"):',
            promptProbeUrl: 'Test URL (https://...):',
            added: 'added',
            removed: 'removed',
            remove: 'Remove',

            // Time units
            minute: 'minute',
            minutes_plural: 'minutes',
            hour: 'hour',
            hours_plural: 'hours',
            ago: 'ago',
            justNow: 'Just now',
            minutesAgo: 'min ago',
            hoursAgo: 'h ago',
            daysAgo: 'days ago',
            
            // v1.6: Live Event Detector
            liveEventDetected: 'Live Event!',
            emptyServerScan: 'Scan Empty Servers',
            remindLater: 'Remind Later',
            remindLaterMessage: 'Will remind again in 10 minutes',
            eventAnalysis: 'Event Check',
            eventYes: 'LIVE EVENT ACTIVE',
            eventNo: 'NO ACTIVE EVENT',
            eventMaybe: 'POSSIBLE EVENT',
            eventReady: 'Ready to join now!',
            eventNotReady: 'No event currently active',
            eventCheck: 'Uncertain, please check',
            event_rec_definite: '🔴 DEFINITE: Event is currently active! Join now.',
            event_rec_possible: '🟡 POSSIBLE: Event might be active, you should check.',
            event_rec_none: '✅ NONE: No active event currently visible.',
            signalsFound: 'Detected Signals',
            totalScore: 'Total Score',
            eventLive: 'LIVE EVENT ACTIVE',
            eventPossible: 'POSSIBLE EVENT',
            eventNone: 'NO ACTIVE EVENT',
            eventRecommended: 'Ready to join now!',
            hybridEventAnalysis: 'Hybrid Event Analysis',
            analyzingText: 'Analyzing...',
            analysisDetails: 'Text + Players + Time + API',
            detectedSignals: 'Detected Signals',
            noSignals: 'No signals detected',
            threshold: 'Threshold',
            definite: 'Definite',
            refresh: 'Refresh',
            refreshWait: 'Please wait...',

            // v1.6.2: Friends
            friendsOnline: 'Friends',
            
            // Countries
            countryGermany: 'Germany',
            countryNetherlands: 'Netherlands',
            countryFrance: 'France',
            countryPoland: 'Poland',
            countryRomania: 'Romania',
            countryDE: 'Germany',
            countryNL: 'Netherlands',
            countryFR: 'France',
            countryPL: 'Poland',
            countryRO: 'Romania',
            friendsEmpty: 'No friends online in your library games',
            friendsNotLoggedIn: 'Please log in to Roblox',
            lastUpdate: 'Last update',

            // v3.7.1: Hardcoded string fixes
            historyCleared: 'History cleared',
            launching: 'LAUNCHING...',
            noActiveTab: 'No active tab found.',
            joinNow: '🎮 Join Now',
            closeNotification: '🔔 Close',
            inGame: 'In Game',
            sidePanelUnsupported: 'Your browser does not support the side panel',
            sidePanelOpenFailed: 'Could not open side panel',
            sidePanelPinned: 'Side panel opened',
            sidePanelClosed: 'Side panel closed',
            sidePanel: 'Side Panel',
            // Auto-Reconnect / Crash Recovery
            reconnectTitle: '🔄 Connection Lost',
            reconnectMessage: 'You were playing {game}. Want to reconnect?',
            reconnectSameServer: 'Rejoin Same Server',
            reconnectNewServer: 'New Server',
            reconnectGenericRejoin: 'Rejoin',
            reconnectFallbackTitle: 'Roblox Session Ended',
            // Settings
            autoReconnect: 'Auto-Reconnect',
            autoReconnectDesc: 'If the game crashes (server crash, kick, network drop), extension detects it and lets you rejoin the same server with one click.',
            autoReconnectEnabled: 'Auto-Reconnect Enabled',
            autoReconnectEnabledDesc: 'Detects crashes and shows an in-page modal on Roblox tabs. Disabled = no detection at all.',
            autoReconnectNative: 'Show System Notification',
            autoReconnectNativeDesc: 'Also show Chrome\'s native notification when Roblox tab is closed. Disabled = only in-page modal.',
            loadError: 'Failed to load',
            adBlockerBlocked: 'Ad-blocker is blocking the Roblox API — disable it and retry',
            apiBlocked: 'Roblox API Blocked',
            adBlockerExplain: 'Your browser\'s ad-blocker (uBlock, AdBlock, etc.) is blocking the Roblox API. Disable it for this page and retry.',
            retry: 'Retry',
            noFriends: 'You have no friends.',
            processing: 'Processing...',
            scanError: 'Scan error',
            joinSameServerTip: 'Join same server as friend',
            joinGameTip: 'Join game',
            eventAnalysisTip: 'Event Analysis',
            deleteGame: 'Delete Game',
            analyze: 'Analyze',
            playerSpike: 'Player Spike',
            eventTextSignal: 'Event Text',
            toggleTheme: 'Toggle Theme',
            settingsBtn: 'Settings',
            toggleGraph: 'Graph',
            pinPanel: 'Pin to Side Panel',
            closePanel: 'Close Panel',
            refreshFriends: 'Refresh Friends',
            clearRecent: 'Clear History',
            cooldownWait: 'Please wait {n}s',
            filterMaxPing: 'Max Ping',
            filterMaxPlayers: 'Max Players',
            filterMinFps: 'Min FPS',
            filterNoResults: 'No servers match',
            sortByScore: 'SCORE',
            copyJobId: 'Copy Job ID',
            jobIdCopied: 'Job ID copied',
        }
    },
    
    // Get translated text
    t(key, params = {}) {
        const translation = this.translations[this.currentLocale]?.[key] || 
                           this.translations['tr']?.[key] || 
                           key;
        
        // Replace parameters
        return translation.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    },
    
    // Set locale
    setLocale(locale) {
        if (this.translations[locale]) {
            this.currentLocale = locale;
            return true;
        }
        return false;
    },
    
    // Get current locale
    getLocale() {
        return this.currentLocale;
    },
    
    // Get translated country name
    getCountryName(code) {
        const map = {
            'DE': this.t('countryGermany'),
            'NL': this.t('countryNetherlands'),
            'FR': this.t('countryFrance'),
            'PL': this.t('countryPoland'),
            'RO': this.t('countryRomania')
        };
        return map[code] || code;
    },

    // Convert internal probe key like "Almanya (DE)" → "Germany (DE)" based on current locale
    localizeRegionName(key) {
        if (!key) return key;
        const match = key.match(/\(([A-Z]{2})\)/);
        if (match) {
            const code = match[1];
            return `${this.getCountryName(code)} (${code})`;
        }
        return key;
    },
    
    // Get available locales
    getAvailableLocales() {
        return [
            { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
            { code: 'en', name: 'English', flag: '🇬🇧' }
        ];
    },
    
    // Format relative time
    formatTimeAgo(date, locale = this.currentLocale) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        
        if (minutes < 1) return locale === 'tr' ? 'az önce' : 'just now';
        if (minutes < 60) return `${minutes} ${this.t(minutes === 1 ? 'minute' : 'minutes_plural')} ${this.t('ago')}`;
        if (hours < 24) return `${hours} ${this.t(hours === 1 ? 'hour' : 'hours_plural')} ${this.t('ago')}`;
        
        return date.toLocaleDateString(locale);
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.TrackedI18n = TrackedI18n;
    window.t = (key, params) => TrackedI18n.t(key, params);
}

