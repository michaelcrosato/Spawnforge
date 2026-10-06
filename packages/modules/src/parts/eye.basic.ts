import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'eye.basic',
  summary: 'Round eyeball with an iris and pupil that turns to look at targets and blinks.',
  tags: ['head', 'sense'],
  slot: 'surface',
  material: 'eye',
  attach: { on: 'head', at: 0.4, angle: 60 },
  params: z.strictObject({
    size: z.number().min(0.005).max(0.2).default(0.022).describe('Eyeball radius in torso lengths'),
    pupil: z.enum(['round', 'slit', 'goat']).default('round').describe('Pupil shape'),
    irisColor: colorRef('#c8a030'),
    bulge: z.number().min(0).max(1).default(0.5).describe('How far the eye stands out of the skin'),
  }),
  example: {
    id: 'eyes',
    type: 'eye.basic',
    attach: { on: 'head', at: 0.4, angle: 60, side: 'both' },
    params: { size: 0.02, pupil: 'slit' },
  },
});
