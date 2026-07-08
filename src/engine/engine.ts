// The Engine runtime.
//
// A `Scene` is pure data; the Engine owns the WebGPU renderer, mounts a scene (uploads its
// meshes, registers its entities), and drives the frame loop. Usage:
//
//   const engine = new Engine('webgpu-canvas');
//   await engine.init();          // WebGPU (+ WASM via the scene's physics bridge at mount)
//   const scene = buildScene();   // pure data
//   await engine.loadScene(scene); // mount: upload meshes, register entities (fail-loud)
//   engine.start(scene);          // input > physics > update > render loop

import { WebGPURendererV2 } from '../renderer/webgpu.renderer';
import { Scene } from './scene-system';
import { MeshRenderer } from './components';

export class Engine {
    private canvas: HTMLCanvasElement;
    private renderer?: WebGPURendererV2;
    private running = false;
    private animationId: number | undefined = undefined;
    private lastTime = 0;

    constructor(canvas: HTMLCanvasElement | string) {
        const element = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
        if (!element) {
            throw new Error(`Engine: canvas '${canvas}' not found`);
        }
        this.canvas = element as HTMLCanvasElement;
    }

    /** Initialize the WebGPU renderer. */
    async init(): Promise<void> {
        this.renderer = new WebGPURendererV2();
        await this.renderer.init(this.canvas);
    }

    getRenderer(): WebGPURendererV2 | undefined {
        return this.renderer;
    }

    /**
     * Mount a scene: register every mesh the scene references (from object-mode MeshRenderers)
     * with the renderer, then mount the scene (resolve mesh indices + register entities with
     * WASM, fail-loud). After this the scene is ready to render.
     */
    async loadScene(scene: Scene): Promise<void> {
        if (!this.renderer) {
            throw new Error('Engine.loadScene(): call init() first');
        }

        const registered = new Set<string>();
        for (const gameObject of scene.getAllGameObjects()) {
            const meshRenderer = gameObject.getComponent(MeshRenderer);
            const mesh = meshRenderer?.mesh;
            if (mesh && !registered.has(mesh.id)) {
                this.renderer.registerMesh(mesh.id, mesh.data);
                registered.add(mesh.id);
            }
        }

        await scene.mount(this.renderer);
    }

    /** Start the frame loop (input → physics → update → render). */
    start(scene: Scene): void {
        scene.start();
        this.running = true;
        this.lastTime = performance.now();

        const loop = (now: number): void => {
            if (!this.running) return;
            const deltaTime = Math.min((now - this.lastTime) / 1000, 1 / 30); // clamp at 30fps
            this.lastTime = now;
            scene.update(deltaTime);
            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    }

    /** Stop the frame loop. */
    stop(): void {
        this.running = false;
        if (this.animationId !== undefined) {
            cancelAnimationFrame(this.animationId);
            this.animationId = undefined;
        }
    }

    /** Stop and release GPU resources. */
    async deinit(): Promise<void> {
        this.stop();
        this.renderer?.dispose();
    }
}
