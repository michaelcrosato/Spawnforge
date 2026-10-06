# Feedback D: prompts p16 to p20

Final files: `p16-ant-soldier.attempt3.json`, `p17-goblin.attempt3.json`, `p18-cobra.attempt3.json`,
`p19-rhino.attempt2.json`, `p20-nightmare-hound.attempt2.json`. Renders are in `work/` (`pNN-...-sheet.png`,
`-gait.png`, `-bite.png`, `-roar.png`, `-trot.png`).

Summary: every attempt0 validated first time (no validation errors in any attempt of any prompt). All the
changes below came from looking at renders and filmstrips. Attempts: p16 4 files (3 visual revisions),
p17 4 (3), p18 4 (3), p19 3 (2), p20 3 (2). No warnings from `validate`; the only warnings came at render time (p18).

## Per prompt

### p16-ant-soldier (hexapod)
- attempt0: `extends hexapod`, scale 0.5, head radius 0.15, `horn.curved` mandibles from the docs recipe
  (`at 0.08, angle 100, length 0.2, lean 60, curve 110, turn 90`), `chitin` red palette, `countershade` softness 0.2.
  Valid. The preset's torso profile (`[0.1, 0.14, 0.085, 0.17, 0.15, 0.1]`) already gives the head, thorax, waist and gaster of an ant, which was a big help.
- Looking at the sheet: head not big enough, mandibles tiny and hanging down under the chin like hooks, eyes pale and goggly.
- attempt1: head radius 0.2, length 0.36, `crossSection wide`, neck 0.1, dark eyes (`scleraColor` dark red), mandibles moved onto the `jaw` (`at 0.1, angle 90`) so they would open on bite. Result: they hung straight down like boar tusks. Worse.
- attempt2: mandibles back on the head (`at 0.06, angle 95, lean 75`). Still pointing down. Bigger eyes.
- attempt3: `at 0.04, angle 80, lean 90, curve 80, turn 90, length 0.32, width 0.035`, neck 0.16, `bite` with `reach 1, speed 1.5`.
  From the top view the mandibles now stick out forward and curve toward the midline, which reads as ant mandibles. The side view still has them angled a little downward.
- Could not achieve: mandibles that snap with the bite (parts on `head` do not follow the jaw; on `jaw` they point down); antennae (documented as missing).
- Gait: tripod, two clean alternating tripods, duty 0.5, footSlide 1.4e-7 m, cycle 0.38 s, stride 22 cm. Frames look right: three feet planted, three swinging.
  The legs are thin and the stride is fast, but no sliding.
- Bite: 0.2 to 0.3 s, `bite-contact` at 0.09 to 0.14 s. The head barely lunges (neck length 0.06 to 0.16); what you see is the jaw dipping open and closed.
  The red jaw is hidden by the head, and the mandibles (head parts) do not move at all, so the action reads weakly for an ant.

### p17-goblin (biped)
- attempt0: scale 0.45, torso pitch 78, head round 0.5 long and radius 0.24, legs and arms 1.1, eye size 0.09, yellow `scleraColor`, slit pupils,
  ears as `horn.curved` (`lean -60, curve -15`), teeth, green skin with `mottle`. Valid. Big yellow eyes and green skin came out well straight away.
- Looking at it: the body is a tall thin tube, legs and arms too long and spindly, ears tiny and pointing straight back, no nose.
- attempt1: scale 0.5, torso radius `[0.18, 0.27, 0.26, 0.22]` (pot belly), legs 0.85, arms 0.95, ears length 0.38 at angle 90, a nose spike
  (`horn.curved at 0.1, angle 0, lean 50, curve -30`, skin colour). Better, squat and goblin-like. In the 3/4 filmstrip the two legs crossed under the belly.
- attempt2: legs `attach.angle 105, splay 10`, thicker legs, bigger toes. The stance is wider and the legs no longer cross.
- attempt3: `temperament calm`, torso pitch 80, hoping for a more upright stance. It still stands with deeply bent knees.
- Could not achieve: an upright, straight-legged stance (the biped always rests in a half crouch), a readable mouth in the idle pose (the mouth only shows during roar and bite).
- Gait: walk, duty 0.62 to 0.63, footSlide ~1e-8 m, stride about 47 cm. Footfall chart shows two legs with a short double-support overlap, as expected.
  The walk reads as a stooped, shuffling goblin, fitting. The side-view filmstrip hid the leg crossing; only the 3/4 view (`--view 3/4`) showed it.
  In attempt0, frames 4 to 6 show a dark triangular flap at the back of the thigh and hip (a skinning artifact where thin legs meet a narrow torso); it was much fainter once the torso was thicker.
- Roar: reads well (head tips back, jaw opens, `roar-peak` 0.57 s). Bite: only a small head nod with a slightly open jaw. Look: the head hardly turns in the side view (no target shown).

