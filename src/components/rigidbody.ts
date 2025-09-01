// RigidBody component bridging to WASM physics system
import { Component } from './component.js';
import { Transform, Vector3 } from './transform.js';

export class RigidBody extends Component {
  // Physics properties
  public mass: number = 1.0;
  public restitution: number = 0.8;
  public friction: number = 0.3;
  public radius: number = 0.5; // For collision detection

  // Physics state
  public velocity: Vector3 = new Vector3();
  public useGravity: boolean = true;
  public isKinematic: boolean = false; // If true, not affected by physics forces

  // WASM integration
  private wasmEntityIndex: number = -1;
  private lastSyncedPosition: Vector3 = new Vector3();
  private lastSyncedVelocity: Vector3 = new Vector3();

  awake(): void {
    // RigidBody is ready for physics simulation
  }

  start(): void {
    // Sync with Transform component
    this.syncWithTransform();
  }

  update(_deltaTime: number): void {
    if (this.wasmEntityIndex >= 0 && !this.isKinematic) {
      // Sync physics state from WASM to Transform
      this.syncFromWasm();
    } else if (this.isKinematic) {
      // For kinematic bodies, sync Transform to WASM
      this.syncToWasm();
    }
  }

  destroy(): void {
    // Clean up WASM entity reference
    this.wasmEntityIndex = -1;
  }

  // WASM entity management
  getWasmEntityIndex(): number {
    return this.wasmEntityIndex;
  }

  setWasmEntityIndex(index: number): void {
    this.wasmEntityIndex = index;
    if (index >= 0) {
      this.syncToWasm(); // Initial sync to WASM
    }
  }

  // Physics property setters that sync to WASM
  setMass(mass: number): void {
    this.mass = mass;
    // WASM doesn't currently support per-entity mass, but we store it for future use
  }

  setRestitution(restitution: number): void {
    this.restitution = restitution;
    // WASM uses global restitution, but we store per-entity for future enhancement
  }

  setFriction(friction: number): void {
    this.friction = friction;
    // WASM doesn't currently support friction, but we store it for future use
  }

  setRadius(radius: number): void {
    this.radius = radius;
    // Radius affects collision detection in WASM
  }

  // Velocity control
  setVelocity(x: number, y: number, z: number): void {
    this.velocity.set(x, y, z);
    this.syncVelocityToWasm();
  }

  getVelocity(): Vector3 {
    return this.velocity.clone();
  }

  addVelocity(x: number, y: number, z: number): void {
    this.velocity.x += x;
    this.velocity.y += y;
    this.velocity.z += z;
    this.syncVelocityToWasm();
  }

  // Force application (for one frame)
  addForce(x: number, y: number, z: number): void {
    // Convert force to velocity change (F = ma, assuming mass = 1 for simplicity)
    this.addVelocity(x / this.mass, y / this.mass, z / this.mass);
  }

  // Impulse application (instantaneous velocity change)
  addImpulse(x: number, y: number, z: number): void {
    this.addVelocity(x, y, z);
  }

  // Position control (for kinematic bodies)
  setPosition(x: number, y: number, z: number): void {
    const transform = this.getComponent(Transform);
    if (transform) {
      transform.setPosition(x, y, z);
      this.syncToWasm();
    }
  }

  getPosition(): Vector3 {
    const transform = this.getComponent(Transform);
    return transform ? transform.getWorldPosition() : new Vector3();
  }

  // WASM synchronization methods
  private syncWithTransform(): void {
    const transform = this.getComponent(Transform);
    if (!transform) return;

    const worldPos = transform.getWorldPosition();
    this.lastSyncedPosition.copy(worldPos);
  }

  private syncToWasm(): void {
    if (this.wasmEntityIndex < 0) return;

    const scene = this.gameObject.getScene();
    if (!scene) return;

    // Get WASM exports through scene (we'll implement this in the Scene class)
    // For now, this is a placeholder
    const transform = this.getComponent(Transform);
    if (transform) {
      const worldPos = transform.getWorldPosition();
      
      // Scene will handle the actual WASM sync
      // scene.updateWasmEntityPosition(this.wasmEntityIndex, worldPos);
      // scene.updateWasmEntityVelocity(this.wasmEntityIndex, this.velocity);
      
      this.lastSyncedPosition.copy(worldPos);
      this.lastSyncedVelocity.copy(this.velocity);
    }
  }

  private syncFromWasm(): void {
    if (this.wasmEntityIndex < 0) return;

    const scene = this.gameObject.getScene();
    if (!scene) return;

    // Get current physics state from WASM
    // const wasmPos = scene.getWasmEntityPosition(this.wasmEntityIndex);
    // const wasmVel = scene.getWasmEntityVelocity(this.wasmEntityIndex);
    
    // For now, this is a placeholder - Scene class will implement the actual sync
    
    // Update Transform component with physics-simulated position
    const transform = this.getComponent(Transform);
    if (transform) {
      // transform.setPosition(wasmPos.x, wasmPos.y, wasmPos.z);
      // this.velocity.copy(wasmVel);
    }
  }

  private syncVelocityToWasm(): void {
    if (this.wasmEntityIndex < 0) return;

    const scene = this.gameObject.getScene();
    if (!scene) return;

    // Scene will handle the actual WASM velocity sync
    // scene.updateWasmEntityVelocity(this.wasmEntityIndex, this.velocity);
    
    this.lastSyncedVelocity.copy(this.velocity);
  }

  // Collision detection helpers
  getRadius(): number {
    return this.radius;
  }

  // Utility methods
  isMoving(): boolean {
    const velocityMagnitude = this.velocity.length();
    return velocityMagnitude > 0.001; // Small threshold for floating point precision
  }

  stop(): void {
    this.setVelocity(0, 0, 0);
  }

  // Physics state queries
  isGrounded(groundY: number = -8): boolean {
    const position = this.getPosition();
    return Math.abs(position.y - groundY - this.radius) < 0.1; // Small threshold
  }

  isFalling(): boolean {
    return this.velocity.y < -0.1; // Falling downward
  }

  isRising(): boolean {
    return this.velocity.y > 0.1; // Moving upward
  }

  // Debug information
  override toString(): string {
    const pos = this.getPosition();
    const vel = this.velocity;
    return `RigidBody(pos: ${pos.toString()}, vel: ${vel.toString()}, wasmIndex: ${this.wasmEntityIndex})`;
  }
}