export class PlanetsPanel {
    constructor(app) {
        this.app = app;
        this.panel = document.getElementById('planets-panel');
        this.planetsList = document.getElementById('planets-list');
        this.searchInput = document.getElementById('planet-search');
        this.selectedPlanet = null;
        this.planets = [];
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Закрытие панели
        const closeBtn = document.getElementById('close-planets');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // Поиск планет
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.filterPlanets(e.target.value);
            });
        }
        
        // Фокус на выбранной планете
        const focusBtn = document.getElementById('focus-selected-planet');
        if (focusBtn) {
            focusBtn.addEventListener('click', () => this.focusOnSelectedPlanet());
        }
        
        // Очистка выбора
        const clearBtn = document.getElementById('clear-planet-selection');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearSelection());
        }
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.panel.classList.contains('hidden')) {
                this.hide();
            }
        });
    }
    
    show() {
        this.panel.classList.remove('hidden');
        this.loadPlanets();
    }
    
    hide() {
        this.panel.classList.add('hidden');
    }
    
    toggle() {
        if (this.panel.classList.contains('hidden')) {
            this.show();
        } else {
            this.hide();
        }
    }
    
    loadPlanets() {
        const currentScene = this.app.getCurrentScene();
        
        if (currentScene !== 'solar-system') {
            this.showEmptyState('Список планет доступен только в режиме солнечной системы');
            return;
        }
        
        const solarScene = this.app.getSolarSystemScene();
        if (!solarScene || !solarScene.planets) {
            this.showEmptyState('Планеты не загружены');
            return;
        }
        
        // Получаем список планет (без спутников)
        this.planets = solarScene.planets.filter(p => !p.userData.parent);
        
        if (this.planets.length === 0) {
            this.showEmptyState('Планеты не найдены');
            return;
        }
        
        this.renderPlanets(this.planets);
    }
    
    renderPlanets(planets) {
        this.planetsList.innerHTML = '';
        
        // Добавляем счетчик
        const counter = document.createElement('div');
        counter.className = 'planets-count';
        counter.textContent = `Найдено планет: ${planets.length}`;
        this.planetsList.appendChild(counter);
        
        planets.forEach(planet => {
            const planetItem = this.createPlanetItem(planet);
            this.planetsList.appendChild(planetItem);
        });
    }
    
    createPlanetItem(planet) {
        const item = document.createElement('div');
        item.className = 'planet-item';
        item.dataset.planetName = planet.userData.name;
        
        if (this.selectedPlanet === planet) {
            item.classList.add('selected');
        }
        
        // Иконка планеты
        const icon = document.createElement('div');
        icon.className = 'planet-icon';
        icon.innerHTML = this.getPlanetEmoji(planet.userData.name);
        
        // Информация о планете
        const info = document.createElement('div');
        info.className = 'planet-info';
        
        const name = document.createElement('div');
        name.className = 'planet-name';
        name.textContent = planet.userData.name;
        
        const details = document.createElement('div');
        details.className = 'planet-details';
        
        // Радиус
        if (planet.userData.originalData?.radius) {
            const radiusDetail = document.createElement('div');
            radiusDetail.className = 'planet-detail';
            radiusDetail.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                    <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
                </svg>
                <span>${Math.round(planet.userData.originalData.radius)} км</span>
            `;
            details.appendChild(radiusDetail);
        }
        
        // Орбитальный период
        if (planet.userData.period) {
            const periodDetail = document.createElement('div');
            periodDetail.className = 'planet-detail';
            periodDetail.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                    <path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
                </svg>
                <span>${Math.round(planet.userData.period)} дней</span>
            `;
            details.appendChild(periodDetail);
        }
        
        info.appendChild(name);
        info.appendChild(details);
        
        // Бейдж типа планеты
        const badge = document.createElement('div');
        badge.className = `planet-badge ${this.getPlanetType(planet.userData.name)}`;
        badge.textContent = this.getPlanetTypeLabel(planet.userData.name);
        
        item.appendChild(icon);
        item.appendChild(info);
        item.appendChild(badge);
        
        // Обработчик клика
        item.addEventListener('click', () => this.selectPlanet(planet, item));
        
        return item;
    }
    
    selectPlanet(planet, itemElement) {
        // Убираем выделение с предыдущей планеты
        const prevSelected = this.planetsList.querySelector('.planet-item.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }
        
        // Выделяем новую планету
        itemElement.classList.add('selected');
        this.selectedPlanet = planet;
        
        // Уведомляем приложение о выборе
        const cameraController = this.app.getCameraController();
        if (cameraController) {
            cameraController.selectObject(planet);
        }
    }
    
    focusOnSelectedPlanet() {
        if (!this.selectedPlanet) {
            this.showNotification('Выберите планету из списка');
            return;
        }
        
        const cameraController = this.app.getCameraController();
        if (cameraController) {
            cameraController.focusOnObject(this.selectedPlanet, 1500);
            this.showNotification(`Фокус на ${this.selectedPlanet.userData.name}`);
        }
    }
    
    clearSelection() {
        const selected = this.planetsList.querySelector('.planet-item.selected');
        if (selected) {
            selected.classList.remove('selected');
        }
        
        this.selectedPlanet = null;
        
        const cameraController = this.app.getCameraController();
        if (cameraController) {
            cameraController.selectObject(null);
        }
    }
    
    filterPlanets(query) {
        if (!query) {
            this.renderPlanets(this.planets);
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        const filtered = this.planets.filter(p => 
            p.userData.name.toLowerCase().includes(lowerQuery)
        );
        
        if (filtered.length === 0) {
            this.showEmptyState(`Планеты "${query}" не найдено`);
        } else {
            this.renderPlanets(filtered);
        }
    }
    
    showEmptyState(message) {
        this.planetsList.innerHTML = `
            <div class="planets-empty">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
                    <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
                </svg>
                <p>${message}</p>
            </div>
        `;
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'settings-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 2000);
    }
    
    // Вспомогательные методы
    getPlanetEmoji(name) {
        const emojis = {
            'Меркурий': '☿',
            'Венера': '♀',
            'Земля': '🌍',
            'Марс': '♂',
            'Юпитер': '♃',
            'Сатурн': '♄',
            'Уран': '♅',
            'Нептун': '♆',
            'Плутон': '♇'
        };
        return emojis[name] || '🪐';
    }
    
    getPlanetType(name) {
        const inner = ['Mercury', 'Venus', 'Earth', 'Mars'];
        const outer = ['Jupiter', 'Saturn', 'Uranus', 'Neptune'];
        const dwarf = ['Pluto'];
        
        if (inner.includes(name)) return 'inner';
        if (outer.includes(name)) return 'outer';
        if (dwarf.includes(name)) return 'dwarf';
        return '';
    }
    
    getPlanetTypeLabel(name) {
        const type = this.getPlanetType(name);
        const labels = {
            'inner': 'Внутр.',
            'outer': 'Внешн.',
            'dwarf': 'Карлик'
        };
        return labels[type] || 'Планета';
    }
}