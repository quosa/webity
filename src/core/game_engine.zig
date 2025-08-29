// game_engine.zig - Thin WASM wrapper around game_core
const core = @import("game_core.zig");

// State (pre-allocated) - using core types
var vertex_buffer: [10000]f32 = undefined;
var vertex_count: u32 = 0;

var uniforms: core.Uniforms = core.Uniforms{
    .model = core.Mat4.identity(),
    .view = core.Mat4.identity(),
    .projection = core.Mat4.identity(),
};

var ball_position: core.Vec3 = .{ .x = 0, .y = 3, .z = 2 };
var ball_velocity: core.Vec3 = .{ .x = 0, .y = 0, .z = 0 };
var ball_radius: f32 = 0.5;

var input_state: u8 = 0; // Bitmask for WASD
var collision_state: u8 = 0; // Bitmask for collisions

// WASM Exports - thin wrappers around core functionality
export fn init() void {
    // Set up view matrix (camera at (0, 0, -20) looking at ball center) - behind scene for intuitive +/- controls
    uniforms.view = core.createLookAt(core.Vec3{ .x = 0, .y = 0, .z = -20 }, core.Vec3{ .x = 0, .y = 0, .z = 2 }, core.Vec3{ .x = 0, .y = 1, .z = 0 });

    // Set up projection matrix (FOV 60°, aspect 4:3, near 0.1, far 100)
    uniforms.projection = core.createPerspective(60.0, 1.333, 0.1, 100.0);
}

export fn update(delta_time: f32) void {
    collision_state = 0;

    // Apply input forces
    var force = core.Vec3{ .x = 0, .y = 0, .z = 0 };
    const input_force: f32 = 8.0;
    if (input_state & 0x01 != 0) force.z -= input_force; // W - forward
    if (input_state & 0x02 != 0) force.x -= input_force; // A - left  
    if (input_state & 0x04 != 0) force.z += input_force; // S - backward
    if (input_state & 0x08 != 0) force.x += input_force; // D - right

    // Delegate physics simulation to core
    collision_state = core.simulatePhysicsStep(&ball_position, &ball_velocity, delta_time, force, ball_radius);

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