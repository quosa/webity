import { Mesh } from '../src/engine/mesh';

describe('Mesh', () => {
    it('constructs with an id and MeshData', () => {
        const data = { vertices: new Float32Array([0, 0, 0]), indices: new Uint16Array([0]) };
        const mesh = new Mesh('custom', data);
        expect(mesh.id).toBe('custom');
        expect(mesh.data).toBe(data);
    });

    it('builds a Scene-safe descriptor with no renderer/GPU dependency', () => {
        // Factories must work without any WebGPU device / renderer present.
        const mesh = Mesh.createCube('cube');
        expect(mesh.id).toBe('cube');
        expect(mesh.data.vertices).toBeInstanceOf(Float32Array);
        expect(mesh.data.indices).toBeInstanceOf(Uint16Array);
        expect(mesh.data.vertices.length).toBeGreaterThan(0);
        expect(mesh.data.indices.length).toBeGreaterThan(0);
    });

    it.each([
        ['createCube', () => Mesh.createCube('m')],
        ['createSphere', () => Mesh.createSphere('m')],
        ['createGrid', () => Mesh.createGrid('m')],
        ['createPyramid', () => Mesh.createPyramid('m')],
        ['createTriangle', () => Mesh.createTriangle('m')],
    ])('%s produces a non-empty mesh with the given id', (_name, make) => {
        const mesh = make();
        expect(mesh.id).toBe('m');
        expect(mesh.data.vertices.length).toBeGreaterThan(0);
        expect(mesh.data.indices.length).toBeGreaterThan(0);
    });

    it('passes generator parameters through (sphere segments affect vertex count)', () => {
        const coarse = Mesh.createSphere('a', 1, 8);
        const fine = Mesh.createSphere('b', 1, 32);
        expect(fine.data.vertices.length).toBeGreaterThan(coarse.data.vertices.length);
    });
});
