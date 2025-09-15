// src/v2/wasm-physics-bridge.ts
// Bridge between TypeScript Scene system and WASM physics simulation

import { GameObject } from './gameobject';
import { RigidBody } from './components';
import { WasmLoader } from './wasm-loader';

export interface WasmPhysicsInterface {
    // WASM module exports (will be implemented in Phase 3)
    init(): void;
    update(_deltaTime: number): void;

    // Entity lifecycle
    add_entity(_id: number, _x: number, _y: number, _z: number, _scaleX: number, _scaleY: number, _scaleZ: number, _colorR: number, _colorG: number, _colorB: number, _colorA: number, _meshId: number, _materialId: number, _mass: number, _radius: number, _isKinematic: boolean): void;
    remove_entity(_id: number): void;
    get_entity_count(): number;

    // Physics interaction
    apply_force(_id: number, _fx: number, _fy: number, _fz: number): void;
    set_entity_position(_id: number, _x: number, _y: number, _z: number): void;
    set_entity_velocity(_id: number, _vx: number, _vy: number, _vz: number): void;

    // Zero-copy buffer access for GPU (future integration)
    get_entity_transforms_offset(): number;
    get_entity_metadata_offset(): number;
    get_entity_metadata_size(): number;

    // Debug functions for buffer layout investigation
    get_entity_size(): number;
    get_entity_stride(): number;
    debug_get_entity_mesh_id(_index: number): number;

    // TODO: make these return a vec3 or similar

    // Entity position getters
    get_entity_position_x(_index: number): number;
    get_entity_position_y(_index: number): number;
    get_entity_position_z(_index: number): number;

    // Entity velocity getters
    get_entity_velocity_x(_index: number): number;
    get_entity_velocity_y(_index: number): number;
    get_entity_velocity_z(_index: number): number;

    // Collision debug functions
    get_collision_checks_performed(): number;
    get_collisions_detected(): number;
    get_kinematic_collision_flag(): boolean;
    get_collision_state(): number;
    debug_get_entity_physics_info(_id: number, _info_type: number): number;
    get_wasm_version(): number;

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
        // Calculate physics radius from RigidBody colliderSize (use X component for spheres)
        const physicsRadius = rigidBody ? rigidBody.colliderSize.x : 0.5; // Default to 0.5 for static objects

        console.log(`   ➡️  Adding entity ${wasmEntityId} to WASM: position=(${transform.position.x}, ${transform.position.y}, ${transform.position.z}), scale=(${transform.scale.x}, ${transform.scale.y}, ${transform.scale.z}), color=(${color.x}, ${color.y}, ${color.z}, ${color.w}), meshIndex=${meshIndex}, mass=${mass}, radius=${physicsRadius}, isKinematic=${isKinematic}`);
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
            0, // material ID (TODO: implement material system)
            mass,
            physicsRadius,
            isKinematic
        );

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

    // Get physics data for entity (for reading from WASM)
    public getEntityData(wasmEntityId: number): { position: { x: number; y: number; z: number } } | null {
        if (!this.wasm) return null;

        try {
            const x = this.wasm.get_entity_position_x(wasmEntityId);
            const y = this.wasm.get_entity_position_y(wasmEntityId);
            const z = this.wasm.get_entity_position_z(wasmEntityId);

            return {
                position: { x, y, z }
            };
        } catch (error) {
            console.warn(`Failed to get entity data for ${wasmEntityId}:`, error);
            return null;
        }
    }

    // Set kinematic state for entity
    public setKinematic(_wasmEntityId: number, kinematic: boolean): void {
        console.log(`🎮 Set entity ${_wasmEntityId} kinematic: ${kinematic}`);
        // TODO: Implement WASM kinematic state update
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
            try {
                const newX = this.wasm.get_entity_position_x(wasmEntityId);
                const newY = this.wasm.get_entity_position_y(wasmEntityId);
                const newZ = this.wasm.get_entity_position_z(wasmEntityId);

                // Update GameObject transform with new physics position
                gameObject.transform.setPosition(newX, newY, newZ);

                // Also update RigidBody velocity for consistency
                const velX = this.wasm.get_entity_velocity_x(wasmEntityId);
                const velY = this.wasm.get_entity_velocity_y(wasmEntityId);
                const velZ = this.wasm.get_entity_velocity_z(wasmEntityId);

                rigidBody.velocity.x = velX;
                rigidBody.velocity.y = velY;
                rigidBody.velocity.z = velZ;
            } catch (error) {
                console.warn(`Failed to sync physics results for entity ${wasmEntityId}:`, error);
            }
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
