import { readFileSync } from 'node:fs';
import {
  analyzeCreature,
  applyRest,
  applyStations,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  FORMAT,
  MotionController,
  Pose,
  type Quality,
  resolveBlueprint,
} from '@spawnforge/core';
import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/** Wings, fins and membranes (milestone 9.3, docs/design/9.3-wings-fins.md). */
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
const tailOf = (pose: Pose, b: number) => pose.tail(b, new Vector3());

/** A membrane vertex skinned by a pose (linear blend, as the GPU does). */
function skinned(c: CompiledCreature, pose: Pose, v: number): Vector3 {
  const m = c.membranes;
  const out = new Vector3();
  const p = new Vector3();
  for (let k = 0; k < 4; k++) {
    const w = m.skinWeight[v * 4 + k] as number;
    if (w <= 0) continue;
    const bone = m.skinIndex[v * 4 + k] as number;
    p.fromArray(m.positions, v * 3)
      .sub(pose.bindWorldPos[bone] as Vector3)
      .applyQuaternion((pose.bindWorldRot[bone] as Quaternion).clone().invert())
      .applyQuaternion(pose.worldRot[bone] as Quaternion)
      .add(pose.worldPos[bone] as Vector3);
    out.addScaledVector(p, w);
  }
  return out;
}

describe('wing skeleton', () => {
  it('builds wings as tubes that leave the skin grid as it was', () => {
    const dragon = compiled('ash-dragon');
    const blueprint = example('ash-dragon');
    const wingless = compile({
      ...blueprint,
      limbs: (blueprint.limbs as { id: string }[]).filter((l) => l.id !== 'wing'),
    });
    expect(dragon.stats.cell).toBeCloseTo(wingless.stats.cell, 9);
    expect(dragon.rig.wings).toHaveLength(2);
    for (const wing of dragon.rig.wings) expect(wing.digits).toHaveLength(4);
  });

  it('roots digits at the wrist, the first continuing the hand', () => {
    const c = compiled('cave-bat');
    const pose = new Pose(c.bones);
    pose.reset();
    applyRest(pose, c.rig, { spread: 1 });
    for (const wing of c.rig.wings) {
      const wrist = tailOf(pose, wing.bones.at(-2) as number);
      const tip = tailOf(pose, wing.bones.at(-1) as number);
      wing.digits.forEach((digit, i) => {
        const head = pose.worldPos[digit[0] as number] as Vector3;
        expect(head.distanceTo(i === 0 ? tip : wrist), `${wing.id} digit ${i}`).toBeLessThan(1e-4);
      });
    }
  });

  it('folds the same way every time and at every quality', () => {
    const low = compile(example('storm-wyvern'), 'low');
    const again = compile(example('storm-wyvern'), 'low');
    const medium = compile(example('storm-wyvern'), 'medium');
    for (const wing of low.rig.wings) {
      const other = medium.rig.wings.find((w) => w.id === wing.id);
      expect(other).toBeDefined();
      const bones = [...wing.bones, ...wing.digits.flat()];
      for (const b of bones) {
        const name = low.bones.names[b] as string;
        const mb = medium.bones.names.indexOf(name);
        for (let k = 0; k < 4; k++) {
          expect(again.bones.rest?.[b * 4 + k]).toBe(low.bones.rest?.[b * 4 + k]);
          expect(medium.bones.rest?.[mb * 4 + k]).toBeCloseTo(low.bones.rest?.[b * 4 + k] ?? 0, 6);
        }
      }
    }
  });
});

