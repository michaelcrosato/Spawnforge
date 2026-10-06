import type { ModuleKind, Registry } from '../registry.ts';
import type { CreatureSpec } from './creature.ts';
import type { Issue } from './issues.ts';

/**
 * Format 0.2 holds all of plan 2's vocabulary before it is built. A blueprint may use any of it:
 * it validates, and compile skips what it cannot draw yet. These warnings say so, naming the plan
 * milestone that builds each thing.
 */
export function notBuilt(spec: CreatureSpec, registry: Registry): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const warn = (path: string, what: string, milestone: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    issues.push({
      severity: 'warning',
      path,
      code: 'not_built',
      message: `${what} is in the format but not built yet (plan milestone ${milestone}), so it is left out of the creature for now`,
      fix: 'nothing to fix: it validates, and it appears once that milestone lands',
    });
  };
  const planned = (kind: ModuleKind, type: string) => registry.get(kind, type)?.planned;

  for (const part of spec.parts) {
    const milestone = planned('part', part.type);
    if (milestone) warn(`parts[id=${part.baseId}].type`, `"${part.type}"`, milestone);
  }
  for (const limb of spec.limbs) {
    const foot = limb.foot && planned('part', limb.foot.type);
    if (foot && limb.foot) warn(`limbs[id=${limb.baseId}].foot.type`, `"${limb.foot.type}"`, foot);
  }
  spec.skin.layers.forEach((layer, i) => {
    const milestone = planned('pattern', layer.type);
    if (milestone) warn(`skin.layers[${i}].type`, `"${layer.type}"`, milestone);
  });
  for (const [kind, key] of [
    ['gait', 'gaits'],
    ['action', 'actions'],
  ] as const) {
    for (const ref of spec.motion[key]) {
      const milestone = planned(kind, ref.type);
      if (milestone) warn(`motion.${key}[type=${ref.type}]`, `"${ref.type}"`, milestone);
    }
  }
  return issues;
}
