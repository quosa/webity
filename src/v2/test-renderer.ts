import { WebGPURendererV2 } from './webgpu.renderer';
import { Camera } from './camera';
import { createCubeMesh, createTriangleMesh, createGridMesh } from './mesh-utils';
import { Scene } from './scene-system';
import { GameObject } from './gameobject';
import { CameraComponent, MeshRenderer } from './components';

declare global {
    // eslint-disable-next-line no-unused-vars
    interface Window {
        // eslint-disable-next-line no-unused-vars
        runRenderingTest: (testName: string) => Promise<void>;
    }
}

// Expose a global function for Playwright to call
window.runRenderingTest = async function (testName: string) {
    const canvas = document.getElementById('test-canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas not found');

    if (!navigator.gpu) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = 'WebGPU is not supported in this browser';
            errorDiv.style.display = 'block';
        }
        throw new Error('WebGPU is not supported');
    }

    const camera = new Camera([0, 0, -10], [0, 0, 0]);
    const renderer = new WebGPURendererV2();
    await renderer.init(canvas);

    const aspect = canvas.width / canvas.height;
    const viewProjectionMatrix = camera.getViewProjectionMatrix(aspect);
    renderer.setViewProjectionMatrix(viewProjectionMatrix);

    // Register meshes
    renderer.registerMesh('triangle', createTriangleMesh());
    renderer.registerMesh('cube', createCubeMesh(2));
    renderer.registerMesh('floor', createGridMesh(20, 20));

    // Add entities based on testName
    if (testName === 'triangle') {
        renderer.addEntity({
            id: 'triangle1',
            meshId: 'triangle',
            transform: {
                position: [0, 0, 5],
                rotation: [0, 0, 0],
                scale: [3, 3, 3] // triangle mesh was downsized to 0.5 units from 1.5
            },
            color: [1, 0, 0, 1], // Red
            renderMode: 'triangles'
        });
    } else if (testName === 'cubes') {
        renderer.addEntity({
            id: 'cube1',
            meshId: 'cube',
            transform: {
                position: [-3, 0, 5],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
            },
            color: [0, 1, 0, 1], // Green
            renderMode: 'triangles'
        });
        renderer.addEntity({
            id: 'cube2',
            meshId: 'cube',
            transform: {
                position: [3, 0, 5],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
            },
            color: [0, 0, 1, 1], // Blue
            renderMode: 'triangles'
        });
    } else if (testName === 'camera-controls') {
        // Camera controls validation using new v2 Scene system
        await setupCameraControlsTest(canvas, renderer);
        return; // Skip the standard render() call
    }

    // Always add the floor
    renderer.addEntity({
        id: 'floor',
        meshId: 'floor',
        transform: {
            position: [0, -2, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
        },
        color: [0.2, 0.8, 0.2, 1],
        renderMode: 'lines'
    });

    renderer.render();
};

// Camera controls test setup function
async function setupCameraControlsTest(_canvas: HTMLCanvasElement, renderer: WebGPURendererV2): Promise<void> {
    console.log('🎥 Setting up camera controls validation test...');
    
    // Register meshes for the scene
    renderer.registerMesh('cube', createCubeMesh(1));
    renderer.registerMesh('grid', createGridMesh(20, 20));
    
    // Create Scene with v2 system
    const scene = new Scene();
    await scene.init(renderer);
    
    // Create floor grid
    const floor = GameObject.createGrid('test-floor', { x: 0, y: -3, z: 0 });
    scene.addGameObject(floor);
    
    // Create reference cubes for spatial awareness
    const positions = [
        { x: -5, y: 2, z: -5, color: { x: 0, y: 1, z: 0, w: 1 } }, // Green
        { x: 5, y: 2, z: -5, color: { x: 0, y: 0, z: 1, w: 1 } },  // Blue
        { x: -5, y: 2, z: 5, color: { x: 1, y: 1, z: 0, w: 1 } },  // Yellow
        { x: 5, y: 2, z: 5, color: { x: 1, y: 0, z: 1, w: 1 } }    // Magenta
    ];
    
    positions.forEach((pos, index) => {
        const cube = new GameObject(`ref-cube-${index}`, `RefCube${index}`);
        cube.transform.setPosition(pos.x, pos.y, pos.z);
        cube.transform.setScale(0.7, 0.7, 0.7);
        
        const meshRenderer = new MeshRenderer('cube', 'default', 'triangles', pos.color);
        cube.addComponent(meshRenderer);
        scene.addGameObject(cube);
    });
    
    // Add center reference cube (red, rotating)
    const centerCube = new GameObject('center-cube', 'CenterReference');
    centerCube.transform.setPosition(0, 0, 0);
    const centerMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 });
    centerCube.addComponent(centerMeshRenderer);
    scene.addGameObject(centerCube);
    
    // Create camera GameObject with CameraComponent
    const cameraGameObject = new GameObject('test-camera', 'TestCamera');
    cameraGameObject.transform.setPosition(-8, 3, -8);
    
    const cameraComponent = new CameraComponent(true, Math.PI / 3, 0.1, 100);
    cameraGameObject.addComponent(cameraComponent);
    scene.addGameObject(cameraGameObject);
    
    // Set initial camera position for good view of the scene
    scene.camera.setPosition([0, 8, -15]);
    scene.camera.lookAt([0, 1, 0]);
    
    // Test camera movement to demonstrate functionality
    scene.camera.move(1, 0, 0); // Move forward slightly
    scene.camera.orbitAroundTarget(0.1, 0); // Slight orbit for dynamic view
    
    // Start the scene
    scene.start();
    
    // Render the scene multiple times to ensure stable output
    for (let i = 0; i < 5; i++) {
        scene.update(1/60);
    }
    
    console.log('✅ Camera controls test setup complete');
    console.log(`📊 Scene entities: ${scene.getEntityCount()}`);
    
    // Export for debugging (if needed)
    if (typeof window !== 'undefined') {
        (window as any).cameraControlsScene = scene;
        (window as any).cameraComponent = cameraComponent;
    }
}
