import { 
  EngineError, 
  WebGPUNotSupportedError, 
  WASMLoadError 
} from '../src/types.js';

describe('Error Types', () => {
  describe('EngineError', () => {
    it('should create an error with message and code', () => {
      const error = new EngineError('Test message', 'TEST_CODE');
      
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('EngineError');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('WebGPUNotSupportedError', () => {
    it('should create a WebGPU not supported error', () => {
      const error = new WebGPUNotSupportedError();
      
      expect(error.message).toBe('WebGPU is not supported in this browser');
      expect(error.code).toBe('WEBGPU_NOT_SUPPORTED');
      expect(error.name).toBe('EngineError');
      expect(error instanceof EngineError).toBe(true);
    });
  });

  describe('WASMLoadError', () => {
    it('should create a WASM load error with details', () => {
      const error = new WASMLoadError('Network timeout');
      
      expect(error.message).toBe('Failed to load WASM module: Network timeout');
      expect(error.code).toBe('WASM_LOAD_ERROR');
      expect(error.name).toBe('EngineError');
      expect(error instanceof EngineError).toBe(true);
    });
  });
});