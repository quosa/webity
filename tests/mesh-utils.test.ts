// tests/mesh-utils.test.ts
// Unit tests for mesh generation utilities
import { createGridMesh, createSphereMesh, createPyramidMesh, createCubeMesh, createTriangleMesh } from '../src/renderer/mesh-utils';

describe('Mesh Utils', () => {
    describe('createGridMesh', () => {
        describe('Default Parameters', () => {
            it('should create a 10x10 grid with default parameters', () => {
                const mesh = createGridMesh();

                // Default: size=10, divisions=10
                // Lines parallel to X: (divisions+1) = 11 lines
                // Lines parallel to Z: (divisions+1) = 11 lines
                // Total: 22 lines, each with 2 endpoints * 3 floats = 132 floats
                expect(mesh.vertices.length).toBe(132);

                // Expected indices: 22 lines * 2 indices per line = 44 indices
                expect(mesh.indices.length).toBe(44);
            });

            it('should have vertices in XZ plane (y=0)', () => {
                const mesh = createGridMesh();

                // Check that all Y coordinates are 0
                for (let i = 1; i < mesh.vertices.length; i += 3) {
                    expect(mesh.vertices[i]).toBe(0);
                }
            });

            it('should center grid at origin', () => {
                const mesh = createGridMesh(10, 10);

                // Grid should span from -5 to 5 on both X and Z axes
                let minX = Infinity, maxX = -Infinity;
                let minZ = Infinity, maxZ = -Infinity;

                for (let i = 0; i < mesh.vertices.length; i += 3) {
                    const x = mesh.vertices[i]!;
                    const z = mesh.vertices[i + 2]!;
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minZ = Math.min(minZ, z);
                    maxZ = Math.max(maxZ, z);
                }

                expect(minX).toBeCloseTo(-5, 5);
                expect(maxX).toBeCloseTo(5, 5);
                expect(minZ).toBeCloseTo(-5, 5);
                expect(maxZ).toBeCloseTo(5, 5);
            });
        });

        describe('Custom Parameters', () => {
            it('should create grid with custom size', () => {
                const mesh = createGridMesh(20, 10);

                // Size=20, should span from -10 to 10
                let minX = Infinity, maxX = -Infinity;

                for (let i = 0; i < mesh.vertices.length; i += 3) {
                    const x = mesh.vertices[i]!;
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                }

                expect(minX).toBeCloseTo(-10, 5);
                expect(maxX).toBeCloseTo(10, 5);
            });

            it('should create grid with custom divisions', () => {
                const mesh = createGridMesh(10, 5);

                // divisions=5: (5+1) lines in each direction = 6+6 = 12 lines total
                // 12 lines * 2 endpoints * 3 floats = 72 floats
                expect(mesh.vertices.length).toBe(72);
                expect(mesh.indices.length).toBe(24);
            });

            it('should handle single division grid', () => {
                const mesh = createGridMesh(10, 1);

                // divisions=1: (1+1) lines in each direction = 2+2 = 4 lines
                // 4 lines * 2 endpoints * 3 floats = 24 floats
                expect(mesh.vertices.length).toBe(24);
                expect(mesh.indices.length).toBe(8);
            });

            it('should handle zero divisions grid', () => {
                const mesh = createGridMesh(10, 0);

                // divisions=0: (0+1) lines in each direction = 1+1 = 2 lines
                // 2 lines * 2 endpoints * 3 floats = 12 floats
                expect(mesh.vertices.length).toBe(12);
                expect(mesh.indices.length).toBe(4);
            });
        });

        describe('Index Validity', () => {
            it('should have valid line indices', () => {
                const mesh = createGridMesh(10, 5);
                const vertexCount = mesh.vertices.length / 3;

                // All indices should be valid vertex indices
                for (let i = 0; i < mesh.indices.length; i++) {
                    expect(mesh.indices[i]).toBeGreaterThanOrEqual(0);
                    expect(mesh.indices[i]!).toBeLessThan(vertexCount);
                }
            });

            it('should have sequential pairs for line rendering', () => {
                const mesh = createGridMesh(10, 5);

                // Indices should come in pairs (for line rendering)
                expect(mesh.indices.length % 2).toBe(0);

                // Check that indices come in sequential pairs
                for (let i = 0; i < mesh.indices.length; i += 2) {
                    const idx1 = mesh.indices[i]!;
                    const idx2 = mesh.indices[i + 1]!;
                    expect(idx2).toBe(idx1 + 1);
                }
            });
        });
    });

    describe('createSphereMesh', () => {
        describe('Default Parameters', () => {
            it('should create sphere with default radius and segments', () => {
                const mesh = createSphereMesh();

                // Default: radius=1, segments=16
                // Vertices: (segments+1) * (segments+1) = 17 * 17 = 289 vertices
                // Each vertex: 3 floats (x, y, z) = 867 floats
                expect(mesh.vertices.length).toBe(867);

                // Triangles: segments * segments * 2 triangles * 3 indices = 16 * 16 * 2 * 3 = 1536 indices
                expect(mesh.indices.length).toBe(1536);
            });

            it('should have all vertices at distance radius from origin', () => {
                const mesh = createSphereMesh(1, 16);

                // Check that all vertices are approximately at radius=1 from origin
                for (let i = 0; i < mesh.vertices.length; i += 3) {
                    const x = mesh.vertices[i]!;
                    const y = mesh.vertices[i + 1]!;
                    const z = mesh.vertices[i + 2]!;
                    const distance = Math.sqrt(x * x + y * y + z * z);
                    expect(distance).toBeCloseTo(1.0, 5);
                }
            });
        });

        describe('Custom Parameters', () => {
            it('should create sphere with custom radius', () => {
                const mesh = createSphereMesh(2.5, 8);

                // Check that all vertices are at radius=2.5 from origin
                for (let i = 0; i < mesh.vertices.length; i += 3) {
                    const x = mesh.vertices[i]!;
                    const y = mesh.vertices[i + 1]!;
                    const z = mesh.vertices[i + 2]!;
                    const distance = Math.sqrt(x * x + y * y + z * z);
                    expect(distance).toBeCloseTo(2.5, 5);
                }
            });

            it('should create sphere with custom segments', () => {
                const mesh = createSphereMesh(1, 8);

                // segments=8: (8+1) * (8+1) = 81 vertices * 3 floats = 243 floats
                expect(mesh.vertices.length).toBe(243);

                // Triangles: 8 * 8 * 2 * 3 = 384 indices
                expect(mesh.indices.length).toBe(384);
            });

            it('should handle low-poly sphere (segments=4)', () => {
                const mesh = createSphereMesh(1, 4);

                // segments=4: (4+1) * (4+1) = 25 vertices * 3 floats = 75 floats
                expect(mesh.vertices.length).toBe(75);
                expect(mesh.indices.length).toBe(96); // 4 * 4 * 2 * 3
            });

            it('should handle high-poly sphere (segments=32)', () => {
                const mesh = createSphereMesh(1, 32);

                // segments=32: (32+1) * (32+1) = 1089 vertices * 3 floats = 3267 floats
                expect(mesh.vertices.length).toBe(3267);
                expect(mesh.indices.length).toBe(6144); // 32 * 32 * 2 * 3
            });
        });

        describe('Sphere Topology', () => {
            it('should have vertices covering full sphere', () => {
                const mesh = createSphereMesh(1, 16);

                // Check that we have vertices at poles (y = ±1)
                let hasTopPole = false;
                let hasBottomPole = false;

                for (let i = 0; i < mesh.vertices.length; i += 3) {
                    const y = mesh.vertices[i + 1]!;
                    if (Math.abs(y - 1.0) < 0.001) hasTopPole = true;
                    if (Math.abs(y + 1.0) < 0.001) hasBottomPole = true;
                }

                expect(hasTopPole).toBe(true);
                expect(hasBottomPole).toBe(true);
            });

            it('should have valid triangle indices', () => {
                const mesh = createSphereMesh(1, 8);
                const vertexCount = mesh.vertices.length / 3;

                // All indices should be valid vertex indices
                for (let i = 0; i < mesh.indices.length; i++) {
                    expect(mesh.indices[i]).toBeGreaterThanOrEqual(0);
                    expect(mesh.indices[i]!).toBeLessThan(vertexCount);
                }

                // Indices should come in triplets (for triangles)
                expect(mesh.indices.length % 3).toBe(0);
            });
        });
    });

    describe('createPyramidMesh', () => {
        describe('Default Parameters', () => {
            it('should create pyramid with default size and height', () => {
                const mesh = createPyramidMesh();

                // Pyramid has 5 vertices: 4 base corners + 1 apex
                // 5 vertices * 3 floats = 15 floats
                expect(mesh.vertices.length).toBe(15);

                // 6 faces: 2 triangles for base + 4 triangular sides
                // 6 triangles * 3 indices = 18 indices
                expect(mesh.indices.length).toBe(18);
            });

            it('should have apex at top center', () => {
                const mesh = createPyramidMesh(1, 1);

                // Apex should be at (0, h/2, 0) = (0, 0.5, 0)
                // The last vertex (index 12, 13, 14) should be the apex
                const apexX = mesh.vertices[12]!;
                const apexY = mesh.vertices[13]!;
                const apexZ = mesh.vertices[14]!;

                expect(apexX).toBeCloseTo(0, 5);
                expect(apexY).toBeCloseTo(0.5, 5);
                expect(apexZ).toBeCloseTo(0, 5);
            });

            it('should have square base on XZ plane', () => {
                const mesh = createPyramidMesh(1, 1);

                // First 4 vertices should be base (y = -h/2 = -0.5)
                for (let i = 0; i < 12; i += 3) {
                    const y = mesh.vertices[i + 1]!;
                    expect(y).toBeCloseTo(-0.5, 5);
                }
            });

            it('should center pyramid at origin', () => {
                const mesh = createPyramidMesh(2, 2);

                // Base should span from -1 to 1 on X and Z
                const baseVertices = [];
                for (let i = 0; i < 12; i += 3) {
                    baseVertices.push({
                        x: mesh.vertices[i]!,
                        z: mesh.vertices[i + 2]!
                    });
                }

                const xCoords = baseVertices.map(v => v.x);
                const zCoords = baseVertices.map(v => v.z);

                expect(Math.min(...xCoords)).toBeCloseTo(-1, 5);
                expect(Math.max(...xCoords)).toBeCloseTo(1, 5);
                expect(Math.min(...zCoords)).toBeCloseTo(-1, 5);
                expect(Math.max(...zCoords)).toBeCloseTo(1, 5);
            });
        });

        describe('Custom Parameters', () => {
            it('should create pyramid with custom base size', () => {
                const mesh = createPyramidMesh(4, 1);

                // Base should span from -2 to 2
                const baseVertices = [];
                for (let i = 0; i < 12; i += 3) {
                    baseVertices.push({
                        x: mesh.vertices[i]!,
                        z: mesh.vertices[i + 2]!
                    });
                }

                const xCoords = baseVertices.map(v => v.x);
                const zCoords = baseVertices.map(v => v.z);

                expect(Math.min(...xCoords)).toBeCloseTo(-2, 5);
                expect(Math.max(...xCoords)).toBeCloseTo(2, 5);
                expect(Math.min(...zCoords)).toBeCloseTo(-2, 5);
                expect(Math.max(...zCoords)).toBeCloseTo(2, 5);
            });

            it('should create pyramid with custom height', () => {
                const mesh = createPyramidMesh(1, 4);

                // Base should be at y = -2, apex at y = 2
                const baseY = mesh.vertices[1]!; // Y of first base vertex
                const apexY = mesh.vertices[13]!; // Y of apex vertex

                expect(baseY).toBeCloseTo(-2, 5);
                expect(apexY).toBeCloseTo(2, 5);
            });

            it('should handle very flat pyramid', () => {
                const mesh = createPyramidMesh(4, 0.1);

                // Should still have 5 vertices and proper structure
                expect(mesh.vertices.length).toBe(15);
                expect(mesh.indices.length).toBe(18);

                // Apex should be very close to base
                const baseY = mesh.vertices[1]!;
                const apexY = mesh.vertices[13]!;
                expect(Math.abs(apexY - baseY)).toBeCloseTo(0.1, 5);
            });

            it('should handle very tall pyramid', () => {
                const mesh = createPyramidMesh(1, 10);

                // Should still have 5 vertices and proper structure
                expect(mesh.vertices.length).toBe(15);
                expect(mesh.indices.length).toBe(18);

                // Apex should be far from base
                const baseY = mesh.vertices[1]!;
                const apexY = mesh.vertices[13]!;
                expect(Math.abs(apexY - baseY)).toBeCloseTo(10, 5);
            });
        });

        describe('Pyramid Topology', () => {
            it('should have valid triangle indices', () => {
                const mesh = createPyramidMesh();
                const vertexCount = mesh.vertices.length / 3;

                // All indices should be valid vertex indices
                for (let i = 0; i < mesh.indices.length; i++) {
                    expect(mesh.indices[i]).toBeGreaterThanOrEqual(0);
                    expect(mesh.indices[i]!).toBeLessThan(vertexCount);
                }

                // Indices should come in triplets (for triangles)
                expect(mesh.indices.length % 3).toBe(0);
            });

            it('should have exactly 5 vertices', () => {
                const mesh = createPyramidMesh(2, 3);
                expect(mesh.vertices.length / 3).toBe(5);
            });

            it('should have exactly 6 triangular faces', () => {
                const mesh = createPyramidMesh(1, 1);
                expect(mesh.indices.length / 3).toBe(6);
            });
        });
    });

    describe('Existing Mesh Functions (Regression)', () => {
        it('should still create cube mesh correctly', () => {
            const mesh = createCubeMesh(1);
            expect(mesh.vertices.length).toBe(24); // 8 vertices * 3 floats
            expect(mesh.indices.length).toBe(36); // 6 faces * 2 triangles * 3 indices
        });

        it('should still create triangle mesh correctly', () => {
            const mesh = createTriangleMesh(1);
            expect(mesh.vertices.length).toBe(9); // 3 vertices * 3 floats
            expect(mesh.indices.length).toBe(3); // 1 triangle * 3 indices
        });
    });
});
