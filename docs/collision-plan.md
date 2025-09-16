# Box and Plane Collider Implementation Plan

**Status**: Planning Phase
**Priority**: High
**Dependencies**: Current sphere collision system (✅ Complete)
**Target**: Add AABB box colliders and prepare plane collider foundation

## Overview

This document outlines the comprehensive plan for implementing AABB (Axis-Aligned Bounding Box) colliders and preparing for plane colliders in the 3D game engine. The current system has robust sphere collision detection - this plan extends it to support box and plane collision shapes.

## Current System Analysis ✅

### Strengths
- **Robust Sphere Collision**: Complete sphere-sphere collision with kinematic/dynamic support
- **ECS Architecture**: Clean 4-component system (PhysicsComponent, RenderingComponent, EntityMetadata, RotatorComponent)
- **Comprehensive Testing**: 6 Zig unit tests covering all sphere collision scenarios
- **Performance Proven**: 6,598+ entities at 60fps baseline established
- **TypeScript Integration**: RigidBody component with basic collider type enum (not implemented)

### Current Collision Support
- ✅ **Sphere-Sphere**: Fully implemented with kinematic/dynamic bodies
- ❌ **Box-Box**: Not implemented (renders as sphere collision)
- ❌ **Sphere-Box**: Not implemented
- ❌ **Plane Collision**: Not implemented

### Files with Collision Logic
- `src/core/game_core.zig` - Core collision mathematics and physics
- `src/core/game_engine.zig` - ECS collision loop and entity management
- `src/core/collision_test.zig` - Unit tests for collision scenarios
- `src/engine/components.ts` - RigidBody component (collision shape enum exists)

## Phase 1: Core AABB Collision Mathematics (Zig/WASM)

### 1.1 Collision Shape System Enhancement
**File: `src/core/game_core.zig`**

#### New Types and Enums
```zig
// Collision shape enumeration
pub const CollisionShape = enum(u8) {
    SPHERE = 0,
    BOX = 1,
    PLANE = 2,  // Future implementation
};

// Collision information structure
pub const CollisionInfo = struct {
    has_collision: bool,
    penetration_depth: f32,
    contact_normal: Vec3,
    contact_point: Vec3,
};
```

#### Enhanced PhysicsComponent
```zig
// Update PhysicsComponent in game_engine.zig
const PhysicsComponent = struct {
    // ... existing fields ...
    collision_shape: CollisionShape,
    extents: Vec3, // Half-extents for boxes, normal vector for planes, radius in .x for spheres
};
```

#### Vector Utilities
```zig
// Additional Vec3 utilities for AABB calculations
pub fn vec3_min(a: Vec3, b: Vec3) Vec3
pub fn vec3_max(a: Vec3, b: Vec3) Vec3
pub fn vec3_abs(v: Vec3) Vec3
pub fn vec3_clamp(v: Vec3, min_val: Vec3, max_val: Vec3) Vec3
```

### 1.2 AABB Collision Detection Functions
**File: `src/core/game_core.zig`**

#### Box-Box Collision (AABB vs AABB)
```zig
/// Check collision between two axis-aligned bounding boxes
/// Returns penetration depth and collision normal if collision detected
pub fn checkBoxCollision(pos1: Vec3, extents1: Vec3, pos2: Vec3, extents2: Vec3) ?CollisionInfo {
    // Calculate separation on each axis
    const sep_x = @abs(pos2.x - pos1.x) - (extents1.x + extents2.x);
    const sep_y = @abs(pos2.y - pos1.y) - (extents1.y + extents2.y);
    const sep_z = @abs(pos2.z - pos1.z) - (extents1.z + extents2.z);

    // No collision if separated on any axis
    if (sep_x > 0 or sep_y > 0 or sep_z > 0) return null;

    // Find axis of minimum penetration
    // Calculate collision normal and contact point
    // Return CollisionInfo with penetration depth and normal
}
```

