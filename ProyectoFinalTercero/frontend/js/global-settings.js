const DEFAULT_SETTINGS = {
    darkMode: false,
    fontSize: 'medium',
    animations: true,
    language: 'es',
    highContrast: false,
    colorBlindMode: false,
    colorBlindType: 'none'
};

window.GameSettings = {
    get: function() {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            try {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Error al cargar configuraciones:', e);
                return { ...DEFAULT_SETTINGS };
            }
        }
        return { ...DEFAULT_SETTINGS };
    },

    set: function(settings) {
        const current = this.get();
        const updated = { ...current, ...settings };
        localStorage.setItem('gameSettings', JSON.stringify(updated));
        this.apply(updated);
        return updated;
    },

    apply: function(settings = null) {
        const config = settings || this.get();
        
        if (config.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }

        document.body.classList.remove('font-small', 'font-medium', 'font-large', 'font-xlarge');
        document.body.classList.add(`font-${config.fontSize}`);

        if (!config.animations || config.reduceMotion) {
            document.body.classList.add('no-animations');
        } else {
            document.body.classList.remove('no-animations');
        }

        if (config.highContrast) {
            document.body.classList.add('high-contrast');
        } else {
            document.body.classList.remove('high-contrast');
        }

        if (config.colorBlindMode && config.colorBlindType !== 'none') {
            document.body.classList.add('color-blind-mode');
            document.body.classList.add(`color-blind-${config.colorBlindType}`);
        } else {
            document.body.classList.remove('color-blind-mode');
            document.body.classList.remove('color-blind-protanopia', 'color-blind-deuteranopia', 'color-blind-tritanopia');
        }

        document.documentElement.lang = config.language;
    },

    reset: function() {
        localStorage.setItem('gameSettings', JSON.stringify(DEFAULT_SETTINGS));
        this.apply(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
    },

    getValue: function(key) {
        return this.get()[key];
    },

    setValue: function(key, value) {
        const current = this.get();
        current[key] = value;
        return this.set(current);
    }
};

