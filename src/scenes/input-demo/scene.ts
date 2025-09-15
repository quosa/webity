// src/scenes/input-demo/scene.ts
// Comprehensive input system demonstration scene

import { Scene } from '../../engine/scene-system.js';
import { GameObject } from '../../engine/gameobject.js';
import { MeshRenderer, RigidBody } from '../../engine/components.js';
import { WebGPURendererV2 } from '../../renderer/webgpu.renderer.js';
import { createCubeMesh, createSphereMesh, createGridMesh } from '../../renderer/mesh-utils.js';

let scene: Scene | undefined;
let playerBall: GameObject;
let controlCube: GameObject;
let ballCounter = 0;

function addGameObjectsToScene(scene: Scene): void {
    console.log('🎮 Adding GameObjects to Input System Demo Scene...');

    // Create floor grid for spatial reference
    const floor = new GameObject('floor', 'Floor');
    floor.transform.setPosition(0, -8, 0);

    const floorMeshRenderer = new MeshRenderer('grid', 'default', 'lines', { x: 0.4, y: 0.4, z: 0.4, w: 1 }); // Dark gray
    floor.addComponent(floorMeshRenderer);

    scene.addGameObject(floor);
    console.log('📐 Added floor grid');

    // Create player-controllable ball
    playerBall = new GameObject('player-ball', 'PlayerBall');
    playerBall.transform.setPosition(0, 2, 0);
    playerBall.transform.setScale(1, 1, 1);

    const playerMeshRenderer = new MeshRenderer('sphere', 'default', 'triangles', { x: 0, y: 1, z: 0, w: 1 }); // Green
    playerBall.addComponent(playerMeshRenderer);

    const playerRigidBody = new RigidBody(1.0, false); // Dynamic physics
    playerBall.addComponent(playerRigidBody);

    scene.addGameObject(playerBall);
    console.log('🟢 Added controllable player ball');

    // Create controllable cube
    controlCube = new GameObject('control-cube', 'ControlCube');
    controlCube.transform.setPosition(3, 1, 0);
    controlCube.transform.setScale(1, 1, 1);

    const cubeMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 1, y: 0.5, z: 0, w: 1 }); // Orange
    controlCube.addComponent(cubeMeshRenderer);

    const cubeRigidBody = new RigidBody(1.5, false); // Heavier than ball
    controlCube.addComponent(cubeRigidBody);

    scene.addGameObject(controlCube);
    console.log('🟠 Added controllable cube');

    // Create some static reference objects
    const positions = [
        { x: -5, y: 1, z: -5, color: { x: 0.5, y: 0.5, z: 1, w: 1 } }, // Light blue
        { x: 5, y: 1, z: -5, color: { x: 1, y: 0.5, z: 0.5, w: 1 } },  // Light red
        { x: -5, y: 1, z: 5, color: { x: 0.5, y: 1, z: 0.5, w: 1 } },  // Light green
        { x: 5, y: 1, z: 5, color: { x: 1, y: 1, z: 0.5, w: 1 } },    // Light yellow
    ];

    positions.forEach((pos, index) => {
        const marker = new GameObject(`marker-${index}`, `Marker${index}`);
        marker.transform.setPosition(pos.x, pos.y, pos.z);
        marker.transform.setScale(0.5, 0.5, 0.5);

        const markerMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', pos.color);
        marker.addComponent(markerMeshRenderer);

        // Static markers (no RigidBody)
        scene.addGameObject(marker);
    });
    console.log('🎯 Added reference markers');

    // Set initial camera position
    scene.camera.setPosition([0, 8, -15]);
    scene.camera.lookAt([0, 0, 0]);

    console.log(`🎮 Input demo scene setup complete with ${scene.getEntityCount()} entities`);
}

