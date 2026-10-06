/**
 * Scores an eval run from the files it left behind, never from what the model reports.
 *
 *   node eval/score.ts eval/runs/<run> [--prompts eval/prompts-b.json]
 *
 * For each prompt id the run folder holds attempts named `<id>.attempt0.json`,
 * `<id>.attempt1.json`, …: attempt 0 is the first blueprint, and each later one is a fix round
 * after a `validate`. A prompt passes when one of attempts 0–3 is valid. Prompts with `expects`
 * (suite B) also check the last valid attempt for the features the prompt asked for. The prompt
 * file defaults to the run's suite (`"suite": "b"` in run.json reads prompts-b.json). Writes
 * `score.json` and prints a table.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from '@spawnforge/cli';
import { type Expect, failedExpects } from './expects.ts';

const MAX_FIX_ROUNDS = 3;
const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--prompts');
if (!dir) {
  console.error('usage: node eval/score.ts <run folder> [--prompts file]');
  process.exit(2);
}
const runInfo = existsSync(join(dir, 'run.json'))
  ? (JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')) as { suite?: string })
  : {};
const promptFile = args.includes('--prompts')
  ? args[args.indexOf('--prompts') + 1]
  : runInfo.suite === 'b'
    ? new URL('./prompts-b.json', import.meta.url)
    : new URL('./prompts.json', import.meta.url);
const prompts = JSON.parse(readFileSync(promptFile as string | URL, 'utf8')) as {
  id: string;
  prompt: string;
  expects?: Expect[];
}[];
const files = readdirSync(dir);

interface Row {
  id: string;
  attempts: number;
  validAt: number | null;
  passed: boolean;
  errorsPerAttempt: number[];
  /** Suite B: the features the last valid attempt lacks (empty when it has them all). */
  missing?: string[];
}

const rows: Row[] = prompts.map(({ id, expects }) => {
  const attempts = files
    .map((f) => /^(.+)\.attempt(\d+)\.json$/.exec(f))
    .filter((m): m is RegExpExecArray => m !== null && m[1] === id)
    .map((m) => Number(m[2]))
    .sort((a, b) => a - b);
  const errorsPerAttempt: number[] = [];
  let validAt: number | null = null;
  let lastValid: unknown;
  for (const n of attempts) {
    let errors: number;
    try {
      const blueprint = JSON.parse(readFileSync(join(dir, `${id}.attempt${n}.json`), 'utf8'));
      const result = validate({ blueprint, expanded: true });
      errors = result.errors.length;
      if (errors === 0) lastValid = result.creature;
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
    ...(expects
      ? { missing: lastValid ? failedExpects(lastValid, expects) : ['no valid attempt'] }
      : {}),
  };
});

const passed = rows.filter((r) => r.passed).length;
const firstTry = rows.filter((r) => r.validAt === 0).length;
const checked = rows.filter((r) => r.missing !== undefined);
const met = checked.filter((r) => r.passed && r.missing?.length === 0).length;
const summary = {
  run: dir,
  prompts: rows.length,
  passed,
  firstTry,
  threshold: 18,
  ...(checked.length > 0 ? { expectsMet: met } : {}),
  gate: passed >= 18 && (checked.length === 0 || met >= 18),
  rows,
};
writeFileSync(join(dir, 'score.json'), `${JSON.stringify(summary, null, 2)}\n`);

const expectsColumn = checked.length > 0;
console.log(
  `| Prompt | Attempts | Valid at round | Errors per attempt |${expectsColumn ? ' Missing features |' : ''}`,
);
console.log(`| --- | --- | --- | --- |${expectsColumn ? ' --- |' : ''}`);
for (const r of rows) {
  const missing = r.missing === undefined ? '' : ` ${r.missing.join('; ') || 'none'} |`;
  console.log(
    `| ${r.id} | ${r.attempts} | ${r.validAt ?? 'never'} | ${r.errorsPerAttempt.join(', ')} |${missing}`,
  );
}
console.log(
  `\n${passed}/${rows.length} valid within ${MAX_FIX_ROUNDS} fix rounds (${firstTry} on the first try)${expectsColumn ? `; ${met}/${checked.length} meet their expects` : ''}. Gate (≥ 18${expectsColumn ? ' each' : ''}): ${summary.gate ? 'PASS' : 'FAIL'}`,
);
