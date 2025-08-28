// Zero-copy buffer management for WASM memory integration
import { EngineError } from './types.js';

export class BufferManager {
  private wasmMemory: WebAssembly.Memory;
  private device: GPUDevice;

  constructor(wasmMemory: WebAssembly.Memory, device: GPUDevice) {
    this.wasmMemory = wasmMemory;
    this.device = device;
  }

  createVertexBuffer(offset: number, vertexCount: number): GPUBuffer {
    try {
      const size = vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT;
      const data = new Float32Array(
        this.wasmMemory.buffer,
        offset,
        vertexCount * 3
      );

      const buffer = this.device.createBuffer({
        label: 'Vertex Buffer',
        size: size,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });

      new Float32Array(buffer.getMappedRange()).set(data);
      buffer.unmap();

      return buffer;
    } catch (error) {
      throw new EngineError(
        `Failed to create vertex buffer: ${error}`,
        'BUFFER_CREATE_ERROR'
      );
    }
  }

  updateUniformBuffer(buffer: GPUBuffer, offset: number): void {
    try {
      const data = new Float32Array(this.wasmMemory.buffer, offset, 48); // 3 matrices * 16 floats
      this.device.queue.writeBuffer(buffer, 0, data);
    } catch (error) {
      throw new EngineError(
        `Failed to update uniform buffer: ${error}`,
        'BUFFER_UPDATE_ERROR'
      );
    }
  }

  createUniformBuffer(): GPUBuffer {
    try {
      return this.device.createBuffer({
        label: 'Uniform Buffer',
        size: 192, // 3 matrices * 16 floats * 4 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    } catch (error) {
      throw new EngineError(
        `Failed to create uniform buffer: ${error}`,
        'BUFFER_CREATE_ERROR'
      );
    }
  }

  /**
   * Get a Float32Array view directly into WASM memory (zero-copy)
   */
  getVertexData(offset: number, vertexCount: number): Float32Array {
    return new Float32Array(
      this.wasmMemory.buffer,
      offset,
      vertexCount * 3
    );
  }

  /**
   * Get a Float32Array view directly into WASM memory for matrices (zero-copy)
   */
  getUniformData(offset: number): Float32Array {
    return new Float32Array(this.wasmMemory.buffer, offset, 48); // 3 matrices * 16 floats
  }

  /**
   * Validate that memory offsets are within bounds
   */
  validateMemoryAccess(offset: number, size: number): boolean {
    const bufferSize = this.wasmMemory.buffer.byteLength;
    return offset >= 0 && offset + size <= bufferSize;
  }

  /**
   * Get memory usage statistics for debugging
   */
  getMemoryStats(): { totalSize: number; usedSize: number } {
    return {
      totalSize: this.wasmMemory.buffer.byteLength,
      usedSize: this.wasmMemory.buffer.byteLength // Simplified - actual tracking would be more complex
    };
  }
}