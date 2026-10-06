# Feedback C: prompts p11 to p15

I read only docs/blueprint.md, docs/catalog.md and the four examples, then used only the CLI (`validate`,
`analyze`, `patch`, `render` as contact sheet, gait filmstrip and action filmstrip). I did not read source.
All blueprints were valid on the first try (attempt0), so the "validity within attempt3" step cost nothing.
The only validation error I ever saw was one rejected `patch` (details under p12).

Summary table (attempt numbers are files in this folder; "best" is the one I would ship):

| Prompt | Attempts | Best | Visual revisions used |
| --- | --- | --- | --- |
| p11-sea-serpent | 0, 1 | 1 | 1 |
| p12-raptor | 0, 1, 2, 3 | 3 | 3 |
| p13-cave-bear | 0, 1, 2, 3 | 3 | 3 |
| p14-leopard-stalker | 0, 1, 2, 3 | 3 (2 is about as good) | 3 |
| p15-gecko | 0, 1, 2, 3 | 2 (3 is a regression) | 3 |

## Per prompt

### p11-sea-serpent

- Attempts: attempt0 (valid, no errors, no warnings), attempt1 (visual revision).
- Validation errors: none. The minimal blueprint silently dropped `temperament: stalking` because it equals the
  serpent preset. That is correct, but it surprised me for a second.
- analyze, attempt0: 5.4 m long, 40 cm tall, 27 cm wide, `warnings: []`, slither 0.6 m/s. The numbers were
  the real clue: a 5.4 m animal that is 27 cm wide is a snake, not a sea serpent. No warning said so (and none
  should), but the description ("5.4 m long, 40 cm tall legless serpent of about 131 kg") made the thinness
  obvious. `motion[].penetration` showed the head sinking 3.9 cm into the ground, but it was not promoted to a
  warning (threshold undocumented). Raising the neck (pitch 35, length 0.35) removed it (0.011 m, torso).
- Description usefulness: mostly useful. It confirmed "a row of 36 spikes along its back", "dark blue scales".
  It was wrong on colours: my belly `#d6dde0` (pale blue-grey) was called "a cream belly", and my turquoise iris
  `#40e0d0` was reported as "pale grey slit-pupilled eyes".
