// game_engine.zig - Thin WASM wrapper around game_core
const std = @import("std");
const core = @import("game_core.zig");

// State (pre-allocated) - using core types
var vertex_buffer: [10000]f32 = undefined;
var vertex_count: u32 = 0;

// Note: Separate vertex buffers removed - using unified vertex_buffer for all mesh types

// Grid floor rendering
var grid_buffer: [5000]f32 = undefined;
var grid_vertex_count: u32 = 0;

var uniforms: core.Uniforms = core.Uniforms{
    .model = core.Mat4.identity(),
    .view = core.Mat4.identity(),
    .projection = core.Mat4.identity(),
};

// Camera state
var camera_position: core.Vec3 = .{ .x = 0, .y = 0, .z = -20 };
var camera_target: core.Vec3 = .{ .x = 0, .y = 0, .z = 2 };
var camera_up: core.Vec3 = .{ .x = 0, .y = 1, .z = 0 };

// Physics configuration (configurable instead of hardcoded)
var physics_gravity: f32 = -9.8;
var physics_damping: f32 = 0.99;
var physics_restitution: f32 = 0.8;
var world_bounds: core.Vec3 = .{ .x = 8.0, .y = 8.0, .z = 8.0 };

// Entity system
const MAX_ENTITIES: u32 = 10000; // MAXIMUM POWER! 🚀💥

// Mesh type enumeration
const MeshType = enum(u8) {
    SPHERE = 0,
    CUBE = 1,
};

// =============================================================================
// ECS Component System - Hot/Cold Data Separation
// =============================================================================

// Physics-only component (hot data - cache-friendly)
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

// Rendering-only component (GPU buffer layout - exactly 20 floats)
const RenderingComponent = struct {
    transform_matrix: [16]f32, // 4x4 world transform matrix (64 bytes)
    color: [4]f32,            // RGBA color (16 bytes)
    // Total: exactly 80 bytes (20 floats) for zero-copy GPU mapping
};

// Entity metadata (lifecycle and dirty flags)
const EntityMetadata = struct {
    id: u32,                  // Entity ID for TypeScript mapping
    active: bool,             // Entity active flag
    physics_enabled: bool,    // Has physics simulation
    rendering_enabled: bool,  // Has rendering data  
    transform_dirty: bool,    // Transform matrix needs recalculation
    mesh_id: u32,             // Mesh type identifier (moved from RenderingComponent)
    material_id: u32,         // Material identifier (moved from RenderingComponent)
};

// Rotator component for animation behavior
const RotatorComponent = struct {
    enabled: bool,            // Whether rotation is active
    angular_velocity: core.Vec3, // Rotation speed in radians per second
    axis_mask: u8,           // Bitmask: 1=X, 2=Y, 4=Z rotation axes
};

// Four component arrays for ECS
var physics_components: [MAX_ENTITIES]PhysicsComponent = undefined;
var rendering_components: [MAX_ENTITIES]RenderingComponent = undefined;
var entity_metadata: [MAX_ENTITIES]EntityMetadata = undefined;
var rotator_components: [MAX_ENTITIES]RotatorComponent = undefined;

pub var entity_count: u32 = 0; // Now tracks ECS entities

// Note: Separate mesh entity arrays removed - using main entities array with mesh_type field

var input_state: u8 = 0; // Bitmask for WASD
var collision_state: u8 = 0; // Bitmask for collisions
var debug_floating_entity_index: u32 = MAX_ENTITIES; // Index of floating entity for debugging

fn initEntities() void {
    entity_count = 0;
    
    // Initialize physics components
    for (&physics_components) |*phys| {
        phys.* = PhysicsComponent{
            .position = .{ .x = 0, .y = 0, .z = 0 },
            .velocity = .{ .x = 0, .y = 0, .z = 0 },
            .force = .{ .x = 0, .y = 0, .z = 0 },
            .rotation = .{ .x = 0, .y = 0, .z = 0 },
            .scale = .{ .x = 1, .y = 1, .z = 1 },
            .mass = 1.0,
            .radius = 0.5,
            .is_kinematic = false,
        };
    }
    
    // Initialize rendering components
    for (&rendering_components) |*render| {
        render.* = RenderingComponent{
            .transform_matrix = [_]f32{
                1.0, 0.0, 0.0, 0.0,  // Identity matrix
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            },
            .color = [_]f32{ 1.0, 1.0, 1.0, 1.0 }, // Default white
        };
    }
    
    // Initialize entity metadata
    for (&entity_metadata) |*meta| {
        meta.* = EntityMetadata{
            .id = 0,
            .active = false,
            .physics_enabled = false,
            .rendering_enabled = false,
            .transform_dirty = false,
            .mesh_id = 0, // Default to sphere
            .material_id = 0, // Default material
        };
    }
    
    // Initialize rotator components
    for (&rotator_components) |*rotator| {
        rotator.* = RotatorComponent{
            .enabled = false,
            .angular_velocity = .{ .x = 0, .y = 0, .z = 0 },
            .axis_mask = 0, // No rotation by default
        };
    }
}

