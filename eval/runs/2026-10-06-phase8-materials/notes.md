# Milestone 8.4: materials and pattern layers

Renders for the PR (docs/design/8.4-materials.md). The examples' own contact sheets
(`examples/*.png`, re-rendered) show each example before and after in the PR's file diff.

- `materials.png`: the same body (the tusk boar's) in each material, 3/4 and head views: `skin`
  (soft, light wrapping past the shadow edge), `hide` (a wrinkle network), `scales` (overlapping
  rows) and `chitin` (plates, seams and a clearcoat).
- `patterns-1.png`, `patterns-2.png`: each new layer alone over a countershade on a plain
  quadruped, 3/4 and head views: `scars` (`rake` 3), `warts`, `veins`, `slime`,
  `bioluminescence` as spots and as lines, `rosettes`, `bands`, and the denser default `spots`.
  Glow renders at time 0 (no pulse in stills).
- `fur.png`: the grey wolf with a 0.04 coat (the example has 0.028): 3/4, head and side views.

Checks:

- **Parity.** `packages/render/src/parity.test.ts`: two stacks that between them hold every
  pattern module, on each of the four materials, and every example. The GPU draws 2,048 skin
  vertices (1,024 for the examples) into a float target; at least 99% of samples agree with the
  CPU kit within 2/255. A spot check found the worst difference 5e-4.
- **Fur** adds one draw call at medium and high, none at low, and the baked level of detail
  hides it (`packages/three/src/fur.test.ts`).
- **Harness.** Every pattern module shades from its defaults and its example, within budget, the
  same twice.
- **Goldens** are unchanged: materials move no vertex. The render baselines are re-approved.

What did not work first, and what replaced it, is in the design doc's "Changes while building".
