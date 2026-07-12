// Runtime-seam tests. Originally characterization tests written BEFORE the "Engine owns the
// runtime" refactor (plan #11); now that the runtime lives on the Engine, they assert the Engine
// reproduces the pinned behavior:
//   1. Engine.tick() pipeline order: scene.updateComponents → bridge.update → render (which calls
//      the renderer as mapInstanceDataFromWasm → updateCamera → render), plus render() guards.
//   2. Engine's rAF loop body: tick runs with a delta clamped to 1/30, and the clock advances.
//   3. WasmPhysicsBridge.update() sync-back: dynamic bodies written from WASM, kinematic skipped.

import { Engine } from '../src/engine/engine';
import { GameObject } from '../src/engine/gameobject';
import { RigidBody, CollisionShape } from '../src/engine/components';
import { WasmPhysicsBridge } from '../src/engine/wasm-physics-bridge';
import type { WebGPURendererV2 } from '../src/renderer/webgpu.renderer';
import type { Scene } from '../src/engine/scene-system';
import type { WasmPhysicsInterface } from '../src/engine/wasm-physics-bridge';

// A bridge stub whose render-facing getters report one entity with valid WASM memory.
function makeBridgeStub(calls?: string[]) {
    return {
        update: jest.fn(() => calls?.push('physics')),
        hasWasmModule: jest.fn().mockReturnValue(true),
        getStats: jest.fn().mockReturnValue({ entityCount: 1, isInitialized: true }),
        getWasmMemory: jest.fn().mockReturnValue(new ArrayBuffer(1024)),
        getEntityTransformsOffset: jest.fn().mockReturnValue(0),
        getWasmModule: jest.fn().mockReturnValue({}),
    };
}

function makeRendererStub(calls?: string[]) {
    return {
        mapInstanceDataFromWasm: jest.fn(() => calls?.push('map')),
        getAspectRatio: jest.fn().mockReturnValue(1),
        updateCamera: jest.fn(() => calls?.push('camera')),
        render: jest.fn(() => calls?.push('render')),
    };
}

function makeSceneStub(calls?: string[]) {
    return {
        updateComponents: jest.fn(() => calls?.push('components')),
        getViewProjectionMatrix: jest.fn().mockReturnValue(new Float32Array(16)),
    };
}

// Build an Engine with injected stubs (bypasses init()'s real WebGPU + WASM).
function engineWith(scene: object, bridge: object, renderer: object): Engine {
    document.body.innerHTML = '<canvas id="webgpu-canvas"></canvas>';
    const engine = new Engine('webgpu-canvas');
    (engine as unknown as { renderer: WebGPURendererV2 }).renderer = renderer as unknown as WebGPURendererV2;
    (engine as unknown as { bridge: object }).bridge = bridge;
    (engine as unknown as { currentScene: Scene }).currentScene = scene as unknown as Scene;
    return engine;
}

describe('Engine.tick() pipeline (moved from Scene in #11)', () => {
    it('runs components → physics → render in order, then draws', () => {
        const calls: string[] = [];
        const scene = makeSceneStub(calls);
        const bridge = makeBridgeStub(calls);
        const renderer = makeRendererStub(calls);
        const engine = engineWith(scene, bridge, renderer);

        (engine as unknown as { tick(dt: number): void }).tick(0.016);

        expect(calls).toEqual(['components', 'physics', 'map', 'camera', 'render']);
        expect(scene.updateComponents).toHaveBeenCalledWith(0.016);
        expect(bridge.update).toHaveBeenCalledWith(0.016);
        expect(renderer.mapInstanceDataFromWasm).toHaveBeenCalledWith(expect.any(ArrayBuffer), 0, 1);
    });

    it('render() skips drawing when the scene has no WASM entities', () => {
        const bridge = makeBridgeStub();
        bridge.getStats.mockReturnValue({ entityCount: 0, isInitialized: true });
        const renderer = makeRendererStub();
        const engine = engineWith(makeSceneStub(), bridge, renderer);

        engine.render();

        expect(renderer.mapInstanceDataFromWasm).not.toHaveBeenCalled();
        expect(renderer.render).not.toHaveBeenCalled();
    });

    it('render() no-ops without a WASM module', () => {
        const bridge = makeBridgeStub();
        bridge.hasWasmModule.mockReturnValue(false);
        const renderer = makeRendererStub();
        const engine = engineWith(makeSceneStub(), bridge, renderer);

        engine.render();

        expect(renderer.render).not.toHaveBeenCalled();
    });
});

