import { WebGPURendererV2, MeshData, makeTransformMatrix, Entity } from './webgpu.renderer';

// Utility to create a simple cube mesh
function createCubeMesh(size: number): MeshData {
  const s = size / 2;
  // 8 vertices, each with x, y, z
  const vertices = new Float32Array([
    // Back face
    -s, -s, -s,  s, -s, -s,  s,  s, -s,  -s,  s, -s,
    // Front face
    -s, -s,  s,  s, -s,  s,  s,  s,  s,  -s,  s,  s,
  ]);
  // Indices for 12 triangles (2 per face)
  const indices = new Uint16Array([
    // Back face
    0, 1, 2, 2, 3, 0,
    // Front face
    4, 5, 6, 6, 7, 4,
    // Left face
    0, 4, 7, 7, 3, 0,
    // Right face
    1, 5, 6, 6, 2, 1,
    // Top face
    3, 2, 6, 6, 7, 3,
    // Bottom face
    0, 1, 5, 5, 4, 0,
  ]);
  return { vertices, indices };
}

async function main() {
  const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
  const renderer = new WebGPURendererV2();
  await renderer.init(canvas);

  // Register a cube mesh
  renderer.registerMesh('cube', createCubeMesh(2));

  // Add a few entities (cubes) with different transforms/colors
  renderer.addEntity({
    id: 'cube1',
    meshId: 'cube',
    transform: makeTransformMatrix(-2, 0, 0, 1),
    color: [1, 0, 0, 1]
  } as Entity);
  renderer.addEntity({
    id: 'cube2',
    meshId: 'cube',
    transform: makeTransformMatrix(2, 0, 0, 1),
    color: [0, 1, 0, 1]
  } as Entity);

  // Render once (single pass)
  renderer.render();
}

main();
