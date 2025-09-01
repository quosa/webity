// Core GameObject class with component management and transform hierarchy
import { Component } from './components/component.js';
import type { Scene } from './scene.js';

let nextGameObjectId = 1;

export class GameObject {
  public readonly id: string;
  public name: string;
  
  private components: Map<string, Component> = new Map();
  private children: GameObject[] = [];
  private parent: GameObject | null = null;
  private scene: Scene | null = null;
  
  // Lifecycle state
  private started = false;
  private destroyed = false;

  constructor(name?: string) {
    this.id = `GameObject_${nextGameObjectId++}`;
    this.name = name || this.id;
  }

  // Component management
  addComponent<T extends Component>(componentClass: new () => T): T {
    if (this.destroyed) {
      throw new Error(`Cannot add component to destroyed GameObject: ${this.name}`);
    }

    const componentName = componentClass.name;
    
    if (this.components.has(componentName)) {
      throw new Error(`GameObject ${this.name} already has component: ${componentName}`);
    }

    const component = new componentClass();
    component.setGameObject(this);
    this.components.set(componentName, component);

    // Initialize component if GameObject is already started
    if (this.started) {
      component.awake();
      component.start();
    }

    return component;
  }

  getComponent<T extends Component>(componentClass: new () => T): T | null {
    const componentName = componentClass.name;
    const component = this.components.get(componentName);
    return component as T || null;
  }

  getComponents(): Component[] {
    return Array.from(this.components.values());
  }

  removeComponent<T extends Component>(componentClass: new () => T): boolean {
    const componentName = componentClass.name;
    const component = this.components.get(componentName);
    
    if (component) {
      component.destroy();
      this.components.delete(componentName);
      return true;
    }
    
    return false;
  }

  hasComponent<T extends Component>(componentClass: new () => T): boolean {
    const componentName = componentClass.name;
    return this.components.has(componentName);
  }

  // Transform hierarchy
  addChild(child: GameObject): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    
    child.parent = this;
    this.children.push(child);
    
    // If child is in a different scene, move it to this scene
    if (this.scene && child.scene !== this.scene) {
      if (child.scene) {
        child.scene.removeGameObject(child);
      }
      this.scene.addGameObject(child);
    }
  }

  removeChild(child: GameObject): boolean {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      child.parent = null;
      this.children.splice(index, 1);
      return true;
    }
    return false;
  }

  getChildren(): GameObject[] {
    return [...this.children];
  }

  getParent(): GameObject | null {
    return this.parent;
  }

  // Scene management
  setScene(scene: Scene | null): void {
    this.scene = scene;
  }

  getScene(): Scene | null {
    return this.scene;
  }

  // Lifecycle methods
  awake(): void {
    if (this.destroyed) return;
    
    // Awake all components
    for (const component of this.components.values()) {
      if (component.isEnabled()) {
        component.awake();
      }
    }
    
    // Awake children
    for (const child of this.children) {
      child.awake();
    }
  }

  start(): void {
    if (this.destroyed || this.started) return;
    
    this.started = true;
    
    // Start all components
    for (const component of this.components.values()) {
      if (component.isEnabled()) {
        component.start();
      }
    }
    
    // Start children
    for (const child of this.children) {
      child.start();
    }
  }

  update(deltaTime: number): void {
    if (this.destroyed) return;
    
    // Update all components
    for (const component of this.components.values()) {
      if (component.isEnabled()) {
        component.update(deltaTime);
      }
    }
    
    // Update children
    for (const child of this.children) {
      child.update(deltaTime);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Destroy all components
    for (const component of this.components.values()) {
      component.destroy();
    }
    this.components.clear();
    
    // Destroy children
    for (const child of this.children) {
      child.destroy();
    }
    this.children.length = 0;
    
    // Remove from parent
    if (this.parent) {
      this.parent.removeChild(this);
    }
    
    // Remove from scene
    if (this.scene) {
      this.scene.removeGameObject(this);
    }
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  // Debug helpers
  toString(): string {
    return `GameObject(${this.name}, components: ${this.components.size}, children: ${this.children.length})`;
  }

  // Find methods for hierarchy traversal
  findChild(name: string): GameObject | null {
    return this.children.find(child => child.name === name) || null;
  }

  findChildRecursive(name: string): GameObject | null {
    // Check direct children first
    const directChild = this.findChild(name);
    if (directChild) return directChild;
    
    // Search in children's children
    for (const child of this.children) {
      const found = child.findChildRecursive(name);
      if (found) return found;
    }
    
    return null;
  }
}