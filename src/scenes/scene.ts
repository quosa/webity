// src/v2/simple-static-scene.ts
// Simple static scene test using GameObject/Scene system (no physics)
// This validates the v2 architecture with basic rendering

import { Scene } from '../engine/scene-system';
import { GameObject } from '../engine/gameobject';
import { MeshRenderer } from '../engine/components';
import { WebGPURendererV2 } from '../renderer/webgpu.renderer';
import { createCubeMesh, createTriangleMesh, createGridMesh } from '../renderer/mesh-utils';

async function createSimpleStaticScene(scene: Scene): Promise<Scene> {

    console.log('🎨 Creating Simple Static Scene (GameObject/Scene validation)...');

    // Create static floor grid (no RigidBody = static)
    const floor = GameObject.createGrid('StaticFloor', { x: 0, y: -2, z: 0 });
    scene.addGameObject(floor);
    console.log('📐 Added static floor grid');

    // Create red triangle (center, front)
    const triangle = new GameObject('center-triangle', 'StaticTriangle');
    triangle.transform.setPosition(0, 0, -5);
    triangle.transform.setScale(2, 2, 2);

    const triangleMeshRenderer = new MeshRenderer('triangle', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 }); // Red
    triangle.addComponent(triangleMeshRenderer);

    scene.addGameObject(triangle);
    console.log('🔺 Added red triangle (center, front)');

    // Create green cube (left side)
    const leftCube = new GameObject('left-cube', 'StaticCube');
    leftCube.transform.setPosition(-2, 0, -5);
    leftCube.transform.setScale(1, 1, 1);

    const leftMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 1, z: 0, w: 1 }); // Green
    leftCube.addComponent(leftMeshRenderer);

    scene.addGameObject(leftCube);
    console.log('📦 Added green cube (left)');

    // Create blue cube (right side)
    const rightCube = new GameObject('right-cube', 'StaticCube');
    rightCube.transform.setPosition(2, 0, -5);
    rightCube.transform.setScale(1, 1, 1);

    const rightMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 0, z: 1, w: 1 }); // Blue
    rightCube.addComponent(rightMeshRenderer);

    scene.addGameObject(rightCube);
    console.log('📦 Added blue cube (right)');

    console.log(`✅ Simple static scene created with ${scene.getEntityCount()} GameObjects`);
    return scene;
}

async function main() {
    console.log('🚀 Simple Static Scene Test starting...');
    const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;

    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        // Initialize renderer
        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);

        // Register all required meshes
        renderer.registerMesh('triangle', createTriangleMesh());
        renderer.registerMesh('cube', createCubeMesh(1));
        renderer.registerMesh('grid', createGridMesh(20, 20));

        // Create simple static scene

        const scene = new Scene();
        await scene.init(renderer);

        await createSimpleStaticScene(scene);

        scene.start();

        // Fix camera position - bring it down to normal viewing angle
        scene.camera.setPosition([0, 0, -10]); // Eye level, not elevated
        scene.camera.lookAt([0, 0, 0]); // Look at center


        // Export scene to window for browser testing
        (window as any).scene = scene;
        (window as any).staticScene = scene;

        console.log('✅ Simple static scene initialized successfully');

        // Log scene info
        const sceneInfo = scene.getSceneInfo();
        console.log('📊 Scene Info:', sceneInfo);

        // Single static render (no animation loop needed)
        scene.update(0); // deltaTime = 0 for static scene

        console.log('🎯 Static scene rendered successfully');

        // Test helper functions for browser console
        (window as any).renderStaticScene = () => {
            scene.update(0);
            console.log('🔄 Re-rendered static scene');
        };

        (window as any).logSceneInfo = () => {
            const info = scene.getSceneInfo();
            console.log('📊 Current Scene Info:', info);
        };

        (window as any).logWasmInfo = () => {
            const stats = scene.physicsBridge.getStats();
            console.log('📊 WASM Stats:', stats);
        };

    } catch (error) {
        console.error('❌ Error in simple static scene test:', error);
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            errorDiv.style.display = 'block';
        }
    }
}

// Export for browser testing
(window as any).createSimpleStaticScene = createSimpleStaticScene;
(window as any).runSimpleStaticSceneTest = main;

main();
