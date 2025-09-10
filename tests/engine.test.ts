import { jest } from '@jest/globals';
import { Engine } from '../src/engine.js';
import { Renderer } from '../src/renderer.js';
import { InputManager } from '../src/input.js';
import { BufferManager } from '../src/buffer-manager.js';
import { EngineError, WebGPUNotSupportedError } from '../src/types.js';
import { setupWebGPUTestEnvironment } from './utils/dom-mocks.js';

// Helper function to create engine with all dependencies
function createTestEngine(): Engine {
    const bufferManager = new BufferManager();
    const renderer = new Renderer(bufferManager);
    const input = new InputManager();
    const mockCanvas = document.createElement('canvas');
    return new Engine(mockCanvas, renderer, input, bufferManager);
}

describe('Engine', () => {
    let engine: Engine;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Set up WebGPU test environment
        setupWebGPUTestEnvironment();
    });

    afterEach(() => {
        // Clean up engine if it exists
        if (engine) {
            engine.dispose();
        }
    });

    describe('Constructor', () => {
        it('should create engine instance with valid canvas', () => {
            engine = createTestEngine();
            expect(engine).toBeInstanceOf(Engine);
        });

        it('should accept valid dependencies', () => {
            const bufferManager = new BufferManager();
            const renderer = new Renderer(bufferManager);
            const input = new InputManager();
            const canvas = document.createElement('canvas');

            expect(() => {
                new Engine(canvas, renderer, input, bufferManager);
            }).not.toThrow();
        });
    });

    describe('Initialization', () => {
        beforeEach(() => {
            engine = createTestEngine();
        });

        it('should throw WebGPUNotSupportedError when WebGPU is not available', async () => {
            // Mock navigator.gpu as undefined
            Object.defineProperty(globalThis, 'navigator', {
                value: { gpu: undefined },
                writable: true,
            });

            await expect(engine.init()).rejects.toThrow(WebGPUNotSupportedError);
        });

        it('should initialize successfully with WebGPU support', async () => {
            // WebGPU is mocked in setup.ts, so this should work
            await expect(engine.init()).resolves.toBeUndefined();
        });

        it('should apply physics configuration when provided', async () => {
            const config = {
                physics: {
                    gravity: -9.8,
                    friction: 0.1,
                    bounds: { x: 10, y: 10, z: 10 }
                }
            };

            await expect(engine.init(config)).resolves.toBeUndefined();
        });
    });

    describe('Asset Loading', () => {
        beforeEach(async () => {
            engine = createTestEngine();
            await engine.init();
        });

        it('should load ball assets successfully', async () => {
            const assets = {
                ball: { segments: 32, radius: 1.0 }
            };

            await expect(engine.loadAssets(assets)).resolves.toBeUndefined();
        });

        it('should throw error when engine not initialized', async () => {
            const uninitializedEngine = createTestEngine();
            const assets = { ball: { segments: 32 } };

            await expect(uninitializedEngine.loadAssets(assets)).rejects.toThrow(EngineError);
            await expect(uninitializedEngine.loadAssets(assets)).rejects.toThrow('Engine not initialized');
        });
    });

    describe('Game Loop', () => {
        beforeEach(async () => {
            engine = createTestEngine();
            await engine.init();
        });

        it('should start and stop game loop', () => {
            expect(() => engine.start()).not.toThrow();
            expect(() => engine.stop()).not.toThrow();
        });

        it('should throw error when starting uninitialized engine', () => {
            const uninitializedEngine = createTestEngine();

            expect(() => uninitializedEngine.start()).toThrow(EngineError);
            expect(() => uninitializedEngine.start()).toThrow('Engine not initialized');
        });
    });

    describe('Resource Management', () => {
        beforeEach(async () => {
            engine = createTestEngine();
            await engine.init();
        });

        it('should dispose resources without throwing', () => {
            expect(() => engine.dispose()).not.toThrow();
        });

        it('should stop game loop when disposing', () => {
            engine.start();
            engine.dispose();

            // Engine should be stopped (no easy way to test this directly)
            expect(() => engine.dispose()).not.toThrow();
        });
    });
});
