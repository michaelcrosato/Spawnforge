import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'foot.pad',
  summary: 'A broad column foot with blunt nails, for heavy creatures like elephants and trolls.',
  tags: ['foot', 'heavy'],
  planned: '8.2',
  slot: 'foot',
  material: 'skin',
  stance: 'plantigrade',
  attach: { on: 'limb' },
  params: z.strictObject({
    width: z.number().min(0.5).max(2.5).default(1.3).describe('Foot width relative to the leg tip'),
    nails: z.number().int().min(0).max(5).default(4).describe('Blunt nails around the front'),
    nailColor: colorRef('#d8ccb0').describe('Nail colour: a palette name or a colour'),
  }),
  example: { type: 'foot.pad', width: 1.5, nails: 3 },
  describe: (_, { count }) => (count === 1 ? 'a padded foot' : 'broad padded feet'),
});
