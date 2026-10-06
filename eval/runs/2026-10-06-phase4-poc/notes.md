# Phase 4 proof-of-concept gate: notes

Run on commit `70c0cc5` (the phase 4 PR before this eval was added). Agents had everything from
phase 3 plus `analyze` (measurements, motion checks on flat and rough ground, plausibility
warnings, a description) and `patch` (edits by id-based path with a diff).

Format score: **20/20** valid within three fix rounds, **19 on the first attempt** (`score.json`).
The one first-attempt error was `body.head.shape: "wide"`, the agent mixing it up with
`crossSection`. Agents revised every creature 1 to 4 times after renders, filmstrips and
`analyze`, almost always with `patch` (6 to 14 operations per revision). All four agents found
`patch` faster than editing by hand.

Blind review: **20/20** renders matched (`blind-score.json`), 19 with high confidence and 1 (the
gecko, against the sprawl lizard) with medium confidence. Gate 16: passes.

Both gates pass, and so does the proof of concept (see [docs/poc.md](../../../docs/poc.md)).

p06's attempt4 is an exact copy of attempt2 (the agent reverted a horn experiment), so the blind
render of p06 is attempt2's creature.

## Feedback, and where it goes

| Feedback | Where it goes |
| --- | --- |
| `--view front` documented for filmstrips but rejected by the CLI | Fixed |
| `patch remove` on an added part left `{ "id": …, "remove": true }` and a warning | Fixed: only preset items get a remove marker |
| `skin.layers[type=mottle]` fails; the error drops the path and has no fix; `[1]` and `[id=x]` undocumented | Fixed: `[type=x]` addresses layers, gaits and actions; path errors keep the path and say which forms work; documented |
| Wrong ids in `patch` get no suggestion | Fixed: "did you mean" over the list's ids |
| `scale` takes `by`, never documented | Documented, and the op error lists each op's fields |
| `stability.supported: false` with no warning (bipeds) | Fixed: `unbalanced` whenever the centre of mass is outside the feet, with biped-specific fixes; toes count toward the support area |
| Colours named by lightness: slate grey "teal", olive "tan", brown "charcoal", gold "orange"; "a orange belly" | Fixed: colour names by hue, saturation and lightness; articles corrected |
| Description repeats clauses per layer, says "horns" for one horn, misses proportions | Fixed: repeated layers said once, parts counted (`×2`), single horns and ears singular, and words for broad or deep bodies, short, long or sprawling legs, big or small heads, horizontal bipeds |
| `limb_intersection` fix gives no amount and never mentions stride | Fixed: the fix gives the overlap and a splay amount and mentions `stride` and `stepHeight` |
| `ground_penetration` tells a legless serpent to lengthen its legs | Fixed |
| A biped can't run faster than about 2 m/s; the cap is undocumented | Documented (walk Froude ≤ 0.5, `speed.max`); running and galloping stay in the plan's Later column |
| Contact sheet options only in CLI help; patterns vanish on small creatures | Documented, with the views and size to check small creatures |
| Cobra recipe pitches sink the body; hood needs a radius profile | Recipe corrected |
| No underside view to check a pale belly | Later: an underside panel |
| Fast stepping on tiny creatures (9–13 steps/s) is not flagged | Later: a cadence check in `analyze` |
| `"wide"` for `head.shape` suggested `"wedge"` rather than `crossSection` | Later: suggestions across sibling fields |
| Horn `lean`, `curve` and `turn` hard to predict for forward mandibles | Later: an aim direction for horns; the recipes cover the common cases |
| Fangs on a giant serpent read as planks | Later: fang shape scaled to head size |
| Fur, paws, hooves, toe pads, pincers, fins, hoods, wing cases | Outside the PoC scope (plan's "Later" column) |

The blind reviewer's critique (`review-notes.md`) repeats the earlier runs: tube-like bodies and
limbs without muscle masses or joints, generic extremities (no hooves, paws or toe pads), one
surface look for skin, hide and chitin, and large, glossy eyes. These are the plan's "Later"
items (muscle masses, more part types, texture baking), not PoC requirements.
