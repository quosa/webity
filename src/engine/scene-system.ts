// src/v2/scene-system.ts
// Scene system for managing GameObjects and coordinating updates/rendering

import { Camera } from './camera';
import { GameObject } from './gameobject';
import { WebGPURendererV2 } from '../renderer/webgpu.renderer';
import { WasmPhysicsBridge } from './wasm-physics-bridge';
import { MeshRenderer, RigidBody } from './components';
import { InputManager } from './input';
import { InputController, CameraController, GameObjectController, OrbitCameraController } from './input-controller';
import { GamepadInputManager, GamepadConfiguration, GAMEPAD_PRESETS } from './gamepad-input';

export class Scene {
    private entities = new Map<string, GameObject>();
    private nextEntityId = 0;

    public camera: Camera;
    private renderer?: WebGPURendererV2;
    public physicsBridge: WasmPhysicsBridge;

    // A3: the scene is pure data until an Engine mounts it. `mounted` gates whether
    // addGameObject registers eagerly (late add / runtime spawn) or defers to mount().
    private mounted = false;
    // What render() asks for the view-projection matrix: the legacy `camera` by default,
    // or a camera GameObject set via setCamera().
    private viewProvider!: { getViewProjectionMatrix(_aspect: number): Float32Array };

    // Input Management
    private inputManager?: InputManager;
    private gamepadInputManager?: GamepadInputManager;
    private activeInputController: InputController | null = null;
    private inputTarget: 'camera' | 'orbit' | GameObject | null = null;

