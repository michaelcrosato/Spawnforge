/**
 * Renders every blueprint in examples/ to a labelled contact sheet beside it (<name>.png).
 *
 *   node scripts/render-examples.ts [name …]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Renderer } from '@spawnforge/render';

const dir = new URL('../examples/', import.meta.url).pathname;
const only = process.argv.slice(2);
const names = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .filter((n) => only.length === 0 || only.includes(n));
const renderer = await Renderer.launch();
try {
  for (const name of names) {
    const blueprint = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
    const { png, info } = await renderer.render({ blueprint, labels: true, size: 360 });
    writeFileSync(join(dir, `${name}.png`), png);
    console.log(
      `${name}.png  ${info.triangles} triangles, compiled in ${info.compileMs.toFixed(0)} ms`,
    );
  }
} finally {
  await renderer.close();
}
