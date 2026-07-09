import { MeshRenderer } from '../src/engine/components';
import { Mesh } from '../src/engine/mesh';
import { Material } from '../src/engine/material';

describe('MeshRenderer object mode (A3)', () => {
    it('accepts Mesh + Material objects and derives id/color', () => {
        const mesh = Mesh.createCube('cube');
        const red = new Material('red', { r: 1, g: 0, b: 0, a: 1 });
        const mr = new MeshRenderer(mesh, red);

        expect(mr.mesh).toBe(mesh);
        expect(mr.material).toBe(red);
        expect(mr.meshId).toBe('cube');
        expect(mr.materialId).toBe('red');
        expect(mr.color).toEqual({ x: 1, y: 0, z: 0, w: 1 }); // RGBA -> xyzw
        expect(mr.renderMode).toBe('triangles');
    });

    it('defaults to Material.default (magenta) when no material given', () => {
        const mr = new MeshRenderer(Mesh.createSphere('ball'));
        expect(mr.material).toBe(Material.default);
        expect(mr.materialId).toBe('__default');
        expect(mr.color).toEqual({ x: 1, y: 0, z: 1, w: 1 });
    });

    it('honors renderMode in object mode', () => {
        const mr = new MeshRenderer(Mesh.createGrid('grid'), new Material('gray', { r: .5, g: .5, b: .5, a: 1 }), 'lines');
        expect(mr.renderMode).toBe('lines');
        expect(mr.meshId).toBe('grid');
    });

    it('still supports the legacy string form (mesh/material objects undefined)', () => {
        const mr = new MeshRenderer('grid', 'default', 'lines', { x: .5, y: .5, z: .5, w: 1 });
        expect(mr.meshId).toBe('grid');
        expect(mr.materialId).toBe('default');
        expect(mr.renderMode).toBe('lines');
        expect(mr.color).toEqual({ x: .5, y: .5, z: .5, w: 1 });
        expect(mr.mesh).toBeUndefined();
        expect(mr.material).toBeUndefined();
    });
});
