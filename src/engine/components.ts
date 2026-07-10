// src/v2/components.ts
// Base Component system and built-in components

import {
    createLookAtMatrix,
    createPerspectiveMatrix,
    createOrthographicMatrix,
    multiplyMat4,
} from '../utils/math-utils';
import type { Mesh } from './mesh';
import { Material } from './material';

export abstract class Component {
    public gameObject: any; // Will be GameObject, but avoiding circular import

    constructor() { }

    // Lifecycle methods that can be overridden by subclasses
    awake(): void { }
    start(): void { }
    update(_deltaTime: number): void { } // Underscore prefix indicates unused parameter
    destroy(): void { }
}

// Vector3 utility interface
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

// Transform component - handles position, rotation, scale and matrix calculations
export class Transform extends Component {
    public position: Vector3;
    public rotation: Vector3; // Euler angles in degrees
    public scale: Vector3;

    constructor(
        position: Vector3 = { x: 0, y: 0, z: 0 },
        rotation: Vector3 = { x: 0, y: 0, z: 0 },
        scale: Vector3 = { x: 1, y: 1, z: 1 }
    ) {
        super();
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    }

    // Calculate local transform matrix (TRS order)
    getLocalMatrix(): Float32Array {
        const matrix = new Float32Array(16);

        // Convert degrees to radians
        const rx = this.rotation.x * Math.PI / 180;
        const ry = this.rotation.y * Math.PI / 180;
        const rz = this.rotation.z * Math.PI / 180;


        // Calculate rotation components
        const cx = Math.cos(rx), sx = Math.sin(rx);
        const cy = Math.cos(ry), sy = Math.sin(ry);
        const cz = Math.cos(rz), sz = Math.sin(rz);

        // TRS Matrix calculation (Translation * Rotation * Scale)
        // Combined rotation matrix (ZYX order)
        const r11 = cy * cz;
        const r12 = -cy * sz;
        const r13 = sy;
        const r21 = sx * sy * cz + cx * sz;
        const r22 = -sx * sy * sz + cx * cz;
        const r23 = -sx * cy;
        const r31 = -cx * sy * cz + sx * sz;
        const r32 = cx * sy * sz + sx * cz;
        const r33 = cx * cy;

        // Apply scale and set matrix elements (column-major order)
        matrix[0] = r11 * this.scale.x; matrix[4] = r12 * this.scale.y; matrix[8] = r13 * this.scale.z; matrix[12] = this.position.x;
        matrix[1] = r21 * this.scale.x; matrix[5] = r22 * this.scale.y; matrix[9] = r23 * this.scale.z; matrix[13] = this.position.y;
        matrix[2] = r31 * this.scale.x; matrix[6] = r32 * this.scale.y; matrix[10] = r33 * this.scale.z; matrix[14] = this.position.z;
        matrix[3] = 0; matrix[7] = 0; matrix[11] = 0; matrix[15] = 1;

        return matrix;
    }

    // Convenience methods for position manipulation
    translate(x: number, y: number, z: number): void {
        this.position.x += x;
        this.position.y += y;
        this.position.z += z;
    }

    rotate(x: number, y: number, z: number): void {
        this.rotation.x += x;
        this.rotation.y += y;
        this.rotation.z += z;

    }

    setPosition(x: number, y: number, z: number): void {
        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
    }

    setRotation(x: number, y: number, z: number): void {
        this.rotation.x = x;
        this.rotation.y = y;
        this.rotation.z = z;
    }

    setScale(x: number, y: number, z: number): void {
        this.scale.x = x;
        this.scale.y = y;
        this.scale.z = z;
    }
}

// MeshRenderer component - handles visual representation
export class MeshRenderer extends Component {
    public meshId: string;
    public meshIndex: number | undefined; // For WASM integration
    public materialId: string;
    public color: Vector3 & { w: number }; // RGBA color
    public renderMode: 'triangles' | 'lines';

    // The actual asset objects. The engine uploads/registers `mesh` at mount and resolves
    // its mesh index; `color` is derived from the material's RGBA.
    public mesh: Mesh;
    public material: Material;

