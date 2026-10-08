# Gate 12, suite B, agent A: feedback

Agent worked only from `docs/blueprint.md`, `docs/catalog.md`, `examples/` (JSON and PNG) and the CLI.
Renders went to a scratch folder. Every attempt below validated on the first try; there were no
validation errors to fix in any prompt. All five final blueprints validate with no warnings, have no
`notBuilt` entries, and `analyze` (full, not only `--summary`) reports no warnings.

## Summary

| Prompt | Attempt files | First valid | Revisions after it | What drove them | Final analyze warnings |
| --- | --- | --- | --- | --- | --- |
| b01-dragon | attempt0, attempt1 | attempt0 | 1 | Render only: the `scales` layer at its default size and the tail spikes (dark, 0.09 tall) did not read on the contact sheet. Bigger scales (size 0.035, bump 0.7, gap 0.5), taller bone-coloured spikes (0.13) and longer horns. | none |
| b02-wyvern | attempt0 to attempt3 | attempt0 | 3 | Render: the recipe stinger (0.14 long) was a dot on a 3 m tail, so attempt1 made it bigger and put a swell in the tail radius. That thinned the tail and `analyze` warned `unbalanced` (COM 3.5 cm ahead of the feet), so attempt2 moved the legs forward (`at` 0.5) and thickened the tail. attempt3 made the stinger 0.32 long, 0.055 wide, `curve` 100 with a red tip so it reads at a glance. | none |
| b03-giant-bat | attempt0, attempt1 | attempt0 | 1 | Render: base `#3a2a20` lost all shape ("very dark creature" in the docs). Lighter brown, lighter belly, `mottle`, fur extended to limbs, a lighter wing colour. | none |
| b04-hydra | attempt0 to attempt2 | attempt0 | 2 | `analyze` warned `limb_intersection` (hindleg into torso on rough ground) after the torso was made heavier; +6 degrees of `splay` cleared it (attempt1). attempt1 also lengthened the necks (0.75 to 1.0) because "long necks" did not read; attempt2 enlarged the heads (0.26 to 0.30 long, radius 0.088) because they looked small on that much neck. | none |
| b05-cerberus | attempt0 to attempt3 | attempt0 | 3 | Render and description: `#1c1a1e` (the doc's advice for black) was described as "charcoal" and the front view was a smudge. attempt1 lifted the base slightly and added a `mottle`; attempt2 gave the paws `size` 1.3 and dark pads (the default pads are brown on a black coat); attempt3 went darker (`#121014`) with a lighter `mottle` so the description says "black skin" while the shape still reads. | none |

Final answers: `b01-dragon.attempt1.json`, `b02-wyvern.attempt3.json`, `b03-giant-bat.attempt1.json`,
`b04-hydra.attempt2.json`, `b05-cerberus.attempt3.json`.

Honest caveat for the eval design: the examples are so close to these prompts (ash-dragon,
storm-wyvern, cave-bat, hydra, cerberus) that attempt0 was a copy-and-adapt of an example in every
case, hence zero validation errors. This suite measures "can the agent read a render and polish",
not "can the agent learn the format from the docs". A prompt with no example twin would tell more.

## Per prompt

### b01-dragon

- Went smoothly. The "Horns swept back along the head" recipe (`aim` "back") and the dragon recipe
  row gave the right start, and the `spikes.row` on `tail` follows `examples/storm-wyvern.json`.
- Harder than it should be: nothing tells you how big a pattern or a row of spikes must be to read
  on the default 512 px panel of a 5 m creature. The `scales` layer at `size` 0.02 was invisible on
  the body (visible only in the head panel). The docs warn about small creatures; they should say
  the rule in general (about 2 to 3 px per feature at 512 px, so a feature should be roughly 1% of
  the creature's length or more).
- Spikes: my first row used `color` `#2a2420` on a red tail and was nearly invisible. The default
  bone colour (`#ddd1b4`) is the right choice on a dark or saturated body; the catalogue lists the
  default but does not say it is chosen to contrast. A `spikes.row` on the tail has a taper problem:
  a height profile `[0.09, 0.07, 0.03]` looks tiny at the root because the tail radius is 0.1;
  nothing relates spike height to the radius of the section it sits on (unlike teeth and eyes, which
  size themselves to the head).
- The default contact sheet shows the wings folded, so "bat-like wings" can only be judged with
  `--pose spread`. The blueprint doc mentions it, but a fliers' recipe or the render help should say
  "always also check `--pose spread --views 3/4,front,top`". Perhaps the contact sheet should add a
  spread panel by default when the creature has wings.
- Folded wings render as thin slabs along the flank (`wing.L` in the 3/4 view). Not an error, but a
  reader of the default sheet would not call these wings.

### b02-wyvern

- The `wyvern` preset is exactly "walks on two legs, wings are its arms", so the body plan part was
  trivial. The filmstrip (walk, 1.66 m/s, no slide) confirmed it.
- The stinger recipe (`horn.curved` on `tail`, `at` 0.97, length 0.14, width 0.025, curve 60) is too
  small for a wyvern: the preset tail ends in a radius of 0.012, so a 0.025 base radius is wider than
  the tail itself, and the whole thing is a dark dot at a 3 m tail's end. It needed length 0.3, width
  0.05, curve about 100, and a swollen tail tip before it read as a stinger. Suggest the recipe give
  a size relative to the tail (and a `tipColor` contrast), and say the tail's `radius` profile should
  swell near the tip for a stinger. A `stinger` part (or a `horn.curved` `aim: "up"` hint for a
  scorpion-style hook) would be better than a recipe.
- `unbalanced` appeared only after I thinned the tail. The fix text lists "lengthen the tail as a
  counterweight" but not "thicken it": the tail radius is what carries the counterweight mass, and
  neither the docs nor the message says tail radius counts toward balance. The first listed fix (a
  lower `attach.at` for the legs) worked on the first try (0.56 to 0.5), which was good.
- Docs say a wyvern is "about 3.2 x scale from snout to tail tip". Mine came out 3.4 after the longer
  tail; the sizing sentence is fine.
- Folded wings sit on the back as a rectangular block (3/4 and side views): the bone chain of the
  folded arm reads as a box. For a creature whose prompt says "its wings are its arms" the folded
  pose does not look like arms; `--pose spread` does. Maybe the default sheet should show both poses.

### b03-giant-bat

- `cave-bat.json` plus the Bat recipe made this easy; "giant" was resolved by the sizing sentence
  ("a 4.8 m bat is `scale` 0.7"), which was exactly what I needed (`measurements.wingspan` 4.76).
- The doc's "Very dark creatures" paragraph is right: base `#3a2a20` with fur is a brown smudge.
  Good advice, but it is only in the Skin section, and a "dark brown fur" prompt hits it at once.
  The Bat recipe row in the creature table should say "fur base no darker than about `#4e3626`".
- Fur needs `region` for every part you want furred (torso, head, limbs); there is no `"body"`
  region that means "everything except wings and fins", so I listed three. A short alias would help.
- Leathery wings are only visible in `--pose spread` (see b01). The fly filmstrip is good but its
  frames are tiny (a 1.5 m creature in a 320 px frame with a very distant camera); the framing for
  fast fliers wastes most of each frame.
- Bat feet: `foot.claw` with `toes` 5 on the legs reads as little stub feet in the front view. Bats
  hang by their feet; there is no pose or stance for that. Not needed for the prompt.

### b04-hydra

- `examples/hydra.json` is the answer; the recipe row is accurate. Heads copy their parts as
  documented, and the ids (`head.L1`, `eyes.L2.R`) matched the docs.
- "Long" necks: `neck.length` 0.75 at `scale` 1.6 is 1.2 m and the sheet reads as shortish. The
  description says "long necks" at 0.75 and "very long necks" at 1.0; I only learned that phrase
  threshold by trying it. The catalogue says range 0 to 1.5 but gives no guide for what is "long";
  a line like "0.5 is a horse, 1.0 a swan" would have saved an iteration.
- `limb_intersection` fired on rough ground only (the fix text said so: "on rough ground"), and its
  suggestion "about 5 degrees more splay" was accurate (6 cleared it). Good message.
- Heads as big as the neck's end look stuck on; a head `radius` relative to the neck's end radius
  would help readability. Not documented: how big a head can be before `heads_overlap` or
  `head_intersection` fires (they did not at radius 0.088 with spread default 100).
- The labelled 3/4 panel is unreadable for five heads: about 40 labels pile up over the left third
  of the image. `--labels` would be much more useful with a filter (for example `--labels limbs`,
  or collapsing per-head copies into one label).
- The `head` view shows only the main head partly; there is no way to point it at `head.L1`.

### b05-cerberus

- `examples/cerberus.json` again. `spread` 90 and `length` 0.45 from the recipe worked.
- Biggest friction: a black coat. The doc says use `#1c1a1e`, but `analyze` describes that as
  "charcoal skin" (I tested: a base is called "black" only at about `#101010` or darker, "charcoal"
  at `#1a1a1a`). So a blueprint that follows the doc's advice for black fails any check that reads
  the description for "black". The way out was a near-black base (`#121014`) with a clearly lighter
  `mottle` (`#403a46`, 0.6), which the docs hint at ("give grime or mottle a colour well above the
  base") but do not tie to the description wording. Suggest either naming `#1c1a1e`-ish colours
  "black" in the description or saying in the docs which values read as black.
- Fur on a near-black base is very hard to judge in the render: the front and top views are a dark
  smudge even with `mottle`. A `--light high` or flat-lit render option would help the agent see
  shape on dark creatures.
- Paw pads default to brown (`#3a2e2a`), which stands out on a black coat in the underside view; the
  example sets `padColor` explicitly. Pads and claws could default to a darker version of the
  palette base. `foot.paw` `size` 1.3 made paws read in the front view; the doc does not give a
  suggested range for "paws visibly big" (0.5 to 2 only).
- The prompt says "hound", and the preset head is `snout` with the default `lips` and `brow`; the
  result reads as a bear or a tapir from the side at default settings. A hound recipe (longer snout,
  smaller radius, ears `droop`, thinner neck) is not in the docs.
- Same label pile-up as the hydra (three heads, ears and eyes each labelled per head).

## Errors and messages

- There were no validation errors in any attempt, so no error messages to rate. The only error I
  hit was my own: running a command from a subdirectory with a relative path gave
  `ENOENT ... "fix": "relative paths are read from /home/user/sf-release (pnpm runs commands from
  the repository root)..."`. That message was exactly right and saved a retry.
- `patch --out` worked well as a way to make "the next attempt" without touching the previous one,
  and the diff it prints is readable. Setting an inherited limb field by id
  (`limbs[id=leg].attach.at`) wrote a small `{"id":"leg","attach":{"at":0.5}}` item, which is what
  I wanted. One surprise: `set` on `skin.layers[type=scales]` replaces the whole layer (documented),
  and the diff then prints the change under a position (`skin.layers[1].size`) rather than the
  `type=` path I used, which is slightly confusing.
- `analyze --summary` kept the warnings and the one-paragraph description, which was all I needed;
  the full output is long.

## What worked well

- Five renders in parallel (Chromium per process) ran without trouble, about 10 to 20 s each.
- The recipes for horns, dragon, bat, hydra and cerberus were accurate and each one was usable
  directly.
- The `unbalanced` and `limb_intersection` messages named the knob and a size for the change.
- The bite filmstrip on the hydra (five heads, each snapping in turn, `bite-contact` at 0.27 s) and
  the fly filmstrips for the bat and dragon were convincing checks.
