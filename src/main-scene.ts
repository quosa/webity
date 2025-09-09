// Main entry point for the rotating ball demo
import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { BufferManager } from './buffer-manager.js';
import { AssetConfig, EngineError, PerformanceStats } from './types.js';

// Test function: Direct WASM rotation bypassing all engine systems
function testDirectWasmRotation(engine: Engine): void {
    console.log('🧪 Testing direct WASM rotation bypass...');

    const wasm = (engine as any).wasm;
    if (!wasm) {
        console.log('❌ No WASM module available');
        return;
    }

    // Spawn a test ball directly at WASM level - using same radius as asset generation
    const testEntityIndex = wasm.spawn_entity_with_mesh(0, 5, -5, 7.5, 0); // Sphere at (0, 5, -5) with radius 7.5 (matching asset)
    console.log(
        `🧪 Created direct WASM test entity ${testEntityIndex} at (0, 5, -5) with radius 7.5 (matching asset generation)`
    );

    // Test if set_entity_position actually works
    wasm.set_entity_position(testEntityIndex, 0, 2, -10); // Much closer: x=0, y=2, z=-10
    console.log(`🧪 Moved entity ${testEntityIndex} to (0, 2, -10) for easier debugging`);

    // Test multiple position changes to see if any work
    setTimeout(() => {
        wasm.set_entity_position(testEntityIndex, -5, 0, -3); // Far left
        console.log(`🧪 TEST: Moved entity ${testEntityIndex} to LEFT (-5, 0, -3)`);
    }, 1000);

    setTimeout(() => {
        wasm.set_entity_position(testEntityIndex, 5, 0, -3); // Far right
        console.log(`🧪 TEST: Moved entity ${testEntityIndex} to RIGHT (5, 0, -3)`);
    }, 2000);

    setTimeout(() => {
        wasm.set_entity_position(testEntityIndex, 0, 10, -3); // High up
        console.log(`🧪 TEST: Moved entity ${testEntityIndex} UP (0, 10, -3)`);
    }, 3000);

    // Set up a rotation animation loop that directly manipulates WASM
    let rotationX = 0,
        rotationY = 0,
        rotationZ = 0;

    const rotateTestBall = () => {
        // Update rotation angles
        rotationX += 1; // degrees per frame
        rotationY += 2;
        rotationZ += 0.5;

        // Check if set_entity_rotation exists and use it
        if (typeof wasm.set_entity_rotation === 'function') {
            const rx = (rotationX * Math.PI) / 180;
            const ry = (rotationY * Math.PI) / 180;
            const rz = (rotationZ * Math.PI) / 180;
            wasm.set_entity_rotation(testEntityIndex, rx, ry, rz);

            if (rotationY % 60 === 0) {
                // Log every 60 degrees
                console.log(
                    `🧪 Direct WASM rotation: (${rotationX}°, ${rotationY}°, ${rotationZ}°)`
                );
            }
        } else {
            console.log('❌ WASM set_entity_rotation function not available');
            return; // Stop the animation loop
        }

        // Continue animation
        requestAnimationFrame(rotateTestBall);
    };

    // Start the rotation animation
    requestAnimationFrame(rotateTestBall);
}

// Show loading indicator
function showLoading(show: boolean): void {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
}

