import { defineConfig } from 'vite';
import { resolve } from 'path';
import { globSync } from 'glob';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Find all HTML files in src directory
const htmlFiles = globSync('src/**/*.html', { absolute: false });

// Create input object for Vite multi-page build
const input = htmlFiles.reduce((acc, file) => {
    // Generate a unique name for each entry point
    // e.g., 'src/scenes/rain/index.html' -> 'scenes/rain/index'
    const name = file
        .replace(/^src\//, '')
        .replace(/\.html$/, '')
        .replace(/\//g, '-');
    acc[name] = resolve(__dirname, file);
    return acc;
}, {} as Record<string, string>);

export default defineConfig({
    plugins: [basicSsl()],
    root: './src',
    publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input,
        },
        target: 'es2022',
        sourcemap: true,
    },
    server: {
        port: 5173,
        host: true,
        fs: {
            allow: ['..'],
        },
    },
    preview: {
        port: 8080,
        host: true,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    assetsInclude: ['**/*.wasm'],
    optimizeDeps: {
        exclude: ['@webgpu/types'],
    },
    esbuild: {
        target: 'es2022',
    },
    define: {
        // Enable WebGPU types
        'globalThis.__WEBGPU_TYPES__': true,
    },
});