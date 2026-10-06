import { Vector3 } from 'three';
import type { WeightTable } from './skin.ts';
import type { BoneDef } from './types.ts';

/** The mouth line in head space, shared by the cut, the inner mouth and the teeth. */
export interface MouthLine {
  /** Skull centre (head bone head). */
  readonly origin: Vector3;
  readonly forward: Vector3;
  readonly up: Vector3;
  readonly side: Vector3;
  /** Distance forward of the origin where the mouth corner and the tip sit. */
  readonly corner: number;
  readonly tip: number;
  /** Height of the line at the corner and the tip (along `up`). */
  readonly cornerY: number;
  readonly tipY: number;
  /** Head half-width across the line at the corner and the tip. */
  readonly cornerHalf: number;
  readonly tipHalf: number;
}

export function mouthLine(head: BoneDef, jaw: BoneDef): MouthLine {
  const forward = new Vector3().subVectors(head.tail, head.head).normalize();
  const up = head.up.clone().addScaledVector(forward, -head.up.dot(forward)).normalize();
  const side = new Vector3().crossVectors(up, forward).normalize();
  const along = (p: Vector3) => new Vector3().subVectors(p, head.head).dot(forward);
  const len = head.head.distanceTo(head.tail);
  const hinge = along(jaw.head);
  const corner = hinge + Math.max(0.15 * len, head.r0 * 0.25);
  const tip = len + head.r1 * 0.85;
  const radiusAt = (z: number) =>
    head.r0 + (head.r1 - head.r0) * Math.min(1, Math.max(0, z / (len || 1)));
  return {
    origin: head.head.clone(),
    forward,
    up,
    side,
    corner,
    tip,
    cornerY: -radiusAt(corner) * head.cross[1] * 0.28,
    tipY: -head.r1 * head.cross[1] * 0.3,
    cornerHalf: radiusAt(corner) * head.cross[0] * 0.8,
    tipHalf: head.r1 * head.cross[0] * 0.55,
  };
}

/** A point on the mouth line: t = 0 at the tip, 1 at the corner; side ±1 (0 for the middle). */
export function mouthPoint(m: MouthLine, t: number, side: number): Vector3 {
  const z = m.tip + (m.corner - m.tip) * t;
  const y = m.tipY + (m.cornerY - m.tipY) * t;
  // The line curves round the front of the snout.
  const half = m.tipHalf + (m.cornerHalf - m.tipHalf) * Math.sqrt(t);
  const front = (1 - Math.sqrt(t)) * m.tipHalf * 0.6;
  return m.origin
    .clone()
    .addScaledVector(m.forward, z - front * (1 - Math.abs(side)))
    .addScaledVector(m.up, y)
    .addScaledVector(m.side, side * half * Math.min(1, t * 4 + 0.15));
}

export interface CutResult {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Original vertex index for every output vertex (duplicates point back to their source). */
  source: Int32Array;
  /** 1 for vertices that follow the jaw, else 0. */
  lower: Uint8Array;
}

/**
 * Cuts the closed head mesh along the mouth line. Triangles in front of the mouth corner are
 * split into upper and lower sets by their centroid; vertices shared by both sets are duplicated
 * so the lower copies can follow the jaw.
 */
