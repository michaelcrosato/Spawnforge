# Gate 12 feedback, agent D (p16 to p20)

Worked from `docs/blueprint.md`, `docs/catalog.md` and `examples/` only. Renders and attempt PNGs
are in my scratch folder, not the repository. The finals are the last attempt listed for each
prompt.

## Summary

| Prompt | Attempt files | First valid | Revisions after it, and what drove them | Final analyze warnings |
| --- | --- | --- | --- | --- |
| p16-ant-soldier | attempt0, attempt1 | attempt0 | 1: render (mandibles were near-black on a red body, small against the head; head and eyes not big enough) | none |
| p17-goblin | attempt0 to attempt3 | attempt0 | 3: attempt1 from render (eyes on the crown like a frog, ears tiny and low, fangs tiny) and analyze `limb_intersection` (legs); attempt2 from render (eyes still too high, torso too thin); attempt3 from render (eyes not big enough) | none |
| p18-cobra | attempt0 to attempt2 | attempt0 | 2: attempt1 from render (rear higher, body read tan not brown, belly too pale on the reared neck); attempt2 from the `--flare 1` render (hood sat mid-neck, not under the head) | none |
| p19-rhino | attempt0 to attempt4 | attempt0 | 4: attempt1 from render (horns lay along the snout, invisible from the side) and analyze `limb_intersection` (foreleg 12.9 cm, hindleg 9.1 cm into the torso); attempt2 from render (head too small, torso too bulky) and analyze (foreleg still 3.5 cm in); attempt3 from render (hippo-like stance from splay 32, small horn hidden behind the big one) plus a splay and angle sweep; attempt4 from render (the two horns looked the same size) | none |
| p20-nightmare-hound | attempt0 to attempt2 | attempt0 | 2: attempt1 from render (grime and body shape invisible on black skin, eyes small); attempt2 from render (spines too even) | none |

