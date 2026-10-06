# Feedback C (prompts p11 to p15)

All 13 attempt files validate with 0 errors and 0 warnings. Every first blueprint (attempt0) was
already valid, so I hit no validation errors at all. Everything below comes from the renders and
filmstrips. Renders are in `work/` (`p11.a0.sheet.png`, `p11.a0.film.png`, and so on).

## Attempts per prompt

| Prompt | Attempts | Validation errors | Visual revisions |
| --- | --- | --- | --- |
| p11-sea-serpent | 2 (attempt0, 1) | none | 1 |
| p12-raptor | 2 (attempt0, 1) | none | 1 |
| p13-cave-bear | 3 (attempt0, 1, 2) | none | 2 |
| p14-leopard-stalker | 2 (attempt0, 1) | none | 1 |
| p15-gecko | 4 (attempt0, 1, 2, 3) | none | 3 (the maximum) |

### p11 sea serpent

- **Attempt0.** `extends: serpent`, a `spikes.row` on `spine` (from 0.08 to 0.95, count 40, height profile
  `[0.05, 0.1, 0.07, 0.03]`), a dark blue base `#0d2a55`, a pale belly `#d8e6e8` and `countershade` at height 0.1.
  The render header read "4.4 m long, 25 cm tall, 19 cm wide". It was a thread, not a sea serpent, and the spikes
  (5 to 10 cm) were barely visible beside a 4.4 m body.
- **Attempt1.**
  - Torso radius `[0.14, 0.18, 0.2, 0.18]` and tail radius `[0.18, 0.02]`, both `crossSection: tall`.
  - Head radius 0.11 and length 0.26, so it is no longer swallowed.
  - Spike profile `[0.09, 0.18, 0.14, 0.05]`, width 0.03, count 36, pale blue tips.
  - Fangs added, and scales `size` 0.04.
  - The result is 4.6 m long, 60 cm tall (spikes included) and 33 cm wide. The spikes read clearly along the whole back in
    the side and rear views. Dark blue on top and pale belly are visible in the side and head views.
- **Could not achieve.**
  - Fins and a tail fin (documented as unsupported).
  - Any "swimming" behaviour. The only gait is the land `slither`, and nothing suggests water.
  - The belly is only visible from the side. There is no underside view, so I could not confirm the belly midline.

### p12 raptor

- **Attempt0.** `extends: biped`, `scale` 0.8, torso `pitch` 10 and `crossSection` round, neck `pitch` 50, tail length 1.7 with
  `pitch` 0 and `curl` 0, legs at 0.6 (length 1.1, 3 segments), arms at 0.1 (length 0.38, 3 small claws), rust and
  cream palette with stripes. The doc recipe ("legs near the middle, arms near the front") worked first time.
  Problems:
  - Legs read as thin stilts (1.1 m long, thin root).
  - The default `walk` has duty 0.625 for each leg, so both feet are down 25% of the cycle. That is a walk, not a run.
- **Attempt1.**
  - Leg `length` 0.95 and `radius` `[0.14, 0.035]`.
  - `gaits: [{"type":"walk","duty":0.4,"stepHeight":0.3}]`.
  - Duty is now 0.40 and the footfall diagram alternates L and R with a gap between them.
- **Could not achieve.**
  - Feathers or a sickle claw. All toes are identical.
  - A "stiff" tail is simply `curl: 0` plus a long straight tail. There is no stiffness parameter, but the tail stayed
    rigid and level in every frame.
  - Checking a real sprint. The filmstrip picks its own speed (1.2 m/s) and I found no flag to set one.

### p13 cave bear

- **Attempt0.** `extends: quadruped`, `scale` 1.6, torso radius up to 0.3, legs 0.5, 5 toes with `clawLength` 0.12, tiny eyes
  (size 0.009), grime, a strong mottle, brown palette. The render showed a 98 cm wide capybara blob:
  - The head (radius 0.15) was buried inside neck and torso radii of 0.2 to 0.24. No head was visible from the front
    and the teeth were hidden.
  - The belly nearly touched the ground.
  - The claws were only moderate.
  - The mottle looked like cow patches.
- **Attempt1.**
  - Torso radius `[0.17, 0.23, 0.21, 0.17]`.
  - Neck length 0.24, head length 0.36 and pitch -20.
  - Legs 0.66 and 0.68 with thicker radii.
  - Claws `clawLength` 0.16 and `clawWidth` 1.7, cream coloured.
  - Eyes at size 0.011.
  - Now it reads as a bear: clear head, ears, huge pale claws, tiny eyes.
- **Attempt2.** Skin only, plus a longer snout (0.4).
  - Base `#6a4a30` with an `accent` of `#2a1c12`.
  - Mottle at `scale` 0.1, `contrast` 0.35, `strength` 0.75.
  - Grime at `amount` 1.0, `creases` 1.0, `feet` 1.0, in a darker colour.
  - The hide now looks grimy and dark-patched but still brown.
