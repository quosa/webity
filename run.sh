#!/bin/bash

# Compile Zig to WebAssembly
echo "Compiling Zig to WebAssembly..."
# SEE: https://ziggit.dev/t/zig-webassembly/2550/2
zig build-exe ./wasm_module.zig -target wasm32-freestanding -fno-entry -rdynamic

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed"
    exit 1
fi

echo "✅ Compilation successful"

# Check if Python server is already running on port 8080
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "🌐 Python server already running on port 8080"
    echo "Open http://localhost:8080 in your browser"
else
    echo "🌐 Starting Python web server on port 8080..."
    echo "Open http://localhost:8080 in your browser"
    echo "Press Ctrl+C to stop the server"
    python3 -m http.server 8080
fi