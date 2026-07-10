import { setupWebGPUTestEnvironment } from './utils/dom-mocks.js';

describe('Test Environment Setup', () => {
  it('should have performance.now mocked globally', () => {
    expect(performance.now).toBeDefined();
    expect(typeof performance.now()).toBe('number');
  });

  it('should have requestAnimationFrame mocked globally', () => {
    expect(requestAnimationFrame).toBeDefined();
    expect(cancelAnimationFrame).toBeDefined();
  });

  it('should have smart fetch mock for WASM loading', () => {
    expect(fetch).toBeDefined();
    expect(typeof fetch).toBe('function');
  });

  it('should have WebAssembly available (not mocked globally)', () => {
    expect(WebAssembly.instantiate).toBeDefined();
    // This should be the real WebAssembly, not a mock
  });

  it('should be able to set up WebGPU environment on demand', () => {
    // WebGPU is no longer globally mocked - test that we can set it up
    setupWebGPUTestEnvironment();
    expect(navigator.gpu).toBeDefined();
    expect(navigator.gpu?.requestAdapter).toBeDefined();
  });
});