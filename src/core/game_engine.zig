// game_engine.zig - Thin WASM wrapper around game_core
const std = @import("std");
const core = @import("game_core.zig");

// State (pre-allocated) - using core types
var vertex_buffer: [10000]f32 = undefined;
var vertex_count: u32 = 0;

// Separate vertex buffers for different mesh types
var sphere_vertex_buffer: [10000]f32 = undefined;
var sphere_vertex_count: u32 = 0;
var cube_vertex_buffer: [10000]f32 = undefined;
var cube_vertex_count: u32 = 0;

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

const Entity = struct {
    position: core.Vec3,
    velocity: core.Vec3,
    radius: f32,
    mesh_type: MeshType,
    active: bool,
};

var entities: [MAX_ENTITIES]Entity = undefined;
pub var entity_count: u32 = 0;

// Separate arrays for multi-mesh rendering
var sphere_entities: [MAX_ENTITIES]Entity = undefined;
var cube_entities: [MAX_ENTITIES]Entity = undefined;
pub var sphere_count: u32 = 0;
pub var cube_count: u32 = 0;

var input_state: u8 = 0; // Bitmask for WASD
var collision_state: u8 = 0; // Bitmask for collisions
var debug_floating_entity_index: u32 = MAX_ENTITIES; // Index of floating entity for debugging

fn initEntities() void {
    // Initialize all entities as inactive
    for (&entities) |*entity| {
        entity.* = Entity{
            .position = .{ .x = 0, .y = 0, .z = 0 },
            .velocity = .{ .x = 0, .y = 0, .z = 0 },
            .radius = 0.5,
            .mesh_type = MeshType.SPHERE,
            .active = false,
        };
    }
    entity_count = 0;

    // Initialize separate mesh type arrays
    for (&sphere_entities) |*entity| {
        entity.* = Entity{
            .position = .{ .x = 0, .y = 0, .z = 0 },
            .velocity = .{ .x = 0, .y = 0, .z = 0 },
            .radius = 0.5,
            .mesh_type = MeshType.SPHERE,
            .active = false,
        };
    }
    for (&cube_entities) |*entity| {
        entity.* = Entity{
            .position = .{ .x = 0, .y = 0, .z = 0 },
            .velocity = .{ .x = 0, .y = 0, .z = 0 },
            .radius = 0.5,
            .mesh_type = MeshType.CUBE,
            .active = false,
        };
    }
    sphere_count = 0;
    cube_count = 0;
}

fn syncSeparateEntityArrays() void {
    // Clear separate arrays first
    for (&sphere_entities) |*entity| {
        entity.active = false;
    }
    for (&cube_entities) |*entity| {
        entity.active = false;
    }
    
    // Synchronize separate mesh arrays with main entities array after physics updates
    var sphere_index: u32 = 0;
    var cube_index: u32 = 0;
    
    for (0..entity_count) |i| {
        if (!entities[i].active) continue;
        
        switch (entities[i].mesh_type) {
            MeshType.SPHERE => {
                if (sphere_index < MAX_ENTITIES) {
                    sphere_entities[sphere_index] = entities[i];
                    sphere_index += 1;
                }
            },
            MeshType.CUBE => {
                if (cube_index < MAX_ENTITIES) {
                    cube_entities[cube_index] = entities[i];
                    cube_index += 1;
                }
            },
        }
    }
    
    // Update counts to reflect synchronized entities
    sphere_count = sphere_index;
    cube_count = cube_index;
}

