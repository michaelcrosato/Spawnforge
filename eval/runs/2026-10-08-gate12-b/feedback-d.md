# Gate 12, suite B, agent d: feedback (b16 to b20)

Worked only from docs/blueprint.md, docs/catalog.md and examples/ (JSON and PNG), plus the CLI. Renders
and scratch files are in the scratchpad folder, never in the repository. The only other thing I looked
at in the run folder was one `ls` of its file names, to see which names were taken; I opened none of
those files. No source, scripts, packages or eval files were read.

## Summary table

| Prompt | Attempt files | First valid | Revisions after it, and what drove them | Final analyze warnings |
| --- | --- | --- | --- | --- |
| b16-giant-moth | attempt0, attempt1, attempt2 | attempt0 | 2. a1: `analyze` said `wing_intersection` (forewing into hindwing, 3.3 cm); I moved the hindwing back and lower (`at` 0.34, `angle` 30), and thinned the wing bones because the contact sheet showed two thick sticks on top of the wings. a2: spread-pose render showed fore and hind wings merging into one shape, so I split their colours and added a pale mottle and a bigger fur length. | none |
| b17-two-tailed-fox | attempt0, attempt1, attempt2 | attempt0 | 2. Both from the contact sheet, `analyze` was clean from the start. a1: legs were sticks and black to the thigh (my "socks" layer), tails fanned too wide in the front view. a2: tails had a cream underside from `countershade`, so I added a tail-region layer to keep them orange. | none |
| b18-griffin | attempt0, attempt1, attempt2 | attempt0 | 2, both driven by `analyze`. a0 had 4 warnings (2 `limb_intersection`, `cannot_fly`, `wing_intersection`). a1 fixed the limbs (more `splay`) and `cannot_fly` (longer wings), leaving `wing_intersection` (8.6 cm). a2 fixed that only after a parameter sweep (see below). | none |
| b19-armoured-burrower | attempt0, attempt1, attempt2 | attempt0 | 2, both from renders (`analyze` was clean throughout). a1: the bands floated above the back like a ridge, and the flanks were bare, so I added a second `sides` part, thinner bands, a darker armour colour and a head shield. a2: the head shield covered the eyes, so I moved it back (`from` 0.55) and moved the eyes. | none |
| b20-glow-slug | attempt0, attempt1, attempt2 | attempt0 | 2, both from renders. a1: eye stalks pointed forward and the pupils were slits (inherited from `serpent`); I made them longer and curled back, and set `pupil` "round". a2: the slug slithered in a big S, so I gave `slither` a small `amplitude`, and dropped `bite`, `lash` and `roar` from the actions. | none |

All five attempt0 files validated on the first try (no errors, no warnings, no `notBuilt`), so I have no
validation error message to report on. Every blueprint after attempt0 was written as a new file; I never
edited a saved attempt. Final answers are the attempt2 files.

## Things that apply to the whole suite

1. **Three prompts have a near-identical example.** b16 (moth) is `examples/luna-moth.json`, b17 is
   `examples/two-tailed-fox.json` and b18 is `examples/griffin.json`, and the recipe table in
   blueprint.md names each file ("see examples/..."). I was told to read examples, so I did, and I then
   wrote my own variants (own proportions, palettes, ids, extra layers). Even so, these three prompts
   mostly test whether an agent copies an example, not whether the prose docs work. Their first-try
   validity and clean `analyze` should not be read as evidence about the format. b19 and b20 had no
   matching example, and these were the ones that needed real design decisions.
2. **No what-if loop.** To tune griffin's wing I wrote a small Python script that edits a JSON path,
   writes a temp file and runs `analyze --summary`. An agent with only the CLI can do this with `patch
   --out` followed by `analyze`, but two commands plus a temp file per try is heavy. `analyze` taking
   `--set path=value` (or `--patch ops`) would make sweeps a one-liner.
3. **`analyze`'s description does not mention fur** (or the beak colour or similar). The fox reads "Skin:
   orange skin", the moth (which has fur on the torso and head) reads "brown chitin", and the burrower's
   tan-grey `#9a8470` is called "orange hide". It also repeats itself: "broad insect wings, insect wings".
   Since the description is the thing an agent reads to check intent, add "furred (torso, head)" and
   use a colour namer that does not call grey-brown "orange".
4. `render` takes 10 to 25 s, which was fine. The sheets (`--labels` and `--pose spread`) and
   `--views` combinations were the most useful tools.

## b16 giant moth

- **Easy:** `hexapod` + two wing pairs + `membrane.insect` + `antenna` feather + `"jaw": false` + `fur`
  with a region list came straight from the recipe row, and `wings`-region layers colour the membranes
  as described. Four broad patterned wings read at once in `--pose spread --views top`.
