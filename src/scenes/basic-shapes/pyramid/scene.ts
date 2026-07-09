// Multi-shape scene (triangle + cube + sphere + pyramid + grid) — migrated to the
// scene-first engine API (A3). Build the Scene as pure data, then let the Engine mount + run it.

import { Engine } from '../../../engine/engine';
import { Scene } from '../../../engine/scene-system';
import { GameObject } from '../../../engine/gameobject';
import { MeshRenderer } from '../../../engine/components';
import { Mesh } from '../../../engine/mesh';
import { Material } from '../../../engine/material';

function buildScene(): Scene {
    const scene = new Scene();

    // 1. Triangle (Red) — far left.
    const triangle = new GameObject('triangle-entity', 'Triangle');
    triangle.transform.setPosition(-6, 0, 0);
    triangle.addComponent(
        new MeshRenderer(Mesh.createTriangle('triangle', 1), new Material('red', { r: 1, g: 0, b: 0, a: 1 }), 'triangles'),
    );
    scene.add(triangle);

    // 2. Cube (Blue) — center left.
    const cube = new GameObject('cube-entity', 'Cube');
    cube.transform.setPosition(-2, 0, 0);
    cube.addComponent(
        new MeshRenderer(Mesh.createCube('cube', 1), new Material('blue', { r: 0, g: 0, b: 1, a: 1 }), 'triangles'),
    );
    scene.add(cube);

    // 3. Sphere (Green) — center right.
    const sphere = new GameObject('sphere-entity', 'Sphere');
    sphere.transform.setPosition(2, 0, 0);
    sphere.addComponent(
        new MeshRenderer(Mesh.createSphere('sphere', 1, 16), new Material('green', { r: 0, g: 1, b: 0, a: 1 }), 'triangles'),
    );
    scene.add(sphere);

    // 4. Pyramid (Purple) — far right (taller pyramid for visibility).
    const pyramid = new GameObject('pyramid-entity', 'Pyramid');
    pyramid.transform.setPosition(6, 0, 0);
    pyramid.addComponent(
        new MeshRenderer(Mesh.createPyramid('pyramid', 1, 1.5), new Material('purple', { r: 1, g: 0, b: 1, a: 1 }), 'triangles'),
    );
    scene.add(pyramid);

    // 5. Grid Floor (Gray lines) — ground plane below the other objects.
    const gridFloor = new GameObject('grid-floor', 'Grid Floor');
    gridFloor.transform.setPosition(0, -2, 0);
    gridFloor.addComponent(
        new MeshRenderer(Mesh.createGrid('grid', 16, 16), new Material('gray', { r: 0.3, g: 0.3, b: 0.3, a: 1 }), 'lines'),
    );
    scene.add(gridFloor);

    // Keep the legacy camera exactly as before.
    scene.camera.setPosition([0, 2, -12]);
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
        (window as any).pyramidScene = scene;
        (window as any).pyramidRenderer = engine.getRenderer();

        (window as any).renderPyramidScene = () => {
            console.log('🔺 Re-rendering pyramid scene with WASM...');
            scene.render();
            console.log('✅ Pyramid render complete');
        };

        (window as any).debugPyramidScene = () => {
            console.log('🔍 Pyramid Scene Debug Info:');
            console.log('WASM Stats:', scene.physicsBridge.getStats());
            const entities = scene.getAllGameObjects();
            console.log('Scene Entities:', entities.map((e) => ({
                name: e.name,
                meshId: e.getComponent(MeshRenderer)?.meshId,
                position: e.transform.position,
                scale: e.transform.scale,
                color: e.getComponent(MeshRenderer)?.color,
            })));
        };

        console.log('✅ pyramid scene running');
    } catch (error) {
        console.error('❌ pyramid scene failed:', error);
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            (errorDiv as HTMLElement).style.display = 'block';
        }
    }
}

main();
