// WebGPU renderer with pipeline and shader management
import { EngineError, WebGPUNotSupportedError } from './types.js';
import { BufferManager } from './buffer-manager.js';

export class Renderer {
  private device?: GPUDevice;
  private context?: GPUCanvasContext;
  private vertexBuffer?: GPUBuffer;
  private uniformBuffer?: GPUBuffer;
  // Grid floor rendering
  private gridPipeline?: GPURenderPipeline;
  private gridVertexBuffer?: GPUBuffer;
  private gridUniformBuffer?: GPUBuffer;
  private gridBindGroup?: GPUBindGroup;
  // Instanced rendering (Phase 6.3 optimization)
  private instancedPipeline?: GPURenderPipeline;
  private instanceBuffer?: GPUBuffer;
  private instancedBindGroup?: GPUBindGroup;

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
      alphaMode: 'opaque',
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



  // Phase 6.3: Optimized instanced rendering - single draw call for all entities
  renderMultipleEntitiesInstanced(wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number, uniformOffset: number, wasm: any, entityCount: number): void {
    if (!this.device || !this.context || !this.instancedPipeline || entityCount === 0) {
      return; // Skip if not ready or no entities
    }

    // Update vertex buffer (shared mesh for all entities)
    this.updateVertexBufferOnly(wasmMemory, vertexOffset, vertexCount);

    // Update grid buffers if available
    const gridOffset = wasm.get_grid_buffer_offset();
    const gridVertexCount = wasm.get_grid_vertex_count();
    if (gridVertexCount > 0) {
      this.updateGridBuffers(wasmMemory, gridOffset, gridVertexCount, uniformOffset);
    }

    // Pack all entity transforms into instance buffer
    this.updateInstanceBuffer(wasmMemory, uniformOffset, wasm, entityCount);

    const commandEncoder = this.device.createCommandEncoder({ label: 'Instanced Render Commands' });
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      label: 'Instanced Grid + Balls Render Pass',
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 }, // Dark blue background
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    // Render grid floor first (if available)
    if (gridVertexCount > 0 && this.gridPipeline && this.gridVertexBuffer && this.gridBindGroup) {
      renderPass.setPipeline(this.gridPipeline);
      renderPass.setBindGroup(0, this.gridBindGroup);
      renderPass.setVertexBuffer(0, this.gridVertexBuffer);
      renderPass.draw(gridVertexCount);
    }

    // Render all entities with single instanced draw call
    renderPass.setPipeline(this.instancedPipeline);
    renderPass.setBindGroup(0, this.instancedBindGroup!);
    renderPass.setVertexBuffer(0, this.vertexBuffer!);
    renderPass.draw(vertexCount, entityCount); // Single draw call for all entities!

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  dispose(): void {
    this.vertexBuffer?.destroy();
    this.uniformBuffer?.destroy();
    // Clean up grid resources
    this.gridVertexBuffer?.destroy();
    this.gridUniformBuffer?.destroy();
    // Clean up instanced rendering resources
    this.instanceBuffer?.destroy();
    // Other GPU resources are automatically cleaned up
  }

