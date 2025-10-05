import * as THREE from "https://unpkg.com/three@0.180.0/build/three.module.js?module";

export class Asteroid {
    constructor(scene, size, speed, position, targetDirection) {
        this.scene = scene;
        this.size = size;
        this.speed = speed;
        this.isActive = true;
        this.hasImpacted = false;
        
        // Создаем 3D объект астероида
        const geometry = new THREE.SphereGeometry(size, 16, 12);
        const material = new THREE.MeshPhongMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.9
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);
        
        // Направление движения
        this.velocity = targetDirection.clone().multiplyScalar(speed * 0.02);
        this.targetPoint = targetDirection.clone().multiplyScalar(5); // радиус Земли
    }
    
    update(particles, timeScale) {
        this.mesh.position.add(this.velocity.clone().multiplyScalar(timeScale));
        this.mesh.rotation.x += 0.02 * timeScale;
        this.mesh.rotation.y += 0.03 * timeScale;
        this.mesh.rotation.z += 0.01 * timeScale;

        // Проверка столкновений с частицами
        if (particles) {
            const allParticles = [...particles.earth, ...particles.atmosphere];
            for (let particle of allParticles) {
                if (particle.checkAsteroidCollision(this.mesh.position, this.size)) {
                    const impactEnergy = this.size * this.speed * 10;
                    return {
                        point: this.mesh.position.clone(),
                        energy: impactEnergy,
                        size: this.size * 0.3,
                        isSecondary: true
                    };
                }
            }
        }
        
        // Проверка столкновения с Землей
        const distance = this.mesh.position.distanceTo(new THREE.Vector3(0, 0, 0));
        if (distance <= 5 + this.size * 0.8) {
            return this.impact();
        }
        
        return null;
    }
    
    impact() {
        if (this.hasImpacted) return null;
        
        this.hasImpacted = true;
        this.isActive = false;
        this.mesh.visible = false;
        
        const impactPoint = this.targetPoint.clone();
        const energy = this.size * this.speed * 100;
        
        return {
            point: impactPoint,
            energy: energy,
            size: this.size,
            isSecondary: false
        };
    }
    
    destroy() {
        this.scene.remove(this.mesh);
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) this.mesh.material.dispose();
    }
    
    static calculateMass(diameter, material) {
        const radius = diameter / 2;
        const volume = (4/3) * Math.PI * Math.pow(radius, 3);
        
        let density;
        switch (material) {
            case 'stone': density = 2700; break;
            case 'metal': density = 7800; break;
            case 'ice': density = 920; break;
            default: density = 2700;
        }
        
        return volume * density;
    }
    
    static calculateImpactEnergy(mass, velocity) {
        return 0.5 * mass * Math.pow(velocity * 1000, 2);
    }
    
    static calculateCraterDiameter(energy) {
        return 1.8 * Math.pow(energy / (2700 * 9.81), 0.22);
    }
    
    static calculateMagnitude(energy) {
        return 0.67 * Math.log10(energy) - 5.87;
    }
}