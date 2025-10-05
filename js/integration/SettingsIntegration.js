// js/integration/SettingsIntegration.js

export class SettingsIntegration {
    constructor(app, settingsManager) {
        this.app = app;
        this.settingsManager = settingsManager;
        
        this.setupIntegration();
    }
    
    setupIntegration() {
        // Добавляем кнопку настроек в header
        this.addSettingsButton();
        
        // Применяем начальные настройки
        this.applyInitialSettings();
        
        // Настраиваем автоматическое применение настроек
        this.setupAutoApply();
    }
    
    addSettingsButton() {
        const toggleSettingsBtn = document.getElementById('toggle-settings');
        if (toggleSettingsBtn) {
            toggleSettingsBtn.addEventListener('click', () => {
                console.log('Нажали')
                this.settingsManager.toggle();
            });
        }
    }
    
    applyInitialSettings() {
        const settings = this.settingsManager.getSettings();
        
        // Применяем все категории настроек
        this.applyVisualSettings(settings.visual);
        this.applyCameraSettings(settings.camera);
        this.applyDisplaySettings(settings.display);
        this.applyEarthOrbitSettings(settings.earthOrbit);
        this.applyPlanetSurfaceSettings(settings.planetSurface);
        this.applyFilters(settings.filters);
    }
    
    setupAutoApply() {
        this.settingsManager.onSettingsChange((event, settings, data) => {
            if (event === 'apply') {
                this.applyAllSettings(settings);
            } else if (event === 'reset') {
                this.applyInitialSettings();
            } else if (event === 'change' && data) {
                // Применяем изменение конкретной настройки
                this.applySingleSetting(data.category, data.key, data.value);
            }
        });
    }
    
    applyAllSettings(settings) {
        this.applyVisualSettings(settings.visual);
        this.applyCameraSettings(settings.camera);
        this.applyDisplaySettings(settings.display);
        this.applyEarthOrbitSettings(settings.earthOrbit);
        this.applyPlanetSurfaceSettings(settings.planetSurface);
        this.applyFilters(settings.filters);
    }
    
    applyVisualSettings(visual) {
        const sceneManager = this.app.getSceneManager();
        const renderer = sceneManager.getRenderer();
        const camera = sceneManager.getCamera();
        const composer = sceneManager.getComposer();
        
        // Тени
        if (renderer) {
            renderer.shadowMap.enabled = visual.shadows;
            
            // Яркость через postprocessing
            const passes = composer.passes;
            passes.forEach(pass => {
                if (pass.uniforms && pass.uniforms.brightness) {
                    pass.uniforms.brightness.value = visual.brightness;
                }
            });
        }
        
        // FOV
        if (camera) {
            camera.fov = visual.fov;
            camera.updateProjectionMatrix();
        }
        
        // Bloom
        if (composer && composer.passes) {
            const bloomPass = composer.passes.find(pass => 
                pass.constructor.name.includes('Bloom')
            );
            if (bloomPass) {
                bloomPass.strength = visual.bloomIntensity;
                bloomPass.radius = visual.bloomIntensity * 0.5;
            }
        }
        
        // Тема UI
        this.applyUITheme(visual.uiTheme);
        
        console.log('✓ Визуальные настройки применены');
    }
    
    applyUITheme(theme) {
        const root = document.documentElement;
        
        if (theme === 'light') {
            root.style.setProperty('--text-color', '#1a1a1a');
            root.style.setProperty('--text-secondary', '#4a5568');
            root.style.setProperty('--background-color', 'rgba(240, 240, 240, 0.7)');
            root.style.setProperty('--secondary-color', 'rgba(220, 220, 220, 0.8)');
            root.style.setProperty('--accent-color', 'rgba(200, 200, 200, 0.85)');
            root.style.setProperty('--border-color', 'rgba(180, 180, 180, 0.5)');
        } else {
            // Темная тема (по умолчанию)
            root.style.setProperty('--text-color', '#f0f0f0');
            root.style.setProperty('--text-secondary', '#a0aec0');
            root.style.setProperty('--background-color', 'rgba(24, 24, 24, 0.7)');
            root.style.setProperty('--secondary-color', 'rgba(36, 36, 36, 0.8)');
            root.style.setProperty('--accent-color', 'rgba(48, 48, 48, 0.85)');
            root.style.setProperty('--border-color', 'rgba(36, 36, 36, 0.5)');
        }
    }
    
    applyCameraSettings(camera) {
        const cameraController = this.app.getCameraController();
        if (!cameraController) return;
        
        cameraController.setZoomLimits(camera.minDistance, camera.maxDistance);
        cameraController.inertiaFactor = camera.inertia;
        cameraController.autoFocusEnabled = camera.autoFocus;
        
        console.log('✓ Настройки камеры применены');
    }
    
