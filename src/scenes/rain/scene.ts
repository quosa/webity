// src/scenes/rain/scene.ts
// Demo script for the enhanced rain system with multiple mesh types and colors
// (scene-first engine API).

import { Scene } from '../../engine/scene-system';
import { Engine } from '../../engine/engine';
import { RainSystemV2, RainSystemConfig } from './rain-system';
import { RainEntityType } from './rain-entity-factory';
import { GameObject } from '../../engine/gameobject';
import { MeshRenderer } from '../../engine/components';
import { Mesh } from '../../engine/mesh';
import { Material } from '../../engine/material';

// Build the rain scene as pure data: a gray grid floor + camera. Rain entities are spawned
// at runtime by RainSystemV2 (they use the 'sphere'/'cube' meshes registered in init()).
function buildRainScene(): Scene {
    const scene = new Scene();

    // Add floor to scene
    const gridFloor = new GameObject('grid-floor', 'Grid Floor');
    gridFloor.transform.setPosition(0, -2, 0); // Below other objects
    gridFloor.transform.setScale(1, 1, 1);
    gridFloor.addComponent(
        new MeshRenderer(Mesh.createGrid('grid', 20, 20), new Material('grid-gray', { r: 0.3, g: 0.3, b: 0.3, a: 1 }), 'lines'), // Gray
    );
    scene.addGameObject(gridFloor);
    console.log('⬜ Added gray grid floor at (0, -2, 0)');

    // Setup camera
    scene.camera.setPosition([0, 10, -15]);
    scene.camera.setTarget([0, 0, 0]);
    console.log('✅ Camera positioned');

    return scene;
}

class EnhancedRainDemo {
    private engine: Engine;
    private scene: Scene;
    private rainSystem?: RainSystemV2;
    private statsAnimationId?: number;

    // UI elements
    private startButton!: HTMLButtonElement;
    private stopButton!: HTMLButtonElement;
    private burstButton!: HTMLButtonElement;
    private clearButton!: HTMLButtonElement;
    private spawnRateSlider!: HTMLInputElement;
    private maxEntitiesSlider!: HTMLInputElement;

    // Stats elements
    private activeEntitiesEl!: HTMLElement;
    private totalSpawnedEl!: HTMLElement;
    private performanceFPSEl!: HTMLElement;

    constructor() {
        // Engine resolves the canvas by id (throws if missing).
        this.engine = new Engine('canvas');
        this.scene = buildRainScene();

        this.setupUI();
    }

