// src/v2/test-camera-controls.ts
// Test scene demonstrating Phase 4 camera integration and controls

import { Scene } from './scene-system';
import { GameObject } from './gameobject';
import { MeshRenderer, RotatorComponent, CameraComponent } from './components';
import { WebGPURendererV2 } from './webgpu.renderer';
import { createCubeMesh, createTriangleMesh, createGridMesh, createSphereMesh } from './mesh-utils';

async function createCameraTestScene(scene: Scene): Promise<Scene> {

    console.log('🎥 Creating Camera Controls Test Scene (Phase 4)...');

    // Create floor grid (static reference)
    const floor = GameObject.createGrid('CameraTestFloor', { x: 0, y: -3, z: 0 });
    scene.addGameObject(floor);
    console.log('📐 Added floor grid for camera reference');

    // Create reference objects at different positions to help visualize camera movement

    // Center cube (red) - main reference point
    const centerCube = new GameObject('center-cube', 'CenterReference');
    centerCube.transform.setPosition(0, 0, 0);
    centerCube.transform.setScale(1, 1, 1);

    const centerMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 }); // Red
    centerCube.addComponent(centerMeshRenderer);

    // Slow rotation for visual reference
    const centerRotator = new RotatorComponent(0, 10, 0); // 10 deg/sec around Y axis
    centerCube.addComponent(centerRotator);

    scene.addGameObject(centerCube);
    console.log('📦 Added center reference cube (red)');

    // Surrounding cubes to create a spatial reference grid
    const positions = [
        { x: -5, y: 2, z: -5, color: { x: 0, y: 1, z: 0, w: 1 } }, // Green
        { x: 5, y: 2, z: -5, color: { x: 0, y: 0, z: 1, w: 1 } },  // Blue
        { x: -5, y: 2, z: 5, color: { x: 1, y: 1, z: 0, w: 1 } },  // Yellow
        { x: 5, y: 2, z: 5, color: { x: 1, y: 0, z: 1, w: 1 } },   // Magenta
        { x: 0, y: 5, z: 0, color: { x: 0, y: 1, z: 1, w: 1 } },   // Cyan (top)
    ];

    positions.forEach((pos, index) => {
        const cube = new GameObject(`reference-cube-${index}`, `ReferencePoint${index}`);
        cube.transform.setPosition(pos.x, pos.y, pos.z);
        cube.transform.setScale(0.7, 0.7, 0.7); // Slightly smaller

        const meshRenderer = new MeshRenderer('cube', 'default', 'triangles', pos.color);
        cube.addComponent(meshRenderer);

        // Each cube rotates at a different speed for visual interest
        const rotator = new RotatorComponent(5 + index * 2, 8 + index * 3, 3 + index);
        cube.addComponent(rotator);

        scene.addGameObject(cube);
    });
    console.log('🎨 Added 5 reference cubes for spatial orientation');

    // Create a camera GameObject to demonstrate CameraComponent
    const cameraObject = new GameObject('camera-gameobject', 'CameraController');
    cameraObject.transform.setPosition(-8, 3, -8);

    // Add camera component (not active by default)
    const cameraComponent = new CameraComponent(true, Math.PI / 3, 0.1, 100);
    cameraObject.addComponent(cameraComponent);

    scene.addGameObject(cameraObject);
    console.log('📷 Added camera GameObject with CameraComponent');

    // Test different camera methods
    console.log('🎯 Testing camera control methods...');

    // Test 1: Initial camera positioning
    scene.camera.setPosition([0, 8, -15]);
    scene.camera.lookAt([0, 1, 0]); // Look slightly above center
    console.log('✅ Set initial camera position and target');

    console.log(`🎥 Camera test scene created with ${scene.getEntityCount()} entities`);
    return scene;
}

// Local createSphereMesh function removed - now using proper implementation from mesh-utils.ts

async function main() {
    console.log('🚀 Camera Controls Test starting (Phase 4)...');
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

        // Create camera test scene
        const scene = new Scene();
        await scene.init(renderer);

        await createCameraTestScene(scene);
        scene.start();

        // Export scene to window for HTML access
        (window as any).scene = scene;
        (window as any).cameraTestScene = scene;

        console.log('✅ Camera test scene initialized successfully');

        // Log initial camera state
        const position = scene.camera.getPosition();
        const target = scene.camera.getTarget();
        console.log(`📷 Initial camera position: (${position[0]}, ${position[1]}, ${position[2]})`);
        console.log(`🎯 Initial camera target: (${target[0]}, ${target[1]}, ${target[2]})`);

        // Animation loop with frame rate monitoring
        let lastTime = performance.now();
        let frameCount = 0;
        let lastFpsTime = 0;

        const gameLoop = (currentTime: number) => {
            const rawDeltaTime = (currentTime - lastTime) / 1000;
            const deltaTime = Math.min(rawDeltaTime, 1/30); // Cap at 30fps
            lastTime = currentTime;

            // Update scene
            scene.update(deltaTime);

            // Update FPS counter
            frameCount++;
            if (currentTime - lastFpsTime >= 1000) {
                console.log(`📊 FPS: ${frameCount}`);
                frameCount = 0;
                lastFpsTime = currentTime;
            }

            requestAnimationFrame(gameLoop);
        };

        // Start the game loop
        requestAnimationFrame(gameLoop);

        // Test camera component functionality
        setTimeout(() => {
            console.log('🧪 Testing CameraComponent activation...');
            const cameraGameObject = scene.getGameObject('camera-gameobject');
            if (cameraGameObject) {
                const cameraComponent = cameraGameObject.getComponent(CameraComponent);
                if (cameraComponent) {
                    // This would activate the camera component (for future testing)
                    // cameraComponent.setAsActiveCamera();
                    console.log('📷 CameraComponent found and ready for testing');
                }
            }
        }, 3000);

    } catch (error) {
        console.error('❌ Error in camera controls test:', error);
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            errorDiv.style.display = 'block';
        }
    }
}

// Export for browser testing
(window as any).createCameraTestScene = createCameraTestScene;
(window as any).runCameraControlsTest = main;

main();