### p18-cobra (serpent)
- attempt0: scale 0.8, neck length 0.9, pitch 80, `crossSection wide`, radius `[0.07, 0.2, 0.12, 0.09]` for the hood, fangs, brown base, 22 dark stripes.
  Valid. The neck rose, but it was a huge bowling-pin column (39 cm wide, hood shape along the whole neck), the front looked cream (countershade on the belly side) and the bands were faint.
- attempt1: torso pitch 18 to soften the L-bend at the base, neck 0.8 with an 8-value radius profile (narrow head end, hood just below the head, thin lower neck),
  darker belly colour, countershade `strength 0.6, height -0.5`, stripe `fade 0.1`, `width 0.45`. Much more cobra-like, with a hood and brown/dark bands from the front.
  Render warning: `body.tail: the tail reaches 0.14 torso lengths below the ground`.
- attempt2: torso pitch 14, tail pitch 6. Warning stayed (0.13) and the tail now angled up into the air. Worse.
- attempt3: torso pitch 6, tail pitch 4, neck pitch 75. Warning changed to `body.torso: the torso reaches 0.06 torso lengths below the ground — lengthen the legs or make body.torso.radius smaller`.
  Accepted: it is small and the render shows nothing wrong.
- Could not achieve: a real S-curve (the docs warn about it), the hood flaring out above a thin neck, a rear body that rests on the ground and still lifts the front smoothly, hood or neck sway during slither.
- Gait: `slither` only. The default filmstrip is a top view, so the rearing is invisible; `--view side` shows the erect neck staying up while the tail wave runs behind it. FootSlide 0 (no feet).
  The reared neck stays perfectly stiff while the body slithers; it reads as a stick on a sine wave.
- Bite (side view): the head dips and thrusts forward about one head-width and recovers; contact at 0.22 s. Reads well enough for a strike.
  Roar (side view): barely visible, the head is a few pixels tall in a 3 m wide frame. The default top view of bite and roar shows nothing useful.

### p19-rhino (quadruped)
- attempt0: scale 1.5, big torso profile, short thick neck, wedge head pitch -20, legs 0.5, nose horn (docs recipe sizes) plus a smaller horn at 0.45, small cone ears,
  grey `scales` material with a `scales` layer and light grime. Valid. It already read as a rhino or a hippo-rhino: horns correct, hide scaly.
- Looking at it: body a long smooth tube, head small, legs thin, horn short.
- attempt1: head length 0.5, radius 0.17, `tall` cross-section, torso `[0.24, 0.31, 0.29, 0.22]`, legs 0.58 and thicker, big horn length 0.36 width 0.075 curve 40, small horn 0.17, larger ears, scales size 0.08 bump 0.6.
  Much better: heavy, big horn at the nose, smaller horn behind, plated grey hide.
- attempt2: neck 0.3, shoulder hump in the torso profile, horn curve 50. Mostly cosmetic.
- Could not achieve: a head-butt or gore action (only bite, roar, look exist); the bite does not lunge visibly; the hide reads as paving stones or armour plates rather than skin folds.
- Gait: walk, duty 0.75, lateral sequence (hind-L, fore-L, hind-R, fore-R pattern), footSlide 3e-7 m. Trot at `--speed 2.5`: diagonal pairs, duty 0.5, footSlide 2e-7 m.
  Both look heavy and plausible; the body stays level and does not roll or bob. `lumbering` temperament feels right.
- Roar: head and the big horn rise steeply, jaw opens, `roar-peak` 0.84 s. Reads well. Bite: jaw opens, no real lunge (neck short), reads as a yawn.

### p20-nightmare-hound (quadruped)
- attempt0: scale 1.1, `spikes.row` on `spine` (count 20, height profile, jitter 0.8, curve 35), red slit eyes (`irisColor #ff2010`), fangs, black palette, `grime` in brown. Valid.
  Looking at it: very dark, details unreadable, the body and head too thin and lizard-like, the grime invisible on black.
- attempt1: deeper chest (`[0.17, 0.23, 0.18, 0.1]`), thicker legs, bigger head, pointed ears (`horn.curved`, skin colour), spine colours `#4a3a3c` to `#b03a2c`,
  grime colour `#7a6a58` at amount 1.0, a faint dark `mottle` layer. Much more hound-like; grime shows on the feet and legs.
- attempt2: darker palette (`#08080a` base), less mottle. Reads as black with dirty brown legs.
- Could not achieve: grime up the body (it stays on feet and lower legs, even at `amount 0.9, creases 1`); the body still looks a bit reptilian from the side because of the arch and thin tail.
- Gait: walk (duty 0.75, footSlide 2e-7 m) and trot at 3 m/s (duty 0.5, diagonal pairs, footSlide 9e-8 m, stride 95 cm). Clean, athletic, no sliding.
- Roar: head and neck lift, mouth opens wide, fangs show, `roar-peak` 0.73 s. Reads well. Bite: the head lunges down and forward and snaps; contact 0.27 s. Reads well.

