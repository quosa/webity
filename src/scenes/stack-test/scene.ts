// src/scenes/stack-test/scene.ts
// Systematic stack test - 2 perfectly aligned spheres

import { Scene } from '../../engine/scene-system.js';
import { GameObject } from '../../engine/gameobject.js';
import { MeshRenderer, RigidBody, CollisionShape } from '../../engine/components.js';
import { WebGPURendererV2 } from '../../renderer/webgpu.renderer.js';
import { createSphereMesh, createGridMesh, createCubeMesh } from '../../renderer/mesh-utils.js';

let scene: Scene | undefined;
let ballCount = 0;
let isMonitoringCollisions = false;
let lastLoggedCollisionCounter = 0;

function createInitialStackScene(scene: Scene): void {
    console.log('🏗️ Creating 3-box stack test scene (NO FLOOR ENTITY)...');

    // NO floor grid entity - using world bounds collision only
    console.log('📐 No floor grid entity - using world bounds collision only (should eliminate interference)');

    // Create bottom box - positioned to rest on world bounds floor
    // World bounds floor is at Y=-8, box half-height is 1.0, so box center should be at Y=-7.0
    const bottomBox = new GameObject('bottom-box', 'BottomBox');
    bottomBox.transform.setPosition(0, -7.0, 0);
    bottomBox.transform.setScale(1, 1, 1); // Unity scale

    const bottomMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 1, y: 0.5, z: 0, w: 1 }); // Orange
    bottomBox.addComponent(bottomMeshRenderer);

    // BOX COLLISION: Use half-extents for box collision (cube mesh is 2x2x2, so half-extents are 1x1x1)
    const bottomRigidBody = new RigidBody(
        1.0,                      // mass: 1kg
        true,                     // useGravity: true
        CollisionShape.BOX,       // collisionShape: box
        { x: 1.0, y: 1.0, z: 1.0 } // extents: half-extents for box collision
    );

    console.log('🔍 BOX STACK DEBUG - Bottom box:');
    console.log('   Transform scale:', bottomBox.transform.scale);
    console.log('   RigidBody extents (half-extents):', bottomRigidBody.extents);
    console.log('   RigidBody collision shape: BOX');
    console.log('   Expected final Y position: -8.0 + 1.0 = -7.0 (floor + half-height)');

    bottomBox.addComponent(bottomRigidBody);
    scene.addGameObject(bottomBox);
    console.log('🟠 Added bottom box at Y=-7.0 (should rest on floor)');

    // Create middle box - positioned with 0.1 unit gap above bottom box
    // Bottom box top at Y=-6.0, gap 0.1, so middle box center at Y=-5.9
    const middleBox = new GameObject('middle-box', 'MiddleBox');
    middleBox.transform.setPosition(0, -4.5, 0); // Small gap for natural falling
    middleBox.transform.setScale(1, 1, 1); // Unity scale

    const middleMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 1, z: 0, w: 1 }); // Green
    middleBox.addComponent(middleMeshRenderer);

    const middleRigidBody = new RigidBody(
        1.0,                      // mass: 1kg
        true,                     // useGravity: true
        CollisionShape.BOX,       // collisionShape: box
        { x: 1.0, y: 1.0, z: 1.0 } // extents: half-extents for box collision
    );
    middleBox.addComponent(middleRigidBody);
    scene.addGameObject(middleBox);
    console.log('🟢 Added middle box at Y=-5.9 (0.1 gap above bottom, should fall and stack)');

    // Create top box - positioned with 0.1 unit gap above middle box
    // Middle box top at Y=-4.0 (assuming middle settles at Y=-5.0), gap 0.1, so top box center at Y=-3.9
    const topBox = new GameObject('top-box', 'TopBox');
    topBox.transform.setPosition(0, -2.2, 0); // Start higher to allow natural falling
    topBox.transform.setScale(1, 1, 1); // Unity scale

    const topMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 0, z: 1, w: 1 }); // Blue
    topBox.addComponent(topMeshRenderer);

    const topRigidBody = new RigidBody(
        1.0,                      // mass: 1kg
        true,                     // useGravity: true
        CollisionShape.BOX,       // collisionShape: box
        { x: 1.0, y: 1.0, z: 1.0 } // extents: half-extents for box collision
    );
    topBox.addComponent(topRigidBody);
    scene.addGameObject(topBox);
    console.log('🔵 Added top box at Y=2.0 (should fall and stack on middle box)');

    ballCount = 3;

    // Set camera for optimal viewing
    scene.camera.setPosition([5, -3, -10]);
    scene.camera.lookAt([0, -7, 0]);

    console.log(`✅ 3-box stack test scene created with ${scene.getEntityCount()} entities`);
}

