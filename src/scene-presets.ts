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

  // Two balls stacked with small gap + slight offset - will create wild bouncing and separation
  scene.createSphereGameObject('Ball1', 0, 2, 0, 0.5);        // Bottom ball at center
  scene.createSphereGameObject('Ball2', 0.01, 3.1, 0, 0.5);   // Top ball with 0.1 gap + minimal horizontal offset for separation
  
  console.log('⚡ Two ball test: 2 balls with slight offset, should separate and settle');
}

// Fancy demo scene - MAXIMUM CHAOS with towers and physics mayhem
export function createFancyDemoScene(scene: Scene): void {
  console.log('🎪 Creating CHAOS demo scene');
  scene.clear();

  // Center: 3x3 grid of spheres
  const gridSpacing = 1.5;
  const baseHeight = 8;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = (col - 1) * gridSpacing;
      const z = (row - 1) * gridSpacing;
      const y = baseHeight + (Math.random() * 2);
      
      const sphereName = `GridSphere_${row}_${col}`;
      scene.createSphereGameObject(sphereName, x, y, z, 0.5);
    }
  }
  
  // Center obstacle cube
  scene.createCubeGameObject('FloorCube', 0, -7.5, 0, 1.0);
  
  // Right side: 6-cube falling tower
  const cubeSize = 1.0;
  const stackX = 4.0;
  const cubeSpacing = 3.0;
  for (let i = 0; i < 6; i++) {
    const stackY = -3.0 + (i * cubeSpacing);
    scene.createCubeGameObject(`StackCube_${i}`, stackX, stackY, 0, cubeSize);
  }
  
  // Left side: 8-sphere falling tower with randomness
  const sphereRadius = 0.5;
  const sphereStackX = -4.0;
  const sphereSpacing = 2.5;
  for (let i = 0; i < 8; i++) {
    const sphereY = -2.0 + (i * sphereSpacing);
    const randomX = sphereStackX + (Math.random() - 0.5) * 0.8;
    const randomZ = (Math.random() - 0.5) * 0.8;
    scene.createSphereGameObject(`TowerSphere_${i}`, randomX, sphereY, randomZ, sphereRadius);
  }

  console.log('🎪 CHAOS demo scene created: 25+ entities of pure physics mayhem!');
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