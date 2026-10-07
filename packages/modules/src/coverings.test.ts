import { readFileSync } from 'node:fs';
import {
  analyzeCreature,
  applyRest,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  definePack,
  definePart,
  FORMAT,
  MotionController,
  Pose,
  type Quality,
  resolveBlueprint,
  type ScatterPoint,
  type Socket,
} from '@spawnforge/core';
import { type Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { basicPack } from './index.ts';

/** Shells, plates, quills, frills, hoods and sails (milestone 9.5, docs/design/9.5-coverings.md). */

// A part that only records what the area tools give it.
const seen: { surface: Socket[]; scatter: ScatterPoint[]; spacing: number }[] = [];
const probe = definePart({
  id: 'probe',
  summary: 'Records the skin an area part sees (tests only).',
  tags: ['test'],
  slot: 'area',
  material: 'horn',
  attach: { on: 'torso', area: 'back', from: 0.1, to: 0.9 },
  params: z.strictObject({}),
  example: { id: 'probe', type: 'probe' },
  hooks: {
    build(ctx) {
      const spacing = 0.04 * ctx.scale;
      seen.push({
        surface: [ctx.surface(0.5, 40), ctx.surface(0.5, -40)],
        scatter: ctx.scatter(spacing, { count: 150 }),
        spacing,
      });
    },
  },
});
const registry = createRegistry([basicPack, definePack({ id: 'test', modules: [probe] })]);
const example = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
const compile = (blueprint: Record<string, unknown>, quality: Quality = 'low') =>
  compileCreature(resolveBlueprint({ format: FORMAT, ...blueprint }, registry), registry, {
    quality,
  });
const cache = new Map<string, CompiledCreature>();
const compiled = (name: string) => {
  let c = cache.get(name);
  if (!c) {
    c = compile(example(name));
    cache.set(name, c);
  }
  return c;
};
const posed = (c: CompiledCreature, flare: number) => {
  const pose = new Pose(c.bones);
  applyRest(pose, c.rig, { flare });
  return pose;
};
const flares = (c: CompiledCreature) => c.rig.chains.filter((ch) => ch.drive === 'flare');

describe('surface and scatter', () => {
  it('covers both flanks alike, keeps its spacing inside its area, the same twice', () => {
    seen.length = 0;
    const blueprint = { extends: 'quadruped', parts: [{ id: 'p', type: 'probe' }] };
    compile(blueprint);
    compile(blueprint);
    const [a, b] = seen;
    if (!a || !b) throw new Error('the probe did not build');
    const [left, right] = a.surface as [Socket, Socket];
    expect(left.position.x).toBeGreaterThan(0);
    expect(left.position.x).toBeCloseTo(-right.position.x, 3);
    expect(left.position.y).toBeCloseTo(right.position.y, 3);
    expect(a.scatter.length).toBeGreaterThan(20);
    expect(a.scatter.length).toBeLessThanOrEqual(150);
    expect(b.scatter.map((q) => q.position.toArray())).toEqual(
      a.scatter.map((q) => q.position.toArray()),
    );
    for (const q of a.scatter) {
      expect(q.at).toBeGreaterThanOrEqual(0.1);
      expect(q.at).toBeLessThanOrEqual(0.9);
      expect(Math.abs(q.angle)).toBeLessThanOrEqual(70);
    }
    // Both flanks get points; none crowd (a chord is shorter than the arc it measures).
    expect(a.scatter.some((q) => q.angle > 20)).toBe(true);
    expect(a.scatter.some((q) => q.angle < -20)).toBe(true);
    let nearest = Infinity;
    for (let i = 0; i < a.scatter.length; i++)
      for (let j = i + 1; j < a.scatter.length; j++)
        nearest = Math.min(
          nearest,
          (a.scatter[i] as ScatterPoint).position.distanceTo(
            (a.scatter[j] as ScatterPoint).position,
          ),
        );
    expect(nearest).toBeGreaterThan(0.7 * a.spacing);
  });
});

describe('shells and bands', () => {
  it('sit outside the skin, over the back', () => {
    for (const type of ['shell', 'armor.bands']) {
      const c = compile({
        extends: 'quadruped',
        limbs: [
          { id: 'foreleg', foot: null },
          { id: 'hindleg', foot: null },
        ],
        parts: [{ id: 'cover', type }],
      });
      const skin = c.skin.positions;
      const normals = c.skin.normals;
      const parts = c.parts.positions;
      expect(parts.length, type).toBeGreaterThan(300);
      const p = new Vector3();
      const s = new Vector3();
      let worst = 0;
      for (let v = 0; v < parts.length / 3; v += 17) {
        p.fromArray(parts, v * 3);
        let best = Infinity;
        let k = 0;
        for (let i = 0; i < skin.length / 3; i += 2) {
          const d = s.fromArray(skin, i * 3).distanceToSquared(p);
          if (d < best) {
            best = d;
            k = i;
          }
        }
        s.fromArray(skin, k * 3);
        const depth = -new Vector3().subVectors(p, s).dot(new Vector3().fromArray(normals, k * 3));
        worst = Math.max(worst, depth);
      }
      expect(worst, type).toBeLessThan(0.01 * c.scale);
    }
  });
});

describe('flare', () => {
  const tips = (c: CompiledCreature, flare: number) => {
    const pose = posed(c, flare);
    return flares(c).map((ch) => pose.tail(ch.bones.at(-1) as number));
  };

  it('opens a frill away from the neck', () => {
    const c = compiled('frilled-lizard');
    expect(flares(c).length).toBe(16);
    const neck = new Vector3().fromArray(
      c.bones.positions,
      c.bones.names.findIndex((n) => n.startsWith('neck')) * 3,
    );
    const reach = (flare: number) =>
      tips(c, flare).reduce((sum, t) => sum + t.distanceTo(neck), 0) / flares(c).length;
    expect(reach(1)).toBeGreaterThan(1.2 * reach(0));
  });

  it('spreads a hood wider', () => {
    const c = compiled('hooded-cobra');
    const span = (flare: number) => {
      const xs = tips(c, flare).map((t) => t.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    // It rests a little open (`open` 0.3), as a cobra's neck is a little wide.
    expect(span(1)).toBeGreaterThan(1.25 * span(0));
  });

  it('raises quills and stands a sail up', () => {
    // A sail's spines stand up along their bones; a quill lies back from its group's bone (which
    // stands out of the skin) by `lie`, and rises as the bone turns.
    const lie = (60 * Math.PI) / 180;
    for (const [name, local] of [
      ['porcupine', new Vector3(0, Math.cos(lie), -Math.sin(lie))],
      ['sail-back', new Vector3(0, 1, 0)],
    ] as const) {
      const c = compiled(name);
      const up = (flare: number) => {
        const pose = posed(c, flare);
        return (
          flares(c).reduce(
            (sum, ch) =>
              sum +
              local.clone().applyQuaternion(pose.worldRot[ch.bones[0] as number] as Quaternion).y,
            0,
          ) / flares(c).length
        );
      };
      expect(up(1), name).toBeGreaterThan(up(0) + 0.05);
    }
  });

  it('opens fully in display, at its peak', () => {
    const c = compiled('frilled-lizard');
    const m = new MotionController(c, { registry });
    for (let i = 0; i < 60; i++) m.update(1 / 60);
    m.act('display');
    const first = flares(c)[0]?.bones[0] as number;
    const full = Math.abs(flares(c)[0]?.poses?.full?.[0] ?? 0);
    let peak = false;
    let widest = 0;
    for (let i = 0; i < 600 && m.action; i++) {
      // Update every frame (`||=` would stop calling it once the peak has passed).
      const events = m.update(1 / 60);
      peak ||= events.some((e) => e.type === 'display-peak');
      widest = Math.max(
        widest,
        (m.pose.rot[first] as Quaternion).angleTo(m.pose.restRot[first] as Quaternion),
      );
    }
    expect(peak).toBe(true);
    expect(widest).toBeGreaterThan(0.85 * full);
  });
});

describe('examples', () => {
  const names = [
    'stone-tortoise',
    'plated-stegosaur',
    'porcupine',
    'frilled-lizard',
    'hooded-cobra',
    'sail-back',
  ];

  it('stay within the hard parts budget at medium', () => {
    for (const name of names) {
      const c = compile(example(name), 'medium');
      expect(c.stats.triangles.parts, name).toBeLessThanOrEqual(20000);
    }
  }, 120_000);

  it('analyse without warnings and describe their coverings', () => {
    const words: Record<string, string> = {
      'stone-tortoise': 'a domed shell on its back',
      'plated-stegosaur': 'plates along its back',
      porcupine: 'quills on its back',
      'frilled-lizard': 'a frill on its neck',
      'hooded-cobra': 'a hood on its neck',
      'sail-back': 'a sail along its back',
    };
    for (const name of names) {
      const a = analyzeCreature(resolveBlueprint(example(name), registry), registry);
      expect(a.warnings, name).toEqual([]);
      expect(a.description, name).toContain(words[name] as string);
    }
  }, 120_000);
});
