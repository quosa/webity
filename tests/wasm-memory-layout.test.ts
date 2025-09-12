// tests/wasm-memory-layout.test.ts
// Debug test to understand WASM entity memory layout

import { WasmPhysicsBridge } from '../src/v2/wasm-physics-bridge';
import { GameObject } from '../src/v2/gameobject';
import { MeshRenderer } from '../src/v2/components';

describe('WASM Memory Layout Debug', () => {
    let physicsBridge: WasmPhysicsBridge;

    beforeEach(async () => {
        physicsBridge = new WasmPhysicsBridge();
        await physicsBridge.init();
    });

    test('Entity memory layout analysis', async () => {
        console.log('🔍 Analyzing WASM entity memory layout...');

        // Add two entities
        const entity1 = new GameObject('entity1', 'Entity1');
        entity1.transform.setPosition(-2, 0, 0);
        entity1.transform.setScale(1, 1, 1);
        const meshRenderer1 = new MeshRenderer('triangle', 'default', 'triangles', { x: 1, y: 0, z: 0, w: 1 });
        entity1.addComponent(meshRenderer1);

        const entity2 = new GameObject('entity2', 'Entity2');
        entity2.transform.setPosition(2, 0, 0);
        entity2.transform.setScale(1, 1, 1);
        const meshRenderer2 = new MeshRenderer('cube', 'default', 'triangles', { x: 0, y: 0, z: 1, w: 1 });
        entity2.addComponent(meshRenderer2);

        // Add to WASM
        physicsBridge.addEntity(entity1);
        physicsBridge.addEntity(entity2);

        if (physicsBridge.hasWasmModule()) {
            const wasm = physicsBridge['wasm'] as any; // Access private WASM module

            console.log('🧮 WASM Entity Layout Analysis:');
            console.log('  Entity struct size:', wasm.get_entity_size(), 'bytes');
            console.log('  Entity stride:', wasm.get_entity_stride(), 'bytes');
            console.log('  Expected GPU data size per entity:', 20 * 4, 'bytes (20 floats)');

            const entityStride = wasm.get_entity_stride();
            const expectedGpuSize = 20 * 4; // 20 floats * 4 bytes per float

            console.log('📊 Layout Analysis:');
            if (entityStride === expectedGpuSize) {
                console.log('  ✅ Entity stride matches expected GPU data size');
            } else {
                console.log('  ❌ Entity stride mismatch!');
                console.log('    Expected:', expectedGpuSize, 'bytes');
                console.log('    Actual:', entityStride, 'bytes');
                console.log('    Extra bytes per entity:', entityStride - expectedGpuSize);
            }

            // Check if transform matrices are at correct positions
            const wasmMemory = physicsBridge.getWasmMemory();
            const transformsOffset = physicsBridge.getEntityTransformsOffsetSafe();

            if (wasmMemory) {
                console.log('🎯 Memory Address Analysis:');
                console.log('  Transforms offset:', transformsOffset);

                // Try reading with entity stride instead of 20-float stride
                console.log('📖 Reading with actual entity stride...');

                for (let i = 0; i < 2; i++) {
                    // Calculate offset using actual entity stride
                    const actualOffset = transformsOffset + (i * entityStride);

                    // Check if this offset is within bounds
                    if (actualOffset + 80 <= wasmMemory.byteLength) { // 80 bytes = 20 floats
                        const entityData = new Float32Array(wasmMemory, actualOffset, 20);

                        console.log(`  Entity ${i} (stride-based):`)
                        console.log('    Transform:', Array.from(entityData.slice(0, 16)));
                        console.log('    Color:', Array.from(entityData.slice(16, 20)));
                        console.log('    Position:', [entityData[12], entityData[13], entityData[14]]);
                    } else {
                        console.log(`  Entity ${i}: Offset out of bounds`);
                    }
                }
            }
        }
    });
});
