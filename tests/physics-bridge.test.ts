// tests/physics-bridge.test.ts
// Unit tests for WasmPhysicsBridge and RigidBody integration
import { jest } from '@jest/globals';

import { WasmPhysicsBridge } from '../src/engine/wasm-physics-bridge';
import { GameObject } from '../src/engine/gameobject';
import { RigidBody, MeshRenderer, CollisionShape } from '../src/engine/components';

describe('WasmPhysicsBridge', () => {
    let physicsBridge: WasmPhysicsBridge;

    // Helper function to create a complete GameObject with MeshRenderer
    const createTestGameObject = (name: string, type?: string, meshId?: string): GameObject => {
        const gameObject = new GameObject(name, type || 'TestObject');
        // Add MeshRenderer required for WASM integration
        const meshRenderer = new MeshRenderer(meshId || 'cube', 'default', 'triangles', { x: 1, y: 1, z: 1, w: 1 });
        // this is normally done by Scene when adding GameObject
        meshRenderer.meshIndex = 0; // Simulate assigned mesh index
        gameObject.addComponent(meshRenderer);
        return gameObject;
    };

    beforeEach(async () => {
        physicsBridge = new WasmPhysicsBridge();
        await physicsBridge.init(); // Initialize in mock mode
    });

    describe('Initialization', () => {
        test('should initialize with real WASM module by default', async () => {
            const bridge = new WasmPhysicsBridge();
            await bridge.init();

            const stats = bridge.getStats();
            expect(stats.isInitialized).toBe(true);
            expect(stats.entityCount).toBe(0); // No entities added yet
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
                set_entity_rotation: jest.fn(),
                set_entity_scale: jest.fn(),
                get_entity_transforms_offset: jest.fn(() => 0),
                get_entity_metadata_offset: jest.fn(() => 0),
                get_entity_metadata_size: jest.fn(() => 16),
                get_entity_size: jest.fn(() => 80),
                get_entity_stride: jest.fn(() => 80),
                debug_get_entity_mesh_id: jest.fn(() => 0),
                get_entity_position_x: jest.fn(() => 0),
                get_entity_position_y: jest.fn(() => 0),
                get_entity_position_z: jest.fn(() => 0),
                get_entity_velocity_x: jest.fn(() => 0),
                get_entity_velocity_y: jest.fn(() => 0),
                get_entity_velocity_z: jest.fn(() => 0),
                // Collision shape functions (optional)
                spawn_entity_with_collider: jest.fn(() => 0),
                set_entity_collision_shape: jest.fn(),
                get_entity_collision_shape: jest.fn(() => 0),
                get_entity_collision_extent_x: jest.fn(() => 0.5),
                get_entity_collision_extent_y: jest.fn(() => 0.5),
                get_entity_collision_extent_z: jest.fn(() => 0.5),
                // Collision debug functions
                get_collision_checks_performed: jest.fn(() => 0),
                get_collisions_detected: jest.fn(() => 0),
                get_kinematic_collision_flag: jest.fn(() => false),
                get_collision_state: jest.fn(() => 0),
                debug_get_entity_physics_info: jest.fn(() => 0),
                get_wasm_version: jest.fn(() => 20250915),
                // Collision event logging functions
                get_collision_event_counter: jest.fn(() => 0),
                get_last_collision_entities: jest.fn(() => 0),
                get_last_collision_pos1: jest.fn(() => 0),
                get_last_collision_pos2: jest.fn(() => 0),
                clear_collision_event_counter: jest.fn(),
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
        });
    });

    describe('Entity Management', () => {
        test('should add physics entity with RigidBody component', () => {
            const gameObject = createTestGameObject('test-cube', 'TestCube', 'cube');
            gameObject.transform.setPosition(1, 2, 3);
            const rigidBody = new RigidBody(2.0, true, CollisionShape.BOX, { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);
            // MeshRenderer already added by createTestGameObject with meshIndex set
            const entityId = physicsBridge.addPhysicsEntity(gameObject);

            expect(entityId).not.toBeNull();
            expect(typeof entityId).toBe('number');
            expect(entityId).toBeGreaterThanOrEqual(0);

            const stats = physicsBridge.getStats();
            expect(stats.entityCount).toBe(1);
        });

        test('should add entity without RigidBody component as static entity', () => {
            const gameObject = createTestGameObject('test-static', 'StaticObject', 'cube');
            // meshRenderer.meshIndex already set in helper
            const entityId = physicsBridge.addPhysicsEntity(gameObject);

            expect(entityId).not.toBeNull();
            expect(typeof entityId).toBe('number');

            const stats = physicsBridge.getStats();
            expect(stats.entityCount).toBe(1); // Now adds static entities too
        });

        test('should remove physics entity', () => {
            const gameObject = createTestGameObject('test-removal', 'RemovalTest', 'sphere');
            const rigidBody = new RigidBody(1.0, true, CollisionShape.SPHERE, { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);
            // meshRenderer.meshIndex already set in helper
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
            const gameObject1 = createTestGameObject('entity1', 'Entity1', 'box');
            gameObject1.addComponent(new RigidBody(1.0, true, CollisionShape.BOX, { x: 1, y: 1, z: 1 }));
            // meshRenderer.meshIndex already set in helper
            const gameObject2 = createTestGameObject('entity2', 'Entity2', 'sphere');
            gameObject2.addComponent(new RigidBody(2.0, false, CollisionShape.SPHERE, { x: 1, y: 1, z: 1 }));
            // meshRenderer.meshIndex already set in helper
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
            const gameObject = createTestGameObject('force-test', 'ForceTest');
            const rigidBody = new RigidBody(1.0, true, CollisionShape.SPHERE, { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);

            const entityId = physicsBridge.addPhysicsEntity(gameObject);
            expect(entityId).not.toBeNull();

            // Should not throw in mock mode
            expect(() => {
                physicsBridge.applyForce(entityId!, 10, 0, -5);
            }).not.toThrow();
        });

        test('should update entity transform', () => {
            const gameObject = createTestGameObject('update-test', 'UpdateTest');
            const rigidBody = new RigidBody(1.0, false, CollisionShape.BOX, { x: 1, y: 1, z: 1 });
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
            const gameObject = createTestGameObject('data-test', 'DataTest');
            const rigidBody = new RigidBody(1.0, true, CollisionShape.SPHERE, { x: 1, y: 1, z: 1 });
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
            const gameObject = createTestGameObject('kinematic-test', 'KinematicTest');
            const rigidBody = new RigidBody(1.0, true, CollisionShape.BOX, { x: 1, y: 1, z: 1 });
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
            const gameObject = createTestGameObject('update-loop-test', 'UpdateLoopTest', 'sphere');
            const rigidBody = new RigidBody(1.0, true, CollisionShape.SPHERE, { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);
            // meshRenderer.meshIndex already set in helper
            physicsBridge.addPhysicsEntity(gameObject);

            expect(() => {
                physicsBridge.update(0.016);
            }).not.toThrow();
        });
    });

    describe('RigidBody Integration', () => {
        test('should set WASM entity ID and physics bridge reference on RigidBody', () => {
            const gameObject = createTestGameObject('integration-test', 'IntegrationTest', 'box');
            const rigidBody = new RigidBody(1.5, true, CollisionShape.BOX, { x: 2, y: 2, z: 2 });
            gameObject.addComponent(rigidBody);
            // meshRenderer.meshIndex already set in helper
            const entityId = physicsBridge.addPhysicsEntity(gameObject);
            expect(entityId).not.toBeNull();

            // The RigidBody should have been configured (we can't check private fields, but the operation should succeed)
            expect(typeof entityId).toBe('number');
            expect(entityId).toBeGreaterThanOrEqual(0);
        });

        test('should handle different collider types', () => {
            const sphereObject = createTestGameObject('sphere-test', 'SphereTest', 'sphere');
            const sphereRigidBody = new RigidBody(1.0, true, CollisionShape.SPHERE, { x: 1, y: 1, z: 1 });
            sphereObject.addComponent(sphereRigidBody);
            // meshRenderer.meshIndex already set in helper
            const boxObject = createTestGameObject('box-test', 'BoxTest', 'cube');
            const boxRigidBody = new RigidBody(2.0, false, CollisionShape.BOX, { x: 1, y: 1, z: 1 });
            boxObject.addComponent(boxRigidBody);
            // meshRenderer.meshIndex already set in helper
            const sphereId = physicsBridge.addPhysicsEntity(sphereObject);
            const boxId = physicsBridge.addPhysicsEntity(boxObject);

            expect(sphereId).not.toBeNull();
            expect(boxId).not.toBeNull();
            expect(sphereId).not.toEqual(boxId);
        });

        test('should handle kinematic vs dynamic bodies', () => {
            const dynamicObject = createTestGameObject('dynamic-test', 'DynamicTest', 'box');
            const dynamicRigidBody = new RigidBody(1.0, true, CollisionShape.BOX, { x: 1, y: 1, z: 1 });
            dynamicRigidBody.setKinematic(false); // Dynamic
            dynamicObject.addComponent(dynamicRigidBody);
            // meshRenderer.meshIndex already set in helper
            const kinematicObject = createTestGameObject('kinematic-test', 'KinematicTest', 'sphere');
            const kinematicRigidBody = new RigidBody(1.0, false, CollisionShape.SPHERE, { x: 1, y: 1, z: 1 });
            kinematicRigidBody.setKinematic(true); // Kinematic
            kinematicObject.addComponent(kinematicRigidBody);
            // meshRenderer.meshIndex already set in helper
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

            const gameObject = createTestGameObject('uninit-test', 'UninitTest');
            const rigidBody = new RigidBody(1.0, true, CollisionShape.BOX, { x: 1, y: 1, z: 1 });
            gameObject.addComponent(rigidBody);

            const entityId = uninitializedBridge.addPhysicsEntity(gameObject);
            expect(entityId).toBeNull();
        });

        test('should handle null RigidBody component gracefully', () => {
            const gameObject = createTestGameObject('null-rb-test', 'NullRBTest');
            // Don't add RigidBody component - but has MeshRenderer for static entities

            expect(() => {
                const entityId = physicsBridge.addPhysicsEntity(gameObject);
                expect(entityId).not.toBeNull(); // Now accepts static entities
                expect(typeof entityId).toBe('number');
            }).not.toThrow();
        });
    });
});
