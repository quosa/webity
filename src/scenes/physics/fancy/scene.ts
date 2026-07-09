// Fancy Physics Demonstration Scene
// Features: Stacked spheres (left), stacked cubes (right), kinematic platform (center), 3x3 ball rain
// Migrated to the scene-first engine API (A3): buildScene() is pure data, the Engine mounts + runs it.

import { Engine } from '../../../engine/engine';
import { Scene } from '../../../engine/scene-system';
import { GameObject } from '../../../engine/gameobject';
import { RigidBody, MeshRenderer, CollisionShape } from '../../../engine/components';
import { Mesh } from '../../../engine/mesh';
import { Material } from '../../../engine/material';

// Shared geometry — one CPU descriptor per shape, reused across all spawned objects (the
// engine dedups meshes by id, so regenerating per-spawn just wasted work). Materials stay
// per-object (unique colors), so only the mesh is shared.
const SPHERE_MESH = Mesh.createSphere('sphere', 1.0, 16);
const CUBE_MESH = Mesh.createCube('cube', 1);

// Mesh interference test function removed - was used for debugging

async function createFancyPhysicsDemo(scene: Scene): Promise<Scene> {
    // =============================================================================
    // FULL FANCY PHYSICS DEMONSTRATION
    // =============================================================================

    // FLOOR: Gray grid platform (kinematic)
    const floor = new GameObject('floor', 'Floor');
    floor.transform.setPosition(0, -8, 0);
    floor.transform.setScale(1, 1, 1); // don't scale grid mesh (1x1 squares)

    const floorMeshRenderer = new MeshRenderer(Mesh.createGrid('grid', 20, 20),
        new Material('floor-gray', { r: 0.3, g: 0.3, b: 0.3, a: 1.0 }), 'lines'); // Dark gray grid
    floor.addComponent(floorMeshRenderer);

    // No collider - floor is just visual at world bounds
    scene.addGameObject(floor);

    // LEFT COLUMN: Stack of sphere balls with box colliders (orange/red tones)
    const leftBalls = [];
    for (let i = 0; i < 5; i++) {
        const ball = new GameObject(`left-ball-${i}`, `LeftBall${i}`);
        // Add jitter to position for instability
        const jitterX = (Math.random() - 0.5) * 0.2; // ±0.1 units
        const jitterZ = (Math.random() - 0.5) * 0.2; // ±0.1 units
        ball.transform.setPosition(-10 + jitterX, -6 + i * 2.5, 0 + jitterZ);
        ball.transform.setScale(1.0, 1.0, 1.0);

        const hue = 0.1 + (i * 0.15); // Orange to red gradient
        const ballMeshRenderer = new MeshRenderer(SPHERE_MESH,
            new Material(`left-ball-${i}`, { r: 1.0, g: hue, b: 0.1, a: 1.0 }));
        ball.addComponent(ballMeshRenderer);

        const ballRigidBody = new RigidBody(
            2.0,        // mass: 2kg
            true,       // useGravity: true
            CollisionShape.BOX,      // collisionShape: box (for instability)
            { x: 1.0, y: 1.0, z: 1.0 } // Box extents = 1.0x1.0x1.0
        );
        ball.addComponent(ballRigidBody);
        scene.addGameObject(ball);
        leftBalls.push(ball);
    }

    // RIGHT COLUMN: Stack of cube boxes with box colliders (blue/cyan tones)
    const rightCubes = [];
    for (let i = 0; i < 5; i++) {
        const cube = new GameObject(`right-cube-${i}`, `RightCube${i}`);
        // Add jitter to position for slight instability
        const jitterX = (Math.random() - 0.5) * 0.15; // ±0.075 units (less than spheres)
        const jitterZ = (Math.random() - 0.5) * 0.15; // ±0.075 units
        cube.transform.setPosition(10 + jitterX, -6 + i * 2.5, 0 + jitterZ);
        cube.transform.setScale(1.8, 1.8, 1.8);

        const hue = 0.5 + (i * 0.1); // Blue to cyan gradient
        const cubeMeshRenderer = new MeshRenderer(CUBE_MESH,
            new Material(`right-cube-${i}`, { r: 0.1, g: hue, b: 1.0, a: 1.0 }));
        cube.addComponent(cubeMeshRenderer);

        const cubeRigidBody = new RigidBody(
            3.0,        // mass: 3kg (heavier than spheres)
            true,       // useGravity: true
            CollisionShape.BOX,      // collisionShape: box (for stability)
            { x: 0.9, y: 0.9, z: 0.9 } // Box extents slightly smaller than visual (1.8 scale)
        );
        cube.addComponent(cubeRigidBody);
        scene.addGameObject(cube);
        rightCubes.push(cube);
    }

    // CENTER: Kinematic Platform
    const platform = new GameObject('kinematic-platform', 'Platform');
    platform.transform.setPosition(0, -7, 0);
    platform.transform.setScale(2, 2, 2); // cube was created with side=1

    const platformMeshRenderer = new MeshRenderer(CUBE_MESH,
        new Material('platform-gray', { r: 0.5, g: 0.5, b: 0.5, a: 1.0 })); // Gray platform
    platform.addComponent(platformMeshRenderer);

    const platformRigidBody = new RigidBody(
        5.0,        // mass: 5.0 (non-zero but still kinematic)
        false,      // useGravity: false
        CollisionShape.BOX,      // collisionShape: box (matching visual cube)
        { x: 1.0, y: 1.0, z: 1.0 } // Platform box extents = 1.0x1.0x1.0 (for a 2x2x2 box)
    );
    platformRigidBody.setKinematic(true); // Kinematic - won't move
    platform.addComponent(platformRigidBody);
    scene.addGameObject(platform);

    // CENTER TOP: 2x2 Ball Array falling from above (reduced for better stability)
    const fallBalls = [];
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const ball = new GameObject(`fall-ball-${row}-${col}`, `FallBall${row}${col}`);
            const x = -2 + col * 2;  // Spread across platform
            // Add pseudo-random height variation based on position (deterministic but varied)
            const heightVariation = ((row * 3 + col) % 5) * 0.4 - 0.8; // -0.8 to +0.8 range
            const y = 3 + row * 1.5 + heightVariation; // Stacked vertically with height variation
            const z = -2 + row * 2;  // Some depth variation
            ball.transform.setPosition(x, y, z);

            // Color gradient: purple to pink
            const hue = 0.8 + (row + col) * 0.05;
            const ballMeshRenderer = new MeshRenderer(SPHERE_MESH,
                new Material(`fall-ball-${row}-${col}`, { r: hue, g: 0.2, b: 1.0, a: 1.0 }));
            ball.addComponent(ballMeshRenderer);

            const ballRigidBody = new RigidBody(
                1.0,        // mass: 1kg
                true,       // useGravity: true
                CollisionShape.SPHERE,   // collisionShape: sphere
                { x: 1.0, y: 1.0, z: 1.0 } // Sphere radius = 1.0 (standard unit sphere, scale handled by transform)
            );
            ball.addComponent(ballRigidBody);
            scene.addGameObject(ball);
            fallBalls.push(ball);
        }
    }

    return scene;
}

