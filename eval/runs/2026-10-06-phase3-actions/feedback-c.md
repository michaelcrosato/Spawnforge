# Feedback C: prompts p11 to p15

Read before designing: docs/blueprint.md, docs/catalog.md, the four examples and their PNGs. No source
code and no other eval runs were read. All images are in `work/` (names start with the prompt id,
for example `p11-sea-serpent-a2-sheet.png`). Final blueprints: p11 attempt2, p12 attempt1, p13
attempt2, p14 attempt2, p15 attempt2. Every attempt validated with `ok: true`, no warnings.

## Summary table

| Prompt | Files | Validation errors | Visual revisions | Final |
| --- | --- | --- | --- | --- |
| p11-sea-serpent | attempt0 to 2 | none | 2 | attempt2 |
| p12-raptor | attempt0 to 1 | none | 1 | attempt1 |
| p13-cave-bear | attempt0 to 2 | none | 2 | attempt2 |
| p14-leopard-stalker | attempt0 to 2 | none | 2 | attempt2 |
| p15-gecko | attempt0 to 2 | none | 2 | attempt2 |

All five attempt0 files were valid on the first try. The docs (quick start, recipes, the
"Upright and horizontal bodies" paragraph, the catalogue presets) were enough to write valid JSON
without a single error. To judge the error messages anyway, I validated a deliberately broken scratch
file (outside the run folder). It reported 15 errors and a warning in one pass. Typo fixes were good
(`did you mean "spikes.row"?`, `did you mean "length"?`, `set body.head.jaw to true`,
`add it to skin.palette`). Two gaps are listed under "Docs and tools" below.

## Per prompt

### p11-sea-serpent

- attempt0: `serpent` preset, scale 1.4, tail 2.6, `spikes.row` on `spine` (`from` 0.05, `to` 0.97,
  count 40, height profile), dark blue base, pale belly, `scales` material, a scales layer and faint
  back stripes. Valid. Render: spiky, blue over pale, but it read as a 5.5 m pencil, only 39 cm tall
  and 28 cm wide. The spikes were hard to see. Fangs were as long as the head was tall.
- attempt1 (revision 1): torso radius about 1.5 times larger, neck 0.55 long at pitch 40 so the head
  rises, bigger head, taller spikes (profile up to 0.16, width 0.018), fewer and smaller teeth,
  explicit `slither` amplitude 0.22. Now a thick, spiky snake with a raised head.
- attempt2 (revision 2): scale 1.5, neck 0.8 long at pitch 55, head 0.3 long, tail shortened to 1.6
  so the whole animal frames better, roar intensity 1. Final: 4.9 m long, 1.4 m tall at the head,
  a clear dark blue back, a pale belly running up the front of the neck, and a spike crest from the
  skull to the tail tip.
- Could not achieve: a swan or S-shaped neck (the neck bends only at its base, so it is a hook, as
  the docs warn); fins, a frill or webbed crest (not in this version); anything that says "sea" or
  swimming (there is only `slither`, which is ground locomotion). The spikes are conical and read
  as a crest rather than fin rays.

### p12-raptor

- attempt0: `biped`, scale 0.9, torso pitch 10, `crossSection: "tall"`, neck pitch 45, wedge head,
  tail 1.6 long at pitch 3 with no curl, legs at `at` 0.6 (length 1.0, 3 segments), small arms at
  `at` 0.1 (length 0.35, `lift` 40), stripes on the back, `walk` with `duty` 0.4 as the docs suggest.
  Valid. Read as a raptor immediately: horizontal body, long straight tail, small arms.
- attempt1 (revision 1): the `tall` torso was only 32 cm wide on a 2.7 m animal, a plank from the
  front. I changed it to `round` with bigger radii, a longer neck and head (0.4 long), thicker
  legs, and added a sickle claw (`horn.curved` on `leg`, `at` 0.97, `angle` 0). It shows as a small
  dark cone at the ankle, not a proper raised toe claw.
- Could not achieve: a raised, sickle-clawed second toe (feet are uniform toes); feathers; a
  vertical body bounce during the run (see filmstrips); a walk and a sprint with different duties
  (see docs section).

