// Example usage of the new GameObject system with cube stacking
// This demonstrates the API design from Phase 7 implementation

import { Scene } from './scene.js';
import { GameObject } from './gameobject.js';
import { Transform, MeshRenderer, RigidBody } from './components/index.js';
import { MeshType } from './mesh-types.js';

// Example: Create a cube tower/stack scene
function createCubeStackScene(scene: Scene): void {
    console.log('🏗️ Creating cube stack scene');
    scene.clear(); // Clear existing entities before creating new ones

    const stackHeight = 5; // Reduced from 10 for better stability
    const cubeSize = 1.0; // This is the half-size parameter, actual cube is 2.0 units across
    const actualCubeSize = 2.0; // Real cube size in world units
    const floorLevel = -7.5; // Just above the physics floor at y=-8

    for (let i = 0; i < stackHeight; i++) {
        // Create cube GameObject
        const cubeObject = new GameObject(`Cube_${i}`);

        // Position cubes in perfectly aligned stack - no randomness for maximum stability
        const transform = cubeObject.addComponent(Transform);
        // Perfect alignment - no entropy, no randomness
        const x = 0.0; // Perfectly centered
        const z = 0.0; // Perfectly centered
        // Stack cubes properly: floor + (i * actual_height) + half_height_offset
        transform.setPosition(x, floorLevel + i * actualCubeSize + (actualCubeSize/2), z);
        transform.setScale(cubeSize, cubeSize, cubeSize);

        // Add physics
        const rigidBody = cubeObject.addComponent(RigidBody);
        rigidBody.mass = 1.0;
        rigidBody.friction = 0.3;

        // Add cube mesh rendering
        const renderer = cubeObject.addComponent(MeshRenderer);
        renderer.setMeshType(MeshType.CUBE);
        renderer.setSize(cubeSize);

        // Add to scene
        scene.addGameObject(cubeObject);
    }

    // Add a WRECKING BALL to demolish the stack!
    const wreckingBall = new GameObject('WreckingBall');
    const wbTransform = wreckingBall.addComponent(Transform);
    const ballHeight = floorLevel + (stackHeight / 2) * actualCubeSize; // Middle of stack height
    wbTransform.setPosition(-3, ballHeight, 0); // Start much closer for guaranteed impact

    const wbRigidBody = wreckingBall.addComponent(RigidBody);
    wbRigidBody.mass = 3.0; // Heavy wrecking ball
    wbRigidBody.setVelocity(6.0, 0, 0); // Faster approach velocity for maximum carnage

    const wbRenderer = wreckingBall.addComponent(MeshRenderer);
    wbRenderer.setMeshType(MeshType.SPHERE);
    wbRenderer.setRadius(0.8); // Bigger wrecking ball

    scene.addGameObject(wreckingBall);

    console.log(`🏗️ Cube stack scene created: ${stackHeight} cubes + 1 WRECKING BALL!`);
}

// Example: Create mixed sphere/cube scene with parent-child relationships
function createMixedScene(scene: Scene): void {
    console.log('🔗 Creating mixed scene');
    scene.clear(); // Clear existing entities before creating new ones

    // Create a "compound" object with parent-child hierarchy
    const compound = new GameObject('CompoundObject');
    const compoundTransform = compound.addComponent(Transform);
    // Add tiny offset to prevent perfect alignment
    const entropy = scene.getEntropy(); // Use configurable entropy from scene
    const randomX = (Math.random() - 0.5) * entropy;
    const randomZ = (Math.random() - 0.5) * entropy;
    compoundTransform.setPosition(randomX, 8, randomZ);

    // Central cube as parent
    compound.addComponent(RigidBody);
    const centralRenderer = compound.addComponent(MeshRenderer);
    centralRenderer.setMeshType(MeshType.CUBE);
    centralRenderer.setSize(1.0);

    // Create child spheres orbiting the cube
    for (let i = 0; i < 4; i++) {
        const orbit = new GameObject(`OrbitBall_${i}`);
        const orbitTransform = orbit.addComponent(Transform);

        // Position relative to parent
        const angle = (i / 4) * Math.PI * 2;
        orbitTransform.setPosition(
            Math.cos(angle) * 2,
            0,
            Math.sin(angle) * 2
        );

        const orbitRenderer = orbit.addComponent(MeshRenderer);
        orbitRenderer.setMeshType(MeshType.SPHERE);
        orbitRenderer.setRadius(0.3);

        // Make it a child of compound object
        compound.addChild(orbit);
    }

    scene.addGameObject(compound);
}

// Example: Scene factory methods
function createGameObjectExamples(): void {
    const scene = new Scene('ExampleScene');

    // Using scene factory methods
    scene.createSphereGameObject('TestSphere', 0, 5, 0, 0.5);
    scene.createCubeGameObject('TestCube', 2, 5, 0, 1.0);

    // Manual GameObject construction
    const customObject = new GameObject('CustomObject');
    const transform = customObject.addComponent(Transform);
    const rigidBody = customObject.addComponent(RigidBody);
    const renderer = customObject.addComponent(MeshRenderer);

    transform.setPosition(-2, 5, 0);
    rigidBody.setRadius(0.6);
    rigidBody.mass = 2.0;
    renderer.setMeshType(MeshType.SPHERE);
    renderer.setRadius(0.6);

    scene.addGameObject(customObject);

    // Create complex scenes
    createCubeStackScene(scene);
    createMixedScene(scene);

    console.log('Scene created with GameObject system!');
    console.log(scene.toString());
    console.log(`Statistics: ${JSON.stringify(scene.getStatistics(), null, 2)}`);
}

// Export for potential usage
export { createCubeStackScene, createMixedScene, createGameObjectExamples };
