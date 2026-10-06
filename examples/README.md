# Examples

Every blueprint here sits beside its render (`<name>.json` and `<name>.png`), so people and LLMs
can see what a blueprint produces. They double as the golden test set: each must stay valid, and
once the pipeline lands each must compile to the same quantized mesh and skeleton on every run.

Regenerate the renders with `pnpm render:examples` after changing a blueprint or the pipeline.

| Blueprint                                      | Body plan | Shows                                              |
| ---------------------------------------------- | --------- | -------------------------------------------------- |
| [ridgeback-stalker.json](ridgeback-stalker.json) | Quadruped | Profiles, mirrored limbs, horns, spike row, eyes, a three-layer skin |
| [bog-troll.json](bog-troll.json) | Biped | Upright torso, long arms with grasping hands, tusks, teeth, mottle and grime |
| [ember-beetle.json](ember-beetle.json) | Hexapod | Sprawled legs, a nose horn, chitin, spots on the back, overriding preset eyes |
| [reed-viper.json](reed-viper.json) | Serpent | No legs, fangs, banded back over scales |
| [grey-wolf.json](grey-wolf.json) | Quadruped | Padded paws on a digitigrade stance (feet that roll as they walk), a bushy tail, mottled coat |
| [tusk-boar.json](tusk-boar.json) | Quadruped | Cloven hooves (unguligrade), tusks from the jaw, a bristle row, grime |
| [rust-raptor.json](rust-raptor.json) | Biped | Taloned feet with three toes forward and one back, a long tail, striped scales |
