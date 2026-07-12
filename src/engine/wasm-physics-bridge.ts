// src/v2/wasm-physics-bridge.ts
// Bridge between TypeScript Scene system and WASM physics simulation

import { GameObject } from './gameobject';
import { RigidBody, Vector3 } from './components';
import { WasmLoader } from './wasm-loader';

export interface WasmPhysicsInterface {
    // WASM module exports (will be implemented in Phase 3)
    init(): void;
    update(deltaTime: number): void;

    // Entity lifecycle
    add_entity(id: number, x: number, y: number, z: number, scaleX: number, scaleY: number, scaleZ: number, colorR: number, colorG: number, colorB: number, colorA: number, meshId: number, materialId: number, mass: number, radius: number, isKinematic: boolean): void;
    remove_entity(id: number): void;
    get_entity_count(): number;

    // Physics interaction
    apply_force(id: number, fx: number, fy: number, fz: number): void;
    set_entity_position(id: number, x: number, y: number, z: number): void;
    set_entity_velocity(id: number, vx: number, vy: number, vz: number): void;
    set_entity_rotation(id: number, rx: number, ry: number, rz: number): void;
    set_entity_scale(id: number, sx: number, sy: number, sz: number): void;

    // Zero-copy buffer access for GPU (future integration)
    get_entity_transforms_offset(): number;
    get_entity_metadata_offset(): number;
    get_entity_metadata_size(): number;

    // Mesh-bucket draw table (B2/B3): same-mesh entities are contiguous in the
    // instance buffer; each mesh renders as one drawIndexed over [start, start+count)
    get_mesh_bucket_start(meshIndex: number): number;
    get_mesh_bucket_count(meshIndex: number): number;

    // Debug functions for buffer layout investigation
    get_entity_size(): number;
    get_entity_stride(): number;
    debug_get_entity_mesh_id(index: number): number;

    // Per-component scalar getters by design: the wasm32 C ABI cannot return structs,
    // so vec3 aggregation happens bridge-side (getEntityPosition/getEntityVelocity below).

    // Entity position getters
    get_entity_position_x(index: number): number;
    get_entity_position_y(index: number): number;
    get_entity_position_z(index: number): number;

    // Entity velocity getters
    get_entity_velocity_x(index: number): number;
    get_entity_velocity_y(index: number): number;
    get_entity_velocity_z(index: number): number;

    // Collision shape configuration (optional - may not be present in older WASM)
    spawn_entity_with_collider?(x: number, y: number, z: number, collision_shape: number, extent_x: number, extent_y: number, extent_z: number, mesh_type_id: number): number;
    set_entity_collision_shape?(id: number, shape: number, extent_x: number, extent_y: number, extent_z: number): void;
    get_entity_collision_shape?(id: number): number;
    get_entity_collision_extent_x?(id: number): number;
    get_entity_collision_extent_y?(id: number): number;
    get_entity_collision_extent_z?(id: number): number;

    // Collision debug functions
    get_collision_checks_performed(): number;
    get_collisions_detected(): number;
    get_kinematic_collision_flag(): boolean;
    get_collision_state(): number;
    debug_get_entity_physics_info(id: number, info_type: number): number;
    debug_get_collision_radius?(id: number): number;
    get_wasm_version(): number;

    // Collision event logging functions
    get_collision_event_counter(): number;
    get_last_collision_entities(): number; // Returns packed u64 (32 bits each entity ID)
    get_last_collision_pos1(axis: number): number; // axis: 0=x, 1=y, 2=z
    get_last_collision_pos2(axis: number): number; // axis: 0=x, 1=y, 2=z
    clear_collision_event_counter(): void;

    // WASM memory
    memory: WebAssembly.Memory;
}

export class WasmPhysicsBridge {
    private wasm?: WasmPhysicsInterface;
    private nextEntityId = 0;
    private entityIdMap = new Map<string, number>(); // GameObject ID -> WASM entity ID
    private gameObjectMap = new Map<number, GameObject>(); // WASM entity ID -> GameObject

    private isInitialized = false;

    constructor() {
        console.log('🌉 WasmPhysicsBridge created');
    }

