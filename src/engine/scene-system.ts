// src/v2/scene-system.ts
// Scene system for managing GameObjects and coordinating updates/rendering

import { Camera } from './camera';
import { GameObject } from './gameobject';
import { WebGPURendererV2 } from '../renderer/webgpu.renderer';
import { WasmPhysicsBridge } from './wasm-physics-bridge';
import { MeshRenderer, RigidBody } from './components';

export class Scene {
    private entities = new Map<string, GameObject>();
    private nextEntityId = 0;

    public camera: Camera;
    private renderer?: WebGPURendererV2;
    public physicsBridge: WasmPhysicsBridge;

    constructor() {
        // Default camera setup
        this.camera = new Camera(
            [0, 5, -10], // position
            [0, 0, 0],   // target
            Math.PI / 3, // fov (60 degrees in radians)
            0.1,         // near
            100          // far
        );

        // Initialize physics bridge
        this.physicsBridge = new WasmPhysicsBridge();
    }
    _addMeshIndex(gameObject: GameObject) {
        const meshRenderer = gameObject.getComponent(MeshRenderer);
        if (!meshRenderer) {
            console.log(`⚪ GameObject "${gameObject.name}" has no MeshRenderer - skipping mesh index assignment`);
            return;
        }
        if (meshRenderer.meshIndex !== undefined) {
            console.log(`✅ GameObject "${gameObject.name}" already has mesh index ${meshRenderer.meshIndex}`);
            return; // Already has mesh index assigned
        }

        if (!this.renderer) {
            throw new Error('❌ Renderer not set in Scene - cannot get mesh index');
        }

        console.log(`🔍 Getting mesh index for "${meshRenderer.meshId}" in GameObject "${gameObject.name}"`);
        const meshIndex = this.renderer.getMeshIndex(meshRenderer.meshId);
        if (meshIndex === undefined) {
            throw new Error(`❌ Unknown mesh ID "${meshRenderer.meshId}" in GameObject "${gameObject.name}" - make sure mesh is registered with renderer`);
        }
        meshRenderer.meshIndex = meshIndex;
        console.log(`✅ Assigned mesh index ${meshIndex} for "${meshRenderer.meshId}" to GameObject "${gameObject.name}"`);
    }

    // Entity Management
    addGameObject(gameObject: GameObject): void {
        this.entities.set(gameObject.id, gameObject);
        gameObject.setScene(this);

        try {
            // Add ALL GameObjects to WASM for zero-copy rendering (physics and static entities)
            this._addMeshIndex(gameObject);
            const wasmEntityId = this.physicsBridge.addEntity(gameObject);
            const rigidBody = gameObject.getComponent(RigidBody);
            const entityType = rigidBody ? 'physics' : 'static';
            console.log(`🔵 Added GameObject "${gameObject.name}" to WASM as ${entityType} entity (wasmId: ${wasmEntityId})`);
        } catch (error) {
            console.error(`❌ Failed to add GameObject "${gameObject.name}" to WASM:`, error);
        }
    }

    removeGameObject(id: string): boolean {
        const gameObject = this.entities.get(id);
        if (!gameObject) return false;

        // Clean up hierarchy references
        if (gameObject.parentId) {
            const parent = this.getGameObject(gameObject.parentId);
            parent?.removeChild(id);
        }

        // Remove all children recursively
        for (const childId of [...gameObject.childIds]) {
            this.removeGameObject(childId);
        }

        // Remove from physics simulation if it has a RigidBody
        const rigidBody = gameObject.getComponent(RigidBody);
        if (rigidBody) {
            this.physicsBridge.removePhysicsEntity(gameObject.id);
            console.log(`🗑️ Removed GameObject "${gameObject.name}" from physics simulation`);
        }

        // Remove from scene
        gameObject.setScene(null);
        this.entities.delete(id);
        return true;
    }

    getGameObject(id: string): GameObject | null {
        return this.entities.get(id) || null;
    }

    getAllGameObjects(): GameObject[] {
        return Array.from(this.entities.values());
    }

