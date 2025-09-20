// Gamepad API Demo Scene
import { Scene } from '../../engine/scene-system.js';
import { WebGPURendererV2 } from '../../renderer/webgpu.renderer.js';
import { GameObject } from '../../engine/gameobject.js';
import { CollisionShape, MeshRenderer, RigidBody } from '../../engine/components.js';
import { createGridMesh, createCubeMesh, createSphereMesh } from '../../renderer/mesh-utils.js';

interface GamepadState {
    id: string;
    index: number;
    connected: boolean;
    lastSeen: number;
    buttonStates: boolean[];
    axisValues: number[];
}

class GamepadManager {
    private gamepads: Map<number, GamepadState> = new Map();
    private inputCount = 0;
    private lastInput = 'None';
    private logEntries: string[] = [];
    private maxLogEntries = 100;
    private scene: Scene | null = null;
    private currentLeftStick = { x: 0, y: 0 }; // Track current stick position

    constructor(scene?: Scene) {
        this.scene = scene || null;
        // Gamepad connection events
        window.addEventListener('gamepadconnected', (e) => {
            this.onGamepadConnected(e as GamepadEvent);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            this.onGamepadDisconnected(e as GamepadEvent);
        });

        // Start polling for gamepad input
        this.startPolling();
    }

    private onGamepadConnected(event: GamepadEvent) {
        const gamepad = event.gamepad;
        console.log('Gamepad connected:', gamepad.id);

        this.gamepads.set(gamepad.index, {
            id: gamepad.id,
            index: gamepad.index,
            connected: true,
            lastSeen: Date.now(),
            buttonStates: new Array(gamepad.buttons.length).fill(false),
            axisValues: new Array(gamepad.axes.length).fill(0)
        });

        this.addLogEntry(`Connected: ${gamepad.id} (Index: ${gamepad.index})`, 'connection');
        this.updateUI();
    }

    private onGamepadDisconnected(event: GamepadEvent) {
        const gamepad = event.gamepad;
        console.log('Gamepad disconnected:', gamepad.id);

        this.gamepads.delete(gamepad.index);
        this.addLogEntry(`Disconnected: ${gamepad.id}`, 'connection');
        this.updateUI();
    }

    private startPolling() {
        const poll = () => {
            this.pollGamepads();
            requestAnimationFrame(poll);
        };
        poll();
    }

