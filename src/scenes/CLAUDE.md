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

Structure your `scene.ts` file:
```typescript
// Import from engine and renderer
import { Scene } from '../../engine/scene-system.js';
import { WebGPURenderer } from '../../renderer/webgpu.renderer.js';
import { GameObject } from '../../engine/gameobject.js';
import { Transform, MeshRenderer, RigidBody } from '../../engine/components.js';

// Create scene with GameObjects
export async function createMyScene(): Promise<Scene> {
    const scene = new Scene();

    // Create GameObject with components
    const entity = new GameObject('EntityName');
    entity.transform.position.set(0, 0, -5);
    entity.addComponent(new MeshRenderer('cube', 'triangles'));
    entity.addComponent(new RigidBody(1.0, false)); // mass, kinematic

    scene.addGameObject(entity);
    return scene;
}

// Main scene initialization
async function main() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const renderer = new WebGPURenderer();

    await renderer.init(canvas);
    const scene = await createMyScene();
    await scene.init();

    scene.start(); // Begin game loop
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
entity.transform.position.set(x, y, z);
entity.transform.rotation.set(rx, ry, rz); // Euler angles in degrees
entity.transform.scale.set(sx, sy, sz);
```

**MeshRenderer** (visual appearance):
```typescript
new MeshRenderer(meshId, renderMode)
// meshId: 'triangle', 'cube', 'sphere', 'pyramid', 'grid'
// renderMode: 'triangles', 'lines' (wireframe)
```

**RigidBody** (physics simulation):
```typescript
new RigidBody(mass, kinematic)
// mass: Physics mass (0 = infinite mass)
// kinematic: true = no physics forces, false = full physics
```

### Scene Lifecycle
1. **Scene Creation** - Set up GameObjects and components
2. **Scene.init()** - Initialize WASM bridge and register entities with physics
3. **Scene.awake()** - Initialize all GameObjects and their components
4. **Scene.start()** - Start scene systems and begin game loop
5. **Scene.update()** - Per-frame updates (physics simulation and rendering)

## Scene-Specific Systems

For scene-specific systems (like rain-system, custom components):
- Place them in the scene folder alongside `scene.ts`
- Import them relatively: `./system-name.js`
- Keep engine/renderer imports pointing to `../../engine/` or `../../renderer/`

## Scene Examples and Patterns

### Physics Scene Pattern
```typescript
// Create physics entities that interact
const ball = new GameObject('Ball');
ball.transform.position.set(0, 3, 0);
ball.addComponent(new MeshRenderer('sphere', 'triangles'));
ball.addComponent(new RigidBody(1.0, false)); // Dynamic physics

// Static floor
const floor = new GameObject('Floor');
floor.transform.position.set(0, -2, 0);
floor.addComponent(new MeshRenderer('grid', 'lines'));
// No RigidBody = static geometry
```

### Performance Testing Pattern
```typescript
// Many entities for performance testing
for (let i = 0; i < 100; i++) {
    const entity = new GameObject(`Entity${i}`);
    entity.transform.position.set(
        Math.random() * 10 - 5,
        Math.random() * 10,
        Math.random() * 10 - 5
    );
    entity.addComponent(new MeshRenderer('sphere', 'triangles'));
    entity.addComponent(new RigidBody(0.1, false));
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

6. ❌ **Forgetting scene initialization**: Not calling `await scene.init()` before `scene.start()`
   ✅ **Correct**: Always initialize WASM bridge before starting

## Current Engine Status

- ✅ **ECS Physics Engine** - 19.6KB optimized WASM with 4-component architecture
- ✅ **GameObject/Component System** - Unity-style architecture fully implemented
- ✅ **WebGPU Rendering** - Modern GPU pipeline with copy-based WASM integration
- 🎯 **Current Priority** - Physics collision system improvements (see main game plan)

**Performance Baseline**: 6,598+ entity rendering at 60fps with all 38+ tests passing