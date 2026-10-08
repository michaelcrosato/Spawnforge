import { readdirSync, readFileSync } from 'node:fs';
import {
  bakeClips,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  type Ground,
  MotionController,
  type MotionEvent,
  openSea,
  type Pose,
  parseScenario,
  resolveBlueprint,
  ScenarioRun,
  testCourse,
} from '@spawnforge/core';
import { type Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
const dir = new URL('../../../examples/', import.meta.url);
const examples = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .sort();
const example = (name: string) => JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'));
const compiledCache = new Map<string, CompiledCreature>();
const compiled = (name: string) => {
  let c = compiledCache.get(name);
  if (!c) {
    c = compileCreature(resolveBlueprint(example(name), registry), registry, { quality: 'low' });
    compiledCache.set(name, c);
  }
  return c;
};
const FLAT: Ground = () => ({ height: 0 });

/**
 * How deep the skinned meshes go into the ground (m; negative: how far above it the lowest point
 * is): every third vertex of the skin, parts, eyes and membranes, skinned by the pose.
 */
function depthIn(c: CompiledCreature, pose: Pose, ground: Ground): number {
  const inverse = c.bones.names.map((_, b) =>
    (pose.bindWorldRot[b] as Quaternion).clone().invert(),
  );
  const v = new Vector3();
  const sum = new Vector3();
  let deepest = -Infinity;
  for (const m of [c.skin, c.parts, c.eyes, c.membranes]) {
    const n = m.positions.length / 3;
    for (let i = 0; i < n; i += 3) {
      sum.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = m.skinWeight[i * 4 + k] as number;
        if (w <= 0) continue;
        const b = m.skinIndex[i * 4 + k] as number;
        v.set(
          m.positions[i * 3] as number,
          m.positions[i * 3 + 1] as number,
          m.positions[i * 3 + 2] as number,
        )
          .sub(pose.bindWorldPos[b] as Vector3)
          .applyQuaternion(inverse[b] as Quaternion)
          .applyQuaternion(pose.worldRot[b] as Quaternion)
          .add(pose.worldPos[b] as Vector3);
        sum.addScaledVector(v, w);
      }
      deepest = Math.max(deepest, ground(sum.x, sum.z).height - sum.y);
    }
  }
  return deepest;
}

function run(
  controller: MotionController,
  ground: Ground,
  seconds: number,
  each?: (events: MotionEvent[]) => void,
  dt = 1 / 60,
): MotionEvent[] {
  const all: MotionEvent[] = [];
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    const events = controller.update(dt, { ground });
    all.push(...events);
    each?.(events);
  }
  return all;
}

/** Pushes toward the creature's left (side 1) or right (side -1). */
const sideways = (c: MotionController, side: number) => ({
  x: side * Math.cos(c.heading),
  z: -side * Math.sin(c.heading),
});

