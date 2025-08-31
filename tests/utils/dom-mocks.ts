// WebGPU and DOM mocking utilities for tests that need browser environment

// Mock WebGPU constants
export const mockWebGPUConstants = () => {
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
};

// Mock WebGPU navigator.gpu
export const mockWebGPUNavigator = () => {
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
};

// Mock HTML Canvas with WebGPU context
export const mockHTMLCanvas = () => {
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
};

// Mock document.getElementById to return a canvas
export const mockDocumentGetElementById = () => {
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

  Object.defineProperty(document, 'getElementById', {
    value: jest.fn().mockReturnValue(mockCanvas),
    writable: true,
  });

  return mockCanvas;
};

// Convenience function to set up full DOM environment for WebGPU tests
export const setupWebGPUTestEnvironment = () => {
  mockWebGPUConstants();
  mockWebGPUNavigator();
  mockHTMLCanvas();
  return mockDocumentGetElementById();
};