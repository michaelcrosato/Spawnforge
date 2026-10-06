# Milestone 8.1 (muscle, joints and body shape): notes

The phase 4 run's 20 blueprints, rendered at `d101c06` (plan 1) and at each tuning round of 8.1,
shown blind in pairs (7.5's quality review). The renders are not committed (`prepare` makes them
again from the committed blueprints); each round's key, rubric, answers and score are. The
before sheets of the examples are in `before/`, beside their new renders in `examples/`.

## Rounds

| Folder | Head | Review | New | Old | Same | Reviewer picks (A / B / same) |
| --- | --- | --- | --- | --- | --- | --- |
| `quality-trial/` | design as first built | one order, 360 px | 10 | 5 | 5 | 3 / 12 / 5 |
| `quality-round1/` | `fd74be2` | one order, 360 px | 9 | 9 | 2 | 3 / 15 / 2 |
| `quality-round2/` | `df4fd15` | one order, 360 px | 9 | 6 | 5 | 0 / 15 / 5 |
| `quality-round3/` | `0d1acd8` | both orders, 360 px | 4 | 3 | 13 | 1 / 7 / 12 and 0 / 14 / 6 |
| `quality-round4/` | `06b2d11` | both orders, 640 px | 6 | 6 | 8 | 0 / 12 / 8 and 11 / 6 / 3 |
| `quality/` (final) | `9c9c8d5` | both orders, 640 px | **5** | **2** | **13** | 0 / 10 / 10 and 2 / 7 / 11 |

What each round changed is in the design's [Tuning](../../../docs/design/8.1-anatomy.md#tuning)
section.

## What the reviews showed

- **Reviewers lean toward side B.** Six of the seven reviewers picked B far more often than A,
  whichever side the new look was on (the key shuffles it). With one order a lean pulls any
  score toward an even split, so from round 3 the tool shows each pair in both orders to two
  reviewers and sums their votes (`eval/README.md`). Only one reviewer (round 4, swapped) hid the
  sides from itself; its picks were 11 / 6 / 3.
- **At 360 px the changes are a few pixels**, so from round 4 the views are 640 px.
- **Consistent complaints** (each fixed in the next round): balloon shoulders and hips on stocky
  legs; a sagging belly on upright bipeds; jagged mouths and parted tail tips where masses had
  moved the meshing grid; lumpy bellies, ball knees and club forearms; a low chest with stubby
  forelegs under it; sausage-like chitin segments.
- **Consistent praise**: fuller thighs and upper arms that taper into a distinct knee or elbow;
  the serpents' throat, which makes the head read apart from the neck.
- **Final round**: the new look wins the ram demon, the gecko, the hound and two of the three
  serpents (sea serpent, cobra), and loses the cave bear and the ant; every decided pair is one
  reviewer's vote with the other undecided. Of the 13 "same" pairs, 6 are votes that cancelled
  (one reviewer each way) and 7 had no pick from either: the beetle, the scorpion, the small
  lizards, the boar, the rhino and the green serpent change least.

## Gate

The milestone's bar was "the new look preferred in at least 16 of 20 pairs". After five rounds
the owner amended it to "more pairs than the old, with no fault the reviewers name consistently"
(plan 2, 8.1). The final round scores 5 to 2. Its reviewers name few faults in the new look: a faceted
outline on the ant's lower legs (one reviewer), forelegs pinched under the wolf's chest (one),
and pale creases where the long-neck's legs meet its body, which both reviewers saw. The last
is the crease shading at a limb's junction with the body, now on a fuller thigh; it is left for
gate 8's review to confirm or clear, alongside 8.4's materials, which read crease depth too.
Gate 8 reviews the look again after 8.2–8.4.

## Other checks

| Check | Bar | Result |
| --- | --- | --- |
| `muscle: 0` | Plan 1's mesh exactly | Every example matches the pre-8.1 fingerprints at low and medium (`golden-muscle0.json`) |
| What anatomy leaves alone | Meshed as before | The ridgeback's and the beetle's heads match muscle 0 vertex for vertex |
| Skin stretch | Within muscle 0's | 99th-percentile edge stretch over a walk and a turn within 10% of muscle 0 (ridgeback, troll) |
| Compile, Chrome, medium | ≤ 500 ms, skin ≤ 30k triangles | Medians of 15, final code (muscle 0 in brackets): troll 278 ms (272), beetle 337 (325), ridgeback 179 (180), viper 52 (54); skins 20.7k, 26.7k, 11.8k, 3.9k triangles |
| Fuzz, 1,000 blueprints | Runs clean | 976 valid, all compiled, no failures; median 315 ms in Node (266 before 8.1 on the same blueprints), p95 765 ms |
| `analyze` on the examples | No new warnings | None |
| Motion and harness tests | Pass | Pass |
