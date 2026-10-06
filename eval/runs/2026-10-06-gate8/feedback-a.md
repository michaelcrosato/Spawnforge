# Gate 8 feedback, agent A (p01 to p05)

I read only `docs/blueprint.md`, `docs/catalog.md` and `examples/*` (the JSON and the PNGs). I used
`validate`, `render` (contact sheet, head, filmstrip, bite filmstrip), `analyze` and `patch`.
Every PNG went to the scratchpad, never into the repository.

Bias to keep in mind: four of my five prompts have a near twin in `examples/` (grey-wolf,
ember-beetle, reed-viper, bog-troll). I adapted rather than copied (different proportions, ids and
colours), but the first-valid rate below is helped by having those files to read.

## Summary

| Prompt | Attempt files | First valid | Revisions after first valid (what drove them) | Final analyze warnings |
| --- | --- | --- | --- | --- |
| p01-wolf | attempt0 to attempt3 | attempt0 | 3 (all after a render; attempt2 also cleared a `limb_intersection`) | none |
| p02-spiked-lizard | attempt0 to attempt4 | attempt0 | 4 (2 visual, then 2 to clear `part_buried` and `limb_intersection`, which I introduced) | `not_built` only: `armor.bands`, `lash` (kept on purpose) |
| p03-horn-beetle | attempt0 to attempt2 | attempt0 | 2 (both visual) | `not_built` only: `antenna`, wing limb `elytra` and its `membrane.case` (kept on purpose) |
| p04-green-serpent | attempt0 to attempt3 | attempt0 | 3 (all visual) | none |
| p05-swamp-troll | attempt0 to attempt4 | attempt1 (attempt0 had 1 error) | 3 after the first valid (1 visual, 2 for `limb_intersection`) | none |

Finals: `p01-wolf.attempt3`, `p02-spiked-lizard.attempt4`, `p03-horn-beetle.attempt2`,
`p04-green-serpent.attempt3`, `p05-swamp-troll.attempt4`. All validate with 0 errors and 0 warnings.
Total validation errors hit in five prompts: one (p05 attempt0). Every other first draft validated
first time, so the format guide and catalogue are good enough to write valid JSON from.

## p01-wolf (grey fur, paler belly, long snout, bushy tail)

- Attempt0 was valid and already read as a wolf, but it was a stocky badger shape: short legs, deep
  head like an anteater, belly paleness barely visible. Revisions: longer legs (0.76 and 0.78),
  slimmer torso, darker base, tail radius profile `[0.08, 0.17, 0.14, 0.04]` (this is what makes the
  tail bushy), then head length 0.5 with radius 0.085 and `countershade` `height` 0.05, `softness` 0.15.
- `analyze` flagged `limb_intersection` foreleg vs torso (1.2 cm). The suggested fix (a few degrees
  more `splay`) worked here: `splay` 8 cleared it. Good.
- Scale: the docs say a wolf is about 0.7. I used 0.9 first and got 2.1 m long, 124 kg; 0.75 gave 1.8 m
  and 72 kg. `analyze` mass looks about double a real wolf, but I did not chase it.
- The bite filmstrip and the walk filmstrip (0 cm foot slide, 0.73 s cycle) looked right.
- Fur renders as speckle on the silhouette in the small contact-sheet panels, and the fur makes the
  palette look lighter than the hex values. Not a bug, but I darkened the base by eye to get grey.
- Docs gap: no recipe for a bushy tail. The radius profile with a swell in the middle works; worth one
  line in the recipe table.

## p02-spiked-lizard (heavy armoured lizard, spike row, club tail)

- Attempt0 validated. Renders showed three real problems: `crossSection: "wide"` on the torso made
  a 1.07 m wide toad blob; the head was swallowed by the body (neck 0.2 too short, head radius bigger
  than neck); the "club" was a ball on a thin stick. Fixes: round torso, neck 0.3, head radius 0.1,
  tail profile `[0.15, 0.12, 0.1, 0.1, 0.14, 0.24, 0.25, 0.08]`.
