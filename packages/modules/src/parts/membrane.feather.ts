import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'membrane.feather',
  summary: 'Overlapping flight feathers along the wing bones, for birds and griffins.',
  tags: ['wing', 'feather', 'bird'],
  planned: '9.3',
  slot: 'membrane',
  material: 'skin',
  attach: { on: 'limb' },
  provides: ['glide'],
  params: z.strictObject({
    feathers: z.number().int().min(6).max(40).default(18).describe('Flight feathers per wing'),
    length: z
      .number()
      .min(0.3)
      .max(2)
      .default(1)
      .describe('Feather length relative to the wing bones: larger makes a broader wing'),
    tips: z
      .enum(['rounded', 'pointed', 'fingered'])
      .default('fingered')
      .describe('Wing tip: rounded, pointed (a falcon) or fingered (an eagle)'),
    color: colorRef('base').describe('Feather colour: a palette name or a colour'),
    tipColor: colorRef('accent').describe('Colour at the feather tips'),
  }),
  example: { type: 'membrane.feather', feathers: 20, tips: 'fingered' },
  describe: (_, { count }) => (count === 1 ? 'a feathered wing' : 'feathered wings'),
});
