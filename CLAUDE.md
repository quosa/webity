# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WebAssembly (WASM) project that demonstrates Zig integration with web browsers. The project compiles Zig code to WebAssembly and loads it in an HTML page for execution.

## Key Files

- `wasm_module.zig` - Main Zig source file containing exported functions
- `wasm_module.wasm` - Compiled WebAssembly binary (generated)
- `index.html` - Web page that loads and executes the WASM module
- `readme` - Contains build commands and development notes
- `cc.sh` - Claude Code configuration script with API settings

## Build Commands

Build the WebAssembly module from Zig source:
```bash
zig build-lib -target wasm32-freestanding -dynamic wasm_module.zig -O ReleaseSmall
```

## Development Server

Start local development server to test the WASM module:
```bash
python3 -m http.server 8080
```

Then open http://localhost:8080 in a browser to test the WebAssembly module.

## Architecture

The project follows a simple client-side WebAssembly pattern:
1. Zig functions are marked with `export` to be callable from JavaScript
2. The Zig code is compiled to WebAssembly targeting `wasm32-freestanding`
3. The HTML page uses `WebAssembly.instantiateStreaming()` to load and instantiate the WASM module
4. JavaScript calls exported functions directly on the WASM instance

## Prerequisites

- Zig 0.15.1 or compatible version
- Python 3 for development server
- Modern web browser with WebAssembly support
- remember to run npm run typecheck && npm run test before claiming a phase complete