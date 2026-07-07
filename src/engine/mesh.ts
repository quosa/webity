import type { MeshData } from '../renderer/mesh-registry';
import {
    createCubeMesh,
    createSphereMesh,
    createGridMesh,
    createPyramidMesh,
    createTriangleMesh,
} from '../renderer/mesh-utils';

/**
 * A named geometry asset.
 *
 * A `Mesh` is a CPU-side descriptor (vertices + indices) that can be created before any
 * renderer/GPU/WASM context exists — this is what lets a `Scene` be built as pure data.
 * The engine uploads a mesh's `data` into GPU buffers at mount time (`Engine.loadScene`)
 * via the renderer's existing `registerMesh(id, data)`.
 *
 * Future subclasses hang off this seam without changing call sites:
 *  - `UrlMesh` — async `load()` hook that populates `data` from a file/URL (Phase 9).
 *  - `DynamicMesh` — CPU-mutable geometry that re-uploads dirty ranges (rare, opt-in).
 */
export class Mesh {
    public readonly id: string;
    public readonly data: MeshData;

    constructor(id: string, data: MeshData) {
        this.id = id;
        this.data = data;
    }

    static createCube(id: string, size = 1): Mesh {
        return new Mesh(id, createCubeMesh(size));
    }

    static createSphere(id: string, radius = 1, segments = 16): Mesh {
        return new Mesh(id, createSphereMesh(radius, segments));
    }

    static createGrid(id: string, size = 10, divisions = 10): Mesh {
        return new Mesh(id, createGridMesh(size, divisions));
    }

    static createPyramid(id: string, size = 1, height = 1): Mesh {
        return new Mesh(id, createPyramidMesh(size, height));
    }

    static createTriangle(id: string, size = 1): Mesh {
        return new Mesh(id, createTriangleMesh(size));
    }
}
