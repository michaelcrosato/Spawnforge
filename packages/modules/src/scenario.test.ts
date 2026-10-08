import {
  checkScenario,
  compileCreature,
  createRegistry,
  FORMAT,
  mainHead,
  parseScenario,
  resolveBlueprint,
  ScenarioRun,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
const creature = (extendsId: string) =>
  compileCreature(resolveBlueprint({ format: FORMAT, extends: extendsId }, registry), registry, {
    quality: 'low',
  });
const parse = (input: unknown) => {
  const { scenario, issues } = parseScenario(input);
  if (!scenario) throw new Error(issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return scenario;
};

describe('scenarios', () => {
  it('reports mistakes with a path, the valid values and a fix', () => {
    const { scenario, issues } = parseScenario({
      duration: 4,
      calls: [
        { at: 1, do: 'jump' },
        { at: 1, do: 'act', action: 'bite', target: 'prey', speed: 2 },
        { at: 9, do: 'stop' },
      ],
    });
    expect(scenario).toBeUndefined();
    expect(issues.map((i) => [i.path, i.code])).toEqual([
      ['calls[0].do', 'invalid_value'],
      ['calls[1].speed', 'unknown_key'],
    ]);
    // Names and timing are checked once the shape is right.
    const named = parseScenario({
      duration: 4,
      calls: [
        { at: 1, do: 'act', action: 'bite', target: 'prey' },
        { at: 9, do: 'stop' },
      ],
    });
    expect(named.scenario).toBeUndefined();
    expect(named.issues.map((i) => [i.path, i.code, i.fix])).toEqual([
      [
        'calls[0].target',
        'unknown_target',
        'add "targets": { "prey": [x, y, z] }, or give the point itself',
      ],
      ['calls[1].at', 'after_end', 'raise "duration" above 9, or call it earlier'],
    ]);
  });

  it('checks actions and gaits against the creature', () => {
    const scenario = parse({
      calls: [
        { at: 0, do: 'act', action: 'pinch' },
        { at: 0, do: 'gait', gait: 'tripod' },
      ],
    });
    const motion = creature('quadruped').motion;
    const issues = checkScenario(scenario, motion, registry);
    expect(issues.map((i) => [i.path, i.code, i.expected])).toEqual([
      ['calls[0].action', 'unknown_action', '"bite", "jump", "lash", "look", "pounce", "roar"'],
      ['calls[1].gait', 'unknown_gait', '"walk", "trot", "gallop"'],
    ]);
  });

  it('drives a bite at a target', () => {
    const compiled = creature('quadruped');
    // A point in front of the resting head, a little low.
    const rest = compiled.bones.positions;
    const h = mainHead(compiled.rig).head;
    const prey = [
      rest[h * 3] as number,
      (rest[h * 3 + 1] as number) - 0.1,
      (rest[h * 3 + 2] as number) + 0.6,
    ];
    const scenario = parse({
      duration: 2.5,
      targets: { prey },
      calls: [{ at: 0.5, do: 'act', action: 'bite', target: 'prey' }],
    });
    const result = new ScenarioRun(compiled, registry, scenario).run();
    expect(result.failed).toEqual([]);
    expect(result.events.map((e) => e.type)).toEqual([
      'action-start',
      'bite-contact',
      'action-end',
    ]);
    const contact = result.events.find((e) => e.type === 'bite-contact');
    expect(contact?.time).toBeGreaterThan(0.5);
    // The lunge brings the snout closer than standing still does (as in motion.test.ts).
    const still = new ScenarioRun(compiled, registry, parse({ duration: 2.5, targets: { prey } }));
    const resting = still.run().targets.prey?.closest as number;
    expect(result.targets.prey?.closest).toBeLessThan(resting - 0.1);
  });

  it('walks a course over uneven ground, point by point', () => {
    const compiled = creature('quadruped');
    const scenario = parse({
      ground: 'course',
      duration: 14,
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
    });
    const run = new ScenarioRun(compiled, registry, scenario);
    const result = run.run();
    expect(result.courses).toEqual([{ call: 0, reached: 3, of: 3 }]);
    expect(result.distance).toBeGreaterThan(5);
    expect(Math.hypot(result.end.x, result.end.z - 5)).toBeLessThan(0.4);
    expect(result.events.filter((e) => e.type === 'arrive').length).toBe(3);
    expect(result.footsteps).toBeGreaterThan(10);
    expect(result.footSlide).toBeLessThan(0.05);
    // Same creature and scenario, same result.
    expect(new ScenarioRun(compiled, registry, scenario).run()).toEqual(result);
  });

  it('lets later calls take over: a new destination ends a course', () => {
    const compiled = creature('quadruped');
    const scenario = parse({
      duration: 6,
      calls: [
        {
          at: 0,
          do: 'follow',
          path: [
            [0, 4],
            [0, 8],
          ],
        },
        { at: 1, do: 'moveTo', to: [1, 1] },
      ],
    });
    const result = new ScenarioRun(compiled, registry, scenario).run();
    expect(result.courses).toEqual([{ call: 0, reached: 0, of: 2 }]);
    expect(Math.hypot(result.end.x - 1, result.end.z - 1)).toBeLessThan(0.4);
  });

  it('measures heights and turning, says where it arrived, and says when a gait is kept', () => {
    const compiled = creature('quadruped');
    const fastest = compiled.motion.gaits.filter((g) => (g.medium ?? 'land') === 'land').at(-1);
    const scenario = parse({
      duration: 9,
      calls: [
        { at: 0, do: 'moveTo', to: [0, 2] },
        { at: 3, do: 'moveTo', to: [2, 2] },
        { at: 7, do: 'gait', gait: fastest?.id },
      ],
    });
    const result = new ScenarioRun(compiled, registry, scenario).run();
    // A quarter turn to the right, and back to face it at the end: about 90° in all.
    expect(result.turned).toBeGreaterThan(80);
    expect(result.turned).toBeLessThan(140);
    const arrivals = result.events.filter((e) => e.type === 'arrive').map((e) => e.position);
    expect(arrivals).toHaveLength(2);
    expect(Math.hypot((arrivals[0]?.[0] ?? 9) - 0, (arrivals[0]?.[2] ?? 9) - 2)).toBeLessThan(0.5);
    expect(Math.hypot((arrivals[1]?.[0] ?? 9) - 2, (arrivals[1]?.[2] ?? 9) - 2)).toBeLessThan(0.5);
    expect(result.events.at(-1)).toMatchObject({ type: 'gait', gait: fastest?.id });
    expect(result.events.at(-1)?.time).toBeCloseTo(7, 1);
    // Standing on flat ground, its middle stays at about its rest height.
    expect(result.body.lowest).toBeGreaterThan(0);
    expect(result.body.highest - result.body.lowest).toBeLessThan(0.2 * compiled.scale);
    expect(result.body.aboveGround).toBeCloseTo(result.body.highest, 1);
  });

  it('starts a swimmer at the depth asked for', () => {
    const compiled = creature('fish');
    const depth = (start: Record<string, number>) =>
      new ScenarioRun(compiled, registry, parse({ water: 'sea', duration: 1, start })).run().body;
    const deep = depth({ y: -2 });
    expect(deep.highest).toBeLessThan(-1.5);
    expect(deep.lowest).toBeGreaterThan(-2.5);
    // Without it, a body that only swims starts halfway down to the bed.
    expect(depth({}).highest).toBeLessThan(deep.lowest);
  });

  it('records a call the creature refuses instead of throwing', () => {
    const compiled = creature('quadruped');
    const scenario = parse({ duration: 1, calls: [{ at: 0, do: 'act', action: 'pinch' }] });
    const result = new ScenarioRun(compiled, registry, scenario).run();
    expect(result.failed).toEqual([
      { call: 0, reason: expect.stringContaining('"pinch" is not one of this creature') },
    ]);
  });
});