describe('Engine rAF loop body (delta clamping + clock)', () => {
    let rafCb: FrameRequestCallback | undefined;

    beforeEach(() => {
        document.body.innerHTML = '<canvas id="webgpu-canvas"></canvas>';
        rafCb = undefined;
        global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
            rafCb = cb; // capture, do not auto-run
            return 1;
        }) as unknown as typeof requestAnimationFrame;
        global.cancelAnimationFrame = jest.fn() as unknown as typeof cancelAnimationFrame;
    });

    function startedEngine(updateComponents: jest.Mock): Engine {
        const engine = new Engine('webgpu-canvas');
        (engine as unknown as { renderer: WebGPURendererV2 }).renderer = makeRendererStub() as unknown as WebGPURendererV2;
        (engine as unknown as { bridge: object }).bridge = makeBridgeStub();
        const scene = { updateComponents, getViewProjectionMatrix: () => new Float32Array(16), start: jest.fn() };
        (engine as unknown as { currentScene: object }).currentScene = scene;
        (engine as unknown as { hasStarted: boolean }).hasStarted = true; // skip scene.start()
        return engine;
    }

    it('passes a normal frame delta straight through', () => {
        const update = jest.fn();
        const engine = startedEngine(update);
        const now = jest.spyOn(performance, 'now').mockReturnValue(1000);

        engine.start();
        rafCb?.(1010); // +10ms

        expect(update).toHaveBeenCalledWith(0.01);
        now.mockRestore();
    });

    it('clamps a long stall to 1/30s so physics never takes a huge step', () => {
        const update = jest.fn();
        const engine = startedEngine(update);
        const now = jest.spyOn(performance, 'now').mockReturnValue(1000);

        engine.start();
        rafCb?.(6000); // +5s stall

        expect(update).toHaveBeenCalledWith(1 / 30);
        expect((engine as unknown as { lastTime: number }).lastTime).toBe(6000);
        now.mockRestore();
    });
});

describe('WasmPhysicsBridge.update() sync-back', () => {
    function fakeWasm(): WasmPhysicsInterface {
        return {
            init: jest.fn(),
            update: jest.fn(),
            get_entity_position_x: jest.fn().mockReturnValue(1),
            get_entity_position_y: jest.fn().mockReturnValue(2),
            get_entity_position_z: jest.fn().mockReturnValue(3),
            get_entity_velocity_x: jest.fn().mockReturnValue(4),
            get_entity_velocity_y: jest.fn().mockReturnValue(5),
            get_entity_velocity_z: jest.fn().mockReturnValue(6),
        } as unknown as WasmPhysicsInterface;
    }

    async function bridgeWith(...entities: [number, GameObject][]): Promise<WasmPhysicsBridge> {
        const bridge = new WasmPhysicsBridge();
        await bridge.init(fakeWasm());
        const map = (bridge as unknown as { gameObjectMap: Map<number, GameObject> }).gameObjectMap;
        for (const [id, go] of entities) map.set(id, go);
        return bridge;
    }

    it('writes WASM position/velocity back into a dynamic body', async () => {
        const go = new GameObject('dynamic');
        go.addComponent(new RigidBody(1, true, CollisionShape.SPHERE, { x: 0.5, y: 0.5, z: 0.5 }));
        const bridge = await bridgeWith([0, go]);

        bridge.update(0.016);

        expect(go.transform.position).toEqual({ x: 1, y: 2, z: 3 });
        expect(go.getComponent(RigidBody)?.velocity).toEqual({ x: 4, y: 5, z: 6 });
    });

    it('skips kinematic bodies (their transform is author/WASM-driven, not synced back)', async () => {
        const go = new GameObject('kinematic');
        go.transform.setPosition(9, 9, 9);
        go.addComponent(new RigidBody(1, false, CollisionShape.BOX, { x: 1, y: 1, z: 1 }, { kinematic: true }));
        const bridge = await bridgeWith([0, go]);

        bridge.update(0.016);

        expect(go.transform.position).toEqual({ x: 9, y: 9, z: 9 });
    });
});
