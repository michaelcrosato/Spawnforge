import { readFileSync, writeFileSync } from 'node:fs';
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
 * Milestone 8.1's anatomy on real bodies (docs/design/8.1-anatomy.md): muscle 0 is the mesh
 * without muscle exactly, each body gets the masses its rules give, and skinning stretches no
 * more than it did.
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
  // Pinned in 8.1 as plan 1's meshes; re-pinned when the bog troll got hands (8.2) and when 8.3
  // rebuilt every head (with UPDATE_GOLDEN=1, as golden.json). Muscle 0 is now the mesh without
  // muscle: what the masses and profiles add is all that muscle changes.
  it('compiles muscle 0 to exactly the mesh each example had without muscle', () => {
    const file = new URL('./golden-muscle0.json', import.meta.url);
    const before = JSON.parse(readFileSync(file, 'utf8')) as Record<
      string,
      { low: string; medium: string }
    >;
    const actual = Object.fromEntries(
      Object.keys(before).map((name) => {
        const zero = withMuscle(example(name), 0);
        return [
          name,
          { low: fingerprint(compile(zero, 'low')), medium: fingerprint(compile(zero, 'medium')) },
        ];
      }),
    );
    if (process.env.UPDATE_GOLDEN) writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    expect(actual).toEqual(before);
  });

  it('leaves the skin it does not reshape exactly where it was', () => {
    // The grid keeps the muscle-free lattice, so the head and mouth are sampled as before.
    const head = (c: CompiledCreature) => {
      const ids = new Set(['head', 'jaw'].map((n) => c.bones.names.indexOf(n)));
      const out: string[] = [];
      for (let v = 0; v < c.skin.positions.length / 3; v++)
        if (
          ids.has(c.skin.skinIndex[v * 4] as number) &&
          (c.skin.skinWeight[v * 4] as number) > 0.999
        )
          out.push(
            Array.from(c.skin.positions.subarray(v * 3, v * 3 + 3), (x) => x.toFixed(6)).join(),
          );
      return out.sort();
    };
    // (A short neck's muscle may reach under the jaw, as the troll's does; these do not. A body
    // near the skin's 30k limit, as the beetle's is, leaves its head less room to be refined in
    // (8.3), so muscle may change how finely such a head is meshed.)
    for (const name of ['ridgeback-stalker', 'rust-raptor']) {
      const plain = head(compile(withMuscle(example(name), 0), 'medium'));
      expect(plain.length, name).toBeGreaterThan(100);
      expect(head(compile(example(name), 'medium')), name).toEqual(plain);
    }
  });

  it('gives each body the masses and shapes its rules call for', () => {
    const build = (blueprint: unknown) =>
      buildSkeleton(resolveBlueprint(blueprint, registry), registry);
    // Anatomy's own masses; the head's details (8.3) are counted below.
    const masses = (name: string) =>
      Object.fromEntries(
        build(example(name)).chains.map((c) => [c.id, c.masses.filter((m) => !m.kind).length]),
      );
    const details = (name: string) =>
      (build(example(name)).chains.find((c) => c.id === 'head')?.masses ?? [])
        .filter((m) => m.kind)
        .map((m) => m.kind);
    const shaped = (name: string) =>
      build(example(name))
        .bones.filter((b) => b.shaped)
        .map((b) => b.name);
    // A quadruped: a neck muscle and each leg's root sphere; torso, tail and legs shaped (the
    // legs' muscle is in their profiles).
    expect(masses('ridgeback-stalker')).toMatchObject({
      torso: 0,
      neck: 1,
      'foreleg.L': 1,
      'hindleg.R': 1,
    });
    expect(shaped('ridgeback-stalker')).toEqual(
      expect.arrayContaining(['spine.0', 'tail.0', 'hindleg.L.1']),
    );
    // An upright biped.
    expect(masses('bog-troll')).toMatchObject({ torso: 0, neck: 1, 'leg.L': 1, 'arm.R': 1 });
    expect(shaped('bog-troll')).toEqual(expect.arrayContaining(['leg.L.0', 'arm.R.1']));
    // A chitin hexapod: its root spheres only; the segments swell through their profiles, and the
    // clustered pairs give the torso no chest or pelvis.
    const beetle = masses('ember-beetle');
    expect(Object.values(beetle).reduce((a, b) => a + b, 0)).toBe(6);
    expect(shaped('ember-beetle').every((b) => /leg\.[LR]\.\d$/.test(b))).toBe(true);
    // A serpent: no masses; a throat behind the head and a flatter belly.
    expect(Object.values(masses('reed-viper')).every((n) => n === 0)).toBe(true);
    expect(shaped('reed-viper').every((b) => b.startsWith('neck.'))).toBe(true);
    expect(shaped('reed-viper')).toContain('neck.1');
    const viper = build(example('reed-viper')).bones.find((b) => b.name === 'spine.2');
    const flat = build(withMuscle(example('reed-viper'), 0)).bones.find(
      (b) => b.name === 'spine.2',
    );
    expect(viper?.cross[0]).toBeGreaterThan(flat?.cross[0] as number);
    expect(viper?.cross[1]).toBeLessThan(flat?.cross[1] as number);
    // Head details: a brow over each eye, two cheekbones and two nostrils, and lips along the
    // mouth (24 cones) unless a blueprint sets them to 0, as the serpent preset does.
    const count = (name: string, kind: string) => details(name).filter((k) => k === kind).length;
    expect(count('ridgeback-stalker', 'carve')).toBe(2);
    expect(count('ridgeback-stalker', 'detail')).toBe(2 + 2 + 24);
    expect(count('reed-viper', 'detail')).toBe(2 + 2);
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
