# Physics and Colliders Restoration Plan

**🔗 LINKED TO: `GAME_ENGINE_PLAN.md` Phase 8 - Physics & Collision System Completion**

## Current Status Update (September 2025)

**✅ RESOLVED Issues:**
1. **✅ Stacked Balls Collision Fixed**: Entity-entity sphere collision detection working correctly - balls stack, bounce, and interact properly
2. **✅ Grid Rendering Fixed**: Depth buffer configuration corrected - grid floor renders behind physics objects as expected
3. **✅ Bridge Integration Complete**: Real WASM physics integration working with TypeScript GameObject/Component system

**🎯 CURRENT PRIORITY: Box Collider Implementation**

The main remaining issue is **missing box/cube collision support**:

1. **Only Sphere Collision Implemented**: All entities currently use sphere collision volumes, even cubes
2. **Missing Box Collision Functions**: No box-box or sphere-box collision detection in WASM core
3. **Limited Collision Shapes**: PhysicsComponent only has `radius` field, no `extents` for boxes

## Root Cause Analysis (Updated)

**✅ RESOLVED Issues:**
- ✅ `WasmPhysicsBridge` - Real physics integration implemented, no more placeholders
- ✅ `RigidBody` component - Full WASM synchronization working, TODOs resolved
- ✅ Entity-entity collisions - Fully enabled and working for sphere collision
- ✅ WebGPU depth buffer - Properly configured, correct rendering order

**🎯 NEW Analysis - Box Collider Gap:**
From comprehensive code examination of `src/core/` Zig files:
- ✅ **Sphere collision system is robust**: `checkSphereCollision()`, `resolveSphereCollisionWithKinematic()` fully implemented
- ❌ **Box collision functions missing**: No `checkBoxCollision()`, `resolveBoxCollision()`, or `checkSphereBoxCollision()`
- ❌ **Physics component limitations**: Only `radius: f32` field, missing `extents: Vec3` for box dimensions
- ❌ **No collision shape differentiation**: All entities treated as spheres regardless of mesh type

## Phase 1: Box Collision Core Implementation ✅ **FOUNDATION COMPLETE**

### ✅ **Current Sphere Collision Status**
- ✅ Comprehensive Zig unit tests for sphere-sphere collision (6 tests in `collision_test.zig`)
- ✅ Robust collision response with kinematic/dynamic body support
- ✅ Position correction, velocity updates, and energy conservation working
- ✅ Entity-entity collision detection fully enabled and functional
- ✅ Integration tests proving collision works with multiple entities
- ✅ All collision tests passing: kinematic vs dynamic, dynamic vs dynamic, etc.

### 🎯 **Phase 1 NEW: Box Collision Foundation**
- [ ] **Add Collision Shape Types**: Extend `PhysicsComponent` with collision shape enum and extents
- [ ] **Implement Core Box Functions**: `checkBoxCollision()`, `resolveBoxCollision()` in `game_core.zig`
- [ ] **Add Mixed Collision Support**: `checkSphereBoxCollision()` for sphere-box interactions
- [ ] **Create Box Collision Tests**: Unit tests for box-box and sphere-box collision scenarios

### Success Criteria
- Box collision detection algorithms implemented and tested
- Mixed collision combinations (sphere-box) working correctly
- Position correction and velocity updates for box shapes

## Phase 2: WASM API Extension for Box Colliders ✅ **BRIDGE COMPLETE**

### ✅ **Current TypeScript-WASM Bridge Status**
- ✅ Real `WasmPhysicsBridge` implementation with actual WASM physics integration
- ✅ Complete `RigidBody` component synchronization working
- ✅ Real-time entity transform updates from WASM memory buffers
- ✅ Full collision state synchronization and event propagation
- ✅ GameObject transforms update correctly from physics simulation

### 🎯 **Phase 2 NEW: Box Collider WASM API**
- [ ] **Add Box Collider WASM Exports**: `set_entity_collision_shape()`, `set_entity_extents()`
- [ ] **Extend ECS API**: Update `add_entity()` to accept collision shape and box extents
- [ ] **Add Debug Functions**: `debug_get_entity_collision_info()` for box collision debugging
- [ ] **Update Buffer Access**: Ensure box collision metadata accessible from TypeScript

### Success Criteria
- TypeScript can set collision shape (SPHERE/BOX) and box extents via WASM API
- RigidBody component supports both sphere and box collider configuration
- Debug functions provide visibility into box collision properties

## Phase 3: TypeScript Box Collider Integration ✅ **RENDERING FIXED**

### ✅ **Grid Rendering Issues Resolved**
- ✅ WebGPU depth buffer properly configured in renderer
- ✅ Depth testing enabled and working correctly for all objects
- ✅ Grid renders behind/under physics objects as expected
- ✅ No visual artifacts, proper z-buffer configuration confirmed

### 🎯 **Phase 3 NEW: TypeScript Box Collider Support**
- [ ] **Update RigidBody Component**: Add `colliderShape` and `extents` properties
- [ ] **Extend GameObject API**: Support box collider creation in scene setup
- [ ] **Update Scene Integration**: Automatically set collision shape based on MeshRenderer type
- [ ] **Add Collider Configuration**: Methods to switch between sphere/box collision at runtime

