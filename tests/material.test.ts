import { Material } from '../src/engine/material';

describe('Material', () => {
    it('constructs with an id and color', () => {
        const blue = new Material('blue', { r: 0, g: 0, b: 1, a: 1 });
        expect(blue.id).toBe('blue');
        expect(blue.color).toEqual({ r: 0, g: 0, b: 1, a: 1 });
    });

    it('exposes a default placeholder material (loud magenta)', () => {
        expect(Material.default).toBeInstanceOf(Material);
        expect(Material.default.color).toEqual({ r: 1, g: 0, b: 1, a: 1 });
    });

    it('default is a shared singleton', () => {
        expect(Material.default).toBe(Material.default);
    });
});
