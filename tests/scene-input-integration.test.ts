// tests/scene-input-integration.test.ts
// Integration tests for Scene system input management

import { Scene } from '../src/engine/scene-system';
import { GameObject } from '../src/engine/gameobject';
import { RigidBody, MeshRenderer } from '../src/engine/components';
import { CameraController, GameObjectController, OrbitCameraController } from '../src/engine/input-controller';

// Mock WebGPU renderer for testing
class MockRenderer {
    init = jest.fn();
    getMeshIndex = jest.fn().mockReturnValue(0);
    mapInstanceDataFromWasm = jest.fn();
    getAspectRatio = jest.fn().mockReturnValue(1.0);
    updateCamera = jest.fn();
    render = jest.fn();
}

// Mock WASM physics bridge for testing
class MockWasmPhysicsBridge {
    init = jest.fn();
    addEntity = jest.fn().mockReturnValue(42);
    applyForce = jest.fn();
    setEntityVelocity = jest.fn();
    setEntityPosition = jest.fn();
    update = jest.fn();
    getStats = jest.fn().mockReturnValue({ entityCount: 1, isInitialized: true });
    hasWasmModule = jest.fn().mockReturnValue(true);
    getWasmMemory = jest.fn().mockReturnValue(new ArrayBuffer(1024));
    getEntityTransformsOffset = jest.fn().mockReturnValue(0);
    getWasmModule = jest.fn().mockReturnValue({});
}

