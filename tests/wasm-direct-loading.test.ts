// Standalone WASM loading test to debug the multi-entity exports issue
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

describe('WASM Direct Loading Debug', () => {
  // let realWasmBytes: ArrayBuffer;

  beforeAll(() => {
    console.log('=== WASM Loading Debug Test ===');
    console.log('Current working directory:', process.cwd());
    console.log('__dirname:', __dirname);
  });

  describe('File System Loading', () => {
    it('should load WASM from public/ directory', async () => {
      const wasmPath = resolve(__dirname, '../public/game_engine.wasm');
      console.log('🔍 Loading from public path:', wasmPath);

      try {
        const wasmBuffer = readFileSync(wasmPath, { flag: 'r' });
        console.log('✅ File loaded successfully');
        console.log('📊 File size:', wasmBuffer.length, 'bytes');
        // console.log('📅 File stats:', readFileSync(wasmPath, { flag: 'r' }));

        // realWasmBytes = wasmBuffer.buffer.slice(
        //   wasmBuffer.byteOffset,
        //   wasmBuffer.byteOffset + wasmBuffer.byteLength
        // );

        // // const { instance } = await WebAssembly.instantiate(realWasmBytes, {
        // //   env: {}
        // // });
        // const { instance } = await WebAssembly.instantiate(realWasmBytes);
        // for linter:
        // realWasmBytes = wasmBuffer;

        const { instance } = await WebAssembly.instantiate(new Uint8Array(wasmBuffer));
        console.dir(instance)
        const actualExports = Object.keys(instance.exports);

        console.log('🎯 PUBLIC WASM EXPORTS:', actualExports);
        console.log('🔢 Total exports:', actualExports.length);

        // Compare exports using same logic as load-game-engine.ts
        const missing = expectedExports.filter(name => !actualExports.includes(name));
        const unexpected = actualExports.filter(name => !expectedExports.includes(name));

        if (missing.length > 0) {
          console.log('Missing exports:', missing);
        }
        if (unexpected.length > 0) {
          console.log('Unexpected (extra) exports:', unexpected);
        }
        if (missing.length === 0 && unexpected.length === 0) {
          console.log('✓ All exports match expected list');
        }

        expect(instance.exports).toBeDefined();
        expect(missing).toHaveLength(0);
        expect(actualExports).toContain('spawn_entity');
        expect(actualExports).toContain('get_entity_count');

      } catch (error) {
        console.error('❌ Error loading from public/:', error);
        throw error;
      }
    });

    // it('should load WASM from dist/ directory', async () => {
    //   const wasmPath = resolve(__dirname, '../dist/game_engine.wasm');
    //   console.log('🔍 Loading from dist path:', wasmPath);

    //   try {
    //     const wasmBuffer = readFileSync(wasmPath);
    //     console.log('✅ File loaded successfully');
    //     console.log('📊 File size:', wasmBuffer.length, 'bytes');

    //     const wasmBytes = wasmBuffer.buffer.slice(
    //       wasmBuffer.byteOffset,
    //       wasmBuffer.byteOffset + wasmBuffer.byteLength
    //     );

    //     const { instance } = await WebAssembly.instantiate(wasmBytes, {
    //       env: {}
    //     });
    //     const actualExports = Object.keys(instance.exports);

    //     console.log('🎯 DIST WASM EXPORTS:', actualExports);
    //     console.log('🔢 Total exports:', actualExports.length);

    //     // Compare exports using same logic as load-game-engine.ts
    //     const missing = expectedExports.filter(name => !actualExports.includes(name));
    //     const unexpected = actualExports.filter(name => !expectedExports.includes(name));

    //     if (missing.length > 0) {
    //       console.log('Missing exports:', missing);
    //     }
    //     if (unexpected.length > 0) {
    //       console.log('Unexpected (extra) exports:', unexpected);
    //     }
    //     if (missing.length === 0 && unexpected.length === 0) {
    //       console.log('✓ All exports match expected list');
    //     }

    //     expect(instance.exports).toBeDefined();
    //     expect(missing).toHaveLength(0);
    //     expect(actualExports).toContain('spawn_entity');
    //     expect(actualExports).toContain('get_entity_count');

    //   } catch (error) {
    //     console.error('❌ Error loading from dist/:', error);
    //     throw error;
    //   }
    // });

  //   it('should compare public vs dist WASM files', () => {
  //     const publicPath = resolve(__dirname, '../public/game_engine.wasm');
  //     const distPath = resolve(__dirname, '../dist/game_engine.wasm');

  //     try {
  //       const publicBuffer = readFileSync(publicPath);
  //       const distBuffer = readFileSync(distPath);

  //       console.log('📊 PUBLIC file size:', publicBuffer.length);
  //       console.log('📊 DIST file size:', distBuffer.length);
  //       console.log('🔍 Files are identical:', Buffer.compare(publicBuffer, distBuffer) === 0);

  //       if (Buffer.compare(publicBuffer, distBuffer) !== 0) {
  //         console.warn('⚠️  WARNING: public/ and dist/ WASM files differ!');
  //         // Show first few bytes for debugging
  //         console.log('PUBLIC first 32 bytes:', Array.from(publicBuffer.slice(0, 32)));
  //         console.log('DIST first 32 bytes:', Array.from(distBuffer.slice(0, 32)));
  //       }

  //     } catch (error) {
  //       console.error('❌ Error comparing files:', error);
  //     }
  //   });
  });

  // describe('Fetch-based Loading', () => {
  //   // Mock fetch for testing different scenarios
  //   const originalFetch = global.fetch;

  //   afterEach(() => {
  //     global.fetch = originalFetch;
  //   });

  //   it('should simulate Engine.loadWASM() fetch behavior', async () => {
  //     console.log('🔍 Testing fetch-based loading like Engine class');

  //     // Read the actual file to simulate what fetch would return
  //     const wasmPath = resolve(__dirname, '../public/game_engine.wasm');
  //     const wasmBuffer = readFileSync(wasmPath);

  //     // Mock fetch to return our WASM file
  //     global.fetch = jest.fn().mockResolvedValue({
  //       ok: true,
  //       status: 200,
  //       arrayBuffer: () => Promise.resolve(wasmBuffer.buffer.slice(
  //         wasmBuffer.byteOffset,
  //         wasmBuffer.byteOffset + wasmBuffer.byteLength
  //       ))
  //     } as Response);

  //     try {
  //       const response = await fetch('game_engine.wasm');
  //       console.log('✅ Fetch successful, status:', response.status);

  //       const bytes = await response.arrayBuffer();
  //       console.log('📊 Fetched bytes:', bytes.byteLength);

  //       const { instance } = await WebAssembly.instantiate(bytes, {
  //         env: {}
  //       });
  //       const actualExports = Object.keys(instance.exports);

  //       console.log('🎯 FETCH-LOADED EXPORTS:', actualExports);
  //       console.log('🔢 Total exports:', actualExports.length);

  //       // Compare exports using same logic as load-game-engine.ts
  //       const missing = expectedExports.filter(name => !actualExports.includes(name));
  //       const unexpected = actualExports.filter(name => !expectedExports.includes(name));

  //       if (missing.length > 0) {
  //         console.log('Missing exports:', missing);
  //       }
  //       if (unexpected.length > 0) {
  //         console.log('Unexpected (extra) exports:', unexpected);
  //       }
  //       if (missing.length === 0 && unexpected.length === 0) {
  //         console.log('✓ All exports match expected list');
  //       }

  //       expect(instance.exports).toBeDefined();
  //       expect(missing).toHaveLength(0);
  //       expect(actualExports).toContain('spawn_entity');
  //       expect(actualExports).toContain('get_entity_count');

  //     } catch (error) {
  //       console.error('❌ Error in fetch simulation:', error);
  //       throw error;
  //     }
  //   });

  //   it('should test different fetch paths', async () => {
  //     const testPaths = [
  //       'game_engine.wasm',
  //       './game_engine.wasm',
  //       'public/game_engine.wasm',
  //       'dist/game_engine.wasm'
  //     ];

  //     for (const path of testPaths) {
  //       console.log(`🔍 Testing fetch path: "${path}"`);

  //       // Mock fetch to simulate what might happen with each path
  //       global.fetch = jest.fn().mockImplementation((url: string) => {
  //         console.log(`  📡 Fetch called with URL: "${url}"`);

  //         // Try to determine which file this would resolve to
  //         let actualPath: string;
  //         if (url.includes('public/')) {
  //           actualPath = resolve(__dirname, '../public/game_engine.wasm');
  //         } else if (url.includes('dist/')) {
  //           actualPath = resolve(__dirname, '../dist/game_engine.wasm');
  //         } else {
  //           // Default behavior - might go to dist/ in test environment
  //           actualPath = resolve(__dirname, '../dist/game_engine.wasm');
  //           console.log(`  ⚠️  Ambiguous path "${url}" - assuming dist/`);
  //         }

  //         try {
  //           const wasmBuffer = readFileSync(actualPath);
  //           console.log(`  ✅ Resolved to: ${actualPath} (${wasmBuffer.length} bytes)`);

  //           return Promise.resolve({
  //             ok: true,
  //             status: 200,
  //             arrayBuffer: () => Promise.resolve(wasmBuffer.buffer.slice(
  //               wasmBuffer.byteOffset,
  //               wasmBuffer.byteOffset + wasmBuffer.byteLength
  //             ))
  //           } as Response);
  //         } catch (error) {
  //           console.log(`  ❌ Failed to resolve: ${actualPath}`);
  //           return Promise.resolve({
  //             ok: false,
  //             status: 404
  //           } as Response);
  //         }
  //       });

  //       try {
  //         const response = await fetch(path);
  //         if (response.ok) {
  //           const bytes = await response.arrayBuffer();
  //           const { instance } = await WebAssembly.instantiate(bytes, {
  //             env: {}
  //           });
  //           const actualExports = Object.keys(instance.exports);

  //           const missing = expectedExports.filter(name => !actualExports.includes(name));
  //           const hasAllExpected = missing.length === 0;
  //           console.log(`  🎯 Has all expected exports: ${hasAllExpected ? '✅' : '❌'}`);
  //           console.log(`  🔢 Total exports: ${actualExports.length}`);
  //         } else {
  //           console.log(`  ❌ Fetch failed with status: ${response.status}`);
  //         }
  //       } catch (error) {
  //         console.log(`  ❌ Error testing path "${path}":`, error);
  //       }

  //       console.log(''); // Empty line for readability
  //     }
  //   });
  // });

  // describe('Export Verification', () => {
  //   it('should verify all expected multi-entity exports exist', async () => {
  //     const wasmPath = resolve(__dirname, '../public/game_engine.wasm');
  //     const wasmBuffer = readFileSync(wasmPath);
  //     const wasmBytes = wasmBuffer.buffer.slice(
  //       wasmBuffer.byteOffset,
  //       wasmBuffer.byteOffset + wasmBuffer.byteLength
  //     );

  //     const { instance } = await WebAssembly.instantiate(wasmBytes, {
  //       env: {}
  //     });
  //     const exports = instance.exports;
  //     const actualExports = Object.keys(exports);

  //     console.log('🧪 Testing all expected exports...');

  //     // Compare exports using same logic as load-game-engine.ts
  //     const missing = expectedExports.filter(name => !actualExports.includes(name));
  //     const unexpected = actualExports.filter(name => !expectedExports.includes(name));

  //     console.log(`📊 Total actual exports: ${actualExports.length}`);
  //     console.log(`📊 Total expected exports: ${expectedExports.length}`);

  //     if (missing.length > 0) {
  //       console.log('Missing exports:', missing);
  //     }
  //     if (unexpected.length > 0) {
  //       console.log('Unexpected (extra) exports:', unexpected);
  //     }
  //     if (missing.length === 0 && unexpected.length === 0) {
  //       console.log('✓ All exports match expected list');
  //     }

  //     // Verify specific exports are functions
  //     const criticalExports = ['spawn_entity', 'get_entity_count', 'init', 'update'];
  //     for (const exportName of criticalExports) {
  //       if (typeof exports[exportName] === 'function') {
  //         console.log(`  ✅ ${exportName}: function`);
  //       } else {
  //         console.log(`  ❌ ${exportName}: ${typeof exports[exportName]} (expected function)`);
  //       }
  //     }

  //     if (missing.length > 0) {
  //       console.error('❌ Missing exports:', missing);
  //       throw new Error(`Missing expected exports: ${missing.join(', ')}`);
  //     }

  //     expect(missing).toHaveLength(0);
  //   });
  // });
});