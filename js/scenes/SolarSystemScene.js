import * as THREE from "https://unpkg.com/three@0.180.0/build/three.module.js?module";

export class SolarSystemScene {
    constructor(sceneManager, dataLoader) {
        this.sceneManager = sceneManager;
        this.dataLoader = dataLoader;
        this.scene = sceneManager.getScene();
        
        this.sun = null;
        this.sunLight = null;
        this.planets = [];
        this.asteroids = [];
        this.orbits = [];
        this.objectLabels = [];
        
        this.phaColor = { r: 1.0, g: 0.0, b: 0.0 };
        this.asteroidColor = { r: 0.8, g: 0.7, b: 0.6 };
        this.asteroidSize = 0.02;

        this.startTime = Date.now();
        this.timeScale = 1;
    }

    updateAsteroids(phaColorHex, asteroidColorHex, size) {
        // Конвертация из hex в RGB
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16) / 255,
                g: parseInt(result[2], 16) / 255,
                b: parseInt(result[3], 16) / 255
            } : { r: 1, g: 1, b: 1 };
        };
        
        this.phaColor = hexToRgb(phaColorHex);
        this.asteroidColor = hexToRgb(asteroidColorHex);
        this.asteroidSize = size;
    
        const asteroidPoints = this.scene.getObjectByName('asteroidPoints');
        if (asteroidPoints && asteroidPoints.material) {
            asteroidPoints.material.size = size;
            asteroidPoints.material.needsUpdate = true;
        }
    }
    
    async create() {
        this.clearScene();
        
        const textureLoader = new THREE.TextureLoader();
        
        // Загрузка фона
        this.sceneManager.loadBackground('./data/milky_way.jpg');
        
        // Создание солнца и освещения
        this.createSun(textureLoader);
        this.setupSolarLighting();
        
        // Создание планет
        await this.createPlanets(textureLoader);
        
        // Создание астероидов
        this.createAsteroidBelt();
        
        console.log('Солнечная система создана');
    }
    
    createSun(textureLoader) {
        const sunRadius = 695700 / 1000000; // Уменьшенный радиус солнца для масштаба
        const sunGeom = new THREE.SphereGeometry(sunRadius, 32, 20);
        const sunMat = new THREE.MeshStandardMaterial({
            emissive: 0xFFF88F,
            emissiveMap: textureLoader.load('./data/sun.jpg'),
            emissiveIntensity: 1.8
        });
        
        this.sun = new THREE.Mesh(sunGeom, sunMat);
        this.sun.userData.name = 'Sun';
        this.sun.position.set(0, 0, 0); // Солнце в центре
        this.scene.add(this.sun);
    }
    
    setupSolarLighting() {
        // Удаляем существующие источники света перед созданием новых
        this.clearLighting();
        
        // Ambient light - слабое общее освещение
        const ambientLight = new THREE.AmbientLight(0x404040, 0.05);
        ambientLight.name = 'solarAmbientLight';
        this.scene.add(ambientLight);
        
        // Основной источник света от солнца - Point Light
        this.sunLight = new THREE.PointLight(0xFFFAF0, 2.0, 10000, 0.1);
        this.sunLight.position.set(0, 0, 0); // Солнце в центре координат
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.name = 'sunPointLight';
        this.scene.add(this.sunLight);
        
        // Дополнительный directional light для лучшего освещения дальних планет
        const directionalLight = new THREE.DirectionalLight(0xFFFAF0, 0.8);
        directionalLight.position.set(0, 10, 0);
        directionalLight.target.position.set(0, 0, 0);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        directionalLight.name = 'sunDirectionalLight';
        this.scene.add(directionalLight);
        this.scene.add(directionalLight.target);
        
        console.log('Солнечное освещение настроено');
    }
    
    clearLighting() {
        // Удаляем все источники света с именами, связанными с солнечной системой
        const lightsToRemove = [];
        this.scene.traverse(child => {
            if (child.type === 'AmbientLight' || child.type === 'PointLight' || child.type === 'DirectionalLight') {
                if (child.name && child.name.includes('solar') || child.name && child.name.includes('sun')) {
                    lightsToRemove.push(child);
                }
            }
        });
        
        lightsToRemove.forEach(light => {
            this.scene.remove(light);
        });
    }
    
    async createPlanets(textureLoader) {
        const planets = this.dataLoader.planetData.solar_system?.planets || [];
        
        // Создание специального шейдера для Земли с правильным освещением
        const earthMaterial = new THREE.ShaderMaterial({
            uniforms: {
                dayTexture: { type: "t", value: textureLoader.load('./data/earth_daymap.jpg') },
                nightTexture: { type: "t", value: textureLoader.load('./data/earth_nightmap.jpg') },
                sunPosition: { type: "v3", value: new THREE.Vector3(0, 0, 0) } // Солнце в центре
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec2 vUv;
                varying vec3 vSunDirection;
                varying vec3 vWorldPosition;
                uniform vec3 sunPosition;

                void main() {
                    vUv = uv;
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    vSunDirection = normalize(sunPosition - worldPosition.xyz);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D dayTexture;
                uniform sampler2D nightTexture;
                varying vec3 vNormal;
                varying vec2 vUv;
                varying vec3 vSunDirection;
                varying vec3 vWorldPosition;

                void main() {
                    float intensity = max(dot(vNormal, vSunDirection), 0.0);
                    
                    vec4 dayColor = texture2D(dayTexture, vUv);
                    vec4 nightColor = texture2D(nightTexture, vUv) * 0.3;
                    
                    // Плавный переход между дневной и ночной стороной
                    float mixFactor = smoothstep(-0.2, 0.2, intensity);
                    vec4 finalColor = mix(nightColor, dayColor, mixFactor);
                    
                    // Добавляем атмосферное рассеяние
                    float atmosphereGlow = pow(1.0 - intensity, 2.0) * 0.3;
                    finalColor.rgb += vec3(0.5, 0.7, 1.0) * atmosphereGlow;
                    
                    gl_FragColor = finalColor;
                }
            `
        });
        
        planets.forEach((planetInfo, planetIndex) => {
            const scaledDistance = planetInfo.semi_major_axis * 15;
            const scaledRadius = Math.max(planetInfo.radius / 6371 * 0.8, 0.001);

            // Создание орбиты
            this.createOrbit(scaledDistance, planetInfo.eccentricity || 0);

            // Создание планеты
            const planetGeometry = new THREE.SphereGeometry(scaledRadius, 32, 32); // Увеличили детализацию
            let planetMaterial;
            
            if (planetInfo.name === 'Earth') {
                planetMaterial = earthMaterial;
            } else {
                // Для остальных планет используем стандартные материалы с правильным освещением
                planetMaterial = new THREE.MeshPhongMaterial({
                    map: textureLoader.load(planetInfo.texture),
                    bumpMap: planetInfo.bump ? textureLoader.load(planetInfo.bump) : null,
                    bumpScale: 0.5,
                    shininess: planetInfo.name === 'Venus' ? 100 : 30,
                    specular: planetInfo.name === 'Venus' ? 0x222222 : 0x111111
                });
                
                if (planetInfo.name === 'Mars') {
                    planetMaterial.bumpScale = 0.3;
                    planetMaterial.color.setHex(0xCD5C5C);
                }
            }

            const planet = new THREE.Mesh(planetGeometry, planetMaterial);
            planet.castShadow = true;
            planet.receiveShadow = true;
            
            const initialAngle = (planetInfo.mean_anomaly || 0) * Math.PI / 180;
            planet.position.x = scaledDistance * Math.cos(initialAngle);
            planet.position.z = scaledDistance * Math.sin(initialAngle);
            
            planet.userData = {
                distance: scaledDistance,
                period: planetInfo.orbital_period,
                name: planetInfo.name,
                angle: initialAngle,
                eccentricity: planetInfo.eccentricity || 0,
                inclination: (planetInfo.inclination || 0) * Math.PI / 180,
                originalData: planetInfo
            };
            
            this.scene.add(planet);
            this.planets.push(planet);

            this.createObjectLabel(planet, planetInfo.name);
            
            if (planetInfo.moons && planetInfo.moons.length > 0) {
                this.createMoons(planetInfo.moons, planet, textureLoader);
            }
        });
    }
    
    createOrbit(distance, eccentricity) {
        const a = distance;
        const e = eccentricity;
        const b = a * Math.sqrt(1 - e * e);

        const curve = new THREE.EllipseCurve(-a * e, 0, a, b);
        const points = curve.getPoints(256);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x444488,
            opacity: 0.3,
            transparent: true
        });
        const orbit = new THREE.LineLoop(geometry, material);
        orbit.rotation.x = -Math.PI / 2;
        this.scene.add(orbit);
        this.orbits.push(orbit);
    }
    
    createMoons(moons, parentPlanet, textureLoader) {
        moons.forEach(moonInfo => {
            const moonRadius = Math.max(moonInfo.radius / 6371 * 0.5, 0.02);
            const moonDistance = moonInfo.semi_major_axis / 100000;

            const moonGeometry = new THREE.SphereGeometry(moonRadius, 16, 16);
            const moonMaterial = new THREE.MeshPhongMaterial({
                map: textureLoader.load(moonInfo.texture || './data/moon.jpg'),
                bumpMap: moonInfo.bump ? textureLoader.load(moonInfo.bump) : null,
                bumpScale: 0.5
            });
            const moon = new THREE.Mesh(moonGeometry, moonMaterial);
            moon.castShadow = true;
            moon.receiveShadow = true;
            
            moon.userData = {
                parent: parentPlanet,
                distance: moonDistance,
                period: moonInfo.orbital_period,
                angle: (moonInfo.mean_anomaly || 0) * Math.PI / 180,
                name: moonInfo.name
            };
            
            this.scene.add(moon);
            this.planets.push(moon);

            // Создание метки для луны
            this.createObjectLabel(moon, moonInfo.name);
        });
    }
    
    createAsteroidBelt() {
        const asteroidCount = this.dataLoader.asteroidData.length; // Ограничиваем количество для производительности
        const asteroidGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(asteroidCount * 3);
        const colors = new Float32Array(asteroidCount * 3);
        
        this.asteroids = [];
        
        for (let i = 0; i < asteroidCount; i++) {
            const asteroidInfo = this.dataLoader.asteroidData[i] || {};
            let x, y, z;
            
            
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            
            // Цвет астероида зависит от расстояния до солнца
            const distanceToSun = Math.sqrt(x * x + y * y + z * z);
            const colorIntensity = Math.max(0.3, Math.min(1.0, 50 / distanceToSun));
            // colors[i * 3] = 0.8 * colorIntensity;     // R
            // colors[i * 3 + 1] = 0.7 * colorIntensity; // G
            // colors[i * 3 + 2] = 0.6 * colorIntensity; // B
            if (asteroidInfo.pha && asteroidInfo.pha == "Y"){
                // Красный цвет для опасных астероидов
                colors[i * 3] = 1.0;                    // R
                colors[i * 3 + 1] = 0.1 * colorIntensity; // G
                colors[i * 3 + 2] = 0.1 * colorIntensity; // B
            } else {
                // Обычный цвет для остальных астероидов
                colors[i * 3] = 0.8 * colorIntensity;     // R
                colors[i * 3 + 1] = 0.7 * colorIntensity; // G
                colors[i * 3 + 2] = 0.6 * colorIntensity; // B
            }
            
            
            this.asteroids.push({
                index: i,
                data: asteroidInfo,
                originalPosition: { x, y, z }
            });
        }
        
        asteroidGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        asteroidGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const asteroidMaterial = new THREE.PointsMaterial({
            size: this.asteroidSize,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true,
            alphaTest: 0.1,
            vertexColors: true
        });
        
        const asteroidPoints = new THREE.Points(asteroidGeometry, asteroidMaterial);
        asteroidPoints.name = 'asteroidPoints';
        this.scene.add(asteroidPoints);
    }
    
    createObjectLabel(object, text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = 'white';
        context.font = 'bold 18px Arial';
        context.textAlign = 'center';
        context.strokeStyle = 'black';
        
        // Обводка для лучшей читаемости
        context.strokeText(text, canvas.width / 2, canvas.height / 2 + 6);
        context.fillText(text, canvas.width / 2, canvas.height / 2 + 6);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        sprite.position.copy(object.position);
        sprite.position.y += object.geometry.parameters.radius * 2.5;
        sprite.scale.set(8, 2, 1);
        sprite.renderOrder = 999;

        this.scene.add(sprite);
        this.objectLabels.push(sprite);

        return sprite;
    }
    
    update(deltaTime, timeScale) {
        this.timeScale = timeScale;
        
        // Обновляем позицию солнца для шейдера Земли
        if (this.sun) {
            const earthMaterial = this.planets.find(p => p.userData.name === 'Earth')?.material;
            if (earthMaterial && earthMaterial.uniforms && earthMaterial.uniforms.sunPosition) {
                earthMaterial.uniforms.sunPosition.value.copy(this.sun.position);
            }
        }
        
        // Анимация планет и спутников
        this.planets.forEach(celestialBody => {
            const data = celestialBody.userData;
            
            if (data.parent) {
                // Спутник
                data.angle += (deltaTime * timeScale * 2 * Math.PI) / (data.period || 27.32);
                
                const x = Math.cos(data.angle) * data.distance;
                const z = Math.sin(data.angle) * data.distance;
                
                celestialBody.position.copy(data.parent.position);
                celestialBody.position.x += x;
                celestialBody.position.z += z;
            } else if (data.period) {
                // Планета
                data.angle += (deltaTime * timeScale * 2 * Math.PI) / data.period;
                
                const eccentricAnomaly = data.angle;
                const trueAnomaly = eccentricAnomaly + 2 * data.eccentricity * Math.sin(eccentricAnomaly);
                
                const distance = data.distance * (1 - data.eccentricity * Math.cos(eccentricAnomaly));
                const x = Math.cos(trueAnomaly) * distance;
                const z = Math.sin(trueAnomaly) * distance;
                const y = Math.sin(data.inclination) * distance * 0.1;
                
                celestialBody.position.set(x, y, z);
                
                // Вращение планеты
                if (data.originalData && data.originalData.rotation_period) {
                    const rotationSpeed = (deltaTime * timeScale * 2 * Math.PI) / Math.abs(data.originalData.rotation_period);
                    celestialBody.rotation.y += rotationSpeed;
                }
            }
        });

        this.updateAsteroidPositions();
        this.updateObjectLabels();
    }
    
    updateAsteroidPositions() {
        const asteroidPoints = this.scene.getObjectByName('asteroidPoints');
        if (!asteroidPoints) return;
        
        const positions = asteroidPoints.geometry.attributes.position.array;
        const colors = asteroidPoints.geometry.attributes.color.array;
        const time = (Date.now() - this.startTime) * 0.001 * this.timeScale;
        
        this.asteroids.forEach((asteroid, index) => {
            const data = asteroid.data;
            const i3 = index * 3;
            
            if (data.semi_major_axis && data.eccentricity !== undefined) {
                const meanAnomaly = time * 2 * Math.PI / (data.orbital_period || 1000) + index;
                const eccentricAnomaly = meanAnomaly + data.eccentricity * Math.sin(meanAnomaly);
                
                const distance = data.semi_major_axis * 15 * (1 - data.eccentricity * Math.cos(eccentricAnomaly));
                const trueAnomaly = eccentricAnomaly + 2 * data.eccentricity * Math.sin(eccentricAnomaly);
                
                positions[i3] = Math.cos(trueAnomaly + index) * distance;
                positions[i3 + 2] = Math.sin(trueAnomaly + index) * distance;
                positions[i3 + 1] = Math.sin(data.inclination || 0) * distance * 0.1;
            }
            
            // Обновляем освещенность астероида в зависимости от расстояния до солнца
            const distanceToSun = Math.sqrt(positions[i3] * positions[i3] + 
                                           positions[i3 + 1] * positions[i3 + 1] + 
                                           positions[i3 + 2] * positions[i3 + 2]);
            const colorIntensity = Math.max(0.3, Math.min(1.0, 50 / distanceToSun));
            if (asteroid.data.pha && asteroid.data.pha == "Y") {
                colors[index * 3] = this.phaColor.r * colorIntensity;
                colors[index * 3 + 1] = this.phaColor.g * colorIntensity;
                colors[index * 3 + 2] = this.phaColor.b * colorIntensity;
            } else {
                colors[index * 3] = this.asteroidColor.r * colorIntensity;
                colors[index * 3 + 1] = this.asteroidColor.g * colorIntensity;
                colors[index * 3 + 2] = this.asteroidColor.b * colorIntensity;
            }
        });
        
        asteroidPoints.geometry.attributes.position.needsUpdate = true;
        asteroidPoints.geometry.attributes.color.needsUpdate = true;
    }
    
    updateObjectLabels() {
        this.objectLabels.forEach((label, index) => {
            if (this.planets[index]) {
                const planet = this.planets[index];
                label.position.copy(planet.position);
                label.position.y += planet.geometry.parameters.radius * 2.5;
                
                // Скрываем метки при большом удалении
                const camera = this.sceneManager.getCamera();
                const distance = camera.position.distanceTo(planet.position);
                label.visible = distance > 20 && distance < 120;
                
                // Масштабируем метки в зависимости от расстояния
                const scale = distance / 100
                label.scale.set(28 * scale, 7 * scale, 1);
            }
        });
    }
    
    getClickableObjects() {
        return this.planets;
    }
    
    clearScene() {
        // Очищаем освещение
        this.clearLighting();
        
        // Очищаем метки
        this.objectLabels.forEach(label => this.scene.remove(label));
        this.objectLabels = [];
        
        // Очищаем объекты
        this.planets = [];
        this.asteroids = [];
        this.orbits.forEach(orbit => this.scene.remove(orbit));
        this.orbits = [];
        
        // Удаляем солнце
        if (this.sun) {
            this.scene.remove(this.sun);
            this.sun = null;
        }
        
        // Удаляем астероидные точки
        const asteroidPoints = this.scene.getObjectByName('asteroidPoints');
        if (asteroidPoints) {
            this.scene.remove(asteroidPoints);
            asteroidPoints.geometry.dispose();
            asteroidPoints.material.dispose();
        }
    }
    
    getStats() {
        return {
            planetsCount: this.planets.length,
            asteroidsCount: this.asteroids.length,
            orbitsCount: this.orbits.length,
            countOfObjects: this.asteroids.length + this.planets.length + this.orbits.length
        };
    }
}