### p13-cave-bear

- attempt0: `quadruped`, scale 1.5, big torso radii, short neck, snout head, tiny tail, thick legs
  with `toes` 5 and `clawLength` 0.1, eyes `size` 0.009, ears as short `horn.curved`, `mottle` plus
  `grime` over a brown base. Valid. It read as a blob or a capybara: the head was a ball merged with
  the body, claws were small, the eyes were white pinpoints.
- attempt1 (revision 1): front-heavy torso radii for a shoulder hump, longer thicker neck, a longer
  and narrower snout (length 0.4, radius 0.11), longer legs, claws 0.15 to 0.17 long with
  `clawWidth` 1.8 and a bone colour, eyes dark (`scleraColor "#5a4a38"`, `irisColor "#120a04"`) at
  size 0.011. Now clearly a bear.
- attempt2 (revision 2): head a little bigger (0.42 long, radius 0.13), softer and smaller mottle, and
  grime raised to 0.95 with `creases` 1 and `feet` 0.9. Final reads as a bulky brown bear with a pale
  fan of huge claws and pin-sized dark eyes.
- Could not achieve: individual huge claws. `foot.claw` with 5 toes and big `clawLength` gives a pale
  comb or fan of cones, not 5 hooked claws. The grime layer is subtle; "grimy" mostly comes from
  mottle and the dark lower body. No ear part, so the ears are small cones.

### p14-leopard-stalker

