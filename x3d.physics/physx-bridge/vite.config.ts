import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  server: { port: 5181, strictPort: true, host: '127.0.0.1' },
  preview: { port: 5182, strictPort: true, host: '127.0.0.1' },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['physx-js-webidl'] },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        sidebyside: resolve(import.meta.dirname, 'sidebyside.html'),
        machine: resolve(import.meta.dirname, 'machine.html'),
        musicbox: resolve(import.meta.dirname, 'musicbox.html'),
        dominoes: resolve(import.meta.dirname, 'dominoes.html'),
        trebuchet: resolve(import.meta.dirname, 'trebuchet.html'),
        galton: resolve(import.meta.dirname, 'galton.html'),
        ragdoll: resolve(import.meta.dirname, 'ragdoll.html'),
        barrage: resolve(import.meta.dirname, 'barrage.html'),
      },
    },
  },
});
