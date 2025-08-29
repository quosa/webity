// WebGPU renderer with pipeline and shader management
import { EngineError, WebGPUNotSupportedError } from './types.js';

export class Renderer {
  private device?: GPUDevice;
  private context?: GPUCanvasContext;
  private pipeline?: GPURenderPipeline;
  private vertexBuffer?: GPUBuffer;
  private uniformBuffer?: GPUBuffer;
  private bindGroup?: GPUBindGroup;

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

  dispose(): void {
    this.vertexBuffer?.destroy();
    this.uniformBuffer?.destroy();
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

    // Create uniform buffer for matrices
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

  private updateBuffers(wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number, uniformOffset: number): void {
    if (!this.device) return;

    // Read the actual WASM data first
    const wasmVertexData = new Float32Array(wasmMemory, vertexOffset, vertexCount * 3);
    
    // Debug: log what WASM is sending us
    console.log('WASM vertex data (first 9 floats):', Array.from(wasmVertexData.slice(0, 9)));
    console.log(`WASM says ${vertexCount} vertices at offset ${vertexOffset}`);
    
    // Use the original WASM vertex data - let matrices handle scaling
    const vertexData = wasmVertexData;
    console.log('Using original WASM vertex data:', Array.from(vertexData.slice(0, 9)));
    const vertexSize = vertexData.byteLength;

    if (!this.vertexBuffer || this.vertexBuffer.size < vertexSize) {
      this.vertexBuffer?.destroy();
      this.vertexBuffer = this.device.createBuffer({
        label: 'Vertex Buffer',
        size: Math.max(vertexSize, 1024), // Minimum size to avoid frequent recreations
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }

    // Debug log
    console.log('Rendering hardcoded red triangle');
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertexData);

    // Update uniform buffer with matrices from WASM
    const uniformData = new Float32Array(wasmMemory, uniformOffset, 48); // 3 matrices * 16 floats
    console.log('Model matrix:', Array.from(uniformData.slice(0, 16)));
    console.log('View matrix:', Array.from(uniformData.slice(16, 32)));
    console.log('Projection matrix:', Array.from(uniformData.slice(32, 48)));
    this.device.queue.writeBuffer(this.uniformBuffer!, 0, uniformData);
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
        return vec4<f32>(1.0, 0.0, 0.0, 1.0); // Bright red wireframe
      }
    `;
  }
}