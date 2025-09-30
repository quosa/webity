const std = @import("std");
const testing = std.testing;
const game_engine = @import("game_engine.zig");

// Comprehensive test to compare floor boundary vs kinematic box settling behavior
// This test measures frame-by-frame data to identify why kinematic objects cause jitter
test "floor vs kinematic box settling comparison" {
    std.debug.print("\n🔬 Floor vs Kinematic Box Settling Comparison\n", .{});

    // Test A: Floor Boundary Collision
    std.debug.print("\n===== TEST A: FLOOR BOUNDARY COLLISION =====\n", .{});
    const floor_data = try runFloorBoundaryTest();

    // Test B: Kinematic Box Collision
    std.debug.print("\n===== TEST B: KINEMATIC BOX COLLISION =====\n", .{});
    const box_data = try runKinematicBoxTest();

    // Test C: Comparative Analysis
    std.debug.print("\n===== TEST C: COMPARATIVE ANALYSIS =====\n", .{});
    analyzeSettlingDifferences(floor_data, box_data);
}

const SettlingData = struct {
    final_position_y: f32,
    final_velocity_y: f32,
    settling_frame: u32,
    micro_velocity_count: u32,
    position_variance: f32,
    velocity_variance: f32,
};

fn runFloorBoundaryTest() !SettlingData {
    std.debug.print("🏢 Floor Boundary Test: Sphere dropping to world floor at Y=-8\n", .{});

    // Initialize physics engine
    game_engine.init();

    // Add sphere at high position to fall to floor boundary
    game_engine.add_entity(
        1,          // id
        0.0, 5.0, 0.0,  // position: high above floor boundary (-8)
        1.0, 1.0, 1.0,  // scale
        1.0, 0.2, 1.0, 1.0,  // color
        2,          // mesh: sphere
        0,          // material
        1.0,        // mass
        1.0,        // radius
        false       // kinematic: false (dynamic)
    );
    const sphere_id: u32 = 1;

    // Run simulation and collect settling data
    const delta_time: f32 = 1.0 / 60.0; // 60 FPS
    var settling_data = SettlingData{
        .final_position_y = 0.0,
        .final_velocity_y = 0.0,
        .settling_frame = 0,
        .micro_velocity_count = 0,
        .position_variance = 0.0,
        .velocity_variance = 0.0,
    };

    var position_history: [100]f32 = undefined;
    var velocity_history: [100]f32 = undefined;
    var last_settled_frame: u32 = 0;

    // Run for up to 600 frames (10 seconds)
    for (0..600) |frame| {
        game_engine.update(delta_time);

        const pos_y = game_engine.get_entity_position_y(sphere_id);
        const vel_y = game_engine.get_entity_velocity_y(sphere_id);

        // Store recent history for variance calculation
        if (frame >= 500) { // Last 100 frames
            const history_idx = (frame - 500) % 100;
            position_history[history_idx] = pos_y;
            velocity_history[history_idx] = vel_y;
        }

        // Log key frames
        if (frame % 50 == 0 or frame < 10) {
            std.debug.print("  Frame {d:3}: Y={d:.3}, VY={d:.3}\n", .{ frame, pos_y, vel_y });
        }

        // Detect settling (very small velocity for sustained period)
        if (@abs(vel_y) < 0.01) {
            if (settling_data.settling_frame == 0) {
                settling_data.settling_frame = @intCast(frame);
                std.debug.print("  🎯 SETTLING DETECTED at frame {d}: Y={d:.3}, VY={d:.3}\n", .{ frame, pos_y, vel_y });
            }
            last_settled_frame = @intCast(frame);
        }

        // Count micro-velocity oscillations in settled state
        if (settling_data.settling_frame > 0 and frame > settling_data.settling_frame + 50) {
            if (@abs(vel_y) > 0.001) { // Tiny velocity spike
                settling_data.micro_velocity_count += 1;
            }
        }

        // Stop if well settled
        if (frame > settling_data.settling_frame + 100 and settling_data.settling_frame > 0) {
            break;
        }
    }

    // Calculate final statistics
    settling_data.final_position_y = game_engine.get_entity_position_y(sphere_id);
    settling_data.final_velocity_y = game_engine.get_entity_velocity_y(sphere_id);

    // Calculate variance in final settling period
    if (last_settled_frame > 500) {
        var pos_sum: f32 = 0.0;
        var vel_sum: f32 = 0.0;
        const count = @min(100, last_settled_frame - 500);

        for (0..count) |i| {
            pos_sum += position_history[i];
            vel_sum += velocity_history[i];
        }

        const pos_mean = pos_sum / @as(f32, @floatFromInt(count));
        const vel_mean = vel_sum / @as(f32, @floatFromInt(count));

        var pos_variance: f32 = 0.0;
        var vel_variance: f32 = 0.0;

        for (0..count) |i| {
            const pos_diff = position_history[i] - pos_mean;
            const vel_diff = velocity_history[i] - vel_mean;
            pos_variance += pos_diff * pos_diff;
            vel_variance += vel_diff * vel_diff;
        }

        settling_data.position_variance = pos_variance / @as(f32, @floatFromInt(count));
        settling_data.velocity_variance = vel_variance / @as(f32, @floatFromInt(count));
    }

    std.debug.print("📊 Floor Boundary Results:\n", .{});
    std.debug.print("  Final Position: Y={d:.6}\n", .{settling_data.final_position_y});
    std.debug.print("  Final Velocity: VY={d:.6}\n", .{settling_data.final_velocity_y});
    std.debug.print("  Settling Frame: {d}\n", .{settling_data.settling_frame});
    std.debug.print("  Micro-velocity Count: {d}\n", .{settling_data.micro_velocity_count});
    std.debug.print("  Position Variance: {d:.8}\n", .{settling_data.position_variance});
    std.debug.print("  Velocity Variance: {d:.8}\n", .{settling_data.velocity_variance});

    return settling_data;
}

