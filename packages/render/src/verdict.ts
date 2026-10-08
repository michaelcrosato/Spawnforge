import type { RoundTripResponse } from './protocol.ts';

/**
 * The bars a texture round trip must meet (docs/design/11.1-textures.md, decision 13): every
 * view's silhouettes overlap, its shading agrees within them, and a probe's effect has the same
 * shape (correlation, averaged over the probe's views) and size (ratio, each view) on both sides.
 */
export const ROUND_TRIP_BARS = {
  overlap: 0.99,
  mean: 0.035,
  off: 0.05,
  correlation: 0.7,
  ratio: [0.7, 1.4],
} as const;

export interface RoundTripVerdict {
  readonly pass: boolean;
  /** Views that missed a bar, with or without the tangents. */
  readonly failed: readonly string[];
  /** The probe's mean correlation, and whether every view's ratio was in range. */
  readonly correlation?: number;
  readonly ratioOk?: boolean;
}

export function roundTripVerdict(r: RoundTripResponse): RoundTripVerdict {
  const bars = ROUND_TRIP_BARS;
  const failed = [
    ...r.views.filter((v) => v.overlap < bars.overlap || v.mean > bars.mean || v.off > bars.off),
    ...(r.withoutTangents ?? [])
      .filter((v) => v.overlap < bars.overlap || v.mean > bars.mean || v.off > bars.off)
      .map((v) => ({ ...v, view: `${v.view} (no tangents)` })),
  ].map((v) => v.view);
  if (!r.probe) return { pass: failed.length === 0, failed };
  const views = r.probe.views;
  const correlation = views.reduce((s, v) => s + v.correlation, 0) / Math.max(1, views.length);
  const ratioOk = views.every((v) => v.ratio >= bars.ratio[0] && v.ratio <= bars.ratio[1]);
  return {
    pass: failed.length === 0 && correlation >= bars.correlation && ratioOk,
    failed,
    correlation: Number(correlation.toFixed(3)),
    ratioOk,
  };
}