// Show error message
function showError(message: string): void {
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

// Hide error message
function hideError(): void {
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

// Main scene function
async function startScene(): Promise<void> {
    try {
        showLoading(true);
        hideError();

        console.log('Starting WebAssembly Scene Demo...');

        // Explicit dependency graph - clear and testable during development
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) {
            throw new EngineError('Canvas with id "canvas" not found', 'CANVAS_NOT_FOUND');
        }

        const bufferManager = new BufferManager();
        const renderer = new Renderer(bufferManager);
        const input = new InputManager();
        const engine = new Engine(canvas, renderer, input, bufferManager);

        // Initialize engine with physics configuration - NORMAL GRAVITY so ball settles on floor
        await engine.init({
            physics: {
                gravity: -9.8, // Normal gravity - ball will settle on floor
                friction: 0.3, // Some friction for stability
                bounds: { x: 10, y: 10, z: 10 }, // Normal bounds
                entropy: 0.001, // Small randomness
            },
        });

        console.log('Engine initialized successfully');

        // Load assets - LARGE high detail sphere with many segments for smooth rotation
        const assets: AssetConfig = {
            ball: {
                radius: 7.5, // 5x bigger radius (1.5 * 5 = 7.5)
                segments: 32, // High segment count for smooth sphere
            },
            cube: {
                size: 1.0,
            },
        };

        await engine.loadAssets(assets);
        console.log('Assets loaded successfully');

        // COMMENTED OUT: Complex scene/GameObject system to focus on pure WASM test
        /*
    try {
      // Create scene for rotating ball demo
      const scene = new Scene('RotatingBallDemo');
      const wasmExports = (engine as any).wasm; // Access private wasm member
      if (wasmExports) {
        scene.setEngine(engine);
      }

      // Configure physics
      scene.setEntropy(0.001);

      // Create the rotating ball GameObject using our custom class
      rotatingBall = new RotatingBall('BigRotatingBall', 7.5, { x: 0, y: 0, z: -10 }); // Start closer to camera

      // Add to scene
      scene.addGameObject(rotatingBall);

      // Connect the scene to the engine so it gets updated
      engine.setCurrentScene(scene);

      // Start the scene to spawn WASM entities
      scene.awake();
      scene.start();

      console.log('🎾 Big rotating ball scene created! Custom GameObject with rotation logic');
      console.log(rotatingBall.toString());
      console.log(`🎾 Entity count after GameObject scene: ${engine.getWasmEntityCount()}`);
    } catch (error) {
      console.error('Failed to create rotating ball scene:', error);
      showError(`GameObject scene error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    */
        console.log('🧪 Scene/GameObject system disabled - testing pure WASM rotation only');

        // Test: Create a simple rotating ball directly in WASM (bypass all engine cruft)
        testDirectWasmRotation(engine);

        // Start the game loop
        engine.start();
        console.log('Game loop started - Rotating ball demo with WASD camera controls!');

        // Add stop/start button functionality
        const stopButton = document.getElementById('stopButton') as HTMLButtonElement;
        const startButton = document.getElementById('startButton') as HTMLButtonElement;

        stopButton?.addEventListener('click', () => {
            engine.stop();
            console.log('🛑 Engine stopped for debugging');
            stopButton.style.display = 'none';
            startButton.style.display = 'inline-block';
        });

        startButton?.addEventListener('click', () => {
            engine.start();
            console.log('▶️ Engine restarted');
            startButton.style.display = 'none';
            stopButton.style.display = 'inline-block';
        });

        // Set up performance monitoring (rotation now handled by RotatingBall GameObject)
        engine.setPerformanceCallback(stats => {
            updatePerformanceDisplay(stats);
        });

        showLoading(false);

        // Handle cleanup on page unload
        window.addEventListener('beforeunload', () => {
            console.log('Cleaning up engine...');
            engine.dispose();
        });

        // Handle page visibility changes to pause/resume
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                engine.stop();
                console.log('Game paused (tab hidden)');
            } else {
                engine.start();
                console.log('Game resumed (tab visible)');
            }
        });

        // Add some helpful info to the page
        updateControlsInfo();
    } catch (error) {
        console.error('Failed to start scene demo:', error);
        showLoading(false);

        // Show user-friendly error message
        if (error instanceof Error) {
            if (error.message.includes('WebGPU')) {
                showError(
                    'WebGPU is not supported in this browser. Please use Chrome 113+, Edge 113+, or Firefox with WebGPU enabled.'
                );
            } else if (error.message.includes('Canvas')) {
                showError(
                    'Canvas element not found. Make sure the HTML page has a canvas with id="canvas".'
                );
            } else if (error.message.includes('WASM')) {
                showError(
                    'Failed to load WebAssembly module. Make sure game_engine.wasm is available.'
                );
            } else {
                showError(`Engine initialization failed: ${error.message}`);
            }
        } else {
            showError('An unknown error occurred while starting the demo.');
        }
    }
}

// Update performance display
function updatePerformanceDisplay(stats: PerformanceStats): void {
    const currentFPS = document.getElementById('currentFPS');
    const averageFPS = document.getElementById('averageFPS');
    const frameTime = document.getElementById('frameTime');
    const entityCount = document.getElementById('entityCount');
    const vertexCount = document.getElementById('vertexCount');
    const wasmTime = document.getElementById('wasmTime');

    // Use average FPS for smoother display, round to whole numbers for readability
    if (currentFPS) currentFPS.textContent = Math.round(stats.averageFPS).toString();
    if (averageFPS) averageFPS.textContent = stats.averageFPS.toFixed(1);
    if (frameTime) frameTime.textContent = stats.frameTime.toFixed(1);
    if (entityCount) entityCount.textContent = stats.entityCount.toString();
    if (vertexCount) vertexCount.textContent = stats.vertexCount.toString();
    if (wasmTime) wasmTime.textContent = Math.round(stats.wasmTime).toString();

    // Color code performance based on average FPS (more stable than instantaneous)
    const performanceColor =
        stats.averageFPS >= 50 ? '#44ff44' : stats.averageFPS >= 30 ? '#ffaa00' : '#ff4444';

    if (currentFPS) currentFPS.style.color = performanceColor;
    if (averageFPS) averageFPS.style.color = performanceColor;
}

// Update controls information
function updateControlsInfo(): void {
    const infoElements = document.querySelectorAll('.info');
    infoElements.forEach(el => {
        if (el.textContent?.includes('Built with')) {
            el.innerHTML = `
        Built with TypeScript + WebGPU + Zig WebAssembly<br>
        <small>Physics: Gravity, collision detection, and boundary enforcement</small>
      `;
        }
    });
}

// Start demo when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startScene);
} else {
    startScene();
}
