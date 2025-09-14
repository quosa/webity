// src/v2/rain-system.ts
// Enhanced rain system using v2 GameObject architecture with multiple mesh types and colors

import { Scene } from './scene-system';
import { GameObject } from './gameobject';
import { RainEntityFactory, RainEntityType, RainEntityConfig } from './rain-entity-factory';
import { Vector3 } from './components';

export interface RainSystemConfig {
    spawnRate: number;        // entities per second
    maxEntities: number;      // maximum number of rain entities
    spawnArea: {
        x: [number, number],  // spawn area bounds
        y: [number, number],
        z: [number, number]
    };
    entityTypes?: RainEntityType[];  // specific types to spawn (empty = all types)
    autoCleanup?: boolean;    // automatically remove entities that fall too far
    cleanupY?: number | undefined;        // Y coordinate below which entities are removed
}

export interface RainSystemStats {
    active: boolean;
    entityCount: number;
    spawnRate: number;
    totalSpawned: number;
    totalCleaned: number;
    performanceFPS: number;
}

export class RainSystemV2 {
    private scene: Scene;
    private factory: RainEntityFactory;
    private config: RainSystemConfig;

    // System state
    private active = false;
    private lastSpawnTime = 0;
    private totalSpawned = 0;
    private totalCleaned = 0;
    private rainEntities = new Set<string>(); // Track entity IDs for cleanup

    // Performance monitoring
    private frameHistory: number[] = [];
    private lastFrameTime = 0;
    private readonly maxFrameHistory = 60;

    // Update interval
    private updateInterval: number | undefined;

    constructor(scene: Scene, config: RainSystemConfig) {
        this.scene = scene;
        this.factory = new RainEntityFactory();
        this.config = {
            autoCleanup: true,
            cleanupY: -20,
            ...config
        };

        console.log('🌧️ RainSystemV2 initialized with config:', this.config);
    }

    /**
     * Start the rain system
     */
    start(): void {
        if (this.active) {
            console.warn('🌧️ Rain system already active');
            return;
        }

        console.log(`🌧️ Starting enhanced rain system - ${this.config.spawnRate} entities/sec`);

        this.active = true;
        this.lastSpawnTime = performance.now();
        this.lastFrameTime = performance.now();

        // Start update loop at 60 FPS
        this.updateInterval = window.setInterval(() => {
            this.update();
        }, 1000 / 60);

        console.log(`🌧️ Rain system started - spawn area: ${JSON.stringify(this.config.spawnArea)}`);
        console.log('🌧️ Rain system config:', this.config);
    }

    /**
     * Stop the rain system
     */
    stop(): void {
        if (!this.active) return;

        console.log('🌧️ Stopping rain system');
        this.active = false;

        if (this.updateInterval) {
            window.clearInterval(this.updateInterval);
            this.updateInterval = undefined;
        }

        console.log(`🌧️ Rain system stopped - total spawned: ${this.totalSpawned}, cleaned: ${this.totalCleaned}`);
    }

    /**
     * Main update loop
     */
    private update(): void {
        if (!this.active) return;

        const now = performance.now();
        this.updatePerformanceStats(now);

        // Check if we should spawn new entities
        this.trySpawnEntity(now);

        // Clean up entities if enabled
        if (this.config.autoCleanup) {
            this.cleanupEntities();
        }

        // Check performance and auto-stop if needed
        this.checkPerformance();
    }

    /**
     * Try to spawn a new rain entity based on spawn rate
     */
    private trySpawnEntity(currentTime: number): void {
        const timeSinceLastSpawn = currentTime - this.lastSpawnTime;
        const spawnInterval = 1000 / this.config.spawnRate; // ms between spawns

        if (timeSinceLastSpawn < spawnInterval) return;

        // Check entity limit
        if (this.rainEntities.size >= this.config.maxEntities) {
            console.log(`🌧️ Rain hit max entity limit: ${this.config.maxEntities}`);
            return;
        }

        // Spawn new entity
        const entity = this.spawnRainEntity();
        if (entity) {
            this.scene.addGameObject(entity);
            this.rainEntities.add(entity.id);
            this.totalSpawned++;
            this.lastSpawnTime = currentTime;

            console.log(`🌧️ Rain entity spawned: ${entity.name} (total: ${this.totalSpawned}, active: ${this.rainEntities.size})`);

            // Log progress occasionally
            if (this.totalSpawned % 50 === 0) {
                console.log(`🌧️ Rain progress: ${this.totalSpawned} entities spawned (${this.rainEntities.size} active)`);
            }
        }
    }

