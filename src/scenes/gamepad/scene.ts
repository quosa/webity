// Gamepad API Demo Scene - Enhanced with unified input system (scene-first engine API).
import { Scene } from '../../engine/scene-system.js';
import { Engine } from '../../engine/engine.js';
import { GameObject } from '../../engine/gameobject.js';
import { CollisionShape, MeshRenderer, RigidBody } from '../../engine/components.js';
import { Mesh } from '../../engine/mesh.js';
import { Material } from '../../engine/material.js';
import { GAMEPAD_PRESETS } from '../../engine/gamepad-input.js';

// UI manager for gamepad demo - uses Scene's integrated gamepad system
class GamepadUIManager {
    private scene: Scene;
    private inputCount = 0;
    private lastInput = 'None';
    private logEntries: string[] = [];
    private maxLogEntries = 100;
    private currentConfiguration: string = 'physics-object';

    constructor(scene: Scene) {
        this.scene = scene;

        // Set initial gamepad configuration
        const config = GAMEPAD_PRESETS[this.currentConfiguration];
        if (config) {
            this.scene.setGamepadConfiguration(config);
        }

        // Start UI update loop
        this.startUIUpdate();
    }

    private startUIUpdate(): void {
        // Update UI every 100ms
        setInterval(() => {
            this.updateUI();
        }, 100);
    }

    public switchConfiguration(configName: string): void {
        const config = GAMEPAD_PRESETS[configName];
        if (config) {
            this.currentConfiguration = configName;
            this.scene.setGamepadConfiguration(config);
            this.addLogEntry(`Switched to ${config.name} configuration`, 'system');
            console.log(`🎮 Switched to gamepad configuration: ${config.name}`);
        }
    }

    public addLogEntry(message: string, _type: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.logEntries.unshift(`[${timestamp}] ${message}`);

        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries = this.logEntries.slice(0, this.maxLogEntries);
        }

        this.updateLogDisplay();
        this.inputCount++;
        this.lastInput = message;
    }

    private updateLogDisplay(): void {
        const logOutput = document.getElementById('log-output');
        if (logOutput) {
            logOutput.innerHTML = this.logEntries
                .map(entry => `<div class="log-entry">${entry}</div>`)
                .join('');
            logOutput.scrollTop = 0;
        }
    }

    private updateUI(): void {
        this.updateGamepadList();
        this.updateButtonDisplay();
        this.updateAxisDisplay();
        this.updateStatus();
    }

    private updateGamepadList(): void {
        const gamepadList = document.getElementById('gamepad-list');
        if (!gamepadList) return;

        const connectedGamepads = this.scene.getConnectedGamepads();

        if (connectedGamepads.length === 0) {
            gamepadList.innerHTML = '<div>No gamepads detected. Connect a controller and press any button.</div>';
            return;
        }

        const html = connectedGamepads
            .map(gamepad => `
                <div class="gamepad-item connected">
                    <strong>Index ${gamepad.index}:</strong> ${gamepad.id}
                    <br>Connected and active
                </div>
            `)
            .join('');

        gamepadList.innerHTML = html;
    }

    private updateButtonDisplay(): void {
        const buttonGroup = document.getElementById('button-group');
        const buttonGrid = document.getElementById('button-grid');

        if (!buttonGroup || !buttonGrid) return;

        const connectedGamepads = this.scene.getConnectedGamepads();
        if (connectedGamepads.length === 0) {
            buttonGroup.style.display = 'none';
            return;
        }

        buttonGroup.style.display = 'block';

        // Get the current gamepad from the browser API
        const gamepads = navigator.getGamepads();
        const firstGamepad = connectedGamepads[0];
        if (!firstGamepad) return;
        const activeGamepad = gamepads[firstGamepad.index];
        if (!activeGamepad) return;

        const html = activeGamepad.buttons
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

    private updateAxisDisplay(): void {
        const axisGroup = document.getElementById('axis-group');
        const axisDisplay = document.getElementById('axis-display');

        if (!axisGroup || !axisDisplay) return;

        const connectedGamepads = this.scene.getConnectedGamepads();
        if (connectedGamepads.length === 0) {
            axisGroup.style.display = 'none';
            return;
        }

        axisGroup.style.display = 'block';

        // Get the current gamepad from the browser API
        const gamepads = navigator.getGamepads();
        const firstGamepad = connectedGamepads[0];
        if (!firstGamepad) return;
        const activeGamepad = gamepads[firstGamepad.index];
        if (!activeGamepad) return;

        const html = activeGamepad.axes
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

    private updateStatus(): void {
        const gamepadCount = document.getElementById('gamepad-count');
        const activeGamepad = document.getElementById('active-gamepad');
        const lastInput = document.getElementById('last-input');
        const inputCount = document.getElementById('input-count');

        const connectedGamepads = this.scene.getConnectedGamepads();

        if (gamepadCount) gamepadCount.textContent = connectedGamepads.length.toString();
        if (activeGamepad) {
            const firstGamepad = connectedGamepads[0];
            activeGamepad.textContent = firstGamepad ? `Index ${firstGamepad.index}` : 'None';
        }
        if (lastInput) lastInput.textContent = this.lastInput;
        if (inputCount) inputCount.textContent = this.inputCount.toString();
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
            'Left Stick X', 'Left Stick Y', 'Left Stick Z',
            'Right Stick X', 'Right Stick Y', 'Right Stick Z',
        ];
        return axisNames[index] || `Axis ${index}`;
    }

    public clearLog(): void {
        this.logEntries = [];
        this.updateLogDisplay();
        console.log('Log cleared');
    }

    public getAvailableConfigurations(): string[] {
        return Object.keys(GAMEPAD_PRESETS);
    }

    public getCurrentConfiguration(): string {
        return this.currentConfiguration;
    }
}

