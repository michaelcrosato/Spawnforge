# Feedback A: prompts p01 to p05 (phase 3, actions)

Method: read docs/blueprint.md, docs/catalog.md and the four examples (JSON and PNG), then used only the
CLI (`validate`, `render --labels`, `render --filmstrip`, `render --filmstrip --action ...`). No source read.
All five first blueprints were valid, so no validation-fix attempts were needed. Every later attempt is a
visual revision.

| Prompt | Attempts (files) | Validation errors | Visual revisions | Final |
| --- | --- | --- | --- | --- |
| p01-wolf | 4 (attempt0 to 3) | none | 3 | attempt3 |
| p02-spiked-lizard | 3 (attempt0 to 2) | none | 2 | attempt2 |
| p03-horn-beetle | 4 (attempt0 to 3) | none | 3 | attempt3 |
| p04-green-serpent | 3 (attempt0 to 2) | none | 2 | attempt2 |
| p05-swamp-troll | 3 (attempt0 to 2) | none | 2 | attempt2 |

PNGs are in `work/` (`pNN-aK-sheet.png`, `-gait.png`, `-bite.png`, `-roar.png`, and a few extras).

To check how good the error messages are, I also validated two deliberately broken scratch files outside the
run folder (about 20 mistakes). They are covered under "Docs and tools" below.

## Per prompt

### p01-wolf (quadruped)

- attempt0 (valid): scale 0.9, snout head 0.38, bushy tail via radius profile `[0.07, 0.11, 0.1, 0.02]`,
  ears from the `horn.curved` recipe, `countershade` + a back mottle, stalking. It rendered 1.94 m long and 75 cm
  tall: long, low and lizard-like, with thin legs, a short neck and a tail that was only mildly bushy. The mottle looked like
  camouflage patches rather than fur.
- attempt1 (revision 1): scale 0.8, legs 0.62 -> 0.76 / 0.78, deeper chest `[0.17, 0.21, 0.18, 0.12]`, thicker raised
  neck, snout 0.4, tail radius `[0.07, 0.14, 0.13, 0.03]` pitch -30 (clearly bushy), ear tips in accent, pale mottle on
  the limbs. 1.7 m x 81 cm, much more wolf-like proportions.
- attempt2 (revision 2): lowered the tail and softened the mottle. I also added `stripes` with `direction: "along"`,
  `count: 40`, `strength: 0.25` for fur streaks. That was a mistake: it produced fine concentric ring lines
  (moire-like banding) over the torso, neck and head, and the coat got darker. See the bugs below.
