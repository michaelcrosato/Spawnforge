# Creatures in game engines

A Spawnforge export is one binary glTF file (`.glb`) that any engine with a glTF importer reads:
skinned meshes on one skeleton, texture maps, baked animation clips, sockets as nodes, levels of
detail, and the creature's data in the root node's extras. This guide goes engine by engine:
Godot 4, Unity 6, Unreal Engine 5 and Blender. [runtime.md](runtime.md#exported-as-glb) lists
what the file holds; this page says what each engine does with it.

```sh
pnpm spawnforge export creature.json --out creature.glb --stats rpg
```

## What every engine gets

| In the file | What it is |
| --- | --- |
| `skin`, `parts`, `eyes`, `membranes` | Skinned meshes, each with its own material and UV atlas |
| Base colour | sRGB texture; membranes keep their opacity in its alpha (`BLEND`) |
| Normal map | Tangent space, glTF's convention (OpenGL: +Y up), with tangents in the file |
| ORM | One image: occlusion (R), roughness (G), metalness (B, 0) |
| Emissive | Glow, with `KHR_materials_emissive_strength` when brighter than 1 |
| Clearcoat | Chitin's lacquer, `KHR_materials_clearcoat`, with the normal map |
| Animations | `idle`, a cycle per gait, each action, `death`, and `takeoff`/`land` for flyers |
| `socket_*` nodes | Empty nodes under bones: `socket_mouth`, `socket_head`, claw tips, centre of mass |
| `skin_LOD1`–`3`, `parts_LOD1`–`3` | Levels of detail (50, 25, 10%), listed by `MSFT_lod` |
| Extras (`spawnforge`) | The blueprint, clips with speeds and events, sockets, hit capsules, levels, fur, glow, stats |

The levels of detail are kept out of the scene's tree, so importers that build the scene from it
(Godot, Unity's glTFast, Three.js) show one mesh each; Blender reads every node and keeps them in
a hidden collection (see its section).

Clips carry no loop flag in glTF: the extras' `clips[].loop` says which loop (gait cycles and
`idle`). Gait cycles are in place (the root stays at the origin): move the creature yourself, at
`clips[].speed` metres a second for the cycle's own rate. Leaps (`jump`, `pounce`), `takeoff` and
`land` carry root motion (`rootMotion: true`).

An export with `--textures none` has no images: its colour is in vertex colours (`COLOR_0`),
which engines' default materials ignore. In Godot enable Vertex Color > Use as Albedo on the
material; in Unity and Unreal use a material that reads vertex colour; in Blender feed a Color
Attribute node into the Base Color.

## Reading the extras

The extras (`spawnforge` on the root node) hold what an engine's importer has no slot for: which
clips loop, each cycle's speed, action events (`bite-contact`), hit capsules, fur, glow pulses,
levels of detail and stats. Importers differ in what they keep of glTF extras, so each engine
below has a short script that reads them from the file itself: the JSON chunk's length is in
bytes 12–15 and it starts at byte 20. They are in [`engines/`](../engines/):

| Engine | Script |
| --- | --- |
| Godot 4 | `engines/godot/spawnforge_extras.gd` (`SpawnforgeExtras.read(path)`) |
| Unity 6 | `engines/unity/SpawnforgeExtras.cs` (`SpawnforgeExtras.Read(bytes)`, needs Newtonsoft JSON) |
| Unreal 5, any Python | `engines/python/spawnforge_extras.py` (`read_extras(path)`; `python3 spawnforge_extras.py creature.glb` prints them) |
| Blender | None needed: the importer keeps them on the armature (below) |

The Python reader and Blender's import are tested against a real export in CI
(`packages/render/src/engines.test.ts`, Blender as the `bpy` module); Godot, Unity and Unreal do
not run in CI, so their sections are written from their importers' documentation, and their
scripts read the same bytes as the tested one.

## Godot 4

Put the `.glb` in the project: Godot imports it as a scene with a `Skeleton3D`, a
`MeshInstance3D` per mesh, the `socket_*` nodes as `BoneAttachment3D`s on their bones, and an
`AnimationPlayer` with every clip.

- **Materials.** Base colour, the ORM image's channels, the normal map (glTF's convention is
  Godot's), emissive and clearcoat import as `StandardMaterial3D` settings. Membranes are
  double-sided with alpha blending.
- **Looping.** glTF has no loop flag: in the import dock's Advanced Import Settings, set each
  clip whose `loop` is true (idle and the gait cycles) to Linear, or in code:
  `player.get_animation("walk").loop_mode = Animation.LOOP_LINEAR`.
- **Speed.** Play a gait at `speed / clip.speed` (`player.speed_scale`, or the
  `AnimationNodeTimeScale` of an `AnimationTree`) and move the body at `speed` yourself.
- **Root motion.** For `jump`, `pounce`, `takeoff` and `land`, set the `AnimationTree`'s
  `root_motion_track` to the root bone (`Skeleton3D:<root>`, the first bone) and apply
  `get_root_motion_position()` to the body each frame, or move it yourself and ignore the
  root's track.
- **Sockets.** `find_child("socket_mouth")` is a node that follows the jaw: parent effects to it.
- **Levels of detail.** Godot generates its own mesh LODs on import with meshoptimizer (on by
  default: Meshes > Generate LODs), so the file's `skin_LOD` levels are not needed; they are not
  in the scene's tree. `GLTFDocument.get_supported_gltf_extensions()` lists what your version
  reads, `MSFT_lod` included or not.
- **Extras.**

  ```gdscript
  var data := SpawnforgeExtras.read("res://creatures/wolf.glb")
  var bite := SpawnforgeExtras.clip(data, "bite")
  for event in bite["events"]:
      if event["type"] == "bite-contact":
          print("deal damage at ", event["time"], " s")
  ```

## Unity 6

Install glTFast (`com.unity.cloud.gltfast`) and put the `.glb` under `Assets`: it imports as a
prefab with a `SkinnedMeshRenderer` per mesh on one skeleton, its materials and textures, and the
clips.

- **Animation.** In the import settings choose Mecanim (the default; clips import as Generic) or
  Legacy. Mark the looping clips (`loop` in the extras: idle and the gait cycles) as looping in
  their state or `wrapMode`.
- **Materials.** glTFast's shaders read the metallic-roughness maps, the normal map, emissive
  and, in HDRP, clearcoat. If emissive strength above 1 is not kept, multiply the material's
  emission by the file's `KHR_materials_emissive_strength` (the beetle's glow, for one).
