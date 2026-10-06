# Feedback B: p06 to p10 (phase 3 actions eval)

Method: read only docs/blueprint.md, docs/catalog.md, examples/ and the CLI help. Every blueprint was valid on
attempt0 (no validation errors on any of the five prompts). All later attempts are visual revisions. Renders are in
`work/` (`pNN-aK-sheet.png`, `-gait`, `-trot`, `-walk`, `-tripod`, `-bite`, `-roar`, `-look`).

## 1. Per prompt

| Prompt | Attempt files | Validation errors | Visual revisions |
| --- | --- | --- | --- |
| p06-ram-demon | attempt0 to attempt3 (4 files, final = attempt3) | none | 3 |
| p07-sprawl-lizard | attempt0 to attempt2 (final = attempt2) | none | 2 |
| p08-boar | attempt0 to attempt2 (final = attempt2) | none | 2 |
| p09-long-neck | attempt0 to attempt2 (final = attempt2) | none | 2 |
| p10-scorpion | attempt0 to attempt2 (final = attempt2) | none | 2 |

### p06-ram-demon (biped, red with black stripes, ram horns)
- attempt0: biped preset, scale 0.9, the doc's ram-horn recipe as written, stripes in `accent` (near black), goat pupils.
  Valid. The sheet showed a 2.2 m tall thin pole (thin torso, long legs), and the horns sitting on top of and behind the skull as
  one cream cap. The top view showed the two horns meeting at the midline.
- attempt1: fattened the torso, a bigger head, shorter legs, and horn `at` 0.8, `angle` 62, `turn` -50. Result: a barrel
  with the head sunk into the shoulders (head too small for the torso, no neck visible), horns still a cap.
- attempt2: a middle proportion (torso radius up to 0.27, neck 0.22, head 0.38 long and radius 0.17), horn `at` 0.78,
  `angle` 80, `turn` -45, `lean` -15. Body fine, horns still a cap behind the head.
- attempt3: horns moved forward and out: `at` 0.6, `angle` 85, `turn` -70, `lean` +10, `curve` 380, `length` 0.75.
  This finally gave two big curled horns, one each side of the head, clearly visible in the front view.
  The recipe values in blueprint.md (at 0.8, angle 40, turn -35, lean -10) did not give "coiled beside the head" on a biped.
- Could not achieve: a tight coil (the horns read as big hoops or curls, not a many-turn spiral); a demonic look beyond
  proportions and colour (no wings, no tail fork, no hooves); legs that are straight when standing (see section 3).
- Actions tried: roar (reads well at larger size), bite (subtle), gait walk.

### p07-sprawl-lizard (tiny, four sprawled legs, very long tail, spotted back)
- attempt0: quadruped, scale 0.15, `splay` 55, attach `angle` 115, tail `length` 3, `material` scales, yellow `spot` colour in the palette
  and a `spots` layer `size` 0.07 on `region` back. Valid. Reads as a lizard straight away. Spots were visible in the 3/4 view
  but faint in the top view, and the body stood fairly high on straight-looking legs.
- attempt1: `splay` 68, attach `angle` 120, legs shorter (0.42/0.46), spots `size` 0.11 and `density` 0.75. Body lower, spots clearly visible.
  The tail rose at the tip and showed as a spike in the front view.
- attempt2: tail `curl` 0 and `pitch` -4 so it lies low; thicker legs; explicit `trot`/`walk` gaits with `stride` 1.6 to see if
  it lengthened the step (it did not, see section 3).
