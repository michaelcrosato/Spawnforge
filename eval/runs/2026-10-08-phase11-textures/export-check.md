# Export eval, texture tasks: a check of the checker

Not an agent run (gate 11 runs the export eval): the four new tasks done by hand with the CLI,
to check that `eval/export.ts` passes a right answer. Files were not kept.

| Task | Made with | Result |
| --- | --- | --- |
| x05-sharp-maps | `export examples/grey-wolf.json --textures 2048` | pass: skin maps 2048 px, with a normal map (6.6 MB; colour as JPEG, since PNG would pass 8 MB) |
| x06-vertex-colours | `export examples/cave-bat.json --textures none` | pass: vertex colours, no images |
| x07-glow | `export examples/ember-beetle.json`, `{ "pulseHz": 0.3 }` | pass: emissive map, pulse 0.3 Hz |
| x08-live-only | `export examples/sand-cheetah.json`, the output's `notes` and `extras.fur.length` | pass: fur and wrapped light named, fur 0.0096 m |

The first try failed x05–x07 on the checker, not the files: glTF meshes here carry no names (the
check now finds a mesh through its node), and a 2048 colour map is JPEG (it now reads JPEG sizes).
