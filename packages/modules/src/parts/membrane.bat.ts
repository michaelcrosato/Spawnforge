import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'membrane.bat',
  summary:
    'Leathery skin stretched between long finger bones, the body and the hind leg: bat and dragon wings.',
  tags: ['wing', 'membrane'],
  planned: '9.3',
  slot: 'membrane',
  material: 'skin',
  attach: { on: 'limb' },
  provides: ['glide'],
  params: z.strictObject({
    fingers: z
      .number()
      .int()
      .min(3)
      .max(5)
      .default(4)
      .describe('Finger bones spanning the membrane'),
    span: z
      .number()
      .min(0.5)
      .max(2)
      .default(1)
      .describe('Finger length relative to the arm: larger spreads a bigger wing'),
    trailing: z
      .enum(['leg', 'body'])
      .default('leg')
      .describe('Where the trailing edge runs: to the nearest leg behind the wing, or to the body'),
    scallop: z
      .number()
      .min(0)
      .max(1)
      .default(0.4)
      .describe('How deeply the edge dips between fingers'),
    color: colorRef('base').describe('Membrane colour: a palette name or a colour'),
    translucency: z.number().min(0).max(1).default(0.4).describe('How much light shows through'),
  }),
  example: { type: 'membrane.bat', fingers: 4, span: 1.2 },
  describe: (_, { count }) => (count === 1 ? 'a leathery wing' : 'leathery wings'),
});
