# Design: the rig for plan 2

A sketch for milestone 7.4 (rig lists without a visible change) and phase 9 (new bodies), written
in 7.3 beside [the format 0.2 design](7.3-format-0.2.md). It says how heads, tails and the new
limb roles appear in the compiled rig, how part modules declare bones and springs, how gait
modules declare their medium, and which readers change. 7.4 builds the lists; phase 9 fills them.

## Today

`Rig` (`packages/core/src/compile/types.ts`) and its plain-data twin `RigData`
(`compile/compile.ts`) hold one of each: `neck: number[]`, `head`, `jaw`, `tail: number[]` and
`eyes: number[]`, beside lists of `legs` and `arms`. Only the tail has a spring
(`motion/controller.ts`). Readers of the single fields: the controller (about 20 uses), compile
(sockets, markers, the mouth cut, about 12), analysis (4), clips, the render page and filmstrips,
the Three.js assembly and export, and the motion and compile tests.

## The rig in lists

```ts
interface HeadRig {
  /** `head` with one head; `head.1` … `head.N` from the creature's left to its right. */
  readonly id: string;
  /** Neck bones from the torso to the head (empty with no neck). */
  readonly neck: readonly number[];
  readonly head: number;
  /** -1 without a jaw. */
  readonly jaw: number;
  /** Eye bones on this head. */
  readonly eyes: readonly number[];
}

interface TailRig {
  /** `tail` with one tail; `tail.1` … from left to right. */
  readonly id: string;
  /** Root to tip; a split tail's branches start at the fork and share the trunk's bones. */
  readonly bones: readonly number[];
  /** Index of the first bone after the shared trunk (0 when the tails are separate). */
  readonly branch: number;
}

/** A chain the controller swings on springs: tails, tentacles, antennae, ears. */
interface SpringChain {
  readonly owner: string;
  readonly bones: readonly number[];
  /** Natural frequency (Hz, at 1 m size) and damping ratio; the controller scales by size. */
  readonly frequency: number;
  readonly damping: number;
}

interface Rig {
  readonly root: number;
  readonly spine: readonly number[];
  readonly heads: readonly HeadRig[];
  /** Index into `heads` of the main head (the middle one): plain `head` in sockets and looks. */
  readonly main: number;
  readonly tails: readonly TailRig[];
  readonly springs: readonly SpringChain[];
  readonly legs: readonly LegRig[];
  readonly arms: readonly ArmRig[];
  /** Phase 9: wing and fin limbs (arm-like chains plus digit chains), and tentacles. */
  readonly wings: readonly WingRig[];
  readonly fins: readonly FinRig[];
  readonly tentacles: readonly TentacleRig[];
  readonly hipHeight: number;
  readonly posture: 'upright' | 'sprawl' | 'legless';
}
```

- 7.4 adds `heads`, `main`, `tails` and `springs` and removes `neck`, `head`, `jaw`, `tail` and
  `eyes`; with one head and one tail the lists hold exactly today's bones, so the goldens stay
  the same. `wings`, `fins` and `tentacles` are empty until phase 9.
- Bone names and random streams stay keyed by id. A single head keeps the names `neck.0`,
  `head`, `jaw`, so its bones, its seeded glances and the goldens do not change. Extra heads'
  bones take the head's id as a prefix (`head.2/neck.0`).
- Paths (`b.path`) get one entry per instance (`head.2`, `jaw.2`, `tail.3`) and one for the
  group name (`head`, `tail`), which resolves to the main instance for limbs and to every
  instance when parts are expanded into copies.

## Limbs of the new roles

- **Wings** are arm-like chains (shoulder, elbow, wrist) whose `membrane` module grows digit
  chains off the last bone through the same hook a foot uses for toes (`hooks.toes`, renamed
  `digits` when a second user arrives), then builds the membrane spanning the digits, the body
  and, for bats, the hind limb. A `WingRig` holds the arm bones, the digit chains, a folded and a
  spread pose (relative joint angles), and the membrane's vertex weights come from the bones it
  spans.
- **Fins** are short flat chains with a `membrane.fin` surface; `FinRig` holds the chain and its
  beat axis.
- **Tentacles** are chains of up to 16 bones with a rest curl; each is also a `SpringChain`, and
  `TentacleRig` adds what reaching needs (CCD or FABRIK on the chain).
- Legs stay the only weight bearers: posture, hip height, gaits and balance read `legs` alone.

## Parts with bones

A part module may declare bone chains with a new hook, beside `build`:

```ts
bones?(ctx: PartBuildContext, params): {
  readonly chains: readonly {
    readonly points: readonly Vector3[]; // in socket space, root first
    readonly radii: readonly number[];
    readonly spring?: { readonly frequency: number; readonly damping: number };
  }[];
};
```

- The compiler appends the chains after the body's bones, parented to the bone the socket sits
  on, as it already does for eye bones. `build` then gets the bone ids and binds pieces to them
  (`emit(piece, socket, { bone })` exists today).
- Chains with a `spring` join `Rig.springs`; antennae (9.4), ear springs and frill spines (9.5)
  use it. Eyelid bones (8.3) are chains without springs that the blink drives.
- The hook makes "one capability is one file" hold for parts that move: `antenna` declares its
  chain and its look in one module.

## Gaits, media and features

- Gait modules gain `medium: 'land' | 'water' | 'air'` (default `land`) and `needs` (body
  features, as actions have). `legPairs` stays for land gaits.
- `Feature` gains `wing`, `fin` and `tentacle`; `bodyFeatures` reports them from the limb roles.
- The controller gets one mode per medium (10.3 adds water, 10.4 air), and picks gaits within the
  current medium by Froude number, as it does on land.

## Readers that move to lists in 7.4

| Reader | Today | After |
| --- | --- | --- |
| `compile/skeleton.ts` | Builds one neck, head, jaw and tail | Loops over the instances (one each until 9.1) |
| `compile/mouth.ts`, the mouth cut | One mouth line | One per head with a jaw |
| `compile/parts.ts` | `on: head` is one target; mouth-slot parts use the one mouth | Copies per instance; mouth parts per head |
| `compile/compile.ts` | `RigData` singles; sockets `head`, `mouth`, `tail`; markers | Lists; sockets per instance plus the main-head aliases |
| `motion/controller.ts` | Look, glances, jaw and the tail spring on singles | Per head (streams keyed by head id); `springs` list |
| `motion/actions.ts`, actions | One head position | Goals apply to every head; a target picks the nearest |
| `motion/clips.ts` | The jaw for clips | Every jaw |
| `analysis/analyze.ts`, `stats.ts` | Bite reach and head height of one head | Per head, with the main head first |
| `three/assemble.ts`, `export.ts`, `runtime.ts` | Sockets and hit capsules | Per instance |
| `render/page/main.ts`, `filmstrip.ts` | The head close-up frames the head bones | Frames the main head |

**Done when** (7.4): the goldens, the motion tests and the render baselines are unchanged, and the
motion cost is within 15% of today's.
