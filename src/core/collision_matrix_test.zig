const std = @import("std");
const testing = std.testing;
pub const std_options = std.Options{
    .log_level = .debug,
};

const game_core = @import("game_core.zig");

// Test data structure for collision scenarios
const CollisionTestCase = struct {
    name: []const u8,

    // Box 1 (object1)
    pos1: game_core.Vec3,
    extents1: game_core.Vec3,

    // Box 2 (object2)
    pos2: game_core.Vec3,
    extents2: game_core.Vec3,

    // Expected results
    should_collide: bool,
    expected_normal: ?game_core.Vec3, // null if no collision expected
    expected_penetration: ?f32, // null if no collision expected
    expected_contact_point: ?game_core.Vec3, // null if no collision expected

    // Test metadata
    collision_axis: ?u8, // 0=X, 1=Y, 2=Z, null if no collision
    description: []const u8,
};

// Test matrix: Comprehensive box-box collision scenarios
const BOX_COLLISION_TEST_CASES = [_]CollisionTestCase{
    // =================================================================
    // X-AXIS COLLISIONS (Box1 moving toward Box2 along X-axis)
    // =================================================================
    .{
        .name = "X_AXIS_LEFT_TO_RIGHT",
        .description = "Box1 at origin, Box2 to the right, overlapping",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Box1: center at origin
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 }, // 2x2x2 box (half-extents)
        .pos2 = .{ .x = 1.5, .y = 0.0, .z = 0.0 }, // Box2: 1.5 units to the right
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 }, // 2x2x2 box (half-extents)
        .should_collide = true,
        .expected_normal = .{ .x = -1.0, .y = 0.0, .z = 0.0 }, // Move Box1 leftward (away from Box2)
        .expected_penetration = 0.5, // (1.0 + 1.0) - 1.5 = 0.5
        .expected_contact_point = .{ .x = 1.0, .y = 0.0, .z = 0.0 }, // Contact at Box1's right edge
        .collision_axis = 0, // X-axis
    },

    .{
        .name = "X_AXIS_RIGHT_TO_LEFT",
        .description = "Box1 to the right, Box2 at origin, overlapping",
        .pos1 = .{ .x = 1.5, .y = 0.0, .z = 0.0 }, // Box1: 1.5 units to the right
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Box2: center at origin
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 1.0, .y = 0.0, .z = 0.0 }, // Move Box1 rightward (away from Box2)
        .expected_penetration = 0.5, // Same penetration, but normal flipped
        .expected_contact_point = .{ .x = 0.5, .y = 0.0, .z = 0.0 }, // Contact at Box2's right edge
        .collision_axis = 0, // X-axis
    },

    // =================================================================
    // Y-AXIS COLLISIONS (Vertical collisions - stacking scenarios)
    // =================================================================
    .{
        .name = "Y_AXIS_BOTTOM_TO_TOP",
        .description = "Box1 at origin, Box2 above, overlapping (stacking case)",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Box1: center at origin
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 0.0, .y = 1.5, .z = 0.0 }, // Box2: 1.5 units above
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = -1.0, .z = 0.0 }, // Move Box1 downward (away from Box2)
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.0, .y = 1.0, .z = 0.0 }, // Contact at Box1's top edge
        .collision_axis = 1, // Y-axis
    },

    .{
        .name = "Y_AXIS_TOP_TO_BOTTOM",
        .description = "Box1 above, Box2 at origin, overlapping (falling case)",
        .pos1 = .{ .x = 0.0, .y = 1.5, .z = 0.0 }, // Box1: 1.5 units above
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Box2: center at origin
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = 1.0, .z = 0.0 }, // Move Box1 upward (away from Box2)
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.0, .y = 0.5, .z = 0.0 }, // Contact at Box1's bottom edge
        .collision_axis = 1, // Y-axis
    },

    // =================================================================
    // Z-AXIS COLLISIONS (Depth collisions - camera perspective)
    // =================================================================
    .{
        .name = "Z_AXIS_NEAR_TO_FAR",
        .description = "Box1 at origin, Box2 further from camera, overlapping",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Box1: center at origin (closer to camera)
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 1.5 }, // Box2: 1.5 units away from camera
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = 0.0, .z = -1.0 }, // Move Box1 toward camera (away from Box2)
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.0, .y = 0.0, .z = 1.0 }, // Contact at Box1's far edge
        .collision_axis = 2, // Z-axis
    },

    .{
        .name = "Z_AXIS_FAR_TO_NEAR",
        .description = "Box1 further from camera, Box2 at origin, overlapping",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 1.5 }, // Box1: 1.5 units away from camera
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Box2: center at origin (closer to camera)
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = 0.0, .z = 1.0 }, // Move Box1 away from camera (away from Box2)
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.0, .y = 0.0, .z = 0.5 }, // Contact at Box1's near edge
        .collision_axis = 2, // Z-axis
    },

    // =================================================================
    // NEGATIVE AXIS TESTS (Testing negative coordinate space)
    // =================================================================
    .{
        .name = "X_AXIS_NEGATIVE_COLLISION",
        .description = "Both boxes in negative X space, overlapping",
        .pos1 = .{ .x = -2.0, .y = 0.0, .z = 0.0 }, // Box1: in negative X
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = -1.2, .y = 0.0, .z = 0.0 }, // Box2: overlapping from right
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = -1.0, .y = 0.0, .z = 0.0 }, // Move Box1 further left
        .expected_penetration = 1.2, // (1.0 + 1.0) - 0.8 = 1.2
        .expected_contact_point = .{ .x = -1.0, .y = 0.0, .z = 0.0 }, // Contact at Box1's right edge
        .collision_axis = 0,
    },

    .{
        .name = "Y_AXIS_NEGATIVE_COLLISION",
        .description = "Both boxes in negative Y space, overlapping",
        .pos1 = .{ .x = 0.0, .y = -2.0, .z = 0.0 }, // Box1: below origin
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 0.0, .y = -1.2, .z = 0.0 }, // Box2: overlapping from above
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = -1.0, .z = 0.0 }, // Move Box1 further down
        .expected_penetration = 1.2,
        .expected_contact_point = .{ .x = 0.0, .y = -1.0, .z = 0.0 }, // Contact at Box1's top edge
        .collision_axis = 1,
    },

    .{
        .name = "Z_AXIS_NEGATIVE_COLLISION",
        .description = "Both boxes in negative Z space, overlapping",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = -2.0 }, // Box1: in negative Z (closer to camera)
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = -1.2 }, // Box2: overlapping from behind
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = 0.0, .z = -1.0 }, // Move Box1 closer to camera
        .expected_penetration = 1.2,
        .expected_contact_point = .{ .x = 0.0, .y = 0.0, .z = -1.0 }, // Contact at Box1's far edge
        .collision_axis = 2,
    },

    // =================================================================
    // NO COLLISION CASES (Edge cases and separation validation)
    // =================================================================
    .{
        .name = "NO_COLLISION_X_SEPARATED",
        .description = "Boxes separated along X-axis, should not collide",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 3.0, .y = 0.0, .z = 0.0 }, // 3.0 units apart, no overlap
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = false,
        .expected_normal = null,
        .expected_penetration = null,
        .expected_contact_point = null,
        .collision_axis = null,
    },

    .{
        .name = "NO_COLLISION_Y_SEPARATED",
        .description = "Boxes separated along Y-axis, should not collide",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 0.0, .y = 3.0, .z = 0.0 }, // 3.0 units apart vertically
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = false,
        .expected_normal = null,
        .expected_penetration = null,
        .expected_contact_point = null,
        .collision_axis = null,
    },

    .{
        .name = "NO_COLLISION_Z_SEPARATED",
        .description = "Boxes separated along Z-axis, should not collide",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 3.0 }, // 3.0 units apart in depth
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = false,
        .expected_normal = null,
        .expected_penetration = null,
        .expected_contact_point = null,
        .collision_axis = null,
    },

    // =================================================================
    // EDGE CASES (Touching, identical positions, different sizes)
    // =================================================================
    .{
        .name = "EDGE_TOUCHING_X",
        .description = "Boxes exactly touching along X-axis (no penetration)",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 2.0, .y = 0.0, .z = 0.0 }, // Exactly 2.0 units apart (touching)
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true, // Touching is a collision with zero penetration
        .expected_normal = .{ .x = -1.0, .y = 0.0, .z = 0.0 }, // Move Box1 leftward
        .expected_penetration = 0.0, // Zero penetration for touching
        .expected_contact_point = .{ .x = 1.0, .y = 0.0, .z = 0.0 }, // Contact at Box1's right edge
        .collision_axis = 0, // X-axis
    },

    .{
        .name = "IDENTICAL_POSITIONS",
        .description = "Boxes at identical positions (complete overlap)",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .extents1 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Same position
        .extents2 = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        // With identical positions, any axis could be chosen - implementation selects X-axis
        .expected_normal = .{ .x = -1.0, .y = 0.0, .z = 0.0 }, // X-axis selected by implementation
        .expected_penetration = 2.0, // Complete overlap
        .expected_contact_point = .{ .x = -1.0, .y = 0.0, .z = 0.0 }, // Contact at Box1's left edge
        .collision_axis = 0, // X-axis selected by implementation
    },
};

