// Simple triangle scene — migrated to the scene-first engine API (A3).
// Build the Scene as pure data (Mesh/Material objects), then let the Engine mount + run it.

import { Engine } from '../../../engine/engine';
import { Scene } from '../../../engine/scene-system';
import { GameObject } from '../../../engine/gameobject';
import { MeshRenderer } from '../../../engine/components';
import { Mesh } from '../../../engine/mesh';
import { Material } from '../../../engine/material';

function buildScene(): Scene {
    const scene = new Scene();

    // Single red triangle in front of the camera.
    const triangle = new GameObject('wasm-triangle', 'WasmTriangle');
    triangle.transform.setPosition(0, 0, -2);
    triangle.transform.setScale(2, 2, 2);
    triangle.addComponent(
        new MeshRenderer(Mesh.createTriangle('triangle', 1), new Material('red', { r: 1, g: 0, b: 0, a: 1 }), 'triangles'),
    );
    scene.add(triangle);

    // Keep the legacy camera exactly as before.
    scene.camera.setPosition([0, 0, -5]);
    scene.camera.lookAt([0, 0, -2]);

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
        (window as any).triangleScene = scene;
        (window as any).testWasmTriangleRendering = main;

        // Debug helper wired to the "compareBuffers" button.
        (window as any).compareBuffers = () => {
            console.log('🔍 Buffer Comparison Debug:');
            const stats = scene.physicsBridge.getStats();
            console.log('WASM Stats:', stats);

            if (scene.physicsBridge.hasWasmModule()) {
                const wasmMemory = scene.physicsBridge.getWasmMemory();
                const transformsOffset = scene.physicsBridge.getEntityTransformsOffset();
                console.log('WASM Memory:', wasmMemory);
                console.log('Transforms Offset:', transformsOffset);

                if (wasmMemory && transformsOffset !== undefined) {
                    const entityCount = stats.entityCount;
                    const instanceData = new Float32Array(wasmMemory, transformsOffset, entityCount * 20);
                    console.log('WASM Instance Data (20 floats per entity):');
                    for (let i = 0; i < entityCount; i++) {
                        const offset = i * 20;
                        console.log(`Entity ${i}:`);
                        console.log('  Transform Matrix:', Array.from(instanceData.slice(offset, offset + 16)));
                        console.log('  Color:', Array.from(instanceData.slice(offset + 16, offset + 20)));
                    }
                }
            }
        };

        console.log('✅ triangle scene running');
    } catch (error) {
        console.error('❌ triangle scene failed:', error);
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            (errorDiv as HTMLElement).style.display = 'block';
        }
    }
}

main();
