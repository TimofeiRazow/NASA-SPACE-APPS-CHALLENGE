import * as THREE from "https://unpkg.com/three@0.180.0/build/three.module.js?module";

export class EarthParticle {
    constructor(position, color, isAtmosphere = false) {
        this.position = new THREE.Vector3(position.x, position.y, position.z);
        this.originalPosition = new THREE.Vector3(position.x, position.y, position.z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.color = color.clone();
        this.originalColor = color.clone();
        this.temperature = 20;
        this.isDestroyed = false;
        this.isFlying = false;
        this.isOrbiting = true;
        this.isAtmosphere = isAtmosphere;
        this.mass = isAtmosphere ? 0.1 : 2;
        this.life = 1.0;
        this.coolingRate = isAtmosphere ? 0.997 : 0.998;
        this.dampening = (isAtmosphere ? 0.1 : 0.3) + 0.15 * Math.random();
        this.dampingFactor = (isAtmosphere ? 0.999 : 0.2);
        this.opacity = isAtmosphere ? 0.8 : 1.0;
        this.originalOpacity = this.opacity;
        this.radius = isAtmosphere ? 0.1 : 0.15;
        this.emissiveIntensity = 0;

        // Для частиц которые будут образованы от взрыва астероида
        this.vortexStrength = 1; // Сила вихря
        this.vortexAge = 1; // Возраст вихря для затухания
    }
    
    update(deltaTime, gravityCenter, gravityStrength, timeScale = 1) {
        // Применяем timeScale к deltaTime сразу
        const scaledDeltaTime = deltaTime * timeScale;
        
        if (this.isAtmosphere) {
            this.applyAtmosphericRotation(scaledDeltaTime);
            this.applyAtmosphericGravity(gravityCenter, gravityStrength, scaledDeltaTime);
            if (this.isDestroyed) {
                this.applyVortexForce(scaledDeltaTime);
            }
            //
        }

        // Перемещение с учетом timeScale
        this.position.add(this.velocity.clone().multiplyScalar(scaledDeltaTime));
        
        if (this.isDestroyed && gravityStrength > 0) {
            const distanceToCenter = this.position.distanceTo(gravityCenter);
            if (distanceToCenter > 0.1) {
                const gravityDirection = gravityCenter.clone().sub(this.position).normalize();
                const gravityForce = this.isAtmosphere ? 
                    (gravityStrength / Math.max(1, distanceToCenter * distanceToCenter) * this.mass / 1000) : 
                    (gravityStrength / Math.max(1, distanceToCenter * distanceToCenter) * this.mass);
                this.velocity.add(gravityDirection.multiplyScalar(gravityForce * scaledDeltaTime));
            }
        }
        
        // Затухание
        if (this.isDestroyed) {
            this.velocity.multiplyScalar(this.dampingFactor);
            this.velocity.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02
            ));
        } else {
            this.velocity.multiplyScalar(this.dampening);
        }
        
        // Охлаждение с учетом timeScale
        const coolingFactor = Math.pow(this.coolingRate, scaledDeltaTime);
        this.temperature *= coolingFactor;
        this.temperature = Math.max(20, this.temperature);
        
        const speed = this.velocity.length();
        if (this.isAtmosphere && speed > 0.3) {
            // Дополнительное затухание для быстрых атмосферных частиц
            this.velocity.multiplyScalar(0.95);
        }
        this.isFlying = speed > 0.01;
        
