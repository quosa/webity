// src/v2/camera.ts
// Camera classes for 3D projection

import {
  createPerspectiveMatrix,
  createOrthographicMatrix,
  createLookAtMatrix,
  multiplyMat4
} from './math-utils';

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
    return createOrthographicMatrix(this.left, this.right, this.top, this.bottom, this.near, this.far);
  }
}