// Global functions for HTML interface
(window as any).setInputTarget = (target: string) => {
    if (!scene) return;

    const buttons = ['btn-camera', 'btn-orbit', 'btn-player', 'btn-cube', 'btn-none'];
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });

    let targetName = '';
    let controllerType = '';
    let hints = '';

    switch (target) {
    case 'camera':
        scene.setInputTarget('camera');
        targetName = 'Free Camera';
        controllerType = 'CameraController';
        hints = '<p><strong>WASD:</strong> Move camera</p><p><strong>Space:</strong> Move up</p><p><strong>-:</strong> Move down</p>';
        document.getElementById('btn-camera')?.classList.add('active');
        break;

    case 'orbit':
        scene.setInputTarget('orbit');
        targetName = 'Orbit Camera';
        controllerType = 'OrbitCameraController';
        hints = '<p><strong>WASD:</strong> Orbit around center</p><p><strong>Space:</strong> Zoom in</p><p><strong>-:</strong> Zoom out</p>';
        document.getElementById('btn-orbit')?.classList.add('active');
        break;

    case 'player':
        scene.setInputTarget(playerBall);
        targetName = 'Player Ball';
        controllerType = 'GameObjectController';
        hints = '<p><strong>WASD:</strong> Apply forces</p><p><strong>Space:</strong> Jump force</p><p><strong>-:</strong> Downward force</p>';
        document.getElementById('btn-player')?.classList.add('active');
        break;

    case 'cube':
        scene.setInputTarget(controlCube);
        targetName = 'Control Cube';
        controllerType = 'GameObjectController';
        hints = '<p><strong>WASD:</strong> Apply forces</p><p><strong>Space:</strong> Jump force</p><p><strong>-:</strong> Downward force</p>';
        document.getElementById('btn-cube')?.classList.add('active');
        break;

    case 'none':
        scene.setInputTarget(null);
        targetName = 'None';
        controllerType = 'No Controller';
        hints = '<p>No input controller active</p>';
        document.getElementById('btn-none')?.classList.add('active');
        break;
    }

    updateUI(targetName, controllerType, hints);
};

(window as any).resetScene = () => {
    if (!scene) return;

    // Reset player ball
    playerBall.transform.setPosition(0, 2, 0);
    const playerRigidBody = playerBall.getComponent(RigidBody);
    const playerEntityId = playerRigidBody?.getWasmEntityId();
    if (playerEntityId !== undefined) {
        scene.physicsBridge.setEntityVelocity(playerEntityId, { x: 0, y: 0, z: 0 });
        scene.physicsBridge.setEntityPosition(playerEntityId, { x: 0, y: 2, z: 0 });
    }

    // Reset cube
    controlCube.transform.setPosition(3, 1, 0);
    const cubeRigidBody = controlCube.getComponent(RigidBody);
    const cubeEntityId = cubeRigidBody?.getWasmEntityId();
    if (cubeEntityId !== undefined) {
        scene.physicsBridge.setEntityVelocity(cubeEntityId, { x: 0, y: 0, z: 0 });
        scene.physicsBridge.setEntityPosition(cubeEntityId, { x: 3, y: 1, z: 0 });
    }

    // Reset camera
    scene.camera.setPosition([0, 8, -15]);
    scene.camera.lookAt([0, 0, 0]);

    console.log('🔄 Scene reset');
};

(window as any).addRandomBall = () => {
    if (!scene) return;

    const randomBall = new GameObject(`random-ball-${ballCounter++}`, 'RandomBall');
    randomBall.transform.setPosition(
        (Math.random() - 0.5) * 8,
        Math.random() * 5 + 3,
        (Math.random() - 0.5) * 8
    );

    const meshRenderer = new MeshRenderer('sphere', 'default', 'triangles', {
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        w: 1
    });
    randomBall.addComponent(meshRenderer);

    const rigidBody = new RigidBody(0.5 + Math.random(), false);
    randomBall.addComponent(rigidBody);

    scene.addGameObject(randomBall);
    console.log('🎾 Added random ball');
};

