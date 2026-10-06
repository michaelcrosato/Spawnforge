/**
 * Measures the plan's budgets: compile time (Node, and Chromium as in the sandbox), skin
 * triangles, draw calls and motion update time for one and for 50 creatures.
 *
 *   node scripts/budgets.ts [--out report.json]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  type CompiledCreature,
  compileCreature,
  createRegistry,
  MotionController,
  resolveBlueprint,
  testCourse,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { Renderer } from '@spawnforge/render';

const { values } = parseArgs({ options: { out: { type: 'string' } } });
const registry = createRegistry([basicPack]);
const dir = new URL('../examples/', import.meta.url);
const examples = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({
    name: f.replace('.json', ''),
    lines: readFileSync(new URL(f, dir), 'utf8').split('\n').length,
    blueprint: JSON.parse(readFileSync(new URL(f, dir), 'utf8')),
  }));

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const ground = testCourse(1, 0.3, 2);
const perExample: Record<string, unknown>[] = [];
const compiled: CompiledCreature[] = [];
const renderer = await Renderer.launch();
try {
  for (const { name, lines, blueprint } of examples) {
    const spec = resolveBlueprint(blueprint, registry);
    // Warm up, then take the median of five compiles.
    compileCreature(spec, registry, { quality: 'medium' });
    const times = Array.from({ length: 5 }, () => {
      const t = performance.now();
      compiled.push(compileCreature(spec, registry, { quality: 'medium' }));
      return performance.now() - t;
    });
    const c = compiled.at(-1) as CompiledCreature;
    // In Chromium, through the render page (the second render is warm).
    await renderer.render({ blueprint, size: 64, views: ['side'] });
    const chrome = (await renderer.render({ blueprint, size: 64, views: ['side'] })).info.compileMs;
    const controller = new MotionController(c, { registry });
    controller.drive(controller.paceSpeed(), 0.3);
    for (let i = 0; i < 600; i++) controller.update(1 / 60, { ground });
    const t = performance.now();
    for (let i = 0; i < 3000; i++) controller.update(1 / 60, { ground });
    perExample.push({
      name,
      lines,
      compileMs: Number(median(times).toFixed(0)),
      chromeCompileMs: Number(chrome.toFixed(0)),
      skinTriangles: c.stats.triangles.skin,
      // Fur adds one instanced call (none at low quality).
      drawCalls:
        [c.skin, c.parts, c.eyes].filter((m) => m.indices.length > 0).length +
        (c.material.fur && c.quality !== 'low' ? 1 : 0),
      motionMsPerFrame: Number(((performance.now() - t) / 3000).toFixed(3)),
    });
  }
} finally {
  await renderer.close();
}

// Fifty creatures walking at once, one 60 Hz frame each.
const herd = Array.from({ length: 50 }, (_, i) => {
  const c = new MotionController(compiled[(i * 5) % compiled.length] as CompiledCreature, {
    registry,
  });
  c.position.set((i % 10) * 3, 0, Math.floor(i / 10) * 3);
  c.drive(c.paceSpeed(), i);
  return c;
});
for (let f = 0; f < 300; f++) for (const c of herd) c.update(1 / 60, { ground });
const frames: number[] = [];
for (let f = 0; f < 300; f++) {
  const t = performance.now();
  for (const c of herd) c.update(1 / 60, { ground });
  frames.push(performance.now() - t);
}
const report = {
  budgets: {
    compileMs: 500,
    skinTriangles: 30000,
    drawCalls: 3,
    furDrawCalls: 1,
    motionMsPerCreature: 0.1,
    motionMsFor50: 5,
  },
  examples: perExample,
  herd50: { medianMsPerFrame: Number(median(frames).toFixed(2)) },
};
if (values.out) writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
