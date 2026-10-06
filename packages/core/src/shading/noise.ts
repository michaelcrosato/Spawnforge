import type { Kit } from './kit.ts';

/** Value noise on the integer lattice, smoothly interpolated, in [0, 1). */
export function valueNoise<F>(k: Kit<F>, x: F, y: F, z: F, salt = 0): F {
  const ix = k.floor(x);
  const iy = k.floor(y);
  const iz = k.floor(z);
  const fx = k.sub(x, ix);
  const fy = k.sub(y, iy);
  const fz = k.sub(z, iz);
  const smooth = (f: F) => k.mul(k.mul(f, f), k.sub(k.num(3), k.mul(k.num(2), f)));
  const ux = smooth(fx);
  const uy = smooth(fy);
  const uz = smooth(fz);
  const one = k.num(1);
  const h = (dx: number, dy: number, dz: number) =>
    k.hash3(dx ? k.add(ix, one) : ix, dy ? k.add(iy, one) : iy, dz ? k.add(iz, one) : iz, salt);
  const x00 = k.mix(h(0, 0, 0), h(1, 0, 0), ux);
  const x10 = k.mix(h(0, 1, 0), h(1, 1, 0), ux);
  const x01 = k.mix(h(0, 0, 1), h(1, 0, 1), ux);
  const x11 = k.mix(h(0, 1, 1), h(1, 1, 1), ux);
  return k.mix(k.mix(x00, x10, uy), k.mix(x01, x11, uy), uz);
}

/** Fractal value noise: `octaves` layers, each twice the frequency and half the weight. */
export function fbm<F>(k: Kit<F>, x: F, y: F, z: F, octaves = 3, salt = 0): F {
  let sum = k.num(0);
  let amp = 0.5;
  let norm = 0;
  let fx = x;
  let fy = y;
  let fz = z;
  for (let o = 0; o < octaves; o++) {
    sum = k.add(sum, k.mul(valueNoise(k, fx, fy, fz, salt + o * 7), k.num(amp)));
    norm += amp;
    amp *= 0.5;
    const two = k.num(2.03);
    fx = k.mul(fx, two);
    fy = k.mul(fy, two);
    fz = k.mul(fz, two);
  }
  return k.div(sum, k.num(norm));
}

export interface Cell<F> {
  /** Distance to the nearest feature point, in cells. */
  readonly distance: F;
  /** Distance to the second nearest, for edges between cells. */
  readonly second: F;
  /** A random value per cell in [0, 1). */
  readonly id: F;
}

/**
 * Cellular (Worley) noise from the 2×2×2 cells nearest the point, with one feature point per
 * cell jittered by up to `jitter` (0 to 1) of half a cell around its centre.
 */
export function cells<F>(k: Kit<F>, x: F, y: F, z: F, jitter: number, salt = 0): Cell<F> {
  const half = k.num(0.5);
  const bx = k.floor(k.sub(x, half));
  const by = k.floor(k.sub(y, half));
  const bz = k.floor(k.sub(z, half));
  const one = k.num(1);
  let best = k.num(9);
  let second = k.num(9);
  let id = k.num(0);
  const j = k.num(jitter * 0.5);
  for (let c = 0; c < 8; c++) {
    const cx = c & 1 ? k.add(bx, one) : bx;
    const cy = c & 2 ? k.add(by, one) : by;
    const cz = c & 4 ? k.add(bz, one) : bz;
    const ox = k.mul(k.sub(k.hash3(cx, cy, cz, salt + 11), half), j);
    const oy = k.mul(k.sub(k.hash3(cx, cy, cz, salt + 23), half), j);
    const oz = k.mul(k.sub(k.hash3(cx, cy, cz, salt + 37), half), j);
    const dx = k.sub(k.add(k.add(cx, half), ox), x);
    const dy = k.sub(k.add(k.add(cy, half), oy), y);
    const dz = k.sub(k.add(k.add(cz, half), oz), z);
    const d = k.sqrt(k.add(k.add(k.mul(dx, dx), k.mul(dy, dy)), k.mul(dz, dz)));
    const closer = k.step(d, best);
    second = k.min(second, k.max(d, best));
    best = k.min(best, d);
    id = k.mix(id, k.hash3(cx, cy, cz, salt + 53), closer);
  }
  return { distance: best, second, id };
}
