import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'quills',
  summary:
    'Long sharp quills scattered over an area of the body, raised in display, like a porcupine.',
  tags: ['back', 'display', 'weapon'],
  planned: '9.5',
  slot: 'area',
  material: 'horn',
  attach: { on: 'spine', area: 'back', from: 0.3, to: 0.9 },
  provides: ['display'],
  params: z.strictObject({
    density: z.number().min(0).max(1).default(0.5).describe('How closely the quills grow'),
    length: z.number().min(0.02).max(1).default(0.2).describe('Quill length in torso lengths'),
    lie: z.number().min(0).max(90).default(60).describe('Degrees the quills lie back at rest'),
    color: colorRef('#e8e0d0').describe('Quill colour: a palette name or a colour'),
    tipColor: colorRef('#2a2018').describe('Colour at the tips'),
  }),
  example: {
    id: 'quills',
    type: 'quills',
    attach: { on: 'spine', area: 'back', from: 0.3, to: 0.9 },
    params: { length: 0.25 },
  },
  describe: () => 'quills along its back',
});
