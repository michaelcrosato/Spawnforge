import { defineBodyPlan } from '@spawnforge/core';

export default defineBodyPlan({
  id: 'biped',
  summary:
    'Upright torso on two legs with two free arms; walks. Lean the torso forward and add a tail for a raptor.',
  tags: ['legs:2', 'arms:2', 'humanoid'],
  preset: {
    scale: 0.7,
    body: {
      torso: {
        radius: [0.17, 0.2, 0.18, 0.17],
        arch: 0.05,
        pitch: 80,
        segments: 5,
        crossSection: 'wide',
      },
      neck: { length: 0.12, radius: [0.07, 0.085], pitch: 80, segments: 2 },
      head: { shape: 'round', length: 0.28, radius: 0.13, jaw: true, pitch: 0 },
      tail: { length: 0 },
    },
    limbs: [
      {
        id: 'leg',
        role: 'leg',
        attach: { on: 'torso', at: 0.92, side: 'both', angle: 125 },
        length: 1.15,
        segments: 2,
        radius: [0.1, 0.05],
        foot: { type: 'foot.claw', toes: 3 },
      },
      {
        id: 'arm',
        role: 'arm',
        attach: { on: 'torso', at: 0.1, side: 'both', angle: 95 },
        length: 1,
        segments: 2,
        radius: [0.07, 0.04],
        foot: { type: 'foot.claw', toes: 4 },
      },
    ],
    parts: [{ id: 'eyes', type: 'eye.basic', attach: { on: 'head', at: 0.3, angle: 62 } }],
    skin: {
      palette: { base: '#6f7a4a', belly: '#c9c39a', accent: '#2f3320' },
      layers: [{ type: 'countershade' }],
    },
    motion: { temperament: 'calm', gaits: ['walk'] },
  },
});
