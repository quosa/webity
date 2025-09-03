// src/v2/webgpu.renderer.ts
// Generic WebGPU renderer with instanced rendering support for shared meshes
/// <reference types="@webgpu/types" />

// Types
export interface Camera {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;        // Field of view in radians
  near: number;       // Near plane distance
  far: number;        // Far plane distance
  useOrthographic?: boolean;
  orthoBounds?: {     // For orthographic projection
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export interface MeshData {
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

    console.log(`🔍 Creating mesh with vertices:`, Array.from(mesh.vertices));
    console.log(`🔍 Creating mesh with indices:`, Array.from(mesh.indices));

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

  // Camera system
  private camera: Camera = {
    position: [0, 3, 8],
    target: [0, 0, 0],
    up: [0, 1, 0],
    fov: Math.PI / 4,
    near: -10,  // Allow objects at Z=0 to be visible
    far: 100,
    useOrthographic: true,  // Start with orthographic for now
    orthoBounds: {
      left: -8,
      right: 8,
      top: 6,
      bottom: -6
    }
  };

  async init(canvas: HTMLCanvasElement): Promise<void> {
    console.log('🔍 Canvas setup:', {
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight
    });

    // Setup device/context
    const adapter = await navigator.gpu.requestAdapter();
    this.device = await adapter!.requestDevice();
    this.context = canvas.getContext('webgpu')!;
    this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    console.log('🔍 Presentation format:', this.presentationFormat);

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
        // DEBUG: Use hardcoded triangle vertices to bypass vertex buffer issues
        var hardcodedVertices = array<vec3<f32>, 3>(
          vec3<f32>(0.0, 0.9, 0.0),   // Top - almost at top of screen
          vec3<f32>(-0.9, -0.9, 0.0), // Bottom left - almost at bottom left
          vec3<f32>(0.9, -0.9, 0.0)   // Bottom right - almost at bottom right
        );

                // Use actual vertex buffer data now that we know the pipeline works
        let vertexPosition = vertex.position;

        // Reconstruct transform matrix from instance data
        let transformMatrix = mat4x4<f32>(
          instance.transform_0,
          instance.transform_1,
          instance.transform_2,
          instance.transform_3
        );

                // Apply transform matrix (should be identity for now)
        let worldPosition = transformMatrix * vec4<f32>(vertexPosition, 1.0);

        // Apply view-projection matrix
        let clipPosition = uniforms.viewProjectionMatrix * worldPosition;

        var output: VertexOutput;
        output.position = clipPosition;
        output.color = instance.color; // Use the instance color
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
        return input.color; // Use the interpolated color from vertex shader
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
      // Temporarily disable depth testing to debug triangle visibility
      // depthStencil: {
      //   format: 'depth24plus',
      //   depthWriteEnabled: true,
      //   depthCompare: 'less',
      // },
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
    if (this.camera.useOrthographic && this.camera.orthoBounds) {
      // Orthographic projection for WebGPU (Z maps to [0,1] not [-1,1])
      const { left, right, top, bottom } = this.camera.orthoBounds;
      const { near, far } = this.camera;

      console.log('🔍 Using orthographic projection with:', { left, right, top, bottom, near, far });

      const scaleX = 2/(right-left);
      const scaleY = 2/(top-bottom);
      const scaleZ = 1/(far-near);   // Positive for WebGPU [0,1] range
      const transX = -(right+left)/(right-left);
      const transY = -(top+bottom)/(top-bottom);
      const transZ = -near/(far-near);  // This maps near→0, far→1

      console.log('🔍 Matrix components:', { scaleX, scaleY, scaleZ, transX, transY, transZ });

      return new Float32Array([
        scaleX, 0, 0, 0,
        0, scaleY, 0, 0,
        0, 0, scaleZ, 0,
        transX, transY, transZ, 1
      ]);
    } else {
      // TODO: Fix perspective projection (currently has W=0 issues)
      // For now, fall back to orthographic
      console.warn('Perspective camera not yet supported, using orthographic');

      return new Float32Array([
        0.1, 0, 0, 0,
        0, 0.1, 0, 0,
        0, 0, -0.01, 0,
        0, 0, -0.001, 1
      ]);
    }
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

  // Camera control methods
  setCamera(cameraSettings: Partial<Camera>): void {
    this.camera = { ...this.camera, ...cameraSettings };
    this.updateViewProjectionMatrix();
  }

  setPerspectiveCamera(position: [number, number, number], target: [number, number, number], fov = Math.PI / 4): void {
    this.camera = {
      ...this.camera,
      position,
      target,
      fov,
      useOrthographic: false
    };
    this.updateViewProjectionMatrix();
  }

  setOrthographicCamera(bounds: { left: number; right: number; top: number; bottom: number }): void {
    this.camera = {
      ...this.camera,
      useOrthographic: true,
      orthoBounds: bounds
    };
    this.updateViewProjectionMatrix();
  }

  private updateViewProjectionMatrix(): void {
    const viewProjectionMatrix = this.createViewProjectionMatrix();
    this.device.queue.writeBuffer(this.uniformBuffer, 0, viewProjectionMatrix.buffer);
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
    // Temporarily disable depth texture creation
    // const _depthTexture = this.device.createTexture({
    //   size: { width: canvas.width, height: canvas.height },
    //   format: 'depth24plus',
    //   usage: GPUTextureUsage.RENDER_ATTACHMENT,
    // });

    // Begin render pass
    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 }, // Dark blue background
        loadOp: 'clear',
        storeOp: 'store',
      }],
      // Temporarily disable depth attachment to debug triangle visibility
      // depthStencilAttachment: {
      //   view: depthTexture.createView(),
      //   depthClearValue: 1.0,
      //   depthLoadOp: 'clear',
      //   depthStoreOp: 'store',
      // },
    });

    // Set pipeline and bind group
    renderPass.setPipeline(this.renderPipeline);
    console.log('🔍 Render pipeline set');
    renderPass.setBindGroup(0, this.bindGroup);
    console.log('🔍 Bind group set');

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

      console.log('🔍 Instance data sample:', {
        firstTransform: Array.from(instanceData.slice(0, 16)),
        firstColor: Array.from(instanceData.slice(16, 20))
      });

      // Debug: Manual clip space calculation to see where vertices end up
      const testVertex = meshId === 'triangle' ?
        [0, 4, 0] : // First vertex of triangle (top vertex: 0, 4, 0)
        [0, 2, 0]; // Default for cubes
      const transform = Array.from(instanceData.slice(0, 16));

      // Apply transform matrix to test vertex
      const worldX = transform[0]! * testVertex[0]! + transform[4]! * testVertex[1]! + transform[8]! * testVertex[2]! + transform[12]!;
      const worldY = transform[1]! * testVertex[0]! + transform[5]! * testVertex[1]! + transform[9]! * testVertex[2]! + transform[13]!;
      const worldZ = transform[2]! * testVertex[0]! + transform[6]! * testVertex[1]! + transform[10]! * testVertex[2]! + transform[14]!;

      // Apply view-projection matrix
      const vpMatrix = this.createViewProjectionMatrix();
      console.log('🔍 View-Projection Matrix:', Array.from(vpMatrix));
      const clipX = vpMatrix[0]! * worldX + vpMatrix[4]! * worldY + vpMatrix[8]! * worldZ + vpMatrix[12]!;
      const clipY = vpMatrix[1]! * worldX + vpMatrix[5]! * worldY + vpMatrix[9]! * worldZ + vpMatrix[13]!;
      const clipZ = vpMatrix[2]! * worldX + vpMatrix[6]! * worldY + vpMatrix[10]! * worldZ + vpMatrix[14]!;
      const clipW = vpMatrix[3]! * worldX + vpMatrix[7]! * worldY + vpMatrix[11]! * worldZ + vpMatrix[15]!;

      console.log(`🎯 Test vertex [${testVertex.join(',')}] -> World: [${worldX.toFixed(3)}, ${worldY.toFixed(3)}, ${worldZ.toFixed(3)}] -> Clip: [${clipX.toFixed(3)}, ${clipY.toFixed(3)}, ${clipZ.toFixed(3)}, ${clipW.toFixed(3)}]`);
      console.log(`🎯 NDC coords: [${(clipX/clipW).toFixed(3)}, ${(clipY/clipW).toFixed(3)}, ${(clipZ/clipW).toFixed(3)}] (visible if X,Y in [-1,1] and Z in [0,1])`);

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
      console.log('🔍 Vertex buffer 0 set for mesh:', meshId);
      renderPass.setVertexBuffer(1, instanceBuffer);    // Instance data
      console.log('🔍 Vertex buffer 1 set (instance data)');
      renderPass.setIndexBuffer(mesh.indexBuffer, 'uint16');
      console.log('🔍 Index buffer set');

      // Draw instances
      renderPass.drawIndexed(mesh.indexCount, instances.length);
      console.log(`🔍 drawIndexed called: ${mesh.indexCount} indices, ${instances.length} instances`);
      console.log(`✅ Draw call issued: ${mesh.indexCount} indices, ${instances.length} instances`);
    }

    // End render pass and submit
    renderPass.end();
    console.log('🔍 Render pass ended');
    const commandBuffer = commandEncoder.finish();
    console.log('🔍 Command buffer finished');
    this.device.queue.submit([commandBuffer]);
    console.log('🎨 Render pass submitted');

    // Force a frame to be presented
    console.log('🔍 Checking canvas texture...');
    const currentTexture = this.context.getCurrentTexture();
    console.log('🔍 Current texture format:', currentTexture.format);
    console.log('🔍 Current texture size:', currentTexture.width, 'x', currentTexture.height);
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
