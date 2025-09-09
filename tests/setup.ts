// WebGPU and DOM mocks moved to tests/utils/dom-mocks.ts
// Import and use setupWebGPUTestEnvironment() in tests that need WebGPU

// WebAssembly is NOT mocked globally - let real instantiation work
// Individual tests can mock WebAssembly if needed for error testing

// Smart fetch mock that loads real WASM from disk
Object.defineProperty(globalThis, 'fetch', {
    value: jest.fn().mockImplementation(async (url: string) => {
        // If it's a WASM file, load real bytes from disk
        if (url.endsWith('.wasm') || url.includes('game_engine')) {
            try {
                const fs = await import('fs');
                const path = await import('path');
                const wasmPath = path.resolve(__dirname, '../public/game_engine.wasm');
                const wasmBuffer = fs.readFileSync(wasmPath);

                return {
                    ok: true,
                    status: 200,
                    arrayBuffer: () => Promise.resolve(wasmBuffer.buffer.slice(
                        wasmBuffer.byteOffset,
                        wasmBuffer.byteOffset + wasmBuffer.byteLength
                    ))
                };
            } catch (error) {
                console.warn('Failed to load WASM file in test:', error);
                return {
                    ok: false,
                    status: 404,
                    statusText: 'WASM file not found'
                };
            }
        }

        // For non-WASM URLs, return simple mock
        return {
            ok: true,
            status: 200,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        };
    }),
    writable: true,
});

// Mock performance.now()
Object.defineProperty(globalThis, 'performance', {
    value: {
        now: jest.fn(() => Date.now()),
    },
    writable: true,
});

// Mock requestAnimationFrame
Object.defineProperty(globalThis, 'requestAnimationFrame', {
    value: jest.fn((callback: (_time: number) => void) => {
        setTimeout(() => callback(performance.now()), 16);
        return 1;
    }),
    writable: true,
});

Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    value: jest.fn(),
    writable: true,
});

// Canvas and document mocks moved to tests/utils/dom-mocks.ts