#### Sphere-Box Collision
```zig
/// Check collision between sphere and AABB
/// Handles face, edge, and corner collision cases
pub fn checkSphereBoxCollision(sphere_pos: Vec3, radius: f32, box_pos: Vec3, box_extents: Vec3) ?CollisionInfo {
    // Find closest point on box to sphere center
    const closest_point = vec3_clamp(sphere_pos,
        vec3_subtract(box_pos, box_extents),
        vec3_add(box_pos, box_extents));

    // Calculate distance from sphere center to closest point
    const distance_vec = vec3_subtract(sphere_pos, closest_point);
    const distance_squared = dot(distance_vec, distance_vec);

    // Check if sphere intersects box
    if (distance_squared <= radius * radius) {
        // Calculate penetration and normal
        // Handle special cases: sphere center inside box
        return CollisionInfo{ /* ... */ };
    }

    return null;
}
```

#### Box Collision Response
```zig
/// Resolve collision between two boxes with kinematic support
pub fn resolveBoxCollision(
    pos1: *Vec3, vel1: *Vec3, extents1: Vec3, mass1: f32, is_kinematic1: bool,
    pos2: *Vec3, vel2: *Vec3, extents2: Vec3, mass2: f32, is_kinematic2: bool,
    restitution: f32, collision_info: CollisionInfo
) void {
    // Similar structure to resolveSphereCollisionWithKinematic
    // Use collision_info.contact_normal for separation direction
    // Apply impulse-based collision response
    // Handle kinematic body constraints
}
```

### 1.3 Mixed Collision Dispatcher
**File: `src/core/game_core.zig`**

```zig
/// Universal collision check that dispatches based on collision shapes
pub fn checkCollision(
    pos1: Vec3, shape1: CollisionShape, extents1: Vec3,
    pos2: Vec3, shape2: CollisionShape, extents2: Vec3
) ?CollisionInfo {
    switch (shape1) {
        .SPHERE => switch (shape2) {
            .SPHERE => return convertSphereResult(checkSphereCollision(pos1, extents1.x, pos2, extents2.x)),
            .BOX => return checkSphereBoxCollision(pos1, extents1.x, pos2, extents2),
            .PLANE => return null, // Future implementation
        },
        .BOX => switch (shape2) {
            .SPHERE => return checkSphereBoxCollision(pos2, extents2.x, pos1, extents1),
            .BOX => return checkBoxCollision(pos1, extents1, pos2, extents2),
            .PLANE => return null, // Future implementation
        },
        .PLANE => return null, // Future implementation
    }
}
```

## Phase 2: WASM API Extensions

### 2.1 Enhanced Entity Creation API
**File: `src/core/game_engine.zig`**

#### Collision Shape Configuration
```zig
/// Enhanced entity spawning with collision shape support
pub export fn spawn_entity_with_collider(
    x: f32, y: f32, z: f32,
    collision_shape: u8,      // 0=sphere, 1=box, 2=plane
    extent_x: f32,            // radius for sphere, half-width for box, normal.x for plane
    extent_y: f32,            // unused for sphere, half-height for box, normal.y for plane
    extent_z: f32,            // unused for sphere, half-depth for box, normal.z for plane
    mesh_type_id: u8
) u32

/// Update collision shape for existing entity
pub export fn set_entity_collision_shape(id: u32, shape: u8, extent_x: f32, extent_y: f32, extent_z: f32) void

/// Get collision shape information
pub export fn get_entity_collision_shape(id: u32) u8
pub export fn get_entity_collision_extents(id: u32, axis: u8) f32  // 0=x, 1=y, 2=z
```

#### Enhanced ECS Collision Loop
**File: `src/core/game_engine.zig`**

```zig
// Update checkEntityCollisions() to use collision shape dispatcher
fn checkEntityCollisions(delta_time: f32) void {
    for (0..entity_count) |i| {
        if (!entity_metadata[i].active or !entity_metadata[i].physics_enabled) continue;

        for (i + 1..entity_count) |j| {
            if (!entity_metadata[j].active or !entity_metadata[j].physics_enabled) continue;

            const phys1 = &physics_components[i];
            const phys2 = &physics_components[j];

            // Use universal collision dispatcher
            if (core.checkCollision(
                phys1.position, phys1.collision_shape, phys1.extents,
                phys2.position, phys2.collision_shape, phys2.extents
            )) |collision_info| {
                // Resolve collision based on shapes
                resolveCollisionByShape(phys1, phys2, collision_info);
                // Update collision state and metadata
            }
        }
    }
}
```

