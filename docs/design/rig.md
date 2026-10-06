# Design: the rig for plan 2

A sketch for milestone 7.4 (rig lists without a visible change) and phase 9 (new bodies), written
in 7.3 beside [the format 0.2 design](7.3-format-0.2.md). It says how heads, tails and the new
limb roles appear in the compiled rig, how part modules declare bones and what drives them, how gait
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
  /** `head` for the main (middle) head at every count; the others `head.L1`, `head.R1`, … */
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
  /** `tail` for the main tail; the others `tail.L1`, `tail.R1`, … */
  readonly id: string;
  /** Root to tip; a forked tail's branches start at the fork and share the trunk's bones. */
  readonly bones: readonly number[];
  /** Index of the first bone after the shared trunk (0 when the tails are separate). */
  readonly branch: number;
}

/**
 * A chain of bones something drives: springs (tails, tentacles, antennae, ears), the blink
 * (eyelids), the jaw (mandibles close with it) or a flare (frills open, quills rise; the `display`
 * action runs it).
 * Driven chains move between named poses of relative joint angles.
 */
interface DrivenChain {
  readonly owner: string;
  readonly bones: readonly number[];
  readonly drive: 'spring' | 'blink' | 'jaw' | 'flare';
  /** For springs: how hard each point is pulled back toward its rest place per step (0 to 1). */
  readonly stiffness?: number;
  /** For springs: whether the action goals' `swish` swings it (tails). */
  readonly swish?: boolean;
  /** For the others: joint angles per pose, e.g. `rest`, `open`, `closed`. */
  readonly poses?: Readonly<Record<string, readonly number[]>>;
}

interface Rig {
  readonly root: number;
  readonly spine: readonly number[];
  readonly heads: readonly HeadRig[];
  /** Index into `heads` of the main head (the middle one): plain `head` in sockets and looks. */
  readonly main: number;
  readonly tails: readonly TailRig[];
  readonly chains: readonly DrivenChain[];
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

- 7.4 adds `heads`, `main`, `tails` and `chains` and removes `neck`, `head`, `jaw`, `tail` and
  `eyes`; with one head and one tail the lists hold exactly today's bones, so the goldens stay
  the same. `wings`, `fins` and `tentacles` are empty until phase 9.
- Bone names and random streams stay keyed by id. The main head keeps the names `neck.0`,
  `head`, `jaw` at every count, so its bones, its seeded glances and the goldens never move.
  Other heads' bones take their instance as a prefix (`head.L1/neck.0`, `head.L1`,
  `head.L1/jaw`); instance tokens start with a letter, so they never read as a bone index.
- Paths (`b.path`) get one entry per instance (`head.L1`, `jaw.R1`, `tail.L2`) and keep the plain
  name for the main one. Expanding parts into copies loops over every instance of the section a
  part names; limbs use the main instance unless they name another. A copy's id is the part's id
  plus the instance suffix, then the side (`horns.L1.L`), including for parts on parts, and an
  `on` that names no instance is an error rather than a fallback.

## Limbs of the new roles

- **Wings** are arm-like chains (shoulder, elbow, wrist) whose `membrane` module grows digit
  chains off the last bone through the same hook a foot uses for toes (`hooks.toes`, renamed
  `digits` when a second user arrives), then builds the membrane spanning the digits, the body
  and, for bats, the hind limb. A `WingRig` holds the arm bones, the digit chains, a folded and a
  spread pose (relative joint angles), and the membrane's vertex weights come from the bones it
  spans.
- **Fins** are short flat chains with a `membrane.fin` surface; `FinRig` holds the chain and its
  beat axis.
- **Tentacles** are chains of up to 16 bones with a rest curl; each is also a spring-driven chain, and
  `TentacleRig` adds what reaching needs (CCD or FABRIK on the chain).
- Legs stay the only weight bearers: posture, hip height, gaits and balance read `legs` alone.

## Parts with bones

