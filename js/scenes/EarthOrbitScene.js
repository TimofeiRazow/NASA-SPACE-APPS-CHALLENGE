import * as THREE from "https://unpkg.com/three@0.180.0/build/three.module.js?module";
import { CollisionSystem } from '../physics/CollisionSystem.js';
import { Asteroid } from '../physics/Asteroid.js';

export class EarthOrbitScene {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.scene = sceneManager.getScene();
        this.camera = sceneManager.getCamera();
        this.renderer = sceneManager.getRenderer();
        
        this.collisionSystem = null;
        this.asteroids = [];
        this.totalLaunched = 0;
        this.time = 0;
        
        // Настройки симуляции
        this.asteroidSize = 2.5;
        this.asteroidSpeed = 25;
        this.blastRadius = 1;
        this.gravityEnabled = true;
        this.atmosphereEnabled = true;
    }
    
    async create() {
        this.clearScene();
        
        // Создание системы столкновений
        this.collisionSystem = new CollisionSystem(this.scene);
        
        // Загрузка текстур и создание системы частиц
        await this.collisionSystem.loadTextures();
        await this.collisionSystem.generateParticles();
        
        this.collisionSystem.atmosphereParticleSystem.userData.excludeFromBloom = true;
        // Настройка освещения для Земли
        this.setupEarthLighting();
        
        
        console.log('Околоземная сцена создана');
    }
    
    setupEarthLighting() {
        // Уменьшаем ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.1);
        this.scene.add(ambientLight);
        
        // Создаем солнце как точечный источник света
        this.sunLight = new THREE.PointLight(0xffffaa, 0.2, 200);
        this.sunLight.position.set(50, 30, 50);
        this.scene.add(this.sunLight);
        
        // Визуальное представление солнца
        const sunGeometry = new THREE.SphereGeometry(2, 16, 16);
        const textureLoader = new THREE.TextureLoader();
        const sunMat = new THREE.MeshStandardMaterial({
            emissive: 0xFFF88F,
            emissiveMap: textureLoader.load('../../data/sun.jpg'),
            emissiveIntensity: 2
        });
        this.sunMesh = new THREE.Mesh(sunGeometry, sunMat);
        this.sunMesh.position.copy(this.sunLight.position);
        this.scene.add(this.sunMesh);
        
        // Дополнительный направленный свет от солнца
        const directionalLight = new THREE.DirectionalLight(0xffffaa, 1.0);
        directionalLight.position.set(50, 30, 50);
        directionalLight.target.position.set(0, 0, 0);
        this.scene.add(directionalLight);
        this.scene.add(directionalLight.target);
    }
    
    launchAsteroid(targetDirection, customParams = {}) {
        const distance = 30;
        const asteroidPosition = targetDirection.clone().multiplyScalar(distance);
        
        const size = customParams.size ? customParams.size / 1000 : this.asteroidSize;
        const speed = customParams.velocity || this.asteroidSpeed;
        
        const asteroid = new Asteroid(
            this.scene,
            size,
            -speed,
            asteroidPosition,
            targetDirection
        );
        
        // Дополнительные данные для пользовательских астероидов
        if (customParams.material) {
            asteroid.userData = {
                ...asteroid.userData,
                material: customParams.material,
                customSize: customParams.size,
                velocity: customParams.velocity,
                angle: customParams.angle
            };
            
            // Изменяем цвет материала в зависимости от типа
            let color;
            switch (customParams.material) {
                case 'stone': color = 0x8B4513; break;
                case 'metal': color = 0x708090; break;
                case 'ice': color = 0xE0FFFF; break;
                default: color = 0x333333;
            }
            asteroid.mesh.material.color.setHex(color);
        }
        
        this.asteroids.push(asteroid);
        this.totalLaunched++;
        
        return asteroid;
    }
    
    update(deltaTime, timeScale = 1) {
        this.time += deltaTime * timeScale;
        
        // Обновление астероидов с проверкой столкновений
        const particleData = {
            earth: this.collisionSystem.earthParticles,
            atmosphere: this.collisionSystem.atmosphereParticles
        };
        
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const asteroid = this.asteroids[i];
            const impact = asteroid.update(particleData, timeScale);
            
            if (impact) {
                this.triggerImpact(impact);
                
                // Удаляем астероид через небольшое время
                setTimeout(() => {
                    const index = this.asteroids.indexOf(asteroid);
                    if (index > -1) {
                        asteroid.destroy();
                        this.asteroids.splice(index, 1);
                    }
                }, 1000);
            }
        }
        // Обновление системы частиц
        this.collisionSystem.updateParticles(deltaTime, this.gravityEnabled, timeScale);
        this.collisionSystem.updateParticleSystems();
        
        // Обновление освещения от горячих частиц (каждый 3-й кадр)
        if (Math.floor(this.time * 60) % 3 === 0) {
            this.collisionSystem.updateParticleLights();
        }
        
        // Управление видимостью атмосферы
        if (this.collisionSystem.atmosphereParticleSystem) {
            this.collisionSystem.atmosphereParticleSystem.visible = this.atmosphereEnabled;
        }
    }
    
    triggerImpact(impact) {
        const physicalRadius = this.calculateBlastRadius(impact.size, this.asteroidSpeed);
        const finalBlastRadius = this.blastRadius * physicalRadius;
        this.collisionSystem.triggerImpact(impact, finalBlastRadius);
    }
    
    
    createCustomAsteroid(asteroidData) {
        const targetDirection = new THREE.Vector3(
            asteroidData.impactPoint.x,
            asteroidData.impactPoint.y,
            asteroidData.impactPoint.z
        ).normalize();
        
        return this.launchAsteroid(targetDirection, asteroidData);
    }
    
    resetSimulation() {
        // Удаляем все астероиды
        this.asteroids.forEach(asteroid => asteroid.destroy());
        this.asteroids = [];
        this.totalLaunched = 0;
        this.time = 0;
        
        // Сброс системы частиц
        this.collisionSystem.resetSimulation();
    }
    
    updateSettings(settings) {
        if (settings.asteroidSize !== undefined) {
            this.asteroidSize = settings.asteroidSize;
        }
        if (settings.asteroidSpeed !== undefined) {
            this.asteroidSpeed = settings.asteroidSpeed;
        }
        if (settings.blastRadius !== undefined) {
            this.blastRadius = settings.blastRadius;
        }
        if (settings.gravityEnabled !== undefined) {
            this.gravityEnabled = settings.gravityEnabled;
        }
        if (settings.atmosphereEnabled !== undefined) {
            this.atmosphereEnabled = settings.atmosphereEnabled;
        }
    }
    
    getClickableObjects() {
        // В околоземной сцене кликабельными являются астероиды и система частиц
        const clickableObjects = [...this.asteroids.map(a => a.mesh)];
        
        // Добавляем систему частиц Земли для кликов по поверхности
        if (this.collisionSystem.earthParticleSystem) {
            clickableObjects.push(this.collisionSystem.earthParticleSystem);
        }
        
        return clickableObjects;
    }
    
    getStats() {
        const activeAsteroids = this.asteroids.filter(a => a.isActive).length;
        const collisionStats = this.collisionSystem.getStatistics();
        return {
            activeAsteroids,
            totalLaunched: this.totalLaunched,
            ...collisionStats,
            countOfObjects: (collisionStats.countOfObjects + activeAsteroids),
        };
    }
    
    clearScene() {
        // Удаляем все астероиды
        this.asteroids.forEach(asteroid => asteroid.destroy());
        this.asteroids = [];
        
        // Очищаем систему столкновений
        if (this.collisionSystem) {
            this.collisionSystem.resetSimulation();
        }
        
        // Удаляем освещение (кроме базового)
        const lightsToRemove = [];
        this.scene.traverse(child => {
            if (child.type === 'PointLight' && child !== this.sunLight) {
                lightsToRemove.push(child);
            }
        });
        lightsToRemove.forEach(light => this.scene.remove(light));
    }
    
    // Методы для настройки симуляции из UI
    setAsteroidSize(size) {
        this.asteroidSize = size;
    }
    
    setAsteroidSpeed(speed) {
        this.asteroidSpeed = speed;
    }
    
    setBlastRadius(radius) {
        this.blastRadius = radius;
    }
    
    setGravityEnabled(enabled) {
        this.gravityEnabled = enabled;
    }
    
    setAtmosphereEnabled(enabled) {
        this.atmosphereEnabled = enabled;
        if (this.collisionSystem.atmosphereParticleSystem) {
            this.collisionSystem.atmosphereParticleSystem.visible = enabled;
        }
    }
    
    // Получение энергии удара для UI
    calculateImpactEnergy() {
        const mass = Math.pow(this.asteroidSize, 3) * 0.5;
        const energy = 0.5 * mass * Math.pow(this.asteroidSpeed, 2) * 4.18;
        return energy;
    }

    calculateBlastRadius(asteroidSize, velocity) {
        // Физически обоснованная формула для радиуса кратера/взрыва
        const mass = Math.pow(asteroidSize, 3) * 2700; // кг (плотность камня)
        const energy = 0.5 * mass * Math.pow(velocity * 1000, 2); // Джоули
        
        // Упрощенная формула радиуса кратера
        const craterRadius = 1.8 * Math.pow(energy / (2700 * 9.81), 0.22);
        
        // Масштабируем для игры
        return Math.max(craterRadius * 0.1, 0.5);
    }

}