### 2.2 Debug and Query Functions
```zig
/// Debug collision information for specific entity
pub export fn debug_get_entity_collision_info(id: u32, info_type: u8) f32

/// Get detailed collision statistics
pub export fn get_collision_manifold_count() u32
pub export def get_collision_type_stats(shape1: u8, shape2: u8) u32  // Count of specific collision type pairs
```

## Phase 3: TypeScript Integration

### 3.1 RigidBody Component Enhancement
**File: `src/engine/components.ts`**

#### Complete Collision Shape Implementation
```typescript
export class RigidBody extends Component {
    // ... existing properties ...

    public colliderType: 'sphere' | 'box' | 'plane';
    public colliderExtents: Vector3; // Half-extents for box, normal for plane, {radius,0,0} for sphere

    constructor(
        mass: number = 1.0,
        useGravity: boolean = true,
        colliderType: 'sphere' | 'box' | 'plane' = 'sphere',
        colliderSize: Vector3 = { x: 1, y: 1, z: 1 }
    ) {
        super();
        this.mass = mass;
        this.velocity = { x: 0, y: 0, z: 0 };
        this.isKinematic = false;
        this.useGravity = useGravity;
        this.colliderType = colliderType;

        // Convert size to extents based on collider type
        this.colliderExtents = this.calculateExtents(colliderType, colliderSize);
    }

    private calculateExtents(type: 'sphere' | 'box' | 'plane', size: Vector3): Vector3 {
        switch (type) {
            case 'sphere': return { x: size.x, y: 0, z: 0 }; // radius in x component
            case 'box': return { x: size.x * 0.5, y: size.y * 0.5, z: size.z * 0.5 }; // half-extents
            case 'plane': return { x: size.x, y: size.y, z: size.z }; // normal vector (should be normalized)
            default: return { x: 1, y: 0, z: 0 };
        }
    }

    // Set collision shape with automatic extent calculation
    public setCollisionShape(type: 'sphere' | 'box' | 'plane', size: Vector3): void {
        this.colliderType = type;
        this.colliderExtents = this.calculateExtents(type, size);

        // Update WASM if already initialized
        if (this.physicsBridge && this.wasmEntityId !== undefined) {
            this.syncCollisionShapeToWasm();
        }
    }

    private syncCollisionShapeToWasm(): void {
        // Update WASM collision shape through physics bridge
        if (this.physicsBridge && this.wasmEntityId !== undefined) {
            const shapeId = this.colliderType === 'sphere' ? 0 : this.colliderType === 'box' ? 1 : 2;
            this.physicsBridge.setEntityCollisionShape(this.wasmEntityId, shapeId, this.colliderExtents);
        }
    }
}
```

### 3.2 Scene System Integration
**File: `src/engine/scene-system.ts`**

#### Automatic Collision Shape Detection
```typescript
public createGameObject(name: string, options: GameObjectOptions = {}): GameObject {
    const gameObject = new GameObject(name, options.transform);

    // Auto-detect collision shape from mesh renderer
    if (options.meshRenderer) {
        const meshId = options.meshRenderer.meshId;
        let autoColliderType: 'sphere' | 'box' = 'sphere';

        if (meshId.includes('cube') || meshId.includes('box')) {
            autoColliderType = 'box';
        } else if (meshId.includes('sphere') || meshId.includes('ball')) {
            autoColliderType = 'sphere';
        }

        // Apply auto-detected collision shape to RigidBody if present
        if (options.rigidBody && !options.rigidBody.colliderType) {
            options.rigidBody.colliderType = autoColliderType;
        }
    }

    // ... rest of GameObject creation ...
}
```

### 3.3 Physics Bridge Integration
**File: `src/engine/wasm-physics-bridge.ts`**

