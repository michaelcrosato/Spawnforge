## Reads a Spawnforge creature's data (the glTF extras on its root node) from a .glb file, for
## Godot 4. Attach to nothing: call SpawnforgeExtras.read("res://creatures/wolf.glb").
class_name SpawnforgeExtras


## The `spawnforge` extras of a .glb, or an empty dictionary if it has none.
static func read(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_buffer(4).get_string_from_ascii() != "glTF":
		return {}
	# The JSON chunk: its length in bytes 12-15 (little-endian), its data from byte 20.
	file.seek(12)
	var length := file.get_32()
	file.seek(20)
	var gltf = JSON.parse_string(file.get_buffer(length).get_string_from_utf8())
	if typeof(gltf) != TYPE_DICTIONARY:
		return {}
	for node in gltf.get("nodes", []):
		var extras = node.get("extras", {})
		if typeof(extras) == TYPE_DICTIONARY and extras.has("spawnforge"):
			return extras["spawnforge"]
	return {}


## One clip's timing (duration, loop, speed, distance, events), or an empty dictionary.
static func clip(extras: Dictionary, name: String) -> Dictionary:
	for c in extras.get("clips", []):
		if c["name"] == name:
			return c
	return {}
