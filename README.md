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
- **Real-time Physics** - Gravity, collision detection, force integration, and realistic bounce physics
- **Entity-Entity Collisions** - Sphere-sphere collision detection with elastic collision response
- **Boundary Collision System** - Floor and wall collision detection with proper restitution
- **Multi-entity Support** - Handles 6,598+ entities at 60fps with proven performance baseline

### 3D Rendering Pipeline
- **WebGPU Renderer V2** - Modern GPU-accelerated rendering with instanced drawing
- **Mixed Geometry Support** - Triangles, cubes, spheres, wireframe grids with proper material handling
- **Smart Batching System** - Automatic optimization for uniform vs mixed mesh type scenes
- **Material System Foundation** - Color-coded materials (cyan spheres, orange cubes) ready for expansion

### Interactive Demo Scenes
- **Scene Browser** - Main entry point with visual scene selection interface
- **Basic Shapes** - Triangle, cube, pyramid, sphere rendering validation
- **Physics Demos** - Gravity simulation, collision detection, fancy physics showcase
- **Rain Particle System** - High-performance particle testing (5000+ entities)
- **Camera Controls** - 3D navigation with WASD movement and interactive controls

### Development & Quality Assurance
- **Comprehensive Test Suite** - 38+ TypeScript tests + 28+ Zig unit tests with full coverage
- **Build Pipeline** - TypeScript + WASM compilation with hot reload development server
- **HTTPS Development Server** - WebGPU-compatible server with self-signed certificates
- **Quality Commands** - Integrated typecheck, lint, test, and verify workflows

## Setup
```
npm install
npm run clean
npm run build
npm run verify
npm run dev
```

and open https://localhost:5173/


## Claude Code Setup with LiteLLM Proxy

- check the environment variables in .env
- source cc.sh to start
