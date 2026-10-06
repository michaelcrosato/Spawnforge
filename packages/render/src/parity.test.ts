import { readdirSync, readFileSync } from 'node:fs';
import {
  type CompiledCreature,
  compileCreature,
  cpuKit,
  createRegistry,
  FORMAT,
  resolveBlueprint,
  shadeMouth,
  shadeSkin,
  surfaceAt,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Renderer } from './index.ts';

/**
 * The CPU–GPU parity test (docs/design/8.4-materials.md): every pattern is written once against
 * `Kit<F>`, and runs as numbers for bakes and as TSL on the GPU. Here both backends evaluate the
 * same skin vertices and must agree.
 */
const registry = createRegistry([basicPack]);
let renderer: Renderer;

beforeAll(async () => {
  renderer = await Renderer.launch();
}, 120_000);

afterAll(async () => {
  await renderer?.close();
});

/** Between them, every pattern module (and both shapes of the glow). */
const STACKS = [
  [
    { type: 'countershade' },
    { type: 'stripes', count: 14, jitter: 0.5 },
    { type: 'spots', ring: 0.5 },
    { type: 'mottle', scale: 0.1 },
    { type: 'grime' },
    { type: 'scales', size: 0.03 },
    { type: 'scars', count: 20, rake: 3, length: 0.3 },
    { type: 'warts', size: 0.03, density: 0.8 },
    { type: 'veins', width: 0.02, density: 0.8 },
  ],
  [
    { type: 'rosettes', centerColor: '#a07040' },
    { type: 'bands', count: 10 },
    { type: 'slime', drips: 0.8 },
    { type: 'bioluminescence', shape: 'spots', density: 0.8, size: 0.04 },
    { type: 'bioluminescence', shape: 'lines', color: '#ff60a0', density: 0.9 },
    { type: 'stripes', direction: 'along', count: 6 },
  ],
];
const MATERIALS = ['skin', 'hide', 'scales', 'chitin'] as const;

/** About `count` vertices spread over the skin, plus every one inside the mouth. */
function samplesOf(compiled: CompiledCreature, count: number): number[] {
  const n = compiled.skin.positions.length / 3;
  const step = Math.max(1, Math.floor(n / count));
  const picked: number[] = [];
  for (let v = 0; v < n; v += step) picked.push(v);
  for (let v = 0; v < n; v++)
    if ((compiled.skin.body[v * 4 + 2] as number) <= -1 && v % step !== 0) picked.push(v);
  return picked;
}

/** The CPU kit's outputs at the samples, in the page's layout (three passes of four floats). */
function cpuPasses(compiled: CompiledCreature, samples: readonly number[]): number[][] {
  const passes: number[][] = [[], [], []];
  for (const v of samples) {
    const shade = shadeSkin(cpuKit, surfaceAt(compiled, v), compiled.material, registry);
    const body = compiled.skin.body;
    const mouth = shadeMouth(cpuKit, body[v * 4 + 2] as number, body[v * 4 + 3] as number);
    passes[0]?.push(shade.r, shade.g, shade.b, shade.roughness);
    passes[1]?.push(shade.height * 1000, shade.er, shade.eg, shade.eb);
    passes[2]?.push(mouth.r, mouth.g, mouth.b, mouth.inside);
  }
  return passes;
}

/** Compares the two backends: the share of samples with every output within `tolerance`. */
async function compare(blueprint: unknown, count = 2048) {
  const compiled = compileCreature(resolveBlueprint(blueprint, registry), registry, {
    quality: 'low',
  });
  const samples = samplesOf(compiled, count);
  const gpu = await renderer.parity({ blueprint, quality: 'low', samples });
  const cpu = cpuPasses(compiled, samples);
  // Half-float targets keep about three significant digits.
  const tolerance = gpu.precision === 'float' ? 2 / 255 : 4 / 255;
  let agree = 0;
  let worst = 0;
  const outliers: string[] = [];
  samples.forEach((v, i) => {
    let error = 0;
    for (let pass = 0; pass < 3; pass++)
      for (let c = 0; c < 4; c++) {
        const a = cpu[pass]?.[i * 4 + c] as number;
        const b = gpu.passes[pass]?.[i * 4 + c] as number;
        // Relief is × 1000 and glow can exceed 1: compare those relative to their size.
        const scale = Math.max(1, Math.abs(a));
        error = Math.max(error, Math.abs(a - b) / scale);
      }
    worst = Math.max(worst, error);
    if (error <= tolerance) agree++;
    else if (outliers.length < 5) outliers.push(`vertex ${v}: ${error.toFixed(4)}`);
  });
  return { share: agree / samples.length, worst, outliers, samples: samples.length };
}

describe('CPU–GPU parity of the pattern stack', () => {
  for (const [s, layers] of STACKS.entries())
    for (const material of MATERIALS)
      it(`stack ${s + 1} on ${material}: both backends agree`, async () => {
        const result = await compare({
          format: FORMAT,
          extends: s === 0 ? 'quadruped' : 'serpent',
          seed: 11 + s,
          skin: { material, layers },
        });
        // A sample on a cell boundary can land in the neighbouring cell after float32 rounding.
        expect(result.share, JSON.stringify(result)).toBeGreaterThanOrEqual(0.99);
      }, 120_000);

  it('the examples: both backends agree', async () => {
    const names = readdirSync(new URL('../../../examples/', import.meta.url))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
    for (const name of names) {
      const blueprint = JSON.parse(
        readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'),
      );
      const result = await compare(blueprint, 1024);
      expect(result.share, `${name}: ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(0.99);
    }
  }, 120_000);
});
