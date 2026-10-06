import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'foot.paw',
  summary: 'A padded paw with toes and visible or hidden claws, like a dog or a big cat.',
  tags: ['foot', 'paw'],
  planned: '8.2',
  slot: 'foot',
  material: 'skin',
  stance: 'digitigrade',
  attach: { on: 'limb' },
  params: z.strictObject({
    toes: z.number().int().min(3).max(5).default(4).describe('Toes on the ground'),
    size: z.number().min(0.5).max(2).default(1).describe('Paw size relative to the leg tip'),
    claws: z
      .enum(['hidden', 'short', 'long'])
      .default('short')
      .describe('"hidden" like a cat at rest, "short" like a dog, "long" like a bear'),
    padColor: colorRef('#3a2e2a').describe('Colour of the pads: a palette name or a colour'),
    clawColor: colorRef('#2a221c').describe('Claw colour'),
  }),
  example: { type: 'foot.paw', toes: 4, claws: 'short' },
  describe: (_, { count }) => (count === 1 ? 'a paw' : 'paws'),
});
