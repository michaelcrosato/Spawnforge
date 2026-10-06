import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'beak',
  summary:
    'A horny beak in two halves, upper on the head and lower on the jaw, for birds and griffins.',
  tags: ['head', 'mouth', 'bird'],
  planned: '8.3',
  slot: 'mouth',
  material: 'horn',
  attach: { on: 'head' },
  params: z.strictObject({
    shape: z
      .enum(['hooked', 'straight', 'broad'])
      .default('hooked')
      .describe('"hooked" like an eagle, "straight" like a heron, "broad" like a duck'),
    length: z.number().min(0.2).max(2).default(1).describe('Beak length relative to the snout'),
    depth: z.number().min(0.2).max(2).default(1).describe('How deep and heavy the beak is'),
    color: colorRef('#d8b040').describe('Beak colour: a palette name or a colour'),
    tipColor: colorRef('#3a3020').describe('Colour at the tip'),
  }),
  example: { id: 'beak', type: 'beak', params: { shape: 'hooked' } },
  describe: (p) => `a ${p.shape as string} beak`,
});