// Helper function to compare Vec3 with tolerance
fn vec3_approx_equal(a: game_core.Vec3, b: game_core.Vec3, tolerance: f32) bool {
    const dx = @abs(a.x - b.x);
    const dy = @abs(a.y - b.y);
    const dz = @abs(a.z - b.z);
    return dx <= tolerance and dy <= tolerance and dz <= tolerance;
}

// Helper function to compare f32 with tolerance
fn f32_approx_equal(a: f32, b: f32, tolerance: f32) bool {
    return @abs(a - b) <= tolerance;
}

// Main test function that runs the entire collision matrix
test "comprehensive box-box collision matrix" {
    std.log.info("\n🧪 Running comprehensive box-box collision detection tests...\n", .{});

    var passed_tests: u32 = 0;
    var failed_tests: u32 = 0;
    const tolerance: f32 = 0.001; // Floating-point comparison tolerance

    for (BOX_COLLISION_TEST_CASES, 0..) |test_case, i| {
        std.log.info("Test {d}: {s}", .{ i + 1, test_case.name });
        std.log.info("  📝 {s}", .{test_case.description});

        // Call the collision detection function
        const collision_info = game_core.checkBoxCollision(test_case.pos1, test_case.extents1, test_case.pos2, test_case.extents2);

        const collision_detected = collision_info != null;

        // Test collision detection (should_collide)
        if (collision_detected != test_case.should_collide) {
            std.log.err("  ❌ COLLISION DETECTION MISMATCH:", .{});
            std.log.err("     Expected collision: {any}", .{test_case.should_collide});
            std.log.err("     Actual collision: {any}", .{collision_detected});
            failed_tests += 1;
            continue;
        }

        // If no collision is expected, skip further validation
        if (!test_case.should_collide) {
            std.log.info("  ✅ No collision detected as expected", .{});
            passed_tests += 1;
            continue;
        }

        // Extract values from collision info
        const info = collision_info.?;
        const penetration = info.penetration_depth;
        const collision_normal = info.contact_normal;
        const contact_point = info.contact_point;

        // Validate penetration depth
        if (test_case.expected_penetration) |expected_pen| {
            if (!f32_approx_equal(penetration, expected_pen, tolerance)) {
                std.log.err("  ❌ PENETRATION MISMATCH:", .{});
                std.log.err("     Expected: {d}", .{expected_pen});
                std.log.err("     Actual: {d}", .{penetration});
                failed_tests += 1;
                continue;
            }
        }

        // Validate collision normal
        if (test_case.expected_normal) |expected_normal| {
            if (!vec3_approx_equal(collision_normal, expected_normal, tolerance)) {
                std.log.err("  ❌ NORMAL MISMATCH:", .{});
                std.log.err("     Expected: ({d:.3}, {d:.3}, {d:.3})", .{ expected_normal.x, expected_normal.y, expected_normal.z });
                std.log.err("     Actual: ({d:.3}, {d:.3}, {d:.3})", .{ collision_normal.x, collision_normal.y, collision_normal.z });
                failed_tests += 1;
                continue;
            }
        }

        // Validate contact point
        if (test_case.expected_contact_point) |expected_contact| {
            if (!vec3_approx_equal(contact_point, expected_contact, tolerance)) {
                std.log.err("  ❌ CONTACT POINT MISMATCH:", .{});
                std.log.err("     Expected: ({d:.3}, {d:.3}, {d:.3})", .{ expected_contact.x, expected_contact.y, expected_contact.z });
                std.log.err("     Actual: ({d:.3}, {d:.3}, {d:.3})", .{ contact_point.x, contact_point.y, contact_point.z });
                failed_tests += 1;
                continue;
            }
        }

        std.log.info("  ✅ All validations passed", .{});
        std.log.info("     Penetration: {d:.3}", .{penetration});
        std.log.info("     Normal: ({d:.3}, {d:.3}, {d:.3})", .{ collision_normal.x, collision_normal.y, collision_normal.z });
        std.log.info("     Contact: ({d:.3}, {d:.3}, {d:.3})", .{ contact_point.x, contact_point.y, contact_point.z });

        passed_tests += 1;
    }

    // Final summary
    std.log.info("\n📊 COLLISION MATRIX TEST SUMMARY:", .{});
    std.log.info("   ✅ Passed: {d}/{d}", .{ passed_tests, BOX_COLLISION_TEST_CASES.len });
    std.log.info("   ❌ Failed: {d}/{d}", .{ failed_tests, BOX_COLLISION_TEST_CASES.len });

    if (failed_tests > 0) {
        std.log.err("\n🚨 {d} collision detection tests FAILED!", .{failed_tests});
        return error.CollisionTestsFailed;
    } else {
        std.log.info("\n🎉 All collision detection tests PASSED!", .{});
    }
}

