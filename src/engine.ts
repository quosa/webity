
// Main engine class with error handling and lifecycle management
import {
  EngineConfig,
  AssetConfig,
  WASMExports,
  GameEngine,
  PerformanceStats,
  EngineError,
  WebGPUNotSupportedError,
  WASMLoadError,
  ENGINE_CONSTANTS
} from './types.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { BufferManager } from './buffer-manager.js';

export class Engine implements GameEngine {
  private wasm?: WASMExports;
  private running = false;
  private lastTime = 0;
  private animationId: number | undefined;

  // Performance monitoring
  private frameTimeHistory: number[] = [];
  private maxFrameHistory = ENGINE_CONSTANTS.DEFAULT_FRAME_HISTORY;
  private performanceCallback?: (_stats: PerformanceStats) => void;
  private lastStatsUpdate = 0;
  private statsUpdateInterval = 1000; // Update display every 1000ms (1 second)
  private lastWasmTime = 0; // WASM call time in microseconds

  // Physics configuration
  private physicsConfig: { entropy: number } = { entropy: 0.003 };

  constructor(
    private readonly canvas: HTMLCanvasElement, // eslint-disable-line no-unused-vars
    private readonly renderer: Renderer, // eslint-disable-line no-unused-vars
    private readonly input: InputManager, // eslint-disable-line no-unused-vars
    private readonly bufferManager: BufferManager // eslint-disable-line no-unused-vars
  ) {
    // Dependencies injected via constructor - explicit and testable
  }

