import { defineBodyPlan } from '@spawnforge/core';

export default defineBodyPlan({
  id: 'centaur',
  summary:
    'A horse-like body on four legs with an upright, torso-like neck carrying two arms and the head.',
  tags: ['legs:4', 'arms:2', 'humanoid', 'mammal'],
  preset: {
    scale: 1,
    body: {
      torso: { radius: [0.15, 0.17, 0.16, 0.13], arch: 0.04, pitch: 0, segments: 6 },
      // The upright front: a neck shaped like a human torso, chest to waist.
      neck: {
        length: 0.7,
        radius: [0.08, 0.15, 0.13, 0.12],
        pitch: 84,
        segments: 4,
        crossSection: 'wide',
      },
      head: { shape: 'round', length: 0.24, radius: 0.1, jaw: true, pitch: 0 },
      tail: { length: 0.6, radius: [0.05, 0.02], pitch: -40, segments: 8 },
    },
    limbs: [
      {
        id: 'foreleg',
        role: 'leg',
        attach: { on: 'torso', at: 0.12, side: 'both', angle: 115 },
        length: 0.8,
        segments: 3,
        radius: [0.06, 0.028],
        foot: { type: 'foot.claw', toes: 2 },
      },
      {
        id: 'hindleg',
        role: 'leg',
        attach: { on: 'torso', at: 0.88, side: 'both', angle: 115 },
        length: 0.85,
        segments: 3,
        radius: [0.07, 0.028],
        foot: { type: 'foot.claw', toes: 2 },
      },
      {
        id: 'arm',
        role: 'arm',
        attach: { on: 'neck', at: 0.3, side: 'both', angle: 90 },
        length: 0.75,
        segments: 2,
        radius: [0.055, 0.035],
        foot: { type: 'foot.claw', toes: 4 },
      },
    ],
    parts: [{ id: 'eyes', type: 'eye.basic', attach: { on: 'head', at: 0.3, angle: 62 } }],
    skin: {
      palette: { base: '#7a5a3a', belly: '#c8b090', accent: '#3a2a1a' },
      layers: [{ type: 'countershade' }],
    },
    motion: { temperament: 'calm' },
  },
});
