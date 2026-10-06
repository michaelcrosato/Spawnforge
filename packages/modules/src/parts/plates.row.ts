import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'plates.row',
  summary:
    'Upright bony plates along the back, in one row or two alternating rows like a stegosaur.',
  tags: ['back', 'armor', 'bone'],
  planned: '9.5',
  slot: 'row',
  material: 'bone',
  attach: { on: 'spine', from: 0.2, to: 0.8, angle: 0 },
  params: z.strictObject({
    count: z
      .number()
      .int()
      .min(2)
      .max(40)
      .default(12)
      .describe('Plates in all; with alternate they take turns left and right'),
    height: z
      .union([z.number().min(0.01).max(0.8), z.array(z.number().min(0.01).max(0.8)).min(1).max(16)])
      .default([0.08, 0.2, 0.08])
      .describe('Height in torso lengths, as one number or a profile along the row'),
    alternate: z.boolean().default(true).describe('Two staggered rows, left and right'),
    shape: z.enum(['kite', 'round', 'spike']).default('kite').describe('Plate outline'),
    color: colorRef('#c8b090').describe('Plate colour: a palette name or a colour'),
    edgeColor: colorRef('accent').describe('Colour at the plate edges'),
  }),
  example: {
    id: 'plates',
    type: 'plates.row',
    attach: { on: 'spine', from: 0.2, to: 0.85 },
    params: { count: 14, height: [0.1, 0.25, 0.1] },
  },
  describe: () => 'plates along its back',
});
