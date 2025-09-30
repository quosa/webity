# Webity Toy Web Game Engine

```
:::       ::: :::::::::: ::::::::: ::::::::::: ::::::::::: :::   :::
:+:       :+: :+:        :+:    :+:    :+:         :+:     :+:   :+:
+:+       +:+ +:+        +:+    +:+    +:+         +:+      +:+ +:+
+#+  +:+  +#+ +#++:++#   +#++:++#+     +#+         +#+       +#++:
+#+ +#+#+ +#+ +#+        +#+    +#+    +#+         +#+        +#+
 #+#+# #+#+#  #+#        #+#    #+#    #+#         #+#        #+#
  ###   ###   ########## ######### ###########     ###        ###
```

This project was to vibe a ts -> wasm/zig -> webgpu pipeline with claude code.

## Features

### Core Engine
- **ECS-based Physics Engine** - 19.6KB optimized WASM module with 4-component architecture
- **GameObject/Component System** - Unity-style architecture with Transform, MeshRenderer, RigidBody
- **Scene Management System** - Complete lifecycle (awake → start → update → render) with multiple demo scenes
- **Copy-based WASM Integration** - Optimized data flow from physics simulation to rendering pipeline

### Physics & Simulation
- **Advanced Collision System** - Box-box, sphere-sphere, and sphere-box collision detection with GPT-5 stabilization
- **Real-time Physics** - Gravity, collision detection, force integration, and realistic bounce physics
- **Collision Resolution** - Proper penetration resolution, momentum conservation, and restitution handling
- **Multi-entity Support** - Handles 6,598+ entities at 60fps with proven performance baseline
- **Physics Documentation** - Comprehensive collision detection conventions in `src/core/CLAUDE.md`

### 3D Rendering Pipeline
- **WebGPU Renderer V2** - Modern GPU-accelerated rendering with instanced drawing
- **Mixed Geometry Support** - Triangles, cubes, spheres, wireframe grids with proper material handling
- **Smart Batching System** - Automatic optimization for uniform vs mixed mesh type scenes
- **Material System Foundation** - Color-coded materials (cyan spheres, orange cubes) ready for expansion

### Interactive Demo Scenes
- **Scene Browser** - Main entry point with visual scene selection interface
- **Basic Shapes** - Triangle, cube, pyramid, sphere rendering validation
- **Physics Demos** - Gravity simulation, collision detection, fancy physics showcase
- **Stack Tests** - Physics stabilization testing with play/pause controls for jitter analysis
- **Rain Particle System** - High-performance particle testing (5000+ entities)
- **Camera Controls** - 3D navigation with WASD movement and interactive controls

### Input System
- **Unified Keyboard & Gamepad** - Single InputController interface handles both input types
- **Configurable Gamepad Presets** - FPS camera, physics object, and orbit camera configurations
- **Virtual Key Mapping** - Gamepad inputs mapped to virtual keys (1000+ range) for consistency
- **Three Control Modes** - Camera movement, GameObject physics forces, and orbit camera controls

### Development & Quality Assurance
- **Comprehensive Test Suite** - 38+ TypeScript tests + 30+ Zig unit tests with collision matrix validation
- **Physics Testing** - Systematic collision detection and resolution test coverage
- **Build Pipeline** - TypeScript + WASM compilation with hot reload development server
- **HTTPS Development Server** - WebGPU-compatible server with self-signed certificates
- **Quality Commands** - Integrated typecheck, lint, test, and verify workflows
- **Developer Documentation** - Engine guides in `CLAUDE.md` files and scene development patterns

## Setup
```
npm install
npm run clean
npm run build
npm run verify
npm run dev
```

and open https://localhost:5173/

## Creating Your First Scene

### Basic Engine Initialization

```typescript
import { Scene } from '../engine/scene-system';
import { WebGPURendererV2 } from '../renderer/webgpu.renderer';
import { GameObject } from '../engine/gameobject';
import { MeshRenderer, RigidBody, CollisionShape } from '../engine/components';
import { createGridMesh, createCubeMesh } from '../renderer/mesh-utils';

async function initializeEngine() {
    // 1. Get canvas element
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
        throw new Error('Canvas element not found');
    }

    // 2. Initialize WebGPU renderer
    const renderer = new WebGPURendererV2();
    await renderer.init(canvas);

    // 3. Register meshes (must be done before creating GameObjects)
    renderer.registerMesh('cube', createCubeMesh());
    renderer.registerMesh('grid', createGridMesh(16, 16));

    // 4. Create and initialize scene
    const scene = new Scene();
    await scene.init(renderer);

    return { scene, renderer };
}
```

### Creating GameObjects with Physics