A part module may declare bone chains with a new hook, beside `build`:

```ts
bones?(ctx: PartBuildContext, params): {
  readonly chains: readonly {
    readonly points: readonly Vector3[]; // in socket space, root first
    readonly radii: readonly number[];
    readonly drive?: 'spring' | 'blink' | 'jaw' | 'flare';
    readonly stiffness?: number;
    readonly poses?: Readonly<Record<string, readonly number[]>>;
  }[];
};
```

- The compiler appends the chains after the body's bones, parented to the bone the socket sits
  on, as it already does for eye bones. `build` then gets the bone ids and binds pieces to them
  (`emit(piece, socket, { bone })` exists today).
- Chains with a drive join `Rig.chains`: antennae and ears on springs (9.4), eyelids on the blink
  (8.3), mandibles on the jaw (9.4), frills, hoods and quills on a flare (9.5). The controller
  runs each drive generically, so no module needs the core to know its name.
- The hook makes "one capability is one file" hold for parts that move: `antenna` declares its
  chain and its look in one module.

## Gaits, media, features and capabilities

- Gait modules gain `medium: 'land' | 'water' | 'air'` (default `land`) and `needs`, as actions
  have. `legPairs` stays for land gaits.
- `Feature` gains `wing`, `fin` and `tentacle`; `bodyFeatures` reports them from the limb roles.
- **Capabilities.** Modules may declare what they give a body (`provides: ['pincer']` on
  `hand.pincer`, `['display']` on `frill`, `hood` and `quills`, `['hover']` on
  `membrane.insect`). `bodyFeatures` adds every capability the blueprint's modules provide.
- **Needs with alternatives.** An entry in `needs` may be a list, meaning any of them: `lash`
  needs `[['tail', 'tentacle']]`, `pinch` needs `['pincer']`, `display` needs `['display']`,
  `hover` needs `['wing', 'hover']`. So the core never names the modules behind a capability.
- The controller gets one mode per medium (10.3 adds water, 10.4 air), and picks gaits within the
  current medium by Froude number, as it does on land.

## Readers that move to lists in 7.4

| Reader | Today | After |
| --- | --- | --- |
| `compile/skeleton.ts` | Builds one neck, head, jaw and tail | Loops over the instances (one each until 9.1) |
| `compile/mouth.ts`, the mouth cut | One mouth line | One per head with a jaw |
| `compile/parts.ts` | `on: head` is one target; mouth-slot parts use the one mouth | Copies per instance; mouth parts per head |
| `compile/compile.ts` | `RigData` singles; sockets `head`, `mouth`, `tail`; markers | Lists; sockets per instance plus the main-head aliases |
| `motion/controller.ts` | Look, glances, jaw and the tail spring on singles | Per head (streams keyed by head id); the `chains` list |
| `motion/actions.ts`, actions | One head position | Goals apply to every head; a target picks the nearest |
| `motion/clips.ts` | The jaw for clips | Every jaw |
| `analysis/analyze.ts`, `stats.ts` | Bite reach and head height of one head | Per head, with the main head first |
| `three/assemble.ts`, `export.ts`, `runtime.ts` | Sockets and hit capsules | Per instance |
| `render/page/main.ts`, `filmstrip.ts` | The head close-up frames the head bones | Frames the main head |

**Done when** (7.4): the goldens, the motion tests and the render baselines are unchanged, and the
motion cost is within 15% of today's.

**Built in 7.4** as above, with these choices: springs keep today's per-step `stiffness` (and a
`swish` flag for tails) rather than a frequency and damping; mouth-slot parts use the mouth of
the head their `on` names (`head.L1`, `jaw.L1`), else the main head's; each eye belongs to the
head whose bones it hangs from; an action aimed at a target uses the nearest head, and only that
head lunges, while every head turns to look; `analyze` adds `reach.heads` (main first) when
there are several, and stats modules get `heads`. Glances still come from one stream for all
heads; 9.1 keys them per head when heads differ.
