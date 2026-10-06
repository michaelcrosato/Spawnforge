# Gate 8 feedback, agent d (prompts p16 to p20)

Worked only from docs/blueprint.md, docs/catalog.md, examples/ and the CLI (`validate`, `render`,
`analyze`, `patch`). Renders went to the scratchpad, not the repository.

## Summary

| Prompt | Attempt files | First valid | Visual revisions | Final analyze warnings |
| --- | --- | --- | --- | --- |
| p16-ant-soldier | attempt0, 1, 2 | attempt0 | 2 | 1 (`not_built`: `antenna`) |
| p17-goblin | attempt0, 1, 2, 3 | attempt0 | 3 | none |
| p18-cobra | attempt0, 1, 2, 3, 4 | attempt0 | 4 | 2 (`not_built`: `hood`, `display`) |
| p19-rhino | attempt0, 1, 2, 3 | attempt0 | 3 | none |
| p20-nightmare-hound | attempt0, 1, 2, 3, 4 | attempt0 | 4 | none |

Final attempts: p16 attempt2, p17 attempt3, p18 attempt4, p19 attempt3, p20 attempt4. All five
validate with 0 errors and 0 warnings. All five attempt0 files were valid on the first try, so I
never saw a validation error and cannot judge the error messages. The `not_built` entries in the
table are the "keep it" features the docs asked for (see the notes on p16 and p18).

Overall: the docs and recipes were enough to get a recognisable creature from every prompt on the
first render. The time went on (a) the cobra's neck, (b) two misleading `limb_intersection` fixes
and (c) eye placement on a big round head.

## p16-ant-soldier (hexapod, red chitin, horn mandibles)

- Errors: none. `mandible` is not built, so I used the recipe's `horn.curved` with
  `at` 0.06, `angle` 110, `aim` "forward". It worked first time: the pair points forward and
  curls inward in the top view. I added an `antenna` pair (not built) as the docs ask, and
  `validate` listed it under `notBuilt`.
- attempt0 render: the hexapod preset's thorax, waist and abdomen already read as an ant, and the
  tripod filmstrip was clean (footSlide about 0, `analyze` gave no warnings). But the head was no
  bigger than the thorax, so "big head" failed.
- attempt1: head `radius` 0.15 to 0.21, `length` 0.3 to 0.4, `tongue` "none", `lips` 0, mandibles
  bigger. This reads as a soldier ant. The bite filmstrip works. The horn mandibles stay still
  while the jaw opens, which is expected for horns but means the "mandibles" never close.
- attempt2: mandible `angle` 110 to 125 (lower on the face, clearly paired in the top view), eyes
  `scale` 0.85, a dark `mottle` on `limbs`. Fine.
- Docs/tool notes:
  - The mouth interior stays pink inside the open jaw, which looks odd for an ant. The only
    controls are `tongue` and `lips`, not the colour of the mouth lining.
  - `analyze` reports `parts.eyes.count: 1` for a pair of eyes, which is confusing.
  - The description says "curved horns on its head" and "antennae on its head", although the
    antennae are not drawn. A reader of the description alone is misled.
  - The `fast_cadence` limit never fired: the 50 cm ant steps about 5.5 times a second per foot,
    which is under the 8 a second limit, so the number in the docs was a useful check.

## p17-goblin (biped, big round head, big yellow eyes, green skin)

- Errors: none. Scale from the sizing line: `scale` 0.4 gives 0.96 m tall, as predicted
  (2.5 x scale).
- attempt0: a 92 cm figure with a head far too small. The head `radius` 0.22 of a 0.4 m torso was
  not "big". Eyes at the preset-like `at` 0.35, `angle` 62 sat on the top corners of the skull
  like a frog's.
- attempt1: head `length` 0.5 and `radius` 0.31, torso `round` with a narrower profile,
  bigger ears and feet. The head now reads, but eyes at `at` 0.32 and `angle` 48 were still on
  the crown, and the ears (with `lean` -50) were swept back out of the front view.
- attempt2: eyes at `at` 0.22, `angle` 62, `scale` 2.6, `squint` 0.05, ears `lean` 0 and `curve`
  -10. Now the face reads (big yellow eyes with a yellow sclera, ears out to the sides).
