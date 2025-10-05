import { SceneManager } from './js/core/SceneManager.js';
import { CameraController } from './js/core/CameraController.js';
import { DataLoader } from './js/utils/DataLoader.js';
import { UIManager } from './js/ui/UIManager.js';
import { SettingsManager } from './js/ui/SettingsManager.js';
import { SettingsIntegration } from './js/integration/SettingsIntegration.js';
import { SolarSystemScene } from './js/scenes/SolarSystemScene.js';
import { EarthOrbitScene } from './js/scenes/EarthOrbitScene.js';
import { PlanetSurfaceScene } from './js/scenes/PlanetSurfaceScene.js';
import { PlanetsPanel } from './js/ui/PlanetsPanel.js';

class ImpactorApp {
    constructor() {
        this.sceneManager = null;
        this.cameraController = null;
        this.dataLoader = null;
        this.uiManager = null;
        this.settingsManager = null;
        this.settingsIntegration = null;
        this.planetsPanel = null;

        this.solarSystemScene = null;
        this.earthOrbitScene = null;
        this.planetSurfaceScene = null;
        this.currentScene = 'solar-system';
        
        this.animationId = null;
        this.lastTime = 0;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
        this.lastStatsUpdate = 0;
        window.turnX = this.getCurrentTranslateX;
        this.lastOffsetX = window.turnX();
        
        this.init();
    }

    getCurrentTranslateX() {
        this.controlPanel = document.getElementById("info-panel");
        const currentOffsetX = -(window.innerWidth - this.controlPanel.getBoundingClientRect().left);
        if(this.lastOffsetX == undefined) {
            this.lastOffsetX = currentOffsetX;
        }
        return (-currentOffsetX - this.lastOffsetX) > window.innerWidth ? 0 : currentOffsetX;
    }
    
    async init() {
        try {
            // Инициализация менеджера настроек ПЕРВЫМ
            this.settingsManager = new SettingsManager();
            
            this.uiManager = new UIManager();
            this.uiManager.showLoading('Инициализация системы...');
            
            // Инициализация основных компонентов
            this.sceneManager = new SceneManager(window.turnX());
            this.cameraController = new CameraController(
                this.sceneManager.getCamera(),
                this.sceneManager.getRenderer(),
                this.sceneManager,
                window.turnX()
            );
            
            this.uiManager.updateLoadingMessage('Загрузка данных...');
            this.dataLoader = new DataLoader();
            await this.dataLoader.loadAll();
            
            // Создание сцен
            this.solarSystemScene = new SolarSystemScene(this.sceneManager, this.dataLoader);
            this.earthOrbitScene = new EarthOrbitScene(this.sceneManager);
            this.planetSurfaceScene = new PlanetSurfaceScene(this.sceneManager);
            
            this.loadEarthData();

            this.planetsPanel = new PlanetsPanel(this);
            
            // Настройка интеграции настроек
            this.settingsIntegration = new SettingsIntegration(this, this.settingsManager);
            
            // Настройка событий
            this.setupEventHandlers();
            
            // Создание начальной сцены
            this.uiManager.updateLoadingMessage('Создание солнечной системы...');
            await this.createCurrentScene();
            
            // Применяем начальные настройки
            this.settingsIntegration.applyInitialSettings();
            
            // Запуск анимации
            this.animate();
            
            this.uiManager.hideLoading();
            console.log('✓ Приложение Impactor-2025 инициализировано');
            console.log('✓ Система настроек активна');
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.uiManager.updateLoadingMessage('Ошибка загрузки приложения');
        }
    }
    
