// src/v2/test-zero-copy-physics.ts
// Test scene for validating zero-copy rendering with real physics entities

import { Scene } from '../../engine/scene-system';
import { GameObject } from '../../engine/gameobject';
import { MeshRenderer, RigidBody } from '../../engine/components';
import { WebGPURendererV2 } from '../../renderer/webgpu.renderer';
import { createCubeMesh, createTriangleMesh, createGridMesh, createSphereMesh } from '../../renderer/mesh-utils';

async function createTwoParallelEntityPhysicsScene(scene: Scene): Promise<Scene> {

    // Create static floor grid (no RigidBody = static)
    // Position grid slightly behind physics objects to avoid Z-fighting
    const floor = GameObject.createGrid('ZeroCopyFloor', { x: 0, y: -8, z: 0.1 });
    // Make the grid gray instead of bright yellow for better visibility
    const floorMeshRenderer = floor.getComponent(MeshRenderer);
    if (floorMeshRenderer) {
        floorMeshRenderer.color = { x: 0.3, y: 0.3, z: 0.3, w: 1.0 }; // Gray
    }
    scene.addGameObject(floor);

    // Create physics cube with RigidBody (should add to WASM and enable zero-copy)
    const physicsCube = new GameObject('physics-cube', 'ZeroCopyTest');
    physicsCube.transform.setPosition(-2, 2, 0);
    physicsCube.transform.setScale(2, 2, 2);

    const cubeMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 1, y: 0.5, z: 0, w: 1 }); // Orange
    physicsCube.addComponent(cubeMeshRenderer);

    // Add RigidBody - this should register with WASM physics and enable zero-copy rendering!
    const cubeRigidBody = new RigidBody(
        1.0,        // mass: 1kg
        true,       // useGravity: affected by gravity
        'box',      // colliderType: box collider
        { x: 2, y: 2, z: 2 } // colliderSize: 2x2x2 unit cube
    );
    // cubeRigidBody.isKinematic = true; // Uncomment to test kinematic behavior
    physicsCube.addComponent(cubeRigidBody);

    scene.addGameObject(physicsCube);

    // Add second physics entity to increase entity count
    const physicsSphere = new GameObject('physics-sphere', 'ZeroCopyTest2');
    physicsSphere.transform.setPosition(2, 3, 0);
    physicsSphere.transform.setScale(0.5, 0.5, 0.5); // Match physics radius of 0.5

    const sphereMeshRenderer = new MeshRenderer('sphere', 'default', 'triangles', { x: 0, y: 1, z: 1, w: 1 }); // Cyan
    physicsSphere.addComponent(sphereMeshRenderer);

    const sphereRigidBody = new RigidBody(
        0.5,        // mass: 0.5kg
        true,       // useGravity: true
        'sphere',   // colliderType: sphere collider
        { x: 1.0, y: 1.0, z: 1.0 } // colliderSize: 1 unit sphere
    );
    // sphereRigidBody.isKinematic = true;
    physicsSphere.addComponent(sphereRigidBody);

    scene.addGameObject(physicsSphere);
    return scene;
}

async function createTwoStackedBallsPhysicsScene(scene: Scene): Promise<Scene> {

    // Create static floor grid (no RigidBody = static)
    // Position grid slightly behind physics objects to avoid Z-fighting
    const floor = GameObject.createGrid('ZeroCopyFloor', { x: 0, y: -8, z: 0.1 });
    // Make the grid gray instead of bright yellow for better visibility
    const floorMeshRenderer = floor.getComponent(MeshRenderer);
    if (floorMeshRenderer) {
        floorMeshRenderer.color = { x: 0.3, y: 0.3, z: 0.3, w: 1.0 }; // Gray
    }
    scene.addGameObject(floor);

    // Create physics cube with RigidBody (should add to WASM and enable zero-copy)
    const sphere1 = new GameObject('sphere1', 'Sphere 1');
    sphere1.transform.setPosition(3, 4, 0);
    sphere1.transform.setScale(1, 1, 1); // Will match colliderSize below

    const sphereMeshRenderer1 = new MeshRenderer('sphere', 'default', 'triangles', { x: 1, y: 0.5, z: 0, w: 1 }); // Orange
    sphere1.addComponent(sphereMeshRenderer1);

    // Add RigidBody - this should register with WASM physics and enable zero-copy rendering!
    const sphereRigidBody1 = new RigidBody(
        1.0,        // mass: 1kg
        true,       // useGravity: affected by gravity
        'sphere',      // colliderType: box collider
        { x: 1, y: 1, z: 1 } // colliderSize: 2x2x2 unit cube
    );
    sphere1.addComponent(sphereRigidBody1);

    scene.addGameObject(sphere1);

    // Add second physics entity to increase entity count
    const sphere2 = new GameObject('sphere2', 'Sphere 2');
    sphere2.transform.setPosition(3, 7, 0);
    sphere2.transform.setScale(2, 2, 2); // Will match colliderSize below

    const sphereMeshRenderer2 = new MeshRenderer('sphere', 'default', 'triangles', { x: 0, y: 1, z: 1, w: 1 }); // Cyan
    sphere2.addComponent(sphereMeshRenderer2);

    const sphereRigidBody2 = new RigidBody(
        0.5,        // mass: 0.5kg
        true,       // useGravity: true
        'sphere',   // colliderType: sphere collider
        { x: 2.0, y: 2.0, z: 2.0 } // colliderSize: 2 unit radius sphere (matches transform scale)
    );
    sphere2.addComponent(sphereRigidBody2);

    scene.addGameObject(sphere2);
    return scene;
}

async function main() {
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

        // await createTwoParallelEntityPhysicsScene(scene);
        await createTwoStackedBallsPhysicsScene(scene);

        // Fix camera position for better viewing
        scene.camera.setPosition([0, 0, -15]); // floor is +/-8 on z axis
        scene.camera.lookAt([0, -4, 0]); // floor is at y = -8

        // await scene.init(renderer);
        scene.start();

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

        (window as any).logSceneInfo = () => {
            const info = scene.getSceneInfo();
            console.log('📊 Current Scene Info:', info);
        };

        // Animation loop control
        let isRunning = true;
        let animationId: number;
        let lastTime = performance.now();

        let oneshotRenderDone = false;
        const gameLoop = (currentTime: number) => {
            if (!isRunning) {
                return; // Paused
            }
            if (!oneshotRenderDone) {
                isRunning = false; // Stop after one render for testing
                oneshotRenderDone = true;
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
(window as any).createZeroCopyPhysicsScene = createTwoParallelEntityPhysicsScene;
(window as any).runZeroCopyPhysicsTest = main;

main();
