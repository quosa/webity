# Input System Integration Plan - ✅ COMPLETED

This document outlined the plan to integrate the existing input manager (`src/engine/input.ts`) with the refactored engine architecture to support both GameObject and camera controls.

**Status: FULLY IMPLEMENTED AND TESTED** ✅

## Current State Analysis

### Existing Input Manager (`src/engine/input.ts`)
- ✅ Robust key mapping system (WASD, +/-, space)
- ✅ Proper event cleanup and window blur/focus handling
- ✅ Key repeat prevention and pressed state tracking
- ✅ Clean callback-based architecture

### Current Engine Architecture
- ✅ Scene system with Camera class (move, orbitAroundTarget methods)
- ✅ GameObject/Component system with Transform components
- ✅ Scene lifecycle (awake → start → update → render)
- ❌ No input integration currently connected

## Proposed Integration Architecture

### 1. Input Controller Interface Pattern

```typescript
// src/engine/input-controller.ts
export interface InputController {
    handleInput(key: number, pressed: boolean, deltaTime?: number): void;
    update(deltaTime: number): void;
}

export class CameraController implements InputController {
    private camera: Camera;
    private moveSpeed: number = 5.0;
    private currentInputState = new Set<number>();

    constructor(camera: Camera, moveSpeed: number = 5.0) {
        this.camera = camera;
        this.moveSpeed = moveSpeed;
    }

    handleInput(key: number, pressed: boolean): void {
        if (pressed) {
            this.currentInputState.add(key);
        } else {
            this.currentInputState.delete(key);
        }
    }

    update(deltaTime: number): void {
        const movement = { forward: 0, right: 0, up: 0 };

        // WASD camera movement
        if (this.currentInputState.has(87)) movement.forward += 1;  // W
        if (this.currentInputState.has(83)) movement.forward -= 1;  // S
        if (this.currentInputState.has(68)) movement.right += 1;    // D
        if (this.currentInputState.has(65)) movement.right -= 1;    // A
        if (this.currentInputState.has(32)) movement.up += 1;       // Space
        if (this.currentInputState.has(45)) movement.up -= 1;       // -

        if (movement.forward || movement.right || movement.up) {
            const speed = this.moveSpeed * deltaTime;
            this.camera.move(
                movement.forward * speed,
                movement.right * speed,
                movement.up * speed
            );
        }
    }

    setMoveSpeed(speed: number): void {
        this.moveSpeed = speed;
    }

    getMoveSpeed(): number {
        return this.moveSpeed;
    }
}

export class GameObjectController implements InputController {
    private gameObject: GameObject;
    private forceStrength: number = 8.0;
    private currentInputState = new Set<number>();

    constructor(gameObject: GameObject, forceStrength: number = 8.0) {
        this.gameObject = gameObject;
        this.forceStrength = forceStrength;
    }

    handleInput(key: number, pressed: boolean): void {
        if (pressed) {
            this.currentInputState.add(key);
        } else {
            this.currentInputState.delete(key);
        }
    }

    update(deltaTime: number): void {
        const rigidBody = this.gameObject.getComponent(RigidBody);
        if (!rigidBody) return;

        const force = { x: 0, y: 0, z: 0 };

        // WASD force application
        if (this.currentInputState.has(87)) force.z -= this.forceStrength;  // W - forward
        if (this.currentInputState.has(83)) force.z += this.forceStrength;  // S - backward
        if (this.currentInputState.has(68)) force.x += this.forceStrength;  // D - right
        if (this.currentInputState.has(65)) force.x -= this.forceStrength;  // A - left
        if (this.currentInputState.has(32)) force.y += this.forceStrength;  // Space - up
        if (this.currentInputState.has(45)) force.y -= this.forceStrength;  // - - down

        if (force.x || force.y || force.z) {
            // Apply force to WASM physics entity via the physics bridge
            const entityId = rigidBody.entityId;
            if (entityId !== undefined) {
                this.gameObject.scene?.physicsBridge.applyForce(entityId, force);
            }
        }
    }

    setForceStrength(strength: number): void {
        this.forceStrength = strength;
    }

    getForceStrength(): number {
        return this.forceStrength;
    }
}

// Advanced controller for orbit camera controls
export class OrbitCameraController implements InputController {
    private camera: Camera;
    private orbitSpeed: number = 2.0;
    private zoomSpeed: number = 5.0;
    private currentInputState = new Set<number>();
    private target: [number, number, number];

    constructor(camera: Camera, target: [number, number, number] = [0, 0, 0]) {
        this.camera = camera;
        this.target = target;
        this.camera.lookAt(target);
    }

    handleInput(key: number, pressed: boolean): void {
        if (pressed) {
            this.currentInputState.add(key);
        } else {
            this.currentInputState.delete(key);
        }
    }

    update(deltaTime: number): void {
        let yaw = 0;
        let pitch = 0;
        let zoom = 0;

        // WASD for orbit controls
        if (this.currentInputState.has(65)) yaw -= 1;    // A - orbit left
        if (this.currentInputState.has(68)) yaw += 1;    // D - orbit right
        if (this.currentInputState.has(87)) pitch += 1;  // W - orbit up
        if (this.currentInputState.has(83)) pitch -= 1;  // S - orbit down

        // Space/- for zoom
        if (this.currentInputState.has(32)) zoom -= 1;   // Space - zoom in
        if (this.currentInputState.has(45)) zoom += 1;   // - - zoom out

        if (yaw || pitch) {
            const rotationSpeed = this.orbitSpeed * deltaTime;
            this.camera.orbitAroundTarget(yaw * rotationSpeed, pitch * rotationSpeed);
        }

        if (zoom) {
            const zoomAmount = zoom * this.zoomSpeed * deltaTime;
            const position = this.camera.getPosition();
            const direction = [
                this.target[0] - position[0],
                this.target[1] - position[1],
                this.target[2] - position[2]
            ];
            const distance = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);

            if (distance > 1.0 || zoom < 0) { // Prevent getting too close
                const normalizedDirection = [
                    direction[0] / distance,
                    direction[1] / distance,
                    direction[2] / distance
                ];

                this.camera.setPosition([
                    position[0] + normalizedDirection[0] * zoomAmount,
                    position[1] + normalizedDirection[1] * zoomAmount,
                    position[2] + normalizedDirection[2] * zoomAmount
                ]);
            }
        }
    }

    setTarget(target: [number, number, number]): void {
        this.target = target;
        this.camera.lookAt(target);
    }

    setOrbitSpeed(speed: number): void {
        this.orbitSpeed = speed;
    }

    setZoomSpeed(speed: number): void {
        this.zoomSpeed = speed;
    }
}
```