// Individual test cases for easier debugging
test "box collision X-axis left to right" {
    const test_case = BOX_COLLISION_TEST_CASES[0]; // X_AXIS_LEFT_TO_RIGHT

    const collision_info = game_core.checkBoxCollision(test_case.pos1, test_case.extents1, test_case.pos2, test_case.extents2);

    try testing.expect(collision_info != null); // Should collide
    const info = collision_info.?;
    try testing.expect(f32_approx_equal(info.penetration_depth, 0.5, 0.001));
    try testing.expect(vec3_approx_equal(info.contact_normal, .{ .x = -1.0, .y = 0.0, .z = 0.0 }, 0.001));
}

test "box collision Y-axis stacking" {
    const test_case = BOX_COLLISION_TEST_CASES[2]; // Y_AXIS_BOTTOM_TO_TOP

    const collision_info = game_core.checkBoxCollision(test_case.pos1, test_case.extents1, test_case.pos2, test_case.extents2);

    try testing.expect(collision_info != null); // Should collide
    const info = collision_info.?;
    try testing.expect(f32_approx_equal(info.penetration_depth, 0.5, 0.001));
    try testing.expect(vec3_approx_equal(info.contact_normal, .{ .x = 0.0, .y = -1.0, .z = 0.0 }, 0.001));
}

test "box collision Z-axis depth" {
    const test_case = BOX_COLLISION_TEST_CASES[4]; // Z_AXIS_NEAR_TO_FAR

    const collision_info = game_core.checkBoxCollision(test_case.pos1, test_case.extents1, test_case.pos2, test_case.extents2);

    try testing.expect(collision_info != null); // Should collide
    const info = collision_info.?;
    try testing.expect(f32_approx_equal(info.penetration_depth, 0.5, 0.001));
    try testing.expect(vec3_approx_equal(info.contact_normal, .{ .x = 0.0, .y = 0.0, .z = -1.0 }, 0.001));
}

// =============================================================================
// SPHERE COLLISION TEST MATRIX
// =============================================================================

// Sphere collision test data structure
const SphereCollisionTestCase = struct {
    name: []const u8,

    // Sphere 1
    pos1: game_core.Vec3,
    radius1: f32,

    // Sphere 2
    pos2: game_core.Vec3,
    radius2: f32,

    // Expected results
    should_collide: bool,
    expected_penetration: ?f32, // null if no collision expected
    description: []const u8,
};

// Sphere-sphere collision test matrix
const SPHERE_COLLISION_TEST_CASES = [_]SphereCollisionTestCase{
    // =================================================================
    // X-AXIS SPHERE COLLISIONS
    // =================================================================
    .{
        .name = "SPHERE_X_AXIS_LEFT_TO_RIGHT",
        .description = "Sphere1 at origin, Sphere2 to the right, overlapping",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Sphere1: center at origin
        .radius1 = 1.0, // radius = 1.0
        .pos2 = .{ .x = 1.5, .y = 0.0, .z = 0.0 }, // Sphere2: 1.5 units to the right
        .radius2 = 1.0, // radius = 1.0
        .should_collide = true,
        .expected_penetration = 0.5, // (1.0 + 1.0) - 1.5 = 0.5
    },

    .{
        .name = "SPHERE_X_AXIS_RIGHT_TO_LEFT",
        .description = "Sphere1 to the right, Sphere2 at origin, overlapping",
        .pos1 = .{ .x = 1.5, .y = 0.0, .z = 0.0 }, // Sphere1: 1.5 units to the right
        .radius1 = 1.0,
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Sphere2: center at origin
        .radius2 = 1.0,
        .should_collide = true,
        .expected_penetration = 0.5, // Same penetration
    },

    // =================================================================
    // Y-AXIS SPHERE COLLISIONS (Vertical)
    // =================================================================
    .{
        .name = "SPHERE_Y_AXIS_BOTTOM_TO_TOP",
        .description = "Sphere1 at origin, Sphere2 above, overlapping",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Sphere1: center at origin
        .radius1 = 1.0,
        .pos2 = .{ .x = 0.0, .y = 1.5, .z = 0.0 }, // Sphere2: 1.5 units above
        .radius2 = 1.0,
        .should_collide = true,
        .expected_penetration = 0.5,
    },

    .{
        .name = "SPHERE_Y_AXIS_TOP_TO_BOTTOM",
        .description = "Sphere1 above, Sphere2 at origin, overlapping",
        .pos1 = .{ .x = 0.0, .y = 1.5, .z = 0.0 }, // Sphere1: 1.5 units above
        .radius1 = 1.0,
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Sphere2: center at origin
        .radius2 = 1.0,
        .should_collide = true,
        .expected_penetration = 0.5,
    },

    // =================================================================
    // Z-AXIS SPHERE COLLISIONS (Depth)
    // =================================================================
    .{
        .name = "SPHERE_Z_AXIS_NEAR_TO_FAR",
        .description = "Sphere1 at origin, Sphere2 further from camera, overlapping",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Sphere1: center at origin
        .radius1 = 1.0,
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 1.5 }, // Sphere2: 1.5 units away from camera
        .radius2 = 1.0,
        .should_collide = true,
        .expected_penetration = 0.5,
    },

    .{
        .name = "SPHERE_Z_AXIS_FAR_TO_NEAR",
        .description = "Sphere1 further from camera, Sphere2 at origin, overlapping",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 1.5 }, // Sphere1: 1.5 units away from camera
        .radius1 = 1.0,
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Sphere2: center at origin
        .radius2 = 1.0,
        .should_collide = true,
        .expected_penetration = 0.5,
    },

    // =================================================================
    // NO COLLISION CASES
    // =================================================================
    .{
        .name = "SPHERE_NO_COLLISION_SEPARATED",
        .description = "Spheres separated, should not collide",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .radius1 = 1.0,
        .pos2 = .{ .x = 3.0, .y = 0.0, .z = 0.0 }, // 3.0 units apart, no overlap
        .radius2 = 1.0,
        .should_collide = false,
        .expected_penetration = null,
    },

    .{
        .name = "SPHERE_EDGE_TOUCHING",
        .description = "Spheres exactly touching (no penetration)",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .radius1 = 1.0,
        .pos2 = .{ .x = 2.0, .y = 0.0, .z = 0.0 }, // Exactly 2.0 units apart (touching)
        .radius2 = 1.0,
        .should_collide = false, // Touching but not penetrating
        .expected_penetration = null,
    },

    // =================================================================
    // DIFFERENT SIZED SPHERES
    // =================================================================
    .{
        .name = "SPHERE_DIFFERENT_SIZES_COLLISION",
        .description = "Different sized spheres, overlapping",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .radius1 = 2.0, // Larger sphere
        .pos2 = .{ .x = 2.5, .y = 0.0, .z = 0.0 },
        .radius2 = 1.0, // Smaller sphere
        .should_collide = true,
        .expected_penetration = 0.5, // (2.0 + 1.0) - 2.5 = 0.5
    },

    .{
        .name = "SPHERE_IDENTICAL_POSITIONS",
        .description = "Spheres at identical positions (complete overlap)",
        .pos1 = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .radius1 = 1.0,
        .pos2 = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Same position
        .radius2 = 1.0,
        .should_collide = true,
        .expected_penetration = 2.0, // Complete overlap: radius1 + radius2
    },
};

