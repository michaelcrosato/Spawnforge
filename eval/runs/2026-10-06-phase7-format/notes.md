# Phase 7 format eval (milestone 7.3): notes

Suite B at format 0.2, written from `docs/blueprint.md`, `docs/catalog.md` and the examples, with
`validate`, `list-modules` and `describe-module` only (most of the new vocabulary is not drawn
yet, so there were no renders). Four agents, five prompts each, no shared context.

- **Suite B:** **20/20** valid within three fix rounds (19 on the first try) and **20/20** meet
  their `expects` (see `score.json`). Gate: ≥ 18 each, passed. The one failed first try was the
  griffin, which listed `display` for its wings; the catalogue's own summary of `display` said it
  "spreads wings", which was wrong (fixed below).
- **Suite A re-score:** the 20 phase 0 attempts, validated at this commit through the 0.1 → 0.2
  migration, score **20/20** (`node eval/score.ts eval/runs/2026-10-06-phase0-format`). Gate:
  20/20, passed.
- The reference blueprints for suite B (written while designing `expects`) also scored 20/20, so
  every check is satisfiable.

Valid is a weak check here: most of what the agents wrote (wings, fins, tentacles, fur, the new
feet, shells) is listed under `notBuilt`, so what is drawn today is much plainer than the
blueprints. Gate 9 runs suite B again with renders and a blind review.

## Feedback from the agents, and what changed

Every point at least two agents raised is fixed; single points are fixed where cheap or moved to
plan 2's "Later" column.

| Feedback | Agents | Action |
| --- | --- | --- |
| "What is built so far" reads as a list of what exists; nothing says which milestones are done | A, B, C, D | Renamed "Not drawn yet"; it now says what is drawn today and that every row is not drawn yet; the catalogue opens with an index marking each stub's milestone |
| `membrane.*` catalogue entries say "Add to parts" | A, D | The usage line now says a membrane is set as a wing's or fin's `membrane`, not in `parts` |
| `skin.fur` and `motion.media` say "object (below)" with no table | A, D | Both get their own tables in the catalogue; the guide gives fur's ranges and defaults |
| `notBuilt` lists fields never written (a stance from the foot, swimming from fins, flying from wings) | A, B, C, D | `notBuilt` lists implied stances and media only when the blueprint writes them; the foot, fin or wing that implies them is listed anyway |
| `display` says it spreads wings but needs a frill, hood, quills or sail; the fix pointed at `list_modules`, which had no `provides` | C, D | Summary corrected; the `missing_feature` fix now names the modules that provide the need; `list-modules`, `describe-module` and the catalogue show `provides`; the guide states the rule |
| A tentacle used as an eye stalk turns a slug into a swimmer | D | Only fins and tentacles on the torso imply water; a slug recipe with stalked eyes added |
| A part on an unbuilt limb (eyes on a stalk) vanishes without a word | D | `notBuilt` lists it, naming its host |
| Shark and centaur recipes do not name the preset ids to override | B | Recipes name `dorsal`, `tailfin`, `pectoral`, `foreleg`, `hindleg` and `arm` |
| No sizing for fish, octopod, centaur or wyvern | B, C | Sizing line covers them (measured with `analyze` at `scale` 1) |
| Bat recipe keeps the wyvern's long neck, tail and legs | A | A bat recipe with bat proportions, checked with `validate`; a `bat` preset goes to Later |
| Stinger recipe has no size | A | `length` 0.14 and `width` 0.025 added; a stinger that continues the tail goes to Later |
| Moth recipe does not say the wing pairs need their own ids and places | D | Recipe names `forewing` at 0.15 and `hindwing` at 0.3 |
| Which head is main with an even count | A | Documented (the extra head goes right) |
| How `spine` fractions map onto the body | C | Documented: by length through neck, torso and tail, with a worked example; `on: "torso"` for the torso alone |
| Row counts with `side` "both" or `alternate` | C | Documented and in the parameter descriptions: per row for spike rows, in all for plates |
| Tentacle `curl` direction; where `at` 0.9 puts tentacles | B | Positive curls toward the belly (format and 9.4's plan); torso tentacles trail, head tentacles ring the mouth |
| Does `torso` include the neck; does `limbs` include wing arms; fur on membranes; fur colour | A, B, D | Documented: the neck is `torso`, wing arms are `limbs`, fur never grows on membranes and takes the skin's colours (recorded in 8.4's plan) |
| Scars on one region land mostly elsewhere | C | Documented: raise `count` by the region's share |
| "Legs are tubes without hooves" contradicts `foot.hoof` | C | Rewritten: feet are claws or stumps until 8.2 |
| The hexapod's summary mentions a chitin shell part | B | Summary says chitin skin |
| "a unguligrade stance" | B | Article fixed |
| Turtle recipe adds a redundant `media.water` | C | Removed; the recipe says fins without legs make a swimmer |
| `list-modules`'s `planned` field is undocumented | C | Documented in the guide and the catalogue index |
| Per-neck lengths, a heaviness knob beyond `muscle`, fur colour and length per region, tints for a region or tip, finer regions, glowing eyes, several tooth rows, fin tip colours, a ring frill, a crawl gait, burrowing, curling up, rearing to run, resting wing poses | A, B, C, D | Plan 2's "Later" column |
| How layers composite over membranes; aim with curve on horns; a frill's shape; how flat a flipper is | C, D | Left for the milestones that draw them (8.4, 9.3, 9.5), whose renders answer them; noted here |

## What worked

- The recipe tables mapped onto every prompt, which is why 19 of 20 passed first time.
- Error messages gave exact ranges and "did you mean" fixes in the agents' probes, and
  `heads_overlap` gave a usable `spread`.
- `notBuilt` was understood as intended: every agent kept every listed feature.
