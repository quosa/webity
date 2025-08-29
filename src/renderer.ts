// WebGPU renderer with pipeline and shader management
import { EngineError, WebGPUNotSupportedError } from './types.js';
import { BufferManager } from './buffer-manager.js';

export class Renderer {
  private device?: GPUDevice;
  private context?: GPUCanvasContext;
  private pipeline?: GPURenderPipeline;
  private vertexBuffer?: GPUBuffer;
  private uniformBuffer?: GPUBuffer;
  private bindGroup?: GPUBindGroup;
  private entityUniformBuffers: GPUBuffer[] = [];
  private entityBindGroups: GPUBindGroup[] = [];

  constructor(private bufferManager: BufferManager) { // eslint-disable-line no-unused-vars
    // BufferManager injected via constructor
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    // Get adapter with fallback options
    const adapter = await navigator.gpu?.requestAdapter({
      powerPreference: 'high-performance',
      forceFallbackAdapter: false,
    });

    if (!adapter) {
      throw new WebGPUNotSupportedError();
    }

    // Check for required features
    const requiredFeatures: GPUFeatureName[] = [];

    this.device = await adapter.requestDevice({
      requiredFeatures,
      requiredLimits: {
        maxBufferSize: adapter.limits.maxBufferSize,
        maxVertexBuffers: 1,
      }
    });

    const context = canvas.getContext('webgpu');
    if (!context) {
      throw new EngineError('Failed to get WebGPU context', 'CONTEXT_ERROR');
    }
    this.context = context;

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: 'opaque', // 'premultiplied', // opaque
    });

    // Set device on BufferManager after device initialization
    this.bufferManager.setDevice(this.device);

    await this.createPipeline(presentationFormat);
  }

  getDevice(): GPUDevice {
    if (!this.device) {
      throw new EngineError('Renderer not initialized', 'NOT_INITIALIZED');
    }
    return this.device;
  }

  render(wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number, uniformOffset: number): void {
    if (!this.device || !this.context || !this.pipeline) {
      throw new EngineError('Renderer not initialized', 'NOT_INITIALIZED');
    }
    console.log('render:',
      new Float32Array(wasmMemory.slice(vertexOffset, vertexOffset + vertexCount * 4)),
      vertexOffset, vertexCount, uniformOffset);

    // Update buffers from WASM memory
    this.updateBuffers(wasmMemory, vertexOffset, vertexCount, uniformOffset);

    const commandEncoder = this.device.createCommandEncoder({ label: 'Render Commands' });
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      label: 'Ball Render Pass',
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 }, // Dark blue background
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup!);
    renderPass.setVertexBuffer(0, this.vertexBuffer!);
    renderPass.draw(vertexCount); // Draw actual vertex count from WASM
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  // Phase 6.2: Render multiple entities
  renderMultipleEntities(wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number, uniformOffset: number, wasm: any, entityCount: number): void {
    if (!this.device || !this.context || !this.pipeline) {
      throw new EngineError('Renderer not initialized', 'NOT_INITIALIZED');
    }

    // Update vertex buffer only (same mesh for all entities) - don't update uniforms here
    this.updateVertexBufferOnly(wasmMemory, vertexOffset, vertexCount);

    const commandEncoder = this.device.createCommandEncoder({ label: 'Multi-Entity Render Commands' });
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      label: 'Multi-Ball Render Pass',
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 }, // Dark blue background
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexBuffer(0, this.vertexBuffer!);

    // Render each entity with its own model matrix
    for (let i = 0; i < entityCount; i++) {
      // Get entity position from WASM
      const x = wasm.get_entity_position_x(i);
      const y = wasm.get_entity_position_y(i);
      const z = wasm.get_entity_position_z(i);

      console.log(`🎾 Rendering entity ${i} at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);

      // Create model matrix for this entity
      const modelMatrix = new Float32Array(16);
      // Identity matrix
      modelMatrix[0] = 1;   modelMatrix[5] = 1;   modelMatrix[10] = 1;  modelMatrix[15] = 1;
      // Translation
      modelMatrix[12] = x;  modelMatrix[13] = y;  modelMatrix[14] = z;

      // Update this entity's dedicated uniform buffer
      this.updateEntityUniformsToBuffer(wasmMemory, uniformOffset, modelMatrix, i);
      
      // Use this entity's dedicated bind group
      renderPass.setBindGroup(0, this.entityBindGroups[i]);
      renderPass.draw(vertexCount);
    }

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  private updateEntityUniformsToBuffer(wasmMemory: ArrayBuffer, uniformOffset: number, modelMatrix: Float32Array, entityIndex: number): void {
    if (!this.device || entityIndex >= this.entityUniformBuffers.length) return;

    // Get view and projection matrices from WASM memory (they stay the same for all entities)
    const wasmUniforms = new Float32Array(wasmMemory, uniformOffset, 48); // 3 matrices * 16 floats
    
    // Create new uniform data with our custom model matrix
    const entityUniforms = new Float32Array(48);
    
    // Copy our model matrix (first 16 floats)
    entityUniforms.set(modelMatrix, 0);
    
    // Copy view matrix from WASM (next 16 floats)
    entityUniforms.set(wasmUniforms.slice(16, 32), 16);
    
    // Copy projection matrix from WASM (last 16 floats)
    entityUniforms.set(wasmUniforms.slice(32, 48), 32);
    
    // Debug: log entity-specific model matrix
    console.log(`🔧 Entity ${entityIndex} model matrix:`, Array.from(modelMatrix.slice(0, 16)));
    
    // Upload to this entity's dedicated GPU buffer
    const entityBuffer = this.entityUniformBuffers[entityIndex];
    if (entityBuffer) {
      this.device.queue.writeBuffer(entityBuffer, 0, entityUniforms);
    }
  }


  dispose(): void {
    this.vertexBuffer?.destroy();
    this.uniformBuffer?.destroy();
    // Clean up entity buffers
    this.entityUniformBuffers.forEach(buffer => buffer.destroy());
    this.entityUniformBuffers = [];
    this.entityBindGroups = [];
    // Other GPU resources are automatically cleaned up
  }

  private async createPipeline(format: GPUTextureFormat): Promise<void> {
    if (!this.device) {
      throw new EngineError('Device not initialized', 'NOT_INITIALIZED');
    }

    const shaderModule = this.device.createShaderModule({
      label: 'Ball Shader',
      code: this.getShaderCode(),
    });

    // Create uniform buffer for matrices (main buffer for single entity rendering)
    this.uniformBuffer = this.device.createBuffer({
      label: 'Uniform Buffer',
      size: 192, // 3 matrices * 16 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      label: 'Uniform Bind Group Layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
      }],
    });

    this.bindGroup = this.device.createBindGroup({
      label: 'Uniform Bind Group',
      layout: bindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer },
      }],
    });

    // Create separate uniform buffers and bind groups for multi-entity rendering
    const MAX_ENTITIES = 10;
    this.entityUniformBuffers = [];
    this.entityBindGroups = [];
    
    for (let i = 0; i < MAX_ENTITIES; i++) {
      const entityBuffer = this.device.createBuffer({
        label: `Entity ${i} Uniform Buffer`,
        size: 192, // 3 matrices * 16 floats * 4 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      
      const entityBindGroup = this.device.createBindGroup({
        label: `Entity ${i} Bind Group`,
        layout: bindGroupLayout,
        entries: [{
          binding: 0,
          resource: { buffer: entityBuffer },
        }],
      });
      
      this.entityUniformBuffers.push(entityBuffer);
      this.entityBindGroups.push(entityBindGroup);
    }

    // Create render pipeline
    this.pipeline = this.device.createRenderPipeline({
      label: 'Ball Render Pipeline',
      layout: this.device.createPipelineLayout({
        label: 'Ball Pipeline Layout',
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main', // 'vs_debug',
        buffers: [{
          arrayStride: 12, // 3 floats * 4 bytes per vertex
          attributes: [{
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3',
          }],
        }],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main', // 'fs_debug',
        targets: [{
          format: format,
        }],
      },
      primitive: {
        topology: 'line-list', // Wireframe rendering for cube edges
        cullMode: 'none',
      },
    });
  }

  private updateVertexBufferOnly(_wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number): void {
    if (!this.device || !this.bufferManager) return;

    // Use BufferManager for zero-copy vertex data access
    const vertexData = this.bufferManager.getVertexData(vertexOffset, vertexCount);
    
    // Debug: log what WASM is sending us
    console.log('WASM vertex data (first 9 floats):', Array.from(vertexData.slice(0, 9)));
    console.log(`WASM says ${vertexCount} vertices at offset ${vertexOffset}`);
    
    console.log('Using BufferManager zero-copy vertex data:', Array.from(vertexData.slice(0, 9)));
    const vertexSize = vertexData.byteLength;

    // Create or resize vertex buffer as needed
    if (!this.vertexBuffer || this.vertexBuffer.size < vertexSize) {
      this.vertexBuffer?.destroy();
      this.vertexBuffer = this.device.createBuffer({
        label: 'Vertex Buffer',
        size: Math.max(vertexSize, 1024), // Minimum size to avoid frequent recreations
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }

    // Write vertex data to GPU - create a regular ArrayBuffer copy for WebGPU compatibility
    const vertexBuffer = new ArrayBuffer(vertexData.byteLength);
    new Float32Array(vertexBuffer).set(vertexData);
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertexBuffer);
  }

  private updateBuffers(_wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number, uniformOffset: number): void {
    if (!this.device || !this.bufferManager) return;

    // Use BufferManager for zero-copy data access
    const vertexData = this.bufferManager.getVertexData(vertexOffset, vertexCount);
    
    // Debug: log what WASM is sending us
    console.log('WASM vertex data (first 9 floats):', Array.from(vertexData.slice(0, 9)));
    console.log(`WASM says ${vertexCount} vertices at offset ${vertexOffset}`);
    
    console.log('Using BufferManager zero-copy vertex data:', Array.from(vertexData.slice(0, 9)));
    const vertexSize = vertexData.byteLength;

    // Create or resize vertex buffer as needed
    if (!this.vertexBuffer || this.vertexBuffer.size < vertexSize) {
      this.vertexBuffer?.destroy();
      this.vertexBuffer = this.device.createBuffer({
        label: 'Vertex Buffer',
        size: Math.max(vertexSize, 1024), // Minimum size to avoid frequent recreations
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }

    // Write vertex data to GPU - create a regular ArrayBuffer copy for WebGPU compatibility
    const vertexBuffer = new ArrayBuffer(vertexData.byteLength);
    new Float32Array(vertexBuffer).set(vertexData);
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertexBuffer);

    // Use BufferManager for uniform data updates
    if (this.uniformBuffer) {
      this.bufferManager.updateUniformBuffer(this.uniformBuffer, uniformOffset);
      
      // Debug logging
      const uniformData = this.bufferManager.getUniformData(uniformOffset);
      console.log('Model matrix:', Array.from(uniformData.slice(0, 16)));
      console.log('View matrix:', Array.from(uniformData.slice(16, 32)));
      console.log('Projection matrix:', Array.from(uniformData.slice(32, 48)));
    }
  }

  private getShaderCode(): string {
    return `
      struct Uniforms {
        model: mat4x4<f32>,
        view: mat4x4<f32>,
        projection: mat4x4<f32>,
      }

      @binding(0) @group(0) var<uniform> uniforms: Uniforms;

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) world_pos: vec3<f32>,
      }

      @vertex
      fn vs_main(@location(0) position: vec3<f32>) -> VertexOutput {
        var out: VertexOutput;
        let world_pos = uniforms.model * vec4<f32>(position, 1.0);
        out.position = uniforms.projection * uniforms.view * world_pos;
        out.world_pos = world_pos.xyz;
        return out;
      }

      @fragment
      fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        return vec4<f32>(0.0, 1.0, 1.0, 1.0); // Cyan wireframe
      }
    `;
  }
}