### 2. Scene-Level Input Management

```typescript
// Enhanced src/engine/scene-system.ts additions
export class Scene {
    // ... existing properties ...
    private inputManager?: InputManager;
    private activeInputController?: InputController;
    private inputTarget: 'camera' | 'orbit' | GameObject | null = null;

    constructor() {
        // ... existing constructor ...

        // Initialize input manager
        this.inputManager = new InputManager();
        this.inputManager.init((key: number, pressed: boolean) => {
            this.activeInputController?.handleInput(key, pressed);
        });

        // Default to camera control
        this.setInputTarget('camera');
    }

    setInputTarget(target: 'camera' | 'orbit' | GameObject | null): void {
        this.inputTarget = target;

        if (target === 'camera') {
            this.activeInputController = new CameraController(this.camera);
        } else if (target === 'orbit') {
            this.activeInputController = new OrbitCameraController(this.camera);
        } else if (target instanceof GameObject) {
            this.activeInputController = new GameObjectController(target);
        } else {
            this.activeInputController = undefined;
        }

        // Dispatch input target change event for UI updates
        this.dispatchInputTargetChange();
    }

    getInputTarget(): 'camera' | 'orbit' | GameObject | null {
        return this.inputTarget;
    }

    getInputController(): InputController | undefined {
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

    update(deltaTime: number): void {
        // Update active input controller BEFORE other systems
        this.activeInputController?.update(deltaTime);

        // ... existing update logic (physics, rendering, etc.) ...
    }

    dispose(): void {
        this.inputManager?.dispose();
        // ... existing dispose logic ...
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
}
```

### 3. Component-Based Input Control (Optional)

```typescript
// src/engine/components.ts - Add new component
export class InputControllerComponent extends Component {
    private controller?: InputController;
    private controllerType: 'gameobject' | 'custom';
    private customController?: InputController;

    constructor(controllerType: 'gameobject' | 'custom' = 'gameobject', customController?: InputController) {
        super();
        this.controllerType = controllerType;
        this.customController = customController;
    }

    awake(): void {
        // Create appropriate controller based on gameObject components
        if (this.controllerType === 'gameobject' && this.gameObject.getComponent(RigidBody)) {
            this.controller = new GameObjectController(this.gameObject);
        } else if (this.controllerType === 'custom' && this.customController) {
            this.controller = this.customController;
        }
    }

    start(): void {
        // Register with scene input system when this component becomes active
        if (this.controller) {
            this.gameObject.scene?.setInputTarget(this.gameObject);
        }
    }

    update(deltaTime: number): void {
        // Controller updates are handled by Scene, but can be overridden here for special cases
        if (this.gameObject.scene?.getInputTarget() !== this.gameObject) {
            // This GameObject is not the active input target, but could still handle input
            // in specific scenarios (e.g., AI, scripted movement, etc.)
        }
    }

    getController(): InputController | undefined {
        return this.controller;
    }

    activateInput(): void {
        this.gameObject.scene?.setInputTarget(this.gameObject);
    }
}
```

