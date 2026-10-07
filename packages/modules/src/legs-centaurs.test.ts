import { readFileSync } from 'node:fs';
import {
  analyzeCreature,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  FORMAT,
  MotionController,
  mainHead,
  parseScenario,
  resolveBlueprint,
  ScenarioRun,
} from '@spawnforge/core';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/** Eight legs and centaurs (milestone 9.2, docs/design/9.2-legs-centaurs.md). */
const registry = createRegistry([basicPack]);
const spec = (blueprint: Record<string, unknown>) =>
  resolveBlueprint({ format: FORMAT, ...blueprint }, registry);
const compile = (blueprint: Record<string, unknown>) =>
  compileCreature(spec(blueprint), registry, { quality: 'low' });
const example = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
const bone = (c: CompiledCreature, name: string) => {
  const i = c.bones.names.indexOf(name);
  if (i < 0) throw new Error(`no bone ${name}`);
  return i;
};
const restPos = (c: CompiledCreature, name: string) =>
  new Vector3().fromArray(c.bones.positions, bone(c, name) * 3);

describe('eight legs', () => {
  const spider = compile({ extends: 'octopod' });

  it('runs the tripod gait on four pairs as an alternating tetrapod', () => {
    expect(spider.motion.gaits.map((g) => g.id)).toContain('tripod');
    const c = new MotionController(spider, { registry });
    const { speed } = c.cadence('tripod');
    c.drive(speed, 0);
    for (let i = 0; i < 240; i++) c.update(1 / 120);
    expect(c.gait?.id).toBe('tripod');
    const sets = [
      new Set(['leg1.L', 'leg2.R', 'leg3.L', 'leg4.R']),
      new Set(['leg1.R', 'leg2.L', 'leg3.R', 'leg4.L']),
    ];
    let swinging = 0;
    for (let i = 0; i < 240; i++) {
      c.update(1 / 120);
      const lifted = c
        .feet()
        .filter((f) => !f.planted)
        .map((f) => f.leg);
      swinging += lifted.length;
      // Whatever is in the air belongs to one tetrapod, so four feet always stand.
      expect(
        sets.some((s) => lifted.every((leg) => s.has(leg))),
        lifted.join(' '),
      ).toBe(true);
    }
    expect(swinging).toBeGreaterThan(0);
  });

  it('arches long sprawled legs: every knee stands above its hip', () => {
    for (const leg of spider.rig.legs) {
      const hip = new Vector3().fromArray(spider.bones.positions, (leg.bones[0] as number) * 3);
      const knee = new Vector3().fromArray(spider.bones.positions, (leg.bones[1] as number) * 3);
      expect(knee.y, leg.id).toBeGreaterThan(hip.y);
    }
  });

  it('leaves short sprawled legs and upright legs as they were', () => {
    // A hexapod's legs (at most 0.7 long) keep their pose; the goldens pin it to the bit.
    const beetle = compile({ extends: 'hexapod' });
    for (const leg of beetle.rig.legs) {
      const hip = new Vector3().fromArray(beetle.bones.positions, (leg.bones[0] as number) * 3);
      const knee = new Vector3().fromArray(beetle.bones.positions, (leg.bones[1] as number) * 3);
      expect(knee.y - hip.y, leg.id).toBeLessThan(0.05 * beetle.scale);
    }
  });
});

