// Engine scenario tests - testing complex interactions and scene management
import { Engine } from '../src/engine.js';
import { Renderer } from '../src/renderer.js';
import { InputManager } from '../src/input.js';
import { BufferManager } from '../src/buffer-manager.js';
import { EngineError, ENGINE_CONSTANTS } from '../src/types.js';
import { Scene } from '../src/scene.js';
import { 
  createSingleBallScene,
  createCollisionTestScene,
  createFancyDemoScene
} from '../src/scene-presets.js';
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

    it('should create single ball scene', () => {
      const scene = new Scene('TestScene');
      scene.setEngine(engine);
      scene.setEntropy(engine.getEntropy());
      
      const initialCount = engine.getWasmEntityCount();
      
      createSingleBallScene(scene);
      scene.awake();
      scene.start();
      
      const finalCount = engine.getWasmEntityCount();
      expect(finalCount).toBeGreaterThan(initialCount);
      expect(finalCount).toBe(initialCount + 1); // Single ball scene spawns 1 ball
    });

    it('should create collision test scene', () => {
      const scene = new Scene('CollisionTest');
      scene.setEngine(engine);
      scene.setEntropy(engine.getEntropy());
      
      const initialCount = engine.getWasmEntityCount();
      
      createCollisionTestScene(scene);
      scene.awake();
      scene.start();
      
      const finalCount = engine.getWasmEntityCount();
      expect(finalCount).toBeGreaterThan(initialCount);
      expect(finalCount).toBe(initialCount + 2); // Collision test spawns 2 balls
    });

    it('should create fancy demo scene', () => {
      const scene = new Scene('FancyDemo');
      scene.setEngine(engine);
      scene.setEntropy(engine.getEntropy());
      
      const initialCount = engine.getWasmEntityCount();
      
      createFancyDemoScene(scene);
      scene.awake();
      scene.start();
      
      const finalCount = engine.getWasmEntityCount();
      expect(finalCount).toBeGreaterThan(initialCount);
      expect(finalCount).toBeLessThanOrEqual(initialCount + 25); // Chaos mode: 9 center spheres + 6 cube tower + 8 sphere tower + 1 floor cube + 1 obstacle
    });

    it('should handle scene clearing', () => {
      const scene = new Scene('ClearTest');
      scene.setEngine(engine);
      scene.setEntropy(engine.getEntropy());
      
      createFancyDemoScene(scene);
      scene.awake();
      scene.start();
      
      expect(engine.getWasmEntityCount()).toBeGreaterThan(0);
      
      scene.clear();
      expect(engine.getWasmEntityCount()).toBe(0);
    });

    it('should handle multiple scene transitions', () => {
      const scene1 = new Scene('Scene1');
      scene1.setEngine(engine);
      createSingleBallScene(scene1);
      scene1.awake();
      scene1.start();
      
      expect(engine.getWasmEntityCount()).toBe(1);
      
      const scene2 = new Scene('Scene2');
      scene2.setEngine(engine);
      createCollisionTestScene(scene2); // This calls scene.clear() internally
      scene2.awake();
      scene2.start();
      
      expect(engine.getWasmEntityCount()).toBe(2); // Collision test creates 2 balls (after clearing previous)
    });
  });

  describe('WASM Entity Spawning', () => {
    beforeEach(async () => {
      engine = createTestEngine();
      await engine.init();
      await engine.loadAssets({ ball: { segments: 8 } });
    });

    it('should spawn individual entities at specific positions', () => {
      const initialCount = engine.getWasmEntityCount();

      const entityId = engine.spawnWasmEntity(1.0, 2.0, 3.0, 0.8);

      expect(typeof entityId).toBe('number');
      expect(engine.getWasmEntityCount()).toBe(initialCount + 1);
    });

    it('should spawn entities with mesh types', () => {
      const initialCount = engine.getWasmEntityCount();

      const sphereId = engine.spawnWasmEntity(0, 0, 0, 0.5); // Default sphere
      const cubeId = engine.spawnWasmEntity(1, 0, 0, 0.5, 1); // Cube mesh type

      expect(typeof sphereId).toBe('number');
      expect(typeof cubeId).toBe('number');
      expect(engine.getWasmEntityCount()).toBe(initialCount + 2);
    });

    it('should handle spawning when engine not initialized', () => {
      const uninitializedEngine = createTestEngine();

      expect(() => {
        uninitializedEngine.spawnWasmEntity(0, 0, 0, 0.5);
      }).toThrow(EngineError);
      expect(() => {
        uninitializedEngine.spawnWasmEntity(0, 0, 0, 0.5);
      }).toThrow('Engine not initialized');
    });
  });

  describe('Physics Configuration', () => {
    beforeEach(async () => {
      engine = createTestEngine();
      await engine.init();
    });

    it('should set physics parameters via WASM wrappers', () => {
      expect(() => {
        engine.setWasmPhysicsConfig(-15.0, 0.95, 0.9);
      }).not.toThrow();
    });

    it('should set world bounds via WASM wrappers', () => {
      expect(() => {
        engine.setWasmWorldBounds(12, 12, 12);
      }).not.toThrow();
    });

    it('should handle physics configuration when engine not initialized', () => {
      const uninitializedEngine = createTestEngine();

      // Should not throw - these methods check if wasm exists
      expect(() => {
        uninitializedEngine.setWasmPhysicsConfig(-10, 0.8, 0.7);
      }).not.toThrow();

      expect(() => {
        uninitializedEngine.setWasmWorldBounds(15, 15, 15);
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
      const scene1 = new Scene('Scene1');
      scene1.setEngine(engine);
      createSingleBallScene(scene1);
      scene1.awake();
      scene1.start();
      const singleBallCount = engine.getWasmEntityCount();

      const scene2 = new Scene('Scene2');
      scene2.setEngine(engine);
      createCollisionTestScene(scene2);
      scene2.awake();
      scene2.start();
      const collisionTestCount = engine.getWasmEntityCount();

      const scene3 = new Scene('Scene3');
      scene3.setEngine(engine);
      createFancyDemoScene(scene3);
      scene3.awake();
      scene3.start();
      const fancyDemoCount = engine.getWasmEntityCount();

      expect(singleBallCount).toBe(1);
      expect(collisionTestCount).toBe(2); // Collision test creates 2 balls (after clearing previous)
      expect(fancyDemoCount).toBeGreaterThan(2); // Grid entities (after clearing previous)
    });

    it('should handle configuration changes during gameplay', () => {
      const scene = new Scene('ConfigTest');
      scene.setEngine(engine);
      createSingleBallScene(scene);
      scene.awake();
      scene.start();
      
      engine.start();

      // Change physics during gameplay
      engine.setWasmPhysicsConfig(-20.0, 0.8, 1.0);
      engine.setWasmWorldBounds(15, 15, 15);

      // Should not crash
      engine.stop();
      expect(true).toBe(true);
    });

    it('should handle asset loading with different configurations', async () => {
      // Test with low segment count
      await engine.loadAssets({ ball: { segments: 4, radius: 0.3 } });
      engine.spawnWasmEntity(0, 0, 0, 0.3);

      // Test with high segment count
      await engine.loadAssets({ ball: { segments: 32, radius: 1.2 } });
      engine.spawnWasmEntity(1, 1, 1, 1.2);

      expect(engine.getWasmEntityCount()).toBeGreaterThan(0);
    });

    it('should handle maximum entity scenarios', () => {
      engine.clearWasmEntities(); // Start clean
      for (let i = 0; i < 15; i++) {
        engine.spawnWasmEntity(i, 0, 0, 0.5);
      }

      const finalCount = engine.getWasmEntityCount();
      expect(finalCount).toBe(15); // All 15 entities should spawn successfully
      expect(finalCount).toBeLessThanOrEqual(ENGINE_CONSTANTS.MAX_ENTITIES); // Within our high limit
    });
  });

  describe('Error Handling', () => {
    it('should handle operations on uninitialized engine', () => {
      const uninitializedEngine = createTestEngine();

      expect(() => uninitializedEngine.start()).toThrow(EngineError);
      expect(() => uninitializedEngine.spawnWasmEntity(0, 0, 0, 0.5)).toThrow(EngineError);

      // clearWasmEntities() returns early when uninitialized (doesn't throw)
      expect(() => uninitializedEngine.clearWasmEntities()).not.toThrow();
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