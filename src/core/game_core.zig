// game_core.zig - Pure game logic, no WASM exports
const std = @import("std");

// Constants
pub const GRAVITY: f32 = -9.8;
pub const DAMPING: f32 = 0.99;
pub const RESTITUTION: f32 = 0.8;
pub const BOUNDS: Vec3 = .{ .x = 8.0, .y = 8.0, .z = 8.0 };

// Types
pub const Vec3 = struct {
    x: f32,
    y: f32,
    z: f32,
};

pub const Mat4 = struct {
    data: [16]f32,

    pub fn identity() Mat4 {
        return .{ .data = .{
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        } };
    }
};

// Uniform buffer structure to ensure contiguous memory layout
pub const Uniforms = struct {
    model: Mat4,
    view: Mat4,
    projection: Mat4,
};

// Math functions
pub fn normalize(v: Vec3) Vec3 {
    const len = @sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len == 0.0) return v;
    return .{
        .x = v.x / len,
        .y = v.y / len,
        .z = v.z / len,
    };
}

pub fn cross(a: Vec3, b: Vec3) Vec3 {
    return .{
        .x = a.y * b.z - a.z * b.y,
        .y = a.z * b.x - a.x * b.z,
        .z = a.x * b.y - a.y * b.x,
    };
}

pub fn dot(a: Vec3, b: Vec3) f32 {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

// Matrix functions
pub fn createLookAt(eye: Vec3, center: Vec3, up: Vec3) Mat4 {
    const f = normalize(Vec3{
        .x = center.x - eye.x,
        .y = center.y - eye.y,
        .z = center.z - eye.z,
    });
    const s = normalize(cross(f, up));
    const u = cross(s, f);

    // Fix X-axis flip only (Y and Z are correct)
    return Mat4{ .data = .{
        -s.x,         u.x,          -f.x,        0,
        -s.y,         u.y,          -f.y,        0,
        -s.z,         u.z,          -f.z,        0,
        dot(s, eye), -dot(u, eye), dot(f, eye), 1,
    } };
}

pub fn createPerspective(fov: f32, aspect: f32, near: f32, far: f32) Mat4 {
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

// Mesh generation
pub fn generateWireframeSphere(vertices: [*]f32, segments: u32, ball_radius: f32) u32 {
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

// Physics simulation
pub fn simulatePhysicsStep(position: *Vec3, velocity: *Vec3, delta_time: f32, input_force: Vec3, ball_radius: f32) u8 {
    var collision_state: u8 = 0;

    // Apply forces
    var force = input_force;
    force.y += GRAVITY;

    // Update velocity
    velocity.x += force.x * delta_time;
    velocity.y += force.y * delta_time;
    velocity.z += force.z * delta_time;

    // Apply damping
    velocity.x *= DAMPING;
    velocity.z *= DAMPING;

    // Update position
    position.x += velocity.x * delta_time;
    position.y += velocity.y * delta_time;
    position.z += velocity.z * delta_time;

    // Collision detection and response
    // Floor collision
    if (position.y - ball_radius < -BOUNDS.y) {
        position.y = -BOUNDS.y + ball_radius;
        velocity.y = -velocity.y * RESTITUTION;
        collision_state |= 0x01;
    }

    // Wall collisions
    if (@abs(position.x) + ball_radius > BOUNDS.x) {
        position.x = std.math.sign(position.x) * (BOUNDS.x - ball_radius);
        velocity.x = -velocity.x * RESTITUTION;
        collision_state |= 0x02;
    }

    if (@abs(position.z) + ball_radius > BOUNDS.z) {
        position.z = std.math.sign(position.z) * (BOUNDS.z - ball_radius);
        velocity.z = -velocity.z * RESTITUTION;
        collision_state |= 0x02;
    }

    return collision_state;
}

// Helper function for generating wireframe cube (unused but kept for reference)
pub fn generateWireframeCube(vertices: [*]f32, ball_radius: f32) u32 {
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