  async init(config?: Partial<EngineConfig>): Promise<void> {
    try {
      // Check WebGPU support first
      if (!navigator.gpu) {
        throw new WebGPUNotSupportedError();
      }

      // 1. Load WASM module first
      this.wasm = await this.loadWASM();
      this.wasm.init();

      // 2. Set WASM memory on BufferManager (runtime dependency)
      this.bufferManager.setMemory(this.wasm.memory);

      // 3. Initialize renderer (will set device on BufferManager)
      await this.renderer.init(this.canvas);

      // 4. Initialize input manager
      this.input.init((key: number, pressed: boolean) => {
        this.wasm?.set_input(key, pressed);
      });

      // Apply config if provided
      if (config?.physics) {
        // Store entropy for GameObject scenes
        if (config.physics.entropy !== undefined) {
          this.physicsConfig.entropy = config.physics.entropy;
        }
        // TODO: Configure other physics parameters in WASM
        // This will require additional WASM exports
      }

    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  async loadAssets(assets: AssetConfig): Promise<void> {
    if (!this.wasm) {
      throw new EngineError('Engine not initialized', 'NOT_INITIALIZED');
    }

    if (assets.ball) {
      this.wasm.generate_sphere_mesh(assets.ball.segments);
    }

    if (assets.cube) {
      this.wasm.generate_cube_mesh(assets.cube.size);
    }

    // Generate grid floor for enhanced visual reference
    this.wasm.generate_grid_floor(16); // 16x16 grid
  }

  start(): void {
    if (!this.wasm) {
      throw new EngineError('Engine not initialized', 'NOT_INITIALIZED');
    }

    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  stop(): void {
    this.running = false;
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
  }

  dispose(): void {
    this.stop();
    this.input.dispose();
    this.renderer.dispose();
    // Clean up any other resources
  }



  // Physics configuration methods
  getEntropy(): number {
    return this.physicsConfig.entropy;
  }

  // WASM wrapper methods - provide controlled access to WASM functionality
  // These methods encapsulate WASM calls and provide validation/error handling
  
  spawnWasmEntity(x: number, y: number, z: number, radius: number, meshType?: number): number {
    if (!this.wasm) {
      throw new EngineError('Engine not initialized', 'NOT_INITIALIZED');
    }

    if (meshType !== undefined) {
      return this.wasm.spawn_entity_with_mesh(x, y, z, radius, meshType);
    } else {
      return this.wasm.spawn_entity(x, y, z, radius);
    }
  }

  clearWasmEntities(): void {
    if (!this.wasm) return;
    this.wasm.despawn_all_entities();
  }

  getWasmEntityCount(): number {
    if (!this.wasm) return 0;
    return this.wasm.get_entity_count();
  }

  getWasmEntityPosition(index: number): { x: number; y: number; z: number } | null {
    if (!this.wasm || index < 0) return null;
    
    return {
      x: this.wasm.get_entity_position_x(index),
      y: this.wasm.get_entity_position_y(index),
      z: this.wasm.get_entity_position_z(index),
    };
  }

  setWasmEntityPosition(index: number, x: number, y: number, z: number): void {
    if (!this.wasm || index < 0) return;
    this.wasm.set_entity_position(index, x, y, z);
  }

  setWasmEntityVelocity(index: number, x: number, y: number, z: number): void {
    if (!this.wasm || index < 0) return;
    this.wasm.set_entity_velocity(index, x, y, z);
  }

  setWasmPhysicsConfig(gravity: number, damping: number, restitution: number): void {
    if (!this.wasm) return;
    this.wasm.set_physics_config(gravity, damping, restitution);
  }

  setWasmWorldBounds(x: number, y: number, z: number): void {
    if (!this.wasm) return;
    this.wasm.set_world_bounds(x, y, z);
  }

  getWasmEntityMeshType(index: number): number {
    if (!this.wasm || index < 0) return 0; // Default to SPHERE
    return this.wasm.get_entity_mesh_type(index);
  }

  // Debug wrapper methods
  getDebugFloatingEntityIndex(): number {
    if (!this.wasm) return 10000; // MAX_ENTITIES as sentinel
    return this.wasm.get_debug_floating_entity_index();
  }

  getWasmEntityVelocityY(index: number): number {
    if (!this.wasm || index < 0) return 0;
    return this.wasm.get_entity_velocity_y(index);
  }

  clearDebugFloatingEntity(): void {
    if (!this.wasm) return;
    this.wasm.clear_debug_floating_entity();
  }

  // Performance monitoring methods
  setPerformanceCallback(callback: (_stats: PerformanceStats) => void): void {
    this.performanceCallback = callback;
  }

  private updatePerformanceStats(frameTime: number, currentTime: number): PerformanceStats {
    // Add current frame time to history
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.maxFrameHistory) {
      this.frameTimeHistory.shift();
    }

    // Calculate performance metrics with smoothing
    const fps = 1000 / frameTime;
    const recentFrameTimes = this.frameTimeHistory.slice(-30); // Last 30 frames for average
    const averageFPS = 1000 / (recentFrameTimes.reduce((a, b) => a + b, 0) / recentFrameTimes.length);
    const minFPS = 1000 / Math.max(...recentFrameTimes);
    const maxFPS = 1000 / Math.min(...recentFrameTimes);

    const stats: PerformanceStats = {
      frameTime,
      fps,
      averageFPS,
      minFPS,
      maxFPS,
      entityCount: this.getWasmEntityCount(),
      vertexCount: this.wasm?.get_vertex_count() || 0,
      wasmTime: this.lastWasmTime
    };

    // Only update display once per second to reduce visual jitter
    if (this.performanceCallback && (currentTime - this.lastStatsUpdate >= this.statsUpdateInterval)) {
      this.performanceCallback(stats);
      this.lastStatsUpdate = currentTime;
    }

    return stats;
  }


  private gameLoop = (): void => {
    if (!this.running) return;

    const currentTime = performance.now();
    const frameTime = currentTime - this.lastTime;
    const deltaTime = Math.min(frameTime / 1000.0, 0.1); // Cap at 100ms
    this.lastTime = currentTime;

    // Update performance stats (with display throttling)
    this.updatePerformanceStats(frameTime, currentTime);

    try {
      // Update physics/game state with high-precision timing
      const wasmStartTime = performance.now();
      this.wasm!.update(deltaTime);
      const wasmEndTime = performance.now();
      this.lastWasmTime = (wasmEndTime - wasmStartTime) * 1000; // Convert to microseconds

      // Check for collisions
      const collisionState = this.wasm!.get_collision_state();
      if (collisionState > 0) {
        this.handleCollisions(collisionState);
      }

      // Update rendering for multiple entities
      const vertexOffset = this.wasm!.get_vertex_buffer_offset();
      const vertexCount = this.wasm!.get_vertex_count();
      const uniformOffset = this.wasm!.get_uniform_buffer_offset();
      const entityCount = this.wasm!.get_entity_count();

      // Only log entity info occasionally to avoid DevTools performance hit
      if (entityCount % 50 === 0 && Math.floor(performance.now() / 5000) !== Math.floor((performance.now() - 16) / 5000)) {
        console.log(`🎾 Entities: ${entityCount} | Vertices: ${vertexCount}`);
      }

      // Render using optimized instanced rendering (Phase 6.3)
      this.renderer.renderMultipleEntitiesInstanced(
        this.wasm!.memory.buffer,
        vertexOffset,
        vertexCount,
        uniformOffset,
        this.wasm!,
        entityCount
      );

    } catch (error) {
      console.error('Game loop error:', error);
      this.stop();
      return;
    }

    this.animationId = requestAnimationFrame(this.gameLoop);
  };

  private handleCollisions(_state: number): void {
    // Handle collision feedback (sound, particles, etc. in Phase 4)
    // Collision logging disabled for performance testing to avoid console spam
    // Parameter prefixed with _ to indicate intentionally unused
  }

  private async loadWASM(): Promise<WASMExports> {
    try {
      const response = await fetch('game_engine.wasm');
      if (!response.ok) {
        throw new WASMLoadError(`HTTP ${response.status}`);
      }

      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {
        env: {
          // Add any imports if needed
        }
      });

      return instance.exports as unknown as WASMExports;

    } catch (error) {
      throw new WASMLoadError(error instanceof Error ? error.message : 'Unknown error');
    }
  }
}