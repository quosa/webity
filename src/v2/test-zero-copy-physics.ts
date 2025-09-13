// src/v2/test-zero-copy-physics.ts
// Test scene for validating zero-copy rendering with real physics entities

import { Scene } from './scene-system';
import { GameObject } from './gameobject';
import { MeshRenderer, RigidBody } from './components';
import { WebGPURendererV2 } from './webgpu.renderer';
import { createCubeMesh, createTriangleMesh, createGridMesh, createSphereMesh } from './mesh-utils';

async function createZeroCopyPhysicsScene(scene: Scene): Promise<Scene> {

    console.log('🚀 Creating Zero-Copy Physics Test Scene (Phase 6 Task 3)...');

    // Create static floor grid (no RigidBody = static)
    const floor = GameObject.createGrid('ZeroCopyFloor', { x: 0, y: -2, z: 0 });
    scene.addGameObject(floor);
    console.log('📐 Added static floor grid');

    // Create physics cube with RigidBody (should add to WASM and enable zero-copy)
    const physicsCube = new GameObject('physics-cube', 'ZeroCopyTest');
    physicsCube.transform.setPosition(0, 2, -5);
    physicsCube.transform.setScale(1, 1, 1);

    const cubeMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 1, y: 0.5, z: 0, w: 1 }); // Orange
    physicsCube.addComponent(cubeMeshRenderer);

    // Add RigidBody - this should register with WASM physics and enable zero-copy rendering!
    const cubeRigidBody = new RigidBody(
        1.0,        // mass: 1kg
        true,       // useGravity: affected by gravity
        'box',      // colliderType: box collider
        { x: 1, y: 1, z: 1 } // colliderSize: 1x1x1 unit cube
    );
    physicsCube.addComponent(cubeRigidBody);

    scene.addGameObject(physicsCube);
    console.log('📦 Added physics cube with RigidBody (should enable zero-copy rendering)');

    // Add second physics entity to increase entity count
    const physicsSphere = new GameObject('physics-sphere', 'ZeroCopyTest2');
    physicsSphere.transform.setPosition(2, 3, -5);

    const sphereMeshRenderer = new MeshRenderer('sphere', 'default', 'triangles', { x: 0, y: 1, z: 1, w: 1 }); // Cyan
    physicsSphere.addComponent(sphereMeshRenderer);

    const sphereRigidBody = new RigidBody(
        0.5,        // mass: 0.5kg
        true,       // useGravity: true
        'sphere',   // colliderType: sphere collider
        { x: 0.5, y: 0.5, z: 0.5 }
    );
    physicsSphere.addComponent(sphereRigidBody);

    scene.addGameObject(physicsSphere);
    console.log('🌐 Added physics sphere with RigidBody');

    console.log(`✅ Zero-copy physics scene created with ${scene.getEntityCount()} GameObjects`);
    return scene;
}


