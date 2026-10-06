# Phase 5 variation eval: notes

Run on commit `e6be4f7` (the phase 5 PR before this eval). Eight tasks
([eval/variation.json](../../variation.json)) need species, `mutate`, `crossbreed` and
`generate`; [eval/variation.ts](../../variation.ts) checks the saved files: validity plus what each
task asked for (ranges, heights, locked skin, body plan, kept stripes).

Score: **8/8 tasks pass** (`variation-score.json`). Gate 7: passes. Every saved file validated
on the first try; the agents spent their effort on getting what the task meant, which is where
the feedback below comes from.

## Feedback, and where it goes

| Feedback | Where it goes |
| --- | --- |
| `{ "min": 2, "max": 3 }` on a tail length drew only 2 or 3 | Fixed: with the registry, integer fields get whole numbers and every other number any value in between, whatever the ends look like |
| Colours can't vary in a species; the range error suggested a number | Fixed: colour ranges `{ "min": "#5a5a5a", "max": "#9a9a9a" }`; the error shows both forms |
| `--lock skin.layers[type=stripes]` and `[id=…]` locked nothing, silently | Fixed: locks take every path form patch does, and an unmatched lock warns |
| A mutation could make a kept stripe layer invisible (accent ≈ base) | Fixed: palette colours keep their contrast with the base |
| Mutation added ears to a snake | Fixed: sense organs are never added, removed or swapped |
| `crossbreed` paired the troll's jaw tusks with the beetle's head horn, so the horn never came over | Fixed: same-type parts pair only on the same section |
| No way to keep one parent's posture in a crossbreed; the body plan switched in about 20% of seeds | Fixed: `--base a|b` and `--lock` (paths keep the base parent's values) |
| `analyze`, `render`, `mutate` on a species gave a wall of "expected number" | Fixed: they ask for an individual (`instantiate` first); `patch` validates a species as one |
| `validate` on a species doesn't say which seeds it tried | Fixed: `checked` lists the individuals |
| `generate --max-height` and `analyze`'s height disagree | Fixed: `analyze` reports `bodyHeight`, measured as generate's limits are; `height` includes horns and spikes |
| `generate --actions` writes no actions into the file | Documented: leaving `motion.actions` out means every action the body allows |
| Children keep the parent's name and seed | Documented: the seed keeps the parent's markings; rename with `patch` |
| `mutate` can't be pushed in a direction | Documented: lock the gene and set it with `patch` |
| No compare command for child and parent | Later: `diff` between two blueprints (the variation tools already return one against the parent) |
