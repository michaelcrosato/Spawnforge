import { colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'spots',
  summary: 'Scattered round spots, from leopard rosettes to sparse blotches.',
  tags: ['camouflage'],
  params: z.strictObject({
    color: colorRef('accent'),
    size: z.number().min(0.005).max(0.5).default(0.05).describe('Spot radius in torso lengths'),
    density: z.number().min(0).max(1).default(0.5).describe('Share of possible spots that appear'),
    jitter: z.number().min(0).max(1).default(0.8).describe('Irregularity of placement and size'),
    ring: z.number().min(0).max(1).default(0).describe('Hollow the spots into rings (rosettes)'),
  }),
  example: { type: 'spots', color: 'accent', size: 0.04, density: 0.6 },
});
