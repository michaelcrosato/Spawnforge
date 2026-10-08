# 11.3 crowds and the bench: notes

`bench-headless-small.json` is `pnpm bench --small` in the agent's container: WebGL 2 on
SwiftShader, which renders on the CPU, so frame and GPU times say little about a real GPU; plan
2's targets (50 animated and 500 distant creatures at 60 fps) await the owner's laptop run
(`docs/poc.md`). What it does show:

| Scene | Creatures | Update (median) | Draw calls | Slow frames |
| --- | --- | --- | --- | --- |
| Near, full motion | 10 | 1.3 ms | 39 | 0 |
| Distant, each its own draws | 60 | 2.8 ms | 200 | 0 |
| Distant, as crowds | 60 (all crowded) | 0.7 ms | 109 | 0 |

Crowd members skip posing their bones, so the update costs a quarter, and a species draws once
per mesh and level however many members it has: at the full bench's 500 the distant scene's
draw calls grow with the creatures and the crowd's with the species.

## What the bench found

- **Draw calls read 0.** Three's animation loop resets the frame's counters on each display
  frame, which fell between a render and reading them; the bench resets them by hand.
- **Crowds never formed.** The bench rendered in a tight loop of awaited renders, which resolve
  on microtasks, so the page never ran its tasks: the fetch behind the runtime's first
  `import('@spawnforge/bake/lod')` never completed, and no species' levels of detail (which a
  crowd waits for) were made. Games render from `requestAnimationFrame`; the bench now waits for
  the next animation frame between frames, untimed.
- **Hitches from first-use shaders.** A crowd draw per level of detail compiled its own copies
  of the species' materials as members changed level (5 s and 28 s frames on SwiftShader). A
  species now has one draw whose level meshes share its materials, each finding its members
  through a per-object base offset, so its shaders compile once; the warm-up runs until every
  distant creature is in its crowd. Actions run in the near scene only: one brings a distant
  creature to full detail, which the distant scenes do not measure.
