# Phase 2 motion eval: notes

Run on commit `36b4502` (the phase 2 PR before this eval was added), with the CLI's new
`render --filmstrip` alongside the contact sheets.

Format score: **20/20** valid within three fix rounds, 19 on the first attempt (`score.json`).
The one error was `head.shape: "wide"` (meant `crossSection`), fixed from its `did you mean
"wedge"?` hint. Agents used renders and filmstrips to revise every creature, 1 to 3 times each.

Motion: every gait the agents tried had a clean footfall pattern (lateral-sequence walk,
diagonal trot, alternating tripods) and planted feet stayed put (`footSlide` 1e-9 to 5e-3 m).

Blind review: **20/20** renders matched (`blind-score.json`), 16 with high confidence and 4
(wolf, gecko, sprawl lizard, boar) with medium confidence. Gate 16: passes on confident matches
alone. Caveat: the shuffle seed depended only on the run folder name's length, which equals the
phase 1 run's, so the images came in the same order as in phase 1. The reviewer was a fresh agent
that saw only this run's images and the prompt list, never a key, so the result holds; the seed
now hashes the folder name.

Both gates pass.

## Feedback, and where it goes

| Feedback | Where it goes |
| --- | --- |
| Bipeds stand and walk in a deep crouch | Phase 3: upright bipeds stand nearly straight-legged and use more of their reach |
| Sprawled bodies look rigid from above | Phase 3: the side-to-side wave carries on into the tail |
| Serpent filmstrips need `--view top` | Phase 3: legless creatures default to the top view |
| A curled scorpion tail straightens at speed | Phase 3: tail springs pull toward the rest shape (they pulled toward their last position) |
| `stride` seemed to do nothing | It is capped by how far a foot can travel within its leg's reach; documented in phase 3 |
| No way to run on two legs | Documented: `duty` below 0.5 (e.g. a raptor's `walk` with `duty` 0.4) |
| `--gait` on a gait the creature lacks crashed the CLI | Phase 3: a JSON error naming the gaits it has |
| `footSlide` had no unit or threshold | Documented: metres; above a centimetre or two is visible |
| `attach.on: "snout"` got no fix | Phase 3: snout, muzzle, mouth, back, chest and similar names point to the right section |
| "All problems are reported at once" is not always true | The docs now say some mistakes hide the checks that depend on them |
| Ram horn recipe lies over the skull | Phase 3: recipe re-checked against renders; `curve` now goes to ±540 for full coils |
| Scorpion tail recipe gave no length | Phase 3: recipe gives the length |
| Spots on small creatures vanish | Documented for every pattern, not just scales |
| Eye size for "big eyes", sprawler leg angles, rearing necks | Documented in the motion section's limits paragraph |
| Short-legged probe got no warning | Phase 4: `analyze` plausibility checks |
| Fur, hooves, pincers, antennae, a cobra hood, aquatic fins | Outside the PoC scope (plan's "Later" column); hood is `crossSection: "wide"` on the neck |

The blind reviewer's critique (`review-notes.md`) repeats phase 1's: generic heads, one surface
look for everything, tube limbs, and long creatures small in the 3/4 panels.