#### Collision Shape Support
```typescript
public addEntity(gameObject: GameObject): number | null {
    // ... existing entity creation logic ...

    const rigidBody = gameObject.getComponent(RigidBody);
    if (rigidBody) {
        // Determine collision shape ID
        const shapeId = rigidBody.colliderType === 'sphere' ? 0 :
                       rigidBody.colliderType === 'box' ? 1 : 2;

        // Use enhanced WASM API with collision shape
        wasmEntityId = this.wasm.spawn_entity_with_collider(
            transform.position.x, transform.position.y, transform.position.z,
            shapeId,
            rigidBody.colliderExtents.x, rigidBody.colliderExtents.y, rigidBody.colliderExtents.z,
            meshIndex
        );
    }

    // ... rest of method ...
}

// New collision shape configuration method
public setEntityCollisionShape(entityId: number, shapeId: number, extents: Vector3): void {
    if (this.wasm) {
        this.wasm.set_entity_collision_shape(entityId, shapeId, extents.x, extents.y, extents.z);
    }
}
```

## Phase 4: Comprehensive Unit Testing

### 4.1 Zig Unit Tests
**File: `src/core/box_collision_test.zig`** (new)

#### Box-Box Collision Tests
```zig
test "box-box collision - face contact" {
    // Two boxes touching face-to-face
    // Verify collision detection and normal calculation
}

test "box-box collision - edge contact" {
    // Two boxes colliding at edges
    // Test edge-case collision detection
}

test "box-box collision - corner contact" {
    // Two boxes touching at corners
    // Verify corner collision handling
}

test "box-box collision - no collision" {
    // Two boxes clearly separated
    // Ensure no false positives
}
```

#### Sphere-Box Collision Tests
```zig
test "sphere-box collision - sphere hits face" {
    // Sphere colliding with box face (simple case)
}

test "sphere-box collision - sphere hits edge" {
    // Sphere colliding with box edge
    // Test edge collision detection
}

test "sphere-box collision - sphere hits corner" {
    // Sphere colliding with box corner
    // Most complex case - point contact
}

test "sphere-box collision - sphere inside box" {
    // Edge case: sphere center inside box
    // Verify proper separation and normal calculation
}
```

#### Mixed Collision Integration Tests
```zig
test "integration: box stacking with gravity" {
    // Create stack of boxes with gravity
    // Verify stable stacking behavior
}

test "integration: sphere vs box platform" {
    // Sphere falling onto box platform
    // Test kinematic platform behavior
}

test "integration: mixed collision performance" {
    // Large number of mixed collision entities
    // Performance and stability validation
}
```

### 4.2 TypeScript Integration Tests
**File: `tests/box-collision.test.ts`** (new)

#### Component Integration Tests
```typescript
describe('RigidBody Box Collider', () => {
    test('should create box collider with correct extents', () => {
        const rigidBody = new RigidBody(1.0, true, 'box', { x: 2, y: 4, z: 6 });
        expect(rigidBody.colliderExtents).toEqual({ x: 1, y: 2, z: 3 }); // Half-extents
    });

    test('should auto-detect collision shape from mesh', () => {
        // Test scene system auto-detection logic
    });

    test('should sync collision shape changes to WASM', () => {
        // Test WASM synchronization
    });
});
```

#### Scene Integration Tests
```typescript
describe('Box Collision Scenes', () => {
    test('should create stable box stack', () => {
        // Create scene with stacked boxes
        // Verify physics stability
    });

    test('should handle mixed collision types', () => {
        // Scene with spheres and boxes
        // Verify all collision combinations work
    });
});
```

### 4.3 Performance Testing
```typescript
describe('Box Collision Performance', () => {
    test('should maintain 60fps with 100+ mixed entities', () => {
        // Performance benchmark test
        // Compare against sphere-only baseline
    });

    test('should scale collision detection efficiently', () => {
        // Test O(n²) scaling behavior
        // Verify no performance regression
    });
});
```

## Phase 5: Demo Scenes & Validation

### 5.1 Box Collision Demo Scenes
**Directory: `src/scenes/box-collision/`** (new)