- Could not achieve: lateral spine bend (a lizard's S-shaped body flex when it runs) and a tail that waves in an S, since each section bends as a whole.

### p08-boar (stocky, tusks, short legs, big head, tiny tail)
- attempt0: quadruped, torso radius 0.2 to 0.27, legs 0.4, head `snout` 0.42 long, tusks from the jaw using the doc recipe, a `spikes.row` bristle mane on `spine`,
  mottle plus grime. Valid. Looked like a sausage or loaf: the head merged into the body so "big head" did not read, and the 0.15-long curled tail was
  completely hidden behind the rump.
- attempt1: humped shoulders (torso radius 0.25, 0.32, 0.26, 0.18, arch 0.1), head 0.52 long and radius 0.2 with pitch -25, bigger tusks. Better silhouette.
  Tail still invisible.
- attempt2: head 0.62 long and radius 0.24, neck 0.24 long, tail 0.28 long with pitch 25 and curl 70. The tail is now a small stub visible
  at the rump. The head is bigger but still sits flush with the chest; it reads as "big head" mainly from the front and the 3/4 view.
- Tusks (recipe: `horn.curved` on `jaw`, `at` 0.25 to 0.3, `angle` 60 to 65, `curve` -60 to -70) worked immediately and look good.
- Could not achieve: a distinct neck and jowl; hooves (cloven feet were approximated with `foot.claw`, `toes` 2, `clawWidth` 2).

### p09-long-neck (giraffe crossed with lizard, spotted)
- attempt0: quadruped scale 1.2, neck `length` 1.4 and pitch 68 with 6 segments, legs 1.0 to 1.05, wedge head, `material` scales,
  ossicone-like short horns, a `spikes.row` crest on the `neck`, large `spots`. Valid. Neck and spots read well from the first render.
  The body was thin and the four legs bunched into one narrow group.
- attempt1: torso radius up to 0.27, thicker legs, attach `angle` 118, legs `segments` 2, spots `size` 0.1. Rounder body; legs still an A-frame.
- attempt2: torso `pitch` 14 (high shoulders), legs `segments` 3, attach `angle` 125. Little visible change.
- Could not achieve: straight, columnar giraffe legs. The creature stands with bent knees and feet pulled under the belly; it reads
  as an ostrich or a kangaroo-like stilt walker rather than a giraffe. A narrow torso also makes the legs look crowded.

### p10-scorpion (six legs, long tail curled over the back, pale sandy chitin)
- attempt0: hexapod, scale 0.45, tail `length` 2.4, `pitch` 40, `curl` 200 (the doc's scorpion numbers; worked first time),
  a `horn.curved` stinger on the tail, `material` chitin, pale sand palette, mottle. I added two `role: "arm"` pincers with `lift` 90 and
  2-toe `foot.claw`. Valid. The tail pose is exactly right.
- attempt1: bigger pincers (length 0.7, radius 0.07, toeLength 0.22, clawWidth 2.2) and a bulbous tail tip radius profile.
- attempt2: arm `splay` 65 and claw colour change to open the pincers outward. `splay` had no visible effect on the arms (top view identical),
  so the pincers stay parallel and closed.
- Could not achieve: open or opposable pincers, eight legs (the prompt asked for six, fine), a tail strike action (see section 2), and visible head
  detail (the pincers hide the face from the front).

## 2. Docs and tool problems

1. **The ram-horn recipe does not transfer to a biped.** blueprint.md: "Ram horns, coiled beside the head: `horn.curved` on `head`, `at` 0.8, `angle` 40; ... `turn` -35, `lean` -10".
   On an upright biped with a thick neck and a head close to the shoulders, this produced a cream cap on top of and behind the skull. What worked was `at` 0.6,
   `angle` 85, `turn` -70, `lean` 10. Suggest saying the recipe was checked on a quadruped (or a long-necked head), and adding the
   "beside the head" variant. Also, the doc explains `turn` only as "bend sideways"; it does not say which plane the coil lies in at each `angle`,
   so finding it took three renders.
2. **`lift` and `splay` on arms.** catalog.md: `lift` "Arms only: degrees the arm is raised forward from hanging; 90 holds it straight out (pincers)".
   Nothing says how to open the pincers sideways. `splay` ("Degrees the limb swings out from under the body") has no visible effect on a lifted arm. A 2-toe `foot.claw`
   gives two thin fused fingers, not pincers. A pincer foot or an `open` parameter is missing.
3. **Filmstrip options are under-documented.** blueprint.md mentions only `--gait`, `--speed`, `--action`. `--frames`, `--view` and `--size` appear only in the CLI help, and `--size`
   means per-frame width in a filmstrip (`--size 1600 --frames 4` gives a 6400 px wide PNG), whereas the help lists it under the contact-sheet render. I found this by trial.
4. **Filmstrip framing hides small details.** The frame fits the whole creature, so on the lizard (65 cm long, mostly tail) the head is a few pixels and the bite and look are
   invisible at the default size. For the boar roar, frames 3 to 6 clip the tusks at the left edge. A `--zoom head` or a camera that follows the head for actions would help.
5. **The `look` action cannot be judged.** Every `look` filmstrip (lizard, giraffe, scorpion) shows identical frames and an empty events bar, with just
   `action-start` and `action-end`. blueprint.md says actions are "aimed at a target", but the CLI has no way to give a target (`--target x,y,z`), so `look` and
   `bite` direction are unknowable. Please add a target flag and a visible target marker in the frames.
6. **No sting or tail-strike action.** For a scorpion the most iconic action is the sting. `bite` on a scorpion (0.28 s, tiny head hidden by the pincers) is barely
   visible. A generic `strike` that uses the tail (`needs: ["tail"]`) would suit scorpions, cobras and wolves alike. `sting` fails validation with
   `"sting" is not allowed ... one of "bite", "idle", "look", "roar"`, which is accurate but offers no near alternative.
7. **What sets the standing pose is undocumented.** Biped and long-legged quadruped stand and walk with strongly bent knees. The demon is in a permanent crouch
   (aggressive temperament?) and the giraffe's legs form an A-frame. The docs say temperament sets "a crouch ... for stalkers" but not that aggressive does too, and there is no
   stance or `kneeBend` field. Changing `segments` (2, 3) and torso `pitch` hardly changed it.
8. **Gait `stride` can lower the step.** blueprint.md warns that "large values change nothing". On the lizard, `stride` 1.6 on trot made the reported stride shorter (4.2 cm at 0.63 m/s before,
   3.2 cm at 0.55 m/s after) and made the duty uneven (foreleg.L 0.43, foreleg.R 0.57, instead of 0.5 everywhere). The default filmstrip speed also changed with the gait parameters (0.63 to 0.55 m/s), so runs are not directly comparable. Minor, but it
   is not "nothing".
9. **Pace chosen by the filmstrip.** The default speed differs per creature (1.8 m/s for the demon, 0.3 m/s for the lizard) and picks walk for most of them, so a trot has to be requested with `--gait`.
   For the lizard the whole cycle is 0.09 s (11 steps per second), so 8 frames span less than 0.1 s and look identical. A note that tiny creatures need `--speed` well below the default would help.
10. **Spot size advice is right.** "use a `size` of 0.08 to 0.15 there" held: at 0.07 on a 15 cm torso the spots were faint from the top, at 0.11 clearly visible.
11. **Validation messages are good.** I tried a deliberately bad file: unknown key (`"fix": "move \"length\" into \"params\""`), out-of-range values
    (`"fix": "use a value in range, e.g. 4"`), a bad part target (`"fix": "use \"head\""`), unknown colour (`"fix": "add it to skin.palette"`) and an ignored key as a warning
    (`rows use "from" and "to"; "at" is ignored`). One quirk: the unknown attach target `"skull"` was not reported until the other errors were fixed (the docs warn about this). The `validate` output prints the whole
    minimal blueprint every time; an `--errors-only` flag would save tokens.
12. **Arms animate during locomotion but the docs say they are "free for actions".** In the scorpion tripod and walk filmstrips the lifted pincers bob and swing with the gait.
    That looks fine, but it is undocumented and cannot be switched off.

## 3. What the filmstrips showed

- **p06 ram demon (biped walk, roar, bite).** Walk: duty 0.62, footSlide 7e-8 m, stride about 1.0 m, cycle 0.57 s. Two-leg double support is visible in the footfall diagram. No sliding.
  Posture is a hunched, bent-knee shuffle at a brisk 1.8 m/s; the head stays level (by design). At the hips the near thigh looks webbed to the torso (frames 1, 2, 5, 6 of the side view show a triangular slab with
  stretched stripes), a skin-weight or stripe-stretch artifact. Roar: reads well at 500 px per frame (head tips back, jaw opens, `roar-peak` 0.94 s); at the default 8-frame size the jaw is invisible.
  Bite: only the head and jaw move (0.78 s, `bite-contact` 0.36 s), the body does not lunge, so on a biped it looks weak.
- **p07 lizard.** Footfalls fine, footSlide 2 mm at most. But the stride is only 3 to 4 cm with a very fast cycle (0.07 to 0.18 s), and the legs barely swing in the 8-frame strip. The trot top view shows the
  diagonal pairs and a small tail sway, but no spine flex. Bite is 0.15 s (event at 0.07 s) and subtle. Look shows nothing. Overall: it reads as a scurrying toy, not a lizard.
- **p08 boar.** Walk: duty 0.74 to 0.76, stride 0.34 to 0.39 m, no sliding (5e-8 m). The short legs move with small strokes, which suits. The trot at 2.2 m/s is clean (duty 0.5, diagonals in the diagram).
  Roar reads well: head lowers and lifts, jaw opens with a red mouth, tusks swing up; `roar-peak` 0.61 s. Bite: head dips and the tusks flick, a good read. Frame clipping on the roar noted above.
- **p09 giraffe-lizard.** Walk: stride 1.2 m, cycle 1.0 s, no sliding (1e-7 m). The feet land under the middle of the belly and the knees stay deeply bent, so the
  silhouette is an ostrich or stilt-walker rather than a giraffe; the trot (2.5 m/s, stride 1.7 m) looks the same, with the far-side legs drawn semi-transparent in the strip. Bite is the best action here: the neck swings
  down and forward in a smooth arc and back (`bite-contact` 0.37 s), and it reads like grazing. Look: nothing visible. Spots vanish at filmstrip scale, so use a larger `size`.
- **p10 scorpion.** Tripod: the footfall diagram shows two clean alternating tripods (duty 0.5, footSlide 3e-8 m, cycle 0.15 s at 1.18 m/s). Walk at 0.29 m/s uses the 6-leg walk wave (duty 0.75), also clean.
  In the side view the tail is an identical rigid arch in every frame (the top view shows only a slight sideways shift): no sway or counter-motion, so the creature looks stiff above the legs. The pincers bob with the gait. Bite is invisible at this scale;
  the sheet's head is hidden behind the pincers. A sting is what the creature needs.

## 4. Three most important findings

1. Look and bite direction cannot be checked or aimed (`look` is invisible; no target option) and the action set has no tail or sting action, which the scorpion needs.
2. Posture and gait stance cannot be set. Biped and long-legged creatures stand with bent knees and feet bunched under the belly (demon crouch, giraffe A-frame), and `splay` has no effect on lifted arms (pincers cannot open).
3. The ram-horn recipe is quadruped-specific: on a biped it gave a cap, and `at` 0.6, `angle` 85, `turn` -70 was needed. Filmstrip options (`--size`, `--frames`, `--view`) are missing from the docs and the framing hides head actions on long creatures.
