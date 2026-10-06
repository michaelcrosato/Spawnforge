import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'antenna',
  summary:
    'A jointed antenna that sways on springs: thread-like, clubbed or feathery; side "both" for a pair.',
  tags: ['head', 'sense', 'insect'],
  planned: '9.4',
  slot: 'surface',
  material: 'chitin',
  attach: { on: 'head', at: 0.3, angle: 30 },
  params: z.strictObject({
    length: z.number().min(0.05).max(2).default(0.5).describe('Length in torso lengths'),
    segments: z.number().int().min(2).max(12).default(6).describe('Jointed segments'),
    shape: z
      .enum(['thread', 'club', 'feather'])
      .default('thread')
      .describe(
        '"thread" plain, "club" thickened at the tip (a butterfly), "feather" combed (a moth)',
      ),
    curve: z.number().min(-180).max(180).default(40).describe('Degrees it curves back at rest'),
    stiffness: z.number().min(0).max(1).default(0.5).describe('How little it sways'),
    color: colorRef('accent').describe('Colour: a palette name or a colour'),
  }),
  example: {
    id: 'antennae',
    type: 'antenna',
    attach: { on: 'head', at: 0.3, angle: 30, side: 'both' },
    params: { length: 0.6, shape: 'feather' },
  },
  describe: (p, { count }) =>
    `${count === 1 ? 'an ' : ''}${p.shape === 'thread' ? '' : `${p.shape === 'feather' ? 'feathery' : 'clubbed'} `}antenna${count === 1 ? '' : 'e'}`,
});
