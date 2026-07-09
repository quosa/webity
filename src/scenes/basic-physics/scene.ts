// Canonical A3 scene — the scene-first engine API showcase.
//
// A red ball falls onto a blue pyramid resting on a floor grid. Note the shape of it:
// `buildScene()` is PURE DATA (no renderer, no WASM, meshes/materials as objects, any order),
// and the Engine mounts + runs it. This is the whole point of A3.

import { Engine } from '../../engine/engine';
import { Scene } from '../../engine/scene-system';
import { GameObject } from '../../engine/gameobject';
import { MeshRenderer, RigidBody, CollisionShape } from '../../engine/components';
import { Mesh } from '../../engine/mesh';
import { Material } from '../../engine/material';
import { PerspectiveCamera } from '../../engine/camera-object';

function buildScene(): Scene {
    const scene = new Scene();

    // Camera — a GameObject; position on its transform, lookAt for orientation.
    const camera = new PerspectiveCamera('main');
    camera.transform.setPosition(0, 0, -12);
    camera.lookAt(0, -5, 0);
    scene.setCamera(camera);

    // Floor grid — static, wireframe, gray.
    const floor = new GameObject('floor', 'Floor');
    floor.transform.setPosition(0, -8, 0);
    floor.addComponent(
        new MeshRenderer(Mesh.createGrid('grid', 20, 20), new Material('gray', { r: 0.5, g: 0.5, b: 0.5, a: 1 }), 'lines'),
    );
    scene.add(floor);

    // Blue pyramid — resting on the floor, kinematic (a fixed landing surface).
    const pyramid = new GameObject('pyramid', 'Pyramid');
    pyramid.transform.setPosition(0, -7, 0);
    pyramid.addComponent(new MeshRenderer(Mesh.createPyramid('pyramid', 2, 2), new Material('blue', { r: 0, g: 0, b: 1, a: 1 })));
    // Fixed, collidable landing surface — RigidBody.staticBody is kinematic with a non-zero
    // mass, so it participates in collision without the mass-0 footgun and doesn't move.
    pyramid.addComponent(RigidBody.staticBody(CollisionShape.BOX, { x: 1, y: 1, z: 1 }));
    scene.add(pyramid);

    // Red ball — falls from above under gravity.
    const ball = new GameObject('ball', 'Ball');
    ball.transform.setPosition(0, 3, 0);
    ball.addComponent(new MeshRenderer(Mesh.createSphere('sphere', 0.5), new Material('red', { r: 1, g: 0, b: 0, a: 1 })));
    ball.addComponent(new RigidBody(1, true, CollisionShape.SPHERE, { x: 0.5, y: 0.5, z: 0.5 }));
    scene.add(ball);

    return scene;
}

async function main(): Promise<void> {
    const errorDiv = document.getElementById('error-message');
    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        const engine = new Engine('webgpu-canvas');
        await engine.init();               // WebGPU + WASM
        const scene = buildScene();        // pure data
        await engine.loadScene(scene);     // mount: upload meshes, register entities (fail-loud)
        engine.start(scene);               // input > physics > update > render

        // Expose for console debugging.
        (window as unknown as { engine: Engine; scene: Scene }).engine = engine;
        (window as unknown as { engine: Engine; scene: Scene }).scene = scene;
        console.log('✅ basic-physics scene running (red ball → blue pyramid → floor grid)');
    } catch (error) {
        console.error('❌ basic-physics scene failed:', error);
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            (errorDiv as HTMLElement).style.display = 'block';
        }
    }
}

main();
