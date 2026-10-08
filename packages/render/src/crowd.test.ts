import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Renderer } from './index.ts';

/** Crowds (docs/design/11.3-crowds.md): drawn on the GPU exactly as the creature's own bones. */
let renderer: Renderer;

beforeAll(async () => {
  renderer = await Renderer.launch();
}, 120_000);

afterAll(async () => {
  await renderer?.close();
});

const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));

describe('crowds', () => {
  it.each([
    ['grey-wolf', undefined],
    ['ember-beetle', undefined],
    ['cave-bat', 'fly'],
  ] as const)(
    'poses %s in a crowd as its own skeleton does',
    async (name, clip) => {
      const r = await renderer.crowd({ blueprint: example(name), ...(clip ? { clip } : {}) });
      expect(r.covered).toBeGreaterThan(0.02);
      expect(r.differing, `${r.clip} frame ${r.frame}: mean ${r.mean}`).toBeLessThan(0.001);
    },
    120_000,
  );
});
