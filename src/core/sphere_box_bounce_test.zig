const std = @import("std");
const expect = std.testing.expect;
const expectApproxEqRel = std.testing.expectApproxEqRel;
const core = @import("game_core.zig");

const Vec3 = core.Vec3;
const CollisionShape = core.CollisionShape;
const CollisionInfo = core.CollisionInfo;

test "sphere bounces off stationary box with proper restitution" {
    // Test setup: sphere dropping onto kinematic (stationary) box
    var sphere_pos = Vec3{ .x = 0.0, .y = 2.0, .z = 0.0 }; // Above box
    var sphere_vel = Vec3{ .x = 0.0, .y = -5.0, .z = 0.0 }; // Falling down
    const sphere_mass: f32 = 1.0;
    const sphere_radius: f32 = 0.8;
    const sphere_kinematic = false;

    var box_pos = Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 }; // Stationary at origin
    var box_vel = Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 }; // Not moving
    const box_mass: f32 = 10.0;
    const box_extents = Vec3{ .x = 1.0, .y = 1.0, .z = 1.0 }; // Half-extents
    const box_kinematic = true; // Stationary box

    const restitution: f32 = 0.8; // 80% energy retention

    // Simulate collision scenario: sphere just touching box from above
    sphere_pos.y = box_pos.y + box_extents.y + sphere_radius - 0.1; // Slight penetration

    // Create collision info for sphere-box collision
    const collision_info = CollisionInfo{
        .has_collision = true,
        .contact_normal = Vec3{ .x = 0.0, .y = 1.0, .z = 0.0 }, // Normal pointing up (from box toward sphere)
        .penetration_depth = 0.1, // Small penetration
        .contact_point = Vec3{ .x = 0.0, .y = box_pos.y + box_extents.y, .z = 0.0 }, // Top surface of box
    };

    // Store original velocity for comparison
    const original_velocity_y = sphere_vel.y;

    std.debug.print("Before collision resolution:\n", .{});
    std.debug.print("  Sphere pos: ({d:.2}, {d:.2}, {d:.2})\n", .{ sphere_pos.x, sphere_pos.y, sphere_pos.z });
    std.debug.print("  Sphere vel: ({d:.2}, {d:.2}, {d:.2})\n", .{ sphere_vel.x, sphere_vel.y, sphere_vel.z });
    std.debug.print("  Box pos: ({d:.2}, {d:.2}, {d:.2})\n", .{ box_pos.x, box_pos.y, box_pos.z });
    std.debug.print("  Box vel: ({d:.2}, {d:.2}, {d:.2})\n", .{ box_vel.x, box_vel.y, box_vel.z });

    // Resolve collision
    core.resolveCollision(
        &sphere_pos, &sphere_vel, CollisionShape.SPHERE, Vec3{ .x = sphere_radius, .y = sphere_radius, .z = sphere_radius },
        sphere_mass, sphere_kinematic,
        &box_pos, &box_vel, CollisionShape.BOX, box_extents,
        box_mass, box_kinematic,
        restitution, collision_info
    );

    std.debug.print("After collision resolution:\n", .{});
    std.debug.print("  Sphere pos: ({d:.2}, {d:.2}, {d:.2})\n", .{ sphere_pos.x, sphere_pos.y, sphere_pos.z });
    std.debug.print("  Sphere vel: ({d:.2}, {d:.2}, {d:.2})\n", .{ sphere_vel.x, sphere_vel.y, sphere_vel.z });
    std.debug.print("  Box pos: ({d:.2}, {d:.2}, {d:.2})\n", .{ box_pos.x, box_pos.y, box_pos.z });
    std.debug.print("  Box vel: ({d:.2}, {d:.2}, {d:.2})\n", .{ box_vel.x, box_vel.y, box_vel.z });

    // Verify sphere bounces upward
    try expect(sphere_vel.y > 0.0); // Should be moving upward after bounce

    // Verify restitution: new velocity should be opposite direction with reduced magnitude
    const expected_bounce_velocity = -original_velocity_y * restitution;
    try expectApproxEqRel(sphere_vel.y, expected_bounce_velocity, 0.01);

    // Verify box stays stationary (kinematic)
    try expectApproxEqRel(box_vel.x, 0.0, 0.001);
    try expectApproxEqRel(box_vel.y, 0.0, 0.001);
    try expectApproxEqRel(box_vel.z, 0.0, 0.001);

    // Verify sphere separation with stabilization considerations
    // Note: With bias factor (0.3) and penetration slop (0.001), position correction is gradual
    const min_distance = box_extents.y + sphere_radius;
    const PENETRATION_SLOP = 0.001;
    const BIAS_FACTOR = 0.3;
    const initial_penetration = 0.1; // From test setup

    // Calculate expected remaining penetration after one resolution step
    const correctable_penetration = @max(0.0, initial_penetration - PENETRATION_SLOP);
    const corrected_amount = correctable_penetration * BIAS_FACTOR;
    const remaining_penetration = initial_penetration - corrected_amount;

    // Allow for remaining penetration due to gradual bias factor correction
    try expect(sphere_pos.y >= box_pos.y + min_distance - remaining_penetration - 0.001);

    std.debug.print("✅ Sphere-box bounce test passed:\n", .{});
    std.debug.print("   Original velocity: Y={d:.2}\n", .{original_velocity_y});
    std.debug.print("   Bounce velocity:   Y={d:.2}\n", .{sphere_vel.y});
    std.debug.print("   Expected velocity: Y={d:.2}\n", .{expected_bounce_velocity});
    std.debug.print("   Sphere position:   Y={d:.2}\n", .{sphere_pos.y});
    std.debug.print("   Box position:      Y={d:.2}\n", .{box_pos.y});
}

