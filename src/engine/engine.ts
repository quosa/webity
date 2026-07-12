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
import { Scene, SceneRuntime } from './scene-system';
import { MeshRenderer, RigidBody } from './components';
import { Mesh } from './mesh';
import { GameObject } from './gameobject';
import { WasmLoader } from './wasm-loader';
import { WasmPhysicsBridge, WasmPhysicsInterface } from './wasm-physics-bridge';

export class Engine implements SceneRuntime {
    private canvas: HTMLCanvasElement;
    private renderer?: WebGPURendererV2;
    // WASM physics module, loaded once in init() and shared across every scene the Engine mounts.
    private wasm?: WasmPhysicsInterface;
    // The physics bridge for the current scene. The Engine owns it: a fresh bridge is created per
    // loadScene() (its init() resets the shared WASM world to empty), and the Engine drives its
    // update() each frame. Undefined before the first loadScene()/after deinit().
    private bridge: WasmPhysicsBridge | undefined = undefined;
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

    /** The current scene's physics bridge (for debug/console hooks). Undefined until loadScene(). */
    get physicsBridge(): WasmPhysicsBridge | undefined {
        return this.bridge;
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

        // 1. Register every mesh the scene references (dedup by id).
        const registered = new Set<string>();
        for (const gameObject of scene.getAllGameObjects()) {
            const meshRenderer = gameObject.getComponent(MeshRenderer);
            if (!meshRenderer?.mesh || registered.has(meshRenderer.mesh.id)) continue;
            const { mesh } = meshRenderer;
            this.renderer.registerMesh(mesh.id, mesh.data, meshRenderer.renderMode);
            registered.add(mesh.id);
        }

        // 2. Fresh physics world for this scene (init() resets the shared WASM world to empty).
        this.bridge = new WasmPhysicsBridge();
        await this.bridge.init(this.wasm);

        // 3. Register every entity (mesh index + WASM) in one fail-loud pass.
        const failures: string[] = [];
        for (const gameObject of scene.getAllGameObjects()) {
            const error = this.registerEntity(gameObject);
            if (error) failures.push(`  - "${gameObject.name}": ${error}`);
        }
        if (failures.length > 0) {
            throw new Error(`Engine.loadScene(): failed to register ${failures.length} GameObject(s):\n${failures.join('\n')}`);
        }

        // 4. Bind runtime (so late adds/removes register through the Engine), then awake.
        scene.bindRuntime(this);
        scene.awake();

        this.currentScene = scene;
        this.hasStarted = false;
    }

    // Register one GameObject with the renderer (mesh index) + WASM. Returns an error message on
    // failure (null on success) so loadScene can aggregate and fail loud.
    private registerEntity(gameObject: GameObject): string | null {
        this.warnIfInertRigidBody(gameObject);
        try {
            this.addMeshIndex(gameObject);
            this.bridge?.addEntity(gameObject);
            return null;
        } catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    }

    // Resolve and cache the renderer's mesh index onto the GameObject's MeshRenderer.
    private addMeshIndex(gameObject: GameObject): void {
        const meshRenderer = gameObject.getComponent(MeshRenderer);
        if (!meshRenderer || meshRenderer.meshIndex !== undefined) return;
        if (!this.renderer) throw new Error('Engine: renderer not initialized');
        const meshIndex = this.renderer.getMeshIndex(meshRenderer.meshId);
        if (meshIndex === undefined) {
            throw new Error(`Unknown mesh ID "${meshRenderer.meshId}" in GameObject "${gameObject.name}" — make sure the mesh is registered`);
        }
        meshRenderer.meshIndex = meshIndex;
    }

    // Warn about a RigidBody that will be inert: the engine gates simulation/collision on
    // `physics_enabled = mass != 0`, so a mass-0 RigidBody is silently skipped and never collides.
    private warnIfInertRigidBody(gameObject: GameObject): void {
        const rigidBody = gameObject.getComponent(RigidBody);
        if (rigidBody && rigidBody.mass === 0) {
            console.warn(
                `⚠️ "${gameObject.name}": RigidBody has mass 0 — physics & collision are DISABLED for it ` +
                '(the engine only simulates entities with mass != 0). For a fixed, collidable surface use a ' +
                'non-zero mass together with isKinematic (RigidBody.staticBody).',
            );
        }
    }

    // SceneRuntime: register/unregister a GameObject added or removed at runtime (after loadScene).
    registerRuntimeEntity(gameObject: GameObject): void {
        if (!this.bridge) return; // scene not mounted yet
        const error = this.registerEntity(gameObject);
        if (error) {
            console.error(`❌ Engine.registerRuntimeEntity("${gameObject.name}"): ${error}`);
        }
    }

    unregisterRuntimeEntity(gameObject: GameObject): void {
        // Registration adds every MeshRenderer entity to WASM (physics AND static), so removal
        // must be symmetric — otherwise a runtime-removed static prop leaks its WASM entity and
        // keeps rendering. removePhysicsEntity keys off gameObject.id and safely no-ops if the
        // entity was never registered.
        this.bridge?.removePhysicsEntity(gameObject.id);
    }

    /** Unmount the current scene: tear down its input, drop its physics world + renderer meshes. */
    private unloadCurrent(): void {
        if (!this.currentScene) return;
        this.currentScene.dispose(); // also unbinds the runtime
        this.renderer?.clearMeshes();
        this.bridge = undefined;
        this.currentScene = undefined;
    }

    // One frame of the runtime: component/input update → physics step → render.
    private tick(deltaTime: number): void {
        const scene = this.currentScene;
        if (!scene) return;
        scene.updateComponents(deltaTime);
        this.bridge?.update(deltaTime);
        this.render();
    }

    // Render the current scene: map WASM instance data → GPU, push the camera, draw.
    render(): void {
        if (!this.renderer || !this.bridge || !this.currentScene) return;
        if (!this.bridge.hasWasmModule()) return;

        const entityCount = this.bridge.getStats().entityCount;
        if (entityCount === 0) return; // nothing to render

        const wasmMemory = this.bridge.getWasmMemory();
        if (!wasmMemory) {
            console.warn('⚠️ WASM memory not available - skipping frame');
            return;
        }
        const transformsOffset = this.bridge.getEntityTransformsOffset();
        if (transformsOffset === undefined) {
            console.warn('⚠️ WASM transforms offset not available - skipping frame');
            return;
        }

        this.renderer.mapInstanceDataFromWasm(wasmMemory, transformsOffset, entityCount);
        const aspect = this.renderer.getAspectRatio();
        this.renderer.updateCamera(this.currentScene.getViewProjectionMatrix(aspect));
        this.renderer.render(this.bridge.getWasmModule());
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
            this.tick(deltaTime);
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
