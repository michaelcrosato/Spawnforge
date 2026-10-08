import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { creaturesFolder } from './creatures-plugin.ts';

export default defineConfig({
  server: { port: 5173 },
  // three/webgpu alone is ~900 kB minified; the sandbox is a dev tool, so don't warn about it.
  // Exports compile on the page (for the distance field), which keeps the pipeline in the main
  // chunk; the bake and the exporter load on the first export.
  build: { chunkSizeWarningLimit: 1600 },
  // watlas finds its WASM beside itself (`new URL(…, import.meta.url)`), which pre-bundling breaks.
  optimizeDeps: { exclude: ['watlas'] },
  plugins: [creaturesFolder(fileURLToPath(new URL('../../creatures/', import.meta.url)))],
});
