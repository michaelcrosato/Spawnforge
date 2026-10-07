# 10.5 Hits and death: notes

The milestone's "done when" (docs/design/10.5-hits-death.md), checked at the commit that adds
this folder; `death.test.ts` checks it on every example.

| Check | Bar | Result |
| --- | --- | --- |
| Every example dies on flat and rough ground from hits on either side | All 32 | All 32, each from the left and the right, on flat ground and on `testCourse` at a quarter of its hip height |
| Not into the ground | ≤ 3% of `scale`, skinned vertices | At most 1.3% (the reef shark's pectoral fin, the centaur's hooves); most under 1% |
| On the ground at rest | Lowest point within 3% of `scale` | All 32 |
| Cost | Walking and flying unchanged | 0.2 to 0.65 ms a frame while dying, for 1.3 to 2.2 s; nothing at rest |

- `deaths.png`: the last frame of each example's death on the uneven course, hit from the left
  (`strips/` has each one's four frames).
- `*.hit-and-die.png`: `examples/scenarios/hit-and-die.json` from the front: a blow, a heavy one
  that staggers it, and a death from the left.
