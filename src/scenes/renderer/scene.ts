/*
 * This is rendering browser test scenario script
 * SEE: browser-tests/README.md
 */

import { Engine } from '../../engine/engine';
import { Scene } from '../../engine/scene-system';
import { GameObject } from '../../engine/gameobject';
import { MeshRenderer } from '../../engine/components';
import { PerspectiveCamera } from '../../engine/camera-object';
import { Mesh } from '../../engine/mesh';
import { Material } from '../../engine/material';

declare global {
    // eslint-disable-next-line no-unused-vars
    interface Window {
        // eslint-disable-next-line no-unused-vars
        runRenderingTest: (testName: string) => Promise<void>;
    }
}

// Expose a global function for Playwright to call
window.runRenderingTest = async function (testName: string) {
    const canvas = document.getElementById('test-canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas not found');

    if (!navigator.gpu) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = 'WebGPU is not supported in this browser';
            errorDiv.style.display = 'block';
        }
        throw new Error('WebGPU is not supported');
    }

    // Initialize the engine (owns the WebGPU renderer + WASM)
    const engine = new Engine('test-canvas');
    await engine.init();

    // Camera controls test builds its own scene + camera GameObject
    if (testName === 'camera-controls') {
        await setupCameraControlsTest(engine, canvas);
        return; // Skip the standard render() call
    }

    // Build the Scene as pure data (object-mode Mesh/Material)
    const scene = new Scene();

    // Add entities based on testName using GameObject/component system
    if (testName === 'triangle') {
        const triangle = new GameObject('triangle1', 'Triangle');
        triangle.transform.setPosition(0, 0, 5);
        triangle.transform.setScale(3, 3, 3);
        const meshRenderer = new MeshRenderer(Mesh.createTriangle('triangle', 1), new Material('red', { r: 1, g: 0, b: 0, a: 1 })); // Red
        triangle.addComponent(meshRenderer);
        scene.addGameObject(triangle);

    } else if (testName === 'cubes') {
        const cube1 = new GameObject('cube1', 'Cube1');
        cube1.transform.setPosition(-3, 0, 5);
        cube1.transform.setScale(1, 1, 1);
        const meshRenderer1 = new MeshRenderer(Mesh.createCube('cube', 2), new Material('green', { r: 0, g: 1, b: 0, a: 1 })); // Green
        cube1.addComponent(meshRenderer1);
        scene.addGameObject(cube1);

        const cube2 = new GameObject('cube2', 'Cube2');
        cube2.transform.setPosition(3, 0, 5);
        cube2.transform.setScale(1, 1, 1);
        const meshRenderer2 = new MeshRenderer(Mesh.createCube('cube', 2), new Material('blue', { r: 0, g: 0, b: 1, a: 1 })); // Blue
        cube2.addComponent(meshRenderer2);
        scene.addGameObject(cube2);
    }

    // Always add the floor using GameObject/component system
    const floor = new GameObject('floor', 'Floor');
    floor.transform.setPosition(0, -2, 0);
    floor.transform.setScale(1, 1, 1);
    const floorMeshRenderer = new MeshRenderer(Mesh.createGrid('grid', 20, 20), new Material('floor-green', { r: 0.2, g: 0.8, b: 0.2, a: 1 }), 'lines');
    floor.addComponent(floorMeshRenderer);
    scene.addGameObject(floor);

    // Create the camera GameObject and make it the scene's active camera (render + input)
    // We use the 45° FOV to keep the perspective correct with the original snapshots
    // (which were also taken with a 45° PI/4 FOV camera).
    const camera = new PerspectiveCamera('test-camera', { fov: Math.PI / 4 });
    camera.transform.setPosition(0, 0, -10);
    camera.lookAt(0, 0, 0);
    scene.setCamera(camera);

    // Mount: register meshes + entities
    await engine.loadScene(scene);

    // Start the engine loop (renders the static scene for the snapshot)
    engine.start();
};

// Camera controls test setup function
async function setupCameraControlsTest(engine: Engine, _canvas: HTMLCanvasElement): Promise<void> {
    console.log('🎥 Setting up camera controls validation test...');

    // Create Scene as pure data
    const scene = new Scene();

    // Create floor grid
    const floor = new GameObject(undefined, 'test-floor');
    floor.transform.setPosition(0, -3, 0);
    floor.addComponent(new MeshRenderer(Mesh.createGrid('grid', 20, 20), new Material('yellow', { r: 1, g: 1, b: 0, a: 1 }), 'lines')); // Yellow
    scene.addGameObject(floor);

    // Create reference cubes for spatial awareness
    const positions = [
        { x: -5, y: 2, z: -5, color: { r: 0, g: 1, b: 0, a: 1 } }, // Green
        { x: 5, y: 2, z: -5, color: { r: 0, g: 0, b: 1, a: 1 } },  // Blue
        { x: -5, y: 2, z: 5, color: { r: 1, g: 1, b: 0, a: 1 } },  // Yellow
        { x: 5, y: 2, z: 5, color: { r: 1, g: 0, b: 1, a: 1 } }    // Magenta
    ];

    positions.forEach((pos, index) => {
        const cube = new GameObject(`ref-cube-${index}`, `RefCube${index}`);
        cube.transform.setPosition(pos.x, pos.y, pos.z);
        cube.transform.setScale(0.7, 0.7, 0.7);

        const meshRenderer = new MeshRenderer(Mesh.createCube('cube', 1), new Material(`ref-cube-${index}`, pos.color));
        cube.addComponent(meshRenderer);
        scene.addGameObject(cube);
    });

    // Add center reference cube (red, rotating)
    const centerCube = new GameObject('center-cube', 'CenterReference');
    centerCube.transform.setPosition(0, 0, 0);
    const centerMeshRenderer = new MeshRenderer(Mesh.createCube('cube', 1), new Material('red', { r: 1, g: 0, b: 0, a: 1 }));
    centerCube.addComponent(centerMeshRenderer);
    scene.addGameObject(centerCube);

    // Create the camera GameObject and make it the scene's active camera (render + input)
    const camera = new PerspectiveCamera('test-camera', { fov: Math.PI / 3 });
    camera.transform.setPosition(-8, 3, -8);
    scene.setCamera(camera);

    // Mount: register meshes + entities
    await engine.loadScene(scene);

    // Set initial camera position for good view of the scene
    scene.camera.setPosition([0, 8, -15]);
    scene.camera.lookAt([0, 1, 0]);

    // Test camera movement to demonstrate functionality
    scene.camera.move(1, 0, 0); // Move forward slightly
    scene.camera.orbitAroundTarget(0.1, 0); // Slight orbit for dynamic view

    // Start the engine loop (renders the static scene for the snapshot)
    engine.start();

    console.log('✅ Camera controls test setup complete');
    console.log(`📊 Scene entities: ${scene.getEntityCount()}`);

    // Export for debugging (if needed)
    if (typeof window !== 'undefined') {
        (window as any).cameraControlsScene = scene;
        (window as any).cameraComponent = camera.cameraComponent;
    }
}
