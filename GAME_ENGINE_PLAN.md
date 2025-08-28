# Complete Game Engine Plan (TypeScript Edition)

## 🚀 Implementation Progress

### Phase 0: TypeScript Tooling Setup ✅ COMPLETED
- [x] **package.json** - TypeScript, ESLint, Jest, Vite dependencies configured
- [x] **tsconfig.json** - Strict TypeScript config with WebGPU types, ES2022 target
- [x] **ESLint + Prettier** - Strict linting rules for type safety and code quality
- [x] **Jest Configuration** - Testing setup with WebGPU/WASM mocks
- [x] **Vite Bundler** - Development server with WASM support and hot reload
- [x] **Project Structure** - `src/`, `tests/`, `public/` directories created

**Next Steps:** Run `npm install` then proceed to Phase 1

### Phase 1: Core Engine Infrastructure ✅ COMPLETED
- [x] **types.ts** - Core type definitions and interfaces with proper error classes
- [x] **engine.ts** - Main engine class with lifecycle management and error handling
- [x] **buffer-manager.ts** - Zero-copy WASM memory management with validation
- [x] **Unit Tests** - Comprehensive test coverage (29 tests passing)
  - Type definitions and error handling tests
  - Engine initialization, asset loading, and lifecycle tests  
  - Buffer manager memory operations and validation tests
  - WebGPU/WASM mocking infrastructure for isolated testing

**Verification:** ✅ `npm run typecheck && npm test` - All checks pass

### Phase 2: WASM Integration 📋 PENDING
- [ ] **game_engine.zig** - Physics simulation and sphere generation
- [ ] **WASM Loading** - TypeScript integration with error handling
- [ ] **Memory Management** - Shared buffer setup and validation

### Phase 3: WebGPU Rendering 📋 PENDING  
- [ ] **renderer.ts** - WebGPU pipeline and shader management
- [ ] **input.ts** - Keyboard input handling with proper cleanup
- [ ] **Integration** - Connect all systems for ball demo

### Phase 4: Demo Refinement 📋 PENDING
- [ ] **Testing** - Comprehensive test coverage 
- [ ] **Error Handling** - Graceful fallbacks and user messaging
- [ ] **Performance** - Optimization and profiling

## 1. Module Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Environment                  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Input     │  │   Renderer   │  │   Main Loop   │  │
│  │  (input.ts) │  │ (renderer.ts)│  │   (main.ts)   │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
├─────────┼─────────────────┼──────────────────┼──────────┤
│         ↓                 ↓                  ↓          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         TypeScript Bridge (engine.ts)            │   │
│  │         Error Handling & Type Safety             │   │
│  └──────────────────────────────────────────────────┘   │
│         ↓                 ↑                  ↑          │
│  ┌──────────────────────────────────────────────────┐   │
│  │    WASM Module (game_engine.zig → .wasm)        │   │
│  │  ┌────────┐  ┌────────┐  ┌─────────────────┐   │   │
│  │  │Physics │  │ State  │  │ Matrix Math     │   │   │
│  │  └────────┘  └────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│         ↓ SharedArrayBuffer                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │           WebGPU (Direct Buffer Access)          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 2. TypeScript Type Definitions

```typescript
// types.ts - Core type definitions

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface Mat4 {
    data: Float32Array; // 16 elements
}

export interface EngineConfig {
    canvas: HTMLCanvasElement;
    graphics?: {
        wireframe?: boolean;
        backgroundColor?: [number, number, number, number];
    };
    physics?: {
        gravity?: number;
        friction?: number;
        bounds?: Vec3;
    };
}

export interface AssetConfig {
    ball?: {
        segments: number;
        radius?: number;
    };
}

export type InputKey = 'w' | 'a' | 's' | 'd' | 'space';
export type InputState = Record<InputKey, boolean>;

export interface WASMExports {
    memory: WebAssembly.Memory;
    init(): void;
    update(deltaTime: number): void;
    set_input(keyCode: number, pressed: boolean): void;
    generate_sphere_mesh(segments: number): void;
    get_vertex_buffer_offset(): number;
    get_uniform_buffer_offset(): number;
    get_vertex_count(): number;
    set_position(x: number, y: number, z: number): void;
    apply_force(x: number, y: number, z: number): void;
    get_collision_state(): number; // Bitmask of collision flags
}

export interface GameEngine {
    init(config?: Partial<EngineConfig>): Promise<void>;
    loadAssets(assets: AssetConfig): Promise<void>;
    start(): void;
    stop(): void;
    dispose(): void;
}

// Error types for better error handling
export class EngineError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'EngineError';
    }
}

export class WebGPUNotSupportedError extends EngineError {
    constructor() {
        super('WebGPU is not supported in this browser', 'WEBGPU_NOT_SUPPORTED');
    }
}

export class WASMLoadError extends EngineError {
    constructor(details: string) {
        super(`Failed to load WASM module: ${details}`, 'WASM_LOAD_ERROR');
    }
}
```