- attempt3: leg `segments` 2 to 3, torso and neck `pitch` 84. The filmstrip of attempt2 showed
  crumpled, folded skin around the knee and thigh, with the leg bent sharply; three segments
  reduced it (still some creasing in 2 of 8 frames). `analyze` margin went from 0.007 to 0.034.
- Docs/tool notes:
  - Nothing in the docs says where to put eyes on a big round head so that they face forward.
    The default `at` 0.3 to 0.35 with `angle` 55 to 62 puts them on top; `at` about 0.2 worked.
    A recipe line for "cartoon face" (big round head, front-facing big eyes) would help.
  - `eye.basic` has both `scale` (relative) and `size` (absolute); blueprint.md's "Big eyes need
    a large `size` (0.06 to 0.1)" line contradicts "prefer the relative ones" earlier in the
    same file. I used `scale` 2.6 (range goes to 3).
  - The stability margin for a top-heavy big-headed biped was close to zero (0.007 m) but
    `analyze` raised no warning; I would not have noticed without reading the number.

## p18-cobra (serpent, brown, dark bands, rears up)

- Errors: none. Followed the cobra recipe (neck `pitch` 75, `length` 1, `crossSection` "wide",
  swelling radius profile, torso and tail `pitch` 0). `hood` and `display` are not built, so
  they are listed in `notBuilt`; kept anyway.
- attempt0: it rears and lies flat as the recipe promises (67 cm tall, 2.1 m long). But the neck is
  a straight vertical tube with a 90 degree kink where it meets the torso, and `neck.curve` 30
  gave no visible S. The wide neck with profile `[0.07, 0.15, 0.075]` looks like a bowling pin, not
  a cobra hood.
- attempt1 and attempt2: `curve` 70 then 90, `segments` 6 then 8, `length` 1.3, `pitch` 80,
  `body.muscle` 0 (several changes at once, so I cannot say which mattered). The neck got taller
  (87 cm) and the S is still barely visible, with the same sharp kink at the base.
- attempt3: `countershade` `height` -0.6 and a tan belly. This matters: on a rearing neck the belly
  faces the camera, so the default countershade made the whole front of the cobra cream with dark
  bands, not "brown". A narrow belly band fixed it. The docs say to raise `height` for a pale
  flank; a note that a rearing neck shows its belly would help.
- attempt4: `scales` `size` 0.025 to 0.013. At 0.025 the scales on the small head (6 to 17 cm)
  were huge, and the head close-up showed dotted black pixel noise along the scale edges.
- Final state: reads as a banded brown snake rearing up with a thick, flat-sided neck. It does
  not look like a cobra until `hood` is built. Slither filmstrip and bite filmstrip both work.
- Docs/tool notes:
  - The recipe should say what to expect: a thick spindle neck, not a hood, and a sharp bend at
    the base, and what `neck.curve` actually does at 5 to 8 segments.
  - The description says "a hood on its neck" although `hood` is not drawn.
  - `analyze` reports `speed.max` 2.24 m/s but the only gait, `slither`, runs from 0 to 0.87.
    The two numbers disagree.
  - `analyze` mass was 27 kg for a 2.2 m cobra (a real one is about 6 kg); the flat wide neck
    seems to weigh a lot. Harmless but odd.
  - The default `scales` size is not scaled to the head, so small heads alias in close-up.

## p19-rhino (quadruped, nose horn, smaller horn behind, grey scaly hide)

- Errors: none. `scale` 2 gave 3.8 m long and 1.7 to 1.8 m tall, as the sizing lines suggest.
- attempt0: reads as a rhino straight away (two `horn.curved` at `at` 0.12 and 0.4 on the midline,
  `foot.pad` with 3 nails, `hide` plus a large `scales` layer for a plated look). One analyze
  warning: `limb_intersection`, foreleg passes 11.7 cm into the torso.
- attempt1: followed the fix text ("a lower attach.angle ... more splay"): `angle` 115 to 100,
  `splay` 8. The intersection got worse (13.9 cm). Also lengthened the nose horn (0.45) and
  changed horn colours to a keratin grey.
