# Gate 9 feedback, agent d (prompts p16 to p20)

Worked only from `docs/blueprint.md`, `docs/catalog.md` and `examples/` (JSON and PNG), plus the CLI.
Renders and analyze output went to a scratch folder outside the repository.

## Summary

| Prompt | Attempt files | First valid | Revisions after it, and what drove them | Final attempt | Final `analyze` warnings |
| --- | --- | --- | --- | --- | --- |
| p16-ant-soldier | attempt0, attempt1 | attempt0 | 1. Visual only: the head was not big enough and the mandibles read short, so head radius 0.17 to 0.23, length 0.32 to 0.4, mandible length 0.25 to 0.34 | attempt1 | none (`validate` also clean, no `notBuilt`) |
| p17-goblin | attempt0 to attempt3 | attempt0 | 3. attempt1: `limb_intersection` (legs 0.5 cm into each other), frog-like look, torso too thin, too tall for "small". attempt2: ears far too small, so ear length and width raised about 3.7x. attempt3: removed a "nose" horn that landed on the forehead, and the countershade layer | attempt3 | none |
| p18-cobra | attempt0 to attempt3 | attempt0 | 3. attempt1: not rearing high (55 cm tall), neck 0.6 to 1.1. attempt2: neck 1.4, hood `open` 0.3 to 0.7 so the hood shows at rest. attempt3: countershade `height` -0.6 to -0.9 so the front of the neck stays brown | attempt3 | none |
| p19-rhino | attempt0 to attempt4 | attempt0 | 4. attempt1: `limb_intersection` (10 cm), bigger head, `hide` material. attempt2: copied the tusk-boar leg recipe (attach angle 96, splay 26). attempt3: slimmer torso, splay 30. attempt4: last 1.9 cm warning (foreleg splay 32, thinner), larger horns | attempt4 | none |
| p20-nightmare-hound | attempt0 to attempt3 | attempt0 | 3. attempt1: legibility (black on dark grey), grime too faint, spines too regular, `limb_intersection` 2.5 cm. attempt2: ears and a shorter tail so it reads as a hound, not a lizard. attempt3: warning still there after +6 degrees, so splay 20 and 14 | attempt3 | none |

All five were valid on the first try, so no revision was driven by a validation error. Every revision
came from a render, from `analyze` (`limb_intersection` three times) or from the description.
Final sizes: ant 78 cm long, goblin 91 cm tall, cobra 2.7 m long and 1.15 m tall, rhino 3.0 m long
and 1.1 m tall, hound 2.3 m long.

## What worked well

- The recipes table did most of the work. The goblin eye recipe, the rhino nose horn row ("add a smaller one at at 0.4"), the cobra recipe (neck pitch 80, countershade height) and the insect-mandibles row each gave a correct first attempt.
- The `limb_intersection` fix text with a path and a number was usable every time.
- Contact sheets with `--labels` and the `head` panel made it easy to see where a part landed. The `analyze` description is a good sanity check (it caught "sprawling legs" on my rhino).

## p16-ant-soldier

- Prompt says "two mandible-like horns". The doc offers two answers: the `mandible` part (mouth slot, moves with the bite) and `horn.curved` with `aim: "forward"` (fixed, "do not move"). The recipe row resolved it for me, but a one-line note such as "an ant's jaws are `mandible`, not horns" in the part table would stop a model guessing between them.
- No recipe for an ant's body. A narrow waist and a big abdomen come from a torso `radius` profile with a pinch (`[0.09, 0.13, 0.04, 0.2, 0.18, 0.08]`); the docs only mention "more torso radius points" for a beetle's abdomen. I guessed the numbers and it worked, but an ant example (or a sentence on pinching the profile for a waist) would help.
- The mandibles read as a flat bar across the bottom of the head in the front view, like a moustache, not as two jaws held forward and apart. `mandible` has `length`, `curve` and `teeth`, but nothing for how far apart they sit or how wide they gape (a `spread` or `gape` angle). With `curve` at 85 the tips cross.
- In the `--filmstrip --action bite` frames the mandibles open only slightly against the head. It is hard to see from the filmstrip that they "open with the jaw" as documented.
- `head.radius` goes up to 0.6 but there is no guidance on how big is still believable next to the legs and neck. I found 0.23 reads as a big ant head.
- `analyze` description says "golden eyes" when I had set nothing, which is just the default iris. Harmless.

## p17-goblin

- The recipe for a goblin head and eyes exists and works. There is no recipe for the rest of a goblin: the biped preset is tall and lanky, and a goblin wants a small, potbellied, hunched body. I changed `scale` to 0.34, widened the torso profile and lengthened the arms by guesswork. A "small biped" sizing note would help (the docs say a biped stands about 2.5 x `scale`, which is right, but nothing links that to "small").
- Ears: `ear.pointed` defaults (length 0.12, width 0.05) are far too small for a goblin on a head of radius 0.3, since lengths are in torso lengths and the head is big. I needed length 0.45 and width 0.13. A note that part sizes do not follow the head (unlike teeth and eyes) would save a revision. The `lean`, `curve` and `droop` interplay is hard to predict: my first ears (droop 0.45, lean -20) came out as small leaves pointing backwards.
- No nose part. I tried `horn.curved` at `at` 0.03, `angle` 0 on the round head and it ended on the forehead above the eyes, which in the front view looks like a hole. On a round head it is not clear where "the face" is in `at` and `angle` terms: `at` 0 is the "snout tip", but the eyes at `angle` 62 sit well above the axis, so something at the tip is below them. A way to put a part on the front of the face (or a `nose` part) is missing. I dropped it.
- There is a diagonal light and dark band across the chest of the upright biped in the front view. I first blamed `countershade`, but it stays after removing that layer, so it looks like a shading seam between the neck and torso meshes on an upright torso. I could not find a parameter that changes it.
- `limb_intersection` on the biped legs: the fix ("attach both higher up the side (a lower attach.angle)") worked at once (130 to 112). Good message.
- `analyze` describes the goblin as having "a broad, flat body" (inherited `crossSection: wide`), which reads oddly for a person-shaped creature.

