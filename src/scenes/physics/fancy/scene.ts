// Fancy Physics Demonstration Scene
// Features: Stacked spheres (left), stacked cubes (right), kinematic platform (center), 3x3 ball rain

import { Scene } from '../../../engine/scene-system';
import { WebGPURendererV2 } from '../../../renderer/webgpu.renderer';
import { GameObject } from '../../../engine/gameobject';
import { RigidBody, MeshRenderer } from '../../../engine/components';
import { createTriangleMesh, createCubeMesh, createSphereMesh, createGridMesh } from '../../../renderer/mesh-utils';

// Mesh interference test function removed - was used for debugging

async function createFancyPhysicsDemo(scene: Scene): Promise<Scene> {
    // =============================================================================
    // FULL FANCY PHYSICS DEMONSTRATION
    // =============================================================================

    // FLOOR: Gray grid platform (kinematic)
    const floor = new GameObject('floor', 'Floor');
    floor.transform.setPosition(0, -8, 0);
    floor.transform.setScale(1, 1, 1); // don't scale grid mesh (1x1 squares)

    const floorMeshRenderer = new MeshRenderer('grid', 'default', 'lines',
        { x: 0.3, y: 0.3, z: 0.3, w: 1.0 } // Dark gray grid
    );
    floor.addComponent(floorMeshRenderer);

    // No collider - floor is just visual at world bounds
    scene.addGameObject(floor);

    // LEFT COLUMN: Stack of sphere balls (orange/red tones)
    const leftBalls = [];
    for (let i = 0; i < 5; i++) {
        const ball = new GameObject(`left-ball-${i}`, `LeftBall${i}`);
        ball.transform.setPosition(-10, -6 + i * 2.5, 0);
        ball.transform.setScale(1.0, 1.0, 1.0);

        const hue = 0.1 + (i * 0.15); // Orange to red gradient
        const ballMeshRenderer = new MeshRenderer('sphere', 'default', 'triangles',
            { x: 1.0, y: hue, z: 0.1, w: 1.0 }
        );
        ball.addComponent(ballMeshRenderer);

        const ballRigidBody = new RigidBody(
            2.0,        // mass: 2kg
            true,       // useGravity: true
            'sphere',   // colliderType: sphere
            { x: 1.0, y: 1.0, z: 1.0 } // Collision radius = 1.0
        );
        ball.addComponent(ballRigidBody);
        scene.addGameObject(ball);
        leftBalls.push(ball);
    }

    // RIGHT COLUMN: Stack of cube boxes (blue/cyan tones)
    const rightCubes = [];
    for (let i = 0; i < 5; i++) {
        const cube = new GameObject(`right-cube-${i}`, `RightCube${i}`);
        cube.transform.setPosition(10, -6 + i * 2.5, 0);
        cube.transform.setScale(1.8, 1.8, 1.8);

        const hue = 0.5 + (i * 0.1); // Blue to cyan gradient
        const cubeMeshRenderer = new MeshRenderer('cube', 'default', 'triangles',
            { x: 0.1, y: hue, z: 1.0, w: 1.0 }
        );
        cube.addComponent(cubeMeshRenderer);

        const cubeRigidBody = new RigidBody(
            3.0,        // mass: 3kg (heavier than spheres)
            true,       // useGravity: true
            'sphere',   // colliderType: sphere (using sphere collision for cubes)
            { x: 0.9, y: 0.9, z: 0.9 } // Collision radius slightly smaller than visual
        );
        cube.addComponent(cubeRigidBody);
        scene.addGameObject(cube);
        rightCubes.push(cube);
    }

    // CENTER: Kinematic Platform
    const platform = new GameObject('kinematic-platform', 'Platform');
    platform.transform.setPosition(0, -7, 0);
    platform.transform.setScale(2, 2, 2);

    const platformMeshRenderer = new MeshRenderer('cube', 'default', 'triangles',
        { x: 0.5, y: 0.5, z: 0.5, w: 1.0 } // Gray platform
    );
    platform.addComponent(platformMeshRenderer);

    const platformRigidBody = new RigidBody(
        5.0,        // mass: 5.0 (non-zero but still kinematic)
        false,      // useGravity: false
        'sphere',   // colliderType: sphere
        { x: 1.0, y: 1.0, z: 1.0 } // Platform collision radius = 2.0 (still sphere collider, x = radius!)
    );
    platformRigidBody.setKinematic(true); // Kinematic - won't move
    platform.addComponent(platformRigidBody);
    scene.addGameObject(platform);

    // CENTER TOP: 3x3 Ball Array falling from above
    const fallBalls = [];
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const ball = new GameObject(`fall-ball-${row}-${col}`, `FallBall${row}${col}`);
            const x = -2 + col * 2;  // Spread across platform
            // Add pseudo-random height variation based on position (deterministic but varied)
            const heightVariation = ((row * 3 + col) % 5) * 0.4 - 0.8; // -0.8 to +0.8 range
            const y = 3 + row * 1.5 + heightVariation; // Stacked vertically with height variation
            const z = -2 + row * 2;  // Some depth variation
            ball.transform.setPosition(x, y, z);
            ball.transform.setScale(0.8, 0.8, 0.8);

            // Color gradient: purple to pink
            const hue = 0.8 + (row + col) * 0.05;
            const ballMeshRenderer = new MeshRenderer('sphere', 'default', 'triangles',
                { x: hue, y: 0.2, z: 1.0, w: 1.0 }
            );
            ball.addComponent(ballMeshRenderer);

            const ballRigidBody = new RigidBody(
                1.0,        // mass: 1kg
                true,       // useGravity: true
                'sphere',   // colliderType: sphere
                { x: 0.8, y: 0.8, z: 0.8 } // Collision radius matches scale
            );
            ball.addComponent(ballRigidBody);
            scene.addGameObject(ball);
            fallBalls.push(ball);
        }
    }

    return scene;
}