// Sphere-sphere collision test
test "comprehensive sphere-sphere collision matrix" {
    std.log.info("\n🌕 Running comprehensive sphere-sphere collision detection tests...\n", .{});

    var passed_tests: u32 = 0;
    var failed_tests: u32 = 0;
    const tolerance: f32 = 0.001;

    for (SPHERE_COLLISION_TEST_CASES, 0..) |test_case, i| {
        std.log.info("Sphere Test {d}: {s}", .{ i + 1, test_case.name });
        std.log.info("  📝 {s}", .{test_case.description});

        // Call sphere collision detection function
        const penetration_opt = game_core.checkSphereCollision(test_case.pos1, test_case.radius1, test_case.pos2, test_case.radius2);

        const collision_detected = penetration_opt != null;

        // Test collision detection (should_collide)
        if (collision_detected != test_case.should_collide) {
            std.log.err("  ❌ SPHERE COLLISION DETECTION MISMATCH:", .{});
            std.log.err("     Expected collision: {any}", .{test_case.should_collide});
            std.log.err("     Actual collision: {any}", .{collision_detected});
            failed_tests += 1;
            continue;
        }

        // If no collision is expected, skip further validation
        if (!test_case.should_collide) {
            std.log.info("  ✅ No sphere collision detected as expected", .{});
            passed_tests += 1;
            continue;
        }

        // Validate penetration depth
        const penetration = penetration_opt.?;
        if (test_case.expected_penetration) |expected_pen| {
            if (!f32_approx_equal(penetration, expected_pen, tolerance)) {
                std.log.err("  ❌ SPHERE PENETRATION MISMATCH:", .{});
                std.log.err("     Expected: {d}", .{expected_pen});
                std.log.err("     Actual: {d}", .{penetration});
                failed_tests += 1;
                continue;
            }
        }

        std.log.info("  ✅ Sphere collision validations passed", .{});
        std.log.info("     Penetration: {d:.3}", .{penetration});

        passed_tests += 1;
    }

    // Final summary
    std.log.info("\n📊 SPHERE COLLISION TEST SUMMARY:", .{});
    std.log.info("   ✅ Passed: {d}/{d}", .{ passed_tests, SPHERE_COLLISION_TEST_CASES.len });
    std.log.info("   ❌ Failed: {d}/{d}", .{ failed_tests, SPHERE_COLLISION_TEST_CASES.len });

    if (failed_tests > 0) {
        std.log.err("\n🚨 {d} sphere collision tests FAILED!", .{failed_tests});
        return error.SphereCollisionTestsFailed;
    } else {
        std.log.info("\n🎉 All sphere collision tests PASSED!", .{});
    }
}

// =============================================================================
// SPHERE-BOX COLLISION TEST MATRIX
// =============================================================================

// Sphere-box collision test data structure
const SphereBoxCollisionTestCase = struct {
    name: []const u8,

    // Sphere
    sphere_pos: game_core.Vec3,
    sphere_radius: f32,

    // Box
    box_pos: game_core.Vec3,
    box_extents: game_core.Vec3,

    // Expected results
    should_collide: bool,
    expected_normal: ?game_core.Vec3, // null if no collision expected
    expected_penetration: ?f32, // null if no collision expected
    expected_contact_point: ?game_core.Vec3, // null if no collision expected

    description: []const u8,
};

// Sphere-box collision test matrix
const SPHERE_BOX_COLLISION_TEST_CASES = [_]SphereBoxCollisionTestCase{
    // =================================================================
    // SPHERE-BOX X-AXIS COLLISIONS
    // =================================================================
    .{
        .name = "SPHERE_BOX_X_AXIS_LEFT_TO_RIGHT",
        .description = "Sphere at origin, Box to the right, overlapping",
        .sphere_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .sphere_radius = 1.0,
        .box_pos = .{ .x = 1.5, .y = 0.0, .z = 0.0 }, // Box 1.5 units to the right
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 }, // 2x2x2 box
        .should_collide = true,
        .expected_normal = .{ .x = -1.0, .y = 0.0, .z = 0.0 }, // Sphere should move left
        .expected_penetration = 0.5, // (1.0 + 1.0) - 1.5 = 0.5
        .expected_contact_point = .{ .x = 1.0, .y = 0.0, .z = 0.0 }, // Contact at sphere's right edge
    },

    .{
        .name = "SPHERE_BOX_X_AXIS_RIGHT_TO_LEFT",
        .description = "Sphere to the right, Box at origin, overlapping",
        .sphere_pos = .{ .x = 1.5, .y = 0.0, .z = 0.0 },
        .sphere_radius = 1.0,
        .box_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Box at origin
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 1.0, .y = 0.0, .z = 0.0 }, // Sphere should move right
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.5, .y = 0.0, .z = 0.0 }, // Contact at sphere's left edge
    },

    // =================================================================
    // SPHERE-BOX Y-AXIS COLLISIONS (Vertical)
    // =================================================================
    .{
        .name = "SPHERE_BOX_Y_AXIS_BOTTOM_TO_TOP",
        .description = "Sphere at origin, Box above, overlapping",
        .sphere_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .sphere_radius = 1.0,
        .box_pos = .{ .x = 0.0, .y = 1.5, .z = 0.0 }, // Box 1.5 units above
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = -1.0, .z = 0.0 }, // Sphere should move down
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.0, .y = 1.0, .z = 0.0 }, // Contact at sphere's top edge
    },

    .{
        .name = "SPHERE_BOX_Y_AXIS_TOP_TO_BOTTOM",
        .description = "Sphere above, Box at origin, overlapping",
        .sphere_pos = .{ .x = 0.0, .y = 1.5, .z = 0.0 },
        .sphere_radius = 1.0,
        .box_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Box at origin
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = 1.0, .z = 0.0 }, // Sphere should move up
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.0, .y = 0.5, .z = 0.0 }, // Contact at sphere's bottom edge
    },

    // =================================================================
    // SPHERE-BOX Z-AXIS COLLISIONS (Depth)
    // =================================================================
    .{
        .name = "SPHERE_BOX_Z_AXIS_NEAR_TO_FAR",
        .description = "Sphere at origin, Box further from camera, overlapping",
        .sphere_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .sphere_radius = 1.0,
        .box_pos = .{ .x = 0.0, .y = 0.0, .z = 1.5 }, // Box 1.5 units away from camera
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = 0.0, .z = -1.0 }, // Sphere should move toward camera
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.0, .y = 0.0, .z = 1.0 }, // Contact at sphere's far edge
    },

    .{
        .name = "SPHERE_BOX_Z_AXIS_FAR_TO_NEAR",
        .description = "Sphere further from camera, Box at origin, overlapping",
        .sphere_pos = .{ .x = 0.0, .y = 0.0, .z = 1.5 },
        .sphere_radius = 1.0,
        .box_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Box at origin
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = 0.0, .z = 1.0 }, // Sphere should move away from camera
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.0, .y = 0.0, .z = 0.5 }, // Contact at sphere's near edge
    },

    // =================================================================
    // NO COLLISION CASES
    // =================================================================
    .{
        .name = "SPHERE_BOX_NO_COLLISION_SEPARATED",
        .description = "Sphere and box separated, should not collide",
        .sphere_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .sphere_radius = 1.0,
        .box_pos = .{ .x = 3.0, .y = 0.0, .z = 0.0 }, // Box 3.0 units away
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .should_collide = false,
        .expected_normal = null,
        .expected_penetration = null,
        .expected_contact_point = null,
    },

    // =================================================================
    // SPHERE INSIDE BOX
    // =================================================================
    .{
        .name = "SPHERE_INSIDE_BOX",
        .description = "Sphere completely inside box",
        .sphere_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Sphere at box center
        .sphere_radius = 0.5, // Small sphere
        .box_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Box at same position
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 }, // Large box
        .should_collide = true,
        // When sphere is inside box, normal should point toward nearest box face
        .expected_normal = .{ .x = -1.0, .y = 0.0, .z = 0.0 }, // Could be any face, depends on implementation
        .expected_penetration = 1.5, // Distance from sphere center to nearest box face + sphere radius
        .expected_contact_point = .{ .x = 0.5, .y = 0.0, .z = 0.0 }, // Contact at sphere's right edge (closest to box face)
    },
};