    async init(wasmModule?: WasmPhysicsInterface): Promise<void> {
        if (wasmModule) {
            // Use provided module (for testing/custom scenarios)
            this.wasm = wasmModule;
            this.wasm.init();
            this.isInitialized = true;
            console.log('✅ WasmPhysicsBridge initialized with provided WASM module');
        } else {
            console.log('🔄 Loading real WASM physics module...');
            const loadedWasm = await WasmLoader.loadPhysicsModule();

            if (!loadedWasm) {
                throw new Error('❌ Failed to load WASM physics module');
            }
            this.wasm = loadedWasm;
            this.wasm.init();
            this.isInitialized = true;
            console.log('✅ WasmPhysicsBridge initialized with real WASM physics module');
        }
    }

    // Add GameObject to WASM for transform calculation (zero-copy rendering)
    // 🔧 REGISTER ALL: All entities with MeshRenderer go to WASM (triangles AND lines)
    public addEntity(gameObject: GameObject): number | null {
        if (!this.isInitialized) {
            return null;
        }

        if (!this.wasm) { // Safety check - remove?
            throw new Error('WASM module not initialized - cannot add entity to physics and rendering system');
        }


        // All entities with MeshRenderer go to WASM (both triangles and lines)
        const meshRenderer = gameObject.getMeshRenderer();
        if (!meshRenderer) {
            console.log(`⚪ Skipping GameObject "${gameObject.name}" - no MeshRenderer`);
            return null;
        }

        console.log(`🔵 Registering GameObject "${gameObject.name}" with WASM (meshId: '${meshRenderer.meshId}', renderMode: '${meshRenderer.renderMode}')`);

        // Only register triangle-renderable entities with WASM
        const wasmEntityId = this.nextEntityId++;
        const transform = gameObject.transform;
        const rigidBody = gameObject.getComponent(RigidBody);

        // Register GameObject mapping
        this.entityIdMap.set(gameObject.id, wasmEntityId);
        this.gameObjectMap.set(wasmEntityId, gameObject);

        // Set references in RigidBody component if it exists
        if (rigidBody) {
            rigidBody.setWasmEntityId(wasmEntityId);
            rigidBody.setPhysicsBridge(this);
        }

        // Add to WASM entity system (ALL entities for zero-copy rendering)
        // Default values for non-physics entities
        const mass = rigidBody ? rigidBody.mass : 0;
        const isKinematic = rigidBody ? rigidBody.isKinematic : true; // Static by default

        // Get color and mesh ID from MeshRenderer if it exists
        const color = meshRenderer ? meshRenderer.color : { x: 1, y: 1, z: 1, w: 1 }; // Default white
        const meshIndex = meshRenderer.meshIndex;
        if (meshIndex === undefined) {
            throw new Error(`❌ Mesh index not set for MeshRenderer in GameObject "${gameObject.name}" - ensure added to Scene after renderer initialized`);
        }
        // Get collision shape information from RigidBody
        const collisionShape = rigidBody ? rigidBody.collisionShape : 0; // Default to SPHERE
        const extents = rigidBody ? rigidBody.extents : { x: 0.5, y: 0.5, z: 0.5 }; // Default sphere

        console.log(`   ➡️  Adding entity ${wasmEntityId} to WASM: position=(${transform.position.x}, ${transform.position.y}, ${transform.position.z}), scale=(${transform.scale.x}, ${transform.scale.y}, ${transform.scale.z}), color=(${color.x}, ${color.y}, ${color.z}, ${color.w}), meshIndex=${meshIndex}, mass=${mass}, shape=${collisionShape}, extents=(${extents.x}, ${extents.y}, ${extents.z}), isKinematic=${isKinematic}`);

        // 🔍 RADIUS TRACING: Debug the exact radius value being passed to WASM
        console.log(`🔍 RADIUS TRACE: Passing radius=${extents.x} to WASM add_entity for "${gameObject.name}" (entity ${wasmEntityId})`);

        // Always use legacy add_entity to preserve colors, mass, scale, etc.
        // Then set collision shape separately if enhanced collision system is available
        this.wasm.add_entity(
            wasmEntityId,
            transform.position.x,
            transform.position.y,
            transform.position.z,
            transform.scale.x,
            transform.scale.y,
            transform.scale.z,
            color.x, // Red
            color.y, // Green
            color.z, // Blue
            color.w, // Alpha
            meshIndex,
            0, // material ID — single default material until the Phase 9 asset/material pipeline (GAME_ENGINE_PLAN.md)
            mass,
            extents.x, // Use extents.x as radius for backward compatibility
            isKinematic
        );

        // If enhanced collision system is available, update the collision shape
        if (this.wasm.set_entity_collision_shape) {
            this.wasm.set_entity_collision_shape(wasmEntityId, collisionShape, extents.x, extents.y, extents.z);
            console.log(`🔧 Set collision shape ${collisionShape} with extents (${extents.x}, ${extents.y}, ${extents.z}) for entity ${wasmEntityId}`);
        }

        // Set initial velocity if RigidBody exists and has velocity
        if (rigidBody && (rigidBody.velocity.x !== 0 || rigidBody.velocity.y !== 0 || rigidBody.velocity.z !== 0)) {
            this.wasm.set_entity_velocity(wasmEntityId, rigidBody.velocity.x, rigidBody.velocity.y, rigidBody.velocity.z);
        }

        const entityType = rigidBody ? 'physics' : 'static';
        console.log(`🔵 Added ${entityType} entity ${wasmEntityId} for GameObject "${gameObject.name}" (Total WASM entities: ${this.nextEntityId})
        💡 WASM Bridge Stats: JS entities tracked=${this.entityIdMap.size}, WASM entities=${this.wasm?.get_entity_count?.() || 'unknown'}`);
        return wasmEntityId;
    }