#### Cube Tower Scene (`cube-tower.ts`)
```typescript
export class CubeCollisionScene extends Scene {
    async setup(): Promise<void> {
        // Create stack of 10 cubes with box colliders
        for (let i = 0; i < 10; i++) {
            const cube = this.createGameObject(`Cube_${i}`, {
                transform: new Transform({ x: 0, y: i * 2.1, z: 0 }),
                meshRenderer: new MeshRenderer('cube', 'default', 'lines'),
                rigidBody: new RigidBody(1.0, true, 'box', { x: 2, y: 2, z: 2 })
            });

            if (i === 0) {
                // Bottom cube is kinematic platform
                cube.getComponent(RigidBody).setKinematic(true);
            }
        }

        // Add physics wrecking ball
        const wreckingBall = this.createGameObject('WreckingBall', {
            transform: new Transform({ x: 5, y: 10, z: 0 }),
            meshRenderer: new MeshRenderer('sphere', 'default', 'lines'),
            rigidBody: new RigidBody(5.0, true, 'sphere', { x: 1.5, y: 0, z: 0 })
        });

        // Apply initial force to wrecking ball
        setTimeout(() => {
            wreckingBall.getComponent(RigidBody).applyForce(-50, 0, 0);
        }, 1000);
    }
}
```

#### Mixed Physics Playground (`mixed-physics.ts`)
```typescript
export class MixedPhysicsScene extends Scene {
    async setup(): Promise<void> {
        // Create box platforms at different heights
        this.createBoxPlatform(0, -2, 0, 8, 1, 8, true);  // Ground
        this.createBoxPlatform(-3, 2, 0, 4, 1, 4, true);  // Left platform
        this.createBoxPlatform(3, 4, 0, 4, 1, 4, true);   // Right platform

        // Add bouncing spheres
        for (let i = 0; i < 10; i++) {
            this.createBouncingSphere(
                (Math.random() - 0.5) * 10,  // Random X
                10 + i * 2,                  // Stacked Y
                (Math.random() - 0.5) * 10   // Random Z
            );
        }

        // Add dynamic boxes for complexity
        for (let i = 0; i < 5; i++) {
            this.createDynamicBox(
                (Math.random() - 0.5) * 6,
                8 + i * 3,
                (Math.random() - 0.5) * 6
            );
        }
    }

    private createBoxPlatform(x: number, y: number, z: number, w: number, h: number, d: number, kinematic: boolean): GameObject {
        return this.createGameObject(`Platform_${x}_${y}_${z}`, {
            transform: new Transform({ x, y, z }),
            meshRenderer: new MeshRenderer('cube', 'default', 'lines'),
            rigidBody: new RigidBody(kinematic ? 0 : 10, true, 'box', { x: w, y: h, z: d })
        });
    }
}
```

#### Performance Stress Test (`collision-stress.ts`)
```typescript
export class CollisionStressTestScene extends Scene {
    async setup(): Promise<void> {
        // Test performance with large numbers of mixed collision entities
        const entityCounts = { spheres: 200, boxes: 200, total: 400 };

        // Create collision test arena
        this.createArena();

        // Spawn entities in batches to test performance scaling
        await this.spawnEntitiesInBatches(entityCounts);

        // Performance monitoring
        this.startPerformanceMonitoring();
    }

    private async spawnEntitiesInBatches(counts: { spheres: number, boxes: number }): Promise<void> {
        const batchSize = 50;
        let spawned = { spheres: 0, boxes: 0 };

        while (spawned.spheres < counts.spheres || spawned.boxes < counts.boxes) {
            // Spawn batch of spheres
            for (let i = 0; i < Math.min(batchSize, counts.spheres - spawned.spheres); i++) {
                this.spawnRandomSphere();
                spawned.spheres++;
            }

            // Spawn batch of boxes
            for (let i = 0; i < Math.min(batchSize, counts.boxes - spawned.boxes); i++) {
                this.spawnRandomBox();
                spawned.boxes++;
            }

            // Wait a frame between batches
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    }
}
```

### 5.2 Visual Validation Tools

#### Collision Visualization
```typescript
export class CollisionDebugRenderer {
    public static renderCollisionShapes(scene: Scene, camera: any): void {
        // Render collision bounds for all entities
        // Different colors for different collision shapes
        // Show collision normals and contact points
    }

    public static renderCollisionEvents(events: CollisionEvent[]): void {
        // Visualize collision events with particle effects
        // Show collision intensity with color/size
    }
}
```

