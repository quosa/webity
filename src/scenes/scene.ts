// Simple static scene (no physics) — migrated to the scene-first engine API (A3).
// Build the Scene as pure data (Mesh/Material objects), then let the Engine mount + run it.

import { Engine } from '../engine/engine';
import { Scene } from '../engine/scene-system';
import { GameObject } from '../engine/gameobject';
import { MeshRenderer } from '../engine/components';
import { Mesh } from '../engine/mesh';
import { Material } from '../engine/material';

function buildScene(): Scene {
    const scene = new Scene();

    // Static floor grid (yellow, wireframe) — no RigidBody = static geometry.
    const floor = new GameObject(undefined, 'StaticFloor');
    floor.transform.setPosition(0, -2, 0);
    floor.addComponent(
        new MeshRenderer(Mesh.createGrid('grid', 20, 20), new Material('yellow', { r: 1, g: 1, b: 0, a: 1 }), 'lines'),
    );
    scene.add(floor);

    // Red triangle (center, front).
    const triangle = new GameObject('center-triangle', 'StaticTriangle');
    triangle.transform.setPosition(0, 0, -5);
    triangle.transform.setScale(2, 2, 2);
    triangle.addComponent(
        new MeshRenderer(Mesh.createTriangle('triangle', 1), new Material('red', { r: 1, g: 0, b: 0, a: 1 }), 'triangles'),
    );
    scene.add(triangle);

    // Green cube (left side).
    const leftCube = new GameObject('left-cube', 'StaticCube');
    leftCube.transform.setPosition(-2, 0, -5);
    leftCube.addComponent(
        new MeshRenderer(Mesh.createCube('cube', 1), new Material('green', { r: 0, g: 1, b: 0, a: 1 }), 'triangles'),
    );
    scene.add(leftCube);

    // Blue cube (right side).
    const rightCube = new GameObject('right-cube', 'StaticCube');
    rightCube.transform.setPosition(2, 0, -5);
    rightCube.addComponent(
        new MeshRenderer(Mesh.createCube('cube', 1), new Material('blue', { r: 0, g: 0, b: 1, a: 1 }), 'triangles'),
    );
    scene.add(rightCube);

    // Keep the legacy camera exactly as before.
    scene.camera.setPosition([0, 0, -10]);
    scene.camera.lookAt([0, 0, 0]);

    return scene;
}

async function main(): Promise<void> {
    const errorDiv = document.getElementById('error-message');
    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        const engine = new Engine('webgpu-canvas');
        await engine.init();
        const scene = buildScene();
        await engine.loadScene(scene);
        engine.start(scene);

        // Expose for console debugging + the index.html buttons.
        (window as any).engine = engine;
        (window as any).scene = scene;
        (window as any).staticScene = scene;

        (window as any).logSceneInfo = () => {
            console.log('📊 Current Scene Info:', scene.getSceneInfo());
        };

        (window as any).logWasmInfo = () => {
            console.log('📊 WASM Stats:', scene.physicsBridge.getStats());
        };

        console.log('✅ static scene running');
    } catch (error) {
        console.error('❌ static scene failed:', error);
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            (errorDiv as HTMLElement).style.display = 'block';
        }
    }
}

main();
