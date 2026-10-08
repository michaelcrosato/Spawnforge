# Gate 12 feedback, agent C (p11 to p15)

Worked only from docs/blueprint.md, docs/catalog.md, examples/ (JSON and PNG) and the CLI. Renders
went to the scratch folder. Every attempt0 validated with no errors and no warnings, so for all five
prompts the first valid attempt is attempt0 and every later attempt is a revision driven by renders
or `analyze`, not by validation.

## Summary

| Prompt | Attempt files | First valid | Revisions after it | What drove them | Final analyze warnings (final = last attempt) |
| --- | --- | --- | --- | --- | --- |
| p11-sea-serpent | attempt0 to attempt3 | attempt0 | 3 | a1: body was a 27 cm wide pencil and the spikes vanished at 5.5 m (thicker body, taller spikes, tail fin); a2: raised S-curved neck so the silhouette reads as a sea serpent; a3: the rearing neck showed its pale belly from the front, so countershade `height` lowered and the neck thickened | none (swim.undulate only, `land: false` tested separately) |
| p12-raptor | attempt0 to attempt2 | attempt0 | 2 | a1: too slim and stick-legged (deeper chest, thicker thighs, bigger head, arms 0.34); a2: `wedge` head for a flatter raptor skull | none |
| p13-cave-bear | attempt0 to attempt4 (cap reached) | attempt0 | 4 | attempt0 analyze: `limb_intersection`; a1: head sunk and body blobby (recipe proportions, longer claws); a2: bigger claws, higher head, lower attach angles, which swapped one `limb_intersection` for another; a3: more splay, which gave a third variant and a "sprawling legs" description; a4: thin leg roots and angles found by trying four variants in scratch, a bigger head, smaller fangs | none |
| p14-leopard-stalker | attempt0 to attempt2 | attempt0 | 2 | a1: tail tip came out pale (countershade follows the tail's underside) and the rosettes were blotches on the small head, so layers split by `region`; a2: legs too thin, ears too small | none |
| p15-gecko | attempt0 to attempt3 | attempt0 | 3 | a1: body too narrow, toes too thin (tail base bulge, wider torso, leg tip radius raised); a2: shorter legs and longer toes gave `foot_slide` (0.8 cm); a3: legs 0.46/0.5, splay 55, toes 0.19/0.2, clean | none |

Honest note on protocol: for p13 (four candidates) and p15 (four candidates) I tried leg variants as
scratch files in the scratch folder and ran `analyze` on them before saving the winner as the next
attempt, because p13 had already hit the attempt4 cap and I did not want to burn attempts on
guesses. The saved attempts are the only ones I report. About ten `analyze` runs went into the
limb clearance fix for the bear alone.

Final looks (all at the end of the run, last attempt of each): the sea serpent is dark blue with a
pale belly and a 50-spike crest from the neck to the tail tip; the raptor is a horizontal-bodied
biped with a long straight tail, small arms and a flat wedge skull, and it runs with both feet off
the ground; the cave bear is a bulky brown hide creature with tiny eyes and 23 cm foreclaws; the
leopard stalker has rosettes, slit pupils and a tail curled at the tip; the gecko is flat, wide,
splayed, with five big toes per foot.

## p11-sea-serpent

What went well: the `serpent` preset plus the "Spikes down the whole back" recipe (`spikes.row` on
`spine`, `from` 0.1, `to` 0.95, a `height` profile) worked first time and `validate` was clean.
`media.water: true` plus `fin.tail` gave a swimmer and `render --filmstrip --gait swim.undulate`
showed the wave.

Confusing or missing:
- No sea serpent or sea monster recipe. The serpent preset is a 3.5 x `scale` thin snake. At
  `scale` 1.4 it came out 5.5 m long, 45 cm tall and 27 cm wide, and the default spike heights
  (profile peak 0.12 torso lengths) were specks on the contact sheet. The docs say "a serpent about
  3.5 x scale" but not how thick a serpent that long should be. A line such as "a 5 m serpent wants
  torso radius about 0.14 and spikes height 0.2" would have saved a revision.
- `spikes.row` with `on: spine` also covers the neck. When I raised the neck, the spikes on the
  neck stayed hidden from the front and only partly showed from the side. It is not documented
  whether the row follows the S-curve of `neck.curve` (it appears to).
- The pale-belly note for a rearing neck is in the cobra recipe row only. I hit it with a sea
  serpent: the whole front of the neck went pale. A short sentence in the Skin section ("anything
  that rears shows its belly: lower `countershade.height`") would generalise it.
- The contact sheet frames a 5.6 m thin creature at its full length, so in the 3/4 and side panels
  the head is a few pixels and the spikes are tiny. I used `--size 640` and the `head` view. A
  framing option for long creatures (crop to the front half, or a `--zoom`) would help judge
  them.
- Nothing says how to show a creature in water: the contact sheet always draws a ground plane, even
  for a swimmer with `land: false`. The swim filmstrip is on a blue background but only looks down
  from the top (the default view for serpents). I did not try `--view side` on the swim filmstrip, and nothing
  in the docs says it shows the waterline or the head above it.
- `analyze` reports `speed.walk` 1.78 for a serpent with `land: false` and only `swim.undulate` in
  its gait list, which reads as a walking speed it does not have.
- `fin.tail` `size` is given in torso lengths but `analyze` prints the part size in metres
  (0.45 for a written 0.3 at scale 1.5), which looked like a mismatch until I multiplied.
- The rest pose is a straight line. A sea serpent's identity is its coils and humps; there is no
  way to pose or arch a serpent in `render`, so the sheet reads as a long stick.

## p12-raptor

What went well: the biped preset line "lean the torso forward and add a tail for a raptor", the
"Upright and horizontal bodies" paragraph (legs at 0.6, arms at 0.1) and `examples/rust-raptor.json`
gave a correct skeleton on the first try. The run filmstrip showed a clean two-beat run with
flight phases.

Confusing or missing:
- "Stiff tail": nothing in the docs says whether a biped's tail is a spring, how to stiffen it, or
  whether `segments` or `curl` change its swing. Antennae have `stiffness`; tails have none. I
  guessed `curl` 0, `pitch` 0 and 6 segments. The run filmstrip showed a rigid tail, which was what
  I wanted, but I could not tell if that was the guess or the default for a `run` gait.
- `head.shape` options (round, snout, flat, wedge) have no visual description. I found that
  `wedge` gives a flatter raptor skull by rendering both; a one-line description of each shape in
  the Body section would remove the trial.
- `foot.talon` has no sickle-claw option, the one feature raptors are known for. `foot.claw`
  (three toes, `clawLength`) cannot do three forward toes and a raised killing claw either.
- `limbs[].arm.lift` says "degrees raised forward from hanging" but a 0.34 arm on a horizontal
  body points forward and down; I could not tell from the doc which `lift` keeps the hands tucked.
  I picked 50 by eye.

## p13-cave-bear

What went well: the "Bear" row in the big-mammals table (torso radius, neck 0.3 / pitch 32,
plantigrade legs, `foot.paw` with five long claws, `lumbering`) was a good start. `material: hide`
with `grime`, `mottle` and `scars` gave a plausible dirty hide.

Confusing or missing:
- Huge claws are not reachable with `foot.paw`: its only claw control is the enum `claws`
  (hidden, short, long). The bear recipe uses `long`, which is not huge. I had to switch to
  `foot.claw` (`clawLength` up to 0.3) and add `"stance": "plantigrade"` by hand, losing the paw's
  pads. A `clawLength` or `clawScale` parameter on `foot.paw` would fix this common case.
- `limb_intersection` fixes contradict each other and chase their tails. Attempt0: "about 10 deg
  more splay works best". After more splay: "the pair meets under the body ... splay barely helps
  here; attach lower (a lower `attach.angle`)". After a lower angle: "On a broad body a lower
  attach.angle can make it worse" and the legs entered the torso again. It took three saved
  attempts and four scratch variants to find a combination (thin leg roots, `attach.angle` 100 to
  104, splay 28/14) that cleared everything. A warning that names both constraints at once (the
  window of angle and splay, or the maximum root radius) would have avoided that. The `fix` text
  for the second warning also does not say that thicker `muscle` or a deep torso causes it.
- `analyze`'s description turned to "with sprawling legs" at splay 20 (attempt3), which a bear
  should not have; the docs do not say that splay over about 15 reads as sprawling.
- `grime` is described but hard to see in a render when its colour is darker than a mid-brown
  base; the "very dark creatures" advice (colour well above the base) applies to any creature with
  a dark base, not only black ones. I judged "grimy" mostly by `mottle`.
- `hide` wrinkles show as large turtle-like cells on a 2 m creature's head close-up. There is no
  parameter for their size. `scars` render as bright raised streaks that look like decals; a
  muted `color` helps but this is not mentioned.
- `eye.basic` `scale` range starts at 0.2; 0.4 was tiny enough, but the doc's "0.5 small" line
  should say what a tiny eye is.

## p14-leopard-stalker

What went well: the "Big cat" recipe row and the tail recipe ("a tail curled at the tip is `curl`
160, `curlStart` 0.6") landed exactly. `pupil: slit` is a one-liner. The "tail that curls up:
countershade follows the underside" note in Skin predicted the pale tail tip exactly.

Confusing or missing:
- Leopard spots can be built three ways: `rosettes`, `spots` with `ring`, or plain `spots`. Both
  catalogue entries mention leopards. At size 0.04 the rosettes read as scattered dark blobs from
  afar; the tinted centre is invisible at contact-sheet size. The docs do not say which size makes
  a ring read as a ring.
- Pattern sizes are in torso lengths, so rosettes sized for the body are huge on a head. I needed
  four layers by `region` (torso, limbs, head, tail) plus a tail colour reset to get a believable
  coat. The Skin section explains the whole-body layout rule for `stripes.count`, but not that
  size has the same problem.
- The default `lips` of 0.3 gives a wide frog-like grin on a `round` cat head in the front view.
  The big-cat recipe does not set `lips`; a lower value (0.1) would read more feline.
- `stalking` temperament crouches the static pose on the contact sheet (hind legs folded, head
  low), which looks hunched next to the filmstrip walk. The docs do not say the sheet shows the
  temperament's posture.
- Fur at 0.012 leaves a speckled white fringe on belly silhouettes in renders; harmless but not
  mentioned.

## p15-gecko

What went well: `foot.claw` has up to 6 toes, `spread`, `toeLength` and `clawLength`, so five long
splayed toes were straightforward, and `wide` torso/neck/head cross-sections plus `splay` 55 to 60
gave the flat sprawl. `eye.basic` with `lids: false`, `bulge` and `pupil: slit` fit a gecko.
`examples/river-crocodile.json` was the right model for sprawl.

Confusing or missing:
- Toe thickness follows the limb tip `radius`, not any foot parameter (only `clawWidth` is
  separate). The first render had five long, thin toes; "big toes" came from raising the leg tip
  radius from 0.025 to 0.04. This is not documented. A `toeWidth` on `foot.claw` (or a pad-tipped
  toe like a gecko's lamellae) would be clearer.
- "Wall crawler": there is no climbing medium or gait (`media` has land, water, air). The
  creature can only look the part; the doc does not say that, so an agent cannot tell whether a
  climbing request is out of scope.
- `fast_cadence`: the docs say above 8 steps a second reads as jitter, and `cadence` lists
  trot at 9.47 steps/s for the final gecko (10.1 for a variant with shorter legs), yet no
  `fast_cadence` warning was raised. Either the threshold is checked at some other speed or the
  doc is off. For small creatures I could not tell whether to stop or accept it.
- Shortening the legs from 0.5 to 0.42 raised a `foot_slide` of 0.8 cm. The fix text ("lengthen
  the leg or move it so the foot sits under the hip") was right, but with sprawled legs the
  working change was splay 55 and legs 0.46/0.5. The sizing table has no small-lizard entry; I
  worked the scale (0.35) out by eye to get an 83 cm gecko, which is large for a gecko.
- The walking gecko's `cycle` is 0.13 s at the skittish pace. A sentence on what scale gives a
  natural cadence for a small sprawler would help.

## General notes

- Renders took about 10 s each here, not 20. `--views`, `--size` and `--quality high` all worked
  as documented; `--views` accepting `underside` was useful for counting toes.
- No validation error occurred in any of my attempts, so I probed three on purpose in a scratch
  file: `curl` 500 gave "500 is outside -360-360, use a value in range, e.g. 360"; `foot.paw` with
  `toes` 6 gave "6 is outside 3-5, e.g. 5"; a `count` on a `rosettes` layer gave `unknown_key`
  with the list of valid keys and the fix "remove it". All three had paths, ranges and fixes; the
  `unknown_key` fix could say which sibling layer type has `count` (stripes, bands, spots) instead
  of only "remove it".
- `analyze` descriptions were reliable checks of intent ("a long curled tail", "a broad, flat
  body", "5-toed clawed feet", "small brown eyes"), and `cadence` and `counts` made good
  assertions. The one-line `description` surprised me twice (the "sprawling legs" phrase and a
  missing mention of the fur).
- A `--summary` flag exists but the full `analyze` was needed to see `cadence`; `--summary` could
  keep it, since it is short.
