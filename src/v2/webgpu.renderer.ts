// src/v2/webgpu.renderer.ts
// Clean WebGPU renderer focused on GPU resource management and rendering
/// <reference types="@webgpu/types" />

import { EntityManager, EntityData } from './entities';
import { GPUBufferManager } from './gpu-buffer-manager';
import { MeshData } from './mesh-registry';

// Types
export type TextureData = {
    image: HTMLImageElement | ImageBitmap;
    // ...other texture params
};

// Re-export types for convenience
export type { MeshData } from './mesh-registry';
export type { EntityData } from './entities';


class Texture {
    gpuTexture: any; // GPUTexture (use 'any' for now to avoid type errors)
    // Extend as needed
    constructor(device: GPUDevice, texture: TextureData) {
        // TODO: Upload image to GPUTexture
        // Placeholder for now
        this.gpuTexture = device.createTexture({
            size: [texture.image.width, texture.image.height, 1],
            format: 'rgba8unorm',
            usage: 0x04 | 0x02, // GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
    }
}

export class WebGPURendererV2 {
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private presentationFormat!: GPUTextureFormat;

    private renderPipeline!: GPURenderPipeline; // main triangle pipeline
    private linePipeline!: GPURenderPipeline; // line pipeline (for grid)
    private uniformBuffer!: GPUBuffer;
    private bindGroup!: GPUBindGroup;

    private textureRegistry = new Map<string, Texture>();

    // New architecture components
    private entityManager = new EntityManager();
    private bufferManager!: GPUBufferManager;

    private depthTexture!: any; // GPUTexture

    async init(canvas: HTMLCanvasElement): Promise<void> {
        // Setup device/context
        const adapter = await navigator.gpu.requestAdapter();
        this.device = await adapter!.requestDevice();
        this.context = canvas.getContext('webgpu')!;
        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: 'opaque',
        });

        // Initialize buffer manager
        this.bufferManager = new GPUBufferManager(this.device);

        // Create depth texture
        this.createDepthTexture(canvas);

        // Create shaders and pipeline
        this.createRenderPipeline();
        this.createUniformBuffer();
    }