// Sphere-box collision test
test "comprehensive sphere-box collision matrix" {
    std.log.info("\n🌕📦 Running comprehensive sphere-box collision detection tests...\n", .{});

    var passed_tests: u32 = 0;
    var failed_tests: u32 = 0;
    const tolerance: f32 = 0.001;

    for (SPHERE_BOX_COLLISION_TEST_CASES, 0..) |test_case, i| {
        std.log.info("Sphere-Box Test {d}: {s}", .{ i + 1, test_case.name });
        std.log.info("  📝 {s}", .{test_case.description});

        // Call sphere-box collision detection function
        const collision_info = game_core.checkSphereBoxCollision(test_case.sphere_pos, test_case.sphere_radius, test_case.box_pos, test_case.box_extents);

        const collision_detected = collision_info != null;

        // Test collision detection (should_collide)
        if (collision_detected != test_case.should_collide) {
            std.log.err("  ❌ SPHERE-BOX COLLISION DETECTION MISMATCH:", .{});
            std.log.err("     Expected collision: {any}", .{test_case.should_collide});
            std.log.err("     Actual collision: {any}", .{collision_detected});
            failed_tests += 1;
            continue;
        }

        // If no collision is expected, skip further validation
        if (!test_case.should_collide) {
            std.log.info("  ✅ No sphere-box collision detected as expected", .{});
            passed_tests += 1;
            continue;
        }

        // Extract values from collision info
        const info = collision_info.?;
        const penetration = info.penetration_depth;
        const collision_normal = info.contact_normal;
        const contact_point = info.contact_point;

        // Validate penetration depth
        if (test_case.expected_penetration) |expected_pen| {
            if (!f32_approx_equal(penetration, expected_pen, tolerance)) {
                std.log.err("  ❌ SPHERE-BOX PENETRATION MISMATCH:", .{});
                std.log.err("     Expected: {d}", .{expected_pen});
                std.log.err("     Actual: {d}", .{penetration});
                failed_tests += 1;
                continue;
            }
        }

        // Validate collision normal
        if (test_case.expected_normal) |expected_normal| {
            if (!vec3_approx_equal(collision_normal, expected_normal, tolerance)) {
                std.log.err("  ❌ SPHERE-BOX NORMAL MISMATCH:", .{});
                std.log.err("     Expected: ({d:.3}, {d:.3}, {d:.3})", .{ expected_normal.x, expected_normal.y, expected_normal.z });
                std.log.err("     Actual: ({d:.3}, {d:.3}, {d:.3})", .{ collision_normal.x, collision_normal.y, collision_normal.z });
                failed_tests += 1;
                continue;
            }
        }

        // Validate contact point
        if (test_case.expected_contact_point) |expected_contact| {
            if (!vec3_approx_equal(contact_point, expected_contact, tolerance)) {
                std.log.err("  ❌ SPHERE-BOX CONTACT POINT MISMATCH:", .{});
                std.log.err("     Expected: ({d:.3}, {d:.3}, {d:.3})", .{ expected_contact.x, expected_contact.y, expected_contact.z });
                std.log.err("     Actual: ({d:.3}, {d:.3}, {d:.3})", .{ contact_point.x, contact_point.y, contact_point.z });
                failed_tests += 1;
                continue;
            }
        }

        std.log.info("  ✅ Sphere-box collision validations passed", .{});
        std.log.info("     Penetration: {d:.3}", .{penetration});
        std.log.info("     Normal: ({d:.3}, {d:.3}, {d:.3})", .{ collision_normal.x, collision_normal.y, collision_normal.z });
        std.log.info("     Contact: ({d:.3}, {d:.3}, {d:.3})", .{ contact_point.x, contact_point.y, contact_point.z });

        passed_tests += 1;
    }

    // Final summary
    std.log.info("\n📊 SPHERE-BOX COLLISION TEST SUMMARY:", .{});
    std.log.info("   ✅ Passed: {d}/{d}", .{ passed_tests, SPHERE_BOX_COLLISION_TEST_CASES.len });
    std.log.info("   ❌ Failed: {d}/{d}", .{ failed_tests, SPHERE_BOX_COLLISION_TEST_CASES.len });

    if (failed_tests > 0) {
        std.log.err("\n🚨 {d} sphere-box collision tests FAILED!", .{failed_tests});
        return error.SphereBoxCollisionTestsFailed;
    } else {
        std.log.info("\n🎉 All sphere-box collision tests PASSED!", .{});
    }
}

// =============================================================================
// BOX-SPHERE COLLISION TEST MATRIX (BOX as object1, SPHERE as object2)
// =============================================================================

// Box-sphere collision test data structure (BOX is object1, SPHERE is object2)
const BoxSphereCollisionTestCase = struct {
    name: []const u8,

    // Box (object1)
    box_pos: game_core.Vec3,
    box_extents: game_core.Vec3,

    // Sphere (object2)
    sphere_pos: game_core.Vec3,
    sphere_radius: f32,

    // Expected results
    should_collide: bool,
    expected_normal: ?game_core.Vec3, // null if no collision expected - should point in direction for BOX to move away from SPHERE
    expected_penetration: ?f32, // null if no collision expected
    expected_contact_point: ?game_core.Vec3, // null if no collision expected

    description: []const u8,
};