## Phase 6: Plane Collider Preparation

### 6.1 Plane Mathematics Foundation
**File: `src/core/game_core.zig`**

#### Plane Collision Functions
```zig
/// Check collision between sphere and infinite plane
pub fn checkSpherePlaneCollision(sphere_pos: Vec3, radius: f32, plane_pos: Vec3, plane_normal: Vec3) ?CollisionInfo {
    // Calculate distance from sphere center to plane
    const distance_to_plane = dot(vec3_subtract(sphere_pos, plane_pos), plane_normal);

    // Check if sphere intersects plane
    if (@abs(distance_to_plane) <= radius) {
        return CollisionInfo{
            .has_collision = true,
            .penetration_depth = radius - @abs(distance_to_plane),
            .contact_normal = if (distance_to_plane < 0) vec3_negate(plane_normal) else plane_normal,
            .contact_point = vec3_add(sphere_pos, vec3_scale(plane_normal, -distance_to_plane)),
        };
    }

    return null;
}

/// Check collision between box and infinite plane
pub fn checkBoxPlaneCollision(box_pos: Vec3, box_extents: Vec3, plane_pos: Vec3, plane_normal: Vec3) ?CollisionInfo {
    // Calculate box projection onto plane normal
    const projection_radius = @abs(box_extents.x * plane_normal.x) +
                             @abs(box_extents.y * plane_normal.y) +
                             @abs(box_extents.z * plane_normal.z);

    // Distance from box center to plane
    const distance_to_plane = dot(vec3_subtract(box_pos, plane_pos), plane_normal);

    // Check collision
    if (@abs(distance_to_plane) <= projection_radius) {
        // Calculate penetration and contact info
        // Return collision information
    }

    return null;
}
```

### 6.2 Plane Component Architecture
**File: `src/engine/components.ts`**

#### PlaneCollider Component (Future)
```typescript
export class PlaneCollider extends Component {
    public normal: Vector3;        // Plane normal vector (should be normalized)
    public distance: number;       // Distance from origin along normal
    public isInfinite: boolean;    // Infinite plane vs bounded plane
    public bounds?: Vector3;       // For bounded planes: width, height, unused

    constructor(
        normal: Vector3 = { x: 0, y: 1, z: 0 },  // Default: horizontal plane (floor)
        distance: number = 0,
        isInfinite: boolean = true,
        bounds?: Vector3
    ) {
        super();
        this.normal = this.normalizeVector(normal);
        this.distance = distance;
        this.isInfinite = isInfinite;
        this.bounds = bounds;
    }

    private normalizeVector(v: Vector3): Vector3 {
        const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        return {
            x: v.x / length,
            y: v.y / length,
            z: v.z / length
        };
    }

    // Calculate plane position from normal and distance
    public getPlanePosition(): Vector3 {
        return {
            x: this.normal.x * this.distance,
            y: this.normal.y * this.distance,
            z: this.normal.z * this.distance
        };
    }

    // Set plane from position and normal
    public setPlaneFromPoint(point: Vector3, normal: Vector3): void {
        this.normal = this.normalizeVector(normal);
        this.distance = point.x * this.normal.x + point.y * this.normal.y + point.z * this.normal.z;
    }
}
```

### 6.3 Plane Use Cases
- **Ground Planes**: Infinite ground collision
- **Wall Planes**: Room boundaries and walls
- **Platform Edges**: Finite platform collision bounds
- **Trigger Planes**: Invisible barriers and triggers
- **Clipping Planes**: Frustum culling and visibility

## Future Enhancement: Collision Callbacks

### Overview
After the core box/plane collision system is implemented, collision callbacks will provide rich event-driven collision handling for game logic, effects, and interactions.

### Architecture Design

#### Collision Event System (WASM)
**File: `src/core/game_engine.zig`**