    constructor(
        mesh: Mesh,
        material: Material = Material.default,
        renderMode: 'triangles' | 'lines' = 'triangles',
    ) {
        super();
        this.meshIndex = undefined; // resolved at mount
        this.renderMode = renderMode;
        this.mesh = mesh;
        this.meshId = mesh.id;
        this.material = material;
        this.materialId = material.id;
        const c = material.color;
        this.color = { x: c.r, y: c.g, z: c.b, w: c.a };
    }

    setColor(r: number, g: number, b: number, a: number = 1): void {
        this.color.x = r;
        this.color.y = g;
        this.color.z = b;
        this.color.w = a;
    }
}

// Rotator component - simple rotation behavior for testing/demo
export class RotatorComponent extends Component {
    private rotationSpeed: Vector3;

    constructor(
        speedX: number = 0,
        speedY: number = 45, // Default 45 deg/sec around Y axis
        speedZ: number = 0
    ) {
        super();
        this.rotationSpeed = { x: speedX, y: speedY, z: speedZ };
    }

    override update(deltaTime: number): void {
        if (this.gameObject?.transform) {
            const rotX = this.rotationSpeed.x * deltaTime;
            const rotY = this.rotationSpeed.y * deltaTime;
            const rotZ = this.rotationSpeed.z * deltaTime;

            this.gameObject.transform.rotate(rotX, rotY, rotZ);
        }
    }

    setRotationSpeed(x: number, y: number, z: number): void {
        this.rotationSpeed.x = x;
        this.rotationSpeed.y = y;
        this.rotationSpeed.z = z;
    }
}

// Collision shape enumeration (matches WASM CollisionShape enum)
export enum CollisionShape {
    // eslint-disable-next-line no-unused-vars
    SPHERE = 0,
    // eslint-disable-next-line no-unused-vars
    BOX = 1,
    // eslint-disable-next-line no-unused-vars
    PLANE = 2,
}

// RigidBody component - handles physics simulation
export class RigidBody extends Component {
    public mass: number;
    public velocity: Vector3;
    public isKinematic: boolean;
    public useGravity: boolean;

    // Physics shape (enhanced collision system)
    public collisionShape: CollisionShape;
    public extents: Vector3; // Half-extents for boxes, radius in .x for spheres, normal for planes

    // WASM integration
    private wasmEntityId?: number;
    private physicsBridge?: any; // Will be WasmPhysicsBridge

    constructor(
        mass: number = 1.0,
        useGravity: boolean = true,
        collisionShape: CollisionShape = CollisionShape.SPHERE,
        extents: Vector3 = { x: 0.5, y: 0.5, z: 0.5 }, // Default sphere radius 0.5
        opts: { kinematic?: boolean } = {}
    ) {
        super();
        this.mass = mass;
        this.velocity = { x: 0, y: 0, z: 0 };
        this.isKinematic = opts.kinematic ?? false; // Default: affected by physics forces
        this.useGravity = useGravity;
        this.collisionShape = collisionShape;
        this.extents = extents;
    }

    // A fixed, collidable surface: kinematic (won't move) with a non-zero mass so it actually
    // participates in collision, and no gravity. Avoids the mass-0 inert-collider footgun.
    static staticBody(collisionShape: CollisionShape, extents: Vector3): RigidBody {
        return new RigidBody(1.0, false, collisionShape, extents, { kinematic: true });
    }

    override awake(): void {
        // Initialize physics entity when component is added to GameObject
        this.initializePhysics();
    }

    override start(): void {
        // Start physics simulation
        this.syncToWasm();
    }

    override update(_deltaTime: number): void {
        // Pre-physics: kinematic bodies push their manual transform into WASM so the
        // physics step sees it. Dynamic bodies are synced back by the physics bridge.
        if (this.isKinematic) {
            this.syncToWasm();
        }
    }

    override destroy(): void {
        // Clean up physics entity
        this.cleanupPhysics();
    }

