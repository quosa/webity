# Renderer V2 Integration Plan

## Overview

This document outlines the integration strategy for merging the v2 WebGPU renderer with the existing WASM physics engine, creating a unified architecture that combines the best of both systems while maintaining clean separation of concerns.

## References

- **Base Architecture**: [GAME_ENGINE_PLAN.md](../GAME_ENGINE_PLAN.md) - Phases 1-7.75 provide the foundation
- **Renderer Foundation**: [webgpu-refactor-plan.md](webgpu-refactor-plan.md) - V2 renderer architecture (completed)
- **Performance Baseline**: 6,598+ entities at 60fps with proven WebGPU efficiency

## Integration Philosophy

**Core Principle**: WASM handles physics/collisions, TypeScript handles rendering/scene management

- **WASM Layer**: Simplified to physics simulation, collision detection, and transform calculations
- **TypeScript Layer**: Scene graph, entity management, camera control, and WebGPU rendering
- **Buffer Strategy**: Separate f32 vertex + u16 index buffers (simpler than mega-buffer for dynamic content)

---

## Data Structure Architecture

### CPU/TypeScript Layer

```typescript
// Primary Scene Management
class Scene {
  private entities = new Map<string, GameObject>();
  camera: Camera;
  
  // Safe GameObject management
  getGameObject(id: string): GameObject | null {
    return this.entities.get(id) || null;
  }
  
  addGameObject(gameObject: GameObject): void {
    this.entities.set(gameObject.id, gameObject);
  }
  
  removeGameObject(id: string): boolean {
    const gameObject = this.entities.get(id);
    if (!gameObject) return false;
    
    // Clean up hierarchy references
    if (gameObject.parentId) {
      const parent = this.getGameObject(gameObject.parentId);
      parent?.removeChild(id);
    }
    
    // Remove all children (recursively)
    for (const childId of [...gameObject.childIds]) {
      this.removeGameObject(childId);
    }
    
    // Remove from WASM physics if it has RigidBody
    const rigidBody = gameObject.getComponent(RigidBody);
    if (rigidBody) {
      this.wasm.physics_remove_entity(gameObject.id);
    }
    
    // Remove from scene
    this.entities.delete(id);
    return true;
  }
  
  // Lifecycle methods
  awake(): void;
  start(): void;
  update(deltaTime: number): void;
  render(): void;
}

// Entity Component System
class GameObject {
  id: string;
  transform: Transform;
  components: Component[];
  
  // ID-based references (safe for deletion/serialization)
  childIds: string[] = [];
  parentId?: string;
  
  // Convenience accessors (require scene context)
  getParent(scene: Scene): GameObject | null {
    return this.parentId ? scene.getGameObject(this.parentId) : null;
  }
  
  getChildren(scene: Scene): GameObject[] {
    return this.childIds.map(id => scene.getGameObject(id)).filter(obj => obj !== null);
  }
  
  // Safe hierarchy operations
  addChild(scene: Scene, child: GameObject): void {
    if (child.parentId) {
      // Remove from previous parent
      const oldParent = scene.getGameObject(child.parentId);
      oldParent?.removeChild(child.id);
    }
    
    child.parentId = this.id;
    if (!this.childIds.includes(child.id)) {
      this.childIds.push(child.id);
    }
  }
  
  removeChild(childId: string): void {
    const index = this.childIds.indexOf(childId);
    if (index >= 0) {
      this.childIds.splice(index, 1);
    }
  }
}

// Core Components
interface Transform {
  position: Vector3;
  rotation: Vector3; // Euler angles
  scale: Vector3;
  
  // Computed matrix (local transform only)
  getLocalMatrix(): Float32Array;
}

interface MeshRenderer extends Component {
  meshId: string;
  materialId: string;
  renderMode: 'triangles' | 'lines';
}

interface RigidBody extends Component {
  mass: number;
  velocity: Vector3;
  isKinematic: boolean; // If true: no physics forces applied, can be moved manually
  
  // Physics shape
  colliderType: 'sphere' | 'box';
  colliderSize: Vector3;
}

// Camera System (Extended from v2/camera.ts)
abstract class BaseCamera {
  protected position: Vector3;
  protected target: Vector3;
  protected up: Vector3;
  protected near: number;
  protected far: number;
  
  abstract getProjectionMatrix(aspect: number): Float32Array;
  getViewProjectionMatrix(aspect: number): Float32Array; // Combined matrix for GPU
}

class Camera extends BaseCamera {
  private fov: number; // Perspective camera
}

class OrthographicCamera extends BaseCamera {
  private bounds: { left: number; right: number; top: number; bottom: number };
}
```

