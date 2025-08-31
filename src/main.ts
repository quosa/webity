// Main entry point for the bouncing ball demo
import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { BufferManager } from './buffer-manager.js';
import { AssetConfig, EngineError } from './types.js';

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
        bounds: { x: 5, y: 5, z: 5 }
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