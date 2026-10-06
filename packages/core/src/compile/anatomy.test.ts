import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  limbFactor,
  shapedProfile,
  slenderness,
  strength,
  tailFactor,
  torsoFactor,
  torsoPlan,
} from './anatomy.ts';
import { buildSdf, SdfEvaluator } from './sdf.ts';
import type { BoneDef, ChainDef, MassDef } from './types.ts';

describe('anatomy rules', () => {
  it('change nothing at muscle 0', () => {
    expect(strength(0)).toBe(0);
    expect(strength(0.5)).toBe(1);
    for (const T of [0, 0.3, 0.5, 0.99, 1]) {
      expect(limbFactor(T, 3, 0, false)).toBe(1);
      expect(limbFactor(T, 3, 0, true)).toBe(1);
    }
    expect(torsoFactor(0.2, { chest: 0.2, pelvis: 0.7, waist: 0.45 }, 0)).toBe(1);
    expect(tailFactor(0, 0)).toBe(1);
    expect(limbFactor(0.2, 3, 0, false, { swell: () => 0.5 })).toBe(1);
    // A profile multiplied by 1 is the profile it was (or none).
    expect(
      shapedProfile(
        () => 0.1,
        undefined,
        () => 1,
      ),
    ).toBeUndefined();
    expect(
      shapedProfile(
        () => 0.1,
        [0.1, 0.2, 0.3],
        () => 1,
      ),
    ).toEqual([0.1, 0.2, 0.3]);
  });

  it('narrow joints, most at the ankle, and never touch the tip', () => {
    const n = 3;
    expect(limbFactor(1 / 3, n, 1, false)).toBeLessThan(0.9);
    expect(limbFactor(2 / 3, n, 1, false)).toBeLessThan(limbFactor(1 / 3, n, 1, false));
    expect(limbFactor(1, n, 2, false)).toBeCloseTo(1, 6);
    expect(limbFactor(1, n, 2, true)).toBeCloseTo(1, 6);
    // Chitin segments swell in the middle and pinch at the joints.
    expect(limbFactor(0.5 / 3, n, 1, true)).toBeGreaterThan(1.1);
    expect(limbFactor(1 / 3, n, 1, true)).toBeLessThan(0.95);
    // On two segments the one joint is a knee, narrowed like one.
    expect(limbFactor(1 / 2, 2, 1, false)).toBeCloseTo(limbFactor(1 / 3, n, 1, false), 2);
    // Stocky segments narrow less at their joints, and slender ones fully.
    expect(limbFactor(1 / 3, n, 1, false, { joint: () => 0 })).toBe(1);
    expect(slenderness(0.02, 0.3)).toBe(1);
    expect(slenderness(0.2, 0.3)).toBe(0);
    expect(slenderness(0.13, 0.3)).toBeGreaterThan(0);
  });

  it('swell a segment 40% down it with muscle, and leave its joints alone', () => {
    const shape = { swell: (k: number) => (k === 0 ? 0.3 : 0) };
    // The thigh is fullest 40% of the way to the knee: about 1.3 times its radius.
    expect(limbFactor(0.4 / 3, 3, 1, false, shape)).toBeCloseTo(1.3, 2);
    expect(limbFactor(0.4 / 3, 3, 1, false, shape)).toBeGreaterThan(
      limbFactor(0.8 / 3, 3, 1, false, shape),
    );
    // At the knee the swell is gone and only the joint's narrowing is left.
    expect(limbFactor(1 / 3, 3, 1, false, shape)).toBeCloseTo(limbFactor(1 / 3, 3, 1, false), 6);
    // Segments with no swell are unchanged between their joints.
    expect(limbFactor(2.5 / 3, 3, 1, false, shape)).toBeCloseTo(
      limbFactor(2.5 / 3, 3, 1, false),
      6,
    );
  });

  it('plan a chest, pelvis and waist from the limbs on the torso', () => {
    const quadruped = torsoPlan([
      { role: 'leg', at: 0.15 },
      { role: 'leg', at: 0.15 },
      { role: 'leg', at: 0.85 },
      { role: 'leg', at: 0.85 },
    ]);
    expect(quadruped.chest).toBeCloseTo(0.23);
    expect(quadruped.pelvis).toBe(0.85);
    expect(quadruped.waist).toBeCloseTo(0.54);
    // A biped: arms in front, one leg pair behind.
    const biped = torsoPlan([
      { role: 'arm', at: 0.12 },
      { role: 'leg', at: 0.9 },
    ]);
    expect([biped.chest, biped.pelvis]).toEqual([0.2, 0.9]);
    // Legs only (a raptor without arms, a wyvern before its wings): a pelvis, no chest.
    expect(torsoPlan([{ role: 'leg', at: 0.6 }])).toEqual({
      chest: undefined,
      pelvis: 0.6,
      waist: undefined,
    });
    // Clustered pairs (insects): none.
    expect(
      torsoPlan([
        { role: 'leg', at: 0.1 },
        { role: 'leg', at: 0.22 },
        { role: 'leg', at: 0.34 },
      ]),
    ).toEqual({ chest: undefined, pelvis: undefined, waist: undefined });
  });
});