        this.updateColor();
    }

    applyVortexForce(deltaTime) {
        if (this.vortexStrength > 0) {
            const toCenter = this.position.clone().normalize();
            const tangential = new THREE.Vector3(1, 1, 1).cross(toCenter).normalize();
            
            // Добавляем вихревое вращение
            const vortexVelocity = tangential.multiplyScalar(this.vortexStrength);
            this.velocity.add(vortexVelocity.multiplyScalar(deltaTime));
            
            // Добавляем турбулентность
            const turbulence = new THREE.Vector3(
                -(Math.random() - 0.5) * this.vortexStrength * 0.1,
                -(Math.random() - 0.5) * this.vortexStrength * 0.1,
                -(Math.random() - 0.5) * this.vortexStrength * 0.1
            );
            this.velocity.add(turbulence.multiplyScalar(deltaTime));
            
            // Затухание вихря
            this.vortexAge += deltaTime;
            this.vortexStrength *= 0.999;
            
            if (this.vortexStrength < 0.001) {
                this.vortexStrength = 0;
            }
        }
    }

    applyAtmosphericGravity(gravityCenter, gravityStrength, deltaTime) {
        const distanceToCenter = this.position.distanceTo(gravityCenter);
        const earthRadius = 5;
        const atmosphereThickness = 100;
        const maxAtmosphereRadius = earthRadius + atmosphereThickness;
        
        if (distanceToCenter > maxAtmosphereRadius) {
            const excessDistance = distanceToCenter - maxAtmosphereRadius;
            const pullBackStrength = gravityStrength * 2 * (1 + excessDistance);
            
            const gravityDirection = gravityCenter.clone().sub(this.position).normalize();
            const gravityForce = pullBackStrength * this.mass;
            this.velocity.add(gravityDirection.multiplyScalar(gravityForce * deltaTime));
        } else if (distanceToCenter > earthRadius) {
            const normalizedDistance = (distanceToCenter - earthRadius) / atmosphereThickness;
            const gravityReduction = 1 - normalizedDistance * 0.5;
            
            const gravityDirection = gravityCenter.clone().sub(this.position).normalize();
            const gravityForce = gravityStrength * gravityReduction * this.mass;
            this.velocity.add(gravityDirection.multiplyScalar(gravityForce * deltaTime));
        }
    }

    applyAtmosphericRotation(deltaTime) {
        const earthRadius = 6;
        const baseRotationSpeed = 0.015; // Уменьшил для более реалистичного эффекта
        
        const distanceFromCenter = this.position.length();
        const heightAboveSurface = Math.max(0, distanceFromCenter - earthRadius);
        
        // Скорость вращения уменьшается с высотой
        const heightFactor = Math.exp(-heightAboveSurface * 0.1);
        const rotationSpeed = baseRotationSpeed * heightFactor;
        
        // Вращение вокруг оси Y (как у Земли)
        const rotationAxis = new THREE.Vector3(0, 1, 0);
        
        // Применяем вращение к позиции частицы
        const rotationAngle = rotationSpeed * deltaTime;
        this.position.applyAxisAngle(rotationAxis, rotationAngle);
        
        // Также поворачиваем вектор скорости
        this.velocity.applyAxisAngle(rotationAxis, rotationAngle);
        
        // Добавляем небольшую турбулентность для реалистичности
        if (Math.random() < 0.01) {
            this.velocity.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.001,
                (Math.random() - 0.5) * 0.001,
                (Math.random() - 0.5) * 0.001
            ));
        }
    }
    

    updateColor() {
        if (this.temperature > 2000) {
            const intensity = Math.min(1, (this.temperature - 2000) / 3000);
            this.color.setRGB(1, 1, 0.9 + intensity * 0.1);
            this.emissiveIntensity = intensity * 0.5;
        } else if (this.temperature > 1000) {
            const intensity = (this.temperature - 1000) / 1000;
            this.color.setRGB(1, 0.8 + intensity * 0.2, 0.2);
            this.emissiveIntensity = intensity * 0.3;
        } else if (this.temperature > 500) {
            const intensity = (this.temperature - 500) / 500;
            this.color.setRGB(1, 0.3 + intensity * 0.5, 0.1);
            this.emissiveIntensity = intensity * 0.2;
        } else {
            const coolFactor = Math.max(0, (this.temperature - 20) / 80);
            if (this.isDestroyed && !this.isAtmosphere){
                this.color.lerpColors(new THREE.Color(0.14, 0.07, 0.0), new THREE.Color(0.8, 0.2, 0.1), coolFactor * 0.2);
            } else {
                this.color.lerpColors(this.originalColor, new THREE.Color(0.8, 0.2, 0.1), coolFactor * 0.2);
            }
            this.emissiveIntensity = 0;
        }
    }
    
    destroy(impactForce, temperature) {
        this.isDestroyed = true;
        this.isFlying = true;
        this.temperature = Math.max(this.temperature, temperature);
        this.velocity.add(impactForce);
        
        // Добавляем орбитальную скорость для создания орбит
        const distanceFromCenter = this.position.length();
        if (distanceFromCenter > 3 && Math.random() < 0.4) {
            const toCenter = this.position.clone().normalize();
            const tangential = new THREE.Vector3();
            
            if (Math.abs(toCenter.y) < 0.9) {
                tangential.set(0, 1, 0);
            } else {
                tangential.set(1, 0, 0);
            }
            
            tangential.cross(toCenter).normalize();
            
            if (Math.random() < 0.5) {
                tangential.multiplyScalar(-1);
            }
            
            const orbitalSpeed = 0.02 * (0.7 + Math.random() * 0.6);
            this.velocity.add(tangential.multiplyScalar(orbitalSpeed));
        }
    }

    checkAsteroidCollision(asteroidPosition, asteroidRadius) {
        const distance = this.position.distanceTo(asteroidPosition);
        return distance <= (this.radius + asteroidRadius);
    }
}