
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
  private targetFPS = ENGINE_CONSTANTS.TARGET_FPS;
  private frameDropThreshold = ENGINE_CONSTANTS.PERFORMANCE_THRESHOLD;
  private lastStatsUpdate = 0;
  private statsUpdateInterval = 1000; // Update display every 1000ms (1 second)
  private lastWasmTime = 0; // WASM call time in microseconds

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
        // TODO: Configure physics parameters in WASM
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

  // Phase 6.2: Multi-entity scene management
  spawnBall(x: number, y: number, z: number, radius = 0.5): number {
    if (!this.wasm) {
      throw new EngineError('Engine not initialized', 'NOT_INITIALIZED');
    }
    return this.wasm.spawn_entity(x, y, z, radius);
  }

  getEntityCount(): number {
    if (!this.wasm) return 0;
    return this.wasm.get_entity_count();
  }

  clearAllBalls(): void {
    if (!this.wasm) return;
    this.wasm.despawn_all_entities();
  }

  // Spawn multiple balls in a configured scene
  spawnMultiBallScene(): void {
    console.log(`🎾 Before clear: ${this.getEntityCount()} balls`);
    this.clearAllBalls();
    console.log(`🎾 After clear: ${this.getEntityCount()} balls`);

    // Spawn 4 balls very close together for guaranteed collision interactions
    const id1 = this.spawnBall(-0.5, 5, 0, 0.5);   // Left - very close
    console.log(`🎾 Spawned ball 1 (id ${id1}): ${this.getEntityCount()} balls total`);
    const id2 = this.spawnBall(0.5, 5.5, 0, 0.5);    // Right - very close
    console.log(`🎾 Spawned ball 2 (id ${id2}): ${this.getEntityCount()} balls total`);
    const id3 = this.spawnBall(0, 6, -0.5, 0.5);   // Back - very close
    console.log(`🎾 Spawned ball 3 (id ${id3}): ${this.getEntityCount()} balls total`);
    const id4 = this.spawnBall(0, 6.5, 0.5, 0.5);    // Front - very close
    console.log(`🎾 Spawned ball 4 (id ${id4}): ${this.getEntityCount()} balls total`);

    // Add some initial velocity to create interactions
    if (this.wasm) {
      this.wasm.set_entity_velocity(0, 0.5, 0, 0.2);   // Ball 0: slight right and forward push
      this.wasm.set_entity_velocity(1, -0.3, 0, -0.1); // Ball 1: slight left and back push
      this.wasm.set_entity_velocity(2, 0.2, 0, 0.4);   // Ball 2: slight right and forward push
      this.wasm.set_entity_velocity(3, -0.1, 0, -0.3); // Ball 3: slight left and back push
    }

    console.log(`🎾 Final result: ${this.getEntityCount()} balls for multi-ball collision demo!`);
  }

  // Phase 6.3: Enhanced scene configuration API
  spawnGridScene(gridSize: number = 3, spacing: number = 1.5, height: number = 8): void {
    console.log(`🎾 Creating ${gridSize}x${gridSize} grid scene`);
    this.clearAllBalls();

    const offset = (gridSize - 1) * spacing / 2; // Center the grid
    let ballCount = 0;

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        if (ballCount >= ENGINE_CONSTANTS.MAX_ENTITIES) break; // MAX_ENTITIES limit

        const xPos = (x * spacing) - offset;
        const zPos = (z * spacing) - offset;
        const yPos = height + (Math.random() * 2); // Slight height variation

        this.spawnBall(xPos, yPos, zPos, 0.5);
        ballCount++;
      }
    }

    console.log(`🎾 Grid scene created: ${this.getEntityCount()} balls in ${gridSize}x${gridSize} formation`);
  }

  spawnCircleScene(radius: number = 3, ballCount: number = 6, height: number = 8): void {
    console.log(`🎾 Creating circle scene with ${ballCount} balls`);
    this.clearAllBalls();

    const maxBalls = Math.min(ballCount, ENGINE_CONSTANTS.MAX_ENTITIES); // MAX_ENTITIES limit

    for (let i = 0; i < maxBalls; i++) {
      const angle = (i / maxBalls) * 2 * Math.PI;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = height + (Math.random() * 2); // Slight height variation

      this.spawnBall(x, y, z, 0.5);

      // Add slight inward velocity for interesting collisions
      if (this.wasm) {
        this.wasm.set_entity_velocity(i, -x * 0.1, 0, -z * 0.1);
      }
    }

    console.log(`🎾 Circle scene created: ${this.getEntityCount()} balls in circular formation`);
  }

  spawnChaosScene(ballCount: number = 8): void {
    console.log(`🎾 Creating chaos scene with ${ballCount} balls`);
    this.clearAllBalls();

    const maxBalls = Math.min(ballCount, ENGINE_CONSTANTS.MAX_ENTITIES); // MAX_ENTITIES limit

    for (let i = 0; i < maxBalls; i++) {
      // Random positions within bounds
      const x = (Math.random() - 0.5) * 12; // -6 to +6
      const y = 5 + Math.random() * 8;      // 5 to 13 height
      const z = (Math.random() - 0.5) * 12; // -6 to +6

      this.spawnBall(x, y, z, 0.5);

      // Random initial velocities for chaos
      if (this.wasm) {
        const vx = (Math.random() - 0.5) * 4;
        const vz = (Math.random() - 0.5) * 4;
        this.wasm.set_entity_velocity(i, vx, 0, vz);
      }
    }

    console.log(`🎾 Chaos scene created: ${this.getEntityCount()} balls with random positions and velocities`);
  }

  // Rain scene - progressive ball spawning with performance monitoring
  private rainActive = false;
  private rainSpawnRate = 0.5; // balls per second
  private rainLastSpawn = 0;
  private rainBallSize = 0.3;
  private maxRainBalls = ENGINE_CONSTANTS.MAX_ENTITIES;

  startRainScene(intensity: number = 1.0): void {
    console.log(`🌧️ Starting rain scene with intensity ${intensity}`);
    this.clearAllBalls();
    
    this.rainActive = true;
    this.rainSpawnRate = intensity; // balls per second
    this.rainLastSpawn = performance.now();
    
    console.log(`🌧️ Rain started: ${this.rainSpawnRate} balls/sec, max ${this.maxRainBalls} balls`);
  }

  stopRainScene(): void {
    console.log('🌧️ Stopping rain scene');
    this.rainActive = false;
  }

  private updateRainSpawning(): void {
    if (!this.rainActive || !this.wasm) return;

    const now = performance.now();
    const timeSinceLastSpawn = now - this.rainLastSpawn;
    const spawnInterval = 1000 / this.rainSpawnRate; // ms between spawns

    // Check if it's time to spawn a new ball
    if (timeSinceLastSpawn >= spawnInterval) {
      const currentCount = this.getEntityCount();
      
      // Check performance before spawning more balls
      if (currentCount >= this.maxRainBalls) {
        console.log(`🌧️ Rain hit max ball limit: ${this.maxRainBalls}`);
        return;
      }

      if (!this.isPerformanceAcceptable()) {
        console.log(`🌧️ Rain auto-stopped due to performance drop: ${currentCount} balls`);
        console.log(`🌧️ Performance threshold: ${this.targetFPS * this.frameDropThreshold} FPS`);
        this.rainActive = false;
        return;
      }

      // Spawn a new rain ball at the top of the world
      const x = (Math.random() - 0.5) * 14; // -7 to +7 (slightly wider than world bounds)
      const z = (Math.random() - 0.5) * 14; // -7 to +7
      const y = 15 + Math.random() * 5;     // High up in the sky
      
      this.spawnBall(x, y, z, this.rainBallSize);
      
      // Add slight random initial velocity for more realistic rain
      const vx = (Math.random() - 0.5) * 1.0;
      const vz = (Math.random() - 0.5) * 1.0;
      this.wasm.set_entity_velocity(currentCount, vx, 0, vz);
      
      this.rainLastSpawn = now;
      
      // Log progress much less frequently to avoid DevTools bottleneck
      if (currentCount > 0 && currentCount % 100 === 0) {
        console.log(`🌧️ Rain progress: ${currentCount + 1} balls spawned`);
      }
    }
  }

  // Physics parameter controls
  setPhysicsParameters(gravity: number = -9.8, damping: number = 0.99, restitution: number = 0.8): void {
    if (this.wasm) {
      this.wasm.set_physics_config(gravity, damping, restitution);
      console.log(`🎾 Physics updated: gravity=${gravity}, damping=${damping}, restitution=${restitution}`);
    }
  }

  setWorldSize(size: number = 8): void {
    if (this.wasm) {
      this.wasm.set_world_bounds(size, size, size);
      console.log(`🎾 World bounds updated: ${size}x${size}x${size}`);
    }
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
      entityCount: this.getEntityCount(),
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

  private isPerformanceAcceptable(): boolean {
    if (this.frameTimeHistory.length < 10) return true; // Not enough data yet
    
    const recentFrameTimes = this.frameTimeHistory.slice(-10);
    const averageFPS = 1000 / (recentFrameTimes.reduce((a, b) => a + b, 0) / recentFrameTimes.length);
    
    return averageFPS >= (this.targetFPS * this.frameDropThreshold);
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
      // Update rain spawning (before physics update)
      this.updateRainSpawning();

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