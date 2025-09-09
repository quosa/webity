// src/v2/mesh-registry.ts

export interface MeshData {
    vertices: Float32Array;
    indices: Uint16Array;
}

export interface MeshAllocation {
    vertexOffset: number;  // Byte offset in mega buffer
    vertexCount: number;   // Number of vertices
    indexOffset: number;   // Byte offset in mega buffer
    indexCount: number;    // Number of indices
    vertexByteSize: number;
    indexByteSize: number;
}

export class MeshRegistry {
    private allocations = new Map<string, MeshAllocation>();
    private totalVertexBytes = 0;
    private totalIndexBytes = 0;
    
    // Pre-calculate offsets for mesh data
    allocate(meshId: string, meshData: MeshData): MeshAllocation {
        if (this.allocations.has(meshId)) {
            console.warn(`Mesh ${meshId} already allocated`);
            return this.allocations.get(meshId)!;
        }
        
        const vertexByteSize = meshData.vertices.byteLength;
        const indexByteSize = meshData.indices.byteLength;
        
        // Align to 4-byte boundaries for WebGPU
        const alignedVertexSize = Math.ceil(vertexByteSize / 4) * 4;
        const alignedIndexSize = Math.ceil(indexByteSize / 4) * 4;
        
        const allocation: MeshAllocation = {
            vertexOffset: this.totalVertexBytes,
            vertexCount: meshData.vertices.length / 3, // 3 floats per vertex (x, y, z)
            indexOffset: this.totalIndexBytes,
            indexCount: meshData.indices.length,
            vertexByteSize: alignedVertexSize,
            indexByteSize: alignedIndexSize,
        };
        
        this.allocations.set(meshId, allocation);
        this.totalVertexBytes += alignedVertexSize;
        this.totalIndexBytes += alignedIndexSize;
        
        return allocation;
    }
    
    get(meshId: string): MeshAllocation | undefined {
        return this.allocations.get(meshId);
    }
    
    getAllocations(): Map<string, MeshAllocation> {
        return new Map(this.allocations);
    }
    
    getTotalVertexBytes(): number {
        return this.totalVertexBytes;
    }
    
    getTotalIndexBytes(): number {
        return this.totalIndexBytes;
    }
    
    clear(): void {
        this.allocations.clear();
        this.totalVertexBytes = 0;
        this.totalIndexBytes = 0;
    }
}