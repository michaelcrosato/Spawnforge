# Phase 0 format eval: notes

Score: **20/20** valid within three fix rounds, all on the first attempt (see `score.json`). Gate
passed. The format is easy to get valid; the agents' doubts were about how blueprints will
*look*, which only renders (phase 1) and motion checks (phase 4) can answer.

## Feedback from the agents, and what changed

| Feedback | Action |
| --- | --- |
| `crossSection` documented for every section but only torso and head had it | Added `crossSection` to `neck` and `tail` |
| No way to curl only the end of a tail; unclear how `curl` combines with `pitch` | Added `tail.curlStart`; documented curl and pitch with recipes |
| "Spikes along the whole back" of a serpent needed three rows | Added the `spine` virtual section (neck → torso → tail) for rows |
| No way to make spike rows jagged | Added `spikes.row.jitter` |
| Only the iris colour of an eye could be set | Added `eye.basic.scleraColor` and `iris` size |
| Unclear how `stripes.count` relates to `region` | Documented: regions mask, patterns span the whole body |
| Unclear `countershade.height` direction | Documented: -1 belly, 0 flank, 1 spine |
| `material: "scales"` vs a `scales` layer | Documented the difference |
| The minimal blueprint looked like lost input | Documented that validation never changes the file |
| How to place legs on a horizontal biped (raptor) | Documented limb placement for upright and horizontal bodies |
| No "run" gait for bipeds | Documented that speed is chosen at run time and gaits scale with it |
| Horn `curve` sign, ram horns, tusks, mandibles: no recipes | Deferred to phase 1, where recipes can be checked against renders |
| No plausibility feedback (do legs reach the ground?) | Phase 1 (compile warnings) and phase 4 (`analyze`) |
