import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'fin.tail',
  summary:
    'A tail fin at the tail tip: forked like a shark, rounded like a carp, or flat like a whale.',
  tags: ['fin', 'aquatic', 'tail'],
  planned: '9.3',
  slot: 'surface',
  material: 'skin',
  attach: { on: 'tail', at: 1, angle: 0 },
  params: z.strictObject({
    shape: z
      .enum(['forked', 'crescent', 'rounded', 'flukes'])
      .default('forked')
      .describe('"forked", "crescent" (a tuna), "rounded" or "flukes" (flat, like a whale)'),
    size: z.number().min(0.05).max(1.5).default(0.35).describe('Fin height in torso lengths'),
    upper: z.number().min(0).max(1).default(0.6).describe('Share of the fin above the tail line'),
    color: colorRef('base').describe('Fin colour: a palette name or a colour'),
  }),
  example: { id: 'tailfin', type: 'fin.tail', params: { shape: 'forked', size: 0.4 } },
  describe: (p) => `a ${p.shape as string} tail fin`,
});
