# Scene Development Guide

This document provides guidance for Claude Code when developing scenes in this 3D game engine with ECS physics and WebGPU rendering.

## Scene Structure

Each scene follows a consistent structure:
```
src/
├── index.html           # Landing page scene browser
└── scenes/
    ├── index.html       # Default static scene
    ├── scene.ts         # Static scene implementation
    └── [scenario-name]/ # Individual scenario folders
        ├── index.html   # Scene-specific HTML page
        └── scene.ts     # Scene TypeScript implementation
```

## Adding a New Scene/Scenario

When creating a new scene, follow these steps:

### 1. Create Scene Directory and Files

Create a new folder under `src/scenes/` with the scenario name:
```bash
mkdir src/scenes/new-scenario-name
```

Create the two required files:
- `src/scenes/new-scenario-name/index.html` - HTML page for the scene
- `src/scenes/new-scenario-name/scene.ts` - TypeScript scene implementation

### 2. HTML Template Structure

Use this template for `index.html`:
```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Scene Name - WebGPU Engine</title>
        <style>
            /* Add scene-specific styles */
        </style>
    </head>
    <body>
        <!-- Scene content and controls -->
        <canvas id="canvas" width="800" height="600"></canvas>

        <!-- CRITICAL: Always load ./scene.ts -->
        <script type="module" src="./scene.ts"></script>
    </body>
</html>
```

### 3. TypeScript Scene Structure

Structure your `scene.ts` file (scene-first Engine API):
```typescript
// Import from the engine
import { Engine } from '../../engine/engine.js';
import { Scene } from '../../engine/scene-system.js';
import { GameObject } from '../../engine/gameobject.js';
import { MeshRenderer, RigidBody, CollisionShape } from '../../engine/components.js';
import { Mesh } from '../../engine/mesh.js';
import { Material } from '../../engine/material.js';

// Create the scene as PURE DATA — GameObjects reference Mesh/Material objects. No renderer
// or WASM here; the Engine registers everything at loadScene().
function createMyScene(): Scene {
    const scene = new Scene();

    const entity = new GameObject('EntityName');
    entity.transform.setPosition(0, 0, -5);
    entity.addComponent(new MeshRenderer(
        Mesh.createCube('cube', 1),
        new Material('green', { r: 0, g: 1, b: 0, a: 1 }),
    ));
    // RigidBody(mass, useGravity, collisionShape, extents, { kinematic })
    entity.addComponent(new RigidBody(1.0, true, CollisionShape.BOX, { x: 0.5, y: 0.5, z: 0.5 }));

    scene.addGameObject(entity);
    return scene;
}

async function main() {
    const engine = new Engine('canvas'); // canvas element id
    await engine.init();                  // WebGPU + renderer
    const scene = createMyScene();        // pure data
    await engine.loadScene(scene);        // mount: upload meshes, register entities (fail-loud)
    engine.start();                  // loop: input → physics → update → render
}

main().catch(console.error);
```

### 4. Update Landing Page

**ALWAYS** add the new scene to `src/index.html` landing page:
```html
<a href="./scenes/new-scenario-name/" class="scene-card">
    <div class="scene-title">Scene Title</div>
    <div class="scene-description">
        Brief description of what this scene demonstrates
    </div>
</a>
```

## Critical Consistency Rules

### Rule 1: HTML Script Source
**ALWAYS** ensure `index.html` loads `./scene.ts`:
```html
<script type="module" src="./scene.ts"></script>
```

Never use old naming patterns like `test-*.ts` or other filenames.

### Rule 2: File Naming Convention
- Folder: `kebab-case-name`
- HTML: Always `index.html`
- TypeScript: Always `scene.ts`

### Rule 3: Import Paths
From scene folders, use these import paths with .js extensions:
- Engine: `../../engine/` (e.g., `../../engine/scene-system.js`)
- Renderer: `../../renderer/` (e.g., `../../renderer/webgpu.renderer.js`)
- Utils: `../../utils/` (e.g., `../../utils/math-utils.js`)

### Rule 4: Landing Page Updates
When adding a new scene, you MUST update `src/index.html` to include a link to it in the scene grid.

## GameObject and Component System

### Available Components

**Transform** (automatic on all GameObjects):
```typescript
entity.transform.setPosition(x, y, z);
entity.transform.setRotation(rx, ry, rz); // Euler angles in degrees
entity.transform.setScale(sx, sy, sz);
```

**MeshRenderer** (visual appearance) — object mode (`Mesh` + `Material`):
```typescript
new MeshRenderer(mesh, material?, renderMode?)
// mesh:       a Mesh — Mesh.createCube/createSphere/createGrid/createPyramid/createTriangle(id, ...)
// material:   a Material (defaults to Material.default — the magenta placeholder)
// renderMode: 'triangles' (default) or 'lines' (wireframe)
```

