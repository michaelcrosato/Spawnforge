import { readFileSync } from 'node:fs';
import {
  bakeClips,
  compileCreature,
  createRegistry,
  type Ground,
  MotionController,
  type MotionEvent,
  mainHead,
  resolveBlueprint,
  testCourse,
} from '@spawnforge/core';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));

function creature(name: string, actions: string[]) {
  const blueprint = example(name);
  const spec = resolveBlueprint(
    { ...blueprint, motion: { ...blueprint.motion, actions } },
    registry,
  );
  const compiled = compileCreature(spec, registry, { quality: 'low' });
  return { compiled, controller: new MotionController(compiled, { registry }) };
}

/** Runs an action to its end, watching the body's lowest point against the ground. */
function leap(
  controller: MotionController,
  compiled: ReturnType<typeof compileCreature>,
  ground: Ground,
  id: string,
  target: { x: number; y: number; z: number } | null,
) {
  for (let i = 0; i < 120; i++) controller.update(1 / 120, { ground });
  const start = controller.position.clone();
  controller.act(id, { target });
  const events: MotionEvent[] = [];
  let sink = 0;
  let apex = 0;
  const bodyBones = compiled.bones.sections
    .map((s, i) => [s, i] as const)
    .filter(([s]) => s === 'torso')
    .map(([, i]) => i);
  for (let i = 0; i < 1200 && (controller.action !== null || i < 10); i++) {
    events.push(...controller.update(1 / 120, { ground }));
    for (const b of bodyBones) {
      const p = controller.pose.worldPos[b] as Vector3;
      const r = (compiled.bones.radii[b] ?? 0) * 0.6;
      sink = Math.max(sink, ground(p.x, p.z).height - (p.y - r));
    }
    apex = Math.max(
      apex,
      controller.position.y - ground(controller.position.x, controller.position.z).height,
    );
  }
  return { start, events, sink, apex };
}

describe('jump and pounce (10.2)', () => {
  const flat: Ground = () => ({ height: 0 });
  const rough = testCourse(3, 0.25, 0);

  it('jumps to a target within 5% of the aimed distance, on flat and rough ground', () => {
    for (const [name, ground] of [
      ['flat', flat],
      ['rough', rough],
    ] as const) {
      const { compiled, controller } = creature('grey-wolf', ['jump', 'idle']);
      const aim = 2.2;
      const target = { x: 0.4, y: 0, z: aim };
      const { start, events, sink } = leap(controller, compiled, ground, 'jump', target);
      const types = events.map((e) => e.type);
      expect(types, name).toContain('takeoff');
      expect(types, name).toContain('land');
      expect(types.indexOf('takeoff')).toBeLessThan(types.indexOf('land'));
      const landed = new Vector3(
        controller.position.x - target.x,
        0,
        controller.position.z - target.z,
      );
      const asked = Math.hypot(target.x - start.x, target.z - start.z);
      expect(landed.length(), name).toBeLessThan(0.05 * asked);
      // The body never goes into the ground, and every foot is down again at the end.
      expect(sink, name).toBeLessThan(0.03 * compiled.scale);
      expect(
        controller.feet().every((f) => f.planted),
        name,
      ).toBe(true);
    }
  });

  it('clears a height asked for, and leaps ahead with no target', () => {
    const { compiled, controller } = creature('grey-wolf', ['idle']);
    const high = creature('grey-wolf', ['jump']);
    const plain = leap(high.controller, high.compiled, flat, 'jump', { x: 0, y: 0, z: 2 });
    expect(plain.apex).toBeGreaterThan(0.1);
    const over = creature('grey-wolf', ['jump']);
    const blueprint = example('grey-wolf');
    const spec = resolveBlueprint(
      { ...blueprint, motion: { actions: [{ type: 'jump', height: 1.2 }] } },
      registry,
    );
    const tall = compileCreature(spec, registry, { quality: 'low' });
    const hurdle = leap(new MotionController(tall, { registry }), tall, flat, 'jump', {
      x: 0,
      y: 0,
      z: 2,
    });
    expect(hurdle.apex).toBeGreaterThan(1.15);
    const ahead = leap(over.controller, over.compiled, flat, 'jump', null);
    expect(over.controller.position.z - ahead.start.z).toBeGreaterThan(0.5);
    // A creature without `jump` cannot.
    expect(() => controller.act('jump')).toThrow(/jump/);
    expect(compiled.scale).toBeGreaterThan(0);
  });

  it('pounces: bites as it lands, its head at the target', () => {
    const { compiled, controller } = creature('sand-cheetah', ['pounce', 'idle']);
    for (let i = 0; i < 120; i++) controller.update(1 / 120);
    const head = controller.pose.worldPos[mainHead(compiled.rig).head] as Vector3;
    const prey = { x: 0, y: head.y * 0.8, z: 2.5 };
    controller.act('pounce', { target: prey });
    let bite: MotionEvent | undefined;
    let land: MotionEvent | undefined;
    for (let i = 0; i < 1200 && controller.action !== null; i++)
      for (const e of controller.update(1 / 120)) {
        if (e.type === 'bite-contact') bite = e;
        if (e.type === 'land') land = e;
      }
    expect(bite && land).toBeTruthy();
    expect(Math.abs((bite?.time ?? 0) - (land?.time ?? 1))).toBeLessThan(0.05);
    const [x, , z] = bite?.position ?? [0, 0, 0];
    expect(Math.hypot(x - prey.x, z - prey.z)).toBeLessThan(0.35 * compiled.scale);
  });

  it('bakes leaps with their root motion', () => {
    const { compiled } = creature('grey-wolf', ['jump', 'pounce', 'bite']);
    const clips = bakeClips(compiled, registry, { clips: ['jump', 'pounce', 'bite'], fps: 20 });
    const [jump, pounce, bite] = clips;
    expect(jump?.rootMotion).toBe(true);
    expect(pounce?.rootMotion).toBe(true);
    expect(bite?.rootMotion).toBeUndefined();
    // The root's track carries it forward, and up in the middle.
    const n = compiled.bones.names.length;
    const root = compiled.rig.root;
    const z = (f: number) => jump?.positions[(f * n + root) * 3 + 2] ?? 0;
    const y = (f: number) => jump?.positions[(f * n + root) * 3 + 1] ?? 0;
    const frames = jump?.frames ?? 0;
    expect(z(frames - 1) - z(0)).toBeGreaterThan(0.5);
    expect(Math.max(...Array.from({ length: frames }, (_, f) => y(f)))).toBeGreaterThan(0.05);
    expect(jump?.events.map((e) => e.type)).toEqual(expect.arrayContaining(['takeoff', 'land']));
  });
});
