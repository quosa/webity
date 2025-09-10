// src/v2/wasm-physics-bridge.ts
// Bridge between TypeScript Scene system and WASM physics simulation

import { GameObject } from './gameobject';
import { RigidBody } from './components';

export interface WasmPhysicsInterface {
    // WASM module exports (will be implemented in Phase 3)
    init(): void;
    update(_deltaTime: number): void;

    // Entity lifecycle
    add_entity(_id: number, _x: number, _y: number, _z: number, _meshId: number, _materialId: number, _mass: number, _isKinematic: boolean): void;
    remove_entity(_id: number): void;
    get_entity_count(): number;

    // Physics interaction
    apply_force(_id: number, _fx: number, _fy: number, _fz: number): void;
    set_entity_position(_id: number, _x: number, _y: number, _z: number): void;
    set_entity_velocity(_id: number, _vx: number, _vy: number, _vz: number): void;

    // Zero-copy buffer access for GPU (future integration)
    get_entity_transforms_offset(): number;
    get_entity_metadata_offset(): number;

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

    // Initialize WASM physics module
    async init(wasmModule?: WasmPhysicsInterface): Promise<void> {
        if (wasmModule) {
            this.wasm = wasmModule;
            this.wasm.init();
            this.isInitialized = true;
            console.log('✅ WasmPhysicsBridge initialized with WASM module');
        } else {
            // Mock implementation for Phase 3 development
            this.isInitialized = true;
            console.log('🔶 WasmPhysicsBridge initialized in mock mode (no WASM module)');
        }
    }

    // Add GameObject with RigidBody to physics simulation
    public addPhysicsEntity(gameObject: GameObject): number | null {
        const rigidBody = gameObject.getComponent(RigidBody);
        if (!rigidBody || !this.isInitialized) {
            return null;
        }

        const wasmEntityId = this.nextEntityId++;
        const transform = gameObject.transform;

        // Register GameObject mapping
        this.entityIdMap.set(gameObject.id, wasmEntityId);
        this.gameObjectMap.set(wasmEntityId, gameObject);

        // Set references in RigidBody component
        rigidBody.setWasmEntityId(wasmEntityId);
        rigidBody.setPhysicsBridge(this);

        // Add to WASM physics simulation
        if (this.wasm) {
            this.wasm.add_entity(
                wasmEntityId,
                transform.position.x,
                transform.position.y,
                transform.position.z,
                this.getMeshIdForCollider(rigidBody.colliderType),
                0, // material ID (TODO: implement material system)
                rigidBody.mass,
                rigidBody.isKinematic
            );

            // Set initial velocity if any
            if (rigidBody.velocity.x !== 0 || rigidBody.velocity.y !== 0 || rigidBody.velocity.z !== 0) {
                this.wasm.set_entity_velocity(wasmEntityId, rigidBody.velocity.x, rigidBody.velocity.y, rigidBody.velocity.z);
            }
        }

        console.log(`🔵 Added physics entity ${wasmEntityId} for GameObject "${gameObject.name}"`);
        return wasmEntityId;
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

    // Apply force to physics entity
    public applyForce(wasmEntityId: number, fx: number, fy: number, fz: number): void {
        if (this.wasm) {
            this.wasm.apply_force(wasmEntityId, fx, fy, fz);
            console.log(`💥 Applied force (${fx}, ${fy}, ${fz}) to entity ${wasmEntityId}`);
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
    public getEntityData(_wasmEntityId: number): { position: { x: number; y: number; z: number } } | null {
        // TODO: Implement reading from WASM memory buffers
        // For now, return mock data
        return {
            position: { x: 0, y: 0, z: 0 }
        };
    }

    // Set kinematic state for entity
    public setKinematic(_wasmEntityId: number, kinematic: boolean): void {
        console.log(`🎮 Set entity ${_wasmEntityId} kinematic: ${kinematic}`);
        // TODO: Implement WASM kinematic state update
    }

    // Sync physics simulation results back to GameObjects
    private syncPhysicsResults(): void {
        if (!this.wasm) return;

        // TODO: Read updated transforms from WASM memory buffers
        // For now, this is a placeholder for zero-copy integration

        for (const [_wasmEntityId, gameObject] of this.gameObjectMap) {
            const rigidBody = gameObject.getComponent(RigidBody);
            if (!rigidBody || rigidBody.isKinematic) {
                continue; // Skip kinematic bodies
            }

            // TODO: Get actual position/rotation from WASM physics simulation
            // const wasmData = this.readEntityFromWasm(wasmEntityId);
            // gameObject.transform.setPosition(wasmData.position.x, wasmData.position.y, wasmData.position.z);
        }
    }

    // Convert collider type to mesh ID for WASM
    private getMeshIdForCollider(colliderType: 'sphere' | 'box'): number {
        switch (colliderType) {
        case 'sphere': return 0; // WASM sphere mesh ID
        case 'box': return 1;    // WASM box mesh ID
        default: return 0;
        }
    }

    // Get statistics
    public getStats(): { entityCount: number; isInitialized: boolean; hasMockWasm: boolean } {
        return {
            entityCount: this.entityIdMap.size,
            isInitialized: this.isInitialized,
            hasMockWasm: !this.wasm
        };
    }

    // Check if WASM module is available
    public hasWasmModule(): boolean {
        return !!this.wasm;
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
}
