// src/v2/test-wasm-cube.ts
// Simple cube scene with WASM flow - build basic functionality from scratch

import { Scene } from './scene-system';
import { GameObject } from './gameobject';
import { MeshRenderer } from './components';
import { WebGPURendererV2 } from './webgpu.renderer';
import { createCubeMesh } from './mesh-utils';

async function createSimpleCubeScene(): Promise<Scene> {
    const scene = new Scene();
    
    console.log('🧊 Creating Simple Cube WASM Scene...');
    
    // Create a single cube GameObject
    const cube = new GameObject('wasm-cube', 'WasmCube');
    cube.transform.setPosition(0, 0, -3); // Position in front of camera
    cube.transform.setScale(1.5, 1.5, 1.5); // Make it visible
    
    // Add MeshRenderer with cube mesh and blue color
    const meshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 0, z: 1, w: 1 }); // Blue
    cube.addComponent(meshRenderer);
    
    // Add to scene (this should push to WASM)
    scene.addGameObject(cube);
    console.log('🧊 Added cube GameObject to WASM');
    
    console.log(`✅ Simple cube scene created with ${scene.getEntityCount()} GameObjects`);
    return scene;
}

async function testWasmCubeRendering() {
    console.log('🧊 Testing WASM Cube Rendering (Single Call)...');
    const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
    
    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }
        
        // Initialize renderer
        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);
        
        // Register ONLY cube mesh 
        renderer.registerMesh('cube', createCubeMesh(1));
        console.log('📦 Registered cube mesh only');
        
        // Create simple cube scene
        const scene = await createSimpleCubeScene();
        
        // Position camera to see the cube
        scene.camera.setPosition([0, 2, -6]); // Higher and further back
        scene.camera.lookAt([0, 0, -3]);      // Look at cube
        
        // Initialize scene (this registers with WASM)
        await scene.init(renderer);
        scene.start();
        
        console.log('📊 Scene initialized. WASM Stats:', scene.physicsBridge.getStats());
        
        // SINGLE RENDER CALL - no game loop  
        console.log('🎯 Performing SINGLE render call with WASM...');
        scene.renderZeroCopy(); // Direct call to WASM rendering
        
        console.log('✅ Single WASM cube render complete');
        
        // Export for debugging
        (window as any).cubeScene = scene;
        (window as any).cubeRenderer = renderer;
        
        // Simple render function
        (window as any).renderCube = () => {
            console.log('🧊 Re-rendering cube with WASM...');
            scene.renderZeroCopy();
            console.log('✅ Cube render complete');
        };
        
        // Debug function
        (window as any).debugCube = () => {
            console.log('🔍 Cube Debug Info:');
            const stats = scene.physicsBridge.getStats();
            console.log('WASM Stats:', stats);
            
            // Check mesh allocation
            const allocation = renderer['bufferManager']?.getMeshAllocation('cube');
            console.log('Cube Mesh Allocation:', allocation);
            
            // Check scene entities
            const entities = scene.getAllGameObjects();
            console.log('Scene Entities:', entities.map(e => ({
                name: e.name,
                meshId: e.getMeshRenderer()?.meshId,
                position: e.transform.position,
                scale: e.transform.scale
            })));
        };
        
    } catch (error) {
        console.error('❌ Error in WASM cube test:', error);
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            errorDiv.style.display = 'block';
        }
    }
}

// Export and run
(window as any).testWasmCubeRendering = testWasmCubeRendering;
testWasmCubeRendering();