### CPU/WASM/Zig Layer

```zig
// WASM Master Data Structures (Zero-Copy Source of Truth)
const WasmEntity = struct {
    id: u32,
    transform_matrix: [16]f32,  // 4x4 world transform (for GPU)
    position: Vec3,             // Physics position  
    velocity: Vec3,             // Physics velocity
    mass: f32,                  // Physics mass
    radius: f32,                // Collision radius
    mesh_id: u32,               // Mesh type identifier
    material_id: u32,           // Material/color identifier
    active: bool,               // Entity active flag
    is_kinematic: bool,         // Physics behavior
};

// Static mesh data (uploaded once, indexed by mesh_id)
const MeshData = struct {
    vertex_offset: u32,         // Offset in shared vertex buffer
    vertex_count: u32,          // Number of vertices
    index_offset: u32,          // Offset in shared index buffer  
    index_count: u32,           // Number of indices
};

// Camera state (for view matrix calculation)
var camera_position: Vec3 = .{ .x = 0, .y = 0, .z = -10 };
var camera_target: Vec3 = .{ .x = 0, .y = 0, .z = 0 };
var camera_up: Vec3 = .{ .x = 0, .y = 1, .z = 0 };

// Master entity array (mapped to GPU instance buffer)
var entities: [MAX_ENTITIES]WasmEntity = undefined;
var entity_count: u32 = 0;

// WASM Exports (Master Data Management + Physics)
export fn init() void;
export fn update(delta_time: f32) void;

// Entity lifecycle
export fn add_entity(id: u32, x: f32, y: f32, z: f32, mesh_id: u32, material_id: u32, mass: f32, is_kinematic: bool) void;
export fn remove_entity(id: u32) void;
export fn get_entity_count() u32;

// Zero-copy buffer access for GPU
export fn get_entity_transforms_offset() u32;  // Direct pointer to transform matrices
export fn get_entity_metadata_offset() u32;    // Direct pointer to mesh/material IDs
export fn get_mesh_batches_offset() u32;       // Batched rendering data

// Physics interaction
export fn apply_force(id: u32, fx: f32, fy: f32, fz: f32) void;

// Camera control
export fn set_camera_position(x: f32, y: f32, z: f32) void;
export fn set_camera_target(x: f32, y: f32, z: f32) void;
export fn get_view_projection_matrix_offset() u32; // Camera matrix for GPU uniform buffer
```

### GPU/WebGPU Layer

```typescript
// Zero-Copy Buffer Architecture
class GPUBufferManager {
  private sharedVertexBuffer: GPUBuffer;  // Single f32 buffer for all mesh vertices
  private sharedIndexBuffer: GPUBuffer;   // Single u16 buffer for all mesh indices
  private instanceBuffer: GPUBuffer;      // Mapped from WASM instance data
  private uniformBuffer: GPUBuffer;       // Camera view-projection matrix
  
  // Mesh allocation tracking
  interface MeshAllocation {
    vertexOffset: number;    // Byte offset in shared vertex buffer
    vertexCount: number;     // Number of vertices
    indexOffset: number;     // Byte offset in shared index buffer  
    indexCount: number;      // Number of indices
  }
  
  // Instance data mapped directly from WASM memory
  interface InstanceData {
    transform: Float32Array; // 16 floats - mapped from WASM entity transforms
    color: Float32Array;     // 4 floats - from MeshRenderer component
    meshId: number;          // Mesh type identifier
  }
}
```

---

## Zero-Copy Per-Frame Update Flow

### Reverse-Engineered Data Flow (GPU ← WASM ← TypeScript)