function setupInputControls(scene: Scene): void {
    const cameraModeBtn = document.getElementById('cameraModeBtn');
    const orbitModeBtn = document.getElementById('orbitModeBtn');
    const resetCameraBtn = document.getElementById('resetCameraBtn');
    const addBallBtn = document.getElementById('addBallBtn');
    const controlHints = document.getElementById('controlHints');
    const verticalHints = document.getElementById('verticalHints');

    let ballCounter = 0;

    // Update UI based on input target
    function updateUI(target: 'camera' | 'orbit') {
        // Update button states
        cameraModeBtn?.classList.toggle('active', target === 'camera');
        orbitModeBtn?.classList.toggle('active', target === 'orbit');

        // Update control hints
        if (target === 'camera') {
            if (controlHints) controlHints.textContent = 'Move camera around';
            if (verticalHints) verticalHints.textContent = 'Move up/down';
        } else if (target === 'orbit') {
            if (controlHints) controlHints.textContent = 'Orbit around center';
            if (verticalHints) verticalHints.textContent = 'Zoom in/out';
        }
    }

    // Camera mode button
    cameraModeBtn?.addEventListener('click', () => {
        scene.setInputTarget('camera');
        updateUI('camera');
        console.log('🎮 Switched to free camera mode');
    });

    // Orbit mode button
    orbitModeBtn?.addEventListener('click', () => {
        scene.setInputTarget('orbit');
        updateUI('orbit');
        console.log('🎮 Switched to orbit camera mode');
    });

    // Reset camera button
    resetCameraBtn?.addEventListener('click', () => {
        scene.camera.setPosition([0, 5, -25]);
        scene.camera.lookAt([0, 0, 0]);
        console.log('📷 Camera reset to default position');
    });

    // Add ball button
    addBallBtn?.addEventListener('click', () => {
        ballCounter++;
        const newBall = new GameObject(`dynamic-ball-${ballCounter}`, `DynamicBall${ballCounter}`);

        // Add some randomness to position
        const x = (Math.random() - 0.5) * 20; // -10 to 10
        const y = 5 + Math.random() * 5;       // 5 to 10
        const z = (Math.random() - 0.5) * 10; // -5 to 5

        newBall.transform.setPosition(x, y, z);
        newBall.transform.setScale(1, 1, 1);

        // Random color
        const ballMeshRenderer = new MeshRenderer(SPHERE_MESH, new Material(`dynamic-ball-${ballCounter}`, {
            r: Math.random(),
            g: Math.random(),
            b: Math.random(),
            a: 1.0
        }));
        newBall.addComponent(ballMeshRenderer);

        const ballRigidBody = new RigidBody(
            1.0 + Math.random() * 2, // Mass 1-3kg
            true,       // useGravity
            CollisionShape.SPHERE,
            { x: 1.0, y: 1.0, z: 1.0 }
        );
        newBall.addComponent(ballRigidBody);

        scene.addGameObject(newBall);
        console.log(`🎾 Added dynamic ball at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
    });

    // Initialize UI
    updateUI('camera');

    // Listen for input target changes from the scene
    window.addEventListener('inputTargetChanged', (event: any) => {
        const target = event.detail.target;
        if (target === 'camera' || target === 'orbit') {
            updateUI(target);
        }
    });
}

async function buildScene(): Promise<Scene> {
    const scene = new Scene();

    await createFancyPhysicsDemo(scene); // Full fancy physics demo

    // Position camera for good view of the full action
    scene.camera.setPosition([0, 5, -25]); // Pull back and up more for full demo overview
    scene.camera.lookAt([0, 0, 0]); // Look at the center of all the action

    return scene;
}

async function initFancyPhysicsScene(): Promise<void> {
    try {
        const engine = new Engine('canvas');
        await engine.init();               // WebGPU + WASM
        const scene = await buildScene();  // pure data
        await engine.loadScene(scene);     // mount: upload meshes, register entities (fail-loud)
        engine.start(scene);               // input > physics > update > render

        // Expose for console debugging.
        (window as any).engine = engine;
        (window as any).scene = scene;

        // Initialize input system for camera control
        scene.setInputTarget('camera');
        console.log('🎮 Input system initialized - WASD camera controls active');

        // Set up input control UI
        setupInputControls(scene);

        // Log scene statistics
        const sceneInfo = scene.getSceneInfo();
        console.log('📊 Fancy Physics Scene Info:', sceneInfo);

        // Track running state so the play/pause UI stays in sync with the engine loop.
        let isRunning = true;

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

        // Pause/resume functions that drive the engine loop and update UI
        (window as any).pauseEngine = () => {
            console.log('⏸️ Fancy Physics Engine paused');
            engine.stop();
            isRunning = false;
            updateUI();
        };

        (window as any).resumeEngine = () => {
            console.log('▶️ Fancy Physics Engine resumed');
            if (!isRunning) {
                engine.start(scene);
                isRunning = true;
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

        console.log('🎮 Fancy physics scene running');

    } catch (error) {
        console.error('❌ Failed to initialize fancy physics scene:', error);
    }
}

// Initialize when page loads
initFancyPhysicsScene().catch(console.error);
