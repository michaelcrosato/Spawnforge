import { readFileSync } from 'node:fs';
import {
  buildSkeleton,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  fingerprint,
  MotionController,
  resolveBlueprint,
} from '@spawnforge/core';
import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/**
 * Milestone 8.1's anatomy on real bodies (docs/design/8.1-anatomy.md): muscle 0 is plan 1's
 * mesh exactly, each body gets the masses its rules give, and skinning stretches no more than it
 * did.
 */
const registry = createRegistry([basicPack]);
const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
const compile = (blueprint: unknown, quality: 'low' | 'medium' = 'low') =>
  compileCreature(resolveBlueprint(blueprint, registry), registry, { quality });
const withMuscle = (blueprint: Record<string, unknown>, muscle: number) => ({
  ...blueprint,
  body: { ...((blueprint.body as Record<string, unknown>) ?? {}), muscle },
});

describe('anatomy', () => {
  it('compiles muscle 0 to exactly the mesh each example had before it', () => {
    const before = JSON.parse(
      readFileSync(new URL('./golden-muscle0.json', import.meta.url), 'utf8'),
    ) as Record<string, { low: string; medium: string }>;
    for (const [name, want] of Object.entries(before)) {
      const zero = withMuscle(example(name), 0);
      expect(fingerprint(compile(zero, 'low')), name).toBe(want.low);
      expect(fingerprint(compile(zero, 'medium')), name).toBe(want.medium);
    }
  });

  it('gives each body the masses and shapes its rules call for', () => {
    const build = (blueprint: unknown) =>
      buildSkeleton(resolveBlueprint(blueprint, registry), registry);
    const masses = (name: string) =>
      Object.fromEntries(build(example(name)).chains.map((c) => [c.id, c.masses.length]));
    const shaped = (name: string) =>
      build(example(name))
        .bones.filter((b) => b.shaped)
        .map((b) => b.name);
    // A quadruped: the root sphere, two thigh bellies, a calf and a knee cap on each leg; a chest
    // keel and a neck muscle; torso, tail and legs shaped.
    expect(masses('ridgeback-stalker')).toMatchObject({
      torso: 1,
      neck: 1,
      'foreleg.L': 5,
      'hindleg.R': 5,
    });
    expect(shaped('ridgeback-stalker')).toEqual(
      expect.arrayContaining(['spine.0', 'tail.0', 'hindleg.L.1']),
    );
    // A biped with two-segment limbs: bellies but no caps; a chest from the arms.
    expect(masses('bog-troll')).toMatchObject({ torso: 1, neck: 1, 'leg.L': 4, 'arm.R': 4 });
    // A chitin hexapod: its root spheres only; the segments swell through their profiles, and the
    // clustered pairs give the torso no chest or pelvis.
    const beetle = masses('ember-beetle');
    expect(Object.values(beetle).reduce((a, b) => a + b, 0)).toBe(6);
    expect(shaped('ember-beetle').every((b) => /leg\.[LR]\.\d$/.test(b))).toBe(true);
    // A serpent: no masses and no shaping, only a slightly flatter belly.
    expect(Object.values(masses('reed-viper')).every((n) => n === 0)).toBe(true);
    expect(shaped('reed-viper')).toEqual([]);
    const viper = build(example('reed-viper')).bones.find((b) => b.name === 'spine.2');
    const flat = build(withMuscle(example('reed-viper'), 0)).bones.find(
      (b) => b.name === 'spine.2',
    );
    expect(viper?.cross[0]).toBeGreaterThan(flat?.cross[0] as number);
    expect(viper?.cross[1]).toBeLessThan(flat?.cross[1] as number);
  });

  it.each(['ridgeback-stalker', 'bog-troll'])(
    '%s stretches its skin no more than before over a walk and a turn',
    (name) => {
      const blueprint = example(name);
      const worst = (c: CompiledCreature) => {
        const controller = new MotionController(c, { registry });
        controller.drive(controller.paceSpeed(), 0);
        let stretch = 0;
        for (let frame = 0; frame < 240; frame++) {
          if (frame === 120) controller.drive(controller.paceSpeed(), Math.PI / 2);
          controller.update(1 / 60);
          if (frame % 20 === 19) stretch = Math.max(stretch, edgeStretch(c, controller));
        }
        return stretch;
      };
      const before = worst(compile(withMuscle(blueprint, 0)));
      const after = worst(compile(blueprint));
      expect(after).toBeLessThan(before * 1.1);
    },
  );
});

/**
 * How much the skin's edges stretch in the current pose under linear blend skinning: the 99th
 * percentile of posed length / rest length − 1, over edges at least half the median length
 * (surface nets leave a few slivers whose ratio means nothing). Edges that shorten are left out:
 * the inside of a bend folds whatever the shape.
 */
function edgeStretch(c: CompiledCreature, controller: MotionController): number {
  const pose = controller.pose;
  const n = c.skin.positions.length / 3;
  const posed = new Float32Array(n * 3);
  const p = new Vector3();
  const q = new Vector3();
  const delta = new Quaternion();
  for (let v = 0; v < n; v++) {
    p.set(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const w = c.skin.skinWeight[v * 4 + k] as number;
      if (w <= 0) continue;
      const bone = c.skin.skinIndex[v * 4 + k] as number;
      delta
        .copy(pose.worldRot[bone] as Quaternion)
        .multiply((pose.restWorldRot[bone] as Quaternion).clone().invert());
      q.fromArray(c.skin.positions, v * 3)
        .sub(pose.restWorldPos[bone] as Vector3)
        .applyQuaternion(delta)
        .add(pose.worldPos[bone] as Vector3);
      p.addScaledVector(q, w);
    }
    posed.set([p.x, p.y, p.z], v * 3);
  }
  const stretches: number[] = [];
  const rests: number[] = [];
  const idx = c.skin.indices;
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = (idx[t + e] as number) * 3;
      const b = (idx[t + ((e + 1) % 3)] as number) * 3;
      const rest = Math.hypot(
        (c.skin.positions[a] as number) - (c.skin.positions[b] as number),
        (c.skin.positions[a + 1] as number) - (c.skin.positions[b + 1] as number),
        (c.skin.positions[a + 2] as number) - (c.skin.positions[b + 2] as number),
      );
      if (rest < 1e-6) continue;
      const now = Math.hypot(
        (posed[a] as number) - (posed[b] as number),
        (posed[a + 1] as number) - (posed[b + 1] as number),
        (posed[a + 2] as number) - (posed[b + 2] as number),
      );
      stretches.push(Math.max(0, now / rest - 1));
      rests.push(rest);
    }
  }
  const median = [...rests].sort((x, y) => x - y)[rests.length >> 1] as number;
  const kept = stretches
    .filter((_, i) => (rests[i] as number) > 0.5 * median)
    .sort((x, y) => x - y);
  const at = (f: number) => kept[Math.floor(f * (kept.length - 1))] as number;
  return at(0.99);
}
