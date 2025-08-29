// game_engine.zig - Thin WASM wrapper around game_core
const std = @import("std");
const core = @import("game_core.zig");

// State (pre-allocated) - using core types
var vertex_buffer: [10000]f32 = undefined;
var vertex_count: u32 = 0;

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

// Ball state
var ball_position: core.Vec3 = .{ .x = 0, .y = 3, .z = 2 };
var ball_velocity: core.Vec3 = .{ .x = 0, .y = 0, .z = 0 };
var ball_radius: f32 = 0.5;

var input_state: u8 = 0; // Bitmask for WASD
var collision_state: u8 = 0; // Bitmask for collisions

// WASM Exports - thin wrappers around core functionality
export fn init() void {
    // Set up initial view matrix using camera state
    updateViewMatrix();

    // Set up projection matrix (FOV 60°, aspect 4:3, near 0.1, far 100)
    uniforms.projection = core.createPerspective(60.0, 1.333, 0.1, 100.0);
}

fn updateViewMatrix() void {
    uniforms.view = core.createLookAt(camera_position, camera_target, camera_up);
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

export fn update(delta_time: f32) void {
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

    // Simulate ball physics with gravity only (no input forces)
    const force = core.Vec3{ .x = 0, .y = physics_gravity, .z = 0 };
    collision_state = simulatePhysicsWithConfig(&ball_position, &ball_velocity, delta_time, force, ball_radius);

    // Update model matrix with ball position
    uniforms.model = core.Mat4.identity();
    uniforms.model.data[12] = ball_position.x;
    uniforms.model.data[13] = ball_position.y;
    uniforms.model.data[14] = ball_position.z;
}

export fn set_input(key: u8, pressed: bool) void {
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

export fn generate_sphere_mesh(segments: u32) void {
    // Delegate mesh generation to core
    vertex_count = core.generateWireframeSphere(&vertex_buffer, segments, ball_radius);
}

export fn get_vertex_buffer_offset() u32 {
    return @as(u32, @intCast(@intFromPtr(&vertex_buffer)));
}

export fn get_uniform_buffer_offset() u32 {
    return @as(u32, @intCast(@intFromPtr(&uniforms)));
}

export fn get_vertex_count() u32 {
    return vertex_count;
}

export fn get_collision_state() u8 {
    return collision_state;
}

export fn set_position(x: f32, y: f32, z: f32) void {
    ball_position = .{ .x = x, .y = y, .z = z };
}

export fn apply_force(x: f32, y: f32, z: f32) void {
    ball_velocity.x += x;
    ball_velocity.y += y;
    ball_velocity.z += z;
}

export fn get_ball_position_x() f32 {
    return ball_position.x;
}

export fn get_ball_position_y() f32 {
    return ball_position.y;
}

export fn get_ball_position_z() f32 {
    return ball_position.z;
}

// Configuration exports for Phase 6.1
export fn set_camera_position(x: f32, y: f32, z: f32) void {
    camera_position = .{ .x = x, .y = y, .z = z };
    updateViewMatrix();
}

export fn set_camera_target(x: f32, y: f32, z: f32) void {
    camera_target = .{ .x = x, .y = y, .z = z };
    updateViewMatrix();
}

export fn set_physics_config(gravity: f32, damping: f32, restitution: f32) void {
    physics_gravity = gravity;
    physics_damping = damping;
    physics_restitution = restitution;
}

export fn set_world_bounds(x: f32, y: f32, z: f32) void {
    world_bounds = .{ .x = x, .y = y, .z = z };
}

export fn get_camera_position_x() f32 {
    return camera_position.x;
}

export fn get_camera_position_y() f32 {
    return camera_position.y;
}

export fn get_camera_position_z() f32 {
    return camera_position.z;
}