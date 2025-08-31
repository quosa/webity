import { Engine } from '../src/engine.js';
import { Renderer } from '../src/renderer.js';
import type { InputManager } from '../src/input.js';
import type { BufferManager } from '../src/buffer-manager.js';
import { setupWebGPUTestEnvironment } from './utils/dom-mocks.js';

// Mock GPU Device for renderer tests
const mockDevice = {
  createBuffer: jest.fn().mockReturnValue({
    getMappedRange: jest.fn().mockReturnValue(new ArrayBuffer(1024)),
    unmap: jest.fn(),
    destroy: jest.fn(),
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
} as unknown as GPUDevice;

const mockRenderer = {
  init: jest.fn().mockResolvedValue(undefined),
  render: jest.fn(),
  renderMultipleEntitiesInstanced: jest.fn(),
  dispose: jest.fn(),
  getDevice: jest.fn().mockReturnValue(mockDevice)
} as unknown as Renderer;

const mockInputManager = {
  init: jest.fn(),
  dispose: jest.fn()
} as unknown as InputManager;

const mockBufferManager = {
  setMemory: jest.fn(),
  setDevice: jest.fn(),
  createVertexBuffer: jest.fn().mockReturnValue({}),
  createUniformBuffer: jest.fn().mockReturnValue({}),
  getVertexData: jest.fn().mockReturnValue(new Float32Array(300)),
  getUniformData: jest.fn().mockReturnValue(new Float32Array(48)),
  updateUniformBuffer: jest.fn(),
  validateMemoryAccess: jest.fn().mockReturnValue(true),
  getMemoryStats: jest.fn().mockReturnValue({ totalSize: 1024, usedSize: 512 })
} as unknown as BufferManager;

const mockCanvas = {
  getContext: jest.fn().mockReturnValue({
    configure: jest.fn(),
    getCurrentTexture: jest.fn().mockReturnValue({
      createView: jest.fn().mockReturnValue({}),
    }),
  }),
  width: 800,
  height: 600,
} as unknown as HTMLCanvasElement;

describe('Engine', () => {
  let engine: Engine;

  beforeEach(() => {
    // Set up WebGPU test environment
    setupWebGPUTestEnvironment();

    // Mock WebAssembly.instantiate for unit testing (override real WASM)
    (global.WebAssembly.instantiate as jest.Mock) = jest.fn().mockResolvedValue({
      instance: {
        exports: {
          memory: { buffer: new ArrayBuffer(1024) },
          init: jest.fn(),
          update: jest.fn(),
          set_input: jest.fn(),
          generate_sphere_mesh: jest.fn(),
          generate_grid_floor: jest.fn(),
          get_vertex_buffer_offset: jest.fn().mockReturnValue(0),
          get_grid_buffer_offset: jest.fn().mockReturnValue(512),
          get_uniform_buffer_offset: jest.fn().mockReturnValue(1024),
          get_vertex_count: jest.fn().mockReturnValue(100),
          get_grid_vertex_count: jest.fn().mockReturnValue(50),
          get_collision_state: jest.fn().mockReturnValue(0),
          set_position: jest.fn(),
          apply_force: jest.fn(),
          get_ball_position_x: jest.fn().mockReturnValue(0),
          get_ball_position_y: jest.fn().mockReturnValue(0),
          get_ball_position_z: jest.fn().mockReturnValue(0),
          set_camera_position: jest.fn(),
          set_camera_target: jest.fn(),
          set_physics_config: jest.fn(),
          set_world_bounds: jest.fn(),
          get_camera_position_x: jest.fn().mockReturnValue(0),
          get_camera_position_y: jest.fn().mockReturnValue(0),
          get_camera_position_z: jest.fn().mockReturnValue(-20),
          spawn_entity: jest.fn().mockReturnValue(0),
          get_entity_count: jest.fn().mockReturnValue(1),
          despawn_all_entities: jest.fn(),
          get_entity_position_x: jest.fn().mockReturnValue(0),
          get_entity_position_y: jest.fn().mockReturnValue(0),
          get_entity_position_z: jest.fn().mockReturnValue(0),
          set_entity_position: jest.fn(),
          set_entity_velocity: jest.fn(),
        }
      }
    });

    // Note: fetch is handled by smart mock in tests/setup.ts, but WebAssembly mock above
    // will intercept instantiation for unit testing

    engine = new Engine(
      document.createElement('canvas'),
      mockRenderer,
      mockInputManager,
      mockBufferManager,
    );
  });

  it('should construct the engine', () => {
    expect(engine).toBeDefined();
  });

  it('should initialize the engine', async () => {
    const initResult = await engine.init();
    expect(initResult).toBeUndefined();
  });

  it('should run the engine', async () => {
    await engine.init();
    const startResult =  engine.start();
    expect(startResult).toBeUndefined();
  });
});

describe('Renderer', () => {
  let renderer: Renderer;

  beforeEach(() => {
    renderer = new Renderer(mockBufferManager);
  });

  it('should construct the renderer', () => {
    expect(renderer).toBeDefined();
  });

  it('should initialize the renderer', async () => {
    const initResult = await renderer.init(mockCanvas);
    expect(initResult).toBeUndefined();
  });

  it('should render a frame with instanced rendering', async () => {
    await renderer.init(mockCanvas);
    // Create mock WASM instance with required methods
    const mockWASM = {
      get_entity_position_x: jest.fn().mockReturnValue(1.0),
      get_entity_position_y: jest.fn().mockReturnValue(2.0),
      get_entity_position_z: jest.fn().mockReturnValue(3.0),
      get_grid_buffer_offset: jest.fn().mockReturnValue(800), // Use valid offset within 1024 byte buffer
      get_grid_vertex_count: jest.fn().mockReturnValue(10)  // Smaller count to fit in buffer
    };
    
    const renderResult = renderer.renderMultipleEntitiesInstanced(
      new ArrayBuffer(1024), 0, 100, 500, mockWASM, 2
    );
    expect(renderResult).toBeUndefined();
  });
});