// Box-sphere collision test matrix (tests the BOX vs SPHERE code path in checkCollision dispatcher)
const BOX_SPHERE_COLLISION_TEST_CASES = [_]BoxSphereCollisionTestCase{
    // =================================================================
    // BOX-SPHERE X-AXIS COLLISIONS (BOX as object1, SPHERE as object2)
    // =================================================================
    .{
        .name = "BOX_SPHERE_X_AXIS_LEFT_TO_RIGHT",
        .description = "Box at origin, Sphere to the right, overlapping - Box POV normal should point left",
        .box_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 }, // 2x2x2 box
        .sphere_pos = .{ .x = 1.5, .y = 0.0, .z = 0.0 }, // Sphere 1.5 units to the right
        .sphere_radius = 1.0,
        .should_collide = true,
        .expected_normal = .{ .x = -1.0, .y = 0.0, .z = 0.0 }, // Box should move left (away from sphere)
        .expected_penetration = 0.5, // (1.0 + 1.0) - 1.5 = 0.5
        .expected_contact_point = .{ .x = 0.5, .y = 0.0, .z = 0.0 }, // Contact at sphere's surface (current implementation)
    },

    .{
        .name = "BOX_SPHERE_X_AXIS_RIGHT_TO_LEFT",
        .description = "Box to the right, Sphere at origin, overlapping - Box POV normal should point right",
        .box_pos = .{ .x = 1.5, .y = 0.0, .z = 0.0 },
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .sphere_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Sphere at origin
        .sphere_radius = 1.0,
        .should_collide = true,
        .expected_normal = .{ .x = 1.0, .y = 0.0, .z = 0.0 }, // Box should move right (away from sphere)
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 1.0, .y = 0.0, .z = 0.0 }, // Contact at sphere's surface (current implementation)
    },

    // =================================================================
    // BOX-SPHERE Y-AXIS COLLISIONS (Vertical - matches our test scenario)
    // =================================================================
    .{
        .name = "BOX_SPHERE_Y_AXIS_BOTTOM_TO_TOP",
        .description = "Box at origin, Sphere above, overlapping - Box POV normal should point down",
        .box_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .sphere_pos = .{ .x = 0.0, .y = 1.5, .z = 0.0 }, // Sphere 1.5 units above
        .sphere_radius = 1.0,
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = -1.0, .z = 0.0 }, // Box should move down (away from sphere)
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.0, .y = 0.5, .z = 0.0 }, // Contact at sphere's surface (current implementation)
    },

    .{
        .name = "BOX_SPHERE_Y_AXIS_TOP_TO_BOTTOM",
        .description = "Box above, Sphere at origin, overlapping - Box POV normal should point up",
        .box_pos = .{ .x = 0.0, .y = 1.5, .z = 0.0 },
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .sphere_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Sphere at origin
        .sphere_radius = 1.0,
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = 1.0, .z = 0.0 }, // Box should move up (away from sphere)
        .expected_penetration = 0.5,
        .expected_contact_point = .{ .x = 0.0, .y = 1.0, .z = 0.0 }, // Contact at sphere's surface (current implementation)
    },

    // =================================================================
    // NO COLLISION CASES
    // =================================================================
    .{
        .name = "BOX_SPHERE_NO_COLLISION_SEPARATED",
        .description = "Box and sphere separated, should not collide",
        .box_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 },
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 },
        .sphere_pos = .{ .x = 3.0, .y = 0.0, .z = 0.0 }, // Sphere 3.0 units away
        .sphere_radius = 1.0,
        .should_collide = false,
        .expected_normal = null,
        .expected_penetration = null,
        .expected_contact_point = null,
    },

    // =================================================================
    // CRITICAL TEST: KINEMATIC BOX vs DYNAMIC SPHERE (our failing scenario)
    // =================================================================
    .{
        .name = "KINEMATIC_BOX_DYNAMIC_SPHERE_COLLISION",
        .description = "CRITICAL: Kinematic box at origin, dynamic sphere falling from above (matches integration test)",
        .box_pos = .{ .x = 0.0, .y = 0.0, .z = 0.0 }, // Platform at origin
        .box_extents = .{ .x = 1.0, .y = 1.0, .z = 1.0 }, // Box extents = 1.0
        .sphere_pos = .{ .x = 0.0, .y = 2.0, .z = 0.0 }, // Ball at Y=2.0 (touching box top + sphere radius)
        .sphere_radius = 1.0, // Ball radius = 1.0
        .should_collide = true,
        .expected_normal = .{ .x = 0.0, .y = -1.0, .z = 0.0 }, // Box should move down (away from sphere)
        .expected_penetration = 0.0, // Exactly touching
        .expected_contact_point = .{ .x = 0.0, .y = 1.0, .z = 0.0 }, // Contact at box's top face
    },
};

// Box-sphere collision test
test "comprehensive box-sphere collision matrix" {
    std.log.info("\n📦🌕 Running comprehensive box-sphere collision detection tests (BOX vs SPHERE)...\n", .{});

    var passed_tests: u32 = 0;
    var failed_tests: u32 = 0;
    const tolerance: f32 = 0.001;

    for (BOX_SPHERE_COLLISION_TEST_CASES, 0..) |test_case, i| {
        std.log.info("Box-Sphere Test {d}: {s}", .{ i + 1, test_case.name });
        std.log.info("  📝 {s}", .{test_case.description});

        // Call universal collision dispatcher with BOX as object1, SPHERE as object2
        const collision_info = game_core.checkCollision(test_case.box_pos, game_core.CollisionShape.BOX, test_case.box_extents, test_case.sphere_pos, game_core.CollisionShape.SPHERE, .{ .x = test_case.sphere_radius, .y = test_case.sphere_radius, .z = test_case.sphere_radius });

        const collision_detected = collision_info != null;

        // Test collision detection (should_collide)
        if (collision_detected != test_case.should_collide) {
            std.log.err("  ❌ BOX-SPHERE COLLISION DETECTION MISMATCH:", .{});
            std.log.err("     Expected collision: {any}", .{test_case.should_collide});
            std.log.err("     Actual collision: {any}", .{collision_detected});
            failed_tests += 1;
            continue;
        }

        // If no collision is expected, skip further validation
        if (!test_case.should_collide) {
            std.log.info("  ✅ No box-sphere collision detected as expected", .{});
            passed_tests += 1;
            continue;
        }

        // Extract values from collision info
        const info = collision_info.?;
        const penetration = info.penetration_depth;
        const collision_normal = info.contact_normal;
        const contact_point = info.contact_point;

        // Validate penetration depth
        if (test_case.expected_penetration) |expected_pen| {
            if (!f32_approx_equal(penetration, expected_pen, tolerance)) {
                std.log.err("  ❌ BOX-SPHERE PENETRATION MISMATCH:", .{});
                std.log.err("     Expected: {d}", .{expected_pen});
                std.log.err("     Actual: {d}", .{penetration});
                failed_tests += 1;
                continue;
            }
        }

        // Validate collision normal
        if (test_case.expected_normal) |expected_normal| {
            if (!vec3_approx_equal(collision_normal, expected_normal, tolerance)) {
                std.log.err("  ❌ BOX-SPHERE NORMAL MISMATCH:", .{});
                std.log.err("     Expected: ({d:.3}, {d:.3}, {d:.3})", .{ expected_normal.x, expected_normal.y, expected_normal.z });
                std.log.err("     Actual: ({d:.3}, {d:.3}, {d:.3})", .{ collision_normal.x, collision_normal.y, collision_normal.z });
                failed_tests += 1;
                continue;
            }
        }

        // Validate contact point
        if (test_case.expected_contact_point) |expected_contact| {
            if (!vec3_approx_equal(contact_point, expected_contact, tolerance)) {
                std.log.err("  ❌ BOX-SPHERE CONTACT POINT MISMATCH:", .{});
                std.log.err("     Expected: ({d:.3}, {d:.3}, {d:.3})", .{ expected_contact.x, expected_contact.y, expected_contact.z });
                std.log.err("     Actual: ({d:.3}, {d:.3}, {d:.3})", .{ contact_point.x, contact_point.y, contact_point.z });
                failed_tests += 1;
                continue;
            }
        }

        std.log.info("  ✅ Box-sphere collision validations passed", .{});
        std.log.info("     Penetration: {d:.3}", .{penetration});
        std.log.info("     Normal: ({d:.3}, {d:.3}, {d:.3})", .{ collision_normal.x, collision_normal.y, collision_normal.z });
        std.log.info("     Contact: ({d:.3}, {d:.3}, {d:.3})", .{ contact_point.x, contact_point.y, contact_point.z });

        passed_tests += 1;
    }

    // Final summary
    std.log.info("\n📊 BOX-SPHERE COLLISION TEST SUMMARY:", .{});
    std.log.info("   ✅ Passed: {d}/{d}", .{ passed_tests, BOX_SPHERE_COLLISION_TEST_CASES.len });
    std.log.info("   ❌ Failed: {d}/{d}", .{ failed_tests, BOX_SPHERE_COLLISION_TEST_CASES.len });

    if (failed_tests > 0) {
        std.log.err("\n🚨 {d} box-sphere collision tests FAILED!", .{failed_tests});
        return error.BoxSphereCollisionTestsFailed;
    } else {
        std.log.info("\n🎉 All box-sphere collision tests PASSED!", .{});
    }
}

