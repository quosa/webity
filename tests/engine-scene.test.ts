import { Engine } from '../src/engine/engine';
import { Scene } from '../src/engine/scene-system';
import { GameObject } from '../src/engine/gameobject';
import { MeshRenderer } from '../src/engine/components';
import { Mesh } from '../src/engine/mesh';
import { Material } from '../src/engine/material';

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
