/**
 * Suite M's checks (gate 10, docs/plan-2.md): each motion task's blueprint and scenario are run,
 * and what happened is checked against what the task asked for. Used by `eval/motion.ts check`.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRegistry, prepareScenarioFor, validate } from '@spawnforge/cli';
import {
  compileCreature,
  type Scenario,
  type ScenarioResult,
  ScenarioRun,
  validateBlueprint,
} from '@spawnforge/core';

/** One thing a task's run must show. */
export type Check = { readonly says: string } & (
  | { readonly kind: 'gait'; readonly id: string }
  | { readonly kind: 'topSpeed'; readonly min: number }
  | {
      readonly kind: 'event';
      readonly type: string;
      readonly action?: string;
      readonly head?: string;
      readonly min?: number;
    }
  | { readonly kind: 'order'; readonly types: readonly string[] }
  | {
      readonly kind: 'target';
      readonly name: string;
      readonly max: number;
      readonly below?: number;
      readonly above?: number;
    }
  | { readonly kind: 'turn'; readonly min: number }
  | { readonly kind: 'media'; readonly is: readonly string[] }
  | { readonly kind: 'water' }
  | { readonly kind: 'slope'; readonly min: number }
);

const like = (pattern: string, value: string | undefined) =>
  value !== undefined &&
  (pattern.endsWith('*') ? value.startsWith(pattern.slice(0, -1)) : value === pattern);

/** Whether a run shows what a check asks for, and if not, why not. */
export function failure(check: Check, scenario: Scenario, result: ScenarioResult): string | null {
  const events = result.events;
  switch (check.kind) {
    case 'gait':
      return result.gaits.some((g) => like(check.id, g.gait))
        ? null
        : `no ${check.id} among its gaits (${result.gaits.map((g) => g.gait).join(', ') || 'none'})`;
    case 'topSpeed':
      return result.topSpeed >= check.min
        ? null
        : `its top speed was ${result.topSpeed} m/s, under ${check.min}`;
    case 'event': {
      const found = events.filter(
        (e) =>
          e.type === check.type &&
          (check.action === undefined || e.action === check.action) &&
          (check.head === undefined || like(check.head, (e as { head?: string }).head)),
      );
      return found.length >= (check.min ?? 1)
        ? null
        : `no ${check.type} event${check.action ? ` from ${check.action}` : ''}${check.head ? ` by ${check.head}` : ''}`;
    }
    case 'order': {
      let at = -1;
      for (const type of check.types) {
        const next = events.findIndex((e, i) => i > at && e.type === type);
        if (next < 0)
          return `no ${type} after ${check.types.slice(0, check.types.indexOf(type)).join(', ') || 'the start'}`;
        at = next;
      }
      return null;
    }
    case 'target': {
      const point = scenario.targets[check.name];
      if (!point) return `no target named ${check.name}`;
      const y = point[1];
      if (check.below !== undefined && y > check.below)
        return `${check.name} is at ${y} m, not below ${check.below}`;
      if (check.above !== undefined && y < check.above)
        return `${check.name} is at ${y} m, not above ${check.above}`;
      const closest = result.targets[check.name]?.closest ?? Infinity;
      return closest <= check.max
        ? null
        : `it came within ${closest} m of ${check.name}, not ${check.max}`;
    }
    case 'turn': {
      const start = scenario.start.heading;
      const turned = Math.abs(((((result.end.heading - start) % 360) + 540) % 360) - 180);
      return turned >= check.min ? null : `it turned ${turned.toFixed(0)}°, under ${check.min}°`;
    }
    case 'media': {
      const media = events.filter((e) => e.type === 'medium').map((e) => e.medium);
      return JSON.stringify(media) === JSON.stringify(check.is)
        ? null
        : `its media went ${JSON.stringify(media)}, not ${JSON.stringify(check.is)}`;
    }
    case 'water':
      return scenario.water !== 'none' ? null : 'the scenario has no water';
    case 'slope': {
      const ground = scenario.ground;
      return typeof ground === 'object' && Math.abs(ground.slope) >= check.min
        ? null
        : `the ground is not a slope of ${check.min}° or more`;
    }
  }
}