    constructor() {
        // Default camera setup
        this.camera = new Camera(
            [0, 5, -10], // position
            [0, 0, 0],   // target
            Math.PI / 3, // fov (60 degrees in radians)
            0.1,         // near
            100          // far
        );
        this.viewProvider = this.camera;

        // Initialize physics bridge
        this.physicsBridge = new WasmPhysicsBridge();

        // Initialize input managers
        this.inputManager = new InputManager();
        this.inputManager.init((key: number, pressed: boolean) => {
            this.activeInputController?.handleInput(key, pressed);
        });

        this.gamepadInputManager = new GamepadInputManager();
        this.gamepadInputManager.init((key: number, pressed: boolean, _analogValue?: number) => {
            // For now, ignore analog value and just pass to existing input controller
            this.activeInputController?.handleInput(key, pressed);
        });

        // Default to camera control
        this.setInputTarget('camera');
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
    // A3: adding a GameObject is a pure data insert. Registration with the renderer/WASM
    // happens at mount() (Engine.loadScene). If the scene is already mounted (a legacy scene
    // adding objects after init, or a runtime spawn), register the new object immediately.
    addGameObject(gameObject: GameObject): void {
        this.entities.set(gameObject.id, gameObject);
        gameObject.setScene(this);
        if (this.mounted) {
            this.registerEntity(gameObject);
        }
    }

    // Preferred short alias for addGameObject.
    add(gameObject: GameObject): void {
        this.addGameObject(gameObject);
    }

    // Register a single GameObject with the renderer (mesh index) + WASM. Used for eager
    // late adds; errors are logged (matches legacy addGameObject behavior). The mount() path
    // registers strictly (fail-loud) instead.
    private registerEntity(gameObject: GameObject): void {
        try {
            this._addMeshIndex(gameObject);
            const wasmEntityId = this.physicsBridge.addEntity(gameObject);
            const entityType = gameObject.getComponent(RigidBody) ? 'physics' : 'static';
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
    // Legacy alias: existing scenes call scene.init(renderer). New code goes through
    // Engine.loadScene(scene) which registers tree meshes and then calls mount().
    async init(renderer: WebGPURendererV2): Promise<void> {
        return this.mount(renderer);
    }

    // A3: the single deterministic mount. Meshes must already be registered on the renderer
    // (Engine.loadScene does this from the scene tree, or a legacy caller registered them).
    // Resolves each entity's mesh index and registers it with WASM in one pass, failing loud
    // with an aggregated error listing every unresolved GameObject.
    async mount(renderer: WebGPURendererV2): Promise<void> {
        this.renderer = renderer;
        await this.physicsBridge.init();

        const failures: string[] = [];
        for (const gameObject of this.entities.values()) {
            try {
                this._addMeshIndex(gameObject);
                this.physicsBridge.addEntity(gameObject);
            } catch (error) {
                failures.push(`  - "${gameObject.name}": ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        this.mounted = true;

        if (failures.length > 0) {
            throw new Error(`Scene.mount(): failed to register ${failures.length} GameObject(s):\n${failures.join('\n')}`);
        }

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
        // 1. Update input controller BEFORE other systems
        this.activeInputController?.update(deltaTime);

        // 2. Update all GameObject components once (rotators, input-driven forces,
        //    kinematic bodies pushing their transform into WASM, etc.)
        for (const gameObject of this.entities.values()) {
            // Update GameObject (which already calls update on all components)
            gameObject.update(deltaTime);
        }

        // 3. Run WASM physics simulation. bridge.update() also syncs results back into
        //    each dynamic GameObject's transform via syncPhysicsResults(), so no
        //    separate post-physics component pass is needed here.
        this.physicsBridge.update(deltaTime);

        // 4. Sync camera state to WASM for view matrix calculation
        this.syncCameraToWasm();

        // 5. Render with WASM buffer access (WASM buffers → GPU)
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
        const viewProjectionMatrix = this.viewProvider.getViewProjectionMatrix(aspect);
        this.renderer.updateCamera(viewProjectionMatrix);

        // Pure WASM rendering: 2-pass (triangles + lines) from WASM buffers
        const wasmModule = this.physicsBridge.getWasmModule();
        this.renderer.render(wasmModule);
    }

    // TODO: Implement hybrid rendering for non-triangle entities if needed in the future

    // Set the camera used for rendering. Accepts a camera GameObject (PerspectiveCamera /
    // OrthographicCamera) or the legacy Camera — anything that can produce a view-projection
    // matrix. Does not affect the legacy `camera` field used by input controllers.
    setCamera(camera: { getViewProjectionMatrix(_aspect: number): Float32Array }): void {
        this.viewProvider = camera;
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

    // Input Management Methods
    setInputTarget(target: 'camera' | 'orbit' | GameObject | null): void {
        this.inputTarget = target;

        if (target === 'camera') {
            this.activeInputController = new CameraController(this.camera);
        } else if (target === 'orbit') {
            this.activeInputController = new OrbitCameraController(this.camera);
        } else if (target instanceof GameObject) {
            this.activeInputController = new GameObjectController(target);
        } else {
            this.activeInputController = null;
        }

        // Dispatch input target change event for UI updates
        this.dispatchInputTargetChange();
    }

    getInputTarget(): 'camera' | 'orbit' | GameObject | null {
        return this.inputTarget;
    }

    getInputController(): InputController | null {
        return this.activeInputController;
    }

    // Get input controller with type checking
    getCameraController(): CameraController | undefined {
        return this.activeInputController instanceof CameraController ? this.activeInputController : undefined;
    }

    getGameObjectController(): GameObjectController | undefined {
        return this.activeInputController instanceof GameObjectController ? this.activeInputController : undefined;
    }

    getOrbitCameraController(): OrbitCameraController | undefined {
        return this.activeInputController instanceof OrbitCameraController ? this.activeInputController : undefined;
    }

    private dispatchInputTargetChange(): void {
        const event = new CustomEvent('inputTargetChanged', {
            detail: {
                target: this.inputTarget,
                controller: this.activeInputController
            }
        });
        window.dispatchEvent(event);
    }

    // Gamepad configuration methods
    setGamepadConfiguration(config: GamepadConfiguration): void {
        this.gamepadInputManager?.setConfiguration(config);
    }

    getGamepadConfiguration(): GamepadConfiguration | undefined {
        return this.gamepadInputManager?.getConfiguration();
    }

    getGamepadPresets(): Record<string, GamepadConfiguration> {
        return GAMEPAD_PRESETS;
    }

    getConnectedGamepads() {
        return this.gamepadInputManager?.getConnectedGamepads() || [];
    }

    // Dispose method to clean up resources
    dispose(): void {
        this.inputManager?.dispose();
        this.gamepadInputManager?.dispose();
        this.activeInputController = null;
        this.inputTarget = null;
        console.log('🧹 Scene disposed - input managers cleaned up');
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
