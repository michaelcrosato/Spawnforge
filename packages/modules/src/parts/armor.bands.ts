import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'armor.bands',
  summary:
    'Overlapping bands of armour across an area of the body, like an armadillo or a pangolin.',
  tags: ['armor'],
  planned: '9.5',
  slot: 'area',
  material: 'horn',
  attach: { on: 'torso', area: 'back', from: 0, to: 1 },
  params: z.strictObject({
    bands: z.number().int().min(2).max(30).default(9).describe('Bands from front to back'),
    thickness: z
      .number()
      .min(0.005)
      .max(0.15)
      .default(0.025)
      .describe('Thickness in torso lengths'),
    overlap: z
      .number()
      .min(0)
      .max(0.8)
      .default(0.3)
      .describe('How much each band overlaps the next'),
    scales: z.boolean().default(false).describe('Break the bands into scales, like a pangolin'),
    color: colorRef('base').describe('Armour colour: a palette name or a colour'),
  }),
  example: { id: 'armor', type: 'armor.bands', params: { bands: 11 } },
  describe: () => 'bands of armour',
});