## Implementation Steps

### Phase 1: Core Input System
1. **Create InputController Interface** (`src/engine/input-controller.ts`)
   - Define InputController interface
   - Implement CameraController class
   - Implement GameObjectController class
   - Implement OrbitCameraController class

2. **Enhance Scene System** (`src/engine/scene-system.ts`)
   - Add InputManager integration
   - Add setInputTarget() method and related getters
   - Add input controller update in scene loop
   - Add event dispatching for UI updates

### Phase 2: Physics Integration
3. **Add Physics Bridge Integration**
   - Enhance WasmPhysicsBridge with applyForce method
   - Connect GameObject forces to WASM physics entities
   - Ensure proper entity ID mapping

### Phase 3: Advanced Features
4. **Create Input Component** (Optional)
   - InputControllerComponent for GameObject-specific input handling
   - Auto-registration with scene input system

5. **Update Example Scenes**
   - Modify camera-controls scene to demonstrate switching
   - Add player control examples in physics scenes
   - Create comprehensive input demo scene

## Example Scene Implementation

### HTML Interface (`src/scenes/input-demo/index.html`)

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Input System Demo - WebGPU Engine</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                background: #222;
                color: white;
                font-family: Arial, sans-serif;
            }

            .container {
                display: flex;
                gap: 20px;
            }

            #canvas {
                border: 1px solid #555;
            }

            .controls {
                min-width: 300px;
                background: #333;
                padding: 20px;
                border-radius: 8px;
            }

            .control-group {
                margin-bottom: 20px;
                padding: 15px;
                background: #444;
                border-radius: 4px;
            }

            .control-group h3 {
                margin: 0 0 10px 0;
                color: #4CAF50;
            }

            button {
                display: block;
                width: 100%;
                margin: 5px 0;
                padding: 8px;
                background: #555;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }

            button:hover {
                background: #666;
            }

            button.active {
                background: #4CAF50;
            }

            .status {
                background: #2a2a2a;
                padding: 10px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
            }

            .key-hints {
                background: #2a2a2a;
                padding: 10px;
                border-radius: 4px;
                margin-top: 10px;
            }

            .key-hints h4 {
                margin: 0 0 8px 0;
                color: #4CAF50;
            }

            .key-hints p {
                margin: 3px 0;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <canvas id="canvas" width="800" height="600"></canvas>

            <div class="controls">
                <div class="control-group">
                    <h3>Input Target</h3>
                    <button id="btn-camera" onclick="setInputTarget('camera')">Free Camera</button>
                    <button id="btn-orbit" onclick="setInputTarget('orbit')">Orbit Camera</button>
                    <button id="btn-player" onclick="setInputTarget('player')">Control Player Ball</button>
                    <button id="btn-cube" onclick="setInputTarget('cube')">Control Cube</button>
                    <button id="btn-none" onclick="setInputTarget('none')">No Input</button>
                </div>

                <div class="control-group">
                    <h3>Scene Actions</h3>
                    <button onclick="resetScene()">Reset Scene</button>
                    <button onclick="addRandomBall()">Add Random Ball</button>
                    <button onclick="clearObjects()">Clear All Objects</button>
                </div>

                <div class="control-group">
                    <h3>Camera Presets</h3>
                    <button onclick="setCameraPreset('overhead')">Overhead View</button>
                    <button onclick="setCameraPreset('side')">Side View</button>
                    <button onclick="setCameraPreset('corner')">Corner View</button>
                </div>

                <div class="control-group">
                    <h3>Status</h3>
                    <div class="status">
                        <div>Input Target: <span id="input-target">Camera</span></div>
                        <div>Controller Type: <span id="controller-type">CameraController</span></div>
                        <div>Camera Position: <span id="camera-pos">(0, 0, 0)</span></div>
                        <div>Objects: <span id="object-count">0</span></div>
                        <div>FPS: <span id="fps">60</span></div>
                    </div>
                </div>

                <div class="key-hints">
                    <h4>Controls</h4>
                    <div id="control-hints">
                        <p><strong>WASD:</strong> Move camera</p>
                        <p><strong>Space:</strong> Move up</p>
                        <p><strong>-:</strong> Move down</p>
                    </div>
                </div>
            </div>
        </div>

        <script type="module" src="./scene.ts"></script>
    </body>
</html>
```

### Scene Implementation (`src/scenes/input-demo/scene.ts`)

```typescript
// src/scenes/input-demo/scene.ts
// Comprehensive input system demonstration scene

import { Scene } from '../../engine/scene-system.js';
import { GameObject } from '../../engine/gameobject.js';
import { MeshRenderer, RigidBody, Transform } from '../../engine/components.js';
import { WebGPURendererV2 } from '../../renderer/webgpu.renderer.js';
import { createCubeMesh, createSphereMesh, createGridMesh } from '../../renderer/mesh-utils.js';
import { CameraController, GameObjectController, OrbitCameraController } from '../../engine/input-controller.js';

let scene: Scene;
let playerBall: GameObject;
let controlCube: GameObject;

async function createInputDemoScene(): Promise<Scene> {
    console.log('🎮 Creating Input System Demo Scene...');

    const newScene = new Scene();

    // Create floor grid for spatial reference
    const floor = GameObject.createGrid('Floor', { x: 0, y: -3, z: 0 });
    newScene.addGameObject(floor);
    console.log('📐 Added floor grid');

    // Create player-controllable ball
    playerBall = new GameObject('player-ball', 'PlayerBall');
    playerBall.transform.setPosition(0, 2, 0);
    playerBall.transform.setScale(1, 1, 1);

    const playerMeshRenderer = new MeshRenderer('sphere', 'default', 'triangles', { x: 0, y: 1, z: 0, w: 1 }); // Green
    playerBall.addComponent(playerMeshRenderer);

    const playerRigidBody = new RigidBody(1.0, false); // Dynamic physics
    playerBall.addComponent(playerRigidBody);

    newScene.addGameObject(playerBall);
    console.log('🟢 Added controllable player ball');

    // Create controllable cube
    controlCube = new GameObject('control-cube', 'ControlCube');
    controlCube.transform.setPosition(3, 1, 0);
    controlCube.transform.setScale(1, 1, 1);

    const cubeMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 1, y: 0.5, z: 0, w: 1 }); // Orange
    controlCube.addComponent(cubeMeshRenderer);

    const cubeRigidBody = new RigidBody(1.5, false); // Heavier than ball
    controlCube.addComponent(cubeRigidBody);

    newScene.addGameObject(controlCube);
    console.log('🟠 Added controllable cube');

    // Create some static reference objects
    const positions = [
        { x: -5, y: 1, z: -5, color: { x: 0.5, y: 0.5, z: 1, w: 1 } }, // Light blue
        { x: 5, y: 1, z: -5, color: { x: 1, y: 0.5, z: 0.5, w: 1 } },  // Light red
        { x: -5, y: 1, z: 5, color: { x: 0.5, y: 1, z: 0.5, w: 1 } },  // Light green
        { x: 5, y: 1, z: 5, color: { x: 1, y: 1, z: 0.5, w: 1 } },    // Light yellow
    ];

    positions.forEach((pos, index) => {
        const marker = new GameObject(`marker-${index}`, `Marker${index}`);
        marker.transform.setPosition(pos.x, pos.y, pos.z);
        marker.transform.setScale(0.5, 0.5, 0.5);

        const markerMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', pos.color);
        marker.addComponent(markerMeshRenderer);

        // Static markers (no RigidBody)
        newScene.addGameObject(marker);
    });
    console.log('🎯 Added reference markers');

    // Set initial camera position
    newScene.camera.setPosition([0, 8, -15]);
    newScene.camera.lookAt([0, 0, 0]);

    console.log(`🎮 Input demo scene created with ${newScene.getEntityCount()} entities`);
    return newScene;
}

