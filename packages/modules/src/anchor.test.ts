import { readdirSync, readFileSync } from 'node:fs';
import {
  anchorAt,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  placeOnSkin,
  resolveBlueprint,
  SdfEvaluator,
} from '@spawnforge/core';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/**
 * `anchorAt` is the inverse of part placement (docs/design/12.1-placing.md): for every example,
 * every body section and limb, a point placed on the skin anchors back to where it was placed,
 * and the parts the examples place anchor back to their own attachments.
 */
const registry = createRegistry([basicPack]);
const dir = new URL('../../../examples/', import.meta.url);
const names = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const spec = (name: string) =>
  resolveBlueprint(JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8')), registry);
const compiled = new Map<string, CompiledCreature>();
const compile = (name: string) => {
  let c = compiled.get(name);
  if (!c) {
    c = compileCreature(spec(name), registry, { quality: 'low', field: true });
    compiled.set(name, c);
  }
  return c;
};

/** What the skin at `p` belongs to: its nearest vertex's strongest bone's owner. */
const ownerOf = (c: CompiledCreature, p: { x: number; y: number; z: number }) => {
  const { positions, skinIndex, skinWeight } = c.skin;
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let v = 0; v < positions.length / 3; v++) {
    const d = Math.hypot(
      (positions[v * 3] as number) - p.x,
      (positions[v * 3 + 1] as number) - p.y,
      (positions[v * 3 + 2] as number) - p.z,
    );
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  let k = 0;
  for (let j = 1; j < 4; j++)
    if ((skinWeight[best * 4 + j] as number) > (skinWeight[best * 4 + k] as number)) k = j;
  return c.bones.owners[skinIndex[best * 4 + k] as number];
};

/**
 * Surface parts whose marker is not their socket: built along the section (frills, hoods and
 * fins, marked at their middle) or on bones of their own (antennae, at their root bone).
 */
const OWN_MARKERS = new Set(['frill', 'hood', 'fin.dorsal', 'fin.tail', 'antenna']);

describe('anchorAt', () => {
  it.each(names)('round-trips on every section and limb of %s', (name) => {
    const c = compile(name);
    const field = new SdfEvaluator(c.field as NonNullable<CompiledCreature['field']>);
    const misses: string[] = [];
    let tried = 0;
    for (const [section, data] of Object.entries(c.sections)) {
      for (let at = 0.1; at < 0.95; at += 0.2)
        for (let angle = 0; angle <= 180; angle += 30)
          for (const mirror of angle === 0 || angle === 180 ? [0] : [1, -1]) {
            const placed = placeOnSkin(c, { section, at, angle, mirror });
            const p = placed.position;
            // Only points on this section's own skin: off the skin the march falls back to the
            // radius, and a point can land on another section's skin (a leg's root inside the
            // torso's), where a click anchors to that section instead.
            if (Math.abs(field.eval(p.x, p.y, p.z)) > 2e-3) continue;
            if (ownerOf(c, p) !== section) continue;
            tried++;
            const anchor = anchorAt(c, p, { on: section });
            const back = anchor && placeOnSkin(c, anchor);
            const miss = back ? back.position.distanceTo(p) : Number.POSITIVE_INFINITY;
            if (!anchor || miss > 1e-3)
              misses.push(
                `${section} at ${at.toFixed(1)} angle ${angle} mirror ${mirror} (${data.kind}): ${JSON.stringify(anchor)} misses by ${(miss * 1000).toFixed(1)} mm`,
              );
          }
    }
    expect(tried).toBeGreaterThan(50);
    expect(misses).toEqual([]);
  });

  it('places the parts of the examples where they are built, and anchors them back', () => {
    let checked = 0;
    const misses: string[] = [];
    for (const name of names) {
      const c = compile(name);
      for (const part of spec(name).parts) {
        const marker = c.markers.find((m) => m.kind === 'part' && m.id === part.id);
        // Parts on a section at one point: not rows, areas, or parts on other parts.
        const single =
          registry.get('part', part.type)?.slot === 'surface' && !OWN_MARKERS.has(part.type);
        if (!marker || !single || !c.sections[part.on]) continue;
        const placed = placeOnSkin(c, { section: part.on, ...part });
        const built = new Vector3(...marker.position);
        // A part that sinks or sits off its socket (eyes, teeth) marks the socket all the same.
        if (placed.position.distanceTo(built) > 1e-3) {
          misses.push(
            `${name} ${part.id}: placed ${(placed.position.distanceTo(built) * 1000).toFixed(1)} mm from where it is built`,
          );
          continue;
        }
        checked++;
        const anchor = anchorAt(c, built, { on: part.on });
        const back = anchor ? placeOnSkin(c, anchor).position.distanceTo(built) : 1;
        if (back > 1e-3)
          misses.push(`${name} ${part.id}: anchors back ${(back * 1000).toFixed(1)} mm off`);
      }
    }
    expect(checked).toBeGreaterThan(40);
    expect(misses).toEqual([]);
  });
});
