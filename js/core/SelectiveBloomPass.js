// Создайте новый файл js/core/SelectiveBloomPass.js
import * as THREE from "https://unpkg.com/three@0.180.0/build/three.module.js?module";
import { UnrealBloomPass } from "https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/UnrealBloomPass.js?module";

export class SelectiveBloomPass extends UnrealBloomPass {
    constructor(resolution, strength, radius, threshold) {
        super(resolution, strength, radius, threshold);
        this.originalMaterials = new Map();
        this.darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
    }

    render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
        // Сохраняем оригинальные материалы и заменяем excluded объекты на черные
        this.scene.traverse((obj) => {
            if (obj.isMesh && obj.userData.excludeFromBloom) {
                this.originalMaterials.set(obj, obj.material);
                obj.material = this.darkMaterial;
            }
        });

        // Рендерим bloom
        super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);

        // Восстанавливаем оригинальные материалы
        this.originalMaterials.forEach((material, obj) => {
            obj.material = material;
        });
        this.originalMaterials.clear();
    }
}