// Engine lifecycle demo — exercises the play/pause/restart/scene-switch API on one Engine
// (and one WebGPU device). Two "levels" as separate scene builders:
//   - Falling Balls: two slightly-offset spheres drop and collide onto a static platform.
//   - Box Drop:      a single ball drops onto a static box.
//
// Reset and scene-switch are the SAME operation — build a fresh Scene and load it:
//   await engine.loadScene(build()); engine.start();
// The Engine reuses the device across loads; start()/stop() pause/resume without re-mounting.

import { Engine } from '../../engine/engine';
import { Scene } from '../../engine/scene-system';
import { GameObject } from '../../engine/gameobject';
import { MeshRenderer, RigidBody, CollisionShape } from '../../engine/components';
import { Mesh } from '../../engine/mesh';
import { Material } from '../../engine/material';
import { PerspectiveCamera } from '../../engine/camera-object';

type SceneBuilder = () => Scene;

const GRAY = new Material('gray', { r: 0.5, g: 0.5, b: 0.5, a: 1 });
const GREEN = new Material('green', { r: 0.2, g: 0.7, b: 0.3, a: 1 });
const RED = new Material('red', { r: 1, g: 0.2, b: 0.2, a: 1 });
const BLUE = new Material('blue', { r: 0.3, g: 0.5, b: 1, a: 1 });

function addCamera(scene: Scene): void {
    const camera = new PerspectiveCamera('main');
    camera.transform.setPosition(0, 0, -14);
    camera.lookAt(0, -2, 0);
    scene.setCamera(camera);
}

// Decorative wireframe floor grid (visual only — not a collider).
function addFloorGrid(scene: Scene, y: number): void {
    const floor = new GameObject('floor', 'Floor');
    floor.transform.setPosition(0, y, 0);
    floor.addComponent(new MeshRenderer(Mesh.createGrid('grid', 20, 20), GRAY, 'lines'));
    scene.add(floor);
}

// A fixed, collidable platform (kinematic staticBody, so no mass-0 footgun and it won't move).
function addPlatform(scene: Scene, y: number): void {
    const platform = new GameObject('platform', 'Platform');
    platform.transform.setPosition(0, y, 0);
    platform.transform.setScale(6, 0.5, 6);
    platform.addComponent(new MeshRenderer(Mesh.createCube('platform', 1), GREEN));
    platform.addComponent(RigidBody.staticBody(CollisionShape.BOX, { x: 3, y: 0.25, z: 3 }));
    scene.add(platform);
}

// Level 1 — two slightly-offset spheres fall and collide onto a platform.
function buildFallingBalls(): Scene {
    const scene = new Scene();
    addCamera(scene);
    addFloorGrid(scene, -5);
    addPlatform(scene, -5);

    const lower = new GameObject('ball-lower', 'Lower Ball');
    lower.transform.setPosition(0, 0, 0);
    lower.addComponent(new MeshRenderer(Mesh.createSphere('sphere', 0.5), RED));
    lower.addComponent(new RigidBody(1, true, CollisionShape.SPHERE, { x: 0.5, y: 0.5, z: 0.5 }));
    scene.add(lower);

    const upper = new GameObject('ball-upper', 'Upper Ball');
    upper.transform.setPosition(0.4, 4, 0); // slight x-offset so it lands on the lower ball and rolls
    upper.addComponent(new MeshRenderer(Mesh.createSphere('sphere', 0.5), BLUE));
    upper.addComponent(new RigidBody(1, true, CollisionShape.SPHERE, { x: 0.5, y: 0.5, z: 0.5 }));
    scene.add(upper);

    return scene;
}

// Level 2 — a single ball drops onto a static box.
function buildBoxDrop(): Scene {
    const scene = new Scene();
    addCamera(scene);
    addFloorGrid(scene, -5);

    const box = new GameObject('box', 'Static Box');
    box.transform.setPosition(0, -2, 0);
    box.transform.setScale(2, 2, 2);
    box.addComponent(new MeshRenderer(Mesh.createCube('cube', 1), GREEN));
    box.addComponent(RigidBody.staticBody(CollisionShape.BOX, { x: 1, y: 1, z: 1 }));
    scene.add(box);

    const ball = new GameObject('ball', 'Ball');
    ball.transform.setPosition(0.2, 4, 0);
    ball.addComponent(new MeshRenderer(Mesh.createSphere('sphere', 0.5), RED));
    ball.addComponent(new RigidBody(1, true, CollisionShape.SPHERE, { x: 0.5, y: 0.5, z: 0.5 }));
    scene.add(ball);

    return scene;
}

interface Level { name: string; build: SceneBuilder }
const FALLING_BALLS: Level = { name: 'Falling Balls', build: buildFallingBalls };
const BOX_DROP: Level = { name: 'Box Drop', build: buildBoxDrop };

async function main(): Promise<void> {
    const errorDiv = document.getElementById('error-message');
    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        const engine = new Engine('webgpu-canvas');
        await engine.init(); // WebGPU device + WASM module (once)

        // Whichever level is active — restart rebuilds this one.
        let currentLevel: Level = FALLING_BALLS;

        const playPauseBtn = document.getElementById('btn-playpause') as HTMLButtonElement | null;
        const statusEl = document.getElementById('status');

        const refreshUI = (): void => {
            if (playPauseBtn) playPauseBtn.textContent = engine.isRunning ? '⏸ Pause' : '▶ Play';
        };
        const setStatus = (msg: string): void => {
            if (statusEl) statusEl.textContent = msg;
        };

        // Reset (reload same level) and switch (load a different level) are the same call.
        const load = async (level: Level): Promise<void> => {
            currentLevel = level;
            await engine.loadScene(level.build()); // fresh scene on the same device
            engine.start();
            setStatus(`Playing: ${level.name}`);
            refreshUI();
        };

        // Play/pause toggle — resume keeps the paused scene's state (no re-mount).
        (window as unknown as { togglePlayPause: () => void }).togglePlayPause = () => {
            if (engine.isRunning) {
                engine.stop();
                setStatus('Paused');
            } else {
                engine.start();
                setStatus('Playing');
            }
            refreshUI();
        };

        // Restart — rebuild a fresh instance of the current level and play from the start.
        (window as unknown as { restart: () => void }).restart = () => {
            void load(currentLevel);
        };

        // Scene switch — load a different level, reusing the device.
        (window as unknown as { switchScene: (_i: number) => void }).switchScene = (i: number) => {
            void load(i === 1 ? BOX_DROP : FALLING_BALLS);
        };

        await load(FALLING_BALLS);

        // Expose for console debugging.
        (window as unknown as { engine: Engine }).engine = engine;
        console.log('✅ lifecycle demo running — play/pause, restart, and switch scenes');
    } catch (error) {
        console.error('❌ lifecycle demo failed:', error);
        if (errorDiv) {
            errorDiv.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            (errorDiv as HTMLElement).style.display = 'block';
        }
    }
}

main();