- **Could not achieve.**
  - A real shoulder hump. `arch` bows the whole spine.
  - Plantigrade paws. The foot is a toe bundle on a thin ankle.
  - The grime layer alone had little visible effect. The mottle did most of the work.

### p14 leopard stalker

- **Attempt0.** `extends: quadruped`, `scale` 1.1, tail length 1.0 with `curl` 170 and `curlStart` 0.6 (the doc recipe), slit-pupil
  eyes with a lime iris, `horn.curved` ears coloured `base` and `accent`, `spots` with `ring` 0.7 on tan. The tail hook
  and the cat head worked immediately. Problems:
  - Spindly legs (0.58 and 0.62 long, radius 0.06).
  - A thin torso.
  - Spots of `size` 0.03 vanished in the side view and filmstrip.
- **Attempt1.**
  - Torso radius `[0.14, 0.19, 0.18, 0.14]`.
  - Legs 0.5 and 0.54 with radii 0.085 and 0.1.
  - Spots `size` 0.05, `density` 0.8.
  - Rosettes are now visible on body and legs in the contact sheet.
- **Could not achieve.**
  - The legs still look slim from the front.
  - Whiskers and proper cat ears.
  - A visible stalking posture. I did not render `calm` for comparison, so I cannot say whether `stalking` lowers the body.
  - The head view shows a sawtooth boundary along the jaw, where the pale jaw meets the tan skin. It reads as
    cartoon teeth and I could not influence it.

### p15 gecko

- **Attempt0.** `extends: quadruped`, `scale` 0.5, torso, neck, head and tail all `crossSection: wide`, `head.shape: flat`, legs
  `splay` 55 at attach `angle` 100, 5 toes (`toeLength` 0.14, `spread` 130), large bulging slit eyes on top of the head,
  `material: scales`. The sheet looked right: flat, wide, splayed, 5 toes per foot.
  The filmstrip numbers were odd (see below).
- **Attempt1.** Bigger toes (`toeLength` 0.2, `spread` 150), wider head (radius 0.14), thicker legs, and gait `stride` 1.5.
  The stride change had no effect (see doc issue 1).
- **Attempt2.** `walk` duty 0.6 and `stepHeight` 0.3. It made the footfall pattern irregular and did not fix the slide.
  A `--view 3/4` filmstrip then showed a thin spike poking up through the back above the hips in frames 3 and 4.
  This is the far-side hind leg clipping through the torso during its swing.
- **Attempt3.** Leg attach `angle` 100 to 118, `stepHeight` 0.08. The clipping is mostly gone. A faint bump
  remains in one frame (t = 0.07 s).
- **Could not achieve.**
  - A walk `footSlide` near 0. It stayed at 0.004 to 0.005 whatever I changed.
  - Toe pads. Toes are thin sticks and there is no toe-width parameter.
  - Lateral spine undulation, which a real sprawling gecko has.

## Docs and tool problems

1. **`stride` is silently ignored or clamped on some creatures.**
   - Catalogue: `stride | number | 0.2–2 | 1 | Stride length multiplier`.
   - Controlled test on the gecko:
     - Walk with `stride` 0.6, 1.0 and 2.0 gave identical results: cycle 0.175 s, stride 9.58 cm.
     - Trot with `stride` 1.0 and 2.0 gave identical results (cycle 0.133 s, stride 15.6 cm). Only 0.6 changed anything.
   - On the raptor, `stride` 0.6, 1.0 and 1.6 gave stride 0.58, 0.98 and 1.28 m, which also scales less than the multiplier.
   - Nothing says the value is capped by leg reach. Please document the cap, or report "clamped" in the filmstrip output.
2. **The gecko walk reports `footSlide` of about 0.004 to 0.005 against about 1e-7 for every other creature and gait.**
   - Docs: "how far planted feet slide (should be near 0)".
   - No units, no threshold, no warning. Trot on the same gecko gives 4e-8, so it is a walk-on-sprawler problem.
   - I could not make walk clean by changing duty, `stepHeight`, `stride` or the attach angle.
3. **"`walk` also covers running on two legs" hides the fact that you must lower `duty`.**
   - The default 2-leg walk plants each foot 62.5% of the time, so both feet are down 25% of the cycle.
   - Running needs `duty` below 0.5, which the docs never say.
   - The catalogue says only "defaults by leg count" and does not state the biped default. A short recipe for a runner
     (`{"type":"walk","duty":0.4}`) would help.
4. **There is no way to choose speed in `--filmstrip`.**
   - The tool picks the speed (raptor 1.2 m/s, gecko 0.55 m/s) and I found no documented flag.
   - The gecko cycle is 0.175 s (5.7 steps per second) because it is small. I could not slow it or compare speeds.
5. **No validation warning when the head is swallowed.**
   - p13 attempt0 had head radius 0.15 against neck end 0.2 and torso front 0.24. `validate` returned 0 warnings and
     the head was invisible in the front view.
   - A warning such as "head radius smaller than neck/torso radius at the joint" would catch it.
