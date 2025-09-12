// src/v2/test-physics-system.ts
// Test scene demonstrating the Phase 3 physics integration

import { Scene } from './scene-system';
import { GameObject } from './gameobject';
import { MeshRenderer, RigidBody } from './components';
import { WebGPURendererV2 } from './webgpu.renderer';
import { createCubeMesh, createTriangleMesh, createGridMesh, createSphereMesh } from './mesh-utils';

async function createPhysicsTestScene(): Promise<Scene> {
    const scene = new Scene();
    
    console.log('🧪 Creating Physics Test Scene (Phase 3)...');
    
    // Create static floor grid (no RigidBody = static)
    const floor = GameObject.createGrid('PhysicsFloor', { x: 0, y: -3, z: 0 });
    scene.addGameObject(floor);
    console.log('📐 Added static floor grid');
    
    // Create dynamic falling cube (with RigidBody = physics simulation)
    const fallingCube = new GameObject('falling-cube', 'FallingCube');
    fallingCube.transform.setPosition(0, 5, -5);
    fallingCube.transform.setScale(1, 1, 1);
    
    const cubeMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 1, z: 0, w: 1 }); // Green
    fallingCube.addComponent(cubeMeshRenderer);
    
    // Add RigidBody for physics simulation
    const cubeRigidBody = new RigidBody(
        2.0,        // mass: 2kg
        true,       // useGravity: affected by gravity
        'box',      // colliderType: box collider
        { x: 1, y: 1, z: 1 } // colliderSize: 1x1x1 unit cube
    );
    fallingCube.addComponent(cubeRigidBody);
    
    scene.addGameObject(fallingCube);
    console.log('📦 Added falling cube with RigidBody (mass: 2kg, gravity: true)');
    
    // Create floating kinematic cube (kinematic = manually controlled)
    const kinematicCube = new GameObject('kinematic-cube', 'KinematicCube');
    kinematicCube.transform.setPosition(3, 2, -5);
    
    const kinematicMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 }); // Red
    kinematicCube.addComponent(kinematicMeshRenderer);
    
    const kinematicRigidBody = new RigidBody(
        1.0,        // mass: 1kg (ignored for kinematic)
        false,      // useGravity: false
        'box',      // colliderType: box collider
        { x: 1, y: 1, z: 1 }
    );
    kinematicRigidBody.setKinematic(true); // Kinematic: not affected by physics forces
    kinematicCube.addComponent(kinematicRigidBody);
    
    scene.addGameObject(kinematicCube);
    console.log('🎮 Added kinematic cube (kinematic: true, manually controlled)');
    
    // Create physics sphere with initial velocity
    const physicsSphere = new GameObject('physics-sphere', 'PhysicsSphere');
    physicsSphere.transform.setPosition(-3, 4, -5);
    
    const sphereMeshRenderer = new MeshRenderer('sphere', 'default', 'triangles', { x: 0, y: 0, z: 1, w: 1 }); // Blue
    physicsSphere.addComponent(sphereMeshRenderer);
    
    const sphereRigidBody = new RigidBody(
        0.5,        // mass: 0.5kg (lighter)
        true,       // useGravity: true
        'sphere',   // colliderType: sphere collider
        { x: 1, y: 1, z: 1 }
    );
    sphereRigidBody.setVelocity(2, 0, 0); // Initial velocity: 2 units/sec to the right
    physicsSphere.addComponent(sphereRigidBody);
    
    scene.addGameObject(physicsSphere);
    console.log('⚽ Added physics sphere with initial velocity (2, 0, 0)');
    
    console.log(`🧪 Physics test scene created with ${scene.getEntityCount()} entities`);
    return scene;
}

async function main() {
    console.log('🚀 Physics System Test starting (Phase 3)...');
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
        
        // Create physics test scene
        const scene = await createPhysicsTestScene();
        await scene.init(renderer);
        scene.start();
        
        // Export scene to window for HTML access
        (window as any).scene = scene;
        (window as any).physicsTestScene = scene;
        
        console.log('✅ Physics test scene initialized successfully');
        
        // Log physics bridge statistics
        const stats = scene.physicsBridge.getStats();
        console.log('📊 Physics Bridge Stats:', stats);
        
        // Animation loop
        let lastTime = performance.now();
        const gameLoop = (currentTime: number) => {
            const rawDeltaTime = (currentTime - lastTime) / 1000;
            const deltaTime = Math.min(rawDeltaTime, 1/30); // Cap at 30fps
            lastTime = currentTime;
            
            // Only update scene if animation is running
            if ((window as any).animationRunning !== false && deltaTime > 0) {
                scene.update(deltaTime);
            }
            
            requestAnimationFrame(gameLoop);
        };
        
        // Start the game loop
        requestAnimationFrame(gameLoop);
        
    } catch (error) {
        console.error('❌ Error in physics system test:', error);
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            errorDiv.style.display = 'block';
        }
    }
}


// Helper functions for testing physics
(window as any).testPhysicsForce = function(fx: number, fy: number, fz: number) {
    const scene = (window as any).physicsTestScene;
    if (scene) {
        const fallingCube = scene.getGameObject('falling-cube');
        const rigidBody = fallingCube?.getComponent(RigidBody);
        if (rigidBody) {
            rigidBody.applyForce(fx, fy, fz);
            console.log(`💥 Applied force (${fx}, ${fy}, ${fz}) to falling cube`);
        }
    }
};

(window as any).testSetVelocity = function(vx: number, vy: number, vz: number) {
    const scene = (window as any).physicsTestScene;
    if (scene) {
        const sphere = scene.getGameObject('physics-sphere');
        const rigidBody = sphere?.getComponent(RigidBody);
        if (rigidBody) {
            rigidBody.setVelocity(vx, vy, vz);
            console.log(`🎯 Set sphere velocity to (${vx}, ${vy}, ${vz})`);
        }
    }
};

// Export for browser testing
(window as any).createPhysicsTestScene = createPhysicsTestScene;
(window as any).runPhysicsSystemTest = main;

main();