// src/v2/mesh-utils.ts
// Mesh creation utilities for WebGPU scenes
import { MeshData } from './webgpu.renderer';

/**
 * Create a cube mesh centered at origin
 * @param size Length of cube edge (default 1)
 */
export function createCubeMesh(size: number = 1): MeshData {
    const s = size / 2;
    /* eslint-disable indent */
    const vertices = new Float32Array([
        // Back face (z = -s)
        -s, -s, -s,
         s, -s, -s,
         s,  s, -s,
        -s,  s, -s,
        // Front face (z = s)
        -s, -s, s,
         s, -s, s,
         s,  s, s,
        -s,  s, s,
    ]);
    /* eslint-enable indent */
    const indices = new Uint16Array([
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
    return { vertices, indices };
}

/**
 * Create a simple triangle mesh - small triangle in NDC space for debugging
 */
export function createTriangleMesh(): MeshData {
    /* eslint-disable indent */
    const vertices = new Float32Array([
         0.0,  0.5, 0.0,  // Top center
        -0.5, -0.5, 0.0,  // Bottom left
         0.5, -0.5, 0.0,  // Bottom right
    ]);
    /* eslint-enable indent */
    const indices = new Uint16Array([0, 1, 2]);
    return { vertices, indices };
}

/**
 * Create a grid mesh (lines) in XZ plane centered at origin
 * @param size Total width/length of grid
 * @param divisions Number of grid lines per axis
 */
export function createGridMesh(size: number = 10, divisions: number = 10): MeshData {
    const half = size / 2;
    const step = size / divisions;
    const vertices: number[] = [];
    const indices: number[] = [];
    let idx = 0;
    // Lines parallel to X (vary Z)
    for (let i = 0; i <= divisions; i++) {
        const z = -half + i * step;
        vertices.push(-half, 0, z, half, 0, z);
        indices.push(idx, idx + 1);
        idx += 2;
    }
    // Lines parallel to Z (vary X)
    for (let i = 0; i <= divisions; i++) {
        const x = -half + i * step;
        vertices.push(x, 0, -half, x, 0, half);
        indices.push(idx, idx + 1);
        idx += 2;
    }
    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices),
    };
}

/**
 * Create a sphere mesh
 * @param radius Sphere radius (default 1)
 * @param segments Number of segments for sphere tessellation (default 16)
 */
export function createSphereMesh(radius: number = 1, segments: number = 16): MeshData {
    const vertices = [];
    const indices = [];
    
    for (let i = 0; i <= segments; i++) {
        const theta = (i * Math.PI) / segments;
        for (let j = 0; j <= segments; j++) {
            const phi = (j * 2 * Math.PI) / segments;
            
            const x = radius * Math.sin(theta) * Math.cos(phi);
            const y = radius * Math.cos(theta);
            const z = radius * Math.sin(theta) * Math.sin(phi);
            
            vertices.push(x, y, z);
        }
    }
    
    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < segments; j++) {
            const first = i * (segments + 1) + j;
            const second = first + segments + 1;
            
            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }
    
    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}

/**
 * Create a pyramid (square base) mesh centered at origin
 * @param size Length of base edge (default 1)
 * @param height Height of pyramid (default 1)
 */
export function createPyramidMesh(size: number = 1, height: number = 1): MeshData {
    const s = size / 2;
    const h = height / 2;
    
    /* eslint-disable indent */
    const vertices = new Float32Array([
        // Base vertices (square on XZ plane)
        -s, -h, -s,  // 0: Bottom-left
         s, -h, -s,  // 1: Bottom-right
         s, -h,  s,  // 2: Top-right
        -s, -h,  s,  // 3: Top-left
        // Apex vertex
         0,  h,  0,  // 4: Top center
    ]);
    /* eslint-enable indent */
    
    const indices = new Uint16Array([
        // Base (looking up from below)
        0, 2, 1,  // Base triangle 1
        0, 3, 2,  // Base triangle 2
        // Side faces (triangles to apex)
        0, 1, 4,  // Front face
        1, 2, 4,  // Right face
        2, 3, 4,  // Back face
        3, 0, 4,  // Left face
    ]);
    
    return { vertices, indices };
}
