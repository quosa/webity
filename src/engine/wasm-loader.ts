// src/v2/wasm-loader.ts
// WASM module loader for v2 physics integration

import { WasmPhysicsInterface } from './wasm-physics-bridge';

if (typeof TextDecoder === 'undefined') {
    // Node.js environment - use util.TextDecoder for jslog
    const { TextDecoder } = require('util');
    (global as any).TextDecoder = TextDecoder;
}

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
            let wasmMemory: WebAssembly.Memory | null = null;
            const wasmModule = await WebAssembly.instantiate(wasmBytes, {
                env: {
                    jslog: (ptr:number, len:number) => {
                        // Check global debug logging flag before processing
                        if (!(window as any).isDebugLoggingEnabled) {
                            return; // Skip logging if debug is disabled
                        }

                        // Use the memory reference captured after instantiation
                        if (wasmMemory && wasmMemory.buffer) {
                            const bytes = new Uint8Array(wasmMemory.buffer, ptr, len);
                            const msg = new TextDecoder('utf8').decode(bytes);
                            console.log(msg);
                        }
                    }
                }
            });
            wasmMemory = wasmModule.instance.exports['memory'] as WebAssembly.Memory;
            const wasmExports = wasmModule.instance.exports as any;

            // Validate that all required v2 API functions exist
            const requiredFunctions = [
                'init', 'update', 'add_entity', 'remove_entity', 'get_entity_count',
                'apply_force', 'set_entity_position', 'set_entity_velocity', 'set_entity_rotation',
                'get_entity_transforms_offset', 'get_entity_metadata_offset', 'get_entity_metadata_size',
                'get_entity_size', 'get_entity_stride', 'debug_get_entity_mesh_id',
                'get_entity_position_x', 'get_entity_position_y', 'get_entity_position_z',
                'get_entity_velocity_x', 'get_entity_velocity_y', 'get_entity_velocity_z',
                'get_collision_checks_performed', 'get_collisions_detected', 'get_kinematic_collision_flag',
                'get_collision_state', 'debug_get_entity_physics_info', 'get_wasm_version',
                'get_collision_event_counter', 'get_last_collision_entities',
                'get_last_collision_pos1', 'get_last_collision_pos2', 'clear_collision_event_counter'
            ];

            // Optional collision shape functions (may not be present in older WASM modules)
            const optionalFunctions = [
                'spawn_entity_with_collider', 'set_entity_collision_shape',
                'get_entity_collision_shape', 'get_entity_collision_extent_x',
                'get_entity_collision_extent_y', 'get_entity_collision_extent_z'
            ];

            for (const func of requiredFunctions) {
                if (typeof wasmExports[func] !== 'function') {
                    throw new Error(`Missing required WASM function: ${func}`);
                }
            }

            // Check for optional functions and log their availability
            const availableOptionalFunctions: string[] = [];
            for (const func of optionalFunctions) {
                if (typeof wasmExports[func] === 'function') {
                    availableOptionalFunctions.push(func);
                }
            }
            console.log(`🔧 Optional collision shape functions available: ${availableOptionalFunctions.length}/${optionalFunctions.length} (${availableOptionalFunctions.join(', ')})`);

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
                set_entity_rotation: wasmExports.set_entity_rotation,

                // Zero-copy buffer access
                get_entity_transforms_offset: wasmExports.get_entity_transforms_offset,
                get_entity_metadata_offset: wasmExports.get_entity_metadata_offset,
                get_entity_metadata_size: wasmExports.get_entity_metadata_size,

                // Debug functions
                get_entity_size: wasmExports.get_entity_size,
                get_entity_stride: wasmExports.get_entity_stride,
                debug_get_entity_mesh_id: wasmExports.debug_get_entity_mesh_id,

                // Entity position getters
                get_entity_position_x: wasmExports.get_entity_position_x,
                get_entity_position_y: wasmExports.get_entity_position_y,
                get_entity_position_z: wasmExports.get_entity_position_z,

                // Entity velocity getters
                get_entity_velocity_x: wasmExports.get_entity_velocity_x,
                get_entity_velocity_y: wasmExports.get_entity_velocity_y,
                get_entity_velocity_z: wasmExports.get_entity_velocity_z,

                // Collision shape configuration (optional - may not be present in older WASM)
                spawn_entity_with_collider: wasmExports.spawn_entity_with_collider,
                set_entity_collision_shape: wasmExports.set_entity_collision_shape,
                get_entity_collision_shape: wasmExports.get_entity_collision_shape,
                get_entity_collision_extent_x: wasmExports.get_entity_collision_extent_x,
                get_entity_collision_extent_y: wasmExports.get_entity_collision_extent_y,
                get_entity_collision_extent_z: wasmExports.get_entity_collision_extent_z,

                // Physics debug functions
                get_collision_checks_performed: wasmExports.get_collision_checks_performed,
                get_collisions_detected: wasmExports.get_collisions_detected,
                get_kinematic_collision_flag: wasmExports.get_kinematic_collision_flag,
                get_collision_state: wasmExports.get_collision_state,
                debug_get_entity_physics_info: wasmExports.debug_get_entity_physics_info,
                debug_get_collision_radius: wasmExports.debug_get_collision_radius,
                get_wasm_version: wasmExports.get_wasm_version,

                // Collision event logging functions
                get_collision_event_counter: wasmExports.get_collision_event_counter,
                get_last_collision_entities: wasmExports.get_last_collision_entities,
                get_last_collision_pos1: wasmExports.get_last_collision_pos1,
                get_last_collision_pos2: wasmExports.get_last_collision_pos2,
                clear_collision_event_counter: wasmExports.clear_collision_event_counter,

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
