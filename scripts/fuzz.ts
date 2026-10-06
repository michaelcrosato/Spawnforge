/**
 * Compiles random blueprints drawn from the schema (the PoC gate asks for 1,000 without an
 * error) and reports failures, compile times and triangle counts.
 *
 *   node scripts/fuzz.ts [count=1000] [quality=medium] [--out report.json]
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  compileCreature,
  createRegistry,
  createRng,
  formatIssue,
  type Quality,
  randomBlueprint,
  validateBlueprint,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string' } },
});
const count = Number(positionals[0] ?? 1000);
const quality = (positionals[1] ?? 'medium') as Quality;
const registry = createRegistry([basicPack]);
const failures: { index: number; error: string; blueprint: unknown }[] = [];
const invalid: { index: number; errors: string[] }[] = [];
const times: number[] = [];
let maxTriangles = 0;
const started = performance.now();
for (let i = 0; i < count; i++) {
  const blueprint = randomBlueprint(registry, createRng(1000 + i), `Fuzz ${i}`);
  const result = validateBlueprint(blueprint, registry, { minimal: false });
  if (!result.ok || !result.creature) {
    invalid.push({ index: i, errors: result.errors.map(formatIssue) });
    continue;
  }
  try {
    const t = performance.now();
    const compiled = compileCreature(result.creature, registry, { quality });
    times.push(performance.now() - t);
    maxTriangles = Math.max(maxTriangles, compiled.stats.triangles.skin);
    for (const list of [compiled.skin.positions, compiled.parts.positions, compiled.eyes.positions])
      for (const v of list) if (!Number.isFinite(v)) throw new Error('non-finite vertex position');
  } catch (error) {
    failures.push({ index: i, error: (error as Error).message, blueprint });
  }
  if ((i + 1) % 100 === 0) console.error(`${i + 1}/${count}`);
}
times.sort((a, b) => a - b);
const pct = (p: number) => Number((times[Math.floor((times.length - 1) * p)] ?? 0).toFixed(1));
const report = {
  count,
  quality,
  valid: count - invalid.length,
  compiled: times.length,
  failures: failures.length,
  compileMs: { median: pct(0.5), p95: pct(0.95), max: pct(1) },
  maxSkinTriangles: maxTriangles,
  seconds: Number(((performance.now() - started) / 1000).toFixed(1)),
  failed: failures,
  invalid: invalid.slice(0, 20),
};
if (values.out) writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    { ...report, failed: failures.map((f) => f.index), invalid: invalid.length },
    null,
    2,
  ),
);
process.exitCode = failures.length > 0 ? 1 : 0;
