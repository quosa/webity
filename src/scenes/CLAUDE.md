# Scene Management Guide

This document provides guidance for Claude Code when working with scenes in this WebGPU engine project.

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
import { Scene } from '../../engine/scene-system';
import { WebGPURendererV2 } from '../../renderer/webgpu.renderer';
import { GameObject } from '../../engine/gameobject';
// ... other imports

// Implement your scene logic
async function initScene() {
    // Scene initialization
}

// Export or call initialization
initScene().catch(console.error);
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
From scene folders, use these import paths:
- Engine: `../../engine/`
- Renderer: `../../renderer/`
- Utils: `../../utils/`

### Rule 4: Landing Page Updates
When adding a new scene, you MUST update `src/index.html` to include a link to it in the scene grid.

## Scene-Specific Systems

For scene-specific systems (like rain-system, custom components):
- Place them in the scene folder alongside `scene.ts`
- Import them relatively: `./system-name`
- Keep engine/renderer imports pointing to `../../engine/` or `../../renderer/`

## Testing New Scenes

After creating a scene:
1. Check the landing page links to your scene correctly
2. Verify the scene loads without import errors
3. Test that the HTML properly loads the TypeScript scene
4. Run `npm run verify` to ensure no build/lint/test issues

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
   ✅ **Correct**: `import from '../../engine/scene-system'`

4. ❌ **Inconsistent naming**: `my_scene.ts`, `testScene.ts`
   ✅ **Correct**: Always `scene.ts`