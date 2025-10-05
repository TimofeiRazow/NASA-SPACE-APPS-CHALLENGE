export class UIManager {
    constructor() {
        // Основные элементы UI
        this.loadingElement = document.getElementById('loading');
        this.mainControlPanel = document.getElementById('main-control-panel');
        this.infoPanel = document.getElementById('info-panel');
        this.asteroidCreatorPanel = document.getElementById('asteroid-creator-panel');
        
        // Элементы управления временем
        this.timeSpeedSlider = document.getElementById('time-speed');
        this.timeSpeedValue = document.getElementById('time-speed-value');
        
        // Элементы информационной панели
        this.currentTimeDisplay = document.getElementById('current-time');
        this.asteroidCountDisplay = document.getElementById('asteroid-count');
        this.visibleCountDisplay = document.getElementById('visible-count');
        this.cameraDistanceDisplay = document.getElementById('camera-distance');
        this.fpsCounterDisplay = document.getElementById('fps-counter');
        this.objectNameDisplay = document.getElementById('object-name');
        
        // Кнопки переключения сцен
        this.sceneButtons = document.querySelectorAll('.scene-button');
        
        // Панель создания астероида
        this.asteroidSizeSlider = document.getElementById('asteroid-size');
        this.sizeValueDisplay = document.getElementById('size-value');
        this.asteroidVelocitySlider = document.getElementById('asteroid-velocity');
        this.velocityValueDisplay = document.getElementById('velocity-value');
        this.asteroidMaterialSelect = document.getElementById('asteroid-material');
        this.entryAngleSlider = document.getElementById('entry-angle');
        this.angleValueDisplay = document.getElementById('angle-value');
        this.createAsteroidButton = document.getElementById('create-asteroid-btn');
        this.cancelAsteroidButton = document.getElementById('cancel-asteroid-btn');
        this.toggleInfoButton = document.getElementById('toggle-info');
        
        // Околоземные элементы управления
        this.clickInstruction = document.getElementById('click-instruction');
        this.earthOrbitControls = document.getElementById('controls');
        this.earthOrbitInfo = document.getElementById('info');
        
        // Состояние симуляции времени
        this.timePlaying = true;
        this.timeScale = 1;
        this.currentTime = new Date('2025-01-01T00:00:00Z');
        this.baseTime = new Date('2025-01-01T00:00:00Z');
        
        // Временное хранение точки удара для создания астероида
        this.currentImpactPoint = null;
        
        // Callback функции
        this.onSceneChange = null;
        this.onAsteroidCreated = null;

        this.selectedObject = null;
        
        // Для отслеживания времени обновления
        this.lastUpdateTime = Date.now();
        
        this.setupEventListeners();
        this.initializeTimeDisplay();
    }
    
    setupEventListeners() {
        // Управление временем
        this.timeSpeedSlider.addEventListener('input', this.onTimeSpeedChange.bind(this));
        
        // Переключение сцен
        this.sceneButtons.forEach(button => {
            button.addEventListener('click', this.onSceneButtonClick.bind(this));
        });
        
        // Создание астероида
        this.asteroidSizeSlider.addEventListener('input', this.updateAsteroidSize.bind(this));
        this.asteroidVelocitySlider.addEventListener('input', this.updateAsteroidVelocity.bind(this));
        this.entryAngleSlider.addEventListener('input', this.updateEntryAngle.bind(this));
        this.createAsteroidButton.addEventListener('click', this.createAsteroid.bind(this));
        this.cancelAsteroidButton.addEventListener('click', this.hideAsteroidCreator.bind(this));
        this.toggleInfoButton.addEventListener('click', this.toggleInfoPanel.bind(this));
        
        // Околоземные элементы управления
        this.setupEarthOrbitControls();
    }
    
    setupEarthOrbitControls() {
        // Элементы для околоземной сцены
        const asteroidSizeSim = document.getElementById('asteroid-size-sim');
        const sizeValueSim = document.getElementById('size-value-sim');
        const asteroidSpeedSim = document.getElementById('asteroid-speed');
        const speedValueSim = document.getElementById('speed-value-sim');
        const blastRadius = document.getElementById('blast-radius');
        const blastValue = document.getElementById('blast-value');
        const gravityEnabled = document.getElementById('gravity-enabled');
        const atmosphereEnabled = document.getElementById('atmosphere-enabled');
        const resetSimulation = document.getElementById('reset-simulation');
        
        if (asteroidSizeSim) {
            asteroidSizeSim.addEventListener('input', (e) => {
                sizeValueSim.textContent = `${e.target.value} км`;
            });
        }
        
        if (asteroidSpeedSim) {
            asteroidSpeedSim.addEventListener('input', (e) => {
                speedValueSim.textContent = `${e.target.value} км/с`;
            });
        }
        
        if (blastRadius) {
            blastRadius.addEventListener('input', (e) => {
                blastValue.textContent = e.target.value;
            });
        }
        
        if (resetSimulation) {
            resetSimulation.addEventListener('click', () => {
                // Сброс симуляции будет обрабатываться в main.js
                if (window.impactorApp) {
                    window.impactorApp.resetSimulation();
                }
            });
        }
    }
    
    // Управление загрузкой
    showLoading(message = 'Загрузка...') {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'flex';
            const messageElement = this.loadingElement.querySelector('div:last-child');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
    }
    
    updateLoadingMessage(message) {
        if (this.loadingElement) {
            const messageElement = this.loadingElement.querySelector('div:last-child');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
    }
    
    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'none';
        }
    }
    
    // Управление временем
    onTimeSpeedChange(event) {
        const value = parseInt(event.target.value);
        this.timeScale = this.calculateTimeScale(value);
        this.updateTimeSpeedDisplay();
    }
    
    calculateTimeScale(sliderValue) {
        if (sliderValue === 0) return 0;
        // Логарифмическая шкала: от 0.1 до 1000 дней/сек
        const normalizedValue = sliderValue / 100;
        const daysPerSecond = Math.pow(10, normalizedValue * 4 - 1); // 10^(-1) до 10^3
        return daysPerSecond; // Конвертируем дни/сек в секунды/сек для внутреннего использования
    }
    
    updateTimeSpeedDisplay() {
        if (!this.timeSpeedValue) return;
        
        if (this.timeScale === 0) {
            this.timeSpeedValue.textContent = 'Пауза';
        } else {
            const daysPerSecond = this.timeScale;
            
            if (daysPerSecond < 0.01) {
                this.timeSpeedValue.textContent = `${Math.round(1/daysPerSecond)} сек/день`;
            } else if (daysPerSecond < 1) {
                this.timeSpeedValue.textContent = `${daysPerSecond.toFixed(2)} дн/сек`;
            } else if (daysPerSecond < 365) {
                this.timeSpeedValue.textContent = `${Math.round(daysPerSecond)} дн/сек`;
            } else {
                const yearsPerSecond = daysPerSecond / 365;
                this.timeSpeedValue.textContent = `${yearsPerSecond.toFixed(1)} лет/сек`;
            }
        }
    }
    
    resetTime() {
        this.currentTime = new Date(this.baseTime);
        this.updateTimeDisplay();
    }
    
    initializeTimeDisplay() {
        this.updateTimeDisplay();
        // Устанавливаем начальное значение слайдера на 1 день/сек
        if (this.timeSpeedSlider) {
            this.timeSpeedSlider.value = 10; // 10% от максимума = примерно 1 день/сек
        }
        this.timeScale = 1; // 1 день в секундах
        this.updateTimeSpeedDisplay();
    }
    
    updateTime(deltaTime) {
        if (!this.timePlaying || this.timeScale === 0) return;
        
        // deltaTime в секундах, timeScale в секундах симуляции на секунду реального времени
        const simulationSeconds = deltaTime * this.timeScale * 86400;
        const newTime = new Date(this.currentTime.getTime() + simulationSeconds * 1000);
        this.currentTime = newTime;
        this.updateTimeDisplay();
    }
    
    updateTimeDisplay() {
        if (!this.currentTimeDisplay) return;
        
        // Определяем уровень детализации в зависимости от скорости времени
        const daysPerSecond = this.timeScale;
        let options;
        
        if (daysPerSecond < 0.1) {
            // Очень медленно - показываем секунды
            options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            };
        } else if (daysPerSecond < 10) {
            // Умеренно - показываем минуты
            options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
        } else if (daysPerSecond < 100) {
            // Быстро - показываем дни
            options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };
        } else {
            // Очень быстро - показываем только месяц и год
            options = {
                year: 'numeric',
                month: 'long'
            };
        }
        
        try {
            this.currentTimeDisplay.textContent = this.currentTime.toLocaleDateString('ru-RU', options);
        } catch (error) {
            // Fallback если возникают проблемы с форматированием
            this.currentTimeDisplay.textContent = this.currentTime.toISOString().slice(0, 19).replace('T', ' ');
        }
    }
    
    // Управление сценами
    onSceneButtonClick(event) {
        const sceneName = event.target.dataset.scene;
        if (!sceneName) return;
        
        // Обновляем активную кнопку
        this.sceneButtons.forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        // Показываем/скрываем соответствующие панели
        this.updateSceneUI(sceneName);
        
        // Вызываем callback
        if (this.onSceneChange) {
            this.onSceneChange(sceneName);
        }
    }
    
    // Замените метод updateSceneUI в UIManager.js на этот:

    updateSceneUI(sceneName) {
        if (sceneName === 'earth-orbit') {
            // Показываем элементы околоземной сцены
            if (this.clickInstruction) this.clickInstruction.style.display = 'block';
            if (this.earthOrbitControls) this.earthOrbitControls.style.display = 'block';
            if (this.earthOrbitInfo) this.earthOrbitInfo.style.display = 'block';
            
            // Скрываем некоторые элементы солнечной системы
            this.hideMainPanel();
        } else if (sceneName === 'planet-surface') {
            // Скрываем элементы других сцен
            if (this.clickInstruction) this.clickInstruction.style.display = 'none';
            if (this.earthOrbitControls) this.earthOrbitControls.style.display = 'none';
            if (this.earthOrbitInfo) this.earthOrbitInfo.style.display = 'none';
            
            // Можно показать специфичные элементы для planet-surface
            this.hideMainPanel();
            
            // Показываем инструкцию для planet-surface
            if (this.clickInstruction) {
                this.clickInstruction.textContent = 'Кликните по карте для создания взрыва';
                this.clickInstruction.style.display = 'block';
            }
        } else {
            // Сцена солнечной системы
            // Скрываем элементы околоземной сцены
            if (this.clickInstruction) this.clickInstruction.style.display = 'none';
            if (this.earthOrbitControls) this.earthOrbitControls.style.display = 'none';
            if (this.earthOrbitInfo) this.earthOrbitInfo.style.display = 'none';
            
            // Показываем основные панели
            this.showMainPanel();
        }
    }
    
    // Управление статистикой
    updateStats(stats) {
        if (stats.countOfObjects !== undefined && this.asteroidCountDisplay) {
            this.asteroidCountDisplay.textContent = stats.countOfObjects;
        }
        
        if (stats.visibleCount !== undefined && this.visibleCountDisplay) {
            this.visibleCountDisplay.textContent = stats.visibleCount.toLocaleString('ru-RU');
        }
        
        if (stats.cameraDistance !== undefined && this.cameraDistanceDisplay) {
            
            this.cameraDistanceDisplay.textContent = stats.cameraDistance + " М км";
        }
        
        if (stats.fps !== undefined && this.fpsCounterDisplay) {
            this.fpsCounterDisplay.textContent = stats.fps;
        }
    }
    
    updateEarthOrbitStats(stats) {
        const activeAsteroids = document.getElementById('active-asteroids');
        const totalLaunched = document.getElementById('total-launched');
        const impactEnergy = document.getElementById('impact-energy');
        const earthParticles = document.getElementById('earth-particles');
        const atmosphereParticles = document.getElementById('atmosphere-particles');
        const destroyedParticles = document.getElementById('destroyed-particles');
        const flyingParticles = document.getElementById('flying-particles');
        const orbitingParticles = document.getElementById('orbiting-particles');
        const maxTemp = document.getElementById('max-temp');

        if (activeAsteroids) activeAsteroids.textContent = stats.countOfObjects + stats.activeAsteroids || 0;
        if (totalLaunched) totalLaunched.textContent = stats.totalLaunched || 0;
        if (earthParticles) earthParticles.textContent = (stats.earthParticles || 0).toLocaleString('ru-RU');
        if (atmosphereParticles) atmosphereParticles.textContent = (stats.atmosphereParticles || 0).toLocaleString('ru-RU');
        if (destroyedParticles) destroyedParticles.textContent = (stats.destroyed || 0).toLocaleString('ru-RU');
        if (flyingParticles) flyingParticles.textContent = (stats.flying || 0).toLocaleString('ru-RU');
        if (orbitingParticles) orbitingParticles.textContent = (stats.orbiting || 0).toLocaleString('ru-RU');
        if (maxTemp) maxTemp.textContent = stats.maxTemp || 20;
        
        // Обновляем энергию удара на основе текущих настроек
        if (impactEnergy) {
            const energy = this.calculateCurrentImpactEnergy();
            impactEnergy.textContent = this.formatEnergy(energy);
        }
    }
    
    calculateCurrentImpactEnergy() {
        const sizeSim = document.getElementById('asteroid-size-sim');
        const speedSim = document.getElementById('asteroid-speed');
        
        if (!sizeSim || !speedSim) return 0;
        
        const size = parseFloat(sizeSim.value); // км
        const speed = parseFloat(speedSim.value); // км/с
        
        // Простая формула для оценки энергии
        const mass = Math.pow(size, 3) * 0.5; // Упрощенная масса
        const energy = 0.5 * mass * Math.pow(speed, 2) * 4.18; // Примерная энергия в Дж
        
        return energy;
    }
    
    formatEnergy(energy) {
        if (energy < 1e12) {
            return `${(energy / 1e9).toFixed(1)} ГДж`;
        } else if (energy < 1e15) {
            return `${(energy / 1e12).toFixed(1)} ТДж`;
        } else {
            return `${(energy / 1e15).toFixed(1)} ПДж`;
        }
    }
    
    // Управление выбранными объектами
    updateSelectedObject(object) {
        if (!this.objectNameDisplay) return;
        this.selectedObject = object;
        if (object && object.userData && object.userData.name) {
            this.objectNameDisplay.textContent = object.userData.name;
        } else {
            this.objectNameDisplay.textContent = 'Нет';
        }
    }
    
    // Управление панелью создания астероида
    showAsteroidCreator(impactPoint) {
        this.currentImpactPoint = impactPoint;
        
        if (this.asteroidCreatorPanel) {
            this.asteroidCreatorPanel.style.display = 'block';
            
            // Сбрасываем значения на дефолтные
            if (this.asteroidSizeSlider) this.asteroidSizeSlider.value = 1000;
            if (this.asteroidVelocitySlider) this.asteroidVelocitySlider.value = 20;
            if (this.entryAngleSlider) this.entryAngleSlider.value = 45;
            if (this.asteroidMaterialSelect) this.asteroidMaterialSelect.value = 'stone';
            
            this.updateAsteroidSize();
            this.updateAsteroidVelocity();
            this.updateEntryAngle();
        }
    }
    
    hideAsteroidCreator() {
        if (this.asteroidCreatorPanel) {
            this.asteroidCreatorPanel.style.display = 'none';
        }
        this.currentImpactPoint = null;
    }
    
    updateAsteroidSize() {
        if (this.asteroidSizeSlider && this.sizeValueDisplay) {
            const size = parseInt(this.asteroidSizeSlider.value);
            this.sizeValueDisplay.textContent = `${(size / 1000).toFixed(1)} км`;
        }
    }
    
    updateAsteroidVelocity() {
        if (this.asteroidVelocitySlider && this.velocityValueDisplay) {
            const velocity = parseInt(this.asteroidVelocitySlider.value);
            this.velocityValueDisplay.textContent = `${velocity} км/с`;
        }
    }
    
    updateEntryAngle() {
        if (this.entryAngleSlider && this.angleValueDisplay) {
            const angle = parseInt(this.entryAngleSlider.value);
            this.angleValueDisplay.textContent = `${angle}°`;
        }
    }
    
    createAsteroid() {
        if (!this.currentImpactPoint) return;
        
        const asteroidData = {
            impactPoint: this.currentImpactPoint,
            size: parseInt(this.asteroidSizeSlider.value),
            velocity: parseInt(this.asteroidVelocitySlider.value),
            material: this.asteroidMaterialSelect.value,
            angle: parseInt(this.entryAngleSlider.value)
        };
        
        // Вызываем callback для создания астероида
        if (this.onAsteroidCreated) {
            this.onAsteroidCreated(asteroidData);
        }
        
        this.hideAsteroidCreator();
    }
    
    // Управление панелями
    toggleMainPanel() {
        if (this.mainControlPanel) {
            const isVisible = this.mainControlPanel.style.display !== 'none';
            this.mainControlPanel.style.display = isVisible ? 'none' : 'block';
        }
    }
    
    toggleInfoPanel() {
        console.log(window.turnX())
        this.infoPanel.classList.toggle("hidden");
    }
    
    showMainPanel() {
        if (this.mainControlPanel) {
            this.mainControlPanel.style.display = 'block';
        }
    }
    
    hideMainPanel() {
        if (this.mainControlPanel) {
            this.mainControlPanel.style.display = 'none';
        }
    }
    
    showInfoPanel() {
        if (this.infoPanel) {
            this.infoPanel.style.display = 'block';
        }
    }
    
    hideInfoPanel() {
        if (this.infoPanel) {
            this.infoPanel.style.display = 'none';
        }
    }
    
    // Setter методы для callback функций
    setSceneChangeHandler(handler) {
        this.onSceneChange = handler;
    }
    
    setAsteroidCreatedHandler(handler) {
        this.onAsteroidCreated = handler;
    }
    
    // Getter методы для состояния
    isTimePlaying() {
        return this.timePlaying;
    }
    
    getTimeScale() {
        return this.timeScale;
    }
    
    getCurrentTime() {
        return new Date(this.currentTime);
    }
    
    getSelectedObject() {
        return this.selectedObject;
    }
    
    // Методы для программного управления
     setTimeScale(scale) {
        this.timeScale = scale;
        
        if (this.timeSpeedSlider) {
            let sliderValue;
            if (scale === 0) {
                sliderValue = 0;
            } else {
                sliderValue = Math.round(((Math.log10(scale) + 1) / 4) * 100);
                sliderValue = Math.max(1, Math.min(100, sliderValue));
            }
            this.timeSpeedSlider.value = sliderValue;
        }
        
        this.updateTimeSpeedDisplay();
    }
    
    // Методы для работы с настройками околоземной сцены
    getEarthOrbitSettings() {
        const asteroidSizeSim = document.getElementById('asteroid-size-sim');
        const asteroidSpeedSim = document.getElementById('asteroid-speed');
        const blastRadius = document.getElementById('blast-radius');
        const gravityEnabled = document.getElementById('gravity-enabled');
        const atmosphereEnabled = document.getElementById('atmosphere-enabled');
        
        return {
            asteroidSize: asteroidSizeSim ? parseFloat(asteroidSizeSim.value) : 2.5,
            asteroidSpeed: asteroidSpeedSim ? parseFloat(asteroidSpeedSim.value) : 25,
            blastRadius: blastRadius ? parseFloat(blastRadius.value) : 3.0,
            gravityEnabled: gravityEnabled ? gravityEnabled.checked : true,
            atmosphereEnabled: atmosphereEnabled ? atmosphereEnabled.checked : true
        };
    }
    
    setEarthOrbitSettings(settings) {
        const asteroidSizeSim = document.getElementById('asteroid-size-sim');
        const sizeValueSim = document.getElementById('size-value-sim');
        const asteroidSpeedSim = document.getElementById('asteroid-speed');
        const speedValueSim = document.getElementById('speed-value-sim');
        const blastRadius = document.getElementById('blast-radius');
        const blastValue = document.getElementById('blast-value');
        const gravityEnabled = document.getElementById('gravity-enabled');
        const atmosphereEnabled = document.getElementById('atmosphere-enabled');
        
        if (settings.asteroidSize !== undefined && asteroidSizeSim) {
            asteroidSizeSim.value = settings.asteroidSize;
            if (sizeValueSim) sizeValueSim.textContent = `${settings.asteroidSize} км`;
        }
        
        if (settings.asteroidSpeed !== undefined && asteroidSpeedSim) {
            asteroidSpeedSim.value = settings.asteroidSpeed;
            if (speedValueSim) speedValueSim.textContent = `${settings.asteroidSpeed} км/с`;
        }
        
        if (settings.blastRadius !== undefined && blastRadius) {
            blastRadius.value = settings.blastRadius;
            if (blastValue) blastValue.textContent = settings.blastRadius;
        }
        
        if (settings.gravityEnabled !== undefined && gravityEnabled) {
            gravityEnabled.checked = settings.gravityEnabled;
        }
        
        if (settings.atmosphereEnabled !== undefined && atmosphereEnabled) {
            atmosphereEnabled.checked = settings.atmosphereEnabled;
        }
    }
    
    // Методы для отладки и диагностики
    getUIState() {
        return {
            timePlaying: this.timePlaying,
            timeScale: this.timeScale,
            currentTime: this.currentTime,
            panelsVisible: {
                main: this.mainControlPanel ? this.mainControlPanel.style.display !== 'none' : false,
                info: this.infoPanel ? this.infoPanel.style.display !== 'none' : false,
                asteroidCreator: this.asteroidCreatorPanel ? this.asteroidCreatorPanel.style.display !== 'none' : false
            },
            currentImpactPoint: this.currentImpactPoint,
            earthOrbitSettings: this.getEarthOrbitSettings()
        };
    }
    
    // Методы для работы с уведомлениями (можно расширить в будущем)
    showNotification(message, type = 'info', duration = 3000) {
        // Создаем простое уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#ff4444' : type === 'warning' ? '#ffaa00' : '#4488ff'};
            color: white;
            border-radius: 5px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }
}