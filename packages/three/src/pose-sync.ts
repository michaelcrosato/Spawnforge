import type { Pose } from '@spawnforge/core';
import type { CreatureObject } from './assemble.ts';

/**
 * Copies a motion pose into the creature's Three.js bones and breathing (once per frame). Blinks
 * are eyelid bones' turns, already in the pose.
 */
export function applyPose(creature: CreatureObject, pose: Pose): void {
  const bones = creature.bones;
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i];
    const rot = pose.rot[i];
    const pos = pose.pos[i];
    if (!bone || !rot || !pos) continue;
    bone.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    bone.position.set(pos.x, pos.y, pos.z);
  }
  creature.signals.breath.value = pose.breath;
}