    setupEventHandlers() {
        // UI события
        this.uiManager.setSceneChangeHandler(this.switchScene.bind(this));
        this.uiManager.setAsteroidCreatedHandler(this.createCustomAsteroid.bind(this));
        
        // События камеры
        this.cameraController.setObjectClickHandler(this.handleObjectClick.bind(this));
        this.cameraController.setObjectSelectedHandler(this.handleObjectSelected.bind(this));
        this.cameraController.setClickableObjectsProvider(this.getClickableObjects.bind(this));
        
        // События окна
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Горячие клавиши для настроек
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.settingsManager.hide();
            }
            if (e.ctrlKey && e.key === ',') {
                e.preventDefault();
                this.settingsManager.toggle();
            }
        });

        const planetsButton = document.getElementById('open-planets-list');
        if (planetsButton) {
            planetsButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем всплытие события
                this.planetsPanel.toggle();
            });
        }
    }

    getPlanetsPanel() {
        return this.planetsPanel;
    }
    
    async switchScene(sceneName) {
        if (this.currentScene === sceneName) return;
        
        // Скрываем текущую сцену
        if (this.currentScene === 'planet-surface' && this.planetSurfaceScene) {
            this.planetSurfaceScene.hide();
        }
        
        this.currentScene = sceneName;
        this.sceneManager.clearScene();
        
        await this.createCurrentScene();
        
        // Применяем настройки для новой сцены
        if (this.settingsIntegration) {
            this.settingsIntegration.applyAllSettings(this.settingsManager.getSettings());
        }
        
        // Обновляем кликабельные объекты для камеры
        this.cameraController.setClickableObjectsProvider(this.getClickableObjects.bind(this));
    }
    
    async createCurrentScene() {
        if (this.currentScene === 'solar-system') {
            await this.solarSystemScene.create();
            this.cameraController.setPosition(0, 50, 200);
        } else if (this.currentScene === 'earth-orbit') {
            await this.earthOrbitScene.create();
            this.cameraController.setPosition(0, 0, 15);
            this.cameraController.lookAt({ x: 0, y: 0, z: 0 });
        } else if (this.currentScene === 'planet-surface') {
            await this.planetSurfaceScene.create();
        }
    }
    
    handleObjectClick(object, intersection) {
        if (this.currentScene === 'solar-system') {
            if (object.userData.name === 'Earth') {
                setTimeout(() => {
                    this.switchScene('earth-orbit');
                }, 1000);
            }
        } else if (this.currentScene === 'earth-orbit') {
            if (intersection && intersection.point) {
                this.uiManager.showAsteroidCreator(intersection.point);
            }
        } else if (this.currentScene === 'planet-surface') {
            if (this.planetSurfaceScene && intersection) {
                this.planetSurfaceScene.handleSurfaceClick(intersection);
            }
        }
    }
    
    handleObjectSelected(object) {
        this.uiManager.updateSelectedObject(object);
    }
    
    createCustomAsteroid(asteroidData) {
        if (this.currentScene === 'earth-orbit') {
            const asteroid = this.earthOrbitScene.createCustomAsteroid(asteroidData);
            this.updateStats();
            return asteroid;
        }
    }
    
    getClickableObjects() {
        if (this.currentScene === 'solar-system') {
            return this.solarSystemScene.getClickableObjects();
        } else if (this.currentScene === 'earth-orbit') {
            return this.earthOrbitScene.getClickableObjects();
        } else if (this.currentScene === 'planet-surface') {
            return this.planetSurfaceScene.getClickableObjects();
        }
        return [];
    }
    
    animate() {
        this.animationId = requestAnimationFrame(this.animate.bind(this));
        
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) * 0.001, 0.1);
        this.lastTime = currentTime;
        
        // Обновление времени в UI только если симуляция активна
        if (this.uiManager.isTimePlaying()) {
            this.uiManager.updateTime(deltaTime);
        }
        
        // Обновление камеры
        this.cameraController.update();
        
        // Обновление текущей сцены
        try {
            const timeScale = this.uiManager.getTimeScale();
            if (this.currentScene === 'solar-system') {
                this.solarSystemScene.update(deltaTime, timeScale);
            } else if (this.currentScene === 'earth-orbit') {
                this.earthOrbitScene.update(deltaTime, timeScale);
            } else if (this.currentScene === 'planet-surface') {
                this.planetSurfaceScene.update(deltaTime);
            }
        } catch (error) {
            console.error('Ошибка обновления сцены:', error);
        }
        
        // Обновление статистики (каждые 100мс для производительности)
        if (currentTime - this.lastStatsUpdate > 100) {
            this.updateStats();
            this.lastStatsUpdate = currentTime;
        }
        
        // Подсчет FPS
        this.updateFPS(currentTime);
        
        // Рендеринг
        try {
            this.sceneManager.render();
        } catch (error) {
            console.error('Ошибка рендеринга:', error);
        }
    }
    
    updateStats() {
        let currentCountOfObjects = 0;
        
        if (this.currentScene === 'solar-system') {
            currentCountOfObjects = this.solarSystemScene.getStats().countOfObjects;
        } else if (this.currentScene === 'earth-orbit') {
            currentCountOfObjects = this.earthOrbitScene.getStats().countOfObjects;
        } else if (this.currentScene === 'planet-surface') {
            currentCountOfObjects = this.planetSurfaceScene.getStats().countOfObjects;
        }
        
        const stats = {
            fps: this.frameCount, 
            cameraDistance: Number.parseInt(this.cameraController.currentDistance * 10),
            countOfObjects: currentCountOfObjects
        };
        
        try {
            if (this.currentScene === 'solar-system') {
                const sceneStats = this.solarSystemScene.getStats();
                stats.asteroidCount = this.dataLoader.asteroidData.length;
                stats.visibleCount = sceneStats.planetsCount + sceneStats.asteroidsCount;
            } else if (this.currentScene === 'earth-orbit') {
                const sceneStats = this.earthOrbitScene.getStats();
                this.uiManager.updateEarthOrbitStats(stats);
                stats.asteroidCount = sceneStats.activeAsteroids;
                stats.visibleCount = sceneStats.earthParticles + sceneStats.atmosphereParticles;
            } else if (this.currentScene === 'planet-surface') {
                const sceneStats = this.planetSurfaceScene.getStats();
                stats.asteroidCount = 0;
                stats.visibleCount = sceneStats.impacts;
                this.uiManager.updatePlanetSurfaceStats && this.uiManager.updatePlanetSurfaceStats(sceneStats);
            }
        } catch (error) {
            console.error('Ошибка обновления статистики:', error);
        }
    }
    
    updateFPS(currentTime) {
        this.frameCount++;
        
        if (currentTime - this.fpsUpdateTime >= 1000) {
            let currentCountOfObjects = 0;
            
            if (this.currentScene === 'solar-system') {
                currentCountOfObjects = this.solarSystemScene.getStats().countOfObjects;
            } else if (this.currentScene === 'earth-orbit') {
                currentCountOfObjects = this.earthOrbitScene.getStats().countOfObjects;
            } else if (this.currentScene === 'planet-surface') {
                currentCountOfObjects = this.planetSurfaceScene.getStats().countOfObjects;
            }
            
            this.uiManager.updateStats({ 
                fps: this.frameCount, 
                cameraDistance: Number.parseInt(this.cameraController.currentDistance * 10),
                countOfObjects: currentCountOfObjects
            });
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;
        }
    }
    
    onWindowResize() {
        // SceneManager уже обрабатывает изменение размера окна
    }
    
    // Методы для внешнего управления
    pause() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    resume() {
        if (!this.animationId) {
            this.lastTime = performance.now();
            this.lastStatsUpdate = this.lastTime;
            this.animate();
        }
    }
    
    destroy() {
        this.pause();
        
        if (this.solarSystemScene) this.solarSystemScene.clearScene();
        if (this.earthOrbitScene) this.earthOrbitScene.clearScene();
        if (this.planetSurfaceScene) this.planetSurfaceScene.dispose();
        if (this.sceneManager) this.sceneManager.clearScene();
        if (this.dataLoader) this.dataLoader.clearCache();
    }
    
    // Геттеры для доступа к компонентам
    getCurrentScene() { return this.currentScene; }
    getSceneManager() { return this.sceneManager; }
    getCameraController() { return this.cameraController; }
    getDataLoader() { return this.dataLoader; }
    getUIManager() { return this.uiManager; }
    getSettingsManager() { return this.settingsManager; }
    getSolarSystemScene() { return this.solarSystemScene; }
    getEarthOrbitScene() { return this.earthOrbitScene; }
    getPlanetSurfaceScene() { return this.planetSurfaceScene; }
    
    async loadEarthData() {
        try {
            await this.planetSurfaceScene.loadFromImage('./data/ea.png');
            console.log('✓ Данные Земли загружены');
        } catch (error) {
            console.error('Ошибка загрузки данных Земли:', error);
        }
    }
}

// Запуск приложения
window.addEventListener('load', () => {
    window.impactorApp = new ImpactorApp();

    // Экспорт функций для списка планет
    window.openPlanets = () => window.impactorApp.planetsPanel.show();
    window.closePlanets = () => window.impactorApp.planetsPanel.hide();
    

    // Экспортируем глобальные функции для отладки
    window.openSettings = () => window.impactorApp.settingsManager.show();
    window.closeSettings = () => window.impactorApp.settingsManager.hide();
    
    console.log('💡 Горячие клавиши:');
    console.log('   Ctrl+, - Открыть настройки');
    console.log('   Esc - Закрыть настройки');
});

// Экспорт для использования в других модулях
export { ImpactorApp };