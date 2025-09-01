// Main entry point for the bouncing ball demo
import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { BufferManager } from './buffer-manager.js';
import { AssetConfig, EngineError, PerformanceStats } from './types.js';
import { createCubeStackScene, createMixedScene } from '../gameobject-example.js';
import { Scene } from './scene.js';

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

// Main demo function
async function startDemo(): Promise<void> {
  try {
    showLoading(true);
    hideError();

    console.log('Starting WebAssembly Ball Physics Demo...');

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
        entropy: 0.001 // Small random offset for breaking perfect alignment
      }
    });

    console.log('Engine initialized successfully');

    // Load ball assets
    const assets: AssetConfig = {
      ball: {
        segments: 8, // Very low segment count for debugging
        radius: 0.5
      }
    };

    await engine.loadAssets(assets);
    console.log('Assets loaded successfully');

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

    // Add scene preset button functionality
    const multiBallButton = document.getElementById('multiBallButton') as HTMLButtonElement;
    multiBallButton?.addEventListener('click', () => {
      engine.spawnMultiBallScene();
      console.log(`🎾 Multi-ball scene spawned! ${engine.getEntityCount()} balls total`);
    });

    const gridSceneButton = document.getElementById('gridSceneButton') as HTMLButtonElement;
    gridSceneButton?.addEventListener('click', () => {
      engine.spawnGridScene(3, 1.5, 8);
      console.log(`⬜ Grid formation activated! ${engine.getEntityCount()} balls total`);
    });

    const circleSceneButton = document.getElementById('circleSceneButton') as HTMLButtonElement;
    circleSceneButton?.addEventListener('click', () => {
      engine.spawnCircleScene(3, 6, 8);
      console.log(`⭕ Circle formation activated! ${engine.getEntityCount()} balls total`);
    });

    const chaosSceneButton = document.getElementById('chaosSceneButton') as HTMLButtonElement;
    chaosSceneButton?.addEventListener('click', () => {
      engine.spawnChaosScene(8);
      console.log(`💥 Chaos mode activated! ${engine.getEntityCount()} balls total`);
    });

    // Add simple test scenes for debugging physics
    const singleBallButton = document.getElementById('singleBallButton') as HTMLButtonElement;
    singleBallButton?.addEventListener('click', () => {
      engine.clearAllBalls();
      // Single ball dropped from Y=2 to test settling
      const wasmExports = (engine as any).wasm;
      if (wasmExports) {
        wasmExports.spawn_entity(0, 2, 0, 0.5);
        console.log('🎯 Single ball test: 1 ball at Y=2, should settle on floor');
      }
    });

    const twoBallButton = document.getElementById('twoBallButton') as HTMLButtonElement;
    twoBallButton?.addEventListener('click', () => {
      engine.clearAllBalls();
      // Two balls stacked with slight horizontal offset so they separate
      const wasmExports = (engine as any).wasm;
      if (wasmExports) {
        wasmExports.spawn_entity(0, 1, 0, 0.5);        // Bottom ball at center
        wasmExports.spawn_entity(0.001, 2.01, 0, 0.5);   // Top ball slightly offset horizontally
        console.log('⚡ Two ball test: 2 balls with slight offset, should separate and settle');
      }
    });

    const separatedBallsButton = document.getElementById('separatedBallsButton') as HTMLButtonElement;
    separatedBallsButton?.addEventListener('click', () => {
      engine.clearAllBalls();
      // Two balls clearly separated (no collision interaction)
      const wasmExports = (engine as any).wasm;
      if (wasmExports) {
        wasmExports.spawn_entity(-2, 2, 0, 0.5);  // Left ball
        wasmExports.spawn_entity(2, 2, 0, 0.5);   // Right ball
        console.log('🎯 Separated balls test: 2 balls far apart, should settle independently');
      }
    });

    // Add rain scene controls
    const rainIntensitySlider = document.getElementById('rainIntensity') as HTMLInputElement;
    const rainIntensityValue = document.getElementById('rainIntensityValue') as HTMLSpanElement;
    const startRainButton = document.getElementById('startRainButton') as HTMLButtonElement;
    const stopRainButton = document.getElementById('stopRainButton') as HTMLButtonElement;

    // Update rain intensity display
    rainIntensitySlider?.addEventListener('input', () => {
      const intensity = parseFloat(rainIntensitySlider.value);
      if (rainIntensityValue) {
        rainIntensityValue.textContent = intensity.toFixed(1);
      }
    });

    startRainButton?.addEventListener('click', () => {
      const intensity = parseFloat(rainIntensitySlider.value);
      engine.startRainScene(intensity);
      console.log(`🌧️ Rain scene started with intensity ${intensity}`);
      startRainButton.disabled = true;
      stopRainButton.disabled = false;
    });

    stopRainButton?.addEventListener('click', () => {
      engine.stopRainScene();
      console.log('🌧️ Rain scene stopped');
      startRainButton.disabled = false;
      stopRainButton.disabled = true;
    });

    // Add GameObject scene controls
    const cubeStackButton = document.getElementById('cubeStackButton') as HTMLButtonElement;
    const mixedSceneButton = document.getElementById('mixedSceneButton') as HTMLButtonElement;
    const gameObjectFactoryButton = document.getElementById('gameObjectFactoryButton') as HTMLButtonElement;

    cubeStackButton?.addEventListener('click', () => {
      try {
        // Clear existing entities first
        engine.clearAllBalls();

        // Create scene and connect to engine's WASM exports
        const scene = new Scene('CubeStackDemo');
        const wasmExports = (engine as any).wasm; // Access private wasm member
        if (wasmExports) {
          scene.setWasmExports(wasmExports);
        }

        // Configure entropy from engine settings
        scene.setEntropy(engine.getEntropy());

        createCubeStackScene(scene);

        // Start the scene to spawn WASM entities
        scene.awake();
        scene.start();

        console.log('🏗️ Cube stack scene created! GameObject system active');
        console.log(scene.toString());
        console.log(`🎾 Entity count after GameObject scene: ${engine.getEntityCount()}`);
      } catch (error) {
        console.error('Failed to create cube stack scene:', error);
        showError(`GameObject scene error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    mixedSceneButton?.addEventListener('click', () => {
      try {
        // Clear existing entities first
        engine.clearAllBalls();

        // Create scene and connect to engine's WASM exports
        const scene = new Scene('MixedDemo');
        const wasmExports = (engine as any).wasm; // Access private wasm member
        if (wasmExports) {
          scene.setWasmExports(wasmExports);
        }

        // Configure entropy from engine settings
        scene.setEntropy(engine.getEntropy());

        createMixedScene(scene);

        // Start the scene to spawn WASM entities
        scene.awake();
        scene.start();

        console.log('🔗 Mixed scene created! GameObject system active');
        console.log(scene.toString());
        console.log(`🎾 Entity count after GameObject scene: ${engine.getEntityCount()}`);
      } catch (error) {
        console.error('Failed to create mixed scene:', error);
        showError(`GameObject scene error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    gameObjectFactoryButton?.addEventListener('click', () => {
      try {
        // Clear existing entities first
        engine.clearAllBalls();

        // For the factory example, we need to modify it to accept a scene parameter
        // For now, just show a warning that this needs WASM integration
        console.log('🎮 GameObject factory examples created!');
        console.warn('⚠️ GameObject Factory button needs integration work - createGameObjectExamples() needs WASM connection');
        showError('GameObject Factory needs integration work - check console for details');
      } catch (error) {
        console.error('Failed to create GameObject examples:', error);
        showError(`GameObject scene error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Set up performance monitoring with floating entity debugging
    engine.setPerformanceCallback((stats) => {
      updatePerformanceDisplay(stats);
      checkFloatingEntities(engine);
    });

    // Create debug display for floating entities
    const debugDisplay = document.createElement('div');
    debugDisplay.id = 'debug-display';
    debugDisplay.style.cssText = 'position: absolute; top: 120px; left: 10px; color: red; font-family: monospace; font-size: 12px; background: rgba(0,0,0,0.8); padding: 5px; border-radius: 3px; max-width: 300px;';
    document.body.appendChild(debugDisplay);

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
    console.error('Failed to start demo:', error);
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

// Check for floating entities and display debug info
function checkFloatingEntities(engine: Engine): void {
  const wasmExports = (engine as any).wasm;
  if (!wasmExports) return;

  const floatingIndex = wasmExports.get_debug_floating_entity_index();
  const debugDisplay = document.getElementById('debug-display');

  if (floatingIndex !== 10000) { // MAX_ENTITIES is 10000, used as sentinel
    const posY = wasmExports.get_entity_position_y(floatingIndex);
    const velY = wasmExports.get_entity_velocity_y(floatingIndex);
    const totalEntities = wasmExports.get_entity_count();

    if (debugDisplay) {
      debugDisplay.innerHTML = `
        🐛 FLOATING ENTITY DETECTED!<br>
        Entity #${floatingIndex} / ${totalEntities}<br>
        Position Y: ${posY.toFixed(3)}<br>
        Velocity Y: ${velY.toFixed(6)}<br>
        Floor Level: -7.5<br>
        <small>Should be falling due to gravity</small>
      `;
      debugDisplay.style.display = 'block';
    }

    // Log to console for detailed analysis
    console.warn(`🐛 Floating entity detected: #${floatingIndex} at Y=${posY.toFixed(3)}, velY=${velY.toFixed(6)}`);

    // Clear the flag so we don't spam
    wasmExports.clear_debug_floating_entity();
  } else {
    // No floating entities detected
    if (debugDisplay) {
      debugDisplay.style.display = 'none';
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
  document.addEventListener('DOMContentLoaded', startDemo);
} else {
  startDemo();
}