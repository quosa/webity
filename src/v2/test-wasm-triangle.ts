// src/v2/test-wasm-triangle.ts
// Simple triangle scene with WASM flow - single render call, no game loop

import { Scene } from './scene-system';
import { GameObject } from './gameobject';
import { MeshRenderer } from './components';
import { WebGPURendererV2 } from './webgpu.renderer';
import { createTriangleMesh } from './mesh-utils';

async function createSimpleTriangleScene(): Promise<Scene> {
    const scene = new Scene();
    
    console.log('🔺 Creating Simple Triangle WASM Scene...');
    
    // Create a single triangle GameObject
    const triangle = new GameObject('wasm-triangle', 'WasmTriangle');
    triangle.transform.setPosition(0, 0, -2); // Position in front of camera
    triangle.transform.setScale(2, 2, 2); // Make it larger and visible
    
    // Add MeshRenderer with triangle mesh and red color
    const meshRenderer = new MeshRenderer('triangle', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 }); // Red
    triangle.addComponent(meshRenderer);
    
    // Add to scene (this should push to WASM)
    scene.addGameObject(triangle);
    console.log('🔺 Added triangle GameObject to WASM');
    
    console.log(`✅ Simple triangle scene created with ${scene.getEntityCount()} GameObjects`);
    return scene;
}

async function testWasmTriangleRendering() {
    console.log('🔺 Testing WASM Triangle Rendering (Single Call)...');
    const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
    
    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }
        
        // Initialize renderer
        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);
        
        // Register triangle mesh only
        renderer.registerMesh('triangle', createTriangleMesh());
        
        // Create simple triangle scene
        const scene = await createSimpleTriangleScene();
        
        // Position camera to see the triangle
        scene.camera.setPosition([0, 0, -5]); // Further back
        scene.camera.lookAt([0, 0, -2]);      // Look at triangle
        
        // Initialize scene (this registers with WASM)
        await scene.init(renderer);
        scene.start();
        
        console.log('📊 Scene initialized. WASM Stats:', scene.physicsBridge.getStats());
        
        // SINGLE RENDER CALL - no game loop
        console.log('🎯 Performing SINGLE render call with WASM...');
        scene.renderZeroCopy(); // Direct call to WASM rendering
        
        console.log('✅ Single WASM triangle render complete');
        
        // Export for debugging and rendering mode toggle
        (window as any).triangleScene = scene;
        (window as any).triangleRenderer = renderer;
        
        // Rendering mode toggle functions
        (window as any).renderWithTypeScript = () => {
            console.log('🟦 Rendering with TypeScript → WebGPU (legacy path)...');
            scene.render(); // Legacy TypeScript rendering
            console.log('✅ TypeScript rendering complete');
        };
        
        (window as any).renderWithWasm = () => {
            console.log('🟥 Rendering with TypeScript → WASM → WebGPU (zero-copy path)...');
            scene.renderZeroCopy(); // WASM zero-copy rendering
            console.log('✅ WASM zero-copy rendering complete');
        };
        
        // Automated bug reproduction test
        (window as any).reproduceOrbitBug = () => {
            console.log('🐛 Reproducing orbit camera bug...');
            console.log('Step 1: Let physics run for 5 seconds...');
            
            // Start physics simulation for 5 seconds
            let timeElapsed = 0;
            const physicsInterval = setInterval(() => {
                scene.update(1/60); // 60fps physics updates
                timeElapsed += 1/60;
                
                if (timeElapsed >= 5) {
                    clearInterval(physicsInterval);
                    console.log('Step 2: Performing 3 orbit left operations...');
                    
                    // Perform 3 orbit left operations
                    for (let i = 0; i < 3; i++) {
                        setTimeout(() => {
                            console.log(`Orbit left ${i + 1}/3`);
                            scene.camera.orbitAroundTarget(15, 0); // 15 degrees left
                            scene.renderZeroCopy(); // Force render to see artifacts
                        }, i * 500); // 500ms between each orbit
                    }
                    
                    console.log('🔍 Bug reproduction test complete - check for dark triangle artifacts');
                }
            }, 16); // ~60fps
        };
        
        // Debug function to compare buffers
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
                    // Read WASM instance data (20 floats per instance)
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
        
    } catch (error) {
        console.error('❌ Error in WASM triangle test:', error);
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            errorDiv.style.display = 'block';
        }
    }
}

// Export and run
(window as any).testWasmTriangleRendering = testWasmTriangleRendering;
testWasmTriangleRendering();