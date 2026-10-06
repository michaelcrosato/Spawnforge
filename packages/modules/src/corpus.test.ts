import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createRegistry,
  FORMAT,
  type Issue,
  isRecord,
  isSpecies,
  migrate,
  validateBlueprint,
  validateSpecies,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/**
 * Corpus test: every blueprint saved under eval/runs/ and examples/ still reads after every
 * format change. Each one migrates to the current format; those that were valid stay valid, and
 * the invalid ones fail at the same paths, as recorded in corpus.json beside this file. Record a
 * new file, or an intended change, with UPDATE_CORPUS=1 (then `pnpm format`) and say why in the
 * commit.
 */
const registry = createRegistry([basicPack]);
const root = new URL('../../../', import.meta.url);
const recordFile = new URL('./corpus.json', import.meta.url);

/** Committed files only: scratch folders in eval runs are ignored by git. */
function files(dir: string): string[] {
  return execFileSync('git', ['ls-files', dir], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((path) => path.endsWith('.json'))
    .sort();
}

/** Blueprints and species: JSON objects with a `format`. */
const corpus = [...files('examples/'), ...files('eval/runs/')]
  .map((path) => ({ path, doc: JSON.parse(readFileSync(new URL(path, root), 'utf8')) as unknown }))
  .filter((f): f is { path: string; doc: Record<string, unknown> } => isRecord(f.doc))
  .filter((f) => typeof f.doc.format === 'string');

interface Outcome {
  readonly ok: boolean;
  /** `path code` of each error, sorted. */
  readonly errors: readonly string[];
}

function outcome(doc: Record<string, unknown>): Outcome {
  const errors: readonly Issue[] = isSpecies(doc)
    ? validateSpecies(doc, registry).errors
    : validateBlueprint(doc, registry, { minimal: false }).errors;
  return {
    ok: errors.length === 0,
    errors: [...new Set(errors.map((e) => `${e.path} ${e.code}`))].sort(),
  };
}

const actual: Record<string, Outcome> = {};
for (const { path, doc } of corpus) actual[path] = outcome(doc);
if (process.env.UPDATE_CORPUS) writeFileSync(recordFile, `${JSON.stringify(actual, null, 2)}\n`);
const recorded = JSON.parse(readFileSync(recordFile, 'utf8')) as Record<string, Outcome>;

describe('the saved corpus', () => {
  it('is recorded in full (UPDATE_CORPUS=1 records new files)', () => {
    expect(corpus.length).toBeGreaterThan(250);
    expect(Object.keys(recorded).sort()).toEqual(corpus.map((f) => f.path).sort());
  });

  it('migrates every blueprint to the current format', () => {
    for (const { path, doc } of corpus) {
      const result = migrate(doc);
      expect(
        result.issues.filter((i) => i.severity === 'error'),
        path,
      ).toEqual([]);
      expect(result.doc.format, path).toBe(FORMAT);
    }
  });

  it('keeps valid blueprints valid and invalid ones failing at the same paths', () => {
    const changed = corpus
      .filter(({ path }) => JSON.stringify(actual[path]) !== JSON.stringify(recorded[path]))
      .map(({ path }) => ({ path, recorded: recorded[path], now: actual[path] }));
    expect(changed).toEqual([]);
  });

  it('reads the same before and after migrating, from every older format', () => {
    for (const { path, doc } of corpus) {
      expect(outcome(migrate(doc).doc), path).toEqual(actual[path]);
      // The Bestiary-era label runs the whole chain on a 0.1 blueprint.
      if (doc.format === 'spawnforge/0.1')
        expect(outcome({ ...doc, format: 'bestiary/0.1' }), path).toEqual(actual[path]);
    }
  });
});