export function cutMouth(
  positions: Float32Array,
  normals: Float32Array,
  indices: Uint32Array,
  table: WeightTable,
  head: number,
  jaw: number,
  m: MouthLine,
): CutResult {
  const n = positions.length / 3;
  const local = (v: number) => {
    const p = new Vector3(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]).sub(
      m.origin,
    );
    return { z: p.dot(m.forward), y: p.dot(m.up), x: p.dot(m.side) };
  };
  const isHeady = (v: number) => {
    let w = 0;
    for (const [b, x] of table.entries(v)) if (b === head || b === jaw) w += x;
    return w > 0.5;
  };
  const lineY = (z: number) => {
    const t = Math.min(1, Math.max(0, (z - m.tip) / (m.corner - m.tip)));
    return m.tipY + (m.cornerY - m.tipY) * t;
  };
  const inMouth = new Uint8Array(n);
  const below = new Uint8Array(n);
  for (let v = 0; v < n; v++) {
    const l = local(v);
    if (l.z > m.corner && isHeady(v)) inMouth[v] = 1;
    if (l.y < lineY(l.z)) below[v] = 1;
  }
  // Classify triangles in the mouth region by centroid.
  const triLower = new Uint8Array(indices.length / 3);
  const usedUpper = new Uint8Array(n);
  const usedLower = new Uint8Array(n);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] as number;
    const b = indices[t + 1] as number;
    const c = indices[t + 2] as number;
    if (!(inMouth[a] && inMouth[b] && inMouth[c])) continue;
    const la = local(a);
    const lb = local(b);
    const lc = local(c);
    const cz = (la.z + lb.z + lc.z) / 3;
    const cy = (la.y + lb.y + lc.y) / 3;
    const isLower = cy < lineY(cz) ? 1 : 0;
    triLower[t / 3] = isLower;
    for (const v of [a, b, c]) {
      if (isLower) usedLower[v] = 1;
      else usedUpper[v] = 1;
    }
  }
  // Duplicate vertices used by both sides; lower triangles use the copies.
  const copyOf = new Int32Array(n).fill(-1);
  const pos: number[] = Array.from(positions);
  const nrm: number[] = Array.from(normals);
  const source: number[] = Array.from({ length: n }, (_, i) => i);
  const lower: number[] = Array.from({ length: n }, (_, v) =>
    usedLower[v] && !usedUpper[v] ? 1 : 0,
  );
  for (let v = 0; v < n; v++) {
    if (!(usedLower[v] && usedUpper[v])) continue;
    copyOf[v] = pos.length / 3;
    pos.push(
      positions[v * 3] as number,
      positions[v * 3 + 1] as number,
      positions[v * 3 + 2] as number,
    );
    nrm.push(normals[v * 3] as number, normals[v * 3 + 1] as number, normals[v * 3 + 2] as number);
    source.push(v);
    lower.push(1);
  }
  const out = new Uint32Array(indices);
  for (let t = 0; t < indices.length; t += 3) {
    if (!triLower[t / 3]) continue;
    for (let e = 0; e < 3; e++) {
      const v = indices[t + e] as number;
      const c = copyOf[v] as number;
      if (c >= 0) out[t + e] = c;
    }
  }
  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nrm),
    indices: out,
    source: new Int32Array(source),
    lower: new Uint8Array(lower),
  };
}

/** A dark closed pouch inside the mouth, seen when the jaw opens. Upper half on the head. */
export function innerMouth(
  m: MouthLine,
  rings = 6,
  sides = 12,
): { positions: number[]; normals: number[]; indices: number[]; lower: number[] } {
  const centre = m.origin
    .clone()
    .addScaledVector(m.forward, (m.corner + m.tip) / 2)
    .addScaledVector(m.up, (m.cornerY + m.tipY) / 2);
  const rz = Math.abs(m.tip - m.corner) * 0.48;
  const rx = Math.min(m.cornerHalf, m.tipHalf * 1.6) * 0.82;
  const ry = Math.max(Math.abs(m.cornerY), Math.abs(m.tipY)) * 1.3;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const phi = -Math.PI / 2 + (i / rings) * Math.PI;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const lx = Math.cos(phi) * Math.cos(a);
      const lz = Math.cos(phi) * Math.sin(a);
      const ly = Math.sin(phi);
      const p = centre
        .clone()
        .addScaledVector(m.side, lx * rx)
        .addScaledVector(m.forward, lz * rz)
        .addScaledVector(m.up, ly * ry);
      // Normals point inward so the inside reads as a cavity.
      const nrm = new Vector3()
        .addScaledVector(m.side, -lx / rx)
        .addScaledVector(m.forward, -lz / rz)
        .addScaledVector(m.up, -ly / ry)
        .normalize();
      positions.push(p.x, p.y, p.z);
      normals.push(nrm.x, nrm.y, nrm.z);
      lower.push(ly < 0 ? 1 : 0);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * sides + s;
      const b = i * sides + ((s + 1) % sides);
      const c = (i + 1) * sides + s;
      const d = (i + 1) * sides + ((s + 1) % sides);
      // Inward-facing winding.
      indices.push(a, d, c, a, b, d);
    }
  }
  return { positions, normals, indices, lower };
}
