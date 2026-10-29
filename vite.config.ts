import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  build: {
    target: 'es2023',
    chunkSizeWarningLimit: 1600, // Phaser seul pèse ~1,4 Mo (360 Ko gzip)
    rolldownOptions: {
      output: {
        // Phaser est volumineux : on l'isole dans son propre chunk (meilleur cache navigateur)
        manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
});