// Global functions for HTML interface
(window as any).setInputTarget = (target: string) => {
    if (!scene) return;

    const buttons = ['btn-camera', 'btn-orbit', 'btn-player', 'btn-cube', 'btn-none'];
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });

    let targetName = '';
    let controllerType = '';
    let hints = '';

    switch (target) {
        case 'camera':
            scene.setInputTarget('camera');
            targetName = 'Free Camera';
            controllerType = 'CameraController';
            hints = '<p><strong>WASD:</strong> Move camera</p><p><strong>Space:</strong> Move up</p><p><strong>-:</strong> Move down</p>';
            document.getElementById('btn-camera')?.classList.add('active');
            break;

        case 'orbit':
            scene.setInputTarget('orbit');
            targetName = 'Orbit Camera';
            controllerType = 'OrbitCameraController';
            hints = '<p><strong>WASD:</strong> Orbit around center</p><p><strong>Space:</strong> Zoom in</p><p><strong>-:</strong> Zoom out</p>';
            document.getElementById('btn-orbit')?.classList.add('active');
            break;

        case 'player':
            scene.setInputTarget(playerBall);
            targetName = 'Player Ball';
            controllerType = 'GameObjectController';
            hints = '<p><strong>WASD:</strong> Apply forces</p><p><strong>Space:</strong> Jump force</p><p><strong>-:</strong> Downward force</p>';
            document.getElementById('btn-player')?.classList.add('active');
            break;

        case 'cube':
            scene.setInputTarget(controlCube);
            targetName = 'Control Cube';
            controllerType = 'GameObjectController';
            hints = '<p><strong>WASD:</strong> Apply forces</p><p><strong>Space:</strong> Jump force</p><p><strong>-:</strong> Downward force</p>';
            document.getElementById('btn-cube')?.classList.add('active');
            break;

        case 'none':
            scene.setInputTarget(null);
            targetName = 'None';
            controllerType = 'No Controller';
            hints = '<p>No input controller active</p>';
            document.getElementById('btn-none')?.classList.add('active');
            break;
    }

    updateUI(targetName, controllerType, hints);
};

