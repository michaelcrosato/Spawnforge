// Reads a Spawnforge creature's data (the glTF extras on its root node) from a .glb file, for
// Unity. Needs Newtonsoft JSON (com.unity.nuget.newtonsoft-json), which glTFast uses for extras
// too. Keep the .glb's bytes where the game can read them (StreamingAssets, or a copy renamed
// .bytes as a TextAsset), and pass them in.
using System;
using System.Text;
using Newtonsoft.Json.Linq;

public static class SpawnforgeExtras
{
    /// <summary>The `spawnforge` extras of a .glb's bytes, or null if it has none.</summary>
    public static JObject Read(byte[] glb)
    {
        if (glb.Length < 20 || Encoding.ASCII.GetString(glb, 0, 4) != "glTF") return null;
        // The JSON chunk: its length in bytes 12-15 (little-endian), its data from byte 20.
        int length = BitConverter.ToInt32(glb, 12);
        var gltf = JObject.Parse(Encoding.UTF8.GetString(glb, 20, length));
        if (gltf["nodes"] is JArray nodes)
            foreach (var node in nodes)
                if (node["extras"]?["spawnforge"] is JObject data) return data;
        return null;
    }

    /// <summary>One clip's timing: duration, loop, speed, distance and events.</summary>
    public static JObject Clip(JObject extras, string name)
    {
        if (extras?["clips"] is JArray clips)
            foreach (var clip in clips)
                if ((string)clip["name"] == name) return (JObject)clip;
        return null;
    }
}
