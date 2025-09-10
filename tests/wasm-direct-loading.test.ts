// WASM file loading and export validation test
import { readFileSync } from 'fs';
import { resolve } from 'path';

const expectedExports = [
    'memory', // auto-exported
    'init',
    'update',
    'set_input',
    'generate_sphere_mesh',
    'generate_grid_floor',
    'get_vertex_buffer_offset',
    'get_grid_buffer_offset',
    'get_uniform_buffer_offset',
    'get_vertex_count',
    'get_grid_vertex_count',
    'get_collision_state',
    'set_position',
    'apply_force',
    'get_ball_position_x',
    'get_ball_position_y',
    'get_ball_position_z',
    'set_camera_position',
    'set_camera_target',
    'set_physics_config',
    'set_world_bounds',
    'get_camera_position_x',
    'get_camera_position_y',
    'get_camera_position_z',
    'spawn_entity',
    'get_entity_count',
    'despawn_all_entities',
    'get_entity_position_x',
    'get_entity_position_y',
    'get_entity_position_z',
    'set_entity_position',
    'set_entity_velocity'
];

describe('WASM File Loading', () => {
    describe('Direct File Loading', () => {
        it('should load WASM file and verify all expected exports', async () => {
            const wasmPath = resolve(process.cwd(), 'public/game_engine.wasm');

            try {
                const wasmBuffer = readFileSync(wasmPath);
                expect(wasmBuffer.length).toBeGreaterThan(0);

                const { instance } = await WebAssembly.instantiate(new Uint8Array(wasmBuffer));
                const actualExports = Object.keys(instance.exports);

                // Verify all expected exports are present
                const missing = expectedExports.filter(name => !actualExports.includes(name));
                expect(missing).toHaveLength(0);

                // Verify critical functions are callable
                expect(typeof instance.exports['init']).toBe('function');
                expect(typeof instance.exports['update']).toBe('function');
                expect(typeof instance.exports['spawn_entity']).toBe('function');
                expect(typeof instance.exports['get_entity_count']).toBe('function');

                // Verify memory is accessible
                expect(instance.exports['memory']).toBeInstanceOf(WebAssembly.Memory);

            } catch (error) {
                if ((error as any).code === 'ENOENT') {
                    console.warn('WASM file not found - skipping test (this is expected during initial setup)');
                    return;
                }
                throw error;
            }
        });
    });
});