// =============================================================================
// ECS Helper Functions
// =============================================================================

// Update transform matrix for specific entity (ECS version)
fn updateECSTransformMatrix(entity_index: u32) void {
    if (entity_index >= entity_count) return;
    
    const phys = &physics_components[entity_index];
    const render = &rendering_components[entity_index];
    
    // Create rotation matrix if entity has rotation
    var has_rotation = false;
    if (phys.rotation.x != 0.0 or phys.rotation.y != 0.0 or phys.rotation.z != 0.0) {
        has_rotation = true;
    }
    
    if (has_rotation) {
        // Create combined transform matrix: T * R * S (column-major)
        const rotation_mat = core.createRotationMatrix(phys.rotation);
        
        // Combine rotation and scale, then add translation (column-major)
        render.transform_matrix = [_]f32{
            // Column 0: Rotated & scaled X axis
            rotation_mat.data[0] * phys.scale.x,
            rotation_mat.data[1] * phys.scale.x,
            rotation_mat.data[2] * phys.scale.x,
            0.0,
            // Column 1: Rotated & scaled Y axis
            rotation_mat.data[4] * phys.scale.y,
            rotation_mat.data[5] * phys.scale.y,
            rotation_mat.data[6] * phys.scale.y,
            0.0,
            // Column 2: Rotated & scaled Z axis
            rotation_mat.data[8] * phys.scale.z,
            rotation_mat.data[9] * phys.scale.z,
            rotation_mat.data[10] * phys.scale.z,
            0.0,
            // Column 3: Translation (position)
            phys.position.x, phys.position.y, phys.position.z, 1.0,
        };
    } else {
        // Simple scale + translate matrix (no rotation)
        render.transform_matrix = [_]f32{
            // Column 0: Scale X axis
            phys.scale.x, 0.0, 0.0, 0.0,
            // Column 1: Scale Y axis  
            0.0, phys.scale.y, 0.0, 0.0,
            // Column 2: Scale Z axis
            0.0, 0.0, phys.scale.z, 0.0,
            // Column 3: Translation (position)
            phys.position.x, phys.position.y, phys.position.z, 1.0,
        };
    }
    
    // Clear dirty flag
    entity_metadata[entity_index].transform_dirty = false;
}

// Update dirty transform matrices (selective update)
fn updateDirtyTransforms() void {
    for (entity_metadata[0..entity_count], 0..) |*meta, i| {
        if (!meta.transform_dirty or !meta.active or !meta.rendering_enabled) continue;
        updateECSTransformMatrix(@intCast(i));
    }
}

// Update rotator components (animation system)
fn updateRotators(delta_time: f32) void {
    for (rotator_components[0..entity_count], 0..) |*rotator, i| {
        if (!rotator.enabled or !entity_metadata[i].active) continue;
        
        const phys = &physics_components[i];
        var rotation_changed = false;
        
        // Apply angular velocity to rotation based on axis mask
        if (rotator.axis_mask & 1 != 0) { // X-axis rotation
            phys.rotation.x += rotator.angular_velocity.x * delta_time;
            rotation_changed = true;
        }
        if (rotator.axis_mask & 2 != 0) { // Y-axis rotation
            phys.rotation.y += rotator.angular_velocity.y * delta_time;
            rotation_changed = true;
        }
        if (rotator.axis_mask & 4 != 0) { // Z-axis rotation
            phys.rotation.z += rotator.angular_velocity.z * delta_time;
            rotation_changed = true;
        }
        
        // Mark transform as dirty if rotation changed
        if (rotation_changed) {
            entity_metadata[i].transform_dirty = true;
        }
    }
}

// Find entity by ID in ECS system
fn findECSEntityById(id: u32) ?u32 {
    for (0..entity_count) |i| {
        if (entity_metadata[i].active and entity_metadata[i].id == id) {
            return @intCast(i);
        }
    }
    return null;
}

