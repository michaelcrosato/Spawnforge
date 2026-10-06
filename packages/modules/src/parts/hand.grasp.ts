import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'hand.grasp',
  summary: 'A grasping hand: fingers and an opposed thumb, with nails or claws; set it as "foot".',
  tags: ['hand'],
  planned: '8.2',
  slot: 'foot',
  material: 'skin',
  attach: { on: 'limb' },
  provides: ['hand'],
  params: z.strictObject({
    fingers: z.number().int().min(2).max(5).default(4).describe('Fingers beside the thumb'),
    fingerLength: z
      .number()
      .min(0.02)
      .max(0.5)
      .default(0.1)
      .describe('Finger length in torso lengths'),
    claws: z
      .number()
      .min(0)
      .max(0.2)
      .default(0.01)
      .describe('Claw length in torso lengths; 0 for nails'),
    clawColor: colorRef('#2a221c').describe('Claw or nail colour: a palette name or a colour'),
  }),
  example: { type: 'hand.grasp', fingers: 4, claws: 0.03 },
  describe: (_, { count }) => (count === 1 ? 'a grasping hand' : 'grasping hands'),
});
