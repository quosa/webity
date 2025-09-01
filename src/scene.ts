// Scene class for GameObject management and WASM integration
import { GameObject } from './gameobject.js';
import { Component } from './components/component.js';
import { Transform } from './components/transform.js';
import { MeshRenderer } from './components/mesh-renderer.js';
import { RigidBody } from './components/rigidbody.js';
import { MeshType } from './mesh-types.js';
import type { WASMExports } from './types.js';

export class Scene {
  public name: string;

  private gameObjects: Map<string, GameObject> = new Map();
  private rootGameObjects: GameObject[] = []; // GameObjects without parents
  private wasmExports?: WASMExports;

  // Physics configuration
  private entropy: number = 0.003; // Default entropy for breaking perfect alignment

  // Scene state
  private started = false;
  private destroyed = false;

  constructor(name: string = 'Scene') {
    this.name = name;
  }

  // WASM integration
  setWasmExports(wasmExports: WASMExports): void {
    this.wasmExports = wasmExports;
  }

  getWasmExports(): WASMExports | undefined {
    return this.wasmExports;
  }

  // Physics configuration
  setEntropy(entropy: number): void {
    this.entropy = entropy;
  }

  getEntropy(): number {
    return this.entropy;
  }

  // GameObject management
  addGameObject(gameObject: GameObject): void {
    if (this.destroyed) {
      throw new Error(`Cannot add GameObject to destroyed scene: ${this.name}`);
    }

    if (this.gameObjects.has(gameObject.id)) {
      throw new Error(`GameObject ${gameObject.name} already exists in scene ${this.name}`);
    }

    this.gameObjects.set(gameObject.id, gameObject);
    gameObject.setScene(this);

    // Add to root objects if no parent
    if (!gameObject.getParent()) {
      this.rootGameObjects.push(gameObject);
    }

    // Initialize GameObject if scene is already started
    if (this.started) {
      gameObject.awake();
      gameObject.start();
    }

    // Set up WASM integration for components
    this.setupGameObjectWasmIntegration(gameObject);
  }

  removeGameObject(gameObject: GameObject): boolean {
    const removed = this.gameObjects.delete(gameObject.id);

    if (removed) {
      gameObject.setScene(null);

      // Remove from root objects
      const rootIndex = this.rootGameObjects.indexOf(gameObject);
      if (rootIndex !== -1) {
        this.rootGameObjects.splice(rootIndex, 1);
      }

      // Clean up WASM integration
      this.cleanupGameObjectWasmIntegration(gameObject);
    }

    return removed;
  }

  getGameObject(id: string): GameObject | null {
    return this.gameObjects.get(id) || null;
  }

  getGameObjectByName(name: string): GameObject | null {
    for (const gameObject of this.gameObjects.values()) {
      if (gameObject.name === name) {
        return gameObject;
      }
    }
    return null;
  }

  getAllGameObjects(): GameObject[] {
    return Array.from(this.gameObjects.values());
  }

  getGameObjectCount(): number {
    return this.gameObjects.size;
  }

  // Find methods
  findGameObjectsWithComponent<T extends Component>(componentClass: new () => T): GameObject[] {
    const results: GameObject[] = [];
    for (const gameObject of this.gameObjects.values()) {
      if (gameObject.hasComponent(componentClass)) {
        results.push(gameObject);
      }
    }
    return results;
  }

  // Scene lifecycle
  awake(): void {
    if (this.destroyed || this.started) return;

    // Awake all root GameObjects (they will awake their children)
    for (const gameObject of this.rootGameObjects) {
      gameObject.awake();
    }
  }

  start(): void {
    if (this.destroyed || this.started) return;

    this.started = true;

    // Start all root GameObjects (they will start their children)
    for (const gameObject of this.rootGameObjects) {
      gameObject.start();
    }

    // After starting, spawn WASM entities for all GameObjects
    this.spawnWasmEntities();
  }

