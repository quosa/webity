// src/v2/gpu-buffer-manager.ts
// Pure buffer management - replacement for MegaBufferManager with shared vertex/index architecture

import { MeshRegistry, MeshData, MeshAllocation } from './mesh-registry';

export class GPUBufferManager {
    private device: GPUDevice;
    private sharedVertexBuffer: GPUBuffer | null = null;
    private sharedIndexBuffer: GPUBuffer | null = null;
    private meshRegistry = new MeshRegistry();
    private meshDataCache = new Map<string, MeshData>();
    
    // Start with reasonable buffer sizes - can be expanded dynamically
    private static readonly INITIAL_VERTEX_SIZE = 10 * 1024 * 1024; // 10MB for vertices
    private static readonly INITIAL_INDEX_SIZE = 5 * 1024 * 1024;   // 5MB for indices
    
    constructor(device: GPUDevice) {
        this.device = device;
    }
    
    // Register mesh data (calculates allocation, doesn't upload yet)
    registerMesh(meshId: string, meshData: MeshData): void {
        this.meshRegistry.allocate(meshId, meshData);
        this.meshDataCache.set(meshId, meshData);
    }
    
    // Build shared vertex and index buffers with all registered meshes
    buildSharedBuffers(): void {
        const allocations = this.meshRegistry.getAllocations();
        if (allocations.size === 0) return;
        
        const totalVertexBytes = this.meshRegistry.getTotalVertexBytes();
        const totalIndexBytes = this.meshRegistry.getTotalIndexBytes();
        
        // Create separate shared vertex buffer (f32 data)
        this.sharedVertexBuffer = this.device.createBuffer({
            size: Math.max(totalVertexBytes, GPUBufferManager.INITIAL_VERTEX_SIZE),
            usage: 0x20 | 0x04, // GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
            mappedAtCreation: true,
        });
        
        // Create separate shared index buffer (u16 data)
        this.sharedIndexBuffer = this.device.createBuffer({
            size: Math.max(totalIndexBytes, GPUBufferManager.INITIAL_INDEX_SIZE),
            usage: 0x10 | 0x04, // GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
            mappedAtCreation: true,
        });
        
        // Upload all mesh data to their allocated positions
        const vertexArrayBuffer = this.sharedVertexBuffer.getMappedRange();
        const indexArrayBuffer = this.sharedIndexBuffer.getMappedRange();
        
        for (const [meshId, allocation] of allocations) {
            const meshData = this.meshDataCache.get(meshId);
            if (!meshData) continue;
            
            // Copy vertices to shared vertex buffer
            const vertexDst = new Float32Array(
                vertexArrayBuffer,
                allocation.vertexOffset,
                meshData.vertices.length
            );
            vertexDst.set(meshData.vertices);
            
            // Copy indices to shared index buffer
            const indexDst = new Uint16Array(
                indexArrayBuffer,
                allocation.indexOffset,
                meshData.indices.length
            );
            indexDst.set(meshData.indices);
        }
        
        this.sharedVertexBuffer.unmap();
        this.sharedIndexBuffer.unmap();
    }
    
    // Zero-copy WASM memory mapping (for future WASM integration)
    mapInstanceDataFromWasm(wasmMemory: ArrayBuffer, offset: number, count: number): Float32Array {
        // Direct zero-copy mapping from WASM entity transforms  
        // 20 floats per instance: 16 (transform matrix) + 4 (color)
        return new Float32Array(wasmMemory, offset, count * 20);
    }
    
    // Accessor methods for renderer
    getSharedVertexBuffer(): GPUBuffer | null {
        return this.sharedVertexBuffer;
    }
    
    getSharedIndexBuffer(): GPUBuffer | null {
        return this.sharedIndexBuffer;
    }
    
    getMeshAllocation(meshId: string): MeshAllocation | undefined {
        return this.meshRegistry.get(meshId);
    }
    
    getVertexBufferOffset(meshId: string): number {
        const allocation = this.meshRegistry.get(meshId);
        return allocation ? allocation.vertexOffset : 0;
    }
    
    getIndexBufferOffset(meshId: string): number {
        const allocation = this.meshRegistry.get(meshId);
        return allocation ? allocation.indexOffset : 0;
    }
    
    // Clean up GPU resources
    dispose(): void {
        this.sharedVertexBuffer?.destroy();
        this.sharedIndexBuffer?.destroy();
        this.sharedVertexBuffer = null;
        this.sharedIndexBuffer = null;
        this.meshRegistry.clear();
        this.meshDataCache.clear();
    }
}