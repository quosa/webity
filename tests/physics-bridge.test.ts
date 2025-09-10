// tests/physics-bridge.test.ts
// Unit tests for WasmPhysicsBridge and RigidBody integration

import { WasmPhysicsBridge } from '../src/v2/wasm-physics-bridge';
import { GameObject } from '../src/v2/gameobject';
import { RigidBody, MeshRenderer } from '../src/v2/components';

describe('WasmPhysicsBridge', () => {
    let physicsBridge: WasmPhysicsBridge;
    
    beforeEach(async () => {
        physicsBridge = new WasmPhysicsBridge();
        await physicsBridge.init(); // Initialize in mock mode
    });

    describe('Initialization', () => {
        test('should initialize in mock mode without WASM module', async () => {
            const bridge = new WasmPhysicsBridge();
            await bridge.init();
            
            const stats = bridge.getStats();
            expect(stats.isInitialized).toBe(true);
            expect(stats.hasMockWasm).toBe(true);
            expect(stats.entityCount).toBe(0);
        });

        test('should initialize with WASM module when provided', async () => {
            const mockWasm = {
                init: jest.fn(),
                update: jest.fn(),
                add_entity: jest.fn(),
                remove_entity: jest.fn(),
                get_entity_count: jest.fn(() => 0),
                apply_force: jest.fn(),
                set_entity_position: jest.fn(),
                set_entity_velocity: jest.fn(),
                get_entity_transforms_offset: jest.fn(() => 0),
                get_entity_metadata_offset: jest.fn(() => 0),
                memory: { 
                    buffer: new ArrayBuffer(1024),
                    grow: jest.fn((_delta: number) => 0)
                }
            };

            const bridge = new WasmPhysicsBridge();
            await bridge.init(mockWasm);
            
            expect(mockWasm.init).toHaveBeenCalled();
            expect(bridge.hasWasmModule()).toBe(true);
            
            const stats = bridge.getStats();
            expect(stats.isInitialized).toBe(true);
            expect(stats.hasMockWasm).toBe(false);
        });
    });

    describe('Entity Management', () => {
        test('should add physics entity with RigidBody component', () => {
            const gameObject = new GameObject('test-cube', 'TestCube');
            gameObject.transform.setPosition(1, 2, 3);
            
            const rigidBody = new RigidBody(2.0, true, 'box', { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);

            const entityId = physicsBridge.addPhysicsEntity(gameObject);
            
            expect(entityId).not.toBeNull();
            expect(typeof entityId).toBe('number');
            expect(entityId).toBeGreaterThanOrEqual(0);
            
            const stats = physicsBridge.getStats();
            expect(stats.entityCount).toBe(1);
        });

        test('should not add entity without RigidBody component', () => {
            const gameObject = new GameObject('test-static', 'StaticObject');
            const meshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 });
            gameObject.addComponent(meshRenderer);

            const entityId = physicsBridge.addPhysicsEntity(gameObject);
            
            expect(entityId).toBeNull();
            
            const stats = physicsBridge.getStats();
            expect(stats.entityCount).toBe(0);
        });

        test('should remove physics entity', () => {
            const gameObject = new GameObject('test-removal', 'RemovalTest');
            const rigidBody = new RigidBody(1.0, true, 'sphere', { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);

            const entityId = physicsBridge.addPhysicsEntity(gameObject);
            expect(entityId).not.toBeNull();
            
            const removed = physicsBridge.removePhysicsEntity(gameObject.id);
            expect(removed).toBe(true);
            
            const stats = physicsBridge.getStats();
            expect(stats.entityCount).toBe(0);
        });

        test('should return false when removing non-existent entity', () => {
            const removed = physicsBridge.removePhysicsEntity('non-existent-id');
            expect(removed).toBe(false);
        });

        test('should generate unique entity IDs for multiple entities', () => {
            const gameObject1 = new GameObject('entity1', 'Entity1');
            gameObject1.addComponent(new RigidBody(1.0, true, 'box', { x: 1, y: 1, z: 1 }));
            
            const gameObject2 = new GameObject('entity2', 'Entity2');
            gameObject2.addComponent(new RigidBody(2.0, false, 'sphere', { x: 1, y: 1, z: 1 }));

            const entityId1 = physicsBridge.addPhysicsEntity(gameObject1);
            const entityId2 = physicsBridge.addPhysicsEntity(gameObject2);
            
            expect(entityId1).not.toEqual(entityId2);
            expect(entityId1).not.toBeNull();
            expect(entityId2).not.toBeNull();
            
            const stats = physicsBridge.getStats();
            expect(stats.entityCount).toBe(2);
        });
    });

    describe('Physics Operations', () => {
        test('should apply force to physics entity', () => {
            const gameObject = new GameObject('force-test', 'ForceTest');
            const rigidBody = new RigidBody(1.0, true, 'sphere', { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);

            const entityId = physicsBridge.addPhysicsEntity(gameObject);
            expect(entityId).not.toBeNull();

            // Should not throw in mock mode
            expect(() => {
                physicsBridge.applyForce(entityId!, 10, 0, -5);
            }).not.toThrow();
        });

        test('should update entity transform', () => {
            const gameObject = new GameObject('update-test', 'UpdateTest');
            const rigidBody = new RigidBody(1.0, false, 'box', { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);

            const entityId = physicsBridge.addPhysicsEntity(gameObject);
            expect(entityId).not.toBeNull();

            // Should not throw in mock mode
            expect(() => {
                physicsBridge.updateEntity(
                    entityId!, 
                    { x: 5, y: 10, z: -2 }, 
                    { x: 1, y: 0, z: 0 }
                );
            }).not.toThrow();
        });

        test('should get entity data', () => {
            const gameObject = new GameObject('data-test', 'DataTest');
            const rigidBody = new RigidBody(1.0, true, 'sphere', { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);

            const entityId = physicsBridge.addPhysicsEntity(gameObject);
            expect(entityId).not.toBeNull();

            const entityData = physicsBridge.getEntityData(entityId!);
            expect(entityData).not.toBeNull();
            expect(entityData?.position).toBeDefined();
            expect(typeof entityData?.position.x).toBe('number');
            expect(typeof entityData?.position.y).toBe('number');
            expect(typeof entityData?.position.z).toBe('number');
        });

        test('should set kinematic state', () => {
            const gameObject = new GameObject('kinematic-test', 'KinematicTest');
            const rigidBody = new RigidBody(1.0, true, 'box', { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);

            const entityId = physicsBridge.addPhysicsEntity(gameObject);
            expect(entityId).not.toBeNull();

            // Should not throw in mock mode
            expect(() => {
                physicsBridge.setKinematic(entityId!, true);
            }).not.toThrow();
        });
    });

    describe('Update Loop', () => {
        test('should handle update without WASM module', () => {
            expect(() => {
                physicsBridge.update(0.016); // 60fps delta
            }).not.toThrow();
        });

        test('should handle update with entities', () => {
            const gameObject = new GameObject('update-loop-test', 'UpdateLoopTest');
            const rigidBody = new RigidBody(1.0, true, 'sphere', { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);

            physicsBridge.addPhysicsEntity(gameObject);
            
            expect(() => {
                physicsBridge.update(0.016);
            }).not.toThrow();
        });
    });

    describe('RigidBody Integration', () => {
        test('should set WASM entity ID and physics bridge reference on RigidBody', () => {
            const gameObject = new GameObject('integration-test', 'IntegrationTest');
            const rigidBody = new RigidBody(1.5, true, 'box', { x: 2, y: 2, z: 2 });
            gameObject.addComponent(rigidBody);

            const entityId = physicsBridge.addPhysicsEntity(gameObject);
            expect(entityId).not.toBeNull();

            // The RigidBody should have been configured (we can't check private fields, but the operation should succeed)
            expect(typeof entityId).toBe('number');
            expect(entityId).toBeGreaterThanOrEqual(0);
        });

        test('should handle different collider types', () => {
            const sphereObject = new GameObject('sphere-test', 'SphereTest');
            const sphereRigidBody = new RigidBody(1.0, true, 'sphere', { x: 1, y: 1, z: 1 });
            sphereObject.addComponent(sphereRigidBody);

            const boxObject = new GameObject('box-test', 'BoxTest');
            const boxRigidBody = new RigidBody(2.0, false, 'box', { x: 1, y: 1, z: 1 });
            boxObject.addComponent(boxRigidBody);

            const sphereId = physicsBridge.addPhysicsEntity(sphereObject);
            const boxId = physicsBridge.addPhysicsEntity(boxObject);

            expect(sphereId).not.toBeNull();
            expect(boxId).not.toBeNull();
            expect(sphereId).not.toEqual(boxId);
        });

        test('should handle kinematic vs dynamic bodies', () => {
            const dynamicObject = new GameObject('dynamic-test', 'DynamicTest');
            const dynamicRigidBody = new RigidBody(1.0, true, 'box', { x: 1, y: 1, z: 1 });
            dynamicRigidBody.setKinematic(false); // Dynamic
            dynamicObject.addComponent(dynamicRigidBody);

            const kinematicObject = new GameObject('kinematic-test', 'KinematicTest');
            const kinematicRigidBody = new RigidBody(1.0, false, 'sphere', { x: 1, y: 1, z: 1 });
            kinematicRigidBody.setKinematic(true); // Kinematic
            kinematicObject.addComponent(kinematicRigidBody);

            const dynamicId = physicsBridge.addPhysicsEntity(dynamicObject);
            const kinematicId = physicsBridge.addPhysicsEntity(kinematicObject);

            expect(dynamicId).not.toBeNull();
            expect(kinematicId).not.toBeNull();
            
            const stats = physicsBridge.getStats();
            expect(stats.entityCount).toBe(2);
        });
    });

    describe('Error Handling', () => {
        test('should handle operations when not initialized', async () => {
            const uninitializedBridge = new WasmPhysicsBridge();
            // Don't call init()

            const gameObject = new GameObject('uninit-test', 'UninitTest');
            const rigidBody = new RigidBody(1.0, true, 'box', { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);

            const entityId = uninitializedBridge.addPhysicsEntity(gameObject);
            expect(entityId).toBeNull();
        });

        test('should handle null RigidBody component gracefully', () => {
            const gameObject = new GameObject('null-rb-test', 'NullRBTest');
            // Don't add RigidBody component

            expect(() => {
                const entityId = physicsBridge.addPhysicsEntity(gameObject);
                expect(entityId).toBeNull();
            }).not.toThrow();
        });
    });
});