// src/v2/test-wasm-mixed.ts
// Mixed scene with triangle, cube, and sphere - testing multiple mesh types through WASM

import { Scene } from './scene-system';
import { GameObject } from './gameobject';
import { MeshRenderer } from './components';
import { WebGPURendererV2 } from './webgpu.renderer';
import { createTriangleMesh, createCubeMesh, createSphereMesh } from './mesh-utils';

async function createMixedScene(): Promise<Scene> {
    const scene = new Scene();
    
    console.log('🎭 Creating Mixed Scene (Triangle + Cube + Sphere)...');
    
    // 1. Triangle (Red) - Far left
    const triangle = new GameObject('triangle-entity', 'Triangle');
    triangle.transform.setPosition(-4, 0, 0);
    triangle.transform.setScale(1, 1, 1);
    
    const triangleMeshRenderer = new MeshRenderer('triangle', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 }); // Red
    triangle.addComponent(triangleMeshRenderer);
    scene.addGameObject(triangle);
    console.log('🔺 Added red triangle at (-4, 0, 0)');
    
    // 2. Cube (Blue) - Center 
    const cube = new GameObject('cube-entity', 'Cube');
    cube.transform.setPosition(0, 0, 0);
    cube.transform.setScale(1, 1, 1);
    
    const cubeMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 0, z: 1, w: 1 }); // Blue
    cube.addComponent(cubeMeshRenderer);
    scene.addGameObject(cube);
    console.log('🧊 Added blue cube at (0, 0, 0)');
    
    // 3. Sphere (Green) - Far right
    const sphere = new GameObject('sphere-entity', 'Sphere');
    sphere.transform.setPosition(4, 0, 0);
    sphere.transform.setScale(1, 1, 1);
    
    const sphereMeshRenderer = new MeshRenderer('sphere', 'default', 'triangles', { x: 0, y: 1, z: 0, w: 1 }); // Green
    sphere.addComponent(sphereMeshRenderer);
    scene.addGameObject(sphere);
    console.log('🟢 Added green sphere at (4, 0, 0)');
    
    console.log(`✅ Mixed scene created with ${scene.getEntityCount()} triangle entities (all rendered as triangles)`);
    return scene;
}

async function testWasmMixedRendering() {
    console.log('🎭 Testing WASM Mixed Scene Rendering...');
    const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
    
    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }
        
        // Initialize renderer
        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);
        
        // Register ALL three mesh types
        renderer.registerMesh('triangle', createTriangleMesh());
        renderer.registerMesh('cube', createCubeMesh(1));
        renderer.registerMesh('sphere', createSphereMesh(1.0, 16)); // 16 subdivisions for smooth sphere
        console.log('📦 Registered triangle, cube, and sphere meshes');
        
        // Create mixed scene
        const scene = await createMixedScene();
        
        // Position camera behind entities looking forward (your preferred coordinate system)
        scene.camera.setPosition([0, 0, -10]); // Camera behind entities
        scene.camera.lookAt([0, 0, 0]);        // Look at origin where entities are
        
        // Initialize scene (this registers with WASM)
        await scene.init(renderer);
        scene.start();
        
        console.log('📊 Scene initialized. WASM Stats:', scene.physicsBridge.getStats());
        
        // SINGLE RENDER CALL
        console.log('🎯 Performing SINGLE render call with mixed shapes...');
        scene.renderZeroCopy(); // Direct call to WASM rendering
        
        console.log('✅ Mixed scene render complete');
        
        // Export for debugging
        (window as any).mixedScene = scene;
        (window as any).mixedRenderer = renderer;
        
        // Render function
        (window as any).renderMixed = () => {
            console.log('🎭 Re-rendering mixed scene with WASM...');
            scene.renderZeroCopy();
            console.log('✅ Mixed render complete');
        };
        
        // Debug function
        (window as any).debugMixed = () => {
            console.log('🔍 Mixed Scene Debug Info:');
            const stats = scene.physicsBridge.getStats();
            console.log('WASM Stats:', stats);
            
            // Check each mesh allocation
            console.log('Mesh Allocations:');
            console.log('  Triangle:', renderer['bufferManager']?.getMeshAllocation('triangle'));
            console.log('  Cube:', renderer['bufferManager']?.getMeshAllocation('cube')); 
            console.log('  Sphere:', renderer['bufferManager']?.getMeshAllocation('sphere'));
            
            // Check scene entities
            const entities = scene.getAllGameObjects();
            console.log('Scene Entities:', entities.map(e => ({
                name: e.name,
                meshId: e.getMeshRenderer()?.meshId,
                position: e.transform.position,
                scale: e.transform.scale,
                color: e.getMeshRenderer()?.color
            })));
            
            // NEW: Check WASM buffer data directly
            if (scene.physicsBridge.hasWasmModule()) {
                const wasmMemory = scene.physicsBridge.getWasmMemory();
                const transformsOffset = scene.physicsBridge.getEntityTransformsOffset();
                console.log('WASM Memory Buffer:', wasmMemory);
                console.log('Transforms Offset:', transformsOffset);
                
                if (wasmMemory && transformsOffset !== undefined) {
                    // Read WASM instance data (20 floats per instance)
                    const entityCount = stats.entityCount;
                    const instanceData = new Float32Array(wasmMemory, transformsOffset, entityCount * 20);
                    console.log('WASM Instance Data (20 floats per entity):');
                    for (let i = 0; i < entityCount; i++) {
                        const offset = i * 20;
                        const transform = Array.from(instanceData.slice(offset, offset + 16));
                        const color = Array.from(instanceData.slice(offset + 16, offset + 20));
                        console.log(`Entity ${i}:`);
                        console.log('  Transform Matrix:', transform);
                        console.log('  Color:', color);
                        console.log(`  Position from matrix: [${transform[12]}, ${transform[13]}, ${transform[14]}]`);
                    }
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Error in WASM mixed test:', error);
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            errorDiv.style.display = 'block';
        }
    }
}

// Export and run
(window as any).testWasmMixedRendering = testWasmMixedRendering;
testWasmMixedRendering();