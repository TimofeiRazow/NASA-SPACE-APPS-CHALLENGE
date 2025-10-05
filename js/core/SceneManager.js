import * as THREE from "https://unpkg.com/three@0.180.0/build/three.module.js?module";
import { UnrealBloomPass } from "https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/UnrealBloomPass.js?module";
import { EffectComposer } from "https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/EffectComposer.js?module";
import { RenderPass } from "https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/RenderPass.js?module";
import { OutlinePass } from "https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/OutlinePass.js?module";
import { SelectiveBloomPass } from './SelectiveBloomPass.js';



export class SceneManager {
    constructor(turnLeft = -200) {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.outlinePass = null;
        this.bloomPass = null;
        this.selectedObject = null;
        this.hoveredObject = null;
        this.offsetX = turnLeft;
        
        this.init();
    }
    
    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.setupLighting();
        this.setupPostProcessing();
        this.setupEventListeners();
    }
    
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);
    }
    
    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000000
        );
        this.camera.position.set(0, 50, 200);
    }
    
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.1);
        this.scene.add(ambientLight);
        
        // Point light (sun)
        const pointLight = new THREE.PointLight(0xFDFFD3, 1, 10000, 0.5);
        pointLight.position.set(50, 30, 50);
        this.scene.add(pointLight);
    }
    
    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        // Bloom pass для свечения
        this.bloomPass = new SelectiveBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 
            1.0, 0.9, 0.8
        );
        this.bloomPass.scene = this.scene; // Передаем сцену в bloom pass
        this.composer.addPass(this.bloomPass);   
        
        // Outline pass для выделения объектов
        this.outlinePass = new OutlinePass(
            new THREE.Vector2(window.innerWidth, window.innerHeight), 
            this.scene, 
            this.camera
        );
        this.outlinePass.edgeStrength = 3;
        this.outlinePass.edgeGlow = 1;
        this.outlinePass.visibleEdgeColor.set(0xffffff);
        this.outlinePass.hiddenEdgeColor.set(0x190a05);
        this.composer.addPass(this.outlinePass);
        
        
    }
    
    loadBackground(texturePath) {
        const loader = new THREE.TextureLoader();
        loader.load(texturePath, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.center.set(0.5, 0.5);
            this.scene.background = texture;
        });
    }
    
    setupEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    selectObject(object) {
        // Убираем предыдущую подсветку
        if (this.selectedObject) {
            this.outlinePass.selectedObjects = [];
        }
        
        this.selectedObject = object;
        
        if (this.selectedObject) {
            // Добавляем новую подсветку
            this.outlinePass.selectedObjects = [this.selectedObject];
        }
    }
    
    setHoverObject(object) {
        this.hoveredObject = object;
        
        if (object && object !== this.selectedObject) {
            // Визуальный эффект при наведении
            if (object.material && !object.userData.hoverOriginalMaterial) {
                object.userData.hoverOriginalMaterial = object.material;
                const hoverMaterial = object.material.clone();
                
                if (hoverMaterial.emissive !== undefined) {
                    hoverMaterial.emissive = new THREE.Color(0x222222);
                    hoverMaterial.emissiveIntensity = 0.2;
                }
                
                object.material = hoverMaterial;
            }
        }
    }
    
    clearHover() {
        if (this.hoveredObject && this.hoveredObject !== this.selectedObject) {
            // Восстанавливаем оригинальный материал
            if (this.hoveredObject.userData.hoverOriginalMaterial) {
                this.hoveredObject.material = this.hoveredObject.userData.hoverOriginalMaterial;
                delete this.hoveredObject.userData.hoverOriginalMaterial;
            }
        }
        this.hoveredObject = null;
    }
    
    clearScene() {
        // Убираем выделение
        this.selectedObject = null;
        this.hoveredObject = null;
        if (this.outlinePass) {
            this.outlinePass.selectedObjects = [];
        }
        
        const objectsToRemove = [];
        this.scene.traverse(child => {
            if (child !== this.camera && child.type !== 'AmbientLight' && child.type !== 'PointLight') {
                objectsToRemove.push(child);
            }
        });
        
        objectsToRemove.forEach(obj => {
            this.disposeObject(obj);
            this.scene.remove(obj);
        });
    }
    
    disposeObject(obj) {
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(mat => mat.dispose());
            } else {
                obj.material.dispose();
            }
        }
        
        if (obj.texture) {
            obj.texture.dispose();
        }
    }
    
    render() {
        // боже какой же я умный (нет)
        let translateX = window.turnX();
        const width = window.innerWidth; 
        const height = window.innerHeight;
        const viewportHeight = height * (1 - translateX / width);
        const offsetY = (height - viewportHeight) / 2;
        this.renderer.setViewport(
            translateX,
            offsetY,
            width - translateX,
            viewportHeight
        );

        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    // Методы для добавления объектов
    add(object) {
        this.scene.add(object);
    }
    
    remove(object) {
        this.scene.remove(object);
    }
    
    // Геттеры для совместимости
    getScene() {
        return this.scene;
    }
    
    getCamera() {
        return this.camera;
    }
    
    getRenderer() {
        return this.renderer;
    }
    
    getComposer() {
        return this.composer;
    }
}