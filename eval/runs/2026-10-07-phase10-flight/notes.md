# 10.4 Flight: notes

The milestone's "done when" (docs/design/10.4-flight.md), checked at the commit that adds this
folder. `flight.test.ts` checks each line; the filmstrips are here to look at.

| Check | Bar | Result |
| --- | --- | --- |
| The course | Dragon, bat, wyvern and moth take off, circle, glide and land on a 15° slope | All four, and the griffin: `analyze`'s flight run and `scenarios/flight-course.json` (`*.course.png`) |
| Wings in flight | No `wing_intersection` while flying | None for any of the five; the griffin's worst is 1.0 cm at the top of a flare's stroke, under its 1.2 cm bar |
| Level flight | Within 10% of the asked height | 4.9% for each, the band it settles in after the climb |
| Landings | No point deeper than 2% of hip height into the slope | 0 for the dragon, bat, wyvern and griffin, under 0.01 mm for the moth; uphill, downhill and across in the test |
| Flying motion | ≤ 0.15 ms per creature | 0.033 (moth) to 0.077 ms (dragon) per 60 Hz frame (`budgets.json`); walking unchanged |
| Wingbeats | Strokes read as flight | `*.fly.png` (one wingbeat side on), `luna-moth.hover.png` |

Wing loading: dragon 373 N/m² (cruise 25 m/s, 1.7 beats a second), wyvern 203 (18), griffin 616 (32), bat 57 (10),
moth 104 (13, 7.2 beats a second). The rhino beetle's 1,856 is beyond flight, and hind wings big enough hang below
its body folded, so the example is grounded.
