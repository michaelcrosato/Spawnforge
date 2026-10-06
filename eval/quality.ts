/**
 * Quality review: the same blueprints rendered at two commits, shown in pairs with the sides
 * shuffled and the names hidden, so a reviewer judges what the pipeline draws, not what an
 * agent wrote.
 *
 *   node eval/quality.ts prepare <out> --base <commit> [--head <commit>] [--set <run>]
 *       renders the set's final valid blueprints (default: the phase 4 run's 20) at the base
 *       commit and at the head (default: this working tree), into <out>/pNN-A.png and
 *       <out>/pNN-B.png, with the sides of each pair shuffled; writes the rubric and the pairs
 *       to <out>/review.md and the key to <out>/quality-key.json
 *   node eval/quality.ts score <out>
 *       reads <out>/quality-answers.json ({ "p01": { "pick": "A" | "B" | "same", "why": "…" } })
 *       and counts how often the head was preferred
 *
 * A commit renders in a temporary git worktree with its own `pnpm install --offline`, so the
 * base draws with its own code. The reviewer sees only the images and review.md.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { validate } from '@spawnforge/cli';
import { createRng } from '@spawnforge/core';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: 'string' },
    head: { type: 'string' },
    set: { type: 'string', default: 'eval/runs/2026-10-06-phase4-poc' },
    size: { type: 'string', default: '360' },
  },
});
const [mode, outArg] = positionals;
if (!outArg || (mode !== 'prepare' && mode !== 'score') || (mode === 'prepare' && !values.base)) {
  console.error(
    'usage: node eval/quality.ts prepare <out> --base <commit> [--head <commit>] [--set <run>]\n' +
      '       node eval/quality.ts score <out>',
  );
  process.exit(2);
}
const out = resolve(outArg);
const root = resolve(new URL('..', import.meta.url).pathname);

/** The rubric the reviewer applies to each pair, in order of weight. */
export const RUBRIC = [
  'silhouette: reads as the creature at a glance, from every view',
  'anatomy: believable masses, joints and proportions for its build',
  'extremities: feet, hands, claws, horns and tails attach and end well',
  'mouth and eyes: placed, shaped and alive',
  'surface: skin, patterns and materials read clearly without noise',
];

/** The last valid attempt of each prompt in a run folder, in prompt order. */
function finals(run: string): { id: string; blueprint: unknown }[] {
  const files = readdirSync(run);
  const ids = [
    ...new Set(
      files.map((f) => /^(.+)\.attempt\d+\.json$/.exec(f)?.[1]).filter((x) => x !== undefined),
    ),
  ].sort();
  const picked: { id: string; blueprint: unknown }[] = [];
  for (const id of ids) {
    const attempts = files
      .map((f) => /^(.+)\.attempt(\d+)\.json$/.exec(f))
      .filter((m): m is RegExpExecArray => m !== null && m[1] === id)
      .map((m) => Number(m[2]))
      .sort((a, b) => b - a);
    for (const n of attempts) {
      const blueprint = JSON.parse(readFileSync(join(run, `${id}.attempt${n}.json`), 'utf8'));
      if (validate({ blueprint }).ok) {
        picked.push({ id, blueprint });
        break;
      }
    }
  }
  return picked;
}

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

/** Renders each blueprint anonymously with the code of `commit` (or this tree), into `dir`. */
function renderAt(
  commit: string | undefined,
  items: { id: string; blueprint: unknown }[],
  dir: string,
  size: number,
): string {
  mkdirSync(dir, { recursive: true });
  const input = join(dir, 'input.json');
  writeFileSync(input, JSON.stringify(items));
  let tree = root;
  let worktree: string | undefined;
  if (commit !== undefined) {
    worktree = mkdtempSync(join(tmpdir(), 'spawnforge-quality-'));
    git('worktree', 'add', '--detach', worktree, commit);
    tree = worktree;
    try {
      execFileSync('pnpm', ['install', '--offline', '--frozen-lockfile'], {
        cwd: tree,
        stdio: 'ignore',
      });
    } catch {
      execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: tree, stdio: 'ignore' });
    }
  }
  // A small script inside the tree, so `@spawnforge/render` resolves to that tree's code.
  const script = join(tree, 'eval', `.quality-render-${process.pid}.ts`);
  writeFileSync(
    script,
    `import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Renderer } from '@spawnforge/render';
const [input, dir, size] = process.argv.slice(2);
const items = JSON.parse(readFileSync(input, 'utf8'));
const renderer = await Renderer.launch();
for (const { id, blueprint } of items) {
  const { png } = await renderer.render({ blueprint, anonymous: true, size: Number(size) });
  writeFileSync(join(dir, id + '.png'), png);
}
await renderer.close();
`,
  );
  try {
    execFileSync('node', [script, input, dir, String(size)], { cwd: tree, stdio: 'inherit' });
  } finally {
    rmSync(script, { force: true });
    rmSync(input, { force: true });
    if (worktree) git('worktree', 'remove', '--force', worktree);
  }
  return commit === undefined ? `${git('rev-parse', '--short', 'HEAD')} (working tree)` : commit;
}

