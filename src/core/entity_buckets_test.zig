// src/core/entity_buckets_test.zig
// B2: entities are stored grouped by mesh bucket (ascending mesh_index) so that
// all instances of one mesh are contiguous in the component arrays — the invariant
// the per-mesh instanced draw table relies on. These tests assert the invariant
// holds across mixed add/remove sequences, and that the stable-id API keeps
// resolving to the right entity while the arrays compact underneath it.

const std = @import("std");
const testing = std.testing;
const engine = @import("game_engine.zig");

// Assert same-mesh entities are contiguous: with buckets ordered by ascending
// mesh_index, the metadata mesh_index sequence must be non-decreasing.
fn expectBucketsContiguous() !void {
    var i: u32 = 1;
    while (i < engine.entity_count) : (i += 1) {
        try testing.expect(engine.entity_metadata[i].mesh_index >= engine.entity_metadata[i - 1].mesh_index);
    }
}

// Assert the bucket exports agree with a metadata scan for the given mesh.
fn expectBucketMatchesScan(mesh_index: u32) !void {
    var scan_count: u32 = 0;
    var scan_first: u32 = engine.entity_count;
    var i: u32 = 0;
    while (i < engine.entity_count) : (i += 1) {
        if (engine.entity_metadata[i].mesh_index == mesh_index) {
            if (scan_count == 0) scan_first = i;
            scan_count += 1;
        }
    }
    try testing.expectEqual(scan_count, engine.get_mesh_bucket_count(mesh_index));
    if (scan_count > 0) {
        try testing.expectEqual(scan_first, engine.get_mesh_bucket_start(mesh_index));
    }
}

// Add a minimal entity whose x position encodes its id, so id-based getters can
// prove they still resolve to the right entity after the arrays compact.
fn addTagged(id: u32, mesh_index: u32) void {
    const tag: f32 = @floatFromInt(id);
    engine.add_entity(id, tag, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, mesh_index, 0, 0, 1.0, 1.0, 0.5, true);
}

fn expectIdIntegrity(ids: []const u32) !void {
    for (ids) |id| {
        try testing.expectApproxEqAbs(@as(f32, @floatFromInt(id)), engine.get_entity_position_x(id), 0.0001);
    }
}

test "interleaved adds keep mesh buckets contiguous" {
    engine.init();

    // Interleave three meshes plus a high-index straggler
    addTagged(0, 2);
    addTagged(1, 1);
    addTagged(2, 2);
    addTagged(3, 0);
    addTagged(4, 1);
    addTagged(5, 2);
    addTagged(6, 0);
    addTagged(7, 5);
    addTagged(8, 1);

    try testing.expectEqual(@as(u32, 9), engine.get_entity_count());
    try expectBucketsContiguous();

    try testing.expectEqual(@as(u32, 2), engine.get_mesh_bucket_count(0));
    try testing.expectEqual(@as(u32, 3), engine.get_mesh_bucket_count(1));
    try testing.expectEqual(@as(u32, 3), engine.get_mesh_bucket_count(2));
    try testing.expectEqual(@as(u32, 1), engine.get_mesh_bucket_count(5));

    try testing.expectEqual(@as(u32, 0), engine.get_mesh_bucket_start(0));
    try testing.expectEqual(@as(u32, 2), engine.get_mesh_bucket_start(1));
    try testing.expectEqual(@as(u32, 5), engine.get_mesh_bucket_start(2));
    try testing.expectEqual(@as(u32, 8), engine.get_mesh_bucket_start(5));

    // The id-based API must still find every entity despite the moves
    try expectIdIntegrity(&[_]u32{ 0, 1, 2, 3, 4, 5, 6, 7, 8 });
}

