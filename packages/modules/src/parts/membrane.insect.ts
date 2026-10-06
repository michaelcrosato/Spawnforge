import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'membrane.insect',
  summary: 'A thin, veined insect wing on a hinge, for flies, dragonflies, moths and bees.',
  tags: ['wing', 'membrane', 'insect'],
  planned: '9.3',
  slot: 'membrane',
  material: 'chitin',
  attach: { on: 'limb' },
  provides: ['hover'],
  params: z.strictObject({
    shape: z
      .enum(['narrow', 'broad', 'round'])
      .default('narrow')
      .describe('"narrow" like a dragonfly, "broad" like a moth, "round" like a beetle'),
    width: z.number().min(0.1).max(1.5).default(0.4).describe('Wing width relative to its length'),
    veins: z.number().min(0).max(1).default(0.6).describe('How strongly the veins show'),
    color: colorRef('#d8e0e8').describe('Wing colour: a palette name or a colour'),
    translucency: z.number().min(0).max(1).default(0.7).describe('How much light shows through'),
  }),
  example: { type: 'membrane.insect', shape: 'broad', width: 0.8 },
  describe: (p, { count }) =>
    `${count === 1 ? 'a ' : ''}${p.shape === 'broad' ? 'broad ' : ''}insect wing${count === 1 ? '' : 's'}`,
});