// ECS-based physics simulation
fn updateECSPhysics(delta_time: f32) void {
    // Step 1: Physics simulation (hot path - only touch physics components)
    const force = core.Vec3{ .x = 0, .y = physics_gravity, .z = 0 };
    
    for (physics_components[0..entity_count], 0..) |*phys, i| {
        if (!entity_metadata[i].physics_enabled or !entity_metadata[i].active) continue;
        
        // Apply gravity and forces
        phys.velocity.x += force.x * delta_time;
        phys.velocity.y += force.y * delta_time;
        phys.velocity.z += force.z * delta_time;
        
        // Apply damping
        phys.velocity.x *= physics_damping;
        phys.velocity.z *= physics_damping;
        
        // Update position
        phys.position.x += phys.velocity.x * delta_time;
        phys.position.y += phys.velocity.y * delta_time;
        phys.position.z += phys.velocity.z * delta_time;
        
        // Apply world boundary constraints
        _ = applyECSWorldBoundaryConstraints(&phys.position, &phys.velocity, phys.radius);
        
        // Mark transform as dirty for rendering update
        entity_metadata[i].transform_dirty = true;
    }
    
    // Step 2: Update rotator components (animation system)
    updateRotators(delta_time);
    
    // Step 3: Update dirty transforms (selective - only changed entities)
    updateDirtyTransforms();
}

// ECS version of boundary constraints
fn applyECSWorldBoundaryConstraints(position: *core.Vec3, velocity: *core.Vec3, radius: f32) u8 {
    var collision_flags: u8 = 0;
    
    // X boundaries
    if (position.x - radius < -world_bounds.x) {
        position.x = -world_bounds.x + radius;
        velocity.x = -velocity.x * physics_restitution;
        collision_flags |= 1;
    } else if (position.x + radius > world_bounds.x) {
        position.x = world_bounds.x - radius;
        velocity.x = -velocity.x * physics_restitution;
        collision_flags |= 2;
    }
    
    // Y boundaries  
    if (position.y - radius < -world_bounds.y) {
        position.y = -world_bounds.y + radius;
        velocity.y = -velocity.y * physics_restitution;
        collision_flags |= 4;
    } else if (position.y + radius > world_bounds.y) {
        position.y = world_bounds.y - radius;
        velocity.y = -velocity.y * physics_restitution;
        collision_flags |= 8;
    }
    
    // Z boundaries
    if (position.z - radius < -world_bounds.z) {
        position.z = -world_bounds.z + radius;
        velocity.z = -velocity.z * physics_restitution;
        collision_flags |= 16;
    } else if (position.z + radius > world_bounds.z) {
        position.z = world_bounds.z - radius;
        velocity.z = -velocity.z * physics_restitution;
        collision_flags |= 32;
    }
    
    return collision_flags;
}

// ECS version of entity spawning
fn spawnEntityInternal(x: f32, y: f32, z: f32, radius: f32, mesh_type: MeshType) u32 {
    if (entity_count >= MAX_ENTITIES) return MAX_ENTITIES; // Full

    const index = entity_count;
    const mesh_id = @intFromEnum(mesh_type);
    
    // Initialize physics component
    physics_components[index] = PhysicsComponent{
        .position = .{ .x = x, .y = y, .z = z },
        .velocity = .{ .x = 0, .y = 0, .z = 0 },
        .force = .{ .x = 0, .y = 0, .z = 0 },
        .rotation = .{ .x = 0, .y = 0, .z = 0 },
        .scale = .{ .x = 1, .y = 1, .z = 1 },
        .mass = 1.0,
        .radius = radius,
        .is_kinematic = false,
    };
    
    // Initialize rendering component with transform matrix
    rendering_components[index] = RenderingComponent{
        .transform_matrix = [_]f32{
            1.0, 0.0, 0.0, 0.0,  // Column 0: [sx, 0, 0, 0]
            0.0, 1.0, 0.0, 0.0,  // Column 1: [0, sy, 0, 0]
            0.0, 0.0, 1.0, 0.0,  // Column 2: [0, 0, sz, 0]
            x, y, z, 1.0,        // Column 3: [tx, ty, tz, 1]
        },
        .color = switch (mesh_type) {
            .SPHERE => [_]f32{ 1.0, 0.8, 0.2, 1.0 }, // Golden yellow for spheres
            .CUBE => [_]f32{ 0.2, 0.8, 1.0, 1.0 },   // Sky blue for cubes
        },
    };
    
    // Initialize entity metadata
    entity_metadata[index] = EntityMetadata{
        .id = index, // Use array index as ID for legacy compatibility
        .active = true,
        .physics_enabled = true,
        .rendering_enabled = true,
        .transform_dirty = false, // Transform already set up
        .mesh_id = mesh_id,
        .material_id = 0,
    };
    
    entity_count += 1;
    return index;
}

