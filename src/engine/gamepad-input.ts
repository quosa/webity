// Gamepad input management with configurable axis mapping
// Integrates with existing InputController system via virtual key codes

export type GamepadAction =
    | 'camera-forward' | 'camera-back' | 'camera-left' | 'camera-right' | 'camera-up' | 'camera-down'
    | 'camera-look-yaw' | 'camera-look-pitch'
    | 'force-forward' | 'force-back' | 'force-left' | 'force-right' | 'force-up' | 'force-down'
    | 'orbit-yaw' | 'orbit-pitch' | 'orbit-zoom-in' | 'orbit-zoom-out'
    | 'rotation-yaw' | 'rotation-pitch' | 'rotation-roll'
    | 'none';

export interface GamepadAxisMapping {
    leftStickX: GamepadAction;
    leftStickY: GamepadAction;
    rightStickX: GamepadAction;
    rightStickY: GamepadAction;
    leftTrigger: GamepadAction;
    rightTrigger: GamepadAction;
}

export interface GamepadButtonMapping {
    button0: GamepadAction;  // A/Cross
    button1: GamepadAction;  // B/Circle
    button2: GamepadAction;  // X/Square
    button3: GamepadAction;  // Y/Triangle
    button4: GamepadAction;  // LB/L1
    button5: GamepadAction;  // RB/R1
    button6: GamepadAction;  // LT/L2 (if not analog)
    button7: GamepadAction;  // RT/R2 (if not analog)
    button8: GamepadAction;  // Select/Share
    button9: GamepadAction;  // Start/Options
    button10: GamepadAction; // Left stick click
    button11: GamepadAction; // Right stick click
    button12: GamepadAction; // D-pad up
    button13: GamepadAction; // D-pad down
    button14: GamepadAction; // D-pad left
    button15: GamepadAction; // D-pad right
}

export interface GamepadConfiguration {
    name: string;
    axisMapping: GamepadAxisMapping;
    buttonMapping: GamepadButtonMapping;
    sensitivity: {
        leftStick: number;
        rightStick: number;
        triggers: number;
    };
    deadzone: {
        leftStick: number;
        rightStick: number;
        triggers: number;
    };
}

// Virtual key codes for gamepad actions (starting from 1000 to avoid conflicts)
const VIRTUAL_KEYS = {
    'camera-forward': 1001,
    'camera-back': 1002,
    'camera-left': 1003,
    'camera-right': 1004,
    'camera-up': 1005,
    'camera-down': 1006,
    'camera-look-yaw': 1007,
    'camera-look-pitch': 1008,
    'force-forward': 1011,
    'force-back': 1012,
    'force-left': 1013,
    'force-right': 1014,
    'force-up': 1015,
    'force-down': 1016,
    'orbit-yaw': 1021,
    'orbit-pitch': 1022,
    'orbit-zoom-in': 1023,
    'orbit-zoom-out': 1024,
    'rotation-yaw': 1031,
    'rotation-pitch': 1032,
    'rotation-roll': 1033,
    'none': 0
} as const;

