export class DataLoader {
    constructor() {
        this.planetData = null;
        this.asteroidData = [];
        this.textureCache = new Map();
    }
    
    async loadPlanetData() {
        try {
            const response = await fetch('./data/planets_and_moons.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.planetData = await response.json();
            console.log('Загружены данные планет:', this.planetData.solar_system.planets.length);
            return this.planetData;
        } catch (error) {
            console.error('Ошибка загрузки данных планет:', error);
            console.log('Используем резервные данные');
            this.planetData = this.createFallbackPlanetData();
            return this.planetData;
        }
    }
    
    async loadAsteroidData() {
        try {
            const response = await fetch('./data/results.csv');
            if (!response.ok) {
                throw new Error('CSV не найден');
            }
            const csvText = await response.text();
            this.asteroidData = this.parseCSV(csvText);
            console.log('Загружены данные астероидов:', this.asteroidData.length);
            return this.asteroidData;
        } catch (error) {
            console.warn('Файл астероидов не найден, используем заглушку:', error);
            return this.asteroidData;
        }
    }
    
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const asteroids = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',');
                if (values.length >= headers.length) {
                    const asteroid = {};
                    headers.forEach((header, index) => {
                        asteroid[header] = values[index]?.replace(/"/g, '').trim();
                    });
                    
                    if (asteroid.a && asteroid.e) {
                        asteroid.semi_major_axis = parseFloat(asteroid.a);
                        asteroid.eccentricity = parseFloat(asteroid.e);
                        asteroid.inclination = parseFloat(asteroid.i) || 0;
                        asteroid.diameter_km = parseFloat(asteroid.diameter) || 0.1;
                    }
                    asteroids.push(asteroid);
                }
            }
        }
        return asteroids;
    }
    
    
    createFallbackPlanetData() {
        return {
            solar_system: {
                planets: [
                    {
                        name: "Mercury",
                        radius: 2439.7,
                        semi_major_axis: 0.387098,
                        eccentricity: 0.205630,
                        orbital_period: 87.969,
                        mean_anomaly: 174.796,
                        texture: './data/mercury.jpg'
                    },
                    {
                        name: "Venus", 
                        radius: 6051.8,
                        semi_major_axis: 0.723332,
                        eccentricity: 0.006772,
                        orbital_period: 224.701,
                        mean_anomaly: 50.115,
                        texture: './data/venus.jpg'
                    },
                    {
                        name: "Earth",
                        radius: 6371.0,
                        semi_major_axis: 1.000001,
                        eccentricity: 0.016709,
                        orbital_period: 365.256,
                        mean_anomaly: 357.529,
                        texture: './data/earth_daymap.jpg',
                        moons: [
                            {
                                name: "Moon",
                                radius: 1737.4,
                                semi_major_axis: 384400,
                                orbital_period: 27.322,
                                texture: './data/moon.jpg'
                            }
                        ]
                    },
                    {
                        name: "Mars",
                        radius: 3389.5,
                        semi_major_axis: 1.523679,
                        eccentricity: 0.093401,
                        orbital_period: 686.980,
                        mean_anomaly: 19.373,
                        texture: './data/mars.jpg'
                    }
                ]
            }
        };
    }
    
    async loadTexture(url) {
        if (this.textureCache.has(url)) {
            return this.textureCache.get(url);
        }
        
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                this.textureCache.set(url, image);
                resolve(image);
            };
            image.onerror = () => {
                console.warn(`Не удалось загрузить текстуру: ${url}`);
                resolve(null);
            };
            image.src = url;
        });
    }
    
    async loadAllTextures() {
        if (!this.planetData) {
            await this.loadPlanetData();
        }
        
        const textureUrls = [];
        
        // Собираем все URL текстур планет
        this.planetData.solar_system.planets.forEach(planet => {
            if (planet.texture) {
                textureUrls.push(planet.texture);
            }
            if (planet.bump) {
                textureUrls.push(planet.bump);
            }
            if (planet.moons) {
                planet.moons.forEach(moon => {
                    if (moon.texture) {
                        textureUrls.push(moon.texture);
                    }
                });
            }
        });
        
        // Дополнительные текстуры
        textureUrls.push(
            './data/sun.jpg',
            './data/milky_way.jpg',
            './data/earth_nightmap.jpg',
            './data/earth_atmosphere.jpg'
        );
        
        const loadPromises = textureUrls.map(url => this.loadTexture(url));
        await Promise.all(loadPromises);
        
        console.log(`Загружено текстур: ${this.textureCache.size}`);
    }
    
    getTextureFromCache(url) {
        return this.textureCache.get(url) || null;
    }
    
    async loadAll() {
        const loadingTasks = [
            this.loadPlanetData(),
            this.loadAsteroidData(),
            this.loadAllTextures()
        ];
        
        await Promise.all(loadingTasks);
        
        return {
            planets: this.planetData,
            asteroids: this.asteroidData,
            textureCache: this.textureCache
        };
    }
    
    // Валидация данных
    validatePlanetData(data) {
        if (!data || !data.solar_system || !data.solar_system.planets) {
            return false;
        }
        
        return data.solar_system.planets.every(planet => 
            planet.name && 
            typeof planet.radius === 'number' && 
            typeof planet.semi_major_axis === 'number'
        );
    }
    
    validateAsteroidData(data) {
        if (!Array.isArray(data)) {
            return false;
        }
        
        return data.length > 0 && data.every(asteroid => 
            asteroid.name || (asteroid.semi_major_axis && asteroid.eccentricity !== undefined)
        );
    }
    
    // Очистка кэша
    clearCache() {
        this.textureCache.clear();
    }
    
    // Статистика загруженных данных
    getDataInfo() {
        return {
            planetsCount: this.planetData ? this.planetData.solar_system.planets.length : 0,
            asteroidsCount: this.asteroidData.length,
            texturesCount: this.textureCache.size,
            cacheSize: this.calculateCacheSize()
        };
    }
    
    calculateCacheSize() {
        // Приблизительная оценка размера кэша
        let totalSize = 0;
        this.textureCache.forEach((image, url) => {
            if (image && image.width && image.height) {
                totalSize += image.width * image.height * 4; // RGBA
            }
        });
        return totalSize;
    }
}