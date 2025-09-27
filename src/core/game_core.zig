// game_core.zig - Pure game logic, no WASM exports
const builtin = @import("builtin");
const std = @import("std");

// Declare extern fn for wasm logging (implemented in TypeScript)
extern fn jslog(ptr: [*]const u8, len: usize) void;

// Fallback logger for non-WASM targets (unit tests)
fn native_log(ptr: [*]const u8, len: usize) void {
    const slice = ptr[0..len];
    std.debug.print("{s}", .{slice});
}

// Conditional logger assignment (ts vs zig test)
pub const log = if (builtin.target.cpu.arch == .wasm32) jslog else native_log;

// =============================================================================

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

// Collision shape enumeration
pub const CollisionShape = enum(u8) {
    SPHERE = 0,
    BOX = 1,
    PLANE = 2, // Future implementation
};

// Collision information structure
pub const CollisionInfo = struct {
    has_collision: bool,
    penetration_depth: f32,
    contact_normal: Vec3,
    contact_point: Vec3,
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

// Additional Vec3 utilities for AABB calculations
pub fn vec3_min(a: Vec3, b: Vec3) Vec3 {
    return Vec3{
        .x = @min(a.x, b.x),
        .y = @min(a.y, b.y),
        .z = @min(a.z, b.z),
    };
}

pub fn vec3_max(a: Vec3, b: Vec3) Vec3 {
    return Vec3{
        .x = @max(a.x, b.x),
        .y = @max(a.y, b.y),
        .z = @max(a.z, b.z),
    };
}

pub fn vec3_abs(v: Vec3) Vec3 {
    return Vec3{
        .x = @abs(v.x),
        .y = @abs(v.y),
        .z = @abs(v.z),
    };
}

pub fn vec3_clamp(v: Vec3, min_val: Vec3, max_val: Vec3) Vec3 {
    return Vec3{
        .x = @max(min_val.x, @min(max_val.x, v.x)),
        .y = @max(min_val.y, @min(max_val.y, v.y)),
        .z = @max(min_val.z, @min(max_val.z, v.z)),
    };
}

pub fn vec3_subtract(a: Vec3, b: Vec3) Vec3 {
    return Vec3{
        .x = a.x - b.x,
        .y = a.y - b.y,
        .z = a.z - b.z,
    };
}

pub fn vec3_add(a: Vec3, b: Vec3) Vec3 {
    return Vec3{
        .x = a.x + b.x,
        .y = a.y + b.y,
        .z = a.z + b.z,
    };
}

pub fn vec3_scale(v: Vec3, s: f32) Vec3 {
    return Vec3{
        .x = v.x * s,
        .y = v.y * s,
        .z = v.z * s,
    };
}

pub fn vec3_negate(v: Vec3) Vec3 {
    return Vec3{
        .x = -v.x,
        .y = -v.y,
        .z = -v.z,
    };
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
    return Mat4{
        .data = .{
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
            0,
            0,
            0,
            1,
        },
    };
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
        -s.x,        u.x,          -f.x,        0,
        -s.y,        u.y,          -f.y,        0,
        -s.z,        u.z,          -f.z,        0,
        dot(s, eye), -dot(u, eye), dot(f, eye), 1,
    } };
}