## p18-cobra

- The recipe is accurate but undersells how big the numbers are. "Neck pitch 75-80" gave a neck only 55 cm tall at the length in the `hooded-cobra` example. To rear a metre high on a 2.7 m snake I needed neck `length` 1.4 and 7 segments. Nothing in the docs relates neck length to rearing height; the doc could say "height is about neck length x scale".
- The hood is folded at rest (`open` 0.3), so a still render of the example cobra does not look like a cobra. I needed `open` 0.65-0.7 for the hood to show at a glance, and `--flare 1` then looked the same as the rest pose (no change to see). The doc should say the hood only reads in a still image if `open` is raised, or that `--flare` is the way to see it.
- `neck.curve` (the S-bend) did nothing I could see at 20-25 degrees on a neck pitched at 80. The neck bends in one sharp L at its base. The doc says the S fixes this, but for a rearing cobra I could not get a visible S.
- A rearing neck shows its belly colour on the front; the recipe says `countershade` height about -0.6. That was not enough to keep the front brown, and I used -0.9. Worth updating the number.
- The contact sheet frames a 2.7 m snake in a very small part of each panel (the rearing neck is a thin sliver). The `head` panel is the only one with detail. A serpent-friendly crop (zoom to the raised part) would help.
- `bands` `count` is over the whole length, so the bands on the neck are few and wide. That worked, but it was not obvious how to put more bands on the neck than on the tail.

## p19-rhino

- Rhino nose horn and the "smaller one behind" were covered by the recipe row and worked directly.
- The biggest cost was `limb_intersection` on a broad torso. The message estimates are optimistic: with splay 15 it said "about 10 degrees more" (8 cm), after more splay 3.3 cm and then 1.9 cm, each time "about 5 degrees more". It converged only after copying `examples/tusk-boar.json` (attach angle 96, splay 26) and then going to splay 30 to 32. The doc says splay is 0 for upright walkers, but a rhino, hippo or boar with a wide torso (radius over 0.22) needs a lower `attach.angle` and splay 20 to 30, and the result is a "sprawling legs" description and a wide stance. Please add that rule of thumb, and make the number in the fix match what is really needed.
- The fix text also says "On a broad body a lower attach.angle can make it worse", while the biped message says a lower angle is the cure. Both are right in their cases, but "broad body" is vague. A threshold (torso radius) would help.
- "Grey scaly hide" is ambiguous between `material: "scales"`, `material: "hide"` and a `scales` layer. The doc explains the difference between the material and the layer, but not which to pick for a rhino. I went with `hide` plus a `scales` layer (size 0.05, bump 0.6), which reads as plates of hide.
- `scales` layer `size` 0.05 looks round and fish-like at rhino size, with no way to make plates or folds (a rhino's skin fold). Fine for the prompt, but the look is more "fish scales" than "armour".
- The torso is a very round tube. A shoulder hump or a deeper chest profile is possible with the radius list, but the doc has no example for a heavy-built animal.

## p20-nightmare-hound

- Black and very dark colours are hard to judge: the render background and lighting are mid-dark, so a near-black creature loses its shape and the grime is nearly invisible. A `--bg` or exposure option for the renderer would help.
- `grime` defaults to dirt on feet and in creases. On a black base it shows as brown socks on the legs and hardly at all on the body, even at `amount` 1.0 and `creases` 1.0. The doc says nothing about using a colour much lighter than the base to make it show, which is what I ended up doing.
- No hound body plan, so I used `quadruped`. With the default tail (0.7, thick) and the `snout` head it reads as a lizard or a stegosaur. Shorter tail, ears and a deeper chest fixed it. A "hound / wolf" note in the quadruped recipes (ears, thin tail, `foot.paw`) would help.
- `spikes.row` `jitter` gives jagged rows nicely, and `spine` rows are well documented. The row stands quite tall at the shoulders, but I could not make it follow a hackle that is higher at the neck other than with the `height` profile.
- Same `limb_intersection` convergence issue as the rhino: "about 5 degrees more splay" after 6 degrees gave 1.3 cm still; it needed 20 and 14 in the end.
- Red eyes: `irisColor` alone was not enough, because the default sclera is cream and the eye reads as a white eye with a red dot. Setting `scleraColor` to a dark red and `scale` to 1.8 made them read as red eyes. Worth a recipe row ("glowing red eyes").

## Errors and tool behaviour

- No validation error occurred, so I cannot rate the error messages from `validate`. All of the feedback on messages is about warnings.
- `ENOENT: no such file or directory, open 'p16-ant-soldier.attempt0.json'`: I had changed into the run folder and used a relative path, but `pnpm -s spawnforge` runs from the repository root, so the file was not found. The message does not say which directory it looked in. Printing the resolved path (or saying "relative to the repository root") would have saved a minute.
- `render failed: page.goto: Timeout 30000ms exceeded.`: I started five renders in parallel and three failed this way, two succeeded. Re-running them one at a time worked. The message does not say that parallel renders are the likely cause. The docs say nothing about running renders concurrently; it would help to say "one at a time", or to give each render its own server port.
- `limb_intersection` fix amounts (see rhino and hound above) are too small by a factor of two or more, and the same advice repeats after each partial fix.
