import { readdirSync, readFileSync } from 'node:fs';
import { FORMAT } from '@spawnforge/core';
import { describe, expect, it } from 'vitest';

// The examples folder is also the golden test set. Until `validate` exists this only checks that
// each file is JSON in the current format; the full schema check replaces it in phase 0.
const dir = new URL('../../../examples/', import.meta.url);
const blueprints = readdirSync(dir).filter((file) => file.endsWith('.json'));

describe('examples', () => {
  it('exist', () => {
    expect(blueprints.length).toBeGreaterThan(0);
  });

  it.each(blueprints)('%s uses the current format', (file) => {
    const blueprint = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as { format?: unknown };
    expect(blueprint.format).toBe(FORMAT);
  });
});
