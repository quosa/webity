// Base Component class - foundation for all game object components
import type { GameObject } from '../gameobject.js';

export abstract class Component {
  protected gameObject!: GameObject;
  protected enabled = true;

  // Component lifecycle methods
  abstract awake(): void;    // Called when component is added to GameObject
  abstract start(): void;    // Called before first update
  abstract update(_deltaTime: number): void; // Called every frame
  abstract destroy(): void;  // Called when component is removed

  // GameObject reference (set by GameObject when component is added)
  setGameObject(gameObject: GameObject): void {
    this.gameObject = gameObject;
  }

  // Enable/disable component
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Get other components on the same GameObject
  protected getComponent<T extends Component>(componentClass: new () => T): T | null {
    return this.gameObject.getComponent(componentClass);
  }

  protected getComponents<T extends Component>(componentClass: new () => T): T[] {
    return this.gameObject.getComponents().filter(
      (component): component is T => component instanceof componentClass
    );
  }
}