- Changes after looking (attempt1): the preset serpent is far too thin for a sea serpent, so I thickened
  torso radius to `[0.1, 0.14, 0.16, 0.14]`, neck `[0.1, 0.13]`, tail root 0.14 with a `tall` cross-section,
  made the head bigger, raised the neck, widened spikes and made them taller, and cut the fangs from 2 to 1
  and shorter (attempt0's fangs looked like a comb). Result: 5.6 m, 65 cm tall, 45 cm wide, reads as a sea
  serpent with a visible dorsal crest all the way to the tail, dark blue back and pale underside; roar
  filmstrip works.
- Could not achieve: nothing important. A sea serpent would normally have fins or a frill; those are listed as
  "not in this version", so the spike row stands in.

### p12-raptor

- Attempts: 0 to 3. Attempt0 valid, no warnings in validate.
- Validation errors: none from `validate`. One `patch` (not a saved attempt) was refused:
  `"0.38 is outside 0.4–0.95"` for `motion.gaits[0].duty`. See the doc notes below: the doc recipe for a
  raptor sprint uses 0.4, which is exactly the minimum, and I had not noticed that the catalogue range is
  0.4 to 0.95.
- analyze, attempt0: 2.8 m long, 1.4 m tall, 97 kg, one warning `limb_intersection` ("leg.L passes 1.1 cm into
  leg.R on flat ground"), fix text "spread the legs apart (attach.at, attach.angle, splay) or make them
  thinner". The warning was accurate and its fix worked first time: attach angle 125 to 110 plus splay 6 and a
  slightly wider torso.
- Description: "a 2.8 m long, 1.4 m tall biped of about 97 kg, with two arms, a long tail, orange slit-pupilled
  eyes, teeth and 3-toed clawed feet. Skin: brown scales, a cream belly, dark brown stripes and scales." Right,
  and enough to check the prompt (two legs, small arms, long tail). It does not say "horizontal body" or that the
  tail is held out straight, which is the part I most wanted to verify.
- Changes after looking: attempt1 spread the legs (fixed the intersection); attempt2 tried thicker thighs
  `[0.13, 0.06, 0.03]`, a bigger head and `stride: 1.5`, which brought the intersection back (1.6 cm) and did
  not change speed; attempt3 settled on thigh `[0.115, 0.055, 0.03]`, angle 104, splay 8, and removed the
  stride. Final: no warnings, no sliding, no penetration, tail rigid and horizontal during the walk (checked
  from the top and the side), bite action fine, arms small and held forward with `lift: 45`.
- Could not achieve:
  - A fast run. With `{ "type": "walk", "duty": 0.4 }` the filmstrip shows a real flight phase, but
    `analyze` reports `speed.max` 2.1 m/s (about 7.5 km/h) for a creature with a 0.92 m hip height. The catalogue
    shows `froude: [0, 0.5]` for `walk`, which explains the cap, and `trot` is `legPairs: [2]` so a biped cannot
    use it. `stride` does not raise it either. There is no gait that lets a biped sprint, so "a raptor that
    runs" is only a jog. Neither `analyze` nor the docs flag this.
  - Digitigrade (reverse-knee) leg shape, feathers or a sickle claw. The legs read acceptably in the filmstrip
    but they are plain tapered tubes.
  - `stability.margin` was 0.029 on the final attempt (supported: true). Units and threshold are not
    documented, so I could not tell whether that is "tippy".

### p13-cave-bear

- Attempts: 0 to 3. Attempt0 valid, no validation warnings.
- analyze, attempt0: 2.5 m long, 1.4 m tall, 1.36 t, warning `limb_intersection` ("foreleg.R passes 8.5 cm into
  torso on flat ground"). Description: "short neck ... small black eyes, pointed ears ... teeth and fangs and
  5-toed clawed feet. Skin: charcoal skin, a brown belly, dark brown mottling and grime." My base was
  `#5a4128`, a plain brown, so "charcoal skin" was misleading (it does match how dark the render looked, but the
  word comes from the palette, not the render).
- Changes after looking:
  - attempt1: the render looked like a hippo or capybara, with the head and neck swallowed by the torso. I made
    the torso a little smaller, the neck longer and thinner, the head bigger with a longer snout and pitched down
    -25, and lightened the palette (base `#7b5a37`) so it reads as grimy brown rather than black. Legs moved to
    angle 118, splay 6.
  - attempt2: foreleg angle 128, splay 10, thinner root; more grime. The intersection moved from foreleg and
    torso to hindleg.L and hindleg.R (4.1 cm, flat) and hindleg.R and torso (5.2 cm, rough).
  - attempt3: hind legs to angle 128, splay 10, thinner. Now foreleg.R and torso again, 3.3 cm. I ran out of
    revisions with this one warning left.
- What worked: tiny eyes (`size` 0.009), huge claws (`clawLength` 0.13, `clawWidth` 1.6, 5 toes, pale
  `clawColor`) read clearly from the front and 3/4 views. Bear walk is lumbering and sliding is 0.
- Could not achieve: the intersection warning is gone only if I thin the legs so much that the bear stops being
  bulky. The warning gives no amount to change, so fixing it was whack-a-mole (each fix moved the intersection
  to a different pair). A bear's shoulder hump is not possible except via `arch` on the whole spine. "Grimy"
  reads as mottled dirt but the `grime` layer's feet/crease effects are subtle in the contact sheet.

### p14-leopard-stalker

- Attempts: 0 to 3. Attempt0 valid.
- analyze, attempt0: 2.2 m, 74 cm tall, a 1.5 cm `limb_intersection` (foreleg into torso on rough ground).
  Description: "a long curled tail, yellow slit-pupilled eyes, pointed ears ... Skin: tan skin, a cream belly and
  black rosettes". That covered every requirement in the prompt, which was reassuring, but see the notes on the
  description's repeated clauses below.
- Changes after looking:
  - attempt1: the tail tip came out pale (countershade follows the curled tail's underside), exactly as the docs
    warn. I split countershade into per-region layers (torso, head, limbs, and the tail with `height: -0.75`).
    Leg attach angle 112 to 120 removed the intersection warning. Spots at 0.05 made one huge dark blotch on the
    cheek.
  - attempt2: spots are in torso lengths, so on a head they are enormous. I used four spots layers: torso
    (0.06, ring 0.9), limbs and tail (0.035), head (0.012, no ring). The head now reads like a leopard's.
  - attempt3: torso rosettes down to 0.045. More of them, but smaller; arguably equal to attempt2.
- Could not achieve: a leopard's dense rosettes covering the whole flank. Even at `density: 1` the torso side
  shows a handful of rings in a band along the upper flank. `region` takes one value, so per-region
  sizes cost one layer each (4 spots layers + 4 countershade layers). A tail curled "at the end" worked well
  (`curl: 170, curlStart: 0.6`).

### p15-gecko

- Attempts: 0 to 3. Attempt0 valid.
- analyze, attempt0: 92 cm long, 17 cm tall, 50 cm wide, `warnings: []`, no slide. Description: "a 92 cm long, 17 cm
  tall quadruped ... with a short neck, a long tail, yellow slit-pupilled eyes, teeth and 5-toed clawed feet.
  Skin: tan scales, a cream belly, charcoal mottling, sand spots and scales." My colours were olive green
  `#7f8b52`, dark olive `#4a5630` and pale green `#c9cf94`. The description called them tan, charcoal and sand,
  so the palette words are unreliable (hue is lost). It also never says "flat" or "wide", although the
  measurements (17 cm tall, 50 cm wide) show it.
- Changes after looking: attempt1 made the toes thicker and longer and the torso wider (the toes in attempt0
  were hair-thin and looked spidery); attempt2 gave the claws the pale palette colour so the toe tips read as
  pads, not black dots; attempt3 pushed toe thickness further and the five toes fused into a paddle, so
  **attempt2 is the best**.
- Could not achieve:
  - Wall crawling: nothing in the format expresses adhesion, a climbing surface or a gravity direction. The
    result is a sprawling lizard on the floor.
  - "Big toes": toe thickness seems to follow the limb tip radius (and `clawWidth`), with no pad or lamella.
    Thick enough to look "big" and the toes merge; thin and they look like spider legs.
  - The walk cycle is 0.15 s with a 7 to 8 cm stride on a 22 cm leg: very fast flapping. The docs say large
    `stride` values change nothing on sprawled legs, which matches. No spine undulation (the torso bends only as
    a whole), which is the single biggest "lizard" cue.

## Docs and tools: confusing, missing or wrong

1. **Doc and CLI disagree on the filmstrip view.** docs/blueprint.md: "`--view side|3/4|top|front` ... `front`
   shows the legs' stance". The CLI says: `unknown filmstrip view "front"` with `fix: use side, 3/4 or top`.
2. **The raptor recipe is only half true.** "`duty` ... below 0.5 it runs, with moments where no foot touches the
   ground: a raptor's sprint is `{ "type": "walk", "duty": 0.4 }`." The catalogue range for `walk.duty` is
   0.4 to 0.95, so 0.4 is the bottom of the range (0.38 is rejected), and the walk gait is also capped by
   `froude: [0, 0.5]` so top speed for a 0.92 m hip is 2.1 m/s. Nothing in the docs says a biped cannot run
   fast. Suggest either a `run` gait for bipeds or a sentence in the docs, plus an `analyze` note when the
   creature's species-typical speed is clearly out of range (hard to do; a simpler start is to print the
   Froude limit that caps `speed.max`).
3. **Pattern sizes are in torso lengths, so the same `spots` size is huge on a head and tiny on a flank.**
   The docs say sizes scale with the creature, but not that this makes head spots oversized. `region` accepts
   one value only, so a leopard needs several layers. A `region` list or a per-region `scale` would help.
4. **`analyze` description quirks.**
   - Layers are repeated verbatim: with four countershade layers it prints "a cream belly, a cream belly, a cream
     belly, a cream belly, black rosettes, black rosettes, black rosettes and black spots".
   - Colour names ignore hue: olive green became "tan", dark olive "charcoal", brown "charcoal", pale blue-grey
     "cream", turquoise "pale grey".
   - It does not report posture or proportion words that the prompts depend on ("horizontal body", "flat, wide
     body", "stiff tail", "splayed legs").
5. **`analyze` thresholds are undocumented.** `motion[].penetration` showed a 3.9 cm head-into-ground on the sea
   serpent with `warnings: []`; the raptor had `stability.margin: 0.029` with no comment. The docs say it warns
   about "a body or tail in the ground" but not above what depth. Units of `margin` are not given.
6. **The intersection fix text names what to change but not by how much, and fixing one pair moved the problem to
   another** (bear: foreleg and torso, then hindleg and hindleg, then hindleg and torso, then foreleg and torso).
   A suggested value (for example "raise attach.angle to about 125") would save iterations. The docs' "an
   attach `angle` around 110–120 keeps the legs clear of the body" was not enough for a bear with a 0.25
   torso radius; I needed 128 plus a splay of 10 and it still did not clear.
7. **Docs do not say how to address an unnamed skin layer in `patch`.** `skin.layers[1].coverage` worked, but the
   docs only show id-based paths ("by id"), and layers' `id` is optional. A line in "Editing with patch"
   saying "layers can be addressed by index" would help. Also `set` on a whole list (`skin.layers`)
   prints a positional diff that is hard to read (it shows `skin.layers[1].type: "spots" → "countershade"`
   etc.).
8. **`idle` cannot be rendered with `--action`**: `render failed: "idle" runs by itself and cannot be started`.
   The doc says "`--action bite` (or `roar`, `look`)", so this is consistent, but then the tail swish that the
   `idle` action performs is not viewable anywhere, which matters for "a long stiff tail". The walk filmstrip
   showed no tail motion at all, so "stiff" is simply the default.
9. **The serpent preset is a thin garden snake**: torso radius 0.085 torso-lengths. The docs' sizing line says
   "a serpent about 3.5 × scale" but nothing says to thicken it for a sea serpent or python. The
   "a cobra rearing up" recipe exists; a "thick sea serpent / eel" recipe would be useful.
10. **Minor:** `validate` prints the full minimal blueprint every time (long); a `--quiet` or
    `--errors-only` would be easier for scripting. The biped preset has a `wide` torso that the docs only
    mention for the raptor in one line ("keep those `round`").
11. **Good, and worth keeping:** the docs' notes on countershade following a curled tail, "details smaller than a
    few pixels fade out", and the `curl: 160, curlStart: 0.6` tail-tip recipe were all correct and saved me
    iterations. The labelled contact sheet is excellent for checking where parts landed. Error messages (the
    `0.38 is outside 0.4–0.95` one) are clear.

## Was `patch` convenient compared with editing JSON by hand?

Yes, for almost everything after attempt0. Copy the previous attempt to the next number, then one `patch` call
with a handful of `set` ops did every revision. It is easier than hand-editing because ids replace indexes
(`limbs[id=hindleg].attach.angle`), it works on inherited limbs (`foreleg`) without restating them, it writes only
if valid (the rejected `duty` change left the file untouched, which is exactly right), and the printed diff
confirms what changed. Annoyances: it rewrites the file in its own key order and expands arrays one number per
line (so the files are no longer pretty); `set` of a profile or list needs the whole list; unnamed layers need
index paths; and I did not find a dry-run option (I did not look for one beyond the docs). For the first draft of
a blueprint I still wrote JSON by hand, since there is nothing to patch yet.
