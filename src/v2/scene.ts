import { WebGPURendererV2 } from './webgpu.renderer';
import { Camera } from './camera';
import { createCubeMesh, createTriangleMesh, createGridMesh } from './mesh-utils';

async function main() {
    console.log('🚀 Scene script starting...');
    const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
    console.log('Canvas element:', canvas);

    try {
        // Check WebGPU support
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        // Create camera
        const camera = new Camera([0, 0, -10], [0, 0, 0]);

        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);

        // Set view-projection matrix once (calculated by camera)
        const aspect = canvas.width / canvas.height;
        const viewProjectionMatrix = camera.getViewProjectionMatrix(aspect);
        renderer.setViewProjectionMatrix(viewProjectionMatrix);

        // Register triangle mesh
        const triangleMesh = createTriangleMesh();
        renderer.registerMesh('triangle', triangleMesh);

        // Register cube mesh
        const cubeMesh = createCubeMesh(1);
        renderer.registerMesh('cube', cubeMesh);

        // Register a grid mesh for the floor
        const gridMesh = createGridMesh(20, 20);
        renderer.registerMesh('floor', gridMesh);

        renderer.addEntity({
            id: 'cube1',
            meshId: 'cube',
            transform: {
                position: [-2, 0, -5],
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
                position: [2, 0, -5],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
            },
            color: [0, 0, 1, 1], // Blue
            renderMode: 'triangles'
        });

        // Add triangle in front
        renderer.addEntity({
            id: 'center-triangle',
            meshId: 'triangle',
            transform: {
                position: [0, 0, -5], // In front of cubes, same height level
                rotation: [0, 0, 0],
                scale: [2, 2, 2]
            },
            color: [1, 0, 0, 1], // Red
            renderMode: 'triangles'
        });

        renderer.addEntity({
            id: 'floor',
            meshId: 'floor',
            transform: {
                position: [0, -2, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
            },
            color: [1, 1, 0, 1], // Yellow grid lines
            renderMode: 'lines'
        });

        // Render static scene
        renderer.render();
        console.log('🎥 Static render complete 🏆');
    } catch (error) {
        console.error('❌ Error initializing WebGPU renderer:', error);
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            errorDiv.style.display = 'block';
        }
    }
}

main();
