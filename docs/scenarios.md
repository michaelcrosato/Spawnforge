# Scenarios

A scenario scripts a creature's motion so you can check it with only the CLI or the MCP tools:
the ground, named targets, where the creature starts and timed calls (walk somewhere, follow a
course, start an action, look at something). `analyze` runs it and reports what happened;
`render` draws it as a filmstrip.

```sh
pnpm spawnforge analyze examples/ridgeback-stalker.json --scenario examples/scenarios/stalk-and-bite.json
pnpm spawnforge render examples/ridgeback-stalker.json --scenario examples/scenarios/course.json
```

`pnpm -s spawnforge` leaves out pnpm's banner, so the output is JSON you can pipe.

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
| `ground` | `"flat"`; `"course"`: uneven ground with bumps up to 25 cm, flat within 1.5 m of the origin; or a slope, `{ "slope": degrees, "toward": degrees, "from": metres }`: ground rising at `slope` degrees toward the heading `toward` (0 is +Z, 90 is +X), through the origin, or flat until `from` metres that way | `"flat"` |
| `seed` | Seed of the course's bumps | `1` |
| `water` | `"none"`; `"sea"`: deep water everywhere (the surface at height 0, the bed four body lengths and 2 m down); or a lake, `{ "x", "z", "radius", "depth" }` in metres, carved into the ground with its surface at 0 | `"none"` |
| `duration` | Seconds to run, 0.5 to 120 | `6` |
| `start` | `x` and `z` in metres, `heading` in degrees (0 faces +Z, 90 faces +X); `flying` (`true` starts a flyer in the air at cruise) and `height` (metres above the ground); or `y`, the height in the world (metres, of the creature's origin, where its feet are when it stands): a flyer's, or a swimmer's in the water (the sea's surface is 0, so `-2` starts it 2 m down) | the origin, facing +Z, on the ground; a swimmer that only swims starts halfway down, one that also walks at the surface |
| `targets` | Named points, `[x, y, z]` in metres, that calls can aim at by name; renders mark them in amber | none |
| `calls` | What happens when, each with `at` (seconds) and `do` | none |
| `frames` | Frames in the filmstrip, 2 to 16, evenly spaced over the duration | `8` |

