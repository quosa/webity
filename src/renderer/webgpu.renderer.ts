// Clean WebGPU renderer focused on GPU resource management and WASM-driven instanced rendering
/// <reference types="@webgpu/types" />
// (If your tsconfig lib already includes 'dom', these ambient global WebGPU types will exist.)
// Add defensive, minimal declarations for editors/build setups missing @webgpu/types. Erased at runtime.
declare const GPUTextureUsage: {
    COPY_SRC: number; COPY_DST: number; TEXTURE_BINDING: number; STORAGE_BINDING: number; RENDER_ATTACHMENT: number;
};
declare const GPUBufferUsage: {
    MAP_READ: number; MAP_WRITE: number; COPY_SRC: number; COPY_DST: number; INDEX: number; VERTEX: number; UNIFORM: number; STORAGE: number; INDIRECT: number; QUERY_RESOLVE: number;
};
// Minimal shape for GPUTexture to satisfy TS if DOM lib absent
interface GPUTexture { createView(descriptor?: any): any; destroy(): void; }


// import { EntityManager, EntityData } from './entities';
import { GPUBufferManager } from './gpu-buffer-manager';
import { MeshData, RenderMode } from './mesh-registry';

// The only WASM surface the render path needs: the per-mesh draw table (B3). Narrow on purpose —
// render() no longer reads wasm memory, so it must not require `memory` (keeps mocking simple).
interface MeshBucketSource {
    get_mesh_bucket_start(meshIndex: number): number;
    get_mesh_bucket_count(meshIndex: number): number;
}

// Types
export type TextureData = {
    image: HTMLImageElement | ImageBitmap;
    // ...other texture params
};

// Re-export types for convenience
export type { MeshData } from './mesh-registry';
export type { EntityData } from '../engine/entities';