// =============================================================================
// INTEGRATION TEST REPLICATION - Simple unit test version of collision_test.zig
// =============================================================================

test "integration test replication: kinematic box vs dynamic sphere at collision point" {
    std.debug.print("\n🎯 Integration Test Replication: Exact collision_test.zig scenario as unit test\n", .{});

    // Replicate EXACT values from collision_test.zig integration test:
    // Platform (BOX): position=(0, 0, 0), extents=1.0, kinematic=true
    // Ball (SPHERE): position=(0, 2.0, 0), radius=1.0, kinematic=false
    // Should collide when ball_center_y - radius <= platform_top_y + extents
    // = 2.0 - 1.0 <= 0.0 + 1.0 = 1.0 <= 1.0 = TRUE (exactly touching)

    const box_pos = game_core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const box_extents = game_core.Vec3{ .x = 1.0, .y = 1.0, .z = 1.0 };
    const sphere_pos = game_core.Vec3{ .x = 0.0, .y = 2.0, .z = 0.0 }; // Exactly at collision point
    const sphere_radius: f32 = 1.0;

    std.debug.print("📍 Test setup:\n", .{});
    std.debug.print("   Box: pos=({d:.1}, {d:.1}, {d:.1}), extents=({d:.1}, {d:.1}, {d:.1})\n", .{ box_pos.x, box_pos.y, box_pos.z, box_extents.x, box_extents.y, box_extents.z });
    std.debug.print("   Sphere: pos=({d:.1}, {d:.1}, {d:.1}), radius={d:.1}\n", .{ sphere_pos.x, sphere_pos.y, sphere_pos.z, sphere_radius });
    std.debug.print("   Expected: Ball bottom ({d:.1}) should touch box top ({d:.1})\n", .{ sphere_pos.y - sphere_radius, box_pos.y + box_extents.y });

    // Test BOX vs SPHERE collision detection using universal dispatcher
    const collision_info = game_core.checkCollision(
        box_pos, game_core.CollisionShape.BOX, box_extents,
        sphere_pos, game_core.CollisionShape.SPHERE, .{ .x = sphere_radius, .y = sphere_radius, .z = sphere_radius }
    );

    if (collision_info) |info| {
        std.debug.print("✅ COLLISION DETECTED!\n", .{});
        std.debug.print("   Penetration: {d:.3}\n", .{info.penetration_depth});
        std.debug.print("   Normal: ({d:.3}, {d:.3}, {d:.3})\n", .{ info.contact_normal.x, info.contact_normal.y, info.contact_normal.z });
        std.debug.print("   Contact: ({d:.3}, {d:.3}, {d:.3})\n", .{ info.contact_point.x, info.contact_point.y, info.contact_point.z });

        // Verify this is a reasonable collision
        try testing.expect(info.has_collision);
        try testing.expect(info.penetration_depth >= 0.0);
        try testing.expect(info.penetration_depth <= 0.1); // Should be exactly touching or very small overlap

        // Normal should point in direction for box to move away from sphere
        // Since sphere is above box, box should move down (negative Y)
        try testing.expect(info.contact_normal.y < 0); // Box should move down

    } else {
        std.debug.print("❌ NO COLLISION DETECTED - This replicates the integration test failure!\n", .{});
        std.debug.print("   Ball bottom at Y={d:.1}, Box top at Y={d:.1}\n", .{ sphere_pos.y - sphere_radius, box_pos.y + box_extents.y });
        std.debug.print("   These should be touching/overlapping!\n", .{});
        return error.CollisionNotDetected;
    }
}

test "integration test replication: slightly overlapping case" {
    std.debug.print("\n🎯 Integration Test Replication: Slightly overlapping case\n", .{});

    // Move sphere slightly lower to ensure clear overlap
    const box_pos = game_core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const box_extents = game_core.Vec3{ .x = 1.0, .y = 1.0, .z = 1.0 };
    const sphere_pos = game_core.Vec3{ .x = 0.0, .y = 1.8, .z = 0.0 }; // 0.2 units overlap
    const sphere_radius: f32 = 1.0;

    std.debug.print("📍 Overlapping test setup:\n", .{});
    std.debug.print("   Ball bottom: {d:.1}, Box top: {d:.1}, Overlap: {d:.1}\n", .{
        sphere_pos.y - sphere_radius,
        box_pos.y + box_extents.y,
        (box_pos.y + box_extents.y) - (sphere_pos.y - sphere_radius)
    });

    const collision_info = game_core.checkCollision(
        box_pos, game_core.CollisionShape.BOX, box_extents,
        sphere_pos, game_core.CollisionShape.SPHERE, .{ .x = sphere_radius, .y = sphere_radius, .z = sphere_radius }
    );

    if (collision_info) |info| {
        std.debug.print("✅ OVERLAPPING COLLISION DETECTED!\n", .{});
        std.debug.print("   Penetration: {d:.3}\n", .{info.penetration_depth});
        std.debug.print("   Normal: ({d:.3}, {d:.3}, {d:.3})\n", .{ info.contact_normal.x, info.contact_normal.y, info.contact_normal.z });

        try testing.expect(info.has_collision);
        try testing.expect(info.penetration_depth > 0.1); // Should have clear overlap
        try testing.expect(info.contact_normal.y < 0); // Box should move down

    } else {
        std.debug.print("❌ NO COLLISION DETECTED even with clear overlap!\n", .{});
        return error.CollisionNotDetected;
    }
}

// =============================================================================
// WASM INTEGRATION DEBUG TEST - Check actual entity configuration
// =============================================================================