    /**
     * Spawn a single rain entity
     */
    private spawnRainEntity(): GameObject | null {
        try {
            // Generate random position in spawn area
            const position: Vector3 = {
                x: this.config.spawnArea.x[0] + Math.random() * (this.config.spawnArea.x[1] - this.config.spawnArea.x[0]),
                y: this.config.spawnArea.y[0] + Math.random() * (this.config.spawnArea.y[1] - this.config.spawnArea.y[0]),
                z: this.config.spawnArea.z[0] + Math.random() * (this.config.spawnArea.z[1] - this.config.spawnArea.z[0]),
            };

            // Add some lateral velocity for more dynamic rain
            const initialVelocity: Vector3 = {
                x: (Math.random() - 0.5) * 3.0, // -1.5 to +1.5 lateral velocity
                y: 0,
                z: (Math.random() - 0.5) * 3.0, // -1.5 to +1.5 lateral velocity
            };

            // Create entity with random or specific type
            if (this.config.entityTypes && this.config.entityTypes.length > 0) {
                // Use specific types
                const randomType = this.config.entityTypes[Math.floor(Math.random() * this.config.entityTypes.length)] as RainEntityType;
                console.log(`🌧️ Creating rain entity of type: ${randomType}`);
                const entityConfig: RainEntityConfig = {
                    type: randomType,
                    position,
                    initialVelocity
                };
                return this.factory.createRainEntity(entityConfig);
            } else {
                // Use random type
                console.log('🌧️ Creating random rain entity');
                return this.factory.createRandomRainEntity(position, initialVelocity);
            }
        } catch (error) {
            console.error('🌧️ Failed to spawn rain entity:', error);
            return null;
        }
    }

    /**
     * Clean up entities that have fallen below the cleanup threshold
     */
    private cleanupEntities(): void {
        if (!this.config.cleanupY) return;

        const entitiesToRemove: string[] = [];

        for (const entityId of this.rainEntities) {
            const entity = this.scene.getGameObject(entityId);
            if (!entity) {
                // Entity already removed from scene
                entitiesToRemove.push(entityId);
                continue;
            }

            // Check if entity has fallen too far
            if (entity.transform.position.y < (this.config.cleanupY || -20)) {
                entitiesToRemove.push(entityId);
                this.scene.removeGameObject(entityId);
                this.totalCleaned++;
            }
        }

        // Remove from tracking
        entitiesToRemove.forEach(id => this.rainEntities.delete(id));

        if (entitiesToRemove.length > 0) {
            console.log(`🌧️ Cleaned up ${entitiesToRemove.length} rain entities (total cleaned: ${this.totalCleaned})`);
        }
    }

    /**
     * Update performance statistics
     */
    private updatePerformanceStats(currentTime: number): void {
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        const fps = 1000 / deltaTime;
        this.frameHistory.push(fps);

        // Keep only recent frame history
        if (this.frameHistory.length > this.maxFrameHistory) {
            this.frameHistory.shift();
        }
    }

    /**
     * Check performance and auto-stop if FPS drops too low
     */
    private checkPerformance(): void {
        if (this.frameHistory.length < 30) return; // Need enough samples

        const averageFPS = this.frameHistory.reduce((sum, fps) => sum + fps, 0) / this.frameHistory.length;

        // Auto-stop if performance drops below 30 FPS
        if (averageFPS < 30) {
            console.warn(`🌧️ Rain auto-stopped due to performance: ${averageFPS.toFixed(1)} FPS`);
            this.stop();
        }
    }

    /**
     * Get current system statistics
     */
    getStats(): RainSystemStats {
        const averageFPS = this.frameHistory.length > 0
            ? this.frameHistory.reduce((sum, fps) => sum + fps, 0) / this.frameHistory.length
            : 60;

        return {
            active: this.active,
            entityCount: this.rainEntities.size,
            spawnRate: this.config.spawnRate,
            totalSpawned: this.totalSpawned,
            totalCleaned: this.totalCleaned,
            performanceFPS: averageFPS,
        };
    }

    /**
     * Update configuration while running
     */
    updateConfig(newConfig: Partial<RainSystemConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('🌧️ Rain system config updated:', this.config);
    }

    /**
     * Clear all rain entities immediately
     */
    clearAllRainEntities(): void {
        console.log(`🌧️ Clearing all ${this.rainEntities.size} rain entities`);

        for (const entityId of this.rainEntities) {
            this.scene.removeGameObject(entityId);
        }

        this.rainEntities.clear();
        this.totalCleaned += this.rainEntities.size;
    }

    /**
     * Check if the system is currently active
     */
    isActive(): boolean {
        return this.active;
    }

    /**
     * Get the current number of active rain entities
     */
    getActiveEntityCount(): number {
        return this.rainEntities.size;
    }

    /**
     * Spawn a burst of rain entities immediately
     */
    spawnBurst(count: number): void {
        console.log(`🌧️ Spawning rain burst: ${count} entities`);

        const entities = this.factory.createRainBatch(count, this.config.spawnArea);

        entities.forEach(entity => {
            this.scene.addGameObject(entity);
            this.rainEntities.add(entity.id);
            this.totalSpawned++;
        });

        console.log(`🌧️ Rain burst spawned: ${entities.length} entities`);
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.stop();
        this.clearAllRainEntities();
        this.factory.resetCounter();
    }
}