# Feedback B: prompts p06 to p10 (phase 2 motion eval)

Summary: five prompts, four attempt files each (attempt0 to attempt3). Every attempt0 validated with
zero errors and zero warnings, so no validation fixes were needed. All changes after attempt0 were
visual revisions (three per prompt, the maximum). Contact sheets and filmstrips are in
`work/<id>-a<N>-sheet.png` and `work/<id>-a<N>-film*.png` (p06 uses `p06-a<N>-...`, p07 uses
`p07-sprawl-lizard-a<N>-...`, p08 to p10 use `p08-boar-a<N>`, `p09-long-neck-a<N>`, `p10-scorpion-a<N>`).

I also ran a few throwaway diagnostic renders (stride sweeps, temperament sweeps, a bad `--gait`) from a
scratch directory outside the run folder; they are not saved as attempts.

## Per prompt

### p06-ram-demon (4 attempts, 0 validation errors)

- attempt0: `extends: biped`, scale 0.8, wedge head, the doc's "Ram horns, coiled" recipe (head, at 0.8,
  angle 45, length 0.6, width 0.05, curve 250, twist 120, ridges 12), goat pupils, red base with
  `stripes` in black (count 14, region all). Valid first time. Red and black stripes read well. The horns
  were the problem: from the top they form a heart-shaped pair of crescents lying over the back of the
  skull; from the side they are a small curl on top of the head. They do not curl round beside the face
  the way ram horns do.
