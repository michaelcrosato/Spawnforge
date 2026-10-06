# Feedback A: prompts p01 to p05

Docs and tools only (blueprint.md, catalog.md, examples, the CLI). No source read. PNGs are in
`work/` as `pNN-aK-sheet.png` (contact sheet of attempt K), `-film.png` (gait filmstrip) and
`-bite.png` (action filmstrip).

## Summary table

| Prompt | Attempt files | First valid | Visual revisions | Final analyze warnings |
| --- | --- | --- | --- | --- |
| p01-wolf | 0, 1, 2, 3 | attempt0 | 3 (a1, a2, a3) | 1 (`limb_intersection`, foreleg.L 1.4 cm into torso, rough ground only) |
| p02-spiked-lizard | 0, 1, 2 | attempt0 | 2 (a1, a2) | none |
| p03-horn-beetle | 0, 1, 2, 3 | attempt0 | 3 (a1, a2, a3) | none |
| p04-green-serpent | 0, 1, 2, 3 | attempt0 | 3 (a1, a2, a3) | none |
| p05-swamp-troll | 0, 1, 2, 3 | attempt0 | 3 (a1, a2, a3) | none |

All five first blueprints validated with zero errors and zero warnings, so I never exercised the
"did you mean" error path on a real mistake of my own. Every later attempt was written with
`patch` on a copy. A deliberately bad patch gave good errors (see "patch" below).

## p01-wolf

- **Attempts and validation.** attempt0 valid straight away. No errors.
- **What analyze said (attempt0).** 1.9 m long, 78 cm tall, 93 kg, walk 0.55 m/s, trot up to 2.8 m/s,
  stable, no warnings, foot slide 0, one tiny `intersection` of 0.002 m between foreleg.R and the
  torso. Description: "a 1.9 m long, 78 cm tall quadruped ... with a tail, orange eyes, pointed ears
  on its head, teeth and fangs and 4-toed clawed feet. Skin: grey skin, a cream belly and charcoal
  mottling." It was useful as a feature checklist (ears, fangs and palette all present). It could not
  tell me that the result looked like a camouflaged hyena. On the description:
  - attempt1: "teal mottling" for accent `#5a5e62`, which is a slate grey.
  - attempt2 and 3: "charcoal mottling and charcoal mottling" (two mottle layers, same word twice).
  - "orange eyes" for the default golden iris `#c8a030`.
