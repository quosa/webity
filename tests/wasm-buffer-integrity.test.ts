// tests/wasm-buffer-integrity.test.ts
// Unit test for WASM buffer data integrity - validates entity data without GPU rendering

import { Scene } from '../src/scene-system';
import { GameObject } from '../src/gameobject';
import { MeshRenderer } from '../src/components';
import { WebGPURendererV2 } from '../src/webgpu.renderer';
import { createTriangleMesh, createCubeMesh } from '../src/mesh-utils';
import { setupWebGPUTestEnvironment, WebGPUMockFactory } from './utils/webgpu-mocks';

// Set up WebGPU mocking environment
setupWebGPUTestEnvironment();

// Mock canvas context
const mockCanvas = WebGPUMockFactory.createMockCanvas();

describe('WASM Buffer Integrity Tests', () => {
    let renderer: WebGPURendererV2;
    let scene: Scene;

    beforeEach(async () => {
        // Create renderer and scene
        renderer = new WebGPURendererV2();
        await renderer.init(mockCanvas as any);

        // Register triangle and cube meshes
        renderer.registerMesh('triangle', createTriangleMesh());
        renderer.registerMesh('cube', createCubeMesh(1));

        scene = new Scene();
    });

    test('Single triangle entity WASM buffer data integrity', async () => {
        console.log('🔍 Testing single triangle entity WASM buffer integrity...');

        // Create single triangle
        const triangle = new GameObject('test-triangle', 'Triangle');
        triangle.transform.setPosition(-2, 1, 0);
        triangle.transform.setScale(1.5, 1.5, 1.5);

        const meshRenderer = new MeshRenderer('triangle', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 }); // Red
        // this is normally done by Scene when adding GameObject
        meshRenderer.meshIndex = 0; // Simulate assigned mesh index
        triangle.addComponent(meshRenderer);

        scene.addGameObject(triangle);
        await scene.init(renderer);

        // Get WASM buffer data
        const stats = scene.physicsBridge.getStats();
        expect(stats.entityCount).toBe(1);
        expect(stats.isInitialized).toBe(true);

        if (scene.physicsBridge.hasWasmModule()) {
            const wasmMemory = scene.physicsBridge.getWasmMemory();
            const transformsOffset = scene.physicsBridge.getEntityTransformsOffsetSafe();

            expect(wasmMemory).not.toBeNull();

            if (wasmMemory) {
                // Read instance data: 20 floats per entity (16 transform + 4 color)
                const instanceData = new Float32Array(wasmMemory, transformsOffset, 1 * 20);

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

        const triangleMeshRenderer = new MeshRenderer('triangle', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 }); // Red
        // this is normally done by Scene when adding GameObject
        triangleMeshRenderer.meshIndex = 0; // Simulate assigned mesh index
        triangle.addComponent(triangleMeshRenderer);
        scene.addGameObject(triangle);

        // Create cube entity
        const cube = new GameObject('test-cube', 'Cube');
        cube.transform.setPosition(2, 0, 0);
        cube.transform.setScale(1, 1, 1);

        const cubeMeshRenderer = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 0, z: 1, w: 1 }); // Blue
        // this is normally done by Scene when adding GameObject
        cubeMeshRenderer.meshIndex = 1; // Simulate assigned mesh index
        cube.addComponent(cubeMeshRenderer);
        scene.addGameObject(cube);

        // Initialize scene
        await scene.init(renderer);

        // Validate WASM stats
        const stats = scene.physicsBridge.getStats();
        expect(stats.entityCount).toBe(2);
        expect(stats.isInitialized).toBe(true);

        if (scene.physicsBridge.hasWasmModule()) {
            const wasmMemory = scene.physicsBridge.getWasmMemory();
            const transformsOffset = scene.physicsBridge.getEntityTransformsOffsetSafe();

            expect(wasmMemory).not.toBeNull();

            if (wasmMemory) {
                // Read instance data: 20 floats per entity (16 transform + 4 color)
                const instanceData = new Float32Array(wasmMemory, transformsOffset, 2 * 20);

                console.log('Raw WASM buffer data (40 floats):', Array.from(instanceData));

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
                const entity1Transform = Array.from(instanceData.slice(20, 36));
                const entity1Color = Array.from(instanceData.slice(36, 40));

                console.log('Entity 1 (Cube):');
                console.log('  Transform:', entity1Transform);
                console.log('  Color:', entity1Color);
                console.log('  Position from matrix:', [entity1Transform[12], entity1Transform[13], entity1Transform[14]]);

                // Validate Entity 1 transform (identity with translation)
                const expectedMatrix1 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1];
                for (let i = 0; i < 16; i++) {
                    expect(instanceData[20 + i]!).toBeCloseTo(expectedMatrix1[i]!, 5);
                }

                // Validate Entity 1 color (blue)
                const expectedColor1 = [0, 0, 1, 1];
                for (let i = 0; i < 4; i++) {
                    expect(instanceData[36 + i]!).toBeCloseTo(expectedColor1[i]!, 5);
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
                i % 2 === 0 ? 'triangle' : 'cube',
                'default',
                'triangles',
                { x: i * 0.2, y: (5 - i) * 0.2, z: 0.5, w: 1 }
            );
            // this is normally done by Scene when adding GameObject
            meshRenderer.meshIndex = 0; // Simulate assigned mesh index
            entity.addComponent(meshRenderer);
            scene.addGameObject(entity);
        }

        await scene.init(renderer);

        const stats = scene.physicsBridge.getStats();
        expect(stats.entityCount).toBe(5);

        if (scene.physicsBridge.hasWasmModule()) {
            const wasmMemory = scene.physicsBridge.getWasmMemory();
            const transformsOffset = scene.physicsBridge.getEntityTransformsOffsetSafe();

            expect(wasmMemory).not.toBeNull();

            if (wasmMemory) {
                // Validate buffer bounds
                const requiredBytes = 5 * 20 * 4; // 5 entities * 20 floats * 4 bytes per float
                const availableBytes = wasmMemory.byteLength - transformsOffset;

                expect(availableBytes).toBeGreaterThanOrEqual(requiredBytes);

                // Read and validate each entity's data is not corrupted
                const instanceData = new Float32Array(wasmMemory, transformsOffset, 5 * 20);

                for (let i = 0; i < 5; i++) {
                    const offset = i * 20;
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
