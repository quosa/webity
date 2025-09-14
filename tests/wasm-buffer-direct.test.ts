// tests/wasm-buffer-direct.test.ts
// Direct WASM buffer validation without WebGPU complexity

import { WasmPhysicsBridge } from '../src/wasm-physics-bridge';
import { GameObject } from '../src/gameobject';
import { MeshRenderer } from '../src/components';

describe('Direct WASM Buffer Tests', () => {
    let physicsBridge: WasmPhysicsBridge;

    beforeEach(async () => {
        physicsBridge = new WasmPhysicsBridge();
        await physicsBridge.init(); // Initialize with real WASM
    });

    test('Single entity WASM buffer integrity', async () => {
        console.log('🔍 Testing single entity WASM buffer...');

        // Create single triangle entity
        const triangle = new GameObject('test-triangle', 'Triangle');
        triangle.transform.setPosition(-2, 1, 0);
        triangle.transform.setScale(1.5, 1.5, 1.5);

        const meshRenderer = new MeshRenderer('triangle', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 }); // Red
        meshRenderer.meshIndex = 0; // Simulate assigned mesh index
        triangle.addComponent(meshRenderer);

        // Add to WASM
        const wasmEntityId = physicsBridge.addEntity(triangle);
        expect(wasmEntityId).not.toBeNull();

        // Validate WASM stats
        const stats = physicsBridge.getStats();
        expect(stats.entityCount).toBe(1);
        expect(stats.isInitialized).toBe(true);

        // Read WASM buffer directly
        if (physicsBridge.hasWasmModule()) {
            const wasmMemory = physicsBridge.getWasmMemory();
            const transformsOffset = physicsBridge.getEntityTransformsOffsetSafe();

            expect(wasmMemory).not.toBeNull();

            if (wasmMemory) {
                // Read instance data: 20 floats per entity (16 transform + 4 color)
                const instanceData = new Float32Array(wasmMemory, transformsOffset, 1 * 20);

                // Expected transform matrix (column-major)
                const expectedMatrix = [
                    1.5, 0, 0, 0,    // Column 0 (scale X)
                    0, 1.5, 0, 0,    // Column 1 (scale Y)
                    0, 0, 1.5, 0,    // Column 2 (scale Z)
                    -2, 1, 0, 1      // Column 3 (translation)
                ];

                const actualMatrix = Array.from(instanceData.slice(0, 16));
                console.log('Expected transform:', expectedMatrix);
                console.log('Actual transform:', actualMatrix);

                // Validate transform matrix
                for (let i = 0; i < 16; i++) {
                    expect(instanceData[i]!).toBeCloseTo(expectedMatrix[i]!, 5);
                }

                // Validate color (red)
                const expectedColor = [1, 0, 0, 1];
                const actualColor = Array.from(instanceData.slice(16, 20));
                console.log('Expected color:', expectedColor);
                console.log('Actual color:', actualColor);

                for (let i = 0; i < 4; i++) {
                    expect(instanceData[16 + i]!).toBeCloseTo(expectedColor[i]!, 5);
                }
            }
        }

        console.log('✅ Single entity WASM buffer test passed');
    });

    test('Two entity WASM buffer integrity', async () => {
        console.log('🔍 Testing two entity WASM buffer...');

        // Entity 1: Triangle at (-2, 0, 0), red
        const triangle = new GameObject('test-triangle', 'Triangle');
        triangle.transform.setPosition(-2, 0, 0);
        triangle.transform.setScale(1, 1, 1);
        const triangleMeshRenderer = new MeshRenderer('triangle', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 });
        triangleMeshRenderer.meshIndex = 0; // Simulate assigned mesh index
        triangle.addComponent(triangleMeshRenderer);

        // Entity 2: Cube at (2, 0, 0), blue
        const cube = new GameObject('test-cube', 'Cube');
        cube.transform.setPosition(2, 0, 0);
        cube.transform.setScale(1, 1, 1);
        const cubeMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 0, z: 1, w: 1 });
        cubeMeshRenderer.meshIndex = 1; // Simulate assigned mesh index
        cube.addComponent(cubeMeshRenderer);

        // Add to WASM
        const triangleId = physicsBridge.addEntity(triangle);
        const cubeId = physicsBridge.addEntity(cube);

        expect(triangleId).not.toBeNull();
        expect(cubeId).not.toBeNull();

        // Validate WASM stats
        const stats = physicsBridge.getStats();
        expect(stats.entityCount).toBe(2);

        // Read WASM buffer directly
        if (physicsBridge.hasWasmModule()) {
            const wasmMemory = physicsBridge.getWasmMemory();
            const transformsOffset = physicsBridge.getEntityTransformsOffsetSafe();

            if (wasmMemory) {
                // Read 2 entities: 40 floats total (20 per entity)
                const instanceData = new Float32Array(wasmMemory, transformsOffset, 2 * 20);

                console.log('Raw WASM buffer (40 floats):', Array.from(instanceData));

                // Entity 0 (Triangle): Expected at (-2, 0, 0), red
                const entity0Transform = Array.from(instanceData.slice(0, 16));
                const entity0Color = Array.from(instanceData.slice(16, 20));

                console.log('Entity 0 (Triangle):');
                console.log('  Transform:', entity0Transform);
                console.log('  Color:', entity0Color);
                console.log('  Position:', [entity0Transform[12], entity0Transform[13], entity0Transform[14]]);

                // Validate Entity 0
                const expectedMatrix0 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -2, 0, 0, 1];
                const expectedColor0 = [1, 0, 0, 1];

                for (let i = 0; i < 16; i++) {
                    expect(instanceData[i]!).toBeCloseTo(expectedMatrix0[i]!, 5);
                }
                for (let i = 0; i < 4; i++) {
                    expect(instanceData[16 + i]!).toBeCloseTo(expectedColor0[i]!, 5);
                }

                // Entity 1 (Cube): Expected at (2, 0, 0), blue
                const entity1Transform = Array.from(instanceData.slice(20, 36));
                const entity1Color = Array.from(instanceData.slice(36, 40));

                console.log('Entity 1 (Cube):');
                console.log('  Transform:', entity1Transform);
                console.log('  Color:', entity1Color);
                console.log('  Position:', [entity1Transform[12], entity1Transform[13], entity1Transform[14]]);

                // Validate Entity 1
                const expectedMatrix1 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1];
                const expectedColor1 = [0, 0, 1, 1];

                for (let i = 0; i < 16; i++) {
                    expect(instanceData[20 + i]!).toBeCloseTo(expectedMatrix1[i]!, 5);
                }
                for (let i = 0; i < 4; i++) {
                    expect(instanceData[36 + i]!).toBeCloseTo(expectedColor1[i]!, 5);
                }
            }
        }

        console.log('✅ Two entity WASM buffer test passed');
    });

    test('Multiple entity buffer corruption detection', async () => {
        console.log('🔍 Testing multiple entity buffer corruption...');

        // Add 5 entities with clear, different data
        const entities = [];
        for (let i = 0; i < 5; i++) {
            const entity = new GameObject(`entity-${i}`, `Entity${i}`);
            entity.transform.setPosition(i * 2, i, 0); // Different positions
            entity.transform.setScale(1 + i * 0.1, 1 + i * 0.1, 1); // Different scales

            const meshRenderer = new MeshRenderer(
                i % 2 === 0 ? 'triangle' : 'cube',
                'default',
                'triangles',
                { x: i * 0.2, y: (4 - i) * 0.25, z: 0.5, w: 1 } // Different colors
            );
            meshRenderer.meshIndex = 0; // Simulate assigned mesh index
            entity.addComponent(meshRenderer);
            entities.push(entity);

            const wasmId = physicsBridge.addEntity(entity);
            expect(wasmId).not.toBeNull();
        }

        const stats = physicsBridge.getStats();
        expect(stats.entityCount).toBe(5);

        // Validate each entity's buffer data
        if (physicsBridge.hasWasmModule()) {
            const wasmMemory = physicsBridge.getWasmMemory();
            const transformsOffset = physicsBridge.getEntityTransformsOffsetSafe();

            if (wasmMemory) {
                const instanceData = new Float32Array(wasmMemory, transformsOffset, 5 * 20);

                for (let i = 0; i < 5; i++) {
                    const offset = i * 20;
                    const transform = Array.from(instanceData.slice(offset, offset + 16));
                    const color = Array.from(instanceData.slice(offset + 16, offset + 20));

                    console.log(`Entity ${i}:`);
                    console.log('  Expected position:', [i * 2, i, 0]);
                    console.log('  Actual position:', [transform[12], transform[13], transform[14]]);
                    console.log('  Transform:', transform);
                    console.log('  Color:', color);

                    // Validate position matches expected
                    expect(transform[12]!).toBeCloseTo(i * 2, 3); // X position
                    expect(transform[13]!).toBeCloseTo(i, 3);     // Y position
                    expect(transform[14]!).toBeCloseTo(0, 3);     // Z position

                    // Validate all values are finite (not corrupted)
                    for (let j = 0; j < 16; j++) {
                        expect(isFinite(transform[j]!)).toBe(true);
                    }
                    for (let j = 0; j < 4; j++) {
                        expect(isFinite(color[j]!)).toBe(true);
                    }
                }
            }
        }

        console.log('✅ Multiple entity buffer test passed');
    });
});
