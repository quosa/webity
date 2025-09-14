// src/v2/rain-entity-factory.ts
// Factory for creating diverse rain entities with different mesh types, sizes, and colors

import { GameObject } from './gameobject';
import { Vector3, MeshRenderer, RigidBody } from './components';

export enum RainEntityType {
    /* eslint-disable no-unused-vars */
    SMALL_SPHERE = 'small_sphere',
    MEDIUM_SPHERE = 'medium_sphere',
    LARGE_SPHERE = 'large_sphere',
    SMALL_CUBE = 'small_cube',
    MEDIUM_CUBE = 'medium_cube',
    LARGE_CUBE = 'large_cube',
    /* eslint-enable no-unused-vars */
}

export interface RainEntityConfig {
    type: RainEntityType;
    position: Vector3;
    initialVelocity?: Vector3;
    color?: [number, number, number, number];
}

// Predefined color palettes for rain entities
export const RAIN_COLORS = {
    // Sphere colors - cool tones
    SPHERES: [
        [0.2, 0.8, 1.0, 1.0],   // Cyan
        [0.4, 0.7, 1.0, 1.0],   // Light blue
        [0.1, 0.6, 0.9, 1.0],   // Deep blue
        [0.0, 1.0, 0.8, 1.0],   // Aqua
        [0.3, 0.9, 0.7, 1.0],   // Turquoise
    ],
    // Cube colors - warm tones
    CUBES: [
        [1.0, 0.6, 0.2, 1.0],   // Orange
        [1.0, 0.8, 0.1, 1.0],   // Yellow
        [1.0, 0.4, 0.3, 1.0],   // Red-orange
        [0.9, 0.7, 0.2, 1.0],   // Gold
        [1.0, 0.5, 0.6, 1.0],   // Pink-orange
    ]
} as const;

// Entity specifications for different rain types
const ENTITY_SPECS = {
    [RainEntityType.SMALL_SPHERE]: {
        meshId: 'sphere',
        scale: { x: 0.3, y: 0.3, z: 0.3 } as Vector3,
        mass: 0.1,
        colors: RAIN_COLORS.SPHERES,
    },
    [RainEntityType.MEDIUM_SPHERE]: {
        meshId: 'sphere',
        scale: { x: 0.5, y: 0.5, z: 0.5 } as Vector3,
        mass: 0.3,
        colors: RAIN_COLORS.SPHERES,
    },
    [RainEntityType.LARGE_SPHERE]: {
        meshId: 'sphere',
        scale: { x: 0.7, y: 0.7, z: 0.7 } as Vector3,
        mass: 0.6,
        colors: RAIN_COLORS.SPHERES,
    },
    [RainEntityType.SMALL_CUBE]: {
        meshId: 'cube',
        scale: { x: 0.4, y: 0.4, z: 0.4 } as Vector3,
        mass: 0.2,
        colors: RAIN_COLORS.CUBES,
    },
    [RainEntityType.MEDIUM_CUBE]: {
        meshId: 'cube',
        scale: { x: 0.6, y: 0.6, z: 0.6 } as Vector3,
        mass: 0.4,
        colors: RAIN_COLORS.CUBES,
    },
    [RainEntityType.LARGE_CUBE]: {
        meshId: 'cube',
        scale: { x: 0.8, y: 0.8, z: 0.8 } as Vector3,
        mass: 0.7,
        colors: RAIN_COLORS.CUBES,
    },
} as const;

export class RainEntityFactory {
    private entityCounter = 0;

    /**
     * Create a rain entity with random type and color
     */
    createRandomRainEntity(position: Vector3, initialVelocity?: Vector3): GameObject {
        const types = Object.values(RainEntityType);
        const randomType = types[Math.floor(Math.random() * types.length)] as RainEntityType;

        const config: RainEntityConfig = {
            type: randomType,
            position,
        };
        if (initialVelocity) {
            config.initialVelocity = initialVelocity;
        }
        return this.createRainEntity(config);
    }

    /**
     * Create a rain entity with specific configuration
     */
    createRainEntity(config: RainEntityConfig): GameObject {
        const spec = ENTITY_SPECS[config.type];
        const entityId = `rain_${config.type}_${this.entityCounter++}`;

        // Create GameObject with components
        const gameObject = new GameObject(entityId, `Rain ${config.type}`);
        gameObject.tag = 'rain';

        // Set position
        gameObject.transform.position = config.position;
        gameObject.transform.scale = spec.scale;

        // Add MeshRenderer component
        const colorArray = config.color || this.getRandomColor(spec.colors);
        const color = { x: colorArray[0], y: colorArray[1], z: colorArray[2], w: colorArray[3] };
        const meshRenderer = new MeshRenderer(spec.meshId, 'default', 'triangles', color);
        gameObject.addComponent(meshRenderer);

        // Add RigidBody component for physics
        const rigidBody = new RigidBody();
        rigidBody.mass = spec.mass;
        rigidBody.useGravity = true;

        // Set initial velocity if provided
        if (config.initialVelocity) {
            rigidBody.velocity = config.initialVelocity;
        }

        gameObject.addComponent(rigidBody);

        return gameObject;
    }

    /**
     * Create a batch of random rain entities
     */
    createRainBatch(count: number, spawnArea: {
        x: [number, number],
        y: [number, number],
        z: [number, number]
    }): GameObject[] {
        const entities: GameObject[] = [];

        for (let i = 0; i < count; i++) {
            const position: Vector3 = {
                x: spawnArea.x[0] + Math.random() * (spawnArea.x[1] - spawnArea.x[0]),
                y: spawnArea.y[0] + Math.random() * (spawnArea.y[1] - spawnArea.y[0]),
                z: spawnArea.z[0] + Math.random() * (spawnArea.z[1] - spawnArea.z[0]),
            };

            // Add some initial lateral velocity for more dynamic rain
            const initialVelocity: Vector3 = {
                x: (Math.random() - 0.5) * 2.0, // -1 to +1 lateral velocity
                y: 0,
                z: (Math.random() - 0.5) * 2.0, // -1 to +1 lateral velocity
            };

            entities.push(this.createRandomRainEntity(position, initialVelocity));
        }

        return entities;
    }

    /**
     * Get random color from available colors for the entity type
     */
    private getRandomColor(availableColors: readonly (readonly [number, number, number, number])[]): [number, number, number, number] {
        const randomIndex = Math.floor(Math.random() * availableColors.length);
        const color = availableColors[randomIndex];
        if (!color) {
            // Fallback color if somehow color is undefined
            return [1.0, 1.0, 1.0, 1.0];
        }
        return [color[0], color[1], color[2], color[3]];
    }

    /**
     * Get all available rain entity types
     */
    static getAvailableTypes(): RainEntityType[] {
        return Object.values(RainEntityType);
    }

    /**
     * Reset the entity counter (useful for testing)
     */
    resetCounter(): void {
        this.entityCounter = 0;
    }
}