```
GPU Buffers (What we need):
├─ Shared Vertex Buffer: f32[] (all mesh geometry)
├─ Shared Index Buffer: u16[] (all mesh indices)  
├─ Instance Buffer: [transform: mat4x4, color: vec4, meshId: u32][] 
└─ Uniform Buffer: [viewProjectionMatrix: mat4x4]

↑ Mapped from ↑

WASM Buffers (Master data):
├─ Static Mesh Data: Pre-uploaded vertex/index data
├─ Entity Transform Array: [mat4x4] (physics-calculated world matrices)
├─ Entity Metadata: [meshId, materialId, active] per entity
└─ Camera State: position, target (for view matrix calculation)

↑ Updated by ↑

TypeScript (Minimal coordination):
├─ Component changes → WASM entity updates (spawn/destroy)
├─ Input events → WASM force application  
├─ Camera controls → WASM camera state
└─ Render call → GPU buffer sync + draw commands
```

### Detailed Per-Frame Flow (Zero-Copy Focus)

```typescript
// Scene.update() - Minimal TypeScript coordination  
update(deltaTime: number): void {
    // 1. Apply input to WASM (forces, camera movement)
    this.inputManager.applyToWasm(this.wasm);
    
    // 2. Run physics simulation in WASM (master data updated automatically)
    this.wasm.update(deltaTime);
    
    // 3. Render with zero-copy buffer access (WASM buffers → GPU directly)
    this.renderer.render(); // No data copying, just GPU commands
}

// GPUBufferManager - Pure buffer management (no rendering)
class GPUBufferManager {
    private sharedVertexBuffer: GPUBuffer;
    private sharedIndexBuffer: GPUBuffer;
    private instanceBuffer: GPUBuffer;
    private meshAllocations = new Map<string, MeshAllocation>();
    
    // Buffer operations only
    registerMesh(meshId: string, meshData: MeshData): void {
        // Calculate allocation and upload to shared buffers
        const allocation = this.calculateAllocation(meshId, meshData);
        this.uploadMeshData(allocation, meshData);
        this.meshAllocations.set(meshId, allocation);
    }
    
    mapInstanceDataFromWasm(wasmMemory: ArrayBuffer, offset: number, count: number): void {
        // Direct zero-copy mapping from WASM entity transforms
        const wasmTransforms = new Float32Array(wasmMemory, offset, count * 20); // 16 + 4 floats per instance
        this.device.queue.writeBuffer(this.instanceBuffer, 0, wasmTransforms);
    }
    
    // Accessor methods for renderer
    getMeshAllocation(meshId: string): MeshAllocation | undefined;
    getSharedVertexBuffer(): GPUBuffer;
    getSharedIndexBuffer(): GPUBuffer; 
    getInstanceBuffer(): GPUBuffer;
}

// WebGPURendererV2 - Rendering logic (enhanced for zero-copy)
class WebGPURendererV2 {
    private bufferManager!: GPUBufferManager; // Replaced MegaBufferManager
    
    render(): void {
        // 1. Map fresh WASM data to GPU instance buffer
        this.bufferManager.mapInstanceDataFromWasm(
            this.wasm.memory.buffer,
            this.wasm.get_entity_transforms_offset(),
            this.wasm.get_entity_count()
        );
        
        // 2. Existing render pipeline (minimal changes)
        const commandEncoder = this.device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({...});
        
        // 3. Render with enhanced buffer access
        this.renderEntities(renderPass, this.renderPipeline, triangleEntities);
        this.renderEntities(renderPass, this.linePipeline, lineEntities);
        
        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }
    
    private renderEntities(renderPass: GPURenderPassEncoder, pipeline: GPURenderPipeline, entities: Entity[]): void {
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        
        // Group by mesh and render with shared buffers + offsets
        for (const [meshId, instances] of this.groupByMesh(entities)) {
            const allocation = this.bufferManager.getMeshAllocation(meshId);
            if (!allocation) continue;
            
            // Use shared buffers with calculated offsets
            renderPass.setVertexBuffer(0, this.bufferManager.getSharedVertexBuffer(), allocation.vertexOffset);
            renderPass.setIndexBuffer(this.bufferManager.getSharedIndexBuffer(), 'uint16', allocation.indexOffset);
            renderPass.setVertexBuffer(1, this.bufferManager.getInstanceBuffer(), instanceOffset);
            renderPass.drawIndexed(allocation.indexCount, instances.length);
        }
    }
}
```