fn runKinematicBoxTest() !SettlingData {
    std.debug.print("📦 Kinematic Box Test: Sphere dropping onto kinematic box\n", .{});

    // Reset physics engine
    game_engine.init();

    // Add kinematic box platform at Y=-7 (same relative position as floor test)
    game_engine.add_entity(
        0,          // id
        0.0, -7.0, 0.0,  // position: platform
        2.0, 2.0, 2.0,   // scale: 2x2x2 visual
        0.5, 0.5, 0.5, 1.0,  // color: gray
        1,          // mesh: box
        0,          // material
        5.0,        // mass
        1.0,        // extents (collision size)
        true        // kinematic: true (immovable)
    );

    // Add sphere at same relative height as floor test
    game_engine.add_entity(
        1,          // id
        0.0, 5.0, 0.0,   // position: high above platform (-7 + 12 = 5, same drop height)
        1.0, 1.0, 1.0,   // scale
        1.0, 0.2, 1.0, 1.0,  // color
        2,          // mesh: sphere
        0,          // material
        1.0,        // mass
        1.0,        // radius
        false       // kinematic: false (dynamic)
    );
    const sphere_id: u32 = 1;

    // Run identical simulation to floor test
    const delta_time: f32 = 1.0 / 60.0;
    var settling_data = SettlingData{
        .final_position_y = 0.0,
        .final_velocity_y = 0.0,
        .settling_frame = 0,
        .micro_velocity_count = 0,
        .position_variance = 0.0,
        .velocity_variance = 0.0,
    };

    var position_history: [100]f32 = undefined;
    var velocity_history: [100]f32 = undefined;
    var last_settled_frame: u32 = 0;

    for (0..600) |frame| {
        game_engine.update(delta_time);

        const pos_y = game_engine.get_entity_position_y(sphere_id);
        const vel_y = game_engine.get_entity_velocity_y(sphere_id);

        // Store recent history for variance calculation
        if (frame >= 500) {
            const history_idx = (frame - 500) % 100;
            position_history[history_idx] = pos_y;
            velocity_history[history_idx] = vel_y;
        }

        // Log key frames
        if (frame % 50 == 0 or frame < 10) {
            std.debug.print("  Frame {d:3}: Y={d:.3}, VY={d:.3}\n", .{ frame, pos_y, vel_y });
        }

        // Detect settling
        if (@abs(vel_y) < 0.01) {
            if (settling_data.settling_frame == 0) {
                settling_data.settling_frame = @intCast(frame);
                std.debug.print("  🎯 SETTLING DETECTED at frame {d}: Y={d:.3}, VY={d:.3}\n", .{ frame, pos_y, vel_y });
            }
            last_settled_frame = @intCast(frame);
        }

        // Count micro-velocity oscillations in settled state
        if (settling_data.settling_frame > 0 and frame > settling_data.settling_frame + 50) {
            if (@abs(vel_y) > 0.001) {
                settling_data.micro_velocity_count += 1;
            }
        }

        // Stop if well settled
        if (frame > settling_data.settling_frame + 100 and settling_data.settling_frame > 0) {
            break;
        }
    }

    // Calculate final statistics (same as floor test)
    settling_data.final_position_y = game_engine.get_entity_position_y(sphere_id);
    settling_data.final_velocity_y = game_engine.get_entity_velocity_y(sphere_id);

    // Calculate variance in final settling period
    if (last_settled_frame > 500) {
        var pos_sum: f32 = 0.0;
        var vel_sum: f32 = 0.0;
        const count = @min(100, last_settled_frame - 500);

        for (0..count) |i| {
            pos_sum += position_history[i];
            vel_sum += velocity_history[i];
        }

        const pos_mean = pos_sum / @as(f32, @floatFromInt(count));
        const vel_mean = vel_sum / @as(f32, @floatFromInt(count));

        var pos_variance: f32 = 0.0;
        var vel_variance: f32 = 0.0;

        for (0..count) |i| {
            const pos_diff = position_history[i] - pos_mean;
            const vel_diff = velocity_history[i] - vel_mean;
            pos_variance += pos_diff * pos_diff;
            vel_variance += vel_diff * vel_diff;
        }

        settling_data.position_variance = pos_variance / @as(f32, @floatFromInt(count));
        settling_data.velocity_variance = vel_variance / @as(f32, @floatFromInt(count));
    }

    std.debug.print("📊 Kinematic Box Results:\n", .{});
    std.debug.print("  Final Position: Y={d:.6}\n", .{settling_data.final_position_y});
    std.debug.print("  Final Velocity: VY={d:.6}\n", .{settling_data.final_velocity_y});
    std.debug.print("  Settling Frame: {d}\n", .{settling_data.settling_frame});
    std.debug.print("  Micro-velocity Count: {d}\n", .{settling_data.micro_velocity_count});
    std.debug.print("  Position Variance: {d:.8}\n", .{settling_data.position_variance});
    std.debug.print("  Velocity Variance: {d:.8}\n", .{settling_data.velocity_variance});

    return settling_data;
}

