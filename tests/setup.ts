// Mock WebGPU constants
Object.defineProperty(globalThis, 'GPUBufferUsage', {
  value: {
    VERTEX: 0x20,
    UNIFORM: 0x40,
    COPY_DST: 0x8,
  },
  writable: true,
});

Object.defineProperty(globalThis, 'GPUShaderStage', {
  value: {
    VERTEX: 1,
    FRAGMENT: 2,
    COMPUTE: 4,
  },
  writable: true,
});

// Mock WebGPU for testing
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

// Mock WebAssembly for testing
Object.defineProperty(globalThis, 'WebAssembly', {
  value: {
    instantiate: jest.fn().mockResolvedValue({
      instance: {
        exports: {
          memory: {
            buffer: new ArrayBuffer(1024 * 1024),
          },
          init: jest.fn(),
          update: jest.fn(),
          set_input: jest.fn(),
          generate_sphere_mesh: jest.fn(),
          get_vertex_buffer_offset: jest.fn().mockReturnValue(0),
          get_uniform_buffer_offset: jest.fn().mockReturnValue(1024),
          get_vertex_count: jest.fn().mockReturnValue(100),
          get_collision_state: jest.fn().mockReturnValue(0),
          set_position: jest.fn(),
          apply_force: jest.fn(),
        },
      },
    }),
  },
  writable: true,
});

// Mock fetch for WASM loading
Object.defineProperty(globalThis, 'fetch', {
  value: jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
  }),
  writable: true,
});

// Mock performance.now()
Object.defineProperty(globalThis, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
  },
  writable: true,
});

// Mock requestAnimationFrame
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: jest.fn((callback: FrameRequestCallback) => {
    setTimeout(() => callback(performance.now()), 16);
    return 1;
  }),
  writable: true,
});

Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: jest.fn(),
  writable: true,
});

// Mock HTML Canvas with proper WebGPU context
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn((contextType: string) => {
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
  writable: true,
});

// Ensure document.getElementById returns a canvas with proper mocking
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
  width: 800,
  height: 600,
} as unknown as HTMLCanvasElement;

// Mock document.getElementById to return our mock canvas
Object.defineProperty(document, 'getElementById', {
  value: jest.fn().mockReturnValue(mockCanvas),
  writable: true,
});