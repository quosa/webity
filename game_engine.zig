// game_engine.zig - Focused on bouncing ball demo with physics
const std = @import("std");

// Constants
const GRAVITY: f32 = -2.0;
const DAMPING: f32 = 0.99;
const RESTITUTION: f32 = 0.95;
const BOUNDS: Vec3 = .{ .x = 5.0, .y = 5.0, .z = 5.0 };

// Types
const Vec3 = struct {
    x: f32,
    y: f32,
    z: f32,
};

const Mat4 = struct {
    data: [16]f32,

    fn identity() Mat4 {
        return .{ .data = .{
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        } };
    }
};

// State (pre-allocated)
var vertex_buffer: [10000]f32 = undefined;
var vertex_count: u32 = 0;

// Uniform buffer structure to ensure contiguous memory layout
const Uniforms = struct {
    model: Mat4,
    view: Mat4,
    projection: Mat4,
};

var uniforms: Uniforms = Uniforms{
    .model = Mat4.identity(),
    .view = Mat4.identity(),
    .projection = Mat4.identity(),
};

var ball_position: Vec3 = .{ .x = 0, .y = 0, .z = 2 };
var ball_velocity: Vec3 = .{ .x = 0, .y = 0, .z = 0 };
var ball_radius: f32 = 5.0;

var input_state: u8 = 0; // Bitmask for WASD
var collision_state: u8 = 0; // Bitmask for collisions

// Exports
export fn init() void {
    // Set up view matrix (camera at (0, 0, -20) looking at ball center) - behind scene for intuitive +/- controls
    uniforms.view = createLookAt(Vec3{ .x = 0, .y = 0, .z = -20 }, Vec3{ .x = 0, .y = 0, .z = 2 }, Vec3{ .x = 0, .y = 1, .z = 0 });

    // Set up projection matrix (FOV 60°, aspect 4:3, near 0.1, far 100)
    uniforms.projection = createPerspective(60.0, 1.333, 0.1, 100.0);
}

export fn update(delta_time: f32) void {
    collision_state = 0;

    var position_changed = false;
    const move_speed: f32 = 3.0;

    // Direct movement controls (no physics)
    if (input_state & 0x01 != 0) { // W - move up
        ball_position.y += move_speed * delta_time;
        position_changed = true;
    }
    if (input_state & 0x02 != 0) { // A - move left
        ball_position.x -= move_speed * delta_time;
        position_changed = true;
    }
    if (input_state & 0x04 != 0) { // S - move down
        ball_position.y -= move_speed * delta_time;
        position_changed = true;
    }
    if (input_state & 0x08 != 0) { // D - move right
        ball_position.x += move_speed * delta_time;
        position_changed = true;
    }
    if (input_state & 0x10 != 0) { // + - move closer (negative Z)
        ball_position.z -= move_speed * delta_time;
        position_changed = true;
    }
    if (input_state & 0x20 != 0) { // - - move further (positive Z)
        ball_position.z += move_speed * delta_time;
        position_changed = true;
    }

    // Log position when it changes (for debugging)
    if (position_changed) {
        // Note: This won't actually print in WASM, but we can read it from JS
        // We'll add a getter function for position debugging
    }

    // No collision detection in debug mode

    // Update model matrix with ball position
    uniforms.model = Mat4.identity();
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
        61 => @as(u8, 0x10), // + (or =)
        45 => @as(u8, 0x20), // -
        else => @as(u8, 0),
    };

    if (pressed) {
        input_state |= key_map;
    } else {
        input_state &= ~key_map;
    }
}

export fn generate_sphere_mesh(segments: u32) void {
    _ = segments; // Unused in cube mode
    // Generate simple wireframe cube for debugging
    vertex_count = generateWireframeCube(&vertex_buffer);
}

export fn get_vertex_buffer_offset() u32 {
    return @intFromPtr(&vertex_buffer);
}