fn analyzeSettlingDifferences(floor_data: SettlingData, box_data: SettlingData) void {
    std.debug.print("🔍 COMPARATIVE ANALYSIS:\n", .{});

    // Position stability comparison
    const pos_variance_ratio = if (floor_data.position_variance > 0)
        box_data.position_variance / floor_data.position_variance else 0;
    std.debug.print("  Position Variance Ratio (Box/Floor): {d:.2}x\n", .{pos_variance_ratio});

    // Velocity stability comparison
    const vel_variance_ratio = if (floor_data.velocity_variance > 0)
        box_data.velocity_variance / floor_data.velocity_variance else 0;
    std.debug.print("  Velocity Variance Ratio (Box/Floor): {d:.2}x\n", .{vel_variance_ratio});

    // Micro-velocity oscillation comparison
    const micro_vel_diff = @as(i32, @intCast(box_data.micro_velocity_count)) - @as(i32, @intCast(floor_data.micro_velocity_count));
    std.debug.print("  Micro-velocity Difference (Box - Floor): {d}\n", .{micro_vel_diff});

    // Settling time comparison
    const settling_time_diff = @as(i32, @intCast(box_data.settling_frame)) - @as(i32, @intCast(floor_data.settling_frame));
    std.debug.print("  Settling Time Difference (Box - Floor): {d} frames\n", .{settling_time_diff});

    // Final position precision comparison
    const final_pos_diff = @abs(box_data.final_position_y - floor_data.final_position_y);
    std.debug.print("  Final Position Difference: {d:.6}\n", .{final_pos_diff});

    // Final velocity precision comparison
    const final_vel_diff = @abs(box_data.final_velocity_y - floor_data.final_velocity_y);
    std.debug.print("  Final Velocity Difference: {d:.6}\n", .{final_vel_diff});

    // Analysis conclusions
    std.debug.print("\n🎯 ANALYSIS CONCLUSIONS:\n", .{});

    if (pos_variance_ratio > 2.0) {
        std.debug.print("  ❌ POSITION INSTABILITY: Box shows {d:.1}x more position variance\n", .{pos_variance_ratio});
    } else {
        std.debug.print("  ✅ Position Stability: Both methods have similar position stability\n", .{});
    }

    if (vel_variance_ratio > 2.0) {
        std.debug.print("  ❌ VELOCITY INSTABILITY: Box shows {d:.1}x more velocity variance\n", .{vel_variance_ratio});
    } else {
        std.debug.print("  ✅ Velocity Stability: Both methods have similar velocity stability\n", .{});
    }

    if (micro_vel_diff > 10) {
        std.debug.print("  ❌ MICRO-OSCILLATIONS: Box has {d} more micro-velocity spikes\n", .{micro_vel_diff});
    } else {
        std.debug.print("  ✅ Micro-oscillations: Both methods have similar micro-movement\n", .{});
    }

    if (@abs(settling_time_diff) > 50) {
        std.debug.print("  ⚠️ SETTLING TIME: {d} frame difference in settling time\n", .{settling_time_diff});
    } else {
        std.debug.print("  ✅ Settling Time: Both methods settle in similar timeframe\n", .{});
    }

    std.debug.print("\n📋 RECOMMENDED ACTIONS:\n", .{});
    if (pos_variance_ratio > 2.0 or vel_variance_ratio > 2.0 or micro_vel_diff > 10) {
        std.debug.print("  🔧 Implement kinematic collision stabilization\n", .{});
        std.debug.print("  🎯 Target: Reduce box collision variance to floor levels\n", .{});
        std.debug.print("  📐 Consider: Resting contact detection or position snapping\n", .{});
    } else {
        std.debug.print("  ✅ Current collision resolution is adequate\n", .{});
        std.debug.print("  🔬 Consider: Fine-tuning for visual perfection\n", .{});
    }
}