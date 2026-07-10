// Scene demonstrating rotation with physics and gamepad input
/* eslint-disable */
import { Engine } from '../../../engine/engine';
import { Scene } from '../../../engine/scene-system';
import { GameObject } from '../../../engine/gameobject';
import { MeshRenderer, RigidBody, CollisionShape, Component } from '../../../engine/components';
import { Mesh } from '../../../engine/mesh';
import { Material } from '../../../engine/material';

async function createSimpleScene(this: any, scene: Scene): Promise<void> {
    // Create ground plane
    const ground = new GameObject('ground', 'Ground');
    ground.transform.setPosition(0, -8, 0);

    // Add visual mesh (wireframe grid)
    const groundMesh = new MeshRenderer(Mesh.createGrid('grid', 16, 16),
        new Material('gray', { r: 0.5, g: 0.5, b: 0.5, a: 1 }), 'lines'); // Gray color
    ground.addComponent(groundMesh);
    scene.addGameObject(ground);

    // Create physics cube
    const cube = new GameObject('cube', 'PhysicsCube');
    cube.transform.setPosition(0, -2, 0);
    cube.transform.setRotation(45,0,45); // diamond shape
    // cube.transform.setRotation(45,0,35.26); // diamond shape
    cube.transform.setScale(4, 4, 4);

    // Add visual mesh (solid triangles)
    const cubeMesh = new MeshRenderer(Mesh.createCube('cube', 1),
        new Material('green', { r: 0, g: 1, b: 0, a: 1 })); // Green color
    cube.addComponent(cubeMesh);


    function rotationMatrixX(angleRadians: number) {
        const cos = Math.cos(angleRadians);
        const sin = Math.sin(angleRadians);
        return [
            [1, 0, 0],
            [0, cos, -sin],
            [0, sin, cos]
        ];
    };

    // Helper function to create rotation matrix around Y axis
    function rotationMatrixY(angleRadians: number) {
        const cos = Math.cos(angleRadians);
        const sin = Math.sin(angleRadians);
        return [
            [cos, 0, sin],
            [0, 1, 0],
            [-sin, 0, cos]
        ];
    };

    // Helper function to create rotation matrix around Z axis
    function rotationMatrixZ(angleRadians: number) {
        const cos = Math.cos(angleRadians);
        const sin = Math.sin(angleRadians);
        return [
            [cos, -sin, 0],
            [sin, cos, 0],
            [0, 0, 1]
        ];
    };

    // Multiply two 3x3 matrices
    function multiplyMatrix3x3(a: number[][], b: number[][]) {
        const result = [[0,0,0], [0,0,0], [0,0,0]];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 3; k++) {
                    result[i]![j]! += a[i]![k]! * b[k]![j]!;
                }
            }
        }
        return result;
    };

    // Apply matrix to vector
    function applyMatrix(matrix: number[][], vector: number[]) {
        return [
            matrix[0]![0]! * vector[0]! + matrix[0]![1]! * vector[1]! + matrix[0]![2]! * vector[2]!,
            matrix[1]![0]! * vector[0]! + matrix[1]![1]! * vector[1]! + matrix[1]![2]! * vector[2]!,
            matrix[2]![0]! * vector[0]! + matrix[2]![1]! * vector[1]! + matrix[2]![2]! * vector[2]!
        ];
    };


    // Replace with custom diamond rotator
    class DiamondRotator extends Component {

        //     private baseRotation = { x: 45, y: 0, z: 45 }; // Diamond base rotation
        //     // private baseRotation = { x: 45, y: 0, z: 35.26 }; // Diamond base rotation
        //     private spinAngle = 0;
        //     private spinSpeed = 10; // degrees per second

        //     override update(deltaTime: number): void {
        //         this.spinAngle += this.spinSpeed * deltaTime;

        //         // Apply base diamond rotation + spinning around diamond's vertical axis
        //         this.gameObject?.transform.setRotation(
        //             this.baseRotation.x,
        //             this.baseRotation.y + this.spinAngle, // spin around Y (diamond's vertical)
        //             this.baseRotation.z
        //         );
        //     }
        override update(deltaTime: number): void {
            if (!this.gameObject || !this.gameObject.transform) return;
            const transform = this.gameObject.transform;
            if (!transform.position || !transform.rotation) return;

            const { position, rotation } = transform;
            if (
                typeof position.x !== 'number' ||
                typeof position.y !== 'number' ||
                typeof position.z !== 'number' ||
                typeof rotation.x !== 'number' ||
                typeof rotation.y !== 'number' ||
                typeof rotation.z !== 'number'
            ) return;

            const bottomVertexPos = [0, -10, 0];
            const deltaRotX = 0 * deltaTime;
            const deltaRotY = 1 * deltaTime;
            const deltaRotZ = 0 * deltaTime;

            const radX = deltaRotX * (Math.PI / 180);
            const radY = deltaRotY * (Math.PI / 180);
            const radZ = deltaRotZ * (Math.PI / 180);

            // Step 1: Get current cube position relative to bottom vertex
            const tempPos = [
                position.x - bottomVertexPos[0]!,
                position.y - bottomVertexPos[1]!,
                position.z - bottomVertexPos[2]!
            ];

            // Step 3: Create delta rotation matrices
            const deltaRotMatX = rotationMatrixX(radX);
            const deltaRotMatY = rotationMatrixY(radY);
            const deltaRotMatZ = rotationMatrixZ(radZ);

            // Combined delta rotation (Z * Y * X order)
            const deltaMatrix = multiplyMatrix3x3(deltaRotMatZ, multiplyMatrix3x3(deltaRotMatY, deltaRotMatX));

            // Step 4: Apply delta rotation to position
            const newTempPos = applyMatrix(deltaMatrix, tempPos);

            // Step 5: Move back to world position
            position.x = newTempPos[0]! + bottomVertexPos[0]!;
            position.y = newTempPos[1]! + bottomVertexPos[1]!;
            position.z = newTempPos[2]! + bottomVertexPos[2]!;

            // Step 6: Update cube rotation
            rotation.x += deltaRotX;
            rotation.y += deltaRotY;
            rotation.z += deltaRotZ;
        }
    };


    // Add rotation component FIRST so it updates before RigidBody
    // const rotatorComponent = new RotatorComponent(0, 0, 10); // degrees per second
    const rotatorComponent = new DiamondRotator();
    cube.addComponent(rotatorComponent);

    // Add a scale animation component to test scale syncing
    class ScaleAnimator extends Component {
        private time = 0;
        override update(deltaTime: number): void {
            this.time += deltaTime;
            const scale = 3 + 0.5 * Math.sin(this.time * 2); // Pulse between 3x and 3.5x
            this.gameObject?.transform.setScale(scale, scale, scale);
        }
    }
    const scaleAnimator = new ScaleAnimator();
    cube.addComponent(scaleAnimator);

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

async function buildScene(): Promise<Scene> {
    const scene = new Scene();
    await createSimpleScene(scene);
    return scene;
}

async function main() {
    try {
        // Initialize engine + mount scene (pure data)
        const engine = new Engine('canvas');
        await engine.init();
        const scene = await buildScene();
        await engine.loadScene(scene);

        // Set up input (optional)
        const cube = scene.findGameObjectByName('cube');
        if (cube) {
            scene.setInputTarget(cube); // WASD/gamepad controls
        }

        // Start scene lifecycle + frame loop
        engine.start();

        (window as any).engine = engine;
        (window as any).scene = scene;
        console.log('🎮 Engine initialized successfully');

    } catch (error) {
        console.error('Failed to initialize engine:', error);
    }
}

main().catch(console.error);
/* eslint-enable */
