/**
 * Regenerates every generated file: the module pack index, docs/catalog.md and
 * docs/blueprint.schema.json. `--check` fails instead of writing when any is stale (CI runs it).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { blueprintJsonSchema, renderCatalog } from '@spawnforge/cli';
import { renderIndex } from '../packages/modules/scripts/generate-index.ts';

const root = new URL('../', import.meta.url);
const check = process.argv.includes('--check');

const outputs: [string, () => string][] = [
  ['packages/modules/src/index.ts', renderIndex],
  ['docs/catalog.md', renderCatalog],
  ['docs/blueprint.schema.json', () => `${JSON.stringify(blueprintJsonSchema(), null, 2)}\n`],
];

let stale = 0;
for (const [path, render] of outputs) {
  const url = new URL(path, root);
  const next = render();
  let current = '';
  try {
    current = readFileSync(url, 'utf8');
  } catch {}
  if (current === next) continue;
  stale++;
  if (check) {
    console.error(`${path} is stale; run \`pnpm generate\`.`);
  } else {
    writeFileSync(url, next);
    console.log(`wrote ${path}`);
  }
}
if (check && stale > 0) process.exit(1);
