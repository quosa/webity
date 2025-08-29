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

    // Create render pipeline (no uniforms needed for debug triangle)
    this.pipeline = this.device.createRenderPipeline({
      label: 'Debug Triangle Pipeline',
      layout: 'auto',
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

  private updateBuffers(wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number, _uniformOffset: number): void {
    if (!this.device) return;

    // Read the actual WASM data first
    const wasmVertexData = new Float32Array(wasmMemory, vertexOffset, vertexCount * 3);
    
    // Debug: log what WASM is sending us
    console.log('WASM vertex data (first 9 floats):', Array.from(wasmVertexData.slice(0, 9)));
    console.log(`WASM says ${vertexCount} vertices at offset ${vertexOffset}`);
    
    // Scale down the WASM cube data to fit in view (-1 to 1 NDC space)
    const vertexData = new Float32Array(wasmVertexData.length);
    for (let i = 0; i < wasmVertexData.length; i += 3) {
      // Scale from [-5,5] to [-0.5,0.5] to fit in viewport
      vertexData[i] = wasmVertexData[i] * 0.1;     // X
      vertexData[i + 1] = wasmVertexData[i + 1] * 0.1; // Y  
      vertexData[i + 2] = wasmVertexData[i + 2] * 0.1; // Z
    }
    
    console.log('Scaled vertex data (first 9):', Array.from(vertexData.slice(0, 9)));
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

    // No uniform buffer needed for debug triangle
  }

  private getShaderCode(): string {
    // Simple vertex + fragment shader without uniforms
    return `
      @vertex
      fn vs_main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
        // Direct passthrough - position is already in NDC space (-1 to 1)
        return vec4<f32>(position, 1.0);
      }

      @fragment  
      fn fs_main() -> @location(0) vec4<f32> {
        return vec4<f32>(1.0, 0.0, 0.0, 1.0); // Bright red triangle
      }
    `;
  }
}