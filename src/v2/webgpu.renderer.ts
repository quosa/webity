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
      size: mesh.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true, // direct CPU access to GPU memory
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(mesh.vertices);
    //               ^- ArrayBuffer pointing directly to GPU memory
    //         Float32Array view into the same memory and copy across -^
    this.vertexBuffer.unmap(); // release buffer for GPU to use

    this.indexBuffer = device.createBuffer({
      size: mesh.indices.byteLength,
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
    // TODO: Setup pipeline/shaders
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

    // TODO: Begin render pass, set pipeline, etc.
    // For each mesh group, upload instance buffer and draw
    for (const meshId in meshGroups) {
      const mesh = this.meshRegistry.get(meshId);
      if (!mesh) continue;
      // TODO: Create instance buffer for transforms/colors/textures
      // TODO: Bind mesh buffers, instance buffer, textures
      // TODO: Issue draw call with instanceCount = meshGroups[meshId]!.length
      console.log(`Would draw ${meshGroups[meshId]!.length} instances of mesh ${meshId}`);
      console.dir(meshGroups[meshId]!);
    }
    // TODO: End render pass
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
