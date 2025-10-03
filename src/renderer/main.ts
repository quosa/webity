// Simple entry point that sets up WebGPURendererV2 and pushes a cube mesh

import { WebGPURendererV2 } from './webgpu.renderer';
import { MeshData } from './mesh-registry';

import { createOrthographicMatrix, createPerspectiveMatrix, multiplyMat4 } from '../utils/math-utils';

// Basic cube geometry (unit cube centered at origin)
// 8 unique vertices (for position only, no normals/uvs yet)
const cubeVertices = new Float32Array([
    // x, y, z
    -0.5, -0.5, -0.5,
    0.5, -0.5, -0.5,
    0.5, 0.5, -0.5,
    -0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5,
    0.5, -0.5, 0.5,
    0.5, 0.5, 0.5,
    -0.5, 0.5, 0.5,
]);

// 12 triangles -> 36 indices (u16) - same winding as mesh-utils.ts
const cubeIndices = new Uint16Array([
    // Back face
    0, 1, 2, 2, 3, 0,
    // Front face
    4, 6, 5, 6, 4, 7,
    // Left face
    4, 0, 3, 3, 7, 4,
    // Right face
    1, 5, 6, 6, 2, 1,
    // Bottom face
    4, 5, 1, 1, 0, 4,
    // Top face
    3, 2, 6, 6, 7, 3,
]);

const cubeMesh: MeshData = {
    vertices: cubeVertices,
    indices: cubeIndices,
};

// This is the same as createOrthographicMatrix in math-utils.ts
// function createPerspectiveVP(): Float32Array { ... }

// Create a minimal mock WASM module that satisfies renderer expectations.
// Layout assumptions (mirrors comments in webgpu.renderer.ts getEntityMeshId):
// struct EntityMetadata {
//   id: u32        (0)
//   mesh_id: u32   (4)
//   material_id: u32 (8)
//   active: u8     (12)
//   physics_enabled: u8 (13)
//   rendering_enabled: u8 (14)
//   transform_dirty: u8 (15)
// } // size = 16 bytes
// Transforms block: per-entity 20 f32 values (16 for mat4 + 4 color)
interface MockWasmModule {
    memory: WebAssembly.Memory;
    get_entity_metadata_offset(): number;
    get_entity_metadata_size(): number;
    get_entity_transforms_offset(): number;
}

function createMockWasmModule(entityCount: number, meshIndex: number): { module: MockWasmModule; instanceView: Float32Array; transformsOffset: number } {
    const memory = new WebAssembly.Memory({ initial: 1 }); // 64 KiB

    const metadataSize = 16;
    const metadataOffset = 0x100;      // 256 bytes
    const transformsOffset = 0x1000;   // 4096 bytes (aligned away from metadata)

    const dv = new DataView(memory.buffer);
    for (let i = 0; i < entityCount; i++) {
        const base = metadataOffset + i * metadataSize;
        dv.setUint32(base + 0, i + 1, true);          // id
        dv.setUint32(base + 4, meshIndex >>> 0, true); // mesh_id
        dv.setUint32(base + 8, 0, true);              // material_id
        dv.setUint8(base + 12, 1);                    // active
        dv.setUint8(base + 13, 0);                    // physics_enabled
        dv.setUint8(base + 14, 1);                    // rendering_enabled
        dv.setUint8(base + 15, 0);                    // transform_dirty
    }

    // Create Float32 view for transforms (contiguous per-entity blocks)
    const instanceView = new Float32Array(memory.buffer, transformsOffset, entityCount * 20);

    const module: MockWasmModule = {
        memory,
        get_entity_metadata_offset: () => metadataOffset,
        get_entity_metadata_size: () => metadataSize,
        get_entity_transforms_offset: () => transformsOffset,
    };

    return { module, instanceView, transformsOffset };
}

async function main() {
    // Create / find canvas
    let canvas = document.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);
    }

    if (!('gpu' in navigator)) {
        console.error('WebGPU not supported in this browser.');
        return;
    }

    const renderer = new WebGPURendererV2();
    await renderer.init(canvas as HTMLCanvasElement);

    // Register cube mesh
    renderer.registerMesh('cube', cubeMesh);

    // set up camera
    // Camera at origin looking down +Z
    //               Y+↑ __---‾‾‾
    // Z- ------------🎥--------📦----------> Z+
    //               Z=0 ‾‾---___


    // you can add createLookAtMatrix() if needed
    const viewMatrix = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, -1, 0, // Flip the camera to look down +Z (default is -Z)
        0, 0, 0, 1
    ]);
    // const viewMatrix = simpleViewMatrix; // camera at origin looking down +Z
    const fov = Math.PI / 4; // 45 degrees
    const aspect = canvas.width / canvas.height; // 4:3 for 800x600
    const projectionMatrix = createPerspectiveMatrix(
        fov,
        aspect,
        0.1, // near
        100 // far
    );
    const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);
    renderer.setViewProjectionMatrix(viewProjectionMatrix);

    const useOrthographic = false;
    if (useOrthographic) {
        // override with orthographic for testing
        renderer.setViewProjectionMatrix(createOrthographicMatrix(
            -2, 2,    // left, right
            -1.5, 1.5, // bottom, top
            0.1, 10    // near, far
        ));
    }

    // MOCK WASM MODULE SETUP ---------------------------------------------
    const cubeMeshIndex = renderer.getMeshIndex('cube') ?? 0;
    const { module: mockWasm, instanceView, transformsOffset } = createMockWasmModule(1, cubeMeshIndex);

    // Initialize first (and only) entity transform (moved forward in Z + white color)
    instanceView.set([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        // 0, 0, 0, 1, // move the cube to origin --> no output as the camera is also in origin (and bacface culling kicks in)
        0, 0, 2, 1,  // Move cube to Z=2 (between near=0.1 and far=10), now we see the front face as the cube is 1x1x1
        // 0, 0, -2, 1, // Move cube to Z=-2 (in front of camera at origin looking down +Z) This is needed if we don't "flip" the Z axis in projection matrix
        1, 1, 1, 1,
    ], 0);

    // Upload instance data via buffer manager using mock WASM memory layout
    const bufferManager: any = (renderer as any).bufferManager;
    bufferManager.mapInstanceDataFromWasm(mockWasm.memory.buffer, transformsOffset, 1);

    // Initial render
    renderer.render(mockWasm);

    // Animate rotation
    const rotate: boolean = false;
    let angle = 0;
    function frame() {
        angle += 0.01;
        // Simple Y rotation applied to transform rows (column-major in WGSL expects mat4x4<f32>(row0,row1,row2,row3))
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        instanceView.set([
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 2, 1,
            1, 1, 1, 1,
        ], 0);
        // Re-upload updated transform
        bufferManager.mapInstanceDataFromWasm(mockWasm.memory.buffer, transformsOffset, 1);
        renderer.render(mockWasm);
        requestAnimationFrame(frame);
    }
    if (rotate) {
        requestAnimationFrame(frame);
    }
}

// Auto-run when module loads
main().catch(err => console.error('Error in main():', err));
