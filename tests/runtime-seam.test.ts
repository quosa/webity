// Characterization tests for the runtime seam that the A3 "Engine owns the runtime" refactor
// (plan item #11) will MOVE from Scene to Engine. These pin the CURRENT observable behavior so
// the refactor can be verified to reproduce it:
//   1. Scene.update() pipeline order: input → components → physics → render, and render()'s
//      exact calls into the renderer (mapInstanceDataFromWasm → updateCamera → render) + guards.
//   2. Engine's rAF loop body: scene.update() is called with a delta clamped to 1/30, and the
//      frame clock advances.
//   3. WasmPhysicsBridge.update() sync-back: dynamic bodies' transforms/velocities are written
//      from WASM; kinematic bodies are skipped.
//
// When #11 lands, tests (1) migrate from scene.update()/render() to the Engine-driven path;
// (2) and (3) are entry-point-stable (Engine loop + bridge survive the move).

import { Engine } from '../src/engine/engine';
import { Scene } from '../src/engine/scene-system';
import { GameObject } from '../src/engine/gameobject';
import { MeshRenderer, RigidBody, CollisionShape } from '../src/engine/components';
import { Mesh } from '../src/engine/mesh';
import { Material } from '../src/engine/material';
import { PerspectiveCamera } from '../src/engine/camera-object';
import { WasmPhysicsBridge } from '../src/engine/wasm-physics-bridge';
import type { WebGPURendererV2 } from '../src/renderer/webgpu.renderer';
import type { WasmPhysicsInterface } from '../src/engine/wasm-physics-bridge';

// A physicsBridge stub whose render-facing getters report one entity with valid WASM memory.
function makeBridgeStub(calls?: string[]) {
    return {
        init: jest.fn(),
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
        getMeshIndex: jest.fn().mockReturnValue(0),
    };
}

function sceneWithMocks(bridge: object, renderer: object): Scene {
    const scene = new Scene();
    scene.setCamera(new PerspectiveCamera('cam'));
    (scene as unknown as { physicsBridge: object }).physicsBridge = bridge;
    (scene as unknown as { renderer: object }).renderer = renderer;
    return scene;
}

describe('Scene.update() pipeline (seam moving to Engine in #11)', () => {
    it('runs input → components → physics → render in that order, then draws', () => {
        const calls: string[] = [];
        const bridge = makeBridgeStub(calls);
        const renderer = makeRendererStub(calls);
        const scene = sceneWithMocks(bridge, renderer);

        const go = new GameObject('go');
        go.addComponent(new MeshRenderer(Mesh.createCube('cube'), Material.default));
        const goUpdate = jest.spyOn(go, 'update').mockImplementation(() => { calls.push('component'); });
        scene.add(go);

        (scene as unknown as { activeInputController: { update: jest.Mock } }).activeInputController = {
            update: jest.fn(() => calls.push('input')),
        };

        scene.update(0.016);

        // Documented pipeline order (scene-system.ts:238-258).
        expect(calls).toEqual(['input', 'component', 'physics', 'map', 'camera', 'render']);
        expect(bridge.update).toHaveBeenCalledWith(0.016);
        expect(renderer.mapInstanceDataFromWasm).toHaveBeenCalledWith(expect.any(ArrayBuffer), 0, 1);
        goUpdate.mockRestore();
    });

    it('render() skips drawing when the scene has no WASM entities', () => {
        const bridge = makeBridgeStub();
        bridge.getStats.mockReturnValue({ entityCount: 0, isInitialized: true });
        const renderer = makeRendererStub();
        const scene = sceneWithMocks(bridge, renderer);

        scene.render();

        expect(renderer.mapInstanceDataFromWasm).not.toHaveBeenCalled();
        expect(renderer.render).not.toHaveBeenCalled();
    });

    it('render() no-ops without a WASM module', () => {
        const bridge = makeBridgeStub();
        bridge.hasWasmModule.mockReturnValue(false);
        const renderer = makeRendererStub();
        const scene = sceneWithMocks(bridge, renderer);

        scene.render();

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

    function startedEngine(sceneUpdate: jest.Mock): Engine {
        const engine = new Engine('webgpu-canvas');
        (engine as unknown as { renderer: WebGPURendererV2 }).renderer = makeRendererStub() as unknown as WebGPURendererV2;
        (engine as unknown as { wasm: WasmPhysicsInterface }).wasm = { init: jest.fn() } as unknown as WasmPhysicsInterface;
        const scene = { getAllGameObjects: () => [], mount: jest.fn().mockResolvedValue(undefined), start: jest.fn(), update: sceneUpdate, dispose: jest.fn() };
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

describe('WasmPhysicsBridge.update() sync-back (stays on the bridge across #11)', () => {
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