```zig
// Collision pair tracking for enter/stay/exit events
const MAX_COLLISION_PAIRS = 1000;
const CollisionPair = struct {
    entity1_id: u32,
    entity2_id: u32,
    frame_first_detected: u32,
    frame_last_detected: u32,
    is_active: bool,
    collision_type: u8, // 0=enter, 1=stay, 2=exit
};

var collision_pairs: [MAX_COLLISION_PAIRS]CollisionPair = undefined;
var collision_pair_count: u32 = 0;
var current_frame: u32 = 0;

// Event processing and WASM exports
pub export fn get_collision_events_count() u32
pub export fn get_collision_event(index: u32, event_type: *u8, entity1: *u32, entity2: *u32) bool
pub export fn clear_collision_events() void
```

#### TypeScript Callback System
**File: `src/engine/collision-events.ts`** (new)

```typescript
export type CollisionEventType = 'enter' | 'stay' | 'exit';

export interface CollisionEvent {
    type: CollisionEventType;
    self: GameObject;
    other: GameObject;
    contactPoint?: Vector3;
    contactNormal?: Vector3;
    penetrationDepth?: number;
}

export type CollisionCallback = (event: CollisionEvent) => void;

export class CollisionEventManager {
    private callbacks = new Map<string, CollisionCallback[]>();
    private physicsBridge: WasmPhysicsBridge;

    constructor(bridge: WasmPhysicsBridge) {
        this.physicsBridge = bridge;
    }

    public registerCallback(gameObjectId: string, callback: CollisionCallback): void {
        if (!this.callbacks.has(gameObjectId)) {
            this.callbacks.set(gameObjectId, []);
        }
        this.callbacks.get(gameObjectId)!.push(callback);
    }

    public processCollisionEvents(): void {
        // Read collision events from WASM
        // Create CollisionEvent objects
        // Invoke registered callbacks
    }
}
```

#### RigidBody Integration
**Enhanced `src/engine/components.ts`**

```typescript
export class RigidBody extends Component {
    // ... existing properties ...

    // Collision event callbacks
    public onCollisionEnter?: (other: GameObject, contact?: CollisionContact) => void;
    public onCollisionStay?: (other: GameObject, contact?: CollisionContact) => void;
    public onCollisionExit?: (other: GameObject) => void;

    // Collision filtering
    public collisionLayers: number = 1;           // Bitmask: what layer this object is on
    public collisionMask: number = 0xFFFFFFFF;    // Bitmask: what layers this can collide with

    // Callback registration (automatic)
    override awake(): void {
        // Register collision callbacks with event manager
        if (this.onCollisionEnter || this.onCollisionStay || this.onCollisionExit) {
            this.registerCollisionCallbacks();
        }
    }

    private registerCollisionCallbacks(): void {
        const eventManager = this.gameObject.scene?.collisionEventManager;
        if (eventManager) {
            eventManager.registerCallback(this.gameObject.id, (event) => {
                switch (event.type) {
                    case 'enter':
                        this.onCollisionEnter?.(event.other, event);
                        break;
                    case 'stay':
                        this.onCollisionStay?.(event.other, event);
                        break;
                    case 'exit':
                        this.onCollisionExit?.(event.other);
                        break;
                }
            });
        }
    }
}
```

### Callback Use Cases

#### Game Mechanics
```typescript
// Damage system
const enemyRigidBody = enemy.getComponent(RigidBody);
enemyRigidBody.onCollisionEnter = (other) => {
    if (other.name.includes('Projectile')) {
        enemy.getComponent(Health).takeDamage(10);
        other.destroy(); // Remove projectile
    }
};

// Pickup system
const pickupRigidBody = pickup.getComponent(RigidBody);
pickupRigidBody.onCollisionEnter = (other) => {
    if (other.name === 'Player') {
        player.getComponent(Inventory).addItem(pickup.itemType);
        pickup.destroy();
    }
};
```

#### Audio/Visual Effects
```typescript
// Impact sound effects
const boxRigidBody = box.getComponent(RigidBody);
boxRigidBody.onCollisionEnter = (other, contact) => {
    const impactForce = calculateImpactForce(contact);
    if (impactForce > 5.0) {
        AudioManager.playSound('box_impact', impactForce * 0.1); // Volume based on force
        ParticleSystem.emit('dust', contact.contactPoint, 20);
    }
};

// Continuous effects
boxRigidBody.onCollisionStay = (other, contact) => {
    if (other.name.includes('Fire')) {
        // Burning effect while in contact
        ParticleSystem.emit('smoke', contact.contactPoint, 5);
    }
};
```

