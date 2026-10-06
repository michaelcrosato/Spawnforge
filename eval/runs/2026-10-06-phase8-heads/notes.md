# Milestone 8.3: heads

Renders for the PR (docs/design/8.3-heads.md). The examples' own contact sheets
(`examples/*.png`, re-rendered) show each head before and after in the PR's file diff.

- `heads-1.png`, `heads-2.png`: every example's head view, `render --views head`, with the mouth
  shut, open (`--jaw 0.85`) and blinking (`--blink 1`). The viper has no eyelids (snakes do not),
  the beetle neither (insects); the boar has tusks and no tooth row.
- `grey-wolf.bite.png`, `grey-wolf.roar.png`, `reed-viper.bite.png`: action filmstrips; the lips,
  gums and tongue open with the jaw (the serpent preset has no roar).

What changed, by the plan's list:

- **Mouths:**
  - heads are refined to their own resolution and cut exactly along the mouth line;
  - inside are the lips' inner faces, gums, a palate and floor that darken toward the throat,
    corner walls and a tongue;
  - the corners stretch;
  - a lip line reads as a crease when shut.
- **Teeth** stand in the gums, packed densely and sized to the skull: incisors, fangs that lean
  out over the lower lip, and cheek teeth.
- **Eyes** are sized to the head, with softer gloss and eyelids on bones of their own that
  blink in clips and exports.
- **Skull:** brows over the eyes, cheekbones and nostrils.
- **Beaks:** the terror bird.

Budgets at medium. Skin triangles and the Node median over five come from `pnpm budgets`. Chrome
is the median of five warm compiles through the render page, since `pnpm budgets` takes one
sample there.

| Example | Skin triangles | Node (ms) | Chrome (ms) |
| --- | --- | --- | --- |
| bog-troll | 24,802 | 486 | 438 |
| ember-beetle | 27,340 | 356 | 373 |
| grey-wolf | 20,718 | 285 | 306 |
| reed-viper | 8,448 | 72 | 129 |
| ridgeback-stalker | 18,182 | 226 | 282 |
| rust-raptor | 17,760 | 206 | 238 |
| terror-bird | 24,816 | 321 | 397 |
| tusk-boar | 27,186 | 521 | 478 |

This machine's timings swing by ±40% from run to run while other work runs (single samples of
the troll ranged from 438 to 673 ms in Chrome). The warm minimum per stage is steadier, and puts
8.3's cost at:

- +8 to +20 ms on the troll, beetle and boar, whose bodies leave their heads little room;
- about +50 ms on the wolf and the ridgeback.

Gate 8 should measure on a quiet machine.

The 1,000-blueprint fuzz ran clean (976 valid, 0 failures) with a median of 353 ms. After the
cheekbones were capped (a 2.9 m needle of a head grew a metre of ridge and 54k triangles), 3 of
the 976 compile over 30k skin triangles (up to 31,780; compile warns there).