- **Wing bones are too thick by default.** A wing limb's default `radius` is `[0.05, 0.015]`, so the
  bones show as two thick sticks across the insect wing (very visible in the 3/4 and side panels). The
  luna-moth example uses `[0.014, 0.006]`, but the prose docs never say that insect wings want thin
  bones. Add it to the moth recipe row, or make the default radius for `membrane.insect` smaller.
- **Wing-vs-wing clash at defaults.** With forewing `at` 0.15 and hindwing `at` 0.3 (the recipe's
  numbers), `analyze` warns `wing_intersection` ("forewing.L passes 3.3 cm into the hindwing.L while
  flying"). The fix text ("attach it higher or further forward, or shorter") is generic; what worked was
  moving the hindwing back (`at` 0.34) and lower (`angle` 30), which is the opposite of "higher". For two
  wing pairs the message should name which wing to move and which way.
- **No per-limb pattern.** A `wings` layer paints every wing alike. To tell fore and hind wings apart I
  could only use the two membrane `color`s. There is no way to say "eye spots on the hindwings only",
  although that is what a moth has (`region` could take a limb id).
- At rest the four wings fold into one roof-like triangle, so the default sheet cannot show "four
  wings"; `--pose spread` is needed (the docs do say this).
- `stripes` on wings come out as diagonal bands and `mottle` came out as blotchy lichen at `scale` 0.12;
  fine, but nothing in the docs shows what either looks like on a membrane.

## b17 two-tailed fox

- **Easy:** the recipe row (`tail.count` 2, `spread`, `pitch`, `curl`, `foot.paw`, `fur`) worked at once.
- **Bushy-tail recipe conflicts with a body coat.** The recipe says `"fur": { "length": 0.06, "region":
  "tail" }`, but `skin.fur` is one object, so that gives the tail a coat and removes the body's. A fox
  wants a short body coat and a longer tail coat; I could only get "bushy" from the tail `radius`
  profile (`[0.05, 0.14, 0.13, 0.04]`). Allow `fur` as a list of regions with their own length, or say in
  the recipe that it replaces the body coat.
- **Dark socks:** I used `countershade` with `color` "accent", `height` 1, `region` "limbs". It works,
  but the whole limb goes dark to the thigh and the doc's tail-only example is the only hint this trick
  exists. A white tail tip, the most fox-like marking, is not achievable: `bands` counts from snout to
  tail tip and has no "last band" option, and `region` has no tip. A `tail` fraction range on layers
  (like `from`/`to` on parts) would solve both.
- Countershade on a raised tail follows the underside, so the tails came out cream below and orange
  above; the docs do warn about this (the "colour only on the tail" row), so this was my miss, but a
  default of `region` "torso" on `countershade` for creatures with a long tail might be friendlier.

## b18 griffin

- **Easy:** the head (snout, `lips` 0, `beak` hooked), `foot.talon` front and `foot.paw` hind, feather wings
  and a white head by a `region` "head" layer all behaved. Fur on a region list excluding the head gives a
  clear eagle/lion split.
- **`wing_intersection` fix text did not work, and the real drivers are undocumented.** attempt1 warned
  "wing.L passes 8.6 cm into the torso while flying". The suggested fixes (a lower attach `angle`, a further
  forward `at`, shorter `length`) did not fix it. Sweeps with `analyze --summary`:
  - attach `angle` 10, 40, 50 and `at` 0.1, 0.2: 8.0 to 9.9 cm (no help);
  - thinner bones `[0.03, 0.012]`: 12.8 cm (worse), `[0.025, 0.01]` with a broader feather: 17.2 cm;
  - `body.muscle` 0.4: 8.6 cm (no change); fewer `segments`: 15 cm (worse);
  - `fly.stroke` 0.8 / 0.6 / 0.5: 7.0 / 5.0 / 3.9 cm (helps, but not to zero);
  - what finally cleared it: the membrane's feather chord, `membrane.length` 1.05 (it was 1.1; broader values
    such as 1.25 and 1.3 gave 11 to 13 cm), together with longer wing bones (`length` 1.55), a lighter
    body (`muscle` 0.5, `scale` 1.2, torso radius `[0.15, 0.19, 0.17, 0.12]`).
  The message does not say whether the bones or the feathers hit the torso, or at what stroke phase, so
  the fix is trial and error. Suggest: say which part (bone or membrane), and mention `membrane.length`
  and `stroke` in the fix.
- **`cannot_fly` and `wing_intersection` pull against each other.** `cannot_fly` asks for longer wings
  (1.03 times), and longer wings or broader feathers raise the intersection. The docs say how heavy the
  wings may be (700 N/m2) but not that `muscle` makes the body much heavier (355 kg at `muscle` 0.65 vs
  263 kg at 0.5 for the same griffin). A short note in the Wings paragraph on "for a big flier, widen
  the wing with bone `length`, keep the feather `length` near 1, and keep `muscle` at 0.5" would have saved
  five sweeps.