    private createDepthTexture(canvas: HTMLCanvasElement): void {
        this.depthTexture = this.device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'depth24plus',
            usage: 0x10, // GPUTextureUsage.RENDER_ATTACHMENT
        });
    }

    private createRenderPipeline(): void {
        // Vertex shader: transforms vertices from model space to screen space
        const vertexShader = `
      struct Uniforms {
        viewProjectionMatrix: mat4x4<f32>,
      }
      @binding(0) @group(0) var<uniform> uniforms: Uniforms;

      struct VertexInput {
        @builtin(vertex_index) vertexIndex: u32,
        @location(0) position: vec3<f32>,
      }

      struct InstanceInput {
        @location(1) transform_0: vec4<f32>, // Transform matrix row 0
        @location(2) transform_1: vec4<f32>, // Transform matrix row 1
        @location(3) transform_2: vec4<f32>, // Transform matrix row 2
        @location(4) transform_3: vec4<f32>, // Transform matrix row 3
        @location(5) color: vec4<f32>,       // Instance color
      }

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
      }

      @vertex
      fn main(vertex: VertexInput, instance: InstanceInput) -> VertexOutput {
        let vertexPosition = vertex.position;

        // Reconstruct transform matrix from instance data
        let transformMatrix = mat4x4<f32>(
          instance.transform_0,
          instance.transform_1,
          instance.transform_2,
          instance.transform_3
        );

        // Apply transform matrix
        let worldPosition = transformMatrix * vec4<f32>(vertexPosition, 1.0);

        // Apply view-projection matrix
        let clipPosition = uniforms.viewProjectionMatrix * worldPosition;

        var output: VertexOutput;
        output.position = clipPosition;
        output.color = instance.color;

        return output;
      }
    `;

        // Fragment shader: use instance color
        const fragmentShader = `
      struct FragmentInput {
        @location(0) color: vec4<f32>,
      }

      @fragment
      fn main(input: FragmentInput) -> @location(0) vec4<f32> {
        return input.color;
      }
    `;
        // Create shader modules with error checking
        let vertexModule, fragmentModule;
        try {
            vertexModule = this.device.createShaderModule({ code: vertexShader });
        } catch (error) {
            console.error('❌ Vertex shader compilation failed:', error);
            throw error;
        }

        try {
            fragmentModule = this.device.createShaderModule({ code: fragmentShader });
        } catch (error) {
            console.error('❌ Fragment shader compilation failed:', error);
            throw error;
        }

        // Define vertex buffer layout
        const vertexBufferLayout = {
            arrayStride: 3 * 4, // 3 floats * 4 bytes = 12 bytes per vertex
            attributes: [
                {
                    format: 'float32x3',
                    offset: 0,
                    shaderLocation: 0, // @location(0) in vertex shader
                },
            ],
        };

        // Define instance buffer layout (transform matrix + color) - back to slot 1
        const instanceBufferLayout = {
            arrayStride: (16 + 4) * 4, // 16 floats (4x4 matrix) + 4 floats (color) * 4 bytes = 80 bytes
            stepMode: 'instance',
            attributes: [
                // Transform matrix (4 vec4s)
                { format: 'float32x4', offset: 0, shaderLocation: 1 }, // transform row 0
                { format: 'float32x4', offset: 16, shaderLocation: 2 }, // transform row 1
                { format: 'float32x4', offset: 32, shaderLocation: 3 }, // transform row 2
                { format: 'float32x4', offset: 48, shaderLocation: 4 }, // transform row 3
                // Color
                { format: 'float32x4', offset: 64, shaderLocation: 5 }, // color
            ],
        };

        // Create bind group layout for uniforms
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' },
                },
            ],
        });

        // Create pipeline layout
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        // Create triangle render pipeline (vertex buffer + instance buffer)
        this.renderPipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: vertexModule,
                entryPoint: 'main',
                buffers: [vertexBufferLayout, instanceBufferLayout] as any,
            },
            fragment: {
                module: fragmentModule,
                entryPoint: 'main',
                targets: [{ format: this.presentationFormat }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
                frontFace: 'ccw', // counter-clockwise front face - i.e. right-handed system
                // stripIndexFormat: undefined,
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
        });

        // Create line render pipeline (reuse shaders, change topology)
        this.linePipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: vertexModule,
                entryPoint: 'main',
                buffers: [vertexBufferLayout, instanceBufferLayout] as any,
            },
            fragment: {
                module: fragmentModule,
                entryPoint: 'main',
                targets: [{ format: this.presentationFormat }],
            },
            primitive: {
                topology: 'line-list',
                cullMode: 'back',
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
        });

        // TODO: consider a point pipeline for point clouds
        // would have primitive.topology: 'point-list'
    }

    private createUniformBuffer(): void {
        // Create uniform buffer (view-projection matrix will be set externally)
        this.uniformBuffer = this.device.createBuffer({
            size: 64, // 4x4 matrix = 16 floats * 4 bytes = 64 bytes
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Initialize with identity matrix
        const identityMatrix = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, identityMatrix.buffer);

        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer },
                },
            ],
        });
    }

    // Set view-projection matrix from external camera
    setViewProjectionMatrix(matrix: Float32Array): void {
        this.device.queue.writeBuffer(this.uniformBuffer, 0, matrix.buffer);
    }

    registerMesh(meshId: string, mesh: MeshData): void {
        this.bufferManager.registerMesh(meshId, mesh);
        // Build buffers immediately after registering (for now - can be optimized later)
        this.bufferManager.buildSharedBuffers();
    }

    getMeshIndex(meshId: string): number | undefined {
        return this.bufferManager.getMeshIndex(meshId);
    }

    registerTexture(textureId: string, texture: TextureData): void {
        this.textureRegistry.set(textureId, new Texture(this.device, texture));
    }

    addEntity(entityData: EntityData): void {
        this.entityManager.add(entityData);
    }

    updateEntity(id: string, updates: Partial<EntityData>): void {
        this.entityManager.update(id, updates);
    }

    removeEntity(id: string): void {
        this.entityManager.remove(id);
    }

    clearEntities(): void {
        this.entityManager = new EntityManager();
    }

    render(): void {
        throw new Error('old rendering pipeline is deprecated!!! Use renderFromWasmBuffers() or mapInstanceDataFromWasm() instead.');
    }

    /*
    render(): void {
        const sharedVertexBuffer = this.bufferManager.getSharedVertexBuffer();
        const sharedIndexBuffer = this.bufferManager.getSharedIndexBuffer();
        if (!sharedVertexBuffer || !sharedIndexBuffer) return;

        // Group entities by render mode first, then by mesh
        const triangleEntities = this.entityManager.getByRenderMode('triangles');
        const lineEntities = this.entityManager.getByRenderMode('lines');
        // Begin render pass with depth testing
        const commandEncoder = this.device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.context.getCurrentTexture().createView(),
                    clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        // Render triangles
        if (triangleEntities.length > 0) {
            this.renderEntities(renderPass, this.renderPipeline, triangleEntities, sharedVertexBuffer, sharedIndexBuffer);
        }

        // Render lines
        if (lineEntities.length > 0) {
            this.renderEntities(renderPass, this.linePipeline, lineEntities, sharedVertexBuffer, sharedIndexBuffer);
        }

        // End render pass and submit
        renderPass.end();
        const commandBuffer = commandEncoder.finish();

        this.device.queue.submit([commandBuffer]);
    }

    private renderEntities(
        renderPass: any, // GPURenderPassEncoder
        pipeline: GPURenderPipeline,
        entities: Entity[],
        sharedVertexBuffer: GPUBuffer,
        sharedIndexBuffer: GPUBuffer
    ): void {
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, this.bindGroup);

        // Group by mesh for instanced rendering
        const meshGroups = new Map<string, Entity[]>();
        for (const entity of entities) {
            const meshId = entity.data.meshId;
            if (!meshGroups.has(meshId)) {
                meshGroups.set(meshId, []);
            }
            meshGroups.get(meshId)!.push(entity);
        }

        // Render each mesh group
        for (const [meshId, instances] of meshGroups) {
            const allocation = this.bufferManager.getMeshAllocation(meshId);
            if (!allocation) {
                console.warn(`Mesh allocation not found: ${meshId}`);
                continue;
            }


            // Create instance buffer for this group
            const instanceBuffer = this.createInstanceBuffer(instances);

            // Use shared vertex and index buffers with offsets
            const vertexOffset = this.bufferManager.getVertexBufferOffset(meshId);
            renderPass.setVertexBuffer(0, sharedVertexBuffer, vertexOffset);
            renderPass.setVertexBuffer(1, instanceBuffer);

            const indexOffset = this.bufferManager.getIndexBufferOffset(meshId);
            renderPass.setIndexBuffer(sharedIndexBuffer, 'uint16', indexOffset);
            renderPass.drawIndexed(allocation.indexCount, instances.length);
        }
    }

    private createInstanceBuffer(entities: Entity[]): GPUBuffer {
        // Create instance data: [transform matrix (16 floats) + color (4 floats)] per instance
        const instanceData = new Float32Array(entities.length * 20); // 20 floats per instance

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i]!;
            const offset = i * 20;

            // Get transform matrix from entity
            const transform = entity.getTransformMatrix();
            instanceData.set(transform, offset);

            // Copy color (4 floats)
            instanceData.set(entity.data.color, offset + 16);
        }

        // Create instance buffer
        const instanceBuffer = this.device.createBuffer({
            size: instanceData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(instanceBuffer.getMappedRange()).set(instanceData);
        instanceBuffer.unmap();

        return instanceBuffer;
    }
    */

    // Phase 5: Zero-copy WASM buffer integration
    mapInstanceDataFromWasm(wasmMemory: ArrayBuffer, offset: number, count: number): void {
        console.log(`🚀 WebGPURendererV2: Mapping ${count} instances from WASM buffer`);

        // Validate WASM buffer access
        if (!this.bufferManager.validateWasmBufferAccess(wasmMemory, offset, count)) {
            console.error('❌ WASM buffer validation failed');
            return;
        }

        // Map WASM data directly to GPU instance buffer
        this.bufferManager.mapInstanceDataFromWasm(wasmMemory, offset, count);
    }

    // Helper: Read mesh ID for specific entity from WASM metadata
    private getEntityMeshId(wasmMemory: ArrayBuffer, metadataOffset: number, metadataSize: number, entityIndex: number): number {
        // EntityMetadata structure in WASM (from game_engine.zig) - Zig struct alignment:
        // id: u32 (offset 0, 4 bytes)
        // mesh_id: u32 (offset 4, 4 bytes) ⭐ CORRECTED!
        // material_id: u32 (offset 8, 4 bytes)
        // active: bool (offset 12, 1 byte)
        // physics_enabled: bool (offset 13, 1 byte)
        // rendering_enabled: bool (offset 14, 1 byte)
        // transform_dirty: bool (offset 15, 1 byte)

        const entityMetadataOffset = metadataOffset + (entityIndex * metadataSize);
        const meshIdOffset = entityMetadataOffset + 4; // mesh_id is at offset 4 bytes (FIXED!)

        // Read mesh_id as u32 from WASM memory
        const meshIdView = new Uint32Array(wasmMemory, meshIdOffset, 1);
        return meshIdView[0]!;
    }

    // Helper: Convert WASM mesh ID to TypeScript mesh string
    private wasmMeshIdToString(wasmMeshId: number): string {
        // Build reverse mapping from mesh index to mesh ID
        const meshIndexToId = this.bufferManager.getMeshIndexToIdMap();
        const meshId = meshIndexToId.get(wasmMeshId);

        if (meshId) {
            return meshId;
        }

        console.warn(`⚠️ Unknown WASM mesh index: ${wasmMeshId}, cannot find corresponding mesh ID`);
        // Return a placeholder that won't match any registered mesh
        return `unknown_mesh_${wasmMeshId}`;
    }

    // Phase 6: 2-pass WASM rendering (triangles + lines) - eliminates TypeScript rendering
    renderFromWasmBuffers(wasmModule?: { memory: WebAssembly.Memory, get_entity_metadata_offset(): number, get_entity_metadata_size(): number }): void {
        const sharedVertexBuffer = this.bufferManager.getSharedVertexBuffer();
        const sharedIndexBuffer = this.bufferManager.getSharedIndexBuffer();
        const instanceBuffer = this.bufferManager.getInstanceBuffer();

        if (!sharedVertexBuffer || !sharedIndexBuffer || !instanceBuffer) {
            console.warn('⚠️ Required buffers not available for WASM rendering');
            return;
        }

        console.log('🚀 Phase 6: 2-pass WASM rendering (triangles + lines)');

        // Begin render pass with depth testing
        const commandEncoder = this.device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.context.getCurrentTexture().createView(),
                    clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        const instanceCount = this.bufferManager.getWasmEntityCount();

        // 🔒 CRITICAL: Validate instance count before rendering to prevent ghost triangles
        const maxSafeInstanceCount = 1000; // Reasonable upper bound
        if (instanceCount > 0 && instanceCount <= maxSafeInstanceCount) {
            console.log(`🎯 2-pass rendering of ${instanceCount} validated WASM instances`);

            // PASS 1: Render triangle entities (sphere, cube, pyramid)
            this.renderWasmInstancesByMode(renderPass, this.renderPipeline, instanceCount, sharedVertexBuffer, sharedIndexBuffer, instanceBuffer, 'triangles', wasmModule);

            // PASS 2: Render line entities (grid)
            this.renderWasmInstancesByMode(renderPass, this.linePipeline, instanceCount, sharedVertexBuffer, sharedIndexBuffer, instanceBuffer, 'lines', wasmModule);

        } else if (instanceCount > maxSafeInstanceCount) {
            console.error(`❌ Suspicious instance count ${instanceCount} - refusing to render (possible buffer corruption)`);
        }

        // End render pass and submit
        renderPass.end();
        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
    }

    // New method: Render WASM instances filtered by render mode (triangles or lines)
    private renderWasmInstancesByMode(
        renderPass: any, // GPURenderPassEncoder
        pipeline: GPURenderPipeline,
        instanceCount: number,
        sharedVertexBuffer: GPUBuffer,
        sharedIndexBuffer: GPUBuffer,
        instanceBuffer: GPUBuffer,
        renderMode: 'triangles' | 'lines',
        wasmModule?: { memory: WebAssembly.Memory, get_entity_metadata_offset(): number, get_entity_metadata_size(): number }
    ): void {
        console.log(`🎯 Pass: ${renderMode} rendering`);

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, this.bindGroup);

        if (!wasmModule?.memory) {
            console.error(`❌ WASM module not available for ${renderMode} pass`);
            return;
        }

        // Get WASM metadata info
        const metadataOffset = wasmModule.get_entity_metadata_offset();
        let metadataSize: number;
        if (typeof wasmModule.get_entity_metadata_size === 'function') {
            metadataSize = wasmModule.get_entity_metadata_size();
        } else {
            metadataSize = 16; // Fallback size
        }

        const wasmMemory = wasmModule.memory.buffer;

        // Determine which mesh types belong to this render mode
        const triangleMeshes = ['triangle', 'cube', 'sphere', 'pyramid']; // Triangle meshes
        const lineMeshes = ['grid']; // Line meshes
        const targetMeshes = renderMode === 'triangles' ? triangleMeshes : lineMeshes;

        console.log(`🔍 ${renderMode} pass: Looking for meshes: ${targetMeshes.join(', ')}`);

        // Debug: Check what mesh IDs WASM actually stored using the debug function
        if (renderMode === 'triangles' && 'debug_get_entity_mesh_id' in wasmModule) { // Only log once per render cycle
            console.log('🔧 WASM Debug - Stored mesh IDs:');
            for (let i = 0; i < instanceCount; i++) {
                const storedMeshId = (wasmModule as any).debug_get_entity_mesh_id(i);
                console.log(`  Entity ${i}: stored mesh_id=${storedMeshId}`);
            }
        }

        // Group entities by mesh type, filtering for this render mode
        const meshGroups = new Map<string, number[]>(); // meshId -> array of entity indices

        for (let entityIndex = 0; entityIndex < instanceCount; entityIndex++) {
            try {
                const wasmMeshId = this.getEntityMeshId(wasmMemory, metadataOffset, metadataSize, entityIndex);
                const meshId = this.wasmMeshIdToString(wasmMeshId);
                console.log(`🔍 Entity ${entityIndex}: WASM mesh_id=${wasmMeshId} → "${meshId}"`);

                // Filter: only include meshes for this render mode
                if (!targetMeshes.includes(meshId)) {
                    continue; // Skip entities that don't match this render mode
                }

                if (!meshGroups.has(meshId)) {
                    meshGroups.set(meshId, []);
                }
                meshGroups.get(meshId)!.push(entityIndex);
            } catch (error) {
                console.error(`❌ Error reading mesh_id for entity ${entityIndex} in ${renderMode} pass:`, error);
            }
        }

        const totalEntitiesForMode = Array.from(meshGroups.values()).reduce((sum, indices) => sum + indices.length, 0);
        console.log(`🎯 ${renderMode} pass: Found ${totalEntitiesForMode} entities in ${meshGroups.size} mesh groups`);

        // Render each mesh group for this mode
        for (const [meshId, entityIndices] of meshGroups) {
            if (entityIndices.length === 0) continue;

            const allocation = this.bufferManager.getMeshAllocation(meshId);
            if (!allocation) {
                console.warn(`⚠️ Mesh allocation not found for '${meshId}' - skipping ${entityIndices.length} entities`);
                continue;
            }

            console.log(`🎯 ${renderMode} pass: Rendering ${entityIndices.length} '${meshId}' entities`);

            // Set vertex buffer with mesh-specific offset
            const vertexOffset = this.bufferManager.getVertexBufferOffset(meshId);
            renderPass.setVertexBuffer(0, sharedVertexBuffer, vertexOffset);

            // Set index buffer with mesh-specific offset
            const indexOffset = this.bufferManager.getIndexBufferOffset(meshId);
            renderPass.setIndexBuffer(sharedIndexBuffer, 'uint16', indexOffset);

            // Render entities in batches
            const batchSize = 100;
            for (let i = 0; i < entityIndices.length; i += batchSize) {
                const batchIndices = entityIndices.slice(i, Math.min(i + batchSize, entityIndices.length));

                const firstEntityIndex = batchIndices[0]!;
                const instanceOffset = firstEntityIndex * 20 * 4; // 20 floats * 4 bytes per instance
                renderPass.setVertexBuffer(1, instanceBuffer, instanceOffset);

                renderPass.drawIndexed(allocation.indexCount, batchIndices.length);
            }
        }

        console.log(`✅ ${renderMode} pass complete: ${totalEntitiesForMode} entities rendered`);
    }



    // Scene system integration methods
    updateEntities(entities: EntityData[]): void {
        // Clear existing entities and add new ones
        this.clearEntities();
        for (const entity of entities) {
            this.addEntity(entity);
        }
    }

    updateCamera(viewProjectionMatrix: Float32Array): void {
        this.setViewProjectionMatrix(viewProjectionMatrix);
    }

    getAspectRatio(): number {
        // Get aspect ratio from canvas
        const canvas = this.context.canvas;
        return canvas.width / canvas.height;
    }

    dispose(): void {
        this.bufferManager?.dispose();
        this.depthTexture?.destroy();
        this.textureRegistry.clear();
        this.entityManager = new EntityManager();
    }
}
