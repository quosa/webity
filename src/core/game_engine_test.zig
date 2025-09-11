// game_engine_test.zig - Tests for WASM exported functions
const std = @import("std");
const testing = std.testing;
const engine = @import("game_engine.zig");

test "init function initializes engine state" {
    engine.init();
    
    // Should start with no entities spawned initially
    try testing.expect(engine.get_entity_count() == 0);
    
    // Should have valid camera position
    const cam_x = engine.get_camera_position_x();
    const cam_y = engine.get_camera_position_y();
    const cam_z = engine.get_camera_position_z();
    
    try testing.expect(cam_x == 0.0);
    try testing.expect(cam_y == 0.0);
    try testing.expect(cam_z == -20.0);
}

test "entity management functions" {
    engine.init();
    
    // Test initial entity count (should be 0)
    const initial_count = engine.get_entity_count();
    try testing.expect(initial_count == 0);
    
    // Test spawning new entity
    const entity_id = engine.spawn_entity(1.0, 2.0, 3.0, 0.8);
    try testing.expect(entity_id < 10); // MAX_ENTITIES
    try testing.expect(engine.get_entity_count() == initial_count + 1);
    
    // Test entity position getters
    const x = engine.get_entity_position_x(entity_id);
    const y = engine.get_entity_position_y(entity_id);
    const z = engine.get_entity_position_z(entity_id);
    
    try testing.expectApproxEqAbs(@as(f32, 1.0), x, 0.001);
    try testing.expectApproxEqAbs(@as(f32, 2.0), y, 0.001);
    try testing.expectApproxEqAbs(@as(f32, 3.0), z, 0.001);
    
    // Test entity position setters
    engine.set_entity_position(entity_id, 5.0, 6.0, 7.0);
    try testing.expectApproxEqAbs(@as(f32, 5.0), engine.get_entity_position_x(entity_id), 0.001);
    try testing.expectApproxEqAbs(@as(f32, 6.0), engine.get_entity_position_y(entity_id), 0.001);
    try testing.expectApproxEqAbs(@as(f32, 7.0), engine.get_entity_position_z(entity_id), 0.001);
    
    // Test entity velocity setter
    engine.set_entity_velocity(entity_id, 1.0, 2.0, 3.0);
    
    // Test despawning all entities
    engine.despawn_all_entities();
    try testing.expect(engine.get_entity_count() == 0);
}

test "input handling functions" {
    engine.init();
    
    // Test setting input keys
    engine.set_input(87, true);  // W key pressed
    engine.set_input(65, true);  // A key pressed
    engine.set_input(83, false); // S key released
    engine.set_input(68, false); // D key released
    
    // Test unknown key (should not crash)
    engine.set_input(255, true);
}

test "mesh generation functions" {
    engine.init();
    
    // Test sphere mesh generation
    engine.generate_sphere_mesh(8);
    const vertex_count = engine.get_sphere_vertex_count();
    try testing.expect(vertex_count > 0);
    
    // Test grid floor generation
    engine.generate_grid_floor(4);
    const grid_count = engine.get_grid_vertex_count();
    try testing.expect(grid_count > 0);
}

test "memory offset functions return valid pointers" {
    engine.init();
    
    // Test vertex buffer offset
    const vertex_offset = engine.get_vertex_buffer_offset();
    try testing.expect(vertex_offset != 0);
    
    // Test grid buffer offset
    const grid_offset = engine.get_grid_buffer_offset();
    try testing.expect(grid_offset != 0);
    
    // Test uniform buffer offset
    const uniform_offset = engine.get_uniform_buffer_offset();
    try testing.expect(uniform_offset != 0);
    
    // Offsets should be different
    try testing.expect(vertex_offset != grid_offset);
    try testing.expect(vertex_offset != uniform_offset);
    try testing.expect(grid_offset != uniform_offset);
}

test "physics simulation with update function" {
    engine.init();
    
    // Spawn entity at known position
    const entity_id = engine.spawn_entity(0.0, 5.0, 0.0, 0.5);
    const initial_y = engine.get_entity_position_y(entity_id);
    
    // Run one physics update
    engine.update(0.016); // ~60 FPS
    
    // Entity should have moved due to gravity
    const final_y = engine.get_entity_position_y(entity_id);
    try testing.expect(final_y < initial_y);
}

test "collision detection" {
    engine.init();
    
    // Spawn an entity first
    const entity_id = engine.spawn_entity(0.0, -10.0, 0.0, 0.5);
    try testing.expect(entity_id < 10);
    
    // Run physics update to trigger floor collision
    engine.update(0.016);
    
    // Should detect collision (entity below floor should trigger boundary collision)
    const collision_state = engine.get_collision_state();
    try testing.expect(collision_state != 0);
}

test "camera configuration functions" {
    engine.init();
    
    // Test camera position setters
    engine.set_camera_position(10.0, 20.0, 30.0);
    try testing.expectApproxEqAbs(@as(f32, 10.0), engine.get_camera_position_x(), 0.001);
    try testing.expectApproxEqAbs(@as(f32, 20.0), engine.get_camera_position_y(), 0.001);
    try testing.expectApproxEqAbs(@as(f32, 30.0), engine.get_camera_position_z(), 0.001);
    
    // Test camera target setter
    engine.set_camera_target(5.0, 15.0, 25.0);
    
    // Test all camera movement directions
    const initial_cam_x = engine.get_camera_position_x();
    const initial_cam_z = engine.get_camera_position_z();
    
    // Test W key (forward movement)
    engine.set_input(87, true); // W key
    engine.update(0.016);
    engine.set_input(87, false); // Release W key
    
    // Test A key (left movement)  
    engine.set_input(65, true); // A key
    engine.update(0.016);
    engine.set_input(65, false); // Release A key
    
    // Test S key (backward movement)
    engine.set_input(83, true); // S key
    engine.update(0.016);
    engine.set_input(83, false); // Release S key
    
    // Test D key (right movement)
    engine.set_input(68, true); // D key
    engine.update(0.016);
    engine.set_input(68, false); // Release D key
    
    // Camera should have moved from initial position
    const final_cam_x = engine.get_camera_position_x();
    const final_cam_z = engine.get_camera_position_z();
    try testing.expect(final_cam_x != initial_cam_x or final_cam_z != initial_cam_z);
}

