// RotatingBall - Custom GameObject that rotates smoothly
import { GameObject } from './gameobject.js';
import { Transform, RigidBody, MeshRenderer } from './components/index.js';
import { MeshType } from './mesh-types.js';

export class RotatingBall extends GameObject {
    // Rotation speeds (degrees per second)
    private rotationSpeed: { x: number; y: number; z: number } = {
        x: 30, // Slow rotation on X axis
        y: 60, // Medium rotation on Y axis
        z: 20, // Slower rotation on Z axis
    };

    // Component references
    private transform: Transform;
    private rigidBody: RigidBody;
    private meshRenderer: MeshRenderer;

    constructor(
        name: string,
        radius: number = 7.5,
        position: { x: number; y: number; z: number } = { x: 0, y: 0, z: -10 }
    ) {
        super(name);

        console.log(`🎾 Creating RotatingBall "${name}" with radius ${radius}`);

        // Set up Transform component
        this.transform = this.addComponent(Transform);
        this.transform.setPosition(position.x, position.y, position.z);
        this.transform.setScale(2, 2, 2); // 2x visual scale on top of the 7.5 radius = massive ball!
        this.transform.setRotation(0, 0, 0); // Start with no rotation

        // Set up RigidBody component - enable physics movement
        this.rigidBody = this.addComponent(RigidBody);
        this.rigidBody.mass = 1.0;
        this.rigidBody.friction = 0.3;
        this.rigidBody.useGravity = false; // Disable gravity for now
        this.rigidBody.isKinematic = false; // Enable physics movement
        this.rigidBody.setRadius(radius);
        this.rigidBody.setVelocity(2, 0, 1); // Add initial velocity (2 m/s right, 1 m/s forward)

        console.log(
            `🎾 RigidBody configured: kinematic=${this.rigidBody.isKinematic}, radius=${radius}`
        );

        // Set up MeshRenderer component
        this.meshRenderer = this.addComponent(MeshRenderer);
        this.meshRenderer.setMeshType(MeshType.SPHERE);
        this.meshRenderer.setRadius(radius);

        console.log(`🎾 RotatingBall "${name}" created with components`);
    }

    // Override update to handle rotation
    override update(deltaTime: number): void {
        // Debug logging to see if update is being called
        if (Math.random() < 0.05) {
            // 5% chance
            console.log(`🎾 RotatingBall.update() called with deltaTime=${deltaTime.toFixed(3)}s`);
        }

        // Call parent update first (this updates all components)
        super.update(deltaTime);

        // Apply our custom rotation logic
        this.updateRotation(deltaTime);
    }

    private updateRotation(deltaTime: number): void {
        if (deltaTime > 0 && deltaTime < 0.1) {
            // Cap deltaTime to avoid large jumps
            // Calculate rotation deltas for this frame
            const rotationDelta = {
                x: this.rotationSpeed.x * deltaTime,
                y: this.rotationSpeed.y * deltaTime,
                z: this.rotationSpeed.z * deltaTime,
            };

            // Apply rotation using the transform's rotate method
            this.transform.rotate(rotationDelta.x, rotationDelta.y, rotationDelta.z);

            // Debug logging more frequently to check if rotation is working
            if (Math.random() < 0.1) {
                // 10% chance = very frequent logging
                console.log(
                    `🔄 RotatingBall.updateRotation(): delta=(${rotationDelta.x.toFixed(1)}, ${rotationDelta.y.toFixed(1)}, ${rotationDelta.z.toFixed(1)}), current=(${this.transform.rotation.x.toFixed(1)}°, ${this.transform.rotation.y.toFixed(1)}°, ${this.transform.rotation.z.toFixed(1)}°)`
                );
            }
        }
    }

    // Public interface for rotation control
    setRotationSpeed(x: number, y: number, z: number): void {
        this.rotationSpeed.x = x;
        this.rotationSpeed.y = y;
        this.rotationSpeed.z = z;
        console.log(
            `🎾 RotatingBall "${this.name}" rotation speed set to (${x}, ${y}, ${z}) degrees/sec`
        );
    }

    getRotationSpeed(): { x: number; y: number; z: number } {
        return { ...this.rotationSpeed };
    }

    stopRotation(): void {
        this.setRotationSpeed(0, 0, 0);
    }

    startRotation(): void {
        this.setRotationSpeed(30, 60, 20);
    }

    // Access to components
    getTransform(): Transform {
        return this.transform;
    }

    getRigidBody(): RigidBody {
        return this.rigidBody;
    }

    getMeshRenderer(): MeshRenderer {
        return this.meshRenderer;
    }

    // Debug info
    override toString(): string {
        const speed = this.rotationSpeed;
        return `RotatingBall(${this.name}, speed: (${speed.x}, ${speed.y}, ${speed.z}) deg/s)`;
    }
}
