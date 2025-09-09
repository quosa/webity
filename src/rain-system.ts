// Rain system - encapsulated rain functionality for GameObject scenes
import { Scene } from './scene.js';
import { Engine } from './engine.js';
import { ENGINE_CONSTANTS } from './types.js';

export class RainSystem {
    private active = false;
    private spawnRate = 0.5; // balls per second
    private lastSpawn = 0;
    private ballSize = 0.3;
    private maxRainBalls: number = ENGINE_CONSTANTS.MAX_ENTITIES;
    private targetFPS = ENGINE_CONSTANTS.TARGET_FPS;
    private frameDropThreshold = ENGINE_CONSTANTS.PERFORMANCE_THRESHOLD;
    private updateInterval: number | null = null;

    constructor(
        private readonly scene: Scene, // eslint-disable-line no-unused-vars
        private readonly engine: Engine // eslint-disable-line no-unused-vars
    ) {}

    start(intensity: number = 1.0): void {
        console.log(`🌧️ Starting rain scene with intensity ${intensity}`);
        this.scene.clear();

        this.active = true;
        this.spawnRate = intensity; // balls per second
        this.lastSpawn = performance.now();

        // Start update interval (60 FPS update rate)
        this.updateInterval = setInterval(() => this.update(), 1000 / 60) as unknown as number;

        console.log(`🌧️ Rain started: ${this.spawnRate} balls/sec, max ${this.maxRainBalls} balls`);
    }

    stop(): void {
        console.log('🌧️ Stopping rain scene');
        this.active = false;

        // Clear update interval
        if (this.updateInterval !== null) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    isActive(): boolean {
        return this.active;
    }

    // Update method to be called from scene update loop
    update(): void {
        if (!this.active) return;

        const now = performance.now();
        const timeSinceLastSpawn = now - this.lastSpawn;
        const spawnInterval = 1000 / this.spawnRate; // ms between spawns

        // Check if it's time to spawn a new ball
        if (timeSinceLastSpawn >= spawnInterval) {
            const currentCount = this.engine.getWasmEntityCount();

            // Check performance before spawning more balls
            if (currentCount >= this.maxRainBalls) {
                console.log(`🌧️ Rain hit max ball limit: ${this.maxRainBalls}`);
                return;
            }

            if (!this.isPerformanceAcceptable()) {
                console.log(`🌧️ Rain auto-stopped due to performance drop: ${currentCount} balls`);
                console.log(
                    `🌧️ Performance threshold: ${this.targetFPS * this.frameDropThreshold} FPS`
                );
                this.active = false;
                return;
            }

            // Spawn a new rain ball at the top of the world
            const x = (Math.random() - 0.5) * 14; // -7 to +7 (slightly wider than world bounds)
            const z = (Math.random() - 0.5) * 14; // -7 to +7
            const y = 15 + Math.random() * 5; // High up in the sky

            const entityIndex = this.engine.spawnWasmEntity(x, y, z, this.ballSize);

            // Add slight random initial velocity for more realistic rain
            if (entityIndex < ENGINE_CONSTANTS.MAX_ENTITIES) {
                // Check if spawn succeeded
                const vx = (Math.random() - 0.5) * 1.0;
                const vz = (Math.random() - 0.5) * 1.0;
                this.engine.setWasmEntityVelocity(entityIndex, vx, 0, vz);
            }

            this.lastSpawn = now;

            // Log progress much less frequently to avoid DevTools bottleneck
            if (currentCount > 0 && currentCount % 100 === 0) {
                console.log(`🌧️ Rain progress: ${currentCount + 1} balls spawned`);
            }
        }
    }

    private isPerformanceAcceptable(): boolean {
        // For now, we'll use a simple check based on entity count
        // In the future, this could integrate with the engine's performance monitoring
        const currentCount = this.engine.getWasmEntityCount();

        // Conservative limit - if we have too many entities, performance likely suffers
        const performanceLimit = Math.min(this.maxRainBalls * 0.8, 5000);

        return currentCount < performanceLimit;
    }

    // Configuration methods
    setSpawnRate(rate: number): void {
        this.spawnRate = Math.max(0.1, Math.min(10.0, rate)); // Clamp between 0.1 and 10
    }

    setBallSize(size: number): void {
        this.ballSize = Math.max(0.1, Math.min(1.0, size)); // Clamp between 0.1 and 1.0
    }

    setMaxBalls(max: number): void {
        this.maxRainBalls = Math.max(1, Math.min(ENGINE_CONSTANTS.MAX_ENTITIES, max));
    }

    // Status getters
    getSpawnRate(): number {
        return this.spawnRate;
    }

    getBallSize(): number {
        return this.ballSize;
    }

    getMaxBalls(): number {
        return this.maxRainBalls;
    }

    getCurrentBallCount(): number {
        return this.engine.getWasmEntityCount();
    }
}
