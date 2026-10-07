import { Quaternion, Vector3 } from 'three';
import type { RigData } from '../compile/compile.ts';
import type { Pose } from './pose.ts';
import { applyStations, applyWings } from './wings.ts';

const X_AXIS = new Vector3(1, 0, 0);
const turn = new Quaternion();

/** How far an open jaw turns about its hinge (radians), at `jaw` 1. */
export const JAW_OPEN = 0.65;

/**
 * Opens every jaw by `jaw` (0 shut to 1 wide) and closes every eyelid by `blink` (0 open to 1
 * shut), on top of the pose's rest rotations. Lids are blink-driven chains whose `closed` pose
 * holds each bone's turn about its local X (docs/design/8.3-heads.md).
 */
export function applyFace(pose: Pose, rig: RigData, jaw: number, blink: number): void {
  pose.blink = blink;
  if (jaw > 0)
    for (const h of rig.heads) {
      if (h.jaw < 0) continue;
      (pose.rot[h.jaw] as Quaternion)
        .copy(pose.restRot[h.jaw] as Quaternion)
        .multiply(turn.setFromAxisAngle(X_AXIS, -jaw * JAW_OPEN));
      pose.solveSubtree(h.jaw);
    }
  for (const chain of rig.chains) {
    if (chain.drive !== 'blink') continue;
    const closed = chain.poses?.closed;
    if (!closed) continue;
    chain.bones.forEach((bone, i) => {
      (pose.rot[bone] as Quaternion)
        .copy(pose.restRot[bone] as Quaternion)
        .multiply(turn.setFromAxisAngle(X_AXIS, blink * ((closed[i] as number) ?? 0)));
      pose.solveSubtree(bone);
    });
  }
}

/**
 * The rest pose a still shows (docs/design/9.3-wings-fins.md): wings folded unless `spread`
 * (0 to 1) opens them, the jaw open by `jaw` and the eyes shut by `blink`, membranes carried by
 * their stations. Starts from `pose.reset()`.
 */
export function applyRest(
  pose: Pose,
  rig: RigData,
  options: { readonly jaw?: number; readonly blink?: number; readonly spread?: number } = {},
): void {
  pose.reset();
  applyWings(pose, rig.wings, options.spread ?? 0);
  pose.solve();
  applyFace(pose, rig, options.jaw ?? 0, options.blink ?? 0);
  applyStations(pose, rig.stations);
}
