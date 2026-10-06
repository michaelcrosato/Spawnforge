import { cells, colorRef, definePattern, detail, relief } from '@spawnforge/core';
import { z } from 'zod';

export default definePattern({
  id: 'scales',
  summary: 'Overlapping scales as bump and darker gaps between them.',
  tags: ['texture', 'reptile'],
  params: z.strictObject({
    size: z.number().min(0.005).max(0.2).default(0.02).describe('Scale size in torso lengths'),
    bump: z.number().min(0).max(1).default(0.4).describe('Depth of the scale relief'),
    gapColor: colorRef('accent').describe(
      'Colour in the gaps between scales: a palette name or a colour',
    ),
    gap: z.number().min(0).max(1).default(0.3).describe('How dark and wide the gaps are'),
  }),
  example: { type: 'scales', size: 0.02, bump: 0.4 },
  hooks: {
    shade(k, s, p, seed) {
      const size = p.size as number;
      const f = k.num(1 / size);
      const c = cells(
        k,
        k.mul(s.x, f),
        k.mul(s.y, f),
        k.add(k.mul(s.z, f), k.num(seed)),
        0.7,
        seed,
        { stagger: true, reach: 3 },
      );
      const edge = k.sub(c.second, c.distance);
      const gapWidth = 0.04 + (p.gap as number) * 0.1;
      const gap = k.sub(k.num(1), k.smoothstep(k.num(0), k.num(gapWidth), edge));
      // Each scale domes up from its edges. Gaps fade out where scales shrink below a few
      // pixels, and the relief sooner, since bump mapping needs more pixels to look smooth.
      const dome = k.smoothstep(k.num(0), k.num(0.6), edge);
      return {
        mask: k.mul(k.mul(gap, k.num(0.2 + (p.gap as number) * 0.5)), detail(k, s, size)),
        color: p.gapColor as string,
        height: k.mul(k.mul(dome, k.num((p.bump as number) * size * 0.3)), relief(k, s, size)),
      };
    },
  },
});
