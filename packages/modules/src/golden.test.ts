import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { compileCreature, createRegistry, fingerprint, resolveBlueprint } from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/**
 * Golden test: every example compiles to the same quantized mesh and skeleton as recorded in
 * golden.json beside this file (the render tests check Chrome against it too). A change here
 * changes saved creatures: update on purpose with UPDATE_GOLDEN=1 and say why in the commit.
 */
const registry = createRegistry([basicPack]);
const dir = new URL('../../../examples/', import.meta.url);
const goldenFile = new URL('./golden.json', import.meta.url);
const names = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''));

const actual: Record<string, Record<string, string>> = {};
for (const name of names) {
  const blueprint = JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'));
  const spec = resolveBlueprint(blueprint, registry);
  actual[name] = {
    low: fingerprint(compileCreature(spec, registry, { quality: 'low' })),
    medium: fingerprint(compileCreature(spec, registry, { quality: 'medium' })),
  };
}
if (process.env.UPDATE_GOLDEN) writeFileSync(goldenFile, `${JSON.stringify(actual, null, 2)}\n`);

describe('golden examples', () => {
  const golden = JSON.parse(readFileSync(goldenFile, 'utf8')) as typeof actual;
  it.each(names)('%s compiles to its recorded mesh and skeleton', (name) => {
    expect(actual[name]).toEqual(golden[name]);
  });
});
