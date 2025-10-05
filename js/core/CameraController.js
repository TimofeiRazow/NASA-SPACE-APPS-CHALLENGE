import * as THREE from "https://unpkg.com/three@0.180.0/build/three.module.js?module";

export class CameraController {
    constructor(camera, renderer, sceneManager, offsetX = -200) {
        this.camera = camera;
        this.renderer = renderer;
        this.sceneManager = sceneManager;
        
        this.isMouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetDistance = 100;
        this.currentDistance = 100;
        this.phi = 0;
        this.theta = 0;
        this.selectedObject = null;
        this.focusPoint = new THREE.Vector3(0, 0, 0);
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.offsetX = window.turnX ? window.turnX : offsetX;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.renderer.domElement.addEventListener('wheel', this.onWheel.bind(this));
        this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu.bind(this));
    }
    
    onMouseDown(event) {
        this.isMouseDown = true;
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;
    }
    
    onMouseUp(event) {
        if (this.isMouseDown && Math.abs(event.clientX - this.mouseX) < 5 && Math.abs(event.clientY - this.mouseY) < 5) {
            // Это клик, а не перетаскивание
            this.handleObjectClick(event);
        }
        this.isMouseDown = false;
    }
    
    onMouseMove(event) {
        if (!this.isMouseDown) {
            this.handleMouseHover(event);
            return;
        }

        const deltaX = event.clientX - this.mouseX;
        const deltaY = event.clientY - this.mouseY;

        this.theta += deltaX * 0.01;
        this.phi += deltaY * 0.01;
        this.phi = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.phi));

        this.mouseX = event.clientX;
        this.mouseY = event.clientY;
    }
    
    onWheel(event) {
        event.preventDefault();
        
        const zoomSpeed = 10; // Можно настроить в зависимости от сцены
        this.targetDistance += event.deltaY * zoomSpeed * 0.01;
        this.targetDistance = Math.max(1, Math.min(1000, this.targetDistance));
    }
    
    onContextMenu(event) {
        event.preventDefault();
    }
    
    handleObjectClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        

        const width = window.innerWidth; 
        const height = window.innerHeight;
        const viewportHeight = height * (1 - window.turnX() / width);
        const offsetY = (height - viewportHeight) / 2;
        
        const vpX = window.turnX();
        const vpY = window.turnX() / rect.width * rect.height - offsetY;
        const vpW = rect.width - window.turnX();
        const vpH = rect.height * (1 - window.turnX() / rect.width);

        if (event.clientX < 0 || event.clientY > vpW || event.clientY < 0 || event.clientY > vpH) {
            this.sceneManager.clearHover();
            this.renderer.domElement.style.cursor = 'default';
            return;
        }
        
        this.mouse.x = ((event.clientX - vpX) / vpW) * 2 - 1;
        this.mouse.y = -((event.clientY  - vpY) / vpH) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const clickableObjects = this.getClickableObjects();
        const intersects = this.raycaster.intersectObjects(clickableObjects);

        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            this.selectObject(clickedObject);
            
            if (this.onObjectClick) {
                this.onObjectClick(clickedObject, intersects[0]);
            }
        } else {
            this.selectObject(null);
        }
    }

    
    handleMouseHover(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        
        const width = window.innerWidth; 
        const height = window.innerHeight;
        const viewportHeight = height * (1 - window.turnX() / width);
        const offsetY = (height - viewportHeight) / 2;
        

        const vpX = window.turnX();
        const vpY = window.turnX() / rect.width * rect.height  - offsetY;
        const vpW = rect.width - window.turnX();
        const vpH = rect.height * (1 - window.turnX() / rect.width);

        if (event.clientX < 0 || event.clientY > vpW || event.clientY < 0 || event.clientY > vpH) {
            this.sceneManager.clearHover();
            this.renderer.domElement.style.cursor = 'default';
            return;
        }
        
        this.mouse.x = ((event.clientX - vpX) / vpW) * 2 - 1;
        this.mouse.y = -((event.clientY - vpY) / vpH) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const hoverableObjects = this.getClickableObjects();
        const intersects = this.raycaster.intersectObjects(hoverableObjects);

        if (intersects.length > 0) {
            const newHoveredObject = intersects[0].object;
            
            if (this.sceneManager.hoveredObject !== newHoveredObject) {
                this.sceneManager.clearHover();
                
                if (newHoveredObject !== this.sceneManager.selectedObject) {
                    this.sceneManager.setHoverObject(newHoveredObject);
                }
            }
            
            this.renderer.domElement.style.cursor = 'pointer';
        } else {
            this.sceneManager.clearHover();
            this.renderer.domElement.style.cursor = 'default';
        }
    }
    
    getClickableObjects() {
        // Эту функцию должна переопределить конкретная реализация
        // В зависимости от активной сцены
        return [];
    }
    
    selectObject(object) {
        this.selectedObject = object;
        this.sceneManager.selectObject(object);
        
        if (object) {
            const {x, y, z} = object.position;
            this.focusPoint.set(x, y, z);
        } else {
            this.focusPoint.set(0, 0, 0);
        }
        
        // Callback для UI обновлений
        if (this.onObjectSelected) {
            this.onObjectSelected(object);
        }
    }
    
    setFocusPoint(point) {
        this.focusPoint.copy(point);
    }
    
    focusOnObject(object, duration = 1000) {
        if (!object) return;
        
        const targetFocus = object.position.clone();
        const startFocus = this.focusPoint.clone();
        const startDistance = this.currentDistance;
        const targetDistance = this.calculateOptimalDistance(object);
        
        const startTime = Date.now();
        
        const animateToFocus = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeInOutCubic(progress);
            
            this.focusPoint.lerpVectors(startFocus, targetFocus, eased);
            this.currentDistance = THREE.MathUtils.lerp(startDistance, targetDistance, eased);
            
            if (progress < 1) {
                requestAnimationFrame(animateToFocus);
            }
        };
        
        animateToFocus();
    }
    
    calculateOptimalDistance(object) {
        if (object.geometry && object.geometry.boundingSphere) {
            const radius = object.geometry.boundingSphere.radius;
            return Math.max(radius * 3, 10);
        }
        return 50;
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    update() {
        this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, this.targetDistance, 0.05);
        
        const x = this.focusPoint.x + this.currentDistance * Math.sin(this.theta) * Math.cos(this.phi);
        const y = this.focusPoint.y + this.currentDistance * Math.sin(this.phi);
        const z = this.focusPoint.z + this.currentDistance * Math.cos(this.theta) * Math.cos(this.phi);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.focusPoint);
    }
    
    setZoomLimits(min, max) {
        this.minDistance = min;
        this.maxDistance = max;
    }
    
    setCameraMode(mode) {
        this.cameraMode = mode;
        // Можно добавить разные режимы: orbit, fly, first-person, etc.
    }
    
    // Методы для программного управления камерой
    setPosition(x, y, z) {
        this.camera.position.set(x, y, z);
        this.currentDistance = this.camera.position.distanceTo(this.focusPoint);
        this.targetDistance = this.currentDistance;
        this.updateAnglesFromPosition();
    }
    
    updateAnglesFromPosition() {
        const offset = this.camera.position.clone().sub(this.focusPoint);
        this.currentDistance = offset.length();
        this.theta = Math.atan2(offset.x, offset.z);
        this.phi = Math.asin(offset.y / this.currentDistance);
    }
    
    lookAt(target) {
        this.focusPoint.copy(target);
        this.camera.lookAt(this.focusPoint);
    }
    
    // Методы для установки callback'ов
    setObjectClickHandler(handler) {
        this.onObjectClick = handler;
    }
    
    setObjectSelectedHandler(handler) {
        this.onObjectSelected = handler;
    }
    
    setClickableObjectsProvider(provider) {
        this.getClickableObjects = provider;
    }
    
    // Методы для анимации камеры
    animateToPosition(targetPos, duration = 1000) {
        const startPos = this.camera.position.clone();
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeInOutCubic(progress);
            
            const currentPos = startPos.clone().lerp(targetPos, eased);
            this.camera.position.copy(currentPos);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.updateAnglesFromPosition();
            }
        };
        
        animate();
    }
    
    resetCamera() {
        this.phi = 0;
        this.theta = 0;
        this.targetDistance = 100;
        this.focusPoint.set(0, 0, 0);
        this.selectedObject = null;
    }
    
    getCameraDistance() {
        return this.currentDistance;
    }
    
    getFormattedDistance() {
        const distance = this.currentDistance;
        
        if (distance > 1000) {
            return `${(distance / 1000).toFixed(1)}К км`;
        } else if (distance > 10) {
            return `${distance.toFixed(0)} км`;
        } else {
            return `${distance.toFixed(1)} км`;
        }
    }
}