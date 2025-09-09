import { WebGPURendererV2, Entity } from './webgpu.renderer';
import { createCubeMesh } from './mesh-utils';
import { makeTransformMatrix } from './math-utils';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const vertexCountEl = document.getElementById('vertexCount')!;
const renderTimeEl = document.getElementById('renderTime')!;
const fpsEl = document.getElementById('fps')!;

const renderer = new WebGPURendererV2();
await renderer.init(canvas);

// Brick wall parameters
const brickW = 1, brickH = 0.5, brickD = 1;
const halfBrickW = 0.5, halfBrickH = 0.5, halfBrickD = 1;
const bricksPerRow = 30;
const rows = 100;
const brickColor: [number, number, number, number] = [0.8, 0.3, 0.1, 1.0];
const halfBrickColor: [number, number, number, number] = [0.7, 0.2, 0.1, 1.0];

const meshId = 'brick';
const halfMeshId = 'halfBrick';
renderer.registerMesh(meshId, createCubeMesh(brickW));
renderer.registerMesh(halfMeshId, createCubeMesh(halfBrickW));

const brickQueue: Entity[] = [];
let vertexCount = 0;
for (let row = 0; row < rows; row++) {
    const y = row * brickH;
    const isOdd = row % 2 !== 0;
    const offset = isOdd ? brickW / 2 : 0;
    // Left half brick for odd rows
    if (isOdd) {
        // Place left half brick flush with first full brick
        const firstFullX = 0 * brickW - (bricksPerRow * brickW) / 2 + offset;
        const hx = firstFullX - (brickW + halfBrickW) / 2;
        brickQueue.push({
            id: `half-left-${row}`,
            meshId: halfMeshId,
            transform: makeTransformMatrix([hx, y, 0], [halfBrickW, halfBrickH, halfBrickD]),
            color: halfBrickColor,
        });
    }
    // Number of full bricks: even rows = bricksPerRow, odd rows = bricksPerRow - 1
    const fullBricks = isOdd ? bricksPerRow - 1 : bricksPerRow;
    for (let col = 0; col < fullBricks; col++) {
        const x = col * brickW - (bricksPerRow * brickW) / 2 + offset;
        brickQueue.push({
            id: `brick-${row}-${col}`,
            meshId,
            transform: makeTransformMatrix([x, y, 0], [brickW, brickH, brickD]),
            color: brickColor,
        });
    }
    // Right half brick for odd rows
    if (isOdd) {
        // Place right half brick flush with last full brick
        const lastFullX = (fullBricks - 1) * brickW - (bricksPerRow * brickW) / 2 + offset;
        const hx = lastFullX + (brickW + halfBrickW) / 2;
        brickQueue.push({
            id: `half-right-${row}`,
            meshId: halfMeshId,
            transform: makeTransformMatrix([hx, y, 0], [halfBrickW, halfBrickH, halfBrickD]),
            color: halfBrickColor,
        });
    }
}

// Add bricks gradually every 10 frames
let brickIndex = 0;
const BRICKS_PER_BATCH = 1;
function addBricksBatch() {
    let added = 0;
    while (brickIndex < brickQueue.length && added < BRICKS_PER_BATCH) {
        renderer.addEntity(brickQueue[brickIndex]!);
        vertexCount += 8;
        brickIndex++;
        added++;
    }
    vertexCountEl.textContent = `Vertices: ${vertexCount}`;
}

// Camera/view-projection
function makeViewProjMatrix(): Float32Array {
    // Orthographic for wall, keep same screenspace but shift left
    const left = -20;
    const right = 20;
    const bottom = -2;
    const top = 52;
  const near = -20, far = 20;
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    return new Float32Array([
    -2 * lr, 0, 0, 0,
    0, -2 * bt, 0, 0,
    0, 0, 2 * nf, 0,
    (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1,
    ]);
}
renderer.setViewProjectionMatrix(makeViewProjMatrix());

// Render loop
const frameTimes: number[] = [];
const FRAMES_TO_AVG = 30;
let frameCounter = 0;
let lastFpsUpdate = performance.now();
let framesSinceFps = 0;
function renderLoop() {
    const start = performance.now();
    renderer.render();
    frameCounter = (frameCounter + 1) % 1000;
    const end = performance.now();
    frameTimes.push(end - start);
    if (frameTimes.length > FRAMES_TO_AVG) frameTimes.shift();
    if (frameTimes.length === FRAMES_TO_AVG) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / FRAMES_TO_AVG;
        renderTimeEl.textContent = `Render Time (avg): ${avg.toFixed(2)} ms`;
    }
    framesSinceFps++;
    if (performance.now() - lastFpsUpdate > 500) {
        const fps = (framesSinceFps * 1000) / (performance.now() - lastFpsUpdate);
        fpsEl.textContent = `FPS: ${fps.toFixed(1)}`;
        lastFpsUpdate = performance.now();
        framesSinceFps = 0;
    }
    // Add bricks every 10 frames
    if (brickIndex < brickQueue.length && frameCounter % 10 === 0) {
        addBricksBatch();
    }
    requestAnimationFrame(renderLoop);
}
renderLoop();
