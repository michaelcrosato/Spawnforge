import { readFileSync } from 'node:fs';
import {
  analyzeCreature,
  applyRest,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  FORMAT,
  MotionController,
  type PartModule,
  Pose,
  type Quality,
  resolveBlueprint,
} from '@spawnforge/core';
import { type Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/** Tentacles, antennae, mandibles and pincers (milestone 9.4, docs/design/9.4-tentacles-parts.md). */
const registry = createRegistry([basicPack]);
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
const specOf = (name: string) => resolveBlueprint(example(name), registry);
const restPose = (c: CompiledCreature, options: Parameters<typeof applyRest>[2] = {}) => {
  const pose = new Pose(c.bones);
  applyRest(pose, c.rig, options);
  return pose;
};
const tipOf = (pose: Pose, bones: readonly number[]) => pose.tail(bones.at(-1) as number);
const lengthOf = (c: CompiledCreature, bones: readonly number[]) =>
  bones.reduce((sum, b) => sum + (c.bones.lengths[b] ?? 0), 0);
/** How far a bone has turned from its rest rotation (radians). */
const turned = (pose: Pose, b: number) =>
  (pose.rot[b] as Quaternion).angleTo(pose.restRot[b] as Quaternion);

/** A quadruped with one pair of tentacles on its back. */
const withTentacle = (extra: Record<string, unknown>) =>
  compile({
    extends: 'quadruped',
    limbs: [
      {
        id: 'feeler',
        role: 'tentacle',
        attach: { on: 'torso', at: 0.4, side: 'both', angle: 20 },
        length: 0.8,
        segments: 12,
        radius: [0.03, 0.008],
        ...extra,
      },
    ],
  });

describe('tentacle skeleton', () => {
  it('curls toward the belly, its tip turning back toward the root', () => {
    const straight = withTentacle({ curl: 0 });
    const curled = withTentacle({ curl: 270 });
    for (const c of [straight, curled]) expect(c.rig.tentacles).toHaveLength(2);
    const reach = (c: CompiledCreature) => {
      const pose = restPose(c);
      const t = c.rig.tentacles[0]?.bones ?? [];
      return tipOf(pose, t).distanceTo(pose.worldPos[t[0] as number] as Vector3);
    };
    expect(reach(straight)).toBeGreaterThan(
      0.95 * lengthOf(straight, straight.rig.tentacles[0]?.bones ?? []),
    );
    expect(reach(curled)).toBeLessThan(0.6 * reach(straight));
  });

  it('keeps curlStart straight and its segments even', () => {
    const c = withTentacle({ curl: 180, curlStart: 0.5 });
    const pose = restPose(c);
    const bones = c.rig.tentacles[0]?.bones ?? [];
    const dir = (b: number) =>
      pose
        .tail(b)
        .sub(pose.worldPos[b] as Vector3)
        .normalize();
    const first = dir(bones[0] as number);
    for (const b of bones.slice(0, 6)) expect(dir(b).dot(first)).toBeGreaterThan(0.999);
    expect(dir(bones.at(-1) as number).dot(first)).toBeLessThan(0.5);
    const lengths = bones.map((b) => c.bones.lengths[b] as number);
    for (const l of lengths) expect(l).toBeCloseTo(lengths[0] as number, 6);
  });

  it('rings the mouth on the head, pointing forward', () => {
    const c = compiled('kraken');
    const pose = restPose(c);
    const head = pose.worldPos[c.rig.heads[0]?.head as number] as Vector3;
    expect(c.rig.tentacles).toHaveLength(10);
    for (const t of c.rig.tentacles) {
      const root = pose.worldPos[t.bones[0] as number] as Vector3;
      const second = pose.worldPos[t.bones[1] as number] as Vector3;
      expect(second.z - root.z).toBeGreaterThan(0);
      expect(root.distanceTo(head)).toBeLessThan(0.5 * c.scale);
    }
  });

  it('rests on the ground, never under it', () => {
    for (const name of ['kraken']) {
      const c = compiled(name);
      const pose = restPose(c);
      for (const t of c.rig.tentacles)
        for (const b of t.bones) expect(pose.tail(b).y).toBeGreaterThan(-1e-6);
    }
  });
});

describe('parts with bones', () => {
  const withBones = registry
    .list()
    .filter((m) => m.kind === 'part' && typeof (m as PartModule).hooks?.bones === 'function')
    .map((m) => m.id);

  it('covers antennae, mandibles and pincers', () => {
    expect(withBones).toEqual(expect.arrayContaining(['antenna', 'mandible', 'hand.pincer']));
  });

  it('names, parents and mirrors an antenna pair, skinned to its bones', () => {
    const c = compiled('luna-moth');
    const names = c.bones.names;
    const head = names.indexOf('head');
    for (const side of ['L', 'R']) {
      const ids = names.flatMap((n, i) => (n.startsWith(`antennae.${side}.0.`) ? [i] : []));
      expect(ids).toHaveLength(6);
      expect(c.bones.parents[ids[0] as number]).toBe(head);
      for (const [k, b] of ids.entries()) {
        expect(c.bones.sections[b]).toBe('part');
        if (k > 0) expect(c.bones.parents[b]).toBe(ids[k - 1]);
      }
    }
    // Mirrored copies mirror, to within the socket's place on the meshed skin.
    const at = (n: string) => new Vector3().fromArray(c.bones.positions, names.indexOf(n) * 3);
    for (let k = 0; k < 6; k++) {
      const l = at(`antennae.L.0.${k}`);
      const r = at(`antennae.R.0.${k}`).setX(-at(`antennae.R.0.${k}`).x);
      expect(l.distanceTo(r)).toBeLessThan(0.01 * c.scale);
    }
    // The part mesh is weighted to the antennae's bones.
    const part = new Set(names.flatMap((n, i) => (n.startsWith('antennae.') ? [i] : [])));
    const { skinIndex, skinWeight } = c.parts;
    let weighted = 0;
    for (let i = 0; i < skinIndex.length; i++)
      if ((skinWeight[i] as number) > 0 && part.has(skinIndex[i] as number)) weighted++;
    expect(weighted).toBeGreaterThan(100);
  });

  it('builds every part with bones the same twice, at every quality', () => {
    const hosts: Record<string, Record<string, unknown>> = {
      antenna: {
        extends: 'hexapod',
        parts: [
          {
            id: 'feelers',
            type: 'antenna',
            attach: { on: 'head', at: 0.3, angle: 30, side: 'both' },
          },
        ],
      },
      mandible: { extends: 'hexapod', parts: [{ id: 'jaws', type: 'mandible' }] },
      'hand.pincer': example('dune-scorpion'),
    };
    for (const id of withBones) {
      const host = hosts[id];
      expect(host, id).toBeDefined();
      for (const quality of ['low', 'high'] as const) {
        const a = compile(host as Record<string, unknown>, quality);
        const b = compile(host as Record<string, unknown>, quality);
        expect(Array.from(a.bones.positions)).toEqual(Array.from(b.bones.positions));
        expect(Array.from(a.parts.positions)).toEqual(Array.from(b.parts.positions));
        expect(a.bones.sections.filter((s) => s === 'part').length).toBeGreaterThan(0);
      }
    }
  }, 120_000);
});

describe('drives', () => {
  it('opens fangs with the jaw', () => {
    const c = compiled('tomb-spider');
    const fangs = c.rig.chains.filter((ch) => ch.drive === 'jaw');
    expect(fangs).toHaveLength(2);
    const gap = (jaw: number) => {
      const pose = restPose(c, { jaw });
      return tipOf(pose, fangs[0]?.bones ?? []).distanceTo(tipOf(pose, fangs[1]?.bones ?? []));
    };
    expect(gap(1)).toBeGreaterThan(gap(0) * 1.3);
  });

  it('turns a pincer finger by its pose at grip 1, toward the fixed finger', () => {
    const c = compiled('dune-scorpion');
    const grips = c.rig.chains.filter((ch) => ch.drive === 'grip');
    expect(grips).toHaveLength(2);
    const open = restPose(c);
    const shut = restPose(c, { grip: 1 });
    for (const g of grips) {
      const b = g.bones[0] as number;
      expect(turned(shut, b)).toBeCloseTo(Math.abs(g.poses?.full?.[0] ?? 0), 3);
      // The moving finger sits above the fixed one: shutting brings its tip down.
      expect(tipOf(shut, g.bones).y).toBeLessThan(tipOf(open, g.bones).y);
    }
  });
});

describe('motion', () => {
  const run = (
    c: CompiledCreature,
    seconds: number,
    each?: (m: MotionController, events: string[]) => void,
  ) => {
    const m = new MotionController(c, { registry });
    for (let t = 0; t < seconds - 1e-9; t += 1 / 60)
      each?.(
        m,
        m.update(1 / 60).map((e) => e.type),
      );
    return m;
  };

  it('drapes tentacles and keeps antennae above the ground while moving', () => {
    for (const [name, chains] of [
      ['kraken', (c: CompiledCreature) => c.rig.tentacles.map((t) => t.bones)],
      [
        'luna-moth',
        (c: CompiledCreature) =>
          c.rig.chains.filter((ch) => ch.owner.startsWith('antennae')).map((ch) => ch.bones),
      ],
    ] as const) {
      const c = compiled(name);
      let lowest = Infinity;
      const m = new MotionController(c, { registry });
      m.drive(m.paceSpeed(), 0.5);
      for (let i = 0; i < 240; i++) {
        m.update(1 / 60);
        if (i < 60) continue;
        for (const bones of chains(c))
          for (const b of bones) lowest = Math.min(lowest, m.pose.tail(b).y);
      }
      expect(lowest, name).toBeGreaterThan(-0.002 * c.scale);
    }
  });

  it('reaches the nearest tentacle to what it bites', () => {
    const c = compiled('kraken');
    const m = run(c, 2);
    const pose = m.pose;
    // A point in reach of the left feeding tentacle, ahead and a little to the side of its tip.
    const feeder = c.rig.tentacles.find((t) => t.id === 'feeder.L');
    expect(feeder).toBeDefined();
    const bones = feeder?.bones ?? [];
    const root = (pose.worldPos[bones[0] as number] as Vector3).clone();
    const tip = tipOf(pose, bones);
    const length = lengthOf(c, bones);
    const target = root.clone().add(
      tip
        .clone()
        .sub(root)
        .normalize()
        .multiplyScalar(0.7 * length),
    );
    target.y = 0.4 * c.scale;
    m.act('bite', { target });
    let nearest = Infinity;
    for (let i = 0; i < 180 && m.action; i++) {
      m.update(1 / 60);
      for (const t of c.rig.tentacles)
        nearest = Math.min(nearest, tipOf(m.pose, t.bones).distanceTo(target));
    }
    expect(nearest).toBeLessThan(0.1 * length);
  });

  it('pinches with the claw nearer the target, shut at contact', () => {
    const c = compiled('dune-scorpion');
    const m = run(c, 2);
    const head = m.pose.worldPos[c.rig.heads[0]?.head as number] as Vector3;
    // Ahead and to the creature's left (+x).
    const target = head.clone().add(new Vector3(0.3, 0, 0.3).multiplyScalar(c.scale));
    const grips = c.rig.chains.filter((ch) => ch.drive === 'grip');
    const left = grips.find((g) => (c.bones.positions[(g.bones[0] as number) * 3] as number) > 0);
    const right = grips.find((g) => g !== left);
    m.act('pinch', { target });
    let contact = false;
    for (let i = 0; i < 240 && m.action && !contact; i++) {
      contact = m.update(1 / 60).some((e) => e.type === 'pinch-contact');
      if (!contact) continue;
      const shut = (g: typeof left) => turned(m.pose, g?.bones[0] as number);
      expect(shut(left)).toBeGreaterThan(0.3);
      expect(shut(right)).toBeLessThan(0.05);
    }
    expect(contact).toBe(true);
  });

  it('lashes the tail at a target in reach, the tip passing close', () => {
    const c = compiled('dune-scorpion');
    const m = run(c, 2);
    const tail = c.rig.tails[0]?.bones ?? [];
    const root = (m.pose.worldPos[tail[0] as number] as Vector3).clone();
    const length = lengthOf(c, tail);
    // Over the back, ahead of the tail's root, in reach.
    const target = root.clone().add(new Vector3(0, 0.45, 0.65).multiplyScalar(length));
    const before = tipOf(m.pose, tail).distanceTo(target);
    m.act('lash', { target });
    let nearest = Infinity;
    let contact = false;
    for (let i = 0; i < 240 && m.action; i++) {
      contact ||= m.update(1 / 60).some((e) => e.type === 'lash-contact');
      nearest = Math.min(nearest, tipOf(m.pose, tail).distanceTo(target));
    }
    expect(contact).toBe(true);
    expect(nearest).toBeLessThan(Math.min(0.25 * length, 0.5 * before));
  });

  it('lashes a tentacle on a legless body', () => {
    const c = compiled('kraken');
    const m = run(c, 1);
    const head = m.pose.worldPos[c.rig.heads[0]?.head as number] as Vector3;
    m.act('lash', { target: head.clone().add(new Vector3(1, 0, 1)) });
    const events: string[] = [];
    for (let i = 0; i < 240 && m.action; i++) events.push(...m.update(1 / 60).map((e) => e.type));
    expect(events).toContain('lash-contact');
  });
});

describe('examples', () => {
  it('analyse without warnings and describe their new parts', () => {
    const words: Record<string, string[]> = {
      kraken: ['ten tentacles', 'suckers'],
      'dune-scorpion': ['pincers', 'can pinch and lash'],
      'luna-moth': ['feathery antennae'],
      'tomb-spider': ['fangs'],
    };
    for (const [name, expected] of Object.entries(words)) {
      const a = analyzeCreature(specOf(name), registry);
      expect(a.warnings, name).toEqual([]);
      for (const w of expected) expect(a.description, name).toContain(w);
    }
    const kraken = analyzeCreature(specOf('kraken'), registry);
    expect(kraken.measurements.tentacleReach).toBeCloseTo(2.2 * 1.4, 1);
  });
});