Every attempt validated first time: zero errors and zero warnings from `validate` across all 15
files, and no `notBuilt`. So I met no unhelpful validation error. Everything below is about what the
renders and `analyze` showed, and about the docs. All five finals have `analyze` warnings `[]`
(full `analyze`, not just `--summary`), clean walking filmstrips (foot slide about 0; the cobra's is a slither) and clean
`bite` filmstrips for p16 and p20. The cobra's `display` filmstrip works
(hood spreads, `display-peak` fires).

## p16-ant-soldier (hexapod, `mandible`, red chitin)

Went smoothly: the "Insect mandibles" recipe row names `mandible` and says fixed `horn.curved`
does not move, so the prompt's "mandible-like horns" resolved quickly. The `--jaw 0.5` head render
confirmed they open.

- **Mandible colour defaults clash with the body.** `color` defaults to `#2a2018` and `tipColor` to
  `#100a06`, near black. On a red ant they read as black pincers. The docs never say a part's
  own default colour ignores the palette; I had to set `color` and `tipColor` by hand. Defaulting
  `mandible.color` (and `antenna.color`, which does default to `accent`) to a palette name such as
  `base` would be friendlier.
- **No sizing guidance for "big head".** The hexapod head radius is 0.09. I guessed 0.17, then 0.2
  with length 0.32. A sentence like "a head about as wide as the thorax is radius ~0.2 on a hexapod"
  (or `analyze` reporting head width against body width) would remove the guessing. Same for
  mandible `length`: 0.15 default is tiny on a big head; I used 0.36.
- **Eyes look cartoon-like on an ant.** `eye.basic` always has white sclera and a pupil. For an
  insect I wanted two small dark compound eyes. `scleraColor` can fake it, but the recipe for
  insects (`lids: false`) does not mention it. I left them default, which keeps a googly look.
- **The description is generic.** `analyze` says "a broad, flat body, sprawling legs" and
  "1-toed clawed feet" for something with a pinched waist: nothing on the petiole or abdomen.
  Not wrong, but it does not confirm the "ant look" I was after.
- Labels: with `--labels` the six hexapod limb labels and the head's parts stack on top of each
  other at the left of the 3/4 and side panels and are hard to read.

## p17-goblin (biped, big round head, yellow eyes, green skin)

The goblin recipe row (`radius` 0.3, eyes at `at` 0.22, `angle` 62, `scale` 2.6) is the right
starting point, but it did not read as a goblin face for me.

- **Eye placement is the hard part, and the docs do not explain the geometry.** `at` runs from the
  snout tip and `angle` is measured from the top of the head, so at `angle` 62 and `at` 0.22 the
  eyes sit at the sides, towards the crown, and look frog-like in the front and top views. At
  `angle` 46 they were worse (on top). What worked was a smaller `at` (0.16 to 0.17) with `angle`
  58 to 60. A line in the "Heads" or "Recipes" section ("eyes face along the skin normal: for
  forward-facing eyes use a small `at`, 0.1 to 0.2, and `angle` 55 to 65; a larger `at` or smaller
  `angle` moves them up and out") would have saved two attempts.
- **`scale` is capped at 3** and the doc says "2 to 3 for cartoon eyes". "Big" eyes in the prompt
  therefore means 3 plus `bulge`; `size` is the escape hatch but it is only mentioned in passing.
  Fine, but a table of what `scale` 1/2/3 looks like on a head of a given radius would help.
- **"Yellow eyes" is ambiguous**: `irisColor` alone gives a yellow iris in a white eye, so I also
  set `scleraColor` to a pale yellow. Nothing in the docs says which the usual reading is.
- **Ears.** No recipe for big goblin or elf ears. My first try (`at` 0.85, `angle` 80, `droop` 0.3)
  gave small low ears; what worked was `length` 0.38, `width` 0.1, `curve` 35, `droop` 0, `angle` 75.
  A recipe row "Big pointed ears (goblin, bat)" would help.
- **Leg collision on the default biped.** Lengthening and thinning the legs gave
  `limb_intersection`: "the pair meets under the body: attach both higher up the side (a lower
  attach.angle) ... splay barely helps here". That message was right and specific; going from
  `angle` 130 to 112 cleared it. Good message.
- **Posture.** In every static render the biped stands hunched with bent knees and a forward lean,
  even with `temperament` "calm" (I tested it), so it is not a crouch from the temperament. I
  could not find a field that straightens it and the docs do not mention it. For a goblin it
  looks fine, but it would be useful to know what drives it (leg length against hip height?).
- **Description:** "a broad, flat body" for a goblin, because the preset uses a `wide` torso
  cross-section. Misleading for an upright figure.
- Teeth: `fangs` 2 with `scale` 1.4, `fangScale` 1.5 was needed before the teeth showed on a head
  this big, although the docs say teeth size themselves to the head.

## p18-cobra (serpent, rearing neck, brown with dark bands)

The recipe row plus `examples/hooded-cobra.json` made this nearly one shot.

- **Hood placement on a long neck.** `hood` `length` is a share of the neck and `attach.at`
  defaults to 0.08. The example's neck is 0.45 long, so the hood sits under the head. My neck is
  1.1 long (to rear "up high"), so the hood landed mid-neck, a hand's width below the head. I
  fixed it with `attach: { on: "neck", at: 0 }` and `length` 0.4, but the docs never say that the
  hood's position and size scale with the neck length, nor that you can move it. It would help to
  say "the hood covers `length` of the neck from `at`; on a long neck lower `length`".
- **Action filmstrips on a serpent frame the whole body.** The docs say an action filmstrip is
  drawn "close on the head and neck", but `--action display` on the cobra defaulted to a view from
  above (the doc says serpents are drawn from above) and showed 2.8 m of snake in each frame, so the
  hood is a few pixels wide. `--view front` was still tiny. For `display` on a rearing creature the
  default should be front or 3/4 and framed on the neck and head, as for `bite`.
- **`--flare 1` is essential** for any judgement of a hood and is documented, but the plain
  contact sheet shows nothing of it (the hood folds flat), so a first-time reader may think the
  hood is missing. Perhaps the head panel should draw it half open.
- **Colour.** Palette base `#7a5230` rendered as light tan-orange (scale lighting and the
  `scales` layer). "Brown" needed a darker base (`#6a4424`). The reared neck shows its belly
  to the front, as the recipe warns; `countershade` `height` -0.7 and `strength` 0.6 fixed it.
- **Height of the rear.** `height` 0.995 m on a 2.8 m snake came from neck `length` 1.1 and
  `scale` 0.8; `analyze` does not say how much of the body is reared, only height and bite
  `reach.headHeight`. The slither filmstrip confirmed the neck stays up while it moves, which was
  reassuring and is not stated in the docs.
- The recipe says to give `torso` and `tail` a `pitch` of 0 to 1, but the serpent preset already has
  both at 0. I wrote them anyway; the recipe could say they are the preset's values.

## p19-rhino (quadruped, nose horn plus a smaller one behind, grey scaly hide)

The hardest of the five, mostly because the recipe row for the nose horn does not work as written
on a head that points downwards.

- **The "Rhino nose horn" recipe produces a horn you cannot see.** `at` 0.12, `angle` 0, `length`
  0.22, `curve` 25 grows the horn along the skin normal, which at the snout tip is the direction
  the snout points. With the quadruped head `pitch` -28 the horn lay along the nose, nearly
  parallel to the ground, and vanished in the side view. A real rhino horn rises. What worked was
  moving it back to `at` 0.2 and adding `lean` -30 (and `curve` 35, `length` 0.42, `width` 0.085).
  The doc for `lean` says `+` tilts forward and `-` back, but the connection "so a horn on the
  snout needs a negative `lean` to stand up" is not made, and `aim: "up"` is described as working
  best on the side of the head (`angle` 60 to 110), so it was not obvious it could serve for a
  midline horn. Adding `lean` -30 to the recipe row (or saying `aim: "up"` works at `angle` 0)
  would fix it.
- **"Add a smaller one at `at` 0.4"** put the second horn directly behind the first, hidden behind
  it from the side and from the front. It showed only at `at` 0.62 on my 0.55-long head. The `at`
  that works depends on head length; it is the kind of thing the recipe could give as "about
  halfway between the first horn and the ears".
- **The `analyze` fix for `limb_intersection` is correct but incomplete.** It said "about 25° more
  splay works best", and I followed it (splay 32 / 24). That removed the warning but gave a
  hippo-like sprawl in the front view, which is wrong for a rhino. A hand sweep with
  `patch --out` and `analyze` over splay and `attach.angle` found splay 20 / 16 with `attach.angle`
  112 clears everything and looks upright (splay 12 / 12 at 110 and 16 / 14 at 115 did not).
  Because the message says a lower `attach.angle` "can make it worse" and gives only a splay
  number, I had to discover the combination myself. Suggesting a pair (splay and angle) that
  clears the legs with the least splay would help.
- **Scale vs recipe values.** The recipe lengths are in torso lengths, so on a `scale` 1.7 rhino
  a 0.22 horn is 0.37 m, which is fine, but it reads small beside a 3 m body whose head is tilted
  down; I ended at 0.42 and 0.13. A line about how large a rhino horn should be (about a third of
  head length) would be useful.
- **Hide plus scales.** "Grey scaly hide" worked as `material: "hide"` plus a `scales` layer
  (`size` 0.05, `bump` 0.5, `gap` 0.4); the doc describes the two as separate jobs, which helped.
  The scale shapes read as plates on a close render, fine for a rhino.
- The description says "a curved horn on its head, a straight horn on its head" and does not say
  nose or brow, so it cannot confirm the horn's position. Mentioning `on` and `at` (nose, brow)
  would let `analyze` stand in for a look at the render.
- Heavy heads: the quadruped preset head is `snout` 0.3 long. A rhino needs `length` 0.55 and
  `radius` 0.18 to look as heavy as its body; there is no "big mammal" row for a rhino or
  hippo in the table of big mammals (horse, big cat, bear).

## p20-nightmare-hound (quadruped, jagged back spines, red eyes, black skin with grime)

Quickest after the ant. The "Very dark creatures" paragraph was exactly what I needed.

- **Grime colour has to be well above the base, and amount high.** My first grime
  (`#5a4c40`, `amount` 0.8) was almost invisible on `#1c1a1e`. The docs say so, but not how far
  above: `#7a6a56` with `amount` 1 and `creases` 1 was enough to show on the feet and belly,
  while a charcoal `mottle` (`#34303a`) was needed to show the body shape. Even then the grime
  mainly collects low on the body and legs, not "all over".
- **Red glowing eyes are not possible as such.** `eye.basic` has no emissive option and
  `bioluminescence` is a skin layer, so it cannot light the eyes. I used `irisColor` red,
  `scleraColor` dark red, `pupil` "slit", `squint` 0.5 and `scale` 1.4. They read as red, not
  as glowing. A `glow` parameter on `eye.basic` would be the obvious thing.
- **Jagged spines.** `spikes.row` with `jitter` 1 and a height profile `[0.1, 0.26, 0.2, 0.1]` is
  good, but `curve` is one number for the whole row, so all spines lean the same way; "jagged"
  gets only heights and small angle variation. Fine, but a per-spike `curve` jitter would help.
  `spine` fractions include the neck and the tail, so a row `from` 0.08 to 0.9 also puts spines
  on the neck and the long tail; the docs explain this, but it still took a render to check where
  the row began.
- Pale spines (`#b4aa98`, dark tips) on near-black skin are what make it read at a glance; the
  default spike colour is already pale, which helped.
- In the front view the spine row seen end-on stacks into one big spike over the head, which
  looks like an error until you look at the side view.

## Across all five

- **Render turnaround was fine** (about 8 to 20 s) and `render --views a,b,c --size N` for just
  the panels I wanted was the most useful option. `patch --out` to scratch made small parameter
  sweeps quick.
- **The first blueprint from recipes was valid every time** (15 of 15 files) but the first look was
  rarely right: judging by `validate` or `analyze` alone would have stopped at a poor result
  at least twice (goblin, rhino), since neither detects "horn invisible from the side" or "eyes look
  frog-like". A check for parts that stick out less than a body-relative threshold, or are hidden in
  every standard view, would catch the rhino case.
- **Docs gap for any midline part on the head:** the semantic of `at`, `angle`, `lean` together,
  in one worked picture, is the thing I tried to infer three times (goblin eyes, rhino horns,
  hood on the neck). A small diagram or a line per section ("on the head, `at` 0 is the nose tip,
  `angle` 0 is straight up, parts grow along the skin normal") would help more than more recipe
  rows.
- **Several parts have fixed default colours that ignore the palette**: `mandible` (`#2a2018`),
  `horn.curved` (`#d4c6a2`), `spikes.row` (`#ddd1b4`) and `teeth.row` (`#efe8d0`), so a custom
  palette does not reach them and each needs its own colour. Not an error, but easy to miss;
  `antenna`, `ear.pointed` and `hood` do follow the palette.
