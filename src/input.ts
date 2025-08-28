// Input manager with proper cleanup and event handling
/* eslint-disable no-unused-vars */
export class InputManager {
  private keyMap: Map<string, number> = new Map([
    ['w', 87], ['W', 87],
    ['a', 65], ['A', 65], 
    ['s', 83], ['S', 83],
    ['d', 68], ['D', 68],
    [' ', 32], // Space
  ]);
  
  private callback: ((key: number, pressed: boolean) => void) | undefined;
  private boundHandlers: { down: (e: KeyboardEvent) => void, up: (e: KeyboardEvent) => void };
  private pressedKeys: Set<number> = new Set();

  constructor() {
    this.boundHandlers = {
      down: this.handleKeyDown.bind(this),
      up: this.handleKeyUp.bind(this)
    };
  }

  init(callback: (key: number, pressed: boolean) => void): void {
    this.callback = callback;
    window.addEventListener('keydown', this.boundHandlers.down);
    window.addEventListener('keyup', this.boundHandlers.up);
    
    // Also listen for blur/focus events to clear pressed keys
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
  }

  dispose(): void {
    window.removeEventListener('keydown', this.boundHandlers.down);
    window.removeEventListener('keyup', this.boundHandlers.up);
    window.removeEventListener('blur', this.handleWindowBlur.bind(this));
    window.removeEventListener('focus', this.handleWindowFocus.bind(this));
    
    // Clear all pressed keys on dispose
    this.clearAllKeys();
    this.callback = undefined;
  }

  // Get currently pressed keys (for debugging/UI)
  getPressedKeys(): number[] {
    return Array.from(this.pressedKeys);
  }

  // Check if a specific key is pressed
  isKeyPressed(key: string): boolean {
    const keyCode = this.keyMap.get(key);
    return keyCode ? this.pressedKeys.has(keyCode) : false;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const keyCode = this.keyMap.get(e.key);
    if (keyCode && this.callback) {
      // Prevent key repeat
      if (!this.pressedKeys.has(keyCode)) {
        this.pressedKeys.add(keyCode);
        e.preventDefault();
        this.callback(keyCode, true);
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const keyCode = this.keyMap.get(e.key);
    if (keyCode && this.callback) {
      if (this.pressedKeys.has(keyCode)) {
        this.pressedKeys.delete(keyCode);
        e.preventDefault();
        this.callback(keyCode, false);
      }
    }
  }

  private handleWindowBlur(): void {
    // Clear all pressed keys when window loses focus
    // This prevents keys getting "stuck" when user Alt+Tabs, etc.
    this.clearAllKeys();
  }

  private handleWindowFocus(): void {
    // Window regained focus - keys are already cleared
    // Could implement key state recovery here if needed
  }

  private clearAllKeys(): void {
    // Send key up events for all currently pressed keys
    if (this.callback) {
      for (const keyCode of this.pressedKeys) {
        this.callback(keyCode, false);
      }
    }
    this.pressedKeys.clear();
  }
}