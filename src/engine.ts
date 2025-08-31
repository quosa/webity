
// Main engine class with error handling and lifecycle management
import {
  EngineConfig,
  AssetConfig,
  WASMExports,
  GameEngine,
  EngineError,
  WebGPUNotSupportedError,
  WASMLoadError
} from './types.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { BufferManager } from './buffer-manager.js';

export class Engine implements GameEngine {
  private wasm?: WASMExports;
  private running = false;
  private lastTime = 0;
  private animationId: number | undefined;

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
        if (ballCount >= 10) break; // MAX_ENTITIES limit

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

    const maxBalls = Math.min(ballCount, 10); // MAX_ENTITIES limit

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

    const maxBalls = Math.min(ballCount, 10); // MAX_ENTITIES limit

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

  private gameLoop = (): void => {
    if (!this.running) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000.0, 0.1); // Cap at 100ms
    this.lastTime = currentTime;

    try {
      // Update physics/game state
      this.wasm!.update(deltaTime);

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

      // Debug: log entity info every few frames
      if (Math.floor(performance.now() / 1000) !== Math.floor((performance.now() - 16) / 1000)) {
        console.log(`🎾 Entities: ${entityCount} | Vertices: ${vertexCount} | Camera controls: WASD`);
        if (entityCount > 1) {
          console.log('🎾 Multi-entity positions:');
          for (let i = 0; i < entityCount; i++) {
            const x = this.wasm!.get_entity_position_x(i);
            const y = this.wasm!.get_entity_position_y(i);
            const z = this.wasm!.get_entity_position_z(i);
            console.log(`  Ball ${i}: (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
          }
        }
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

  private handleCollisions(state: number): void {
    // Handle collision feedback (sound, particles, etc. in Phase 4)
    if (state & 0x01) console.warn('Floor collision');
    if (state & 0x02) console.warn('Wall collision');
    if (state & 0x04) console.warn('🎾 Ball-to-ball collision!');
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