"""Imports a Spawnforge export into Blender and checks what an artist gets (docs/engines.md).

Runs with Blender as a Python module (`pip install bpy`, Python 3.13) or inside Blender:

    python check_blender.py creature.glb
    blender --background --python check_blender.py -- creature.glb
"""

import json
import os
import sys

import bpy

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "python"))
from spawnforge_extras import read_extras  # noqa: E402


def check(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    objects = {o.name: o for o in bpy.data.objects}
    armature = next(o for o in objects.values() if o.type == "ARMATURE")
    # The extras arrive as a custom property on the armature, and match the file's.
    extras = armature["spawnforge"].to_dict()
    assert extras == json.loads(json.dumps(read_extras(path))), "extras differ from the file's"
    for mesh in ("skin", "parts", "eyes"):
        assert objects[mesh].type == "MESH" and objects[mesh].parent == armature, mesh
    # Every clip is an action, every socket an empty under the armature.
    actions = {a.name for a in bpy.data.actions}
    missing = [c["name"] for c in extras["clips"] if c["name"] not in actions]
    assert not missing, f"clips without actions: {missing}"
    for socket in extras["sockets"]:
        node = objects.get(socket["node"])
        assert node is not None and node.type == "EMPTY", socket["node"]
    # The skin's maps reach its material: colour, normal map and the ORM image.
    skin = objects["skin"].active_material
    kinds = {n.type for n in skin.node_tree.nodes}
    assert {"TEX_IMAGE", "NORMAL_MAP", "BSDF_PRINCIPLED"} <= kinds, kinds
    # Blender reads every node, so the levels of detail arrive too, as the extras list them, in
    # a collection the view layer excludes: only the full meshes show.
    levels = sorted(name for name in objects if "_LOD" in name)
    listed = sorted(level["node"] for chain in extras.get("lods", {}).values() for level in chain)
    assert levels == listed, f"levels {levels}, extras list {listed}"
    assert not any(objects[name].visible_get() for name in levels), "levels of detail show"
    assert all(objects[mesh].visible_get() for mesh in ("skin", "parts", "eyes"))
    return {
        "creature": armature.name,
        "bones": len(armature.data.bones),
        "actions": len(actions),
        "sockets": len(extras["sockets"]),
        "levels": len(levels),
        "images": len(bpy.data.images),
        "blender": bpy.app.version_string,
    }


if __name__ == "__main__":
    print(json.dumps(check(sys.argv[-1])))
