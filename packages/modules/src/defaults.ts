import type { PackDefaults } from '@spawnforge/core';

/** What the basic pack gives a blueprint that leaves these out. */
export default {
  foot: 'foot.claw',
  layers: [{ type: 'countershade' }],
  bodyPlan: 'quadruped',
} satisfies PackDefaults;