- `part_buried` on `brow-horns`: "only 3% of the part shows". The suggested fix ("make it longer or
  larger") barely helped: length 0.12 to 0.16 to 0.2 moved it from 6% to 3% to 5%. What cured it was
  direction: `aim: "up"` at `angle` 75. `aim: "back"` on the top of a wedge head runs the horn into the
  neck. The `part_buried` fix text should mention `aim` or angle.
- `limb_intersection` hindleg.L into hindleg.R (3.6 cm). The fix text says "about 10° more splay".
  I raised splay from 32 to 44 and the overlap stayed exactly 3.6 cm. It cleared only when I made the
  hindleg root thinner (`[0.11, 0.07]`) and lowered `attach.angle` 112 to 104. The same thing happened
  on the troll (see p05): for leg against leg, `splay` is not the lever, `attach.angle` and root radius
  are. For limb against torso (wolf) `splay` did work. Please make the fix text differ by case.
- The sprawled, heavy walk has a 0.42 s cycle and a 25 cm stride on 0.6 m legs, about 2.4 steps a
  second for a 600 kg animal. `lumbering` did not slow it, and nothing warned. It reads as a scurry in
  the filmstrip. A warning or a doc note on splay shortening stride would help.
- Armour: `armor.bands` (and `plates.row`, `shell`) are not built, so "armoured" is only the `scales`
  layer, spikes and `material: "scales"`. I kept `armor.bands` and the `lash` action in the file per the
  docs ("keep those features"); they show only as `not_built`. Fine, but the render does not show
  anything armoured beyond scales.
- Docs gap: no club-tail recipe (a radius profile that swells near the tip plus side spikes via
  `horn.curved` with `aim: "out"`); a spike row on `spine` worked first time.

## p03-horn-beetle (small, skittish, one big horn, glossy black, orange spots)

- Attempt0 validated; the hexapod, chitin material and `spots` on `region: "back"` gave a convincing
  glossy black beetle with orange spots straight away. Problems I fixed from the render: 47 cm long is
  not "small" (scale 0.3 to 0.18 gives 31 cm); the rear tapered to a point like a tick (last torso
  radius 0.07 to 0.1); the horn drooped forward and down.
- Horn: `lean` 40 with `curve` -50 hangs down. `lean` -5 with `curve` -65, then `length` 0.55,
  `width` 0.065 and `curve` -75 rises then arcs forward like a rhinoceros beetle. The only horn recipes in
  the docs are mammal ones (positive `curve`); a beetle recipe (nose horn, `angle` 0, `lean` about 0,
  `curve` about -70) would have saved a revision.
- Elytra: attempt0 used a `shell` part as a stand-in; attempt1 replaced it with a wing limb carrying
  `membrane.case`, which the docs describe. Both are not built, so nothing shows. `antenna` likewise. By the
  docs, a wing limb makes `air` the default medium while `fly` is not built; nothing in `analyze` said so
  either way, and I did not test it further.
- Tiny size: tripod cadence is 9.8 steps a second at scale 0.18, above the docs' 8-a-second jitter
  line, and `analyze` raised no `fast_cadence`. I assume the skittish temperament suppresses it (the
  docs say "make them bigger or, if they are meant to be that small, skittish"), but that sentence is
  ambiguous: does skittish silence the warning or just make the speed sensible?
- I limited `actions` to `idle` and `look`, so the description says "it can look" only. My choice, but
  a skittish beetle that can also bite would have matched an insect better; I did not notice until the end.
- Spots at `size` 0.06 read well on a 31 cm creature, consistent with the docs' advice to go bigger on
  small bodies.

## p04-green-serpent (giant, green, yellow stripes, long fangs)

- Attempt0 validated and looked right in kind, but it was only 4.9 m long and pencil thin, and the
  yellow outweighed the green. Fixes: `scale` 2.0 (6.3 m long, 1.1 m tall), torso radius up to 0.18,
  head up, tail shortened. Then `countershade` `height` -0.5 and stripes `region: "back"`, width 0.28,
  to make green dominant.
- Long fangs: `fangScale` 2.4 then 2.0 with `incisors` 0 and `lower: false`, as in the docs. They read
  as long, but they are wide, flat blades (no width or curve control), more like blunt tusks from the
  front. Only size is exposed.
- Stripes begin at the snout tip because `count` runs snout to tail tip, so the head wore a yellow
  mask. `region: "back"` did not remove it (the top of the head counts as back). I painted the head
  green with an extra `countershade` layer (`color: "base"`, `height` 1, `region: "head"`). It works,
  but it is a hack, and `analyze` then describes the skin as having "a green belly". A stripe `phase` or
  offset parameter, or a region that excludes the head, would be cleaner.
- `neck.curve` 30 with neck `pitch` 40 gave a good raised S without trouble. The slither filmstrip (top
  view) shows a clean wave; cycle 6.3 s at 0.66 m/s for a 6 m snake looks plausible.
- The mouth with `--jaw 0.8` looked good: forked tongue, dark throat, fangs visible.

## p05-swamp-troll (upright, long arms, flat head, two tusks, mottled green)

- The only validation error I hit: attempt0 put `"angle": 0` inside the `ear.pointed` `params`, because
  the recipe row says "`droop` 0.8 and `angle` 70 for hanging ears", which reads like a parameter. It is
  the attach `angle`. The error was `unknown_key ... expected one of length, width, thickness, curve,
  lean, droop, color, tipColor` with fix "remove it". The docs promise fixes like "move X into params",
  so here the fix could say "`angle` belongs in `attach`". I also suggest rewording the recipe row to say
  `attach.angle` 70.
- "Flat head": `head.shape: "flat"` alone gave a rounded dome (as in the bog-troll render). It looked flat
  and broad only once I added `crossSection: "wide"` and radius 0.16. The docs list `flat` as a shape
  but never say it needs the wide cross-section to read as flat.
- Tusks from the recipe (`horn.curved` on `jaw`, `at` 0.25, `angle` 60, `curve` -55, pale colours)
  worked first time and read as two tusks; from the top they look slightly like horns, fine.
- Mottle at the default contrast read as camouflage; contrast 0.35, a second smaller light-green mottle,
  warts on the back and grime on `material: "hide"` gave a swamp look. Palette names (`moss`) worked.
- `limb_intersection` leg.L into leg.R: 4.7 cm with radius `[0.14, 0.08]`, 1.7 cm after thinning to
  `[0.12, 0.075]`. `splay` 8 then 16 changed nothing (still 1.7 cm), exactly as with the lizard. Lowering
  `attach.angle` from the biped's 130 to 118 cleared it; so did thinner roots (checked in scratch copies
  outside the repository). The suggested "about 5° more splay" is misleading here.
