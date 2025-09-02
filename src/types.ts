// Core type definitions for the game engine

// Engine Configuration Constants
export const ENGINE_CONSTANTS = {
  MAX_ENTITIES: 10000, // Push the limits! 🚀
  MAX_VERTEX_BUFFER_SIZE: 50000, // Scale up vertex buffer
  MAX_GRID_BUFFER_SIZE: 5000,
  DEFAULT_FRAME_HISTORY: 60,
  TARGET_FPS: 60,
  PERFORMANCE_THRESHOLD: 0.8, // 80% of target FPS
} as const;

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
    /**
     * Small random offset added to GameObject positions to break perfect alignment.
     * This prevents artificial equilibrium states in physics simulations.
     * 
     * Values:
     * - 0.001: Very stable stacks, minimal movement
     * - 0.003: Default - cinematic, realistic collapse behavior  
     * - 0.01+: Immediate chaotic collapse
     * 
     * @default 0.003
     */
    entropy?: number;
  };
}

export interface AssetConfig {
  ball?: {
    segments: number;
    radius?: number;
  };
  cube?: {
    size: number;
  };
}

export type InputKey = 'w' | 'a' | 's' | 'd' | 'space';
export type InputState = Record<InputKey, boolean>;

/* eslint-disable no-unused-vars */
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
  get_ball_position_x(): number;
  get_ball_position_y(): number;
  get_ball_position_z(): number;
  // Phase 6.1 Configuration exports
  set_camera_position(x: number, y: number, z: number): void;
  set_camera_target(x: number, y: number, z: number): void;
  set_physics_config(gravity: number, damping: number, restitution: number): void;
  set_world_bounds(x: number, y: number, z: number): void;
  get_camera_position_x(): number;
  get_camera_position_y(): number;
  get_camera_position_z(): number;
  // Phase 6.2 Multi-entity exports
  spawn_entity(x: number, y: number, z: number, radius: number): number;
  get_entity_count(): number;
  despawn_all_entities(): void;
  get_entity_position_x(index: number): number;
  get_entity_position_y(index: number): number;
  get_entity_position_z(index: number): number;
  set_entity_position(index: number, x: number, y: number, z: number): void;
  set_entity_velocity(index: number, x: number, y: number, z: number): void;
  // Phase 6.3 Grid floor exports
  generate_grid_floor(grid_size: number): void;
  get_grid_buffer_offset(): number;
  get_grid_vertex_count(): number;
  // Phase 7 Multi-mesh exports
  generate_cube_mesh(size: number): void;
  spawn_entity_with_mesh(x: number, y: number, z: number, radius: number, mesh_type: number): number;
  get_entity_mesh_type(index: number): number;
  get_sphere_count(): number;
  get_cube_count(): number;
  get_sphere_position_x(index: number): number;
  get_sphere_position_y(index: number): number;
  get_sphere_position_z(index: number): number;
  get_cube_position_x(index: number): number;
  get_cube_position_y(index: number): number;
  get_cube_position_z(index: number): number;

  // Separate mesh vertex buffer exports
  get_sphere_vertex_buffer_offset(): number;
  get_sphere_vertex_count(): number;
  get_cube_vertex_buffer_offset(): number;
  get_cube_vertex_count(): number;
  
  // Debug exports
  get_debug_floating_entity_index(): number;
  get_entity_velocity_y(index: number): number;
  clear_debug_floating_entity(): void;
}

export interface GameEngine {
  init(config?: Partial<EngineConfig>): Promise<void>;
  loadAssets(assets: AssetConfig): Promise<void>;
  start(): void;
  stop(): void;
  dispose(): void;
}

export interface PerformanceStats {
  frameTime: number;    // Current frame time in ms
  fps: number;          // Current FPS
  averageFPS: number;   // Average FPS over recent frames
  minFPS: number;       // Minimum FPS in recent frames
  maxFPS: number;       // Maximum FPS in recent frames
  entityCount: number;  // Current number of entities
  vertexCount: number;  // Current vertex count
  wasmTime: number;     // WASM call time in microseconds
  memoryUsage?: number; // Optional memory usage stats
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
/* eslint-enable no-unused-vars */