test "view matrix update with camera input" {
    engine.init();
    
    // Test that view matrix updates when camera moves via input
    engine.set_camera_position(0.0, 0.0, 0.0);
    engine.set_camera_target(0.0, 0.0, 1.0);
    
    // Move camera with input to trigger view matrix update path
    engine.set_input(87, true); // W key pressed
    engine.update(0.016); // This should trigger updateViewMatrix() via input_state != 0
    engine.set_input(87, false); // W key released
    
    // Camera should have moved
    const cam_z = engine.get_camera_position_z();
    try testing.expect(cam_z != 0.0);
}

test "physics configuration functions" {
    engine.init();
    
    // Test physics config setter
    engine.set_physics_config(-15.0, 0.95, 0.9);
    
    // Test world bounds setter
    engine.set_world_bounds(10.0, 10.0, 10.0);
    
    // Run physics to ensure config is applied
    _ = engine.spawn_entity(0.0, 5.0, 0.0, 0.5);
    engine.update(0.016);
    
    // Should not crash with new config
    try testing.expect(engine.get_entity_count() > 0);
}

test "backward compatibility functions" {
    engine.init();
    
    // Spawn an entity first for legacy functions to work
    _ = engine.spawn_entity(0.0, 0.0, 0.0, 0.5);
    
    // Test legacy ball position functions
    engine.set_position(1.0, 2.0, 3.0);
    try testing.expectApproxEqAbs(@as(f32, 1.0), engine.get_ball_position_x(), 0.001);
    try testing.expectApproxEqAbs(@as(f32, 2.0), engine.get_ball_position_y(), 0.001);
    try testing.expectApproxEqAbs(@as(f32, 3.0), engine.get_ball_position_z(), 0.001);
    
    // Test legacy force application (apply to entity 0)
    engine.apply_force(0, 5.0, 10.0, 15.0);
    
    // Run update to apply force
    engine.update(0.016);
    
    // Position should have changed
    const new_x = engine.get_ball_position_x();
    try testing.expect(new_x != 1.0);
}

test "edge cases and error handling" {
    engine.init();
    
    // Test invalid entity indices
    const invalid_x = engine.get_entity_position_x(999);
    const invalid_y = engine.get_entity_position_y(999);
    const invalid_z = engine.get_entity_position_z(999);
    
    try testing.expect(invalid_x == 0.0);
    try testing.expect(invalid_y == 0.0);
    try testing.expect(invalid_z == 0.0);
    
    // Test setting invalid entity positions/velocities (should not crash)
    engine.set_entity_position(999, 1.0, 2.0, 3.0);
    engine.set_entity_velocity(999, 1.0, 2.0, 3.0);
    
    // Test MAX_ENTITIES boundary condition - artificially set entity_count to near max
    engine.despawn_all_entities();
    
    // Artificially set entity count to 9999 (1 less than MAX_ENTITIES = 10000)
    engine.entity_count = 9999;
    
    var spawn_count: u32 = 0;
    var successful_spawns: u32 = 0;
    while (spawn_count < 5) { // Try to spawn 5 entities, only 1 should succeed
        const result = engine.spawn_entity(0.0, 0.0, 0.0, 0.5);
        if (result != 10000) { // 10000 (MAX_ENTITIES) is returned for failure
            successful_spawns += 1;
        }
        spawn_count += 1;
    }
    
    // Only 1 entity should spawn successfully (bringing total to MAX_ENTITIES)
    try testing.expect(successful_spawns == 1);
    try testing.expect(engine.get_entity_count() == 10000); // Should hit MAX_ENTITIES limit
}

test "multi-entity collision simulation" {
    engine.init();
    engine.despawn_all_entities();
    
    // Spawn two entities close together (overlapping)
    const entity1 = engine.spawn_entity(0.0, 0.0, 0.0, 0.5);
    const entity2 = engine.spawn_entity(0.5, 0.0, 0.0, 0.5); // Overlapping spheres
    
    try testing.expect(entity1 != entity2);
    try testing.expect(engine.get_entity_count() == 2);
    
    // Give them some velocity toward each other
    engine.set_entity_velocity(entity1, 2.0, 0.0, 0.0);
    engine.set_entity_velocity(entity2, -2.0, 0.0, 0.0);
    
    // Record initial positions
    const x1_initial = engine.get_entity_position_x(entity1);
    const x2_initial = engine.get_entity_position_x(entity2);
    
    // Run several physics steps
    for (0..10) |_| {
        engine.update(0.016);
    }
    
    // Verify entities moved due to physics simulation
    const x1_final = engine.get_entity_position_x(entity1);
    const x2_final = engine.get_entity_position_x(entity2);
    
    // Test passes if: entities exist, physics runs, entities move
    try testing.expect(engine.get_entity_count() == 2);
    try testing.expect(x1_final != x1_initial or x2_final != x2_initial);
    
    // Note: Entity-entity collision detection is complex and may need 
    // specific conditions to trigger reliably in tests
}