    // Initialize physics entity in WASM
    private initializePhysics(): void {
        if (!this.gameObject) return;

        // TODO: Get physics bridge from scene
        // this.physicsBridge = this.gameObject.scene?.physicsBridge;

        console.log(`🔵 RigidBody.initializePhysics() for "${this.gameObject.name}"`);
    }

    // Sync current state to WASM physics system
    public syncToWasm(): void {
        if (!this.gameObject || !this.physicsBridge || this.wasmEntityId === undefined) return;

        const transform = this.gameObject.transform;
        // Update ALL transform properties in WASM physics system
        this.physicsBridge.updateEntity(this.wasmEntityId, transform.position, this.velocity);
        this.physicsBridge.updateEntityRotation(this.wasmEntityId, transform.rotation);
        this.physicsBridge.updateEntityScale(this.wasmEntityId, transform.scale);
    }

    // Clean up physics entity
    private cleanupPhysics(): void {
        if (this.wasmEntityId !== undefined && this.physicsBridge) {
            console.log(`🗑️ RigidBody.cleanupPhysics() for entity ${this.wasmEntityId}`);
            // TODO: Remove from WASM physics system
            // this.physicsBridge.removeEntity(this.wasmEntityId);
        }
    }

    // Apply force to physics body
    public applyForce(fx: number, fy: number, fz: number): void {
        if (this.isKinematic || !this.physicsBridge || this.wasmEntityId === undefined) return;

        console.log(`💥 RigidBody.applyForce(${fx}, ${fy}, ${fz}) to entity ${this.wasmEntityId}`);
        // TODO: Apply force through WASM physics bridge
        // this.physicsBridge.applyForce(this.wasmEntityId, fx, fy, fz);
    }

    // Set velocity directly
    public setVelocity(vx: number, vy: number, vz: number): void {
        this.velocity.x = vx;
        this.velocity.y = vy;
        this.velocity.z = vz;

        if (!this.isKinematic) {
            this.syncToWasm();
        }
    }

    // Make this body kinematic (not affected by physics forces)
    public setKinematic(kinematic: boolean): void {
        this.isKinematic = kinematic;
        console.log(`🎮 RigidBody.setKinematic(${kinematic}) for "${this.gameObject?.name}"`);

        if (this.physicsBridge && this.wasmEntityId !== undefined) {
            // TODO: Update kinematic state in WASM
            // this.physicsBridge.setKinematic(this.wasmEntityId, kinematic);
        }
    }

    // Set WASM entity ID (called by physics bridge)
    public setWasmEntityId(id: number): void {
        this.wasmEntityId = id;
        console.log(`🆔 RigidBody.setWasmEntityId(${id}) for "${this.gameObject?.name}"`);
    }

    // Get WASM entity ID
    public getWasmEntityId(): number | undefined {
        return this.wasmEntityId;
    }

    // Set physics bridge reference (called by scene)
    public setPhysicsBridge(bridge: any): void {
        this.physicsBridge = bridge;
    }

    // Collision shape configuration methods
    public setSphereCollider(radius: number): void {
        this.collisionShape = CollisionShape.SPHERE;
        this.extents = { x: radius, y: radius, z: radius };
        this.updateWasmCollisionShape();
    }

    public setBoxCollider(halfWidth: number, halfHeight: number, halfDepth: number): void {
        this.collisionShape = CollisionShape.BOX;
        this.extents = { x: halfWidth, y: halfHeight, z: halfDepth };
        this.updateWasmCollisionShape();
    }

    public setPlaneCollider(normalX: number = 0, normalY: number = 1, normalZ: number = 0): void {
        this.collisionShape = CollisionShape.PLANE;
        this.extents = { x: normalX, y: normalY, z: normalZ };
        this.updateWasmCollisionShape();
    }

