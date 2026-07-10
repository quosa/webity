import { PerspectiveCamera, OrthographicCamera } from '../src/engine/camera-object';
import { GameObject } from '../src/engine/gameobject';
import { CameraComponent } from '../src/engine/components';
import { createPerspectiveMatrix, createOrthographicMatrix, createLookAtMatrix, multiplyMat4 } from '../src/utils/math-utils';

const aspect = 16 / 9;

function expectMatClose(actual: Float32Array, expected: Float32Array): void {
    const a = Array.from(actual);
    const b = Array.from(expected);
    expect(a).toHaveLength(b.length);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i] as number, 5));
}

describe('Camera GameObjects (3a unified Transform)', () => {
    it('is a GameObject carrying a CameraComponent', () => {
        const cam = new PerspectiveCamera('main');
        expect(cam).toBeInstanceOf(GameObject);
        expect(cam.getComponent(CameraComponent)).toBe(cam.cameraComponent);
    });

    it('uses transform.position as the camera position', () => {
        const cam = new PerspectiveCamera('main');
        cam.transform.setPosition(0, 0, -12);
        cam.lookAt(0, -5, 0);
        const vp1 = Array.from(cam.getViewProjectionMatrix(aspect));
        cam.transform.setPosition(3, 0, -12); // move the camera
        const vp2 = Array.from(cam.getViewProjectionMatrix(aspect));
        expect(vp2).not.toEqual(vp1);
    });

    it('produces the expected view-projection for a given position/target/fov', () => {
        const fov = Math.PI / 3;
        const pos: [number, number, number] = [0, 0, -12];
        const tgt: [number, number, number] = [0, -5, 0];

        const cam = new PerspectiveCamera('main', { fov });
        cam.transform.setPosition(pos[0], pos[1], pos[2]);
        cam.lookAt(tgt[0], tgt[1], tgt[2]);

        const expected = multiplyMat4(
            createPerspectiveMatrix(fov, aspect, 0.1, 100),
            createLookAtMatrix(pos, tgt, [0, 1, 0]),
        );
        expectMatClose(cam.getViewProjectionMatrix(aspect), expected);
    });

    it('orthographic camera produces a 16-float VP matrix', () => {
        const cam = new OrthographicCamera('ortho', { bounds: { left: -4, right: 4, top: 4, bottom: -4 } });
        cam.transform.setPosition(0, 0, 10);
        cam.lookAt(0, 0, 0);
        expect(cam.getViewProjectionMatrix(aspect)).toHaveLength(16);
    });

    it('perspective camera projection matches createPerspectiveMatrix for its defaults', () => {
        const cam = new PerspectiveCamera('main'); // fov=π/4, near=0.1, far=100
        expectMatClose(
            cam.cameraComponent.getProjectionMatrix(aspect),
            createPerspectiveMatrix(Math.PI / 4, aspect, 0.1, 100),
        );
    });

    it('perspective camera projection honours explicit fov/near/far options', () => {
        const cam = new PerspectiveCamera('main', { fov: Math.PI / 3, near: 0.5, far: 250 });
        expectMatClose(
            cam.cameraComponent.getProjectionMatrix(aspect),
            createPerspectiveMatrix(Math.PI / 3, aspect, 0.5, 250),
        );
    });

    it('orthographic camera projection matches createOrthographicMatrix for its bounds', () => {
        const bounds = { left: -4, right: 4, top: 4, bottom: -4 };
        const cam = new OrthographicCamera('ortho', { bounds }); // near=0.1, far=100
        expectMatClose(
            cam.cameraComponent.getProjectionMatrix(aspect),
            createOrthographicMatrix(bounds.left, bounds.right, bounds.top, bounds.bottom, 0.1, 100),
        );
    });
});