## Docs and tools: confusing, missing or wrong

1. **`--view` is not in the docs.** `docs/blueprint.md` says "`--filmstrip`, optionally `--gait trot` or `--speed 2`" and "Serpents are drawn from above to show their wave", but `--view side|3/4|top` is documented
   only in the task prompt. For serpents, `--action bite` and `--action roar` default to the top view and show almost nothing. There is no `front` view, which is the view that shows leg spacing on bipeds and quadrupeds.
2. **The insect mandibles recipe does not hold for a big head.** "`horn.curved` on `head`, `at` 0.08, `angle` 100; `length` 0.2, `width` 0.025, `lean` 60, `curve` 110, `turn` 90" gave small hooks hanging below the chin on a head of radius 0.15.
   Forward-pointing mandibles needed `at 0.04, angle 80, lean 90` (the maximum), `length 0.32`. The doc does not say that `lean` caps at 90 or that parts on `head` do not follow the jaw, and parts on `jaw` droop (like tusks).
   A "mandible" slot or part that moves with the jaw is the missing piece for ants and beetles.
3. **Bite on short-necked bodies.** The catalogue says bite "Lunges the head at a target and snaps the jaw shut" and `reach` is "How far the neck may stretch, as a share of its reach".
   On the ant (neck 0.06 to 0.16), goblin and rhino the head hardly moves; you see the jaw open. Nothing says a short neck means almost no lunge. The filmstrip also does not show the target.
4. **Misleading ground warnings for legless bodies.** On the cobra: "`body.torso: the torso reaches 0.06 torso lengths below the ground — lengthen the legs or make body.torso.radius smaller`". There are no legs.
   The first warning ("raise body.tail.pitch or give it a positive curl") made things worse when followed (tail lifted into the air). The docs never say where a pitched torso pivots; raising the front of a serpent torso drops its rear end below ground.
   A "rearing" recipe for serpents is missing: what worked was neck pitch 75, torso pitch about 6, tail pitch about 4.
5. **Countershade and stripes on a reared neck.** The neck's belly side faces forward, so the front of a reared cobra renders cream, and `stripes.fade` default 0.6 fades the bands on it.
   The prompt "brown with dark bands" needed a dark belly colour, `strength 0.6`, `fade 0.1`. Worth a sentence in the docs.
6. **Biped stance.** The preset legs sit at `angle 130` with `splay 0`. With thick legs the feet end up under the belly and cross in a 3/4 view; I needed `angle 105` and `splay 10`.
   The biped also always rests in a half crouch, even with `temperament calm`; the docs say temperaments set "a crouch and a lowered head for stalkers" but not that a biped is bent-kneed at rest.
7. **Validation messages, mostly good.** Examples: "`did you mean "length"?`", "`"horn.curve" ... did you mean "horn.curved"?`", "`nothing named "headd" to attach to ... did you mean "head"?`",
   "`this creature has no tail`". Weak spots found by probing: a typo `len` in horn params suggests "`did you mean "lean"?`" (the real intent is `length`); `"blak"` in `grime.color` gets
   "`add it to skin.palette`" with no colour-name suggestion; and checks of `attach.on`, params and colours stay hidden until `type` is fixed (documented, but a second round is needed).
8. **Contact sheet label clutter.** On small creatures (goblin, ant, hound head), the part labels stack on top of each other (`eyes.R`, `nose`, `ears.R`, `head`) and are hard to read.
   Filmstrip frames frame the whole creature, so the head of a 3 m cobra is a few pixels tall; a head-crop option would help for judging jaw actions.
9. **Minor docs check.** The tip "Big eyes need a large `size` (0.06–0.1 for cartoon eyes)" worked as written (goblin 0.1). The "Sizing" line (biped 2.5 × scale) was accurate (scale 0.5 gave 1.0 m).
   "`scleraColor`" is useful for insect and demon eyes but is not mentioned outside the catalogue.

## What the filmstrips showed, per creature

- **Ant soldier**: tripod gait correct, no slide, quick and skittering. Bite barely visible; mandibles static.
- **Goblin**: walk correct on paper (no slide, double-support overlap) but the crouched, bent-knee stance makes it look like a shuffle. In the 3/4 view, legs crossed until the stance was widened. Roar and bite readable; look not really visible.
- **Cobra**: slither is a clean S-wave from above, the reared neck stays rigid. Side-view bite is a decent strike; roar nearly invisible at this framing.
- **Rhino**: heavy, believable walk and trot, no slide, diagonal trot. Roar strong, bite weak (a yawn).
- **Nightmare hound**: best motion of the five. Walk and trot clean, roar and bite both read clearly.
- Across all five, `footSlide` was at most about 3e-7 m, so no gait slid. The problems were in the look of the poses (crouch, stiff neck) and in how weak bite is on short necks, not in footfalls.
