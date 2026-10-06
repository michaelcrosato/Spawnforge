import { readFileSync } from 'node:fs';
import {
  analyzeCreature,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  MotionController,
  resolveBlueprint,
  statsInput,
} from '@spawnforge/core';
import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/**
 * Milestone 8.2's feet, hands and stance on real bodies (docs/design/8.2-feet.md): each foot
 * holds the leg at its own height, planted feet with a stance roll without sliding, hooves stay
 * upright, and hands have fingers and a thumb.
 */
const registry = createRegistry([basicPack]);
const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
const compile = (blueprint: unknown) =>
  compileCreature(resolveBlueprint(blueprint, registry), registry, { quality: 'low' });
const withFoot = (blueprint: Record<string, unknown>, foot: Record<string, unknown>) => ({
  ...blueprint,
  limbs: (blueprint.limbs as Record<string, unknown>[]).map((l) =>
    l.foot && (l.id === 'foreleg' || l.id === 'hindleg' || l.id === 'leg') ? { ...l, foot } : l,
  ),
});
const ankleHeight = (c: CompiledCreature) => Math.min(...c.rig.legs.map((l) => l.restFoot[1]));

interface LegView {
  rig: { id: string; bones: number[]; toes: number[][] };
  swinging: boolean;
  roll?: { heel: number };
}
const legsOf = (c: MotionController) => (c as unknown as { legs: LegView[] }).legs;

