import { readFileSync } from 'node:fs';
import {
  analyzeCreature,
  bakeClips,
  type CompiledCreature,
  checkScenario,
  clipNames,
  compileCreature,
  computeStats,
  createRegistry,
  type Ground,
  MotionController,
  type MotionEvent,
  parseScenario,
  resolveBlueprint,
  ScenarioRun,
  slope,
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
const FLAT: Ground = () => ({ height: 0 });

function run(
  controller: MotionController,
  ground: Ground,
  seconds: number,
  each?: (events: MotionEvent[]) => void,
): MotionEvent[] {
  const all: MotionEvent[] = [];
  for (let i = 0; i < seconds * 120; i++) {
    const events = controller.update(1 / 120, { ground });
    all.push(...events);
    each?.(events);
  }
  return all;
}

/** The deepest the body, a tail or a foot goes into the ground in the current pose (m). */
function into(compiled: CompiledCreature, controller: MotionController, ground: Ground): number {
  const bones = compiled.bones;
  const pose = controller.pose;
  let worst = 0;
  bones.names.forEach((_, i) => {
    if (!['torso', 'neck', 'head', 'jaw', 'tail'].includes(bones.sections[i] as string)) return;
    const r = bones.radii[i] ?? 0;
    for (const p of [pose.worldPos[i], pose.tail(i)])
      if (p) worst = Math.max(worst, ground(p.x, p.z).height - (p.y - r));
  });
  for (const leg of compiled.rig.legs) {
    const ankle = pose.tail(leg.bones.at(-1) as number);
    worst = Math.max(worst, ground(ankle.x, ankle.z).height + leg.restFoot[1] - ankle.y);
  }
  return worst;
}

describe('flight (10.4)', () => {
  it('flies the course: takes off, holds its height round a circle, lands on a 15° slope', () => {
    for (const name of ['ash-dragon', 'cave-bat', 'storm-wyvern', 'luna-moth', 'griffin']) {
      const { spec, compiled } = build(example(name));
      const a = analyzeCreature(spec, registry);
      const flight = a.flight;
      expect(flight, name).toBeDefined();
      if (!flight) continue;
      expect(flight.altitude, name).toBeLessThan(0.1);
      expect(flight.touchdown, name).toBeDefined();
      expect(flight.landing.worst, name).toBeLessThanOrEqual(0.02 * compiled.rig.hipHeight);
      expect(flight.wings.worst, name).toBeLessThan(Math.max(0.01, 0.01 * compiled.scale));
      expect(
        a.warnings.map((w) => w.code),
        name,
      ).not.toContain('wing_intersection');
      expect(
        a.warnings.map((w) => w.code),
        name,
      ).not.toContain('cannot_fly');
      expect(
        a.warnings.map((w) => w.code),
        name,
      ).not.toContain('hard_landing');
      expect(a.speed.fly, name).toBeGreaterThan(a.speed.slow ?? 0);
      expect(a.description, name).toMatch(/flies at about \d+ m\/s/);
    }
  }, 120_000);

  it('lands uphill, downhill and across a slope without going into it', () => {
    // Coming in along +Z: up the slope, down it, and across it, the point 70 m ahead on it.
    for (const [toward, from] of [
      [0, 40],
      [180, -100],
      [90, -30],
    ] as const) {
      const { compiled, controller } = build(example('ash-dragon'));
      const ground = slope(15, toward, from);
      expect(ground(0, 70).height, `toward ${toward}`).toBeGreaterThan(1);
      controller.place(0, 0, 0, ground, undefined, { flying: true });
      controller.land({ x: 0, z: 70 });
      let worst = 0;
      let landed = -1;
      run(controller, ground, 30, (events) => {
        if (events.some((e) => e.type === 'land')) landed = controller.time;
        // Through the flare and the landing's absorb; standing, it is as any walker is.
        const absorbing = landed >= 0 && controller.time - landed < 0.4 * controller.timeScale;
        if (controller.flightStage === 'flare' || absorbing)
          worst = Math.max(worst, into(compiled, controller, ground));
      });
      expect(landed, `toward ${toward}`).toBeGreaterThan(0);
      expect(controller.flying).toBe(false);
      expect(controller.medium).toBe('land');
      expect(worst, `toward ${toward}`).toBeLessThanOrEqual(0.02 * compiled.rig.hipHeight);
      // Close to where it was asked to land.
      expect(Math.hypot(controller.position.x, controller.position.z - 70)).toBeLessThan(
        compiled.scale * 2,
      );
    }
  }, 60_000);

  it('warns when the wings are too small to carry it, and says the span it needs', () => {
    const heavy = example('griffin');
    const wing = heavy.limbs.find((l: { id: string }) => l.id === 'wing');
    wing.length = 1;
    wing.membrane.length = 0.8;
    const a = analyzeCreature(build(heavy).spec, registry);
    const warning = a.warnings.find((w) => w.code === 'cannot_fly');
    expect(warning?.path).toBe('limbs[id=wing]');
    expect(warning?.message).toMatch(/N\/m².*span of about \d/);
    expect(warning?.fix).toMatch(/times as long/);
    // Without wings nothing is said about flying.
    const wolf = analyzeCreature(build(example('grey-wolf')).spec, registry);
    expect(wolf.flight).toBeUndefined();
    expect(wolf.speed.fly).toBeUndefined();
  }, 60_000);

  it('takes off, flies and lands through the API, with its events', () => {
    const { controller } = build(example('cave-bat'));
    expect(controller.canFly).toBe(true);
    expect(controller.flying).toBe(false);
    controller.fly({ height: 3 });
    expect(controller.flying).toBe(true);
    expect(controller.flightStage).toBe('crouch');
    const events = run(controller, FLAT, 6);
    const types = events.map((e) => e.type);
    expect(types).toContain('takeoff');
    expect(events.find((e) => e.type === 'medium')?.medium).toBe('air');
    expect(events.some((e) => e.type === 'gait' && e.gait === 'fly')).toBe(true);
    expect(types.filter((t) => t === 'flap').length).toBeGreaterThan(6);
    expect(controller.flightStage).toBe('flight');
    expect(Math.abs(controller.position.y - 3)).toBeLessThan(0.3);
    expect(controller.wingbeat).toBeGreaterThan(1);
    // Biting in the air is fine; leaping is not.
    controller.act('bite', { target: { x: 0, y: 3, z: 2 } });
    run(controller, FLAT, 1);
    expect(controller.flying).toBe(true);
    // A height out of reach on foot flies there; landing puts it back on its feet.
    controller.moveTo({ x: 10, y: 5, z: 10 });
    run(controller, FLAT, 6);
    controller.land({ x: 20, z: 20 });
    const landing = run(controller, FLAT, 20);
    expect(landing.map((e) => e.type)).toContain('land');
    expect(landing.filter((e) => e.type === 'medium').at(-1)?.medium).toBe('land');
    expect(controller.flying).toBe(false);
    expect(controller.wingbeat).toBe(0);
    expect(controller.feet().every((f) => f.planted)).toBe(true);
    // A moveTo high above it takes off by itself.
    const b = build(example('cave-bat')).controller;
    b.moveTo({ x: 0, y: 6, z: 20 });
    run(b, FLAT, 1);
    expect(b.flying).toBe(true);
    // Creatures without wings cannot fly; leaping actions wait for the ground.
    expect(() => build(example('grey-wolf')).controller.fly()).toThrow(/no wings/);
    const moth = build(example('luna-moth')).controller;
    moth.place(0, 0, 0, FLAT, undefined, { flying: true });
    expect(() => moth.act('pounce')).toThrow(/flying/);
  }, 60_000);

  it('hovers when it can, and comes straight down to land', () => {
    const { controller } = build(example('luna-moth'));
    controller.fly();
    run(controller, FLAT, 4);
    // With nowhere to go a hoverer hovers where it took off.
    expect(controller.gait?.id).toBe('hover');
    expect(controller.speed).toBeLessThan(0.5);
    expect(Math.hypot(controller.position.x, controller.position.z)).toBeLessThan(1);
    controller.land({ x: 0, z: 3 });
    let descended = false;
    const events = run(controller, FLAT, 15, () => {
      if (controller.flightStage === 'descend') descended = true;
    });
    expect(descended).toBe(true);
    expect(events.map((e) => e.type)).toContain('land');
    expect(Math.hypot(controller.position.x, controller.position.z - 3)).toBeLessThan(0.3);
  }, 30_000);

  it('keeps flying without posing at a distance, and catches up in place', () => {
    const a = build(example('storm-wyvern')).controller;
    const b = build(example('storm-wyvern')).controller;
    for (const c of [a, b]) {
      c.place(0, 0, 0, FLAT, undefined, { flying: true });
      c.moveTo({ x: 60, z: 40 });
    }
    for (let i = 0; i < 240; i++) {
      a.update(1 / 120, { ground: FLAT });
      b.update(1 / 120, { ground: FLAT, pose: false });
    }
    // The flight is the same whether posed or not.
    expect(b.position.distanceTo(a.position)).toBeLessThan(1e-9);
    // Posed again, its legs are tucked under it where it is now, not where it was.
    b.update(0, { ground: FLAT });
    for (const foot of b.feet()) expect(foot.position.distanceTo(b.position)).toBeLessThan(3);
  });

  it('bakes air cycles over whole wingbeats, and takeoff and landing with root motion', () => {
    const { compiled } = build(example('ash-dragon'));
    const names = clipNames(compiled, registry);
    expect(names).toEqual(expect.arrayContaining(['fly', 'glide', 'takeoff', 'land']));
    const [fly, glide, takeoff, land] = bakeClips(compiled, registry, {
      clips: ['fly', 'glide', 'takeoff', 'land'],
      fps: 30,
    });
    expect(fly?.loop).toBe(true);
    expect(fly?.duration).toBeGreaterThanOrEqual(0.5);
    expect(fly?.speed).toBeGreaterThan(10);
    expect(fly?.air).toBeDefined();
    const flaps = fly?.events.filter((e) => e.type === 'flap').length ?? 0;
    expect(flaps).toBeGreaterThan(0);
    // Exact phases: the last frame is the first.
    const n = compiled.bones.names.length;
    const frames = fly?.frames ?? 0;
    for (let j = 0; j < n * 4; j++)
      expect(fly?.rotations[(frames - 1) * n * 4 + j]).toBeCloseTo(fly?.rotations[j] ?? 0, 5);
    // The root at the origin, in the air.
    const root = compiled.rig.root;
    expect(Math.abs(fly?.positions[root * 3 + 1] ?? 1)).toBeLessThan(1e-3);
    expect(glide?.events.filter((e) => e.type === 'flap')).toEqual([]);
    expect(takeoff?.rootMotion).toBe(true);
    expect(takeoff?.events.map((e) => e.type)).toContain('takeoff');
    const last = (takeoff?.frames ?? 1) - 1;
    expect(takeoff?.positions[(last * n + root) * 3 + 1]).toBeGreaterThan(0.5);
    expect(land?.rootMotion).toBe(true);
    expect(land?.events.map((e) => e.type)).toContain('land');
    expect(land?.positions[root * 3 + 1]).toBeGreaterThan(0.5);
    expect(land?.positions[((land?.frames ?? 1) - 1) * n * 3 + root * 3 + 1]).toBeCloseTo(0, 2);
  }, 60_000);

  it('runs flying scenarios on a slope', () => {
    const { compiled } = build(example('storm-wyvern'));
    const course = JSON.parse(
      readFileSync(
        new URL('../../../examples/scenarios/flight-course.json', import.meta.url),
        'utf8',
      ),
    );
    const { scenario } = parseScenario(course);
    const result = new ScenarioRun(compiled, registry, scenario as never).run();
    const types = result.events.map((e) => e.type);
    expect(types).toContain('takeoff');
    expect(types).toContain('land');
    expect(result.events.filter((e) => e.type === 'medium').map((e) => e.medium)).toEqual([
      'air',
      'land',
    ]);
    expect(result.failed).toEqual([]);
    // A creature without wings is told it cannot.
    const wolf = build(example('grey-wolf')).compiled;
    const refused = parseScenario({ calls: [{ at: 0, do: 'fly' }] }).scenario;
    const issues = refused ? checkScenario(refused, wolf.motion, registry) : [];
    expect(issues.map((i) => i.code)).toContain('cannot_fly');
  }, 60_000);

  it('gives rpg a flying speed', () => {
    const stats = (name: string) => {
      const { spec } = build(example(name));
      return computeStats(spec, analyzeCreature(spec, registry), registry, 'rpg');
    };
    expect(stats('cave-bat').fly).toBeGreaterThan(5);
    expect(stats('grey-wolf').fly).toBe(0);
  }, 60_000);

  it('leaves winged creatures that walk as they were', () => {
    const { controller } = build(example('ash-dragon'));
    controller.moveTo({ x: 0, z: 10 });
    const events = run(controller, FLAT, 6);
    const types = new Set(events.map((e) => e.type));
    for (const t of ['takeoff', 'flap', 'land', 'medium']) expect(types.has(t)).toBe(false);
    expect(controller.flying).toBe(false);
    expect(controller.wingSpread).toBe(0);
    expect(controller.wingbeat).toBe(0);
    // Air gaits are never baked on land, and its walking clips are as before.
    const { compiled } = build(example('ash-dragon'));
    const [walk] = bakeClips(compiled, registry, { clips: ['walk'] });
    expect(walk?.air).toBeUndefined();
  }, 30_000);
});
