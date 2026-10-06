import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'membrane.case',
  summary:
    "A beetle's hard wing case (elytron): a shell that covers the same-side wing behind it and lifts in flight.",
  tags: ['wing', 'shell', 'insect', 'chitin'],
  planned: '9.3',
  slot: 'membrane',
  material: 'chitin',
  attach: { on: 'limb' },
  params: z.strictObject({
    dome: z.number().min(0).max(1).default(0.6).describe('How domed the case is'),
    ridges: z.number().int().min(0).max(12).default(3).describe('Ridges along the case'),
    color: colorRef('base').describe('Case colour: a palette name or a colour'),
    sheen: z.number().min(0).max(1).default(0.6).describe('How glossy the case is'),
  }),
  example: { type: 'membrane.case', dome: 0.7 },
  describe: (_, { count }) => (count === 1 ? 'a wing case' : 'wing cases'),
});
