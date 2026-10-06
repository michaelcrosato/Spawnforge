import {
  compileCreature,
  createRegistry,
  FORMAT,
  MotionController,
  motionData,
  resolveBlueprint,
} from '@spawnforge/core';
import type { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
function creature(plan: string, extra: Record<string, unknown> = {}) {
  const spec = resolveBlueprint({ format: FORMAT, extends: plan, ...extra }, registry);
  const compiled = compileCreature(spec, registry, { quality: 'low' });
  return { compiled, controller: new MotionController(compiled, motionData(spec, registry)) };
}

/** Steps a controller, recording each leg's ankle while planted. */
function run(
  controller: MotionController,
  seconds: number,
  ground?: (x: number, z: number) => { height: number },
) {
  const steps: { leg: string; time: number }[] = [];
  let worstSlide = 0;
  const planted = new Map<string, Vector3>();
  for (let t = 0; t < seconds; t += 1 / 60) {
    for (const e of controller.update(1 / 60, ground ? { ground } : {})) {
      if (e.type === 'footstep' && e.leg) {
        steps.push({ leg: e.leg, time: e.time });
        planted.delete(e.leg);
      }
    }
    for (const leg of (
      controller as unknown as {
        legs: { rig: { id: string; bones: number[] }; swinging: boolean }[];
      }
    ).legs) {
      const ankle = controller.pose.tail(leg.rig.bones.at(-1) as number);
      if (leg.swinging) {
        planted.delete(leg.rig.id);
        continue;
      }
      const first = planted.get(leg.rig.id);
      if (!first) planted.set(leg.rig.id, ankle.clone());
      else worstSlide = Math.max(worstSlide, Math.hypot(ankle.x - first.x, ankle.z - first.z));
    }
  }
  return { steps, worstSlide };
}

describe('locomotion', () => {
  it('walks a quadruped to its target, one foot at a time, without feet sliding', () => {
    const { compiled, controller } = creature('quadruped');
    controller.moveTo({ x: 0, z: 3 });
    const { steps, worstSlide } = run(controller, 12);
    expect(controller.position.z).toBeGreaterThan(2.4);
    expect(steps.length).toBeGreaterThan(8);
    // Lateral sequence walk: hind left, fore left, hind right, fore right.
    const order = steps.slice(4, 12).map((s) => s.leg);
    const next: Record<string, string> = {
      'hindleg.L': 'foreleg.L',
      'foreleg.L': 'hindleg.R',
      'hindleg.R': 'foreleg.R',
      'foreleg.R': 'hindleg.L',
    };
    for (let i = 1; i < order.length; i++) expect(order[i]).toBe(next[order[i - 1] as string]);
    expect(worstSlide).toBeLessThan(0.02 * compiled.scale);
  });

  it('keeps planted feet still in every gait', () => {
    for (const [plan, gait] of [
      ['quadruped', 'walk'],
      ['quadruped', 'trot'],
      ['biped', 'walk'],
      ['hexapod', 'tripod'],
      ['hexapod', 'walk'],
    ] as const) {
      const { compiled, controller } = creature(plan);
      controller.lockGait(gait);
      controller.drive(controller.gaitSpeed(gait), 0);
      const { worstSlide } = run(controller, 4);
      expect(worstSlide, `${plan} ${gait}`).toBeLessThan(0.01 * compiled.scale);
    }
  });

  it('trots with diagonal pairs moving together', () => {
    const { controller } = creature('quadruped');
    controller.drive(controller.maxSpeed() * 0.8, 0);
    const { steps } = run(controller, 6);
    expect(controller.gait?.id).toBe('trot');
    const late = steps.filter((s) => s.time > 3);
    // Diagonal partners land within a few milliseconds of each other.
    const time = (leg: string) => late.find((s) => s.leg === leg)?.time ?? Number.NaN;
    expect(Math.abs(time('foreleg.L') - time('hindleg.R'))).toBeLessThan(0.02);
  });

  it('runs a hexapod in alternating tripods', () => {
    const { controller } = creature('hexapod');
    controller.drive(controller.maxSpeed() * 0.5, 0);
    const { steps } = run(controller, 5);
    const late = steps.filter((s) => s.time > 2.5);
    const time = (leg: string) => late.find((s) => s.leg === leg)?.time ?? Number.NaN;
    expect(Math.abs(time('frontleg.L') - time('hindleg.L'))).toBeLessThan(0.02);
    expect(Math.abs(time('frontleg.L') - time('midleg.R'))).toBeLessThan(0.02);
  });

  it('slithers a serpent forward along its own trail', () => {
    const { controller } = creature('serpent');
    controller.moveTo({ x: 0, z: 2 });
    run(controller, 10);
    expect(controller.position.z).toBeGreaterThan(1.5);
    for (const p of controller.pose.worldPos) expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
  });

  it('slithers in S-curves', () => {
    const { compiled, controller } = creature('serpent');
    controller.drive(controller.paceSpeed(), 0);
    run(controller, 8);
    // Sideways spread of the spine around the travel line (heading +Z).
    const xs = [...compiled.rig.spine, ...compiled.rig.tail].map(
      (b) => (controller.pose.worldPos[b] as Vector3).x,
    );
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.15 * compiled.scale);
  });

  it('keeps a rearing neck raised while slithering', () => {
    const { compiled, controller } = creature('serpent', {
      body: { neck: { length: 0.5, pitch: 80, segments: 4 }, head: { pitch: 0 } },
    });
    const rest = compiled.bones.positions[compiled.rig.head * 3 + 1] as number;
    controller.moveTo({ x: 0, z: 2 });
    run(controller, 6);
    const head = controller.pose.worldPos[compiled.rig.head] as Vector3;
    expect(head.y).toBeGreaterThan(rest * 0.8);
    expect(controller.position.z).toBeGreaterThan(1);
  });

  it('plants feet on uneven ground', () => {
    const { compiled, controller } = creature('quadruped');
    const ground = (x: number, z: number) => ({
      height: 0.15 * Math.sin(x * 2) * Math.cos(z * 1.5),
    });
    controller.moveTo({ x: 0.5, z: 3 });
    run(controller, 8, ground);
    const legs = (
      controller as unknown as {
        legs: { rig: { bones: number[] }; swinging: boolean; footLift: number }[];
      }
    ).legs;
    for (const leg of legs) {
      if (leg.swinging) continue;
      const ankle = controller.pose.tail(leg.rig.bones.at(-1) as number);
      expect(Math.abs(ankle.y - ground(ankle.x, ankle.z).height - leg.footLift)).toBeLessThan(
        0.03 * compiled.scale,
      );
    }
  });

  it('stands still once it arrives', () => {
    for (const plan of ['quadruped', 'biped', 'hexapod']) {
      const { controller } = creature(plan);
      controller.moveTo({ x: 0.4, z: 1.5 });
      const { steps } = run(controller, 12, (x, z) => ({ height: 0.05 * Math.sin(x * 3 + z) }));
      expect(controller.speed).toBe(0);
      expect(steps.filter((s) => s.time > 10)).toEqual([]);
    }
  });

  it('is deterministic', () => {
    const a = creature('quadruped').controller;
    const b = creature('quadruped').controller;
    a.moveTo({ x: 1, z: 2 });
    b.moveTo({ x: 1, z: 2 });
    run(a, 3);
    run(b, 3);
    expect(a.pose.worldPos.map((p) => p.toArray())).toEqual(
      b.pose.worldPos.map((p) => p.toArray()),
    );
  });
});