### Detailed Per-Frame Code Flow

```typescript
// Scene.update() - Streamlined zero-copy approach
update(deltaTime: number): void {
    // 1. Update GameObjects (component logic only)
    for (const gameObject of this.entities.values()) {
        gameObject.update(deltaTime);
    }
    
    // 2. Apply input forces to WASM entities
    this.inputManager.applyToWasm(this.wasm);
    
    // 3. Run physics simulation (WASM updates its own transform matrices)
    this.wasm.update(deltaTime);
    
    // 4. Render frame (GPU reads WASM buffers directly)
    this.render();
}

// WasmBridge - Minimal coordination (no data copying)
class WasmBridge {
    addEntity(gameObject: GameObject): void {
        const rigidBody = gameObject.getComponent(RigidBody);
        const transform = gameObject.transform;
        const meshRenderer = gameObject.getComponent(MeshRenderer);
        
        // One-time entity creation in WASM
        this.wasm.add_entity(
            gameObject.id,
            transform.position.x, transform.position.y, transform.position.z,
            this.getMeshId(meshRenderer.meshId), // Convert to WASM mesh ID
            this.getMaterialId(meshRenderer.materialId), // Convert to WASM material ID
            rigidBody.mass,
            rigidBody.isKinematic
        );
    }
    
    removeEntity(gameObjectId: string): void {
        this.wasm.remove_entity(gameObjectId);
    }
    
    // No sync methods needed - WASM is master data source!
}
```

---

## End-User Interface Design

### Simple Scene Creation API

```typescript
// Example: Creating a simple physics scene
async function createPhysicsScene(): Promise<Scene> {
    const scene = new Scene();
    
    // Setup camera
    scene.camera = new Camera(
        new Vector3(0, 5, -10), // position
        new Vector3(0, 0, 0),   // target
        60 // fov
    );
    
    // Create floor grid (static, generated mesh)
    const floor = new GameObject('floor');
    floor.transform.position = new Vector3(0, -5, 0);
    floor.addComponent(new MeshRenderer('grid-20x20', 'default', 'lines')); // Grid is always 1x1, size in mesh
    // No RigidBody = static geometry
    scene.addGameObject(floor);
    
    // Create bouncing ball (dynamic physics)
    const ball = new GameObject('ball');
    ball.transform.position = new Vector3(0, 5, 0);
    ball.addComponent(new MeshRenderer('sphere', 'red', 'triangles'));
    ball.addComponent(new RigidBody(1.0, true)); // mass=1.0, useGravity=true
    scene.addGameObject(ball);
    
    // Create cube (dynamic physics)
    const cube = new GameObject('cube');
    cube.transform.position = new Vector3(2, 3, 0);
    cube.addComponent(new MeshRenderer('cube', 'blue', 'triangles'));
    cube.addComponent(new RigidBody(2.0, true)); // mass=2.0, useGravity=true
    scene.addGameObject(cube);
    
    // Initialize and start scene
    await scene.init();
    scene.start();
    
    return scene;
}

// Usage in main application
async function main() {
    const renderer = new WebGPURendererV2();
    await renderer.init(canvas);
    
    // Register basic mesh types (using mesh generators for precise sizes)
    renderer.registerMesh('sphere', createSphereMesh(1.0, 32)); // radius, segments
    renderer.registerMesh('cube', createCubeMesh(1.0));
    renderer.registerMesh('grid-20x20', createGridMesh(20, 20)); // 20x20 grid, 1x1 unit size
    
    const scene = await createPhysicsScene();
    
    // Game loop
    function gameLoop() {
        scene.update(deltaTime);
        requestAnimationFrame(gameLoop);
    }
    gameLoop();
}
```

### Component-Based Entity Configuration

