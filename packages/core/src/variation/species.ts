import type { Issue } from '../blueprint/issues.ts';
import { cloneJson, isRecord } from '../blueprint/merge.ts';
import { validateBlueprint } from '../blueprint/validate.ts';
import type { Registry } from '../registry.ts';
import { createRng, type Rng } from '../rng.ts';

/**
 * A species is a blueprint with ranges in it: anywhere a number goes, `{ "min": 0.5, "max": 0.7 }`
 * stands for "somewhere in between" (integers stay integers when both ends are integers).
 * `instantiate` resolves every range for one seed. Each range draws from its own stream, keyed by
 * its id-based path, so changing one range never reshuffles the others.
 */
export type Species = Record<string, unknown>;

/** A `{ min, max }` range: exactly those two keys, both numbers. */
export function isRange(value: unknown): value is { min: number; max: number } {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    typeof value.min === 'number' &&
    typeof value.max === 'number'
  );
}

/** True when the blueprint has any range in it. */
export function isSpecies(blueprint: unknown): boolean {
  if (isRange(blueprint)) return true;
  if (Array.isArray(blueprint)) return blueprint.some(isSpecies);
  if (isRecord(blueprint)) return Object.values(blueprint).some(isSpecies);
  return false;
}

const itemKey = (item: unknown, i: number) =>
  isRecord(item) && typeof item.id === 'string' ? `[id=${item.id}]` : `[${i}]`;

/** Replaces every range using `pick(range, path)`. */
function resolveRanges(
  value: unknown,
  path: string,
  pick: (range: { min: number; max: number }, path: string) => number,
): unknown {
  if (isRange(value)) return pick(value, path);
  if (Array.isArray(value))
    return value.map((item, i) => resolveRanges(item, `${path}${itemKey(item, i)}`, pick));
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value))
      out[k] = resolveRanges(v, path ? `${path}.${k}` : k, pick);
    return out;
  }
  return value;
}

/** Resolves every range in a species fragment, each from `rng`'s stream for its path. */
export function resolveSpecies<T>(species: T, rng: Rng): T {
  return resolveRanges(cloneJson(species), '', ({ min, max }, path) => {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const stream = rng.stream(path);
    if (Number.isInteger(lo) && Number.isInteger(hi)) return stream.int(lo, hi);
    return Number(stream.float(lo, hi).toPrecision(3));
  }) as T;
}

/** One individual of a species: every range resolved for `seed`. */
export function instantiate(species: Species, seed: number): Record<string, unknown> {
  const root = createRng(seed);
  const individual = resolveSpecies(species, root);
  // Each individual gets its own seed too, so its patterns differ in their details.
  individual.seed = root.stream('individual').int(0, 4_294_967_295);
  if (typeof species.name === 'string') individual.name = `${species.name} #${seed}`;
  return individual;
}

/**
 * Problems in a species: malformed ranges, and anything that makes an individual invalid. Every
 * range is checked at both ends (all minimums, then all maximums) and at a few random seeds.
 */
export function validateSpecies(
  species: Species,
  registry: Registry,
  samples = 4,
): { ok: boolean; errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = [];
  const walk = (value: unknown, path: string) => {
    if (isRecord(value) && ('min' in value || 'max' in value) && !isRange(value)) {
      errors.push({
        severity: 'error',
        path,
        code: 'bad_range',
        message: 'a range has exactly two keys, "min" and "max", both numbers',
        fix: '{ "min": 0.5, "max": 0.7 }',
      });
      return;
    }
    if (isRange(value) && value.min > value.max)
      errors.push({
        severity: 'error',
        path,
        code: 'bad_range',
        message: `min ${value.min} is above max ${value.max}`,
        fix: `{ "min": ${value.max}, "max": ${value.min} }`,
      });
    if (Array.isArray(value))
      for (const [i, v] of value.entries()) walk(v, `${path}${itemKey(v, i)}`);
    else if (isRecord(value))
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(species, '');
  if (errors.length > 0) return { ok: false, errors, warnings: [] };

  const found = new Map<string, Issue>();
  const warnings = new Map<string, Issue>();
  const check = (individual: unknown, label: string) => {
    const result = validateBlueprint(individual, registry, { minimal: false });
    for (const e of result.errors)
      if (!found.has(e.path + e.code))
        found.set(e.path + e.code, { ...e, message: `${e.message} (${label})` });
    for (const w of result.warnings)
      if (!warnings.has(w.path + w.code)) warnings.set(w.path + w.code, w);
  };
  check(
    resolveRanges(species, '', (r) => Math.min(r.min, r.max)),
    'with every range at its min',
  );
  check(
    resolveRanges(species, '', (r) => Math.max(r.min, r.max)),
    'with every range at its max',
  );
  for (let s = 1; s <= samples; s++) check(instantiate(species, s), `in individual seed ${s}`);
  return { ok: found.size === 0, errors: [...found.values()], warnings: [...warnings.values()] };
}