async function initFancyPhysicsScene(): Promise<void> {
    try {
        // Initialize WebGPU renderer
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) {
            throw new Error('Canvas element not found');
        }

        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);

        // Register required meshes before creating scene objects
        const gridMesh = createGridMesh(20, 20);
        renderer.registerMesh('grid', gridMesh);

        const sphereMesh = createSphereMesh(1.0, 16);
        renderer.registerMesh('sphere', sphereMesh);

        const cubeMesh = createCubeMesh(1);
        renderer.registerMesh('cube', cubeMesh);

        const triangleMesh = createTriangleMesh();
        renderer.registerMesh('triangle', triangleMesh);

        // Create and initialize scene
        const scene = new Scene();
        await scene.init(renderer);

        await createFancyPhysicsDemo(scene); // Full fancy physics demo

        // Position camera for good view of the full action
        scene.camera.setPosition([0, 5, -25]); // Pull back and up more for full demo overview
        scene.camera.lookAt([0, 0, 0]); // Look at the center of all the action

        // Start the simulation
        scene.start();

        // Log scene statistics
        const sceneInfo = scene.getSceneInfo();
        console.log('📊 Fancy Physics Scene Info:', sceneInfo);

        // Animation loop control
        let isRunning = true;
        let animationId: number;
        let lastTime = performance.now();

        const startTime = performance.now();
        const gameLoop = (currentTime: number) => {
            if (!isRunning) {
                return; // Paused
            }

            // Auto-stop disabled - let physics run continuously
            const elapsedTime = (currentTime - startTime) / 1000;

            const rawDeltaTime = (currentTime - lastTime) / 1000;
            const deltaTime = Math.min(rawDeltaTime, 1/30);
            lastTime = currentTime;

            // Update scene (physics simulation and rendering)
            scene.update(deltaTime);

            // Physics debug logging every ~30 frames (at 60fps) for full demo
            const frameCount = Math.floor(elapsedTime * 60);
            if (frameCount % 30 === 0) {
                const wasmModule = scene.physicsBridge.getWasmModule();
                if (wasmModule) {
                    const collisionState = wasmModule.get_collision_state();
                    const collisionsDetected = wasmModule.get_collisions_detected();
                    const checksPerformed = wasmModule.get_collision_checks_performed();
                    const kinematicFlag = wasmModule.get_kinematic_collision_flag();

                    console.log(`🔍 Physics Debug (t=${elapsedTime.toFixed(1)}s): collision_state=0x${collisionState.toString(16)}, detected=${collisionsDetected}, checks=${checksPerformed}, kinematic=${kinematicFlag}`);

                    // Entity physics info for ball (ID 1)
                    if (wasmModule.debug_get_entity_physics_info) {
                        const ballY = wasmModule.debug_get_entity_physics_info(1, 1);
                        const ballVY = wasmModule.debug_get_entity_physics_info(1, 4);
                        console.log(`   Ball: Y=${ballY.toFixed(2)}, VY=${ballVY.toFixed(2)}`);
                    }
                }
            }

            animationId = requestAnimationFrame(gameLoop);
        };

        // Engine control functions for debugging
        (window as any).pauseEngine = () => {
            console.log('⏸️ Fancy Physics Engine paused');
            isRunning = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };

        (window as any).resumeEngine = () => {
            console.log('▶️ Fancy Physics Engine resumed');
            if (!isRunning) {
                isRunning = true;
                lastTime = performance.now(); // Reset time to avoid large delta
                animationId = requestAnimationFrame(gameLoop);
            }
        };

        // Collision stats function for manual checking
        (window as any).checkCollisions = () => {
            const wasmModule = scene.physicsBridge.getWasmModule();
            if (wasmModule && wasmModule.get_collision_state) {
                const collisionState = wasmModule.get_collision_state();
                console.log(`📊 Current collision state: 0x${collisionState.toString(16)} (${collisionState})`);
                console.log('   • 0x01 = floor collision, 0x02 = wall collision, 0x10 = entity collision, 0x20 = kinematic collision');

                // Try to get entity positions if debug functions are available
                if (wasmModule.debug_get_entity_physics_info) {
                    const ballY = wasmModule.debug_get_entity_physics_info(1, 1); // Ball Y position
                    const ballVY = wasmModule.debug_get_entity_physics_info(1, 4); // Ball Y velocity
                    const platformY = wasmModule.debug_get_entity_physics_info(0, 1); // Platform Y position
                    console.log(`🔴 Ball: Y=${ballY.toFixed(2)}, VY=${ballVY.toFixed(2)}`);
                    console.log(`⬜ Platform: Y=${platformY.toFixed(2)}`);
                }
            } else {
                console.log('❌ WASM collision functions not available');
            }
        };

        // UI Button Control Setup
        const playPauseBtn = document.getElementById('playPauseBtn') as HTMLButtonElement;
        const engineStatus = document.getElementById('engineStatus') as HTMLDivElement;

        const updateUI = () => {
            if (isRunning) {
                playPauseBtn.innerHTML = '⏸️';
                playPauseBtn.title = 'Pause Physics Engine';
                engineStatus.textContent = 'Engine Running';
            } else {
                playPauseBtn.innerHTML = '▶️';
                playPauseBtn.title = 'Resume Physics Engine';
                engineStatus.textContent = 'Engine Paused';
            }
        };

        // Enhanced pause/resume functions that update UI
        (window as any).pauseEngine = () => {
            console.log('⏸️ Fancy Physics Engine paused');
            isRunning = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            updateUI();
        };

        (window as any).resumeEngine = () => {
            console.log('▶️ Fancy Physics Engine resumed');
            if (!isRunning) {
                isRunning = true;
                lastTime = performance.now(); // Reset time to avoid large delta
                animationId = requestAnimationFrame(gameLoop);
            }
            updateUI();
        };

        // Button click handler
        playPauseBtn.addEventListener('click', () => {
            if (isRunning) {
                (window as any).pauseEngine();
            } else {
                (window as any).resumeEngine();
            }
        });

        // Initial UI state
        updateUI();

        // Start the full physics animation loop
        console.log('🎮 Starting fancy physics render loop...');
        animationId = requestAnimationFrame(gameLoop);

    } catch (error) {
        console.error('❌ Failed to initialize fancy physics scene:', error);
    }
}

// Initialize when page loads
initFancyPhysicsScene().catch(console.error);
