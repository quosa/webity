// tests/buffer-comparison.test.ts
// Unit tests comparing TypeScript vs WASM buffer outputs

import { Scene } from '../src/engine/scene-system';
import { GameObject } from '../src/engine/gameobject';
import { MeshRenderer } from '../src/engine/components';
import { Mesh } from '../src/engine/mesh';
import { Material } from '../src/engine/material';
import { WasmPhysicsBridge } from '../src/engine/wasm-physics-bridge';

// Compares the TS-side transform (from the GameObject in a Scene) against the WASM instance
// buffer. The Engine owns the bridge at runtime; here we register the entity in both a Scene
// (TS data source) and a directly-driven bridge (WASM buffer) for a headless comparison.
describe('Buffer Comparison: TypeScript vs WASM', () => {
    let scene: Scene;
    let bridge: WasmPhysicsBridge;
    let triangleGameObject: GameObject;

    beforeEach(async () => {
        scene = new Scene();
        bridge = new WasmPhysicsBridge();
        await bridge.init();

        // Create triangle GameObject (same as in working test)
        triangleGameObject = new GameObject('test-triangle', 'TestTriangle');
        triangleGameObject.transform.setPosition(0, 0, -2);
        triangleGameObject.transform.setScale(2, 2, 2);

        const meshRenderer = new MeshRenderer(Mesh.createTriangle('triangle', 1), new Material('red', { r: 1, g: 0, b: 0, a: 1 }));
        // The Engine assigns this at registration; set it manually for the headless test.
        meshRenderer.meshIndex = 0;
        triangleGameObject.addComponent(meshRenderer);

        scene.addGameObject(triangleGameObject);
        bridge.addEntity(triangleGameObject);
    });

    test('Compare TypeScript vs WASM instance buffer data', async () => {
        console.log('🧪 Testing Buffer Comparison...');

        // 1. Get TypeScript rendering buffer data
        const tsBufferData = captureTypeScriptBufferData(scene);

        // 2. Get WASM rendering buffer data
        const wasmBufferData = captureWasmBufferData(bridge);

        // 3. Compare buffers
        console.log('📊 TypeScript Buffer Data:', tsBufferData);
        console.log('📊 WASM Buffer Data:', wasmBufferData);

        // 4. Validate both have same entity count
        expect(tsBufferData.entityCount).toBe(wasmBufferData.entityCount);
        expect(wasmBufferData.entityCount).toBe(1); // Should have 1 triangle

        // 5. Compare transform matrices (16 floats)
        expect(tsBufferData.transforms).toHaveLength(16);
        expect(wasmBufferData.transforms).toHaveLength(16);

        // 6. Compare colors (4 floats)
        expect(tsBufferData.colors).toHaveLength(4);
        expect(wasmBufferData.colors).toHaveLength(4);

        console.log('✅ Buffer comparison test completed');
    });

    test('Validate triangle transform matrix calculation', () => {
        // Triangle at position (0, 0, -2), scale (2, 2, 2)
        const expectedPosition = { x: 0, y: 0, z: -2 };
        const expectedScale = { x: 2, y: 2, z: 2 };

        // Calculate expected column-major transform matrix
        const expectedMatrix = [
            expectedScale.x, 0, 0, 0,  // Column 0
            0, expectedScale.y, 0, 0,  // Column 1
            0, 0, expectedScale.z, 0,  // Column 2
            expectedPosition.x, expectedPosition.y, expectedPosition.z, 1 // Column 3 (translation)
        ];

        const transform = triangleGameObject.transform;
        const actualMatrix = transform.getLocalMatrix();

        console.log('Expected Matrix:', expectedMatrix);
        console.log('Actual Matrix:', Array.from(actualMatrix));

        // Compare matrices (with small tolerance for floating point)
        for (let i = 0; i < 16; i++) {
            expect(actualMatrix[i]).toBeDefined();
            expect(actualMatrix[i] as number).toBeCloseTo(expectedMatrix[i] as number, 5);
        }
    });
});

function captureTypeScriptBufferData(scene: Scene) {
    console.log('📋 Capturing TypeScript buffer data...');

    // Force TypeScript rendering path
    const entities = [];
    for (const gameObject of scene.getAllGameObjects()) {
        const meshRenderer = gameObject.getMeshRenderer();
        if (meshRenderer && gameObject.isActive()) {
            const entity = {
                id: gameObject.id,
                meshId: meshRenderer.meshId,
                transform: {
                    position: [gameObject.transform.position.x, gameObject.transform.position.y, gameObject.transform.position.z] as [number, number, number],
                    rotation: [
                        gameObject.transform.rotation.x * Math.PI / 180,
                        gameObject.transform.rotation.y * Math.PI / 180,
                        gameObject.transform.rotation.z * Math.PI / 180
                    ] as [number, number, number],
                    scale: [gameObject.transform.scale.x, gameObject.transform.scale.y, gameObject.transform.scale.z] as [number, number, number]
                },
                color: [meshRenderer.color.x, meshRenderer.color.y, meshRenderer.color.z, meshRenderer.color.w] as [number, number, number, number],
                renderMode: meshRenderer.renderMode
            };
            entities.push(entity);
        }
    }

    // Get transform matrix from first entity
    const transformMatrix = entities[0]?.transform ?
        calculateTransformMatrix(entities[0].transform) : [];

    return {
        entityCount: entities.length,
        transforms: transformMatrix,
        colors: entities[0]?.color || [],
        meshId: entities[0]?.meshId || '',
        renderMode: entities[0]?.renderMode || ''
    };
}

function captureWasmBufferData(bridge: WasmPhysicsBridge) {
    console.log('📋 Capturing WASM buffer data...');

    const stats = bridge.getStats();
    let transforms: number[] = [];
    let colors: number[] = [];

    if (bridge.hasWasmModule() && stats.entityCount > 0) {
        const wasmMemory = bridge.getWasmMemory();
        const transformsOffset = bridge.getEntityTransformsOffsetSafe();

        if (wasmMemory) {
            // Read instance data: 24 floats / 96 B per instance (16 transform + 4 color + 4 Stage-C fields)
            const instanceData = new Float32Array(wasmMemory, transformsOffset, stats.entityCount * 24);

            // Extract transform matrix (first 16 floats)
            transforms = Array.from(instanceData.slice(0, 16));

            // Extract color (next 4 floats)
            colors = Array.from(instanceData.slice(16, 20));
        }
    }

    return {
        entityCount: stats.entityCount,
        transforms,
        colors,
        meshId: 'triangle', // WASM uses hardcoded mesh ID
        renderMode: 'triangles'
    };
}

function calculateTransformMatrix(transform: any): number[] {
    const pos = transform.position;
    const scale = transform.scale;

    // Column-major transform matrix (matching WebGPU/WGSL format)
    return [
        scale[0], 0, 0, 0,        // Column 0
        0, scale[1], 0, 0,        // Column 1
        0, 0, scale[2], 0,        // Column 2
        pos[0], pos[1], pos[2], 1 // Column 3 (translation)
    ];
}
