// src/v2/wasm-loader.ts
// WASM module loader for v2 physics integration

import { WasmPhysicsInterface } from './wasm-physics-bridge';

export class WasmLoader {
    static async loadPhysicsModule(): Promise<WasmPhysicsInterface | null> {
        try {
            console.log('🔄 Loading WASM physics module...');

            // Load the compiled WASM module (with cache-busting timestamp)
            const wasmResponse = await fetch(`/game_engine.wasm?t=${Date.now()}`);
            if (!wasmResponse.ok) {
                throw new Error(`Failed to fetch WASM module: ${wasmResponse.status}`);
            }

            const wasmBytes = await wasmResponse.arrayBuffer();
            console.log(`📦 WASM module loaded: ${wasmBytes.byteLength} bytes`);

            // Instantiate the WASM module
            const wasmModule = await WebAssembly.instantiate(wasmBytes);
            const wasmExports = wasmModule.instance.exports as any;

            // Validate that all required v2 API functions exist
            const requiredFunctions = [
                'init', 'update', 'add_entity', 'remove_entity', 'get_entity_count',
                'apply_force', 'set_entity_position', 'set_entity_velocity',
                'get_entity_transforms_offset', 'get_entity_metadata_offset', 'get_entity_metadata_size',
                'get_entity_size', 'get_entity_stride', 'debug_get_entity_mesh_id'
            ];

            for (const func of requiredFunctions) {
                if (typeof wasmExports[func] !== 'function') {
                    throw new Error(`Missing required WASM function: ${func}`);
                }
            }

            // Validate memory export
            if (!wasmExports.memory || !(wasmExports.memory instanceof WebAssembly.Memory)) {
                throw new Error('WASM module missing memory export');
            }

            console.log('✅ WASM module validation passed');

            // Create WasmPhysicsInterface wrapper
            // provides full TypeScript typing with parameter/return types
            const physicsInterface: WasmPhysicsInterface = {
                // Lifecycle
                init: wasmExports.init,
                update: wasmExports.update,

                // Entity management
                add_entity: wasmExports.add_entity,
                remove_entity: wasmExports.remove_entity,
                get_entity_count: wasmExports.get_entity_count,

                // Physics interaction
                apply_force: wasmExports.apply_force,
                set_entity_position: wasmExports.set_entity_position,
                set_entity_velocity: wasmExports.set_entity_velocity,

                // Zero-copy buffer access
                get_entity_transforms_offset: wasmExports.get_entity_transforms_offset,
                get_entity_metadata_offset: wasmExports.get_entity_metadata_offset,
                get_entity_metadata_size: wasmExports.get_entity_metadata_size,

                // Debug functions
                get_entity_size: wasmExports.get_entity_size,
                get_entity_stride: wasmExports.get_entity_stride,
                debug_get_entity_mesh_id: wasmExports.debug_get_entity_mesh_id,

                // Memory access
                memory: wasmExports.memory
            };

            console.log('🚀 WASM physics module ready for v2 integration');
            return physicsInterface;

        } catch (error) {
            console.error('❌ Failed to load WASM physics module:', error);
            return null;
        }
    }
}
