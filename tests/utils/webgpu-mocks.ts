// tests/utils/webgpu-mocks.ts
// Shared WebGPU mocking utilities to eliminate duplication across test files

import { jest } from '@jest/globals';

/**
 * Comprehensive WebGPU mock factory 
 * Consolidates mocking patterns from 10+ test files into a single source
 */
export class WebGPUMockFactory {
    /**
     * Set up complete WebGPU environment mocking
     * Includes navigator.gpu, GPUDevice, and all WebGPU globals
     */
    static setupWebGPUEnvironment(): void {
        // Mock navigator.gpu with complete WebGPU API
        Object.defineProperty(global, 'navigator', {
            value: {
                gpu: {
                    // @ts-ignore - Complex mock object with nested Jest functions
                    requestAdapter: jest.fn().mockResolvedValue({
                        // @ts-ignore - Complex mock object with nested Jest functions  
                        requestDevice: jest.fn().mockResolvedValue(this.createMockGPUDevice())
                    }),
                    getPreferredCanvasFormat: jest.fn().mockReturnValue('bgra8unorm')
                }
            },
            writable: true
        });

        // Mock WebGPU globals
        this.setupWebGPUGlobals();
    }

    /**
     * Create a comprehensive mock GPUDevice with all required methods
     */
    static createMockGPUDevice(): any {
        return {
            // Buffer management
            createBuffer: jest.fn().mockReturnValue({
                size: 1024,
                getMappedRange: jest.fn().mockReturnValue(new ArrayBuffer(1024)),
                mapAsync: jest.fn(),
                unmap: jest.fn(),
                destroy: jest.fn()
            }),

            // Shader and pipeline creation
            createShaderModule: jest.fn().mockReturnValue({ 
                getBindGroupLayout: jest.fn() 
            }),
            createRenderPipeline: jest.fn().mockReturnValue({ 
                getBindGroupLayout: jest.fn() 
            }),
            createComputePipeline: jest.fn().mockReturnValue({ 
                getBindGroupLayout: jest.fn() 
            }),

            // Resource creation
            createTexture: jest.fn().mockReturnValue({ 
                createView: jest.fn().mockReturnValue({}) 
            }),
            createSampler: jest.fn().mockReturnValue({}),

            // Binding and layout
            createBindGroupLayout: jest.fn().mockReturnValue({}),
            createBindGroup: jest.fn().mockReturnValue({}),
            createPipelineLayout: jest.fn().mockReturnValue({}),

            // Command encoding and queues
            createCommandEncoder: jest.fn().mockReturnValue({
                beginRenderPass: jest.fn().mockReturnValue({
                    setPipeline: jest.fn(),
                    setBindGroup: jest.fn(),
                    setVertexBuffer: jest.fn(),
                    setIndexBuffer: jest.fn(),
                    draw: jest.fn(),
                    drawIndexed: jest.fn(),
                    end: jest.fn()
                }),
                beginComputePass: jest.fn().mockReturnValue({
                    setPipeline: jest.fn(),
                    setBindGroup: jest.fn(),
                    dispatchWorkgroups: jest.fn(),
                    end: jest.fn()
                }),
                copyBufferToBuffer: jest.fn(),
                copyBufferToTexture: jest.fn(),
                copyTextureToBuffer: jest.fn(),
                copyTextureToTexture: jest.fn(),
                finish: jest.fn().mockReturnValue({})
            }),

            // Queue operations
            queue: {
                writeBuffer: jest.fn(),
                writeTexture: jest.fn(),
                submit: jest.fn(),
                onSubmittedWorkDone: jest.fn()
            },

            // Query and debug
            createQuerySet: jest.fn().mockReturnValue({}),
            
            // Device management
            destroy: jest.fn(),
            lost: Promise.resolve({ reason: 'destroyed' as const, message: 'Device destroyed for testing' }),
            
            // Features and limits (commonly accessed)
            features: new Set(['depth-clip-control', 'depth32float-stencil8']),
            limits: {
                maxTextureDimension1D: 8192,
                maxTextureDimension2D: 8192,
                maxTextureDimension3D: 2048,
                maxTextureArrayLayers: 256,
                maxBindGroups: 4,
                maxDynamicUniformBuffersPerPipelineLayout: 8,
                maxDynamicStorageBuffersPerPipelineLayout: 4,
                maxSampledTexturesPerShaderStage: 16,
                maxSamplersPerShaderStage: 16,
                maxStorageBuffersPerShaderStage: 8,
                maxStorageTexturesPerShaderStage: 4,
                maxUniformBuffersPerShaderStage: 12,
                maxUniformBufferBindingSize: 65536,
                maxStorageBufferBindingSize: 134217728,
                maxVertexBuffers: 8,
                maxBufferSize: 268435456,
                maxVertexAttributes: 16,
                maxVertexBufferArrayStride: 2048,
                maxComputeWorkgroupStorageSize: 16384,
                maxComputeInvocationsPerWorkgroup: 256,
                maxComputeWorkgroupSizeX: 256,
                maxComputeWorkgroupSizeY: 256,
                maxComputeWorkgroupSizeZ: 64,
                maxComputeWorkgroupsPerDimension: 65535
            }
        };
    }

    /**
     * Set up WebGPU global constants used by tests
     */
    static setupWebGPUGlobals(): void {
        (global as any).GPUShaderStage = {
            VERTEX: 1,
            FRAGMENT: 2,
            COMPUTE: 4
        };

        (global as any).GPUBufferUsage = {
            MAP_READ: 1,
            MAP_WRITE: 2,
            COPY_SRC: 4,
            COPY_DST: 8,
            INDEX: 16,
            VERTEX: 32,
            UNIFORM: 64,
            STORAGE: 128,
            INDIRECT: 256,
            QUERY_RESOLVE: 512
        };

        (global as any).GPUTextureUsage = {
            COPY_SRC: 1,
            COPY_DST: 2,
            TEXTURE_BINDING: 4,
            STORAGE_BINDING: 8,
            RENDER_ATTACHMENT: 16
        };

        (global as any).GPUMapMode = {
            READ: 1,
            WRITE: 2
        };
    }

    /**
     * Create mock HTML canvas with WebGPU context
     */
    static createMockCanvas(): any {
        return {
            getContext: jest.fn().mockReturnValue({
                configure: jest.fn(),
                unconfigure: jest.fn(),
                getCurrentTexture: jest.fn().mockReturnValue({
                    createView: jest.fn().mockReturnValue({})
                })
            }),
            width: 800,
            height: 600,
            style: {},
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };
    }

    /**
     * Reset all WebGPU mocks (useful in beforeEach/afterEach)
     */
    static resetMocks(): void {
        jest.clearAllMocks();
    }

    /**
     * Quick setup for tests that need WebGPU + Canvas
     * Returns both mocked device and canvas
     */
    static setupComplete(): { device: any; canvas: any } {
        this.setupWebGPUEnvironment();
        const canvas = this.createMockCanvas();
        const device = this.createMockGPUDevice();
        
        return { device, canvas };
    }
}

/**
 * Convenience function for test files - sets up complete WebGPU environment
 * Use this in beforeEach blocks to replace the duplicated setup code
 */
export function setupWebGPUTestEnvironment(): void {
    WebGPUMockFactory.setupWebGPUEnvironment();
}

/**
 * Reset WebGPU mocks - use in afterEach blocks
 */
export function resetWebGPUMocks(): void {
    WebGPUMockFactory.resetMocks();
}