    // Update collision shape in WASM physics system
    private updateWasmCollisionShape(): void {
        if (this.physicsBridge && this.wasmEntityId !== undefined) {
            this.physicsBridge.setEntityCollisionShape(this.wasmEntityId, this.collisionShape, this.extents.x, this.extents.y, this.extents.z);
            console.log(`🔧 RigidBody.updateWasmCollisionShape() for entity ${this.wasmEntityId}: shape=${this.collisionShape}, extents=(${this.extents.x}, ${this.extents.y}, ${this.extents.z})`);
        }
    }

    // Get collision shape information
    public getCollisionInfo(): { shape: CollisionShape; extents: Vector3 } {
        return {
            shape: this.collisionShape,
            extents: { ...this.extents }
        };
    }
}

// Camera component - allows GameObjects to act as cameras
export class CameraComponent extends Component {
    public isPerspective: boolean;
    public fov: number; // For perspective cameras (in radians)
    public near: number;
    public far: number;

    // For orthographic cameras
    public left: number;
    public right: number;
    public top: number;
    public bottom: number;

    // Orientation (3a: look-direction, not Euler). An explicit target is set via lookAt();
    // when null the forward direction is derived from the GameObject's Euler rotation (legacy).
    public target: [number, number, number] | null = null;
    public up: [number, number, number] = [0, 1, 0];

    constructor(
        isPerspective: boolean = true,
        fov: number = Math.PI / 4, // 45 degrees
        near: number = 0.1,
        far: number = 100,
        orthoBounds: { left: number; right: number; top: number; bottom: number } = { left: -5, right: 5, top: 5, bottom: -5 }
    ) {
        super();
        this.isPerspective = isPerspective;
        this.fov = fov;
        this.near = near;
        this.far = far;
        this.left = orthoBounds.left;
        this.right = orthoBounds.right;
        this.top = orthoBounds.top;
        this.bottom = orthoBounds.bottom;
    }

    // Calculate forward direction based on GameObject rotation
    private getForwardDirection(): [number, number, number] {
        if (!this.gameObject) return [0, 0, -1];

        const transform = this.gameObject.transform;

        // Convert rotation from degrees to radians
        const pitch = transform.rotation.x * Math.PI / 180;
        const yaw = transform.rotation.y * Math.PI / 180;
        // Roll not used for forward vector calculation
        // const roll = transform.rotation.z * Math.PI / 180;

        // Calculate forward vector from rotation
        // Standard forward is negative Z, modified by pitch and yaw
        const forward: [number, number, number] = [
            Math.sin(yaw) * Math.cos(pitch),
            -Math.sin(pitch),
            -Math.cos(yaw) * Math.cos(pitch)
        ];

        return forward;
    }

    // Set perspective projection settings
    setPerspective(fov: number, near: number = this.near, far: number = this.far): void {
        this.isPerspective = true;
        this.fov = fov;
        this.near = near;
        this.far = far;
    }

    // Set orthographic projection settings
    setOrthographic(left: number, right: number, top: number, bottom: number, near: number = this.near, far: number = this.far): void {
        this.isPerspective = false;
        this.left = left;
        this.right = right;
        this.top = top;
        this.bottom = bottom;
        this.near = near;
        this.far = far;
    }

    // ── View / projection ────────────────────────────────────────────────────────────
    // 3a: the camera's position IS its GameObject's transform.position (unified); orientation
    // is a look-direction (target/up). View matrix reuses the proven eye/target/up look-at math.

    // Aim at a world-space point. Accepts scalar (x, y, z) or array [x, y, z] form — the
    // array form matches the retired legacy Camera API still used by scenes and HTML controls.
    // Fails fast on a partial scalar call so a missing y/z can't seed NaNs into the view math.
    lookAt(x: number | [number, number, number], y?: number, z?: number): void {
        if (typeof x === 'number') {
            if (y === undefined || z === undefined) {
                throw new Error('CameraComponent.lookAt: pass all three coordinates (x, y, z) or an [x, y, z] array');
            }
            this.target = [x, y, z];
        } else {
            this.target = [...x];
        }
    }

