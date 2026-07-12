// src/v2/mesh-registry.ts

// Which draw pass renders a mesh's instances (single source of truth for the union).
export type RenderMode = 'triangles' | 'lines';

export interface MeshData {
    vertices: Float32Array;
    indices: Uint16Array;
}

export interface MeshAllocation {
    vertexOffset: number;  // Byte offset in vertex buffer
    vertexCount: number;   // Number of vertices
    indexOffset: number;   // Byte offset in index buffer
    indexCount: number;    // Number of indices
    vertexByteSize: number;
    indexByteSize: number;
    renderMode: RenderMode; // Draw pass (triangles vs lines) for this mesh's instances
    // Bind-once atlas addressing: the shared buffers are bound once per pass and each mesh is
    // selected via drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance).
    // Indices stay mesh-relative (0-based), so uint16 limits a single mesh, not the atlas.
    baseVertex: number;    // vertexOffset in vertices (12 B stride: xyz f32)
    firstIndex: number;    // indexOffset in indices (2 B stride: uint16)
}

export class MeshRegistry {
    private allocations = new Map<string, MeshAllocation>();
    private totalVertexBytes = 0;
    private totalIndexBytes = 0;

    // WASM module has u32 mesh indices (not strings)
    private meshCount = 0;
    private meshIndexMap = new Map<string, number>();

    // Pre-calculate offsets for mesh data
    allocate(meshId: string, meshData: MeshData, renderMode: RenderMode = 'triangles'): MeshAllocation {
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
            renderMode,
            // Derived from the byte offsets (not cumulative counts) so index-padding from the
            // 4-byte alignment is accounted for. Vertex allocations are always 12 B multiples.
            baseVertex: this.totalVertexBytes / 12,
            firstIndex: this.totalIndexBytes / 2,
        };

        this.allocations.set(meshId, allocation);
        this.totalVertexBytes += alignedVertexSize;
        this.totalIndexBytes += alignedIndexSize;

        // js Map maintains insertion order, so we can use it
        // to assign mesh indices for use in WASM module
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
        this.meshIndexMap.set(meshId, this.meshCount);
        this.meshCount++;

        return allocation;
    }

    get(meshId: string): MeshAllocation | undefined {
        return this.allocations.get(meshId);
    }

    // for WASM module to map string mesh id to mesh index in buffers
    getMeshIndex(meshId: string): number | undefined {
        return this.meshIndexMap.get(meshId);
    }

    // Get reverse mapping from mesh index to mesh ID
    getMeshIndexToIdMap(): Map<number, string> {
        const reverseMap = new Map<number, string>();
        for (const [meshId, meshIndex] of this.meshIndexMap) {
            reverseMap.set(meshIndex, meshId);
        }
        return reverseMap;
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
        this.meshIndexMap.clear();
        this.meshCount = 0;
        this.totalVertexBytes = 0;
        this.totalIndexBytes = 0;
    }
}
