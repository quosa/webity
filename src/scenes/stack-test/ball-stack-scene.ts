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

// Debug logging state - accessible globally for WASM jslog function
(window as any).isDebugLoggingEnabled = true;

const createBall = (id: string, name: string) => {
    const ball = new GameObject(id, name);
    ball.transform.setPosition(0, 0, 0);
    ball.transform.setScale(1, 1, 1);

    const ballMeshRenderer = new MeshRenderer(
        'sphere', 'default', 'triangles', { x: 1, y: 1, z: 1, w: 1 }
    ); // White
    ball.addComponent(ballMeshRenderer);

    const ballRigidBody = new RigidBody(
        1.0,                        // mass: 1kg
        true,                       // useGravity: true
        CollisionShape.SPHERE,      // collisionShape: sphere
        { x: 1.0, y: 1.0, z: 1.0 }  // x: sphere radius
    );
    ball.addComponent(ballRigidBody);

    return ball;
};

function createInitialStackScene(scene: Scene): void {

    // Create static floor grid (no RigidBody = static)

    // Position grid slightly behind physics objects to avoid Z-fighting
    // NOTE: if we move the floor to z=0.1, the stack collapses
    // because the collision unit vector is not fully aligned on the Y-axis
    // const floor = GameObject.createGrid('ZeroCopyFloor', { x: 0, y: -8, z: 0.1 });

    // if wehave the floor centered at xz=0, the stack is stable
    const floor = GameObject.createGrid('ZeroCopyFloor', { x: 0, y: -8.01, z: 0 });

    // Make the grid gray instead of bright yellow for better visibility
    const floorMeshRenderer = floor.getComponent(MeshRenderer);
    if (floorMeshRenderer) {
        floorMeshRenderer.color = { x: 0.3, y: 0.3, z: 0.3, w: 1.0 }; // Gray
    }
    // NOTE: if we remove the floor the bottom box sits at -7 as it should
    // if we leave it, the bottom ball floats at -6.513 instead of -7.0
    scene.addGameObject(floor);

    const bottomBall = createBall('bottom-ball', 'BottomBall');
    // bottomBall.transform.setPosition(0, -7.0, 0);
    bottomBall.transform.setPosition(0, -6.5, 0);
    bottomBall.getComponent(MeshRenderer)?.setColor(1, 0.5, 0, 1); // Orange
    scene.addGameObject(bottomBall);

    const middleBall = createBall('middle-ball', 'MiddleBall');
    // middleBall.transform.setPosition(0, -5.9, 0);
    middleBall.transform.setPosition(0, -4.0, 0);
    middleBall.getComponent(MeshRenderer)?.setColor(0, 1, 0, 1); // Green
    scene.addGameObject(middleBall);

    const topBall = createBall('top-ball', 'TopBall');
    // topBall.transform.setPosition(0, -3.8, 0); // Start higher to allow natural falling
    topBall.transform.setPosition(0, -1.5, 0); // Start higher to allow natural falling
    topBall.getComponent(MeshRenderer)?.setColor(0, 0, 1, 1); // Blue
    scene.addGameObject(topBall);

    ballCount = 3;

    // Set camera for optimal viewing
    scene.camera.setPosition([5, -3, -10]);
    scene.camera.lookAt([0, -7, 0]);

    console.log(`✅ 3-ball stack test scene created with ${scene.getEntityCount()} entities`);
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
    const floorBall = createBall('floor-test-ball', 'FloorTestBall');
    floorBall.transform.setPosition(5, -7.0, 0);
    floorBall.getComponent(MeshRenderer)?.setColor(1, 0, 1, 1); // Magenta
    scene.addGameObject(floorBall);

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

        // Create initial 3-ball stack
        createInitialStackScene(scene);

        // Start the scene
        scene.start();

        // Animation loop with FPS counter and pause/resume system
        let lastTime = performance.now();
        let frameCount = 0;
        let lastFpsTime = 0;
        let isRunning = true;
        let animationId: number | null = null;

        const gameLoop = (currentTime: number) => {
            const rawDeltaTime = (currentTime - lastTime) / 1000;
            const deltaTime = Math.min(rawDeltaTime, 1/30); // Cap at 30fps
            lastTime = currentTime;

            if (isRunning) {
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

            animationId = requestAnimationFrame(gameLoop);
        };

        // Engine control functions for debugging
        (window as any).pauseEngine = () => {
            console.log('⏸️ Ball Stack Engine paused');
            isRunning = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            updateUI();
        };

        (window as any).resumeEngine = () => {
            console.log('▶️ Ball Stack Engine resumed');
            if (!isRunning) {
                isRunning = true;
                lastTime = performance.now(); // Reset time to avoid large delta
                animationId = requestAnimationFrame(gameLoop);
            }
            updateUI();
        };

        // UI Button Control Setup
        const playPauseBtn = document.getElementById('playPauseBtn') as HTMLButtonElement;
        const engineStatus = document.getElementById('engineStatus') as HTMLDivElement;

        const updateUI = () => {
            if (playPauseBtn) {
                if (isRunning) {
                    playPauseBtn.innerHTML = '⏸️';
                    playPauseBtn.title = 'Pause Physics Engine';
                } else {
                    playPauseBtn.innerHTML = '▶️';
                    playPauseBtn.title = 'Resume Physics Engine';
                }
            }
            if (engineStatus) {
                engineStatus.textContent = isRunning ? 'Engine Running' : 'Engine Paused';
            }
        };

        // Button click handler (if button exists)
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (isRunning) {
                    (window as any).pauseEngine();
                } else {
                    (window as any).resumeEngine();
                }
            });
        }

        // Debug logging toggle functions
        (window as any).toggleDebugLogging = () => {
            (window as any).isDebugLoggingEnabled = !(window as any).isDebugLoggingEnabled;
            console.log(`🔍 Debug logging ${(window as any).isDebugLoggingEnabled ? 'ENABLED' : 'DISABLED'}`);
            updateDebugUI();
        };

        // Debug UI update function
        const debugStatusElement = document.getElementById('debugStatus') as HTMLDivElement;
        const updateDebugUI = () => {
            if (debugStatusElement) {
                debugStatusElement.textContent = (window as any).isDebugLoggingEnabled ? 'Debug: ON' : 'Debug: OFF';
                debugStatusElement.style.color = (window as any).isDebugLoggingEnabled ? '#00ff00' : '#ff6666';
            }
        };

        // Keyboard event listener for 'L' key
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'l') {
                (window as any).toggleDebugLogging();
            }
        });

        // Initial UI state
        updateUI();
        updateDebugUI();

        // Start the game loop
        animationId = requestAnimationFrame(gameLoop);

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