// WASM exports - thin wrappers around core functionality
pub export fn init() void {
    // Initialize entity system
    initEntities();

    // Set up initial view matrix using camera state
    updateViewMatrix();

    // Set up projection matrix (FOV 60°, aspect 4:3, near 0.1, far 100)
    uniforms.projection = core.createPerspective(60.0, 1.333, 0.1, 100.0);
}

fn updateViewMatrix() void {
    uniforms.view = core.createLookAt(camera_position, camera_target, camera_up);
}

fn applyWorldBoundaryConstraints(position: *core.Vec3, velocity: *core.Vec3, radius: f32) u8 {
    var collision_flags: u8 = 0;

    // Floor collision
    if (position.y - radius < -world_bounds.y) {
        position.y = -world_bounds.y + radius;
        velocity.y = -velocity.y * physics_restitution;
        collision_flags |= 0x01;
    }

    // Wall collisions
    if (@abs(position.x) + radius > world_bounds.x) {
        position.x = std.math.sign(position.x) * (world_bounds.x - radius);
        velocity.x = -velocity.x * physics_restitution;
        collision_flags |= 0x02;
    }

    if (@abs(position.z) + radius > world_bounds.z) {
        position.z = std.math.sign(position.z) * (world_bounds.z - radius);
        velocity.z = -velocity.z * physics_restitution;
        collision_flags |= 0x02;
    }

    return collision_flags;
}

fn simulatePhysicsWithConfig(position: *core.Vec3, velocity: *core.Vec3, delta_time: f32, input_force: core.Vec3, radius: f32) u8 {
    var local_collision_state: u8 = 0;

    // Apply forces
    const force = input_force;

    // Update velocity
    velocity.x += force.x * delta_time;
    velocity.y += force.y * delta_time;
    velocity.z += force.z * delta_time;

    // Apply damping
    velocity.x *= physics_damping;
    velocity.z *= physics_damping;

    // Update position
    position.x += velocity.x * delta_time;
    position.y += velocity.y * delta_time;
    position.z += velocity.z * delta_time;

    // Collision detection and response using configurable bounds
    // Floor collision
    if (position.y - radius < -world_bounds.y) {
        position.y = -world_bounds.y + radius;
        velocity.y = -velocity.y * physics_restitution;
        local_collision_state |= 0x01;
    }

    // Wall collisions
    if (@abs(position.x) + radius > world_bounds.x) {
        position.x = std.math.sign(position.x) * (world_bounds.x - radius);
        velocity.x = -velocity.x * physics_restitution;
        local_collision_state |= 0x02;
    }

    if (@abs(position.z) + radius > world_bounds.z) {
        position.z = std.math.sign(position.z) * (world_bounds.z - radius);
        velocity.z = -velocity.z * physics_restitution;
        local_collision_state |= 0x02;
    }

    return local_collision_state;
}

// TODO: ECS collision detection to be implemented later
// For now, physics simulation handles boundary collisions only
fn checkEntityCollisions_removed(delta_time: f32) void {
    _ = delta_time; // Placeholder - collision detection removed
}