pub fn createPerspective(fov: f32, aspect: f32, near: f32, far: f32) Mat4 {
    const f = 1.0 / @tan(fov * std.math.pi / 360.0);
    const range_inv = 1.0 / (near - far);

    // WebGPU uses Z range [0, 1] instead of OpenGL's [-1, 1]
    return Mat4{ .data = .{
        f / aspect, 0, 0,                      0,
        0,          f, 0,                      0,
        0,          0, far * range_inv,        -1,
        0,          0, far * near * range_inv, 0,
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
// Legacy Sphere Collision Functions (maintained for compatibility)
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
pub fn resolveSphereCollision(pos1: *Vec3, vel1: *Vec3, mass1: f32, radius1: f32, pos2: *Vec3, vel2: *Vec3, mass2: f32, radius2: f32, restitution: f32) void {
    // Legacy function - calls new version assuming dynamic bodies
    resolveSphereCollisionWithKinematic(pos1, vel1, mass1, radius1, false, pos2, vel2, mass2, radius2, false, restitution);
}

// Sphere-sphere collision response with kinematic body support
pub fn resolveSphereCollisionWithKinematic(pos1: *Vec3, vel1: *Vec3, mass1: f32, radius1: f32, is_kinematic1: bool, pos2: *Vec3, vel2: *Vec3, mass2: f32, radius2: f32, is_kinematic2: bool, restitution: f32) void {
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
            // Only sphere1 is kinematic - move sphere2 away completely
            pos2.x += normal.x * overlap;
            pos2.y += normal.y * overlap;
            pos2.z += normal.z * overlap;
        } else if (is_kinematic2) {
            // Only sphere2 is kinematic - move sphere1 away completely
            pos1.x -= normal.x * overlap;
            pos1.y -= normal.y * overlap;
            pos1.z -= normal.z * overlap;
        } else {
            // Both dynamic - split the separation equally (original working logic)
            const separation = overlap * 0.5;
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

// =============================================================================
// AABB (Box) Collision Detection Functions
// =============================================================================

/// Check collision between two axis-aligned bounding boxes
/// Returns collision info with penetration depth and normal if collision detected
pub fn checkBoxCollision(pos1: Vec3, extents1: Vec3, pos2: Vec3, extents2: Vec3) ?CollisionInfo {
    // Calculate separation distances on each axis
    const delta = vec3_subtract(pos2, pos1);
    const combined_extents = vec3_add(extents1, extents2);
    const separation = vec3_subtract(vec3_abs(delta), combined_extents);

    // No collision if separated on any axis
    if (separation.x > 0 or separation.y > 0 or separation.z > 0) {
        return null;
    }

    // Calculate penetration depths for each axis
    const penetration_x = -separation.x;
    const penetration_y = -separation.y;
    const penetration_z = -separation.z;

    // 🔍 DEBUG: Log penetration analysis for stacking issues using log
    const debug_enabled = false; // Set to true for detailed collision normal debugging

    if (debug_enabled) {
        // Log penetration analysis using log
        var debug_buffer: [512]u8 = undefined;
        const debug_msg = std.fmt.bufPrint(&debug_buffer, "🔍 BOX COLLISION ANALYSIS:\n  pos1=({d:.3},{d:.3},{d:.3}), extents1=({d:.3},{d:.3},{d:.3})\n  pos2=({d:.3},{d:.3},{d:.3}), extents2=({d:.3},{d:.3},{d:.3})\n  delta=({d:.3},{d:.3},{d:.3})\n  penetrations: X={d:.3}, Y={d:.3}, Z={d:.3}\n", .{ pos1.x, pos1.y, pos1.z, extents1.x, extents1.y, extents1.z, pos2.x, pos2.y, pos2.z, extents2.x, extents2.y, extents2.z, delta.x, delta.y, delta.z, penetration_x, penetration_y, penetration_z }) catch "BOX COLLISION ANALYSIS: formatting error\n";
        log(debug_msg.ptr, debug_msg.len);
    }

    // 🎯 SMART COLLISION NORMAL SELECTION: Prioritize Y-axis for stacking behavior
    // Problem: When boxes have similar penetration depths, we want to prioritize
    // vertical separation over horizontal separation for natural stacking

    var min_penetration = penetration_x;
    var collision_normal = Vec3{ .x = if (delta.x < 0) 1.0 else -1.0, .y = 0, .z = 0 };
    var collision_axis: u8 = 0; // 0=X, 1=Y, 2=Z
    var selected_reason: []const u8 = "minimum_x";

    // Check Y-axis penetration with stacking bias
    if (penetration_y < min_penetration) {
        min_penetration = penetration_y;
        collision_normal = Vec3{ .x = 0, .y = if (delta.y < 0) -1.0 else 1.0, .z = 0 };
        collision_axis = 1;
        selected_reason = "minimum_y";
    } else if (penetration_y <= min_penetration + 0.1) {
        // STACKING PRIORITY: If Y penetration is close to minimum (within 0.1),
        // prefer Y-axis for natural stacking behavior
        min_penetration = penetration_y;
        collision_normal = Vec3{ .x = 0, .y = if (delta.y < 0) -1.0 else 1.0, .z = 0 };
        collision_axis = 1;
        selected_reason = "stacking_priority_y";
    }

    // Check Z-axis penetration
    if (penetration_z < min_penetration) {
        min_penetration = penetration_z;
        collision_normal = Vec3{ .x = 0, .y = 0, .z = if (delta.z < 0) 1.0 else -1.0 };
        collision_axis = 2;
        selected_reason = "minimum_z";
    }

    if (debug_enabled) {
        const axis_name = switch (collision_axis) {
            0 => "X",
            1 => "Y",
            2 => "Z",
            else => "?",
        };
        var result_buffer: [256]u8 = undefined;
        const result_msg = std.fmt.bufPrint(&result_buffer, "  Selected {s}-axis: penetration={d:.3}, normal=({d:.3},{d:.3},{d:.3}), reason={s}\n", .{ axis_name, min_penetration, collision_normal.x, collision_normal.y, collision_normal.z, selected_reason }) catch "COLLISION NORMAL RESULT: formatting error\n";
        log(result_msg.ptr, result_msg.len);
    }

    // Calculate contact point (on the surface of box1 closest to box2)
    const contact_point = vec3_add(pos1, vec3_scale(collision_normal, extents1.x * @abs(collision_normal.x) + extents1.y * @abs(collision_normal.y) + extents1.z * @abs(collision_normal.z)));

    return CollisionInfo{
        .has_collision = true,
        .penetration_depth = min_penetration,
        .contact_normal = collision_normal,
        .contact_point = contact_point,
    };
}

/// Check collision between sphere and axis-aligned bounding box
/// Handles face, edge, and corner collision cases
pub fn checkSphereBoxCollision(sphere_pos: Vec3, radius: f32, box_pos: Vec3, box_extents: Vec3) ?CollisionInfo {
    // Find closest point on box to sphere center
    const box_min = vec3_subtract(box_pos, box_extents);
    const box_max = vec3_add(box_pos, box_extents);
    const closest_point = vec3_clamp(sphere_pos, box_min, box_max);

    // Calculate distance from sphere center to closest point
    const distance_vec = vec3_subtract(sphere_pos, closest_point);
    const distance_squared = dot(distance_vec, distance_vec);
    const radius_squared = radius * radius;

    // Check if sphere intersects box
    if (distance_squared <= radius_squared) {
        if (distance_squared == 0) {
            // Special case: sphere center is inside the box
            // Find the shortest direction to push sphere out
            const center_to_min = vec3_subtract(sphere_pos, box_min);
            const center_to_max = vec3_subtract(box_max, sphere_pos);

            // Find minimum distance to each face
            var min_dist = center_to_min.x;
            var normal = Vec3{ .x = -1, .y = 0, .z = 0 };

            if (center_to_max.x < min_dist) {
                min_dist = center_to_max.x;
                normal = Vec3{ .x = 1, .y = 0, .z = 0 };
            }
            if (center_to_min.y < min_dist) {
                min_dist = center_to_min.y;
                normal = Vec3{ .x = 0, .y = -1, .z = 0 };
            }
            if (center_to_max.y < min_dist) {
                min_dist = center_to_max.y;
                normal = Vec3{ .x = 0, .y = 1, .z = 0 };
            }
            if (center_to_min.z < min_dist) {
                min_dist = center_to_min.z;
                normal = Vec3{ .x = 0, .y = 0, .z = -1 };
            }
            if (center_to_max.z < min_dist) {
                min_dist = center_to_max.z;
                normal = Vec3{ .x = 0, .y = 0, .z = 1 };
            }

            return CollisionInfo{
                .has_collision = true,
                .penetration_depth = radius + min_dist,
                .contact_normal = normal,
                .contact_point = vec3_add(sphere_pos, vec3_scale(normal, -radius)),
            };
        } else {
            // Normal case: sphere intersects box surface
            const dist = @sqrt(distance_squared);
            const penetration = radius - dist;
            const normal = vec3_scale(distance_vec, 1.0 / dist);

            return CollisionInfo{
                .has_collision = true,
                .penetration_depth = penetration,
                .contact_normal = normal,
                .contact_point = closest_point,
            };
        }
    }

    return null; // No collision
}

/// Convert legacy sphere collision result to CollisionInfo format
fn convertSphereCollisionToInfo(pos1: Vec3, radius1: f32, pos2: Vec3, _: f32, overlap: f32) CollisionInfo {
    const delta = vec3_subtract(pos2, pos1);
    const dist = magnitude(delta);
    const normal = if (dist > 0) vec3_scale(delta, 1.0 / dist) else Vec3{ .x = 1, .y = 0, .z = 0 };
    const contact_point = vec3_add(pos1, vec3_scale(normal, radius1));

    return CollisionInfo{
        .has_collision = true,
        .penetration_depth = overlap,
        .contact_normal = normal,
        .contact_point = contact_point,
    };
}

/// Universal collision check that dispatches based on collision shapes
pub fn checkCollision(pos1: Vec3, shape1: CollisionShape, extents1: Vec3, pos2: Vec3, shape2: CollisionShape, extents2: Vec3) ?CollisionInfo {
    switch (shape1) {
        .SPHERE => switch (shape2) {
            .SPHERE => {
                if (checkSphereCollision(pos1, extents1.x, pos2, extents2.x)) |overlap| {
                    return convertSphereCollisionToInfo(pos1, extents1.x, pos2, extents2.x, overlap);
                }
                return null;
            },
            .BOX => return checkSphereBoxCollision(pos1, extents1.x, pos2, extents2),
            .PLANE => return null, // Future implementation
        },
        .BOX => switch (shape2) {
            .SPHERE => {
                // Swap order and negate normal for box-sphere collision
                if (checkSphereBoxCollision(pos2, extents2.x, pos1, extents1)) |collision_info| {
                    return CollisionInfo{
                        .has_collision = collision_info.has_collision,
                        .penetration_depth = collision_info.penetration_depth,
                        .contact_normal = vec3_negate(collision_info.contact_normal),
                        .contact_point = collision_info.contact_point,
                    };
                }
                return null;
            },
            .BOX => return checkBoxCollision(pos1, extents1, pos2, extents2),
            .PLANE => return null, // Future implementation
        },
        .PLANE => return null, // Future implementation
    }
}

/// Resolve collision between two boxes with kinematic support
pub fn resolveBoxCollision(pos1: *Vec3, vel1: *Vec3, _: Vec3, mass1: f32, is_kinematic1: bool, pos2: *Vec3, vel2: *Vec3, _: Vec3, mass2: f32, is_kinematic2: bool, restitution: f32, collision_info: CollisionInfo) void {
    const normal = collision_info.contact_normal;
    const penetration = collision_info.penetration_depth;

    // 🎯 SIMPLIFIED STACKING: Remove aggressive floor constraint logic
    // The original floor constraint was too aggressive and prevented proper stacking

    // Separate overlapping boxes with proper kinematic handling
    if (penetration > 0.0) {
        if (is_kinematic1 and is_kinematic2) {
            // Both kinematic - no separation needed
            return;
        } else if (is_kinematic1) {
            // Only box1 is kinematic - move box2 away completely
            const separation = penetration + 0.01; // Small buffer
            pos2.* = vec3_add(pos2.*, vec3_scale(normal, separation));
        } else if (is_kinematic2) {
            // Only box2 is kinematic - move box1 away from box2
            // Move box1 in direction of the normal (which points away from box2)
            const separation = penetration + 0.01; // Small buffer
            pos1.* = vec3_add(pos1.*, vec3_scale(normal, separation));
        } else {
            // Both dynamic - split separation equally
            const separation_distance = (penetration + 0.01) * 0.5;
            pos1.* = vec3_subtract(pos1.*, vec3_scale(normal, separation_distance));
            pos2.* = vec3_add(pos2.*, vec3_scale(normal, separation_distance));
        }
    }

    // Calculate relative velocity in the direction of the collision normal
    // Use standard physics convention: vel2 - vel1 (relative velocity of object 2 w.r.t object 1)
    const rel_vel = vec3_subtract(vel2.*, vel1.*); // vel2 - vel1 for relative velocity
    const vel_along_normal = dot(rel_vel, normal);

    // Debug: Log velocity resolution details
    const debug_enabled = false; // Set to true for debugging
    if (debug_enabled) {
        var debug_buffer: [256]u8 = undefined;
        const debug_msg = std.fmt.bufPrint(&debug_buffer, "🔧 VEL RESOLVE: rel_vel=({d:.2},{d:.2}), normal=({d:.2},{d:.2}), vel_along_normal={d:.2}\n", .{ rel_vel.x, rel_vel.y, normal.x, normal.y, vel_along_normal }) catch "VEL RESOLVE: debug error\n";
        log(debug_msg.ptr, debug_msg.len);
    }

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

        // Avoid division by zero
        if (total_inv_mass > 0.0) {
            impulse_magnitude = -(1.0 + restitution) * vel_along_normal / total_inv_mass;
        } else {
            return; // Safety check - both kinematic
        }
    }

    // Apply impulse
    const impulse = vec3_scale(normal, impulse_magnitude);

    // Apply velocity changes (kinematic bodies don't change velocity)
    if (!is_kinematic1) {
        const inv_mass1 = 1.0 / mass1;
        vel1.* = vec3_subtract(vel1.*, vec3_scale(impulse, inv_mass1));
    }

    if (!is_kinematic2) {
        const inv_mass2 = 1.0 / mass2;
        vel2.* = vec3_add(vel2.*, vec3_scale(impulse, inv_mass2));
    }
}

/// Resolve sphere-box collision with proper physics
fn resolveSphereBoxCollision(sphere_pos: *Vec3, sphere_vel: *Vec3, _: f32, sphere_mass: f32, sphere_kinematic: bool, box_pos: *Vec3, box_vel: *Vec3, _: Vec3, box_mass: f32, box_kinematic: bool, restitution: f32, collision_info: CollisionInfo) void {
    const normal = collision_info.contact_normal;
    const penetration = collision_info.penetration_depth;

    // Position separation: move sphere away from box
    if (penetration > 0.0) {
        if (sphere_kinematic and box_kinematic) {
            return;
        } else if (sphere_kinematic) {
            // Only sphere is kinematic - move box away from sphere
            // Normal points from box toward sphere, so SUBTRACT to move box away
            const separation = penetration + 0.01;
            box_pos.* = vec3_subtract(box_pos.*, vec3_scale(normal, separation));
        } else if (box_kinematic) {
            // Only box is kinematic - move sphere away from box
            // Normal points from box toward sphere, so ADD to move sphere away
            const separation = penetration + 0.05; // Increased separation to prevent re-collision
            sphere_pos.* = vec3_add(sphere_pos.*, vec3_scale(normal, separation));
        } else {
            // Both dynamic - split separation
            const separation_distance = (penetration + 0.05) * 0.5; // Increased separation
            sphere_pos.* = vec3_add(sphere_pos.*, vec3_scale(normal, separation_distance));
            box_pos.* = vec3_subtract(box_pos.*, vec3_scale(normal, separation_distance));
        }
    }

    // Velocity resolution using proper sphere-box physics
    const rel_vel = vec3_subtract(sphere_vel.*, box_vel.*);
    const vel_along_normal = dot(rel_vel, normal);

    // Don't resolve if objects are separating or in resting contact
    if (vel_along_normal > -0.2) return; // Stronger threshold for sphere-box resting contact

    // Calculate impulse magnitude
    var impulse_magnitude: f32 = 0.0;
    if (sphere_kinematic and box_kinematic) {
        return;
    } else {
        const inv_mass_sphere = if (sphere_kinematic) 0.0 else 1.0 / sphere_mass;
        const inv_mass_box = if (box_kinematic) 0.0 else 1.0 / box_mass;
        const total_inv_mass = inv_mass_sphere + inv_mass_box;

        if (total_inv_mass > 0.0) {
            impulse_magnitude = -(1.0 + restitution) * vel_along_normal / total_inv_mass;
        } else {
            return;
        }
    }

    // Apply impulse with proper sphere physics consideration
    const impulse = vec3_scale(normal, impulse_magnitude);

    if (!sphere_kinematic) {
        const inv_mass_sphere = 1.0 / sphere_mass;
        sphere_vel.* = vec3_add(sphere_vel.*, vec3_scale(impulse, inv_mass_sphere));

        // Apply slight damping to help sphere settle on small bounces
        const velocity_magnitude = magnitude(sphere_vel.*);
        if (velocity_magnitude < 1.0) { // Stronger damping for very small velocities
            sphere_vel.* = vec3_scale(sphere_vel.*, 0.85); // 15% velocity reduction
        } else if (velocity_magnitude < 3.0) { // Moderate damping for small velocities
            sphere_vel.* = vec3_scale(sphere_vel.*, 0.92); // 8% velocity reduction
        }
    }

    if (!box_kinematic) {
        const inv_mass_box = 1.0 / box_mass;
        box_vel.* = vec3_subtract(box_vel.*, vec3_scale(impulse, inv_mass_box));
    }
}

/// Universal collision resolution that dispatches based on collision shapes
pub fn resolveCollision(pos1: *Vec3, vel1: *Vec3, shape1: CollisionShape, extents1: Vec3, mass1: f32, is_kinematic1: bool, pos2: *Vec3, vel2: *Vec3, shape2: CollisionShape, extents2: Vec3, mass2: f32, is_kinematic2: bool, restitution: f32, collision_info: CollisionInfo) void {
    switch (shape1) {
        .SPHERE => switch (shape2) {
            .SPHERE => {
                // Use existing sphere collision resolution
                resolveSphereCollisionWithKinematic(pos1, vel1, mass1, extents1.x, is_kinematic1, pos2, vel2, mass2, extents2.x, is_kinematic2, restitution);
            },
            .BOX => {
                // Sphere-box collision: use specialized sphere-box resolver
                resolveSphereBoxCollision(pos1, vel1, extents1.x, mass1, is_kinematic1, pos2, vel2, extents2, mass2, is_kinematic2, restitution, collision_info);
            },
            .PLANE => {}, // Future implementation
        },
        .BOX => switch (shape2) {
            .SPHERE => {
                // Box-sphere collision: swap order and negate normal for sphere-box resolver
                var flipped_collision_info = collision_info;
                flipped_collision_info.contact_normal = vec3_negate(collision_info.contact_normal);
                resolveSphereBoxCollision(pos2, vel2, extents2.x, mass2, is_kinematic2, pos1, vel1, extents1, mass1, is_kinematic1, restitution, flipped_collision_info);
            },
            .BOX => {
                // Box-box collision: use box collision resolution
                resolveBoxCollision(pos1, vel1, extents1, mass1, is_kinematic1, pos2, vel2, extents2, mass2, is_kinematic2, restitution, collision_info);
            },
            .PLANE => {}, // Future implementation
        },
        .PLANE => {}, // Future implementation
    }
}
