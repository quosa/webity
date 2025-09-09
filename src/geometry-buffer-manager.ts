// Unified geometry buffer manager for efficient GPU buffer management
import { EngineError } from './types.js';
import { MeshRegistry, MeshDefinition } from './mesh-registry.js';

export class GeometryBufferManager {
    private device: GPUDevice;
    private meshRegistry: MeshRegistry;

    // Unified GPU buffers
    private combinedVertexBuffer?: GPUBuffer;
    private combinedIndexBuffer?: GPUBuffer;
    private materialDataBuffer?: GPUBuffer;

    // Buffer state tracking
    private vertexBufferSize = 0;
    private indexBufferSize = 0;
    private materialBufferSize = 0;

    constructor(device: GPUDevice, meshRegistry: MeshRegistry) {
        this.device = device;
        this.meshRegistry = meshRegistry;
    }

    async updateBuffers(): Promise<void> {
        await this.updateVertexBuffer();
        await this.updateIndexBuffer();
        await this.updateMaterialBuffer();
    }

    private async updateVertexBuffer(): Promise<void> {
        const vertices = this.meshRegistry.getCombinedVertices();
        const requiredSize = vertices.byteLength;

        // Create or resize vertex buffer if needed
        if (!this.combinedVertexBuffer || this.vertexBufferSize < requiredSize) {
            this.combinedVertexBuffer?.destroy();

            this.vertexBufferSize = Math.max(requiredSize, 1024 * 1024); // 1MB minimum
            this.combinedVertexBuffer = this.device.createBuffer({
                label: 'Unified Vertex Buffer',
                size: this.vertexBufferSize,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });

            console.log(`Created unified vertex buffer: ${this.vertexBufferSize} bytes`);
        }

        // Upload vertex data to GPU
        if (vertices.length > 0) {
            this.device.queue.writeBuffer(
                this.combinedVertexBuffer,
                0,
                vertices.buffer,
                vertices.byteOffset,
                vertices.byteLength
            );
        }
    }

    private async updateIndexBuffer(): Promise<void> {
        const indices = this.meshRegistry.getCombinedIndices();
        const requiredSize = indices.byteLength;

        // Create or resize index buffer if needed
        if (!this.combinedIndexBuffer || this.indexBufferSize < requiredSize) {
            this.combinedIndexBuffer?.destroy();

            this.indexBufferSize = Math.max(requiredSize, 512 * 1024); // 512KB minimum
            this.combinedIndexBuffer = this.device.createBuffer({
                label: 'Unified Index Buffer',
                size: this.indexBufferSize,
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            });

            console.log(`Created unified index buffer: ${this.indexBufferSize} bytes`);
        }

        // Upload index data to GPU
        if (indices.length > 0) {
            this.device.queue.writeBuffer(
                this.combinedIndexBuffer,
                0,
                indices.buffer,
                indices.byteOffset,
                indices.byteLength
            );
        }
    }

    private async updateMaterialBuffer(): Promise<void> {
        const materialData = this.meshRegistry.getMaterialDataBuffer();
        const requiredSize = materialData.byteLength;

        // Create or resize material buffer if needed
        if (!this.materialDataBuffer || this.materialBufferSize < requiredSize) {
            this.materialDataBuffer?.destroy();

            this.materialBufferSize = Math.max(requiredSize, 4096); // 4KB minimum
            this.materialDataBuffer = this.device.createBuffer({
                label: 'Material Data Buffer',
                size: this.materialBufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });

            console.log(`Created material data buffer: ${this.materialBufferSize} bytes`);
        }

        // Upload material data to GPU
        if (materialData.length > 0) {
            this.device.queue.writeBuffer(
                this.materialDataBuffer,
                0,
                materialData.buffer,
                materialData.byteOffset,
                materialData.byteLength
            );
        }
    }

    getCombinedVertexBuffer(): GPUBuffer {
        if (!this.combinedVertexBuffer) {
            throw new EngineError('Vertex buffer not initialized', 'BUFFER_NOT_INITIALIZED');
        }
        return this.combinedVertexBuffer;
    }

    getCombinedIndexBuffer(): GPUBuffer {
        if (!this.combinedIndexBuffer) {
            throw new EngineError('Index buffer not initialized', 'BUFFER_NOT_INITIALIZED');
        }
        return this.combinedIndexBuffer;
    }

    getMaterialDataBuffer(): GPUBuffer {
        if (!this.materialDataBuffer) {
            throw new EngineError('Material buffer not initialized', 'BUFFER_NOT_INITIALIZED');
        }
        return this.materialDataBuffer;
    }

    // Draw a specific mesh with instancing
    drawMesh(renderPass: any, meshId: string, instanceCount: number, firstInstance = 0): void {
        // GPURenderPassEncoder
        const mesh = this.meshRegistry.getMesh(meshId);
        if (!mesh) {
            throw new EngineError(`Mesh '${meshId}' not found in registry`, 'MESH_NOT_FOUND');
        }

        const vertexOffsetInVertices = mesh.vertexOffset / 3;

        if (mesh.indexCount > 0) {
            // Indexed drawing
            renderPass.drawIndexed(
                mesh.indexCount,
                instanceCount,
                mesh.indexOffset,
                vertexOffsetInVertices,
                firstInstance
            );
        } else {
            // Non-indexed drawing
            renderPass.draw(mesh.vertexCount, instanceCount, vertexOffsetInVertices, firstInstance);
        }
    }

    // Get mesh information for external use
    getMeshInfo(meshId: string): MeshDefinition | undefined {
        return this.meshRegistry.getMesh(meshId);
    }

    // Get statistics for debugging
    getStats(): {
        vertexCount: number;
        indexCount: number;
        meshCount: number;
        materialCount: number;
        } {
        return {
            vertexCount: this.meshRegistry.getTotalVertexCount(),
            indexCount: this.meshRegistry.getTotalIndexCount(),
            meshCount: this.meshRegistry.getAllMeshes().size,
            materialCount: this.meshRegistry.getAllMaterials().size,
        };
    }

    dispose(): void {
        this.combinedVertexBuffer?.destroy();
        this.combinedIndexBuffer?.destroy();
        this.materialDataBuffer?.destroy();
    }
}
