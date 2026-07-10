// src/scenes/physics/scene.ts
// Zero-copy physics test scene — migrated to the scene-first engine API (A3).
// buildScene() is PURE DATA (Mesh/Material objects); the Engine mounts + runs it.

import { Engine } from '../../engine/engine';
import { Scene } from '../../engine/scene-system';
import { GameObject } from '../../engine/gameobject';
import { MeshRenderer, RigidBody, CollisionShape } from '../../engine/components';
import { Mesh } from '../../engine/mesh';
import { Material } from '../../engine/material';

async function createTwoParallelEntityPhysicsScene(scene: Scene): Promise<Scene> {

    // Create static floor grid (no RigidBody = static)
    // Position grid slightly behind physics objects to avoid Z-fighting
    // Make the grid gray instead of bright yellow for better visibility
    const floor = new GameObject(undefined, 'ZeroCopyFloor');
    floor.transform.setPosition(0, -8, 0.1);
    floor.addComponent(
        new MeshRenderer(Mesh.createGrid('grid', 20, 20), new Material('gray', { r: 0.3, g: 0.3, b: 0.3, a: 1.0 }), 'lines'),
    );
    scene.addGameObject(floor);

    // Create physics cube with RigidBody (should add to WASM and enable zero-copy)
    const physicsCube = new GameObject('physics-cube', 'ZeroCopyTest');
    physicsCube.transform.setPosition(-2, 2, 0);
    physicsCube.transform.setScale(2, 2, 2);

    const cubeMeshRenderer = new MeshRenderer(Mesh.createCube('cube', 1), new Material('orange', { r: 1, g: 0.5, b: 0, a: 1 })); // Orange
    physicsCube.addComponent(cubeMeshRenderer);

    // Add RigidBody - this should register with WASM physics and enable zero-copy rendering!
    const cubeRigidBody = new RigidBody(
        1.0,        // mass: 1kg
        true,       // useGravity: affected by gravity
        CollisionShape.BOX,      // collisionShape: box collider
        { x: 2, y: 2, z: 2 } // extents: 2x2x2 unit cube
    );
    physicsCube.addComponent(cubeRigidBody);

    scene.addGameObject(physicsCube);

    // Add second physics entity to increase entity count
    const physicsSphere = new GameObject('physics-sphere', 'ZeroCopyTest2');
    physicsSphere.transform.setPosition(2, 3, 0);
    physicsSphere.transform.setScale(0.5, 0.5, 0.5); // Match physics radius of 0.5

    const sphereMeshRenderer = new MeshRenderer(Mesh.createSphere('sphere', 1.0, 16), new Material('cyan', { r: 0, g: 1, b: 1, a: 1 })); // Cyan
    physicsSphere.addComponent(sphereMeshRenderer);

    const sphereRigidBody = new RigidBody(
        0.5,        // mass: 0.5kg
        true,       // useGravity: true
        CollisionShape.SPHERE,   // collisionShape: sphere collider
        { x: 1.0, y: 1.0, z: 1.0 } // extents: 1 unit sphere
    );
    physicsSphere.addComponent(sphereRigidBody);

    scene.addGameObject(physicsSphere);
    return scene;
}

async function createTwoStackedBallsPhysicsScene(scene: Scene): Promise<Scene> {

    // Create static floor grid (no RigidBody = static)
    // Position grid slightly behind physics objects to avoid Z-fighting
    // Make the grid gray instead of bright yellow for better visibility
    const floor = new GameObject(undefined, 'ZeroCopyFloor');
    floor.transform.setPosition(0, -8, 0.1);
    floor.addComponent(
        new MeshRenderer(Mesh.createGrid('grid', 20, 20), new Material('gray', { r: 0.3, g: 0.3, b: 0.3, a: 1.0 }), 'lines'),
    );
    scene.addGameObject(floor);

    // Create physics cube with RigidBody (should add to WASM and enable zero-copy)
    const sphere1 = new GameObject('sphere1', 'Sphere 1');
    sphere1.transform.setPosition(3, 4, 0);
    sphere1.transform.setScale(1, 1, 1); // Will match colliderSize below

    const sphereMeshRenderer1 = new MeshRenderer(Mesh.createSphere('sphere', 1.0, 16), new Material('orange', { r: 1, g: 0.5, b: 0, a: 1 })); // Orange
    sphere1.addComponent(sphereMeshRenderer1);

    // Add RigidBody - this should register with WASM physics and enable zero-copy rendering!
    const sphereRigidBody1 = new RigidBody(
        1.0,        // mass: 1kg
        true,       // useGravity: affected by gravity
        CollisionShape.SPHERE,      // collisionShape: sphere collider
        { x: 1, y: 1, z: 1 } // extents: 1x1x1 unit sphere
    );
    sphere1.addComponent(sphereRigidBody1);

    scene.addGameObject(sphere1);

    // Add second physics entity to increase entity count
    const sphere2 = new GameObject('sphere2', 'Sphere 2');
    sphere2.transform.setPosition(3, 7, 0);
    sphere2.transform.setScale(2, 2, 2); // Will match colliderSize below

    const sphereMeshRenderer2 = new MeshRenderer(Mesh.createSphere('sphere', 1.0, 16), new Material('cyan', { r: 0, g: 1, b: 1, a: 1 })); // Cyan
    sphere2.addComponent(sphereMeshRenderer2);

    const sphereRigidBody2 = new RigidBody(
        0.5,        // mass: 0.5kg
        true,       // useGravity: true
        CollisionShape.SPHERE,   // collisionShape: sphere collider
        { x: 2.0, y: 2.0, z: 2.0 } // extents: 2 unit radius sphere (matches transform scale)
    );
    sphere2.addComponent(sphereRigidBody2);

    scene.addGameObject(sphere2);
    return scene;
}

async function buildScene(): Promise<Scene> {
    const scene = new Scene();

    // await createTwoParallelEntityPhysicsScene(scene);
    await createTwoStackedBallsPhysicsScene(scene);

    // Fix camera position for better viewing
    scene.camera.setPosition([0, 0, -15]); // floor is +/-8 on z axis
    scene.camera.lookAt([0, -4, 0]); // floor is at y = -8

    return scene;
}

async function main() {
    const errorDiv = document.getElementById('error-message');

    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        const engine = new Engine('webgpu-canvas');
        await engine.init();               // WebGPU + WASM
        const scene = await buildScene();  // pure data
        await engine.loadScene(scene);     // mount: upload meshes, register entities (fail-loud)
        engine.start();               // input > physics > update > render

        // Expose for console debugging.
        (window as unknown as { engine: Engine; scene: Scene }).engine = engine;
        (window as unknown as { engine: Engine; scene: Scene }).scene = scene;

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

        // Engine control functions
        (window as any).pauseEngine = () => {
            console.log('⏸️ Engine paused');
            engine.stop();
        };

        (window as any).resumeEngine = () => {
            console.log('▶️ Engine resumed');
            engine.start();
        };

        console.log('✅ physics scene running (two stacked balls → floor grid)');

    } catch (error) {
        console.error('❌ Error in zero-copy physics test:', error);
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            (errorDiv as HTMLElement).style.display = 'block';
        }
    }
}

// Export for browser testing
(window as any).createZeroCopyPhysicsScene = createTwoParallelEntityPhysicsScene;
(window as any).runZeroCopyPhysicsTest = main;

main();
