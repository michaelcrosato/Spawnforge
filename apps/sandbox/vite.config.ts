import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  // three/webgpu alone is ~900 kB minified; the sandbox is a dev tool, so don't warn about it.
  build: { chunkSizeWarningLimit: 1500 },
});