describe('feet and stance', () => {
  it('stands each foot at its own height, and a leg without a stance at plan 1’s', () => {
    const wolf = example('grey-wolf');
    const claw = compile(withFoot(wolf, { type: 'foot.claw', toes: 3 }));
    const paw = compile(wolf);
    const hoof = compile(withFoot(wolf, { type: 'foot.hoof' }));
    const pad = compile(withFoot(wolf, { type: 'foot.pad' }));
    const stance = compile(withFoot(wolf, { type: 'foot.claw', toes: 3 }));
    // Plan 1's claws stand the ankle a tip radius up; a paw lifts it onto the toes, a hoof onto
    // its tip, and a column foot keeps it low.
    expect(ankleHeight(paw)).toBeGreaterThan(ankleHeight(claw) * 1.3);
    expect(ankleHeight(hoof)).toBeGreaterThan(ankleHeight(paw));
    expect(ankleHeight(pad)).toBeLessThan(ankleHeight(paw));
    expect(ankleHeight(stance)).toBe(ankleHeight(claw));
    // A stance written on the leg lifts it without a module's say.
    const digitigrade = compile({
      ...wolf,
      limbs: (wolf.limbs as Record<string, unknown>[]).map((l) => ({
        ...l,
        foot: { type: 'foot.claw', toes: 3 },
        stance: 'digitigrade',
      })),
    });
    expect(ankleHeight(digitigrade)).toBeGreaterThan(ankleHeight(claw) * 1.5);
    // Every foot stands on the ground: the lowest toe point is at y ≈ 0.
    for (const c of [paw, hoof, pad]) expect(lowestToe(c)).toBeLessThan(0.01 * c.scale);
  });

  it('rolls a planted paw: the heel lifts while the ankle and the toe tips stay put', () => {
    const c = compile(example('grey-wolf'));
    const controller = new MotionController(c, { registry });
    controller.drive(controller.paceSpeed(), 0);
    const planted = new Map<string, { ankle: Vector3; tips: Vector3[] }>();
    let ankleSlide = 0;
    let tipSlide = 0;
    let heel = 0;
    for (let frame = 0; frame < 6 * 60; frame++) {
      for (const e of controller.update(1 / 60))
        if (e.type === 'footstep' && e.leg) planted.delete(e.leg);
      for (const leg of legsOf(controller)) {
        if (leg.swinging) {
          planted.delete(leg.rig.id);
          continue;
        }
        heel = Math.max(heel, leg.roll?.heel ?? 0);
        const ankle = controller.pose.tail(leg.rig.bones.at(-1) as number);
        const tips = leg.rig.toes.map((t) => controller.pose.tail(t.at(-1) as number));
        const first = planted.get(leg.rig.id);
        if (!first) {
          planted.set(leg.rig.id, { ankle: ankle.clone(), tips: tips.map((t) => t.clone()) });
          continue;
        }
        ankleSlide = Math.max(
          ankleSlide,
          Math.hypot(ankle.x - first.ankle.x, ankle.z - first.ankle.z),
        );
        tips.forEach((t, i) => {
          tipSlide = Math.max(tipSlide, t.distanceTo(first.tips[i] as Vector3));
        });
      }
    }
    // The heel rises by a share of the toes' length, the ankle does not slide, and the toes
    // stay on the spots they landed on.
    expect(heel).toBeGreaterThan(0.01 * c.scale);
    expect(ankleSlide).toBeLessThan(0.01 * c.scale);
    expect(tipSlide).toBeLessThan(0.01 * c.scale);
  });

  it('keeps hooves upright and flat on the ground, without rolling', () => {
    const c = compile(example('tusk-boar'));
    const controller = new MotionController(c, { registry });
    controller.drive(controller.paceSpeed(), 0);
    let tilt = 0;
    for (let frame = 0; frame < 4 * 60; frame++) {
      controller.update(1 / 60);
      for (const leg of legsOf(controller)) {
        expect(leg.roll).toBeUndefined();
        for (const toe of leg.rig.toes) {
          const dir = controller.pose.direction(toe[0] as number);
          tilt = Math.max(tilt, Math.acos(Math.min(1, -dir.y)));
        }
      }
    }
    expect(tilt).toBeLessThan(0.05);
  });

  it('gives hands fingers and an opposed thumb, and counts their claws', () => {
    const c = compile(example('bog-troll'));
    for (const arm of c.rig.arms) expect(arm.toes).toHaveLength(5);
    const spec = resolveBlueprint(example('bog-troll'), registry);
    const input = statsInput(spec, analyzeCreature(spec, registry), registry);
    // Five on each hand, and the feet's three each.
    expect(input.claws.count).toBe(2 * 5 + 2 * 3);
  });

  it('builds every option of every foot', () => {
    const wolf = example('grey-wolf');
    const feet = [
      ...['hidden', 'short', 'long'].map((claws) => ({ type: 'foot.paw', claws, toes: 5 })),
      { type: 'foot.hoof', cloven: false },
      { type: 'foot.hoof', cloven: true, height: 2, size: 2 },
      { type: 'foot.talon', grip: 0 },
      { type: 'foot.talon', grip: 1, talonLength: 0 },
      { type: 'foot.pad', nails: 0 },
      { type: 'foot.pad', nails: 5, width: 2.5 },
      { type: 'hand.grasp', claws: 0 },
      { type: 'hand.grasp', claws: 0.05, fingers: 2 },
    ];
    for (const foot of feet) {
      const c = compile(withFoot(wolf, foot));
      expect(c.warnings, JSON.stringify(foot)).toEqual([]);
      expect([...c.parts.positions].every(Number.isFinite), JSON.stringify(foot)).toBe(true);
      expect(lowestToe(c), JSON.stringify(foot)).toBeLessThan(0.02 * c.scale);
    }
  });
});

/** The lowest point of any leg's toes in the rest pose (metres above the ground). */
function lowestToe(c: CompiledCreature): number {
  let low = Infinity;
  for (const leg of c.rig.legs)
    for (const toe of leg.toes)
      for (const b of toe) {
        const head = new Vector3().fromArray(c.bones.positions, b * 3);
        const tail = new Vector3(0, 1, 0)
          .applyQuaternion(new Quaternion().fromArray(c.bones.rotations, b * 4))
          .multiplyScalar(c.bones.lengths[b] as number)
          .add(head);
        low = Math.min(low, Math.min(head.y, tail.y) - (c.bones.radii[b] ?? 0));
      }
  return low;
}
