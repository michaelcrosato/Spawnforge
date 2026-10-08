import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FORMAT } from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { blueprintJsonSchema } from './index.ts';

/**
 * Frozen formats (docs/plan-2.md, "Versions, goldens and looks"): 12.3 froze `spawnforge/0.2`
 * at release. From then on any change to what a blueprint may say (a field, a module, a
 * parameter, a range, a default) changes the JSON Schema, and must come with a new format and a
 * migration step (packages/core/src/blueprint/migrations/), not as an edit to a frozen one.
 */
const frozen = JSON.parse(
  readFileSync(new URL('./frozen.json', import.meta.url), 'utf8'),
) as Record<string, { frozen: string; schema: string }>;

describe('frozen formats', () => {
  it('keeps the schema of a frozen format as it was frozen', () => {
    const record = frozen[FORMAT];
    if (!record) return;
    const hash = createHash('sha256').update(JSON.stringify(blueprintJsonSchema())).digest('hex');
    expect(
      hash,
      `${FORMAT} was frozen on ${record.frozen}: bump FORMAT, add a migration, and record the new format here`,
    ).toBe(record.schema);
  });

  it('records the current format, since 0.2 is frozen', () => {
    expect(Object.keys(frozen)).toContain(FORMAT);
  });
});
