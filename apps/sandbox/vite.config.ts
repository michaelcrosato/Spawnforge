import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { creaturesFolder } from './creatures-plugin.ts';

export default defineConfig({
  server: { port: 5173 },
  // three/webgpu alone is ~900 kB minified; the sandbox is a dev tool, so don't warn about it.
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [creaturesFolder(fileURLToPath(new URL('../../creatures/', import.meta.url)))],
});
