// Mesh type definitions and enums for multi-mesh support

export enum MeshType {
  // eslint-disable-next-line no-unused-vars
  SPHERE = 0,
  // eslint-disable-next-line no-unused-vars  
  CUBE = 1,
}

export interface MeshProperties {
  // Common properties
  type: MeshType;
  
  // Sphere-specific properties
  radius?: number;
  segments?: number;
  
  // Cube-specific properties  
  size?: number;
  width?: number;
  height?: number;
  depth?: number;
}

export const DEFAULT_MESH_PROPERTIES: Record<MeshType, Partial<MeshProperties>> = {
  [MeshType.SPHERE]: {
    type: MeshType.SPHERE,
    radius: 0.5,
    segments: 16,
  },
  [MeshType.CUBE]: {
    type: MeshType.CUBE,
    size: 1.0,
  },
};

// Helper functions for mesh properties
export function createSphereProperties(radius: number = 0.5, segments: number = 16): MeshProperties {
  return {
    type: MeshType.SPHERE,
    radius,
    segments,
  };
}

export function createCubeProperties(sizeOrWidth = 1.0, height?: number, depth?: number): MeshProperties {
  if (height !== undefined && depth !== undefined) {
    return {
      type: MeshType.CUBE,
      width: sizeOrWidth,
      height,
      depth,
    };
  } else {
    return {
      type: MeshType.CUBE,
      size: sizeOrWidth,
    };
  }
}