export async function check(run: string, promptsPath: string, threshold?: string): Promise<void> {
  const prompts = JSON.parse(readFileSync(promptsPath, 'utf8')) as {
    id: string;
    prompt: string;
    checks: Check[];
  }[];
  const registry = getRegistry();
  const files = readdirSync(run);
  const rows: {
    id: string;
    attempt?: string;
    pass: boolean;
    checks: { says: string; pass: boolean; why?: string }[];
    error?: string;
  }[] = [];
  const tasks: { id: string; task: string; blueprint: string; scenario: string }[] = [];
  for (const p of prompts) {
    // The last valid attempt is the blueprint.
    const attempts = files
      .filter((f) => f.startsWith(`${p.id}.attempt`) && f.endsWith('.json'))
      .sort((a, b) => Number(a.match(/attempt(\d+)/)?.[1]) - Number(b.match(/attempt(\d+)/)?.[1]));
    const valid = attempts.filter(
      (f) => validate({ blueprint: JSON.parse(readFileSync(join(run, f), 'utf8')) }, registry).ok,
    );
    const attempt = valid.at(-1);
    const scenarioFile = join(run, `${p.id}.scenario.json`);
    if (!attempt || !existsSync(scenarioFile)) {
      rows.push({
        id: p.id,
        pass: false,
        checks: [],
        error: !attempt ? 'no valid blueprint' : 'no scenario',
      });
      continue;
    }
    const blueprint = JSON.parse(readFileSync(join(run, attempt), 'utf8'));
    const input = JSON.parse(readFileSync(scenarioFile, 'utf8'));
    const prepared = prepareScenarioFor(blueprint, input, registry);
    if (!prepared.ok) {
      rows.push({
        id: p.id,
        attempt,
        pass: false,
        checks: [],
        error: prepared.errors.map((e) => `${e.path} ${e.code}`).join('; '),
      });
      continue;
    }
    const creature = validateBlueprint(blueprint, registry, { minimal: false }).creature;
    if (!creature) throw new Error(`${attempt} validated but did not resolve`);
    const compiled = compileCreature(creature, registry, { quality: 'low' });
    const result = new ScenarioRun(compiled, registry, prepared.scenario).run();
    const checks = p.checks.map((c) => {
      const why = failure(c, prepared.scenario, result);
      return { says: c.says, pass: why === null, ...(why ? { why } : {}) };
    });
    rows.push({ id: p.id, attempt, pass: checks.every((c) => c.pass), checks });
    tasks.push({
      id: p.id,
      task: p.prompt.replace(/ Name the targets? .*$/, ''),
      blueprint: join(run, attempt),
      scenario: scenarioFile,
    });
  }
  const passed = rows.filter((r) => r.pass).length;
  const bar = threshold === undefined ? undefined : Number(threshold);
  writeFileSync(
    join(run, 'check-score.json'),
    `${JSON.stringify({ passed, total: rows.length, ...(bar === undefined ? {} : { threshold: bar, gate: passed >= bar }), rows }, null, 2)}\n`,
  );
  writeFileSync(join(run, 'motion-tasks.json'), `${JSON.stringify(tasks, null, 2)}\n`);
  for (const r of rows)
    console.log(
      `${r.pass ? 'pass' : 'FAIL'}  ${r.id}${r.error ? `  ${r.error}` : ''}${r.checks
        .filter((c) => !c.pass)
        .map((c) => `  [${c.says}: ${c.why}]`)
        .join('')}`,
    );
  console.log(
    `\n${passed}/${rows.length} passed${bar === undefined ? '' : `. Gate (≥ ${bar}): ${passed >= bar ? 'PASS' : 'FAIL'}`}`,
  );
}
