import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
      },
    },
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 8080,
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