    // Legacy method name for compatibility (redirect to addEntity)
    public addPhysicsEntity(gameObject: GameObject): number | null {
        return this.addEntity(gameObject);
    }

    // Remove GameObject from physics simulation
    public removePhysicsEntity(gameObjectId: string): boolean {
        const wasmEntityId = this.entityIdMap.get(gameObjectId);
        if (wasmEntityId === undefined) {
            return false;
        }

        // Remove from WASM physics simulation
        if (this.wasm) {
            this.wasm.remove_entity(wasmEntityId);
        }

        // Clean up mappings
        this.entityIdMap.delete(gameObjectId);
        this.gameObjectMap.delete(wasmEntityId);

        console.log(`🗑️ Removed physics entity ${wasmEntityId} for GameObject "${gameObjectId}"`);
        return true;
    }

    // Update physics simulation (called each frame by Scene)
    public update(deltaTime: number): void {
        if (!this.isInitialized || !this.wasm) {
            return;
        }

        // Run WASM physics simulation step
        this.wasm.update(deltaTime);

        // Sync physics results back to GameObjects
        this.syncPhysicsResults();
    }

    // Apply force to physics entity (overloaded method)
    public applyForce(wasmEntityId: number, fxOrForce: number | { x: number; y: number; z: number }, fy?: number, fz?: number): void {
        if (this.wasm) {
            if (typeof fxOrForce === 'object') {
                // Force object provided
                this.wasm.apply_force(wasmEntityId, fxOrForce.x, fxOrForce.y, fxOrForce.z);
                console.log(`💥 Applied force (${fxOrForce.x}, ${fxOrForce.y}, ${fxOrForce.z}) to entity ${wasmEntityId}`);
            } else {
                // Individual parameters provided
                this.wasm.apply_force(wasmEntityId, fxOrForce, fy!, fz!);
                console.log(`💥 Applied force (${fxOrForce}, ${fy}, ${fz}) to entity ${wasmEntityId}`);
            }
        }
    }

    // Set entity velocity (for direct velocity control)
    public setEntityVelocity(wasmEntityId: number, velocity: { x: number; y: number; z: number }): void {
        if (this.wasm) {
            this.wasm.set_entity_velocity(wasmEntityId, velocity.x, velocity.y, velocity.z);
            console.log(`🏃 Set velocity (${velocity.x}, ${velocity.y}, ${velocity.z}) for entity ${wasmEntityId}`);
        }
    }

    // Set entity position (for kinematic control)
    public setEntityPosition(wasmEntityId: number, position: { x: number; y: number; z: number }): void {
        if (this.wasm) {
            this.wasm.set_entity_position(wasmEntityId, position.x, position.y, position.z);
            console.log(`📍 Set position (${position.x}, ${position.y}, ${position.z}) for entity ${wasmEntityId}`);
        }
    }

    // Update entity position in WASM (for kinematic bodies)
    public updateEntity(wasmEntityId: number, position: { x: number; y: number; z: number }, velocity: { x: number; y: number; z: number }): void {
        if (this.wasm) {
            this.wasm.set_entity_position(wasmEntityId, position.x, position.y, position.z);
            this.wasm.set_entity_velocity(wasmEntityId, velocity.x, velocity.y, velocity.z);
        }
    }