- **Root motion.** Clips with `rootMotion` move the root bone: with an Animator, enable Apply
  Root Motion; otherwise move the object yourself.
- **Sockets.** `transform.Find(...)` the `socket_*` children under the bones.
- **Levels of detail.** The importer shows the full meshes; the extras' `lods` give each level's
  node and error, if you build a LOD Group from your own simplified meshes.
- **Extras.** Keep a copy of the file's bytes where the game reads them (in `StreamingAssets`, or
  renamed to `.bytes` as a `TextAsset`):

  ```csharp
  var data = SpawnforgeExtras.Read(glbAsset.bytes);
  var walk = SpawnforgeExtras.Clip(data, "walk");
  animator.speed = desiredSpeed / (float)walk["speed"];
  ```

## Unreal Engine 5

Drag the `.glb` into the Content Browser: the Interchange importer makes a Skeletal Mesh, its
Skeleton and Physics Asset, an Animation Sequence per clip, materials and textures, converting
glTF's metres and Y up to centimetres and Z up.

- **One skeletal mesh.** The file's meshes share one skin; if the importer splits them, set
  Combine Skeletal Meshes to combine those that use the same skeleton.
- **Looping and speed.** Sequences play once by default in a montage and loop in a state
  machine; play a gait at `speed / clip.speed` (Play Rate) and move the pawn at `speed`.
- **Root motion.** For clips with `rootMotion`, enable Root Motion on the sequence.
- **Sockets.** The `socket_*` nodes arrive in the skeleton under their bones: attach to them by
  name.
- **Levels of detail.** Unreal makes its own (the Skeletal Mesh's LOD settings). If your
  importer version brings in the file's `skin_LOD` and `parts_LOD` meshes as well, delete them,
  or export with `--lods none`.
- **Extras.** In the editor's Python (Tools > Execute Python Script):

  ```python
  from spawnforge_extras import read_extras, clip
  data = read_extras("C:/creatures/wolf.glb")
  bite = clip(data, "bite")
  contact = next(e["time"] for e in bite["events"] if e["type"] == "bite-contact")
  # add an Anim Notify to the bite sequence at `contact` seconds
  ```

## Blender

File > Import > glTF 2.0 (or `bpy.ops.import_scene.gltf(filepath=...)`): an armature named after
the creature with the meshes `skin`, `parts`, `eyes` (and `membranes`) under it, the `socket_*`
nodes as empties parented to their bones, an Action per clip, and materials with the maps wired
into a Principled BSDF (the ORM image split by channel, the normal map through a Normal Map
node). Tested in CI with Blender as a Python module (`bpy`).

- **Extras.** The importer keeps them as a custom property on the armature object:
  `bpy.data.objects["Grey_Wolf"]["spawnforge"]["clips"]`, no script needed.
- **Levels of detail.** Blender has no `MSFT_lod` but reads every node, in the scene or not:
  the levels arrive as `skin_LOD1`–`3` and `parts_LOD1`–`3` in a collection named Orphan
  Nodes, excluded from the view layer, so only the full meshes show. Include the collection to
  see them, delete it, or export with `--lods none`.
- **Looping.** Actions have no loop flag; the extras' `clips[].loop` says which cycle.

## Three.js

Three.js games can skip the file and run creatures live with `createBestiary`
([runtime.md](runtime.md#live-in-threejs)): procedural motion, foot planting, crowds and levels
of detail. To play a `.glb` instead, see [Playing a .glb in Three.js](runtime.md#playing-a-glb-in-threejs):
`GLTFLoader` puts the extras on the root's `userData.spawnforge`.

## What no engine gets

Fur shells, the glow's pulse, light wrapping round soft skin and breathing are live-only; the
file carries what it can of each (the coat's colour, the glow at time 0, `extras.fur` and
`extras.glow`). [runtime.md](runtime.md#what-the-file-leaves-out) lists them, and every export's
`notes` say which apply to it.
