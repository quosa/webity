/** Linear RGBA color, components in [0, 1]. */
export interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}

/**
 * A named surface appearance.
 *
 * For now a `Material` is just an id + color — enough to render solid/wireframe geometry.
 * It is a real class (not a string) so it can grow by subclassing without changing call
 * sites: textured materials (Phase 9) and PBR materials (Phase 10) become `Material`
 * subclasses that the renderer resolves at mount.
 *
 * `Material.default` is the placeholder used when a `MeshRenderer` is given no material —
 * a deliberately loud magenta so an unassigned/prototyping surface is visible (and it
 * doubles as the "asset failed to load" fallback later).
 */
export class Material {
    constructor(
        public readonly id: string,
        public color: RGBA,
    ) {}

    static readonly default = new Material('__default', { r: 1, g: 0, b: 1, a: 1 });
}
