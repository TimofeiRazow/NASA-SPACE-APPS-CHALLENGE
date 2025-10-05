export class SettingsManager {
    constructor() {
        this.settings = this.getDefaultSettings();
        this.callbacks = new Map();
        this.settingsPanel = document.getElementById('settings-panel');
        this.activeTab = 'visual';
        
        this.createSettingsPanel();
        this.loadSettings();
    }
    
    getDefaultSettings() {
        return {
            // Визуальные настройки
            visual: {
                shadows: true,
                bloomIntensity: 1.0,
                ambientOcclusion: 0.5,
                fov: 75,
                brightness: 1.0,
                uiTheme: 'dark'
            },
            
            // Настройки камеры
            camera: {
                zoomSpeed: 1.0,
                inertia: 0.05,
                autoFocus: false,
                minDistance: 1,
                maxDistance: 1000
            },
            
            // Отображение объектов
            display: {
                showOrbits: true,
                showLabels: true,
                phaColor: '#ff0000',
                asteroidColor: '#8b7355',
                maxAsteroids: 40000,
                asteroidSize: 0.02
            },
            
            // Околоземная сцена
            earthOrbit: {
                earthParticles: 60000,
                atmosphereParticles: 30000,
                coolingRate: 0.998,
                gravityStrength: 0.3,
                atmosphereRadius: 7,
                showParticleMarkers: false,
                particleDamping: 0.999
            },
            
            // Сцена поверхности
            planetSurface: {
                cloudDensity: 0.8,
                cloudAnimationSpeed: 1.0,
                explosionRadius: 150,
                explosionDuration: 2.0,
                explosionGlow: true,
                cloudRadius: 80
            },
            
            // Информация
            info: {
                showDetailedPanel: true,
                showTooltips: true
            },
            
            // Фильтры
            filters: {
                searchQuery: '',
                sizeFilter: { min: 0, max: 10000 },
                dangerFilter: 'all', // 'all', 'pha', 'neo', 'mainBelt'
                hideSmallObjects: false,
                minVisibleSize: 0.1
            }
        };
    }
    
    createSettingsPanel() {
        this.setupEventListeners();
    }
    setupEventListeners() {
        // Кнопка закрытия
        const closeBtn = document.querySelector('#close-settings');
        closeBtn.addEventListener('click', () => this.hide());
        
        // Переключение вкладок
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Обновление значений слайдеров
        const rangeInputs = this.settingsPanel.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const valueSpan = e.target.nextElementSibling;
                if (valueSpan && valueSpan.classList.contains('range-value')) {
                    let value = e.target.value;
                    if (e.target.id.includes('fov')) value += '°';
                    if (e.target.id.includes('speed')) value += 'x';
                    if (e.target.id.includes('duration')) value += 'с';
                    if (e.target.id.includes('distance') || e.target.id.includes('radius')) value += ' км';
                    valueSpan.textContent = value;
                }
            });
        });
        
        const fullScreenBtn = document.getElementById('fullscreen');
        fullScreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });

        // Кнопки действий
        const resetBtn = document.querySelector('#reset-settings');
        resetBtn.addEventListener('click', () => this.resetToDefaults());
        
        const applyBtn = this.settingsPanel.querySelector('#apply-settings');
        applyBtn.addEventListener('click', () => this.applySettings());
        
        // Закрытие по клику вне панели
        document.addEventListener('click', (e) => {
            if (e.target === this.settingsPanel) {
                this.hide();
            }
        });
    }
    
    switchTab(tabName) {
        // Обновляем активную вкладку
        this.activeTab = tabName;
        this.show()
        // Переключаем кнопки
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Переключаем контент
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });
    }
    
    show() {
        this.settingsPanel.classList.remove('hidden');
    }
    
    hide() {
        this.settingsPanel.classList.add('hidden');
    }
    
    toggle() {
        this.settingsPanel.classList.toggle('hidden');
    }
    
    applySettings() {
        // Собираем все значения из формы
        this.readSettingsFromForm();
        
        // Сохраняем в localStorage
        this.saveSettings();
        
        // Уведомляем подписчиков
        this.notifyCallbacks('apply');
        
        // Показываем уведомление
        this.showNotification('Настройки применены');
    }
    
    readSettingsFromForm() {
        // Визуальные
        this.settings.visual.shadows = document.getElementById('setting-shadows')?.checked ?? true;
        this.settings.visual.bloomIntensity = parseFloat(document.getElementById('setting-bloom')?.value ?? 1.0);
        this.settings.visual.ambientOcclusion = parseFloat(document.getElementById('setting-ao')?.value ?? 0.5);
        this.settings.visual.fov = parseInt(document.getElementById('setting-fov')?.value ?? 75);
        this.settings.visual.brightness = parseFloat(document.getElementById('setting-brightness')?.value ?? 1.0);
        this.settings.visual.uiTheme = document.getElementById('setting-theme')?.value ?? 'dark';
        
        // Камера
        this.settings.camera.zoomSpeed = parseFloat(document.getElementById('setting-zoom-speed')?.value ?? 1.0);
        this.settings.camera.inertia = parseFloat(document.getElementById('setting-inertia')?.value ?? 0.05);
        this.settings.camera.autoFocus = document.getElementById('setting-autofocus')?.checked ?? false;
        this.settings.camera.minDistance = parseFloat(document.getElementById('setting-min-distance')?.value ?? 1);
        this.settings.camera.maxDistance = parseFloat(document.getElementById('setting-max-distance')?.value ?? 1000);
        
        // Отображение
        this.settings.display.showOrbits = document.getElementById('setting-show-orbits')?.checked ?? true;
        this.settings.display.showLabels = document.getElementById('setting-show-labels')?.checked ?? true;
        this.settings.display.phaColor = document.getElementById('setting-pha-color')?.value ?? '#ff0000';
        this.settings.display.asteroidColor = document.getElementById('setting-asteroid-color')?.value ?? '#8b7355';
        this.settings.display.maxAsteroids = parseInt(document.getElementById('setting-max-asteroids')?.value ?? 40000);
        this.settings.display.asteroidSize = parseFloat(document.getElementById('setting-asteroid-size')?.value ?? 0.02);
        
        // Околоземная сцена
        this.settings.earthOrbit.earthParticles = parseInt(document.getElementById('setting-earth-particles')?.value ?? 60000);
        this.settings.earthOrbit.atmosphereParticles = parseInt(document.getElementById('setting-atmosphere-particles')?.value ?? 30000);
        this.settings.earthOrbit.coolingRate = parseFloat(document.getElementById('setting-cooling-rate')?.value ?? 0.998);
        this.settings.earthOrbit.gravityStrength = parseFloat(document.getElementById('setting-gravity')?.value ?? 0.3);
        this.settings.earthOrbit.atmosphereRadius = parseFloat(document.getElementById('setting-atmosphere-radius')?.value ?? 7);
        this.settings.earthOrbit.particleDamping = parseFloat(document.getElementById('setting-particle-damping')?.value ?? 0.999);
        
        // Поверхность планеты
        this.settings.planetSurface.cloudDensity = parseFloat(document.getElementById('setting-cloud-density')?.value ?? 0.8);
        this.settings.planetSurface.cloudAnimationSpeed = parseFloat(document.getElementById('setting-cloud-speed')?.value ?? 1.0);
        this.settings.planetSurface.cloudRadius = parseFloat(document.getElementById('setting-cloud-radius')?.value ?? 80);
        this.settings.planetSurface.explosionRadius = parseFloat(document.getElementById('setting-explosion-radius')?.value ?? 150);
        this.settings.planetSurface.explosionDuration = parseFloat(document.getElementById('setting-explosion-duration')?.value ?? 2.0);
        this.settings.planetSurface.explosionGlow = document.getElementById('setting-explosion-glow')?.checked ?? true;
        
        // Фильтры
        this.settings.filters.searchQuery = document.getElementById('setting-search')?.value ?? '';
        this.settings.filters.sizeFilter.min = parseInt(document.getElementById('setting-size-min')?.value ?? 0);
        this.settings.filters.sizeFilter.max = parseInt(document.getElementById('setting-size-max')?.value ?? 10000);
        this.settings.filters.dangerFilter = document.getElementById('setting-danger-filter')?.value ?? 'all';
        this.settings.filters.hideSmallObjects = document.getElementById('setting-hide-small')?.checked ?? false;
        this.settings.filters.minVisibleSize = parseFloat(document.getElementById('setting-min-visible')?.value ?? 0.1);
    }
    
    resetToDefaults() {
        if (confirm('Вы уверены, что хотите сбросить все настройки?')) {
            this.settings = this.getDefaultSettings();
            this.saveSettings();
            this.hide();
            
            // Пересоздаем панель с дефолтными значениями
            this.createSettingsPanel();
            
            this.notifyCallbacks('reset');
            this.showNotification('Настройки сброшены');
        }
    }
    
    saveSettings() {
        try {
            localStorage.setItem('impactor_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Не удалось сохранить настройки:', e);
        }
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('impactor_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.getDefaultSettings(), ...parsed };
            }
        } catch (e) {
            console.warn('Не удалось загрузить настройки:', e);
        }
    }
    
    getSetting(category, key) {
        return this.settings[category]?.[key];
    }
    
    setSetting(category, key, value) {
        if (this.settings[category]) {
            this.settings[category][key] = value;
            this.saveSettings();
            this.notifyCallbacks('change', { category, key, value });
        }
    }
    
    onSettingsChange(callback) {
        const id = Math.random().toString(36);
        this.callbacks.set(id, callback);
        return id;
    }
    
    offSettingsChange(id) {
        this.callbacks.delete(id);
    }
    
    notifyCallbacks(event, data = null) {
        this.callbacks.forEach(callback => {
            try {
                callback(event, this.settings, data);
            } catch (e) {
                console.error('Ошибка в callback настроек:', e);
            }
        });
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'settings-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    getSettings() {
        return this.settings;
    }
}