- attempt2: `splay` 28 and a narrower torso cleared the warning, but the legs sprawl like a lizard's
  in the front view. Rejected visually.
- attempt3: from a short experiment I found that the opposite of the tool's advice works better:
  a higher `attach.angle` (125), `splay` 20, thinner legs `[0.08, 0.065]`, torso
  `[0.17, 0.22, 0.22, 0.17]`. No warnings (0.7 cm, under the threshold) and the legs still look
  like columns. The walk filmstrip is fine (footSlide about 0).
- Docs/tool notes:
  - The `limb_intersection` fix text is generic. Here "lower attach.angle" was wrong, and
    splay alone needed 28 degrees. It would help if the message said where the overlap is (hip or
    shin) and how much each lever buys.
  - A column-legged heavy creature has no good recipe for avoiding torso intersection; the examples
    (tusk-boar) use `splay` 22 to 26 with `angle` 96 to 100 on a 0.19 to 0.26 torso. That is
    consistent with my numbers, so a line in the docs ("heavy quadrupeds need splay 20 to 25") would
    have saved three attempts.

## p20-nightmare-hound (quadruped, jagged spines, red eyes, black skin with grime)

- Errors: none. `spikes.row` on `spine` with `jitter` 0.8 and a height profile gives convincingly
  jagged spines, and they carry down the tail. `eye.basic` with a bright red `irisColor`, a dark
  red `scleraColor`, a slit pupil and `squint` 0.5 reads as menacing; the roar filmstrip is great.
- attempt0: black hide, a `scars` layer and a `grime` layer in a dark colour. The grime was
  invisible against black (colour `#4a4036`), the scars read as red bands, the body looked bear-like
  at `muscle` 0.8, and the head looked small.
- attempt1: `muscle` 0.5, narrower torso, bigger head, taller spines, lighter grime colour, red
  `veins` on the head (`region` "head"): very good. New warning: `hindleg.L passes 2.1 cm into
  hindleg.R`.
- attempt2: `splay` 6 on the hind legs as the fix suggested ("about 5 degrees more splay"): no change
  at all (still 2.1 cm). In scratch experiments `splay` 15 also changed nothing. Lowering the hind
  `attach.angle` to 105 (or thinning the legs to 0.07) cleared it. attempt3 uses `angle` 105 and
  the warning is gone.
- attempt4: grime `amount` 1 and a lighter `color` so it shows against black, plus a torso `mottle`.
  Grime now shows, but as pale tan "socks" rising from the feet, because `feet` rises evenly up the
  legs; it reads more like mud socks than black skin with grime. I would lower `feet` next
  (I had used up the revisions).
- Docs/tool notes:
  - The hindleg-versus-hindleg overlap fix suggests splay, which has no effect on legs that overlap
    at the hip. Same issue as p19: the fix text should name `attach.angle`.
  - Near-black skins are hard to judge in the default render lighting. A brighter or rim-lit view
    option would help check silhouette and pattern on dark creatures.
  - `body.muscle` is described in blueprint.md but there is no `body.muscle` row in catalog.md
    (only the limbs' `muscle` mentions it). It validated, so it exists; the catalogue is missing it.

## Cross-cutting

- `validate` puts unbuilt features in `notBuilt` and leaves `warnings` empty, while `analyze` and
  `render` fold them into `warnings` (code `not_built`). `patch` prints nothing about them. The
  difference is easy to trip over when counting warnings.
- The sizing lines in blueprint.md were accurate for biped (0.97 m at scale 0.4), serpent (2.17 m at
  0.6) and quadruped (rhino 1.7 m at scale 2), but the hexapod ant was 0.84 m at scale 0.5 (1.7 x
  scale vs the documented 1.3 x) because I enlarged the head.
- `patch` was pleasant: id-based paths, `set` on `skin.layers[type=...]`, diffs printed, and the file
  only written when valid. Multiple ops in one call worked every time.
- Each contact sheet took about 11 s, a filmstrip longer; fast enough to iterate.
- Attempt files hold dead ends on purpose (p19 attempt1 and attempt2, p20 attempt2, p17 attempt1):
  they record what the tool's fix text led to.
