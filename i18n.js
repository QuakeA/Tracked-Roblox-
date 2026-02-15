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
            directConnection: 'Direkt Bağlantı',
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
            noResults: 'Sonuç Bulunamadı',
            noResultsDesc: 'ile eşleşen oyun yok.',
            minutes: 'dk',
            hours: 'sa',
            lessThanMinute: '< 1 dk',
            players: 'Oyuncu',
            newUpdate: 'YENİ GÜNCELLEME!',
            
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
            
            // Time units
            minute: 'dakika',
            minutes_plural: 'dakika',
            hour: 'saat',
            hours_plural: 'saat',
            ago: 'önce'
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
            directConnection: 'Direct Connection',
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
            noResults: 'No Results Found',
            noResultsDesc: 'No games match',
            minutes: 'min',
            hours: 'h',
            lessThanMinute: '< 1 min',
            players: 'Players',
            newUpdate: 'NEW UPDATE!',
            
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
            
            // Time units
            minute: 'minute',
            minutes_plural: 'minutes',
            hour: 'hour',
            hours_plural: 'hours',
            ago: 'ago'
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

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrackedI18n;
}
