import * as THREE from "https://unpkg.com/three@0.180.0/build/three.module.js?module";

export class PlanetSurfaceScene {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.scene = sceneManager.getScene();
        this.camera = sceneManager.getCamera();
        this.renderer = sceneManager.getRenderer();
        
        // Leaflet карта
        this.map = null;
        this.mapElement = null;
        
        // Three.js облачная система
        this.cloudCanvas = null;
        this.cloudScene = null;
        this.cloudCamera = null;
        this.cloudRenderer = null;
        this.cloudMaterial = null;
        
        // Частицы и параметры
        this.particles = [];
        this.velocities = [];
        this.vorticities = [];
        this.impulses = [];
        this.explosions = [];
        
        this.N = 10;
        this.PARTICLE_COUNT = this.N * this.N;
        this.STRENGTH = 40;
        this.DAMPING = 0.99;
        this.REPULSION_RADIUS = 900;
        this.REPULSION_STRENGTH = 100000;
        
        // Настройки
        this.cloudRadius = 80;
        this.cloudDensity = 0.8;
        this.showParticles = true;
        this.animateClouds = true;
        this.explosionRadius = 150;
        this.explosionDuration = 2.0;
        this.explosionStrength = 800;
        this.explosionGlow = true;
        
        // Текстуры данных
        this.particleDataTexture = null;
        this.explosionDataTexture = null;
        