    // Generate unique ID for entities
    generateEntityId(): string {
        return `entity_${this.nextEntityId++}`;
    }

    // Lifecycle Methods
    async init(renderer: WebGPURendererV2): Promise<void> {
        this.renderer = renderer;

        // Initialize physics bridge for Phase 5 zero-copy integration
        await this.physicsBridge.init();
        console.log('🌉 Physics bridge initialized for Phase 5');

        // Register all entities with WASM physics system
        this.registerEntitiesWithWasm();

        // Initialize all GameObjects and their components
        this.awake();
    }

    // Phase 5: Complete scene lifecycle - awake all GameObjects and components
    awake(): void {
        console.log('🌟 Scene.awake() - Initializing all GameObjects and components...');

        for (const gameObject of this.entities.values()) {
            // Awake the GameObject (which already calls awake on all components)
            gameObject.awake();
        }

        console.log(`✅ Awakened ${this.entities.size} GameObjects with their components`);
    }

    // Phase 5: Start all GameObjects and components after awake
    start(): void {
        console.log('🚀 Scene.start() - Starting all GameObjects and components...');

        for (const gameObject of this.entities.values()) {
            // Start the GameObject (which already calls start on all components)
            gameObject.start();
        }

        console.log(`✅ Started ${this.entities.size} GameObjects with their components`);
    }

    // Phase 5: Zero-copy update loop - WASM becomes master data source
    update(deltaTime: number): void {
        // 1. Update all GameObject components (minimal TypeScript coordination)
        for (const gameObject of this.entities.values()) {
            // Update GameObject (which already calls update on all components)
            gameObject.update(deltaTime);
        }

        // 2. Apply any input forces to WASM (future: InputManager integration)
        // this.inputManager?.applyToWasm(this.physicsBridge);

        // 3. Run WASM physics simulation (master data updated automatically in WASM)
        this.physicsBridge.update(deltaTime);

        // 4. Update GameObject components (so RigidBody can sync from WASM physics results)
        for (const gameObject of this.entities.values()) {
            // Update GameObject (which calls update on all components)
            gameObject.update(deltaTime);
        }

        // 5. Sync camera state to WASM for view matrix calculation
        this.syncCameraToWasm();

        // 6. Render with zero-copy buffer access (WASM buffers → GPU directly)
        this.render();
    }

    // Phase 6: WASM instance buffer entity rendering (2-pass: triangles + lines)
    render(): void {
        if (!this.renderer) return; //TODO: throw error?
        if (!this.physicsBridge.hasWasmModule()) return; //TODO: throw error?

        const wasmEntityCount = this.physicsBridge.getStats().entityCount;
        if (wasmEntityCount === 0) return; // Nothing to render

        // console.log(`📊 Pure WASM rendering: ${wasmEntityCount} entities registered with WASM`);

        // Get WASM memory and entity transform data
        const wasmMemory = this.physicsBridge.getWasmMemory();
        if (!wasmMemory) {
            console.warn('⚠️ WASM memory not available - skipping frame');
            return;
        }
        const transformsOffset = this.physicsBridge.getEntityTransformsOffset();
        if (transformsOffset === undefined) {
            console.warn('⚠️ WASM transforms offset not available - skipping frame');
            return;
        }

        // Map WASM data directly to GPU instance buffer
        this.renderer.mapInstanceDataFromWasm(wasmMemory, transformsOffset, wasmEntityCount);

        // Update camera matrices
        const aspect = this.renderer.getAspectRatio();
        // TODO: camera view-projection goes directly to renderer still (ts->webgpu uniform)
        //       not sure if this makes sense to move to WASM (only 1/frame update cost)
        const viewProjectionMatrix = this.camera.getViewProjectionMatrix(aspect);
        this.renderer.updateCamera(viewProjectionMatrix);

        // Pure WASM rendering: 2-pass (triangles + lines) from WASM buffers
        const wasmModule = this.physicsBridge.getWasmModule();
        // this.renderer.renderFromWasmBuffers(wasmModule);
        this.renderer.render(wasmModule);
    }

    // TODO: Implement hybrid rendering for non-triangle entities if needed in the future

