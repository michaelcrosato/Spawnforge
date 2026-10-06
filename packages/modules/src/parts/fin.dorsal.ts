import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'fin.dorsal',
  summary: "One fin standing on the midline of the back (or belly, at angle 180), like a shark's.",
  tags: ['fin', 'aquatic', 'back'],
  planned: '9.3',
  slot: 'surface',
  material: 'skin',
  attach: { on: 'torso', at: 0.45, angle: 0 },
  params: z.strictObject({
    height: z.number().min(0.02).max(1).default(0.25).describe('Height in torso lengths'),
    length: z.number().min(0.02).max(1).default(0.25).describe('Length along the body at its base'),
    sweep: z.number().min(0).max(80).default(35).describe('Degrees the fin leans back'),
    shape: z
      .enum(['triangle', 'sail', 'rounded'])
      .default('triangle')
      .describe('"triangle" like a shark, "sail" tall and straight, "rounded" like a carp'),
    color: colorRef('base').describe('Fin colour: a palette name or a colour'),
  }),
  example: {
    id: 'dorsal',
    type: 'fin.dorsal',
    attach: { on: 'torso', at: 0.4, angle: 0 },
    params: { height: 0.3 },
  },
  describe: () => 'a dorsal fin',
});
