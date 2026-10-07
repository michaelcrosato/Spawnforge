# Gate 9, suite B: feedback (run a)

Worked only from `docs/blueprint.md`, `docs/catalog.md`, `examples/` and the CLI. Renders went to the
scratch folder, not the repository. Nothing under `packages/`, `apps/`, `scripts/` or `eval/` was read.

One disclosure: my first validation loop was `for f in *.attempt0.json`, which also validated two
files in this folder that are not mine (`b06-kraken.attempt0.json`, `b16-giant-moth.attempt0.json`).
I saw only their `validate` output (both `ok`; the kraken lists `motion.media.water` under
`notBuilt`). I did not open, edit or render them. A final `ls` of the folder also showed other prompts' files
(parallel runs); I saw only their names.

## Summary

| Prompt | Attempt files | First valid | Revisions after it, and what drove them | Final `analyze` warnings |
| --- | --- | --- | --- | --- |
| b01-dragon | `attempt0`, `attempt1` | attempt0 | 1. Looks only: the dragon read thin next to its wings, so I raised `muscle` and the torso, neck and leg radii, and made the tail spikes taller. No `analyze` finding. | none |
| b02-wyvern | `attempt0`, `attempt1` | attempt0 | 1. Looks only: the recipe's stinger (`length` 0.14, `width` 0.025) was a black speck on the tail tip, not readable at a glance. I grew it to 0.26 and 0.04 and added swept-back horns so the head reads as a wyvern. | none |
| b03-giant-bat | `attempt0`, `attempt1` | attempt0 | 1. Looks only: `#3a2618` rendered near black, not "dark brown", so I lightened base and belly. "Giant" was `scale` 0.8 (5.4 m span); I brought it to 0.7 (4.8 m span). | none |
| b04-hydra | `attempt0`, `attempt1` | attempt0 | 1. `analyze` warning `limb_intersection` (hindleg.L 2.6 cm into the torso on rough ground, fix "about 5° more splay"). I raised the hindleg `splay` from 22 to 28 and, in the same edit, thickened the legs and the muscle for a "heavy" body. The warning went away. | none |
| b05-cerberus | `attempt0`, `attempt1` | attempt0 | 1. Looks only: the ears were tiny (0.10 by 0.035), and the fur's fuzz was eating the fangs, so I made the ears bigger and the coat shorter (0.025 to 0.02). | none |

All five attempt0 files validated on the first run with no errors, warnings or `notBuilt`. All five
final versions validate clean. I looked at a 6-view sheet, and where it helped a spread-pose sheet
(`--pose spread`, b01 to b03), a gait filmstrip (b02) or a bite filmstrip (b04, b05).

## What went well

- The `Recipes` table covered nearly every request: horns swept back (`aim: "back"`), spikes down a
  tail, the stinger, pointed ears, the cave-bat proportions, `neck.count` for hydra and cerberus. I
  copied the closest example and edited it, and every attempt0 validated.
- `validate` error messages are good. I probed them on purpose with two scratch files full of
  mistakes (not in this folder). Typos get a did-you-mean (`ear.pointy`, `colour`, `region: "tails"`,
  `aim: "backward"`). A misplaced key says where it goes (`move "aim" into "params"`). Ranges give an
  example value.
- `patch` is pleasant: id paths (`parts[id=stinger].params.length`) work, and it prints a diff.
- `analyze`'s `limb_intersection` fix text was accurate: "about 5° more splay" cleared it.

## Cross-cutting issues

1. **`analyze` output is too long.** It prints about 150 lines of JSON (per-ground, per-gait motion
   blocks), and `warnings` and `description` come last. I had to pipe it through a script to read
   them. Please put `warnings` and `description` first, or add `--summary`. `describe-module` and
   `validate` are the right size.
2. **A default sheet hides the wings.** Wings rest folded, so on the default six views a leathery
   wing is a thin box on the shoulders (see b01's front panel, where the wings look like shoulder
   pads). "Bat-like wings" does not show without a second render with `--pose spread`. Suggestion:
   when a creature has wings, add a spread panel to the default sheet, or a `spread` entry for
   `--views`, so one render shows both poses.
3. **Spread renders frame the span, not the body.** In `--pose spread --views 3/4,front` the
   creature is a few pixels tall in the front panel, and the wing is a hairline because it is seen
   edge-on. The default sheet's title reads "1.5 m long, 71 cm tall, 64 cm wide" for a bat with a
   4.8 m span. Please show the wingspan in the title (analyze already has `measurements.wingspan`),
   and use a `top` panel by default in the spread pose, since it is the view that shows a wing.
