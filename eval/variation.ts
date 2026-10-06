/**
 * Checks a phase 5 variation eval run: `node eval/variation.ts eval/runs/<run>`. Each task in
 * eval/variation.json saves files in the run folder; this validates them and checks what the
 * task asked for, then writes `variation-score.json`. Gate: at least 7 of 8 tasks pass.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createRegistry,
  expand,
  isRange,
  isSpecies,
  measureBody,
  validateBlueprint,
  validateSpecies,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';

type Json = Record<string, unknown>;
const registry = createRegistry([basicPack]);
const dir = process.argv[2];
if (!dir) throw new Error('usage: node eval/variation.ts <run folder>');
const root = new URL('../', import.meta.url);

const load = (file: string): Json => {
  const path = join(dir, file);
  if (!existsSync(path)) throw new Error(`${file} is missing`);
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
};
const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`examples/${name}.json`, root), 'utf8')) as Json;
const spec = (bp: Json) => {
  const result = validateBlueprint(bp, registry, { minimal: false });
  if (!result.ok || !result.creature)
    throw new Error(`invalid: ${result.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`);
  return result.creature;
};
const doc = (bp: Json) => {
  const out = expand(bp, registry).doc;
  if (!out) throw new Error('cannot expand');
  return out as Json;
};
const ranges = (value: unknown, path = ''): string[] => {
  if (isRange(value)) return [path];
  if (Array.isArray(value)) return value.flatMap((v, i) => ranges(v, `${path}[${i}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => ranges(v, path ? `${path}.${k}` : k));
  return [];
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const need = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message);
};
const lightness = (hex: string) => {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (Math.max(...c) + Math.min(...c)) / 510;
};
const horn = (bp: Json) =>
  spec(bp).parts.find((p) => p.type === 'horn.curved')?.params.length as number | undefined;

const checks: Record<string, () => string> = {
  'v01-wolf-species': () => {
    const species = load('v01.species.json');
    need(isSpecies(species), 'v01.species.json has no ranges');
    const checked = validateSpecies(species, registry);
    need(checked.ok, `species invalid: ${checked.errors.map((e) => e.path).join(', ')}`);
    need(ranges(species).length >= 3, 'fewer than 3 ranges');
    const kids = ['a', 'b', 'c'].map((k) => load(`v01.${k}.json`));
    for (const kid of kids) {
      const s = spec(kid);
      need(s.scale >= 0.9 - 1e-9 && s.scale <= 1.3 + 1e-9, `scale ${s.scale} outside 0.9–1.3`);
      need(s.limbs.filter((l) => l.role === 'leg').length === 4, 'not four-legged');
    }
    need(!same(kids[0], kids[1]) && !same(kids[1], kids[2]), 'individuals are identical');
    return `${ranges(species).length} ranges, 3 individuals`;
  },
  'v02-small-demon': () => {
    const s = spec(load('v02.json'));
    const height = measureBody(s, registry).height;
    need(height <= 1.0 + 1e-3, `body height ${height.toFixed(2)} m`);
    const actions = s.motion.actions.map((a) => a.type);
    need(actions.includes('bite') && actions.includes('roar'), `actions ${actions.join(', ')}`);
    return `body height ${height.toFixed(2)} m`;
  },
  'v03-locked-mutant': () => {
    const parent = example('ridgeback-stalker');
    const child = load('v03.json');
    spec(child);
    need(same(doc(child).skin, doc(parent).skin), 'skin differs from the parent');
    const [a, b] = [horn(parent) ?? 0, horn(child) ?? 0];
    need(b >= a * 1.15, `horn length ${b} vs parent ${a}`);
    const changed = JSON.stringify(doc(child).body) !== JSON.stringify(doc(parent).body);
    need(changed, 'the body did not change at all (not a mutant)');
    return `horns ${a} → ${b}`;
  },
  'v04-troll-beetle': () => {
    const troll = example('bog-troll');
    const child = load('v04.json');
    const s = spec(child);
    need(s.limbs.filter((l) => l.role === 'leg').length === 2, 'not two-legged');
    need(s.body.torso.pitch > 45, `torso pitch ${s.body.torso.pitch} is not upright`);
    need(
      !same(doc(child).body, doc(troll).body) || !same(doc(child).skin, doc(troll).skin),
      'identical to the troll',
    );
    return `upright biped, torso pitch ${s.body.torso.pitch}`;
  },
  'v05-horned-insect': () => {
    const bp = load('v05.json');
    const s = spec(bp);
    need(s.limbs.filter((l) => l.role === 'leg').length === 6, 'not six-legged');
    const length = horn(bp) ?? 0;
    need(length >= 0.3, `horn length ${length}`);
    const base = s.skin.palette.base ?? '#808080';
    need(lightness(base) <= 0.15, `base colour ${base} is not near black`);
    return `horn ${length}, base ${base}`;
  },
  'v06-serpent-species': () => {
    const species = load('v06.species.json');
    need(isSpecies(species), 'no ranges');
    const checked = validateSpecies(species, registry);
    need(checked.ok, `species invalid: ${checked.errors.map((e) => e.path).join(', ')}`);
    const paths = ranges(species);
    need(
      paths.includes('scale') && paths.includes('body.tail.length'),
      `ranges: ${paths.join(', ')}`,
    );
    const scale = species.scale as { min: number; max: number };
    const tail = ((species.body as Json).tail as Json).length as { min: number; max: number };
    need(scale.min >= 0.6 - 1e-9 && scale.max <= 1.2 + 1e-9, 'scale range outside 0.6–1.2');
    need(tail.min >= 2 - 1e-9 && tail.max <= 3 + 1e-9, 'tail range outside 2–3');
    need(
      spec({
        ...species,
        scale: 1,
        body: {
          ...(species.body as Json),
          tail: { ...((species.body as Json).tail as Json), length: 2.5 },
        },
      }).limbs.length === 0,
      'not legless',
    );
    return `ranges: ${paths.join(', ')}`;
  },
  'v07-viper-litter': () => {
    const kids = ['a', 'b', 'c'].map((k) => load(`v07.${k}.json`));
    for (const kid of kids)
      need(
        spec(kid).skin.layers.some((l) => l.type === 'stripes'),
        'a mutant lost its stripes',
      );
    need(
      !same(kids[0], kids[1]) && !same(kids[1], kids[2]) && !same(kids[0], kids[2]),
      'mutants are not all different',
    );
    need(!kids.some((k) => same(doc(k), doc(example('reed-viper')))), 'a mutant equals the parent');
    return '3 striped mutants';
  },
  'v08-tall-raptor': () => {
    const s = spec(load('v08.json'));
    need(s.limbs.filter((l) => l.role === 'leg').length === 2, 'not two-legged');
    const height = measureBody(s, registry).height;
    need(height >= 1.5 - 1e-3, `body height ${height.toFixed(2)} m`);
    return `body height ${height.toFixed(2)} m`;
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
console.log(`\n${passed}/${rows.length} tasks pass. Gate (≥ 7): ${passed >= 7 ? 'PASS' : 'FAIL'}`);
writeFileSync(
  join(dir, 'variation-score.json'),
  `${JSON.stringify({ passed, total: rows.length, rows }, null, 2)}\n`,
);
