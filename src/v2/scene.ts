import { WebGPURendererV2, MeshData, makeTransformMatrix, Entity } from './webgpu.renderer';

// Utility to create a simple triangle for testing
function createTriangleMesh(): MeshData {
  // Much larger triangle that should definitely be visible
  const vertices = new Float32Array([
    // Triangle vertices (x, y, z) - much larger!
     0.0,  2.0, 0.0,  // Top vertex
    -2.0, -2.0, 0.0,  // Bottom left
     2.0, -2.0, 0.0,  // Bottom right
  ]);

  // Just one triangle
  const indices = new Uint16Array([0, 1, 2]);

  return { vertices, indices };
}
function createCubeMesh(size: number): MeshData {
  const s = size / 2;
  // 8 vertices, each with x, y, z
  const vertices = new Float32Array([
    // Back face (z = -s)
    -s, -s, -s,  // 0
    s, -s, -s,   // 1
    s,  s, -s,   // 2
    -s,  s, -s,  // 3
    // Front face (z = s)
    -s, -s,  s,  // 4
    s, -s,  s,   // 5
    s,  s,  s,   // 6
    -s,  s,  s,  // 7
  ]);

  // Indices for 12 triangles (2 per face) - counter-clockwise winding
  const indices = new Uint16Array([
    // Back face (z = -s)
    0, 1, 2,  2, 3, 0,
    // Front face (z = s)
    4, 6, 5,  6, 4, 7,
    // Left face (x = -s)
    4, 0, 3,  3, 7, 4,
    // Right face (x = s)
    1, 5, 6,  6, 2, 1,
    // Bottom face (y = -s)
    4, 5, 1,  1, 0, 4,
    // Top face (y = s)
    3, 2, 6,  6, 7, 3,
  ]);

  return { vertices, indices };
}

async function main() {
  const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;

  try {
    // Check WebGPU support
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    const renderer = new WebGPURendererV2();
    await renderer.init(canvas);

    // Test with a simple triangle first
    const triangleMesh = createTriangleMesh();
    console.log('Triangle mesh created:', {
      vertexCount: triangleMesh.vertices.length / 3,
      triangleCount: triangleMesh.indices.length / 3,
      vertices: Array.from(triangleMesh.vertices),
      indices: Array.from(triangleMesh.indices)
    });

    renderer.registerMesh('triangle', triangleMesh);

    // Register a cube mesh
    const cubeMesh = createCubeMesh(2);
    console.log('Cube mesh created:', {
      vertexCount: cubeMesh.vertices.length / 3,
      triangleCount: cubeMesh.indices.length / 3,
      vertices: Array.from(cubeMesh.vertices),
      indices: Array.from(cubeMesh.indices)
    });

    renderer.registerMesh('cube', cubeMesh);

    // Add a test triangle first - make it REALLY obvious
    renderer.addEntity({
      id: 'triangle1',
      meshId: 'triangle',
      transform: makeTransformMatrix(0, 0, -1, 1), // Move it slightly forward
      color: [1, 0, 1, 1] // Bright magenta - very visible!
    } as Entity);

    // Add a few entities (cubes) with different transforms/colors
    const cube1Transform = makeTransformMatrix(-3, 0, 0, 1);
    const cube2Transform = makeTransformMatrix(3, 0, 0, 1);

    console.log('Cube transforms:', {
      cube1: Array.from(cube1Transform),
      cube2: Array.from(cube2Transform)
    });

    renderer.addEntity({
      id: 'cube1',
      meshId: 'cube',
      transform: cube1Transform,
      color: [1, 0, 0, 1] // Red
    } as Entity);

    renderer.addEntity({
      id: 'cube2',
      meshId: 'cube',
      transform: cube2Transform,
      color: [0, 1, 0, 1] // Green
    } as Entity);

    // Render once (single pass)
    renderer.render();

    console.log('✅ Rendering complete! Two cubes should be visible.');

  } catch (error) {
    console.error('❌ Error initializing WebGPU renderer:', error);
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
      errorDiv.style.display = 'block';
    }
  }
}

main();