window.Translations = {
    es: {
        // Navegación
        settings: 'Ajustes',
        profile: 'Perfil',
        logout: 'Cerrar Sesión',
        
        // Menú principal
        chooseGameMode: 'Elige tu Modo de Juego',
        play: 'Jugar',
        playDescription: 'Comienza una nueva partida',
        playNow: 'Jugar Ahora',
        create: 'Crea',
        createDescription: 'Crea una nueva partida',
        createNow: 'Crear Ahora',
        createGame: 'Crear Partida',
        rejoin: 'Volver a Jugar',
        rejoinDescription: 'Repite tu última partida',
        rejoinGame: 'Volver a Jugar',
        rules: 'Reglas',
        
        // Settings
        appearance: 'Apariencia',
        darkMode: 'Modo Oscuro',
        darkModeDesc: 'Activa el tema oscuro para reducir la fatiga visual',
        fontSize: 'Tamaño de Fuente',
        fontSizeDesc: 'Ajusta el tamaño del texto en el juego',
        animations: 'Animaciones',
        animationsDesc: 'Activa o desactiva las animaciones del juego',
        language: 'Idioma',
        gameLanguage: 'Idioma del Juego',
        languageDesc: 'Selecciona tu idioma preferido',
        sound: 'Sonido',
        accessibility: 'Accesibilidad',
        colorBlindMode: 'Modo Daltónico',
        colorBlindModeDesc: 'Adapta los colores para diferentes tipos de daltonismo',
        colorBlindType: 'Tipo de Daltonismo',
        colorBlindTypeDesc: 'Selecciona el tipo de adaptación de colores',
        highContrast: 'Alto Contraste',
        highContrastDesc: 'Mejora la visibilidad con mayor contraste',
        reduceMotion: 'Reducir Movimiento',
        reduceMotionDesc: 'Minimiza las animaciones y transiciones',
        
        // Color blind types
        colorBlindNone: 'Ninguno',
        colorBlindProtanopia: 'Deficiencia Rojo-Verde (Protanopia)',
        colorBlindDeuteranopia: 'Deficiencia Verde (Deuteranopia)',
        colorBlindTritanopia: 'Deficiencia Azul-Amarillo (Tritanopia)',
        
        // Mensajes
        settingsSaved: '¡Configuración guardada correctamente!',
        settingsReset: 'Configuración restaurada a valores predeterminados',
        logoutConfirm: '¿Estás seguro de que quieres cerrar sesión?',
        
        // Botones
        saveChanges: 'Guardar Cambios',
        restoreDefaults: 'Restaurar Valores Predeterminados',
        
        // Footer
        copyright: '© 2025 Draftosaurus Digital | Todos los derechos reservados a IceStudio.',
        
        // Tamaños de fuente
        small: 'Pequeño',
        medium: 'Mediano',
        large: 'Grande',
        xlarge: 'Extra Grande'
    },
    en: {
        // Navigation
        settings: 'Settings',
        profile: 'Profile',
        logout: 'Logout',
        
        // Main menu
        chooseGameMode: 'Choose Your Game Mode',
        play: 'Play',
        playDescription: 'Start a new game',
        playNow: 'Play Now',
        create: 'Create',
        createDescription: 'Create a new game',
        createNow: 'Create Now',
        createGame: 'Create Game',
        rejoin: 'Continue',
        rejoinDescription: 'Resume your last game',
        rejoinGame: 'Continue Game',
        rules: 'Rules',
        
        // Settings
        appearance: 'Appearance',
        darkMode: 'Dark Mode',
        darkModeDesc: 'Activate dark theme to reduce eye strain',
        fontSize: 'Font Size',
        fontSizeDesc: 'Adjust text size in the game',
        animations: 'Animations',
        animationsDesc: 'Enable or disable game animations',
        language: 'Language',
        gameLanguage: 'Game Language',
        languageDesc: 'Select your preferred language',
        sound: 'Sound',
        accessibility: 'Accessibility',
        colorBlindMode: 'Color Blind Mode',
        colorBlindModeDesc: 'Adapt colors for different types of color blindness',
        colorBlindType: 'Color Blindness Type',
        colorBlindTypeDesc: 'Select the type of color adaptation',
        highContrast: 'High Contrast',
        highContrastDesc: 'Improve visibility with higher contrast',
        reduceMotion: 'Reduce Motion',
        reduceMotionDesc: 'Minimize animations and transitions',
        
        // Color blind types
        colorBlindNone: 'None',
        colorBlindProtanopia: 'Red-Green Deficiency (Protanopia)',
        colorBlindDeuteranopia: 'Green Deficiency (Deuteranopia)',
        colorBlindTritanopia: 'Blue-Yellow Deficiency (Tritanopia)',
        
        // Messages
        settingsSaved: 'Settings saved successfully!',
        settingsReset: 'Settings restored to default values',
        logoutConfirm: 'Are you sure you want to log out?',
        
        // Buttons
        saveChanges: 'Save Changes',
        restoreDefaults: 'Restore Defaults',
        
        // Footer
        copyright: '© 2025 Draftosaurus Digital | All rights reserved to IceStudio.',
        
        // Font sizes
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
        xlarge: 'Extra Large'
    },
};

window.t = function(key) {
    const lang = window.GameSettings.getValue('language') || 'es';
    return (window.Translations[lang] && window.Translations[lang][key]) || key;
};

window.updateTranslations = function() {
    const lang = window.GameSettings.getValue('language') || 'es';
    
    if (window.AutoTranslator) {
        window.AutoTranslator.translatePage(lang);
    } else {
        document.documentElement.lang = lang;
        console.warn('⚠️ AutoTranslator no disponible, solo se actualizó el atributo lang');
    }
};

(function initializeGlobalSettings() {
    window.GameSettings.apply();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.updateTranslations);
    } else {
        window.updateTranslations();
    }
    
    console.log('✅ Sistema de configuración global inicializado');
    console.log('📋 Configuraciones actuales:', window.GameSettings.get());
})();

window.addEventListener('storage', function(e) {
    if (e.key === 'gameSettings') {
        console.log('🔄 Configuraciones actualizadas desde otra pestaña');
        window.GameSettings.apply();
        window.updateTranslations();
    }
});

