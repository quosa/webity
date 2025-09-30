// src/scenes/stack-test/box-sphere-scene.ts
// Isolated box-sphere collision test

import { Scene } from '../../engine/scene-system.js';
import { GameObject } from '../../engine/gameobject.js';
import { MeshRenderer, RigidBody, CollisionShape } from '../../engine/components.js';
import { WebGPURendererV2 } from '../../renderer/webgpu.renderer.js';
import { createSphereMesh, createGridMesh, createCubeMesh } from '../../renderer/mesh-utils.js';

let scene: Scene | undefined;
let renderer: WebGPURendererV2 | undefined;
let sphere: GameObject | undefined;
let box: GameObject | undefined;
let isPaused = false;

function createBoxSphereTestScene(scene: Scene): void {
    console.log('📦🏀 Creating isolated box-sphere collision test...');

    // Create stationary box in center using helper method
    box = GameObject.createCube('TestBox', { x: 0, y: -7, z: 0 });
    box.transform.setScale(2, 2, 2);

    // Override color to blue-ish
    const boxMeshRenderer = box.getComponent(MeshRenderer);
    if (boxMeshRenderer) {
        boxMeshRenderer.color = { x: 0.5, y: 0.5, z: 0.8, w: 1 }; // Blue-ish
    }

    // BOX: Kinematic (stationary) for clean testing
    const boxRigidBody = new RigidBody(
        10.0,                     // mass: heavy
        false,                    // useGravity: false (stationary)
        CollisionShape.BOX,       // collisionShape: box
        { x: 1.0, y: 1.0, z: 1.0 } // extents: half-extents
    );
    boxRigidBody.setKinematic(true); // Make it kinematic (stationary)

    box.addComponent(boxRigidBody);
    scene.addGameObject(box);
    console.log('📦 Added stationary box at Y=-6');

    // Create sphere above box
    createSphere(scene, 0); // Start at center position
}

function createSphere(scene: Scene, xOffset: number = 0): void {
    // Remove existing sphere if any
    if (sphere) {
        scene.removeGameObject(sphere.id);
    }

    sphere = GameObject.createSphere('TestSphere', { x: xOffset, y: 2, z: 0 });
    sphere.transform.setScale(1, 1, 1);

    // Override color to magenta
    const sphereMeshRenderer = sphere.getComponent(MeshRenderer);
    if (sphereMeshRenderer) {
        sphereMeshRenderer.color = { x: 1, y: 0.3, z: 0.7, w: 1 }; // Magenta
    }

    // SPHERE: Dynamic physics
    const sphereRigidBody = new RigidBody(
        1.0,                      // mass: 1kg
        true,                     // useGravity: true
        CollisionShape.SPHERE,    // collisionShape: sphere
        { x: 0.8, y: 0.8, z: 0.8 } // extents: radius
    );

    sphere.addComponent(sphereRigidBody);
    scene.addGameObject(sphere);
    console.log(`🏀 Added sphere at X=${xOffset}, Y=2 (will drop onto box)`);
}

function createFloorGrid(scene: Scene): void {
    // Create static floor grid (no RigidBody = static)
    const floor = GameObject.createGrid('FloorGrid', { x: 0, y: -8.01, z: 0 });
    // floor.transform.setScale(8, 1, 8);

    // Make the grid gray instead of bright yellow for better visibility
    const floorMeshRenderer = floor.getComponent(MeshRenderer);
    if (floorMeshRenderer) {
        floorMeshRenderer.color = { x: 0.3, y: 0.3, z: 0.3, w: 1.0 }; // Gray
    }

    scene.addGameObject(floor);
    console.log('🌐 Added visual floor grid');
}

async function initializeScene(): Promise<void> {
    if (!renderer) {
        console.error('Renderer not initialized');
        return;
    }

    // Register required meshes with renderer
    renderer.registerMesh('cube', createCubeMesh(1));
    renderer.registerMesh('sphere', createSphereMesh(1.0, 16));
    renderer.registerMesh('grid', createGridMesh(20, 20));

    // Create new scene
    scene = new Scene();
    await scene.init(renderer);

    // Configure camera for box-sphere test view
    scene.camera.setPosition([0, -4, -10]);
    scene.camera.setTarget([0, -6, 0]);

    // Create scene objects
    createFloorGrid(scene);
    createBoxSphereTestScene(scene);

    // Initialize scene systems
    await scene.awake();

    console.log('✅ Box-sphere test scene initialized');
}