describe('the fold', () => {
  it('rests folded: the pose starts at rest, away from the spread bind', () => {
    const c = compiled('ash-dragon');
    const pose = new Pose(c.bones);
    for (const wing of c.rig.wings) {
      const b = wing.bones[0] as number;
      expect((pose.rot[b] as Quaternion).angleTo(pose.restRot[b] as Quaternion)).toBeLessThan(1e-6);
      expect(
        (pose.restRot[b] as Quaternion).angleTo(pose.bindRot[b] as Quaternion),
      ).toBeGreaterThan(0.5);
    }
  });

  it('folds to a fraction of the span, above the ground and along the body', () => {
    for (const [name, most] of [
      ['ash-dragon', 0.6],
      ['cave-bat', 0.6],
      ['storm-wyvern', 0.6],
      ['griffin', 0.4],
    ] as const) {
      const c = compiled(name);
      const pose = new Pose(c.bones);
      const torso = c.scale;
      const rump = Math.min(
        ...c.rig.spine.flatMap((b) => [(pose.worldPos[b] as Vector3).z, tailOf(pose, b).z]),
      );
      for (const wing of c.rig.wings) {
        const root = pose.worldPos[wing.bones[0] as number] as Vector3;
        let span = 0;
        for (const b of [...wing.bones, ...wing.digits.flat()]) {
          const t = tailOf(pose, b);
          span = Math.max(span, t.distanceTo(root));
          expect(t.y, `${name} ${wing.id} above the ground`).toBeGreaterThan(0);
          // Leathery tips may trail along the tail, never further than a torso past the rump.
          expect(t.z, `${name} ${wing.id} not far behind`).toBeGreaterThan(rump - torso);
        }
        expect(span / wing.span, `${name} ${wing.id}`).toBeLessThan(most);
      }
    }
  });

  it('warns about no example wing passing into the body, legs or ground', () => {
    for (const name of [
      'ash-dragon',
      'cave-bat',
      'storm-wyvern',
      'rhino-beetle',
      'luna-moth',
      'reef-shark',
      'griffin',
    ]) {
      const analysis = analyzeCreature(resolveBlueprint(example(name), registry), registry);
      expect(
        analysis.warnings.filter(
          (w) => w.code === 'wing_intersection' || w.code === 'wing_clearance',
        ),
        name,
      ).toEqual([]);
    }
  }, 120_000);

  it('stacks insect wings, hind under fore, the left of a pair above the right', () => {
    const c = compiled('luna-moth');
    const pose = new Pose(c.bones);
    const tipY = (id: string) => {
      const wing = c.rig.wings.find((w) => w.id === id);
      if (!wing) throw new Error(id);
      return tailOf(pose, wing.bones.at(-1) as number).y;
    };
    expect(tipY('hindwing.R')).toBeLessThan(tipY('hindwing.L'));
    expect(tipY('hindwing.L')).toBeLessThan(tipY('forewing.R'));
    expect(tipY('forewing.R')).toBeLessThan(tipY('forewing.L'));
  });

  it('lays wing cases with their inner edge on the midline, over the wings they cover', () => {
    const c = compiled('rhino-beetle');
    const covered = c.rig.wings.filter((w) => w.covered).map((w) => w.id);
    expect(covered.sort()).toEqual(['wing.L', 'wing.R']);
    // The case shells are hard parts riding the case bones: at rest, the nearest to the midline
    // is within 1 cm of it.
    const pose = new Pose(c.bones);
    const caseBones = new Set(
      c.rig.wings.filter((w) => w.id.startsWith('case')).flatMap((w) => [...w.bones]),
    );
    const parts = c.parts;
    let inner = Infinity;
    const p = new Vector3();
    for (let v = 0; v < parts.positions.length / 3; v++) {
      const bone = parts.skinIndex[v * 4] as number;
      if (!caseBones.has(bone)) continue;
      p.fromArray(parts.positions, v * 3)
        .sub(pose.bindWorldPos[bone] as Vector3)
        .applyQuaternion((pose.bindWorldRot[bone] as Quaternion).clone().invert())
        .applyQuaternion(pose.worldRot[bone] as Quaternion)
        .add(pose.worldPos[bone] as Vector3);
      inner = Math.min(inner, Math.abs(p.x));
    }
    expect(inner).toBeLessThan(0.01);
  });
});