  private async createPipeline(format: GPUTextureFormat): Promise<void> {
    if (!this.device) {
      throw new EngineError('Device not initialized', 'NOT_INITIALIZED');
    }


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


    // Create grid floor pipeline with darker color
    this.gridUniformBuffer = this.device.createBuffer({
      label: 'Grid Uniform Buffer',
      size: 192, // 3 matrices * 16 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.gridBindGroup = this.device.createBindGroup({
      label: 'Grid Bind Group',
      layout: bindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.gridUniformBuffer },
      }],
    });

    // Create grid shader module with darker color
    const gridShaderModule = this.device.createShaderModule({
      label: 'Grid Shader',
      code: this.getGridShaderCode(),
    });

    this.gridPipeline = this.device.createRenderPipeline({
      label: 'Grid Render Pipeline',
      layout: this.device.createPipelineLayout({
        label: 'Grid Pipeline Layout',
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: gridShaderModule,
        entryPoint: 'vs_main',
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
        module: gridShaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: format,
        }],
      },
      primitive: {
        topology: 'line-list', // Wireframe grid lines
        cullMode: 'none',
      },
    });

    // Create instanced rendering pipeline for better performance
    await this.createInstancedPipeline(format);
  }

  private async createInstancedPipeline(format: GPUTextureFormat): Promise<void> {
    if (!this.device) return;

    // Create instance buffer for entity transforms (up to 100 entities)
    this.instanceBuffer = this.device.createBuffer({
      label: 'Instance Transform Buffer',
      size: 100 * 16 * 4, // 100 entities * 16 floats * 4 bytes = 6400 bytes
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Create bind group layout for instanced rendering
    const instancedBindGroupLayout = this.device.createBindGroupLayout({
      label: 'Instanced Bind Group Layout',
      entries: [
        {
          binding: 0, // View/Projection uniforms
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1, // Instance transforms storage buffer
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });

    this.instancedBindGroup = this.device.createBindGroup({
      label: 'Instanced Bind Group',
      layout: instancedBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer! },
        },
        {
          binding: 1,
          resource: { buffer: this.instanceBuffer },
        },
      ],
    });

    // Create instanced shader module
    const instancedShaderModule = this.device.createShaderModule({
      label: 'Instanced Ball Shader',
      code: this.getInstancedShaderCode(),
    });

    this.instancedPipeline = this.device.createRenderPipeline({
      label: 'Instanced Ball Render Pipeline',
      layout: this.device.createPipelineLayout({
        label: 'Instanced Pipeline Layout',
        bindGroupLayouts: [instancedBindGroupLayout],
      }),
      vertex: {
        module: instancedShaderModule,
        entryPoint: 'vs_main',
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
        module: instancedShaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: format,
        }],
      },
      primitive: {
        topology: 'line-list', // Wireframe rendering
        cullMode: 'none',
      },
    });
  }

  private updateVertexBufferOnly(_wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number): void {
    if (!this.device || !this.bufferManager) return;

    // Use BufferManager for zero-copy vertex data access
    const vertexData = this.bufferManager.getVertexData(vertexOffset, vertexCount);
    
    // Zero-copy vertex data access via BufferManager
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

  private updateInstanceBuffer(wasmMemory: ArrayBuffer, uniformOffset: number, wasm: any, entityCount: number): void {
    if (!this.device || !this.instanceBuffer) return;

    // Create array to hold all entity transform matrices
    const instanceData = new Float32Array(entityCount * 16); // 16 floats per 4x4 matrix

    // Pack all entity transforms into the buffer
    for (let i = 0; i < entityCount; i++) {
      const x = wasm.get_entity_position_x(i);
      const y = wasm.get_entity_position_y(i);  
      const z = wasm.get_entity_position_z(i);

      // Create model matrix for this entity (identity + translation)
      const offset = i * 16;
      // Identity matrix
      instanceData[offset + 0] = 1;  instanceData[offset + 5] = 1;   
      instanceData[offset + 10] = 1; instanceData[offset + 15] = 1;
      // Translation
      instanceData[offset + 12] = x; instanceData[offset + 13] = y; instanceData[offset + 14] = z;
    }

    // Upload instance data to GPU storage buffer
    this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);

    // Update view/projection uniforms (without model matrix)
    if (this.uniformBuffer) {
      const wasmUniforms = new Float32Array(wasmMemory, uniformOffset, 48); // 3 matrices * 16 floats
      const viewProjectionUniforms = new Float32Array(32); // 2 matrices * 16 floats
      
      // Skip model matrix, copy view and projection only
      viewProjectionUniforms.set(wasmUniforms.slice(16, 32), 0);  // View matrix
      viewProjectionUniforms.set(wasmUniforms.slice(32, 48), 16); // Projection matrix
      
      this.device.queue.writeBuffer(this.uniformBuffer, 0, viewProjectionUniforms);
    }
  }

  private updateGridBuffers(wasmMemory: ArrayBuffer, gridOffset: number, gridVertexCount: number, uniformOffset: number): void {
    if (!this.device || !this.bufferManager) return;

    // Use BufferManager for zero-copy grid data access
    const gridData = new Float32Array(wasmMemory, gridOffset, gridVertexCount * 3);
    const gridSize = gridData.byteLength;

    // Create or resize grid vertex buffer as needed
    if (!this.gridVertexBuffer || this.gridVertexBuffer.size < gridSize) {
      this.gridVertexBuffer?.destroy();
      this.gridVertexBuffer = this.device.createBuffer({
        label: 'Grid Vertex Buffer',
        size: Math.max(gridSize, 1024),
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }

    // Write grid data to GPU
    const gridBuffer = new ArrayBuffer(gridData.byteLength);
    new Float32Array(gridBuffer).set(gridData);
    this.device.queue.writeBuffer(this.gridVertexBuffer, 0, gridBuffer);

    // Update grid uniform buffer with identity model matrix (grid stays at floor)
    if (this.gridUniformBuffer) {
      const wasmUniforms = new Float32Array(wasmMemory, uniformOffset, 48); // 3 matrices * 16 floats
      const gridUniforms = new Float32Array(48);
      
      // Identity model matrix (grid doesn't move)
      const identityMatrix = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0, 
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
      gridUniforms.set(identityMatrix, 0);
      
      // Copy view and projection matrices from WASM (camera movement)
      gridUniforms.set(wasmUniforms.slice(16, 32), 16); // View matrix
      gridUniforms.set(wasmUniforms.slice(32, 48), 32); // Projection matrix
      
      this.device.queue.writeBuffer(this.gridUniformBuffer, 0, gridUniforms);
    }
  }



  private getGridShaderCode(): string {
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
        return vec4<f32>(0.3, 0.3, 0.4, 1.0); // Dark gray grid lines
      }
    `;
  }

  private getInstancedShaderCode(): string {
    return `
      struct ViewProjectionUniforms {
        view: mat4x4<f32>,
        projection: mat4x4<f32>,
      }

      @binding(0) @group(0) var<uniform> uniforms: ViewProjectionUniforms;
      @binding(1) @group(0) var<storage, read> instanceTransforms: array<mat4x4<f32>>;

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) world_pos: vec3<f32>,
      }

      @vertex
      fn vs_main(@location(0) position: vec3<f32>, @builtin(instance_index) instanceIndex: u32) -> VertexOutput {
        var out: VertexOutput;
        let modelMatrix = instanceTransforms[instanceIndex];
        let world_pos = modelMatrix * vec4<f32>(position, 1.0);
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