class Texture {
    gpuTexture: GPUTexture;
    constructor(device: GPUDevice, texture: TextureData) {
        // TODO: Upload image to GPUTexture
        // Placeholder for now
        this.gpuTexture = device.createTexture({
            size: [texture.image.width, texture.image.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
    }
}

export class WebGPURendererV2 {
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private presentationFormat!: GPUTextureFormat;

    private trianglePipeline!: GPURenderPipeline; // triangle-list pipeline (solid meshes)
    private linePipeline!: GPURenderPipeline; // line-list pipeline (grids/wireframes)
    private uniformBuffer!: GPUBuffer;
    private bindGroup!: GPUBindGroup;

    private textureRegistry = new Map<string, Texture>();

    // New architecture components
    // private entityManager = new EntityManager();
    private bufferManager!: GPUBufferManager;

    private depthTexture!: GPUTexture;

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
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
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

        // Define instance buffer layout (transform matrix + color) - back to slot 1.
        // Stride matches WASM's 96 B extern RenderingComponent (B4/B6); the trailing
        // 16 B (anim_time/variant/lod_flags/bone_palette) are Stage-C fields the
        // shader does not consume yet — attributes may cover less than arrayStride.
        const instanceBufferLayout = {
            arrayStride: 96, // 24 floats: 16 matrix + 4 color + 4 Stage-C
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
        this.trianglePipeline = this.device.createRenderPipeline({
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

        // Future: add point pipeline (primitive.topology: 'point-list') if point-clouds needed.
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
            layout: this.trianglePipeline.getBindGroupLayout(0),
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

    registerMesh(meshId: string, mesh: MeshData, renderMode: RenderMode = 'triangles'): void {
        this.bufferManager.registerMesh(meshId, mesh, renderMode);
        // Build buffers immediately after registering (for now - can be optimized later)
        this.bufferManager.buildSharedBuffers();
    }

    getMeshIndex(meshId: string): number | undefined {
        return this.bufferManager.getMeshIndex(meshId);
    }

    // Drop all registered meshes + their GPU buffers (used by Engine scene-swap so the next
    // scene registers its own meshes without leaking the previous scene's buffers/allocations).
    clearMeshes(): void {
        this.bufferManager.clearMeshes();
    }

    registerTexture(textureId: string, texture: TextureData): void {
        this.textureRegistry.set(textureId, new Texture(this.device, texture));
    }

    // Legacy entity-driven TS path removed. Rendering now relies on WASM-provided buffers & metadata.

    // Phase 5: Zero-copy WASM buffer integration
    mapInstanceDataFromWasm(wasmMemory: ArrayBuffer, offset: number, count: number): void {
        // Validate WASM buffer access
        if (!this.bufferManager.validateWasmBufferAccess(wasmMemory, offset, count)) {
            console.error('❌ WASM buffer validation failed');
            return;
        }

        // Map WASM data directly to GPU instance buffer
        this.bufferManager.mapInstanceDataFromWasm(wasmMemory, offset, count);
    }

    // B3: 2-pass WASM rendering (triangles + lines) driven by the per-mesh draw table.
    // WASM keeps same-mesh entities contiguous (B2 mesh buckets), so each mesh is one
    // drawIndexed over [bucketStart, bucketStart+count) of the shared instance buffer —
    // no per-frame regrouping, no per-frame buffer creation.
    render(wasmModule?: MeshBucketSource): void {
        const sharedVertexBuffer = this.bufferManager.getSharedVertexBuffer();
        const sharedIndexBuffer = this.bufferManager.getSharedIndexBuffer();
        const instanceBuffer = this.bufferManager.getInstanceBuffer();

        if (!sharedVertexBuffer || !sharedIndexBuffer || !instanceBuffer) {
            console.warn('⚠️ Required buffers not available for WASM rendering');
            return;
        }

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

        // B1: bind the geometry atlas ONCE per render pass — per-mesh geometry is selected via
        // drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance), not by
        // rebinding the shared buffers at byte offsets.
        renderPass.setVertexBuffer(0, sharedVertexBuffer);
        renderPass.setIndexBuffer(sharedIndexBuffer, 'uint16');
        // B3: the bulk-uploaded instance buffer is bound once too; per-mesh draws select
        // their contiguous slice via firstInstance (instance-step attributes honor it).
        renderPass.setVertexBuffer(1, instanceBuffer);

        // Matches WASM MAX_ENTITIES; counts beyond this indicate a corrupt read, not a big scene.
        const maxSafeInstanceCount = 10000;
        const instanceCount = this.bufferManager.getWasmEntityCount();

        // 🔒 CRITICAL: Validate instance count before rendering to prevent ghost triangles
        if (instanceCount > 0 && instanceCount <= maxSafeInstanceCount && wasmModule) {

            // PASS 1: Render triangle entities (sphere, cube, pyramid...)
            this.drawMeshBuckets(renderPass, this.trianglePipeline, 'triangles', wasmModule);

            // PASS 2: Render line entities (grid)
            this.drawMeshBuckets(renderPass, this.linePipeline, 'lines', wasmModule);

        } else if (instanceCount > maxSafeInstanceCount) {
            console.error(`❌ Suspicious instance count ${instanceCount} - refusing to render (possible buffer corruption)`);
        }

        // End render pass and submit
        renderPass.end();
        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
    }

    // B3: walk the per-mesh draw table for one pass (triangles or lines): one
    // drawIndexed per registered mesh with live instances. Zero allocations, zero
    // buffer creation — everything was bound once by render().
    private drawMeshBuckets(
        renderPass: any, // GPURenderPassEncoder
        pipeline: GPURenderPipeline,
        renderMode: RenderMode,
        wasmModule: MeshBucketSource
    ): void {
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, this.bindGroup);

        for (const [meshId, allocation] of this.bufferManager.getMeshAllocations()) {
            if (allocation.renderMode !== renderMode) continue;

            const meshIndex = this.bufferManager.getMeshIndex(meshId);
            if (meshIndex === undefined) continue;

            const bucketCount = wasmModule.get_mesh_bucket_count(meshIndex);
            if (bucketCount === 0) continue;

            const firstInstance = wasmModule.get_mesh_bucket_start(meshIndex);
            renderPass.drawIndexed(allocation.indexCount, bucketCount, allocation.firstIndex, allocation.baseVertex, firstInstance);
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
        // this.entityManager = new EntityManager();
    }
}
