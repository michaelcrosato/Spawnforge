# Gate 12, agent B: feedback

Five prompts (p06 to p10), written from `docs/blueprint.md`, `docs/catalog.md` and `examples/` only,
checked with `validate`, `render` (contact sheet, head and top views, filmstrips) and `analyze`.
Renders are in `/tmp/claude-0/-home-user-spawnforge/f521b2e4-a6af-5719-a040-22132fcd63b2/scratchpad/gate12-ab/`.

## Summary table

| Prompt | Attempt files | First valid | Revisions after it, and what drove them | Final `analyze` warnings |
| --- | --- | --- | --- | --- |
| p06-ram-demon | attempt0 to attempt4 (final: attempt4) | attempt0 (no errors, no warnings) | 4. a1: `limb_intersection` leg.L into leg.R (2.2 cm) on rough ground, so leg attach `angle` 130 to 118; render showed the recipe's 0.65-long horns too small for "big", so 0.95. a2: render showed a sack-shaped body and a tiny head, so a bigger head and neck, a waist, a thin tail added, horns moved to `at` 0.62 / `angle` 92. a3: tried longer legs (1.4) to cure the deep walk crouch; the crouch did not change and `limb_intersection` came back (a regression). a4: back to a2's legs, plus forked tongue and bigger eyes (head close-up) | none |
| p07-sprawl-lizard | attempt0 to attempt3 (final: attempt3) | attempt0 (no errors, no warnings) | 3. a1: `foot_slide` 0.3 cm, so longer legs (0.45 / 0.5); render showed the tail rising in a ramp (the preset's `curl` 10 plus the tail `pitch`), so `pitch` 0 and `curl` 0; replaced the default action list (it included roar, jump, pounce). a2: spots only a few pixels wide at 512 px, so `size` 0.05 to 0.075 and more colour contrast. a3: "tiny": 60 cm overall did not read as tiny, so `scale` 0.12 to 0.09 (45 cm) | none (but see the cadence note below: 13 steps a second walking and 18 trotting, not flagged) |
| p08-boar | attempt0 to attempt4 (final: attempt4) | attempt0 (no errors, no warnings) | 4. a1: `ground_penetration` (head 5.6 cm into the floor) and two `limb_intersection` (3.6 and 4.2 cm), so longer legs (0.48 / 0.5), a smaller head and torso, more splay. a2: the extra splay made `analyze` call the legs "sprawling" and the body was a blob, so splay back to 26 / 24, a humped torso profile, a longer snout. a3: the tiny tail was invisible in every view (buried in the rump), tried `length` 0.16, `pitch` 38: still hidden. a4: `length` 0.3, `pitch` 20, `curl` 70: a small tail finally shows | none |
| p09-long-neck | attempt0 to attempt3 (final: attempt3) | attempt0 (no errors, no warnings) | 3. a1: render showed thin, bird-like legs and a small body, so thicker legs, a deeper torso, `stance` "unguligrade"; this introduced `limb_intersection` foreleg into hindleg (4.2 cm on flat ground). a2: legs `attach.at` 0.07 / 0.93, which cleared it. a3: lizard cues added (a spine crest on the neck and back, bands on the tail) | none |
| p10-scorpion | attempt0 to attempt2 (final: attempt2) | attempt0 (no errors, no warnings) | 2. a1: render showed the tail looping past the head (the doc recipe's `length` 2.4, `pitch` 40, `curl` 200) and a thin abdomen, so `length` 1.9, `pitch` 55, `curl` 185 and a fuller torso profile. a2: a bulb near the tail tip (radius profile, 12 segments) and small dark scorpion eyes | none |

All five first attempts validated with zero errors and zero warnings, and none used `notBuilt`
features. Every revision was driven by a render or by `analyze`, never by `validate`. The recipe
table in `blueprint.md` is what made that possible: the ram-horn row, the tusk row, the scorpion
stinger row and the crocodile and frilled-lizard examples gave first guesses that were close.

## Cross-cutting findings (most useful first)

1. **`fast_cadence` is silenced by `skittish`, and nothing can fix a tiny creature's cadence.**
   The doc says "make them bigger or, if they are meant to be that small, skittish". I tried
   both on the lizard. With `skittish` the warning disappears, but `analyze` (full, not
   `--summary`) still reports `cadence` walk 11.5 and trot 15.4 steps a second at `scale` 0.12;
   at the final `scale` 0.09 it is 13.3 and 17.8, at 0.08 it is 14 and 19. Making the creature calm brings the warning back (with
   `stride` 2 it read 10.8 and 15.4). Things I tried that barely moved it: gait `stride` 2 (11.5 to 10.8), longer legs with
   `splay` 50 (11.0), and `scale` 0.16 (9.5, still over 8). A `stride` above 1 does nothing on
   short sprawled legs, as the doc says, so the doc leaves a tiny walker with no remedy except
   "skittish hides the message". Suggestions: say in the `fast_cadence` text and in
   `blueprint.md` that `skittish` suppresses the check without changing the motion; give tiny
   creatures a way to slow the cycle (a gait `rate` or `tempo` multiplier, or a clamp of the
   cadence at some ceiling with shorter strides); include `cadence` in `analyze --summary`
   (it is one of the headline checks but only the full output shows it).
2. **A filmstrip is not useful for a tiny walker.** The lizard's cycle is 0.08 s, the frames are
   0.01 s apart and look identical, and the strip says "stride 2 cm". An option to slow the
   strip, or to take the frames across several cycles, would show whether anything is wrong.
3. **Default actions are silly for some bodies.** Leaving `motion.actions` out gives the
   tiny lizard "bite, jump, lash, look, pounce and roar" (its description says so). The doc
   explains it ("every action the body allows") but I only noticed it in the `analyze`
   description; I wrote an explicit list for the lizard, boar and grazer. A note in the
   `motion.actions` row of the quick start ("list the ones you want for small or gentle
   creatures") would save a step.
4. **Inherited preset values are invisible.** The quadruped preset's tail `curl` 10 lifted my
   3.6-torso-length lizard tail into a ramp (measured height 9 cm; 5 cm once `pitch` and `curl`
   were 0 and the legs were a little longer) and I found out only from the render. `validate` prints the minimal blueprint (differences from
   the preset), which cannot show an inherited value; the CLI help lists `validate --expanded`
   but `blueprint.md` never mentions it. Please mention `--expanded` in the Presets section,
   and consider saying in the Tails paragraph that presets carry a `curl` and `pitch` that a
   very long or very short tail inherits.
5. **Very short tails vanish.** A boar's "tiny tail" at `length` 0.12 and 0.16 (torso lengths)
   was buried in the rump in every view, even at `pitch` 38; only `length` 0.3 with `pitch` 20
   shows. `analyze` still describes "a short tail", so nothing says the tail cannot be seen. A
   doc line ("a tail shorter than about the torso's end radius is buried; a visible stub is
   about 0.3") or a `tail_hidden` warning would help.
6. **Upright bipeds walk in a deep crouch and I could not find what controls it.** The demon's
   knees bend a great deal in the filmstrip and a leg `length` of 1.15 or 1.4 (preset 1.3) made
   no visible difference; `temperament` only changed the pace (1.7 m/s aggressive, 0.9 m/s
   lumbering). The bog troll example's side view shows a similar bent-knee stance. Nothing in `blueprint.md` says why the
   hips sit low or how to stand taller. Even a sentence ("a biped's legs always flex; the
   hips sit at about N of the leg length") would settle it.
7. **Docs say `jaw: true` "adds" a jaw** (Body table), but the catalogue's default is `true`.
   A first-time reader thinks it is opt-in.
8. **Fix hints are good, but some trade one look for another.** `limb_intersection` on the
   boar offered "about 15 more splay or a thinner body". Taking the splay made the legs read
   as sprawling (the description switched to "sprawling legs"), which is wrong for a boar. A
   hint that names the cost ("more splay makes the legs read as sprawled; a thinner torso keeps
   them upright") would let a model pick right the first time.
9. **Spots on a small animal.** The docs warn about it, and the recommended command
   (`--views top,3/4 --size 900 --quality high`) works. It is the only way I could judge the
   lizard; the standard 512 px sheet shows the spots as a few pixels.

## Per prompt

### p06-ram-demon
- **Easy:** the recipe row for ram horns on an upright biped's head (`at` 0.6, `angle` 85,
  `turn` -70, `lean` 10, `curve` 400, `ridges` 12) worked on the first try, and the stripes, goat
  pupils, hooves and fangs all did what the catalogue said.
- **Confusing:** "big" is not defined. At the recipe's `length` 0.65 the horns were small next
  to a 2 m demon; 0.95 (the maximum is 1) read as big. A recipe row for "big ram horns" would
  help, and so would a note that horn `width` should drop as `length` rises or the coil goes
  fat.
- **Missing:** how to stop a `wide` biped torso looking like a sack with no neck; the doc warns
  only against `tall`. I fixed it by a bigger head (0.18 radius), a thicker neck and a waist in
  the torso profile (`[0.16, 0.27, 0.18, 0.13]`). No recipe for a demon's silhouette beyond the
  `demon` theme's one-line description.
- **Missing:** the crouch problem above (item 6).
- **Message that did not help:** none. The `limb_intersection` advice ("attach both higher up
  the side (a lower `attach.angle`)... splay barely helps here") was right at leg length 1.15
  and did not clear it at 1.4 (the warning came back at 2.0 cm); it did not mention that
  shorter legs also clear it.

### p07-sprawl-lizard
- **Easy:** the frilled lizard and crocodile examples gave `splay` 45 to 60, the `angle` 110 to 120
  advice and the tail numbers; the first attempt looked like the prompt.
- **Missing:** what "tiny" means in `scale` terms. The Sizing paragraph covers presets only. I
  settled on a torso of 9 cm (45 cm overall with a 3.6-torso tail) after finding that 12 cm gave
  60 cm overall. A line such as "a gecko is `scale` 0.05 to 0.08" would help.
- **Confusing:** cadence (items 1 and 2). I could not tell from the docs whether a tiny walker
  that steps 11 times a second is a defect or expected.
- **Harder than it should be:** keeping the tail low. `pitch` 3 with the preset `curl` 10 lifted
  it; I needed `pitch` 0 and `curl` 0. A reader would not guess that the preset's `curl` is
  still applied.
- **Message that did not help:** `foot_slide` "lengthen the leg or move it so the foot sits
  under the hip (`attach.at`, `splay`)" was fine; lengthening cleared it.

### p08-boar
- **Easy:** `examples/tusk-boar.json` and the tusk recipe row; the tusks, cloven hooves, ears and
  bristles worked immediately.
- **Confusing:** the stocky-body numbers are a balancing act between `ground_penetration`,
  `limb_intersection` and the look. At torso radius 0.29, leg 0.38 the head went 5.6 cm into
  the floor, and the two fixes (more splay or a thinner body) pull in opposite directions
  (item 8). It took three attempts to find short legs that stay upright.
- **Missing:** how short a visible tail is (item 5), and that `analyze`'s description says "short
  tail" even when the tail is not visible.
- **Message that helped:** `ground_penetration` "lengthen the legs, raise the section (`pitch`,
  `curl`) or make it slimmer" named three options, and `head.pitch` -18 to -12 plus slightly
  longer legs fixed it.

### p09-long-neck
- **Easy:** `neck` allows length up to 1.5, `pitch` 72 and `curve` 20 gave a convincing
  swan-necked giraffe on the first try; `spots` on `all` needed nothing more.
- **Confusing:** `stance: "unguligrade"` made no visible change to the legs in the filmstrip.
  The doc says planted feet roll with a stance, but at walking speed on long thin legs I could
  not see it. The legs bend like a bird's (the knee points
  forward, the hock back), which the doc does not mention for 1.1-torso legs; there is no
  field for a straighter leg.
- **Missing:** a "crossed with" instruction. I read "giraffe crossed with a lizard" as a giraffe
  with a lizard's head (`wedge`, forked tongue, `scales` material), a spine crest and a
  banded tail. The doc has no guidance on hybrids besides `crossbreed` between two blueprints,
  which would have been a different route (it needs two files, which the prompt did not give).
- **Message that helped:** `limb_intersection` "the front and hind legs meet in the stride: a
  smaller gait `stride`, `attach.at` further apart, or thinner legs, by about 4 cm". Moving
  `attach.at` to 0.07 / 0.93 cleared it in one go and kept the proportions.

### p10-scorpion
- **Easy:** the Spider or scorpion row and `dune-scorpion.json` for the stinger and the tail;
  the `hexapod` preset needed only a longer tail and a pale palette.
- **Confusing:** the scorpion row is for an `octopod` with pincer arms. The prompt says six legs,
  so I used a `hexapod` and no arms; the doc does not say what to do when the prompt wants a
  scorpion shape on six legs (should the pincers be dropped?). I kept six limbs so "six legs"
  stays literally true.
- **Harder than it should be:** the recipe's tail numbers (`length` 2.4, `pitch` 40, `curl` 200,
  said to be "on a hexapod's short torso") overshot: the tip hung in front of the head and the
  creature stood 77 cm tall. Reaching a tail that ends over the thorax took `length` 1.9, `pitch`
  55, `curl` 185. The recipe should say these numbers depend on the torso profile, or give a
  rule: tip lands over the thorax when `curl` is about 180 and `length` is about 1.5 to 2 torso
  lengths.
- **Missing:** nothing for a tail bulb beyond the club recipe; the swell at the stinger end is
  barely visible after smoothing (12 segments).
- **Message that did not help:** none; `analyze` was clean throughout.

## Minor notes
- All `validate` calls passed first time, so I cannot comment on error messages: I never saw an
  error. Warnings I did see (`limb_intersection`, `ground_penetration`, `foot_slide`) were
  specific and carried paths and amounts.
- The `render` JSON echoes the whole `info` block, which is useful; `warnings` there was always
  empty even when `analyze` had warnings (render does not run the motion checks). It could say
  "motion checks not run" to avoid confusion.
- `analyze --summary` drops `cadence` and the speed breakdown but keeps `reach`; I used the full
  output when I needed cadence.
