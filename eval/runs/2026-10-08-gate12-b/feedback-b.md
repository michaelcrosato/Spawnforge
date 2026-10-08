# Gate 12, suite B (b06 to b10): feedback from the writing model

Worked only from `docs/blueprint.md`, `docs/catalog.md` and `examples/` (JSON, PNGs and the two
scenario files), plus the CLI. Every first attempt validated with no errors and no warnings, so
there are no validation error messages to judge; the drivers of every revision were renders and
`analyze`. No blueprint used `notBuilt` features (none were reported).

## Summary

| Prompt | Attempt files | First valid | Revisions after it | What drove them | Final analyze warnings |
| --- | --- | --- | --- | --- | --- |
| b06-kraken | attempt0, attempt1 | attempt0 | 1 | One eye hidden behind tentacle roots in the 3/4 view, so the head radius went up and the eyes moved back and up with `bulge` 0.8 | none (final: attempt1) |
| b07-reef-shark | attempt0, attempt1 | attempt0 | 1 | Body read slim from above and the dorsal and tail fins were not "tall" enough: torso and head radius up, dorsal `height` 0.45, tail `size` 0.65, teeth `scale` 1.5 | none (final: attempt1) |
| b08-cave-spider | attempt0 to attempt3 | attempt0 | 3 | (1) fangs were dark on dark skin and the abdomen could be rounder; (2) `tipColor` never showed, so the fang `color` itself went venom green; (3) the open mouth looked like a mammal's (lips, tongue), so `lips` 0 and `tongue` "none" | none (final: attempt3) |
| b09-scorpion-king | attempt0, attempt1 | attempt0 | 1 | Head too small to carry a "king" read and the stinger was small: bigger head, a gold `spikes.row` crown, stinger `length` 0.2 | none (final: attempt1) |
| b10-centaur | attempt0 to attempt2 | attempt0 | 2 | (1) preset body looked like a dachshund: horse barrel, thicker legs, bigger hooves, bigger horns, arms held out a little, a mane row; (2) `part_buried` on the mane (only 21% showed), so the mane went; the chest was too bulky, so `muscle` back to 0.6; `hide` made a scaly-looking face, so `skin`; a furred tail | none (final: attempt2) |

Final answers: `b06-kraken.attempt1.json`, `b07-reef-shark.attempt1.json`,
`b08-cave-spider.attempt3.json`, `b09-scorpion-king.attempt1.json`, `b10-centaur.attempt2.json`.
Checks run on finals: contact sheet with labels, `analyze` (counts: kraken 8 tentacles; shark 2
fins, no legs; spider 8 legs; scorpion 6 legs and 2 arms; centaur 4 legs and 2 arms), the head
with `--jaw`, and the relevant filmstrip (swim, `bite`, `pinch`, `lash`, walk).

## b06-kraken

What worked: the Kraken recipe row plus `examples/kraken.json` gave a valid, good-looking body on
the first try. `bioluminescence` on the mantle and a dark palette gave "deep sea" cheaply.

Confusing or hard:
- **"It swims" is easy to miss.** Tentacles on the head do not make a swimmer; that is stated only
  inside the Tentacles bullet, and the Kraken recipe row does not mention `media.water`. I got it
  from the example. A serpent with head tentacles and no `media` would slither, and nothing warns.
- **`media.land: false` is not documented anywhere I read** (the catalogue lists the switch, the
  guide only shows `{ "water": true }` and `{ "air": false }`). I tried it and it worked (a
  swim-only creature, no walk gait), but I had to guess that it was legal and what it meant.
- **Swimming cannot be judged from the sheets.** The contact sheet and filmstrip draw the kraken
  lying on the floor with its tentacles curled onto the ground. The `swim.undulate` filmstrip
  frames are nearly identical (a short bulb body with head tentacles hardly undulates), and its
  caption says "no legs: the body follows its own trail (slither)" under a swim gait, which is
  wrong. The swim scenario render worked, but frames 3 to 8 are identical once it arrives, and it
  says "walked 11 m" for a swimmer.
- **`analyze` reports `speed.walk` 0.99 for a creature that cannot walk** (`gaits` lists only
  `swim.undulate`). The key is the slowest gait's speed, not a walk.
- **No jet or tentacle swim gait.** `swim.undulate` is the only fit for a legless swimmer; its
  `amplitude` would not make an eight-armed body look like it swims.
- **Huge eyes.** `scale` tops out at 3, and eyes placed at `at` 0.55 sit behind the tentacle roots
  (`at` 0.35 on the same head), so one eye vanished in the 3/4 view. The docs do not say that
  tentacle roots on the head can hide eyes; `bulge` is only in the catalogue.
- `analyze` `parts.eyes.count` is 1 for a mirrored pair.

## b07-reef-shark

What worked: the Shark or fish recipe row was exact; `{ "id": "pelvic", "remove": true }` gave
"two pectoral fins" and `fin.dorsal` `height` / `fin.tail` `size` made the fins tall. Teeth read
at once, with the mouth shut or open (`--views head,front --jaw 0.7`).

Confusing or hard:
- The prompt says "two pectoral fins", but the `fish` preset has two pairs. The docs say how to
  drop the pelvic pair, though not that a prompt like this wants it dropped. I had to decide.
