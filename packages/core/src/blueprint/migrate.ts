import { FORMAT } from '../format.ts';
import type { Issue } from './issues.ts';
import { isRecord } from './merge.ts';

interface Migration {
  readonly from: string;
  readonly to: string;
  readonly note: string;
  apply(doc: Record<string, unknown>): Record<string, unknown>;
}

/** Ordered upgrades. Each turns one format into the next; `migrate` chains them. */
const MIGRATIONS: readonly Migration[] = [
  {
    from: 'bestiary/0.1',
    to: 'spawnforge/0.1',
    note: 'the project was renamed from Bestiary to Spawnforge; the format is otherwise unchanged',
    apply: (doc) => ({ ...doc, format: 'spawnforge/0.1' }),
  },
];

export const KNOWN_FORMATS: readonly string[] = [FORMAT, ...MIGRATIONS.map((m) => m.from)];

/** Upgrades an older blueprint to the current format, with a warning per step. */
export function migrate(doc: Record<string, unknown>): {
  doc: Record<string, unknown>;
  issues: Issue[];
} {
  const issues: Issue[] = [];
  let current = doc;
  for (let guard = 0; guard < MIGRATIONS.length + 1; guard++) {
    const format = current.format;
    if (format === FORMAT) return { doc: current, issues };
    if (format === undefined) {
      issues.push({
        severity: 'error',
        path: 'format',
        code: 'missing',
        message: 'is required',
        expected: JSON.stringify(FORMAT),
        fix: `add "format": "${FORMAT}"`,
      });
      return { doc: current, issues };
    }
    const step = MIGRATIONS.find((m) => m.from === format);
    if (!step) {
      issues.push({
        severity: 'error',
        path: 'format',
        code: 'unknown_format',
        message: `${JSON.stringify(format)} is not a format this library reads`,
        expected: KNOWN_FORMATS.map((f) => JSON.stringify(f)).join(', '),
        fix: `use "format": "${FORMAT}"`,
      });
      return { doc: current, issues };
    }
    current = step.apply(current);
    issues.push({
      severity: 'warning',
      path: 'format',
      code: 'migrated',
      message: `migrated from ${step.from} to ${step.to}: ${step.note}`,
      fix: `set "format": "${step.to}"`,
    });
  }
  return { doc: current, issues };
}

export { isRecord };
