# Phase 1 render eval: notes

Format score: **20/20** valid within three fix rounds, all on the first attempt (`score.json`).
The agents used `render` to check their work and revised 16 of the 20 creatures after looking
(the later `attemptN` files), so most attempts are visual fixes rather than validation fixes.

Blind review: **20/20** renders matched to their prompts (`blind-score.json`), 17 with high
confidence and 3 (wolf, gecko, boar) with medium confidence, decided partly by elimination. The
gate is 16, and the 17 confident matches clear it on their own. The reviewer saw only the
anonymous sheets in `blind/` and the prompt list; its full critique is in `review-notes.md`.

Both gates pass.

## Feedback from the agents, and what changed

| Feedback | Action |
| --- | --- |
| Claws were thin and sank below the ground | `foot.claw` gained `clawWidth`; claws lean with their curve and stay above the ground |
| Detailed creatures went over the triangle budget | Meshes over budget are re-meshed on a coarser grid |
| The front view was tiny and the head too small to judge | Six-view sheet: per-view framing, a head close-up and a rear view |
| Labels overlapped | Labels stack in columns at the panel edges with leader lines |
| Legs were pale: back and belly patterns spread onto them | Limbs are a region of their own; back and belly masks leave them out |
| `grime` had no visible effect by default | Its default colour is now a visible dark brown |
| Scales looked like a square grid, then speckled in close-ups | Staggered rows, a 27-cell search, and relief that fades before it aliases |
| Arms could not reach forward | Limbs gained `lift` |
| Profiles with many values looked coarse | Bones follow the profile with one cone per span |
| Horn `angle` was confusing; big ram horns looked small | Documented the bending plane and recommended lengths |
| Mandibles were listed as unavailable while a recipe made them | Fixed the "not in this version" list; added an ear recipe |
| `attach.on` did not mention `spine` | Described in the schema and catalogue |
| No guide to real sizes | Sizes per body plan as multiples of `scale` in blueprint.md |
| "Body below ground" warnings did not say what to change | The warning names the section or limb and how to lift it |

## The blind reviewer's critique, and where it goes

| Problem | Where it goes |
| --- | --- |
| Head close-ups cropped some heads; "long" was misleading for upright creatures | Fixed: the close-up frames everything skinned to the head; upright sheets say tall · wide · deep |
| Heads are generic: no muzzle, nose or ears | Ear recipe now; head shapes are worth more variety, after the PoC gate |
| Limbs are plain tubes without joints, paws or hooves | Joint bulges and hooves are a "Later" item; `foot.claw` covers paws |
| Missing features: fur, fins, pincers, antennae, a cobra hood | Out of PoC scope (plan's "Later" column); hood is `crossSection: "wide"` on the neck |
| Materials: armour reads as crackle, fur as camouflage blotches | Armour plates and fur-like shells are in "Later"; patterns are tuned per creature |
| Serpents look alike apart from colour | Motion (phase 2) adds the S-curves; pose variety is phase 3 |
| Jaw edges stair-stepped, teeth sometimes float | Tracked for phase 4's plausibility checks (parts buried or floating) |
