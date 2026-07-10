// Engine lifecycle: idempotent start/stop, pause/resume, and loadScene replace-semantics.
//
// The Engine is isolated from the real renderer/WASM: we inject stubs for both and a fake
// Scene of jest.fns, and mock requestAnimationFrame so the loop is scheduled but never fires
// (we assert scheduling, not stepping).

import { Engine } from '../src/engine/engine';
import type { Scene } from '../src/engine/scene-system';
import type { WebGPURendererV2 } from '../src/renderer/webgpu.renderer';
import type { WasmPhysicsInterface } from '../src/engine/wasm-physics-bridge';

interface FakeScene {
    getAllGameObjects: jest.Mock;
    mount: jest.Mock;
    start: jest.Mock;
    update: jest.Mock;
    dispose: jest.Mock;
}

function makeScene(): FakeScene {
    return {
        getAllGameObjects: jest.fn().mockReturnValue([]),
        mount: jest.fn().mockResolvedValue(undefined),
        start: jest.fn(),
        update: jest.fn(),
        dispose: jest.fn(),
    };
}

describe('Engine lifecycle', () => {
    let engine: Engine;
    let renderer: { registerMesh: jest.Mock; clearMeshes: jest.Mock; dispose: jest.Mock; getMeshIndex: jest.Mock };
    let wasm: { init: jest.Mock };
    let warn: jest.SpyInstance;

    beforeEach(() => {
        document.body.innerHTML = '<canvas id="webgpu-canvas"></canvas>';

        // rAF returns a handle but never invokes the callback → loop is scheduled, not stepped.
        global.requestAnimationFrame = jest.fn().mockReturnValue(7) as unknown as typeof requestAnimationFrame;
        global.cancelAnimationFrame = jest.fn() as unknown as typeof cancelAnimationFrame;
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        renderer = { registerMesh: jest.fn(), clearMeshes: jest.fn(), dispose: jest.fn(), getMeshIndex: jest.fn().mockReturnValue(0) };
        wasm = { init: jest.fn() };

        engine = new Engine('webgpu-canvas');
        // Bypass init() (real WebGPU + WASM); inject stubs.
        (engine as unknown as { renderer: WebGPURendererV2 }).renderer = renderer as unknown as WebGPURendererV2;
        (engine as unknown as { wasm: WasmPhysicsInterface }).wasm = wasm as unknown as WasmPhysicsInterface;
    });

    afterEach(() => {
        warn.mockRestore();
    });

    const raf = (): jest.Mock => global.requestAnimationFrame as unknown as jest.Mock;

    it('start() runs scene.start() once and schedules exactly one loop', async () => {
        const scene = makeScene();
        await engine.loadScene(scene as unknown as Scene);

        engine.start();

        expect(scene.start).toHaveBeenCalledTimes(1);
        expect(raf()).toHaveBeenCalledTimes(1);
        expect(engine.isRunning).toBe(true);
    });

    it('start() is idempotent: a second call warns and does not spawn a second loop', async () => {
        const scene = makeScene();
        await engine.loadScene(scene as unknown as Scene);

        engine.start();
        engine.start();

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('already running'));
        expect(scene.start).toHaveBeenCalledTimes(1);
        expect(raf()).toHaveBeenCalledTimes(1); // no duplicate rAF loop
        expect(engine.isRunning).toBe(true);
    });

    it('stop() then start() resumes without re-running scene.start()', async () => {
        const scene = makeScene();
        await engine.loadScene(scene as unknown as Scene);

        engine.start();
        engine.stop();
        expect(engine.isRunning).toBe(false);

        engine.start(); // resume

        expect(scene.start).toHaveBeenCalledTimes(1); // NOT re-run on resume
        expect(engine.isRunning).toBe(true);
        expect(raf()).toHaveBeenCalledTimes(2); // one schedule per start()
    });

    it('stop() is idempotent: stopping an already-stopped engine warns and no-ops', async () => {
        const scene = makeScene();
        await engine.loadScene(scene as unknown as Scene);

        engine.start();
        engine.stop();
        engine.stop();

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('not running'));
        expect(engine.isRunning).toBe(false);
    });

    it('start() with no scene loaded throws', () => {
        expect(() => engine.start()).toThrow(/no scene loaded/);
    });

    it('loadScene replaces the current scene: stops the loop, unmounts the old, mounts the new', async () => {
        const sceneA = makeScene();
        const sceneB = makeScene();

        await engine.loadScene(sceneA as unknown as Scene);
        engine.start();
        expect(engine.isRunning).toBe(true);

        await engine.loadScene(sceneB as unknown as Scene);

        // Loop stopped for the swap; old scene torn down; WASM world + renderer meshes cleared.
        expect(engine.isRunning).toBe(false);
        expect(sceneA.dispose).toHaveBeenCalledTimes(1);
        expect(wasm.init).toHaveBeenCalled();          // unloadCurrent clears the world
        expect(renderer.clearMeshes).toHaveBeenCalled();
        expect(sceneB.mount).toHaveBeenCalledWith(renderer, wasm);

        // hasStarted was reset, so the next start() runs the NEW scene's start() once.
        engine.start();
        expect(sceneB.start).toHaveBeenCalledTimes(1);
        expect(sceneA.start).toHaveBeenCalledTimes(1); // A only started during its own run
    });

    it('reloading a fresh scene rewinds and reseeds the frame clock', async () => {
        const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(1000);

        const first = makeScene();
        await engine.loadScene(first as unknown as Scene);
        engine.start();

        nowSpy.mockReturnValue(5000); // wall clock advanced while "playing"
        const reloaded = makeScene();
        await engine.loadScene(reloaded as unknown as Scene); // reset == reload
        engine.start();

        // Fresh scene mounted and started from scratch; lastTime reseeded to the reload instant.
        expect(reloaded.start).toHaveBeenCalledTimes(1);
        expect((engine as unknown as { lastTime: number }).lastTime).toBe(5000);
        nowSpy.mockRestore();
    });

    it('deinit stops the loop, unmounts the scene, and disposes the renderer', async () => {
        const scene = makeScene();
        await engine.loadScene(scene as unknown as Scene);
        engine.start();

        await engine.deinit();

        expect(engine.isRunning).toBe(false);
        expect(scene.dispose).toHaveBeenCalledTimes(1);
        expect(renderer.dispose).toHaveBeenCalledTimes(1);
        // deinit must not warn about stop() when it was running
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('not running'));
    });
});