// Preset configurations
export const GAMEPAD_PRESETS: Record<string, GamepadConfiguration> = {
    'fps-camera': {
        name: 'FPS Camera',
        axisMapping: {
            leftStickX: 'camera-right',
            leftStickY: 'camera-forward',
            rightStickX: 'camera-look-yaw',
            rightStickY: 'camera-look-pitch',
            leftTrigger: 'camera-down',
            rightTrigger: 'camera-up'
        },
        buttonMapping: {
            button0: 'camera-up',     // A/Cross - jump
            button1: 'camera-down',   // B/Circle - crouch
            button2: 'none',
            button3: 'none',
            button4: 'camera-up',     // LB/L1 - jump
            button5: 'camera-down',   // RB/R1 - crouch
            button6: 'camera-down',   // LT/L2
            button7: 'camera-up',     // RT/R2
            button8: 'none',
            button9: 'none',
            button10: 'none',
            button11: 'none',
            button12: 'camera-forward', // D-pad up
            button13: 'camera-back',    // D-pad down
            button14: 'camera-left',    // D-pad left
            button15: 'camera-right'    // D-pad right
        },
        sensitivity: { leftStick: 1.0, rightStick: 1.0, triggers: 1.0 },
        deadzone: { leftStick: 0.1, rightStick: 0.1, triggers: 0.1 }
    },
    'physics-object': {
        name: 'Physics Object',
        axisMapping: {
            leftStickX: 'force-right',
            leftStickY: 'force-back',     // Stick up = move box toward back (positive Z)
            rightStickX: 'rotation-yaw',
            rightStickY: 'rotation-pitch',
            leftTrigger: 'none',       // Remove trigger force mapping
            rightTrigger: 'none'       // Remove trigger force mapping
        },
        buttonMapping: {
            button0: 'force-up',      // A/Cross - jump
            button1: 'force-down',    // B/Circle - slam down
            button2: 'none',
            button3: 'none',
            button4: 'force-up',      // LB/L1 - jump
            button5: 'force-up',      // RB/R1 - jump
            button6: 'force-down',    // LT/L2
            button7: 'force-up',      // RT/R2
            button8: 'none',
            button9: 'none',
            button10: 'none',
            button11: 'none',
            button12: 'force-forward', // D-pad up
            button13: 'force-back',    // D-pad down
            button14: 'force-left',    // D-pad left
            button15: 'force-right'    // D-pad right
        },
        sensitivity: { leftStick: 1.0, rightStick: 1.0, triggers: 1.0 },
        deadzone: { leftStick: 0.15, rightStick: 0.15, triggers: 0.3 }
    },
    'orbit-camera': {
        name: 'Orbit Camera',
        axisMapping: {
            leftStickX: 'orbit-yaw',
            leftStickY: 'orbit-pitch',
            rightStickX: 'orbit-yaw',
            rightStickY: 'orbit-pitch',
            leftTrigger: 'orbit-zoom-out',
            rightTrigger: 'orbit-zoom-in'
        },
        buttonMapping: {
            button0: 'orbit-zoom-in',  // A/Cross - zoom in
            button1: 'orbit-zoom-out', // B/Circle - zoom out
            button2: 'none',
            button3: 'none',
            button4: 'orbit-zoom-in',  // LB/L1
            button5: 'orbit-zoom-out', // RB/R1
            button6: 'orbit-zoom-out', // LT/L2
            button7: 'orbit-zoom-in',  // RT/R2
            button8: 'none',
            button9: 'none',
            button10: 'none',
            button11: 'none',
            button12: 'orbit-pitch',   // D-pad up
            button13: 'orbit-pitch',   // D-pad down
            button14: 'orbit-yaw',     // D-pad left
            button15: 'orbit-yaw'      // D-pad right
        },
        sensitivity: { leftStick: 1.5, rightStick: 1.5, triggers: 1.0 },
        deadzone: { leftStick: 0.1, rightStick: 0.1, triggers: 0.1 }
    }
};

export interface GamepadState {
    id: string;
    index: number;
    connected: boolean;
    lastAxisValues: number[];
    lastButtonStates: boolean[];
}

export class GamepadInputManager {
    private gamepads: Map<number, GamepadState> = new Map();
    private callback: ((_key: number, _pressed: boolean, _analogValue?: number) => void) | undefined;
    private currentConfiguration: GamepadConfiguration;
    private isPolling = false;
    private currentAxisStates: Map<GamepadAction, number> = new Map();
    private lastFrameTime = 0;

    constructor() {
        // Set default configuration
        const defaultConfig = GAMEPAD_PRESETS['fps-camera'];
        if (!defaultConfig) {
            throw new Error('Default gamepad configuration not found');
        }
        this.currentConfiguration = defaultConfig;

        // Listen for gamepad connection events
        window.addEventListener('gamepadconnected', (e) => {
            this.onGamepadConnected(e as GamepadEvent);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            this.onGamepadDisconnected(e as GamepadEvent);
        });
    }

    public init(callback: (_key: number, _pressed: boolean, _analogValue?: number) => void): void {
        this.callback = callback;
        this.startPolling();
    }

    public dispose(): void {
        this.stopPolling();
        this.gamepads.clear();
        this.callback = undefined;
    }

    public setConfiguration(config: GamepadConfiguration): void {
        this.currentConfiguration = config;
        // Clear current axis states when switching configurations
        this.currentAxisStates.clear();
        console.log(`🎮 Gamepad configuration changed to: ${config.name}`);
    }

    public getConfiguration(): GamepadConfiguration {
        return this.currentConfiguration;
    }

    public getConnectedGamepads(): GamepadState[] {
        return Array.from(this.gamepads.values()).filter(g => g.connected);
    }

    private onGamepadConnected(event: GamepadEvent): void {
        const gamepad = event.gamepad;
        console.log(`🎮 Gamepad connected: ${gamepad.id} (Index: ${gamepad.index})`);

        this.gamepads.set(gamepad.index, {
            id: gamepad.id,
            index: gamepad.index,
            connected: true,
            lastAxisValues: new Array(gamepad.axes.length).fill(0),
            lastButtonStates: new Array(gamepad.buttons.length).fill(false)
        });
    }