- **`limb_intersection` on "rough ground"** for both leg pairs at attempt0 (2.5 cm and 1.6 cm into the
  torso): the fix ("about 10 degrees more splay") was exact and worked first time. Good message.
- The sheet's `head` panel does not show whether the eyes face forward enough for an eagle; I had to
  judge from the front view.

## b19 armoured burrower

- **Hardest of the five to get right, with the least docs.** There is no armadillo or pangolin row in the
  recipe table; only the Coverings bullet for `armor.bands` ("use `area` back on a round torso and a second
  set on the tail"). Following it gives bands that look like a separate ridge, not skin.
- **`area` "back" covers only 70 degrees of the top.** The flanks stay bare, and the side view reads as a plated
  fin on a smooth body. The fix is a second `armor.bands` part with `area` "sides" and identical `bands`,
  `from`, `to`, `overlap` and `thickness` so the strips line up. Nothing says to do this. An `area` value
  such as "upper" (back and sides, to about 120 degrees) would be the obvious missing option.
- **Defaults float.** At `thickness` 0.025 and `overlap` 0.3 the strips stand clear of the body with a
  dark gap beneath each, and in the front view the first band is visibly larger than the shoulders behind
  it. Thinner (0.012 to 0.02) and `overlap` 0.4 to 0.5 sat much closer. `area` "all" wraps the belly too (it
  looked like a barrel in the front view). The docs could give a working armadillo setting.
- **The head shield was a guess.** `shell` is only documented for the torso, but `"on": "head", "area":
  "back", "from": 0.3` worked and made a helmet of plates. With `from` 0.3 it covered the eyes (the preset
  eyes sit at `at` 0.3 to 0.35, `angle` 55 to 65), so the doc could say "keep `from` past the eyes". An
  area-slot part has no way to leave a hole for existing parts.
- **Claws:** `foot.claw` defaults (`clawLength` 0.035) are tiny; "big digging claws" took `clawLength` 0.13
  and `clawWidth` 1.8. Fine and discoverable, but a `foot.claw` example with a long, wide claw in the catalogue
  would help. Nothing in the format makes a creature a digger (no action or gait), so "burrower" is only
  a look.
- `analyze` was clean throughout, so the problems above were only visible in renders; an agent that
  trusts `analyze` would ship floating bands. A "part floats clear of the skin" check would catch this.
- Material "hide" put a cell-like wrinkle network on the head and legs that reads like tortoise skin;
  acceptable, but "skin" might suit an armadillo better. The docs do not show hide next to skin.

## b20 glow slug

- **Easy, because the recipe row is nearly a complete answer.** `serpent`, a thick torso, tentacle pair on
  the head with `eye.basic` at `at` 1, `slime`, and `bioluminescence` made a convincing slug at attempt0.
  Glow, slime gloss and the eyes all read at a glance.
- **Moving the eyes is under-explained.** To put the eyes on the stalks I reused the preset's id
  ("eyes") with a new `attach` (`on` "stalk", `at` 1). This merged into the preset part, giving one eye per
  stalk, but the preset's `pupil` "slit" came along (so the slug had snake eyes until I set `round`).
  The docs do not say that reusing the id is the right way (or that adding a new
  eye part would leave eyes on the head too), nor that the `serpent` eye is a slit with no lids.
- **Stalk direction:** a tentacle on the head points forward, and `curl` is "toward the belly" and negative
  "toward the back". It took `curl` -45 with `curlStart` 0.3, `length` 0.5 and `at` 0.5 on the head with
  `angle` 22 to get stalks that rise and then lean forward. A line saying which way a head tentacle
  points at rest, and what `angle` does for it, would help.
- **Inherited behaviour is wrong for a slug:** the serpent S-slither is big (a snake, not a slug), and the
  preset allows `bite`, `roar` and `lash`. `lash` can be aimed at the eye stalks, since `lash` needs "a tail
  or a tentacle" and "bite reaches the nearest two" tentacles; for stalks that is silly. I had to cut
  `actions` to `look` and `idle`, and set `slither` `amplitude` 0.04 and `waves` 0.7. There is no way to mark
  a tentacle as a sensor (not a limb for `lash`). Minor, but a slug-specific line in the recipe row about
  the gait would help.
- `bioluminescence` `region` "back" left the flanks dark; `"all"` was better. The description line "tentacled
  creature ... two tentacles" does not say these are eye stalks.

## Error messages

I did not hit a single validation error, so I cannot rate those. The `analyze` warnings were mostly
useful (the leg-splay one was exact), with the exceptions listed under b16 and b18 above: the wing messages
suggest changes that do not fix the problem, and they never name the part that collides. No `notBuilt`
features were reported for any of the five blueprints.
