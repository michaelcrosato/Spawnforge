# Review tools: dry runs

Milestone 7.5 adds two blind reviews; each ran once on material whose answer is known before a
gate depends on it. The renders are not committed (`quality/*.png`, `motion/*.png`); `prepare`
makes them again from the committed blueprints.

| Review | Material | Result | Expected |
| --- | --- | --- | --- |
| Quality (`quality/`) | The phase 4 run's 20 final blueprints at `d101c06`, on both sides | 0 A, 0 B, 20 same (`quality-score.json`) | Even: the sides are the same code |
| Motion (`motion/`) | Plan 1's five gaits and three actions, and two scenarios | 10/10 matched (`motion-score.json`) | All, or nearly: these differ plainly |

The quality pairs were byte-identical, which also shows the renderer is deterministic across
worktrees. The motion reviewer was least sure of the viper's look (a legless body could be
biting or roaring too); with no events on its timeline and the jaw shut, it chose right.
