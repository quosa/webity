// Tests for MegaBufferManager to verify correct buffer layout and data integrity

import { MegaBufferManager } from '../src/v2/buffer-manager';
import { MeshData } from '../src/v2/mesh-registry';

// Mock WebGPU constants
(global as any).GPUBufferUsage = {
    VERTEX: 0x20,
    INDEX: 0x10,
    COPY_DST: 0x08,
    COPY_SRC: 0x04,
};

(global as any).GPUShaderStage = {
    VERTEX: 0x1,
    FRAGMENT: 0x2,
    COMPUTE: 0x4,
};

// Mock WebGPU device for testing
const mockDevice = {
    createBuffer: jest.fn((descriptor) => ({
        size: descriptor.size,
        usage: descriptor.usage,
        mappedAtCreation: descriptor.mappedAtCreation,
        getMappedRange: jest.fn(() => new ArrayBuffer(descriptor.size)),
        unmap: jest.fn(),
        destroy: jest.fn(),
        _mockData: new ArrayBuffer(descriptor.size), // Store mock data for testing
    })),
    queue: {
        writeBuffer: jest.fn((buffer, offset, data, dataOffset?, size?) => {
            // Mock writeBuffer by copying data to our mock buffer
            const srcView = new Uint8Array(data, dataOffset || 0, size || data.byteLength);
            const dstView = new Uint8Array(buffer._mockData, offset);
            dstView.set(srcView);
        }),
        submit: jest.fn(),
    },
    createCommandEncoder: jest.fn(() => ({
        copyBufferToBuffer: jest.fn(),
        finish: jest.fn(() => ({})),
    })),
} as any;

