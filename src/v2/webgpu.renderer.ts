// src/v2/webgpu.renderer.ts
// Clean WebGPU renderer focused on GPU resource management and rendering
/// <reference types="@webgpu/types" />

import { EntityManager, EntityData, Entity } from './entities';
import { MegaBufferManager } from './buffer-manager';
import { MeshData } from './mesh-registry';

// Types
export type TextureData = {
    image: HTMLImageElement | ImageBitmap;
    // ...other texture params
};

// Re-export types for convenience
export type { MeshData } from './mesh-registry';
export type { EntityData, Entity } from './entities';


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
    private bufferManager!: MegaBufferManager;

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
        this.bufferManager = new MegaBufferManager(this.device);

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
        const megaBuffer = this.bufferManager.getMegaBuffer();
        if (!megaBuffer) return;

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
            this.renderEntities(renderPass, this.renderPipeline, triangleEntities, megaBuffer);
        }

        // Render lines
        if (lineEntities.length > 0) {
            this.renderEntities(renderPass, this.linePipeline, lineEntities, megaBuffer);
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
        megaBuffer: GPUBuffer
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

            // Use mega buffer for all meshes
            const vertexOffset = this.bufferManager.getVertexBufferOffset(meshId);
            renderPass.setVertexBuffer(0, megaBuffer, vertexOffset);
            renderPass.setVertexBuffer(1, instanceBuffer);

            const indexOffset = this.bufferManager.getIndexBufferOffset(meshId);
            renderPass.setIndexBuffer(megaBuffer, 'uint16', indexOffset);
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

    dispose(): void {
        this.bufferManager?.dispose();
        this.depthTexture?.destroy();
        this.textureRegistry.clear();
        this.entityManager = new EntityManager();
    }
}
