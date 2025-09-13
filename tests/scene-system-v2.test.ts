// tests/scene-system-v2.test.ts
// Unit tests for the v2 Scene System (GameObject, Component, Scene classes)

import { Scene } from '../src/v2/scene-system';
import { GameObject } from '../src/v2/gameobject';
import { Transform, MeshRenderer, RotatorComponent } from '../src/v2/components';

describe('Component System (v2)', () => {
    describe('Transform Component', () => {
        test('should create transform with default values', () => {
            const transform = new Transform();

            expect(transform.position).toEqual({ x: 0, y: 0, z: 0 });
            expect(transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
            expect(transform.scale).toEqual({ x: 1, y: 1, z: 1 });
        });

        test('should create transform with custom values', () => {
            const transform = new Transform(
                { x: 1, y: 2, z: 3 },
                { x: 45, y: 90, z: 180 },
                { x: 2, y: 3, z: 4 }
            );

            expect(transform.position).toEqual({ x: 1, y: 2, z: 3 });
            expect(transform.rotation).toEqual({ x: 45, y: 90, z: 180 });
            expect(transform.scale).toEqual({ x: 2, y: 3, z: 4 });
        });

        test('should generate correct transform matrix', () => {
            const transform = new Transform();
            transform.setPosition(1, 0, 0);

            const matrix = transform.getLocalMatrix();

            expect(matrix).toBeInstanceOf(Float32Array);
            expect(matrix.length).toBe(16);

            // Check translation components (should be [1, 0, 0])
            expect(matrix[12]).toBe(1); // x translation
            expect(matrix[13]).toBe(0); // y translation
            expect(matrix[14]).toBe(0); // z translation
            expect(matrix[15]).toBe(1); // w component
        });

        test('should handle rotation correctly', () => {
            const transform = new Transform();
            transform.setRotation(0, 90, 0); // 90 degrees around Y axis

            const matrix = transform.getLocalMatrix();

            // 90 degree Y rotation should swap X and Z axes
            expect(matrix[0]).toBeCloseTo(0, 5);  // cos(90°) ≈ 0
            expect(matrix[8]).toBeCloseTo(1, 5);  // sin(90°) ≈ 1
        });

        test('should handle scale correctly', () => {
            const transform = new Transform();
            transform.setScale(2, 3, 4);

            const matrix = transform.getLocalMatrix();

            // Scale should affect diagonal elements
            expect(matrix[0]).toBe(2);  // X scale
            expect(matrix[5]).toBe(3);  // Y scale
            expect(matrix[10]).toBe(4); // Z scale
        });

        test('should provide convenience methods', () => {
            const transform = new Transform();

            transform.translate(1, 2, 3);
            expect(transform.position).toEqual({ x: 1, y: 2, z: 3 });

            transform.rotate(45, 90, 180);
            expect(transform.rotation).toEqual({ x: 45, y: 90, z: 180 });
        });
    });

    describe('MeshRenderer Component', () => {
        test('should create mesh renderer with defaults', () => {
            const meshRenderer = new MeshRenderer('cube');

            expect(meshRenderer.meshId).toBe('cube');
            expect(meshRenderer.materialId).toBe('default');
            expect(meshRenderer.renderMode).toBe('triangles');
            expect(meshRenderer.color).toEqual({ x: 1, y: 1, z: 1, w: 1 });
        });

        test('should create mesh renderer with custom values', () => {
            const meshRenderer = new MeshRenderer('sphere', 'metal', 'lines', { x: 1, y: 0, z: 0, w: 0.5 });

            expect(meshRenderer.meshId).toBe('sphere');
            expect(meshRenderer.materialId).toBe('metal');
            expect(meshRenderer.renderMode).toBe('lines');
            expect(meshRenderer.color).toEqual({ x: 1, y: 0, z: 0, w: 0.5 });
        });

        test('should update color correctly', () => {
            const meshRenderer = new MeshRenderer('cube');
            meshRenderer.setColor(0.5, 0.8, 0.2, 0.9);

            expect(meshRenderer.color).toEqual({ x: 0.5, y: 0.8, z: 0.2, w: 0.9 });
        });
    });

    describe('RotatorComponent', () => {
        test('should create rotator with default values', () => {
            const rotator = new RotatorComponent();

            // Default should be 45 deg/sec around Y axis
            expect(rotator['rotationSpeed']).toEqual({ x: 0, y: 45, z: 0 });
        });

        test('should create rotator with custom speeds', () => {
            const rotator = new RotatorComponent(30, 60, 90);

            expect(rotator['rotationSpeed']).toEqual({ x: 30, y: 60, z: 90 });
        });

        test('should update rotation on mock GameObject', () => {
            const rotator = new RotatorComponent(90, 0, 0); // 90 deg/sec around X
            const mockTransform = new Transform();
            const mockGameObject = { transform: mockTransform };

            rotator.gameObject = mockGameObject;

            const initialRotation = { ...mockTransform.rotation };
            rotator.update(1.0); // 1 second

            expect(mockTransform.rotation.x).toBe(initialRotation.x + 90);
            expect(mockTransform.rotation.y).toBe(initialRotation.y);
            expect(mockTransform.rotation.z).toBe(initialRotation.z);
        });
    });
});

describe('GameObject System (v2)', () => {
    test('should create GameObject with unique ID', () => {
        const go1 = new GameObject();
        const go2 = new GameObject();

        expect(go1.id).toBeDefined();
        expect(go2.id).toBeDefined();
        expect(go1.id).not.toBe(go2.id);
    });

    test('should create GameObject with custom name', () => {
        const gameObject = new GameObject('test-id', 'Test Object');

        expect(gameObject.id).toBe('test-id');
        expect(gameObject.name).toBe('Test Object');
    });

    test('should have Transform component by default', () => {
        const gameObject = new GameObject();

        expect(gameObject.transform).toBeInstanceOf(Transform);
        expect(gameObject.getComponent(Transform)).toBe(gameObject.transform);
    });

    test('should add and retrieve components', () => {
        const gameObject = new GameObject();
        const meshRenderer = new MeshRenderer('cube');
        // this is normally done by Scene when adding GameObject
        meshRenderer.meshIndex = 0; // Simulate assigned mesh index

        gameObject.addComponent(meshRenderer);

        expect(gameObject.getComponent(MeshRenderer)).toBe(meshRenderer);
        expect(gameObject.hasComponent(MeshRenderer)).toBe(true);
        expect(meshRenderer.gameObject).toBe(gameObject);
    });

    test('should remove components', () => {
        const gameObject = new GameObject();
        const meshRenderer = new MeshRenderer('cube');

        gameObject.addComponent(meshRenderer);
        const removed = gameObject.removeComponent(MeshRenderer);

        expect(removed).toBe(true);
        expect(gameObject.getComponent(MeshRenderer)).toBeNull();
        expect(gameObject.hasComponent(MeshRenderer)).toBe(false);
    });

    test('should replace component of same type', () => {
        const gameObject = new GameObject();
        const meshRenderer1 = new MeshRenderer('cube');
        // this is normally done by Scene when adding GameObject
        meshRenderer1.meshIndex = 0; // Simulate assigned mesh index
        const meshRenderer2 = new MeshRenderer('sphere');
        // this is normally done by Scene when adding GameObject
        meshRenderer2.meshIndex = 0; // Simulate assigned mesh index

        gameObject.addComponent(meshRenderer1);
        gameObject.addComponent(meshRenderer2);

        expect(gameObject.getComponent(MeshRenderer)).toBe(meshRenderer2);
        expect(gameObject.getAllComponents()).toHaveLength(2); // Transform + MeshRenderer
    });

    test('should provide convenience accessor for MeshRenderer', () => {
        const gameObject = new GameObject();
        const meshRenderer = new MeshRenderer('cube');

        gameObject.addComponent(meshRenderer);

        expect(gameObject.getMeshRenderer()).toBe(meshRenderer);
    });

    test('should handle active state', () => {
        const gameObject = new GameObject();

        expect(gameObject.isActive()).toBe(true);

        gameObject.setActive(false);
        expect(gameObject.isActive()).toBe(false);
    });

    describe('Factory Methods', () => {
        test('should create cube GameObject', () => {
            const cube = GameObject.createCube('TestCube', { x: 1, y: 2, z: 3 });

            expect(cube.name).toBe('TestCube');
            expect(cube.transform.position).toEqual({ x: 1, y: 2, z: 3 });
            expect(cube.getMeshRenderer()?.meshId).toBe('cube');
            expect(cube.getMeshRenderer()?.renderMode).toBe('triangles');
        });

        test('should create sphere GameObject', () => {
            const sphere = GameObject.createSphere('TestSphere');

            expect(sphere.name).toBe('TestSphere');
            expect(sphere.getMeshRenderer()?.meshId).toBe('sphere');
        });

        test('should create grid GameObject', () => {
            const grid = GameObject.createGrid('TestGrid');

            expect(grid.name).toBe('TestGrid');
            expect(grid.getMeshRenderer()?.meshId).toBe('grid');
            expect(grid.getMeshRenderer()?.renderMode).toBe('lines');
            expect(grid.getMeshRenderer()?.color).toEqual({ x: 1, y: 1, z: 0, w: 1 }); // Yellow
        });
    });
});

describe('Scene System (v2)', () => {
    let scene: Scene;

    beforeEach(() => {
        scene = new Scene();
    });

    test('should create scene with default camera', () => {
        expect(scene.camera).toBeDefined();
        expect(scene.camera.getPosition()).toEqual([0, 5, -10]);
    });

    test('should add and retrieve GameObjects', () => {
        const gameObject = new GameObject('test-obj');

        scene.addGameObject(gameObject);

        expect(scene.getGameObject('test-obj')).toBe(gameObject);
        expect(scene.getAllGameObjects()).toContain(gameObject);
        expect(scene.getEntityCount()).toBe(1);
    });

    test('should remove GameObjects', () => {
        const gameObject = new GameObject('test-obj');

        scene.addGameObject(gameObject);
        const removed = scene.removeGameObject('test-obj');

        expect(removed).toBe(true);
        expect(scene.getGameObject('test-obj')).toBeNull();
        expect(scene.getEntityCount()).toBe(0);
    });

    test('should handle hierarchy relationships', () => {
        const parent = new GameObject('parent');
        const child = new GameObject('child');

        scene.addGameObject(parent);
        scene.addGameObject(child);

        parent.addChild(child);

        expect(child.parentId).toBe('parent');
        expect(parent.childIds).toContain('child');
        expect(child.getParent()).toBe(parent);
        expect(parent.getChildren()).toContain(child);
    });

    test('should remove children when parent is removed', () => {
        const parent = new GameObject('parent');
        const child = new GameObject('child');

        scene.addGameObject(parent);
        scene.addGameObject(child);
        parent.addChild(child);

        scene.removeGameObject('parent');

        expect(scene.getGameObject('parent')).toBeNull();
        expect(scene.getGameObject('child')).toBeNull();
        expect(scene.getEntityCount()).toBe(0);
    });

    test('should find GameObjects by name', () => {
        const gameObject = new GameObject('unique-id', 'TestObject');
        scene.addGameObject(gameObject);

        expect(scene.findGameObjectByName('TestObject')).toBe(gameObject);
        expect(scene.findGameObjectByName('NonExistent')).toBeNull();
    });

    test('should find GameObjects by tag', () => {
        const obj1 = new GameObject('obj1');
        const obj2 = new GameObject('obj2');
        obj1.tag = 'enemy';
        obj2.tag = 'enemy';

        scene.addGameObject(obj1);
        scene.addGameObject(obj2);

        const enemies = scene.findGameObjectsByTag('enemy');
        expect(enemies).toHaveLength(2);
        expect(enemies).toContain(obj1);
        expect(enemies).toContain(obj2);
    });

    test('should generate unique entity IDs', () => {
        const id1 = scene.generateEntityId();
        const id2 = scene.generateEntityId();

        expect(id1).toBeDefined();
        expect(id2).toBeDefined();
        expect(id1).not.toBe(id2);
    });

    // this is how we want to use it eventually
    // but now this requires renderer
    // and wasm bridge initialization...
    test.skip('should provide scene info', () => {
        const gameObject = new GameObject();
        scene.addGameObject(gameObject);

        const info = scene.getSceneInfo();

        expect(info.entityCount).toBe(1);
        expect(info.cameraPosition).toEqual([0, 5, -10]);
    });
});
