// Main entry point for the bouncing ball demo
import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { BufferManager } from './buffer-manager.js';
import { AssetConfig, EngineError, PerformanceStats } from './types.js';
import { Scene } from './scene.js';
import { GameObject } from './gameobject.js';
import { Transform, RigidBody, MeshRenderer } from './components';
import { MeshType } from './mesh-types.js';

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

    // Initialize engine with physics configuration
    await engine.init({
      physics: {
        gravity: -9.8,
        friction: 0.1,
        bounds: { x: 5, y: 5, z: 5 },
        entropy: 0.001,
      }
    });

    console.log('Engine initialized successfully');

    // Load assets - need to generate cube mesh for rendering
    const assets: AssetConfig = {
      ball: {
        radius: 1.0,
        segments: 16
      },
      cube: {
        size: 1.0
      }
    };

    await engine.loadAssets(assets);
    console.log('Assets loaded successfully');

    try {
      // Clear existing entities first
      // engine.clearAllBalls();

      // Create scene and connect to engine's WASM exports
      const scene = new Scene('CubeStackDemo');
      const wasmExports = (engine as any).wasm; // Access private wasm member
      if (wasmExports) {
        scene.setEngine(engine);
      }

      // Configure entropy from engine settings
      scene.setEntropy(engine.getEntropy());

      const cubeObject = new GameObject('Demo Cube');

      // Position cube on left side
      const transform = cubeObject.addComponent(Transform);
      transform.setPosition(-3, 3, 0);  // Left side, elevated
      transform.setScale(1, 1, 1);

      // Add physics
      const rigidBody = cubeObject.addComponent(RigidBody);
      rigidBody.mass = 2.0;  // Lighter for better physics
      rigidBody.friction = 0.3;

      // Add cube mesh rendering
      const renderer = cubeObject.addComponent(MeshRenderer);
      renderer.setMeshType(MeshType.CUBE);
      renderer.setSize(1);

      // Add to scene
      scene.addGameObject(cubeObject);



      const sphereObject = new GameObject('Demo Sphere');

      // Position sphere on right side
      const sTransform = sphereObject.addComponent(Transform);
      sTransform.setPosition(3, 3, 0);  // Right side, same height as cube
      sTransform.setScale(1, 1, 1);

      // Add physics
      const sRigidBody = sphereObject.addComponent(RigidBody);
      sRigidBody.mass = 1.0;
      sRigidBody.friction = 0.3;

      // Add sphere mesh rendering
      const sRenderer = sphereObject.addComponent(MeshRenderer);
      sRenderer.setMeshType(MeshType.SPHERE);
      sRenderer.setRadius(1);

      // Add to scene
      scene.addGameObject(sphereObject);

      // Start the scene to spawn WASM entities
      scene.awake();
      scene.start();

      console.log('🏗️ Demo scene created! GameObject system active');
      console.log(scene.toString());
      console.log(`🎾 Entity count after GameObject scene: ${engine.getWasmEntityCount()}`);
    } catch (error) {
      console.error('Failed to create demo scene:', error);
      showError(`GameObject scene error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Start the game loop
    engine.start();
    console.log('Game loop started - use WASD to move the ball!');

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

    // Set up performance monitoring
    engine.setPerformanceCallback((stats) => {
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
        showError('WebGPU is not supported in this browser. Please use Chrome 113+, Edge 113+, or Firefox with WebGPU enabled.');
      } else if (error.message.includes('Canvas')) {
        showError('Canvas element not found. Make sure the HTML page has a canvas with id="canvas".');
      } else if (error.message.includes('WASM')) {
        showError('Failed to load WebAssembly module. Make sure game_engine.wasm is available.');
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
  const performanceColor = stats.averageFPS >= 50 ? '#44ff44' :
    stats.averageFPS >= 30 ? '#ffaa00' : '#ff4444';

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
