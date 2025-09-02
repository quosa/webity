// Scene preset factory functions - replace legacy engine spawning methods
import { Scene } from './scene.js';
import { Engine } from './engine.js';
import { RainSystem } from './rain-system.js';
import { RigidBody } from './components/rigidbody.js';

// Simple single ball test - basic physics
export function createSingleBallScene(scene: Scene): void {
  console.log('🎯 Creating single ball test scene');
  scene.clear();

  scene.createSphereGameObject('TestBall', 0, 2, 0, 0.5);
  
  console.log('🎯 Single ball test: 1 ball at Y=2, should settle on floor');
}

// Two ball collision test - balls that collide and spread out
export function createCollisionTestScene(scene: Scene): void {
  console.log('⚡ Creating collision test scene');
  scene.clear();

  // Two balls stacked with slight horizontal offset so they separate
  scene.createSphereGameObject('Ball1', 0, 1, 0, 0.5);        // Bottom ball at center
  scene.createSphereGameObject('Ball2', 0.001, 2.01, 0, 0.5);   // Top ball slightly offset horizontally
  
  console.log('⚡ Two ball test: 2 balls with slight offset, should separate and settle');
}

// Fancy demo scene - impressive multi-entity demonstration
export function createFancyDemoScene(scene: Scene): void {
  console.log('🎪 Creating fancy demo scene');
  scene.clear();

  // Create a 3x3 grid of balls at different heights
  const gridSize = 3;
  const spacing = 1.5;
  const baseHeight = 8;
  const offset = (gridSize - 1) * spacing / 2;

  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const xPos = (x * spacing) - offset;
      const zPos = (z * spacing) - offset;
      const yPos = baseHeight + (Math.random() * 2); // Slight height variation

      const ballName = `Ball_${x}_${z}`;
      const ball = scene.createSphereGameObject(ballName, xPos, yPos, zPos, 0.5);
      
      // Add some initial velocity for interesting interactions
      const rigidBody = ball.getComponent(RigidBody);
      if (rigidBody) {
        const vx = (Math.random() - 0.5) * 2.0;
        const vz = (Math.random() - 0.5) * 2.0;
        rigidBody.setVelocity(vx, 0, vz);
      }
    }
  }

  console.log(`🎪 Fancy demo scene created: ${scene.getGameObjectCount()} balls in 3x3 formation with random velocities`);
}

// Rain scene - returns RainSystem for external control
export function createRainScene(scene: Scene, engine: Engine, intensity: number = 1.0): RainSystem {
  console.log(`🌧️ Creating rain scene with intensity ${intensity}`);
  
  const rainSystem = new RainSystem(scene, engine);
  rainSystem.start(intensity);
  
  return rainSystem;
}

// Mixed scene with different mesh types (spheres and cubes)
export function createMixedDemoScene(scene: Scene): void {
  console.log('🔗 Creating mixed demo scene');
  scene.clear();

  // Create a mix of spheres and cubes
  const sphere1 = scene.createSphereGameObject('Sphere1', -2, 5, 0, 0.5);
  const sphere2 = scene.createSphereGameObject('Sphere2', 2, 5, 0, 0.5);
  
  scene.createCubeGameObject('Cube1', 0, 6, -2, 1.0);
  scene.createCubeGameObject('Cube2', 0, 6, 2, 1.0);
  
  // Add some initial velocities for dynamic interactions
  const sphere1RB = sphere1.getComponent(RigidBody);
  const sphere2RB = sphere2.getComponent(RigidBody);
  
  if (sphere1RB) sphere1RB.setVelocity(1.0, 0, 0);
  if (sphere2RB) sphere2RB.setVelocity(-1.0, 0, 0);

  console.log(`🔗 Mixed demo scene created: ${scene.getGameObjectCount()} objects (spheres and cubes)`);
}

// Test scene with separated balls (no collision interaction)
export function createSeparatedBallsScene(scene: Scene): void {
  console.log('🎯 Creating separated balls test scene');
  scene.clear();

  // Two balls clearly separated (no collision interaction)
  scene.createSphereGameObject('LeftBall', -2, 2, 0, 0.5);   // Left ball
  scene.createSphereGameObject('RightBall', 2, 2, 0, 0.5);  // Right ball
  
  console.log('🎯 Separated balls test: 2 balls far apart, should settle independently');
}