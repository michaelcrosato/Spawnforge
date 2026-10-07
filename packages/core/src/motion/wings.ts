import { Matrix4, Quaternion, Vector3 } from 'three';
import type { StationPanel, WingRig } from '../compile/types.ts';
import type { Pose } from './pose.ts';

/**
 * Wings (docs/design/9.3-wings-fins.md) rest folded and spread toward their bind pose:
 * `spread` 0 is folded, 1 spread. Each wing, digit and feather bone turns from its rest
 * rotation toward its bind rotation; the caller solves the pose afterwards.
 */
export function applyWings(pose: Pose, wings: readonly WingRig[], spread: number): void {
  if (spread <= 0) return;
  const t = Math.min(1, spread);
  for (const wing of wings) {
    for (const bone of [...wing.bones, ...wing.digits.flat(), ...wing.feathers]) {
      (pose.rot[bone] as Quaternion)
        .copy(pose.restRot[bone] as Quaternion)
        .slerp(pose.bindRot[bone] as Quaternion, t);
    }
  }
}

const a = new Vector3();
const b = new Vector3();
const along = new Vector3();
const x = new Vector3();
const y = new Vector3();
const z = new Vector3();
const m = new Matrix4();
const world = new Quaternion();
const inverse = new Quaternion();

/**
 * Aims every membrane station at its partner across the panel, with a roll they share (the
 * spars' mean direction), so a sheet weighted between two stations on each side lies exactly on
 * the ruled surface between the spars, whatever they do. Station bones are leaves: they are
 * posed last, from their parents' current world transforms, and solved here.
 */
export function applyStations(pose: Pose, stations: readonly StationPanel[]): void {
  for (const panel of stations) {
    const n = panel.a.length;
    for (let k = 0; k < n; k++) {
      const ia = panel.a[k] as number;
      const ib = panel.b[k] as number;
      // Their heads follow their parents.
      pose.solveBone(ia);
      pose.solveBone(ib);
    }
    for (let k = 0; k < n; k++) {
      const ia = panel.a[k] as number;
      const ib = panel.b[k] as number;
      a.copy(pose.worldPos[ia] as Vector3);
      b.copy(pose.worldPos[ib] as Vector3);
      y.subVectors(b, a);
      if (y.lengthSq() < 1e-14) y.set(0, 0, 1);
      y.normalize();
      // Along the spars: central differences on both sides, summed.
      const k0 = Math.max(0, k - 1);
      const k1 = Math.min(n - 1, k + 1);
      along
        .subVectors(
          pose.worldPos[panel.a[k1] as number] as Vector3,
          pose.worldPos[panel.a[k0] as number] as Vector3,
        )
        .add(
          b.subVectors(
            pose.worldPos[panel.b[k1] as number] as Vector3,
            pose.worldPos[panel.b[k0] as number] as Vector3,
          ),
        );
      z.copy(along).addScaledVector(y, -along.dot(y));
      if (z.lengthSq() < 1e-14) z.set(0, 1, 0).addScaledVector(y, -y.y);
      if (z.lengthSq() < 1e-14) z.set(1, 0, 0).addScaledVector(y, -y.x);
      z.normalize();
      x.crossVectors(y, z).normalize();
      for (const [bone, sign] of [
        [ia, 1],
        [ib, -1],
      ] as const) {
        world.setFromRotationMatrix(
          m.makeBasis(x.clone().multiplyScalar(sign), y.clone().multiplyScalar(sign), z),
        );
        const parent = pose.parents[bone] as number;
        inverse.copy(pose.worldRot[parent] as Quaternion).invert();
        (pose.rot[bone] as Quaternion).multiplyQuaternions(inverse, world);
        pose.solveBone(bone);
      }
    }
  }
}
