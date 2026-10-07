# Gate 9: notes

Phase 9 (several heads and tails, eight legs and centaurs, wings and fins, tentacles and parts
with bones, coverings, variation) against the gate 9 row of plan 2's gate thresholds: suite A's
and suite B's first full runs with renders, filmstrips, `analyze` and `patch`, each with a blind
review. Suite B's run is `eval/runs/2026-10-07-gate9-b/`. Both runs went at `a55560b` (9.6
merged, plus the budget fixes below); four agents per suite, five prompts each, working from
the docs, the examples and the CLI only.

## Results

| Check | Bar | Result |
| --- | --- | --- |
| Suite A, full run | ≥ 18/20 valid, ≥ 18/20 matched | **20/20 valid**, every one on the first try (`score.json`); **20/20 matched** blind, 18 high confidence and 2 medium (`blind-score.json`) |
| Suite B, full run | ≥ 18/20 valid, ≥ 18/20 meet `expects`, ≥ 16/20 matched | **20/20 valid** on the first try, **20/20 meet `expects`** (`../2026-10-07-gate9-b/score.json`); **20/20 matched** blind, all high confidence (`../2026-10-07-gate9-b/blind-score.json`) |
| Variation | 12/12 | **12/12**: 9.6's run (`2026-10-07-phase9-variation`) re-scored at this gate's commit with the same `variation-score.json` |
| Fuzz | Median ≤ 400 ms; no failures | 976 valid of 1,000, all compiled, no failures; median 338 ms, p95 764 (`fuzz.json`) |
| Compile, Chrome, medium | ≤ 500 ms every example | Every example, at most 437 ms (the rhino beetle) in the final run (`budgets.json`); cerberus and the hydra stayed under 500 in each of four runs |
| Skin, medium | ≤ 30k triangles | Every example ≤ 28.9k |
| Parts | ≤ 20k triangles | Every example ≤ 14.7k (the hydra; 21.5k before the fix below) |
| Draw calls | ≤ 3, plus fur and membranes | 3, plus one for fur and one for membranes where they have them (the bat, the griffin and the moth 5) |
| Motion | ≤ 0.1 ms per creature; 50 ≤ 5 ms | 0.017–0.097 ms (the ash dragon highest); 50 walking 3.3 ms |

Goldens change only for the hydra and cerberus, whose many teeth are built coarser (below); the
example renders are re-approved with it. The motion budget is noisy on this shared machine: a
run with three hung renders in the background put the griffin at 0.12 ms, and an idle one at
0.075; `budgets.json` is the final run, on an idle machine.

## Fixes made for the gate

Before the agents ran, `pnpm budgets` found the hydra's parts over budget (21.5k triangles: five
heads of teeth) and cerberus compiling in 647 ms in Chrome.

- Mouth parts know how many copies of themselves a creature carries (`ctx.copies`), and
  `teeth.row` builds each tooth with fewer segments when there are several heads: the hydra's
  parts fell to 14.7k.
- Eyelids looked for their eye's nearest vertices with a linear search per lid; the vertices are
  now sorted along x and searched in a window, with the same result. Cerberus compiles in about
  440 ms.
- `pnpm budgets` takes example names, and its Chrome figure is the median of three warm compiles,
  not one.

## Feedback, and where it goes

Eight agents and two blind reviewers (`feedback-*.md` here and in suite B's folder,
`review-notes.md` in both). No agent met a validation error it could not fix, and all forty first
attempts were valid; the revisions came from looking at renders and from `analyze`.

| Feedback | Where it goes |
| --- | --- |
| `analyze` prints about 150 lines, with the warnings and description last (four agents) | Fixed: they come first, and `analyze --summary` (MCP `summary`) keeps only them, the main sizes and the speeds |
| `unbalanced` gives no direction, and its "lean the torso less (pitch)" read backwards: an agent lowered the pitch and made it worse | Fixed: it says whether the body tips forward, backward or over, and the fix follows (for a biped tipping forward, "a higher torso pitch"; for a heavy tail, shorten it). A test checks each fix clears its warning |
| `patch` writes in place, though saved attempts must not change | Fixed: `patch --out` (MCP `out`) |
| `patch --help` printed the whole usage | Fixed: `<command> --help` prints that command's lines |
| A missing file said only ENOENT, with no hint where it looked (pnpm runs from the repository root) | Fixed: the error names the directory |
| Renders started in parallel timed out, and the timed-out processes hung | Fixed: the render page gets 90 s, a failure closes its browser and server, and the error says to run renders one after another |
| Every render made about 60 connections to Google through the proxy | Fixed: Chromium starts without background networking, updates, sync or metrics |
| Descriptions call tusks and stingers "curved horns" | Fixed: a horn on the jaw is a tusk, on the tail a stinger |
| Recipes: `armor.bands` from 0 flares at the neck; eyes on stalks come out as dots; a moth keeps its jaw (bite and roar); tusks on a flat head sit by the eyes; a fish needs no `media`; flat fins show only from above; no size guide for fliers; layer order hides earlier layers; near-black creatures lose their shape; `validate --quiet` undocumented | Fixed in blueprint.md, from the agents' working values |
| Not built: swimming and flying appear in `validate`'s `notBuilt` but the creature slithers and its description says so | 10.3 and 10.4 build them |
| `not_built` is a warning in `analyze` but kept apart by `validate` (said at gate 8 too) | Later: one listing across commands |
| `limb_intersection`: the amount ("about 5° more splay") repeats after partial fixes on broad bodies, and it reports one leg at a time | Later: an amount from the depth, every leg at once |
| One fur length for the whole coat (no longer tail or mane); no head plumage | Later: fur per region |
| No warning when a part (a shell) hides another (a spike row), a beak covers the eyes, or a tail folds into the body | Later: occlusion checks |
| `foot.paw` claws only `hidden`/`short`/`long`; no gecko toe pads; no flipper sweep or droop; no shell shape for a sea turtle; no mandible spread; ears do not size to the head | Later: module parameters |
| Default sheets hide folded wings; spread renders frame the span; the title gives no wingspan; labels crowd multi-headed creatures | Later: a spread panel and wingspan in the title |
| Black creatures render murky; no background or exposure option | Documented (above); later: a rim light |
| Reviewers: heads are the weakest part (pug, frog and knob heads, white cartoon eyes, zipper teeth); folded wings read as combs of sticks; coverings look stuck on; hydra necks are identical columns; plastic gloss on chitin | Later: a quality round on heads and wings before release 0.2 |

## Protocol notes

- Two suite B agents saw other agents' file names in the shared folder (and one validated two of
  them by glob), but opened none. One suite A agent edited no saved attempt but tested patches
  with `analyze` on unsaved copies in its scratch folder.
- Three of agent D's renders hung after timing out in parallel; they kept running in the
  background until this gate's budget run, which is why its first motion figures were re-measured.
