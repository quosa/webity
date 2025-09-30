# Core Physics Engine - Developer Guide

This document provides essential information for working with the core physics engine in Zig/WASM.

## Collision Detection and Resolution Conventions

The physics engine uses a consistent **"Object1 Point of View"** convention for all collision operations:

### Collision Normal Convention
- **All collision normals point in the direction Object1 needs to move to separate from Object2**
- This provides a consistent reference frame regardless of object types
- Example: `checkBoxCollision(box1, box2)` returns normal for box1's separation direction

### Function Call Patterns
```zig
// Detection: returns normal for obj1 to move away from obj2
const collision_info = checkCollision(obj1, obj2);

// Resolution: applies normal to obj1's movement
resolveCollision(obj1, obj2, collision_info);
```

### Coordinate System
- **X-axis**: positive = right, negative = left
- **Y-axis**: positive = up, negative = down
- **Z-axis**: positive = away from camera, negative = toward camera
- camera is typically in Z-negative space looking toward Z-positive (right-handed system)

### Kinematic Object Handling
- **Kinematic objects**: Don't move during resolution (infinite mass)
- **Dynamic objects**: Bounce off kinematic objects following the normal direction
- **Both dynamic**: Share the separation and impulse equally

## Logging System

The core uses a conditional logging system that works in both WASM and native test environments:

```zig
// Conditional logger assignment
pub const log = if (builtin.target.cpu.arch == .wasm32) jslog else native_log;

// Usage
log("Debug message".ptr, "Debug message".len);

// For formatted messages in tests/debug
var buffer: [256]u8 = undefined;
const msg = std.fmt.bufPrint(&buffer, "Value: {d}", .{value}) catch "format error";
log(msg.ptr, msg.len);
```

### Logging Implementation
- **WASM target**: Uses `extern fn jslog()` implemented in TypeScript
- **Native/test target**: Uses `std.debug.print()` for unit tests
- **Debug flags**: Many functions have `debug_enabled` flags for detailed logging

## Test Organization

### Detection Tests (`collision_matrix_test.zig`)
- Validates collision detection accuracy
- Tests normal directions, penetration depths, contact points
- Covers all collision type combinations (box-box, sphere-sphere, sphere-box)

### Resolution Tests (`collision_resolution_matrix_test.zig`)
- Validates physics behavior after collision resolution
- Tests position separation, velocity changes, momentum conservation
- Verifies restitution behavior (bouncing vs sticking)

### Individual Tests
- `sphere_box_bounce_test.zig`: Specific sphere-box resolution scenarios
- `box_collision_test.zig`: Mixed collision dispatcher tests
- `collision_test.zig`: Physics simulation integration tests

## Key Functions

### Collision Detection
```zig
pub fn checkBoxCollision(pos1: Vec3, extents1: Vec3, pos2: Vec3, extents2: Vec3) ?CollisionInfo
pub fn checkSphereCollision(pos1: Vec3, radius1: f32, pos2: Vec3, radius2: f32) ?f32
pub fn checkSphereBoxCollision(sphere_pos: Vec3, radius: f32, box_pos: Vec3, box_extents: Vec3) ?CollisionInfo
```

### Collision Resolution
```zig
pub fn resolveCollision(pos1: *Vec3, vel1: *Vec3, shape1: CollisionShape, extents1: Vec3,
                       mass1: f32, is_kinematic1: bool, pos2: *Vec3, vel2: *Vec3,
                       shape2: CollisionShape, extents2: Vec3, mass2: f32, is_kinematic2: bool,
                       restitution: f32, collision_info: CollisionInfo) void
```

## Data Structures

### Core Types
```zig
pub const Vec3 = struct { x: f32, y: f32, z: f32 };
pub const CollisionShape = enum(u8) { SPHERE = 0, BOX = 1, PLANE = 2 };
pub const CollisionInfo = struct {
    has_collision: bool,
    penetration_depth: f32,
    contact_normal: Vec3,  // Direction for Object1 to move
    contact_point: Vec3,
};
```

## Development Guidelines

1. **Always follow Object1 POV convention** for collision normals
2. **Test both detection and resolution** when adding new collision types
3. **Use debug flags** for investigating physics issues
4. **Maintain test coverage** - all collision scenarios should have matrix tests
5. **Document coordinate system assumptions** in complex calculations

This convention ensures that collision detection and resolution are always consistent and predictable, making the physics behavior more intuitive for developers working with the engine.
