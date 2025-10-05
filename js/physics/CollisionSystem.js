import * as THREE from "https://unpkg.com/three@0.180.0/build/three.module.js?module";
import { EarthParticle } from './EarthParticle.js';

export class CollisionSystem {
    constructor(scene) {
        this.scene = scene;
        this.earthParticles = [];
        this.atmosphereParticles = [];
        this.earthParticleSystem = null;
        this.atmosphereParticleSystem = null;
        this.particleLights = [];
        this.maxParticleLights = 10;
        
        this.earthParticleCount = 60000;
        this.atmosphereParticleCount = 30000;
        this.earthRadius = 5;
        this.atmosphereRadius = 7;
        
        // Переменные для загрузки текстур
        this.earthCanvas = null;
        this.earthContext = null;
        this.atmosphereCanvas = null;
        this.atmosphereContext = null;
        this.oldGravityCenter = new THREE.Vector3(0,0,0);
    }
    
    async loadTextures() {
        const loadTexture = (src) => {
            return new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => {
                    console.warn(`Не удалось загрузить ${src}`);
                    resolve(null);
                };
                image.src = src;
            });
        };
        
        const earthImage = await loadTexture('./data/earth_daymap.jpg');
        const atmosphereImage = await loadTexture('./data/earth_atmosphere.jpg');
        
        if (earthImage) {
            this.earthCanvas = document.createElement('canvas');
            this.earthCanvas.width = earthImage.width;
            this.earthCanvas.height = earthImage.height;
            this.earthContext = this.earthCanvas.getContext('2d');
            this.earthContext.drawImage(earthImage, 0, 0);
        }
        
        if (atmosphereImage) {
            this.atmosphereCanvas = document.createElement('canvas');
            this.atmosphereCanvas.width = atmosphereImage.width;
            this.atmosphereCanvas.height = atmosphereImage.height;
            this.atmosphereContext = this.atmosphereCanvas.getContext('2d');
            this.atmosphereContext.drawImage(atmosphereImage, 0, 0);
        }
    }
    
    getColorFromTexture(lat, lon, isAtmosphere = false) {
        const canvas = isAtmosphere ? this.atmosphereCanvas : this.earthCanvas;
        const context = isAtmosphere ? this.atmosphereContext : this.earthContext;
        
        if (!canvas) {
            return this.getProceduralColor(lat, lon, isAtmosphere);
        }
        
        try {
            const u = (lon + Math.PI) / (2 * Math.PI);
            const v = (Math.PI - lat) / Math.PI;
            
            const x = Math.floor(u * (canvas.width - 1));
            const y = Math.floor(v * (canvas.height - 1));
            
            const imageData = context.getImageData(x, y, 1, 1);
            const data = imageData.data;
            
            return new THREE.Color(data[0] / 255, data[1] / 255, data[2] / 255);
        } catch (error) {
            return this.getProceduralColor(lat, lon, isAtmosphere);
        }
    }
    
    getProceduralColor(lat, lon, isAtmosphere = false) {
        if (isAtmosphere) {
            const intensity = 0.3 + Math.sin(lat * 2) * Math.cos(lon * 3) * 0.2;
            return new THREE.Color(0.4 + intensity * 0.3, 0.6 + intensity * 0.2, 1.0);
        } else {
            const noise = Math.sin(lat * 4) * Math.cos(lon * 3) + Math.sin(lon * 5);
            if (noise > 0.3) {
                return new THREE.Color(0.1, 0.6, 0.1); // Континенты
            } else if (noise > -0.2) {
                return new THREE.Color(0.4, 0.3, 0.1); // Побережье
            } else {
                return new THREE.Color(0.1, 0.3, 0.8); // Океаны
            }
        }
    }
    
    getOpacityFromAtmosphereTexture(lat, lon) {
        if (!this.atmosphereCanvas) {
            return 0.6;
        }
        
        try {
            const u = (lon + Math.PI) / (2 * Math.PI);
            const v = (Math.PI - lat) / Math.PI;
            
            const x = Math.floor(u * (this.atmosphereCanvas.width - 1));
            const y = Math.floor(v * (this.atmosphereCanvas.height - 1));
            
            const imageData = this.atmosphereContext.getImageData(x, y, 1, 1);
            const data = imageData.data;
            
            const brightness = (data[0] + data[1] + data[2]) / 3;
            return brightness / 255;
        } catch (error) {
            return 0.6;
        }
    }
    
    async generateParticles() {
        return new Promise((resolve) => {
            this.earthParticles = [];
            this.atmosphereParticles = [];
            
            // Генерация частиц Земли
            for (let i = 0; i < this.earthParticleCount; i++) {
                const u = Math.random();
                const v = Math.random();
                const w = Math.random();
                
                const theta = 2 * Math.PI * u;
                const phi = Math.acos(2 * v - 1);
                
                const radiusBias = Math.pow(w, 0.3);
                const radius = this.earthRadius * 0.3 + this.earthRadius * 0.7 * radiusBias;
                
                const x = radius * Math.sin(phi) * Math.cos(theta);
                const y = radius * Math.sin(phi) * Math.sin(theta);
                const z = radius * Math.cos(phi);
                
                const position = new THREE.Vector3(x, y, z);
                
                let color;
                const distanceFromCenter = position.length();
                
                if (distanceFromCenter > this.earthRadius * 0.9) {
                    const lat = Math.acos(z / radius);
                    const lon = Math.atan2(y, x);
                    color = this.getColorFromTexture(lat, lon, false);
                } else if (distanceFromCenter > this.earthRadius * 0.6) {
                    color = new THREE.Color(0.8, 0.4, 0.2);
                } else {
                    color = new THREE.Color(0.9, 0.5, 0.1);
                }
                
                const particle = new EarthParticle(position, color, false);
                particle.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
                particle.originalPosition.applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
                this.earthParticles.push(particle);
            }
            
            // Генерация частиц атмосферы
            for (let i = 0; i < this.atmosphereParticleCount; i++) {
                const u = Math.random();
                const v = Math.random();
                const w = Math.random();
                
                const theta = 2 * Math.PI * u;
                const phi = Math.acos(2 * v - 1);
                
                const radiusRange = (this.atmosphereRadius - this.earthRadius) / 5;
                const radius = this.earthRadius + radiusRange * Math.pow(w, 0.5);
                
                const x = radius * Math.sin(phi) * Math.cos(theta);
                const y = radius * Math.sin(phi) * Math.sin(theta);
                const z = radius * Math.cos(phi);
                
                const position = new THREE.Vector3(x, y, z);
                
                const lat = Math.acos(z / radius);
                const lon = Math.atan2(y, x);
                let color = this.getColorFromTexture(lat, lon, true);
                
                const opacity = this.getOpacityFromAtmosphereTexture(lat, lon);
                const heightFactor = (radius - this.earthRadius) / radiusRange;
                
                const particle = new EarthParticle(position, color, true);
                particle.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
                particle.originalPosition.applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
                particle.opacity = opacity * (0.7 - 0.3 * heightFactor);
                particle.originalOpacity = particle.opacity;
                
                // Добавляем орбитальную скорость для атмосферы
                const atmosphereRotationSpeed = 0.015;
                const toCenter = position.clone().normalize();
                const tangential = new THREE.Vector3(0, 1, 0);
                
                if (Math.abs(toCenter.y) > 0.9) {
                    tangential.set(1, 0, 0);
                }
                
                tangential.cross(toCenter).normalize();
                
                const distanceFactor = Math.sqrt(radius / this.earthRadius);
                const heightSpeedFactor = 1.0 - heightFactor * 0.3;
                const orbitalSpeed = atmosphereRotationSpeed * distanceFactor * heightSpeedFactor;
                const randomFactor = 0.8 + Math.random() * 0.4;
                
                particle.velocity = tangential.multiplyScalar(orbitalSpeed * randomFactor);
                
                const turbulence = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1
                );
                particle.velocity.add(turbulence);
                
                this.atmosphereParticles.push(particle);
            }
            
            this.createParticleSystems();
            resolve();
        });
    }
    
    createParticleSystems() {
        // Система частиц Земли
        const earthGeometry = new THREE.BufferGeometry();
        const earthPositions = new Float32Array(this.earthParticleCount * 3);
        const earthColors = new Float32Array(this.earthParticleCount * 3);
        
        for (let i = 0; i < this.earthParticles.length; i++) {
            const particle = this.earthParticles[i];
            const i3 = i * 3;
            
            earthPositions[i3] = particle.position.x;
            earthPositions[i3 + 1] = particle.position.y;
            earthPositions[i3 + 2] = particle.position.z;
            
            earthColors[i3] = particle.color.r;
            earthColors[i3 + 1] = particle.color.g;
            earthColors[i3 + 2] = particle.color.b;
        }
        
        earthGeometry.setAttribute('position', new THREE.BufferAttribute(earthPositions, 3));
        earthGeometry.setAttribute('color', new THREE.BufferAttribute(earthColors, 3));
        
        const earthMaterial = new THREE.ShaderMaterial({
            uniforms: {
                size: { value: 0.5 }
            },
            vertexShader: `
                varying vec3 vColor;
                varying vec3 vPosition;
                varying vec3 vNormal;
                uniform float size;
                
                void main() {
                    vColor = color;
                    vPosition = position;
                    vNormal = normalize(position);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying vec3 vPosition;
                varying vec3 vNormal;
                
                void main() {
                    vec3 sunDirection = normalize(vec3(50.0, 30.0, 50.0) - vPosition);
                    float sunDot = max(0.0, dot(vNormal, sunDirection));
                    vec3 finalColor = vColor * (0.3 + 0.7 * sunDot);
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            transparent: false,
            vertexColors: true
        });
        
        this.earthParticleSystem = new THREE.Points(earthGeometry, earthMaterial);
        this.scene.add(this.earthParticleSystem);
        
        // Система частиц атмосферы
        const atmosphereGeometry = new THREE.BufferGeometry();
        const atmospherePositions = new Float32Array(this.atmosphereParticleCount * 3);
        const atmosphereColors = new Float32Array(this.atmosphereParticleCount * 3);
        const atmosphereOpacities = new Float32Array(this.atmosphereParticleCount);
        
        for (let i = 0; i < this.atmosphereParticles.length; i++) {
            const particle = this.atmosphereParticles[i];
            const i3 = i * 3;
            
            atmospherePositions[i3] = particle.position.x;
            atmospherePositions[i3 + 1] = particle.position.y;
            atmospherePositions[i3 + 2] = particle.position.z;
            
            atmosphereColors[i3] = particle.color.r;
            atmosphereColors[i3 + 1] = particle.color.g;
            atmosphereColors[i3 + 2] = particle.color.b;
            
            atmosphereOpacities[i] = particle.opacity;
        }
        
        atmosphereGeometry.setAttribute('position', new THREE.BufferAttribute(atmospherePositions, 3));
        atmosphereGeometry.setAttribute('color', new THREE.BufferAttribute(atmosphereColors, 3));
        atmosphereGeometry.setAttribute('opacity', new THREE.BufferAttribute(atmosphereOpacities, 1));
        
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                size: { value: 0.3 }
            },
            vertexShader: `
                attribute float opacity;
                varying vec3 vColor;
                varying float vOpacity;
                uniform float size;
                
                void main() {
                    vColor = color;
                    vOpacity = opacity;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vOpacity;

                void main() {
                    float diffRG = abs(vColor.r - vColor.g);
                    float diffRB = abs(vColor.r - vColor.b);
                    float diffGB = abs(vColor.g - vColor.b);
                    bool isGray = (diffRG < 0.01 && diffRB < 0.01 && diffGB < 0.01);
                    float alpha = isGray ? vOpacity : 1.0;
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            transparent: true,
            vertexColors: true
        });
        
        this.atmosphereParticleSystem = new THREE.Points(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(this.atmosphereParticleSystem);
    }
    
    updateParticles(deltaTime, gravityEnabled = true, timeScale = 1) {
        const gravityCenter = this.getDynamicGravityCenter().lerp(this.oldGravityCenter, 0.05);
        this.oldGravityCenter = gravityCenter;
        const gravityStrength = gravityEnabled ? 0.3 : 0;
        //const gravityCenter = new THREE.Vector3(0, 0, 0);
        
        for (let particle of this.earthParticles) {
            particle.update(deltaTime, gravityCenter, gravityStrength, timeScale);
        }
        
        for (let particle of this.atmosphereParticles) {
            particle.update(deltaTime, gravityCenter, gravityStrength * 0.3, timeScale);
        }
    }

    getDynamicGravityCenter() {
        const allParticles = [...this.earthParticles, ...this.atmosphereParticles];
        if (allParticles.length === 0) return new THREE.Vector3(0, 0, 0);
        let center = new THREE.Vector3(0, 0, 0);
        for (let p of allParticles) {
            center.add(p.position.clone().multiplyScalar(p.mass));
        }
        center.divideScalar(allParticles.length); // среднее арифметическое
        return center;
    }

    updateParticleSystems() {
        // Обновление системы частиц Земли
        if (this.earthParticleSystem) {
            const earthPositions = this.earthParticleSystem.geometry.attributes.position.array;
            const earthColors = this.earthParticleSystem.geometry.attributes.color.array;
            
            for (let i = 0; i < this.earthParticles.length; i++) {
                const particle = this.earthParticles[i];
                const i3 = i * 3;
                
                earthPositions[i3] = particle.position.x;
                earthPositions[i3 + 1] = particle.position.y;
                earthPositions[i3 + 2] = particle.position.z;
                
                earthColors[i3] = particle.color.r;
                earthColors[i3 + 1] = particle.color.g;
                earthColors[i3 + 2] = particle.color.b;
            }
            
            this.earthParticleSystem.geometry.attributes.position.needsUpdate = true;
            this.earthParticleSystem.geometry.attributes.color.needsUpdate = true;
        }
        
        // Обновление системы частиц атмосферы
        if (this.atmosphereParticleSystem) {
            const atmospherePositions = this.atmosphereParticleSystem.geometry.attributes.position.array;
            const atmosphereColors = this.atmosphereParticleSystem.geometry.attributes.color.array;
            const atmosphereOpacities = this.atmosphereParticleSystem.geometry.attributes.opacity.array;
            
            for (let i = 0; i < this.atmosphereParticles.length; i++) {
                const particle = this.atmosphereParticles[i];
                const i3 = i * 3;
                
                atmospherePositions[i3] = particle.position.x;
                atmospherePositions[i3 + 1] = particle.position.y;
                atmospherePositions[i3 + 2] = particle.position.z;
                
                atmosphereColors[i3] = particle.color.r;
                atmosphereColors[i3 + 1] = particle.color.g;
                atmosphereColors[i3 + 2] = particle.color.b;
                
                atmosphereOpacities[i] = particle.opacity;
            }
            
            this.atmosphereParticleSystem.geometry.attributes.position.needsUpdate = true;
            this.atmosphereParticleSystem.geometry.attributes.color.needsUpdate = true;
            this.atmosphereParticleSystem.geometry.attributes.opacity.needsUpdate = true;
        }
    }
    
    triggerImpact(impact, blastRadius = 3.0) {
        const impactEnergy = impact.energy;
        const blastRadiusMultiplier = impact.isSecondary ? 0.5 : 1.0;
        const energyMultiplier = impact.isSecondary ? 0.3 : 1.0;
        
        this.destroyParticlesInBlast(
            impact.point, 
            blastRadius * blastRadiusMultiplier, 
            impactEnergy * energyMultiplier, 
            this.earthParticles
        );
        
        this.destroyParticlesInBlast(
            impact.point, 
            blastRadius * 1.5 * blastRadiusMultiplier, 
            impactEnergy * 0.3 * energyMultiplier, 
            this.atmosphereParticles
        );
        
        // Добавьте создание новых атмосферных частиц
        const debrisCount = Math.min(500, Math.floor(impact.energy * 0.05));
        const newParticles = this.spawnAtmosphericDebris(
            impact.point, 
            impactEnergy * energyMultiplier, 
            debrisCount
        );
        // Добавляем новые частицы в массив и геометрию
        this.atmosphereParticles.push(...newParticles);
        this.updateParticleSystemGeometry();
    }

    updateParticleSystemGeometry() {
        // Пересоздаем геометрию с новым количеством частиц
        const oldGeometry = this.atmosphereParticleSystem.geometry;
        
        const atmosphereGeometry = new THREE.BufferGeometry();
        const atmospherePositions = new Float32Array(this.atmosphereParticles.length * 3);
        const atmosphereColors = new Float32Array(this.atmosphereParticles.length * 3);
        const atmosphereOpacities = new Float32Array(this.atmosphereParticles.length);
        
        for (let i = 0; i < this.atmosphereParticles.length; i++) {
            const particle = this.atmosphereParticles[i];
            const i3 = i * 3;
            
            atmospherePositions[i3] = particle.position.x;
            atmospherePositions[i3 + 1] = particle.position.y;
            atmospherePositions[i3 + 2] = particle.position.z;
            
            atmosphereColors[i3] = particle.color.r;
            atmosphereColors[i3 + 1] = particle.color.g;
            atmosphereColors[i3 + 2] = particle.color.b;
            
            atmosphereOpacities[i] = particle.opacity;
        }
        
        atmosphereGeometry.setAttribute('position', new THREE.BufferAttribute(atmospherePositions, 3));
        atmosphereGeometry.setAttribute('color', new THREE.BufferAttribute(atmosphereColors, 3));
        atmosphereGeometry.setAttribute('opacity', new THREE.BufferAttribute(atmosphereOpacities, 1));
        
        this.atmosphereParticleSystem.geometry = atmosphereGeometry;
        oldGeometry.dispose();
    }
    
    destroyParticlesInBlast(impactPoint, blastRadius, energy, particles) {
        const maxTemperature = 4000 + energy * 3;

        for (let particle of particles) {
            const distanceToImpact = particle.position.distanceTo(impactPoint);
            
            if (distanceToImpact <= blastRadius) {
                const blastIntensity = Math.max(0, (blastRadius - distanceToImpact) / blastRadius);
                const temperature = maxTemperature * blastIntensity;
                
                // НОВОЕ: Улучшенный расчёт направления
                // 1. Вектор от точки удара к частице
                let blastDirection = particle.position.clone().sub(impactPoint);
                
                // 2. Проецируем на касательную плоскость (убираем радиальную компоненту)
                const particleRadius = particle.position.length();
                const normalToSurface = particle.position.clone().normalize();
                const radialComponent = blastDirection.dot(normalToSurface.multiplyScalar(particleRadius));
                
                // 3. Тангенциальная компонента (вдоль поверхности)
                const tangentialDirection = blastDirection.clone().sub(
                    normalToSurface.clone().multiplyScalar(radialComponent)
                );
                
                // 4. Добавляем небольшую радиальную компоненту (отрыв от поверхности)
                const finalDirection = tangentialDirection.normalize()
                    .multiplyScalar(0.8) // 80% тангенциально
                    .add(normalToSurface.multiplyScalar(0.2)); // 20% радиально (вверх)
                
                if (finalDirection.length() === 0) {
                    // Если направление нулевое (частица в точке удара)
                    finalDirection.set(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize();
                }
                
                finalDirection.normalize();
                
                // 5. Рассчитываем силу с учётом расстояния
                const forceMultiplier = 0.5 + Math.random() * 1.0;
                const distanceFalloff = Math.pow(blastIntensity, 0.7); // Более плавное затухание
                const baseForce = particle.isAtmosphere ? 0.0015 : 0.0008; // Увеличена базовая сила
                
                const blastForce = finalDirection.multiplyScalar(
                    distanceFalloff * energy * baseForce * forceMultiplier
                );
                
                particle.destroy(blastForce, temperature);
                
                // Добавляем вихревое движение для атмосферных частиц
                if (particle.isAtmosphere && distanceToImpact < blastRadius * 0.7) {
                    particle.vortexStrength = blastIntensity * 0.03;
                    particle.vortexAge = 0;
                }
                
                // Дополнительная орбитальная скорость для частиц на средних расстояниях
                const distanceFromCenter = particle.position.length();
                if (distanceFromCenter > 5 && distanceToImpact > blastRadius * 0.3 && Math.random() < 0.4) {
                    const toCenter = particle.position.clone().normalize();
                    const tangential = new THREE.Vector3();
                    
                    if (Math.abs(toCenter.y) < 0.9) {
                        tangential.set(1, 1, 1);
                    } else {
                        tangential.set(1, 1, 1);
                    }
                    
                    tangential.cross(toCenter).normalize();
                    
                    if (Math.random() < 0.5) {
                        tangential.multiplyScalar(-1);
                    }
                    
                    const orbitalSpeed = blastIntensity * 0.02 * (0.7 + Math.random() * 0.6);
                    particle.velocity.add(tangential.multiplyScalar(orbitalSpeed));
                }
            }
        }
    }


    spawnAtmosphericDebris(impactPoint, energy, count = 100) {
        const newParticles = [];
        const spawnRadius = 2.0; // Уменьшен радиус для более локального эффекта
        
        // Нормализуем точку удара для правильного позиционирования
        const normalizedImpact = impactPoint.clone().normalize().multiplyScalar(5.5);
        
        // Используем переданный параметр count
        const particleCount = Math.min(100, 100); // Ограничиваем максимум
        for (let i = 0; i < particleCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const r = spawnRadius * Math.pow(Math.random(), 0.3); // Более концентрированное распределение
            
            const offset = new THREE.Vector3(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );
            
            const position = normalizedImpact.clone().add(offset);
            
            // Более яркие и заметные цвета
            let color;
            if (energy > 5000) {
                color = new THREE.Color(1.0, 0.6, 0.2); // Ярче оранжевый
            } else if (energy > 2000) {
                color = new THREE.Color(1.0, 0.8, 0.3); // Ярче желтый
            } else {
                color = new THREE.Color(0.1, 0.1, 0.1); // Светлее серый
            }
            
            const particle = new EarthParticle(position, color, true);
        
            // Увеличена начальная скорость для лучшей видимости
            const direction = offset.clone().normalize();
            const speed = 12 + Math.random() * 0.1;
            particle.velocity = direction.multiplyScalar(speed);
            
            // Увеличена вихревая сила
            particle.vortexStrength = 100 + Math.random() * 0.04;
            particle.temperature = 500 + energy * 0.8; // Выше температура
            particle.opacity = 0.7 + Math.random() * 0.3; // Выше непрозрачность
            particle.originalOpacity = particle.opacity;
            
            newParticles.push(particle);
        }
        
        return newParticles;
    }
    
    updateParticleLights() {
        // Удаляем старые источники света
        this.particleLights.forEach(light => {
            this.scene.remove(light);
        });
        this.particleLights = [];
        
        // Находим самые горячие частицы
        const hotParticles = [];
        const allParticles = [...this.earthParticles, ...this.atmosphereParticles];
        
        for (let particle of allParticles) {
            if (particle.temperature > 800) {
                hotParticles.push({
                    particle: particle,
                    temperature: particle.temperature
                });
            }
        }
        
        hotParticles.sort((a, b) => b.temperature - a.temperature);
        
        const lightsToCreate = Math.min(hotParticles.length, this.maxParticleLights);
        
        for (let i = 0; i < lightsToCreate; i++) {
            const hotParticle = hotParticles[i];
            const temp = hotParticle.temperature;
            
            let lightColor;
            if (temp > 3000) {
                lightColor = new THREE.Color(1.0, 1.0, 0.9);
            } else if (temp > 2000) {
                lightColor = new THREE.Color(1.0, 0.9, 0.7);
            } else if (temp > 1200) {
                lightColor = new THREE.Color(1.0, 0.6, 0.3);
            } else {
                lightColor = new THREE.Color(1.0, 0.3, 0.1);
            }
            
            const intensity = Math.min(2.0, (temp - 800) / 1000);
            const range = Math.min(15, 5 + (temp - 800) / 200);
            
            const particleLight = new THREE.PointLight(lightColor, intensity, range);
            particleLight.position.copy(hotParticle.particle.position);
            
            this.scene.add(particleLight);
            this.particleLights.push(particleLight);
        }
    }
    
    resetSimulation() {
        // Восстановление всех частиц Земли
        for (let particle of this.earthParticles) {
            particle.position.copy(particle.originalPosition);
            particle.velocity.set(0, 0, 0);
            particle.temperature = 20;
            particle.isDestroyed = false;
            particle.isFlying = false;
            particle.isOrbiting = false;
            particle.color.copy(particle.originalColor);
        }
        
        // Восстановление всех частиц атмосферы
        for (let particle of this.atmosphereParticles) {
            particle.position.copy(particle.originalPosition);
            particle.velocity.set(0, 0, 0);
            particle.temperature = 20;
            particle.isDestroyed = false;
            particle.isFlying = false;
            particle.isOrbiting = false;
            particle.color.copy(particle.originalColor);
            particle.opacity = particle.originalOpacity;
        }
        
        this.updateParticleSystems();
    }
    
    getStatistics() {
        let destroyed = 0;
        let flying = 0;
        let orbiting = 0;
        let maxTemp = 20;
        
        const allParticles = [...this.earthParticles, ...this.atmosphereParticles];
        for (let particle of allParticles) {
            if (particle.isDestroyed) destroyed++;
            if (particle.isFlying) flying++;
            if (particle.isOrbiting) orbiting++;
            maxTemp = Math.max(maxTemp, particle.temperature);
        }
        
        return {
            earthParticles: this.earthParticles.length,
            atmosphereParticles: this.atmosphereParticles.length,
            destroyed,
            flying,
            orbiting,
            maxTemp: Math.round(maxTemp),
            countOfObjects: this.earthParticles.length + this.atmosphereParticles.length
        };
        
    }
}