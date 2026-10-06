import { colorRef, definePart } from '@spawnforge/core';
import { z } from 'zod';

export default definePart({
  id: 'sail',
  summary: 'A tall sail of skin stretched over long spines along the back, like a dimetrodon.',
  tags: ['back', 'display', 'reptile'],
  planned: '9.5',
  slot: 'row',
  material: 'skin',
  attach: { on: 'spine', from: 0.25, to: 0.6, angle: 0 },
  provides: ['display'],
  params: z.strictObject({
    height: z
      .union([z.number().min(0.02).max(1), z.array(z.number().min(0.02).max(1)).min(1).max(16)])
      .default([0.1, 0.4, 0.1])
      .describe('Height in torso lengths, as one number or a profile along the sail'),
    spines: z.number().int().min(3).max(40).default(12).describe('Spines holding the sail'),
    color: colorRef('accent').describe('Membrane colour: a palette name or a colour'),
    spineColor: colorRef('base').describe('Spine colour'),
  }),
  example: {
    id: 'sail',
    type: 'sail',
    attach: { on: 'spine', from: 0.25, to: 0.6 },
    params: { height: [0.1, 0.45, 0.1] },
  },
  describe: () => 'a sail along its back',
});
