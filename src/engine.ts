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
// import { BufferManager } from './buffer-manager.js';

export class Engine implements GameEngine {
  private readonly canvas: HTMLCanvasElement;
  private wasm?: WASMExports;
  private renderer?: Renderer;
  private input?: InputManager;
  // private _bufferManager?: BufferManager; // Will be used for advanced buffer operations
  private running = false;
  private lastTime = 0;
  private animationId: number | undefined;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new EngineError(`Canvas with id '${canvasId}' not found`, 'CANVAS_NOT_FOUND');
    }
    this.canvas = canvas;
    // Canvas will be used in Phase 3 for renderer initialization
  }

  async init(config?: Partial<EngineConfig>): Promise<void> {
    try {
      // Check WebGPU support first
      if (!navigator.gpu) {
        throw new WebGPUNotSupportedError();
      }

      // Load WASM module
      this.wasm = await this.loadWASM();
      this.wasm.init();

      // Initialize renderer
      this.renderer = new Renderer();
      await this.renderer.init(this.canvas);

      // Initialize buffer manager (available for advanced buffer operations)
      // this._bufferManager = new BufferManager(
      //   this.wasm.memory,
      //   this.renderer.getDevice()
      // );

      // Initialize input manager
      this.input = new InputManager();
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
  }

  start(): void {
    if (!this.wasm || !this.renderer) {
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
    this.input?.dispose();
    this.renderer?.dispose();
    // Clean up any other resources
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

      // Update rendering
      const vertexOffset = this.wasm!.get_vertex_buffer_offset();
      const vertexCount = this.wasm!.get_vertex_count();

      // Debug: log ball position and rendering info every few frames
      if (Math.floor(performance.now() / 1000) !== Math.floor((performance.now() - 16) / 1000)) {
        const x = (this.wasm as any).get_ball_position_x();
        const y = (this.wasm as any).get_ball_position_y();
        const z = (this.wasm as any).get_ball_position_z();
        console.log(`🎾 Ball: (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}) | Camera: (0, 0, 10) → (0, 0, 0) | Vertices: ${vertexCount}`);
      }
      const uniformOffset = this.wasm!.get_uniform_buffer_offset();

      this.renderer!.render(
        this.wasm!.memory.buffer,
        vertexOffset,
        vertexCount,
        uniformOffset
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