// src/core/entity_abi_test.zig
// B4/B6: the GPU-mapped component structs are `extern struct` so their layout is
// guaranteed ABI, not incidental. TypeScript maps these arrays byte-for-byte
// (gpu-buffer-manager INSTANCE_FLOATS, metadata offset reads), so any layout
// change must fail HERE first, deliberately.

const std = @import("std");
const testing = std.testing;
const engine = @import("game_engine.zig");

test "RenderingComponent is the 96-byte extensible instance struct (B6)" {
    try testing.expectEqual(@as(usize, 96), @sizeOf(engine.RenderingComponent));

    try testing.expectEqual(@as(usize, 0), @offsetOf(engine.RenderingComponent, "transform_matrix"));
    try testing.expectEqual(@as(usize, 64), @offsetOf(engine.RenderingComponent, "color"));
    try testing.expectEqual(@as(usize, 80), @offsetOf(engine.RenderingComponent, "anim_time"));
    try testing.expectEqual(@as(usize, 84), @offsetOf(engine.RenderingComponent, "variant_tex_index"));
    try testing.expectEqual(@as(usize, 88), @offsetOf(engine.RenderingComponent, "lod_flags"));
    try testing.expectEqual(@as(usize, 92), @offsetOf(engine.RenderingComponent, "bone_palette_off"));
}

test "RenderingComponent array is densely packed (stride == size)" {
    // The GPU instance buffer is one bulk copy of this array; padding between
    // elements would corrupt every instance after the first.
    try testing.expectEqual(@as(usize, 96), @sizeOf([2]engine.RenderingComponent) - @sizeOf(engine.RenderingComponent));
}

test "EntityMetadata layout matches the TS-visible ABI (B4)" {
    try testing.expectEqual(@as(usize, 16), @sizeOf(engine.EntityMetadata));

    try testing.expectEqual(@as(usize, 0), @offsetOf(engine.EntityMetadata, "id"));
    try testing.expectEqual(@as(usize, 4), @offsetOf(engine.EntityMetadata, "mesh_index"));
    try testing.expectEqual(@as(usize, 8), @offsetOf(engine.EntityMetadata, "material_id"));
    try testing.expectEqual(@as(usize, 12), @offsetOf(engine.EntityMetadata, "active"));
    try testing.expectEqual(@as(usize, 13), @offsetOf(engine.EntityMetadata, "physics_enabled"));
    try testing.expectEqual(@as(usize, 14), @offsetOf(engine.EntityMetadata, "rendering_enabled"));
    try testing.expectEqual(@as(usize, 15), @offsetOf(engine.EntityMetadata, "transform_dirty"));
}

test "exported buffer-debug functions agree with the struct layout" {
    engine.init();
    try testing.expectEqual(@as(u32, 96), engine.get_entity_size());
    try testing.expectEqual(@as(u32, 16), engine.get_entity_metadata_size());
}
