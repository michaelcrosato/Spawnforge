import { readFileSync } from 'node:fs';
import {
  analyzeCreature,
  bakeClips,
  compileCreature,
  computeStats,
  createRegistry,
  type Ground,
  MotionController,
  type MotionEvent,
  openSea,
  parseScenario,
  resolveBlueprint,
  ScenarioRun,
  testCourse,
  type Water,
  withLake,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
const build = (blueprint: Record<string, unknown>) => {
  const spec = resolveBlueprint(blueprint, registry);
  const compiled = compileCreature(spec, registry, { quality: 'low' });
  return { spec, compiled, controller: new MotionController(compiled, { registry }) };
};

/** A lake on the test course, between the start and a point 16 m ahead. */
const lake = withLake(testCourse(2, 0.15, 1.5), { x: 0, z: 8, radius: 4, depth: 2 });

function run(
  controller: MotionController,
  input: { ground: Ground; water?: Water },
  seconds: number,
  each?: (events: MotionEvent[]) => void,
): MotionEvent[] {
  const all: MotionEvent[] = [];
  for (let i = 0; i < seconds * 120; i++) {
    const events = controller.update(1 / 120, input);
    all.push(...events);
    each?.(events);
  }
  return all;
}

describe('swimming (10.3)', () => {
  it('walks a crocodile into a lake, swims it across and climbs out', () => {
    const { compiled, controller } = build(example('river-crocodile'));
    controller.place(0, 0, 0, lake.ground, lake.water);
    controller.moveTo({ x: 0, z: 16 });
    let lowest = Infinity;
    const events = run(controller, lake, 45, () => {
      if (controller.medium !== 'water') return;
      // Floating: the back stays near the surface, never down at the bed.
      lowest = Math.min(lowest, controller.position.y);
    });
    const media = events.filter((e) => e.type === 'medium').map((e) => e.medium);
    expect(media).toEqual(['water', 'land']);
    const gaits = events.filter((e) => e.type === 'gait').map((e) => e.gait);
    expect(gaits.some((g) => g?.startsWith('swim.'))).toBe(true);
    expect(gaits.at(-1)).toBe('walk');
    expect(events.some((e) => e.type === 'arrive')).toBe(true);
    expect(controller.position.z).toBeGreaterThan(15.5);
    expect(controller.feet().every((f) => f.planted)).toBe(true);
    expect(lowest).toBeGreaterThan(-0.6 * compiled.scale);
  });

  it('dives a shark to the depth asked for, and keeps it off the bed', () => {
    const { compiled, controller } = build(example('reef-shark'));
    const sea = openSea(compiled.scale);
    controller.place(0, 0, 0, sea.ground, sea.water);
    expect(controller.medium).toBe('water');
    controller.moveTo({ x: 0, y: -3, z: 60 });
    let pitch = 0;
    run(controller, sea, 12, () => {
      pitch = Math.min(pitch, controller.pose.rot[compiled.rig.root]?.x ?? 0);
    });
    // It reached the depth and levelled out there.
    const body = controller.pose.worldPos[compiled.rig.spine[0] as number];
    expect(Math.abs((body?.y ?? 0) + 3)).toBeLessThan(0.15);
    // Shallow water with the target under the bed: it swims along the bottom, clear of it.
    const bed = -1;
    const shallow: Ground = () => ({ height: bed });
    const d = build(example('reef-shark')).controller;
    d.place(0, 0, 0, shallow, sea.water);
    d.moveTo({ x: 0, y: -5, z: 60 });
    let into = 0;
    run(d, { ground: shallow, water: sea.water }, 8, () => {
      for (const [i, p] of d.pose.worldPos.entries())
        if (compiled.bones.sections[i] !== 'fin')
          into = Math.max(into, bed - (p.y - (compiled.bones.radii[i] ?? 0)));
    });
    expect(into).toBeLessThan(0.02 * compiled.scale);
  });

  it('beats its tail faster the faster it swims (Strouhal 0.3)', () => {
    const beats = (speed: number) => {
      const { compiled, controller } = build(example('reef-shark'));
      const sea = openSea(compiled.scale);
      controller.place(0, 0, 0, sea.ground, sea.water);
      controller.drive(speed, 0);
      run(controller, sea, 4);
      let cycles = 0;
      let last = controller.phase;
      run(controller, sea, 6, () => {
        if (controller.phase < last) cycles++;
        last = controller.phase;
      });
      return cycles / 6;
    };
    const slow = beats(1);
    const fast = beats(1.6);
    expect(fast / slow).toBeGreaterThan(1.4);
    expect(fast / slow).toBeLessThan(1.8);
  });

  it('keeps a sea turtle in the water at the shore, beating its flippers', () => {
    const { compiled, controller } = build(example('sea-turtle'));
    expect(compiled.motion.gaits.map((g) => g.id)).toEqual(['swim.flap']);
    controller.place(0, 8, 0, lake.ground, lake.water);
    expect(controller.medium).toBe('water');
    controller.moveTo({ x: 0, z: 20 });
    const events = run(controller, lake, 30);
    // It cannot walk, so it stops in the shallows rather than beach itself.
    expect(events.filter((e) => e.type === 'medium')).toEqual([]);
    expect(controller.medium).toBe('water');
    expect(controller.position.z).toBeGreaterThan(10);
    expect(lake.water(controller.position.x, controller.position.z)).not.toBeNull();
  });

  it('checks swimmers: heads above the surface, nothing into the bed', () => {
    const croc = analyzeCreature(build(example('river-crocodile')).spec, registry);
    expect(croc.swimming?.headClearance).toBeGreaterThan(0);
    expect(croc.swimming?.bed.worst).toBe(0);
    expect(croc.warnings).toEqual([]);
    // Swimming gaits run in the water, not on land.
    expect(croc.motion.map((m) => m.gait)).not.toContain('swim.undulate');
    expect(croc.speed.swim).toBeGreaterThan(0.5);
    expect(croc.description).toMatch(/swims up to/);
    // A head held low goes under.
    const low = example('river-crocodile');
    low.body.neck.pitch = -35;
    low.body.head.pitch = -30;
    const under = analyzeCreature(build(low).spec, registry);
    expect(under.warnings.map((w) => w.code)).toContain('head_underwater');
    // A fish is checked in open water.
    const shark = analyzeCreature(build(example('reef-shark')).spec, registry);
    expect(shark.motion.map((m) => m.ground)).toEqual(['water']);
    expect(shark.swimming?.headClearance).toBeUndefined();
    expect(shark.description).toMatch(/It swims at about/);
  });

  it('gives rpg a swimming speed', () => {
    const stats = (name: string) => {
      const { spec } = build(example(name));
      return computeStats(spec, analyzeCreature(spec, registry), registry, 'rpg');
    };
    expect(stats('reef-shark').swim).toBeGreaterThan(1);
    expect(stats('grey-wolf').swim).toBe(0);
  });

  it('runs scenarios in a lake or the sea', () => {
    const { compiled } = build(example('river-crocodile'));
    const { scenario } = parseScenario({
      water: { x: 0, z: 8, radius: 4, depth: 2 },
      duration: 40,
      calls: [{ at: 0, do: 'moveTo', to: [0, 16] }],
    });
    const result = new ScenarioRun(compiled, registry, scenario as never).run();
    expect(result.events.filter((e) => e.type === 'medium').map((e) => e.medium)).toEqual([
      'water',
      'land',
    ]);
    const shark = build(example('reef-shark')).compiled;
    const dive = parseScenario({
      water: 'sea',
      duration: 16,
      targets: { deep: [0, -2, 12] },
      calls: [{ at: 0, do: 'moveTo', to: 'deep' }],
    });
    const deep = new ScenarioRun(shark, registry, dive.scenario as never).run();
    expect(deep.targets.deep?.closest).toBeLessThan(0.6);
  });

  it('bakes swimming cycles in open water', () => {
    const { compiled } = build(example('reef-shark'));
    const [swim] = bakeClips(compiled, registry, { clips: ['swim.undulate'], fps: 20 });
    expect(swim?.loop).toBe(true);
    expect(swim?.speed).toBeGreaterThan(0.5);
    // The root sits under the surface (y 0), where it swims.
    const root = compiled.rig.root;
    expect(swim?.positions[root * 3 + 1]).toBeLessThan(0);
  });
});