    /*
    // Legacy TypeScript rendering (Phase 4 and earlier) - kept for fallback
    render(): void {
        if (!this.renderer) return;

        // Update camera matrices
        const aspect = this.renderer.getAspectRatio();
        const viewProjectionMatrix = this.camera.getViewProjectionMatrix(aspect);

        // Collect renderable entities from GameObjects
        const renderableEntities = [];

        for (const gameObject of this.entities.values()) {
            const meshRenderer = gameObject.getMeshRenderer();
            if (meshRenderer && gameObject.isActive()) {
                // Convert GameObject to Entity format for renderer
                // NOTE: Renderer expects rotation in RADIANS, but GameObject stores in DEGREES
                const entity = {
                    id: gameObject.id,
                    meshId: meshRenderer.meshId,
                    transform: {
                        position: [gameObject.transform.position.x, gameObject.transform.position.y, gameObject.transform.position.z] as [number, number, number],
                        rotation: [
                            gameObject.transform.rotation.x * Math.PI / 180,  // Convert degrees to radians
                            gameObject.transform.rotation.y * Math.PI / 180,  // Convert degrees to radians
                            gameObject.transform.rotation.z * Math.PI / 180   // Convert degrees to radians
                        ] as [number, number, number],
                        scale: [gameObject.transform.scale.x, gameObject.transform.scale.y, gameObject.transform.scale.z] as [number, number, number]
                    },
                    color: [meshRenderer.color.x, meshRenderer.color.y, meshRenderer.color.z, meshRenderer.color.w] as [number, number, number, number],
                    renderMode: meshRenderer.renderMode
                };
                renderableEntities.push(entity);
            }
        }

        // Update renderer with current entities and camera
        this.renderer.updateEntities(renderableEntities);
        this.renderer.updateCamera(viewProjectionMatrix);
        this.renderer.render();
    }
    */

    // Phase 5: Register all entities with WASM (now that WASM is initialized)
    private registerEntitiesWithWasm(): void {
        console.log('🔗 Registering ALL entities with WASM (now that WASM is initialized)...');

        let registeredCount = 0;
        for (const gameObject of this.entities.values()) {
            // Re-register ALL GameObjects with WASM now that it's initialized
            // addGameObject() tried to register before WASM was ready
            const wasmEntityId = this.physicsBridge.addEntity(gameObject);
            if (wasmEntityId !== null) {
                registeredCount++;
                const entityType = gameObject.getComponent(RigidBody) ? 'physics' : 'static';
                console.log(`🔗 Registered ${entityType} entity "${gameObject.name}" with WASM ID ${wasmEntityId}`);
            }
        }

        console.log(`✅ Registered ${registeredCount} entities with WASM system (after initialization)`);
    }

    // Phase 5: Sync camera state to WASM for view matrix calculation
    private syncCameraToWasm(): void {
        // TODO: Future implementation - sync camera to WASM for view matrix calculation
        // For Phase 5, camera matrices are still calculated in TypeScript
        // This method is a placeholder for future WASM camera integration

        // Future WASM camera sync:
        // this.physicsBridge.setCameraPosition(this.camera.getPosition());
        // this.physicsBridge.setCameraTarget(this.camera.getTarget());
    }

    // Utility Methods
    findGameObjectByName(name: string): GameObject | null {
        for (const gameObject of this.entities.values()) {
            if (gameObject.name === name) {
                return gameObject;
            }
        }
        return null;
    }

    findGameObjectsByTag(tag: string): GameObject[] {
        const results = [];
        for (const gameObject of this.entities.values()) {
            if (gameObject.tag === tag) {
                results.push(gameObject);
            }
        }
        return results;
    }

    // Debug info
    getEntityCount(): number {
        return this.entities.size;
    }

    getSceneInfo(): { entityCount: number; cameraPosition: number[]; physicsStats?: any } {
        const physicsStats = this.physicsBridge.getStats();
        return {
            entityCount: this.entities.size,
            cameraPosition: this.camera.getPosition(),
            physicsStats
        };
    }
}
