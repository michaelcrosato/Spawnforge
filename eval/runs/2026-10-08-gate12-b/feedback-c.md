# Gate 12, set b (b11 to b15): feedback from agent c

Worked only from `docs/blueprint.md`, `docs/catalog.md`, the CLI and `examples/README.md` (the table of
examples). I did not open any example JSON or PNG, so every blueprint below was written from the docs
alone. All renders went to my scratch folder.

## Summary

| Prompt | Attempt files | First valid | Revisions after it, and what drove them | Final analyze warnings |
| --- | --- | --- | --- | --- |
| b11-sea-turtle | attempt0 to attempt4 | attempt0 (no errors, no warnings) | 4. a1: render showed a flat shell, a beak that covered the whole round head, short thin flippers. a2: render showed the beak still hid the eyes, so snout head, explicit eyes, `dome` 1.0, deeper torso. a3: `analyze` `wing_intersection` on the front flipper (3.0 cm into the ground), attach `angle` 105 to 85. a4: the same warning appeared on `rearflipper` only after a3 (1.3 cm), `angle` 110 to 90 | none |
| b12-quillback-boar | attempt0 to attempt4 | attempt0 (no errors, no warnings) | 4. a1: render showed a bloated blob on stick legs with hooves too small to see; thicker legs, bigger cloven hooves. a2: render showed a small head and no ears; longer head, `ear.pointed`; also applied analyze's "5 more degrees of splay" fix. a3: `analyze` `limb_intersection` (foreleg and hindleg into the torso); fixed by thinning torso and leg radii and splay 12 (found by trying variants in scratch). a4: render showed the scars were too small and faint; `region` torso, longer, deeper, paler | none |
| b13-frilled-lizard | attempt0, attempt1 | attempt0 | 1. `analyze` `below_ground` (tail, preset pitch -20 with a 1.8 long tail) and `overstretch` (foreleg 17% of the time); tail `pitch` -2, `curl` 10, legs lengthened 0.42/0.5 to 0.5/0.56 | none |
| b14-stegosaur | attempt0, attempt1 | attempt0 | 1. Render showed the plates and tail spikes too small to read; taller plate profile, 3 spikes per side, longer and thicker. Also restricted `motion.gaits` to walk and trot because the default said a 1.8 t stegosaur gallops at 12 m/s | none |
| b15-sail-back | attempt0 | attempt0 | 0. Render, flare render and display filmstrip all read as a dimetrodon at once | none |

Every final blueprint validates with no errors, no warnings and nothing under `notBuilt`, and
`analyze` reports no warnings.

Final answers: `b11-sea-turtle.attempt4.json`, `b12-quillback-boar.attempt4.json`,
`b13-frilled-lizard.attempt1.json`, `b14-stegosaur.attempt1.json`, `b15-sail-back.attempt0.json`.

## Overall

- The eval is easy to short-circuit. `examples/README.md` and the "Recipes for the new bodies" table in
  `blueprint.md` list a creature for nearly every prompt in this set (sea-turtle, tusk-boar,
  frilled-lizard, plated-stegosaur, sail-back, porcupine for quills), and the recipe table names the
  file to copy. An agent that opens them can copy the answer. If this set is meant to measure the
  docs and tools, take the same-name examples out of the run, or ask for creatures that are not in
  `examples/`.
- Having read the docs, the first blueprint of all five was valid and read as the right animal at first
  render. The recipes and the module descriptions with `slot`, `defaultAttach` and an example were
  enough. This is the strongest part of the format.
- Rendering takes 20 to 30 s a call and was the slow step. Several renders can run in parallel; that
  worked fine.
- The `patch --out` workflow made attempts cheap: set a few paths, write the next attempt file. Trying
  variants in a scratch folder with `patch --out` and `analyze --summary | grep message` was the fastest
  way to settle the fix suggestions below.

## b11-sea-turtle

- **Beak versus head and eyes was the main trap.** With `beak` on the default round head the beak
  paints the whole head tan, and the quadruped preset's eyes (at 0.35, angle 55) sit under or behind it,
  so a contact sheet shows a bald tan ball. `beak.length` and `depth` hardly change this. What worked:
  `head.shape` "snout", a longer head, a duller `color`, and my own `eyes` part at `at` 0.5, `angle` 65,
  `scale` 1.8. The beak entry in `blueprint.md` ("covers the snout in two halves") should say that it
  needs a head with a snout to cover and that eyes should go behind the beak line (`at` 0.45 or more),
  or the beak could stop short of the eye position itself.
