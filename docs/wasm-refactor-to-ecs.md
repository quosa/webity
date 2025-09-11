# WASM ECS Refactoring Plan

## Goal
Refactor the WASM game engine from a monolithic entity structure to a proper 3-array ECS (Entity Component System) for optimal performance and maintainability.

## Current Architecture Issues
- Single `Entity` struct contains both hot (physics) and cold (rendering) data
- Poor cache locality during physics simulation
- Tight coupling between physics and rendering data
- Transform matrices calculated redundantly

## Target ECS Architecture

### Three Component Arrays
1. **PhysicsComponent** (hot data - cache-friendly)
   ```zig
   const PhysicsComponent = struct {
       position: core.Vec3,       // World position
       velocity: core.Vec3,       // Movement velocity  
       force: core.Vec3,          // Accumulated forces
       rotation: core.Vec3,       // Rotation in radians (x, y, z)
       scale: core.Vec3,          // Scale values (x, y, z)
       mass: f32,                 // Physics mass
       radius: f32,               // Collision radius/size
       is_kinematic: bool,        // Kinematic vs dynamic
   };
   ```

2. **RenderingComponent** (GPU buffer layout - exactly 20 floats)
   ```zig
   const RenderingComponent = struct {
       transform_matrix: [16]f32, // 4x4 world transform matrix
       color: [4]f32,            // RGBA color
       mesh_id: u32,             // Mesh type identifier
       material_id: u32,         // Material identifier
   };
   ```

3. **EntityMetadata** (lifecycle and dirty flags)
   ```zig
   const EntityMetadata = struct {
       id: u32,                  // Entity ID for TypeScript mapping
       active: bool,             // Entity active flag
       physics_enabled: bool,    // Has physics simulation
       rendering_enabled: bool,  // Has rendering data  
       transform_dirty: bool,    // Transform matrix needs recalculation
   };
   ```

### Key Design Principles

#### Hot/Cold Data Separation
- **Physics owns transform data**: Position, velocity, scale stored in PhysicsComponent
- **Rendering consumes derived data**: Transform matrices derived from physics data
- **Cache-efficient physics loop**: Only touch PhysicsComponent during simulation

#### Dirty Flag Optimization
- Physics simulation marks entities with `transform_dirty = true`
- Rendering updates only dirty transform matrices
- Selective matrix recalculation instead of every-frame updates

#### Same Entity Indexing
- All three arrays use the same index for the same entity
- `physics_components[i]`, `rendering_components[i]`, `entity_metadata[i]` represent the same entity
- Easy iteration and component access

## Implementation Phases

### Phase 1: Define ECS Structures ✅
- Add three component arrays alongside existing system
- Initialize all arrays in `initEntities()`
- No functional changes, pure structure addition

### Phase 2: Populate ECS Arrays ✅
- Update `add_entity()` to populate all three component arrays
- Update `remove_entity()` to handle array compaction
- Maintain backward compatibility with existing API

### Phase 3: ECS Physics Loop ✅
- Implement `updateECSPhysics()` function using component arrays
- Add dirty flag optimization for transform updates
- Run ECS system in parallel with old system (validation)

### Phase 4: Remove Old Arrays ✅ **COMPLETED**
- ✅ Removed `entities[]` array and `gpu_instance_data[]` array completely
- ✅ Updated buffer access functions to use `rendering_components[]`
- ✅ Removed all functions that reference old arrays (collision detection, legacy exports)
- ✅ Updated API to use ECS exclusively
- ✅ WASM compiles successfully (16.4KB optimized)
- ✅ All ECS API functions implemented (`add_entity`, `remove_entity`, etc.)
- ✅ **Fixed**: Transform matrix layout bug in multi-entity scenarios

### Phase 5: Rotator Components ✅ **COMPLETED**
- ✅ Added `RotatorComponent` struct to ECS system with angular velocity and axis mask
- ✅ Implemented `rotator_components[]` array alongside existing component arrays
- ✅ Added rotation matrix math functions in core module (`createRotationMatrix`)
- ✅ Updated `updateECSTransformMatrix()` to integrate rotation with physics transforms
- ✅ Added animation system with `updateRotators()` function for frame-by-frame updates
- ✅ Implemented 4 WASM export functions for TypeScript rotator control:
  - `add_rotator()` - Enable rotation on entity with angular velocity and axis mask
  - `remove_rotator()` - Disable rotation animation on entity
  - `set_rotator_velocity()` - Update angular velocity for existing rotator
  - `set_rotator_axes()` - Update rotation axis mask (X=1, Y=2, Z=4)