## 3. Zero-Copy Buffer Strategy with Error Handling

```typescript
// buffer-manager.ts
export class BufferManager {
    private wasmMemory: WebAssembly.Memory;
    private device: GPUDevice;
    
    constructor(wasmMemory: WebAssembly.Memory, device: GPUDevice) {
        this.wasmMemory = wasmMemory;
        this.device = device;
    }
    
    createVertexBuffer(offset: number, vertexCount: number): GPUBuffer {
        try {
            const size = vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT;
            const data = new Float32Array(
                this.wasmMemory.buffer,
                offset,
                vertexCount * 3
            );
            
            const buffer = this.device.createBuffer({
                label: 'Vertex Buffer',
                size: size,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            
            new Float32Array(buffer.getMappedRange()).set(data);
            buffer.unmap();
            
            return buffer;
        } catch (error) {
            throw new EngineError(
                `Failed to create vertex buffer: ${error}`,
                'BUFFER_CREATE_ERROR'
            );
        }
    }
    
    updateUniformBuffer(buffer: GPUBuffer, offset: number): void {
        const data = new Float32Array(this.wasmMemory.buffer, offset, 48);
        this.device.queue.writeBuffer(buffer, 0, data);
    }
}
```

## 4. Interface Specifications with TypeScript

### WASM Interface (Zig side remains the same)

```zig
// game_engine.zig - Same exports as before
export fn init() void
export fn update(delta_time: f32) void
export fn set_input(key: u8, pressed: bool) void
export fn generate_sphere_mesh(segments: u32) void
export fn get_vertex_buffer_offset() u32
export fn get_uniform_buffer_offset() u32
export fn get_vertex_count() u32
export fn set_position(x: f32, y: f32, z: f32) void
export fn apply_force(x: f32, y: f32, z: f32) void
export fn get_collision_state() u8
```

### TypeScript Engine Implementation