test "sphere-box collision with zero restitution (no bounce)" {
    var sphere_pos = Vec3{ .x = 0.0, .y = 2.0, .z = 0.0 };
    var sphere_vel = Vec3{ .x = 0.0, .y = -3.0, .z = 0.0 };
    var box_pos = Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    var box_vel = Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };

    const collision_info = CollisionInfo{
        .has_collision = true,
        .contact_normal = Vec3{ .x = 0.0, .y = 1.0, .z = 0.0 },
        .penetration_depth = 0.1,
        .contact_point = Vec3{ .x = 0.0, .y = 1.0, .z = 0.0 },
    };

    core.resolveCollision(
        &sphere_pos, &sphere_vel, CollisionShape.SPHERE, Vec3{ .x = 0.8, .y = 0.8, .z = 0.8 },
        1.0, false,
        &box_pos, &box_vel, CollisionShape.BOX, Vec3{ .x = 1.0, .y = 1.0, .z = 1.0 },
        10.0, true,
        0.0, collision_info // Zero restitution
    );

    // With zero restitution, sphere should stop (no bounce)
    try expectApproxEqRel(sphere_vel.y, 0.0, 0.01);

    std.debug.print("✅ Zero restitution test passed: sphere_vel.y = {d:.3}\n", .{sphere_vel.y});
}

test "sphere-box collision with perfect restitution (full bounce)" {
    var sphere_pos = Vec3{ .x = 0.0, .y = 2.0, .z = 0.0 };
    var sphere_vel = Vec3{ .x = 0.0, .y = -4.0, .z = 0.0 };
    var box_pos = Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };
    var box_vel = Vec3{ .x = 0.0, .y = 0.0, .z = 0.0 };

    const collision_info = CollisionInfo{
        .has_collision = true,
        .contact_normal = Vec3{ .x = 0.0, .y = 1.0, .z = 0.0 },
        .penetration_depth = 0.1,
        .contact_point = Vec3{ .x = 0.0, .y = 1.0, .z = 0.0 },
    };

    const original_speed = @abs(sphere_vel.y);

    core.resolveCollision(
        &sphere_pos, &sphere_vel, CollisionShape.SPHERE, Vec3{ .x = 0.8, .y = 0.8, .z = 0.8 },
        1.0, false,
        &box_pos, &box_vel, CollisionShape.BOX, Vec3{ .x = 1.0, .y = 1.0, .z = 1.0 },
        10.0, true,
        1.0, collision_info // Perfect restitution
    );

    // With perfect restitution, sphere should bounce with same speed
    try expect(sphere_vel.y > 0.0);
    try expectApproxEqRel(@abs(sphere_vel.y), original_speed, 0.01);

    std.debug.print("✅ Perfect restitution test passed: original={d:.2}, bounce={d:.2}\n", .{ original_speed, sphere_vel.y });
}