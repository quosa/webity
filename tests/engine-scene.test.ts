import { Engine } from '../src/engine/engine';
import { Scene } from '../src/engine/scene-system';
import { GameObject } from '../src/engine/gameobject';
import { MeshRenderer, RigidBody, CollisionShape } from '../src/engine/components';
import { Mesh } from '../src/engine/mesh';
import { Material } from '../src/engine/material';
import { WasmLoader } from '../src/engine/wasm-loader';
import type { WebGPURendererV2 } from '../src/renderer/webgpu.renderer';

// Minimal renderer stub: registration only needs registerMesh + getMeshIndex; clearMeshes runs
// on scene swap.
const stubRenderer = {
    getMeshIndex: () => 0,
    registerMesh: () => {},
    clearMeshes: () => {},
} as unknown as WebGPURendererV2;

// Mount a scene through the Engine with the stub renderer + a real WASM module (the Engine owns
// registration + the physics bridge now). Bypasses Engine.init()'s real WebGPU device.
async function mountScene(scene: Scene): Promise<void> {
    document.body.innerHTML = '<canvas id="webgpu-canvas"></canvas>';
    const engine = new Engine('webgpu-canvas');
    (engine as unknown as { renderer: WebGPURendererV2 }).renderer = stubRenderer;
    (engine as unknown as { wasm: unknown }).wasm = await WasmLoader.loadPhysicsModule();
    await engine.loadScene(scene);
}

describe('Scene is pure data before mount (A3)', () => {
    it('builds a full scene with object-mode assets and no renderer/WASM — no throw', () => {
        const scene = new Scene();

        const floor = new GameObject('floor', 'Floor');
        floor.addComponent(new MeshRenderer(Mesh.createGrid('grid'), new Material('gray', { r: .5, g: .5, b: .5, a: 1 }), 'lines'));

        const ball = new GameObject('ball', 'Ball');
        ball.addComponent(new MeshRenderer(Mesh.createSphere('sphere', 0.5))); // default material

        expect(() => {
            scene.add(floor);
            scene.add(ball);
        }).not.toThrow();

        expect(scene.getEntityCount()).toBe(2);
        // Mesh index is unresolved until mount() — building the scene touches no renderer.
        expect(ball.getComponent(MeshRenderer)?.meshIndex).toBeUndefined();
    });

    it('add is an alias of addGameObject', () => {
        const scene = new Scene();
        scene.add(new GameObject('a'));
        expect(scene.getGameObject('a')).not.toBeNull();
    });
});

describe('Engine constructor', () => {
    beforeEach(() => {
        document.body.innerHTML = '<canvas id="webgpu-canvas"></canvas>';
    });

    it('resolves a canvas by element id', () => {
        expect(() => new Engine('webgpu-canvas')).not.toThrow();
    });

    it('accepts a canvas element directly', () => {
        const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
        expect(() => new Engine(canvas)).not.toThrow();
    });

    it('throws for a missing canvas id', () => {
        expect(() => new Engine('does-not-exist')).toThrow(/not found/);
    });
});

describe('mount-time inert-collider warning (A3)', () => {
    it('warns for a RigidBody with mass 0 (silently disabled physics)', async () => {
        const scene = new Scene();
        const platform = new GameObject('platform', 'Platform');
        platform.addComponent(new MeshRenderer(Mesh.createCube('cube'), new Material('m', { r: 1, g: 1, b: 1, a: 1 })));
        platform.addComponent(new RigidBody(0, false, CollisionShape.BOX, { x: 1, y: 1, z: 1 })); // mass 0!
        scene.add(platform);

        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        await mountScene(scene);

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('mass 0'));
        warn.mockRestore();
    });

    it('does not warn for a mesh-only static entity (no RigidBody)', async () => {
        const scene = new Scene();
        const floor = new GameObject('floor', 'Floor');
        floor.addComponent(new MeshRenderer(Mesh.createGrid('grid'), Material.default, 'lines'));
        scene.add(floor);

        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        await mountScene(scene);

        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('mass 0'));
        warn.mockRestore();
    });
});
