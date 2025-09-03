import { WebGPURendererV2, MeshData, Entity } from './webgpu.renderer';
import { Camera } from './camera';
import { makeTransformMatrix } from './math-utils';

// Utility to create a simple triangle for testing
function createTriangleMesh(): MeshData {
  const vertices = new Float32Array([
    // Triangle vertices (x, y, z) - reasonable size triangle
    0.0,  1.5, 0.0,  // Top vertex
    -1.5, -1.5, 0.0,  // Bottom left
    1.5, -1.5, 0.0,  // Bottom right
  ]);

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

    // Create camera
    const camera = new Camera([0, 0, -10], [0, 0, 0]); // Camera behind scene, looking forward

    const renderer = new WebGPURendererV2();
    await renderer.init(canvas);

    // Set view-projection matrix once (calculated by camera)
    const aspect = canvas.width / canvas.height;
    const viewProjectionMatrix = camera.getViewProjectionMatrix(aspect);
    renderer.setViewProjectionMatrix(viewProjectionMatrix);

    // Test with a simple triangle first
    const triangleMesh = createTriangleMesh();
    renderer.registerMesh('triangle', triangleMesh);

    // Register a cube mesh
    const cubeMesh = createCubeMesh(2);
    renderer.registerMesh('cube', cubeMesh);

    // Add cubes - position them in positive Z (in front of camera)
    let cube1Transform = makeTransformMatrix([-3, 0, 5], 1);
    let cube2Transform = makeTransformMatrix([3, 0, 5], 1);

    renderer.addEntity({
      id: 'cube1',
      meshId: 'cube',
      transform: cube1Transform,
      color: [0, 1, 0, 1] // Green
    } as Entity);

    renderer.addEntity({
      id: 'cube2',
      meshId: 'cube',
      transform: cube2Transform,
      color: [0, 0, 1, 1] // Blue
    } as Entity);

    // Add triangle in front of cubes
    const triangleTransform = makeTransformMatrix([0, 0, 5], 1);

    renderer.addEntity({
      id: 'triangle1',
      meshId: 'triangle',
      transform: triangleTransform,
      color: [1, 0, 0, 1] // Red
    } as Entity);

    // Render once (single pass)
    let i = 0;
    while (i < 180) {
      cube1Transform = makeTransformMatrix([-3 + i/100, 0, 5], 1); // move right
      renderer.updateEntity('cube1', { transform: cube1Transform });
      cube2Transform = makeTransformMatrix([3, 0, 5], 1, [0, 0 + i/100, 0]); // rotate on Y-axis
      renderer.updateEntity('cube2', { transform: cube2Transform });
      await new Promise(resolve => setTimeout(resolve, 100));
      renderer.render();
      i++;
    }
    console.log('🎥 Animation complete 🏆');
    // renderer.render();

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
