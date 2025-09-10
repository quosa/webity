// tests/camera-movement.test.ts
// Unit tests for BaseCamera movement methods

import { Camera } from '../src/v2/camera';

describe('BaseCamera Movement', () => {
    let camera: Camera;

    beforeEach(() => {
        camera = new Camera();
        // Set known initial state
        camera.setPosition([0, 0, -10]);
        camera.setTarget([0, 0, 0]);
        camera.setUp([0, 1, 0]);
    });

    describe('Basic Movement', () => {
        test('should move forward correctly', () => {
            camera.move(5, 0, 0); // Move 5 units forward
            
            const newPosition = camera.getPosition();
            
            // Forward direction is from position to target: (0,0,0) - (0,0,-10) = (0,0,10) normalized = (0,0,1)
            // Moving forward 5 units: (-10,0,0) + 5*(0,0,1) = (0,0,-5)
            expect(newPosition[0]).toBeCloseTo(0);
            expect(newPosition[1]).toBeCloseTo(0);
            expect(newPosition[2]).toBeCloseTo(-5);
        });

        test('should move backward correctly', () => {
            camera.move(-3, 0, 0); // Move 3 units backward
            
            const newPosition = camera.getPosition();
            
            // Moving backward 3 units: (0,0,-10) + (-3)*(0,0,1) = (0,0,-13)
            expect(newPosition[0]).toBeCloseTo(0);
            expect(newPosition[1]).toBeCloseTo(0);
            expect(newPosition[2]).toBeCloseTo(-13);
        });

        test('should move right correctly', () => {
            camera.move(0, 2, 0); // Move 2 units right
            
            const newPosition = camera.getPosition();
            
            // With camera at (0,0,-10) looking at (0,0,0), forward is (0,0,1)
            // Right vector is forward × up = (0,0,1) × (0,1,0) = (-1,0,0)
            // Moving right 2 units: (0,0,-10) + 2*(-1,0,0) = (-2,0,-10)
            expect(newPosition[0]).toBeCloseTo(-2);
            expect(newPosition[1]).toBeCloseTo(0);
            expect(newPosition[2]).toBeCloseTo(-10);
        });

        test('should move left correctly', () => {
            camera.move(0, -1.5, 0); // Move 1.5 units left
            
            const newPosition = camera.getPosition();
            
            // Moving left 1.5 units: (0,0,-10) + (-1.5)*(-1,0,0) = (1.5,0,-10)
            expect(newPosition[0]).toBeCloseTo(1.5);
            expect(newPosition[1]).toBeCloseTo(0);
            expect(newPosition[2]).toBeCloseTo(-10);
        });

        test('should move up correctly', () => {
            camera.move(0, 0, 3); // Move 3 units up
            
            const newPosition = camera.getPosition();
            
            // Up vector is (0,1,0)
            // Moving up 3 units: (0,0,-10) + 3*(0,1,0) = (0,3,-10)
            expect(newPosition[0]).toBeCloseTo(0);
            expect(newPosition[1]).toBeCloseTo(3);
            expect(newPosition[2]).toBeCloseTo(-10);
        });

        test('should move down correctly', () => {
            camera.move(0, 0, -2); // Move 2 units down
            
            const newPosition = camera.getPosition();
            
            // Moving down 2 units: (0,0,-10) + (-2)*(0,1,0) = (0,-2,-10)
            expect(newPosition[0]).toBeCloseTo(0);
            expect(newPosition[1]).toBeCloseTo(-2);
            expect(newPosition[2]).toBeCloseTo(-10);
        });

        test('should handle combined movement', () => {
            camera.move(2, -1, 1.5); // Forward 2, left 1, up 1.5
            
            const newPosition = camera.getPosition();
            
            // Combined: (0,0,-10) + 2*(0,0,1) + (-1)*(-1,0,0) + 1.5*(0,1,0)
            //         = (0,0,-10) + (0,0,2) + (1,0,0) + (0,1.5,0)
            //         = (1, 1.5, -8)
            expect(newPosition[0]).toBeCloseTo(1);
            expect(newPosition[1]).toBeCloseTo(1.5);
            expect(newPosition[2]).toBeCloseTo(-8);
        });

        test('should handle zero movement', () => {
            const initialPosition = camera.getPosition();
            
            camera.move(0, 0, 0);
            
            const newPosition = camera.getPosition();
            expect(newPosition[0]).toBeCloseTo(initialPosition[0]);
            expect(newPosition[1]).toBeCloseTo(initialPosition[1]);
            expect(newPosition[2]).toBeCloseTo(initialPosition[2]);
        });
    });

    describe('LookAt Functionality', () => {
        test('should look at target correctly', () => {
            camera.setPosition([5, 5, 5]);
            camera.lookAt([0, 0, 0]);
            
            const target = camera.getTarget();
            expect(target[0]).toBeCloseTo(0);
            expect(target[1]).toBeCloseTo(0);
            expect(target[2]).toBeCloseTo(0);
        });

        test('should look at different target', () => {
            camera.lookAt([10, -5, 3]);
            
            const target = camera.getTarget();
            expect(target[0]).toBeCloseTo(10);
            expect(target[1]).toBeCloseTo(-5);
            expect(target[2]).toBeCloseTo(3);
        });

        test('should handle looking at same position as camera', () => {
            camera.setPosition([1, 2, 3]);
            
            expect(() => {
                camera.lookAt([1, 2, 3]); // Look at self
            }).not.toThrow();
            
            const target = camera.getTarget();
            expect(target[0]).toBeCloseTo(1);
            expect(target[1]).toBeCloseTo(2);
            expect(target[2]).toBeCloseTo(3);
        });
    });

    describe('Orbit Functionality', () => {
        test('should orbit around target with yaw only', () => {
            // Position camera to the right of origin
            camera.setPosition([5, 0, 0]);
            camera.setTarget([0, 0, 0]);
            
            // Orbit 90 degrees around Y axis (convert to radians)
            camera.orbitAroundTarget(Math.PI / 2, 0);
            
            const newPosition = camera.getPosition();
            
            // After 90° yaw orbit from (5,0,0), should move to (0,0,-5) 
            // Using spherical coordinates: yaw rotation moves around Y axis
            expect(newPosition[0]).toBeCloseTo(0, 1);
            expect(newPosition[1]).toBeCloseTo(0, 1);
            expect(newPosition[2]).toBeCloseTo(-5, 1);
            
            // Target should remain the same
            const target = camera.getTarget();
            expect(target[0]).toBeCloseTo(0);
            expect(target[1]).toBeCloseTo(0);
            expect(target[2]).toBeCloseTo(0);
        });

        test('should orbit around target with pitch only', () => {
            // Position camera in front of origin
            camera.setPosition([0, 0, -5]);
            camera.setTarget([0, 0, 0]);
            
            // Orbit 45 degrees up (positive pitch, convert to radians)
            camera.orbitAroundTarget(0, Math.PI / 4);
            
            const newPosition = camera.getPosition();
            
            // After 45° pitch orbit, should be higher and closer
            // Distance should remain 5, but Y should be positive
            const distance = Math.sqrt(newPosition[0]**2 + newPosition[1]**2 + newPosition[2]**2);
            expect(distance).toBeCloseTo(5, 1);
            expect(newPosition[1]).toBeGreaterThan(0); // Should be higher
        });

        test('should orbit around target with combined yaw and pitch', () => {
            camera.setPosition([0, 0, -10]);
            camera.setTarget([0, 0, 0]);
            
            const initialDistance = 10;
            
            camera.orbitAroundTarget(Math.PI / 4, Math.PI / 6); // 45° yaw, 30° pitch in radians
            
            const newPosition = camera.getPosition();
            
            // Distance should be preserved
            const newDistance = Math.sqrt(newPosition[0]**2 + newPosition[1]**2 + newPosition[2]**2);
            expect(newDistance).toBeCloseTo(initialDistance, 1);
            
            // Should have moved in both X (yaw) and Y (pitch) directions
            expect(Math.abs(newPosition[0])).toBeGreaterThan(0.1); // Yaw effect
            expect(Math.abs(newPosition[1])).toBeGreaterThan(0.1); // Pitch effect
        });

        test('should handle zero orbit', () => {
            const initialPosition = camera.getPosition();
            
            camera.orbitAroundTarget(0, 0);
            
            const newPosition = camera.getPosition();
            expect(newPosition[0]).toBeCloseTo(initialPosition[0]);
            expect(newPosition[1]).toBeCloseTo(initialPosition[1]);
            expect(newPosition[2]).toBeCloseTo(initialPosition[2]);
        });

        test('should handle full 360 degree orbit', () => {
            const initialPosition = camera.getPosition();
            
            camera.orbitAroundTarget(2 * Math.PI, 0); // Full circle in radians
            
            const newPosition = camera.getPosition();
            
            // Should return to approximately the same position
            expect(newPosition[0]).toBeCloseTo(initialPosition[0], 1);
            expect(newPosition[1]).toBeCloseTo(initialPosition[1], 1);
            expect(newPosition[2]).toBeCloseTo(initialPosition[2], 1);
        });

        test('should orbit around non-origin target', () => {
            const customTarget: [number, number, number] = [3, 4, 5];
            camera.setPosition([8, 4, 5]); // 5 units to the right of target
            camera.setTarget(customTarget);
            
            camera.orbitAroundTarget(90, 0);
            
            const newPosition = camera.getPosition();
            const target = camera.getTarget();
            
            // Target should remain unchanged
            expect(target[0]).toBeCloseTo(customTarget[0]);
            expect(target[1]).toBeCloseTo(customTarget[1]);
            expect(target[2]).toBeCloseTo(customTarget[2]);
            
            // Distance from target should be preserved (was 5 units)
            const distance = Math.sqrt(
                (newPosition[0] - target[0])**2 + 
                (newPosition[1] - target[1])**2 + 
                (newPosition[2] - target[2])**2
            );
            expect(distance).toBeCloseTo(5, 1);
        });
    });

    describe('Movement Edge Cases', () => {
        test('should handle very large movement values', () => {
            camera.move(1000, -500, 250);
            
            const newPosition = camera.getPosition();
            
            // Should not throw and should produce reasonable results
            expect(isFinite(newPosition[0])).toBe(true);
            expect(isFinite(newPosition[1])).toBe(true);
            expect(isFinite(newPosition[2])).toBe(true);
        });

        test('should handle very small movement values', () => {
            const initialPosition = camera.getPosition();
            
            camera.move(0.001, -0.0005, 0.0002);
            
            const newPosition = camera.getPosition();
            
            // Should handle precision correctly
            expect(newPosition[0]).not.toBe(initialPosition[0]); // Should have moved slightly
            expect(Math.abs(newPosition[0] - initialPosition[0])).toBeLessThan(0.1);
        });

        test('should handle extreme orbit angles', () => {
            camera.setPosition([0, 0, -5]);
            camera.setTarget([0, 0, 0]);
            
            expect(() => {
                camera.orbitAroundTarget(4 * Math.PI, Math.PI); // Multiple rotations + upside down in radians
            }).not.toThrow();
            
            const newPosition = camera.getPosition();
            expect(isFinite(newPosition[0])).toBe(true);
            expect(isFinite(newPosition[1])).toBe(true);
            expect(isFinite(newPosition[2])).toBe(true);
        });

        test('should handle negative orbit angles', () => {
            camera.setPosition([5, 0, 0]);
            camera.setTarget([0, 0, 0]);
            
            camera.orbitAroundTarget(-Math.PI / 2, -Math.PI / 4);
            
            const newPosition = camera.getPosition();
            
            // Should produce valid results
            expect(isFinite(newPosition[0])).toBe(true);
            expect(isFinite(newPosition[1])).toBe(true);
            expect(isFinite(newPosition[2])).toBe(true);
            
            // Distance should be preserved
            const distance = Math.sqrt(newPosition[0]**2 + newPosition[1]**2 + newPosition[2]**2);
            expect(distance).toBeCloseTo(5, 1);
        });
    });

    describe('Camera State Consistency', () => {
        test('should maintain up vector after movement', () => {
            const initialUp = camera.getUp();
            
            camera.move(5, -3, 2);
            
            const newUp = camera.getUp();
            expect(newUp[0]).toBeCloseTo(initialUp[0]);
            expect(newUp[1]).toBeCloseTo(initialUp[1]);
            expect(newUp[2]).toBeCloseTo(initialUp[2]);
        });

        test('should maintain up vector after orbit', () => {
            const initialUp = camera.getUp();
            
            camera.orbitAroundTarget(45, 30);
            
            const newUp = camera.getUp();
            expect(newUp[0]).toBeCloseTo(initialUp[0]);
            expect(newUp[1]).toBeCloseTo(initialUp[1]);
            expect(newUp[2]).toBeCloseTo(initialUp[2]);
        });

        test('should maintain target relative position after move', () => {
            const initialTarget = camera.getTarget();
            
            camera.move(10, -5, 3);
            
            const newTarget = camera.getTarget();
            // Target should move with camera during move() operation (maintains relative position)
            expect(newTarget[0]).not.toBeCloseTo(initialTarget[0]);
            expect(newTarget[1]).not.toBeCloseTo(initialTarget[1]);
            expect(newTarget[2]).not.toBeCloseTo(initialTarget[2]);
        });

        test('should update position correctly after multiple operations', () => {
            camera.setPosition([1, 1, 1]);
            camera.lookAt([0, 0, 0]);
            camera.move(2, 0, 0); // Move forward
            camera.orbitAroundTarget(Math.PI / 2, 0); // Orbit around target in radians
            
            const finalPosition = camera.getPosition();
            const target = camera.getTarget();
            
            // Should have valid position and target
            expect(isFinite(finalPosition[0])).toBe(true);
            expect(isFinite(finalPosition[1])).toBe(true);
            expect(isFinite(finalPosition[2])).toBe(true);
            
            // Target is affected by move operation, so just verify it's finite/valid
            expect(isFinite(target[0])).toBe(true);
            expect(isFinite(target[1])).toBe(true);
            expect(isFinite(target[2])).toBe(true);
        });
    });
});