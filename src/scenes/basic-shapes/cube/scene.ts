// Basic cube scene — migrated to the scene-first engine API (A3).
// Build the Scene as pure data (Mesh/Material objects), then let the Engine mount + run it.

import { Engine } from '../../../engine/engine';
import { Scene } from '../../../engine/scene-system';
import { GameObject } from '../../../engine/gameobject';
import { MeshRenderer } from '../../../engine/components';
import { Mesh } from '../../../engine/mesh';
import { Material } from '../../../engine/material';
import { PerspectiveCamera } from '../../../engine/camera-object';

function buildScene(): Scene {
    const scene = new Scene();

    const camera = new PerspectiveCamera('main');
    camera.transform.setPosition(0, 2, -6);
    camera.lookAt(0, 0, -3);
    scene.setCamera(camera);

    const cube = new GameObject('cube', 'Cube');
    cube.transform.setPosition(0, 0, -3);
    cube.transform.setScale(1.5, 1.5, 1.5);
    cube.addComponent(new MeshRenderer(Mesh.createCube('cube', 1), new Material('blue', { r: 0, g: 0, b: 1, a: 1 })));
    scene.add(cube);

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

        (window as unknown as { engine: Engine; scene: Scene }).engine = engine;
        (window as unknown as { engine: Engine; scene: Scene }).scene = scene;

        // Debug buttons in index.html call these.
        (window as unknown as { renderCube: () => void }).renderCube = () => {
            engine.render();
            console.log('🔄 Re-rendered cube');
        };
        (window as unknown as { debugCube: () => void }).debugCube = () => {
            console.log('📊 WASM Stats:', engine.physicsBridge?.getStats());
            console.log('📦 Scene Entities:', scene.getAllGameObjects().map((e) => ({
                name: e.name,
                meshId: e.getComponent(MeshRenderer)?.meshId,
                position: e.transform.position,
                scale: e.transform.scale,
            })));
        };

        // Vite HMR: stop the old engine loop + release its GPU device before the reloaded
        // module starts a new one, else the leaked loop submits to a stale device every frame.
        (import.meta as unknown as { hot?: { dispose: (_cb: () => void) => void } }).hot?.dispose(() => {
            void engine.deinit();
        });

        console.log('✅ cube scene running');
    } catch (error) {
        console.error('❌ cube scene failed:', error);
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            (errorDiv as HTMLElement).style.display = 'block';
        }
    }
}

main();
