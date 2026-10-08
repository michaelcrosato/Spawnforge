"""Reads a Spawnforge creature's data (the glTF extras on its root node) from a .glb file.

Plain Python 3, no dependencies: use it as is, from Unreal's editor Python, or from Blender's.

    python3 spawnforge_extras.py creature.glb          # prints the extras as JSON
"""

import json
import struct
import sys


def read_extras(path):
    """The `spawnforge` extras of a .glb, or None if it has none."""
    with open(path, "rb") as f:
        data = f.read()
    if data[:4] != b"glTF":
        raise ValueError(f"{path} is not a binary glTF (.glb) file")
    # The JSON chunk: its length in bytes 12-15, its data from byte 20.
    (length,) = struct.unpack_from("<I", data, 12)
    gltf = json.loads(data[20 : 20 + length].decode("utf-8"))
    for node in gltf.get("nodes", []):
        extras = node.get("extras") or {}
        if "spawnforge" in extras:
            return extras["spawnforge"]
    return None


def clip(extras, name):
    """One clip's timing: duration, loop, speed, distance and events."""
    return next((c for c in extras["clips"] if c["name"] == name), None)


if __name__ == "__main__":
    print(json.dumps(read_extras(sys.argv[1]), indent=2))
