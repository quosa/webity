import { WebGPURendererV2, MeshData, Entity } from './webgpu.renderer';
import { Camera } from './camera';
import { makeTransformMatrix } from './math-utils';
import { createCubeMesh, createTriangleMesh, createGridMesh } from './mesh-utils';

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

    // Register a grid mesh for the floor
    const gridMesh = createGridMesh(20, 20);
    renderer.registerMesh('floor', gridMesh);

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

    // Add floor entity (XZ plane at y = -2) with line render mode
    renderer.addEntity({
      id: 'floor',
      meshId: 'floor',
      transform: makeTransformMatrix([0, -2, 0], 1),
      color: [0.2, 0.8, 0.2, 1], // Greenish grid lines for visibility
      renderMode: 'line'
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
