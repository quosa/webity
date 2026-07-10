// Physics integration scene — migrated to the scene-first engine API (A3).
// Build the Scene as pure data (Mesh/Material + RigidBody), then let the Engine mount + run it.

import { Engine } from '../../engine/engine';
import { Scene } from '../../engine/scene-system';
import { GameObject } from '../../engine/gameobject';
import { MeshRenderer, RigidBody, CollisionShape } from '../../engine/components';
import { Mesh } from '../../engine/mesh';
import { Material } from '../../engine/material';

function buildScene(): Scene {
    const scene = new Scene();

    // Static floor grid (yellow, wireframe) — no RigidBody = static geometry.
    const floor = new GameObject(undefined, 'PhysicsFloor');
    floor.transform.setPosition(0, -3, 0);
    floor.addComponent(
        new MeshRenderer(Mesh.createGrid('grid', 20, 20), new Material('yellow', { r: 1, g: 1, b: 0, a: 1 }), 'lines'),
    );
    scene.add(floor);

    // Dynamic falling cube (green) — mass 2kg, affected by gravity.
    const fallingCube = new GameObject('falling-cube', 'FallingCube');
    fallingCube.transform.setPosition(0, 5, -5);
    fallingCube.addComponent(
        new MeshRenderer(Mesh.createCube('cube', 1), new Material('green', { r: 0, g: 1, b: 0, a: 1 }), 'triangles'),
    );
    fallingCube.addComponent(new RigidBody(2.0, true, CollisionShape.BOX, { x: 1, y: 1, z: 1 }));
    scene.add(fallingCube);

    // Kinematic cube (red) — manually controlled, ignores physics forces.
    const kinematicCube = new GameObject('kinematic-cube', 'KinematicCube');
    kinematicCube.transform.setPosition(3, 2, -5);
    kinematicCube.addComponent(
        new MeshRenderer(Mesh.createCube('cube', 1), new Material('red', { r: 1, g: 0, b: 0, a: 1 }), 'triangles'),
    );
    const kinematicRigidBody = new RigidBody(1.0, false, CollisionShape.BOX, { x: 1, y: 1, z: 1 });
    kinematicRigidBody.setKinematic(true);
    kinematicCube.addComponent(kinematicRigidBody);
    scene.add(kinematicCube);

    // Physics sphere (blue) — mass 0.5kg, gravity, initial velocity (2, 0, 0).
    const physicsSphere = new GameObject('physics-sphere', 'PhysicsSphere');
    physicsSphere.transform.setPosition(-3, 4, -5);
    physicsSphere.addComponent(
        new MeshRenderer(Mesh.createSphere('sphere', 1, 16), new Material('blue', { r: 0, g: 0, b: 1, a: 1 }), 'triangles'),
    );
    const sphereRigidBody = new RigidBody(0.5, true, CollisionShape.SPHERE, { x: 1, y: 1, z: 1 });
    sphereRigidBody.setVelocity(2, 0, 0);
    physicsSphere.addComponent(sphereRigidBody);
    scene.add(physicsSphere);

    return scene;
}

async function main(): Promise<void> {
    const errorDiv = document.getElementById('error-message');
    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        const engine = new Engine('webgpu-canvas');
        await engine.init();
        const scene = buildScene();
        await engine.loadScene(scene);
        engine.start();

        // Expose for console debugging + the index.html panel.
        (window as any).engine = engine;
        (window as any).scene = scene;
        (window as any).physicsTestScene = scene;

        // Pause/resume: the index.html toggle button flips window.animationRunning; mirror that
        // onto the engine loop (stop/start) so the legacy pause behavior is preserved.
        let paused = false;
        setInterval(() => {
            const shouldRun = (window as any).animationRunning !== false;
            if (!shouldRun && !paused) {
                engine.stop();
                paused = true;
            } else if (shouldRun && paused) {
                engine.start();
                paused = false;
            }
        }, 100);

        console.log('✅ physics-system scene running');
    } catch (error) {
        console.error('❌ physics-system scene failed:', error);
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            (errorDiv as HTMLElement).style.display = 'block';
        }
    }
}

// Helper functions for testing physics (wired to console / future UI).
(window as any).testPhysicsForce = function (fx: number, fy: number, fz: number) {
    const scene = (window as any).physicsTestScene as Scene | undefined;
    if (scene) {
        const fallingCube = scene.getGameObject('falling-cube');
        const rigidBody = fallingCube?.getComponent(RigidBody);
        if (rigidBody) {
            rigidBody.applyForce(fx, fy, fz);
            console.log(`💥 Applied force (${fx}, ${fy}, ${fz}) to falling cube`);
        }
    }
};

(window as any).testSetVelocity = function (vx: number, vy: number, vz: number) {
    const scene = (window as any).physicsTestScene as Scene | undefined;
    if (scene) {
        const sphere = scene.getGameObject('physics-sphere');
        const rigidBody = sphere?.getComponent(RigidBody);
        if (rigidBody) {
            rigidBody.setVelocity(vx, vy, vz);
            console.log(`🎯 Set sphere velocity to (${vx}, ${vy}, ${vz})`);
        }
    }
};

main();
