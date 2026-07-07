// Camera GameObjects (3a unified-Transform model).
//
// A camera is just a GameObject with a CameraComponent: its position is the shared
// `transform.position` (so it lives in the scene graph, can be parented, and is uniform
// with every other object), and `lookAt` sets the camera's look direction. Projection
// (perspective/ortho + near/far) lives on the CameraComponent. The view matrix reuses the
// proven eye/target/up look-at math (see CameraComponent) — quaternion orientation on the
// Transform itself is a later upgrade.

import { GameObject } from './gameobject';
import { CameraComponent } from './components';

export class PerspectiveCamera extends GameObject {
    readonly cameraComponent: CameraComponent;

    constructor(id: string, opts: { fov?: number; near?: number; far?: number } = {}) {
        super(id, 'Camera');
        this.cameraComponent = new CameraComponent(true, opts.fov ?? Math.PI / 4, opts.near ?? 0.1, opts.far ?? 100);
        this.addComponent(this.cameraComponent);
    }

    /** Aim the camera at a world-space point. */
    lookAt(x: number, y: number, z: number): void {
        this.cameraComponent.lookAt(x, y, z);
    }

    setFov(fov: number): void {
        this.cameraComponent.fov = fov;
    }

    getViewProjectionMatrix(aspect: number): Float32Array {
        return this.cameraComponent.getViewProjectionMatrix(aspect);
    }
}

export class OrthographicCamera extends GameObject {
    readonly cameraComponent: CameraComponent;

    constructor(
        id: string,
        opts: { bounds?: { left: number; right: number; top: number; bottom: number }; near?: number; far?: number } = {},
    ) {
        super(id, 'Camera');
        const bounds = opts.bounds ?? { left: -5, right: 5, top: 5, bottom: -5 };
        this.cameraComponent = new CameraComponent(false, Math.PI / 4, opts.near ?? 0.1, opts.far ?? 100, bounds);
        this.addComponent(this.cameraComponent);
    }

    lookAt(x: number, y: number, z: number): void {
        this.cameraComponent.lookAt(x, y, z);
    }

    setBounds(left: number, right: number, top: number, bottom: number): void {
        this.cameraComponent.setOrthographic(left, right, top, bottom);
    }

    getViewProjectionMatrix(aspect: number): Float32Array {
        return this.cameraComponent.getViewProjectionMatrix(aspect);
    }
}
