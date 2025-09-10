// tests/gpu-buffer-manager.test.ts
// Unit tests for GPUBufferManager (isolated component testing)

import { jest } from '@jest/globals';
import { GPUBufferManager } from '../src/v2/gpu-buffer-manager';
import { MeshData } from '../src/v2/mesh-registry';

// Mock WebGPU device for unit testing
const mockDevice = {
    createBuffer: jest.fn().mockReturnValue({
        getMappedRange: jest.fn().mockReturnValue(new ArrayBuffer(1024 * 1024)),
        unmap: jest.fn(),
        destroy: jest.fn(),
    }),
    queue: {
        writeBuffer: jest.fn(),
    },
} as any;

// Helper function to create test mesh data
function createTestMeshData(vertexCount: number, indexCount: number): MeshData {
    const vertices = new Float32Array(vertexCount * 3); // 3 floats per vertex
    const indices = new Uint16Array(indexCount);
    
    // Fill with test data
    for (let i = 0; i < vertices.length; i++) {
        vertices[i] = i * 0.1;
    }
    for (let i = 0; i < indices.length; i++) {
        indices[i] = i;
    }
    
    return { vertices, indices };
}

describe('GPUBufferManager', () => {
    let bufferManager: GPUBufferManager;

    beforeEach(() => {
        jest.clearAllMocks();
        bufferManager = new GPUBufferManager(mockDevice);
    });

    afterEach(() => {
        bufferManager.dispose();
    });

    describe('Mesh Registration', () => {
        test('should register a single mesh correctly', () => {
            const cubeData = createTestMeshData(8, 36); // 8 vertices, 36 indices for cube
            
            bufferManager.registerMesh('cube', cubeData);
            
            const allocation = bufferManager.getMeshAllocation('cube');
            expect(allocation).toBeDefined();
            expect(allocation!.vertexCount).toBe(8);
            expect(allocation!.indexCount).toBe(36);
            expect(allocation!.vertexOffset).toBe(0); // First mesh should start at 0
            expect(allocation!.indexOffset).toBe(0); // First mesh should start at 0
        });

        test('should handle multiple mesh registrations with correct offsets', () => {
            const cubeData = createTestMeshData(8, 36);
            const sphereData = createTestMeshData(64, 128); // More complex sphere
            
            bufferManager.registerMesh('cube', cubeData);
            bufferManager.registerMesh('sphere', sphereData);
            
            const cubeAllocation = bufferManager.getMeshAllocation('cube');
            const sphereAllocation = bufferManager.getMeshAllocation('sphere');
            
            expect(cubeAllocation!.vertexOffset).toBe(0);
            expect(cubeAllocation!.indexOffset).toBe(0);
            
            // Calculate expected offsets
            const cubeVertexBytes = 8 * 3 * 4; // 8 vertices * 3 floats * 4 bytes = 96 bytes
            const cubeIndexBytes = Math.ceil((36 * 2) / 4) * 4; // 36 indices * 2 bytes, padded to 4-byte boundary = 72 -> 72 bytes
            
            expect(sphereAllocation!.vertexOffset).toBe(cubeVertexBytes); // Should be 96
            expect(sphereAllocation!.indexOffset).toBe(cubeIndexBytes); // Should be 72
            
            // Verify no overlap
            const cubeVertexEnd = cubeAllocation!.vertexOffset + cubeAllocation!.vertexByteSize;
            expect(sphereAllocation!.vertexOffset).toBeGreaterThanOrEqual(cubeVertexEnd);
        });

        test('should handle duplicate mesh registration gracefully', () => {
            const cubeData = createTestMeshData(8, 36);
            
            bufferManager.registerMesh('cube', cubeData);
            const firstAllocation = bufferManager.getMeshAllocation('cube');
            
            // Register same mesh again
            bufferManager.registerMesh('cube', cubeData);
            const secondAllocation = bufferManager.getMeshAllocation('cube');
            
            // Should return same allocation
            expect(secondAllocation).toEqual(firstAllocation);
        });

        test('should return undefined for non-existent mesh', () => {
            const allocation = bufferManager.getMeshAllocation('nonexistent');
            expect(allocation).toBeUndefined();
        });
    });

    describe('Buffer Building', () => {
        test('should create shared vertex and index buffers', () => {
            const cubeData = createTestMeshData(8, 36);
            bufferManager.registerMesh('cube', cubeData);
            
            bufferManager.buildSharedBuffers();
            
            expect(mockDevice.createBuffer).toHaveBeenCalledTimes(2);
            expect(bufferManager.getSharedVertexBuffer()).toBeTruthy();
            expect(bufferManager.getSharedIndexBuffer()).toBeTruthy();
        });

        test('should handle empty mesh registry', () => {
            bufferManager.buildSharedBuffers();
            
            // Should not create buffers if no meshes registered
            expect(mockDevice.createBuffer).not.toHaveBeenCalled();
            expect(bufferManager.getSharedVertexBuffer()).toBeNull();
            expect(bufferManager.getSharedIndexBuffer()).toBeNull();
        });

        test('should use proper buffer sizes and usage flags', () => {
            const cubeData = createTestMeshData(8, 36);
            bufferManager.registerMesh('cube', cubeData);
            
            bufferManager.buildSharedBuffers();
            
            const createBufferCalls = mockDevice.createBuffer.mock.calls;
            expect(createBufferCalls).toHaveLength(2);
            
            // Verify buffer creation calls have proper structure
            const vertexBufferCall = createBufferCalls[0][0];
            expect(vertexBufferCall.usage).toBeGreaterThan(0);
            expect(vertexBufferCall.mappedAtCreation).toBe(true);
            
            const indexBufferCall = createBufferCalls[1][0];
            expect(indexBufferCall.usage).toBeGreaterThan(0);
            expect(indexBufferCall.mappedAtCreation).toBe(true);
        });
    });

    describe('Buffer Offsets', () => {
        test('should return correct vertex buffer offsets', () => {
            const cubeData = createTestMeshData(8, 36);
            const sphereData = createTestMeshData(64, 128);
            
            bufferManager.registerMesh('cube', cubeData);
            bufferManager.registerMesh('sphere', sphereData);
            
            const cubeOffset = bufferManager.getVertexBufferOffset('cube');
            const sphereOffset = bufferManager.getVertexBufferOffset('sphere');
            
            const expectedSphereOffset = 8 * 3 * 4; // 8 vertices * 3 floats * 4 bytes = 96
            
            expect(cubeOffset).toBe(0);
            expect(sphereOffset).toBe(expectedSphereOffset);
        });

        test('should return correct index buffer offsets', () => {
            const cubeData = createTestMeshData(8, 36);
            const sphereData = createTestMeshData(64, 128);
            
            bufferManager.registerMesh('cube', cubeData);
            bufferManager.registerMesh('sphere', sphereData);
            
            const cubeOffset = bufferManager.getIndexBufferOffset('cube');
            const sphereOffset = bufferManager.getIndexBufferOffset('sphere');
            
            const cubeIndexBytes = Math.ceil((36 * 2) / 4) * 4; // 36 indices * 2 bytes = 72, already aligned to 4
            
            expect(cubeOffset).toBe(0);
            expect(sphereOffset).toBe(cubeIndexBytes); // Should be 72
        });

        test('should return 0 for non-existent mesh offsets', () => {
            const vertexOffset = bufferManager.getVertexBufferOffset('nonexistent');
            const indexOffset = bufferManager.getIndexBufferOffset('nonexistent');
            
            expect(vertexOffset).toBe(0);
            expect(indexOffset).toBe(0);
        });
    });

    describe('Zero-Copy WASM Memory Mapping', () => {
        test('should map WASM memory to instance buffer', () => {
            const wasmMemory = new ArrayBuffer(1024);
            const entityCount = 5;
            const offset = 64;
            
            // Method doesn't return anything, just maps internally
            expect(() => {
                bufferManager.mapInstanceDataFromWasm(wasmMemory, offset, entityCount);
            }).not.toThrow();
            
            // Verify instance buffer was created
            const instanceBuffer = bufferManager.getInstanceBuffer();
            expect(instanceBuffer).not.toBeNull();
        });

        test('should handle zero entities gracefully', () => {
            const wasmMemory = new ArrayBuffer(1024);
            
            expect(() => {
                bufferManager.mapInstanceDataFromWasm(wasmMemory, 0, 0);
            }).not.toThrow();
        });

        test('should validate buffer access and handle large entity counts', () => {
            const wasmMemory = new ArrayBuffer(1024 * 1024); // 1MB
            const entityCount = 1000;
            
            // Should validate successfully
            const isValid = bufferManager.validateWasmBufferAccess(wasmMemory, 0, entityCount);
            expect(isValid).toBe(true);
            
            expect(() => {
                bufferManager.mapInstanceDataFromWasm(wasmMemory, 0, entityCount);
            }).not.toThrow();
        });
    });

    describe('Resource Management', () => {
        test('should dispose buffers and clear registry', () => {
            const cubeData = createTestMeshData(8, 36);
            bufferManager.registerMesh('cube', cubeData);
            bufferManager.buildSharedBuffers();
            
            const mockVertexBuffer = bufferManager.getSharedVertexBuffer();
            const mockIndexBuffer = bufferManager.getSharedIndexBuffer();
            
            bufferManager.dispose();
            
            expect(mockVertexBuffer!.destroy).toHaveBeenCalled();
            expect(mockIndexBuffer!.destroy).toHaveBeenCalled();
            expect(bufferManager.getSharedVertexBuffer()).toBeNull();
            expect(bufferManager.getSharedIndexBuffer()).toBeNull();
            expect(bufferManager.getMeshAllocation('cube')).toBeUndefined();
        });

        test('should handle dispose without buffers created', () => {
            const cubeData = createTestMeshData(8, 36);
            bufferManager.registerMesh('cube', cubeData);
            // Don't call buildSharedBuffers()
            
            expect(() => bufferManager.dispose()).not.toThrow();
        });
    });

    describe('4-Byte Alignment', () => {
        test('should handle odd-sized vertex data alignment', () => {
            // Create mesh data that doesn't align to 4 bytes
            const vertices = new Float32Array([1, 2, 3, 4, 5]); // 5 floats = 20 bytes (aligned)
            const indices = new Uint16Array([0, 1, 2]); // 3 indices = 6 bytes (needs padding to 8)
            const meshData = { vertices, indices };
            
            bufferManager.registerMesh('oddMesh', meshData);
            
            const allocation = bufferManager.getMeshAllocation('oddMesh');
            expect(allocation!.indexByteSize % 4).toBe(0); // Should be aligned to 4 bytes
            expect(allocation!.indexByteSize).toBeGreaterThanOrEqual(indices.byteLength);
        });
    });
});