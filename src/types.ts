// Core type definitions for the game engine

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Mat4 {
  data: Float32Array; // 16 elements
}

export interface EngineConfig {
  canvas: HTMLCanvasElement;
  graphics?: {
    wireframe?: boolean;
    backgroundColor?: [number, number, number, number];
  };
  physics?: {
    gravity?: number;
    friction?: number;
    bounds?: Vec3;
  };
}

export interface AssetConfig {
  ball?: {
    segments: number;
    radius?: number;
  };
}

export type InputKey = 'w' | 'a' | 's' | 'd' | 'space';
export type InputState = Record<InputKey, boolean>;

export interface WASMExports {
  memory: WebAssembly.Memory;
  init(): void;
  update(deltaTime: number): void;
  set_input(keyCode: number, pressed: boolean): void;
  generate_sphere_mesh(segments: number): void;
  get_vertex_buffer_offset(): number;
  get_uniform_buffer_offset(): number;
  get_vertex_count(): number;
  set_position(x: number, y: number, z: number): void;
  apply_force(x: number, y: number, z: number): void;
  get_collision_state(): number; // Bitmask of collision flags
}

export interface GameEngine {
  init(config?: Partial<EngineConfig>): Promise<void>;
  loadAssets(assets: AssetConfig): Promise<void>;
  start(): void;
  stop(): void;
  dispose(): void;
}

// Error types for better error handling
export class EngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'EngineError';
  }
}

export class WebGPUNotSupportedError extends EngineError {
  constructor() {
    super('WebGPU is not supported in this browser', 'WEBGPU_NOT_SUPPORTED');
  }
}

export class WASMLoadError extends EngineError {
  constructor(details: string) {
    super(`Failed to load WASM module: ${details}`, 'WASM_LOAD_ERROR');
  }
}