- ✅ WASM compiles successfully (17.6KB optimized)
- ✅ All buffer integrity tests pass with rotation integration

## Game Loop Architecture

```zig
pub export fn update(delta_time: f32) void {
    // Step 1: Physics simulation (hot path)
    for (physics_components[0..entity_count], 0..) |*phys, i| {
        if (!entity_metadata[i].physics_enabled) continue;
        
        // Physics simulation - only touch PhysicsComponent
        // Mark entity_metadata[i].transform_dirty = true
    }
    
    // Step 2: Rotator animation updates
    updateRotators(delta_time);
    
    // Step 3: Selective transform updates (warm path)
    for (entity_metadata[0..entity_count], 0..) |*meta, i| {
        if (!meta.transform_dirty) continue;
        
        // Derive transform matrix from physics and rotation data
        updateECSTransformMatrix(i);
        meta.transform_dirty = false;
    }
}
```

## Zero-Copy GPU Integration

The `rendering_components[]` array provides direct memory mapping for GPU instanced rendering:
- Transform matrices in column-major format (WebGPU standard)
- Exactly 20 floats per entity (16 matrix + 4 color)
- No copying between physics and rendering systems
- TypeScript can map directly with `Float32Array`

## API Compatibility

All existing WASM exports remain unchanged:
- `add_entity()`, `remove_entity()`, `get_entity_count()`
- `apply_force()`, `set_entity_position()`, `set_entity_velocity()`
- `get_entity_transforms_offset()`, `get_entity_metadata_offset()`

**New Rotator API exports:**
- `add_rotator()` - Enable rotation animation on entity
- `remove_rotator()` - Disable rotation animation on entity  
- `set_rotator_velocity()` - Update angular velocity for existing rotator
- `set_rotator_axes()` - Update rotation axis mask (bitmask: X=1, Y=2, Z=4)

## Performance Benefits

1. **Cache Efficiency**: Physics simulation only touches compact PhysicsComponent data
2. **Selective Updates**: Transform matrices updated only when physics data changes
3. **Zero-Copy Rendering**: Direct GPU buffer mapping without data copying
4. **Hot/Cold Separation**: Frequently accessed physics data separate from rendering metadata

## Migration Strategy ✅ **COMPLETED**

- ✅ Maintained full backward compatibility during migration
- ✅ Ran old and new systems in parallel for validation
- ✅ Gradual feature migration to ECS system
- ✅ Removed old system after validation

## Current Status

### ✅ **ECS Refactoring Complete**
The WASM game engine has been successfully refactored to use a proper 3-array ECS architecture:

**Achievements:**
- 🎯 **Hot/Cold Data Separation**: Physics simulation only touches compact PhysicsComponent data
- ⚡ **Dirty Flag Optimization**: Transform matrices updated only when entities change
- 🔗 **Zero-Copy GPU Integration**: Direct memory mapping to WebGPU (20 floats per entity)
- 🔄 **Backward Compatibility**: All existing API functions maintained
- 🏗️ **Complete Migration**: Old entity arrays removed, ECS-only implementation

**Test Results:**
- ✅ WASM builds successfully (17.6KB optimized, includes rotator system)
- ✅ Single entity buffer test passes
- ✅ Multi-entity buffer tests pass (transform matrix bug fixed)
- ✅ ECS physics simulation working
- ✅ All buffer access functions implemented
- ✅ Rotator component animation system working
- ✅ All 38 tests passing with TypeScript type safety

### 🎯 **Next Steps**
The core ECS refactoring is now complete with full rotator component support. Remaining work focuses on expanding the rendering and physics systems:

1. ✅ **COMPLETED**: Fix transform matrix column-major layout in ECS system
2. ✅ **COMPLETED**: Add rotator components for transform updates
3. **IN PROGRESS**: Create separate rendering pipelines for different primitive types
4. **PENDING**: Move all geometry to WASM vertex/index buffers  
5. **PENDING**: Add camera controls and physics/collisions to WASM

### 🚀 **Enhanced ECS Architecture**
The ECS system now includes a fourth component array:
- **PhysicsComponent**: Position, velocity, forces, mass (hot physics data)
- **RenderingComponent**: Transform matrices, colors, mesh IDs (GPU rendering data)
- **RotatorComponent**: Angular velocity, axis masks (animation data)
- **EntityMetadata**: Lifecycle flags, dirty markers (system metadata)