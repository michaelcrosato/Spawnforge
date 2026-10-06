import { definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'spikes.row',
  summary: 'A row of conical spikes between two points, e.g. down the spine at angle 0.',
  tags: ['back', 'tail', 'defence', 'bone'],
  slot: 'row',
  material: 'bone',
  attach: { on: 'torso', angle: 0 },
  params: z.strictObject({
    count: z.number().int().min(1).max(60).default(7).describe('Spikes in the row'),
    height: z
      .union([z.number().min(0.01).max(0.5), z.array(z.number().min(0.01).max(0.5)).min(1).max(16)])
      .default(0.08)
      .describe('Height in torso lengths, as one number or a profile along the row'),
    width: z.number().min(0.005).max(0.2).default(0.025).describe('Base radius in torso lengths'),
    curve: z
      .number()
      .min(-90)
      .max(90)
      .default(20)
      .describe('Degrees each spike sweeps back toward the tail'),
  }),
  example: {
    id: 'dorsal',
    type: 'spikes.row',
    attach: { on: 'torso', from: 0.05, to: 0.95, angle: 0 },
    params: { count: 9, height: [0.08, 0.15, 0.06] },
  },
});