        // Состояние
        this.lastTime = Date.now();
        this.frameCount = 0;
        this.mapBounds = null;
        this.mapZoom = 2;
        this.isInitialized = false;
    }
    
    async create() {
        this.clearScene();
        
        // Создаем контейнер для карты
        this.createMapContainer();
        
        // Сначала показываем элементы, чтобы Leaflet мог правильно вычислить размеры
        this.show();
        
        // Даем браузеру время отрендерить элементы
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Инициализируем Leaflet карту
        this.initMap();
        
        // Инициализируем Three.js для облаков
        this.initThreeJS();
        
        // Инициализируем частицы
        this.initParticles();
        
        // Настраиваем события
        this.setupEventListeners();
        
        this.isInitialized = true;
        console.log('Сцена поверхности планеты создана');
    }
    
    createMapContainer() {
        // Создаем элемент для карты
        this.mapElement = document.createElement('div');
        this.mapElement.id = 'planet-surface-map';
        this.mapElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 5;
            display: none;
        `;
        document.body.appendChild(this.mapElement);
        
        // Создаем canvas для облаков
        this.cloudCanvas = document.createElement('canvas');
        this.cloudCanvas.id = 'planet-surface-clouds';
        this.cloudCanvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            pointer-events: none;
            z-index: 6;
            display: none;
        `;
        document.body.appendChild(this.cloudCanvas);
    }
    
    initMap() {
        this.map = L.map(this.mapElement.id, {
            center: [51.505, -0.09],
            zoom: this.mapZoom,
            minZoom: 2.5,
            maxZoom: 10,
            maxBounds: [[-90, -180], [90, 180]],
            maxBoundsViscosity: 1.0,
            preferCanvas: true // Улучшает производительность
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '',
            crossOrigin: 'anonymous',
            noWrap: true,
            updateWhenIdle: false, // Загружает тайлы во время движения
            keepBuffer: 2 // Держит больше тайлов в буфере
        }).addTo(this.map);

        this.map.on('move', () => this.updateMapBounds());
        this.map.on('zoom', () => this.updateMapBounds());
        this.map.on('click', (e) => this.onMapClick(e));
        
        this.updateMapBounds();
        
        // Принудительно обновляем размер карты после инициализации
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize(true);
            }
        }, 200);
    }
    
    onMapClick(e) {
        const containerPoint = this.map.latLngToContainerPoint(e.latlng);
        this.addExplosion(containerPoint.x, containerPoint.y);
        this.addImpulse(containerPoint.x, containerPoint.y);
    }
    
    initThreeJS() {
        this.cloudCanvas.width = window.innerWidth;
        this.cloudCanvas.height = window.innerHeight;

        this.cloudScene = new THREE.Scene();
        this.cloudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        this.cloudRenderer = new THREE.WebGLRenderer({ 
            canvas: this.cloudCanvas, 
            alpha: true,
            premultipliedAlpha: false,
            antialias: true 
        });
        this.cloudRenderer.setSize(window.innerWidth, window.innerHeight);

        // Создаем текстуры данных
        const textureSize = 32;
        this.particleDataTexture = new THREE.DataTexture(
            new Float32Array(textureSize * textureSize * 4),
            textureSize,
            textureSize,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.particleDataTexture.minFilter = THREE.NearestFilter;
        this.particleDataTexture.magFilter = THREE.NearestFilter;

        const explosionTextureSize = 8;
        this.explosionDataTexture = new THREE.DataTexture(
            new Float32Array(explosionTextureSize * explosionTextureSize * 4),
            explosionTextureSize,
            explosionTextureSize,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.explosionDataTexture.minFilter = THREE.NearestFilter;
        this.explosionDataTexture.magFilter = THREE.NearestFilter;

        this.createCloudShader();
    }
    
    createCloudShader() {
        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.x, position.y, 0.0, 1.0);
            }
        `;

        const fragmentShader = `
            uniform sampler2D u_particles;
            uniform sampler2D u_explosions;
            uniform vec2 u_resolution;
            uniform float u_cloudRadius;
            uniform float u_cloudDensity;
            uniform float u_time;
            uniform int u_particleCount;
            uniform int u_explosionCount;
            uniform bool u_showParticles;
            uniform bool u_animateClouds;
            uniform bool u_explosionGlow;
            
            varying vec2 vUv;
            
            const float cloudscale = 1.1;
            const float speed = 0.03;
            const float clouddark = 0.5;
            const float cloudlight = 0.3;
            const float cloudcover = 0.2;
            const float cloudalpha = 8.0;
            const float skytint = 0.5;
            const vec3 skycolour1 = vec3(1.0, 1.0, 1.0);
            const vec3 skycolour2 = vec3(0.85, 0.9, 1.0);
            const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
            
            vec2 hash(vec2 p) {
                p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
            }
            
            float noise(in vec2 p) {
                const float K1 = 0.366025404;
                const float K2 = 0.211324865;
                vec2 i = floor(p + (p.x + p.y) * K1);
                vec2 a = p - i + (i.x + i.y) * K2;
                vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec2 b = a - o + K2;
                vec2 c = a - 1.0 + 2.0 * K2;
                vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
                vec3 n = h * h * h * h * vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
                return dot(n, vec3(70.0));
            }
            
            float fbm(vec2 n) {
                float total = 0.0, amplitude = 0.1;
                for (int i = 0; i < 7; i++) {
                    total += noise(n) * amplitude;
                    n = m * n;
                    amplitude *= 0.4;
                }
                return total;
            }
            
            void main() {
                vec2 pixelPos = vUv * u_resolution;
                vec2 p = vUv;
                vec2 uv = p * vec2(u_resolution.x / u_resolution.y, 1.0);
                
                float baseDensity = 0.0;
                vec3 colorAccum = vec3(0.0);
                bool hasParticleNearby = false;
                
                for(int i = 0; i < 900; i++) {
                    if(i >= u_particleCount) break;
                    
                    int x = i - (i / 32) * 32;
                    int y = i / 32;
                    vec2 texCoord = (vec2(float(x), float(y)) + 0.5) / 32.0;
                    vec4 particleData = texture2D(u_particles, texCoord);
                    vec2 particlePos = particleData.xy;
                    float vorticity = particleData.z;
                    
                    float dist = distance(pixelPos, particlePos);
                    
                    if(dist < u_cloudRadius * 2.5) {
                        hasParticleNearby = true;
                        float influence = 1.0 - smoothstep(0.0, u_cloudRadius * 2.5, dist);
                        influence = pow(influence, 1.5);
                        baseDensity += influence;
                        
                        vec3 particleColor;
                        if(vorticity > 0.0) {
                            particleColor = vec3(1.1, 0.95, 1.0);
                        } else if(vorticity < 0.0) {
                            particleColor = vec3(0.95, 1.0, 1.1);
                        } else {
                            particleColor = vec3(1.05, 1.05, 1.0);
                        }
                        colorAccum += particleColor * influence;
                    }
                    
                    if(u_showParticles && dist < 4.0) {
                        float particleAlpha = pow(1.0 - (dist / 4.0), 2.0);
                        vec3 particleColor;
                        
                        if(vorticity > 0.0) {
                            particleColor = vec3(1.0, 0.4, 0.4);
                        } else if(vorticity < 0.0) {
                            particleColor = vec3(0.4, 0.6, 1.0);
                        } else {
                            particleColor = vec3(0.9, 0.9, 1.0);
                        }
                        
                        colorAccum = mix(colorAccum, particleColor * baseDensity, particleAlpha * 0.5);
                        baseDensity = max(baseDensity, particleAlpha * 0.5);
                    }
                }
                
                vec3 explosionColor = vec3(0.0);
                float explosionBrightness = 0.0;
                
                for(int i = 0; i < 64; i++) {
                    if(i >= u_explosionCount) break;
                    
                    int x = i - (i / 8) * 8;
                    int y = i / 8;
                    vec4 explosionData = texture2D(u_explosions, vec2(float(x) / 8.0, float(y) / 8.0));
                    vec2 explosionPos = explosionData.xy;
                    float progress = explosionData.z;
                    float radius = explosionData.w;
                    
                    if(progress > 0.0 && progress < 1.0) {
                        float dist = distance(pixelPos, explosionPos);
                        float normalizedDist = dist / radius;
                        
                        float wave = abs(normalizedDist - progress);
                        float waveIntensity = smoothstep(0.15, 0.0, wave) * (1.0 - progress);
                        
                        float core = smoothstep(0.5, 0.0, normalizedDist) * smoothstep(0.0, 0.3, progress) * smoothstep(1.0, 0.5, progress);
                        
                        float glow = 0.0;
                        if(u_explosionGlow) {
                            glow = smoothstep(1.5, 0.0, normalizedDist) * (1.0 - progress * 0.7);
                        }
                        
                        float totalIntensity = waveIntensity + core + glow * 0.5;
                        
                        vec3 earlyColor = vec3(1.0, 0.9, 0.7);
                        vec3 midColor = vec3(1.0, 0.5, 0.2);
                        vec3 lateColor = vec3(0.8, 0.3, 0.1);
                        
                        vec3 currentColor;
                        if(progress < 0.3) {
                            currentColor = mix(earlyColor, midColor, progress / 0.3);
                        } else {
                            currentColor = mix(midColor, lateColor, (progress - 0.3) / 0.7);
                        }
                        
                        explosionColor += currentColor * totalIntensity;
                        explosionBrightness += totalIntensity;
                    }
                }
                
                if(!hasParticleNearby || baseDensity < 0.01) {
                    if(explosionBrightness > 0.0) {
                        gl_FragColor = vec4(explosionColor, min(explosionBrightness, 1.0));
                    } else {
                        gl_FragColor = vec4(0.0);
                    }
                    return;
                }
                
                float time = u_animateClouds ? u_time * speed : 0.0;
                float q = fbm(uv * cloudscale * 0.5);
                
                float r = 0.0;
                vec2 uv_ridged = uv * cloudscale;
                uv_ridged -= q - time;
                float weight = 0.8;
                for (int i = 0; i < 8; i++) {
                    r += abs(weight * noise(uv_ridged));
                    uv_ridged = m * uv_ridged + time;
                    weight *= 0.7;
                }
                
                float f = 0.0;
                vec2 uv_smooth = uv * cloudscale;
                uv_smooth -= q - time;
                weight = 0.7;
                for (int i = 0; i < 8; i++) {
                    f += weight * noise(uv_smooth);
                    uv_smooth = m * uv_smooth + time;
                    weight *= 0.6;
                }
                
                f *= r + f;
                
                float c = 0.0;
                vec2 uv_color = uv * cloudscale * 2.0;
                uv_color -= q - time * 2.0;
                weight = 0.4;
                for (int i = 0; i < 7; i++) {
                    c += weight * noise(uv_color);
                    uv_color = m * uv_color + time * 2.0;
                    weight *= 0.6;
                }
                
                float c1 = 0.0;
                vec2 uv_ridge = uv * cloudscale * 3.0;
                uv_ridge -= q - time * 3.0;
                weight = 0.4;
                for (int i = 0; i < 7; i++) {
                    c1 += abs(weight * noise(uv_ridge));
                    uv_ridge = m * uv_ridge + time * 3.0;
                    weight *= 0.6;
                }
                
                c += c1;
                
                vec3 particleColor = colorAccum / max(baseDensity, 0.1);
                vec3 skycolour = mix(skycolour2, skycolour1, p.y);
                vec3 cloudcolour = particleColor * clamp((clouddark + cloudlight * c), 0.0, 1.0);
                
                cloudcolour = mix(cloudcolour, explosionColor, min(explosionBrightness * 0.5, 0.8));
                
                float densityMod = baseDensity * u_cloudDensity;
                f = (cloudcover + cloudalpha * f * r) * densityMod;
                
                vec3 result = mix(skycolour, clamp(skytint * skycolour + cloudcolour, 0.0, 1.0), clamp(f + c * densityMod, 0.0, 1.0));
                result = mix(result, explosionColor, min(explosionBrightness, 1.0));
                
                float finalAlpha = clamp(f + c * densityMod + explosionBrightness, 0.0, 1.0) * 0.85;
                gl_FragColor = vec4(result + explosionColor, finalAlpha);
            }
        `;

        this.cloudMaterial = new THREE.ShaderMaterial({
            uniforms: {
                u_particles: { value: this.particleDataTexture },
                u_explosions: { value: this.explosionDataTexture },
                u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                u_cloudRadius: { value: this.cloudRadius },
                u_cloudDensity: { value: this.cloudDensity },
                u_time: { value: 0 },
                u_particleCount: { value: this.PARTICLE_COUNT },
                u_explosionCount: { value: 0 },
                u_showParticles: { value: this.showParticles },
                u_animateClouds: { value: this.animateClouds },
                u_explosionGlow: { value: this.explosionGlow }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, this.cloudMaterial);
        this.cloudScene.add(mesh);
    }
    
    updateMapBounds() {
        this.mapBounds = this.map.getBounds();
        this.mapZoom = this.map.getZoom();
    }
    
    initParticles() {
        this.particles = [];
        this.velocities = [];
        this.vorticities = [];

        const bounds = this.mapBounds;
        const latRange = bounds.getNorth() - bounds.getSouth();
        const lngRange = bounds.getEast() - bounds.getWest();

        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const lat = bounds.getSouth() + Math.random() * latRange;
            const lng = bounds.getWest() + Math.random() * lngRange;
            const pos = this.map.latLngToContainerPoint([lat, lng]);

            this.particles.push({
                lat: lat,
                lng: lng,
                x: pos.x,
                y: pos.y
            });

            this.velocities.push({
                lat: (Math.random() - 0.5) * 0.5,
                lng: (Math.random() - 0.5) * 0.5
            });

            if (Math.random() > 0.7) {
                this.vorticities.push((Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 1.5));
            } else {
                this.vorticities.push(0);
            }
        }
    }
    
    setupEventListeners() {
        // Обработчики карты уже установлены в initMap
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    onWindowResize() {
        if (!this.isInitialized) return;
        
        this.cloudCanvas.width = window.innerWidth;
        this.cloudCanvas.height = window.innerHeight;
        
        if (this.map) {
            this.map.invalidateSize(true);
        }
        
        if (this.cloudRenderer) {
            this.cloudRenderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
        }
    }
    
    handleSurfaceClick(intersection) {
        if (!this.map) return;
        
        const containerPoint = this.map.latLngToContainerPoint(
            this.map.getCenter()
        );
        
        this.addExplosion(containerPoint.x, containerPoint.y);
        this.addImpulse(containerPoint.x, containerPoint.y);
    }
    
    addImpulse(x, y) {
        const latlng = this.map.containerPointToLatLng([x, y]);
        this.impulses.push({
            lat: latlng.lat,
            lng: latlng.lng,
            x: x,
            y: y,
            strength: this.REPULSION_STRENGTH,
            life: 1.0
        });
    }
    
    addExplosion(x, y) {
        this.explosions.push({
            x: x,
            y: y,
            progress: 0.0,
            startTime: Date.now()
        });
    }
    
    update(deltaTime) {
        if (!this.isInitialized) return;
        
        const now = Date.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;

        this.updateParticles(dt);
        this.updateTextures();
        
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.u_time.value = this.frameCount * 0.016;
        }
        
        if (this.cloudRenderer && this.cloudScene && this.cloudCamera) {
            this.cloudRenderer.render(this.cloudScene, this.cloudCamera);
        }
        
        this.frameCount++;
    }
    
    updateParticles(dt) {
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            let fLat = 0, fLng = 0;

            fLng += 0.1;

            for (let imp of this.impulses) {
                let dLat = this.particles[i].lat - imp.lat;
                let dLng = this.particles[i].lng - imp.lng;

                if (dLng > 180) dLng -= 360;
                if (dLng < -180) dLng += 360;

                const dist = Math.sqrt(dLat * dLat + dLng * dLng);
                const pos = this.map.latLngToContainerPoint([this.particles[i].lat, this.particles[i].lng]);
                const screenDist = Math.sqrt(
                    Math.pow(pos.x - imp.x, 2) + 
                    Math.pow(pos.y - imp.y, 2)
                );

                if (screenDist < this.REPULSION_RADIUS && dist > 1e-5) {
                    const force = imp.strength * imp.life * (1 - screenDist / this.REPULSION_RADIUS) / 10000;
                    fLat += (dLat / dist) * force;
                    fLng += (dLng / dist) * force;
                }
            }

            for (let exp of this.explosions) {
                const dx = this.particles[i].x - exp.x;
                const dy = this.particles[i].y - exp.y;
                const screenDist = Math.sqrt(dx * dx + dy * dy);
                
                if (screenDist < this.explosionRadius && exp.progress < 1.0) {
                    const wavePos = exp.progress * this.explosionRadius;
                    const distFromWave = Math.abs(screenDist - wavePos);
                    
                    if (distFromWave < this.explosionRadius * 0.3) {
                        const waveStrength = 1.0 - distFromWave / (this.explosionRadius * 0.3);
                        const explosionForce = this.explosionStrength * waveStrength * (1.0 - exp.progress);
                        
                        const dirX = dx / screenDist;
                        const dirY = dy / screenDist;
                        
                        const targetX = this.particles[i].x + dirX * explosionForce * 0.1;
                        const targetY = this.particles[i].y + dirY * explosionForce * 0.1;
                        
                        const currentLatLng = this.map.containerPointToLatLng([this.particles[i].x, this.particles[i].y]);
                        const targetLatLng = this.map.containerPointToLatLng([targetX, targetY]);
                        
                        fLat += (targetLatLng.lat - currentLatLng.lat) * 10;
                        fLng += (targetLatLng.lng - currentLatLng.lng) * 10;
                    }
                }
            }

            this.velocities[i].lat = this.velocities[i].lat * this.DAMPING + fLat * this.STRENGTH * dt;
            this.velocities[i].lng = this.velocities[i].lng * this.DAMPING + fLng * this.STRENGTH * dt;

            this.particles[i].lat += this.velocities[i].lat * dt;
            this.particles[i].lng += this.velocities[i].lng * dt;

            if (this.particles[i].lng > 180) this.particles[i].lng -= 360;
            if (this.particles[i].lng < -180) this.particles[i].lng += 360;
            
            if (this.particles[i].lat > 90) {
                this.particles[i].lat = 90 - (this.particles[i].lat - 90);
                this.velocities[i].lat = -this.velocities[i].lat * 0.8;
            } else if (this.particles[i].lat < -90) {
                this.particles[i].lat = -90 + (-90 - this.particles[i].lat);
                this.velocities[i].lat = -this.velocities[i].lat * 0.8;
            }

            const pos = this.map.latLngToContainerPoint([this.particles[i].lat, this.particles[i].lng]);
            this.particles[i].x = pos.x;
            this.particles[i].y = pos.y;
        }

        this.impulses = this.impulses.filter(imp => {
            imp.life -= dt * 2;
            return imp.life > 0;
        });

        const now = Date.now();
        this.explosions = this.explosions.filter(exp => {
            exp.progress = (now - exp.startTime) / (this.explosionDuration * 1000);
            return exp.progress < 1.0;
        });
    }
    
    updateTextures() {
        const textureSize = 32;
        const particleData = this.particleDataTexture.image.data;
        
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const idx = i * 4;
            particleData[idx] = this.particles[i].x;
            particleData[idx + 1] = this.particles[i].y;
            particleData[idx + 2] = this.vorticities[i];
            particleData[idx + 3] = 1.0;
        }
        this.particleDataTexture.needsUpdate = true;

        const explosionTextureSize = 8;
        const explosionData = this.explosionDataTexture.image.data;
        explosionData.fill(0);
        
        for (let i = 0; i < Math.min(this.explosions.length, explosionTextureSize * explosionTextureSize); i++) {
            const idx = i * 4;
            explosionData[idx] = this.explosions[i].x;
            explosionData[idx + 1] = this.cloudCanvas.height - this.explosions[i].y;
            explosionData[idx + 2] = this.explosions[i].progress;
            explosionData[idx + 3] = this.explosionRadius;
        }
        this.explosionDataTexture.needsUpdate = true;

        this.cloudMaterial.uniforms.u_explosionCount.value = this.explosions.length;
    }
    
    
    // Методы для показа/скрытия сцены
    show() {
        if (this.mapElement) {
            this.mapElement.style.display = 'block';
        }
        if (this.cloudCanvas) {
            this.cloudCanvas.style.display = 'block';
        }
        // Скрываем основной Three.js canvas
        const mainCanvas = document.querySelector('#canvas-container');
        if (mainCanvas) {
            mainCanvas.style.display = 'none';
        }
        
        // КРИТИЧНО: Обновляем размер карты после показа
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        }
    }
    
    hide() {
        if (this.mapElement) {
            this.mapElement.style.display = 'none';
        }
        if (this.cloudCanvas) {
            this.cloudCanvas.style.display = 'none';
        }
        // Показываем основной Three.js canvas
        const mainCanvas = document.querySelector('#canvas-container');
        if (mainCanvas) {
            mainCanvas.style.display = 'block';
        }
    }
    
    getClickableObjects() {
        // На сцене поверхности нет Three.js объектов для клика
        return [];
    }
    
    getStats() {
        return {
            impacts: this.explosions.length,
            particles: this.PARTICLE_COUNT,
            countOfObjects: this.PARTICLE_COUNT + this.explosions.length
        };
    }
    
    clearScene() {
        if (this.mapElement && this.mapElement.parentNode) {
            this.mapElement.parentNode.removeChild(this.mapElement);
        }
        
        if (this.cloudCanvas && this.cloudCanvas.parentNode) {
            this.cloudCanvas.parentNode.removeChild(this.cloudCanvas);
        }
        
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        
        this.particles = [];
        this.velocities = [];
        this.vorticities = [];
        this.impulses = [];
        this.explosions = [];
        this.isInitialized = false;
    }
    
    dispose() {
        this.clearScene();
        
        if (this.cloudMaterial) {
            this.cloudMaterial.dispose();
        }
        
        if (this.particleDataTexture) {
            this.particleDataTexture.dispose();
        }
        
        if (this.explosionDataTexture) {
            this.explosionDataTexture.dispose();
        }
        
        if (this.cloudRenderer) {
            this.cloudRenderer.dispose();
        }
    }
    
    // Методы для настройки параметров
    setCloudRadius(radius) {
        this.cloudRadius = radius;
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.u_cloudRadius.value = radius;
        }
    }
    
    setCloudDensity(density) {
        this.cloudDensity = density;
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.u_cloudDensity.value = density;
        }
    }
    
    setShowParticles(show) {
        this.showParticles = show;
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.u_showParticles.value = show;
        }
    }
    
    setAnimateClouds(animate) {
        this.animateClouds = animate;
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.u_animateClouds.value = animate;
        }
    }
    
    setExplosionRadius(radius) {
        this.explosionRadius = radius;
    }
    
    setExplosionDuration(duration) {
        this.explosionDuration = duration;
    }
    
    setExplosionStrength(strength) {
        this.explosionStrength = strength;
    }
    
    setExplosionGlow(glow) {
        this.explosionGlow = glow;
        if (this.cloudMaterial) {
            this.cloudMaterial.uniforms.u_explosionGlow.value = glow;
        }
    }
    
    // Метод для загрузки данных из изображения (заглушка для совместимости)
    async loadFromImage(imagePath) {
        console.log(`Загрузка данных поверхности из ${imagePath}`);
        // Здесь можно добавить логику загрузки heightmap или других данных
        return Promise.resolve();
    }
    
    // Методы для сброса и восстановления
    resetTerrain() {
        this.explosions = [];
        this.impulses = [];
        this.initParticles();
        console.log('Поверхность планеты сброшена');
    }
    
    createCrater(worldPosition, radius, depth) {
        // Создаем взрыв в указанной позиции
        if (this.map) {
            const latlng = this.map.containerPointToLatLng([worldPosition.x, worldPosition.y]);
            const containerPoint = this.map.latLngToContainerPoint(latlng);
            this.addExplosion(containerPoint.x, containerPoint.y);
            this.addImpulse(containerPoint.x, containerPoint.y);
        }
    }
    
    // Методы для настройки размера и высоты (для совместимости)
    setTerrainSize(size) {
        console.log(`Установка размера территории: ${size}`);
    }
    
    setMaxHeight(height) {
        console.log(`Установка максимальной высоты: ${height}`);
    }
    
    setCloudsEnabled(enabled) {
        this.setAnimateClouds(enabled);
    }
}