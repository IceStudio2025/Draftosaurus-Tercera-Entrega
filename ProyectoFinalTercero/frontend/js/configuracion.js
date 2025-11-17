let settings = window.GameSettings.get();

const darkModeToggle = document.getElementById('dark-mode-toggle');
const fontSizeSelect = document.getElementById('font-size');
const animationsToggle = document.getElementById('animations-toggle');
const languageSelect = document.getElementById('language-select');
const highContrastToggle = document.getElementById('high-contrast');
const colorBlindToggle = document.getElementById('color-blind-toggle');
const colorBlindTypeSelect = document.getElementById('color-blind-type');
const btnSave = document.getElementById('btn-save');
const btnReset = document.getElementById('btn-reset');
const toastMessage = document.getElementById('toast-message');
const userButton = document.getElementById('nombre-usuario');
const dropdown = document.getElementById('userDropdown');
const btnLogout = document.getElementById('btn-logout');

function initializeSettings() {
    settings = window.GameSettings.get();
    
    darkModeToggle.checked = settings.darkMode;
    fontSizeSelect.value = settings.fontSize;
    animationsToggle.checked = settings.animations;
    languageSelect.value = settings.language;
    highContrastToggle.checked = settings.highContrast;
    
    if (colorBlindToggle) {
        colorBlindToggle.checked = settings.colorBlindMode || false;
    }
    if (colorBlindTypeSelect) {
        colorBlindTypeSelect.value = settings.colorBlindType || 'none';
        colorBlindTypeSelect.disabled = !settings.colorBlindMode;
    }
    
    const username = localStorage.getItem('username') || 'Usuario';
    if (userButton) {
        let span = userButton.querySelector('span');
        if (!span) {
            userButton.innerHTML = `<i class="fas fa-user-circle"></i> <span>${username}</span>`;
        } else {
            span.textContent = username;
        }
    }
    
    window.GameSettings.apply();
}

darkModeToggle.addEventListener('change', function() {
    settings.darkMode = this.checked;
    window.GameSettings.setValue('darkMode', this.checked);
});

fontSizeSelect.addEventListener('change', function() {
    settings.fontSize = this.value;
    window.GameSettings.setValue('fontSize', this.value);
});

animationsToggle.addEventListener('change', function() {
    settings.animations = this.checked;
    window.GameSettings.setValue('animations', this.checked);
});

languageSelect.addEventListener('change', function() {
    settings.language = this.value;
    window.GameSettings.setValue('language', this.value);
    window.updateTranslations();
    showToast(window.t('settingsSaved'));
});

highContrastToggle.addEventListener('change', function() {
    settings.highContrast = this.checked;
    window.GameSettings.setValue('highContrast', this.checked);
});

btnSave.addEventListener('click', function() {
    window.GameSettings.set(settings);
    showToast(window.t('settingsSaved'));
    
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
        this.style.transform = 'scale(1)';
    }, 100);
});

btnReset.addEventListener('click', function() {
    if (confirm('¿Estás seguro de que quieres restaurar la configuración a los valores predeterminados?')) {
        window.GameSettings.reset();
        location.reload();
    }
});

function showToast(message) {
    toastMessage.textContent = message;
    toastMessage.classList.add('show');
    
    setTimeout(() => {
        toastMessage.classList.remove('show');
    }, 3000);
}

userButton.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdown.classList.toggle('active');
});

document.addEventListener('click', function(e) {
    if (!userButton.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

if (colorBlindToggle) {
    colorBlindToggle.addEventListener('change', function() {
        settings.colorBlindMode = this.checked;
        if (colorBlindTypeSelect) {
            colorBlindTypeSelect.disabled = !this.checked;
        }
        window.GameSettings.setValue('colorBlindMode', this.checked);
    });
}

if (colorBlindTypeSelect) {
    colorBlindTypeSelect.addEventListener('change', function() {
        settings.colorBlindType = this.value;
        window.GameSettings.setValue('colorBlindType', this.value);
    });
}

btnLogout.addEventListener('click', function() {
    if (confirm(window.t('logoutConfirm'))) {
        localStorage.removeItem('username');
        window.location.href = './login.html';
    }
});

document.addEventListener('DOMContentLoaded', initializeSettings);

dropdown.addEventListener('click', function(e) {
    e.stopPropagation();
});

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        btnSave.click();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        btnReset.click();
    }
    
    if (e.key === 'Escape') {
        dropdown.classList.remove('active');
    }
});

let hasUnsavedChanges = false;

const settingsElements = [darkModeToggle, fontSizeSelect, animationsToggle, languageSelect, 
 highContrastToggle, colorBlindToggle, colorBlindTypeSelect];

settingsElements.forEach(element => {
    if (element) {
        element.addEventListener('change', () => {
            hasUnsavedChanges = true;
        });
    }
});

btnSave.addEventListener('click', () => {
    hasUnsavedChanges = false;
});

window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});