import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 900, rollupOptions: { input: {game:'index.html',quality:'quality-review.html'}, output: { manualChunks: { three: ['three'] } } } } });
