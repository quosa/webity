# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern **3D Game Engine** built with TypeScript, WebAssembly (Zig), and WebGPU. The project features:

- **ECS-based Physics Engine** (Zig/WASM) - 19.6KB optimized with 4-component architecture
- **GameObject/Component System** - Unity-style architecture with Transform, MeshRenderer, RigidBody
- **WebGPU Rendering Pipeline** - Modern GPU-accelerated 3D graphics
- **Scene Management System** - Multiple demo scenes with physics simulation
- **Copy-based WASM Integration** - Optimized data flow from physics to rendering

## Project Structure

```
src/
├── core/                    # Zig WASM physics engine (ECS-based)
│   ├── game_core.zig        # Pure physics logic and math
│   ├── *_test.zig           # Zig unit tests
│   └── game_engine.zig      # WASM wrapper/exports
├── engine/                  # TypeScript engine core
│   ├── scene-system.ts      # Scene and GameObject management
│   ├── components.ts        # Transform, MeshRenderer, RigidBody
│   ├── wasm-physics-bridge.ts # WASM integration layer
│   └── wasm-loader.ts       # WASM module loading
├── renderer/                # WebGPU rendering pipeline
│   ├── webgpu.renderer.ts   # Main rendering system
│   ├── gpu-buffer-manager.ts # GPU buffer management
│   └── mesh-utils.ts        # Mesh generation utilities
├── scenes/                  # Demo scenes and scene browser
│   ├── physics/             # Physics demonstration scenes
│   ├── rain/                # Particle system demo
│   └── basic-shapes/        # Geometry rendering tests
├── utils/                   # Math utilities and helpers
└── index.html               # Scene browser (main entry point)
```

## Key Files

- `src/index.html` - **Main Scene Browser** with links to all demo scenes
- `src/core/game_engine.zig` - WASM physics engine with ECS architecture
- `src/engine/scene-system.ts` - GameObject/Component system core
- `src/renderer/webgpu.renderer.ts` - WebGPU rendering pipeline
- `public/game_engine.wasm` - Compiled physics engine (generated)
- `GAME_ENGINE_PLAN.md` - Master development plan and progress tracking

## Build Commands

**Build everything (TypeScript + WASM):**
```bash
npm run clean
npm run build
```

**Build WASM physics engine:**
```bash
npm run build:wasm
# Compiles src/core/game_engine.zig to public/game_engine.wasm
```

**Build TypeScript:**
```bash
npm run build:vite
```

## Development Server

Start the development server with hot reload:
```bash
npm run dev
```
Then open https://localhost:5173 in a browser (requires HTTPS for WebGPU).

NOTE: do not start multiple servers as they will open on different ports.

**Main Entry Point:** Scene Browser at `src/index.html` with links to all demo scenes.

## Architecture

The engine uses a **layered architecture** with clear separation of concerns:

### WASM Physics Layer (Zig)
- **ECS Components:** PhysicsComponent, RenderingComponent, RotatorComponent, EntityMetadata
- **Physics Simulation:** Gravity, collision detection, force integration
- **Memory Layout:** Optimized for hot/cold data separation and GPU buffer copying
- **Exports:** Entity management, physics simulation, buffer access functions

### TypeScript Engine Layer
- **GameObject System:** Unity-style GameObjects with component composition
- **Scene Management:** Scene lifecycle (awake → start → update → render)
- **WASM Bridge:** Data synchronization between TypeScript GameObjects and WASM entities
- **Component Types:** Transform, MeshRenderer, RigidBody with full lifecycle support

### WebGPU Rendering Layer
- **Modern Pipeline:** Vertex/fragment shaders, instanced rendering, GPU buffers
- **Copy-based Integration:** WASM entity data → TypeScript → GPU buffers
- **Multi-mesh Support:** Triangles, cubes, spheres, wireframe grids
- **Performance:** Maintains 60fps with thousands of entities

### Data Flow
```
GameObject Components (TypeScript)
        ↓ (registration)
WASM ECS Entities (Zig Physics)
        ↓ (simulation)
GPU Instance Buffers (WebGPU)
        ↓ (rendering)
Canvas Output
```

## Prerequisites

- **Node.js 18+** for TypeScript build system
- **Zig 0.16.0+** for WASM physics engine compilation
- **Modern Browser** with WebGPU support (Chrome, Edge, Firefox)
- **HTTPS Required** for WebGPU (development server provides self-signed cert)

## Development Workflow

**Quality Assurance (ALWAYS run before completing tasks):**
```bash
npm run verify
# Runs: typecheck + lint + test + test:wasm
# All 38+ tests must pass
```

**Testing:**
```bash
npm test              # TypeScript/Jest tests
npm run test:wasm     # Zig unit tests
npm run test:watch    # Watch mode for development
```

**Visual Testing:**
When asked to check visual output or take a screenshot:
1. Navigate to https://localhost:5173/ (accept self-signed certificate)
2. Use Scene Browser to test specific functionality
3. Take screenshots for validation

**Available Demo Scenes:**
- **Basic Shapes:** Triangle, cube, pyramid, sphere rendering
- **Physics:** Gravity simulation, collision detection
- **Rain:** Particle system performance testing
- **Camera Controls:** 3D navigation and movement

**Browser rendering Tests:**
There are additional playwright browser rendering tests in `browser-tests/` as a separate suite. The test file is in `src/scenes/renderer` and can be run with:
```
cd browser-tests
npm install
npm test
```

## Important Development Notes

**Quality Standards:**
- **ALWAYS run `npm run verify` before declaring any phase or task complete**
- The verify command runs: `npm run typecheck && npm run lint && npm test && npm run test:wasm`
- All 38+ tests must pass (TypeScript + Zig) with no TypeScript or linting errors
- This ensures code quality and prevents regressions between development phases

**Current Status:**
- ✅ **Renderer V2 Integration** - Completed with copy-based WASM integration
- ✅ **ECS Architecture** - 4-component system fully implemented
- ✅ **GameObject System** - Unity-style architecture working
- 🎯 **Current Priority** - Physics collision system improvements (Phase 8)

**Performance Baseline:**
- 19.6KB optimized WASM module
- 6,598+ entity rendering at 60fps
- All 38+ tests passing with comprehensive coverage

**Development Philosophy:**
- WASM handles physics simulation and collision detection
- TypeScript handles scene management and rendering coordination
- WebGPU handles high-performance 3D graphics rendering
- Copy-based integration provides robust data flow (zero-copy not feasible)

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

# project-specific-notes
- This is a mature 3D game engine with comprehensive test coverage
- Focus on code quality and maintaining the 38+ test baseline
- Physics collision improvements are the current development priority
- Scene system provides multiple working demos for testing and validation