6. **`spikes.row` heights are not scaled to body length.**
   - Heights are in torso lengths, so the doc recipe `[0.06, 0.12, 0.05]` gives 5 to 10 cm spikes on a 4 m serpent.
   - `count` (default 7) does not scale with length either. I needed `count` 36 and a taller profile.
   - A note under "Spikes down the whole back" would help: "scale `count` and `height` with `body length / scale`".
   - Also, `from: 0.08` on `spine` starts on the neck. The first spike stands right behind the head and
     looks like it grows from the skull in the front view.
7. **Skin details vanish in small views, and the docs only warn about `scales`.**
   - Docs: "Details smaller than a few pixels fade out ... use a `size` of 0.05–0.1" (in the `scales` bullet).
   - `spots` of `size` 0.03 vanished in the side view and filmstrip of a 1.1 m cat. Even size 0.05 rosettes were visible in the
     sheet but invisible in the filmstrip frames, so a filmstrip cannot be used to judge skin.
   - The same fade rule should be stated for `spots`, `mottle` and `stripes`.
8. **The serpent preset is very thin.**
   - A serpent at `scale` 1 is 4.4 m long and 19 cm wide.
   - The Sizing section gives length ("about 3.5 × `scale`") but not girth. The render header's size line saved me.
9. **Sprawler guidance is incomplete.**
   - The docs give `splay` 50 to 60 but nothing on the limb attach `angle`. The quadruped preset uses 115, the hexapod 120 and the
     documented default is 100.
   - With `angle` 100 on a wide flat torso, the swinging hind leg poked through the back. 118 was much better.
   - The sprawler line could read "angle 110–120 so the hip sits low on the flank".
10. **The default filmstrip view is not obviously suited to every body.**
    - The side view hid the clipping that `--view 3/4` showed (p15).
    - For the serpent, only `--view top` shows the S-wave clearly.
    - A suggestion in the docs ("check legs with `--view 3/4`, serpents with `--view top`") would help.
11. **No underside view.** "Pale belly" prompts cannot be checked from below.
12. **Minor.**
    - `validate` always prints the whole minimal blueprint. That is a lot of output for a pass/fail check, so a flag to
      print only `ok`, `errors` and `warnings` would help.
    - "stride 2.9 m" and "duty {}" are printed for a legless serpent, where they mean nothing.
    - Part colours accepted a palette name (`"base"`, `"accent"`) in `color` and `tipColor` on `horn.curved`, as the
      catalogue says. That worked well for ears.

What worked well: the doc recipes for raptor leg and arm placement, the tail curl (`curl: 160`, `curlStart: 0.6`),
the spine spike row and the ear horns all worked first time. The id-based `extends` merging made
small overrides easy.

## What the filmstrips showed about motion

- **p11 sea serpent.**
  - `slither`, 0.56 m/s, cycle 5.3 s, `footSlide` 0. The top view shows a clean travelling S-wave and the spikes follow the spine curve.
  - The wave is about 1.5 wavelengths. The default (oblique) view shows the wave poorly.
  - It is slow for a 4.6 m creature.
  - There is no vertical undulation, so it looks like a land snake.
- **p12 raptor.**
  - With duty 0.40 (attempt1) the diagram shows L and R alternating with a short gap each, a proper run. At 0.625 (attempt0) it
    was clearly a walk with double support.
  - Speed 1.2 m/s, stride 98 cm, `footSlide` 2.6e-8, no sliding.
  - The tail stays straight and level in every frame, which is stiff as requested. Torso and head are steady and the arms hang with little sway.
  - The knees fold deeply, so the body sits a bit crouched.
- **p13 cave bear.**
  - Lateral-sequence 4-beat walk, duty 0.75, 0.9 m/s, stride 94 cm, `footSlide` 1.6e-7.
  - The heavy rolling gait suits a bear, and shoulders and hips move visibly. No sliding and no clipping.
  - Feet and claws stay planted convincingly.
- **p14 leopard.**
  - The same 4-beat walk at duty 0.75, 0.56 m/s, stride 49 cm, `footSlide` 4e-8.
  - Clean and smooth. The body stays level and the tail hook is readable only as a small upturn at filmstrip size, though clear in the sheet.
  - The creature walks but does not look like it is "stalking". I did not compare with `calm`.
- **p15 gecko.**
  - Walk: cycle 0.175 s (very fast), stride 9.6 cm, 0.55 m/s, `footSlide` 0.0049, which is not near 0 (the only creature with
    this problem).
  - The legs barely swing and the body is rigid. The top view shows no spine undulation.
  - The far hind leg clipped through the back during its swing (fixed mostly in attempt3).
  - Trot is cleaner: 1.17 m/s, `footSlide` 4e-8, duty 0.5, diagonal pairs correct.
