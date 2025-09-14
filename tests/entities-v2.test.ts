// tests/entities-v2.test.ts
// Unit tests for v2 Entity and EntityManager components

import { Entity, EntityManager } from '../src/entities';

describe('Entity (v2)', () => {
    test('should create entity with transform matrix', () => {
        const entityData = {
            id: 'test-entity',
            meshId: 'cube',
            transform: {
                position: [1, 2, 3] as [number, number, number],
                rotation: [0, 45, 0] as [number, number, number],
                scale: [2, 2, 2] as [number, number, number],
            },
            color: [1, 0, 0, 1] as [number, number, number, number],
            renderMode: 'triangles' as const,
        };

        const entity = new Entity(entityData);

        expect(entity.data.id).toBe('test-entity');
        expect(entity.data.meshId).toBe('cube');
        expect(entity.data.transform.position).toEqual([1, 2, 3]);
        expect(entity.data.color).toEqual([1, 0, 0, 1]);
    });

    test('should generate transform matrix from TRS', () => {
        const entityData = {
            id: 'test-entity',
            meshId: 'cube',
            transform: {
                position: [1, 0, 0] as [number, number, number],
                rotation: [0, 0, 0] as [number, number, number],
                scale: [1, 1, 1] as [number, number, number],
            },
            color: [1, 0, 0, 1] as [number, number, number, number],
            renderMode: 'triangles' as const,
        };

        const entity = new Entity(entityData);
        const matrix = entity.getTransformMatrix();

        expect(matrix).toBeInstanceOf(Float32Array);
        expect(matrix.length).toBe(16);

        // Check translation components (should be [1, 0, 0])
        expect(matrix[12]).toBe(1); // x translation
        expect(matrix[13]).toBe(0); // y translation
        expect(matrix[14]).toBe(0); // z translation
        expect(matrix[15]).toBe(1); // w component
    });

    test('should handle different render modes', () => {
        const triangleEntity = new Entity({
            id: 'triangle-entity',
            meshId: 'triangle',
            transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
            color: [1, 0, 0, 1],
            renderMode: 'triangles',
        });

        const lineEntity = new Entity({
            id: 'line-entity',
            meshId: 'grid',
            transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
            color: [0, 1, 0, 1],
            renderMode: 'lines',
        });

        expect(triangleEntity.data.renderMode).toBe('triangles');
        expect(lineEntity.data.renderMode).toBe('lines');
    });
});

describe('EntityManager (v2)', () => {
    let entityManager: EntityManager;

    beforeEach(() => {
        entityManager = new EntityManager();
    });

    test('should add entities correctly', () => {
        const entityData = {
            id: 'test-entity',
            meshId: 'cube',
            transform: { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
            color: [1, 0, 0, 1] as [number, number, number, number],
            renderMode: 'triangles' as const,
        };

        entityManager.add(entityData);

        const entities = entityManager.getAll();
        expect(entities).toHaveLength(1);
        expect(entities[0]!.data.id).toBe('test-entity');
    });

    test('should update entities correctly', () => {
        const entityData = {
            id: 'test-entity',
            meshId: 'cube',
            transform: { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
            color: [1, 0, 0, 1] as [number, number, number, number],
            renderMode: 'triangles' as const,
        };

        entityManager.add(entityData);
        entityManager.update('test-entity', { color: [0, 1, 0, 1] });

        const entity = entityManager.getAll()[0];
        expect(entity!.data.color).toEqual([0, 1, 0, 1]);
    });

    test('should remove entities correctly', () => {
        const entityData = {
            id: 'test-entity',
            meshId: 'cube',
            transform: { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
            color: [1, 0, 0, 1] as [number, number, number, number],
            renderMode: 'triangles' as const,
        };

        entityManager.add(entityData);
        expect(entityManager.getAll()).toHaveLength(1);

        entityManager.remove('test-entity');
        expect(entityManager.getAll()).toHaveLength(0);
    });

    test('should filter entities by render mode', () => {
        const triangleEntity = {
            id: 'triangle-entity',
            meshId: 'cube',
            transform: { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
            color: [1, 0, 0, 1] as [number, number, number, number],
            renderMode: 'triangles' as const,
        };

        const lineEntity = {
            id: 'line-entity',
            meshId: 'grid',
            transform: { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
            color: [0, 1, 0, 1] as [number, number, number, number],
            renderMode: 'lines' as const,
        };

        entityManager.add(triangleEntity);
        entityManager.add(lineEntity);

        const triangleEntities = entityManager.getByRenderMode('triangles');
        const lineEntities = entityManager.getByRenderMode('lines');

        expect(triangleEntities).toHaveLength(1);
        expect(lineEntities).toHaveLength(1);
        expect(triangleEntities[0]!.data.id).toBe('triangle-entity');
        expect(lineEntities[0]!.data.id).toBe('line-entity');
    });

    test('should filter entities by mesh ID', () => {
        const cubeEntity1 = {
            id: 'cube-1',
            meshId: 'cube',
            transform: { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
            color: [1, 0, 0, 1] as [number, number, number, number],
            renderMode: 'triangles' as const,
        };

        const sphereEntity = {
            id: 'sphere-1',
            meshId: 'sphere',
            transform: { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
            color: [0, 1, 0, 1] as [number, number, number, number],
            renderMode: 'triangles' as const,
        };

        const cubeEntity2 = {
            id: 'cube-2',
            meshId: 'cube',
            transform: { position: [2, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
            color: [0, 0, 1, 1] as [number, number, number, number],
            renderMode: 'triangles' as const,
        };

        entityManager.add(cubeEntity1);
        entityManager.add(sphereEntity);
        entityManager.add(cubeEntity2);

        const cubeEntities = entityManager.getByMeshId('cube');
        const sphereEntities = entityManager.getByMeshId('sphere');

        expect(cubeEntities).toHaveLength(2);
        expect(sphereEntities).toHaveLength(1);

        const cubeIds = cubeEntities.map(e => e.data.id).sort();
        expect(cubeIds).toEqual(['cube-1', 'cube-2']);
    });

    test('should handle dirty flag tracking', () => {
        const entityData = {
            id: 'test-entity',
            meshId: 'cube',
            transform: { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] },
            color: [1, 0, 0, 1] as [number, number, number, number],
            renderMode: 'triangles' as const,
        };

        entityManager.add(entityData);
        expect(entityManager.getDirtyEntities()).toContain('test-entity');

        entityManager.clearDirtyFlags();
        expect(entityManager.getDirtyEntities()).toHaveLength(0);

        entityManager.update('test-entity', { color: [0, 1, 0, 1] });
        expect(entityManager.getDirtyEntities()).toContain('test-entity');
    });

    test('should handle non-existent entity operations gracefully', () => {
        entityManager.update('non-existent', { color: [1, 1, 1, 1] });
        entityManager.remove('non-existent');

        expect(entityManager.getAll()).toHaveLength(0);
        expect(entityManager.getDirtyEntities()).toHaveLength(0);
    });
});
