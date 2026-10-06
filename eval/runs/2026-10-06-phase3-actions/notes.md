# Phase 3 actions eval: notes

Run on commit `a9d297b` (the phase 3 PR before this eval was added). Agents had contact sheets,
gait filmstrips and the new action filmstrips (`render --filmstrip --action bite`).

Format score: **20/20** valid within three fix rounds, **all 20 on the first attempt**
(`score.json`). Agents revised every creature 1 to 3 times after looking at renders and
filmstrips.

Motion: footfalls clean in every gait (lateral walk, trot, tripods, slither); planted feet slid
at most a few millimetres.

Blind review: **20/20** renders matched (`blind-score.json`), 16 with high confidence and 4
(sprawl lizard, gecko, wolf, troll) with medium confidence. The shuffle is now seeded by a hash
of the run name, so this run's order differs from the earlier ones. Gate 16: passes.

Both gates pass.

## Feedback, and where it goes

| Feedback | Where it goes |
| --- | --- |
| Action filmstrips: serpents drawn from above, heads tiny, `look` shows nothing | Phase 4: action strips default to a 3/4 close-up of head and neck, and `look` aims to one side |
| `--view` undocumented; no front view for leg stance | Phase 4: documented, and `--view front` added |
| Bipeds and long-legged quadrupeds stand crouched | Phase 4: three- and four-segment legs stand straighter |
| `below_ground` on a legless torso said "lengthen the legs" | Phase 4: tells legless bodies to lower the torso pitch |
| Mandible recipe fails on a big head; ram horns differ on a biped's head | Phase 4: recipes give the big-head and biped variants |
| A rearing cobra needs torso and tail pitch kept low | Phase 4: cobra recipe |
| `len` was corrected to `lean`, not `length` | Phase 4: abbreviations win over one-letter typos |
| Ears only as horns | Phase 4: `ear.pointed`, a new part module written as one file |
| Bite barely lunges on short necks | Documented: the lunge comes from the neck; short necks mostly snap |
| Spots vanish in small filmstrip frames | Documented with the other pattern-size advice |
| A curled tail shows a pale tip | Documented: countershade follows the tail's underside |
| Duty can't change with speed; a second `walk` entry is ignored | Later: per-speed gait settings |
| A neck bends only at its base (no S-curve) | Later: a neck curve parameter |
| No fur, paws, hooves, broad toe pads, antennae, pincers | Outside the PoC scope (plan's "Later" column) |

The blind reviewer's critique (`review-notes.md`) is in line with earlier runs: plain limbs and
extremities, generic heads and eyes, one surface look, and long creatures small in the 3/4 views.