### Success Criteria
- RigidBody component supports both `ColliderShape.SPHERE` and `ColliderShape.BOX`
- GameObjects with cube MeshRenderer automatically use box collision
- Scene creation patterns support mixed collision types seamlessly

## Phase 4: Mixed Collision Scene Testing ✅ **SPHERE SCENES WORKING**

### ✅ **Current Scene Integration Status**
- ✅ Comprehensive physics scene tests working (`src/scenes/physics/scene.ts`)
- ✅ Browser-based visual validation confirmed
- ✅ Multiple sphere entities with realistic collision responses
- ✅ Physics simulation stability over time verified
- ✅ Performance benchmarks: 60fps with 6,598+ entities
- ✅ Stacked sphere scenarios working perfectly
- ✅ Grid rendering correctly under all physics objects

### 🎯 **Phase 4 NEW: Mixed Collision Type Scenes**
- [ ] **Create Mixed Collision Demos**: Scenes with both sphere and box entities
- [ ] **Box Stacking Tests**: Cube towers with proper box-box collision
- [ ] **Sphere-Box Interaction**: Balls bouncing off cube platforms and walls
- [ ] **Performance Testing**: Verify 60fps maintained with mixed collision types
- [ ] **Visual Validation**: Browser tests confirming proper box collision volumes

### Success Criteria
- Mixed scenes with spheres and boxes colliding correctly
- Cube towers stable with realistic box-box stacking physics
- Spheres bounce off box surfaces with proper contact points
- Performance maintained with complex mixed collision scenarios

## Phase 5: Box Collision Performance & Documentation ✅ **SPHERE PERFORMANCE PROVEN**

### ✅ **Current Performance Status**
- ✅ Sphere collision system optimized and performant
- ✅ Collision callbacks/events integrated with TypeScript
- ✅ All tests passing: `npm run verify` ✅ (38+ TypeScript + 28+ Zig tests)
- ✅ Comprehensive collision system documentation
- ✅ Performance proven: 6,598+ entities at 60fps
- ✅ Stable, reliable sphere physics simulation

### 🎯 **Phase 5 NEW: Box Collision Optimization**
- [ ] **Profile Box Collision Performance**: Measure box-box vs sphere-sphere collision cost
- [ ] **Optimize Mixed Collision Detection**: Efficient collision type dispatch
- [ ] **Add Box Collision Tests**: Extend test coverage to 45+ tests including all collision types
- [ ] **Update Collision Documentation**: Document box collision algorithms and usage patterns
- [ ] **Performance Benchmarking**: Ensure mixed collision maintains 60fps target

### Success Criteria
- Box collision performance comparable to sphere collision
- All collision combinations (sphere-sphere, box-box, sphere-box) tested
- Documentation includes complete collision shape usage guide
- Performance target maintained: 1000+ mixed entities at 60fps

## Implementation Notes

**🔗 This plan is now integrated into the main game engine plan as Phase 8.** Progress and updates will be tracked in `GAME_ENGINE_PLAN.md`.

### Key Files to Modify for Box Colliders

**Core Physics (WASM/Zig):**
- `src/core/game_core.zig` - Add box collision detection functions (`checkBoxCollision`, `resolveBoxCollision`)
- `src/core/game_engine.zig` - Extend PhysicsComponent with collision shape and extents, update collision loop
- `src/core/collision_test.zig` - Add comprehensive box collision unit tests

**TypeScript Integration:**
- `src/engine/wasm-physics-bridge.ts` - Add box collider WASM API integration
- `src/engine/components.ts` - Extend RigidBody component with collision shape support
- `src/engine/scene-system.ts` - Update entity creation to support box colliders

**Scenes and Testing:**
- `src/scenes/physics/scene.ts` - Add mixed collision type demonstrations
- New: `src/scenes/box-collision/scene.ts` - Dedicated box collision test scene
- `tests/box-collision.test.ts` - TypeScript integration tests for box colliders

### Testing Strategy for Box Colliders

**Unit Tests (Zig):**
- Box-box collision detection and response
- Sphere-box collision combinations
- Mixed collision type scenarios
- Collision shape switching and edge cases

**Integration Tests (TypeScript):**
- RigidBody component with box collider configuration
- Scene creation with mixed collision types
- WASM API integration for collision shape and extents
- Performance testing with mixed collision scenarios

**Visual Browser Tests:**
- Cube tower stacking with box-box collision
- Sphere and box interaction scenarios
- Visual validation of collision volume accuracy
- Mixed collision type scene demonstrations

### Dependencies for Box Collider Implementation

**WASM Compilation:**
- Ensure new box collision functions compile cleanly in optimized WASM
- Maintain 19.6KB size target with additional collision code
- Verify cross-platform compatibility (Chrome, Firefox, Edge)

**System Compatibility:**
- ✅ WebGPU rendering system proven stable
- ✅ Existing sphere collision system provides robust foundation
- ✅ ECS architecture ready for collision shape extension
- Maintain backward compatibility with existing sphere-only scenes