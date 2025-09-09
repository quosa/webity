// Unified renderer with smart rendering strategy for scalable performance
import { EngineError } from './types.js';
import { GeometryBufferManager } from './geometry-buffer-manager.js';
import { InstanceManager, RenderBatch } from './instance-manager.js';
import { MeshRegistry } from './mesh-registry.js';

export interface UnifiedRenderConfig {
    indirectDrawThreshold: number; // Switch to indirect rendering at this object count
    maxDrawCommands: number;
}

export class UnifiedRenderer {
    private device: GPUDevice;
    private context: GPUCanvasContext;
    private geometryManager: GeometryBufferManager;
    private instanceManager: InstanceManager;
    private meshRegistry: MeshRegistry;

    // Rendering pipeline
    private renderPipeline?: GPURenderPipeline;
    private bindGroup?: GPUBindGroup;
    private bindGroupLayout?: any; // GPUBindGroupLayout

    // Uniform buffers
    private viewProjectionBuffer?: GPUBuffer;

    // Depth buffer
    private depthTexture?: any; // GPUTexture

    // Indirect rendering support
    private indirectDrawBuffer?: GPUBuffer;
    private indirectDrawCommands: Uint32Array = new Uint32Array(0);

    // Configuration
    private config: UnifiedRenderConfig = {
        indirectDrawThreshold: 20,
        maxDrawCommands: 1000,
    };

    constructor(
        device: GPUDevice,
        context: GPUCanvasContext,
        geometryManager: GeometryBufferManager,
        instanceManager: InstanceManager,
        meshRegistry: MeshRegistry,
        config?: Partial<UnifiedRenderConfig>
    ) {
        this.device = device;
        this.context = context;
        this.geometryManager = geometryManager;
        this.instanceManager = instanceManager;
        this.meshRegistry = meshRegistry;

        if (config) {
            this.config = { ...this.config, ...config };
        }
    }

    async init(presentationFormat: GPUTextureFormat): Promise<void> {
        this.createDepthTexture();
        await this.createPipeline(presentationFormat);
        await this.createUniformBuffers();
        await this.createIndirectDrawBuffer();
    }

