import type { Kit } from '@spawnforge/core';
import {
  abs,
  add,
  clamp,
  cos,
  div,
  float,
  floor,
  fract,
  int,
  max,
  min,
  mix,
  mul,
  pow,
  sin,
  smoothstep,
  sqrt,
  step,
  sub,
  uint,
  uniform,
} from 'three/tsl';

// TSL's node types are loose; the kit treats every value as an opaque node.
// biome-ignore lint/suspicious/noExplicitAny: TSL nodes carry chainable methods not in the d.ts.
export type N = any;

/** PCG step on a uint node, identical to the CPU backend's. */
function pcg(v: N): N {
  const state = v.mul(uint(747796405)).add(uint(2891336453));
  const word = state.shiftRight(state.shiftRight(uint(28)).add(uint(4))).bitXor(state).mul(uint(277803737));
  return word.shiftRight(uint(22)).bitXor(word);
}

const toLattice = (x: N): N => uint(int(x).add(int(32768)));

/** The GPU backend: every operation builds a TSL node. */
export const tslKit: Kit<N> = {
  num: (x) => float(x),
  param: (x) => uniform(x),
  add: (a, b) => add(a, b),
  sub: (a, b) => sub(a, b),
  mul: (a, b) => mul(a, b),
  div: (a, b) => div(a, b),
  min: (a, b) => min(a, b),
  max: (a, b) => max(a, b),
  abs: (a) => abs(a),
  floor: (a) => floor(a),
  fract: (a) => fract(a),
  sin: (a) => sin(a),
  cos: (a) => cos(a),
  sqrt: (a) => sqrt(max(a, float(0))),
  pow: (a, b) => pow(max(a, float(0)), b),
  mix: (a, b, t) => mix(a, b, t),
  clamp: (x, lo, hi) => clamp(x, lo, hi),
  smoothstep: (e0, e1, x) => smoothstep(e0, e1, x),
  step: (edge, x) => step(edge, x),
  hash3: (x, y, z, salt) => {
    const h = pcg(toLattice(x as N).add(pcg(toLattice(y as N).add(pcg(toLattice(z as N).add(uint(salt)))))));
    return float(h).div(float(4294967296));
  },
};
