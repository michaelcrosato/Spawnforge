# Agent eval

The plan's quality gate for LLM usability: a fixed 20-prompt suite ([prompts.json](prompts.json))
that a model works through with only the docs and tools. It starts in phase 0 as a **format
eval** and reruns at every phase gate.

## Protocol

1. The model gets the docs (`docs/blueprint.md`, `docs/catalog.md`, `examples/`) and the tools
   (`validate`, `list_modules`, `describe_module`, later `render` and `analyze`), as MCP tools or
   the `spawnforge` CLI. It does not read source code.
2. For each prompt it writes a first blueprint, saved as `<id>.attempt0.json`, then validates it.
   Each fix after a `validate` is saved as the next attempt (`attempt1`, `attempt2`, …).
3. A prompt passes when one of attempts 0–3 is valid, that is, within three fix rounds.
4. `node eval/score.ts eval/runs/<run>` validates the saved attempts itself and writes
   `score.json`. The score never relies on what the model says about its own work.
5. From phase 1 on, a blind reviewer is shown the renders without their prompts and matches each
   to one of the 20 prompts; the gate is at least 16 correct matches.
   `node eval/blind.ts prepare <run>` renders each prompt's final valid blueprint anonymously
   (no name in the header) into `<run>/blind/rNN.png` in shuffled order and keeps the key in
   `<run>/blind-key.json`. The reviewer writes `<run>/blind-answers.json`
   (`{ "r01": "p07-sprawl-lizard", … }`), and `node eval/blind.ts score <run>` checks it.

**Gate:** at least 18 of 20 prompts valid within three fix rounds, and (from phase 1) at least 16
of 20 renders matched by the blind reviewer.

Each run folder records the model name and version in `run.json`, so results can be compared
across models and phases.