```typescript
// engine.ts - Main engine with error handling
import { EngineConfig, AssetConfig, WASMExports, GameEngine } from './types';
import { Renderer } from './renderer';
import { InputManager } from './input';
import { BufferManager } from './buffer-manager';

export class Engine implements GameEngine {
    private canvas: HTMLCanvasElement;
    private wasm?: WASMExports;
    private renderer?: Renderer;
    private input?: InputManager;
    private bufferManager?: BufferManager;
    private running = false;
    private lastTime = 0;
    private animationId?: number;
    
    constructor(canvasId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new EngineError(`Canvas with id '${canvasId}' not found`, 'CANVAS_NOT_FOUND');
        }
        this.canvas = canvas;
    }
    
    async init(config?: Partial<EngineConfig>): Promise<void> {
        try {
            // Check WebGPU support first
            if (!navigator.gpu) {
                throw new WebGPUNotSupportedError();
            }
            
            // Load WASM module
            this.wasm = await this.loadWASM();
            this.wasm.init();
            
            // Initialize renderer
            this.renderer = new Renderer();
            await this.renderer.init(this.canvas);
            
            // Initialize buffer manager
            this.bufferManager = new BufferManager(
                this.wasm.memory,
                this.renderer.getDevice()
            );
            
            // Initialize input manager
            this.input = new InputManager();
            this.input.init((key: number, pressed: boolean) => {
                this.wasm?.set_input(key, pressed);
            });
            
            // Apply config if provided
            if (config?.physics) {
                // Configure physics parameters in WASM
                // This would require additional WASM exports
            }
            
        } catch (error) {
            this.dispose();
            throw error;
        }
    }
    
    async loadAssets(assets: AssetConfig): Promise<void> {
        if (!this.wasm) {
            throw new EngineError('Engine not initialized', 'NOT_INITIALIZED');
        }
        
        if (assets.ball) {
            this.wasm.generate_sphere_mesh(assets.ball.segments);
        }
    }
    
    start(): void {
        if (!this.wasm || !this.renderer) {
            throw new EngineError('Engine not initialized', 'NOT_INITIALIZED');
        }
        
        this.running = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }
    
    stop(): void {
        this.running = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = undefined;
        }
    }
    
    dispose(): void {
        this.stop();
        this.input?.dispose();
        this.renderer?.dispose();
        // Clean up any other resources
    }
    
    private gameLoop = (): void => {
        if (!this.running) return;
        
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000.0, 0.1); // Cap at 100ms
        this.lastTime = currentTime;
        
        try {
            // Update physics/game state
            this.wasm!.update(deltaTime);
            
            // Check for collisions
            const collisionState = this.wasm!.get_collision_state();
            if (collisionState > 0) {
                this.handleCollisions(collisionState);
            }
            
            // Update rendering
            const vertexOffset = this.wasm!.get_vertex_buffer_offset();
            const vertexCount = this.wasm!.get_vertex_count();
            const uniformOffset = this.wasm!.get_uniform_buffer_offset();
            
            this.renderer!.render(
                this.wasm!.memory.buffer,
                vertexOffset,
                vertexCount,
                uniformOffset
            );
            
        } catch (error) {
            console.error('Game loop error:', error);
            this.stop();
            return;
        }
        
        this.animationId = requestAnimationFrame(this.gameLoop);
    }
    
    private handleCollisions(state: number): void {
        // Handle collision feedback (sound, particles, etc. in Phase II)
        if (state & 0x01) console.log('Floor collision');
        if (state & 0x02) console.log('Wall collision');
    }
    
    private async loadWASM(): Promise<WASMExports> {
        try {
            const response = await fetch('game_engine.wasm');
            if (!response.ok) {
                throw new WASMLoadError(`HTTP ${response.status}`);
            }
            
            const bytes = await response.arrayBuffer();
            const { instance } = await WebAssembly.instantiate(bytes, {
                env: {
                    // Add any imports if needed
                }
            });
            
            return instance.exports as unknown as WASMExports;
            
        } catch (error) {
            throw new WASMLoadError(error instanceof Error ? error.message : 'Unknown error');
        }
    }
}
```

## 5. Input Manager with Proper Cleanup

```typescript
// input.ts
export class InputManager {
    private keyMap: Map<string, number> = new Map([
        ['w', 87], ['a', 65], ['s', 83], ['d', 68], [' ', 32]
    ]);
    private callback?: (key: number, pressed: boolean) => void;
    private boundHandlers: { down: any, up: any };
    
    constructor() {
        this.boundHandlers = {
            down: this.handleKeyDown.bind(this),
            up: this.handleKeyUp.bind(this)
        };
    }
    
    init(callback: (key: number, pressed: boolean) => void): void {
        this.callback = callback;
        window.addEventListener('keydown', this.boundHandlers.down);
        window.addEventListener('keyup', this.boundHandlers.up);
    }
    
    dispose(): void {
        window.removeEventListener('keydown', this.boundHandlers.down);
        window.removeEventListener('keyup', this.boundHandlers.up);
    }
    
    private handleKeyDown(e: KeyboardEvent): void {
        const keyCode = this.keyMap.get(e.key.toLowerCase());
        if (keyCode && this.callback) {
            e.preventDefault();
            this.callback(keyCode, true);
        }
    }
    
    private handleKeyUp(e: KeyboardEvent): void {
        const keyCode = this.keyMap.get(e.key.toLowerCase());
        if (keyCode && this.callback) {
            e.preventDefault();
            this.callback(keyCode, false);
        }
    }
}
```

## 6. Renderer with WebGPU Feature Detection

