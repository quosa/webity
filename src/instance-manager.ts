// Efficient instance management for transform, material, and mesh data
import { ENGINE_CONSTANTS, EngineError } from './types.js';

export interface InstanceData {
    transform: Float32Array; // 4x4 matrix (16 floats)
    materialId: number;
    meshId: string;
    objectId?: number; // Optional reference to game object
}

export interface RenderBatch {
    meshId: string;
    materialId: number;
    instanceCount: number;
    firstInstance: number;
}

export class InstanceManager {
    private device: GPUDevice;

    // Instance data storage
    private instances: InstanceData[] = [];
    private instanceTransformBuffer?: GPUBuffer;
    private instanceMetadataBuffer?: GPUBuffer; // Material ID, mesh ID per instance

    // Batching optimization
    private batches: RenderBatch[] = [];
    private batchesDirty = true;
    private maxInstances: number;

    constructor(device: GPUDevice, maxInstances = ENGINE_CONSTANTS.MAX_ENTITIES) {
        this.device = device;
        this.maxInstances = maxInstances;
        this.createBuffers();
    }

    private createBuffers(): void {
        // Transform buffer - 4x4 matrices for each instance
        this.instanceTransformBuffer = this.device.createBuffer({
            label: 'Instance Transform Buffer',
            size: this.maxInstances * 16 * 4, // 16 floats * 4 bytes per instance
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // Metadata buffer - material ID, mesh ID (as hash), etc. per instance
        this.instanceMetadataBuffer = this.device.createBuffer({
            label: 'Instance Metadata Buffer',
            size: this.maxInstances * 4 * 4, // 4 integers * 4 bytes per instance
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        console.log(`Created instance buffers for ${this.maxInstances} instances`);
    }

    addInstance(instanceData: InstanceData): number {
        if (this.instances.length >= this.maxInstances) {
            throw new EngineError(
                `Maximum instances exceeded: ${this.maxInstances}`,
                'MAX_INSTANCES_EXCEEDED'
            );
        }

        const instanceIndex = this.instances.length;
        this.instances.push(instanceData);
        this.batchesDirty = true;

        return instanceIndex;
    }

    updateInstance(index: number, instanceData: Partial<InstanceData>): void {
        if (index < 0 || index >= this.instances.length) {
            throw new EngineError(`Invalid instance index: ${index}`, 'INVALID_INSTANCE_INDEX');
        }

        const instance = this.instances[index];
        if (!instance) {
            throw new EngineError(`Instance at index ${index} is undefined`, 'INSTANCE_UNDEFINED');
        }

        if (instanceData.transform) {
            instance.transform = instanceData.transform;
        }
        if (instanceData.materialId !== undefined) {
            instance.materialId = instanceData.materialId;
            this.batchesDirty = true; // Material change affects batching
        }
        if (instanceData.meshId !== undefined) {
            instance.meshId = instanceData.meshId;
            this.batchesDirty = true; // Mesh change affects batching
        }
        if (instanceData.objectId !== undefined) {
            instance.objectId = instanceData.objectId;
        }
    }

    removeInstance(index: number): void {
        if (index < 0 || index >= this.instances.length) {
            throw new EngineError(`Invalid instance index: ${index}`, 'INVALID_INSTANCE_INDEX');
        }

        this.instances.splice(index, 1);
        this.batchesDirty = true;
    }

    clearInstances(): void {
        this.instances.length = 0;
        this.batches.length = 0;
        this.batchesDirty = true;
    }

    // Update GPU buffers with current instance data
    updateBuffers(): void {
        if (this.instances.length === 0) return;

        // Update transform buffer
        const transformData = new Float32Array(this.instances.length * 16);
        for (let i = 0; i < this.instances.length; i++) {
            const instance = this.instances[i];
            if (!instance) continue;

            const transform = instance.transform;
            transformData.set(transform, i * 16);
        }
        this.device.queue.writeBuffer(this.instanceTransformBuffer!, 0, transformData);

        // Update metadata buffer
        const metadataData = new Uint32Array(this.instances.length * 4);
        for (let i = 0; i < this.instances.length; i++) {
            const instance = this.instances[i];
            if (!instance) continue;

            metadataData[i * 4 + 0] = instance.materialId;
            metadataData[i * 4 + 1] = this.hashString(instance.meshId); // Convert mesh ID to hash
            metadataData[i * 4 + 2] = instance.objectId || 0;
            metadataData[i * 4 + 3] = 0; // Reserved
        }
        this.device.queue.writeBuffer(this.instanceMetadataBuffer!, 0, metadataData);

        // Update batches if needed
        if (this.batchesDirty) {
            this.updateBatches();
            this.batchesDirty = false;
        }
    }

    // Create optimal render batches by grouping instances with same mesh+material
    private updateBatches(): void {
        this.batches.length = 0;

        if (this.instances.length === 0) return;

        // Group instances by mesh+material combination in deterministic order
        const batchGroups: Array<{
            key: string;
            meshId: string;
            materialId: number;
            instanceIndices: number[];
        }> = [];

        // First pass: identify unique mesh+material combinations in order of first appearance
        const seenKeys = new Set<string>();
        for (let i = 0; i < this.instances.length; i++) {
            const instance = this.instances[i];
            if (!instance) continue;

            const key = `${instance.meshId}:${instance.materialId}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                batchGroups.push({
                    key,
                    meshId: instance.meshId,
                    materialId: instance.materialId,
                    instanceIndices: [],
                });
            }
        }

        // Second pass: collect all instances for each group
        for (let i = 0; i < this.instances.length; i++) {
            const instance = this.instances[i];
            if (!instance) continue;

            const key = `${instance.meshId}:${instance.materialId}`;
            const group = batchGroups.find(g => g.key === key);
            if (group) {
                group.instanceIndices.push(i);
            }
        }

        // BALANCED APPROACH: Keep instances in original positions, use individual draw calls for correctness
        // This ensures correct rendering while still allowing some batching optimizations
        for (const group of batchGroups) {
            const indices = group.instanceIndices.sort((a, b) => a - b);

            // Check if all instances in this group are contiguous
            let isContiguous = indices.length > 1;
            for (let i = 1; i < indices.length && isContiguous; i++) {
                const current = indices[i];
                const previous = indices[i - 1];
                if (current === undefined || previous === undefined || current !== previous + 1) {
                    isContiguous = false;
                }
            }

            if (isContiguous && indices[0] !== undefined) {
                // All instances are contiguous - single efficient batch
                this.batches.push({
                    meshId: group.meshId,
                    materialId: group.materialId,
                    instanceCount: indices.length,
                    firstInstance: indices[0],
                });
            } else {
                // Non-contiguous instances - individual draw calls for correctness
                for (const instanceIndex of indices) {
                    this.batches.push({
                        meshId: group.meshId,
                        materialId: group.materialId,
                        instanceCount: 1,
                        firstInstance: instanceIndex,
                    });
                }
            }
        }

        // Optional debug logging (can be removed in production)
        // console.log(`⚖️ Created ${this.batches.length} batches with balanced approach`);
    }

    getBatches(): RenderBatch[] {
        return this.batches;
    }

    getInstanceTransformBuffer(): GPUBuffer {
        if (!this.instanceTransformBuffer) {
            throw new EngineError(
                'Instance transform buffer not initialized',
                'BUFFER_NOT_INITIALIZED'
            );
        }
        return this.instanceTransformBuffer;
    }

    getInstanceMetadataBuffer(): GPUBuffer {
        if (!this.instanceMetadataBuffer) {
            throw new EngineError(
                'Instance metadata buffer not initialized',
                'BUFFER_NOT_INITIALIZED'
            );
        }
        return this.instanceMetadataBuffer;
    }

    getInstanceCount(): number {
        return this.instances.length;
    }

    getMaxInstances(): number {
        return this.maxInstances;
    }

    // Utility function to hash string to uint32
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    // Get statistics for debugging
    getStats(): { instanceCount: number; batchCount: number; maxInstances: number } {
        return {
            instanceCount: this.instances.length,
            batchCount: this.batches.length,
            maxInstances: this.maxInstances,
        };
    }

    dispose(): void {
        this.instanceTransformBuffer?.destroy();
        this.instanceMetadataBuffer?.destroy();
    }
}
