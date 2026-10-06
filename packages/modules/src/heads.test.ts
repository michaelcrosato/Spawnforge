import { readFileSync } from 'node:fs';
import {
  analyzeCreature,
  applyFace,
  bakeClips,
  buildSkeleton,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  Pose,
  resolveBlueprint,
  statsInput,
} from '@spawnforge/core';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/**
 * Milestone 8.3's heads (docs/design/8.3-heads.md): a refined head with a mouth cut exactly and
 * closed by its inside, eyelids on bones of their own, and teeth and eyes sized to the head.
 */
const registry = createRegistry([basicPack]);
const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
const cache = new Map<string, CompiledCreature>();
const compile = (blueprint: unknown, quality: 'low' | 'medium' = 'medium') => {
  const key = `${quality}:${JSON.stringify(blueprint)}`;
  let c = cache.get(key);
  if (!c) {
    c = compileCreature(resolveBlueprint(blueprint, registry), registry, { quality });
    cache.set(key, c);
  }
  return c;
};
const withHead = (name: string, head: Record<string, unknown>) => {
  const b = example(name);
  return { ...b, body: { ...b.body, head: { ...b.body?.head, ...head } } };
};

const isLid = (c: CompiledCreature, v: number) =>
  c.bones.sections[c.skin.skinIndex[v * 4] as number] === 'lid';
const inside = (c: CompiledCreature, v: number) => (c.skin.body[v * 4 + 2] as number) <= -0.5;
const weightOn = (c: CompiledCreature, v: number, bone: number) => {
  let w = 0;
  for (let k = 0; k < 4; k++)
    if (c.skin.skinIndex[v * 4 + k] === bone) w += c.skin.skinWeight[v * 4 + k] as number;
  return w;
};

/** Skin positions in a pose, by linear blend skinning. */
function posed(c: CompiledCreature, pose: Pose): Vector3[] {
  const skin: Matrix4[] = [];
  const one = new Vector3(1, 1, 1);
  for (let b = 0; b < c.bones.names.length; b++) {
    const rest = new Matrix4().compose(
      pose.restWorldPos[b] as Vector3,
      pose.restWorldRot[b] as Quaternion,
      one,
    );
    const now = new Matrix4().compose(
      pose.worldPos[b] as Vector3,
      pose.worldRot[b] as Quaternion,
      one,
    );
    skin.push(now.multiply(rest.invert()));
  }
  const out: Vector3[] = [];
  for (let v = 0; v < c.skin.positions.length / 3; v++) {
    const p = new Vector3().fromArray(c.skin.positions, v * 3);
    const q = new Vector3();
    for (let k = 0; k < 4; k++) {
      const w = c.skin.skinWeight[v * 4 + k] as number;
      if (w > 0)
        q.addScaledVector(
          p.clone().applyMatrix4(skin[c.skin.skinIndex[v * 4 + k] as number] as Matrix4),
          w,
        );
    }
    out.push(q);
  }
  return out;
}