pub export fn update(delta_time: f32) void {
    collision_state = 0;

    // Process camera movement from WASD input
    const camera_speed: f32 = 10.0;
    if (input_state & 0x01 != 0) { // W - forward
        const forward = core.Vec3{
            .x = camera_target.x - camera_position.x,
            .y = camera_target.y - camera_position.y,
            .z = camera_target.z - camera_position.z,
        };
        const forward_norm = core.normalize(forward);
        camera_position.x += forward_norm.x * camera_speed * delta_time;
        camera_position.y += forward_norm.y * camera_speed * delta_time;
        camera_position.z += forward_norm.z * camera_speed * delta_time;
        camera_target.x += forward_norm.x * camera_speed * delta_time;
        camera_target.y += forward_norm.y * camera_speed * delta_time;
        camera_target.z += forward_norm.z * camera_speed * delta_time;
    }
    if (input_state & 0x02 != 0) { // A - left
        const forward = core.Vec3{
            .x = camera_target.x - camera_position.x,
            .y = camera_target.y - camera_position.y,
            .z = camera_target.z - camera_position.z,
        };
        const right = core.cross(core.normalize(forward), camera_up);
        camera_position.x -= right.x * camera_speed * delta_time;
        camera_position.y -= right.y * camera_speed * delta_time;
        camera_position.z -= right.z * camera_speed * delta_time;
        camera_target.x -= right.x * camera_speed * delta_time;
        camera_target.y -= right.y * camera_speed * delta_time;
        camera_target.z -= right.z * camera_speed * delta_time;
    }
    if (input_state & 0x04 != 0) { // S - backward
        const forward = core.Vec3{
            .x = camera_target.x - camera_position.x,
            .y = camera_target.y - camera_position.y,
            .z = camera_target.z - camera_position.z,
        };
        const forward_norm = core.normalize(forward);
        camera_position.x -= forward_norm.x * camera_speed * delta_time;
        camera_position.y -= forward_norm.y * camera_speed * delta_time;
        camera_position.z -= forward_norm.z * camera_speed * delta_time;
        camera_target.x -= forward_norm.x * camera_speed * delta_time;
        camera_target.y -= forward_norm.y * camera_speed * delta_time;
        camera_target.z -= forward_norm.z * camera_speed * delta_time;
    }
    if (input_state & 0x08 != 0) { // D - right
        const forward = core.Vec3{
            .x = camera_target.x - camera_position.x,
            .y = camera_target.y - camera_position.y,
            .z = camera_target.z - camera_position.z,
        };
        const right = core.cross(core.normalize(forward), camera_up);
        camera_position.x += right.x * camera_speed * delta_time;
        camera_position.y += right.y * camera_speed * delta_time;
        camera_position.z += right.z * camera_speed * delta_time;
        camera_target.x += right.x * camera_speed * delta_time;
        camera_target.y += right.y * camera_speed * delta_time;
        camera_target.z += right.z * camera_speed * delta_time;
    }

    // Update view matrix if camera moved
    if (input_state != 0) {
        updateViewMatrix();
    }

    // ECS physics simulation
    collision_state = 0;
    updateECSPhysics(delta_time);
    
    // Update model matrix with first active entity position (for backward compatibility)
    uniforms.model = core.Mat4.identity();
    if (entity_count > 0 and entity_metadata[0].active) {
        uniforms.model.data[12] = physics_components[0].position.x;
        uniforms.model.data[13] = physics_components[0].position.y;
        uniforms.model.data[14] = physics_components[0].position.z;
    }
}

pub export fn set_input(key: u8, pressed: bool) void {
    const key_map = switch (key) {
        87 => @as(u8, 0x01), // W
        65 => @as(u8, 0x02), // A
        83 => @as(u8, 0x04), // S
        68 => @as(u8, 0x08), // D
        else => @as(u8, 0),
    };

    if (pressed) {
        input_state |= key_map;
    } else {
        input_state &= ~key_map;
    }
}

pub export fn generate_sphere_mesh(segments: u32) void {
    // Generate sphere mesh with default radius (for backwards compatibility)
    const radius = 0.5; // Default radius
    vertex_count = core.generateWireframeSphere(&vertex_buffer, segments, radius);
}

pub export fn generate_sphere_mesh_with_radius(segments: u32, radius: f32) void {
    // Generate sphere mesh with specified radius
    vertex_count = core.generateWireframeSphere(&vertex_buffer, segments, radius);
}

pub export fn generate_cube_mesh(size: f32) void {
    // Generate cube mesh into main vertex buffer (consolidate to main buffer)
    vertex_count = core.generateWireframeCube(&vertex_buffer, size);
}

pub export fn generate_grid_floor(grid_size: u32) void {
    grid_vertex_count = generateWireframeGrid(&grid_buffer, grid_size);
}

pub fn generateWireframeGrid(vertices: [*]f32, grid_size: u32) u32 {
    var index: u32 = 0;
    const grid_extent = 16.0; // Grid extends from -8 to +8 (matches world bounds)
    const half_size = grid_extent / 2.0;
    const step = grid_extent / @as(f32, @floatFromInt(grid_size));

    // Generate horizontal lines (along X axis)
    var z: u32 = 0;
    while (z <= grid_size) : (z += 1) {
        const z_pos = -half_size + @as(f32, @floatFromInt(z)) * step;

        // Line from (-half_size, floor_y, z_pos) to (half_size, floor_y, z_pos)
        vertices[index] = -half_size; // Start X
        vertices[index + 1] = -world_bounds.y; // Floor Y
        vertices[index + 2] = z_pos; // Z

        vertices[index + 3] = half_size; // End X
        vertices[index + 4] = -world_bounds.y; // Floor Y
        vertices[index + 5] = z_pos; // Z

        index += 6;
    }

    // Generate vertical lines (along Z axis)
    var x: u32 = 0;
    while (x <= grid_size) : (x += 1) {
        const x_pos = -half_size + @as(f32, @floatFromInt(x)) * step;

        // Line from (x_pos, floor_y, -half_size) to (x_pos, floor_y, half_size)
        vertices[index] = x_pos; // X
        vertices[index + 1] = -world_bounds.y; // Floor Y
        vertices[index + 2] = -half_size; // Start Z

        vertices[index + 3] = x_pos; // X
        vertices[index + 4] = -world_bounds.y; // Floor Y
        vertices[index + 5] = half_size; // End Z

        index += 6;
    }

    return index / 3; // Return vertex count
}

