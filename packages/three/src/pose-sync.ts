import type { Pose } from '@spawnforge/core';
import type { CreatureObject } from './assemble.ts';

/** Copies a motion pose into the creature's Three.js bones, breathing and blinks (once per frame). */
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
  // Blinking squashes each eye top to bottom (its bone's local Z is up).
  for (const i of creature.eyeBones) creature.bones[i]?.scale.set(1, 1, 1 - 0.92 * pose.blink);
}
