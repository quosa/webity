// game_core_test.zig - Clean direct testing of game core functionality
const std = @import("std");
const testing = std.testing;
const core = @import("game_core.zig");

// Helper methods for testing
const Vec3TestHelper = struct {
    fn equals(self: core.Vec3, other: core.Vec3) bool {
        const epsilon: f32 = 0.0001;
        return (@abs(self.x - other.x) < epsilon and
                @abs(self.y - other.y) < epsilon and
                @abs(self.z - other.z) < epsilon);
    }
};

const Mat4TestHelper = struct {
    fn equals(self: core.Mat4, other: core.Mat4) bool {
        const epsilon: f32 = 0.0001;
        for (self.data, 0..) |val, i| {
            if (@abs(val - other.data[i]) >= epsilon) {
                return false;
            }
        }
        return true;
    }
};

// Math Function Tests
test "Vec3 normalize function" {
    const v = core.Vec3{ .x = 3.0, .y = 4.0, .z = 0.0 };
    const normalized = core.normalize(v);
    const expected = core.Vec3{ .x = 0.6, .y = 0.8, .z = 0.0 };
    
    try testing.expect(Vec3TestHelper.equals(normalized, expected));
    
    // Test magnitude is 1
    const magnitude = @sqrt(normalized.x * normalized.x + normalized.y * normalized.y + normalized.z * normalized.z);
    try testing.expectApproxEqAbs(@as(f32, 1.0), magnitude, 0.0001);
}

test "Vec3 cross product" {
    const a = core.Vec3{ .x = 1.0, .y = 0.0, .z = 0.0 };
    const b = core.Vec3{ .x = 0.0, .y = 1.0, .z = 0.0 };
    const result = core.cross(a, b);
    const expected = core.Vec3{ .x = 0.0, .y = 0.0, .z = 1.0 };
    
    try testing.expect(Vec3TestHelper.equals(result, expected));
}

test "Vec3 dot product" {
    const a = core.Vec3{ .x = 1.0, .y = 2.0, .z = 3.0 };
    const b = core.Vec3{ .x = 4.0, .y = 5.0, .z = 6.0 };
    const result = core.dot(a, b);
    
    try testing.expectApproxEqAbs(@as(f32, 32.0), result, 0.0001); // 1*4 + 2*5 + 3*6 = 32
}

// Matrix Tests
test "Mat4 identity matrix" {
    const identity = core.Mat4.identity();
    
    // Check diagonal elements are 1
    try testing.expectApproxEqAbs(@as(f32, 1.0), identity.data[0], 0.0001);
    try testing.expectApproxEqAbs(@as(f32, 1.0), identity.data[5], 0.0001);
    try testing.expectApproxEqAbs(@as(f32, 1.0), identity.data[10], 0.0001);
    try testing.expectApproxEqAbs(@as(f32, 1.0), identity.data[15], 0.0001);
    
    // Check off-diagonal elements are 0
    try testing.expectApproxEqAbs(@as(f32, 0.0), identity.data[1], 0.0001);
    try testing.expectApproxEqAbs(@as(f32, 0.0), identity.data[4], 0.0001);
}

test "createLookAt matrix basic functionality" {
    const eye = core.Vec3{ .x = 0.0, .y = 0.0, .z = 5.0 };
    const center = core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const up = core.Vec3{ .x = 0.0, .y = 1.0, .z = 0.0 };
    
    const view_matrix = core.createLookAt(eye, center, up);
    
    // Basic sanity check - matrix should be non-zero
    var non_zero_count: u32 = 0;
    for (view_matrix.data) |val| {
        if (@abs(val) > 0.0001) {
            non_zero_count += 1;
        }
    }
    try testing.expect(non_zero_count > 0);
}

test "createPerspective matrix basic functionality" {
    const fov: f32 = 60.0;
    const aspect: f32 = 1.333;
    const near: f32 = 0.1;
    const far: f32 = 100.0;
    
    const proj_matrix = core.createPerspective(fov, aspect, near, far);
    
    // Check that key elements are non-zero
    try testing.expect(@abs(proj_matrix.data[0]) > 0.0001); // x scale
    try testing.expect(@abs(proj_matrix.data[5]) > 0.0001); // y scale
    try testing.expect(@abs(proj_matrix.data[10]) > 0.0001); // z scale
    try testing.expect(@abs(proj_matrix.data[14]) > 0.0001); // z translation
}

// Mesh Generation Tests
test "sphere mesh generation produces valid vertices" {
    var vertices: [1000]f32 = undefined;
    const segments: u32 = 4;
    const ball_radius: f32 = 1.0;
    
    const vertex_count = core.generateWireframeSphere(&vertices, segments, ball_radius);
    
    // Should generate some vertices
    try testing.expect(vertex_count > 0);
    
    // Check that vertices are within expected bounds
    const max_expected_coord = ball_radius + 0.1; // Small tolerance
    for (0..vertex_count * 3) |i| {
        try testing.expect(@abs(vertices[i]) <= max_expected_coord);
    }
}

