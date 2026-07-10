// The Engine runtime.
//
// A `Scene` is pure data; the Engine owns the WebGPU renderer + the WASM physics module,
// mounts a scene (uploads its meshes, registers its entities), and drives the frame loop:
//
//   const engine = new Engine('webgpu-canvas');
//   await engine.init();           // WebGPU device + WASM module (loaded once)
//   await engine.loadScene(buildScene()); // mount: upload meshes, register entities (fail-loud)
//   engine.start();                // input > physics > update > render loop
//
// The Engine remembers the current scene, so start()/stop() take no argument:
//   engine.stop();  engine.start();       // pause / resume (same scene, keeps its state)
//
// Reset and scene-switch are the same caller-side operation — build a fresh Scene and load it,
// reusing the device (no Engine reset()/switchScene() needed):
//   await engine.loadScene(buildScene()); engine.start();   // rewind current level
//   await engine.loadScene(buildOther());  engine.start();   // switch to another level

import { WebGPURendererV2 } from '../renderer/webgpu.renderer';
import { RenderMode } from '../renderer/mesh-registry';
import { Scene } from './scene-system';
import { MeshRenderer } from './components';
import { Mesh } from './mesh';
import { WasmLoader } from './wasm-loader';
import { WasmPhysicsInterface } from './wasm-physics-bridge';

export class Engine {
    private canvas: HTMLCanvasElement;
    private renderer?: WebGPURendererV2;
    // WASM physics module, loaded once in init() and shared across every scene the Engine
    // mounts (each scene's bridge is re-init'd against it, which resets the world to empty).
    private wasm?: WasmPhysicsInterface;
    // The mounted scene, or undefined before the first loadScene()/after deinit(). start()/
    // stop() operate on this.
    private currentScene: Scene | undefined = undefined;
    // Latch so the component start() lifecycle runs once per mount, not on every resume.
    // Reset to false in loadScene(); set true by the first start() after a mount.
    private hasStarted = false;
    private running = false;
    // Handle of the pending requestAnimationFrame, so stop()/deinit() can cancel the loop
    // (undefined when not running). Set on every frame; see start().
    private animationId: number | undefined = undefined;
    private lastTime = 0;

    constructor(canvas: HTMLCanvasElement | string) {
        const element = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
        if (!element) {
            throw new Error(`Engine: canvas '${canvas}' not found`);
        }
        this.canvas = element as HTMLCanvasElement;
    }

    /** Whether the frame loop is currently running (for pause/resume UI). */
    get isRunning(): boolean {
        return this.running;
    }

    /** Initialize the WebGPU renderer and load the shared WASM physics module (once). */
    async init(): Promise<void> {
        this.renderer = new WebGPURendererV2();
        await this.renderer.init(this.canvas);

        const wasm = await WasmLoader.loadPhysicsModule();
        if (!wasm) {
            throw new Error('Engine.init(): failed to load WASM physics module');
        }
        this.wasm = wasm;
    }

    /**
     * Register a mesh for runtime-spawned objects whose mesh isn't present in the initial
     * scene tree (loadScene only auto-registers meshes it finds on the scene's MeshRenderers).
     */
    registerMesh(mesh: Mesh, renderMode: RenderMode = 'triangles'): void {
        if (!this.renderer) {
            throw new Error('Engine.registerMesh(): call init() first');
        }
        this.renderer.registerMesh(mesh.id, mesh.data, renderMode);
    }

    /**
     * Mount a scene, replacing any currently-mounted one. If the loop is running it is stopped
     * first (can't tear down a scene mid-frame), then the previous scene is unmounted. Registers
     * every mesh the new scene references (from object-mode MeshRenderers) with the renderer,
     * then mounts the scene (resolve mesh indices + register entities with WASM, fail-loud).
     * The device/renderer are reused across scenes. Does NOT auto-start — call start() after.
     *
     * This is the single scene-swap primitive: reload a fresh instance of the same scene to
     * rewind ("reset"), or load a different scene to switch levels.
     */
    async loadScene(scene: Scene): Promise<void> {
        if (!this.renderer) {
            throw new Error('Engine.loadScene(): call init() first');
        }

        if (this.running) {
            this.stop();
        }
        this.unloadCurrent();

        const registered = new Set<string>();
        for (const gameObject of scene.getAllGameObjects()) {
            const meshRenderer = gameObject.getComponent(MeshRenderer);
            if (!meshRenderer?.mesh || registered.has(meshRenderer.mesh.id)) continue;
            const { mesh } = meshRenderer;
            this.renderer.registerMesh(mesh.id, mesh.data, meshRenderer.renderMode);
            registered.add(mesh.id);
        }

        await scene.mount(this.renderer, this.wasm);
        this.currentScene = scene;
        this.hasStarted = false;
    }

    /** Unmount the current scene: tear down its input, clear the WASM world + renderer meshes. */
    private unloadCurrent(): void {
        if (!this.currentScene) return;
        this.currentScene.dispose();
        this.wasm?.init(); // reset the shared WASM world to empty for the next scene
        this.renderer?.clearMeshes();
        this.currentScene = undefined;
    }

    /**
     * Start (or resume) the frame loop for the current scene. Idempotent: calling it while
     * already running warns and no-ops (no duplicate rAF loop). The component start() lifecycle
     * runs only once per mount (hasStarted latch), so resuming after stop() does not re-run it.
     * Reseeds the frame clock, so a freshly-loaded scene always starts from the same elapsed time.
     */
    start(): void {
        if (!this.currentScene) {
            throw new Error('Engine.start(): no scene loaded; call loadScene() first');
        }
        if (this.running) {
            console.warn('Engine.start(): already running; ignoring');
            return;
        }

        const scene = this.currentScene;
        if (!this.hasStarted) {
            scene.start();
            this.hasStarted = true;
        }

        this.running = true;
        this.lastTime = performance.now();

        // Self-rescheduling rAF loop: each frame computes a clamped delta, updates the scene,
        // then queues the next frame (recording its handle so stop() can cancel it). The
        // `running` guard makes a cancelled frame a no-op if one is already in flight.
        const loop = (now: number): void => {
            if (!this.running) return;
            const deltaTime = Math.min((now - this.lastTime) / 1000, 1 / 30); // clamp at 30fps
            this.lastTime = now;
            scene.update(deltaTime);
            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    }

    /** Pause the frame loop. Idempotent: stopping an already-stopped engine warns and no-ops. */
    stop(): void {
        if (!this.running) {
            console.warn('Engine.stop(): not running; ignoring');
            return;
        }
        this.running = false;
        if (this.animationId !== undefined) {
            cancelAnimationFrame(this.animationId);
            this.animationId = undefined;
        }
    }

    /** Stop, unmount the current scene, and release GPU resources. */
    async deinit(): Promise<void> {
        if (this.running) {
            this.stop();
        }
        this.unloadCurrent();
        this.renderer?.dispose();
    }
}