pub export fn get_vertex_buffer_offset() u32 {
    if (comptime @import("builtin").target.cpu.arch == .wasm32) {
        return @as(u32, @intCast(@intFromPtr(&vertex_buffer)));
    } else {
        return @truncate(@intFromPtr(&vertex_buffer));
    }
}

pub export fn get_grid_buffer_offset() u32 {
    if (comptime @import("builtin").target.cpu.arch == .wasm32) {
        return @as(u32, @intCast(@intFromPtr(&grid_buffer)));
    } else {
        return @truncate(@intFromPtr(&grid_buffer));
    }
}

pub export fn get_uniform_buffer_offset() u32 {
    if (comptime @import("builtin").target.cpu.arch == .wasm32) {
        return @as(u32, @intCast(@intFromPtr(&uniforms)));
    } else {
        return @truncate(@intFromPtr(&uniforms));
    }
}

pub export fn get_vertex_count() u32 {
    return vertex_count;
}

pub export fn get_grid_vertex_count() u32 {
    return grid_vertex_count;
}

// Compatibility exports for vertex counts (estimate based on mesh type)
pub export fn get_sphere_vertex_count() u32 {
    // Return vertex count for a single sphere mesh (16 segments = ~256 vertices)
    return 256;
}

pub export fn get_cube_vertex_count() u32 {
    // Return vertex count for a single cube mesh (wireframe = 24 vertices)
    return 24;
}

pub export fn get_collision_state() u8 {
    return collision_state;
}

pub export fn set_position(x: f32, y: f32, z: f32) void {
    // Set position of first active entity for backward compatibility
    if (entity_count > 0 and entity_metadata[0].active) {
        physics_components[0].position = .{ .x = x, .y = y, .z = z };
        entity_metadata[0].transform_dirty = true;
    }
}

pub export fn apply_force(x: f32, y: f32, z: f32) void {
    // Apply force to first active entity for backward compatibility
    if (entity_count > 0 and entity_metadata[0].active) {
        physics_components[0].velocity.x += x;
        physics_components[0].velocity.y += y;
        physics_components[0].velocity.z += z;
    }
}

pub export fn get_ball_position_x() f32 {
    return if (entity_count > 0 and entity_metadata[0].active) physics_components[0].position.x else 0;
}

pub export fn get_ball_position_y() f32 {
    return if (entity_count > 0 and entity_metadata[0].active) physics_components[0].position.y else 0;
}

pub export fn get_ball_position_z() f32 {
    return if (entity_count > 0 and entity_metadata[0].active) physics_components[0].position.z else 0;
}

// Configuration exports for Phase 6.1
pub export fn set_camera_position(x: f32, y: f32, z: f32) void {
    camera_position = .{ .x = x, .y = y, .z = z };
    updateViewMatrix();
}

pub export fn set_camera_target(x: f32, y: f32, z: f32) void {
    camera_target = .{ .x = x, .y = y, .z = z };
    updateViewMatrix();
}

pub export fn set_physics_config(gravity: f32, damping: f32, restitution: f32) void {
    physics_gravity = gravity;
    physics_damping = damping;
    physics_restitution = restitution;
}

pub export fn set_world_bounds(x: f32, y: f32, z: f32) void {
    world_bounds = .{ .x = x, .y = y, .z = z };
}

pub export fn get_camera_position_x() f32 {
    return camera_position.x;
}

pub export fn get_camera_position_y() f32 {
    return camera_position.y;
}

pub export fn get_camera_position_z() f32 {
    return camera_position.z;
}

// Multi-entity exports for Phase 6.2
pub export fn spawn_entity(x: f32, y: f32, z: f32, radius: f32) u32 {
    return spawnEntityInternal(x, y, z, radius, MeshType.SPHERE);
}