if (mode === 'prepare') {
  const set = resolve(values.set as string);
  const items = finals(set);
  if (items.length === 0) throw new Error(`no valid blueprints in ${set}`);
  const size = Number(values.size);
  mkdirSync(out, { recursive: true });
  const work = join(out, 'work');
  const base = renderAt(values.base, items, join(work, 'base'), size);
  const head = renderAt(values.head, items, join(work, 'head'), size);
  // Shuffle the sides per pair, seeded by the output folder's name (FNV-1a).
  let hash = 2166136261;
  for (const ch of out.split('/').at(-1) ?? out)
    hash = Math.imul(hash ^ (ch.codePointAt(0) ?? 0), 16777619) >>> 0;
  const rng = createRng(hash);
  const key: Record<string, { id: string; A: 'base' | 'head'; B: 'base' | 'head' }> = {};
  const lines = [
    '# Quality review',
    '',
    'Each pair shows the same creature drawn two ways, A and B, in random order. For each pair,',
    'pick the better creature, or "same" when you cannot tell them apart or neither is better,',
    'judging by this rubric (in order of weight):',
    '',
    ...RUBRIC.map((r, i) => `${i + 1}. ${r}`),
    '',
    'Write `quality-answers.json` beside this file:',
    '`{ "p01": { "pick": "A", "why": "B\'s legs pass through the belly" }, … }`.',
    '',
    '| Pair | A | B |',
    '| --- | --- | --- |',
  ];
  const html = ['<!doctype html><meta charset="utf-8"><title>Quality review</title>'];
  items.forEach(({ id }, i) => {
    const pair = `p${String(i + 1).padStart(2, '0')}`;
    const headFirst = rng.next() < 0.5;
    const A = headFirst ? 'head' : 'base';
    const B = headFirst ? 'base' : 'head';
    for (const [side, from] of [
      ['A', A],
      ['B', B],
    ] as const)
      writeFileSync(join(out, `${pair}-${side}.png`), readFileSync(join(work, from, `${id}.png`)));
    key[pair] = { id, A, B };
    lines.push(`| ${pair} | ${pair}-A.png | ${pair}-B.png |`);
    html.push(
      `<h2>${pair}</h2><div style="display:flex;gap:8px"><figure><img src="${pair}-A.png" width="600" alt="${pair}, side A"><figcaption>A</figcaption></figure><figure><img src="${pair}-B.png" width="600" alt="${pair}, side B"><figcaption>B</figcaption></figure></div>`,
    );
  });
  rmSync(work, { recursive: true, force: true });
  writeFileSync(join(out, 'review.md'), `${lines.join('\n')}\n`);
  writeFileSync(join(out, 'review.html'), `${html.join('\n')}\n`);
  writeFileSync(
    join(out, 'quality-key.json'),
    `${JSON.stringify({ base, head, set: values.set, pairs: key }, null, 2)}\n`,
  );
  console.log(`rendered ${items.length} pairs into ${out} (base ${base}, head ${head})`);
} else {
  const { base, head, pairs } = JSON.parse(readFileSync(join(out, 'quality-key.json'), 'utf8')) as {
    base: string;
    head: string;
    pairs: Record<string, { id: string; A: 'base' | 'head'; B: 'base' | 'head' }>;
  };
  const answersPath = join(out, 'quality-answers.json');
  if (!existsSync(answersPath)) throw new Error(`missing ${answersPath}`);
  const answers = JSON.parse(readFileSync(answersPath, 'utf8')) as Record<
    string,
    { pick: 'A' | 'B' | 'same'; why?: string }
  >;
  const rows = Object.entries(pairs).map(([pair, { id, A, B }]) => {
    const pick = answers[pair]?.pick;
    const winner = pick === 'A' ? A : pick === 'B' ? B : pick === 'same' ? 'same' : 'missing';
    return { pair, id, winner, why: answers[pair]?.why ?? '' };
  });
  const count = (w: string) => rows.filter((r) => r.winner === w).length;
  const summary = {
    base,
    head,
    head_preferred: count('head'),
    base_preferred: count('base'),
    same: count('same'),
    missing: count('missing'),
    total: rows.length,
    rows,
  };
  writeFileSync(join(out, 'quality-score.json'), `${JSON.stringify(summary, null, 2)}\n`);
  for (const r of rows) console.log(`${r.pair}  ${r.winner.padEnd(7)}  ${r.id}  ${r.why}`);
  console.log(
    `\nhead preferred in ${summary.head_preferred}/${summary.total}, base in ${summary.base_preferred}, same in ${summary.same}${summary.missing ? `, ${summary.missing} unanswered` : ''}`,
  );
}