test "cube mesh generation produces valid vertices" {
    var vertices: [100]f32 = undefined;
    const ball_radius: f32 = 0.5;
    
    const vertex_count = core.generateWireframeCube(&vertices, ball_radius);
    
    // Should generate some vertices
    try testing.expect(vertex_count > 0);
    
    // Check that vertices are within expected bounds
    const max_expected_coord = ball_radius + 0.1; // Small tolerance
    for (0..vertex_count * 3) |i| {
        try testing.expect(@abs(vertices[i]) <= max_expected_coord);
    }
}

// Physics Simulation Tests
test "physics simulation - gravity" {
    var position = core.Vec3{ .x = 0.0, .y = 5.0, .z = 0.0 };
    var velocity = core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const delta_time: f32 = 0.016; // ~60 FPS
    const no_input = core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const ball_radius: f32 = 0.5;
    
    const initial_y = position.y;
    _ = core.simulatePhysicsStep(&position, &velocity, delta_time, no_input, ball_radius);
    
    // Ball should fall due to gravity
    try testing.expect(position.y < initial_y);
    try testing.expect(velocity.y < 0.0); // Downward velocity
}

test "physics simulation - floor collision" {
    var position = core.Vec3{ .x = 0.0, .y = -8.0, .z = 0.0 }; // Below floor
    var velocity = core.Vec3{ .x = 0.0, .y = -10.0, .z = 0.0 }; // Moving down
    const delta_time: f32 = 0.016;
    const no_input = core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const ball_radius: f32 = 0.5;
    
    const collision_state = core.simulatePhysicsStep(&position, &velocity, delta_time, no_input, ball_radius);
    
    // Should detect floor collision
    try testing.expect((collision_state & 0x01) != 0);
    // Ball should bounce up
    try testing.expect(velocity.y > 0.0);
    // Ball should be above floor
    try testing.expect(position.y > -8.0);
}

test "physics simulation - wall collision" {
    var position = core.Vec3{ .x = 9.0, .y = 0.0, .z = 0.0 }; // Beyond wall
    var velocity = core.Vec3{ .x = 5.0, .y = 0.0, .z = 0.0 }; // Moving into wall
    const delta_time: f32 = 0.016;
    const no_input = core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const ball_radius: f32 = 0.5;
    
    const collision_state = core.simulatePhysicsStep(&position, &velocity, delta_time, no_input, ball_radius);
    
    // Should detect wall collision
    try testing.expect((collision_state & 0x02) != 0);
    // Ball should bounce back
    try testing.expect(velocity.x < 0.0);
    // Ball should be within bounds
    try testing.expect(@abs(position.x) <= 8.0);
}

test "physics simulation - z-axis wall collision" {
    var position = core.Vec3{ .x = 0.0, .y = 0.0, .z = 9.0 }; // Beyond Z wall
    var velocity = core.Vec3{ .x = 0.0, .y = 0.0, .z = 5.0 }; // Moving into Z wall
    const delta_time: f32 = 0.016;
    const no_input = core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const ball_radius: f32 = 0.5;
    
    const collision_state = core.simulatePhysicsStep(&position, &velocity, delta_time, no_input, ball_radius);
    
    // Should detect wall collision
    try testing.expect((collision_state & 0x02) != 0);
    // Ball should bounce back
    try testing.expect(velocity.z < 0.0);
    // Ball should be within Z bounds
    try testing.expect(@abs(position.z) <= 8.0);
}

test "physics simulation - input forces" {
    var position = core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    var velocity = core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const delta_time: f32 = 0.016;
    const forward_input = core.Vec3{ .x = 0.0, .y = 0.0, .z = -8.0 }; // W key force
    const ball_radius: f32 = 0.5;
    
    _ = core.simulatePhysicsStep(&position, &velocity, delta_time, forward_input, ball_radius);
    
    // Ball should move forward (negative Z)
    try testing.expect(velocity.z < 0.0);
    try testing.expect(position.z < 0.0);
}

test "physics simulation - damping effect" {
    var position = core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    var velocity = core.Vec3{ .x = 10.0, .y = 0.0, .z = 10.0 };
    const delta_time: f32 = 0.016;
    const no_input = core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const ball_radius: f32 = 0.5;
    
    const initial_x_vel = velocity.x;
    const initial_z_vel = velocity.z;
    
    _ = core.simulatePhysicsStep(&position, &velocity, delta_time, no_input, ball_radius);
    
    // Horizontal velocities should be dampened
    try testing.expect(@abs(velocity.x) < @abs(initial_x_vel));
    try testing.expect(@abs(velocity.z) < @abs(initial_z_vel));
}

// Constants Tests
test "physics constants are reasonable" {
    // Test that our physics constants make sense
    try testing.expect(core.GRAVITY < 0.0); // Gravity should be negative (downward)
    try testing.expect(core.DAMPING > 0.0 and core.DAMPING < 1.0); // Damping should be 0-1
    try testing.expect(core.RESTITUTION > 0.0 and core.RESTITUTION <= 1.0); // Restitution should be 0-1
    try testing.expect(core.BOUNDS.x > 0.0 and core.BOUNDS.y > 0.0 and core.BOUNDS.z > 0.0); // Bounds should be positive
}