4. **Label clutter on multi-headed creatures.** With `--labels`, five heads give about 25 labels
   (`eyes.L2.R`, `teeth.R1`, ...) that cover the creature in the 3/4 and side panels of the hydra.
   Suggest an option to label only the main head, or to collapse `eyes.*`, `teeth.*` and `ears.*`
   into one tag each.
5. **Chromium network noise.** Every `render` made about 60 failed connections to
   `www.google.com:443` and `android.clients.google.com:443` through the agent proxy, and the proxy
   printed a long notice. The renders still succeeded, but the headless browser should run with
   background networking, update checks and sync switched off.
6. **`render` prints a long JSON** (timings, backend) after every call. A one-line "wrote <png>" would
   do, with `--json` for the rest.
7. **The `analyze` description drops things I asked for.**
   - Fur is never mentioned: the bat is "dark brown skin and a brown belly" and Cerberus is "black
     skin and a charcoal belly", though both have a `skin.fur` coat.
   - A stinger is "a curved horn on its tail".
   - "Skin: red scales, an orange belly and scales." lists `scales` twice, once for the material and
     once for the layer, and reads like a glitch. Say "scaled" once.
   - A hydra with `splay` 28 is "sprawling legs", though I wanted heavy column legs. Pointing to the
     splay value in the description would help.
8. **`notBuilt` does not mention flying.** Dragon, wyvern and bat all have wings, so `media.air` is
   derived and flight is not built until 10.4. `validate` stays silent (docs: it lists only what the
   blueprint or its preset writes), so a model has no hint that its flyer cannot fly yet. I probed a
   scratch copy of the bat with `"media": {"air": true}` and `"gaits": ["walk", "fly", "glide"]`:
   it validates and lists three `notBuilt` entries. A one-line note on winged bodies, such as
   "wings are drawn; flight arrives in 10.4", would settle it. I left the explicit flight fields out of
   the answers, since the prompts did not ask for flying and wings already imply it.
9. **Fur and fangs.** In the head panels (Cerberus, bat), white specks and noise appear around the
   base of the fangs where the fur shells meet the teeth, so the fangs look half dissolved. Shortening
   the coat helped a little. Could fur clear the mouth line the way the docs say it clears the eyes?
10. **Black coats render murky.** A near-black base and belly (`#0e0c0c`, `#1e1a1a`) on the dark grey
    sheet background loses the form: the three heads and the paws read mostly from eye glints and
    fangs. The docs have no advice for "black". A rim light or a lighter panel background would help,
    or a doc tip such as "use `#1a1a1e`, not `#000`, so the shading shows".
11. **Wing membrane tint.** `membrane.bat` with `color` `#3a2820` (dark brown) looks lilac-grey in the
    spread 3/4 view, on all three flyers. I assume it is sky light through `translucency`, but the
    docs do not say the colour shifts. A note that translucency tints toward the sky, with a lower
    default for dark membranes, would help.
12. **`patch` writes in place.** The protocol says never to edit a saved attempt, so I had to `cp` first
    and patch the copy. `patch --out new.json` (like `migrate`, `generate` and `mutate`) would fit.
