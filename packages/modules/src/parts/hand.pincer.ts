import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'hand.pincer',
  summary: 'A crab or scorpion pincer: a heavy claw with one hinged finger that snaps shut.',
  tags: ['hand', 'weapon', 'chitin'],
  planned: '9.4',
  slot: 'foot',
  material: 'chitin',
  attach: { on: 'limb' },
  provides: ['pincer'],
  params: z.strictObject({
    size: z.number().min(0.03).max(0.8).default(0.2).describe('Pincer length in torso lengths'),
    width: z.number().min(0.2).max(1.5).default(0.6).describe('How bulky the claw is'),
    teeth: z.number().int().min(0).max(12).default(4).describe('Serrations along the inner edge'),
    color: colorRef('base').describe('Claw colour: a palette name or a colour'),
    tipColor: colorRef('#1e1a16').describe('Colour at the finger tips'),
  }),
  example: { type: 'hand.pincer', size: 0.25 },
  describe: (_, { count }) => (count === 1 ? 'a pincer' : 'pincers'),
});
