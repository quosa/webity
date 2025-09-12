// src/v2/test-pyramid-scene.ts
// Test scene with triangle, cube, sphere, and pyramid - validating 4 different mesh types

import { Scene } from './scene-system';
import { GameObject } from './gameobject';
import { MeshRenderer } from './components';
import { WebGPURendererV2 } from './webgpu.renderer';
import { createTriangleMesh, createCubeMesh, createSphereMesh, createPyramidMesh, createGridMesh } from './mesh-utils';

async function createPyramidTestScene(): Promise<Scene> {
    const scene = new Scene();
    
    console.log('🔺 Creating Pyramid Test Scene (Triangle + Cube + Sphere + Pyramid)...');
    
    // 1. Triangle (Red) - Far left
    const triangle = new GameObject('triangle-entity', 'Triangle');
    triangle.transform.setPosition(-6, 0, 0);
    triangle.transform.setScale(1, 1, 1);
    
    const triangleMeshRenderer = new MeshRenderer('triangle', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 }); // Red
    triangle.addComponent(triangleMeshRenderer);
    scene.addGameObject(triangle);
    console.log('🔺 Added red triangle at (-6, 0, 0)');
    
    // 2. Cube (Blue) - Center left
    const cube = new GameObject('cube-entity', 'Cube');
    cube.transform.setPosition(-2, 0, 0);
    cube.transform.setScale(1, 1, 1);
    
    const cubeMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 0, z: 1, w: 1 }); // Blue
    cube.addComponent(cubeMeshRenderer);
    scene.addGameObject(cube);
    console.log('🧊 Added blue cube at (-2, 0, 0)');
    
    // 3. Sphere (Green) - Center right
    const sphere = new GameObject('sphere-entity', 'Sphere');
    sphere.transform.setPosition(2, 0, 0);
    sphere.transform.setScale(1, 1, 1);
    
    const sphereMeshRenderer = new MeshRenderer('sphere', 'default', 'triangles', { x: 0, y: 1, z: 0, w: 1 }); // Green
    sphere.addComponent(sphereMeshRenderer);
    scene.addGameObject(sphere);
    console.log('🟢 Added green sphere at (2, 0, 0)');
    
    // 4. Pyramid (Purple) - Far right
    const pyramid = new GameObject('pyramid-entity', 'Pyramid');
    pyramid.transform.setPosition(6, 0, 0);
    pyramid.transform.setScale(1, 1, 1);
    
    const pyramidMeshRenderer = new MeshRenderer('pyramid', 'default', 'triangles', { x: 1, y: 0, z: 1, w: 1 }); // Purple
    pyramid.addComponent(pyramidMeshRenderer);
    scene.addGameObject(pyramid);
    console.log('🔺 Added purple pyramid at (6, 0, 0)');
    
    // 5. Grid Floor (Gray lines) - Ground plane
    const gridFloor = new GameObject('grid-floor', 'Grid Floor');
    gridFloor.transform.setPosition(0, -2, 0); // Below other objects
    gridFloor.transform.setScale(1, 1, 1);
    
    const gridMeshRenderer = new MeshRenderer('grid', 'default', 'lines', { x: 0.3, y: 0.3, z: 0.3, w: 1 }); // Gray
    gridFloor.addComponent(gridMeshRenderer);
    scene.addGameObject(gridFloor);
    console.log('⬜ Added gray grid floor at (0, -2, 0)');
    
    console.log(`✅ Pyramid test scene created with ${scene.getEntityCount()} entities (4 triangle meshes + 1 line mesh)`);
    return scene;
}

async function testPyramidSceneRendering() {
    console.log('🔺 Testing Pyramid Scene Rendering...');
    const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
    
    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }
        
        // Initialize renderer
        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);
        
        // Register ALL four mesh types
        renderer.registerMesh('triangle', createTriangleMesh());
        renderer.registerMesh('cube', createCubeMesh(1));
        renderer.registerMesh('sphere', createSphereMesh(1.0, 16));
        renderer.registerMesh('pyramid', createPyramidMesh(1, 1.5)); // Taller pyramid for visibility
        renderer.registerMesh('grid', createGridMesh(16, 16)); // 16x16 grid floor
        console.log('📦 Registered triangle, cube, sphere, pyramid, and grid meshes');
        
        // Create pyramid test scene
        const scene = await createPyramidTestScene();
        
        // Position camera behind entities looking forward
        scene.camera.setPosition([0, 2, -12]); // Further back to see all 4 shapes
        scene.camera.lookAt([0, 0, 0]);        // Look at origin where entities are
        
        // Initialize scene (this registers with WASM)
        await scene.init(renderer);
        scene.start();
        
        console.log('📊 Scene initialized. WASM Stats:', scene.physicsBridge.getStats());
        
        // SINGLE RENDER CALL
        console.log('🎯 Performing SINGLE render call with 4 different shapes...');
        scene.renderZeroCopy(); // Direct call to WASM rendering
        
        console.log('✅ Pyramid test scene render complete');
        
        // Export for debugging
        (window as any).pyramidScene = scene;
        (window as any).pyramidRenderer = renderer;
        
        // Render function
        (window as any).renderPyramidScene = () => {
            console.log('🔺 Re-rendering pyramid scene with WASM...');
            scene.renderZeroCopy();
            console.log('✅ Pyramid render complete');
        };
        
        // Debug function
        (window as any).debugPyramidScene = () => {
            console.log('🔍 Pyramid Scene Debug Info:');
            const stats = scene.physicsBridge.getStats();
            console.log('WASM Stats:', stats);
            
            // Check each mesh allocation
            console.log('Mesh Allocations:');
            console.log('  Triangle:', renderer['bufferManager']?.getMeshAllocation('triangle'));
            console.log('  Cube:', renderer['bufferManager']?.getMeshAllocation('cube')); 
            console.log('  Sphere:', renderer['bufferManager']?.getMeshAllocation('sphere'));
            console.log('  Pyramid:', renderer['bufferManager']?.getMeshAllocation('pyramid'));
            
            // Check scene entities
            const entities = scene.getAllGameObjects();
            console.log('Scene Entities:', entities.map(e => ({
                name: e.name,
                meshId: e.getMeshRenderer()?.meshId,
                position: e.transform.position,
                scale: e.transform.scale,
                color: e.getMeshRenderer()?.color
            })));
        };
        
    } catch (error) {
        console.error('❌ Error in pyramid test:', error);
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            errorDiv.style.display = 'block';
        }
    }
}

// Export and run
(window as any).testPyramidSceneRendering = testPyramidSceneRendering;
testPyramidSceneRendering();