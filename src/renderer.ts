// Clean WebGPU renderer with only unified rendering pipeline
import { EngineError, WebGPUNotSupportedError } from './types.js';
import { BufferManager } from './buffer-manager.js';
import { UnifiedRendererBridge } from './unified-renderer-bridge.js';

export class Renderer {
  private device?: GPUDevice;
  private context?: GPUCanvasContext;
  // Unified renderer system
  private unifiedRendererBridge?: UnifiedRendererBridge;

  constructor(private _bufferManager: BufferManager) {
    // BufferManager injected via constructor (currently unused in unified renderer)
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
    this._bufferManager.setDevice(this.device);
  }

  // Initialize unified renderer with WASM exports
  async initUnifiedRenderer(wasm: any): Promise<void> {
    if (!this.device || !this.context) {
      throw new EngineError('Device not initialized', 'NOT_INITIALIZED');
    }

    this.unifiedRendererBridge = new UnifiedRendererBridge(
      this.device,
      this.context,
      wasm
    );

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    await this.unifiedRendererBridge.init(presentationFormat);
    
    console.log('✅ Unified renderer initialized successfully');
  }

  getDevice(): GPUDevice {
    if (!this.device) {
      throw new EngineError('Renderer not initialized', 'NOT_INITIALIZED');
    }
    return this.device;
  }

  // Unified rendering method - the main rendering interface
  async renderUnified(wasmMemory: ArrayBuffer, uniformOffset: number, _wasm: any): Promise<void> {
    if (this.unifiedRendererBridge) {
      // Use new unified renderer
      await this.unifiedRendererBridge.renderWithGrid(wasmMemory, uniformOffset);
      return;
    }
    
    // Fallback - render empty scene with just background
    if (!this.device || !this.context) {
      return;
    }
    
    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
    
    console.warn('⚠️ Unified renderer not initialized, rendering empty scene');
  }

  // LEGACY METHODS - All deprecated, use renderUnified() instead
  async renderMultipleEntitiesInstanced(wasmMemory: ArrayBuffer, _vertexOffset: number, _vertexCount: number, uniformOffset: number, wasm: any, _entityCount: number): Promise<void> {
    console.warn('⚠️ renderMultipleEntitiesInstanced is deprecated. Use renderUnified() instead.');
    await this.renderUnified(wasmMemory, uniformOffset, wasm);
  }

  async renderMixedMeshesInstanced(wasmMemory: ArrayBuffer, uniformOffset: number, wasm: any): Promise<void> {
    console.warn('⚠️ renderMixedMeshesInstanced is deprecated. Use renderUnified() instead.');
    await this.renderUnified(wasmMemory, uniformOffset, wasm);
  }

  async renderFloorGridOnly(wasmMemory: ArrayBuffer, uniformOffset: number, wasm: any): Promise<void> {
    console.warn('⚠️ renderFloorGridOnly is deprecated. Use renderUnified() instead.');
    await this.renderUnified(wasmMemory, uniformOffset, wasm);
  }

  // Get rendering statistics for debugging
  getRenderingStats(): any {
    if (this.unifiedRendererBridge) {
      return {
        renderingMode: 'unified',
        ...this.unifiedRendererBridge.getStats()
      };
    }
    
    return {
      renderingMode: 'legacy',
      message: 'Using legacy mixed mesh rendering'
    };
  }

  dispose(): void {
    // Clean up unified renderer
    this.unifiedRendererBridge?.dispose();
    // Other GPU resources are automatically cleaned up
  }
}