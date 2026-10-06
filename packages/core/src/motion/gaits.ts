import type { CreatureSpec } from '../blueprint/creature.ts';
import type { GaitModule, Registry } from '../registry.ts';
import type { GaitInfo, MotionData } from './controller.ts';

/** Resolves a creature's gaits (module timing plus its own params) for the motion controller. */
export function motionData(spec: CreatureSpec, registry: Registry): MotionData {
  const pairs = spec.limbs.filter((l) => l.role === 'leg' && l.mirror === 1).length;
  const gaits: GaitInfo[] = [];
  for (const ref of spec.motion.gaits) {
    const module = registry.get('gait', ref.type) as GaitModule | undefined;
    // Stubs (`planned`) validate but have nothing to run yet.
    if (!module || module.planned) continue;
    const p = ref.params as Record<string, unknown>;
    const num = (key: string, fallback: number) =>
      typeof p[key] === 'number' ? (p[key] as number) : fallback;
    const spine = module.legPairs !== 'any' && module.legPairs.includes(0);
    const duty = num(
      'duty',
      typeof module.duty === 'function' ? module.duty(Math.max(1, pairs)) : module.duty,
    );
    gaits.push({
      id: module.id,
      wave: module.wave(Math.max(1, pairs)),
      duty,
      froude: module.froude,
      stepHeight: num('stepHeight', 0.15),
      stride: num('stride', 1),
      spine,
      amplitude: num('amplitude', 0.18),
      waves: num('waves', 1.5),
    });
  }
  // Slowest first, so the controller starts walking.
  gaits.sort((a, b) => a.froude[0] - b.froude[0]);
  const actions = spec.motion.actions.map((ref) => ({ id: ref.type, params: ref.params }));
  return { temperament: spec.motion.temperament, gaits, actions };
}
