/**
 * Checks a phase 6 export eval run: `node eval/export.ts eval/runs/<run>`. Each task in
 * eval/export.json saves files in the run folder; this reads the .glb files (glTF JSON chunk and
 * the `spawnforge` extras) and checks what the task asked for, then writes `export-score.json`.
 * Gate: at least 3 of 4 tasks pass.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRegistry, measureBody, validateBlueprint } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';

type Json = Record<string, unknown>;
const registry = createRegistry([basicPack]);
const dir = process.argv[2] ?? '';
if (!dir) throw new Error('usage: node eval/export.ts <run folder>');

const need = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message);
};

/** The glTF JSON of a .glb, and its `spawnforge` extras. */
function glb(file: string): { json: Json; extras: Json } {
  const path = join(dir, file);
  need(existsSync(path), `${file} is missing`);
  const bytes = readFileSync(path);
  need(bytes.subarray(0, 4).toString() === 'glTF', `${file} is not a .glb`);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')) as Json;
  const node = (json.nodes as Json[]).find((n) => (n.extras as Json | undefined)?.spawnforge);
  if (!node) throw new Error(`${file} has no spawnforge extras`);
  return { json, extras: (node.extras as Json).spawnforge as Json };
}
const clipNames = (json: Json) => ((json.animations as Json[]) ?? []).map((a) => a.name as string);
const specOf = (extras: Json) => {
  const result = validateBlueprint(extras.blueprint, registry, { minimal: false });
  need(result.ok && result.creature !== undefined, 'the blueprint in the extras is invalid');
  return result.creature as NonNullable<typeof result.creature>;
};

const checks: Record<string, () => string> = {
  'x01-clip-subset': () => {
    const { json, extras } = glb('x01.glb');
    const names = clipNames(json).sort();
    need(JSON.stringify(names) === '["bite","tripod"]', `clips: ${names.join(', ')}`);
    need(extras.quality === 'low', `quality ${String(extras.quality)}`);
    return `clips ${names.join(', ')}, low quality`;
  },
  'x02-insect-stats': () => {
    const { extras } = glb('x02.glb');
    const stats = extras.stats as { module?: string; values?: Json } | undefined;
    need(stats?.module === 'rpg', `stats: ${JSON.stringify(stats)}`);
    need(typeof stats?.values?.health === 'number', 'no health value');
    const legs = specOf(extras).limbs.filter((l) => l.role === 'leg').length;
    need(legs === 6, `${legs} legs, not an insect`);
    return `rpg stats, health ${String(stats?.values?.health)}`;
  },
  'x03-small-demon': () => {
    const { json, extras } = glb('x03.glb');
    const names = clipNames(json);
    for (const clip of ['idle', 'walk', 'bite', 'roar'])
      need(names.includes(clip), `no ${clip} clip (has ${names.join(', ')})`);
    const height = measureBody(specOf(extras), registry).height;
    need(height <= 1.2 + 1e-3, `body height ${height.toFixed(2)} m`);
    return `body height ${height.toFixed(2)} m, clips ${names.join(', ')}`;
  },
  'x04-read-export': () => {
    const { json, extras } = glb('x04.glb');
    const answer = JSON.parse(readFileSync(join(dir, 'x04.json'), 'utf8')) as Json;
    const nodes = (json.nodes as Json[]).map((n) => n.name);
    need(
      answer.node === 'socket_mouth',
      `node ${String(answer.node)} (nodes include socket_mouth)`,
    );
    need(nodes.includes(answer.node), 'that node is not in the file');
    const bite = (extras.clips as Json[]).find((c) => c.name === 'bite') as Json;
    const contact = (bite.events as Json[]).find((e) => e.type === 'bite-contact') as Json;
    need(
      Math.abs((answer.biteSeconds as number) - (bite.duration as number)) < 0.02,
      `biteSeconds ${String(answer.biteSeconds)} vs ${String(bite.duration)}`,
    );
    need(
      Math.abs((answer.contactSeconds as number) - (contact.time as number)) < 0.02,
      `contactSeconds ${String(answer.contactSeconds)} vs ${String(contact.time)}`,
    );
    return `${String(answer.node)}, bite ${String(answer.biteSeconds)} s, contact ${String(answer.contactSeconds)} s`;
  },
};

const rows = Object.entries(checks).map(([id, check]) => {
  try {
    return { id, pass: true, note: check() };
  } catch (error) {
    return { id, pass: false, note: (error as Error).message };
  }
});
const passed = rows.filter((r) => r.pass).length;
console.log('| Task | Result | Note |\n| --- | --- | --- |');
for (const r of rows) console.log(`| ${r.id} | ${r.pass ? 'pass' : 'FAIL'} | ${r.note} |`);
console.log(`\n${passed}/${rows.length} tasks pass. Gate (≥ 3): ${passed >= 3 ? 'PASS' : 'FAIL'}`);
writeFileSync(
  join(dir, 'export-score.json'),
  `${JSON.stringify({ passed, total: rows.length, rows }, null, 2)}\n`,
);
