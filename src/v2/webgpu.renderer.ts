// src/v2/webgpu.renderer.ts
// Generic WebGPU renderer with instanced rendering support for shared meshes
/// <reference types="@webgpu/types" />

// Types
export type MeshData = {
  vertices: Float32Array; // [x0, y0, z0, x1, y1, z1, ...]
  indices: Uint16Array; // [v0, v1, v2, v1, v2, v4, ...]
};

export type TextureData = {
  image: HTMLImageElement | ImageBitmap;
  // ...other texture params
};

export type Entity = {
  id: string; // Unique identifier
  meshId: string;
  transform: Float32Array; // 4x4 matrix
  color: [number, number, number, number]; // RGBA
  textureId?: string;
};

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
      size: Math.max(4, ((mesh.vertices.byteLength + 3) & ~3)), // Round up to multiple of 4
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true, // direct CPU access to GPU memory
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(mesh.vertices);
    //               ^- ArrayBuffer pointing directly to GPU memory
    //         Float32Array view into the same memory and copy across -^
    this.vertexBuffer.unmap(); // release buffer for GPU to use

    this.indexBuffer = device.createBuffer({
      size: Math.max(4, ((mesh.indices.byteLength + 3) & ~3)), // Round up to multiple of 4
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
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
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
    // Debug: Add validation for shader compilation
    console.log('🔧 Creating render pipeline...');

    // Vertex shader: transforms vertices from model space to screen space
    const vertexShader = `
      struct Uniforms {
        viewProjectionMatrix: mat4x4<f32>,
      }
      @binding(0) @group(0) var<uniform> uniforms: Uniforms;

      struct VertexInput {
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
        // Reconstruct transform matrix from instance data
        let transformMatrix = mat4x4<f32>(
          instance.transform_0,
          instance.transform_1,
          instance.transform_2,
          instance.transform_3
        );

        // Transform vertex position: Model -> World -> View -> Projection
        let worldPosition = transformMatrix * vec4<f32>(vertex.position, 1.0);
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
        return input.color; // Just output the interpolated color
      }
    `;

    // Create shader modules with error checking
    let vertexModule, fragmentModule;
    try {
      vertexModule = this.device.createShaderModule({ code: vertexShader });
      console.log('✅ Vertex shader compiled successfully');
    } catch (error) {
      console.error('❌ Vertex shader compilation failed:', error);
      throw error;
    }

    try {
      fragmentModule = this.device.createShaderModule({ code: fragmentShader });
      console.log('✅ Fragment shader compiled successfully');
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
        cullMode: 'none', // Disable culling to see all faces
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });

    console.log('✅ Render pipeline created successfully with:', {
      cullMode: 'none',
      topology: 'triangle-list',
      depthStencil: 'enabled'
    });
  }

  private createUniformBuffer(): void {
    // Create view-projection matrix (simple perspective camera)
    const viewProjectionMatrix = this.createViewProjectionMatrix();

    // Create uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      size: 64, // 4x4 matrix = 16 floats * 4 bytes = 64 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Upload view-projection matrix
    this.device.queue.writeBuffer(this.uniformBuffer, 0, viewProjectionMatrix.buffer);

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

  private createViewProjectionMatrix(): Float32Array {
    // Use simple orthographic projection to eliminate perspective math issues
    const left = -5;
    const right = 5;
    const bottom = -5;
    const top = 5;
    const near = 0.1;
    const far = 100;

    console.log('Using orthographic projection:', { left, right, bottom, top, near, far });

    // Correct orthographic projection matrix for WebGPU (NDC Z: [0,1])
    // No view matrix needed - just pure orthographic projection
    const orthoMatrix = new Float32Array([
      2/(right-left), 0, 0, 0,
      0, 2/(top-bottom), 0, 0,
      0, 0, -1/(far-near), 0,
      -(right+left)/(right-left), -(top+bottom)/(top-bottom), -near/(far-near), 1
    ]);

    console.log('FIXED Orthographic matrix (no view transform):', Array.from(orthoMatrix));

    return orthoMatrix;
  }  private createSimpleLookAtMatrix(eye: number[], target: number[], up: number[]): Float32Array {
    // Simplified lookAt for camera at [0, 0, -10] looking at origin
    // This should just be a translation matrix
    return new Float32Array([
      1, 0, 0, 0,  // x-axis
      0, 1, 0, 0,  // y-axis
      0, 0, 1, 0,  // z-axis
      -eye[0]!, -eye[1]!, -eye[2]!, 1  // translation
    ]);
  }

  private createLookAtMatrix(eye: number[], target: number[], up: number[]): Float32Array {
    // Simple lookAt matrix implementation
    const zAxis = this.normalize(this.subtract(eye, target));
    const xAxis = this.normalize(this.cross(up, zAxis));
    const yAxis = this.cross(zAxis, xAxis);

    return new Float32Array([
      xAxis[0]!, yAxis[0]!, zAxis[0]!, 0,
      xAxis[1]!, yAxis[1]!, zAxis[1]!, 0,
      xAxis[2]!, yAxis[2]!, zAxis[2]!, 0,
      -this.dot(xAxis, eye), -this.dot(yAxis, eye), -this.dot(zAxis, eye), 1,
    ]);
  }

  private createPerspectiveMatrix(fov: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1.0 / (near - far);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0,
    ]);
  }

  private multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] =
          a[i * 4 + 0]! * b[0 * 4 + j]! +
          a[i * 4 + 1]! * b[1 * 4 + j]! +
          a[i * 4 + 2]! * b[2 * 4 + j]! +
          a[i * 4 + 3]! * b[3 * 4 + j]!;
      }
    }
    return result;
  }

  // Helper math functions
  private normalize(v: number[]): number[] {
    const len = Math.sqrt(v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!);
    return [v[0]! / len, v[1]! / len, v[2]! / len];
  }

  private subtract(a: number[], b: number[]): number[] {
    return [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
  }

  private cross(a: number[], b: number[]): number[] {
    return [
      a[1]! * b[2]! - a[2]! * b[1]!,
      a[2]! * b[0]! - a[0]! * b[2]!,
      a[0]! * b[1]! - a[1]! * b[0]!,
    ];
  }

  private dot(a: number[], b: number[]): number {
    return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
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

    console.log('Render groups:', Object.keys(meshGroups));
    console.log('Total entities to render:', this.entities.length);

    // Create depth texture for depth testing
    const depthTexture = this.device.createTexture({
      size: { width: 800, height: 600, depthOrArrayLayers: 1 }, // TODO: Get from canvas
      format: 'depth24plus',
      usage: (1 << 4), // GPUTextureUsage.RENDER_ATTACHMENT
    });

    // Begin render pass
    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 }, // Dark blue background
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
      console.log(`Drawing ${instances.length} instances of mesh ${meshId} with ${mesh.indexCount} indices`);

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

      console.log('Instance data sample:', {
        firstTransform: Array.from(instanceData.slice(0, 16)),
        firstColor: Array.from(instanceData.slice(16, 20))
      });

      // Debug: Manual clip space calculation to see where vertices end up
      const testVertex = [0, 2, 0]; // Top vertex of triangle
      const transform = Array.from(instanceData.slice(0, 16));

      // Apply transform matrix to test vertex
      const worldX = transform[0]! * testVertex[0]! + transform[4]! * testVertex[1]! + transform[8]! * testVertex[2]! + transform[12]!;
      const worldY = transform[1]! * testVertex[0]! + transform[5]! * testVertex[1]! + transform[9]! * testVertex[2]! + transform[13]!;
      const worldZ = transform[2]! * testVertex[0]! + transform[6]! * testVertex[1]! + transform[10]! * testVertex[2]! + transform[14]!;

      // Apply view-projection matrix
      const vpMatrix = this.createViewProjectionMatrix();
      const clipX = vpMatrix[0]! * worldX + vpMatrix[4]! * worldY + vpMatrix[8]! * worldZ + vpMatrix[12]!;
      const clipY = vpMatrix[1]! * worldX + vpMatrix[5]! * worldY + vpMatrix[9]! * worldZ + vpMatrix[13]!;
      const clipZ = vpMatrix[2]! * worldX + vpMatrix[6]! * worldY + vpMatrix[10]! * worldZ + vpMatrix[14]!;
      const clipW = vpMatrix[3]! * worldX + vpMatrix[7]! * worldY + vpMatrix[11]! * worldZ + vpMatrix[15]!;

      console.log(`🎯 Test vertex [0,2,0] -> World: [${worldX.toFixed(3)}, ${worldY.toFixed(3)}, ${worldZ.toFixed(3)}] -> Clip: [${clipX.toFixed(3)}, ${clipY.toFixed(3)}, ${clipZ.toFixed(3)}, ${clipW.toFixed(3)}]`);
      console.log(`🎯 NDC coords: [${(clipX/clipW).toFixed(3)}, ${(clipY/clipW).toFixed(3)}, ${(clipZ/clipW).toFixed(3)}] (visible if all in [-1,1])`);

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
      console.log(`✅ Draw call issued: ${mesh.indexCount} indices, ${instances.length} instances`);
    }

    // End render pass and submit
    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
    console.log('🎨 Render pass submitted');
  }

  dispose(): void {
    // TODO: Cleanup GPU resources
    this.meshRegistry.clear();
    this.textureRegistry.clear();
    this.entities = [];
  }
}

// Utility function for transform matrix creation
export function makeTransformMatrix(
  x: number, y: number, z: number,
  scale: number = 1, // TODO: xyz scaling
  _rotation: [number, number, number] = [0, 0, 0] // TODO: add rotation
): Float32Array {
  // TODO: Implement full transform (translation, scale, rotation)
  // For now, just translation and uniform scale
  return new Float32Array([
    scale, 0, 0, 0,
    0, scale, 0, 0,
    0, 0, scale, 0,
    x, y, z, 1
  ]);
}
