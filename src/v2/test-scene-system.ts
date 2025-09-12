// src/v2/test-scene-system.ts
// Test scene demonstrating the new Scene/GameObject system

import { Scene } from './scene-system';
import { GameObject } from './gameobject';
import { MeshRenderer, RotatorComponent } from './components';
import { WebGPURendererV2 } from './webgpu.renderer';
import { createCubeMesh, createTriangleMesh, createGridMesh, createSphereMesh } from './mesh-utils';

async function createTestScene(): Promise<Scene> {
    const scene = new Scene();
    
    // Create floor grid (static)
    const floor = GameObject.createGrid('Floor', { x: 0, y: -2, z: 0 });
    scene.addGameObject(floor);
    
    // Create rotating triangle (center)
    const triangle = new GameObject('rotating-triangle');
    triangle.transform.setPosition(0, 0, -5);
    triangle.transform.setScale(2, 2, 2);
    
    const triangleMeshRenderer = new MeshRenderer('triangle', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 }); // Red
    triangle.addComponent(triangleMeshRenderer);
    
    // Add rotation component for testing (extremely slow speeds in degrees/sec)
    const triangleRotator = new RotatorComponent(0, 6, 0); // 6 deg/sec around Y axis (1 minute per full rotation)
    triangle.addComponent(triangleRotator);
    
    scene.addGameObject(triangle);
    
    // Create rotating cubes (left and right)
    const leftCube = GameObject.createCube('LeftCube', { x: -3, y: 0, z: -5 });
    const leftMeshRenderer = leftCube.getMeshRenderer()!;
    leftMeshRenderer.setColor(0, 1, 0, 1); // Green
    
    const leftRotator = new RotatorComponent(4, 0, 0); // 4 deg/sec around X axis (1.5 minutes per full rotation)
    leftCube.addComponent(leftRotator);
    
    scene.addGameObject(leftCube);
    
    const rightCube = GameObject.createCube('RightCube', { x: 3, y: 0, z: -5 });
    const rightMeshRenderer = rightCube.getMeshRenderer()!;
    rightMeshRenderer.setColor(0, 0, 1, 1); // Blue
    
    const rightRotator = new RotatorComponent(0, 0, 5); // 5 deg/sec around Z axis (1.2 minutes per full rotation)
    rightCube.addComponent(rightRotator);
    
    scene.addGameObject(rightCube);
    
    // Create a sphere above (slower rotation)
    const sphere = GameObject.createSphere('FloatingSphere', { x: 0, y: 3, z: -5 });
    const sphereMeshRenderer = sphere.getMeshRenderer()!;
    sphereMeshRenderer.setColor(1, 0, 1, 1); // Magenta
    
    const sphereRotator = new RotatorComponent(2, 3, 1.5); // Multi-axis rotation (very gentle)
    sphere.addComponent(sphereRotator);
    
    scene.addGameObject(sphere);
    
    console.log('🎬 Test scene created with', scene.getEntityCount(), 'entities');
    return scene;
}

async function main() {
    console.log('🚀 Scene System Test starting...');
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
        renderer.registerMesh('sphere', createSphereMesh(1.0, 16)); // Will need to create this
        renderer.registerMesh('grid', createGridMesh(20, 20));
        
        // Create and initialize scene
        const scene = await createTestScene();
        await scene.init(renderer);
        scene.start();
        
        // Export scene to window for HTML access
        (window as any).scene = scene;
        
        console.log('✅ Scene initialized successfully');
        
        // Animation loop
        let lastTime = performance.now();
        const gameLoop = (currentTime: number) => {
            const rawDeltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
            const deltaTime = Math.min(rawDeltaTime, 1/30); // Cap at 30fps to prevent huge jumps
            lastTime = currentTime;
            
            // Only update scene if animation is running (check window.animationRunning from HTML)
            if ((window as any).animationRunning !== false && deltaTime > 0) {
                scene.update(deltaTime);
            }
            
            requestAnimationFrame(gameLoop);
        };
        
        // Start the game loop
        requestAnimationFrame(gameLoop);
        
    } catch (error) {
        console.error('❌ Error in scene system test:', error);
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            errorDiv.style.display = 'block';
        }
    }
}


// Export for browser testing
(window as any).createTestScene = createTestScene;
(window as any).runSceneSystemTest = main;

main();