    applyDisplaySettings(display) {
        const currentScene = this.app.getCurrentScene();
        
        if (currentScene === 'solar-system') {
            const solarScene = this.app.getSolarSystemScene();
            if (solarScene) {
                // Видимость орбит
                if (solarScene.orbits) {
                    solarScene.orbits.forEach(orbit => {
                        orbit.visible = display.showOrbits;
                    });
                }
                
                // Видимость меток
                if (solarScene.objectLabels) {
                    solarScene.objectLabels.forEach(label => {
                        label.visible = display.showLabels;
                    });
                }
                
                // Обновление цветов астероидов
                solarScene.updateAsteroidColors(display.phaColor, display.asteroidColor);
            
            }
        }
        
        console.log('✓ Настройки отображения применены');
    }
    
    applyEarthOrbitSettings(earthOrbit) {
        if (this.app.getCurrentScene() !== 'earth-orbit') {
            console.log('⚠ Околоземная сцена не активна');
            return;
        }
        
        const earthOrbitScene = this.app.getEarthOrbitScene();
        if (!earthOrbitScene || !earthOrbitScene.collisionSystem) {
            console.log('⚠ Система столкновений не инициализирована');
            return;
        }
        
        const collisionSystem = earthOrbitScene.collisionSystem;
        
        // Обновляем счетчики частиц (требует перегенерации)
        const needsRegeneration = 
            collisionSystem.earthParticleCount !== earthOrbit.earthParticles ||
            collisionSystem.atmosphereParticleCount !== earthOrbit.atmosphereParticles;
        
        if (needsRegeneration) {
            collisionSystem.earthParticleCount = earthOrbit.earthParticles;
            collisionSystem.atmosphereParticleCount = earthOrbit.atmosphereParticles;
            
            // Перегенерация требует перезагрузки сцены
            console.log('⚠ Изменение количества частиц требует перезагрузки сцены');
        }
        
        // Обновляем параметры частиц
        const allParticles = [
            ...collisionSystem.earthParticles,
            ...collisionSystem.atmosphereParticles
        ];
        
        allParticles.forEach(particle => {
            particle.coolingRate = earthOrbit.coolingRate;
            if (particle.isAtmosphere) {
                particle.dampingFactor = earthOrbit.particleDamping;
            }
        });
        
        // Радиус атмосферы
        collisionSystem.atmosphereRadius = earthOrbit.atmosphereRadius;
        
        // Сила гравитации
        earthOrbitScene.gravityStrength = earthOrbit.gravityStrength;
        
        // Видимость маркеров частиц
        earthOrbitScene.showParticleMarkers = earthOrbit.showParticleMarkers;
        
        console.log('✓ Настройки околоземной сцены применены');
    }
    
    applyPlanetSurfaceSettings(planetSurface) {
        if (this.app.getCurrentScene() !== 'planet-surface') {
            console.log('⚠ Сцена поверхности не активна');
            return;
        }
        
        const planetSurfaceScene = this.app.getPlanetSurfaceScene();
        if (!planetSurfaceScene) {
            console.log('⚠ Сцена поверхности не инициализирована');
            return;
        }
        
        planetSurfaceScene.setCloudDensity(planetSurface.cloudDensity);
        planetSurfaceScene.setCloudRadius(planetSurface.cloudRadius);
        planetSurfaceScene.setAnimateClouds(planetSurface.cloudAnimationSpeed > 0);
        planetSurfaceScene.setExplosionRadius(planetSurface.explosionRadius);
        planetSurfaceScene.setExplosionDuration(planetSurface.explosionDuration);
        planetSurfaceScene.setExplosionGlow(planetSurface.explosionGlow);
        
        // Скорость анимации облаков через shader
        if (planetSurfaceScene.cloudMaterial) {
            planetSurfaceScene.cloudMaterial.uniforms.u_animationSpeed = {
                value: planetSurface.cloudAnimationSpeed
            };
        }
        
        console.log('✓ Настройки поверхности планеты применены');
    }
    
    applyFilters(filters) {
        const currentScene = this.app.getCurrentScene();
        
        if (currentScene === 'solar-system') {
            const solarScene = this.app.getSolarSystemScene();
            if (!solarScene) return;
            
            // Поиск по имени
            if (filters.searchQuery) {
                this.filterBySearch(solarScene, filters.searchQuery);
            }
            
            // Фильтр по размеру
            this.filterBySize(solarScene, filters.sizeFilter);
            
            // Фильтр по типу опасности
            this.filterByDanger(solarScene, filters.dangerFilter);
            
            // Скрыть малые объекты
            if (filters.hideSmallObjects) {
                this.hideSmallObjects(solarScene, filters.minVisibleSize);
            }
        }
        
        console.log('✓ Фильтры применены');
    }
    