test "removals keep buckets contiguous (first/middle/last/whole-bucket)" {
    engine.init();

    addTagged(0, 2);
    addTagged(1, 1);
    addTagged(2, 2);
    addTagged(3, 0);
    addTagged(4, 1);
    addTagged(5, 2);
    addTagged(6, 0);
    addTagged(7, 5);
    addTagged(8, 1);

    // Remove from the middle bucket (id 4, mesh 1)
    engine.remove_entity(4);
    try testing.expectEqual(@as(u32, 8), engine.get_entity_count());
    try expectBucketsContiguous();
    try testing.expectEqual(@as(u32, 2), engine.get_mesh_bucket_count(1));
    try expectIdIntegrity(&[_]u32{ 0, 1, 2, 3, 5, 6, 7, 8 });

    // Remove from the first bucket (id 3, mesh 0)
    engine.remove_entity(3);
    try expectBucketsContiguous();
    try expectIdIntegrity(&[_]u32{ 0, 1, 2, 5, 6, 7, 8 });

    // Remove the global-last bucket entirely (id 7, mesh 5)
    engine.remove_entity(7);
    try expectBucketsContiguous();
    try testing.expectEqual(@as(u32, 0), engine.get_mesh_bucket_count(5));
    try expectIdIntegrity(&[_]u32{ 0, 1, 2, 5, 6, 8 });

    // Drain mesh 2 completely
    engine.remove_entity(0);
    engine.remove_entity(2);
    engine.remove_entity(5);
    try expectBucketsContiguous();
    try testing.expectEqual(@as(u32, 0), engine.get_mesh_bucket_count(2));
    try testing.expectEqual(@as(u32, 3), engine.get_entity_count());
    try expectIdIntegrity(&[_]u32{ 1, 6, 8 });

    // Removed ids must no longer resolve
    try testing.expectEqual(@as(f32, 0), engine.get_entity_position_x(4));
    try testing.expectEqual(@as(f32, 0), engine.get_entity_position_x(7));

    for ([_]u32{ 0, 1, 2, 5 }) |mesh| {
        try expectBucketMatchesScan(mesh);
    }
}

test "adds after removals reuse slots and keep the id table consistent" {
    engine.init();

    addTagged(0, 1);
    addTagged(1, 2);
    addTagged(2, 1);
    engine.remove_entity(0);
    addTagged(10, 0); // new bucket in front — shifts everything right
    addTagged(11, 2);

    try testing.expectEqual(@as(u32, 4), engine.get_entity_count());
    try expectBucketsContiguous();
    try expectIdIntegrity(&[_]u32{ 1, 2, 10, 11 });

    for ([_]u32{ 0, 1, 2 }) |mesh| {
        try expectBucketMatchesScan(mesh);
    }
}

test "rotator component follows a moved entity" {
    engine.init();

    // Sphere (mesh 2) first, so a later cube (mesh 1) insertion moves it
    addTagged(0, 2);
    engine.enable_entity_rotator(0, 1.0, 2.0, 3.0, 7);

    addTagged(1, 1); // cube bucket opens BEFORE the sphere bucket -> sphere moves

    // Sphere is now at index 1 (cube bucket first), and its rotator moved with it
    try testing.expectEqual(@as(u32, 0), engine.entity_metadata[1].id);
    try testing.expect(engine.rotator_components[1].enabled);
    try testing.expectApproxEqAbs(@as(f32, 2.0), engine.rotator_components[1].angular_velocity.y, 0.0001);
    // The cube's fresh slot must NOT have inherited a stale rotator
    try testing.expectEqual(@as(u32, 1), engine.entity_metadata[0].id);
    try testing.expect(!engine.rotator_components[0].enabled);
}

test "despawn_all_entities resets bucket bookkeeping" {
    engine.init();

    addTagged(0, 1);
    addTagged(1, 2);
    engine.despawn_all_entities();

    try testing.expectEqual(@as(u32, 0), engine.get_entity_count());
    try testing.expectEqual(@as(u32, 0), engine.get_mesh_bucket_count(1));
    try testing.expectEqual(@as(u32, 0), engine.get_mesh_bucket_count(2));
    try testing.expectEqual(@as(f32, 0), engine.get_entity_position_x(0));

    // Fresh adds after a despawn start from a clean layout
    addTagged(20, 2);
    addTagged(21, 1);
    try expectBucketsContiguous();
    try expectIdIntegrity(&[_]u32{ 20, 21 });
}

test "spawn_entity returns stable ids that survive re-bucketing" {
    engine.init();

    const sphere_id = engine.spawn_entity(3.0, 0, 0, 0.5); // SPHERE = mesh 2
    const cube_id = engine.spawn_entity_with_mesh(4.0, 0, 0, 0.5, 1); // CUBE = mesh 1, inserts in front

    try testing.expect(sphere_id != cube_id);
    try expectBucketsContiguous();
    try testing.expectApproxEqAbs(@as(f32, 3.0), engine.get_entity_position_x(sphere_id), 0.0001);
    try testing.expectApproxEqAbs(@as(f32, 4.0), engine.get_entity_position_x(cube_id), 0.0001);
}