- Walk filmstrip: 0.86 m/s, 1.18 s cycle, 1 m stride, 0 foot slide; the swing of the long arms looks okay.
- The description calls the tusks "curved horns on its jaw" and the pale olive belly (`#a9b078`) "a
  yellow belly". Small, but the description is what an agent reads to verify intent.

## General notes

- `validate` prints the whole minimal blueprint after the verdict, which buries `ok`, `errors` and
  `warnings` (over 100 lines for a small file). I filtered it with a small script; a `--quiet` or
  `--summary` flag would help agents.
- `patch` works well (id-based paths, `remove`, `add` to `limbs`) and prints a clear diff. It rewrites the
  file with one array element per line, so a file gets long. The docs say it writes only a valid
  result; for the one invalid file (p05 attempt0) I fixed a copy with `sed` and did not try `patch` on it.
- `render` takes 15 to 20 s per call (browser start-up), a filmstrip about 15 s. Acceptable, but it makes
  a six-call loop per revision slow.
- `--views head --jaw 0.8` is excellent for checking mouths and fangs; labels (`--labels`) made it easy to
  see where each part landed and to spot the buried horns.
- Not-built features (`armor.bands`, `antenna`, `membrane.case`, `lash`) validate and show under
  `notBuilt`, and `analyze` repeats them as warnings. That is consistent with the docs, but the renders
  do not show them, so I could not check placement of those parts.