(window as any).clearObjects = () => {
    if (!scene) return;

    // Remove all GameObjects except floor, player, cube, and markers
    const entities = scene.getAllGameObjects();
    entities.forEach(entity => {
        if (entity.name !== 'Floor' &&
            entity !== playerBall &&
            entity !== controlCube &&
            !entity.name.startsWith('marker')) {
            scene?.removeGameObject(entity.id);
        }
    });

    console.log('🧹 Cleared random objects');
};

(window as any).setCameraPreset = (preset: string) => {
    if (!scene) return;

    switch (preset) {
    case 'overhead':
        // Position camera above the scene, slightly offset to avoid looking straight down
        scene.camera.setPosition([0.1, 10, 0.1]);
        scene.camera.lookAt([0, 0, 0]);
        break;
    case 'side':
        scene.camera.setPosition([15, 5, 0]);
        scene.camera.lookAt([0, 0, 0]);
        break;
    case 'corner':
        scene.camera.setPosition([10, 8, -10]);
        scene.camera.lookAt([0, 0, 0]);
        break;
    }

    console.log(`📷 Set camera preset: ${preset}`);
};

function updateUI(targetName: string, controllerType: string, hints: string) {
    const targetElement = document.getElementById('input-target');
    const typeElement = document.getElementById('controller-type');
    const hintsElement = document.getElementById('control-hints');

    if (targetElement) targetElement.textContent = targetName;
    if (typeElement) typeElement.textContent = controllerType;
    if (hintsElement) hintsElement.innerHTML = hints;
}

function updateStatus() {
    if (!scene) return;

    // Update camera position
    const position = scene.camera.getPosition();
    const posElement = document.getElementById('camera-pos');
    if (posElement) {
        posElement.textContent = `(${position[0].toFixed(1)}, ${position[1].toFixed(1)}, ${position[2].toFixed(1)})`;
    }

    // Update object count
    const countElement = document.getElementById('object-count');
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
    console.log('🚀 Input System Demo starting...');
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;

    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        // Initialize renderer
        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);

        // Register all required meshes
        renderer.registerMesh('sphere', createSphereMesh(1.0, 16));
        renderer.registerMesh('cube', createCubeMesh(1));
        renderer.registerMesh('grid', createGridMesh(20, 20));

        // Create, initialize, and populate scene
        scene = new Scene();
        await scene.init(renderer);

        // Add GameObjects after scene is initialized with renderer
        addGameObjectsToScene(scene);

        scene.start();

        // Set initial input target (after scene is assigned)
        (window as any).setInputTarget('camera');

        console.log('✅ Input demo scene initialized successfully');

        // Animation loop with status updates
        let lastTime = performance.now();
        let frameCount = 0;
        let lastFpsTime = 0;

        const gameLoop = (currentTime: number) => {
            const rawDeltaTime = (currentTime - lastTime) / 1000;
            const deltaTime = Math.min(rawDeltaTime, 1/30); // Cap at 30fps
            lastTime = currentTime;

            // Update scene
            scene?.update(deltaTime);

            // Update FPS counter and status
            frameCount++;
            if (currentTime - lastFpsTime >= 1000) {
                const fpsElement = document.getElementById('fps');
                if (fpsElement) fpsElement.textContent = frameCount.toString();

                updateStatus();

                frameCount = 0;
                lastFpsTime = currentTime;
            }

            requestAnimationFrame(gameLoop);
        };

        // Start the game loop
        requestAnimationFrame(gameLoop);

        // Listen for input target changes
        window.addEventListener('inputTargetChanged', (event: any) => {
            console.log('🎮 Input target changed:', event.detail);
        });

    } catch (error) {
        console.error('❌ Error in input demo:', error);
        showError(error instanceof Error ? error.message : String(error));
    }
}

// Export for browser testing
(window as any).inputDemoScene = scene;

main();