// Global functions for HTML interface
(window as any).resetScene = () => {
    if (!scene) return;

    // Remove all GameObjects except floor
    const entities = scene.getAllGameObjects();
    entities.forEach(entity => {
        if (entity.name !== 'Floor') {
            scene?.removeGameObject(entity.id);
        }
    });

    // Recreate the initial 3-ball stack
    createInitialStackScene(scene);
    ballCount = 3;

    console.log('🔄 Scene reset to 3-ball stack');
    updateStatus();
};

(window as any).addBall = () => {
    if (!scene) return;

    // Add a new ball above the existing stack
    const newBall = new GameObject(`ball-${ballCount}`, `Ball${ballCount}`);

    // Position it above the current stack with some random offset to test collision
    const yPosition = -5.0 + (ballCount - 1) * 2.0; // Stack vertically with 2.0 unit spacing
    const xOffset = (Math.random() - 0.5) * 0.2; // Small random X offset
    const zOffset = (Math.random() - 0.5) * 0.2; // Small random Z offset

    newBall.transform.setPosition(xOffset, yPosition, zOffset);
    newBall.transform.setScale(1, 1, 1);

    // Random color for variety
    const color = {
        x: Math.random() * 0.8 + 0.2,
        y: Math.random() * 0.8 + 0.2,
        z: Math.random() * 0.8 + 0.2,
        w: 1
    };

    const meshRenderer = new MeshRenderer('sphere', 'default', 'triangles', color);
    newBall.addComponent(meshRenderer);

    const rigidBody = new RigidBody(
        1.0,                      // mass: 1kg
        true,                     // useGravity: true
        CollisionShape.SPHERE,    // collisionShape: sphere
        { x: 1.0, y: 1.0, z: 1.0 } // extents: 1.0 radius matches visual mesh
    );
    newBall.addComponent(rigidBody);

    scene.addGameObject(newBall);
    ballCount++;

    console.log(`🎾 Added ball ${ballCount - 1}`);
    updateStatus();
};

(window as any).addSingleFloorBall = () => {
    if (!scene) return;

    // Add a single ball on the floor away from the stack to test if it also floats
    const testBall = new GameObject('floor-test-ball', 'FloorTestBall');

    // Position it away from the stack at X=5, on the floor
    testBall.transform.setPosition(5, -7.0, 0); // Same Y as our original bottom sphere
    testBall.transform.setScale(1, 1, 1);

    const meshRenderer = new MeshRenderer('sphere', 'default', 'triangles', { x: 1, y: 0, z: 1, w: 1 }); // Magenta
    testBall.addComponent(meshRenderer);

    const rigidBody = new RigidBody(
        1.0,                      // mass: 1kg
        true,                     // useGravity: true
        CollisionShape.SPHERE,    // collisionShape: sphere
        { x: 0.5, y: 0.5, z: 0.5 } // extents: 0.5 radius for scaling test - half size
    );
    testBall.addComponent(rigidBody);

    scene.addGameObject(testBall);

    console.log('🔍 Added single floor test ball at X=5, Y=-7.0 to test world bounds collision');
    updateStatus();
};

// 🔍 COLLISION MONITORING FUNCTIONS - New real-time collision tracking
function checkForNewCollisions() {
    if (!scene || !isMonitoringCollisions) return;

    const currentCollisionCounter = scene.physicsBridge.getCollisionEventCounter();

    // Check if new collisions occurred since last check
    if (currentCollisionCounter > lastLoggedCollisionCounter) {
        const newCollisions = currentCollisionCounter - lastLoggedCollisionCounter;
        console.log(`🚨 NEW COLLISION EVENTS: ${newCollisions} new collision(s) detected (total: ${currentCollisionCounter})`);

        // Log details of the latest collision
        const lastCollisionData = scene.physicsBridge.getLastCollisionData();
        if (lastCollisionData) {
            // Map WASM entity IDs back to GameObjects
            const entities = scene.getAllGameObjects().filter(e => e.name !== 'Floor');
            const entity1 = entities.find(e => e.getComponent(RigidBody)?.getWasmEntityId() === lastCollisionData.entity1);
            const entity2 = entities.find(e => e.getComponent(RigidBody)?.getWasmEntityId() === lastCollisionData.entity2);

            if (entity1 && entity2) {
                console.log(`🔍 LATEST COLLISION: "${entity1.name}" vs "${entity2.name}"`);
                console.log(`   Positions: (${lastCollisionData.pos1[0].toFixed(2)}, ${lastCollisionData.pos1[1].toFixed(2)}, ${lastCollisionData.pos1[2].toFixed(2)}) vs (${lastCollisionData.pos2[0].toFixed(2)}, ${lastCollisionData.pos2[1].toFixed(2)}, ${lastCollisionData.pos2[2].toFixed(2)})`);

                // Check for box-box collisions specifically
                if (entity1.name.includes('Box') && entity2.name.includes('Box')) {
                    console.log('   🎯 BOX-BOX COLLISION: Target collision detected! Watch for "melting" behavior without erratic fighting');
                }
            }
        }

        lastLoggedCollisionCounter = currentCollisionCounter;
    }
}

