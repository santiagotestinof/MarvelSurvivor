import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el build funciona en GitHub Pages u otro hosting estático.
  base: './',
  // Cambia en cada build: se usa para que el navegador no use sprites viejos guardados en caché.
  define: { __BUILD_ID__: JSON.stringify(String(Date.now())) },
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