    private onGamepadDisconnected(event: GamepadEvent): void {
        const gamepad = event.gamepad;
        console.log(`🎮 Gamepad disconnected: ${gamepad.id}`);

        // Send key up events for any currently active inputs
        this.clearAllGamepadInputs(gamepad.index);
        this.gamepads.delete(gamepad.index);
    }

    private startPolling(): void {
        if (this.isPolling) return;
        this.isPolling = true;
        this.lastFrameTime = performance.now();
        this.pollGamepads();
    }

    private stopPolling(): void {
        this.isPolling = false;
    }

    private pollGamepads(): void {
        if (!this.isPolling) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;

        // Check if Gamepad API is available (not available in Node.js test environment)
        if (typeof navigator === 'undefined' || !navigator.getGamepads) {
            requestAnimationFrame(() => this.pollGamepads());
            return;
        }

        const gamepads = navigator.getGamepads();

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad && this.gamepads.has(i)) {
                this.processGamepadInput(gamepad, deltaTime);
            }
        }

        requestAnimationFrame(() => this.pollGamepads());
    }

    private processGamepadInput(gamepad: Gamepad, deltaTime: number): void {
        const state = this.gamepads.get(gamepad.index);
        if (!state) return;

        // Process axes
        this.processAxes(gamepad, state, deltaTime);

        // Process buttons
        this.processButtons(gamepad, state);
    }

    private processAxes(gamepad: Gamepad, state: GamepadState, deltaTime: number): void {
        const config = this.currentConfiguration;

        // Map axes to actions
        const axisActions: Array<{ index: number; action: GamepadAction; sensitivity: number; deadzone: number }> = [
            { index: 0, action: config.axisMapping.leftStickX, sensitivity: config.sensitivity.leftStick, deadzone: config.deadzone.leftStick },
            { index: 1, action: config.axisMapping.leftStickY, sensitivity: config.sensitivity.leftStick, deadzone: config.deadzone.leftStick },
            { index: 2, action: config.axisMapping.rightStickX, sensitivity: config.sensitivity.rightStick, deadzone: config.deadzone.rightStick },
            { index: 3, action: config.axisMapping.rightStickY, sensitivity: config.sensitivity.rightStick, deadzone: config.deadzone.rightStick },
            { index: 4, action: config.axisMapping.leftTrigger, sensitivity: config.sensitivity.triggers, deadzone: config.deadzone.triggers },
            { index: 5, action: config.axisMapping.rightTrigger, sensitivity: config.sensitivity.triggers, deadzone: config.deadzone.triggers }
        ];

        for (const axisAction of axisActions) {
            if (axisAction.index >= gamepad.axes.length || axisAction.action === 'none') continue;

            const rawValue = gamepad.axes[axisAction.index] || 0;
            const lastValue = state.lastAxisValues[axisAction.index] || 0;

            // Apply deadzone
            const deadzonedValue = Math.abs(rawValue) < axisAction.deadzone ? 0 : rawValue;

            // Apply sensitivity
            let finalValue = deadzonedValue * axisAction.sensitivity;

            // Invert Y-axis for standard gamepad behavior (up = negative, down = positive)
            if (axisAction.index === 1 || axisAction.index === 3) { // leftStickY or rightStickY
                finalValue = -finalValue;
            }

            // Check if value changed significantly
            if (Math.abs(finalValue - lastValue) > 0.01) {
                state.lastAxisValues[axisAction.index] = finalValue;

                // Debug logging for axis values
                if (Math.abs(finalValue) > 0.1) {
                    console.log(`🎮 Axis ${axisAction.index} (${axisAction.action}): raw=${rawValue.toFixed(3)}, final=${finalValue.toFixed(3)}`);
                }

                this.handleAxisAction(axisAction.action, finalValue, deltaTime);
            }
        }
    }

    private processButtons(gamepad: Gamepad, state: GamepadState): void {
        const config = this.currentConfiguration;
        const buttonActions = [
            config.buttonMapping.button0, config.buttonMapping.button1, config.buttonMapping.button2, config.buttonMapping.button3,
            config.buttonMapping.button4, config.buttonMapping.button5, config.buttonMapping.button6, config.buttonMapping.button7,
            config.buttonMapping.button8, config.buttonMapping.button9, config.buttonMapping.button10, config.buttonMapping.button11,
            config.buttonMapping.button12, config.buttonMapping.button13, config.buttonMapping.button14, config.buttonMapping.button15
        ];

        for (let i = 0; i < Math.min(gamepad.buttons.length, buttonActions.length); i++) {
            const button = gamepad.buttons[i];
            if (!button) continue;

            const action = buttonActions[i];
            if (!action || action === 'none') continue;

            const isPressed = button.pressed;
            const wasPressed = state.lastButtonStates[i] || false;

            if (isPressed !== wasPressed) {
                state.lastButtonStates[i] = isPressed;
                this.handleButtonAction(action, isPressed, button.value);
            }
        }
    }

    private handleAxisAction(action: GamepadAction, value: number, _deltaTime: number): void {
        if (!this.callback || action === 'none') return;

        // Store current axis state
        this.currentAxisStates.set(action, value);

        // Handle both positive and negative axis values
        const absValue = Math.abs(value);
        const threshold = 0.05; // Lower threshold for better responsiveness

        if (absValue > threshold) {
            // Determine which action to trigger based on value sign
            let targetAction: GamepadAction = action;

            if (value < 0) {
                // Negative values should trigger the opposite action
                switch (action) {
                    case 'force-right': targetAction = 'force-left'; break;
                    case 'force-left': targetAction = 'force-right'; break;
                    case 'force-forward': targetAction = 'force-back'; break;
                    case 'force-back': targetAction = 'force-forward'; break;
                    case 'camera-right': targetAction = 'camera-left'; break;
                    case 'camera-left': targetAction = 'camera-right'; break;
                    case 'camera-forward': targetAction = 'camera-back'; break;
                    case 'camera-back': targetAction = 'camera-forward'; break;
                    default: targetAction = action; break;
                }
            }

            const virtualKey = VIRTUAL_KEYS[targetAction];
            if (virtualKey) {
                console.log(`🎮 Action: ${action} -> ${targetAction} (${virtualKey}) value=${absValue.toFixed(3)}`);
                this.callback(virtualKey, true, absValue);
            }
        } else {
            // Value is below threshold, send release events for both directions
            const positiveKey = VIRTUAL_KEYS[action];
            let negativeAction: GamepadAction = action;

            switch (action) {
                case 'force-right': negativeAction = 'force-left'; break;
                case 'force-left': negativeAction = 'force-right'; break;
                case 'force-forward': negativeAction = 'force-back'; break;
                case 'force-back': negativeAction = 'force-forward'; break;
                case 'camera-right': negativeAction = 'camera-left'; break;
                case 'camera-left': negativeAction = 'camera-right'; break;
                case 'camera-forward': negativeAction = 'camera-back'; break;
                case 'camera-back': negativeAction = 'camera-forward'; break;
            }

            const negativeKey = VIRTUAL_KEYS[negativeAction];

            if (positiveKey) this.callback(positiveKey, false, 0);
            if (negativeKey && negativeKey !== positiveKey) this.callback(negativeKey, false, 0);
        }
    }

    private handleButtonAction(action: GamepadAction, pressed: boolean, value: number): void {
        if (!this.callback || action === 'none') return;

        const virtualKey = VIRTUAL_KEYS[action];
        if (!virtualKey) return;

        this.callback(virtualKey, pressed, value);
    }

    private clearAllGamepadInputs(gamepadIndex: number): void {
        const state = this.gamepads.get(gamepadIndex);
        if (!state || !this.callback) return;

        // Send release events for all currently pressed buttons
        state.lastButtonStates.forEach((pressed, index) => {
            if (pressed) {
                const config = this.currentConfiguration;
                const buttonActions = [
                    config.buttonMapping.button0, config.buttonMapping.button1, config.buttonMapping.button2, config.buttonMapping.button3,
                    config.buttonMapping.button4, config.buttonMapping.button5, config.buttonMapping.button6, config.buttonMapping.button7,
                    config.buttonMapping.button8, config.buttonMapping.button9, config.buttonMapping.button10, config.buttonMapping.button11,
                    config.buttonMapping.button12, config.buttonMapping.button13, config.buttonMapping.button14, config.buttonMapping.button15
                ];

                const action = buttonActions[index];
                if (action && action !== 'none') {
                    const virtualKey = VIRTUAL_KEYS[action];
                    if (virtualKey) {
                        this.callback!(virtualKey, false, 0);
                    }
                }
            }
        });

        // Send release events for all currently active axes
        this.currentAxisStates.forEach((value, action) => {
            if (Math.abs(value) > 0.1) {
                const virtualKey = VIRTUAL_KEYS[action];
                if (virtualKey) {
                    this.callback!(virtualKey, false, 0);
                }
            }
        });

        // Clear states
        state.lastButtonStates.fill(false);
        state.lastAxisValues.fill(0);
        this.currentAxisStates.clear();
    }

    // Debug methods
    public getCurrentAxisStates(): Map<GamepadAction, number> {
        return new Map(this.currentAxisStates);
    }

    public getVirtualKeys(): typeof VIRTUAL_KEYS {
        return VIRTUAL_KEYS;
    }
}
