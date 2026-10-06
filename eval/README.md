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

## Suite B (plan 2)

[prompts-b.json](prompts-b.json) holds 20 prompts that need plan 2's vocabulary: wings, fins,
tentacles, several heads and tails, shells, quills, fur, swimming and more. Each lists `expects`:
feature checks on the creature the last valid attempt resolves to (`eval/expects.ts`), such as
"two limbs with role wing" or "`body.neck.count` is 5". A run whose `run.json` says
`"suite": "b"` is scored against it, and the gate counts both validity and expects:

```sh
node eval/score.ts eval/runs/<run>              # suite from run.json
node eval/score.ts eval/runs/<run> --prompts eval/prompts-b.json
```

In milestone 7.3 suite B runs as a **format eval**: the model gets the docs and `validate` (with
`list-modules` and `describe-module`), since renders cannot show features that are not built
yet. `validate` lists those under `notBuilt`; the protocol tells the model to keep them. From
gate 9 it runs with renders and a blind review, as suite A does.

## Quality review (plan 2)

Plan 2 changes how creatures look, so it compares the pipeline with itself: the same blueprints
rendered at two commits, shown in pairs with the sides shuffled and the names hidden. Using the
same blueprints keeps agent-to-agent variation out of the comparison. The set is the phase 4
run's 20 final blueprints.

```sh
node eval/quality.ts prepare eval/runs/<run>/quality --base <commit> [--head <commit>]
node eval/quality.ts score eval/runs/<run>/quality
```

`prepare` renders each blueprint at the base commit (in a temporary git worktree, with its own
`pnpm install --offline`) and at the head (default: this working tree) into `pNN-A.png` and
`pNN-B.png`, writes the rubric and the pairs to `review.md` (and `review.html` for people) and
keeps the key in `quality-key.json`. It writes the same pairs with their sides swapped into
`swapped/`. Each folder goes to its own reviewer, who reads only that `review.md` and the images,
picks the better creature of each pair (or `same`) against the rubric (silhouette, anatomy,
extremities, mouth and eyes, surface) and says why, in `quality-answers.json`
(`{ "p01": { "pick": "A", "why": "…" } }`). `score` adds the two verdicts on each pair (+1 head,
−1 base, 0 same) and counts how often the head was preferred; gate 8 needs it in at least 16 of
20 pairs.

Both orders are needed because reviewers lean toward one side: milestone 8.1's three
single-order reviews picked B in 60–75% of pairs whichever side the head was on, which pulls any
score toward an even split. With both orders a lean gives one vote each way and counts as
`same`, so only a preference that holds both ways counts. `score` reports each reviewer's
picks per side in `quality-score.json`.

## Motion review (plan 2)

Filmstrips of gaits, actions and [scenarios](../docs/scenarios.md), rendered anonymously (no
creature, gait, action or event names) and matched blind to the tasks that asked for them.

```sh
node eval/motion.ts prepare eval/runs/<run>/motion [--tasks eval/motion-dry.json]
node eval/motion.ts score eval/runs/<run>/motion [--threshold 8]
```

A task list holds `{ id, task, blueprint, filmstrip | scenario }` entries
([motion-dry.json](motion-dry.json) is plan 1's gaits and actions plus two scenarios). `prepare`
writes `mNN.png` in shuffled order, the task list in `review.md` and the key in
`motion-key.json`; the reviewer writes `motion-answers.json` (`{ "m01": "<task id>" }`). Gate 10's
suite M adds checks per task.

## Dry runs

Both reviews ran once on known material before any gate relies on them, in
[runs/2026-10-06-phase7-tools](runs/2026-10-06-phase7-tools/):

- **Quality:** `d101c06` against itself (`--base d101c06 --head d101c06`, each side in its own
  worktree). The 20 pairs came out byte-identical, and the blind reviewer judged all 20 `same`:
  even, as it must be. So the tool renders each side with that commit's code and the shuffle
  gives the reviewer nothing to go on.
- **Motion:** plan 1's gaits (a quadruped's walk and trot, the beetle's tripod gait, the viper's
  slither, the troll's walk) and actions (bite, roar, look), plus the two example scenarios, as
  10 anonymous filmstrips. The blind reviewer matched 10 of 10 to their tasks, mostly from the
  footfall diagrams (diagonal pairs for the trot, alternating triples for the tripod gait) and,
  for actions, from what the head and jaw do.