    // Update entity rotation in WASM
    public updateEntityRotation(wasmEntityId: number, rotation: { x: number; y: number; z: number }): void {
        if (this.wasm) {
            // Convert degrees to radians (WASM expects radians)
            const radX = rotation.x * Math.PI / 180;
            const radY = rotation.y * Math.PI / 180;
            const radZ = rotation.z * Math.PI / 180;
            this.wasm.set_entity_rotation(wasmEntityId, radX, radY, radZ);
        }
    }

    // Update entity scale in WASM
    public updateEntityScale(wasmEntityId: number, scale: { x: number; y: number; z: number }): void {
        if (this.wasm) {
            this.wasm.set_entity_scale(wasmEntityId, scale.x, scale.y, scale.z);
        }
    }

    // Entity position as a vec3 (aggregates the scalar WASM getters)
    public getEntityPosition(wasmEntityId: number): Vector3 | null {
        if (!this.wasm) return null;

        try {
            return {
                x: this.wasm.get_entity_position_x(wasmEntityId),
                y: this.wasm.get_entity_position_y(wasmEntityId),
                z: this.wasm.get_entity_position_z(wasmEntityId),
            };
        } catch (error) {
            console.warn(`Failed to get entity position for ${wasmEntityId}:`, error);
            return null;
        }
    }

    // Entity velocity as a vec3 (aggregates the scalar WASM getters)
    public getEntityVelocity(wasmEntityId: number): Vector3 | null {
        if (!this.wasm) return null;

        try {
            return {
                x: this.wasm.get_entity_velocity_x(wasmEntityId),
                y: this.wasm.get_entity_velocity_y(wasmEntityId),
                z: this.wasm.get_entity_velocity_z(wasmEntityId),
            };
        } catch (error) {
            console.warn(`Failed to get entity velocity for ${wasmEntityId}:`, error);
            return null;
        }
    }

    // Get physics data for entity (for reading from WASM)
    public getEntityData(wasmEntityId: number): { position: Vector3 } | null {
        const position = this.getEntityPosition(wasmEntityId);
        return position ? { position } : null;
    }

    // Set kinematic state for entity.
    // TODO(Stage B4/B6 ABI window — docs/instanced-rendering-refactor-plan.md "Agreed sequencing"):
    // there is no set_entity_kinematic WASM export; is_kinematic is fixed at add_entity time.
    // Runtime toggling needs the entity-flags ABI rework (rides with physics_enabled/use_gravity).
    public setKinematic(_wasmEntityId: number, kinematic: boolean): void {
        console.warn(`⚠️ setKinematic(${kinematic}) for entity ${_wasmEntityId} is NOT applied in WASM — kinematic state is fixed at registration (see Stage B4/B6 ABI work)`);
    }

    // Set collision shape for entity
    public setEntityCollisionShape(wasmEntityId: number, shape: number, extentX: number, extentY: number, extentZ: number): void {
        if (this.wasm && this.wasm.set_entity_collision_shape) {
            this.wasm.set_entity_collision_shape(wasmEntityId, shape, extentX, extentY, extentZ);
            console.log(`🔧 Set collision shape ${shape} with extents (${extentX}, ${extentY}, ${extentZ}) for entity ${wasmEntityId}`);
        } else {
            console.warn(`❌ setEntityCollisionShape not available in WASM module for entity ${wasmEntityId}`);
        }
    }

    // Get collision shape information for entity
    public getEntityCollisionInfo(wasmEntityId: number): { shape: number; extents: { x: number; y: number; z: number } } | null {
        if (this.wasm && this.wasm.get_entity_collision_shape && this.wasm.get_entity_collision_extent_x && this.wasm.get_entity_collision_extent_y && this.wasm.get_entity_collision_extent_z) {
            try {
                const shape = this.wasm.get_entity_collision_shape(wasmEntityId);
                const x = this.wasm.get_entity_collision_extent_x(wasmEntityId);
                const y = this.wasm.get_entity_collision_extent_y(wasmEntityId);
                const z = this.wasm.get_entity_collision_extent_z(wasmEntityId);
                return { shape, extents: { x, y, z } };
            } catch (error) {
                console.warn(`Failed to get collision info for entity ${wasmEntityId}:`, error);
                return null;
            }
        }
        return null;
    }