function resetScene(): void {
    if (!scene) return;

    console.log('🔄 Resetting box-sphere test...');

    // Remove all GameObjects
    const entities = scene.getAllGameObjects();
    entities.forEach(entity => {
        scene!.removeGameObject(entity.id);
    });

    // Recreate scene objects
    createFloorGrid(scene);
    createBoxSphereTestScene(scene);
}

function dropSphere(): void {
    if (!scene || !sphere) return;

    console.log('⬇️ Dropping sphere...');

    // Reset sphere position and velocity
    sphere.transform.setPosition(sphere.transform.position.x, 2, 0);

    const rigidBody = sphere.getComponent(RigidBody);
    if (rigidBody) {
        // Clear any existing velocity
        rigidBody.velocity.x = 0;
        rigidBody.velocity.y = 0;
        rigidBody.velocity.z = 0;
    }
}

function moveSphere(xOffset: number): void {
    if (!scene || !sphere) return;

    console.log(`🎯 Moving sphere to X=${xOffset}`);
    sphere.transform.setPosition(xOffset, 2, 0);

    const rigidBody = sphere.getComponent(RigidBody);
    if (rigidBody) {
        rigidBody.velocity.x = 0;
        rigidBody.velocity.y = 0;
        rigidBody.velocity.z = 0;
    }
}

function togglePause(): void {
    isPaused = !isPaused;

    if (isPaused) {
        console.log('⏸️ Physics paused');
    } else {
        console.log('▶️ Physics resumed');
    }
}

async function main(): Promise<void> {
    console.log('🚀 Starting box-sphere collision test...');

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        // Initialize renderer
        renderer = new WebGPURendererV2();
        await renderer.init(canvas);

        // Setup UI controls
        const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
        const dropBtn = document.getElementById('dropBtn') as HTMLButtonElement;
        const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
        const leftBtn = document.getElementById('leftBtn') as HTMLButtonElement;
        const centerBtn = document.getElementById('centerBtn') as HTMLButtonElement;
        const rightBtn = document.getElementById('rightBtn') as HTMLButtonElement;

        resetBtn.addEventListener('click', resetScene);
        dropBtn.addEventListener('click', dropSphere);
        pauseBtn.addEventListener('click', togglePause);
        leftBtn.addEventListener('click', () => moveSphere(-2));
        centerBtn.addEventListener('click', () => moveSphere(0));
        rightBtn.addEventListener('click', () => moveSphere(2));

        // Initialize and start scene
        await initializeScene();

        if (scene) {
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

                if (isRunning && !isPaused) {
                    // Update scene
                    scene?.update(deltaTime);
                }

                // Update FPS counter
                frameCount++;
                if (currentTime - lastFpsTime >= 1000) {
                    // Update FPS display if element exists
                    const fpsElement = document.getElementById('fps');
                    if (fpsElement) fpsElement.textContent = frameCount.toString();

                    frameCount = 0;
                    lastFpsTime = currentTime;
                }

                animationId = requestAnimationFrame(gameLoop);
            };

            // Engine control functions
            (window as any).pauseEngine = () => {
                console.log('⏸️ Box-sphere engine paused');
                isRunning = false;
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            };

            (window as any).resumeEngine = () => {
                console.log('▶️ Box-sphere engine resumed');
                if (!isRunning) {
                    isRunning = true;
                    lastTime = performance.now(); // Reset time to avoid large delta
                    animationId = requestAnimationFrame(gameLoop);
                }
            };

            // Enhanced pause functionality for button updates
            const enhancedTogglePause = () => {
                togglePause();

                // Update pause button text
                const pauseButton = document.getElementById('pauseBtn') as HTMLButtonElement;
                if (pauseButton) {
                    if (isPaused) {
                        pauseButton.textContent = '▶️ Resume Physics';
                    } else {
                        pauseButton.textContent = '⏸️ Pause Physics';
                    }
                }
            };

            // Update the button event listener to use enhanced version
            pauseBtn.removeEventListener('click', togglePause);
            pauseBtn.addEventListener('click', enhancedTogglePause);

            // Start the game loop
            animationId = requestAnimationFrame(gameLoop);
            console.log('✅ Box-sphere test scene started with game loop');
        }

    } catch (error) {
        console.error('❌ Error in box-sphere test scene:', error);
    }
}

main().catch(console.error);
