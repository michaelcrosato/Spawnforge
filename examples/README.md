# Examples

Every blueprint here sits beside its render (`<name>.json` and `<name>.png`), so people and LLMs
can see what a blueprint produces. They double as the golden test set: each must stay valid, and
once the pipeline lands each must compile to the same quantized mesh and skeleton on every run.

Renders are added when the headless renderer lands (phase 1).

| Blueprint                                      | Body plan | Shows                                              |
| ---------------------------------------------- | --------- | -------------------------------------------------- |
| [ridgeback-stalker.json](ridgeback-stalker.json) | Quadruped | Profiles, mirrored limbs, horns, spike row, eyes, a three-layer skin |
