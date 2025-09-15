// tests/input-controller.test.ts
// Unit tests for input controller system

import { Camera } from '../src/engine/camera';
import { GameObject } from '../src/engine/gameobject';
import { RigidBody } from '../src/engine/components';
import { CameraController, GameObjectController, OrbitCameraController } from '../src/engine/input-controller';

// Mock Scene class for testing
class MockScene {
    public physicsBridge = {
        applyForce: jest.fn(),
        setEntityVelocity: jest.fn(),
        setEntityPosition: jest.fn()
    };
}

describe('Input Controller System', () => {
    let camera: Camera;
    let mockScene: MockScene;

    beforeEach(() => {
        camera = new Camera([0, 0, 5], [0, 0, 0]);
        mockScene = new MockScene();
        jest.clearAllMocks();
    });

    describe('CameraController', () => {
        let controller: CameraController;

        beforeEach(() => {
            controller = new CameraController(camera, 5.0);
        });

        test('should initialize with correct default values', () => {
            expect(controller.getMoveSpeed()).toBe(5.0);
        });

        test('should handle key input correctly', () => {
            // Simulate W key press (move forward)
            controller.handleInput(87, true);

            const initialPosition = camera.getPosition();
            controller.update(0.1); // 100ms delta

            const newPosition = camera.getPosition();

            // Camera should have moved forward (negative Z direction)
            expect(newPosition[2]).toBeLessThan(initialPosition[2]);
        });

        test('should handle multiple simultaneous inputs', () => {
            const initialPosition = camera.getPosition();

            // Press W (forward) and D (right) simultaneously
            controller.handleInput(87, true); // W
            controller.handleInput(68, true); // D

            controller.update(0.1);

            const newPosition = camera.getPosition();

            // Should move both forward and right
            expect(newPosition[2]).toBeLessThan(initialPosition[2]); // Forward
            expect(newPosition[0]).toBeGreaterThan(initialPosition[0]); // Right
        });

        test('should stop movement when keys are released', () => {
            // Press and hold W
            controller.handleInput(87, true);
            controller.update(0.1);

            const positionAfterMove = camera.getPosition();

            // Release W
            controller.handleInput(87, false);
            controller.update(0.1);

            const finalPosition = camera.getPosition();

            // Position should not change after key release
            expect(finalPosition).toEqual(positionAfterMove);
        });

        test('should respect move speed setting', () => {
            controller.setMoveSpeed(10.0);
            expect(controller.getMoveSpeed()).toBe(10.0);

            const initialPosition = camera.getPosition();
            controller.handleInput(87, true); // W key
            controller.update(0.1);

            const distance = Math.abs(camera.getPosition()[2] - initialPosition[2]);
            expect(distance).toBeCloseTo(1.0, 1); // 10.0 speed * 0.1 delta = 1.0
        });

        test('should handle vertical movement with Space and minus keys', () => {
            const initialPosition = camera.getPosition();

            // Press Space (up)
            controller.handleInput(32, true);
            controller.update(0.1);

            const positionAfterUp = camera.getPosition();
            expect(positionAfterUp[1]).toBeGreaterThan(initialPosition[1]);

            // Release Space, press minus (down)
            controller.handleInput(32, false);
            controller.handleInput(45, true);
            controller.update(0.1);

            const finalPosition = camera.getPosition();
            expect(finalPosition[1]).toBeLessThan(positionAfterUp[1]);
        });
    });

    describe('GameObjectController', () => {
        let gameObject: GameObject;
        let rigidBody: RigidBody;
        let controller: GameObjectController;

        beforeEach(() => {
            gameObject = new GameObject('test-object');
            gameObject.setScene(mockScene);

            rigidBody = new RigidBody(1.0, false);
            rigidBody.setWasmEntityId(42); // Mock entity ID
            gameObject.addComponent(rigidBody);

            controller = new GameObjectController(gameObject, 8.0);
        });

        test('should initialize with correct default values', () => {
            expect(controller.getForceStrength()).toBe(8.0);
            expect(controller.getGameObject()).toBe(gameObject);
        });

        test('should apply forces when keys are pressed', () => {
            // Press W key (forward force)
            controller.handleInput(87, true);
            controller.update(0.1);

            expect(mockScene.physicsBridge.applyForce).toHaveBeenCalledWith(
                42, // entity ID
                { x: 0, y: 0, z: -8.0 }
            );
        });

        test('should apply multiple forces simultaneously', () => {
            // Press W (forward) and A (left) simultaneously
            controller.handleInput(87, true); // W
            controller.handleInput(65, true); // A
            controller.update(0.1);

            expect(mockScene.physicsBridge.applyForce).toHaveBeenCalledWith(
                42,
                { x: -8.0, y: 0, z: -8.0 }
            );
        });

        test('should respect force strength setting', () => {
            controller.setForceStrength(15.0);
            expect(controller.getForceStrength()).toBe(15.0);

            controller.handleInput(87, true); // W
            controller.update(0.1);

            expect(mockScene.physicsBridge.applyForce).toHaveBeenCalledWith(
                42,
                { x: 0, y: 0, z: -15.0 }
            );
        });

        test('should handle vertical forces with Space and minus keys', () => {
            // Press Space (up force)
            controller.handleInput(32, true);
            controller.update(0.1);

            expect(mockScene.physicsBridge.applyForce).toHaveBeenCalledWith(
                42,
                { x: 0, y: 8.0, z: 0 }
            );

            // Clear mock, press minus (down force)
            mockScene.physicsBridge.applyForce.mockClear();
            controller.handleInput(32, false);
            controller.handleInput(45, true);
            controller.update(0.1);

            expect(mockScene.physicsBridge.applyForce).toHaveBeenCalledWith(
                42,
                { x: 0, y: -8.0, z: 0 }
            );
        });

        test('should not apply forces when no keys are pressed', () => {
            controller.update(0.1);

            expect(mockScene.physicsBridge.applyForce).not.toHaveBeenCalled();
        });

        test('should handle GameObject without RigidBody gracefully', () => {
            const nonPhysicsObject = new GameObject('static-object');
            nonPhysicsObject.setScene(mockScene);
            const staticController = new GameObjectController(nonPhysicsObject);

            // Should not crash when trying to apply forces
            staticController.handleInput(87, true);
            expect(() => staticController.update(0.1)).not.toThrow();

            expect(mockScene.physicsBridge.applyForce).not.toHaveBeenCalled();
        });

        test('should handle GameObject without scene reference gracefully', () => {
            const isolatedObject = new GameObject('isolated');
            const isolatedController = new GameObjectController(isolatedObject);

            isolatedController.handleInput(87, true);
            expect(() => isolatedController.update(0.1)).not.toThrow();
        });
    });

    describe('OrbitCameraController', () => {
        let controller: OrbitCameraController;
        const targetPoint: [number, number, number] = [0, 0, 0];

        beforeEach(() => {
            controller = new OrbitCameraController(camera, targetPoint, 2.0, 5.0);
        });

        test('should initialize with correct values', () => {
            expect(controller.getTarget()).toEqual(targetPoint);
            expect(controller.getOrbitSpeed()).toBe(2.0);
            expect(controller.getZoomSpeed()).toBe(5.0);
        });

        test('should orbit around target when WASD keys are pressed', () => {
            const initialPosition = camera.getPosition();

            // Press A (orbit left)
            controller.handleInput(65, true);
            controller.update(0.1);

            const newPosition = camera.getPosition();

            // Position should have changed (orbital movement)
            expect(newPosition).not.toEqual(initialPosition);

            // Distance from target should remain approximately the same
            const initialDistance = Math.sqrt(
                initialPosition[0]**2 + initialPosition[1]**2 + initialPosition[2]**2
            );
            const newDistance = Math.sqrt(
                newPosition[0]**2 + newPosition[1]**2 + newPosition[2]**2
            );

            expect(Math.abs(newDistance - initialDistance)).toBeLessThan(0.1);
        });

        test('should zoom in and out with Space and minus keys', () => {
            // Set camera to a known position
            camera.setPosition([0, 0, 10]);
            controller = new OrbitCameraController(camera, targetPoint, 2.0, 5.0);

            const initialPosition = camera.getPosition();

            // Press Space (zoom control)
            controller.handleInput(32, true);
            controller.update(0.1);

            const newPosition = camera.getPosition();

            // Position should change when zoom input is applied
            expect(newPosition).not.toEqual(initialPosition);
        });

        test('should prevent zooming too close to target', () => {
            // Set camera very close to target
            camera.setPosition([0.5, 0, 0]);

            // Try to zoom in more
            controller.handleInput(32, true);
            controller.update(0.1);

            const finalDistance = Math.sqrt(
                camera.getPosition()[0]**2 +
                camera.getPosition()[1]**2 +
                camera.getPosition()[2]**2
            );

            // Should not go below minimum distance (1.0)
            expect(finalDistance).toBeGreaterThan(0.9);
        });

        test('should update target correctly', () => {
            const newTarget: [number, number, number] = [5, 2, -3];
            controller.setTarget(newTarget);

            expect(controller.getTarget()).toEqual(newTarget);
        });

        test('should update orbit and zoom speeds', () => {
            controller.setOrbitSpeed(4.0);
            controller.setZoomSpeed(10.0);

            expect(controller.getOrbitSpeed()).toBe(4.0);
            expect(controller.getZoomSpeed()).toBe(10.0);
        });

        test('should handle multiple orbital movements simultaneously', () => {
            const initialPosition = camera.getPosition();

            // Press W (orbit up) and D (orbit right)
            controller.handleInput(87, true); // W
            controller.handleInput(68, true); // D
            controller.update(0.1);

            const newPosition = camera.getPosition();

            // Position should have changed due to combined orbital movement
            expect(newPosition).not.toEqual(initialPosition);
        });
    });

    describe('Input Controller Integration', () => {
        test('should handle rapid input state changes', () => {
            const controller = new CameraController(camera);
            const initialPosition = camera.getPosition();

            // Rapid key press and release
            controller.handleInput(87, true);  // Press W
            controller.handleInput(87, false); // Release W immediately
            controller.update(0.1);

            // Should not move since key was released
            expect(camera.getPosition()).toEqual(initialPosition);
        });

        test('should handle invalid key codes gracefully', () => {
            const controller = new CameraController(camera);

            // Try invalid key code
            expect(() => {
                controller.handleInput(999, true);
                controller.update(0.1);
            }).not.toThrow();
        });

        test('should handle zero delta time gracefully', () => {
            const controller = new CameraController(camera);
            controller.handleInput(87, true);

            expect(() => controller.update(0)).not.toThrow();
        });

        test('should handle negative delta time gracefully', () => {
            const controller = new CameraController(camera);
            controller.handleInput(87, true);

            expect(() => controller.update(-0.1)).not.toThrow();
        });
    });
});