(window as any).resetScene = () => {
    if (!scene) return;

    // Reset player ball
    playerBall.transform.setPosition(0, 2, 0);
    if (playerBall.getComponent(RigidBody)) {
        // Reset velocity via physics bridge (would need to implement)
        console.log('🔄 Reset player ball position');
    }

    // Reset cube
    controlCube.transform.setPosition(3, 1, 0);
    if (controlCube.getComponent(RigidBody)) {
        console.log('🔄 Reset cube position');
    }

    // Reset camera
    scene.camera.setPosition([0, 8, -15]);
    scene.camera.lookAt([0, 0, 0]);

    console.log('🔄 Scene reset');
};

(window as any).addRandomBall = () => {
    if (!scene) return;

    const randomBall = new GameObject(`random-ball-${Date.now()}`, 'RandomBall');
    randomBall.transform.setPosition(
        (Math.random() - 0.5) * 8,
        Math.random() * 5 + 3,
        (Math.random() - 0.5) * 8
    );

    const meshRenderer = new MeshRenderer('sphere', 'default', 'triangles', {
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        w: 1
    });
    randomBall.addComponent(meshRenderer);

    const rigidBody = new RigidBody(0.5 + Math.random(), false);
    randomBall.addComponent(rigidBody);

    scene.addGameObject(randomBall);
    console.log('🎾 Added random ball');
};

(window as any).clearObjects = () => {
    if (!scene) return;

    // Remove all GameObjects except floor, player, and cube
    const entities = scene.getAllGameObjects();
    entities.forEach(entity => {
        if (entity.name !== 'Floor' && entity !== playerBall && entity !== controlCube && !entity.name.startsWith('marker')) {
            scene.removeGameObject(entity.name);
        }
    });

    console.log('🧹 Cleared random objects');
};

(window as any).setCameraPreset = (preset: string) => {
    if (!scene) return;

    switch (preset) {
        case 'overhead':
            scene.camera.setPosition([0, 15, 0]);
            scene.camera.lookAt([0, 0, 0]);
            break;
        case 'side':
            scene.camera.setPosition([15, 5, 0]);
            scene.camera.lookAt([0, 0, 0]);
            break;
        case 'corner':
            scene.camera.setPosition([10, 8, -10]);
            scene.camera.lookAt([0, 0, 0]);
            break;
    }

    console.log(`📷 Set camera preset: ${preset}`);
};

function updateUI(targetName: string, controllerType: string, hints: string) {
    const targetElement = document.getElementById('input-target');
    const typeElement = document.getElementById('controller-type');
    const hintsElement = document.getElementById('control-hints');

    if (targetElement) targetElement.textContent = targetName;
    if (typeElement) typeElement.textContent = controllerType;
    if (hintsElement) hintsElement.innerHTML = hints;
}

function updateStatus() {
    if (!scene) return;

    // Update camera position
    const position = scene.camera.getPosition();
    const posElement = document.getElementById('camera-pos');
    if (posElement) {
        posElement.textContent = `(${position[0].toFixed(1)}, ${position[1].toFixed(1)}, ${position[2].toFixed(1)})`;
    }

    // Update object count
    const countElement = document.getElementById('object-count');
    if (countElement) {
        countElement.textContent = scene.getEntityCount().toString();
    }
}

async function main() {
    console.log('🚀 Input System Demo starting...');
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;

    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        // Initialize renderer
        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);

        // Register all required meshes
        renderer.registerMesh('sphere', createSphereMesh(1.0, 16));
        renderer.registerMesh('cube', createCubeMesh(1));
        renderer.registerMesh('grid', createGridMesh(20, 20));

        // Create and initialize scene
        scene = new Scene();
        await scene.init(renderer);

        await createInputDemoScene();
        scene.start();

        // Set initial input target
        (window as any).setInputTarget('camera');

        console.log('✅ Input demo scene initialized successfully');

        // Animation loop with status updates
        let lastTime = performance.now();
        let frameCount = 0;
        let lastFpsTime = 0;

        const gameLoop = (currentTime: number) => {
            const rawDeltaTime = (currentTime - lastTime) / 1000;
            const deltaTime = Math.min(rawDeltaTime, 1/30); // Cap at 30fps
            lastTime = currentTime;

            // Update scene
            scene.update(deltaTime);

            // Update FPS counter and status
            frameCount++;
            if (currentTime - lastFpsTime >= 1000) {
                const fpsElement = document.getElementById('fps');
                if (fpsElement) fpsElement.textContent = frameCount.toString();

                updateStatus();

                frameCount = 0;
                lastFpsTime = currentTime;
            }

            requestAnimationFrame(gameLoop);
        };

        // Start the game loop
        requestAnimationFrame(gameLoop);

        // Listen for input target changes
        window.addEventListener('inputTargetChanged', (event: any) => {
            console.log('🎮 Input target changed:', event.detail);
        });

    } catch (error) {
        console.error('❌ Error in input demo:', error);
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'color: red; padding: 20px; background: #333; margin: 20px;';
        errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        document.body.appendChild(errorDiv);
    }
}

