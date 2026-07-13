// src/v2/scene-system.ts
// Scene system for managing GameObjects and coordinating updates/rendering

import { CameraObject, PerspectiveCamera } from './camera-object';
import { GameObject } from './gameobject';
import { CameraComponent } from './components';
import { InputManager } from './input';
import { InputController, CameraController, GameObjectController, OrbitCameraController } from './input-controller';
import { GamepadInputManager, GamepadConfiguration, GAMEPAD_PRESETS } from './gamepad-input';

// The runtime a Scene is bound to once mounted (implemented by the Engine). The Scene is pure
// data + lifecycle; it delegates entity registration for runtime spawns/removals to the Engine,
// which owns the renderer and physics bridge.
export interface SceneRuntime {
    registerRuntimeEntity(gameObject: GameObject): void;
    unregisterRuntimeEntity(gameObject: GameObject): void;
}

export class Scene {
    private entities = new Map<string, GameObject>();
    private nextEntityId = 0;

    // The single camera source of truth: a camera GameObject. Both rendering (view-projection)
    // and input controllers operate on its CameraComponent. `camera` exposes that component so
    // scenes/HTML can drive it (setPosition/lookAt/move/orbit) with no legacy Camera class.
    private activeCamera: CameraObject;
    get camera(): CameraComponent {
        return this.activeCamera.cameraComponent;
    }
    // A3: the scene is pure data until an Engine mounts it (Engine.loadScene). Once bound, late
    // adds/removes (runtime spawns) register through the Engine; before binding they are pure
    // data inserts. The Scene holds no renderer or physics bridge — the Engine owns those.
    private runtime: SceneRuntime | undefined = undefined;

    // Input Management
    private inputManager?: InputManager;
    private gamepadInputManager?: GamepadInputManager;
    private activeInputController: InputController | null = null;
    private inputTarget: 'camera' | 'orbit' | GameObject | null = null;

    constructor() {
        // Default camera: a PerspectiveCamera GameObject (not added to the entity map, so it
        // never registers with WASM). Scenes replace it via setCamera(); until then this is
        // both the render source and the input controllers' target.
        this.activeCamera = new PerspectiveCamera('scene-default-camera', { fov: Math.PI / 3 });
        this.activeCamera.transform.setPosition(0, 5, -10);
        this.activeCamera.lookAt(0, 0, 0);

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

    // Entity Management
    // A3: adding a GameObject is a pure data insert. Registration with the renderer/WASM happens
    // in Engine.loadScene. If the scene is already mounted (a runtime spawn after load), the bound
    // Engine registers the new object immediately.
    addGameObject(gameObject: GameObject): void {
        this.entities.set(gameObject.id, gameObject);
        gameObject.setScene(this);
        this.runtime?.registerRuntimeEntity(gameObject);
    }

    // Preferred short alias for addGameObject.
    add(gameObject: GameObject): void {
        this.addGameObject(gameObject);
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

        // Remove from physics simulation (the bound Engine skips non-physics entities).
        this.runtime?.unregisterRuntimeEntity(gameObject);

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
    // Bind/unbind the runtime (Engine). Called by Engine.loadScene after the initial entities are
    // registered, so subsequent runtime spawns register through the Engine.
    bindRuntime(runtime: SceneRuntime): void {
        this.runtime = runtime;
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

    // Per-frame component update, driven by the Engine's loop (Engine.tick): input controller
    // first, then every GameObject's components (rotators, input-driven forces, kinematic bodies
    // pushing their transform into WASM). The Engine runs physics + render around this.
    updateComponents(deltaTime: number): void {
        this.activeInputController?.update(deltaTime);
        for (const gameObject of this.entities.values()) {
            gameObject.update(deltaTime);
        }
    }

    // The camera view-projection for the given aspect ratio (the Engine pushes this to the
    // renderer each frame). The active camera GameObject is the single source of truth.
    getViewProjectionMatrix(aspect: number): Float32Array {
        return this.activeCamera.getViewProjectionMatrix(aspect);
    }

    // Set the camera GameObject used for both rendering and input (PerspectiveCamera /
    // OrthographicCamera). Rebinds the active camera/orbit input controller onto the new
    // camera so a setCamera() call after construction takes effect for free-fly/orbit input.
    setCamera(camera: CameraObject): void {
        this.activeCamera = camera;
        if (this.inputTarget === 'camera' || this.inputTarget === 'orbit') {
            this.setInputTarget(this.inputTarget);
        }
    }


    // Input Management Methods
    setInputTarget(target: 'camera' | 'orbit' | GameObject | null): void {
        this.inputTarget = target;

        if (target === 'camera') {
            this.activeInputController = new CameraController(this.activeCamera.cameraComponent);
        } else if (target === 'orbit') {
            this.activeInputController = new OrbitCameraController(this.activeCamera.cameraComponent);
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
        this.runtime = undefined; // unbind from the Engine
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

    getSceneInfo(): { entityCount: number; cameraPosition: number[] } {
        return {
            entityCount: this.entities.size,
            cameraPosition: this.camera.getPosition(),
        };
    }
}