fn spawnEntityInternal(x: f32, y: f32, z: f32, radius: f32, mesh_type: MeshType) u32 {
    // Keep old entity array for backward compatibility
    if (entity_count >= MAX_ENTITIES) return MAX_ENTITIES; // Full

    const index = entity_count;
    entities[index] = Entity{
        .position = .{ .x = x, .y = y, .z = z },
        .velocity = .{ .x = 0, .y = 0, .z = 0 },
        .radius = radius,
        .mesh_type = mesh_type,
        .active = true,
    };
    entity_count += 1;

    // Also add to the appropriate mesh-type array
    switch (mesh_type) {
        MeshType.SPHERE => {
            if (sphere_count < MAX_ENTITIES) {
                sphere_entities[sphere_count] = Entity{
                    .position = .{ .x = x, .y = y, .z = z },
                    .velocity = .{ .x = 0, .y = 0, .z = 0 },
                    .radius = radius,
                    .mesh_type = mesh_type,
                    .active = true,
                };
                sphere_count += 1;
            }
        },
        MeshType.CUBE => {
            if (cube_count < MAX_ENTITIES) {
                cube_entities[cube_count] = Entity{
                    .position = .{ .x = x, .y = y, .z = z },
                    .velocity = .{ .x = 0, .y = 0, .z = 0 },
                    .radius = radius,
                    .mesh_type = mesh_type,
                    .active = true,
                };
                cube_count += 1;
            }
        },
    }

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

fn checkEntityCollisions(delta_time: f32) void {
    _ = delta_time; // Currently unused, but available for collision response

    // Check all pairs of active entities for collisions
    for (0..entity_count) |i| {
        if (!entities[i].active) continue;

        for (i + 1..entity_count) |j| {
            if (!entities[j].active) continue;

            // Calculate distance between sphere centers
            const dx = entities[i].position.x - entities[j].position.x;
            const dy = entities[i].position.y - entities[j].position.y;
            const dz = entities[i].position.z - entities[j].position.z;
            const distance_squared = dx * dx + dy * dy + dz * dz;
            const distance = @sqrt(distance_squared);

            const combined_radius = entities[i].radius + entities[j].radius;

            // Check if spheres are overlapping
            if (distance < combined_radius and distance > 0.001) { // Avoid division by zero
                // Calculate collision normal (from i to j)
                const normal = core.Vec3{
                    .x = dx / distance,
                    .y = dy / distance,
                    .z = dz / distance,
                };

                // Separate the spheres to prevent overlap
                const overlap = combined_radius - distance;
                const separation = overlap * 0.5;

                entities[i].position.x += normal.x * separation;
                entities[i].position.y += normal.y * separation;
                entities[i].position.z += normal.z * separation;

                entities[j].position.x -= normal.x * separation;
                entities[j].position.y -= normal.y * separation;
                entities[j].position.z -= normal.z * separation;

                // Calculate relative velocity
                const rel_vel = core.Vec3{
                    .x = entities[i].velocity.x - entities[j].velocity.x,
                    .y = entities[i].velocity.y - entities[j].velocity.y,
                    .z = entities[i].velocity.z - entities[j].velocity.z,
                };

                // Velocity component along collision normal
                const vel_along_normal = core.dot(rel_vel, normal);

                // Do not resolve if velocities are separating
                if (vel_along_normal > 0) continue;

                // Apply collision response (elastic collision, equal mass assumption)
                const restitution = physics_restitution;
                const impulse_scalar = -(1 + restitution) * vel_along_normal * 0.5;

                entities[i].velocity.x += impulse_scalar * normal.x;
                entities[i].velocity.y += impulse_scalar * normal.y;
                entities[i].velocity.z += impulse_scalar * normal.z;

                entities[j].velocity.x -= impulse_scalar * normal.x;
                entities[j].velocity.y -= impulse_scalar * normal.y;
                entities[j].velocity.z -= impulse_scalar * normal.z;

                // Mark collision for feedback
                collision_state |= 0x04; // New bit for entity-entity collisions
            }
        }
    }
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

    // Simulate physics for all active entities
    collision_state = 0;
    const force = core.Vec3{ .x = 0, .y = physics_gravity, .z = 0 };

    // First, apply forces and update velocities only (no position updates yet)
    for (0..entity_count) |i| {
        if (entities[i].active) {
            // Apply gravity and damping to velocity
            entities[i].velocity.x += force.x * delta_time;
            entities[i].velocity.y += force.y * delta_time;
            entities[i].velocity.z += force.z * delta_time;

            // Apply damping to horizontal motion only (not Y, since gravity should dominate)
            entities[i].velocity.x *= physics_damping;
            entities[i].velocity.z *= physics_damping;

            // TODO: check this!!!
            // Prevent numerical precision issues - if velocity is very small, let gravity dominate
            // DISABLED: This was interfering with settling logic
            // const min_velocity = 0.001;
            // if (@abs(entities[i].velocity.y) < min_velocity and entities[i].position.y > -world_bounds.y + entities[i].radius + 1.0) {
            //     // Entity is floating and should be falling - ensure it has some downward velocity
            //     if (entities[i].velocity.y > -min_velocity) {
            //         entities[i].velocity.y = -min_velocity;
            //     }
            // }
        }
    }

    // Second, check for entity-entity collisions BEFORE position updates (prevents separation fighting gravity)
    checkEntityCollisions(delta_time);

    // Third, update positions after collision resolution
    for (0..entity_count) |i| {
        if (entities[i].active) {
            // const was_floating = entities[i].position.y > -world_bounds.y + entities[i].radius + 0.5 and @abs(entities[i].velocity.y) < 0.01;

            // Update position
            entities[i].position.x += entities[i].velocity.x * delta_time;
            entities[i].position.y += entities[i].velocity.y * delta_time;
            entities[i].position.z += entities[i].velocity.z * delta_time;

            // Debug floating entities - temporarily disabled for testing
            // if (was_floating and entities[i].position.y > -world_bounds.y + entities[i].radius + 0.5) {
            //     // Mark this entity for debugging - we'll add a JS-callable debug function
            //     debug_floating_entity_index = @intCast(i);
            // }
        }
    }

    // Fourth, apply world boundary constraints (after positions are updated)
    for (0..entity_count) |i| {
        if (entities[i].active) {
            const entity_collision = applyWorldBoundaryConstraints(&entities[i].position, &entities[i].velocity, entities[i].radius);
            collision_state |= entity_collision;

            // Fifth, settle entities that are very close to floor with tiny velocities
            const floor_level = -world_bounds.y + entities[i].radius;
            const distance_to_floor = entities[i].position.y - floor_level;
            const settling_threshold = 0.05; // Within 0.05 units of floor (less aggressive)
            const velocity_threshold = 0.1; // Smaller velocity threshold (less aggressive)

            if (distance_to_floor < settling_threshold and @abs(entities[i].velocity.y) < velocity_threshold) {
                // Entity is essentially resting on floor - kill micro-bounces
                entities[i].velocity.y = 0.0;
                entities[i].position.y = floor_level; // Snap exactly to floor

                // Also dampen horizontal velocities when resting
                if (@abs(entities[i].velocity.x) < velocity_threshold) entities[i].velocity.x = 0.0;
                if (@abs(entities[i].velocity.z) < velocity_threshold) entities[i].velocity.z = 0.0;
            }
        }
    }

    // Synchronize separate mesh arrays with main entities array after physics update
    syncSeparateEntityArrays();

    // Update model matrix with first active entity position (for backward compatibility)
    uniforms.model = core.Mat4.identity();
    if (entity_count > 0 and entities[0].active) {
        uniforms.model.data[12] = entities[0].position.x;
        uniforms.model.data[13] = entities[0].position.y;
        uniforms.model.data[14] = entities[0].position.z;
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
    // Use first sphere entity's radius, or default if no sphere entities
    const radius = if (sphere_count > 0 and sphere_entities[0].active) sphere_entities[0].radius else 0.5;
    sphere_vertex_count = core.generateWireframeSphere(&sphere_vertex_buffer, segments, radius);
}

pub export fn generate_cube_mesh(size: f32) void {
    cube_vertex_count = core.generateWireframeCube(&cube_vertex_buffer, size);
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

// Separate mesh type buffer accessors
pub export fn get_sphere_vertex_buffer_offset() u32 {
    if (comptime @import("builtin").target.cpu.arch == .wasm32) {
        return @as(u32, @intCast(@intFromPtr(&sphere_vertex_buffer)));
    } else {
        return @truncate(@intFromPtr(&sphere_vertex_buffer));
    }
}

pub export fn get_sphere_vertex_count() u32 {
    return sphere_vertex_count;
}

pub export fn get_cube_vertex_buffer_offset() u32 {
    if (comptime @import("builtin").target.cpu.arch == .wasm32) {
        return @as(u32, @intCast(@intFromPtr(&cube_vertex_buffer)));
    } else {
        return @truncate(@intFromPtr(&cube_vertex_buffer));
    }
}

pub export fn get_cube_vertex_count() u32 {
    return cube_vertex_count;
}

pub export fn get_collision_state() u8 {
    return collision_state;
}

pub export fn set_position(x: f32, y: f32, z: f32) void {
    // Set position of first active entity for backward compatibility
    if (entity_count > 0 and entities[0].active) {
        entities[0].position = .{ .x = x, .y = y, .z = z };
    }
}

pub export fn apply_force(x: f32, y: f32, z: f32) void {
    // Apply force to first active entity for backward compatibility
    if (entity_count > 0 and entities[0].active) {
        entities[0].velocity.x += x;
        entities[0].velocity.y += y;
        entities[0].velocity.z += z;
    }
}

pub export fn get_ball_position_x() f32 {
    return if (entity_count > 0 and entities[0].active) entities[0].position.x else 0;
}

pub export fn get_ball_position_y() f32 {
    return if (entity_count > 0 and entities[0].active) entities[0].position.y else 0;
}

pub export fn get_ball_position_z() f32 {
    return if (entity_count > 0 and entities[0].active) entities[0].position.z else 0;
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

pub export fn get_entity_count() u32 {
    return entity_count;
}

pub export fn get_sphere_count() u32 {
    return sphere_count;
}

pub export fn get_cube_count() u32 {
    return cube_count;
}

pub export fn despawn_all_entities() void {
    for (&entities) |*entity| {
        entity.active = false;
    }
    entity_count = 0;

    // Also clear separate mesh arrays
    for (&sphere_entities) |*entity| {
        entity.active = false;
    }
    for (&cube_entities) |*entity| {
        entity.active = false;
    }
    sphere_count = 0;
    cube_count = 0;
}

pub export fn get_entity_position_x(index: u32) f32 {
    if (index >= MAX_ENTITIES or !entities[index].active) return 0;
    return entities[index].position.x;
}

pub export fn get_entity_position_y(index: u32) f32 {
    if (index >= MAX_ENTITIES or !entities[index].active) return 0;
    return entities[index].position.y;
}

pub export fn get_entity_position_z(index: u32) f32 {
    if (index >= MAX_ENTITIES or !entities[index].active) return 0;
    return entities[index].position.z;
}

// Sphere-specific position getters
pub export fn get_sphere_position_x(index: u32) f32 {
    if (index >= sphere_count or !sphere_entities[index].active) return 0;
    return sphere_entities[index].position.x;
}

pub export fn get_sphere_position_y(index: u32) f32 {
    if (index >= sphere_count or !sphere_entities[index].active) return 0;
    return sphere_entities[index].position.y;
}

pub export fn get_sphere_position_z(index: u32) f32 {
    if (index >= sphere_count or !sphere_entities[index].active) return 0;
    return sphere_entities[index].position.z;
}

// Cube-specific position getters
pub export fn get_cube_position_x(index: u32) f32 {
    if (index >= cube_count or !cube_entities[index].active) return 0;
    return cube_entities[index].position.x;
}

pub export fn get_cube_position_y(index: u32) f32 {
    if (index >= cube_count or !cube_entities[index].active) return 0;
    return cube_entities[index].position.y;
}

pub export fn get_cube_position_z(index: u32) f32 {
    if (index >= cube_count or !cube_entities[index].active) return 0;
    return cube_entities[index].position.z;
}

pub export fn set_entity_position(index: u32, x: f32, y: f32, z: f32) void {
    if (index >= MAX_ENTITIES or !entities[index].active) return;
    entities[index].position = .{ .x = x, .y = y, .z = z };
}

pub export fn set_entity_velocity(index: u32, x: f32, y: f32, z: f32) void {
    if (index >= MAX_ENTITIES or !entities[index].active) return;
    entities[index].velocity = .{ .x = x, .y = y, .z = z };
}

pub export fn get_entity_mesh_type(index: u32) u8 {
    if (index >= MAX_ENTITIES or !entities[index].active) return 0; // Default to SPHERE
    return @intFromEnum(entities[index].mesh_type);
}

// Debug exports
pub export fn get_debug_floating_entity_index() u32 {
    return debug_floating_entity_index;
}

pub export fn get_entity_velocity_y(index: u32) f32 {
    if (index >= MAX_ENTITIES or !entities[index].active) return 0;
    return entities[index].velocity.y;
}

pub export fn clear_debug_floating_entity() void {
    debug_floating_entity_index = MAX_ENTITIES;
}
