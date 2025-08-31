// Engine scenario tests - testing complex interactions and scene management
import { Engine } from '../src/engine.js';
import { Renderer } from '../src/renderer.js';
import { InputManager } from '../src/input.js';
import { BufferManager } from '../src/buffer-manager.js';
import { EngineError } from '../src/types.js';
import { setupWebGPUTestEnvironment } from './utils/dom-mocks.js';

// Helper function to create engine with all dependencies
function createTestEngine(): Engine {
  const bufferManager = new BufferManager();
  const renderer = new Renderer(bufferManager);
  const input = new InputManager();
  const mockCanvas = document.createElement('canvas');
  return new Engine(mockCanvas, renderer, input, bufferManager);
}

describe('Engine Scenarios', () => {
  let engine: Engine;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up WebGPU test environment
    setupWebGPUTestEnvironment();
  });

  afterEach(() => {
    // Clean up engine if it exists
    if (engine) {
      engine.dispose();
    }
  });

  describe('Scene Management', () => {
    beforeEach(async () => {
      engine = createTestEngine();
      await engine.init();
      await engine.loadAssets({ ball: { segments: 8 } });
    });

    it('should spawn and manage multiple balls in multi-ball scene', () => {
      const initialCount = engine.getEntityCount();
      
      engine.spawnMultiBallScene();
      const finalCount = engine.getEntityCount();
      
      expect(finalCount).toBeGreaterThan(initialCount);
      expect(finalCount).toBeGreaterThanOrEqual(4); // Multi-ball scene spawns 4 balls
    });

    it('should create grid formation in grid scene', () => {
      engine.clearAllBalls();
      const initialCount = engine.getEntityCount();
      
      engine.spawnGridScene(3, 1.5, 8);
      const finalCount = engine.getEntityCount();
      
      expect(finalCount).toBeGreaterThan(initialCount);
      expect(finalCount).toBeLessThanOrEqual(9); // 3x3 grid max
    });

    it('should create circular formation in circle scene', () => {
      engine.clearAllBalls();
      const initialCount = engine.getEntityCount();
      
      engine.spawnCircleScene(3, 6, 8);
      const finalCount = engine.getEntityCount();
      
      expect(finalCount).toBeGreaterThan(initialCount);
      expect(finalCount).toBeLessThanOrEqual(6); // Max 6 balls requested
    });

    it('should create random chaos scene', () => {
      engine.clearAllBalls();
      const initialCount = engine.getEntityCount();
      
      engine.spawnChaosScene(8);
      const finalCount = engine.getEntityCount();
      
      expect(finalCount).toBeGreaterThan(initialCount);
      expect(finalCount).toBeLessThanOrEqual(8); // Max 8 balls requested
    });

    it('should handle scene spawning with different parameters', () => {
      // Test grid with different sizes
      engine.clearAllBalls();
      engine.spawnGridScene(2, 2.0, 5);
      expect(engine.getEntityCount()).toBeLessThanOrEqual(4); // 2x2 grid

      engine.clearAllBalls();
      engine.spawnGridScene(4, 1.0, 10);
      expect(engine.getEntityCount()).toBeLessThanOrEqual(10); // Limited by max entities
    });

    it('should clear all balls and reset entity count', () => {
      engine.spawnMultiBallScene();
      expect(engine.getEntityCount()).toBeGreaterThan(0);
      
      engine.clearAllBalls();
      expect(engine.getEntityCount()).toBe(0);
    });
  });

  describe('Ball Spawning', () => {
    beforeEach(async () => {
      engine = createTestEngine();
      await engine.init();
      await engine.loadAssets({ ball: { segments: 8 } });
    });

    it('should spawn individual balls at specific positions', () => {
      const initialCount = engine.getEntityCount();
      
      const ballId = engine.spawnBall(1.0, 2.0, 3.0, 0.8);
      
      expect(typeof ballId).toBe('number');
      expect(engine.getEntityCount()).toBe(initialCount + 1);
    });

    it('should spawn balls with default radius when not specified', () => {
      const initialCount = engine.getEntityCount();
      
      const ballId = engine.spawnBall(0, 0, 0); // No radius specified
      
      expect(typeof ballId).toBe('number');
      expect(engine.getEntityCount()).toBe(initialCount + 1);
    });

    it('should handle spawning when engine not initialized', () => {
      const uninitializedEngine = createTestEngine();
      
      expect(() => {
        uninitializedEngine.spawnBall(0, 0, 0);
      }).toThrow(EngineError);
      expect(() => {
        uninitializedEngine.spawnBall(0, 0, 0);
      }).toThrow('Engine not initialized');
    });
  });

  describe('Physics Configuration', () => {
    beforeEach(async () => {
      engine = createTestEngine();
      await engine.init();
    });

    it('should set physics parameters', () => {
      expect(() => {
        engine.setPhysicsParameters(-15.0, 0.95, 0.9);
      }).not.toThrow();
    });

    it('should set world size', () => {
      expect(() => {
        engine.setWorldSize(12);
      }).not.toThrow();
    });

    it('should handle physics configuration with default values', () => {
      expect(() => {
        engine.setPhysicsParameters(); // All default values
      }).not.toThrow();
    });

    it('should handle physics configuration when engine not initialized', () => {
      const uninitializedEngine = createTestEngine();
      
      // Should not throw - these methods check if wasm exists
      expect(() => {
        uninitializedEngine.setPhysicsParameters(-10, 0.8, 0.7);
      }).not.toThrow();
      
      expect(() => {
        uninitializedEngine.setWorldSize(15);
      }).not.toThrow();
    });
  });

  describe('Game Loop Management', () => {
    beforeEach(async () => {
      engine = createTestEngine();
      await engine.init();
      await engine.loadAssets({ ball: { segments: 8 } });
    });

    it('should start and stop game loop', () => {
      expect(() => engine.start()).not.toThrow();
      expect(() => engine.stop()).not.toThrow();
    });

    it('should handle multiple start/stop cycles', () => {
      engine.start();
      engine.stop();
      engine.start();
      engine.stop();
      
      // Should not throw or cause issues
      expect(true).toBe(true);
    });

    it('should handle stop when not started', () => {
      expect(() => engine.stop()).not.toThrow();
    });
  });

  describe('Complex Scenarios', () => {
    beforeEach(async () => {
      engine = createTestEngine();
      await engine.init();
      await engine.loadAssets({ ball: { segments: 16 } });
    });

    it('should handle scene transitions', () => {
      // Start with multi-ball scene
      engine.spawnMultiBallScene();
      const multiBallCount = engine.getEntityCount();
      
      // Switch to grid scene
      engine.clearAllBalls();
      engine.spawnGridScene(3, 2.0, 10);
      const gridCount = engine.getEntityCount();
      
      // Switch to chaos scene
      engine.clearAllBalls();
      engine.spawnChaosScene(5);
      const chaosCount = engine.getEntityCount();
      
      expect(multiBallCount).toBeGreaterThan(0);
      expect(gridCount).toBeGreaterThan(0);
      expect(chaosCount).toBeGreaterThan(0);
    });

    it('should handle configuration changes during gameplay', () => {
      engine.spawnMultiBallScene();
      engine.start();
      
      // Change physics during gameplay
      engine.setPhysicsParameters(-20.0, 0.8, 1.0);
      engine.setWorldSize(15);
      
      // Should not crash
      engine.stop();
      expect(true).toBe(true);
    });

    it('should handle asset loading with different configurations', async () => {
      // Test with low segment count
      await engine.loadAssets({ ball: { segments: 4, radius: 0.3 } });
      engine.spawnBall(0, 0, 0);
      
      // Test with high segment count
      await engine.loadAssets({ ball: { segments: 32, radius: 1.2 } });
      engine.spawnBall(1, 1, 1);
      
      expect(engine.getEntityCount()).toBeGreaterThan(0);
    });

    it('should handle maximum entity scenarios', () => {
      // Try to spawn many balls to test limits
      for (let i = 0; i < 15; i++) {
        try {
          engine.spawnBall(i, 0, 0);
        } catch (error) {
          // Expected when hitting entity limits
        }
      }
      
      const finalCount = engine.getEntityCount();
      expect(finalCount).toBeGreaterThan(0);
      expect(finalCount).toBeLessThanOrEqual(10); // MAX_ENTITIES limit
    });
  });

  describe('Error Handling', () => {
    it('should handle operations on uninitialized engine', () => {
      const uninitializedEngine = createTestEngine();
      
      expect(() => uninitializedEngine.start()).toThrow(EngineError);
      expect(() => uninitializedEngine.spawnBall(0, 0, 0)).toThrow(EngineError);
      
      // clearAllBalls() returns early when uninitialized (doesn't throw)
      expect(() => uninitializedEngine.clearAllBalls()).not.toThrow();
    });

    it('should handle asset loading on uninitialized engine', async () => {
      const uninitializedEngine = createTestEngine();
      
      await expect(uninitializedEngine.loadAssets({ ball: { segments: 8 } }))
        .rejects.toThrow(EngineError);
    });

    it('should handle disposal gracefully', () => {
      engine = createTestEngine();
      
      // Should not throw even when not initialized
      expect(() => engine.dispose()).not.toThrow();
      
      // Should not throw when called multiple times
      expect(() => engine.dispose()).not.toThrow();
    });
  });

  describe('Initialization with Configuration', () => {
    it('should initialize with physics configuration', async () => {
      engine = createTestEngine();
      
      const config = {
        physics: {
          gravity: -12.0,
          friction: 0.2,
          bounds: { x: 6, y: 6, z: 6 }
        }
      };
      
      await expect(engine.init(config)).resolves.toBeUndefined();
    });

    it('should initialize without configuration', async () => {
      engine = createTestEngine();
      
      await expect(engine.init()).resolves.toBeUndefined();
    });

    it('should handle partial physics configuration', async () => {
      engine = createTestEngine();
      
      const config = {
        physics: {
          gravity: -15.0
          // Missing friction and bounds - should use defaults
        }
      };
      
      await expect(engine.init(config)).resolves.toBeUndefined();
    });
  });
});