/**
 * Blind review tooling for an eval run.
 *
 *   node eval/blind.ts prepare eval/runs/<run>   renders each prompt's final valid blueprint
 *                                                anonymously into <run>/blind/rNN.png, shuffled,
 *                                                and writes the key to <run>/blind-key.json and
 *                                                the prompt list to <run>/blind/prompts.md
 *   node eval/blind.ts score eval/runs/<run> [--threshold n]
 *                                                compares <run>/blind-answers.json with the key
 *                                                (gate: n matches, default 16)
 *
 * The suite comes from the run's run.json (`"suite": "b"` uses prompts-b.json). The reviewer sees
 * only the images and the prompt list; never the key or the blueprints.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from '@spawnforge/cli';
import { createRng } from '@spawnforge/core';

const [mode, dir, ...rest] = process.argv.slice(2);
if (!dir || (mode !== 'prepare' && mode !== 'score')) {
  console.error('usage: node eval/blind.ts prepare|score <run folder> [--threshold n]');
  process.exit(2);
}
const flag = rest.indexOf('--threshold');
const threshold = flag >= 0 ? Number(rest[flag + 1]) : 16;
const runInfo = existsSync(join(dir, 'run.json'))
  ? (JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')) as { suite?: string })
  : {};
const suiteFile = runInfo.suite === 'b' ? './prompts-b.json' : './prompts.json';
const prompts = JSON.parse(readFileSync(new URL(suiteFile, import.meta.url), 'utf8')) as {
  id: string;
  prompt: string;
}[];

if (mode === 'prepare') {
  const { Renderer } = await import('@spawnforge/render');
  const files = readdirSync(dir);
  const finals: { id: string; blueprint: unknown }[] = [];
  for (const { id } of prompts) {
    const attempts = files
      .map((f) => /^(.+)\.attempt(\d+)\.json$/.exec(f))
      .filter((m): m is RegExpExecArray => m !== null && m[1] === id)
      .map((m) => Number(m[2]))
      .sort((a, b) => b - a);
    for (const n of attempts) {
      const blueprint = JSON.parse(readFileSync(join(dir, `${id}.attempt${n}.json`), 'utf8'));
      if (validate({ blueprint }).ok) {
        finals.push({ id, blueprint });
        break;
      }
    }
  }
  // Shuffle deterministically by the run folder's name (FNV-1a), so each run gets its own order.
  let hash = 2166136261;
  for (const ch of dir.replace(/\/+$/, '').split('/').at(-1) ?? dir) {
    hash = Math.imul(hash ^ (ch.codePointAt(0) ?? 0), 16777619) >>> 0;
  }
  const rng = createRng(hash);
  const order = finals
    .map((f) => ({ f, k: rng.next() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.f);
  mkdirSync(join(dir, 'blind'), { recursive: true });
  const renderer = await Renderer.launch();
  const key: Record<string, string> = {};
  for (const [i, { id, blueprint }] of order.entries()) {
    const name = `r${String(i + 1).padStart(2, '0')}`;
    const { png } = await renderer.render({ blueprint, anonymous: true, size: 400 });
    writeFileSync(join(dir, 'blind', `${name}.png`), png);
    key[name] = id;
  }
  await renderer.close();
  writeFileSync(join(dir, 'blind-key.json'), `${JSON.stringify(key, null, 2)}\n`);
  // The prompts in id order, for the reviewer (the order says nothing about the renders').
  writeFileSync(
    join(dir, 'blind', 'prompts.md'),
    `# Prompts\n\n${prompts.map((p) => `- \`${p.id}\`: ${p.prompt}`).join('\n')}\n`,
  );
  console.log(`rendered ${order.length} creatures into ${join(dir, 'blind')}`);
} else {
  const key = JSON.parse(readFileSync(join(dir, 'blind-key.json'), 'utf8')) as Record<
    string,
    string
  >;
  const answersPath = join(dir, 'blind-answers.json');
  if (!existsSync(answersPath)) throw new Error(`missing ${answersPath}`);
  const answers = JSON.parse(readFileSync(answersPath, 'utf8')) as Record<string, string>;
  const rows = Object.entries(key).map(([render, truth]) => ({
    render,
    truth,
    answer: answers[render] ?? '',
    correct: answers[render] === truth,
  }));
  const correct = rows.filter((r) => r.correct).length;
  const summary = { correct, total: rows.length, threshold, gate: correct >= threshold, rows };
  writeFileSync(join(dir, 'blind-score.json'), `${JSON.stringify(summary, null, 2)}\n`);
  for (const r of rows)
    console.log(
      `${r.render}  ${r.correct ? 'ok  ' : 'MISS'}  answer ${r.answer || '-'}  truth ${r.truth}`,
    );
  console.log(
    `\n${correct}/${rows.length} matched. Gate (≥ ${threshold}): ${summary.gate ? 'PASS' : 'FAIL'}`,
  );
}
