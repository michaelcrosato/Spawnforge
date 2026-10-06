import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'membrane.fin',
  summary: 'A fin of thin rays with skin between them, on a fin limb (pectoral and pelvic fins).',
  tags: ['fin', 'membrane', 'aquatic'],
  planned: '9.3',
  slot: 'membrane',
  material: 'skin',
  attach: { on: 'limb' },
  params: z.strictObject({
    rays: z.number().int().min(3).max(16).default(7).describe('Rays spanning the fin'),
    width: z.number().min(0.2).max(2).default(0.8).describe('Fin width relative to its length'),
    color: colorRef('base').describe('Fin colour: a palette name or a colour'),
    translucency: z.number().min(0).max(1).default(0.5).describe('How much light shows through'),
  }),
  example: { type: 'membrane.fin', rays: 8 },
  describe: (_, { count }) => (count === 1 ? 'a fin' : 'fins'),
});
