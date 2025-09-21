// Scene demonstrating rotation with physics and gamepad input
import { Scene } from '../../../engine/scene-system';
import { WebGPURendererV2 } from '../../../renderer/webgpu.renderer';
import { GameObject } from '../../../engine/gameobject';
import { MeshRenderer, RigidBody, CollisionShape, RotatorComponent } from '../../../engine/components';
import { createGridMesh, createCubeMesh } from '../../../renderer/mesh-utils';

async function initializeEngine() {
    // 1. Get canvas element
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
        throw new Error('Canvas element not found');
    }

    // 2. Initialize WebGPU renderer
    const renderer = new WebGPURendererV2();
    await renderer.init(canvas);

    // 3. Register meshes (must be done before creating GameObjects)
    renderer.registerMesh('cube', createCubeMesh());
    renderer.registerMesh('grid', createGridMesh(16, 16));

    // 4. Create and initialize scene
    const scene = new Scene();
    await scene.init(renderer);

    return { scene, renderer };
}

async function createSimpleScene(scene: Scene): Promise<void> {
    // Create ground plane
    const ground = new GameObject('ground', 'Ground');
    ground.transform.setPosition(0, -8, 0);

    // Add visual mesh (wireframe grid)
    const groundMesh = new MeshRenderer('grid', 'default', 'lines',
        { x: 0.5, y: 0.5, z: 0.5, w: 1 }); // Gray color
    ground.addComponent(groundMesh);
    scene.addGameObject(ground);

    // Create physics cube
    const cube = new GameObject('cube', 'PhysicsCube');
    cube.transform.setPosition(0, -2, 0);  // Start above ground
    cube.transform.setScale(4, 4, 4);

    // Add visual mesh (solid triangles)
    const cubeMesh = new MeshRenderer('cube', 'default', 'triangles',
        { x: 0, y: 1, z: 0, w: 1 }); // Green color
    cube.addComponent(cubeMesh);

    // Add rotation component FIRST so it updates before RigidBody
    const rotatorComponent = new RotatorComponent(0, 10, 0); // degrees per second
    cube.addComponent(rotatorComponent);

    // Add physics (mass, gravity, collision shape, dimensions)
    const cubeRigidBody = new RigidBody(
        1.0,                          // mass
        true,                         // use gravity
        CollisionShape.BOX,           // collision shape
        { x: 0.5, y: 0.5, z: 0.5 }    // half-extents (cube size)
    );
    // Make kinematic so RotatorComponent can control rotation without WASM override
    cubeRigidBody.isKinematic = true;
    cube.addComponent(cubeRigidBody);

    scene.addGameObject(cube);

    // Position camera to see the scene
    scene.camera.setPosition([0, -2, -15]);
    scene.camera.lookAt([0, -2, 0]);

    console.log(`✅ Scene created with ${scene.getEntityCount()} GameObjects`);
}

async function main() {
    try {
        // Initialize engine
        const { scene } = await initializeEngine();

        // Create scene content
        await createSimpleScene(scene);

        // Set up input (optional)
        const cube = scene.findGameObjectByName('cube');
        if (cube) {
            scene.setInputTarget(cube); // WASD/gamepad controls
        }

        // Start scene lifecycle
        scene.start();

        // Game loop
        let lastTime = performance.now();
        const gameLoop = (currentTime: number) => {
            const deltaTime = Math.min((currentTime - lastTime) / 1000, 1/30);
            lastTime = currentTime;

            scene.update(deltaTime); // Physics + rendering
            requestAnimationFrame(gameLoop);
        };

        requestAnimationFrame(gameLoop);
        console.log('🎮 Engine initialized successfully');

    } catch (error) {
        console.error('Failed to initialize engine:', error);
    }
}

main().catch(console.error);