(window as any).startCollisionMonitoring = () => {
    if (!scene) return;

    isMonitoringCollisions = true;
    lastLoggedCollisionCounter = scene.physicsBridge.getCollisionEventCounter();
    console.log('🔍 COLLISION MONITORING STARTED - Real-time collision logging enabled');
    console.log(`   Starting from collision count: ${lastLoggedCollisionCounter}`);
};

(window as any).stopCollisionMonitoring = () => {
    isMonitoringCollisions = false;
    console.log('🔍 COLLISION MONITORING STOPPED');
};

(window as any).clearCollisionEvents = () => {
    if (!scene) return;

    scene.physicsBridge.clearCollisionEventCounter();
    lastLoggedCollisionCounter = 0;
    console.log('🔍 COLLISION EVENT COUNTER CLEARED');
};

(window as any).runPhysicsTest = () => {
    if (!scene) return;

    console.log('🧪 Running physics diagnostics...');

    // Get physics stats
    const stats = scene.physicsBridge.getStats();
    console.log('📊 Physics Bridge Stats:', stats);

    // Get collision information
    const collisionState = scene.physicsBridge.getWasmModule()?.get_collision_state?.();
    console.log('💥 Collision State:', `0x${collisionState?.toString(16).padStart(2, '0')}`);

    // 🔍 COLLISION EVENT LOGGING - New collision logging system
    const collisionEventCounter = scene.physicsBridge.getCollisionEventCounter();
    console.log(`🔍 COLLISION EVENTS: ${collisionEventCounter} total collisions detected`);

    if (collisionEventCounter > 0) {
        const lastCollisionData = scene.physicsBridge.getLastCollisionData();
        if (lastCollisionData) {
            console.log('🔍 LAST COLLISION DATA:');
            console.log(`   Entity IDs: ${lastCollisionData.entity1} vs ${lastCollisionData.entity2}`);
            console.log(`   Entity 1 position: (${lastCollisionData.pos1[0].toFixed(3)}, ${lastCollisionData.pos1[1].toFixed(3)}, ${lastCollisionData.pos1[2].toFixed(3)})`);
            console.log(`   Entity 2 position: (${lastCollisionData.pos2[0].toFixed(3)}, ${lastCollisionData.pos2[1].toFixed(3)}, ${lastCollisionData.pos2[2].toFixed(3)})`);

            // Map WASM entity IDs back to GameObjects for better context
            const entities = scene.getAllGameObjects().filter(e => e.name !== 'Floor');
            const entity1 = entities.find(e => e.getComponent(RigidBody)?.getWasmEntityId() === lastCollisionData.entity1);
            const entity2 = entities.find(e => e.getComponent(RigidBody)?.getWasmEntityId() === lastCollisionData.entity2);

            if (entity1 && entity2) {
                console.log(`   GameObject collision: "${entity1.name}" (${entity1.constructor.name}) vs "${entity2.name}" (${entity2.constructor.name})`);

                // Check if this is the expected box-box collision we're testing
                if (entity1.name.includes('Box') && entity2.name.includes('Box')) {
                    console.log('   ✅ BOX-BOX COLLISION DETECTED: This is the collision behavior we are debugging');
                    console.log('   🔍 COLLISION ISOLATION: Resolution disabled - boxes should "melt" together without fighting');
                }
            }
        }
    } else {
        console.log('   No collision events logged yet');
    }

    // Check entity positions and compare radius values between TypeScript and WASM
    const entities = scene.getAllGameObjects().filter(e => e.name !== 'Floor');
    entities.forEach((entity) => {
        const rigidBody = entity.getComponent(RigidBody);
        const wasmId = rigidBody?.getWasmEntityId();

        if (wasmId !== undefined && scene) {
            const transform = entity.transform;
            const finalY = transform.position.y;
            console.log(`📍 ${entity.name} (WASM ID ${wasmId}): pos=(${transform.position.x.toFixed(3)}, ${finalY.toFixed(3)}, ${transform.position.z.toFixed(3)})`);

            // 🔍 WASM DEBUG: Get actual collision radius being used by WASM physics
            const wasmCollisionRadius = scene.physicsBridge.getEntityCollisionRadius(wasmId);
            const typescriptRadius = rigidBody?.extents.x;

            console.log(`🔍 COLLISION RADIUS DEBUG for ${entity.name}:`);
            console.log(`   TypeScript RigidBody extents.x: ${typescriptRadius}`);
            console.log(`   WASM actual collision radius: ${wasmCollisionRadius}`);

            if (wasmCollisionRadius !== null && typescriptRadius !== undefined) {
                if (Math.abs(wasmCollisionRadius - typescriptRadius) < 0.001) {
                    console.log('   ✅ RADIUS MATCH: TypeScript and WASM using same collision radius');
                } else {
                    console.log(`   🚨 RADIUS MISMATCH: TypeScript=${typescriptRadius}, WASM=${wasmCollisionRadius}`);
                    console.log(`   🔍 Discrepancy: ${Math.abs(wasmCollisionRadius - typescriptRadius).toFixed(3)} units`);
                }
            } else {
                console.log('   ❌ Failed to get WASM collision radius (debug function not available)');
            }

            // 🔍 BOX STACKING ANALYSIS (NO FLOOR ENTITY INTERFERENCE)
            if (entity.name === 'BottomBox') {
                const impliedHalfHeight = finalY - (-8.0); // finalY = -8.0 + half-height
                console.log(`🔍 BOTTOM BOX ANALYSIS for ${entity.name}:`);
                console.log(`   Final Y position: ${finalY.toFixed(3)}`);
                console.log('   Expected Y position: -7.000 (world_bounds.y=-8.0 + half-height=1.0)');
                console.log(`   Implied half-height from physics: ${impliedHalfHeight.toFixed(3)} (calculated from finalY - (-8.0))`);

                if (wasmCollisionRadius !== null) {
                    console.log(`   Expected Y with WASM collision extent: ${(-8.0 + wasmCollisionRadius).toFixed(3)}`);
                    const expectedDiff = Math.abs(finalY - (-8.0 + wasmCollisionRadius));
                    if (expectedDiff < 0.1) {
                        console.log('   ✅ BOTTOM BOX SUCCESS: Final position matches WASM collision extent');
                    } else {
                        console.log(`   🚨 BOTTOM BOX ISSUE: Position doesn't match expected (diff: ${expectedDiff.toFixed(3)})`);
                    }
                }

                if (Math.abs(impliedHalfHeight - 1.0) < 0.1) {
                    console.log('   ✅ FLOOR COLLISION FIXED: 1.0 effective half-height achieved!');
                } else {
                    console.log(`   🔍 FLOOR POSITION: Half-height ${impliedHalfHeight.toFixed(3)} - may indicate issues`);
                }
            }

            // 🔍 STACKING ANALYSIS for middle and top boxes (WITHOUT FLOOR INTERFERENCE)
            if (entity.name === 'MiddleBox') {
                console.log(`🔍 MIDDLE BOX STACKING ANALYSIS for ${entity.name}:`);
                console.log(`   Final Y position: ${finalY.toFixed(3)}`);
                console.log('   Expected Y position: -5.000 (stacked on bottom box: -7.0 + 1.0 + 1.0)');
                const expectedY = -5.0;
                const stackingError = Math.abs(finalY - expectedY);
                if (stackingError < 0.1) {
                    console.log('   ✅ PERFECT STACKING: Middle box settled correctly on bottom box');
                } else if (stackingError < 0.5) {
                    console.log(`   🔍 MINOR STACKING DRIFT: ${stackingError.toFixed(3)} units off expected position (acceptable)`);
                } else {
                    console.log(`   🚨 MAJOR STACKING ISSUE: ${stackingError.toFixed(3)} units off expected position`);
                }

                // Check for penetration or entanglement
                if (finalY < -6.5) {
                    console.log('   ❌ PENETRATION: Middle box has penetrated the bottom box');
                } else if (finalY > -4.0) {
                    console.log('   ❌ FLOATING: Middle box is floating too high');
                }
            }

            if (entity.name === 'TopBox') {
                console.log(`🔍 TOP BOX STACKING ANALYSIS for ${entity.name}:`);
                console.log(`   Final Y position: ${finalY.toFixed(3)}`);
                console.log('   Expected Y position: -3.000 (stacked on middle box)');
                const expectedY = -3.0;
                const stackingError = Math.abs(finalY - expectedY);
                if (stackingError < 0.1) {
                    console.log('   ✅ PERFECT STACKING: Top box settled correctly on middle box');
                } else if (stackingError < 0.5) {
                    console.log(`   🔍 MINOR STACKING DRIFT: ${stackingError.toFixed(3)} units off expected position (acceptable)`);
                } else {
                    console.log(`   🚨 MAJOR STACKING ISSUE: ${stackingError.toFixed(3)} units off expected position`);
                }

                // Check for severe issues
                if (finalY < -4.0) {
                    console.log('   ❌ SEVERE PENETRATION: Top box has fallen through middle box');
                } else if (finalY > -2.0) {
                    console.log('   ❌ FLOATING: Top box is floating too high');
                }
            }
        }
    });

    // Update physics status
    const physicsStatusElement = document.getElementById('physics-status');
    if (physicsStatusElement) {
        physicsStatusElement.textContent = `Tested (${stats.entityCount} entities)`;
    }
};

