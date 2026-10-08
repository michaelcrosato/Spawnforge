/**
 * Probe blueprints for the texture round trip (docs/design/11.1-textures.md, decision 13): each
 * makes one effect strong enough for its contribution to be scored on its own.
 */
export const PROBES = {
  /** Deep scales: the normal map's tilt, which a flipped channel or tangent sign reverses. */
  relief: {
    format: 'spawnforge/0.2',
    name: 'Relief Probe',
    seed: 11,
    extends: 'quadruped',
    skin: {
      palette: { base: '#9a9a90', accent: '#4a4a44' },
      material: 'scales',
      layers: [{ type: 'scales', size: 0.06, bump: 1, gap: 0.2 }],
    },
  },
  /** Wet slime on a matte hide: roughness that differs strongly across the body. */
  roughness: {
    format: 'spawnforge/0.2',
    name: 'Roughness Probe',
    seed: 12,
    extends: 'quadruped',
    skin: {
      palette: { base: '#7a6a58' },
      material: 'hide',
      layers: [{ type: 'slime', wetness: 1, drips: 0, tint: 0, region: 'back' }],
    },
  },
  /** Bright, steady glow: above 1, so clipping it shows. */
  glow: {
    format: 'spawnforge/0.2',
    name: 'Glow Probe',
    seed: 13,
    extends: 'quadruped',
    skin: {
      palette: { base: '#303438' },
      layers: [{ type: 'bioluminescence', size: 0.06, density: 0.9, brightness: 4, pulse: 0 }],
    },
  },
} as const;
