/**
 * Measures the plan's budgets: compile time (Node, and Chromium as in the sandbox), skin
 * triangles, draw calls, the size and export time of a medium `.glb` with texture maps (11.1),
 * the time to make a creature's levels of detail (11.2), and motion update time for one and for
 * 50 creatures.
 *
 *   node scripts/budgets.ts [name …] [--out report.json]
 *
 * Names limit it to those examples (the herd still walks the ones measured).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { simplifyChain } from '@spawnforge/bake/lod';
import {
  type CompiledCreature,
  compileCreature,
  createRegistry,
  MotionController,
  openSea,
  resolveBlueprint,
  testCourse,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { Renderer } from '@spawnforge/render';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string' } },
});
const registry = createRegistry([basicPack]);
const dir = new URL('../examples/', import.meta.url);
const examples = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({
    name: f.replace('.json', ''),
    lines: readFileSync(new URL(f, dir), 'utf8').split('\n').length,
    blueprint: JSON.parse(readFileSync(new URL(f, dir), 'utf8')),
  }))
  .filter((e) => positionals.length === 0 || positionals.includes(e.name));

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const ground = testCourse(1, 0.3, 2);
const perExample: Record<string, unknown>[] = [];
const compiled: CompiledCreature[] = [];
const renderer = await Renderer.launch();
try {
  // The first export loads xatlas and starts the bake workers: not part of any example's time.
  if (examples[0]) await renderer.export({ blueprint: examples[0].blueprint, textures: 512 });
  for (const { name, lines, blueprint } of examples) {
    const spec = resolveBlueprint(blueprint, registry);
    // Warm up, then take the median of five compiles.
    let c = compileCreature(spec, registry, { quality: 'medium' });
    const times = Array.from({ length: 5 }, () => {
      const t = performance.now();
      c = compileCreature(spec, registry, { quality: 'medium' });
      return performance.now() - t;
    });
    // One kept per example: the rest are garbage, not a heap the motion timing works around.
    compiled.push(c);
    // Its levels of detail, skin and parts, as the runtime makes them (warm: the median of three).
    await simplifyChain(c.skin);
    const lodTimes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      await simplifyChain(c.skin);
      await simplifyChain(c.parts);
      lodTimes.push(performance.now() - t);
    }
    // In Chromium, through the render page: the median of three warm compiles.
    await renderer.render({ blueprint, size: 64, views: ['side'] });
    const chromeTimes: number[] = [];
    for (let i = 0; i < 3; i++)
      chromeTimes.push(
        (await renderer.render({ blueprint, size: 64, views: ['side'] })).info.compileMs,
      );
    const chrome = median(chromeTimes);
    // A medium .glb with its maps, as `spawnforge export` writes it.
    const { info } = await renderer.export({ blueprint, quality: 'medium' });
    perExample.push({
      name,
      lines,
      compileMs: Number(median(times).toFixed(0)),
      chromeCompileMs: Number(chrome.toFixed(0)),
      skinTriangles: c.stats.triangles.skin,
      partTriangles: c.stats.triangles.parts,
      membraneTriangles: c.stats.triangles.membranes,
      // Fur adds one instanced call (none at low quality); membranes one more (9.3).
      drawCalls:
        [c.skin, c.parts, c.eyes, c.membranes].filter((m) => m.indices.length > 0).length +
        (c.material.fur && c.quality !== 'low' ? 1 : 0),
      lodMs: Number(median(lodTimes).toFixed(0)),
      glbMB: Number((info.bytes / 1e6).toFixed(2)),
      exportMs: Math.round(info.exportMs),
    });
  }
} finally {
  await renderer.close();
}

// Motion is timed with Chromium closed, so its processes do not share the CPU (gate 10).
for (const [k, row] of perExample.entries()) {
  const c = compiled[k] as CompiledCreature;
  const controller = new MotionController(c, { registry });
  // A body that only swims is timed swimming in open water (10.3).
  const swims = !c.motion.gaits.some((g) => (g.medium ?? 'land') === 'land');
  const sea = swims ? openSea(c.scale) : undefined;
  const input = sea ?? { ground };
  if (sea) controller.place(0, 0, 0, sea.ground, sea.water);
  controller.drive(controller.paceSpeed(), 0.3);
  for (let i = 0; i < 600; i++) controller.update(1 / 60, input);
  const t = performance.now();
  for (let i = 0; i < 3000; i++) controller.update(1 / 60, input);
  row.motionMsPerFrame = Number(((performance.now() - t) / 3000).toFixed(3));
  // A flyer is also timed flying, circling over the course (10.4).
  const flyer = new MotionController(c, { registry });
  if (flyer.canFly) {
    flyer.place(0, 0, 0, ground, undefined, { flying: true });
    flyer.fly();
    for (let i = 0; i < 600; i++) flyer.update(1 / 60, { ground });
    const tf = performance.now();
    for (let i = 0; i < 3000; i++) flyer.update(1 / 60, { ground });
    row.flyingMsPerFrame = Number(((performance.now() - tf) / 3000).toFixed(3));
  }
}

// Fifty creatures walking at once, one 60 Hz frame each.
const herd = Array.from({ length: 50 }, (_, i) => {
  const c = new MotionController(compiled[i % compiled.length] as CompiledCreature, {
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
    partTriangles: 20000,
    membraneTriangles: 12000,
    drawCalls: 3,
    furDrawCalls: 1,
    membraneDrawCalls: 1,
    lodMs: 100,
    glbMB: 8,
    exportMs: 10000,
    motionMsPerCreature: 0.1,
    flyingMsPerCreature: 0.15,
    motionMsFor50: 5,
  },
  examples: perExample,
  herd50: { medianMsPerFrame: Number(median(frames).toFixed(2)) },
};
if (values.out) writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