// Enhanced entity spawning with mesh type support for Phase 7
pub export fn spawn_entity_with_mesh(x: f32, y: f32, z: f32, radius: f32, mesh_type_id: u8) u32 {
    const mesh_type: MeshType = switch (mesh_type_id) {
        0 => MeshType.SPHERE,
        1 => MeshType.CUBE,
        else => MeshType.SPHERE, // Default to sphere for invalid types
    };
    return spawnEntityInternal(x, y, z, radius, mesh_type);
}

// Helper functions to count entities by mesh type (ECS version)
pub export fn get_sphere_count() u32 {
    var count: u32 = 0;
    for (0..entity_count) |i| {
        if (entity_metadata[i].active and entity_metadata[i].mesh_id == @intFromEnum(MeshType.SPHERE)) {
            count += 1;
        }
    }
    return count;
}

pub export fn get_cube_count() u32 {
    var count: u32 = 0;
    for (0..entity_count) |i| {
        if (entity_metadata[i].active and entity_metadata[i].mesh_id == @intFromEnum(MeshType.CUBE)) {
            count += 1;
        }
    }
    return count;
}

pub export fn despawn_all_entities() void {
    for (entity_metadata[0..entity_count]) |*meta| {
        meta.active = false;
    }
    entity_count = 0;
}

pub export fn get_entity_position_x(index: u32) f32 {
    if (index >= entity_count or !entity_metadata[index].active) return 0;
    return physics_components[index].position.x;
}

pub export fn get_entity_position_y(index: u32) f32 {
    if (index >= entity_count or !entity_metadata[index].active) return 0;
    return physics_components[index].position.y;
}

pub export fn get_entity_position_z(index: u32) f32 {
    if (index >= entity_count or !entity_metadata[index].active) return 0;
    return physics_components[index].position.z;
}

// Note: ECS version - entity positions from physics components

pub export fn set_entity_position(index: u32, x: f32, y: f32, z: f32) void {
    if (index >= entity_count or !entity_metadata[index].active) return;
    physics_components[index].position = .{ .x = x, .y = y, .z = z };
    entity_metadata[index].transform_dirty = true;
}

pub export fn set_entity_velocity(index: u32, x: f32, y: f32, z: f32) void {
    if (index >= entity_count or !entity_metadata[index].active) return;
    physics_components[index].velocity = .{ .x = x, .y = y, .z = z };
}

pub export fn set_entity_rotation(index: u32, x: f32, y: f32, z: f32) void {
    if (index >= entity_count or !entity_metadata[index].active) return;
    physics_components[index].rotation = .{ .x = x, .y = y, .z = z };
    entity_metadata[index].transform_dirty = true;
}

pub export fn get_entity_mesh_type(index: u32) u8 {
    if (index >= entity_count or !entity_metadata[index].active) return 0; // Default to SPHERE
    return @intCast(entity_metadata[index].mesh_id);
}

// Debug exports
pub export fn get_debug_floating_entity_index() u32 {
    return debug_floating_entity_index;
}

pub export fn get_entity_velocity_y(index: u32) f32 {
    if (index >= entity_count or !entity_metadata[index].active) return 0;
    return physics_components[index].velocity.y;
}

pub export fn clear_debug_floating_entity() void {
    debug_floating_entity_index = MAX_ENTITIES;
}

// =============================================================================
// ECS API Functions
// =============================================================================

// V2 API: Add entity with ECS structure
pub export fn add_entity(id: u32, x: f32, y: f32, z: f32, scaleX: f32, scaleY: f32, scaleZ: f32, colorR: f32, colorG: f32, colorB: f32, colorA: f32, meshId: u32, materialId: u32, mass: f32, isKinematic: bool) void {
    if (entity_count >= MAX_ENTITIES) return;
    
    const index = entity_count;
    
    // Initialize physics component
    physics_components[index] = PhysicsComponent{
        .position = .{ .x = x, .y = y, .z = z },
        .velocity = .{ .x = 0, .y = 0, .z = 0 },
        .force = .{ .x = 0, .y = 0, .z = 0 },
        .rotation = .{ .x = 0, .y = 0, .z = 0 },
        .scale = .{ .x = scaleX, .y = scaleY, .z = scaleZ },
        .mass = mass,
        .radius = 0.5, // Default radius
        .is_kinematic = isKinematic,
    };
    
    // Initialize rendering component
    rendering_components[index] = RenderingComponent{
        .transform_matrix = [_]f32{
            // Column 0: Scale X axis
            scaleX, 0.0, 0.0, 0.0,
            // Column 1: Scale Y axis
            0.0, scaleY, 0.0, 0.0,
            // Column 2: Scale Z axis
            0.0, 0.0, scaleZ, 0.0,
            // Column 3: Translation (position)
            x, y, z, 1.0,
        },
        .color = [_]f32{ colorR, colorG, colorB, colorA },
    };
    
    // Initialize entity metadata
    entity_metadata[index] = EntityMetadata{
        .id = id,
        .active = true,
        .physics_enabled = !isKinematic, // Static entities don't need physics
        .rendering_enabled = true,
        .transform_dirty = false, // Already set up transform
        .mesh_id = meshId,
        .material_id = materialId,
    };
    
    entity_count += 1;
}

