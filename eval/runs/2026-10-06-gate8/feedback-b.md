# Gate 8 feedback, agent B (prompts p06 to p10)

Method: read `docs/blueprint.md`, `docs/catalog.md` and the examples, wrote each attempt0 from the
docs alone, then validated, rendered (contact sheet with `--labels`, head view, filmstrip),
analysed and revised. Every revision is its own `attemptN` file. I used `patch` for every revision.

| Prompt | Attempt files | First valid | Visual revisions | Final analyze warnings |
| --- | --- | --- | --- | --- |
| p06-ram-demon | attempt0 to attempt4 | attempt0 | 4 | 1: `limb_intersection` (leg.L passes 3.2 cm into leg.R) |
| p07-sprawl-lizard | attempt0 to attempt2 | attempt0 | 2 | none |
| p08-boar | attempt0 to attempt4 | attempt0 | 4 | 1: `limb_intersection` (hindleg.L passes 3.5 cm into torso) |
| p09-long-neck | attempt0 to attempt4 | attempt0 | 4 | none |
| p10-scorpion | attempt0 to attempt3 | attempt0 | 3 | none |

All five attempt0 files validated with zero errors and zero warnings, so the docs (the quick start,
the recipe table, the preset listings in the catalogue) were enough to write valid blueprints. Every
final attempt is valid with no errors. The visual quality problems were all found by rendering, never
by `validate`.

## p06-ram-demon (final: attempt4)

- Errors: none.
- First render (biped preset, `scale` 0.85): a 2.2 m creature only 52 cm wide, which read as a
  striped pillar with a tiny head. The preset's proportions are not "demonic". Fixes that worked:
  torso radius `[0.2, 0.28, 0.24, 0.2]`, neck radius `[0.1, 0.14]`, head radius 0.16 with `brow`
  0.7, thicker and longer legs and arms, `eye.basic` `scale` 1.6 with `pupil: goat`, cloven hooves,
  `hand.grasp`, `teeth.row` with `fangScale` 1.5.
- Horns: the biped recipe in the docs (`at` 0.6, `angle` 85, `turn` -70, `lean` 10, `curve` 400,
  `ridges` 12) gave big coiled horns at once. I then tried the general ram recipe (`at` 0.8, `angle`
  40, `turn` -35, `lean` -10) on this head in attempt2: both horns collapsed into one lump on top of
  the skull. So the docs are right that an upright head needs the other recipe, but nothing says
  why, and it cost me a revision to confirm. Even the good recipe makes loops that rise above the
  head and meet behind it (visible in the top view) instead of a ram's spirals curling down beside
  the cheeks. It reads as "big curled horns", not strictly "ram horns".
- Stripes: one `stripes` layer put a big black smear over the snout (the head looked masked). There
  is no way to say "everywhere except the head" in one layer, because `region` takes a single value
  on layers (`fur.region` takes a list). I used two layers, `region: torso` and `region: limbs`. A
  list on layers would be simpler. `count` 14 across the snout-to-tail length gave very dense stripes
  on a tailless biped (they cluster on the torso); 9 with `width` 0.4 read as bold stripes.
- Analyze: `limb_intersection` (leg.L into leg.R) appeared after I thickened the legs (1.1 cm, then
  3.2 cm). The fix said "about 10° more splay". Going from `splay` 6 to 16 (and adding `muscle` 0.8)
  left it at exactly 3.2 cm, so that fix did not work here. The cause is probably both legs attached
  at `angle` 130 near the belly; the suggestion should mention `attach.angle`, or the check should say
  where along the leg they overlap. I ran out of revisions with this warning still present.
- Description: "a broad, flat body" for what is a barrel torso (it comes from the preset's `wide`
  cross-section), and "a red belly" for `#d8604a`. `parts` lists `eyes` with `count: 1` for a pair.
- Filmstrip walk was clean (no foot slide, duty 0.62).

## p07-sprawl-lizard (final: attempt2)

- Errors: none. attempt0 (quadruped, `scale` 0.1, legs `splay` 60, attach `angle` 115, 2.4 torso
  lengths of tail, spots on the back) was already a good lizard at `--quality high --size 900`.
