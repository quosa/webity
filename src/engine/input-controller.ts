// Input controller system for managing different input targets (camera, GameObjects)
import { Camera } from './camera';
import { GameObject } from './gameobject';
import { RigidBody } from './components';

export interface InputController {
    handleInput(_key: number, _pressed: boolean): void;
    update(_deltaTime: number): void;
}

/**
 * CameraController - Handles free-flying camera movement
 * WASD: Move forward/back/left/right
 * Space: Move up
 * -: Move down
 */
export class CameraController implements InputController {
    private camera: Camera;
    private moveSpeed: number = 5.0;
    private currentInputState = new Set<number>();

    constructor(camera: Camera, moveSpeed: number = 5.0) {
        this.camera = camera;
        this.moveSpeed = moveSpeed;
    }

    handleInput(key: number, pressed: boolean): void {
        if (pressed) {
            this.currentInputState.add(key);
        } else {
            this.currentInputState.delete(key);
        }
    }

    update(deltaTime: number): void {
        const movement = { forward: 0, right: 0, up: 0 };

        // WASD camera movement
        if (this.currentInputState.has(87)) movement.forward += 1;  // W - forward
        if (this.currentInputState.has(83)) movement.forward -= 1;  // S - backward
        if (this.currentInputState.has(68)) movement.right += 1;    // D - right
        if (this.currentInputState.has(65)) movement.right -= 1;    // A - left
        if (this.currentInputState.has(32)) movement.up += 1;       // Space - up
        if (this.currentInputState.has(45)) movement.up -= 1;       // - - down

        if (movement.forward || movement.right || movement.up) {
            const speed = this.moveSpeed * deltaTime;
            this.camera.move(
                movement.forward * speed,
                movement.right * speed,
                movement.up * speed
            );
        }
    }

    setMoveSpeed(speed: number): void {
        this.moveSpeed = speed;
    }

    getMoveSpeed(): number {
        return this.moveSpeed;
    }
}

/**
 * GameObjectController - Applies forces to a GameObject with RigidBody
 * WASD: Apply forces in X/Z plane
 * Space: Apply upward force
 * -: Apply downward force
 */
export class GameObjectController implements InputController {
    private gameObject: GameObject;
    private forceStrength: number = 4.0;
    private currentInputState = new Set<number>();

    constructor(gameObject: GameObject, forceStrength: number = 4.0) {
        this.gameObject = gameObject;
        this.forceStrength = forceStrength;
    }

    handleInput(key: number, pressed: boolean): void {
        if (pressed) {
            this.currentInputState.add(key);
        } else {
            this.currentInputState.delete(key);
        }
    }

    update(_deltaTime: number): void {
        const rigidBody = this.gameObject.getComponent(RigidBody);
        if (!rigidBody) {
            console.warn(`GameObjectController: GameObject "${this.gameObject.name}" has no RigidBody component`);
            return;
        }

        const force = { x: 0, y: 0, z: 0 };

        // WASD force application
        if (this.currentInputState.has(87)) force.z -= this.forceStrength;  // W - forward
        if (this.currentInputState.has(83)) force.z += this.forceStrength;  // S - backward
        if (this.currentInputState.has(68)) force.x += this.forceStrength;  // D - right
        if (this.currentInputState.has(65)) force.x -= this.forceStrength;  // A - left
        if (this.currentInputState.has(32)) force.y += this.forceStrength;  // Space - up
        if (this.currentInputState.has(45)) force.y -= this.forceStrength;  // - - down

        if (force.x || force.y || force.z) {
            // Apply force to WASM physics entity via the physics bridge
            const entityId = rigidBody.getWasmEntityId();
            const scene = this.gameObject.getScene();
            if (entityId !== undefined && scene?.physicsBridge) {
                scene.physicsBridge.applyForce(entityId, force);
            }
        }
    }

    setForceStrength(strength: number): void {
        this.forceStrength = strength;
    }

    getForceStrength(): number {
        return this.forceStrength;
    }

    getGameObject(): GameObject {
        return this.gameObject;
    }
}

/**
 * OrbitCameraController - Orbits camera around a target point
 * WASD: Orbit left/right/up/down
 * Space: Zoom in
 * -: Zoom out
 */
export class OrbitCameraController implements InputController {
    private camera: Camera;
    private orbitSpeed: number = 2.0;
    private zoomSpeed: number = 5.0;
    private currentInputState = new Set<number>();
    private target: [number, number, number];

    constructor(camera: Camera, target: [number, number, number] = [0, 0, 0], orbitSpeed: number = 2.0, zoomSpeed: number = 5.0) {
        this.camera = camera;
        this.target = [...target] as [number, number, number];
        this.orbitSpeed = orbitSpeed;
        this.zoomSpeed = zoomSpeed;
        this.camera.lookAt(this.target);
    }

    handleInput(key: number, pressed: boolean): void {
        if (pressed) {
            this.currentInputState.add(key);
        } else {
            this.currentInputState.delete(key);
        }
    }

    update(deltaTime: number): void {
        let yaw = 0;
        let pitch = 0;
        let zoom = 0;

        // WASD for orbit controls
        if (this.currentInputState.has(65)) yaw -= 1;    // A - orbit left
        if (this.currentInputState.has(68)) yaw += 1;    // D - orbit right
        if (this.currentInputState.has(87)) pitch += 1;  // W - orbit up
        if (this.currentInputState.has(83)) pitch -= 1;  // S - orbit down

        // Space/- for zoom
        if (this.currentInputState.has(32)) zoom -= 1;   // Space - zoom in
        if (this.currentInputState.has(45)) zoom += 1;   // - - zoom out

        if (yaw || pitch) {
            const rotationSpeed = this.orbitSpeed * deltaTime;
            this.camera.orbitAroundTarget(yaw * rotationSpeed, pitch * rotationSpeed);
        }

        if (zoom) {
            const zoomAmount = zoom * this.zoomSpeed * deltaTime;
            const position = this.camera.getPosition();
            const direction = [
                this.target[0] - position[0],
                this.target[1] - position[1],
                this.target[2] - position[2]
            ];
            const distance = Math.sqrt(direction[0]! ** 2 + direction[1]! ** 2 + direction[2]! ** 2);

            if (distance > 1.0 || zoom < 0) { // Prevent getting too close
                const normalizedDirection: [number, number, number] = [
                    direction[0]! / distance,
                    direction[1]! / distance,
                    direction[2]! / distance
                ];

                this.camera.setPosition([
                    position[0]! + normalizedDirection[0] * zoomAmount,
                    position[1]! + normalizedDirection[1] * zoomAmount,
                    position[2]! + normalizedDirection[2] * zoomAmount
                ]);
            }
        }
    }

    setTarget(target: [number, number, number]): void {
        this.target = [...target] as [number, number, number];
        this.camera.lookAt(this.target);
    }

    getTarget(): [number, number, number] {
        return [...this.target] as [number, number, number];
    }

    setOrbitSpeed(speed: number): void {
        this.orbitSpeed = speed;
    }

    getOrbitSpeed(): number {
        return this.orbitSpeed;
    }

    setZoomSpeed(speed: number): void {
        this.zoomSpeed = speed;
    }

    getZoomSpeed(): number {
        return this.zoomSpeed;
    }
}