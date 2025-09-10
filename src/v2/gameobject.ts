// src/v2/gameobject.ts
// GameObject class - main entity in the scene system

import { Component, Transform, MeshRenderer } from './components';

export class GameObject {
    public readonly id: string;
    public name: string;
    public tag: string;
    public active: boolean;
    
    // Transform is always present
    public transform: Transform;
    
    // Component system
    private components = new Map<new (..._args: any[]) => Component, Component>();
    
    // Hierarchy system (ID-based references for safe deletion/serialization)
    public childIds: string[] = [];
    public parentId?: string;
    
    // Scene reference (set by Scene when added)
    private scene: any = null; // Will be Scene, avoiding circular import
    
    constructor(id?: string, name?: string) {
        this.id = id || `gameobject_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = name || this.id;
        this.tag = 'default';
        this.active = true;
        
        // Every GameObject has a Transform
        this.transform = new Transform();
        this.addComponent(this.transform);
    }
    
    // Component Management
    addComponent<T extends Component>(component: T): T {
        const componentType = component.constructor as new (..._args: any[]) => T;
        
        // Remove existing component of same type
        if (this.components.has(componentType)) {
            this.removeComponent(componentType);
        }
        
        // Add new component
        component.gameObject = this;
        this.components.set(componentType, component);
        
        // Call awake if GameObject is already in scene
        if (this.scene) {
            component.awake();
        }
        
        return component;
    }
    
    getComponent<T extends Component>(componentType: new (..._args: any[]) => T): T | null {
        return (this.components.get(componentType) as T) || null;
    }
    
    removeComponent<T extends Component>(componentType: new (..._args: any[]) => T): boolean {
        const component = this.components.get(componentType);
        if (component) {
            component.destroy();
            this.components.delete(componentType);
            return true;
        }
        return false;
    }
    
    hasComponent<T extends Component>(componentType: new (..._args: any[]) => T): boolean {
        return this.components.has(componentType);
    }
    
    getAllComponents(): Component[] {
        return Array.from(this.components.values());
    }
    
    // Convenience accessors for common components
    getMeshRenderer(): MeshRenderer | null {
        return this.getComponent(MeshRenderer);
    }
    
    // Hierarchy Management (requires scene context)
    getParent(): GameObject | null {
        if (!this.parentId || !this.scene) return null;
        return this.scene.getGameObject(this.parentId);
    }
    
    getChildren(): GameObject[] {
        if (!this.scene) return [];
        return this.childIds
            .map(id => this.scene.getGameObject(id))
            .filter(obj => obj !== null);
    }
    
    addChild(child: GameObject): void {
        if (!this.scene) {
            console.warn('Cannot add child: GameObject not in scene');
            return;
        }
        
        // Remove from previous parent
        if (child.parentId) {
            const oldParent = this.scene.getGameObject(child.parentId);
            oldParent?.removeChild(child.id);
        }
        
        // Set new parent relationship
        child.parentId = this.id;
        if (!this.childIds.includes(child.id)) {
            this.childIds.push(child.id);
        }
    }
    
    removeChild(childId: string): void {
        const index = this.childIds.indexOf(childId);
        if (index >= 0) {
            this.childIds.splice(index, 1);
            
            // Clear parent reference on child
            if (this.scene) {
                const child = this.scene.getGameObject(childId);
                if (child) {
                    delete child.parentId;
                }
            }
        }
    }
    
    // Lifecycle Methods
    awake(): void {
        // Call awake on all components
        for (const component of this.components.values()) {
            component.awake();
        }
    }
    
    start(): void {
        // Call start on all components
        for (const component of this.components.values()) {
            component.start();
        }
    }
    
    update(deltaTime: number): void {
        if (!this.active) return;
        
        // Update all components
        for (const component of this.components.values()) {
            component.update(deltaTime);
        }
    }
    
    destroy(): void {
        // Destroy all components
        for (const component of this.components.values()) {
            component.destroy();
        }
        this.components.clear();
        
        // Clear hierarchy references
        this.childIds = [];
        delete this.parentId;
    }
    
    // Scene Management (called by Scene)
    setScene(scene: any): void {
        this.scene = scene;
    }
    
    // Utility Methods
    setActive(active: boolean): void {
        this.active = active;
    }
    
    isActive(): boolean {
        return this.active;
    }
    
    // Create static factory methods for common GameObject types
    static createCube(name?: string, position?: { x: number; y: number; z: number }): GameObject {
        const cube = new GameObject(undefined, name || 'Cube');
        
        if (position) {
            cube.transform.setPosition(position.x, position.y, position.z);
        }
        
        const meshRenderer = new MeshRenderer('cube', 'default', 'triangles');
        cube.addComponent(meshRenderer);
        
        return cube;
    }
    
    static createSphere(name?: string, position?: { x: number; y: number; z: number }): GameObject {
        const sphere = new GameObject(undefined, name || 'Sphere');
        
        if (position) {
            sphere.transform.setPosition(position.x, position.y, position.z);
        }
        
        const meshRenderer = new MeshRenderer('sphere', 'default', 'triangles');
        sphere.addComponent(meshRenderer);
        
        return sphere;
    }
    
    static createGrid(name?: string, position?: { x: number; y: number; z: number }): GameObject {
        const grid = new GameObject(undefined, name || 'Grid');
        
        if (position) {
            grid.transform.setPosition(position.x, position.y, position.z);
        }
        
        const meshRenderer = new MeshRenderer('grid', 'default', 'lines', { x: 1, y: 1, z: 0, w: 1 }); // Yellow
        grid.addComponent(meshRenderer);
        
        return grid;
    }
}