- Analyze at attempt0: one `foot_slide` of 0.2 cm on foreleg. That is small in metres but the stride
  is only 1.8 cm, so it is more than 10 per cent of a step. The fix ("lengthen the leg or move it so
  the foot sits under the hip") was right: legs 0.5 and 0.55 with `scale` 0.08 cleared it.
- `cadence` showed 12 to 16 steps a second per foot (cycle 0.07 s) with no `fast_cadence` warning.
  The docs explain this: `skittish` silences it for creatures this small. It is a bit odd that
  choosing a temperament is the way to quiet a warning, but it is documented.
- Tail `curl` 20 on `pitch` -5 made the tail point up, which the front view showed as a spike above
  the head. Net direction is pitch plus curl (the docs say so, but it is easy to forget). `curl` 0
  and `length` 3.0 lay the tail along the ground like a lizard's.
- Description says "about 0.0 kg" for a 0.05 kg creature (rounding in the text; `mass` itself is
  right).
- `tongue: forked` is set, but in the `--jaw 0.8` head render the tongue looked broad and flat; I
  could not see a fork.
- Filmstrip with `--view front` framed the whole long tail, so the lizard is a few pixels wide. The
  strip spans 0.07 s, so frames look identical. A filmstrip that frames the legs, or slows a cycle
  that short, would help for tiny creatures.
- Head `shape` snout vs wedge made almost no visible difference at this size.

## p08-boar (final: attempt4)

- Errors: none.
- attempt0 followed `examples/tusk-boar.json`. It looked like a furry blob (a wombat or hippo): the
  head merged into the body and the short legs were hidden. What helped: a shoulder hump through the
  torso radius profile (`[0.22, 0.3, 0.25, 0.18]`), a larger head with `length` 0.55, fur only on
  `["torso", "limbs", "tail"]` so the head stays bare hide with wrinkles and the tusks stand out,
  and a dark `spikes.row` bristle crest (the `spine` row works well). The `fur.region` list is a
  good feature. Full-body fur made form hard to judge.
- Tail trap: `pitch` 55 plus `curl` 100 curls the tail back into the rump, so it vanished from every
  view and neither `validate` nor `analyze` said anything. `pitch` 25 with `curl` 80 gave a tiny
  visible curl. A "tail ends inside the body" warning would catch this; the part-buried check seems
  to cover parts only.
- Analyze limb warnings seesawed: foreleg 5.2 cm into the torso (fixed by lowering `attach.angle`
  96 to 85 to 80), then hindleg 4.4 cm (4.2 and 3.5 cm after more changes). More splay (28) cleared
  it, but the description then called a boar's legs "sprawling", so I went back. I ended with
  hindleg `angle` 80, `splay` 24 and a 3.5 cm warning. Each change moved the warning somewhere else,
  so a short table of every pair that intersects (not just the worst) would speed this up.
- Description: tusks called "curved horns on its jaw"; belly `#8a7460` called "an orange belly".
- Filmstrip walk was clean; lumbering pace suits it.

## p09-long-neck (final: attempt4)

- Errors: none. Quadruped, `neck` length 1.3 (`pitch` 70, `curve` 20, 6 segments), legs 1.1, tail
  0.9, `foot.hoof` cloven, `scales` material, a forked tongue, short `horn.curved` ossicones, and
  `spots`. The result is a 3.5 m long, 3.1 m tall giraffe-lizard that reads correctly. `neck.curve`
  and the neck radius profile worked as documented.
- Thickening torso, neck and legs after the first render improved it a lot (the first version had a
  stick neck and a skinny torso).
- Analyze: `limb_intersection` between foreleg.L and hindleg.L on the same side (3.9 cm, then 10.1
  cm when I lowered attach `angle` to 95 and used `splay` 6). Long legs with a stride about equal to
  the fore-to-hind spacing is the cause. `stride` 0.7 on walk and trot only cut the filmstrip stride
  from 1.32 m to 1.14 m (8.3 cm warning remained), so it is not a plain multiplier. What cleared it
  was different lateral planes: foreleg `splay` 14, hindleg `splay` 0. The fix text offers four
  options but does not say which works for same-side legs, and "about 15° more splay" has to go on
  one pair only.
- Pattern: `spots` gives leopard-like round spots. A giraffe's polygonal patches have no direct
  pattern; `mottle` or large spots are the nearest. Fine for this prompt but worth noting.
- The head view at default size crops tightly; `--views head` is great for faces but I needed the
  3/4 and side views to judge the neck.

## p10-scorpion (final: attempt3)

- Errors: none. The `hexapod` preset plus the documented tail recipe (`length` 2.4, `pitch` 40,
  `curl` 200 on a short torso), a stinger `horn.curved` at `at` 0.97, and pale `chitin` gave a
  clearly recognisable scorpion silhouette on the first try. This was the best first render of my
  five.
- Pincers are not built, so there are no claws. I tried the documented recipe (an `arm` with
  `foot: hand.pincer`, `lift` 90, plus the `pinch` action) in attempt2. `validate` reported both
  under `notBuilt` with a clear message, but the render drew two plain thick arms with nothing at
  the tip. Next to six legs they look like two extra legs, which contradicts the prompt ("six legs").
  I removed them in attempt3. The docs say "keep those features", yet here keeping them makes the
  creature visibly worse; guidance on what to do when a not-built part's host is drawn alone would
  help (or draw such a limb as hidden until its foot exists).
- The seven-value tail `radius` profile (telson bulb) is barely visible; the tail is a smooth tube
  with only chitin seams, plus a `bands` layer I added on the tail. The stinger is small even at
  `length` 0.18.
- `chitin` material is very glossy: a bright specular spot on the head. Eyes moved to the top of
  the head (`angle` 35) look better for a scorpion.
- `render --filmstrip` defaults to `walk` for a hexapod; `--gait tripod` is needed to see the real
  gait. Tripod worked (no slide, 0.18 s cycle).
- Description: "a curved horn on its tail" is the stinger (the recipe uses `horn.curved`);
  "1-toed clawed feet" is accurate but not very scorpion-like.

## Cross-cutting notes on docs and tools

- `patch` `set` on an object replaces the whole object: `set body.tail {"length": 0.2}` dropped
  `radius`, `pitch` and `curl` back to the preset. The diff shows the removals, but
  `blueprint.md` does not say it. Use dotted paths (`body.tail.length`) to change one field; the docs
  should say so.
- `validate` prints the whole minimal blueprint every time, which buries the `ok`, `errors` and
  `warnings`. A `--quiet` flag (or leaving the blueprint out unless asked) would help; I filtered it
  myself.
- `analyze` is the best feedback loop but its limb-intersection fixes are generic (four options in
  one string). Naming the overlap location and which option is most likely to work would save
  revisions: I ended two of five prompts with the warning because the suggested fix did not clear it.
- The size line on renders and `analyze` `height` (and the sizing table in the docs) made scale
  choices easy; creatures came out the intended size every time.
- Each render takes about 15 to 20 s and each analyze about 10 s, which is fine.
- Recipes in `blueprint.md` (rams on bipeds, scorpion tail, tusks, bristle rows) were the most useful
  part; they worked as written. The pitch-plus-curl rule for tails is stated but deserves a warning
  line, since two of my five prompts tripped on it.
