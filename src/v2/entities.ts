// src/v2/entities.ts

import { makeTransformMatrix } from './math-utils';

export interface Transform {
    position: [number, number, number];
    rotation: [number, number, number]; // Euler angles [pitch, yaw, roll] in radians
    scale: [number, number, number];
}

export interface EntityData {
    id: string;
    meshId: string;
    transform: Transform;
    color: [number, number, number, number];
    renderMode: 'triangles' | 'lines';
    textureId?: string;
}

export class Entity {
    // eslint-disable-next-line no-unused-vars
    constructor(public readonly data: EntityData) {}
    
    getTransformMatrix(): Float32Array {
        const { position, rotation, scale } = this.data.transform;
        return makeTransformMatrix(position, scale, rotation);
    }
}

export class EntityManager {
    private entities = new Map<string, Entity>();
    private dirtyFlags = new Set<string>(); // Track changed entities
    
    add(entityData: EntityData): void {
        this.entities.set(entityData.id, new Entity(entityData));
        this.dirtyFlags.add(entityData.id);
    }
    
    update(id: string, updates: Partial<EntityData>): void {
        const entity = this.entities.get(id);
        if (entity) {
            Object.assign(entity.data, updates);
            this.dirtyFlags.add(id);
        }
    }
    
    remove(id: string): void {
        this.entities.delete(id);
        this.dirtyFlags.delete(id);
    }
    
    getAll(): Entity[] {
        return Array.from(this.entities.values());
    }
    
    getByMeshId(meshId: string): Entity[] {
        return Array.from(this.entities.values())
            .filter(e => e.data.meshId === meshId);
    }
    
    getByRenderMode(mode: 'triangles' | 'lines'): Entity[] {
        return Array.from(this.entities.values())
            .filter(e => e.data.renderMode === mode);
    }
    
    clearDirtyFlags(): void {
        this.dirtyFlags.clear();
    }
    
    getDirtyEntities(): string[] {
        return Array.from(this.dirtyFlags);
    }
}