describe('membranes', () => {
  /**
   * The ruled-surface oracle: a vertex carried by four stations lies where the two station
   * lines around it put it, whatever the spars do; measured net of where it was built off that
   * surface (a scalloped edge), as a share of its panel's spread width. Leading strips ride
   * offsets of the arm's own bones, so they have no second spar to follow and are left out.
   */
  const oracle = (c: CompiledCreature, pose: Pose) => {
    const bind = new Pose(c.bones);
    applyRest(bind, c.rig, { spread: 1 });
    const owner = new Map<number, { panel: number; k: number; side: 'a' | 'b' }>();
    c.rig.stations.forEach((panel, i) => {
      panel.a.forEach((b, k) => {
        owner.set(b, { panel: i, k, side: 'a' });
      });
      panel.b.forEach((b, k) => {
        owner.set(b, { panel: i, k, side: 'b' });
      });
    });
    const parentsOf = (list: readonly number[]) =>
      [...new Set(list.map((b) => c.bones.parents[b]))].sort().join();
    const strips = new Set(
      c.rig.stations.flatMap((p, i) => (parentsOf(p.a) === parentsOf(p.b) ? [i] : [])),
    );
    const m = c.membranes;
    let worst = 0;
    let checked = 0;
    for (let v = 0; v < m.positions.length / 3; v++) {
      let u = 0;
      let f = 0;
      let k0 = Infinity;
      let panel = -1;
      let all = 0;
      for (let j = 0; j < 4; j++) {
        const w = m.skinWeight[v * 4 + j] as number;
        const o = owner.get(m.skinIndex[v * 4 + j] as number);
        if (w <= 0) continue;
        if (!o) {
          all = -1;
          break;
        }
        all += w;
        panel = o.panel;
        k0 = Math.min(k0, o.k);
      }
      if (all < 0.999 || panel < 0 || strips.has(panel)) continue;
      for (let j = 0; j < 4; j++) {
        const w = m.skinWeight[v * 4 + j] as number;
        const o = owner.get(m.skinIndex[v * 4 + j] as number);
        if (!o || w <= 0) continue;
        if (o.k > k0) u += w;
        if (o.side === 'b') f += w;
      }
      const s = c.rig.stations[panel] as { a: readonly number[]; b: readonly number[] };
      const k1 = Math.min(k0 + 1, s.a.length - 1);
      const ideal = (p: Pose) => {
        const at = (k: number) =>
          new Vector3().lerpVectors(
            p.worldPos[s.a[k] as number] as Vector3,
            p.worldPos[s.b[k] as number] as Vector3,
            f,
          );
        return at(k0).lerp(at(k1), u);
      };
      const built = new Vector3().fromArray(m.positions, v * 3).distanceTo(ideal(bind));
      const width = Math.max(
        ...s.a.map((ia, k) =>
          (bind.worldPos[ia] as Vector3).distanceTo(bind.worldPos[s.b[k] as number] as Vector3),
        ),
      );
      const off = Math.max(0, skinned(c, pose, v).distanceTo(ideal(pose)) - built);
      worst = Math.max(worst, off / Math.max(width, 1e-6));
      checked++;
    }
    return { worst, checked };
  };

  it('carries leathery membranes on the ruled surface between their spars', () => {
    for (const name of ['cave-bat', 'ash-dragon']) {
      const c = compiled(name);
      const pose = new Pose(c.bones);
      // Spread, and on the way there: exact where flight will use it, close while folding,
      // when the inner panel twists through itself at the elbow (inside the folded bundle).
      for (const [spread, most] of [
        [1, 0.001],
        [0.75, 0.02],
        [0.5, 0.15],
        [0.25, 0.15],
        [0, 0.15],
      ] as const) {
        applyRest(pose, c.rig, { spread });
        const { worst, checked } = oracle(c, pose);
        expect(checked).toBeGreaterThan(100);
        expect(worst, `${name} spread ${spread}`).toBeLessThan(most);
      }
      // A wingbeat's stroke, 45° up and down, with a leg swung 60°.
      for (const angle of [-45, 45]) {
        applyRest(pose, c.rig, { spread: 1 });
        for (const wing of c.rig.wings) {
          const b = wing.bones[0] as number;
          (pose.rot[b] as Quaternion).multiply(
            new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (angle * Math.PI) / 180),
          );
        }
        const leg = c.rig.legs[0];
        if (leg)
          (pose.rot[leg.bones[0] as number] as Quaternion).multiply(
            new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 3),
          );
        pose.solve();
        applyStations(pose, c.rig.stations);
        expect(oracle(c, pose).worst, `${name} stroke ${angle}°`).toBeLessThan(0.02);
      }
    }
  });
});

describe('feathers', () => {
  it('fold each feather back along the body, never pointing out or into it', () => {
    const c = compiled('griffin');
    const pose = new Pose(c.bones);
    const back = new Vector3(0, 0, -1);
    for (const wing of c.rig.wings) {
      expect(wing.feathers.length).toBeGreaterThan(20);
      for (const b of wing.feathers) {
        const dir = pose.direction(b);
        expect(dir.angleTo(back), c.bones.names[b]).toBeLessThan((35 * Math.PI) / 180);
      }
    }
  });
});

describe('wings in motion', () => {
  const run = (m: MotionController, seconds: number) => {
    for (let t = 0; t < seconds - 1e-9; t += 1 / 60) m.update(1 / 60);
  };

  it('spreads over about 0.4 s and folds again', () => {
    const c = compiled('storm-wyvern');
    const m = new MotionController(c, { registry });
    run(m, 0.5);
    expect(m.wingSpread).toBeLessThan(0.01);
    m.setWings(1);
    run(m, 0.1);
    expect(m.wingSpread).toBeGreaterThan(0.2);
    expect(m.wingSpread).toBeLessThan(0.8);
    run(m, 0.5 * m.timeScale);
    expect(m.wingSpread).toBeGreaterThan(0.9);
    m.setWings(0);
    run(m, 0.8 * m.timeScale);
    expect(m.wingSpread).toBeLessThan(0.1);
  });

  it('flares the wings with a roar and keeps them folded walking', () => {
    const c = compiled('ash-dragon');
    const m = new MotionController(c, { registry });
    m.drive(m.paceSpeed(), 0);
    for (let i = 0; i < 120; i++) m.update(1 / 60);
    expect(m.wingSpread).toBeLessThan(0.01);
    m.stop();
    m.act('roar');
    let most = 0;
    for (let i = 0; i < 300; i++) {
      m.update(1 / 60);
      most = Math.max(most, m.wingSpread);
    }
    expect(most).toBeGreaterThan(0.5);
  });
});

describe('fins', () => {
  it('builds a shark: rayed fins on fin limbs, a dorsal and a forked tail fin', () => {
    const c = compiled('reef-shark');
    expect(c.rig.fins.length).toBe(4);
    expect(c.rig.wings).toHaveLength(0);
    expect(c.membranes.indices.length / 3).toBeGreaterThan(200);
    // Fins keep their pose: no rest apart from bind.
    expect(c.bones.rest).toBeUndefined();
  });
});