// Global reference to the controllable cube
let controlCube: GameObject;

// Create a pyramid stack of balls that can be knocked down
function createBallStack(scene: Scene, x: number, y: number) {
    console.log('🎾 Creating ball stack...');

    const ballRadius = 1.0;
    // One shared sphere mesh reused across every ball in the stack (dedup by id).
    const ballMesh = Mesh.createSphere('sphere', 1.0, 16);
    const colors = [
        { r: 1, g: 0, b: 0, a: 1 }, // Red
        { r: 0, g: 0, b: 1, a: 1 }, // Blue
        { r: 1, g: 1, b: 0, a: 1 }, // Yellow
        { r: 1, g: 0.5, b: 0, a: 1 }, // Orange
        { r: 0.5, g: 0, b: 1, a: 1 }, // Purple
        { r: 0, g: 1, b: 1, a: 1 }, // Cyan
    ];

    let ballCounter = 0;

    // Create a pyramid stack: 3 levels
    // Bottom row: 3 balls
    for (let i = 0; i < 3; i++) {
        const ball = new GameObject(`ball-bottom-${i}`, `BallBottom${i}`);
        ball.transform.setPosition(x + (i - 1) * ballRadius * 2, y + ballRadius, 0);

        const meshRenderer = new MeshRenderer(ballMesh, new Material(`ball-${ballCounter}`, colors[ballCounter % colors.length]!), 'triangles');
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

        const meshRenderer = new MeshRenderer(ballMesh, new Material(`ball-${ballCounter}`, colors[ballCounter % colors.length]!), 'triangles');
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

    const topMeshRenderer = new MeshRenderer(ballMesh, new Material(`ball-${ballCounter}`, colors[ballCounter % colors.length]!), 'triangles');
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

    const groundMesh = new MeshRenderer(Mesh.createGrid('grid', 16, 16), new Material('ground-gray', { r: 0.5, g: 0.5, b: 0.5, a: 1 }), 'lines'); // Gray
    ground.addComponent(groundMesh);
    scene.addGameObject(ground);

    // Create controllable cube (exactly like basic-shapes cube scene)
    controlCube = new GameObject('gamepad-cube', 'GamepadCube');
    controlCube.transform.setPosition(0, 0, 0); // Position in front of camera
    controlCube.transform.setScale(1, 1, 1); // Make it visible

    // Add MeshRenderer with cube mesh and green color (like basic-shapes pattern)
    const meshRenderer = new MeshRenderer(Mesh.createCube('cube'), new Material('cube-green', { r: 0, g: 1, b: 0, a: 1 }), 'triangles'); // Green
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

        // Scene-first engine API: build the scene as pure data, then let the Engine mount + run it.
        const engine = new Engine('canvas');
        await engine.init();

        // Create the scene content (pure data: GameObjects, meshes/materials, camera)
        const scene = new Scene();
        await createGamepadScene(scene);

        // Mount: upload meshes referenced by the scene + register entities with WASM.
        await engine.loadScene(scene);

        // Set initial input target to control the cube
        scene.setInputTarget(controlCube);

        // Start the frame loop (input → physics → update → render)
        engine.start(scene);

        // Initialize gamepad UI manager
        const gamepadUIManager = new GamepadUIManager(scene);

        // Make functions available globally for button clicks
        (window as any).refreshGamepads = () => {
            console.log('🔄 Refresh gamepads clicked');
            // The scene's gamepad manager handles this automatically
        };
        (window as any).clearLog = () => gamepadUIManager.clearLog();

        // Switch gamepad configuration
        (window as any).switchGamepadConfig = (configName: string) => {
            gamepadUIManager.switchConfiguration(configName);
        };

        // Export scene to window for debugging
        (window as any).engine = engine;
        (window as any).scene = scene;
        (window as any).gamepadScene = scene;
        (window as any).gamepadUIManager = gamepadUIManager;

        console.log('✅ Gamepad demo scene initialized successfully');

        console.log('🎮 Connect a gamepad and press any button to see it appear in the list');
        console.log('🎮 Use left stick to move the cube, LB/RB to bounce!');

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