    private pollGamepads() {
        const gamepads = navigator.getGamepads();

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad && this.gamepads.has(i)) {
                this.processGamepadInput(gamepad);
            }
        }
    }

    private processGamepadInput(gamepad: Gamepad) {
        const state = this.gamepads.get(gamepad.index);
        if (!state) return;

        // Check button states
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const button = gamepad.buttons[i];
            if (!button) continue;

            const wasPressed = state.buttonStates[i];
            const isPressed = button.pressed;

            if (isPressed !== wasPressed) {
                state.buttonStates[i] = isPressed;

                if (isPressed) {
                    this.onButtonPressed(gamepad.index, i, button.value);
                } else {
                    this.onButtonReleased(gamepad.index, i);
                }
            }
        }

        // Check axis values (with deadzone)
        const deadzone = 0.1;
        for (let i = 0; i < gamepad.axes.length; i++) {
            const axis = gamepad.axes[i];
            if (axis === undefined) continue;

            const lastValue = state.axisValues[i] || 0;
            const currentValue = Math.abs(axis) < deadzone ? 0 : axis;

            if (Math.abs(currentValue - lastValue) > 0.01) {
                state.axisValues[i] = currentValue;
                this.onAxisChanged(gamepad.index, i, currentValue);
            }
        }

        state.lastSeen = Date.now();
    }

    private onButtonPressed(gamepadIndex: number, buttonIndex: number, value: number) {
        const buttonName = this.getButtonName(buttonIndex);
        const message = `Gamepad ${gamepadIndex}: ${buttonName} pressed (${value.toFixed(2)})`;

        this.addLogEntry(message, 'button');
        this.lastInput = `${buttonName} pressed`;
        this.inputCount++;

        // Handle bounce buttons (4 = LB/L1, 5 = RB/R1)
        if ((buttonIndex === 4 || buttonIndex === 5) && this.scene && controlCube) {
            this.applyBounceImpulse();
        }

        console.log(message);
        this.updateUI();
    }

    private applyBounceImpulse() {
        if (!this.scene || !controlCube) return;

        const bounceForce = 6.0; // Strong upward impulse
        const rigidBody = controlCube.getComponent(RigidBody);
        const entityId = rigidBody?.getWasmEntityId();

        if (entityId === undefined) return;

        // Apply strong upward force for bounce effect
        this.scene.physicsBridge.applyForce(entityId, { x: 0, y: bounceForce, z: 0 });
        console.log('🦘 Bounce impulse applied!');
    }

    private onButtonReleased(gamepadIndex: number, buttonIndex: number) {
        const buttonName = this.getButtonName(buttonIndex);
        const message = `Gamepad ${gamepadIndex}: ${buttonName} released`;

        this.addLogEntry(message, 'button');
        this.lastInput = `${buttonName} released`;
        this.inputCount++;

        console.log(message);
        this.updateUI();
    }

    private onAxisChanged(gamepadIndex: number, axisIndex: number, value: number) {
        const axisName = this.getAxisName(axisIndex);
        const message = `Gamepad ${gamepadIndex}: ${axisName} = ${value.toFixed(3)}`;

        // Only log significant axis changes to avoid spam
        if (Math.abs(value) > 0.5 || value === 0) {
            this.addLogEntry(message, 'axis');
            this.lastInput = `${axisName} moved`;
            this.inputCount++;
        }

        // Update current stick position for smooth movement
        if (axisIndex === 0) {
            this.currentLeftStick.x = value;
        } else if (axisIndex === 1) {
            this.currentLeftStick.y = value;
        }

        this.updateUI();
    }

    // Call this every frame for smooth movement
    public updateCubeMovement() {
        if (!this.scene || !controlCube) return;

        const moveForce = 1.5; // Reduced force (half of 3.0)
        const rigidBody = controlCube.getComponent(RigidBody);
        const entityId = rigidBody?.getWasmEntityId();

        if (entityId === undefined) return;

        // Apply forces based on current stick position
        if (Math.abs(this.currentLeftStick.x) > 0.1 || Math.abs(this.currentLeftStick.y) > 0.1) {
            this.scene.physicsBridge.applyForce(entityId, {
                x: this.currentLeftStick.x * moveForce,
                y: 0,
                z: -this.currentLeftStick.y * moveForce
            });
        }
    }

    private getButtonName(index: number): string {
        const buttonNames = [
            'A/Cross', 'B/Circle', 'X/Square', 'Y/Triangle',
            'LB/L1', 'RB/R1', 'LT/L2', 'RT/R2',
            'Select/Share', 'Start/Options', 'LS', 'RS',
            'D-Up', 'D-Down', 'D-Left', 'D-Right',
            'Home/PS', 'Capture/Touchpad'
        ];
        return buttonNames[index] || `Button ${index}`;
    }

    private getAxisName(index: number): string {
        const axisNames = [
            'Left Stick X', 'Left Stick Y',
            'Right Stick X', 'Right Stick Y'
        ];
        return axisNames[index] || `Axis ${index}`;
    }

    private addLogEntry(message: string, _type: string) {
        const timestamp = new Date().toLocaleTimeString();
        this.logEntries.unshift(`[${timestamp}] ${message}`);

        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries = this.logEntries.slice(0, this.maxLogEntries);
        }

        this.updateLogDisplay();
    }

    private updateLogDisplay() {
        const logOutput = document.getElementById('log-output');
        if (logOutput) {
            logOutput.innerHTML = this.logEntries
                .map(entry => `<div class="log-entry">${entry}</div>`)
                .join('');
            logOutput.scrollTop = 0;
        }
    }

    private updateUI() {
        this.updateGamepadList();
        this.updateButtonDisplay();
        this.updateAxisDisplay();
        this.updateStatus();
    }

    private updateGamepadList() {
        const gamepadList = document.getElementById('gamepad-list');
        if (!gamepadList) return;

        if (this.gamepads.size === 0) {
            gamepadList.innerHTML = '<div>No gamepads detected. Connect a controller and press any button.</div>';
            return;
        }

        const html = Array.from(this.gamepads.values())
            .map(state => `
                <div class="gamepad-item connected">
                    <strong>Index ${state.index}:</strong> ${state.id}
                    <br>Buttons: ${state.buttonStates.length} | Axes: ${state.axisValues.length}
                </div>
            `)
            .join('');

        gamepadList.innerHTML = html;
    }

    private updateButtonDisplay() {
        const buttonGroup = document.getElementById('button-group');
        const buttonGrid = document.getElementById('button-grid');

        if (!buttonGroup || !buttonGrid) return;

        const activeGamepad = this.getActiveGamepad();
        if (!activeGamepad) {
            buttonGroup.style.display = 'none';
            return;
        }

        buttonGroup.style.display = 'block';

        const gamepad = navigator.getGamepads()[activeGamepad.index];
        if (!gamepad) return;

        const html = gamepad.buttons
            .map((button, index) => {
                const buttonName = this.getButtonName(index);
                const pressedClass = button.pressed ? 'pressed' : '';
                return `
                    <div class="button-indicator ${pressedClass}" title="${buttonName}">
                        ${index}
                    </div>
                `;
            })
            .join('');

        buttonGrid.innerHTML = html;
    }

    private updateAxisDisplay() {
        const axisGroup = document.getElementById('axis-group');
        const axisDisplay = document.getElementById('axis-display');

        if (!axisGroup || !axisDisplay) return;

        const activeGamepad = this.getActiveGamepad();
        if (!activeGamepad) {
            axisGroup.style.display = 'none';
            return;
        }

        axisGroup.style.display = 'block';

        const gamepad = navigator.getGamepads()[activeGamepad.index];
        if (!gamepad) return;

        const html = gamepad.axes
            .map((axis, index) => {
                const axisName = this.getAxisName(index);
                const value = axis.toFixed(3);
                const percent = ((axis + 1) / 2) * 100; // Convert -1..1 to 0..100%

                return `
                    <div class="axis-item">
                        <span>${axisName}: ${value}</span>
                        <div class="axis-bar">
                            <div class="axis-indicator" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            })
            .join('');

        axisDisplay.innerHTML = html;
    }

    private updateStatus() {
        const gamepadCount = document.getElementById('gamepad-count');
        const activeGamepad = document.getElementById('active-gamepad');
        const lastInput = document.getElementById('last-input');
        const inputCount = document.getElementById('input-count');

        if (gamepadCount) gamepadCount.textContent = this.gamepads.size.toString();
        if (activeGamepad) {
            const active = this.getActiveGamepad();
            activeGamepad.textContent = active ? `Index ${active.index}` : 'None';
        }
        if (lastInput) lastInput.textContent = this.lastInput;
        if (inputCount) inputCount.textContent = this.inputCount.toString();
    }

    private getActiveGamepad(): GamepadState | null {
        // Return the first connected gamepad, or null if none
        return Array.from(this.gamepads.values())[0] || null;
    }

    public refreshGamepads() {
        console.log('Refreshing gamepad list...');
        const gamepads = navigator.getGamepads();

        // Clear existing gamepads
        this.gamepads.clear();

        // Re-detect connected gamepads
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                this.gamepads.set(gamepad.index, {
                    id: gamepad.id,
                    index: gamepad.index,
                    connected: true,
                    lastSeen: Date.now(),
                    buttonStates: new Array(gamepad.buttons.length).fill(false),
                    axisValues: new Array(gamepad.axes.length).fill(0)
                });
            }
        }

        this.addLogEntry(`Refreshed: Found ${this.gamepads.size} gamepad(s)`, 'system');
        this.updateUI();
    }

    public clearLog() {
        this.logEntries = [];
        this.updateLogDisplay();
        console.log('Log cleared');
    }
}

// Global reference to the controllable cube
let controlCube: GameObject;

// Create a pyramid stack of balls that can be knocked down
function createBallStack(scene: Scene, x: number, y: number) {
    console.log('🎾 Creating ball stack...');

    const ballRadius = 1.0;
    const colors = [
        { x: 1, y: 0, z: 0, w: 1 }, // Red
        { x: 0, y: 0, z: 1, w: 1 }, // Blue
        { x: 1, y: 1, z: 0, w: 1 }, // Yellow
        { x: 1, y: 0.5, z: 0, w: 1 }, // Orange
        { x: 0.5, y: 0, z: 1, w: 1 }, // Purple
        { x: 0, y: 1, z: 1, w: 1 }, // Cyan
    ];

    let ballCounter = 0;

    // Create a pyramid stack: 3 levels
    // Bottom row: 3 balls
    for (let i = 0; i < 3; i++) {
        const ball = new GameObject(`ball-bottom-${i}`, `BallBottom${i}`);
        ball.transform.setPosition(x + (i - 1) * ballRadius * 2, y + ballRadius, 0);

        const meshRenderer = new MeshRenderer('sphere', 'default', 'triangles', colors[ballCounter % colors.length]);
        ball.addComponent(meshRenderer);

        const rigidBody = new RigidBody(
            0.5, // Light mass for bouncy physics
            true, // Use gravity
            CollisionShape.SPHERE,
            { x: ballRadius, y: ballRadius, z: ballRadius }
        );
        ball.addComponent(rigidBody);

        scene.addGameObject(ball);
        ballCounter++;
    }

    // Middle row: 2 balls
    for (let i = 0; i < 2; i++) {
        const ball = new GameObject(`ball-middle-${i}`, `BallMiddle${i}`);
        ball.transform.setPosition(x + (i - 0.5) * ballRadius * 2, y + ballRadius * 3, 0);

        const meshRenderer = new MeshRenderer('sphere', 'default', 'triangles', colors[ballCounter % colors.length]);
        ball.addComponent(meshRenderer);

        const rigidBody = new RigidBody(
            0.5,
            true,
            CollisionShape.SPHERE,
            { x: ballRadius, y: ballRadius, z: ballRadius }
        );
        ball.addComponent(rigidBody);

        scene.addGameObject(ball);
        ballCounter++;
    }

    // Top ball: 1 ball
    const topBall = new GameObject('ball-top', 'BallTop');
    topBall.transform.setPosition(x, y + ballRadius * 5, 0);

    const topMeshRenderer = new MeshRenderer('sphere', 'default', 'triangles', colors[ballCounter % colors.length]);
    topBall.addComponent(topMeshRenderer);

    const topRigidBody = new RigidBody(
        0.5,
        true,
        CollisionShape.SPHERE,
        { x: ballRadius, y: ballRadius, z: ballRadius }
    );
    topBall.addComponent(topRigidBody);

    scene.addGameObject(topBall);

    console.log(`🎾 Created ball stack with ${ballCounter + 1} balls`);
}

// Create a simple scene with a test object
export async function createGamepadScene(scene: Scene): Promise<void> {
    // Create ground plane (like basic-shapes example)
    const ground = new GameObject('ground', 'Ground');
    ground.transform.setPosition(0, -8, 0);
    ground.transform.setScale(1, 1, 1);

    const groundMesh = new MeshRenderer('grid', 'default', 'lines', { x: 0.5, y: 0.5, z: 0.5, w: 1 }); // Gray
    ground.addComponent(groundMesh);
    scene.addGameObject(ground);

    // Create controllable cube (exactly like basic-shapes cube scene)
    controlCube = new GameObject('gamepad-cube', 'GamepadCube');
    controlCube.transform.setPosition(0, 0, 0); // Position in front of camera
    controlCube.transform.setScale(1, 1, 1); // Make it visible

    // Add MeshRenderer with cube mesh and green color (like basic-shapes pattern)
    const meshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 1, z: 0, w: 1 }); // Green
    controlCube.addComponent(meshRenderer);

    // Add RigidBody for physics controls (needed for gamepad movement)
    const cubeRigidBody = new RigidBody(
        1.0,
        true,
        CollisionShape.BOX,
        { x: 0.5, y: 0.5, z: 0.5 }
    );
    controlCube.addComponent(cubeRigidBody);

    // Add to scene (this should push to WASM)
    scene.addGameObject(controlCube);
    console.log('🎮 Added gamepad cube GameObject to WASM');

    // Create ball stack 2 units to the left
    createBallStack(scene, -2, -7); // x=-2 (left), y=-7 (on ground)

    // Position camera to see the cube with proper aspect ratio
    scene.camera.setPosition([0, 0, -19]); // Straight on view
    scene.camera.lookAt([0, -4, 0]);       // Look at cube center

    console.log(`✅ Gamepad scene created with ${scene.getEntityCount()} GameObjects`);
}

// Main scene initialization
async function main() {
    try {
        // Check for Gamepad API support
        if (!('getGamepads' in navigator)) {
            throw new Error('Gamepad API not supported in this browser');
        }

        // Initialize the 3D scene
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) {
            throw new Error('Canvas element not found');
        }

        // Initialize renderer first
        const renderer = new WebGPURendererV2();
        await renderer.init(canvas);

        // Register required meshes
        renderer.registerMesh('grid', createGridMesh(16, 16));
        renderer.registerMesh('cube', createCubeMesh());
        renderer.registerMesh('sphere', createSphereMesh(1.0, 16));
        console.log('📦 Registered meshes: cube, sphere, grid');

        // Create scene and init with renderer
        const scene = new Scene();
        await scene.init(renderer);

        // Create the scene content
        await createGamepadScene(scene);

        // Start the scene
        scene.start();

        // Initialize gamepad manager with scene reference
        const gamepadManager = new GamepadManager(scene);

        // Make functions available globally for button clicks
        (window as any).refreshGamepads = () => gamepadManager.refreshGamepads();
        (window as any).clearLog = () => gamepadManager.clearLog();

        // Export scene to window for debugging
        (window as any).gamepadScene = scene;

        console.log('✅ Gamepad demo scene initialized successfully');

        // Animation loop (copied from physics-system scene)
        let lastTime = performance.now();
        const gameLoop = (currentTime: number) => {
            const rawDeltaTime = (currentTime - lastTime) / 1000;
            const deltaTime = Math.min(rawDeltaTime, 1/30); // Cap at 30fps
            lastTime = currentTime;

            // Update gamepad movement every frame for smooth control
            gamepadManager.updateCubeMovement();

            // Update scene - this renders the frame
            scene.update(deltaTime);

            requestAnimationFrame(gameLoop);
        };

        // Start the game loop
        requestAnimationFrame(gameLoop);

        console.log('🎮 Connect a gamepad and press any button to see it appear in the list');

    } catch (error) {
        console.error('Failed to initialize gamepad demo:', error);

        const errorDisplay = document.getElementById('error-display');
        if (errorDisplay) {
            errorDisplay.style.display = 'block';
            errorDisplay.textContent = `Error: ${error}`;
        }
    }
}

main().catch(console.error);
