// tests/camera-component.test.ts
// Unit tests for CameraComponent

import { CameraComponent } from '../src/engine/components';
import { GameObject } from '../src/engine/gameobject';
import { Scene } from '../src/engine/scene-system';

describe('CameraComponent', () => {
    let gameObject: GameObject;
    let cameraComponent: CameraComponent;
    let scene: Scene;

    beforeEach(() => {
        gameObject = new GameObject('camera-test', 'CameraTest');
        scene = new Scene();
        scene.addGameObject(gameObject);
    });

    describe('Construction', () => {
        test('should create CameraComponent with default perspective settings', () => {
            const camera = new CameraComponent();

            expect(camera.isPerspective).toBe(true);
            expect(camera.fov).toBeCloseTo(Math.PI / 4); // 45 degrees
            expect(camera.near).toBe(0.1);
            expect(camera.far).toBe(100);
        });

        test('should create CameraComponent with custom perspective settings', () => {
            const camera = new CameraComponent(true, Math.PI / 3, 0.5, 200);

            expect(camera.isPerspective).toBe(true);
            expect(camera.fov).toBeCloseTo(Math.PI / 3); // 60 degrees
            expect(camera.near).toBe(0.5);
            expect(camera.far).toBe(200);
        });

        test('should create CameraComponent with orthographic settings', () => {
            const orthoCamera = new CameraComponent(
                false,
                Math.PI / 4,
                0.1,
                100,
                { left: -10, right: 10, top: 10, bottom: -10 }
            );

            expect(orthoCamera.isPerspective).toBe(false);
            expect(orthoCamera.left).toBe(-10);
            expect(orthoCamera.right).toBe(10);
            expect(orthoCamera.top).toBe(10);
            expect(orthoCamera.bottom).toBe(-10);
        });

        test('should be an instance of CameraComponent', () => {
            cameraComponent = new CameraComponent();
            expect(cameraComponent).toBeInstanceOf(CameraComponent);
        });
    });

    describe('Projection Settings', () => {
        beforeEach(() => {
            cameraComponent = new CameraComponent();
        });

        test('should set perspective projection', () => {
            cameraComponent.setPerspective(Math.PI / 2, 0.5, 150);

            expect(cameraComponent.isPerspective).toBe(true);
            expect(cameraComponent.fov).toBeCloseTo(Math.PI / 2);
            expect(cameraComponent.near).toBe(0.5);
            expect(cameraComponent.far).toBe(150);
        });

        test('should set orthographic projection', () => {
            cameraComponent.setOrthographic(-20, 20, 15, -15, 1.0, 250);

            expect(cameraComponent.isPerspective).toBe(false);
            expect(cameraComponent.left).toBe(-20);
            expect(cameraComponent.right).toBe(20);
            expect(cameraComponent.top).toBe(15);
            expect(cameraComponent.bottom).toBe(-15);
            expect(cameraComponent.near).toBe(1.0);
            expect(cameraComponent.far).toBe(250);
        });

        test('should use default near/far when not provided in setPerspective', () => {
            cameraComponent.near = 0.2;
            cameraComponent.far = 80;

            cameraComponent.setPerspective(Math.PI / 6);

            expect(cameraComponent.fov).toBeCloseTo(Math.PI / 6);
            expect(cameraComponent.near).toBe(0.2); // Preserved
            expect(cameraComponent.far).toBe(80);   // Preserved
        });

        test('should use default near/far when not provided in setOrthographic', () => {
            cameraComponent.near = 0.3;
            cameraComponent.far = 120;

            cameraComponent.setOrthographic(-5, 5, 5, -5);

            expect(cameraComponent.left).toBe(-5);
            expect(cameraComponent.right).toBe(5);
            expect(cameraComponent.top).toBe(5);
            expect(cameraComponent.bottom).toBe(-5);
            expect(cameraComponent.near).toBe(0.3); // Preserved
            expect(cameraComponent.far).toBe(120);  // Preserved
        });
    });

    describe('Forward Direction Calculation', () => {
        // With no explicit lookAt target, getTarget() falls back to position + the Euler
        // forward direction (getForwardDirection). These assert that fallback.
        beforeEach(() => {
            cameraComponent = new CameraComponent();
            gameObject.addComponent(cameraComponent);
            gameObject.transform.setPosition(0, 0, 0);
        });

        test('should derive target from Euler forward with no rotation', () => {
            gameObject.transform.setRotation(0, 0, 0);

            const target = cameraComponent.getTarget();
            // Forward direction (0, 0, -1) with no rotation → target = position + forward.
            expect(target[0]).toBeCloseTo(0);
            expect(target[1]).toBeCloseTo(0);
            expect(target[2]).toBeCloseTo(-1);
        });

        test('should derive target from Euler forward with Y rotation', () => {
            gameObject.transform.setRotation(0, 90, 0); // 90 degree yaw

            const target = cameraComponent.getTarget();
            // 90 degree yaw should point right (positive X).
            expect(target[0]).toBeCloseTo(1, 5);
            expect(target[1]).toBeCloseTo(0, 5);
            expect(target[2]).toBeCloseTo(0, 5);
        });

        test('should derive target from Euler forward with X rotation (pitch)', () => {
            gameObject.transform.setRotation(45, 0, 0); // 45 degree pitch down

            const target = cameraComponent.getTarget();
            // 45 degree pitch should look down and forward.
            expect(target[0]).toBeCloseTo(0, 5);
            expect(target[1]).toBeCloseTo(-0.707, 2); // -sin(45°)
            expect(target[2]).toBeCloseTo(-0.707, 2); // -cos(45°)
        });
    });

    describe('Component Lifecycle', () => {
        test('should initialize properly when added to GameObject', () => {
            const newGameObject = new GameObject('camera-lifecycle', 'CameraLifecycle');
            const newCamera = new CameraComponent(false, Math.PI / 6, 0.2, 150);

            newGameObject.addComponent(newCamera);

            expect(newCamera.gameObject).toBe(newGameObject);
            expect(newGameObject.getComponent(CameraComponent)).toBe(newCamera);
        });

        test('should handle awake lifecycle', () => {
            cameraComponent = new CameraComponent();
            gameObject.addComponent(cameraComponent);

            expect(() => {
                cameraComponent.awake();
            }).not.toThrow();
        });

        test('should handle start lifecycle', () => {
            cameraComponent = new CameraComponent();
            gameObject.addComponent(cameraComponent);

            expect(() => {
                cameraComponent.start();
            }).not.toThrow();
        });

        test('should handle destroy lifecycle', () => {
            cameraComponent = new CameraComponent();
            gameObject.addComponent(cameraComponent);

            expect(() => {
                cameraComponent.destroy();
            }).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        test('should handle extreme FOV values', () => {
            cameraComponent = new CameraComponent();

            cameraComponent.setPerspective(Math.PI * 1.9); // Very wide FOV
            expect(cameraComponent.fov).toBeCloseTo(Math.PI * 1.9);

            cameraComponent.setPerspective(0.01); // Very narrow FOV
            expect(cameraComponent.fov).toBeCloseTo(0.01);
        });

        test('should handle extreme near/far values', () => {
            cameraComponent = new CameraComponent();

            cameraComponent.setPerspective(Math.PI / 4, 0.001, 10000);
            expect(cameraComponent.near).toBe(0.001);
            expect(cameraComponent.far).toBe(10000);
        });

        test('should handle extreme orthographic bounds', () => {
            cameraComponent = new CameraComponent();

            cameraComponent.setOrthographic(-1000, 1000, 500, -500);
            expect(cameraComponent.left).toBe(-1000);
            expect(cameraComponent.right).toBe(1000);
            expect(cameraComponent.top).toBe(500);
            expect(cameraComponent.bottom).toBe(-500);
        });
    });
});