    private setupUI(): void {
        // Get UI elements
        this.startButton = document.getElementById('startRain') as HTMLButtonElement;
        this.stopButton = document.getElementById('stopRain') as HTMLButtonElement;
        this.burstButton = document.getElementById('burstRain') as HTMLButtonElement;
        this.clearButton = document.getElementById('clearRain') as HTMLButtonElement;

        this.spawnRateSlider = document.getElementById('spawnRate') as HTMLInputElement;
        this.maxEntitiesSlider = document.getElementById('maxEntities') as HTMLInputElement;

        // Stats elements
        this.activeEntitiesEl = document.getElementById('activeEntities')!;
        this.totalSpawnedEl = document.getElementById('totalSpawned')!;
        this.performanceFPSEl = document.getElementById('performanceFPS')!;

        // Setup event listeners
        this.startButton.addEventListener('click', () => this.startRain());
        this.stopButton.addEventListener('click', () => this.stopRain());
        this.burstButton.addEventListener('click', () => this.spawnBurst());
        this.clearButton.addEventListener('click', () => this.clearRain());

        // Setup slider listeners
        this.spawnRateSlider.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            document.getElementById('spawnRateValue')!.textContent = value;

            if (this.rainSystem) {
                this.rainSystem.updateConfig({ spawnRate: parseFloat(value) });
            }
        });

        this.maxEntitiesSlider.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            document.getElementById('maxEntitiesValue')!.textContent = value;

            if (this.rainSystem) {
                this.rainSystem.updateConfig({ maxEntities: parseInt(value) });
            }
        });
    }

    async init(): Promise<void> {
        try {
            this.showLoading(true);

            console.log('🌧️ Initializing Enhanced Rain Demo...');

            // Initialize the engine (WebGPU renderer)
            await this.engine.init();
            console.log('✅ WebGPU Renderer V2 initialized');

            // Register meshes used by runtime-spawned rain entities. They aren't present in
            // the initial scene tree, so loadScene won't auto-register them. The floor's grid
            // mesh IS in the tree and gets registered by loadScene below.
            this.engine.registerMesh(Mesh.createSphere('sphere', 0.5, 8)); // Low-poly for performance
            this.engine.registerMesh(Mesh.createCube('cube', 1.0));
            console.log('✅ Meshes registered');

            // Mount the scene (uploads the floor grid mesh + registers entities with WASM)
            await this.engine.loadScene(this.scene);
            console.log('✅ Physics bridge initialized');

            // Start the frame loop (input → physics → update → render)
            this.engine.start();

            // Expose for console debugging
            (window as unknown as { engine: Engine; scene: Scene }).engine = this.engine;
            (window as unknown as { engine: Engine; scene: Scene }).scene = this.scene;

            console.log('🎉 Enhanced Rain Demo initialized successfully!');
            this.showLoading(false);

            // Start stats UI loop
            this.startStatsLoop();

        } catch (error) {
            console.error('❌ Failed to initialize demo:', error);
            this.showError(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.showLoading(false);
        }
    }

    private startRain(): void {
        if (this.rainSystem && this.rainSystem.isActive()) {
            console.log('🌧️ Rain system already running');
            return;
        }

        const config: RainSystemConfig = {
            spawnRate: parseFloat(this.spawnRateSlider.value),
            maxEntities: parseInt(this.maxEntitiesSlider.value),
            spawnArea: {
                x: [-10, 10],  // Wide spawn area
                y: [15, 20],   // High up
                z: [-10, 10],  // Wide spawn area
            },
            autoCleanup: true,
            cleanupY: -15,
            // Mix of all entity types for variety
            entityTypes: [
                RainEntityType.SMALL_SPHERE,
                RainEntityType.MEDIUM_SPHERE,
                RainEntityType.LARGE_SPHERE,
                RainEntityType.SMALL_CUBE,
                RainEntityType.MEDIUM_CUBE,
                RainEntityType.LARGE_CUBE,
            ]
        };

        this.rainSystem = new RainSystemV2(this.scene, config);
        this.rainSystem.start();

        // Update UI
        this.startButton.disabled = true;
        this.stopButton.disabled = false;

        console.log('🌧️ Enhanced rain started!');
    }

    private stopRain(): void {
        if (!this.rainSystem) return;

        this.rainSystem.stop();

        // Update UI
        this.startButton.disabled = false;
        this.stopButton.disabled = true;

        console.log('🛑 Rain stopped');
    }

    private spawnBurst(): void {
        if (!this.rainSystem) {
            console.warn('⚠️ No rain system active');
            return;
        }

        this.rainSystem.spawnBurst(20);
        console.log('💥 Rain burst spawned!');
    }

    private clearRain(): void {
        if (!this.rainSystem) return;

        this.rainSystem.clearAllRainEntities();
        console.log('🧹 All rain entities cleared');
    }

    // The Engine owns the physics/render loop. This lightweight loop only refreshes the
    // scene-specific stats UI — it does NOT step the scene.
    private startStatsLoop(): void {
        const loop = (): void => {
            this.updateStats();
            this.statsAnimationId = requestAnimationFrame(loop);
        };
        this.statsAnimationId = requestAnimationFrame(loop);
    }

    private updateStats(): void {
        if (!this.rainSystem) {
            this.activeEntitiesEl.textContent = '0';
            this.totalSpawnedEl.textContent = '0';
            this.performanceFPSEl.textContent = '60';
            return;
        }

        const stats = this.rainSystem.getStats();

        // Also get scene-level stats for cross-validation
        const sceneEntityCount = this.scene.getAllGameObjects().length;

        // Only log stats occasionally to avoid spam
        if (Date.now() % 1000 < 50) { // Log roughly once per second
            console.log('🌧️ Rain stats update:', stats);
            console.log(`📊 Scene entity count: ${sceneEntityCount}`);
        }

        // Use rain system stats (these should be working)
        this.activeEntitiesEl.textContent = stats.entityCount.toString();
        this.totalSpawnedEl.textContent = stats.totalSpawned.toString();
        this.performanceFPSEl.textContent = Math.round(stats.performanceFPS).toString();

        // Color-code performance
        const performanceColor =
            stats.performanceFPS >= 50 ? '#00ff00' :
                stats.performanceFPS >= 30 ? '#ffaa00' : '#ff4444';

        this.performanceFPSEl.style.color = performanceColor;
    }

    private showLoading(show: boolean): void {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = show ? 'block' : 'none';
        }
    }

    private showError(message: string): void {
        const errorEl = document.getElementById('error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    dispose(): void {
        if (this.statsAnimationId !== undefined) {
            cancelAnimationFrame(this.statsAnimationId);
        }

        if (this.rainSystem) {
            this.rainSystem.dispose();
        }

        // Note: Scene doesn't have dispose method yet
        // this.scene.dispose();
        // Stops the engine frame loop and releases GPU resources.
        void this.engine.deinit();
    }
}

// Initialize and start the demo
async function startDemo(): Promise<void> {
    try {
        const demo = new EnhancedRainDemo();
        await demo.init();

        // Handle cleanup on page unload
        window.addEventListener('beforeunload', () => {
            demo.dispose();
        });

        console.log('🎉 Enhanced Rain Demo ready!');
    } catch (error) {
        console.error('💥 Demo startup failed:', error);
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDemo);
} else {
    startDemo();
}
