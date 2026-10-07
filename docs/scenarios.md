# Scenarios

A scenario scripts a creature's motion so you can check it with only the CLI or the MCP tools:
the ground, named targets, where the creature starts and timed calls (walk somewhere, follow a
course, start an action, look at something). `analyze` runs it and reports what happened;
`render` draws it as a filmstrip.

```sh
pnpm spawnforge analyze examples/ridgeback-stalker.json --scenario examples/scenarios/stalk-and-bite.json
pnpm spawnforge render examples/ridgeback-stalker.json --scenario examples/scenarios/course.json
```

Over MCP, pass the scenario object as `analyze`'s `scenario` or as `render`'s
`filmstrip.scenario`.

## The file

Positions are metres in the world, with glTF's axes: Y up, and a creature with heading 0 faces
+Z. The creature starts at the origin unless `start` says otherwise. `analyze` reports the
creature's size, hip height and the height of its head, which tell you where to put things.

```json
{
  "ground": "flat",
  "duration": 7,
  "start": { "x": 0, "z": 0, "heading": 0 },
  "targets": { "prey": [0, 0.45, 3.4] },
  "calls": [
    { "at": 0, "do": "lookAt", "target": "prey" },
    { "at": 0, "do": "moveTo", "to": [0, 2.2] },
    { "at": 4.8, "do": "act", "action": "bite", "target": "prey" }
  ],
  "frames": 8
}
```

| Field | Meaning | Default |
| --- | --- | --- |
| `ground` | `"flat"`, or `"course"`: uneven ground with bumps up to 25 cm, flat within 1.5 m of the origin | `"flat"` |
| `seed` | Seed of the course's bumps | `1` |
| `water` | `"none"`; `"sea"`: deep water everywhere (the surface at height 0, the bed four body lengths and 2 m down); or a lake, `{ "x", "z", "radius", "depth" }` in metres, carved into the ground with its surface at 0 | `"none"` |
| `duration` | Seconds to run, 0.5 to 60 | `6` |
| `start` | `x` and `z` in metres, `heading` in degrees (0 faces +Z, 90 faces +X) | the origin, facing +Z |
| `targets` | Named points, `[x, y, z]` in metres, that calls can aim at by name; renders mark them in amber | none |
| `calls` | What happens when, each with `at` (seconds) and `do` | none |
| `frames` | Frames in the filmstrip, 2 to 16, evenly spaced over the duration | `8` |

Calls (a point is `[x, z]` on the ground or `[x, y, z]`, or a target's name):

| `do` | Fields | What it does |
| --- | --- | --- |
| `moveTo` | `to` (a point), `speed` (m/s, default its pace on land or in water) | Walks or swims there and stops; with a height (`[x, y, z]` or a target) a diver dives or rises to it |
| `follow` | `path` (up to 32 points), `speed` | Walks through the points in order, stopping at the last: a course |
| `drive` | `speed` (m/s), `heading` (degrees) | Keeps moving with no destination |
| `stop` | | Stops moving |
| `act` | `action` (one of the creature's), `target` (a point) | Starts an action aimed at the point; one runs at a time, and a new one replaces it |
| `lookAt` | `target` (a point, or `null`) | Turns the head toward the point; `null` looks ahead again |
| `gait` | `gait` (one of the creature's, or `null`) | Keeps to one gait whatever the speed; `null` lets speed choose |

A new `moveTo`, `drive` or `stop` ends a course in progress. Calls at the same time run in the
order written. Mistakes come back like blueprint errors, with a path under `scenario`, the
valid values and a fix: an unknown target name, an action the creature does not have, a call
after the end.

## What you get back

`analyze` adds `scenario` to its result (and `render` adds it to `info.motion`):

| Field | Meaning |
| --- | --- |
| `end` | Where it ended: `x`, `z` (metres), `heading` (degrees), `speed` (m/s) |
| `distance` | Metres walked along the ground |
| `events` | Every event but footsteps, with `time` in seconds: `arrive` (at a `moveTo` point or each course point), `gait` (a change of gait), `medium` (into the water or out onto land, with `medium`), `action-start`, `action-end` and the action's own (`bite-contact`, `roar-peak`, `takeoff`, `land`) |
| `footsteps` | How many steps it took |
| `gaits` | Gaits in the order used, each with when it began |
| `targets` | Per target, the `closest` any snout came (metres) and when |
| `courses` | Per `follow` call, how many of its points it `reached` |
| `footSlide` | Largest distance a planted foot slid (metres); above a centimetre or two is visible |
| `failed` | Calls the creature refused, with why (also a `call_failed` warning) |

So a bite that lands shows a `bite-contact` event and a small `closest` for its target, and a
course walked to the end shows `reached` equal to its point count.

The filmstrip shows the frames, the targets as amber balls, the course's ground, any water as a
translucent sheet, and the events on a timeline below. Uneven ground has no grid; its facets
show where the bumps are.

## Examples

- [`stalk-and-bite.json`](../examples/scenarios/stalk-and-bite.json): the ridgeback stalker walks
  up to a point, keeping its eyes on the prey, and bites it.
- [`course.json`](../examples/scenarios/course.json): it follows a winding route over the uneven
  course.
- [`swim-across.json`](../examples/scenarios/swim-across.json): a lake across the way; the river
  crocodile walks in, swims across and climbs out the far side.
