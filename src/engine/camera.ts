// src/v2/camera.ts
// Camera classes for 3D projection

import {
    createPerspectiveMatrix,
    createOrthographicMatrix,
    createLookAtMatrix,
    multiplyMat4,
} from '../utils/math-utils';

export abstract class BaseCamera {
    protected position: [number, number, number];
    protected target: [number, number, number];
    protected up: [number, number, number];
    protected near: number;
    protected far: number;

    constructor(
        position: [number, number, number] = [0, 0, 5],
        target: [number, number, number] = [0, 0, 0],
        up: [number, number, number] = [0, 1, 0],
        near: number = 0.1,
        far: number = 100
    ) {
        this.position = position;
        this.target = target;
        this.up = up;
        this.near = near;
        this.far = far;
    }

    setPosition(position: [number, number, number]): void {
        this.position = position;
    }

    setTarget(target: [number, number, number]): void {
        this.target = target;
    }

    setUp(up: [number, number, number]): void {
        this.up = up;
    }

    setClipPlanes(near: number, far: number): void {
        this.near = near;
        this.far = far;
    }

    // Getters for accessing protected properties
    getPosition(): [number, number, number] {
        return [...this.position] as [number, number, number];
    }

    getTarget(): [number, number, number] {
        return [...this.target] as [number, number, number];
    }

    getUp(): [number, number, number] {
        return [...this.up] as [number, number, number];
    }

    // Camera movement methods
    move(forward: number, right: number, up: number): void {
        // Calculate camera's local axes
        const direction = this.getForwardVector();
        const rightVector = this.getRightVector();
        const upVector = this.getUpVector();

        // Apply movement
        this.position[0] += direction[0] * forward + rightVector[0] * right + upVector[0] * up;
        this.position[1] += direction[1] * forward + rightVector[1] * right + upVector[1] * up;
        this.position[2] += direction[2] * forward + rightVector[2] * right + upVector[2] * up;

        // Update target to maintain relative position
        this.target[0] += direction[0] * forward + rightVector[0] * right + upVector[0] * up;
        this.target[1] += direction[1] * forward + rightVector[1] * right + upVector[1] * up;
        this.target[2] += direction[2] * forward + rightVector[2] * right + upVector[2] * up;
    }

    // Look at a specific point
    lookAt(target: [number, number, number]): void {
        this.setTarget(target);
    }

    // Orbit around the current target
    orbitAroundTarget(yaw: number, pitch: number): void {
        // Calculate current position relative to target
        const dx = this.position[0] - this.target[0];
        const dy = this.position[1] - this.target[1];
        const dz = this.position[2] - this.target[2];
        
        const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Apply yaw and pitch rotations
        const currentYaw = Math.atan2(dx, dz);
        const currentPitch = Math.asin(dy / radius);
        
        const newYaw = currentYaw + yaw;
        const newPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, currentPitch + pitch));
        
        // Calculate new position
        this.position[0] = this.target[0] + radius * Math.sin(newYaw) * Math.cos(newPitch);
        this.position[1] = this.target[1] + radius * Math.sin(newPitch);
        this.position[2] = this.target[2] + radius * Math.cos(newYaw) * Math.cos(newPitch);
    }

    // Get forward vector (direction camera is looking)
    private getForwardVector(): [number, number, number] {
        const dx = this.target[0] - this.position[0];
        const dy = this.target[1] - this.position[1];
        const dz = this.target[2] - this.position[2];
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return [dx / length, dy / length, dz / length];
    }

    // Get right vector (camera's local X axis)
    private getRightVector(): [number, number, number] {
        const forward = this.getForwardVector();
        // Cross product: right = forward × up
        const rx = forward[1] * this.up[2] - forward[2] * this.up[1];
        const ry = forward[2] * this.up[0] - forward[0] * this.up[2];
        const rz = forward[0] * this.up[1] - forward[1] * this.up[0];
        const length = Math.sqrt(rx * rx + ry * ry + rz * rz);
        return [rx / length, ry / length, rz / length];
    }

    // Get up vector (camera's local Y axis)
    private getUpVector(): [number, number, number] {
        return [...this.up] as [number, number, number];
    }

    abstract getProjectionMatrix(_aspect: number): Float32Array;

    getViewMatrix(): Float32Array {
        return createLookAtMatrix(this.position, this.target, this.up);
    }

    getViewProjectionMatrix(aspect: number): Float32Array {
        const projectionMatrix = this.getProjectionMatrix(aspect);
        const viewMatrix = this.getViewMatrix();
        return multiplyMat4(projectionMatrix, viewMatrix);
    }
}

export class Camera extends BaseCamera {
    private fov: number;

    constructor(
        position: [number, number, number] = [0, 0, 5],
        target: [number, number, number] = [0, 0, 0],
        fov: number = Math.PI / 4,
        near: number = 0.1,
        far: number = 100
    ) {
        super(position, target, [0, 1, 0], near, far);
        this.fov = fov;
    }

    setFov(fov: number): void {
        this.fov = fov;
    }

    getProjectionMatrix(aspect: number): Float32Array {
        return createPerspectiveMatrix(this.fov, aspect, this.near, this.far);
    }
}

export class OrthographicCamera extends BaseCamera {
    private left: number;
    private right: number;
    private top: number;
    private bottom: number;

    constructor(
        left: number = -5,
        right: number = 5,
        top: number = 5,
        bottom: number = -5,
        near: number = 0.1,
        far: number = 100,
        position: [number, number, number] = [0, 0, 5],
        target: [number, number, number] = [0, 0, 0]
    ) {
        super(position, target, [0, 1, 0], near, far);
        this.left = left;
        this.right = right;
        this.top = top;
        this.bottom = bottom;
    }

    setBounds(left: number, right: number, top: number, bottom: number): void {
        this.left = left;
        this.right = right;
        this.top = top;
        this.bottom = bottom;
    }

    getProjectionMatrix(_aspect: number): Float32Array {
        return createOrthographicMatrix(
            this.left,
            this.right,
            this.top,
            this.bottom,
            this.near,
            this.far
        );
    }
}
