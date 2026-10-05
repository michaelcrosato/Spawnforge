import { FORMAT } from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { listModules } from './commands.ts';

describe('listModules', () => {
  it('reports the format and the catalogue of the default packs', () => {
    const result = listModules();
    expect(result.format).toBe(FORMAT);
    expect(Array.isArray(result.modules)).toBe(true);
  });
});
