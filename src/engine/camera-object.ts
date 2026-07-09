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

abstract class CameraObject extends GameObject {
    readonly cameraComponent: CameraComponent;

    protected constructor(id: string, cameraComponent: CameraComponent) {
        super(id, 'Camera');
        this.cameraComponent = cameraComponent;
        this.addComponent(cameraComponent);
    }

    /** Aim the camera at a world-space point. */
    lookAt(x: number, y: number, z: number): void {
        this.cameraComponent.lookAt(x, y, z);
    }

    getViewProjectionMatrix(aspect: number): Float32Array {
        return this.cameraComponent.getViewProjectionMatrix(aspect);
    }
}

export class PerspectiveCamera extends CameraObject {
    constructor(id: string, opts: { fov?: number; near?: number; far?: number } = {}) {
        super(id, new CameraComponent(true, opts.fov ?? Math.PI / 4, opts.near ?? 0.1, opts.far ?? 100));
    }
}

export class OrthographicCamera extends CameraObject {
    constructor(
        id: string,
        opts: { bounds?: { left: number; right: number; top: number; bottom: number }; near?: number; far?: number } = {},
    ) {
        const bounds = opts.bounds ?? { left: -5, right: 5, top: 5, bottom: -5 };
        super(id, new CameraComponent(false, Math.PI / 4, opts.near ?? 0.1, opts.far ?? 100, bounds));
    }
}
