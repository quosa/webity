// game_engine.zig - Focused on bouncing ball demo with physics
const std = @import("std");

// Constants
const GRAVITY: f32 = -9.8;
const DAMPING: f32 = 0.99;
const RESTITUTION: f32 = 0.8;
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

var model_matrix: Mat4 = Mat4.identity();
var view_matrix: Mat4 = Mat4.identity();
var projection_matrix: Mat4 = Mat4.identity();

var ball_position: Vec3 = .{ .x = 0, .y = 2, .z = 0 };
var ball_velocity: Vec3 = .{ .x = 0, .y = 0, .z = 0 };
var ball_radius: f32 = 0.5;

var input_state: u8 = 0; // Bitmask for WASD
var collision_state: u8 = 0; // Bitmask for collisions

// Exports
export fn init() void {
    // Set up view matrix (camera at (0, 2, 5) looking at origin)
    view_matrix = createLookAt(
        Vec3{ .x = 0, .y = 2, .z = 5 },
        Vec3{ .x = 0, .y = 0, .z = 0 },
        Vec3{ .x = 0, .y = 1, .z = 0 }
    );

    // Set up projection matrix (FOV 60°, aspect 4:3, near 0.1, far 100)
    projection_matrix = createPerspective(60.0, 1.333, 0.1, 100.0);
}

export fn update(delta_time: f32) void {
    collision_state = 0;

    // Apply input forces
    var force = Vec3{ .x = 0, .y = 0, .z = 0 };
    if (input_state & 0x01 != 0) force.z -= 5.0; // W
    if (input_state & 0x02 != 0) force.x -= 5.0; // A
    if (input_state & 0x04 != 0) force.z += 5.0; // S
    if (input_state & 0x08 != 0) force.x += 5.0; // D

    // Apply gravity
    force.y += GRAVITY;

    // Update velocity (F = ma, assuming m = 1)
    ball_velocity.x += force.x * delta_time;
    ball_velocity.y += force.y * delta_time;
    ball_velocity.z += force.z * delta_time;

    // Apply damping
    ball_velocity.x *= DAMPING;
    ball_velocity.z *= DAMPING;

    // Update position
    ball_position.x += ball_velocity.x * delta_time;
    ball_position.y += ball_velocity.y * delta_time;
    ball_position.z += ball_velocity.z * delta_time;

    // Collision detection and response
    // Floor collision
    if (ball_position.y - ball_radius < -BOUNDS.y) {
        ball_position.y = -BOUNDS.y + ball_radius;
        ball_velocity.y = -ball_velocity.y * RESTITUTION;
        collision_state |= 0x01;
    }

    // Wall collisions (X axis)
    if (@abs(ball_position.x) + ball_radius > BOUNDS.x) {
        ball_position.x = std.math.sign(ball_position.x) * (BOUNDS.x - ball_radius);
        ball_velocity.x = -ball_velocity.x * RESTITUTION;
        collision_state |= 0x02;
    }

    // Wall collisions (Z axis)
    if (@abs(ball_position.z) + ball_radius > BOUNDS.z) {
        ball_position.z = std.math.sign(ball_position.z) * (BOUNDS.z - ball_radius);
        ball_velocity.z = -ball_velocity.z * RESTITUTION;
        collision_state |= 0x02;
    }

    // Update model matrix with ball position
    model_matrix = Mat4.identity();
    model_matrix.data[12] = ball_position.x;
    model_matrix.data[13] = ball_position.y;
    model_matrix.data[14] = ball_position.z;
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
    // Generate wireframe sphere
    vertex_count = generateWireframeSphere(&vertex_buffer, segments);
}

export fn get_vertex_buffer_offset() u32 {
    return @intFromPtr(&vertex_buffer);
}

export fn get_uniform_buffer_offset() u32 {
    return @intFromPtr(&model_matrix);
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

// Helper functions
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
        s.x,  u.x,  -f.x, 0,
        s.y,  u.y,  -f.y, 0,
        s.z,  u.z,  -f.z, 0,
        -dot(s, eye), -dot(u, eye), dot(f, eye), 1,
    } };
}

fn createPerspective(fov: f32, aspect: f32, near: f32, far: f32) Mat4 {
    const f = 1.0 / @tan(fov * std.math.pi / 360.0);
    const range_inv = 1.0 / (near - far);

    return Mat4{ .data = .{
        f / aspect, 0, 0,                      0,
        0,          f, 0,                      0,
        0,          0, (far + near) * range_inv, -1,
        0,          0, 2.0 * far * near * range_inv, 0,
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