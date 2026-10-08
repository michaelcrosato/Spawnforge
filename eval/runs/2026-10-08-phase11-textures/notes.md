# 11.1 texture maps: notes

The round trip, the validator and the budgets for milestone 11.1
([docs/design/11.1-textures.md](../../../docs/design/11.1-textures.md)), run on the final code.
`roundtrip.json` is `pnpm roundtrip --mutations` (every example at medium, 1024-texel skin maps,
idle clip only; the probes and their mistakes); `budgets.json` is `pnpm budgets` (full exports,
every clip).

## Results

| Check | Bar | Result |
| --- | --- | --- |
| Round trip, 32 examples | Every view: silhouettes ≥ 99% overlap, mean difference ≤ 3.5%, ≤ 5% of pixels off by > 20%, with and without tangents | **32/32 pass.** Overlap 1.0 everywhere; worst mean 2.6% (the reed viper), worst share off 3.4% (the river crocodile); 26 of 32 under 1.5% mean |
| Probes | Each effect's contribution correlates ≥ 0.7 on average, its size 0.7–1.4 of live's in every view | **3/3 pass.** Relief 0.91 (0.88–0.95 per view), roughness 0.81, glow 1.0; sizes 0.88–1.07 of live |
| Mutations | Each mistake fails its probe | **6/6 fail.** Relief: green flipped 0.55, tangent sign 0.55, normal map as sRGB 0.46 (and 1.3–2.0× the size), v flipped 0.26; roughness: ORM swapped 0.47; glow: clipped keeps its shape (0.94) at 0.32–0.49 of the size. The normal-map mistakes and v also fail the plain views (mean 6–11%) |
| Validator | No errors for any example | **0 errors** for all 32 (warnings `NODE_SKINNED_MESH_NON_ROOT`: the skinned meshes sit under the creature's root node, and the information-level `NODE_EMPTY` for sockets) |
| Medium `.glb` | ≤ 8 MB, exported in ≤ 10 s | **Met.** 2.7–7.3 MB (the griffin largest), exported in 2.7–8.1 s with every clip (the hydra slowest; median 4.7 s); every file fits under 8 MB as PNG, so none falls back to JPEG. Compile, triangles, draw calls and motion as at gate 10 (Chrome compile ≤ 440 ms, motion ≤ 0.064 ms, 50 at once 2.42 ms) |
| Export eval | Texture tasks | x05–x08 in `eval/export.json`, checked by `eval/export.ts`; a CLI-made set passes 4/4 (`export-check.md`) |

## What the round trip found

- **Scales alias live, not in the bake.** The first full run failed six scaly creatures (the
  reed viper at 4% mean, 5% off). Drawn side by side, the live head sparkled where the bump from
  2×2 screen derivatives aliases at one pixel a texel, and the export showed softer scales: the
  normal map's slopes over two texels low-pass the relief. Neither is wrong; they discretize the
  same relief differently. The comparison now softens both images by a 1-2-1 kernel each way, a
  texel's bandwidth (a map holds nothing finer), which brought the viper to 2.6% while the green
  flip still stands at 6.3% and an sRGB-tagged normal map at 11%.
- **Long creatures were drawn below a pixel a texel.** Views were capped at 768 pixels, so a
  2.4-metre snake's 2,400 texels fell to 0.3 pixels each. Views now go to 2048 pixels in tiles
  of 1024, drawing only the tiles the creature's bounds reach. It was not the scales' cause, but
  it is the comparison the design asked for.
- **An empty render passed.** A view where neither side drew anything counted as full overlap;
  now it fails.
- **The render page ran out of memory.** Each shot made a new shadow-casting light (a 1024²
  shadow map) and kept every loaded file's textures: after 31 examples Chromium held 11.7 GB and
  was killed mid-view. Lights and loaded files are freed now; memory holds at about 0.8 GB.
- **Mutations against their probes.** A glow mistake cannot show on the relief probe, which has
  no glow: each mistake now runs against the probe whose effect it breaks.
