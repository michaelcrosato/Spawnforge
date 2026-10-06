/**
 * Scores an eval run from the files it left behind, never from what the model reports.
 *
 *   node eval/score.ts eval/runs/<run>
 *
 * For each prompt id the run folder holds attempts named `<id>.attempt0.json`,
 * `<id>.attempt1.json`, …: attempt 0 is the first blueprint, and each later one is a fix round
 * after a `validate`. A prompt passes when one of attempts 0–3 is valid. Writes `score.json` and
 * prints a table.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from '@spawnforge/cli';

const MAX_FIX_ROUNDS = 3;
const dir = process.argv[2];
if (!dir) {
  console.error('usage: node eval/score.ts <run folder>');
  process.exit(2);
}
const prompts = JSON.parse(readFileSync(new URL('./prompts.json', import.meta.url), 'utf8')) as {
  id: string;
  prompt: string;
}[];
const files = readdirSync(dir);

interface Row {
  id: string;
  attempts: number;
  validAt: number | null;
  passed: boolean;
  errorsPerAttempt: number[];
}

const rows: Row[] = prompts.map(({ id }) => {
  const attempts = files
    .map((f) => /^(.+)\.attempt(\d+)\.json$/.exec(f))
    .filter((m): m is RegExpExecArray => m !== null && m[1] === id)
    .map((m) => Number(m[2]))
    .sort((a, b) => a - b);
  const errorsPerAttempt: number[] = [];
  let validAt: number | null = null;
  for (const n of attempts) {
    let errors: number;
    try {
      const blueprint = JSON.parse(readFileSync(join(dir, `${id}.attempt${n}.json`), 'utf8'));
      errors = validate({ blueprint }).errors.length;
    } catch {
      errors = 1;
    }
    errorsPerAttempt.push(errors);
    if (errors === 0 && validAt === null) validAt = n;
  }
  return {
    id,
    attempts: attempts.length,
    validAt,
    passed: validAt !== null && validAt <= MAX_FIX_ROUNDS,
    errorsPerAttempt,
  };
});

const passed = rows.filter((r) => r.passed).length;
const firstTry = rows.filter((r) => r.validAt === 0).length;
const summary = {
  run: dir,
  prompts: rows.length,
  passed,
  firstTry,
  threshold: 18,
  gate: passed >= 18,
  rows,
};
writeFileSync(join(dir, 'score.json'), `${JSON.stringify(summary, null, 2)}\n`);

console.log('| Prompt | Attempts | Valid at round | Errors per attempt |');
console.log('| --- | --- | --- | --- |');
for (const r of rows) {
  console.log(
    `| ${r.id} | ${r.attempts} | ${r.validAt ?? 'never'} | ${r.errorsPerAttempt.join(', ')} |`,
  );
}
console.log(
  `\n${passed}/${rows.length} valid within ${MAX_FIX_ROUNDS} fix rounds (${firstTry} on the first try). Gate (≥ 18): ${summary.gate ? 'PASS' : 'FAIL'}`,
);