    // Debug: Get actual collision radius being used by WASM physics
    public getEntityCollisionRadius(wasmEntityId: number): number | null {
        if (this.wasm && this.wasm.debug_get_collision_radius) {
            try {
                const radius = this.wasm.debug_get_collision_radius(wasmEntityId);
                return radius >= 0 ? radius : null; // -1.0 indicates entity not found
            } catch (error) {
                console.warn(`Failed to get collision radius for entity ${wasmEntityId}:`, error);
                return null;
            }
        }
        return null;
    }

    // Collision event logging methods
    public getCollisionEventCounter(): number {
        return this.wasm?.get_collision_event_counter() ?? 0;
    }

    public getLastCollisionData(): { entity1: number, entity2: number, pos1: [number, number, number], pos2: [number, number, number] } | null {
        if (!this.wasm) return null;

        try {
            const packedEntities = this.wasm.get_last_collision_entities();
            // Unpack the u64: high 32 bits = entity1, low 32 bits = entity2
            const entity1 = (packedEntities >>> 32) & 0xFFFFFFFF;
            const entity2 = packedEntities & 0xFFFFFFFF;

            const pos1: [number, number, number] = [
                this.wasm.get_last_collision_pos1(0), // x
                this.wasm.get_last_collision_pos1(1), // y
                this.wasm.get_last_collision_pos1(2)  // z
            ];

            const pos2: [number, number, number] = [
                this.wasm.get_last_collision_pos2(0), // x
                this.wasm.get_last_collision_pos2(1), // y
                this.wasm.get_last_collision_pos2(2)  // z
            ];

            return { entity1, entity2, pos1, pos2 };
        } catch (error) {
            console.warn('Failed to get collision data:', error);
            return null;
        }
    }

    public clearCollisionEventCounter(): void {
        this.wasm?.clear_collision_event_counter();
    }

    // Sync physics simulation results back to GameObjects
    private syncPhysicsResults(): void {
        if (!this.wasm) return;

        // Read updated transforms from WASM memory buffers
        for (const [wasmEntityId, gameObject] of this.gameObjectMap) {
            const rigidBody = gameObject.getComponent(RigidBody);
            if (!rigidBody || rigidBody.isKinematic) {
                continue; // Skip kinematic bodies
            }

            // Read actual position from WASM physics simulation
            const position = this.getEntityPosition(wasmEntityId);
            const velocity = this.getEntityVelocity(wasmEntityId);
            if (!position || !velocity) {
                console.warn(`Failed to sync physics results for entity ${wasmEntityId}`);
                continue;
            }

            // Update GameObject transform with new physics position
            gameObject.transform.setPosition(position.x, position.y, position.z);

            // Also update RigidBody velocity for consistency
            rigidBody.velocity.x = velocity.x;
            rigidBody.velocity.y = velocity.y;
            rigidBody.velocity.z = velocity.z;
        }
    }


    // Get statistics (Phase 6: Return real WASM entity count)
    public getStats(): { entityCount: number; isInitialized: boolean; } {
        if (!this.isInitialized) {
            throw new Error('WASM module not initialized - cannot get stats');
        }
        const realEntityCount = this.wasm!.get_entity_count();

        return {
            entityCount: realEntityCount,
            isInitialized: this.isInitialized,
        };
    }

    // Check if WASM module is available
    public hasWasmModule(): boolean {
        return !!this.wasm;
    }

    // Get WASM module for direct access (needed for mesh ID reading)
    public getWasmModule(): WasmPhysicsInterface | undefined {
        return this.wasm;
    }

    // Phase 5: Get WASM memory for zero-copy buffer access
    public getWasmMemory(): ArrayBuffer | null {
        if (!this.wasm?.memory) {
            return null;
        }
        return this.wasm.memory.buffer;
    }

    // Phase 5: Get offset for entity transforms in WASM memory
    public getEntityTransformsOffset(): number | undefined {
        if (!this.wasm) {
            return undefined;
        }
        return this.wasm.get_entity_transforms_offset();
    }

    // Type-safe version for tests - throws if WASM not available
    public getEntityTransformsOffsetSafe(): number {
        const offset = this.getEntityTransformsOffset();
        if (offset === undefined) {
            throw new Error('WASM transforms offset not available');
        }
        return offset;
    }
}