describe('Scene Input Integration', () => {
    let scene: Scene;
    let mockRenderer: MockRenderer;

    beforeEach(async () => {
        scene = new Scene();
        mockRenderer = new MockRenderer();

        // Replace physics bridge with mock
        (scene as any).physicsBridge = new MockWasmPhysicsBridge();

        // Initialize scene with mock renderer
        await scene.init(mockRenderer as any);

        jest.clearAllMocks();
    });

    afterEach(() => {
        scene.dispose();
    });

    describe('Input Target Management', () => {
        test('should initialize with camera input target by default', () => {
            expect(scene.getInputTarget()).toBe('camera');
            expect(scene.getInputController()).toBeInstanceOf(CameraController);
        });

        test('should switch to orbit camera control', () => {
            scene.setInputTarget('orbit');

            expect(scene.getInputTarget()).toBe('orbit');
            expect(scene.getInputController()).toBeInstanceOf(OrbitCameraController);
        });

        test('should switch to GameObject control', () => {
            const gameObject = new GameObject('test-player');
            const rigidBody = new RigidBody(1.0, false);
            gameObject.addComponent(rigidBody);
            scene.addGameObject(gameObject);

            scene.setInputTarget(gameObject);

            expect(scene.getInputTarget()).toBe(gameObject);
            expect(scene.getInputController()).toBeInstanceOf(GameObjectController);
        });

        test('should disable input when set to null', () => {
            scene.setInputTarget(null);

            expect(scene.getInputTarget()).toBeNull();
            expect(scene.getInputController()).toBeNull();
        });

        test('should return correct typed controllers', () => {
            // Test camera controller getter
            scene.setInputTarget('camera');
            const cameraController = scene.getCameraController();
            expect(cameraController).toBeInstanceOf(CameraController);
            expect(scene.getGameObjectController()).toBeUndefined();
            expect(scene.getOrbitCameraController()).toBeUndefined();

            // Test orbit controller getter
            scene.setInputTarget('orbit');
            const orbitController = scene.getOrbitCameraController();
            expect(orbitController).toBeInstanceOf(OrbitCameraController);
            expect(scene.getCameraController()).toBeUndefined();
            expect(scene.getGameObjectController()).toBeUndefined();

            // Test GameObject controller getter
            const gameObject = new GameObject('test');
            gameObject.addComponent(new RigidBody());
            scene.addGameObject(gameObject);
            scene.setInputTarget(gameObject);

            const gameObjectController = scene.getGameObjectController();
            expect(gameObjectController).toBeInstanceOf(GameObjectController);
            expect(scene.getCameraController()).toBeUndefined();
            expect(scene.getOrbitCameraController()).toBeUndefined();
        });
    });

    describe('Input Event Dispatching', () => {
        test('should dispatch input target change events', () => {
            const eventListener = jest.fn();
            window.addEventListener('inputTargetChanged', eventListener);

            const testObject = new GameObject('test-target');
            scene.setInputTarget(testObject);

            expect(eventListener).toHaveBeenCalledWith(
                expect.objectContaining({
                    detail: expect.objectContaining({
                        target: testObject,
                        controller: expect.any(GameObjectController)
                    })
                })
            );

            window.removeEventListener('inputTargetChanged', eventListener);
        });

        test('should dispatch events for all input target types', () => {
            const eventListener = jest.fn();
            window.addEventListener('inputTargetChanged', eventListener);

            // Test camera target
            scene.setInputTarget('camera');
            expect(eventListener).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    detail: expect.objectContaining({
                        target: 'camera',
                        controller: expect.any(CameraController)
                    })
                })
            );

            // Test orbit target
            scene.setInputTarget('orbit');
            expect(eventListener).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    detail: expect.objectContaining({
                        target: 'orbit',
                        controller: expect.any(OrbitCameraController)
                    })
                })
            );

            // Test null target
            scene.setInputTarget(null);
            expect(eventListener).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    detail: expect.objectContaining({
                        target: null,
                        controller: null
                    })
                })
            );

            window.removeEventListener('inputTargetChanged', eventListener);
        });
    });

    describe('Scene Update Integration', () => {
        test('should call input controller update during scene update', () => {
            const mockController = {
                handleInput: jest.fn(),
                update: jest.fn()
            };

            // Replace active controller with mock
            (scene as any).activeInputController = mockController;

            scene.update(0.016);

            expect(mockController.update).toHaveBeenCalledWith(0.016);
        });

        test('should handle scene update with null input controller', () => {
            scene.setInputTarget(null);

            expect(() => scene.update(0.016)).not.toThrow();
        });

        test('should call input controller before other scene systems', () => {
            const updateOrder: string[] = [];

            const mockController = {
                handleInput: jest.fn(),
                update: jest.fn(() => updateOrder.push('input'))
            };

            // Mock physics bridge update to track order
            const originalUpdate = (scene as any).physicsBridge.update;
            (scene as any).physicsBridge.update = jest.fn(() => updateOrder.push('physics'));

            (scene as any).activeInputController = mockController;

            scene.update(0.016);

            expect(updateOrder).toEqual(['input', 'physics']);

            // Restore original update
            (scene as any).physicsBridge.update = originalUpdate;
        });
    });

    describe('GameObject Integration', () => {
        test('should properly configure GameObjectController with physics entity', () => {
            const gameObject = new GameObject('physics-object');

            // Add required components
            const meshRenderer = new MeshRenderer('cube', 'default', 'triangles');
            const rigidBody = new RigidBody(1.0, false);

            gameObject.addComponent(meshRenderer);
            gameObject.addComponent(rigidBody);

            scene.addGameObject(gameObject);
            scene.setInputTarget(gameObject);

            const controller = scene.getGameObjectController();
            expect(controller).toBeDefined();
            expect(controller?.getGameObject()).toBe(gameObject);
        });

        test('should handle GameObjects without physics components', () => {
            const staticObject = new GameObject('static-object');
            const meshRenderer = new MeshRenderer('cube', 'default', 'triangles');
            staticObject.addComponent(meshRenderer);

            scene.addGameObject(staticObject);

            // Should not crash when setting non-physics object as input target
            expect(() => scene.setInputTarget(staticObject)).not.toThrow();

            const controller = scene.getGameObjectController();
            expect(controller).toBeInstanceOf(GameObjectController);
        });
    });

    describe('Scene Disposal', () => {
        test('should clean up input resources on dispose', () => {
            const mockInputManager = {
                init: jest.fn(),
                dispose: jest.fn()
            };

            // Replace input manager with mock
            (scene as any).inputManager = mockInputManager;

            scene.dispose();

            expect(mockInputManager.dispose).toHaveBeenCalled();
            expect(scene.getInputController()).toBeNull();
            expect(scene.getInputTarget()).toBeNull();
        });

        test('should handle disposal with null input manager', () => {
            (scene as any).inputManager = null;

            expect(() => scene.dispose()).not.toThrow();
        });
    });

    describe('Error Handling', () => {
        test('should handle input controller errors gracefully', () => {
            const faultyController = {
                handleInput: jest.fn(),
                update: jest.fn().mockImplementation(() => {
                    throw new Error('Controller error');
                })
            };

            (scene as any).activeInputController = faultyController;

            // Should not crash the entire scene update
            expect(() => scene.update(0.016)).toThrow('Controller error');
        });

        test('should handle missing WASM entity ID gracefully', () => {
            const gameObject = new GameObject('no-entity-id');
            const rigidBody = new RigidBody(1.0, false);
            // Don't set entity ID to simulate missing WASM registration
            gameObject.addComponent(rigidBody);
            scene.addGameObject(gameObject);

            scene.setInputTarget(gameObject);
            const controller = scene.getGameObjectController();

            // Should not crash when trying to apply forces without entity ID
            expect(() => {
                (controller as any).handleInput(87, true);
                (controller as any).update(0.1);
            }).not.toThrow();
        });
    });

    describe('Performance Considerations', () => {
        test('should not create new controllers unnecessarily', () => {
            const gameObject = new GameObject('test');
            scene.addGameObject(gameObject);

            scene.setInputTarget(gameObject);
            const controller1 = scene.getInputController();

            scene.setInputTarget(gameObject); // Set same target again
            const controller2 = scene.getInputController();

            // Should create new controller each time for consistency
            expect(controller1).not.toBe(controller2);
        });

        test('should handle rapid input target switching', () => {
            const gameObject = new GameObject('test');
            scene.addGameObject(gameObject);

            // Rapid switching should not cause issues
            for (let i = 0; i < 100; i++) {
                scene.setInputTarget(i % 2 === 0 ? 'camera' : gameObject);
            }

            expect(scene.getInputController()).toBeDefined();
        });
    });
});