Calls (a point is `[x, z]` on the ground or `[x, y, z]`, or a target's name):

| `do` | Fields | What it does |
| --- | --- | --- |
| `moveTo` | `to` (a point), `speed` (m/s, default its pace on land, in water or in the air, set by its size and temperament: a crocodile paces at about 0.4 m/s) | Walks, swims or flies there and stops; with a height (`[x, y, z]` or a target) a diver dives or rises to it and a flyer flies at it (taking off if it is out of reach on foot). It gets up to speed within about half a second, changing gait on the way |
| `follow` | `path` (up to 32 points), `speed` | Walks, swims or flies through the points in order (`[x, z]`, or `[x, y, z]` for a height), stopping at the last: a course |
| `fly` | `height` (metres from the ground up to its origin, where its feet are when it stands; default its cruising height, 2 m or more for wide wings), `speed` | Takes off and circles where it is, or hovers if its wings can (insect wings), until told where to go; flying, changes its height or speed. A `stop` in the air hovers or circles there |
| `land` | `to` (a point, optional) | Comes in to land there, or on the first clear ground ahead, and walks on |
| `hit` | `from` (`"left"`, `"right"`, `"front"`, `"back"`, or degrees from its facing, 90 its left; default `"left"`), `strength` (0 to 1, default 0.5), `bone` (a bone name, as hit capsules give them) | A blow: it flinches away from it (a blow from its left pushes it to its right), and staggers if the blow would carry its body past its feet. Bipeds and tall, narrow bodies (a horse, a cheetah) stagger from about 0.35–0.45, a wolf from 0.5, broad, low bodies (a bear, a boar) from about 0.8, a tortoise only at 1, and a spider on eight legs not at all |
| `die` | `from` (as `hit`; default `"right"`) | It dies and collapses onto the ground, falling away from the blow; later calls do nothing |
| `drive` | `speed` (m/s), `heading` (degrees) | Keeps moving with no destination |
| `stop` | | Stops moving |
| `act` | `action` (one of the creature's), `target` (a point) | Starts an action aimed at the point; one runs at a time, and a new one replaces it |
| `lookAt` | `target` (a point, or `null`) | Turns the head toward the point; `null` looks ahead again |
| `gait` | `gait` (one of the creature's, or `null`) | Keeps to one gait whatever the speed (a `gait` event says so); `null` lets speed choose |

A new `moveTo`, `drive` or `stop` ends a course in progress. Calls at the same time run in the
order written. Mistakes come back like blueprint errors, with a path under `scenario`, the
valid values and a fix: an unknown target name, an action the creature does not have, `fly` or
`land` for a creature without wings (`cannot_fly`). A call after the end is a warning
(`after_end`): the scenario still runs, without it.

## What you get back

`analyze` adds `scenario` to its result (and `render` adds it to `info.motion`):

| Field | Meaning |
| --- | --- |
| `end` | Where it ended: `x`, `z` (metres), `heading` (degrees), `speed` (m/s) |
| `distance` | Metres travelled, measured along the ground (walking, swimming or flying) |
| `topSpeed` | The fastest it went (m/s) |
| `body` | The middle of its torso: the `lowest` and `highest` it went in the world (metres; under a sea's surface is below 0, so a dive to 3 m shows about -3) and the most it rose `aboveGround`, over the ground under it (a flyer's altitude, a leap's height; in water, its height over the bed) |
| `turned` | Degrees it turned in all, left and right alike |
| `events` | Every event but footsteps, with `time` in seconds: `arrive` (at a `moveTo` point or each course point, with the `position` it stopped at), `gait` (a change of gait), `medium` (into the water, out onto land, into the air, with `medium`), `hit`, `stagger` and `death`, `takeoff` and `land` (a flight's, or a leap's with its `action`), `action-start`, `action-end` and the action's own (`bite-contact`, `roar-peak`); wingbeats (`flap`) are left out like footsteps |
| `footsteps` | How many steps it took |
| `gaits` | Gaits in the order used, each with when it began |
| `targets` | Per target, the `closest` any snout came (metres) and when |
| `courses` | Per `follow` call, how many of its points it `reached` |
| `footSlide` | Largest distance a planted foot slid (metres), leaving out staggers and dying; above a centimetre or two is visible |
| `failed` | Calls the creature refused, with why (also a `call_failed` warning) |

So a bite that lands shows a `bite-contact` event and a small `closest` for its target, and a
course walked to the end shows `reached` equal to its point count.

The filmstrip shows the frames, the targets as amber balls, the course's ground, any water as a
translucent sheet, and the events on a timeline below. Uneven ground has no grid; its facets
show where the bumps are. It looks from the side, from above for legless bodies (serpents,
fish), and at three-quarters for actions; `--view` (MCP `filmstrip.view`) picks `side`, `3/4`,
`top` or `front`. The camera follows the creature, so read heights, depths and
turns from `body`, `turned` and `end` rather than the frames; `side` shows a dive or a climb
best.

## Examples

- [`stalk-and-bite.json`](../examples/scenarios/stalk-and-bite.json): the ridgeback stalker walks
  up to a point, keeping its eyes on the prey, and bites it.
- [`course.json`](../examples/scenarios/course.json): it follows a winding route over the uneven
  course.
- [`swim-across.json`](../examples/scenarios/swim-across.json): a lake across the way; the river
  crocodile walks in, swims across and climbs out the far side.
- [`flight-course.json`](../examples/scenarios/flight-course.json): a flyer takes off from flat
  ground, circles at its cruising height, and comes in to land uphill on a 15° slope 80 m ahead.
  Try it with the ash dragon, the storm wyvern, the cave bat or the luna moth (which hovers).
- [`hit-and-die.json`](../examples/scenarios/hit-and-die.json): on the uneven course, a blow from
  the left, a heavy one that staggers it, and a death from the left: it falls onto its right
  side.
