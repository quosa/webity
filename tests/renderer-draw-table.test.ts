// tests/renderer-draw-table.test.ts
// B3: the render loop draws from the per-mesh draw table — one drawIndexed per
// registered mesh over its contiguous WASM bucket — with ZERO buffer creation
// and zero instance regrouping per frame.

import { jest } from '@jest/globals';
import { WebGPURendererV2 } from '../src/renderer/webgpu.renderer';
import { MeshData } from '../src/renderer/mesh-registry';
import { WebGPUMockFactory } from './utils/webgpu-mocks';

function meshData(vertexCount: number, indexCount: number): MeshData {
    return {
        vertices: new Float32Array(vertexCount * 3),
        indices: new Uint16Array(indexCount),
    };
}

describe('B3 per-mesh draw table', () => {
    let renderer: WebGPURendererV2;
    let device: any;
    let renderPass: any;

    // Two meshes: 'cube' (triangles, meshIndex 0), 'floorGrid' (lines, meshIndex 1).
    // WASM buckets: cube entities [0..3), grid entities [3..5).
    const wasmModule = {
        memory: { buffer: new ArrayBuffer(1024) } as unknown as WebAssembly.Memory,
        get_mesh_bucket_start: jest.fn((meshIndex: number) => (meshIndex === 0 ? 0 : 3)),
        get_mesh_bucket_count: jest.fn((meshIndex: number) => (meshIndex === 0 ? 3 : 2)),
    };

    beforeEach(async () => {
        WebGPUMockFactory.setupWebGPUEnvironment();
        const canvas = WebGPUMockFactory.createMockCanvas();
        renderer = new WebGPURendererV2();
        await renderer.init(canvas);

        // The renderer's device is the shared mock returned by requestAdapter/requestDevice
        const adapter = await (global.navigator as any).gpu.requestAdapter();
        device = await adapter.requestDevice();
        renderPass = device.createCommandEncoder().beginRenderPass();

        renderer.registerMesh('cube', meshData(8, 36), 'triangles');
        renderer.registerMesh('floorGrid', meshData(4, 6), 'lines');
        renderer.mapInstanceDataFromWasm(wasmModule.memory.buffer as ArrayBuffer, 0, 5);
    });

    test('issues exactly one drawIndexed per mesh with bucket-sourced instance ranges', () => {
        renderer.render(wasmModule);

        // cube: 36 indices, 3 instances, atlas offsets 0/0, firstInstance 0
        // grid: 6 indices, 2 instances, firstIndex 36 (after cube's 72 B), baseVertex 8, firstInstance 3
        expect(renderPass.drawIndexed).toHaveBeenCalledTimes(2);
        expect(renderPass.drawIndexed).toHaveBeenNthCalledWith(1, 36, 3, 0, 0, 0);
        expect(renderPass.drawIndexed).toHaveBeenNthCalledWith(2, 6, 2, 36, 8, 3);
    });

    test('creates ZERO GPU buffers during a frame (the old per-mesh-group hot loop is gone)', () => {
        const buffersBefore = device.createBuffer.mock.calls.length;

        renderer.render(wasmModule);
        renderer.render(wasmModule);
        renderer.render(wasmModule);

        expect(device.createBuffer.mock.calls.length).toBe(buffersBefore);
    });

    test('binds the atlas once per frame; instances ride the bind group (B5), not a vertex slot', () => {
        renderer.render(wasmModule);

        // Only slot 0 (shared vertex atlas) is a vertex stream now — per-instance data
        // is a storage buffer inside the bind group, fetched via instance_index.
        expect(renderPass.setVertexBuffer).toHaveBeenCalledTimes(1);
        expect(renderPass.setVertexBuffer).toHaveBeenCalledWith(0, expect.anything());
        expect(renderPass.setIndexBuffer).toHaveBeenCalledTimes(1);
        // One bind group set per pass (triangles + lines)
        expect(renderPass.setBindGroup).toHaveBeenCalledTimes(2);
    });

    test('skips meshes whose bucket is empty', () => {
        const emptyGridWasm = {
            ...wasmModule,
            get_mesh_bucket_count: jest.fn((meshIndex: number) => (meshIndex === 0 ? 5 : 0)),
        };

        renderer.render(emptyGridWasm);

        expect(renderPass.drawIndexed).toHaveBeenCalledTimes(1);
        expect(renderPass.drawIndexed).toHaveBeenCalledWith(36, 5, 0, 0, 0);
    });
});
