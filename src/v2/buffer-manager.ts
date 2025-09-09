// src/v2/buffer-manager.ts

import { MeshRegistry, MeshData, MeshAllocation } from './mesh-registry';

export class MegaBufferManager {
    private device: GPUDevice;
    private megaBuffer: GPUBuffer | null = null;
    private meshRegistry = new MeshRegistry();
    private meshDataCache = new Map<string, MeshData>();

    // Start with 10MB for vertices, 5MB for indices
    private static readonly INITIAL_VERTEX_SIZE = 10 * 1024 * 1024;
    private static readonly INITIAL_INDEX_SIZE = 5 * 1024 * 1024;
    private currentBufferSize = 0;

    constructor(device: GPUDevice) {
        this.device = device;
    }

    // Register mesh and cache data (upload happens later via uploadAllMeshes)
    registerMesh(meshId: string, meshData: MeshData): void {
        // Skip if already registered
        if (this.meshRegistry.get(meshId)) {
            console.warn(`Mesh ${meshId} already registered`);
            return;
        }

        // Allocate space in registry
        this.meshRegistry.allocate(meshId, meshData);
        // const allocation = this.meshRegistry.allocate(meshId, meshData);
        // console.log(`Allocated mesh ${meshId}:`, allocation);
        this.meshDataCache.set(meshId, meshData);

        // Check if we need to expand the buffer
        const requiredSize = this.meshRegistry.getTotalVertexBytes() + this.meshRegistry.getTotalIndexBytes();
        if (requiredSize > this.currentBufferSize) {
            this.expandBuffer();
        }

        // Upload all mesh data in correct order (vertices first, then indices)
        this.uploadAllMeshes();
    }

    // Upload all registered meshes in the correct buffer layout order
    private uploadAllMeshes(): void {
        if (!this.megaBuffer) return;

        const allocations = this.meshRegistry.getAllocations();

        // First pass: upload all vertex data
        for (const [meshId, allocation] of allocations) {
            const meshData = this.meshDataCache.get(meshId);
            if (meshData) {
                // console.log(`Uploading vertices for ${meshId} at offset ${allocation.vertexOffset}`);
                this.device.queue.writeBuffer(
                    this.megaBuffer,
                    allocation.vertexOffset,
                    meshData.vertices.buffer,
                    meshData.vertices.byteOffset,
                    meshData.vertices.byteLength
                );
            }
        }

        // Second pass: upload all index data (after all vertex data)
        const totalVertexBytes = this.meshRegistry.getTotalVertexBytes();
        for (const [meshId, allocation] of allocations) {
            const meshData = this.meshDataCache.get(meshId);
            if (meshData) {
                const indexByteLength = meshData.indices.byteLength;
                const alignedIndexByteLength = Math.ceil(indexByteLength / 4) * 4;
                const indexBufferOffset = totalVertexBytes + allocation.indexOffset;

                // console.log(`Uploading indices for ${meshId} at offset ${indexBufferOffset}`);

                if (indexByteLength === alignedIndexByteLength) {
                    this.device.queue.writeBuffer(
                        this.megaBuffer,
                        indexBufferOffset,
                        meshData.indices.buffer,
                        meshData.indices.byteOffset,
                        indexByteLength
                    );
                } else {
                    // Need to pad to 4-byte alignment
                    const paddedBuffer = new ArrayBuffer(alignedIndexByteLength);
                    const paddedView = new Uint8Array(paddedBuffer);
                    const originalView = new Uint8Array(meshData.indices.buffer, meshData.indices.byteOffset, indexByteLength);
                    paddedView.set(originalView);

                    this.device.queue.writeBuffer(
                        this.megaBuffer,
                        indexBufferOffset,
                        paddedBuffer,
                        0,
                        alignedIndexByteLength
                    );
                }
            }
        }
    }

    private expandBuffer(): void {
        const requiredVertexBytes = this.meshRegistry.getTotalVertexBytes();
        const requiredIndexBytes = this.meshRegistry.getTotalIndexBytes();
        const requiredTotal = requiredVertexBytes + requiredIndexBytes;

        // Calculate new buffer size (double until it fits, with minimum sizes)
        let newSize = Math.max(
            MegaBufferManager.INITIAL_VERTEX_SIZE + MegaBufferManager.INITIAL_INDEX_SIZE,
            this.currentBufferSize
        );

        while (newSize < requiredTotal) {
            newSize *= 2;
        }

        console.log(`Expanding buffer from ${this.currentBufferSize} to ${newSize} bytes`);

        // Create new buffer
        const oldBuffer = this.megaBuffer;
        this.megaBuffer = this.device.createBuffer({
            size: newSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: false,
        });

        // Copy existing data if we had an old buffer
        if (oldBuffer && this.currentBufferSize > 0) {
            const commandEncoder = this.device.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(
                oldBuffer,
                0,
                this.megaBuffer,
                0,
                this.currentBufferSize
            );
            this.device.queue.submit([commandEncoder.finish()]);

            // Cleanup old buffer
            oldBuffer.destroy();
        }

        this.currentBufferSize = newSize;
    }


    getMegaBuffer(): GPUBuffer | null {
        return this.megaBuffer;
    }

    getMeshAllocation(meshId: string): MeshAllocation | undefined {
        return this.meshRegistry.get(meshId);
    }

    getMeshData(meshId: string): MeshData | undefined {
        return this.meshDataCache.get(meshId);
    }

    getVertexBufferOffset(meshId: string): number {
        const allocation = this.meshRegistry.get(meshId);
        if (!allocation) {
            throw new Error(`Mesh ${meshId} not found in registry`);
        }
        return allocation.vertexOffset;
    }

    getIndexBufferOffset(meshId: string): number {
        const allocation = this.meshRegistry.get(meshId);
        if (!allocation) {
            throw new Error(`Mesh ${meshId} not found in registry`);
        }
        const totalVertexBytes = this.meshRegistry.getTotalVertexBytes();
        return totalVertexBytes + allocation.indexOffset;
    }

    getTotalVertexBytes(): number {
        return this.meshRegistry.getTotalVertexBytes();
    }

    dispose(): void {
        this.megaBuffer?.destroy();
        this.megaBuffer = null;
        this.meshRegistry.clear();
        this.meshDataCache.clear();
        this.currentBufferSize = 0;
    }
}