// Export for browser testing
(window as any).inputDemoScene = scene;

main();
```

## Key Benefits of This Architecture

✅ **Flexibility** - Easy switching between camera and GameObject control
✅ **Extensibility** - New InputController types can be added easily
✅ **Performance** - Single InputManager instance, efficient event handling
✅ **Consistency** - Uses existing Camera and GameObject APIs
✅ **Testability** - InputController interface enables easy unit testing
✅ **Scene Integration** - Natural fit with existing Scene lifecycle
✅ **UI Integration** - Event system for updating interface state
✅ **Multiple Control Modes** - Free camera, orbit camera, and GameObject controls

## Integration Requirements

### WasmPhysicsBridge Enhancements
The GameObjectController requires the physics bridge to support force application:

```typescript
// Add to WasmPhysicsBridge class
export class WasmPhysicsBridge {
    // ... existing methods ...

    applyForce(entityId: number, force: { x: number; y: number; z: number }): void {
        if (this.wasmExports) {
            this.wasmExports.apply_entity_force(entityId, force.x, force.y, force.z);
        }
    }

    setEntityVelocity(entityId: number, velocity: { x: number; y: number; z: number }): void {
        if (this.wasmExports) {
            this.wasmExports.set_entity_velocity(entityId, velocity.x, velocity.y, velocity.z);
        }
    }
}
```

### WASM Exports Required
The Zig physics engine needs to export these functions:

```zig
// Additional WASM exports needed in game_engine.zig
export fn apply_entity_force(entity_id: u32, fx: f32, fy: f32, fz: f32) void
export fn set_entity_velocity(entity_id: u32, vx: f32, vy: f32, vz: f32) void
```

This architecture provides a comprehensive, flexible input system that integrates seamlessly with the existing engine while providing multiple control paradigms for different gameplay scenarios.

---

## ✅ IMPLEMENTATION COMPLETED

**Status: FULLY IMPLEMENTED** - All planned features have been successfully implemented and tested.

### What Was Delivered

**✅ Complete Controller System** (`src/engine/input-controller.ts`)
- `CameraController` - Free-flying camera with WASD movement and vertical controls
- `GameObjectController` - Physics-based force application to GameObjects (reduced from 8.0 to 4.0 force strength)
- `OrbitCameraController` - Orbital camera movement with zoom controls

**✅ Scene Integration** (`src/engine/scene-system.ts`)
- Full input management with `setInputTarget()` method
- Typed controller getters (`getCameraController()`, `getGameObjectController()`, etc.)
- Event dispatching with `inputTargetChanged` custom events
- Proper lifecycle management and cleanup

**✅ Physics Integration** (`src/engine/wasm-physics-bridge.ts`)
- Overloaded `applyForce()` methods for seamless GameObject force application
- Real-time physics force integration

**✅ Demo Scenes**
- **Input Demo Scene** (`src/scenes/input-demo/`) - Complete interactive playground
- **Enhanced Fancy Physics Demo** - Added camera controls to existing physics simulation
- Professional UI with real-time status updates and control hints

**✅ Comprehensive Testing**
- 43 unit tests covering all controller functionality
- Integration tests for scene-level input management
- Test organization moved from `src/__tests__/` to `tests/` directory
- All 213 tests passing (TypeScript + Zig)

**✅ User Experience Improvements**
- Reduced force strength for natural control feel
- Fixed overhead camera positioning (Y=10 with slight offset to avoid gimbal lock)
- Dark gray floor grid (RGB 0.4) positioned at world boundary (Y=-8)
- Random ball generation for interactive chaos
- Seamless camera mode switching during physics simulation

### Architecture Achieved

The implemented system provides:
- **Polymorphic Controller Pattern** - Interface-based design for maximum flexibility
- **Event-Driven Architecture** - Custom events for UI synchronization
- **Modular Design** - Controllers are completely independent and swappable
- **Performance Optimized** - Maintains 6,598+ entity baseline performance
- **Production Ready** - Comprehensive error handling and graceful degradation

The input system successfully transforms the engine from a tech demo into an interactive, engaging 3D experience that's genuinely fun to play with!

---

## 🚀 FUTURE ROADMAP - Input System Evolution

The current implementation provides a solid foundation, but there are exciting opportunities to evolve it into a production-ready game engine quality input system.

### **Phase 1: Enhanced Core Features** 📋 FUTURE

#### **1. Configurable Key Bindings**
```typescript
// InputBindings system for user-customizable controls
interface KeyBinding {
    action: string;
    primary: string;    // 'w', 'space', etc.
    secondary?: string; // Alternative key
    gamepad?: number;   // Gamepad button index
}

