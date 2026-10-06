# Gate 8: notes

Phase 8 (anatomy, feet and hands, heads, materials) against the gate 8 row of plan 2's gate
thresholds. The suite A run and quality round 1 ran at `b9fd5c8` (8.4 merged). One fix followed
round 1 (below), and the blind review and quality round 2 ran with it.

## Results

| Check | Bar | Result |
| --- | --- | --- |
| Suite A, full run | ≥ 18/20 valid, ≥ 18/20 matched | **20/20 valid** (19 on the first try; `score.json`), **20/20 matched** blind (16 high confidence, 4 medium; `blind-score.json`) |
| Suite B, re-score | ≥ 18/20 | **20/20 valid, 20/20 meet `expects`**: 7.3's run (`2026-10-06-phase7-format`) validated again at this commit |
| Quality review | New preferred in ≥ 16/20 pairs | Round 1: 15/20 (2 old, 3 same). Round 2, after the fix: **20/20** (`quality/quality-score.json`) |
| Compile, Chrome, medium | ≤ 500 ms every example | Warm medians of five: boar 453 ms, beetle 436, troll 361, terror bird 363, wolf 266; the rest are under 300 in `pnpm budgets`' single sample |
| Fuzz | Median ≤ 400 ms | 976 valid of 1,000, all compiled, no failures; median 339 ms, p95 788 |
| Skin, medium | ≤ 30k triangles | Every example ≤ 27.3k |
| Draw calls | ≤ 3, plus one with fur | 3; the furred wolf 4 |
| Motion | ≤ 0.1 ms per creature; 50 ≤ 5 ms | 0.055–0.099 ms; 50 walking 3.46 ms |

Goldens are unchanged since 8.3: nothing in 8.4 or this gate moves a vertex. The example renders
are re-approved with the fix.

## The quality review

The phase 4 run's 20 blueprints at `d101c06` (plan 1) against this commit, both orders at 640 px,
two independent reviewers per round (eval/README.md).

- **Round 1** (`quality-round1/`): the new look won 15 pairs, lost 2 (the green serpent, the
  cobra) and tied 3 (the sprawl lizard, the long-neck, the rhino). All four reviewers named the
  same reasons for preferring the new side: lips and mouth lines, teeth in a row, eyelids,
  segmented chitin, and shaped thighs. They held one fault against it: black and white pixel
  speckle along the rims of 8.4's overlapping scales, on the head and neck of every scaled
  creature. Every pair the new look did not win was a scaled one, decided on that speckle.
- **The fix.** Bump mapping saw a step where one scale gave way to the next, and the thin dark
  rim lines aliased. The relief is now the highest of continuous caps, which has no step, and
  the darkening follows the height rather than thin lines. See the 8.4 design's "Changes while
  building".
- **Round 2** (`quality/`): fresh reviewers, the same pairs re-rendered. The new look won all 20,
  in both orders. Their remaining complaints about the new side: the long-neck's blocky chin, the
  sprawl lizard's chunky jaw, and pangolin-like scales on the rhino.

## Feedback, and where it goes

| Feedback (agents A–D, reviewers) | Where it goes |
| --- | --- |
| `limb_intersection` advice pointed the wrong way: splay never clears two legs of a pair, and a lower `attach.angle` can worsen a leg in a broad body | Fixed: the fix text now depends on what meets. For a leg in the body, splay first. For a pair meeting under the body, attach higher up or thinner legs. For fore against hind, stride and spacing. It names the leg's segment |
| `validate` prints the whole blueprint, burying the verdict | Fixed: `validate --quiet` |
| `body.muscle` missing from `catalog.md` | Fixed: a `body` table |
| Recipes missing or ambiguous: hanging ears, a flat head, a goblin's forward eyes, a club tail, a bushy tail, a beetle's nose horn, a tail-only colour; a rearing cobra's pale front | Fixed in blueprint.md's recipes, each checked against renders (the agents' values, or a render here) |
| `patch set` on an object replaces it | Documented |
| Big eyes said `size` in one place and `scale` in another | Fixed: `scale` (2–3 for cartoon eyes), with `size` still accepted |
| "About 0.0 kg" for a tiny lizard | Fixed: grams under 100 g |
| Default scales coarse and noisy on small heads | Fixed with the speckle (above); scale size per region is Later |
| Not-built features: `analyze` describes them as drawn, and folds them into warnings where `validate` keeps them apart | Later: one listing across commands |
| A sprawled heavy lizard scurries; skittish silences `fast_cadence`; no warning for a tail curled into the body | Later: cadence by mass, a tail-in-body check |
| Pincers, hoods, fins, antennae, mandibles not drawn yet (kept, as the docs ask) | 9.3–9.5 |
| Stripes always start at the snout; layer `region` takes one value | Later: a stripe phase, region lists for layers |
| `foot.paw` has no claw length; no gecko toe pads | Later |
| Fur reads as dither at the silhouette in small renders | Later: fur level of detail in 11.2 |
| Horn mandibles do not close with the jaw | 9.4 (`mandible`) |
| Hexapod filmstrips default to `walk`, not `tripod` | Later |

## Protocol notes

- Agent C edited attempt4 of p13 and p14 in place once more after checking it (the
  `limb_intersection` advice had misled it, and the four-revision cap left no attempt5). Both
  edited files are valid, and the score counts them as they stand.
- Agent B's directory listing showed other agents' file names, though it opened none.
- The scale fix landed while agents C and D were still working, so their last renders used it.
  It changes shading only, not validity.