**RigidBody** (physics simulation) — BodyType model (DYNAMIC/KINEMATIC/STATIC):
```typescript
new RigidBody(mass, useGravity, collisionShape?, extents?, opts?)
// mass:           ACTIVE on DYNAMIC bodies (must be > 0; invalid values clamp to 1 with a
//                 warning); stored-but-inert on KINEMATIC; ignored on STATIC
// useGravity:     legacy bool -> gravityScale 1/0; prefer opts.gravityScale
//                 (1.0 normal, 0.0 space — still simulated/collides, 0.16 moon)
// collisionShape: CollisionShape.SPHERE (default) | BOX | PLANE
// extents:        half-extents (box) / radius in .x (sphere)
// opts:           { bodyType?: BodyType, gravityScale?: number, kinematic?: boolean }
// KINEMATIC/STATIC bodies are immovable colliders regardless of mass.
// For a fixed, collidable surface use RigidBody.staticBody(shape, extents) (STATIC).
// Runtime transitions: rb.setBodyType(BodyType.DYNAMIC) — stored mass goes live.
// NOTE (B8): TS transforms of dynamic bodies are NOT auto-synced from physics each
// frame; call rb.syncFromWasm() when game logic needs the simulated position/velocity.
```

### Scene Lifecycle
1. **Scene creation** — build GameObjects + components as pure data (the Scene holds no renderer/WASM).
2. **Engine.init()** — create the WebGPU renderer.
3. **Engine.loadScene(scene)** — MOUNT: upload the scene's meshes and register its entities with
   WASM in one fail-loud pass, then run `awake()`.
4. **Engine.start(scene)** — start the scene and run the frame loop (input → physics → update → render).

## Scene-Specific Systems

For scene-specific systems (like rain-system, custom components):
- Place them in the scene folder alongside `scene.ts`
- Import them relatively: `./system-name.js`
- Keep engine/renderer imports pointing to `../../engine/` or `../../renderer/`

## Scene Examples and Patterns

### Physics Scene Pattern
```typescript
// Dynamic ball
const ball = new GameObject('Ball');
ball.transform.setPosition(0, 3, 0);
ball.addComponent(new MeshRenderer(Mesh.createSphere('sphere', 0.5), new Material('red', { r: 1, g: 0, b: 0, a: 1 })));
ball.addComponent(new RigidBody(1.0, true, CollisionShape.SPHERE, { x: 0.5, y: 0.5, z: 0.5 })); // dynamic

// Decorative floor grid (no RigidBody = static visual only — not a collider)
const floor = new GameObject('Floor');
floor.transform.setPosition(0, -2, 0);
floor.addComponent(new MeshRenderer(Mesh.createGrid('grid', 20, 20), new Material('gray', { r: .5, g: .5, b: .5, a: 1 }), 'lines'));
```

### Performance Testing Pattern
```typescript
// Many entities for performance testing — reuse one Mesh/Material across instances.
const sphere = Mesh.createSphere('sphere', 0.5);
const white = new Material('white', { r: 1, g: 1, b: 1, a: 1 });
for (let i = 0; i < 100; i++) {
    const entity = new GameObject(`Entity${i}`);
    entity.transform.setPosition(
        Math.random() * 10 - 5,
        Math.random() * 10,
        Math.random() * 10 - 5,
    );
    entity.addComponent(new MeshRenderer(sphere, white));
    entity.addComponent(new RigidBody(0.1, true, CollisionShape.SPHERE, { x: 0.5, y: 0.5, z: 0.5 }));
    scene.addGameObject(entity);
}
```

## Testing New Scenes

After creating a scene:
1. Check the landing page links to your scene correctly
2. Verify the scene loads without import errors
3. Test that the HTML properly loads the TypeScript scene
4. **ALWAYS run `npm run verify`** to ensure no build/lint/test issues
5. Test physics simulation if using RigidBody components
6. Verify WebGPU rendering works correctly

## Example Scene Locations

- Basic shapes: `src/scenes/basic-shapes/cube/`, `src/scenes/basic-shapes/triangle/`
- Physics demos: `src/scenes/physics/`, `src/scenes/physics-system/`
- Particle systems: `src/scenes/rain/`
- Interactive demos: `src/scenes/camera-controls/`

## Common Mistakes to Avoid

1. ❌ **Wrong script src**: `<script src="./test-something.ts">`
   ✅ **Correct**: `<script src="./scene.ts">`

2. ❌ **Forgetting landing page**: Not adding scene link to `src/index.html`
   ✅ **Correct**: Always update the landing page

3. ❌ **Wrong import paths**: `import from './engine/scene-system'`
   ✅ **Correct**: `import from '../../engine/scene-system.js'` (note .js extension)

4. ❌ **Inconsistent naming**: `my_scene.ts`, `testScene.ts`
   ✅ **Correct**: Always `scene.ts`

5. ❌ **Missing .js extensions**: `import from '../../engine/scene-system'`
   ✅ **Correct**: `import from '../../engine/scene-system.js'` (required for ES modules)

6. ❌ **Mounting by hand**: calling `scene.start()` without `await engine.loadScene(scene)`
   ✅ **Correct**: `await engine.loadScene(scene)` (uploads meshes + registers entities) then `engine.start()`

7. ❌ **Reading simulated positions without a pull**: `entity.transform.position` of a dynamic
   body is NOT auto-updated from physics each frame (B8)
   ✅ **Correct**: call `rigidBody.syncFromWasm()` first (or `bridge.syncAllGameObjectsFromWasm()`)

## Current Engine Status

- ✅ **ECS Physics Engine** - 19.6KB optimized WASM with 4-component architecture
- ✅ **GameObject/Component System** - Unity-style architecture fully implemented
- ✅ **WebGPU Rendering** - Modern GPU pipeline with copy-based WASM integration
- 🎯 **Current Priority** - Stage B instanced rendering (see docs/instanced-rendering-refactor-plan.md)

**Performance Baseline**: 6,598+ entity rendering at 60fps with all 38+ tests passing