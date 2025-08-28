import { Engine } from '../src/engine.js';
import { EngineError, WebGPUNotSupportedError } from '../src/types.js';

// Mock HTML canvas element
const mockCanvas = {
  id: 'test-canvas',
  getContext: jest.fn((contextType: string) => {
    if (contextType === 'webgpu') {
      return {
        configure: jest.fn(),
        getCurrentTexture: jest.fn().mockReturnValue({
          createView: jest.fn().mockReturnValue({}),
        }),
      };
    }
    return null;
  }),
} as unknown as HTMLCanvasElement;

describe('Engine', () => {
  let engine: Engine;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock DOM
    document.getElementById = jest.fn().mockReturnValue(mockCanvas);
    
    // Restore WebGPU mock (it's defined in setup.ts)
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: jest.fn().mockResolvedValue({
            requestDevice: jest.fn().mockResolvedValue({
              createBuffer: jest.fn().mockReturnValue({
                getMappedRange: jest.fn().mockReturnValue(new ArrayBuffer(1024)),
                unmap: jest.fn(),
                destroy: jest.fn(),
                size: 1024,
              }),
              createCommandEncoder: jest.fn().mockReturnValue({
                beginRenderPass: jest.fn().mockReturnValue({
                  setPipeline: jest.fn(),
                  setBindGroup: jest.fn(),
                  setVertexBuffer: jest.fn(),
                  draw: jest.fn(),
                  end: jest.fn(),
                }),
                finish: jest.fn().mockReturnValue({}),
              }),
              createShaderModule: jest.fn().mockReturnValue({}),
              createBindGroupLayout: jest.fn().mockReturnValue({}),
              createBindGroup: jest.fn().mockReturnValue({}),
              createPipelineLayout: jest.fn().mockReturnValue({}),
              createRenderPipeline: jest.fn().mockReturnValue({}),
              queue: {
                submit: jest.fn(),
                writeBuffer: jest.fn(),
              },
            }),
            limits: {
              maxBufferSize: 1024 * 1024 * 1024,
            },
          }),
          getPreferredCanvasFormat: jest.fn().mockReturnValue('bgra8unorm'),
        },
      },
      writable: true,
    });
  });

  afterEach(() => {
    // Clean up engine if it exists
    if (engine) {
      engine.dispose();
    }
  });

  describe('Constructor', () => {
    it('should create engine instance with valid canvas', () => {
      engine = new Engine('test-canvas');
      expect(engine).toBeInstanceOf(Engine);
    });

    it('should throw error when canvas not found', () => {
      document.getElementById = jest.fn().mockReturnValue(null);
      
      expect(() => {
        new Engine('non-existent-canvas');
      }).toThrow(EngineError);
      
      expect(() => {
        new Engine('non-existent-canvas');
      }).toThrow('Canvas with id \'non-existent-canvas\' not found');
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      engine = new Engine('test-canvas');
    });

    it('should throw WebGPUNotSupportedError when WebGPU is not available', async () => {
      // Mock navigator.gpu as undefined
      Object.defineProperty(globalThis, 'navigator', {
        value: { gpu: undefined },
        writable: true,
      });

      await expect(engine.init()).rejects.toThrow(WebGPUNotSupportedError);
    });

    it('should initialize successfully with WebGPU support', async () => {
      // WebGPU is mocked in setup.ts, so this should work
      await expect(engine.init()).resolves.toBeUndefined();
    });

    it('should apply physics configuration when provided', async () => {
      const config = {
        physics: {
          gravity: -9.8,
          friction: 0.1,
          bounds: { x: 10, y: 10, z: 10 }
        }
      };

      await expect(engine.init(config)).resolves.toBeUndefined();
    });
  });

  describe('Asset Loading', () => {
    beforeEach(async () => {
      engine = new Engine('test-canvas');
      await engine.init();
    });

    it('should load ball assets successfully', async () => {
      const assets = {
        ball: { segments: 32, radius: 1.0 }
      };

      await expect(engine.loadAssets(assets)).resolves.toBeUndefined();
    });

    it('should throw error when engine not initialized', async () => {
      const uninitializedEngine = new Engine('test-canvas');
      const assets = { ball: { segments: 32 } };

      await expect(uninitializedEngine.loadAssets(assets)).rejects.toThrow(EngineError);
      await expect(uninitializedEngine.loadAssets(assets)).rejects.toThrow('Engine not initialized');
    });
  });

  describe('Game Loop', () => {
    beforeEach(async () => {
      engine = new Engine('test-canvas');
      await engine.init();
    });

    it('should start and stop game loop', () => {
      expect(() => engine.start()).not.toThrow();
      expect(() => engine.stop()).not.toThrow();
    });

    it('should throw error when starting uninitialized engine', () => {
      const uninitializedEngine = new Engine('test-canvas');
      
      expect(() => uninitializedEngine.start()).toThrow(EngineError);
      expect(() => uninitializedEngine.start()).toThrow('Engine not initialized');
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      engine = new Engine('test-canvas');
      await engine.init();
    });

    it('should dispose resources without throwing', () => {
      expect(() => engine.dispose()).not.toThrow();
    });

    it('should stop game loop when disposing', () => {
      engine.start();
      engine.dispose();
      
      // Engine should be stopped (no easy way to test this directly)
      expect(() => engine.dispose()).not.toThrow();
    });
  });
});