13. **`validate --quiet` is not described in the docs**, only in `--help` ("leaves the blueprint
    out"). The docs say `validate` returns the minimal blueprint but not how to turn it off.
14. **Size guidance is missing for fliers.** The sizing paragraph in "Units and directions" covers
    bipeds, quadrupeds, hexapods, serpents, fish, centaurs, wyverns and octopods but not bats, and
    says nothing on wingspan. I guessed. `scale` 0.8 gave 5.4 m, which is a "giant" bat but bigger
    than the dragon's body. A line such as "wingspan is about 6 to 7 times `scale` with the preset
    wings" would have saved a render.

## Per prompt

### b01-dragon

- **Easy:** copied `ash-dragon.json` and changed the colours. `aim: "back"` and the spike row on
  `tail` are in the recipes table.
- **Confusing:** the wing's colour. `membrane.bat` has its own `color` (default `base`). The skin
  section says layers with a region other than `wings` "leave membranes their own colour". I could not
  tell whether a red `base` would colour the wings, so I set the membrane `color` explicitly. State the
  default once, with an example.
- **Confusing:** `spikes.row` on `tail` takes `from` and `to` in tail fractions, while the recipe row
  for "spikes down the whole back" uses `spine`. The doc says "`on` names what to attach to" but does
  not say that a row on `tail` runs along the tail only. Obvious in hindsight.
- **Harder than it should be:** a dragon "scaly skin" needs `material: "scales"` and also a `scales`
  layer. The doc explains both, but a one-line "for a reptile use both" in the Skin section would help.
- No errors or warnings to judge.

### b02-wyvern

- **Easy:** `extends: "wyvern"` already has legs and wings and no arms, which is the prompt. The
  stinger recipe validated first time.
- **Harder than it should be:** the recipe's stinger (`length` 0.14, `width` 0.025, `curve` 60) is too
  small to see on the default sheet (about 17 cm on a 1.2 m torso). I needed 0.26 and 0.04 for it to
  show. Either enlarge the recipe values or say "scale up for big creatures". The curve direction is
  not obvious: `curve` 60 gave a hook curling up over the tail tip, which is what a scorpion stinger
  does, and the docs do not say which way it goes for a tail-tip horn.
- **Missing:** nothing says which presets have `arms`. `wyvern` has none, and `analyze` counts
  `arms: 0` and `wings: 2`; the table row "wyvern: two legs, wings for forelimbs" is clear enough, but
  the filmstrip shows the folded wings sitting on top like a second pair of shoulders.
- `analyze` showed `stability.margin` 0.024 for the biped's two feet and no warning. Presumably
  fine, but a margin that small is not explained in the docs.

### b03-giant-bat

- **Easy:** the recipe and `cave-bat.json` match the prompt almost exactly.
- **Harder than it should be:** "dark brown fur" in the palette comes out almost black (see 10). The
  fur region list `["torso", "head", "limbs"]` accepted `limbs` (a layer region), and the docs say the
  list takes layer regions, which is clear.
- **Missing:** no size guidance for a "giant" flier (see 14). The wing sheet title does not give the
  span (see 3).
- **Confusing:** the bat stands on its legs with the wings folded flat down its sides, which looks
  nothing like a bat at rest. I assume hanging is out of scope, but the docs could say so.
- The ear recipe (`length` 0.3, `width` 0.14 in the example) makes large ears. They read as "big
  pointed ears" at a glance, the right result.

### b04-hydra

- **Easy:** `neck.count` with `length` and `curve` as in the example. The head names (`head.L1`,
  `head.R2`) are explained in the docs. A 3/4 bite filmstrip showed the nearest head striking.
- **Useful:** the `limb_intersection` warning with its measured depth and a fix "about 5° more splay"
  worked. The extra hint "On a broad body a lower attach.angle can make it worse" is the kind of
  detail I need. My torso was slightly wider than the example's, which is probably why mine tripped it.
- **Confusing:** "heavy four-legged body" has no direct handle. I used `muscle` 0.85, thicker torso
  and leg radii and `lumbering`. `foot.pad` ("heavy creatures") would also fit, but I did not try it
  because it changes the stance and I had no reason to think it better.
- **Missing:** `analyze`'s `mass` stayed at about 1.5 t when I thickened the legs and the muscle, so
  it either ignores limb radius or rounds heavily. I do not know which, and mass is not in the docs.
- Label clutter, see 4.

### b05-cerberus

- **Easy:** the `neck.count: 3` recipe with `spread` 90 and `length` 0.45, plus `foot.paw`. Heads,
  eyes, ears and teeth are copied to every head, as the docs say.
- **Harder than it should be:** "black coat" gave a murky render (see 10) and a description that
  says "black skin" (see 7).
- **Missing:** `foot.paw` is in the catalogue, but the docs' "Feet" paragraph says only "padded paw";
  the `claws` values (`hidden`, `short`, `long`) are only in the catalogue, and I took `long` from
  the example. Fine, but `describe-module foot.paw` is the place to say that `long` is bear-like, not
  hound-like (the catalogue does say "long like a bear").
- **Error message that did not help:** none in my own files. In my probe, `"foot": "foot.paws"` got
  "did you mean foot.claw?" when `foot.paw` is one character away. The did-you-mean should pick the
  nearest id, and here it picked a different one.
- Hound proportions: the render reads as a bear-like three-headed dog. A "wolf" or "hound" body note
  (long legs, narrow chest, deep ribs) would help the next model.

## Error messages (probe)

From the two scratch files, every message was clear and its `fix` right except one:

| Mistake | Message | Verdict |
| --- | --- | --- |
| `"foot": "foot.paws"` | `did you mean "foot.claw"?` | Wrong: nearest is `foot.paw` |
| `"aim"` outside `params` | `move "aim" into "params"` | Good |
| `"colour"` | `spelled "color"` | Good |
| `"on": "taill"` | `nothing named "taill" to attach to`, `did you mean "tail"?` | Good |
| `attach.on: "tails"` on a limb | `limbs attach to a body section, not "tails"` | Good, but hidden until the other errors were fixed (the docs say so) |
| `neck.count` 12 | `12 is outside 1–9`, `use a value in range, e.g. 9` | Good |
| `temperament: "fierce"` | `pick one of ...` | Good, no did-you-mean (fine) |
| `pinch` with no pincer | `add a module that provides "pincer": "hand.pincer"` | Very good |