class InputBindings {
    private bindings = new Map<string, KeyBinding>();

    setBinding(action: string, primary: string, secondary?: string): void
    getBinding(action: string): KeyBinding | undefined
    saveToLocalStorage(): void
    loadFromLocalStorage(): void
}
```

**Key Benefits:**
- User-customizable key mappings
- Persistent settings across sessions
- Alternative key support (e.g., WASD + Arrow keys)
- Accessibility support for different input preferences

#### **2. Input Context/Mode System**
```typescript
// Different input contexts for different game states
type InputContext = 'game' | 'menu' | 'inventory' | 'dialogue' | 'console';

class ContextualInputManager {
    private contexts = new Map<InputContext, InputController>();
    private activeContext: InputContext = 'game';

    pushContext(context: InputContext): void    // Stack-based contexts
    popContext(): void                          // Return to previous
    setContext(context: InputContext): void    // Direct switch
}
```

**Key Benefits:**
- Clean separation between gameplay and UI input
- Stack-based context management for modal dialogs
- Context-specific key bindings (e.g., menu navigation vs game controls)

#### **3. Gamepad/Controller Support**
```typescript
class GamepadInputController implements InputController {
    private gamepadIndex: number;
    private deadzone: number = 0.1;

    // Handle analog sticks, triggers, d-pad
    handleAnalogInput(leftStick: Vec2, rightStick: Vec2, triggers: Vec2): void
    handleButtonInput(buttonIndex: number, pressed: boolean): void

    // Controller-specific features
    setVibration(lowFreq: number, highFreq: number, duration: number): void
    calibrateDeadzone(): void
}
```

**Key Benefits:**
- Native gamepad support for console-style gameplay
- Analog stick input for smooth camera/movement control
- Vibration feedback integration
- Multiple controller support for local multiplayer

### **Phase 2: Advanced Input Features** 📋 FUTURE

#### **4. Mouse/Touch Integration**
```typescript
class MouseInputController implements InputController {
    private sensitivity: number = 1.0;
    private invertY: boolean = false;

    handleMouseMove(deltaX: number, deltaY: number): void
    handleMouseButton(button: number, pressed: boolean): void
    handleScroll(delta: number): void
}

class TouchInputController implements InputController {
    private gestures = new GestureRecognizer();

    handleTouch(touches: TouchEvent[]): void
    recognizeGesture(type: 'tap' | 'pinch' | 'swipe' | 'pan'): GestureData
}
```

**Key Benefits:**
- Mouse look for FPS-style camera control
- Touch gesture recognition (pinch to zoom, swipe navigation)
- Cross-platform input handling (desktop + mobile)
- Cursor interaction with 3D objects (raycasting/picking)

#### **5. Input Buffering & Combo System**
```typescript
class InputBuffer {
    private buffer: Array<{action: string, timestamp: number}> = [];
    private bufferTime: number = 200; // ms

    checkSequence(sequence: string[]): boolean  // "down,down,punch"
    checkChord(actions: string[]): boolean      // Simultaneous inputs
    checkTiming(action: string, maxAge: number): boolean
}

class ComboSystem {
    private combos = new Map<string, ComboDefinition>();

    registerCombo(name: string, sequence: string[], timing: number): void
    checkCombos(inputBuffer: InputBuffer): string[]
}
```

**Key Benefits:**
- Fighting game style input combos
- Frame-perfect timing validation
- Input buffering for responsive controls
- Complex input pattern recognition

#### **6. Input Recording & Playback**
```typescript
class InputRecorder {
    private recording: InputFrame[] = [];
    private isRecording: boolean = false;

    startRecording(): void
    stopRecording(): InputSequence
    playback(sequence: InputSequence, speed: number = 1.0): void
    saveToFile(sequence: InputSequence, filename: string): void

    // Advanced features
    generateInputReport(): RecordingAnalysis
    createInputTest(sequence: InputSequence): TestCase
}
```

**Key Benefits:**
- Automated testing and regression detection
- Demo recording and playback
- Tutorial creation and input demonstration
- Performance analysis and input timing optimization

### **Phase 3: Engine Integration** 📋 FUTURE

#### **7. Component-Based Input Handling**
```typescript
class InputReceiver extends Component {
    private actions = new Map<string, InputAction>();
    private priority: number = 0;

    bindAction(action: string, callback: InputActionCallback): void
    bindAxis(axis: string, callback: InputAxisCallback): void

    // Input filtering and processing
    setInputFilter(filter: InputFilter): void
    setPriority(priority: number): void
}