test "WASM integration debug: verify entity configuration" {
    std.debug.print("\n🔍 WASM Integration Debug: Verifying entity configuration\n", .{});

    const game_engine = @import("game_engine.zig");

    // Initialize WASM engine (same as integration test)
    game_engine.init();

    // Add entities exactly as integration test does
    std.debug.print("📦 Adding entities exactly as collision_test.zig does...\n", .{});
    game_engine.add_entity(0, 0, 0, 0, 1, 1, 1, 0.5, 0.5, 0.5, 1.0, 1, 0, 5.0, 1.0, true); // Platform
    game_engine.add_entity(1, 0, 3, 0, 1, 1, 1, 1.0, 0.2, 0.2, 1.0, 2, 0, 1.0, 1.0, false); // Ball

    // Debug: Check actual entity configuration
    std.debug.print("\n🔍 Entity 0 (Platform) configuration:\n", .{});
    const platform_pos_x = game_engine.get_entity_position_x(0);
    const platform_pos_y = game_engine.get_entity_position_y(0);
    const platform_pos_z = game_engine.get_entity_position_z(0);
    std.debug.print("   Position: ({d:.3}, {d:.3}, {d:.3})\n", .{ platform_pos_x, platform_pos_y, platform_pos_z });

    const platform_mesh_id = game_engine.debug_get_entity_mesh_id(0);
    const platform_collision_shape = game_engine.debug_get_entity_physics_info(0, 10); // collision_shape
    std.debug.print("   Mesh ID: {d} (should be 1 for BOX), Collision Shape: {d} (should be 1 for BOX)\n", .{ platform_mesh_id, @as(u32, @intFromFloat(platform_collision_shape)) });

    // Try to get physics info
    const platform_mass = game_engine.debug_get_entity_physics_info(0, 6); // mass
    const platform_radius = game_engine.debug_get_entity_physics_info(0, 7); // radius/extents
    const platform_kinematic = game_engine.debug_get_entity_physics_info(0, 8); // kinematic flag
    std.debug.print("   Mass: {d:.3}, Radius/Extents: {d:.3}, Kinematic: {d:.3}\n", .{ platform_mass, platform_radius, platform_kinematic });

    std.debug.print("\n🔍 Entity 1 (Ball) configuration:\n", .{});
    const ball_pos_x = game_engine.get_entity_position_x(1);
    const ball_pos_y = game_engine.get_entity_position_y(1);
    const ball_pos_z = game_engine.get_entity_position_z(1);
    std.debug.print("   Position: ({d:.3}, {d:.3}, {d:.3})\n", .{ ball_pos_x, ball_pos_y, ball_pos_z });

    const ball_mesh_id = game_engine.debug_get_entity_mesh_id(1);
    const ball_collision_shape = game_engine.debug_get_entity_physics_info(1, 10); // collision_shape
    std.debug.print("   Mesh ID: {d} (should be 2 for SPHERE), Collision Shape: {d} (should be 0 for SPHERE)\n", .{ ball_mesh_id, @as(u32, @intFromFloat(ball_collision_shape)) });

    const ball_mass = game_engine.debug_get_entity_physics_info(1, 6); // mass
    const ball_radius = game_engine.debug_get_entity_physics_info(1, 7); // radius
    const ball_kinematic = game_engine.debug_get_entity_physics_info(1, 8); // kinematic flag
    std.debug.print("   Mass: {d:.3}, Radius: {d:.3}, Kinematic: {d:.3}\n", .{ ball_mass, ball_radius, ball_kinematic });

    // Manually test collision detection at Y=2.0 (expected collision point)
    std.debug.print("\n🎯 Manual collision test at Y=2.0 (expected collision point):\n", .{});
    const test_ball_pos = game_core.Vec3{ .x = 0.0, .y = 2.0, .z = 0.0 };
    const platform_pos = game_core.Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    const platform_extents = game_core.Vec3{ .x = 1.0, .y = 1.0, .z = 1.0 };
    const expected_ball_radius: f32 = 1.0;

    const manual_collision = game_core.checkCollision(
        platform_pos, game_core.CollisionShape.BOX, platform_extents,
        test_ball_pos, game_core.CollisionShape.SPHERE, .{ .x = expected_ball_radius, .y = expected_ball_radius, .z = expected_ball_radius }
    );

    if (manual_collision) |info| {
        std.debug.print("✅ Manual collision test: COLLISION DETECTED\n", .{});
        std.debug.print("   Penetration: {d:.3}\n", .{info.penetration_depth});
        std.debug.print("   Normal: ({d:.3}, {d:.3}, {d:.3})\n", .{ info.contact_normal.x, info.contact_normal.y, info.contact_normal.z });
    } else {
        std.debug.print("❌ Manual collision test: NO COLLISION DETECTED\n", .{});
    }

    // Run a few physics frames and check collision state
    std.debug.print("\n🏃 Running a few physics frames to check collision detection in WASM loop:\n", .{});
    const delta_time: f32 = 1.0 / 60.0;

    for (1..30) |frame| {
        game_engine.update(delta_time);
        const current_ball_y = game_engine.get_entity_position_y(1);
        const collision_state = game_engine.get_collision_state();
        const collision_checks = game_engine.get_collision_checks_performed();
        const collisions_detected_count = game_engine.get_collisions_detected();

        if (frame % 5 == 0 or collision_state != 0) {
            std.debug.print("   Frame {d}: ball Y={d:.3}, collision_state=0x{x}, checks={d}, detected={d}\n", .{ frame, current_ball_y, collision_state, collision_checks, collisions_detected_count });
        }

        // Critical zone analysis
        if (current_ball_y <= 2.1 and current_ball_y >= 1.9) {
            std.debug.print("🎯 CRITICAL ZONE: Ball at Y={d:.3} (expected collision Y≤2.0)\n", .{current_ball_y});
            std.debug.print("   Platform kinematic: {d}, Ball kinematic: {d}\n", .{ platform_kinematic, ball_kinematic });
            std.debug.print("   Platform collision_shape: {d}, Ball collision_shape: {d}\n", .{ @as(u32, @intFromFloat(platform_collision_shape)), @as(u32, @intFromFloat(ball_collision_shape)) });

            // Manual check at current position
            const current_ball_pos = game_core.Vec3{ .x = 0.0, .y = current_ball_y, .z = 0.0 };
            const critical_collision = game_core.checkCollision(
                platform_pos, game_core.CollisionShape.BOX, platform_extents,
                current_ball_pos, game_core.CollisionShape.SPHERE, .{ .x = expected_ball_radius, .y = expected_ball_radius, .z = expected_ball_radius }
            );

            if (critical_collision) |info| {
                std.debug.print("   Manual checkCollision: ✅ COLLISION (penet={d:.3})\n", .{info.penetration_depth});
            } else {
                std.debug.print("   Manual checkCollision: ❌ NO COLLISION\n", .{});
            }
        }

        if (collision_state != 0) {
            std.debug.print("🎉 COLLISION DETECTED in WASM integration at frame {d}!\n", .{frame});
            break;
        }

        if (current_ball_y <= 1.5) {
            std.debug.print("⚠️  Ball reached Y={d:.3} without collision detection\n", .{current_ball_y});
            break;
        }
    }
}
