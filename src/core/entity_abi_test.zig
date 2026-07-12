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

// ---------------------------------------------------------------------------
// Entity-flags ABI behavior (BodyType + mass + gravityScale model)
// ---------------------------------------------------------------------------

// add_entity(id, x,y,z, rotX,rotY,rotZ, sx,sy,sz, r,g,b,a, mesh, mat, bodyType, mass, gravityScale, radius, physicsEnabled)
fn addBody(id: u32, y: f32, body_type: u8, mass: f32, gravity_scale: f32) void {
    engine.add_entity(id, 0, y, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 0, body_type, mass, gravity_scale, 0.5, true);
}

test "gravityScale scales gravity on DYNAMIC bodies (0 = space, no fall)" {
    engine.init();
    addBody(0, 5.0, 0, 1.0, 1.0); // normal gravity
    addBody(1, 5.0, 0, 1.0, 0.0); // space: fully simulated, but no fall

    engine.update(0.016);

    try testing.expect(engine.get_entity_velocity_y(0) < 0); // falling
    try testing.expectEqual(@as(f32, 0), engine.get_entity_velocity_y(1)); // floating

    // ...but the floating body still responds to forces (it is DYNAMIC, not kinematic)
    engine.apply_force_to_entity(1, 0, 3.0, 0);
    try testing.expect(engine.get_entity_velocity_y(1) > 0);
}

test "KINEMATIC and STATIC bodies are immovable to the solver (inv_mass = 0)" {
    engine.init();
    addBody(0, 0, 1, 5.0, 1.0); // kinematic — mass stored but inert
    addBody(1, 0, 2, 0.0, 1.0); // static — mass ignored

    const kin_index = 0;
    try testing.expectEqual(@as(f32, 0), engine.physics_components[kin_index].inv_mass);
    try testing.expectEqual(@as(f32, 5.0), engine.physics_components[kin_index].mass); // survives for transitions

    engine.update(0.016);
    try testing.expectEqual(@as(f32, 0), engine.get_entity_velocity_y(0)); // no gravity integration
    try testing.expectEqual(@as(f32, 0), engine.get_entity_velocity_y(1));

    // Forces do not move them either
    engine.apply_force_to_entity(0, 0, 3.0, 0);
    try testing.expectEqual(@as(f32, 0), engine.get_entity_velocity_y(0));
}

test "DYNAMIC body with mass <= 0 is clamped to mass 1 (never a poisoned inv_mass)" {
    engine.init();
    addBody(0, 0, 0, 0.0, 1.0); // invalid: dynamic + mass 0
    addBody(1, 0, 0, -2.0, 1.0); // invalid: dynamic + negative mass

    for ([_]u32{ 0, 1 }) |i| {
        try testing.expectEqual(@as(f32, 1.0), engine.physics_components[i].mass);
        try testing.expectEqual(@as(f32, 1.0), engine.physics_components[i].inv_mass);
    }
}

test "set_entity_body_type: kinematic elevator falls when its cable snaps" {
    engine.init();
    addBody(0, 5.0, 1, 40.0, 1.0); // kinematic elevator, mass stored

    engine.update(0.016);
    try testing.expectEqual(@as(f32, 0), engine.get_entity_velocity_y(0)); // held by the script

    engine.set_entity_body_type(0, 0); // cable snaps -> DYNAMIC
    try testing.expectEqual(@as(f32, 1.0 / 40.0), engine.physics_components[0].inv_mass); // stored mass now live

    engine.update(0.016);
    try testing.expect(engine.get_entity_velocity_y(0) < 0); // falling
}

test "initial rotation is baked at add time (static entities keep their rotation)" {
    engine.init();
    // 90° around Z, no RigidBody-style per-frame sync involved (STATIC body)
    const half_pi: f32 = std.math.pi / 2.0;
    engine.add_entity(0, 0, 0, 0, 0, 0, half_pi, 1, 1, 1, 1, 1, 1, 1, 2, 0, 2, 0, 1.0, 0.5, true);

    // Column-major T*R*S: with Rz(90°), column 0 becomes (cos, sin, 0) ≈ (0, 1, 0)
    const m = engine.rendering_components[0].transform_matrix;
    try testing.expectApproxEqAbs(@as(f32, 0.0), m[0], 0.0001);
    try testing.expectApproxEqAbs(@as(f32, 1.0), m[1], 0.0001);
}

test "physicsEnabled=false keeps mesh-only entities fully inert (decorative)" {
    engine.init();
    // A decorative grid: no collision, no gravity — regardless of body type/mass
    engine.add_entity(0, 0, 5, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 4, 0, 0, 1.0, 1.0, 0.5, false);

    engine.update(0.016);
    try testing.expectEqual(@as(f32, 0), engine.get_entity_velocity_y(0));
    try testing.expect(!engine.entity_metadata[0].physics_enabled);
}
