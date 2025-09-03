// src/v2/webgpu.renderer.ts
// Clean WebGPU renderer focused on GPU resource management and rendering
/// <reference types="@webgpu/types" />

// Types
export interface MeshData {
  vertices: Float32Array; // [x0, y0, z0, x1, y1, z1, ...]
  indices: Uint16Array; // [v0, v1, v2, v1, v2, v4, ...]
}

export type TextureData = {
  image: HTMLImageElement | ImageBitmap;
  // ...other texture params
}

export type Entity = {
  id: string; // Unique identifier
  meshId: string;
  transform: Float32Array; // 4x4 matrix
  color: [number, number, number, number]; // RGBA
  textureId?: string;
}

class Mesh {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  constructor(device: GPUDevice, mesh: MeshData) {
    if(mesh.indices.length % 3 !== 0) {
      throw new Error(
        `Invalid triangle mesh: index count ${mesh.indices.length} not divisible by 3`);
    }

    this.vertexBuffer = device.createBuffer({
      // WebGPU buffers need to be aligned to 4-byte boundaries for performance reasons.
      size: Math.ceil(mesh.vertices.byteLength / 4) * 4, // Round up to multiple of 4 bytes
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(mesh.vertices);
    //               ^- ArrayBuffer pointing directly to GPU memory
    //         Float32Array view into the same memory and copy across -^
    this.vertexBuffer.unmap(); // release buffer for GPU to use

    this.indexBuffer = device.createBuffer({
      // WebGPU buffers need to be aligned to 4-byte boundaries for performance reasons.
      size: Math.ceil(mesh.indices.byteLength / 4) * 4, // Round up to multiple of 4 bytes
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint16Array(this.indexBuffer.getMappedRange()).set(mesh.indices);
    this.indexBuffer.unmap(); // see vertexBuffer for description

    this.indexCount = mesh.indices.length;
  }
}

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

  private renderPipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;

  private meshRegistry = new Map<string, Mesh>();
  private textureRegistry = new Map<string, Texture>();
  private entities: Entity[] = [];

  async init(canvas: HTMLCanvasElement): Promise<void> {
    // Setup device/context
    const adapter = await navigator.gpu.requestAdapter();
    this.device = await adapter!.requestDevice();
    this.context = canvas.getContext('webgpu')!;
    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
    });

    // Create shaders and pipeline
    this.createRenderPipeline();
    this.createUniformBuffer();
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

    // Fragment shader: simple color output
    const fragmentShader = `
      struct FragmentInput {
        @location(0) color: vec4<f32>,
      }

      @fragment
      fn main(input: FragmentInput) -> @location(0) vec4<f32> {
        return input.color;
      }
    `;    // Create shader modules with error checking
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
    }    // Define vertex buffer layout
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

    // Define instance buffer layout (transform matrix + color)
    const instanceBufferLayout = {
      arrayStride: (16 + 4) * 4, // 16 floats (4x4 matrix) + 4 floats (color) * 4 bytes = 80 bytes
      stepMode: 'instance',
      attributes: [
        // Transform matrix (4 vec4s)
        { format: 'float32x4', offset: 0,  shaderLocation: 1 }, // transform row 0
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

    // Create render pipeline
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
        cullMode: 'none',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });
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
    this.meshRegistry.set(meshId, new Mesh(this.device, mesh));
  }

  registerTexture(textureId: string, texture: TextureData): void {
    this.textureRegistry.set(textureId, new Texture(this.device, texture));
  }

  addEntity(entity: Entity): void {
    this.entities.push(entity);
  }

  updateEntity(id: string, newData: Partial<Entity>): void {
    const idx = this.entities.findIndex(e => e.id === id);
    if (idx !== -1) {
      // i.e. this.entities[idx] = { ...this.entities[idx], ...newData };
      const entity = this.entities[idx]!;
      const updatedEntity: Entity = {
        id: newData.id ?? entity.id,
        meshId: newData.meshId ?? entity.meshId,
        transform: newData.transform ?? entity.transform,
        color: newData.color ?? entity.color,
      };

      // Handle optional textureId property
      if (newData.textureId !== undefined) {
        updatedEntity.textureId = newData.textureId;
      } else if (entity.textureId !== undefined) {
        updatedEntity.textureId = entity.textureId;
      }

      this.entities[idx] = updatedEntity;
    }
  }

  removeEntity(id: string): void {
    this.entities = this.entities.filter(e => e.id !== id);
  }

  clearEntities(): void {
    this.entities = [];
  }

  render(): void {
    // Group entities by meshId for instanced rendering
    const meshGroups: Record<string, Entity[]> = {};
    for (const entity of this.entities) {
      if (!meshGroups[entity.meshId]) meshGroups[entity.meshId] = [];
      meshGroups[entity.meshId]!.push(entity);
    }

    // Create depth texture for depth testing
    const canvas = this.context.canvas as HTMLCanvasElement;
    const depthTexture = this.device.createTexture({
      size: { width: canvas.width, height: canvas.height },
      format: 'depth24plus',
      usage: 0x10, // GPUTextureUsage.RENDER_ATTACHMENT
    });

    // Begin render pass
    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    // Set pipeline and bind group
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.bindGroup);

    // For each mesh group, create instance buffer and draw
    for (const meshId in meshGroups) {
      const mesh = this.meshRegistry.get(meshId);
      if (!mesh) {
        console.warn(`Mesh not found: ${meshId}`);
        continue;
      }

      const instances = meshGroups[meshId]!;

      // Create instance data: [transform matrix (16 floats) + color (4 floats)] per instance
      const instanceData = new Float32Array(instances.length * 20); // 20 floats per instance

      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i]!;
        const offset = i * 20;

        // Copy transform matrix (16 floats)
        instanceData.set(instance.transform, offset);

        // Copy color (4 floats)
        instanceData.set(instance.color, offset + 16);
      }

      // Create instance buffer
      const instanceBuffer = this.device.createBuffer({
        size: instanceData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(instanceBuffer.getMappedRange()).set(instanceData);
      instanceBuffer.unmap();

      // Bind mesh vertex and index buffers
      renderPass.setVertexBuffer(0, mesh.vertexBuffer); // Vertex positions
      renderPass.setVertexBuffer(1, instanceBuffer);    // Instance data
      renderPass.setIndexBuffer(mesh.indexBuffer, 'uint16');

      // Draw instances
      renderPass.drawIndexed(mesh.indexCount, instances.length);
    }

    // End render pass and submit
    renderPass.end();
    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);
  }

  dispose(): void {
    // TODO: Cleanup GPU resources
    this.meshRegistry.clear();
    this.textureRegistry.clear();
    this.entities = [];
  }
}
