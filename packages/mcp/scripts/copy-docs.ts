/**
 * Copies the docs the server serves as resources into dist/docs, so the published package
 * carries them (in the workspace the server reads the repository's docs/).
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { DOCS } from '../src/docs.ts';

const from = new URL('../../../docs/', import.meta.url);
const to = new URL('../dist/docs/', import.meta.url);
mkdirSync(to, { recursive: true });
for (const { file } of DOCS) copyFileSync(new URL(file, from), new URL(file, to));
console.log(`copied ${DOCS.length} docs to dist/docs`);
