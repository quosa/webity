// src/v2/components.ts
// Base Component system and built-in components

export abstract class Component {
    public gameObject: any; // Will be GameObject, but avoiding circular import
    
    constructor() {}
    
    // Lifecycle methods that can be overridden by subclasses
    awake(): void {}
    start(): void {}
    update(_deltaTime: number): void {} // Underscore prefix indicates unused parameter
    destroy(): void {}
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
        matrix[0] = r11 * this.scale.x;   matrix[4] = r12 * this.scale.y;   matrix[8]  = r13 * this.scale.z;   matrix[12] = this.position.x;
        matrix[1] = r21 * this.scale.x;   matrix[5] = r22 * this.scale.y;   matrix[9]  = r23 * this.scale.z;   matrix[13] = this.position.y;
        matrix[2] = r31 * this.scale.x;   matrix[6] = r32 * this.scale.y;   matrix[10] = r33 * this.scale.z;   matrix[14] = this.position.z;
        matrix[3] = 0;                    matrix[7] = 0;                    matrix[11] = 0;                    matrix[15] = 1;
        
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
    public materialId: string;
    public color: Vector3 & { w: number }; // RGBA color
    public renderMode: 'triangles' | 'lines';
    
    constructor(
        meshId: string,
        materialId: string = 'default',
        renderMode: 'triangles' | 'lines' = 'triangles',
        color: { x: number; y: number; z: number; w: number } = { x: 1, y: 1, z: 1, w: 1 }
    ) {
        super();
        this.meshId = meshId;
        this.materialId = materialId;
        this.renderMode = renderMode;
        this.color = color;
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

// RigidBody component - handles physics simulation
export class RigidBody extends Component {
    public mass: number;
    public velocity: Vector3;
    public isKinematic: boolean;
    public useGravity: boolean;
    
    // Physics shape
    public colliderType: 'sphere' | 'box';
    public colliderSize: Vector3;
    
    // WASM integration
    private wasmEntityId?: number;
    private physicsBridge?: any; // Will be WasmPhysicsBridge
    
    constructor(
        mass: number = 1.0,
        useGravity: boolean = true,
        colliderType: 'sphere' | 'box' = 'sphere',
        colliderSize: Vector3 = { x: 1, y: 1, z: 1 }
    ) {
        super();
        this.mass = mass;
        this.velocity = { x: 0, y: 0, z: 0 };
        this.isKinematic = false; // Default: affected by physics forces
        this.useGravity = useGravity;
        this.colliderType = colliderType;
        this.colliderSize = colliderSize;
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
        // Physics updates handled by WASM, but we can override for custom behavior
        if (this.isKinematic) {
            // Kinematic bodies: manual transform updates
            this.syncFromTransform();
        } else {
            // Dynamic bodies: sync from WASM physics simulation
            this.syncFromWasm();
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
        if (!this.gameObject || !this.physicsBridge) return;
        
        const transform = this.gameObject.transform;
        console.log(`🔄 RigidBody.syncToWasm() for "${this.gameObject.name}" entity ${this.wasmEntityId}: pos=(${transform.position.x}, ${transform.position.y}, ${transform.position.z}), vel=(${this.velocity.x}, ${this.velocity.y}, ${this.velocity.z})`);
        
        // TODO: Call WASM physics bridge
        // this.physicsBridge.updateEntity(this.wasmEntityId, transform.position, this.velocity);
    }
    
    // Sync physics simulation results from WASM
    private syncFromWasm(): void {
        if (!this.gameObject || !this.physicsBridge || this.isKinematic) return;
        
        // TODO: Get updated position/rotation from WASM physics simulation
        // const wasmData = this.physicsBridge.getEntityData(this.wasmEntityId);
        // this.gameObject.transform.setPosition(wasmData.position.x, wasmData.position.y, wasmData.position.z);
    }
    
    // Sync from transform for kinematic bodies
    private syncFromTransform(): void {
        if (!this.gameObject || !this.physicsBridge || !this.isKinematic) return;
        
        // Kinematic bodies follow transform changes
        this.syncToWasm();
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
    
    // Set physics bridge reference (called by scene)
    public setPhysicsBridge(bridge: any): void {
        this.physicsBridge = bridge;
    }
}