describe('death (10.5)', () => {
  it.each(examples)(
    '%s dies on flat and rough ground from either side, onto the ground and not into it',
    (name) => {
      const c = compiled(name);
      const rough = testCourse(3, 0.25 * c.rig.hipHeight, 0);
      for (const ground of [FLAT, rough])
        for (const side of [1, -1]) {
          const controller = new MotionController(c, { registry });
          controller.place(1, 2, 0.3, ground);
          run(controller, ground, 0.5);
          const events = controller.update(0, { ground });
          controller.die({ direction: sideways(controller, side) });
          let deepest = -Infinity;
          let frame = 0;
          events.push(
            ...run(controller, ground, 5, () => {
              if (frame++ % 6 === 0)
                deepest = Math.max(deepest, depthIn(c, controller.pose, ground));
            }),
          );
          expect(events.map((e) => e.type)).toContain('death');
          expect(controller.dying, `${name} comes to rest`).toBe(false);
          expect(deepest, `${name} into the ground`).toBeLessThan(0.03 * c.scale);
          // It lies on the ground, not above it.
          expect(depthIn(c, controller.pose, ground), `${name} on the ground`).toBeGreaterThan(
            -0.03 * c.scale,
          );
        }
    },
    30_000,
  );

  it('flinches with a blow and springs back; a weak blow sways, a strong one staggers', () => {
    const c = compiled('grey-wolf');
    const head = c.rig.heads[c.rig.main]?.head as number;
    const at = (controller: MotionController) =>
      (controller.pose.worldPos[head] as Vector3).clone();
    const controller = new MotionController(c, { registry });
    run(controller, FLAT, 1);
    const before = at(controller);
    // Pushed toward its left (+X at heading 0): the head swings that way, then comes back.
    controller.hit({ direction: { x: 1, z: 0 }, strength: 0.4 });
    let most = 0;
    const events = run(controller, FLAT, 0.5, () => {
      most = Math.max(most, at(controller).x - before.x);
    });
    expect(events.map((e) => e.type)).toContain('hit');
    expect(events.map((e) => e.type)).not.toContain('stagger');
    expect(most).toBeGreaterThan(0.02 * c.scale);
    run(controller, FLAT, 2.5);
    expect(at(controller).distanceTo(before)).toBeLessThan(0.02 * c.scale);
    // A heavy blow knocks it off balance: it slides and steps to catch itself.
    const strong = new MotionController(c, { registry });
    run(strong, FLAT, 1);
    strong.hit({ direction: { x: 1, z: 0 }, strength: 1, bone: 'head' });
    const after = run(strong, FLAT, 3);
    expect(after.map((e) => e.type)).toContain('stagger');
    expect(after.filter((e) => e.type === 'footstep').length).toBeGreaterThan(1);
    expect(strong.position.x).toBeGreaterThan(0.05 * c.scale);
    expect(strong.feet().every((f) => f.planted)).toBe(true);
    // A blow on a bone it does not have is an error that names where to look.
    expect(() => strong.hit({ direction: { x: 1, z: 0 }, bone: 'wing' })).toThrow(/hit capsules/);
  });

  it('falls out of the air, and sinks to the bed in water', () => {
    const bat = compiled('cave-bat');
    const flyer = new MotionController(bat, { registry });
    flyer.place(0, 0, 0, FLAT, undefined, { flying: true, y: 6 });
    run(flyer, FLAT, 1);
    flyer.die();
    expect(flyer.flying).toBe(false);
    let deepest = -Infinity;
    run(flyer, FLAT, 6, () => {
      deepest = Math.max(deepest, depthIn(bat, flyer.pose, FLAT));
    });
    expect(flyer.dying).toBe(false);
    expect(deepest).toBeLessThan(0.03 * bat.scale);
    expect(flyer.position.y).toBeCloseTo(0, 5);
    const shark = compiled('reef-shark');
    const sea = openSea(shark.scale);
    const swimmer = new MotionController(shark, { registry });
    swimmer.place(0, 0, 0, sea.ground, sea.water);
    swimmer.update(1 / 60, sea);
    swimmer.die();
    for (let i = 0; i < 60 * 8; i++) swimmer.update(1 / 60, sea);
    expect(swimmer.dying).toBe(false);
    expect(depthIn(shark, swimmer.pose, sea.ground)).toBeGreaterThan(-0.05 * shark.scale);
  }, 30_000);

  it('does nothing more once dead, until placed again', () => {
    const c = compiled('tusk-boar');
    const controller = new MotionController(c, { registry });
    run(controller, FLAT, 0.5);
    controller.die({ direction: { x: -1, z: 0 } });
    run(controller, FLAT, 4);
    expect(controller.dead).toBe(true);
    expect(controller.dying).toBe(false);
    const pose = controller.pose.worldPos.map((p) => p.clone());
    controller.moveTo({ x: 10, z: 10 });
    controller.hit({ direction: { x: 1, z: 0 }, strength: 1 });
    expect(() => controller.act('bite')).not.toThrow();
    const events = run(controller, FLAT, 1);
    expect(events).toEqual([]);
    controller.pose.worldPos.forEach((p, i) => {
      expect(p.distanceTo(pose[i] as Vector3)).toBe(0);
    });
    // Placed again, it stands and walks.
    controller.place(0, 0, 0);
    expect(controller.dead).toBe(false);
    controller.moveTo({ x: 0, z: 3 });
    expect(run(controller, FLAT, 2).some((e) => e.type === 'footstep')).toBe(true);
  });

  it('dies the same at any frame rate, and the same twice', () => {
    const c = compiled('ash-dragon');
    const end = (dt: number) => {
      const controller = new MotionController(c, { registry });
      run(controller, FLAT, 0.5, undefined, dt);
      controller.die({ direction: { x: 1, z: 0 } });
      run(controller, FLAT, 4, undefined, dt);
      return controller.pose.worldPos.map((p) => p.clone());
    };
    const a = end(1 / 60);
    const b = end(1 / 60);
    const c30 = end(1 / 30);
    a.forEach((p, i) => {
      expect(p.distanceTo(b[i] as Vector3)).toBe(0);
      expect(p.distanceTo(c30[i] as Vector3)).toBeLessThan(0.02 * c.scale);
    });
  });

  it('bakes a death clip that ends lying down', () => {
    const c = compiled('grey-wolf');
    const [death] = bakeClips(c, registry, { clips: ['death'], fps: 30 });
    expect(death?.loop).toBe(false);
    expect(death?.duration).toBeGreaterThan(1);
    expect(death?.duration).toBeLessThan(6);
    // The body's first bone sits lower at the end than standing.
    const n = c.bones.names.length;
    const spine = c.rig.spine[0] as number;
    const last = (death?.frames ?? 1) - 1;
    expect(death?.positions[(last * n + spine) * 3 + 1]).toBeLessThan(
      (death?.positions[spine * 3 + 1] ?? 0) - 0.1 * c.scale,
    );
    expect(death?.events.map((e) => e.type)).toContain('death');
  });

  it('runs hits and deaths in scenarios', () => {
    const c = compiled('bog-troll');
    const { scenario } = parseScenario({
      duration: 5,
      calls: [
        { at: 0.5, do: 'hit', from: 'left', strength: 0.4 },
        { at: 1.5, do: 'hit', from: 90, bone: 'head', strength: 0.3 },
        { at: 2.5, do: 'die', from: 'front' },
      ],
    });
    const result = new ScenarioRun(c, registry, scenario as never).run();
    const types = result.events.map((e) => e.type);
    expect(types.filter((t) => t === 'hit')).toHaveLength(2);
    expect(types).toContain('death');
    expect(result.failed).toEqual([]);
    // Staggering and dying feet are not sliding ones (gate 10).
    expect(result.footSlide).toBeLessThan(0.02 * c.scale);
    const bad = parseScenario({ calls: [{ at: 0, do: 'hit', from: 'above' }] });
    expect(bad.scenario).toBeUndefined();
  });
});
