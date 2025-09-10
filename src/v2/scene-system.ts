// src/v2/scene-system.ts
// Scene system for managing GameObjects and coordinating updates/rendering

import { Camera } from './camera';
import { GameObject } from './gameobject';
import { WebGPURendererV2 } from './webgpu.renderer';
import { WasmPhysicsBridge } from './wasm-physics-bridge';
import { RigidBody } from './components';

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

    // Entity Management
    addGameObject(gameObject: GameObject): void {
        this.entities.set(gameObject.id, gameObject);
        gameObject.setScene(this);

        // Add to physics simulation if it has a RigidBody
        const rigidBody = gameObject.getComponent(RigidBody);
        if (rigidBody) {
            this.physicsBridge.addPhysicsEntity(gameObject);
            console.log(`🔵 Added GameObject "${gameObject.name}" to physics simulation`);
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

        // 4. Sync camera state to WASM for view matrix calculation
        this.syncCameraToWasm();

        // 5. Render with zero-copy buffer access (WASM buffers → GPU directly)
        this.renderZeroCopy();
    }

    // Phase 5: Zero-copy rendering - WASM buffers directly to GPU
    renderZeroCopy(): void {
        if (!this.renderer) return;

        console.log('🚀 Phase 5: Zero-copy rendering from WASM buffers');

        // Check if WASM has entities to render
        const entityCount = this.physicsBridge.getStats().entityCount;
        if (entityCount === 0) {
            console.log('⚠️ No WASM entities to render, falling back to TypeScript rendering');
            this.render(); // Fallback to legacy rendering
            return;
        }

        // Phase 5: Direct WASM buffer to GPU mapping
        if (this.physicsBridge.hasWasmModule()) {
            // Get WASM memory and entity transform data
            const wasmMemory = this.physicsBridge.getWasmMemory();
            const transformsOffset = this.physicsBridge.getEntityTransformsOffset();

            if (wasmMemory && transformsOffset !== undefined) {
                // Map WASM data directly to GPU instance buffer
                this.renderer.mapInstanceDataFromWasm(wasmMemory, transformsOffset, entityCount);

                console.log(`📊 Zero-copy: Mapped ${entityCount} entities from WASM to GPU`);
            } else {
                console.warn('⚠️ WASM memory or transforms offset not available');
                this.render(); // Fallback to legacy rendering
                return;
            }
        } else {
            console.log('📊 Mock mode: Using TypeScript rendering pipeline');
            this.render(); // Fallback to legacy rendering
            return;
        }

        // Update camera matrices (still TypeScript-driven for now)
        const aspect = this.renderer.getAspectRatio();
        const viewProjectionMatrix = this.camera.getViewProjectionMatrix(aspect);
        this.renderer.updateCamera(viewProjectionMatrix);

        // Execute zero-copy GPU rendering commands
        this.renderer.renderFromWasmBuffers();
    }

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

    // Phase 5: Register all entities with WASM physics system
    private registerEntitiesWithWasm(): void {
        console.log('🔗 Registering entities with WASM physics system...');

        let registeredCount = 0;
        for (const gameObject of this.entities.values()) {
            // Only register GameObjects that have RigidBody components
            const rigidBody = gameObject.getComponent(RigidBody);
            if (rigidBody) {
                const wasmEntityId = this.physicsBridge.addPhysicsEntity(gameObject);
                if (wasmEntityId !== null) {
                    registeredCount++;
                }
            }
        }

        console.log(`✅ Registered ${registeredCount} entities with WASM physics system`);
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
