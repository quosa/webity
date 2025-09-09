// MeshRenderer component for multi-mesh rendering support
import { Component } from './component.js';
import { Transform } from './transform.js';
import { MeshType, MeshProperties, DEFAULT_MESH_PROPERTIES } from '../mesh-types.js';

export class MeshRenderer extends Component {
    private meshProperties: MeshProperties;
    private wasmEntityIndex: number = -1; // Index in WASM entity array
    private meshGenerated = false;

    constructor(meshType: MeshType = MeshType.SPHERE) {
        super();
        this.meshProperties = { type: meshType, ...DEFAULT_MESH_PROPERTIES[meshType] };
    }

    awake(): void {
        // MeshRenderer is ready for setup
    }

    start(): void {
        // Generate mesh data when component starts
        this.generateMesh();
    }

    update(_deltaTime: number): void {
        // Update rendering data if needed
        if (this.wasmEntityIndex >= 0) {
            this.updateTransform();
        }
    }

    destroy(): void {
        // Clean up WASM entity if we created one
        // Note: Current WASM system doesn't support individual entity removal
        // so we just mark our entity index as invalid
        this.wasmEntityIndex = -1;
    }

    // Mesh properties
    getMeshType(): MeshType {
        return this.meshProperties.type;
    }

    setMeshType(meshType: MeshType): void {
        if (this.meshProperties.type !== meshType) {
            this.meshProperties.type = meshType;
            this.meshProperties = { ...this.meshProperties, ...DEFAULT_MESH_PROPERTIES[meshType] };
            this.meshGenerated = false;

            if (this.gameObject) {
                this.generateMesh();
            }
        }
    }

    getMeshProperties(): MeshProperties {
        return { ...this.meshProperties };
    }

    setMeshProperties(properties: Partial<MeshProperties>): void {
        this.meshProperties = { ...this.meshProperties, ...properties };
        this.meshGenerated = false;

        if (this.gameObject) {
            this.generateMesh();
        }
    }

    // Sphere-specific properties
    getRadius(): number {
        return this.meshProperties.radius || 0.5;
    }

    setRadius(radius: number): void {
        if (this.meshProperties.type === MeshType.SPHERE) {
            this.meshProperties.radius = radius;
            this.meshGenerated = false;

            if (this.gameObject) {
                this.generateMesh();
            }
        }
    }

    getSegments(): number {
        return this.meshProperties.segments || 16;
    }

    setSegments(segments: number): void {
        if (this.meshProperties.type === MeshType.SPHERE) {
            this.meshProperties.segments = segments;
            this.meshGenerated = false;

            if (this.gameObject) {
                this.generateMesh();
            }
        }
    }

    // Cube-specific properties
    getSize(): number {
        return this.meshProperties.size || 1.0;
    }

    setSize(size: number): void {
        if (this.meshProperties.type === MeshType.CUBE) {
            this.meshProperties.size = size;
            this.meshGenerated = false;

            if (this.gameObject) {
                this.generateMesh();
            }
        }
    }

    // WASM integration
    getWasmEntityIndex(): number {
        return this.wasmEntityIndex;
    }

    setWasmEntityIndex(index: number): void {
        this.wasmEntityIndex = index;
    }

    private generateMesh(): void {
        if (this.meshGenerated) return;

        // Get the engine's WASM exports (we'll need to access this through the scene/engine)
        const scene = this.gameObject.getScene();
        if (!scene) return;

        // For now, we'll mark as generated - actual mesh generation will be handled
        // by the engine when it processes all MeshRenderer components
        this.meshGenerated = true;
    }

    private updateTransform(): void {
        // Update WASM entity position based on Transform component
        const transform = this.getComponent(Transform);
        if (!transform || this.wasmEntityIndex < 0) return;

        // We'll need to get WASM exports from the scene/engine to update position
        const scene = this.gameObject.getScene();
        if (!scene) return;

        // The scene will handle updating WASM entity positions
        // This is a placeholder for the integration
    }

    // Helper methods for renderer integration
    isVisible(): boolean {
        return this.enabled && this.wasmEntityIndex >= 0;
    }

    shouldRegenerateVertex(): boolean {
        return !this.meshGenerated;
    }

    markMeshDirty(): void {
        this.meshGenerated = false;
    }

    // Debug information
    override toString(): string {
        const meshTypeStr = this.meshProperties.type === MeshType.SPHERE ? 'Sphere' : 'Cube';
        return `MeshRenderer(${meshTypeStr}, wasmIndex: ${this.wasmEntityIndex})`;
    }
}
