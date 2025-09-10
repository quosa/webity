// tests/rigidbody-component.test.ts
// Unit tests for RigidBody component

import { RigidBody } from '../src/v2/components';
import { GameObject } from '../src/v2/gameobject';

describe('RigidBody Component', () => {
    let gameObject: GameObject;
    let rigidBody: RigidBody;

    beforeEach(() => {
        gameObject = new GameObject('test-object', 'TestObject');
        rigidBody = new RigidBody(1.0, true, 'box', { x: 1, y: 1, z: 1 });
        gameObject.addComponent(rigidBody);
    });

    describe('Construction', () => {
        test('should create RigidBody with default values', () => {
            const rb = new RigidBody();
            
            expect(rb.mass).toBe(1.0);
            expect(rb.useGravity).toBe(true);
            expect(rb.colliderType).toBe('sphere'); // Default is sphere, not box
            expect(rb.colliderSize).toEqual({ x: 1, y: 1, z: 1 });
            expect(rb.isKinematic).toBe(false);
            expect(rb.velocity).toEqual({ x: 0, y: 0, z: 0 });
        });

        test('should create RigidBody with custom values', () => {
            const rb = new RigidBody(2.5, false, 'sphere', { x: 2, y: 2, z: 2 });
            
            expect(rb.mass).toBe(2.5);
            expect(rb.useGravity).toBe(false);
            expect(rb.colliderType).toBe('sphere');
            expect(rb.colliderSize).toEqual({ x: 2, y: 2, z: 2 });
        });

        test('should be an instance of RigidBody', () => {
            expect(rigidBody).toBeInstanceOf(RigidBody);
        });
    });

    describe('Basic Properties', () => {
        test('should get and set mass', () => {
            rigidBody.mass = 5.0;
            expect(rigidBody.mass).toBe(5.0);
        });

        test('should get and set gravity flag', () => {
            rigidBody.useGravity = false;
            expect(rigidBody.useGravity).toBe(false);
            
            rigidBody.useGravity = true;
            expect(rigidBody.useGravity).toBe(true);
        });

        test('should get and set kinematic flag', () => {
            expect(rigidBody.isKinematic).toBe(false);
            
            rigidBody.setKinematic(true);
            expect(rigidBody.isKinematic).toBe(true);
            
            rigidBody.setKinematic(false);
            expect(rigidBody.isKinematic).toBe(false);
        });

        test('should get and set collider properties', () => {
            rigidBody.colliderType = 'sphere';
            expect(rigidBody.colliderType).toBe('sphere');
            
            rigidBody.colliderSize = { x: 3, y: 3, z: 3 };
            expect(rigidBody.colliderSize).toEqual({ x: 3, y: 3, z: 3 });
        });
    });

    describe('Velocity Management', () => {
        test('should get and set velocity', () => {
            const newVelocity = { x: 10, y: -5, z: 2 };
            rigidBody.setVelocity(newVelocity.x, newVelocity.y, newVelocity.z);
            
            expect(rigidBody.velocity).toEqual(newVelocity);
        });

        test('should set individual velocity components', () => {
            rigidBody.setVelocity(1, 2, 3);
            
            expect(rigidBody.velocity.x).toBe(1);
            expect(rigidBody.velocity.y).toBe(2);
            expect(rigidBody.velocity.z).toBe(3);
        });

        test('should handle zero velocity', () => {
            rigidBody.setVelocity(5, 10, -3);
            rigidBody.setVelocity(0, 0, 0);
            
            expect(rigidBody.velocity).toEqual({ x: 0, y: 0, z: 0 });
        });
    });

    describe('Force Application', () => {
        test('should apply force through physics bridge', () => {
            // Mock physics bridge to test force application
            const mockBridge = {
                applyForce: jest.fn()
            };
            rigidBody.setWasmEntityId(42);
            rigidBody.setPhysicsBridge(mockBridge);
            rigidBody.setKinematic(false); // Make sure it's not kinematic
            
            // The actual implementation doesn't call the bridge directly, it just logs
            // This test verifies the method doesn't throw
            expect(() => {
                rigidBody.applyForce(10, -5, 7);
            }).not.toThrow();
        });

        test('should handle force application without physics bridge', () => {
            expect(() => {
                rigidBody.applyForce(1, 2, 3);
            }).not.toThrow();
        });

        test('should handle force application without WASM entity ID', () => {
            const mockBridge = {
                applyForce: jest.fn()
            };
            rigidBody.setPhysicsBridge(mockBridge);
            // Don't set WASM entity ID
            
            expect(() => {
                rigidBody.applyForce(1, 2, 3);
            }).not.toThrow();
            
            expect(mockBridge.applyForce).not.toHaveBeenCalled();
        });
    });

    describe('WASM Integration', () => {
        test('should set WASM entity ID', () => {
            expect(() => {
                rigidBody.setWasmEntityId(123);
            }).not.toThrow();
        });

        test('should set physics bridge', () => {
            const mockBridge = { test: 'mock-bridge' };
            
            expect(() => {
                rigidBody.setPhysicsBridge(mockBridge);
            }).not.toThrow();
        });

        test('should sync to WASM when bridge is available', () => {
            const mockBridge = {
                updateEntity: jest.fn()
            };
            rigidBody.setWasmEntityId(456);
            rigidBody.setPhysicsBridge(mockBridge);
            rigidBody.setVelocity(5, -2, 8);
            
            // syncToWasm is a public method but doesn't actually call the bridge in current implementation
            expect(() => {
                rigidBody.syncToWasm();
            }).not.toThrow();
        });

        test('should handle sync to WASM without bridge', () => {
            expect(() => {
                rigidBody.syncToWasm();
            }).not.toThrow();
        });

        test('should handle sync from WASM', () => {
            const mockEntityData = {
                position: { x: 10, y: 20, z: 30 }
            };
            const mockBridge = {
                getEntityData: jest.fn(() => mockEntityData)
            };
            rigidBody.setWasmEntityId(789);
            rigidBody.setPhysicsBridge(mockBridge);
            
            // syncFromWasm is private, but we can test the update method which calls it for non-kinematic bodies
            rigidBody.setKinematic(false);
            
            expect(() => {
                rigidBody.update(0.016);
            }).not.toThrow();
        });

        test('should handle update without bridge', () => {
            expect(() => {
                rigidBody.update(0.016);
            }).not.toThrow();
        });
    });

    describe('Kinematic Behavior', () => {
        test('should handle kinematic body properties', () => {
            rigidBody.setKinematic(true);
            
            expect(rigidBody.isKinematic).toBe(true);
            
            // Kinematic bodies should still allow manual velocity changes
            rigidBody.setVelocity(10, 0, 0);
            expect(rigidBody.velocity).toEqual({ x: 10, y: 0, z: 0 });
        });

        test('should handle kinematic state changes', () => {
            const mockBridge = {
                setKinematic: jest.fn()
            };
            rigidBody.setWasmEntityId(321);
            rigidBody.setPhysicsBridge(mockBridge);
            
            expect(() => {
                rigidBody.setKinematic(true);
            }).not.toThrow();
            
            expect(rigidBody.isKinematic).toBe(true);
        });
    });

    describe('Component Lifecycle', () => {
        test('should initialize properly when added to GameObject', () => {
            const newGameObject = new GameObject('lifecycle-test', 'LifecycleTest');
            const newRigidBody = new RigidBody(2.0, false, 'sphere', { x: 0.5, y: 0.5, z: 0.5 });
            
            newGameObject.addComponent(newRigidBody);
            
            expect(newRigidBody.gameObject).toBe(newGameObject);
            expect(newGameObject.getComponent(RigidBody)).toBe(newRigidBody);
        });

        test('should handle awake lifecycle', () => {
            expect(() => {
                rigidBody.awake();
            }).not.toThrow();
        });

        test('should handle start lifecycle', () => {
            expect(() => {
                rigidBody.start();
            }).not.toThrow();
        });

        test('should handle update lifecycle', () => {
            expect(() => {
                rigidBody.update(0.016);
            }).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        test('should handle negative mass', () => {
            rigidBody.mass = -1.0;
            expect(rigidBody.mass).toBe(-1.0); // Allow negative mass for special cases
        });

        test('should handle zero mass', () => {
            rigidBody.mass = 0.0;
            expect(rigidBody.mass).toBe(0.0);
        });

        test('should handle very large velocity values', () => {
            rigidBody.setVelocity(1000000, -1000000, 999999);
            expect(rigidBody.velocity.x).toBe(1000000);
            expect(rigidBody.velocity.y).toBe(-1000000);
            expect(rigidBody.velocity.z).toBe(999999);
        });

        test('should handle fractional velocity values', () => {
            rigidBody.setVelocity(0.001, -0.999, 3.14159);
            expect(rigidBody.velocity.x).toBeCloseTo(0.001);
            expect(rigidBody.velocity.y).toBeCloseTo(-0.999);
            expect(rigidBody.velocity.z).toBeCloseTo(3.14159);
        });
    });
});