    private resolveTarget(): [number, number, number] {
        const p = this.gameObject.transform.position;
        if (this.target) return this.target;
        // No explicit target: look along the GameObject's Euler forward direction (legacy).
        const forward = this.getForwardDirection();
        return [p.x + forward[0], p.y + forward[1], p.z + forward[2]];
    }

    getViewMatrix(): Float32Array {
        const p = this.gameObject.transform.position;
        return createLookAtMatrix([p.x, p.y, p.z], this.resolveTarget(), this.up);
    }

    getProjectionMatrix(aspect: number): Float32Array {
        return this.isPerspective
            ? createPerspectiveMatrix(this.fov, aspect, this.near, this.far)
            : createOrthographicMatrix(this.left, this.right, this.top, this.bottom, this.near, this.far);
    }

    getViewProjectionMatrix(aspect: number): Float32Array {
        return multiplyMat4(this.getProjectionMatrix(aspect), this.getViewMatrix());
    }

    // ── Position / target (array-shaped, transform-backed) ─────────────────────────────
    // The camera's position IS its GameObject's transform.position; these array-shaped
    // accessors + movement methods give the camera GameObject the surface the input
    // controllers (free-fly / orbit) rely on, replacing the retired legacy Camera.

    getPosition(): [number, number, number] {
        const p = this.gameObject.transform.position;
        return [p.x, p.y, p.z];
    }

    setPosition(position: [number, number, number]): void {
        this.gameObject.transform.setPosition(position[0], position[1], position[2]);
    }

    getTarget(): [number, number, number] {
        return [...this.resolveTarget()];
    }

    setTarget(target: [number, number, number]): void {
        this.target = [...target];
    }

    // Free-fly translation along the camera's local axes (ported from the retired BaseCamera).
    move(forward: number, right: number, up: number): void {
        // Pin a concrete heading first so a target-less free-fly camera doesn't produce NaNs.
        this.target ??= this.resolveTarget();
        const dir = this.getForwardVector();
        const rightVec = this.getRightVector();
        const dx = dir[0] * forward + rightVec[0] * right + this.up[0] * up;
        const dy = dir[1] * forward + rightVec[1] * right + this.up[1] * up;
        const dz = dir[2] * forward + rightVec[2] * right + this.up[2] * up;
        const p = this.gameObject.transform.position;
        this.gameObject.transform.setPosition(p.x + dx, p.y + dy, p.z + dz);
        this.target = [this.target[0] + dx, this.target[1] + dy, this.target[2] + dz];
    }

    // Orbit the position around the current target (ported from the retired BaseCamera).
    orbitAroundTarget(yaw: number, pitch: number): void {
        const target = this.resolveTarget();
        const p = this.gameObject.transform.position;
        const dx = p.x - target[0];
        const dy = p.y - target[1];
        const dz = p.z - target[2];
        const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (radius === 0) return; // camera sits on the target — nothing to orbit around (avoids NaN)

        const currentYaw = Math.atan2(dx, dz);
        const currentPitch = Math.asin(dy / radius);
        const newYaw = currentYaw + yaw;
        const newPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, currentPitch + pitch));

        this.gameObject.transform.setPosition(
            target[0] + radius * Math.sin(newYaw) * Math.cos(newPitch),
            target[1] + radius * Math.sin(newPitch),
            target[2] + radius * Math.cos(newYaw) * Math.cos(newPitch),
        );
        this.target = [...target];
    }

    // Local axes derived from eye → target, for movement.
    private getForwardVector(): [number, number, number] {
        const p = this.gameObject.transform.position;
        const t = this.resolveTarget();
        const dx = t[0] - p.x;
        const dy = t[1] - p.y;
        const dz = t[2] - p.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        return [dx / len, dy / len, dz / len];
    }

    private getRightVector(): [number, number, number] {
        const f = this.getForwardVector();
        const rx = f[1] * this.up[2] - f[2] * this.up[1];
        const ry = f[2] * this.up[0] - f[0] * this.up[2];
        const rz = f[0] * this.up[1] - f[1] * this.up[0];
        const len = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
        return [rx / len, ry / len, rz / len];
    }
}
