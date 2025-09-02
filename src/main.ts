// Main entry point for the bouncing ball demo
import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { BufferManager } from './buffer-manager.js';
import { AssetConfig, EngineError, PerformanceStats } from './types.js';
import { createCubeStackScene, createMixedScene } from '../gameobject-example.js';
import { Scene } from './scene.js';
import { 
  createSingleBallScene, 
  createCollisionTestScene, 
  createFancyDemoScene,
  createRainScene
} from './scene-presets.js';
import { RainSystem } from './rain-system.js';

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

    // Create default single ball scene so screen isn't blank on startup
    const defaultScene = new Scene('DefaultScene');
    defaultScene.setEngine(engine);
    defaultScene.setEntropy(engine.getEntropy());
    
    createSingleBallScene(defaultScene);
    defaultScene.awake();
    defaultScene.start();
    
    console.log('Default single ball scene created');

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

    // Simplified scene preset functionality - 5 focused demos
    const fancyDemoButton = document.getElementById('fancyDemoButton') as HTMLButtonElement;
    fancyDemoButton?.addEventListener('click', () => {
      const scene = new Scene('FancyDemo');
      scene.setEngine(engine);
      scene.setEntropy(engine.getEntropy());
      
      createFancyDemoScene(scene);
      scene.awake();
      scene.start();
      
      console.log(`🎪 Fancy demo scene activated! ${engine.getWasmEntityCount()} entities total`);
    });

    // Essential physics test scenes
    const singleBallButton = document.getElementById('singleBallButton') as HTMLButtonElement;
    singleBallButton?.addEventListener('click', () => {
      const scene = new Scene('SingleBallTest');
      scene.setEngine(engine);
      scene.setEntropy(engine.getEntropy());
      
      createSingleBallScene(scene);
      scene.awake();
      scene.start();
      
      console.log(`🎯 Single ball test: ${engine.getWasmEntityCount()} ball for physics testing`);
    });

    const collisionTestButton = document.getElementById('collisionTestButton') as HTMLButtonElement;
    collisionTestButton?.addEventListener('click', () => {
      const scene = new Scene('CollisionTest');
      scene.setEngine(engine);
      scene.setEntropy(engine.getEntropy());
      
      createCollisionTestScene(scene);
      scene.awake();
      scene.start();
      
      console.log(`⚡ Collision test: ${engine.getWasmEntityCount()} balls for collision testing`);
    });

    // Rain scene with encapsulated RainSystem
    let activeRainSystem: RainSystem | null = null;
    const rainButton = document.getElementById('rainButton') as HTMLButtonElement;
    
    rainButton?.addEventListener('click', () => {
      if (activeRainSystem && activeRainSystem.isActive()) {
        // Stop existing rain
        activeRainSystem.stop();
        activeRainSystem = null;
        rainButton.textContent = 'Start Rain Scene';
        console.log('🌧️ Rain scene stopped');
      } else {
        // Start new rain scene
        const scene = new Scene('RainScene');
        scene.setEngine(engine);
        scene.setEntropy(engine.getEntropy());
        
        activeRainSystem = createRainScene(scene, engine, 1.5); // Default intensity
        scene.awake();
        scene.start();
        
        rainButton.textContent = 'Stop Rain Scene';
        console.log(`🌧️ Rain scene started with ${activeRainSystem.getCurrentBallCount()} initial balls`);
      }
    });

    // Add GameObject scene controls
    const cubeStackButton = document.getElementById('cubeStackButton') as HTMLButtonElement;
    const mixedSceneButton = document.getElementById('mixedSceneButton') as HTMLButtonElement;
    cubeStackButton?.addEventListener('click', () => {
      try {
        // Create scene with proper Engine integration
        const scene = new Scene('CubeStackDemo');
        scene.setEngine(engine);
        scene.setEntropy(engine.getEntropy());

        createCubeStackScene(scene);

        // Start the scene to spawn WASM entities
        scene.awake();
        scene.start();

        console.log('🏗️ Cube stack scene created! GameObject system active');
        console.log(scene.toString());
        console.log(`🎾 Entity count after GameObject scene: ${engine.getWasmEntityCount()}`);
      } catch (error) {
        console.error('Failed to create cube stack scene:', error);
        showError(`GameObject scene error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    mixedSceneButton?.addEventListener('click', () => {
      try {
        // Create scene with proper Engine integration
        const scene = new Scene('MixedDemo');
        scene.setEngine(engine);
        scene.setEntropy(engine.getEntropy());

        createMixedScene(scene);

        // Start the scene to spawn WASM entities
        scene.awake();
        scene.start();

        console.log('🔗 Mixed scene created! GameObject system active');
        console.log(scene.toString());
        console.log(`🎾 Entity count after GameObject scene: ${engine.getWasmEntityCount()}`);
      } catch (error) {
        console.error('Failed to create mixed scene:', error);
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
  const floatingIndex = engine.getDebugFloatingEntityIndex();
  const debugDisplay = document.getElementById('debug-display');

  if (floatingIndex !== 10000) { // MAX_ENTITIES is 10000, used as sentinel
    const posY = engine.getWasmEntityPosition(floatingIndex)?.y || 0;
    const velY = engine.getWasmEntityVelocityY(floatingIndex);
    const totalEntities = engine.getWasmEntityCount();

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
    engine.clearDebugFloatingEntity();
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