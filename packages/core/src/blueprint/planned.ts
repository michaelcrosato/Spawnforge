import type { ModuleKind, Registry } from '../registry.ts';
import type { CreatureSpec, LimbRole } from './creature.ts';
import type { Issue } from './issues.ts';

/**
 * Format 0.2 holds all of plan 2's vocabulary before it is built. A blueprint may use any of it:
 * it validates, and compile skips what it cannot draw yet. This lists what is skipped, naming the
 * plan milestone that builds each thing. Pass `written` (the blueprint merged with its preset,
 * before defaults) to include fields whose defaults already have a value, such as `muscle`, only
 * when the blueprint sets them; each milestone deletes its rows here.
 */
export function notBuilt(
  spec: CreatureSpec,
  registry: Registry,
  written?: Readonly<Record<string, unknown>>,
): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const add = (path: string, what: string, milestone: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    issues.push({
      severity: 'warning',
      path,
      code: 'not_built',
      message: `${what} is in the format but not built yet (plan milestone ${milestone}), so it is left out for now`,
      fix: 'keep it: it validates, and it appears once that milestone lands',
    });
  };
  const planned = (kind: ModuleKind, type: string) => registry.get(kind, type)?.planned;

  // Modules that are stubs.
  for (const part of spec.parts) {
    const milestone = planned('part', part.type);
    if (milestone) add(`parts[id=${part.baseId}].type`, `"${part.type}"`, milestone);
  }
  for (const limb of spec.limbs) {
    for (const key of ['foot', 'membrane'] as const) {
      const slot = limb[key];
      const milestone = slot && planned('part', slot.type);
      if (slot && milestone)
        add(`limbs[id=${limb.baseId}].${key}.type`, `"${slot.type}"`, milestone);
    }
  }
  spec.skin.layers.forEach((layer, i) => {
    const milestone = planned('pattern', layer.type);
    if (milestone) add(`skin.layers[${i}].type`, `"${layer.type}"`, milestone);
  });
  for (const [kind, key] of [
    ['gait', 'gaits'],
    ['action', 'actions'],
  ] as const) {
    for (const ref of spec.motion[key]) {
      const milestone = planned(kind, ref.type);
      if (milestone) add(`motion.${key}[type=${ref.type}]`, `"${ref.type}"`, milestone);
    }
  }

  // The core's own new fields.
  const body = spec.body;
  if (body.neck.count > 1) add('body.neck.count', 'several heads', '9.1');
  if (body.tail.count > 1) add('body.tail.count', 'several tails', '9.1');
  if (body.tail.forkAt > 0 && body.tail.count > 1) add('body.tail.forkAt', 'a forked tail', '9.1');
  if (body.neck.curve !== 0) add('body.neck.curve', 'an S-curved neck', '8.1');
  const roles: Record<string, [string, string]> = {
    wing: ['a wing', '9.3'],
    fin: ['a fin', '9.3'],
    tentacle: ['a tentacle', '9.4'],
  };
  for (const limb of spec.limbs) {
    const role = roles[limb.role];
    if (role) add(`limbs[id=${limb.baseId}].role`, role[0], role[1]);
    if (limb.stance) add(`limbs[id=${limb.baseId}].stance`, `a ${limb.stance} stance`, '8.2');
  }
  for (const part of spec.parts)
    if (/^(head|neck|jaw|tail)\.[LR]\d+/.test(part.on))
      add(`parts[id=${part.baseId}].attach.on`, `a part on "${part.on}"`, '9.1');
  if (spec.skin.fur) add('skin.fur', 'fur', '8.4');
  if (spec.skin.material === 'hide') add('skin.material', 'the hide material', '8.4');
  if (spec.motion.media.water) add('motion.media.water', 'swimming', '10.3');
  if (spec.motion.media.air) add('motion.media.air', 'flying', '10.4');

  // Fields whose defaults have a value: only when the blueprint writes them.
  if (written) {
    const get = (...path: string[]) =>
      path.reduce<unknown>(
        (node, key) =>
          typeof node === 'object' && node !== null
            ? (node as Record<string, unknown>)[key]
            : undefined,
        written,
      );
    if (get('body', 'muscle') !== undefined) add('body.muscle', 'muscle', '8.1');
    for (const key of ['lips', 'tongue', 'brow'])
      if (get('body', 'head', key) !== undefined) add(`body.head.${key}`, `the ${key}`, '8.3');
    const limbs = get('limbs');
    for (const limb of Array.isArray(limbs) ? limbs : [])
      if (typeof limb === 'object' && limb !== null && 'muscle' in limb)
        add(`limbs[id=${String((limb as { id?: unknown }).id)}].muscle`, 'muscle', '8.1');
  }
  return issues;
}

/** Limb roles the pipeline builds; the others arrive in phase 9. */
const BUILT_ROLES: readonly LimbRole[] = ['leg', 'arm'];

/** Instance names of extra heads, necks, jaws and tails (`head.L1`), built from milestone 9.1. */
const EXTRA_INSTANCE = /^(head|neck|jaw|tail)\.[LR]\d+(\.|$)/;

/**
 * The part of a creature the pipeline can build today: limbs of the roles it knows, and the
 * parts that sit on what exists. Everything left out is reported by `notBuilt`.
 */
export function buildable(spec: CreatureSpec): CreatureSpec {
  const limbs = spec.limbs.filter((l) => BUILT_ROLES.includes(l.role));
  const known = new Set(limbs.map((l) => l.id));
  const dropped = new Set(spec.limbs.filter((l) => !known.has(l.id)).map((l) => l.id));
  const parts = spec.parts.filter((p) => !dropped.has(p.on) && !EXTRA_INSTANCE.test(p.on));
  // Parts on dropped parts go too, however deep.
  for (let changed = true; changed; ) {
    changed = false;
    const ids = new Set(parts.map((p) => p.id));
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (!part) continue;
      const onPart = spec.parts.some((p) => p.id === part.on);
      if (onPart && !ids.has(part.on)) {
        parts.splice(i, 1);
        changed = true;
      }
    }
  }
  if (limbs.length === spec.limbs.length && parts.length === spec.parts.length) return spec;
  return { ...spec, limbs, parts };
}
