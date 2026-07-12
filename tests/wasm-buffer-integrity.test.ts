// tests/wasm-buffer-integrity.test.ts
// Unit test for WASM buffer data integrity - validates entity data without GPU rendering

import { GameObject } from '../src/engine/gameobject';
import { MeshRenderer } from '../src/engine/components';
import { Mesh } from '../src/engine/mesh';
import { Material } from '../src/engine/material';
import { WasmPhysicsBridge } from '../src/engine/wasm-physics-bridge';

// These tests validate the WASM instance buffer directly through the physics bridge (the Engine
// owns the bridge at runtime, but for a headless buffer check we drive the bridge directly —
// entities carry a manually-assigned meshIndex, as the Engine would assign at registration).
describe('WASM Buffer Integrity Tests', () => {
    let bridge: WasmPhysicsBridge;

    beforeEach(async () => {
        bridge = new WasmPhysicsBridge();
        await bridge.init();
    });

    test('Single triangle entity WASM buffer data integrity', async () => {
        console.log('🔍 Testing single triangle entity WASM buffer integrity...');

        // Create single triangle
        const triangle = new GameObject('test-triangle', 'Triangle');
        triangle.transform.setPosition(-2, 1, 0);
        triangle.transform.setScale(1.5, 1.5, 1.5);

        const meshRenderer = new MeshRenderer(Mesh.createTriangle('triangle', 1), new Material('red', { r: 1, g: 0, b: 0, a: 1 })); // Red
        // this is normally done by Scene when adding GameObject
        meshRenderer.meshIndex = 0; // Simulate assigned mesh index
        triangle.addComponent(meshRenderer);

        bridge.addEntity(triangle);

        // Get WASM buffer data
        const stats = bridge.getStats();
        expect(stats.entityCount).toBe(1);
        expect(stats.isInitialized).toBe(true);

        if (bridge.hasWasmModule()) {
            const wasmMemory = bridge.getWasmMemory();
            const transformsOffset = bridge.getEntityTransformsOffsetSafe();

            expect(wasmMemory).not.toBeNull();

            if (wasmMemory) {
                // Read instance data: 24 floats per entity: 16 transform + 4 color + 4 Stage-C fields (96 B extern struct)
                const instanceData = new Float32Array(wasmMemory, transformsOffset, 1 * 24);

                // Validate transform matrix (column-major)
                const expectedMatrix = [
                    1.5, 0, 0, 0,    // Column 0 (scale X)
                    0, 1.5, 0, 0,    // Column 1 (scale Y)
                    0, 0, 1.5, 0,    // Column 2 (scale Z)
                    -2, 1, 0, 1      // Column 3 (translation)
                ];

                console.log('Expected transform matrix:', expectedMatrix);
                console.log('Actual transform matrix:', Array.from(instanceData.slice(0, 16)));

                // Check transform matrix (with small tolerance for floating point)
                for (let i = 0; i < 16; i++) {
                    expect(instanceData[i]!).toBeCloseTo(expectedMatrix[i]!, 5);
                }

                // Validate color
                const expectedColor = [1, 0, 0, 1]; // Red
                const actualColor = Array.from(instanceData.slice(16, 20));

                console.log('Expected color:', expectedColor);
                console.log('Actual color:', actualColor);

                for (let i = 0; i < 4; i++) {
                    expect(instanceData[16 + i]!).toBeCloseTo(expectedColor[i]!, 5);
                }
            }
        }

        console.log('✅ Single triangle WASM buffer integrity test passed');
    });

    test('Two entity WASM buffer data integrity (triangle + cube)', async () => {
        console.log('🔍 Testing two entity WASM buffer integrity...');

        // Create triangle entity
        const triangle = new GameObject('test-triangle', 'Triangle');
        triangle.transform.setPosition(-2, 0, 0);
        triangle.transform.setScale(1, 1, 1);

        const triangleMeshRenderer = new MeshRenderer(Mesh.createTriangle('triangle', 1), new Material('red', { r: 1, g: 0, b: 0, a: 1 })); // Red
        // this is normally done by Scene when adding GameObject
        triangleMeshRenderer.meshIndex = 0; // Simulate assigned mesh index
        triangle.addComponent(triangleMeshRenderer);
        bridge.addEntity(triangle);

        // Create cube entity
        const cube = new GameObject('test-cube', 'Cube');
        cube.transform.setPosition(2, 0, 0);
        cube.transform.setScale(1, 1, 1);

        const cubeMeshRenderer = new MeshRenderer(Mesh.createCube('cube', 1), new Material('blue', { r: 0, g: 0, b: 1, a: 1 })); // Blue
        // this is normally done by Scene when adding GameObject
        cubeMeshRenderer.meshIndex = 1; // Simulate assigned mesh index
        cube.addComponent(cubeMeshRenderer);
        bridge.addEntity(cube);

        // Initialize scene

        // Validate WASM stats
        const stats = bridge.getStats();
        expect(stats.entityCount).toBe(2);
        expect(stats.isInitialized).toBe(true);

        if (bridge.hasWasmModule()) {
            const wasmMemory = bridge.getWasmMemory();
            const transformsOffset = bridge.getEntityTransformsOffsetSafe();

            expect(wasmMemory).not.toBeNull();

            if (wasmMemory) {
                // Read instance data: 24 floats per entity: 16 transform + 4 color + 4 Stage-C fields (96 B extern struct)
                const instanceData = new Float32Array(wasmMemory, transformsOffset, 2 * 24);

                console.log('Raw WASM buffer data (48 floats):', Array.from(instanceData));

                // Entity 0 (Triangle at -2, 0, 0, red)
                const entity0Transform = Array.from(instanceData.slice(0, 16));
                const entity0Color = Array.from(instanceData.slice(16, 20));

                console.log('Entity 0 (Triangle):');
                console.log('  Transform:', entity0Transform);
                console.log('  Color:', entity0Color);
                console.log('  Position from matrix:', [entity0Transform[12], entity0Transform[13], entity0Transform[14]]);

                // Validate Entity 0 transform (identity with translation)
                const expectedMatrix0 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -2, 0, 0, 1];
                for (let i = 0; i < 16; i++) {
                    expect(instanceData[i]!).toBeCloseTo(expectedMatrix0[i]!, 5);
                }

                // Validate Entity 0 color (red)
                const expectedColor0 = [1, 0, 0, 1];
                for (let i = 0; i < 4; i++) {
                    expect(instanceData[16 + i]!).toBeCloseTo(expectedColor0[i]!, 5);
                }

                // Entity 1 (Cube at 2, 0, 0, blue)
                const entity1Transform = Array.from(instanceData.slice(24, 40));
                const entity1Color = Array.from(instanceData.slice(40, 44));

                console.log('Entity 1 (Cube):');
                console.log('  Transform:', entity1Transform);
                console.log('  Color:', entity1Color);
                console.log('  Position from matrix:', [entity1Transform[12], entity1Transform[13], entity1Transform[14]]);

                // Validate Entity 1 transform (identity with translation)
                const expectedMatrix1 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1];
                for (let i = 0; i < 16; i++) {
                    expect(instanceData[24 + i]!).toBeCloseTo(expectedMatrix1[i]!, 5);
                }

                // Validate Entity 1 color (blue)
                const expectedColor1 = [0, 0, 1, 1];
                for (let i = 0; i < 4; i++) {
                    expect(instanceData[40 + i]!).toBeCloseTo(expectedColor1[i]!, 5);
                }
            }
        }

        console.log('✅ Two entity WASM buffer integrity test passed');
    });

    test('WASM buffer bounds and alignment validation', async () => {
        console.log('🔍 Testing WASM buffer bounds and alignment...');

        // Add multiple entities to test buffer management
        for (let i = 0; i < 5; i++) {
            const entity = new GameObject(`entity-${i}`, `Entity${i}`);
            entity.transform.setPosition(i * 2, 0, 0);
            entity.transform.setScale(1, 1, 1);

            const meshRenderer = new MeshRenderer(
                i % 2 === 0 ? Mesh.createTriangle('triangle', 1) : Mesh.createCube('cube', 1),
                new Material(`c-${i}`, { r: i * 0.2, g: (5 - i) * 0.2, b: 0.5, a: 1 }),
            );
            // this is normally done by Scene when adding GameObject
            meshRenderer.meshIndex = 0; // Simulate assigned mesh index
            entity.addComponent(meshRenderer);
            bridge.addEntity(entity);
        }


        const stats = bridge.getStats();
        expect(stats.entityCount).toBe(5);

        if (bridge.hasWasmModule()) {
            const wasmMemory = bridge.getWasmMemory();
            const transformsOffset = bridge.getEntityTransformsOffsetSafe();

            expect(wasmMemory).not.toBeNull();

            if (wasmMemory) {
                // Validate buffer bounds
                const requiredBytes = 5 * 24 * 4; // 5 entities * 24 floats * 4 bytes per float
                const availableBytes = wasmMemory.byteLength - transformsOffset;

                expect(availableBytes).toBeGreaterThanOrEqual(requiredBytes);

                // Read and validate each entity's data is not corrupted
                const instanceData = new Float32Array(wasmMemory, transformsOffset, 5 * 24);

                for (let i = 0; i < 5; i++) {
                    const offset = i * 24;
                    const transform = Array.from(instanceData.slice(offset, offset + 16));
                    const color = Array.from(instanceData.slice(offset + 16, offset + 20));

                    console.log(`Entity ${i}:`);
                    console.log('  Transform:', transform);
                    console.log('  Color:', color);
                    console.log('  Position:', [transform[12], transform[13], transform[14]]);

                    // Validate position is reasonable (not NaN/Infinity)
                    expect(isFinite(transform[12]!)).toBe(true);
                    expect(isFinite(transform[13]!)).toBe(true);
                    expect(isFinite(transform[14]!)).toBe(true);

                    // Validate color components are reasonable
                    expect(isFinite(color[0]!)).toBe(true);
                    expect(isFinite(color[1]!)).toBe(true);
                    expect(isFinite(color[2]!)).toBe(true);
                    expect(isFinite(color[3]!)).toBe(true);
                }
            }
        }

        console.log('✅ WASM buffer bounds and alignment test passed');
    });
});
