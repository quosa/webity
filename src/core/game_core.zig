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

// Create rotation matrix from Euler angles (in radians)
pub fn createRotationMatrix(rotation: Vec3) Mat4 {
    const cos_x = @cos(rotation.x);
    const sin_x = @sin(rotation.x);
    const cos_y = @cos(rotation.y);
    const sin_y = @sin(rotation.y);
    const cos_z = @cos(rotation.z);
    const sin_z = @sin(rotation.z);
    
    // Combined XYZ rotation matrix (column-major)
    return Mat4{ .data = .{
        // Column 0
        cos_y * cos_z,
        cos_y * sin_z,
        -sin_y,
        0,
        // Column 1
        sin_x * sin_y * cos_z - cos_x * sin_z,
        sin_x * sin_y * sin_z + cos_x * cos_z,
        sin_x * cos_y,
        0,
        // Column 2
        cos_x * sin_y * cos_z + sin_x * sin_z,
        cos_x * sin_y * sin_z - sin_x * cos_z,
        cos_x * cos_y,
        0,
        // Column 3
        0, 0, 0, 1,
    } };
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

// =============================================================================
// Collision Detection and Response Functions
// =============================================================================

// Sphere-sphere collision detection
pub fn checkSphereCollision(pos1: Vec3, radius1: f32, pos2: Vec3, radius2: f32) ?f32 {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;

    const distance_squared = dx * dx + dy * dy + dz * dz;
    const combined_radius = radius1 + radius2;
    const combined_radius_squared = combined_radius * combined_radius;

    if (distance_squared < combined_radius_squared) {
        const dist = @sqrt(distance_squared);
        const overlap = combined_radius - dist;
        return overlap;
    }

    return null; // No collision
}

// Sphere-sphere collision response (elastic collision)
pub fn resolveSphereCollision(
    pos1: *Vec3, vel1: *Vec3, mass1: f32, radius1: f32,
    pos2: *Vec3, vel2: *Vec3, mass2: f32, radius2: f32,
    restitution: f32
) void {
    // Legacy function - calls new version assuming dynamic bodies
    resolveSphereCollisionWithKinematic(pos1, vel1, mass1, radius1, false, pos2, vel2, mass2, radius2, false, restitution);
}

// Sphere-sphere collision response with kinematic body support
pub fn resolveSphereCollisionWithKinematic(
    pos1: *Vec3, vel1: *Vec3, mass1: f32, radius1: f32, is_kinematic1: bool,
    pos2: *Vec3, vel2: *Vec3, mass2: f32, radius2: f32, is_kinematic2: bool,
    restitution: f32
) void {
    // Calculate collision normal (from sphere1 to sphere2)
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;

    const dist = @sqrt(dx * dx + dy * dy + dz * dz);
    if (dist == 0.0) return; // Prevent division by zero

    const normal = Vec3{
        .x = dx / dist,
        .y = dy / dist,
        .z = dz / dist,
    };

    // Use the kinematic flags passed as parameters

    // Separate overlapping spheres
    const combined_radius = radius1 + radius2;
    const overlap = combined_radius - dist;
    if (overlap > 0.0) {
        if (is_kinematic1 and is_kinematic2) {
            // Both kinematic - no separation needed
            return;
        } else if (is_kinematic1) {
            // Only sphere1 is kinematic - move sphere2 away completely with buffer
            const separation = overlap + 0.01; // Add buffer for kinematic separation
            pos2.x += normal.x * separation;
            pos2.y += normal.y * separation;
            pos2.z += normal.z * separation;
        } else if (is_kinematic2) {
            // Only sphere2 is kinematic - move sphere1 away completely with buffer
            const separation = overlap + 0.01; // Add buffer for kinematic separation
            pos1.x -= normal.x * separation;
            pos1.y -= normal.y * separation;
            pos1.z -= normal.z * separation;
        } else {
            // Both dynamic - split the separation equally, but add a small extra buffer
            const separation = overlap * 0.5 + 0.01; // Add 0.01 buffer to prevent immediate re-collision
            pos1.x -= normal.x * separation;
            pos1.y -= normal.y * separation;
            pos1.z -= normal.z * separation;

            pos2.x += normal.x * separation;
            pos2.y += normal.y * separation;
            pos2.z += normal.z * separation;
        }
    }

    // Calculate relative velocity in the direction of the collision normal
    const rel_vel_x = vel2.x - vel1.x;
    const rel_vel_y = vel2.y - vel1.y;
    const rel_vel_z = vel2.z - vel1.z;

    const vel_along_normal = rel_vel_x * normal.x + rel_vel_y * normal.y + rel_vel_z * normal.z;

    // Don't resolve if objects are separating
    if (vel_along_normal > 0) return;

    // Calculate impulse magnitude (treat kinematic bodies as infinite mass)
    var impulse_magnitude: f32 = 0.0;
    if (is_kinematic1 and is_kinematic2) {
        // Both kinematic - no velocity change needed
        return;
    } else {
        // Calculate effective inverse masses (0 for kinematic = infinite mass)
        const inv_mass1 = if (is_kinematic1) 0.0 else 1.0 / mass1;
        const inv_mass2 = if (is_kinematic2) 0.0 else 1.0 / mass2;
        const total_inv_mass = inv_mass1 + inv_mass2;

        // Avoid division by zero (shouldn't happen since at least one body is dynamic)
        if (total_inv_mass > 0.0) {
            impulse_magnitude = -(1.0 + restitution) * vel_along_normal / total_inv_mass;
        } else {
            return; // Safety check - both kinematic (already handled above)
        }
    }

    // Apply impulse
    const impulse_x = impulse_magnitude * normal.x;
    const impulse_y = impulse_magnitude * normal.y;
    const impulse_z = impulse_magnitude * normal.z;

    // Apply velocity changes (kinematic bodies don't change velocity)
    if (!is_kinematic1) {
        const inv_mass1 = 1.0 / mass1;
        vel1.x -= impulse_x * inv_mass1;
        vel1.y -= impulse_y * inv_mass1;
        vel1.z -= impulse_z * inv_mass1;
    }

    if (!is_kinematic2) {
        const inv_mass2 = 1.0 / mass2;
        vel2.x += impulse_x * inv_mass2;
        vel2.y += impulse_y * inv_mass2;
        vel2.z += impulse_z * inv_mass2;
    }
}

// Calculate distance between two points
pub fn distance(a: Vec3, b: Vec3) f32 {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return @sqrt(dx * dx + dy * dy + dz * dz);
}

// Vector magnitude
pub fn magnitude(v: Vec3) f32 {
    return @sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

// Vector subtraction
pub fn subtract(a: Vec3, b: Vec3) Vec3 {
    return Vec3{
        .x = a.x - b.x,
        .y = a.y - b.y,
        .z = a.z - b.z,
    };
}

// Vector addition
pub fn add(a: Vec3, b: Vec3) Vec3 {
    return Vec3{
        .x = a.x + b.x,
        .y = a.y + b.y,
        .z = a.z + b.z,
    };
}

// Vector scaling
pub fn scale(v: Vec3, s: f32) Vec3 {
    return Vec3{
        .x = v.x * s,
        .y = v.y * s,
        .z = v.z * s,
    };
}