pub export fn remove_entity(id: u32) void {
    if (findECSEntityById(id)) |index| {
        entity_metadata[index].active = false;
        
        // Compact arrays by moving last entity to this position
        if (index < entity_count - 1) {
            physics_components[index] = physics_components[entity_count - 1];
            rendering_components[index] = rendering_components[entity_count - 1];
            entity_metadata[index] = entity_metadata[entity_count - 1];
        }
        
        entity_count -= 1;
    }
}

pub export fn get_entity_count() u32 {
    return entity_count;
}

pub export fn apply_force_to_entity(id: u32, fx: f32, fy: f32, fz: f32) void {
    if (findECSEntityById(id)) |index| {
        if (!physics_components[index].is_kinematic) {
            // Apply force to velocity (simple integration)
            physics_components[index].velocity.x += fx / physics_components[index].mass;
            physics_components[index].velocity.y += fy / physics_components[index].mass;
            physics_components[index].velocity.z += fz / physics_components[index].mass;
        }
    }
}

pub export fn set_entity_position_by_id(id: u32, x: f32, y: f32, z: f32) void {
    if (findECSEntityById(id)) |index| {
        physics_components[index].position = .{ .x = x, .y = y, .z = z };
        entity_metadata[index].transform_dirty = true;
    }
}

pub export fn set_entity_velocity_by_id(id: u32, vx: f32, vy: f32, vz: f32) void {
    if (findECSEntityById(id)) |index| {
        physics_components[index].velocity = .{ .x = vx, .y = vy, .z = vz };
    }
}

// Buffer access functions for zero-copy rendering
pub export fn get_entity_transforms_offset() u32 {
    // Return the absolute pointer to the ECS rendering component array
    // TypeScript will map this directly with Float32Array (20 floats per entity)
    return @intCast(@intFromPtr(&rendering_components[0].transform_matrix[0]));
}

pub export fn get_entity_metadata_offset() u32 {
    // Return byte offset to the mesh_id field of first entity metadata
    return @intCast(@intFromPtr(&entity_metadata[0].mesh_id));
}

// Debug functions for buffer layout investigation
pub export fn get_entity_size() u32 {
    return @sizeOf(RenderingComponent);
}

pub export fn get_entity_stride() u32 {
    if (entity_count < 2) return 0;
    const ptr0 = @intFromPtr(&rendering_components[0]);
    const ptr1 = @intFromPtr(&rendering_components[1]);
    return @intCast(ptr1 - ptr0);
}

// =============================================================================
// Rotator Component API Functions
// =============================================================================

// Enable rotator component for entity
pub export fn enable_entity_rotator(id: u32, angular_vel_x: f32, angular_vel_y: f32, angular_vel_z: f32, axis_mask: u8) void {
    if (findECSEntityById(id)) |index| {
        rotator_components[index] = RotatorComponent{
            .enabled = true,
            .angular_velocity = .{ .x = angular_vel_x, .y = angular_vel_y, .z = angular_vel_z },
            .axis_mask = axis_mask,
        };
    }
}

// Disable rotator component for entity
pub export fn disable_entity_rotator(id: u32) void {
    if (findECSEntityById(id)) |index| {
        rotator_components[index].enabled = false;
    }
}

// Update rotator angular velocity
pub export fn set_entity_angular_velocity(id: u32, angular_vel_x: f32, angular_vel_y: f32, angular_vel_z: f32) void {
    if (findECSEntityById(id)) |index| {
        if (rotator_components[index].enabled) {
            rotator_components[index].angular_velocity = .{ .x = angular_vel_x, .y = angular_vel_y, .z = angular_vel_z };
        }
    }
}

// Set rotation axes (bitmask: 1=X, 2=Y, 4=Z)
pub export fn set_entity_rotation_axes(id: u32, axis_mask: u8) void {
    if (findECSEntityById(id)) |index| {
        if (rotator_components[index].enabled) {
            rotator_components[index].axis_mask = axis_mask;
        }
    }
}