```typescript
async function createSimpleScene(scene: Scene): Promise<void> {
    // Create ground plane
    const ground = new GameObject('ground', 'Ground');
    ground.transform.setPosition(0, -8, 0); // World bounds is Y=-8

    // Add visual mesh (wireframe grid)
    const groundMesh = new MeshRenderer('grid', 'default', 'lines',
        { x: 0.5, y: 0.5, z: 0.5, w: 1 }); // Gray color
    ground.addComponent(groundMesh);
    scene.addGameObject(ground);

    // Create physics cube
    const cube = new GameObject('cube', 'PhysicsCube');
    cube.transform.setPosition(0, 2, 0);  // Start above ground
    cube.transform.setScale(1, 1, 1);

    // Add visual mesh (solid triangles)
    const cubeMesh = new MeshRenderer('cube', 'default', 'triangles',
        { x: 0, y: 1, z: 0, w: 1 }); // Green color
    cube.addComponent(cubeMesh);

    // Add physics (mass, gravity, collision shape, dimensions)
    const cubeRigidBody = new RigidBody(
        1.0,                          // mass
        true,                         // use gravity
        CollisionShape.BOX,           // collision shape
        { x: 0.5, y: 0.5, z: 0.5 }   // half-extents (cube size)
    );
    cube.addComponent(cubeRigidBody);

    scene.addGameObject(cube);

    // Position camera to see the scene
    scene.camera.setPosition([0, 3, -10]);
    scene.camera.lookAt([0, 0, 0]);

    console.log(`✅ Scene created with ${scene.getEntityCount()} GameObjects`);
}
```

### Complete Scene Setup

```typescript
async function main() {
    try {
        // Initialize engine
        const { scene, renderer } = await initializeEngine();

        // Create scene content
        await createSimpleScene(scene);

        // Set up input (optional)
        const cube = scene.findGameObjectByName('cube');
        if (cube) {
            scene.setInputTarget(cube); // WASD/gamepad controls
        }

        // Start scene lifecycle
        scene.start();

        // Game loop
        let lastTime = performance.now();
        const gameLoop = (currentTime: number) => {
            const deltaTime = Math.min((currentTime - lastTime) / 1000, 1/30);
            lastTime = currentTime;

            scene.update(deltaTime); // Physics + rendering
            requestAnimationFrame(gameLoop);
        };

        requestAnimationFrame(gameLoop);
        console.log('🎮 Engine initialized successfully');

    } catch (error) {
        console.error('Failed to initialize engine:', error);
    }
}

main().catch(console.error);
```

### Required HTML Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My 3D Scene</title>
    <style>
        canvas {
            display: block;
            margin: 20px auto;
            border: 2px solid #444;
        }
    </style>
</head>
<body>
    <canvas id="canvas" width="800" height="600"></canvas>
    <script type="module" src="./scene.ts"></script>
</body>
</html>
```

This creates a simple scene with:
- **Physics cube** that falls due to gravity and can be controlled with WASD/gamepad
- **Ground plane** for the cube to land on
- **Camera** positioned to view the action
- **Game loop** running physics simulation and rendering at 60fps

## Adding Input to Your Scene

The engine provides a unified input system supporting both keyboard and gamepad controls through the same `InputController` interface.

### Basic Setup

```typescript
import { Scene } from '../engine/scene-system';
import { GameObject } from '../engine/gameobject';
import { GAMEPAD_PRESETS } from '../engine/gamepad-input';

// In your scene setup function
async function createMyScene(scene: Scene): Promise<void> {
    // Create your GameObjects...
    const controllableObject = new GameObject('my-object', 'MyObject');
    // Add components (MeshRenderer, RigidBody, etc.)...
    scene.addGameObject(controllableObject);

    // Set input target for control
    scene.setInputTarget(controllableObject); // Control object with physics forces
    // OR scene.setInputTarget('camera');     // Control camera movement
    // OR scene.setInputTarget('orbit');      // Control orbit camera
}
```

### Gamepad Configuration

Set up gamepad presets for different control schemes:

```typescript
// Set gamepad configuration for physics object control
scene.setGamepadConfiguration(GAMEPAD_PRESETS['physics-object']);

// Switch configurations dynamically
scene.setGamepadConfiguration(GAMEPAD_PRESETS['fps-camera']);     // FPS camera controls
scene.setGamepadConfiguration(GAMEPAD_PRESETS['orbit-camera']);   // Orbit camera controls
```

### Default Controls

**Keyboard (WASD):**
- W/S: Forward/backward movement or camera movement
- A/D: Left/right movement or camera movement
- Space: Up movement or jump force
- \-: Down movement

**Gamepad (Xbox/PlayStation layout):**
- **Left Stick**: Movement control (X/Y axes)
- **Right Stick**: Camera look control (when in camera mode)
- **LB/RB (L1/R1)**: Up/down movement or forces
- **Triggers**: Configurable actions (zoom, additional forces)

**Physics Object Mode**: Applies forces to RigidBody GameObjects
**Camera Mode**: Direct camera movement in 3D space
**Orbit Camera Mode**: Orbit around a target point with zoom

### Complete Example

See `src/scenes/input-demo/scene.ts` for a full working example with:
- Controllable physics cube
- Ball stack for collision testing
- UI showing gamepad status and input mapping
- Configuration switching between control modes

## Documentation

### Developer Guides
- **`CLAUDE.md`** - Main project overview and development guidelines
- **`src/scenes/CLAUDE.md`** - Scene development patterns and conventions
- **`src/core/CLAUDE.md`** - Physics engine collision detection and resolution documentation

### Physics Engine Reference
The collision system uses a consistent "Object1 Point of View" convention documented in `src/core/CLAUDE.md`:
- All collision normals point in the direction Object1 needs to move to separate
- Comprehensive test matrix for all collision type combinations
- Proper kinematic vs dynamic object handling

## Claude Code Setup with LiteLLM Proxy

- check the environment variables in .env
- source cc.sh to start
