// Unified mesh registry for managing geometry data across all mesh types
import { ENGINE_CONSTANTS } from './types.js';

export interface MeshDefinition {
    id: string;
    vertexOffset: number;
    vertexCount: number;
    indexOffset: number;
    indexCount: number;
    wireframe: boolean;
}

export interface MaterialDefinition {
    id: number;
    color: [number, number, number, number]; // RGBA
    wireframe: boolean;
    metallic?: number;
    roughness?: number;
}

export class MeshRegistry {
    private meshes = new Map<string, MeshDefinition>();
    private materials = new Map<number, MaterialDefinition>();
    private nextMaterialId = 0;

    // Combined geometry buffers
    private combinedVertices: Float32Array;
    private combinedIndices: Uint32Array;
    private vertexOffset = 0;
    private indexOffset = 0;

    constructor() {
        // Pre-allocate large unified buffers
        this.combinedVertices = new Float32Array(ENGINE_CONSTANTS.MAX_VERTEX_BUFFER_SIZE);
        this.combinedIndices = new Uint32Array(ENGINE_CONSTANTS.MAX_VERTEX_BUFFER_SIZE / 3);

        // Register default wireframe materials
        this.registerMaterial({
            id: 0,
            color: [0.0, 1.0, 1.0, 1.0], // Cyan for spheres
            wireframe: true,
        });

        this.registerMaterial({
            id: 1,
            color: [1.0, 0.5, 0.0, 1.0], // Orange for cubes
            wireframe: true,
        });
    }

    registerMesh(id: string, vertices: Float32Array, indices?: Uint32Array): MeshDefinition {
        if (this.meshes.has(id)) {
            return this.meshes.get(id)!;
        }

        const vertexCount = vertices.length / 3; // Assuming vec3 positions
        const startVertexOffset = this.vertexOffset;

        // Copy vertices to combined buffer
        this.combinedVertices.set(vertices, this.vertexOffset);
        this.vertexOffset += vertices.length;

        let indexCount = 0;
        const startIndexOffset = this.indexOffset;

        if (indices) {
            // Copy indices to combined buffer, adjusting for vertex offset
            const adjustedIndices = new Uint32Array(indices.length);
            for (let i = 0; i < indices.length; i++) {
                const index = indices[i];
                if (index !== undefined) {
                    adjustedIndices[i] = index + startVertexOffset / 3;
                }
            }

            this.combinedIndices.set(adjustedIndices, this.indexOffset);
            this.indexOffset += indices.length;
            indexCount = indices.length;
        }

        const meshDef: MeshDefinition = {
            id,
            vertexOffset: startVertexOffset,
            vertexCount,
            indexOffset: startIndexOffset,
            indexCount,
            wireframe: true, // Default to wireframe for now
        };

        this.meshes.set(id, meshDef);
        console.log(`Registered mesh '${id}': ${vertexCount} vertices, ${indexCount} indices`);

        return meshDef;
    }

    registerMaterial(material: Omit<MaterialDefinition, 'id'> & { id?: number }): number {
        if (material.id !== undefined) {
            const materialWithId = { ...material, id: material.id } as MaterialDefinition;
            this.materials.set(material.id, materialWithId);
            this.nextMaterialId = Math.max(this.nextMaterialId, material.id + 1);
            return material.id;
        } else {
            const id = this.nextMaterialId++;
            const materialWithId = { ...material, id } as MaterialDefinition;
            this.materials.set(id, materialWithId);
            return id;
        }
    }

    getMesh(id: string): MeshDefinition | undefined {
        return this.meshes.get(id);
    }

    getMaterial(id: number): MaterialDefinition | undefined {
        return this.materials.get(id);
    }

    getAllMeshes(): Map<string, MeshDefinition> {
        return new Map(this.meshes);
    }

    getAllMaterials(): Map<number, MaterialDefinition> {
        return new Map(this.materials);
    }

    getCombinedVertices(): Float32Array {
        return this.combinedVertices.slice(0, this.vertexOffset);
    }

    getCombinedIndices(): Uint32Array {
        return this.combinedIndices.slice(0, this.indexOffset);
    }

    getTotalVertexCount(): number {
        return this.vertexOffset / 3; // Convert float count to vertex count
    }

    getTotalIndexCount(): number {
        return this.indexOffset;
    }

    // Get material data as GPU-compatible buffer
    getMaterialDataBuffer(): Float32Array {
        const materialCount = this.materials.size;
        const buffer = new Float32Array(materialCount * 8); // 8 floats per material (color + properties)

        let offset = 0;
        for (const [, material] of this.materials) {
            buffer[offset + 0] = material.color[0]; // R
            buffer[offset + 1] = material.color[1]; // G
            buffer[offset + 2] = material.color[2]; // B
            buffer[offset + 3] = material.color[3]; // A
            buffer[offset + 4] = material.wireframe ? 1.0 : 0.0; // Wireframe flag
            buffer[offset + 5] = material.metallic || 0.0; // Metallic
            buffer[offset + 6] = material.roughness || 1.0; // Roughness
            buffer[offset + 7] = 0.0; // Reserved for future use
            offset += 8;
        }

        return buffer;
    }

    clear(): void {
        this.meshes.clear();
        this.materials.clear();
        this.vertexOffset = 0;
        this.indexOffset = 0;
        this.nextMaterialId = 0;
    }
}