  // Spawn WASM entities for all GameObjects in this scene
  private spawnWasmEntities(): void {
    if (!this.wasmExports) {
      console.warn('Cannot spawn WASM entities - no WASM exports available');
      return;
    }

    // Find all GameObjects with MeshRenderer and RigidBody components
    const renderableObjects = this.findGameObjectsWithComponent(MeshRenderer);

    console.log(`🎮 Spawning ${renderableObjects.length} WASM entities for GameObject scene`);

    for (const gameObject of renderableObjects) {
      const meshRenderer = gameObject.getComponent(MeshRenderer)!;
      const rigidBody = gameObject.getComponent(RigidBody);
      const transform = gameObject.getComponent(Transform);

      if (!transform) continue;

      // Get position from transform
      const worldPos = transform.getWorldPosition();
      console.log(`🎮 Spawning ${gameObject.name} at position (${worldPos.x}, ${worldPos.y}, ${worldPos.z})`);

      // Spawn WASM entity based on mesh type
      let wasmEntityIndex: number;

      if (meshRenderer.getMeshType() === MeshType.CUBE) {
        // Spawn cube entity - use spawn_entity_with_mesh if available
        if (this.wasmExports.spawn_entity_with_mesh) {
          wasmEntityIndex = this.wasmExports.spawn_entity_with_mesh(
            worldPos.x, worldPos.y, worldPos.z,
            meshRenderer.getSize(),
            1 // MeshType.CUBE
          );
        } else {
          // Fallback to regular spawn
          wasmEntityIndex = this.wasmExports.spawn_entity(worldPos.x, worldPos.y, worldPos.z, meshRenderer.getSize());
        }
      } else {
        // Spawn sphere entity
        wasmEntityIndex = this.wasmExports.spawn_entity(worldPos.x, worldPos.y, worldPos.z, meshRenderer.getRadius());
      }

      // Connect the GameObject components to the WASM entity
      if (rigidBody) {
        rigidBody.setWasmEntityIndex(wasmEntityIndex);

        // Set initial velocity if specified
        const velocity = rigidBody.getVelocity();
        if (velocity.x !== 0 || velocity.y !== 0 || velocity.z !== 0) {
          this.wasmExports.set_entity_velocity(wasmEntityIndex, velocity.x, velocity.y, velocity.z);
        }
      }

      console.log(`🎮 Spawned ${meshRenderer.getMeshType() === MeshType.CUBE ? 'cube' : 'sphere'} entity ${wasmEntityIndex} for GameObject "${gameObject.name}"`);
    }
  }

  update(deltaTime: number): void {
    if (this.destroyed) return;

    // Update all root GameObjects (they will update their children)
    for (const gameObject of this.rootGameObjects) {
      gameObject.update(deltaTime);
    }

    // Sync with WASM physics system
    this.syncWithWasm();
  }

  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;

    // Destroy all GameObjects
    for (const gameObject of this.gameObjects.values()) {
      gameObject.destroy();
    }

    this.gameObjects.clear();
    this.rootGameObjects.length = 0;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  // WASM integration helpers
  private setupGameObjectWasmIntegration(gameObject: GameObject): void {
    // WASM entities are now spawned centrally in spawnWasmEntities() when scene starts
    // This method is kept for future component setup that doesn't involve spawning
    console.log(`🎮 Setting up WASM integration for GameObject "${gameObject.name}" (no spawning)`);
  }

  private cleanupGameObjectWasmIntegration(gameObject: GameObject): void {
    // Current WASM system doesn't support individual entity removal
    // This is a placeholder for future enhancement
    const rigidBody = gameObject.getComponent(RigidBody);
    if (rigidBody) {
      rigidBody.setWasmEntityIndex(-1);
    }

    const meshRenderer = gameObject.getComponent(MeshRenderer);
    if (meshRenderer) {
      meshRenderer.setWasmEntityIndex(-1);
    }
  }

