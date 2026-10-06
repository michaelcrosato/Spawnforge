/**
 * Motion review: filmstrips of gaits, actions and scenarios, shown blind and matched to the
 * tasks that asked for them.
 *
 *   node eval/motion.ts prepare <out> [--tasks eval/motion-dry.json]
 *       renders each task's filmstrip anonymously (no creature, gait, action or event names)
 *       into <out>/mNN.png in shuffled order, lists the tasks in <out>/review.md and keeps the
 *       key in <out>/motion-key.json
 *   node eval/motion.ts score <out> [--threshold n]
 *       compares <out>/motion-answers.json ({ "m01": "quadruped-trot", … }) with the key
 *
 * A task is { id, task, blueprint (a path), and filmstrip ({ gait, action, speed, view }) or
 * scenario (a path to a scenario file) }. Gate 10's suite M adds per-task checks on top.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createRng } from '@spawnforge/core';

interface Task {
  readonly id: string;
  readonly task: string;
  readonly blueprint: string;
  readonly filmstrip?: Record<string, unknown>;
  readonly scenario?: string;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    tasks: { type: 'string', default: 'eval/motion-dry.json' },
    threshold: { type: 'string' },
  },
});
const [mode, outArg] = positionals;
if (!outArg || (mode !== 'prepare' && mode !== 'score')) {
  console.error(
    'usage: node eval/motion.ts prepare <out> [--tasks <tasks.json>]\n' +
      '       node eval/motion.ts score <out> [--threshold n]',
  );
  process.exit(2);
}
const out = resolve(outArg);

if (mode === 'prepare') {
  const tasksPath = resolve(values.tasks as string);
  const tasks = JSON.parse(readFileSync(tasksPath, 'utf8')) as Task[];
  // Paths in the task list are from the repository root (or the list's folder).
  const root = resolve(new URL('..', import.meta.url).pathname);
  const read = (path: string) =>
    JSON.parse(
      readFileSync(
        existsSync(resolve(root, path)) ? resolve(root, path) : resolve(dirname(tasksPath), path),
        'utf8',
      ),
    ) as unknown;
  // Shuffle by the output folder's name (FNV-1a), so each review gets its own order.
  let hash = 2166136261;
  for (const ch of out.split('/').at(-1) ?? out)
    hash = Math.imul(hash ^ (ch.codePointAt(0) ?? 0), 16777619) >>> 0;
  const rng = createRng(hash);
  const order = tasks
    .map((t) => ({ t, k: rng.next() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.t);
  mkdirSync(out, { recursive: true });
  const { Renderer } = await import('@spawnforge/render');
  const renderer = await Renderer.launch();
  const key: Record<string, string> = {};
  try {
    for (const [i, t] of order.entries()) {
      const name = `m${String(i + 1).padStart(2, '0')}`;
      const filmstrip = t.scenario ? { scenario: read(t.scenario) } : (t.filmstrip ?? {});
      const { png } = await renderer
        .render({ blueprint: read(t.blueprint), anonymous: true, filmstrip })
        .catch((error: Error) => {
          throw new Error(`task ${t.id}: ${error.message.replace(/^[\s\S]*?Error: /, '')}`);
        });
      writeFileSync(join(out, `${name}.png`), png);
      key[name] = t.id;
    }
  } finally {
    await renderer.close();
  }
  const lines = [
    '# Motion review',
    '',
    `Each filmstrip (m01.png … m${String(order.length).padStart(2, '0')}.png) shows one of the tasks below: frames left to right,`,
    'then top to bottom, with the time on each frame and a footfall diagram or an event timeline',
    'beneath. Names of creatures, gaits, actions and events are hidden. Match every filmstrip',
    'to the task it shows; each task is used once. Write `motion-answers.json` beside this file:',
    '`{ "m01": "<task id>", … }`.',
    '',
    '| Task id | Task |',
    '| --- | --- |',
    ...tasks.map((t) => `| ${t.id} | ${t.task} |`),
  ];
  writeFileSync(join(out, 'review.md'), `${lines.join('\n')}\n`);
  writeFileSync(
    join(out, 'motion-key.json'),
    `${JSON.stringify({ tasks: values.tasks, key }, null, 2)}\n`,
  );
  console.log(`rendered ${order.length} filmstrips into ${out}`);
} else {
  const { key } = JSON.parse(readFileSync(join(out, 'motion-key.json'), 'utf8')) as {
    key: Record<string, string>;
  };
  const answersPath = join(out, 'motion-answers.json');
  if (!existsSync(answersPath)) throw new Error(`missing ${answersPath}`);
  const answers = JSON.parse(readFileSync(answersPath, 'utf8')) as Record<string, string>;
  const rows = Object.entries(key).map(([film, truth]) => ({
    film,
    truth,
    answer: answers[film] ?? '',
    correct: answers[film] === truth,
  }));
  const correct = rows.filter((r) => r.correct).length;
  const threshold = values.threshold === undefined ? undefined : Number(values.threshold);
  const summary = {
    correct,
    total: rows.length,
    ...(threshold === undefined ? {} : { threshold, gate: correct >= threshold }),
    rows,
  };
  writeFileSync(join(out, 'motion-score.json'), `${JSON.stringify(summary, null, 2)}\n`);
  for (const r of rows)
    console.log(
      `${r.film}  ${r.correct ? 'ok  ' : 'MISS'}  answer ${r.answer || '-'}  truth ${r.truth}`,
    );
  console.log(
    `\n${correct}/${rows.length} matched${threshold === undefined ? '' : `. Gate (≥ ${threshold}): ${correct >= threshold ? 'PASS' : 'FAIL'}`}`,
  );
}
