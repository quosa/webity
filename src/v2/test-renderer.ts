import { WebGPURendererV2 } from './webgpu.renderer';
import { Camera } from './camera';
import { createCubeMesh, createTriangleMesh, createGridMesh } from './mesh-utils';

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

    const camera = new Camera([0, 0, -10], [0, 0, 0]);
    const renderer = new WebGPURendererV2();
    await renderer.init(canvas);

    const aspect = canvas.width / canvas.height;
    const viewProjectionMatrix = camera.getViewProjectionMatrix(aspect);
    renderer.setViewProjectionMatrix(viewProjectionMatrix);

    // Register meshes
    renderer.registerMesh('triangle', createTriangleMesh());
    renderer.registerMesh('cube', createCubeMesh(2));
    renderer.registerMesh('floor', createGridMesh(20, 20));

    // Add entities based on testName
    if (testName === 'triangle') {
        renderer.addEntity({
            id: 'triangle1',
            meshId: 'triangle',
            transform: {
                position: [0, 0, 5],
                rotation: [0, 0, 0],
                scale: [3, 3, 3] // triangle mesh was downsized to 0.5 units from 1.5
            },
            color: [1, 0, 0, 1], // Red
            renderMode: 'triangles'
        });
    } else if (testName === 'cubes') {
        renderer.addEntity({
            id: 'cube1',
            meshId: 'cube',
            transform: {
                position: [-3, 0, 5],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
            },
            color: [0, 1, 0, 1], // Green
            renderMode: 'triangles'
        });
        renderer.addEntity({
            id: 'cube2',
            meshId: 'cube',
            transform: {
                position: [3, 0, 5],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
            },
            color: [0, 0, 1, 1], // Blue
            renderMode: 'triangles'
        });
    }

    // Always add the floor
    renderer.addEntity({
        id: 'floor',
        meshId: 'floor',
        transform: {
            position: [0, -2, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
        },
        color: [0.2, 0.8, 0.2, 1],
        renderMode: 'lines'
    });

    renderer.render();
};