- **Changes after looking.**
  - a1: the mottle was too contrasty for fur, so I lowered its strength and scale, lightened the
    palette and shrank the ears. Result: washed-out and plain, with a smooth plastic look.
  - a2: deeper chest and thicker neck (the body looked like a ski slope), finer mottle at 0.7
    strength plus a darker "saddle" mottle on the back, `countershade.height` 0.4. This
    produced a new `limb_intersection` warning ("foreleg.R passes 1.5 cm into torso on flat
    ground") caused by the deeper chest.
  - a3: forelegs moved outward (`attach.angle` 122, `splay` 6), hindlegs 120, bigger skull. The warning
    did not go away; it moved to rough ground (1.4 cm). I had used all three revisions, so I stopped.
- **Could not achieve.**
  - Fur. The docs say so ("no fur yet"). Mottle reads as camouflage, not fur.
  - A paler belly I could actually see. The contact sheet has no underside view, and from the side
    the belly colour only shows on the inner legs. I could only trust the description's "cream belly".
  - A shaggy tail. A thick radius profile `[0.07, 0.13, 0.1, 0.02]` gives a fox-brush silhouette,
    which is the best that is available.
  - A clean analyze run (the 1.4 cm warning is left).

## p02-spiked-lizard

- **Attempts and validation.** attempt0 valid straight away. No errors.
- **What analyze said (attempt0).** 3.0 m, 550 kg, hip height 0.40 m, stable (margin 0.35), no
  warnings. Description: "... a short neck, a long tail, orange slit-pupilled eyes, a row of 14 spikes
  along its back, a row of 4 spikes on its tail, curved horns on its head, teeth and 5-toed clawed
  feet. Skin: olive scales, a tan belly, scales and grime." Useful for counting spikes. It did not
  mention that the tail ends in a club (only "a long tail"), and nothing in it hinted that the head
  was buried in the shoulders.
- **Changes after looking.**
  - a1: attempt0 looked like a sausage with the head sunk into the shoulders. I slimmed the
    torso, lengthened the neck to 0.3, shrank the head radius, made the tail 1.2 long with a thin waist and a
    0.19 club (the club read well), and doubled the spike heights.
  - a2: thickened the tail waist (the prompt says "thick") and added a small `spikes.row`
    along each flank so it reads as armoured. This also made the "row of spikes down its back" a bit
    busier.
- **Could not achieve.** Real armour plates: only scale texture and spike rows exist. The club is a
  smooth oval with spikes on its sides, not a mace. No analyze warning flagged any of the proportion
  problems I fixed by eye.

## p03-horn-beetle

- **Attempts and validation.** attempt0 valid straight away. No errors.
- **What analyze said (attempt0).** 16 cm long, 6 cm tall, 0.1 kg, walk 0.26 m/s and tripod up to
  0.68 m/s, stable (margin only 1.5 cm), no warnings. Description: "with a short neck, orange eyes,
  long curved horns on its head and 1-toed clawed feet. Skin: black chitin, a dark brown belly and
  orange spots ... tripods up to 0.7 m/s". Problems with it:
  - It says "horns" (plural) for my single horn.
  - At attempt2 it said "long straight horns" for a horn with `curve` 25.
  - "tripods up to" is ungrammatical.
  - Otherwise it matched the palette.
- **Changes after looking.**
  - a1: the torso preset's pinch made it look like an ant or wasp, so I used a smooth dome
    `[0.14, 0.21, 0.24, 0.24, 0.2, 0.1]`. I also made the horn thicker and longer, added more spots
    (size 0.075, density 0.75) and shortened the legs. Good.
  - a2: I tried to make the horn lean forward like a rhino beetle (`lean` 60, `curve` 25). This was
    a regression: the horn lay almost flat and disappeared against the body from the side and front.
  - a3: `lean` 20, `curve` 30, back to an upright horn (effectively the a1 horn plus the larger eyes).
- **Could not achieve.** An upright horn that curves forward at the tip. `curve` positive sweeps
  back and `lean` positive tilts forward, but the start direction is the surface normal, not vertical, so
  small changes flip between "flat forward" and "swept back". I found no setting for "up, then forward". The
  legs are plain tubes. Spots also show on the head ("region: back" reaches the head), which looks
  fine but is not exactly "on the back".

## p04-green-serpent

- **Attempts and validation.** attempt0 valid straight away. No errors.
- **What analyze said (attempt0).** 7.4 m long, 52 cm tall, 513 kg, slither 0.7 m/s (max 3.6), bite
  reach 0.48 m, no warnings. Penetration 0.011 m in the slither on both flat and rough ground, but no
  warning (below its threshold, presumably). Description: "a very long tail, orange slit-pupilled
  eyes and long fangs. Skin: green scales, a sand belly, yellow stripes and scales." That was useful, and
  "long fangs" was the right call at attempt0. After I cut the fang size it said "teeth and
  fangs", which is less informative.
- **Changes after looking.**
  - a1: `teeth.row` with `fangs: 2`, `fangLength: 0.1`, upper and lower rows produced a white
    picket fence of eight huge planks across the face. I changed it to `fangs: 1`, `fangLength: 0.07`,
    `lower: false`, `count: 3`. I also thickened the body and raised the neck. Now two clear fangs.
  - a2: the bite filmstrip showed the head hardly moving (short neck, default reach). I lengthened the neck to 0.6,
    pitched it at 45, and used `{"type":"bite","reach":1,"speed":1.5}`. The lunge now shows (bite-contact
    at 0.22 s).
  - a3: stripes were masked to `region: back`, so from the front the raised neck was a plain cream
    column. I changed them to `region: all` with `fade` 0.25 and moved the countershade down
    (`height` -0.5). Stripes now wrap the neck.
- **Could not achieve.** An S-curved rearing neck (the docs admit this). Fangs that visibly drop
  when the jaw opens: the bite strip shows the mouth barely open. Any visual cue for "giant": only the
  scale bar says 7.9 m.

## p05-swamp-troll

- **Attempts and validation.** attempt0 valid straight away. No errors.
- **What analyze said.**
  - attempt0: 2.0 m tall, 278 kg, one warning: `limb_intersection` "leg.L passes 1.7 cm into leg.R
    on flat ground", with fix "spread the legs apart (attach.at, attach.angle, splay) or make them
    thinner".
  - attempt1: after my reshaping, `stability.supported: false` (margin -0.018) and the intersection
    rose to 3.8 cm. Only the intersection appeared in `warnings`. The topple risk (centre of mass
    ahead of the feet) was not a warning.
  - attempt2 and 3: supported (margin only 0.015), no warnings.
  - Description: "with two arms, a short neck, orange eyes, curved horns on its jaw, teeth and 3-toed
    clawed feet. Skin: olive skin, a sand belly, dark green mottling, tan mottling and grime." The
    "tan mottling" is my `#8a9a3a` moss colour (olive-yellow), and "olive skin" for `#5f7a3c` does
    not say "green". Tusks are reported as "horns on its jaw" (module type, not my part id).
- **Changes after looking.**
  - a1: the head was a tiny cap on a huge bag-like torso. I made a bigger wide head (radius 0.19,
    length 0.36, `crossSection: wide`), a thicker neck and a leaner torso, and added a splay on the
    legs. This broke balance and the intersection (see above).
  - a2: legs moved forward under the hunched torso (`attach.at` 0.84), `attach.angle` 130 to 112
    (this, not splay, spread the hips), splay back to 0, torso pitch 70. All warnings cleared and
    stability returned.
  - a3: tusks moved to the jaw tip (`at` 0.08, `angle` 70, curve -25) and eyes enlarged to 0.035.
    The tusks now stick out sideways like horns. It is arguably worse than a2, where they pointed
    up.
- **Could not achieve.**
  - Tusks that read as tusks. On a flat, wide head the lower jaw is hidden, so any `horn.curved` on
    `jaw` reads as a horn on the side or top of the head. The bog-troll example has the same look.
  - A strongly hunched stance with a comfortable balance margin (1.5 cm).

## What was confusing, missing or wrong

1. **`render --filmstrip --view front` is documented but rejected.** blueprint.md ("Check motion
   with a filmstrip") says: "`--view side|3/4|top|front` (default side; serpents from above; actions
   at 3/4; `front` shows the legs' stance)", and `--help` lists the same. The CLI answers
   `{"error": "unknown filmstrip view \"front\"", "fix": "use side, 3/4 or top"}`. Either the
   docs or the code is wrong. The same error text appears if you pass `--view` to a contact-sheet
   render, which is confusing: "filmstrip" is named even without `--filmstrip`.
2. **`patch` cannot address skin layers the way the docs imply, and the docs do not say what does
   work.** blueprint.md says "Paths look like error paths, and inherited limbs and parts can be edited by id".
   I tried `skin.layers[type=mottle].strength` (natural, since layers are identified by `type`) and got
   `"cannot read the path at \"[type=mottle].strength\""`. That message drops the `skin.layers`
   prefix and gives no fix. What works: `skin.layers[1].strength` (index) and, when the layer has an
   `id`, `skin.layers[id=saddle].strength`. Neither is in the docs. The catalogue lists the layer
   `id` field ("Optional id; keys the layer random stream") but not that patch uses it. Please
   document layer addressing, or support `[type=...]`.
3. **analyze does not warn about balance.** The docs list the warnings: "sliding feet, a body or
   tail in the ground, legs stretched past their reach, limbs passing through each other or the body,
   parts buried in the skin and eyes facing backwards". `stability.supported: false` (troll attempt1)
   is only a measurement. A biped that would fall over produced a warning list with just the
   leg-intersection item. This should be a warning with a fix ("move the legs forward with
   `attach.at`" or "lower the torso pitch").
4. **analyze warnings were silent on every problem I fixed by looking.** The wolf's plain-plastic look, the
   lizard's sunken head, the beetle's wasp waist and the serpent's fang wall all passed with no warnings.
   Only limb intersection (wolf, troll) was flagged. That is fine, but the docs should not suggest analyze
   replaces the contact sheet.
5. **The `limb_intersection` fix is generic and the direction matters.** "spread the legs apart
   (attach.at, attach.angle, splay)" does not say which way. For the troll, lowering `attach.angle` (130 to
   112) cleared it. The docs say "angles past about 150 bring both legs under the belly", but nothing
   says the biped default 130 is already close to that. Splay is described as "swings a limb out from
   under the body", yet my edit with splay 6 came with a worse intersection. This was confounded with other changes, so
   I cannot say splay caused it.
6. **Description wording.**
   - Colour names are unreliable: "teal" for slate grey `#5a5e62`, "tan" for olive-yellow
     `#8a9a3a`, "olive" for the green `#5f7a3c`, "orange eyes" for the default golden iris.
   - A repeated phrase: "charcoal mottling and charcoal mottling".
   - A plural for a single part: "long curved horns" for the one beetle horn.
   - Parts are named by module, not by their ids or intent ("tusks" become "curved horns on its jaw").
   - Shape intent is not reported (club tail, bushy tail, flat head).
   - Grammar: "tripods up to 0.7 m/s".
   For a creature whose prompt names colours, wrong colour names are actively misleading.
7. **No underside or low view.** The contact sheet views are `3/4, side, head, front, top, rear`
   (`--views` appears in `--help` only, not in the docs; `--views belly` answers "use 3/4, side,
   head, front, top or rear"). A "paler belly" cannot be checked visually.
8. **Recipes missing or misleading for these prompts.**
   - A beetle or rhino horn that rises and curves forward: I found only "Rhino nose horn" (length 0.22,
     curve 25) and the ember-beetle example (`curve` -70). `lean` combines with the surface normal in
     a way the text does not explain.
   - Snake fangs: `teeth.row` says "`fangs`: Long fangs at the front of each row" and
     `fangLength` "in torso lengths". On a 2 m-torso serpent `fangs: 2` and `fangLength: 0.1`
     gave eight 20 cm planks. A recipe such as "two fangs: `fangs` 1, `lower` false" would help.
   - Troll tusks on a flat head (see p05). The Recipes row "Tusks from the lower jaw" does not mention the
     flat-head case.
   - "Bushy tail" and "fur" have no recipe, only "Skins are smooth".
9. **`validate` output is very long on success.** Every valid call prints the full minimal
   blueprint (100+ lines when pretty-printed). For an iteration loop I would like `--quiet` (ok,
   errors, warnings only). `--help` shows only `--expanded`.
10. **Bite on legless creatures.** `analyze.reach.bite` was 0.48 m on a 7.4 m serpent and the default
    bite barely moved. The docs do say "a bite comes mostly from the neck", but analyze does not
    flag a very short reach relative to the body.
11. **Minor.** `patch` shows `+ limbs[id=frontleg]: {...}` for the first override of an inherited
    limb, which reads like an addition (it is an override). When a patch fails, the output includes
    a `diff` for the ops that applied, with `"written": false`; it is clear enough once you spot the flag.

## patch versus editing by hand

- **Convenient for tweaks.** `limbs[id=foreleg].attach.angle`, `parts[id=tusks].params.curve` and
  `body.tail.radius` are one-line ops, and I did not need to know how the preset merges: patch
  resolved inherited limbs and parts by id (the minimal-blueprint merge then shrank the file).
  Several-op batches in one call were handy (about 5 to 15 ops per revision), and the diff summary
  (`~ body.torso.radius: [..] → [..]`) let me confirm what changed without re-reading the file.
  `set` on `motion.actions` accepted a mixed list (`[{"type":"bite","reach":1}, "look", ...]`).
- **Safe.** Nothing is written unless the result is valid. A deliberate bad op returned an
  `unknown_key` error listing the legal keys (`one of "color", "scale", "contrast", "coverage",
  "type", "id", "region", "strength"`) and an `out_of_range` error with "e.g. 180". Those messages
  were better than I expected.
- **Weak spots.** Layer addressing (item 2 above). Setting a whole radius profile needs the full
  list as the value (fine, but wordy). With the protocol's "copy first, then patch" rule, each revision
  is two commands. Writing attempt0 and any structural rework (new body shape) is still easier as a file.
  Overall I would not go back to hand-editing for iteration.
