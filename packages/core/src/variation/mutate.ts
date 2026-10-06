import type { Issue } from '../blueprint/issues.ts';
import { cloneJson, isRecord } from '../blueprint/merge.ts';
import type { PartModule, Registry } from '../registry.ts';
import { createRng, type Rng } from '../rng.ts';
import {
  expand,
  finish,
  type Gene,
  gauss,
  genesOf,
  getAt,
  isLocked,
  nudgeColor,
  setAt,
  tidy,
  type VariationResult,
} from './genes.ts';

type Json = Record<string, unknown>;

export interface MutateOptions {
  /** Which mutation: the same seed and parent always give the same child. */
  readonly seed?: number;
  /** How far to drift, 0 to 1: the share of genes that change and how much (default 0.3). */
  readonly amount?: number;
  /** Paths that never change, e.g. `scale`, `body.head`, `parts[id=horns]`, `skin`. */
  readonly locked?: readonly string[];
  /** Whether parts may be added, removed or swapped (default true). */
  readonly structure?: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A new value for one gene, or undefined to leave it. */
function mutateGene(gene: Gene, rng: Rng, amount: number): unknown {
  const { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = gene;
  switch (gene.kind) {
    case 'boolean':
      return rng.chance(0.2) ? !gene.value : undefined;
    case 'enum': {
      if (!rng.chance(0.3)) return undefined;
      const others = (gene.options ?? []).filter((o) => o !== gene.value);
      return others.length > 0 ? rng.pick(others) : undefined;
    }
    case 'color':
      return nudgeColor(gene.value as string, rng, amount);
    case 'profile': {
      const common = Math.exp(gauss(rng) * 0.35 * amount);
      return (gene.value as number[]).map((v) =>
        tidy(clamp(v * common * Math.exp(gauss(rng) * 0.1 * amount), min, max)),
      );
    }
    case 'number': {
      const v = gene.value as number;
      // Zero usually means "none" (no tail, no ridges, no twist): nothing grows from nothing.
      if (v === 0) return undefined;
      if (gene.int) {
        const step = Math.max(1, Math.round(Math.abs(gauss(rng)) * amount * (max - min) * 0.1));
        return clamp(v + (rng.chance(0.5) ? step : -step), min, max);
      }
      const next =
        min >= 0
          ? v * Math.exp(gauss(rng) * 0.35 * amount)
          : v + gauss(rng) * 0.1 * amount * (max - min);
      return tidy(clamp(next, min, max));
    }
  }
}

/** Part modules a creature can gain or swap to, by slot (feet change through limbs instead). */
function placeable(registry: Registry): PartModule[] {
  return registry.list('part').filter((m) => m.slot !== 'foot');
}

/** Sense organs are never removed, swapped out or swapped in. */
const isSense = (module: PartModule | undefined) => module?.tags.includes('sense') ?? false;

/**
 * One structural change: adds a part whose tags match the creature's existing parts, removes
 * one, or swaps one for another module with the same slot and a shared tag.
 */
function changeStructure(child: Json, rng: Rng, registry: Registry, locked: readonly string[]) {
  const parts = (child.parts as Json[] | undefined) ?? [];
  child.parts = parts;
  const moduleOf = (p: Json) => registry.get('part', p.type as string);
  const free = parts.filter((p) => !isLocked(`parts[id=${p.id}]`, locked) && !isSense(moduleOf(p)));
  const tags = new Set(parts.flatMap((p) => moduleOf(p)?.tags ?? []));
  const present = new Set(parts.map((p) => p.type));
  const addable = placeable(registry).filter(
    (m) => !present.has(m.id) && m.tags.some((t) => tags.has(t)),
  );
  const swaps = (p: Json) => {
    const old = moduleOf(p);
    return placeable(registry).filter(
      (m) =>
        old &&
        m.id !== old.id &&
        m.slot === old.slot &&
        !isSense(m) &&
        m.tags.some((t) => old.tags.includes(t)),
    );
  };
  const swappable = free.filter((p) => swaps(p).length > 0);
  const choices = [
    ...(addable.length > 0 ? ['add'] : []),
    ...(free.length > 0 ? ['remove'] : []),
    ...(swappable.length > 0 ? ['swap'] : []),
  ];
  if (choices.length === 0) return;
  const choice = rng.pick(choices);
  const ids = new Set(parts.map((p) => p.id));
  const freshId = (base: string) => {
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}${n}`;
    return id;
  };
  if (choice === 'add') {
    const module = rng.pick(addable);
    const item = cloneJson(module.example);
    item.id = freshId(typeof item.id === 'string' ? item.id : module.id.replace(/\W/g, '-'));
    parts.push(item);
  } else if (choice === 'remove') {
    const victim = rng.pick(free);
    child.parts = parts.filter((p) => p !== victim);
  } else {
    const target = rng.pick(swappable);
    const module = rng.pick(swaps(target));
    const example = module.example;
    target.type = module.id;
    target.params = cloneJson(isRecord(example.params) ? example.params : {});
  }
}

/**
 * A child of one parent: numbers drift within their ranges, colours shift, and now and then an
 * enum flips or a part is added, removed or swapped (parts with matching tags). Locked paths
 * never change. Each gene draws from its own seed stream, so locking one never reshuffles the
 * others.
 */
export function mutate(
  blueprint: Json,
  options: MutateOptions,
  registry: Registry,
): VariationResult {
  const { doc, errors } = expand(blueprint, registry);
  if (!doc) return { ok: false, blueprint, diff: [], errors, warnings: [] };
  const amount = clamp(options.amount ?? 0.3, 0, 1);
  const locked = options.locked ?? [];
  // Mixed with the parent's own seed, so one mutation seed sends different parents different ways.
  const root = createRng(options.seed ?? 1).stream(`parent:${String(doc.seed ?? 0)}`);
  const child = cloneJson(doc);
  // Gaits and actions the parent leaves to its body's defaults stay that way.
  const fixed = [...locked];
  for (const list of ['motion.gaits', 'motion.actions'])
    if (getAt(blueprint, list) === undefined) fixed.push(list);
  for (const gene of genesOf(doc, registry)) {
    if (isLocked(gene.path, fixed)) continue;
    const rng = root.stream(`gene:${gene.path}`);
    if (!rng.chance(amount)) continue;
    const value = mutateGene(gene, rng, amount);
    if (value !== undefined) setAt(child, gene.path, value);
  }
  if (options.structure !== false && !isLocked('parts', locked)) {
    const rng = root.stream('structure');
    if (rng.chance(amount * 0.6)) changeStructure(child, rng, registry, locked);
  }
  const result = finish(blueprint, doc, child, registry);
  const unused: Issue[] = locked
    .filter((lock) => lock !== '' && getAt(doc, lock) === undefined)
    .map((lock) => ({
      severity: 'warning' as const,
      path: lock,
      code: 'unknown_lock',
      message: 'nothing at this locked path, so it locks nothing',
      fix: 'use an id-based path such as "body.head" or "parts[id=horns]"',
    }));
  return { ...result, warnings: [...unused, ...result.warnings] };
}