export fn get_uniform_buffer_offset() u32 {
    return @intFromPtr(&uniforms);
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

// Helper functions
fn generateWireframeCube(vertices: [*]f32) u32 {
    const size: f32 = ball_radius;

    // Cube vertices (8 corners)
    const cube_verts = [_]f32{
        -size, -size, -size, // 0
        size, -size, -size, // 1
        size, size, -size, // 2
        -size, size, -size, // 3
        -size, -size, size, // 4
        size, -size, size, // 5
        size, size, size, // 6
        -size, size, size, // 7
    };

    // Wireframe edges (12 edges, 24 vertices)
    const edges = [_]u32{
        0, 1, 1, 2, 2, 3, 3, 0, // bottom face
        4, 5, 5, 6, 6, 7, 7, 4, // top face
        0, 4, 1, 5, 2, 6, 3, 7, // vertical edges
    };

    var index: u32 = 0;
    for (edges) |vert_idx| {
        vertices[index] = cube_verts[vert_idx * 3];
        vertices[index + 1] = cube_verts[vert_idx * 3 + 1];
        vertices[index + 2] = cube_verts[vert_idx * 3 + 2];
        index += 3;
    }

    return index / 3; // Return vertex count
}

fn generateWireframeSphere(vertices: [*]f32, segments: u32) u32 {
    var index: u32 = 0;

    // Generate latitude lines
    var lat: u32 = 0;
    while (lat < segments) : (lat += 1) {
        const theta = @as(f32, @floatFromInt(lat)) * std.math.pi / @as(f32, @floatFromInt(segments));
        const sin_theta = @sin(theta);
        const cos_theta = @cos(theta);

        var lon: u32 = 0;
        while (lon < segments) : (lon += 1) {
            const phi1 = @as(f32, @floatFromInt(lon)) * 2.0 * std.math.pi / @as(f32, @floatFromInt(segments));
            const phi2 = @as(f32, @floatFromInt(lon + 1)) * 2.0 * std.math.pi / @as(f32, @floatFromInt(segments));

            // First vertex
            vertices[index] = ball_radius * @cos(phi1) * sin_theta;
            vertices[index + 1] = ball_radius * cos_theta;
            vertices[index + 2] = ball_radius * @sin(phi1) * sin_theta;

            // Second vertex
            vertices[index + 3] = ball_radius * @cos(phi2) * sin_theta;
            vertices[index + 4] = ball_radius * cos_theta;
            vertices[index + 5] = ball_radius * @sin(phi2) * sin_theta;

            index += 6;
        }
    }

    // Generate longitude lines
    var lon: u32 = 0;
    while (lon < segments) : (lon += 1) {
        const phi = @as(f32, @floatFromInt(lon)) * 2.0 * std.math.pi / @as(f32, @floatFromInt(segments));
        const sin_phi = @sin(phi);
        const cos_phi = @cos(phi);

        var lat2: u32 = 0;
        while (lat2 < segments) : (lat2 += 1) {
            const theta1 = @as(f32, @floatFromInt(lat2)) * std.math.pi / @as(f32, @floatFromInt(segments));
            const theta2 = @as(f32, @floatFromInt(lat2 + 1)) * std.math.pi / @as(f32, @floatFromInt(segments));

            // First vertex
            vertices[index] = ball_radius * cos_phi * @sin(theta1);
            vertices[index + 1] = ball_radius * @cos(theta1);
            vertices[index + 2] = ball_radius * sin_phi * @sin(theta1);

            // Second vertex
            vertices[index + 3] = ball_radius * cos_phi * @sin(theta2);
            vertices[index + 4] = ball_radius * @cos(theta2);
            vertices[index + 5] = ball_radius * sin_phi * @sin(theta2);

            index += 6;
        }
    }

    return index / 3;
}

fn createLookAt(eye: Vec3, center: Vec3, up: Vec3) Mat4 {
    const f = normalize(Vec3{
        .x = center.x - eye.x,
        .y = center.y - eye.y,
        .z = center.z - eye.z,
    });
    const s = normalize(cross(f, up));
    const u = cross(s, f);

    return Mat4{ .data = .{
        s.x,          u.x,          -f.x,        0,
        s.y,          u.y,          -f.y,        0,
        s.z,          u.z,          -f.z,        0,
        -dot(s, eye), -dot(u, eye), dot(f, eye), 1,
    } };
}

fn createPerspective(fov: f32, aspect: f32, near: f32, far: f32) Mat4 {
    const f = 1.0 / @tan(fov * std.math.pi / 360.0);
    const range_inv = 1.0 / (near - far);

    // WebGPU uses Z range [0, 1] instead of OpenGL's [-1, 1]
    return Mat4{ .data = .{
        f / aspect, 0, 0,                        0,
        0,          f, 0,                        0,
        0,          0, far * range_inv,          -1,
        0,          0, far * near * range_inv,   0,
    } };
}

fn normalize(v: Vec3) Vec3 {
    const len = @sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len == 0.0) return v;
    return .{
        .x = v.x / len,
        .y = v.y / len,
        .z = v.z / len,
    };
}

fn cross(a: Vec3, b: Vec3) Vec3 {
    return .{
        .x = a.y * b.z - a.z * b.y,
        .y = a.z * b.x - a.x * b.z,
        .z = a.x * b.y - a.y * b.x,
    };
}

fn dot(a: Vec3, b: Vec3) f32 {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}
