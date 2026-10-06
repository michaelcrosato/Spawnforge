import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'foot.hoof',
  summary: 'A hoof, single (a horse) or cloven (a goat or boar); set it as a leg\'s "foot".',
  tags: ['foot', 'hoof'],
  planned: '8.2',
  slot: 'foot',
  material: 'horn',
  stance: 'unguligrade',
  attach: { on: 'limb' },
  params: z.strictObject({
    cloven: z.boolean().default(false).describe('Split into two toes, like a goat or a boar'),
    size: z.number().min(0.5).max(2).default(1).describe('Hoof size relative to the leg tip'),
    height: z.number().min(0.2).max(2).default(1).describe('How tall the hoof wall is'),
    color: colorRef('#2a221c').describe('Hoof colour: a palette name or a colour'),
  }),
  example: { type: 'foot.hoof', cloven: true },
  describe: (p, { count }) =>
    `${count === 1 ? 'a ' : ''}${p.cloven ? 'cloven ' : ''}hoof${count === 1 ? '' : 's'}`,
});
