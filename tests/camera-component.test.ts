// tests/camera-component.test.ts
// Unit tests for CameraComponent
import { jest } from '@jest/globals';

import { CameraComponent } from '../src/components';
import { GameObject } from '../src/gameobject';
import { Scene } from '../src/scene-system';

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
            expect(camera.isActiveCamera).toBe(false);
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

    describe('Active Camera Management', () => {
        beforeEach(() => {
            cameraComponent = new CameraComponent();
            gameObject.addComponent(cameraComponent);
        });

        test('should set camera as active', () => {
            expect(cameraComponent.isActiveCamera).toBe(false);

            cameraComponent.setAsActiveCamera();

            expect(cameraComponent.isActiveCamera).toBe(true);
        });

        test('should handle setAsActiveCamera without scene', () => {
            const isolatedGameObject = new GameObject('isolated', 'Isolated');
            const isolatedCamera = new CameraComponent();
            isolatedGameObject.addComponent(isolatedCamera);

            expect(() => {
                isolatedCamera.setAsActiveCamera();
            }).not.toThrow();

            expect(isolatedCamera.isActiveCamera).toBe(true);
        });

        test('should update scene camera when set as active', () => {
            // Mock scene camera methods
            const mockSceneCamera = {
                setPosition: jest.fn(),
                setTarget: jest.fn(),
                setClipPlanes: jest.fn(),
                setFov: jest.fn()
            };
            scene.camera = mockSceneCamera as any;

            // Set initial transform
            gameObject.transform.setPosition(5, 10, -15);

            cameraComponent.setAsActiveCamera();

            expect(mockSceneCamera.setPosition).toHaveBeenCalledWith([5, 10, -15]);
            expect(mockSceneCamera.setClipPlanes).toHaveBeenCalledWith(0.1, 100);
            expect(mockSceneCamera.setFov).toHaveBeenCalledWith(Math.PI / 4);
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
        beforeEach(() => {
            cameraComponent = new CameraComponent();
            gameObject.addComponent(cameraComponent);
        });

        test('should calculate forward direction with no rotation', () => {
            gameObject.transform.setRotation(0, 0, 0);

            // Call private method through update (which calls updateSceneCamera → getForwardDirection)
            const mockSceneCamera = {
                setPosition: jest.fn(),
                setTarget: jest.fn((target: [number, number, number]) => {
                    // Forward direction should be (0, 0, -1) with no rotation
                    // Target = position + forward = (0, 0, 0) + (0, 0, -1) = (0, 0, -1)
                    expect(target[0]).toBeCloseTo(0);
                    expect(target[1]).toBeCloseTo(0);
                    expect(target[2]).toBeCloseTo(-1);
                }),
                setClipPlanes: jest.fn(),
                setFov: jest.fn()
            };
            scene.camera = mockSceneCamera as any;

            cameraComponent.setAsActiveCamera();
        });

        test('should calculate forward direction with Y rotation', () => {
            gameObject.transform.setRotation(0, 90, 0); // 90 degree yaw

            const mockSceneCamera = {
                setPosition: jest.fn(),
                setTarget: jest.fn((target: [number, number, number]) => {
                    // 90 degree yaw should point right (positive X)
                    expect(target[0]).toBeCloseTo(1, 5);  // Should be approximately 1
                    expect(target[1]).toBeCloseTo(0, 5);  // Should be approximately 0
                    expect(target[2]).toBeCloseTo(0, 5);  // Should be approximately 0
                }),
                setClipPlanes: jest.fn(),
                setFov: jest.fn()
            };
            scene.camera = mockSceneCamera as any;

            cameraComponent.setAsActiveCamera();
        });

        test('should calculate forward direction with X rotation (pitch)', () => {
            gameObject.transform.setRotation(45, 0, 0); // 45 degree pitch down

            const mockSceneCamera = {
                setPosition: jest.fn(),
                setTarget: jest.fn((target: [number, number, number]) => {
                    // 45 degree pitch should look down and forward
                    expect(target[0]).toBeCloseTo(0, 5);     // No yaw, so X should be 0
                    expect(target[1]).toBeCloseTo(-0.707, 2); // -sin(45°) ≈ -0.707 (looking down)
                    expect(target[2]).toBeCloseTo(-0.707, 2); // -cos(45°) ≈ -0.707 (forward component)
                }),
                setClipPlanes: jest.fn(),
                setFov: jest.fn()
            };
            scene.camera = mockSceneCamera as any;

            cameraComponent.setAsActiveCamera();
        });
    });

    describe('Update Lifecycle', () => {
        beforeEach(() => {
            cameraComponent = new CameraComponent();
            gameObject.addComponent(cameraComponent);
        });

        test('should update scene camera when active', () => {
            const mockSceneCamera = {
                setPosition: jest.fn(),
                setTarget: jest.fn(),
                setClipPlanes: jest.fn(),
                setFov: jest.fn()
            };
            scene.camera = mockSceneCamera as any;

            cameraComponent.setAsActiveCamera();

            // Clear previous calls
            mockSceneCamera.setPosition.mockClear();
            mockSceneCamera.setTarget.mockClear();

            // Update should trigger scene camera update
            cameraComponent.update(0.016);

            expect(mockSceneCamera.setPosition).toHaveBeenCalled();
            expect(mockSceneCamera.setTarget).toHaveBeenCalled();
        });

        test('should not update scene camera when inactive', () => {
            const mockSceneCamera = {
                setPosition: jest.fn(),
                setTarget: jest.fn(),
                setClipPlanes: jest.fn(),
                setFov: jest.fn()
            };
            scene.camera = mockSceneCamera as any;

            // Don't set as active camera
            expect(cameraComponent.isActiveCamera).toBe(false);

            cameraComponent.update(0.016);

            // Should not call scene camera methods
            expect(mockSceneCamera.setPosition).not.toHaveBeenCalled();
            expect(mockSceneCamera.setTarget).not.toHaveBeenCalled();
        });

        test('should handle update without scene', () => {
            const isolatedGameObject = new GameObject('isolated', 'Isolated');
            const isolatedCamera = new CameraComponent();
            isolatedGameObject.addComponent(isolatedCamera);
            isolatedCamera.setAsActiveCamera();

            expect(() => {
                isolatedCamera.update(0.016);
            }).not.toThrow();
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

        test('should handle GameObject without scene in updateSceneCamera', () => {
            const isolatedGameObject = new GameObject('isolated', 'Isolated');
            const isolatedCamera = new CameraComponent();
            isolatedGameObject.addComponent(isolatedCamera);

            // This should not throw even though gameObject.scene is undefined
            expect(() => {
                isolatedCamera.setAsActiveCamera();
            }).not.toThrow();
        });
    });
});
