import { Engine } from '../src/engine.js';
import { Renderer } from '../src/renderer.js';
import type { InputManager } from '../src/input.js';
import type { BufferManager } from '../src/buffer-manager.js';

const mockRenderer = {
  init() { },
  render() { },
  dispose() { }
} as Renderer;

const mockInputManager = {
  init() { },
  dispose() { }
} as InputManager;

const mockBufferManager = {
  init() { },
  getVertexData() { return new ArrayBuffer(4*50); },
  getUniformData() { return new ArrayBuffer(4*50); },
  updateUniformBuffer() { },
  setDevice() { },
  setMemory() { },
} as BufferManager;

const mockCanvas = {
  getContext() { return {
    configure() { },
    getCurrentTexture() { return {
      createView() { },
    }; },
  }; },
} as HTMLCanvasElement;

describe('Engine', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine(
      document.createElement('canvas'),
      mockRenderer,
      mockInputManager,
      mockBufferManager,
    );
  });

  it('should construct the engine', () => {
    expect(engine).toBeDefined();
  });

  it('should initialize the engine', async () => {
    const initResult = await engine.init();
    expect(initResult).toBeUndefined();
  });

  it('should run the engine', async () => {
    await engine.init();
    const startResult =  engine.start();
    expect(startResult).toBeUndefined();
  });
});

describe('Renderer', () => {
  let renderer: Renderer;

  beforeEach(() => {
    renderer = new Renderer(mockBufferManager);
  });

  it('should construct the renderer', () => {
    expect(renderer).toBeDefined();
  });

  it('should initialize the renderer', async () => {
    const initResult = await renderer.init(mockCanvas);
    expect(initResult).toBeUndefined();
  });

  it('should render a frame', async () => {
    await renderer.init(mockCanvas);
    // render(wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number, uniformOffset: number): void {
    const renderResult = await renderer.render(
      new ArrayBuffer(1024), 0, 100, 500
    );
    expect(renderResult).toBeUndefined();
  });
});
