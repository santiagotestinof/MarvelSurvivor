import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el build funciona en GitHub Pages u otro hosting estático.
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  server: { port: 5173 },
});