```typescript
// More complex entity setup
const complexEntity = new GameObject('compound-object');

// Transform hierarchy
complexEntity.transform.position = new Vector3(0, 10, 0);

// Add multiple components
complexEntity.addComponent(new MeshRenderer('cube', 'metal', 'triangles'));
complexEntity.addComponent(new RigidBody(5.0, true));

// Child objects for compound shapes
const childSphere = new GameObject('child-sphere');
childSphere.transform.position = new Vector3(1, 1, 0); // Local offset
childSphere.addComponent(new MeshRenderer('sphere', 'glass', 'triangles'));
scene.addGameObject(childSphere); // Add to scene first
complexEntity.addChild(scene, childSphere); // Then establish hierarchy

// Custom component with behavior
class RotatorComponent extends Component {
    update(deltaTime: number): void {
        this.gameObject.transform.rotation.y += 90 * deltaTime; // 90 deg/sec
    }
}
complexEntity.addComponent(new RotatorComponent());
```

---

## Buffer Architecture Decision

### Separate Buffers (Recommended)

**Pros:**
- Simpler memory management (no reshuffling)
- Predictable per-mesh buffer sizes  
- Easy to debug and validate
- Less complexity in WASM ↔ WebGPU integration

**Cons:**
- More buffer bind operations per frame
- Slightly higher memory usage

### Implementation Strategy

```typescript
class GPUBufferManager {
    private sharedVertexBuffer: GPUBuffer;   // Single f32 buffer for all mesh vertices
    private sharedIndexBuffer: GPUBuffer;    // Single u16 buffer for all mesh indices
    private meshAllocations = new Map<string, MeshAllocation>(); // Track offsets/lengths
    
    registerMesh(meshId: string, meshData: MeshData): void {
        // Calculate allocation in shared buffers
        const allocation: MeshAllocation = {
            vertexOffset: this.currentVertexOffset,
            vertexCount: meshData.vertices.length / 3,
            indexOffset: this.currentIndexOffset, 
            indexCount: meshData.indices.length
        };
        
        // Upload to shared buffers at calculated offsets
        this.device.queue.writeBuffer(this.sharedVertexBuffer, allocation.vertexOffset * 4, meshData.vertices);
        this.device.queue.writeBuffer(this.sharedIndexBuffer, allocation.indexOffset * 2, meshData.indices);
        
        this.meshAllocations.set(meshId, allocation);
    }
    
    // Accessor methods for renderer
    getMeshAllocation(meshId: string): MeshAllocation | undefined {
        return this.meshAllocations.get(meshId);
    }
    
    getSharedVertexBuffer(): GPUBuffer { return this.sharedVertexBuffer; }
    getSharedIndexBuffer(): GPUBuffer { return this.sharedIndexBuffer; }
    getInstanceBuffer(): GPUBuffer { return this.instanceBuffer; }
}

// WebGPURendererV2 - Contains the rendering methods
class WebGPURendererV2 {
    private bufferManager!: GPUBufferManager;
    
    private renderMeshBatch(renderPass: GPURenderPassEncoder, meshId: string, instanceCount: number, instanceOffset: number): void {
        const allocation = this.bufferManager.getMeshAllocation(meshId);
        if (!allocation) return;
        
        // Use shared buffers with offsets
        renderPass.setVertexBuffer(0, this.bufferManager.getSharedVertexBuffer(), allocation.vertexOffset * 4);
        renderPass.setIndexBuffer(this.bufferManager.getSharedIndexBuffer(), 'uint16', allocation.indexOffset * 2);
        renderPass.setVertexBuffer(1, this.bufferManager.getInstanceBuffer(), instanceOffset * 80); // 80 bytes per instance
        renderPass.drawIndexed(allocation.indexCount, instanceCount);
    }
}
```

---

## Input System Integration

### Camera Controls & GameObject Interaction