  private syncWithWasm(): void {
    if (!this.wasmExports) return;

    // Sync all GameObjects with RigidBody components
    const rigidBodyObjects = this.findGameObjectsWithComponent(RigidBody);

    for (const gameObject of rigidBodyObjects) {
      const rigidBody = gameObject.getComponent(RigidBody)!;
      const transform = gameObject.getComponent(Transform);
      const wasmIndex = rigidBody.getWasmEntityIndex();

      if (wasmIndex >= 0 && transform) {
        // Sync physics state from WASM to Transform
        if (!rigidBody.isKinematic) {
          const wasmPosX = this.wasmExports.get_entity_position_x(wasmIndex);
          const wasmPosY = this.wasmExports.get_entity_position_y(wasmIndex);
          const wasmPosZ = this.wasmExports.get_entity_position_z(wasmIndex);

          transform.setPosition(wasmPosX, wasmPosY, wasmPosZ);

          // Update velocity (WASM doesn't currently expose velocity getters,
          // but this is where we'd sync it)
        } else {
          // For kinematic bodies, sync Transform to WASM
          const worldPos = transform.getWorldPosition();
          this.wasmExports.set_entity_position(wasmIndex, worldPos.x, worldPos.y, worldPos.z);
        }
      }
    }
  }

  // WASM convenience methods for components
  updateWasmEntityPosition(wasmIndex: number, position: { x: number; y: number; z: number }): void {
    if (this.wasmExports && wasmIndex >= 0) {
      this.wasmExports.set_entity_position(wasmIndex, position.x, position.y, position.z);
    }
  }

  updateWasmEntityVelocity(wasmIndex: number, velocity: { x: number; y: number; z: number }): void {
    if (this.wasmExports && wasmIndex >= 0) {
      this.wasmExports.set_entity_velocity(wasmIndex, velocity.x, velocity.y, velocity.z);
    }
  }

  getWasmEntityPosition(wasmIndex: number): { x: number; y: number; z: number } | null {
    if (!this.wasmExports || wasmIndex < 0) return null;

    return {
      x: this.wasmExports.get_entity_position_x(wasmIndex),
      y: this.wasmExports.get_entity_position_y(wasmIndex),
      z: this.wasmExports.get_entity_position_z(wasmIndex),
    };
  }

  // Scene preset factory methods
  createSphereGameObject(name: string, x: number, y: number, z: number, radius: number = 0.5): GameObject {
    const gameObject = new GameObject(name);

    const transform = gameObject.addComponent(Transform);
    transform.setPosition(x, y, z);

    const rigidBody = gameObject.addComponent(RigidBody);
    rigidBody.setRadius(radius);

    const meshRenderer = gameObject.addComponent(MeshRenderer);
    meshRenderer.setMeshType(MeshType.SPHERE);
    meshRenderer.setRadius(radius);

    this.addGameObject(gameObject);
    return gameObject;
  }

  createCubeGameObject(name: string, x: number, y: number, z: number, size: number = 1.0): GameObject {
    const gameObject = new GameObject(name);

    const transform = gameObject.addComponent(Transform);
    transform.setPosition(x, y, z);

    const rigidBody = gameObject.addComponent(RigidBody);
    rigidBody.setRadius(size * 0.866); // Sphere that encompasses cube

    const meshRenderer = gameObject.addComponent(MeshRenderer);
    meshRenderer.setMeshType(MeshType.CUBE);
    meshRenderer.setSize(size);

    this.addGameObject(gameObject);
    return gameObject;
  }

  // Scene statistics
  getStatistics(): {
    gameObjectCount: number;
    rigidBodyCount: number;
    meshRendererCount: number;
    wasmEntityCount: number;
    } {
    const rigidBodyObjects = this.findGameObjectsWithComponent(RigidBody);
    const meshRendererObjects = this.findGameObjectsWithComponent(MeshRenderer);

    return {
      gameObjectCount: this.gameObjects.size,
      rigidBodyCount: rigidBodyObjects.length,
      meshRendererCount: meshRendererObjects.length,
      wasmEntityCount: this.wasmExports?.get_entity_count() || 0,
    };
  }

  // Debug helpers
  toString(): string {
    const stats = this.getStatistics();
    return `Scene(${this.name}, GameObjects: ${stats.gameObjectCount}, RigidBodies: ${stats.rigidBodyCount})`;
  }

  // Clear all GameObjects (useful for scene transitions)
  clear(): void {
    // Clear WASM entities first
    if (this.wasmExports) {
      this.wasmExports.despawn_all_entities();
    }

    // Destroy all GameObjects
    for (const gameObject of this.gameObjects.values()) {
      gameObject.destroy();
    }

    this.gameObjects.clear();
    this.rootGameObjects.length = 0;
  }
}