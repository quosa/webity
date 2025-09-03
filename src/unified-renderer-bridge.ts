// Bridge system to integrate unified renderer with existing WASM interface
import { WASMExports } from './types.js';
import { UnifiedRenderer } from './unified-renderer.js';
import { GeometryBufferManager } from './geometry-buffer-manager.js';
import { InstanceManager } from './instance-manager.js';
import { MeshRegistry } from './mesh-registry.js';

export class UnifiedRendererBridge {
  private unifiedRenderer: UnifiedRenderer;
  private geometryManager: GeometryBufferManager;
  private instanceManager: InstanceManager;
  private meshRegistry: MeshRegistry;
  private wasm: WASMExports;
  
  // Mesh registration tracking
  private registeredMeshes = new Set<string>();

  constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    wasm: WASMExports
  ) {
    this.wasm = wasm;
    
    // Create unified rendering system
    this.meshRegistry = new MeshRegistry();
    this.geometryManager = new GeometryBufferManager(device, this.meshRegistry);
    this.instanceManager = new InstanceManager(device);
    this.unifiedRenderer = new UnifiedRenderer(
      device,
      context,
      this.geometryManager,
      this.instanceManager,
      this.meshRegistry
    );
  }

  async init(presentationFormat: GPUTextureFormat): Promise<void> {
    await this.unifiedRenderer.init(presentationFormat);
    this.registerDefaultMeshes();
  }

  // Register default mesh types from WASM - each mesh must be generated and copied immediately
  private registerDefaultMeshes(): void {
    // Generate and register sphere mesh first
    this.wasm.generate_sphere_mesh(16); // 16 segments
    const sphereOffset = this.wasm.get_vertex_buffer_offset();
    const sphereCount = this.wasm.get_vertex_count();
    const sphereVertices = this.extractWASMVertices(sphereOffset, sphereCount);
    
    // Register sphere mesh immediately to prevent overwrite
    this.meshRegistry.registerMesh('sphere', sphereVertices);
    this.registeredMeshes.add('sphere');

    // Generate and register cube mesh second
    this.wasm.generate_cube_mesh(1.0); // Size 1.0
    const cubeOffset = this.wasm.get_vertex_buffer_offset();
    const cubeCount = this.wasm.get_vertex_count();
    const cubeVertices = this.extractWASMVertices(cubeOffset, cubeCount);
    
    // Register cube mesh immediately to prevent overwrite  
    this.meshRegistry.registerMesh('cube', cubeVertices);
    this.registeredMeshes.add('cube');
  }


  private extractWASMVertices(offset: number, vertexCount: number): Float32Array {
    const wasmMemory = this.wasm.memory.buffer;
    const vertices = new Float32Array(wasmMemory, offset, vertexCount * 3);
    
    // Create a copy since WASM memory can be invalidated
    return new Float32Array(vertices);
  }

  // Convert WASM entities to unified renderer instances using consolidated entity array
  updateFromWASM(): void {
    this.instanceManager.clearInstances();
    
    // Use main entity array instead of separate mesh arrays
    const entityCount = this.wasm.get_entity_count();
    
    // Add all entities using the main entity interface
    for (let i = 0; i < entityCount; i++) {
      const x = this.wasm.get_entity_position_x(i);
      const y = this.wasm.get_entity_position_y(i);
      const z = this.wasm.get_entity_position_z(i);
      const meshType = this.wasm.get_entity_mesh_type(i);
      
      const transform = this.createTransformMatrix(x, y, z);
      
      // Determine mesh ID and material based on mesh type
      let meshId: string;
      let materialId: number;
      
      switch (meshType) {
      case 0: // SPHERE
        meshId = 'sphere';
        materialId = 0; // Cyan wireframe
        break;
      case 1: // CUBE  
        meshId = 'cube';
        materialId = 1; // Orange wireframe
        break;
      default:
        meshId = 'sphere'; // Default fallback
        materialId = 0;
        break;
      }
      
      this.instanceManager.addInstance({
        transform,
        materialId,
        meshId,
        objectId: i
      });
    }
    
    // Add grid instance AFTER all WASM entities to avoid index confusion
    this.ensureGridInstance();
  }

  private createTransformMatrix(x: number, y: number, z: number): Float32Array {
    // Create 4x4 identity matrix with translation
    return new Float32Array([
      1, 0, 0, 0,  // Column 0
      0, 1, 0, 0,  // Column 1  
      0, 0, 1, 0,  // Column 2
      x, y, z, 1   // Column 3 (translation)
    ]);
  }

  // Main render method that replaces existing renderer calls
  async render(wasmMemory: ArrayBuffer, uniformOffset: number): Promise<void> {
    // Update geometry buffers if needed
    await this.geometryManager.updateBuffers();
    
    // Update instances from WASM
    this.updateFromWASM();
    
    // Update uniforms
    this.unifiedRenderer.updateUniformBuffers(wasmMemory, uniformOffset);
    this.unifiedRenderer.updateBindGroup();
    
    // Render everything
    this.unifiedRenderer.render();
  }

  // Ensure grid instance is added to the renderer
  private ensureGridInstance(): void {
    // Register grid mesh if not already done
    if (!this.registeredMeshes.has('grid')) {
      const gridOffset = this.wasm.get_grid_buffer_offset();
      const gridVertexCount = this.wasm.get_grid_vertex_count();
      
      if (gridVertexCount > 0) {
        const gridVertices = new Float32Array(this.wasm.memory.buffer, gridOffset, gridVertexCount * 3);
        const gridVerticesCopy = new Float32Array(gridVertices); // Make a copy
        
        this.meshRegistry.registerMesh('grid', gridVerticesCopy);
        this.registeredMeshes.add('grid');
      }
    }
    
    // Always add grid instance (since clearInstances was called)
    if (this.registeredMeshes.has('grid')) {
      const gridTransform = this.createTransformMatrix(0, 0, 0); // Identity position
      this.instanceManager.addInstance({
        transform: gridTransform,
        materialId: this.meshRegistry.registerMaterial({
          id: 2,
          color: [0.3, 0.3, 0.4, 1.0], // Dark gray for grid
          wireframe: true
        }),
        meshId: 'grid',
        objectId: -1 // Special ID for grid
      });
    }
  }

  // Grid floor rendering (integrated into main render pass)
  async renderWithGrid(wasmMemory: ArrayBuffer, uniformOffset: number): Promise<void> {
    // Grid is now handled in updateFromWASM(), just render everything
    await this.render(wasmMemory, uniformOffset);
  }

  getStats(): any {
    return {
      unified: this.unifiedRenderer.getStats(),
      registeredMeshes: Array.from(this.registeredMeshes)
    };
  }

  dispose(): void {
    this.unifiedRenderer.dispose();
  }
}