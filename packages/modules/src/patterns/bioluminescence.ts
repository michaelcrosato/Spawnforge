import { colorName, colorRef, definePattern } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'bioluminescence',
  summary: 'Glowing spots or lines that light up in the dark and pulse slowly.',
  tags: ['glow', 'deep-sea'],
  planned: '8.4',
  params: z.strictObject({
    color: colorRef('#7fffd0').describe('Glow colour: a palette name or a colour'),
    shape: z
      .enum(['spots', 'lines'])
      .default('spots')
      .describe('"spots" scattered over the skin, or "lines" along the body'),
    size: z
      .number()
      .min(0.005)
      .max(0.3)
      .default(0.03)
      .describe('Spot radius or line width in torso lengths'),
    density: z.number().min(0).max(1).default(0.5).describe('Share of possible spots that glow'),
    brightness: z
      .number()
      .min(0)
      .max(4)
      .default(1.5)
      .describe('Emissive strength; 1 matches a lit surface'),
    pulse: z.number().min(0).max(2).default(0.3).describe('Pulses per second; 0 glows steadily'),
  }),
  example: { type: 'bioluminescence', color: '#60ffd0', shape: 'spots', size: 0.03, density: 0.6 },
  describe: (p) => `glowing ${colorName(p.color as string)} ${p.shape as string}`,
});