```typescript
// renderer.ts
export class Renderer {
    private device?: GPUDevice;
    private context?: GPUCanvasContext;
    private pipeline?: GPURenderPipeline;
    private vertexBuffer?: GPUBuffer;
    private uniformBuffer?: GPUBuffer;
    private bindGroup?: GPUBindGroup;
    
    async init(canvas: HTMLCanvasElement): Promise<void> {
        // Get adapter with fallback options
        const adapter = await navigator.gpu?.requestAdapter({
            powerPreference: 'high-performance',
            forceFallbackAdapter: false,
        });
        
        if (!adapter) {
            throw new WebGPUNotSupportedError();
        }
        
        // Check for required features
        const requiredFeatures: GPUFeatureName[] = [];
        
        this.device = await adapter.requestDevice({
            requiredFeatures,
            requiredLimits: {
                maxBufferSize: adapter.limits.maxBufferSize,
                maxVertexBuffers: 1,
            }
        });
        
        const context = canvas.getContext('webgpu');
        if (!context) {
            throw new EngineError('Failed to get WebGPU context', 'CONTEXT_ERROR');
        }
        this.context = context;
        
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: presentationFormat,
            alphaMode: 'premultiplied',
        });
        
        await this.createPipeline(presentationFormat);
    }
    
    getDevice(): GPUDevice {
        if (!this.device) {
            throw new EngineError('Renderer not initialized', 'NOT_INITIALIZED');
        }
        return this.device;
    }
    
    render(wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number, uniformOffset: number): void {
        if (!this.device || !this.context || !this.pipeline) {
            throw new EngineError('Renderer not initialized', 'NOT_INITIALIZED');
        }
        
        // Update buffers from WASM memory
        this.updateBuffers(wasmMemory, vertexOffset, vertexCount, uniformOffset);
        
        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });
        
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup!);
        renderPass.setVertexBuffer(0, this.vertexBuffer!);
        renderPass.draw(vertexCount);
        renderPass.end();
        
        this.device.queue.submit([commandEncoder.finish()]);
    }
    
    dispose(): void {
        this.vertexBuffer?.destroy();
        this.uniformBuffer?.destroy();
        // Clean up other GPU resources
    }
    
    private async createPipeline(format: GPUTextureFormat): Promise<void> {
        const shaderModule = this.device!.createShaderModule({
            label: 'Ball Shader',
            code: this.getShaderCode(),
        });
        
        // Create buffers
        this.uniformBuffer = this.device!.createBuffer({
            size: 192, // 3 matrices * 16 floats * 4 bytes
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        // Create bind group layout
        const bindGroupLayout = this.device!.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' },
            }],
        });
        
        this.bindGroup = this.device!.createBindGroup({
            layout: bindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer },
            }],
        });
        
        // Create pipeline
        this.pipeline = this.device!.createRenderPipeline({
            layout: this.device!.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout],
            }),
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 12, // 3 floats * 4 bytes
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3',
                    }],
                }],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: format,
                }],
            },
            primitive: {
                topology: 'line-list', // Wireframe mode
                cullMode: 'none',
            },
        });
    }
    
    private updateBuffers(wasmMemory: ArrayBuffer, vertexOffset: number, vertexCount: number, uniformOffset: number): void {
        // Create/update vertex buffer
        const vertexData = new Float32Array(wasmMemory, vertexOffset, vertexCount * 3);
        const vertexSize = vertexData.byteLength;
        
        if (!this.vertexBuffer || this.vertexBuffer.size < vertexSize) {
            this.vertexBuffer?.destroy();
            this.vertexBuffer = this.device!.createBuffer({
                size: vertexSize,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }
        
        this.device!.queue.writeBuffer(this.vertexBuffer, 0, vertexData);
        
        // Update uniform buffer
        const uniformData = new Float32Array(wasmMemory, uniformOffset, 48);
        this.device!.queue.writeBuffer(this.uniformBuffer!, 0, uniformData);
    }
    
    private getShaderCode(): string {
        return `
            struct Uniforms {
                model: mat4x4<f32>,
                view: mat4x4<f32>,
                projection: mat4x4<f32>,
            }
            
            @binding(0) @group(0) var<uniform> uniforms: Uniforms;
            
            struct VertexOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) world_pos: vec3<f32>,
            }
            
            @vertex
            fn vs_main(@location(0) position: vec3<f32>) -> VertexOutput {
                var out: VertexOutput;
                let world_pos = uniforms.model * vec4<f32>(position, 1.0);
                out.position = uniforms.projection * uniforms.view * world_pos;
                out.world_pos = world_pos.xyz;
                return out;
            }
            
            @fragment
            fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
                return vec4<f32>(0.0, 1.0, 1.0, 1.0); // Cyan wireframe
            }
        `;
    }
}
```

## 7. Clean User-Facing API

