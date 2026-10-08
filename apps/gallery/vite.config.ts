import { defineConfig } from 'vite';

export default defineConfig({
  // Relative URLs, so the built site works from any folder on any static host.
  base: './',
  server: { port: 5174 },
  // three/webgpu alone is ~900 kB minified; the exporter and the bake load on the first download.
  build: { chunkSizeWarningLimit: 1600 },
  // watlas finds its WASM beside itself (`new URL(…, import.meta.url)`), which pre-bundling breaks.
  optimizeDeps: { exclude: ['watlas'] },
});