async function main() {
    console.log('🚀 Zero-Copy Physics Rendering Test starting (Phase 6 Task 3)...');
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
        renderer.registerMesh('sphere', createSphereMesh(1.0, 16));
        renderer.registerMesh('grid', createGridMesh(20, 20));

        // Create zero-copy physics test scene
        const scene = new Scene();
        await scene.init(renderer);

        await createZeroCopyPhysicsScene(scene);

        // Fix camera position for better viewing
        scene.camera.setPosition([0, 2, -8]);
        scene.camera.lookAt([0, 0, -5]);

        // await scene.init(renderer);
        scene.start();

        // Export scene to window for browser testing
        (window as any).scene = scene;
        (window as any).zeroCopyScene = scene;

        console.log('✅ Zero-copy physics scene initialized successfully');

        // Log scene and physics stats
        const sceneInfo = scene.getSceneInfo();
        console.log('📊 Scene Info:', sceneInfo);

        // Test zero-copy rendering validation
        (window as any).testZeroCopyRendering = () => {
            console.log('🧪 Testing Zero-Copy Rendering Pipeline...');
            const stats = scene.physicsBridge.getStats();
            console.log('📊 Physics Stats:', stats);

            if (stats.entityCount > 0) {
                console.log(`✅ Entity count: ${stats.entityCount} - Zero-copy rendering should be active!`);
            } else {
                console.log('⚠️ Entity count is 0 - Zero-copy rendering will fallback to TypeScript');
            }

            console.log('🎯 Testing render() method...');
            scene.render(); // Force call to test zero-copy path
        };

        // Test WASM buffer access
        (window as any).testWasmBuffers = () => {
            console.log('🧪 Testing WASM Buffer Access...');

            if (scene.physicsBridge.hasWasmModule()) {
                const wasmMemory = scene.physicsBridge.getWasmMemory();
                const transformsOffset = scene.physicsBridge.getEntityTransformsOffset();

                console.log('📦 WASM Memory Buffer:', wasmMemory);
                console.log('🎯 Transforms Offset:', transformsOffset);

                if (wasmMemory && transformsOffset !== undefined) {
                    console.log('✅ Zero-copy buffer access ready!');

                    // Read actual transform data from WASM memory
                    const entityCount = scene.physicsBridge.getStats().entityCount;
                    console.log(`📊 Entity count: ${entityCount}`);

                    if (entityCount > 0) {
                        const transformData = new Float32Array(wasmMemory, transformsOffset, entityCount * 16);
                        console.log('🔍 First entity transform matrix:');
                        for (let i = 0; i < 16; i += 4) {
                            console.log(`   [${transformData[i]?.toFixed(2) ?? 'N/A'}, ${transformData[i+1]?.toFixed(2) ?? 'N/A'}, ${transformData[i+2]?.toFixed(2) ?? 'N/A'}, ${transformData[i+3]?.toFixed(2) ?? 'N/A'}]`);
                        }

                        if (entityCount > 1) {
                            console.log('🔍 Second entity transform matrix:');
                            const offset = 16;
                            for (let i = 0; i < 16; i += 4) {
                                console.log(`   [${transformData[offset+i]?.toFixed(2) ?? 'N/A'}, ${transformData[offset+i+1]?.toFixed(2) ?? 'N/A'}, ${transformData[offset+i+2]?.toFixed(2) ?? 'N/A'}, ${transformData[offset+i+3]?.toFixed(2) ?? 'N/A'}]`);
                            }
                        }
                    }
                } else {
                    console.log('❌ Zero-copy buffer access not available');
                }
            } else {
                console.log('❌ No WASM module available');
            }
        };

        // Animation loop control
        let isRunning = true;
        let animationId: number;
        let lastTime = performance.now();

        const gameLoop = (currentTime: number) => {
            if (!isRunning) {
                return; // Paused
            }

            const rawDeltaTime = (currentTime - lastTime) / 1000;
            const deltaTime = Math.min(rawDeltaTime, 1/30);
            lastTime = currentTime;

            // Update scene (this should use zero-copy rendering if WASM entities exist)
            scene.update(deltaTime);

            animationId = requestAnimationFrame(gameLoop);
        };

        // Engine control functions
        (window as any).pauseEngine = () => {
            console.log('⏸️ Engine paused');
            isRunning = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };

        (window as any).resumeEngine = () => {
            console.log('▶️ Engine resumed');
            if (!isRunning) {
                isRunning = true;
                lastTime = performance.now(); // Reset time to avoid large delta
                animationId = requestAnimationFrame(gameLoop);
            }
        };

        // Start the game loop
        animationId = requestAnimationFrame(gameLoop);

    } catch (error) {
        console.error('❌ Error in zero-copy physics test:', error);
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            errorDiv.style.display = 'block';
        }
    }
}

// Export for browser testing
(window as any).createZeroCopyPhysicsScene = createZeroCopyPhysicsScene;
(window as any).runZeroCopyPhysicsTest = main;

main();