- **`wing_intersection` on flippers.** The code and the fix text talk about wings ("attach it higher
  ... or make it shorter") but the limb is a `fin` and the creature is a swimmer that never meets the
  ground. The message says "passes 3.0 cm into the ground half spread", which a turtle author cannot
  map to anything: what is half spread, and why is the ground relevant for a water creature? The fix did
  work (lower `attach.angle`), but the explanation did not help. A name such as `limb_intersection` or
  `fin_intersection`, and "when beating in water" or "in its resting pose", would be clearer.
- **Warnings show up one limb at a time.** After fixing the front flipper, `rearflipper` raised the same
  warning, which was not listed before. `blueprint.md` says `analyze` lists every pair that meets "at
  once" (that holds for `limb_intersection`), but `wing_intersection` seems to report only the worst
  one. That cost an extra revision.
- Unhelpful `analyze` output for a pure swimmer: `speed.walk` 0.83 m/s is reported for a creature with
  no legs, and the description ends "it can bite, lash, look and roar" for a turtle (a tail gives it
  `lash`, a jaw gives it `roar`). Neither is wrong by the rules, but neither is useful. The filmstrip
  footnote for `--gait swim.flap` read "no legs: the body follows its own trail (slither)", which is the
  wrong gait named in the caption.
- `shell` `dome` 1.0 and `overhang` 0.2 still gave a modest hump (48 cm high on a 1.4 m body). Fine for a
  sea turtle, but the catalogue's "1 a high tortoise shell" would be easier to trust with a number for
  the height it adds in torso lengths. A `wide` torso cross-section was also needed and is only
  mentioned in the tortoise sentence.
- Docs gap: the sea turtle recipe says to remove `foreleg` and `hindleg` and add fin limbs with a null
  membrane, but does not give `at` and `angle` values that clear the ground. Front flippers at `angle`
  85 and rear at 90 on a `wide` torso were what `analyze` accepted.

## b12-quillback-boar

- **The `limb_intersection` fix text was wrong for me.** At splay 5 the foreleg passed 2.1 cm into the
  torso and analyze said "about 10 degrees more splay works best". I set splay 10 (and lengthened the
  head); the penetration grew to 3.2 cm and a hindleg warning appeared too. Then attach `angle` 125 or
  135 made the hind pair collide with each other (2.8 cm, 5.1 cm), and `angle` 105 gave 5.2 cm, so the
  note "a lower attach.angle can make it worse" was half right and gave no direction. What cleared it
  was thinning the torso radius (`[0.15, 0.2, 0.19, 0.14]`) and the leg root radii (0.085 and 0.095),
  then splay 12. A message that names the cause (the leg's root `radius` is wide for the torso's
  `radius` at that point) would have saved two revisions. The fix also changes meaning when other values
  change, so suggesting a single parameter is risky.
- **`quills` spread over the flanks.** `area: "back"` is within 70 degrees of the top on both sides, so
  the quills form a wide mane over the shoulders and sides and the boar reads as a porcupine with
  tusks. There is no parameter to narrow the band to a crest, other than `spikes.row` on `spine`. A
  `width` or `spread` angle on `quills`, or an `area` value of "ridge", would match "quills down its
  back" better. Also, `quills` needs `display` to raise them, and the boar's description lists
  "display" among its actions, which is nice.
- **`scars` look like white fans.** With `rake` 3 and a pale `color` the scars render as large pale
  fan-shaped smears. At `count` 16 and `length` 0.2 they were barely visible; at `count` 14, `length`
  0.26, `depth` 0.8 and `region` "torso" they were clear but loud. Some guidance on how to get
  "old, healed" (lower `depth`, a colour close to the base) would help, as would a note that `count` is
  spread over all regions, so `region` plus `count` needs a hand calculation (the docs mention this once
  in the Skin section; it is easy to miss).
- `foot.hoof` `size` and `height` exist and were needed: at defaults the hooves of a 1.1 m boar were
  specks. The recipe row for boar-like creatures in the "Big mammals" table is missing; horse, big cat
  and bear are there. A pig or boar row (deep torso, short thick legs, cloven hoof `size` 1.3) would
  have saved the first two revisions.
- Heads: `head.brow` 0.5 and `lips` 0.2 read well. There is no way to make a boar's snout disc; a
  `snout` pad option would help, but this is a want and not a gap.
- Ears are not on the `quadruped` preset, only eyes, so a creature with `ear.pointed` forgotten reads as
  wrong at once. A single line in the quadruped preset note ("add `ear.pointed` yourself") would help.

## b13-frilled-lizard

- This went the most smoothly. The `frill` entry and the recipe row ("`frill` or `hood` on the `neck`,
  and `display` in `motion.actions`") were exact. `render --flare 1` showed the open frill at once and
  `render --filmstrip --action display` showed it opening. The filmstrip option `--action display` is not
  in `blueprint.md` (it names bite, roar and look); it works and should be listed.
- Lizard proportions needed values the docs only half give: the sprawl note (`splay` 50 to 60 and attach
  `angle` 110 to 120) is in two places and I had to put them together. The `quadruped` preset's tail
  `pitch` -20 sinks a long lizard tail into the ground (`below_ground`), and `overstretch` hit a leg of
  0.42 with splay 55. Both fix texts were correct and worked first time. A sentence in "Sizing" or
  "Limbs" that sprawlers want a tail `pitch` near 0 and legs 0.5 or longer would save the analyze
  round.
- `display` duration: for a 0.4 m creature the display lasted 0.82 s ("scales with size"), too short to
  read as a threat. `duration` can be set, but the default for small creatures is brief.
- The frill folded at rest is a small orange flap under the head; at first glance it is not obviously a
  frill until it is opened. This is right for the prompt (it opens when threatened) but worth saying in
  the docs so authors do not raise `open` to compensate.

## b14-stegosaur

- The recipe row ("`plates.row`, `sail` or `quills` along the `spine`") named the right part, and the
  `plates.row` catalogue entry (kite shape, alternate, `edgeColor`) was enough. The thagomizer needed a
  guess: `spikes.row` on `tail` with `side` "both" and an attach `angle`. The `spikes.row` text says
  "a row of conical spikes ... down the spine at angle 0", and nothing says that a row with an angle of
  50 to 70 and `side` "both" makes two rows pointing out and up, which is what a tail club needs. A
  one-line recipe ("tail spikes: `spikes.row` on `tail`, from 0.6 to 0.95, `angle` 50, `side` both,
  `count` 3") would help.
- Fractions along `spine` need arithmetic. I had to work out neck 0.34 + torso 1 + tail 1.1 = 2.44 and
  place the plates at 0.17 to 0.7 by hand. It works, but `on: "torso"` plus a tail part, or a named range
  such as `from: "torso.start"`, would be simpler.
- Plausibility is not checked on speed. By default `analyze` says a 1.8 t `lumbering` stegosaur gallops
  at up to 12.2 m/s, and trots at 4.3 m/s after I removed the gallop. No warning, and `lumbering` does not
  cap it. I removed the gallop with `motion.gaits: ["walk", "trot"]` (it worked, and the "a list replaces
  the defaults only for the media its gaits serve" sentence was accurate), but I think a mass-based
  `max_speed` warning, or `lumbering` capping at the trot, would be a better default.
- Proportions: a high-hip, low-shoulder posture came from `torso.pitch` -6, `arch` 0.16 and hindlegs
  0.78 over forelegs 0.5. Not in the docs; I guessed it from the phrase "the torso `pitch` tilts it up" and
  it worked. A "Stegosaur" recipe line giving this posture would be useful.

## b15-sail-back

- Smooth: `sail` on `spine` from 0.15 to 0.55 with a `height` profile `[0.1, 0.5, 0.1]` and 14 `spines` gave a
  dimetrodon on the first try. The `display` filmstrip shows the sail nearly the same as at rest, because
  the sail already stands at rest (it has no `open` parameter in the catalogue). `blueprint.md` says
  frills, hoods and sails "rest folded (`open` says how far ...)", but the catalogue's `sail` entry has no
  `open` and the render shows it standing. Either the sentence or the module should change; I think the
  sentence ("a sail leans back a little") is the accurate half and "folded" is not.
- `veins` with `region: "wings"` paints the sail's skin (I tried it in scratch; it shows faintly). The
  docs say `wings` covers "wing and fin membranes"; sails, frills and hoods are not listed there. It would
  help to say that membranes of all kinds, sails included, are in `wings`.
- Front view shows the sail as a single thin spike, as expected, but the legs of a `splay` 50 sprawler with
  `foot.claw` look like a press-up from the front. Nothing to fix; just noting that the front view is
  not the one to judge a sail-back from.

## Error messages and warnings

- No validation error occurred in this set; every attempt0 validated, so I cannot report on error text.
- Unhelpful: `wing_intersection` on flippers (see b11), and `limb_intersection` `fix` strings that name
  one parameter and amount when the result is not monotonic (see b12). Also, `wing_intersection` lists
  one limb at a time.
- Helpful: `below_ground` and `overstretch` on the lizard named a path and a fix that worked first time.
  `analyze`'s one-paragraph description was accurate on all five and confirmed colours, parts and
  counts (it even read "tan scars on the torso" after I set the region).