    private async createPipeline(format: GPUTextureFormat): Promise<void> {
        // Create bind group layout
        this.bindGroupLayout = this.device.createBindGroupLayout({
            label: 'Unified Renderer Bind Group Layout',
            entries: [
                {
                    binding: 0, // View/Projection matrices
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' },
                },
                {
                    binding: 1, // Instance transforms
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' },
                },
                {
                    binding: 2, // Instance metadata (material ID, mesh ID, etc.)
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'read-only-storage' },
                },
                {
                    binding: 3, // Material data
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'read-only-storage' },
                },
            ],
        });

        // Create shader module
        const shaderModule = this.device.createShaderModule({
            label: 'Unified Renderer Shader',
            code: this.getUnifiedShaderCode(),
        });

        // Create render pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            label: 'Unified Render Pipeline',
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout],
            }),
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [
                    {
                        arrayStride: 12, // 3 floats * 4 bytes per vertex (position only for now)
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x3',
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [
                    {
                        format: format,
                    },
                ],
            },
            primitive: {
                topology: 'line-list', // Wireframe rendering
                cullMode: 'none',
            },
            ...(this.depthTexture && {
                depthStencil: {
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                    format: 'depth24plus',
                },
            }),
        });
    }

    private async createUniformBuffers(): Promise<void> {
        // View/Projection matrix buffer
        this.viewProjectionBuffer = this.device.createBuffer({
            label: 'View Projection Buffer',
            size: 32 * 4, // 2 matrices * 16 floats * 4 bytes
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    private async createIndirectDrawBuffer(): Promise<void> {
        // Buffer for indirect draw commands
        this.indirectDrawBuffer = this.device.createBuffer({
            label: 'Indirect Draw Buffer',
            size: this.config.maxDrawCommands * 20, // 5 uint32s per draw command
            usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
        });
    }

    private createDepthTexture(): void {
        // Skip depth texture creation in test environments or mock devices
        if (!this.device.createTexture || typeof this.device.createTexture !== 'function') {
            console.warn('Skipping depth texture creation (test environment)');
            return;
        }

        const canvas = this.context.canvas as HTMLCanvasElement;
        const width = canvas?.width || 800;
        const height = canvas?.height || 600;

        this.depthTexture = this.device.createTexture({
            size: [width, height],
            format: 'depth24plus',
            usage: 0x10, // GPUTextureUsage.RENDER_ATTACHMENT
        });
    }

    updateUniformBuffers(wasmMemory: ArrayBuffer, uniformOffset: number): void {
        if (!this.viewProjectionBuffer) return;

        // Extract view and projection matrices from WASM (skip model matrix)
        const wasmUniforms = new Float32Array(wasmMemory, uniformOffset, 48); // 3 matrices * 16 floats
        const viewProjectionData = new Float32Array(32); // 2 matrices * 16 floats

        // Copy view matrix (skip model matrix at offset 0-15)
        viewProjectionData.set(wasmUniforms.slice(16, 32), 0); // View matrix
        viewProjectionData.set(wasmUniforms.slice(32, 48), 16); // Projection matrix

        this.device.queue.writeBuffer(this.viewProjectionBuffer, 0, viewProjectionData);
    }

    render(): void {
        if (!this.renderPipeline || !this.bindGroup) {
            throw new EngineError('Unified renderer not initialized', 'NOT_INITIALIZED');
        }

        // Update instance data
        this.instanceManager.updateBuffers();

        // Get render batches
        const batches = this.instanceManager.getBatches();
        const totalInstances = this.instanceManager.getInstanceCount();

        if (totalInstances === 0) return;

        // Choose rendering strategy based on instance count
        const useIndirectRendering = totalInstances >= this.config.indirectDrawThreshold;

        // Begin render pass
        const commandEncoder = this.device.createCommandEncoder({
            label: 'Unified Render Commands',
        });
        const textureView = this.context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            label: 'Unified Render Pass',
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            ...(this.depthTexture && {
                depthStencilAttachment: {
                    view: this.depthTexture.createView(),
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                },
            }),
        });

        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.geometryManager.getCombinedVertexBuffer());
        renderPass.setIndexBuffer(this.geometryManager.getCombinedIndexBuffer(), 'uint32');

        if (useIndirectRendering) {
            this.renderIndirect(renderPass, batches);
        } else {
            this.renderDirect(renderPass, batches);
        }

        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    private renderDirect(renderPass: any, batches: RenderBatch[]): void {
        // GPURenderPassEncoder
        // Direct rendering - separate draw call per batch
        for (const batch of batches) {
            // For non-contiguous instances, draw each instance individually
            if (batch.instanceCount === 1) {
                this.geometryManager.drawMesh(renderPass, batch.meshId, 1, batch.firstInstance);
            } else {
                // For multiple instances of same type, they should be contiguous after our grouping
                this.geometryManager.drawMesh(
                    renderPass,
                    batch.meshId,
                    batch.instanceCount,
                    batch.firstInstance
                );
            }
        }
    }

    private renderIndirect(renderPass: any, batches: RenderBatch[]): void {
        // GPURenderPassEncoder
        // Prepare indirect draw commands
        this.prepareIndirectCommands(batches);

        // Single indirect draw call for all batches
        if (this.indirectDrawCommands.length > 0) {
            this.device.queue.writeBuffer(
                this.indirectDrawBuffer!,
                0,
                this.indirectDrawCommands.buffer,
                this.indirectDrawCommands.byteOffset,
                this.indirectDrawCommands.byteLength
            );

            // Note: WebGPU indirect drawing is complex and may need feature detection
            // For now, fall back to direct rendering but with optimized batching
            this.renderDirect(renderPass, batches);
        }
    }

    private prepareIndirectCommands(batches: RenderBatch[]): void {
        const commandData = new Uint32Array(batches.length * 5);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            if (!batch) continue;

            const mesh = this.meshRegistry.getMesh(batch.meshId);
            if (!mesh) continue;

            const offset = i * 5;
            // DrawIndexedIndirect structure: indexCount, instanceCount, firstIndex, baseVertex, firstInstance
            commandData[offset + 0] = mesh.indexCount;
            commandData[offset + 1] = batch.instanceCount;
            commandData[offset + 2] = mesh.indexOffset;
            commandData[offset + 3] = mesh.vertexOffset / 3; // Convert to vertex offset
            commandData[offset + 4] = batch.firstInstance;
        }

        this.indirectDrawCommands = commandData;
    }

    updateBindGroup(): void {
        if (!this.bindGroupLayout) return;

        this.bindGroup = this.device.createBindGroup({
            label: 'Unified Render Bind Group',
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.viewProjectionBuffer! },
                },
                {
                    binding: 1,
                    resource: { buffer: this.instanceManager.getInstanceTransformBuffer() },
                },
                {
                    binding: 2,
                    resource: { buffer: this.instanceManager.getInstanceMetadataBuffer() },
                },
                {
                    binding: 3,
                    resource: { buffer: this.geometryManager.getMaterialDataBuffer() },
                },
            ],
        });
    }

    private getUnifiedShaderCode(): string {
        return `
      struct ViewProjectionUniforms {
        view: mat4x4<f32>,
        projection: mat4x4<f32>,
      }

      struct MaterialData {
        color: vec4<f32>,
        properties: vec4<f32>, // wireframe, metallic, roughness, reserved
      }

      @binding(0) @group(0) var<uniform> uniforms: ViewProjectionUniforms;
      @binding(1) @group(0) var<storage, read> instanceTransforms: array<mat4x4<f32>>;
      @binding(2) @group(0) var<storage, read> instanceMetadata: array<vec4<u32>>; // materialId, meshId, objectId, reserved
      @binding(3) @group(0) var<storage, read> materials: array<MaterialData>;

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) world_pos: vec3<f32>,
        @location(1) @interpolate(flat) material_id: u32,
      }

      @vertex
      fn vs_main(
        @location(0) position: vec3<f32>,
        @builtin(instance_index) instance_index: u32
      ) -> VertexOutput {
        var out: VertexOutput;
        
        // Get instance data
        let model_matrix = instanceTransforms[instance_index];
        let metadata = instanceMetadata[instance_index];
        let material_id = metadata.x;
        
        // Transform vertex position
        let world_pos = model_matrix * vec4<f32>(position, 1.0);
        out.position = uniforms.projection * uniforms.view * world_pos;
        out.world_pos = world_pos.xyz;
        out.material_id = material_id;
        
        return out;
      }

      @fragment
      fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        // Get material data
        let material = materials[in.material_id];
        
        // Simple wireframe rendering with material color
        return material.color;
      }
    `;
    }

    getStats(): { instanceCount: number; batchCount: number; geometryStats: any } {
        return {
            instanceCount: this.instanceManager.getInstanceCount(),
            batchCount: this.instanceManager.getBatches().length,
            geometryStats: this.geometryManager.getStats(),
        };
    }

    dispose(): void {
        this.viewProjectionBuffer?.destroy();
        this.indirectDrawBuffer?.destroy();
        this.depthTexture?.destroy();
        this.geometryManager.dispose();
        this.instanceManager.dispose();
    }
}