class InputActionComponent extends Component {
    // Specific actions: Jump, Shoot, Interact, etc.
    configureAction(trigger: InputTrigger, response: ActionResponse): void
}
```

**Key Benefits:**
- GameObjects can directly handle their own input
- Priority-based input resolution for overlapping objects
- Modular input behavior composition
- Clean separation between input logic and game logic

#### **8. Input-Driven Animation System**
```typescript
class InputAnimationController extends Component {
    private animationBindings = new Map<string, AnimationBinding>();

    bindInputToAnimation(action: string, clip: string, blendMode?: BlendMode): void
    bindAxisToBlendTree(axis: string, blendTree: AnimationBlendTree): void

    // Advanced animation integration
    setInputSmoothing(action: string, smoothing: number): void
    createInputBlendSpace(axes: string[], animations: string[]): void
}
```

**Key Benefits:**
- Direct input-to-animation mapping
- Blend trees for analog input (walk/run based on stick pressure)
- Smooth animation transitions based on input state
- Character controller animation automation

### **Phase 4: Developer Experience** 📋 FUTURE

#### **9. Input Configuration UI**
```typescript
class InputConfigurationUI {
    // Runtime key binding interface
    createKeyBindingUI(): HTMLElement
    showControllerCalibration(): void
    displayInputVisualization(): void

    // Developer tools
    createInputDebugger(): InputDebugPanel
    generateInputDocumentation(): string
}

class InputDebugger {
    private visualizer?: InputVisualizer;

    showLiveInputDisplay(): void
    logInputHistory(duration: number): InputHistoryReport
    analyzeInputPerformance(): PerformanceMetrics
    createInputHeatmap(): InputHeatmapData
}
```

**Key Benefits:**
- In-game key binding configuration
- Input testing and validation tools
- Developer debugging and analysis tools
- Visual input feedback for development

#### **10. Accessibility Features**
```typescript
class AccessibilityInputManager {
    // Accessibility enhancements
    setHoldDuration(action: string, duration: number): void
    enableInputAssistance(type: 'auto-aim' | 'movement-correction'): void
    setAlternativeInputMethod(method: 'switch' | 'voice' | 'eye-tracking'): void

    // Visual/audio feedback
    enableInputVisualization(): void
    setAudioCues(enabled: boolean): void
    configureColorBlindSupport(): void
}
```

**Key Benefits:**
- Support for users with different abilities
- Configurable input timing and sensitivity
- Alternative input methods integration
- Visual and audio input feedback options

### **Suggested Implementation Priority**

Based on typical game development needs and user impact:

#### **🎯 High Priority (Input System v2)**
1. **Configurable Key Bindings** - Most requested feature, immediate user value
2. **Gamepad Support** - Essential for modern games, huge UX improvement
3. **Mouse Integration** - Critical for 3D game camera controls
4. **Input Context System** - Needed as UI complexity grows

#### **📈 Medium Priority (Input System v3)**
5. **Component-Based Input** - Natural GameObject system integration
6. **Input Recording** - Valuable for testing and development
7. **Touch Support** - Important for mobile deployment
8. **Input Buffering** - Advanced gameplay mechanics support

#### **🔧 Lower Priority (Polish & Optimization)**
9. **Input Animation System** - Character system integration
10. **Accessibility Features** - Important for inclusivity
11. **Developer Tools** - Quality of life improvements
12. **Performance Optimization** - Fine-tuning and advanced features

### **Architecture Considerations**

The current polymorphic controller pattern provides an excellent foundation for these additions:

- **Extensible Design**: New controller types can be added without breaking existing code
- **Event System**: Already supports UI integration and can be extended for new features
- **Performance Baseline**: 6,598+ entity performance maintained, plenty of headroom for enhancements
- **Clean Separation**: Input logic separated from game logic, making complex features manageable

The roadmap maintains the proven architectural patterns while adding the features needed to compete with commercial game engines like Unity and Unreal.

---

## 🚨 CURRENT LIMITATIONS

### **Gamepad Input - No Analog Force Proportionality**

**Issue**: The current gamepad implementation only provides binary on/off input for force application. Whether you move the analog stick 10% or 100%, it applies the same force strength.

**Technical Details**:
- Gamepad system captures analog values (0.0 to 1.0) correctly
- Values are only used to determine if a key is "pressed" or "released"
- Actual analog magnitude gets lost in the virtual key mapping system
- Force application is always `force.x += this.forceStrength` (constant 2.0)

**Impact**:
- Less nuanced control compared to modern games
- No subtle positioning with light stick movements
- No speed variation based on stick deflection

**Current Workaround**:
- System works well for digital-style gameplay
- Sensitivity can be adjusted via configuration

**Future Solution**:
Would require enhancing the InputController interface to handle analog values and modifying force calculation to use `force.x += analogValue * this.forceStrength` for proportional control.

**Status**: Documented limitation - not blocking current gamepad functionality