describe('the upright front', () => {
  const centaur = compile({ extends: 'centaur' });
  const neck = mainHead(centaur.rig).neck;

  it('rises in equal bones, with the shoulders where `at` puts them', () => {
    const lengths = neck.map((b) => centaur.bones.lengths[b] as number);
    // Equal along the curve; the chords differ by its slight bend.
    for (const l of lengths) expect(l / (lengths[0] as number)).toBeCloseTo(1, 1);
    const base = restPos(centaur, 'neck.0');
    const top = restPos(centaur, 'head');
    const shoulder = restPos(centaur, 'arm.L.0');
    // The arms sit at `at` 0.3 from the head end: 70% of the way up the front.
    const up = (shoulder.y - base.y) / (top.y - base.y);
    expect(up).toBeGreaterThan(0.6);
    expect(up).toBeLessThan(0.8);
    // Nearly straight up: the head is barely ahead of the waist.
    expect(Math.abs(top.z - base.z)).toBeLessThan(0.15 * centaur.scale);
  });

  it('hangs the arms from the chest’s edge, clear of the ribs', () => {
    const shoulder = restPos(centaur, 'arm.L.0');
    const elbow = restPos(centaur, 'arm.L.1');
    // The front's profile at `at` 0.3, across its wide section.
    const halfWidth = 0.12 * 1.22 * centaur.scale;
    expect(shoulder.x).toBeGreaterThan(0.8 * halfWidth);
    expect(elbow.x).toBeGreaterThan(shoulder.x);
    expect(restPos(centaur, 'arm.R.0').x).toBeCloseTo(-shoulder.x, 6);
  });

  it('broadens the shoulders with muscle', () => {
    const plain = compile({ extends: 'centaur', body: { muscle: 0 } });
    // The skin's width across the shoulders, just below the arm roots.
    const shoulders = (k: CompiledCreature) => {
      const y = restPos(k, 'arm.L.0').y;
      const p = k.skin.positions;
      let w = 0;
      for (let i = 0; i < p.length; i += 3)
        if (Math.abs((p[i + 1] as number) - y) < 0.02 && (p[i + 2] as number) > 0.3)
          w = Math.max(w, Math.abs(p[i] as number));
      return w;
    };
    expect(shoulders(centaur)).toBeGreaterThan(shoulders(plain) + 0.01);
  });

  it('stays upright while the body pitches up a slope', () => {
    const c = new MotionController(centaur, { registry });
    const slope = (_x: number, z: number) => ({ height: 0.25 * z });
    c.drive(c.paceSpeed(), 0);
    for (let i = 0; i < 360; i++) c.update(1 / 120, { ground: slope });
    const spine = centaur.rig.spine;
    const back = c.pose.worldPos[spine[0] as number] as Vector3;
    const front = c.pose.worldPos[spine.at(-1) as number] as Vector3;
    const bodyPitch = Math.atan2(front.y - back.y, front.z - back.z);
    expect(bodyPitch).toBeGreaterThan(0.1);
    const waist = c.pose.worldPos[neck[0] as number] as Vector3;
    const chest = c.pose.worldPos[neck.at(-1) as number] as Vector3;
    const lean = Math.atan2(chest.z - waist.z, chest.y - waist.y);
    const restLean = Math.atan2(
      restPos(centaur, `neck.${neck.length - 1}`).z - restPos(centaur, 'neck.0').z,
      restPos(centaur, `neck.${neck.length - 1}`).y - restPos(centaur, 'neck.0').y,
    );
    // Tipping with the body would add the whole pitch; it keeps a small share of it.
    expect(Math.abs(lean - restLean)).toBeLessThan(0.35 * bodyPitch);
  });

  it('swings each arm with the foreleg on the other side, and reaches with them to bite', () => {
    const c = new MotionController(centaur, { registry });
    c.drive(c.paceSpeed(), 0);
    for (let i = 0; i < 240; i++) c.update(1 / 120);
    const hand = bone(centaur, 'arm.L.2');
    const hip = bone(centaur, 'foreleg.R.0');
    const arm: number[] = [];
    const foot: number[] = [];
    for (let i = 0; i < 240; i++) {
      c.update(1 / 120);
      arm.push((c.pose.worldPos[hand] as Vector3).z - c.position.z);
      const right = c.feet().find((f) => f.leg === 'foreleg.R');
      foot.push((right?.position.z ?? 0) - (c.pose.worldPos[hip] as Vector3).z);
    }
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    const ma = mean(arm);
    const mf = mean(foot);
    let num = 0;
    let da = 0;
    let df = 0;
    arm.forEach((a, i) => {
      const f = (foot[i] as number) - mf;
      num += (a - ma) * f;
      da += (a - ma) ** 2;
      df += f * f;
    });
    expect(num / Math.sqrt(da * df)).toBeGreaterThan(0.5);
    expect(Math.max(...arm) - Math.min(...arm)).toBeGreaterThan(0.05 * centaur.scale);

    const still = new MotionController(centaur, { registry });
    for (let i = 0; i < 60; i++) still.update(1 / 120);
    const rest = (still.pose.worldPos[hand] as Vector3).clone();
    const head = still.pose.worldPos[mainHead(centaur.rig).head] as Vector3;
    still.act('bite', { target: { x: 0, y: head.y - 0.2, z: head.z + 0.8 } });
    let reach = 0;
    for (let i = 0; i < 120; i++) {
      still.update(1 / 120);
      reach = Math.max(reach, (still.pose.worldPos[hand] as Vector3).z - rest.z);
    }
    expect(reach).toBeGreaterThan(0.15 * centaur.scale);
  });
});

describe('balance', () => {
  it("counts the front's mass, and names it when it tips the body forward", () => {
    const centaur = analyzeCreature(spec({ extends: 'centaur' }), registry);
    expect(centaur.stability.supported).toBe(true);
    // The upright front draws the centre of mass ahead of the horse body's middle.
    expect(centaur.measurements.centreOfMass[2]).toBeGreaterThan(0.05);
    const heavy = analyzeCreature(
      spec({
        extends: 'centaur',
        body: { neck: { length: 1, radius: 0.3, pitch: 50 } },
        limbs: [{ id: 'foreleg', attach: { at: 0.4 } }],
      }),
      registry,
    );
    const warning = heavy.warnings.find((w) => w.code === 'unbalanced');
    expect(warning?.fix).toMatch(/upright front/);
  });
});

describe('the examples', () => {
  const course = parseScenario({
    ground: 'course',
    duration: 30,
    calls: [
      {
        at: 0,
        do: 'follow',
        path: [
          [0, 2],
          [1.5, 3.5],
          [0, 5],
        ],
      },
    ],
  }).scenario;

  it.each(['tomb-spider', 'grove-centaur'])(
    '%s walks the terrain course cleanly and passes analyze',
    (name) => {
      const blueprint = spec(example(name));
      const compiled = compileCreature(blueprint, registry, { quality: 'low' });
      if (!course) throw new Error('bad scenario');
      const result = new ScenarioRun(compiled, registry, course).run();
      expect(result.courses).toEqual([{ call: 0, reached: 3, of: 3 }]);
      expect(result.footsteps).toBeGreaterThan(10);
      expect(result.footSlide).toBeLessThan(0.05);
      const analysis = analyzeCreature(blueprint, registry);
      expect(analysis.warnings).toEqual([]);
    },
    60_000,
  );
});