```typescript
// main.ts - User entry point
import { Engine } from './engine';
import { AssetConfig } from './types';

// Simple usage - proof of concept demo
async function startDemo(): Promise<void> {
    try {
        const engine = new Engine('canvas');
        
        await engine.init({
            physics: {
                gravity: -9.8,
                friction: 0.1,
                bounds: { x: 10, y: 10, z: 10 }
            }
        });
        
        await engine.loadAssets({
            ball: { segments: 32, radius: 1.0 }
        });
        
        engine.start();
        
        // Handle cleanup on page unload
        window.addEventListener('beforeunload', () => {
            engine.dispose();
        });
        
    } catch (error) {
        console.error('Failed to start engine:', error);
        
        // Show user-friendly error message
        if (error instanceof Error) {
            if (error.message.includes('WebGPU')) {
                alert('Your browser does not support WebGPU. Please use Chrome Canary or Edge Canary.');
            } else {
                alert(`Engine initialization failed: ${error.message}`);
            }
        }
    }
}

// Start on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDemo);
} else {
    startDemo();
}
```

## 8. Zig Implementation (Core Physics for PoC)

```zig
// game_engine.zig - Focused on bouncing ball demo
const std = @import("std");

// Constants
const GRAVITY: f32 = -9.8;
const DAMPING: f32 = 0.99;
const RESTITUTION: f32 = 0.8;
const BOUNDS: Vec3 = .{ .x = 5.0, .y = 5.0, .z = 5.0 };

// Types
const Vec3 = struct {
    x: f32,
    y: f32,
    z: f32,
};

const Mat4 = struct {
    data: [16]f32,
    
    fn identity() MateatError {
        return .{ .data = .{
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        }};
    }
};

// State (pre-allocated)
var vertex_buffer: [10000]f32 = undefined;
var vertex_count: u32 = 0;

var model_matrix: Mat4 = Mat4.identity();
var view_matrix: Mat4 = Mat4.identity();
var projection_matrix: Mat4 = Mat4.identity();

var ball_position: Vec3 = .{ .x = 0, .y = 2, .z = 0 };
var ball_velocity: Vec3 = .{ .x = 0, .y = 0, .z = 0 };
var ball_radius: f32 = 0.5;

var input_state: u8 = 0; // Bitmask for WASD
var collision_state: u8 = 0; // Bitmask for collisions

// Exports
export fn init() void {
    // Set up view matrix (camera at (0, 0, 5) looking at origin)
    view_matrix = createLookAt(
        Vec3{ .x = 0, .y = 2, .z = 5 },
        Vec3{ .x = 0, .y = 0, .z = 0 },
        Vec3{ .x = 0, .y = 1, .z = 0 }
    );
    
    // Set up projection matrix
    projection_matrix = createPerspective(60.0, 1.333, 0.1, 100.0);
}

export fn update(delta_time: f32) void {
    collision_state = 0;
    
    // Apply input forces
    var force = Vec3{ .x = 0, .y = 0, .z = 0 };
    if (input_state & 0x01 != 0) force.z -= 5.0; // W
    if (input_state & 0x02 != 0) force.x -= 5.0; // A
    if (input_state & 0x04 != 0) force.z += 5.0; // S
    if (input_state & 0x08 != 0) force.x += 5.0; // D
    
    // Apply gravity
    force.y += GRAVITY;
    
    // Update velocity (F = ma, assuming m = 1)
    ball_velocity.x += force.x * delta_time;
    ball_velocity.y += force.y * delta_time;
    ball_velocity.z += force.z * delta_time;
    
    // Apply damping
    ball_velocity.x *= DAMPING;
    ball_velocity.z *= DAMPING;
    
    // Update position
    ball_position.x += ball_velocity.x * delta_time;
    ball_position.y += ball_velocity.y * delta_time;
    ball_position.z += ball_velocity.z * delta_time;
    
    // Collision detection and response
    // Floor collision
    if (ball_position.y - ball_radius < -BOUNDS.y) {
        ball_position.y = -BOUNDS.y + ball_radius;
        ball_velocity.y = -ball_velocity.y * RESTITUTION;
        collision_state |= 0x01;
    }
    
    // Wall collisions
    if (@abs(ball_position.x) + ball_radius > BOUNDS.x) {
        ball_position.x = std.math.sign(ball_position.x) * (BOUNDS.x - ball_radius);
        ball_velocity.x = -ball_velocity.x * RESTITUTION;
        collision_state |= 0x02;
    }
    
    if (@abs(ball_position.z) + ball_radius > BOUNDS.z) {
        ball_position.z = std.math.sign(ball_position.z) * (BOUNDS.z - ball_radius);
        ball_velocity.z = -ball_velocity.z * RESTITUTION;
        collision_state |= 0x02;
    }
    
    // Update model matrix with ball position
    model_matrix = Mat4.identity();
    model_matrix.data[12] = ball_position.x;
    model_matrix.data[13] = ball_position.y;
    model_matrix.data[14] = ball_position.z;
}

export fn set_input(key: u8, pressed: bool) void {
    const key_map = switch (key) {
        87 => @as(u8, 0x01), // W
        65 => @as(u8, 0x02), // A
        83 => @as(u8, 0x04), // S
        68 => @as(u8, 0x08), // D
        else => @as(u8, 0),
    };
    
    if (pressed) {
        input_state |= key_map;
    } else {
        input_state &= ~key_map;
    }
}

export fn generate_sphere_mesh(segments: u32) void {
    // Generate wireframe sphere
    vertex_count = generateWireframeSphere(&vertex_buffer, segments);
}

export fn get_vertex_buffer_offset() u32 {
    return @intFromPtr(&vertex_buffer);
}

export fn get_uniform_buffer_offset() u32 {
    return @intFromPtr(&model_matrix);
}

export fn get_vertex_count() u32 {
    return vertex_count;
}

export fn get_collision_state() u8 {
    return collision_state;
}

export fn set_position(x: f32, y: f32, z: f32) void {
    ball_position = .{ .x = x, .y = y, .z = z };
}

export fn apply_force(x: f32, y: f32, z: f32) void {
    ball_velocity.x += x;
    ball_velocity.y += y;
    ball_velocity.z += z;
}

// Helper functions
fn generateWireframeSphere(vertices: [*]f32, segments: u32) u32 {
    var index: u32 = 0;
    
    // Generate latitude lines
    var lat: u32 = 0;
    while (lat <= segments) : (lat += 1) {
        const theta = @as(f32, @floatFromInt(lat)) * std.math.pi / @as(f32, @floatFromInt(segments));
        const sin_theta = @sin(theta);
        const cos_theta = @cos(theta);
        
        var lon: u32 = 0;
        while (lon < segments) : (lon += 1) {
            const phi1 = @as(f32, @floatFromInt(lon)) * 2.0 * std.math.pi / @as(f32, @floatFromInt(segments));
            const phi2 = @as(f32, @floatFromInt(lon + 1)) * 2.0 * std.math.pi / @as(f32, @floatFromInt(segments));
            
            // First vertex
            vertices[index] = ball_radius * @cos(phi1) * sin_theta;
            vertices[index + 1] = ball_radius * cos_theta;
            vertices[index + 2] = ball_radius * @sin(phi1) * sin_theta;
            
            // Second vertex
            vertices[index + 3] = ball_radius * @cos(phi2) * sin_theta;
            vertices[index + 4] = ball_radius * cos_theta;
            vertices[index + 5] = ball_radius * @sin(phi2) * sin_theta;
            
            index += 6;
        }
    }
    
    return index / 3;
}

fn createLookAt(eye: Vec3, center: Vec3, up: Vec3) Mat4 {
    const f = normalize(Vec3{
        .x = center.x - eye.x,
        .y = center.y - eye.y,
        .z = center.z - eye.z,
    });
    const s = normalize(cross(f, up));
    const u = cross(s, f);
    
    return Mat4{ .data = .{
        s.x, u.x, -f.x, 0,
        s.y, u.y, -f.y, 0,
        s.z, u.z, -f.z, 0,
        -dot(s, eye), -dot(u, eye), dot(f, eye), 1,
    }};
}

fn createPerspective(fov: f32, aspect: f32, near: f32, far: f32) Mat4 {
    const f = 1.0 / @tan(fov * std.math.pi / 360.0);
    const range_inv = 1.0 / (near - far);
    
    return Mat4{ .data = .{
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * range_inv, -1,
        0, 0, 2.0 * far * near * range_inv, 0,
    }};
}

fn normalize(v: Vec3) Vec3 {
    const len = @sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return .{
        .x = v.x / len,
        .y = v.y / len,
        .z = v.z / len,
    };
}

fn cross(a: Vec3, b: Vec3) Vec3 {
    return .{
        .x = a.y * b.z - a.z * b.y,
        .y = a.z * b.x - a.x * b.z,
        .z = a.x * b.y - a.y * b.x,
    };
}

fn dot(a: Vec3, b: Vec3) f32 {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}