```typescript
// InputManager - Centralized input handling
class InputManager {
    private keyState = new Map<string, boolean>();
    private camera: BaseCamera;
    private controlledEntity?: GameObject; // Optional entity control
    
    // Camera controls (WASD + mouse look)
    updateCamera(deltaTime: number): void {
        const moveSpeed = 10.0; // units per second
        const rotateSpeed = 90.0; // degrees per second
        
        let forward = 0, right = 0, up = 0;
        if (this.keyState.get('KeyW')) forward += 1;
        if (this.keyState.get('KeyS')) forward -= 1;
        if (this.keyState.get('KeyA')) right -= 1;
        if (this.keyState.get('KeyD')) right += 1;
        if (this.keyState.get('Space')) up += 1;
        if (this.keyState.get('ShiftLeft')) up -= 1;
        
        // Apply movement to camera (will be passed to WASM camera state)
        this.camera.move(forward * moveSpeed * deltaTime, right * moveSpeed * deltaTime, up * moveSpeed * deltaTime);
    }
    
    // GameObject control (Arrow keys for forces)
    updateControlledEntity(deltaTime: number): void {
        if (!this.controlledEntity) return;
        
        const forceStrength = 50.0;
        let fx = 0, fz = 0;
        if (this.keyState.get('ArrowUp')) fz -= forceStrength;
        if (this.keyState.get('ArrowDown')) fz += forceStrength; 
        if (this.keyState.get('ArrowLeft')) fx -= forceStrength;
        if (this.keyState.get('ArrowRight')) fx += forceStrength;
        
        // Apply force via WASM physics
        if (fx !== 0 || fz !== 0) {
            this.wasm.physics_apply_force(this.controlledEntity.id, fx, 0, fz);
        }
    }
    
    applyToWasm(wasm: WASMInterface): void {
        this.updateCamera(deltaTime);
        this.updateControlledEntity(deltaTime);
        
        // Sync camera state to WASM
        wasm.set_camera_position(this.camera.position.x, this.camera.position.y, this.camera.position.z);
        wasm.set_camera_target(this.camera.target.x, this.camera.target.y, this.camera.target.z);
    }
}

// Example: Controllable ball in scene
function createControllableScene(): Scene {
    const scene = new Scene();
    
    // Create controllable ball
    const ball = new GameObject('player-ball');
    ball.transform.position = new Vector3(0, 2, 0);
    ball.addComponent(new MeshRenderer('sphere', 'player', 'triangles'));
    ball.addComponent(new RigidBody(1.0, false)); // Not kinematic = physics forces apply
    scene.addGameObject(ball);
    
    // Set as controlled entity
    scene.inputManager.setControlledEntity(ball);
    
    return scene;
}
```

---

## Migration Timeline

### Phase 1: Zero-Copy Buffer Architecture (Week 1) ✅ COMPLETED
- [x] Create GPUBufferManager to replace MegaBufferManager (pure buffer management)
- [x] Implement shared vertex/index buffers with mesh allocation tracking
- [x] Add zero-copy WASM memory mapping methods to GPUBufferManager
- [x] Update WebGPURendererV2 to use GPUBufferManager (minimal render pipeline changes)
- [x] **CRITICAL: Extensive Testing** (see Testing Strategy below)
  - [x] Unit tests for buffer allocation and mesh registration (26 new tests added)
  - [x] Visual validation tests (triangle, cube, grid rendering confirmed working)
  - [x] Browser-based regression tests with MCP validation
  - [x] Performance baseline comparison (maintain 6,598+ entities at 60fps)
- [x] **Deliverable**: Clean buffer/renderer separation with WASM zero-copy integration
- [x] **Additional**: Fixed ES module compatibility issues (`__dirname` → `fileURLToPath(import.meta.url)`)
- [x] **Additional**: Cleaned up obsolete MegaBufferManager code and tests

### Phase 2: Scene System Foundation (Week 1-2)  
- [ ] Create Scene, GameObject, Component classes in src/v2/
- [ ] Implement Transform component with matrix calculations (local only)
- [ ] Add basic MeshRenderer component
- [ ] Create simple test scene with static entities
- [ ] **Validation Test**: Static scene with rotating entities (no physics, just transform updates)
- [ ] **Deliverable**: Component system with static rendering + rotation validation

### Phase 3: WASM Physics Bridge (Week 2-3)
- [ ] Simplify WASM interface to physics-only exports
- [ ] Create WasmPhysicsBridge for entity synchronization  
- [ ] Implement RigidBody component with WASM integration
- [ ] Add per-frame physics sync pipeline
- [ ] **Deliverable**: Physics entities synchronized with rendering

### Phase 4: Camera Integration (Week 3)
- [ ] Port v2 Camera class to new system
- [ ] Update uniform buffer management for camera matrices
- [ ] Remove hardcoded camera transforms from WASM
- [ ] **Deliverable**: Dynamic camera control in new architecture

