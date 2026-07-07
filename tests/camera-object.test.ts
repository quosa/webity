import { PerspectiveCamera, OrthographicCamera } from '../src/engine/camera-object';
import { GameObject } from '../src/engine/gameobject';
import { CameraComponent } from '../src/engine/components';
import { Camera } from '../src/engine/camera';

const aspect = 16 / 9;

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

    it('matches the legacy Camera view-projection for equal position/target/fov', () => {
        const fov = Math.PI / 3;
        const pos: [number, number, number] = [0, 0, -12];
        const tgt: [number, number, number] = [0, -5, 0];

        const legacy = new Camera(pos, tgt, fov, 0.1, 100);
        const cam = new PerspectiveCamera('main', { fov });
        cam.transform.setPosition(pos[0], pos[1], pos[2]);
        cam.lookAt(tgt[0], tgt[1], tgt[2]);

        const a = Array.from(legacy.getViewProjectionMatrix(aspect));
        const b = Array.from(cam.getViewProjectionMatrix(aspect));
        expect(b).toHaveLength(a.length);
        b.forEach((v, i) => expect(v).toBeCloseTo(a[i] as number, 5));
    });

    it('orthographic camera produces a 16-float VP matrix', () => {
        const cam = new OrthographicCamera('ortho', { bounds: { left: -4, right: 4, top: 4, bottom: -4 } });
        cam.transform.setPosition(0, 0, 10);
        cam.lookAt(0, 0, 0);
        expect(cam.getViewProjectionMatrix(aspect)).toHaveLength(16);
    });
});