describe('MegaBufferManager', () => {
    let bufferManager: MegaBufferManager;

    beforeEach(() => {
        jest.clearAllMocks();
        bufferManager = new MegaBufferManager(mockDevice);
    });

    const createTriangleMesh = (): MeshData => ({
        vertices: new Float32Array([
            0.0, 0.5, 0.0,    // Top
            -0.5, -0.5, 0.0,  // Bottom left  
            0.5, -0.5, 0.0    // Bottom right
        ]),
        indices: new Uint16Array([0, 1, 2])
    });

    const createCubeMesh = (): MeshData => ({
        vertices: new Float32Array([
            // Simple cube vertices (8 vertices)
            -0.5, -0.5, -0.5, // 0
             0.5, -0.5, -0.5, // 1
             0.5,  0.5, -0.5, // 2
            -0.5,  0.5, -0.5, // 3
            -0.5, -0.5,  0.5, // 4
             0.5, -0.5,  0.5, // 5
             0.5,  0.5,  0.5, // 6
            -0.5,  0.5,  0.5  // 7
        ]),
        indices: new Uint16Array([
            // 12 triangles for 6 faces
            0, 1, 2, 2, 3, 0, // Back
            4, 6, 5, 6, 4, 7, // Front
            4, 0, 3, 3, 7, 4, // Left
            1, 5, 6, 6, 2, 1, // Right
            4, 5, 1, 1, 0, 4, // Bottom
            3, 2, 6, 6, 7, 3  // Top
        ])
    });

    it('should register single triangle mesh correctly', () => {
        const triangleMesh = createTriangleMesh();
        bufferManager.registerMesh('triangle', triangleMesh);

        const allocation = bufferManager.getMeshAllocation('triangle');
        expect(allocation).toBeDefined();
        expect(allocation!.vertexOffset).toBe(0);
        expect(allocation!.vertexCount).toBe(3);
        expect(allocation!.indexCount).toBe(3);
        expect(allocation!.vertexByteSize).toBe(36); // 9 floats * 4 bytes
        expect(allocation!.indexByteSize).toBe(8);   // 3 indices * 2 bytes, padded to 8
    });

    it('should maintain correct buffer layout with multiple meshes', () => {
        const triangleMesh = createTriangleMesh();
        const cubeMesh = createCubeMesh();

        // Register triangle first
        bufferManager.registerMesh('triangle', triangleMesh);
        const triangleAllocation = bufferManager.getMeshAllocation('triangle')!;

        // Register cube second
        bufferManager.registerMesh('cube', cubeMesh);
        const cubeAllocation = bufferManager.getMeshAllocation('cube')!;

        // Verify vertex offsets are sequential
        expect(triangleAllocation.vertexOffset).toBe(0);
        expect(cubeAllocation.vertexOffset).toBe(36); // After triangle vertices

        // Verify index offsets are sequential in index section
        expect(triangleAllocation.indexOffset).toBe(0);
        expect(cubeAllocation.indexOffset).toBe(8); // After triangle indices (padded)

        // Verify total sizes
        expect(bufferManager.getTotalVertexBytes()).toBe(132); // 36 + 96
    });

    it('should verify actual buffer contents after registration', () => {
        const triangleMesh = createTriangleMesh();
        const cubeMesh = createCubeMesh();

        bufferManager.registerMesh('triangle', triangleMesh);
        bufferManager.registerMesh('cube', cubeMesh);

        const megaBuffer = bufferManager.getMegaBuffer();
        expect(megaBuffer).toBeDefined();

        // Get the mock buffer data
        const bufferData = new Float32Array((megaBuffer! as any)._mockData);
        const indexData = new Uint16Array((megaBuffer! as any)._mockData);

        // Verify triangle vertices at start of buffer
        expect(bufferData[0]).toBe(0.0);   // Triangle vertex 0 x
        expect(bufferData[1]).toBe(0.5);   // Triangle vertex 0 y
        expect(bufferData[2]).toBe(0.0);   // Triangle vertex 0 z

        // Verify cube vertices start at offset 36 bytes = 9 floats
        expect(bufferData[9]).toBe(-0.5);  // Cube vertex 0 x
        expect(bufferData[10]).toBe(-0.5); // Cube vertex 0 y
        expect(bufferData[11]).toBe(-0.5); // Cube vertex 0 z

        // Verify triangle indices at start of index section (after all vertices)
        const totalVertexBytes = bufferManager.getTotalVertexBytes();
        const triangleIndexStart = totalVertexBytes / 2; // Convert to Uint16 offset
        expect(indexData[triangleIndexStart]).toBe(0);     // Triangle index 0
        expect(indexData[triangleIndexStart + 1]).toBe(1); // Triangle index 1
        expect(indexData[triangleIndexStart + 2]).toBe(2); // Triangle index 2
    });

    it('should handle buffer expansion correctly', () => {
        const initialBufferCalls = mockDevice.createBuffer.mock.calls.length;
        
        // Create large mesh that will trigger expansion
        const largeMesh: MeshData = {
            vertices: new Float32Array(1000 * 3), // 1000 vertices
            indices: new Uint16Array(1500)        // 1500 indices
        };

        bufferManager.registerMesh('large', largeMesh);

        // Should have created at least one buffer (expansion)
        expect(mockDevice.createBuffer.mock.calls.length).toBeGreaterThan(initialBufferCalls);
    });

    it('should not re-register same mesh', () => {
        const triangleMesh = createTriangleMesh();
        
        bufferManager.registerMesh('triangle', triangleMesh);
        const writeBufferCallsAfterFirst = mockDevice.queue.writeBuffer.mock.calls.length;
        
        // Try to register same mesh again
        bufferManager.registerMesh('triangle', triangleMesh);
        const writeBufferCallsAfterSecond = mockDevice.queue.writeBuffer.mock.calls.length;
        
        // Should not have made additional writeBuffer calls
        expect(writeBufferCallsAfterSecond).toBe(writeBufferCallsAfterFirst);
    });

    it('should calculate correct buffer offsets for rendering', () => {
        const triangleMesh = createTriangleMesh();
        const cubeMesh = createCubeMesh();

        bufferManager.registerMesh('triangle', triangleMesh);
        bufferManager.registerMesh('cube', cubeMesh);

        // Test vertex buffer offsets
        expect(bufferManager.getVertexBufferOffset('triangle')).toBe(0);
        expect(bufferManager.getVertexBufferOffset('cube')).toBe(36);

        // Test index buffer offsets (should include total vertex bytes)
        const totalVertexBytes = bufferManager.getTotalVertexBytes(); // 132
        expect(bufferManager.getIndexBufferOffset('triangle')).toBe(totalVertexBytes + 0);  // 132
        expect(bufferManager.getIndexBufferOffset('cube')).toBe(totalVertexBytes + 8);      // 140
    });

    it('should handle 4-byte alignment for indices correctly', () => {
        // Create mesh with odd number of indices to test padding
        const oddMesh: MeshData = {
            vertices: new Float32Array([0, 0, 0]),
            indices: new Uint16Array([0, 1, 2, 3, 4]) // 5 indices = 10 bytes, needs padding to 12
        };

        bufferManager.registerMesh('odd', oddMesh);
        const allocation = bufferManager.getMeshAllocation('odd')!;

        // Should be padded to 4-byte boundary
        expect(allocation.indexByteSize).toBe(12); // 10 bytes padded to 12
    });
});