### Phase 5: Complete Integration (Week 4)
- [ ] Full scene lifecycle (awake → start → update → render)  
- [ ] Component system completion (custom components, lifecycle)
- [ ] Performance validation (maintain 6,598+ entity baseline)
- [ ] Clean up old rendering systems
- [ ] **Deliverable**: Production-ready unified engine

### Phase 6: Input System & Controls (Week 4-5)
- [ ] Implement InputManager with camera controls (WASD + mouse)
- [ ] Add GameObject force controls (Arrow keys)
- [ ] Create controllable entity examples
- [ ] Integrate with existing input.ts or replace
- [ ] **Deliverable**: Full input integration with camera + entity control

### Phase 7: Polish & Documentation (Week 5-6)
- [ ] End-user API documentation
- [ ] Example scenes and tutorials  
- [ ] Migration guide from old system
- [ ] Performance benchmarking and optimization
- [ ] **Deliverable**: Developer-ready engine with documentation

---

## Comprehensive Testing Strategy

### Critical Buffer Architecture Testing (Phase 1)

Buffer changes have historically been the most fragile part of the renderer. This comprehensive testing approach ensures we catch issues early:

#### Unit Tests (TypeScript)
```typescript
// tests/gpu-buffer-manager.test.ts
describe('GPUBufferManager', () => {
  test('mesh allocation tracking', () => {
    const manager = new GPUBufferManager(mockDevice);
    const cubeData = createCubeMesh(1.0);
    
    manager.registerMesh('cube', cubeData);
    const allocation = manager.getMeshAllocation('cube');
    
    expect(allocation.vertexOffset).toBe(0);
    expect(allocation.indexOffset).toBe(0);
    expect(allocation.vertexCount).toBe(24); // 8 vertices * 3 coords
  });
  
  test('multiple mesh allocation offsets', () => {
    const manager = new GPUBufferManager(mockDevice);
    manager.registerMesh('cube', createCubeMesh(1.0));
    manager.registerMesh('sphere', createSphereMesh(1.0, 16));
    
    const sphereAllocation = manager.getMeshAllocation('sphere');
    expect(sphereAllocation.vertexOffset).toBeGreaterThan(0); // After cube
  });
  
  test('zero-copy WASM mapping', () => {
    const mockWasmMemory = new ArrayBuffer(1024);
    const manager = new GPUBufferManager(mockDevice);
    
    // Should not throw and should call writeBuffer with correct offset
    manager.mapInstanceDataFromWasm(mockWasmMemory, 0, 10);
    expect(mockDevice.queue.writeBuffer).toHaveBeenCalled();
  });
});
```

#### Browser Visual Validation Tests
```typescript
// browser-tests/buffer-architecture-validation.ts
async function validateBufferArchitecture() {
  console.log('🧪 Starting buffer architecture validation...');
  
  const renderer = new WebGPURendererV2();
  await renderer.init(canvas);
  
  // Test 1: Basic mesh registration
  const cubeData = createCubeMesh(1.0);
  renderer.registerMesh('cube', cubeData);
  console.log('✅ Cube mesh registered');
  
  // Test 2: Multiple mesh registration
  const sphereData = createSphereMesh(1.0, 16);
  renderer.registerMesh('sphere', sphereData);
  console.log('✅ Sphere mesh registered');
  
  // Test 3: Render single cube
  renderer.addEntity({
    id: 'test-cube',
    meshId: 'cube',
    transform: { position: [0, 0, -5], rotation: [0, 0, 0], scale: [1, 1, 1] },
    color: [1, 0, 0, 1],
    renderMode: 'triangles'
  });
  
  renderer.render();
  console.log('✅ Single cube render test');
  
  // Test 4: Render multiple entities
  renderer.addEntity({
    id: 'test-sphere',
    meshId: 'sphere',
    transform: { position: [2, 0, -5], rotation: [0, 0, 0], scale: [1, 1, 1] },
    color: [0, 1, 0, 1],
    renderMode: 'triangles'
  });
  
  renderer.render();
  console.log('✅ Multiple entity render test');
  
  // Test 5: Performance baseline (should maintain 60fps with many entities)
  console.log('🏃 Performance test: Adding 1000 entities...');
  for (let i = 0; i < 1000; i++) {
    renderer.addEntity({
      id: `perf-${i}`,
      meshId: i % 2 === 0 ? 'cube' : 'sphere',
      transform: { 
        position: [Math.random() * 20 - 10, Math.random() * 20 - 10, -5], 
        rotation: [0, 0, 0], 
        scale: [1, 1, 1] 
      },
      color: [Math.random(), Math.random(), Math.random(), 1],
      renderMode: 'triangles'
    });
  }
  
  const startTime = performance.now();
  renderer.render();
  const renderTime = performance.now() - startTime;
  
  console.log(`✅ Performance test: ${renderTime.toFixed(2)}ms for 1000 entities`);
  if (renderTime > 16.67) { // Should be under 60fps budget
    console.warn('⚠️ Performance regression detected!');
  }
}
```

