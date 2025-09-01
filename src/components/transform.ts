// Transform component with hierarchical transforms and matrix calculations
import { Component } from './component.js';
import type { Vec3 } from '../types.js';

export class Vector3 implements Vec3 {
  // eslint-disable-next-line no-unused-vars
  constructor(public x = 0, public y = 0, public z = 0) {
    // Constructor parameters are used as public properties
  }

  set(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  copy(other: Vec3): void {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
  }

  add(other: Vec3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other: Vec3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  multiply(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize(): Vector3 {
    const len = this.length();
    if (len === 0) return new Vector3(0, 0, 0);
    return new Vector3(this.x / len, this.y / len, this.z / len);
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  toString(): string {
    return `Vector3(${this.x.toFixed(2)}, ${this.y.toFixed(2)}, ${this.z.toFixed(2)})`;
  }
}

export class Transform extends Component {
  // Local transform (relative to parent)
  public position: Vector3 = new Vector3();
  public rotation: Vector3 = new Vector3(); // Euler angles in degrees
  public scale: Vector3 = new Vector3(1, 1, 1);

  // Cached world transform
  private worldPosition: Vector3 = new Vector3();
  private worldRotation: Vector3 = new Vector3();
  private worldScale: Vector3 = new Vector3(1, 1, 1);
  private worldMatrix: Float32Array = new Float32Array(16);
  private matrixDirty = true;

  awake(): void {
    this.updateWorldTransform();
  }

  start(): void {
    // Transform is ready to use
  }

  update(_deltaTime: number): void {
    // Update world transform if needed
    if (this.matrixDirty) {
      this.updateWorldTransform();
    }
  }

  destroy(): void {
    // Clean up any transform-related resources
  }

  // Local transform setters (mark matrix as dirty)
  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.markDirty();
  }

  setRotation(x: number, y: number, z: number): void {
    this.rotation.set(x, y, z);
    this.markDirty();
  }

  setScale(x: number, y: number, z: number): void {
    this.scale.set(x, y, z);
    this.markDirty();
  }

  // World transform getters
  getWorldPosition(): Vector3 {
    if (this.matrixDirty) {
      this.updateWorldTransform();
    }
    return this.worldPosition.clone();
  }

  getWorldRotation(): Vector3 {
    if (this.matrixDirty) {
      this.updateWorldTransform();
    }
    return this.worldRotation.clone();
  }

  getWorldScale(): Vector3 {
    if (this.matrixDirty) {
      this.updateWorldTransform();
    }
    return this.worldScale.clone();
  }

  // Matrix access
  getWorldMatrix(): Float32Array {
    if (this.matrixDirty) {
      this.updateWorldTransform();
    }
    return this.worldMatrix;
  }

  // Hierarchy management
  private markDirty(): void {
    this.matrixDirty = true;
    
    // Mark all children as dirty too
    const children = this.gameObject.getChildren();
    for (const child of children) {
      const childTransform = child.getComponent(Transform);
      if (childTransform) {
        childTransform.markDirty();
      }
    }
  }

  private updateWorldTransform(): void {
    const parent = this.gameObject.getParent();
    const parentTransform = parent?.getComponent(Transform);

    if (parentTransform) {
      // Calculate world transform relative to parent
      const parentWorldPos = parentTransform.getWorldPosition();
      const parentWorldScale = parentTransform.getWorldScale();
      const parentWorldRot = parentTransform.getWorldRotation();
      
      // Simple transform composition (could be enhanced with proper matrix math)
      this.worldPosition.x = parentWorldPos.x + (this.position.x * parentWorldScale.x);
      this.worldPosition.y = parentWorldPos.y + (this.position.y * parentWorldScale.y);
      this.worldPosition.z = parentWorldPos.z + (this.position.z * parentWorldScale.z);
      
      this.worldRotation.x = parentWorldRot.x + this.rotation.x;
      this.worldRotation.y = parentWorldRot.y + this.rotation.y;
      this.worldRotation.z = parentWorldRot.z + this.rotation.z;
      
      this.worldScale.x = parentWorldScale.x * this.scale.x;
      this.worldScale.y = parentWorldScale.y * this.scale.y;
      this.worldScale.z = parentWorldScale.z * this.scale.z;
    } else {
      // No parent, world transform equals local transform
      this.worldPosition.copy(this.position);
      this.worldRotation.copy(this.rotation);
      this.worldScale.copy(this.scale);
    }

    // Update world matrix
    this.calculateWorldMatrix();
    this.matrixDirty = false;
  }

  private calculateWorldMatrix(): void {
    // Create transformation matrix from world position, rotation, scale
    const pos = this.worldPosition;
    const rot = this.worldRotation;
    const scale = this.worldScale;

    // Convert rotation from degrees to radians
    const rx = (rot.x * Math.PI) / 180;
    const ry = (rot.y * Math.PI) / 180;
    const rz = (rot.z * Math.PI) / 180;

    // Calculate rotation matrix elements
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);

    // Combined rotation matrix (ZYX order)
    const m00 = cy * cz;
    const m01 = -cy * sz;
    const m02 = sy;
    
    const m10 = sx * sy * cz + cx * sz;
    const m11 = -sx * sy * sz + cx * cz;
    const m12 = -sx * cy;
    
    const m20 = -cx * sy * cz + sx * sz;
    const m21 = cx * sy * sz + sx * cz;
    const m22 = cx * cy;

    // Apply scale and translation
    this.worldMatrix[0] = m00 * scale.x;
    this.worldMatrix[1] = m10 * scale.x;
    this.worldMatrix[2] = m20 * scale.x;
    this.worldMatrix[3] = 0;

    this.worldMatrix[4] = m01 * scale.y;
    this.worldMatrix[5] = m11 * scale.y;
    this.worldMatrix[6] = m21 * scale.y;
    this.worldMatrix[7] = 0;

    this.worldMatrix[8] = m02 * scale.z;
    this.worldMatrix[9] = m12 * scale.z;
    this.worldMatrix[10] = m22 * scale.z;
    this.worldMatrix[11] = 0;

    this.worldMatrix[12] = pos.x;
    this.worldMatrix[13] = pos.y;
    this.worldMatrix[14] = pos.z;
    this.worldMatrix[15] = 1;
  }

  // Utility methods for common transform operations
  translate(x: number, y: number, z: number): void {
    this.position.x += x;
    this.position.y += y;
    this.position.z += z;
    this.markDirty();
  }

  rotate(x: number, y: number, z: number): void {
    this.rotation.x += x;
    this.rotation.y += y;
    this.rotation.z += z;
    this.markDirty();
  }

  // Direction vectors (useful for movement)
  forward(): Vector3 {
    // Calculate forward vector from rotation
    const ry = (this.worldRotation.y * Math.PI) / 180;
    return new Vector3(-Math.sin(ry), 0, -Math.cos(ry));
  }

  right(): Vector3 {
    // Calculate right vector from rotation
    const ry = (this.worldRotation.y * Math.PI) / 180;
    return new Vector3(Math.cos(ry), 0, -Math.sin(ry));
  }

  up(): Vector3 {
    return new Vector3(0, 1, 0);
  }
}