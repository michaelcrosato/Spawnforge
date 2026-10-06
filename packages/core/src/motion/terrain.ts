import { createRng } from '../rng.ts';
import type { Ground } from './controller.ts';

/**
 * A rolling test course: smooth hills and dips from a few seeded sine waves, with a flat start.
 * Returns the height and normal at (x, z).
 */
export function testCourse(
  seed = 1,
  amplitude = 0.25,
  flatRadius = 1.5,
): Ground & { height(x: number, z: number): number } {
  const rng = createRng(seed).stream('terrain');
  const waves = Array.from({ length: 5 }, () => ({
    kx: rng.float(-1.2, 1.2),
    kz: rng.float(-1.2, 1.2),
    phase: rng.float(0, Math.PI * 2),
    amp: rng.float(0.3, 1),
  }));
  const total = waves.reduce((a, w) => a + w.amp, 0);
  const height = (x: number, z: number) => {
    let h = 0;
    for (const w of waves) h += Math.sin(w.kx * x + w.kz * z + w.phase) * w.amp;
    const r = Math.hypot(x, z);
    const fade = Math.min(1, Math.max(0, (r - flatRadius) / flatRadius));
    return (h / total) * amplitude * fade * fade;
  };
  const ground = ((x: number, z: number) => {
    const e = 0.02;
    const dx = (height(x + e, z) - height(x - e, z)) / (2 * e);
    const dz = (height(x, z + e) - height(x, z - e)) / (2 * e);
    const len = Math.hypot(dx, 1, dz);
    return { height: height(x, z), normal: [-dx / len, 1 / len, -dz / len] as const };
  }) as Ground & { height(x: number, z: number): number };
  ground.height = height;
  return ground;
}