- attempt1: bigger torso/neck/head, horn angle 45 to 70 and length 0.7 (my reading of "near 75-90 it grows
  out to the side first"). Worse: the two horns joined into one horizontal ring behind the head.
- attempt2: back to angle 40 and added `turn: -35`, `twist: 90`, curve 270, length 0.75; legs 1.25 to 1.45.
  The horns now fan outward and read as a big bull or buffalo crown. Better silhouette, still not a ram curl.
- attempt3: angle 55, `turn: -55`, `lean: -15`; also tried gait object `{"type":"walk","stride":1.4,"stepHeight":0.2}`.
  Horns sweep out and back past the ears. Closest I got, still no curl that comes back down and forward.
- Could not achieve: a horn that coils in a vertical plane beside the head (out, back, down, forward).
  The only control is the attach `angle`, `turn` and `lean`, and none of them gives that. Also could not
  get a taller, straighter walking stance (see motion).

### p07-sprawl-lizard (4 attempts, 0 validation errors)

- attempt0: `extends: quadruped`, scale 0.1, tail length 3, curl 20, legs 0.5 and 0.55 with splay 55, wedge
  head, scales material, olive base with `spots` (size 0.05, density 0.6, region back). Valid. In the
  contact sheet the spots were invisible on the body (only the head close-up showed blobs) and the legs
  looked like thin sticks.
- attempt1: tan base with dark brown spots, spot size 0.1, density 0.9; thicker torso; legs 0.65 and 0.7,
  splay 50; added `gaits` objects with `stride` 1.6 (no effect, see below). Spots now visible on back and tail.
- attempt2: scale 0.12 (to slow the step rate), splay 75, legs 0.6 and 0.65.
- attempt3: splay 85, attach angle 90, and a `--view top` filmstrip.
- Could not achieve: a believable lizard sprawl. Going from splay 50 to 75 to 85 changed the front view
  almost not at all. The legs are always straight diagonal struts from the body to the floor (a
  "push-up" pose), with no elbows-out/forearms-down look. A very long tail works well (tail 3 torso lengths
  is clearly visible in all views).

### p08-boar (4 attempts, 0 validation errors)

- attempt0: quadruped, scale 1, big barrel torso, head `snout` length 0.42 radius 0.17 pitch -15, short legs
  (0.38 and 0.4), 2-toe feet, tail 0.12, tusks from the doc recipe on `jaw` (at 0.25, angle 60, length 0.2,
  curve -60), `spikes.row` bristles on `spine`, mottle and grime. Valid. Read as a boar, but head and
  torso merged into one blob and the legs vanished under the body.
- attempt1: head bigger (0.5 long, radius 0.2, pitch -20), neck shorter, torso thinner at the front, legs
  0.45 and 0.42, added ears using the "Pointed ears" recipe, softer mottle.
- attempt2: shoulder hump (torso `arch` 0.12, front-heavy radius profile), head pitch -30, neck pitch -5,
  taller bristles, thicker legs, curly tail (pitch 35, curl 120).
- attempt3: tail 0.22 long so it can be seen, head 0.55 long, checked with `--gait trot`.
- Mostly achieved. Not achieved: the tiny tail is still only just visible from the side (it is tiny, so
  that may be right). The head reads big and low, the tusks read well, and the hump and bristles make it a
  boar rather than a pig.

### p09-long-neck (4 attempts, 0 validation errors)

- attempt0: quadruped, scale 1.4, neck length 1.2 pitch 68 with 8 segments, small wedge head, legs 1.15,
  tail 1.0, scales material, `spots` (size 0.07, density 0.85), ossicone-like knobs and ears made from
  `horn.curved`, goat pupils. Valid. Very tall (3.1 m) but spindly: looked like an ostrich or a
  dinosaur, with a pencil-thin torso and neck.
- attempt1: thicker torso, neck, legs and head; spots 0.09; ears angled outward.
- attempt2: legs 4 segments and longer (1.35 and 1.25), tail 1.5, added a `spikes.row` mane on `neck`.
  Legs became zig-zag bird legs; the animal reads more like a theropod than a giraffe.
- attempt3: legs back to 2 segments (straight stilts), bigger head. The standing pose in the sheet is the
  best giraffe silhouette, but the walk is a stiff scissoring A-frame (see motion).
- Could not achieve: a giraffe-like straight, graceful leg that also has a proper stride. The "lizard"
  half is carried only by the scales material, long thin tail and mane; the body plan is still a quadruped.

### p10-scorpion (4 attempts, 0 validation errors)

- attempt0: `extends: hexapod`, scale 0.3, chitin, pale sand palette, tail length 1.3 / pitch 20 / curl 200 /
  12 segments (the doc's "about pitch 20, curl 200"), a stinger from the doc recipe, plus two `role: "arm"`
  limbs (`lift: 80`, 2-toe `foot.claw`) as pincers. Valid. Read as a scorpion, but the tail looped up behind
  the hind legs, so it was not "curled over its back", and the pincers were thin.
- attempt1: tail length 1.9, pitch 35, curl 240, curlStart 0.15; bigger torso; pincers 0.6 long, 3 segments,
  lift 70, toeLength 0.2, clawLength 0.12. The `--gait tripod` filmstrip showed the tail straightening out
  (see motion), so I could not keep tripod.
- attempt2: tail 2.3, pitch 40, curl 250; set `gaits: ["walk"]` to keep the tail curled. The tail made a
  full loop behind the body; the stinger still hung over the hindquarters.
- attempt3: tail 2.4, pitch 40, curl 200, curlStart 0.1. The tail now rises from the rear, arches over the
  torso and the stinger points forward and down over the front half. Good scorpion silhouette in all views.
- Could not achieve: a scorpion that runs a tripod gait without its tail uncurling. Pincers still look
  like thin forked claws rather than lobster-like pincers.

## Docs and tool problems

1. Scorpion-tail recipe is incomplete. blueprint.md says "A scorpion tail arching over the back is about
   `"pitch": 20, "curl": 200`" and gives no length. The hexapod preset has `"tail": { "length": 0 }`, so
   you must pick one. With length 1.3 the result was a loop behind the body with the stinger over the hind
   legs (attempt0 sheet). What worked was length about 2.4, pitch 40, curl 200, curlStart 0.1. Please add the length (and say the tail must be
   about 2 torso lengths to reach over the body).
2. Ram-horn recipe does not produce a ram curl. The recipe row and the sentence "near 30-45 a curved horn
   rises and sweeps back over the head (ram horns)" produced horns that lie back over the skull and meet
   behind it (p06 attempt0); angle 70 made a closed ring (attempt1). The only thing that fanned them out
   to the sides was a negative `turn`, but the doc describes `turn` only for mandibles ("90 curves toward the midline
   (mandibles), -90 away from it"). `twist: 120` was hard to see in any view. Suggest documenting `turn`
   as the way to splay horns, and/or adding a horn parameter for bending in a vertical plane.
3. The hexapod default gait is misleading. catalog.md says the hexapod "runs a tripod gait" and its
   preset lists `["tripod", "walk"]`, but `render --filmstrip` with no `--gait` picks `walk` (p10: "gait":
   "walk", stride 8 cm, cycle 0.36 s). You only see the tripod if you pass `--gait tripod`. The doc example
   mentions only `--gait trot`. Please say which gait is shown by default and print the list of available gaits.
4. `--gait` with a gait the creature does not have crashes with a raw Node stack trace instead of JSON:
   `page.evaluate: Error: no gait "trot" for this creature at MotionController.lockGait ...`
   (tried `--gait trot` on a biped). The doc says every command prints JSON. It should return
   `{ "ok": false, "error": ..., "available": [...] }`.
5. Gait parameters seem to do nothing. catalog.md lists `stride`, `duty` and `stepHeight` for walk, trot and
   tripod. On the lizard (attempt1) I rendered `{"type":"walk","stride":0.4}`, `1` and `2`: all three gave
   identical output (stride 0.0214, cycle 0.075 s, speed 0.285). On the ram demon,
   `{"type":"walk","stride":1.4,"stepHeight":0.2}` gave exactly the same numbers as having no gaits
   field (stride 0.7168 m, speed 1.79 m/s). Either the filmstrip ignores gait parameters or they have no effect.
6. Default and explicit gait paths disagree. For the same blueprint and the same gait (ram demon attempt2),
   the default filmstrip gave speed 1.79 m/s, cycle 0.40 s, stride 0.717 m, and `--gait walk` gave 1.64 m/s,
   cycle 0.45 s, stride 0.736 m. Also `motion.temperament` changes the filmstrip speed only in the default path (giraffe
   attempt2: calm 1.36, stalking 0.96, skittish 1.84, aggressive 2.15, lumbering 1.11 m/s with stride
   about 1.56 m in all cases) and not with `--gait tripod` (scorpion: 0.96 m/s for calm, stalking,
   lumbering). The doc says "Speed is chosen at run time"; it should say how the filmstrip chooses it.
7. `footSlide` has no unit and no threshold. Docs say "how far planted feet slide (should be near 0)".
   Values ranged from 1e-8 (scorpion tripod) to 5e-4 (lizard). Is that metres? A 0.5 mm slide on a 2 cm
   stride is 2.5 percent, which is more than the number suggests. Please give units, or normalise by stride.
8. `splay` saturates. blueprint.md: "`splay` swings a limb out from under the body: 0 for upright walkers (dogs,
   horses), around 50-60 for sprawlers (insects, lizards)". On the lizard, 50, 75 and 85 (plus attach
   angle 100 to 90) all looked the same in the front view. There is no way to get a horizontal upper leg
   and vertical lower leg, which is what makes a lizard look sprawled. Even a recipe for "lizard legs"
   in the recipes table would help.
9. Leg `segments` changes the gait in an undocumented way. Giraffe legs of the same length: 4 segments gave
   stride 1.57 m and cycle 1.15 s with deep zig-zag knees; 2 segments gave stride 0.92 m and cycle 0.65 s,
   with straight but scissoring legs. blueprint.md only says "2 to 4 `segments` (bones from hip or shoulder to ankle)".
10. Pincers: `lift` ("Arms only: degrees the arm is raised forward from hanging; 90 holds it straight out
    (pincers)") appears only in catalog.md. blueprint.md never mentions it, and the recipes table has no pincer
    row. I found it by reading the catalogue limb table. Adding arms to a hexapod works, but the foot.claw
    with 2 toes reads as a forked claw; a "pincer" recipe (toes 2, toeLength 0.2, clawWidth 1.6) would save time.
11. Small creatures and patterns. blueprint.md says "Pattern sizes are in torso lengths ... Details smaller
    than a few pixels fade out", and recommends scales `size` 0.05 to 0.1 for small creatures. For `spots` on a
    43 cm lizard, size 0.05 was invisible in 5 of 6 views (visible only in the head close-up); size 0.1 and
    density 0.9 worked. There was no warning that the pattern had faded. A `pattern_too_small` warning
    would be useful.
12. `validate` prints the whole minimal blueprint (about 100 lines for a small creature) after the
    result. When piping, I had to filter for `ok`. A `--quiet` or `ok`-first summary would help; also the
    minimal blueprint silently drops fields equal to the preset (for example head `length` 0.3), which is
    correct but surprised me once.
13. Contact-sheet "head" view is unhelpful for tiny-headed or macro cases (scorpion, lizard): it zooms on
    the skull and the eye. A mouth or whole-head framing would be more useful.

## What the filmstrips showed about motion

General: no foot slides in any creature (footSlide between 1e-8 and 5e-4). Footfall diagrams
were regular and sensible. The bodies are rigid in side view; there is no head bob, no spine flex in a walk
(a little yaw in the top view), and tails stay stiff.

- p06 ram demon (biped, walk, 2 legs): cycle 0.37 to 0.45 s, stride 0.60 to 0.74 m, duty about 0.61 to 0.64
  (so a double-support overlap, no flight phase). The pose in the filmstrip is a deep crouch: both knees
  bent, torso bent forward, much lower than the upright sheet pose. Arms swing a little. With a 2 m
  creature, a 0.4 s cycle looks like fast shuffling or jogging on the spot. Leg length 1.2 to 1.45 made no visible
  difference to the crouch (the filmstrip is auto-framed, so it looks the same size). The feet plant cleanly.
- p07 lizard (quadruped, walk and trot): cycle 0.05 to 0.12 s (8 to 20 steps per second), stride only 2 to 3
  cm. The footfall diagram looks like a lateral-sequence walk (duty 0.67 to 0.78) and diagonal pairs for trot (duty
  0.5). The side-view filmstrip is almost useless: the lizard fills about a quarter of the frame, the
  tail is the biggest thing, and the frames are 0.01 s apart so they look identical (labels such as "t = 0.03 s"
  appear twice). The `--view top` filmstrip was much better: it shows legs moving and the torso
  yawing in an S, but the long tail stays dead straight (no lateral wave), which looks stiff on a 3-torso-length tail.
- p08 boar (quadruped): walk has a clean lateral sequence, duty 0.73 to 0.76, cycle 0.32 to 0.34 s, stride
  0.33 to 0.40 m. Trot is two diagonal pairs, duty exactly 0.5, cycle 0.28 s, stride 0.60 m, speed 2.1 m/s, but
  with no suspension, no body bounce and no head or tusk movement, so it looks mechanical. No sliding,
  no clipping.
- p09 long-neck (quadruped, walk): cycle 1.1 s, stride 1.4 to 1.6 m with 3 or 4 segment legs (heavily
  bent knees, bird-like), 0.65 s and 0.92 m with 2-segment legs (straight, with the legs in a scissoring A
  shape and the forward and back legs nearly crossing at mid-stance). The neck is perfectly rigid; a giraffe's
  head bob is missing. Footfalls are clean lateral sequence.
- p10 scorpion (hexapod): walk gives cycle 0.35 s, stride 8 cm, duty 0.76; the footfall diagram is a regular
  back-to-front wave. Tripod (explicit) gives cycle 0.12 s, stride 11 cm, speed 0.96 m/s, duty exactly 0.5 and
  perfect alternating tripods (frontleg.L, midleg.R, hindleg.L together). **However, in tripod the tail
  straightens out into a long horizontal line (side and 3/4 views) while in walk it keeps its curl.** The
  static pose has a curled tail; the faster gait unrolls it. For this creature that destroys the main feature
  and I had to restrict `gaits` to `["walk"]`. Probably the tail is being driven by a speed-dependent
  follow-through. The pincer arms swing up and down with the walk, which looks fine. Also the side
  filmstrip is badly framed: the pincers are cut off at the left edge in every scorpion filmstrip, and in tripod the
  tail runs off the right edge.

## Three most important problems

1. Tail unrolls at higher speed (scorpion tripod), and the default filmstrip never shows it because it
   defaults to `walk`. Gait parameters (`stride`, `duty`, `stepHeight`) have no visible effect, and the
   default-vs-`--gait` paths give different speeds for the same gait.
2. Part recipes do not give the described look: the ram-horn recipe gives a back-lying crescent rather than
   a coil beside the head, the scorpion tail recipe omits the needed length, and `splay` stops mattering
   above about 50, so there is no true lizard sprawl.
3. Filmstrip is weak for tiny, long-tailed or tall creatures (lizard is a quarter of the frame with
   near-identical frames 0.01 s apart, scorpion is cropped), and bipeds and long-legged quadrupeds always
   walk in a deep crouch whose stride depends on `segments` in an undocumented way.