#### MCP Browser Testing Workflow

For each critical test, I'll:

1. **Navigate to test page**: `mcp__playwright__browser_navigate` to test URL
2. **Open DevTools**: Use `mcp__playwright__browser_evaluate` to check console
3. **Run validation**: Execute test functions and capture results  
4. **Take screenshot**: Visual confirmation of rendering
5. **Check console**: Validate all test checkpoints passed

Example workflow:
```typescript
// I'll use these MCP commands during testing:
await mcp__playwright__browser_navigate('http://localhost:5173/buffer-test.html');
await mcp__playwright__browser_evaluate('() => { console.clear(); validateBufferArchitecture(); }');

// Check console for test results
const consoleMessages = await mcp__playwright__browser_console_messages();
console.log('Browser test results:', consoleMessages);

// Visual confirmation
await mcp__playwright__browser_take_screenshot('buffer-validation-test.png');
```

### Phase 2 Validation: Static Rotating Scene

After Phase 2, this test confirms the component system works:

```typescript
// Test: Create scene with rotating cubes (no physics)
function createRotationValidationScene() {
  const scene = new Scene();
  
  // Add rotating cube
  const cube = new GameObject('rotating-cube');
  cube.transform.position = new Vector3(0, 0, -5);
  cube.addComponent(new MeshRenderer('cube', 'red', 'triangles'));
  cube.addComponent(new RotatorComponent(45)); // 45 deg/sec
  scene.addGameObject(cube);
  
  // Should see smooth rotation without physics
  return scene;
}
```

### When Things Break: Debugging Checklist

1. **Check console for WebGPU errors** (validation layers catch most issues)
2. **Verify buffer allocations** (log vertex/index offsets)
3. **Validate mesh data** (vertices/indices not corrupted)
4. **Test with single entity first** (isolate complexity)
5. **Compare with working v2 renderer** (regression testing)

This testing approach should catch buffer issues much earlier in the development cycle!

---

## Risk Mitigation

### Technical Risks
1. **Buffer Performance**: Monitor frame times during buffer architecture switch
2. **WASM Sync Overhead**: Profile physics sync cost vs current zero-copy approach  
3. **Component System Complexity**: Start minimal, add features incrementally
4. **Memory Management**: Careful GameObject lifecycle to prevent leaks

### Fallback Strategies
1. **Separate Buffer Issues**: Can revert to mega-buffer if performance degrades
2. **WASM Integration Problems**: Keep old unified renderer working during transition
3. **Component System Bugs**: Incremental rollout with feature flags
4. **Performance Regressions**: Detailed before/after benchmarking

---

## Success Metrics

### Performance Targets
- **Maintain baseline**: 6,598+ entities at 60fps
- **Physics overhead**: <10% additional frame time for sync
- **Memory usage**: No more than 20% increase vs current system
- **Startup time**: Scene initialization <500ms for 1000 entities

### Developer Experience Goals
- **API Simplicity**: Create basic scene in <20 lines of code
- **Component Reusability**: Easy custom component creation
- **Debug Visibility**: Clear separation between physics/rendering layers
- **Migration Path**: Gradual transition from existing GameObject system

### Architecture Quality
- **Clean Separation**: WASM = physics only, TypeScript = rendering only
- **Maintainable**: Each system independently testable
- **Extensible**: Easy to add new component types
- **Future-Proof**: Ready for advanced rendering features (Phase 8+)

This integration plan provides a clear path from the current system to a unified, maintainable architecture that preserves performance while enabling future extensibility.