- attempt0: `quadruped`, scale 1.1, slim torso, round head, tail 1.1 long with `curl` 170 and
  `curlStart` 0.6 (the docs' "curled at the tip" recipe), slit-pupil green eyes, cone ears, tan base
  with a `spots` layer (size 0.035, ring 0.6), `stalking`. Valid. The curled tail worked first
  time. Spots were too sparse and too small to read, the grin of teeth looked reptilian, legs spindly,
  and the curled tail tip came out pale.
- attempt1 (revision 1): two spots layers (solid small plus rosettes), thicker legs, fewer smaller
  teeth, and a second `countershade` with `color: "base"` and `region: "tail"` to remove the pale
  tail tip. Now clearly leopard rosettes.
- attempt2 (revision 2): in the filmstrips every spot had vanished (they were 3 to 6 cm in radius and
  only 3 to 6 px). I enlarged them to 0.045 (solid) and 0.08 (rosettes). Final reads as a leopard in
  the sheet and in the filmstrips.
- Could not achieve: spots that are smaller on the head than on the body (a layer has one size and one
  `region`; the head gets the same big rosettes); a muzzle or whiskers; a tail that moves while
  walking.

### p15-gecko

- attempt0: `quadruped` plus `crossSection: "wide"` on torso, neck, head and tail, flat head, legs
  with `splay` 60 and attach `angle` 115, `toes` 5 with `toeLength` 0.14, `spread` 140, big bulging
  slit-pupil eyes (`size` 0.05, `bulge` 0.8), mottled green scales. Valid. First render was
  already lizard-like: flat, low, splayed, five toes. The toes were thin sticks.
- attempt1 (revision 1): wedge head, `splay` 70, attach `angle` 120, toes 0.2 long with `spread` 150,
  and a gait list (`trot` stride 2, `walk` stride 2). The `stride` change had no effect (the docs
  warned about this).
- attempt2 (revision 2): to get broad toe pads I used `clawLength` 0.05, `clawCurve` 10, `clawWidth` 3
  and a skin-coloured `clawColor`. The "claw" becomes a fat cone at each toe tip, which reads as a
  gecko toe pad. Final: low, wide, splayed, five padded toes per foot, big eyes.
- Could not achieve: real flat toe pads (a hack, see above); lateral spine undulation while walking
  (the body stays rigid); any sign of wall climbing; a longer stride (see filmstrips).

## What was confusing, missing or wrong (docs and tools)

1. **Action filmstrip view for serpents.** blueprint.md says "Serpents are drawn from above to show
   their wave. With `--action bite` (or `roar`, `look`) it draws the action instead". It does not
   say that the action is also drawn from above. For the sea serpent, `--action bite` (top view)
   shows eight identical straight lines, because the head moves up and down. You have to know to
   add `--view side`. The task text and the CLI help list `--view` for gait strips, and the docs do
   not mention it for actions. Say it, and default serpent actions to the side view.
2. **Action filmstrips frame the whole animal.** A 5 m serpent's head is about 20 px in each frame;
   even at side view the bite and roar are tiny. A `--zoom head` or a camera that follows the head
   would make actions reviewable on long creatures.
3. **`look` is unreviewable.** `--action look` produced no events (only `action-start` and
   `action-end`, no marker on the timeline) and no visible head turn in side or top views (checked on
   the raptor and the gecko; the only change was a tail swish in the first frame). The docs say the
   action is "aimed at a target" but the filmstrip has no target option, so I could not check
   it. Document where the target is, or add `--target x,y,z`.
4. **Gait duty cannot depend on speed.** The docs' raptor recipe `{ "type": "walk", "duty": 0.4 }` is
   right for a sprint, but it applies at all speeds: at `--speed 1` the footfall diagram still has
   flight phases (hopping), and a gentle walk and a sprint cannot both be given. A second `walk`
   entry validates with no warning and is silently ignored (checked: `duty` 0.6 then 0.4 gave 0.6
   at speeds 1 and 4). Either reject duplicate gait types or let a gait carry a speed range. The
   catalogue also prints `legPairs`, `froude` and `wave` for each gait with no explanation of what
   they do or how the walk-to-trot switch speed is chosen. I only found it empirically (bear:
   walk at 0.8 m/s, trot at 2.5 m/s).
5. **Sprawled legs ignore `stride`.** Docs say so ("large values change nothing"), but the result
   matters: the gecko's stride is 17 to 23 cm whatever I set, giving a 0.15 to 0.26 s cycle, which is a
   fast shuffle on a 1.9 m animal. At the default `skittish` speed (0.65 m/s) the filmstrip reports a
   foot slide of 9 to 10 mm (borderline visible); at `--speed 0.3` or `0.5` it is about 1e-8. Say what
   speed is safe, or let the filmstrip warn when its default speed is near the slide limit.
6. **Patterns fade in filmstrips.** The docs warn that details under "a few pixels" fade, but the
   fix ("size 0.08 to 0.15") is only given for scales and spots on small creatures. My leopard
   spots at 0.035 and 0.055 were fine in the 1536 px contact sheet and completely invisible in the
   filmstrip frames. The sheet and the filmstrip need not disagree this much. A note in the Skin
   section, and ideally a render-time warning ("layer spots: size under 3 px at this view"), would
   save a revision.
7. **`countershade` and curled tails.** After a tail curl of about 170 degrees the tip showed the
   belly colour (pale tip). That is geometrically fair (the tail's underside faces up at the tip), but
   the docs say only "bellies come out paler". The fix is a second `countershade` with `color: "base"`
   and `region: "tail"`; nothing in the docs suggests it. Add it as a recipe.
8. **Torso `tall` is very thin.** "`tall` (narrow and deep, like a fish)" is accurate, but a raptor
   with `tall` was 32 cm wide on 2.7 m and looked like a plank. A note that `tall` is for fish-like
   bodies, and that `round` is the safe default for dinosaurs, would help.
9. **Eye sizes.** The docs cover big eyes ("0.06 to 0.1 for cartoon eyes") but not tiny ones. At size
   0.009 the default pale `scleraColor` shows as a white dot that makes the bear's eyes pop. Dark
   `scleraColor` gives beady eyes. Worth a line.
10. **Spikes and teeth sizes.** Default `fangLength` 0.06 is huge on thin serpent heads (the viper
    example uses 0.07 on a tiny snake). Defaults look fine on mammals and wrong on small wedge heads.
    Not a bug, only an observation.
11. **Validation messages.** One gap: putting a foot parameter on a limb (`"toes": 5` on a limb) gives
    `fix: "remove it"`; it should say `move "toes" into "foot"` (the parts equivalent already
    says `move "length" into "params"`). Also `validate` prints the whole minimal blueprint every time,
    so the errors are hard to skim; an `--errors-only` flag would help.
12. **Undocumented CLI options.** `render --help` lists `--frames`, `--views`, `--size` and `--quality`;
    blueprint.md mentions only `--gait`, `--speed` and `--action`.
13. **Docs that were accurate and helpful.** The raptor recipe (torso pitch 5 to 20, legs at `at` 0.6,
    arms at 0.1), the "tail curled at the tip" numbers (`curl` 160, `curlStart` 0.6), the spike-row-on-spine
    recipe, the sprawl note (attach angle 110 to 120), and the "Ids you can override" lists. Overriding
    `eyes` by id with only `attach` and `params` worked.

## What the filmstrips showed, per creature

**Sea serpent (slither, bite, roar).**
- Slither (top view): a clean travelling S-wave, 0.61 m/s default, 5.7 s cycle, footSlide 0. The raised
  neck stays raised and rigid while the rest undulates, which looks natural. The wave reads very well
  from above. The 3/4 view at `--speed 1.5` is hard to read: the first frames show a compact loop
  of body because the camera sits near the head end and the S-curves are foreshortened. I believe
  this is only perspective (the top view at the same speed is clean), but a serpent needs the top or
  side view.
- Bite (side view): neck dips and the head lunges down and forward, jaw snaps by `bite-contact`
  at 0.27 s. Reads as a strike, but only just at this framing. Roar (side view): the head lifts,
  jaw opens, `roar-peak` at 0.72 s. Readable but small; the neck's single base bend makes it look
  like a hook rising and falling.

**Raptor (run, bite, roar, look).**
- Run (`walk`, `duty` 0.4): stride 1.25 m at 3 and 5 m/s, cycle 0.42 and 0.25 s, footSlide about
  1e-7. The footfall diagram shows clean alternation with a flight gap each half cycle. Visually
  the thighs swing well. Weaknesses: the torso stays at constant height (no bounce at the
  flight phase), the head is level (by design), the arms and the tail are rigid. The tail stays
  rigidly horizontal, which fits a "long stiff tail". At `--speed 1` the same duty hops with the body
  not bouncing, which looks wrong.
- Roar: the best action here. The whole body pitches up, the head rises, the jaw opens, the tail
  follows. Bite: head lunge plus a snap, readable in the 3/4 view, small in the side view. Look: no
  visible change.

**Cave bear (walk, trot, roar, bite).**
- Walk at 0.77 to 0.80 m/s: lateral-sequence footfalls, duty 0.75, footSlide about 1e-7, a heavy plod.
  Trot at 2.5 m/s: diagonal pairs, duty 0.5, no slide. No feet slide in either. The body does not sway
  or shift weight, so the plod is a bit mechanical. Roar: the front end rears, the head lifts, the
  jaw opens wide with a red mouth, peak at 0.78 to 0.82 s. Bite: head lunge and snap in the 3/4
  view reads well. Both actions scale with the size of the animal (longer and slower than the
  leopard's).

**Leopard stalker (walk, trot, bite, roar).**
- Walk at 0.58 m/s: the `stalking` temperament lowers the head and crouches, which reads as a cat on
  the hunt; lateral-sequence, duty 0.75, no slide. Trot at 3 m/s: clean diagonals, but the crouch
  stays, so it is a "low trot". The curled tail is perfectly rigid in every frame (no swish except
  in idle). Roar: head rises with the front legs straightening, readable. Bite: a quick lunge with a
  clear jaw snap.

**Gecko (walk, trot, bite, look).**
- Walk at the default 0.65 m/s: cycle 0.25 s, stride 17 cm, footSlide 9 mm. At 0.5 m/s: cycle 0.35 s,
  slide about 1e-8. Trot at 1.5 m/s: cycle 0.15 s, stride 23 cm, no slide, planted share 0.56. In the
  top view the feet barely swing and the body is perfectly rigid, so it reads as a shuffle, not a
  lizard crawl; the missing spine undulation is the single biggest gap for a gecko. The side view
  looks fine (low body, splayed legs). Bite: fast and clear (0.34 s, contact at 0.15 s). Look: nothing
  visible.