describe('masses in the field', () => {
  const bone = (head: Vector3, tail: Vector3, r: number): BoneDef => ({
    name: 'b',
    parent: -1,
    section: 'limb',
    owner: 'x',
    head,
    tail,
    up: new Vector3(0, 1, 0),
    r0: r,
    r1: r,
    cross: [1, 1],
    t0: 0,
    t1: 1,
    skin: true,
    chain: 0,
  });
  const bones = [bone(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0.1)];
  const mass = (z: number, y: number, blend: number): MassDef => ({
    bone: 0,
    a: new Vector3(0, y, z),
    b: new Vector3(0, y, z + 0.2),
    ra: 0.09,
    rb: 0.07,
    up: new Vector3(0, 1, 0),
    cross: [0.9, 1],
    blend,
  });
  const chain = (masses: MassDef[]): ChainDef[] => [
    { id: 'x', section: 'limb', owner: 'x', bones: [0], parentBone: -1, blend: 0, masses },
  ];
  const points = Array.from({ length: 50 }, (_, i) => [
    Math.sin(i) * 0.2,
    Math.cos(i * 1.3) * 0.2,
    (i / 50) * 1.2 - 0.1,
  ]);

  it('blend each mass with the cones alone, in any order', () => {
    const sdf = buildSdf(bones, chain([mass(0.2, 0.06, 0.05), mass(0.3, -0.06, 0.05)]), 0.001);
    const evaluator = new SdfEvaluator(sdf);
    const forward = [0, 1, 2];
    const backward = [2, 1, 0];
    for (const [x, y, z] of points)
      expect(evaluator.eval(x as number, y as number, z as number, forward)).toBe(
        evaluator.eval(x as number, y as number, z as number, backward),
      );
  });

  it('are a plain union at blend 0, and swell the surface only within their blend', () => {
    const plain = new SdfEvaluator(buildSdf(bones, chain([mass(0.4, 0.05, 0)]), 0.001));
    const cone = new SdfEvaluator(buildSdf(bones, chain([]), 0.001));
    // The same capsule as a bone of its own.
    const alone = new SdfEvaluator(
      buildSdf(
        [
          {
            ...(bones[0] as BoneDef),
            head: new Vector3(0, 0.05, 0.4),
            tail: new Vector3(0, 0.05, 0.6),
            r0: 0.09,
            r1: 0.07,
            cross: [0.9, 1],
          },
        ],
        chain([]),
        0.001,
      ),
    );
    for (const [x, y, z] of points) {
      const p = [x as number, y as number, z as number] as const;
      expect(plain.eval(...p)).toBeCloseTo(Math.min(cone.eval(...p), alone.eval(...p)), 12);
    }
    // Far along the bone from a blended mass, the field is the cone's.
    const blended = new SdfEvaluator(buildSdf(bones, chain([mass(0.05, 0.04, 0.04)]), 0.001));
    expect(blended.eval(0, 0.2, 0.9)).toBe(cone.eval(0, 0.2, 0.9));
    // Near it, the surface swells: the field is lower than either alone.
    expect(blended.eval(0, 0.16, 0.15)).toBeLessThan(cone.eval(0, 0.16, 0.15));
  });
});
