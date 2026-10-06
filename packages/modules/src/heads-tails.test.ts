import {
  analyzeCreature,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  FORMAT,
  fingerprint,
  MotionController,
  resolveBlueprint,
  validateBlueprint,
} from '@spawnforge/core';
import { type Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/** Several heads and split tails (milestone 9.1, docs/design/9.1-heads-tails.md). */
const registry = createRegistry([basicPack]);
const compile = (blueprint: Record<string, unknown>, quality: 'low' | 'medium' = 'low') =>
  compileCreature(resolveBlueprint({ format: FORMAT, ...blueprint }, registry), registry, {
    quality,
  });
const boneOf = (c: CompiledCreature, name: string) => {
  const i = c.bones.names.indexOf(name);
  if (i < 0) throw new Error(`no bone ${name}`);
  return new Vector3().fromArray(c.bones.positions, i * 3);
};

describe('several heads', () => {
  const hydra = compile({
    extends: 'quadruped',
    body: { neck: { count: 3, length: 0.7 } },
    parts: [{ id: 'horns', type: 'horn.curved', attach: { on: 'head', at: 0.8, angle: 45 } }],
  });

  it('names every instance, its chains and paths, with the main head keeping plain names', () => {
    const { heads, main } = hydra.rig;
    expect(heads.map((h) => h.id)).toEqual(['head.L1', 'head', 'head.R1']);
    expect(heads[main]?.id).toBe('head');
    const names = hydra.bones.names;
    for (const id of ['head', 'head.L1', 'head.R1', 'jaw', 'jaw.L1', 'neck.0', 'neck.L1.0'])
      expect(names, id).toContain(id);
    expect(names[heads[main]?.head ?? -1]).toBe('head');
    // Each head has its own jaw, neck and two eyes.
    for (const h of heads) {
      expect(h.jaw).toBeGreaterThanOrEqual(0);
      expect(h.neck.length).toBeGreaterThan(0);
      expect(h.eyes).toHaveLength(2);
    }
  });

  it('fans the heads symmetrically across the chest, outer ones turned outward', () => {
    const left = boneOf(hydra, 'head.L1');
    const mid = boneOf(hydra, 'head');
    const right = boneOf(hydra, 'head.R1');
    // Left is +X; the middle head stays on the axis.
    expect(mid.x).toBeCloseTo(0, 6);
    expect(left.x).toBeGreaterThan(0.05 * hydra.scale);
    expect(right.x).toBeCloseTo(-left.x, 4);
    expect(left.z).toBeCloseTo(right.z, 4);
    expect(left.y).toBeCloseTo(mid.y, 4);
  });

  it('copies parts on the head onto every head, with instance ids and one random stream', () => {
    const resolved = validateBlueprint(
      {
        format: FORMAT,
        extends: 'quadruped',
        body: { neck: { count: 3 } },
        parts: [{ id: 'horns', type: 'horn.curved', attach: { on: 'head', at: 0.8, angle: 45 } }],
      },
      registry,
    ).creature;
    const horns = resolved?.parts.filter((p) => p.baseId === 'horns') ?? [];
    expect(horns.map((p) => p.id).sort()).toEqual(
      ['horns.L', 'horns.L1.L', 'horns.L1.R', 'horns.R', 'horns.R1.L', 'horns.R1.R'].sort(),
    );
    expect(horns.find((p) => p.id === 'horns.L1.R')?.on).toBe('head.L1');
    // A part written on one head stays there.
    const one = validateBlueprint(
      {
        format: FORMAT,
        extends: 'quadruped',
        body: { neck: { count: 3 } },
        parts: [{ id: 'crown', type: 'horn.curved', attach: { on: 'head.R1', angle: 0 } }],
      },
      registry,
    ).creature;
    expect(one?.parts.filter((p) => p.baseId === 'crown').map((p) => p.on)).toEqual(['head.R1']);
    // Every head's horns are built.
    expect(hydra.markers.filter((m) => m.id.startsWith('horns')).length).toBe(6);
  });

  it('gives every head its sockets', () => {
    const names = hydra.sockets.map((s) => s.name);
    for (const s of ['head', 'mouth', 'head.L1', 'mouth.L1', 'head.R1', 'mouth.R1'])
      expect(names).toContain(s);
  });

  it('bites with the head nearest the target, and says which', () => {
    const c = new MotionController(hydra, { registry });
    for (let i = 0; i < 60; i++) c.update(1 / 60);
    const left = boneOf(hydra, 'head.L1');
    c.act('bite', { target: { x: left.x + 0.3 * hydra.scale, y: left.y, z: left.z + 0.4 } });
    const events = [];
    for (let i = 0; i < 180; i++) events.push(...c.update(1 / 60));
    const contact = events.find((e) => e.type === 'bite-contact');
    expect(contact?.head).toBe('head.L1');
  });

  it('turns the heads to glance on their own', () => {
    const three = compile({
      extends: 'quadruped',
      body: { neck: { count: 3, length: 0.7 } },
      motion: { actions: ['idle'] },
    });
    const c = new MotionController(three, { registry });
    const turns: number[][] = [];
    for (let i = 0; i < 600; i++) {
      c.update(1 / 60);
      if (i % 30 === 0)
        turns.push(three.rig.heads.map((h) => (c.pose.worldRot[h.head] as Quaternion).y));
    }
    // The left head's turn differs from the middle one's at some point, beyond the fixed fan.
    const offsets = turns.map((t) => (t[0] ?? 0) - (t[1] ?? 0));
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThan(0.01);
  });

  it('warns head_intersection when the necks crowd, and not on a clear fan', () => {
    const analyze = (blueprint: Record<string, unknown>) =>
      analyzeCreature(resolveBlueprint({ format: FORMAT, ...blueprint }, registry), registry);
    const crowded = analyze({
      extends: 'quadruped',
      body: { neck: { count: 5, length: 0.6, spread: 4 } },
    });
    expect(crowded.warnings.map((w) => w.code)).toContain('head_intersection');
    const clear = analyze({ extends: 'quadruped', body: { neck: { count: 3, length: 0.7 } } });
    expect(clear.warnings.map((w) => w.code)).not.toContain('head_intersection');
  });

  it('meshes the same twice and stays within the skin budget at medium', () => {
    const blueprint = { extends: 'quadruped', body: { neck: { count: 5, length: 0.8 } } };
    const a = compile(blueprint, 'medium');
    expect(a.stats.triangles.skin).toBeLessThanOrEqual(30_000);
    expect(fingerprint(compile(blueprint, 'medium'))).toBe(fingerprint(a));
  });
});

/** How far a chain's bones have turned from rest, the most of any (radians). */
const swing = (c: MotionController, bones: readonly number[]) =>
  Math.max(
    0,
    ...bones.map((b) => (c.pose.rot[b] as Quaternion).angleTo(c.pose.restRot[b] as Quaternion)),
  );

describe('several and forked tails', () => {
  it('builds separate tails from the rear, each its own spring', () => {
    const fox = compile({ extends: 'quadruped', body: { tail: { count: 2 } } });
    expect(fox.rig.tails.map((t) => t.id)).toEqual(['tail', 'tail.R1']);
    expect(fox.rig.chains.filter((c) => c.drive === 'spring').map((c) => c.owner)).toEqual([
      'tail',
      'tail.R1',
    ]);
    const a = boneOf(fox, 'tail.0');
    const b = boneOf(fox, 'tail.R1.0');
    expect(a.x).toBeGreaterThan(0);
    expect(b.x).toBeCloseTo(-a.x, 4);
  });

  it('forks one trunk into branches, placing trunk parts once', () => {
    const blueprint = {
      format: FORMAT,
      extends: 'quadruped',
      body: { tail: { count: 3, forkAt: 0.5, length: 1 } },
      parts: [
        { id: 'base', type: 'horn.curved', attach: { on: 'tail', at: 0.2, angle: 0 } },
        { id: 'tip', type: 'horn.curved', attach: { on: 'tail', at: 0.95, angle: 0 } },
      ],
    };
    const parts = validateBlueprint(blueprint, registry).creature?.parts ?? [];
    expect(parts.filter((p) => p.baseId === 'base').map((p) => p.id)).toEqual(['base']);
    expect(parts.filter((p) => p.baseId === 'tip').map((p) => p.id)).toEqual([
      'tip',
      'tip.L1',
      'tip.R1',
    ]);
    const c = compile(blueprint);
    const [left, main, right] = c.rig.tails;
    expect(main?.id).toBe('tail');
    const fork = main?.branch ?? 0;
    expect(fork).toBeGreaterThan(0);
    // The trunk is shared; the branches differ.
    expect(left?.bones.slice(0, fork)).toEqual(main?.bones.slice(0, fork));
    expect(right?.bones.slice(0, fork)).toEqual(main?.bones.slice(0, fork));
    expect(left?.bones[fork]).not.toBe(main?.bones[fork]);
    // The main tail swings as one; the other branches hang from the trunk, after it.
    const springs = c.rig.chains.filter((x) => x.drive === 'spring');
    expect(springs[0]?.owner).toBe('tail');
    expect(springs[0]?.bones).toEqual(main?.bones);
    expect(springs[1]?.bones).toEqual(left?.bones.slice(fork));
  });

  it('swings every tail while the creature turns', () => {
    const fox = compile({ extends: 'quadruped', body: { tail: { count: 2 } } });
    const c = new MotionController(fox, { registry });
    c.drive(c.paceSpeed(), 1.2);
    const most = fox.rig.tails.map(() => 0);
    for (let i = 0; i < 240; i++) {
      c.update(1 / 60);
      fox.rig.tails.forEach((t, k) => {
        most[k] = Math.max(most[k] ?? 0, swing(c, t.bones));
      });
    }
    for (const [k, t] of fox.rig.tails.entries()) expect(most[k], t.id).toBeGreaterThan(0.02);
  });

  it('springs the extra tails of a legless body too', () => {
    const snake = compile({ extends: 'serpent', body: { tail: { count: 2 } } });
    const c = new MotionController(snake, { registry });
    c.drive(c.paceSpeed(), 0.8);
    const extra = snake.rig.tails.find((t) => t.id !== 'tail');
    let most = 0;
    for (let i = 0; i < 240; i++) {
      c.update(1 / 60);
      most = Math.max(most, swing(c, extra?.bones ?? []));
    }
    expect(most).toBeGreaterThan(0.02);
  });
});
