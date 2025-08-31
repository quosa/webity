import { BufferManager } from '../src/buffer-manager.js';
import { EngineError } from '../src/types.js';
import { mockWebGPUConstants } from './utils/dom-mocks.js';

describe('BufferManager', () => {
  let bufferManager: BufferManager;
  let mockMemory: WebAssembly.Memory;
  let mockDevice: GPUDevice;

  beforeEach(() => {
    // Set up WebGPU constants for this test
    mockWebGPUConstants();
    
    // Create mock WebAssembly memory with sufficient space
    const buffer = new ArrayBuffer(1024 * 1024); // 1MB buffer
    // Fill with some test data
    const view = new Float32Array(buffer);
    for (let i = 0; i < view.length; i++) {
      view[i] = i * 0.1;
    }
    
    mockMemory = {
      buffer: buffer,
    } as WebAssembly.Memory;

    // Create mock GPU device
    mockDevice = {
      createBuffer: jest.fn().mockReturnValue({
        getMappedRange: jest.fn().mockReturnValue(new ArrayBuffer(1024)),
        unmap: jest.fn(),
        destroy: jest.fn(),
      }),
      queue: {
        writeBuffer: jest.fn(),
      },
    } as unknown as GPUDevice;

    bufferManager = new BufferManager();
    bufferManager.setMemory(mockMemory);
    bufferManager.setDevice(mockDevice);
  });

  describe('Vertex Buffer Management', () => {
    it('should create vertex buffer successfully', () => {
      // Use smaller vertex count to avoid Float32Array alignment issues in tests
      const buffer = bufferManager.createVertexBuffer(0, 10);
      
      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        label: 'Vertex Buffer',
        size: 10 * 3 * 4, // 10 vertices * 3 components * 4 bytes
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      
      expect(buffer).toBeDefined();
    });

    it('should throw error when vertex buffer creation fails', () => {
      (mockDevice.createBuffer as jest.Mock).mockImplementation(() => {
        throw new Error('Buffer creation failed');
      });

      expect(() => {
        bufferManager.createVertexBuffer(0, 100);
      }).toThrow(EngineError);
      
      expect(() => {
        bufferManager.createVertexBuffer(0, 100);
      }).toThrow('Failed to create vertex buffer');
    });
  });

  describe('Uniform Buffer Management', () => {
    it('should create uniform buffer successfully', () => {
      const buffer = bufferManager.createUniformBuffer();
      
      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        label: 'Uniform Buffer',
        size: 192, // 3 matrices * 16 floats * 4 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      
      expect(buffer).toBeDefined();
    });

    it('should update uniform buffer successfully', () => {
      const mockBuffer = { destroy: jest.fn() } as unknown as GPUBuffer;
      
      expect(() => {
        bufferManager.updateUniformBuffer(mockBuffer, 0);
      }).not.toThrow();
      
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalled();
    });

    it('should throw error when uniform buffer update fails', () => {
      const mockBuffer = { destroy: jest.fn() } as unknown as GPUBuffer;
      (mockDevice.queue.writeBuffer as jest.Mock).mockImplementation(() => {
        throw new Error('Buffer update failed');
      });

      expect(() => {
        bufferManager.updateUniformBuffer(mockBuffer, 0);
      }).toThrow(EngineError);
      
      expect(() => {
        bufferManager.updateUniformBuffer(mockBuffer, 0);
      }).toThrow('Failed to update uniform buffer');
    });
  });

  describe('Zero-Copy Memory Access', () => {
    it('should return Float32Array view for vertex data', () => {
      const vertexData = bufferManager.getVertexData(0, 100);
      
      expect(vertexData).toBeInstanceOf(Float32Array);
      expect(vertexData.length).toBe(300); // 100 vertices * 3 components
    });

    it('should return Float32Array view for uniform data', () => {
      const uniformData = bufferManager.getUniformData(0);
      
      expect(uniformData).toBeInstanceOf(Float32Array);
      expect(uniformData.length).toBe(48); // 3 matrices * 16 floats
    });
  });

  describe('Memory Validation', () => {
    it('should validate memory access within bounds', () => {
      const isValid = bufferManager.validateMemoryAccess(0, 1024);
      expect(isValid).toBe(true);
    });

    it('should reject memory access outside bounds', () => {
      const isValid = bufferManager.validateMemoryAccess(0, 2 * 1024 * 1024); // 2MB, larger than 1MB buffer
      expect(isValid).toBe(false);
    });

    it('should reject negative offsets', () => {
      const isValid = bufferManager.validateMemoryAccess(-100, 1024);
      expect(isValid).toBe(false);
    });
  });

  describe('Memory Statistics', () => {
    it('should return memory usage statistics', () => {
      const stats = bufferManager.getMemoryStats();
      
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('usedSize');
      expect(stats.totalSize).toBe(1024 * 1024); // 1MB
      expect(typeof stats.usedSize).toBe('number');
    });
  });
});