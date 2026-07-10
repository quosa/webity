// Camera controls scene — migrated to the scene-first engine API (A3).
// Build the Scene as pure data; the legacy `scene.camera` stays in place so the index.html
// movement/orbit buttons keep working. The Engine mounts + runs it.

import { Engine } from '../../engine/engine';
import { Scene } from '../../engine/scene-system';
import { GameObject } from '../../engine/gameobject';
import { MeshRenderer, RotatorComponent, CameraComponent } from '../../engine/components';
import { Mesh } from '../../engine/mesh';
import { Material } from '../../engine/material';

function buildScene(): Scene {
    const scene = new Scene();

    // Floor grid (yellow, wireframe) — static reference.
    const floor = new GameObject(undefined, 'CameraTestFloor');
    floor.transform.setPosition(0, -3, 0);
    floor.addComponent(
        new MeshRenderer(Mesh.createGrid('grid', 20, 20), new Material('yellow', { r: 1, g: 1, b: 0, a: 1 }), 'lines'),
    );
    scene.add(floor);

    // Center cube (red) — main reference point, slow Y rotation.
    const centerCube = new GameObject('center-cube', 'CenterReference');
    centerCube.transform.setPosition(0, 0, 0);
    centerCube.addComponent(
        new MeshRenderer(Mesh.createCube('cube', 1), new Material('red', { r: 1, g: 0, b: 0, a: 1 }), 'triangles'),
    );
    centerCube.addComponent(new RotatorComponent(0, 10, 0));
    scene.add(centerCube);

    // Surrounding cubes for spatial reference, each with a different rotation speed.
    const positions = [
        { x: -5, y: 2, z: -5, color: { r: 0, g: 1, b: 0, a: 1 } }, // Green
        { x: 5, y: 2, z: -5, color: { r: 0, g: 0, b: 1, a: 1 } },  // Blue
        { x: -5, y: 2, z: 5, color: { r: 1, g: 1, b: 0, a: 1 } },  // Yellow
        { x: 5, y: 2, z: 5, color: { r: 1, g: 0, b: 1, a: 1 } },   // Magenta
        { x: 0, y: 5, z: 0, color: { r: 0, g: 1, b: 1, a: 1 } },   // Cyan (top)
    ];

    positions.forEach((pos, index) => {
        const cube = new GameObject(`reference-cube-${index}`, `ReferencePoint${index}`);
        cube.transform.setPosition(pos.x, pos.y, pos.z);
        cube.transform.setScale(0.7, 0.7, 0.7);
        cube.addComponent(
            new MeshRenderer(Mesh.createCube('cube', 1), new Material(`ref-${index}`, pos.color), 'triangles'),
        );
        cube.addComponent(new RotatorComponent(5 + index * 2, 8 + index * 3, 3 + index));
        scene.add(cube);
    });

    // Camera GameObject demonstrating CameraComponent (not active by default).
    const cameraObject = new GameObject('camera-gameobject', 'CameraController');
    cameraObject.transform.setPosition(-8, 3, -8);
    cameraObject.addComponent(new CameraComponent(true, Math.PI / 3, 0.1, 100));
    scene.add(cameraObject);

    // Keep the legacy camera exactly as before (drives the index.html buttons).
    scene.camera.setPosition([0, 8, -15]);
    scene.camera.lookAt([0, 1, 0]);

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
        engine.start();

        // Expose for console debugging + the index.html camera panel.
        (window as any).engine = engine;
        (window as any).scene = scene;
        (window as any).cameraTestScene = scene;

        // Preserve the CameraComponent readiness check from the legacy scene.
        setTimeout(() => {
            const cameraGameObject = scene.getGameObject('camera-gameobject');
            const cameraComponent = cameraGameObject?.getComponent(CameraComponent);
            if (cameraComponent) {
                console.log('📷 CameraComponent found and ready for testing');
            }
        }, 3000);

        console.log('✅ camera-controls scene running');
    } catch (error) {
        console.error('❌ camera-controls scene failed:', error);
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            (errorDiv as HTMLElement).style.display = 'block';
        }
    }
}

main();
