// src/v2/scene-system.ts
// Scene system for managing GameObjects and coordinating updates/rendering

import { Camera } from './camera';
import { GameObject } from './gameobject';
import { WebGPURendererV2 } from './webgpu.renderer';

export class Scene {
    private entities = new Map<string, GameObject>();
    private nextEntityId = 0;
    
    public camera: Camera;
    private renderer?: WebGPURendererV2;
    
    constructor() {
        // Default camera setup
        this.camera = new Camera(
            [0, 5, -10], // position
            [0, 0, 0],   // target  
            Math.PI / 3, // fov (60 degrees in radians)
            0.1,         // near
            100          // far
        );
    }
    
    // Entity Management
    addGameObject(gameObject: GameObject): void {
        this.entities.set(gameObject.id, gameObject);
        gameObject.setScene(this);
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
    async init(renderer: WebGPURendererV2): Promise<void> {
        this.renderer = renderer;
        
        // Initialize all GameObjects
        for (const gameObject of this.entities.values()) {
            gameObject.awake();
        }
    }
    
    start(): void {
        // Start all GameObjects
        for (const gameObject of this.entities.values()) {
            gameObject.start();
        }
    }
    
    update(deltaTime: number): void {
        // Update all GameObjects
        for (const gameObject of this.entities.values()) {
            gameObject.update(deltaTime);
        }
        
        // Camera updates can be added here if needed in the future
        
        // Render the scene
        this.render();
    }
    
    render(): void {
        if (!this.renderer) return;
        
        // Update camera matrices
        const aspect = this.renderer.getAspectRatio();
        const viewProjectionMatrix = this.camera.getViewProjectionMatrix(aspect);
        
        // Collect renderable entities from GameObjects
        const renderableEntities = [];
        
        for (const gameObject of this.entities.values()) {
            const meshRenderer = gameObject.getMeshRenderer();
            if (meshRenderer && gameObject.isActive()) {
                // Convert GameObject to Entity format for renderer
                // NOTE: Renderer expects rotation in RADIANS, but GameObject stores in DEGREES
                const entity = {
                    id: gameObject.id,
                    meshId: meshRenderer.meshId,
                    transform: {
                        position: [gameObject.transform.position.x, gameObject.transform.position.y, gameObject.transform.position.z] as [number, number, number],
                        rotation: [
                            gameObject.transform.rotation.x * Math.PI / 180,  // Convert degrees to radians
                            gameObject.transform.rotation.y * Math.PI / 180,  // Convert degrees to radians
                            gameObject.transform.rotation.z * Math.PI / 180   // Convert degrees to radians
                        ] as [number, number, number], 
                        scale: [gameObject.transform.scale.x, gameObject.transform.scale.y, gameObject.transform.scale.z] as [number, number, number]
                    },
                    color: [meshRenderer.color.x, meshRenderer.color.y, meshRenderer.color.z, meshRenderer.color.w] as [number, number, number, number],
                    renderMode: meshRenderer.renderMode
                };
                renderableEntities.push(entity);
            }
        }
        
        // Update renderer with current entities and camera
        this.renderer.updateEntities(renderableEntities);
        this.renderer.updateCamera(viewProjectionMatrix);
        this.renderer.render();
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
            cameraPosition: this.camera.getPosition()
        };
    }
}