- attempt3 (revision 3): dropped the stripes, lightened the base grey (#8d9094), one low-contrast mottle (0.2 / 0.55),
  and `bite` with `reach: 1, speed: 0.7` to slow it down (0.55 s -> 0.79 s).
- Could not achieve: real fur. "Grey fur" is only a colour, and the silhouette stays smooth. The tail is a smooth
  sausage-blob, not tufted. The stalking temperament gives a deep hind-leg crouch that looks kangaroo-like.

### p02-spiked-lizard (quadruped)

- attempt0 (valid): wide torso, wedge head, `scales` material + big `scales` layer (size 0.05, bump 0.7), a `spikes.row`
  on `spine`, a club made with the tail radius profile `[0.16, 0.08, 0.07, 0.09, 0.2, 0.16]` and spikes on the
  club (`spikes.row` on `tail`, angle 90), splay 45, lumbering. The armour and the back spikes read well from the start. The club
  was a balloon on a stick (egg bigger than the shaft), the head merged into the body, and the legs were stubby.
- attempt1 (revision 1): neck 0.18 -> 0.26, head 0.34, thick tail `[0.17, 0.11, 0.09, 0.1, 0.15, 0.12]`, legs 0.5 with
  splay 35, an extra flank spike row (angle 55), crown horns, and a custom walk `{ "type": "walk", "stride": 1.6, "duty": 0.8 }`.
- attempt2 (revision 2): even thicker tail with a bigger club `[0.18, 0.13, 0.11, 0.12, 0.2, 0.15]`, head radius 0.14,
  taller dorsal spikes `[0.08, 0.18, 0.12, 0.06]`, 6 club spikes, a grime layer. Now reads as a heavy, armoured spike-backed
  club-tailed lizard. 3.0 m x 1.0 m tall x 1.1 m wide.
- Could not achieve: true armour plates (none exist), so scales + spike rows stand in. The club is a smooth egg, not a knobbed mace.

### p03-horn-beetle (hexapod)

- attempt0 (valid): scale 0.18, chitin, black base with orange accent `spots` on the back, nose horn
  (`at` 0.15, length 0.5, curve -50). The horn came out as a thin forward-pointing spike, more like a bill than a big horn. The
  `region: "back"` spots also leaked onto the head and around the eyes (orange smears).
- attempt1 (revision 1): horn moved to `at` 0.3 with `lean` -25, `width` 0.07, `curve` -85, length 0.55. It now rises and hooks forward,
  a classic rhino-beetle horn. Spots changed to `region: "torso"`, density 0.7, which fixed the leak.
- attempt2 (revision 2): `bite` speed 0.4 (the default bite is only 0.18 s on this size and is invisible), `look` speed 1.5 / range 140.
- attempt3 (revision 3): scale 0.18 -> 0.11 (30 cm -> 18 cm, so it is "small"), thinner leg radius `[0.045, 0.02]`
  (no visible change in render).
- Could not achieve: the bite never reads clearly (jaw opens a few mm for two frames); the legs look thin and straight,
  not jointed like beetle legs; no wing cases (elytra) split.

### p04-green-serpent (serpent)

- attempt0 (valid): scale 2.2, `teeth.row` with `fangs: 2, fangLength: 0.1`, yellow `accent`, stripes (28, region back), `scales`
  layer with `gapColor` set to dark green, slither amplitude 0.2 / waves 2, aggressive. 7.8 m long. The fangs came out as a
  picket fence of four per side (about 22 cm, huge against a 0.5 m head), the head and neck were small, and the action strips were unreadable (see below).
- attempt1 (revision 1): scale 1.8 (6.1 m), `fangs: 1` + `lower: false` (two clear long fangs), neck 0.5 / pitch 25 /
  4 segments so the head sits up, thicker body, head radius 0.1.
- attempt2 (revision 2): neck pitch 40, 5 segments, stripes 22 x width 0.4 (bolder yellow bands). Final look: green
  banded snake with two long fangs and a raised head. 6.0 m long, 96 cm tall at the head.
- Could not achieve: a rearing, striking or hissing pose. Bite and roar only lower and raise the head a few degrees; with the whole
  neck bending as one section it never reads as a strike.

### p05-swamp-troll (biped)

- attempt0 (valid): torso pitch 70, long arms 1.6, flat wide head, tusks from the jaw (recipe), two mottle layers + grime,
  lumbering. The head merged with the shoulders (no neck) and the "tusks" looked like horns sprouting from the top of the head.
- attempt1 (revision 1): narrower torso top `[0.15, 0.26, 0.24, 0.2]`, longer neck 0.2 / pitch 65, head 0.4 long, tusks at `at` 0.12, angle 65,
  length 0.22, curve -70.
- attempt2 (revision 2): head 0.42 x radius 0.17, tusks at 0.1 / angle 75 / length 0.24 / curve -90, bigger eyes. A distinct
  flat head with two upward-curving tusks, long arms hanging to the knees, mottled green. 2.0 m tall.
- Could not achieve: tusks that rise from the lower lip. They emerge near eye level beside the snout, so from the front they
  still look a bit like horns on a short flat head.

## Docs and tools

What worked: the docs were enough to get a valid blueprint on the first try for all five creatures. The recipes table
(tusks, ears, spike rows), the sizing paragraph, and the id-based error paths were all useful. The validator on a deliberately broken
file gave precise paths, ranges and fixes: `"5 is outside 0–4"`, `unknown key "legnth"` -> `did you mean "length"?`,
`"teeth.row" sits along the mouth, but the head has no jaw`, `rows use "from" and "to"; "at" is ignored`, and it listed valid attach
targets for `"on": "skull"`.

Confusing, missing or wrong:

1. **Bad suggestion.** `parts[id=horn].params.len` gives `fix: did you mean "lean"?`. "length" is the obvious intent
   (prefix match) and `len` -> `lean` is a worse guess. `legnth` -> `length` worked, so the matcher seems to prefer edit distance over prefix.
2. **Action filmstrips for serpents are drawn from above, and the docs only mention this for gaits.** blueprint.md says:
   "Serpents are drawn from above to show their wave. With `--action bite` (or `roar`, `look`) it draws the action instead".
   The default top view makes a bite or roar completely invisible. `--view side` / `--view 3/4` do work with `--action`, but the docs
   do not say so. Suggest side view by default for actions, and document `--view` for actions.
3. **No way to zoom to the head in a filmstrip.** The camera frames the whole creature, so on the 6 m serpent the head is about 10 pixels, and on the
   18 cm beetle the 0.18 s bite spans eight frames of nothing. The six-view sheet has a "head" panel but the filmstrip has no
   equivalent (`--view head` or `--focus head` would solve it). Frame timing is also uniform in time, so for a 0.18 s bite most frames are identical.
4. **`look` filmstrip shows no motion.** For the wolf and the beetle (top and 3/4 views) the head barely moves and the events list contains
   only `action-start` and `action-end`. The docs say actions are "aimed at a target" but never say where the filmstrip puts it
   (it seems to be straight ahead). A target off to the side would make the action testable.
5. **`--action idle`** fails with `"idle" runs by itself and cannot be started`. That message is clear, but the catalogue lists
   `idle` under Actions and the docs only say "(or `roar`, `look`)", so it is easy to try once.
6. **`region: "back"` is not defined.** blueprint.md says "A region only masks where the layer shows" but not which parts of the body are "back".
   In practice `back` covered the top of the head and the area around the eyes on the beetle (orange smears), while `torso` did not. A sentence on what each
   region includes would help (and whether head is in `back`).
7. **`scales.gapColor` defaults to `accent`** (catalog table). For the serpent, whose accent is the yellow of the stripes, the scale gaps
   would turn yellow. I only caught it because I read the table closely; blueprint.md mentions "darker gaps" without the default colour.
8. **Missing recipes.** The docs have recipes for horns and spikes but none for: a bushy tail (radius profile that swells in the middle, `[0.07, 0.14, 0.13, 0.03]`), a
   club tail (profile with a swelling at 0.8 to 1.0 plus spikes on the `tail`), or fur / fluff. "Not in this version" lists wings, fins, tentacles, shells,
   plates, quills, antennae, frills, but not fur, hair or manes, so "grey fur" has no answer.
9. **`stride` doc vs observation.** The docs say large `stride` values "change nothing" on short or sprawled legs. On the lizard, the default walk had stride 26 cm and a
   0.50 s cycle (a scuttle, odd for a 3 m lumbering lizard). With `stride: 1.6, duty: 0.8` it became 41 cm / 0.70 s. I changed leg length (0.45 -> 0.5) and splay (45 -> 35) at the
   same time, so I cannot say which did it, but stride did not look ignored.
10. **JSON field clash in `render` output.** Top-level `"width"` / `"height"` are PNG pixel sizes (1536 x 1068) while `info.width` / `info.height` are creature
    metres. Anyone grepping `"height"` sees both.
11. **`validate` always prints the whole minimal blueprint** (hundreds of lines for a valid file). Fine for tools, but a terminal user has to scroll past it to
    see `ok`. A `--quiet` flag would help. (`ok` is first, so it is not a real problem.)
12. **Process note.** The run folder `eval/runs/2026-10-06-phase3-actions/` already contained attempt files for p06 to p20 while I was working
    (apparently from other evaluators sharing it). I did not open them, but the folder looks shared.

Bugs seen in the renderer:

- `stripes` with `direction: "along"`, `count: 40`, `strength: 0.25` (p01 attempt2) draws visible concentric ring lines on the body and head instead of
  streaks along the spine. See `work/p01-a2-sheet.png`.
- Skin texture smears on a bent leg during the troll's walk: the thighs show stretched, skirt-like bands for several frames
  (`work/p05-a2-gait.png`, frames 4 to 7; also `work/p05-a0-gait.png`).

## What the filmstrips showed, per creature

- **Wolf (walk, trot).** Walk at 0.54 m/s: cycle 0.92 s, stride 50 cm, duty 0.75 / 0.75 / 0.75 / 0.75, `footSlide` 4.5e-8 m (no slide). The
  footfall diagram is a proper four-beat lateral sequence with three feet always down. Trot at 2 m/s: cycle 0.40 s, stride 80 cm, duty 0.5, diagonal pairs in
  step, slide 5e-8. Both are clean. The body is rigid, though: no spine flex, no head bob, tail static (the head level is documented). The hind
  legs fold into a deep Z, so the walk looks a little stilted. **Bite** (0.55 s): the jaw opens in only one frame (0.16 s), has snapped shut by `bite-contact` (0.25 s), and the head lunge is
  tiny; it reads as a jaw flap more than a bite. With `reach: 1, speed: 0.7` (0.79 s, contact 0.36 s) it is the same shape, just slower. **Roar** (1.42 s, peak 0.64 s): head rises, mouth opens wide for
  about four frames, reads well. **Look**: nothing visible.
- **Spiked lizard (walk).** Default: 0.53 m/s, cycle 0.50 s, stride 26 cm, duty 0.75, slide 2.2 mm (the only non-zero slide I saw, still tiny). That is a fast
  shuffle for a 3 m armoured animal. After the changes: 0.59 m/s, cycle 0.70 s, stride 41 cm, duty 0.80, slide 1e-7, a steadier plod that suits "heavy". It still
  has no lateral body wave, which is what makes a sprawled lizard look like a lizard; it reads as a mammal on splayed legs. **Roar** (1.34 s, peak 0.61 s): the whole front end rises and the head tips
  back with an open mouth, very clear. **Bite** (0.45 to 0.50 s): in side view the head is a few pixels and nothing reads; in 3/4 view the jaw opens at about 0.15 s and shuts by contact (0.23 s), readable but short.
- **Horn beetle (tripod).** Textbook alternating tripods: duty 0.5, three feet down at all times, slide 1e-8. At 0.35 m/s the cycle is 0.22 s and stride 7.5 cm; at 0.9 m/s the cycle is 0.067 s (15 Hz leg beat)
  and the stride is 6 cm, which is *shorter* than at the lower speed. Looks frantic but plausible for skittish. **Bite**: 0.18 s by default (unreadable), 0.44 s at speed 0.4 and in 3/4 view a
  small pink mouth shows in two frames. **Look**: nothing visible (neck is 0.06 long). Bite and look do not suit a horn beetle well, but the hexapod preset only offers those.
- **Green serpent (slither).** Top view shows a clean S-curve with the body following its own trail: 1.45 to 1.63 m/s, cycle 2.1 to 2.3 s, stride about 3 m. No legs, so `footSlide` is 0 by definition and the footfall panel
  just says "no legs". The wave looks smooth, but it does not include the raised neck (from above it just foreshortens). **Bite** and **roar**: from the default top view they are invisible. In side view the
  head only dips and lifts slightly, with no rearing or strike, and the head is tiny in frame (see docs item 2 and 3). Roar peak at 0.77 s, bite contact at 0.29 s are reported but nothing visible happens at those times.
- **Swamp troll (biped walk).** Duty 0.62 on both legs, 0.84 m/s, cycle 0.99 s, stride 83 cm, slide 2e-7. Alternation is correct (the diagram shows a short double-support phase), but there is no arm swing (arms
  stay frozen forward, bent at the elbow) and no torso sway, so it looks like a stiff shuffle. The texture smears on the bent thighs, as above. The knees are permanently bent, so it looks as if it is crouching rather than "upright". **Roar** (1.89 s, peak 0.85 s): head
  tilts back, mouth opens wide, tusks visible; reads well, but the arms do nothing. **Bite** (0.71 s, contact 0.32 s): head dips and the jaw opens for one frame; short but visible.

## Summary of the three most important issues

1. Action filmstrips: serpents default to a top view where bite and roar are invisible, there is no head zoom, the frame timing wastes frames on very short actions (0.18 s bite) and `look` shows no visible movement.
2. Surface and silhouette limits with no guidance: no fur or fluff (and not listed as unsupported), `region: "back"` leaks onto the head, `stripes` with `direction: "along"` makes ring artifacts, and
   mottle reads as camouflage; no recipes for bushy or club tails.
3. Motion stiffness: rigid bodies in every gait (no spine flex, arm swing or lateral lizard wave), bite is a quick jaw flap with little lunge, a serpent cannot rear or strike because the neck bends as one section, the default sprawled-lizard walk is
   too quick, and the troll's bent leg texture smears.