#### Trigger Systems
```typescript
// Pressure plates
const plateRigidBody = pressurePlate.getComponent(RigidBody);
plateRigidBody.collisionLayers = CollisionLayers.TRIGGER;
plateRigidBody.onCollisionEnter = (other) => {
    if (other.getComponent(RigidBody)?.mass >= 5.0) {
        triggerSystem.activatePlate(pressurePlate.id);
    }
};
plateRigidBody.onCollisionExit = (other) => {
    triggerSystem.deactivatePlate(pressurePlate.id);
};
```

### Implementation Timeline

1. **Phase 1-6**: Complete core box/plane collision system
2. **Phase 7**: Implement collision pair tracking in WASM
3. **Phase 8**: Build TypeScript event management system
4. **Phase 9**: Integrate callbacks with RigidBody component
5. **Phase 10**: Create demo scenes showcasing collision callbacks
6. **Phase 11**: Performance optimization and collision filtering

### Benefits of Collision Callbacks

- **Rich Game Logic**: Enable complex interaction behaviors
- **Modular Design**: Clean separation between physics and game logic
- **Performance**: Only process events for objects that need them
- **Debugging**: Enhanced collision visualization and logging
- **Extensibility**: Foundation for advanced features (triggers, sensors, damage systems)

## Success Criteria

### ✅ Core Implementation Success (Phases 1-3)
- **All Collision Combinations**: sphere-sphere ✅, box-box ✅, sphere-box ✅
- **WASM Integration**: Collision shape configuration through WASM API
- **TypeScript Components**: RigidBody supports all collision shapes seamlessly
- **Performance**: Zero regression from sphere-only baseline (6,598+ entities at 60fps)

### ✅ Testing & Validation Success (Phases 4-5)
- **Comprehensive Testing**: 15+ unit tests covering all collision types
- **Integration Tests**: TypeScript scene tests with mixed collision types
- **Visual Validation**: Browser-based collision accuracy verification
- **Performance Testing**: 1000+ mixed entities maintaining 60fps target

### ✅ Production Ready (Phase 6)
- **Demo Scenes**: Cube stacking, mixed physics playground, performance stress test
- **Edge Case Handling**: Corner/edge collisions, degenerate cases, floating point precision
- **Plane Foundation**: Architecture ready for future plane collider implementation
- **Documentation**: Complete usage guide and API reference

### ✅ Future Enhancement Ready (Collision Callbacks)
- **Event Architecture**: Scalable collision event system design
- **Callback Integration**: Seamless RigidBody callback registration
- **Performance Considerations**: Minimal overhead for unused callbacks
- **Rich Game Logic**: Foundation for damage, triggers, effects, and interactions

## Implementation Notes

### Development Order
1. **Mathematics First**: Implement and test collision algorithms in isolation
2. **WASM Integration**: Extend collision loop and exports for new shapes
3. **TypeScript Bridge**: Connect RigidBody component to new collision system
4. **Comprehensive Testing**: Unit → integration → visual → performance testing
5. **Demo Scenes**: Prove real-world collision scenarios work correctly
6. **Collision Callbacks**: Rich event system as separate enhancement phase

### Quality Assurance Requirements
- **All existing tests must pass**: No regression in 38+ current tests
- **New collision tests must achieve 100% coverage**: All collision type combinations
- **Performance benchmarking**: Measure and document performance characteristics
- **Visual browser testing**: Manual verification of collision accuracy
- **Code review**: Architecture review before major integration phases

### Risk Mitigation
- **Incremental Implementation**: Build on proven sphere collision foundation
- **Extensive Testing**: Catch issues early with comprehensive test coverage
- **Performance Monitoring**: Continuous performance validation during development
- **Fallback Strategy**: Maintain sphere collision as fallback for complex cases

This plan provides a comprehensive roadmap for implementing box and plane colliders while maintaining the high quality and performance standards of the existing physics system. The collision callback system adds significant value as a future enhancement that builds naturally on the core collision detection foundation.