- **A `tall` fish is very narrow from above** (80 cm wide counting the fins, on a 2 m shark). The
  guide says keep it `tall` and warns a `round` fish reads as a plank from the side. There is no
  in-between, such as a width and a height ratio, so a shark's thicker back can only come from
  `radius`.
- "Rows of teeth": `teeth.row` is one row on each jaw (no `rows` parameter), so several rows of
  teeth, as sharks have, are not possible. One upper plus one lower row matched the prompt.
- `analyze` `parts.<id>.size` is in metres and sometimes not what was written (dorsal `height` 0.36
  at scale 0.9 reported 0.383), and `count` means different things (eyes 1 for a pair, teeth 14 =
  teeth that fit, `pectoral.L.membrane` 6 = rays).
- In the front view the shark shows as a big pale ellipse (torso end) with a thin vertical line
  (dorsal edge on). It reads oddly beside the head.

## b08-cave-spider

What worked: `octopod` plus `mandible` `"shape": "fang"` (from `examples/tomb-spider.json`) gave a
spider immediately. A bigger torso `radius` profile at the rear gave the bulbous abdomen.

Confusing or hard:
- **`mandible` `tipColor` had no visible effect**; only `color` did. The fangs stayed dark until
  `color` itself was bright. "Venomous" has no module: I used a venom-green `color`.
- **A spider's head has a mammal's mouth** (pink gums, a tongue, lips) when the jaw opens. The
  fix is `lips` 0 and `tongue` "none", but nothing connects "spider" to that; I found it from the
  head view with `--jaw`.
- The `description` calls the skin "orange chitin" for `#8a7a62` (a drab tan) and "1-toed clawed
  feet"; colour words can mislead a reviewer.
- The `octopod` preset's two eye pairs: only `irisColor` was easy to set; the other eye pair
  (`side-eyes`) is only mentioned by id in the catalogue. A cave spider's reduced eyes would be
  `scale` 0.5; I left them.
- `analyze` says "tripods up to 1.5 m/s" for an eight-legged body, while the guide says eight legs
  use `tripod` as "alternating sets of four" (consistent, but the word is misleading).

## b09-scorpion-king

What worked: the Spider or scorpion recipe, `examples/dune-scorpion.json`, `hand.pincer`, `pinch`
and `lash` all worked as written. `armor.bands` with `from` 0.15 gave the armoured back, and the
tail `pitch` 60 / `curl` 170 arched it over the back.

Confusing or hard:
- **"Six legs" contradicts the example.** `octopod` has four leg pairs and `dune-scorpion.json`
  keeps all of them (8 legs plus claws). The prompt wanted 6 legs plus arms. Nothing in the guide
  says how: I removed `leg1` and moved `leg2` to `leg4` by id with new `attach.at` values. That
  worked, but it took a guess; a one-line note in the recipe, and `analyze` `counts` as the check,
  would help. An agent copying the example would produce eight legs and nothing would warn.
- **The stinger recipe and example disagree**: the recipe table says `curve` 60, the example uses
  -80. I used -80 (the stinger hooks downward over the back).
- The recipe for a scorpion does not mention armour; I found `armor.bands` in the catalogue's
  parts list. "Armoured back" is easy to miss for someone who does not scan every part.
- There is no crown part. A `spikes.row` on the head is a mohawk, not a crown.
- Pincers hang low in the side view (arm `lift` 80 still reads as pointing down in the side
  silhouette); in the 3/4 and top views they read well.

## b10-centaur

What worked: the `centaur` preset already has hooves, hands and an upright torso, so the first
attempt was a valid centaur. `horn.curved` values from `examples/grove-centaur.json` read well.

Confusing or hard:
- **The Centaur recipe row says to give the legs `foot.hoof` and the arms `hand.grasp`, but the
  preset already does.** I wrote them anyway. The row should say what is left to do (horns,
  proportions, skin).
- **The preset body looks like a dachshund** (thin torso, thin legs, stick tail). The Horse row in
  "Big mammals" gives the fix (a `[0.17, 0.23, 0.22, 0.2]` torso, thicker legs), but the Centaur
  row does not point to it.
- **Fur and materials cannot separate the horse half from the human half.** `region` "limbs"
  includes the arms, and "torso" includes the neck, which is the human torso, so only the tail could
  be furred. `hide` made the human face look scaly (a cracked hex pattern), so I used `skin`.
- **`part_buried`**: a `spikes.row` mane on the centaur's neck warned "only 21% of the part shows
  above the skin ... make it longer or larger, or attach it where the body is thinner". It was
  useful, but it names no parameter and gives no amount (`height`, and how much). `validate` does not
  show it (compile-time, as documented); `analyze` shows it with the code `part_buried`, but
  `render` prints only a plain string inside `info.warnings`, which is easy to miss in a long result.
- `body.muscle` 0.7 gave the human chest a bodybuilder look; 0.6 was better. The docs do not say
  `muscle` affects the human half more than the horse half.
- The `description` says "a quadruped" and never "centaur", and the colours are named from the
  palette ("brown skin").

## Docs and tools: smaller points

- The recipes tables are the best part of the guide; every prompt here was close to a row. Gaps are
  where a prompt differs from the example (six legs, two pectoral fins only, "venomous", "armoured").
- `render` takes about 20 s per sheet and filmstrip; running five in parallel worked.
- Everything else in `render` (`--views head,front`, `--jaw`, `--size`, `--action`, `--scenario`)
  behaved as documented.