function updateStatus() {
    if (!scene) return;

    const countElement = document.getElementById('entity-count');
    if (countElement) {
        countElement.textContent = scene.getEntityCount().toString();
    }
}

function showError(message: string) {
    const errorDiv = document.getElementById('error-display');
    if (errorDiv) {
        errorDiv.textContent = `Error: ${message}`;
        errorDiv.style.display = 'block';
    }
}

async function main() {
    console.log('🚀 Stack Test Scene starting...');
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;

    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        // Initialize renderer
        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);

        // Register required meshes
        renderer.registerMesh('sphere', createSphereMesh(1.0, 16));
        renderer.registerMesh('cube', createCubeMesh(2.0)); // 2x2x2 cube mesh
        renderer.registerMesh('grid', createGridMesh(20, 20));

        // Create and initialize scene
        scene = new Scene();
        await scene.init(renderer);

        // Create initial 3-box stack
        createInitialStackScene(scene);

        // Start the scene
        scene.start();

        console.log('✅ Stack test scene initialized successfully');

        // 🔍 COLLISION DEBUGGING INSTRUCTIONS
        console.log('');
        console.log('🔍 COLLISION DEBUGGING TOOLS AVAILABLE:');
        console.log('   startCollisionMonitoring() - Start real-time collision event logging');
        console.log('   stopCollisionMonitoring()  - Stop real-time collision event logging');
        console.log('   clearCollisionEvents()     - Clear collision event counter');
        console.log('   runPhysicsTest()           - Run full physics diagnostics with collision data');
        console.log('');
        console.log('🎯 TESTING GOAL: Boxes should "melt into one another" without erratic fighting behavior');
        console.log('   (Collision resolution is disabled - only detection active)');
        console.log('');

        // Animation loop with FPS counter and 3-second timeout
        let lastTime = performance.now();
        let frameCount = 0;
        let lastFpsTime = 0;
        const startTime = performance.now();
        const SIMULATION_TIMEOUT = 2500; // 2.5 seconds in milliseconds
        let simulationStopped = false;

        const gameLoop = (currentTime: number) => {
            const rawDeltaTime = (currentTime - lastTime) / 1000;
            const deltaTime = Math.min(rawDeltaTime, 1/30); // Cap at 30fps
            lastTime = currentTime;

            // Check if 2.5 seconds have passed
            if (currentTime - startTime >= SIMULATION_TIMEOUT && !simulationStopped) {
                console.log('⏱️ SIMULATION TIMEOUT: Stopping after 2.5 seconds to keep logs manageable');
                simulationStopped = true;

                // Run final diagnostics
                console.log('📊 FINAL DIAGNOSTICS:');
                (window as any).runPhysicsTest();
                return; // Stop the game loop
            }

            if (!simulationStopped) {
                // Update scene
                scene?.update(deltaTime);

                // Check for new collision events (real-time monitoring)
                checkForNewCollisions();
            }

            // Update FPS counter
            frameCount++;
            if (currentTime - lastFpsTime >= 1000) {
                const fpsElement = document.getElementById('fps');
                if (fpsElement) fpsElement.textContent = frameCount.toString();

                updateStatus();

                frameCount = 0;
                lastFpsTime = currentTime;
            }

            if (!simulationStopped) {
                requestAnimationFrame(gameLoop);
            }
        };

        // Start the game loop
        requestAnimationFrame(gameLoop);

        // Initial status update
        updateStatus();

    } catch (error) {
        console.error('❌ Error in stack test scene:', error);
        showError(error instanceof Error ? error.message : String(error));
    }
}

// Export for browser testing
(window as any).stackTestScene = scene;

main();