    filterBySearch(solarScene, query) {
        const lowerQuery = query.toLowerCase();
        
        // Поиск среди планет
        solarScene.planets.forEach(planet => {
            const name = planet.userData.name?.toLowerCase() || '';
            planet.visible = name.includes(lowerQuery);
        });
        
        // Автоматический фокус на первом найденном объекте
        const found = solarScene.planets.find(p => p.visible);
        if (found) {
            const cameraController = this.app.getCameraController();
            cameraController.focusOnObject(found);
        }
    }
    
    filterBySize(solarScene, sizeFilter) {
        if (!solarScene.asteroids) return;
        
        const asteroidPoints = solarScene.scene.getObjectByName('asteroidPoints');
        if (!asteroidPoints) return;
        
        const positions = asteroidPoints.geometry.attributes.position.array;
        const colors = asteroidPoints.geometry.attributes.color.array;
        
        solarScene.asteroids.forEach((asteroid, i) => {
            const diameter = asteroid.data?.diameter_km || 0;
            const isVisible = diameter >= sizeFilter.min && diameter <= sizeFilter.max;
            
            if (!isVisible) {
                // Скрываем астероид, перемещая его далеко
                positions[i * 3] = 999999;
                positions[i * 3 + 1] = 999999;
                positions[i * 3 + 2] = 999999;
                
                // Делаем прозрачным
                colors[i * 3] = 0;
                colors[i * 3 + 1] = 0;
                colors[i * 3 + 2] = 0;
            }
        });
        
        asteroidPoints.geometry.attributes.position.needsUpdate = true;
        asteroidPoints.geometry.attributes.color.needsUpdate = true;
    }
    
    filterByDanger(solarScene, dangerFilter) {
        if (!solarScene.asteroids || dangerFilter === 'all') return;
        
        const asteroidPoints = solarScene.scene.getObjectByName('asteroidPoints');
        if (!asteroidPoints) return;
        
        const positions = asteroidPoints.geometry.attributes.position.array;
        
        solarScene.asteroids.forEach((asteroid, i) => {
            let isVisible = true;
            
            if (dangerFilter === 'pha') {
                isVisible = asteroid.data?.pha === 'Y';
            } else if (dangerFilter === 'neo') {
                isVisible = asteroid.data?.neo === 'Y';
            } else if (dangerFilter === 'mainBelt') {
                const sma = asteroid.data?.semi_major_axis || 0;
                isVisible = sma > 2.0 && sma < 3.5;
            }
            
            if (!isVisible) {
                positions[i * 3] = 999999;
                positions[i * 3 + 1] = 999999;
                positions[i * 3 + 2] = 999999;
            }
        });
        
        asteroidPoints.geometry.attributes.position.needsUpdate = true;
    }
    
    hideSmallObjects(solarScene, minSize) {
        if (!solarScene.asteroids) return;
        
        const asteroidPoints = solarScene.scene.getObjectByName('asteroidPoints');
        if (!asteroidPoints) return;
        
        const positions = asteroidPoints.geometry.attributes.position.array;
        
        solarScene.asteroids.forEach((asteroid, i) => {
            const diameter = asteroid.data?.diameter_km || 0;
            
            if (diameter < minSize) {
                positions[i * 3] = 999999;
                positions[i * 3 + 1] = 999999;
                positions[i * 3 + 2] = 999999;
            }
        });
        
        asteroidPoints.geometry.attributes.position.needsUpdate = true;
    }
    
    applySingleSetting(category, key, value) {
        // Применяем одну настройку без перезагрузки всех
        const settings = { [key]: value };
        
        switch(category) {
            case 'visual':
                this.applyVisualSettings({ ...this.settingsManager.getSettings().visual, ...settings });
                break;
            case 'camera':
                this.applyCameraSettings({ ...this.settingsManager.getSettings().camera, ...settings });
                break;
            case 'display':
                this.applyDisplaySettings({ ...this.settingsManager.getSettings().display, ...settings });
                break;
            case 'earthOrbit':
                this.applyEarthOrbitSettings({ ...this.settingsManager.getSettings().earthOrbit, ...settings });
                break;
            case 'planetSurface':
                this.applyPlanetSurfaceSettings({ ...this.settingsManager.getSettings().planetSurface, ...settings });
                break;
            case 'filters':
                this.applyFilters({ ...this.settingsManager.getSettings().filters, ...settings });
                break;
        }
    }
    
    // Утилиты
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : { r: 1, g: 1, b: 1 };
    }
    
    // Публичные методы для внешнего управления
    openSettings() {
        this.settingsManager.show();
    }
    
    closeSettings() {
        this.settingsManager.hide();
    }
    
    getSetting(category, key) {
        return this.settingsManager.getSetting(category, key);
    }
    
    setSetting(category, key, value) {
        this.settingsManager.setSetting(category, key, value);
    }
}