// src/v2/test-enhanced-rain.ts
// Demo script for the enhanced rain system with multiple mesh types and colors

import { Scene } from '../../engine/scene-system';
import { WebGPURendererV2 } from '../../renderer/webgpu.renderer';
import { RainSystemV2, RainSystemConfig } from './rain-system';
import { RainEntityType } from './rain-entity-factory';
import { createSphereMesh, createCubeMesh, createGridMesh } from '../../renderer/mesh-utils';
import { GameObject } from '../../engine/gameobject';
import { MeshRenderer } from '../../engine/components';

class EnhancedRainDemo {
    private canvas: HTMLCanvasElement;
    private scene: Scene;
    private renderer: WebGPURendererV2;
    private rainSystem?: RainSystemV2;
    private lastTime = 0;
    private animationId?: number;

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
        this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }

        this.scene = new Scene();
        this.renderer = new WebGPURendererV2();

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

            // Initialize renderer
            await this.renderer.init(this.canvas);
            console.log('✅ WebGPU Renderer V2 initialized');

            // Initialize scene with renderer
            await this.scene.init(this.renderer);
            console.log('✅ Physics bridge initialized');

            // Register meshes with renderer
            const sphereMesh = createSphereMesh(0.5, 8); // Low-poly for performance
            const cubeMesh = createCubeMesh(1.0);
            const floorMesh = createGridMesh(20, 20);
            this.renderer.registerMesh('sphere', sphereMesh);
            this.renderer.registerMesh('cube', cubeMesh);
            this.renderer.registerMesh('grid', floorMesh);
            console.log('✅ Meshes registered');

            // Add floor to scene
            const gridFloor = new GameObject('grid-floor', 'Grid Floor');
            gridFloor.transform.setPosition(0, -2, 0); // Below other objects
            gridFloor.transform.setScale(1, 1, 1);

            const gridMeshRenderer = new MeshRenderer(
                'grid', 'default', 'lines',
                { x: 0.3, y: 0.3, z: 0.3, w: 1 } // Gray
            );
            gridFloor.addComponent(gridMeshRenderer);
            this.scene.addGameObject(gridFloor);
            console.log('⬜ Added gray grid floor at (0, -2, 0)');


            // Setup camera
            this.scene.camera.setPosition([0, 10, -15]);
            this.scene.camera.setTarget([0, 0, 0]);
            console.log('✅ Camera positioned');

            console.log('🎉 Enhanced Rain Demo initialized successfully!');
            this.showLoading(false);

            // Start render loop
            this.startRenderLoop();

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

    private startRenderLoop(): void {
        this.lastTime = performance.now();
        this.render();
    }

    private render = (): void => {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        try {
            // Update scene (includes WASM physics and render)
            this.scene.update(deltaTime);

            // Update stats
            this.updateStats();

        } catch (error) {
            console.error('❌ Render error:', error);
        }

        // Continue render loop
        this.animationId = requestAnimationFrame(this.render);
    };

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
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.rainSystem) {
            this.rainSystem.dispose();
        }

        // Note: Scene doesn't have dispose method yet
        // this.scene.dispose();
        this.renderer.dispose();
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