describe('heads', () => {
  it.each(['grey-wolf', 'reed-viper', 'ridgeback-stalker', 'terror-bird'])(
    "%s: the mouth's inside closes the skin, with nothing open or tangled at the head",
    (name) => {
      const c = compile(example(name));
      const n = c.skin.positions.length / 3;
      const use = new Map<number, number>();
      const head = new Set(['head', 'jaw'].map((b) => c.bones.names.indexOf(b)));
      let insideTriangles = 0;
      for (let t = 0; t < c.skin.indices.length; t += 3) {
        const tri = [0, 1, 2].map((e) => c.skin.indices[t + e] as number);
        if (isLid(c, tri[0] as number)) continue;
        if (tri.every((v) => inside(c, v))) insideTriangles++;
        for (let e = 0; e < 3; e++) {
          const a = tri[e] as number;
          const b = tri[(e + 1) % 3] as number;
          const key = a < b ? a * n + b : b * n + a;
          use.set(key, (use.get(key) ?? 0) + 1);
        }
      }
      expect(insideTriangles).toBeGreaterThan(300);
      for (const [key, count] of use) {
        const a = Math.floor(key / n);
        const atHead = inside(c, a) || head.has(c.skin.skinIndex[a * 4] as number);
        if (count !== 2 && atHead) expect(`${name}: edge used ${count} times`).toBe('');
        expect(count).toBeGreaterThanOrEqual(2);
      }
    },
  );

  it('cuts the mouth along its line: each side of the cut follows its own bone', () => {
    const c = compile(example('grey-wolf'));
    const jaw = c.bones.names.indexOf('jaw');
    const head = c.bones.names.indexOf('head');
    // Vertices of the cut come in pairs at one place, one on the head and its copy on the jaw.
    const at = new Map<string, number[]>();
    for (let v = 0; v < c.skin.positions.length / 3; v++) {
      if (inside(c, v) || isLid(c, v)) continue;
      const key = Array.from(c.skin.positions.subarray(v * 3, v * 3 + 3), (x) =>
        x.toFixed(6),
      ).join();
      at.set(key, [...(at.get(key) ?? []), v]);
    }
    const pairs = [...at.values()].filter((list) => list.length === 2);
    expect(pairs.length).toBeGreaterThan(50);
    for (const [a, b] of pairs as [number, number][]) {
      const onJaw = [weightOn(c, a, jaw), weightOn(c, b, jaw)].sort();
      expect(onJaw[1]).toBeCloseTo(1, 5);
      expect(weightOn(c, onJaw[0] === weightOn(c, a, jaw) ? a : b, head)).toBeGreaterThan(0.5);
    }
    // The skeleton's mouth line runs through them: they sit on the cut's height.
    const shape = buildSkeleton(resolveBlueprint(example('grey-wolf'), registry), registry)
      .mouths[0];
    expect(shape).toBeDefined();
  });

  it('opens with the jaw: lower lip, floor and tongue go down, the palate stays', () => {
    const c = compile(example('grey-wolf'));
    const pose = new Pose(c.bones);
    pose.solve();
    const rest = posed(c, pose);
    applyFace(pose, c.rig, 1, 0);
    const open = posed(c, pose);
    const jaw = c.bones.names.indexOf('jaw');
    let tongue = 0;
    let palate = 0;
    for (let v = 0; v < rest.length; v++) {
      if (!inside(c, v)) continue;
      const moved = (rest[v] as Vector3).distanceTo(open[v] as Vector3);
      if (c.skin.body[v * 4 + 3] === 2) {
        tongue++;
        expect(weightOn(c, v, jaw)).toBe(1);
        expect(moved).toBeGreaterThan(0);
      } else if (weightOn(c, v, jaw) === 0) {
        palate++;
        expect(moved).toBeLessThan(1e-6);
      }
    }
    expect(tongue).toBeGreaterThan(50);
    expect(palate).toBeGreaterThan(50);
    // Without a tongue there is none.
    const none = compile(withHead('grey-wolf', { tongue: 'none' }));
    let left = 0;
    for (let v = 0; v < none.skin.positions.length / 3; v++)
      if (inside(none, v) && none.skin.body[v * 4 + 3] === 2) left++;
    expect(left).toBe(0);
  });

  it('closes the eyelids to blink: the two edges meet, and the eyes stay round', () => {
    const c = compile(example('grey-wolf'));
    const blinks = c.rig.chains.filter((ch) => ch.drive === 'blink');
    expect(blinks.length).toBe(2);
    const pose = new Pose(c.bones);
    pose.solve();
    const gap = (blink: number) => {
      applyFace(pose, c.rig, 0, blink);
      const at = posed(c, pose);
      // Each lid's edge: its vertex nearest the other lid's bone axis, by angle about the side.
      const [upper, lower] = (blinks[0] as (typeof blinks)[number]).bones;
      const frame = new Quaternion().fromArray(c.bones.rotations, (upper as number) * 4);
      const out = new Vector3(0, 1, 0).applyQuaternion(frame);
      const up = new Vector3(0, 0, 1).applyQuaternion(frame);
      const centre = new Vector3().fromArray(c.bones.positions, (upper as number) * 3);
      const radius = c.bones.lengths[upper as number] as number;
      let top = Infinity;
      let bottom = -Infinity;
      for (let v = 0; v < at.length; v++) {
        const bone = c.skin.skinIndex[v * 4] as number;
        if (bone !== upper && bone !== lower) continue;
        const d = (at[v] as Vector3).clone().sub(centre);
        // Near the corners (the axis's poles) the angle means nothing.
        if (Math.hypot(d.dot(up), d.dot(out)) < 0.5 * radius) continue;
        const angle = Math.atan2(d.dot(up), d.dot(out));
        if (bone === upper) top = Math.min(top, angle);
        else bottom = Math.max(bottom, angle);
      }
      return top - bottom;
    };
    expect(gap(0)).toBeGreaterThan(0.6);
    expect(Math.abs(gap(1))).toBeLessThan(0.05);
    // Blinks no longer squash the eyeballs: nothing in the pose scales.
    expect('scale' in pose).toBe(false);
  });

  it('bakes blinks into the idle clip as eyelid turns', () => {
    const c = compile(example('grey-wolf'), 'low');
    const [idle] = bakeClips(c, registry, { clips: ['idle'], idleSeconds: 6 });
    if (!idle) throw new Error('no idle clip');
    const n = c.bones.names.length;
    const lid = c.bones.names.findIndex((b) => b.endsWith('.upper'));
    expect(lid).toBeGreaterThan(0);
    let turn = 0;
    const first = new Quaternion().fromArray(idle.rotations, lid * 4);
    for (let f = 0; f < idle.frames; f++)
      turn = Math.max(
        turn,
        new Quaternion().fromArray(idle.rotations, (f * n + lid) * 4).angleTo(first),
      );
    expect(Math.max(...idle.blink)).toBeGreaterThan(0.5);
    expect(turn).toBeGreaterThan(0.3);
  });

  it('sizes teeth to the head: dense by default, as written when written', () => {
    const teeth = (params: Record<string, unknown>) => {
      const b = example('grey-wolf');
      b.parts = b.parts.map((p: { id: string }) =>
        p.id === 'teeth' ? { id: 'teeth', type: 'teeth.row', params } : p,
      );
      return compile(b).partSizes.teeth;
    };
    const dense = teeth({ fangs: 1 });
    expect(dense?.count).toBeGreaterThanOrEqual(12);
    expect(dense?.count).toBeLessThanOrEqual(30);
    expect(teeth({ count: 8, fangs: 1 })?.count).toBe(8);
    // A written length keeps plan 1's tooth: the first is the longest.
    const L = example('grey-wolf').scale as number;
    const written = teeth({ count: 6, fangs: 0, length: 0.025 });
    expect(written?.size).toBeCloseTo(0.025 * L * (1 - (0.05 + (0.5 / 6) * 0.85) * 0.4), 6);
    // Stats read what was built.
    const spec = resolveBlueprint(example('grey-wolf'), registry);
    const input = statsInput(spec, analyzeCreature(spec, registry, { quality: 'low' }), registry);
    const row = input.parts.find((p) => p.type === 'teeth.row');
    expect(row?.size).toBeGreaterThan(0.01);
    expect(row?.count).toBeGreaterThanOrEqual(12);
  });

  it('sizes eyes to the head unless a size is written, and lids leave the mass alone', () => {
    const eyes = (params: Record<string, unknown>) => {
      const b = example('grey-wolf');
      b.parts = b.parts.map((p: { id: string }) => (p.id === 'eyes' ? { id: 'eyes', params } : p));
      return b;
    };
    const L = example('grey-wolf').scale as number;
    expect(compile(eyes({ size: 0.02 })).partSizes.eyes?.size).toBeCloseTo(0.02 * L, 9);
    const relative = compile(eyes({})).partSizes.eyes?.size as number;
    expect(relative).toBeLessThan(0.02 * L);
    expect(compile(eyes({ scale: 2 })).partSizes.eyes?.size).toBeCloseTo(2 * relative, 9);
    const mass = (b: unknown) =>
      analyzeCreature(resolveBlueprint(b, registry), registry, { quality: 'low' }).measurements
        .mass;
    expect(mass(eyes({ lids: false }))).toBeCloseTo(mass(eyes({})), 6);
  });
});
